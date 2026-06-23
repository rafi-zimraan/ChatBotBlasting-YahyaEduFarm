const client = require('./client');
const state = require('./state');
const config = require('./config');
const utils = require('./utils');
const handlers = require('./handlers');

const buildConvList = () => {
    return Object.values(state.conversations)
        .sort((a, b) => (b.lastTime || '') > (a.lastTime || '') ? 1 : -1)
        .map(c => ({ id: c.id, name: c.name, phone: c.phone, lastMsg: c.lastMsg, lastTime: c.lastTime, unread: c.unread || 0 }));
};

const recordMsg = (userId, name, content, isBot = false) => {
    if (!state.conversations[userId]) {
        state.conversations[userId] = { id: userId, name: name || userId, phone: userId, messages: [], lastMsg: '', lastTime: null, unread: 0 };
    }
    const conv = state.conversations[userId];
    if (name && name !== userId && !isBot) conv.name = name;
    const msg = { from: isBot ? 'bot' : 'user', content: content || '', time: new Date().toISOString() };
    conv.messages.push(msg);
    if (conv.messages.length > 150) conv.messages = conv.messages.slice(-150);
    conv.lastMsg = (content || '').substring(0, 80);
    conv.lastTime = msg.time;
    if (!isBot) conv.unread = (conv.unread || 0) + 1;
    if (state.io) {
        state.io.emit('conv-update', { id: userId, conv: { ...conv, messages: conv.messages.slice(-20) } });
        state.io.emit('conv-list-update', buildConvList());
    }
};

const trackAnalytics = (type) => {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.analytics[today]) state.analytics[today] = { private: 0, groupFaq: 0, blasts: 0 };
    state.analytics[today][type]++;
    // Hapus data lebih dari 30 hari
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    Object.keys(state.analytics).forEach((d) => { if (d < cutoff) delete state.analytics[d]; });
    if (state.io) state.io.emit('analytics-update', state.analytics);
};

const trackNewUser = (senderId, senderName) => {
    const alreadyExists = state.newUsers.some(u => u.id === senderId);
    if (!alreadyExists) {
        state.newUsers.unshift({
            id: senderId,
            name: senderName || 'Unknown',
            time: new Date().toISOString(),
        });
        if (state.newUsers.length > 50) state.newUsers.length = 50;
        state.saveData();
        if (state.io) state.io.emit('new-users-update', state.newUsers);
    }
};

const processMessage = async (message, senderId, senderName, text) => {
    if ((state.blockedContacts || []).some(b => b.id === senderId)) return;
    trackNewUser(senderId, senderName);
    if (utils.isSpam(senderId)) return;

    if (state.handoverUsers[senderId]) {
        if (!state.handoverWarned[senderId]) {
            state.handoverWarned[senderId] = true;
            return message.reply('Mohon tunggu, admin segera menghubungi Anda.');
        }
        return;
    }

    // Out-of-hours check
    if (!utils.isBusinessHours()) {
        const today = new Date().toISOString().slice(0, 10);
        const firstToday = state.outOfHoursNotified[senderId] !== today;

        if (firstToday) {
            state.outOfHoursNotified[senderId] = today;
            await message.reply(utils.OUT_OF_HOURS_MSG);
        }

        // Tetap cek handover di luar jam kerja
        const normalizedHour = utils.normalize(text || '');
        if (state.botMenu && (normalizedHour === '8' || /^(hubungi\s*admin|admin|cs|mau\s*bicara\s*admin|ingin\s*hubungi\s*admin)$/i.test(normalizedHour))) {
            const riwayat = (state.chatHistory[senderId] || [])
                .filter((m) => m.role === 'user').slice(-3)
                .map((m) => m.content).join(' | ');
            const replyHandover = await handlers.handleHandover(senderId, senderName, riwayat);
            return message.reply(replyHandover);
        }

        if (!firstToday) return;
        return;
    }

    const media = handlers.handleMedia(message);
    if (media.tolak) {
        return message.reply(media.balasan);
    }

    const rawText = media.teks || text;

    if (rawText.length > config.MAX_CHARS_INPUT) {
        return message.reply(
            `Pesan yang dikirim terlalu panjang.\n` +
            'Mohon sampaikan pertanyaan secara singkat agar dapat kami bantu dengan lebih baik.'
        );
    }

    const normalizedText = utils.normalize(rawText);

    if (state.botMenu && !media.teks) {
        const menuReply = handlers.handleMenu(normalizedText);
        if (menuReply) return message.reply(menuReply);

        if (normalizedText === '8') {
            const riwayat = (state.chatHistory[senderId] || [])
                .filter((m) => m.role === 'user').slice(-3)
                .map((m) => m.content).join(' | ');
            const replyHandover = await handlers.handleHandover(senderId, senderName, riwayat);
            return message.reply(replyHandover);
        }
    }

    const faqReply = handlers.handleCustomFAQ(normalizedText, state.customFAQ);
    if (faqReply) {
        trackAnalytics('private');
        await handlers.sendFAQReply(message, faqReply);
        return;
    }

    if (state.handleHotLeadAktif) {
        const hot = handlers.handleHotLead(normalizedText);
        if (hot) return message.reply(hot);
    }

    if (state.batasiPesanPerHari && utils.cekLimitHarian(senderId)) {
        return message.reply(
            `Batas percakapan harian Anda telah tercapai.\n` +
            'Silakan hubungi kembali besok atau hubungi admin di:\n' +
            'WA: 0852-4973-1265\n' +
            config.MENU_TEXT
        );
    }

    let reply = await handlers.handleAI(senderId, rawText, message);

    // Kirim menu terpisah hanya untuk pesan pertama user
    const userMsgCount = (state.chatHistory[senderId] || []).filter((m) => m.role === 'user').length;
    if (userMsgCount === 1 && state.botMenu) {
        setTimeout(() => message.reply(config.MENU_TEXT), 1000);
    }

    trackAnalytics('private');
    await message.reply(reply);
    console.log('─'.repeat(40));
};

// =====================
// MAIN EVENT — Pesan private & grup
// =====================
client.on('message', async (message) => {
    try {
        if (message.from.endsWith('@newsletter')) return;
        if (message.from === 'status@broadcast') return;
        if (message.from.endsWith('@broadcast')) return;
        if (message.type === 'e2e_notification') return;
        if (message.type === 'notification_template') return;

        const isGroup = message.from.endsWith('@g.us');

        if (isGroup) {
            if (message.fromMe) return;
            if (message.timestamp < state.BOT_START_TIME) return;
            if (!state.botAktif) return;

            const normalizedBody = utils.normalize(message.body || '');
            const blastFaqObj = handlers.handleCustomFAQ(normalizedBody, state.customFAQBlasting);
            if (blastFaqObj) {
                const groupChat = await message.getChat();
                if (!utils.isBusinessHours()) {
                    const today = new Date().toISOString().slice(0, 10);
                    const groupKey = `group_${groupChat.id._serialized}`;
                    if (state.outOfHoursNotified[groupKey] !== today) {
                        state.outOfHoursNotified[groupKey] = today;
                        return message.reply(utils.OUT_OF_HOURS_MSG);
                    }
                    return;
                }
                const blastPreview = (message.body || '').substring(0, 60);
                console.log(`[FAQ BLAST] "${blastPreview}..." → grup ${groupChat.name}`);
                trackAnalytics('groupFaq');
                await handlers.sendFAQReply(message, blastFaqObj);
                return;
            }

            if (!utils.isMentioned(message)) return;

            const contact = await message.getContact();
            const nama = contact.name || contact.pushname || 'Unknown';
            const groupChat = await message.getChat();
            const groupName = groupChat.name || 'Grup';
            const cleanText = utils.cleanMention(message.body);
            if (!cleanText) return;

            console.log(`[GRUP ${groupName}] ${nama}: ${cleanText.substring(0, 80)}${cleanText.length > 80 ? '...' : ''}`);
            await processMessage(message, contact.id.user, nama, cleanText);
        } else {
            if (message.fromMe) return;
            if (message.timestamp < state.BOT_START_TIME) return;
            if (!state.botAktif) return;

            const contact = await message.getContact();
            const nama = contact.name || contact.pushname || 'Unknown';
            const preview = (message.body || '').substring(0, 80);
            console.log(`[DM] ${nama} (${message.from}): ${preview}${message.body?.length > 80 ? '...' : ''}`);
            recordMsg(contact.id.user, nama, message.body || '');
            await processMessage(message, contact.id.user, nama, message.body);
        }
    } catch (err) {
        console.error('Error:', err.message);
        try {
            await message.reply('Mohon maaf, terjadi kendala teknis. Silakan coba beberapa saat lagi.');
        } catch (e) {}
    }
});

// Track outgoing bot messages for Monitoring Chat
client.on('message_create', async (msg) => {
    try {
        if (!msg.fromMe) return;
        if (!msg.to || msg.to.endsWith('@g.us') || msg.to.endsWith('@broadcast')) return;
        const userId = msg.to.replace('@c.us', '').replace('@lid', '');
        if (userId === (state.botOwnId || '')) return;
        const content = msg.body || '';
        if (!content) return;
        recordMsg(userId, state.conversations[userId]?.name || userId, content, true);
    } catch (e) {}
});

module.exports = { processMessage, trackAnalytics };

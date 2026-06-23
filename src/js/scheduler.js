const { MessageMedia } = require('whatsapp-web.js');
const state = require('./state');

let _pageReportedDead = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryableError = (err) => {
    if (!err || !err.message) return false;
    return err.message.includes('detached Frame') ||
           err.message.includes('Cannot read properties of null');
};

const retry = async (fn, retries = 3, delayMs = 3000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fn();
            return res;
        } catch (err) {
            if (isRetryableError(err) && i < retries - 1) {
                console.log(`🔄 Error sementara, coba lagi (${i + 1}/${retries})...`);
                await sleep(delayMs);
                continue;
            }
            throw err;
        }
    }
};

const getClient = () => {
    try {
        return require('./client');
    } catch (e) {
        return null;
    }
};

const refreshGroups = async () => {
    const client = getClient();
    if (!client || typeof client.getChats !== 'function') {
        console.error('❌ Client tidak tersedia saat refreshGroups');
        return;
    }
    try {
        const chats = await retry(() => client.getChats());
        state.groupsCache = chats.filter((c) => c.isGroup).map((c) => ({
            id: c.id._serialized,
            name: c.name || 'Tanpa Nama',
            memberCount: c.participants?.length || 0,
        }));
        state.lastGroupsRefresh = Date.now();
        _pageReportedDead = false;
        console.log(`🔄 Daftar grup diperbarui: ${state.groupsCache.length} grup ditemukan`);
    } catch (err) {
        if (!_pageReportedDead) {
            _pageReportedDead = true;
            console.error('⚠️ Halaman WhatsApp Web bermasalah. Blast & refresh grup mungkin gagal.');
            console.error('   Coba restart bot jika masalah berlanjut.');
        }
    }
};

const executeBlast = async (message, targetGroupIds = null, media = null) => {
    const client = getClient();
    if (!client || typeof client.getChats !== 'function') {
        console.error('❌ Client tidak tersedia saat executeBlast');
        return { sukses: 0, gagal: 0, total: 0 };
    }

    await refreshGroups();
    let targets = state.groupsCache;
    if (targetGroupIds && targetGroupIds.length > 0) {
        targets = state.groupsCache.filter((g) => targetGroupIds.includes(g.id));
    }
    if (targets.length === 0) {
        console.log('⚠️ Tidak ada grup untuk blast');
        return { sukses: 0, gagal: 0, total: 0 };
    }

    const hasMedia = media && media.data && media.mimetype;
    console.log(`📨 Blast ke ${targets.length} grup dimulai...${hasMedia ? ' (dengan media)' : ''}`);
    let sukses = 0;
    let gagal = 0;

    for (let i = 0; i < targets.length; i++) {
        const group = targets[i];
        try {
            const chat = await retry(() => client.getChatById(group.id));
            if (hasMedia) {
                const mediaObj = new MessageMedia(media.mimetype, media.data, media.filename || 'media');
                await retry(() => chat.sendMessage(mediaObj, { caption: message }));
            } else {
                await retry(() => chat.sendMessage(message));
            }
            sukses++;
            console.log(`✅ Terkirim ke ${group.name} (${i + 1}/${targets.length})`);

            if (state.io) {
                state.io.emit('blast-progress', {
                    current: i + 1,
                    total: targets.length,
                    currentDetail: `Mengirim ke: ${group.name}`,
                });
            }

            const delay = 4000 + Math.floor(Math.random() * 4000);
            await sleep(delay);
        } catch (err) {
            gagal++;
            console.error(`❌ Gagal blast ke ${group.name}: ${err.message}`);
            await sleep(5000);
        }
    }

    const result = { sukses, gagal, total: targets.length };
    console.log(`✅ Blast selesai: ${sukses} sukses, ${gagal} gagal dari ${targets.length} grup`);

    const today = new Date().toISOString().slice(0, 10);
    if (!state.analytics[today]) state.analytics[today] = { private: 0, groupFaq: 0, blasts: 0 };
    state.analytics[today].blasts++;
    if (state.io) state.io.emit('analytics-update', state.analytics);

    state.blastHistory.unshift({
        message: message ? message.substring(0, 200) : '(media tanpa teks)',
        media: hasMedia ? media.filename || 'media' : null,
        time: new Date().toLocaleString('id-ID'),
        sukses,
        gagal,
        total: targets.length,
    });

    if (state.io) {
        state.io.emit('blast-complete', result);
    }

    return result;
};

const normalizePhone = (phone) => {
    let p = String(phone).replace(/[\s\-\+\(\)]/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p + '@c.us';
};

const executePersonalCampaign = async (campaign) => {
    const client = getClient();
    if (!client || typeof client.sendMessage !== 'function') {
        console.error('❌ Client tidak tersedia saat executePersonalCampaign');
        campaign.status = 'failed';
        if (state.io) state.io.emit('campaigns-update', state.personalCampaigns);
        return;
    }

    let targets = state.contacts || [];
    if (campaign.targetLabel) {
        targets = targets.filter((c) => c.label === campaign.targetLabel);
    }

    campaign.status = 'running';
    campaign.totalTarget = targets.length;
    campaign.sentCount = 0;
    campaign.failCount = 0;
    if (state.io) state.io.emit('campaigns-update', state.personalCampaigns);

    if (targets.length === 0) {
        campaign.status = 'done';
        state.saveData();
        if (state.io) state.io.emit('campaigns-update', state.personalCampaigns);
        return;
    }

    const speedDelay = campaign.speedDelay || 5000;
    console.log(`📨 Campaign "${campaign.name}" → ${targets.length} kontak dimulai...`);

    for (let i = 0; i < targets.length; i++) {
        const contact = targets[i];
        const waId = normalizePhone(contact.phone);
        try {
            await retry(() => client.sendMessage(waId, campaign.message));
            campaign.sentCount++;
            console.log(`✅ Campaign → ${contact.name} (${i + 1}/${targets.length})`);

            // Catat ke Monitoring Chat
            const userId = waId.replace('@c.us', '');
            state.recordMsg(userId, contact.name || contact.phone, campaign.message, true);
            state.saveData();

            if (state.io) {
                state.io.emit('campaign-progress', {
                    id: campaign.id,
                    current: i + 1,
                    total: targets.length,
                    currentName: contact.name,
                    sentCount: campaign.sentCount,
                });
                state.io.emit('campaigns-update', state.personalCampaigns);
            }

            const jitter = Math.floor(Math.random() * 2000);
            await sleep(speedDelay + jitter);
        } catch (err) {
            campaign.failCount++;
            console.error(`❌ Gagal campaign ke ${contact.name}: ${err.message}`);
            await sleep(5000);
        }
    }

    campaign.status = 'done';
    state.saveData();
    console.log(`✅ Campaign "${campaign.name}" selesai: ${campaign.sentCount} sukses, ${campaign.failCount} gagal`);
    if (state.io) state.io.emit('campaigns-update', state.personalCampaigns);
};

const startScheduler = () => {
    if (state.blastSchedulerId) return;
    state.blastSchedulerId = setInterval(async () => {
        if (state.scheduledBlasts.length === 0) return;
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        for (const jadwal of state.scheduledBlasts) {
            if (!jadwal.enabled) continue;
            if (jadwal.time === currentTime) {
                console.log(`⏰ Jadwal blast terpicu: ${jadwal.time} — "${jadwal.message.substring(0, 40)}..."`);
                await executeBlast(jadwal.message);
            }
        }

        for (const campaign of (state.personalCampaigns || [])) {
            if (campaign.status !== 'scheduled' || !campaign.scheduledAt) continue;
            if (now >= new Date(campaign.scheduledAt)) {
                console.log(`⏰ Campaign terjadwal terpicu: "${campaign.name}"`);
                executePersonalCampaign(campaign);
            }
        }
    }, 30000);
};

const stopScheduler = () => {
    if (state.blastSchedulerId) {
        clearInterval(state.blastSchedulerId);
        state.blastSchedulerId = null;
    }
};

module.exports = {
    refreshGroups,
    executeBlast,
    executePersonalCampaign,
    startScheduler,
    stopScheduler,
};

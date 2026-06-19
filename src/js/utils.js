const state = require('./state');
const config = require('./config');

const getHistory = (id) => state.chatHistory[id] || [];

const addHistory = (id, role, content) => {
    state.chatHistory[id] = [...getHistory(id), { role, content }].slice(-config.MAX_HISTORY);
};

const isSpam = (id) => {
    const now = Date.now();
    const last = state.userCooldown[id] || 0;
    state.userCooldown[id] = now;
    return now - last < 3000;
};

const cekLimitHarian = (id) => {
    const hari = new Date().toISOString().slice(0, 10);
    const data = state.userMessageCount[id];

    if (!data || data.date !== hari) {
        state.userMessageCount[id] = { count: 1, date: hari };
        return false;
    }

    if (state.userMessageCount[id].count >= config.MAX_PESAN_PER_HARI) {
        return true;
    }

    state.userMessageCount[id].count++;
    return false;
};

const normalize = (text) => text.toLowerCase();

const isBusinessHours = () => {
    // WITA = UTC+8
    const wita = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const hour = wita.getUTCHours();
    return hour >= 8 && hour < 17;
};

const OUT_OF_HOURS_MSG =
    'Halo! Terima kasih sudah menghubungi YahyaEduFarm 🙏\n\n' +
    'Saat ini kami sedang di luar jam layanan.\n' +
    '🕐 Jam operasional: Senin - Minggu, 08.00 - 17.00 WITA\n\n' +
    'Pesan kamu akan kami baca dan balas segera di jam kerja.\n' +
    'Jika ada hal yang mendesak dan ingin langsung terhubung dengan admin,\n' +
    'cukup balas pesan ini dengan kata **hubungi admin** atau kirim angka **8**,\n' +
    'maka admin akan mendapatkan notifikasi dan segera merespon kamu 🙌\n\n' +
    'Atau hubungi langsung via WA: 0852-4973-1265';

const isMentioned = (message) => {
    if (!state.botOwnId) return false;
    if (!message.mentionedIds || !Array.isArray(message.mentionedIds)) return false;
    return message.mentionedIds.includes(state.botOwnId);
};

const cleanMention = (text) => text.replace(/@\d+/g, '').trim();

module.exports = {
    getHistory,
    addHistory,
    isSpam,
    cekLimitHarian,
    normalize,
    isMentioned,
    cleanMention,
    isBusinessHours,
    OUT_OF_HOURS_MSG,
};

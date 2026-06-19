require('dotenv').config();
const client = require('./client');
const state = require('./state');
const config = require('./config');
const scheduler = require('./scheduler');

require('./bot');
require('./commands');

// Web server start langsung — tidak perlu tunggu WhatsApp ready
require('../web/server');

client.on('qr', (qr) => {
    const qrcode = require('qrcode-terminal');
    console.log('📱 Scan QR Code berikut dengan WhatsApp kamu:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Jabatangan — Bot WhatsApp siap!');

    state.botOwnId = client.info.wid._serialized;
    console.log(`📱 Nomor bot: ${state.botOwnId}`);

    state.saveData();

    await scheduler.refreshGroups();
    scheduler.startScheduler();

    console.log(`⚙️ Model AI: ${config.GROQ_MODEL}`);
    console.log(`⚙️ Max tokens: ${config.MAX_TOKENS}`);
    console.log(`👥 Grup terdaftar: ${state.groupsCache.length}`);
    console.log(`⏰ Scheduler blast: aktif`);

    if (state.io) {
        state.io.emit('status-update', { botAktif: state.botAktif, botMenu: state.botMenu });
    }
});

client.on('group_join', async () => {
    await scheduler.refreshGroups();
    if (state.io) state.io.emit('groups-update', state.groupsCache);
});

client.on('group_leave', async () => {
    await scheduler.refreshGroups();
    if (state.io) state.io.emit('groups-update', state.groupsCache);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled error (bot tetap jalan):', reason);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught error (bot tetap jalan):', error.message);
});

client.initialize();

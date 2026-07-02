// Pengganti src/js/client.js selama test — TIDAK PERNAH boot Puppeteer/WhatsApp asli.
const client = {
    sendMessage: jest.fn().mockResolvedValue({}),
    getChatById: jest.fn(),
    getChats: jest.fn().mockResolvedValue([]),
    getState: jest.fn().mockResolvedValue('CONNECTED'),
    on: jest.fn(),
    initialize: jest.fn(),
    info: { wid: { _serialized: '628000000000@c.us' } },
};

module.exports = client;

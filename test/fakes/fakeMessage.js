// Message palsu ala whatsapp-web.js, dipakai lintas test handler & pipeline.
let counter = 0;

const createFakeMessage = (overrides = {}) => {
    counter++;
    const chat = {
        sendMessage: jest.fn().mockResolvedValue({}),
        sendStateTyping: jest.fn().mockResolvedValue({}),
        clearState: jest.fn().mockResolvedValue({}),
        id: { _serialized: overrides.from || `fake_chat_${counter}` },
    };

    return {
        body: '',
        from: `62811100000${counter}@c.us`,
        type: 'chat',
        hasMedia: false,
        fromMe: false,
        timestamp: Math.floor(Date.now() / 1000),
        mentionedIds: [],
        id: { _serialized: `fake_msg_${counter}` },
        reply: jest.fn().mockResolvedValue({}),
        getChat: jest.fn().mockResolvedValue(chat),
        getContact: jest.fn().mockResolvedValue({
            id: { user: 'user' + counter },
            name: 'Test User',
            pushname: 'Test User',
        }),
        ...overrides,
    };
};

module.exports = { createFakeMessage };

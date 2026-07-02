const handlers = require('../../src/js/handlers');
// Require fake langsung (bukan lewat 'src/js/client') — resolusinya identik dengan
// yang dipakai handlers.js secara internal (lihat jest.config.js moduleNameMapper),
// jadi ini instance yang SAMA, bukan sekadar mirip. Menghindari risiko tidak sengaja
// me-require src/js/client.js asli (yang akan boot WhatsApp client sungguhan).
const client = require('../fakes/fakeClient');
const state = require('../../src/js/state');
const config = require('../../src/js/config');
const Groq = require('groq-sdk');
const { createFakeMessage } = require('../fakes/fakeMessage');

const ADMIN_NOMOR = config.ADMIN_ID.split('@')[0]; // '628111111111'

beforeEach(() => {
    client.sendMessage.mockClear();
    client.sendMessage.mockResolvedValue({});
    Object.keys(state.handoverUsers).forEach((k) => delete state.handoverUsers[k]);
    Object.keys(state.handoverWarned).forEach((k) => delete state.handoverWarned[k]);
    Object.keys(state.chatHistory).forEach((k) => delete state.chatHistory[k]);
});

describe('handleMedia', () => {
    test('image tanpa caption ditolak dengan pesan spesifik', () => {
        const res = handlers.handleMedia({ type: 'image', body: '' });
        expect(res.tolak).toBe(true);
        expect(res.teks).toBeNull();
        expect(res.balasan).toMatch(/belum bisa lihat gambar/);
    });

    test('image dengan caption diteruskan sebagai teks', () => {
        const res = handlers.handleMedia({ type: 'image', body: 'ini harga berapa?' });
        expect(res.tolak).toBe(false);
        expect(res.teks).toBe('[User mengirim gambar dengan pesan]: ini harga berapa?');
    });

    test('tipe media lain (video) ditolak dengan pesan default', () => {
        const res = handlers.handleMedia({ type: 'video', body: '' });
        expect(res.tolak).toBe(true);
        expect(res.balasan).toMatch(/cuma bisa bales pesan teks/);
    });

    test('tipe bukan media (chat biasa) tidak masuk cabang manapun', () => {
        const res = handlers.handleMedia({ type: 'chat', body: 'halo' });
        expect(res).toEqual({ tolak: false, teks: null });
    });
});

describe('handleMenu', () => {
    test.each(['1', '2', '3', '5', '6', '7'])('menu %s mengembalikan teks non-null', (opt) => {
        expect(handlers.handleMenu(opt)).toEqual(expect.any(String));
    });

    test('menu 4 mengirim notifikasi ke admin sekali', () => {
        const reply = handlers.handleMenu('4');
        expect(reply).toMatch(/Masjid Ismuhu Yahya/);
        expect(client.sendMessage).toHaveBeenCalledTimes(1);
        expect(client.sendMessage).toHaveBeenCalledWith(config.ADMIN_ID, expect.stringContaining('Masjid Ismuhu Yahya'));
    });

    test('menu 8 mengembalikan null (ditangani terpisah sebagai handover)', () => {
        expect(handlers.handleMenu('8')).toBeNull();
    });

    test('input di luar 1-8 mengembalikan null', () => {
        expect(handlers.handleMenu('halo')).toBeNull();
        expect(handlers.handleMenu('9')).toBeNull();
    });
});

describe('handleCustomFAQ', () => {
    const faqs = [
        { id: 1, keyword: 'harga bibit', answer: 'Rp5000', enabled: true },
        { id: 2, keyword: 'lokasi', answer: 'Kalbar', enabled: false },
    ];

    test('match case-insensitive & substring', () => {
        expect(handlers.handleCustomFAQ('mau tanya HARGA BIBIT dong', faqs)).toEqual(faqs[0]);
    });

    test('FAQ enabled:false diabaikan', () => {
        expect(handlers.handleCustomFAQ('dimana lokasi kalian', faqs)).toBeNull();
    });

    test('tidak ada match -> null', () => {
        expect(handlers.handleCustomFAQ('apa kabar', faqs)).toBeNull();
    });

    test('list kosong -> null', () => {
        expect(handlers.handleCustomFAQ('harga bibit', [])).toBeNull();
        expect(handlers.handleCustomFAQ('harga bibit', null)).toBeNull();
    });
});

describe('handleHotLead', () => {
    test.each(['mau daftar dong', 'saya mau beli', 'tertarik nih', 'gimana cara daftar ya'])(
        'keyword "%s" memicu balasan hot lead',
        (text) => {
            expect(handlers.handleHotLead(text)).toMatch(/hubungi admin/i);
        }
    );

    test('teks tanpa hot keyword -> null', () => {
        expect(handlers.handleHotLead('halo apa kabar')).toBeNull();
    });
});

describe('handleHandover', () => {
    test('bukan admin: mengirim 2 notifikasi berurutan (singkat lalu detail)', async () => {
        const reply = await handlers.handleHandover('628222222222', 'Budi', 'riwayat chat terakhir');

        expect(reply).toMatch(/admin segera menghubungi/i);
        expect(client.sendMessage).toHaveBeenCalledTimes(2);

        const [firstArgs, secondArgs] = client.sendMessage.mock.calls;
        expect(firstArgs[0]).toBe(config.ADMIN_ID);
        expect(firstArgs[1]).toMatch(/Customer minta CS/);
        expect(secondArgs[0]).toBe(config.ADMIN_ID);
        expect(secondArgs[1]).toMatch(/Permintaan CS Manusia/);
        expect(secondArgs[1]).toContain('Budi');
        expect(secondArgs[1]).toContain('628222222222');
        expect(secondArgs[1]).toContain('riwayat chat terakhir');
    });

    test('riwayat kosong tidak menghasilkan baris "Riwayat:"', async () => {
        await handlers.handleHandover('628222222222', 'Budi', '');
        const detail = client.sendMessage.mock.calls[1][1];
        expect(detail).not.toMatch(/Riwayat:/);
    });

    test('nomor admin tidak memicu notifikasi ke dirinya sendiri', async () => {
        await handlers.handleHandover(ADMIN_NOMOR, 'Admin', '');
        expect(client.sendMessage).not.toHaveBeenCalled();
    });

    test('menandai state.handoverUsers & reset handoverWarned', async () => {
        state.handoverWarned['628222222222'] = true;
        await handlers.handleHandover('628222222222', 'Budi', '');
        expect(state.handoverUsers['628222222222']).toBe(true);
        expect(state.handoverWarned['628222222222']).toBe(false);
    });

    test('kegagalan kirim notifikasi tidak melempar exception ke pemanggil', async () => {
        client.sendMessage.mockRejectedValue(new Error('WA down'));
        await expect(handlers.handleHandover('628222222222', 'Budi', '')).resolves.toMatch(/admin segera menghubungi/i);
    });
});

describe('handleAI', () => {
    beforeEach(() => {
        Groq.__create.mockClear();
        Groq.__create.mockResolvedValue({
            choices: [{ message: { content: 'balasan AI' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
    });

    test('menambah history user & assistant, mengembalikan reply dari Groq', async () => {
        const msg = createFakeMessage();
        const reply = await handlers.handleAI('userZ', 'halo kak', msg);

        expect(reply).toBe('balasan AI');
        const history = state.chatHistory['userZ'];
        expect(history[history.length - 2]).toEqual({ role: 'user', content: 'halo kak' });
        expect(history[history.length - 1]).toEqual({ role: 'assistant', content: 'balasan AI' });
    });

    test('error saat sendStateTyping/clearState tidak menggagalkan reply', async () => {
        const msg = createFakeMessage();
        msg.getChat.mockResolvedValue({
            sendStateTyping: jest.fn().mockRejectedValue(new Error('boom')),
            clearState: jest.fn().mockRejectedValue(new Error('boom')),
        });
        await expect(handlers.handleAI('userZ2', 'test', msg)).resolves.toBe('balasan AI');
    });
});

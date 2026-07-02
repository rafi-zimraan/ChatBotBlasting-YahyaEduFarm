const state = require('../../src/js/state');
const config = require('../../src/js/config');
const client = require('../fakes/fakeClient');
const Groq = require('groq-sdk');
const { createFakeMessage } = require('../fakes/fakeMessage');
const { processMessage } = require('../../src/js/bot');

let userCounter = 0;
const nextUser = () => `62890000${String(userCounter++).padStart(4, '0')}`;

const realDateNow = Date.now;
const setBusinessHours = (isBusiness) => {
    // 09:00 WITA (01:00 UTC) kalau isBusiness true, 02:00 WITA (18:00 UTC hari sebelumnya) kalau false
    Date.now = () => (isBusiness ? Date.UTC(2026, 5, 15, 1, 0, 0) : Date.UTC(2026, 5, 15, 18, 0, 0));
};

beforeEach(() => {
    state.blockedContacts = [];
    state.handoverUsers = {};
    state.handoverWarned = {};
    state.chatHistory = {};
    state.userCooldown = {};
    state.userMessageCount = {};
    state.outOfHoursNotified = {};
    state.newUsers = [];
    state.botAktif = true;
    state.botMenu = true;
    state.handleHotLeadAktif = false;
    state.batasiPesanPerHari = true;
    client.sendMessage.mockClear().mockResolvedValue({});
    Groq.__create.mockClear().mockResolvedValue({
        choices: [{ message: { content: 'balasan AI default' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    setBusinessHours(true);
});

afterEach(() => {
    Date.now = realDateNow;
});

describe('blocked contact', () => {
    test('kontak diblokir tidak mendapat balasan sama sekali', async () => {
        const id = nextUser();
        state.blockedContacts = [{ id }];
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Blocked User', 'halo');
        expect(msg.reply).not.toHaveBeenCalled();
    });
});

describe('handover silence', () => {
    test('user dalam handover: balasan tunggu HANYA sekali, lalu diam total', async () => {
        const id = nextUser();
        state.handoverUsers[id] = true;
        state.handoverWarned[id] = false;

        const msg1 = createFakeMessage({ from: id });
        await processMessage(msg1, id, 'Budi', 'halo admin masih di sana?');
        expect(msg1.reply).toHaveBeenCalledTimes(1);
        expect(msg1.reply).toHaveBeenCalledWith(expect.stringContaining('admin segera menghubungi'));
        expect(state.handoverWarned[id]).toBe(true);

        const msg2 = createFakeMessage({ from: id });
        await processMessage(msg2, id, 'Budi', 'halo ada yang bisa bantu?');
        expect(msg2.reply).not.toHaveBeenCalled();
    });
});

describe('trigger handover konsisten — jam kerja maupun luar jam kerja', () => {
    test.each([
        ['di dalam jam kerja', true],
        ['di luar jam kerja', false],
    ])('ketik "8" memicu handover (%s)', async (_label, isBusiness) => {
        setBusinessHours(isBusiness);
        const id = nextUser();
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', '8');

        expect(state.handoverUsers[id]).toBe(true);
        expect(client.sendMessage).toHaveBeenCalledWith(config.ADMIN_ID, expect.stringContaining('Customer minta CS'));
    });

    test.each([
        ['di dalam jam kerja', true],
        ['di luar jam kerja', false],
    ])('ketik "mau bicara admin" (bahasa natural) memicu handover (%s) — regresi gap konsistensi', async (_label, isBusiness) => {
        setBusinessHours(isBusiness);
        const id = nextUser();
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', 'mau bicara admin');

        expect(state.handoverUsers[id]).toBe(true);
        expect(client.sendMessage).toHaveBeenCalledWith(config.ADMIN_ID, expect.stringContaining('Customer minta CS'));
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('admin segera menghubungi'));
    });

    test('teks biasa yang tidak match frasa admin TIDAK memicu handover', async () => {
        const id = nextUser();
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', 'harga bibit berapa ya');

        expect(state.handoverUsers[id]).toBeUndefined();
    });
});

describe('urutan gate pipeline', () => {
    test('FAQ match menang atas hot lead & AI — Groq tidak pernah dipanggil', async () => {
        const id = nextUser();
        state.handleHotLeadAktif = true;
        state.customFAQ = [
            { id: 999, keyword: 'zzztestkeyword', answer: 'Jawaban FAQ khusus test', enabled: true },
        ];
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', 'saya mau daftar, ini zzztestkeyword ya');

        expect(msg.reply).toHaveBeenCalledWith('Jawaban FAQ khusus test');
        expect(Groq.__create).not.toHaveBeenCalled();
    });

    test('limit harian tercapai memblokir AI — Groq tidak dipanggil', async () => {
        const id = nextUser();
        const today = new Date().toISOString().slice(0, 10);
        state.userMessageCount[id] = { count: config.MAX_PESAN_PER_HARI, date: today };
        state.customFAQ = []; // pastikan tidak ke-short-circuit oleh FAQ

        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', 'pertanyaan bebas yang tidak match apapun');

        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Batas percakapan harian'));
        expect(Groq.__create).not.toHaveBeenCalled();
    });

    test('teks di bawah limit & tanpa FAQ match jatuh ke AI (Groq dipanggil)', async () => {
        const id = nextUser();
        state.customFAQ = [];
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', 'pertanyaan unik yang tidak ada di FAQ manapun sungguhan');

        expect(Groq.__create).toHaveBeenCalledTimes(1);
        expect(msg.reply).toHaveBeenCalledWith('balasan AI default');
    });
});

describe('media & length guard', () => {
    test('image tanpa caption ditolak sebelum sampai AI', async () => {
        const id = nextUser();
        const msg = createFakeMessage({ from: id, type: 'image', body: '' });
        await processMessage(msg, id, 'Budi', '');

        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('belum bisa lihat gambar'));
        expect(Groq.__create).not.toHaveBeenCalled();
    });

    test('teks lebih panjang dari MAX_CHARS_INPUT ditolak', async () => {
        const id = nextUser();
        const longText = 'a'.repeat(config.MAX_CHARS_INPUT + 1);
        const msg = createFakeMessage({ from: id });
        await processMessage(msg, id, 'Budi', longText);

        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('terlalu panjang'));
        expect(Groq.__create).not.toHaveBeenCalled();
    });
});

describe('out-of-hours notification', () => {
    test('notifikasi luar jam kerja hanya dikirim sekali per hari per user', async () => {
        setBusinessHours(false);
        const id = nextUser();

        const msg1 = createFakeMessage({ from: id });
        await processMessage(msg1, id, 'Budi', 'halo ada orang?');
        expect(msg1.reply).toHaveBeenCalledWith(expect.stringContaining('luar jam layanan'));

        const msg2 = createFakeMessage({ from: id });
        await processMessage(msg2, id, 'Budi', 'halo lagi nih');
        expect(msg2.reply).not.toHaveBeenCalled();
    });
});

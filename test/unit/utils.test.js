const utils = require('../../src/js/utils');
const state = require('../../src/js/state');
const config = require('../../src/js/config');

describe('utils.isSpam', () => {
    beforeEach(() => {
        Object.keys(state.userCooldown).forEach((k) => delete state.userCooldown[k]);
    });

    test('user pertama kali tidak dianggap spam', () => {
        expect(utils.isSpam('user1')).toBe(false);
    });

    test('pesan kedua dalam 3 detik dianggap spam', () => {
        utils.isSpam('user1');
        expect(utils.isSpam('user1')).toBe(true);
    });

    test('user berbeda tidak saling mempengaruhi cooldown', () => {
        utils.isSpam('user1');
        expect(utils.isSpam('user2')).toBe(false);
    });

    test('setelah cooldown lewat, tidak dianggap spam lagi', () => {
        const realNow = Date.now;
        let t = 1000000;
        Date.now = () => t;
        utils.isSpam('user1');
        t += 3001;
        expect(utils.isSpam('user1')).toBe(false);
        Date.now = realNow;
    });
});

describe('utils.cekLimitHarian', () => {
    beforeEach(() => {
        Object.keys(state.userMessageCount).forEach((k) => delete state.userMessageCount[k]);
    });

    test('di bawah limit mengembalikan false', () => {
        expect(utils.cekLimitHarian('userA')).toBe(false);
    });

    test('mengizinkan tepat MAX_PESAN_PER_HARI pesan, baru memblokir pesan ke-(MAX+1)', () => {
        for (let i = 0; i < config.MAX_PESAN_PER_HARI; i++) {
            expect(utils.cekLimitHarian('userB')).toBe(false);
        }
        expect(utils.cekLimitHarian('userB')).toBe(true);
    });

    test('reset di hari berikutnya', () => {
        state.userMessageCount['userC'] = { count: 999, date: '2020-01-01' };
        expect(utils.cekLimitHarian('userC')).toBe(false);
        expect(state.userMessageCount['userC'].count).toBe(1);
    });
});

describe('utils.addHistory / getHistory', () => {
    beforeEach(() => {
        Object.keys(state.chatHistory).forEach((k) => delete state.chatHistory[k]);
    });

    test('history kosong di awal', () => {
        expect(utils.getHistory('userX')).toEqual([]);
    });

    test('menyimpan role & content secara urut', () => {
        utils.addHistory('userX', 'user', 'halo');
        utils.addHistory('userX', 'assistant', 'hai juga');
        expect(utils.getHistory('userX')).toEqual([
            { role: 'user', content: 'halo' },
            { role: 'assistant', content: 'hai juga' },
        ]);
    });

    test('MAX_HISTORY dihormati — item lama terbuang', () => {
        for (let i = 0; i < config.MAX_HISTORY + 3; i++) {
            utils.addHistory('userY', 'user', `pesan-${i}`);
        }
        const hist = utils.getHistory('userY');
        expect(hist.length).toBe(config.MAX_HISTORY);
        expect(hist[hist.length - 1].content).toBe(`pesan-${config.MAX_HISTORY + 2}`);
    });
});

describe('utils.normalize', () => {
    test('lowercase teks', () => {
        expect(utils.normalize('HaLo Admin')).toBe('halo admin');
    });
});

describe('utils.isAdminRequest', () => {
    test.each([
        ['admin', true],
        ['Admin', true],
        ['CS', true],
        ['cs', true],
        ['hubungi admin', true],
        ['mau bicara admin', true],
        ['ingin hubungi admin', true],
        ['harga bibit', false],
        ['halo', false],
        ['', false],
        [undefined, false],
    ])('isAdminRequest(%j) -> %s', (input, expected) => {
        expect(utils.isAdminRequest(input)).toBe(expected);
    });
});

describe('utils.isBusinessHours', () => {
    const realNow = Date.now;
    afterEach(() => { Date.now = realNow; });

    test('jam 09:00 WITA (01:00 UTC) dianggap jam kerja', () => {
        Date.now = () => Date.UTC(2026, 5, 15, 1, 0, 0); // 01:00 UTC -> 09:00 WITA
        expect(utils.isBusinessHours()).toBe(true);
    });

    test('tepat jam 08:00 WITA (batas bawah, inclusive)', () => {
        Date.now = () => Date.UTC(2026, 5, 15, 0, 0, 0); // 00:00 UTC -> 08:00 WITA
        expect(utils.isBusinessHours()).toBe(true);
    });

    test('tepat jam 17:00 WITA (batas atas, exclusive)', () => {
        Date.now = () => Date.UTC(2026, 5, 15, 9, 0, 0); // 09:00 UTC -> 17:00 WITA
        expect(utils.isBusinessHours()).toBe(false);
    });

    test('jam 02:00 WITA dianggap luar jam kerja', () => {
        Date.now = () => Date.UTC(2026, 5, 15, 18, 0, 0); // 18:00 UTC -> 02:00 WITA (hari berikutnya)
        expect(utils.isBusinessHours()).toBe(false);
    });
});

describe('utils.cleanMention & isMentioned', () => {
    test('cleanMention membuang mention id dan trim', () => {
        expect(utils.cleanMention('@6281234567890 halo kak')).toBe('halo kak');
    });

    test('isMentioned false kalau botOwnId belum diset', () => {
        state.botOwnId = null;
        expect(utils.isMentioned({ mentionedIds: ['x'] })).toBe(false);
    });

    test('isMentioned true kalau botOwnId ada di mentionedIds', () => {
        state.botOwnId = '628999@c.us';
        expect(utils.isMentioned({ mentionedIds: ['628999@c.us'] })).toBe(true);
        state.botOwnId = null;
    });
});

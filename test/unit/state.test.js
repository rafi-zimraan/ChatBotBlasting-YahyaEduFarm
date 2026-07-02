// PENTING: setiap describe block yang butuh kontrol atas storage.load() (mis. mergeDefaultFAQ)
// harus jest.resetModules() lalu require('../fakes/fakeStorage') ULANG SETELAH reset —
// referensi lama jadi stale begitu registry di-reset karena state.js akan meng-instansiasi
// modul './storage' yang baru.

describe('state.recordMsg & buildConvList (storage.load() -> null, pakai default)', () => {
    let state;
    beforeAll(() => {
        jest.resetModules();
        const fakeStorage = require('../fakes/fakeStorage');
        fakeStorage.load.mockReturnValue(null);
        state = require('../../src/js/state');
    });

    beforeEach(() => {
        state.conversations = {};
        state.io = null;
    });

    test('kontak baru otomatis dibuat saat pertama kali recordMsg', () => {
        state.recordMsg('user1', 'Budi', 'halo kak');
        expect(state.conversations['user1']).toBeDefined();
        expect(state.conversations['user1'].name).toBe('Budi');
        expect(state.conversations['user1'].messages).toHaveLength(1);
    });

    test('unread bertambah hanya untuk pesan dari user, bukan dari bot', () => {
        state.recordMsg('user2', 'Sari', 'pesan 1');
        state.recordMsg('user2', 'Sari', 'balasan bot', true);
        expect(state.conversations['user2'].unread).toBe(1);
    });

    test('nama tidak berubah kalau pesan berasal dari bot', () => {
        state.recordMsg('user3', 'Nama Asli', 'halo');
        state.recordMsg('user3', 'Nama Salah Dari Bot', 'balasan', true);
        expect(state.conversations['user3'].name).toBe('Nama Asli');
    });

    test('messages dipotong maksimal 150 per kontak', () => {
        for (let i = 0; i < 155; i++) {
            state.recordMsg('user4', 'Budi', `pesan ke-${i}`);
        }
        expect(state.conversations['user4'].messages).toHaveLength(150);
        expect(state.conversations['user4'].messages[0].content).toBe('pesan ke-5'); // 5 pertama terbuang
    });

    test('buildConvList mengembalikan bentuk ringkas terurut dari yang terbaru', () => {
        state.recordMsg('userA', 'A', 'pesan A');
        state.recordMsg('userB', 'B', 'pesan B');
        const list = state.buildConvList();
        expect(list.map((c) => c.id)).toEqual(expect.arrayContaining(['userA', 'userB']));
        expect(list[0]).toHaveProperty('lastMsg');
        expect(list[0]).not.toHaveProperty('messages');
    });
});

describe('state.saveData (truncation)', () => {
    let state, fakeStorage;
    beforeAll(() => {
        jest.resetModules();
        fakeStorage = require('../fakes/fakeStorage');
        fakeStorage.load.mockReturnValue(null);
        fakeStorage.save.mockClear();
        state = require('../../src/js/state');
    });

    test('memotong ke maksimal 300 kontak & 50 pesan per kontak sebelum disimpan', () => {
        state.conversations = {};
        for (let i = 0; i < 305; i++) {
            state.recordMsg(`user${i}`, `User ${i}`, `pesan ${i}`);
        }
        for (let i = 0; i < 60; i++) {
            state.recordMsg('user0', 'User 0', `pesan tambahan ${i}`);
        }

        state.saveData();

        expect(fakeStorage.save).toHaveBeenCalledTimes(1);
        const savedArg = fakeStorage.save.mock.calls[0][0];
        const convKeys = Object.keys(savedArg.conversations);
        expect(convKeys.length).toBeLessThanOrEqual(300);
        const anyConvo = Object.values(savedArg.conversations)[0];
        expect(anyConvo.messages.length).toBeLessThanOrEqual(50);
    });
});

describe('mergeDefaultFAQ (dijalankan implisit saat module load)', () => {
    let state;
    beforeAll(() => {
        jest.resetModules();
        const fakeStorage = require('../fakes/fakeStorage');
        fakeStorage.load.mockReturnValue({
            customFAQ: [{ id: 1, keyword: 'halo', answer: 'JAWABAN LAMA TERSIMPAN', enabled: true }],
        });
        state = require('../../src/js/state');
    });

    test('keyword yang sudah tersimpan TIDAK diduplikasi & jawabannya tetap yang lama', () => {
        const haloItems = state.customFAQ.filter((f) => f.keyword === 'halo');
        expect(haloItems).toHaveLength(1);
        expect(haloItems[0].answer).toBe('JAWABAN LAMA TERSIMPAN');
    });

    test('keyword default baru yang belum tersimpan ikut ditambahkan otomatis', () => {
        expect(state.customFAQ.some((f) => f.keyword === 'harga bibit')).toBe(true);
    });
});

const scheduler = require('../../src/js/scheduler');
const state = require('../../src/js/state');
const client = require('../fakes/fakeClient');

const makeChat = () => ({ sendMessage: jest.fn().mockResolvedValue({}) });

beforeEach(() => {
    scheduler.stopScheduler();
    state.scheduledBlasts = [];
    state.blastHistory = [];
    state.groupsCache = [];
    state.analytics = {};
    state.personalCampaigns = [];
    state.io = null;

    client.sendMessage.mockReset().mockResolvedValue({});
    client.getChats.mockReset().mockResolvedValue([
        { isGroup: true, id: { _serialized: 'g1@g.us' }, name: 'Grup 1', participants: [1, 2, 3] },
        { isGroup: true, id: { _serialized: 'g2@g.us' }, name: 'Grup 2', participants: [1, 2] },
    ]);
    client.getChatById.mockReset().mockImplementation(() => Promise.resolve(makeChat()));
});

afterEach(() => {
    scheduler.stopScheduler();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('executeBlast', () => {
    test('mengirim ke semua grup di groupsCache ketika targetGroupIds kosong', async () => {
        jest.useFakeTimers();
        const promise = scheduler.executeBlast('halo semua');
        await jest.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ sukses: 2, gagal: 0, total: 2 });
        expect(client.getChatById).toHaveBeenCalledTimes(2);
    });

    test('filter targetGroupIds hanya mengirim ke grup yang dipilih', async () => {
        jest.useFakeTimers();
        const promise = scheduler.executeBlast('halo', ['g1@g.us']);
        await jest.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ sukses: 1, gagal: 0, total: 1 });
        expect(client.getChatById).toHaveBeenCalledWith('g1@g.us');
    });

    test('sebagian grup gagal terhitung di "gagal", tidak menghentikan proses', async () => {
        jest.useFakeTimers();
        client.getChatById
            .mockImplementationOnce(() => Promise.reject(new Error('network error')))
            .mockImplementationOnce(() => Promise.resolve(makeChat()));
        const promise = scheduler.executeBlast('halo');
        await jest.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ sukses: 1, gagal: 1, total: 2 });
    });

    test('menambah 1 entri blastHistory setelah selesai', async () => {
        jest.useFakeTimers();
        const promise = scheduler.executeBlast('pesan test');
        await jest.runAllTimersAsync();
        await promise;
        expect(state.blastHistory.length).toBe(1);
        expect(state.blastHistory[0].sukses).toBe(2);
    });

    test('retry: error retryable (detached Frame) dicoba ulang sampai berhasil', async () => {
        jest.useFakeTimers();
        client.getChatById
            .mockImplementationOnce(() => Promise.reject(new Error('detached Frame detected')))
            .mockImplementationOnce(() => Promise.resolve(makeChat()));
        const promise = scheduler.executeBlast('halo', ['g1@g.us']);
        await jest.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ sukses: 1, gagal: 0, total: 1 });
        expect(client.getChatById).toHaveBeenCalledTimes(2);
    });

    test('retry: error non-retryable langsung dilempar tanpa retry', async () => {
        jest.useFakeTimers();
        client.getChatById.mockImplementation(() => Promise.reject(new Error('random failure')));
        const promise = scheduler.executeBlast('halo', ['g1@g.us']);
        await jest.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual({ sukses: 0, gagal: 1, total: 1 });
        expect(client.getChatById).toHaveBeenCalledTimes(1);
    });
});

describe('scheduleMatchesTime (predikat murni day-of-week)', () => {
    test('jadwal khusus Jumat cocok di hari Jumat', () => {
        const jadwal = { time: '03:00', days: ['jum'], enabled: true };
        expect(scheduler.scheduleMatchesTime(jadwal, '03:00', 'jum')).toBe(true);
    });

    test('jadwal khusus Jumat TIDAK cocok di hari Kamis', () => {
        const jadwal = { time: '03:00', days: ['jum'], enabled: true };
        expect(scheduler.scheduleMatchesTime(jadwal, '03:00', 'kam')).toBe(false);
    });

    test('days kosong ([]) cocok di hari apapun (setiap hari)', () => {
        const jadwal = { time: '08:00', days: [], enabled: true };
        expect(scheduler.scheduleMatchesTime(jadwal, '08:00', 'sen')).toBe(true);
        expect(scheduler.scheduleMatchesTime(jadwal, '08:00', 'min')).toBe(true);
    });

    test('jadwal legacy tanpa field days sama sekali tetap cocok setiap hari (backward compatible)', () => {
        const jadwalLegacy = { time: '08:00', enabled: true }; // tidak ada `days` sama sekali
        expect(scheduler.scheduleMatchesTime(jadwalLegacy, '08:00', 'rab')).toBe(true);
    });

    test('beberapa hari sekaligus (jum,sab) cocok untuk masing-masing hari itu', () => {
        const jadwal = { time: '04:00', days: ['jum', 'sab'], enabled: true };
        expect(scheduler.scheduleMatchesTime(jadwal, '04:00', 'jum')).toBe(true);
        expect(scheduler.scheduleMatchesTime(jadwal, '04:00', 'sab')).toBe(true);
        expect(scheduler.scheduleMatchesTime(jadwal, '04:00', 'min')).toBe(false);
    });

    test('jam tidak cocok -> false meski hari cocok', () => {
        const jadwal = { time: '03:00', days: ['jum'], enabled: true };
        expect(scheduler.scheduleMatchesTime(jadwal, '04:00', 'jum')).toBe(false);
    });

    test('enabled:false -> selalu false', () => {
        const jadwal = { time: '08:00', days: [], enabled: false };
        expect(scheduler.scheduleMatchesTime(jadwal, '08:00', 'sen')).toBe(false);
    });
});

describe('DAY_CODE_BY_INDEX', () => {
    test('index sesuai Date#getDay() (0=Minggu .. 6=Sabtu)', () => {
        expect(scheduler.DAY_CODE_BY_INDEX).toEqual(['min', 'sen', 'sel', 'rab', 'kam', 'jum', 'sab']);
    });
});

describe('startScheduler / stopScheduler (integrasi end-to-end dengan fake timer)', () => {
    test('jadwal cocok terpicu lewat interval nyata dan tidak dobel dalam menit yang sama', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-07-03T08:00:00')); // 2026-07-03 = Jumat
        jest.spyOn(Math, 'random').mockReturnValue(0); // delay antar grup jadi minimal & deterministik
        client.getChats.mockResolvedValue([
            { isGroup: true, id: { _serialized: 'g1@g.us' }, name: 'Grup 1', participants: [1] },
        ]);
        state.scheduledBlasts = [{ id: 1, time: '08:00', days: ['jum'], message: 'subuh', enabled: true }];

        scheduler.startScheduler();
        await jest.advanceTimersByTimeAsync(30000 + 5000); // 1 tick interval + delay internal blast
        expect(state.blastHistory.length).toBe(1);

        // Tick berikutnya masih di menit yang sama -> guard _lastFired mencegah kirim dobel
        await jest.advanceTimersByTimeAsync(30000);
        expect(state.blastHistory.length).toBe(1);
    });

    test('startScheduler dipanggil dua kali tidak membuat interval kedua', () => {
        scheduler.startScheduler();
        const firstId = state.blastSchedulerId;
        scheduler.startScheduler();
        expect(state.blastSchedulerId).toBe(firstId);
    });

    test('scheduledBlasts kosong -> tidak ada blast dieksekusi', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-07-03T08:00:00'));
        state.scheduledBlasts = [];
        scheduler.startScheduler();
        await jest.advanceTimersByTimeAsync(30000);
        expect(state.blastHistory.length).toBe(0);
    });
});

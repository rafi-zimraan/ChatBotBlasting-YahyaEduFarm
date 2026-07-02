const state = require('../../src/js/state');
const client = require('../fakes/fakeClient');
const scheduler = require('../../src/js/scheduler');
require('../../src/js/commands'); // registers client.on('message_create', ...)

const getHandler = () => {
    const call = client.on.mock.calls.find(([event]) => event === 'message_create');
    return call[1];
};

const handler = getHandler();

const makeCmdMessage = (body) => ({
    fromMe: true,
    body,
    reply: jest.fn().mockResolvedValue({}),
});

beforeEach(() => {
    state.scheduledBlasts = [];
    state.handoverUsers = {};
    state.handoverWarned = {};
    state.io = null;
    scheduler.stopScheduler();
});

afterEach(() => {
    scheduler.stopScheduler();
});

describe('!blastjadwal — kasus valid', () => {
    test('tanpa kode hari -> days kosong, berarti setiap hari', async () => {
        const msg = makeCmdMessage('!blastjadwal 08:00 | Selamat pagi!');
        await handler(msg);

        expect(state.scheduledBlasts).toHaveLength(1);
        expect(state.scheduledBlasts[0]).toMatchObject({ time: '08:00', days: [], message: 'Selamat pagi!', enabled: true });
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('setiap hari'));
    });

    test('dengan satu kode hari (jum)', async () => {
        const msg = makeCmdMessage('!blastjadwal jum 03:00 | Subuh Jumat!');
        await handler(msg);

        expect(state.scheduledBlasts[0]).toMatchObject({ time: '03:00', days: ['jum'], message: 'Subuh Jumat!' });
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Jumat'));
    });

    test('dengan beberapa kode hari dipisah koma (jum,sab)', async () => {
        const msg = makeCmdMessage('!blastjadwal jum,sab 04:00 | pesan gabungan');
        await handler(msg);

        expect(state.scheduledBlasts[0].days).toEqual(['jum', 'sab']);
    });
});

describe('!blastjadwal — kasus invalid', () => {
    test('tanpa separator | -> pesan format bantuan, tidak menambah entri', async () => {
        const msg = makeCmdMessage('!blastjadwal 08:00 Selamat pagi');
        await handler(msg);

        expect(state.scheduledBlasts).toHaveLength(0);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Format:'));
    });

    test('kode hari tidak dikenal -> ditolak, tidak menambah entri', async () => {
        const msg = makeCmdMessage('!blastjadwal xxx 03:00 | pesan');
        await handler(msg);

        expect(state.scheduledBlasts).toHaveLength(0);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Kode hari tidak dikenal'));
    });

    test('format waktu salah -> ditolak, tidak menambah entri', async () => {
        const msg = makeCmdMessage('!blastjadwal 25:99 | pesan');
        await handler(msg);

        expect(state.scheduledBlasts).toHaveLength(0);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Format waktu salah'));
    });

    test('format waktu salah dengan kode hari di depan -> tetap ditolak', async () => {
        const msg = makeCmdMessage('!blastjadwal jum 8:00 | pesan');
        await handler(msg);

        expect(state.scheduledBlasts).toHaveLength(0);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Format waktu salah'));
    });

    test('pesan kosong setelah | -> ditolak', async () => {
        const msg = makeCmdMessage('!blastjadwal 08:00 |   ');
        await handler(msg);

        expect(state.scheduledBlasts).toHaveLength(0);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Pesan tidak boleh kosong'));
    });
});

describe('!blastjadwal — ID tidak collide setelah penghapusan', () => {
    test('ID baru selalu max(existing)+1, bukan length+1', async () => {
        await handler(makeCmdMessage('!blastjadwal 08:00 | pesan1'));
        await handler(makeCmdMessage('!blastjadwal 09:00 | pesan2'));
        expect(state.scheduledBlasts.map((j) => j.id)).toEqual([1, 2]);

        await handler(makeCmdMessage('!blastjadwalhapus 1'));
        expect(state.scheduledBlasts).toHaveLength(1);

        await handler(makeCmdMessage('!blastjadwal 10:00 | pesan3'));
        expect(state.scheduledBlasts.map((j) => j.id)).toEqual([2, 3]); // bukan [2, 2]
    });
});

describe('!blastjadwallist', () => {
    test('menampilkan label hari yang benar', async () => {
        await handler(makeCmdMessage('!blastjadwal jum 03:00 | subuh jumat'));
        await handler(makeCmdMessage('!blastjadwal 08:00 | pagi setiap hari'));

        const msg = makeCmdMessage('!blastjadwallist');
        await handler(msg);

        const reply = msg.reply.mock.calls[0][0];
        expect(reply).toContain('Jum');
        expect(reply).toContain('Setiap hari');
    });

    test('list kosong -> pesan "Belum ada jadwal"', async () => {
        const msg = makeCmdMessage('!blastjadwallist');
        await handler(msg);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Belum ada jadwal'));
    });
});

describe('!blastjadwalhapus', () => {
    test('id tidak ditemukan -> pesan error', async () => {
        const msg = makeCmdMessage('!blastjadwalhapus 999');
        await handler(msg);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('tidak ditemukan'));
    });
});

describe('!selesai (regresi handover, tidak diubah tapi tetap dijaga)', () => {
    test('user tidak dalam handover -> pesan error', async () => {
        const msg = makeCmdMessage('!selesai 628999999999');
        await handler(msg);
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('tidak sedang dalam mode handover'));
    });

    test('user dalam handover -> dilepas dari handoverUsers & handoverWarned', async () => {
        state.handoverUsers['628999999999'] = true;
        state.handoverWarned['628999999999'] = true;
        const msg = makeCmdMessage('!selesai 628999999999');
        await handler(msg);

        expect(state.handoverUsers['628999999999']).toBeUndefined();
        expect(state.handoverWarned['628999999999']).toBeUndefined();
        expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('dilepas dari mode handover'));
    });
});

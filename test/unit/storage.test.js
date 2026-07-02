// Test ini sengaja me-require src/js/storage.js yang ASLI (bukan fake), karena storage.js
// sendiri yang mau diuji. Supaya AMAN (bot bisa jadi sedang live jalan nyata), kita mock
// modul 'fs' penuh — tidak ada satu byte pun yang benar-benar ditulis ke data/data.json asli.
jest.mock('fs');
const fs = require('fs');
const storage = require('../../src/js/storage');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('storage.load', () => {
    test('file belum ada -> null, readFileSync tidak dipanggil', () => {
        fs.existsSync.mockReturnValue(false);
        expect(storage.load()).toBeNull();
        expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    test('file ada & JSON valid -> mengembalikan objek ter-parse', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify({ donors: [{ id: 1 }] }));
        expect(storage.load()).toEqual({ donors: [{ id: 1 }] });
    });

    test('file rusak (JSON invalid) -> tidak melempar, mengembalikan null', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('{ ini bukan json valid ,,,');
        expect(() => storage.load()).not.toThrow();
        expect(storage.load()).toBeNull();
    });
});

describe('storage.save', () => {
    test('direktori belum ada -> dibuat otomatis (recursive) sebelum menulis file', () => {
        fs.existsSync.mockReturnValue(false);
        storage.save({ donors: [] });
        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('direktori sudah ada -> tidak perlu mkdirSync lagi', () => {
        fs.existsSync.mockReturnValue(true);
        storage.save({ donors: [] });
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('data ditulis sebagai JSON rapi (pretty-printed)', () => {
        fs.existsSync.mockReturnValue(true);
        storage.save({ foo: 'bar' });
        const [, content] = fs.writeFileSync.mock.calls[0];
        expect(content).toBe(JSON.stringify({ foo: 'bar' }, null, 2));
    });

    test('kegagalan tulis (writeFileSync throw) tidak melempar ke pemanggil', () => {
        fs.existsSync.mockReturnValue(true);
        fs.writeFileSync.mockImplementation(() => { throw new Error('disk penuh'); });
        expect(() => storage.save({ foo: 'bar' })).not.toThrow();
    });
});

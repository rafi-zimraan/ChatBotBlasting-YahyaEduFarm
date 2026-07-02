// Pengganti src/js/storage.js selama test — tidak pernah menyentuh data/data.json asli.
const load = jest.fn(() => null);
const save = jest.fn();

module.exports = { load, save };

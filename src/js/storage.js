const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/data.json');

const load = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return null;
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('❌ Gagal baca data.json:', err.message);
        return null;
    }
};

const save = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('❌ Gagal simpan data.json:', err.message);
    }
};

module.exports = { load, save };

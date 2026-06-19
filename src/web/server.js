const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const client = require('../js/client');
const state = require('../js/state');
const scheduler = require('../js/scheduler');
const config = require('../js/config');

const app = express();
const server = http.createServer(app);

const webPort = config.WEB_PORT || 3000;

// =====================
// SESSION / AUTH TOKENS
// =====================
const validTokens = new Map();
const AUTH_EMAIL = 'owner@gmail.com';
const AUTH_PASSWORD = 'owner123';

const requireAuth = (req, res, next) => {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (token && validTokens.has(token)) {
        req.user = validTokens.get(token);
        return next();
    }
    // Allow login page and public assets
    if (req.path === '/login.html' || req.path.startsWith('/api/')) {
        return next();
    }
    res.redirect('/login.html');
};

// =====================
// HELMET + CORS + PARSER
// =====================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));

// Cookie parser sederhana untuk baca cookie dari header
app.use((req, res, next) => {
    const raw = req.headers.cookie || '';
    req.cookies = {};
    raw.split(';').forEach((pair) => {
        const parts = pair.trim().split('=');
        if (parts.length >= 2) req.cookies[parts[0].trim()] = parts.slice(1).join('=');
    });
    next();
});

// =====================
// AUTH API
// =====================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    if (email === AUTH_EMAIL && password === AUTH_PASSWORD) {
        const token = crypto.randomUUID();
        validTokens.set(token, { email, loginAt: Date.now() });
        // Hapus token lama untuk user yang sama
        for (const [t, u] of validTokens) {
            if (u.email === email && t !== token) validTokens.delete(t);
        }
        res.cookie('token', token, {
            httpOnly: true, sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.json({ ok: true, token });
    }
    res.status(401).json({ ok: false, error: 'Email atau password salah.' });
});

app.post('/api/logout', (req, res) => {
    const token = req.cookies?.token;
    if (token) validTokens.delete(token);
    res.clearCookie('token');
    res.json({ ok: true });
});

app.get('/api/check-auth', (req, res) => {
    const token = req.cookies?.token;
    if (token && validTokens.has(token)) {
        return res.json({ ok: true, user: validTokens.get(token) });
    }
    res.json({ ok: false });
});

// =====================
// EXPORT DONORS (harus sebelum static files biar gak ke-intercept)
// =====================
app.get('/api/donors/export/pdf', async (req, res) => {
    const token = req.cookies?.token;
    if (!token || !validTokens.has(token)) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=donatur_${new Date().toISOString().slice(0, 10)}.pdf`);
        doc.pipe(res);

        doc.fontSize(18).font('Helvetica-Bold').text('Laporan Data Donatur', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`YahyaEduFarm — Generated: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
        doc.moveDown(1.5);

        const headers = ['No', 'Nama', 'Nomor', 'Kategori', 'Nominal', 'Tanggal', 'Catatan'];
        const colW = [25, 130, 120, 100, 100, 90, 150];
        let y = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        let x = 30;
        headers.forEach((h, i) => {
            doc.rect(x, y, colW[i], 18).fill('#2563eb').fillColor('#fff').text(h, x + 3, y + 4, { width: colW[i] - 6 }).fillColor('#000');
            x += colW[i];
        });

        doc.moveDown(0.5);
        const donors = state.donors || [];
        let total = 0;
        doc.fontSize(8).font('Helvetica');
        donors.forEach((d, i) => {
            if (doc.y > 530) { doc.addPage(); y = doc.y; }
            x = 30;
            const row = [
                String(i + 1), d.name || '-',
                d.phone ? d.phone.slice(0, 4) + '****' + d.phone.slice(-3) : '-',
                d.category || '-',
                'Rp' + (d.amount || 0).toLocaleString('id-ID'),
                d.date || '-',
                (d.notes || '').substring(0, 25),
            ];
            const bg = i % 2 === 0 ? '#f8fafc' : '#fff';
            row.forEach((cell, j) => {
                doc.rect(x, doc.y, colW[j], 16).fill(bg).fillColor('#1e293b').text(cell, x + 3, doc.y + 3, { width: colW[j] - 6 }).fillColor('#000');
                x += colW[j];
            });
            doc.moveDown(0.1);
            total += d.amount || 0;
        });

        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica-Bold').text(`Total: Rp${total.toLocaleString('id-ID')}`, { align: 'right' });
        doc.fontSize(9).font('Helvetica').text(`Jumlah Transaksi: ${donors.length}`, { align: 'right' });

        doc.end();
    } catch (err) {
        console.error('❌ Gagal generate PDF:', err.message);
        res.status(500).json({ error: 'Gagal generate PDF' });
    }
});

app.get('/api/donors/export/xlsx', async (req, res) => {
    const token = req.cookies?.token;
    if (!token || !validTokens.has(token)) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Donatur');

        ws.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Nama', key: 'name', width: 25 },
            { header: 'Nomor WA', key: 'phone', width: 20 },
            { header: 'Kategori', key: 'category', width: 18 },
            { header: 'Nominal (Rp)', key: 'amount', width: 18 },
            { header: 'Tanggal', key: 'date', width: 15 },
            { header: 'Catatan', key: 'notes', width: 30 },
        ];

        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 22;

        const donors = state.donors || [];
        let total = 0;
        donors.forEach((d, i) => {
            const row = ws.addRow({
                no: i + 1,
                name: d.name || '-',
                phone: d.phone || '-',
                category: d.category || '-',
                amount: d.amount || 0,
                date: d.date || '-',
                notes: d.notes || '-',
            });
            if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            total += d.amount || 0;
        });

        const totalRow = ws.addRow({ name: 'TOTAL', amount: total, notes: `Jumlah: ${donors.length} transaksi` });
        totalRow.font = { bold: true };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        ws.getColumn('E').numFmt = '#,##0';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=donatur_${new Date().toISOString().slice(0, 10)}.xlsx`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('❌ Gagal generate XLSX:', err.message);
        res.status(500).json({ error: 'Gagal generate Excel' });
    }
});

// =====================
// STATIC FILES + AUTH
// =====================
const publicDir = path.join(__dirname, 'public');

// Auth middleware: cek token cookie untuk setiap request non-public
const publicExts = ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2'];
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/login.html') return next();

    const ext = path.extname(req.path).toLowerCase();
    if (publicExts.includes(ext)) return next();

    const token = req.cookies?.token;
    if (token && validTokens.has(token)) return next();

    res.redirect('/login.html');
});

app.use(express.static(publicDir));

// Serve FAQ media
app.use('/faq-media', express.static(path.resolve(__dirname, '..', '..', 'data', 'faq-media')));

// =====================
// SOCKET.IO
// =====================
state.io = new Server(server, {
    cors: { origin: `http://localhost:${webPort}`, methods: ['GET', 'POST'] },
});

state.io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token && validTokens.has(token)) {
        socket.user = validTokens.get(token);
        return next();
    }
    next(new Error('Unauthorized: silakan login'));
});

const sendFullState = (socket) => {
    const safeDonors = (state.donors || []).map((d) => ({
        id: d.id, name: d.name,
        amount: d.amount, date: d.date,
        year: d.year, category: d.category,
        notes: d.notes,
        phone: d.phone ? d.phone.slice(0, 4) + '****' + d.phone.slice(-3) : '',
    }));
    socket.emit('state', {
        user: socket.user || { email: 'owner@gmail.com' },
        botAktif: state.botAktif,
        botMenu: state.botMenu,
        groupsCount: state.groupsCache.length,
        schedulesCount: state.scheduledBlasts.filter((j) => j.enabled).length,
        groups: state.groupsCache,
        schedules: state.scheduledBlasts,
        blastHistory: state.blastHistory.slice(0, 20),
        faqs: state.customFAQ,
        faqsBlasting: state.customFAQBlasting,
        analytics: state.analytics,
        donors: safeDonors,
        newUsers: state.newUsers,
    });
};

state.io.on('connection', (socket) => {
    console.log(`🌐 Web UI terhubung: ${socket.id}`);
    sendFullState(socket);

    socket.on('request-state', () => sendFullState(socket));
    socket.on('request-schedules', () => {
        socket.emit('schedules-update', state.scheduledBlasts);
    });

    socket.on('toggle-bot', (value) => {
        state.botAktif = value;
        console.log(`🌐 Bot ${value ? 'diaktifkan' : 'dimatikan'} dari Web UI`);
        state.io.emit('status-update', { botAktif: state.botAktif, botMenu: state.botMenu });
    });

    socket.on('refresh-groups', async () => {
        await scheduler.refreshGroups();
        state.io.emit('groups-update', state.groupsCache);
        state.io.emit('status-update', { groupsCount: state.groupsCache.length });
    });

    socket.on('execute-blast', async (data) => {
        const { message, targetGroups, media } = data;
        console.log(`🌐 Blast dari Web UI ke ${targetGroups?.length || 'semua'} grup${media ? ' (dengan media)' : ''}`);
        socket.emit('blast-sent');
        await scheduler.executeBlast(message, targetGroups, media || null);
    });

    socket.on('remove-schedule', (id) => {
        const idx = state.scheduledBlasts.findIndex((j) => j.id === id);
        if (idx !== -1) {
            state.scheduledBlasts.splice(idx, 1);
            state.io.emit('schedules-update', state.scheduledBlasts);
            state.io.emit('status-update', {
                schedulesCount: state.scheduledBlasts.filter((j) => j.enabled).length,
            });
            state.saveData();
        }
    });

    socket.on('toggle-schedule', (data) => {
        const jadwal = state.scheduledBlasts.find((j) => j.id === data.id);
        if (jadwal) {
            jadwal.enabled = data.enabled;
            state.io.emit('schedules-update', state.scheduledBlasts);
            state.io.emit('status-update', {
                schedulesCount: state.scheduledBlasts.filter((j) => j.enabled).length,
            });
            state.saveData();
        }
    });

    socket.on('add-faq-blast', (data) => {
        const { keyword, answer } = data;
        if (!keyword || !answer) return;
        const newId = state.customFAQBlasting.length > 0
            ? Math.max(...state.customFAQBlasting.map((f) => f.id)) + 1
            : 1;
        state.customFAQBlasting.push({ id: newId, keyword, answer, enabled: true });
        state.io.emit('faq-blast-update', state.customFAQBlasting);
        state.saveData();
        console.log(`🌐 FAQ Blast baru: "${keyword}"`);
    });

    socket.on('remove-faq-blast', (id) => {
        const idx = state.customFAQBlasting.findIndex((f) => f.id === id);
        if (idx !== -1) {
            const deleted = state.customFAQBlasting.splice(idx, 1)[0];
            if (deleted.media?.filepath) {
                try {
                    const fullPath = path.resolve(__dirname, '..', '..', deleted.media.filepath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (e) {}
            }
            state.io.emit('faq-blast-update', state.customFAQBlasting);
            state.saveData();
        }
    });

    socket.on('toggle-faq-blast', (data) => {
        const faq = state.customFAQBlasting.find((f) => f.id === data.id);
        if (faq) {
            faq.enabled = data.enabled;
            state.io.emit('faq-blast-update', state.customFAQBlasting);
            state.saveData();
        }
    });

    const simpanMediaSocket = (faq, base64data, filename, mimetype) => {
        try {
            const ext = (mimetype.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '');
            const safeName = `faq_${faq.id}_${Date.now()}.${ext}`;
            const mediaDir = path.resolve(__dirname, '..', '..', 'data', 'faq-media');
            if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
            const filepath = path.join(mediaDir, safeName);
            fs.writeFileSync(filepath, base64data, 'base64');
            faq.media = { filepath: `data/faq-media/${safeName}`, mimetype, filename: filename || safeName };
            return true;
        } catch (err) {
            console.error('❌ Gagal simpan media FAQ dari Web UI:', err.message);
            return false;
        }
    };

    socket.on('upload-faq-media', (data) => {
        const { id, base64, filename, mimetype } = data;
        const faq = state.customFAQ.find((f) => f.id === id);
        if (!faq) { socket.emit('faq-media-upload-error', 'FAQ tidak ditemukan'); return; }
        if (simpanMediaSocket(faq, base64, filename, mimetype)) {
            state.io.emit('faq-update', state.customFAQ);
            state.saveData();
            socket.emit('faq-media-upload-ok', { id, filename });
        } else {
            socket.emit('faq-media-upload-error', 'Gagal menyimpan file');
        }
    });

    socket.on('upload-faq-blast-media', (data) => {
        const { id, base64, filename, mimetype } = data;
        const faq = state.customFAQBlasting.find((f) => f.id === id);
        if (!faq) { socket.emit('faq-media-upload-error', 'FAQ tidak ditemukan'); return; }
        if (simpanMediaSocket(faq, base64, filename, mimetype)) {
            state.io.emit('faq-blast-update', state.customFAQBlasting);
            state.saveData();
            socket.emit('faq-media-upload-ok', { id, filename });
        } else {
            socket.emit('faq-media-upload-error', 'Gagal menyimpan file');
        }
    });

    socket.on('remove-faq-media', (id) => {
        const faq = state.customFAQ.find((f) => f.id === id);
        if (!faq || !faq.media) return;
        try {
            const fullPath = path.resolve(__dirname, '..', '..', faq.media.filepath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (e) {}
        delete faq.media;
        state.io.emit('faq-update', state.customFAQ);
        state.saveData();
    });

    socket.on('remove-faq-blast-media', (id) => {
        const faq = state.customFAQBlasting.find((f) => f.id === id);
        if (!faq || !faq.media) return;
        try {
            const fullPath = path.resolve(__dirname, '..', '..', faq.media.filepath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (e) {}
        delete faq.media;
        state.io.emit('faq-blast-update', state.customFAQBlasting);
        state.saveData();
    });

    socket.on('add-faq', (data) => {
        const { keyword, answer } = data;
        if (!keyword || !answer) return;
        const newId = state.customFAQ.length > 0
            ? Math.max(...state.customFAQ.map((f) => f.id)) + 1
            : 1;
        state.customFAQ.push({ id: newId, keyword, answer, enabled: true });
        state.io.emit('faq-update', state.customFAQ);
        state.saveData();
        console.log(`🌐 FAQ baru: "${keyword}"`);
    });

    socket.on('remove-faq', (id) => {
        const idx = state.customFAQ.findIndex((f) => f.id === id);
        if (idx !== -1) {
            const deleted = state.customFAQ.splice(idx, 1)[0];
            if (deleted.media?.filepath) {
                try {
                    const fullPath = path.resolve(__dirname, '..', '..', deleted.media.filepath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (e) {}
            }
            state.io.emit('faq-update', state.customFAQ);
            state.saveData();
        }
    });

    socket.on('toggle-faq', (data) => {
        const faq = state.customFAQ.find((f) => f.id === data.id);
        if (faq) {
            faq.enabled = data.enabled;
            state.io.emit('faq-update', state.customFAQ);
            state.saveData();
        }
    });

    socket.on('add-schedule', (data) => {
        const { time, message } = data;
        const newId = state.scheduledBlasts.length + 1;
        state.scheduledBlasts.push({ id: newId, time, message, enabled: true });
        if (!state.blastSchedulerId) scheduler.startScheduler();
        state.io.emit('schedule-added', { schedules: state.scheduledBlasts });
        state.io.emit('status-update', {
            schedulesCount: state.scheduledBlasts.filter((j) => j.enabled).length,
        });
        state.saveData();
        console.log(`🌐 Jadwal baru: ${time} — "${message.substring(0, 40)}..."`);
    });

    // ---- DONOR EVENTS ----
    socket.on('add-donor', (data) => {
        const { name, phone, amount, date, category, notes } = data;
        if (!name || !amount) return;
        const newId = state.donors.length > 0 ? Math.max(...state.donors.map((d) => d.id)) + 1 : 1;
        const donorDate = date || new Date().toISOString().slice(0, 10);
        const year = parseInt(donorDate.slice(0, 4));
        const donor = { id: newId, name, phone: phone || '', amount: parseInt(amount), date: donorDate, year, category: category || 'donasi', notes: notes || '' };
        state.donors.push(donor);
        state.donors.sort((a, b) => b.date.localeCompare(a.date));
        state.io.emit('donors-update', state.donors);
        state.io.emit('donor-notification', donor);
        state.saveData();
        console.log(`🌐 Donatur baru: ${name} — Rp${amount.toLocaleString('id-ID')}`);
    });

    socket.on('remove-donor', (id) => {
        const idx = state.donors.findIndex((d) => d.id === id);
        if (idx !== -1) {
            state.donors.splice(idx, 1);
            state.io.emit('donors-update', state.donors);
            state.saveData();
        }
    });

    socket.on('disconnect', () => {
        console.log(`🌐 Web UI terputus: ${socket.id}`);
    });
});

server.listen(config.WEB_PORT, () => {
    console.log(`🌐 Jabatangan: http://localhost:${config.WEB_PORT}`);
    console.log(`📌 Buka browser dan akses http://localhost:${config.WEB_PORT}`);
});

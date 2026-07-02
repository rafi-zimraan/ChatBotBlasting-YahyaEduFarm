const path = require('path');
const fs = require('fs');
const client = require('./client');
const state = require('./state');
const config = require('./config');
const utils = require('./utils');
const scheduler = require('./scheduler');
const handlers = require('./handlers');

client.on('message_create', async (message) => {
    if (!message.fromMe) return;

    const args = message.body.split(' ');
    const command = args[0].toLowerCase();

    // ---- KONTROL BOT ----
    if (command === '!on') {
        state.botAktif = true;
        if (state.io) state.io.emit('status-update', { botAktif: state.botAktif });
        return message.reply('✅ Bot diaktifkan!');
    }
    if (command === '!off') {
        state.botAktif = false;
        if (state.io) state.io.emit('status-update', { botAktif: state.botAktif });
        return message.reply('🔴 Bot dimatikan!');
    }
    if (command === '!menu') {
        const sub = (args[1] || '').toLowerCase();
        if (sub === 'on') {
            state.botMenu = true;
            if (state.io) state.io.emit('status-update', { botMenu: state.botMenu });
            return message.reply('✅ Menu diaktifkan!');
        }
        if (sub === 'off') {
            state.botMenu = false;
            if (state.io) state.io.emit('status-update', { botMenu: state.botMenu });
            return message.reply('🔴 Menu dimatikan!');
        }
    }
    if (command === '!status') {
        return message.reply(
            `📊 *Status Bot — Jabatangan*\n\n` +
            `🤖 Bot: ${state.botAktif ? '✅ Aktif' : '🔴 Nonaktif'}\n` +
            `📋 Menu: ${state.botMenu ? '✅ Aktif' : '🔴 Nonaktif'}\n` +
            `🔥 Hot Lead: ${state.handleHotLeadAktif ? '✅ Aktif' : '🔴 Nonaktif'}\n` +
            `👥 Grup terdaftar: ${state.groupsCache.length}\n` +
            `⏰ Jadwal blast: ${state.scheduledBlasts.filter((j) => j.enabled).length} aktif`
        );
    }
    if (command === '!reset') {
        Object.keys(state.chatHistory).forEach((k) => (state.chatHistory[k] = []));
        return message.reply('✅ Semua history chat direset!');
    }
    if (command === '!help') {
        return message.reply(
            '*Jabatangan — Daftar Perintah*\n\n' +
            '*Kontrol Bot:*\n' +
            '!on — Aktifkan bot\n' +
            '!off — Matikan bot\n' +
            '!menu on/off — Aktifkan/nonaktifkan menu\n' +
            '!status — Cek status bot\n' +
            '!reset — Reset semua history chat\n' +
            '!help — Tampilkan bantuan ini\n\n' +
            '*Handover:*\n' +
            '!selesai 628XXX — Lepas user dari mode handover\n' +
            '!limit — Cek pemakaian AI hari ini\n\n' +
            '*FAQ Kustom:*\n' +
            '!faq list — Lihat semua FAQ (DM)\n' +
            '!faq add <kata kunci> | <jawaban> — Tambah FAQ DM (bisa lampirkan gambar/video)\n' +
            '!faq media <id> — Lampirkan gambar/video ke FAQ\n' +
            '!faq mediahapus <id> — Hapus media dari FAQ\n' +
            '!faq hapus <id> — Hapus FAQ DM\n\n' +
            '*FAQ Grup (Blasting):*\n' +
            '!faqblast list — Lihat FAQ grup\n' +
            '!faqblast add <kata kunci> | <jawaban> — Tambah FAQ grup (bisa lampirkan gambar/video)\n' +
            '!faqblast media <id> — Lampirkan gambar/video ke FAQ\n' +
            '!faqblast mediahapus <id> — Hapus media dari FAQ\n' +
            '!faqblast hapus <id> — Hapus FAQ grup\n\n' +
            '*Donatur:*\n' +
            '!donor list — Lihat daftar donatur\n' +
            '!donor add <nama> | <no WA> | <nominal> | <tgl> | <kategori> | <catatan> — Tambah\n' +
            '!donor hapus <id> — Hapus donatur\n' +
            '!donor total — Rekap total dana\n\n' +
            '*Blast & Grup:*\n' +
            '!groups — Lihat daftar grup\n' +
            '!blast <pesan> — Kirim pesan ke SEMUA grup\n' +
            '!blastjadwal [hari] <HH:MM> | <pesan> — Jadwalkan blast\n' +
            '   Tanpa hari = setiap hari. Contoh: !blastjadwal jum 03:00 | pesan\n' +
            '   Beberapa hari: !blastjadwal jum,sab 04:00 | pesan\n' +
            '   Kode hari: sen, sel, rab, kam, jum, sab, min\n' +
            '!blastjadwallist — Lihat jadwal blast\n' +
            '!blastjadwalhapus <id> — Hapus jadwal blast\n' +
            '!blaststop — Hentikan semua jadwal blast'
        );
    }

    // ---- HANDOVER ----
    if (command === '!selesai') {
        const nomorTarget = (args[1] || '').trim();
        if (!nomorTarget) return message.reply('⚠️ Format: !selesai 628XXXXXXXXXX');
        if (state.handoverUsers[nomorTarget]) {
            delete state.handoverUsers[nomorTarget];
            delete state.handoverWarned[nomorTarget];
            return message.reply(`✅ User ${nomorTarget} sudah dilepas dari mode handover.`);
        }
        return message.reply(`⚠️ User ${nomorTarget} tidak sedang dalam mode handover.`);
    }
    if (command === '!limit') {
        const hari = new Date().toISOString().slice(0, 10);
        const aktif = Object.entries(state.userMessageCount)
            .filter(([_, v]) => v.date === hari)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([id, v]) => `${id.replace('@c.us', '').replace('@lid', '')} → ${v.count}/${config.MAX_PESAN_PER_HARI}`)
            .join('\n');

        return message.reply(
            aktif
                ? `📊 *Pemakaian AI hari ini:*\n\n${aktif}`
                : '📊 Belum ada pemakaian AI hari ini.'
        );
    }

    // ---- FAQ KUSTOM ----
    if (command === '!faq') {
        const sub = (args[1] || '').toLowerCase();

        const simpanMediaFAQ = async (faq, msg) => {
            if (!msg.hasMedia) return;
            try {
                const media = await msg.downloadMedia();
                if (!media) return;
                const ext = (media.mimetype.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '');
                const filename = `faq_${faq.id}_${Date.now()}.${ext}`;
                const mediaDir = path.resolve(__dirname, '..', '..', 'data', 'faq-media');
                if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
                const filepath = path.join(mediaDir, filename);
                fs.writeFileSync(filepath, media.data, 'base64');
                faq.media = { filepath: `data/faq-media/${filename}`, mimetype: media.mimetype, filename: media.filename || filename };
                state.saveData();
                return media;
            } catch (err) {
                console.error('❌ Gagal simpan media FAQ:', err.message);
            }
        };

        if (sub === 'list') {
            if (state.customFAQ.length === 0) {
                return message.reply('📭 Belum ada FAQ kustom.\n\nTambah dengan: !faq add <kata kunci> | <jawaban>');
            }
            const list = state.customFAQ
                .map((f) => `${f.id}. [${f.enabled ? '✅' : '🔴'}]${f.media ? ' 🖼️' : ''} *${f.keyword}*\n   ${f.answer.substring(0, 60)}${f.answer.length > 60 ? '...' : ''}`)
                .join('\n\n');
            return message.reply(`📋 *Daftar FAQ Kustom (${state.customFAQ.length}):*\n\n${list}`);
        }

        if (sub === 'add') {
            const rest = args.slice(2).join(' ');
            const sepIdx = rest.indexOf('|');
            if (sepIdx === -1) {
                return message.reply('⚠️ Format: !faq add <kata kunci> | <jawaban>\nContoh: !faq add harga bibit | Harga bibit kami mulai dari Rp2.000\n\n📎 Bisa lampirkan gambar/video sekaligus.');
            }
            const keyword = rest.substring(0, sepIdx).trim();
            const answer = rest.substring(sepIdx + 1).trim();
            if (!keyword || !answer) {
                return message.reply('⚠️ Kata kunci dan jawaban tidak boleh kosong.');
            }
            const newId = state.customFAQ.length > 0
                ? Math.max(...state.customFAQ.map((f) => f.id)) + 1
                : 1;
            const faq = { id: newId, keyword, answer, enabled: true };
            state.customFAQ.push(faq);

            let mediaInfo = '';
            if (message.hasMedia) {
                const saved = await simpanMediaFAQ(faq, message);
                if (saved) mediaInfo = `\n🖼️ Media: ${saved.filename || 'terlampir'}`;
            }

            if (state.io) state.io.emit('faq-update', state.customFAQ);
            state.saveData();
            return message.reply(`✅ *FAQ ditambahkan!*\n\n🆔 ID: ${newId}\n🔑 Kata kunci: "${keyword}"\n💬 Jawaban: "${answer.substring(0, 80)}${answer.length > 80 ? '...' : ''}"${mediaInfo}`);
        }

        if (sub === 'media') {
            const idMedia = parseInt(args[2]);
            if (!idMedia) return message.reply('⚠️ Format: !faq media <id>\nKirim perintah sambil lampirkan gambar/video.');
            const faq = state.customFAQ.find((f) => f.id === idMedia);
            if (!faq) return message.reply(`⚠️ FAQ ID ${idMedia} tidak ditemukan.`);
            if (!message.hasMedia) return message.reply('⚠️ Lampirkan gambar/video bersama perintah ini.');
            const saved = await simpanMediaFAQ(faq, message);
            if (state.io) state.io.emit('faq-update', state.customFAQ);
            return message.reply(saved ? `✅ Media berhasil dilampirkan ke FAQ ID ${idMedia} ("${faq.keyword}")` : '❌ Gagal menyimpan media.');
        }

        if (sub === 'mediahapus') {
            const idHapusMedia = parseInt(args[2]);
            if (!idHapusMedia) return message.reply('⚠️ Format: !faq mediahapus <id>');
            const faq = state.customFAQ.find((f) => f.id === idHapusMedia);
            if (!faq) return message.reply(`⚠️ FAQ ID ${idHapusMedia} tidak ditemukan.`);
            if (!faq.media) return message.reply(`⚠️ FAQ ID ${idHapusMedia} tidak memiliki media.`);
            try {
                const fullPath = path.resolve(__dirname, '..', '..', faq.media.filepath);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            } catch (e) {}
            delete faq.media;
            if (state.io) state.io.emit('faq-update', state.customFAQ);
            state.saveData();
            return message.reply(`✅ Media FAQ ID ${idHapusMedia} ("${faq.keyword}") berhasil dihapus.`);
        }

        if (sub === 'hapus') {
            const idHapus = parseInt(args[2]);
            if (!idHapus) return message.reply('⚠️ Format: !faq hapus <id>\nCek ID dengan !faq list');
            const idx = state.customFAQ.findIndex((f) => f.id === idHapus);
            if (idx === -1) return message.reply(`⚠️ FAQ dengan ID ${idHapus} tidak ditemukan.`);
            const deleted = state.customFAQ.splice(idx, 1)[0];
            if (deleted.media && deleted.media.filepath) {
                try {
                    const fullPath = path.resolve(__dirname, '..', '..', deleted.media.filepath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (e) {}
            }
            if (state.io) state.io.emit('faq-update', state.customFAQ);
            state.saveData();
            return message.reply(`✅ FAQ ID ${idHapus} ("${deleted.keyword}") berhasil dihapus.`);
        }

        return message.reply('⚠️ Sub-perintah tidak dikenal.\n\n!faq list — lihat FAQ\n!faq add <kata kunci> | <jawaban> — tambah\n!faq media <id> — lampirkan media\n!faq mediahapus <id> — hapus media\n!faq hapus <id> — hapus FAQ');
    }

    // ---- FAQ GRUP (BLASTING) ----
    if (command === '!faqblast') {
        const sub = (args[1] || '').toLowerCase();

        const simpanMediaFAQ = async (faq, msg) => {
            if (!msg.hasMedia) return;
            try {
                const media = await msg.downloadMedia();
                if (!media) return;
                const ext = (media.mimetype.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '');
                const filename = `faqblast_${faq.id}_${Date.now()}.${ext}`;
                const mediaDir = path.resolve(__dirname, '..', '..', 'data', 'faq-media');
                if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
                const filepath = path.join(mediaDir, filename);
                fs.writeFileSync(filepath, media.data, 'base64');
                faq.media = { filepath: `data/faq-media/${filename}`, mimetype: media.mimetype, filename: media.filename || filename };
                state.saveData();
                return media;
            } catch (err) {
                console.error('❌ Gagal simpan media FAQ:', err.message);
            }
        };

        if (sub === 'list') {
            if (state.customFAQBlasting.length === 0) {
                return message.reply('📭 Belum ada FAQ Grup.\n\nTambah dengan: !faqblast add <kata kunci> | <jawaban>');
            }
            const list = state.customFAQBlasting
                .map((f) => `${f.id}. [${f.enabled ? '✅' : '🔴'}]${f.media ? ' 🖼️' : ''} *${f.keyword}*\n   ${f.answer.substring(0, 60)}${f.answer.length > 60 ? '...' : ''}`)
                .join('\n\n');
            return message.reply(`📋 *FAQ Grup — Blasting (${state.customFAQBlasting.length}):*\n\n${list}`);
        }

        if (sub === 'add') {
            const rest = args.slice(2).join(' ');
            const sepIdx = rest.indexOf('|');
            if (sepIdx === -1) {
                return message.reply('⚠️ Format: !faqblast add <kata kunci> | <jawaban>\n\n📎 Bisa lampirkan gambar/video sekaligus.\nContoh: ketik caption lalu attach gambar.');
            }
            const keyword = rest.substring(0, sepIdx).trim();
            const answer = rest.substring(sepIdx + 1).trim();
            if (!keyword || !answer) return message.reply('⚠️ Kata kunci dan jawaban tidak boleh kosong.');
            const newId = state.customFAQBlasting.length > 0
                ? Math.max(...state.customFAQBlasting.map((f) => f.id)) + 1
                : 1;
            const faq = { id: newId, keyword, answer, enabled: true };
            state.customFAQBlasting.push(faq);

            let mediaInfo = '';
            if (message.hasMedia) {
                const saved = await simpanMediaFAQ(faq, message);
                if (saved) mediaInfo = `\n🖼️ Media: ${saved.filename || 'terlampir'}`;
            }

            if (state.io) state.io.emit('faq-blast-update', state.customFAQBlasting);
            state.saveData();
            return message.reply(`✅ *FAQ Grup ditambahkan!*\n\n🆔 ID: ${newId}\n🔑 Kata kunci: "${keyword}"\n💬 Jawaban: "${answer.substring(0, 80)}${answer.length > 80 ? '...' : ''}"${mediaInfo}`);
        }

        if (sub === 'media') {
            const idMedia = parseInt(args[2]);
            if (!idMedia) return message.reply('⚠️ Format: !faqblast media <id>\nKirim perintah sambil lampirkan gambar/video.');
            const faq = state.customFAQBlasting.find((f) => f.id === idMedia);
            if (!faq) return message.reply(`⚠️ FAQ Grup ID ${idMedia} tidak ditemukan.`);
            if (!message.hasMedia) return message.reply('⚠️ Lampirkan gambar/video bersama perintah ini.');
            const saved = await simpanMediaFAQ(faq, message);
            if (state.io) state.io.emit('faq-blast-update', state.customFAQBlasting);
            return message.reply(saved ? `✅ Media berhasil dilampirkan ke FAQ ID ${idMedia} ("${faq.keyword}")` : '❌ Gagal menyimpan media.');
        }

        if (sub === 'mediahapus') {
            const idHapusMedia = parseInt(args[2]);
            if (!idHapusMedia) return message.reply('⚠️ Format: !faqblast mediahapus <id>');
            const faq = state.customFAQBlasting.find((f) => f.id === idHapusMedia);
            if (!faq) return message.reply(`⚠️ FAQ Grup ID ${idHapusMedia} tidak ditemukan.`);
            if (!faq.media) return message.reply(`⚠️ FAQ ID ${idHapusMedia} tidak memiliki media.`);
            // Hapus file fisik
            try {
                const fullPath = path.resolve(__dirname, '..', '..', faq.media.filepath);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            } catch (e) {}
            delete faq.media;
            if (state.io) state.io.emit('faq-blast-update', state.customFAQBlasting);
            state.saveData();
            return message.reply(`✅ Media FAQ ID ${idHapusMedia} ("${faq.keyword}") berhasil dihapus.`);
        }

        if (sub === 'hapus') {
            const idHapus = parseInt(args[2]);
            if (!idHapus) return message.reply('⚠️ Format: !faqblast hapus <id>');
            const idx = state.customFAQBlasting.findIndex((f) => f.id === idHapus);
            if (idx === -1) return message.reply(`⚠️ FAQ Grup ID ${idHapus} tidak ditemukan.`);
            const deleted = state.customFAQBlasting.splice(idx, 1)[0];
            // Hapus file media jika ada
            if (deleted.media && deleted.media.filepath) {
                try {
                    const fullPath = path.resolve(__dirname, '..', '..', deleted.media.filepath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (e) {}
            }
            if (state.io) state.io.emit('faq-blast-update', state.customFAQBlasting);
            state.saveData();
            return message.reply(`✅ FAQ Grup ID ${idHapus} ("${deleted.keyword}") berhasil dihapus.`);
        }

        return message.reply('⚠️ Sub-perintah tidak dikenal.\n\n!faqblast list\n!faqblast add <kata kunci> | <jawaban>\n!faqblast media <id> (lampirkan media)\n!faqblast mediahapus <id>\n!faqblast hapus <id>');
    }

    // ---- DONATUR ----
    if (command === '!donor') {
        const sub = (args[1] || '').toLowerCase();

        if (sub === 'list') {
            if (state.donors.length === 0) {
                return message.reply('📭 Belum ada data donatur.\n\nTambah: !donor add <nama> | <nomor> | <nominal> | <tanggal> | <kategori> | <catatan>');
            }
            const list = state.donors.slice(0, 15).map((d, i) =>
                `${i + 1}. *${d.name}* — Rp${d.amount.toLocaleString('id-ID')} (${d.date})`
            ).join('\n');
            const total = state.donors.reduce((s, d) => s + d.amount, 0);
            return message.reply(
                `💰 *Daftar Donatur (${state.donors.length}):*\n\n${list}\n\n` +
                `📊 Total keseluruhan: *Rp${total.toLocaleString('id-ID')}*`
            );
        }

        if (sub === 'add') {
            const rest = args.slice(2).join(' ');
            const parts = rest.split('|').map((p) => p.trim());
            const name = parts[0] || '';
            const phone = parts[1] || '';
            const amount = parseInt((parts[2] || '').replace(/\D/g, '')) || 0;
            const date = parts[3] || new Date().toISOString().slice(0, 10);
            const category = parts[4] || 'donasi';
            const notes = parts[5] || '';

            if (!name) return message.reply('⚠️ Nama tidak boleh kosong.\n\nFormat: !donor add <nama> | <nomor> | <nominal> | <tanggal> | <kategori> | <catatan>');
            if (!amount) return message.reply('⚠️ Nominal tidak valid.\n\nContoh: !donor add Budi | 6281234567890 | 500000 | 2026-06-17 | donasi | Donasi kebun');

            const year = parseInt(date.slice(0, 4));
            const newId = state.donors.length > 0 ? Math.max(...state.donors.map((d) => d.id)) + 1 : 1;
            state.donors.unshift({ id: newId, name, phone, amount, date, year, category, notes });
            if (state.io) state.io.emit('donors-update', state.donors);
            state.saveData();

            return message.reply(
                `✅ *Donatur ditambahkan!*\n\n` +
                `👤 Nama: ${name}\n` +
                `📞 WA: ${phone || '-'}\n` +
                `💰 Nominal: Rp${amount.toLocaleString('id-ID')}\n` +
                `📅 Tanggal: ${date}\n` +
                `🏷️ Kategori: ${category}\n` +
                `📝 Catatan: ${notes || '-'}`
            );
        }

        if (sub === 'hapus') {
            const idHapus = parseInt(args[2]);
            if (!idHapus) return message.reply('⚠️ Format: !donor hapus <id>\nCek ID dengan !donor list');
            const idx = state.donors.findIndex((d) => d.id === idHapus);
            if (idx === -1) return message.reply(`⚠️ Donatur ID ${idHapus} tidak ditemukan.`);
            const deleted = state.donors.splice(idx, 1)[0];
            if (state.io) state.io.emit('donors-update', state.donors);
            state.saveData();
            return message.reply(`✅ Data donatur "${deleted.name}" (ID ${idHapus}) dihapus.`);
        }

        if (sub === 'total') {
            const tahun = args[2] ? parseInt(args[2]) : null;
            const filtered = tahun ? state.donors.filter((d) => d.year === tahun) : state.donors;
            const total = filtered.reduce((s, d) => s + d.amount, 0);
            const label = tahun ? `tahun ${tahun}` : 'keseluruhan';
            return message.reply(
                `📊 *Rekap Donatur — ${label}:*\n\n` +
                `Jumlah transaksi: ${filtered.length}\n` +
                `Total dana: *Rp${total.toLocaleString('id-ID')}*`
            );
        }

        return message.reply(
            '⚠️ Sub-perintah tidak dikenal.\n\n' +
            '*Perintah !donor:*\n' +
            '!donor list — Lihat daftar donatur\n' +
            '!donor add <nama> | <no WA> | <nominal> | <tgl> | <kategori> | <catatan> — Tambah\n' +
            '!donor hapus <id> — Hapus donatur\n' +
            '!donor total — Total semua dana\n' +
            '!donor total 2026 — Total per tahun'
        );
    }

    // ---- GRUP & BLAST ----
    if (command === '!groups') {
        await scheduler.refreshGroups();
        if (state.groupsCache.length === 0) {
            return message.reply('⚠️ Bot belum bergabung di grup mana pun.');
        }
        const list = state.groupsCache
            .map((g, i) => `${i + 1}. ${g.name} (${g.memberCount} anggota)`)
            .join('\n');
        return message.reply(`👥 *Daftar Grup (${state.groupsCache.length}):*\n\n${list}`);
    }

    if (command === '!blast') {
        const blastMsg = args.slice(1).join(' ');
        if (!blastMsg) {
            return message.reply('⚠️ Format: !blast <pesan yang ingin dikirim>');
        }
        await message.reply(`📨 Memulai blast ke semua grup...`);
        const hasil = await scheduler.executeBlast(blastMsg);
        return message.reply(
            `✅ *Blast selesai!*\n\n` +
            `📨 Pesan: "${blastMsg.substring(0, 50)}${blastMsg.length > 50 ? '...' : ''}"\n` +
            `✅ Sukses: ${hasil.sukses} grup\n` +
            `❌ Gagal: ${hasil.gagal} grup\n` +
            `📊 Total: ${hasil.total} grup`
        );
    }

    if (command === '!blastjadwal') {
        const rest = args.slice(1).join(' ');
        const separatorIndex = rest.indexOf('|');
        if (separatorIndex === -1) {
            return message.reply(
                '⚠️ Format: !blastjadwal [hari] <HH:MM> | <pesan>\n\n' +
                'Contoh:\n' +
                '!blastjadwal 08:00 | Selamat pagi! (setiap hari)\n' +
                '!blastjadwal jum 03:00 | Subuh Jumat! (hari tertentu)\n' +
                '!blastjadwal jum,sab 04:00 | pesan (beberapa hari)\n\n' +
                'Kode hari: sen, sel, rab, kam, jum, sab, min'
            );
        }
        const beforePipe = rest.substring(0, separatorIndex).trim();
        const pesanJadwal = rest.substring(separatorIndex + 1).trim();
        if (!pesanJadwal) return message.reply('⚠️ Pesan tidak boleh kosong.');

        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        const DAY_CODES = ['sen', 'sel', 'rab', 'kam', 'jum', 'sab', 'min'];
        const DAY_LABEL = { sen: 'Senin', sel: 'Selasa', rab: 'Rabu', kam: 'Kamis', jum: 'Jumat', sab: 'Sabtu', min: 'Minggu' };

        const tokens = beforePipe.split(/\s+/);
        let waktuJadwal;
        let hariToken = null;
        if (tokens.length >= 2 && timeRegex.test(tokens[1])) {
            hariToken = tokens[0].toLowerCase();
            waktuJadwal = tokens[1];
        } else {
            waktuJadwal = tokens[0];
        }

        if (!timeRegex.test(waktuJadwal)) {
            return message.reply('⚠️ Format waktu salah. Gunakan HH:MM (contoh: 08:00, 17:30)');
        }

        let days = [];
        if (hariToken) {
            days = hariToken.split(',').map((d) => d.trim()).filter(Boolean);
            const invalid = days.filter((d) => !DAY_CODES.includes(d));
            if (invalid.length > 0) {
                return message.reply(`⚠️ Kode hari tidak dikenal: ${invalid.join(', ')}\nGunakan: sen, sel, rab, kam, jum, sab, min (pisahkan koma untuk beberapa hari)`);
            }
        }

        const newId = state.scheduledBlasts.length > 0
            ? Math.max(...state.scheduledBlasts.map((j) => j.id)) + 1
            : 1;
        state.scheduledBlasts.push({ id: newId, time: waktuJadwal, days, message: pesanJadwal, enabled: true });
        state.saveData();

        if (!state.blastSchedulerId) scheduler.startScheduler();

        if (state.io) {
            state.io.emit('schedules-update', state.scheduledBlasts);
            state.io.emit('status-update', {
                schedulesCount: state.scheduledBlasts.filter((j) => j.enabled).length,
            });
        }

        const hariLabel = days.length > 0 ? days.map((d) => DAY_LABEL[d]).join(', ') : 'setiap hari';
        return message.reply(
            `✅ *Jadwal blast ditambahkan!*\n\n` +
            `🆔 ID: ${newId}\n` +
            `📅 Hari: ${hariLabel}\n` +
            `⏰ Waktu: ${waktuJadwal}\n` +
            `📨 Pesan: "${pesanJadwal.substring(0, 50)}${pesanJadwal.length > 50 ? '...' : ''}"\n\n` +
            `Blast akan dikirim ${hariLabel === 'setiap hari' ? 'setiap hari' : `tiap ${hariLabel}`} jam ${waktuJadwal}.`
        );
    }

    if (command === '!blastjadwallist') {
        if (state.scheduledBlasts.length === 0) {
            return message.reply('📭 Belum ada jadwal blast.');
        }
        const DAY_LABEL = { sen: 'Sen', sel: 'Sel', rab: 'Rab', kam: 'Kam', jum: 'Jum', sab: 'Sab', min: 'Min' };
        const list = state.scheduledBlasts
            .map((j, i) => {
                const days = j.days || [];
                const hariLabel = days.length > 0 ? days.map((d) => DAY_LABEL[d] || d).join(',') : 'Setiap hari';
                return `${i + 1}. 🆔 ${j.id} | 📅 ${hariLabel} | ⏰ ${j.time} | ${j.enabled ? '✅ Aktif' : '🔴 Nonaktif'} | "${j.message.substring(0, 40)}..."`;
            })
            .join('\n');
        return message.reply(`⏰ *Daftar Jadwal Blast:*\n\n${list}`);
    }

    if (command === '!blastjadwalhapus') {
        const idHapus = parseInt(args[1]);
        if (!idHapus) return message.reply('⚠️ Format: !blastjadwalhapus <id>\nCek ID dengan !blastjadwallist');

        const index = state.scheduledBlasts.findIndex((j) => j.id === idHapus);
        if (index === -1) return message.reply(`⚠️ Jadwal dengan ID ${idHapus} tidak ditemukan.`);

        state.scheduledBlasts.splice(index, 1);
        state.saveData();
        if (state.io) {
            state.io.emit('schedules-update', state.scheduledBlasts);
            state.io.emit('status-update', {
                schedulesCount: state.scheduledBlasts.filter((j) => j.enabled).length,
            });
        }
        return message.reply(`✅ Jadwal blast ID ${idHapus} berhasil dihapus.`);
    }

    if (command === '!blaststop') {
        const count = state.scheduledBlasts.length;
        state.scheduledBlasts = [];
        state.saveData();
        scheduler.stopScheduler();
        if (state.io) {
            state.io.emit('schedules-update', state.scheduledBlasts);
            state.io.emit('status-update', { schedulesCount: 0 });
        }
        return message.reply(`🛑 Semua jadwal blast (${count}) dihentikan dan dihapus.`);
    }
});

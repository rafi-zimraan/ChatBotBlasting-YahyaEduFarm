const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');
const { MessageMedia } = require('whatsapp-web.js');
const client = require('./client');
const config = require('./config');
const state = require('./state');
const utils = require('./utils');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// =====================
// HANDLER MEDIA
// =====================
const handleMedia = (message) => {
    if (!config.MEDIA_TYPES.includes(message.type)) return { tolak: false, teks: null };

    const caption = message.body ? message.body.trim() : '';

    if (message.type === 'image' && caption === '') {
        return {
            tolak: true,
            teks: null,
            balasan: 'Maaf kak, saya belum bisa lihat gambar. Kalau ada pertanyaan, langsung ketik aja ya 😊',
        };
    }

    if (message.type === 'image' && caption !== '') {
        return {
            tolak: false,
            teks: `[User mengirim gambar dengan pesan]: ${caption}`,
        };
    }

    return {
        tolak: true,
        teks: null,
        balasan: 'Maaf kak, saya cuma bisa bales pesan teks. Ada yang bisa dibantu? 😊',
    };
};

// =====================
// HANDLER MENU — YahyaEduFarm
// =====================
const handleMenu = (text) => {
    if (text === '1') {
        return '🌿 *YahyaEduFarm* — Agrowisata Edukasi\n\n' +
            'Berlokasi di lingkungan Masjid Ismuhu Yahya, menggabungkan pertanian modern, ' +
            'edukasi lingkungan, dan nilai-nilai Islam dalam satu tempat yang asri.\n\n' +
            '📋 *Program tersedia:*\n' +
            '• Pelatihan bertani modern & hidroponik\n' +
            '• Wisata panen sayur dan buah\n' +
            '• Workshop agribisnis\n' +
            '• Kegiatan Islami di masjid\n' +
            '• Outbound edukasi untuk pelajar & keluarga\n\n' +
            '👉 Balas *2* untuk lihat produk & layanan';
    }
    if (text === '2') {
        return '📦 *Produk & Layanan*\n\n' +
            '🌱 *Produk Pertanian:*\n' +
            '• Sayuran hidroponik segar\n' +
            '• Bibit tanaman (stroberi, sayuran, dll)\n' +
            '• Pupuk organik\n\n' +
            '📚 *Program Edukasi:*\n' +
            '• Pelatihan bertani hidroponik\n' +
            '• Workshop agribisnis\n' +
            '• Kunjungan edukasi sekolah & pesantren\n\n' +
            '🎯 *Paket Kunjungan:*\n' +
            '• Wisata panen\n' +
            '• Outbound keluarga\n' +
            '• Gathering komunitas & majelis taklim\n\n' +
            '👉 Balas *3* untuk lihat daftar harga';
    }
    if (text === '3') {
        return '💰 *Daftar Harga*\n\n' +
            '🌱 *Produk Pertanian:*\n' +
            '• Sayur hidroponik/ikat — Rp5.000 - Rp10.000\n' +
            '• Bibit tanaman — Rp2.000 - Rp15.000\n' +
            '• Paket sayur mingguan — Rp50.000\n\n' +
            '📚 *Program Edukasi:*\n' +
            '• Pelatihan hidroponik dasar — Rp50.000/orang\n' +
            '• Workshop agribisnis — Rp75.000/orang\n' +
            '• Kunjungan sekolah — Rp25.000/siswa\n\n' +
            '🎯 *Paket Kunjungan:*\n' +
            '• Wisata panen — Rp35.000/orang\n' +
            '• Paket keluarga (4-5 org) — Rp150.000\n' +
            '• Gathering (min. 20 org) — hubungi admin\n\n' +
            '🎉 Diskon khusus: majelis taklim, pelajar, pesantren\n\n' +
            '👉 Balas *4* untuk info Masjid Ismuhu Yahya';
    }
    if (text === '4') {
        try {
            client.sendMessage(config.ADMIN_ID, 'Notifikasi: Ada yang menanyakan info Masjid Ismuhu Yahya');
        } catch (err) {
            console.error('❌ Gagal kirim notifikasi ke admin:', err.message);
        }
        return '🕌 *Masjid Ismuhu Yahya*\n\n' +
            'Pusat kegiatan YahyaEduFarm — bukan hanya tempat ibadah, ' +
            'tapi juga pusat pemberdayaan masyarakat lewat agrowisata dan edukasi.\n\n' +
            '📌 *Konsep:*\n' +
            '• Masjid sebagai pusat peradaban\n' +
            '• Pemberdayaan ekonomi jamaah\n' +
            '• Edukasi pertanian modern\n' +
            '• Konservasi lingkungan berbasis Islam\n\n' +
            '📞 *Kontak:*\n' +
            '• WA: 0852-4973-1265\n' +
            '• Email: yahyaedufarm@gmail.com\n' +
            '• Jam: Senin-Minggu, 08.00-17.00 WITA\n\n' +
            '👉 Balas *5* untuk testimoni & kegiatan';
    }
    if (text === '5') {
        return '⭐ *Testimoni & Kegiatan*\n\n' +
            '📅 *Kegiatan Rutin:*\n' +
            '• Panen raya bersama komunitas\n' +
            '• Pengajian & kajian Islami rutin\n' +
            '• Pelatihan hidroponik mingguan\n' +
            '• Bazar sayur & produk pertanian\n\n' +
            '💬 *Kata Pengunjung:*\n' +
            '“Tempatnya sejuk dan asri, cocok belajar sambil rekreasi.”\n' +
            '“Pelatihan hidroponiknya bermanfaat banget.”\n' +
            '“Anak-anak senang bisa panen langsung dari kebun.”\n\n' +
            '👉 Balas *6* untuk cara booking & reservasi';
    }
    if (text === '6') {
        return '📋 *Cara Booking & Reservasi*\n\n' +
            'Langkah mudah:\n' +
            '1️⃣ Hubungi admin via WA: 0852-4973-1265\n' +
            '2️⃣ Pilih program/paket\n' +
            '3️⃣ Tentukan tanggal & jumlah peserta\n' +
            '4️⃣ DP 50% sebagai konfirmasi\n' +
            '5️⃣ Hadir sesuai jadwal\n\n' +
            '💳 *Metode Pembayaran:*\n' +
            '• Transfer bank\n' +
            '• QRIS & dompet digital\n' +
            '• Tunai (di lokasi)\n\n' +
            '👉 Balas *7* untuk promo & diskon';
    }
    if (text === '7') {
        return '🎉 *Promo & Diskon*\n\n' +
            '• Majelis taklim — diskon 15%\n' +
            '• Pesantren — diskon 20%\n' +
            '• Pelajar & mahasiswa — diskon 10%\n' +
            '• Bibit min. 50 pcs — diskon 10%\n' +
            '• Grup min. 30 orang — harga spesial\n' +
            '• Belanja > Rp200.000 — diskon tambahan\n\n' +
            '👉 Balas *8* untuk hubungi admin';
    }
    if (text === '8') return null;

    return null;
};

// =====================
// HANDLER CUSTOM FAQ
// =====================
const handleCustomFAQ = (text, faqs) => {
    if (!faqs || faqs.length === 0) return null;
    const lower = text.toLowerCase();
    for (const faq of faqs) {
        if (!faq.enabled) continue;
        if (lower.includes(faq.keyword.toLowerCase())) {
            return faq;
        }
    }
    return null;
};

const FAQ_MEDIA_DIR = path.resolve(__dirname, '..', '..', 'data', 'faq-media');

const sendFAQReply = async (message, faq) => {
    if (faq.media && faq.media.filepath) {
        try {
            const fullPath = path.resolve(FAQ_MEDIA_DIR, path.basename(faq.media.filepath));
            if (fs.existsSync(fullPath)) {
                const base64 = fs.readFileSync(fullPath, { encoding: 'base64' });
                const media = new MessageMedia(faq.media.mimetype, base64, faq.media.filename || 'media');
                const chat = await message.getChat();
                await chat.sendMessage(media, { caption: faq.answer, quotedMessageId: message.id._serialized });
                return;
            }
        } catch (err) {
            console.error('❌ Gagal kirim media FAQ:', err.message);
        }
    }
    await message.reply(faq.answer);
};

// =====================
// HANDLER HOT LEAD
// =====================
const handleHotLead = (text) => {
    const hotKeywords = ['mau daftar', 'mau beli', 'tertarik', 'gimana cara daftar', 'mau ikut', 'mau order', 'mau pesan'];
    if (hotKeywords.some((keyword) => text.includes(keyword))) {
        return `Terima kasih minatnya kak 🙏\n\nUntuk info lebih lanjut & pendaftaran, langsung aja hubungi admin kami:\n📞 WA: 0852-4973-1265\n📧 Email: yahyaedufarm@gmail.com\n\nAtau balas *8* untuk terhubung langsung dengan admin.`;
    }
    return null;
};

// =====================
// HANDLER HANDOVER
// =====================
const isAdmin = (nomor) => {
    const adminId = config.ADMIN_ID || '';
    const adminNomor = adminId.split('@')[0];
    return nomor === adminNomor;
};

const handleHandover = async (nomor, nama, pesan = '') => {
    state.handoverUsers[nomor] = true;
    state.handoverWarned[nomor] = false;

    const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

    // Kirim notifikasi ke admin hanya jika bukan admin yang minta
    if (!isAdmin(nomor)) {
        // Notif singkat dulu agar muncul di push notification (lock screen)
        const shortNotif = `🔔 Customer minta CS!\n👤 ${nama}\n⏰ ${waktu}`;
        try {
            await client.sendMessage(config.ADMIN_ID, shortNotif);
        } catch (err) {
            console.error('❌ Gagal kirim notifikasi singkat ke admin:', err.message);
        }

        // Kirim detail lengkap sebagai pesan kedua
        const detailNotif =
            `🔔 *Permintaan CS Manusia*\n\n` +
            `👤 Nama: ${nama}\n` +
            `📱 Nomor: wa.me/${nomor}\n` +
            `🕐 Waktu: ${waktu}\n` +
            (pesan ? `💬 Riwayat: ${pesan}\n` : '') +
            `\nSilakan balas langsung ke user tersebut.`;

        try {
            await client.sendMessage(config.ADMIN_ID, detailNotif);
            console.log(`🔔 Notifikasi handover dikirim ke admin untuk user: ${nama}`);
        } catch (err) {
            console.error('❌ Gagal kirim notifikasi detail ke admin:', err.message);
        }
    }

    return `Mohon tunggu, admin segera menghubungi Anda.`;
};

// =====================
// HANDLER AI
// =====================
const handleAI = async (id, text, message) => {
    let chat = null;
    try {
        chat = await message.getChat();
        await chat.sendStateTyping();
    } catch (e) {}

    utils.addHistory(id, 'user', text);

    const res = await groq.chat.completions.create({
        model: config.GROQ_MODEL,
        max_tokens: config.MAX_TOKENS,
        messages: [{ role: 'system', content: config.SYSTEM_PROMPT }, ...utils.getHistory(id)],
    });

    const reply = res.choices[0].message.content;
    utils.addHistory(id, 'assistant', reply);

    console.log(`📊 Token: input=${res.usage.prompt_tokens} output=${res.usage.completion_tokens} total=${res.usage.total_tokens}`);

    try {
        if (chat) await chat.clearState();
    } catch (e) {}

    return reply;
};

module.exports = {
    handleMedia,
    handleMenu,
    handleCustomFAQ,
    handleHotLead,
    handleHandover,
    handleAI,
    sendFAQReply,
    FAQ_MEDIA_DIR,
};

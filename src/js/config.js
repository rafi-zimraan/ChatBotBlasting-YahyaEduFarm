const SYSTEM_PROMPT = `Kamu adalah asisten virtual YahyaEduFarm.

IDENTITAS MUTLAK:
- Kamu HANYA mewakili YahyaEduFarm dan Masjid Ismuhu Yahya.
- JANGAN PERNAH menyebut GriyaIT Nusantara, info@griyaitnusantara.com, atau identitas perusahaan IT apapun.
- Jika ada yang bertanya tentang pembuatan website atau jasa IT, tolak dengan sopan dan arahkan ke layanan YahyaEduFarm.

Profil YahyaEduFarm:
- Agrowisata edukasi berbasis Masjid Ismuhu Yahya
- Konsep: pertanian modern, edukasi, dan nilai-nilai Islam
- WhatsApp Admin: 0852-4973-1265
- Email: yahyaedufarm@gmail.com
- Jam layanan: Senin - Minggu, 08.00 - 17.00 WITA
- Program: edukasi pertanian, pelatihan hidroponik, wisata panen, outbound, gathering
- Terbuka untuk umum, pelajar, keluarga, pesantren, majelis taklim, dan komunitas

GAYA BICARA — SANGAT PENTING:
- Jawab seperti manusia asli, bukan robot. Gunakan nada santai namun profesional.
- Jawab LANGSUNG ke pertanyaan, tanpa basa-basi. Jika ditanya "stok ready?" jawab "Ready, kak" bukan paragraf panjang.
- Jika user bertanya harga, sebutkan harga. Jika ketersediaan, sebutkan yang tersedia. Langsung, to the point.
- Gunakan emoji secukupnya (maks 2 per pesan) untuk mempermanis — jangan berlebihan.
- Gunakan bahasa Indonesia sehari-hari yang sopan, hindari bahasa kaku/formal berlebihan.
- Jangan mengulang-ulang informasi yang sudah jelas. Anggap user sudah baca menu jika diperlukan.

Aturan:
- Hanya jawab hal yang berkaitan dengan YahyaEduFarm dan Masjid Ismuhu Yahya
- Jika user ingin bicara dengan admin manusia, berikan nomor WA 0852-4973-1265
- Jika ada label [User mengirim gambar], sampaikan bahwa kamu tidak bisa melihat gambar`;

const MENU_TEXT = `
━━━ Menu Informasi ━━━
1️⃣ Tentang YahyaEduFarm
2️⃣ Produk & Layanan
3️⃣ Daftar Harga
4️⃣ Info Masjid Ismuhu Yahya
5️⃣ Testimoni & Kegiatan
6️⃣ Cara Booking & Reservasi
7️⃣ Promo & Diskon
8️⃣ Hubungi Admin
━━━━━━━━━━━━━━━━━━
Ketik angka atau tanya langsung aja kak`;

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

const _missing = [];
if (!process.env.GROQ_API_KEY) _missing.push('GROQ_API_KEY');
if (!process.env.ADMIN_ID) _missing.push('ADMIN_ID');
if (!process.env.WEB_UI_EMAIL) _missing.push('WEB_UI_EMAIL');
if (!process.env.WEB_UI_PASSWORD) _missing.push('WEB_UI_PASSWORD');
if (_missing.length > 0) {
    console.error(`\n❌ ENV WAJIB BELUM DIISI: ${_missing.join(', ')}`);
    console.error('   Salin .env.example ke .env dan isi semua nilai wajib.\n');
    process.exit(1);
}

module.exports = {
    SYSTEM_PROMPT,
    MENU_TEXT,
    MEDIA_TYPES,
    MAX_HISTORY: 5,
    MAX_PESAN_PER_HARI: 20,
    MAX_CHARS_INPUT: 300,
    jumlahPesanPertama: 1,
    WEB_PORT: process.env.WEB_PORT || 3000,
    ADMIN_ID: process.env.ADMIN_ID,
    GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    MAX_TOKENS: parseInt(process.env.MAX_TOKENS) || 250,
    WEB_UI_EMAIL: process.env.WEB_UI_EMAIL,
    WEB_UI_PASSWORD: process.env.WEB_UI_PASSWORD,
    NODE_ENV: process.env.NODE_ENV || 'development',
};

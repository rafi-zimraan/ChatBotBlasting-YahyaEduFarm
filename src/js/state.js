const storage = require('./storage');

const DEFAULT_FAQ_DM = [
    { id: 1,  keyword: 'harga bibit',         answer: '💰 *Daftar Harga Bibit*\n\n• Stroberi: Rp10.000 - Rp15.000/pcs\n• Sayuran: Rp2.000 - Rp5.000/pcs\n• Buah: Rp5.000 - Rp15.000/pcs\n\n🎉 Diskon untuk pembelian min. 50 pcs.\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 2,  keyword: 'lokasi',               answer: '📍 YahyaEduFarm berlokasi di lingkungan Masjid Ismuhu Yahya.\n\nUntuk alamat lengkap & petunjuk arah:\n📞 WA: 0852-4973-1265\n📧 Email: yahyaedufarm@gmail.com', enabled: true },
    { id: 3,  keyword: 'jam buka',             answer: '🕐 *Jam Layanan*\nSenin - Minggu, 08.00 - 17.00 WITA\n\nKunjungan grup/rombongan harap hubungi admin dulu ya.\n📞 WA: 0852-4973-1265', enabled: true },
    { id: 4,  keyword: 'cara daftar',          answer: '📋 *Cara Daftar Program*\n\n1️⃣ Hubungi admin: WA 0852-4973-1265\n2️⃣ Pilih program/paket\n3️⃣ Konfirmasi jadwal & jumlah peserta\n4️⃣ Bayar DP\n5️⃣ Datang sesuai jadwal\n\n📧 yahyaedufarm@gmail.com', enabled: true },
    { id: 5,  keyword: 'paket wisata',         answer: '🎯 *Paket Kunjungan*\n\n🌾 Paket Panen — Rp35.000/orang\n👨‍👩‍👧‍👦 Paket Keluarga — Rp150.000 (4-5 org)\n👥 Gathering (min. 20 org) — hubungi admin\n🕌 Majelis Taklim — diskon 15%\n\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 6,  keyword: 'outbound',             answer: '🎯 *Paket Outbound*\n\nCocok untuk pelajar, keluarga, komunitas, instansi.\nAktivitas: berkebun, wisata panen, games edukatif, kegiatan Islami.\nTersedia paket half day & full day.\n\nInfo & booking: WA 0852-4973-1265', enabled: true },
    { id: 7,  keyword: 'kunjungan sekolah',    answer: '🎒 *Kunjungan Sekolah*\n\n• Sasaran: SD, SMP, SMA, pesantren\n• Harga: Rp25.000/siswa (min. 20 siswa)\n• Materi: pertanian modern, hidroponik, lingkungan\n• Dapat sertifikat kunjungan 📜\n\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 8,  keyword: 'gathering',            answer: '👥 *Paket Gathering*\n\n• Min. 20 orang\n• Bisa include: konsumsi, dokumentasi, sertifikat\n• Lokasi: kebun & Masjid Ismuhu Yahya\n• Cocok: instansi, komunitas, organisasi\n\nPenawaran: WA 0852-4973-1265', enabled: true },
    { id: 9,  keyword: 'sayur hidroponik',     answer: '🥬 *Sayur Hidroponik*\n\n• Selada: Rp5.000 - Rp8.000/ikat\n• Kangkung: Rp5.000/ikat\n• Bayam: Rp5.000/ikat\n• Paket mingguan (campur): Rp50.000\n\nDipanen langsung, tanpa pestisida ✅\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 10, keyword: 'pupuk organik',        answer: '🌱 *Pupuk Organik*\n\nKompos berkualitas, kemasan 1kg, 5kg, 10kg.\nCocok untuk sayur, buah, tanaman hias.\n\nInfo harga & stok: WA 0852-4973-1265', enabled: true },
    { id: 11, keyword: 'pelatihan',            answer: '📚 *Program Pelatihan*\n\n• Hidroponik Dasar — Rp50.000/orang\n• Lanjutan (Agribisnis) — Rp75.000/orang\n• Dapat sertifikat & panduan 📜\n• Praktik langsung di kebun\n\nDaftar: WA 0852-4973-1265', enabled: true },
    { id: 12, keyword: 'workshop',             answer: '📚 *Workshop Agribisnis*\n\n• Materi: pengembangan usaha pertanian\n• Termasuk modul & sertifikat\n• Biaya: Rp75.000/orang\n• Bisa dikustom untuk instansi/komunitas\n\nDaftar: WA 0852-4973-1265', enabled: true },
    { id: 13, keyword: 'diskon',               answer: '🎉 *Diskon Tersedia*\n\n• Majelis taklim — 15%\n• Pesantren — 20%\n• Pelajar/mahasiswa — 10%\n• Bibit min. 50 pcs — 10%\n• Grup min. 30 org — harga spesial\n• Belanja > Rp200.000 — diskon tambahan\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 14, keyword: 'stroberi',             answer: '🍓 *Bibit Stroberi*\n\n• Varietas: California & Earlibrite\n• Harga: Rp10.000 - Rp15.000/pcs\n• Min. order: 10 pcs\n• Kondisi: sehat, siap tanam ✅\n• Bisa ambil langsung atau kirim\n\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 15, keyword: 'pesantren',            answer: '🕌 *Program Pesantren*\n\n• Edukasi pertanian modern bernilai Islam\n• Diskon khusus 20%\n• Tersedia 1 hari atau multi-hari\n• Bisa disesuaikan kurikulum pesantren\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 16, keyword: 'majelis',              answer: '🕌 *Program Majelis Taklim*\n\n• Wisata edukasi Islami\n• Diskon khusus 15%\n• Bisa dikombinasi dengan pengajian\n• Lokasi: Masjid Ismuhu Yahya\n\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 17, keyword: 'kontak',               answer: '📞 *Kontak YahyaEduFarm*\n\n• WA: 0852-4973-1265\n• Email: yahyaedufarm@gmail.com\n• Lokasi: Masjid Ismuhu Yahya\n• Jam: Senin-Minggu, 08.00-17.00 WITA\n\nKetik *8* untuk bicara dengan admin langsung.', enabled: true },
    { id: 18, keyword: 'pembayaran',           answer: '💳 *Metode Pembayaran*\n\n• Transfer bank\n• QRIS & dompet digital\n• Tunai (di lokasi)\n\nDP 50% untuk konfirmasi booking.\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 19, keyword: 'anak',                 answer: '🧒 *Program Anak*\n\n• Edukasi berkebun yang seru\n• Belajar menanam & merawat tanaman\n• Wisata panen langsung dari kebun\n• Nilai Islami terintegrasi\n\nPaket keluarga: Rp150.000 (4-5 org)\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 20, keyword: 'cara berkunjung',      answer: '📋 *Cara Berkunjung*\n\n1️⃣ Hubungi admin: WA 0852-4973-1265\n2️⃣ Tentukan tanggal & jumlah\n3️⃣ Pilih paket (wisata/edukasi/gathering)\n4️⃣ DP sebagai konfirmasi\n5️⃣ Datang sesuai jadwal\n\nAtau langsung datang jam 08.00-17.00 WITA', enabled: true },
    { id: 21, keyword: 'belanja 200',          answer: '🎉 *Promo Belanja*\n\nBelanja > Rp200.000 dapat diskon tambahan!\nHubungi admin untuk info besaran & syarat.\n\n📞 WA: 0852-4973-1265\n📧 yahyaedufarm@gmail.com', enabled: true },
    { id: 22, keyword: 'produk sayur',         answer: '🥬 *Sayuran Segar Hidroponik*\n\n• Selada: Rp5.000 - Rp8.000/ikat\n• Kangkung: Rp5.000/ikat\n• Bayam: Rp5.000/ikat\n• Paket mingguan (campur): Rp50.000\n\nDipanen langsung, bebas pestisida ✅\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 23, keyword: 'stok',                 answer: '✅ *Stok Tersedia*\n\n• Sayuran hidroponik segar\n• Bibit tanaman (stroberi, sayuran, buah)\n• Pupuk organik\n• Paket wisata & edukasi\n\nInfo stok terkini: WA 0852-4973-1265', enabled: true },
    { id: 24, keyword: 'ready',                answer: '✅ Ready kak! Masih tersedia:\n\n• Sayuran hidroponik segar\n• Bibit tanaman\n• Pupuk organik\n• Paket wisata & edukasi\n\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 25, keyword: 'tersedia',             answer: '✅ Masih tersedia kak!\n\n• Sayur hidroponik — Rp5.000 - Rp10.000/ikat\n• Bibit tanaman — Rp2.000 - Rp15.000/pcs\n• Paket wisata edukasi — mulai Rp25.000/orang\n• Program pelatihan hidroponik\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 26, keyword: 'halo',                 answer: 'Halo kak! 👋 Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat. Kami punya program wisata panen, edukasi hidroponik, outbound, dan gathering — cocok untuk keluarga, sekolah, dan komunitas.\n\nAda yang ingin ditanyakan? 😊', enabled: true },
    { id: 27, keyword: 'selamat pagi',         answer: 'Selamat pagi kak! 🌤️ Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat. Kami punya program wisata panen, edukasi hidroponik, outbound, dan gathering.\n\nAda yang bisa dibantu? 😊', enabled: true },
    { id: 28, keyword: 'selamat siang',        answer: 'Selamat siang kak! ☀️ Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat. Kami punya program wisata panen, edukasi hidroponik, outbound, dan gathering.\n\nAda yang bisa dibantu? 😊', enabled: true },
    { id: 29, keyword: 'selamat malam',        answer: 'Selamat malam kak! 🌙 Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat. Kami punya program wisata panen, edukasi hidroponik, outbound, dan gathering.\n\nAda yang bisa dibantu? 😊', enabled: true },
    { id: 30, keyword: 'helo',                 answer: 'Helo kak! 👋 Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat. Kami punya program wisata panen, edukasi hidroponik, outbound, dan gathering.\n\nAda yang ingin ditanyakan? 😊', enabled: true },
];

const DEFAULT_FAQ_BLASTING = [
    { id: 1,  keyword: 'harga',       answer: '💰 *Daftar Harga*\n\n• Sayur hidroponik: Rp5.000 - Rp10.000/ikat\n• Bibit tanaman: Rp2.000 - Rp15.000/pcs\n• Paket wisata panen: Rp35.000/orang\n• Paket keluarga: Rp150.000 (4-5 org)\n\nInfo lengkap: WA 0852-4973-1265', enabled: true },
    { id: 2,  keyword: 'dimana',      answer: '📍 Berlokasi di lingkungan Masjid Ismuhu Yahya.\n\nPetunjuk arah:\n📞 WA: 0852-4973-1265\n📧 yahyaedufarm@gmail.com', enabled: true },
    { id: 3,  keyword: 'cara pesan',  answer: '📋 *Cara Pesan*\n\n1️⃣ Hubungi admin: WA 0852-4973-1265\n2️⃣ Pilih produk/paket\n3️⃣ Konfirmasi jadwal\n4️⃣ Bayar DP booking\n\nTim kami siap melayani 😊', enabled: true },
    { id: 4,  keyword: 'jam buka',    answer: '🕐 *Jam Layanan*\nSenin - Minggu, 08.00 - 17.00 WITA\n\nRombongan harap hubungi admin dulu ya.\n📞 WA: 0852-4973-1265', enabled: true },
    { id: 5,  keyword: 'diskon',      answer: '🎉 *Diskon Tersedia*\n\n• Majelis taklim — 15%\n• Pesantren — 20%\n• Pelajar/mahasiswa — 10%\n• Grup min. 30 org — harga spesial\n• Belanja > Rp200.000 — diskon tambahan\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 6,  keyword: 'bibit',       answer: '🌱 *Bibit Tersedia*\n\n• Stroberi: Rp10.000 - Rp15.000/pcs\n• Sayuran: Rp2.000 - Rp5.000/pcs\n• Buah: Rp5.000 - Rp15.000/pcs\n\nDiskon min. 50 pcs.\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 7,  keyword: 'wisata',      answer: '🎯 *Paket Wisata*\n\n🌾 Paket Panen — Rp35.000/orang\n👨‍👩‍👧‍👦 Paket Keluarga — Rp150.000 (4-5 org)\n👥 Gathering (min. 20 org) — hubungi admin\n🕌 Majelis Taklim — diskon 15%\n\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 8,  keyword: 'edukasi',     answer: '📚 *Program Edukasi*\n\n• Hidroponik dasar — Rp50.000/orang\n• Agribisnis — Rp75.000/orang\n• Kunjungan sekolah — Rp25.000/siswa\n• Dapat sertifikat 📜\n\nDaftar: WA 0852-4973-1265', enabled: true },
    { id: 9,  keyword: 'daftar',      answer: '📋 *Cara Daftar*\n\n1️⃣ Hubungi admin: WA 0852-4973-1265\n2️⃣ Pilih program/paket\n3️⃣ Konfirmasi tanggal & jumlah\n4️⃣ Bayar DP\n5️⃣ Hadir sesuai jadwal\n\n📧 yahyaedufarm@gmail.com', enabled: true },
    { id: 10, keyword: 'outbound',    answer: '🎯 *Paket Outbound*\n\nCocok: pelajar, keluarga, komunitas, instansi.\nAktivitas: berkebun, wisata panen, games edukatif.\nTersedia half day & full day.\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 11, keyword: 'anak',        answer: '🧒 *Program Anak*\n\n• Edukasi berkebun seru\n• Wisata panen dari kebun\n• Nilai Islami terintegrasi\n\nPaket keluarga: Rp150.000 (4-5 org)\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 12, keyword: 'sayur',       answer: '🥬 *Sayur Hidroponik Segar*\n\n• Selada, bayam, kangkung, dll\n• Harga: Rp5.000 - Rp10.000/ikat\n• Paket mingguan: Rp50.000\n• Bebas pestisida ✅\n\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 13, keyword: 'pelatihan',   answer: '📚 *Program Pelatihan*\n\n• Hidroponik dasar — Rp50.000/orang\n• Agribisnis — Rp75.000/orang\n• Sertifikat & modul 📜\n• Praktik langsung di kebun\n\nDaftar: WA 0852-4973-1265', enabled: true },
    { id: 14, keyword: 'sekolah',     answer: '🎒 *Kunjungan Sekolah*\n\n• Sasaran: SD, SMP, SMA\n• Harga: Rp25.000/siswa (min. 20)\n• Materi: pertanian modern, hidroponik\n• Dapat sertifikat 📜\n\nBooking: WA 0852-4973-1265', enabled: true },
    { id: 15, keyword: 'gathering',   answer: '👥 *Paket Gathering*\n\n• Min. 20 orang\n• Fasilitas: konsumsi, dokumentasi, sertifikat\n• Lokasi: kebun & Masjid Ismuhu Yahya\n• Cocok: instansi, komunitas, organisasi\n\nPenawaran: WA 0852-4973-1265', enabled: true },
    { id: 16, keyword: 'kontak',      answer: '📞 *Kontak*\n\n• WA: 0852-4973-1265\n• Email: yahyaedufarm@gmail.com\n• Lokasi: Masjid Ismuhu Yahya\n• Jam: Senin-Minggu, 08.00-17.00 WITA', enabled: true },
    { id: 17, keyword: 'booking',     answer: '📋 *Cara Booking*\n\n1️⃣ Hubungi admin: WA 0852-4973-1265\n2️⃣ Pilih paket & tentukan tanggal\n3️⃣ Konfirmasi jumlah peserta\n4️⃣ DP 50% konfirmasi booking\n\n📧 yahyaedufarm@gmail.com', enabled: true },
    { id: 18, keyword: 'info',        answer: '🌿 *YahyaEduFarm* — Agrowisata Edukasi\n\nProgram:\n• Pertanian modern & hidroponik\n• Edukasi & pelatihan agribisnis\n• Wisata panen\n• Outbound & gathering\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 19, keyword: 'majelis',     answer: '🕌 *Program Majelis Taklim*\n\n• Wisata edukasi Islami\n• Diskon khusus 15%\n• Lokasi: Masjid Ismuhu Yahya\n• Bisa dikombinasi pengajian\n\nInfo: WA 0852-4973-1265', enabled: true },
    { id: 20, keyword: 'stroberi',    answer: '🍓 *Bibit Stroberi*\n\n• Varietas: California & Earlibrite\n• Harga: Rp10.000 - Rp15.000/pcs\n• Min. order: 10 pcs\n• Sehat, siap tanam ✅\n• Ambil langsung atau kirim\n\nPesan: WA 0852-4973-1265', enabled: true },
    { id: 21, keyword: 'belanja 200', answer: '🎉 *Promo Belanja*\n\nBelanja > Rp200.000 dapat diskon tambahan!\nHubungi admin info besaran & syarat.\n\n📞 WA: 0852-4973-1265\n📧 yahyaedufarm@gmail.com', enabled: true },
    { id: 22, keyword: 'halo',        answer: 'Halo kak! 👋 Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat — ada wisata panen, edukasi hidroponik, outbound, dan gathering.\n\nAda yang ingin ditanyakan? 😊', enabled: true },
    { id: 23, keyword: 'selamat pagi', answer: 'Selamat pagi kak! 🌤️ Ada rencana untuk berkunjung ke YahyaEduFarm? Yuk lihat program kami: wisata panen, edukasi hidroponik, outbound, dan gathering — semua berbasis Masjid Ismuhu Yahya di Kalimantan Barat.\n\nAda yang bisa dibantu? 😊', enabled: true },
    { id: 24, keyword: 'selamat siang', answer: 'Selamat siang kak! ☀️ Ada rencana untuk berkunjung ke YahyaEduFarm? Yuk lihat program kami: wisata panen, edukasi hidroponik, outbound, dan gathering — semua berbasis Masjid Ismuhu Yahya di Kalimantan Barat.\n\nAda yang bisa dibantu? 😊', enabled: true },
    { id: 25, keyword: 'selamat malam', answer: 'Selamat malam kak! 🌙 Ada rencana untuk berkunjung ke YahyaEduFarm? Yuk lihat program kami: wisata panen, edukasi hidroponik, outbound, dan gathering — semua berbasis Masjid Ismuhu Yahya di Kalimantan Barat.\n\nAda yang bisa dibantu? 😊', enabled: true },
    { id: 26, keyword: 'helo',        answer: 'Helo kak! 👋 Ada rencana untuk berkunjung ke YahyaEduFarm?\n\nYahyaEduFarm adalah agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat — ada wisata panen, edukasi hidroponik, outbound, dan gathering.\n\nAda yang ingin ditanyakan? 😊', enabled: true },
];

const mergeDefaultFAQ = (savedList, defaultList) => {
    if (!savedList || savedList.length === 0) return defaultList;
    const savedKeywords = new Set(savedList.map((f) => f.keyword.toLowerCase()));
    const newItems = defaultList.filter((f) => !savedKeywords.has(f.keyword.toLowerCase()));
    if (newItems.length === 0) return savedList;
    const maxId = Math.max(...savedList.map((f) => f.id), 0);
    newItems.forEach((item, i) => { item.id = maxId + i + 1; });
    const merged = [...savedList, ...newItems];
    console.log(`📋 FAQ: ${newItems.length} item baru ditambahkan ke database`);
    return merged;
};

const saved = storage.load();

const state = {
    botAktif: true,
    handleHotLeadAktif: false,
    botMenu: true,
    BOT_START_TIME: Math.floor(Date.now() / 1000),

    chatHistory: {},
    userCooldown: {},
    handoverUsers: {},
    handoverWarned: {},
    userMessageCount: {},
    outOfHoursNotified: {},

    customFAQ: (saved && saved.customFAQ) ? mergeDefaultFAQ(saved.customFAQ, DEFAULT_FAQ_DM) : DEFAULT_FAQ_DM,
    customFAQBlasting: (saved && saved.customFAQBlasting) ? mergeDefaultFAQ(saved.customFAQBlasting, DEFAULT_FAQ_BLASTING) : DEFAULT_FAQ_BLASTING,

    analytics: (saved && saved.analytics) ? saved.analytics : {},
    donors: (saved && saved.donors) ? saved.donors : [],

    groupsCache: [],
    lastGroupsRefresh: 0,

    scheduledBlasts: (saved && saved.scheduledBlasts) ? saved.scheduledBlasts : [],
    blastSchedulerId: null,
    blastHistory: [],

    botOwnId: null,
    io: null,
    batasiPesanPerHari: true,
};

state.saveData = () => {
    storage.save({
        customFAQ: state.customFAQ,
        customFAQBlasting: state.customFAQBlasting,
        scheduledBlasts: state.scheduledBlasts,
        analytics: state.analytics,
        donors: state.donors,
    });
};

module.exports = state;

# WhatsApp AI Bot — GriyaIT Nusantara

Bot WhatsApp otomatis berbasis AI menggunakan **Groq API** dan **whatsapp-web.js**.
Dikembangkan oleh **GriyaIT Nusantara** untuk mengelola **YahyaEduFarm** — agrowisata edukasi berbasis Masjid Ismuhu Yahya.

## Fitur

- 🤖 Balas chat otomatis pakai AI (private & grup via mention)
- 📋 Menu pilihan angka (1-5) tanpa token AI
- 📢 Blasting ke banyak grup WhatsApp
- ⏰ Penjadwalan blast otomatis harian
- 👥 Tracking grup yang bot ikuti
- 🔥 Deteksi hot lead otomatis
- 🧠 AI ingat riwayat chat per user
- 🚫 Anti spam (cooldown 3 detik)
- 🎮 Kontrol bot dari nomor sendiri
- 💪 Bot tidak crash meski ada error
- 🙋 Handover ke CS manusia + notifikasi admin
- 📵 Pembatasan pesan per hari per user
- 🌐 Web UI dashboard (http://localhost:3000)

## Struktur Folder

```
├── src/
│   ├── js/
│   │   ├── index.js       # Entry point
│   │   ├── config.js       # Konfigurasi & prompts
│   │   ├── state.js        # Shared state
│   │   ├── utils.js        # Utility functions
│   │   ├── client.js       # WhatsApp client
│   │   ├── handlers.js     # Message handlers
│   │   ├── bot.js          # Incoming message pipeline
│   │   ├── commands.js     # Admin commands (!blast dll)
│   │   └── scheduler.js    # Blast scheduler
│   ├── web/
│   │   ├── server.js       # Express + Socket.io server
│   │   └── public/
│   │       ├── index.html  # Web UI (dashboard)
│   │       ├── style.css
│   │       └── app.js
│   ├── assets/
│   │   └── icons/          # Brand assets
│   ├── css/                # (future)
│   └── components/         # (future)
├── .env.example
├── package.json
├── LICENSE
└── README.md
```

## Cara Install

```bash
npm install
cp .env.example .env
# Isi GROQ_API_KEY dan ADMIN_ID di .env
npm start
```

Scan QR Code, lalu buka http://localhost:3000 untuk dashboard.

## Perintah Bot

Kirim ke **nomor sendiri** di WhatsApp:

| Perintah | Fungsi |
|----------|--------|
| `!on` / `!off` | Aktifkan/matikan bot |
| `!menu on/off` | Aktifkan/nonaktifkan menu |
| `!groups` | Lihat daftar grup |
| `!blast <pesan>` | Blast ke SEMUA grup |
| `!blastjadwal HH:MM \| <pesan>` | Jadwalkan blast harian |
| `!blaststop` | Hentikan semua jadwal |

© 2026 GriyaIT Nusantara — MIT License

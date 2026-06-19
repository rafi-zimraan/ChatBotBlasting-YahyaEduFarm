# Tech Stack — Jabatangan WhatsApp Bot

## Backend

| Komponen | Teknologi | Fungsi |
|---|---|---|
| Runtime | Node.js 20+ | Server-side JavaScript |
| Bot Engine | `whatsapp-web.js` v1.25+ | Emulasi WhatsApp Web, kirim/terima pesan |
| Web Framework | Express.js | REST API + serve dashboard |
| Real-time | Socket.IO | WebSocket untuk dashboard live (state, notif, progress) |
| AI Chat | Groq API (`llama-3.1-8b-instant`) | Jawab pertanyaan customer otomatis |
| Browser | Puppeteer / Chromium | Dibutuhkan `whatsapp-web.js` untuk login WA |
| Scheduler | In-memory timer (30s loop) | Jadwal blast harian otomatis |

## Frontend

| Komponen | Teknologi | Fungsi |
|---|---|---|
| UI | HTML + CSS (vanilla) | Dashboard, login page |
| Chart | Chart.js | Grafik aktivitas 7 hari |
| Login | Session token + cookie | Auth dashboard (`owner@gmail.com` / `owner123`) |

## Data & Storage

| Komponen | Lokasi | Keterangan |
|---|---|---|
| Session WA | `.wwebjs_auth/` | Auth WhatsApp, persist di filesystem |
| State JSON | `data/data.json` | Chat history, donors, FAQ, analytics, dll |
| FAQ Media | `data/faq-media/` | File upload (gambar/video/PDF) untuk FAQ |
| .env | `.env` | `GROQ_API_KEY`, `ADMIN_ID`, dll |

## Keamanan

- Helmet.js headers
- CORS restricted ke `localhost:3000`
- Token session untuk Socket.IO + HTTP
- Login page dengan email/password

## Dependencies Utama (`package.json`)

- `whatsapp-web.js` — bot engine
- `express` — web server
- `socket.io` — real-time
- `helmet` — security headers
- `groq-sdk` — AI chat completion
- `pdfkit` — export donor PDF
- `exceljs` — export donor Excel
- `qrcode-terminal` — QR code di terminal

## Arsitektur

```
src/
  js/
    index.js       → entry point
    config.js      → env vars, limits, SYSTEM_PROMPT
    client.js      → WhatsApp client instance
    bot.js         → message pipeline (inbox)
    handlers.js    → menu, FAQ, AI, media, handover
    commands.js    → admin perintah (!on, !faq, !blast, dll)
    state.js       → shared state + defaults
    storage.js     → JSON persistence
    scheduler.js   → blast scheduler + retry
    utils.js       → helpers (spam, limit, jam kerja)
  web/
    server.js      → Express + Socket.IO server
    public/        → frontend (HTML, CSS, JS, login)
```

## Hosting Requirement

- **RAM minimal:** 1GB (karena Chromium/Puppeteer)
- **Storage:** ~200MB + session + data
- **OS:** Ubuntu 22.04+ / Debian
- **24/7:** Harus selalu running (PM2 / systemd)

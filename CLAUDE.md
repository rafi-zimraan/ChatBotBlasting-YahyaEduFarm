# CLAUDE.md — GriyaIT Nusantara WhatsApp Bot

## Project overview

WhatsApp bot for GriyaIT Nusantara, managing YahyaEduFarm (agrowisata edukasi berbasis Masjid Ismuhu Yahya). Built on `whatsapp-web.js` + Groq API. Modular architecture in `src/js/`.

## Commands

```bash
npm install
cp .env.example .env   # isi GROQ_API_KEY dan ADMIN_ID
npm start               # node src/js/index.js (bot + web UI di port 3000)
npm run dev             # node --watch src/js/index.js
```

**Web UI:** Buka `http://localhost:3000` setelah bot siap untuk dashboard blast & group management.

Web UI config: `WEB_PORT` di `.env` (default: 3000)

## Architecture

### `client.on('message', ...)` — Incoming messages (private + group)

**Private messages:** Full pipeline (anti-spam → handover → out-of-hours → media → length → menu → FAQ → hot lead → limit → AI).

**Group messages:** Balas otomatis via FAQ Blasting (tanpa perlu @mention) jika keyword cocok. Untuk AI, hanya balas saat bot `@mentioned`.

Pipeline order:
1. Source filters — skip channels, broadcast, system notifications
2. Group mention check — untuk `@g.us`, cek FAQ blasting dulu, skip jika bot tidak di-mention untuk AI
3. Stale-message guard — skip messages before `BOT_START_TIME`
4. Global on/off (`botAktif`)
5. Anti-spam (`isSpam`) — 3s cooldown per user
6. Handover check — silent untuk users di `handoverUsers`
7. Out-of-hours check — notifikasi sekali per hari jika di luar jam 08.00-17.00 WITA
8. Media handling — tolak unsupported media, izinkan image+caption
9. Length guard — `MAX_CHARS_INPUT` (300 char)
10. Menu routing (`handleMenu`) — 8 opsi info bisnis
11. FAQ keyword match (`handleCustomFAQ`) — cocok otomatis dari keyword (DM + Blasting)
12. Hot-lead detection (`handleHotLead`) — keyword intent beli/daftar
13. Daily rate limit (`cekLimitHarian`) — per-user-per-day
14. AI fallback (`handleAI`) — Groq chat completions dengan SYSTEM_PROMPT natural

### Greeting handling

Bot otomatis deteksi sapaan seperti `halo`, `helo`, `selamat pagi`, `selamat siang`, `selamat malam` via FAQ keyword. Respon: sapaan + intro singkat YahyaEduFarm (agrowisata edukasi berbasis Masjid Ismuhu Yahya di Kalimantan Barat).

### Bot tone & persona (`config.js` — SYSTEM_PROMPT)

- Jawab seperti manusia asli, nada santai profesional
- Langsung ke pertanyaan, tanpa basa-basi
- Emoji secukupnya (maks 2/pesan) untuk kehangatan
- Bahasa Indonesia sehari-hari yang sopan, hindari kaku/formal
- Tidak mengulang info yang sudah jelas

### `client.on('message_create', ...)` — Admin commands (self-chat)

Hanya dari chat sendiri (self-chat), bukan dari chat dengan bot. Admin tidak mendapat welcome khusus saat chat ke nomor bot — diperlakukan seperti customer biasa.

**Control:** `!on`, `!off`, `!menu on/off`, `!status`, `!reset`, `!help`

**Handover:** `!selesai <nomor>`, `!limit`

### Handover / CS Manusia

Saat customer pilih menu *8 (Hubungi Admin)* atau ketik frasa seperti "admin", "cs", "hubungi admin", "mau bicara admin" (dideteksi via `utils.isAdminRequest`, dipakai sama persis baik di dalam maupun di luar jam kerja — lihat `bot.js`):
1. Admin dapat **2 notifikasi WA berturut-turut** → muncul push notification di HP (ada suara)
   - Notif #1 (singkat): `🔔 Customer minta CS! 👤 Nama ⏰ Waktu` — muncul di lock screen
   - Notif #2 (detail): Nama, nomor, waktu, riwayat chat terakhir
2. Customer direspon: **"Mohon tunggu, admin segera menghubungi Anda"**
3. User masuk `state.handoverUsers` → bot **berhenti total** membalas user tersebut (cuma 1x pesan tunggu di percobaan pertama, setelahnya diam) sampai admin jalankan `!selesai <nomor>`.

> Admin yang chat ke nomor bot dan mengetik "8"/frasa admin tidak mendapat notifikasi — hanya customer asli yang memicu notifikasi ke admin.

**FAQ Kustom:** `!faq list/add/hapus`, `!faqblast list/add/hapus`

**Donatur:** `!donor list/add/hapus/total`

**Blast & Groups:** `!groups` (list groups), `!blast <msg>` (send to all groups), `!blastjadwal [hari] HH:MM | <msg>` (schedule blast — tanpa `hari` = setiap hari; `hari` opsional pakai kode `sen/sel/rab/kam/jum/sab/min`, boleh gabung dengan koma mis. `jum,sab`), `!blastjadwallist`, `!blastjadwalhapus <id>`, `!blaststop`

### State

All in-memory with JSON persistence (`storage.js`): `chatHistory`, `userCooldown`, `handoverUsers`, `handoverWarned`, `userMessageCount`, `outOfHoursNotified`, `groupsCache`, `scheduledBlasts`, `customFAQ`, `customFAQBlasting`, `analytics`, `donors`, `blastHistory`, plus flags `botAktif`/`botMenu`/`handleHotLeadAktif`/`batasiPesanPerHari`.

### Blast scheduler

- `startScheduler()` — runs every 30s, checks `scheduledBlasts` array for matching `HH:MM` **dan** `days` (kode hari `sen..min`; array kosong/`undefined` = tiap hari, backward compatible dengan jadwal lama). Guard `_lastFired` (in-memory, per-item) mencegah blast terkirim dobel kalau interval tick 2x dalam menit yang sama.
- `executeBlast(msg, targetGroupIds?)` — sends message to groups (bisa filter), delay random 4-8 detik antar grup
- `refreshGroups()` — fetches latest group list from WhatsApp
- **Error resilience:** Retry otomatis 3x untuk `detached Frame` dan `Cannot read properties of null` errors. `_pageReportedDead` flag mencegah spam error ke console.

### Web UI (Express + Socket.io)

Embedded web server in `src/web/server.js`. Serves `src/web/public/index.html` + `style.css` + `app.js`.

**Socket.io events:**
- `state` (→ client) — full bot state on connect
- `status-update` (→ client) — bot/menu toggle changes
- `groups-update`, `schedules-update` (→ client) — real-time list updates
- `blast-progress`, `blast-complete` (→ client) — blast progress bar
- `faq-update`, `faq-blast-update` (→ client) — FAQ changes
- `donors-update` (→ client) — donor list changes
- `analytics-update` (→ client) — daily analytics
- `execute-blast` (← client) — trigger blast (with optional `targetGroups` array)
- `add-schedule`, `remove-schedule`, `toggle-schedule` (← client) — manage schedules

All state is shared between WhatsApp bot handlers and web UI via module-level variables.

## Key config (all in `src/js/config.js`)

- `SYSTEM_PROMPT` — bot persona, natural & conversational (bukan robot)
- `handleMenu` — 8 menu: 1=Tentang, 2=Produk, 3=Harga, 4=Masjid, 5=Testimoni, 6=Booking, 7=Promo, 8=Admin
- `MENU_TEXT` — menu ditampilkan via pesan terpisah (tidak nempel di jawaban AI)
- `hotKeywords` — phrases for hot-lead detection
- Toggles: `botAktif`, `handleHotLeadAktif`, `botMenu`, `batasiPesanPerHari`
- Limits: `MAX_HISTORY` (5), `MAX_PESAN_PER_HARI` (20), `MAX_CHARS_INPUT` (300), `jumlahPesanPertama` (1)
- `.env`: `GROQ_API_KEY`, `ADMIN_ID` (format `<number>@lid`), `GROQ_MODEL` (default: `llama-3.1-8b-instant`), `MAX_TOKENS` (default: 250, lebih besar = jawaban lebih panjang), `WEB_PORT` (default: 3000)
- Web UI login: email `owner@gmail.com` / password `owner123` (hardcoded di server.js)

## Module map

```
src/js/index.js       → Entry point, wires everything together
src/js/config.js      → Constants (prompts, limits, env vars)
src/js/state.js       → Shared mutable state + default FAQ (DM + Blasting)
src/js/storage.js     → JSON persistence for state
src/js/utils.js       → Pure helpers (history, spam, limits, business hours)
src/js/handlers.js    → Business logic (media, menu, FAQ, AI, handover, hot lead)
src/js/client.js      → WhatsApp client instance (LocalAuth)
src/js/bot.js         → Incoming message event + processMessage pipeline
src/js/commands.js    → Admin event (!on, !faq, !donor, !blast, etc.)
src/js/scheduler.js   → Blast execution + scheduling + retry on error
src/web/server.js     → Express + Socket.io web server
src/web/public/       → Web UI frontend (HTML, CSS, JS)
```

## Key design decisions

1. **No admin welcome in private chat** — Admin yang chat ke nomor bot tetap diperlakukan sebagai customer. Admin commands hanya dari self-chat (`message_create`).
2. **Menu tidak nempel di jawaban AI** — Menu dikirim sebagai pesan terpisah supaya percakapan lebih natural.
3. **SYSTEM_PROMPT santai & langsung** — Bot jawab kayak manusia, bukan paragraf panjang. Emoji secukupnya.
4. **FAQ dengan emoji profesional** — Semua FAQ DM (30 item) dan FAQ Blasting (26 item) pakai emoji dan format rapi.
5. **Greeting auto-detect** — `halo`/`helo`/`selamat pagi`/`siang`/`malam` langsung direspon dengan intro singkat.
6. **Error resilience** — Retry 3x untuk detached frame / null page errors di scheduler.

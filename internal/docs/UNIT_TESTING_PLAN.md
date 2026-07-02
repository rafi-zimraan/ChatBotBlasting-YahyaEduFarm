# Unit Testing Plan — GriyaIT Nusantara WhatsApp Bot

Dokumen ini adalah rencana kerja untuk membawa aplikasi ini dari "jalan di HP admin" menuju
aplikasi yang teruji, stabil, dan aman untuk dipakai orang lain (customer, donatur, admin)
setiap hari. Fokusnya dua hal yang diminta: (1) unit testing menyeluruh, (2) dua fitur baru —
notifikasi handover ke admin & penjadwalan blast per hari/jam — dites sampai benar-benar solid.

## 1. Kondisi saat ini (baseline)

Tidak ada test sama sekali (`package.json` tidak punya test runner/script). Semua verifikasi
selama ini manual lewat WhatsApp asli. Ini berisiko karena:
- `whatsapp-web.js`, Groq API, dan filesystem semuanya di-hit langsung tanpa mock → tidak ada
  cara cepat memverifikasi logic tanpa menyalakan bot beneran.
- State (`src/js/state.js`) adalah module-level singleton yang dibagi ke semua handler →
  gampang ada regresi diam-diam saat 1 fitur ditambah lalu fitur lain ikut berubah perilaku.
- Scheduler (`src/js/scheduler.js`) jalan tiap 30 detik lewat `setInterval` nyata → tidak
  ada cara mensimulasikan "jam 03:00 Jumat" tanpa test yang mengontrol waktu.

### Fitur yang sudah ada (jangan dibangun ulang)

**Handover ke admin** (`src/js/handlers.js:248-282`, dipakai di `src/js/bot.js:38-44, 90-96`):
- Trigger via menu `8` (saat `botMenu` aktif) mengirim **2 notifikasi WA berurutan** ke admin:
  notif pendek (muncul di lock screen) lalu notif detail (nama, nomor, waktu, riwayat chat).
- User yang sudah di-handover (`state.handoverUsers[id] = true`) dibalas sekali "Mohon tunggu,
  admin segera menghubungi Anda", lalu **bot benar-benar diam** untuk user itu sampai admin
  jalankan `!selesai <nomor>`.
- Admin sendiri (nomor yang cocok `ADMIN_ID`) tidak memicu notifikasi ke dirinya sendiri.

**Blast terjadwal** (`src/js/scheduler.js:215-238`, `src/js/commands.js:446-480`):
- `!blastjadwal HH:MM | <pesan>` menyimpan `{id, time, message, enabled}` ke
  `state.scheduledBlasts`, dicek tiap 30 detik, dieksekusi kalau `jadwal.time === currentTime`.
- Karena tidak ada guard "sudah jalan hari ini", jadwal cocok **setiap hari** tanpa filter
  tanggal. Membuat banyak jadwal jam berbeda (03:00, 04:00, 08:00) sudah bisa dilakukan
  sekarang dengan menambah beberapa entri `!blastjadwal`.

### Gap nyata yang perlu dibangun (bukan cuma didoku­mentasikan)

1. **Handover via bahasa natural saat jam kerja belum konsisten.** Di luar jam kerja,
   `bot.js:56-64` sudah mendeteksi frasa `hubungi admin|admin|cs|mau bicara admin|ingin
   hubungi admin` via regex dan langsung memicu `handleHandover`. Tapi **saat jam kerja
   normal**, jalur yang sama (`bot.js:86-97`) cuma cek `normalizedText === '8'` — ketik
   "mau bicara admin" secara bebas tidak memicu apa-apa dan jatuh ke FAQ/AI biasa. Ini
   harus disatukan supaya perilakunya konsisten kapan pun user memintanya.
2. **Blast belum bisa dijadwalkan per hari-dalam-minggu.** Skema `scheduledBlasts` cuma
   punya `time`, tidak ada `days` (mis. `['fri']`). Tidak mungkin membuat jadwal "hanya
   Jumat subuh" tanpa fitur baru — ini murni pekerjaan implementasi, bukan cuma testing.

> Rencana implementasi detail untuk 2 gap ini akan dibahas terpisah sebelum dikerjakan
> (perubahan skema `state.scheduledBlasts` menyentuh persistence, command parser, scheduler
> matcher, dan Web UI sekaligus). Dokumen ini fokus ke bagaimana keduanya **diuji**, baik
> versi lama yang sudah jalan maupun versi baru begitu dibangun.

## 2. Tooling

- **Test runner:** Jest (`ts-jest` tidak perlu karena project ini plain JS/CommonJS).
  Alternatif ringan: `node:test` bawaan Node 18+ — dipertimbangkan kalau ingin zero-dependency,
  tapi Jest dipilih karena mocking module (`jest.mock`) jauh lebih mudah untuk
  `whatsapp-web.js`, `groq-sdk`, dan `fs`.
- **Fake timers:** `jest.useFakeTimers()` untuk scheduler (simulasi hari/jam tanpa nunggu asli).
- **Test double untuk WhatsApp client:** buat `test/fakes/fakeClient.js` yang mengimplementasikan
  method yang benar-benar dipakai kode (`sendMessage`, `getChatById`, `getChats`) sebagai
  jest mock functions, supaya `handlers.js`/`scheduler.js` bisa diuji tanpa Puppeteer/Chromium.
- **Test double untuk Groq:** mock `groq-sdk` supaya `handleAI` bisa diuji tanpa API call asli.
- **Isolasi storage:** `storage.js` baca/tulis file JSON — di test, arahkan ke direktori temp
  (`os.tmpdir()`) per test run supaya tidak menyentuh `data/` asli dan tidak saling bentrok
  antar test.
- **Script:** tambah ke `package.json`:
  ```json
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
  ```

## 3. Struktur folder test

```
test/
  fakes/
    fakeClient.js       # WhatsApp client palsu (sendMessage, getChatById, getChats)
    fakeMessage.js       # Message palsu (reply(), getChat(), body, from, type, hasMedia)
    fakeGroq.js          # Groq client palsu
  unit/
    utils.test.js
    handlers.test.js
    state.test.js
    storage.test.js
    scheduler.test.js
    commands.test.js
  integration/
    handover-flow.test.js
    blast-schedule-flow.test.js
```

## 4. Rencana test per modul

### `src/js/utils.js` — prioritas tinggi, murni logic
- `isSpam`: dalam cooldown → true; setelah cooldown lewat → false; user berbeda tidak saling pengaruh.
- `isBusinessHours`: tepat di batas 08:00 dan 17:00 WITA (inclusive/exclusive sesuai kode),
  di luar rentang, timezone lain tidak mempengaruhi hasil (paksa `Asia/Makassar`).
- `cekLimitHarian`: di bawah limit → false; tepat di limit → true; reset di hari berikutnya.
- `addHistory`/`getHistory`: `MAX_HISTORY` dihormati (item lama terbuang), role user/assistant
  tersimpan urut.
- `normalize`, `cleanMention`, `isMentioned`: normalisasi teks & deteksi mention bot di grup.

### `src/js/handlers.js` — prioritas tinggi
- `handleMedia`: image tanpa caption → tolak dengan pesan spesifik; image+caption → diteruskan
  sebagai teks; tipe lain (video, dokumen, stiker) → tolak pesan default.
- `handleMenu`: tiap nomor 1-8 mengembalikan teks yang benar; nomor 4 memicu
  `client.sendMessage` ke admin (assert dipanggil tepat 1x dengan `ADMIN_ID`); input di luar
  1-8 → `null`.
- `handleCustomFAQ`: keyword match case-insensitive & substring; FAQ `enabled: false`
  diabaikan; tidak ada match → `null`.
- `handleHotLead`: semua `hotKeywords` memicu balasan; teks tanpa keyword → `null`.
- **`handleHandover`** (fokus fitur):
  - Bukan admin → `client.sendMessage` dipanggil **2 kali** ke `ADMIN_ID`, urutan: notif
    pendek dulu baru detail (assert isi & urutan panggilan lewat `mock.calls`).
  - Notif detail berisi nama, nomor, waktu (format Asia/Makassar), dan riwayat jika `pesan`
    diisi; riwayat kosong → baris riwayat tidak muncul.
  - Nomor == admin → `client.sendMessage` **tidak dipanggil sama sekali** ke admin.
  - `state.handoverUsers[nomor]` jadi `true` dan `handoverWarned[nomor]` di-reset `false`
    setiap kali dipanggil (termasuk saat dipanggil ulang).
  - Kegagalan `client.sendMessage` (reject) tidak melempar exception ke pemanggil — fungsi
    tetap resolve dengan pesan tunggu untuk user.
- `handleAI`: history user ditambah sebelum call, reply ditambah ke history setelah call,
  `chat.sendStateTyping`/`clearState` dipanggil tapi error di situ tidak menggagalkan reply.

### `src/js/bot.js` (`processMessage`) — prioritas tinggi, integration-style
- User di `blockedContacts` → tidak ada balasan sama sekali.
- User dalam `handoverUsers`: pesan pertama → 1x balasan "mohon tunggu"; pesan berikutnya →
  **tidak ada balasan** (`message.reply` tidak dipanggil).
- Di luar jam kerja: notifikasi out-of-hours cuma sekali per hari per user; kata kunci admin
  tetap memicu handover meski di luar jam kerja.
- **Saat jam kerja** (ini yang jadi regression test untuk gap #1 setelah diperbaiki): mengetik
  `"8"` **dan** mengetik frasa bebas seperti `"mau bicara admin"` / `"bisa gak ngobrol sama
  admin?"` sama-sama harus memicu `handleHandover` dan menghasilkan balasan tunggu — bukan
  cuma `"8"` yang persis.
- Urutan pipeline media → panjang teks → menu → FAQ → hot lead → limit harian → AI harus
  konsisten dengan urutan di `CLAUDE.md`; test tiap gate menang atas gate berikutnya (mis.
  FAQ match tidak pernah sampai ke AI/Groq).
- Limit harian: pas limit → pesan limit dikembalikan, `handleAI`/Groq **tidak** dipanggil.

### `src/js/scheduler.js` — prioritas tinggi
- `executeBlast`: kirim ke semua grup di `groupsCache` kalau `targetGroupIds` kosong; filter
  benar kalau diisi; delay antar grup ada (pakai fake timers, jangan nunggu asli); hasil
  `{sukses, gagal, total}` dihitung benar saat sebagian grup gagal kirim (`sendMessage` reject).
  `blastHistory` bertambah 1 entri dengan angka yang cocok.
- `retry`: error yang match `isRetryableError` (`detached Frame`, `Cannot read properties of
  null`) di-retry sampai 3x lalu berhasil di percobaan ke-2/3; error lain langsung dilempar
  tanpa retry.
- `startScheduler`/`stopScheduler`: dipanggil dua kali tidak membuat dua interval;
  `scheduledBlasts` kosong → tidak ada blast dieksekusi; `enabled: false` diabaikan.
- **Setelah fitur day-of-week dibangun** — matcher jadwal harus diuji dengan `jest.useFakeTimers()
  .setSystemTime(...)` untuk kombinasi:
  - Jadwal `days: ['fri']`, waktu sistem Jumat 03:00 → blast terpicu.
  - Jadwal sama, waktu sistem Kamis 03:00 → **tidak** terpicu.
  - Jadwal tanpa `days` (array kosong/`undefined`) → default ke "setiap hari" (backward
    compatible dengan jadwal lama yang tersimpan di `data/*.json` sebelum migrasi).
  - Tiga jadwal beda jam di hari yang sama (03:00, 04:00, 08:00) semua terpicu independen
    tanpa saling menimpa progress blast satu sama lain.
  - Jadwal terpicu 2x di menit yang sama tidak boleh double-fire (guard "sudah jalan hari
    ini + jam ini").

### `src/js/state.js` & `src/js/storage.js`
- `recordMsg`: kontak baru dibuat otomatis; `messages` dipotong di 150; `unread` naik hanya
  untuk pesan dari user (bukan bot).
- `saveData`: percakapan dipotong ke 300 kontak & 50 pesan/kontak sebelum ditulis ke disk;
  panggil `storage.save` dengan bentuk data yang benar (snapshot lewat `jest.spyOn`).
- `mergeDefaultFAQ`: FAQ tersimpan yang keyword-nya sudah ada tidak diduplikasi; FAQ default
  baru (nambah keyword baru di kode) otomatis masuk dengan id lanjutan, bukan menimpa id lama.
- `storage.load/save`: file rusak (JSON invalid) tidak men-crash boot — fallback ke default;
  direktori `data/` dibuat otomatis kalau belum ada (`storage.js` sudah difix untuk ini per
  commit `1b577ef`, cukup 1 test regresi).

### `src/js/commands.js`
- `!blastjadwal 08:00 | pesan` valid → entri baru masuk `scheduledBlasts`, ID increment benar.
- Format waktu invalid (`25:99`, `8:00`) → ditolak dengan pesan error, tidak masuk state.
- `!blastjadwalhapus <id>` — id tidak ada → pesan error; id ada → terhapus & `saveData` dipanggil.
- `!selesai <nomor>` — user tidak dalam handover → pesan "tidak dalam mode handover"; user
  dalam handover → dihapus dari `handoverUsers` **dan** `handoverWarned`.
- **Setelah fitur day-of-week**: `!blastjadwal jum 03:00,04:00,08:00 | pesan` (atau sintaks
  final yang dipilih) — parsing hari (Indo: `sen/sel/rab/kam/jum/sab/min` atau `setiap hari`)
  divalidasi, format salah → pesan error yang jelas menyebutkan contoh format benar.

### `src/web/server.js` — prioritas sedang
- Socket event `execute-blast` memanggil `scheduler.executeBlast` dengan `targetGroups` yang
  benar dari payload.
- `add-schedule`/`remove-schedule`/`toggle-schedule` mengubah `state.scheduledBlasts` dan
  broadcast `schedules-update` ke semua socket yang connect.
- Login hardcoded (`owner@gmail.com`/`owner123`) — test bahwa kredensial salah ditolak,
  session tidak dibuat.

## 5. Test yang sifatnya "manual tapi wajib" (tidak bisa di-unit-test)

Beberapa hal cuma bisa divalidasi dengan bot asli nyala + WhatsApp asli, dicatat di sini
supaya tidak lupa sebelum rilis:
- Push notification WA beneran muncul di lock screen HP admin (2 notifikasi berurutan)
  saat customer pilih menu 8 / ketik "mau bicara admin" — unit test cuma bisa pastikan
  `sendMessage` dipanggil, bukan bahwa notifikasi HP benar-benar bunyi.
- Jadwal blast Jumat subuh jam 03:00 sungguhan terkirim tanpa admin online (server harus
  tetap hidup jam segitu — cek proses `pm2`/systemd/dsb, bukan cakupan unit test).
- Retry `detached Frame` teruji lewat simulasi network putus/WhatsApp Web reload di device asli.

## 6. Roadmap bertahap

1. **Setup infra test** — install Jest, buat `test/fakes/*`, tambah script `npm test`,
   pastikan `jest --coverage` jalan walau baru 0 test nyata (smoke test dummy).
2. **Lapisan pure-logic** — `utils.js` full coverage duluan (paling gampang, paling banyak
   dipakai modul lain, paling murah di-test).
3. **Lapisan handler** — `handlers.js` dengan fake client & fake Groq, termasuk skenario
   `handleHandover` di atas.
4. **Lapisan pipeline** — `bot.js` (`processMessage`) integration-style, termasuk regression
   test untuk gap #1 (trigger handover konsisten jam kerja vs luar jam kerja) **setelah**
   perbaikan gap itu dikerjakan.
5. **Scheduler & state/storage** — `scheduler.js`, `state.js`, `storage.js` dengan fake
   timers dan temp dir, termasuk seluruh matriks day-of-week di atas **setelah** fitur itu
   dibangun.
6. **Commands & web server** — `commands.js`, `src/web/server.js` socket handlers.
7. **CI gate** — jalankan `npm test` di pre-commit/pre-push hook (atau GitHub Actions kalau
   repo di-push ke GitHub) supaya regresi ketahuan sebelum sampai ke bot produksi.

## 7. Definition of done (checklist kesiapan produksi)

- [ ] `npm test` hijau, coverage `utils.js` & `handlers.js` di atas ~85%.
- [ ] Gap #1 (trigger handover natural language saat jam kerja) sudah diperbaiki + ada test
      regresi yang gagal kalau baris pengecekannya dihapus lagi.
- [ ] Fitur day-of-week blast scheduling dibangun + ada test matcher untuk semua kombinasi
      hari/jam di atas.
- [ ] Migrasi `scheduledBlasts` lama (tanpa field `days`) tidak menghapus/merusak jadwal yang
      sudah tersimpan admin saat ini — dibuktikan dengan test "backward compatible".
- [ ] Checklist manual di bagian 5 sudah dicoba minimal sekali di device admin sungguhan
      sebelum dianggap selesai.

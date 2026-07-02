// Env dummy supaya config.js tidak process.exit(1) saat modul di-require di dalam test.
// Nilai ini TIDAK PERNAH dipakai untuk request asli — groq-sdk & WhatsApp client
// selalu di-mock (lihat jest.config.js moduleNameMapper).
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.ADMIN_ID = '628111111111@lid';
process.env.WEB_UI_EMAIL = 'test@example.com';
process.env.WEB_UI_PASSWORD = 'test-password';
process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
process.env.MAX_TOKENS = '250';

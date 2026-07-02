module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/test/setupEnv.js'],
    moduleNameMapper: {
        // Isolasi total dari WhatsApp client & storage asli — bot ini bisa jadi
        // sedang jalan nyata (terhubung ke WhatsApp beneran), jadi test TIDAK BOLEH
        // pernah menyentuh src/js/client.js atau data/data.json produksi.
        // Cakup SEMUA variasi require path yang benar-benar dipakai di source
        // (lihat grep di internal/docs/UNIT_TESTING_PLAN.md) — jangan andalkan satu pola saja.
        '^\\./client$': '<rootDir>/test/fakes/fakeClient.js',
        '^\\.\\./js/client$': '<rootDir>/test/fakes/fakeClient.js',
        '^\\./storage$': '<rootDir>/test/fakes/fakeStorage.js',
        '^groq-sdk$': '<rootDir>/test/fakes/fakeGroqSdk.js',
    },
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/fakes/'],
    collectCoverageFrom: ['src/js/**/*.js'],
};

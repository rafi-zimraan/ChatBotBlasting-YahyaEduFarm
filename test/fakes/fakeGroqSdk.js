// Pengganti package 'groq-sdk' selama test — tidak pernah memanggil Groq API asli.
// handlers.js melakukan `const groq = new Groq({ apiKey })` sekali saat modul di-require,
// jadi mock create() diekspos sebagai static supaya test bisa mengatur/assert dari luar
// tanpa perlu re-require handlers.js.
const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'balasan default dari fake groq' } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

class FakeGroq {
    constructor(opts) {
        this.opts = opts;
        this.chat = { completions: { create } };
    }
}

FakeGroq.__create = create;

module.exports = FakeGroq;

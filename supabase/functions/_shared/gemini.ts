/**
 * Provider Gemini — jalur gratis (free tier).
 *
 * Dipakai lewat REST langsung, bukan SDK, supaya Edge Function tetap ringan
 * dan cepat dingin-start. Gemini juga menerima input audio, jadi provider ini
 * sekaligus melayani fitur voice.
 *
 * Nama model bisa berubah seiring waktu; itu sebabnya diambil dari env
 * GEMINI_MODEL dan bukan ditanam keras di kode.
 */
import {
  buildParseSystemPrompt,
  buildParseUserPrompt,
  CHAT_SCHEMA_GEMINI,
  buildChatSystemPrompt,
  buildInsightSystemPrompt,
  type ChatResult,
  type ParsedTx,
  type PromptContext,
  type UserVoice,
} from './prompts.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function apiKey(): string {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY belum diset. Jalankan: supabase secrets set GEMINI_API_KEY=...',
    );
  }
  return key;
}

const model = () => Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';

/** Model yang lebih ringan bisa dipilih khusus untuk parsing lewat env. */
const parseModel = () => Deno.env.get('GEMINI_PARSE_MODEL') ?? model();

/**
 * Gemini memakai bagian OpenAPI, bukan JSON Schema penuh: tidak mengenal
 * `additionalProperties` maupun tipe gabungan ["string","null"]. Karena itu
 * skemanya ditulis terpisah, bukan hasil konversi otomatis yang rapuh.
 */
const GEMINI_TX_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transactions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['expense', 'income'] },
          amount: { type: 'NUMBER' },
          merchant: { type: 'STRING', nullable: true },
          note: { type: 'STRING', nullable: true },
          occurred_at: { type: 'STRING' },
          category_name: { type: 'STRING', nullable: true },
          category_is_new: { type: 'BOOLEAN' },
          account_name: { type: 'STRING', nullable: true },
          confidence: { type: 'NUMBER' },
        },
        required: [
          'kind', 'amount', 'merchant', 'note', 'occurred_at',
          'category_name', 'category_is_new', 'account_name', 'confidence',
        ],
      },
    },
  },
  required: ['transactions'],
};

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function call(body: unknown, modelName: string = model()): Promise<string> {
  const res = await fetch(`${ENDPOINT}/${modelName}:generateContent?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) {
      throw new Error('Kuota gratis Gemini habis untuk sementara. Coba lagi nanti, atau ketik manual.');
    }
    throw new Error(`Gemini menolak permintaan (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = await res.json() as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('').trim();
}

// ---------------------------------------------------------------------
// Parsing transaksi
// ---------------------------------------------------------------------

export async function geminiParse(text: string, ctx: PromptContext): Promise<ParsedTx[]> {
  const raw = await call({
    systemInstruction: { parts: [{ text: buildParseSystemPrompt(ctx) }] },
    contents: [{ role: 'user', parts: [{ text: buildParseUserPrompt(text, ctx) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_TX_SCHEMA,
      temperature: 0,
      // Mengurai kalimat menjadi kolom-kolom adalah tugas mekanis, bukan tugas
      // menalar. Membiarkan model "berpikir" dulu menambah belasan detik tanpa
      // membuat hasilnya lebih benar — dan input harian harus terasa instan.
      thinkingConfig: { thinkingLevel: 'low' },
    },
  }, parseModel());

  try {
    const parsed = JSON.parse(raw) as { transactions?: ParsedTx[] };
    return parsed.transactions ?? [];
  } catch {
    throw new Error('Jawaban AI tidak berbentuk data yang bisa dibaca. Coba tulis ulang kalimatnya.');
  }
}

// ---------------------------------------------------------------------
// Chat keuangan
// ---------------------------------------------------------------------

export async function geminiChat(
  question: string,
  dataSummary: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  voice: UserVoice,
): Promise<ChatResult> {
  const raw = await call({
    systemInstruction: { parts: [{ text: buildChatSystemPrompt(voice) }] },
    contents: [
      // Gemini memakai "model", bukan "assistant", untuk giliran balasan.
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user',
        parts: [{ text: `Data keuangan saya saat ini:\n${dataSummary}\n\nPesan: ${question}` }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: CHAT_SCHEMA_GEMINI,
      temperature: 0.3,
    },
  });

  try {
    const parsed = JSON.parse(raw) as ChatResult;
    return {
      type: parsed.type === 'amendment' && parsed.amendment ? 'amendment' : 'answer',
      answer: parsed.answer ?? null,
      amendment: parsed.amendment ?? null,
    };
  } catch {
    // Jawaban yang tidak berbentuk JSON masih berguna sebagai teks biasa,
    // jadi jangan dibuang begitu saja.
    return { type: 'answer', answer: raw, amendment: null };
  }
}

// ---------------------------------------------------------------------
// Narasi insight
// ---------------------------------------------------------------------

export async function geminiInsight(findingsJson: string, voice: UserVoice): Promise<string> {
  return await call({
    systemInstruction: { parts: [{ text: buildInsightSystemPrompt(voice) }] },
    contents: [
      { role: 'user', parts: [{ text: `Temuan minggu ini:\n${findingsJson}\n\nTulis ringkasannya.` }] },
    ],
    generationConfig: { temperature: 0.4 },
  });
}

// ---------------------------------------------------------------------
// Transkripsi suara
// ---------------------------------------------------------------------

export async function geminiTranscribe(audioBase64: string, mimeType: string): Promise<string> {
  return await call({
    systemInstruction: {
      parts: [{
        text: [
          'Kamu mentranskripsi rekaman suara berbahasa Indonesia menjadi teks.',
          'Keluarkan HANYA teksnya, tanpa tanda kutip dan tanpa penjelasan apa pun.',
          'Pertahankan angka dan satuan persis seperti yang diucapkan ("dua puluh lima ribu"',
          'boleh ditulis "25 ribu"). Bila rekaman tidak terdengar jelas, keluarkan string kosong.',
        ].join(' '),
      }],
    },
    contents: [{
      role: 'user',
      parts: [{ inlineData: { mimeType, data: audioBase64 } }],
    }],
    generationConfig: { temperature: 0 },
  });
}

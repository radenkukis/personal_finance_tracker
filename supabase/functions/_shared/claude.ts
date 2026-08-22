/**
 * Provider Claude (berbayar, kualitas terbaik untuk Bahasa Indonesia).
 *
 * Routing hemat: tugas mekanis memakai model kecil, tugas menulis memakai
 * model besar. Parsing kalimat adalah ekstraksi terstruktur — tidak butuh
 * penalaran dalam — sehingga Haiku sudah cukup dan jauh lebih murah.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import {
  buildParseSystemPrompt,
  buildParseUserPrompt,
  CHAT_SCHEMA_GEMINI,
  CHAT_SYSTEM_PROMPT,
  INSIGHT_SYSTEM_PROMPT,
  TRANSACTION_SCHEMA,
  type ChatResult,
  type ParsedTx,
  type PromptContext,
} from './prompts.ts';

const MODEL_PARSE = 'claude-haiku-4-5';
const MODEL_CHAT = 'claude-sonnet-5';
const MODEL_INSIGHT = 'claude-opus-5';

/**
 * Safety classifier bisa menolak sebuah permintaan (stop_reason "refusal").
 * `fallbacks: "default"` menyuruh server mengalihkannya ke model lain secara
 * otomatis, jadi user tidak melihat kegagalan. Bisa dimatikan lewat env
 * CLAUDE_DISABLE_FALLBACK=1 bila organisasimu belum punya akses beta ini.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const useFallback = () => Deno.env.get('CLAUDE_DISABLE_FALLBACK') !== '1';

function client(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY belum diset. Jalankan: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...',
    );
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------
// Parsing transaksi
// ---------------------------------------------------------------------

export async function claudeParse(text: string, ctx: PromptContext): Promise<ParsedTx[]> {
  const response = await client().messages.create({
    model: MODEL_PARSE,
    max_tokens: 2048,
    // Prompt stabil (daftar kategori & aturan) ditandai untuk cache; bagian
    // yang berubah tiap permintaan ada di pesan user, setelah titik cache.
    system: [
      {
        type: 'text',
        text: buildParseSystemPrompt(ctx),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildParseUserPrompt(text, ctx) }],
    tools: [
      {
        name: 'catat_transaksi',
        description: 'Mencatat transaksi yang berhasil diuraikan dari kalimat user.',
        strict: true,
        input_schema: TRANSACTION_SCHEMA as unknown as Anthropic.Tool['input_schema'],
      },
    ],
    // Dipaksa memakai tool supaya hasilnya selalu JSON valid, bukan prosa.
    tool_choice: { type: 'tool', name: 'catat_transaksi' },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Permintaan ditolak oleh filter keamanan. Coba tulis ulang dengan kalimat lain.');
  }

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      // Escaping JSON bisa berbeda antar model — selalu lewat parser resmi,
      // jangan pernah mencocokkan string mentah.
      const input = block.input as { transactions?: ParsedTx[] };
      return input.transactions ?? [];
    }
  }
  return [];
}

// ---------------------------------------------------------------------
// Chat keuangan
// ---------------------------------------------------------------------

export async function claudeChat(
  question: string,
  dataSummary: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<ChatResult> {
  const response = await client().messages.create({
    model: MODEL_CHAT,
    max_tokens: 1024,
    system: [
      { type: 'text', text: CHAT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    thinking: { type: 'adaptive' },
    // Pertanyaan tentang ringkasan angka tidak butuh penalaran mendalam.
    output_config: { effort: 'low' },
    messages: [
      ...history,
      { role: 'user', content: `Data keuangan saya saat ini:\n${dataSummary}\n\nPesan: ${question}` },
    ],
    tools: [
      {
        name: 'balas',
        description: 'Menjawab pertanyaan, atau mengusulkan perubahan satu transaksi.',
        input_schema: toJsonSchema(CHAT_SCHEMA_GEMINI) as unknown as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool', name: 'balas' },
  });

  if (response.stop_reason === 'refusal') {
    return {
      type: 'answer',
      answer: 'Maaf, pesan itu tidak bisa saya proses. Coba tanyakan soal pengeluaran atau budget kamu.',
      amendment: null,
    };
  }

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      const input = block.input as ChatResult;
      return {
        type: input.type === 'amendment' && input.amendment ? 'amendment' : 'answer',
        answer: input.answer ?? null,
        amendment: input.amendment ?? null,
      };
    }
  }
  return { type: 'answer', answer: textOf(response), amendment: null };
}

/**
 * Skema chat ditulis sekali dalam gaya OpenAPI milik Gemini; Claude memakai
 * JSON Schema biasa. Diterjemahkan di sini supaya aturannya tidak ditulis dua
 * kali dan tidak bisa berbeda diam-diam.
 */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (typeof node !== 'object' || node === null) return node;

  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(src)) {
    if (key === 'type' && typeof value === 'string') {
      const lower = value.toLowerCase();
      out.type = src.nullable === true ? [lower, 'null'] : lower;
    } else if (key === 'nullable') {
      continue;
    } else if (key === 'properties' || key === 'items') {
      out[key] = toJsonSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Narasi insight
// ---------------------------------------------------------------------

export async function claudeInsight(findingsJson: string): Promise<string> {
  const anthropic = client();

  const params = {
    model: MODEL_INSIGHT,
    max_tokens: 1024,
    system: [
      { type: 'text' as const, text: INSIGHT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
    ],
    thinking: { type: 'adaptive' as const },
    // Analisanya sudah selesai dihitung di HP; model hanya merangkai kalimat,
    // jadi effort rendah sudah memadai dan jauh lebih murah.
    output_config: { effort: 'low' as const },
    messages: [
      {
        role: 'user' as const,
        content: `Temuan minggu ini:\n${findingsJson}\n\nTulis ringkasannya.`,
      },
    ],
  };

  const response = useFallback()
    ? await anthropic.beta.messages.create({
        ...params,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      } as Parameters<typeof anthropic.beta.messages.create>[0])
    : await anthropic.messages.create(params);

  return textOf(response as { content: unknown[] });
}

// ---------------------------------------------------------------------
// Bantuan
// ---------------------------------------------------------------------

/** `content` adalah gabungan beberapa jenis blok — teksnya harus disaring. */
function textOf(response: { content: unknown[] }): string {
  return response.content
    .filter((b): b is { type: 'text'; text: string } =>
      typeof b === 'object' && b !== null && (b as { type?: string }).type === 'text',
    )
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Claude tidak menerima input audio — voice memakai provider STT terpisah. */
export function claudeSupportsAudio(): boolean {
  return false;
}

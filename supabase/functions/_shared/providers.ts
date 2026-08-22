/**
 * Pemilih provider AI.
 *
 * Seluruh sisa kode hanya memanggil fungsi di file ini, tidak pernah
 * memanggil Claude atau Gemini langsung. Berganti provider cukup dengan
 * mengubah satu secret di Supabase — tidak ada kode aplikasi yang berubah:
 *
 *   supabase secrets set LLM_PROVIDER=gemini GEMINI_API_KEY=...
 *   supabase secrets set LLM_PROVIDER=claude ANTHROPIC_API_KEY=...
 */
import { HttpError } from './http.ts';
import type { ChatResult, ParsedTx, PromptContext } from './prompts.ts';
import { claudeChat, claudeInsight, claudeParse } from './claude.ts';
import { geminiChat, geminiInsight, geminiParse, geminiTranscribe } from './gemini.ts';
import { groqTranscribe } from './groq.ts';

export type LlmProvider = 'local' | 'gemini' | 'claude';
export type SttProvider = 'off' | 'gemini' | 'groq';

export function llmProvider(): LlmProvider {
  const value = (Deno.env.get('LLM_PROVIDER') ?? 'local').toLowerCase();
  if (value === 'gemini' || value === 'claude') return value;
  return 'local';
}

export function sttProvider(): SttProvider {
  const value = (Deno.env.get('STT_PROVIDER') ?? 'off').toLowerCase();
  if (value === 'gemini' || value === 'groq') return value;
  return 'off';
}

/**
 * Mode 'local' berarti semua pekerjaan AI ditangani parser di HP. Kalau
 * function ini tetap terpanggil, itu tanda konfigurasi tidak sinkron —
 * lebih baik bilang terus terang daripada gagal diam-diam.
 */
function requireRemote(): Exclude<LlmProvider, 'local'> {
  const provider = llmProvider();
  if (provider === 'local') {
    throw new HttpError(
      'AI jarak jauh belum diaktifkan. Set LLM_PROVIDER=gemini atau claude di secret Supabase.',
      501,
    );
  }
  return provider;
}

export async function parseText(text: string, ctx: PromptContext): Promise<ParsedTx[]> {
  return requireRemote() === 'claude' ? await claudeParse(text, ctx) : await geminiParse(text, ctx);
}

export async function chat(
  question: string,
  dataSummary: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<ChatResult> {
  return requireRemote() === 'claude'
    ? await claudeChat(question, dataSummary, history)
    : await geminiChat(question, dataSummary, history);
}

export async function insight(findingsJson: string): Promise<string> {
  return requireRemote() === 'claude'
    ? await claudeInsight(findingsJson)
    : await geminiInsight(findingsJson);
}

/**
 * Claude tidak menerima input audio, jadi STT selalu punya provider sendiri
 * yang terpisah dari LLM_PROVIDER.
 */
export async function transcribe(audioBase64: string, mimeType: string): Promise<string> {
  const provider = sttProvider();
  if (provider === 'off') {
    throw new HttpError(
      'Fitur suara belum diaktifkan. Set STT_PROVIDER=gemini atau groq di secret Supabase.',
      501,
    );
  }
  return provider === 'groq'
    ? await groqTranscribe(audioBase64, mimeType)
    : await geminiTranscribe(audioBase64, mimeType);
}

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
import type { ChatResult, ParsedTx, PromptContext, UserVoice } from './prompts.ts';
/*
 * Claude dimuat saat dipakai saja, bukan lewat impor statis.
 *
 * claude.ts menarik SDK Anthropic dari npm. Dengan impor statis, SDK itu ikut
 * dimuat setiap kali fungsi bangun dingin — termasuk pada jalur Gemini yang
 * tidak menyentuhnya sama sekali. Biayanya dibayar setiap dingin-start, oleh
 * semua orang, untuk kode yang tidak dijalankan.
 */
const claude = () => import('./claude.ts');
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
  if (requireRemote() !== 'claude') return await geminiParse(text, ctx);
  return await (await claude()).claudeParse(text, ctx);
}

export async function chat(
  question: string,
  dataSummary: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  voice: UserVoice,
): Promise<ChatResult> {
  if (requireRemote() !== 'claude') return await geminiChat(question, dataSummary, history, voice);
  return await (await claude()).claudeChat(question, dataSummary, history, voice);
}

export async function insight(findingsJson: string, voice: UserVoice): Promise<string> {
  if (requireRemote() !== 'claude') return await geminiInsight(findingsJson, voice);
  return await (await claude()).claudeInsight(findingsJson, voice);
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

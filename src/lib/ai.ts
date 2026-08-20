/**
 * Lapisan AI sisi aplikasi.
 *
 * Aturan mainnya: coba parser lokal dulu, selalu. AI baru dipanggil kalau
 * parser lokal mengaku tidak sanggup. Untuk input sehari-hari seperti
 * "kopi 25rb" ini berarti nol panggilan jaringan, nol biaya, dan hasilnya
 * muncul seketika.
 */
import { callFunction } from '@/lib/supabase';
import { parseLocal } from '@/lib/localParser';
import type { Account, Category, DraftTransaction, TxSource } from '@/types/db';
import type { Finding } from '@/analytics/detectors';

export type AiMode = 'local' | 'remote';

/** 'local' = gratis 100%, tanpa API key. 'remote' = lewat Edge Function. */
export function aiMode(): AiMode {
  return process.env.EXPO_PUBLIC_AI_MODE === 'remote' ? 'remote' : 'local';
}

export interface ParseOutcome {
  drafts: DraftTransaction[];
  /** true bila hasilnya datang dari model, bukan dari regex di HP. */
  usedAI: boolean;
  /** Diisi bila ada bagian yang tidak terurai dan AI tidak tersedia. */
  warning: string | null;
}

interface RemoteTx {
  kind: 'expense' | 'income';
  amount: number;
  merchant: string | null;
  note: string | null;
  occurred_at: string;
  category_name: string | null;
  account_name: string | null;
  confidence: number;
}

export async function smartParse(
  text: string,
  categories: readonly Category[],
  accounts: readonly Account[],
  source: TxSource = 'ai_text',
): Promise<ParseOutcome> {
  const local = parseLocal(text, categories, accounts, new Date(), source);

  if (!local.needsAI) {
    return { drafts: local.drafts, usedAI: false, warning: null };
  }

  if (aiMode() === 'local') {
    return {
      drafts: local.drafts,
      usedAI: false,
      warning:
        local.drafts.length > 0
          ? `Sebagian tidak terbaca: "${local.unparsed.join('; ')}". Tambahkan sendiri, atau aktifkan AI di Pengaturan.`
          : 'Kalimatnya belum bisa dibaca mode gratis. Coba sebutkan nominalnya, misalnya "kopi 25rb".',
    };
  }

  try {
    // Teks utuh yang dikirim, bukan hanya potongan yang gagal — kata waktu
    // di awal kalimat ("kemarin ...") ikut menentukan seluruh potongan, dan
    // konteks itu hilang kalau dipotong-potong.
    const result = await callFunction<{ transactions: RemoteTx[] }>('ai-parse', {
      text,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const drafts = result.transactions.map<DraftTransaction>((t) => ({
      kind: t.kind,
      amount: t.amount,
      merchant: t.merchant,
      note: t.note,
      occurred_at: t.occurred_at,
      category_name: t.category_name,
      account_name: t.account_name,
      confidence: t.confidence,
      source,
      raw_input: text,
    }));

    return { drafts, usedAI: true, warning: null };
  } catch (e) {
    // AI gagal bukan alasan kehilangan yang sudah berhasil diurai lokal.
    return {
      drafts: local.drafts,
      usedAI: false,
      warning:
        local.drafts.length > 0
          ? `AI tidak bisa dihubungi, jadi sebagian mungkin terlewat. (${messageOf(e)})`
          : `AI tidak bisa dihubungi. ${messageOf(e)}`,
    };
  }
}

/** Rekaman suara -> teks -> parser yang sama seperti jalur ketik. */
export async function transcribeAudio(base64: string, mimeType: string): Promise<string> {
  const result = await callFunction<{ text: string }>('ai-transcribe', {
    audio: base64,
    mimeType,
  });
  return result.text;
}

export async function askQuestion(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const result = await callFunction<{ answer: string }>('ai-chat', { question, history });
  return result.answer;
}

export async function summarizeFindings(findings: readonly Finding[]): Promise<string> {
  const result = await callFunction<{ summary: string }>('ai-insight', {
    findings: findings.slice(0, 8),
  });
  return result.summary;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Kesalahan tidak diketahui.';
}

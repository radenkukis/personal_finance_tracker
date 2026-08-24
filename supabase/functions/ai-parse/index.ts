/**
 * POST /functions/v1/ai-parse
 * Body: { text: string, timezone?: string }
 *
 * Mengubah kalimat bebas menjadi transaksi terstruktur. Dipanggil HANYA bila
 * parser lokal di HP menyerah — jadi sebagian besar input tidak pernah
 * sampai ke sini dan tidak memakan kuota.
 */
import { fail, json, serveAuthed } from '../_shared/http.ts';
import { llmProvider, parseText } from '../_shared/providers.ts';
import type { PromptContext } from '../_shared/prompts.ts';
import { readVoice } from '../_shared/voice.ts';
import { shownCategoryName } from '../_shared/categoryNames.ts';

/** Batas panjang input: menjaga biaya dan menghalangi penyalahgunaan. */
const MAX_INPUT_CHARS = 1_000;

/** Ukuran prompt ikut dilaporkan — penyebab lambat paling sering di sini. */
interface CategoryRow {
  name: string;
  kind: string;
  slug: string | null;
}

function buildSize(ctx: PromptContext): number {
  return (
    ctx.categories.length * 20 +
    ctx.accounts.join('').length +
    ctx.knownMerchants.join('').length +
    ctx.corrections.map((c) => c.raw_input + c.correct_category).join('').length
  );
}

Deno.serve(serveAuthed(async (req, ctx) => {
  const body = await req.json().catch(() => null) as { text?: string; timezone?: string } | null;
  const text = body?.text?.trim();

  if (!text) return fail('Teks tidak boleh kosong.');
  if (text.length > MAX_INPUT_CHARS) {
    return fail(`Teks terlalu panjang (maksimal ${MAX_INPUT_CHARS} karakter).`);
  }

  const tDb = Date.now();
  const [categories, accounts, corrections, merchants, voice] = await Promise.all([
    ctx.db.from('categories').select('name, kind, slug').order('sort_order'),
    ctx.db.from('accounts').select('name').eq('is_archived', false),
    // Koreksi terbaru dipakai sebagai contoh few-shot supaya tebakan
    // kategori makin mengikuti kebiasaan user ini.
    ctx.db
      .from('ai_corrections')
      .select('raw_input, correct_category')
      .order('created_at', { ascending: false })
      .limit(15),
    // Nama tempat yang sudah dipakai, sebagai acuan ejaan bagi model.
    ctx.db
      .from('transactions')
      .select('merchant')
      .not('merchant', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(200),
    readVoice(ctx.db),
  ]);

  // Dedup dengan mempertahankan ejaan yang paling baru dipakai.
  const seen = new Set<string>();
  const knownMerchants: string[] = [];
  for (const row of (merchants.data ?? []) as { merchant: string | null }[]) {
    const name = row.merchant?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    knownMerchants.push(name);
  }

  const dbMs = Date.now() - tDb;

  const promptContext: PromptContext = {
    ...voice,
    /*
     * Nama kategori dikirim dalam bahasa user, bukan sebagaimana tersimpan.
     * Model lalu menjawab memakai nama yang benar-benar dilihat user di
     * layar, dan aplikasi memetakannya kembali ke baris aslinya lewat slug.
     */
    categories: ((categories.data ?? []) as CategoryRow[]).map((c) => ({
      name: shownCategoryName(c, voice.language),
      kind: c.kind,
    })),
    accounts: (accounts.data ?? []).map((a: { name: string }) => a.name),
    corrections: corrections.data ?? [],
    knownMerchants,
    nowISO: new Date().toISOString(),
    timezone: body?.timezone ?? 'Asia/Jakarta',
  };

  const tAi = Date.now();
  const transactions = await parseText(text, promptContext);
  const aiMs = Date.now() - tAi;

  // Waktu tiap tahap ikut dikirim supaya pelambatan bisa ditelusuri tanpa
  // menebak-nebak: berapa lama ambil data, berapa lama model menjawab.
  return json({
    transactions,
    provider: llmProvider(),
    timing: { dbMs, aiMs, promptChars: buildSize(promptContext) },
  });
}));

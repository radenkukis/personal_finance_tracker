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

/** Batas panjang input: menjaga biaya dan menghalangi penyalahgunaan. */
const MAX_INPUT_CHARS = 1_000;

Deno.serve(serveAuthed(async (req, ctx) => {
  const body = await req.json().catch(() => null) as { text?: string; timezone?: string } | null;
  const text = body?.text?.trim();

  if (!text) return fail('Teks tidak boleh kosong.');
  if (text.length > MAX_INPUT_CHARS) {
    return fail(`Teks terlalu panjang (maksimal ${MAX_INPUT_CHARS} karakter).`);
  }

  const [categories, accounts, corrections, merchants] = await Promise.all([
    ctx.db.from('categories').select('name, kind').order('sort_order'),
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

  const promptContext: PromptContext = {
    categories: categories.data ?? [],
    accounts: (accounts.data ?? []).map((a: { name: string }) => a.name),
    corrections: corrections.data ?? [],
    knownMerchants,
    nowISO: new Date().toISOString(),
    timezone: body?.timezone ?? 'Asia/Jakarta',
  };

  const transactions = await parseText(text, promptContext);

  return json({ transactions, provider: llmProvider() });
}));

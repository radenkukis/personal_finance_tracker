/**
 * POST /functions/v1/ai-chat
 * Body: { question: string, history?: {role, content}[] }
 *
 * Menjawab pertanyaan keuangan memakai data user.
 *
 * Yang dikirim ke model adalah RINGKASAN ANGKA, bukan seluruh transaksi
 * mentah. Dua alasannya: biaya token turun drastis, dan data pribadi yang
 * keluar dari server jadi jauh lebih sedikit.
 */
import { fail, json, serveAuthed, type AuthedContext } from '../_shared/http.ts';
import { chat, llmProvider } from '../_shared/providers.ts';
import { readVoice } from '../_shared/voice.ts';
import { shownCategoryName } from '../_shared/categoryNames.ts';
import type { UserVoice } from '../_shared/prompts.ts';

const MAX_QUESTION_CHARS = 500;
const MAX_HISTORY_TURNS = 6;

interface TxRow {
  id: string;
  amount: number;
  kind: string;
  occurred_at: string;
  merchant: string | null;
  note: string | null;
  categories: { name: string; slug: string | null } | null;
}

/** Sebanyak ini transaksi terbaru dikirim berikut id-nya, agar bisa diubah. */
const AMENDABLE_LIMIT = 25;

Deno.serve(serveAuthed(async (req, ctx) => {
  const body = await req.json().catch(() => null) as {
    question?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  } | null;

  const question = body?.question?.trim();
  if (!question) return fail('Pertanyaan tidak boleh kosong.');
  if (question.length > MAX_QUESTION_CHARS) {
    return fail(`Pertanyaan terlalu panjang (maksimal ${MAX_QUESTION_CHARS} karakter).`);
  }

  // Dibaca sekali, dipakai dua kali: untuk menamai kategori di ringkasan,
  // dan untuk menentukan bahasa jawaban model.
  const voice = await readVoice(ctx.db);
  const summary = await buildSummary(ctx, voice);
  const history = (body?.history ?? []).slice(-MAX_HISTORY_TURNS);

  const result = await chat(question, summary, history, voice);

  return json({
    answer: result.answer,
    amendment: result.amendment,
    type: result.type,
    provider: llmProvider(),
  });
}));

/**
 * Ringkasan yang cukup untuk menjawab hampir semua pertanyaan sehari-hari,
 * tapi tetap ringkas: total per kategori dua bulan terakhir, budget, dan
 * beberapa transaksi terbesar sebagai contoh konkret.
 */
async function buildSummary(ctx: AuthedContext, voice: UserVoice): Promise<string> {
  /** Nama kategori sebagaimana user melihatnya di layar. */
  const cat = (row: TxRow) =>
    row.categories ? shownCategoryName(row.categories, voice.language) : null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [txResult, budgetResult, profileResult] = await Promise.all([
    ctx.db
      .from('transactions')
      .select('id, amount, kind, occurred_at, merchant, note, categories(name, slug)')
      .gte('occurred_at', prevStart.toISOString())
      .order('occurred_at', { ascending: false }),
    ctx.db.from('budgets').select('amount, categories(name)').eq('period', dateOnly(monthStart)),
    ctx.db.from('profiles').select('payday_day, monthly_income').maybeSingle(),
  ]);

  const rows = (txResult.data ?? []) as unknown as TxRow[];
  const thisMonth = rows.filter((t) => new Date(t.occurred_at) >= monthStart);
  const lastMonth = rows.filter((t) => new Date(t.occurred_at) < monthStart);

  const lines: string[] = [
    `Tanggal hari ini: ${now.toISOString().slice(0, 10)}.`,
    `Tanggal gajian: setiap tanggal ${profileResult.data?.payday_day ?? 25}.`,
    '',
    '== BULAN INI ==',
    ...summarize(thisMonth, cat),
    '',
    '== BULAN LALU ==',
    ...summarize(lastMonth, cat),
  ];

  const budgets = (budgetResult.data ?? []) as unknown as
    { amount: number; categories: { name: string } | null }[];
  if (budgets.length > 0) {
    const spent = totalsByCategory(thisMonth, cat);
    lines.push('', '== BUDGET BULAN INI ==');
    for (const b of budgets) {
      const name = b.categories
        ? shownCategoryName(b.categories, voice.language)
        : '(tanpa kategori)';
      lines.push(`${name}: budget ${b.amount}, terpakai ${spent.get(name) ?? 0}`);
    }
  }

  /*
   * Daftar berikut membawa id, dan itulah satu-satunya sumber id yang boleh
   * dipakai model saat mengusulkan perubahan. Tanpa daftar ini model akan
   * mengarang id dan perubahannya menunjuk transaksi yang tidak ada.
   */
  const amendable = rows.slice(0, AMENDABLE_LIMIT);
  if (amendable.length > 0) {
    lines.push('', '== TRANSAKSI TERBARU (pakai id ini bila diminta mengubah) ==');
    for (const t of amendable) {
      const label = t.merchant ?? t.note ?? cat(t) ?? 'tanpa nama';
      lines.push(
        `id=${t.id} | ${t.occurred_at.slice(0, 10)} | ${label} | ` +
          `${cat(t) ?? 'tanpa kategori'} | ${t.kind} | ${t.amount}` +
          (t.note && t.merchant ? ` | catatan: ${t.note}` : ''),
      );
    }
  }

  const biggest = [...thisMonth]
    .filter((t) => t.kind === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  if (biggest.length > 0) {
    lines.push('', '== PENGELUARAN TERBESAR BULAN INI ==');
    for (const t of biggest) {
      const label = t.merchant ?? cat(t) ?? 'tanpa nama';
      lines.push(`${t.occurred_at.slice(0, 10)} · ${label} · ${t.amount}`);
    }
  }

  lines.push('', 'Semua nominal dalam rupiah.');
  return lines.join('\n');
}

/** `cat` menamai kategori sebagaimana user melihatnya, bukan sebagaimana tersimpan. */
function summarize(rows: readonly TxRow[], cat: (r: TxRow) => string | null): string[] {
  const income = rows.filter((t) => t.kind === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const expense = rows.filter((t) => t.kind === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  const byCategory = totalsByCategory(rows, cat);
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return [
    `Total masuk: ${income}`,
    `Total keluar: ${expense}`,
    `Jumlah transaksi: ${rows.length}`,
    'Pengeluaran per kategori:',
    ...sorted.map(([name, total]) => `  - ${name}: ${total}`),
  ];
}

function totalsByCategory(
  rows: readonly TxRow[],
  cat: (r: TxRow) => string | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of rows) {
    if (t.kind !== 'expense') continue;
    const name = cat(t) ?? 'Tanpa kategori';
    out.set(name, (out.get(name) ?? 0) + Number(t.amount));
  }
  return out;
}

function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

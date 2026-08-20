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

const MAX_QUESTION_CHARS = 500;
const MAX_HISTORY_TURNS = 6;

interface TxRow {
  amount: number;
  kind: string;
  occurred_at: string;
  merchant: string | null;
  categories: { name: string } | null;
}

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

  const summary = await buildSummary(ctx);
  const history = (body?.history ?? []).slice(-MAX_HISTORY_TURNS);

  const answer = await chat(question, summary, history);

  return json({ answer, provider: llmProvider() });
}));

/**
 * Ringkasan yang cukup untuk menjawab hampir semua pertanyaan sehari-hari,
 * tapi tetap ringkas: total per kategori dua bulan terakhir, budget, dan
 * beberapa transaksi terbesar sebagai contoh konkret.
 */
async function buildSummary(ctx: AuthedContext): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [txResult, budgetResult, profileResult] = await Promise.all([
    ctx.db
      .from('transactions')
      .select('amount, kind, occurred_at, merchant, categories(name)')
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
    ...summarize(thisMonth),
    '',
    '== BULAN LALU ==',
    ...summarize(lastMonth),
  ];

  const budgets = (budgetResult.data ?? []) as unknown as
    { amount: number; categories: { name: string } | null }[];
  if (budgets.length > 0) {
    const spent = totalsByCategory(thisMonth);
    lines.push('', '== BUDGET BULAN INI ==');
    for (const b of budgets) {
      const name = b.categories?.name ?? '(tanpa kategori)';
      lines.push(`${name}: budget ${b.amount}, terpakai ${spent.get(name) ?? 0}`);
    }
  }

  const biggest = [...thisMonth]
    .filter((t) => t.kind === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  if (biggest.length > 0) {
    lines.push('', '== PENGELUARAN TERBESAR BULAN INI ==');
    for (const t of biggest) {
      const label = t.merchant ?? t.categories?.name ?? 'tanpa nama';
      lines.push(`${t.occurred_at.slice(0, 10)} · ${label} · ${t.amount}`);
    }
  }

  lines.push('', 'Semua nominal dalam rupiah.');
  return lines.join('\n');
}

function summarize(rows: readonly TxRow[]): string[] {
  const income = rows.filter((t) => t.kind === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const expense = rows.filter((t) => t.kind === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  const byCategory = totalsByCategory(rows);
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return [
    `Total masuk: ${income}`,
    `Total keluar: ${expense}`,
    `Jumlah transaksi: ${rows.length}`,
    'Pengeluaran per kategori:',
    ...sorted.map(([name, total]) => `  - ${name}: ${total}`),
  ];
}

function totalsByCategory(rows: readonly TxRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of rows) {
    if (t.kind !== 'expense') continue;
    const name = t.categories?.name ?? 'Tanpa kategori';
    out.set(name, (out.get(name) ?? 0) + Number(t.amount));
  }
  return out;
}

function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

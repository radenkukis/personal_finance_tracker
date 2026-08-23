/**
 * Deteksi pola: langganan berulang, lonjakan, kategori yang membengkak,
 * dan budget yang lajunya bakal jebol.
 *
 * Semuanya statistik deterministik — tidak memanggil AI. Hasilnya berupa
 * daftar `Finding` yang sudah bisa langsung ditampilkan apa adanya. AI
 * belakangan hanya mengubah kumpulan Finding ini menjadi narasi mingguan,
 * sehingga satu panggilan AI per minggu sudah cukup.
 */
import { daysBetween, dayKey, rupiah, rupiahCompact, startOfDay } from '@/lib/format';
import { median, stdev, sum } from './projection';
import { en, interpolate, type Dictionary } from '@/lib/i18n';

/**
 * Cara temuan dikalimatkan disuntikkan dari luar, bukan ditulis di dalam
 * detektor. Dua alasan, dan keduanya penting:
 *
 *   - nominalnya harus ikut mata uang pilihan user;
 *   - kalimatnya harus ikut bahasa pilihan user.
 *
 * Yang dihitung detektor tetap sama untuk siapa pun; hanya bungkus katanya
 * yang berbeda. Nilai bawaan disediakan supaya unit test bisa memanggil
 * detektor tanpa menyiapkan apa pun.
 */
export interface MoneyFormat {
  money: (amount: number) => string;
  compact: (amount: number) => string;
  /** Pola kalimat temuan, biasanya `dictionary.findings`. */
  text?: Dictionary['findings'];
}

const RUPIAH: MoneyFormat = { money: rupiah, compact: rupiahCompact };

/** Pola kalimat yang berlaku, dengan cadangan bahasa Inggris. */
function phrases(fmt: MoneyFormat): Dictionary['findings'] {
  return fmt.text ?? en.findings;
}

export interface TxPoint {
  id: string;
  amount: number;
  occurred_at: string;
  kind: 'expense' | 'income' | 'transfer';
  merchant: string | null;
  category_name: string | null;
}

export type FindingKind =
  | 'recurring'
  | 'spike'
  | 'category_surge'
  | 'budget_risk'
  | 'budget_over';

export interface Finding {
  kind: FindingKind;
  severity: 'info' | 'warning' | 'danger' | 'good';
  /** Kalimat siap tampil, tanpa perlu AI. */
  title: string;
  detail: string;
  /** Angka mentah — dikirim ke AI supaya narasinya akurat, bukan mengarang. */
  data: Record<string, string | number>;
}

// ---------------------------------------------------------------------
// 1. Langganan berulang
// ---------------------------------------------------------------------

export interface Recurring {
  merchant: string;
  typicalAmount: number;
  dayOfMonth: number;
  occurrences: number;
  lastDate: Date;
}

/**
 * Sebuah pengeluaran dianggap langganan bila muncul di >= 3 bulan berbeda,
 * dengan nominal mirip (dalam 20% dari median) dan tanggal yang berdekatan
 * (sebaran <= 6 hari). Tiga syarat sekaligus supaya belanja bulanan biasa
 * seperti "Indomaret" tidak ikut terjaring.
 */
export function detectRecurring(txs: readonly TxPoint[], now: Date = new Date()): Recurring[] {
  const groups = new Map<string, TxPoint[]>();

  for (const t of txs) {
    if (t.kind !== 'expense' || !t.merchant) continue;
    const key = normalizeMerchant(t.merchant);
    if (key.length < 3) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(t);
    else groups.set(key, [t]);
  }

  const out: Recurring[] = [];

  for (const [, items] of groups) {
    if (items.length < 3) continue;

    const months = new Set(items.map((t) => t.occurred_at.slice(0, 7)));
    if (months.size < 3) continue;

    const amounts = items.map((t) => t.amount);
    const typical = median(amounts);
    if (typical <= 0) continue;
    const consistent = amounts.every((a) => Math.abs(a - typical) / typical <= 0.2);
    if (!consistent) continue;

    const dates = items.map((t) => new Date(t.occurred_at));
    const doms = dates.map((d) => d.getDate());
    if (spread(doms) > 6) continue;

    // Hanya laporkan yang masih aktif — langganan yang sudah lama berhenti
    // bukan informasi berguna.
    const last = new Date(Math.max(...dates.map((d) => d.getTime())));
    if (daysBetween(last, now) > 45) continue;

    out.push({
      merchant: items[0]!.merchant!,
      typicalAmount: typical,
      dayOfMonth: Math.round(median(doms)),
      occurrences: items.length,
      lastDate: last,
    });
  }

  return out.sort((a, b) => b.typicalAmount - a.typicalAmount);
}

export function recurringFindings(
  list: readonly Recurring[],
  fmt: MoneyFormat = RUPIAH,
): Finding[] {
  if (list.length === 0) return [];

  const t = phrases(fmt);
  const monthlyTotal = sum(list.map((r) => r.typicalAmount));
  return [
    {
      kind: 'recurring',
      severity: 'info',
      title: interpolate(t.recurringTitle, { count: list.length }),
      detail: interpolate(t.recurringDetail, {
        amount: fmt.money(monthlyTotal),
        list: list.map((r) => `${r.merchant} (${r.dayOfMonth})`).join(', '),
      }),
      data: {
        jumlah: list.length,
        total_bulanan: Math.round(monthlyTotal),
        daftar: list.map((r) => `${r.merchant}=${Math.round(r.typicalAmount)}@${r.dayOfMonth}`).join('|'),
      },
    },
  ];
}

// ---------------------------------------------------------------------
// 2. Lonjakan harian
// ---------------------------------------------------------------------

/**
 * Hari ini dianggap melonjak bila melewati rata-rata + 2 simpangan baku
 * dari 30 hari terakhir. Ambang absolut Rp 50.000 mencegah notifikasi
 * berisik pada orang yang pengeluaran hariannya kecil.
 */
export function detectSpike(
  txs: readonly TxPoint[],
  now: Date = new Date(),
  fmt: MoneyFormat = RUPIAH,
): Finding[] {
  const expenses = txs.filter((t) => t.kind === 'expense');
  if (expenses.length < 10) return [];

  const todayKey = dayKey(now);
  const cutoff = startOfDay(new Date(now.getTime() - 30 * 86_400_000));

  const byDay = new Map<string, number>();
  for (const t of expenses) {
    const d = new Date(t.occurred_at);
    if (d < cutoff) continue;
    const k = dayKey(d);
    byDay.set(k, (byDay.get(k) ?? 0) + t.amount);
  }

  const todayTotal = byDay.get(todayKey) ?? 0;
  const history = [...byDay.entries()].filter(([k]) => k !== todayKey).map(([, v]) => v);
  if (history.length < 7 || todayTotal < 50_000) return [];

  const mean = sum(history) / history.length;
  const sd = stdev(history);
  const threshold = mean + 2 * sd;
  if (sd === 0 || todayTotal <= threshold) return [];

  const times = mean > 0 ? todayTotal / mean : 0;
  return [
    {
      kind: 'spike',
      severity: 'warning',
      title: interpolate(phrases(fmt).spikeTitle, { times: times.toFixed(1) }),
      detail: interpolate(phrases(fmt).spikeDetail, {
        amount: fmt.money(todayTotal),
        average: fmt.compact(mean),
      }),
      data: {
        hari_ini: Math.round(todayTotal),
        rata_rata_harian: Math.round(mean),
        kelipatan: Number(times.toFixed(2)),
      },
    },
  ];
}

// ---------------------------------------------------------------------
// 3. Kategori membengkak
// ---------------------------------------------------------------------

/**
 * Membandingkan 7 hari terakhir dengan rata-rata 3 minggu sebelumnya,
 * per kategori. Butuh kenaikan >= 40% DAN selisih nyata >= Rp 50.000 supaya
 * kategori bernilai kecil tidak memicu peringatan hanya karena persentase.
 */
export function detectCategorySurge(
  txs: readonly TxPoint[],
  now: Date = new Date(),
  fmt: MoneyFormat = RUPIAH,
): Finding[] {
  const weekMs = 7 * 86_400_000;
  const thisWeekStart = new Date(now.getTime() - weekMs);
  const baselineStart = new Date(now.getTime() - 4 * weekMs);

  const current = new Map<string, number>();
  const baseline = new Map<string, number>();

  for (const t of txs) {
    if (t.kind !== 'expense' || !t.category_name) continue;
    const d = new Date(t.occurred_at);
    if (d >= thisWeekStart && d <= now) {
      current.set(t.category_name, (current.get(t.category_name) ?? 0) + t.amount);
    } else if (d >= baselineStart && d < thisWeekStart) {
      baseline.set(t.category_name, (baseline.get(t.category_name) ?? 0) + t.amount);
    }
  }

  const out: Finding[] = [];
  for (const [category, now7] of current) {
    const prior3Weeks = baseline.get(category) ?? 0;
    if (prior3Weeks <= 0) continue;

    const priorWeekly = prior3Weeks / 3;
    const diff = now7 - priorWeekly;
    const pct = (diff / priorWeekly) * 100;

    if (pct < 40 || diff < 50_000) continue;

    out.push({
      kind: 'category_surge',
      severity: pct >= 100 ? 'danger' : 'warning',
      title: interpolate(phrases(fmt).surgeTitle, { category, percent: Math.round(pct) }),
      detail: interpolate(phrases(fmt).surgeDetail, {
        amount: fmt.money(now7),
        average: fmt.compact(priorWeekly),
      }),
      data: {
        kategori: category,
        minggu_ini: Math.round(now7),
        rata_rata_mingguan: Math.round(priorWeekly),
        kenaikan_persen: Math.round(pct),
      },
    });
  }

  return out.sort((a, b) => Number(b.data.kenaikan_persen) - Number(a.data.kenaikan_persen));
}

// ---------------------------------------------------------------------
// 4. Budget
// ---------------------------------------------------------------------

export interface BudgetStatus {
  categoryName: string;
  budget: number;
  spent: number;
  /** Perkiraan total akhir bulan bila laju sekarang diteruskan. */
  projected: number;
  ratio: number;
}

export function evaluateBudgets(
  budgets: readonly { category_name: string; amount: number }[],
  spentByCategory: ReadonlyMap<string, number>,
  now: Date = new Date(),
): BudgetStatus[] {
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.max(1, now.getDate());

  return budgets.map((b) => {
    const spent = spentByCategory.get(b.category_name) ?? 0;
    const projected = (spent / elapsed) * dim;
    return {
      categoryName: b.category_name,
      budget: b.amount,
      spent,
      projected,
      ratio: b.amount > 0 ? spent / b.amount : 0,
    };
  });
}

export function budgetFindings(
  statuses: readonly BudgetStatus[],
  fmt: MoneyFormat = RUPIAH,
): Finding[] {
  const t = phrases(fmt);
  const out: Finding[] = [];

  for (const s of statuses) {
    if (s.budget <= 0) continue;

    if (s.spent > s.budget) {
      out.push({
        kind: 'budget_over',
        severity: 'danger',
        title: interpolate(t.budgetOverTitle, { category: s.categoryName }),
        detail: interpolate(t.budgetOverDetail, {
          spent: fmt.money(s.spent),
          budget: fmt.money(s.budget),
        }),
        data: {
          kategori: s.categoryName,
          budget: Math.round(s.budget),
          terpakai: Math.round(s.spent),
          kelebihan: Math.round(s.spent - s.budget),
        },
      });
    } else if (s.projected > s.budget * 1.05) {
      out.push({
        kind: 'budget_risk',
        severity: 'warning',
        title: interpolate(t.budgetRiskTitle, { category: s.categoryName }),
        detail: interpolate(t.budgetRiskDetail, {
          spent: fmt.money(s.spent),
          budget: fmt.money(s.budget),
          projected: fmt.compact(s.projected),
        }),
        data: {
          kategori: s.categoryName,
          budget: Math.round(s.budget),
          terpakai: Math.round(s.spent),
          proyeksi: Math.round(s.projected),
        },
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------
// Gabungan
// ---------------------------------------------------------------------

/**
 * Menjalankan seluruh detektor dan mengurutkan hasilnya dari yang paling
 * mendesak. Dashboard hanya menampilkan beberapa teratas supaya tidak ramai.
 */
export function runDetectors(
  txs: readonly TxPoint[],
  budgets: readonly { category_name: string; amount: number }[],
  spentByCategory: ReadonlyMap<string, number>,
  now: Date = new Date(),
  fmt: MoneyFormat = RUPIAH,
): Finding[] {
  const findings = [
    ...budgetFindings(evaluateBudgets(budgets, spentByCategory, now), fmt),
    ...detectSpike(txs, now, fmt),
    ...detectCategorySurge(txs, now, fmt),
    ...recurringFindings(detectRecurring(txs, now), fmt),
  ];

  const rank = { danger: 0, warning: 1, good: 2, info: 3 } as const;
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------------------------------------------------------------------
// Bantuan
// ---------------------------------------------------------------------

/** "Netflix  Premium!" dan "netflix premium" harus dianggap sama. */
export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Selisih nilai terbesar dan terkecil. */
function spread(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

/**
 * Proyeksi pengeluaran & jatah aman harian.
 *
 * Semua di sini dihitung di HP tanpa memanggil AI: deterministik, instan,
 * dan tetap jalan walaupun tidak ada API key sama sekali. AI hanya dipakai
 * belakangan untuk menarasikan angka-angka ini menjadi kalimat.
 */
import { dayKey, daysBetween, daysToPayday, startOfDay } from '@/lib/format';

export interface DaySpend {
  /** "YYYY-MM-DD" waktu lokal. */
  key: string;
  date: Date;
  total: number;
}

export interface SpendPoint {
  amount: number;
  occurred_at: string;
}

/**
 * Deret pengeluaran harian dari `from` sampai `to` (inklusif), termasuk
 * hari-hari bernilai nol — grafik butuh sumbu waktu yang utuh, bukan hanya
 * hari yang ada transaksinya.
 */
export function dailySeries(txs: readonly SpendPoint[], from: Date, to: Date): DaySpend[] {
  const totals = new Map<string, number>();
  for (const t of txs) {
    const k = dayKey(new Date(t.occurred_at));
    totals.set(k, (totals.get(k) ?? 0) + t.amount);
  }

  const out: DaySpend[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor.getTime() <= end.getTime()) {
    const date = new Date(cursor);
    const k = dayKey(date);
    out.push({ key: k, date, total: totals.get(k) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface MonthProjection {
  /** Sudah terpakai dari awal bulan sampai hari ini. */
  spentSoFar: number;
  /** Perkiraan total pengeluaran sampai akhir bulan. */
  projectedTotal: number;
  /** Rata-rata pengeluaran per hari sejauh ini. */
  dailyAverage: number;
  daysElapsed: number;
  daysRemaining: number;
  /**
   * 'weekday' bila proyeksi memperhitungkan pola hari (butuh >= 14 hari data),
   * 'linear' bila datanya masih sedikit sehingga dipakai rata-rata polos.
   */
  method: 'linear' | 'weekday';
}

/**
 * Proyeksi total pengeluaran bulan berjalan.
 *
 * Rata-rata polos meleset untuk kebanyakan orang karena belanja tidak rata:
 * akhir pekan biasanya lebih besar. Kalau data sudah cukup (>= 14 hari
 * terisi), sisa hari diproyeksikan memakai bobot per hari dalam seminggu.
 */
export function projectMonth(series: readonly DaySpend[], today: Date = new Date()): MonthProjection {
  const todayKey = dayKey(today);
  const elapsed = series.filter((d) => d.key <= todayKey);
  const remaining = series.filter((d) => d.key > todayKey);

  const spentSoFar = sum(elapsed.map((d) => d.total));
  const daysElapsed = elapsed.length;
  const daysRemaining = remaining.length;
  const dailyAverage = daysElapsed > 0 ? spentSoFar / daysElapsed : 0;

  if (daysRemaining === 0) {
    return { spentSoFar, projectedTotal: spentSoFar, dailyAverage, daysElapsed, daysRemaining, method: 'linear' };
  }

  const weights = weekdayWeights(elapsed);
  if (!weights) {
    return {
      spentSoFar,
      projectedTotal: spentSoFar + dailyAverage * daysRemaining,
      dailyAverage,
      daysElapsed,
      daysRemaining,
      method: 'linear',
    };
  }

  const projectedRest = sum(
    remaining.map((d) => dailyAverage * (weights[d.date.getDay()] ?? 1)),
  );
  return {
    spentSoFar,
    projectedTotal: spentSoFar + projectedRest,
    dailyAverage,
    daysElapsed,
    daysRemaining,
    method: 'weekday',
  };
}

/**
 * Bobot relatif tiap hari dalam seminggu (Minggu=0). Nilai 1,3 berarti hari
 * itu rata-rata 30% lebih boros dari hari biasa. Mengembalikan null bila
 * datanya belum cukup untuk dipercaya.
 */
function weekdayWeights(elapsed: readonly DaySpend[]): number[] | null {
  if (elapsed.length < 14) return null;

  const overall = sum(elapsed.map((d) => d.total)) / elapsed.length;
  if (overall <= 0) return null;

  const weights: number[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const days = elapsed.filter((d) => d.date.getDay() === dow);
    if (days.length === 0) {
      weights.push(1);
      continue;
    }
    const avg = sum(days.map((d) => d.total)) / days.length;
    // Dibatasi 0,5–2,0 supaya satu hari ekstrem tidak menyeret proyeksi.
    weights.push(clamp(avg / overall, 0.5, 2));
  }
  return weights;
}

export interface SafeToSpend {
  /** Nominal yang aman dipakai per hari sampai gajian berikutnya. */
  perDay: number;
  /** Sisa uang yang boleh dipakai (saldo dikurangi yang sudah dialokasikan). */
  available: number;
  daysLeft: number;
  paydayDay: number;
  /** true bila saldo sudah minus — UI menampilkannya sebagai peringatan. */
  overdrawn: boolean;
}

/**
 * "Kamu masih bisa pakai Rp X per hari sampai gajian."
 *
 * Angka paling berguna di dashboard karena langsung bisa ditindaklanjuti,
 * berbeda dengan "total pengeluaran bulan ini" yang cuma informatif.
 */
export function safeToSpend(
  balance: number,
  paydayDay: number,
  reserved = 0,
  now: Date = new Date(),
): SafeToSpend {
  const available = balance - reserved;
  // +1 supaya hari ini ikut dihitung sebagai hari yang masih perlu dibiayai.
  const daysLeft = Math.max(1, daysToPayday(paydayDay, now) + 1);
  return {
    perDay: available > 0 ? available / daysLeft : 0,
    available,
    daysLeft,
    paydayDay,
    overdrawn: available < 0,
  };
}

/** Saldo = modal awal semua dompet + seluruh pemasukan − seluruh pengeluaran. */
export function computeBalance(
  openingTotal: number,
  txs: readonly { kind: string; amount: number }[],
): number {
  let balance = openingTotal;
  for (const t of txs) {
    if (t.kind === 'income') balance += t.amount;
    else if (t.kind === 'expense') balance -= t.amount;
  }
  return balance;
}

/** Perbandingan periode ini vs periode sebelumnya, dalam persen. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Jumlah hari dalam bulan yang memuat `d`. */
export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Hari ke berapa `d` di bulannya (1-based) — dipakai untuk laju budget. */
export function dayOfMonth(d: Date): number {
  return d.getDate();
}

export function sum(xs: readonly number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Dipakai deteksi anomali; median lebih tahan pencilan daripada rata-rata. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return (((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

export function stdev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const mean = sum(xs) / xs.length;
  const variance = sum(xs.map((x) => (x - mean) ** 2)) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Umur data dalam hari — dipakai untuk memutuskan apakah deteksi layak jalan. */
export function historySpanDays(txs: readonly SpendPoint[], now: Date = new Date()): number {
  if (txs.length === 0) return 0;
  let oldest = now;
  for (const t of txs) {
    const d = new Date(t.occurred_at);
    if (d < oldest) oldest = d;
  }
  return daysBetween(oldest, now);
}

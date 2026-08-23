/**
 * Format angka & tanggal ala Indonesia.
 * Semua fungsi di sini murni (tanpa efek samping) supaya gampang diuji.
 */

const RB = 1_000;
const JT = 1_000_000;
const MLR = 1_000_000_000;

/** 1250000 -> "1.250.000" (pemisah ribuan titik, ala Indonesia). */
export function groupDigits(n: number): string {
  const neg = n < 0;
  const whole = Math.round(Math.abs(n)).toString();
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${grouped}` : grouped;
}

/** 1250000 -> "Rp 1.250.000" */
export function rupiah(n: number): string {
  return `Rp ${groupDigits(n)}`;
}

/**
 * Bentuk ringkas untuk ringkasan & grafik, di mana ruang terbatas.
 *   250_000    -> "250rb"
 *   1_250_000  -> "1,25jt"
 *   4_200_000  -> "4,2jt"
 *   2_500_000_000 -> "2,5M"
 */
export function compact(n: number): string {
  const neg = n < 0;
  const v = Math.abs(n);
  let out: string;

  if (v < RB) {
    out = String(Math.round(v));
  } else if (v < JT) {
    out = `${trimDecimal(v / RB)}rb`;
  } else if (v < MLR) {
    out = `${trimDecimal(v / JT)}jt`;
  } else {
    out = `${trimDecimal(v / MLR)}M`;
  }
  return neg ? `-${out}` : out;
}

/** "Rp 4,2jt" — versi ringkas berlabel mata uang. */
export function rupiahCompact(n: number): string {
  return `Rp ${compact(n)}`;
}

/**
 * Satu atau dua angka di belakang koma, tanpa nol menggantung.
 *   1.25 -> "1,25"   4.0 -> "4"   12.34 -> "12,3"
 */
function trimDecimal(v: number): string {
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  const fixed = v.toFixed(digits);
  // Tanpa penjagaan ini, "250" ikut terpangkas menjadi "25".
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

/** Nominal bertanda untuk baris transaksi: "+Rp 5.000.000" / "−Rp 35.000". */
export function signedRupiah(amount: number, kind: 'income' | 'expense' | 'transfer'): string {
  if (kind === 'income') return `+${rupiah(amount)}`;
  if (kind === 'expense') return `−${rupiah(amount)}`; // minus sejati, bukan hyphen
  return rupiah(amount);
}

// ---------------------------------------------------------------------
// Tanggal
// ---------------------------------------------------------------------

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;
const BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

/** Tengah malam lokal untuk tanggal tertentu — dasar semua perbandingan hari. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Selisih hari kalender (bukan selisih 24 jam) — aman terhadap DST. */
export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** "Hari ini" / "Kemarin" / "Sen, 12 Agu" */
export function relativeDay(d: Date, now: Date = new Date()): string {
  const diff = daysBetween(d, now);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  if (diff === -1) return 'Besok';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}

/** "12 Agu 2026" */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Agustus 2026" */
export function monthLabel(d: Date): string {
  return `${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "07:45" */
export function clockTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Kunci "YYYY-MM-DD" pada zona waktu lokal — untuk mengelompokkan per hari. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

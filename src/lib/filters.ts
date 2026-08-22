/**
 * Logika penyaring riwayat — murni, tanpa React, supaya bisa diuji.
 *
 * Batas rentang waktu adalah tempat yang gampang salah satu hari: kalau
 * "bulan lalu" berakhir di tanggal 1 bulan ini, transaksi hari itu ikut
 * terhitung dua kali. Karena itu batasnya diuji, bukan diandalkan pada
 * pembacaan sekilas.
 */
import { startOfDay, startOfMonth } from '@/lib/format';
import type { TransactionWithRefs } from '@/types/db';

export type KindFilter = 'all' | 'expense' | 'income';
export type RangeKey = 'all' | 'this_month' | 'last_month' | 'last_7' | 'last_30';

export interface Filters {
  kind: KindFilter;
  range: RangeKey;
  /** Batas nominal dalam satuan penuh; null berarti tanpa batas. */
  minAmount: number | null;
  maxAmount: number | null;
}

export const EMPTY_FILTERS: Filters = {
  kind: 'all',
  range: 'all',
  minAmount: null,
  maxAmount: null,
};

export const KIND_LABELS: [KindFilter, string][] = [
  ['all', 'Semua'],
  ['expense', 'Keluar'],
  ['income', 'Masuk'],
];

export const RANGE_LABELS: [RangeKey, string][] = [
  ['all', 'Kapan saja'],
  ['this_month', 'Bulan ini'],
  ['last_month', 'Bulan lalu'],
  ['last_7', '7 hari'],
  ['last_30', '30 hari'],
];

/** Batas awal-akhir untuk sebuah pilihan rentang. null berarti tidak dibatasi. */
export function rangeBounds(
  key: RangeKey,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  switch (key) {
    case 'this_month':
      return { from: startOfMonth(now), to: null };
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      // Sesaat sebelum bulan ini dimulai. Kalau dipatok ke tanggal 1 bulan ini,
      // transaksi hari itu akan terhitung sebagai bulan lalu juga.
      const to = new Date(startOfMonth(now).getTime() - 1);
      return { from, to };
    }
    case 'last_7':
      // Mundur 6 hari, karena hari ini ikut dihitung sebagai salah satu dari 7.
      return { from: startOfDay(new Date(now.getTime() - 6 * 86_400_000)), to: null };
    case 'last_30':
      return { from: startOfDay(new Date(now.getTime() - 29 * 86_400_000)), to: null };
    default:
      return { from: null, to: null };
  }
}

/** Berapa kelompok penyaring yang sedang aktif — untuk lencana di tombol. */
export function activeFilterCount(f: Filters): number {
  return (
    (f.kind !== 'all' ? 1 : 0) +
    (f.range !== 'all' ? 1 : 0) +
    (f.minAmount !== null || f.maxAmount !== null ? 1 : 0)
  );
}

/**
 * Menyaring daftar transaksi. Pencarian teks mencakup catatan dan teks asli
 * yang diketik user, bukan cuma nama tempat — orang sering mengingat apa yang
 * mereka tulis, bukan nama toko yang tercatat.
 */
export function applyFilters(
  transactions: readonly TransactionWithRefs[],
  filters: Filters,
  query: string,
  now: Date = new Date(),
): TransactionWithRefs[] {
  const needle = query.trim().toLowerCase();
  const { from, to } = rangeBounds(filters.range, now);

  return transactions.filter((t) => {
    if (filters.kind !== 'all' && t.kind !== filters.kind) return false;

    const amount = Number(t.amount);
    if (filters.minAmount !== null && amount < filters.minAmount) return false;
    if (filters.maxAmount !== null && amount > filters.maxAmount) return false;

    if (from || to) {
      const at = new Date(t.occurred_at);
      if (from && at < from) return false;
      if (to && at > to) return false;
    }

    if (!needle) return true;
    return [t.merchant, t.note, t.category?.name, t.raw_input]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(needle));
  });
}

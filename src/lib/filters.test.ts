import { activeFilterCount, applyFilters, EMPTY_FILTERS, rangeBounds } from './filters';
import type { TransactionWithRefs } from '@/types/db';

const NOW = new Date(2026, 7, 22, 14, 0); // 22 Agustus 2026

function tx(
  id: string,
  amount: number,
  daysAgo: number,
  extra: Partial<TransactionWithRefs> = {},
): TransactionWithRefs {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    user_id: 'u1',
    account_id: null,
    category_id: 'c1',
    kind: 'expense',
    amount,
    merchant: null,
    note: null,
    occurred_at: d.toISOString(),
    source: 'manual',
    raw_input: null,
    ai_confidence: null,
    was_corrected: false,
    receipt_url: null,
    created_at: d.toISOString(),
    category: { id: 'c1', name: 'Makan & Minum', icon: 'food', color: '#fff' },
    account: null,
    ...extra,
  };
}

describe('rangeBounds', () => {
  it('"kapan saja" tidak membatasi apa pun', () => {
    expect(rangeBounds('all', NOW)).toEqual({ from: null, to: null });
  });

  it('bulan ini dimulai dari tanggal 1', () => {
    const { from, to } = rangeBounds('this_month', NOW);
    expect(from!.getDate()).toBe(1);
    expect(from!.getMonth()).toBe(7);
    expect(to).toBeNull();
  });

  it('bulan lalu berhenti tepat sebelum bulan ini dimulai', () => {
    const { from, to } = rangeBounds('last_month', NOW);
    expect(from!.getMonth()).toBe(6); // Juli
    expect(from!.getDate()).toBe(1);
    // Kalau batasnya 1 Agustus, transaksi hari itu terhitung dua kali.
    expect(to!.getMonth()).toBe(6);
    expect(to!.getDate()).toBe(31);
  });

  it('7 hari mencakup hari ini, jadi mundur 6 hari', () => {
    expect(rangeBounds('last_7', NOW).from!.getDate()).toBe(16);
  });

  it('30 hari mundur 29 hari', () => {
    const { from } = rangeBounds('last_30', NOW);
    expect(from!.getMonth()).toBe(6);
    expect(from!.getDate()).toBe(24);
  });

  it('bulan lalu tetap benar saat menyeberang tahun', () => {
    const { from, to } = rangeBounds('last_month', new Date(2026, 0, 15));
    expect(from!.getFullYear()).toBe(2025);
    expect(from!.getMonth()).toBe(11); // Desember
    expect(to!.getDate()).toBe(31);
  });
});

describe('activeFilterCount', () => {
  it('nol saat belum ada penyaring', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('batas bawah dan atas dihitung sebagai satu kelompok', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, minAmount: 1000, maxAmount: 5000 })).toBe(1);
  });

  it('menjumlahkan kelompok yang berbeda', () => {
    expect(
      activeFilterCount({ kind: 'income', range: 'this_month', minAmount: 1000, maxAmount: null }),
    ).toBe(3);
  });
});

describe('applyFilters', () => {
  const data = [
    tx('a', 25_000, 0),
    tx('b', 500_000, 3),
    tx('c', 1_200_000, 40, { merchant: 'Uniqlo' }),
    tx('d', 8_000_000, 1, { kind: 'income', category: null }),
    tx('e', 45_000, 10, { note: 'Boba A' }),
  ];

  it('tanpa penyaring, semuanya lolos', () => {
    expect(applyFilters(data, EMPTY_FILTERS, '', NOW)).toHaveLength(5);
  });

  it('menyaring berdasarkan jenis', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, kind: 'income' }, '', NOW);
    expect(out.map((t) => t.id)).toEqual(['d']);
  });

  it('menyaring berdasarkan batas nominal', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, minAmount: 100_000 }, '', NOW);
    expect(out.map((t) => t.id)).toEqual(['b', 'c', 'd']);
  });

  it('batas bawah dan atas bekerja bersamaan', () => {
    const out = applyFilters(
      data,
      { ...EMPTY_FILTERS, minAmount: 30_000, maxAmount: 600_000 },
      '',
      NOW,
    );
    expect(out.map((t) => t.id)).toEqual(['b', 'e']);
  });

  it('menyaring berdasarkan rentang waktu', () => {
    // Yang 40 hari lalu harus tersingkir.
    const out = applyFilters(data, { ...EMPTY_FILTERS, range: 'last_30' }, '', NOW);
    expect(out.map((t) => t.id)).not.toContain('c');
  });

  it('mencari sampai ke catatan, bukan cuma nama tempat', () => {
    expect(applyFilters(data, EMPTY_FILTERS, 'boba', NOW).map((t) => t.id)).toEqual(['e']);
  });

  it('mencari nama tempat tanpa peduli huruf besar', () => {
    expect(applyFilters(data, EMPTY_FILTERS, 'UNIQLO', NOW).map((t) => t.id)).toEqual(['c']);
  });

  it('menggabungkan pencarian dengan penyaring', () => {
    const out = applyFilters(data, { ...EMPTY_FILTERS, kind: 'income' }, 'boba', NOW);
    expect(out).toHaveLength(0);
  });
});

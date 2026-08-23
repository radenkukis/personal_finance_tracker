import {
  computeBalance,
  dailySeries,
  median,
  projectMonth,
  safeToSpend,
  stdev,
} from './projection';

/** Tanggal lokal jam 12 siang — menghindari geser hari akibat zona waktu. */
function at(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

describe('dailySeries', () => {
  it('mengisi hari kosong dengan nol agar sumbu waktu utuh', () => {
    const series = dailySeries(
      [
        { amount: 30_000, occurred_at: at(2026, 8, 1) },
        { amount: 20_000, occurred_at: at(2026, 8, 1) },
        { amount: 75_000, occurred_at: at(2026, 8, 4) },
      ],
      new Date(2026, 7, 1),
      new Date(2026, 7, 5),
    );

    expect(series).toHaveLength(5);
    expect(series.map((d) => d.total)).toEqual([50_000, 0, 0, 75_000, 0]);
  });
});

describe('projectMonth', () => {
  it('memakai rata-rata polos saat data masih sedikit', () => {
    // 5 hari pertama, masing-masing 100rb; bulan Agustus punya 31 hari.
    const txs = [1, 2, 3, 4, 5].map((d) => ({ amount: 100_000, occurred_at: at(2026, 8, d) }));
    const series = dailySeries(txs, new Date(2026, 7, 1), new Date(2026, 7, 31));

    const p = projectMonth(series, new Date(2026, 7, 5, 12));

    expect(p.method).toBe('linear');
    expect(p.spentSoFar).toBe(500_000);
    expect(p.daysElapsed).toBe(5);
    expect(p.daysRemaining).toBe(26);
    expect(p.dailyAverage).toBe(100_000);
    expect(p.projectedTotal).toBe(3_100_000); // 100rb x 31 hari
  });

  it('beralih ke pembobotan hari setelah data cukup', () => {
    const txs = Array.from({ length: 20 }, (_, i) => ({
      amount: 50_000,
      occurred_at: at(2026, 8, i + 1),
    }));
    const series = dailySeries(txs, new Date(2026, 7, 1), new Date(2026, 7, 31));

    const p = projectMonth(series, new Date(2026, 7, 20, 12));

    expect(p.method).toBe('weekday');
    expect(p.spentSoFar).toBe(1_000_000);
    // Pengeluaran rata setiap hari, jadi bobotnya seragam dan hasilnya
    // sama dengan proyeksi linear.
    expect(Math.round(p.projectedTotal)).toBe(1_550_000);
  });

  it('tidak memproyeksikan apa pun di hari terakhir bulan', () => {
    const series = dailySeries(
      [{ amount: 200_000, occurred_at: at(2026, 8, 31) }],
      new Date(2026, 7, 1),
      new Date(2026, 7, 31),
    );
    const p = projectMonth(series, new Date(2026, 7, 31, 12));

    expect(p.daysRemaining).toBe(0);
    expect(p.projectedTotal).toBe(p.spentSoFar);
  });
});

describe('safeToSpend', () => {
  it('membagi sisa saldo dengan sisa hari bulan ini', () => {
    // 20 Agustus dari 31 hari -> 12 hari tersisa, termasuk hari ini.
    const s = safeToSpend(1_200_000, 0, new Date(2026, 7, 20, 12));

    expect(s.daysLeft).toBe(12);
    expect(s.perDay).toBe(100_000);
    expect(s.overdrawn).toBe(false);
  });

  it('mengurangi dana yang sudah dialokasikan untuk budget', () => {
    const s = safeToSpend(1_200_000, 600_000, new Date(2026, 7, 20, 12));

    expect(s.available).toBe(600_000);
    expect(s.perDay).toBe(50_000);
  });

  it('menandai saldo minus dan tidak mengembalikan jatah negatif', () => {
    const s = safeToSpend(-50_000, 0, new Date(2026, 7, 20, 12));

    expect(s.overdrawn).toBe(true);
    expect(s.perDay).toBe(0);
  });

  it('di hari terakhir bulan, sisa harinya satu', () => {
    const s = safeToSpend(300_000, 0, new Date(2026, 7, 31, 12));

    expect(s.daysLeft).toBe(1);
    expect(s.perDay).toBe(300_000);
  });

  it('mengikuti panjang bulan yang berbeda', () => {
    // Februari 2026 punya 28 hari.
    const s = safeToSpend(280_000, 0, new Date(2026, 1, 1, 12));

    expect(s.daysLeft).toBe(28);
    expect(s.perDay).toBe(10_000);
  });
});

describe('computeBalance', () => {
  it('menambah pemasukan, mengurangi pengeluaran, mengabaikan transfer', () => {
    const balance = computeBalance(500_000, [
      { kind: 'income', amount: 5_000_000 },
      { kind: 'expense', amount: 1_250_000 },
      { kind: 'transfer', amount: 900_000 },
    ]);

    expect(balance).toBe(4_250_000);
  });
});

describe('statistik dasar', () => {
  it('median tahan terhadap nilai pencilan', () => {
    expect(median([10, 20, 30])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([10, 20, 30, 9_000_000])).toBe(25);
  });

  it('stdev mengembalikan 0 bila data kurang dari dua', () => {
    expect(stdev([])).toBe(0);
    expect(stdev([42])).toBe(0);
    expect(Math.round(stdev([2, 4, 4, 4, 5, 5, 7, 9]))).toBe(2);
  });
});

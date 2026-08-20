import {
  budgetFindings,
  detectCategorySurge,
  detectRecurring,
  detectSpike,
  evaluateBudgets,
  normalizeMerchant,
  runDetectors,
  type TxPoint,
} from './detectors';

const NOW = new Date(2026, 7, 20, 12); // 20 Agustus 2026, siang

function tx(
  id: string,
  amount: number,
  y: number,
  m: number,
  d: number,
  extra: Partial<TxPoint> = {},
): TxPoint {
  return {
    id,
    amount,
    occurred_at: new Date(y, m - 1, d, 12).toISOString(),
    kind: 'expense',
    merchant: null,
    category_name: null,
    ...extra,
  };
}

describe('normalizeMerchant', () => {
  it('menyamakan penulisan yang berbeda', () => {
    expect(normalizeMerchant('Netflix  Premium!')).toBe('netflix premium');
    expect(normalizeMerchant('netflix premium')).toBe('netflix premium');
  });
});

describe('detectRecurring', () => {
  const netflix = [
    tx('n1', 65_000, 2026, 6, 5, { merchant: 'Netflix' }),
    tx('n2', 65_000, 2026, 7, 5, { merchant: 'Netflix' }),
    tx('n3', 65_000, 2026, 8, 5, { merchant: 'Netflix' }),
  ];

  it('mengenali langganan bulanan', () => {
    const found = detectRecurring(netflix, NOW);

    expect(found).toHaveLength(1);
    expect(found[0]!.merchant).toBe('Netflix');
    expect(found[0]!.typicalAmount).toBe(65_000);
    expect(found[0]!.dayOfMonth).toBe(5);
    expect(found[0]!.occurrences).toBe(3);
  });

  it('tidak menganggap belanja biasa sebagai langganan', () => {
    // Indomaret: nominal dan tanggalnya acak — memang bukan langganan.
    const belanja = [
      tx('i1', 45_000, 2026, 6, 3, { merchant: 'Indomaret' }),
      tx('i2', 120_000, 2026, 7, 17, { merchant: 'Indomaret' }),
      tx('i3', 88_000, 2026, 8, 28, { merchant: 'Indomaret' }),
    ];

    expect(detectRecurring(belanja, NOW)).toHaveLength(0);
  });

  it('mengabaikan langganan yang sudah lama berhenti', () => {
    const berhenti = [
      tx('s1', 50_000, 2026, 1, 10, { merchant: 'Spotify' }),
      tx('s2', 50_000, 2026, 2, 10, { merchant: 'Spotify' }),
      tx('s3', 50_000, 2026, 3, 10, { merchant: 'Spotify' }),
    ];

    expect(detectRecurring(berhenti, NOW)).toHaveLength(0);
  });

  it('butuh minimal tiga bulan berbeda', () => {
    const duaBulan = [
      tx('a1', 65_000, 2026, 7, 5, { merchant: 'Netflix' }),
      tx('a2', 65_000, 2026, 8, 5, { merchant: 'Netflix' }),
      tx('a3', 65_000, 2026, 8, 5, { merchant: 'Netflix' }),
    ];

    expect(detectRecurring(duaBulan, NOW)).toHaveLength(0);
  });
});

describe('detectSpike', () => {
  /** 14 hari riwayat dengan nominal bervariasi, berakhir kemarin. */
  const riwayat = Array.from({ length: 14 }, (_, i) =>
    tx(`h${i}`, 20_000 + i * 1_000, 2026, 8, i + 6),
  );

  it('menandai hari yang jauh di atas kebiasaan', () => {
    const found = detectSpike([...riwayat, tx('big', 500_000, 2026, 8, 20)], NOW);

    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('spike');
    expect(found[0]!.data.hari_ini).toBe(500_000);
    expect(Number(found[0]!.data.kelipatan)).toBeGreaterThan(10);
  });

  it('diam saja untuk hari yang normal', () => {
    expect(detectSpike([...riwayat, tx('ok', 25_000, 2026, 8, 20)], NOW)).toHaveLength(0);
  });

  it('diam saja bila riwayatnya belum cukup', () => {
    expect(detectSpike([tx('only', 900_000, 2026, 8, 20)], NOW)).toHaveLength(0);
  });
});

describe('detectCategorySurge', () => {
  it('menandai kategori yang membengkak dibanding tiga minggu sebelumnya', () => {
    const txs = [
      // Minggu ini: 300rb
      tx('c1', 150_000, 2026, 8, 15, { category_name: 'Makan & Minum' }),
      tx('c2', 150_000, 2026, 8, 18, { category_name: 'Makan & Minum' }),
      // Tiga minggu sebelumnya: 300rb total -> 100rb per minggu
      tx('c3', 100_000, 2026, 7, 25, { category_name: 'Makan & Minum' }),
      tx('c4', 100_000, 2026, 8, 1, { category_name: 'Makan & Minum' }),
      tx('c5', 100_000, 2026, 8, 8, { category_name: 'Makan & Minum' }),
    ];

    const found = detectCategorySurge(txs, NOW);

    expect(found).toHaveLength(1);
    expect(found[0]!.data.kategori).toBe('Makan & Minum');
    expect(found[0]!.data.kenaikan_persen).toBe(200);
    expect(found[0]!.severity).toBe('danger');
  });

  it('mengabaikan kenaikan persentase besar bila nominalnya kecil', () => {
    const txs = [
      tx('k1', 30_000, 2026, 8, 18, { category_name: 'Hiburan' }),
      tx('k2', 3_000, 2026, 7, 25, { category_name: 'Hiburan' }),
      tx('k3', 3_000, 2026, 8, 1, { category_name: 'Hiburan' }),
      tx('k4', 3_000, 2026, 8, 8, { category_name: 'Hiburan' }),
    ];

    // Naik 900%, tapi selisihnya cuma 27rb — tidak layak jadi peringatan.
    expect(detectCategorySurge(txs, NOW)).toHaveLength(0);
  });
});

describe('budget', () => {
  const budgets = [{ category_name: 'Makan & Minum', amount: 1_000_000 }];

  it('memperingatkan saat laju pengeluaran mengarah ke jebol', () => {
    // Hari ke-20 dari 31, sudah 800rb -> proyeksi 1,24jt.
    const statuses = evaluateBudgets(budgets, new Map([['Makan & Minum', 800_000]]), NOW);
    const found = budgetFindings(statuses);

    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('budget_risk');
    expect(found[0]!.severity).toBe('warning');
    expect(found[0]!.data.proyeksi).toBe(1_240_000);
  });

  it('menandai budget yang sudah terlewati sebagai bahaya', () => {
    const statuses = evaluateBudgets(budgets, new Map([['Makan & Minum', 1_200_000]]), NOW);
    const found = budgetFindings(statuses);

    expect(found[0]!.kind).toBe('budget_over');
    expect(found[0]!.severity).toBe('danger');
    expect(found[0]!.data.kelebihan).toBe(200_000);
  });

  it('tenang saja bila lajunya masih aman', () => {
    const statuses = evaluateBudgets(budgets, new Map([['Makan & Minum', 300_000]]), NOW);

    expect(budgetFindings(statuses)).toHaveLength(0);
  });
});

describe('runDetectors', () => {
  it('mengurutkan temuan dari yang paling mendesak', () => {
    const txs: TxPoint[] = [
      ...Array.from({ length: 14 }, (_, i) => tx(`h${i}`, 20_000 + i * 1_000, 2026, 8, i + 6)),
      tx('big', 500_000, 2026, 8, 20),
      tx('n1', 65_000, 2026, 6, 5, { merchant: 'Netflix' }),
      tx('n2', 65_000, 2026, 7, 5, { merchant: 'Netflix' }),
      tx('n3', 65_000, 2026, 8, 5, { merchant: 'Netflix' }),
    ];

    const found = runDetectors(
      txs,
      [{ category_name: 'Makan & Minum', amount: 1_000_000 }],
      new Map([['Makan & Minum', 1_200_000]]),
      NOW,
    );

    expect(found[0]!.severity).toBe('danger'); // budget jebol paling mendesak
    expect(found.map((f) => f.kind)).toContain('spike');
    expect(found.map((f) => f.kind)).toContain('recurring');
    expect(found.at(-1)!.severity).toBe('info'); // info di paling bawah
  });
});

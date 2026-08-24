import {
  CATEGORY_COLORS,
  categoryLabel,
  deriveKeywords,
  findByAnyName,
  nextCategoryColor,
  normalizeCategoryName,
  sameCategoryName,
} from './categories';

describe('deriveKeywords', () => {
  it('selalu menyertakan nama kategori', () => {
    expect(deriveKeywords('Hewan Peliharaan')).toEqual(['hewan peliharaan']);
  });

  it('mengambil kata bermakna dari nama tempat dan catatan', () => {
    const keys = deriveKeywords('Hewan Peliharaan', 'makanan kucing', 'Petshop Mimi');
    expect(keys).toContain('hewan peliharaan');
    expect(keys).toContain('petshop');
    expect(keys).toContain('makanan');
    expect(keys).toContain('kucing');
  });

  it('membuang kata yang cocok dengan segalanya', () => {
    const keys = deriveKeywords('Olahraga', 'tadi beli buat latihan', null);
    expect(keys).not.toContain('beli');
    expect(keys).not.toContain('tadi');
    expect(keys).not.toContain('buat');
    expect(keys).toContain('latihan');
  });

  it('membuang metode bayar', () => {
    // "gopay" bukan penanda kategori — hampir semua transaksi bisa memakainya.
    expect(deriveKeywords('Hiburan', 'bayar pakai gopay', null)).toEqual(['hiburan']);
  });

  it('membuang angka dan kata terlalu pendek', () => {
    const keys = deriveKeywords('Kopi', 'es 2 gelas 25rb', null);
    expect(keys).not.toContain('2');
    expect(keys).not.toContain('es');
    expect(keys).not.toContain('25rb');
  });

  it('tidak menghasilkan kata kunci ganda', () => {
    const keys = deriveKeywords('Kucing', 'kucing kucing', 'Kucing');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('membatasi jumlah kata kunci', () => {
    const keys = deriveKeywords(
      'Belanja',
      'sabun sampo odol sikat handuk deterjen pewangi keset ember',
      'Supermarket Besar',
    );
    expect(keys.length).toBeLessThanOrEqual(6);
  });
});

describe('nextCategoryColor', () => {
  it('memilih warna pertama saat belum ada kategori', () => {
    expect(nextCategoryColor([])).toBe(CATEGORY_COLORS[0]);
  });

  it('menghindari warna yang sudah dipakai', () => {
    const used = [CATEGORY_COLORS[0], CATEGORY_COLORS[1]] as string[];
    expect(nextCategoryColor(used)).toBe(CATEGORY_COLORS[2]);
  });

  it('memutar kembali setelah semua warna terpakai sekali', () => {
    const used = [...CATEGORY_COLORS] as string[];
    // Semua terpakai sekali, jadi yang dipilih kembali ke urutan pertama.
    expect(nextCategoryColor(used)).toBe(CATEGORY_COLORS[0]);
  });

  it('mengabaikan warna di luar katalog', () => {
    expect(nextCategoryColor(['#123456', '#abcdef'])).toBe(CATEGORY_COLORS[0]);
  });
});

describe('normalizeCategoryName', () => {
  it('merapikan spasi dan huruf besar', () => {
    expect(normalizeCategoryName('  hewan   peliharaan ')).toBe('Hewan Peliharaan');
  });

  it('membiarkan nama yang sudah rapi', () => {
    expect(normalizeCategoryName('Makan & Minum')).toBe('Makan & Minum');
  });
});

describe('sameCategoryName', () => {
  it('mengabaikan huruf besar dan spasi berlebih', () => {
    expect(sameCategoryName('Makan & Minum', 'makan &  minum')).toBe(true);
  });

  it('membedakan nama yang memang berbeda', () => {
    expect(sameCategoryName('Transport', 'Transportasi')).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Nama yang tampil
// ---------------------------------------------------------------------

const NAMES = {
  food_drink: 'Essen & Trinken',
  transport: 'Transport',
  shopping: 'Einkaufen',
  bills: 'Rechnungen',
  health: 'Gesundheit',
  entertainment: 'Freizeit',
  education: 'Bildung',
  home: 'Wohnen',
  social: 'Soziales',
  other: 'Sonstiges',
  salary: 'Gehalt',
  freelance: 'Freelance',
  other_income: 'Sonstige Einnahmen',
};

describe('categoryLabel', () => {
  it('kategori bawaan memakai nama dari kamus', () => {
    expect(categoryLabel({ name: 'Makan & Minum', slug: 'food_drink' }, NAMES))
      .toBe('Essen & Trinken');
  });

  it('kategori buatan user memakai namanya sendiri', () => {
    // Menerjemahkan kata milik user justru salah.
    expect(categoryLabel({ name: 'Hewan Peliharaan', slug: null }, NAMES))
      .toBe('Hewan Peliharaan');
  });

  it('slug tak dikenal jatuh ke nama tersimpan, bukan teks kosong', () => {
    expect(categoryLabel({ name: 'Sesuatu', slug: 'belum_ada_di_kamus' }, NAMES))
      .toBe('Sesuatu');
  });
});

describe('findByAnyName', () => {
  const pool = [
    { name: 'Makan & Minum', slug: 'food_drink' },
    { name: 'Hewan Peliharaan', slug: null },
  ];

  it('menemukan lewat nama tersimpan', () => {
    expect(findByAnyName(pool, 'makan & minum', NAMES)?.slug).toBe('food_drink');
  });

  it('menemukan lewat nama yang sedang ditampilkan', () => {
    expect(findByAnyName(pool, 'Essen & Trinken', NAMES)?.slug).toBe('food_drink');
  });

  it('mengembalikan undefined bila memang tidak ada', () => {
    expect(findByAnyName(pool, 'Olahraga', NAMES)).toBeUndefined();
  });
});

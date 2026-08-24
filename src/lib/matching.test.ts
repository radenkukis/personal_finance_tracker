import { matchAccountId, matchCategoryId } from './matching';
import type { TxKind } from '@/types/db';

const CATEGORIES: { id: string; name: string; kind: TxKind }[] = [
  { id: 'c1', name: 'Makan & Minum', kind: 'expense' },
  { id: 'c2', name: 'Transport', kind: 'expense' },
  { id: 'c3', name: 'Sosial', kind: 'expense' },
  { id: 'c9', name: 'Lainnya', kind: 'expense' },
  { id: 'i1', name: 'Gaji', kind: 'income' },
];

const ACCOUNTS = [
  { id: 'a1', name: 'Tunai' },
  { id: 'a2', name: 'GoPay' },
  { id: 'a3', name: 'Bank' },
];

describe('matchCategoryId', () => {
  it('cocok persis', () => {
    expect(matchCategoryId(CATEGORIES, 'Transport', 'expense')).toBe('c2');
  });

  it('mengabaikan besar-kecil huruf', () => {
    expect(matchCategoryId(CATEGORIES, 'makan & minum', 'expense')).toBe('c1');
  });

  it('cocok sebagian', () => {
    expect(matchCategoryId(CATEGORIES, 'Makan', 'expense')).toBe('c1');
  });

  it('tidak menyeberang antar jenis transaksi', () => {
    // "Gaji" hanya ada di sisi income, jadi pencarian di sisi expense
    // harus jatuh ke "Lainnya", bukan mengembalikan kategori income.
    expect(matchCategoryId(CATEGORIES, 'Gaji', 'expense')).toBe('c9');
  });

  it('jatuh ke Lainnya bila tidak dikenali', () => {
    expect(matchCategoryId(CATEGORIES, 'Kategori Karangan', 'expense')).toBe('c9');
    expect(matchCategoryId(CATEGORIES, null, 'expense')).toBe('c9');
  });
});

describe('matchAccountId', () => {
  it('cocok persis dan tanpa peduli huruf besar', () => {
    expect(matchAccountId(ACCOUNTS, 'GoPay')).toBe('a2');
    expect(matchAccountId(ACCOUNTS, 'gopay')).toBe('a2');
  });

  /**
   * Kasus nyata: Gemini mengembalikan "BCA" padahal dompet yang ada bernama
   * "Bank". Sebelum diperbaiki, ini diam-diam tercatat sebagai "Tunai".
   */
  it('memetakan nama bank ke dompet Bank lewat alias', () => {
    expect(matchAccountId(ACCOUNTS, 'BCA')).toBe('a3');
    expect(matchAccountId(ACCOUNTS, 'mandiri')).toBe('a3');
    expect(matchAccountId(ACCOUNTS, 'transfer bca')).toBe('a3');
  });

  it('menangani nama yang lebih panjang dari nama dompet', () => {
    expect(matchAccountId(ACCOUNTS, 'Bank BCA')).toBe('a3');
  });

  it('mengosongkan dompet bila nama disebut tapi tidak dikenali', () => {
    // Menebak dompet yang salah berarti mencatat uang keluar dari sumber
    // yang keliru — lebih baik dikosongkan agar user memilih sendiri.
    expect(matchAccountId(ACCOUNTS, 'Rekening Koperasi RT')).toBeNull();
  });

  it('memakai dompet pertama hanya bila tidak ada nama sama sekali', () => {
    expect(matchAccountId(ACCOUNTS, null)).toBe('a1');
    expect(matchAccountId(ACCOUNTS, '   ')).toBe('a1');
  });

  it('mengembalikan null bila user belum punya dompet', () => {
    expect(matchAccountId([], 'GoPay')).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Kategori bawaan yang namanya ikut bahasa
// ---------------------------------------------------------------------

/** Akun berbahasa Inggris: tidak ada baris bernama "Lainnya" sama sekali. */
const EN_CATEGORIES: { id: string; name: string; kind: TxKind; slug: string | null }[] = [
  { id: 'c1', name: 'Food & Drink', kind: 'expense', slug: 'food_drink' },
  { id: 'c2', name: 'Transport', kind: 'expense', slug: 'transport' },
  { id: 'c9', name: 'Other', kind: 'expense', slug: 'other' },
  { id: 'x1', name: 'Kopi Spesial', kind: 'expense', slug: null },
];

/** Nama versi bahasa Jerman, seperti yang dilihat user setelah ganti bahasa. */
const DE_LABELS = {
  food_drink: 'Essen & Trinken',
  transport: 'Transport',
  other: 'Sonstiges',
};

describe('kategori bawaan lintas bahasa', () => {
  it('cocok dengan nama yang dilihat user, bukan yang tersimpan', () => {
    // AI menjawab memakai nama Jerman karena itu yang dikirim ke prompt.
    expect(matchCategoryId(EN_CATEGORIES, 'Essen & Trinken', 'expense', DE_LABELS)).toBe('c1');
  });

  it('nama tersimpan tetap cocok walau bahasanya sudah lain', () => {
    expect(matchCategoryId(EN_CATEGORIES, 'Food & Drink', 'expense', DE_LABELS)).toBe('c1');
  });

  it('kategori buatan user tidak ikut diterjemahkan', () => {
    expect(matchCategoryId(EN_CATEGORIES, 'Kopi Spesial', 'expense', DE_LABELS)).toBe('x1');
  });

  it('cadangan ditemukan lewat slug, bukan lewat nama "Lainnya"', () => {
    /*
     * Ini yang rusak diam-diam sejak kategori disemai per bahasa: akun
     * berbahasa Inggris tidak punya baris bernama "Lainnya", jadi pencarian
     * berdasarkan nama gagal dan transaksinya tersimpan tanpa kategori.
     */
    expect(matchCategoryId(EN_CATEGORIES, 'sesuatu yang tak dikenal', 'expense')).toBe('c9');
  });

  it('akun lama berbahasa Indonesia tetap punya cadangan', () => {
    expect(matchCategoryId(CATEGORIES, 'entah apa', 'expense')).toBe('c9');
  });
});

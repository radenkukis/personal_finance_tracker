/**
 * Bantuan pembuatan kategori — dipisah sebagai modul murni supaya bisa diuji.
 *
 * Bagian terpenting di sini adalah `deriveKeywords`. Kategori baru yang lahir
 * tanpa kata kunci akan tetap mengandalkan AI selamanya, karena parser gratis
 * mencocokkan lewat kata kunci. Menurunkan kata kunci dari kalimat asli user
 * membuat catatan berikutnya yang serupa tertangkap di HP — instan dan gratis.
 */

/** Warna kategori, dipilih bergiliran agar dua kategori baru tidak kembar. */
export const CATEGORY_COLORS = [
  '#FF8A5B', '#5B9BFF', '#C084FC', '#FFB74D', '#4ADE80',
  '#F472B6', '#38BDF8', '#A3A3A3', '#FB7185', '#22D3A6',
  '#FCD34D', '#818CF8', '#2DD4BF', '#F97316',
] as const;

export function nextCategoryColor(usedColors: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const c of CATEGORY_COLORS) counts.set(c, 0);
  for (const used of usedColors) {
    const key = used.toUpperCase();
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Warna yang paling jarang dipakai; bila seri, urutan katalog yang menentukan.
  let best = CATEGORY_COLORS[0] as string;
  let lowest = Infinity;
  for (const c of CATEGORY_COLORS) {
    const n = counts.get(c) ?? 0;
    if (n < lowest) {
      lowest = n;
      best = c;
    }
  }
  return best;
}

/**
 * Kata yang tidak membedakan apa pun. Dibuang supaya kata kunci kategori
 * tidak berisi "beli", "tadi", atau "pakai" yang cocok dengan segalanya.
 */
const STOPWORDS = new Set([
  'beli', 'bayar', 'buat', 'untuk', 'dari', 'pakai', 'pake', 'sama', 'dan',
  'yang', 'ada', 'juga', 'lagi', 'aja', 'saja', 'nya', 'ini', 'itu', 'tadi',
  'kemarin', 'kemaren', 'hari', 'pagi', 'siang', 'sore', 'malam', 'barusan',
  'habis', 'abis', 'total', 'jadi', 'terus', 'trus', 'lalu', 'sudah', 'udah',
  'gopay', 'ovo', 'dana', 'cash', 'tunai', 'transfer', 'bank', 'bca', 'debit',
]);

const MIN_KEYWORD_LENGTH = 4;
const MAX_DERIVED_KEYWORDS = 6;

/**
 * Kata kunci awal untuk kategori yang baru dibuat.
 *
 * Nama kategori selalu ikut — itu yang paling mungkin diketik ulang user.
 * Sisanya diambil dari catatan dan nama tempat, dibersihkan dari angka,
 * tanda baca, dan kata yang tidak membedakan apa pun.
 */
export function deriveKeywords(
  categoryName: string,
  note?: string | null,
  merchant?: string | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const word = raw.toLowerCase().trim();
    if (!word || seen.has(word)) return;
    seen.add(word);
    out.push(word);
  };

  push(categoryName);

  for (const source of [merchant, note]) {
    if (!source) continue;
    const words = source
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      // Menolak apa pun yang diawali angka: "25rb", "50k", "1jt" adalah nominal,
      // bukan penanda kategori.
      .filter((w) => w.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(w) && !/^\d/.test(w));

    for (const w of words) {
      if (out.length >= MAX_DERIVED_KEYWORDS) break;
      push(w);
    }
  }

  return out;
}

/** Dua kategori dianggap sama bila namanya sama setelah dirapikan. */
export function sameCategoryName(a: string, b: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return clean(a) === clean(b);
}

/** Rapikan nama yang diketik user: buang spasi ganda, kapitalkan tiap kata. */
export function normalizeCategoryName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

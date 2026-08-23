/**
 * Parser lokal — lapisan pertama input, gratis dan tanpa jaringan.
 *
 * Kebanyakan catatan pengeluaran berbentuk sangat sederhana ("kopi 25rb",
 * "bensin 50k gopay"). Bentuk seperti itu tidak perlu model bahasa: regex
 * plus kamus kata kunci sudah cukup, hasilnya instan, dan tidak memakan
 * kuota. AI baru dipanggil untuk kalimat yang benar-benar rumit.
 *
 * Setiap hasil membawa `confidence`. Di bawah 0,6 UI menandainya "perlu
 * dicek" — parser lebih baik mengaku ragu daripada diam-diam menebak salah.
 */
import type { Account, Category, DraftTransaction, TxKind, TxSource } from '@/types/db';

export interface ParseResult {
  drafts: DraftTransaction[];
  /** Ada bagian teks yang parser lokal tidak sanggup tangani. */
  needsAI: boolean;
  /** Potongan teks yang gagal diurai — dikirim ke AI bila tersedia. */
  unparsed: string[];
}

// ---------------------------------------------------------------------
// Kamus
// ---------------------------------------------------------------------

const INCOME_WORDS: Record<ParserLocale, string[]> = {
  id: [
    'gaji', 'gajian', 'salary', 'thr', 'bonus', 'komisi', 'fee', 'honor',
    'dapat', 'dapet', 'terima', 'diterima', 'masuk', 'transferan', 'refund',
    'cashback', 'kembalian dari', 'jual', 'laku', 'dividen', 'bunga', 'menang',
  ],
  en: [
    'salary', 'payroll', 'paycheck', 'wage', 'bonus', 'commission', 'fee',
    'got paid', 'received', 'earned', 'income', 'refund', 'cashback',
    'reimbursed', 'sold', 'dividend', 'interest', 'won',
  ],
};

/** Alias metode bayar -> kata yang dicocokkan dengan nama dompet user. */
export const ACCOUNT_ALIASES: Record<string, string> = {
  gopay: 'gopay', gojek: 'gopay',
  ovo: 'ovo',
  dana: 'dana',
  shopeepay: 'shopeepay', spay: 'shopeepay',
  linkaja: 'linkaja',
  qris: 'qris',
  cash: 'tunai', tunai: 'tunai', kontan: 'tunai',
  bca: 'bank', mandiri: 'bank', bri: 'bank', bni: 'bank', cimb: 'bank',
  jago: 'bank', seabank: 'bank', blu: 'bank', jenius: 'bank', permata: 'bank',
  btn: 'bank', danamon: 'bank', transfer: 'bank', tf: 'bank', debit: 'bank',
  atm: 'bank', mbanking: 'bank',
};

/**
 * Bahasa yang parser di HP mengerti. Selain ini, catatan diteruskan ke AI:
 * tetap berfungsi penuh, hanya tidak instan dan memakai kuota.
 */
export type ParserLocale = 'id' | 'en';

/** Kata waktu -> pergeseran hari dan jam kejadian. */
const TIME_WORDS: Record<ParserLocale, { pattern: RegExp; dayOffset: number; hour?: number }[]> = {
  en: [
    { pattern: /\bday\s+before\s+yesterday\b/i, dayOffset: -2 },
    { pattern: /\blast\s+week\b/i, dayOffset: -7 },
    { pattern: /\blast\s+night\b/i, dayOffset: -1, hour: 20 },
    { pattern: /\byesterday\b/i, dayOffset: -1 },
    { pattern: /\bthis\s+morning\b/i, dayOffset: 0, hour: 7 },
    { pattern: /\bthis\s+afternoon\b/i, dayOffset: 0, hour: 15 },
    { pattern: /\bthis\s+evening\b|\btonight\b/i, dayOffset: 0, hour: 19 },
    { pattern: /\bjust\s+now\b/i, dayOffset: 0 },
    { pattern: /\btoday\b/i, dayOffset: 0 },
  ],
  id: [
  { pattern: /\bkemarin\s+lusa\b/i, dayOffset: -2 },
  { pattern: /\bkemaren\s+lusa\b/i, dayOffset: -2 },
  { pattern: /\bminggu\s+lalu\b/i, dayOffset: -7 },
  { pattern: /\bsemalam\b/i, dayOffset: -1, hour: 20 },
  { pattern: /\btadi\s+malam\b/i, dayOffset: -1, hour: 20 },
  { pattern: /\bkemarin\b/i, dayOffset: -1 },
  { pattern: /\bkemaren\b/i, dayOffset: -1 },
  { pattern: /\bkmrn\b/i, dayOffset: -1 },
  { pattern: /\btadi\s+pagi\b/i, dayOffset: 0, hour: 7 },
  { pattern: /\btadi\s+siang\b/i, dayOffset: 0, hour: 12 },
  { pattern: /\btadi\s+sore\b/i, dayOffset: 0, hour: 16 },
  { pattern: /\bbarusan\b/i, dayOffset: 0 },
  { pattern: /\bhari\s+ini\b/i, dayOffset: 0 },
    { pattern: /\btadi\b/i, dayOffset: 0 },
  ],
};

/*
 * "m" berarti hal yang berbeda di dua bahasa: dalam percakapan Indonesia
 * "5m" adalah lima miliar, dalam bahasa Inggris "5m" adalah lima juta.
 * Satu tabel bersama akan membuat salah satunya salah seribu kali lipat,
 * jadi tabelnya dipisah per bahasa.
 */
const MULTIPLIERS: Record<ParserLocale, Record<string, number>> = {
  id: {
    rb: 1_000, ribu: 1_000, k: 1_000,
    jt: 1_000_000, juta: 1_000_000, jeti: 1_000_000,
    m: 1_000_000_000, miliar: 1_000_000_000, milyar: 1_000_000_000,
  },
  en: {
    k: 1_000, rb: 1_000,
    m: 1_000_000, mil: 1_000_000, mn: 1_000_000,
    b: 1_000_000_000, bn: 1_000_000_000,
  },
};

/**
 * Angka bernilai kecil tanpa satuan ("makan 35") berarti ribuan HANYA pada
 * mata uang yang nominal sehari-harinya memang di kisaran ribuan. Pada dolar
 * atau euro, aturan yang sama akan mengubah makan siang 35 menjadi 35.000 —
 * jadi di sana angka polos diambil apa adanya.
 */
const BARE_NUMBER_THOUSAND_CUTOFF = 1_000;

const AMOUNT_RE =
  /(?:rp\.?\s*|[$\u20ac\u00a3\u00a5\u20a9]\s*)?(\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+(?:[,.]\d+)?)\s*(rb|ribu|k|jt|juta|jeti|mil|mn|bn|m|b|miliar|milyar)?\b/gi;

/** Bagaimana sebuah kalimat harus dibaca. */
export interface ParserOptions {
  locale: ParserLocale;
  /**
   * true bila mata uang user bernominal besar (Rupiah, Dong, Won...) sehingga
   * "makan 35" wajar ditafsirkan 35.000.
   */
  bareNumberIsThousands: boolean;
}

export const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  locale: 'id',
  bareNumberIsThousands: true,
};

// ---------------------------------------------------------------------
// Titik masuk
// ---------------------------------------------------------------------

export function parseLocal(
  input: string,
  categories: readonly Category[],
  accounts: readonly Account[],
  now: Date = new Date(),
  source: TxSource = 'ai_text',
  options: ParserOptions = DEFAULT_PARSER_OPTIONS,
): ParseResult {
  const text = input.trim();
  if (!text) return { drafts: [], needsAI: false, unparsed: [] };

  const drafts: DraftTransaction[] = [];
  const unparsed: string[] = [];

  for (const segment of splitSegments(text, options)) {
    const amounts = findAmounts(segment, options);

    if (amounts.length === 0) {
      // Tidak ada angka sama sekali — bukan transaksi, atau kalimatnya rumit.
      unparsed.push(segment);
      continue;
    }
    if (amounts.length > 1) {
      // Beberapa nominal dalam satu potongan; biarkan AI yang memilah.
      unparsed.push(segment);
      continue;
    }

    drafts.push(buildDraft(segment, amounts[0]!, text, categories, accounts, now, source, options));
  }

  return { drafts, needsAI: unparsed.length > 0, unparsed };
}

// ---------------------------------------------------------------------
// Pemotongan kalimat
// ---------------------------------------------------------------------

/**
 * "kemarin bensin 50k, kopi 22k, parkir 5k" -> tiga potongan.
 *
 * Kata "dan"/"sama" hanya dipakai sebagai pemisah bila kedua sisinya
 * mengandung angka — supaya "makan sama temen" tidak ikut terbelah.
 */
export function splitSegments(
  text: string,
  options: ParserOptions = DEFAULT_PARSER_OPTIONS,
): string[] {
  const primary = text
    .split(/[,;]|\bterus\b|\blalu\b|\bkemudian\b|\btrus\b|\bthen\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const piece of primary) {
    if (countAmounts(piece, options) > 1) {
      const parts = piece.split(/\bdan\b|\bsama\b|\band\b|\+/i).map((s) => s.trim()).filter(Boolean);
      const allHaveAmounts = parts.length > 1 && parts.every((p) => countAmounts(p, options) >= 1);
      if (allHaveAmounts) {
        out.push(...parts);
        continue;
      }
    }
    // Belum terpisah juga: potong tepat setelah tiap nominal.
    // "sarapan 18rb makan siang 42rb bensin 50rb" tanpa koma sama sekali
    // adalah bentuk yang sangat wajar diketik orang, dan sebelumnya selalu
    // dilempar ke AI — belasan detik untuk sesuatu yang bisa instan.
    const byAmount = splitAtAmountBoundaries(piece, options);
    if (byAmount) {
      out.push(...byAmount);
      continue;
    }

    out.push(piece);
  }
  return out;
}

/**
 * Mengembalikan null bila pemotongan tidak aman.
 *
 * Syaratnya SEMUA nominal harus eksplisit (bersatuan rb/jt/k, atau sudah
 * >= 1000). Tanpa syarat itu, "beli 2 tiket 75rb" akan terpotong menjadi
 * "beli 2" — melahirkan transaksi Rp 2.000 yang tidak pernah ada. Kalimat
 * seperti itu memang lebih aman diserahkan ke AI.
 */
function splitAtAmountBoundaries(piece: string, options: ParserOptions): string[] | null {
  const amounts = findAmounts(piece, options);
  if (amounts.length < 2) return null;
  if (!amounts.every((a) => a.explicit)) return null;

  const parts: string[] = [];
  let start = 0;
  for (const a of amounts) {
    const chunk = piece.slice(start, a.end).trim();
    if (!chunk) return null;
    parts.push(chunk);
    start = a.end;
  }

  // Sisa teks setelah nominal terakhir ("... 90rb pakai gopay") ditempelkan
  // ke potongan terakhir, bukan dibuang.
  const tail = piece.slice(start).trim();
  if (tail && parts.length > 0) {
    parts[parts.length - 1] = `${parts[parts.length - 1]} ${tail}`;
  }

  return reattachTrailingPayment(parts);
}

/** Kata yang menempel pada nominal SEBELUMNYA, bukan yang sesudahnya. */
const TRAILING_WORDS = new Set([...Object.keys(ACCOUNT_ALIASES), 'pakai', 'pake', 'via', 'lewat']);

/**
 * "bensin 50rb gopay nonton 90rb" dipotong tepat setelah nominal, sehingga
 * "gopay" terlempar ke potongan berikutnya dan tercatat sebagai dompet untuk
 * "nonton". Metode bayar selalu milik nominal sebelumnya, jadi kata-kata itu
 * dikembalikan ke tempatnya.
 */
function reattachTrailingPayment(parts: string[]): string[] {
  const out = [...parts];

  for (let i = 1; i < out.length; i++) {
    const words = out[i]!.split(/\s+/);
    const moved: string[] = [];

    while (words.length > 1 && TRAILING_WORDS.has(words[0]!.toLowerCase())) {
      moved.push(words.shift()!);
    }
    if (moved.length === 0) continue;

    out[i - 1] = `${out[i - 1]} ${moved.join(' ')}`;
    out[i] = words.join(' ');
  }

  return out;
}

// ---------------------------------------------------------------------
// Nominal
// ---------------------------------------------------------------------

interface FoundAmount {
  value: number;
  /** Teks aslinya, dibuang dari kalimat saat menebak nama merchant. */
  raw: string;
  /** Satuan ditulis eksplisit (rb/jt/k) atau nilainya sudah >= 1000. */
  explicit: boolean;
  /** Posisi karakter tepat setelah nominal, untuk memotong kalimat. */
  end: number;
}

/**
 * Angka yang jelas-jelas bagian dari keterangan waktu ("tanggal 12", "12/8",
 * "jam 7") harus disembunyikan lebih dulu. Tanpa ini "tanggal 12 bayar
 * internet 350rb" terbaca sebagai dua nominal dan gagal diurai.
 */
function maskDateTokens(segment: string): string {
  return segment
    .replace(/\b(?:tgl|tanggal)\s*\d{1,2}\b/gi, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(/\bjam\s*\d{1,2}(?:[.:]\d{2})?\b/gi, ' ');
}

export function findAmounts(
  segment: string,
  options: ParserOptions = DEFAULT_PARSER_OPTIONS,
): FoundAmount[] {
  const out: FoundAmount[] = [];
  const masked = maskDateTokens(segment);
  const multipliers = MULTIPLIERS[options.locale];
  AMOUNT_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = AMOUNT_RE.exec(masked)) !== null) {
    const [raw, digits, suffix] = match;
    if (!digits) continue;
    const end = match.index + raw.length;

    const base = parseIndonesianNumber(digits);
    if (base === null || base <= 0) continue;

    const unit = suffix?.toLowerCase();
    if (unit && multipliers[unit]) {
      out.push({ value: base * multipliers[unit]!, raw, explicit: true, end });
    } else if (base >= BARE_NUMBER_THOUSAND_CUTOFF || !options.bareNumberIsThousands) {
      out.push({ value: base, raw, explicit: true, end });
    } else {
      // "makan 35" -> 35.000, tapi ditandai tidak eksplisit.
      out.push({ value: base * 1_000, raw, explicit: false, end });
    }
  }
  return out;
}

function countAmounts(segment: string, options: ParserOptions): number {
  return findAmounts(segment, options).length;
}

/**
 * "50.000" -> 50000 (titik = pemisah ribuan)
 * "1,5"    -> 1.5   (koma = desimal)
 * "1.5"    -> 1.5   (titik tunggal dengan 1-2 digit = desimal, bukan ribuan)
 */
export function parseIndonesianNumber(raw: string): number | null {
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ''));
  }
  if (raw.includes(',')) {
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------
// Menyusun draft
// ---------------------------------------------------------------------

function buildDraft(
  segment: string,
  amount: FoundAmount,
  fullText: string,
  categories: readonly Category[],
  accounts: readonly Account[],
  now: Date,
  source: TxSource,
  options: ParserOptions,
): DraftTransaction {
  const lower = segment.toLowerCase();

  /*
   * Kata utuh, bukan potongan. Dengan pencocokan substring, "coffee" memuat
   * "fee" dan segelas kopi tercatat sebagai pemasukan — kesalahan yang tidak
   * kelihatan sampai grafik pemasukan membengkak tanpa sebab.
   */
  const kind: TxKind = INCOME_WORDS[options.locale].some((w) => containsWord(lower, w))
    ? 'income'
    : 'expense';

  // Kata waktu bisa muncul sekali di awal kalimat ("kemarin bensin 50k, kopi
  // 22k") dan berlaku untuk semua potongan — jadi dicari di teks utuh juga.
  const occurred = resolveDate(segment, fullText, now, options.locale);

  const category = matchCategory(lower, categories, kind);
  const account = matchAccount(lower, accounts);
  const merchant = guessMerchant(segment, amount.raw, category?.name ?? null);

  let confidence = 0.5;
  if (amount.explicit) confidence += 0.25;
  else confidence -= 0.05;
  if (category) confidence += 0.15;
  if (account) confidence += 0.05;
  if (merchant) confidence += 0.05;

  return {
    kind,
    amount: amount.value,
    merchant,
    note: null,
    occurred_at: occurred.toISOString(),
    category_name: category?.name ?? null,
    account_name: account,
    confidence: Math.min(0.95, Math.max(0.2, confidence)),
    source,
    raw_input: segment,
  };
}

// ---------------------------------------------------------------------
// Tanggal
// ---------------------------------------------------------------------

export function resolveDate(
  segment: string,
  fullText: string,
  now: Date,
  locale: ParserLocale = 'id',
): Date {
  // "tgl 12" / "tanggal 12"
  const explicitDay = /\b(?:tgl|tanggal)\s*(\d{1,2})\b/i.exec(segment) ?? /\b(?:tgl|tanggal)\s*(\d{1,2})\b/i.exec(fullText);
  if (explicitDay?.[1]) {
    const day = Number(explicitDay[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day, 12);
      // Tanggal yang belum tiba berarti maksudnya bulan lalu.
      if (d > now) d.setMonth(d.getMonth() - 1);
      return d;
    }
  }

  // "12/8" atau "12-8"
  const slash = /\b(\d{1,2})[/-](\d{1,2})\b/.exec(segment);
  if (slash?.[1] && slash[2]) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(now.getFullYear(), month - 1, day, 12);
      if (d > now) d.setFullYear(d.getFullYear() - 1);
      return d;
    }
  }

  /*
   * Kata waktu kedua bahasa selalu dicoba, bukan hanya bahasa yang aktif.
   * Orang Indonesia menulis "meeting lunch yesterday" tanpa merasa berpindah
   * bahasa, dan tidak ada kata di satu daftar yang berarti lain di daftar
   * satunya — jadi mencocokkan keduanya tidak berisiko. Bahasa yang aktif
   * hanya menentukan siapa yang diperiksa lebih dulu.
   */
  const other: ParserLocale = locale === 'id' ? 'en' : 'id';
  for (const w of [...TIME_WORDS[locale], ...TIME_WORDS[other]]) {
    if (w.pattern.test(segment) || w.pattern.test(fullText)) {
      const d = new Date(now);
      d.setDate(d.getDate() + w.dayOffset);
      if (w.hour !== undefined) d.setHours(w.hour, 0, 0, 0);
      return d;
    }
  }

  return now;
}

// ---------------------------------------------------------------------
// Kategori, dompet, merchant
// ---------------------------------------------------------------------

/**
 * Kategori dipilih berdasarkan kata kunci yang tersimpan di database, bukan
 * daftar keras di kode — jadi user bisa menambah kata kunci sendiri lewat
 * Pengaturan dan parser langsung ikut pintar.
 */
export function matchCategory(
  lowerSegment: string,
  categories: readonly Category[],
  kind: TxKind,
): Category | null {
  let best: Category | null = null;
  let bestScore = 0;

  for (const c of categories) {
    if (c.kind !== kind) continue;
    for (const keyword of c.keywords) {
      const k = keyword.toLowerCase();
      if (!k || !containsWord(lowerSegment, k)) continue;
      // Kata kunci lebih panjang lebih spesifik: "token listrik" mengalahkan "listrik".
      if (k.length > bestScore) {
        bestScore = k.length;
        best = c;
      }
    }
  }
  return best;
}

/**
 * Kata kunci harus cocok sebagai KATA UTUH, bukan potongan.
 *
 * Dengan pencocokan potongan, "makan" cocok di dalam "makanan kucing" dan
 * pengeluaran hewan peliharaan tercatat sebagai Makan & Minum. Pola yang sama
 * membuat "nasi" cocok di "nasib" dan "kopi" di "kopiah". Salah kategori
 * diam-diam lebih buruk daripada tidak berkategori: yang kedua kelihatan dan
 * bisa dibetulkan, yang pertama merusak grafik tanpa ada yang sadar.
 */
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

export function matchAccount(lowerSegment: string, accounts: readonly Account[]): string | null {
  // Nama dompet milik user diprioritaskan di atas alias umum.
  for (const a of accounts) {
    if (lowerSegment.includes(a.name.toLowerCase())) return a.name;
  }

  for (const [alias, canonical] of Object.entries(ACCOUNT_ALIASES)) {
    if (!new RegExp(`\\b${alias}\\b`, 'i').test(lowerSegment)) continue;
    const hit = accounts.find((a) => a.name.toLowerCase().includes(canonical));
    return hit?.name ?? canonical;
  }
  return null;
}

/**
 * "makan di warteg bu ani 25rb" -> "warteg bu ani"
 * Kalau tidak ada pola "di X", nama merchant dibiarkan kosong daripada
 * mengisi seluruh kalimat sebagai nama toko.
 */
export function guessMerchant(
  segment: string,
  amountRaw: string,
  categoryName: string | null,
): string | null {
  const withoutAmount = segment.replace(amountRaw, ' ').replace(/\s+/g, ' ').trim();

  const di = /\bdi\s+([a-z0-9][a-z0-9\s'&.-]{1,28})/i.exec(withoutAmount);
  if (di?.[1]) {
    const cleaned = stripTrailingNoise(di[1]);
    if (cleaned.length >= 2) return titleCase(cleaned);
  }

  // Satu-dua kata saja dan bukan sekadar nama kategori -> anggap itu merchant.
  const words = withoutAmount
    .replace(/\b(pakai|pake|bayar|beli|dari|untuk|buat|abis|habis)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1 && !/^\d+$/.test(w));

  if (words.length >= 1 && words.length <= 3) {
    const candidate = stripTrailingNoise(words.join(' '));
    if (candidate.length >= 3 && candidate.toLowerCase() !== categoryName?.toLowerCase()) {
      return titleCase(candidate);
    }
  }
  return null;
}

/** Membuang kata waktu/metode bayar yang menempel di ekor nama merchant. */
function stripTrailingNoise(raw: string): string {
  const noise = [
    ...Object.keys(ACCOUNT_ALIASES),
    'kemarin', 'kemaren', 'kmrn', 'tadi', 'barusan', 'semalam', 'pagi', 'siang',
    'sore', 'malam', 'hari', 'ini', 'pakai', 'pake', 'bayar', 'sama', 'dan',
  ];
  let out = raw.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const w of noise) {
      const re = new RegExp(`(^${w}\\b|\\b${w}$)`, 'i');
      if (re.test(out)) {
        out = out.replace(re, '').replace(/\s+/g, ' ').trim();
        changed = true;
      }
    }
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
}

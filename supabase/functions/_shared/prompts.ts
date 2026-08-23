/**
 * Prompt dan skema JSON — satu sumber untuk semua provider.
 *
 * Skema yang sama dipakai Claude (lewat tool use) maupun Gemini (lewat
 * responseSchema), sehingga hasilnya berbentuk identik dan kode pemanggil
 * tidak perlu tahu provider mana yang sedang aktif.
 */

/**
 * Siapa yang sedang dilayani: bahasa apa yang dia baca, dan mata uang apa
 * yang dia pakai. Keduanya diambil dari profil di database, bukan dari badan
 * permintaan — supaya tidak bisa dipalsukan dari sisi aplikasi.
 */
export interface UserVoice {
  /** Kode bahasa antarmuka, mis. 'ja'. null berarti user belum memilih. */
  language: string | null;
  /** Kode mata uang, mis. 'JPY'. */
  currency: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
  'zh-Hans': 'Simplified Chinese (\u7b80\u4f53\u4e2d\u6587)',
  'zh-Hant': 'Traditional Chinese (\u7e41\u9ad4\u4e2d\u6587)',
  ja: 'Japanese (\u65e5\u672c\u8a9e)',
  ko: 'Korean (\ud55c\uad6d\uc5b4)',
  es: 'Spanish (Espa\u00f1ol)',
  fr: 'French (Fran\u00e7ais)',
  de: 'German (Deutsch)',
};

/**
 * Mata uang yang nominal sehari-harinya berada di kisaran ribuan ke atas.
 * Hanya untuk mata uang inilah "makan 35" masuk akal ditafsirkan 35.000 —
 * menerapkan aturan itu pada dolar atau euro akan mengubah belanja $35
 * menjadi $35.000.
 */
const LARGE_DENOMINATION = new Set([
  'IDR', 'VND', 'LAK', 'KHR', 'MMK', 'UZS', 'IRR', 'PYG', 'COP', 'CLP', 'KRW', 'LBP', 'SLL',
]);

export function languageName(code: string | null | undefined): string {
  if (!code) return LANGUAGE_NAMES.en as string;
  return LANGUAGE_NAMES[code] ?? code;
}

/**
 * Aturan bahasa keluaran. Ditaruh paling atas di setiap prompt karena inilah
 * yang paling sering salah: model cenderung menjawab dalam bahasa pertanyaan,
 * padahal yang benar adalah bahasa antarmuka yang dipilih user.
 */
export function languageRules(v: UserVoice): string[] {
  const name = languageName(v.language);
  return [
    'BAHASA KELUARAN — ATURAN PALING PENTING:',
    `- Semua teks yang akan dibaca user HARUS ditulis dalam ${name}.`,
    '- Berlaku untuk jawaban, penjelasan, isi note, dan nama kategori baru.',
    `- Kalimat user boleh datang dalam bahasa apa pun. Yang kamu tulis tetap ${name}.`,
    '- Nama kategori dan nama tempat yang SUDAH ADA di data user disalin persis',
    '  apa adanya, tidak diterjemahkan — itu data miliknya, bukan teksmu.',
    `- Nominal ditulis dalam mata uang ${v.currency}, memakai pemisah angka yang`,
    `  lazim dipakai penutur ${name}.`,
    '',
  ];
}

export interface ParsedTx {
  kind: 'expense' | 'income';
  amount: number;
  merchant: string | null;
  note: string | null;
  /** ISO 8601. */
  occurred_at: string;
  category_name: string | null;
  /** true bila `category_name` adalah kategori baru yang diusulkan. */
  category_is_new: boolean;
  account_name: string | null;
  /** 0..1 — seberapa yakin model terhadap hasilnya. */
  confidence: number;
}

/** Skema JSON untuk hasil parsing. Dipakai kedua provider apa adanya. */
export const TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      description: 'Satu entri untuk setiap transaksi yang disebutkan.',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['expense', 'income'],
            description: 'expense untuk uang keluar, income untuk uang masuk.',
          },
          amount: {
            type: 'number',
            description:
              'Nominal penuh dalam satuan mata uang user, tanpa singkatan. ' +
              '"25rb"/"25k" berarti 25000; "1,5jt"/"1.5m" berarti 1500000.',
          },
          merchant: {
            type: ['string', 'null'],
            description: 'Nama tempat/toko bila disebut. null bila tidak ada.',
          },
          note: {
            type: ['string', 'null'],
            description: 'Keterangan tambahan singkat, null bila tidak perlu.',
          },
          occurred_at: {
            type: 'string',
            description: 'Waktu kejadian dalam format ISO 8601 lengkap dengan zona waktu.',
          },
          category_name: {
            type: ['string', 'null'],
            description:
              'Nama kategori dari daftar yang diberikan, atau nama kategori baru bila ' +
              'benar-benar tidak ada yang cocok.',
          },
          category_is_new: {
            type: 'boolean',
            description:
              'true HANYA bila category_name belum ada di daftar. false untuk semua ' +
              'kategori yang sudah ada.',
          },
          account_name: {
            type: ['string', 'null'],
            description: 'HARUS persis salah satu nama dompet dari daftar, atau null.',
          },
          confidence: {
            type: 'number',
            description: 'Antara 0 dan 1. Di bawah 0,6 bila ada bagian yang kamu tebak.',
          },
        },
        required: [
          'kind', 'amount', 'merchant', 'note', 'occurred_at',
          'category_name', 'category_is_new', 'account_name', 'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['transactions'],
  additionalProperties: false,
} as const;

export interface PromptContext extends UserVoice {
  categories: { name: string; kind: string }[];
  accounts: string[];
  /** Koreksi kategori yang pernah dilakukan user — contoh untuk model. */
  corrections: { raw_input: string; correct_category: string }[];
  /**
   * Nama tempat yang sudah pernah dipakai user. Dikirim sebagai acuan ejaan
   * supaya "bobs A" menempel ke "Boba A" yang sudah ada, bukan melahirkan
   * baris baru yang sebenarnya toko yang sama.
   */
  knownMerchants: string[];
  /** Waktu sekarang di zona waktu user, sebagai acuan "kemarin", "tadi pagi". */
  nowISO: string;
  timezone: string;
}

/**
 * Bagian yang berubah tiap permintaan (waktu sekarang, kalimat user) sengaja
 * TIDAK ditaruh di sini — itu masuk ke pesan user, setelah titik cache.
 *
 * Daftar kategori, nama tempat, dan koreksi memang ikut di bagian yang
 * di-cache. Ketiganya berubah jarang — hanya saat user memakai tempat yang
 * benar-benar baru atau mengoreksi kategori — sehingga cache tetap sering
 * kena. Ketika berubah, cache tersusun ulang sekali lalu stabil lagi.
 */
export function buildParseSystemPrompt(ctx: PromptContext): string {
  const expenseCats = ctx.categories.filter((c) => c.kind === 'expense').map((c) => c.name);
  const incomeCats = ctx.categories.filter((c) => c.kind === 'income').map((c) => c.name);

  const lines = [
    'Kamu mengubah catatan keuangan sehari-hari menjadi data transaksi terstruktur.',
    `Catatan user ditulis dalam ${languageName(ctx.language)} atau bahasa apa pun yang dia pakai.`,
    '',
    ...languageRules(ctx),
    'ATURAN NOMINAL:',
    '- Singkatan ribuan: "k", "rb", "ribu", "mil", "tsd". Singkatan jutaan: "m", "jt", "juta", "mio".',
    '- Bahasa Asia Timur memakai satuan sendiri: 1\u4e07 = 10.000, 1\u4e07\uc6d0/1\ub9cc = 10.000.',
    '- Perhatikan kebiasaan pemisah angka: "50.000" dan "50,000" sama-sama lima puluh ribu.',
    '  Sebaliknya "1,5" dan "1.5" sama-sama satu setengah.',
    ...(LARGE_DENOMINATION.has(ctx.currency)
      ? [
          '- Angka polos di bawah 1.000 dalam percakapan hampir selalu berarti ribuan:',
          '  "makan 35" = 35.000. Bila memakai penafsiran ini, turunkan confidence',
          '  ke 0,6 atau kurang.',
        ]
      : []),
    '',
    'ATURAN WAKTU:',
    '- "tadi", "barusan", "hari ini" = hari ini. "kemarin" = kemarin. "kemarin lusa" = dua hari lalu.',
    '- "tadi pagi" jam 07:00, "tadi siang" jam 12:00, "tadi sore" jam 16:00, "semalam" tadi malam jam 20:00.',
    '- Bila tidak ada keterangan waktu sama sekali, pakai waktu sekarang.',
    '- Keterangan waktu di awal kalimat berlaku untuk semua transaksi setelahnya.',
    '',
    'ATURAN KATEGORI:',
    `- Kategori pengeluaran yang tersedia: ${expenseCats.join(', ')}.`,
    `- Kategori pemasukan yang tersedia: ${incomeCats.join(', ')}.`,
    '- Bila cocok dengan salah satu kategori di atas, pakai namanya PERSIS dan set category_is_new = false.',
    '- Kamu BOLEH mengusulkan kategori baru, tapi hanya bila pengeluarannya jelas termasuk',
    '  tema yang belum terwakili sama sekali dan kemungkinan akan berulang.',
    '  Contoh tema yang sah: hewan peliharaan, olahraga, perawatan diri.',
    `  Tulis namanya dalam ${languageName(ctx.language)}.`,
    '  Saat mengusulkan, set category_is_new = true.',
    '- Nama kategori usulan harus UMUM, bukan nama barang. "Hewan Peliharaan", bukan',
    '  "Makanan Kucing". "Olahraga", bukan "Sewa Lapangan Futsal".',
    '- JANGAN mengusulkan kategori yang artinya mirip kategori yang sudah ada.',
    '  Ada "Transport"? Jangan usulkan "Transportasi" atau "Kendaraan".',
    '- Ragu sedikit pun, JANGAN mengusulkan. Pakai "Lainnya" dan set category_is_new = false.',
    '  Kategori yang terlalu banyak membuat grafik tidak terbaca.',
    '- JANGAN memecah kategori karena variasi barang. "boba A", "boba B", dan "boba C"',
    '  ketiganya tetap masuk kategori minuman/makanan yang sama; yang membedakan',
    '  cukup ditulis di field note. Kategori dipakai untuk melihat pola pengeluaran,',
    '  dan itu rusak kalau tiap varian barang jadi kategori sendiri.',
    '',
    'ATURAN CATATAN (note):',
    '- Isi note dengan barang atau keperluan spesifiknya: "Boba A", "kado nikahan",',
    '  "token listrik 100rb". Ini yang membuat riwayat tetap bisa dicari nanti.',
    '- Tulis ringkas, bukan menyalin seluruh kalimat user.',
    '- Kosongkan (null) bila memang tidak ada detail yang menambah informasi.',
    '',
    'ATURAN EJAAN — PENTING:',
    '- Perbaiki salah ketik yang jelas. "bobs A" maksudnya "Boba A"; "indomart"',
    '  maksudnya "Indomaret"; "gojeg" maksudnya "Gojek".',
    '- Bila ada nama tempat yang MIRIP di daftar "nama yang sudah dipakai" di bawah,',
    '  PAKAI ejaan dari daftar itu persis, jangan bikin varian baru. Satu tempat yang',
    '  tertulis dua macam akan terhitung sebagai dua tempat berbeda.',
    '- Rapikan huruf besar-kecil: "warteg bu ani" ditulis "Warteg Bu Ani".',
    '',
    'ATURAN DOMPET:',
    `- Dompet yang tersedia: ${ctx.accounts.join(', ')}.`,
    '- Nama e-wallet atau bank yang disebut user (gopay, ovo, dana, bca, mandiri) dipetakan ke dompet yang paling cocok.',
    '- Bila tidak disebut, isi null.',
    '',
    'ATURAN UMUM:',
    '- Satu kalimat bisa berisi beberapa transaksi. Pisahkan masing-masing menjadi entri sendiri.',
    '- Jangan mengarang transaksi yang tidak disebutkan.',
    '- Bila sebuah nominal ternyata hanya penjumlahan dari nominal lain ("2 tiket 75rb jadi 150rb"),',
    '  catat satu transaksi saja sebesar totalnya.',
    '- merchant hanya diisi bila nama tempatnya benar-benar disebut. Jangan menyalin seluruh kalimat.',
  ];

  if (ctx.knownMerchants.length > 0) {
    lines.push(
      '',
      'NAMA TEMPAT YANG SUDAH DIPAKAI USER INI — samakan ejaannya bila mirip:',
      ctx.knownMerchants.slice(0, 25).join(', ') + '.',
    );
  }

  if (ctx.corrections.length > 0) {
    lines.push(
      '',
      'KOREKSI YANG PERNAH DIBUAT USER INI — ikuti pola pilihan mereka:',
      ...ctx.corrections.slice(0, 8).map((c) => `- "${c.raw_input}" seharusnya kategori "${c.correct_category}"`),
    );
  }

  return lines.join('\n');
}

/** Bagian yang berubah tiap permintaan — sengaja dipisah dari prompt stabil di atas. */
export function buildParseUserPrompt(text: string, ctx: PromptContext): string {
  return [
    `Waktu sekarang: ${ctx.nowISO} (zona waktu ${ctx.timezone}).`,
    '',
    'Uraikan catatan berikut:',
    text,
  ].join('\n');
}

// ---------------------------------------------------------------------
// Chat keuangan
// ---------------------------------------------------------------------

/**
 * Hasil chat: menjawab pertanyaan, ATAU mengusulkan perubahan satu transaksi.
 * Perubahan tidak pernah langsung diterapkan — aplikasi menampilkan
 * sebelum/sesudah dulu dan menunggu user menekan konfirmasi.
 */
export interface ChatResult {
  type: 'answer' | 'amendment';
  answer: string | null;
  amendment: {
    transaction_id: string;
    /** Hanya kolom yang benar-benar berubah; sisanya null. */
    amount: number | null;
    merchant: string | null;
    note: string | null;
    category_name: string | null;
    kind: 'expense' | 'income' | null;
    /** Kalimat singkat: apa yang diubah dan kenapa transaksi itu yang dipilih. */
    explanation: string;
  } | null;
}

export const CHAT_SCHEMA_GEMINI = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['answer', 'amendment'] },
    answer: { type: 'STRING', nullable: true },
    amendment: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        transaction_id: { type: 'STRING' },
        amount: { type: 'NUMBER', nullable: true },
        merchant: { type: 'STRING', nullable: true },
        note: { type: 'STRING', nullable: true },
        category_name: { type: 'STRING', nullable: true },
        kind: { type: 'STRING', enum: ['expense', 'income'], nullable: true },
        explanation: { type: 'STRING' },
      },
      required: ['transaction_id', 'explanation'],
    },
  },
  required: ['type'],
};

export function buildChatSystemPrompt(v: UserVoice): string {
  return [
  'Kamu asisten keuangan pribadi di dalam aplikasi pencatat pengeluaran.',
  '',
  ...languageRules(v),
  'Kamu punya DUA mode. Pilih salah satu untuk setiap pesan:',
  '',
  'MODE "answer" — untuk pertanyaan.',
  'Isi field answer, dan amendment = null.',
  '',
  'MODE "amendment" — ketika user MEMINTA MENGUBAH sebuah transaksi.',
  'Contoh: "ubah kopi tadi jadi 30rb", "yang bensin kemarin harusnya transport",',
  '"ganti catatan yang di petshop jadi vitamin kucing".',
  'Isi field amendment, dan answer = null.',
  '',
  'ATURAN MODE AMENDMENT:',
  '- transaction_id HARUS diambil persis dari daftar transaksi yang diberikan.',
  '  Jangan pernah mengarang id.',
  '- Isi HANYA kolom yang benar-benar diubah. Kolom lain biarkan null.',
  '- Bila lebih dari satu transaksi mungkin cocok, JANGAN menebak. Pakai mode',
  '  answer dan tanyakan yang mana, sebutkan pilihannya beserta nominal dan tanggalnya.',
  '- Bila tidak ada transaksi yang cocok sama sekali, pakai mode answer dan katakan begitu.',
  '- explanation ditulis singkat: apa yang berubah dan kenapa transaksi itu yang dipilih.',
  '- Kamu TIDAK bisa menghapus atau membuat transaksi lewat chat, hanya mengubah.',
  '  Bila user memintanya, arahkan ke tombol tambah atau tekan lama untuk menghapus.',
  '',
  '',
  'CARA MENJAWAB (mode answer):',
  '- Jawab singkat dan langsung ke inti. Dua sampai empat kalimat sudah cukup untuk kebanyakan pertanyaan.',
  '- Selalu sebutkan angka nyata dari data yang diberikan. Jangan menjawab dengan nasihat umum.',
  '- Bila data yang dibutuhkan tidak ada, katakan terus terang bahwa datanya belum cukup.',
  '- JANGAN mengarang angka. Semua nominal harus berasal dari ringkasan data yang diberikan.',
  `- Tulis nominal dalam mata uang ${v.currency}.`,
  '- Nada bicara santai tapi tidak menggurui. Jangan menghakimi kebiasaan belanja user.',
  '',
  'BATASAN:',
  '- Kamu hanya membahas pencatatan, analisa pengeluaran, dan penganggaran.',
  '- Kamu BUKAN penasihat keuangan berlisensi. Jangan memberi rekomendasi investasi,',
  '  saham, kripto, asuransi, atau pinjaman. Bila ditanya soal itu, katakan dengan sopan',
  '  bahwa itu di luar kemampuanmu dan arahkan kembali ke analisa pengeluaran.',
  ].join('\n');
}

// ---------------------------------------------------------------------
// Narasi insight mingguan
// ---------------------------------------------------------------------

export function buildInsightSystemPrompt(v: UserVoice): string {
  return [
  'Kamu menulis ringkasan keuangan mingguan untuk satu orang.',
  '',
  ...languageRules(v),
  'Kamu diberi daftar temuan yang SUDAH dihitung oleh aplikasi. Tugasmu hanya',
  'merangkainya menjadi ringkasan yang enak dibaca — bukan menghitung ulang.',
  '',
  'ATURAN:',
  '- Maksimal 4 kalimat. Ini ringkasan, bukan laporan.',
  '- Pakai angka persis dari temuan yang diberikan. JANGAN mengarang angka baru.',
  '- Mulai dari hal yang paling penting.',
  '- Akhiri dengan satu saran konkret yang bisa dikerjakan minggu ini.',
  '- Nada bicara suportif, tidak menghakimi. Hindari kata "boros" yang menyalahkan.',
  `- Tulis nominal dalam mata uang ${v.currency}.`,
  ].join('\n');
}

/**
 * Prompt dan skema JSON — satu sumber untuk semua provider.
 *
 * Skema yang sama dipakai Claude (lewat tool use) maupun Gemini (lewat
 * responseSchema), sehingga hasilnya berbentuk identik dan kode pemanggil
 * tidak perlu tahu provider mana yang sedang aktif.
 */

export interface ParsedTx {
  kind: 'expense' | 'income';
  amount: number;
  merchant: string | null;
  note: string | null;
  /** ISO 8601. */
  occurred_at: string;
  category_name: string | null;
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
            description: 'Nominal dalam rupiah penuh. "25rb" berarti 25000, "1,5jt" berarti 1500000.',
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
            description: 'HARUS persis salah satu nama kategori dari daftar yang diberikan.',
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
          'category_name', 'account_name', 'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['transactions'],
  additionalProperties: false,
} as const;

export interface PromptContext {
  categories: { name: string; kind: string }[];
  accounts: string[];
  /** Koreksi kategori yang pernah dilakukan user — contoh untuk model. */
  corrections: { raw_input: string; correct_category: string }[];
  /** Waktu sekarang di zona waktu user, sebagai acuan "kemarin", "tadi pagi". */
  nowISO: string;
  timezone: string;
}

/**
 * Bagian prompt yang stabil ditaruh lebih dulu supaya bisa di-cache; bagian
 * yang berubah tiap permintaan (waktu sekarang, kalimat user) ditaruh
 * belakangan. Urutan ini yang menentukan cache kena atau tidak.
 */
export function buildParseSystemPrompt(ctx: PromptContext): string {
  const expenseCats = ctx.categories.filter((c) => c.kind === 'expense').map((c) => c.name);
  const incomeCats = ctx.categories.filter((c) => c.kind === 'income').map((c) => c.name);

  const lines = [
    'Kamu mengubah catatan keuangan berbahasa Indonesia sehari-hari menjadi data transaksi terstruktur.',
    '',
    'ATURAN NOMINAL:',
    '- "rb", "ribu", "k" berarti dikali 1.000. "jt", "juta" berarti dikali 1.000.000.',
    '- Titik adalah pemisah ribuan (50.000 = lima puluh ribu). Koma adalah desimal (1,5jt = 1.500.000).',
    '- Angka polos di bawah 1.000 dalam percakapan hampir selalu berarti ribuan: "makan 35" = 35.000.',
    '  Bila memakai penafsiran ini, turunkan confidence ke 0,6 atau kurang.',
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
    '- category_name HARUS persis salah satu dari daftar di atas. Jangan mengarang kategori baru.',
    '- Bila benar-benar tidak cocok ke mana pun, pakai "Lainnya".',
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

  if (ctx.corrections.length > 0) {
    lines.push(
      '',
      'KOREKSI YANG PERNAH DIBUAT USER INI — ikuti pola pilihan mereka:',
      ...ctx.corrections.slice(0, 15).map((c) => `- "${c.raw_input}" seharusnya kategori "${c.correct_category}"`),
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

export const CHAT_SYSTEM_PROMPT = [
  'Kamu asisten keuangan pribadi di dalam aplikasi pencatat pengeluaran, berbahasa Indonesia.',
  '',
  'CARA MENJAWAB:',
  '- Jawab singkat dan langsung ke inti. Dua sampai empat kalimat sudah cukup untuk kebanyakan pertanyaan.',
  '- Selalu sebutkan angka nyata dari data yang diberikan. Jangan menjawab dengan nasihat umum.',
  '- Bila data yang dibutuhkan tidak ada, katakan terus terang bahwa datanya belum cukup.',
  '- JANGAN mengarang angka. Semua nominal harus berasal dari ringkasan data yang diberikan.',
  '- Tulis nominal dalam format rupiah Indonesia, contoh: Rp 1.250.000.',
  '- Nada bicara santai tapi tidak menggurui. Jangan menghakimi kebiasaan belanja user.',
  '',
  'BATASAN:',
  '- Kamu hanya membahas pencatatan, analisa pengeluaran, dan penganggaran.',
  '- Kamu BUKAN penasihat keuangan berlisensi. Jangan memberi rekomendasi investasi,',
  '  saham, kripto, asuransi, atau pinjaman. Bila ditanya soal itu, katakan dengan sopan',
  '  bahwa itu di luar kemampuanmu dan arahkan kembali ke analisa pengeluaran.',
].join('\n');

// ---------------------------------------------------------------------
// Narasi insight mingguan
// ---------------------------------------------------------------------

export const INSIGHT_SYSTEM_PROMPT = [
  'Kamu menulis ringkasan keuangan mingguan berbahasa Indonesia untuk satu orang.',
  '',
  'Kamu diberi daftar temuan yang SUDAH dihitung oleh aplikasi. Tugasmu hanya',
  'merangkainya menjadi ringkasan yang enak dibaca — bukan menghitung ulang.',
  '',
  'ATURAN:',
  '- Maksimal 4 kalimat. Ini ringkasan, bukan laporan.',
  '- Pakai angka persis dari temuan yang diberikan. JANGAN mengarang angka baru.',
  '- Mulai dari hal yang paling penting.',
  '- Akhiri dengan satu saran konkret yang bisa dikerjakan minggu ini.',
  '- Nada bicara suportif, tidak menghakimi. Hindari kata "boros" yang menyalahkan.',
  '- Tulis nominal dalam format rupiah Indonesia, contoh: Rp 250.000.',
].join('\n');

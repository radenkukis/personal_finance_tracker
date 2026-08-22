import { findAmounts, parseIndonesianNumber, parseLocal, splitSegments } from './localParser';
import type { Account, Category } from '@/types/db';

const NOW = new Date(2026, 7, 20, 14, 30); // Kamis, 20 Agustus 2026

function cat(name: string, keywords: string[], kind: 'expense' | 'income' = 'expense'): Category {
  return {
    id: `cat-${name}`,
    user_id: 'u1',
    name,
    kind,
    icon: 'tag',
    color: '#fff',
    keywords,
    sort_order: 1,
  };
}

const CATEGORIES: Category[] = [
  cat('Makan & Minum', ['makan', 'kopi', 'warteg', 'nasi', 'gofood', 'jajan']),
  cat('Transport', ['bensin', 'parkir', 'gojek', 'grab', 'tol']),
  cat('Tagihan', ['listrik', 'token listrik', 'internet', 'netflix', 'pulsa']),
  cat('Belanja', ['belanja', 'indomaret', 'baju']),
  cat('Lainnya', []),
  cat('Gaji', ['gaji', 'gajian', 'thr'], 'income'),
];

const ACCOUNTS: Account[] = [
  { id: 'a1', user_id: 'u1', name: 'Tunai', kind: 'cash', icon: 'cash', opening_balance: 0, is_archived: false },
  { id: 'a2', user_id: 'u1', name: 'GoPay', kind: 'ewallet', icon: 'phone', opening_balance: 0, is_archived: false },
  { id: 'a3', user_id: 'u1', name: 'Bank', kind: 'bank', icon: 'bank', opening_balance: 0, is_archived: false },
];

function parse(text: string) {
  return parseLocal(text, CATEGORIES, ACCOUNTS, NOW);
}

describe('parseIndonesianNumber', () => {
  it('membaca titik sebagai pemisah ribuan', () => {
    expect(parseIndonesianNumber('50.000')).toBe(50_000);
    expect(parseIndonesianNumber('1.250.000')).toBe(1_250_000);
  });

  it('membaca koma sebagai desimal', () => {
    expect(parseIndonesianNumber('1,5')).toBe(1.5);
  });

  it('membaca titik tunggal berdigit sedikit sebagai desimal', () => {
    expect(parseIndonesianNumber('1.5')).toBe(1.5);
  });
});

describe('findAmounts', () => {
  it('mengenali satuan singkat sehari-hari', () => {
    expect(findAmounts('kopi 25rb')[0]!.value).toBe(25_000);
    expect(findAmounts('bensin 50k')[0]!.value).toBe(50_000);
    expect(findAmounts('gaji 5jt')[0]!.value).toBe(5_000_000);
    expect(findAmounts('kos 1,5jt')[0]!.value).toBe(1_500_000);
    expect(findAmounts('beli hp 3 juta')[0]!.value).toBe(3_000_000);
  });

  it('mengenali penulisan rupiah lengkap', () => {
    expect(findAmounts('bayar Rp 250.000')[0]!.value).toBe(250_000);
    expect(findAmounts('transfer rp1.000.000')[0]!.value).toBe(1_000_000);
  });

  it('menganggap angka kecil polos sebagai ribuan, tapi menandainya tidak eksplisit', () => {
    const found = findAmounts('makan 35')[0]!;
    expect(found.value).toBe(35_000);
    expect(found.explicit).toBe(false);
  });

  it('menganggap angka besar polos sebagai nominal apa adanya', () => {
    const found = findAmounts('makan 35000')[0]!;
    expect(found.value).toBe(35_000);
    expect(found.explicit).toBe(true);
  });
});

describe('splitSegments', () => {
  it('memotong pada koma dan kata sambung', () => {
    expect(splitSegments('bensin 50k, kopi 22k terus parkir 5k')).toEqual([
      'bensin 50k',
      'kopi 22k',
      'parkir 5k',
    ]);
  });

  it('tidak memotong "sama" ketika artinya "bersama"', () => {
    // Hanya satu nominal di sini, jadi "sama temen" harus tetap utuh.
    expect(splitSegments('makan di padang 45rb sama temen')).toEqual([
      'makan di padang 45rb sama temen',
    ]);
  });

  it('memotong di batas nominal walau tanpa pemisah sama sekali', () => {
    // Bentuk yang sangat wajar diketik orang, dan dulu selalu dilempar ke AI.
    expect(splitSegments('sarapan 18rb makan siang 42rb bensin 50rb')).toEqual([
      'sarapan 18rb',
      'makan siang 42rb',
      'bensin 50rb',
    ]);
  });

  it('menempelkan sisa teks ke potongan terakhir', () => {
    expect(splitSegments('kopi 25rb bensin 50rb pakai gopay')).toEqual([
      'kopi 25rb',
      'bensin 50rb pakai gopay',
    ]);
  });

  it('metode bayar tetap milik nominal sebelumnya', () => {
    expect(splitSegments('bensin 50rb gopay nonton 90rb')).toEqual([
      'bensin 50rb gopay',
      'nonton 90rb',
    ]);
  });

  it('TIDAK memotong bila ada nominal yang tidak eksplisit', () => {
    // "2" di sini jumlah barang, bukan uang. Memotong akan melahirkan
    // transaksi Rp 2.000 yang tidak pernah ada.
    expect(splitSegments('beli 2 tiket 75rb')).toEqual(['beli 2 tiket 75rb']);
  });

  it('memotong pada "dan" bila kedua sisi punya nominal', () => {
    expect(splitSegments('beli baju 150rb dan sepatu 300rb')).toEqual([
      'beli baju 150rb',
      'sepatu 300rb',
    ]);
  });
});

describe('parseLocal — kasus sederhana', () => {
  it('menguraikan "kopi 25rb"', () => {
    const { drafts, needsAI } = parse('kopi 25rb');

    expect(needsAI).toBe(false);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.amount).toBe(25_000);
    expect(drafts[0]!.kind).toBe('expense');
    expect(drafts[0]!.category_name).toBe('Makan & Minum');
    expect(drafts[0]!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('mengenali metode bayar', () => {
    const { drafts } = parse('bensin 50k gopay');

    expect(drafts[0]!.amount).toBe(50_000);
    expect(drafts[0]!.category_name).toBe('Transport');
    expect(drafts[0]!.account_name).toBe('GoPay');
  });

  it('memetakan nama bank ke dompet Bank', () => {
    const { drafts } = parse('bayar listrik 200rb bca');

    expect(drafts[0]!.account_name).toBe('Bank');
    expect(drafts[0]!.category_name).toBe('Tagihan');
  });

  it('kata kunci harus cocok sebagai kata utuh', () => {
    // "makan" TIDAK boleh cocok di dalam "makanan kucing" — itu belanja
    // hewan peliharaan, bukan makan siang.
    const { drafts } = parse('beli makanan kucing 120rb');
    expect(drafts[0]!.category_name).toBeNull();
  });

  it('tetap cocok bila katanya memang berdiri sendiri', () => {
    expect(parse('makan siang 25rb').drafts[0]!.category_name).toBe('Makan & Minum');
    expect(parse('beli kopi 25rb').drafts[0]!.category_name).toBe('Makan & Minum');
  });

  it('memilih kata kunci paling spesifik', () => {
    // "token listrik" lebih panjang daripada "listrik", jadi itu yang menang.
    const { drafts } = parse('token listrik 100rb');
    expect(drafts[0]!.category_name).toBe('Tagihan');
  });

  it('mengenali pemasukan', () => {
    const { drafts } = parse('gajian 8jt');

    expect(drafts[0]!.kind).toBe('income');
    expect(drafts[0]!.amount).toBe(8_000_000);
    expect(drafts[0]!.category_name).toBe('Gaji');
  });
});

describe('parseLocal — tanggal', () => {
  it('memundurkan sehari untuk "kemarin"', () => {
    const { drafts } = parse('kemarin kopi 25rb');
    const d = new Date(drafts[0]!.occurred_at);

    expect(d.getDate()).toBe(19);
    expect(d.getMonth()).toBe(7);
  });

  it('memakai jam pagi untuk "tadi pagi"', () => {
    const { drafts } = parse('tadi pagi sarapan 20rb');
    const d = new Date(drafts[0]!.occurred_at);

    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(7);
  });

  it('membaca "tanggal 12" sebagai bulan berjalan', () => {
    const { drafts } = parse('tanggal 12 bayar internet 350rb');
    const d = new Date(drafts[0]!.occurred_at);

    expect(d.getDate()).toBe(12);
    expect(d.getMonth()).toBe(7);
  });

  it('memundurkan ke bulan lalu bila tanggalnya belum tiba', () => {
    const { drafts } = parse('tanggal 28 bayar internet 350rb');
    const d = new Date(drafts[0]!.occurred_at);

    expect(d.getDate()).toBe(28);
    expect(d.getMonth()).toBe(6); // Juli
  });

  it('menerapkan kata waktu di awal kalimat ke seluruh potongan', () => {
    const { drafts } = parse('kemarin bensin 50k, kopi 22k, parkir 5k');

    expect(drafts).toHaveLength(3);
    for (const draft of drafts) {
      expect(new Date(draft.occurred_at).getDate()).toBe(19);
    }
  });
});

describe('parseLocal — banyak transaksi sekaligus', () => {
  it('menguraikan empat transaksi tanpa koma, tanpa memanggil AI', () => {
    const { drafts, needsAI } = parse(
      'sarapan 18rb makan padang 42rb bensin 50rb gopay nonton 90rb',
    );

    expect(needsAI).toBe(false);
    expect(drafts.map((d) => d.amount)).toEqual([18_000, 42_000, 50_000, 90_000]);
    expect(drafts[2]!.account_name).toBe('GoPay');
  });

  it('memecah tiga transaksi dari satu kalimat', () => {
    const { drafts, needsAI } = parse('kemarin bensin 50k, kopi 22k, parkir 5k');

    expect(needsAI).toBe(false);
    expect(drafts.map((d) => d.amount)).toEqual([50_000, 22_000, 5_000]);
    expect(drafts.map((d) => d.category_name)).toEqual([
      'Transport',
      'Makan & Minum',
      'Transport',
    ]);
  });
});

describe('parseLocal — mengaku tidak tahu', () => {
  it('menyerahkan kalimat tanpa nominal ke AI', () => {
    const result = parse('tadi jajan di kantin sama anak-anak');

    expect(result.drafts).toHaveLength(0);
    expect(result.needsAI).toBe(true);
    expect(result.unparsed).toHaveLength(1);
  });

  it('menyerahkan potongan bernominal ganda yang tidak bisa dipisah', () => {
    const result = parse('beli 2 tiket 75rb jadi 150rb');

    expect(result.needsAI).toBe(true);
  });

  it('mengembalikan hasil kosong untuk teks kosong', () => {
    const result = parse('   ');

    expect(result.drafts).toHaveLength(0);
    expect(result.needsAI).toBe(false);
  });

  it('menurunkan keyakinan untuk angka polos yang ambigu', () => {
    const bare = parse('makan 35').drafts[0]!;
    const explicit = parse('makan 35rb').drafts[0]!;

    expect(bare.amount).toBe(35_000);
    expect(bare.confidence).toBeLessThan(explicit.confidence);
  });
});

describe('parseLocal — nama merchant', () => {
  it('mengambil nama setelah kata "di"', () => {
    const { drafts } = parse('makan di warteg bu ani 25rb');
    expect(drafts[0]!.merchant).toBe('Warteg Bu Ani');
  });

  it('tidak memakai nama kategori sebagai merchant', () => {
    const { drafts } = parse('kopi 25rb');
    expect(drafts[0]!.merchant).not.toBe('Makan & Minum');
  });

  it('membuang metode bayar dari ekor nama merchant', () => {
    const { drafts } = parse('makan di padang 45rb gopay');
    expect(drafts[0]!.merchant).toBe('Padang');
  });
});

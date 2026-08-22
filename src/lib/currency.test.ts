import {
  formatMoney,
  formatMoneyCompact,
  formatMoneySigned,
  getCurrency,
  searchCurrencies,
  CURRENCIES,
} from './currency';

const IDR = getCurrency('IDR');
const USD = getCurrency('USD');
const EUR = getCurrency('EUR');
const JPY = getCurrency('JPY');
const VND = getCurrency('VND');

describe('getCurrency', () => {
  it('mengembalikan mata uang sesuai kode, tanpa peduli huruf besar-kecil', () => {
    expect(getCurrency('usd').code).toBe('USD');
    expect(getCurrency('USD').symbol).toBe('$');
  });

  it('jatuh ke Rupiah bila kodenya tidak dikenal atau kosong', () => {
    expect(getCurrency('XYZ').code).toBe('IDR');
    expect(getCurrency(null).code).toBe('IDR');
    expect(getCurrency(undefined).code).toBe('IDR');
  });

  it('tidak ada kode ganda di katalog', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('formatMoney', () => {
  it('Rupiah: titik sebagai pemisah ribuan, tanpa desimal', () => {
    expect(formatMoney(1_250_000, IDR)).toBe('Rp 1.250.000');
    expect(formatMoney(0, IDR)).toBe('Rp 0');
  });

  it('Dolar: koma sebagai pemisah, dua desimal, tanpa spasi', () => {
    expect(formatMoney(1250.5, USD)).toBe('$1,250.50');
    expect(formatMoney(0, USD)).toBe('$0.00');
  });

  it('Euro: gaya Eropa dengan spasi setelah simbol', () => {
    expect(formatMoney(1250.5, EUR)).toBe('€ 1.250,50');
  });

  it('Yen: tanpa desimal', () => {
    expect(formatMoney(1250, JPY)).toBe('¥1,250');
  });

  it('Dong: simbol di belakang angka', () => {
    expect(formatMoney(1_250_000, VND)).toBe('1.250.000 ₫');
  });

  it('nilai negatif diawali minus sebelum simbol', () => {
    expect(formatMoney(-50_000, IDR)).toBe('-Rp 50.000');
  });

  it('membulatkan sesuai jumlah desimal mata uang', () => {
    // Rupiah tidak punya sen, jadi 1500,7 dibulatkan.
    expect(formatMoney(1500.7, IDR)).toBe('Rp 1.501');
  });
});

describe('formatMoneyCompact', () => {
  it('memakai singkatan Indonesia untuk Rupiah', () => {
    expect(formatMoneyCompact(250_000, IDR)).toBe('Rp 250rb');
    // Kasus yang dulu bikin salah: berakhiran nol.
    expect(formatMoneyCompact(100_000, IDR)).toBe('Rp 100rb');
    expect(formatMoneyCompact(40_000, IDR)).toBe('Rp 40rb');
    expect(formatMoneyCompact(1_250_000, IDR)).toBe('Rp 1,25jt');
    expect(formatMoneyCompact(4_200_000, IDR)).toBe('Rp 4,2jt');
    expect(formatMoneyCompact(2_500_000_000, IDR)).toBe('Rp 2,5M');
  });

  it('memakai singkatan Inggris untuk Dolar', () => {
    expect(formatMoneyCompact(1_250_000, USD)).toBe('$1.25M');
    expect(formatMoneyCompact(4_200, USD)).toBe('$4.2K');
  });

  it('angka kecil tampil apa adanya', () => {
    expect(formatMoneyCompact(750, IDR)).toBe('Rp 750');
  });

  it('menghormati posisi simbol', () => {
    expect(formatMoneyCompact(1_250_000, VND)).toBe('1,25M ₫');
  });
});

describe('formatMoneySigned', () => {
  it('menambahkan tanda sesuai jenis transaksi', () => {
    expect(formatMoneySigned(5_000_000, 'income', IDR)).toBe('+Rp 5.000.000');
    expect(formatMoneySigned(35_000, 'expense', IDR)).toBe('−Rp 35.000');
    expect(formatMoneySigned(35_000, 'transfer', IDR)).toBe('Rp 35.000');
  });

  it('memakai minus sejati, bukan tanda hubung', () => {
    expect(formatMoneySigned(1000, 'expense', IDR).startsWith('−')).toBe(true);
  });
});

describe('searchCurrencies', () => {
  it('mencari berdasarkan kode, nama, maupun simbol', () => {
    expect(searchCurrencies('idr').map((c) => c.code)).toContain('IDR');
    expect(searchCurrencies('singapura').map((c) => c.code)).toContain('SGD');
    expect(searchCurrencies('€').map((c) => c.code)).toContain('EUR');
  });

  it('kueri kosong mengembalikan seluruh katalog', () => {
    expect(searchCurrencies('  ')).toHaveLength(CURRENCIES.length);
  });

  it('kueri tanpa hasil mengembalikan daftar kosong', () => {
    expect(searchCurrencies('zzzzz')).toHaveLength(0);
  });
});

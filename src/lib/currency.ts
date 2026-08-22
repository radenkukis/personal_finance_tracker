/**
 * Katalog mata uang & pemformatan nominal.
 *
 * Formatnya dihitung sendiri, bukan lewat `Intl.NumberFormat`. Alasannya:
 * mesin JavaScript di HP (Hermes) hanya membawa sebagian data lokal, sehingga
 * hasil `Intl` bisa berbeda antar perangkat — dan nominal uang adalah hal
 * terakhir yang boleh berubah-ubah tergantung HP. Tabel di bawah membuat
 * hasilnya sama persis di mana pun, dan bisa diuji.
 *
 * Ini murni soal TAMPILAN. Angka yang tersimpan di database tidak pernah
 * dikonversi — mengganti mata uang tidak mengubah nilai transaksi lama.
 */

export interface Currency {
  /** Kode ISO 4217. */
  code: string;
  /** Nama dalam Bahasa Indonesia. */
  name: string;
  symbol: string;
  /** Angka di belakang koma. Rupiah dan Yen tidak memakai desimal. */
  decimals: number;
  /** Pemisah ribuan. */
  group: string;
  /** Pemisah desimal. */
  decimal: string;
  /** Simbol di depan angka (Rp 1.000) atau di belakang (1 000 ₫). */
  symbolFirst: boolean;
  /** Spasi antara simbol dan angka. */
  space: boolean;
  /** Singkatan bertingkat, mengikuti kebiasaan setempat. */
  units: { value: number; suffix: string }[];
}

const ID_UNITS = [
  { value: 1_000_000_000, suffix: 'M' },
  { value: 1_000_000, suffix: 'jt' },
  { value: 1_000, suffix: 'rb' },
];

const EN_UNITS = [
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
];

/** Pola yang dipakai berulang, supaya tabelnya tetap terbaca. */
const dot = { group: '.', decimal: ',' };   // 1.234,56 — Eropa & Indonesia
const comma = { group: ',', decimal: '.' }; // 1,234.56 — Inggris & Amerika
const space = { group: ' ', decimal: ',' }; // 1 234,56 — Prancis & Rusia

export const CURRENCIES: Currency[] = [
  { code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp', decimals: 0, ...dot, symbolFirst: true, space: true, units: ID_UNITS },
  { code: 'USD', name: 'Dolar Amerika', symbol: '$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, ...dot, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'GBP', name: 'Pound Inggris', symbol: '£', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'JPY', name: 'Yen Jepang', symbol: '¥', decimals: 0, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'CNY', name: 'Yuan Tiongkok', symbol: '¥', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'SGD', name: 'Dolar Singapura', symbol: 'S$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'MYR', name: 'Ringgit Malaysia', symbol: 'RM', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'THB', name: 'Baht Thailand', symbol: '฿', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'VND', name: 'Dong Vietnam', symbol: '₫', decimals: 0, ...dot, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'PHP', name: 'Peso Filipina', symbol: '₱', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'BND', name: 'Dolar Brunei', symbol: 'B$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'KHR', name: 'Riel Kamboja', symbol: '៛', decimals: 0, ...comma, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'LAK', name: 'Kip Laos', symbol: '₭', decimals: 0, ...comma, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'MMK', name: 'Kyat Myanmar', symbol: 'K', decimals: 0, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'AUD', name: 'Dolar Australia', symbol: 'A$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'NZD', name: 'Dolar Selandia Baru', symbol: 'NZ$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'HKD', name: 'Dolar Hong Kong', symbol: 'HK$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'TWD', name: 'Dolar Taiwan', symbol: 'NT$', decimals: 0, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'KRW', name: 'Won Korea Selatan', symbol: '₩', decimals: 0, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'INR', name: 'Rupee India', symbol: '₹', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'PKR', name: 'Rupee Pakistan', symbol: '₨', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'BDT', name: 'Taka Bangladesh', symbol: '৳', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'LKR', name: 'Rupee Sri Lanka', symbol: 'Rs', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'NPR', name: 'Rupee Nepal', symbol: 'Rs', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'AED', name: 'Dirham Uni Emirat Arab', symbol: 'AED', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'SAR', name: 'Riyal Arab Saudi', symbol: 'SAR', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'QAR', name: 'Riyal Qatar', symbol: 'QAR', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'KWD', name: 'Dinar Kuwait', symbol: 'KD', decimals: 3, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'TRY', name: 'Lira Turki', symbol: '₺', decimals: 2, ...dot, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'CHF', name: 'Franc Swiss', symbol: 'CHF', decimals: 2, group: "'", decimal: '.', symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'SEK', name: 'Krona Swedia', symbol: 'kr', decimals: 2, ...space, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'NOK', name: 'Krone Norwegia', symbol: 'kr', decimals: 2, ...space, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'DKK', name: 'Krone Denmark', symbol: 'kr', decimals: 2, ...dot, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'PLN', name: 'Zloty Polandia', symbol: 'zł', decimals: 2, ...space, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'CZK', name: 'Koruna Ceko', symbol: 'Kč', decimals: 2, ...space, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'RUB', name: 'Rubel Rusia', symbol: '₽', decimals: 2, ...space, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'UAH', name: 'Hryvnia Ukraina', symbol: '₴', decimals: 2, ...space, symbolFirst: false, space: true, units: EN_UNITS },
  { code: 'CAD', name: 'Dolar Kanada', symbol: 'C$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'MXN', name: 'Peso Meksiko', symbol: 'MX$', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'BRL', name: 'Real Brasil', symbol: 'R$', decimals: 2, ...dot, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'ARS', name: 'Peso Argentina', symbol: 'AR$', decimals: 2, ...dot, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'CLP', name: 'Peso Chili', symbol: 'CL$', decimals: 0, ...dot, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'COP', name: 'Peso Kolombia', symbol: 'CO$', decimals: 0, ...dot, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'ZAR', name: 'Rand Afrika Selatan', symbol: 'R', decimals: 2, ...space, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'NGN', name: 'Naira Nigeria', symbol: '₦', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
  { code: 'EGP', name: 'Pound Mesir', symbol: 'E£', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'KES', name: 'Shilling Kenya', symbol: 'KSh', decimals: 2, ...comma, symbolFirst: true, space: true, units: EN_UNITS },
  { code: 'ILS', name: 'Shekel Israel', symbol: '₪', decimals: 2, ...comma, symbolFirst: true, space: false, units: EN_UNITS },
];

const DEFAULT = CURRENCIES[0] as Currency;

/** Kode tak dikenal (mis. data lama) jatuh ke Rupiah, bukan bikin app error. */
export function getCurrency(code: string | null | undefined): Currency {
  if (!code) return DEFAULT;
  return CURRENCIES.find((c) => c.code === code.toUpperCase()) ?? DEFAULT;
}

/** Pencarian untuk dropdown: cocokkan kode, nama, atau simbol. */
export function searchCurrencies(query: string): Currency[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURRENCIES;
  return CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q),
  );
}

// ---------------------------------------------------------------------
// Pemformatan
// ---------------------------------------------------------------------

/** Menyisipkan pemisah ribuan ke bagian bulat sebuah angka. */
function groupInteger(whole: string, sep: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function attachSymbol(body: string, c: Currency): string {
  const gap = c.space ? ' ' : '';
  return c.symbolFirst ? `${c.symbol}${gap}${body}` : `${body}${gap}${c.symbol}`;
}

/** "Rp 1.250.000" · "$1,250.00" · "1 250 ₫" */
export function formatMoney(amount: number, currency: Currency = DEFAULT): string {
  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(currency.decimals);
  const [whole = '0', fraction] = fixed.split('.');

  let body = groupInteger(whole, currency.group);
  if (fraction) body += currency.decimal + fraction;

  return (negative ? '-' : '') + attachSymbol(body, currency);
}

/**
 * Bentuk ringkas untuk grafik dan ringkasan, mengikuti kebiasaan setempat:
 * "Rp 1,2jt" untuk Rupiah, "$1.2M" untuk Dolar.
 */
export function formatMoneyCompact(amount: number, currency: Currency = DEFAULT): string {
  const negative = amount < 0;
  const value = Math.abs(amount);

  const unit = currency.units.find((u) => value >= u.value);
  let body: string;

  if (unit) {
    body = trimDecimal(value / unit.value, currency.decimal) + unit.suffix;
  } else if (currency.decimals > 0 && value > 0 && value < 1) {
    body = value.toFixed(currency.decimals).replace('.', currency.decimal);
  } else {
    body = groupInteger(String(Math.round(value)), currency.group);
  }

  return (negative ? '-' : '') + attachSymbol(body, currency);
}

/** Satu-dua angka di belakang koma tanpa nol menggantung: 1,25 · 4 · 12,3 */
function trimDecimal(value: number, decimalSep: string): string {
  const digits = value < 10 ? 2 : value < 100 ? 1 : 0;
  const fixed = value.toFixed(digits);

  // Nol menggantung hanya boleh dibuang bila memang ADA koma. Tanpa penjagaan
  // ini "250" ikut terpangkas menjadi "25" — dulu itu membuat Rp 250.000
  // tampil sebagai "Rp 25rb" di dashboard.
  if (!fixed.includes('.')) return fixed;

  return fixed.replace(/0+$/, '').replace(/\.$/, '').replace('.', decimalSep);
}

/** Nominal bertanda untuk baris transaksi. Minus sejati, bukan hyphen. */
export function formatMoneySigned(
  amount: number,
  kind: 'income' | 'expense' | 'transfer',
  currency: Currency = DEFAULT,
): string {
  const body = formatMoney(Math.abs(amount), currency);
  if (kind === 'income') return `+${body}`;
  if (kind === 'expense') return `−${body}`;
  return body;
}

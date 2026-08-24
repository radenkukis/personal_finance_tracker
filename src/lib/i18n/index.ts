/**
 * Titik masuk terjemahan.
 *
 * Semua kamus dimuat sekaligus, tidak dimuat sesuai kebutuhan. Alasannya
 * sederhana: sembilan kamus teks bersama-sama hanya berukuran puluhan
 * kilobyte, sementara memuatnya belakangan berarti ada jeda saat user
 * mengganti bahasa — harga yang jauh lebih mahal.
 */
import { en } from './en';
import { id } from './id';
import { zhHans } from './zh-Hans';
import { zhHant } from './zh-Hant';
import { ja } from './ja';
import { ko } from './ko';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { LOCALES, type Dictionary, type Locale } from './types';

export { LOCALES, LOCALE_NAMES, PARSER_LOCALES, CATEGORY_SLUGS } from './types';
export type { CategorySlug } from './types';
/* Diekspor untuk dipakai sebagai cadangan di modul non-React (mis. detektor). */
export { en };
export type { Dictionary, Locale } from './types';

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  id,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ja,
  ko,
  es,
  fr,
  de,
};

/**
 * Kode tak dikenal (data lama, atau bahasa perangkat yang belum didukung)
 * jatuh ke Inggris, bukan membuat aplikasi error.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: string | null | undefined): Dictionary {
  return isLocale(locale) ? DICTIONARIES[locale] : en;
}

/** Nilai yang boleh disisipkan ke dalam teks. */
export type Vars = Record<string, string | number>;

/**
 * Mengganti {nama} dengan nilainya.
 *
 * Placeholder yang tidak punya nilai dibiarkan apa adanya, bukan dihapus —
 * teks aneh seperti "sisa {amount}" langsung terlihat saat diuji, sedangkan
 * "sisa " yang kosong bisa lolos tanpa ada yang sadar.
 */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/**
 * Memilih bahasa terdekat dari daftar bahasa perangkat.
 *
 * Dipakai sebelum user punya profil — di layar masuk, dan pada akun yang baru
 * dibuat. Menyapa orang dengan bahasa yang sudah dipilihnya di HP terasa jauh
 * lebih matang daripada selalu memaksa bahasa Inggris lebih dulu.
 *
 * Aturan pencocokan, berurutan:
 *   1. Kode persis sama            "id"        -> id
 *   2. Mandarin, lihat aksaranya   "zh-TW"     -> zh-Hant
 *   3. Bahasa dasarnya saja        "es-MX"     -> es
 *   4. Tidak ada yang cocok                    -> en
 */
export function resolveLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const raw of tags) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;

    const exact = LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;

    const [base, ...rest] = tag.split(/[-_]/);

    if (base === 'zh') {
      /*
       * Aksara jarang ditulis eksplisit; yang biasanya ada cuma negaranya.
       * Taiwan, Hong Kong, dan Makau memakai aksara tradisional.
       */
      const traditional =
        rest.includes('hant') || rest.some((r) => r === 'tw' || r === 'hk' || r === 'mo');
      return traditional ? 'zh-Hant' : 'zh-Hans';
    }

    const loose = LOCALES.find((l) => l.toLowerCase() === base);
    if (loose) return loose;
  }

  return 'en';
}

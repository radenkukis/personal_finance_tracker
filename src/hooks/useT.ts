/**
 * Akses terjemahan dari dalam komponen.
 *
 * Mengembalikan kamusnya langsung, bukan fungsi `t('a.b.c')` berbasis string.
 * Dengan begitu TypeScript memeriksa setiap kunci saat menulis kode: salah
 * ketik nama kunci menjadi error kompilasi, bukan tulisan "settings.titel"
 * yang muncul di layar user.
 */
import { useMemo } from 'react';
import { useSession } from '@/store/session';
import { getDictionary, interpolate, type Dictionary, type Locale, type Vars } from '@/lib/i18n';
import { monthLabel, relativeDay, shortDate } from '@/lib/format';
import { isLocale } from '@/lib/i18n';
import { deviceLocale } from '@/lib/i18n/device';

export interface Translator {
  /** Kamus lengkap, sudah sesuai bahasa aktif. */
  d: Dictionary;
  locale: Locale;
  /** Menyisipkan nilai ke dalam teks berpola: fill(d.home.greetingNamed, { name }) */
  fill: (template: string, vars?: Vars) => string;

  /*
   * Tanggal ikut bahasa aktif. Dibungkus di sini supaya komponen tidak perlu
   * mengoper nama hari dan bulan ke setiap pemanggilan.
   */
  /** "Today" · "Yesterday" · "Mon, 12 Aug" */
  relativeDay: (d: Date, now?: Date) => string;
  /** "12 Aug 2026" */
  shortDate: (d: Date) => string;
  /** "August 2026" */
  monthLabel: (d: Date) => string;
}

export function useT(): Translator {
  const { profile } = useSession();
  const code = profile?.language;

  return useMemo(() => {
    /*
     * Sebelum ada profil — di layar masuk — bahasa HP yang dipakai, bukan
     * langsung Inggris. Begitu user memilih bahasa sendiri, pilihannya menang.
     */
    const locale: Locale = isLocale(code) ? code : deviceLocale();
    const d = getDictionary(locale);

    return {
      d,
      locale,
      fill: interpolate,
      relativeDay: (value, now) =>
        relativeDay(
          value,
          d.dates,
          { today: d.common.today, yesterday: d.common.yesterday, tomorrow: d.common.tomorrow },
          now,
        ),
      shortDate: (value) => shortDate(value, d.dates),
      monthLabel: (value) => monthLabel(value, d.dates),
    };
  }, [code]);
}

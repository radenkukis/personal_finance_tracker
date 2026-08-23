/**
 * Bahasa perangkat, dibaca sekali saat aplikasi dimuat.
 *
 * Terpisah dari modul i18n lainnya karena berkas ini menyentuh modul native.
 * Dengan begitu logika pemilihan bahasa (`resolveLocale`) tetap bisa diuji
 * tanpa perlu emulator.
 */
import { getLocales } from 'expo-localization';
import { resolveLocale, type Locale } from './index';

let cached: Locale | null = null;

/** Bahasa terdekat dengan pilihan user di pengaturan HP-nya. */
export function deviceLocale(): Locale {
  if (cached) return cached;
  try {
    cached = resolveLocale(getLocales().map((l) => l.languageTag));
  } catch {
    // Modul native tidak tersedia (mis. saat pengujian) — Inggris saja.
    cached = 'en';
  }
  return cached;
}

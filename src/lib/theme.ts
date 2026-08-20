/**
 * Design tokens — satu sumber kebenaran untuk seluruh tampilan.
 *
 * Arah desain: modern, compact, matang.
 *  - Kedalaman dibuat dengan garis rambut, bukan drop shadow tebal.
 *  - Satu warna aksen saja; warna kategori diredam supaya layar tidak ramai.
 *  - Skala tipografi rapat, angka memakai tabular figures agar digit sejajar.
 */
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  /** Dasar layar — gelap kebiruan, bukan hitam pekat. */
  bg: '#0A0D12',
  /** Permukaan kartu. */
  surface: '#12171F',
  /** Permukaan bertingkat (chip di dalam kartu, input). */
  surfaceRaised: '#1A212B',
  /** Permukaan yang ditekan. */
  surfacePressed: '#212A36',

  /** Garis rambut — pengganti shadow. */
  hairline: 'rgba(255,255,255,0.07)',
  hairlineStrong: 'rgba(255,255,255,0.12)',

  /** Teks. */
  text: '#E9EEF4',
  textMuted: '#8D9AAB',
  textFaint: '#5C6879',

  /** Aksen tunggal. */
  accent: '#2DD4A7',
  accentDim: 'rgba(45,212,167,0.14)',

  /** Semantik nominal. */
  income: '#2DD4A7',
  expense: '#FF6B6B',
  expenseDim: 'rgba(255,107,107,0.14)',
  warning: '#FFB74D',
  warningDim: 'rgba(255,183,77,0.14)',
  danger: '#FF5A5A',
  info: '#5B9BFF',

  /** Latar grafik. */
  gridLine: 'rgba(255,255,255,0.05)',
  barIdle: '#243040',
} as const;

/** Grid 8px — semua jarak kelipatan/pembagi 4. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Angka harus memakai tabular figures supaya lebar tiap digit sama —
 * kolom nominal jadi tidak goyang saat nilainya berubah.
 */
const tabular: TextStyle = Platform.select<TextStyle>({
  ios: { fontVariant: ['tabular-nums'] },
  android: { fontFamily: 'sans-serif-medium' },
  default: { fontVariant: ['tabular-nums'] },
})!;

export const type = {
  /** Label mungil di atas angka, huruf kapital renggang. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  /** Nominal di dalam baris/kartu kecil. */
  amount: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const, ...tabular },
  /** Nominal besar (kartu hero). */
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.8, ...tabular },
  displaySm: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.4, ...tabular },
} as const;

/** Ukuran baku komponen — menjaga kepadatan tetap konsisten. */
export const size = {
  rowHeight: 56,
  cardPadding: 14,
  iconSm: 16,
  iconMd: 20,
  tabBarHeight: 58,
  touchMin: 44,
} as const;

/** Gaya kartu standar: permukaan + garis rambut, tanpa shadow. */
export const card = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.hairline,
  padding: size.cardPadding,
} as const;

/** Durasi animasi — pendek, tidak pernah menunda kerja user. */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

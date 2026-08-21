/**
 * Mencocokkan nama kategori & dompet hasil tebakan (parser lokal maupun AI)
 * ke baris yang benar-benar ada di database.
 *
 * Dipisah ke modul murni karena ini titik rawan: model bahasa sering
 * mengembalikan nama yang mirip tapi tidak persis ("BCA" padahal dompetnya
 * bernama "Bank"). Salah cocok di sini berarti transaksi tercatat di dompet
 * yang keliru tanpa ada yang menyadari.
 */
import { ACCOUNT_ALIASES } from '@/lib/localParser';
import type { TxKind } from '@/types/db';

interface NamedCategory {
  id: string;
  name: string;
  kind: TxKind;
}

interface NamedAccount {
  id: string;
  name: string;
}

/**
 * Nama kategori -> id. Bila tidak ketemu sama sekali, jatuh ke "Lainnya"
 * daripada menyimpan transaksi tanpa kategori — kategori yang salah masih
 * bisa dibetulkan user, sedangkan yang kosong menghilang dari semua grafik.
 */
export function matchCategoryId(
  categories: readonly NamedCategory[],
  name: string | null,
  kind: TxKind,
): string | null {
  const pool = categories.filter((c) => c.kind === kind);
  if (pool.length === 0) return null;

  if (name) {
    const needle = name.toLowerCase().trim();
    const exact = pool.find((c) => c.name.toLowerCase() === needle);
    if (exact) return exact.id;

    const partial = pool.find(
      (c) => c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase()),
    );
    if (partial) return partial.id;
  }

  return pool.find((c) => c.name === 'Lainnya')?.id ?? null;
}

/**
 * Nama dompet -> id.
 *
 * Berbeda dari kategori, di sini TIDAK ada tebakan cadangan ketika nama
 * disebut tapi tidak dikenali. Menebak "BCA" sebagai "Tunai" berarti mencatat
 * uang keluar dari dompet yang salah — lebih baik dikosongkan supaya user
 * melihat dompetnya belum terisi dan memilih sendiri.
 *
 * Dompet pertama hanya dipakai bila memang tidak ada nama yang disebut.
 */
export function matchAccountId(
  accounts: readonly NamedAccount[],
  name: string | null,
): string | null {
  if (accounts.length === 0) return null;
  if (!name?.trim()) return accounts[0]?.id ?? null;

  const needle = name.toLowerCase().trim();

  const exact = accounts.find((a) => a.name.toLowerCase() === needle);
  if (exact) return exact.id;

  const partial = accounts.find(
    (a) => a.name.toLowerCase().includes(needle) || needle.includes(a.name.toLowerCase()),
  );
  if (partial) return partial.id;

  // "BCA" / "mandiri" / "ovo" -> nama dompet yang sebenarnya.
  // Kamus yang sama dipakai parser lokal, jadi jalur ketik dan jalur AI
  // berperilaku identik.
  const canonical = resolveAlias(needle);
  if (canonical) {
    const viaAlias = accounts.find((a) => a.name.toLowerCase().includes(canonical));
    if (viaAlias) return viaAlias.id;
  }

  return null;
}

/** Mencari alias di dalam teks, bukan hanya sama persis ("transfer bca"). */
function resolveAlias(needle: string): string | null {
  const direct = ACCOUNT_ALIASES[needle];
  if (direct) return direct;

  for (const [alias, canonical] of Object.entries(ACCOUNT_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(needle)) return canonical;
  }
  return null;
}

/** Tipe domain — cerminan tabel di supabase/schema.sql. */

export type TxKind = 'expense' | 'income' | 'transfer';
export type TxSource = 'manual' | 'ai_text' | 'ai_voice' | 'ai_receipt' | 'recurring';

export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  /** Kode bahasa antarmuka, mis. 'en' atau 'zh-Hant'. null = ikut bahasa HP. */
  language: string | null;
  monthly_income: number | null;
  payday_day: number;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  kind: 'cash' | 'bank' | 'ewallet' | 'credit';
  icon: string;
  opening_balance: number;
  is_archived: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: TxKind;
  icon: string;
  color: string;
  keywords: string[];
  sort_order: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  kind: TxKind;
  amount: number;
  merchant: string | null;
  note: string | null;
  occurred_at: string;
  source: TxSource;
  raw_input: string | null;
  ai_confidence: number | null;
  was_corrected: boolean;
  receipt_url: string | null;
  created_at: string;
}

/** Transaksi lengkap dengan relasi — bentuk yang dipakai layar daftar. */
export interface TransactionWithRefs extends Transaction {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'icon'> | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: string;
}

export interface Insight {
  id: string;
  user_id: string;
  kind: 'weekly' | 'alert' | 'tip';
  severity: 'info' | 'warning' | 'danger' | 'good';
  title: string;
  body: string;
  meta: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

/**
 * Hasil parsing (lokal maupun AI) sebelum disimpan.
 * Selalu ditampilkan ke user untuk dikonfirmasi dulu — AI tidak pernah
 * menulis langsung ke database tanpa user melihatnya.
 */
export interface DraftTransaction {
  kind: TxKind;
  amount: number;
  merchant: string | null;
  note: string | null;
  occurred_at: string;
  /** Nama kategori hasil tebakan; dipetakan ke id saat disimpan. */
  category_name: string | null;
  /**
   * AI mengusulkan kategori yang belum ada. Kategorinya baru benar-benar
   * dibuat kalau user menyimpan draft ini — AI tidak pernah menambah
   * kategori diam-diam.
   */
  category_is_new?: boolean;
  /** Nama dompet hasil tebakan (mis. "GoPay"). */
  account_name: string | null;
  /** 0..1 — di bawah 0.6 ditandai "perlu dicek" di UI. */
  confidence: number;
  source: TxSource;
  raw_input: string;
}

/**
 * Satu sumber data untuk seluruh app.
 *
 * Sengaja satu provider, bukan fetch per layar: dashboard, riwayat, dan chat
 * memakai kumpulan transaksi yang sama, jadi mengambilnya sekali saja
 * menghindari tiga permintaan jaringan untuk data yang identik.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { matchAccountId, matchCategoryId } from '@/lib/matching';
import {
  deriveKeywords,
  nextCategoryColor,
  normalizeCategoryName,
  sameCategoryName,
} from '@/lib/categories';
import { useSession } from '@/store/session';
import type {
  Account,
  Budget,
  Category,
  DraftTransaction,
  TransactionWithRefs,
  TxKind,
} from '@/types/db';

/** Jendela data yang ditarik ke HP. Cukup untuk deteksi langganan (3 bulan). */
const HISTORY_DAYS = 150;

interface DataState {
  accounts: Account[];
  categories: Category[];
  transactions: TransactionWithRefs[];
  budgets: (Budget & { category_name: string })[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveDrafts: (drafts: DraftTransaction[]) => Promise<number>;
  updateTransaction: (id: string, patch: Partial<TransactionWithRefs>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Menyimpan koreksi kategori supaya tebakan berikutnya lebih akurat. */
  recordCorrection: (rawInput: string, predicted: string | null, correct: string) => Promise<void>;
  createCategory: (input: NewCategory) => Promise<Category>;
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  /** Berapa transaksi yang memakai kategori ini — ditanyakan sebelum menghapus. */
  countTransactionsIn: (categoryId: string) => number;
}

export interface NewCategory {
  name: string;
  kind: TxKind;
  color?: string;
  keywords?: string[];
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithRefs[]>([]);
  const [budgets, setBudgets] = useState<(Budget & { category_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Kegagalan jaringan sesaat — pindah Wi-Fi, sinyal putus — dulu meninggalkan
   * kartu merah yang tidak pernah hilang sendiri. Satu kali percobaan ulang
   * otomatis menutup hampir semua kasus itu tanpa user perlu menyentuh apa pun.
   */
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setError(null);

    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);
    const periodStart = new Date();
    periodStart.setDate(1);

    try {
      const [acc, cat, tx, bud] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_archived', false).order('created_at'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase
          .from('transactions')
          .select('*, category:categories(id,name,icon,color), account:accounts(id,name,icon)')
          .gte('occurred_at', since.toISOString())
          .order('occurred_at', { ascending: false }),
        supabase
          .from('budgets')
          .select('*, category:categories(name)')
          .eq('period', toDateOnly(periodStart)),
      ]);

      const firstError = acc.error ?? cat.error ?? tx.error ?? bud.error;
      if (firstError) throw firstError;

      setAccounts(acc.data ?? []);
      setCategories(cat.data ?? []);
      setTransactions((tx.data ?? []) as TransactionWithRefs[]);
      setBudgets(
        (bud.data ?? []).map((b: Budget & { category?: { name: string } | null }) => ({
          ...b,
          category_name: b.category?.name ?? '',
        })),
      );
      retriedRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');

      if (!retriedRef.current) {
        retriedRef.current = true;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void refreshRef.current?.(), 2500);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // `refresh` memanggil dirinya sendiri lewat ref supaya tidak perlu masuk
  // ke daftar dependensinya sendiri.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  useEffect(() => {
    if (!userId) {
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
      setBudgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [userId, refresh]);

  const saveDrafts = useCallback(
    async (drafts: DraftTransaction[]) => {
      if (!userId || drafts.length === 0) return 0;

      /*
       * Kategori usulan AI dibuat DULU, sebelum transaksinya disimpan.
       * Urutannya penting: tanpa itu transaksi tersimpan menunjuk kategori
       * yang belum ada, lalu jatuh ke "Lainnya" — usulannya hilang padahal
       * user sudah menyetujuinya.
       */
      const pending = new Map<string, { name: string; kind: TxKind; draft: DraftTransaction }>();
      for (const d of drafts) {
        if (!d.category_is_new || !d.category_name) continue;
        const name = normalizeCategoryName(d.category_name);
        const exists = categories.some((c) => c.kind === d.kind && sameCategoryName(c.name, name));
        if (exists) continue;
        pending.set(d.kind + '::' + name.toLowerCase(), { name, kind: d.kind, draft: d });
      }

      let pool = categories;
      if (pending.size > 0) {
        const usedColors = categories.map((c) => c.color);
        const fresh = [...pending.values()].map(({ name, kind, draft }) => {
          const color = nextCategoryColor(usedColors);
          usedColors.push(color);
          return {
            user_id: userId,
            name,
            kind,
            color,
            keywords: deriveKeywords(name, draft.note, draft.merchant),
            sort_order: 500,
          };
        });

        const { data: created, error: createError } = await supabase
          .from('categories')
          .insert(fresh)
          .select();
        if (createError) throw new Error(createError.message);
        pool = [...categories, ...((created ?? []) as Category[])];
      }

      const rows = drafts.map((d) => ({
        user_id: userId,
        kind: d.kind,
        amount: d.amount,
        merchant: d.merchant,
        note: d.note,
        occurred_at: d.occurred_at,
        source: d.source,
        raw_input: d.raw_input,
        ai_confidence: d.confidence,
        category_id: matchCategoryId(pool, d.category_name, d.kind),
        account_id: matchAccountId(accounts, d.account_name),
      }));

      const { error: insertError } = await supabase.from('transactions').insert(rows);
      if (insertError) throw new Error(insertError.message);

      await refresh();
      return rows.length;
    },
    [userId, categories, accounts, refresh],
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<TransactionWithRefs>) => {
      // Relasi hasil join tidak boleh ikut dikirim balik ke Postgres.
      const { category: _c, account: _a, ...columns } = patch;
      const { error: updateError } = await supabase.from('transactions').update(columns).eq('id', id);
      if (updateError) throw new Error(updateError.message);
      await refresh();
    },
    [refresh],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id);
      if (deleteError) throw new Error(deleteError.message);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [],
  );

  const createCategory = useCallback(
    async (input: NewCategory) => {
      if (!userId) throw new Error('Belum masuk.');
      const name = normalizeCategoryName(input.name);
      if (!name) throw new Error('Nama kategori tidak boleh kosong.');
      if (categories.some((c) => c.kind === input.kind && sameCategoryName(c.name, name))) {
        throw new Error('Kategori "' + name + '" sudah ada.');
      }

      const { data, error: createError } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name,
          kind: input.kind,
          color: input.color ?? nextCategoryColor(categories.map((c) => c.color)),
          keywords: input.keywords ?? deriveKeywords(name),
          sort_order: 500,
        })
        .select()
        .single();
      if (createError) throw new Error(createError.message);

      await refresh();
      return data as Category;
    },
    [userId, categories, refresh],
  );

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Category>) => {
      const columns: Record<string, unknown> = {};
      if (patch.name !== undefined) columns.name = normalizeCategoryName(patch.name);
      if (patch.color !== undefined) columns.color = patch.color;
      if (patch.keywords !== undefined) columns.keywords = patch.keywords;
      if (Object.keys(columns).length === 0) return;

      const { error: updateError } = await supabase.from('categories').update(columns).eq('id', id);
      if (updateError) throw new Error(updateError.message);
      await refresh();
    },
    [refresh],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      // Skema memakai `on delete set null`, jadi transaksinya TIDAK ikut
      // terhapus — hanya kehilangan label kategorinya. Itu disengaja:
      // kehilangan catatan uang jauh lebih buruk daripada kehilangan label.
      const { error: deleteError } = await supabase.from('categories').delete().eq('id', id);
      if (deleteError) throw new Error(deleteError.message);
      await refresh();
    },
    [refresh],
  );

  const countTransactionsIn = useCallback(
    (categoryId: string) => transactions.filter((t) => t.category_id === categoryId).length,
    [transactions],
  );

  const recordCorrection = useCallback(
    async (rawInput: string, predicted: string | null, correct: string) => {
      if (!userId) return;
      await supabase.from('ai_corrections').insert({
        user_id: userId,
        raw_input: rawInput,
        predicted_category: predicted,
        correct_category: correct,
      });
    },
    [userId],
  );

  const value = useMemo<DataState>(
    () => ({
      accounts,
      categories,
      transactions,
      budgets,
      loading,
      error,
      refresh,
      saveDrafts,
      updateTransaction,
      deleteTransaction,
      recordCorrection,
      createCategory,
      updateCategory,
      deleteCategory,
      countTransactionsIn,
    }),
    [
      accounts,
      categories,
      transactions,
      budgets,
      loading,
      error,
      refresh,
      saveDrafts,
      updateTransaction,
      deleteTransaction,
      recordCorrection,
      createCategory,
      updateCategory,
      deleteCategory,
      countTransactionsIn,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData harus dipakai di dalam <DataProvider>');
  return ctx;
}

// ---------------------------------------------------------------------
// Bantuan
// ---------------------------------------------------------------------

/** "2026-08-01" — tipe `date` di Postgres tidak menerima timestamp penuh. */
function toDateOnly(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}


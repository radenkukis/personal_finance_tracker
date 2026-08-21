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
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { matchAccountId, matchCategoryId } from '@/lib/matching';
import { useSession } from '@/store/session';
import type { Account, Budget, Category, DraftTransaction, TransactionWithRefs } from '@/types/db';

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
        category_id: matchCategoryId(categories, d.category_name, d.kind),
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


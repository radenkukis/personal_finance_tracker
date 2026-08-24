/**
 * Semua angka dashboard dihitung di sini, dari data yang sudah ada di memori.
 * Tidak ada permintaan jaringan tambahan dan tidak ada panggilan AI —
 * dashboard tetap penuh isi walaupun user belum punya API key apa pun.
 */
import { useMemo } from 'react';
import { useData } from '@/store/data';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';
import { categoryLabel } from '@/lib/categories';
import {
  computeBalance,
  dailySeries,
  projectMonth,
  safeToSpend,
  sum,
  type MonthProjection,
  type SafeToSpend,
} from '@/analytics/projection';
import { runDetectors, type Finding, type TxPoint } from '@/analytics/detectors';
import { dayKey, startOfMonth } from '@/lib/format';
import type { Slice } from '@/components/charts/MiniDonut';
import type { TransactionWithRefs } from '@/types/db';

export interface DashboardData {
  balance: number;
  safe: SafeToSpend;
  spentToday: number;
  monthIncome: number;
  monthExpense: number;
  previousMonthExpense: number;
  series: ReturnType<typeof dailySeries>;
  projection: MonthProjection;
  slices: Slice[];
  findings: Finding[];
  recent: TransactionWithRefs[];
  isEmpty: boolean;
  loading: boolean;
}

export function useDashboard(now: Date = new Date()): DashboardData {
  const { accounts, transactions, budgets, loading } = useData();
  const { money, compact } = useMoney();
  const { d } = useT();

  // `now` sengaja tidak masuk daftar dependensi: objek Date baru dibuat setiap
  // render, dan memasukkannya akan menghitung ulang terus-menerus. Cukup
  // dihitung ulang ketika datanya yang berubah.
  return useMemo(() => {
    const monthStart = startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const openingTotal = sum(accounts.map((a) => Number(a.opening_balance)));
    const balance = computeBalance(
      openingTotal,
      transactions.map((t) => ({ kind: t.kind, amount: Number(t.amount) })),
    );

    const inRange = (t: TransactionWithRefs, from: Date, to: Date) => {
      const d = new Date(t.occurred_at);
      return d >= from && d <= new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
    };

    const thisMonth = transactions.filter((t) => inRange(t, monthStart, monthEnd));
    const prevMonth = transactions.filter((t) => inRange(t, prevStart, prevEnd));

    const monthExpenses = thisMonth.filter((t) => t.kind === 'expense');
    const monthIncome = sum(thisMonth.filter((t) => t.kind === 'income').map((t) => Number(t.amount)));
    const monthExpense = sum(monthExpenses.map((t) => Number(t.amount)));
    const previousMonthExpense = sum(
      prevMonth.filter((t) => t.kind === 'expense').map((t) => Number(t.amount)),
    );

    const series = dailySeries(
      monthExpenses.map((t) => ({ amount: Number(t.amount), occurred_at: t.occurred_at })),
      monthStart,
      monthEnd,
    );
    const projection = projectMonth(series, now);

    const todayKey = dayKey(now);
    const spentToday = series.find((d) => d.key === todayKey)?.total ?? 0;

    // Dana yang sudah "ada pemiliknya": sisa budget bulan ini yang belum
    // terpakai tidak boleh ikut dihitung sebagai uang bebas.
    const spentByCategory = new Map<string, number>();
    for (const t of monthExpenses) {
      const name = t.category?.name;
      if (!name) continue;
      spentByCategory.set(name, (spentByCategory.get(name) ?? 0) + Number(t.amount));
    }
    const reserved = sum(
      budgets.map((b) => Math.max(0, Number(b.amount) - (spentByCategory.get(b.category_name) ?? 0))),
    );

    const safe = safeToSpend(balance, reserved, now);

    /*
      * Kunci peta tetap nama tersimpan — itu yang dipakai mencocokkan budget.
      * Yang diterjemahkan hanya label yang tampil di donat.
      */
    const slices: Slice[] = [...spentByCategory.entries()].map(([name, value]) => {
      const row = monthExpenses.find((t) => t.category?.name === name)?.category;
      return {
        label: row ? categoryLabel(row, d.categoryNames) : name,
        value,
        color: row?.color ?? '#8A97A6',
      };
    });

    const points: TxPoint[] = transactions.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      occurred_at: t.occurred_at,
      kind: t.kind,
      merchant: t.merchant,
      category_name: t.category?.name ?? null,
    }));

    const findings = runDetectors(
      points,
      budgets.map((b) => ({ category_name: b.category_name, amount: Number(b.amount) })),
      spentByCategory,
      now,
      {
        money,
        compact,
        text: d.findings,
        label: (name) => {
          const row = transactions.find((t) => t.category?.name === name)?.category;
          return row ? categoryLabel(row, d.categoryNames) : name;
        },
      },
    );

    return {
      balance,
      safe,
      spentToday,
      monthIncome,
      monthExpense,
      previousMonthExpense,
      series,
      projection,
      slices,
      findings,
      recent: transactions.slice(0, 5),
      isEmpty: transactions.length === 0,
      loading,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions, budgets, loading, money, compact, d]);
}

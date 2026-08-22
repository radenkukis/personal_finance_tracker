/**
 * Pemformat nominal yang mengikuti mata uang pilihan user.
 *
 * Semua komponen memakai hook ini, bukan memanggil pemformat langsung —
 * dengan begitu mengganti mata uang di Pengaturan langsung mengubah seluruh
 * layar tanpa ada satu pun tempat yang ketinggalan memakai "Rp".
 */
import { useMemo } from 'react';
import { useSession } from '@/store/session';
import {
  formatMoney,
  formatMoneyCompact,
  formatMoneySigned,
  getCurrency,
  type Currency,
} from '@/lib/currency';
import type { TxKind } from '@/types/db';

export interface MoneyFormatter {
  currency: Currency;
  /** Nominal penuh: "Rp 1.250.000" */
  money: (amount: number) => string;
  /** Nominal ringkas untuk grafik: "Rp 1,25jt" */
  compact: (amount: number) => string;
  /** Nominal bertanda untuk baris transaksi: "−Rp 35.000" */
  signed: (amount: number, kind: TxKind) => string;
}

export function useMoney(): MoneyFormatter {
  const { profile } = useSession();
  const code = profile?.currency;

  return useMemo(() => {
    const currency = getCurrency(code);
    return {
      currency,
      money: (amount) => formatMoney(amount, currency),
      compact: (amount) => formatMoneyCompact(amount, currency),
      signed: (amount, kind) => formatMoneySigned(amount, kind, currency),
    };
  }, [code]);
}

/** Tiga angka ringkas bulan berjalan: masuk, keluar, sisa. */
import { View } from 'react-native';
import { Card, Txt } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import { percentChange } from '@/analytics/projection';
import { rupiahCompact } from '@/lib/format';

export function StatStrip({
  income,
  expense,
  previousExpense,
}: {
  income: number;
  expense: number;
  previousExpense: number;
}) {
  const net = income - expense;
  const change = percentChange(expense, previousExpense);

  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Stat label="Masuk" value={rupiahCompact(income)} tone={colors.income} />
      <Stat
        label="Keluar"
        value={rupiahCompact(expense)}
        tone={colors.expense}
        hint={change === null ? undefined : `${formatChange(change)} vs bulan lalu`}
        hintTone={change !== null && change > 0 ? colors.warning : colors.textFaint}
      />
      <Stat
        label="Sisa"
        value={rupiahCompact(net)}
        tone={net >= 0 ? colors.text : colors.expense}
      />
    </View>
  );
}

/**
 * Bulan lalu yang nyaris kosong menghasilkan persentase raksasa ("↑ 2446%")
 * yang secara hitungan benar tapi tidak berarti apa-apa bagi pembaca.
 * Dibatasi supaya tetap jujur tanpa jadi omong kosong.
 */
const MAX_SHOWN_PERCENT = 999;

function formatChange(change: number): string {
  const arrow = change >= 0 ? '↑' : '↓';
  const magnitude = Math.abs(Math.round(change));
  return magnitude > MAX_SHOWN_PERCENT
    ? `${arrow} >${MAX_SHOWN_PERCENT}%`
    : `${arrow} ${magnitude}%`;
}

function Stat({
  label,
  value,
  tone,
  hint,
  hintTone,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
  hintTone?: string;
}) {
  return (
    <Card style={{ flex: 1, padding: space.md }}>
      <Txt variant="overline" color={colors.textFaint}>
        {label}
      </Txt>
      <Txt variant="amount" color={tone} style={{ marginTop: 4 }} numberOfLines={1}>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="caption" color={hintTone ?? colors.textFaint} numberOfLines={1} style={{ marginTop: 2 }}>
          {hint}
        </Txt>
      ) : null}
    </Card>
  );
}

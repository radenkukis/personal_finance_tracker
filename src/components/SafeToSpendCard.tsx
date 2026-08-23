/**
 * Kartu utama dashboard: jatah aman per hari.
 *
 * Dipilih sebagai angka terbesar di layar karena ini satu-satunya angka yang
 * langsung bisa ditindaklanjuti — "boleh jajan atau tidak" terjawab seketika,
 * berbeda dengan "total pengeluaran bulan ini" yang hanya informatif.
 */
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, Txt, withAlpha } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';
import type { SafeToSpend } from '@/analytics/projection';

export function SafeToSpendCard({
  data,
  spentToday,
}: {
  data: SafeToSpend;
  spentToday: number;
}) {
  const { money } = useMoney();
  const { d, fill } = useT();
  const usedRatio = data.perDay > 0 ? Math.min(1, spentToday / data.perDay) : 0;
  const overToday = spentToday > data.perDay && data.perDay > 0;

  const tone = data.overdrawn ? colors.expense : overToday ? colors.warning : colors.accent;

  return (
    <Card style={{ padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Txt variant="overline" color={colors.textFaint}>
          {data.overdrawn ? d.home.overdrawn : d.home.safeToSpend}
        </Txt>
      </View>

      <Txt variant="display" color={tone} style={{ marginTop: space.xs }}>
        {data.overdrawn ? money(data.available) : money(Math.floor(data.perDay))}
      </Txt>

      <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
        {data.overdrawn
          ? d.home.overdrawnBody
          : fill(d.home.perDayUntilMonthEnd, { days: data.daysLeft })}
      </Txt>

      {/* Bilah tipis: berapa banyak jatah hari ini yang sudah terpakai. */}
      {!data.overdrawn ? (
        <>
          <View style={styles.track}>
            <View
              style={{
                width: `${usedRatio * 100}%`,
                height: '100%',
                borderRadius: radius.pill,
                backgroundColor: overToday ? colors.warning : colors.accent,
              }}
            />
          </View>

          <View style={styles.footer}>
            <Txt variant="caption" color={colors.textMuted}>
              {fill(d.home.spentToday, { amount: money(spentToday) })}
            </Txt>
            {overToday ? (
              <View style={[styles.pill, { backgroundColor: withAlpha(colors.warning, 0.14) }]}>
                <Feather name="alert-triangle" size={11} color={colors.warning} />
                <Txt variant="caption" color={colors.warning}>
                  {d.home.overBudgetToday}
                </Txt>
              </View>
            ) : (
              <Txt variant="caption" color={colors.textFaint}>
                {fill(d.home.remaining, {
                  amount: money(Math.max(0, Math.floor(data.perDay - spentToday))),
                })}
              </Txt>
            )}
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = {
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden' as const,
    marginTop: space.lg,
  },
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: space.sm,
  },
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
};

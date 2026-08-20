/**
 * Batang pengeluaran harian sepanjang bulan berjalan, ditambah batang samar
 * untuk sisa hari sebagai proyeksi.
 *
 * Dipisah tegas secara visual: yang sudah terjadi berwarna pekat, yang masih
 * ramalan berwarna samar dan bergaris putus-putus. User harus bisa langsung
 * tahu mana fakta dan mana tebakan.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Rect } from 'react-native-svg';
import { colors, radius, space } from '@/lib/theme';
import { Txt } from '@/components/ui';
import { rupiahCompact } from '@/lib/format';
import type { DaySpend, MonthProjection } from '@/analytics/projection';
import { dayKey } from '@/lib/format';

const HEIGHT = 92;
const GAP = 2;

export function DayTrendChart({
  series,
  projection,
  today = new Date(),
}: {
  series: readonly DaySpend[];
  projection: MonthProjection;
  today?: Date;
}) {
  const [width, setWidth] = useState(0);

  const todayKey = dayKey(today);
  const projectedPerDay =
    projection.daysRemaining > 0
      ? (projection.projectedTotal - projection.spentSoFar) / projection.daysRemaining
      : 0;

  // Skala ditentukan oleh nilai tertinggi antara yang nyata dan yang diramalkan,
  // supaya batang proyeksi tidak terpotong.
  const peak = Math.max(
    ...series.map((d) => d.total),
    projectedPerDay,
    1,
  );

  const barWidth =
    width > 0 && series.length > 0
      ? Math.max(2, (width - GAP * (series.length - 1)) / series.length)
      : 0;

  const avgY = HEIGHT - (projection.dailyAverage / peak) * HEIGHT;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm }}>
        <Txt variant="caption" color={colors.textMuted}>
          Rata-rata {rupiahCompact(projection.dailyAverage)}/hari
        </Txt>
        {projection.daysRemaining > 0 ? (
          <Txt variant="caption" color={colors.textFaint}>
            Proyeksi {rupiahCompact(projection.projectedTotal)}
          </Txt>
        ) : null}
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {/* Garis rata-rata harian — pembanding cepat untuk tiap batang. */}
            {projection.dailyAverage > 0 ? (
              <Line
                x1={0}
                y1={avgY}
                x2={width}
                y2={avgY}
                stroke={colors.hairlineStrong}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}

            <G>
              {series.map((d, i) => {
                const isFuture = d.key > todayKey;
                const isToday = d.key === todayKey;
                const value = isFuture ? projectedPerDay : d.total;
                const h = Math.max(value > 0 ? 2 : 0, (value / peak) * HEIGHT);
                const x = i * (barWidth + GAP);

                return (
                  <Rect
                    key={d.key}
                    x={x}
                    y={HEIGHT - h}
                    width={barWidth}
                    height={h}
                    rx={Math.min(2, barWidth / 2)}
                    fill={isFuture ? colors.barIdle : isToday ? colors.accent : colors.expense}
                    opacity={isFuture ? 0.55 : isToday ? 1 : 0.75}
                  />
                );
              })}
            </G>
          </Svg>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <LegendDot color={colors.expense} label="Terpakai" />
        <LegendDot color={colors.accent} label="Hari ini" />
        {projection.daysRemaining > 0 ? (
          <LegendDot color={colors.barIdle} label="Proyeksi" />
        ) : null}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color }} />
      <Txt variant="caption" color={colors.textFaint}>
        {label}
      </Txt>
    </View>
  );
}

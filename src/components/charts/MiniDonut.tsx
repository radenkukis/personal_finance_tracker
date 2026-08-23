/**
 * Donat porsi kategori, versi padat: cincin di kiri, daftar di kanan.
 * Kategori di luar lima besar digabung jadi "Lainnya" — donat dengan dua
 * belas irisan tipis tidak terbaca dan hanya menambah keramaian.
 */
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, radius, space } from '@/lib/theme';
import { Txt } from '@/components/ui';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

const SIZE = 96;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_SLICES = 5;

export function MiniDonut({ slices }: { slices: readonly Slice[] }) {
  const { compact } = useMoney();
  const { d } = useT();
  const merged = mergeTail(slices, d.home.otherCategories);
  const total = merged.reduce((acc, s) => acc + s.value, 0);

  if (total <= 0) {
    return (
      <Txt variant="caption" color={colors.textFaint}>
        {d.home.noSpendingYet}
      </Txt>
    );
  }

  let offset = 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
      <Svg width={SIZE} height={SIZE}>
        {/* Diputar -90° supaya irisan pertama mulai dari atas, bukan dari kanan. */}
        <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.surfaceRaised}
            strokeWidth={STROKE}
            fill="none"
          />
          {merged.map((s) => {
            const fraction = s.value / total;
            const dash = fraction * CIRCUMFERENCE;
            const el = (
              <Circle
                key={s.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={s.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </G>
      </Svg>

      <View style={{ flex: 1, gap: 6 }}>
        {merged.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View
              style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: s.color }}
            />
            <Txt variant="caption" style={{ flex: 1 }} numberOfLines={1}>
              {s.label}
            </Txt>
            <Txt variant="caption" color={colors.textMuted}>
              {Math.round((s.value / total) * 100)}%
            </Txt>
            <Txt variant="caption" color={colors.textFaint} style={{ width: 62, textAlign: 'right' }}>
              {compact(s.value)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function mergeTail(slices: readonly Slice[], otherLabel: string): Slice[] {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;

  const head = sorted.slice(0, MAX_SLICES - 1);
  const tailTotal = sorted.slice(MAX_SLICES - 1).reduce((acc, s) => acc + s.value, 0);
  return [...head, { label: otherLabel, value: tailTotal, color: colors.textFaint }];
}

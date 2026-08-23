/**
 * Penyaring riwayat: jenis, rentang waktu, dan rentang nominal.
 *
 * Rentang waktu memakai pilihan siap pakai, bukan dua pemilih tanggal.
 * Pertanyaan yang sebenarnya muncul di kepala orang adalah "bulan lalu berapa"
 * atau "30 hari terakhir", bukan "1 Juli sampai 31 Juli" — dan pilihan siap
 * pakai menjawab itu dengan satu ketukan.
 */
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Divider, Txt, withAlpha } from '@/components/ui';
import { colors, radius, space, type } from '@/lib/theme';
import type { Dictionary } from '@/lib/i18n';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';
import { EMPTY_FILTERS, type Filters, type KindFilter, type RangeKey } from '@/lib/filters';

export function TransactionFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const { currency } = useMoney();
  const { d, fill } = useT();
  const [min, setMin] = useState(value.minAmount?.toString() ?? '');
  const [max, setMax] = useState(value.maxAmount?.toString() ?? '');

  const commitAmounts = (nextMin: string, nextMax: string) => {
    const parse = (s: string) => {
      const digits = s.replace(/\D/g, '');
      return digits ? Number(digits) : null;
    };
    onChange({ ...value, minAmount: parse(nextMin), maxAmount: parse(nextMax) });
  };

  return (
    <View style={{ gap: space.md }}>
      <Row label={d.history.filterKind}>
        {kindLabels(d).map(([key, label]) => (
          <Pill
            key={key}
            label={label}
            active={value.kind === key}
            onPress={() => onChange({ ...value, kind: key })}
          />
        ))}
      </Row>

      <Row label={d.history.filterTime}>
        {rangeLabels(d).map(([key, label]) => (
          <Pill
            key={key}
            label={label}
            active={value.range === key}
            onPress={() => onChange({ ...value, range: key })}
          />
        ))}
      </Row>

      <View>
        <Txt variant="overline" color={colors.textFaint} style={{ marginBottom: space.sm }}>
          {fill(d.history.filterAmount, { currency: currency.code })}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <TextInput
            value={min}
            onChangeText={(v) => {
              setMin(v);
              commitAmounts(v, max);
            }}
            placeholder={d.history.min}
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            style={[type.body, styles.amountInput]}
            accessibilityLabel={d.history.min}
          />
          <Txt variant="caption" color={colors.textFaint}>
            —
          </Txt>
          <TextInput
            value={max}
            onChangeText={(v) => {
              setMax(v);
              commitAmounts(min, v);
            }}
            placeholder={d.history.max}
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            style={[type.body, styles.amountInput]}
            accessibilityLabel={d.history.max}
          />
        </View>
      </View>

      <Divider />

      <Pressable
        onPress={() => {
          setMin('');
          setMax('');
          onChange(EMPTY_FILTERS);
        }}
        accessibilityLabel={d.history.clearFilters}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
      >
        <Feather name="rotate-ccw" size={13} color={colors.textMuted} />
        <Txt variant="caption" color={colors.textMuted}>
          {d.history.clearFilters}
        </Txt>
      </Pressable>
    </View>
  );
}

/** Label pilihan dibuat di sini, bukan di modul filters, karena teksnya
 *  ikut bahasa sedangkan nilainya tidak. */
function kindLabels(d: Dictionary): [KindFilter, string][] {
  return [
    ['all', d.common.all],
    ['expense', d.common.expense],
    ['income', d.common.income],
  ];
}

function rangeLabels(d: Dictionary): [RangeKey, string][] {
  return [
    ['all', d.history.rangeAll],
    ['this_month', d.history.rangeThisMonth],
    ['last_month', d.history.rangeLastMonth],
    ['last_7', d.history.range7],
    ['last_30', d.history.range30],
  ];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Txt variant="overline" color={colors.textFaint} style={{ marginBottom: space.sm }}>
        {label}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: active ? withAlpha(colors.accent, 0.16) : colors.surfaceRaised,
        borderWidth: 1,
        borderColor: active ? colors.accent : 'transparent',
      }}
    >
      <Txt variant="caption" color={active ? colors.accent : colors.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = {
  amountInput: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
};

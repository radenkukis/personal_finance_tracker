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
import { useMoney } from '@/hooks/useMoney';
import {
  EMPTY_FILTERS,
  KIND_LABELS,
  RANGE_LABELS,
  type Filters,
} from '@/lib/filters';

export function TransactionFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const { currency } = useMoney();
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
      <Row label="Jenis">
        {KIND_LABELS.map(([key, label]) => (
          <Pill
            key={key}
            label={label}
            active={value.kind === key}
            onPress={() => onChange({ ...value, kind: key })}
          />
        ))}
      </Row>

      <Row label="Waktu">
        {RANGE_LABELS.map(([key, label]) => (
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
          Nominal ({currency.code})
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <TextInput
            value={min}
            onChangeText={(v) => {
              setMin(v);
              commitAmounts(v, max);
            }}
            placeholder="minimal"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            style={[type.body, styles.amountInput]}
            accessibilityLabel="Nominal minimal"
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
            placeholder="maksimal"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            style={[type.body, styles.amountInput]}
            accessibilityLabel="Nominal maksimal"
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
        accessibilityLabel="Bersihkan semua penyaring"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
      >
        <Feather name="rotate-ccw" size={13} color={colors.textMuted} />
        <Txt variant="caption" color={colors.textMuted}>
          Bersihkan penyaring
        </Txt>
      </Pressable>
    </View>
  );
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

/**
 * Pemilih mata uang: modal berisi daftar lengkap dengan pencarian.
 *
 * Daftarnya panjang, jadi pencarian ditaruh di atas dan langsung terfokus.
 * Tiap baris memperlihatkan contoh format aslinya — user tahu persis seperti
 * apa nominalnya akan tampil sebelum memilih, bukan sekadar menebak dari kode.
 */
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Divider, Txt, withAlpha } from '@/components/ui';
import { colors, radius, size, space, type } from '@/lib/theme';
import { formatMoney, searchCurrencies, type Currency } from '@/lib/currency';

/** Nominal contoh yang cukup besar untuk memperlihatkan pemisah ribuan. */
const SAMPLE = 1_250_000;

export function CurrencyPicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: Currency;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchCurrencies(query), [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Txt variant="title">Mata uang</Txt>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Tutup">
            <Feather name="x" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
          <View style={styles.search}>
            <Feather name="search" size={size.iconSm} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari nama, kode, atau simbol…"
              placeholderTextColor={colors.textFaint}
              style={[type.body, { flex: 1, color: colors.text, padding: 0 }]}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Cari mata uang"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Hapus pencarian">
                <Feather name="x-circle" size={size.iconSm} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(c) => c.code}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: insets.bottom + space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Txt variant="caption" color={colors.textFaint} style={{ paddingVertical: space.xl }}>
              Tidak ada mata uang yang cocok dengan “{query}”.
            </Txt>
          }
          renderItem={({ item }) => {
            const active = item.code === current.code;
            return (
              <Pressable
                onPress={() => onPick(item.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfacePressed },
                ]}
              >
                <View
                  style={[
                    styles.codeBadge,
                    active && { backgroundColor: withAlpha(colors.accent, 0.16) },
                  ]}
                >
                  <Txt variant="caption" color={active ? colors.accent : colors.textMuted}>
                    {item.code}
                  </Txt>
                </View>

                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {item.name}
                  </Txt>
                  <Txt variant="caption" color={colors.textFaint}>
                    {formatMoney(SAMPLE, item)}
                  </Txt>
                </View>

                {active ? <Feather name="check" size={18} color={colors.accent} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = {
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  search: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    height: size.touchMin,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceRaised,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.md,
  },
  codeBadge: {
    width: 52,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center' as const,
  },
};

/**
 * Pemilih bahasa antarmuka.
 *
 * Tiap baris ditulis dalam bahasanya sendiri lebih dulu — orang mencari
 * "日本語", bukan "Japanese". Nama Inggrisnya tetap ditampilkan kecil di
 * bawahnya supaya daftar ini masih bisa dibaca oleh siapa pun yang tersesat
 * ke sini dengan bahasa yang salah.
 *
 * Tiap baris juga jujur soal konsekuensinya: bahasa yang parser di HP
 * mengerti ditandai "instan", sisanya lewat AI. Ini bukan detail teknis —
 * itu bedanya antara catatan yang tersimpan seketika dan yang menunggu
 * jaringan.
 */
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Divider, Txt, withAlpha } from '@/components/ui';
import { colors, radius, size, space, type } from '@/lib/theme';
import { LOCALES, LOCALE_NAMES, PARSER_LOCALES, type Locale } from '@/lib/i18n';
import { useT } from '@/hooks/useT';

export function LanguagePicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: Locale;
  onPick: (code: Locale) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { d, fill } = useT();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LOCALES;
    return LOCALES.filter((l) => {
      const n = LOCALE_NAMES[l];
      return (
        l.toLowerCase().includes(q) ||
        n.native.toLowerCase().includes(q) ||
        n.english.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Txt variant="title">{d.languagePicker.title}</Txt>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={d.common.close}>
            <Feather name="x" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
          <View style={styles.search}>
            <Feather name="search" size={size.iconSm} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={d.languagePicker.searchPlaceholder}
              placeholderTextColor={colors.textFaint}
              style={[type.body, { flex: 1, color: colors.text, padding: 0 }]}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={d.languagePicker.searchPlaceholder}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={d.common.close}>
                <Feather name="x-circle" size={size.iconSm} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(l) => l}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: insets.bottom + space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Txt variant="caption" color={colors.textFaint} style={{ paddingVertical: space.xl }}>
              {fill(d.languagePicker.noMatch, { query })}
            </Txt>
          }
          renderItem={({ item }) => {
            const active = item === current;
            const names = LOCALE_NAMES[item];
            const instant = PARSER_LOCALES.includes(item);

            return (
              <Pressable
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfacePressed },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {names.native}
                  </Txt>
                  <Txt variant="caption" color={colors.textFaint} style={{ marginTop: 2 }}>
                    {names.english}
                  </Txt>
                </View>

                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: withAlpha(
                        instant ? colors.accent : colors.textFaint,
                        0.14,
                      ),
                    },
                  ]}
                >
                  <Feather
                    name={instant ? 'zap' : 'cpu'}
                    size={10}
                    color={instant ? colors.accent : colors.textMuted}
                  />
                  <Txt variant="caption" color={instant ? colors.accent : colors.textMuted}>
                    {instant ? d.languagePicker.fastParser : d.languagePicker.aiOnly}
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
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
};

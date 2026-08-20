/** Baris transaksi padat (56px) — bentuk yang sama dipakai di dashboard & riwayat. */
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { IconBadge, Txt } from '@/components/ui';
import { colors, size, space } from '@/lib/theme';
import { clockTime, signedRupiah } from '@/lib/format';
import type { TransactionWithRefs } from '@/types/db';

type FeatherName = keyof typeof Feather.glyphMap;

/** Nama ikon di database -> ikon Feather. */
const ICONS: Record<string, FeatherName> = {
  food: 'coffee',
  car: 'navigation',
  cart: 'shopping-bag',
  receipt: 'file-text',
  health: 'heart',
  game: 'film',
  book: 'book-open',
  home: 'home',
  gift: 'gift',
  tag: 'tag',
  wallet: 'credit-card',
  laptop: 'monitor',
  plus: 'plus-circle',
};

export function TransactionRow({
  tx,
  onPress,
}: {
  tx: TransactionWithRefs;
  onPress?: () => void;
}) {
  const color = tx.category?.color ?? colors.textFaint;
  const icon = ICONS[tx.category?.icon ?? 'tag'] ?? 'tag';
  const title = tx.merchant?.trim() || tx.category?.name || 'Tanpa kategori';

  // Hasil AI dengan keyakinan rendah ditandai supaya user tahu perlu dicek.
  const uncertain = tx.ai_confidence !== null && tx.ai_confidence < 0.6;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: size.rowHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.md,
        },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}
    >
      <IconBadge name={icon} color={color} diameter={32} />

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Txt>
          {uncertain ? <Feather name="help-circle" size={12} color={colors.warning} /> : null}
          {tx.source !== 'manual' ? (
            <Feather name="zap" size={11} color={colors.textFaint} />
          ) : null}
        </View>
        <Txt variant="caption" color={colors.textFaint} numberOfLines={1}>
          {[tx.category?.name, tx.account?.name, clockTime(new Date(tx.occurred_at))]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </View>

      <Txt variant="amount" color={tx.kind === 'income' ? colors.income : colors.text}>
        {signedRupiah(tx.amount, tx.kind)}
      </Txt>
    </Pressable>
  );
}

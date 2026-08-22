/**
 * Editor satu transaksi, dipakai di tiga tempat berbeda:
 *
 *   1. Konfirmasi hasil AI/parser sebelum disimpan
 *   2. Isi manual dari nol
 *   3. Menyunting transaksi yang sudah tersimpan
 *
 * Satu bentuk untuk ketiganya bukan sekadar hemat kode: user cuma perlu
 * belajar satu tata letak, dan perbaikan di satu tempat langsung terasa di
 * semua jalur.
 *
 * AI tidak pernah menulis langsung. Hasilnya selalu lewat sini dulu, dan yang
 * keyakinannya rendah ditandai jelas.
 */
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Card, Divider, IconBadge, Txt, withAlpha } from '@/components/ui';
import { colors, radius, space, type } from '@/lib/theme';
import { clockTime, relativeDay } from '@/lib/format';
import { useMoney } from '@/hooks/useMoney';
import { sameCategoryName } from '@/lib/categories';
import type { Category, DraftTransaction } from '@/types/db';

const LOW_CONFIDENCE = 0.6;

export function DraftReviewSheet({
  drafts,
  categories,
  onChange,
  onRemove,
}: {
  drafts: readonly DraftTransaction[];
  categories: readonly Category[];
  onChange: (index: number, patch: Partial<DraftTransaction>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      {drafts.map((draft, i) => (
        <TransactionEditorCard
          key={`${draft.raw_input}-${i}`}
          draft={draft}
          categories={categories}
          onChange={(patch) => onChange(i, patch)}
          onRemove={drafts.length > 1 ? () => onRemove(i) : undefined}
        />
      ))}
    </View>
  );
}

export function TransactionEditorCard({
  draft,
  categories,
  onChange,
  onRemove,
}: {
  draft: DraftTransaction;
  categories: readonly Category[];
  onChange: (patch: Partial<DraftTransaction>) => void;
  /** Disembunyikan saat hanya ada satu draft — membuang semuanya tidak berguna. */
  onRemove?: () => void;
}) {
  const { currency } = useMoney();
  const [picking, setPicking] = useState<'date' | 'time' | null>(null);

  const uncertain = draft.confidence < LOW_CONFIDENCE;
  const occurred = useMemo(() => new Date(draft.occurred_at), [draft.occurred_at]);

  const pool = useMemo(
    () => categories.filter((c) => c.kind === draft.kind),
    [categories, draft.kind],
  );

  /*
   * Usulan hanya berlaku selama namanya memang belum ada. Begitu user memilih
   * kategori lama dari deretan chip, `category_name` berubah dan usulannya
   * lenyap — tidak ada kategori yang terlanjur dibuat.
   */
  const proposed =
    draft.category_is_new && draft.category_name
      ? pool.some((c) => sameCategoryName(c.name, draft.category_name!))
        ? null
        : draft.category_name
      : null;

  return (
    <Card style={uncertain ? { borderColor: withAlpha(colors.warning, 0.5) } : undefined}>
      {/* Jenis, nominal, hapus */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Pressable
          onPress={() =>
            onChange({
              kind: draft.kind === 'expense' ? 'income' : 'expense',
              category_name: null,
              category_is_new: false,
            })
          }
          accessibilityLabel="Ganti jenis transaksi"
          style={{ alignItems: 'center', gap: 3 }}
        >
          <IconBadge
            name={draft.kind === 'income' ? 'arrow-down-left' : 'arrow-up-right'}
            color={draft.kind === 'income' ? colors.income : colors.expense}
            diameter={32}
          />
          <Txt variant="caption" color={colors.textFaint}>
            {draft.kind === 'income' ? 'masuk' : 'keluar'}
          </Txt>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Txt variant="overline" color={colors.textFaint}>
            Nominal
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Txt variant="displaySm" color={colors.textMuted}>
              {currency.symbol}
            </Txt>
            <TextInput
              value={groupWith(draft.amount, currency.group)}
              onChangeText={(v) => onChange({ amount: parseDigits(v) })}
              keyboardType="number-pad"
              selectTextOnFocus
              style={[type.displaySm, { color: colors.text, flex: 1, padding: 0 }]}
              accessibilityLabel="Nominal transaksi"
            />
          </View>
        </View>

        {onRemove ? (
          <Pressable onPress={onRemove} accessibilityLabel="Hapus draft ini" hitSlop={10}>
            <Feather name="x" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {uncertain ? (
        <View style={styles.warnRow}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Txt variant="caption" color={colors.warning}>
            Kurang yakin — mohon dicek dulu
          </Txt>
        </View>
      ) : null}

      <View style={{ marginVertical: space.md }}>
        <Divider />
      </View>

      {/* Tempat & catatan */}
      <View style={{ gap: space.sm }}>
        <TextInput
          value={draft.merchant ?? ''}
          onChangeText={(v) => onChange({ merchant: v.trim() ? v : null })}
          placeholder="Nama tempat (opsional)"
          placeholderTextColor={colors.textFaint}
          style={[type.body, styles.input]}
          accessibilityLabel="Nama tempat"
        />
        <TextInput
          value={draft.note ?? ''}
          onChangeText={(v) => onChange({ note: v.trim() ? v : null })}
          placeholder="Catatan — beli apa persisnya (opsional)"
          placeholderTextColor={colors.textFaint}
          style={[type.body, styles.input]}
          accessibilityLabel="Catatan"
        />
      </View>

      {/* Kategori */}
      <Txt variant="overline" color={colors.textFaint} style={{ marginTop: space.md }}>
        Kategori
      </Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: space.sm }}
      >
        {proposed ? (
          <Pressable
            onPress={() => onChange({ category_is_new: true, category_name: proposed })}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel={`Kategori baru ${proposed}`}
            style={[
              styles.chip,
              styles.newChip,
              { backgroundColor: withAlpha(colors.accent, 0.18), borderColor: colors.accent },
            ]}
          >
            <Feather name="plus" size={11} color={colors.accent} />
            <Txt variant="caption" color={colors.accent}>
              {proposed}
            </Txt>
            <View style={styles.newBadge}>
              <Txt variant="caption" color={colors.bg}>
                baru
              </Txt>
            </View>
          </Pressable>
        ) : null}

        {pool.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={!proposed && c.name === draft.category_name}
            color={c.color}
            onPress={() => onChange({ category_name: c.name, category_is_new: false })}
          />
        ))}
      </ScrollView>

      {proposed ? (
        <Txt variant="caption" color={colors.textFaint} style={{ lineHeight: 16 }}>
          Kategori baru akan dibuat saat kamu menyimpan. Pilih kategori lain di
          sampingnya kalau tidak jadi.
        </Txt>
      ) : null}

      {/* Waktu */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Pressable
          onPress={() => setPicking('date')}
          accessibilityLabel="Ganti tanggal"
          style={({ pressed }) => [styles.timeBtn, pressed && { borderColor: colors.accent }]}
        >
          <Feather name="calendar" size={13} color={colors.textFaint} />
          <Txt variant="caption">{relativeDay(occurred)}</Txt>
        </Pressable>

        <Pressable
          onPress={() => setPicking('time')}
          accessibilityLabel="Ganti jam"
          style={({ pressed }) => [styles.timeBtn, pressed && { borderColor: colors.accent }]}
        >
          <Feather name="clock" size={13} color={colors.textFaint} />
          <Txt variant="caption">{clockTime(occurred)}</Txt>
        </Pressable>
      </View>

      {picking ? (
        <DateTimePicker
          value={occurred}
          mode={picking}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          // Mencatat pengeluaran di masa depan tidak masuk akal; yang wajar
          // justru mengisi yang terlewat beberapa hari lalu.
          maximumDate={new Date()}
          onChange={(event, picked) => {
            if (Platform.OS !== 'ios') setPicking(null);
            if (event.type === 'dismissed' || !picked) return;

            // Pemilih tanggal hanya mengubah tanggalnya, pemilih jam hanya
            // jamnya. Tanpa penjagaan ini, memilih tanggal akan mereset jam
            // ke 00:00 dan urutan transaksi hari itu jadi berantakan.
            const next = new Date(occurred);
            if (picking === 'date') {
              next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            } else {
              next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            }
            onChange({ occurred_at: next.toISOString() });
          }}
        />
      ) : null}

      {picking && Platform.OS === 'ios' ? (
        <Pressable
          onPress={() => setPicking(null)}
          style={styles.doneBtn}
          accessibilityLabel="Selesai memilih waktu"
        >
          <Txt variant="caption" color={colors.accent}>
            Selesai
          </Txt>
        </Pressable>
      ) : null}
    </Card>
  );
}

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? withAlpha(color, 0.18) : colors.surfaceRaised,
          borderColor: active ? color : 'transparent',
        },
      ]}
    >
      <Txt variant="caption" color={active ? color : colors.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Pemisah ribuan mengikuti mata uang aktif, bukan selalu gaya Indonesia. */
function groupWith(amount: number, sep: string): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** "1.250.000" -> 1250000. Input nominal selalu bilangan bulat. */
function parseDigits(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

const styles = {
  warnRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: space.sm,
  },
  input: {
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  newChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  newBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  timeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  doneBtn: {
    alignSelf: 'flex-end' as const,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
};

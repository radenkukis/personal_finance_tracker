/**
 * Kelola kategori.
 *
 * Bagian terpenting yang mudah terlewat: KATA KUNCI. Parser gratis di HP
 * mencocokkan kategori lewat daftar kata itu, jadi menambahkan "seblak" ke
 * kategori Makan berarti catatan "seblak 15rb" berikutnya diurai seketika
 * tanpa menyentuh AI. Karena itu kata kunci ditaruh sebagai kolom yang bisa
 * disunting, bukan disembunyikan sebagai urusan internal.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button, Card, Divider, Field, IconBadge, SectionLabel, Txt, withAlpha } from '@/components/ui';
import { colors, radius, size, space } from '@/lib/theme';
import { CATEGORY_COLORS } from '@/lib/categories';
import { useData } from '@/store/data';
import { useT } from '@/hooks/useT';
import type { Dictionary } from '@/lib/i18n';
import type { Category, TxKind } from '@/types/db';

export default function KategoriScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories, createCategory, updateCategory, deleteCategory, countTransactionsIn } =
    useData();
  const { d, fill } = useT();

  const [editing, setEditing] = useState<Category | null>(null);
  const [creatingKind, setCreatingKind] = useState<TxKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === 'expense'),
      income: categories.filter((c) => c.kind === 'income'),
    }),
    [categories],
  );

  const confirmDelete = useCallback(
    (category: Category) => {
      const used = countTransactionsIn(category.id);
      Alert.alert(
        fill(d.categories.deleteTitle, { name: category.name }),
        used > 0
          ? fill(d.categories.deleteBodyUsed, { count: used })
          : d.categories.deleteBodyUnused,
        [
          { text: d.common.cancel, style: 'cancel' },
          {
            text: d.common.delete,
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCategory(category.id);
              } catch (e) {
                setError(e instanceof Error ? e.message : d.settings.saveFailed);
              }
            },
          },
        ],
      );
    },
    [countTransactionsIn, deleteCategory, d, fill],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Txt variant="title">{d.categories.title}</Txt>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={d.common.close}>
          <Feather name="x" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
      >
        {error ? (
          <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
            <Txt variant="caption" color={colors.expense}>
              {error}
            </Txt>
          </Card>
        ) : null}

        <Txt variant="caption" color={colors.textMuted} style={{ lineHeight: 18 }}>
          {d.categories.intro}
        </Txt>

        <CategoryGroup
          title={d.categories.expenses}
          d={d}
          fill={fill}
          items={groups.expense}
          onEdit={setEditing}
          onDelete={confirmDelete}
          onAdd={() => setCreatingKind('expense')}
          usageOf={countTransactionsIn}
        />

        <CategoryGroup
          title={d.categories.incomes}
          d={d}
          fill={fill}
          items={groups.income}
          onEdit={setEditing}
          onDelete={confirmDelete}
          onAdd={() => setCreatingKind('income')}
          usageOf={countTransactionsIn}
        />
      </ScrollView>

      {editing ? (
        <CategoryEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updateCategory(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            const target = editing;
            setEditing(null);
            confirmDelete(target);
          }}
        />
      ) : null}

      {creatingKind ? (
        <CategoryEditor
          initial={{ name: '', kind: creatingKind, color: CATEGORY_COLORS[0], keywords: [] }}
          onClose={() => setCreatingKind(null)}
          onSave={async (patch) => {
            await createCategory({
              name: patch.name ?? '',
              kind: creatingKind,
              color: patch.color,
              keywords: patch.keywords,
            });
            setCreatingKind(null);
          }}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------

function CategoryGroup({
  title,
  items,
  onEdit,
  onDelete,
  onAdd,
  usageOf,
  d,
  fill,
}: {
  title: string;
  items: readonly Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  onAdd: () => void;
  usageOf: (id: string) => number;
  d: Dictionary;
  fill: (template: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <View>
      <SectionLabel
        right={
          <Txt variant="caption" color={colors.textFaint}>
            {items.length}
          </Txt>
        }
      >
        {title}
      </SectionLabel>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        {items.map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => onEdit(c)}
              onLongPress={() => onDelete(c)}
              accessibilityLabel={c.name}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfacePressed },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {c.name}
                </Txt>
                <Txt variant="caption" color={colors.textFaint} numberOfLines={1}>
                  {c.keywords.length > 0
                    ? fill(d.categories.keywordCount, {
                        count: c.keywords.length,
                        transactions: usageOf(c.id),
                      })
                    : fill(d.categories.noKeywords, { transactions: usageOf(c.id) })}
                </Txt>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}

        {items.length > 0 ? <Divider /> : null}
        <Pressable
          onPress={onAdd}
          accessibilityLabel={`${d.categories.addCategory} · ${title}`}
          style={({ pressed }) => [
            styles.row,
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <IconBadge name="plus" color={colors.accent} diameter={28} />
          <Txt variant="bodyStrong" color={colors.accent} style={{ flex: 1 }}>
            {d.categories.addCategory}
          </Txt>
        </Pressable>
      </Card>

      <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.sm }}>
        {d.categories.listHint}
      </Txt>
    </View>
  );
}

// ---------------------------------------------------------------------

function CategoryEditor({
  initial,
  onSave,
  onClose,
  onDelete,
}: {
  initial: Pick<Category, 'name' | 'kind' | 'color' | 'keywords'>;
  onSave: (patch: Partial<Category>) => Promise<void>;
  onClose: () => void;
  /** Tidak ada saat membuat kategori baru — belum ada yang bisa dihapus. */
  onDelete?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { d } = useT();
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [keywords, setKeywords] = useState<string[]>([...initial.keywords]);
  const [draftKeyword, setDraftKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addKeyword = useCallback(() => {
    const word = draftKeyword.toLowerCase().trim();
    if (!word) return;
    setDraftKeyword('');
    setKeywords((prev) => (prev.includes(word) ? prev : [...prev, word]));
  }, [draftKeyword]);

  return (
    <View style={StyleSheetAbsoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={d.common.close} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />

          <Field
            label={d.categories.nameLabel}
            value={name}
            onChangeText={setName}
            placeholder={d.categories.namePlaceholder}
            autoFocus={!initial.name}
          />

          <Txt variant="overline" color={colors.textFaint} style={{ marginTop: space.lg }}>
            {d.categories.colorLabel}
          </Txt>
          <View style={styles.colorRow}>
            {CATEGORY_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityLabel={`${d.categories.colorLabel} ${c}`}
                accessibilityState={{ selected: c === color }}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  c === color && { borderWidth: 2, borderColor: colors.text },
                ]}
              />
            ))}
          </View>

          <Txt variant="overline" color={colors.textFaint} style={{ marginTop: space.lg }}>
            {d.categories.keywordsLabel}
          </Txt>
          <Txt variant="caption" color={colors.textFaint} style={{ marginBottom: space.sm }}>
            {d.categories.keywordsHint}
          </Txt>

          <View style={styles.keywordBox}>
            {keywords.map((k) => (
              <Pressable
                key={k}
                onPress={() => setKeywords((prev) => prev.filter((x) => x !== k))}
                accessibilityLabel={`${d.common.delete} ${k}`}
                style={[styles.keywordChip, { backgroundColor: withAlpha(color, 0.16) }]}
              >
                <Txt variant="caption" color={color}>
                  {k}
                </Txt>
                <Feather name="x" size={10} color={color} />
              </Pressable>
            ))}
            {keywords.length === 0 ? (
              <Txt variant="caption" color={colors.textFaint}>
                {d.categories.noKeywordsYet}
              </Txt>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                icon="hash"
                value={draftKeyword}
                onChangeText={setDraftKeyword}
                placeholder={d.categories.keywordPlaceholder}
                autoCapitalize="none"
                onSubmitEditing={addKeyword}
                returnKeyType="done"
              />
            </View>
            <Button
              title={d.common.add}
              variant="secondary"
              onPress={addKeyword}
              disabled={!draftKeyword.trim()}
            />
          </View>

          {error ? (
            <Txt variant="caption" color={colors.expense} style={{ marginTop: space.sm }}>
              {error}
            </Txt>
          ) : null}

          {onDelete ? (
            <>
              <View style={{ marginTop: space.lg }}>
                <Divider />
              </View>
              <Button
                title={d.categories.deleteThis}
                variant="danger"
                icon="trash-2"
                full
                style={{ marginTop: space.lg }}
                onPress={onDelete}
              />
            </>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
            <Button title={d.common.cancel} variant="secondary" onPress={onClose} />
            <Button
              title={d.common.save}
              icon="check"
              loading={busy}
              disabled={!name.trim()}
              style={{ flex: 1 }}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onSave({ name, color, keywords });
                } catch (e) {
                  setError(e instanceof Error ? e.message : d.settings.saveFailed);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

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
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingHorizontal: space.md,
    height: size.rowHeight,
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  backdrop: { ...StyleSheetAbsoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' as const },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: space.lg,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairlineStrong,
    alignSelf: 'center' as const,
    marginBottom: space.lg,
  },
  colorRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space.sm,
    marginTop: space.sm,
  },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  keywordBox: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    minHeight: 32,
    alignItems: 'center' as const,
  },
  keywordChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
};

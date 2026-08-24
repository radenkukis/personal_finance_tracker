/**
 * Menyunting transaksi yang sudah tersimpan.
 *
 * Memakai editor yang sama persis dengan layar konfirmasi, jadi tidak ada
 * tata letak kedua yang harus dipelajari user. Sebelumnya satu-satunya cara
 * membetulkan salah nominal adalah menghapus lalu mengetik ulang.
 */
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Card, EmptyState, Txt, withAlpha } from '@/components/ui';
import { TransactionEditorCard } from '@/components/DraftReviewSheet';
import { colors, space } from '@/lib/theme';
import { useData } from '@/store/data';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';
import { sameCategoryName } from '@/lib/categories';
import type { DraftTransaction } from '@/types/db';

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { transactions, categories, updateTransaction, deleteTransaction } = useData();
  const { money } = useMoney();
  const { d } = useT();

  const original = useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);

  const [draft, setDraft] = useState<DraftTransaction | null>(() =>
    original
      ? {
          kind: original.kind,
          amount: Number(original.amount),
          merchant: original.merchant,
          note: original.note,
          occurred_at: original.occurred_at,
          category_name: original.category?.name ?? null,
          category_is_new: false,
          account_name: original.account?.name ?? null,
          // Transaksi tersimpan bukan tebakan lagi, jadi jangan tampilkan
          // peringatan "kurang yakin" saat disunting.
          confidence: 1,
          source: original.source,
          raw_input: original.raw_input ?? '',
        }
      : null,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!draft || !original) return;
    if (draft.amount <= 0) {
      setError(d.editScreen.amountPositive);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const category = categories.find(
        (c) => c.kind === draft.kind && draft.category_name && sameCategoryName(c.name, draft.category_name),
      );

      await updateTransaction(original.id, {
        kind: draft.kind,
        amount: draft.amount,
        merchant: draft.merchant,
        note: draft.note,
        occurred_at: draft.occurred_at,
        category_id: category?.id ?? null,
        // Setelah disunting manusia, tanda keyakinan AI tidak berlaku lagi.
        ai_confidence: null,
        was_corrected: true,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : d.add.saveFailed);
    } finally {
      setBusy(false);
    }
  }, [draft, original, categories, updateTransaction, router, d]);

  if (!original || !draft) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.lg }}>
        <EmptyState
          icon="search"
          title={d.editScreen.notFoundTitle}
          body={d.editScreen.notFoundBody}
          action={<Button title={d.editScreen.back} variant="secondary" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const changed =
    draft.amount !== Number(original.amount) ||
    draft.kind !== original.kind ||
    (draft.merchant ?? '') !== (original.merchant ?? '') ||
    (draft.note ?? '') !== (original.note ?? '') ||
    draft.occurred_at !== original.occurred_at ||
    (draft.category_name ?? '') !== (original.category?.name ?? '');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Txt variant="title">{d.editScreen.title}</Txt>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={d.common.close}>
          <Feather name="x" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        <TransactionEditorCard
          locked={busy}
          draft={draft}
          categories={categories}
          onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
        />

        {changed ? (
          <Card style={{ borderColor: withAlpha(colors.accent, 0.4) }}>
            <Txt variant="overline" color={colors.textFaint}>
              {d.editScreen.beforeChange}
            </Txt>
            <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 4, lineHeight: 18 }}>
              {money(Number(original.amount))} ·{' '}
              {original.category?.name ?? d.common.uncategorized}
              {original.merchant ? ` · ${original.merchant}` : ''}
              {original.note ? ` · ${original.note}` : ''}
            </Txt>
          </Card>
        ) : null}

        {error ? (
          <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
            <Txt variant="caption" color={colors.expense}>
              {error}
            </Txt>
          </Card>
        ) : null}

        <Button
          title={d.editScreen.deleteTransaction}
          variant="danger"
          icon="trash-2"
          full
          disabled={busy}
          onPress={async () => {
            await deleteTransaction(original.id);
            router.back();
          }}
        />
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom || space.lg }]}>
        <Button title={d.common.cancel} variant="secondary" onPress={() => router.back()} />
        <Button
          title={d.editScreen.saveChanges}
          icon="check"
          onPress={save}
          loading={busy}
          disabled={!changed}
          style={{ flex: 1 }}
        />
      </View>
    </KeyboardAvoidingView>
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
  actions: {
    flexDirection: 'row' as const,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
  },
};

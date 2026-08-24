/**
 * Pratinjau sebelum/sesudah untuk perubahan yang diusulkan lewat chat.
 *
 * AI tidak pernah mengubah data sendiri. Kartu ini memperlihatkan persis
 * kolom mana yang berubah, dari apa menjadi apa, dan tidak ada yang tersimpan
 * sampai user menekan Konfirmasi. Kolom yang tidak berubah sengaja tidak
 * ditampilkan supaya yang penting tidak tenggelam.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button, Card, Divider, Txt, withAlpha } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import { useMoney } from '@/hooks/useMoney';
import { useT } from '@/hooks/useT';
import { categoryLabel } from '@/lib/categories';
import type { Amendment } from '@/lib/ai';
import type { TransactionWithRefs } from '@/types/db';

interface FieldChange {
  label: string;
  before: string;
  after: string;
}

export function AmendmentCard({
  amendment,
  transaction,
  onConfirm,
  onCancel,
}: {
  amendment: Amendment;
  transaction: TransactionWithRefs | undefined;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const { money } = useMoney();
  const { d, relativeDay } = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownCategory = transaction?.category
    ? categoryLabel(transaction.category, d.categoryNames)
    : null;

  const changes = useMemo<FieldChange[]>(() => {
    if (!transaction) return [];
    const out: FieldChange[] = [];
    const dash = '—';

    if (amendment.amount !== null && amendment.amount !== Number(transaction.amount)) {
      out.push({
        label: d.chat.fieldAmount,
        before: money(Number(transaction.amount)),
        after: money(amendment.amount),
      });
    }
    if (amendment.kind !== null && amendment.kind !== transaction.kind) {
      out.push({
        label: d.chat.fieldKind,
        before: transaction.kind === 'income' ? d.common.income : d.common.expense,
        after: amendment.kind === 'income' ? d.common.income : d.common.expense,
      });
    }
    if (amendment.category_name !== null && amendment.category_name !== shownCategory) {
      out.push({
        label: d.chat.fieldCategory,
        before: shownCategory ?? dash,
        after: amendment.category_name,
      });
    }
    if (amendment.merchant !== null && amendment.merchant !== transaction.merchant) {
      out.push({ label: d.chat.fieldMerchant, before: transaction.merchant ?? dash, after: amendment.merchant });
    }
    if (amendment.note !== null && amendment.note !== transaction.note) {
      out.push({ label: d.chat.fieldNote, before: transaction.note ?? dash, after: amendment.note });
    }
    return out;
  }, [amendment, transaction, money, d, shownCategory]);

  if (!transaction) {
    return (
      <Card style={{ borderColor: withAlpha(colors.warning, 0.5) }}>
        <Txt variant="caption" color={colors.warning}>
          {d.chat.amendmentMissing}
        </Txt>
      </Card>
    );
  }

  if (done) {
    return (
      <Card style={{ borderColor: withAlpha(colors.accent, 0.5) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Feather name="check-circle" size={15} color={colors.accent} />
          <Txt variant="caption" color={colors.accent}>
            {d.chat.amendmentSaved}
          </Txt>
        </View>
      </Card>
    );
  }

  if (changes.length === 0) {
    return (
      <Card>
        <Txt variant="caption" color={colors.textMuted}>
          {d.chat.amendmentNothing}
        </Txt>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: withAlpha(colors.accent, 0.4) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Feather name="edit-2" size={14} color={colors.accent} />
        <Txt variant="bodyStrong" color={colors.accent}>
          {d.chat.amendmentTitle}
        </Txt>
      </View>

      <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 4, lineHeight: 17 }}>
        {amendment.explanation}
      </Txt>

      <View style={{ marginVertical: space.md }}>
        <Divider />
      </View>

      <Txt variant="caption" color={colors.textFaint}>
        {[
          transaction.merchant ?? transaction.note ?? shownCategory,
          relativeDay(new Date(transaction.occurred_at)),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Txt>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {changes.map((c) => (
          <View key={c.label}>
            <Txt variant="overline" color={colors.textFaint}>
              {c.label}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 }}>
              <Txt
                variant="caption"
                color={colors.textMuted}
                style={{ textDecorationLine: 'line-through' }}
              >
                {c.before}
              </Txt>
              <Feather name="arrow-right" size={12} color={colors.textFaint} />
              <Txt variant="bodyStrong" color={colors.accent}>
                {c.after}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      {error ? (
        <Txt variant="caption" color={colors.expense} style={{ marginTop: space.sm }}>
          {error}
        </Txt>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Button title={d.common.cancel} variant="secondary" onPress={onCancel} />
        <Button
          title={d.common.confirm}
          icon="check"
          loading={busy}
          style={{ flex: 1 }}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm();
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : d.settings.saveFailed);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}

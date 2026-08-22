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
import { relativeDay } from '@/lib/format';
import { useMoney } from '@/hooks/useMoney';
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
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changes = useMemo<FieldChange[]>(() => {
    if (!transaction) return [];
    const out: FieldChange[] = [];
    const dash = '—';

    if (amendment.amount !== null && amendment.amount !== Number(transaction.amount)) {
      out.push({
        label: 'Nominal',
        before: money(Number(transaction.amount)),
        after: money(amendment.amount),
      });
    }
    if (amendment.kind !== null && amendment.kind !== transaction.kind) {
      out.push({
        label: 'Jenis',
        before: transaction.kind === 'income' ? 'Masuk' : 'Keluar',
        after: amendment.kind === 'income' ? 'Masuk' : 'Keluar',
      });
    }
    if (amendment.category_name !== null && amendment.category_name !== transaction.category?.name) {
      out.push({
        label: 'Kategori',
        before: transaction.category?.name ?? dash,
        after: amendment.category_name,
      });
    }
    if (amendment.merchant !== null && amendment.merchant !== transaction.merchant) {
      out.push({ label: 'Tempat', before: transaction.merchant ?? dash, after: amendment.merchant });
    }
    if (amendment.note !== null && amendment.note !== transaction.note) {
      out.push({ label: 'Catatan', before: transaction.note ?? dash, after: amendment.note });
    }
    return out;
  }, [amendment, transaction, money]);

  if (!transaction) {
    return (
      <Card style={{ borderColor: withAlpha(colors.warning, 0.5) }}>
        <Txt variant="caption" color={colors.warning}>
          Transaksi yang dimaksud tidak ditemukan. Mungkin sudah dihapus, atau
          terlalu lama sehingga belum termuat.
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
            Perubahan tersimpan.
          </Txt>
        </View>
      </Card>
    );
  }

  if (changes.length === 0) {
    return (
      <Card>
        <Txt variant="caption" color={colors.textMuted}>
          Tidak ada yang perlu diubah — nilainya sudah seperti itu.
        </Txt>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: withAlpha(colors.accent, 0.4) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Feather name="edit-2" size={14} color={colors.accent} />
        <Txt variant="bodyStrong" color={colors.accent}>
          Usulan perubahan
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
          transaction.merchant ?? transaction.note ?? transaction.category?.name,
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
        <Button title="Batal" variant="secondary" onPress={onCancel} />
        <Button
          title="Konfirmasi"
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
              setError(e instanceof Error ? e.message : 'Gagal menyimpan perubahan.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}

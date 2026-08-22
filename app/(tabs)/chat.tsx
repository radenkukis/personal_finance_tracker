import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, EmptyState, Txt, withAlpha } from '@/components/ui';
import { colors, radius, size, space, type } from '@/lib/theme';
import { aiMode, askQuestion, type Amendment } from '@/lib/ai';
import { AmendmentCard } from '@/components/AmendmentCard';
import { useData } from '@/store/data';
import { sameCategoryName } from '@/lib/categories';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /**
   * Giliran yang membawa usulan perubahan dirender sebagai kartu
   * sebelum/sesudah, bukan gelembung teks biasa.
   */
  amendment?: Amendment;
}

const SARAN = [
  'Aku boros di mana bulan ini?',
  'Bandingkan pengeluaranku bulan ini dengan bulan lalu',
  'Kategori apa yang paling naik?',
  'Ubah transaksi terakhir jadi 30rb',
];

export default function TanyaScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { transactions, categories, updateTransaction } = useData();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = aiMode() === 'remote';

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;

      setDraft('');
      setError(null);
      setBusy(true);

      const history = turns.slice();
      setTurns([...history, { role: 'user', content: trimmed }]);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      try {
        const reply = await askQuestion(
          trimmed,
          // Riwayat yang dikirim balik hanya berisi teks — kartu usulan tidak
          // perlu ikut, karena hasilnya sudah tercermin di data.
          history.map((t) => ({ role: t.role, content: t.content })),
        );

        setTurns((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: reply.answer ?? reply.amendment?.explanation ?? '',
            ...(reply.amendment ? { amendment: reply.amendment } : {}),
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal menghubungi AI.');
      } finally {
        setBusy(false);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }
    },
    [busy, turns],
  );

  /** Menerapkan usulan setelah user menekan Konfirmasi di kartu. */
  const applyAmendment = useCallback(
    async (a: Amendment) => {
      const target = transactions.find((t) => t.id === a.transaction_id);
      if (!target) throw new Error('Transaksinya sudah tidak ada.');

      const patch: Record<string, unknown> = { was_corrected: true };
      if (a.amount !== null) patch.amount = a.amount;
      if (a.kind !== null) patch.kind = a.kind;
      if (a.merchant !== null) patch.merchant = a.merchant;
      if (a.note !== null) patch.note = a.note;

      if (a.category_name !== null) {
        const kind = a.kind ?? target.kind;
        const category = categories.find(
          (c) => c.kind === kind && sameCategoryName(c.name, a.category_name!),
        );
        // Kategori yang tidak dikenali lebih baik diabaikan daripada
        // mengosongkan kategori yang sudah benar.
        if (category) patch.category_id = category.id;
      }

      await updateTransaction(a.transaction_id, patch);
    },
    [transactions, categories, updateTransaction],
  );

  if (!available) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + space.lg, justifyContent: 'center', padding: space.lg }}>
        <EmptyState
          icon="message-circle"
          title="Chat butuh AI diaktifkan"
          body="Fitur tanya-jawab memakai model bahasa, jadi tidak bisa jalan di mode gratis penuh. Aktifkan lewat tab Atur — ada panduan langkah demi langkah, termasuk opsi gratis."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={size.tabBarHeight}
    >
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg }}>
        <Txt variant="title">Tanya</Txt>
        <Txt variant="caption" color={colors.textFaint} style={{ marginTop: 2 }}>
          Dijawab pakai data transaksi kamu sendiri
        </Txt>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: space.xxl,
          gap: space.md,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
            <EmptyState
              icon="message-circle"
              title="Tanya apa saja soal uangmu"
              body="Jawabannya memakai angka nyata dari transaksi yang sudah kamu catat, bukan saran umum."
            />
            <View style={{ gap: 6 }}>
              {SARAN.map((s) => (
                <Pressable key={s} onPress={() => void send(s)} style={styles.suggestion}>
                  <Txt variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                    {s}
                  </Txt>
                  <Feather name="arrow-up-right" size={13} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          turns.map((turn, i) =>
            turn.amendment ? (
              <AmendmentCard
                key={i}
                amendment={turn.amendment}
                transaction={transactions.find((t) => t.id === turn.amendment!.transaction_id)}
                onConfirm={() => applyAmendment(turn.amendment!)}
                onCancel={() =>
                  setTurns((prev) =>
                    prev.map((t, idx) =>
                      idx === i ? { role: t.role, content: 'Baik, tidak jadi diubah.' } : t,
                    ),
                  )
                }
              />
            ) : (
              <Bubble key={i} turn={turn} />
            ),
          )
        )}

        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <ActivityIndicator size="small" color={colors.textFaint} />
            <Txt variant="caption" color={colors.textFaint}>
              Menghitung dari datamu…
            </Txt>
          </View>
        ) : null}

        {error ? (
          <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
            <Txt variant="caption" color={colors.expense}>
              {error}
            </Txt>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Tulis pertanyaan…"
          placeholderTextColor={colors.textFaint}
          style={[type.body, styles.composerInput]}
          multiline
          onSubmitEditing={() => void send(draft)}
          accessibilityLabel="Pertanyaan"
        />
        <Pressable
          onPress={() => void send(draft)}
          disabled={!draft.trim() || busy}
          accessibilityLabel="Kirim pertanyaan"
          style={[styles.sendButton, (!draft.trim() || busy) && { opacity: 0.4 }]}
        >
          <Feather name="arrow-up" size={18} color="#04140F" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ turn }: { turn: { role: 'user' | 'assistant'; content: string } }) {
  const isUser = turn.role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        isUser
          ? { alignSelf: 'flex-end', backgroundColor: colors.accentDim, borderColor: 'transparent' }
          : { alignSelf: 'flex-start' },
      ]}
    >
      <Txt variant="body" color={isUser ? colors.text : colors.text} style={{ lineHeight: 21 }}>
        {turn.content}
      </Txt>
    </View>
  );
}

const styles = {
  suggestion: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  bubble: {
    maxWidth: '88%' as const,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  composer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  composerInput: {
    flex: 1,
    color: colors.text,
    maxHeight: 110,
    minHeight: 40,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { Button, Card, Txt, withAlpha } from '@/components/ui';
import { DraftReviewSheet } from '@/components/DraftReviewSheet';
import { colors, radius, size, space, type } from '@/lib/theme';
import { aiMode, smartParse, transcribeAudio } from '@/lib/ai';
import { useData } from '@/store/data';
import type { DraftTransaction } from '@/types/db';

const CONTOH = ['kopi 25rb', 'bensin 50k gopay', 'kemarin makan di padang 45rb', 'gajian 8jt'];

/** Draft kosong untuk jalur isi manual — tidak lewat parser sama sekali. */
function draftKosong(): DraftTransaction {
  return {
    kind: 'expense',
    amount: 0,
    merchant: null,
    note: null,
    occurred_at: new Date().toISOString(),
    category_name: null,
    category_is_new: false,
    account_name: null,
    // Bukan tebakan siapa pun, jadi tidak perlu ditandai "kurang yakin".
    confidence: 1,
    source: 'manual',
    raw_input: '',
  };
}

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories, accounts, saveDrafts, recordCorrection } = useData();

  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<DraftTransaction[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedAI, setUsedAI] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voiceAvailable = aiMode() === 'remote';

  // -------------------------------------------------------------------
  // Urai teks
  // -------------------------------------------------------------------

  const runParse = useCallback(
    async (input: string, source: DraftTransaction['source'] = 'ai_text') => {
      const trimmed = input.trim();
      if (!trimmed) return;

      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const outcome = await smartParse(trimmed, categories, accounts, source);
        if (outcome.drafts.length === 0) {
          setError(outcome.warning ?? 'Belum ada transaksi yang bisa dibaca dari kalimat itu.');
          return;
        }
        setDrafts(outcome.drafts);
        setUsedAI(outcome.usedAI);
        setStatus(outcome.warning);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mengurai kalimat.');
      } finally {
        setBusy(false);
      }
    },
    [categories, accounts],
  );

  // -------------------------------------------------------------------
  // Rekam suara
  // -------------------------------------------------------------------

  const toggleRecording = useCallback(async () => {
    setError(null);

    if (recorder.isRecording) {
      setBusy(true);
      setStatus('Menyalin suara…');
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('Rekaman tidak tersimpan.');

        const base64 = await new File(uri).base64();
        const spoken = await transcribeAudio(base64, 'audio/m4a');

        setText(spoken);
        setStatus(null);
        await runParse(spoken, 'ai_voice');
      } catch (e) {
        setStatus(null);
        setError(e instanceof Error ? e.message : 'Gagal memproses rekaman.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Izin mikrofon ditolak. Aktifkan lewat pengaturan HP untuk memakai input suara.');
      return;
    }

    // Wajib di iOS: tanpa ini perekaman gagal diam-diam.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [recorder, runParse]);

  // -------------------------------------------------------------------
  // Simpan
  // -------------------------------------------------------------------

  const save = useCallback(async () => {
    if (!drafts) return;
    setBusy(true);
    setError(null);
    try {
      // Kategori yang diubah user dicatat sebagai koreksi, supaya tebakan
      // berikutnya mengikuti kebiasaannya.
      await Promise.all(
        drafts
          .filter((d) => d.category_name)
          .map((d) => recordCorrection(d.raw_input, null, d.category_name!)),
      );

      const count = await saveDrafts(drafts);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      if (count === 0) setError('Tidak ada yang tersimpan.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }, [drafts, saveDrafts, recordCorrection, router]);

  // -------------------------------------------------------------------

  const total = drafts?.reduce((acc, d) => acc + d.amount, 0) ?? 0;
  const manualEntry = drafts?.every((d) => d.source === 'manual') ?? false;
  // Nominal nol berarti user belum mengisi apa pun — jangan biarkan tersimpan.
  const canSave = (drafts?.length ?? 0) > 0 && drafts!.every((d) => d.amount > 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Txt variant="title">{drafts ? 'Periksa dulu' : 'Catat transaksi'}</Txt>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Tutup">
          <Feather name="x" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        {drafts ? (
          <>
            <View style={styles.badgeRow}>
              <Badge
                icon={manualEntry ? 'edit-3' : usedAI ? 'cpu' : 'zap'}
                label={manualEntry ? 'Isi manual' : usedAI ? 'Diurai AI' : 'Diurai di HP · gratis'}
                color={manualEntry ? colors.textMuted : usedAI ? colors.info : colors.accent}
              />
              <Badge
                icon="layers"
                label={`${drafts.length} transaksi`}
                color={colors.textMuted}
              />
            </View>

            <DraftReviewSheet
              drafts={drafts}
              categories={categories}
              onChange={(i, patch) =>
                setDrafts((prev) =>
                  prev ? prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) : prev,
                )
              }
              onRemove={(i) =>
                setDrafts((prev) => {
                  const next = prev?.filter((_, idx) => idx !== i) ?? [];
                  return next.length > 0 ? next : null;
                })
              }
            />
          </>
        ) : (
          <>
            <Card>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Tulis apa adanya…&#10;“kemarin bensin 50k, kopi 22k, parkir 5k”"
                placeholderTextColor={colors.textFaint}
                multiline
                autoFocus
                style={[type.body, styles.input]}
                onSubmitEditing={() => void runParse(text)}
                accessibilityLabel="Catatan transaksi"
              />
            </Card>

            <View>
              <Txt variant="overline" color={colors.textFaint} style={{ marginBottom: space.sm }}>
                Contoh
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CONTOH.map((c) => (
                  <Pressable key={c} onPress={() => setText(c)} style={styles.sample}>
                    <Txt variant="caption" color={colors.textMuted}>
                      {c}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={() => {
                setDrafts([draftKosong()]);
                setUsedAI(false);
                setStatus(null);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Isi manual"
              style={({ pressed }) => [styles.manualBtn, pressed && { borderColor: colors.accent }]}
            >
              <Feather name="edit-3" size={15} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Isi manual</Txt>
                <Txt variant="caption" color={colors.textFaint}>
                  Ketik sendiri nominal, kategori, dan tanggalnya
                </Txt>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textFaint} />
            </Pressable>

            {!voiceAvailable ? (
              <Txt variant="caption" color={colors.textFaint}>
                Mode gratis aktif — semua diurai di HP tanpa internet. Input suara butuh AI
                diaktifkan lebih dulu (lihat Atur).
              </Txt>
            ) : null}
          </>
        )}

        {error ? (
          <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
            <Txt variant="caption" color={colors.expense}>
              {error}
            </Txt>
          </Card>
        ) : null}

        {status ? (
          <Txt variant="caption" color={colors.warning}>
            {status}
          </Txt>
        ) : null}
      </ScrollView>

      {/* Bilah aksi menempel di bawah */}
      <View style={[styles.actions, { paddingBottom: insets.bottom || space.lg }]}>
        {drafts ? (
          <>
            <Button
              title="Ulangi"
              variant="secondary"
              icon="rotate-ccw"
              onPress={() => {
                setDrafts(null);
                setStatus(null);
              }}
            />
            <Button
              title={`Simpan · ${drafts.length}`}
              icon="check"
              onPress={save}
              loading={busy}
              disabled={!canSave}
              style={{ flex: 1 }}
            />
          </>
        ) : (
          <>
            {voiceAvailable ? (
              <Pressable
                onPress={toggleRecording}
                disabled={busy}
                accessibilityLabel={recorder.isRecording ? 'Berhenti merekam' : 'Rekam suara'}
                style={[
                  styles.mic,
                  recorder.isRecording && { backgroundColor: colors.expense },
                ]}
              >
                <Feather
                  name={recorder.isRecording ? 'square' : 'mic'}
                  size={20}
                  color={recorder.isRecording ? '#fff' : colors.text}
                />
              </Pressable>
            ) : null}
            <Button
              title={recorder.isRecording ? 'Merekam…' : 'Urai'}
              icon="arrow-right"
              onPress={() => void runParse(text)}
              loading={busy}
              disabled={!text.trim() || recorder.isRecording}
              style={{ flex: 1 }}
            />
          </>
        )}
      </View>

      {drafts ? (
        <View style={[styles.totalBar, { bottom: (insets.bottom || space.lg) + 68 }]}>
          <Txt variant="caption" color={colors.textFaint}>
            Total
          </Txt>
          <Txt variant="amount">{new Intl.NumberFormat('id-ID').format(total)}</Txt>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Badge({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.14) }]}>
      <Feather name={icon} size={11} color={color} />
      <Txt variant="caption" color={color}>
        {label}
      </Txt>
    </View>
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
  input: {
    color: colors.text,
    minHeight: 96,
    textAlignVertical: 'top' as const,
    padding: 0,
    lineHeight: 22,
  },
  manualBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sample: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  badgeRow: { flexDirection: 'row' as const, gap: 6 },
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
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
  mic: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  totalBar: {
    position: 'absolute' as const,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
};

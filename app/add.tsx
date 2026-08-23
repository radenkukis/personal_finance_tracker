import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { Button, Card, Txt, withAlpha } from '@/components/ui';
import { DraftReviewSheet } from '@/components/DraftReviewSheet';
import { colors, radius, size, space, type } from '@/lib/theme';
import { aiMode, smartParse, transcribeAudio } from '@/lib/ai';
import { useData } from '@/store/data';
import type { DraftTransaction } from '@/types/db';

const CONTOH = ['kopi 25rb', 'bensin 50k gopay', 'kemarin makan di padang 45rb', 'gajian 8jt'];

/**
 * Preset bawaan HIGH_QUALITY merekam 44,1 kHz stereo 128 kbps — kualitas musik
 * untuk merekam orang berbicara. Berkasnya jadi sekitar empat kali lebih besar
 * tanpa membuat transkripsi lebih akurat sedikit pun, dan yang membuat menunggu
 * justru mengunggah berkas itu.
 *
 * 16 kHz mono sudah lebih dari cukup untuk suara manusia; itu pula laju yang
 * dipakai mesin pengenal suara di baliknya.
 */
const PRESET_SUARA: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 32_000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32_000 },
};

/** "0:07" · "1:23" — durasi rekaman yang sedang berjalan. */
function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

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

  const recorder = useAudioRecorder(PRESET_SUARA);
  /*
   * `recorder.isRecording` TIDAK reaktif — membacanya langsung saat render
   * membuat tampilan tidak pernah berubah ketika perekaman dimulai, sehingga
   * user tidak tahu sedang merekam maupun cara menghentikannya. Status yang
   * benar datang dari hook ini.
   */
  const recState = useAudioRecorderState(recorder, 250);
  const isRecording = recState.isRecording;
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

    if (isRecording) {
      setBusy(true);
      setStatus('Menyimpan rekaman…');
      try {
        await recorder.stop();

        // `recorder.uri` kadang belum terisi tepat setelah stop; status
        // perekam menyimpan lokasinya juga, jadi dipakai sebagai cadangan.
        const uri = recorder.uri ?? recState.url;
        if (!uri) throw new Error('Rekaman tidak tersimpan. Coba rekam ulang.');

        if (recState.durationMillis > 0 && recState.durationMillis < 700) {
          throw new Error('Rekamannya terlalu pendek. Tahan sebentar sambil bicara.');
        }

        const base64 = await new File(uri).base64();

        setStatus('Mengubah suara jadi teks…');
        const spoken = await transcribeAudio(base64, 'audio/m4a');

        if (!spoken.trim()) {
          throw new Error('Suaranya tidak tertangkap. Coba bicara lebih dekat ke mikrofon.');
        }

        // Teksnya ditampilkan lebih dulu supaya user melihat hasilnya benar
        // sebelum tahap berikutnya selesai — bukan menatap "loading" buta.
        setText(spoken);
        setStatus('Mengurai transaksinya…');
        await runParse(spoken, 'ai_voice');
      } catch (e) {
        setStatus(null);
        setError(e instanceof Error ? e.message : 'Gagal memproses rekaman.');
      } finally {
        setBusy(false);
      }
      return;
    }

    // Papan ketik harus menyingkir dulu: tanpa ini layar penuh keyboard
    // sementara yang sedang berlangsung justru perekaman suara.
    Keyboard.dismiss();

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Izin mikrofon ditolak. Aktifkan lewat pengaturan HP untuk memakai input suara.');
      return;
    }

    try {
      // Wajib di iOS: tanpa ini perekaman gagal diam-diam.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Mikrofon tidak bisa dipakai: ${e.message}`
          : 'Mikrofon tidak bisa dipakai.',
      );
    }
  }, [recorder, recState, isRecording, runParse]);

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
        ) : isRecording ? (
          /*
           * Saat merekam, layar hanya menampilkan satu hal. Sebelumnya
           * perekaman berjalan diam-diam di balik papan ketik dan user tidak
           * tahu sedang merekam, apalagi cara berhentinya.
           */
          <Card style={{ borderColor: withAlpha(colors.expense, 0.5), alignItems: 'center', paddingVertical: space.xxl }}>
            <View style={styles.recDot} />
            <Txt variant="display" style={{ marginTop: space.lg }}>
              {formatDuration(recState.durationMillis)}
            </Txt>
            <Txt variant="caption" color={colors.textMuted} style={{ marginTop: space.xs }}>
              Sedang merekam — sebutkan transaksinya
            </Txt>
            <Button
              title="Berhenti & salin"
              icon="square"
              onPress={toggleRecording}
              style={{ marginTop: space.xl, alignSelf: 'stretch' }}
            />
            <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.md, textAlign: 'center' }}>
              Contoh: “tadi makan siang tiga puluh lima ribu”
            </Txt>
          </Card>
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

      {/*
        Bilah aksi disembunyikan selama merekam — tombol berhentinya sudah ada
        di kartu perekaman, dan dua tombol yang sama di satu layar membingungkan.
      */}
      {isRecording ? null : (
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
        ) : busy && status ? (
          <View style={styles.workingBar}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Txt variant="caption" color={colors.textMuted}>
              {status}
            </Txt>
          </View>
        ) : (
          <>
            {voiceAvailable ? (
              <Pressable
                onPress={toggleRecording}
                disabled={busy}
                accessibilityLabel="Rekam suara"
                style={({ pressed }) => [styles.mic, pressed && { borderColor: colors.accent }]}
              >
                <Feather name="mic" size={20} color={colors.text} />
              </Pressable>
            ) : null}
            <Button
              title="Urai"
              icon="arrow-right"
              onPress={() => void runParse(text)}
              loading={busy}
              disabled={!text.trim()}
              style={{ flex: 1 }}
            />
          </>
        )}
      </View>
      )}

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
  recDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.expense,
  },
  workingBar: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space.sm,
    height: size.touchMin,
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

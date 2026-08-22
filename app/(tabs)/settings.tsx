import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button, Card, Divider, Field, IconBadge, SectionLabel, Txt, withAlpha } from '@/components/ui';
import { colors, size, space } from '@/lib/theme';
import { useMoney } from '@/hooks/useMoney';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { supabase } from '@/lib/supabase';
import { aiMode, summarizeFindings } from '@/lib/ai';
import { useSession } from '@/store/session';
import { useData } from '@/store/data';
import { useDashboard } from '@/hooks/useDashboard';

export default function AturScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile, session } = useSession();
  const { accounts, categories, transactions } = useData();
  const dashboard = useDashboard();
  const { money, currency } = useMoney();

  const [payday, setPayday] = useState(String(profile?.payday_day ?? 25));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const remote = aiMode() === 'remote';

  const savePayday = useCallback(async () => {
    const day = Number(payday);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError('Tanggal gajian harus antara 1 dan 31.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ payday_day: day })
        .eq('id', session?.user.id ?? '');
      if (updateError) throw new Error(updateError.message);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }, [payday, refreshProfile, session]);

  const saveCurrency = useCallback(
    async (code: string) => {
      setPickerOpen(false);
      setError(null);
      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ currency: code })
          .eq('id', session?.user.id ?? '');
        if (updateError) throw new Error(updateError.message);
        // Profil dimuat ulang supaya seluruh layar langsung memakai format baru.
        await refreshProfile();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mengganti mata uang.');
      }
    },
    [refreshProfile, session],
  );

  const makeSummary = useCallback(async () => {
    setSummaryBusy(true);
    setError(null);
    try {
      setSummary(await summarizeFindings(dashboard.findings));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat ringkasan.');
    } finally {
      setSummaryBusy(false);
    }
  }, [dashboard.findings]);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: size.tabBarHeight + space.xxl,
        gap: space.lg,
      }}
    >
      <Txt variant="title">Atur</Txt>

      {/* --- Status AI --------------------------------------------------- */}
      <View>
        <SectionLabel>Mode AI</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconBadge
              name={remote ? 'cpu' : 'zap'}
              color={remote ? colors.info : colors.accent}
              diameter={34}
            />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{remote ? 'AI aktif' : 'Mode gratis'}</Txt>
              <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                {remote
                  ? 'Kalimat rumit, suara, dan chat diproses lewat Edge Function.'
                  : 'Semua diurai di HP dengan regex. Tanpa internet, tanpa biaya.'}
              </Txt>
            </View>
          </View>

          {!remote ? (
            <>
              <View style={{ marginVertical: space.md }}>
                <Divider />
              </View>
              <Txt variant="caption" color={colors.textFaint} style={{ lineHeight: 18 }}>
                Untuk mengaktifkan AI: pasang API key di Supabase{' '}
                <Txt variant="caption" color={colors.accent}>
                  (supabase secrets set LLM_PROVIDER=gemini GEMINI_API_KEY=…)
                </Txt>
                , lalu ubah EXPO_PUBLIC_AI_MODE=remote di file .env. Langkah lengkapnya ada di
                README.
              </Txt>
            </>
          ) : null}
        </Card>
      </View>

      {/* --- Ringkasan mingguan ------------------------------------------ */}
      {remote ? (
        <View>
          <SectionLabel>Ringkasan mingguan</SectionLabel>
          <Card>
            {summary ? (
              <Txt variant="body" style={{ lineHeight: 21 }}>
                {summary}
              </Txt>
            ) : (
              <Txt variant="caption" color={colors.textMuted}>
                {dashboard.findings.length > 0
                  ? `${dashboard.findings.length} temuan siap diringkas menjadi narasi.`
                  : 'Belum ada temuan. Catat beberapa transaksi dulu.'}
              </Txt>
            )}
            <Button
              title={summary ? 'Buat ulang' : 'Buat ringkasan'}
              variant="secondary"
              icon="feather"
              onPress={makeSummary}
              loading={summaryBusy}
              disabled={dashboard.findings.length === 0}
              style={{ marginTop: space.md }}
            />
          </Card>
        </View>
      ) : null}

      {/* --- Mata uang ---------------------------------------------------- */}
      <View>
        <SectionLabel>Mata uang</SectionLabel>
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ganti mata uang"
          style={({ pressed }) => [
            {
              backgroundColor: pressed ? colors.surfacePressed : colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.hairline,
              padding: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
            },
          ]}
        >
          <View
            style={{
              width: 52,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: withAlpha(colors.accent, 0.16),
              alignItems: 'center',
            }}
          >
            <Txt variant="caption" color={colors.accent}>
              {currency.code}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{currency.name}</Txt>
            <Txt variant="caption" color={colors.textFaint} style={{ marginTop: 2 }}>
              Contoh tampilan: {money(1250000)}
            </Txt>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
        <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.sm, lineHeight: 17 }}>
          Hanya mengubah tampilan. Nilai transaksi yang sudah tercatat tidak dikonversi.
        </Txt>
      </View>

      {/* --- Gajian ------------------------------------------------------- */}
      <View>
        <SectionLabel>Tanggal gajian</SectionLabel>
        <Card>
          <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: space.md }}>
            Dipakai untuk menghitung jatah aman per hari di beranda.
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field
                icon="calendar"
                value={payday}
                onChangeText={setPayday}
                keyboardType="number-pad"
                placeholder="25"
                maxLength={2}
              />
            </View>
            <Button
              title={saved ? 'Tersimpan' : 'Simpan'}
              icon={saved ? 'check' : undefined}
              onPress={savePayday}
              loading={saving}
            />
          </View>
        </Card>
      </View>

      {/* --- Dompet ------------------------------------------------------- */}
      <View>
        <SectionLabel right={<Txt variant="caption" color={colors.textFaint}>{accounts.length}</Txt>}>
          Dompet
        </SectionLabel>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {accounts.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                <IconBadge name="credit-card" color={colors.textMuted} diameter={30} />
                <Txt variant="bodyStrong" style={{ flex: 1 }}>
                  {a.name}
                </Txt>
                <Txt variant="caption" color={colors.textFaint}>
                  {a.kind}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* --- Ringkasan akun ----------------------------------------------- */}
      <View>
        <SectionLabel>Data kamu</SectionLabel>
        <Card>
          <Row label="Email" value={session?.user.email ?? '—'} />
          <Row label="Transaksi tercatat" value={String(transactions.length)} />
          <Row label="Kategori" value={String(categories.length)} />
          <Row label="Saldo terhitung" value={money(dashboard.balance)} last />
        </Card>
      </View>

      {error ? (
        <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
          <Txt variant="caption" color={colors.expense}>
            {error}
          </Txt>
        </Card>
      ) : null}

      <Button title="Keluar" variant="danger" icon="log-out" onPress={() => void signOut()} full />

      <CurrencyPicker
        visible={pickerOpen}
        current={currency}
        onPick={saveCurrency}
        onClose={() => setPickerOpen(false)}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <Feather name="shield" size={11} color={colors.textFaint} />
        <Txt variant="caption" color={colors.textFaint}>
          Datamu hanya bisa dibaca akunmu sendiri
        </Txt>
      </View>
    </ScrollView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ paddingVertical: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt variant="caption" color={colors.textMuted}>
          {label}
        </Txt>
        <Txt variant="caption" numberOfLines={1} style={{ maxWidth: '60%' }}>
          {value}
        </Txt>
      </View>
      {!last ? <View style={{ marginTop: space.sm }}><Divider /></View> : null}
    </View>
  );
}

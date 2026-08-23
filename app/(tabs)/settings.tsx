import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button, Card, Divider, Field, IconBadge, SectionLabel, Txt, withAlpha } from '@/components/ui';
import { colors, size, space } from '@/lib/theme';
import { useMoney } from '@/hooks/useMoney';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { aiMode, summarizeFindings } from '@/lib/ai';
import { useSession } from '@/store/session';
import { useData } from '@/store/data';
import { useDashboard } from '@/hooks/useDashboard';
import { useT } from '@/hooks/useT';
import { LOCALE_NAMES, PARSER_LOCALES, type Locale } from '@/lib/i18n';

export default function AturScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile, session } = useSession();
  const { categories, transactions } = useData();
  const dashboard = useDashboard();
  const { money, currency } = useMoney();
  const { d, fill, locale } = useT();
  const router = useRouter();

  const [nickname, setNickname] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const remote = aiMode() === 'remote';

  const saveNickname = useCallback(async () => {
    const name = nickname.trim();
    if (!name) {
      setError(d.settings.nicknameEmpty);
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: name })
        .eq('id', session?.user.id ?? '');
      if (updateError) throw new Error(updateError.message);
      await refreshProfile();
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : d.settings.saveFailed);
    } finally {
      setSavingName(false);
    }
  }, [nickname, refreshProfile, session, d]);

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
        setError(e instanceof Error ? e.message : d.settings.saveFailed);
      }
    },
    [refreshProfile, session, d],
  );

  /*
   * Bahasa disimpan di profil, bukan hanya di HP, supaya pilihannya ikut saat
   * user masuk dari perangkat lain - sama seperti mata uang.
   */
  const saveLanguage = useCallback(
    async (code: Locale) => {
      setLangOpen(false);
      setError(null);
      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ language: code })
          .eq('id', session?.user.id ?? '');
        if (updateError) throw new Error(updateError.message);
        await refreshProfile();
      } catch (e) {
        setError(e instanceof Error ? e.message : d.settings.saveFailed);
      }
    },
    [refreshProfile, session, d],
  );

  const makeSummary = useCallback(async () => {
    setSummaryBusy(true);
    setError(null);
    try {
      setSummary(await summarizeFindings(dashboard.findings));
    } catch (e) {
      setError(e instanceof Error ? e.message : d.settings.saveFailed);
    } finally {
      setSummaryBusy(false);
    }
  }, [dashboard.findings, d]);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: size.tabBarHeight + space.xxl,
        gap: space.lg,
      }}
    >
      <Txt variant="title">{d.settings.title}</Txt>

      {/* --- Status AI --------------------------------------------------- */}
      <View>
        <SectionLabel>{d.settings.aiMode}</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconBadge
              name={remote ? 'cpu' : 'zap'}
              color={remote ? colors.info : colors.accent}
              diameter={34}
            />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{remote ? d.settings.aiOn : d.settings.aiOff}</Txt>
              <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                {remote ? d.settings.aiOnBody : d.settings.aiOffBody}
              </Txt>
            </View>
          </View>

          {!remote ? (
            <>
              <View style={{ marginVertical: space.md }}>
                <Divider />
              </View>
              <Txt variant="caption" color={colors.textFaint} style={{ lineHeight: 18 }}>
                {d.settings.aiSetupHint}
              </Txt>
            </>
          ) : null}
        </Card>
      </View>

      {/* --- Ringkasan mingguan ------------------------------------------ */}
      {remote ? (
        <View>
          <SectionLabel>{d.settings.weeklySummary}</SectionLabel>
          <Card>
            {summary ? (
              <Txt variant="body" style={{ lineHeight: 21 }}>
                {summary}
              </Txt>
            ) : (
              <Txt variant="caption" color={colors.textMuted}>
                {dashboard.findings.length > 0
                  ? fill(d.settings.findingsReady, { count: dashboard.findings.length })
                  : d.settings.noFindings}
              </Txt>
            )}
            <Button
              title={summary ? d.settings.remakeSummary : d.settings.makeSummary}
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

      {/* --- Kategori ----------------------------------------------------- */}
      <View>
        <SectionLabel
          right={
            <Txt variant="caption" color={colors.textFaint}>
              {categories.length}
            </Txt>
          }
        >
          {d.settings.categories}
        </SectionLabel>
        <Pressable
          onPress={() => router.push('/categories')}
          accessibilityRole="button"
          accessibilityLabel={d.settings.manageCategories}
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
          <IconBadge name="tag" color={colors.accent} diameter={34} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{d.settings.manageCategories}</Txt>
            <Txt variant="caption" color={colors.textFaint} style={{ marginTop: 2 }}>
              {d.settings.manageCategoriesBody}
            </Txt>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
        <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.sm, lineHeight: 17 }}>
          {d.settings.keywordsHint}
        </Txt>
      </View>

      {/* --- Mata uang ---------------------------------------------------- */}
      <View>
        <SectionLabel>{d.settings.currency}</SectionLabel>
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={d.settings.currency}
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
              {fill(d.settings.currencyExample, { example: money(1250000) })}
            </Txt>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
        <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.sm, lineHeight: 17 }}>
          {d.settings.currencyNote}
        </Txt>
      </View>

      {/* --- Bahasa ------------------------------------------------------- */}
      <View>
        <SectionLabel>{d.settings.language}</SectionLabel>
        <Pressable
          onPress={() => setLangOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={d.settings.language}
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
          <IconBadge name="globe" color={colors.accent} diameter={34} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{LOCALE_NAMES[locale].native}</Txt>
            <Txt variant="caption" color={colors.textFaint} style={{ marginTop: 2 }}>
              {PARSER_LOCALES.includes(locale)
                ? d.settings.parserSupported
                : d.settings.parserUnsupported}
            </Txt>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
        <Txt variant="caption" color={colors.textFaint} style={{ marginTop: space.sm, lineHeight: 17 }}>
          {d.settings.languageNote}
        </Txt>
      </View>

      {/* --- Nama panggilan ------------------------------------------------ */}
      <View>
        <SectionLabel>{d.settings.nickname}</SectionLabel>
        <Card>
          <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: space.md }}>
            {d.settings.nicknameBody}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field
                icon="user"
                value={nickname}
                onChangeText={setNickname}
                placeholder={d.settings.nicknamePlaceholder}
                maxLength={30}
                autoCapitalize="words"
              />
            </View>
            <Button
              title={savedName ? d.settings.saved : d.common.save}
              icon={savedName ? 'check' : undefined}
              onPress={saveNickname}
              loading={savingName}
              disabled={!nickname.trim()}
            />
          </View>
        </Card>
      </View>

      {/* --- Ringkasan akun ----------------------------------------------- */}
      <View>
        <SectionLabel>{d.settings.yourData}</SectionLabel>
        <Card>
          <Row label={d.settings.dataEmail} value={session?.user.email ?? '—'} />
          <Row label={d.settings.dataTransactions} value={String(transactions.length)} />
          <Row label={d.settings.dataCategories} value={String(categories.length)} />
          <Row label={d.settings.dataBalance} value={money(dashboard.balance)} last />
        </Card>
      </View>

      {error ? (
        <Card style={{ borderColor: withAlpha(colors.expense, 0.5) }}>
          <Txt variant="caption" color={colors.expense}>
            {error}
          </Txt>
        </Card>
      ) : null}

      <Button
        title={d.settings.signOut}
        variant="danger"
        icon="log-out"
        onPress={() => void signOut()}
        full
      />

      <CurrencyPicker
        visible={pickerOpen}
        current={currency}
        onPick={saveCurrency}
        onClose={() => setPickerOpen(false)}
      />

      <LanguagePicker
        visible={langOpen}
        current={locale}
        onPick={saveLanguage}
        onClose={() => setLangOpen(false)}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <Feather name="shield" size={11} color={colors.textFaint} />
        <Txt variant="caption" color={colors.textFaint}>
          {d.settings.privacyNote}
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

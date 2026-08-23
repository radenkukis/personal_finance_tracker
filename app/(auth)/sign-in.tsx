import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Txt } from '@/components/ui';
import { colors, space } from '@/lib/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { authErrorMessage, useSession } from '@/store/session';
import { useT } from '@/hooks/useT';

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useSession();
  const { d } = useT();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);

    if (!email.includes('@')) return setError(d.auth.invalidEmail);
    if (password.length < 6) return setError(d.auth.shortPassword);

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice(d.auth.checkInbox);
          setMode('signin');
        }
      }
    } catch (e) {
      setError(authErrorMessage(e, d));
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) return <NotConfigured />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: space.lg,
          paddingTop: insets.top + space.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: space.xxl }}>
          <Txt variant="display">Arta</Txt>
          <Txt variant="body" color={colors.textMuted} style={{ marginTop: space.xs }}>
            {d.auth.tagline}
          </Txt>
        </View>

        <View style={{ gap: space.md }}>
          <Field
            label={d.auth.email}
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder={d.auth.emailHint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
          />
          <Field
            label={d.auth.password}
            icon="lock"
            value={password}
            onChangeText={setPassword}
            placeholder={d.auth.passwordHint}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error ? (
            <Txt variant="caption" color={colors.expense}>
              {error}
            </Txt>
          ) : null}
          {notice ? (
            <Txt variant="caption" color={colors.accent}>
              {notice}
            </Txt>
          ) : null}

          <Button
            title={mode === 'signin' ? d.auth.signIn : d.auth.signUp}
            onPress={submit}
            loading={busy}
            full
            style={{ marginTop: space.xs }}
          />
          <Button
            title={mode === 'signin' ? d.auth.toSignUp : d.auth.toSignIn}
            variant="ghost"
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Tanpa ini, app hanya menampilkan layar putih saat .env belum diisi —
 * kesalahan paling sering terjadi ketika orang pertama kali menjalankan proyek.
 */
function NotConfigured() {
  const { d } = useT();

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
      <Card>
        <Txt variant="title">{d.auth.notConfiguredTitle}</Txt>
        <Txt variant="body" color={colors.textMuted} style={{ marginTop: space.sm }}>
          {d.auth.notConfiguredBody}
        </Txt>
        <View
          style={{
            marginTop: space.md,
            padding: space.md,
            borderRadius: 10,
            backgroundColor: colors.surfaceRaised,
            gap: 2,
          }}
        >
          <Txt variant="caption" color={colors.accent}>
            EXPO_PUBLIC_SUPABASE_URL=...
          </Txt>
          <Txt variant="caption" color={colors.accent}>
            EXPO_PUBLIC_SUPABASE_ANON_KEY=...
          </Txt>
        </View>
        <Txt variant="caption" color={colors.textMuted} style={{ marginTop: space.md }}>
          {d.auth.notConfiguredHint}
        </Txt>
      </Card>
    </View>
  );
}

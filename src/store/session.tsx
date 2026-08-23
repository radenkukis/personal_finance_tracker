import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/types/db';
import type { Dictionary } from '@/lib/i18n';

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  /** true selama sesi tersimpan sedang dipulihkan dari penyimpanan HP. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile(userId).then(setProfile);
  }, [userId]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      profile,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(authErrorCode(error.message));
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(authErrorCode(error.message));
        // Kalau konfirmasi email diaktifkan, session belum terbit.
        return { needsConfirmation: data.session === null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshProfile: async () => {
        if (userId) setProfile(await loadProfile(userId));
      },
    }),
    [session, profile, loading, userId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession harus dipakai di dalam <SessionProvider>');
  return ctx;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('Gagal memuat profil:', error.message);
    return null;
  }
  return data;
}

/**
 * Pesan Supabase yang berbahasa Inggris dan penuh istilah diringkas menjadi
 * kode singkat. Kodenya diterjemahkan belakangan, di tempat yang tahu bahasa
 * apa yang sedang dipakai — modul ini berjalan sebelum profil user ada.
 *
 * Pesan yang tidak dikenali diteruskan apa adanya: lebih baik user melihat
 * kalimat Inggris yang bisa dicari di internet daripada "terjadi kesalahan"
 * yang tidak memberi petunjuk apa pun.
 */
const AUTH_CODES = [
  ['invalid login credentials', 'wrongCredentials'],
  ['email not confirmed', 'emailNotConfirmed'],
  ['user already registered', 'alreadyRegistered'],
  ['password should be at least', 'shortPassword'],
  ['unable to validate email', 'invalidEmail'],
  ['network', 'networkError'],
] as const;

type AuthErrorCode = (typeof AUTH_CODES)[number][1];

function authErrorCode(message: string): string {
  const m = message.toLowerCase();
  for (const [needle, code] of AUTH_CODES) {
    if (m.includes(needle)) return code;
  }
  return message;
}

/** Kode galat → kalimat dalam bahasa yang sedang dipakai. */
export function authErrorMessage(error: unknown, d: Dictionary): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known = AUTH_CODES.some(([, code]) => code === raw);
  return known ? d.auth[raw as AuthErrorCode] : raw;
}

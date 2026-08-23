/**
 * Bahasa dan mata uang user, dibaca dari profil di database.
 *
 * Sengaja tidak diambil dari badan permintaan. Nilai ini menentukan bahasa
 * teks yang ditulis model; membiarkannya datang dari aplikasi berarti siapa
 * pun yang punya token bisa menyuntikkan apa saja ke dalam prompt.
 */
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { UserVoice } from './prompts.ts';

export async function readVoice(db: SupabaseClient): Promise<UserVoice> {
  const { data } = await db.from('profiles').select('language, currency').maybeSingle();
  return {
    language: (data?.language as string | null) ?? null,
    currency: (data?.currency as string | undefined) ?? 'IDR',
  };
}

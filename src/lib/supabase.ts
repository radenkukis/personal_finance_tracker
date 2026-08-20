import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Belum dikonfigurasi? Jangan lempar error saat modul dimuat — nanti layar
 * putih tanpa penjelasan. Layar sign-in yang akan menampilkan pesan jelas
 * berisi langkah perbaikannya.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-belum-diisi',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Wajib false di React Native: tidak ada URL bar untuk membaca
      // token dari fragment setelah redirect.
      detectSessionInUrl: false,
    },
  },
);

/**
 * Memanggil Edge Function dengan token user yang sedang login.
 * Semua panggilan AI lewat sini — API key provider tetap di server.
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  if (data === null) throw new Error(`Function ${name} tidak mengembalikan data`);
  return data;
}

/**
 * Utilitas bersama untuk semua Edge Function: CORS, respons JSON, dan
 * verifikasi identitas user.
 *
 * Setiap function WAJIB memanggil `requireUser` sebelum melakukan apa pun.
 * Function inilah yang memegang API key provider AI, jadi kalau siapa pun
 * bisa memanggilnya tanpa login, kuota/saldo kamu bisa dipakai orang lain.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Menangani preflight; kembalikan Response bila permintaan ini OPTIONS. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}

export interface AuthedContext {
  userId: string;
  /** Client yang membawa token user, jadi Row Level Security tetap berlaku. */
  db: SupabaseClient;
}

export async function requireUser(req: Request): Promise<AuthedContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new HttpError('Tidak ada token. Silakan masuk kembali.', 401);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError('Sesi tidak valid. Silakan masuk kembali.', 401);

  return { userId: data.user.id, db };
}

export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Pembungkus standar: preflight, autentikasi, dan penerjemahan error. */
export function serveAuthed(
  handler: (req: Request, ctx: AuthedContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    try {
      const ctx = await requireUser(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error(e);
      const message = e instanceof Error ? e.message : 'Kesalahan tidak terduga.';
      return fail(message, 500);
    }
  };
}

/**
 * POST /functions/v1/ai-transcribe
 * Body: { audio: string (base64), mimeType: string }
 *
 * Mengubah rekaman suara menjadi teks. Teksnya lalu dikembalikan ke HP dan
 * masuk ke parser yang sama seperti input ketikan — jalur suara dan jalur
 * ketik bertemu di satu tempat, jadi perilakunya selalu konsisten.
 */
import { fail, json, serveAuthed } from '../_shared/http.ts';
import { sttProvider, transcribe } from '../_shared/providers.ts';

/**
 * Rekaman transaksi wajar berdurasi beberapa detik. Batas ~4 MB base64
 * (sekitar 3 MB audio) sudah sangat longgar sekaligus mencegah unggahan
 * besar yang memboroskan kuota.
 */
const MAX_BASE64_CHARS = 4_000_000;

const ALLOWED_MIME = ['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/wav', 'audio/ogg'];

Deno.serve(serveAuthed(async (req) => {
  const body = await req.json().catch(() => null) as {
    audio?: string;
    mimeType?: string;
  } | null;

  const audio = body?.audio;
  const mimeType = body?.mimeType ?? 'audio/m4a';

  if (!audio) return fail('Data audio tidak ada.');
  if (audio.length > MAX_BASE64_CHARS) {
    return fail('Rekaman terlalu panjang. Coba bicara lebih singkat.');
  }
  if (!ALLOWED_MIME.some((m) => mimeType.startsWith(m))) {
    return fail(`Format audio ${mimeType} tidak didukung.`);
  }

  const text = await transcribe(audio, mimeType);

  if (!text) {
    return fail('Suaranya tidak terdengar jelas. Coba ulangi di tempat yang lebih sepi.', 422);
  }

  return json({ text, provider: sttProvider() });
}));

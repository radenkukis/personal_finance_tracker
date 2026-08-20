/**
 * Transkripsi suara lewat Groq (Whisper) — alternatif gratis untuk STT.
 *
 * Berguna terutama bila LLM_PROVIDER=claude, karena Claude tidak menerima
 * input audio sama sekali.
 */
const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';

function apiKey(): string {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) {
    throw new Error('GROQ_API_KEY belum diset. Jalankan: supabase secrets set GROQ_API_KEY=...');
  }
  return key;
}

const model = () => Deno.env.get('GROQ_STT_MODEL') ?? 'whisper-large-v3-turbo';

export async function groqTranscribe(audioBase64: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([decodeBase64(audioBase64)], { type: mimeType }), fileNameFor(mimeType));
  form.append('model', model());
  // Menyebut bahasa secara eksplisit menaikkan akurasi angka dan nama tempat.
  form.append('language', 'id');
  form.append('response_format', 'json');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) {
      throw new Error('Kuota gratis Groq habis untuk sementara. Coba lagi nanti, atau ketik manual.');
    }
    throw new Error(`Groq menolak permintaan (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = await res.json() as { text?: string };
  return (json.text ?? '').trim();
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Whisper memilih dekoder berdasarkan ekstensi berkas, jadi ini harus benar. */
function fileNameFor(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  return 'audio.mp3';
}

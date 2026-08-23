/**
 * POST /functions/v1/ai-insight
 * Body: { findings: Finding[] }
 *
 * Mengubah temuan yang SUDAH dihitung di HP menjadi ringkasan naratif, lalu
 * menyimpannya ke tabel `insights`.
 *
 * Pembagian kerja ini disengaja: perhitungan (deteksi langganan, lonjakan,
 * risiko budget) deterministik dan gratis di HP; AI hanya merangkai kalimat.
 * Hasilnya model tidak punya ruang untuk salah hitung, dan biayanya tinggal
 * satu panggilan pendek per minggu.
 */
import { fail, json, serveAuthed } from '../_shared/http.ts';
import { insight, llmProvider } from '../_shared/providers.ts';
import { readVoice } from '../_shared/voice.ts';

interface Finding {
  kind: string;
  severity: string;
  title: string;
  detail: string;
  data: Record<string, string | number>;
}

/** Jangan menulis ulang ringkasan yang baru dibuat beberapa jam lalu. */
const MIN_HOURS_BETWEEN_SUMMARIES = 20;

Deno.serve(serveAuthed(async (req, ctx) => {
  const body = await req.json().catch(() => null) as { findings?: Finding[] } | null;
  const findings = body?.findings ?? [];

  if (findings.length === 0) {
    return fail('Belum ada temuan untuk diringkas.', 422);
  }

  const { data: recent } = await ctx.db
    .from('insights')
    .select('id, title, body, created_at')
    .eq('kind', 'weekly')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && hoursSince(recent.created_at) < MIN_HOURS_BETWEEN_SUMMARIES) {
    return json({ summary: recent.body, cached: true, provider: llmProvider() });
  }

  const summary = await insight(JSON.stringify(findings, null, 2), await readVoice(ctx.db));
  if (!summary) return fail('AI tidak mengembalikan ringkasan.', 502);

  const severity = findings.some((f) => f.severity === 'danger')
    ? 'danger'
    : findings.some((f) => f.severity === 'warning')
      ? 'warning'
      : 'info';

  await ctx.db.from('insights').insert({
    user_id: ctx.userId,
    kind: 'weekly',
    severity,
    title: 'Ringkasan minggu ini',
    body: summary,
    meta: { findings_count: findings.length },
  });

  return json({ summary, cached: false, provider: llmProvider() });
}));

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Mengusulkan kata kunci untuk sebuah kategori.
 *
 * Kata kuncilah yang menentukan apa yang bisa dikenali tanpa AI. Kategori
 * yang lahir tanpa kata kunci akan mengandalkan AI selamanya — setiap catatan
 * serupa menunggu jaringan dan memakai kuota. Satu panggilan di sini menukar
 * itu dengan pengenalan gratis dan seketika untuk seterusnya.
 *
 * Dipanggil hanya ketika user menekan tombolnya, bukan otomatis.
 */
import { fail, json, serveAuthed, type AuthedContext } from '../_shared/http.ts';
import { llmProvider, suggestKeywords } from '../_shared/providers.ts';
import { readVoice } from '../_shared/voice.ts';
import { shownCategoryName } from '../_shared/categoryNames.ts';

const MAX_NAME_CHARS = 60;

interface CategoryRow {
  name: string;
  kind: string;
  slug: string | null;
  keywords: string[] | null;
}

export default serveAuthed(async (req: Request, ctx: AuthedContext) => {
  const body = await req.json().catch(() => null) as
    | { categoryName?: string; kind?: string }
    | null;

  const categoryName = body?.categoryName?.trim();
  if (!categoryName) return fail('Nama kategori tidak boleh kosong.');
  if (categoryName.length > MAX_NAME_CHARS) {
    return fail(`Nama kategori terlalu panjang (maksimal ${MAX_NAME_CHARS} karakter).`);
  }

  const kind = body?.kind === 'income' ? 'income' : 'expense';

  const [voice, categories] = await Promise.all([
    readVoice(ctx.db),
    ctx.db.from('categories').select('name, kind, slug, keywords').order('sort_order'),
  ]);

  const rows = (categories.data ?? []) as CategoryRow[];

  /*
   * Kata kunci yang sudah dipakai kategori lain ikut dikirim sebagai daftar
   * larangan. Tanpa ini model mengusulkan kata yang sudah menempel di tempat
   * lain, dan dua kategori berebut kata yang sama — pemenangnya ditentukan
   * panjang kata, lalu urutan. Diam-diam, dan sembarang.
   */
  const taken = new Set<string>();
  for (const c of rows) {
    if (c.kind !== kind) continue;
    for (const k of c.keywords ?? []) taken.add(k.toLowerCase());
  }

  const siblings = rows
    .filter((c) => c.kind === kind)
    .map((c) => shownCategoryName(c, voice.language));

  const keywords = await suggestKeywords(
    { name: categoryName, kind, siblings, taken: [...taken] },
    voice,
  );

  return json({ keywords, provider: llmProvider() });
});

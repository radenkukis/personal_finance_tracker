-- =====================================================================
--  Bahasa antarmuka per user.
--
--  Disimpan di profil, bukan hanya di HP, supaya pilihannya ikut ketika
--  user masuk dari perangkat lain — sama seperti mata uang.
--
--  Bawaannya 'en': aplikasi ini ditujukan untuk pengguna lintas negara,
--  dan Inggris adalah pilihan yang paling mungkin dimengerti pendatang baru
--  sebelum mereka sempat mengganti apa pun.
-- =====================================================================
alter table public.profiles
  add column if not exists language text not null default 'en';

-- Hanya kode bahasa yang benar-benar didukung aplikasi yang boleh masuk.
-- Tanpa penjagaan ini, kode asing membuat seluruh teks jatuh ke bahasa
-- cadangan tanpa ada yang tahu sebabnya.
do $lang$ begin
  alter table public.profiles
    add constraint profiles_language_supported
    check (language in ('en', 'id', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'fr', 'de'));
exception when duplicate_object then null; end $lang$;

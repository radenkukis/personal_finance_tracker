-- =====================================================================
--  Bahasa: kosong berarti "belum dipilih", bukan "bahasa Inggris".
--
--  Migrasi sebelumnya memberi bawaan 'en'. Akibatnya akun baru dari mana
--  pun langsung terkunci ke Inggris, padahal aplikasi sudah tahu bahasa
--  HP-nya sejak layar masuk — dan sudah memakainya di sana. User Jepang
--  jadi melihat bahasa Jepang sebelum mendaftar, lalu tiba-tiba Inggris
--  setelahnya.
--
--  Dengan NULL, aplikasi memakai bahasa perangkat sampai user benar-benar
--  memilih sendiri. Begitu dipilih, pilihannya tersimpan dan ikut ke
--  perangkat lain.
-- =====================================================================
alter table public.profiles alter column language drop default;
alter table public.profiles alter column language drop not null;

-- Baris lama sudah terlanjur berisi 'en' dari bawaan tadi. Dikembalikan ke
-- NULL supaya perlakuannya sama dengan akun baru: ikut bahasa perangkat.
update public.profiles set language = null where language = 'en';

alter table public.profiles drop constraint if exists profiles_language_supported;
alter table public.profiles
  add constraint profiles_language_supported
  check (language is null or language in
    ('en', 'id', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'fr', 'de'));

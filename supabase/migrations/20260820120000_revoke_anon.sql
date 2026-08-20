-- =====================================================================
--  Cabut akses role `anon` dari seluruh tabel aplikasi.
--
--  LATAR BELAKANG
--  Supabase cloud memasang ALTER DEFAULT PRIVILEGES yang otomatis memberi
--  GRANT kepada `anon`, `authenticated`, dan `service_role` untuk setiap
--  tabel baru di schema public. Akibatnya tabel kita ikut terbuka untuk
--  `anon` (peran yang dipakai PostgREST ketika pemanggil belum login),
--  meskipun migrasi pertama hanya memberi izin kepada `authenticated`.
--
--  Perilaku ini TIDAK ada di Supabase lokal, jadi bedanya hanya kelihatan
--  saat diuji terhadap project cloud sungguhan.
--
--  DAMPAK KEAMANAN
--  Datanya sendiri tidak pernah bocor: RLS tetap memblokir semua baris
--  karena `auth.uid()` bernilai NULL bagi pemanggil anonim. Tetapi
--  mengandalkan RLS sebagai satu-satunya lapisan berarti satu policy yang
--  keliru di kemudian hari langsung membuka data ke publik. Mencabut GRANT
--  membuat kesalahan seperti itu tetap tertahan di lapisan kedua.
--
--  Aplikasi tidak terpengaruh: seluruh query dijalankan setelah login,
--  yaitu sebagai role `authenticated`. Pendaftaran dan masuk ditangani
--  GoTrue di schema `auth`, bukan lewat tabel-tabel ini.
-- =====================================================================

revoke all on public.profiles       from anon;
revoke all on public.accounts       from anon;
revoke all on public.categories     from anon;
revoke all on public.transactions   from anon;
revoke all on public.budgets        from anon;
revoke all on public.ai_corrections from anon;
revoke all on public.insights       from anon;
revoke all on public.v_month_summary from anon;

-- Tabel yang dibuat migrasi berikutnya jangan sampai terbuka lagi.
alter default privileges in schema public revoke all on tables from anon;

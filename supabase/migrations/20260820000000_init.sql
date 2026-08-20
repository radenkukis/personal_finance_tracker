-- =====================================================================
--  Personal Finance Tracker - Skema Database (Supabase / Postgres)
--
--  Ini adalah migrasi pertama proyek. Diterapkan otomatis oleh:
--    supabase start     (database lokal)
--    supabase db push   (project cloud)
--
--  Bisa juga ditempel manual ke Dashboard > SQL Editor bila tidak
--  memakai Supabase CLI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $enum$ begin
  create type tx_kind as enum ('expense', 'income', 'transfer');
exception when duplicate_object then null; end $enum$;

do $enum$ begin
  create type tx_source as enum ('manual', 'ai_text', 'ai_voice', 'ai_receipt', 'recurring');
exception when duplicate_object then null; end $enum$;

-- ---------------------------------------------------------------------
-- 2. PROFILES - 1 baris per user, menyimpan preferensi
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  currency       text        not null default 'IDR',
  monthly_income numeric(14,2),
  payday_day     smallint    not null default 25 check (payday_day between 1 and 31),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. ACCOUNTS - dompet / sumber dana (Tunai, GoPay, BCA, ...)
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  kind            text        not null default 'ewallet',   -- cash | bank | ewallet | credit
  icon            text        not null default 'wallet',
  opening_balance numeric(14,2) not null default 0,
  is_archived     boolean     not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts(user_id) where is_archived = false;

-- ---------------------------------------------------------------------
-- 4. CATEGORIES - kategori pengeluaran/pemasukan
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  kind       tx_kind     not null default 'expense',
  icon       text        not null default 'tag',
  color      text        not null default '#8A97A6',
  -- kata kunci untuk parser lokal (gratis); AI juga membacanya sebagai konteks
  keywords   text[]      not null default '{}',
  sort_order smallint    not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);
create index if not exists categories_user_idx on public.categories(user_id);

-- ---------------------------------------------------------------------
-- 5. TRANSACTIONS - inti aplikasi
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  account_id    uuid        references public.accounts(id) on delete set null,
  category_id   uuid        references public.categories(id) on delete set null,
  kind          tx_kind     not null default 'expense',
  amount        numeric(14,2) not null check (amount > 0),
  merchant      text,
  note          text,
  occurred_at   timestamptz not null default now(),
  source        tx_source   not null default 'manual',
  -- jejak AI: teks asli, confidence, dan apakah user mengoreksi hasilnya
  raw_input     text,
  ai_confidence real,
  was_corrected boolean     not null default false,
  receipt_url   text,
  created_at    timestamptz not null default now()
);
create index if not exists tx_user_date_idx on public.transactions(user_id, occurred_at desc);
create index if not exists tx_user_cat_idx  on public.transactions(user_id, category_id);

-- ---------------------------------------------------------------------
-- 6. BUDGETS - anggaran per kategori per bulan
-- ---------------------------------------------------------------------
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  category_id uuid        not null references public.categories(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  period      date        not null,  -- selalu tanggal 1 bulan ybs
  created_at  timestamptz not null default now(),
  unique (user_id, category_id, period)
);

-- ---------------------------------------------------------------------
-- 7. AI_CORRECTIONS - user mengoreksi tebakan AI; dipakai sebagai
--    few-shot examples agar kategorisasi makin akurat seiring waktu
-- ---------------------------------------------------------------------
create table if not exists public.ai_corrections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  raw_input          text        not null,
  predicted_category text,
  correct_category   text        not null,
  created_at         timestamptz not null default now()
);
create index if not exists corrections_user_idx on public.ai_corrections(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8. INSIGHTS - hasil analisa AI, di-cache supaya tidak boros token
-- ---------------------------------------------------------------------
create table if not exists public.insights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null,                      -- weekly | alert | tip
  severity   text        not null default 'info',        -- info | warning | danger | good
  title      text        not null,
  body       text        not null,
  meta       jsonb       not null default '{}'::jsonb,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists insights_user_idx on public.insights(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 9a. GRANT - izin tingkat TABEL
--
--     Ini terpisah dari Row Level Security dan dua-duanya wajib ada:
--       GRANT = boleh menyentuh tabelnya atau tidak
--       RLS   = baris mana yang boleh dilihat/diubah
--     Tanpa GRANT, Postgres menolak setiap query dengan
--     "permission denied for table ..." bahkan sebelum policy diperiksa.
--
--     Role `anon` (belum login) sengaja TIDAK diberi akses apa pun:
--     seluruh data hanya boleh disentuh setelah user masuk.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.accounts,
  public.categories,
  public.transactions,
  public.budgets,
  public.ai_corrections,
  public.insights
to authenticated;

-- Profil tidak boleh dihapus sendiri oleh user; ikut terhapus bersama akun.
grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 9b. ROW LEVEL SECURITY - setiap user hanya bisa melihat datanya sendiri
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.accounts       enable row level security;
alter table public.categories     enable row level security;
alter table public.transactions   enable row level security;
alter table public.budgets        enable row level security;
alter table public.ai_corrections enable row level security;
alter table public.insights       enable row level security;

do $rls$
declare t text;
begin
  foreach t in array array['profiles','accounts','categories','transactions','budgets','ai_corrections','insights']
  loop
    execute format('drop policy if exists "own_select" on public.%I', t);
    execute format('drop policy if exists "own_insert" on public.%I', t);
    execute format('drop policy if exists "own_update" on public.%I', t);
    execute format('drop policy if exists "own_delete" on public.%I', t);

    if t = 'profiles' then
      execute format('create policy "own_select" on public.%I for select using (auth.uid() = id)', t);
      execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = id)', t);
      execute format('create policy "own_update" on public.%I for update using (auth.uid() = id)', t);
    else
      execute format('create policy "own_select" on public.%I for select using (auth.uid() = user_id)', t);
      execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
      execute format('create policy "own_update" on public.%I for update using (auth.uid() = user_id)', t);
      execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = user_id)', t);
    end if;
  end loop;
end $rls$;

-- ---------------------------------------------------------------------
-- 10. SEED OTOMATIS saat user baru daftar
--     (kategori + dompet default khas Indonesia)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, kind, icon) values
    (new.id, 'Tunai', 'cash',    'cash'),
    (new.id, 'GoPay', 'ewallet', 'phone'),
    (new.id, 'Bank',  'bank',    'bank');

  insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order) values
    (new.id, 'Makan & Minum', 'expense', 'food',    '#FF8A5B', array['makan','minum','warteg','nasi','ayam','bakso','mie','sate','padang','resto','restoran','cafe','kopi','ngopi','starbucks','gofood','grabfood','shopeefood','jajan','sarapan','lunch','dinner','snack','martabak','seblak','boba','geprek','soto','gado-gado'], 10),
    (new.id, 'Transport',     'expense', 'car',     '#5B9BFF', array['bensin','pertamax','pertalite','solar','gojek','grab','maxim','ojek','ojol','taksi','busway','transjakarta','krl','mrt','kereta','parkir','tol','etoll','angkot','servis motor','oli','pesawat'], 20),
    (new.id, 'Belanja',       'expense', 'cart',    '#C084FC', array['belanja','indomaret','alfamart','supermarket','superindo','hypermart','tokopedia','shopee','lazada','tiktokshop','baju','sepatu','celana','skincare','kosmetik','tas'], 30),
    (new.id, 'Tagihan',       'expense', 'receipt', '#FFB74D', array['listrik','pln','token listrik','pdam','air','internet','wifi','indihome','pulsa','paket data','kuota','bpjs','asuransi','netflix','spotify','langganan','iuran','cicilan'], 40),
    (new.id, 'Kesehatan',     'expense', 'health',  '#4ADE80', array['dokter','obat','apotek','apotik','kimia farma','rumah sakit','klinik','vitamin','periksa','lab','gigi'], 50),
    (new.id, 'Hiburan',       'expense', 'game',    '#F472B6', array['nonton','bioskop','cgv','xxi','game','steam','mobile legend','top up','konser','tiket','liburan','wisata','karaoke'], 60),
    (new.id, 'Pendidikan',    'expense', 'book',    '#38BDF8', array['kuliah','spp','buku','kursus','les','seminar','pelatihan','udemy','sekolah'], 70),
    (new.id, 'Rumah',         'expense', 'home',    '#A3A3A3', array['kos','kost','sewa','kontrakan','perabot','ikea','galon','gas','lpg','sabun','deterjen','peralatan'], 80),
    (new.id, 'Sosial',        'expense', 'gift',    '#FB7185', array['kado','hadiah','sumbangan','donasi','zakat','sedekah','nikahan','kondangan','angpao','traktir','patungan'], 90),
    (new.id, 'Lainnya',       'expense', 'tag',     '#8A97A6', array[]::text[], 999),
    (new.id, 'Gaji',          'income',  'wallet',  '#22D3A6', array['gaji','gajian','salary','payroll','thr','bonus'], 10),
    (new.id, 'Freelance',     'income',  'laptop',  '#22D3A6', array['freelance','project','proyek','fee','honor','komisi'], 20),
    (new.id, 'Pemasukan Lain','income',  'plus',    '#22D3A6', array['refund','cashback','hadiah','menang','jual','dividen','bunga'], 30);

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 11. VIEW ringkasan per bulan (dipakai dashboard, hemat query)
-- ---------------------------------------------------------------------
create or replace view public.v_month_summary
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_at)::date        as period,
  sum(t.amount) filter (where t.kind = 'income')  as total_income,
  sum(t.amount) filter (where t.kind = 'expense') as total_expense,
  count(*) filter (where t.kind = 'expense')      as expense_count
from public.transactions t
group by 1, 2;

-- View memakai security_invoker, jadi RLS pemanggil tetap berlaku;
-- tetap perlu GRANT terpisah karena view adalah objek tersendiri.
grant select on public.v_month_summary to authenticated;

-- ---------------------------------------------------------------------
-- 12. STORAGE bucket untuk foto struk
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_own_rw" on storage.objects;
create policy "receipts_own_rw" on storage.objects
  for all
  using  (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

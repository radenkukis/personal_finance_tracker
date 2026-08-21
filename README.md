# Arta — Pencatat Keuangan Berbasis AI

Aplikasi HP untuk mencatat keuangan pribadi **tanpa mengisi formulir**. Tulis atau ucapkan
kalimat biasa — *"kemarin bensin 50k, kopi 22k, parkir 5k"* — dan aplikasi menyusunnya menjadi
tiga transaksi lengkap dengan kategori, dompet, dan tanggal.

Dibangun dengan Expo (React Native) + Supabase. Bisa dites langsung di HP lewat Expo Go.

---

## Yang membuatnya berbeda

| | Pencatat biasa | Arta |
|---|---|---|
| Memasukkan data | Isi form: nominal, kategori, tanggal, dompet | Ketik/ucapkan satu kalimat |
| Kategori | Pilih manual tiap kali | Ditebak otomatis, dan **belajar** dari koreksimu |
| Analisa | Grafik yang kamu tafsirkan sendiri | Aplikasi yang memberi tahu duluan |
| Pertanyaan | — | *"Aku boros di mana bulan ini?"* dijawab pakai datamu |

---

## Prinsip: hitung lokal dulu, panggil AI seperlunya

Ini yang membuat aplikasi tetap murah, cepat, dan **tetap berguna penuh tanpa API key apa pun**.

| Pekerjaan | Dikerjakan | Biaya |
|---|---|---|
| `"kopi 25rb"`, `"bensin 50k gopay"` | Regex + kamus di HP | Gratis, instan, offline |
| Kalimat rumit / ambigu | AI | ±80% panggilan terhindar |
| Deteksi langganan berulang | Statistik di HP | Gratis |
| Deteksi lonjakan & risiko budget | Statistik di HP | Gratis |
| Proyeksi akhir bulan | Rata-rata berbobot hari, di HP | Gratis |
| Menarasikan temuan jadi ringkasan | AI | 1 panggilan/minggu |
| Chat tanya keuangan | AI | Per pertanyaan |

Dengan `EXPO_PUBLIC_AI_MODE=local`, dashboard, proyeksi, deteksi langganan, dan input sederhana
**semuanya jalan**. AI menambah kepintaran, bukan syarat hidup.

---

## Cara menjalankan

```bash
npm install
```

Lalu pilih salah satu cara menyiapkan database. Keduanya memakai migrasi yang sama:
`supabase/migrations/20260820000000_init.sql`.

---

### Cara A — Supabase lokal (paling cepat, tanpa akun)

Butuh **Docker Desktop** menyala. Seluruh stack (Postgres, Auth, Storage, Edge Runtime)
berjalan di komputermu sendiri.

```bash
npx supabase start
```

Perintah itu menerapkan migrasi otomatis dan mencetak `API_URL` beserta `ANON_KEY`.
Salin keduanya ke `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=http://192.168.x.x:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY dari output di atas>
EXPO_PUBLIC_AI_MODE=local
```

> **Pakai IP LAN laptop, bukan `127.0.0.1`.** HP yang menjalankan Expo Go adalah perangkat
> lain — `127.0.0.1` di sana menunjuk ke HP itu sendiri, bukan ke laptopmu. Cari IP-nya
> dengan `ipconfig` (cari "IPv4 Address" pada adapter Wi-Fi). HP dan laptop harus satu Wi-Fi.

Alat bantu yang ikut menyala:

| Alamat | Isinya |
|---|---|
| http://127.0.0.1:54323 | Studio — lihat & sunting isi database |
| http://127.0.0.1:54324 | Kotak masuk email palsu, untuk menguji pendaftaran |

Mengosongkan database kembali ke keadaan awal:

```bash
npx supabase db reset
```

Mematikan stack:

```bash
npx supabase stop
```

---

### Cara B — Supabase cloud (untuk dipakai sehari-hari)

Perlu ini kalau ingin app tetap jalan saat laptop mati, dan wajib kalau ingin men-deploy
Edge Function.

1. Buat project baru di [supabase.com](https://supabase.com).
2. Terapkan skemanya — pilih salah satu:
   ```bash
   npx supabase link --project-ref <ref-project-kamu>
   npx supabase db push
   ```
   atau tempel isi `supabase/migrations/20260820000000_init.sql` ke **SQL Editor**.
3. Buka **Project Settings → Data API**, salin **Project URL** dan **anon public key** ke `.env`.
4. **Putuskan soal konfirmasi email.** Bawaannya menyala, dan layanan email gratis Supabase
   dibatasi hanya beberapa pengiriman per jam — mendaftar beberapa akun berturut-turut akan
   kena `over_email_send_rate_limit`. Pilih salah satu di **Authentication → Sign In / Providers → Email**:
   - matikan **Confirm email** (paling praktis untuk pemakaian pribadi), atau
   - biarkan menyala dan pasang **SMTP sendiri** di **Project Settings → Authentication → SMTP Settings**.

> **Anon key aman berada di aplikasi.** Aksesnya dibatasi Row Level Security ditambah GRANT
> tingkat tabel — tiap user hanya bisa menyentuh barisnya sendiri. Yang **tidak boleh** masuk
> ke aplikasi adalah API key AI; itu disimpan sebagai secret Edge Function (langkah 5).

---

### Jalankan aplikasinya

```bash
npm start
```

Scan QR dengan aplikasi **Expo Go** di HP. Daftar akun, lalu coba ketik `kopi 25rb`.

Sampai titik ini semuanya **gratis dan tanpa API key**.

---

### (Opsional) Aktifkan AI

Diperlukan untuk: kalimat rumit, input suara, chat tanya-jawab, dan ringkasan naratif.

#### Pilih provider

| Provider | Biaya | Catatan |
|---|---|---|
| **Gemini** | Ada free tier | Paling praktis. Sekaligus bisa transkripsi suara. Ambil key di [ai.google.dev](https://ai.google.dev). |
| **Groq** | Ada free tier | Khusus transkripsi suara (Whisper). Ambil key di [console.groq.com](https://console.groq.com). |
| **Claude** | Bayar (±Rp 26rb/bulan) | Kualitas Bahasa Indonesia terbaik. Ambil key di [console.anthropic.com](https://console.anthropic.com). Tidak menerima audio, jadi tetap butuh Gemini/Groq untuk suara. |

> **Langganan Claude Pro tidak berlaku di sini.** Claude API ditagih terpisah (pay-as-you-go).

#### Deploy Edge Function

```bash
npx supabase login
npx supabase link --project-ref <ref-project-kamu>
npx supabase functions deploy ai-parse ai-chat ai-insight ai-transcribe
```

#### Simpan API key sebagai secret (bukan di aplikasi)

Pilih salah satu:

```bash
npx supabase secrets set LLM_PROVIDER=gemini GEMINI_API_KEY=xxx STT_PROVIDER=gemini
```

```bash
npx supabase secrets set LLM_PROVIDER=claude ANTHROPIC_API_KEY=sk-ant-xxx STT_PROVIDER=groq GROQ_API_KEY=gsk_xxx
```

#### Nyalakan di aplikasi

Ubah `.env`:

```
EXPO_PUBLIC_AI_MODE=remote
```

lalu jalankan ulang dengan cache bersih:

```bash
npx expo start -c
```

---

## Peta kode

```
app/                              Layar (expo-router)
  (auth)/sign-in.tsx              Masuk & daftar
  (tabs)/index.tsx                Dashboard
  (tabs)/transactions.tsx         Riwayat, dikelompokkan per hari
  (tabs)/chat.tsx                 Tanya keuangan
  (tabs)/settings.tsx             Gajian, dompet, status AI
  add.tsx                         Input pintar (teks + suara)

src/
  lib/localParser.ts          ★  Parser regex gratis — inti mode hemat
  lib/ai.ts                   ★  Coba lokal dulu, AI belakangan
  lib/theme.ts                   Design token (warna, tipografi, kepadatan)
  lib/format.ts                  Rupiah & tanggal ala Indonesia
  analytics/projection.ts     ★  Proyeksi bulan + jatah aman per hari
  analytics/detectors.ts      ★  Langganan, lonjakan, risiko budget
  components/                    Kartu, grafik, baris, sheet konfirmasi
  hooks/useDashboard.ts          Semua angka dashboard
  store/session.tsx              Autentikasi
  store/data.tsx                 Satu sumber data untuk semua layar

supabase/
  migrations/2026...init.sql     Tabel, GRANT, RLS, seed kategori Indonesia
  functions/_shared/providers.ts ★ Adapter provider — ganti AI tanpa ubah app
  functions/ai-parse/            Teks → transaksi terstruktur
  functions/ai-chat/             Tanya-jawab (dikirimi ringkasan, bukan data mentah)
  functions/ai-insight/          Temuan → narasi mingguan
  functions/ai-transcribe/       Suara → teks
```

★ = bagian yang membedakan aplikasi ini dari pencatat pengeluaran biasa.

---

## Keamanan

- **API key AI tidak pernah masuk ke aplikasi.** Kalau ditaruh di app, siapa pun bisa membongkar
  APK dan memakai kuota/saldomu. Key hanya ada di Supabase Edge Function.
- **Row Level Security + GRANT tingkat tabel di semua tabel.** Keduanya wajib dan sering
  tertukar: GRANT menentukan boleh menyentuh tabelnya atau tidak, RLS menentukan baris mana
  yang terlihat. Setiap query difilter `auth.uid()`; user lain mendapat nol baris, bukan
  sekadar disembunyikan di UI. Role `anon` (belum login) tidak diberi akses sama sekali.
- **Edge Function memverifikasi token user** sebelum melakukan apa pun (`requireUser`).
- **Chat mengirim ringkasan angka, bukan transaksi mentah** — menekan biaya token sekaligus
  membatasi data pribadi yang keluar dari server.
- **AI tidak pernah menulis langsung ke database.** Semua hasil ditampilkan sebagai draft yang
  bisa diperiksa dan diubah dulu.

---

## Perintah

```bash
npm start          # jalankan Metro + QR untuk Expo Go
npm test           # 53 unit test untuk parser, proyeksi, dan detektor
npm run typecheck  # TypeScript strict
```

---

## Menguji parser tanpa membuka aplikasi

Logika parser murni dan teruji. Untuk melihat kasus yang sudah ditangani:

```bash
npx jest src/lib/localParser.test.ts --verbose
```

Sudah tercakup: `25rb` / `50k` / `1,5jt` / `Rp 250.000`, angka polos (`makan 35` → 35.000 dengan
keyakinan diturunkan), `kemarin` / `tadi pagi` / `tanggal 12`, pemetaan `gopay`/`bca` ke dompet,
pemisahan banyak transaksi dalam satu kalimat, dan pengecualian `"makan sama temen"` supaya tidak
salah terbelah.

---

## Sudah diverifikasi terhadap database sungguhan

Diuji pada 20 Agustus 2026 memakai stack Supabase lokal (Postgres 17), bukan tiruan:

| Yang diuji | Hasil |
|---|---|
| Migrasi diterapkan | 7 tabel, 27 policy, trigger, bucket storage |
| Daftar akun baru | Otomatis dapat 13 kategori + 3 dompet + profil |
| User lain membaca data kita | 0 baris |
| User lain menyamar (`user_id` orang lain) | Ditolak, kode 42501 |
| Belum login | Ditolak, kode 42501 |
| `"kemarin bensin 50k gopay, kopi 22rb, makan di warteg bu ani 35rb"` lewat UI | 3 transaksi tersimpan, tanggal mundur satu hari, kategori & dompet tepat, tanpa panggilan jaringan |

Pengujian itulah yang menemukan bug GRANT: skema sempat menyalakan RLS tanpa memberi izin
tabel, sehingga setiap query ditolak Postgres. Tidak akan pernah ketahuan dari unit test.

Keempat Edge Function juga dijalankan sungguhan di Edge Runtime Deno (`supabase functions serve`):

| Yang diuji | Hasil |
|---|---|
| Panggilan tanpa token | 401 — dijaga `requireUser`, bukan hanya oleh platform |
| `LLM_PROVIDER` belum diset | 501 beserta perintah perbaikannya |
| Teks kosong / lebih dari 1.000 karakter | 400 |
| Format audio tidak didukung | 400 |
| `LLM_PROVIDER=claude` tanpa API key | Modul `npm:@anthropic-ai/sdk` termuat, jalur Claude tereksekusi sampai pengecekan key |
| `STT_PROVIDER=groq` tanpa API key | Jalur Groq tereksekusi sampai pengecekan key |

Belakangan keempatnya di-deploy ke cloud dan diuji dengan **API key Gemini sungguhan**:

| Yang diuji | Hasil |
|---|---|
| `ai-parse` — `"tadi patungan bayar kado nikahan temen kantor, aku kebagian seratus dua puluh ribu, transfer lewat bca"` | Rp 120.000, kategori Sosial. Nominal ditulis dengan **huruf**, jadi parser lokal memang menyerah dan AI mengambil alih persis seperti rancangannya |
| `ai-chat` — *"aku boros di mana bulan ini?"* | Menyebut angka persis dari data: Belanja Rp 450.000, Makan & Minum Rp 350.000 |
| `ai-chat` — *"beli saham apa?"* | **Ditolak** dan diarahkan balik ke analisa pengeluaran, sesuai batasan di prompt |
| `ai-insight` | 4 kalimat, angka persis dari temuan, ditutup satu saran konkret |
| `ai-insight` panggilan kedua | Dilayani dari cache — tidak menyentuh Gemini |
| `ai-transcribe` | Rekaman *"kemarin beli bensin lima puluh ribu pakai gopay"* → **"Kemarin beli bensin 50 ribu pakai GoPay"** |

Pengujian itu menemukan dua hal. Pertama, model `gemini-2.5-flash` sudah pensiun untuk pengguna
baru — karena nama model diambil dari env `GEMINI_MODEL`, perbaikannya hanya satu baris. Kedua,
Gemini mengembalikan dompet `"BCA"` padahal dompet yang tersedia bernama `"Bank"`; pencocokan
lama diam-diam menjatuhkannya ke dompet pertama sehingga transaksi tercatat di sumber dana yang
salah. Diperbaiki di `src/lib/matching.ts`, yang kini berbagi kamus alias dengan parser lokal dan
**mengosongkan** dompet ketika namanya tidak dikenali, bukan menebak.

Seluruh rangkaian di atas diulang terhadap **project Supabase cloud sungguhan** (region Singapore,
PostgreSQL 17.6) dan hasilnya sama: migrasi terpasang, trigger menyemai 13 kategori dan 3 dompet,
isolasi antar-user tembus nol baris, penyamaran ditolak 42501, dan kalimat
`"kemarin makan di warteg bu ani 35rb, kopi 22rb gopay, gajian 8jt"` tersimpan sebagai tiga
transaksi — termasuk mengenali `gajian 8jt` sebagai pemasukan. Menghapus akun ikut menghapus
seluruh datanya, membuktikan `on delete cascade` bekerja.

Pengujian terhadap cloud itu menemukan perbedaan yang tidak muncul di lokal: Supabase cloud
memasang *default privileges* yang otomatis membuka tabel baru untuk role `anon`. Datanya tidak
bocor karena RLS tetap memblokir, tetapi lapisan keduanya hilang — diperbaiki oleh migrasi
`20260820120000_revoke_anon.sql`.

---

## Belum ada (sengaja)

- **Scan struk & screenshot m-banking** — kolom `receipt_url`, `source='ai_receipt'`, dan bucket
  storage sudah disiapkan di skema, jadi penambahannya nanti tidak perlu migrasi database.
- **Push notification** untuk insight — butuh EAS build, tidak jalan di Expo Go.
- **Speech-to-text di dalam HP** — butuh development build. Saat ini rekaman dikirim ke provider
  STT supaya tetap bisa dites lewat Expo Go.
- Tema terang, ekspor CSV, multi-mata uang, transaksi berulang otomatis.

---

## Catatan teknis

- `.npmrc` menyetel `legacy-peer-deps=true` karena `react-dom` (jalur web, tidak dipakai di HP)
  menuntut versi `react` yang berbeda dari yang dikunci Expo SDK 57.
- Jest memakai transform Babel biasa di lingkungan Node, bukan preset React Native penuh —
  modul yang diuji murni TypeScript tanpa impor React Native, jadi preset berat itu hanya
  menambah kerapuhan.
- Edge Function berjalan di Deno dan tidak ikut `npm run typecheck` (di-`exclude` dari
  `tsconfig.json`). Untuk memeriksanya, pasang Deno lalu jalankan
  `deno check supabase/functions/**/*.ts`.

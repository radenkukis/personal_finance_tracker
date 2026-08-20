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

### 1. Pasang dependensi

```bash
npm install
```

### 2. Siapkan Supabase (gratis)

1. Buat akun di [supabase.com](https://supabase.com), lalu buat project baru.
2. Buka **SQL Editor → New query**, tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql),
   jalankan. Ini membuat semua tabel, Row Level Security, dan menyiapkan 13 kategori khas
   Indonesia + 3 dompet yang otomatis terisi setiap kali ada user baru mendaftar.
3. Buka **Project Settings → Data API**, salin **Project URL** dan **anon public key**.

### 3. Isi file `.env`

```bash
cp .env.example .env
```

Isi dua baris ini:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_AI_MODE=local
```

> **Anon key aman berada di aplikasi.** Aksesnya dibatasi Row Level Security — tiap user hanya
> bisa membaca barisnya sendiri. Yang **tidak boleh** masuk ke aplikasi adalah API key AI; itu
> disimpan terpisah di Edge Function (langkah 5).

### 4. Jalankan

```bash
npx expo start
```

Scan QR dengan aplikasi **Expo Go** di HP. Daftar akun, lalu coba ketik `kopi 25rb`.

Sampai titik ini semuanya **gratis dan tanpa API key**.

---

### 5. (Opsional) Aktifkan AI

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
  schema.sql                     Tabel, RLS, seed kategori Indonesia
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
- **Row Level Security aktif di semua tabel.** Setiap query difilter `auth.uid()`; user lain
  mendapat nol baris, bukan sekadar disembunyikan di UI.
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

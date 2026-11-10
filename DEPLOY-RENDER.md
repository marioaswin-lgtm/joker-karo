# Deploy ke Render (gratis) untuk uji coba bersama teman

Hasil akhir: alamat `https://<nama-anda>.onrender.com` yang bisa dibuka Anda dan teman dari HP atau laptop.

## 1. Siapkan GitHub
1. Buat akun gratis di github.com.
2. Buat repositori baru (misalnya `joker-karo`), **Private** tidak masalah. Jangan centang README.

## 2. Unggah proyek ke GitHub
Ekstrak `joker-karo-engine.zip`, buka terminal di dalam foldernya, lalu:
```bash
git init
git add .
git commit -m "Joker Karo Online"
git branch -M main
git remote add origin https://github.com/<username-anda>/joker-karo.git
git push -u origin main
```
`.gitignore` sudah menyingkirkan `node_modules`. Pastikan `package-lock.json` ikut terunggah (Render membutuhkannya).

## 3. Buat akun Render
Buka render.com, **Sign up with GitHub**, lalu izinkan Render membaca repositori `joker-karo`.

## 4. Buat layanan
**Cara cepat (Blueprint):** **New** lalu **Blueprint**, pilih repositori, lanjutkan. Render membaca `render.yaml`
(paket gratis, Node 22, `npm start`, health check `/health`) dan meminta nilai `ACCESS_CODE`.
Isi kode akses pilihan Anda, lalu **Apply**.

**Cara manual (bila Blueprint bermasalah):** **New** lalu **Web Service**, pilih repositori, lalu isi:
- Runtime: `Node`
- Build Command: `npm ci --omit=dev`
- Start Command: `npm start`
- Instance Type: **Free**
- Environment: `ACCESS_CODE` = kode pilihan Anda, dan `NODE_VERSION` = `22`
- Advanced, Health Check Path: `/health`

## 5. Tunggu build selesai
Buka tab **Logs**. Dalam 2 sampai 5 menit akan muncul tulisan seperti
`Joker Karo Online berjalan di http://localhost:10000 (kode akses aktif)` dan status berubah menjadi **Live**.

## 6. Uji
1. Buka `https://<nama-anda>.onrender.com/health`. Harus tampil `ok`.
2. Buka alamat utama, isi nama dan kode akses, lalu **Buat room**.
3. Kirim alamat, kode akses, dan kode room 4 huruf ke teman Anda.

## Hal yang perlu diketahui
- Layanan gratis tidur setelah 15 menit tanpa lalu lintas. Klien mengirim ping tiap 4 menit selama halaman terbuka,
  jadi permainan yang sedang berjalan tidak ikut tidur.
- Kunjungan pertama setelah tidur butuh sekitar 1 menit.
- Layanan bisa restart kapan saja, dan room hanya ada di memori: bila restart, buat room baru.
- Memperbarui: `git add . && git commit -m "ubah" && git push`. Render otomatis deploy ulang.
- Kuota gratis 750 jam per bulan, cukup untuk satu layanan.
- Render kadang meminta kartu untuk verifikasi saat membuat layanan. Bila itu terjadi, kartu wajib diisi.

## Masalah umum
| Masalah | Solusi |
|---|---|
| Build gagal `npm ci` | `package-lock.json` belum ikut ter-push. Jalankan `git add package-lock.json`, commit, push. |
| Status "Deploy failed", log menyebut `tsx` tidak ditemukan | Pastikan Build Command `npm ci --omit=dev` (bukan `--omit=dev` tanpa `ci`) dan `tsx` ada di `dependencies` pada `package.json`. |
| Halaman tidak terbuka | Cek status layanan Live dan alamat `/health`. Setelah tidur, tunggu sekitar 1 menit. |
| "Kode akses salah" | `ACCESS_CODE` di Render berbeda dengan yang Anda ketik. Ubah di tab Environment lalu deploy ulang. |
| Room hilang tiba-tiba | Layanan restart atau tidur lama. Buat room baru. |

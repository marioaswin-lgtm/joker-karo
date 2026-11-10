# Menguji di Android dan iPhone

Klien web sudah disiapkan sebagai **PWA** (aplikasi web yang bisa dipasang di layar utama):
grafik kartu SVG (tema Klasik, Malam, Retro) dengan badut Joker orisinal, tombol sentuh 44 px,
seret kartu dengan sentuhan, mode layar penuh, dan ikon aplikasi.

## Syarat
- Buka lewat alamat **https** (mis. tunnel `cloudflared` atau hosting). Instal PWA dan service worker
  tidak aktif di `http://IP:3000` (hanya `localhost` dan https yang diizinkan browser).
- Lewat `http://IP:3000` di Wi-Fi yang sama, game tetap bisa dimainkan di browser, hanya tidak bisa dipasang.

## Android (Chrome)
1. Buka alamat https dari tunnel/hosting di Chrome.
2. Menu ⋮ lalu **Instal aplikasi** (atau **Tambahkan ke layar utama**).
3. Buka dari ikon "Joker Karo". Tampil layar penuh tanpa bilah alamat.

## iPhone (Safari)
1. Buka alamat https di **Safari** (bukan Chrome iOS).
2. Tombol **Bagikan** lalu **Tambah ke Layar Utama**.
3. Buka dari ikon. Tampil layar penuh.

## Tampilan
- **Landscape penuh layar, tanpa scroll**: meja hijau dengan pemain duduk melingkar, tumpukan ambil dan buangan di tengah,
  kartu Anda di bawah. Diuji pada 568x320, 667x375, 844x390, 932x430, dan 1280x720.
- Ketuk **tumpukan ambil** (atau kartu buangan teratas, yang diberi cincin hijau) untuk mengambil kartu.
- Tombol **Skor** membuka papan skor (poin, chip, jumlah beli, kartu, dan top up untuk host). Tombol **Menu** berisi tema, log, dan keluar.
- Mode portrait menampilkan ajakan memutar HP. Saat dipasang sebagai PWA di Android, orientasi dikunci landscape.
  iPhone tidak mengizinkan kunci orientasi dari web, jadi cukup putar HP.

## Kontrol sentuh
- Ketuk kartu untuk memilih, lalu ketuk Set 1-3 atau Sisa untuk memindahkan.
- Atau tahan dan geser kartu ke Set 1-3, Sisa, atau kotak buang.
- Buang: pilih kartu di giliran Anda lalu "Buang kartu terpilih", atau geser ke kotak buang.

## Aplikasi native (nanti, opsional)
Untuk memasukkan ke Play Store/App Store, bungkus klien ini dengan Capacitor (kode web yang sama).
Android butuh Android Studio. iPhone butuh Mac, Xcode, dan akun Apple Developer berbayar
(TestFlight untuk beta). Untuk tahap alpha/beta, PWA di atas sudah cukup.

## Mengganti gambar badut
Gambar ada di `public/cards.js` (fungsi `clown`). Anda bisa meminta variasi (misalnya lebih seram),
atau memakai ilustrasi sendiri/berlisensi dengan mengganti isi fungsi itu atau menambahkan file gambar.

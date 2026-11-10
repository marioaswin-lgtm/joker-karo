# Panduan Uji Coba Online (Alpha dan Beta, tanpa video)

Tujuan: menguji aturan dan alur permainan dengan pemain sungguhan sebelum video conference ditambahkan.
Server menyimpan state di memori, jadi **restart server menghapus semua room** (wajar untuk alpha/beta).

## 1. Cara menjalankan online

**Tercepat (hari ini), dari laptop Anda lewat tunnel:**
```bash
ACCESS_CODE=kodeku npm run dev          # Windows PowerShell: $env:ACCESS_CODE="kodeku"; npm run dev
# terminal lain, salah satu:
npx cloudflared tunnel --url http://localhost:3000   # atau: ngrok http 3000
```
Bagikan alamat https yang muncul beserta kode akses ke tester. Server mati saat laptop mati.

**Tetap online (disarankan untuk beta):** deploy repo ke Render (`render.yaml` sudah disiapkan),
Railway, Fly.io, atau VPS apa pun dengan Docker (`docker build -t joker-karo . && docker run -p 3000:3000 -e ACCESS_CODE=kodeku joker-karo`).
Syarat: layanan harus mendukung WebSocket dan memakai HTTPS (klien otomatis memakai `wss://`).
Paket gratis biasanya "tertidur" bila tidak dipakai, dan memori terhapus saat restart.

Variabel lingkungan: `PORT` (otomatis di hosting), `ACCESS_CODE` (kode akses untuk pemain terpilih).

## 2. Tahap Alpha (tim kecil, 3 sampai 4 orang)

Fokus: apakah aturan berjalan benar. Mainkan beberapa babak penuh, tiap orang di perangkat berbeda
(minimal satu HP dan satu laptop). Centang skenario berikut:

- [ ] Buat room, 3 teman bergabung dengan kode, host memulai. Urutan duduk dari undian terlihat di log.
- [ ] Pemain pertama menerima 11 kartu, lainnya 10. Tengah berisi 1 chip per pemain.
- [ ] Ambil dari tumpukan dan ambil dari buangan (hanya kartu teratas yang bisa diambil).
- [ ] Susun kartu 3-3-4 dengan drag and drop di desktop, dan ketuk-pindah di HP.
- [ ] Tombol Masuk/Tutup nonaktif sebelum Ceki; Ceki di giliran yang sama belum cukup; aktif setelah Ceki di giliran sebelumnya.
- [ ] Menang biasa: pemenang -10 poin dan mengambil chip tengah.
- [ ] Bento (A♠ dari pembagian awal) dan Nyemplung (menang dengan kartu buangan) memindahkan chip yang benar.
- [ ] MinTig (-30, +1 chip per pemain kalah) dan MinLim (-50, +2 chip per pemain kalah).
- [ ] Poin sisa pemain kalah sesuai (Joker 0, As 11, J/Q/K 10), dengan susunan set terbaik otomatis.
- [ ] Pemain mencapai 76 poin: beli ke-1 otomatis; beli ke-2 dan ke-3 muncul sebagai pilihan; menolak = tereliminasi.
- [ ] Chip tidak cukup: host menekan +10 (kelipatan 10); tanpa top up 3 menit = tereliminasi.
- [ ] Tersisa 2 pemain: tidak ada beli. BOM: semua pemain lain mati saat pemenang masuk, tanpa beli, pot ke pemenang.
- [ ] Babak baru: skor direset, chip dibawa, undian tempat duduk diulang.

## 3. Tahap Beta (5 sampai 7 orang, kondisi nyata)

Fokus: kestabilan dan kenyamanan. Mainkan 2 sampai 3 babak tanpa dibantu pengembang.

- [ ] 7 pemain sekaligus (tumpukan cukup untuk pembagian 71 kartu, daur ulang antar ronde).
- [ ] Pemain menutup tab atau kehilangan sinyal lalu kembali dalam 3 menit: kursi dan kartunya tetap sama.
- [ ] Pemain terputus lebih dari 3 menit: gilirannya dilewati dan ronde berlanjut.
- [ ] Refresh halaman di tengah permainan: tersambung kembali otomatis.
- [ ] Tampilan di HP kecil: kartu, tabel pemain, dan tombol masih nyaman dipakai.
- [ ] Dua room berjalan bersamaan tanpa saling mengganggu.
- [ ] Semua aturan terasa sesuai kebiasaan bermain. Catat hal yang janggal, termasuk aturan yang belum jelas.

## 4. Cara melapor bug

Kirim ke pengembang: (1) kode room, (2) nama Anda, (3) ronde/babak ke berapa, (4) apa yang Anda lakukan,
(5) apa yang terjadi vs yang diharapkan, (6) tangkapan layar (termasuk log di bagian bawah halaman),
(7) perangkat dan browser.

## 5. Yang belum ada di versi ini

Video conference, tema kartu, toggle aturan di UI (semua aturan aktif), penyimpanan permanen,
akun pengguna (akses dibatasi dengan satu kode akses bersama).

## 6. Catatan penting

- Chip dan poin hanya **virtual**. Selama uji coba, jangan mengaitkannya dengan uang sungguhan.
- Top up ditekan host secara manual lewat tombol +10 di tabel pemain.

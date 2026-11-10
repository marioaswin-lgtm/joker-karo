# Joker Karo Online: Rule Engine dan Server Multiplayer (v1.8)

Implementasi TypeScript dari Game Rules Spec v1.2 beserta unit test untuk seluruh kasus uji di bagian 14 spec.
Murni logika (tanpa UI/jaringan), dirancang untuk dijalankan di server (server-authoritative).

## Menjalankan

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
```

## Struktur

| File | Isi |
|---|---|
| `src/types.ts` | Tipe kartu, `RoomConfig` (toggle aturan, biaya beli, dll.), `DEFAULT_CONFIG` |
| `src/cards.ts` | Deck 108 kartu, shuffle (RNG kriptografis), pembagian, daur ulang tumpukan, undian tempat duduk |
| `src/sets.ts` | Validasi seri, kembar, set 4 As (dengan Joker) |
| `src/hand.ts` | `checkWin` (3 set: 3, 3, 4; MinLim/MinTig) dan `minLeftover` (pembagian set terbaik untuk poin sisa) |
| `src/rules.ts` | Bento, Nyemplung, chip di tengah (ante), poin pemenang -10, bonus MinTig/MinLim, Ceki di giliran sebelumnya (`tryDeclare`), tanpa beli saat 2 pemain/BOM, skor ronde, mati/beli/reset, top up, pemenang babak, disconnect |

## Notasi kartu di test

`AS` = As spade, `10H` = 10 heart, `JD`, `QC`, `KS`, `JK` = Joker. Contoh: `hand('AS 2S 3S JK')`.

## Catatan

- Kartu undian, urutan pembagian, dan semua RNG bisa disuntik (`rng`) agar test deterministik.
- Pembayaran chip dikembalikan sebagai daftar `Transfer`; penerapannya ke saldo dilakukan oleh lapisan game.
- Tidak ada pemrosesan uang asli di engine (top up hanya divalidasi kelipatan 10 chip).

## Server multiplayer (WebSocket)

```bash
npm install
npm run dev        # http://localhost:3000
```

Buka `http://localhost:3000` di beberapa browser/perangkat (satu jaringan atau lewat tunnel seperti ngrok).
Satu pemain membuat room, yang lain bergabung dengan kode 4 huruf. Host memulai permainan.

| File | Isi |
|---|---|
| `server/game.ts` | Mesin satu room (server-authoritative): lobby, undian duduk, giliran, Ceki, masuk/tutup, poin, chip, beli/top up, BOM, babak baru, disconnect |
| `server/server.ts` | HTTP + WebSocket, room berkode, reconnect dengan token, tick 1 detik |
| `server/main.ts` | Titik masuk (`PORT` opsional) |
| `public/index.html` | Klien web (mobile-friendly): tabel pemain, tumpukan buangan, susun kartu 3-3-4 dengan seret mouse atau sentuhan |
| `public/cards.js` | Grafik kartu SVG: 52 kartu, punggung, badut Joker orisinal, tema Klasik/Malam/Retro |
| `public/manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA: bisa dipasang di layar utama Android dan iPhone |

Kartu lawan tidak pernah dikirim ke klien (hanya jumlah kartu).
Grafik kartu SVG (3 tema, badut Joker orisinal) dan dukungan HP (PWA): lihat **MOBILE.md**.

Deploy gratis ke Render: lihat **DEPLOY-RENDER.md**. Untuk uji coba online (alpha/beta), lihat **TESTING.md** (tunnel, deploy ke Render/Docker, kode akses `ACCESS_CODE`, checklist skenario).

Belum ada: video conference, tema kartu, toggle aturan di UI, penyimpanan permanen (state hanya di memori server).

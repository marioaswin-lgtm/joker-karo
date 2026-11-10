import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, hand, type Rng } from '../src';
import { Game } from '../server/game';

const seeded = (seed: number): Rng => {
  let a = seed;
  return (n) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
};
const WIN = 'AS 2S 3S 7H 7D 7C 9H 9D 9C 9S KC'; // 11 kartu, KC dibuang
const L34 = 'AS 2S 3S 7H 7D 7C 9S KH QD 5C'; // 34 poin sisa
const L68 = '2C 5D 9H KS QH 4S 7C 8D JC 3H'; // 68 poin, tidak ada set

function mk(n = 3) {
  const g = new Game(DEFAULT_CONFIG, seeded(42));
  for (let i = 0; i < n; i++) g.addPlayer(`p${i}`, `Pemain${i}`);
  expect(g.start('p0').ok).toBe(true);
  for (const p of g.players) p.chips = 20;
  g.center = n;
  return g;
}
/** Pemain 0 (giliran) menang dengan WIN; pemain lain memegang kartu tetap. */
function setupWin(g: Game, phase: 'draw' | 'discard' = 'discard') {
  g.cur = 0;
  g.phase = phase;
  g.turn = 1;
  g.players[0].cekiTurn = 0;
  g.players[0].hand = hand(phase === 'discard' ? WIN : 'AS 2S 3S 7H 7D 7C 9H 9D 9C 9S');
  g.players.slice(1).forEach((p, i) => (p.hand = hand(i % 2 === 0 ? L34 : L68)));
}

describe('Mulai permainan', () => {
  it('hanya host yang bisa memulai, minimal 2 pemain, dan tidak bisa join setelah mulai', () => {
    const g = new Game();
    g.addPlayer('a', 'A');
    expect(g.start('a').ok).toBe(false);
    g.addPlayer('b', 'B');
    expect(g.start('b').ok).toBe(false);
    expect(g.start('a').ok).toBe(true);
    expect(g.addPlayer('c', 'C').ok).toBe(false);
  });

  it('maksimum 7 pemain', () => {
    const g = new Game();
    for (let i = 0; i < 7; i++) expect(g.addPlayer(`p${i}`, 'x').ok).toBe(true);
    expect(g.addPlayer('p8', 'x').ok).toBe(false);
  });

  it('pemain pertama 11 kartu, lainnya 10; ante 1 chip per pemain ke tengah; total chip tetap', () => {
    const g = new Game(DEFAULT_CONFIG, seeded(1));
    for (let i = 0; i < 4; i++) g.addPlayer(`p${i}`, `P${i}`);
    g.start('p0');
    expect(g.players[0].hand).toHaveLength(11);
    g.players.slice(1).forEach((p) => expect(p.hand).toHaveLength(10));
    expect(g.center).toBe(4);
    expect(g.players.reduce((s, p) => s + p.chips, 0) + g.center).toBe(80);
    expect(g.phase).toBe('discard');
    expect(g.deck).toHaveLength(108 - 41);
  });
});

describe('Giliran', () => {
  it('buang -> pemain berikutnya ambil; aksi di luar giliran ditolak', () => {
    const g = mk();
    const first = g.players[0];
    expect(g.act(g.players[1].id, { type: 'draw_deck' }).ok).toBe(false);
    expect(g.act(first.id, { type: 'draw_deck' }).ok).toBe(false); // sudah 11 kartu
    expect(g.act(first.id, { type: 'discard', cardId: first.hand[0].id }).ok).toBe(true);
    expect(first.hand).toHaveLength(10);
    expect(g.phase).toBe('draw');
    expect(g.cur).toBe(1);
    expect(g.act(g.players[1].id, { type: 'draw_deck' }).ok).toBe(true);
    expect(g.players[1].hand).toHaveLength(11);
    expect(g.phase).toBe('discard');
  });

  it('hanya kartu buangan teratas yang bisa diambil', () => {
    const g = mk();
    const first = g.players[0];
    const c = first.hand[3];
    g.act(first.id, { type: 'discard', cardId: c.id });
    g.act(g.players[1].id, { type: 'draw_discard' });
    expect(g.players[1].hand).toContain(c);
    expect(g.discard).toHaveLength(0);
    expect(g.drewDiscard).toBe(true);
  });
});

describe('Masuk/Tutup dengan Ceki', () => {
  it('ditolak tanpa ceki, dan ditolak bila ceki di giliran yang sama', () => {
    const g = mk();
    setupWin(g);
    g.players[0].cekiTurn = null;
    expect(g.act('p0'.replace('p0', g.players[0].id), { type: 'declare' })).toMatchObject({ ok: false });
    g.act(g.players[0].id, { type: 'ceki' }); // ceki di turn 1
    expect(g.act(g.players[0].id, { type: 'declare' })).toMatchObject({ ok: false });
    expect(g.view(g.players[0].id).canDeclare).toBe(false);
  });

  it('ceki di giliran sebelumnya: menang, dapat chip tengah dan poin -10', () => {
    const g = mk();
    setupWin(g);
    const w = g.players[0];
    const before = w.chips;
    const center = g.center;
    expect(g.view(w.id).canDeclare).toBe(true);
    expect(g.act(w.id, { type: 'declare' }).ok).toBe(true);
    expect(w.chips).toBe(before + center);
    expect(w.score).toBe(-10);
    expect(g.players[1].score).toBe(34);
    expect(g.players[2].score).toBe(68);
    expect(g.phase).toBe('between_rounds');
    expect(g.summary?.winnerId).toBe(w.id);
  });

  it('tangan 10 kartu yang sudah lengkap bisa masuk di fase ambil (setelah ceki sebelumnya)', () => {
    const g = mk();
    setupWin(g, 'draw');
    expect(g.act(g.players[0].id, { type: 'declare' }).ok).toBe(true);
  });

  it('Nyemplung: pembuang bayar 1 chip ke pemenang bila kartu diambil dari buangan', () => {
    const g = mk();
    setupWin(g);
    g.drewDiscard = true;
    g.lastDiscarder = g.players[2].id;
    const w = g.players[0];
    const d = g.players[2];
    const [wb, db, c] = [w.chips, d.chips, g.center];
    g.act(w.id, { type: 'declare' });
    expect(w.chips).toBe(wb + c + 1);
    expect(d.chips).toBe(db - 1);
  });

  it('MinLim: tiap pemain kalah bayar 2 chip tambahan dan pemenang -50 poin', () => {
    const g = mk();
    setupWin(g, 'draw');
    g.players[0].hand = hand('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S');
    const w = g.players[0];
    const wb = w.chips;
    const c = g.center;
    g.act(w.id, { type: 'declare' });
    expect(w.chips).toBe(wb + c + 4);
    expect(w.score).toBe(-50);
    expect(g.summary?.tag).toBe('MinLim');
  });

  it('MinTig: tiap pemain kalah bayar 1 chip tambahan dan pemenang -30 poin', () => {
    const g = mk();
    setupWin(g, 'draw');
    g.players[0].hand = hand('10S JS QS KH KD KC AS AH AD AC');
    const w = g.players[0];
    const wb = w.chips;
    const c = g.center;
    g.act(w.id, { type: 'declare' });
    expect(w.chips).toBe(wb + c + 2);
    expect(w.score).toBe(-30);
  });
});

describe('Mati, beli, top up, dan akhir babak', () => {
  it('pembelian ke-1 wajib otomatis: poin direset ke nilai tertinggi pemain selamat, chip masuk pot', () => {
    const g = mk();
    setupWin(g);
    g.players[1].score = 70; // 70 + 34 = 104 -> mati
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.players[1]).toMatchObject({ buys: 1, chips: 19, score: 68 });
    expect(g.pot).toBe(1);
    expect(g.phase).toBe('between_rounds');
  });

  it('beli ke-2 adalah pilihan: menunggu keputusan, lalu beli atau tolak', () => {
    const g = mk();
    setupWin(g);
    g.players[1].score = 70;
    g.players[1].buys = 1;
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.phase).toBe('buy');
    expect(g.view(g.players[1].id).pending).toEqual([g.players[1].id]);
    expect(g.act(g.players[1].id, { type: 'buy' }).ok).toBe(true);
    expect(g.players[1]).toMatchObject({ buys: 2, chips: 18, score: 68 });
    expect(g.pot).toBe(2);
    expect(g.phase).toBe('between_rounds');
  });

  it('menolak beli: tereliminasi; batas waktu keputusan = menolak', () => {
    const g = mk();
    setupWin(g);
    g.players[1].score = 70;
    g.players[1].buys = 1;
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.act(g.players[1].id, { type: 'decline' }).ok).toBe(true);
    expect(g.players[1].out).toBe(true);

    const h = mk();
    setupWin(h);
    h.players[1].score = 70;
    h.players[1].buys = 1;
    h.act(h.players[0].id, { type: 'declare' });
    expect(h.tick(Date.now() + 10 * 60_000)).toBe(true);
    expect(h.players[1].out).toBe(true);
  });

  it('chip tidak cukup: tunggu top up host (kelipatan 10), lalu beli diproses', () => {
    const g = mk();
    setupWin(g);
    g.players[1].score = 70;
    g.players[1].chips = 0;
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.phase).toBe('topup');
    const nonHost = g.players.find((p) => p.id !== g.hostId)!;
    expect(g.act(nonHost.id, { type: 'topup', playerId: g.players[1].id, amount: 10 }).ok).toBe(false); // bukan host
    expect(g.act(g.hostId, { type: 'topup', playerId: g.players[1].id, amount: 15 }).ok).toBe(false);
    expect(g.act(g.hostId, { type: 'topup', playerId: g.players[1].id, amount: 10 }).ok).toBe(true);
    expect(g.players[1]).toMatchObject({ buys: 1, chips: 9 });
    expect(g.phase).toBe('between_rounds');
  });

  it('tidak top up dalam 3 menit: tereliminasi', () => {
    const g = mk();
    setupWin(g);
    g.players[1].score = 70;
    g.players[1].chips = 0;
    g.act(g.players[0].id, { type: 'declare' });
    g.tick(Date.now() + 181_000);
    expect(g.players[1].out).toBe(true);
  });

  it('pemain terakhir bertahan menang babak dan menerima seluruh pot', () => {
    const g = mk(2);
    setupWin(g);
    g.pot = 5;
    g.players[1].score = 70;
    g.players[1].buys = 3; // sudah beli 3 kali
    const w = g.players[0];
    const wb = w.chips;
    g.act(w.id, { type: 'declare' });
    expect(g.players[1].out).toBe(true);
    expect(g.phase).toBe('over');
    expect(w.chips).toBe(wb + g.cfg.startingChips * 0 + 2 + 5); // chip tengah (2) + pot (5)
    expect(g.pot).toBe(0);
  });

  it('ronde berikutnya dimulai host dengan pemenang sebagai pemain pertama; semua kartu terkumpul', () => {
    const g = mk();
    setupWin(g);
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.deck.length + g.discard.length).toBe(108);
    expect(g.act(g.players.find((p) => p.id !== g.hostId)!.id, { type: 'next_round' }).ok).toBe(false);
    expect(g.act(g.hostId, { type: 'next_round' }).ok).toBe(true);
    expect(g.round).toBe(2);
    expect(g.players[g.cur].id).toBe(g.players[0].id);
    expect(g.players[0].hand).toHaveLength(11);
    expect(g.players[0].cekiTurn).toBeNull();
  });
});

describe('Disconnect dan privasi', () => {
  it('giliran ditunggu sampai 3 menit lalu dilewati', () => {
    const g = mk();
    const first = g.players[0];
    g.act(first.id, { type: 'discard', cardId: first.hand[0].id });
    const p1 = g.players[1];
    g.setConnected(p1.id, false, 1000);
    expect(g.tick(1000 + 179_000)).toBe(false);
    expect(g.cur).toBe(1);
    expect(g.tick(1000 + 180_000)).toBe(true);
    expect(g.cur).toBe(2);
    expect(g.phase).toBe('draw');
  });

  it('reconnect dalam 3 menit: tetap bermain', () => {
    const g = mk();
    g.act(g.players[0].id, { type: 'discard', cardId: g.players[0].hand[0].id });
    g.setConnected(g.players[1].id, false, 0);
    g.setConnected(g.players[1].id, true, 60_000);
    expect(g.tick(200_000)).toBe(false);
  });

  it('view tidak membocorkan kartu lawan', () => {
    const g = mk();
    const v = g.view(g.players[1].id);
    expect(v.hand).toHaveLength(10);
    expect(JSON.stringify(v.players)).not.toContain('"hand"');
    expect(v.players[0].handCount).toBe(11);
  });
});

describe('Tanpa kesempatan beli: 2 pemain dan BOM', () => {
  it('2 pemain: yang mati langsung tereliminasi (tanpa pembelian wajib), babak berakhir', () => {
    const g = mk(2);
    setupWin(g);
    g.players[1].score = 70; // 70 + 34 = 104
    g.pot = 3;
    const w = g.players[0];
    const wb = w.chips;
    g.act(w.id, { type: 'declare' });
    expect(g.players[1]).toMatchObject({ out: true, buys: 0 });
    expect(g.phase).toBe('over');
    expect(w.chips).toBe(wb + 2 + 3);
  });

  it('tersisa 2 pemain (dari 3): yang mati tidak boleh beli', () => {
    const g = mk(3);
    setupWin(g);
    g.players[2].out = true;
    g.players[1].score = 70;
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.players[1]).toMatchObject({ out: true, buys: 0 });
    expect(g.phase).toBe('over');
  });

  it('BOM: semua pemain lain mati saat pemenang masuk, tanpa beli, pot ke pemenang, babak berakhir', () => {
    const g = mk(3);
    setupWin(g);
    g.players[1].score = 70; // 70 + 34 = 104
    g.players[2].score = 20; // 20 + 68 = 88
    g.pot = 5;
    const w = g.players[0];
    const wb = w.chips;
    const c = g.center;
    g.act(w.id, { type: 'declare' });
    expect(g.players[1]).toMatchObject({ out: true, buys: 0 });
    expect(g.players[2]).toMatchObject({ out: true, buys: 0 });
    expect(g.phase).toBe('over');
    expect(g.summary?.tag).toContain('BOM');
    expect(g.messages.some((m) => m.includes('BOM'))).toBe(true);
    expect(w.chips).toBe(wb + c + 5);
    expect(g.pot).toBe(0);
  });

  it('babak baru: skor, beli, dan eliminasi direset; chip dibawa; undian dan pembagian ulang', () => {
    const g = mk(3);
    setupWin(g);
    g.players[1].score = 70;
    g.players[2].score = 20;
    g.act(g.players[0].id, { type: 'declare' });
    expect(g.phase).toBe('over');
    const chips = Object.fromEntries(g.players.map((p) => [p.id, p.chips]));
    const nonHost = g.players.find((p) => p.id !== g.hostId)!;
    expect(g.act(nonHost.id, { type: 'next_babak' }).ok).toBe(false);
    expect(g.act(g.hostId, { type: 'next_babak' }).ok).toBe(true);
    expect(g.babak).toBe(2);
    expect(g.round).toBe(1);
    expect(g.phase).toBe('discard');
    for (const p of g.players) {
      expect(p).toMatchObject({ out: false, buys: 0 });
      expect(p.score).toBe(0);
      // chip dibawa dari babak sebelumnya (dikurangi ante, plus/minus Bento)
      expect(Math.abs(p.chips - chips[p.id])).toBeLessThanOrEqual(1 + 2 * 2);
    }
    expect(g.players[0].hand).toHaveLength(11);
    expect(g.center).toBe(3);
    expect(g.act(g.hostId, { type: 'next_babak' }).ok).toBe(false); // belum selesai
  });
});

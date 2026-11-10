import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, PresenceTracker, applyTopUp, awardPot, babakWinner, bentoTransfers, canReplacePlayer,
  eliminatePlayers, hand, netChanges, nyemplungTransfer, resolveDeaths, validateTopUp, type BabakPlayer,
} from '../src';

const P = (id: string, score: number, buys = 0, chips = 20): BabakPlayer => ({ id, score, buys, chips, eliminated: false });

describe('Bento dan Double Bento (hanya dari pembagian awal)', () => {
  const others = { p2: hand('2C 3C 4D 5D 6H 7H 8S 9S 10C JD'), p3: hand('2D 3D 4H 5H 6S 7S 8C 9C 10D JH') };

  it('Bento: 1 chip dari setiap pemain lain', () => {
    const t = bentoTransfers({ p1: hand('AS 2S 3S 4C 5C 6D 7D 8H 9H 10S'), ...others });
    expect(t).toHaveLength(2);
    expect(netChanges(t)).toEqual({ p2: -1, p1: 2, p3: -1 });
  });

  it('Double Bento: 2 chip per pemain (bukan 2 total)', () => {
    const t = bentoTransfers({ p1: hand('AS AS 3S 4C 5C 6D 7D 8H 9H 10S'), ...others });
    expect(netChanges(t)).toEqual({ p2: -2, p1: 4, p3: -2 });
  });

  it('A spade yang diambil kemudian (tidak ada di tangan awal) tidak dihitung', () => {
    const initial = { p1: hand('2S 3S 4C 5C 6D 7D 8H 9H 10S JS'), ...others };
    expect(bentoTransfers(initial)).toEqual([]);
  });

  it('A selain spade bukan Bento', () => {
    expect(bentoTransfers({ p1: hand('AH AD AC 3S 4C 5C 6D 7D 8H 9H'), ...others })).toEqual([]);
  });

  it('dua pemain sama-sama Bento saling bayar, dihitung bersih', () => {
    const t = bentoTransfers({ p1: hand('AS 3S 4C 5C 6D 7D 8H 9H 10S JS'), p2: hand('AS 3D 4D 5D 6H 7H 8S 9S 10C JD'), p3: others.p3 });
    expect(netChanges(t)).toEqual({ p2: 1, p1: 1, p3: -2 });
  });

  it('toggle dimatikan: tidak ada transfer', () => {
    expect(bentoTransfers({ p1: hand('AS 3S 4C 5C 6D 7D 8H 9H 10S JS'), ...others }, false)).toEqual([]);
  });
});

describe('Nyemplung', () => {
  it('pembuang membayar 1 chip ke pemenang bila pemenang mengambil kartu buangan itu', () => {
    expect(nyemplungTransfer({ winnerId: 'b', drewFromDiscard: true, discarderId: 'a' })).toEqual({ from: 'a', to: 'b', chips: 1 });
  });
  it('tidak berlaku bila pemenang mengambil dari tumpukan ambil', () => {
    expect(nyemplungTransfer({ winnerId: 'b', drewFromDiscard: false, discarderId: 'a' })).toBeNull();
  });
  it('tidak berlaku bila pemain pertama masuk di giliran pertama (tanpa buangan)', () => {
    expect(nyemplungTransfer({ winnerId: 'a', drewFromDiscard: false })).toBeNull();
  });
  it('toggle dimatikan', () => {
    expect(nyemplungTransfer({ winnerId: 'b', drewFromDiscard: true, discarderId: 'a', enabled: false })).toBeNull();
  });
});

describe('Urutan proses mati, beli, dan reset poin', () => {
  it('contoh spec: A=60, B=70, C=80, D=90 -> C dan D beli ke-1 dan direset ke 70', () => {
    const r = resolveDeaths([P('A', 60), P('B', 70), P('C', 80), P('D', 90)], 0);
    expect(r.resetScore).toBe(70);
    expect(r.pot).toBe(2);
    const byId = Object.fromEntries(r.players.map((p) => [p.id, p]));
    expect(byId.C).toMatchObject({ score: 70, buys: 1, chips: 19 });
    expect(byId.D).toMatchObject({ score: 70, buys: 1, chips: 19 });
    expect(byId.A.score).toBe(60);
    expect(r.outcomes.every((o) => o.status === 'bought')).toBe(true);
  });

  it('75 selamat, 76 mati', () => {
    const r = resolveDeaths([P('A', 75), P('B', 76), P('C', 10)], 0);
    expect(r.players.find((p) => p.id === 'A')!.buys).toBe(0);
    expect(r.players.find((p) => p.id === 'B')!.buys).toBe(1);
    expect(r.resetScore).toBe(75);
  });

  it('beli ke-2 (2 chip) dan ke-3 (3 chip) adalah pilihan; menolak = tereliminasi', () => {
    const get = (r: { players: BabakPlayer[] }) => r.players.find((p) => p.id === 'C')!;
    const buy2 = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 1)], 0, { C: 'buy' });
    expect(get(buy2)).toMatchObject({ buys: 2, chips: 18, score: 20 });
    expect(buy2.pot).toBe(2);
    const buy3 = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 2)], 0, { C: 'buy' });
    expect(get(buy3)).toMatchObject({ buys: 3, chips: 17 });
    expect(buy3.pot).toBe(3);
    const decline = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 1)], 0, { C: 'decline' });
    expect(get(decline).eliminated).toBe(true);
    const noAnswer = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 1)], 0);
    expect(get(noAnswer).eliminated).toBe(true);
  });

  it('setelah 3 kali beli, mati lagi = tereliminasi', () => {
    const r = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 3)], 0, { C: 'buy' });
    expect(r.players[2].eliminated).toBe(true);
  });

  it('toggle beli opsional dimatikan: hanya beli ke-1 yang ada', () => {
    const cfg = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, optionalBuy: false } };
    const r = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 1)], 0, { C: 'buy' }, cfg);
    expect(r.players[2].eliminated).toBe(true);
  });

  it('reset memakai nilai tertinggi pemain selamat, bukan sesama yang mati', () => {
    const r = resolveDeaths([P('A', 30), P('B', 50), P('C', 100), P('D', 90)], 5);
    expect(r.resetScore).toBe(50);
    expect(r.pot).toBe(7);
  });

  it('chip tidak cukup: butuh top up (kelipatan 10), lalu beli diproses ulang', () => {
    const first = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 0, 0)], 0);
    expect(first.outcomes[0]).toMatchObject({ id: 'C', status: 'needs_topup', cost: 1, shortfall: 1 });
    const toppedUp = first.players.map((p) => (p.id === 'C' ? applyTopUp(p, 10) : p));
    const second = resolveDeaths(toppedUp, first.pot);
    expect(second.players[2]).toMatchObject({ buys: 1, chips: 9, score: 20 });
    expect(second.pot).toBe(1);
  });

  it('top up hanya kelipatan 10', () => {
    for (const ok of [10, 20, 30]) expect(() => validateTopUp(ok)).not.toThrow();
    for (const bad of [0, 5, 15, -10, 10.5]) expect(() => validateTopUp(bad)).toThrow();
  });

  it('tidak top up dalam batas waktu: tereliminasi', () => {
    const first = resolveDeaths([P('A', 10), P('B', 20), P('C', 80, 0, 0)], 0);
    const after = eliminatePlayers(first.players, ['C']);
    expect(after.find((p) => p.id === 'C')!.eliminated).toBe(true);
    expect(babakWinner(after)).toBeNull(); // A dan B masih bertahan
  });

  it('pemenang babak = pemain terakhir bertahan, menerima seluruh pot', () => {
    const players = [P('A', 10), { ...P('B', 80), eliminated: true }, { ...P('C', 90), eliminated: true }];
    expect(babakWinner(players)).toBe('A');
    const award = awardPot(players, 7);
    expect(award.players[0].chips).toBe(27);
  });

  it('babak belum selesai bila masih ada lebih dari satu pemain', () => {
    expect(babakWinner([P('A', 10), P('B', 20)])).toBeNull();
    expect(() => awardPot([P('A', 10), P('B', 20)], 3)).toThrow();
  });

  it('tersisa 2 pemain (atau hanya 2 sejak awal): tidak ada kesempatan beli', () => {
    const r = resolveDeaths([P('A', 10), P('B', 80)], 3);
    expect(r.noBuy).toBe(true);
    expect(r.bom).toBe(false);
    expect(r.players[1]).toMatchObject({ eliminated: true, buys: 0, chips: 20 });
    expect(r.pot).toBe(3);
    expect(babakWinner(r.players)).toBe('A');
    // 3 pemain, satu sudah tereliminasi: tersisa 2
    const r2 = resolveDeaths([P('A', 10), { ...P('B', 90), eliminated: true }, P('C', 80)], 0);
    expect(r2.players[2].eliminated).toBe(true);
    expect(r2.noBuy).toBe(true);
  });

  it('BOM: semua pemain lain mati saat pemenang masuk: tidak ada beli, babak berakhir', () => {
    const r = resolveDeaths([P('A', -10), P('B', 80), P('C', 90), P('D', 100)], 4);
    expect(r.bom).toBe(true);
    expect(r.noBuy).toBe(true);
    expect(r.players.filter((p) => p.eliminated).map((p) => p.id)).toEqual(['B', 'C', 'D']);
    expect(r.pot).toBe(4);
    expect(babakWinner(r.players)).toBe('A');
    const aw = awardPot(r.players, r.pot);
    expect(aw.players[0].chips).toBe(24);
  });

  it('bukan BOM bila masih ada lebih dari satu pemain selamat', () => {
    const r = resolveDeaths([P('A', 10), P('B', 20), P('C', 90)], 0);
    expect(r.bom).toBe(false);
    expect(r.noBuy).toBe(false);
    expect(r.players[2]).toMatchObject({ buys: 1, score: 20 });
  });

  it('invarian: selalu ada yang selamat (pemenang ronde), bila tidak itu error', () => {
    expect(() => resolveDeaths([P('A', 80), P('B', 90)], 0)).toThrow();
  });
});

describe('Disconnect dan reconnect 3 menit', () => {
  it('kembali dalam 3 menit: lanjut bermain', () => {
    const t = new PresenceTracker();
    t.disconnect('a', 0);
    expect(t.status('a', 60_000)).toBe('waiting');
    expect(t.turnAction('a', 60_000)).toBe('wait');
    expect(t.reconnect('a', 179_999)).toBe(true);
    expect(t.status('a', 179_999)).toBe('connected');
    expect(t.turnAction('a', 179_999)).toBe('play');
  });

  it('lewat 3 menit: giliran dilewati dan tidak bisa kembali di ronde itu', () => {
    const t = new PresenceTracker();
    t.disconnect('a', 0);
    expect(t.status('a', 180_000)).toBe('expired');
    expect(t.turnAction('a', 180_000)).toBe('skip');
    expect(t.reconnect('a', 200_000)).toBe(false);
  });

  it('keluar sukarela: tidak bisa kembali di babak yang sama', () => {
    const t = new PresenceTracker();
    t.leave('a');
    expect(t.status('a', 0)).toBe('left');
    expect(t.reconnect('a', 1000)).toBe(false);
    expect(t.turnAction('a', 1000)).toBe('skip');
  });

  it('pergantian pemain hanya saat pergantian babak', () => {
    expect(canReplacePlayer('between_babak')).toBe(true);
    expect(canReplacePlayer('between_round')).toBe(false);
    expect(canReplacePlayer('in_round')).toBe(false);
  });
});

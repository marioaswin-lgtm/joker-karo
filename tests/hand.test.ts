import { describe, expect, it } from 'vitest';
import { cardToString, checkWin, hand, minLeftover, scoreRound } from '../src';

describe('Masuk (3 set: 3, 3, 4)', () => {
  it('menang dengan 3 set yang salah satunya seri; kartu ke-11 dibuang', () => {
    const r = checkWin(hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S KC'));
    expect(r).not.toBeNull();
    expect(cardToString(r!.discard!)).toBe('KC');
    expect(r!.sets.map((s) => s.length).sort()).toEqual([3, 3, 4]);
  });

  it('pemain pertama (11 kartu) boleh langsung masuk di giliran pertama', () => {
    expect(checkWin(hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S 4C'))).not.toBeNull();
  });

  it('tangan 10 kartu juga dicek', () => {
    expect(checkWin(hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S'))).not.toBeNull();
  });

  it('tanpa seri dan tanpa 4 As: tidak masuk', () => {
    expect(checkWin(hand('7S 7H 7D 9S 9H 9D KS KH KD KC'))).toBeNull();
  });

  it('4 As menggantikan seri', () => {
    expect(checkWin(hand('AS AH AD AC 7S 7H 7D 9S 9H 9D'))).not.toBeNull();
    expect(checkWin(hand('AS AH JK AC 7S 7H 7D 9S 9H 9D'))).not.toBeNull();
  });

  it('susunan harus 3, 3, 4 dan semua set valid', () => {
    expect(checkWin(hand('2S 3S 4S 6H 7H 8H 9D 9C 5D KC'))).toBeNull();
    // 7 kartu seri bisa dipecah 3 + 4, ditambah kembar 3
    expect(checkWin(hand('AS 2S 3S 4S 5S 6S 7S 9H 9D 9C'))).not.toBeNull();
  });

  it('jumlah kartu selain 10 atau 11 tidak valid', () => {
    expect(checkWin(hand('AS 2S 3S'))).toBeNull();
  });
});

describe('MinLim (-50) dan MinTig (-30), termasuk dengan Joker', () => {
  it('MinLim: tiga set seri satu tipe', () => {
    const r = checkWin(hand('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S'));
    expect(r!.roundScore).toBe(-50);
    expect(r!.minLim).toBe(true);
  });

  it('MinLim dengan Joker', () => {
    const r = checkWin(hand('AS 2S JK 4S 5S 6S 7S 8S JK 10S'));
    expect(r!.roundScore).toBe(-50);
  });

  it('MinLim tidak berlaku bila tipe berbeda antar set', () => {
    const r = checkWin(hand('AS 2S 3S 4H 5H 6H 7D 8D 9D 10D'));
    expect(r!.roundScore).toBe(0);
  });

  it('MinTig: semua kartu 10, J, Q, K, A (set tetap harus valid)', () => {
    const r = checkWin(hand('10S JS QS KH KD KC AS AH AD AC'));
    expect(r!.roundScore).toBe(-30);
    expect(r!.minTig).toBe(true);
  });

  it('MinTig dengan Joker', () => {
    const r = checkWin(hand('10S JK QS KH KD KC AS AH AD AC'));
    expect(r!.roundScore).toBe(-30);
  });

  it('MinTig gagal bila ada kartu di luar 10-A', () => {
    const r = checkWin(hand('9S 10S JS KH KD KC AS AH AD AC'));
    expect(r!.roundScore).toBe(0);
  });

  it('bila MinLim dan MinTig sama-sama terpenuhi, MinLim (-50) yang dipakai', () => {
    const r = checkWin(hand('10S JS QS 10S JS QS JK JK KS AS'));
    expect(r!.roundScore).toBe(-50);
    expect(r!.minLim).toBe(true);
    expect(r!.minTig).toBe(false);
  });

  it('toggle mematikan bonus', () => {
    const h = hand('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S');
    expect(checkWin(h, { minLim: false, minTig: true })!.roundScore).toBe(0);
    const t = hand('10S JS QS KH KD KC AS AH AD AC');
    expect(checkWin(t, { minLim: true, minTig: false })!.roundScore).toBe(0);
  });
});

describe('Pembagian set terbaik untuk poin sisa (dengan dan tanpa Joker)', () => {
  it('menghitung poin kartu yang tidak jadi set', () => {
    const r = minLeftover(hand('AS 2S 3S 7H 7D 7C 9S KH QD 5C'));
    expect(r.points).toBe(9 + 10 + 10 + 5);
    expect(r.sets).toHaveLength(2);
    expect(r.leftover).toHaveLength(4);
  });

  it('memilih pembagian optimal, bukan serakah (seri 5-6-7 vs kembar 7-7-7)', () => {
    // seri 5S6S7S menyisakan 37 poin; kembar 7S7H7D menyisakan 34 poin
    expect(minLeftover(hand('5S 6S 7S 7H 7D 4C 9C KH')).points).toBe(34);
  });

  it('Joker membantu membentuk set dan bernilai 0', () => {
    expect(minLeftover(hand('KS KH 2C 3D JK')).points).toBe(2 + 3);
    expect(minLeftover(hand('KS KH 2C 3D 4H')).points).toBe(29);
    expect(minLeftover(hand('JK 2C 9D')).points).toBe(11);
  });

  it('As bernilai 11, J/Q/K bernilai 10', () => {
    expect(minLeftover(hand('AS 5H')).points).toBe(16);
    expect(minLeftover(hand('JS QH KD')).points).toBe(30);
  });

  it('scoreRound: pemenang 0 / bonus, lainnya poin sisa terbaik (juga untuk yang disconnect)', () => {
    const loser = hand('AS 2S 3S 7H 7D 7C 9S KH QD 5C');
    const scores = scoreRound({ win: hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S'), disc: loser }, 'win', -50);
    expect(scores.win).toBe(-50);
    expect(scores.disc).toBe(34); // bukan 71 (jumlah penuh)
  });
});

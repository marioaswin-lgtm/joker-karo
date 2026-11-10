import { describe, expect, it } from 'vitest';
import {
  CENTER, DEFAULT_CONFIG, anteTransfers, checkWin, hand, netChanges, roundWinnerTransfers, tryDeclare, winnerRoundPoints,
} from '../src';

const ids = ['a', 'b', 'c', 'd'];

describe('Chip di tengah (ante) dan hadiah ronde', () => {
  it('tiap pemain hidup menaruh 1 chip di tengah', () => {
    const t = anteTransfers(ids);
    expect(t).toHaveLength(4);
    expect(netChanges(t)).toEqual({ a: -1, b: -1, c: -1, d: -1, [CENTER]: 4 });
  });

  it('pemenang ronde mengambil seluruh chip di tengah', () => {
    const t = roundWinnerTransfers({ winnerId: 'b', aliveIds: ids, win: { minLim: false, minTig: false }, centerChips: 4 });
    expect(netChanges(t)).toEqual({ [CENTER]: -4, b: 4 });
  });

  it('MinTig: tiap pemain kalah membayar 1 chip tambahan ke pemenang', () => {
    const t = roundWinnerTransfers({ winnerId: 'b', aliveIds: ids, win: { minLim: false, minTig: true }, centerChips: 4 });
    expect(netChanges(t)).toEqual({ [CENTER]: -4, b: 4 + 3, a: -1, c: -1, d: -1 });
  });

  it('MinLim: tiap pemain kalah membayar 2 chip tambahan ke pemenang', () => {
    const t = roundWinnerTransfers({ winnerId: 'b', aliveIds: ids, win: { minLim: true, minTig: false }, centerChips: 4 });
    expect(netChanges(t)).toEqual({ [CENTER]: -4, b: 4 + 6, a: -2, c: -2, d: -2 });
  });

  it('hanya pemain yang masih hidup yang membayar bonus', () => {
    const t = roundWinnerTransfers({ winnerId: 'a', aliveIds: ['a', 'c'], win: { minLim: false, minTig: true }, centerChips: 2 });
    expect(netChanges(t)).toEqual({ [CENTER]: -2, a: 3, c: -1 });
  });
});

describe('Poin pemenang ronde', () => {
  it('menang biasa: -10', () => {
    const w = checkWin(hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S KC'))!;
    expect(winnerRoundPoints(w)).toBe(-10);
  });
  it('MinTig tetap -30 dan MinLim tetap -50 (bukan -10)', () => {
    expect(winnerRoundPoints(checkWin(hand('10S JS QS KH KD KC AS AH AD AC'))!)).toBe(-30);
    expect(winnerRoundPoints(checkWin(hand('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S'))!)).toBe(-50);
  });
  it('nilai bisa diatur lewat konfigurasi', () => {
    const w = checkWin(hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S KC'))!;
    expect(winnerRoundPoints(w, { ...DEFAULT_CONFIG, winnerPoints: -5 })).toBe(-5);
  });
});

describe('Masuk/Tutup wajib Ceki di giliran sebelumnya', () => {
  const winning = hand('AS 2S 3S 7H 7D 7C 9H 9D 9C 9S KC');

  it('tangan menang tapi belum ceki: ditolak', () => {
    expect(tryDeclare(winning, null, 5)).toEqual({ ok: false, reason: 'ceki_required' });
  });
  it('ceki di giliran yang sama: ditolak', () => {
    expect(tryDeclare(winning, 5, 5)).toEqual({ ok: false, reason: 'ceki_same_turn' });
  });
  it('ceki di giliran sebelumnya: diterima', () => {
    expect(tryDeclare(winning, 4, 5).ok).toBe(true);
    expect(tryDeclare(winning, 0, 7).ok).toBe(true);
  });
  it('sudah ceki tapi tangan belum menang: ditolak', () => {
    expect(tryDeclare(hand('7S 7H 7D 9S 9H 9D KS KH KD KC'), 1, 5)).toEqual({ ok: false, reason: 'not_winning' });
  });
  it('pemain pertama tidak bisa langsung masuk di giliran pertama', () => {
    expect(tryDeclare(winning, null, 0).ok).toBe(false);
    expect(tryDeclare(winning, 0, 0).ok).toBe(false); // ceki di giliran yang sama
  });
});

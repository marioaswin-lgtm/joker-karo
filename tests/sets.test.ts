import { describe, expect, it } from 'vitest';
import { hand, isFourAces, isGroup, isSeries } from '../src';

describe('Validasi seri', () => {
  it('A-2-3 dan Q-K-A valid (A di bawah 2 atau di atas K)', () => {
    expect(isSeries(hand('AS 2S 3S'))).toBe(true);
    expect(isSeries(hand('QS KS AS'))).toBe(true);
    expect(isSeries(hand('JS QS KS AS'))).toBe(true);
    expect(isSeries(hand('AS 2S 3S 4S'))).toBe(true);
  });
  it('tidak boleh memutar: K-A-2 dan Q-K-A-2 tidak valid', () => {
    expect(isSeries(hand('KS AS 2S'))).toBe(false);
    expect(isSeries(hand('QS KS AS 2S'))).toBe(false);
  });
  it('harus satu tipe dan berurutan', () => {
    expect(isSeries(hand('2S 3S 4H'))).toBe(false);
    expect(isSeries(hand('5S 7S 8S'))).toBe(false);
  });
  it('kartu sama (2 deck) tidak boleh dobel dalam satu seri', () => {
    expect(isSeries(hand('5S 5S 6S'))).toBe(false);
  });
  it('ukuran set hanya 3 atau 4', () => {
    expect(isSeries(hand('5S 6S'))).toBe(false);
    expect(isSeries(hand('3S 4S 5S 6S 7S'))).toBe(false);
  });
  it('Joker menggantikan kartu apa saja, termasuk A di ujung', () => {
    expect(isSeries(hand('5S JK 7S'))).toBe(true);
    expect(isSeries(hand('AS JK KS'))).toBe(true); // Q-K-A dengan Joker sebagai Q
    expect(isSeries(hand('AS JK 3S'))).toBe(true);
    expect(isSeries(hand('KS JK 2S'))).toBe(false); // memutar
    expect(isSeries(hand('JK JK JK'))).toBe(true);
  });
});

describe('Validasi kembar (tipe bebas, pemakaian Joker)', () => {
  it('angka atau gambar sama, tipe berbeda', () => {
    expect(isGroup(hand('7S 7H 7D'))).toBe(true);
    expect(isGroup(hand('JS JH JC'))).toBe(true);
    expect(isGroup(hand('9S 9H 9D 9C'))).toBe(true);
  });
  it('tipe sama pun tidak apa', () => {
    expect(isGroup(hand('7S 7S 7S'))).toBe(true);
    expect(isGroup(hand('7S 7S 7H'))).toBe(true);
  });
  it('angka atau gambar berbeda tidak valid', () => {
    expect(isGroup(hand('7S 8S 9S'))).toBe(false);
    expect(isGroup(hand('JS QS KS'))).toBe(false);
  });
  it('Joker menggantikan kartu apa saja', () => {
    expect(isGroup(hand('7S JK 7D'))).toBe(true);
    expect(isGroup(hand('JK JK JK'))).toBe(true);
    expect(isGroup(hand('7S JK 8D'))).toBe(false);
  });
});

describe('Set 4 As sebagai pengganti seri', () => {
  it('empat As valid, dengan atau tanpa Joker', () => {
    expect(isFourAces(hand('AS AH AD AC'))).toBe(true);
    expect(isFourAces(hand('AS AS AH JK'))).toBe(true);
    expect(isFourAces(hand('AS AH JK JK'))).toBe(true);
  });
  it('bukan empat As', () => {
    expect(isFourAces(hand('AS AH AD KC'))).toBe(false);
    expect(isFourAces(hand('AS AH AD'))).toBe(false);
  });
});

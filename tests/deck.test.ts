import { describe, expect, it } from 'vitest';
import {
  cardToString, createDeck, dealRound, recycleAtRoundEnd, refillDrawPile, resolveSeatOrder, shuffle,
  parseCard, type Card, type Rng,
} from '../src';

const seeded = (seed: number): Rng => {
  let a = seed;
  return (n) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
};
const ids = (cards: Card[]) => cards.map((c) => c.id);

describe('Tumpukan kartu', () => {
  it('deck = 108 kartu unik (2 deck + 4 Joker)', () => {
    const d = createDeck();
    expect(d).toHaveLength(108);
    expect(new Set(ids(d)).size).toBe(108);
    expect(d.filter((c) => c.joker)).toHaveLength(4);
    expect(d.filter((c) => !c.joker && c.suit === 'S' && c.rank === 1)).toHaveLength(2);
  });

  it('shuffle mempertahankan seluruh kartu', () => {
    const d = createDeck();
    expect(ids(shuffle(d, seeded(1))).sort()).toEqual(ids(d).sort());
  });

  it('7 pemain: pemain pertama 11 kartu, lainnya 10, sisa tumpukan 37', () => {
    const deck = createDeck();
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const { hands, drawPile } = dealRound(deck, players);
    expect(hands.p1).toHaveLength(11);
    for (const p of players.slice(1)) expect(hands[p]).toHaveLength(10);
    expect(drawPile).toHaveLength(37);
  });

  it('dibagi satu per satu berurutan; kartu ke-11 untuk pemain pertama', () => {
    const deck = createDeck();
    const { hands } = dealRound(deck, ['a', 'b', 'c']);
    expect(hands.a[0]).toBe(deck[0]);
    expect(hands.b[0]).toBe(deck[1]);
    expect(hands.c[0]).toBe(deck[2]);
    expect(hands.a[1]).toBe(deck[3]);
    expect(hands.a[10]).toBe(deck[30]);
  });

  it('tumpukan tidak cukup untuk pembagian: error', () => {
    expect(() => dealRound(createDeck().slice(0, 30), ['a', 'b', 'c'])).toThrow();
  });
});

describe('Daur ulang tumpukan kartu', () => {
  it('akhir ronde: buangan + kartu di tangan di-shuffle dan ditaruh di bawah sisa tumpukan', () => {
    const deck = createDeck();
    const { hands, drawPile } = dealRound(deck, ['a', 'b', 'c']);
    const discard = drawPile.slice(0, 20);
    const remaining = drawPile.slice(20);
    const next = recycleAtRoundEnd(remaining, discard, hands, seeded(7));
    expect(next).toHaveLength(108);
    expect(ids(next.slice(0, remaining.length))).toEqual(ids(remaining)); // sisa tetap di atas
    expect(new Set(ids(next)).size).toBe(108);
  });

  it('pembagian lanjut mengambil dari bagian bawah yang sudah di-shuffle bila sisa kurang', () => {
    const deck = createDeck();
    const small = deck.slice(0, 5); // sisa sangat sedikit
    const recycled = deck.slice(5);
    const pile = recycleAtRoundEnd(small, recycled, {}, seeded(3));
    const { hands } = dealRound(pile, ['a', 'b', 'c']);
    expect(ids(hands.a).slice(0, 2)).toEqual(ids(small).slice(0, 5).filter((_, i) => i % 3 === 0));
    expect(hands.a).toHaveLength(11);
  });

  it('tengah ronde: tumpukan habis, buangan (kecuali kartu teratas) di-shuffle jadi tumpukan baru', () => {
    const discard = ['2S', '3S', '4S', '5S', 'KH'].map((t) => parseCard(t));
    const r = refillDrawPile([], discard, seeded(5));
    expect(ids(r.drawPile).sort()).toEqual(ids(discard.slice(0, 4)).sort());
    expect(r.discardPile).toEqual([discard[4]]);
  });

  it('tumpukan masih ada: tidak diubah', () => {
    const r = refillDrawPile([parseCard('2S')], [parseCard('3S'), parseCard('4S')]);
    expect(r.drawPile).toHaveLength(1);
    expect(r.discardPile).toHaveLength(2);
  });

  it('tidak ada yang bisa didaur ulang: error', () => {
    expect(() => refillDrawPile([], [parseCard('4S')])).toThrow();
  });
});

describe('Undian tempat duduk', () => {
  const draw = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, parseCard(v)]));
  const noRedraw = () => {
    throw new Error('tidak boleh undian ulang');
  };

  it('A terendah ... K tertinggi; seri angka diputus tipe (spade > heart > diamond > club)', () => {
    const order = resolveSeatOrder(draw({ p1: 'KC', p2: 'KS', p3: 'AH', p4: '5D' }), noRedraw);
    expect(order).toEqual(['p2', 'p1', 'p4', 'p3']);
  });

  it('seri penuh (kartu sama persis): hanya pemain yang seri mengambil ulang', () => {
    const calls: string[][] = [];
    const order = resolveSeatOrder(draw({ p1: 'KS', p2: 'KS', p3: '5D' }), (ids) => {
      calls.push(ids);
      return draw({ p1: '2C', p2: '9H' });
    });
    expect(calls).toEqual([['p1', 'p2']]);
    expect(order).toEqual(['p2', 'p1', 'p3']);
  });

  it('Joker dikembalikan dan pemain mengambil kartu baru (sampai bukan Joker)', () => {
    const replies = [{ p1: 'JK' }, { p1: 'QD' }];
    const calls: string[][] = [];
    const order = resolveSeatOrder(draw({ p1: 'JK', p2: '5D' }), (ids) => {
      calls.push(ids);
      return draw(replies.shift()!);
    });
    expect(calls).toEqual([['p1'], ['p1']]);
    expect(order).toEqual(['p1', 'p2']);
  });

  it('cardToString konsisten', () => {
    expect(cardToString(parseCard('10H'))).toBe('10H');
    expect(cardToString(parseCard('JK'))).toBe('JK');
  });
});

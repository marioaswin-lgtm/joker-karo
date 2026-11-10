import { randomInt } from 'node:crypto';
import type { Card, NaturalCard, Rank, Suit } from './types';

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export type Rng = (n: number) => number; // mengembalikan bilangan bulat acak di [0, n)
export const secureRng: Rng = (n) => randomInt(n);

/** Nilai poin: angka = angka, J/Q/K = 10, A = 11, Joker = 0. */
export function cardValue(c: Card): number {
  if (c.joker) return 0;
  if (c.rank === 1) return 11;
  return c.rank >= 10 ? 10 : c.rank;
}

export function cardToString(c: Card): string {
  return c.joker ? 'JK' : `${RANK_LABELS[c.rank]}${c.suit}`;
}

/** Parse "AS", "10H", "JD", "QC", "KS", "JK" (Joker). */
export function parseCard(text: string, id: string = text): Card {
  if (text === 'JK') return { id, joker: true };
  const m = /^(10|[2-9]|[AJQK])([SHDC])$/.exec(text);
  if (!m) throw new Error(`Kartu tidak valid: ${text}`);
  const label = m[1];
  const rank = (label === 'A' ? 1 : label === 'J' ? 11 : label === 'Q' ? 12 : label === 'K' ? 13 : Number(label)) as Rank;
  return { id, joker: false, suit: m[2] as Suit, rank };
}

/** hand("AS 2S 3S JK") -> Card[] dengan id unik. */
export function hand(text: string): Card[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t, i) => parseCard(t, `${t}#${i}`));
}

/** 2 deck (104 kartu) + 4 Joker = 108 kartu. */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (let r = 1; r <= 13; r++) {
        cards.push({ id: `${suit}${r}-${d}`, joker: false, suit, rank: r as Rank });
      }
    }
  }
  for (let j = 0; j < 4; j++) cards.push({ id: `JK-${j}`, joker: true });
  return cards;
}

/** Fisher-Yates, mengembalikan array baru. Default memakai RNG kriptografis. */
export function shuffle<T>(items: readonly T[], rng: Rng = secureRng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Membagi kartu satu per satu per putaran, berurutan (berlawanan arah jarum jam),
 * dimulai dari pemain pertama, sampai tiap pemain punya 10 kartu.
 * Lalu pemain pertama menerima kartu ke-11. Puncak tumpukan = indeks 0.
 */
export function dealRound(drawPile: readonly Card[], playerIds: readonly string[]) {
  const n = playerIds.length;
  const needed = 10 * n + 1;
  if (n < 2) throw new Error('Minimal 2 pemain');
  if (drawPile.length < needed) {
    throw new Error(`Tumpukan tidak cukup: butuh ${needed}, tersedia ${drawPile.length}`);
  }
  const hands: Record<string, Card[]> = {};
  for (const id of playerIds) hands[id] = [];
  let k = 0;
  for (let round = 0; round < 10; round++) {
    for (const id of playerIds) hands[id].push(drawPile[k++]);
  }
  hands[playerIds[0]].push(drawPile[k++]);
  return { hands, drawPile: drawPile.slice(k) };
}

/**
 * Akhir ronde: buangan + seluruh kartu di tangan dikumpulkan, di-shuffle,
 * lalu diletakkan DI BAWAH sisa tumpukan ambil (opsi A pada spec).
 */
export function recycleAtRoundEnd(
  drawPile: readonly Card[],
  discardPile: readonly Card[],
  hands: Record<string, readonly Card[]>,
  rng: Rng = secureRng,
): Card[] {
  const collected = [...discardPile, ...Object.values(hands).flat()];
  return [...drawPile, ...shuffle(collected, rng)];
}

/**
 * Di tengah ronde: bila tumpukan ambil habis, buangan (kecuali kartu teratas,
 * yaitu elemen terakhir) di-shuffle menjadi tumpukan ambil baru.
 */
export function refillDrawPile(drawPile: readonly Card[], discardPile: readonly Card[], rng: Rng = secureRng) {
  if (drawPile.length > 0) return { drawPile: [...drawPile], discardPile: [...discardPile] };
  if (discardPile.length <= 1) throw new Error('Tidak ada kartu untuk didaur ulang');
  const top = discardPile[discardPile.length - 1];
  return { drawPile: shuffle(discardPile.slice(0, -1), rng), discardPile: [top] };
}

// ---------- Undian tempat duduk ----------
const SUIT_STRENGTH: Record<Suit, number> = { S: 4, H: 3, D: 2, C: 1 };

/** A terendah ... K tertinggi; seri ditentukan tipe: spade > heart > diamond > club. */
export function seatStrength(c: NaturalCard): number {
  return c.rank * 10 + SUIT_STRENGTH[c.suit];
}

/**
 * Menentukan urutan duduk (pemain pertama = indeks 0, lalu berlawanan arah jarum jam).
 * - Joker: dikembalikan, pemain mengambil kartu baru (redraw).
 * - Seri penuh (angka dan tipe sama, mungkin karena 2 deck): hanya pemain yang seri mengambil ulang.
 * `redraw(ids)` harus mengembalikan kartu baru untuk id yang diminta.
 */
export function resolveSeatOrder(
  draws: Record<string, Card>,
  redraw: (playerIds: string[]) => Record<string, Card>,
  maxRedraws = 100,
): string[] {
  let budget = maxRedraws;
  const useRedraw = (ids: string[]) => {
    if (budget-- <= 0) throw new Error('Terlalu banyak undian ulang');
    return redraw(ids);
  };

  function rank(ids: string[], current: Record<string, Card>): string[] {
    if (ids.length <= 1) return [...ids];
    const cards = { ...current };
    let jokers = ids.filter((id) => cards[id].joker);
    while (jokers.length > 0) {
      const fresh = useRedraw(jokers);
      for (const id of jokers) cards[id] = fresh[id];
      jokers = ids.filter((id) => cards[id].joker);
    }
    const groups = new Map<number, string[]>();
    for (const id of ids) {
      const key = seatStrength(cards[id] as NaturalCard);
      groups.set(key, [...(groups.get(key) ?? []), id]);
    }
    const out: string[] = [];
    for (const key of [...groups.keys()].sort((a, b) => b - a)) {
      const g = groups.get(key)!;
      if (g.length === 1) out.push(g[0]);
      else out.push(...rank(g, useRedraw(g)));
    }
    return out;
  }

  return rank(Object.keys(draws), draws);
}

import { cardValue } from './cards';
import { isFourAces, isGroup, isSeries } from './sets';
import type { Card, NaturalCard } from './types';

interface SetInfo {
  mask: number;
  cards: Card[];
  series: boolean;
  fourAces: boolean;
}

const popcount = (n: number) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};

/** Semua subset 3 atau 4 kartu yang membentuk set valid (seri atau kembar). */
function analyze(cards: readonly Card[]): Map<number, SetInfo> {
  const out = new Map<number, SetInfo>();
  const total = 1 << cards.length;
  for (let m = 1; m < total; m++) {
    const k = popcount(m);
    if (k !== 3 && k !== 4) continue;
    const sub = cards.filter((_, i) => m & (1 << i));
    const series = isSeries(sub);
    if (!series && !isGroup(sub)) continue;
    out.set(m, { mask: m, cards: sub, series, fourAces: isFourAces(sub) });
  }
  return out;
}

// ---------- Masuk (menang) ----------
export interface WinOptions {
  minLim: boolean;
  minTig: boolean;
}

export interface WinResult {
  /** Kartu ke-11 yang dibuang (null bila tangan 10 kartu). */
  discard: Card | null;
  /** Tiga set (3, 3, 4 kartu). */
  sets: Card[][];
  /** 0, -50 (MinLim), atau -30 (MinTig). MinLim didahulukan karena nilainya lebih besar. */
  roundScore: number;
  minLim: boolean;
  minTig: boolean;
}

const TIG_RANKS = new Set([1, 10, 11, 12, 13]);

/**
 * Cek apakah tangan "masuk": 10 kartu terbagi 3 set (3, 3, 4), semua valid,
 * dan minimal satu seri ATAU set 4 kartu berisi 4 As.
 * Tangan 11 kartu: kartu ke-11 dibuang (semua pilihan dicoba).
 * Mengembalikan susunan dengan skor ronde terbaik (paling rendah), atau null.
 */
export function checkWin(cards: readonly Card[], opts: WinOptions = { minLim: true, minTig: true }): WinResult | null {
  let candidates: { discard: Card | null; ten: Card[] }[];
  if (cards.length === 10) candidates = [{ discard: null, ten: [...cards] }];
  else if (cards.length === 11) candidates = cards.map((c, i) => ({ discard: c, ten: cards.filter((_, j) => j !== i) }));
  else return null;

  let best: WinResult | null = null;
  for (const { discard, ten } of candidates) {
    const info = analyze(ten);
    const full = (1 << 10) - 1;
    const nat = ten.filter((c): c is NaturalCard => !c.joker);
    const sameSuit = nat.every((c) => c.suit === nat[0].suit);
    const allTig = nat.every((c) => TIG_RANKS.has(c.rank));

    for (const s4 of info.values()) {
      if (popcount(s4.mask) !== 4) continue;
      const rest = full & ~s4.mask;
      const low = rest & -rest;
      for (const a of info.values()) {
        if (popcount(a.mask) !== 3 || (a.mask & rest) !== a.mask || !(a.mask & low)) continue;
        const b = info.get(rest & ~a.mask);
        if (!b) continue;
        if (!(s4.series || a.series || b.series || s4.fourAces)) continue;

        const minLim = opts.minLim && s4.series && a.series && b.series && sameSuit;
        const minTig = opts.minTig && allTig;
        const roundScore = minLim ? -50 : minTig ? -30 : 0;
        if (!best || roundScore < best.roundScore) {
          best = { discard, sets: [a.cards, b.cards, s4.cards], roundScore, minLim, minTig: !minLim && minTig };
          if (roundScore === -50) return best;
        }
      }
    }
  }
  return best;
}

// ---------- Poin sisa kartu ----------
export interface LeftoverResult {
  points: number;
  sets: Card[][];
  leftover: Card[];
}

/**
 * Mencari pembagian set terbaik (set valid 3 atau 4 kartu, saling lepas)
 * yang membuat poin kartu sisa sekecil mungkin. Joker bernilai 0.
 */
export function minLeftover(cards: readonly Card[]): LeftoverResult {
  const n = cards.length;
  const info = analyze(cards);
  const byLow: number[][] = Array.from({ length: n }, () => []);
  for (const m of info.keys()) byLow[31 - Math.clz32(m & -m)].push(m);

  const memo = new Map<number, { cost: number; pick: number }>();
  const go = (rem: number): number => {
    if (rem === 0) return 0;
    const cached = memo.get(rem);
    if (cached) return cached.cost;
    const low = 31 - Math.clz32(rem & -rem);
    let bestCost = cardValue(cards[low]) + go(rem & ~(1 << low));
    let pick = 0;
    for (const m of byLow[low]) {
      if ((m & rem) !== m) continue;
      const c = go(rem & ~m);
      if (c < bestCost) {
        bestCost = c;
        pick = m;
      }
    }
    memo.set(rem, { cost: bestCost, pick });
    return bestCost;
  };

  let rem = (1 << n) - 1;
  const points = go(rem);
  const sets: Card[][] = [];
  const leftover: Card[] = [];
  while (rem) {
    const low = 31 - Math.clz32(rem & -rem);
    const { pick } = memo.get(rem)!;
    if (pick === 0) {
      leftover.push(cards[low]);
      rem &= ~(1 << low);
    } else {
      sets.push(info.get(pick)!.cards);
      rem &= ~pick;
    }
  }
  return { points, sets, leftover };
}

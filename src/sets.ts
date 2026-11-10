import type { Card, NaturalCard } from './types';

const naturals = (cards: readonly Card[]): NaturalCard[] =>
  cards.filter((c): c is NaturalCard => !c.joker);

const validSize = (n: number) => n === 3 || n === 4;

/**
 * Seri: satu tipe, berurutan. A boleh di bawah 2 (A-2-3) atau di atas K (Q-K-A).
 * Tidak boleh memutar (K-A-2). Joker menggantikan kartu apa saja.
 */
export function isSeries(cards: readonly Card[]): boolean {
  const n = cards.length;
  if (!validSize(n)) return false;
  const nat = naturals(cards);
  if (nat.length === 0) return true;
  if (!nat.every((c) => c.suit === nat[0].suit)) return false;

  // Posisi 1..14, dengan A = 1 atau 14.
  const options = nat.map((c) => (c.rank === 1 ? [1, 14] : [c.rank as number]));
  for (let start = 1; start + n - 1 <= 14; start++) {
    const end = start + n - 1;
    const assign = (i: number, used: Set<number>): boolean => {
      if (i === options.length) return true;
      for (const pos of options[i]) {
        if (pos < start || pos > end || used.has(pos)) continue;
        used.add(pos);
        if (assign(i + 1, used)) return true;
        used.delete(pos);
      }
      return false;
    };
    if (assign(0, new Set())) return true;
  }
  return false;
}

/** Kembar: angka atau gambar yang sama, tipe bebas. Joker menggantikan kartu apa saja. */
export function isGroup(cards: readonly Card[]): boolean {
  if (!validSize(cards.length)) return false;
  const nat = naturals(cards);
  return nat.every((c) => c.rank === nat[0].rank);
}

/** Set 4 As (pengganti seri). Joker boleh dipakai. */
export function isFourAces(cards: readonly Card[]): boolean {
  return cards.length === 4 && naturals(cards).every((c) => c.rank === 1);
}

export const isValidSet = (cards: readonly Card[]): boolean => isSeries(cards) || isGroup(cards);

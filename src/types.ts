export type Suit = 'S' | 'H' | 'D' | 'C'; // spade, heart, diamond, club
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // 1 = A, 11 = J, 12 = Q, 13 = K

export interface NaturalCard {
  id: string;
  joker: false;
  suit: Suit;
  rank: Rank;
}
export interface JokerCard {
  id: string;
  joker: true;
}
export type Card = NaturalCard | JokerCard;

export interface RuleToggles {
  bento: boolean;
  nyemplung: boolean;
  minLim: boolean;
  minTig: boolean;
  /** Beli ke-2 dan ke-3 (beli ke-1 selalu wajib). */
  optionalBuy: boolean;
}

export interface RoomConfig {
  maxPlayers: number;
  startingChips: number;
  /** Total poin >= nilai ini berarti mati (76 ke atas). */
  deadThreshold: number;
  rules: RuleToggles;
  /** Biaya pembelian ke-1, ke-2, ke-3. */
  buyCosts: number[];
  reconnectSeconds: number;
  topUpSeconds: number;
  /** Top up hanya dalam kelipatan angka ini. */
  topUpStep: number;
  /** Chip yang ditaruh tiap pemain di tengah setiap awal ronde. */
  anteChips: number;
  /** Poin pemenang ronde (tanpa MinLim/MinTig). */
  winnerPoints: number;
  /** Chip yang dibayar tiap pemain kalah ke pemenang untuk MinTig dan MinLim. */
  bonusChips: { minTig: number; minLim: number };
}

export const DEFAULT_CONFIG: RoomConfig = {
  maxPlayers: 7,
  startingChips: 20,
  deadThreshold: 76,
  rules: { bento: true, nyemplung: true, minLim: true, minTig: true, optionalBuy: true },
  buyCosts: [1, 2, 3],
  reconnectSeconds: 180,
  topUpSeconds: 180,
  topUpStep: 10,
  anteChips: 1,
  winnerPoints: -10,
  bonusChips: { minTig: 1, minLim: 2 },
};

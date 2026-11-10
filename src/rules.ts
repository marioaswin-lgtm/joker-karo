import { checkWin, minLeftover, type WinOptions, type WinResult } from './hand';
import { DEFAULT_CONFIG, type Card, type RoomConfig } from './types';

// ---------- Transfer chip ----------
export interface Transfer {
  from: string;
  to: string;
  chips: number;
}

/** Perubahan chip bersih per pemain dari daftar transfer. */
export function netChanges(transfers: readonly Transfer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of transfers) {
    out[t.from] = (out[t.from] ?? 0) - t.chips;
    out[t.to] = (out[t.to] ?? 0) + t.chips;
  }
  return out;
}

/**
 * Bento: A spade yang didapat dari PEMBAGIAN AWAL (bukan hasil mengambil).
 * Pemilik mendapat 1 chip dari tiap pemain lain; Double Bento (2 A spade) = 2 chip per pemain.
 * Harus dipanggil dengan tangan hasil pembagian awal.
 */
export function bentoTransfers(initialHands: Record<string, readonly Card[]>, enabled = true): Transfer[] {
  if (!enabled) return [];
  const ids = Object.keys(initialHands);
  const out: Transfer[] = [];
  for (const holder of ids) {
    const count = initialHands[holder].filter((c) => !c.joker && c.suit === 'S' && c.rank === 1).length;
    if (count === 0) continue;
    for (const other of ids) {
      if (other !== holder) out.push({ from: other, to: holder, chips: count });
    }
  }
  return out;
}

/**
 * Nyemplung: pembuang kartu membayar 1 chip ke pemenang ronde, hanya bila pemenang
 * mengambil kartu buangan tersebut untuk masuk.
 */
export function nyemplungTransfer(args: {
  winnerId: string;
  drewFromDiscard: boolean;
  discarderId?: string;
  enabled?: boolean;
}): Transfer | null {
  const { winnerId, drewFromDiscard, discarderId, enabled = true } = args;
  if (!enabled || !drewFromDiscard || !discarderId || discarderId === winnerId) return null;
  return { from: discarderId, to: winnerId, chips: 1 };
}

// ---------- Poin ronde ----------
/**
 * Poin ronde: pemenang mendapat `winnerRoundScore` (0, -50, atau -30); pemain lain
 * (termasuk yang disconnect) mendapat poin kartu sisa dengan pembagian set otomatis terbaik.
 */
export function scoreRound(
  hands: Record<string, readonly Card[]>,
  winnerId: string,
  winnerRoundScore: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, cards] of Object.entries(hands)) {
    out[id] = id === winnerId ? winnerRoundScore : minLeftover(cards).points;
  }
  return out;
}

// ---------- Mati, beli, reset ----------
export interface BabakPlayer {
  id: string;
  score: number;
  /** Jumlah pembelian yang sudah dilakukan di babak ini (0 sampai 3). */
  buys: number;
  chips: number;
  eliminated: boolean;
}

export type BuyDecision = 'buy' | 'decline';

export interface BuyOutcome {
  id: string;
  status: 'bought' | 'needs_topup' | 'eliminated';
  cost?: number;
  newScore?: number;
  shortfall?: number;
}

export interface DeathResolution {
  players: BabakPlayer[];
  pot: number;
  resetScore: number;
  outcomes: BuyOutcome[];
  /** Tidak ada kesempatan beli (tersisa 2 pemain atau BOM). */
  noBuy: boolean;
  /** BOM: 3+ pemain hidup, dan semua pemain selain pemenang ronde mati. */
  bom: boolean;
}

/**
 * Pemain dengan poin >= deadThreshold (76) mati.
 * - Beli ke-1 wajib (1 chip), ke-2 (2 chip) dan ke-3 (3 chip) pilihan.
 * - Menolak beli, atau sudah 3 kali beli, berarti tereliminasi dari babak.
 * - Poin pembeli direset ke nilai tertinggi di antara pemain yang selamat (75 ke bawah).
 * - Chip tidak cukup -> status needs_topup (pemain top up, atau tereliminasi bila lewat batas waktu).
 * Chip beli masuk ke pot.
 * - Tersisa 2 pemain (atau hanya 2 pemain sejak awal): TIDAK ada kesempatan beli, yang mati langsung tereliminasi.
 * - BOM: pemenang ronde masuk saat semua pemain lain mati: tidak ada kesempatan beli,
 *   babak berakhir untuk pemenang (lalu babak baru).
 */
export function resolveDeaths(
  players: readonly BabakPlayer[],
  pot: number,
  decisions: Record<string, BuyDecision> = {},
  cfg: RoomConfig = DEFAULT_CONFIG,
): DeathResolution {
  const survivors = players.filter((p) => !p.eliminated && p.score < cfg.deadThreshold);
  if (survivors.length === 0) throw new Error('Invarian dilanggar: tidak ada pemain yang selamat');
  const resetScore = Math.max(...survivors.map((p) => p.score));
  const aliveCount = players.filter((p) => !p.eliminated).length;
  const noBuy = aliveCount <= 2 || survivors.length === 1;
  const bom = aliveCount >= 3 && survivors.length === 1;

  let potNow = pot;
  const outcomes: BuyOutcome[] = [];
  const updated = players.map((p): BabakPlayer => {
    if (p.eliminated || p.score < cfg.deadThreshold) return p;
    if (noBuy || p.buys >= cfg.buyCosts.length) {
      outcomes.push({ id: p.id, status: 'eliminated' });
      return { ...p, eliminated: true };
    }
    const mandatory = p.buys === 0;
    const wantsToBuy = mandatory || (cfg.rules.optionalBuy && decisions[p.id] === 'buy');
    if (!wantsToBuy) {
      outcomes.push({ id: p.id, status: 'eliminated' });
      return { ...p, eliminated: true };
    }
    const cost = cfg.buyCosts[p.buys];
    if (p.chips < cost) {
      outcomes.push({ id: p.id, status: 'needs_topup', cost, shortfall: cost - p.chips });
      return p;
    }
    potNow += cost;
    outcomes.push({ id: p.id, status: 'bought', cost, newScore: resetScore });
    return { ...p, chips: p.chips - cost, buys: p.buys + 1, score: resetScore };
  });
  return { players: updated, pot: potNow, resetScore, outcomes, noBuy, bom };
}

/** Top up hanya dalam kelipatan 10 chip (10, 20, 30, ...). */
export function validateTopUp(amount: number, cfg: RoomConfig = DEFAULT_CONFIG): void {
  if (!Number.isInteger(amount) || amount <= 0 || amount % cfg.topUpStep !== 0) {
    throw new Error(`Top up harus kelipatan ${cfg.topUpStep} chip`);
  }
}

export function applyTopUp(player: BabakPlayer, amount: number, cfg: RoomConfig = DEFAULT_CONFIG): BabakPlayer {
  validateTopUp(amount, cfg);
  return { ...player, chips: player.chips + amount };
}

/** Pemain yang tidak top up dalam batas waktu dianggap tidak beli dan tereliminasi. */
export function eliminatePlayers(players: readonly BabakPlayer[], ids: readonly string[]): BabakPlayer[] {
  return players.map((p) => (ids.includes(p.id) ? { ...p, eliminated: true } : p));
}

/** Pemenang babak: pemain terakhir yang bertahan. null bila masih ada lebih dari satu. */
export function babakWinner(players: readonly BabakPlayer[]): string | null {
  const active = players.filter((p) => !p.eliminated);
  return active.length === 1 ? active[0].id : null;
}

/** Pemenang babak menerima seluruh pot. Chip dibawa ke babak berikutnya. */
export function awardPot(players: readonly BabakPlayer[], pot: number) {
  const winnerId = babakWinner(players);
  if (!winnerId) throw new Error('Babak belum selesai');
  return {
    winnerId,
    players: players.map((p) => (p.id === winnerId ? { ...p, chips: p.chips + pot } : p)),
  };
}

// ---------- Disconnect dan pergantian pemain ----------
export type PresenceStatus = 'connected' | 'waiting' | 'expired' | 'left';
export type TurnAction = 'play' | 'wait' | 'skip';

/** Pelacak koneksi dengan jam yang bisa disuntik (ms), jendela reconnect default 3 menit. */
export class PresenceTracker {
  private disconnectedAt = new Map<string, number>();
  private left = new Set<string>();

  constructor(private readonly windowMs = DEFAULT_CONFIG.reconnectSeconds * 1000) {}

  disconnect(id: string, nowMs: number): void {
    if (!this.left.has(id) && !this.disconnectedAt.has(id)) this.disconnectedAt.set(id, nowMs);
  }

  /** Keluar sukarela: tidak bisa kembali di babak yang sama. */
  leave(id: string): void {
    this.left.add(id);
    this.disconnectedAt.delete(id);
  }

  status(id: string, nowMs: number): PresenceStatus {
    if (this.left.has(id)) return 'left';
    const at = this.disconnectedAt.get(id);
    if (at === undefined) return 'connected';
    return nowMs - at < this.windowMs ? 'waiting' : 'expired';
  }

  /** true bila berhasil kembali (dalam jendela waktu). */
  reconnect(id: string, nowMs: number): boolean {
    const s = this.status(id, nowMs);
    if (s === 'left' || s === 'expired') return false;
    this.disconnectedAt.delete(id);
    return true;
  }

  /** Giliran pemain terputus: ditunggu sampai batas, lalu dilewati. */
  turnAction(id: string, nowMs: number): TurnAction {
    const s = this.status(id, nowMs);
    return s === 'connected' ? 'play' : s === 'waiting' ? 'wait' : 'skip';
  }
}

export type Phase = 'between_babak' | 'between_round' | 'in_round';

/** Pergantian pemain hanya dibolehkan saat pergantian babak. */
export const canReplacePlayer = (phase: Phase): boolean => phase === 'between_babak';

// ---------- Chip di tengah (ante), poin pemenang, dan Ceki ----------
export const CENTER = '__center__';

/** Awal ronde: tiap pemain hidup menaruh `anteChips` (default 1) chip di tengah. */
export function anteTransfers(aliveIds: readonly string[], cfg: RoomConfig = DEFAULT_CONFIG): Transfer[] {
  return aliveIds.map((id) => ({ from: id, to: CENTER, chips: cfg.anteChips }));
}

/**
 * Poin pemenang ronde: -10 untuk kemenangan biasa; MinTig -30 dan MinLim -50 tetap
 * (nilai dari checkWin, sudah memperhitungkan toggle).
 */
export function winnerRoundPoints(win: Pick<WinResult, 'roundScore'>, cfg: RoomConfig = DEFAULT_CONFIG): number {
  return win.roundScore === 0 ? cfg.winnerPoints : win.roundScore;
}

/**
 * Chip akhir ronde: pemenang mengambil seluruh chip di tengah. MinTig: tiap pemain kalah
 * membayar 1 chip ke pemenang; MinLim: 2 chip. (MinLim didahulukan bila keduanya terpenuhi.)
 */
export function roundWinnerTransfers(args: {
  winnerId: string;
  aliveIds: readonly string[];
  win: Pick<WinResult, 'minLim' | 'minTig'>;
  centerChips: number;
  cfg?: RoomConfig;
}): Transfer[] {
  const { winnerId, aliveIds, win, centerChips, cfg = DEFAULT_CONFIG } = args;
  const out: Transfer[] = [];
  if (centerChips > 0) out.push({ from: CENTER, to: winnerId, chips: centerChips });
  const per = win.minLim ? cfg.bonusChips.minLim : win.minTig ? cfg.bonusChips.minTig : 0;
  if (per > 0) for (const id of aliveIds) if (id !== winnerId) out.push({ from: id, to: winnerId, chips: per });
  return out;
}

export type DeclareResult =
  | { ok: true; win: WinResult }
  | { ok: false; reason: 'ceki_required' | 'ceki_same_turn' | 'not_winning' };

/**
 * Masuk/Tutup hanya boleh bila (1) tangan benar-benar menang dan (2) pemain sudah
 * menekan Ceki di GILIRAN SEBELUMNYA (cekiTurn < currentTurn). Ceki di giliran yang sama
 * tidak cukup. Akibatnya pemain pertama tidak bisa langsung masuk di giliran pertama.
 * Ceki bersifat manual (kejujurannya tidak diverifikasi). `cekiTurn` = nomor giliran saat
 * Ceki ditekan, atau null bila belum.
 */
export function tryDeclare(
  cards: readonly Card[],
  cekiTurn: number | null,
  currentTurn: number,
  opts?: WinOptions,
): DeclareResult {
  const win = checkWin(cards, opts);
  if (!win) return { ok: false, reason: 'not_winning' };
  if (cekiTurn === null) return { ok: false, reason: 'ceki_required' };
  if (cekiTurn >= currentTurn) return { ok: false, reason: 'ceki_same_turn' };
  return { ok: true, win };
}

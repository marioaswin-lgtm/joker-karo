import {
  CENTER, DEFAULT_CONFIG, PresenceTracker, anteTransfers, applyTopUp, awardPot, babakWinner, bentoTransfers,
  createDeck, dealRound, eliminatePlayers, nyemplungTransfer, recycleAtRoundEnd, refillDrawPile, resolveDeaths,
  resolveSeatOrder, roundWinnerTransfers, scoreRound, secureRng, shuffle, tryDeclare, winnerRoundPoints,
  type BabakPlayer, type BuyDecision, type Card, type Rng, type RoomConfig, type Transfer, type WinResult,
} from '../src';

export type Phase = 'lobby' | 'draw' | 'discard' | 'buy' | 'topup' | 'between_rounds' | 'over';

export interface Player {
  id: string;
  name: string;
  score: number;
  chips: number;
  buys: number;
  out: boolean;
  hand: Card[];
  /** Nomor giliran saat Ceki ditekan, atau null. */
  cekiTurn: number | null;
  connected: boolean;
}

export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

const CEKI_MSG = {
  not_winning: 'Kartu Anda belum membentuk 3 set (3, 3, 4)',
  ceki_required: 'Anda harus menekan Ceki! di giliran sebelumnya',
  ceki_same_turn: 'Ceki baru ditekan di giliran ini. Masuk/Tutup baru bisa di giliran berikutnya',
} as const;

/** Mesin satu room: server-authoritative, memakai rule engine di ../src. */
export class Game {
  players: Player[] = [];
  hostId = '';
  phase: Phase = 'lobby';
  deck: Card[] = [];
  discard: Card[] = [];
  center = 0;
  pot = 0;
  babak = 1;
  round = 0;
  turn = 0;
  cur = 0;
  drewDiscard = false;
  lastDiscarder: string | null = null;
  lastWinner: string | null = null;
  decisions: Record<string, BuyDecision> = {};
  pendingIds: string[] = [];
  deadline = 0;
  summary: { winnerId: string; points: Record<string, number>; tag: string } | null = null;
  messages: string[] = [];
  presence: PresenceTracker;

  constructor(public cfg: RoomConfig = DEFAULT_CONFIG, private rng: Rng = secureRng) {
    this.presence = new PresenceTracker(cfg.reconnectSeconds * 1000);
  }

  private say(m: string) {
    this.messages.unshift(m);
    this.messages = this.messages.slice(0, 20);
  }
  private find = (id: string) => this.players.find((p) => p.id === id);
  private apply(ts: Transfer[]) {
    for (const t of ts) {
      if (t.from === CENTER) this.center -= t.chips;
      else this.find(t.from)!.chips -= t.chips;
      if (t.to === CENTER) this.center += t.chips;
      else this.find(t.to)!.chips += t.chips;
    }
  }
  private nextAlive(from: number) {
    let k = from;
    do k = (k + 1) % this.players.length;
    while (this.players[k].out);
    return k;
  }
  private get opts() {
    return { minLim: this.cfg.rules.minLim, minTig: this.cfg.rules.minTig };
  }

  // ---------- Lobby ----------
  addPlayer(id: string, name: string): Result {
    if (this.phase !== 'lobby') return fail('Permainan sudah dimulai');
    if (this.players.length >= this.cfg.maxPlayers) return fail('Room penuh (maksimum 7 pemain)');
    this.players.push({ id, name: name.trim().slice(0, 16) || 'Pemain', score: 0, chips: this.cfg.startingChips, buys: 0, out: false, hand: [], cekiTurn: null, connected: true });
    if (!this.hostId) this.hostId = id;
    return OK;
  }

  setConnected(id: string, connected: boolean, now = Date.now()) {
    const p = this.find(id);
    if (!p) return;
    p.connected = connected;
    if (!connected) this.presence.disconnect(id, now);
    else this.presence.reconnect(id, now);
  }

  start(by: string, now = Date.now()): Result {
    if (by !== this.hostId) return fail('Hanya host yang bisa memulai');
    if (this.phase !== 'lobby') return fail('Sudah dimulai');
    if (this.players.length < 2) return fail('Minimal 2 pemain');
    this.beginBabak(now);
    return OK;
  }

  /** Awal babak: undian tempat duduk, shuffle 108 kartu, lalu ronde pertama. */
  private beginBabak(now: number) {
    this.round = 0;
    this.pot = 0;
    this.center = 0;
    this.summary = null;
    this.discard = [];
    // Undian tempat duduk: kartu tertinggi jadi pemain pertama.
    const pile = shuffle(createDeck(), this.rng);
    let k = 0;
    const take = () => pile[k++];
    const draws = Object.fromEntries(this.players.map((p) => [p.id, take()]));
    const order = resolveSeatOrder(draws, (ids) => Object.fromEntries(ids.map((id) => [id, take()])));
    this.players = order.map((id) => this.find(id)!);
    this.say(`Babak ${this.babak}. Undian tempat duduk: ${this.players.map((p) => p.name).join(' > ')}`);
    this.deck = shuffle(createDeck(), this.rng);
    this.startRound(this.players[0].id, now);
  }

  private startRound(firstId: string, now: number) {
    const alive = this.players.filter((p) => !p.out);
    const s = alive.findIndex((p) => p.id === firstId);
    const order = [...alive.slice(s), ...alive.slice(0, s)];
    this.round++;
    this.turn = 0;
    this.drewDiscard = false;
    this.lastDiscarder = null;
    this.summary = null;
    this.decisions = {};
    this.presence = new PresenceTracker(this.cfg.reconnectSeconds * 1000);
    for (const p of this.players) {
      p.hand = [];
      p.cekiTurn = null;
      if (!p.connected) this.presence.disconnect(p.id, now);
    }
    this.apply(anteTransfers(order.map((p) => p.id), this.cfg));
    const d = dealRound(this.deck, order.map((p) => p.id));
    this.deck = d.drawPile;
    for (const p of order) p.hand = d.hands[p.id];
    const bento = bentoTransfers(d.hands, this.cfg.rules.bento);
    this.apply(bento);
    for (const t of bento) if (!this.messages[0]?.includes(this.find(t.to)!.name + ' Bento')) this.say(`${this.find(t.to)!.name} Bento: +${t.chips} chip dari tiap pemain`);
    this.cur = this.players.indexOf(order[0]);
    this.phase = 'discard';
    this.say(`Ronde ${this.round} dimulai. Tiap pemain menaruh ${this.cfg.anteChips} chip di tengah. ${order[0].name} jalan pertama.`);
  }

  // ---------- Aksi pemain ----------
  act(id: string, msg: { type: string; [k: string]: unknown }, now = Date.now()): Result {
    const me = this.find(id);
    if (!me) return fail('Pemain tidak dikenal');
    const myTurn = (this.phase === 'draw' || this.phase === 'discard') && this.players[this.cur].id === id;
    switch (msg.type) {
      case 'start':
        return this.start(id, now);
      case 'draw_deck': {
        if (!myTurn || this.phase !== 'draw') return fail('Bukan giliran Anda mengambil kartu');
        if (!this.deck.length) {
          const r = refillDrawPile([], this.discard, this.rng);
          this.deck = r.drawPile;
          this.discard = r.discardPile;
        }
        me.hand.push(this.deck.shift()!);
        this.phase = 'discard';
        this.drewDiscard = false;
        return OK;
      }
      case 'draw_discard': {
        if (!myTurn || this.phase !== 'draw') return fail('Bukan giliran Anda mengambil kartu');
        if (!this.discard.length) return fail('Tumpukan buangan kosong');
        me.hand.push(this.discard.pop()!);
        this.phase = 'discard';
        this.drewDiscard = true;
        return OK;
      }
      case 'discard': {
        if (!myTurn || this.phase !== 'discard') return fail('Bukan giliran Anda membuang kartu');
        const i = me.hand.findIndex((c) => c.id === msg.cardId);
        if (i < 0) return fail('Kartu tidak ada di tangan Anda');
        this.endTurn(me, me.hand.splice(i, 1)[0]);
        return OK;
      }
      case 'ceki': {
        if (!myTurn) return fail('Ceki hanya bisa ditekan di giliran Anda');
        me.cekiTurn = me.cekiTurn === null ? this.turn : null;
        this.say(me.cekiTurn !== null ? `${me.name}: CEKI! Satu kartu lagi menang.` : `${me.name} membatalkan ceki`);
        return OK;
      }
      case 'declare': {
        if (!myTurn) return fail('Bukan giliran Anda');
        const r = tryDeclare(me.hand, me.cekiTurn, this.turn, this.opts);
        if (!r.ok) return fail(CEKI_MSG[r.reason]);
        this.endRound(me, r.win, now);
        return OK;
      }
      case 'buy':
      case 'decline': {
        if (this.phase !== 'buy' || !this.pendingIds.includes(id)) return fail('Tidak ada keputusan beli untuk Anda');
        this.decisions[id] = msg.type;
        this.pendingIds = this.pendingIds.filter((x) => x !== id);
        if (!this.pendingIds.length) this.finalizeDeaths(now);
        return OK;
      }
      case 'topup': {
        if (id !== this.hostId) return fail('Top up dikelola host');
        const target = this.find(String(msg.playerId));
        if (!target) return fail('Pemain tidak ditemukan');
        try {
          target.chips = applyTopUp(this.toBP(target), Number(msg.amount), this.cfg).chips;
        } catch (e) {
          return fail((e as Error).message);
        }
        this.say(`Host top up ${msg.amount} chip untuk ${target.name}`);
        if (this.phase === 'topup') this.finalizeDeaths(now);
        return OK;
      }
      case 'next_round': {
        if (id !== this.hostId) return fail('Hanya host yang bisa lanjut');
        if (this.phase !== 'between_rounds') return fail('Ronde belum selesai');
        this.startRound(this.lastWinner!, now);
        return OK;
      }
      case 'next_babak': {
        if (id !== this.hostId) return fail('Hanya host yang bisa memulai babak baru');
        if (this.phase !== 'over') return fail('Babak belum selesai');
        for (const p of this.players) Object.assign(p, { score: 0, buys: 0, out: false, hand: [], cekiTurn: null });
        this.babak++;
        this.beginBabak(now);
        return OK;
      }
      default:
        return fail('Aksi tidak dikenal');
    }
  }

  private endTurn(p: Player, card: Card) {
    this.discard.push(card);
    this.lastDiscarder = p.id;
    this.turn++;
    this.cur = this.nextAlive(this.cur);
    this.phase = 'draw';
    this.drewDiscard = false;
  }

  // ---------- Akhir ronde ----------
  private endRound(winner: Player, win: WinResult, now: number) {
    const alive = this.players.filter((p) => !p.out);
    const aliveIds = alive.map((p) => p.id);
    const points = scoreRound(Object.fromEntries(alive.map((p) => [p.id, p.hand])), winner.id, winnerRoundPoints(win, this.cfg));
    for (const p of alive) p.score += points[p.id];
    const tag = win.minLim ? 'MinLim' : win.minTig ? 'MinTig' : '';
    const ny = nyemplungTransfer({ winnerId: winner.id, drewFromDiscard: this.drewDiscard, discarderId: this.lastDiscarder ?? undefined, enabled: this.cfg.rules.nyemplung });
    if (ny) {
      this.apply([ny]);
      this.say(`Nyemplung! ${this.find(ny.from)!.name} bayar ${ny.chips} chip ke ${winner.name}`);
    }
    this.apply(roundWinnerTransfers({ winnerId: winner.id, aliveIds, win, centerChips: this.center, cfg: this.cfg }));
    this.lastWinner = winner.id;
    this.summary = { winnerId: winner.id, points, tag };
    this.say(`${winner.name} MASUK${tag ? ` (${tag})` : ''}. Poin: ${alive.map((p) => `${p.name} ${points[p.id]}`).join(', ')}`);
    this.finalizeDeaths(now);
  }

  private toBP = (p: Player): BabakPlayer => ({ id: p.id, score: p.score, buys: p.buys, chips: p.chips, eliminated: p.out });

  /** Mati, beli, reset, top up, lalu pemenang babak atau ronde berikutnya. */
  private finalizeDeaths(now: number) {
    const dead = this.players.filter((p) => !p.out && p.score >= this.cfg.deadThreshold);
    const aliveCount = this.players.filter((p) => !p.out).length;
    const survivorCount = aliveCount - dead.length;
    // Tersisa 2 pemain, atau BOM (hanya pemenang ronde yang selamat): tidak ada kesempatan beli.
    const noBuy = aliveCount <= 2 || survivorCount === 1;
    if (this.phase !== 'topup' && !noBuy) {
      const need = dead
        .filter((p) => this.cfg.rules.optionalBuy && p.buys >= 1 && p.buys < this.cfg.buyCosts.length && this.decisions[p.id] === undefined)
        .map((p) => p.id);
      if (need.length) {
        this.phase = 'buy';
        this.pendingIds = need;
        this.deadline = now + this.cfg.topUpSeconds * 1000;
        this.say(`Mati: ${need.map((i) => this.find(i)!.name).join(', ')}. Pilih beli atau tolak.`);
        return;
      }
    }
    const res = resolveDeaths(this.players.map(this.toBP), this.pot, this.decisions, this.cfg);
    for (const bp of res.players) {
      const p = this.find(bp.id)!;
      Object.assign(p, { score: bp.score, buys: bp.buys, chips: bp.chips, out: bp.eliminated });
    }
    this.pot = res.pot;
    if (res.bom) {
      this.say('BOM! Semua pemain lain mati. Tidak ada kesempatan beli.');
      if (this.summary) this.summary.tag = this.summary.tag ? `${this.summary.tag}, BOM` : 'BOM';
    } else if (res.noBuy && dead.length) this.say('Tersisa 2 pemain: tidak ada kesempatan beli.');
    for (const o of res.outcomes) {
      const n = this.find(o.id)!.name;
      if (o.status === 'bought') this.say(`${n} mati, beli ke-${this.find(o.id)!.buys} (${o.cost} chip), poin jadi ${o.newScore}`);
      else if (o.status === 'eliminated') this.say(`${n} mati dan tereliminasi`);
    }
    const short = res.outcomes.filter((o) => o.status === 'needs_topup');
    if (short.length) {
      this.phase = 'topup';
      this.pendingIds = short.map((o) => o.id);
      this.deadline = now + this.cfg.topUpSeconds * 1000;
      this.say(`Menunggu top up (host): ${short.map((o) => `${this.find(o.id)!.name} butuh ${o.shortfall} chip`).join(', ')}`);
      return;
    }
    this.pendingIds = [];
    const bps = this.players.map(this.toBP);
    if (babakWinner(bps)) {
      const a = awardPot(bps, this.pot);
      this.find(a.winnerId)!.chips += this.pot;
      this.say(`${this.find(a.winnerId)!.name} menang babak dan mendapat pot ${this.pot} chip`);
      this.pot = 0;
      this.phase = 'over';
      return;
    }
    this.deck = recycleAtRoundEnd(this.deck, this.discard, Object.fromEntries(this.players.map((p) => [p.id, p.hand])), this.rng);
    this.discard = [];
    for (const p of this.players) p.hand = [];
    this.phase = 'between_rounds';
  }

  // ---------- Waktu (dipanggil tiap detik) ----------
  tick(now = Date.now()): boolean {
    if (this.phase === 'buy' && now >= this.deadline) {
      for (const id of this.pendingIds) this.decisions[id] = 'decline';
      this.pendingIds = [];
      this.finalizeDeaths(now);
      return true;
    }
    if (this.phase === 'topup' && now >= this.deadline) {
      const ids = this.pendingIds;
      for (const bp of eliminatePlayers(this.players.map(this.toBP), ids)) this.find(bp.id)!.out = bp.eliminated;
      this.say('Batas waktu top up habis: pemain tereliminasi');
      this.pendingIds = [];
      this.finalizeDeaths(now);
      return true;
    }
    if (this.phase === 'draw' || this.phase === 'discard') {
      const p = this.players[this.cur];
      if (this.presence.turnAction(p.id, now) === 'skip') {
        this.say(`${p.name} terputus lebih dari ${this.cfg.reconnectSeconds / 60} menit: giliran dilewati`);
        if (this.phase === 'discard') this.endTurn(p, p.hand.pop()!);
        else {
          this.turn++;
          this.cur = this.nextAlive(this.cur);
        }
        return true;
      }
    }
    return false;
  }

  // ---------- Tampilan per pemain (kartu lawan disembunyikan) ----------
  view(id: string) {
    const me = this.find(id);
    const playing = this.phase === 'draw' || this.phase === 'discard';
    const cur = this.players[this.cur];
    return {
      phase: this.phase,
      hostId: this.hostId,
      myId: id,
      babak: this.babak,
      round: this.round,
      turn: this.turn,
      currentId: playing && cur ? cur.id : null,
      deckCount: this.deck.length,
      discard: this.discard,
      center: this.center,
      pot: this.pot,
      hand: me?.hand ?? [],
      canDeclare: !!me && playing && cur.id === id && tryDeclare(me.hand, me.cekiTurn, this.turn, this.opts).ok,
      pending: this.pendingIds,
      deadline: this.deadline,
      buyCosts: this.cfg.buyCosts,
      summary: this.summary,
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score, chips: p.chips, buys: p.buys, out: p.out, connected: p.connected, handCount: p.hand.length, ceki: p.cekiTurn !== null })),
      log: this.messages,
    };
  }
}

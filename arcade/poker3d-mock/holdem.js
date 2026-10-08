/* Texas Hold'em, the rules (2026-10-07 mockup). Import-free and deterministic given a deck, so the same file can run on the room server
   later (the server deals; a page only ever renders) and be tested on its own. No money here: chips are numbers.

   new Game(players, { blinds, handsPerLevel }) -> startHand(deck) -> legal(i) / act(i, {type, to}) until hand.over -> startHand(...) ...
   Every change is pushed to game.log as { t, ... } so a page can animate it. */

export const RANKS = "23456789TJQKA", SUITS = "shdc";
export const rankOf = (c) => RANKS.indexOf(c[0]), suitOf = (c) => c[1];
export function makeDeck() { const d = []; for (const r of RANKS) for (const s of SUITS) d.push(r + s); return d; }
export function shuffle(deck, rnd = Math.random) { const d = deck.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }

/* ---- hand values: [category, tiebreakers...], compared left to right. 8 straight flush ... 0 high card */
export const HAND_NAMES = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
function straightHigh(ranks) {   // ranks: a set of rank indexes; returns the straight's high card or -1 (the wheel A-5 counts, high 3)
  for (let hi = 12; hi >= 4; hi--) { let ok = true; for (let k = 0; k < 5; k++) if (!ranks.has(hi - k)) { ok = false; break; } if (ok) return hi; }
  if (ranks.has(12) && ranks.has(0) && ranks.has(1) && ranks.has(2) && ranks.has(3)) return 3;
  return -1;
}
export function evaluate(cards) {
  const rs = cards.map(rankOf), counts = new Map();
  for (const r of rs) counts.set(r, (counts.get(r) || 0) + 1);
  const bySuit = {}; for (const c of cards) (bySuit[suitOf(c)] ||= []).push(rankOf(c));
  const flushSuit = Object.keys(bySuit).find((s) => bySuit[s].length >= 5);
  if (flushSuit) { const sh = straightHigh(new Set(bySuit[flushSuit])); if (sh >= 0) return [8, sh]; }
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);   // [rank, count], biggest group first
  const kick = (skip, n) => [...new Set(rs)].filter((r) => !skip.includes(r)).sort((a, b) => b - a).slice(0, n);
  if (groups[0][1] === 4) return [7, groups[0][0], ...kick([groups[0][0]], 1)];
  if (groups[0][1] === 3 && groups.length > 1 && groups[1][1] >= 2) {
    const trips = groups.filter((g) => g[1] === 3).map((g) => g[0]).sort((a, b) => b - a);
    const pair = Math.max(...groups.filter((g) => g[1] >= 2 && g[0] !== trips[0]).map((g) => g[0]));
    return [6, trips[0], pair];
  }
  if (flushSuit) return [5, ...bySuit[flushSuit].sort((a, b) => b - a).slice(0, 5)];
  const sh = straightHigh(new Set(rs)); if (sh >= 0) return [4, sh];
  if (groups[0][1] === 3) return [3, groups[0][0], ...kick([groups[0][0]], 2)];
  const pairs = groups.filter((g) => g[1] === 2).map((g) => g[0]).sort((a, b) => b - a);
  if (pairs.length >= 2) return [2, pairs[0], pairs[1], ...kick([pairs[0], pairs[1]], 1)];
  if (pairs.length === 1) return [1, pairs[0], ...kick([pairs[0]], 3)];
  return [0, ...kick([], 5)];
}
export function compare(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; } return 0; }

/* ---- the game */
export const LEVELS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000]];
export class Game {
  constructor(players, { handsPerLevel = 6, start = 1500 } = {}) {
    this.p = players.map((x, i) => ({ i, name: x.name, bot: Boolean(x.bot), stack: start, cards: [], bet: 0, put: 0, folded: false, allIn: false, out: false, place: 0 }));
    this.button = Math.floor(Math.random() * players.length) % players.length;
    this.handNo = 0; this.level = 0; this.handsPerLevel = handsPerLevel; this.log = []; this.hand = null; this.finished = false;
  }
  get blinds() { return LEVELS[Math.min(this.level, LEVELS.length - 1)]; }
  alive() { return this.p.filter((x) => !x.out); }
  next(i, ok) { const n = this.p.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (ok(this.p[j])) return j; } return -1; }
  emit(o) { this.log.push(o); }

  startHand(deck) {
    if (this.alive().length < 2) { this.finished = true; return; }
    this.handNo++; if (this.handNo > 1 && (this.handNo - 1) % this.handsPerLevel === 0) { this.level++; this.emit({ t: "level", blinds: this.blinds }); }
    this.button = this.next(this.button, (x) => !x.out);
    for (const x of this.p) Object.assign(x, { cards: [], bet: 0, put: 0, folded: x.out, allIn: false });
    const h = this.hand = { deck: deck.slice(), board: [], street: "preflop", current: 0, minRaise: this.blinds[1], needs: new Set(), actor: -1, over: false, winners: [] };
    const live = this.alive();
    // heads-up the button is the small blind
    const sb = live.length === 2 ? this.button : this.next(this.button, (x) => !x.out), bb = this.next(sb, (x) => !x.out);
    h.sb = sb; h.bb = bb;
    for (let r = 0; r < 2; r++) for (let k = 0, j = sb; k < live.length; k++, j = this.next(j, (x) => !x.out)) this.p[j].cards.push(h.deck.shift());
    this.emit({ t: "deal", button: this.button, sb, bb, hand: this.handNo, blinds: this.blinds });
    this.post(sb, this.blinds[0], "sb"); this.post(bb, this.blinds[1], "bb");
    h.current = Math.max(this.p[sb].bet, this.p[bb].bet);
    for (const x of this.p) if (!x.folded && !x.allIn) h.needs.add(x.i);
    h.actor = this.next(bb, (x) => h.needs.has(x.i));
    if (h.actor < 0 || this.canAct().length < 2 && this.p.every((x) => x.folded || x.allIn || x.bet >= h.current)) this.endStreet();
    else this.emit({ t: "turn", i: h.actor });
  }
  post(i, amt, kind) { const x = this.p[i], a = Math.min(amt, x.stack); x.stack -= a; x.bet += a; x.put += a; if (!x.stack) x.allIn = true; this.emit({ t: "blind", i, amt: a, kind }); }
  canAct() { return this.p.filter((x) => !x.folded && !x.allIn); }
  pot() { return this.p.reduce((s, x) => s + x.put, 0); }

  /* what seat i may do now */
  legal(i) {
    const h = this.hand, x = this.p[i]; if (!h || h.over || h.actor !== i) return null;
    const toCall = Math.min(h.current - x.bet, x.stack), maxTo = x.bet + x.stack;
    const minTo = Math.min(h.current ? h.current + h.minRaise : this.blinds[1], maxTo);
    return { check: toCall === 0, call: toCall, minTo, maxTo, canRaise: maxTo > h.current };
  }
  act(i, a) {
    const h = this.hand, x = this.p[i], L = this.legal(i); if (!L) return false;
    if (a.type === "fold") { x.folded = true; this.emit({ t: "fold", i }); }
    else if (a.type === "check") { if (!L.check) return false; this.emit({ t: "check", i }); }
    else if (a.type === "call") { const c = L.call; x.stack -= c; x.bet += c; x.put += c; if (!x.stack) x.allIn = true; this.emit({ t: "call", i, amt: c, allIn: x.allIn }); }
    else if (a.type === "raise") {
      let to = Math.round(Math.max(L.minTo, Math.min(L.maxTo, Number(a.to) || 0))); if (!L.canRaise) return false;
      const add = to - x.bet, size = to - h.current;
      x.stack -= add; x.bet = to; x.put += add; if (!x.stack) x.allIn = true;
      if (size >= h.minRaise) { h.minRaise = size; for (const y of this.p) if (y.i !== i && !y.folded && !y.allIn) h.needs.add(y.i); }   // a full raise reopens the betting
      else for (const y of this.p) if (y.i !== i && !y.folded && !y.allIn && y.bet < to) h.needs.add(y.i);                              // a short all-in: those behind must answer
      h.current = Math.max(h.current, to);
      this.emit({ t: h.current === to && h.current > 0 && size > 0 ? "raise" : "call", i, to, allIn: x.allIn });
    } else return false;
    h.needs.delete(i);
    const inHand = this.p.filter((y) => !y.folded);
    if (inHand.length === 1) return this.award([{ amount: this.pot(), eligible: [inHand[0].i] }], true), true;
    const nx = this.next(i, (y) => h.needs.has(y.i) && !y.folded && !y.allIn);
    if (nx < 0) this.endStreet(); else { h.actor = nx; this.emit({ t: "turn", i: nx }); }
    return true;
  }
  endStreet() {
    const h = this.hand;
    for (const x of this.p) x.bet = 0;
    h.current = 0; h.minRaise = this.blinds[1];
    const order = ["preflop", "flop", "turn", "river"], k = order.indexOf(h.street);
    if (k === 3) return this.showdown();
    h.street = order[k + 1];
    const n = h.street === "flop" ? 3 : 1; h.deck.shift();   // burn
    for (let c = 0; c < n; c++) h.board.push(h.deck.shift());
    this.emit({ t: "board", street: h.street, board: h.board.slice() });
    if (this.canAct().length < 2) return this.endStreet();   // everyone's all in: run the board out
    h.needs = new Set(this.canAct().map((x) => x.i));
    h.actor = this.next(this.button, (x) => h.needs.has(x.i));
    this.emit({ t: "turn", i: h.actor });
  }
  showdown() {
    const h = this.hand; h.street = "showdown";
    const put = this.p.map((x) => x.put), pots = [];
    while (put.some((v) => v > 0)) {
      const live = this.p.filter((x) => !x.folded && put[x.i] > 0);
      const level = live.length ? Math.min(...live.map((x) => put[x.i])) : Math.max(...put);
      let amount = 0; for (let j = 0; j < put.length; j++) { const take = Math.min(put[j], level); amount += take; put[j] -= take; }
      pots.push({ amount, eligible: live.length ? live.map((x) => x.i) : this.p.filter((x) => !x.folded).map((x) => x.i) });
    }
    for (const x of this.p) if (!x.folded) x.value = evaluate([...x.cards, ...h.board]);
    this.emit({ t: "show", hands: this.p.filter((x) => !x.folded).map((x) => ({ i: x.i, cards: x.cards, name: HAND_NAMES[x.value[0]] })) });
    this.award(pots, false);
  }
  award(pots, uncontested) {
    const h = this.hand, wins = [];
    for (const pot of pots) {
      if (!pot.amount) continue;
      let best = null, ws = [];
      for (const i of pot.eligible) { const v = uncontested ? [0] : this.p[i].value; const c = best ? compare(v, best) : 1; if (c > 0) { best = v; ws = [i]; } else if (c === 0) ws.push(i); }
      const share = Math.floor(pot.amount / ws.length); let odd = pot.amount - share * ws.length;
      // odd chips go to the first winner after the button
      const ordered = ws.slice().sort((a, b) => ((a - this.button + this.p.length) % this.p.length) - ((b - this.button + this.p.length) % this.p.length));
      for (const i of ordered) { const amt = share + (odd > 0 ? 1 : 0); odd--; this.p[i].stack += amt; wins.push({ i, amt, hand: uncontested ? null : HAND_NAMES[this.p[i].value[0]] }); }
    }
    h.over = true; h.actor = -1; h.winners = wins;
    for (const x of this.p) { x.bet = 0; }
    this.emit({ t: "win", wins });
    // who's out: placed by how many are left; two busting on one hand share the order they started it in
    const busted = this.p.filter((x) => !x.out && x.stack === 0);
    let left = this.alive().length;
    for (const x of busted) { x.out = true; x.place = left--; this.emit({ t: "out", i: x.i, place: x.place }); }
    if (this.alive().length === 1) { const w = this.alive()[0]; w.place = 1; this.finished = true; this.emit({ t: "over", winner: w.i }); }
  }
}

/* SIT & GO payouts for six: the top two are paid, 65 / 35 of the pool */
export const PAYOUTS = [0.65, 0.35];

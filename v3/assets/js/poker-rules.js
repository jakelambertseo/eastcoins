/* EastCoin Poker — the rules (2026-10-10, the owner: "lets get started on the poker game … a dedicated, embedded game such as eastkart,
   cs67 … top down view"). No-limit Texas Hold'em, one 6-max cash table, blinds 1/2, buy in 50–200, PEOPLE ONLY (no bots at the table —
   the owner's call), on the arcade worker from day one.

   Import-free and shared three ways: the Durable Object (arcade-worker/src/poker.js) is the dealer and runs every function here on
   the real table; the page (tools/poker/) uses the same evaluator and names to draw; tools/poker-test.mjs runs the lot on Node.

   Money (2026-10-10): PLAY CHIPS while the game is iterated on — a bank per Twitch id, refilled when broke. At launch chips are bought
   with ZCoins at a table's ratio (RATIOS below are the suggestion), so someone with 1 ZC and someone with thousands can sit at the same
   table: the table is the same size in chips for both. The chips on the table are the only thing that moves between people; the house
   takes nothing (no rake, like the PvP tables).

   A card is 0..51: rank = c % 13 (0 = deuce .. 12 = ace), suit = floor(c / 13) (s h d c). A hand's score is one integer: category
   first, then the ranks that break ties, so two scores compare with <. */

export const VERSION = 9;
/* (2026-10-13, the owner: "minimum antes need to be in 5s as well ie 5,10") blinds 5/10, buy in 200–1,000 (20–100 big blinds), so every number on the felt is a multiple of five */
export const TABLE = { SEATS: 6, CHIP: 5, SB: 5, BB: 10, MIN_BUY: 200, MAX_BUY: 1000, TURN_MS: 30000, SHOW_MS: 6500, GAP_MS: 3000, MIN_PLAYERS: 2, AWAY_AFTER: 2, DISCONNECT_MS: 60000 };
export const BANK = { START: 2000, REFILL_BELOW: 200, REFILL_TO: 2000, REFILL_MS: 60 * 60 * 1000 };
/* The launch ratios, one per table size. Blinds and buy-ins stay 1/2 and 50–200 IN CHIPS at every table; the ratio is what a chip costs. */
export const RATIOS = [
  { key: "nickel", name: "Nickel", chipsPerZc: 200, line: "1 ZC buys 200 chips: a full buy-in is 5 ZC, the minimum 1 ZC. Anyone can sit." },
  { key: "dime", name: "Dime", chipsPerZc: 20, line: "1 ZC buys 20 chips: a full buy-in is 50 ZC." },
  { key: "dollar", name: "Dollar", chipsPerZc: 2, line: "1 ZC buys 2 chips: a full buy-in is 500 ZC. The big table." }
];

/* FIVES (2026-10-13, the owner: "all money, bets, raises, starts, etc should be in multiples of 5"): every buy-in, raise and bot bet is
   rounded to a multiple of CHIP; a split pot is shared in multiples of CHIP with the remainder to the first winner after the button.
   Because every amount that goes in is a multiple of CHIP, every stack stays one. */
const r5 = (x) => Math.round(x / TABLE.CHIP) * TABLE.CHIP;
export const RANKS = "23456789TJQKA", SUITS = "shdc", SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"], RANK_NAMES = ["Deuce", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
export const rankOf = (c) => c % 13, suitOf = (c) => Math.floor(c / 13);
export const cardStr = (c) => RANKS[rankOf(c)] + SUITS[suitOf(c)];
export const cardFrom = (s) => RANKS.indexOf(s[0]) + 13 * SUITS.indexOf(s[1]);
const plural = (r) => (RANK_NAMES[r] === "Six" ? "Sixes" : RANK_NAMES[r] + "s");

export function deck() { const d = []; for (let c = 0; c < 52; c++) d.push(c); return d; }
export function shuffle(d, rand) { for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const x = d[i]; d[i] = d[j]; d[j] = x; } return d; }

/* ---------------------------------------------------------------- the evaluator */
export const CAT = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
/** Five cards -> { cat, ranks (ordered tie-breakers), score }. */
export function eval5(cards) {
  const counts = new Array(13).fill(0); let flush = true; const s0 = suitOf(cards[0]);
  for (const c of cards) { counts[rankOf(c)]++; if (suitOf(c) !== s0) flush = false; }
  // ranks grouped by how many there are, biggest groups first, higher ranks first inside a group
  const groups = []; for (let r = 12; r >= 0; r--) if (counts[r]) groups.push([counts[r], r]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let straightHigh = -1;
  if (groups.length === 5) { const rs = groups.map((g) => g[1]); if (rs[0] - rs[4] === 4) straightHigh = rs[0]; else if (rs[0] === 12 && rs[1] === 3 && rs[4] === 0) straightHigh = 3; }   // the wheel: A 2 3 4 5, five high
  let cat, ranks;
  if (straightHigh >= 0 && flush) { cat = 8; ranks = [straightHigh]; }
  else if (groups[0][0] === 4) { cat = 7; ranks = [groups[0][1], groups[1][1]]; }
  else if (groups[0][0] === 3 && groups[1][0] === 2) { cat = 6; ranks = [groups[0][1], groups[1][1]]; }
  else if (flush) { cat = 5; ranks = groups.map((g) => g[1]); }
  else if (straightHigh >= 0) { cat = 4; ranks = [straightHigh]; }
  else if (groups[0][0] === 3) { cat = 3; ranks = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2 && groups[1][0] === 2) { cat = 2; ranks = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2) { cat = 1; ranks = groups.map((g) => g[1]); }
  else { cat = 0; ranks = groups.map((g) => g[1]); }
  let score = cat; for (let i = 0; i < 5; i++) score = score * 15 + (ranks[i] ?? 0);
  return { cat, ranks, score };
}
/** The best five of up to seven cards. */
export function evalBest(cards) {
  if (cards.length === 5) return { ...eval5(cards), cards: cards.slice() };
  let best = null; const n = cards.length;
  for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++) for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]]; const v = eval5(five); if (!best || v.score > best.score) best = { ...v, cards: five }; }
  return best;
}
/** "Two pair, Aces and Fours" — what the table says at showdown. */
export function handName(v) {
  const r = v.ranks;
  switch (v.cat) {
    case 8: return r[0] === 12 ? "Royal flush" : `Straight flush, ${RANK_NAMES[r[0]]} high`;
    case 7: return `Four of a kind, ${plural(r[0])}`;
    case 6: return `Full house, ${plural(r[0])} full of ${plural(r[1])}`;
    case 5: return `Flush, ${RANK_NAMES[r[0]]} high`;
    case 4: return `Straight, ${RANK_NAMES[r[0]]} high`;
    case 3: return `Three of a kind, ${plural(r[0])}`;
    case 2: return `Two pair, ${plural(r[0])} and ${plural(r[1])}`;
    case 1: return `Pair of ${plural(r[0])}`;
    default: return `${RANK_NAMES[r[0]]} high`;
  }
}

/* ---------------------------------------------------------------- the table */
export function newTable() { return { seats: Array.from({ length: TABLE.SEATS }, () => null), button: -1, handNo: 0, hand: null, phase: "waiting", endAt: 0, last: null }; }
/** A seat: who, their stack, and the per-hand fields (reset by startHand). */
export function newSeat(p, stack) { return { id: p.id, login: p.login || null, name: p.name, avatar: p.avatar || null, stack, sitOut: false, away: 0, leaving: false, gone: 0, inHand: false, hole: [], bet: 0, put: 0, folded: true, allIn: false, acted: false, won: 0, show: false }; }
export const seatOf = (t, id) => t.seats.findIndex((s) => s && s.id === id);
export function sit(t, i, p, buy) {
  if (i < 0 || i >= TABLE.SEATS || t.seats[i]) return { ok: false, err: "That seat is taken." };
  if (seatOf(t, p.id) >= 0) return { ok: false, err: "You are already at the table." };
  buy = Math.floor(Number(buy) / TABLE.CHIP) * TABLE.CHIP; if (!Number.isFinite(buy) || buy < TABLE.MIN_BUY || buy > TABLE.MAX_BUY) return { ok: false, err: `Buy in for ${TABLE.MIN_BUY} to ${TABLE.MAX_BUY}.` };
  t.seats[i] = newSeat(p, buy); return { ok: true, seat: t.seats[i] };
}
/** Leave: at once between hands; during a hand the seat folds and goes when the hand ends. Returns the chips coming back (now or later). */
export function stand(t, i) {
  const s = t.seats[i]; if (!s) return { ok: false, err: "Nobody there." };
  if (t.phase === "hand" && s.inHand && !s.folded) { s.leaving = true; if (t.hand.cur === i) { s.folded = true; s.acted = true; advance(t, t.hand.turnAt); } else s.folded = true; if (t.phase === "hand") checkEnd(t, t.hand.turnAt); return { ok: true, later: true, stack: s.stack }; }
  if (t.phase === "hand" && s.inHand) { s.leaving = true; return { ok: true, later: true, stack: s.stack }; }
  t.seats[i] = null; return { ok: true, later: false, stack: s.stack };
}
export const eligible = (t) => t.seats.map((s, i) => (s && !s.sitOut && !s.leaving && !s.gone && s.stack > 0 ? i : -1)).filter((i) => i >= 0);
export const canStart = (t) => eligible(t).length >= TABLE.MIN_PLAYERS;
const nextSeat = (t, from, pred) => { for (let k = 1; k <= TABLE.SEATS; k++) { const i = (from + k) % TABLE.SEATS; const s = t.seats[i]; if (s && pred(s, i)) return i; } return -1; };
const active = (s) => s.inHand && !s.folded;
const canAct = (s) => s.inHand && !s.folded && !s.allIn;

export function startHand(t, now, rand) {
  const who = eligible(t); if (who.length < TABLE.MIN_PLAYERS) { t.phase = "waiting"; return false; }
  t.handNo++; t.phase = "hand"; t.last = null;
  for (const s of t.seats) if (s) { s.inHand = false; s.hole = []; s.bet = 0; s.put = 0; s.folded = true; s.allIn = false; s.acted = false; s.won = 0; s.show = false; }
  for (const i of who) { const s = t.seats[i]; s.inHand = true; s.folded = false; }
  t.button = t.button < 0 ? who[Math.floor(rand() * who.length)] : nextSeat(t, t.button, (s) => s.inHand);
  const d = shuffle(deck(), rand); let di = 0;
  for (let k = 1; k <= TABLE.SEATS; k++) { const i = (t.button + k) % TABLE.SEATS; const s = t.seats[i]; if (s && s.inHand) s.hole = [d[di++], d[di++]]; }
  const headsUp = who.length === 2;
  const sb = headsUp ? t.button : nextSeat(t, t.button, (s) => s.inHand), bb = nextSeat(t, sb, (s) => s.inHand);
  const post = (i, amt) => { const s = t.seats[i]; const v = Math.min(s.stack, amt); s.stack -= v; s.bet += v; if (s.stack === 0) s.allIn = true; return v; };
  post(sb, TABLE.SB); post(bb, TABLE.BB);
  t.hand = { deck: d, di, board: [], street: 0, bet: TABLE.BB, minRaise: TABLE.BB, cur: -1, sb, bb, turnAt: now, log: [{ a: "blinds", sb, bb }], runout: false, result: null };
  t.hand.cur = nextSeat(t, bb, canAct); if (t.hand.cur < 0 || t.hand.cur === bb && !canAct(t.seats[bb])) { /* everyone all in on the blinds */ }
  t.hand.turnAt = now;
  if (!settleIfDone(t, now)) checkEnd(t, now);
  return true;
}
/** What the seat to act may do. */
export function legal(t, i) {
  const h = t.hand; if (!h || t.phase !== "hand" || h.cur !== i) return null;
  const s = t.seats[i]; if (!s || !canAct(s)) return null;
  const toCall = Math.max(0, h.bet - s.bet); const call = Math.min(toCall, s.stack);
  const maxTo = s.bet + s.stack; const minTo = Math.min(maxTo, h.bet + h.minRaise);
  return { fold: true, check: toCall === 0, call: toCall > 0 ? call : 0, allIn: call >= s.stack, raise: maxTo > h.bet && (maxTo >= h.bet + h.minRaise || true), minTo, maxTo, toCall, pot: potOf(t) };
}
export const potOf = (t) => t.seats.reduce((n, s) => n + (s ? s.put + s.bet : 0), 0);
/** An action from the seat to act. */
export function act(t, i, action, amount, now) {
  const L = legal(t, i); if (!L) return { ok: false, err: "Not your turn." };
  const s = t.seats[i], h = t.hand; let line;
  const pay = (v) => { v = Math.min(v, s.stack); s.stack -= v; s.bet += v; if (s.stack === 0) s.allIn = true; return v; };
  if (action === "fold") { s.folded = true; line = { a: "fold", i }; }
  else if (action === "check") { if (!L.check) return { ok: false, err: "You cannot check." }; line = { a: "check", i }; }
  else if (action === "call") { if (L.toCall <= 0) return { ok: false, err: "Nothing to call." }; const v = pay(L.toCall); line = { a: "call", i, v, allIn: s.allIn }; }
  else if (action === "raise" || action === "allin") {
    let to = action === "allin" ? L.maxTo : Math.floor(Number(amount));
    if (!Number.isFinite(to)) return { ok: false, err: "Raise to what?" };
    if (to > L.maxTo) to = L.maxTo; if (to !== L.maxTo) { to = r5(to); if (to > L.maxTo) to = L.maxTo; }   /* a size off the fives is rounded; one under the minimum is still refused below */
    if (to <= h.bet) { if (to === L.maxTo && to > s.bet) { const v = pay(to - s.bet); line = { a: "call", i, v, allIn: true }; } else return { ok: false, err: "That is not a raise." }; }
    else {
      if (to < L.minTo && to !== L.maxTo) return { ok: false, err: `Minimum raise is to ${L.minTo}.` };
      const full = to - h.bet >= h.minRaise; pay(to - s.bet);
      if (full) { h.minRaise = to - h.bet; for (const o of t.seats) if (o && o !== s && canAct(o)) o.acted = false; }   // a full raise reopens the action; a short all-in does not
      h.bet = to; line = { a: to === L.maxTo && s.allIn ? "allin" : "raise", i, to, allIn: s.allIn };
    }
  }
  else return { ok: false, err: "Unknown action." };
  s.acted = true; h.log.push(line); s.away = 0;
  advance(t, now);
  return { ok: true, line };
}
/** Whose turn next, or the street is over, or the hand is. */
function advance(t, now) {
  const h = t.hand; if (!h || t.phase !== "hand") return;
  if (checkEnd(t, now)) return;
  if (settleIfDone(t, now)) return;   // a fold can leave one bettor against the all-ins: nothing to bet into, run it out
  const next = nextSeat(t, h.cur, (s) => canAct(s) && !s.acted);
  if (next >= 0 && t.seats[next].bet < h.bet || next >= 0 && !t.seats[next].acted) { h.cur = next; h.turnAt = now; return; }
  nextStreet(t, now);
}
/** One player left standing? Then the hand is theirs. */
function checkEnd(t, now) {
  const left = t.seats.filter((s) => s && active(s));
  if (left.length === 1 && t.phase === "hand") { collect(t); showdown(t, now); return true; }
  return false;
}
function collect(t) { for (const s of t.seats) if (s) { s.put += s.bet; s.bet = 0; } }
function nextStreet(t, now) {
  const h = t.hand; collect(t);
  if (h.street >= 3) { showdown(t, now); return; }
  h.street++; h.board.push(...(h.street === 1 ? [h.deck[h.di++], h.deck[h.di++], h.deck[h.di++]] : [h.deck[h.di++]]));
  h.bet = 0; h.minRaise = TABLE.BB; for (const s of t.seats) if (s) s.acted = false;
  h.log.push({ a: "street", street: h.street, board: h.board.slice() });
  if (!settleIfDone(t, now)) { h.cur = nextSeat(t, t.button, canAct); h.turnAt = now; }
}
/** Fewer than two who can still bet: run the board out and show down. */
function settleIfDone(t, now) {
  const h = t.hand; const can = t.seats.filter((s) => s && canAct(s)); const act_ = t.seats.filter((s) => s && active(s));
  if (act_.length <= 1) { collect(t); showdown(t, now); return true; }
  // nobody can bet (all but at most one are all in, and that one has nothing left to call) -> deal the rest
  const open = can.filter((s) => s.bet < h.bet);
  if (can.length === 0 || (can.length === 1 && open.length === 0)) { collect(t); h.runout = true; while (h.street < 3) { h.street++; h.board.push(...(h.street === 1 ? [h.deck[h.di++], h.deck[h.di++], h.deck[h.di++]] : [h.deck[h.di++]])); } h.cur = -1; showdown(t, now); return true; }
  return false;
}
/** Side pots by what each player put in, best hand per pot, odd chips to the first seat after the button. */
export function showdown(t, now) {
  const h = t.hand; const inHand = t.seats.map((s, i) => (s && s.inHand ? i : -1)).filter((i) => i >= 0);
  const alive = inHand.filter((i) => active(t.seats[i]));
  const scores = {}; for (const i of alive) { const s = t.seats[i]; const v = h.board.length === 5 ? evalBest([...s.hole, ...h.board]) : evalBest([...s.hole, ...h.board].length >= 5 ? [...s.hole, ...h.board] : [...s.hole, ...h.board, ...h.deck.slice(h.di, h.di + 5 - h.board.length)]); scores[i] = v; }
  const levels = [...new Set(inHand.map((i) => t.seats[i].put).filter((v) => v > 0))].sort((a, b) => a - b);
  const pots = []; let prev = 0;
  const refunds = [];
  for (const lvl of levels) { let amount = 0, contributors = 0; for (const i of inHand) { const v = Math.max(0, Math.min(t.seats[i].put, lvl) - prev); amount += v; if (v > 0) contributors++; } const elig = alive.filter((i) => t.seats[i].put >= lvl);
    // chips only one player put in at this level and nobody could match: an uncalled bet, back to them (never a "pot" won)
    if (amount > 0 && elig.length === 1 && contributors === 1 && alive.length > 1) { t.seats[elig[0]].stack += amount; refunds.push({ i: elig[0], amount }); }
    else if (amount > 0 && elig.length) pots.push({ amount, elig });
    else if (amount > 0) { for (const i of inHand) { const v = Math.max(0, Math.min(t.seats[i].put, lvl) - prev); if (v > 0) { t.seats[i].stack += v; refunds.push({ i, amount: v }); } } }   // nobody left to win it (should not happen: see advance); never lose a chip
    prev = lvl; }
  // merge pots with the same eligible set (several levels, same people)
  const merged = []; for (const p of pots) { const last = merged[merged.length - 1]; if (last && last.elig.join() === p.elig.join()) last.amount += p.amount; else merged.push({ amount: p.amount, elig: p.elig.slice() }); }
  const result = { pots: [], shows: [], refunds, board: h.board.slice(), runout: h.runout, folded: alive.length === 1 };
  for (const p of merged) {
    let best = -1; for (const i of p.elig) if (best < 0 || scores[i].score > best) best = scores[i].score;
    const winners = p.elig.filter((i) => scores[i].score === best);
    const share = Math.floor(p.amount / winners.length / TABLE.CHIP) * TABLE.CHIP; let odd = p.amount - share * winners.length;
    const order = []; for (let k = 1; k <= TABLE.SEATS; k++) { const i = (t.button + k) % TABLE.SEATS; if (winners.includes(i)) order.push(i); }
    for (const i of order) { const v = share + odd; odd = 0; t.seats[i].stack += v; t.seats[i].won += v; }
    result.pots.push({ amount: p.amount, winners: order, hand: alive.length > 1 ? handName(scores[order[0]]) : null, cards: alive.length > 1 ? scores[order[0]].cards : null });
  }
  if (alive.length > 1) { for (const i of alive) { t.seats[i].show = true; result.shows.push({ i, hole: t.seats[i].hole.slice(), name: handName(scores[i]), score: scores[i].score }); } }
  else if (alive.length === 1) { result.mayShow = alive[0]; }   /* (2026-10-13) the winner by a fold MAY show: showHand(), their choice, during the showdown pause */
  for (const s of t.seats) if (s) { s.put = 0; s.bet = 0; }
  h.result = result; h.cur = -1; t.phase = "showdown"; t.endAt = now + (alive.length > 1 ? TABLE.SHOW_MS : TABLE.GAP_MS); t.last = { handNo: t.handNo, result, button: t.button, log: h.log.slice() };
  h.log.push({ a: "end", pots: result.pots });
  return result;
}
/** During the showdown pause, a seat that was in the hand and is not already shown may turn its cards over (the winner by a fold, or a loser who wants to). */
export function showHand(t, i) {
  const s = t.seats[i]; if (!s || t.phase !== "showdown" || !s.inHand || s.show || !t.hand?.result) return null;
  s.show = true; const cards = [...s.hole, ...t.hand.board]; const rec = { i, hole: s.hole.slice(), name: cards.length >= 5 ? handName(evalBest(cards)) : "", score: 0, chosen: true };
  t.hand.result.shows.push(rec); return rec;
}
/** After the showdown pause: seats that were leaving go, the broke sit out, back to waiting (the dealer starts the next hand). */
/** An admin reset mid-hand: every chip put in this hand goes back to whoever put it, the hand is void, the table waits. */
export function cancelHand(t) {
  if (!t.hand) return false;
  for (const s of t.seats) if (s) { s.stack += s.put + s.bet; s.put = 0; s.bet = 0; s.inHand = false; s.hole = []; s.folded = true; s.allIn = false; s.show = false; s.won = 0; }
  t.hand = null; t.phase = "waiting"; t.last = null; return true;
}
export function finishHand(t) {
  const back = [];
  for (let i = 0; i < TABLE.SEATS; i++) { const s = t.seats[i]; if (!s) continue; s.inHand = false; s.hole = []; s.show = false; if (s.leaving) { back.push({ id: s.id, name: s.name, stack: s.stack, why: "left" }); t.seats[i] = null; continue; } /* a GONE seat is held for the dealer's minute (2026-10-13: a refresh used to stand you up here) */ if (s.stack <= 0) s.sitOut = true; if (s.away >= TABLE.AWAY_AFTER) s.sitOut = true; }
  t.hand = null; t.phase = "waiting"; return back;
}
/** The clock ran out on the seat to act: check if they can, else fold; twice in a row sits them out. */
export function timeout(t, now) {
  const h = t.hand; if (!h || t.phase !== "hand" || h.cur < 0) return null;
  if (now - h.turnAt < TABLE.TURN_MS) return null;
  const i = h.cur, s = t.seats[i]; const L = legal(t, i); if (!L) return null;
  const r = act(t, i, L.check ? "check" : "fold", 0, now); s.away += 1; return { i, did: L.check ? "check" : "fold", away: s.away };
}
/* ---------------------------------------------------------------- the test bots (2026-10-13, the owner: "add a bot so i can test … or a few")
   NOT table regulars — the table is people only. An admin summons them from the page (one per click, up to the free seats) to have
   someone to play against while the game is iterated on; the dealer stands them when the admin removes them or when nobody is
   connected. They play plain poker: a strength from their cards (and the board, once there is one), check and call mostly, bet and
   raise when strong, fold to a bet they cannot pay for. */
export const isBot = (s) => Boolean(s && String(s.id).startsWith("bot:"));
export function botStrength(hole, board) {
  if (board.length >= 3) { const v = evalBest([...hole, ...board]); return [0.2, 0.45, 0.65, 0.8, 0.9, 0.93, 0.97, 0.99, 1][v.cat] + (v.cat <= 1 ? rankOf(v.ranks[0]) / 13 * 0.12 : 0); }
  const [a, b] = hole.map(rankOf), suited = suitOf(hole[0]) === suitOf(hole[1]), hi = Math.max(a, b), lo = Math.min(a, b);
  if (a === b) return 0.6 + a / 12 * 0.38;
  let s = 0.22 + hi / 12 * 0.25 + lo / 12 * 0.12; if (suited) s += 0.05; if (hi - lo <= 2) s += 0.04; if (hi === 12) s += 0.06; return Math.min(0.72, s);
}
export function botAct(t, i, rand) {
  const L = legal(t, i); if (!L) return null; const s = t.seats[i], h = t.hand;
  const str = botStrength(s.hole, h.board), pot = L.pot, r = rand();
  const betTo = (mult) => { let to = r5(h.bet + (pot + L.toCall) * mult); if (to < L.minTo) to = Math.ceil(L.minTo / TABLE.CHIP) * TABLE.CHIP; return Math.min(L.maxTo, to); };
  if (L.toCall === 0) { if (str > 0.78 && r < 0.75) return { a: "raise", to: betTo(0.7) }; if (str > 0.5 && r < 0.4) return { a: "raise", to: betTo(0.5) }; if (r < 0.06 && h.board.length >= 3) return { a: "raise", to: betTo(0.6) }; return { a: "check" }; }
  const odds = L.toCall / (pot + L.toCall);
  if (str > 0.85 && r < 0.6) return { a: L.maxTo > h.bet ? "raise" : "call", to: betTo(1.0) };
  if (str > 0.62 && r < 0.3) return { a: L.maxTo > h.bet ? "raise" : "call", to: betTo(0.8) };
  if (str >= odds + 0.08 || r < 0.1) return { a: "call" };
  if (L.toCall <= TABLE.BB && r < 0.6) return { a: "call" };
  return { a: "fold" };
}
/** What a viewer may see: every seat, hole cards only their own (or shown at the showdown). */
export function viewFor(t, viewerId, now = 0) {
  const me = seatOf(t, viewerId); const h = t.hand;
  return {
    phase: t.phase, handNo: t.handNo, button: t.button, me, pot: h ? potOf(t) : 0,
    board: h ? h.board : [], street: h ? h.street : 0, cur: h ? h.cur : -1, bet: h ? h.bet : 0,
    turnLeft: h && h.cur >= 0 ? Math.max(0, TABLE.TURN_MS - (now - h.turnAt)) : 0, endIn: t.phase === "showdown" ? Math.max(0, t.endAt - now) : 0,
    seats: t.seats.map((s, i) => s ? { i, id: s.id, login: s.login, name: s.name, avatar: s.avatar, stack: s.stack, bet: s.bet, put: s.put, inHand: s.inHand, folded: s.folded, allIn: s.allIn, sitOut: s.sitOut, leaving: s.leaving, gone: Boolean(s.gone), won: s.won, cards: s.inHand ? (i === me || s.show ? s.hole : (s.folded ? [] : s.hole.map(() => -1))) : [] } : null),
    legal: me >= 0 ? legal(t, me) : null, mayShow: t.phase === "showdown" && me >= 0 && t.seats[me]?.inHand && !t.seats[me].show, last: t.last ? { handNo: t.last.handNo, result: t.last.result } : null
  };
}

/* ============================================================
   EastCoin Casino — Higher or Lower

   A per-player game with a committed deck. When a game starts the
   server draws a random seed, shows sha256(seed) to the player,
   and deals card 0. Card i is fixed by the seed alone:

     rank(i) = 1 + (sha256(seed + ":" + i) mod 13)     ace low, king high

   So every card was decided before the first call, and the seed
   is revealed when the game ends so anyone can check the run.

   Each correct call multiplies the stake. A TIE IS A PUSH (since
   2026-09-16; it lost before): the run carries on at the same
   multiplier from the tied card. So a call is priced on the cards
   that can settle it — the twelve that are not a tie — and is fair:

     from a 3, "higher" wins 10 of the 12 → ×1.20
     from a 10, "higher" wins 3 of the 12 → ×4
     win 10/13 × 1.2 + tie 1/13 × 1 = 1.00

   The return is unchanged at 100% (before the run's own edge); what
   changes is the shape — a bust is a wrong call, never a coincidence,
   and the prices are round numbers. From an ace "higher" cannot lose
   and so pays ×1: it deals the next card and nothing else, and it does
   not count as the right call that unlocks a cash-out (rightsOf).

   Cash out any time after the first correct call. The run ends at
   ×50 or 12 cards, whichever comes first. One live game per person;
   stake and per-hour limits are the casino's.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, opDone, retryKey, newId } from "../../picks/_lib.js";
import { sha256, randomSeed, edgeFor, ensureColumn, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "../_engine.js";

// 2026-09-14: the players' side. Per call, so a six-call run returns about
// 104% and a single call about 100.5%; the x50 ceiling is what trims long
// chains, not the price. Was 0.99, which compounded to 87% in practice.
// Each call is priced FAIRLY now. The run's edge is drawn once from its
// seed and applied to the payout, so a long chain no longer compounds a
// per-call shave the way it used to.
export const EDGE_RETURN = 1;
export const MAX_MULTIPLIER = 50;
export const MAX_STEPS = 12;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["♠", "♥", "♦", "♣"];

let ready = false;
export async function ensureHilo(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS hilo_games (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      stake INTEGER NOT NULL CHECK (stake >= 1),
      cards TEXT NOT NULL,
      calls TEXT NOT NULL DEFAULT '[]',
      multiplier REAL NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'LIVE' CHECK (status IN ('LIVE','CASHED','BUST')),
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hilo_user ON hilo_games (user_id, created_at)`),
    // The floor counts live games every five seconds; without this that
    // is a full scan each time.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hilo_live ON hilo_games (status, updated_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hilo_recent ON hilo_games (updated_at)`)
  ]);
  await ensureColumn(db, "hilo_games", "edge", "REAL NOT NULL DEFAULT 1");
  ready = true;
}

/** Card i of a deck: rank 1..13 and a suit, both from the seed. */
export async function cardAt(seed, i) {
  const h = await sha256(`${seed}:${i}`);
  return { rank: 1 + (parseInt(h.slice(0, 8), 16) % 13), suit: parseInt(h.slice(8, 10), 16) % 4 };
}

/**
 * The price of each call from a rank; null where it cannot win. A tie
 * pushes, so the chances are out of the twelve cards that are not one.
 * pTie is the chance of a push on either call.
 */
export function oddsFrom(rank) {
  const pHigher = (13 - rank) / 12;
  const pLower = (rank - 1) / 12;
  const price = (p) => (p > 0 ? Math.round((EDGE_RETURN / p) * 100) / 100 : null);
  return { higher: price(pHigher), lower: price(pLower), pHigher, pLower, pTie: 1 / 13 };
}

/** Right calls that moved the multiplier — a push, or a ×1 call from an ace or a king, is not one. */
export function rightsOf(calls) {
  return (calls || []).filter((c) => c && c.won && Number(c.price) > 1).length;
}

const parse = (t, fallback) => { try { return JSON.parse(t); } catch { return fallback; } };

export function publicGame(g, { revealSeed = false } = {}) {
  const cards = parse(g.cards, []);
  const calls = parse(g.calls, []);
  const current = cards[cards.length - 1];
  return {
    id: g.id,
    status: g.status,
    stake: Number(g.stake),
    multiplier: Number(g.multiplier),
    payout: Number(g.payout || 0),
    potential: Math.round(Number(g.stake) * Number(g.multiplier) * Number(g.edge || 1)),
    step: calls.length,
    rights: rightsOf(calls),
    pushes: calls.filter((c) => c && c.push).length,
    // A suit is stored as its index (0-3). Runs dealt before 2026-09-16
    // stored every card after the first as the SYMBOL instead, and this
    // line only understood the index — so those cards reached the page
    // with no suit, and a J♠ and a J♦ drew as the same black "J".
    cards: cards.map((c) => ({ rank: c.rank, label: RANKS[c.rank - 1], suit: typeof c.suit === "number" ? SUITS[c.suit] : SUITS.includes(c.suit) ? c.suit : "" })),
    calls,
    odds: g.status === "LIVE" && current ? oddsFrom(current.rank) : null,
    hash: g.hash,
    seed: revealSeed || g.status !== "LIVE" ? g.seed : null,
    createdAt: String(g.created_at).replace(" ", "T") + "Z",
    updatedAt: String(g.updated_at).replace(" ", "T") + "Z"
  };
}

export async function liveGameFor(db, userId) {
  return db.prepare(`SELECT * FROM hilo_games WHERE user_id = ? AND status = 'LIVE' ORDER BY created_at DESC LIMIT 1`).bind(userId).first();
}

export async function gamesLastHour(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM hilo_games WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

/** Pays out a run. Idempotent per game: the operation key is the game id. */
export async function cashOut(env, db, g, login) {
  // Rounded, not floored: flooring took 2-7% off small stakes on its own.
  const payout = Math.round(Number(g.stake) * Number(g.multiplier) * Number(g.edge || 1));
  const base = `CASINO:HILO:PAY:${g.id}`;

  /* A FAILED PAYOUT USED TO END HI-LO FOR THAT PLAYER, PERMANENTLY (fixed 2026-09-21). The row was left LIVE on both failure
     paths, so hilo/start.js refused every future deal with GAME_LIVE — and the retry could never work either, because the
     NEEDS_RECONCILIATION row held the one idempotency key and beginOperation answered DUPLICATE for good. The only way out
     was an admin editing the database. See opDone/retryKey in picks/_lib.js for why a duplicate key is not a payment. */
  if (await opDone(db, base) || await opDone(db, await retryKey(db, base))) {
    // Already paid on an earlier attempt: just make the row agree and report it.
    await db.prepare(`UPDATE hilo_games SET status = 'CASHED', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`).bind(payout, g.id).run();
    return { ok: true, payout, balance: null };
  }

  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: await retryKey(db, base), userId: g.user_id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: payout
  });
  if (!begun.ok) return { ok: false, code: "DUPLICATE" };   // another request is mid-flight on this very key
  const credit = await moveBalance(env, login, payout);
  if (!credit.ok) {
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    return { ok: false, code: "PAYOUT_FAILED" };            // the run stays LIVE, and the NEXT try gets a key of its own
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
  await db.prepare(`UPDATE hilo_games SET status = 'CASHED', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`).bind(payout, g.id).run();
  return { ok: true, payout, balance: credit.balance };
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256, edgeFor };

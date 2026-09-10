/* ============================================================
   EastCoin Casino — Higher or Lower

   A per-player game with a committed deck. When a game starts the
   server draws a random seed, shows sha256(seed) to the player,
   and deals card 0. Card i is fixed by the seed alone:

     rank(i) = 1 + (sha256(seed + ":" + i) mod 13)     ace low, king high

   So every card was decided before the first call, and the seed
   is revealed when the game ends so anyone can check the run.

   Each correct call multiplies the stake. Ties lose. The price of
   a call is 0.96 / probability, so every call carries the same 4%
   edge whatever the card:

     from a 3, "higher" wins 10 times in 13 → ×1.25
     from a 10, "higher" wins 3 times in 13 → ×4.16

   Cash out any time after the first correct call. The run ends at
   ×50 or 12 cards, whichever comes first. One live game per person;
   stake and per-hour limits are the casino's.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../../picks/_lib.js";
import { sha256, randomSeed, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "../_engine.js";

export const EDGE_RETURN = 0.96;
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
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hilo_user ON hilo_games (user_id, created_at)`)
  ]);
  ready = true;
}

/** Card i of a deck: rank 1..13 and a suit, both from the seed. */
export async function cardAt(seed, i) {
  const h = await sha256(`${seed}:${i}`);
  return { rank: 1 + (parseInt(h.slice(0, 8), 16) % 13), suit: parseInt(h.slice(8, 10), 16) % 4 };
}

/** The price of each call from a rank; null where it cannot win. */
export function oddsFrom(rank) {
  const pHigher = (13 - rank) / 13;
  const pLower = (rank - 1) / 13;
  const price = (p) => (p > 0 ? Math.round((EDGE_RETURN / p) * 100) / 100 : null);
  return { higher: price(pHigher), lower: price(pLower), pHigher, pLower };
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
    potential: Math.floor(Number(g.stake) * Number(g.multiplier)),
    step: calls.length,
    cards: cards.map((c) => ({ rank: c.rank, label: RANKS[c.rank - 1], suit: SUITS[c.suit] })),
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
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM hilo_games WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

/** Pays out a run. Idempotent per game: the operation key is the game id. */
export async function cashOut(env, db, g, login) {
  const payout = Math.floor(Number(g.stake) * Number(g.multiplier));
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:HILO:PAY:${g.id}`, userId: g.user_id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: payout
  });
  if (!begun.ok) return { ok: false, code: "DUPLICATE" };
  const credit = await moveBalance(env, login, payout);
  if (!credit.ok) {
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    return { ok: false, code: "PAYOUT_FAILED" };
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
  await db.prepare(`UPDATE hilo_games SET status = 'CASHED', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`).bind(payout, g.id).run();
  return { ok: true, payout, balance: credit.balance };
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256 };

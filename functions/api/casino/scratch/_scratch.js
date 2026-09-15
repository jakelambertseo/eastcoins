/* ============================================================
   EastCoin Casino — Scratch-Off

   A card with nine cells under a foil. Three of a kind pays that
   symbol's price; anything else pays nothing. The card is decided
   the moment it is bought — scratching is the reveal, like Plinko's
   drop — so closing the tab loses nothing.

   Fairness is Plinko's: each player holds a COMMITTED seed for
   their next card (hash shown before they buy), the card comes from
   that seed alone, the seed is revealed with the card, and a fresh
   one is committed at once. The house cannot pick a seed after
   seeing the stake.

   The OUTCOME is drawn first, from the prize table, by

     u = sha256(seed:scratch) as a fraction in [0, 1)

   walked down the table rarest first. THEN a grid is laid out to
   match it: exactly three of the winning symbol on a winner, at
   most two of anything on a loser, shuffled by sha256(seed:cell:i).
   So a card can never show three of something that does not pay,
   and the near-miss (two crowns and a coin) is real and free.

   The table returns 103.5% — the players' side, like the rest of
   the floor since 2026-09-14 — and 43.4% of cards win something.
   The top prize is x100, once in a thousand: 2,000 on the 20 ZC
   maximum, under Mines' x125 ceiling.
   ============================================================ */

import { sha256, randomSeed, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "../_engine.js";

// Rarest first, so the walk below meets the big prizes on the small
// slice of u they own and everything else falls through to "no match".
export const PRIZES = [
  { key: "crown", name: "Crown", x: 100, p: 0.001 },
  { key: "diamond", name: "Diamond", x: 25, p: 0.003 },
  { key: "fire", name: "Fire", x: 10, p: 0.01 },
  { key: "clover", name: "Clover", x: 5, p: 0.03 },
  { key: "target", name: "Target", x: 3, p: 0.05 },
  { key: "football", name: "Football", x: 2, p: 0.12 },
  { key: "coin", name: "Coin", x: 1, p: 0.22 }
];
export const SYMBOLS = PRIZES.map((p) => p.key);
export const CELLS = 9;
export const MAX_MULTIPLIER = Math.max(...PRIZES.map((p) => p.x));
export const RETURN = PRIZES.reduce((n, p) => n + p.p * p.x, 0);        // 1.035
export const WIN_CHANCE = PRIZES.reduce((n, p) => n + p.p, 0);           // 0.434

let ready = false;
export async function ensureScratch(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS scratch_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      stake INTEGER NOT NULL CHECK (stake >= 1),
      prize TEXT,
      multiplier REAL NOT NULL DEFAULT 0,
      grid TEXT NOT NULL,
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_scratch_user ON scratch_cards (user_id, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS scratch_commits (
      user_id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
  ready = true;
}

/** The seed this player's next card will use, made now if there isn't one. */
export async function commitFor(db, userId) {
  const existing = await db.prepare(`SELECT * FROM scratch_commits WHERE user_id = ?`).bind(userId).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT INTO scratch_commits (user_id, seed, hash) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING`)
    .bind(userId, seed, hash)
    .run();
  return db.prepare(`SELECT * FROM scratch_commits WHERE user_id = ?`).bind(userId).first();
}

/** Replaces a used seed with a fresh commitment for the next card. */
export async function rotateCommit(db, userId) {
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT INTO scratch_commits (user_id, seed, hash, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET seed = excluded.seed, hash = excluded.hash, created_at = CURRENT_TIMESTAMP`)
    .bind(userId, seed, hash)
    .run();
  return { seed, hash };
}

/** A fraction in [0, 1) from a hash: its first 13 hex digits over 16^13. */
const fraction = (hex) => parseInt(hex.slice(0, 13), 16) / 2 ** 52;

/** The prize a seed wins, or null for no match. */
export async function outcomeFor(seed) {
  const u = fraction(await sha256(`${seed}:scratch`));
  let acc = 0;
  for (const prize of PRIZES) {
    acc += prize.p;
    if (u < acc) return prize;
  }
  return null;
}

/**
 * The nine cells for a seed, given its outcome: three of the winner and
 * six others (none three times) on a win; nothing three times on a
 * loss. Every draw and the shuffle come from sha256(seed:cell:i), so
 * the layout is as checkable as the outcome.
 */
export async function gridFor(seed, prize) {
  const draws = [];
  for (let i = 0; i < 40; i += 1) draws.push(fraction(await sha256(`${seed}:cell:${i}`)));
  let at = 0;
  const next = () => draws[at++ % draws.length];
  const count = (list, key) => list.filter((k) => k === key).length;

  const cells = [];
  if (prize) {
    cells.push(prize.key, prize.key, prize.key);
    const others = SYMBOLS.filter((k) => k !== prize.key);
    while (cells.length < CELLS) {
      const k = others[Math.floor(next() * others.length)];
      if (count(cells, k) < 2) cells.push(k);
    }
  } else {
    while (cells.length < CELLS) {
      const k = SYMBOLS[Math.floor(next() * SYMBOLS.length)];
      if (count(cells, k) < 2) cells.push(k);
    }
  }
  // Fisher–Yates from the same stream, so where the three land is fixed too.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

/** The prize table for the page: what each match pays and how often. */
export function oddsTable() {
  return PRIZES.map((p) => ({ key: p.key, name: p.name, multiplier: p.x, chance: p.p }));
}

export const prizeFor = (key) => PRIZES.find((p) => p.key === key) || null;

export function publicCard(c) {
  let grid = [];
  try { grid = JSON.parse(c.grid || "[]"); } catch { grid = []; }
  const prize = prizeFor(c.prize);
  return {
    id: c.id,
    stake: Number(c.stake),
    prize: prize ? prize.key : null,
    prizeName: prize ? prize.name : null,
    multiplier: Number(c.multiplier || 0),
    grid,
    payout: Number(c.payout || 0),
    profit: Number(c.payout || 0) - Number(c.stake),
    hash: c.hash,
    seed: c.seed,
    at: String(c.created_at).replace(" ", "T") + "Z"
  };
}

export async function cardsLastHour(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM scratch_cards WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256 };

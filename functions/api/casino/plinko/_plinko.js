/* ============================================================
   EastCoin Casino — Plinko

   A ball falls through eight rows of pegs, going left or right at
   each one, and lands in one of nine buckets. Which way it goes at
   row i is fixed by the seed alone:

     right if sha256(seed + ":" + i) is odd, otherwise left

   so the whole path is a pure function of one seed.

   Fairness needs care here that Mines and Hi-Lo did not. Those
   games commit a seed and then let you make choices, so the commit
   plainly comes first. A drop has no choices in it, so instead each
   player holds a COMMITTED seed for their next drop: the hash is
   shown before they drop, that seed decides the ball, it is
   revealed with the result, and a fresh one is committed at once.
   The house therefore cannot pick a seed after seeing the stake.

   The nine buckets pay

     x4  x1.8  x1.3  x1.15  x0.2  x1.15  x1.3  x1.8  x4

   which returns 98.6% — near fair, like the rest of the casino.
   The shape is chosen so wins are FREQUENT: every bucket but the
   middle one pays more than the stake, so 73% of drops come
   back ahead, and the middle (1 in 4) is where the house's small cut
   lives. The edges are 1 in 256 each, so the top prize lands about
   once in 128 drops. x4 is deliberately low: on the 20 ZC maximum it
   pays 80, because a ball nobody can influence should not produce the
   biggest win on the site.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../../picks/_lib.js";
import { sha256, randomSeed, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "../_engine.js";

export const ROWS = 8;
export const BUCKETS = ROWS + 1;
export const PAYOUTS = [4, 1.8, 1.3, 1.15, 0.2, 1.15, 1.3, 1.8, 4];
export const MAX_MULTIPLIER = Math.max(...PAYOUTS);

let ready = false;
export async function ensurePlinko(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS plinko_drops (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      stake INTEGER NOT NULL CHECK (stake >= 1),
      path TEXT NOT NULL,
      bucket INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_plinko_user ON plinko_drops (user_id, created_at)`),
    // One committed seed per player, waiting to be used by their next drop.
    db.prepare(`CREATE TABLE IF NOT EXISTS plinko_commits (
      user_id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
  ready = true;
}

/** The seed this player's next drop will use, made now if there isn't one. */
export async function commitFor(db, userId) {
  const existing = await db.prepare(`SELECT * FROM plinko_commits WHERE user_id = ?`).bind(userId).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT INTO plinko_commits (user_id, seed, hash) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING`)
    .bind(userId, seed, hash)
    .run();
  return db.prepare(`SELECT * FROM plinko_commits WHERE user_id = ?`).bind(userId).first();
}

/** Replaces a used seed with a fresh commitment for the next drop. */
export async function rotateCommit(db, userId) {
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT INTO plinko_commits (user_id, seed, hash, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET seed = excluded.seed, hash = excluded.hash, created_at = CURRENT_TIMESTAMP`)
    .bind(userId, seed, hash)
    .run();
  return { seed, hash };
}

/** The ball's path: one step per row, "R" or "L", from the seed alone. */
export async function pathFor(seed) {
  let out = "";
  for (let i = 0; i < ROWS; i += 1) {
    const h = await sha256(`${seed}:${i}`);
    out += parseInt(h.slice(0, 8), 16) % 2 ? "R" : "L";
  }
  return out;
}

/** Where a path lands: the number of rights, 0..8. */
export const bucketOf = (path) => String(path).split("").filter((c) => c === "R").length;

export const multiplierFor = (bucket) => PAYOUTS[bucket] ?? 0;

/** How likely each bucket is, for the page's odds column. */
export function oddsTable() {
  const choose = (n, k) => { let r = 1; for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1); return Math.round(r); };
  const total = 2 ** ROWS;
  return PAYOUTS.map((multiplier, bucket) => ({
    bucket,
    multiplier,
    ways: choose(ROWS, bucket),
    chance: choose(ROWS, bucket) / total
  }));
}

export function publicDrop(d) {
  return {
    id: d.id,
    stake: Number(d.stake),
    path: String(d.path),
    bucket: Number(d.bucket),
    multiplier: Number(d.multiplier),
    payout: Number(d.payout || 0),
    profit: Number(d.payout || 0) - Number(d.stake),
    hash: d.hash,
    seed: d.seed,
    at: String(d.created_at).replace(" ", "T") + "Z"
  };
}

export async function dropsLastHour(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM plinko_drops WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256 };

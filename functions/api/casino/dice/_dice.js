/* DICE (2026-09-19) — an EastScape-only table: it has endpoints here so it
   plays for real ZCoins under the casino's rules, and no page or floor
   card on eastcoin.vip.

   Pick a number from MIN_TARGET to MAX_TARGET; the dice roll 1 to 100; you
   win if the roll is UNDER your number. A target of T wins (T-1) times in
   100, so the FAIR price is 100/(T-1) and that is what is quoted. The
   play's own edge (edgeFor, 96-104%, mean 1) multiplies in when it pays,
   exactly as it does for the coin and the wheel. Lowest target 5 is a
   1-in-25 shot at x25: 500 on the 20 ZC maximum, the same ceiling Plinko
   and Mines sit under.

   Fairness is Plinko's: a roll has no decisions in it, so each player
   holds a committed seed for their NEXT roll (dice_commits, hash shown
   before the bet, seed revealed with the result, rotated at once). The
   roll is sha256(seed:dice) as a fraction of 100. */

import { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256, edgeFor } from "../_engine.js";

export const MIN_TARGET = 5;
export const MAX_TARGET = 95;
export const MAX_MULTIPLIER = 100 / (MIN_TARGET - 1);

let ready = false;
export async function ensureDice(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS dice_rolls (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      stake INTEGER NOT NULL CHECK (stake >= 1),
      target INTEGER NOT NULL,
      roll INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      payout INTEGER NOT NULL DEFAULT 0,
      edge REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_dice_user ON dice_rolls (user_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_dice_recent ON dice_rolls (created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS dice_commits (
      user_id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
  ready = true;
}

export async function commitFor(db, userId) {
  const existing = await db.prepare(`SELECT * FROM dice_commits WHERE user_id = ?`).bind(userId).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db.prepare(`INSERT INTO dice_commits (user_id, seed, hash) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING`).bind(userId, seed, hash).run();
  return db.prepare(`SELECT * FROM dice_commits WHERE user_id = ?`).bind(userId).first();
}

export async function rotateCommit(db, userId) {
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT INTO dice_commits (user_id, seed, hash, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET seed = excluded.seed, hash = excluded.hash, created_at = CURRENT_TIMESTAMP`)
    .bind(userId, seed, hash)
    .run();
  return { seed, hash };
}

/** The roll, 1 to 100, from the seed alone. */
export async function rollFor(seed) {
  const h = await sha256(`${seed}:dice`);
  return Math.floor((parseInt(h.slice(0, 8), 16) / 0x100000000) * 100) + 1;
}

/** The fair price of a target: what a win returns per 1 staked, before the play's edge. */
export const fairFor = (target) => 100 / (target - 1);

export function publicRoll(d) {
  return {
    id: d.id, stake: Number(d.stake), target: Number(d.target), roll: Number(d.roll), won: Number(d.roll) < Number(d.target),
    multiplier: Number(d.multiplier), payout: Number(d.payout || 0), profit: Number(d.payout || 0) - Number(d.stake),
    hash: d.hash, seed: d.seed, at: String(d.created_at).replace(" ", "T") + "Z"
  };
}

export async function rollsLastHour(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM dice_rolls WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256, edgeFor };

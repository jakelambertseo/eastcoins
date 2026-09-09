/* ============================================================
   EastCoin Casino — Coin Flip

   The simplest shared game there is. Rounds run on the clock, not
   on a server timer, so every viewer and every request agrees on
   which round it is without anything having to stay awake:

     round n   opens at   n * 30s
               flips at   n * 30s + 15s     (15s of betting)
               ends at    n * 30s + 30s     (15s to look at the result)

   Heads pays 2×, tails pays 2×, no edge. The result of a round is
   fixed the moment the round row is created — a random seed whose
   hash is shown while bets are open and revealed after the flip —
   so nothing decided after the bets are in can change it.

   Money goes through the same wallet path Picks uses, with the
   same idempotency keys, so a double-click cannot charge twice and
   a retried settlement cannot pay twice.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../picks/_lib.js";

export const CYCLE_MS = 30 * 1000;
export const BET_MS = 15 * 1000;
export const MAX_BET = 20;
export const MAX_BETS_PER_HOUR = 10;
export const MIN_BET = 1;
export const ROOM_WINDOW_MS = 60 * 1000;

let schemaReady = false;

/** Tables live in D1 next to Picks. Created on first use so nothing has to be run by hand. */
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS coin_rounds (
      no INTEGER PRIMARY KEY,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      result TEXT,
      settled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS coin_bets (
      id TEXT PRIMARY KEY,
      round_no INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('heads','tails')),
      wager INTEGER NOT NULL CHECK (wager >= 1),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','WON','LOST','FAILED')),
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (round_no, user_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_coin_bets_round ON coin_bets (round_no)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS coin_presence (
      user_id TEXT PRIMARY KEY,
      seen_at INTEGER NOT NULL
    )`)
  ]);
  schemaReady = true;
}

/* ---------------------------------------------------------- clock */

export function roundAt(now = Date.now()) {
  const no = Math.floor(now / CYCLE_MS);
  const opensAt = no * CYCLE_MS;
  const flipsAt = opensAt + BET_MS;
  const endsAt = opensAt + CYCLE_MS;
  return { no, opensAt, flipsAt, endsAt, phase: now < flipsAt ? "bets" : "result" };
}

/* ---------------------------------------------------------- fairness */

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSeed() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** heads or tails, from the seed alone: the low bit of sha256(seed + ":flip"). */
export async function resultOf(seed) {
  const h = await sha256(`${seed}:flip`);
  return parseInt(h.slice(-1), 16) % 2 === 0 ? "heads" : "tails";
}

/** The round's row, created with its seed the first time anyone looks. */
export async function ensureRound(db, no) {
  const existing = await db.prepare(`SELECT * FROM coin_rounds WHERE no = ?`).bind(no).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT OR IGNORE INTO coin_rounds (no, seed, hash) VALUES (?, ?, ?)`)
    .bind(no, seed, hash)
    .run();
  return db.prepare(`SELECT * FROM coin_rounds WHERE no = ?`).bind(no).first();
}

/* ---------------------------------------------------------- settlement */

/**
 * Settles one round if its flip time has passed and nobody has yet.
 * The UPDATE is the lock: only the request that flips result from NULL
 * pays anyone. Payouts are idempotent per bet, so a crash mid-way is
 * finished by the next caller rather than doubled.
 */
export async function settleRound(env, db, no, now = Date.now()) {
  const { flipsAt } = { flipsAt: no * CYCLE_MS + BET_MS };
  if (now < flipsAt) return null;

  const round = await ensureRound(db, no);
  let result = round.result;

  if (!result) {
    result = await resultOf(round.seed);
    const claimed = await db
      .prepare(`UPDATE coin_rounds SET result = ?, settled_at = CURRENT_TIMESTAMP WHERE no = ? AND result IS NULL`)
      .bind(result, no)
      .run();
    if (!claimed.meta?.changes) {
      result = (await db.prepare(`SELECT result FROM coin_rounds WHERE no = ?`).bind(no).first())?.result || result;
    }
  }

  // Pay whoever is still ACTIVE on the winning side; mark the rest lost.
  // Re-runnable: a bet is only ACTIVE until it has been decided.
  const bets = await db
    .prepare(
      `SELECT b.id, b.user_id, b.side, b.wager, u.twitch_login AS login
         FROM coin_bets b JOIN users u ON u.twitch_id = b.user_id
        WHERE b.round_no = ? AND b.status = 'ACTIVE'`
    )
    .bind(no)
    .all();

  for (const b of bets.results || []) {
    if (b.side !== result) {
      await db.prepare(`UPDATE coin_bets SET status = 'LOST', payout = 0 WHERE id = ? AND status = 'ACTIVE'`).bind(b.id).run();
      continue;
    }
    const payout = Number(b.wager) * 2;
    const opId = newId("op");
    const begun = await beginOperation(db, {
      id: opId,
      idempotencyKey: `COIN:PAY:${no}:${b.user_id}`,
      userId: b.user_id,
      marketId: null,
      pickId: null,
      type: "PAYOUT_CREDIT",
      amount: payout
    });
    if (!begun.ok) continue;   // another caller is paying this one
    const credit = await moveBalance(env, b.login, payout);
    if (!credit.ok) {
      await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
      console.error(`coin: payout failed for ${b.login} round ${no}: ${credit.error}`);
      continue;
    }
    await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
    await db.prepare(`UPDATE coin_bets SET status = 'WON', payout = ? WHERE id = ?`).bind(payout, b.id).run();
  }

  return result;
}

/* ---------------------------------------------------------- reads */

export async function betsFor(db, no) {
  const rows = await db
    .prepare(
      `SELECT b.side, b.wager, b.status, b.payout, b.created_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM coin_bets b JOIN users u ON u.twitch_id = b.user_id
        WHERE b.round_no = ?
        ORDER BY b.created_at ASC`
    )
    .bind(no)
    .all();
  return (rows.results || []).map((r) => ({
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    side: r.side,
    wager: Number(r.wager),
    status: r.status,
    payout: Number(r.payout || 0),
    profit: r.status === "WON" ? Number(r.payout) - Number(r.wager) : r.status === "LOST" ? -Number(r.wager) : 0
  }));
}

export async function roomFor(db, now = Date.now()) {
  const rows = await db
    .prepare(
      `SELECT u.twitch_id, u.twitch_login, u.display_name, u.avatar_url, p.seen_at
         FROM coin_presence p JOIN users u ON u.twitch_id = p.user_id
        WHERE p.seen_at >= ?
        ORDER BY p.seen_at DESC
        LIMIT 60`
    )
    .bind(now - ROOM_WINDOW_MS)
    .all();
  return (rows.results || []).map((r) => ({
    id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(),
    displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "")
  }));
}

/** Bets this person has placed in the last hour, for the rate limit. */
export async function betsLastHour(db, userId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM coin_bets WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`)
    .bind(userId)
    .first();
  return Number(row?.n || 0);
}

export async function touchPresence(db, userId, now = Date.now()) {
  await db
    .prepare(`INSERT INTO coin_presence (user_id, seen_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET seen_at = excluded.seen_at`)
    .bind(userId, now)
    .run();
}

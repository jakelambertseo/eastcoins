/* ============================================================
   EastCoin Casino — the shared-round engine

   One machine for every game the whole room plays together: the
   Wheel, the Horse Race, and whatever comes next. It is the Coin
   Flip's design, made general:

     · rounds run on the wall clock — round n of a game opens at
       n × cycle, closes bets at n × cycle + betWindow, and ends
       at (n + 1) × cycle — so every viewer and every request
       agrees on the round without a timer having to stay awake
     · each round's outcome is fixed by a random seed created
       with the round row; sha256(seed) is shown while bets are
       open and the seed is revealed after, so nothing decided
       after the bets are in can move the result
     · the stake leaves the wallet at bet time through the same
       operations Picks uses, with an idempotency key per person
       per round, so a double click cannot charge twice and a
       retried settlement cannot pay twice
     · fixed house edge in the payout table; no strategy beats it

   Limits shared by every game: 20 ZC a bet, 10 bets an hour per
   game, one bet per person per round.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../picks/_lib.js";

export const MAX_BET = 20;
export const MIN_BET = 1;
export const MAX_BETS_PER_HOUR = 10;
export const ROOM_WINDOW_MS = 60 * 1000;

/* ---------------------------------------------------------- games */

// The wheel: 24 slices alternating red and black share 345 degrees, and
// one slim gold sliver takes the last 15. Red and black pay 2×; gold 8×.
// Red/black return 0.958 of the stake over time; gold, by design, far
// less — it is the long shot people chase, not the smart bet.
const GOLD_DEG = 15;
const WHEEL = (() => {
  const segments = [];
  const each = (360 - GOLD_DEG) / 24;
  let at = 0;
  for (let i = 0; i < 24; i += 1) { segments.push({ color: i % 2 === 0 ? "red" : "black", from: at, to: at + each }); at += each; }
  segments.push({ color: "gold", from: at, to: 360 });
  return segments;
})();

// Four runners with whole-number payouts. Their odds are the fair odds
// for those payouts scaled to sum to one, which leaves about a 4.5%
// edge on every horse: p = (1/pays) / 1.0476.
const RUNNERS = [
  { key: "gold", name: "Gold Rush", pays: 2, color: "#e8bf35" },
  { key: "burgundy", name: "Burgundy", pays: 3, color: "#8e1231" },
  { key: "midnight", name: "Midnight", pays: 7, color: "#8fc3d7" },
  { key: "longshot", name: "Longshot", pays: 14, color: "#4ddb8b" }
].map((r, _, all) => ({ ...r, p: (1 / r.pays) / all.reduce((n, x) => n + 1 / x.pays, 0) }));

// Nobody takes more than this out of the casino in any rolling hour.
// Past it, new bets and deals are refused until the hour rolls on.
export const HOUR_WIN_CAP = 300;

export const GAMES = {
  wheel: {
    key: "wheel",
    name: "Wheel",
    cycleMs: 60 * 1000,
    betMs: 40 * 1000,
    picks: ["red", "black", "gold"],
    payout: { red: 2, black: 2, gold: 8 },
    segments: WHEEL,
    /** Where the pointer lands, in degrees from the top, from the seed alone. */
    async outcome(seed) {
      const h = await sha256(`${seed}:wheel`);
      const angle = (parseInt(h.slice(0, 8), 16) / 0x100000000) * 360;
      const idx = WHEEL.findIndex((s) => angle >= s.from && angle < s.to);
      const slice = idx === -1 ? WHEEL.length - 1 : idx;
      return { slice, color: WHEEL[slice].color, angle: Math.round(angle * 100) / 100 };
    },
    wins: (pick, result) => pick === result.color,
    describe: (result) => result.color
  },
  race: {
    key: "race",
    // In the stable while the animation and pacing get another look.
    paused: true,
    name: "Horse Race",
    cycleMs: 60 * 1000,
    betMs: 40 * 1000,
    picks: RUNNERS.map((r) => r.key),
    payout: Object.fromEntries(RUNNERS.map((r) => [r.key, r.pays])),
    runners: RUNNERS,
    /** The winner, from the seed: a uniform draw against the runners' odds. */
    async outcome(seed) {
      const h = await sha256(`${seed}:race`);
      const u = parseInt(h.slice(0, 8), 16) / 0x100000000;
      let acc = 0;
      for (const r of RUNNERS) { acc += r.p; if (u < acc) return { winner: r.key, draw: u }; }
      return { winner: RUNNERS[RUNNERS.length - 1].key, draw: u };
    },
    wins: (pick, result) => pick === result.winner,
    describe: (result) => RUNNERS.find((r) => r.key === result.winner)?.name || result.winner
  }
};

export function gameFor(key) {
  return GAMES[String(key || "").toLowerCase()] || null;
}

/* ---------------------------------------------------------- schema */

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS casino_rounds (
      game TEXT NOT NULL,
      no INTEGER NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      result TEXT,
      settled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (game, no)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS casino_bets (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      round_no INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      pick TEXT NOT NULL,
      wager INTEGER NOT NULL CHECK (wager >= 1),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','WON','LOST','FAILED')),
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (game, round_no, user_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_bets_round ON casino_bets (game, round_no)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_bets_user ON casino_bets (user_id, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS casino_presence (
      game TEXT NOT NULL,
      user_id TEXT NOT NULL,
      seen_at INTEGER NOT NULL,
      PRIMARY KEY (game, user_id)
    )`)
  ]);
  schemaReady = true;
}

/* ---------------------------------------------------------- clock */

export function roundAt(game, now = Date.now()) {
  const no = Math.floor(now / game.cycleMs);
  const opensAt = no * game.cycleMs;
  const closesAt = opensAt + game.betMs;
  const endsAt = opensAt + game.cycleMs;
  return { no, opensAt, closesAt, endsAt, phase: now < closesAt ? "bets" : "result" };
}

/* ---------------------------------------------------------- fairness */

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSeed() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureRound(db, game, no) {
  const existing = await db.prepare(`SELECT * FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, no).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db.prepare(`INSERT OR IGNORE INTO casino_rounds (game, no, seed, hash) VALUES (?, ?, ?, ?)`).bind(game.key, no, seed, hash).run();
  return db.prepare(`SELECT * FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, no).first();
}

const parseResult = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };

/* ---------------------------------------------------------- settlement */

/**
 * Settles one round once its bet window has closed. The UPDATE that
 * writes the result is the lock: only the caller that flips it from
 * NULL runs first, and payouts are idempotent per bet regardless, so
 * a crash mid-way is finished by the next caller rather than doubled.
 */
export async function settleRound(env, db, game, no, now = Date.now()) {
  const closesAt = no * game.cycleMs + game.betMs;
  if (now < closesAt) return null;

  const round = await ensureRound(db, game, no);
  let result = parseResult(round.result);
  if (!result) {
    result = await game.outcome(round.seed);
    const claimed = await db
      .prepare(`UPDATE casino_rounds SET result = ?, settled_at = CURRENT_TIMESTAMP WHERE game = ? AND no = ? AND result IS NULL`)
      .bind(JSON.stringify(result), game.key, no)
      .run();
    if (!claimed.meta?.changes) {
      const again = await db.prepare(`SELECT result FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, no).first();
      result = parseResult(again?.result) || result;
    }
  }

  const bets = await db
    .prepare(
      `SELECT b.id, b.user_id, b.pick, b.wager, u.twitch_login AS login
         FROM casino_bets b JOIN users u ON u.twitch_id = b.user_id
        WHERE b.game = ? AND b.round_no = ? AND b.status = 'ACTIVE'`
    )
    .bind(game.key, no)
    .all();

  for (const b of bets.results || []) {
    if (!game.wins(b.pick, result)) {
      await db.prepare(`UPDATE casino_bets SET status = 'LOST', payout = 0 WHERE id = ? AND status = 'ACTIVE'`).bind(b.id).run();
      continue;
    }
    const payout = Math.floor(Number(b.wager) * Number(game.payout[b.pick] || 0));
    const opId = newId("op");
    const begun = await beginOperation(db, {
      id: opId,
      idempotencyKey: `CASINO:PAY:${game.key}:${no}:${b.user_id}`,
      userId: b.user_id, marketId: null, pickId: null,
      type: "PAYOUT_CREDIT", amount: payout
    });
    if (!begun.ok) continue;
    const credit = await moveBalance(env, b.login, payout);
    if (!credit.ok) {
      await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
      console.error(`casino ${game.key}: payout failed for ${b.login} round ${no}: ${credit.error}`);
      continue;
    }
    await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
    await db.prepare(`UPDATE casino_bets SET status = 'WON', payout = ? WHERE id = ?`).bind(payout, b.id).run();
  }
  return result;
}

/* ---------------------------------------------------------- reads */

export async function betsFor(db, game, no) {
  const rows = await db
    .prepare(
      `SELECT b.pick, b.wager, b.status, b.payout, b.created_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM casino_bets b JOIN users u ON u.twitch_id = b.user_id
        WHERE b.game = ? AND b.round_no = ?
        ORDER BY b.created_at ASC`
    )
    .bind(game.key, no)
    .all();
  return (rows.results || []).map((r) => ({
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    pick: r.pick,
    wager: Number(r.wager),
    status: r.status,
    payout: Number(r.payout || 0),
    profit: r.status === "WON" ? Number(r.payout) - Number(r.wager) : r.status === "LOST" ? -Number(r.wager) : 0
  }));
}

export async function roomFor(db, game, now = Date.now()) {
  const rows = await db
    .prepare(
      `SELECT u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM casino_presence p JOIN users u ON u.twitch_id = p.user_id
        WHERE p.game = ? AND p.seen_at >= ?
        ORDER BY p.seen_at DESC LIMIT 60`
    )
    .bind(game.key, now - ROOM_WINDOW_MS)
    .all();
  return (rows.results || []).map((r) => ({
    id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(),
    displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "")
  }));
}

export async function betsLastHour(db, game, userId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM casino_bets WHERE game = ? AND user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`)
    .bind(game.key, userId)
    .first();
  return Number(row?.n || 0);
}

export async function touchPresence(db, game, userId, now = Date.now()) {
  await db
    .prepare(`INSERT INTO casino_presence (game, user_id, seen_at) VALUES (?, ?, ?) ON CONFLICT(game, user_id) DO UPDATE SET seen_at = excluded.seen_at`)
    .bind(game.key, userId, now)
    .run();
}

/** Public shape of a game's config, for the page. */
export function publicConfig(game, canBet) {
  return {
    key: game.key, name: game.name,
    maxBet: MAX_BET, minBet: MIN_BET, maxPerHour: MAX_BETS_PER_HOUR,
    betSeconds: game.betMs / 1000, cycleSeconds: game.cycleMs / 1000,
    picks: game.picks, payout: game.payout,
    segments: game.segments || undefined,
    runners: game.runners ? game.runners.map((r) => ({ key: r.key, name: r.name, pays: r.pays, p: Math.round(r.p * 1000) / 1000, color: r.color })) : undefined,
    hourCap: HOUR_WIN_CAP,
    paused: Boolean(game.paused),
    canBet: canBet && !game.paused
  };
}

/* ---------------------------------------------------------- the hourly cap */

/** Net won or lost across every casino game in the last hour. */
export async function hourlyNet(db, userId) {
  const q = async (sql) => {
    try { const r = await db.prepare(sql).bind(userId).first(); return Number(r?.net || 0); } catch { return 0; }
  };
  const coin = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM coin_bets WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`);
  const shared = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM casino_bets WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`);
  const hilo = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM hilo_games WHERE user_id = ? AND datetime(updated_at) >= datetime('now', '-1 hour')`);
  return coin + shared + hilo;
}

/** Whether this person may place another bet, and where they stand. */
export async function capCheck(db, userId) {
  const net = await hourlyNet(db, userId);
  return { net, cap: HOUR_WIN_CAP, blocked: net >= HOUR_WIN_CAP };
}

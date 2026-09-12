/* ============================================================
   EastCoin Casino — the two player-versus-player tables

     roulette   Russian Roulette: one live round, one loser, the
                rest split their stake.
     standing   Last One Standing: one player knocked out at a
                time, the last one takes the whole pot.

   Both work the same way. Nobody picks a player count. The first
   person to sit down opens a lobby and starts a sixty-second clock;
   whoever is in when it hits zero plays. If only one person turned
   up they are refunded and the table clears. The buy-in is fixed —
   20 ZC, no other option — so every seat is worth the same and the
   payouts are a function of nothing but how many sat down.

   The result is settled the moment the clock runs out, from a seed
   whose hash was shown while the lobby was open. Payouts run right
   then, server-side, and the page plays the result back afterwards.
   Nothing about the outcome waits for anyone's browser, so closing
   the tab changes nothing.

   Russian Roulette past two players: the cylinder gets one chamber
   per player, doubled up until there are at least six, so every
   seat pulls the same number of times and every seat is on exactly
   1 in N. A fixed six-chamber cylinder breaks the moment five people
   sit down. One live round in a cylinder that empties completely
   means there is always exactly one loser.

   Settlement is triggered by whoever asks — a state poll, a join, or
   the casino floor — and is claimed with a conditional UPDATE so two
   pollers cannot both pay a round. Every payout is idempotent per
   entry, so a retry after a crash pays nobody twice.

   These count toward HOUR_WIN_CAP through hourlyNet(), which had to
   learn about pvp_entries. Any new table must be added there or it
   escapes the cap.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../../picks/_lib.js";
import { sha256, randomSeed, MAX_BETS_PER_HOUR } from "../_engine.js";

export const STAKE = 20;
export const LOBBY_MS = 60 * 1000;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
// A round stuck in SETTLING this long is assumed to have crashed
// mid-way and may be claimed again. Payouts are idempotent, so this
// is safe; it just has to be longer than any honest settlement.
const STUCK_MS = 2 * 60 * 1000;

export const GAMES = {
  roulette: { key: "roulette", name: "Russian Roulette" },
  standing: { key: "standing", name: "Last One Standing" }
};
export const gameFor = (key) => GAMES[String(key || "").toLowerCase()] || null;

let ready = false;
export async function ensurePvp(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS pvp_rounds (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY','SETTLING','SETTLED','VOID')),
      opens_at INTEGER NOT NULL,
      starts_at INTEGER NOT NULL,
      settled_at INTEGER,
      players INTEGER NOT NULL DEFAULT 0,
      pot INTEGER NOT NULL DEFAULT 0,
      result TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_pvp_rounds_due ON pvp_rounds (game, status, starts_at)`),
    // At most one open lobby per game. A second INSERT fails and the
    // caller re-reads, which is how two people sitting down in the same
    // instant end up at the same table instead of two.
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_one_lobby ON pvp_rounds (game) WHERE status = 'LOBBY'`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pvp_entries (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      game TEXT NOT NULL,
      user_id TEXT NOT NULL,
      stake INTEGER NOT NULL,
      seat INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN' CHECK (status IN ('IN','WON','LOST','REFUNDED')),
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_entry_once ON pvp_entries (round_id, user_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_pvp_entries_round ON pvp_entries (round_id, seat)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_pvp_entries_user ON pvp_entries (user_id, updated_at)`)
  ]);
  ready = true;
}

/* ------------------------------------------------------------ the maths */

/** One chamber per player, doubled up until there are at least six. */
export const chambersFor = (n) => n * Math.max(1, Math.ceil(6 / n));

/**
 * The whole result from the seed and the seats in join order. Pure:
 * the same seed and seats always give the same answer, which is what
 * lets anyone check a round after the seed is revealed.
 */
export async function outcomeFor(game, seed, seats) {
  const n = seats.length;
  if (game.key === "roulette") {
    const chambers = chambersFor(n);
    const h = await sha256(`${seed}:roulette`);
    const live = parseInt(h.slice(0, 8), 16) % chambers;
    // Chamber c is pulled by seat c mod n, round the table.
    return { chambers, live, loser: live % n };
  }
  // Last One Standing: Fisher–Yates over the seats, each swap from its
  // own hash. The order IS the elimination order; the last one is the winner.
  const order = seats.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const h = await sha256(`${seed}:shuffle:${i}`);
    const j = parseInt(h.slice(0, 8), 16) % (i + 1);
    const keep = order[i];
    order[i] = order[j];
    order[j] = keep;
  }
  return { order, winner: order[order.length - 1] };
}

/**
 * What each seat is paid back, by seat index. 0 means the stake is gone.
 *
 * Roulette: the loser's stake is split between the survivors; the
 * rounding remainder stays with the house. Standing: the winner takes
 * the whole pot and the house takes nothing.
 */
export function payoutsFor(game, outcome, n) {
  const pay = new Array(n).fill(0);
  if (game.key === "roulette") {
    const share = STAKE + Math.floor(STAKE / (n - 1));
    for (let i = 0; i < n; i += 1) if (i !== outcome.loser) pay[i] = share;
    return pay;
  }
  pay[outcome.winner] = STAKE * n;
  return pay;
}

/* ------------------------------------------------------------ reads */

const person = (r) => ({
  login: String(r.twitch_login || "").toLowerCase(),
  displayName: String(r.display_name || r.twitch_login || ""),
  avatar: String(r.avatar_url || "")
});

export async function lobbyFor(db, game) {
  return db.prepare(`SELECT * FROM pvp_rounds WHERE game = ? AND status = 'LOBBY' ORDER BY opens_at ASC LIMIT 1`).bind(game.key).first();
}

/** A round's entries in seat order, with the people attached. */
export async function entriesFor(db, roundId) {
  const rows = await db
    .prepare(
      `SELECT e.id, e.user_id, e.seat, e.status, e.stake, e.payout, u.twitch_login, u.display_name, u.avatar_url
         FROM pvp_entries e JOIN users u ON u.twitch_id = e.user_id
        WHERE e.round_id = ?
        ORDER BY e.seat ASC, e.created_at ASC, e.id ASC`
    )
    .bind(roundId)
    .all();
  return (rows.results || []).map((r) => ({
    id: r.id, user_id: String(r.user_id), seat: Number(r.seat), status: r.status,
    stake: Number(r.stake), payout: Number(r.payout || 0), ...person(r)
  }));
}

export async function joinsLastHour(db, game, userId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM pvp_entries WHERE game = ? AND user_id = ? AND created_at >= datetime('now', '-1 hour')`)
    .bind(game.key, userId)
    .first();
  return Number(row?.n || 0);
}

const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export function publicRound(row, entries, { revealSeed = false, viewerId = null } = {}) {
  if (!row) return null;
  const over = row.status === "SETTLED" || row.status === "VOID";
  return {
    id: row.id,
    game: row.game,
    status: row.status,
    hash: row.hash,
    seed: revealSeed && over ? row.seed : null,
    opensAt: Number(row.opens_at),
    startsAt: Number(row.starts_at),
    settledAt: row.settled_at ? Number(row.settled_at) : null,
    stake: STAKE,
    pot: STAKE * entries.length,
    players: entries.map((e) => ({ login: e.login, displayName: e.displayName, avatar: e.avatar, seat: e.seat, status: e.status, payout: e.payout })),
    youIn: viewerId ? entries.some((e) => e.user_id === String(viewerId)) : false,
    result: over ? parse(row.result) : null
  };
}

/* ------------------------------------------------------------ writes */

/** Opens a lobby, or hands back the one someone opened a moment ago. */
export async function openLobby(db, game, now = Date.now()) {
  const seed = randomSeed();
  const hash = await sha256(seed);
  try {
    await db
      .prepare(`INSERT INTO pvp_rounds (id, game, seed, hash, status, opens_at, starts_at) VALUES (?, ?, ?, ?, 'LOBBY', ?, ?)`)
      .bind(newId("pr"), game.key, seed, hash, now, now + LOBBY_MS)
      .run();
  } catch {
    /* the unique index says a lobby already exists — use that one */
  }
  return lobbyFor(db, game);
}

async function credit(env, db, entry, amount, key) {
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: key, userId: entry.user_id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount
  });
  if (!begun.ok) return { ok: true, duplicate: true };   // already done
  const moved = await moveBalance(env, entry.login, amount);
  if (!moved.ok) {
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: moved.error });
    return { ok: false };
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: moved.balance });
  return { ok: true };
}

async function payEntry(env, db, entry, payout) {
  if (payout > 0) {
    const paid = await credit(env, db, entry, payout, `CASINO:PVP:PAY:${entry.id}`);
    if (!paid.ok) return;   // left IN for the next attempt; the op row says why
  }
  await db
    .prepare(`UPDATE pvp_entries SET status = ?, payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'IN'`)
    .bind(payout > 0 ? "WON" : "LOST", payout, entry.id)
    .run();
}

async function refundEntry(env, db, entry) {
  const back = await credit(env, db, entry, entry.stake, `CASINO:PVP:REFUND:${entry.id}`);
  if (!back.ok) return;
  await db
    .prepare(`UPDATE pvp_entries SET status = 'REFUNDED', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'IN'`)
    .bind(entry.stake, entry.id)
    .run();
}

/**
 * Settles every round of this game whose clock has run out. Safe to call
 * from anywhere and as often as you like: a round is claimed with a
 * conditional UPDATE first, so two callers cannot both pay it, and a
 * round left in SETTLING for longer than any honest settlement takes is
 * assumed crashed and picked up again.
 */
export async function settleDue(env, db, game, now = Date.now()) {
  const due = await db
    .prepare(
      `SELECT * FROM pvp_rounds
        WHERE game = ? AND starts_at <= ?
          AND (status = 'LOBBY' OR (status = 'SETTLING' AND starts_at < ?))
        ORDER BY starts_at ASC LIMIT 3`
    )
    .bind(game.key, now, now - STUCK_MS)
    .all();

  const done = [];
  for (const r of due.results || []) {
    const claim = await db
      .prepare(`UPDATE pvp_rounds SET status = 'SETTLING' WHERE id = ? AND status IN ('LOBBY', 'SETTLING')`)
      .bind(r.id)
      .run();
    if (!claim.meta?.changes) continue;

    const entries = await entriesFor(db, r.id);

    if (entries.length < MIN_PLAYERS) {
      for (const e of entries) await refundEntry(env, db, e);
      await db
        .prepare(`UPDATE pvp_rounds SET status = 'VOID', settled_at = ?, players = ?, pot = 0 WHERE id = ?`)
        .bind(now, entries.length, r.id)
        .run();
      done.push({ id: r.id, status: "VOID", players: entries.length });
      continue;
    }

    const outcome = await outcomeFor(game, r.seed, entries.map((e) => e.user_id));
    const pays = payoutsFor(game, outcome, entries.length);
    for (let i = 0; i < entries.length; i += 1) await payEntry(env, db, entries[i], pays[i]);
    await db
      .prepare(`UPDATE pvp_rounds SET status = 'SETTLED', settled_at = ?, players = ?, pot = ?, result = ? WHERE id = ?`)
      .bind(now, entries.length, STAKE * entries.length, JSON.stringify(outcome), r.id)
      .run();
    done.push({ id: r.id, status: "SETTLED", players: entries.length });
  }
  return done;
}

export { MAX_BETS_PER_HOUR, sha256, randomSeed };

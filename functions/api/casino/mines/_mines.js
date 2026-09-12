/* ============================================================
   EastCoin Casino — Mines

   A per-player game with a committed board. When a game starts the
   server draws a random seed, shows sha256(seed) to the player, and
   hides M bombs among 25 tiles. Where the bombs sit is fixed by the
   seed alone, by shuffling 0..24 with the seed and taking the first
   M of them:

     j = sha256(seed + ":shuffle:" + i) mod (i + 1)     swap i, j
     bombs = the first M of the shuffled order

   So the board was decided before the first tile was touched, and
   the seed is revealed when the game ends so anyone can lay it out
   again.

   Every safe tile raises the multiplier. With S safe tiles left of
   25, the fair price of surviving k picks is

     C(25,k) / C(S,k)

   and the house keeps 1% of it, the same near-fair edge Higher or
   Lower takes. Three bombs: one tile ×1.13, five tiles ×2, ten ×5.
   Cash out any time after the first safe tile. A bomb ends the run
   and the stake is gone. The run pays out on its own once every safe
   tile is uncovered, or at the last rung still under the ×125 ceiling —
   it stops below the ceiling rather than being clamped down to it, so
   the 1% edge holds wherever someone chooses to stop. Three bombs run
   out of road at 19 tiles (×113.85), ten bombs at 7 (×73.95); the biggest
   board pays 2,277 on a 20 ZC stake, about once in 115 runs
   that go the distance.

   One live game per person; stake and per-hour limits are the
   casino's, and winnings count toward the same hourly cap.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../../picks/_lib.js";
import { sha256, randomSeed, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "../_engine.js";

export const TILES = 25;
export const EDGE_RETURN = 0.99;
// x125, raised from x25 on 2026-09-12 (which had itself come down from x50
// the same day) because Mines was asked for a real jackpot: about 2,500 on
// the 20 ZC maximum. The ladder is chunky — each extra tile roughly doubles
// the payout — so the ceiling and the prize are not the same number and
// cannot be dialled in exactly. x125 lands the best board at 2,277; the next
// rung up would be 3,328, which overshoots. Nothing about the ODDS changes:
// every rung still returns 99%, because the run stops below the ceiling
// rather than being clamped to it.
export const MAX_MULTIPLIER = 125;
export const MIN_MINES = 1;
// Ten is the ceiling on purpose. Past it the ladder leaps instead of
// climbing — twenty bombs goes ×4.8, ×28.8, ×220.8 — and one 20 ZC
// board could pay thousands, which the hourly cap cannot claw back
// because it only blocks new bets.
export const MAX_MINES = 10;
export const DEFAULT_MINES = 3;

let ready = false;
export async function ensureMines(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS mines_games (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      stake INTEGER NOT NULL CHECK (stake >= 1),
      mines INTEGER NOT NULL CHECK (mines >= 1 AND mines <= 24),
      picks TEXT NOT NULL DEFAULT '[]',
      multiplier REAL NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'LIVE' CHECK (status IN ('LIVE','CASHED','BUST')),
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_mines_user ON mines_games (user_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_mines_live ON mines_games (status, updated_at)`)
  ]);
  ready = true;
}

/** Where the bombs are, from the seed alone. Always the same for a seed. */
export async function bombsFor(seed, mines) {
  const order = [];
  for (let i = 0; i < TILES; i += 1) order.push(i);
  // Fisher-Yates, with each swap decided by its own hash.
  for (let i = TILES - 1; i > 0; i -= 1) {
    const h = await sha256(`${seed}:shuffle:${i}`);
    const j = parseInt(h.slice(0, 8), 16) % (i + 1);
    const keep = order[i];
    order[i] = order[j];
    order[j] = keep;
  }
  return order.slice(0, mines).sort((a, b) => a - b);
}

/**
 * What the stake is worth after k safe tiles, with M bombs.
 *
 * Fair odds are C(25,k)/C(S,k) — the chance of surviving k picks
 * inverted — multiplied out one tile at a time so nothing overflows.
 * The edge is taken once, off the whole price, so cashing out early
 * and cashing out late cost the same 1%.
 */
export function multiplierFor(mines, picks) {
  const safe = TILES - mines;
  if (picks <= 0) return 1;
  if (picks > safe) return null;
  let fair = 1;
  for (let i = 0; i < picks; i += 1) fair *= (TILES - i) / (safe - i);
  return Math.round(EDGE_RETURN * fair * 100) / 100;
}

/**
 * The last tile a board can pay for: the highest rung still at or under
 * the ×125 ceiling.
 *
 * The run auto-cashes here rather than one rung further. Clamping a
 * higher rung down to the ceiling instead would have been a hidden second cut —
 * pushing to the end of a ten-bomb board would return far less than
 * the 99% every other cash-out pays. Stopping below the ceiling keeps
 * the edge at 1% wherever someone chooses to stop.
 */
export function topRung(mines) {
  const safe = TILES - mines;
  let last = 1;
  for (let k = 1; k <= safe; k += 1) {
    if (multiplierFor(mines, k) > MAX_MULTIPLIER) break;
    last = k;
  }
  return last;
}

/** The whole ladder for a bomb count, so the page can show what's ahead. */
export function ladderFor(mines) {
  const out = [];
  for (let k = 1; k <= topRung(mines); k += 1) out.push({ picks: k, multiplier: multiplierFor(mines, k) });
  return out;
}

const parse = (t, fallback) => { try { return JSON.parse(t); } catch { return fallback; } };

export function publicGame(g, { bombs = null } = {}) {
  const picks = parse(g.picks, []);
  const over = g.status !== "LIVE";
  const multiplier = Number(g.multiplier);
  // Nothing is quoted past the last rung the board can pay for.
  const next = over || picks.length >= topRung(Number(g.mines)) ? null : multiplierFor(Number(g.mines), picks.length + 1);
  return {
    id: g.id,
    status: g.status,
    stake: Number(g.stake),
    mines: Number(g.mines),
    tiles: TILES,
    picks,
    safeLeft: TILES - Number(g.mines) - picks.length,
    multiplier,
    next,
    payout: Number(g.payout || 0),
    // What cashing out right now would pay, floored the way it is paid.
    potential: Math.floor(Number(g.stake) * multiplier),
    canCashOut: !over && picks.length > 0,
    hash: g.hash,
    // The board and its seed stay secret while the run is live.
    seed: over ? g.seed : null,
    bombs: over ? bombs : null,
    createdAt: String(g.created_at).replace(" ", "T") + "Z",
    updatedAt: String(g.updated_at).replace(" ", "T") + "Z"
  };
}

export async function liveGameFor(db, userId) {
  return db.prepare(`SELECT * FROM mines_games WHERE user_id = ? AND status = 'LIVE' ORDER BY created_at DESC LIMIT 1`).bind(userId).first();
}

export async function gamesLastHour(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM mines_games WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

/** Pays out a run. Idempotent per game: the operation key is the game id. */
export async function cashOut(env, db, g, login) {
  // A stored multiplier can never legitimately pass the ceiling — the run
  // auto-cashes below it — but clamp anyway so a bad write cannot overpay.
  const payout = Math.floor(Number(g.stake) * Math.min(MAX_MULTIPLIER, Number(g.multiplier)));
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:MINES:PAY:${g.id}`, userId: g.user_id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: payout
  });
  if (!begun.ok) return { ok: false, code: "DUPLICATE" };
  const credit = await moveBalance(env, login, payout);
  if (!credit.ok) {
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    return { ok: false, code: "PAYOUT_FAILED" };
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
  await db.prepare(`UPDATE mines_games SET status = 'CASHED', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`).bind(payout, g.id).run();
  return { ok: true, payout, balance: credit.balance };
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256 };

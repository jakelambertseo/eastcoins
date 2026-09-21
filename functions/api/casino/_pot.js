/* ============================================================
   The Daily Pot — 100 ZC from the house, once a day, at a moment
   nobody can predict.

   How it works
   · Each Chicago day gets one pot row: a random seed, its sha256
     (shown on the floor all day), and a hidden TRIGGER — a point
     somewhere in the day's casino play, 300..2,500 ZC of total stakes,
     fixed by sha256(seed:trigger). The trigger is never sent out while
     the pot is open.
   · Every bet endpoint calls settlePot() after its stake lands. If
     the day's stakes have crossed the trigger, the pot pays right then,
     on that bet. From 11 PM Central the trigger is treated as 0, so
     the first bet of the late hour pays it: 100 ZC leaves the house
     every day someone plays.
   · The winner is DRAWN, not "whoever crossed the line": everyone who
     staked that day is in, weighted by what they staked, from
     sha256(seed:draw) mod total. Spamming small bets near the top buys
     nothing more than the coins they cost.
   · A day nobody plays rolls its amount into the next (200, 300…).
   · The seed is revealed when it pays. /api/casino/verify?game=pot
     replays the trigger and the draw against the stored shares.
   · The house's money, so it is outside HOUR_WIN_CAP: a pot win never
     blocks anyone's next bet, and no bet table carries it.

   Settlement is claimed with a conditional UPDATE (OPEN → SETTLING),
   so two bets landing together cannot both pay, and the credit is
   idempotent per day (CASINO:POT:PAY:<day>).
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../picks/_lib.js";
import { sha256, randomSeed } from "./_engine.js";

export const POT_AMOUNT = 100;
export const TRIGGER_MIN = 300;
export const TRIGGER_MAX = 2500;
export const LATE_HOUR = 23;               // from 11 PM Central, the next bet pays
const CHI = "America/Chicago";

/* ---------------- Chicago days ---------------- */

const chiParts = (ms) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CHI, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
};
export const chicagoDay = (ms) => { const p = chiParts(ms); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
export const chicagoHour = (ms) => chiParts(ms).h;
/** UTC ms of midnight Chicago at the start of the given day, and of the next.
    Chicago's offset is a whole number of hours, so stepping back an hour
    at a time from local noon lands exactly on local midnight — on the
    days the clocks change too (the November day is 25 hours long). */
const HOUR = 3600000;
function midnightUtc(day) {
  const [y, m, d] = day.split("-").map(Number);
  let t = Date.UTC(y, m - 1, d, 18);                 // early afternoon local, always inside the day
  while (chicagoDay(t - HOUR) === day) t -= HOUR;
  return t;
}
export function dayBounds(day) {
  const start = midnightUtc(day);
  const end = midnightUtc(chicagoDay(start + 30 * HOUR));
  return { start, end };
}
const stamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/* ---------------- schema ---------------- */

export async function ensurePot(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS casino_pots (
    day TEXT PRIMARY KEY,
    seed TEXT NOT NULL,
    hash TEXT NOT NULL,
    trigger_at INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    total_stake INTEGER,
    draw INTEGER,
    shares TEXT,
    winner_user_id TEXT,
    winner_login TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  /* when the day was claimed for settling, so a crashed claim can be taken back (see the note beside the claim). Added with a
     forgiving ALTER so an existing table cannot break the request. */
  await db.prepare(`ALTER TABLE casino_pots ADD COLUMN settling_at TEXT`).run().catch(() => {});
}

/* ---------------- the day's play ---------------- */

/** Stakes per user for a Chicago day, across every casino table. */
export async function dayStakes(db, day) {
  const { start, end } = dayBounds(day);
  const a = stamp(start), b = stamp(end);
  const q = (sql) => db.prepare(sql).bind(a, b).all().catch(() => ({ results: [] }));
  const parts = await Promise.all([
    q(`SELECT user_id, SUM(wager) AS s FROM casino_bets WHERE created_at >= ? AND created_at < ? GROUP BY user_id`),
    q(`SELECT user_id, SUM(wager) AS s FROM coin_bets WHERE created_at >= ? AND created_at < ? GROUP BY user_id`),
    q(`SELECT user_id, SUM(stake) AS s FROM hilo_games WHERE created_at >= ? AND created_at < ? GROUP BY user_id`),
    q(`SELECT user_id, SUM(stake) AS s FROM mines_games WHERE created_at >= ? AND created_at < ? GROUP BY user_id`),
    q(`SELECT user_id, SUM(stake) AS s FROM plinko_drops WHERE created_at >= ? AND created_at < ? GROUP BY user_id`),
    q(`SELECT user_id, SUM(stake) AS s FROM scratch_cards WHERE created_at >= ? AND created_at < ? GROUP BY user_id`),
    q(`SELECT user_id, SUM(stake) AS s FROM pvp_entries WHERE created_at >= ? AND created_at < ? AND status <> 'REFUNDED' GROUP BY user_id`)
  ]);
  const by = new Map();
  for (const p of parts) for (const r of p.results || []) {
    const id = String(r.user_id || "");
    if (!id) continue;
    by.set(id, (by.get(id) || 0) + Number(r.s || 0));
  }
  return by;
}

/** One person's stakes for the day — what the pot page needs for "your share". */
export async function viewerStake(db, day, userId) {
  const { start, end } = dayBounds(day);
  const a = stamp(start), b = stamp(end), u = String(userId);
  const q = (sql) => db.prepare(sql).bind(u, a, b).first().then((r) => Number(r?.s || 0)).catch(() => 0);
  const parts = await Promise.all([
    q(`SELECT SUM(wager) AS s FROM casino_bets WHERE user_id = ? AND created_at >= ? AND created_at < ?`),
    q(`SELECT SUM(wager) AS s FROM coin_bets WHERE user_id = ? AND created_at >= ? AND created_at < ?`),
    q(`SELECT SUM(stake) AS s FROM hilo_games WHERE user_id = ? AND created_at >= ? AND created_at < ?`),
    q(`SELECT SUM(stake) AS s FROM mines_games WHERE user_id = ? AND created_at >= ? AND created_at < ?`),
    q(`SELECT SUM(stake) AS s FROM plinko_drops WHERE user_id = ? AND created_at >= ? AND created_at < ?`),
    q(`SELECT SUM(stake) AS s FROM scratch_cards WHERE user_id = ? AND created_at >= ? AND created_at < ?`),
    q(`SELECT SUM(stake) AS s FROM pvp_entries WHERE user_id = ? AND created_at >= ? AND created_at < ? AND status <> 'REFUNDED'`)
  ]);
  return parts.reduce((n, v) => n + v, 0);
}

/* ---------------- the pot row ---------------- */

export async function potFor(db, now = Date.now()) {
  const day = chicagoDay(now);
  let row = await db.prepare(`SELECT * FROM casino_pots WHERE day = ?`).bind(day).first();
  if (row) return row;

  // A day nobody played rolls forward. Anything older still OPEN (no
  // bet after 11 PM either) is folded in the same way.
  const stale = await db.prepare(`SELECT day, amount FROM casino_pots WHERE status = 'OPEN' AND day < ?`).bind(day).all().catch(() => ({ results: [] }));
  let carry = 0;
  for (const s of stale.results || []) {
    const r = await db.prepare(`UPDATE casino_pots SET status = 'ROLLED' WHERE day = ? AND status = 'OPEN'`).bind(s.day).run();
    if (r?.meta?.changes) carry += Number(s.amount || 0);
  }

  const seed = randomSeed();
  const hash = await sha256(seed);
  const trigger = await triggerFor(seed);
  await db
    .prepare(`INSERT OR IGNORE INTO casino_pots (day, seed, hash, trigger_at, amount) VALUES (?, ?, ?, ?, ?)`)
    .bind(day, seed, hash, trigger, POT_AMOUNT + carry)
    .run();
  row = await db.prepare(`SELECT * FROM casino_pots WHERE day = ?`).bind(day).first();
  return row;
}

/** The hidden line, from the seed alone: 300..2,500 ZC of the day's stakes. */
export async function triggerFor(seed) {
  const h = await sha256(`${seed}:trigger`);
  return TRIGGER_MIN + (parseInt(h.slice(0, 8), 16) % (TRIGGER_MAX - TRIGGER_MIN + 1));
}

/** The draw: a point in 0..total-1, from the seed alone. */
export async function drawFor(seed, total) {
  const h = await sha256(`${seed}:draw`);
  return total > 0 ? parseInt(h.slice(0, 8), 16) % total : 0;
}

/** Ranges in a fixed order (by user id), so the same shares always land the same way. */
export function rangesFor(shares) {
  const rows = Object.entries(shares).map(([userId, stake]) => ({ userId, stake: Number(stake) || 0 })).filter((r) => r.stake > 0).sort((a, b) => (a.userId < b.userId ? -1 : 1));
  let at = 0;
  return rows.map((r) => { const from = at; at += r.stake; return { ...r, from, to: at - 1 }; });
}
export const winnerOf = (ranges, draw) => ranges.find((r) => draw >= r.from && draw <= r.to) || null;

/* ---------------- settlement ---------------- */

/** Called after a stake lands. Pays the day's pot if its line has been crossed. */
export async function settlePot(env, db, now = Date.now()) {
  await ensurePot(db);
  const pot = await potFor(db, now);
  if (!pot || pot.status !== "OPEN") return null;

  const stakes = await dayStakes(db, pot.day);
  let total = 0;
  for (const v of stakes.values()) total += v;
  if (total <= 0) return null;
  const late = chicagoHour(now) >= LATE_HOUR;
  if (!late && total < Number(pot.trigger_at)) return null;

  /* Claim it. Two bets landing together: one wins this UPDATE.
     A CRASH USED TO KILL THE DAY'S MONEY. Every named failure below puts the row back to OPEN, but a worker timeout or an
     isolate eviction between here and the credit — a window that contains a StreamElements round trip — left it SETTLING for
     good: settlePot returns early on any status but OPEN, and potFor's roll-forward only sweeps OPEN days, so the amount was
     neither paid nor carried. The PvP tables already reclaim a stalled SETTLING round (pvp/_pvp.js); this is the same guard.
     Safe to re-claim because the payment below is idempotent per day. */
  const claimed = await db
    .prepare(`UPDATE casino_pots SET status = 'SETTLING', settling_at = CURRENT_TIMESTAMP WHERE day = ? AND (status = 'OPEN' OR (status = 'SETTLING' AND settling_at IS NOT NULL AND settling_at < datetime('now', '-2 minutes')))`)
    .bind(pot.day)
    .run();
  if (!claimed?.meta?.changes) return null;

  const shares = Object.fromEntries(stakes);
  const ranges = rangesFor(shares);
  const draw = await drawFor(pot.seed, total);
  const winner = winnerOf(ranges, draw);
  if (!winner) { await db.prepare(`UPDATE casino_pots SET status = 'OPEN' WHERE day = ?`).bind(pot.day).run(); return null; }

  const user = await db.prepare(`SELECT twitch_id, twitch_login, display_name FROM users WHERE twitch_id = ?`).bind(winner.userId).first();
  if (!user?.twitch_login) { await db.prepare(`UPDATE casino_pots SET status = 'OPEN' WHERE day = ?`).bind(pot.day).run(); return null; }

  /* PAY, AND ONLY THEN SAY IT WAS PAID (fixed 2026-09-21). A duplicate idempotency key was being read as "this already ran",
     which is what it means everywhere else — but not here, because the one failure path above deliberately leaves the key
     behind with the row back at OPEN so a later bet retries. On that retry beginOperation refused, the whole credit block was
     skipped, and the code fell straight through to marking the day PAID with a winner and a paid_at. The pot was announced,
     the banner fired, and not one coin moved — and it could not be recovered, because reconcile.js only refunds DEBITs and
     this is a credit. So a refusal now asks what the existing operation actually SAYS, and only a CONFIRMED one counts. */
  const base = `CASINO:POT:PAY:${pot.day}`;
  const reopen = async () => { await db.prepare(`UPDATE casino_pots SET status = 'OPEN' WHERE day = ?`).bind(pot.day).run(); return null; };

  /* HAS THIS DAY ALREADY BEEN PAID? One CONFIRMED credit for the day is the whole answer, and it is what stops a retry paying
     twice — the check is on the day, not on one key, because a retry below deliberately uses a new key. */
  const done = await db
    .prepare(`SELECT id FROM wallet_operations WHERE status = 'CONFIRMED' AND (idempotency_key = ? OR substr(idempotency_key, 1, ?) = ?) LIMIT 1`)
    .bind(base, base.length + 1, `${base}#`)
    .first()
    .catch(() => null);

  if (!done) {
    /* A RETRY NEEDS A KEY OF ITS OWN. The failure path leaves its key behind and puts the day back to OPEN so a later bet
       tries again — but the retry was reusing the same key, beginOperation refused it as a duplicate, the credit block was
       skipped entirely and the code fell through to marking the day PAID. A winner was announced and no coin moved, and the
       reconcile tool could not undo it because it only refunds DEBITs. Numbering the key off the attempts ALREADY RECORDED is
       safe in a way the store's count-of-purchases key is not: every attempt writes a row here, so the number always moves. */
    const tries = await db
      .prepare(`SELECT COUNT(*) AS n FROM wallet_operations WHERE idempotency_key = ? OR substr(idempotency_key, 1, ?) = ?`)
      .bind(base, base.length + 1, `${base}#`)
      .first()
      .catch(() => ({ n: 0 }));
    const n = Number(tries?.n || 0);
    const key = n ? `${base}#${n}` : base;
    const opId = newId("op");
    const begun = await beginOperation(db, { id: opId, idempotencyKey: key, userId: user.twitch_id, marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: Number(pot.amount) });
    if (!begun.ok) return reopen();   // another request is mid-flight on this very key: let it finish
    const moved = await moveBalance(env, user.twitch_login, Number(pot.amount));
    if (!moved.ok) {
      await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: moved.error });
      return reopen();
    }
    await finishOperation(db, opId, "CONFIRMED", { balanceAfter: moved.balance });
  }

  await db
    .prepare(`UPDATE casino_pots SET status = 'PAID', total_stake = ?, draw = ?, shares = ?, winner_user_id = ?, winner_login = ?, paid_at = CURRENT_TIMESTAMP WHERE day = ?`)
    .bind(total, draw, JSON.stringify(shares), user.twitch_id, String(user.twitch_login).toLowerCase(), pot.day)
    .run();
  return { day: pot.day, amount: Number(pot.amount), winner: String(user.twitch_login).toLowerCase(), total, draw };
}

/* ---------------- what the page sees ---------------- */

export async function publicPot(db, now = Date.now(), viewerId = null) {
  // The reads don't depend on each other, so they go out together: the
  // pot row, the day's stakes, and the last winner. One round trip's
  // worth of latency instead of three.
  const t0 = Date.now();
  await ensurePot(db);
  const day = chicagoDay(now);
  const [pot, stakes, last] = await Promise.all([
    potFor(db, now),
    dayStakes(db, day),
    db.prepare(`SELECT p.day, p.amount, p.paid_at, p.winner_login, u.display_name, u.avatar_url FROM casino_pots p LEFT JOIN users u ON u.twitch_id = p.winner_user_id WHERE p.status = 'PAID' ORDER BY p.day DESC LIMIT 1`).first().catch(() => null)
  ]);
  let total = 0;
  for (const v of stakes.values()) total += v;
  const yours = viewerId ? Number(stakes.get(String(viewerId)) || 0) : 0;
  const paid = pot.status === "PAID";
  return {
    day: pot.day,
    amount: Number(pot.amount),
    status: pot.status,
    hash: pot.hash,
    seed: paid ? pot.seed : null,
    trigger: paid ? Number(pot.trigger_at) : null,
    ceiling: TRIGGER_MAX,
    floor: TRIGGER_MIN,
    lateHour: LATE_HOUR,
    play: total,
    players: stakes.size,
    yours,
    share: total > 0 && yours > 0 ? Math.round((yours / total) * 1000) / 10 : 0,
    paidAt: paid ? String(pot.paid_at).replace(" ", "T") + "Z" : null,
    // The face and name come from the same row the last-winner read
    // fetched: when today's pot has paid, today IS the last winner.
    winner: paid ? { login: pot.winner_login, displayName: String(last?.day === pot.day && last?.display_name ? last.display_name : pot.winner_login), avatar: String(last?.day === pot.day ? last?.avatar_url || "" : ""), total: Number(pot.total_stake), draw: Number(pot.draw) } : null,
    last: last ? { day: last.day, amount: Number(last.amount), login: last.winner_login, displayName: String(last.display_name || last.winner_login), avatar: String(last.avatar_url || ""), at: String(last.paid_at).replace(" ", "T") + "Z" } : null,
    ms: Date.now() - t0
  };
}

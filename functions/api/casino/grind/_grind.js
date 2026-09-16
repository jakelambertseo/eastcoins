/* ============================================================
   EastCoin Casino — The Grind (2026-09-16)

   Work, not a bet. Anyone under BROKE_LINE ZCoins can clock in for a
   shift at one of the JOBS below, and each job gives one shift per
   SHIFT_COOLDOWN_MS. It is a way back to the tables for someone who has
   lost it all, not a job.

     clicks   "Clock in" — press one button 100 times. Pays 5 (10 until 2026-09-16 night).
     sort     "Sort the Chips" — a chip comes down the belt marked
              ♠ ♥ ♦ or ♣; put it in the matching tray. 75 of them
              (150 until 2026-09-16 night).
              A wrong tray costs a second's recount. Pays 15, because
              it is far duller: every chip is a decision, about a
              minute of them.

   The jobs keep their own clocks, so both can be worked in the same
   hour (20 ZC). To make them share one shift an hour instead, make
   nextShiftAt ignore the job.

   What keeps it honest. This is the only thing in the casino that
   makes ZCoins out of nothing, so:

     · the SERVER does the counting. Clicks arrive in batches and are
       credited at most one per msPerUnit since the last accepted batch;
       chips are graded one at a time against the shift's own seed
       (chipAt), at most one per msPerUnit, and the page is only ever
       told the chip in front of it. A script can work a shift; it
       cannot work it faster than a person;

     · the broke line is read LIVE from StreamElements when a shift
       STARTS, so grinding can never build a balance past the line plus
       what the jobs pay in an hour;

     · the pay is PAYOUT_CREDIT with key CASINO:GRIND:PAY:<shift id>,
       so a shift pays once however many times its last unit is sent.
       The cooldown runs from done_at, set when a shift completes, even
       if the wallet refused the credit — a failing wallet is not a way
       to chain shifts; that credit shows in the admin Wallet tab.

   It is NOT in hourlyNet (nothing is staked and it has its own hourly
   rule), NOT in the Jackpot's stakes and NOT on the results board.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../../picks/_lib.js";
import { sha256 } from "../_engine.js";

export const BROKE_LINE = 50;
export const SHIFT_COOLDOWN_MS = 60 * 60 * 1000;

export const JOBS = {
  clicks: { key: "clicks", name: "Clock in", units: 100, unitName: "clicks", pay: 5, msPerUnit: 120, batchMax: 25 },
  sort: { key: "sort", name: "Sort the Chips", units: 75, unitName: "chips", pay: 15, msPerUnit: 300, penaltyMs: 1000 }
};
export const jobOf = (key) => JOBS[String(key || "clicks")] || null;

// The first job's own names, which work.js and older pages still use.
export const CLICKS_PER_SHIFT = JOBS.clicks.units;
export const SHIFT_PAY = JOBS.clicks.pay;
export const MIN_MS_PER_CLICK = JOBS.clicks.msPerUnit;
export const BATCH_MAX = JOBS.clicks.batchMax;

export const SUITS = ["♠", "♥", "♦", "♣"];

let ready = false;
export async function ensureGrind(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS grind_shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      clicks INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'WORKING' CHECK (status IN ('WORKING','PAYING','PAID')),
      balance_at_start INTEGER,
      payout INTEGER NOT NULL DEFAULT 0,
      last_click_ms INTEGER NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      done_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    // The shifts feed, newest first.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_done ON grind_shifts (done_at)`),
    // The floor counts who is on shift every few seconds.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_status ON grind_shifts (status, updated_at)`)
  ]);
  // Added with the second job. `clicks` is the units done for every job.
  for (const [col, type] of [["job", "TEXT NOT NULL DEFAULT 'clicks'"], ["seed", "TEXT"], ["penalty_until_ms", "INTEGER NOT NULL DEFAULT 0"], ["misses", "INTEGER NOT NULL DEFAULT 0"]]) {
    await db.prepare(`ALTER TABLE grind_shifts ADD COLUMN ${col} ${type}`).run().catch(() => {});
  }
  // "When did this person last finish THIS job" is the cooldown read.
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_user_job_done ON grind_shifts (user_id, job, done_at)`).run().catch(() => {});
  // One shift being worked per job, however fast "clock in" is pressed.
  // It replaces the first release's one-per-person index.
  await db.prepare(`DROP INDEX IF EXISTS idx_grind_one_working`).run().catch(() => {});
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_grind_one_working_job ON grind_shifts (user_id, job) WHERE status = 'WORKING'`).run().catch(() => {});
  ready = true;
}

export async function workingShift(db, userId, job = "clicks") {
  return db.prepare(`SELECT * FROM grind_shifts WHERE user_id = ? AND job = ? AND status = 'WORKING' LIMIT 1`).bind(userId, job).first();
}

/** When this person may start their next shift at `job` (ms), or 0 if they may now. */
export async function nextShiftAt(db, userId, job = "clicks", now = Date.now()) {
  const row = await db
    .prepare(`SELECT done_at FROM grind_shifts WHERE user_id = ? AND job = ? AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT 1`)
    .bind(userId, job).first();
  if (!row?.done_at) return 0;
  const at = Date.parse(String(row.done_at).replace(" ", "T") + "Z") + SHIFT_COOLDOWN_MS;
  return at > now ? at : 0;
}

export async function recordFor(db, userId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS shifts, COALESCE(SUM(payout), 0) AS earned FROM grind_shifts WHERE user_id = ? AND status = 'PAID'`)
    .bind(userId).first();
  return { shifts: Number(row?.shifts || 0), earned: Number(row?.earned || 0) };
}

/** Chip i of a sorting shift: a suit 0-3, fixed by the shift's seed. */
export async function chipAt(seed, i) {
  const h = await sha256(`${seed}:chip:${i}`);
  return parseInt(h.slice(0, 8), 16) % 4;
}

/** The page's view of a shift. A sorting shift carries only the chip in front of the worker. */
export async function publicShift(s, now = Date.now()) {
  if (!s) return null;
  const job = jobOf(s.job) || JOBS.clicks;
  const out = { id: s.id, job: job.key, clicks: Number(s.clicks), done: Number(s.clicks), of: job.units, status: s.status, payout: Number(s.payout || 0) };
  if (job.key === "sort") {
    out.misses = Number(s.misses || 0);
    out.waitMs = Math.max(0, Number(s.penalty_until_ms || 0) - now);
    out.chip = s.status === "WORKING" && s.seed ? await chipAt(s.seed, Number(s.clicks)) : null;
  }
  return out;
}

export function publicJobs() {
  return Object.fromEntries(Object.values(JOBS).map((j) => [j.key, { ...j }]));
}

export const config = () => ({
  // The first job's figures at the top level, for pages from before the second job.
  clicks: JOBS.clicks.units, pay: JOBS.clicks.pay, cooldownMinutes: SHIFT_COOLDOWN_MS / 60000,
  brokeLine: BROKE_LINE, batchMax: JOBS.clicks.batchMax, msPerClick: JOBS.clicks.msPerUnit,
  jobs: publicJobs(), suits: SUITS
});

/**
 * Pays a shift whose last unit was just accepted — the caller has already
 * moved it WORKING -> PAYING with done_at set, so only one request gets
 * here per shift. Returns { ok, payout, balance } or { ok:false, code }.
 */
export async function payShift(env, db, shift, user) {
  const job = jobOf(shift.job) || JOBS.clicks;
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:GRIND:PAY:${shift.id}`, userId: user.id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: job.pay
  });
  if (!begun.ok) return { ok: false, code: "DUPLICATE" };
  const credit = await moveBalance(env, user.login, job.pay);
  if (!credit.ok) {
    // The shift stays PAYING and the credit shows in the admin Wallet tab;
    // the cooldown still runs from done_at.
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    return { ok: false, code: "PAYOUT_FAILED" };
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
  await db.prepare(`UPDATE grind_shifts SET status = 'PAID', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(job.pay, shift.id).run();
  return { ok: true, payout: job.pay, balance: credit.balance };
}

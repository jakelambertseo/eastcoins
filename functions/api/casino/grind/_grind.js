/* ============================================================
   EastCoin Casino — The Grind (2026-09-16; rebuilt 2026-10-05)

   Work, not a bet. Anyone under BROKE_LINE ZCoins can clock in and BEG:
   type "I am broke as shit and need Zcoins", and every correct line pays
   PAY_PER_LINE (1 ZC) on the spot, up to HOUR_CAP (15 ZC) in any rolling
   hour. Reaching the cap closes the shift; the next one opens as the
   oldest paid line in the hour ages out.

   History: until 2026-10-05 there were two jobs, "Clock in" (100 clicks
   for 5 ZC) and "Sort the Chips" (35 chips by suit for 15 ZC), one shift
   of each every four hours. Both were deleted; their rows stay in
   grind_shifts under job 'clicks' and 'sort' and still count in
   everyone's record. The Grind was CLOSED from 2026-09-29 to 2026-10-05.

   What keeps it honest. This is the only thing in the casino that
   makes ZCoins out of nothing, so:

     · the SERVER grades every line (typedRight) and takes at most one
       per msPerUnit (2.5 s, a very fast typist), so a script can work
       it but never faster than a person. The page refuses pastes and any
       text that lands several characters at once; the clock and the cap
       are what actually hold;

     · the cap is counted from grind_lines, one row per paid line, in
       the rolling hour, so nothing about it lives in the page;

     · the broke line is read LIVE from StreamElements when a shift
       STARTS. A shift ends at the cap, so each new hour of begging is
       checked against the line again;

     · each line's pay is a PAYOUT_CREDIT keyed
       CASINO:GRIND:PAY:<shift id>:<line n>, so a line pays once however
       many times it is sent. A credit the wallet refuses is
       NEEDS_RECONCILIATION in the admin Wallet tab and still counts
       toward the cap, so a failing wallet is not a way past it.

   It is NOT in hourlyNet (nothing is staked and it has its own hourly
   rule), NOT in the Jackpot's stakes and NOT on the results board.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../../picks/_lib.js";

export const CLOSED = false;
export const BROKE_LINE = 50;
export const PAY_PER_LINE = 1;
export const HOUR_CAP = 15;            // ZC in any rolling hour
const HOUR_MS = 60 * 60 * 1000;

export const PHRASE = "I am broke as shit and need Zcoins";
export const JOBS = {
  type: { key: "type", name: "Beg for ZCoins", units: HOUR_CAP / PAY_PER_LINE, unitName: "lines", pay: PAY_PER_LINE, hourCap: HOUR_CAP, msPerUnit: 2500, phrase: PHRASE }
};
export const DEFAULT_JOB = "type";
export const jobOf = (key) => JOBS[String(key || DEFAULT_JOB)] || null;

/** Did they type the line? Case, spacing, a curly apostrophe and full stops or ! at the end don't matter; every word does. */
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").trim();
export const typedRight = (text) => norm(text) === norm(PHRASE);

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
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_done ON grind_shifts (done_at)`),
    // The floor counts who is on shift every few seconds.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_status ON grind_shifts (status, updated_at)`),
    // One row per paid line: the hourly cap is counted from here.
    db.prepare(`CREATE TABLE IF NOT EXISTS grind_lines (
      shift_id TEXT NOT NULL,
      n INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      created_ms INTEGER NOT NULL,
      PRIMARY KEY (shift_id, n)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_lines_user ON grind_lines (user_id, created_ms)`)
  ]);
  // Added with the second job. `clicks` is the units done for every job.
  for (const [col, type] of [["job", "TEXT NOT NULL DEFAULT 'clicks'"], ["seed", "TEXT"], ["penalty_until_ms", "INTEGER NOT NULL DEFAULT 0"], ["misses", "INTEGER NOT NULL DEFAULT 0"]]) {
    await db.prepare(`ALTER TABLE grind_shifts ADD COLUMN ${col} ${type}`).run().catch(() => {});
  }
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_user_job_done ON grind_shifts (user_id, job, done_at)`).run().catch(() => {});
  // One shift being worked per job, however fast "clock in" is pressed.
  await db.prepare(`DROP INDEX IF EXISTS idx_grind_one_working`).run().catch(() => {});
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_grind_one_working_job ON grind_shifts (user_id, job) WHERE status = 'WORKING'`).run().catch(() => {});
  ready = true;
}

export async function workingShift(db, userId, job = DEFAULT_JOB) {
  return db.prepare(`SELECT * FROM grind_shifts WHERE user_id = ? AND job = ? AND status = 'WORKING' LIMIT 1`).bind(userId, job).first();
}

/** This person's paid lines in the rolling hour: how many, and when the oldest of them ages out. */
export async function hourFor(db, userId, now = Date.now()) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n, MIN(created_ms) AS first FROM grind_lines WHERE user_id = ? AND created_ms > ?`)
    .bind(userId, now - HOUR_MS).first();
  const n = Number(row?.n || 0);
  const earned = n * PAY_PER_LINE;
  return { earned, cap: HOUR_CAP, left: Math.max(0, HOUR_CAP - earned), resetAt: n ? Number(row.first) + HOUR_MS : 0 };
}

/** When this person may next earn (ms), or 0 if they may now: the cap's own clock. */
export async function nextShiftAt(db, userId, job = DEFAULT_JOB, now = Date.now()) {
  // Capped: the next line pays when the oldest line in the hour ages out.
  const h = await hourFor(db, userId, now);
  return h.left > 0 || h.resetAt <= now ? 0 : h.resetAt;
}

export async function recordFor(db, userId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS shifts, COALESCE(SUM(payout), 0) AS earned FROM grind_shifts WHERE user_id = ? AND payout > 0`)
    .bind(userId).first();
  return { shifts: Number(row?.shifts || 0), earned: Number(row?.earned || 0) };
}

/** The page's view of a shift. */
export async function publicShift(s, now = Date.now()) {
  if (!s) return null;
  const job = jobOf(s.job) || JOBS[DEFAULT_JOB];
  return { id: s.id, job: job.key, done: Number(s.clicks), misses: Number(s.misses || 0), status: s.status, payout: Number(s.payout || 0),
    waitMs: Math.max(0, Number(s.last_click_ms || 0) + job.msPerUnit - now) };
}

export function publicJobs() {
  return Object.fromEntries(Object.values(JOBS).map((j) => [j.key, { ...j }]));
}

export const config = () => ({
  cooldownMinutes: 60, hourCap: HOUR_CAP, payPerLine: PAY_PER_LINE, brokeLine: BROKE_LINE, jobs: publicJobs(), closed: CLOSED
});

/**
 * Pays line `n` of a shift — the caller has already counted it with an
 * optimistic UPDATE, so only one request gets here per line. Records the
 * line toward the hour's cap whether or not the wallet takes the credit.
 * Returns { ok, payout, balance } or { ok:false, code }.
 */
export async function payLine(env, db, shift, user, n, now = Date.now()) {
  await db.prepare(`INSERT OR IGNORE INTO grind_lines (shift_id, n, user_id, created_ms) VALUES (?, ?, ?, ?)`).bind(shift.id, n, user.id, now).run();
  await db.prepare(`UPDATE grind_shifts SET payout = payout + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(PAY_PER_LINE, shift.id).run();
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:GRIND:PAY:${shift.id}:${n}`, userId: user.id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: PAY_PER_LINE
  });
  if (!begun.ok) return { ok: false, code: "DUPLICATE" };
  const credit = await moveBalance(env, user.login, PAY_PER_LINE);
  if (!credit.ok) {
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    return { ok: false, code: "PAYOUT_FAILED" };
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
  return { ok: true, payout: PAY_PER_LINE, balance: credit.balance };
}

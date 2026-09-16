/* ============================================================
   EastCoin Casino — The Grind (2026-09-16)

   Work, not a bet. Anyone under BROKE_LINE ZCoins can clock in for a
   shift: CLICKS_PER_SHIFT clicks of one button pays SHIFT_PAY, and a
   person gets one shift in any SHIFT_COOLDOWN_MS. It is a way back to
   the tables for someone who has lost it all, not a job.

   What keeps it honest. This is the only thing in the casino that
   makes ZCoins out of nothing, so:

     · the SERVER counts the clicks. The page sends them in small
       batches and the server credits at most one per MIN_MS_PER_CLICK
       since the last batch — about eight a second, faster than anyone
       clicks, slower than a script that fires a hundred at once. A bot
       can still work a shift; it cannot work it any faster than a
       person, and it gets the same one shift an hour;

     · the broke line is checked when a shift STARTS, from the live
       StreamElements balance. Grinding stops paying once you are back
       above it, so grinding can never build a balance past the line
       plus one shift;

     · the pay is PAYOUT_CREDIT with key CASINO:GRIND:PAY:<shift id>,
       so a shift pays once however many times its last click is sent.
       The cooldown runs from the moment a shift completes, even if the
       wallet refused the credit, so a failing wallet is not a way to
       chain shifts; that credit shows in the admin Wallet tab.

   It is NOT in hourlyNet (nothing is staked and it has its own hourly
   rule), NOT in the Jackpot's stakes and NOT on the results board.
   ============================================================ */

export const CLICKS_PER_SHIFT = 100;
export const SHIFT_PAY = 10;
export const SHIFT_COOLDOWN_MS = 60 * 60 * 1000;
export const BROKE_LINE = 50;
export const MIN_MS_PER_CLICK = 120;
export const BATCH_MAX = 25;

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
    // "When did this person last finish a shift" is the cooldown read.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_user_done ON grind_shifts (user_id, done_at)`),
    // The shifts feed, newest first.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_done ON grind_shifts (done_at)`),
    // The floor counts who is on shift every few seconds.
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_grind_status ON grind_shifts (status, updated_at)`)
  ]);
  // One shift being worked at a time, however fast "clock in" is pressed.
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_grind_one_working ON grind_shifts (user_id) WHERE status = 'WORKING'`).run().catch(() => {});
  ready = true;
}

export async function workingShift(db, userId) {
  return db.prepare(`SELECT * FROM grind_shifts WHERE user_id = ? AND status = 'WORKING' LIMIT 1`).bind(userId).first();
}

/** When this person may start their next shift (ms), or 0 if they may now. */
export async function nextShiftAt(db, userId, now = Date.now()) {
  const row = await db
    .prepare(`SELECT done_at FROM grind_shifts WHERE user_id = ? AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT 1`)
    .bind(userId).first();
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

export function publicShift(s) {
  if (!s) return null;
  return { id: s.id, clicks: Number(s.clicks), of: CLICKS_PER_SHIFT, status: s.status, payout: Number(s.payout || 0) };
}

export const config = () => ({
  clicks: CLICKS_PER_SHIFT, pay: SHIFT_PAY, cooldownMinutes: SHIFT_COOLDOWN_MS / 60000,
  brokeLine: BROKE_LINE, batchMax: BATCH_MAX, msPerClick: MIN_MS_PER_CLICK
});

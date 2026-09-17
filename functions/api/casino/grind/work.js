/* POST /api/casino/grind/work  { id, clicks }

   The "Clock in" job. Hands in a batch of clicks. The server credits at
   most one click per msPerUnit since the last batch it accepted, and
   never past the end of the shift — so a hundred clicks sent at once
   count as however many the clock allows, not a hundred. The batch that
   reaches the end pays the shift, once (CASINO:GRIND:PAY:<id>). */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureGrind, publicShift, nextShiftAt, payShift, JOBS } from "./_grind.js";

const JOB = JOBS.clicks;

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureGrind(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to work a shift.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const id = String(body.id || "").trim();
  const sent = Math.max(0, Math.min(JOB.batchMax, Math.floor(Number(body.clicks) || 0)));

  const s = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!s) return fail("NO_SHIFT", "No such shift.", 404);
  if ((s.job || "clicks") !== JOB.key) return fail("WRONG_JOB", "That shift isn't a clicking shift.", 409);
  if (s.status !== "WORKING") return json({ ok: true, credited: 0, shift: await publicShift(s) });

  const now = Date.now();
  const allowed = Math.floor(Math.max(0, now - Number(s.last_click_ms)) / JOB.msPerUnit);
  const credited = Math.max(0, Math.min(sent, allowed, JOB.units - Number(s.clicks)));
  if (credited === 0) return json({ ok: true, credited: 0, throttled: sent > 0, shift: await publicShift(s) });

  // The clock only advances by the clicks it paid for, so unspent time
  // carries into the next batch rather than being thrown away.
  const clicks = Number(s.clicks) + credited;
  const lastMs = Math.min(now, Number(s.last_click_ms) + credited * JOB.msPerUnit);
  const done = clicks >= JOB.units;
  // Optimistic lock on the count, so two batches racing cannot both land.
  const r = await db
    .prepare(`UPDATE grind_shifts
                 SET clicks = ?, last_click_ms = ?, status = ?,
                     done_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE done_at END,
                     updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND status = 'WORKING' AND clicks = ?`)
    .bind(clicks, lastMs, done ? "PAYING" : "WORKING", done ? 1 : 0, id, s.clicks)
    .run();
  if (!r.meta?.changes) {
    const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
    return json({ ok: true, credited: 0, shift: await publicShift(fresh) });
  }

  if (!done) {
    return json({ ok: true, credited, throttled: credited < sent, shift: await publicShift({ ...s, clicks }) });
  }

  // Payday. Only the batch that moved WORKING -> PAYING gets here.
  const paid = await payShift(context.env, db, s, user);
  const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
  const next = await nextShiftAt(db, user.id, JOB.key);
  const nextIso = next ? new Date(next).toISOString() : null;
  if (!paid.ok) {
    return json({ ok: false, code: "PAYOUT_FAILED", message: "Shift done, but your pay didn't go through — a moderator can see it and will sort it out.", shift: await publicShift(fresh), nextShiftAt: nextIso }, 502);
  }
  return json({ ok: true, credited, paid: true, payout: paid.payout, balance: paid.balance, shift: await publicShift(fresh), nextShiftAt: nextIso });
}

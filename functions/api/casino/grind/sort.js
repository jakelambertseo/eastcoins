/* POST /api/casino/grind/sort  { id, suit: 0-3 }

   The "Sort the Chips" job. Grades one chip: the chip in front of the
   worker is chipAt(seed, done), and only that one — the page is never
   told what comes next. A right tray moves the belt on; a wrong one
   holds the chip and locks the trays for penaltyMs. At most one chip per
   msPerUnit is accepted, so the belt cannot be run faster than a person
   can sort. The chip that finishes the shift pays it, once. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureGrind, publicShift, nextShiftAt, payShift, chipAt, JOBS } from "./_grind.js";

const JOB = JOBS.sort;

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
  const suit = Number(body.suit);
  if (!Number.isInteger(suit) || suit < 0 || suit > 3) return fail("BAD_SUIT", "Pick a tray.");

  const s = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!s) return fail("NO_SHIFT", "No such shift.", 404);
  if (s.job !== JOB.key) return fail("WRONG_JOB", "That shift isn't a sorting shift.", 409);
  if (s.status !== "WORKING") return json({ ok: true, result: "over", shift: await publicShift(s) });

  const now = Date.now();
  if (now < Number(s.penalty_until_ms || 0)) {
    return json({ ok: true, result: "wait", shift: await publicShift(s, now) });
  }
  if (now - Number(s.last_click_ms) < JOB.msPerUnit) {
    return json({ ok: true, result: "slow", shift: await publicShift(s, now) });
  }

  const done0 = Number(s.clicks);
  const chip = await chipAt(s.seed, done0);

  if (suit !== chip) {
    // Held for a recount. Locked on the count, so a stale second press
    // cannot stack a second penalty on top.
    await db
      .prepare(`UPDATE grind_shifts SET misses = misses + 1, penalty_until_ms = ?, last_click_ms = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND status = 'WORKING' AND clicks = ? AND penalty_until_ms <= ?`)
      .bind(now + JOB.penaltyMs, now, id, done0, now)
      .run();
    const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
    return json({ ok: true, result: "miss", shift: await publicShift(fresh, now) });
  }

  const doneNow = done0 + 1;
  const finished = doneNow >= JOB.units;
  const r = await db
    .prepare(`UPDATE grind_shifts
                 SET clicks = ?, last_click_ms = ?, status = ?,
                     done_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE done_at END,
                     updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND status = 'WORKING' AND clicks = ?`)
    .bind(doneNow, now, finished ? "PAYING" : "WORKING", finished ? 1 : 0, id, done0)
    .run();
  if (!r.meta?.changes) {
    const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
    return json({ ok: true, result: "stale", shift: await publicShift(fresh, now) });
  }

  if (!finished) {
    return json({ ok: true, result: "sorted", shift: await publicShift({ ...s, clicks: doneNow, last_click_ms: now }, now) });
  }

  const paid = await payShift(context.env, db, s, user);
  const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
  const next = await nextShiftAt(db, user.id, JOB.key);
  const nextIso = next ? new Date(next).toISOString() : null;
  if (!paid.ok) {
    return json({ ok: false, code: "PAYOUT_FAILED", message: "Shift done, but your pay didn't go through — a moderator can see it and will sort it out.", shift: await publicShift(fresh, now), nextShiftAt: nextIso }, 502);
  }
  return json({ ok: true, result: "sorted", paid: true, payout: paid.payout, balance: paid.balance, shift: await publicShift(fresh, now), nextShiftAt: nextIso });
}

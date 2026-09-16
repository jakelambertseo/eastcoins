/* POST /api/casino/grind/work  { id, clicks }

   Hands in a batch of clicks. The server credits at most one click per
   MIN_MS_PER_CLICK since the last batch it accepted, and never past the
   end of the shift — so a hundred clicks sent at once count as however
   many the clock allows, not a hundred. The batch that reaches the end
   pays the shift, once (CASINO:GRIND:PAY:<id>). */

import { getSessionUser, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureGrind, publicShift, nextShiftAt, CLICKS_PER_SHIFT, SHIFT_PAY, MIN_MS_PER_CLICK, BATCH_MAX } from "./_grind.js";

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
  const sent = Math.max(0, Math.min(BATCH_MAX, Math.floor(Number(body.clicks) || 0)));

  const s = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!s) return fail("NO_SHIFT", "No such shift.", 404);
  if (s.status !== "WORKING") return json({ ok: true, credited: 0, shift: publicShift(s) });

  const now = Date.now();
  const allowed = Math.floor(Math.max(0, now - Number(s.last_click_ms)) / MIN_MS_PER_CLICK);
  const credited = Math.max(0, Math.min(sent, allowed, CLICKS_PER_SHIFT - Number(s.clicks)));
  if (credited === 0) return json({ ok: true, credited: 0, throttled: sent > 0, shift: publicShift(s) });

  // The clock only advances by the clicks it paid for, so unspent time
  // carries into the next batch rather than being thrown away.
  const clicks = Number(s.clicks) + credited;
  const lastMs = Math.min(now, Number(s.last_click_ms) + credited * MIN_MS_PER_CLICK);
  const done = clicks >= CLICKS_PER_SHIFT;
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
    return json({ ok: true, credited: 0, shift: publicShift(fresh) });
  }

  if (!done) {
    return json({ ok: true, credited, throttled: credited < sent, shift: publicShift({ ...s, clicks }) });
  }

  // Payday. Only the batch that moved WORKING -> PAYING gets here.
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:GRIND:PAY:${id}`, userId: user.id,
    marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: SHIFT_PAY
  });
  let paid = null;
  if (begun.ok) {
    const credit = await moveBalance(context.env, user.login, SHIFT_PAY);
    if (credit.ok) {
      await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
      await db.prepare(`UPDATE grind_shifts SET status = 'PAID', payout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(SHIFT_PAY, id).run();
      paid = { payout: SHIFT_PAY, balance: credit.balance };
    } else {
      // The shift stays PAYING and the credit shows in the admin Wallet
      // tab; the cooldown still runs from done_at, so a failing wallet
      // is not a way to chain shifts.
      await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    }
  }
  const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
  const next = await nextShiftAt(db, user.id);
  const nextIso = next ? new Date(next).toISOString() : null;
  if (!paid) {
    return json({ ok: false, code: "PAYOUT_FAILED", message: "Shift done, but your pay didn't go through — a moderator can see it and will sort it out.", shift: publicShift(fresh), nextShiftAt: nextIso }, 502);
  }
  return json({ ok: true, credited, paid: true, payout: paid.payout, balance: paid.balance, shift: publicShift(fresh), nextShiftAt: nextIso });
}

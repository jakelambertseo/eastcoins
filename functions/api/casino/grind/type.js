/* POST /api/casino/grind/type  { id, text }

   The "Beg for ZCoins" job (2026-10-05). Hands in one typed line. The
   server grades it (typedRight: every word of the phrase, case and
   spacing aside), accepts at most one line per msPerUnit counted from
   the last line it saw, and pays PAY_PER_LINE for each right one until
   the caller has earned HOUR_CAP in the rolling hour, which closes the
   shift. A wrong line is a miss and uses up its slot, so guessing is no
   faster than typing. Each line pays once (CASINO:GRIND:PAY:<id>:<n>). */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureGrind, publicShift, nextShiftAt, payLine, hourFor, typedRight, JOBS } from "./_grind.js";

const JOB = JOBS.type;

async function closeShift(db, id) {
  await db.prepare(`UPDATE grind_shifts SET status = 'PAID', done_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'WORKING'`).bind(id).run();
}

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
  const text = String(body.text || "").slice(0, 200);

  const s = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!s) return fail("NO_SHIFT", "No such shift.", 404);
  if (s.job !== JOB.key) return fail("WRONG_JOB", "That shift isn't a typing shift.", 409);
  if (s.status !== "WORKING") return json({ ok: true, result: "over", shift: await publicShift(s) });

  const now = Date.now();
  if (now - Number(s.last_click_ms) < JOB.msPerUnit) {
    return json({ ok: true, result: "slow", shift: await publicShift(s, now) });
  }

  const done0 = Number(s.clicks);
  if (!typedRight(text)) {
    await db
      .prepare(`UPDATE grind_shifts SET misses = misses + 1, last_click_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'WORKING' AND clicks = ?`)
      .bind(now, id, done0).run();
    const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
    return json({ ok: true, result: "typo", shift: await publicShift(fresh, now) });
  }

  // The hour's cap, read before anything is paid.
  const hour = await hourFor(db, user.id, now);
  if (hour.left <= 0) {
    await closeShift(db, id);
    const next = await nextShiftAt(db, user.id, JOB.key, now);
    return json({ ok: true, result: "capped", hour, shift: null, nextShiftAt: next ? new Date(next).toISOString() : null });
  }

  // Optimistic lock on the count, so two lines racing cannot both land.
  const doneNow = done0 + 1;
  const r = await db
    .prepare(`UPDATE grind_shifts SET clicks = ?, last_click_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'WORKING' AND clicks = ?`)
    .bind(doneNow, now, id, done0)
    .run();
  if (!r.meta?.changes) {
    const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
    return json({ ok: true, result: "stale", shift: await publicShift(fresh, now) });
  }

  const paid = await payLine(context.env, db, s, user, doneNow, now);
  const after = await hourFor(db, user.id, now);
  let nextIso = null;
  if (after.left <= 0) {
    await closeShift(db, id);
    const next = await nextShiftAt(db, user.id, JOB.key, now);
    nextIso = next ? new Date(next).toISOString() : null;
  }
  const fresh = await db.prepare(`SELECT * FROM grind_shifts WHERE id = ?`).bind(id).first();
  const shift = fresh?.status === "WORKING" ? await publicShift(fresh, now) : null;
  if (!paid.ok) {
    return json({ ok: false, code: "PAYOUT_FAILED", message: "That line counted, but its ZCoin didn't go through — a moderator can see it and will sort it out.", hour: after, shift, nextShiftAt: nextIso }, 502);
  }
  return json({ ok: true, result: "typed", paid: true, payout: paid.payout, balance: paid.balance, hour: after, shift, nextShiftAt: nextIso });
}

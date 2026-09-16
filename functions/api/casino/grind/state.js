/* GET /api/casino/grind/state[?balance=1]

   The jobs, who is on the floor, the latest paydays, and — signed in —
   the caller's shift, next opening and record at each job. The
   StreamElements balance is only read when ?balance=1 asks for it (the
   page does on arrival and after a payday), so a page left open does
   not call the wallet on every poll. */

import { getSessionUser, readBalance, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor } from "../_engine.js";
import { ensureGrind, workingShift, nextShiftAt, recordFor, publicShift, config, JOBS, BROKE_LINE } from "./_grind.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const GRIND = { key: "grind" };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensureGrind(db);

  const now = Date.now();
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, GRIND, user.id, now);

  const [room, recent] = await Promise.all([
    roomFor(db, GRIND, now),
    db.prepare(
      `SELECT s.id, s.job, s.payout, s.done_at, u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM grind_shifts s JOIN users u ON u.twitch_id = s.user_id
        WHERE s.status = 'PAID' ORDER BY s.done_at DESC LIMIT 20`
    ).all()
  ]);

  let me = null;
  if (user) {
    const wantBalance = new URL(context.request.url).searchParams.get("balance") === "1";
    const keys = Object.keys(JOBS);
    const [shifts, nexts, record, balance] = await Promise.all([
      Promise.all(keys.map((k) => workingShift(db, user.id, k))),
      Promise.all(keys.map((k) => nextShiftAt(db, user.id, k, now))),
      recordFor(db, user.id),
      wantBalance ? readBalance(context.env, user.login) : Promise.resolve(undefined)
    ]);
    const jobs = {};
    for (let i = 0; i < keys.length; i += 1) {
      jobs[keys[i]] = { shift: await publicShift(shifts[i], now), nextShiftAt: nexts[i] ? new Date(nexts[i]).toISOString() : null };
    }
    me = {
      id: String(user.id),
      jobs,
      // The first job at the top level, for a page loaded before the second job.
      shift: jobs.clicks.shift,
      nextShiftAt: jobs.clicks.nextShiftAt,
      ...record
    };
    // Only present when it was asked for, so the page can tell "not read"
    // from "read and it is zero".
    if (balance !== undefined) {
      me.balance = balance;
      me.eligible = balance === null ? null : balance < BROKE_LINE;
    }
  }

  return json({
    ok: true,
    now: new Date(now).toISOString(),
    config: { ...config(), canWork: Boolean(user) && walletWritesEnabled(context.env) },
    me,
    room,
    recent: (recent.results || []).map((r) => ({
      id: r.id,
      job: r.job || "clicks",
      payout: Number(r.payout),
      at: String(r.done_at).replace(" ", "T") + "Z",
      user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
    }))
  });
}

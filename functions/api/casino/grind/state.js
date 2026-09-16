/* GET /api/casino/grind/state[?balance=1]

   The rules, who is on shift, the latest paid shifts, and — signed in —
   the caller's own shift, record and when their next shift opens. The
   StreamElements balance is only read when ?balance=1 asks for it (the
   page does on arrival and after a payday), so a page left open does
   not call the wallet on every poll. */

import { getSessionUser, readBalance, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor } from "../_engine.js";
import { ensureGrind, workingShift, nextShiftAt, recordFor, publicShift, config, BROKE_LINE } from "./_grind.js";

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
      `SELECT s.id, s.payout, s.done_at, u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM grind_shifts s JOIN users u ON u.twitch_id = s.user_id
        WHERE s.status = 'PAID' ORDER BY s.done_at DESC LIMIT 20`
    ).all()
  ]);

  let me = null;
  if (user) {
    const wantBalance = new URL(context.request.url).searchParams.get("balance") === "1";
    const [shift, next, record, balance] = await Promise.all([
      workingShift(db, user.id),
      nextShiftAt(db, user.id, now),
      recordFor(db, user.id),
      wantBalance ? readBalance(context.env, user.login) : Promise.resolve(undefined)
    ]);
    me = {
      id: String(user.id),
      shift: publicShift(shift),
      nextShiftAt: next ? new Date(next).toISOString() : null,
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
      payout: Number(r.payout),
      at: String(r.done_at).replace(" ", "T") + "Z",
      user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
    }))
  });
}

/* GET /api/casino/<game>/history — the room's recent rounds, every win
   and loss, newest first. Public, like the Community Ledger; with a
   session it also totals the caller's own record on this game. */

import { getSessionUser } from "../../picks/_lib.js";
import { gameFor, ensureSchema } from "../_engine.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  const game = gameFor(context.params.game);
  if (!game) return json({ ok: false, code: "NO_SUCH_GAME" }, 404);
  await ensureSchema(db);

  const user = await getSessionUser(db, context.request);
  const rows = await db
    .prepare(
      `SELECT b.round_no, b.pick, b.wager, b.status, b.payout,
              r.result, r.settled_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM casino_bets b
         JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no
         JOIN users u ON u.twitch_id = b.user_id
        WHERE b.game = ? AND b.status IN ('WON','LOST')
        ORDER BY b.round_no DESC, b.created_at ASC
        LIMIT 80`
    )
    .bind(game.key)
    .all();

  const entries = (rows.results || []).map((r) => ({
    round: Number(r.round_no),
    result: parse(r.result),
    settledAt: r.settled_at ? String(r.settled_at).replace(" ", "T") + "Z" : null,
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    pick: r.pick,
    wager: Number(r.wager),
    status: r.status,
    payout: Number(r.payout || 0),
    profit: r.status === "WON" ? Number(r.payout) - Number(r.wager) : -Number(r.wager)
  }));

  let me = null;
  if (user) {
    const t = await db
      .prepare(
        `SELECT SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) AS losses,
                COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net
           FROM casino_bets WHERE game = ? AND user_id = ? AND status IN ('WON','LOST')`
      )
      .bind(game.key, user.id)
      .first();
    me = { wins: Number(t?.wins || 0), losses: Number(t?.losses || 0), net: Number(t?.net || 0) };
  }
  return json({ ok: true, entries, me });
}

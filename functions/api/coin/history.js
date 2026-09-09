/* GET /api/coin/history — the room's recent flips, every win and loss.

   Public, like the Community Ledger. With a session it also totals
   the caller's own record. */

import { getSessionUser } from "../picks/_lib.js";
import { ensureSchema } from "./_coin.js";

const json = (body) => Response.json(body, { headers: { "Cache-Control": "no-store" } });

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" });
  await ensureSchema(db);

  const user = await getSessionUser(db, context.request);

  const rows = await db
    .prepare(
      `SELECT b.round_no, b.side, b.wager, b.status, b.payout, b.created_at,
              r.result, r.settled_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM coin_bets b
         JOIN coin_rounds r ON r.no = b.round_no
         JOIN users u ON u.twitch_id = b.user_id
        WHERE b.status IN ('WON','LOST')
        ORDER BY b.round_no DESC, b.created_at ASC
        LIMIT 80`
    )
    .all();

  const entries = (rows.results || []).map((r) => ({
    round: Number(r.round_no),
    result: r.result,
    settledAt: r.settled_at ? String(r.settled_at).replace(" ", "T") + "Z" : null,
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    side: r.side,
    wager: Number(r.wager),
    status: r.status,
    profit: r.status === "WON" ? Number(r.payout) - Number(r.wager) : -Number(r.wager)
  }));

  let me = null;
  if (user) {
    const t = await db
      .prepare(
        `SELECT SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) AS losses,
                COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net
           FROM coin_bets WHERE user_id = ? AND status IN ('WON','LOST')`
      )
      .bind(user.id)
      .first();
    me = { wins: Number(t?.wins || 0), losses: Number(t?.losses || 0), net: Number(t?.net || 0) };
  }

  return json({ ok: true, entries, me });
}

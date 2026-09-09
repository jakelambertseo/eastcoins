/* ============================================================
   GET /api/picks/users — everyone, on one page

   Every person who has logged in, with what they have made on
   Picks, their titles (the same badges every name wears), and
   the club they chose. Music ELO is added on the client from the
   Green Room worker, which already publishes it. Read-only.
   ============================================================ */

import { json } from "./_lib.js";
import { badgesFor } from "./_badges.js";
import { findTeam, ensureFavouriteColumns } from "./_teams.js";
import { utc } from "./_game.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureFavouriteColumns(db);

  const rows = await db
    .prepare(
      `SELECT u.twitch_id, u.twitch_login, u.display_name, u.avatar_url, u.created_at,
              u.favourite_league, u.favourite_team,
              COUNT(p.id) AS total,
              SUM(CASE WHEN p.status = 'WON'  THEN 1 ELSE 0 END) AS wins,
              SUM(CASE WHEN p.status = 'LOST' THEN 1 ELSE 0 END) AS losses,
              SUM(CASE WHEN p.status = 'ACTIVE' THEN 1 ELSE 0 END) AS open,
              SUM(CASE WHEN p.status IN ('WON','LOST') THEN p.profit ELSE 0 END) AS profit
         FROM users u
         LEFT JOIN picks p ON p.user_id = u.twitch_id
        WHERE u.twitch_login IS NOT NULL AND u.twitch_login <> ''
        GROUP BY u.twitch_id
        ORDER BY profit DESC, wins DESC, lower(u.display_name) ASC`
    )
    .all();

  let badges = {};
  try { badges = (await badgesFor(context.env, db)).byLogin || {}; } catch { badges = {}; }

  const users = (rows.results || []).map((r) => {
    const login = String(r.twitch_login).toLowerCase();
    return {
      id: String(r.twitch_id),
      login,
      displayName: String(r.display_name || r.twitch_login),
      avatar: String(r.avatar_url || ""),
      since: utc(r.created_at),
      picks: {
        total: Number(r.total || 0),
        wins: Number(r.wins || 0),
        losses: Number(r.losses || 0),
        open: Number(r.open || 0),
        profit: Number(r.profit || 0)
      },
      favourite: findTeam(r.favourite_league, r.favourite_team),
      badges: badges[login] || []
    };
  });

  return json({ ok: true, users, count: users.length });
}

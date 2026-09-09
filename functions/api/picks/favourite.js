/* ============================================================
   EastCoin Picks — favourite team

     GET  /api/picks/favourite          → { catalog, mine }
     POST /api/picks/favourite          { league, team }  sets it
     POST /api/picks/favourite          { clear: true }   removes it

   The choice lives on the user row and shows on the profile page.
   Only a club from the catalog is accepted, so there is always a
   logo to draw for it. Nothing here touches ZCoins.
   ============================================================ */

import { getSessionUser, json, fail } from "./_lib.js";
import { catalog, findTeam, ensureFavouriteColumns } from "./_teams.js";

async function mine(db, user) {
  if (!user) return null;
  const row = await db
    .prepare(`SELECT favourite_league, favourite_team FROM users WHERE twitch_id = ? LIMIT 1`)
    .bind(user.id)
    .first();
  return row ? findTeam(row.favourite_league, row.favourite_team) : null;
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks storage is not configured.", 503);
  await ensureFavouriteColumns(db);
  const user = await getSessionUser(db, context.request);
  return json({ ok: true, catalog: catalog(), mine: await mine(db, user) });
}

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks storage is not configured.", 503);
  await ensureFavouriteColumns(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_AUTHENTICATED", "Log in with Twitch to pick a team.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }

  if (body.clear === true) {
    await db.prepare(`UPDATE users SET favourite_league = NULL, favourite_team = NULL WHERE twitch_id = ?`).bind(user.id).run();
    return json({ ok: true, favourite: null });
  }

  const team = findTeam(body.league, body.team);
  if (!team) return fail("UNKNOWN_TEAM", "That team is not on the list.", 400);

  await db
    .prepare(`UPDATE users SET favourite_league = ?, favourite_team = ? WHERE twitch_id = ?`)
    .bind(team.league, team.abbr, user.id)
    .run();
  return json({ ok: true, favourite: team });
}

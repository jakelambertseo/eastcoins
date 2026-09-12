/* ============================================================
   EastCoin Picks — ban or unban an account (admin)

     POST /api/picks/admin/ban   { login, banned, reason }

   A ban stops the account holding a session, so every signed-in
   feature refuses at once and a fresh Twitch sign-in is turned away.
   See _bans.js for what a ban deliberately does NOT do.

   Three guards, and the first two are the important ones:

     - An admin cannot be banned. Admins are the people who can lift
       a ban, so allowing it creates a state the site cannot be
       recovered from through its own screens.
     - Nobody can ban themselves, for the same reason, one step
       closer to home.
     - A reason is required when banning. Not for the person banned,
       who never sees it, but for whoever reads the row in three
       months wondering what happened.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, json, fail } from "../_lib.js";
import { ensureBans, setBan, banRow, publicBan } from "../_bans.js";

export async function onRequestPost(context) {
  try {
    return await handle(context);
  } catch (error) {
    const detail = String(error?.message || error || "unknown");
    console.error("ban threw:", detail, error?.stack || "");
    return fail("SERVER_ERROR", "The endpoint threw: " + detail, 500);
  }
}

async function handle(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);
  await ensureBans(db);

  const admin = await getSessionUser(db, context.request);
  if (!admin || !ADMIN_ALLOWLIST.has(admin.login)) {
    return fail("NOT_ADMIN", "Only site admins can ban accounts.", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return fail("BAD_REQUEST", "Expected a JSON body.");
  }

  const login = String(body?.login || "").trim().toLowerCase();
  const banned = Boolean(body?.banned);
  const reason = String(body?.reason || "").replace(/[<>]/g, "").trim().slice(0, 200);

  if (!login) return fail("BAD_REQUEST", "Which account?");
  if (login === admin.login) {
    return fail("NOT_YOURSELF", "You can't ban your own account.", 409);
  }
  if (ADMIN_ALLOWLIST.has(login)) {
    return fail("NOT_AN_ADMIN", "Admins can't be banned. Take them off the admin list first.", 409);
  }
  if (banned && !reason) {
    return fail("NEEDS_REASON", "Give a reason. Nobody but the admins ever reads it, and in three months you'll want it.");
  }

  const user = await db
    .prepare(`SELECT twitch_id, twitch_login, display_name FROM users WHERE lower(twitch_login) = ? LIMIT 1`)
    .bind(login)
    .first();
  if (!user) return fail("NO_USER", `Nobody here is signed in as ${login}.`, 404);

  const before = await banRow(db, user.twitch_id);
  if (Boolean(Number(before?.banned)) === banned) {
    return json({
      ok: true,
      unchanged: true,
      login,
      displayName: String(user.display_name || user.twitch_login),
      ban: publicBan(before)
    });
  }

  const row = await setBan(db, {
    userId: user.twitch_id,
    login: String(user.twitch_login).toLowerCase(),
    banned,
    reason,
    byLogin: admin.login
  });

  return json({
    ok: true,
    login,
    displayName: String(user.display_name || user.twitch_login),
    ban: publicBan(row)
  });
}

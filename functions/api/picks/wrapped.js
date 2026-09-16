/* ============================================================
   GET /api/picks/wrapped?login=<twitch login>

   One person's EastCoin Wrapped (see _wrapped.js). Public once it
   drops — the same rule as a profile. Before the drop it answers
   { locked: true, opensAt } to everyone except admins, who get the
   season so far with preview: true.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, json } from "./_lib.js";
import { WRAPPED, buildWrapped, opensAt } from "./_wrapped.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  const login = String(new URL(request.url).searchParams.get("login") || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{2,25}$/.test(login)) return json({ ok: false, code: "BAD_LOGIN", message: "That isn't a Twitch name." }, 400);

  const user = await db
    .prepare(`SELECT twitch_id, twitch_login, display_name, avatar_url FROM users WHERE twitch_login = ? COLLATE NOCASE LIMIT 1`)
    .bind(login)
    .first();
  if (!user) return json({ ok: false, code: "NOT_FOUND", message: "Nobody by that name has been on EastCoin yet." }, 404);

  const opens = opensAt(env);
  const who = {
    login: String(user.twitch_login).toLowerCase(),
    displayName: String(user.display_name || user.twitch_login),
    avatar: String(user.avatar_url || "")
  };
  const base = { ok: true, label: WRAPPED.label, opensAt: new Date(opens).toISOString(), user: who };

  let preview = false;
  if (Date.now() < opens) {
    const viewer = await getSessionUser(db, request).catch(() => null);
    if (!viewer || !ADMIN_ALLOWLIST.has(viewer.login)) {
      return json({ ...base, locked: true }, 200, { "Cache-Control": "public, max-age=300" });
    }
    preview = true;
  }

  const from = new Date(WRAPPED.from).getTime();
  const to = preview ? Date.now() : opens;
  const body = await buildWrapped(env, db, user, { from, to });
  return json({ ...base, locked: false, preview, ...body }, 200, {
    // A preview is one admin's look at a moving season; the real thing is fixed.
    "Cache-Control": preview ? "no-store" : "public, max-age=600"
  });
}

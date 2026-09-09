/* GET /api/picks/badges — everyone's badges, keyed by login. Public. */

import { badgesFor } from "./_badges.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const { byLogin, computedAt } = await badgesFor(context.env, db);
  return Response.json({ ok: true, badges: byLogin, computedAt }, {
    headers: { "Cache-Control": "public, max-age=60" }
  });
}

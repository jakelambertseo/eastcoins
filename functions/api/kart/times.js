/* GET  /api/kart/times[?track=lot&trail=1] — the board: the record, the top ten, your row (no login needed to read)
   POST /api/kart/times { track, lapMs, totalMs?, splits?, trail? } — hand in a lap; members only

   Nothing here is money. The page reads the board when the menu opens and the
   record's trail when a time trial starts; it posts once per lap that beat
   something, never on a poll. */

import { json, fail, getSessionUser } from "../picks/_lib.js";
import { requireLogin } from "../screen/_gate.js";
import { ensureKart, boardFor, recordLap, TRACKS } from "./_kart.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "EastKart's board is offline.", 503);
  await ensureKart(db);
  const url = new URL(context.request.url);
  const one = url.searchParams.get("track");
  const withTrail = url.searchParams.get("trail") === "1";
  const user = await getSessionUser(db, context.request).catch(() => null);
  const keys = one ? (TRACKS[one] ? [one] : []) : Object.keys(TRACKS);
  const tracks = {};
  for (const k of keys) tracks[k] = await boardFor(db, k, user?.id || null, withTrail && Boolean(one));
  return json({ ok: true, tracks, you: user ? { login: user.login, name: user.displayName } : null }, 200, { "Cache-Control": "no-store" });
}

export async function onRequestPost(context) {
  const gate = await requireLogin(context, "Log in with Twitch to post a time.");
  if (gate.denied) return gate.denied;
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "EastKart's board is offline.", 503);
  await ensureKart(db);
  let body;
  try { body = await context.request.json(); } catch { return fail("BAD_JSON", "Send JSON.", 400); }
  const res = await recordLap(db, gate.user, body || {});
  if (!res.ok) return fail(res.code, "That lap did not make sense.", 400);
  const tracks = { [body.track]: await boardFor(db, body.track, gate.user.id, false) };
  return json({ ok: true, ...res, tracks, you: { login: gate.user.login, name: gate.user.displayName } }, 200, { "Cache-Control": "no-store" });
}

/* /api/blockshot/me — your Blockshot profile (2026-10-09). GET: lifetime stats, XP, level and the skin worn, for the signed-in account
   (a visitor gets { ok: true, me: null }). POST { skin } saves the skin. Nothing else is writable from the page: results come only from
   the match server (round.js). */
import { getSessionUser } from "../picks/_lib.js";
import { ensureBlockshot, profileFor, saveSkin, cleanSkin } from "./_stats.js";

const noStore = { "Cache-Control": "no-store" };
export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: noStore });
  const user = await getSessionUser(db, context.request);
  if (!user) return Response.json({ ok: true, me: null }, { headers: noStore });
  await ensureBlockshot(db);
  const me = await profileFor(db, user.id);
  return Response.json({ ok: true, me: me || { login: user.login, name: user.displayName, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, wins: 0, rounds: 0, bestStreak: 0, seconds: 0, xp: 0, totalXp: 0, level: 1, next: 100, kd: 0, accuracy: 0, skin: null } }, { headers: noStore });
}
export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: noStore });
  const user = await getSessionUser(db, context.request);
  if (!user) return Response.json({ ok: false, code: "NOT_AUTHENTICATED" }, { status: 401, headers: noStore });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  const skin = cleanSkin(body.skin);
  if (!skin) return Response.json({ ok: false, code: "BAD" }, { status: 400, headers: noStore });
  await ensureBlockshot(db);
  await saveSkin(db, user, skin);
  return Response.json({ ok: true, skin }, { headers: noStore });
}

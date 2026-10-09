/* POST /api/blockshot/armory/equip { slot, item } — wear a finish you own, or "factory" for the plain look (2026-10-10). The match
   server reads the loadout at login (eastscape/verify.js), so a change shows to others from the next match. */
import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureArmory, equip, armoryFor } from "../_armory.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "No database.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_AUTHENTICATED", "Sign in first.", 401);
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  await ensureArmory(db);
  const r = await equip(db, user.id, String(body.slot || ""), String(body.item || ""));
  if (!r.ok) return fail(r.code, r.code === "NOT_OWNED" ? "You don't own that." : "Not a thing you can wear.");
  return json({ ...r, me: await armoryFor(db, user.id) });
}

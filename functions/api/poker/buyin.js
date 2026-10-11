/* POST /api/poker/buyin — the dealer (X-Arcade-Key) asks for chips at a seat: { userId, table, chips, sessionId, addon? }.
   Answers { ok, chips, zc, fromBank, bank } or { ok:false, code, message }. NOT WIRED YET (see _poker.js). */
import { json, fail } from "../picks/_lib.js";
import { ensurePoker, fromDealer, buyIn } from "./_poker.js";

export async function onRequestPost(context) {
  if (!fromDealer(context)) return fail("FORBIDDEN", "Not the dealer.", 403);
  const db = context.env.PICKS_DB; if (!db) return fail("NO_DB", "Offline.", 503);
  await ensurePoker(db);
  let body; try { body = await context.request.json(); } catch { return fail("BAD_JSON", "Send JSON.", 400); }
  const r = await buyIn(context.env, db, { userId: String(body?.userId || ""), tableKey: String(body?.table || "nickel"), chips: body?.chips, sessionId: String(body?.sessionId || ""), addon: Boolean(body?.addon) });
  return json(r, r.ok ? 200 : 409);
}

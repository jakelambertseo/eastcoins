/* POST /api/poker/cashout — the dealer (X-Arcade-Key) hands a stack back: { sessionId, chips }. Into the chip bank, never straight to
   ZCoins. Idempotent per session. NOT WIRED YET (see _poker.js). */
import { json, fail } from "../picks/_lib.js";
import { ensurePoker, fromDealer, cashOut } from "./_poker.js";

export async function onRequestPost(context) {
  if (!fromDealer(context)) return fail("FORBIDDEN", "Not the dealer.", 403);
  const db = context.env.PICKS_DB; if (!db) return fail("NO_DB", "Offline.", 503);
  await ensurePoker(db);
  let body; try { body = await context.request.json(); } catch { return fail("BAD_JSON", "Send JSON.", 400); }
  const r = await cashOut(db, { sessionId: String(body?.sessionId || ""), chips: body?.chips });
  return json(r, r.ok ? 200 : 409);
}

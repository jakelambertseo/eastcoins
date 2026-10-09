/* GET /api/blockshot/armory — the catalogue for everyone, and for the signed-in player their Brass, the finishes they own and what they
   wear (2026-10-10). Nothing is written here; rolls go through armory/roll.js, wearing through armory/equip.js. */
import { getSessionUser } from "../picks/_lib.js";
import { ensureArmory, armoryFor, catalogue } from "./_armory.js";

const noStore = { "Cache-Control": "no-store" };
export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: noStore });
  const user = await getSessionUser(db, context.request);
  if (!user) return Response.json({ ok: true, me: null, catalogue: catalogue() }, { headers: noStore });
  await ensureArmory(db);
  return Response.json({ ok: true, me: await armoryFor(db, user.id), catalogue: catalogue() }, { headers: noStore });
}

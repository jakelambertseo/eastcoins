/* GET /api/picks/ledger — the community ledger, the full 200 rows.

   Fetched by the Picks page's Ledger tab when it opens, and by nothing
   else. It used to ride inside every bootstrap call; see the note on
   getCommunityLedger. Members only since 2026-09-16, so it is never
   cached: a cached 200 would be handed to the next visitor at the door. */

import { getCommunityLedger } from "./bootstrap.js";
import { requireLogin } from "../screen/_gate.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503 });
  // Members only, like the page that asks for it.
  const gate = await requireLogin(context, "Log in with Twitch to see the ledger.");
  if (gate.denied) return gate.denied;
  let ledger = [];
  try { ledger = await getCommunityLedger(db); } catch { ledger = []; }
  return Response.json({ ok: true, ledger }, { headers: { "Cache-Control": "no-store" } });
}

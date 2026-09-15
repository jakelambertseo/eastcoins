/* GET /api/picks/ledger — the community ledger, the full 200 rows.

   Fetched by the Picks page's Ledger tab when it opens, and by nothing
   else. It used to ride inside every bootstrap call; see the note on
   getCommunityLedger. Public data, so the edge may hold it briefly the
   way /api/picks/activity is held. */

import { getCommunityLedger } from "./bootstrap.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503 });
  let ledger = [];
  try { ledger = await getCommunityLedger(db); } catch { ledger = []; }
  return Response.json({ ok: true, ledger }, {
    headers: { "Cache-Control": "public, max-age=20" }
  });
}

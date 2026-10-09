/* GET /api/blockshot/board?by=kills|kd|wins|headshots|level|accuracy&range=all|week|today — the leaderboard (2026-10-09). Public, cached
   at the edge for 30 seconds: the page polls nothing, it reads this when the Board tab opens. Accuracy needs 50 shots to rank. */
import { ensureBlockshot, boardFor, BY } from "./_stats.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const u = new URL(context.request.url);
  const by = BY[u.searchParams.get("by")] ? u.searchParams.get("by") : "kills", range = ["all", "week", "today"].includes(u.searchParams.get("range")) ? u.searchParams.get("range") : "all";
  await ensureBlockshot(db);
  const rows = await boardFor(db, by, range === "today" ? "day" : range, 25);
  return Response.json({ ok: true, by, range, rows }, { headers: { "Cache-Control": "public, max-age=30" } });
}

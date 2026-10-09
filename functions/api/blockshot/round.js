/* POST /api/blockshot/round — the match server reports a finished round (2026-10-09). The only writer of Blockshot's stats.
   { round: id, map, results: [{ id, login, name, kills, deaths, headshots, shots, hits, place, won, streak, seconds, xp }] }
   Proved with X-Arcade-Key = ARCADE_KEY (a secret on the arcade worker and on this Pages project). Each (round, player) counts once. */
import { ensureBlockshot, applyRound } from "./_stats.js";

const noStore = { "Cache-Control": "no-store" };
export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: noStore });
  const want = String(context.env.ARCADE_KEY || "").trim(), got = String(context.request.headers.get("X-Arcade-Key") || "").trim();
  if (!want || got !== want) return Response.json({ ok: false, code: "KEY" }, { status: 401, headers: noStore });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  const roundId = String(body.round || "").slice(0, 64), map = String(body.map || "").slice(0, 24), results = Array.isArray(body.results) ? body.results : [];
  if (!roundId || !results.length) return Response.json({ ok: false, code: "BAD" }, { status: 400, headers: noStore });
  await ensureBlockshot(db);
  const applied = await applyRound(db, roundId, map, results);
  return Response.json({ ok: true, applied }, { headers: noStore });
}

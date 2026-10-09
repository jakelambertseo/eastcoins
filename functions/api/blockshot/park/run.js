/* POST /api/blockshot/park/run — the parkour room reports a finished run (2026-10-10). { id, login, name, course, ms, falls, trail }
   Proved with X-Arcade-Key. Keeps the best, the ghost, the medals; pays Brass for a medal earned for the first time. */
import { ensurePark, saveRun } from "../_park.js";

const noStore = { "Cache-Control": "no-store" };
export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: noStore });
  const want = String(context.env.ARCADE_KEY || "").trim(), got = String(context.request.headers.get("X-Arcade-Key") || "").trim();
  if (!want || got !== want) return Response.json({ ok: false, code: "KEY" }, { status: 401, headers: noStore });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  await ensurePark(db);
  const r = await saveRun(db, { id: String(body.id || ""), login: String(body.login || ""), name: String(body.name || ""), course: String(body.course || ""), ms: body.ms, falls: body.falls, trail: body.trail });
  return Response.json(r, { status: r.ok ? 200 : 400, headers: noStore });
}

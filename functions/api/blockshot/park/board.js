/* GET /api/blockshot/park/board?course=course1 — the course's best times, and the signed-in player's own bests and medals (2026-10-10). */
import { getSessionUser } from "../../picks/_lib.js";
import { ensurePark, boardFor, mineFor, COURSES } from "../_park.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB, url = new URL(context.request.url), course = url.searchParams.get("course") || "course1";
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503 });
  if (!COURSES[course]) return Response.json({ ok: false, code: "COURSE" }, { status: 400 });
  await ensurePark(db);
  const user = await getSessionUser(db, context.request);
  return Response.json({ ok: true, course, courses: COURSES, rows: await boardFor(db, course), mine: user ? await mineFor(db, user.id) : null }, { headers: { "Cache-Control": "no-store" } });
}

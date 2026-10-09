/* GET /api/blockshot/park/ghost?course=course1&who=record|me — a ghost: the course record's trail, or the signed-in player's own best
   (2026-10-10). Positions every 100 ms, drawn by the page as a see-through bean beside the runner. */
import { getSessionUser } from "../../picks/_lib.js";
import { ensurePark, ghostFor, COURSES } from "../_park.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB, url = new URL(context.request.url), course = url.searchParams.get("course") || "course1", who = url.searchParams.get("who") || "record";
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503 });
  if (!COURSES[course]) return Response.json({ ok: false, code: "COURSE" }, { status: 400 });
  await ensurePark(db);
  let userId = null; if (who === "me") { const user = await getSessionUser(db, context.request); if (!user) return Response.json({ ok: true, ghost: null }); userId = user.id; }
  return Response.json({ ok: true, ghost: await ghostFor(db, course, userId) }, { headers: { "Cache-Control": who === "me" ? "no-store" : "public, max-age=30" } });
}

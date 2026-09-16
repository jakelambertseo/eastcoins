/* POST /api/games/centre/finish  { run, stops: [0.5, 0.48, ...] } */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureGames, chicagoDay, saveScore, board, recordFor } from "../_games.js";
import { ensureCentre, replay, SHOTS } from "./_centre.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureCentre(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const runId = String(body.run || "");
  const stops = Array.isArray(body.stops) ? body.stops.slice(0, SHOTS) : [];
  if (!runId) return fail("BAD_RUN", "Which run?");

  const run = await db.prepare(`SELECT * FROM centre_runs WHERE id = ?`).bind(runId).first();
  if (!run) return fail("NO_RUN", "That run is gone. Start another.", 404);
  if (String(run.user_id) !== String(user.id)) return fail("NOT_YOURS", "That isn't your run.", 403);
  if (run.finished_at) return fail("ALREADY_IN", "That run is already in the books.", 409);

  const result = await replay(run.seed, stops);
  const day = chicagoDay(Date.now());
  await db.prepare(`UPDATE centre_runs SET total = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(result.total, runId).run();
  const saved = await saveScore(db, {
    game: "centre", userId: user.id, day,
    score: result.total,
    detail: { best: result.bestShot },
    keepBest: true
  });

  return json({
    ok: true,
    total: result.total,
    shots: result.shots,
    best: Boolean(saved.best),
    record: await recordFor(db, "centre", user.id),
    board: await board(db, "centre", day, 10)
  });
}

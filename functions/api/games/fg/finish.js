/* POST /api/games/fg/finish  { run, kicks: [{ power, aim }, ...] }

   Replays the run against the wind it was played in and keeps the
   best of the day. A run can only be handed in once. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureGames, chicagoDay, saveScore, board, recordFor } from "../_games.js";
import { ensureFg, replay, MAX_KICKS } from "./_fg.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureFg(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const runId = String(body.run || "");
  const kicks = Array.isArray(body.kicks) ? body.kicks.slice(0, MAX_KICKS) : [];
  if (!runId) return fail("BAD_RUN", "Which run?");

  const run = await db.prepare(`SELECT * FROM fg_runs WHERE id = ?`).bind(runId).first();
  if (!run) return fail("NO_RUN", "That run is gone. Start another.", 404);
  if (String(run.user_id) !== String(user.id)) return fail("NOT_YOURS", "That isn't your run.", 403);
  if (run.finished_at) return fail("ALREADY_IN", "That run is already in the books.", 409);

  const result = await replay(run.seed, kicks);
  const day = chicagoDay(Date.now());

  await db.prepare(`UPDATE fg_runs SET made = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(result.made, runId).run();
  const saved = await saveScore(db, {
    game: "fg", userId: user.id, day,
    score: result.made,
    detail: { longest: result.longest },
    keepBest: true
  });

  return json({
    ok: true,
    made: result.made,
    longest: result.longest,
    shots: result.shots,
    best: Boolean(saved.best),
    record: await recordFor(db, "fg", user.id),
    board: await board(db, "fg", day, 10)
  });
}

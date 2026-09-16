/* POST /api/games/simon/step  { run, answer: [0,2,1,...] }

   The round played back. Right, and the next pad comes with it;
   wrong, and the run closes at however many rounds were cleared. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureGames, chicagoDay, saveScore, board, recordFor } from "../_games.js";
import { ensureSimon, sequenceFor, MAX_ROUNDS } from "./_simon.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureSimon(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const runId = String(body.run || "");
  const answer = Array.isArray(body.answer) ? body.answer.map((n) => Number(n)) : [];
  if (!runId) return fail("BAD_RUN", "Which run?");

  const run = await db.prepare(`SELECT * FROM simon_runs WHERE id = ?`).bind(runId).first();
  if (!run) return fail("NO_RUN", "That run is gone. Start another.", 404);
  if (String(run.user_id) !== String(user.id)) return fail("NOT_YOURS", "That isn't your run.", 403);
  if (run.over) return fail("OVER", "That run is finished.", 409);

  const round = Number(run.round);
  const wanted = await sequenceFor(run.seed, round);
  const right = answer.length === wanted.length && wanted.every((v, i) => v === answer[i]);

  if (right && round < MAX_ROUNDS) {
    const next = round + 1;
    await db.prepare(`UPDATE simon_runs SET round = ? WHERE id = ?`).bind(next, runId).run();
    return json({ ok: true, right: true, over: false, round: next, sequence: await sequenceFor(run.seed, next) });
  }

  // Either they got it wrong, or they have run the table.
  const cleared = right ? round : round - 1;
  const day = chicagoDay(Date.now());
  await db.prepare(`UPDATE simon_runs SET over = 1 WHERE id = ?`).bind(runId).run();
  const saved = await saveScore(db, { game: "simon", userId: user.id, day, score: cleared, detail: {}, keepBest: true });

  return json({
    ok: true,
    right,
    over: true,
    cleared,
    // Where it went wrong, so the last round can be replayed on screen.
    sequence: wanted,
    best: Boolean(saved.best),
    record: await recordFor(db, "simon", user.id),
    board: await board(db, "simon", day, 10)
  });
}

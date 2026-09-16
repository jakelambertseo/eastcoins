/* POST /api/games/simon/start — a new run, and the first pad */

import { getSessionUser, json, fail, newId } from "../../picks/_lib.js";
import { ensureGames } from "../_games.js";
import { ensureSimon, sequenceFor, randomSeed, PADS } from "./_simon.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureSimon(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM simon_runs WHERE user_id = ? AND created_at >= datetime('now', '-1 minute')`)
    .bind(user.id)
    .first()
    .catch(() => null);
  if (Number(recent?.n || 0) >= 20) return fail("SLOW_DOWN", "Give it a second.", 429);

  const id = newId("sim");
  const seed = randomSeed();
  await db.prepare(`INSERT INTO simon_runs (id, user_id, seed, round) VALUES (?, ?, ?, 1)`).bind(id, user.id, seed).run();

  return json({
    ok: true,
    run: id,
    round: 1,
    // Only the round about to be played. The rest of the sequence stays here.
    sequence: await sequenceFor(seed, 1),
    pads: PADS
  });
}

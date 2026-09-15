/* POST /api/games/centre/start — a run, and the speed of each sweep */

import { getSessionUser, json, fail, newId } from "../../picks/_lib.js";
import { ensureGames } from "../_games.js";
import { ensureCentre, speedsFor, randomSeed, SHOTS, MAX_POINTS } from "./_centre.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureCentre(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM centre_runs WHERE user_id = ? AND created_at >= datetime('now', '-1 minute')`)
    .bind(user.id)
    .first()
    .catch(() => null);
  if (Number(recent?.n || 0) >= 15) return fail("SLOW_DOWN", "Give it a second.", 429);

  const id = newId("dc");
  const seed = randomSeed();
  await db.prepare(`INSERT INTO centre_runs (id, user_id, seed) VALUES (?, ?, ?)`).bind(id, user.id, seed).run();

  return json({ ok: true, run: id, speeds: await speedsFor(seed), config: { shots: SHOTS, maxPoints: MAX_POINTS } });
}

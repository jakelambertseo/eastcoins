/* POST /api/games/fg/start — a new run

   Hands back a run id and the wind for every kick in it. The wind is
   public on purpose: a kicker can see the flags. The seed behind it
   stays here, so the run handed in at the end can be replayed against
   the same conditions it was played in. */

import { getSessionUser, json, fail, newId } from "../../picks/_lib.js";
import { ensureGames } from "../_games.js";
import { ensureFg, windsFor, randomSeed, MAX_KICKS, FIRST_YARDS, STEP_YARDS } from "./_fg.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureFg(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  // A run costs nothing, but an unbounded stream of them is still a
  // stream of writes; a few a minute is more than anyone can kick.
  const recent = await db
    .prepare(`SELECT COUNT(*) AS n FROM fg_runs WHERE user_id = ? AND created_at >= datetime('now', '-1 minute')`)
    .bind(user.id)
    .first()
    .catch(() => null);
  if (Number(recent?.n || 0) >= 12) return fail("SLOW_DOWN", "Give it a second.", 429);

  const id = newId("fg");
  const seed = randomSeed();
  await db.prepare(`INSERT INTO fg_runs (id, user_id, seed) VALUES (?, ?, ?)`).bind(id, user.id, seed).run();

  return json({
    ok: true,
    run: id,
    winds: await windsFor(seed),
    config: { firstYards: FIRST_YARDS, stepYards: STEP_YARDS, maxKicks: MAX_KICKS }
  });
}

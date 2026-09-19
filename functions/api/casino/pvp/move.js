/* POST /api/casino/pvp/move  { game: "redlight", run: <ms> }

   One sprint for the light that is open right now. The server decides
   which light that is from its own clock — the body never names one —
   and the first sprint a seat sends for a light is the one that stands
   (the row's primary key is round + seat + light, INSERT OR IGNORE).

   No money moves here. What keeps this honest is only ever timing:
   a sprint is accepted while the light is open or inside its grace,
   and the turn for that light is not told to anybody until the grace
   is over (state.js, raceView), so nothing sent here can have been
   chosen with the answer in hand. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensurePvp, gameFor, lobbyFor, entriesFor, runsFor } from "./_pvp.js";
import { replay, lightOpen, lightsClosed, cleanRun } from "./_redlight.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensurePvp(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const game = gameFor(body.game);
  if (!game?.played) return fail("BAD_GAME", "That table isn't played this way.");

  const now = Date.now();
  const row = await lobbyFor(db, game);
  if (!row || Number(row.starts_at) > now) return fail("NOT_RUNNING", "There's no race on.", 409);

  const entries = await entriesFor(db, row.id);
  const seat = entries.findIndex((e) => e.user_id === String(user.id));
  if (seat < 0) return fail("NOT_IN", "You're not in this race.", 403);

  const light = lightOpen(Number(row.starts_at), now);
  if (light < 0) return fail("NO_LIGHT", "Too late for that light.", 409);

  // out is out: a runner the closed lights have already eliminated sends nothing more
  const sofar = await replay(row.seed, entries.length, await runsFor(db, row.id), lightsClosed(Number(row.starts_at), now));
  if (sofar.winner !== null) return fail("OVER", "The race is over.", 409);
  if (!sofar.alive[seat]) return fail("OUT", "You're out of this one.", 409);

  const run = cleanRun(body.run);
  const put = await db
    .prepare(`INSERT OR IGNORE INTO pvp_moves (round_id, seat, light, run_ms) VALUES (?, ?, ?, ?)`)
    .bind(row.id, seat, light, run)
    .run();
  if (!put.meta?.changes) {
    const kept = await db.prepare(`SELECT run_ms FROM pvp_moves WHERE round_id = ? AND seat = ? AND light = ?`).bind(row.id, seat, light).first();
    return json({ ok: true, light, run: Number(kept?.run_ms ?? run), already: true });
  }
  return json({ ok: true, light, run });
}

/* POST /api/games/gold/claim — press it

   First one in takes the day. The window is checked here rather than
   trusted from the page, so a press sent at any other time is simply
   not a press. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureGames, seedFor, chicagoDay, saveScore, board } from "../_games.js";
import { ensureGold, triggerFor, winnerFor, scoreFor, WINDOW_MS } from "./_gold.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureGold(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to press it.", 401);

  const now = Date.now();
  const day = chicagoDay(now);
  const seed = await seedFor(db, "gold", day);
  const at = await triggerFor(day, seed);
  if (now < at || now >= at + WINDOW_MS) return fail("NOT_OPEN", "The button isn't up.", 409);

  const took = now - at;
  // The day is the primary key: whoever lands first is the only one who lands.
  await db.prepare(`INSERT OR IGNORE INTO gold_claims (day, user_id, took_ms) VALUES (?, ?, ?)`).bind(day, user.id, took).run();
  const winner = await winnerFor(db, day);
  const mine = winner && winner.user.login === user.login;

  if (mine) {
    await saveScore(db, { game: "gold", userId: user.id, day, score: scoreFor(took), detail: { tookMs: took } });
  }

  return json({
    ok: true,
    won: Boolean(mine),
    tookMs: took,
    winner,
    board: await board(db, "gold", day, 5)
  });
}

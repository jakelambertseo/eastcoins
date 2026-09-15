/* GET /api/games/gold/state — is it up, and who took it today

   The Game Room reads this for its card. Everyone else finds out
   through the bell, which carries the window without a request of
   its own. This never says when the button is DUE. */

import { json, fail } from "../../picks/_lib.js";
import { ensureGames, seedFor, chicagoDay } from "../_games.js";
import { ensureGold, goldState, winnerFor } from "./_gold.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureGold(db);

  const now = Date.now();
  const day = chicagoDay(now);
  const seed = await seedFor(db, "gold", day);

  return json({
    ok: true,
    day,
    gold: await goldState(db, day, seed, now),
    winner: await winnerFor(db, day)
  });
}

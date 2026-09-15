/* GET /api/games/helmet/state — today's crest as far as this player has
   got with it: the guesses made, how far the crop has pulled back, the
   hints earned, and the answer once it is over. Never the answer before. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureGames, seedFor, chicagoDay, board, recordFor } from "../_games.js";
import { ensureHelmet, teamFor, cropFor, hintsFor, parseGuesses, MAX_GUESSES, ZOOMS, NFL } from "./_helmet.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureHelmet(db);

  const day = chicagoDay(Date.now());
  const seed = await seedFor(db, "helmet", day);
  const team = await teamFor(seed);
  const crop = await cropFor(seed);
  const user = await getSessionUser(db, context.request);

  let play = null;
  if (user) play = await db.prepare(`SELECT * FROM helmet_plays WHERE day = ? AND user_id = ?`).bind(day, user.id).first();
  const guesses = parseGuesses(play?.guesses);
  const solved = Boolean(play?.solved);
  const done = Boolean(play?.done);
  const wrong = solved ? guesses.length - 1 : guesses.length;
  const zoom = ZOOMS[Math.min(wrong, ZOOMS.length - 1)];

  return json({
    ok: true,
    day,
    guesses,
    done,
    solved,
    left: Math.max(0, MAX_GUESSES - guesses.length),
    maxGuesses: MAX_GUESSES,
    // The crop the page should draw, and where from. The image itself is
    // behind /img, which is keyed on the day and never names the club.
    zoom: done ? 1 : zoom,
    crop,
    hints: done ? { conference: null, division: null } : hintsFor(team, wrong),
    // Only once it is over.
    answer: done ? { abbr: team[0], name: team[1] } : null,
    teams: NFL.map(([abbr, name]) => ({ abbr, name })),
    me: user ? { login: user.login, displayName: user.displayName, record: await recordFor(db, "helmet", user.id) } : null,
    board: await board(db, "helmet", day, 10)
  });
}

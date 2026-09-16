/* POST /api/games/helmet/guess  { guess }

   One guess against today's crest. The answer lives here and nowhere
   else, so a wrong guess costs a look and a right one is real. Six
   tries; the score is 6 for a first-guess win down to 1 for a sixth,
   and nothing for a miss. One play a day, enforced by the row itself. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureGames, seedFor, chicagoDay, saveScore, board, recordFor } from "../_games.js";
import { ensureHelmet, teamFor, matchTeam, hintsFor, parseGuesses, scoreFor, MAX_GUESSES, ZOOMS } from "./_helmet.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureHelmet(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const said = String(body.guess || "").slice(0, 40);
  const guessed = matchTeam(said);
  if (guessed?.ambiguous) return fail("WHICH_ONE", `Two clubs there: the ${guessed.ambiguous.map((n) => n.split(" ").pop()).join(" or the ")}. Which?`);
  if (!guessed) return fail("NO_TEAM", `No NFL club called “${said.trim() || "that"}”. Try the city or the nickname.`);

  const day = chicagoDay(Date.now());
  await db.prepare(`INSERT OR IGNORE INTO helmet_plays (day, user_id) VALUES (?, ?)`).bind(day, user.id).run();
  const play = await db.prepare(`SELECT * FROM helmet_plays WHERE day = ? AND user_id = ?`).bind(day, user.id).first();
  if (play?.done) return fail("DONE", "You've already played today's crest. A new one at midnight Central.", 409);

  const guesses = parseGuesses(play?.guesses);
  if (guesses.some((g) => g.abbr === guessed[0])) return fail("REPEAT", `You've already tried the ${guessed[1].split(" ").pop()}.`);

  const seed = await seedFor(db, "helmet", day);
  const team = await teamFor(seed);
  const right = guessed[0] === team[0];
  guesses.push({ abbr: guessed[0], name: guessed[1], right });

  const done = right || guesses.length >= MAX_GUESSES;
  await db
    .prepare(`UPDATE helmet_plays SET guesses = ?, solved = ?, done = ?, updated_at = CURRENT_TIMESTAMP WHERE day = ? AND user_id = ?`)
    .bind(JSON.stringify(guesses), right ? 1 : 0, done ? 1 : 0, day, user.id)
    .run();

  if (done) {
    await saveScore(db, {
      game: "helmet", userId: user.id, day,
      score: scoreFor(guesses.length, right),
      detail: { guesses: guesses.length, solved: right, team: team[0] }
    });
  }

  const wrong = right ? guesses.length - 1 : guesses.length;
  return json({
    ok: true,
    right,
    done,
    guesses,
    left: Math.max(0, MAX_GUESSES - guesses.length),
    zoom: done ? 1 : ZOOMS[Math.min(wrong, ZOOMS.length - 1)],
    hints: done ? { conference: null, division: null } : hintsFor(team, wrong),
    answer: done ? { abbr: team[0], name: team[1] } : null,
    score: done ? scoreFor(guesses.length, right) : null,
    record: await recordFor(db, "helmet", user.id),
    board: done ? await board(db, "helmet", day, 10) : null
  });
}

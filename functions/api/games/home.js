/* GET /api/games/home — the Game Room

   Every game with today's state for whoever is asking, today's boards,
   and who has won the most days this month. Nothing here moves a
   ZCoin; the Game Room is played for titles. */

import { getSessionUser, json, fail } from "../picks/_lib.js";
import { ensureGames, GAMES, chicagoDay, board, recordFor, myScore, champions, seedFor } from "./_games.js";
import { ensureHelmet, parseGuesses, MAX_GUESSES } from "./helmet/_helmet.js";
import { ensureGold, goldState, winnerFor } from "./gold/_gold.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The Game Room is offline.", 503);
  await ensureGames(db);
  await ensureHelmet(db).catch(() => {});

  const now = Date.now();
  const day = chicagoDay(now);
  const user = await getSessionUser(db, context.request);
  await ensureGold(db).catch(() => {});
  const goldSeed = await seedFor(db, "gold", day).catch(() => null);
  const goldWinner = goldSeed ? await winnerFor(db, day) : null;

  const games = [];
  for (const g of Object.values(GAMES)) {
    const mine = user ? await myScore(db, g.key, user.id, day) : null;
    const entry = {
      key: g.key, name: g.name, icon: g.icon, blurb: g.blurb, route: g.route, daily: g.daily,
      board: await board(db, g.key, day, 5),
      played: Boolean(mine),
      myScore: mine ? Number(mine.score) : null,
      record: user ? await recordFor(db, g.key, user.id) : null
    };
    if (g.key === "helmet" && user) {
      const play = await db.prepare(`SELECT guesses, solved, done FROM helmet_plays WHERE day = ? AND user_id = ?`).bind(day, user.id).first().catch(() => null);
      const guesses = parseGuesses(play?.guesses);
      entry.state = play?.done ? (play.solved ? `Got it in ${guesses.length}` : "Missed it") : guesses.length ? `${MAX_GUESSES - guesses.length} guesses left` : null;
    }
    if (g.key === "fg" && mine) entry.state = `Best today ${Number(mine.score)}`;
    if (g.key === "simon" && mine) entry.state = `Best today ${Number(mine.score)} rounds`;
    if (g.key === "centre" && mine) entry.state = `Best today ${Number(mine.score)}`;
    if (g.key === "gold") {
      entry.open = Boolean(goldSeed && (await goldState(db, day, goldSeed, now)));
      entry.winner = goldWinner;
      entry.state = goldWinner ? `${goldWinner.user.displayName} took it` : entry.open ? "It's up right now" : "Still to come";
    }
    games.push(entry);
  }

  // How many people have had a go at anything today.
  const players = await db
    .prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM game_scores WHERE day = ?`)
    .bind(day)
    .first()
    .catch(() => null);

  return json({
    ok: true,
    day,
    games,
    playersToday: Number(players?.n || 0),
    champions: await champions(db, day),
    me: user ? { login: user.login, displayName: user.displayName } : null
  });
}

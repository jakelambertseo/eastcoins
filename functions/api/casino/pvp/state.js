/* GET /api/casino/pvp/state?game=roulette|standing

   The open lobby if there is one (who is in, when it starts, the hash
   of the seed that will decide it), the most recent finished round
   with its seed revealed so the page can play it back and anyone can
   check it, a short history, the room, and the caller's own limits.

   Asking is also what settles: any round whose clock has run out is
   paid before the answer is built, so the first poll after the
   countdown is what makes the round happen — the same way the coin
   settles on the first poll after a flip. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor, hourlyNet, HOUR_WIN_CAP, MAX_BETS_PER_HOUR } from "../_engine.js";
import { ensurePvp, gameFor, settleDue, lobbyFor, entriesFor, publicRound, joinsLastHour, STAKE, LOBBY_MS, MIN_PLAYERS, MAX_PLAYERS, chambersFor } from "./_pvp.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensurePvp(db);

  const url = new URL(context.request.url);
  const game = gameFor(url.searchParams.get("game"));
  if (!game) return json({ ok: false, code: "BAD_GAME" }, 400);

  const now = Date.now();
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, game, user.id, now);

  await settleDue(context.env, db, game, now);

  const lobbyRow = await lobbyFor(db, game);
  const lobby = lobbyRow ? publicRound(lobbyRow, await entriesFor(db, lobbyRow.id), { viewerId: user?.id }) : null;

  const lastRow = await db
    .prepare(`SELECT * FROM pvp_rounds WHERE game = ? AND status IN ('SETTLED', 'VOID') ORDER BY settled_at DESC LIMIT 1`)
    .bind(game.key)
    .first();
  const last = lastRow ? publicRound(lastRow, await entriesFor(db, lastRow.id), { revealSeed: true, viewerId: user?.id }) : null;

  // One row per finished round, with the one person the round was
  // really about: the loser at roulette, the winner at last standing.
  const notable = game.key === "roulette" ? "LOST" : "WON";
  const hist = await db
    .prepare(
      `SELECT r.id, r.status, r.settled_at, r.players, r.pot, u.twitch_login, u.display_name, u.avatar_url
         FROM pvp_rounds r
         LEFT JOIN pvp_entries e ON e.round_id = r.id AND e.status = ?
         LEFT JOIN users u ON u.twitch_id = e.user_id
        WHERE r.game = ? AND r.status IN ('SETTLED', 'VOID')
        ORDER BY r.settled_at DESC LIMIT 30`
    )
    .bind(notable, game.key)
    .all()
    .catch(() => ({ results: [] }));
  const history = (hist.results || []).map((r) => ({
    id: r.id,
    status: r.status,
    at: r.settled_at ? Number(r.settled_at) : null,
    players: Number(r.players || 0),
    pot: Number(r.pot || 0),
    who: r.twitch_login
      ? { login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
      : null
  }));

  let me = null;
  if (user) {
    me = {
      id: user.id, login: user.login, displayName: user.displayName,
      joinsThisHour: await joinsLastHour(db, game, user.id),
      hourNet: await hourlyNet(db, user.id)
    };
  }

  // What each table size pays, so the page can show it without doing
  // the maths itself and disagreeing with the server.
  const table = [];
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n += 1) {
    table.push(game.key === "roulette"
      ? { players: n, chambers: chambersFor(n), pullsEach: chambersFor(n) / n, win: Math.floor(STAKE / (n - 1)), lose: STAKE }
      : { players: n, pot: STAKE * n, chance: n });
  }

  return json({
    ok: true,
    now,
    game: game.key,
    name: game.name,
    config: {
      stake: STAKE, lobbySeconds: LOBBY_MS / 1000, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS,
      maxPerHour: MAX_BETS_PER_HOUR, hourCap: HOUR_WIN_CAP,
      canBet: Boolean(user) && walletWritesEnabled(context.env),
      table
    },
    lobby,
    last,
    history,
    room: await roomFor(db, game, now),
    me
  });
}

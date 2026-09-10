/* GET /api/casino/home — one poll for the casino floor.

   Per game: where the round clock is, how many are in this round
   and who's in the room. Plus the biggest recent wins across every
   game, for the board. Public; a session adds nothing here. */

import { ensureSchema as ensureCoin, roundAt as coinRoundAt, CYCLE_MS as COIN_CYCLE, BET_MS as COIN_BET } from "../coin/_coin.js";
import { GAMES, ensureSchema, roundAt, ROOM_WINDOW_MS } from "./_engine.js";
import { ensureHilo } from "./hilo/_hilo.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await Promise.all([ensureCoin(db), ensureSchema(db), ensureHilo(db)]);
  const now = Date.now();
  const since = now - ROOM_WINDOW_MS;

  // Coin flip: its own tables.
  const coinRound = coinRoundAt(now);
  const [coinIn, coinRoom] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(wager), 0) AS staked FROM coin_bets WHERE round_no = ?`).bind(coinRound.no).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM coin_presence WHERE seen_at >= ?`).bind(since).first()
  ]);

  const games = [{
    key: "flip", name: "Coin Flip", route: "flip",
    round: { no: coinRound.no, phase: coinRound.phase, closesAt: coinRound.flipsAt, endsAt: coinRound.endsAt, cycleSeconds: COIN_CYCLE / 1000, betSeconds: COIN_BET / 1000 },
    inRound: Number(coinIn?.n || 0), staked: Number(coinIn?.staked || 0), room: Number(coinRoom?.n || 0)
  }];

  for (const g of Object.values(GAMES)) {
    const r = roundAt(g, now);
    const [inRound, room] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(wager), 0) AS staked FROM casino_bets WHERE game = ? AND round_no = ?`).bind(g.key, r.no).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = ? AND seen_at >= ?`).bind(g.key, since).first()
    ]);
    games.push({
      key: g.key, name: g.name, route: g.key,
      round: { no: r.no, phase: r.phase, closesAt: r.closesAt, endsAt: r.endsAt, cycleSeconds: g.cycleMs / 1000, betSeconds: g.betMs / 1000 },
      inRound: Number(inRound?.n || 0), staked: Number(inRound?.staked || 0), room: Number(room?.n || 0)
    });
  }

  const [hiloLive, hiloRoom] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM hilo_games WHERE status = 'LIVE' AND datetime(updated_at) >= datetime('now', '-10 minutes')`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = 'hilo' AND seen_at >= ?`).bind(since).first()
  ]);
  games.push({ key: "hilo", name: "Higher or Lower", route: "hilo", round: null, inRound: Number(hiloLive?.n || 0), staked: 0, room: Number(hiloRoom?.n || 0) });

  // The board: biggest wins in the last day, across every game.
  const [coinWins, casinoWins, hiloWins] = await Promise.all([
    db.prepare(`SELECT 'flip' AS game, b.payout - b.wager AS profit, b.wager, b.side AS pick, b.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM coin_bets b JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status = 'WON' AND datetime(b.created_at) >= datetime('now', '-1 day') ORDER BY profit DESC LIMIT 5`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT b.game, b.payout - b.wager AS profit, b.wager, b.pick, b.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM casino_bets b JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status = 'WON' AND datetime(b.created_at) >= datetime('now', '-1 day') ORDER BY profit DESC LIMIT 5`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'hilo' AS game, g.payout - g.stake AS profit, g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM hilo_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE g.status = 'CASHED' AND datetime(g.updated_at) >= datetime('now', '-1 day') ORDER BY profit DESC LIMIT 5`).all().catch(() => ({ results: [] }))
  ]);
  const board = [...(coinWins.results || []), ...(casinoWins.results || []), ...(hiloWins.results || [])]
    .map((r) => ({
      game: r.game, profit: Number(r.profit), wager: Number(r.wager), pick: String(r.pick),
      at: String(r.at).replace(" ", "T") + "Z",
      user: { login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8);

  return json({ ok: true, now, games, board });
}

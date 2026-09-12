/* GET /api/casino/home — one poll for the casino floor.

   Per game: where the round clock is, how many are in this round
   and who's in the room. Plus the biggest recent wins across every
   game, for the board. Public; a session adds nothing here. */

import { ensureSchema as ensureCoin, roundAt as coinRoundAt, CYCLE_MS as COIN_CYCLE, BET_MS as COIN_BET } from "../coin/_coin.js";
import { GAMES, ensureSchema, roundAt, ROOM_WINDOW_MS, hourlyNet, HOUR_WIN_CAP } from "./_engine.js";
import { ensureHilo } from "./hilo/_hilo.js";
import { ensureMines } from "./mines/_mines.js";
import { ensurePlinko } from "./plinko/_plinko.js";
import { getSessionUser } from "../picks/_lib.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await Promise.all([ensureCoin(db), ensureSchema(db), ensureHilo(db), ensureMines(db), ensurePlinko(db)]);
  const now = Date.now();
  const since = now - ROOM_WINDOW_MS;

  // Coin flip: its own tables.
  const coinRound = coinRoundAt(now);
  const person = (r) => ({ login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") });
  const people = async (table, game) => {
    const rows = await db.prepare(`SELECT u.twitch_login, u.display_name, u.avatar_url FROM ${table} p JOIN users u ON u.twitch_id = p.user_id
                                    WHERE ${game ? "p.game = ? AND " : ""}p.seen_at >= ? ORDER BY p.seen_at DESC LIMIT 12`).bind(...(game ? [game, since] : [since])).all().catch(() => ({ results: [] }));
    return (rows.results || []).map(person);
  };
  const [coinIn, coinRoom, coinPeople] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(wager), 0) AS staked FROM coin_bets WHERE round_no = ?`).bind(coinRound.no).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM coin_presence WHERE seen_at >= ?`).bind(since).first(),
    people("coin_presence", null)
  ]);

  const games = [{
    key: "flip", name: "Coin Flip", route: "flip",
    round: { no: coinRound.no, phase: coinRound.phase, closesAt: coinRound.flipsAt, endsAt: coinRound.endsAt, cycleSeconds: COIN_CYCLE / 1000, betSeconds: COIN_BET / 1000 },
    inRound: Number(coinIn?.n || 0), staked: Number(coinIn?.staked || 0), room: Number(coinRoom?.n || 0), people: coinPeople
  }];

  for (const g of Object.values(GAMES)) {
    if (g.paused) continue;   // pulled from the floor for now
    const r = roundAt(g, now);
    const [inRound, room, who] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(wager), 0) AS staked FROM casino_bets WHERE game = ? AND round_no = ?`).bind(g.key, r.no).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = ? AND seen_at >= ?`).bind(g.key, since).first(),
      people("casino_presence", g.key)
    ]);
    games.push({
      key: g.key, name: g.name, route: g.key,
      round: { no: r.no, phase: r.phase, closesAt: r.closesAt, endsAt: r.endsAt, cycleSeconds: g.cycleMs / 1000, betSeconds: g.betMs / 1000 },
      inRound: Number(inRound?.n || 0), staked: Number(inRound?.staked || 0), room: Number(room?.n || 0), people: who
    });
  }

  const [hiloLive, hiloRoom, hiloPeople] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM hilo_games WHERE status = 'LIVE' AND updated_at >= datetime('now', '-10 minutes')`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = 'hilo' AND seen_at >= ?`).bind(since).first(),
    people("casino_presence", "hilo")
  ]);
  games.push({ key: "hilo", name: "Higher or Lower", route: "hilo", round: null, inRound: Number(hiloLive?.n || 0), staked: 0, room: Number(hiloRoom?.n || 0), people: hiloPeople });

  const [minesLive, minesRoom, minesPeople] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM mines_games WHERE status = 'LIVE' AND updated_at >= datetime('now', '-10 minutes')`).first().catch(() => null),
    db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = 'mines' AND seen_at >= ?`).bind(since).first().catch(() => null),
    people("casino_presence", "mines")
  ]);
  games.push({ key: "mines", name: "Mines", route: "mines", round: null, inRound: Number(minesLive?.n || 0), staked: 0, room: Number(minesRoom?.n || 0), people: minesPeople });

  const [plinkoRoom, plinkoPeople] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = 'plinko' AND seen_at >= ?`).bind(since).first().catch(() => null),
    people("casino_presence", "plinko")
  ]);
  games.push({ key: "plinko", name: "Plinko", route: "plinko", round: null, inRound: 0, staked: 0, room: Number(plinkoRoom?.n || 0), people: plinkoPeople });

  // The board: the most recent results across every game, wins and
  // losses alike — the casino's own ledger, for anyone to read.
  const [coinRes, casinoRes, hiloRes, minesRes, plinkoRes] = await Promise.all([
    db.prepare(`SELECT 'flip' AS game, b.status, b.payout - b.wager AS profit, b.wager, b.side AS pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM coin_bets b JOIN coin_rounds r ON r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT b.game, b.status, b.payout - b.wager AS profit, b.wager, b.pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM casino_bets b JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'hilo' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM hilo_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE g.status IN ('CASHED','BUST') ORDER BY datetime(g.updated_at) DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'mines' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM mines_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE g.status IN ('CASHED','BUST') ORDER BY datetime(g.updated_at) DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'plinko' AS game, CASE WHEN d.payout > d.stake THEN 'WON' ELSE 'LOST' END AS status, d.payout - d.stake AS profit,
                       d.stake AS wager, ('x' || ROUND(d.multiplier, 2)) AS pick, d.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM plinko_drops d JOIN users u ON u.twitch_id = d.user_id
                 ORDER BY datetime(d.created_at) DESC LIMIT 15`).all().catch(() => ({ results: [] }))
  ]);
  const board = [...(coinRes.results || []), ...(casinoRes.results || []), ...(hiloRes.results || []), ...(minesRes.results || []), ...(plinkoRes.results || [])]
    .map((r) => ({
      game: r.game, status: r.status, profit: Number(r.profit), wager: Number(r.wager), pick: String(r.pick),
      at: r.at ? String(r.at).replace(" ", "T") + "Z" : null,
      user: { login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
    }))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 20);

  // Signed in: their own casino numbers for the strip at the top.
  let me = null;
  try {
    const user = await getSessionUser(db, context.request);
    if (user) {
      const uid = String(user.id);
      const q = async (sql) => { try { return await db.prepare(sql).bind(uid).first(); } catch { return null; } };
      const [coin, shared, hilo, mines, plinko, hourNet] = await Promise.all([
        q(`SELECT SUM(status = 'WON') AS w, SUM(status = 'LOST') AS l, COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM coin_bets WHERE user_id = ?`),
        q(`SELECT SUM(status = 'WON') AS w, SUM(status = 'LOST') AS l, COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM casino_bets WHERE user_id = ?`),
        q(`SELECT SUM(status = 'CASHED') AS w, SUM(status = 'BUST') AS l, COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM hilo_games WHERE user_id = ?`),
        q(`SELECT SUM(status = 'CASHED') AS w, SUM(status = 'BUST') AS l, COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM mines_games WHERE user_id = ?`),
        q(`SELECT SUM(payout > stake) AS w, SUM(payout <= stake) AS l, COALESCE(SUM(payout - stake), 0) AS net FROM plinko_drops WHERE user_id = ?`),
        hourlyNet(db, uid)
      ]);
      const n = (x) => Number(x || 0);
      me = {
        login: user.login, displayName: user.displayName,
        wins: n(coin?.w) + n(shared?.w) + n(hilo?.w) + n(mines?.w) + n(plinko?.w),
        losses: n(coin?.l) + n(shared?.l) + n(hilo?.l) + n(mines?.l) + n(plinko?.l),
        net: n(coin?.net) + n(shared?.net) + n(hilo?.net) + n(mines?.net) + n(plinko?.net),
        hourNet: n(hourNet), hourCap: HOUR_WIN_CAP
      };
    }
  } catch { me = null; }

  return json({ ok: true, now, games, board, me });
}

/* GET /api/casino/home — one poll for the casino floor.

   Per game: where the round clock is, how many are in this round
   and who's in the room. Plus the biggest recent wins across every
   game, for the board. Public; a session adds nothing here. */

import { ensureSchema as ensureCoin, roundAt as coinRoundAt, CYCLE_MS as COIN_CYCLE, BET_MS as COIN_BET } from "../coin/_coin.js";
import { GAMES, ensureSchema, roundAt, ROOM_WINDOW_MS } from "./_engine.js";
import { ensureHilo } from "./hilo/_hilo.js";
import { ensureMines } from "./mines/_mines.js";
import { ensurePlinko } from "./plinko/_plinko.js";
import { ensureScratch } from "./scratch/_scratch.js";
import { ensurePvp, settleDue as settlePvp, GAMES as PVP, lobbyFor as pvpLobby, entriesFor as pvpEntries, STAKE as PVP_STAKE, lobbyMsFor as pvpLobbyMs } from "./pvp/_pvp.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await Promise.all([ensureCoin(db), ensureSchema(db), ensureHilo(db), ensureMines(db), ensurePlinko(db), ensurePvp(db)]);
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

  await ensureScratch(db).catch(() => {});
  const [scratchRoom, scratchPeople] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = 'scratch' AND seen_at >= ?`).bind(since).first().catch(() => null),
    people("casino_presence", "scratch")
  ]);
  games.push({ key: "scratch", name: "Scratch-Off", route: "scratch", round: null, inRound: 0, staked: 0, room: Number(scratchRoom?.n || 0), people: scratchPeople });

  // The PvP tables. The floor is polled far more widely than either
  // table's own page, so settling here is what pays a round whose
  // players all wandered off before the clock ran out.
  for (const g of Object.values(PVP)) {
    // Settle first, THEN skip a paused game: a lobby that was open when
    // the pause landed still has to play out or refund.
    await settlePvp(context.env, db, g, now).catch(() => {});
    if (g.paused) continue;
    const [lobby, room, who] = await Promise.all([
      pvpLobby(db, g).catch(() => null),
      db.prepare(`SELECT COUNT(*) AS n FROM casino_presence WHERE game = ? AND seen_at >= ?`).bind(g.key, since).first().catch(() => null),
      people("casino_presence", g.key)
    ]);
    const seats = lobby ? await pvpEntries(db, lobby.id).catch(() => []) : [];
    games.push({
      key: g.key, name: g.name, route: g.key, pvp: true, round: null,
      lobby: lobby ? { startsAt: Number(lobby.starts_at), players: seats.length, pot: PVP_STAKE * seats.length } : null,
      lobbySeconds: pvpLobbyMs(g) / 1000,
      inRound: seats.length, staked: PVP_STAKE * seats.length, room: Number(room?.n || 0), people: who
    });
  }

  // The board: the most recent results across every game, wins and
  // losses alike — the casino's own ledger, for anyone to read.
  const [coinRes, casinoRes, hiloRes, minesRes, plinkoRes, pvpRes, scratchRes] = await Promise.all([
    db.prepare(`SELECT 'flip' AS game, b.status, b.payout - b.wager AS profit, b.wager, b.side AS pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM coin_bets b JOIN coin_rounds r ON r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT b.game, b.status, b.payout - b.wager AS profit, b.wager, b.pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM casino_bets b JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'hilo' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM hilo_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE +g.status IN ('CASHED','BUST') ORDER BY g.updated_at DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'mines' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM mines_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE +g.status IN ('CASHED','BUST') ORDER BY g.updated_at DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'plinko' AS game, CASE WHEN d.payout > d.stake THEN 'WON' ELSE 'LOST' END AS status, d.payout - d.stake AS profit,
                       d.stake AS wager, ('x' || ROUND(d.multiplier, 2)) AS pick, d.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM plinko_drops d JOIN users u ON u.twitch_id = d.user_id
                 ORDER BY d.created_at DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT e.game, e.status, e.payout - e.stake AS profit, e.stake AS wager, (r.players || ' at the table') AS pick,
                       datetime(r.settled_at / 1000, 'unixepoch') AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM (SELECT id, players, settled_at FROM pvp_rounds WHERE settled_at IS NOT NULL ORDER BY settled_at DESC LIMIT 15) r
                  JOIN pvp_entries e ON e.round_id = r.id JOIN users u ON u.twitch_id = e.user_id
                 WHERE e.status IN ('WON','LOST') ORDER BY r.settled_at DESC LIMIT 15`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'scratch' AS game, CASE WHEN c.payout > c.stake THEN 'WON' ELSE 'LOST' END AS status, c.payout - c.stake AS profit,
                       c.stake AS wager, CASE WHEN c.prize IS NULL THEN 'no match' ELSE (c.prize || ' ×3') END AS pick, c.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM scratch_cards c JOIN users u ON u.twitch_id = c.user_id
                 ORDER BY c.created_at DESC LIMIT 15`).all().catch(() => ({ results: [] }))
  ]);
  const board = [...(coinRes.results || []), ...(casinoRes.results || []), ...(hiloRes.results || []), ...(minesRes.results || []), ...(plinkoRes.results || []), ...(pvpRes.results || []), ...(scratchRes.results || [])]
    .map((r) => ({
      game: r.game, status: r.status, profit: Number(r.profit), wager: Number(r.wager), pick: String(r.pick),
      at: r.at ? String(r.at).replace(" ", "T") + "Z" : null,
      user: { login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
    }))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 20);


  /* Public, and shared at the edge: the floor is a display, every open
     tab polls it every five seconds, and nothing in it is about the
     viewer. Three seconds of shared cache turns N pollers into one
     origin call every few seconds; stale-while-revalidate keeps the
     answer instant while that call runs. Settlement still happens:
     the origin is hit at least every few seconds while anyone is here.
     The viewer's own numbers are /api/casino/me, which is never cached. */
  return Response.json({ ok: true, now, games, board }, {
    headers: { "Cache-Control": "public, max-age=3, stale-while-revalidate=5" }
  });
}

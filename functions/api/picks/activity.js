/* ============================================================
   GET /api/picks/activity — what just happened, sitewide

   One stream, newest first, built from rows that already exist:

     pick      someone locked a pick            (picks.created_at)
     won/lost  a pick settled                   (picks.settled_at)
     open      a market opened                  (markets.odds_locked_at)
     final     a game settled                   (markets.settled_at)
     joined    a new person logged in           (users.created_at)
     song      a song was played in the Green Room (worker history)

   Public ledger data only — no balances. Cached briefly at the edge
   because every open tab on the feed polls it.
   ============================================================ */

import { slugFor } from "./_slug.js";
import { recentLegendaries } from "../crate/_crate.js";
import { utc } from "./_game.js";

const LIMIT = 80;
const DEFAULT_MUSIC_ROOM = "https://eastcoin-music-room.jake-7f5.workers.dev";

const person = (r) => ({
  login: String(r.twitch_login || "").toLowerCase(),
  displayName: String(r.display_name || r.twitch_login || ""),
  avatar: String(r.avatar_url || "")
});

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503 });

  const [picks, markets, users, music] = await Promise.all([
    db.prepare(
      `SELECT p.id, p.selection, p.wager, p.odds_locked, p.status, p.payout, p.profit, p.created_at, p.settled_at,
              m.id AS market_id, m.sport, m.league, m.away_name, m.home_name, m.question, m.starts_at,
              u.twitch_login, u.display_name, u.avatar_url
         FROM picks p JOIN markets m ON m.id = p.market_id JOIN users u ON u.twitch_id = p.user_id
        WHERE p.status IN ('ACTIVE','WON','LOST','REFUNDED')
        ORDER BY datetime(COALESCE(p.settled_at, p.created_at)) DESC
        LIMIT ?`
    ).bind(LIMIT).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT id, sport, league, away_name, home_name, question, starts_at, state, winner,
              away_odds_locked, home_odds_locked, final_away_score, final_home_score, odds_locked_at, settled_at, created_at
         FROM markets
        WHERE state IN ('OPEN','LOCKED','SETTLED','VOID')
        ORDER BY datetime(COALESCE(settled_at, odds_locked_at, created_at)) DESC
        LIMIT ?`
    ).bind(LIMIT).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT twitch_login, display_name, avatar_url, created_at FROM users
        WHERE twitch_login IS NOT NULL ORDER BY created_at DESC LIMIT 30`
    ).all().catch(() => ({ results: [] })),
    musicHistory(context.env)
  ]);

  const items = [];

  for (const p of picks.results || []) {
    const side = p.selection === "home" ? p.home_name : p.away_name;
    const opp = p.selection === "home" ? p.away_name : p.home_name;
    const market = { slug: slugFor(p), league: String(p.league || ""), sport: String(p.sport || ""), away: p.away_name, home: p.home_name, question: p.question || null };
    const base = { who: person(p), team: side, opponent: opp, line: Number(p.odds_locked), wager: Number(p.wager), market };
    items.push({ type: "pick", at: utc(p.created_at), ...base });
    if (p.status === "WON") items.push({ type: "won", at: utc(p.settled_at), ...base, profit: Number(p.profit), payout: Number(p.payout) });
    else if (p.status === "LOST") items.push({ type: "lost", at: utc(p.settled_at), ...base, profit: -Number(p.wager) });
    else if (p.status === "REFUNDED") items.push({ type: "refunded", at: utc(p.settled_at), ...base });
  }

  for (const m of markets.results || []) {
    const market = { slug: slugFor(m), league: String(m.league || ""), sport: String(m.sport || ""), away: m.away_name, home: m.home_name, question: m.question || null,
      awayLine: Number(m.away_odds_locked), homeLine: Number(m.home_odds_locked), startsAt: m.starts_at };
    if (m.odds_locked_at) items.push({ type: "open", at: utc(m.odds_locked_at), market });
    if (m.settled_at && (m.state === "SETTLED" || m.state === "VOID")) {
      items.push({
        type: m.state === "VOID" ? "void" : "final", at: utc(m.settled_at), market,
        winner: m.winner === "home" ? m.home_name : m.winner === "away" ? m.away_name : null,
        awayScore: m.final_away_score, homeScore: m.final_home_score
      });
    }
  }

  for (const u of users.results || []) items.push({ type: "joined", at: utc(u.created_at), who: person(u) });

  // Score changes are deliberately NOT in the feed: a game scoring six
  // times buries everything else. settle.js still tracks them into
  // market_scores and the game page shows the live score; only the
  // final lands here. Re-enable by reading market_scores again — the
  // client still knows how to draw a "score" item.

  for (const h of music) items.push({ type: "song", at: new Date(h.playedAt).toISOString(), who: { login: h.login, displayName: h.login, avatar: "" }, title: h.title });

  // The casino's results: every settled bet, win or loss.
  const GAME_NAME = { flip: "Coin Flip", wheel: "Wheel", race: "Horse Race", hilo: "Higher or Lower", mines: "Mines", plinko: "Plinko", scratch: "Scratch-Off", roulette: "Russian Roulette", standing: "Last One Standing", redlight: "Red Light, Green Light" };
  const casino = await casinoResults(db);
  for (const c of casino) items.push({ type: "casino", at: c.at, who: c.who, game: c.game, gameName: GAME_NAME[c.game] || c.game, pick: c.pick, wager: c.wager, profit: c.profit, status: c.status });
  // The Daily Pot's hits.
  const pots = await db.prepare(
    `SELECT p.day, p.amount, p.paid_at, p.total_stake, u.twitch_login, u.display_name, u.avatar_url
       FROM casino_pots p JOIN users u ON u.twitch_id = p.winner_user_id
      WHERE p.status = 'PAID' ORDER BY p.day DESC LIMIT 10`
  ).all().catch(() => ({ results: [] }));
  for (const p of pots.results || []) items.push({ type: "pot", at: String(p.paid_at).replace(" ", "T") + "Z", who: { login: String(p.twitch_login || "").toLowerCase(), displayName: String(p.display_name || p.twitch_login || ""), avatar: String(p.avatar_url || "") }, amount: Number(p.amount), day: p.day, total: Number(p.total_stake) });

  // Daily Crate Legendaries — the ticker and the feed, never chat.
  for (const c of await recentLegendaries(db).catch(() => [])) items.push(c);

  const feed = items
    .filter((i) => i.at && !Number.isNaN(new Date(i.at).getTime()))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, LIMIT);

  return Response.json({ ok: true, items: feed, generatedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, max-age=20" }
  });
}

async function casinoResults(db) {
  const person = (r) => ({ login: String(r.twitch_login || "").toLowerCase(), displayName: String(r.display_name || r.twitch_login || ""), avatar: String(r.avatar_url || "") });
  const shape = (r) => ({ game: String(r.game), status: r.status, profit: Number(r.profit), wager: Number(r.wager), pick: String(r.pick), at: r.at ? String(r.at).replace(" ", "T") + "Z" : null, who: person(r) });
  const [coin, shared, hilo, mines, plinko, pvp, scratch] = await Promise.all([
    db.prepare(`SELECT 'flip' AS game, b.status, b.payout - b.wager AS profit, b.wager, b.side AS pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM coin_bets b JOIN coin_rounds r ON r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT b.game, b.status, b.payout - b.wager AS profit, b.wager, b.pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM casino_bets b JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'hilo' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM hilo_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE +g.status IN ('CASHED','BUST') ORDER BY g.updated_at DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'mines' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM mines_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE +g.status IN ('CASHED','BUST') ORDER BY g.updated_at DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'plinko' AS game, CASE WHEN d.payout > d.stake THEN 'WON' ELSE 'LOST' END AS status, d.payout - d.stake AS profit,
                       d.stake AS wager, ('x' || ROUND(d.multiplier, 2)) AS pick, d.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM plinko_drops d JOIN users u ON u.twitch_id = d.user_id
                 ORDER BY d.created_at DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT e.game, e.status, e.payout - e.stake AS profit, e.stake AS wager, (r.players || ' at the table') AS pick,
                       datetime(r.settled_at / 1000, 'unixepoch') AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM (SELECT id, players, settled_at FROM pvp_rounds WHERE settled_at IS NOT NULL ORDER BY settled_at DESC LIMIT 25) r
                  JOIN pvp_entries e ON e.round_id = r.id JOIN users u ON u.twitch_id = e.user_id
                 WHERE e.status IN ('WON','LOST') ORDER BY r.settled_at DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'scratch' AS game, CASE WHEN c.payout > c.stake THEN 'WON' ELSE 'LOST' END AS status, c.payout - c.stake AS profit,
                       c.stake AS wager, CASE WHEN c.prize IS NULL THEN 'no match' ELSE (c.prize || ' x3') END AS pick, c.created_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM scratch_cards c JOIN users u ON u.twitch_id = c.user_id
                 ORDER BY c.created_at DESC LIMIT 25`).all().catch(() => ({ results: [] }))
  ]);
  return [...(coin.results || []), ...(shared.results || []), ...(hilo.results || []), ...(mines.results || []), ...(plinko.results || []), ...(pvp.results || []), ...(scratch.results || [])].map(shape).filter((x) => x.at);
}

async function musicHistory(env) {
  const base = String(env.MUSIC_ROOM_URL || DEFAULT_MUSIC_ROOM).trim().replace(/\/$/, "");
  if (!base) return [];
  try {
    const r = await fetch(`${base}/history/main`, { cf: { cacheTtl: 60, cacheEverything: true } });
    if (!r.ok) return [];
    const payload = await r.json();
    return (payload.history || [])
      .filter((h) => Number(h.playedAt) > 0 && h.requestedByLogin)
      .slice(0, 40)
      .map((h) => ({ login: String(h.requestedByLogin).toLowerCase(), title: String(h.title || "").slice(0, 120), playedAt: Number(h.playedAt) }));
  } catch {
    return [];
  }
}

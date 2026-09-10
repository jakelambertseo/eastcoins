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
import { utc } from "./_game.js";
import { musicRoomUrl } from "../_config.js";

const LIMIT = 80;

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
              m.id AS market_id, m.sport, m.league, m.away_name, m.home_name, m.starts_at,
              u.twitch_login, u.display_name, u.avatar_url
         FROM picks p JOIN markets m ON m.id = p.market_id JOIN users u ON u.twitch_id = p.user_id
        WHERE p.status IN ('ACTIVE','WON','LOST','REFUNDED')
        ORDER BY datetime(COALESCE(p.settled_at, p.created_at)) DESC
        LIMIT ?`
    ).bind(LIMIT).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT id, sport, league, away_name, home_name, starts_at, state, winner,
              away_odds_locked, home_odds_locked, final_away_score, final_home_score, odds_locked_at, settled_at, created_at
         FROM markets
        WHERE state IN ('OPEN','LOCKED','SETTLED','VOID')
        ORDER BY datetime(COALESCE(settled_at, odds_locked_at, created_at)) DESC
        LIMIT ?`
    ).bind(LIMIT).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT twitch_login, display_name, avatar_url, created_at FROM users
        WHERE twitch_login IS NOT NULL ORDER BY datetime(created_at) DESC LIMIT 30`
    ).all().catch(() => ({ results: [] })),
    musicHistory(context.env)
  ]);

  const items = [];

  for (const p of picks.results || []) {
    const side = p.selection === "home" ? p.home_name : p.away_name;
    const opp = p.selection === "home" ? p.away_name : p.home_name;
    const market = { slug: slugFor(p), league: String(p.league || ""), sport: String(p.sport || ""), away: p.away_name, home: p.home_name };
    const base = { who: person(p), team: side, opponent: opp, line: Number(p.odds_locked), wager: Number(p.wager), market };
    items.push({ type: "pick", at: utc(p.created_at), ...base });
    if (p.status === "WON") items.push({ type: "won", at: utc(p.settled_at), ...base, profit: Number(p.profit), payout: Number(p.payout) });
    else if (p.status === "LOST") items.push({ type: "lost", at: utc(p.settled_at), ...base, profit: -Number(p.wager) });
    else if (p.status === "REFUNDED") items.push({ type: "refunded", at: utc(p.settled_at), ...base });
  }

  for (const m of markets.results || []) {
    const market = { slug: slugFor(m), league: String(m.league || ""), sport: String(m.sport || ""), away: m.away_name, home: m.home_name,
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

  // Score changes in games people have picks on, from the last twelve hours.
  const scores = await db.prepare(
    `SELECT s.market_id, s.away, s.home, s.at, m.sport, m.league, m.away_name, m.home_name, m.starts_at, m.state
       FROM market_scores s JOIN markets m ON m.id = s.market_id
      WHERE datetime(s.at) >= datetime('now', '-12 hours')
      ORDER BY datetime(s.at) DESC LIMIT 40`
  ).all().catch(() => ({ results: [] }));
  for (const s of scores.results || []) {
    const market = { slug: slugFor(s), league: String(s.league || ""), sport: String(s.sport || ""), away: s.away_name, home: s.home_name, startsAt: s.starts_at };
    items.push({ type: "score", at: utc(s.at), market, awayScore: Number(s.away), homeScore: Number(s.home), live: s.state === "LOCKED" });
  }

  for (const h of music) items.push({ type: "song", at: new Date(h.playedAt).toISOString(), who: { login: h.login, displayName: h.login, avatar: "" }, title: h.title });

  // The casino's results: every settled bet, win or loss.
  const GAME_NAME = { flip: "Coin Flip", wheel: "Wheel", race: "Horse Race", hilo: "Higher or Lower" };
  const casino = await casinoResults(db);
  for (const c of casino) items.push({ type: "casino", at: c.at, who: c.who, game: c.game, gameName: GAME_NAME[c.game] || c.game, pick: c.pick, wager: c.wager, profit: c.profit, status: c.status });

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
  const [coin, shared, hilo] = await Promise.all([
    db.prepare(`SELECT 'flip' AS game, b.status, b.payout - b.wager AS profit, b.wager, b.side AS pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM coin_bets b JOIN coin_rounds r ON r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT b.game, b.status, b.payout - b.wager AS profit, b.wager, b.pick, r.settled_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM casino_bets b JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no JOIN users u ON u.twitch_id = b.user_id
                 WHERE b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 25`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT 'hilo' AS game, CASE WHEN g.status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN g.status = 'CASHED' THEN g.payout - g.stake ELSE -g.stake END AS profit,
                       g.stake AS wager, ('×' || ROUND(g.multiplier, 2)) AS pick, g.updated_at AS at, u.twitch_login, u.display_name, u.avatar_url
                  FROM hilo_games g JOIN users u ON u.twitch_id = g.user_id
                 WHERE g.status IN ('CASHED','BUST') ORDER BY datetime(g.updated_at) DESC LIMIT 25`).all().catch(() => ({ results: [] }))
  ]);
  return [...(coin.results || []), ...(shared.results || []), ...(hilo.results || [])].map(shape).filter((x) => x.at);
}

async function musicHistory(env) {
  const base = musicRoomUrl(env);
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

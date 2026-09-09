/* ============================================================
   GET /api/picks/profile?login=<twitch login>

   One person's Picks life, read from the same rows everything
   else uses: record, profit, rank, streaks, biggest win, worst
   beat, favourite team, and their recent picks with links to the
   game pages. Public, like the ledger — a profile is the ledger
   filtered to one name.
   ============================================================ */

import { slugFor } from "./_slug.js";
import { utc } from "./_game.js";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": status === 200 ? "public, max-age=60" : "no-store" }
});

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const login = String(new URL(context.request.url).searchParams.get("login") || "").trim().toLowerCase();
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  if (!/^[a-z0-9_]{2,25}$/.test(login)) return json({ ok: false, code: "BAD_LOGIN" }, 400);

  const user = await db
    .prepare(`SELECT twitch_id, twitch_login, display_name, avatar_url, created_at FROM users WHERE twitch_login = ? COLLATE NOCASE LIMIT 1`)
    .bind(login)
    .first();
  if (!user) return json({ ok: false, code: "NOT_FOUND", message: "Nobody by that name has made a pick yet." }, 404);

  const season = await db.prepare(`SELECT id, name FROM seasons WHERE active = 1 LIMIT 1`).first();

  const rows = await db
    .prepare(
      `SELECT p.id, p.selection, p.wager, p.odds_locked, p.status, p.payout, p.profit, p.created_at, p.settled_at,
              m.id AS market_id, m.sport, m.league, m.away_name, m.home_name, m.starts_at, m.state,
              m.final_away_score, m.final_home_score, m.winner
         FROM picks p JOIN markets m ON m.id = p.market_id
        WHERE p.user_id = ? AND p.status IN ('ACTIVE','WON','LOST','REFUNDED')
        ORDER BY datetime(m.starts_at) DESC, datetime(p.created_at) DESC
        LIMIT 500`
    )
    .bind(String(user.twitch_id))
    .all();
  const picks = rows.results || [];

  const settled = picks.filter((p) => p.status === "WON" || p.status === "LOST");
  const wins = settled.filter((p) => p.status === "WON").length;
  const losses = settled.length - wins;
  const profit = settled.reduce((n, p) => n + Number(p.profit || 0), 0);
  const staked = picks.filter((p) => p.status !== "REFUNDED").reduce((n, p) => n + Number(p.wager), 0);

  // Streaks read in the order things were decided.
  const byTime = settled.slice().sort((a, b) => String(a.settled_at || "").localeCompare(String(b.settled_at || "")));
  let current = 0;
  let bestWin = 0;
  let worstLoss = 0;
  for (const p of byTime) {
    const w = p.status === "WON";
    current = w ? (current > 0 ? current + 1 : 1) : (current < 0 ? current - 1 : -1);
    if (current > bestWin) bestWin = current;
    if (current < worstLoss) worstLoss = current;
  }

  const pickView = (p) => ({
    id: String(p.id),
    selection: String(p.selection),
    team: p.selection === "home" ? p.home_name : p.away_name,
    opponent: p.selection === "home" ? p.away_name : p.home_name,
    wager: Number(p.wager),
    line: Number.isInteger(p.odds_locked) ? p.odds_locked : null,
    status: String(p.status),
    payout: Number(p.payout || 0),
    profit: Number(p.profit || 0),
    createdAt: utc(p.created_at),
    settledAt: utc(p.settled_at),
    market: {
      id: String(p.market_id),
      slug: slugFor(p),
      sport: String(p.sport || ""),
      league: String(p.league || ""),
      away: String(p.away_name),
      home: String(p.home_name),
      startsAt: p.starts_at,
      state: String(p.state || ""),
      awayScore: Number.isInteger(p.final_away_score) ? p.final_away_score : null,
      homeScore: Number.isInteger(p.final_home_score) ? p.final_home_score : null,
      winner: p.winner || null
    }
  });

  const won = settled.filter((p) => p.status === "WON").sort((a, b) => b.profit - a.profit);
  const lost = settled.filter((p) => p.status === "LOST").sort((a, b) => a.profit - b.profit);

  // Favourite team: whoever they have backed most.
  const teams = new Map();
  for (const p of picks) {
    const t = p.selection === "home" ? p.home_name : p.away_name;
    teams.set(t, (teams.get(t) || 0) + 1);
  }
  const favourite = [...teams.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  // Rank among everyone with a settled pick this season, by profit.
  let rank = null;
  let players = 0;
  if (season) {
    const standings = await db
      .prepare(
        `SELECT p.user_id, SUM(CASE WHEN p.status IN ('WON','LOST') THEN p.profit ELSE 0 END) AS profit,
                SUM(CASE WHEN p.status = 'WON' THEN 1 ELSE 0 END) AS wins
           FROM picks p JOIN markets m ON m.id = p.market_id
          WHERE m.season_id = ? AND p.status IN ('WON','LOST')
          GROUP BY p.user_id
          ORDER BY profit DESC, wins DESC`
      )
      .bind(season.id)
      .all();
    const list = standings.results || [];
    players = list.length;
    const at = list.findIndex((r) => String(r.user_id) === String(user.twitch_id));
    rank = at === -1 ? null : at + 1;
  }

  return json({
    ok: true,
    user: {
      id: String(user.twitch_id),
      login: String(user.twitch_login).toLowerCase(),
      displayName: String(user.display_name || user.twitch_login),
      avatar: String(user.avatar_url || ""),
      since: utc(user.created_at)
    },
    season: season ? { id: String(season.id), name: String(season.name || season.id) } : null,
    picks: {
      total: picks.length,
      open: picks.filter((p) => p.status === "ACTIVE").length,
      wins, losses, profit, staked,
      accuracy: settled.length ? Math.round(100 * wins / settled.length) : null,
      rank, players,
      streak: { current, bestWin, worstLoss },
      biggestWin: won[0] ? pickView(won[0]) : null,
      worstBeat: lost[0] ? pickView(lost[0]) : null,
      favourite: favourite ? { team: favourite[0], count: favourite[1] } : null,
      recent: picks.slice(0, 12).map(pickView)
    }
  });
}

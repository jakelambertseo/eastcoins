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
import { badgesFor } from "./_badges.js";
import { getSessionUser } from "./_lib.js";
import { ensureSchema as ensureCoinSchema } from "../coin/_coin.js";
import { findTeam, ensureFavouriteColumns } from "./_teams.js";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": status === 200 ? "public, max-age=60" : "no-store" }
});

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const params = new URL(context.request.url).searchParams;
  const login = String(params.get("login") || "").trim().toLowerCase();
  // ?list=picks|casino&page=N returns one page of that list and nothing else.
  const list = String(params.get("list") || "");
  const page = Math.max(1, Math.min(1000, parseInt(params.get("page") || "1", 10) || 1));
  const PAGE = 10;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  if (!/^[a-z0-9_]{2,25}$/.test(login)) return json({ ok: false, code: "BAD_LOGIN" }, 400);

  await ensureFavouriteColumns(db);
  const user = await db
    .prepare(`SELECT twitch_id, twitch_login, display_name, avatar_url, created_at, favourite_league, favourite_team FROM users WHERE twitch_login = ? COLLATE NOCASE LIMIT 1`)
    .bind(login)
    .first();
  if (!user) return json({ ok: false, code: "NOT_FOUND", message: "Nobody by that name has made a pick yet." }, 404);

  const season = await db.prepare(`SELECT id, name FROM seasons WHERE active = 1 LIMIT 1`).first();

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

  const PICK_SQL = `SELECT p.id, p.selection, p.wager, p.odds_locked, p.status, p.payout, p.profit, p.created_at, p.settled_at,
              m.id AS market_id, m.sport, m.league, m.away_name, m.home_name, m.starts_at, m.state,
              m.final_away_score, m.final_home_score, m.winner
         FROM picks p JOIN markets m ON m.id = p.market_id
        WHERE p.user_id = ? AND p.status IN ('ACTIVE','WON','LOST','REFUNDED')
        ORDER BY datetime(m.starts_at) DESC, datetime(p.created_at) DESC`;
  if (list === "picks") {
    const [count, slice] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n FROM picks WHERE user_id = ? AND status IN ('ACTIVE','WON','LOST','REFUNDED')`).bind(String(user.twitch_id)).first(),
      db.prepare(`${PICK_SQL} LIMIT ? OFFSET ?`).bind(String(user.twitch_id), PAGE, (page - 1) * PAGE).all()
    ]);
    const total = Number(count?.n || 0);
    return json({ ok: true, list: "picks", page, pageSize: PAGE, total, pages: Math.max(1, Math.ceil(total / PAGE)), items: (slice.results || []).map(pickView) }, 200, { "Cache-Control": "private, max-age=15" });
  }
  const rows = await db.prepare(`${PICK_SQL} LIMIT 500`).bind(String(user.twitch_id)).all();
  const picks = rows.results || [];

  const settled = picks.filter((p) => p.status === "WON" || p.status === "LOST");
  const wins = settled.filter((p) => p.status === "WON").length;
  const losses = settled.length - wins;
  // The same record per league, for the NFL / MLB split on the card.
  const records = {};
  for (const p of settled) {
    const key = String(p.league || "OTHER").toUpperCase();
    const r = records[key] || (records[key] = { wins: 0, losses: 0, profit: 0 });
    if (p.status === "WON") r.wins += 1; else r.losses += 1;
    r.profit += Number(p.profit || 0);
  }
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


  const won = settled.filter((p) => p.status === "WON").sort((a, b) => b.profit - a.profit);
  const lost = settled.filter((p) => p.status === "LOST").sort((a, b) => a.profit - b.profit);


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

  let badges = [];
  try { badges = (await badgesFor(context.env, db)).byLogin[login] || []; } catch { badges = []; }

  // Casino: every game's record for this person, and their latest results.
  let casino = null;
  try {
    await ensureCoinSchema(db);
    const uid = String(user.twitch_id);
    const [coin, shared, hilo] = await Promise.all([
      db.prepare(`SELECT 'flip' AS game, b.status, b.payout - b.wager AS profit, b.wager, b.side AS pick, r.settled_at AS at, r.result
                    FROM coin_bets b JOIN coin_rounds r ON r.no = b.round_no WHERE b.user_id = ? AND b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT b.game, b.status, b.payout - b.wager AS profit, b.wager, b.pick, r.settled_at AS at, r.result
                    FROM casino_bets b JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no WHERE b.user_id = ? AND b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'hilo' AS game, CASE WHEN status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END AS profit,
                         stake AS wager, ('×' || ROUND(multiplier, 2)) AS pick, updated_at AS at, NULL AS result
                    FROM hilo_games WHERE user_id = ? AND status IN ('CASHED','BUST') ORDER BY datetime(updated_at) DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] }))
    ]);
    const all = [...(coin.results || []), ...(shared.results || []), ...(hilo.results || [])]
      .map((r) => ({ game: String(r.game), status: r.status, profit: Number(r.profit), wager: Number(r.wager), pick: String(r.pick), at: r.at ? String(r.at).replace(" ", "T") + "Z" : null }))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    if (list === "casino") {
      return json({ ok: true, list: "casino", page, pageSize: PAGE, total: all.length, pages: Math.max(1, Math.ceil(all.length / PAGE)), items: all.slice((page - 1) * PAGE, page * PAGE) }, 200, { "Cache-Control": "private, max-age=15" });
    }
    if (all.length) {
      const perGame = {};
      for (const r of all) {
        const g = perGame[r.game] || (perGame[r.game] = { plays: 0, wins: 0, losses: 0, net: 0, staked: 0 });
        g.plays += 1; if (r.status === "WON") g.wins += 1; else g.losses += 1; g.net += r.profit; g.staked += r.wager;
      }
      const wins = all.filter((r) => r.status === "WON").length;
      const fav = Object.entries(perGame).sort((a, b) => b[1].plays - a[1].plays)[0];
      casino = {
        total: all.length, wins, losses: all.length - wins,
        net: all.reduce((n, r) => n + r.profit, 0),
        staked: all.reduce((n, r) => n + r.wager, 0),
        biggestWin: Math.max(0, ...all.filter((r) => r.status === "WON").map((r) => r.profit)),
        favourite: fav ? { game: fav[0], plays: fav[1].plays } : null,
        games: perGame,
        pageSize: PAGE,
        recent: all.slice(0, PAGE)
      };
    }
  } catch { casino = null; }
  if (list === "casino") return json({ ok: true, list: "casino", page: 1, pageSize: PAGE, total: 0, pages: 1, items: [] });

  // Bankroll: every confirmed wallet operation EastCoin made for this
  // person (picks and casino), as a running net. Balances stay private
  // — the Community Ledger rule — so only the owner's own view carries
  // the balance after each operation.
  let bankroll = null;
  try {
    const ops = await db
      .prepare(`SELECT type, amount, balance_after, market_id, COALESCE(confirmed_at, created_at) AS at
                  FROM wallet_operations WHERE user_id = ? AND status = 'CONFIRMED'
                 ORDER BY datetime(COALESCE(confirmed_at, created_at)) ASC, rowid ASC LIMIT 3000`)
      .bind(String(user.twitch_id)).all();
    const rows = ops.results || [];
    if (rows.length) {
      const viewer = await getSessionUser(db, context.request).catch(() => null);
      const owner = Boolean(viewer && String(viewer.id) === String(user.twitch_id));
      let net = 0, picksNet = 0, casinoNet = 0;
      const pts = [];
      for (const r of rows) {
        net += Number(r.amount || 0);
        // A move with a market behind it is a pick; the rest is the casino.
        if (r.market_id) picksNet += Number(r.amount || 0); else casinoNet += Number(r.amount || 0);
        const p = { t: utc(String(r.at)), net, k: String(r.type || "") };
        if (owner && Number.isFinite(Number(r.balance_after))) p.bal = Number(r.balance_after);
        pts.push(p);
      }
      const step = Math.ceil(pts.length / 400);
      const sampled = step > 1 ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1) : pts;
      bankroll = {
        owner, ops: rows.length, net, picksNet, casinoNet,
        peak: Math.max(...pts.map((p) => p.net)), trough: Math.min(...pts.map((p) => p.net)),
        first: pts[0].t, last: pts[pts.length - 1].t, points: sampled
      };
    }
  } catch { bankroll = null; }
  const flip = casino;   // older readers of this payload

  return json({
    ok: true,
    badges,
    flip,
    casino,
    user: {
      id: String(user.twitch_id),
      login: String(user.twitch_login).toLowerCase(),
      displayName: String(user.display_name || user.twitch_login),
      avatar: String(user.avatar_url || ""),
      since: utc(user.created_at),
      // Their own choice, made on the profile page — not inferred from picks.
      favourite: findTeam(user.favourite_league, user.favourite_team)
    },
    season: season ? { id: String(season.id), name: String(season.name || season.id) } : null,
    picks: {
      total: picks.length,
      open: picks.filter((p) => p.status === "ACTIVE").length,
      wins, losses, profit, staked, records,
      accuracy: settled.length ? Math.round(100 * wins / settled.length) : null,
      rank, players,
      streak: { current, bestWin, worstLoss },
      biggestWin: won[0] ? pickView(won[0]) : null,
      worstBeat: lost[0] ? pickView(lost[0]) : null,
      pageSize: PAGE,
      recent: picks.slice(0, PAGE).map(pickView)
    },
    bankroll
  }, 200, { "Cache-Control": "private, max-age=15" });
}

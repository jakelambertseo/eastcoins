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
import { isOpen as wrappedIsOpen } from "./_wrapped.js";
import { cosmeticsFor, collectionFor } from "../store/_store.js";
import { TIER_OF } from "../crate/_crate.js";
import { countView, ensureViews } from "./_views.js";

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

  await Promise.all([ensureFavouriteColumns(db), ensureViews(db)]);
  const user = await db
    .prepare(`SELECT twitch_id, twitch_login, display_name, avatar_url, created_at, favourite_league, favourite_team, profile_views FROM users WHERE twitch_login = ? COLLATE NOCASE LIMIT 1`)
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
      question: p.question || null,
      startsAt: p.starts_at,
      state: String(p.state || ""),
      awayScore: Number.isInteger(p.final_away_score) ? p.final_away_score : null,
      homeScore: Number.isInteger(p.final_home_score) ? p.final_home_score : null,
      winner: p.winner || null
    }
  });

  const PICK_SQL = `SELECT p.id, p.selection, p.wager, p.odds_locked, p.status, p.payout, p.profit, p.created_at, p.settled_at,
              m.id AS market_id, m.sport, m.league, m.away_name, m.home_name, m.question, m.starts_at, m.state,
              m.final_away_score, m.final_home_score, m.winner
         FROM picks p JOIN markets m ON m.id = p.market_id
        WHERE p.user_id = ? AND p.status IN ('ACTIVE','WON','LOST','REFUNDED')
        ORDER BY m.starts_at DESC, p.created_at DESC`;
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
    const r = records[key] || (records[key] = { wins: 0, losses: 0, profit: 0, staked: 0 });
    if (p.status === "WON") r.wins += 1; else r.losses += 1;
    r.profit += Number(p.profit || 0);
    // Staked per league, so the profile can show a return on it.
    r.staked += Number(p.wager || 0);
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
    const [coin, shared, hilo, mines, plinko, pvp, scratch] = await Promise.all([
      db.prepare(`SELECT 'flip' AS game, b.status, b.payout - b.wager AS profit, b.wager, b.side AS pick, r.settled_at AS at, r.result
                    FROM coin_bets b JOIN coin_rounds r ON r.no = b.round_no WHERE b.user_id = ? AND b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT b.game, b.status, b.payout - b.wager AS profit, b.wager, b.pick, r.settled_at AS at, r.result
                    FROM casino_bets b JOIN casino_rounds r ON r.game = b.game AND r.no = b.round_no WHERE b.user_id = ? AND b.status IN ('WON','LOST') ORDER BY b.round_no DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'hilo' AS game, CASE WHEN status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END AS profit,
                         stake AS wager, ('×' || ROUND(multiplier, 2)) AS pick, updated_at AS at, NULL AS result
                    FROM hilo_games WHERE user_id = ? AND status IN ('CASHED','BUST') ORDER BY updated_at DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'mines' AS game, CASE WHEN status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status, CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END AS profit,
                         stake AS wager, ('×' || ROUND(multiplier, 2)) AS pick, updated_at AS at, NULL AS result
                    FROM mines_games WHERE user_id = ? AND status IN ('CASHED','BUST') ORDER BY updated_at DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'plinko' AS game, CASE WHEN payout > stake THEN 'WON' ELSE 'LOST' END AS status, payout - stake AS profit,
                         stake AS wager, ('x' || ROUND(multiplier, 2)) AS pick, created_at AS at, NULL AS result
                    FROM plinko_drops WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT e.game, e.status, e.payout - e.stake AS profit, e.stake AS wager, (r.players || ' at the table') AS pick,
                         datetime(r.settled_at / 1000, 'unixepoch') AS at, NULL AS result
                    FROM pvp_entries e JOIN pvp_rounds r ON r.id = e.round_id
                   WHERE e.user_id = ? AND e.status IN ('WON','LOST') ORDER BY r.settled_at DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'scratch' AS game, CASE WHEN payout > stake THEN 'WON' ELSE 'LOST' END AS status, payout - stake AS profit,
                         stake AS wager, CASE WHEN prize IS NULL THEN 'no match' ELSE (prize || ' ×3') END AS pick, created_at AS at, NULL AS result
                    FROM scratch_cards WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`).bind(uid).all().catch(() => ({ results: [] }))
    ]);
    const all = [...(coin.results || []), ...(shared.results || []), ...(hilo.results || []), ...(mines.results || []), ...(plinko.results || []), ...(pvp.results || []), ...(scratch.results || [])]
      .map((r) => ({ game: String(r.game), status: r.status, profit: Number(r.profit), wager: Number(r.wager), pick: String(r.pick), at: r.at ? String(r.at).replace(" ", "T") + "Z" : null }))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    if (list === "casino") {
      return json({ ok: true, list: "casino", page, pageSize: PAGE, total: all.length, pages: Math.max(1, Math.ceil(all.length / PAGE)), items: all.slice((page - 1) * PAGE, page * PAGE) }, 200, { "Cache-Control": "private, max-age=15" });
    }
    /* The totals are AGGREGATED over every row, never counted from the rows
       above. Those carry LIMIT 200 apiece because they are the recent feed,
       and summing them silently truncated anyone past 200 plays in a single
       game: saturdaysfortheufcv2 read 1,569 here against 3,263 on the casino
       floor, because hilo and mines were both sitting on exactly 200. The
       floor was right — it has always used SUM() — and the two now agree by
       construction, both summing whole tables.

       Keep it that way. If a figure is a total, it comes from a SUM; the row
       queries below exist to show the last few plays and nothing else. */
    const agg = await Promise.all([
      db.prepare(`SELECT 'flip' AS game, COUNT(*) AS plays, COALESCE(SUM(status = 'WON'), 0) AS wins,
                         COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager ELSE -wager END), 0) AS net,
                         COALESCE(SUM(wager), 0) AS staked,
                         COALESCE(MAX(CASE WHEN status = 'WON' THEN payout - wager END), 0) AS best
                    FROM coin_bets WHERE user_id = ? AND status IN ('WON','LOST')`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT game, COUNT(*) AS plays, COALESCE(SUM(status = 'WON'), 0) AS wins,
                         COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager ELSE -wager END), 0) AS net,
                         COALESCE(SUM(wager), 0) AS staked,
                         COALESCE(MAX(CASE WHEN status = 'WON' THEN payout - wager END), 0) AS best
                    FROM casino_bets WHERE user_id = ? AND status IN ('WON','LOST') GROUP BY game`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'hilo' AS game, COUNT(*) AS plays, COALESCE(SUM(status = 'CASHED'), 0) AS wins,
                         COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END), 0) AS net,
                         COALESCE(SUM(stake), 0) AS staked,
                         COALESCE(MAX(CASE WHEN status = 'CASHED' THEN payout - stake END), 0) AS best
                    FROM hilo_games WHERE user_id = ? AND status IN ('CASHED','BUST')`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'mines' AS game, COUNT(*) AS plays, COALESCE(SUM(status = 'CASHED'), 0) AS wins,
                         COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END), 0) AS net,
                         COALESCE(SUM(stake), 0) AS staked,
                         COALESCE(MAX(CASE WHEN status = 'CASHED' THEN payout - stake END), 0) AS best
                    FROM mines_games WHERE user_id = ? AND status IN ('CASHED','BUST')`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'plinko' AS game, COUNT(*) AS plays, COALESCE(SUM(payout > stake), 0) AS wins,
                         COALESCE(SUM(payout - stake), 0) AS net, COALESCE(SUM(stake), 0) AS staked,
                         COALESCE(MAX(payout - stake), 0) AS best
                    FROM plinko_drops WHERE user_id = ?`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT game, COUNT(*) AS plays, COALESCE(SUM(status = 'WON'), 0) AS wins,
                         COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - stake ELSE -stake END), 0) AS net,
                         COALESCE(SUM(stake), 0) AS staked,
                         COALESCE(MAX(CASE WHEN status = 'WON' THEN payout - stake END), 0) AS best
                    FROM pvp_entries WHERE user_id = ? AND status IN ('WON','LOST') GROUP BY game`).bind(uid).all().catch(() => ({ results: [] })),
      db.prepare(`SELECT 'scratch' AS game, COUNT(*) AS plays, COALESCE(SUM(payout > stake), 0) AS wins,
                         COALESCE(SUM(payout - stake), 0) AS net, COALESCE(SUM(stake), 0) AS staked,
                         COALESCE(MAX(payout - stake), 0) AS best
                    FROM scratch_cards WHERE user_id = ?`).bind(uid).all().catch(() => ({ results: [] }))
    ]);
    const perGame = {};
    let best = 0;
    for (const set of agg) {
      for (const r of set.results || []) {
        const plays = Number(r.plays || 0);
        if (!plays) continue;
        const wins = Number(r.wins || 0);
        perGame[String(r.game)] = { plays, wins, losses: plays - wins, net: Number(r.net || 0), staked: Number(r.staked || 0) };
        best = Math.max(best, Number(r.best || 0));
      }
    }
    const totals = Object.values(perGame).reduce((t, g) => ({
      plays: t.plays + g.plays, wins: t.wins + g.wins, net: t.net + g.net, staked: t.staked + g.staked
    }), { plays: 0, wins: 0, net: 0, staked: 0 });
    if (totals.plays) {
      const fav = Object.entries(perGame).sort((a, b) => b[1].plays - a[1].plays)[0];
      casino = {
        total: totals.plays, wins: totals.wins, losses: totals.plays - totals.wins,
        net: totals.net,
        staked: totals.staked,
        biggestWin: best,
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
  const viewer = await getSessionUser(db, context.request).catch(() => null);
  let bankroll = null;
  try {
    const ops = await db
      .prepare(`SELECT type, amount, balance_after, market_id, idempotency_key, COALESCE(confirmed_at, created_at) AS at
                  FROM wallet_operations WHERE user_id = ? AND status = 'CONFIRMED'
                 ORDER BY datetime(COALESCE(confirmed_at, created_at)) ASC, rowid ASC LIMIT 3000`)
      .bind(String(user.twitch_id)).all();
    const rows = ops.results || [];
    if (rows.length) {
      const owner = Boolean(viewer && String(viewer.id) === String(user.twitch_id));
      let net = 0, picksNet = 0, casinoNet = 0, storeNet = 0;
      const pts = [];
      for (const r of rows) {
        net += Number(r.amount || 0);
        // A move with a market behind it is a pick; store purchases are
        // their own line; the rest is the casino.
        const opKey = String(r.idempotency_key || "");
        if (r.market_id) picksNet += Number(r.amount || 0);
        else if (opKey.startsWith("STORE:") || opKey.startsWith("REFUND:STORE:")) storeNet += Number(r.amount || 0);
        else casinoNet += Number(r.amount || 0);
        const p = { t: utc(String(r.at)), net, k: String(r.type || "") };
        if (owner && Number.isFinite(Number(r.balance_after))) p.bal = Number(r.balance_after);
        pts.push(p);
      }
      const step = Math.ceil(pts.length / 400);
      const sampled = step > 1 ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1) : pts;
      bankroll = {
        owner, ops: rows.length, net, picksNet, casinoNet, storeNet,
        peak: Math.max(...pts.map((p) => p.net)), trough: Math.min(...pts.map((p) => p.net)),
        first: pts[0].t, last: pts[pts.length - 1].t, points: sampled
      };
    }
  } catch { bankroll = null; }
  const flip = casino;   // older readers of this payload

  // Tomato scores from Movies & TV (screen/ratings.js). The table is
  // made on the first rating, so a missing one simply means none yet.
  let movies = null;
  try {
    const uid = String(user.twitch_id);
    const [agg, rows] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n, AVG(score) AS avg, SUM(CASE WHEN score >= 3 THEN 1 ELSE 0 END) AS fresh
                    FROM title_ratings WHERE user_id = ?`).bind(uid).first(),
      db.prepare(`SELECT type, tmdb_id, score, title, poster, year, updated_at
                    FROM title_ratings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 60`).bind(uid).all()
    ]);
    const total = Number(agg?.n || 0);
    if (total) {
      movies = {
        total,
        avg: Math.round(Number(agg.avg) * 10) / 10,
        fresh: Number(agg.fresh || 0),
        rotten: total - Number(agg.fresh || 0),
        recent: (rows.results || []).map((r) => ({
          type: String(r.type), id: Number(r.tmdb_id), score: Number(r.score),
          title: String(r.title), poster: String(r.poster || ""), year: String(r.year || ""), at: utc(r.updated_at)
        }))
      };
    }
  } catch { movies = null; }

  const counting = countView(db, context.request, login, viewer && { twitch_id: viewer.id, twitch_login: viewer.login });
  if (context.waitUntil) context.waitUntil(counting); else await counting;

  return json({
    ok: true,
    badges,
    flip,
    casino,
    movies,
    // Store cosmetics they have switched on (and still own), or null.
    cosmetics: await cosmeticsFor(db, String(user.twitch_id)),
    // Everything they own from the Store and the Daily Crate, for the Collection tab.
    collection: await collectionFor(db, String(user.twitch_id), TIER_OF),
    // EastCoin Wrapped has dropped: the profile links to it.
    wrappedOpen: wrappedIsOpen(context.env),
    user: {
      id: String(user.twitch_id),
      login: String(user.twitch_login).toLowerCase(),
      displayName: String(user.display_name || user.twitch_login),
      avatar: String(user.avatar_url || ""),
      since: utc(user.created_at),
      // Counted below; this is the figure as it stood when the page was asked for.
      views: Number(user.profile_views || 0),
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

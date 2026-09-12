/* ============================================================
   GET /api/admin/dashboard — is everything fine before a Sunday?

   One answer for the one person who asked for it. Reads the status
   notes settlement leaves behind, counts what is in flight, and
   probes the pieces that live elsewhere (the music worker, TMDB,
   StreamElements) so a dead key shows up here before it shows up
   in chat.
   ============================================================ */

import { getSessionUser, walletWritesEnabled, readBalance, totalReturn, ADMIN_ALLOWLIST } from "../picks/_lib.js";
import { readStatus } from "../picks/_ops.js";
import { tmdb } from "../screen/_tmdb.js";

// Same three people the Picks admin page trusts. One list, so "admin"
// cannot mean different things on different screens.
const DASHBOARD_LOGINS = ADMIN_ALLOWLIST;
const DEFAULT_MUSIC_ROOM = "https://eastcoin-music-room.jake-7f5.workers.dev";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/* ------------------------------------------------------------ the book

   What the house has actually taken. Every number is read from the
   picks rows themselves, so it agrees with the ledger and the
   profiles by construction: the house's win is exactly the players'
   loss, and only settled picks count toward it. Money still riding
   is carried separately as exposure, never as profit. */

const CHI = "America/Chicago";
const dayKey = (value) => {
  const d = new Date(String(value || "").replace(" ", "T") + (String(value || "").includes("Z") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: CHI });
};
const num = (v) => Number(v || 0);

async function bookOf(db) {
  const [totals, leagues, people, active, recent, casino] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS bets, COUNT(DISTINCT user_id) AS bettors, SUM(wager) AS staked,
              SUM(CASE WHEN status IN ('WON','LOST') THEN wager ELSE 0 END) AS settled_staked,
              SUM(CASE WHEN status = 'WON'  THEN 1 ELSE 0 END) AS won,
              SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) AS lost,
              SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) AS voided,
              SUM(CASE WHEN status = 'ACTIVE'   THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'WON' THEN payout ELSE 0 END) AS paid_out,
              SUM(CASE WHEN status IN ('WON','LOST') THEN profit ELSE 0 END) AS player_net,
              MAX(wager) AS biggest_bet
         FROM picks`
    ).first(),
    db.prepare(
      `SELECT COALESCE(NULLIF(m.league, ''), UPPER(m.sport)) AS league,
              COUNT(*) AS bets, SUM(p.wager) AS staked,
              SUM(CASE WHEN p.status IN ('WON','LOST') THEN p.wager ELSE 0 END) AS settled_staked,
              SUM(CASE WHEN p.status IN ('WON','LOST') THEN p.profit ELSE 0 END) AS player_net
         FROM picks p JOIN markets m ON m.id = p.market_id
        GROUP BY league ORDER BY bets DESC LIMIT 25`
    ).all(),
    db.prepare(
      `SELECT u.twitch_login AS login, COUNT(*) AS bets, SUM(p.wager) AS staked,
              SUM(CASE WHEN p.status IN ('WON','LOST') THEN p.profit ELSE 0 END) AS net
         FROM picks p JOIN users u ON u.twitch_id = p.user_id
        GROUP BY p.user_id ORDER BY staked DESC LIMIT 50`
    ).all(),
    // Liability on what is still riding, priced the same way the ticket was.
    db.prepare(`SELECT wager, odds_locked FROM picks WHERE status = 'ACTIVE'`).all(),
    // Enough rows to bucket the last fortnight in Chicago days.
    db.prepare(
      `SELECT created_at, settled_at, wager, status, profit
         FROM picks
        WHERE datetime(COALESCE(settled_at, created_at)) >= datetime('now', '-21 days')`
    ).all(),
    db.prepare(
      `SELECT SUM(staked) AS staked, SUM(paid) AS paid, SUM(n) AS bets FROM (
         SELECT COUNT(*) AS n, SUM(wager) AS staked, SUM(COALESCE(payout, 0)) AS paid
           FROM casino_bets WHERE status IN ('WON','LOST')
         UNION ALL
         SELECT COUNT(*), SUM(wager), SUM(COALESCE(payout, 0))
           FROM coin_bets WHERE status IN ('WON','LOST')
         UNION ALL
         SELECT COUNT(*), SUM(stake), SUM(COALESCE(payout, 0))
           FROM hilo_games WHERE status IN ('BUST','CASHED')
       )`
    ).first().catch(() => null)
  ]);

  const settledStaked = num(totals?.settled_staked);
  const playerNet = num(totals?.player_net);
  const bets = num(totals?.bets);

  // Exposure: what the house owes if every open pick wins.
  let riding = 0;
  let owed = 0;
  for (const r of active.results || []) {
    riding += num(r.wager);
    owed += totalReturn(num(r.wager), num(r.odds_locked));
  }

  // Days, in Chicago time: staked by the day a bet was placed, the
  // house's take by the day it was graded.
  const days = new Map();
  const touch = (key) => {
    if (!days.has(key)) days.set(key, { day: key, bets: 0, staked: 0, houseNet: 0 });
    return days.get(key);
  };
  for (const r of recent.results || []) {
    const placed = dayKey(r.created_at);
    if (placed) { const d = touch(placed); d.bets += 1; d.staked += num(r.wager); }
    if (r.status === "WON" || r.status === "LOST") {
      const graded = dayKey(r.settled_at);
      if (graded) touch(graded).houseNet -= num(r.profit);
    }
  }
  const ordered = [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-14);

  const today = dayKey(new Date().toISOString());
  const since = (n) => {
    const list = ordered.slice(-n);
    return {
      bets: list.reduce((s, d) => s + d.bets, 0),
      staked: list.reduce((s, d) => s + d.staked, 0),
      houseNet: list.reduce((s, d) => s + d.houseNet, 0)
    };
  };

  const casinoStaked = num(casino?.staked);
  const casinoPaid = num(casino?.paid);

  return {
    bets,
    bettors: num(totals?.bettors),
    staked: num(totals?.staked),
    settledStaked,
    won: num(totals?.won),
    lost: num(totals?.lost),
    voided: num(totals?.voided),
    active: num(totals?.active),
    paidOut: num(totals?.paid_out),
    playerNet,
    houseNet: -playerNet,
    // Hold: the house's cut of every ZCoin that was actually decided.
    holdPct: settledStaked ? Math.round((-playerNet / settledStaked) * 1000) / 10 : null,
    avgBet: bets ? Math.round(num(totals?.staked) / bets) : 0,
    biggestBet: num(totals?.biggest_bet),
    riding,
    exposure: owed,
    today: days.get(today) || { day: today, bets: 0, staked: 0, houseNet: 0 },
    week: since(7),
    fortnight: since(14),
    days: ordered,
    leagues: (leagues.results || []).map((r) => ({
      league: String(r.league || "OTHER"),
      bets: num(r.bets),
      staked: num(r.staked),
      houseNet: -num(r.player_net),
      holdPct: num(r.settled_staked) ? Math.round((-num(r.player_net) / num(r.settled_staked)) * 1000) / 10 : null
    })),
    people: (people.results || []).map((r) => ({
      login: String(r.login || ""),
      bets: num(r.bets),
      staked: num(r.staked),
      net: num(r.net)
    })),
    casino: casino ? { bets: num(casino.bets), staked: casinoStaked, paidOut: casinoPaid, houseNet: casinoStaked - casinoPaid } : null
  };
}

/* ------------------------------------------------------------ the casino

   Three tables hold the games: casino_bets (wheel, race), coin_bets
   (the coin flip, which predates the shared engine) and hilo_games.
   They are read into one shape so the page can treat them alike. The
   house's take is stake minus payout on decided bets only; a bet still
   live counts as neither. */

const GAME_NAMES = { wheel: "Wheel", race: "Horse Race", flip: "Coin Flip", hilo: "Higher or Lower", mines: "Mines", plinko: "Plinko" };

async function casinoBook(db) {
  const [shared, coin, hilo, mines, plinko, everyone, recent] = await Promise.all([
    db.prepare(
      `SELECT game, status, COUNT(*) AS n, COUNT(DISTINCT user_id) AS players,
              SUM(wager) AS staked, SUM(COALESCE(payout, 0)) AS paid,
              MAX(COALESCE(payout, 0) - wager) AS best
         FROM casino_bets GROUP BY game, status`
    ).all(),
    db.prepare(
      `SELECT status, COUNT(*) AS n, COUNT(DISTINCT user_id) AS players,
              SUM(wager) AS staked, SUM(COALESCE(payout, 0)) AS paid,
              MAX(COALESCE(payout, 0) - wager) AS best
         FROM coin_bets GROUP BY status`
    ).all(),
    db.prepare(
      `SELECT status, COUNT(*) AS n, COUNT(DISTINCT user_id) AS players,
              SUM(stake) AS staked, SUM(COALESCE(payout, 0)) AS paid,
              MAX(COALESCE(payout, 0) - stake) AS best
         FROM hilo_games GROUP BY status`
    ).all(),
    db.prepare(
      `SELECT status, COUNT(*) AS n, COUNT(DISTINCT user_id) AS players,
              SUM(stake) AS staked, SUM(COALESCE(payout, 0)) AS paid,
              MAX(COALESCE(payout, 0) - stake) AS best
         FROM mines_games GROUP BY status`
    ).all().catch(() => ({ results: [] })),
    // Plinko keeps no status: a drop is decided the moment it lands, so
    // it is one already-decided group rather than several.
    db.prepare(
      `SELECT 'CASHED' AS status, COUNT(*) AS n, COUNT(DISTINCT user_id) AS players,
              SUM(stake) AS staked, SUM(COALESCE(payout, 0)) AS paid,
              MAX(COALESCE(payout, 0) - stake) AS best
         FROM plinko_drops`
    ).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT COUNT(DISTINCT user_id) AS n FROM (
         SELECT user_id FROM casino_bets UNION
         SELECT user_id FROM coin_bets UNION
         SELECT user_id FROM hilo_games UNION
         SELECT user_id FROM mines_games UNION
         SELECT user_id FROM plinko_drops)`
    ).first(),
    db.prepare(
      `SELECT created_at, staked, paid FROM (
         SELECT created_at, wager AS staked, COALESCE(payout, 0) AS paid FROM casino_bets WHERE status IN ('WON','LOST')
         UNION ALL
         SELECT created_at, wager, COALESCE(payout, 0) FROM coin_bets WHERE status IN ('WON','LOST')
         UNION ALL
         SELECT created_at, stake, COALESCE(payout, 0) FROM hilo_games WHERE status IN ('BUST','CASHED')
         UNION ALL
         SELECT created_at, stake, COALESCE(payout, 0) FROM mines_games WHERE status IN ('BUST','CASHED')
         UNION ALL
         SELECT created_at, stake, COALESCE(payout, 0) FROM plinko_drops)
        WHERE datetime(created_at) >= datetime('now', '-21 days')`
    ).all().catch(() => ({ results: [] }))
  ]);

  // Anything not decided yet is "in play", whatever each table calls it.
  const DECIDED = new Set(["WON", "LOST", "BUST", "CASHED"]);
  const games = new Map();
  const add = (key, row) => {
    const g = games.get(key) || { game: key, name: GAME_NAMES[key] || key, bets: 0, players: 0, staked: 0, paidOut: 0, live: 0, biggestWin: 0 };
    if (DECIDED.has(String(row.status))) {
      g.bets += num(row.n);
      g.staked += num(row.staked);
      g.paidOut += num(row.paid);
      g.biggestWin = Math.max(g.biggestWin, num(row.best));
    } else {
      g.live += num(row.n);
    }
    g.players = Math.max(g.players, num(row.players));
    games.set(key, g);
  };

  for (const r of shared.results || []) add(String(r.game || "other"), r);
  for (const r of coin.results || []) add("flip", r);
  for (const r of hilo.results || []) add("hilo", r);
  for (const r of mines.results || []) add("mines", r);
  for (const r of plinko.results || []) if (num(r.n)) add("plinko", r);

  const list = [...games.values()].map((g) => ({
    ...g,
    houseNet: g.staked - g.paidOut,
    holdPct: g.staked ? Math.round(((g.staked - g.paidOut) / g.staked) * 1000) / 10 : null
  })).sort((a, b) => b.staked - a.staked);

  const staked = list.reduce((s, g) => s + g.staked, 0);
  const paidOut = list.reduce((s, g) => s + g.paidOut, 0);

  // The house's take by Chicago day, same shape the picks chart uses.
  const days = new Map();
  for (const r of recent.results || []) {
    const key = dayKey(r.created_at);
    if (!key) continue;
    if (!days.has(key)) days.set(key, { day: key, bets: 0, staked: 0, houseNet: 0 });
    const d = days.get(key);
    d.bets += 1;
    d.staked += num(r.staked);
    d.houseNet += num(r.staked) - num(r.paid);
  }

  return {
    bets: list.reduce((s, g) => s + g.bets, 0),
    players: num(everyone?.n),
    staked,
    paidOut,
    houseNet: staked - paidOut,
    holdPct: staked ? Math.round(((staked - paidOut) / staked) * 1000) / 10 : null,
    live: list.reduce((s, g) => s + g.live, 0),
    games: list,
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-14)
  };
}

async function timed(fn) {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, ...value };
  } catch (error) {
    return { ok: false, ms: Date.now() - t0, error: String(error?.message || error).slice(0, 120) };
  }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);

  const user = await getSessionUser(db, request);
  if (!user || !DASHBOARD_LOGINS.has(user.login)) return json({ ok: false, code: "NOT_ALLOWED" }, 403);

  const now = Date.now();
  const todayStart = new Date(new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" })).toISOString();

  const [status, ops, reconcile, markets, picks, users, coin, presence, music, tmdbProbe, wallet, book, casinoStats] = await Promise.all([
    readStatus(db, ["settle:last", "odds:quota", "autoopen:last", "backup:last"]),
    db.prepare(`SELECT status, COUNT(*) AS n FROM wallet_operations GROUP BY status`).all(),
    db.prepare(
      `SELECT o.id, o.type, o.amount, o.status, o.last_error, o.created_at, u.twitch_login
         FROM wallet_operations o LEFT JOIN users u ON u.twitch_id = o.user_id
        WHERE o.status IN ('NEEDS_RECONCILIATION','FAILED','PENDING')
        ORDER BY datetime(o.created_at) DESC LIMIT 60`
    ).all(),
    db.prepare(
      `SELECT state, COUNT(*) AS n, MIN(CASE WHEN state = 'OPEN' THEN starts_at END) AS next_start
         FROM markets GROUP BY state`
    ).all(),
    db.prepare(
      `SELECT SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN 1 ELSE 0 END) AS today,
              SUM(CASE WHEN status = 'ACTIVE' THEN wager ELSE 0 END) AS riding
         FROM picks`
    ).bind(todayStart).first(),
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN datetime(created_at) >= datetime(?) THEN 1 ELSE 0 END) AS today FROM users`).bind(todayStart).first(),
    db.prepare(
      `SELECT (SELECT COUNT(*) FROM coin_bets WHERE datetime(created_at) >= datetime(?)) AS bets_today,
              (SELECT COUNT(*) FROM coin_rounds WHERE result IS NOT NULL AND datetime(settled_at) >= datetime(?)) AS rounds_today,
              (SELECT COUNT(*) FROM coin_presence WHERE seen_at >= ?) AS in_room`
    ).bind(todayStart, todayStart, now - 60000).first().catch(() => null),
    db.prepare(`SELECT COUNT(*) AS tabs, COUNT(DISTINCT user_id) AS people, SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS guests FROM site_presence WHERE seen_at >= ?`).bind(now - 75000).first().catch(() => null),
    timed(async () => {
      const base = String(env.MUSIC_ROOM_URL || DEFAULT_MUSIC_ROOM).replace(/\/$/, "");
      const r = await fetch(`${base}/health`);
      const payload = await r.json().catch(() => null);
      return { status: r.status, service: payload?.service || null };
    }),
    timed(async () => {
      const r = await tmdb(env, "/movie/550", { language: "en-US" });
      return { status: r.ok ? 200 : r.status, code: r.ok ? null : r.code };
    }),
    timed(async () => {
      const balance = await readBalance(env, user.login);
      return { readable: balance !== null, balance, writes: walletWritesEnabled(env) };
    }),
    bookOf(db).catch(() => null),
    casinoBook(db).catch(() => null)
  ]);

  const settleLast = status["settle:last"] || null;
  const settleAgeMin = settleLast ? Math.round((now - new Date(settleLast.at).getTime()) / 60000) : null;

  const opsByStatus = {};
  for (const r of ops.results || []) opsByStatus[r.status] = Number(r.n);
  const marketsByState = {};
  let nextStart = null;
  for (const r of markets.results || []) {
    marketsByState[r.state] = Number(r.n);
    if (r.state === "OPEN" && r.next_start) nextStart = r.next_start;
  }

  return json({
    ok: true,
    at: new Date(now).toISOString(),
    cron: {
      last: settleLast ? settleLast.at : null,
      ageMinutes: settleAgeMin,
      healthy: settleAgeMin !== null && settleAgeMin <= 15,
      detail: settleLast ? settleLast.value : null
    },
    odds: {
      quota: status["odds:quota"] ? status["odds:quota"].value : null,
      quotaAt: status["odds:quota"] ? status["odds:quota"].at : null,
      keyConfigured: Boolean(String(env.ODDS_API_KEY || "").trim())
    },
    wallet: {
      writesEnabled: walletWritesEnabled(env),
      probe: wallet,
      byStatus: opsByStatus,
      attention: (reconcile.results || []).map((r) => ({
        id: r.id, type: r.type, amount: Number(r.amount), status: r.status, error: r.last_error || "",
        at: String(r.created_at).replace(" ", "T") + "Z", login: r.twitch_login || ""
      }))
    },
    picks: {
      markets: marketsByState,
      nextStart,
      active: Number(picks?.active || 0),
      today: Number(picks?.today || 0),
      riding: Number(picks?.riding || 0)
    },
    book,
    casinoBook: casinoStats,
    users: { total: Number(users?.total || 0), today: Number(users?.today || 0) },
    coin: coin ? { betsToday: Number(coin.bets_today || 0), roundsToday: Number(coin.rounds_today || 0), inRoom: Number(coin.in_room || 0) } : null,
    presence: presence ? { tabs: Number(presence.tabs || 0), people: Number(presence.people || 0), guests: Number(presence.guests || 0) } : null,
    music: music,
    tmdb: tmdbProbe,
    chat: { seJwt: Boolean(String(env.STREAMELEMENTS_JWT || "").trim()), botKey: Boolean(String(env.PICKS_BOT_KEY || "").trim()), cronKey: Boolean(String(env.PICKS_CRON_KEY || "").trim()), openWagering: String(env.PICKS_OPEN_WAGERING || "") === "1" },
    backup: (() => {
      const last = status["backup:last"] || null;
      const v = last ? last.value : null;
      return {
        bound: Boolean(env.BACKUPS),
        last: v ? v.at : null,
        ageHours: v ? Math.round((now - new Date(v.at).getTime()) / 3600000) : null,
        bytes: v ? Number(v.bytes || 0) : null,
        tables: v ? Number(v.tables || 0) : null,
        rows: v ? Number(v.rows || 0) : null,
        by: v ? v.by : null
      };
    })(),
    discord: { configured: /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(String(env.DISCORD_LEDGER_WEBHOOK || "").trim()) }
  });
}

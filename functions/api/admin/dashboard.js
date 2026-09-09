/* ============================================================
   GET /api/admin/dashboard — is everything fine before a Sunday?

   One answer for the one person who asked for it. Reads the status
   notes settlement leaves behind, counts what is in flight, and
   probes the pieces that live elsewhere (the music worker, TMDB,
   StreamElements) so a dead key shows up here before it shows up
   in chat.
   ============================================================ */

import { getSessionUser, walletWritesEnabled, readBalance } from "../picks/_lib.js";
import { readStatus } from "../picks/_ops.js";
import { tmdb } from "../screen/_tmdb.js";

const DASHBOARD_LOGINS = new Set(["bootypaper"]);
const DEFAULT_MUSIC_ROOM = "https://eastcoin-music-room.jake-7f5.workers.dev";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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

  const [status, ops, reconcile, markets, picks, users, coin, presence, music, tmdbProbe, wallet] = await Promise.all([
    readStatus(db, ["settle:last", "odds:quota", "autoopen:last"]),
    db.prepare(`SELECT status, COUNT(*) AS n FROM wallet_operations GROUP BY status`).all(),
    db.prepare(
      `SELECT o.id, o.type, o.amount, o.status, o.last_error, o.created_at, u.twitch_login
         FROM wallet_operations o LEFT JOIN users u ON u.twitch_id = o.user_id
        WHERE o.status IN ('NEEDS_RECONCILIATION','FAILED','PENDING')
        ORDER BY datetime(o.created_at) DESC LIMIT 12`
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
    })
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
    users: { total: Number(users?.total || 0), today: Number(users?.today || 0) },
    coin: coin ? { betsToday: Number(coin.bets_today || 0), roundsToday: Number(coin.rounds_today || 0), inRoom: Number(coin.in_room || 0) } : null,
    presence: presence ? { tabs: Number(presence.tabs || 0), people: Number(presence.people || 0), guests: Number(presence.guests || 0) } : null,
    music: music,
    tmdb: tmdbProbe,
    chat: { seJwt: Boolean(String(env.STREAMELEMENTS_JWT || "").trim()), botKey: Boolean(String(env.PICKS_BOT_KEY || "").trim()), cronKey: Boolean(String(env.PICKS_CRON_KEY || "").trim()), openWagering: String(env.PICKS_OPEN_WAGERING || "") === "1" }
  });
}

/* GET /api/casino/hilo/state — the caller's live run if any, their
   recent runs, and the room's recent runs (the public ledger). */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor, hourlyNet, HOUR_WIN_CAP } from "../_engine.js";
import { ensureHilo, liveGameFor, gamesLastHour, publicGame, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, MAX_MULTIPLIER, MAX_STEPS, EDGE_RETURN } from "./_hilo.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const HILO = { key: "hilo" };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensureHilo(db);

  const now = Date.now();
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, HILO, user.id, now);

  const live = user ? await liveGameFor(db, user.id) : null;

  const recent = await db
    .prepare(
      `SELECT g.id, g.stake, g.multiplier, g.status, g.payout, g.calls, g.cards, g.updated_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM hilo_games g JOIN users u ON u.twitch_id = g.user_id
        WHERE g.status IN ('CASHED','BUST')
        ORDER BY datetime(g.updated_at) DESC LIMIT 40`
    )
    .all();
  const ledger = (recent.results || []).map((r) => ({
    id: r.id,
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    stake: Number(r.stake),
    multiplier: Number(r.multiplier),
    steps: (() => { try { return JSON.parse(r.calls).length; } catch { return 0; } })(),
    cards: (() => { try { return JSON.parse(r.cards).length; } catch { return 0; } })(),
    status: r.status,
    payout: Number(r.payout || 0),
    profit: r.status === "CASHED" ? Number(r.payout) - Number(r.stake) : -Number(r.stake),
    at: String(r.updated_at).replace(" ", "T") + "Z"
  }));

  let me = null;
  if (user) {
    const t = await db
      .prepare(
        `SELECT SUM(CASE WHEN status = 'CASHED' THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN status = 'BUST' THEN 1 ELSE 0 END) AS busts,
                COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net,
                MAX(CASE WHEN status = 'CASHED' THEN multiplier ELSE 0 END) AS best
           FROM hilo_games WHERE user_id = ? AND status IN ('CASHED','BUST')`
      )
      .bind(user.id)
      .first();
    me = {
      id: user.id, login: user.login, displayName: user.displayName,
      gamesThisHour: await gamesLastHour(db, user.id),
      hourNet: await hourlyNet(db, user.id),
      wins: Number(t?.wins || 0), busts: Number(t?.busts || 0), net: Number(t?.net || 0), best: Number(t?.best || 0)
    };
  }

  return json({
    ok: true,
    now,
    config: { maxBet: MAX_BET, minBet: MIN_BET, maxPerHour: MAX_BETS_PER_HOUR, maxMultiplier: MAX_MULTIPLIER, maxSteps: MAX_STEPS, edgeReturn: EDGE_RETURN, hourCap: HOUR_WIN_CAP, canBet: Boolean(user) && walletWritesEnabled(context.env) },
    live: live ? publicGame(live) : null,
    ledger,
    room: await roomFor(db, HILO, now),
    me
  });
}

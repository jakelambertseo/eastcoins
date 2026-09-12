/* GET /api/casino/mines/state — the caller's live board if any,
   their record, the room's recent boards (the public ledger), and
   the multiplier ladder for each bomb count. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor, hourlyNet, HOUR_WIN_CAP } from "../_engine.js";
import { ensureMines, liveGameFor, gamesLastHour, publicGame, ladderFor, multiplierFor, TILES, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, MAX_MULTIPLIER, MIN_MINES, MAX_MINES, DEFAULT_MINES, EDGE_RETURN } from "./_mines.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const MINES = { key: "mines" };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensureMines(db);

  const now = Date.now();
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, MINES, user.id, now);

  const live = user ? await liveGameFor(db, user.id) : null;

  const recent = await db
    .prepare(
      `SELECT g.id, g.stake, g.mines, g.multiplier, g.status, g.payout, g.picks, g.updated_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM mines_games g JOIN users u ON u.twitch_id = g.user_id
        WHERE g.status IN ('CASHED','BUST')
        ORDER BY datetime(g.updated_at) DESC LIMIT 40`
    )
    .all();
  const ledger = (recent.results || []).map((r) => ({
    id: r.id,
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    stake: Number(r.stake),
    mines: Number(r.mines),
    multiplier: Number(r.multiplier),
    picks: (() => { try { return JSON.parse(r.picks).length; } catch { return 0; } })(),
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
           FROM mines_games WHERE user_id = ? AND status IN ('CASHED','BUST')`
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

  // What one tile pays at each bomb count, for the picker, and the whole
  // ladder for each — the page has to redraw when someone changes the
  // count BEFORE a board exists, so one ladder is not enough.
  const firstStep = {};
  const ladders = {};
  for (let m = MIN_MINES; m <= MAX_MINES; m += 1) {
    firstStep[m] = multiplierFor(m, 1);
    ladders[m] = ladderFor(m);
  }

  return json({
    ok: true,
    now,
    config: {
      tiles: TILES, maxBet: MAX_BET, minBet: MIN_BET, maxPerHour: MAX_BETS_PER_HOUR,
      minMines: MIN_MINES, maxMines: MAX_MINES, defaultMines: DEFAULT_MINES,
      maxMultiplier: MAX_MULTIPLIER, edgeReturn: EDGE_RETURN, hourCap: HOUR_WIN_CAP,
      firstStep,
      canBet: Boolean(user) && walletWritesEnabled(context.env)
    },
    ladders,
    // Kept for older clients that read a single ladder.
    ladder: live ? ladderFor(Number(live.mines)) : ladderFor(DEFAULT_MINES),
    live: live ? publicGame(live) : null,
    ledger,
    room: await roomFor(db, MINES, now),
    me
  });
}

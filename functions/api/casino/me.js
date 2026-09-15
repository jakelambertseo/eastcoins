/* GET /api/casino/me — the viewer's own casino numbers.

   Wallet, casino net, record, this hour against the cap, and how many
   plays are left in each game this hour. This used to ride inside
   /api/casino/home, which made that endpoint private and uncacheable
   for everyone; now the floor is public and shared at the edge, and
   this small call is the only part that has to reach the origin for a
   signed-in viewer. Never cached. */

import { betsLastHour as coinPlays } from "../coin/_coin.js";
import { GAMES, hourlyNet, HOUR_WIN_CAP, betsLastHour as sharedPlays, MAX_BETS_PER_HOUR } from "./_engine.js";
import { gamesLastHour as hiloPlays } from "./hilo/_hilo.js";
import { gamesLastHour as minesPlays } from "./mines/_mines.js";
import { dropsLastHour as plinkoPlays } from "./plinko/_plinko.js";
import { cardsLastHour as scratchPlays } from "./scratch/_scratch.js";
import { GAMES as PVP, joinsLastHour as pvpPlays } from "./pvp/_pvp.js";
import { getSessionUser } from "../picks/_lib.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const headers = { "Cache-Control": "no-store" };
  if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers });

  let me = null;
  try {
    const user = await getSessionUser(db, context.request);
    if (user) {
      const uid = String(user.id);
      const q = async (sql) => { try { return await db.prepare(sql).bind(uid).first(); } catch { return null; } };
      const [coin, shared, hilo, mines, plinko, pvp, scratch, hourNet] = await Promise.all([
        q(`SELECT SUM(status = 'WON') AS w, SUM(status = 'LOST') AS l, COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM coin_bets WHERE user_id = ?`),
        q(`SELECT SUM(status = 'WON') AS w, SUM(status = 'LOST') AS l, COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM casino_bets WHERE user_id = ?`),
        q(`SELECT SUM(status = 'CASHED') AS w, SUM(status = 'BUST') AS l, COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM hilo_games WHERE user_id = ?`),
        q(`SELECT SUM(status = 'CASHED') AS w, SUM(status = 'BUST') AS l, COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM mines_games WHERE user_id = ?`),
        q(`SELECT SUM(payout > stake) AS w, SUM(payout <= stake) AS l, COALESCE(SUM(payout - stake), 0) AS net FROM plinko_drops WHERE user_id = ?`),
        q(`SELECT SUM(status = 'WON') AS w, SUM(status = 'LOST') AS l, COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - stake WHEN status = 'LOST' THEN -stake ELSE 0 END), 0) AS net FROM pvp_entries WHERE user_id = ?`),
        q(`SELECT SUM(payout > stake) AS w, SUM(payout <= stake) AS l, COALESCE(SUM(payout - stake), 0) AS net FROM scratch_cards WHERE user_id = ?`),
        hourlyNet(db, uid)
      ]);

      /* How many plays are left in each game this hour. The limit is
         TEN PER GAME, not ten across the floor, so this is a number per
         game and the floor prints it under each card. Every count comes
         from that game's OWN limiter helper rather than a query written
         here, so what the card promises and what the bet endpoint
         enforces cannot drift apart. */
      const counters = [
        ["flip", () => coinPlays(db, uid)],
        ...Object.values(GAMES).filter((g) => !g.paused).map((g) => [g.key, () => sharedPlays(db, g, uid)]),
        ["hilo", () => hiloPlays(db, uid)],
        ["mines", () => minesPlays(db, uid)],
        ["plinko", () => plinkoPlays(db, uid)],
        ["scratch", () => scratchPlays(db, uid)],
        ...Object.values(PVP).filter((g) => !g.paused).map((g) => [g.key, () => pvpPlays(db, g.key, uid)])
      ];
      const counted = await Promise.all(counters.map(([, run]) => run().catch(() => 0)));
      const played = {};
      counters.forEach(([key], i) => { played[key] = Number(counted[i] || 0); });

      const n = (x) => Number(x || 0);
      me = {
        login: user.login, displayName: user.displayName,
        wins: n(coin?.w) + n(shared?.w) + n(hilo?.w) + n(mines?.w) + n(plinko?.w) + n(pvp?.w) + n(scratch?.w),
        losses: n(coin?.l) + n(shared?.l) + n(hilo?.l) + n(mines?.l) + n(plinko?.l) + n(pvp?.l) + n(scratch?.l),
        net: n(coin?.net) + n(shared?.net) + n(hilo?.net) + n(mines?.net) + n(plinko?.net) + n(pvp?.net) + n(scratch?.net),
        hourNet: n(hourNet), hourCap: HOUR_WIN_CAP,
        playsCap: MAX_BETS_PER_HOUR, played
      };
    }
  } catch { me = null; }

  return Response.json({ ok: true, me }, { headers });
}

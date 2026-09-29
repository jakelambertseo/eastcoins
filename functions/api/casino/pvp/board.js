/* GET /api/casino/pvp/board?game=roulette

   The table's wall of fame, for EastScape's Roulette Room (the board beside
   Bino): today's biggest pots, the longest winning run, and who has been
   shot the most. READ-ONLY: it settles nothing, moves nothing and knows
   nobody — no session is read, so one answer serves everyone and the edge
   holds it for a minute. Everything on it is already public in
   /api/casino/pvp/state's history and the activity feed.

   Cost: two queries over pvp_rounds/pvp_entries, both walked by
   idx_pvp_rounds_settled from a bare `settled_at >= ?`. The tables hold a
   few hundred rows; at one origin call a minute that is nothing. */

import { ensureSchema } from "../_engine.js";
import { ensurePvp, gameFor } from "./_pvp.js";

const json = (body, status = 200, cache = "no-store") => Response.json(body, { status, headers: { "Cache-Control": cache } });
const DAYS = 30;

/** Midnight in Chicago, as a UTC millisecond stamp: the site's day everywhere else. */
function chicagoDayStart(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return now - (((Number(p.hour) % 24) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 - (now % 1000);
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensurePvp(db);
  const game = gameFor(new URL(context.request.url).searchParams.get("game") || "roulette");
  if (!game) return json({ ok: false, code: "BAD_GAME" }, 400);

  const now = Date.now(), day = chicagoDayStart(now), since = now - DAYS * 86400000;
  const rows = (await db
    .prepare(
      `SELECT r.id, r.settled_at, r.pot, r.players, e.user_id, e.status, u.twitch_login, u.display_name
         FROM pvp_rounds r
         JOIN pvp_entries e ON e.round_id = r.id
         JOIN users u ON u.twitch_id = e.user_id
        WHERE r.game = ? AND +r.status = 'SETTLED' AND r.settled_at >= ?
        ORDER BY r.settled_at ASC`
    )
    .bind(game.key, since)
    .all()
    .catch(() => ({ results: [] }))).results || [];

  const who = new Map();   // user -> { name, login, wins, shot, run, best, tables }
  const pots = [];
  for (const x of rows) {
    const w = who.get(x.user_id) || { login: String(x.twitch_login).toLowerCase(), name: String(x.display_name || x.twitch_login), wins: 0, shot: 0, run: 0, best: 0, tables: 0 };
    w.tables += 1;
    if (x.status === "WON") { w.wins += 1; w.run += 1; w.best = Math.max(w.best, w.run); if (Number(x.settled_at) >= day) pots.push({ name: w.name, login: w.login, pot: Number(x.pot), players: Number(x.players), at: Number(x.settled_at) }); }
    else if (x.status === "LOST") { w.shot += 1; w.run = 0; }
    who.set(x.user_id, w);
  }
  const people = [...who.values()];
  const top = (key, n = 5) => people.filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key] || b.tables - a.tables || a.login.localeCompare(b.login)).slice(0, n).map((p) => ({ name: p.name, login: p.login, n: p[key], tables: p.tables }));

  return json({
    ok: true, game: game.key, days: DAYS,
    pots: pots.sort((a, b) => b.pot - a.pot || b.at - a.at).slice(0, 5),
    streaks: top("best"), shot: top("shot"), wins: top("wins")
  }, 200, "public, max-age=60, stale-while-revalidate=60");
}

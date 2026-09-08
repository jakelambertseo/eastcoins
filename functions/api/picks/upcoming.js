/* ============================================================
   GET /api/picks/upcoming

   The NFL games coming up, with the current consensus line for
   each — what the Picks page shows under "Upcoming" before a
   market exists. Nothing here can be bet on: a market opens 30
   minutes before kick-off with the line locked at that moment,
   and until then the number shown is only where the books are
   now.

   Reads the same cached schedule the auto-opener keeps, so this
   costs no extra Odds API credits beyond that one refresh every
   two hours — and none at all when nobody looks.
   ============================================================ */

import { upcomingGames } from "./_autoopen.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const headers = { "Cache-Control": "public, max-age=120" };

  let games = [];
  let fetchedAt = null;
  try {
    ({ games, fetchedAt } = await upcomingGames(context.env));
  } catch (error) {
    console.error("upcoming: schedule failed", error);
  }

  const now = Date.now();
  const horizon = now + 8 * 24 * 3600 * 1000;
  const future = games.filter((g) => {
    const at = new Date(g.commence).getTime();
    return Number.isFinite(at) && at > now && at <= horizon;
  });

  // A game that already has a market belongs in the open list, not here.
  let taken = new Set();
  if (db && future.length) {
    const marks = future.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT provider_event_id FROM markets WHERE provider = 'odds-api' AND provider_event_id IN (${marks})`)
      .bind(...future.map((g) => g.id))
      .all()
      .catch(() => ({ results: [] }));
    taken = new Set((rows.results || []).map((r) => String(r.provider_event_id)));
  }

  return Response.json({
    ok: true,
    fetchedAt,
    games: future
      .filter((g) => !taken.has(g.id))
      .sort((a, b) => a.commence.localeCompare(b.commence))
      .map((g) => ({
        id: g.id,
        sport: "american-football",
        league: "NFL",
        away: g.away,
        home: g.home,
        startsAt: g.commence,
        awayLine: g.awayLine,
        homeLine: g.homeLine,
        books: g.books
      }))
  }, { headers });
}

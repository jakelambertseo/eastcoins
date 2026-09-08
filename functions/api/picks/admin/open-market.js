/* ============================================================
   EastCoin Picks — open a market (admin)

   Creates a market with its moneylines already locked. Odds are
   given explicitly rather than pulled from The Odds API, for two
   reasons: it costs no API credits, and a test needs the price to
   be a known quantity rather than whatever the feed happened to
   say at that second.

   Team names must match the scores feed closely enough to settle —
   use full ESPN names ("Los Angeles Dodgers", not "LAD").
   ============================================================ */

import {
  ADMIN_ALLOWLIST,
  getSessionUser,
  totalReturn,
  newId,
  json,
  fail
} from "../_lib.js";

const SPORTS = new Set(["baseball", "american-football", "basketball", "hockey"]);

/**
 * Nothing here may reach the operator as an HTML error page. An
 * unhandled throw in a Pages function returns Cloudflare's 500 page,
 * which the admin UI can only report as "the endpoint threw" — true,
 * useless, and two debugging cycles wide. The message and stack go
 * back as JSON instead; this endpoint is admin-only, so the detail is
 * going to someone entitled to see it.
 */
export async function onRequestPost(context) {
  try {
    return await handleOpenMarket(context);
  } catch (error) {
    const detail = String(error?.message || error || "unknown");
    console.error("open-market threw:", detail, error?.stack || "");
    return fail("SERVER_ERROR", `The endpoint threw: ${detail}`, 500, {
      where: String(error?.stack || "").split("
").slice(0, 4).join(" | ")
    });
  }
}

async function handleOpenMarket(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can open markets.", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return fail("BAD_REQUEST", "Expected a JSON body.");
  }

  const sport = String(body?.sport || "").trim().toLowerCase();
  const league = String(body?.league || "").trim() || null;
  const away = String(body?.away || "").trim();
  const home = String(body?.home || "").trim();
  const awayOdds = Math.trunc(Number(body?.awayOdds));
  const homeOdds = Math.trunc(Number(body?.homeOdds));
  const startsAt = String(body?.startsAt || "").trim();

  if (!SPORTS.has(sport)) {
    return fail("BAD_SPORT", `sport must be one of: ${[...SPORTS].join(", ")}`);
  }
  if (!away || !home) return fail("BAD_TEAMS", "Both away and home names are required.");
  if (!Number.isInteger(awayOdds) || awayOdds === 0 ||
      !Number.isInteger(homeOdds) || homeOdds === 0) {
    return fail("BAD_ODDS", "awayOdds and homeOdds must be non-zero American lines, e.g. -150 and 130.");
  }

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return fail("BAD_START", "startsAt must be an ISO timestamp, e.g. 2026-09-08T23:10:00Z.");
  }
  if (start.getTime() <= Date.now()) {
    return fail("BAD_START", "startsAt is in the past — the market would be closed immediately.");
  }

  const season = await db
    .prepare(`SELECT id FROM seasons WHERE active = 1 LIMIT 1`)
    .first();
  if (!season) {
    return fail("NO_SEASON", "No active season. Apply migration 0002 to seed one.", 409);
  }

  const override = String(body?.eventId || "").trim();
  const base = override ||
    `manual:${sport}:${away}-vs-${home}:${start.toISOString().slice(0, 10)}`;

  // Only a market still in play blocks the fixture. A closed or settled
  // one is finished business, and refusing to reuse it forces the team
  // name to be misspelled just to get a second market on the same game
  // — which then breaks settlement matching.
  const existing = await db
    .prepare(
      `SELECT id, state
         FROM markets
        WHERE provider = 'manual'
          AND (provider_event_id = ? OR provider_event_id LIKE ?)
          AND state NOT IN ('VOID', 'SETTLED')
        LIMIT 1`
    )
    .bind(base, `${base}#%`)
    .first();
  if (existing) {
    return fail("ALREADY_OPEN",
      `That market already exists (${existing.id}, ${existing.state}). Close it first to reuse the fixture.`,
      409, { marketId: existing.id });
  }

  // markets carries UNIQUE (provider, provider_event_id), so permission
  // to reuse a fixture is not enough — the row still needs an id of its
  // own. Suffix it rather than reaching for a random one, so the id stays
  // readable and a genuine accidental double still collides.
  const priorCount = await db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM markets
        WHERE provider = 'manual'
          AND (provider_event_id = ? OR provider_event_id LIKE ?)`
    )
    .bind(base, `${base}#%`)
    .first();

  const prior = Number(priorCount?.n || 0);
  const providerEventId = override || (prior ? `${base}#${prior + 1}` : base);

  const marketId = newId("mkt");

  try {
    await db
      .prepare(
        `INSERT INTO markets
           (id, provider, provider_event_id, season_id, sport, league,
            away_name, home_name, starts_at, state,
            away_odds_locked, home_odds_locked, odds_locked_at)
         VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(marketId, providerEventId, String(season.id), sport, league,
            away, home, start.toISOString(), awayOdds, homeOdds)
      .run();
  } catch (error) {
    // Any database refusal is a readable answer, not a 500 HTML page
    // that surfaces to the operator as a JSON parse error.
    const detail = String(error?.message || "");
    console.error("open-market insert failed", detail);
    return fail(
      "INSERT_FAILED",
      detail.includes("UNIQUE")
        ? "A market with that fixture id already exists. Close the existing one first."
        : `The market couldn't be created: ${detail.slice(0, 160)}`,
      409
    );
  }

  return json({
    ok: true,
    market: {
      id: marketId,
      sport,
      league,
      away,
      home,
      startsAt: start.toISOString(),
      awayOdds,
      homeOdds,
      // Shown back so the price can be sanity-checked before anyone bets.
      example: {
        stake: 10,
        awayReturns: totalReturn(10, awayOdds),
        homeReturns: totalReturn(10, homeOdds)
      }
    }
  });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to open a market.", 405);
}

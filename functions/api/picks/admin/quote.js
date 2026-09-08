/* ============================================================
   EastCoin Picks — fetch a real moneyline (admin)

   On-demand only, one request per press. The catalog's polling
   limits exist because Odds API usage got expensive during
   development, and nothing here changes those — this is a person
   asking for one price, not a new feed.

   Returns a consensus across books (the median, so a single
   mispriced outlier can't drag the line) plus the individual
   prices, because a number that decides real payouts should be
   checkable rather than trusted.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, totalReturn, json, fail } from "../_lib.js";

const ODDS_API = "https://api.the-odds-api.com/v4/sports";

const SPORT_KEYS = {
  "american-football": "americanfootball_nfl",
  ncaaf: "americanfootball_ncaaf",
  baseball: "baseball_mlb",
  basketball: "basketball_nba",
  hockey: "icehockey_nhl"
};

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Even count: round toward the underdog rather than inventing a
  // half-point that no book actually offered.
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function words(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can fetch odds.", 403);
  }

  const apiKey = String(context.env.ODDS_API_KEY || "").trim();
  if (!apiKey) return fail("ODDS_API_KEY_MISSING", "No Odds API key is configured.", 503);

  const url = new URL(context.request.url);
  const sportParam = String(url.searchParams.get("sport") || "").trim().toLowerCase();
  const team = words(url.searchParams.get("team") || "");
  const sport = SPORT_KEYS[sportParam] || sportParam;

  if (!sport) return fail("BAD_SPORT", `sport must be one of: ${Object.keys(SPORT_KEYS).join(", ")}`);

  const query = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "h2h",
    oddsFormat: "american"
  });

  let response;
  try {
    response = await fetch(`${ODDS_API}/${encodeURIComponent(sport)}/odds/?${query}`);
  } catch {
    return fail("ODDS_API_ERROR", "Couldn't reach the Odds API.", 502);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return fail("ODDS_API_ERROR", `Odds API returned ${response.status}. ${body.slice(0, 160)}`, 502);
  }

  const games = await response.json().catch(() => null);
  if (!Array.isArray(games)) return fail("ODDS_API_ERROR", "Unexpected Odds API response.", 502);

  const matches = team
    ? games.filter((g) =>
        words(g.away_team).includes(team) || words(g.home_team).includes(team))
    : games;

  if (!matches.length) {
    return json({
      ok: true,
      found: 0,
      // Said plainly: the standard feed carries pregame prices, and a
      // game already under way is usually simply absent from it.
      note: team
        ? `No priced game matching "${team}". The Odds API's h2h feed is pregame — a game already in progress usually isn't in it.`
        : "No priced games returned.",
      available: games.slice(0, 12).map((g) => `${g.away_team} at ${g.home_team}`),
      creditsRemaining: response.headers.get("x-requests-remaining")
    });
  }

  const priced = matches.slice(0, 5).map((game) => {
    const away = [];
    const home = [];
    const books = [];

    for (const book of game.bookmakers || []) {
      const h2h = (book.markets || []).find((m) => m.key === "h2h");
      const a = (h2h?.outcomes || []).find((o) => o.name === game.away_team);
      const h = (h2h?.outcomes || []).find((o) => o.name === game.home_team);
      if (!Number.isFinite(a?.price) || !Number.isFinite(h?.price)) continue;
      away.push(a.price);
      home.push(h.price);
      books.push({ book: book.title, away: a.price, home: h.price });
    }

    const awayOdds = median(away);
    const homeOdds = median(home);

    return {
      away: game.away_team,
      home: game.home_team,
      startsAt: game.commence_time,
      awayOdds,
      homeOdds,
      bookCount: books.length,
      books,
      // What the admin form would produce, so the price can be sanity
      // checked before it prices anyone's stake.
      example: awayOdds && homeOdds
        ? { stake: 10, awayReturns: totalReturn(10, awayOdds), homeReturns: totalReturn(10, homeOdds) }
        : null
    };
  });

  return json({
    ok: true,
    found: priced.length,
    sport,
    games: priced,
    creditsRemaining: response.headers.get("x-requests-remaining")
  });
}

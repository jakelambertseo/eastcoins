/* ============================================================
   EastCoin Picks — open the day's NFL markets by themselves

   Thirty minutes before each kick-off, every NFL game gets a
   market with its consensus line locked, and chat is told once —
   one message for the whole slate, however many games share a
   window. Runs inside the scheduled settlement pass so nothing
   new has to be deployed or remembered.

   Quota is the design constraint. The Odds API bills per request,
   so:

     · the SCHEDULE (which games, when) is fetched once and cached
       for six hours — it does not change
     · a FRESH price is fetched only when a game is actually due,
       so the locked line is current rather than hours old
     · nothing is fetched at all on a tick with no game due

   That is a handful of requests on a game day and none on the
   others, instead of one every ten minutes forever.
   ============================================================ */

import { newId } from "./_lib.js";

const ODDS_API = "https://api.the-odds-api.com/v4/sports";
const SPORT_KEY = "americanfootball_nfl";

const OPEN_LEAD_MS = 30 * 60 * 1000;
const SCHEDULE_TTL_S = 6 * 60 * 60;

// One quiet, stable key so every colo shares the same cached schedule.
const SCHEDULE_CACHE_URL = "https://eastcoin-picks.internal/schedule/" + SPORT_KEY;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function fetchOdds(apiKey) {
  const query = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "h2h",
    oddsFormat: "american"
  });
  const response = await fetch(`${ODDS_API}/${SPORT_KEY}/odds/?${query}`);
  if (!response.ok) {
    console.error(`Odds API odds ${SPORT_KEY}: HTTP ${response.status}`);
    return null;
  }
  const games = await response.json().catch(() => null);
  return Array.isArray(games) ? games : null;
}

/** The consensus line for each side of a game — the median across books. */
function consensus(game) {
  const away = [];
  const home = [];
  for (const book of game.bookmakers || []) {
    const h2h = (book.markets || []).find((m) => m.key === "h2h");
    const a = (h2h?.outcomes || []).find((o) => o.name === game.away_team);
    const h = (h2h?.outcomes || []).find((o) => o.name === game.home_team);
    if (!Number.isFinite(a?.price) || !Number.isFinite(h?.price)) continue;
    away.push(a.price);
    home.push(h.price);
  }
  return { away: median(away), home: median(home), books: away.length };
}

async function schedule(apiKey) {
  const cache = caches.default;
  const key = new Request(SCHEDULE_CACHE_URL);

  const hit = await cache.match(key);
  if (hit) return hit.json();

  const games = await fetchOdds(apiKey);
  if (!games) return [];

  // Only what a later tick needs to decide whether to ask for a price.
  const slim = games.map((g) => ({
    id: String(g.id || ""),
    commence: String(g.commence_time || ""),
    away: String(g.away_team || ""),
    home: String(g.home_team || "")
  })).filter((g) => g.id && g.commence);

  await cache.put(key, new Response(JSON.stringify(slim), {
    headers: { "Cache-Control": `max-age=${SCHEDULE_TTL_S}`, "Content-Type": "application/json" }
  }));
  return slim;
}

/**
 * Opens any NFL game due to start within the lead window that does not
 * already have a market. Returns the rows it opened, shaped the way the
 * announcement composer expects, so the caller can say so in chat.
 */
export async function autoOpenMarkets(env, db) {
  const apiKey = String(env.ODDS_API_KEY || "").trim();
  if (!apiKey) return [];

  const season = await db.prepare(`SELECT id FROM seasons WHERE active = 1 LIMIT 1`).first();
  if (!season) return [];

  const now = Date.now();
  const due = (await schedule(apiKey)).filter((g) => {
    const at = new Date(g.commence).getTime();
    return Number.isFinite(at) && at > now && at - now <= OPEN_LEAD_MS;
  });
  if (!due.length) return [];

  // Anything already open for these games — a previous tick, or an admin
  // who opened it by hand first — is left alone.
  const marks = due.map(() => "?").join(",");
  const existing = await db
    .prepare(`SELECT provider_event_id FROM markets WHERE provider = 'odds-api' AND provider_event_id IN (${marks})`)
    .bind(...due.map((g) => g.id))
    .all();
  const have = new Set((existing.results || []).map((r) => String(r.provider_event_id)));
  const missing = due.filter((g) => !have.has(g.id));
  if (!missing.length) return [];

  // A fresh price now, not the one cached with the schedule hours ago:
  // this is the line everyone will be held to.
  const fresh = await fetchOdds(apiKey);
  const priced = new Map((fresh || []).map((g) => [String(g.id), consensus(g)]));

  const opened = [];
  for (const game of missing) {
    const line = priced.get(game.id);
    if (!line || !Number.isFinite(line.away) || !Number.isFinite(line.home) || !line.away || !line.home) {
      console.warn(`auto-open: no usable line for ${game.away} at ${game.home}, skipping`);
      continue;
    }

    const id = newId("mkt");
    try {
      await db
        .prepare(
          `INSERT INTO markets
             (id, provider, provider_event_id, season_id, sport, league,
              away_name, home_name, starts_at, state,
              away_odds_locked, home_odds_locked, odds_locked_at)
           VALUES (?, 'odds-api', ?, ?, 'american-football', 'NFL', ?, ?, ?, 'OPEN', ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(id, game.id, String(season.id), game.away, game.home, game.commence, line.away, line.home)
        .run();
    } catch (error) {
      // UNIQUE(provider, provider_event_id): another tick won the race.
      if (!String(error?.message || "").includes("UNIQUE")) console.error("auto-open insert failed", error);
      continue;
    }

    console.log(`auto-open: ${game.away} ${line.away} at ${game.home} ${line.home} (${line.books} books)`);
    opened.push({
      id,
      sport: "american-football",
      away_name: game.away,
      home_name: game.home,
      away_odds_locked: line.away,
      home_odds_locked: line.home,
      starts_at: game.commence
    });
  }

  return opened;
}

/* ============================================================
   EastCoin Picks — open markets by themselves

   Two rhythms, one pass, run inside the scheduled settlement tick:

     NFL   an hour before each kick-off, every game gets a market
           with its consensus line locked, and chat is told once —
           one message for the whole slate.

     MLB   every day at 4:00 PM Central the next day's worth of
           games open at once — tonight's, and tomorrow's day games
           — with lines locked then. Quiet in chat: no open line,
           no countdown, no closing or settlement line. The site,
           the game pages, the bot's replies and Discord carry it.

   Quota is the design constraint. The Odds API bills per request:

     · the SCHEDULE per sport (which games, when, where the line is
       now) is fetched once and cached thirty minutes — the Picks
       page's Upcoming list reads the same copy
     · a FRESH price is fetched only when a game is actually due,
       so the locked line is current rather than hours old
     · nothing is fetched on a tick with no game due
   ============================================================ */

import { newId } from "./_lib.js";

const ODDS_API = "https://api.the-odds-api.com/v4/sports";
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const TZ = "America/Chicago";

export const SPORTS = [
  { key: "americanfootball_nfl", sport: "american-football", league: "NFL", open: "lead", leadMs: HOUR, horizonMs: 8 * DAY, quiet: false },
  { key: "baseball_mlb", sport: "baseball", league: "MLB", open: "daily", openHourCT: 16, horizonMs: 30 * HOUR, quiet: true }
];

/** Sports whose markets run without a word in Twitch chat. */
export function quietInChat(sport) {
  return SPORTS.some((s) => s.sport === sport && s.quiet);
}

// One credit per refresh; at most 48 a day per sport, and only while
// someone is looking or a game is near.
const SCHEDULE_TTL_S = 30 * 60;
// v3: entries carry sport, league and the open time.
const cacheUrl = (cfg) => `https://eastcoin-picks.internal/schedule-v3/${cfg.key}`;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// The latest quota headers seen, for the settlement pass to note.
let lastQuota = null;
export function lastOddsQuota() { return lastQuota; }

/* ---------------------------------------------------------- Central time */

function ctParts(ms) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) };
}

/** The instant of HH:00 Central on the Central calendar date of `ms`. */
function ctHourOn(ms, hour) {
  const { y, m, d } = ctParts(ms);
  let guess = Date.UTC(y, m - 1, d, hour + 5);   // CDT; corrected below for CST
  const got = ctParts(guess);
  if (got.h !== hour || got.d !== d) guess += (hour - got.h) * HOUR;
  return guess;
}

/**
 * When a game opens for picks. NFL: an hour before. MLB: the 4 PM
 * Central slot that precedes it — the same afternoon for a night game,
 * the afternoon before for a day game.
 */
export function opensAtFor(cfg, commenceIso) {
  const at = new Date(commenceIso).getTime();
  if (!Number.isFinite(at)) return null;
  if (cfg.open === "lead") return at - cfg.leadMs;
  const sameDay = ctHourOn(at, cfg.openHourCT);
  return at >= sameDay ? sameDay : ctHourOn(at - DAY, cfg.openHourCT);
}

/* ---------------------------------------------------------- Odds API */

async function fetchOdds(apiKey, cfg) {
  const horizon = new Date(Date.now() + cfg.horizonMs).toISOString().replace(/\.\d{3}Z$/, "Z");
  const query = new URLSearchParams({ apiKey, regions: "us", markets: "h2h", oddsFormat: "american", commenceTimeTo: horizon });
  const response = await fetch(`${ODDS_API}/${cfg.key}/odds/?${query}`);
  lastQuota = {
    used: Number(response.headers.get("x-requests-used")),
    remaining: Number(response.headers.get("x-requests-remaining")),
    last: `odds ${cfg.key}`
  };
  if (!response.ok) {
    console.error(`Odds API odds ${cfg.key}: HTTP ${response.status}`);
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

async function schedule(apiKey, cfg) {
  const cache = caches.default;
  const key = new Request(cacheUrl(cfg));
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const games = await fetchOdds(apiKey, cfg);
  if (!games) return { games: [], fetchedAt: null };

  // What a later tick needs to decide whether to ask for a price, plus
  // where the line is now for the Upcoming list. The line that gets
  // LOCKED is never this one — a fresh price is fetched at open time.
  const slim = games.map((g) => {
    const line = consensus(g);
    const opensAt = opensAtFor(cfg, g.commence_time);
    return {
      id: String(g.id || ""),
      sport: cfg.sport,
      league: cfg.league,
      commence: String(g.commence_time || ""),
      opensAt: opensAt ? new Date(opensAt).toISOString() : null,
      away: String(g.away_team || ""),
      home: String(g.home_team || ""),
      awayLine: line.away,
      homeLine: line.home,
      books: line.books
    };
  }).filter((g) => g.id && g.commence);

  const payload = { games: slim, fetchedAt: new Date().toISOString() };
  await cache.put(key, new Response(JSON.stringify(payload), {
    headers: { "Cache-Control": `max-age=${SCHEDULE_TTL_S}`, "Content-Type": "application/json" }
  }));
  return payload;
}

/** Every sport's cached schedule with current lines, for the Picks page. */
export async function upcomingGames(env) {
  const apiKey = String(env.ODDS_API_KEY || "").trim();
  if (!apiKey) return { games: [], fetchedAt: null };
  const all = await Promise.all(SPORTS.map((cfg) => schedule(apiKey, cfg).catch(() => ({ games: [], fetchedAt: null }))));
  return {
    games: all.flatMap((s) => s.games),
    fetchedAt: all.map((s) => s.fetchedAt).filter(Boolean).sort().pop() || null
  };
}

/* ---------------------------------------------------------- opening */

/**
 * Opens any game whose open time has passed and which does not already
 * have a market. Returns the rows it opened, shaped the way the
 * announcement composer expects, so the caller can say so.
 */
export async function autoOpenMarkets(env, db) {
  const apiKey = String(env.ODDS_API_KEY || "").trim();
  if (!apiKey) return [];

  const season = await db.prepare(`SELECT id FROM seasons WHERE active = 1 LIMIT 1`).first();
  if (!season) return [];

  const now = Date.now();
  const opened = [];

  for (const cfg of SPORTS) {
    let games = [];
    try { games = (await schedule(apiKey, cfg)).games; } catch (error) { console.error(`schedule ${cfg.key}`, error); continue; }

    const due = games.filter((g) => {
      const at = new Date(g.commence).getTime();
      const opens = opensAtFor(cfg, g.commence);
      return Number.isFinite(at) && at > now && opens !== null && opens <= now;
    });
    if (!due.length) continue;

    // Anything already open for these games — a previous tick, or an
    // admin who opened it by hand first — is left alone.
    const marks = due.map(() => "?").join(",");
    const existing = await db
      .prepare(`SELECT provider_event_id FROM markets WHERE provider = 'odds-api' AND provider_event_id IN (${marks})`)
      .bind(...due.map((g) => g.id))
      .all();
    const have = new Set((existing.results || []).map((r) => String(r.provider_event_id)));
    const missing = due.filter((g) => !have.has(g.id));
    if (!missing.length) continue;

    // A fresh price now, not the one cached with the schedule hours ago:
    // this is the line everyone will be held to.
    const fresh = await fetchOdds(apiKey, cfg);
    const priced = new Map((fresh || []).map((g) => [String(g.id), consensus(g)]));

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
             VALUES (?, 'odds-api', ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, CURRENT_TIMESTAMP)`
          )
          .bind(id, game.id, String(season.id), cfg.sport, cfg.league, game.away, game.home, game.commence, line.away, line.home)
          .run();
      } catch (error) {
        // UNIQUE(provider, provider_event_id): another tick won the race.
        if (!String(error?.message || "").includes("UNIQUE")) console.error("auto-open insert failed", error);
        continue;
      }

      console.log(`auto-open ${cfg.league}: ${game.away} ${line.away} at ${game.home} ${line.home} (${line.books} books)`);
      opened.push({
        id,
        sport: cfg.sport,
        league: cfg.league,
        away_name: game.away,
        home_name: game.home,
        away_odds_locked: line.away,
        home_odds_locked: line.home,
        starts_at: game.commence
      });
    }
  }

  return opened;
}

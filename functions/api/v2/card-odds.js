const SPORT_KEY = "upcoming";
const CACHE_VERSION = "v1";
const DEFAULT_CACHE_SECONDS = 30 * 60;

const STOP_WORDS = new Set([
  "fc", "cf", "sc", "afc", "club", "team",
  "women", "womens", "men", "mens",
  "the", "university", "college"
]);

function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function nameScore(candidate, target) {
  const left = normalize(candidate);
  const right = normalize(target);

  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.96;

  const targetTokens = tokens(target);

  if (!targetTokens.length) return 0;

  const candidateTokens = new Set(tokens(candidate));
  const hits = targetTokens.filter((token) => candidateTokens.has(token)).length;

  return hits / targetTokens.length;
}

function americanToImplied(price) {
  const value = Number(price);

  if (!Number.isFinite(value) || value === 0) return null;

  return value > 0
    ? 100 / (value + 100)
    : Math.abs(value) / (Math.abs(value) + 100);
}

function probabilityToAmerican(probability) {
  const p = Number(probability);

  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  if (Math.abs(p - 0.5) < 0.000001) return 100;

  return p < 0.5
    ? Math.round((100 * (1 - p)) / p)
    : -Math.round((100 * p) / (1 - p));
}

function median(values) {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!clean.length) return null;

  const middle = Math.floor(clean.length / 2);

  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2;
}

function consensus(game) {
  const homeName = String(game?.home_team || "");
  const awayName = String(game?.away_team || "");
  const pairs = [];

  for (const bookmaker of game?.bookmakers || []) {
    const market = (bookmaker?.markets || [])
      .find((item) => item?.key === "h2h");

    if (!market) continue;

    const home = (market.outcomes || [])
      .find((outcome) => outcome?.name === homeName);

    const away = (market.outcomes || [])
      .find((outcome) => outcome?.name === awayName);

    if (!home || !away) continue;

    const homeRaw = americanToImplied(home.price);
    const awayRaw = americanToImplied(away.price);

    if (homeRaw == null || awayRaw == null) continue;

    const total = homeRaw + awayRaw;
    if (total <= 0) continue;

    pairs.push({
      home: homeRaw / total,
      away: awayRaw / total
    });
  }

  if (!pairs.length) return null;

  let home = median(pairs.map((pair) => pair.home));
  let away = median(pairs.map((pair) => pair.away));

  if (home == null || away == null || home + away <= 0) return null;

  const total = home + away;
  home /= total;
  away /= total;

  return {
    home: {
      american: probabilityToAmerican(home),
      fairProbability: home,
      bookCount: pairs.length
    },
    away: {
      american: probabilityToAmerican(away),
      fairProbability: away,
      bookCount: pairs.length
    }
  };
}

function eventMatchScore(event, game) {
  const normalAway = nameScore(game?.away_team, event.away);
  const normalHome = nameScore(game?.home_team, event.home);
  const swapAway = nameScore(game?.home_team, event.away);
  const swapHome = nameScore(game?.away_team, event.home);

  let orientation = "normal";
  let teamScore = normalAway * 0.44 + normalHome * 0.44;

  if (swapAway + swapHome > normalAway + normalHome) {
    orientation = "swapped";
    teamScore = swapAway * 0.44 + swapHome * 0.44;
  }

  const eventStart = Number(event?.startsAt || 0);
  const providerStart = Date.parse(game?.commence_time || "");
  let timeScore = 0.5;

  if (eventStart && Number.isFinite(providerStart)) {
    const hours = Math.abs(eventStart - providerStart) / 3600000;

    if (hours <= 1.5) timeScore = 1;
    else if (hours <= 4) timeScore = 0.8;
    else if (hours <= 10) timeScore = 0.45;
    else if (hours <= 18) timeScore = 0.15;
    else timeScore = 0;
  }

  return {
    score: teamScore + timeScore * 0.12,
    orientation
  };
}

async function getProviderGames(context) {
  const apiKey = String(
    context.env.ODDS_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error("ODDS_API_KEY_MISSING");
  }

  const origin = new URL(context.request.url).origin;

  const cacheKey = new Request(
    `${origin}/__eastcoin_internal_cache__/v2/card-odds/${CACHE_VERSION}`,
    { method: "GET" }
  );

  let edgeCache = null;

  try {
    edgeCache = caches.default;
  } catch {}

  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);

    if (cached) {
      return {
        payload: await cached.json(),
        cacheStatus: "HIT"
      };
    }
  }

  const upstreamUrl = new URL(
    `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds`
  );

  upstreamUrl.searchParams.set("apiKey", apiKey);
  upstreamUrl.searchParams.set("regions", "us");
  upstreamUrl.searchParams.set("markets", "h2h");
  upstreamUrl.searchParams.set("oddsFormat", "american");
  upstreamUrl.searchParams.set("dateFormat", "iso");

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!upstream.ok) {
    const error = new Error(`ODDS_API_${upstream.status}`);
    error.status = upstream.status;
    throw error;
  }

  const games = await upstream.json();

  const quota = {
    remaining: Number(upstream.headers.get("x-requests-remaining")),
    used: Number(upstream.headers.get("x-requests-used")),
    lastCost: Number(upstream.headers.get("x-requests-last"))
  };

  // Shared browse odds can be much staler than locked wager quotes. If quota
  // gets low, automatically stretch the cache to preserve the account.
  let ttl = DEFAULT_CACHE_SECONDS;

  if (Number.isFinite(quota.remaining)) {
    if (quota.remaining <= 75) ttl = 8 * 60 * 60;
    else if (quota.remaining <= 150) ttl = 4 * 60 * 60;
    else if (quota.remaining <= 250) ttl = 2 * 60 * 60;
  }

  const payload = {
    games: Array.isArray(games) ? games : [],
    generatedAt: new Date().toISOString(),
    quota,
    ttl
  };

  if (edgeCache) {
    const stored = Response.json(payload, {
      headers: {
        "Cache-Control": `public, max-age=${ttl}`
      }
    });

    context.waitUntil(edgeCache.put(cacheKey, stored));
  }

  return {
    payload,
    cacheStatus: "MISS"
  };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const events = (Array.isArray(body?.events) ? body.events : [])
      .slice(0, 80)
      .filter((event) =>
        event &&
        String(event.id || "") &&
        String(event.away || "").trim() &&
        String(event.home || "").trim()
      );

    if (!events.length) {
      return reply({
        ok: true,
        odds: {},
        matched: 0
      });
    }

    const { payload, cacheStatus } = await getProviderGames(context);
    const providerGames = payload.games || [];
    const odds = {};
    let matched = 0;

    for (const event of events) {
      let bestGame = null;
      let best = null;

      for (const game of providerGames) {
        const result = eventMatchScore(event, game);

        if (!best || result.score > best.score) {
          best = result;
          bestGame = game;
        }
      }

      if (!bestGame || !best || best.score < 0.79) {
        continue;
      }

      const line = consensus(bestGame);

      if (!line?.away?.american || !line?.home?.american) {
        continue;
      }

      odds[String(event.id)] =
        best.orientation === "swapped"
          ? {
              away: line.home,
              home: line.away,
              sportKey: bestGame.sport_key,
              commenceTime: bestGame.commence_time
            }
          : {
              away: line.away,
              home: line.home,
              sportKey: bestGame.sport_key,
              commenceTime: bestGame.commence_time
            };

      matched += 1;
    }

    return reply({
      ok: true,
      odds,
      matched,
      providerGameCount: providerGames.length,
      provider: "The Odds API",
      market: "h2h",
      consensusMethod: "median_no_vig_implied_probability",
      cache: {
        status: cacheStatus,
        generatedAt: payload.generatedAt,
        ttlSeconds: payload.ttl
      },
      quota: payload.quota
    });
  } catch (error) {
    console.error("V2 card odds failed", error);

    const missing =
      String(error?.message || "") === "ODDS_API_KEY_MISSING";

    return reply({
      ok: false,
      odds: {},
      code: missing
        ? "ODDS_API_KEY_MISSING"
        : "CARD_ODDS_FAILED",
      message: missing
        ? "The Odds API is not configured."
        : "Card odds are temporarily unavailable."
    }, missing ? 503 : 502);
  }
}

export function onRequestGet() {
  return reply({
    ok: true,
    endpoint: "EastCoin V2 card odds",
    method: "POST",
    provider: "The Odds API",
    sport: "upcoming",
    market: "h2h",
    note: "One shared cached cross-sport request feeds matching EastCoin cards."
  });
}

const CACHE_TTL_SECONDS = 15 * 60;
const CACHE_VERSION = "v2";
const MAX_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_GAMES = 120;
const MAX_MMA_MARKETS = 5;

const SPORTS = [
  {
    key: "americanfootball_nfl",
    title: "NFL",
    family: "american-football",
    priority: 0
  },
  {
    key: "baseball_mlb",
    title: "MLB",
    family: "baseball",
    priority: 1
  },
  {
    key: "mma_mixed_martial_arts",
    title: "UFC / MMA",
    family: "combat",
    priority: 2
  }
];

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function americanToImplied(price) {
  const value = Number(price);

  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  return value > 0
    ? 100 / (value + 100)
    : Math.abs(value) /
      (Math.abs(value) + 100);
}

function probabilityToAmerican(probability) {
  const p = Number(probability);

  if (
    !Number.isFinite(p) ||
    p <= 0 ||
    p >= 1
  ) {
    return null;
  }

  if (Math.abs(p - 0.5) < 0.000001) {
    return 100;
  }

  return p < 0.5
    ? Math.round(
        (100 * (1 - p)) / p
      )
    : -Math.round(
        (100 * p) / (1 - p)
      );
}

function median(values) {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!clean.length) return null;

  const middle =
    Math.floor(clean.length / 2);

  return clean.length % 2
    ? clean[middle]
    : (
        clean[middle - 1] +
        clean[middle]
      ) / 2;
}

function consensus(game) {
  const homeName =
    String(game?.home_team || "");

  const awayName =
    String(game?.away_team || "");

  const pairs = [];

  for (
    const bookmaker of
    game?.bookmakers || []
  ) {
    const market =
      (bookmaker?.markets || [])
        .find(
          (item) =>
            item?.key === "h2h"
        );

    if (!market) continue;

    const home =
      (market.outcomes || [])
        .find(
          (item) =>
            item?.name === homeName
        );

    const away =
      (market.outcomes || [])
        .find(
          (item) =>
            item?.name === awayName
        );

    if (!home || !away) continue;

    const homeRaw =
      americanToImplied(home.price);

    const awayRaw =
      americanToImplied(away.price);

    if (
      homeRaw == null ||
      awayRaw == null
    ) {
      continue;
    }

    const total =
      homeRaw + awayRaw;

    if (total <= 0) continue;

    pairs.push({
      home: homeRaw / total,
      away: awayRaw / total
    });
  }

  if (!pairs.length) {
    return null;
  }

  let home = median(
    pairs.map(
      (pair) => pair.home
    )
  );

  let away = median(
    pairs.map(
      (pair) => pair.away
    )
  );

  if (
    home == null ||
    away == null ||
    home + away <= 0
  ) {
    return null;
  }

  const total = home + away;

  home /= total;
  away /= total;

  return {
    home: {
      american:
        probabilityToAmerican(home),
      fairProbability: home,
      bookCount: pairs.length
    },
    away: {
      american:
        probabilityToAmerican(away),
      fairProbability: away,
      bookCount: pairs.length
    }
  };
}

async function fetchSport(
  apiKey,
  sport
) {
  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${sport.key}/odds/`
  );

  url.searchParams.set(
    "apiKey",
    apiKey
  );
  url.searchParams.set(
    "regions",
    "us"
  );
  url.searchParams.set(
    "markets",
    "h2h"
  );
  url.searchParams.set(
    "oddsFormat",
    "american"
  );
  url.searchParams.set(
    "dateFormat",
    "iso"
  );

  const response = await fetch(
    url.toString(),
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    const payload =
      await response
        .json()
        .catch(() => null);

    const error = new Error(
      payload?.message ||
      payload?.error ||
      `The Odds API returned ${response.status}.`
    );

    error.status = response.status;
    error.code =
      payload?.error_code ||
      payload?.code ||
      "ODDS_API_ERROR";

    throw error;
  }

  const raw =
    await response.json();

  return {
    sport,
    games:
      Array.isArray(raw)
        ? raw
        : []
  };
}

function normalizeGame(
  raw,
  sport,
  now
) {
  const start =
    Date.parse(
      raw?.commence_time || ""
    );

  if (
    !Number.isFinite(start) ||
    start <= now ||
    start >
      now + MAX_HORIZON_MS
  ) {
    return null;
  }

  const line =
    consensus(raw);

  if (
    !line?.away ||
    !line?.home ||
    !Number.isFinite(
      Number(
        line.away.american
      )
    ) ||
    !Number.isFinite(
      Number(
        line.home.american
      )
    )
  ) {
    return null;
  }

  return {
    provider: "odds_api",
    providerEventId:
      String(raw?.id || ""),
    sportKey:
      String(
        raw?.sport_key ||
        sport.key
      ),
    sportTitle:
      String(
        raw?.sport_title ||
        sport.title
      ),
    family: sport.family,
    priority: sport.priority,
    commenceTime:
      raw?.commence_time ||
      null,
    awayTeam:
      String(
        raw?.away_team ||
        "Away"
      ),
    homeTeam:
      String(
        raw?.home_team ||
        "Home"
      ),
    consensus: line
  };
}

function capMmaMarkets(games) {
  let mmaCount = 0;

  return games.filter(
    (game) => {
      if (
        game?.sportKey !==
        "mma_mixed_martial_arts"
      ) {
        return true;
      }

      mmaCount += 1;

      return (
        mmaCount <=
        MAX_MMA_MARKETS
      );
    }
  );
}

function clientResponse(
  payload,
  cacheStatus
) {
  return json({
    ...payload,
    cache: {
      ...(payload.cache || {}),
      status: cacheStatus,
      ttlSeconds:
        CACHE_TTL_SECONDS
    }
  });
}

export async function onRequestGet(
  context
) {
  const apiKey =
    String(
      context.env
        .ODDS_API_KEY || ""
    ).trim();

  if (!apiKey) {
    return json(
      {
        ok: false,
        code:
          "ODDS_API_KEY_MISSING",
        message:
          "The live Picks catalog is not configured."
      },
      503
    );
  }

  const requestUrl =
    new URL(
      context.request.url
    );

  const cacheKey =
    new Request(
      `${requestUrl.origin}/__eastcoin_internal_cache__/picks/catalog/${CACHE_VERSION}`,
      {
        method: "GET"
      }
    );

  let edgeCache = null;

  try {
    edgeCache =
      caches.default;
  } catch {}

  if (edgeCache) {
    const cached =
      await edgeCache.match(
        cacheKey
      );

    if (cached) {
      return clientResponse(
        await cached.json(),
        "HIT"
      );
    }
  }

  /*
    Provider requests are now NFL + MLB + MMA only.
    NCAAF is intentionally not requested because EastCoin Picks is NFL-only.
  */
  const settled =
    await Promise.allSettled(
      SPORTS.map(
        (sport) =>
          fetchSport(
            apiKey,
            sport
          )
      )
    );

  const now = Date.now();
  const games = [];
  const errors = [];

  for (
    let index = 0;
    index < settled.length;
    index += 1
  ) {
    const result =
      settled[index];

    const sport =
      SPORTS[index];

    if (
      result.status ===
      "rejected"
    ) {
      errors.push({
        sportKey: sport.key,
        code:
          String(
            result.reason?.code ||
            "ODDS_API_ERROR"
          ),
        status:
          Number(
            result.reason?.status ||
            0
          ) || null,
        message:
          String(
            result.reason?.message ||
            "Provider request failed."
          )
      });
      continue;
    }

    for (
      const raw of
      result.value.games
    ) {
      const game =
        normalizeGame(
          raw,
          sport,
          now
        );

      if (
        game?.providerEventId
      ) {
        games.push(game);
      }
    }
  }

  games.sort(
    (left, right) =>
      Number(
        left.priority || 0
      ) -
        Number(
          right.priority || 0
        ) ||
      Date.parse(
        left.commenceTime
      ) -
        Date.parse(
          right.commenceTime
        )
  );

  /*
    Because games are sorted by sport priority then start time, the first five
    MMA games are the nearest five upcoming MMA moneyline markets.
  */
  const limitedGames =
    capMmaMarkets(games);

  const cleanGames =
    limitedGames
      .slice(0, MAX_GAMES)
      .map(
        ({
          priority,
          ...game
        }) => game
      );

  const generatedAt =
    new Date().toISOString();

  const payload = {
    ok:
      cleanGames.length > 0 ||
      errors.length <
        SPORTS.length,
    provider:
      "The Odds API",
    source:
      "live_sportsbook_catalog",
    generatedAt,
    upcomingOnly: true,
    horizonDays: 14,
    limits: {
      mmaMarkets:
        MAX_MMA_MARKETS
    },
    sports:
      SPORTS.map(
        (sport) => ({
          key: sport.key,
          title: sport.title,
          family:
            sport.family
        })
      ),
    games: cleanGames,
    errors,
    cache: {
      generatedAt,
      expiresAt:
        new Date(
          Date.now() +
          CACHE_TTL_SECONDS *
            1000
        ).toISOString()
    }
  };

  if (edgeCache) {
    context.waitUntil(
      edgeCache.put(
        cacheKey,
        Response.json(
          payload,
          {
            headers: {
              "Cache-Control":
                `public, max-age=${CACHE_TTL_SECONDS}`
            }
          }
        )
      )
    );
  }

  return clientResponse(
    payload,
    "MISS"
  );
}

const CACHE_TTL_SECONDS = 30 * 60;
const CACHE_VERSION = "v4";
const MAX_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_GAMES = 140;
const MAX_MARKETS_PER_SPORT_PER_DAY = 3;
const MARKET_DAY_TIME_ZONE = "America/Chicago";

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

const dayFormatter =
  new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        MARKET_DAY_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  );

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function marketDay(value) {
  const timestamp =
    Date.parse(
      String(value || "")
    );

  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  return dayFormatter.format(
    new Date(timestamp)
  );
}

function americanToImplied(price) {
  const value = Number(price);

  if (
    !Number.isFinite(value) ||
    value === 0
  ) {
    return null;
  }

  return value > 0
    ? 100 / (value + 100)
    : Math.abs(value) /
      (Math.abs(value) + 100);
}

function probabilityToAmerican(
  probability
) {
  const p = Number(probability);

  if (
    !Number.isFinite(p) ||
    p <= 0 ||
    p >= 1
  ) {
    return null;
  }

  if (
    Math.abs(p - 0.5) <
    0.000001
  ) {
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

  if (!clean.length) {
    return null;
  }

  const middle =
    Math.floor(
      clean.length / 2
    );

  return clean.length % 2
    ? clean[middle]
    : (
        clean[middle - 1] +
        clean[middle]
      ) / 2;
}

function consensus(game) {
  const homeName =
    String(
      game?.home_team || ""
    );

  const awayName =
    String(
      game?.away_team || ""
    );

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
            item?.name ===
            homeName
        );

    const away =
      (market.outcomes || [])
        .find(
          (item) =>
            item?.name ===
            awayName
        );

    if (!home || !away) {
      continue;
    }

    const homeRaw =
      americanToImplied(
        home.price
      );

    const awayRaw =
      americanToImplied(
        away.price
      );

    if (
      homeRaw == null ||
      awayRaw == null
    ) {
      continue;
    }

    const total =
      homeRaw + awayRaw;

    if (total <= 0) {
      continue;
    }

    pairs.push({
      home:
        homeRaw / total,
      away:
        awayRaw / total
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
        probabilityToAmerican(
          home
        ),
      fairProbability:
        home,
      bookCount:
        pairs.length
    },
    away: {
      american:
        probabilityToAmerican(
          away
        ),
      fairProbability:
        away,
      bookCount:
        pairs.length
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

  const response =
    await fetch(
      url.toString(),
      {
        headers: {
          Accept:
            "application/json"
        }
      }
    );

  if (!response.ok) {
    const payload =
      await response
        .json()
        .catch(
          () => null
        );

    const error =
      new Error(
        payload?.message ||
        payload?.error ||
        `The Odds API returned ${response.status}.`
      );

    error.status =
      response.status;

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
        : [],
    quota: {
      remaining:
        Number(
          response.headers.get(
            "x-requests-remaining"
          )
        ),
      used:
        Number(
          response.headers.get(
            "x-requests-used"
          )
        ),
      lastCost:
        Number(
          response.headers.get(
            "x-requests-last"
          )
        )
    }
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
    provider:
      "odds_api",
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
    family:
      sport.family,
    priority:
      sport.priority,
    commenceTime:
      raw?.commence_time ||
      null,
    marketDay:
      marketDay(
        raw?.commence_time
      ),
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
    consensus:
      line
  };
}

function capMarketsPerDay(
  games
) {
  const counts =
    new Map();

  return games.filter(
    (game) => {
      const key =
        `${String(
          game?.sportKey ||
          ""
        )}|${String(
          game?.marketDay ||
          marketDay(
            game?.commenceTime
          )
        )}`;

      const count =
        counts.get(key) || 0;

      if (
        count >=
        MAX_MARKETS_PER_SPORT_PER_DAY
      ) {
        return false;
      }

      counts.set(
        key,
        count + 1
      );

      return true;
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
      status:
        cacheStatus,
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
        .ODDS_API_KEY ||
      ""
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
    One paid sportsbook feed per supported sport, shared across Picks,
    Events cards and Quick Bet verification.
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
  const quota = [];

  for (
    let index = 0;
    index <
      settled.length;
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
        sportKey:
          sport.key,
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

    quota.push({
      sportKey:
        sport.key,
      ...result.value.quota
    });

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
    Because the list is start-time sorted within each sport, each
    Central Time calendar day keeps the nearest three NFL, three MLB
    and three MMA moneyline events.
  */
  const limitedGames =
    capMarketsPerDay(
      games
    );

  const cleanGames =
    limitedGames
      .slice(
        0,
        MAX_GAMES
      )
      .map(
        ({
          priority,
          ...game
        }) => game
      );

  const generatedAt =
    new Date()
      .toISOString();

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
      marketsPerSportPerDay:
        MAX_MARKETS_PER_SPORT_PER_DAY,
      timeZone:
        MARKET_DAY_TIME_ZONE,
      nflPerDay:
        MAX_MARKETS_PER_SPORT_PER_DAY,
      baseballPerDay:
        MAX_MARKETS_PER_SPORT_PER_DAY,
      mmaPerDay:
        MAX_MARKETS_PER_SPORT_PER_DAY
    },
    sports:
      SPORTS.map(
        (sport) => ({
          key:
            sport.key,
          title:
            sport.title,
          family:
            sport.family
        })
      ),
    games:
      cleanGames,
    errors,
    quota,
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

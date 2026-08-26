const SPORT_KEY = "americanfootball_nfl";
const CACHE_TTL_SECONDS = 60;
const CACHE_VERSION = "v1";

function americanToImplied(price) {
  const value = Number(price);

  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  if (value > 0) {
    return 100 / (value + 100);
  }

  const absolute = Math.abs(value);
  return absolute / (absolute + 100);
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

  if (p < 0.5) {
    return Math.round(
      (100 * (1 - p)) / p
    );
  }

  return -Math.round(
    (100 * p) / (1 - p)
  );
}

function americanToDecimal(price) {
  const value = Number(price);

  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  if (value > 0) {
    return 1 + value / 100;
  }

  return 1 + 100 / Math.abs(value);
}

function median(values) {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!clean.length) return null;

  const middle = Math.floor(clean.length / 2);

  if (clean.length % 2) {
    return clean[middle];
  }

  return (
    clean[middle - 1] +
    clean[middle]
  ) / 2;
}

function buildConsensus(game) {
  const homeName = String(game.home_team || "");
  const awayName = String(game.away_team || "");

  const books = [];

  for (const bookmaker of game.bookmakers || []) {
    const market = (bookmaker.markets || [])
      .find((item) => item.key === "h2h");

    if (!market) continue;

    const homeOutcome = (market.outcomes || [])
      .find((item) => item.name === homeName);

    const awayOutcome = (market.outcomes || [])
      .find((item) => item.name === awayName);

    if (
      !homeOutcome ||
      !awayOutcome
    ) {
      continue;
    }

    const homeRawProbability =
      americanToImplied(homeOutcome.price);

    const awayRawProbability =
      americanToImplied(awayOutcome.price);

    if (
      homeRawProbability == null ||
      awayRawProbability == null
    ) {
      continue;
    }

    const overround =
      homeRawProbability +
      awayRawProbability;

    if (overround <= 0) continue;

    const homeFair =
      homeRawProbability / overround;

    const awayFair =
      awayRawProbability / overround;

    books.push({
      key: String(bookmaker.key || ""),
      title: String(
        bookmaker.title ||
        bookmaker.key ||
        "Book"
      ),
      lastUpdate:
        bookmaker.last_update || null,
      home: {
        american: Number(homeOutcome.price),
        fairProbability: homeFair
      },
      away: {
        american: Number(awayOutcome.price),
        fairProbability: awayFair
      }
    });
  }

  if (!books.length) {
    return {
      books: [],
      home: null,
      away: null
    };
  }

  let homeMedian = median(
    books.map(
      (book) => book.home.fairProbability
    )
  );

  let awayMedian = median(
    books.map(
      (book) => book.away.fairProbability
    )
  );

  const totalMedian =
    homeMedian + awayMedian;

  if (totalMedian <= 0) {
    return {
      books,
      home: null,
      away: null
    };
  }

  // Medians are calculated independently. Re-normalize the pair so
  // EastCoin's final consensus probabilities sum to exactly 100%.
  homeMedian /= totalMedian;
  awayMedian /= totalMedian;

  const homeAmerican =
    probabilityToAmerican(homeMedian);

  const awayAmerican =
    probabilityToAmerican(awayMedian);

  return {
    books,
    home: {
      american: homeAmerican,
      decimal: americanToDecimal(homeAmerican),
      fairProbability: homeMedian,
      bookCount: books.length
    },
    away: {
      american: awayAmerican,
      decimal: americanToDecimal(awayAmerican),
      fairProbability: awayMedian,
      bookCount: books.length
    }
  };
}

function latestBookUpdate(books) {
  let latest = null;

  for (const book of books) {
    if (!book.lastUpdate) continue;

    const timestamp = Date.parse(book.lastUpdate);

    if (
      !Number.isFinite(timestamp) ||
      (latest && timestamp <= Date.parse(latest))
    ) {
      continue;
    }

    latest = book.lastUpdate;
  }

  return latest;
}

function toGame(game) {
  const consensus = buildConsensus(game);

  return {
    id: String(game.id || ""),
    sportKey: String(
      game.sport_key || SPORT_KEY
    ),
    sportTitle: String(
      game.sport_title || "NFL"
    ),
    commenceTime:
      game.commence_time || null,
    homeTeam: String(
      game.home_team || "Home"
    ),
    awayTeam: String(
      game.away_team || "Away"
    ),
    consensus: {
      method:
        "median_no_vig_implied_probability",
      home: consensus.home,
      away: consensus.away
    },
    bookmakers: consensus.books,
    sourceLastUpdate:
      latestBookUpdate(consensus.books)
  };
}

function clientResponse(payload, cacheStatus) {
  return Response.json(
    {
      ...payload,
      cache: {
        ...(payload.cache || {}),
        status: cacheStatus,
        ttlSeconds: CACHE_TTL_SECONDS
      }
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

export async function onRequestGet(context) {
  const apiKey = String(
    context.env.ODDS_API_KEY || ""
  ).trim();

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        code: "ODDS_API_KEY_MISSING",
        message:
          "The Odds API test is not configured."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const requestUrl =
    new URL(context.request.url);

  const cacheKey = new Request(
    `${requestUrl.origin}/__eastcoin_internal_cache__/picks-odds/nfl/${CACHE_VERSION}`,
    {
      method: "GET"
    }
  );

  let edgeCache = null;

  try {
    edgeCache = caches.default;
  } catch {
    edgeCache = null;
  }

  if (edgeCache) {
    const cached =
      await edgeCache.match(cacheKey);

    if (cached) {
      const cachedPayload =
        await cached.json();

      return clientResponse(
        cachedPayload,
        "HIT"
      );
    }
  }

  const upstreamUrl = new URL(
    `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/`
  );

  upstreamUrl.searchParams.set(
    "apiKey",
    apiKey
  );

  upstreamUrl.searchParams.set(
    "regions",
    "us"
  );

  upstreamUrl.searchParams.set(
    "markets",
    "h2h"
  );

  upstreamUrl.searchParams.set(
    "oddsFormat",
    "american"
  );

  upstreamUrl.searchParams.set(
    "dateFormat",
    "iso"
  );

  // Sport-specific odds requests support commenceTimeFrom.
  // This keeps the test strictly upcoming-only on the provider side.
  upstreamUrl.searchParams.set(
    "commenceTimeFrom",
    new Date().toISOString()
  );

  let upstream;

  try {
    upstream = await fetch(
      upstreamUrl.toString(),
      {
        headers: {
          Accept: "application/json"
        }
      }
    );
  } catch (error) {
    console.error(
      "The Odds API request failed",
      error
    );

    return Response.json(
      {
        ok: false,
        code: "ODDS_API_UNREACHABLE",
        message:
          "EastCoin could not reach The Odds API."
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  if (!upstream.ok) {
    const providerBody =
      await upstream.text().catch(
        () => ""
      );

    console.error(
      "The Odds API returned an error",
      upstream.status,
      providerBody.slice(0, 300)
    );

    return Response.json(
      {
        ok: false,
        code: "ODDS_API_ERROR",
        providerStatus: upstream.status,
        message:
          "The Odds API rejected the NFL odds request."
      },
      {
        status:
          upstream.status === 429
            ? 429
            : 502,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const rawGames =
    await upstream.json();

  const now = Date.now();

  const games = (
    Array.isArray(rawGames)
      ? rawGames
      : []
  )
    .filter((game) => {
      const start =
        Date.parse(game.commence_time);

      return (
        Number.isFinite(start) &&
        start > now
      );
    })
    .map(toGame)
    .filter(
      (game) =>
        game.consensus.home &&
        game.consensus.away
    )
    .sort(
      (a, b) =>
        Date.parse(a.commenceTime) -
        Date.parse(b.commenceTime)
    );

  const generatedAt =
    new Date().toISOString();

  const payload = {
    ok: true,
    test: true,
    provider: "The Odds API",
    sport: {
      key: SPORT_KEY,
      title: "NFL"
    },
    market: "h2h",
    region: "us",
    oddsFormat: "american",
    upcomingOnly: true,
    consensusMethod:
      "median_no_vig_implied_probability",
    generatedAt,
    games,
    quota: {
      remaining:
        upstream.headers.get(
          "x-requests-remaining"
        ),
      used:
        upstream.headers.get(
          "x-requests-used"
        ),
      lastCost:
        upstream.headers.get(
          "x-requests-last"
        )
    },
    cache: {
      generatedAt,
      expiresAt: new Date(
        Date.now() +
        CACHE_TTL_SECONDS * 1000
      ).toISOString()
    }
  };

  if (edgeCache) {
    const cacheResponse =
      Response.json(
        payload,
        {
          headers: {
            "Cache-Control":
              `public, max-age=${CACHE_TTL_SECONDS}`
          }
        }
      );

    context.waitUntil(
      edgeCache.put(
        cacheKey,
        cacheResponse
      )
    );
  }

  return clientResponse(
    payload,
    "MISS"
  );
}

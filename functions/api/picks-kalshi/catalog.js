import { kalshiFetch, safeAttempts } from "./_kalshi.js";

const CACHE_TTL_SECONDS = 30;
const CACHE_VERSION = "v1";
const TARGET_COUNT = 10;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function dollarPrice(market, side, type = "ask") {
  const key =
    `${side}_${type}_dollars`;

  const value =
    number(market?.[key], NaN);

  if (
    Number.isFinite(value) &&
    value > 0 &&
    value < 1
  ) {
    return value;
  }

  const legacyKey =
    `${side}_${type}`;

  const cents =
    number(market?.[legacyKey], NaN);

  if (
    Number.isFinite(cents) &&
    cents > 0 &&
    cents < 100
  ) {
    return cents / 100;
  }

  return null;
}

function probabilityToAmerican(probability) {
  const p = number(probability, NaN);

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
      100 * (1 - p) / p
    );
  }

  return -Math.round(
    100 * p / (1 - p)
  );
}

function isOpenMarket(market) {
  const status =
    String(
      market?.status || ""
    ).toLowerCase();

  if (
    status &&
    !["active", "open"].includes(status)
  ) {
    return false;
  }

  const close =
    Date.parse(
      market?.close_time ||
      market?.expiration_time ||
      ""
    );

  if (
    Number.isFinite(close) &&
    close <= Date.now()
  ) {
    return false;
  }

  return true;
}

function marketScore(market) {
  const liquidity =
    number(
      market?.liquidity_dollars,
      0
    );

  const volume =
    number(
      market?.volume_fp ??
      market?.volume,
      0
    );

  const volume24h =
    number(
      market?.volume_24h_fp ??
      market?.volume_24h,
      0
    );

  return (
    liquidity * 100 +
    volume +
    volume24h * 4
  );
}

function normalizeMarket(event, market) {
  const yesAsk =
    dollarPrice(
      market,
      "yes",
      "ask"
    );

  const noAsk =
    dollarPrice(
      market,
      "no",
      "ask"
    );

  if (
    yesAsk == null ||
    noAsk == null
  ) {
    return null;
  }

  const yesBid =
    dollarPrice(
      market,
      "yes",
      "bid"
    );

  const noBid =
    dollarPrice(
      market,
      "no",
      "bid"
    );

  return {
    ticker:
      String(market.ticker || ""),
    eventTicker:
      String(
        event.event_ticker ||
        market.event_ticker ||
        ""
      ),
    seriesTicker:
      String(
        event.series_ticker || ""
      ),
    category:
      String(
        event.category ||
        "Other"
      ),
    eventTitle:
      String(
        event.title ||
        "Kalshi Event"
      ),
    eventSubtitle:
      String(
        event.sub_title || ""
      ),
    marketTitle:
      String(
        market.title ||
        market.subtitle ||
        market.yes_sub_title ||
        "Yes / No"
      ),
    subtitle:
      String(
        market.subtitle ||
        market.yes_sub_title ||
        ""
      ),
    yesLabel:
      String(
        market.yes_sub_title ||
        "Yes"
      ),
    noLabel:
      String(
        market.no_sub_title ||
        "No"
      ),
    yes: {
      ask: yesAsk,
      bid: yesBid,
      american:
        probabilityToAmerican(
          yesAsk
        ),
      decimal:
        1 / yesAsk
    },
    no: {
      ask: noAsk,
      bid: noBid,
      american:
        probabilityToAmerican(
          noAsk
        ),
      decimal:
        1 / noAsk
    },
    spreadDollars:
      Math.max(
        0,
        yesAsk + noAsk - 1
      ),
    volume:
      number(
        market.volume_fp ??
        market.volume,
        0
      ),
    volume24h:
      number(
        market.volume_24h_fp ??
        market.volume_24h,
        0
      ),
    liquidityDollars:
      number(
        market.liquidity_dollars,
        0
      ),
    openInterest:
      number(
        market.open_interest_fp ??
        market.open_interest,
        0
      ),
    closeTime:
      market.close_time ||
      market.expiration_time ||
      null,
    updatedTime:
      market.updated_time ||
      null,
    status:
      String(
        market.status ||
        "active"
      ),
    score:
      marketScore(market)
  };
}

function bestMarket(event) {
  const candidates =
    (event.markets || [])
      .filter(isOpenMarket)
      .map(
        (market) =>
          normalizeMarket(
            event,
            market
          )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.score - a.score
      );

  return candidates[0] || null;
}

function eventCandidate(event) {
  const category =
    String(
      event?.category || ""
    ).trim();

  if (
    !category ||
    category.toLowerCase() === "sports"
  ) {
    return null;
  }

  const market =
    bestMarket(event);

  if (!market) return null;

  return {
    ...market,
    category
  };
}

function pickDiversified(candidates) {
  const sorted =
    [...candidates].sort(
      (a, b) =>
        b.score - a.score
    );

  const selected = [];
  const usedTickers =
    new Set();
  const usedCategories =
    new Set();

  // Pass 1: strongest market from as many distinct categories as possible.
  for (const item of sorted) {
    if (
      selected.length >=
      TARGET_COUNT
    ) {
      break;
    }

    const categoryKey =
      item.category.toLowerCase();

    if (
      usedCategories.has(
        categoryKey
      )
    ) {
      continue;
    }

    selected.push(item);
    usedTickers.add(item.ticker);
    usedCategories.add(
      categoryKey
    );
  }

  // Pass 2: fill any remaining slots by liquidity/activity.
  for (const item of sorted) {
    if (
      selected.length >=
      TARGET_COUNT
    ) {
      break;
    }

    if (
      usedTickers.has(
        item.ticker
      )
    ) {
      continue;
    }

    selected.push(item);
    usedTickers.add(item.ticker);
  }

  return selected;
}

async function fetchOpenEvents() {
  const params =
    new URLSearchParams({
      status: "open",
      limit: "200",
      with_nested_markets: "true"
    });

  const result =
    await kalshiFetch(
      `/events?${params.toString()}`
    );

  const payload =
    await result.response.json();

  return {
    events:
      Array.isArray(
        payload?.events
      )
        ? payload.events
        : [],
    providerHost:
      new URL(
        result.base
      ).host,
    fallbackAttempts:
      safeAttempts(
        result.attempts
      )
  };
}

function clientResponse(
  payload,
  cacheStatus
) {
  return Response.json(
    {
      ...payload,
      cache: {
        ...(payload.cache || {}),
        status: cacheStatus,
        ttlSeconds:
          CACHE_TTL_SECONDS
      }
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}

export async function onRequestGet(context) {
  const requestUrl =
    new URL(
      context.request.url
    );

  const cacheKey =
    new Request(
      `${requestUrl.origin}/__eastcoin_internal_cache__/picks-kalshi/catalog/${CACHE_VERSION}`,
      {
        method: "GET"
      }
    );

  let edgeCache = null;

  try {
    edgeCache =
      caches.default;
  } catch {
    edgeCache = null;
  }

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

  try {
    const fetched =
      await fetchOpenEvents();

    const events =
      fetched.events;

    const candidates =
      events
        .map(eventCandidate)
        .filter(Boolean);

    const markets =
      pickDiversified(
        candidates
      );

    const generatedAt =
      new Date().toISOString();

    const payload = {
      ok: true,
      test: true,
      provider: "Kalshi",
      source:
        "public_market_data",
      providerHost:
        fetched.providerHost,
      fallbackAttempts:
        fetched.fallbackAttempts,
      generatedAt,
      selection: {
        requested: TARGET_COUNT,
        returned:
          markets.length,
        rule:
          "non_sports_category_diversity_then_market_activity",
        sourceEventCount:
          events.length,
        eligibleEventCount:
          candidates.length
      },
      markets,
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
  } catch (error) {
    console.error(
      "Kalshi catalog failed",
      error
    );

    return Response.json(
      {
        ok: false,
        test: true,
        code:
          "KALSHI_CATALOG_FAILED",
        message:
          "EastCoin could not load current Kalshi public markets.",
        diagnostic:
          String(
            error?.message ||
            "unknown"
          ),
        attempts:
          safeAttempts(
            error?.attempts
          )
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options":
            "nosniff"
        }
      }
    );
  }
}

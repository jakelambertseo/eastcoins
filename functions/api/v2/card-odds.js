const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

const SPORTS_CACHE_VERSION = "v1";
const EVENT_CACHE_VERSION = "v1";
const ODDS_CACHE_VERSION = "v1";

const SPORTS_CACHE_SECONDS = 6 * 60 * 60;
const EVENT_CACHE_SECONDS = 30 * 60;

// Fixed cache. No low-quota adaptive guardrails.
// With the upgraded account, EastCoin can prioritize freshness while the shared
// edge cache still prevents one provider request per browser/user.
const ODDS_CACHE_SECONDS = 15 * 60;

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
    .filter(
      (token) =>
        token.length > 1 &&
        !STOP_WORDS.has(token)
    );
}

function nameScore(candidate, target) {
  const left = normalize(candidate);
  const right = normalize(target);

  if (!left || !right) return 0;
  if (left === right) return 1;

  if (
    left.includes(right) ||
    right.includes(left)
  ) {
    return 0.96;
  }

  const targetTokens = tokens(target);

  if (!targetTokens.length) {
    return 0;
  }

  const candidateTokens =
    new Set(tokens(candidate));

  const hits =
    targetTokens.filter(
      (token) =>
        candidateTokens.has(token)
    ).length;

  return hits / targetTokens.length;
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

  if (!clean.length) {
    return null;
  }

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
          (outcome) =>
            outcome?.name === homeName
        );

    const away =
      (market.outcomes || [])
        .find(
          (outcome) =>
            outcome?.name === awayName
        );

    if (!home || !away) {
      continue;
    }

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

    if (total <= 0) {
      continue;
    }

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

function allowedSportObject(sport) {
  const key =
    String(sport?.key || "")
      .toLowerCase();

  if (
    !key ||
    sport?.has_outrights
  ) {
    return false;
  }

  return (
    key.startsWith(
      "americanfootball_"
    ) ||
    key.startsWith("baseball_") ||
    key ===
      "mma_mixed_martial_arts"
  );
}

function familyFromSportKey(value) {
  const key =
    String(value || "")
      .toLowerCase();

  if (
    key.startsWith(
      "americanfootball_"
    )
  ) {
    return "american-football";
  }

  if (
    key.startsWith("baseball_")
  ) {
    return "baseball";
  }

  if (
    key ===
    "mma_mixed_martial_arts"
  ) {
    return "combat";
  }

  return "other";
}

function familyAllowedForEvent(
  event,
  sportKey
) {
  return (
    String(event?.sport || "")
      .toLowerCase() ===
    familyFromSportKey(sportKey)
  );
}

function eventMatchScore(
  event,
  game
) {
  const normalAway =
    nameScore(
      game?.away_team,
      event.away
    );

  const normalHome =
    nameScore(
      game?.home_team,
      event.home
    );

  const swapAway =
    nameScore(
      game?.home_team,
      event.away
    );

  const swapHome =
    nameScore(
      game?.away_team,
      event.home
    );

  let orientation = "normal";

  let teamScore =
    normalAway * 0.44 +
    normalHome * 0.44;

  if (
    swapAway + swapHome >
    normalAway + normalHome
  ) {
    orientation = "swapped";

    teamScore =
      swapAway * 0.44 +
      swapHome * 0.44;
  }

  const eventStart =
    Number(event?.startsAt || 0);

  const providerStart =
    Date.parse(
      game?.commence_time || ""
    );

  let timeScore = 0.5;

  if (
    eventStart &&
    Number.isFinite(providerStart)
  ) {
    const hours =
      Math.abs(
        eventStart - providerStart
      ) / 3600000;

    if (hours <= 1.5) {
      timeScore = 1;
    } else if (hours <= 4) {
      timeScore = 0.8;
    } else if (hours <= 10) {
      timeScore = 0.45;
    } else if (hours <= 18) {
      timeScore = 0.15;
    } else {
      timeScore = 0;
    }
  }

  return {
    score:
      teamScore +
      timeScore * 0.12,
    orientation
  };
}

function bestProviderMatch(
  event,
  games
) {
  let bestGame = null;
  let best = null;

  for (const game of games || []) {
    const result =
      eventMatchScore(
        event,
        game
      );

    if (
      !best ||
      result.score > best.score
    ) {
      best = result;
      bestGame = game;
    }
  }

  if (
    !bestGame ||
    !best ||
    best.score < 0.79
  ) {
    return null;
  }

  return {
    game: bestGame,
    score: best.score,
    orientation:
      best.orientation
  };
}

function providerEventPayload(
  game,
  orientation,
  line = null,
  verificationSource = "events"
) {
  const swapped =
    orientation === "swapped";

  const payload = {
    providerEventId:
      String(game?.id || ""),
    provider: "odds_api",
    sportKey:
      String(
        game?.sport_key || ""
      ),
    sportTitle:
      String(
        game?.sport_title || ""
      ),
    commenceTime:
      game?.commence_time || null,
    providerAway:
      String(
        swapped
          ? game?.home_team || ""
          : game?.away_team || ""
      ),
    providerHome:
      String(
        swapped
          ? game?.away_team || ""
          : game?.home_team || ""
      ),
    verificationSource
  };

  if (
    line?.away &&
    line?.home
  ) {
    payload.away =
      swapped
        ? line.home
        : line.away;

    payload.home =
      swapped
        ? line.away
        : line.home;
  }

  return payload;
}

function cacheHandle() {
  try {
    return caches.default;
  } catch {
    return null;
  }
}

async function cachedJson(
  context,
  cachePath,
  ttlSeconds,
  loader
) {
  const origin =
    new URL(
      context.request.url
    ).origin;

  const cacheKey =
    new Request(
      `${origin}${cachePath}`,
      { method: "GET" }
    );

  const edgeCache =
    cacheHandle();

  if (edgeCache) {
    const cached =
      await edgeCache.match(
        cacheKey
      );

    if (cached) {
      return {
        value:
          await cached.json(),
        cacheStatus: "HIT"
      };
    }
  }

  const value = await loader();

  if (edgeCache) {
    context.waitUntil(
      edgeCache.put(
        cacheKey,
        Response.json(
          value,
          {
            headers: {
              "Cache-Control":
                `public, max-age=${ttlSeconds}`
            }
          }
        )
      )
    );
  }

  return {
    value,
    cacheStatus: "MISS"
  };
}

function apiKey(context) {
  const value =
    String(
      context.env
        .ODDS_API_KEY || ""
    ).trim();

  if (!value) {
    throw new Error(
      "ODDS_API_KEY_MISSING"
    );
  }

  return value;
}

async function getAllowedSports(
  context
) {
  return cachedJson(
    context,
    `/__eastcoin_internal_cache__/v2/allowed-sports/${SPORTS_CACHE_VERSION}`,
    SPORTS_CACHE_SECONDS,
    async () => {
      const url =
        new URL(
          `${ODDS_API_BASE}/sports`
        );

      url.searchParams.set(
        "apiKey",
        apiKey(context)
      );

      url.searchParams.set(
        "all",
        "false"
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
        const error =
          new Error(
            `ODDS_API_SPORTS_${response.status}`
          );

        error.status =
          response.status;

        throw error;
      }

      const raw =
        await response.json();

      return (
        Array.isArray(raw)
          ? raw
          : []
      )
        .filter(
          allowedSportObject
        )
        .map((sport) => ({
          key:
            String(
              sport.key || ""
            ),
          title:
            String(
              sport.title || ""
            ),
          group:
            String(
              sport.group || ""
            )
        }));
    }
  );
}

async function getSportEvents(
  context,
  sport
) {
  return cachedJson(
    context,
    `/__eastcoin_internal_cache__/v2/sport-events/${EVENT_CACHE_VERSION}/${sport.key}`,
    EVENT_CACHE_SECONDS,
    async () => {
      const url =
        new URL(
          `${ODDS_API_BASE}/sports/${sport.key}/events`
        );

      url.searchParams.set(
        "apiKey",
        apiKey(context)
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
        const error =
          new Error(
            `ODDS_API_EVENTS_${sport.key}_${response.status}`
          );

        error.status =
          response.status;

        throw error;
      }

      const raw =
        await response.json();

      return (
        Array.isArray(raw)
          ? raw
          : []
      );
    }
  );
}

async function getSportOdds(
  context,
  sportKey
) {
  return cachedJson(
    context,
    `/__eastcoin_internal_cache__/v2/sport-odds/${ODDS_CACHE_VERSION}/${sportKey}`,
    ODDS_CACHE_SECONDS,
    async () => {
      const url =
        new URL(
          `${ODDS_API_BASE}/sports/${sportKey}/odds`
        );

      url.searchParams.set(
        "apiKey",
        apiKey(context)
      );

      url.searchParams.set(
        "regions",
        "us"
      );

      // Moneyline only.
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
        const error =
          new Error(
            `ODDS_API_ODDS_${sportKey}_${response.status}`
          );

        error.status =
          response.status;

        throw error;
      }

      const raw =
        await response.json();

      return {
        games:
          Array.isArray(raw)
            ? raw
            : [],
        generatedAt:
          new Date()
            .toISOString(),
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
  );
}

function candidateFamilies(events) {
  return new Set(
    events
      .map(
        (event) =>
          String(
            event?.sport || ""
          ).toLowerCase()
      )
      .filter(
        (family) =>
          [
            "american-football",
            "baseball",
            "combat"
          ].includes(family)
      )
  );
}

export async function onRequestPost(
  context
) {
  try {
    const body =
      await context.request
        .json();

    const events =
      (
        Array.isArray(body?.events)
          ? body.events
          : []
      )
        .slice(0, 120)
        .filter(
          (event) =>
            event &&
            String(
              event.id || ""
            ) &&
            String(
              event.away || ""
            ).trim() &&
            String(
              event.home || ""
            ).trim() &&
            [
              "american-football",
              "baseball",
              "combat"
            ].includes(
              String(
                event.sport || ""
              ).toLowerCase()
            )
        );

    if (!events.length) {
      return reply({
        ok: true,
        odds: {},
        matched: 0,
        priced: 0,
        verifiedOnly: 0
      });
    }

    const families =
      candidateFamilies(events);

    const sportsResult =
      await getAllowedSports(
        context
      );

    const sports =
      (
        sportsResult.value || []
      )
        .filter(
          (sport) =>
            families.has(
              familyFromSportKey(
                sport.key
              )
            )
        );

    const eventCatalogResults =
      await Promise.allSettled(
        sports.map(
          async (sport) => {
            const result =
              await getSportEvents(
                context,
                sport
              );

            return {
              sport,
              games:
                result.value || [],
              cacheStatus:
                result.cacheStatus
            };
          }
        )
      );

    const catalogs =
      eventCatalogResults
        .filter(
          (result) =>
            result.status ===
            "fulfilled"
        )
        .map(
          (result) =>
            result.value
        );

    const matches = new Map();
    const neededSportKeys =
      new Set();

    for (const event of events) {
      let best = null;

      for (const catalog of catalogs) {
        if (
          !familyAllowedForEvent(
            event,
            catalog.sport.key
          )
        ) {
          continue;
        }

        const found =
          bestProviderMatch(
            event,
            catalog.games
          );

        if (
          found &&
          (
            !best ||
            found.score >
              best.match.score
          )
        ) {
          best = {
            sport:
              catalog.sport,
            match: found
          };
        }
      }

      if (!best) {
        continue;
      }

      matches.set(
        String(event.id),
        best
      );

      neededSportKeys.add(
        best.sport.key
      );
    }

    const oddsResults =
      await Promise.allSettled(
        [...neededSportKeys]
          .map(
            async (sportKey) => {
              const result =
                await getSportOdds(
                  context,
                  sportKey
                );

              return {
                sportKey,
                payload:
                  result.value,
                cacheStatus:
                  result.cacheStatus
              };
            }
          )
      );

    const oddsBySport =
      new Map();

    for (
      const result of
      oddsResults
    ) {
      if (
        result.status !==
        "fulfilled"
      ) {
        continue;
      }

      oddsBySport.set(
        result.value.sportKey,
        result.value
      );
    }

    const odds = {};
    let matched = 0;
    let priced = 0;
    let verifiedOnly = 0;

    for (const event of events) {
      const exact =
        matches.get(
          String(event.id)
        );

      if (!exact) continue;

      const sportKey =
        exact.sport.key;

      const providerEvent =
        exact.match.game;

      const sportOdds =
        oddsBySport.get(
          sportKey
        );

      const pricedGame =
        (
          sportOdds?.payload
            ?.games || []
        ).find(
          (game) =>
            String(game?.id || "") ===
            String(
              providerEvent?.id || ""
            )
        );

      const line =
        pricedGame
          ? consensus(
              pricedGame
            )
          : null;

      const hasMoneyline =
        Boolean(
          line?.away?.american &&
          line?.home?.american
        );

      odds[
        String(event.id)
      ] = providerEventPayload(
        pricedGame ||
          providerEvent,
        exact.match.orientation,
        hasMoneyline
          ? line
          : null,
        hasMoneyline
          ? "sport_h2h_odds"
          : "sport_events_catalog"
      );

      matched += 1;

      if (hasMoneyline) {
        priced += 1;
      } else {
        verifiedOnly += 1;
      }
    }

    const sportDiagnostics =
      [...neededSportKeys]
        .map((sportKey) => {
          const result =
            oddsBySport.get(
              sportKey
            );

          return {
            sportKey,
            cacheStatus:
              result
                ?.cacheStatus ||
              "ERROR",
            gameCount:
              result
                ?.payload
                ?.games
                ?.length || 0,
            generatedAt:
              result
                ?.payload
                ?.generatedAt ||
              null,
            quota:
              result
                ?.payload
                ?.quota ||
              null
          };
        });

    return reply({
      ok: true,
      odds,
      matched,
      priced,
      verifiedOnly,
      provider:
        "The Odds API",
      market: "h2h",
      allowedBetting: {
        football: true,
        baseball: true,
        mma: true,
        otherSports: false
      },
      consensusMethod:
        "median_no_vig_implied_probability",
      cache: {
        sportsCatalog:
          sportsResult.cacheStatus,
        eventsTtlSeconds:
          EVENT_CACHE_SECONDS,
        oddsTtlSeconds:
          ODDS_CACHE_SECONDS
      },
      sports:
        sportDiagnostics
    });
  } catch (error) {
    console.error(
      "V2 card odds failed",
      error
    );

    return reply({
      ok: false,
      code:
        error?.message ===
        "ODDS_API_KEY_MISSING"
          ? "ODDS_API_KEY_MISSING"
          : "ODDS_API_ERROR",
      providerStatus:
        error?.status || null,
      message:
        error?.message ===
        "ODDS_API_KEY_MISSING"
          ? "The Odds API is not configured."
          : "EastCoin could not load current moneyline data."
    }, 502);
  }
}

export function onRequestGet() {
  return reply({
    ok: true,
    service:
      "eastcoin-v2-card-odds",
    provider:
      "The Odds API",
    market: "h2h",
    oddsFormat: "american",
    regions: ["us"],
    allowedSportFamilies: [
      "american-football",
      "baseball",
      "mma"
    ],
    sportsDiscovery:
      "quota-free /v4/sports",
    eventVerification:
      "quota-free sport-specific /events",
    pricing:
      "full sport-specific /odds",
    cache: {
      sportsCatalogSeconds:
        SPORTS_CACHE_SECONDS,
      eventCatalogSeconds:
        EVENT_CACHE_SECONDS,
      oddsSeconds:
        ODDS_CACHE_SECONDS,
      adaptiveQuotaGuardrails:
        false
    }
  });
}

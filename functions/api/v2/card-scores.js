const ODDS_API_BASE =
  "https://api.the-odds-api.com/v4";

const DEFAULT_TTL_SECONDS =
  5 * 60;

function json(data, status = 200) {
  return Response.json(
    data,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}

function text(value, max = 200) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function validSportKey(value) {
  return /^[a-z0-9_]+$/i.test(
    String(value || "")
  );
}

function scoreSupportedKey(value) {
  const key =
    String(value || "")
      .toLowerCase();

  if (!key) return false;

  if (
    key.includes("_winner") ||
    key.includes("_championship")
  ) {
    return false;
  }

  if (
    key.startsWith("mma_") ||
    key.startsWith("boxing_")
  ) {
    return false;
  }

  return true;
}

function cacheTtl() {
  // Iteration 30: predictable score freshness.
  // The previous low-credit adaptive cache stretching is retired.
  return DEFAULT_TTL_SECONDS;
}

async function providerScores(
  context,
  sportKey
) {
  const apiKey =
    String(
      context.env.ODDS_API_KEY ||
      ""
    ).trim();

  if (!apiKey) {
    const error =
      new Error(
        "The Odds API is not configured."
      );

    error.code =
      "ODDS_API_KEY_MISSING";

    throw error;
  }

  const origin =
    new URL(
      context.request.url
    ).origin;

  const cacheKey =
    new Request(
      `${origin}/__eastcoin_internal_cache__/v2/card-scores/${encodeURIComponent(sportKey)}`,
      {
        method: "GET"
      }
    );

  let cache = null;

  try {
    cache = caches.default;
  } catch {}

  if (cache) {
    const cached =
      await cache.match(
        cacheKey
      );

    if (cached) {
      return {
        payload:
          await cached.json(),
        cacheStatus: "HIT"
      };
    }
  }

  const url =
    new URL(
      `${ODDS_API_BASE}/sports/${encodeURIComponent(sportKey)}/scores/`
    );

  url.searchParams.set(
    "apiKey",
    apiKey
  );

  url.searchParams.set(
    "dateFormat",
    "iso"
  );

  // No historical-completion parameter is requested. This intentionally uses
  // the lower-cost live/upcoming score path.
  const upstream =
    await fetch(
      url.toString(),
      {
        headers: {
          "Accept":
            "application/json"
        }
      }
    );

  if (!upstream.ok) {
    const error =
      new Error(
        `ODDS_SCORES_${upstream.status}`
      );

    error.status =
      upstream.status;

    throw error;
  }

  const games =
    await upstream.json();

  const quota = {
    remaining:
      Number(
        upstream.headers.get(
          "x-requests-remaining"
        )
      ),
    used:
      Number(
        upstream.headers.get(
          "x-requests-used"
        )
      ),
    lastCost:
      Number(
        upstream.headers.get(
          "x-requests-last"
        )
      )
  };

  const ttl =
    cacheTtl(quota);

  const payload = {
    games:
      Array.isArray(games)
        ? games
        : [],
    generatedAt:
      new Date().toISOString(),
    quota,
    ttl
  };

  if (cache) {
    const stored =
      Response.json(
        payload,
        {
          headers: {
            "Cache-Control":
              `public, max-age=${ttl}`
          }
        }
      );

    context.waitUntil(
      cache.put(
        cacheKey,
        stored
      )
    );
  }

  return {
    payload,
    cacheStatus: "MISS"
  };
}

function scoreForName(
  game,
  teamName
) {
  const target =
    String(teamName || "")
      .trim()
      .toLowerCase();

  if (!target) return null;

  const row =
    (game?.scores || [])
      .find(
        (item) =>
          String(
            item?.name || ""
          )
            .trim()
            .toLowerCase() ===
          target
      );

  const value =
    Number(row?.score);

  return Number.isFinite(value)
    ? value
    : null;
}

export async function onRequestPost(
  context
) {
  let body;

  try {
    body =
      await context.request.json();
  } catch {
    return json(
      {
        ok: false,
        scores: {},
        code: "INVALID_JSON",
        message:
          "A valid score request is required."
      },
      400
    );
  }

  const events =
    (
      Array.isArray(body?.events)
        ? body.events
        : []
    )
      .slice(0, 100)
      .map(
        (event) => ({
          id:
            text(event?.id, 240),
          providerEventId:
            text(
              event?.providerEventId,
              240
            ),
          sportKey:
            text(
              event?.sportKey,
              120
            ),
          providerAway:
            text(
              event?.providerAway,
              180
            ),
          providerHome:
            text(
              event?.providerHome,
              180
            )
        })
      )
      .filter(
        (event) =>
          event.id &&
          event.providerEventId &&
          validSportKey(
            event.sportKey
          ) &&
          scoreSupportedKey(
            event.sportKey
          )
      );

  if (!events.length) {
    return json({
      ok: true,
      scores: {},
      queriedSports: 0,
      provider: "The Odds API"
    });
  }

  const bySport =
    new Map();

  for (const event of events) {
    if (
      !bySport.has(
        event.sportKey
      )
    ) {
      bySport.set(
        event.sportKey,
        []
      );
    }

    bySport
      .get(event.sportKey)
      .push(event);
  }

  const scores = {};
  const providerMeta = [];

  for (
    const [
      sportKey,
      requested
    ]
    of bySport.entries()
  ) {
    try {
      const result =
        await providerScores(
          context,
          sportKey
        );

      const games =
        result.payload.games ||
        [];

      const byProviderId =
        new Map(
          games.map(
            (game) => [
              String(
                game?.id || ""
              ),
              game
            ]
          )
        );

      for (const event of requested) {
        const game =
          byProviderId.get(
            event.providerEventId
          );

        if (
          !game ||
          !Array.isArray(
            game.scores
          )
        ) {
          continue;
        }

        const awayScore =
          scoreForName(
            game,
            event.providerAway
          );

        const homeScore =
          scoreForName(
            game,
            event.providerHome
          );

        if (
          awayScore == null ||
          homeScore == null
        ) {
          continue;
        }

        scores[event.id] = {
          providerEventId:
            event.providerEventId,
          sportKey,
          awayScore,
          homeScore,
          completed:
            Boolean(
              game.completed
            ),
          lastUpdate:
            game.last_update ||
            null,
          source:
            "odds_api_scores"
        };
      }

      providerMeta.push({
        sportKey,
        cache:
          result.cacheStatus,
        generatedAt:
          result.payload.generatedAt,
        ttlSeconds:
          result.payload.ttl,
        quota:
          result.payload.quota
      });
    } catch (error) {
      console.warn(
        "V2 card score sport failed",
        sportKey,
        error
      );

      providerMeta.push({
        sportKey,
        error:
          String(
            error?.code ||
            error?.message ||
            "SCORE_FETCH_FAILED"
          )
      });
    }
  }

  return json({
    ok: true,
    scores,
    matched:
      Object.keys(scores).length,
    queriedSports:
      bySport.size,
    provider:
      "The Odds API",
    providerMeta
  });
}

export function onRequestGet() {
  return json({
    ok: true,
    endpoint:
      "EastCoin V2 card scores",
    method: "POST",
    provider:
      "The Odds API",
    note:
      "Uses exact Odds API event IDs and the live/upcoming scores path."
  });
}

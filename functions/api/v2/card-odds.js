const STOP_WORDS =
  new Set([
    "fc",
    "cf",
    "sc",
    "afc",
    "club",
    "team",
    "women",
    "womens",
    "men",
    "mens",
    "the",
    "university",
    "college"
  ]);

function reply(
  data,
  status = 200
) {
  return Response.json(
    data,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}

function normalize(value) {
  return String(
    value || ""
  )
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter(
      (token) =>
        token.length > 1 &&
        !STOP_WORDS.has(
          token
        )
    );
}

function nameScore(
  candidate,
  target
) {
  const left =
    normalize(candidate);

  const right =
    normalize(target);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (
    left.includes(right) ||
    right.includes(left)
  ) {
    return 0.96;
  }

  const targetTokens =
    tokens(target);

  if (
    !targetTokens.length
  ) {
    return 0;
  }

  const candidateTokens =
    new Set(
      tokens(candidate)
    );

  const hits =
    targetTokens.filter(
      (token) =>
        candidateTokens.has(
          token
        )
    ).length;

  return (
    hits /
    targetTokens.length
  );
}

function eventMatchScore(
  event,
  game
) {
  const normalAway =
    nameScore(
      game?.awayTeam,
      event.away
    );

  const normalHome =
    nameScore(
      game?.homeTeam,
      event.home
    );

  const swapAway =
    nameScore(
      game?.homeTeam,
      event.away
    );

  const swapHome =
    nameScore(
      game?.awayTeam,
      event.home
    );

  let orientation =
    "normal";

  let teamScore =
    normalAway * 0.44 +
    normalHome * 0.44;

  if (
    swapAway + swapHome >
    normalAway + normalHome
  ) {
    orientation =
      "swapped";

    teamScore =
      swapAway * 0.44 +
      swapHome * 0.44;
  }

  const eventStart =
    Number(
      event?.startsAt || 0
    );

  const providerStart =
    Date.parse(
      game?.commenceTime ||
      ""
    );

  let timeScore = 0.5;

  if (
    eventStart &&
    Number.isFinite(
      providerStart
    )
  ) {
    const hours =
      Math.abs(
        eventStart -
        providerStart
      ) / 3600000;

    if (hours <= 1.5) {
      timeScore = 1;
    } else if (
      hours <= 4
    ) {
      timeScore = 0.8;
    } else if (
      hours <= 10
    ) {
      timeScore = 0.45;
    } else if (
      hours <= 18
    ) {
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

function bestCatalogMatch(
  event,
  games
) {
  let bestGame = null;
  let best = null;

  for (
    const game of
    games || []
  ) {
    if (
      String(
        game?.family ||
        ""
      ).toLowerCase() !==
      String(
        event?.sport ||
        ""
      ).toLowerCase()
    ) {
      continue;
    }

    const result =
      eventMatchScore(
        event,
        game
      );

    if (
      !best ||
      result.score >
        best.score
    ) {
      best =
        result;
      bestGame =
        game;
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
    game:
      bestGame,
    score:
      best.score,
    orientation:
      best.orientation
  };
}

function payloadForMatch(
  found
) {
  const game =
    found.game;

  const swapped =
    found.orientation ===
    "swapped";

  const awayLine =
    swapped
      ? game?.consensus
          ?.home
      : game?.consensus
          ?.away;

  const homeLine =
    swapped
      ? game?.consensus
          ?.away
      : game?.consensus
          ?.home;

  return {
    providerEventId:
      String(
        game?.providerEventId ||
        ""
      ),
    provider:
      "odds_api",
    sportKey:
      String(
        game?.sportKey ||
        ""
      ),
    sportTitle:
      String(
        game?.sportTitle ||
        ""
      ),
    commenceTime:
      game?.commenceTime ||
      null,
    marketDay:
      game?.marketDay ||
      null,
    providerAway:
      String(
        swapped
          ? game?.homeTeam ||
              ""
          : game?.awayTeam ||
              ""
      ),
    providerHome:
      String(
        swapped
          ? game?.awayTeam ||
              ""
          : game?.homeTeam ||
              ""
      ),
    away:
      awayLine || null,
    home:
      homeLine || null,
    verificationSource:
      "shared_picks_catalog"
  };
}

async function getSharedCatalog(
  context
) {
  const url =
    new URL(
      "/api/picks/catalog",
      context.request.url
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

  const payload =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !payload?.ok ||
    !Array.isArray(
      payload.games
    )
  ) {
    const error =
      new Error(
        payload?.message ||
        "The shared EastCoin sportsbook catalog is unavailable."
      );

    error.status =
      response.status;

    throw error;
  }

  return payload;
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
        Array.isArray(
          body?.events
        )
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
                event.sport ||
                ""
              ).toLowerCase()
            )
        );

    if (!events.length) {
      return reply({
        ok: true,
        odds: {},
        matched: 0,
        priced: 0,
        verifiedOnly: 0,
        source:
          "shared_picks_catalog"
      });
    }

    const catalog =
      await getSharedCatalog(
        context
      );

    const odds = {};
    let matched = 0;
    let priced = 0;

    for (
      const event of events
    ) {
      const found =
        bestCatalogMatch(
          event,
          catalog.games
        );

      if (!found) {
        continue;
      }

      const value =
        payloadForMatch(
          found
        );

      const hasMoneyline =
        Number.isFinite(
          Number(
            value?.away
              ?.american
          )
        ) &&
        Number.isFinite(
          Number(
            value?.home
              ?.american
          )
        );

      if (!hasMoneyline) {
        continue;
      }

      odds[
        String(
          event.id
        )
      ] = value;

      matched += 1;
      priced += 1;
    }

    return reply({
      ok: true,
      odds,
      matched,
      priced,
      verifiedOnly: 0,
      provider:
        "The Odds API",
      market: "h2h",
      source:
        "shared_picks_catalog",
      allowedBetting: {
        football: true,
        baseball: true,
        mma: true,
        otherSports: false
      },
      limits:
        catalog.limits ||
        null,
      cache:
        catalog.cache ||
        null
    });
  } catch (error) {
    console.error(
      "V2 card odds failed",
      error
    );

    return reply(
      {
        ok: false,
        code:
          "ODDS_API_ERROR",
        providerStatus:
          error?.status ||
          null,
        message:
          error?.message ||
          "EastCoin could not load current moneyline data."
      },
      502
    );
  }
}

export function onRequestGet() {
  return reply({
    ok: true,
    service:
      "eastcoin-v2-card-odds",
    provider:
      "The Odds API",
    market:
      "h2h",
    source:
      "shared_picks_catalog",
    allowedSportFamilies: [
      "american-football",
      "baseball",
      "mma"
    ],
    pricing:
      "shared /api/picks/catalog",
    duplicatePaidOddsFeed:
      false
  });
}

const NFL_TEAMS = new Set([
  "arizona cardinals",
  "atlanta falcons",
  "baltimore ravens",
  "buffalo bills",
  "carolina panthers",
  "chicago bears",
  "cincinnati bengals",
  "cleveland browns",
  "dallas cowboys",
  "denver broncos",
  "detroit lions",
  "green bay packers",
  "houston texans",
  "indianapolis colts",
  "jacksonville jaguars",
  "kansas city chiefs",
  "las vegas raiders",
  "los angeles chargers",
  "los angeles rams",
  "miami dolphins",
  "minnesota vikings",
  "new england patriots",
  "new orleans saints",
  "new york giants",
  "new york jets",
  "philadelphia eagles",
  "pittsburgh steelers",
  "san francisco 49ers",
  "seattle seahawks",
  "tampa bay buccaneers",
  "tennessee titans",
  "washington commanders"
]);

const MAX_MARKETS_PER_SPORT_PER_DAY = 3;
const MARKET_DAY_TIME_ZONE = "America/Chicago";

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

function normalizeTeam(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNflTeams(
  away,
  home
) {
  return (
    NFL_TEAMS.has(
      normalizeTeam(away)
    ) &&
    NFL_TEAMS.has(
      normalizeTeam(home)
    )
  );
}

function marketDay(value) {
  const timestamp =
    Date.parse(
      String(value || "")
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return "unknown";
  }

  return dayFormatter.format(
    new Date(timestamp)
  );
}

function capMarketsPerDay(
  games
) {
  const counts =
    new Map();

  return (
    Array.isArray(games)
      ? games
      : []
  )
    .slice()
    .sort(
      (left, right) =>
        Date.parse(
          left?.commenceTime ||
          ""
        ) -
        Date.parse(
          right?.commenceTime ||
          ""
        )
    )
    .filter(
      (game) => {
        const key =
          `${String(
            game?.sportKey ||
            ""
          )}|${marketDay(
            game?.commenceTime
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

function json(
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

export async function onRequest(
  context
) {
  const url =
    new URL(
      context.request.url
    );

  const path =
    url.pathname.replace(
      /\/+$/,
      ""
    );

  /*
    College football stays watchable but can never create a Picks market.
  */
  if (
    path.endsWith(
      "/api/picks/markets/ensure"
    ) &&
    context.request.method ===
      "POST"
  ) {
    const body =
      await context.request
        .clone()
        .json()
        .catch(
          () => null
        );

    const sport =
      String(
        body?.sport ||
        ""
      ).toLowerCase();

    if (
      sport ===
        "american-football" &&
      !isNflTeams(
        body?.away,
        body?.home
      )
    ) {
      return json(
        {
          ok: false,
          code:
            "NFL_ONLY",
          message:
            "EastCoin Picks currently supports NFL football only."
        },
        422
      );
    }
  }

  const response =
    await context.next();

  if (
    !path.endsWith(
      "/api/picks/catalog"
    ) ||
    !response.ok
  ) {
    return response;
  }

  const type =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    !type.includes(
      "application/json"
    )
  ) {
    return response;
  }

  const payload =
    await response
      .clone()
      .json()
      .catch(
        () => null
      );

  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    return response;
  }

  if (
    Array.isArray(
      payload.games
    )
  ) {
    const nflFiltered =
      payload.games.filter(
        (game) => {
          const key =
            String(
              game?.sportKey ||
              ""
            ).toLowerCase();

          return (
            !key.startsWith(
              "americanfootball_"
            ) ||
            key ===
              "americanfootball_nfl"
          );
        }
      );

    payload.games =
      capMarketsPerDay(
        nflFiltered
      );
  }

  if (
    Array.isArray(
      payload.sports
    )
  ) {
    payload.sports =
      payload.sports.filter(
        (sport) => {
          const key =
            String(
              sport?.key ||
              ""
            ).toLowerCase();

          return (
            !key.startsWith(
              "americanfootball_"
            ) ||
            key ===
              "americanfootball_nfl"
          );
        }
      );
  }

  if (
    Array.isArray(
      payload.errors
    )
  ) {
    payload.errors =
      payload.errors.filter(
        (error) =>
          String(
            error?.sportKey ||
            ""
          ).toLowerCase() !==
          "americanfootball_ncaaf"
      );
  }

  payload.limits = {
    ...(payload.limits || {}),
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
  };

  const headers =
    new Headers(
      response.headers
    );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  return Response.json(
    payload,
    {
      status:
        response.status,
      headers
    }
  );
}

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

function normalizeTeam(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNflTeams(away, home) {
  return (
    NFL_TEAMS.has(
      normalizeTeam(away)
    ) &&
    NFL_TEAMS.has(
      normalizeTeam(home)
    )
  );
}

function json(data, status = 200) {
  return Response.json(
    data,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
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
    Hard guard at market creation. College football remains an Events
    category, but EastCoin Picks currently accepts NFL football only.
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
        body?.sport || ""
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
          code: "NFL_ONLY",
          message:
            "EastCoin Picks currently supports NFL football only."
        },
        422
      );
    }
  }

  const response =
    await context.next();

  /*
    Filter the live sportsbook catalog itself. This removes NCAAF before
    Picks, Quick Bet or any future client can treat those games as eligible.
  */
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
    payload.games =
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
              sport?.key || ""
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
            error?.sportKey || ""
          ).toLowerCase() !==
          "americanfootball_ncaaf"
      );
  }

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

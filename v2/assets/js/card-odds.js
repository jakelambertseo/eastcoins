(() => {
  "use strict";

  const V2 =
    window.ECV2;
  const S =
    V2.state;

  const oddsByEvent =
    new Map();

  let requestToken = 0;
  let refreshTimer = 0;
  let lastRefreshAt = 0;
  let lastCandidateSignature = "";

  const MAX_EVENTS_PER_SPORT_PER_DAY = 3;
  const MARKET_DAY_TIME_ZONE = "America/Chicago";
  const REFRESH_INTERVAL_MS =
    30 * 60 * 1000;

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

  const NFL_TEAMS =
    new Set([
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

  function normalizeTeam(
    value
  ) {
    return String(
      value || ""
    )
      .toLowerCase()
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

  function isNflMatch(
    match
  ) {
    return (
      NFL_TEAMS.has(
        normalizeTeam(
          match?.teams
            ?.away?.name
        )
      ) &&
      NFL_TEAMS.has(
        normalizeTeam(
          match?.teams
            ?.home?.name
        )
      )
    );
  }

  function eventStart(
    match
  ) {
    return (
      V2.ts(
        match?.date
      ) ||
      Number.MAX_SAFE_INTEGER
    );
  }

  function marketDay(
    match
  ) {
    const timestamp =
      eventStart(match);

    if (
      !Number.isFinite(
        timestamp
      ) ||
      timestamp ===
        Number.MAX_SAFE_INTEGER
    ) {
      return "unknown";
    }

    return dayFormatter.format(
      new Date(timestamp)
    );
  }

  function forMatch(
    match
  ) {
    return (
      oddsByEvent.get(
        V2.id(match)
      ) ||
      null
    );
  }

  function eventPayload(
    match
  ) {
    return {
      id:
        V2.id(match),
      title:
        String(
          match?.title || ""
        ),
      sport:
        V2.family(match),
      category:
        String(
          match?.category ||
          ""
        ),
      league:
        String(
          match?.league ||
          ""
        ),
      startsAt:
        V2.ts(
          match?.date
        ) || null,
      away:
        String(
          match?.teams
            ?.away?.name ||
          ""
        ),
      home:
        String(
          match?.teams
            ?.home?.name ||
          ""
        )
    };
  }

  function eligibleEvents(
    events
  ) {
    const list =
      (
        Array.isArray(events)
          ? events
          : []
      )
        .filter(
          (match) => {
            const family =
              V2.family(
                match
              );

            if (
              ![
                "american-football",
                "baseball",
                "combat"
              ].includes(
                family
              ) ||
              !match?.teams
                ?.away?.name ||
              !match?.teams
                ?.home?.name
            ) {
              return false;
            }

            if (
              V2.live(match) ||
              eventStart(match) <=
                Date.now()
            ) {
              return false;
            }

            /*
              Football betting is NFL only.
            */
            if (
              family ===
                "american-football" &&
              !isNflMatch(match)
            ) {
              return false;
            }

            return true;
          }
        )
        .sort(
          (left, right) =>
            eventStart(left) -
            eventStart(right)
        );

    const counts =
      new Map();

    return list.filter(
      (match) => {
        const key =
          `${V2.family(
            match
          )}|${marketDay(
            match
          )}`;

        const count =
          counts.get(key) || 0;

        if (
          count >=
          MAX_EVENTS_PER_SPORT_PER_DAY
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

  function schedule() {
    window.clearTimeout(
      refreshTimer
    );

    refreshTimer =
      window.setTimeout(
        () =>
          refresh(
            S.events
          ),
        document.hidden
          ? 60 * 60 * 1000
          : REFRESH_INTERVAL_MS
      );
  }

  async function refresh(
    events = S.events
  ) {
    const candidates =
      eligibleEvents(
        events
      );

    const signature =
      candidates
        .map(
          (match) =>
            V2.id(match)
        )
        .join("|");

    const now =
      Date.now();

    if (
      signature ===
        lastCandidateSignature &&
      lastRefreshAt &&
      now - lastRefreshAt <
        REFRESH_INTERVAL_MS &&
      oddsByEvent.size
    ) {
      schedule();
      return;
    }

    if (
      !candidates.length
    ) {
      oddsByEvent.clear();
      lastCandidateSignature =
        "";
      lastRefreshAt =
        now;
      schedule();

      V2.events
        ?.renderGrid?.();

      return;
    }

    lastCandidateSignature =
      signature;
    lastRefreshAt =
      now;

    schedule();

    const token =
      ++requestToken;

    try {
      const response =
        await fetch(
          "/api/v2/card-odds",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                events:
                  candidates.map(
                    eventPayload
                  )
              }),
            cache:
              "no-store"
          }
        );

      if (
        !response.ok ||
        token !==
          requestToken
      ) {
        return;
      }

      const payload =
        await response.json();

      if (
        !payload?.ok ||
        !payload?.odds ||
        token !==
          requestToken
      ) {
        return;
      }

      oddsByEvent.clear();

      Object.entries(
        payload.odds
      ).forEach(
        ([
          eventId,
          value
        ]) => {
          if (
            !value
              ?.providerEventId ||
            !Number.isFinite(
              Number(
                value?.away
                  ?.american
              )
            ) ||
            !Number.isFinite(
              Number(
                value?.home
                  ?.american
              )
            )
          ) {
            return;
          }

          oddsByEvent.set(
            String(eventId),
            value
          );
        }
      );

      V2.events
        ?.renderGrid?.();

      V2.cardScores
        ?.refresh?.(
          S.events
        );
    } catch {
      /*
        Sportsbook odds are optional decoration.
        Event browsing must always continue.
      */
    }
  }

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden &&
        (
          !lastRefreshAt ||
          Date.now() -
            lastRefreshAt >=
            REFRESH_INTERVAL_MS
        )
      ) {
        refresh(
          S.events
        );
      }
    }
  );

  V2.cardOdds = {
    forMatch,
    refresh,
    maxPerSportPerDay:
      MAX_EVENTS_PER_SPORT_PER_DAY,
    marketDayTimeZone:
      MARKET_DAY_TIME_ZONE
  };
})();

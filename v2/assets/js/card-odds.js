(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;

  const oddsByEvent = new Map();
  let requestToken = 0;
  let refreshTimer = 0;

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

  function isNflMatch(match) {
    return (
      NFL_TEAMS.has(
        normalizeTeam(
          match?.teams?.away?.name
        )
      ) &&
      NFL_TEAMS.has(
        normalizeTeam(
          match?.teams?.home?.name
        )
      )
    );
  }

  function forMatch(match) {
    return oddsByEvent.get(V2.id(match)) || null;
  }

  function eventPayload(match) {
    return {
      id: V2.id(match),
      title: String(match?.title || ""),
      sport: V2.family(match),
      category: String(match?.category || ""),
      league: String(match?.league || ""),
      startsAt: V2.ts(match?.date) || null,
      away: String(match?.teams?.away?.name || ""),
      home: String(match?.teams?.home?.name || "")
    };
  }

  function schedule() {
    clearTimeout(refreshTimer);

    // The server owns a shared fixed cache for each exact sport feed.
    refreshTimer = window.setTimeout(
      () => refresh(S.events),
      document.hidden ? 30 * 60 * 1000 : 5 * 60 * 1000
    );
  }

  async function refresh(events = S.events) {
    schedule();

    const candidates = events
      .filter((match) => {
        const family = V2.family(match);

        if (
          !["american-football", "baseball", "combat"].includes(family) ||
          !match?.teams?.away?.name ||
          !match?.teams?.home?.name
        ) {
          return false;
        }

        /*
          College football remains watchable in Events, but only NFL teams
          receive Odds API enrichment and therefore Quick Bet eligibility.
        */
        if (
          family === "american-football" &&
          !isNflMatch(match)
        ) {
          return false;
        }

        return true;
      })
      .slice(0, 120);

    if (!candidates.length) {
      oddsByEvent.clear();
      V2.events?.renderGrid?.();
      return;
    }

    const token = ++requestToken;

    try {
      const response = await fetch("/api/v2/card-odds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          events: candidates.map(eventPayload)
        }),
        cache: "no-store"
      });

      if (!response.ok || token !== requestToken) return;

      const payload = await response.json();

      if (!payload?.ok || !payload?.odds || token !== requestToken) {
        return;
      }

      oddsByEvent.clear();

      Object.entries(payload.odds).forEach(([eventId, value]) => {
        /*
          The exact provider event ID plus both sportsbook moneylines makes
          the event eligible for EastCoin Quick Bet. Football reaches this
          point only after the NFL-team guard above.
        */
        if (
          !value?.providerEventId ||
          !Number.isFinite(
            Number(
              value?.away?.american
            )
          ) ||
          !Number.isFinite(
            Number(
              value?.home?.american
            )
          )
        ) {
          return;
        }

        oddsByEvent.set(String(eventId), value);
      });

      V2.events?.renderGrid?.();

      // Scores reuse the verified Odds API event IDs populated by this module.
      V2.cardScores?.refresh?.(S.events);
    } catch {
      // Odds are optional decoration. Event browsing must always work without them.
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refresh(S.events);
    }
  });

  V2.cardOdds = {
    forMatch,
    refresh
  };
})();
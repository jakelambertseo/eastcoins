(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;

  const oddsByEvent = new Map();
  let requestToken = 0;
  let refreshTimer = 0;

  function forMatch(match) {
    return oddsByEvent.get(V2.id(match)) || null;
  }

  function eventPayload(match) {
    return {
      id: V2.id(match),
      title: String(match?.title || ""),
      sport: V2.family(match),
      startsAt: V2.ts(match?.date) || null,
      away: String(match?.teams?.away?.name || ""),
      home: String(match?.teams?.home?.name || "")
    };
  }

  function schedule() {
    clearTimeout(refreshTimer);

    // Card odds are browse context, not locked wager quotes. Keep them
    // deliberately low-frequency to protect the shared Odds API quota.
    refreshTimer = window.setTimeout(
      () => refresh(S.events),
      document.hidden ? 60 * 60 * 1000 : 30 * 60 * 1000
    );
  }

  async function refresh(events = S.events) {
    schedule();

    const candidates = events
      .filter((match) =>
        match?.teams?.away?.name &&
        match?.teams?.home?.name
      )
      .slice(0, 80);

    if (!candidates.length) return;

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
        // A verified provider event ID is enough to make the EastCoin Picks
        // market available. Sportsbook ML is optional display/reference data.
        if (!value?.providerEventId) return;

        oddsByEvent.set(String(eventId), value);
      });

      V2.events?.renderGrid?.();

      // Scores use the exact Odds API event IDs populated by this module.
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

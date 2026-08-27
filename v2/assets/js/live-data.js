(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;

  const scores = new Map();
  let refreshTimer = 0;
  let requestToken = 0;

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function text(value) {
    const result = String(value ?? "").trim();
    return result || null;
  }

  function embeddedScore(match) {
    const objects = [
      match,
      match?.live,
      match?.liveData,
      match?.live_data,
      match?.game,
      match?.gameState,
      match?.game_state,
      match?.score,
      match?.scores,
      match?._eastcoinProviders?.streamed,
      match?._eastcoinProviders?.ppv
    ].filter((value) => value && typeof value === "object");

    for (const object of objects) {
      const awayScore = finite(
        object.awayScore ??
        object.away_score ??
        object.visitorScore ??
        object.visitor_score ??
        object.away?.score ??
        object.visitor?.score
      );

      const homeScore = finite(
        object.homeScore ??
        object.home_score ??
        object.hostScore ??
        object.host_score ??
        object.home?.score ??
        object.host?.score
      );

      if (awayScore !== null && homeScore !== null) {
        return {
          awayScore,
          homeScore,
          period: text(
            object.period ??
            object.quarter ??
            object.inning ??
            object.currentPeriod ??
            object.current_period
          ),
          clock: text(
            object.clock ??
            object.gameClock ??
            object.game_clock ??
            object.timeRemaining ??
            object.time_remaining
          ),
          status: text(
            object.status ??
            object.state ??
            object.gameStatus ??
            object.game_status
          ),
          source: "event"
        };
      }
    }

    return null;
  }

  function forMatch(match) {
    return scores.get(V2.id(match)) || embeddedScore(match);
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

  function scheduleNext(events) {
    clearTimeout(refreshTimer);

    const hasLive = events.some((match) => V2.live(match));

    if (!hasLive) return;

    refreshTimer = window.setTimeout(
      () => refresh(S.events),
      document.hidden ? 60000 : 20000
    );
  }

  async function refresh(events = S.events) {
    const liveEvents = events
      .filter((match) =>
        V2.live(match) &&
        match?.teams?.away?.name &&
        match?.teams?.home?.name
      )
      .slice(0, 20);

    scheduleNext(events);

    if (!liveEvents.length) return;

    const token = ++requestToken;

    // First pick up any score data already present in EastCoin's event payload.
    liveEvents.forEach((match) => {
      const embedded = embeddedScore(match);
      if (embedded) scores.set(V2.id(match), embedded);
    });

    if ([...scores.keys()].length) {
      V2.events?.renderGrid?.();
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/api/v2/live-scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          events: liveEvents.map(eventPayload)
        }),
        cache: "no-store",
        signal: controller.signal
      });

      window.clearTimeout(timeout);

      if (!response.ok || token !== requestToken) return;

      const payload = await response.json();

      if (!payload?.ok || !payload?.scores || token !== requestToken) return;

      Object.entries(payload.scores).forEach(([eventId, data]) => {
        if (!data || typeof data !== "object") return;

        const awayScore = finite(data.awayScore);
        const homeScore = finite(data.homeScore);

        if (awayScore === null || homeScore === null) return;

        scores.set(eventId, {
          awayScore,
          homeScore,
          period: text(data.period),
          clock: text(data.clock),
          status: text(data.status),
          source: text(data.source) || "kalshi"
        });
      });

      V2.events?.renderGrid?.();
    } catch {
      // Live score enrichment is optional. Event browsing must never fail with it.
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refresh(S.events);
    }
  });

  V2.liveData = {
    forMatch,
    refresh,
    embeddedScore
  };
})();

(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;

  const scoresByEvent = new Map();

  let requestToken = 0;
  let refreshTimer = 0;

  function forMatch(match) {
    return scoresByEvent.get(V2.id(match)) || null;
  }

  function candidate(match) {
    const odds =
      V2.cardOdds?.forMatch?.(match) ||
      null;

    if (
      !V2.live(match) ||
      !odds?.providerEventId ||
      !odds?.sportKey
    ) {
      return null;
    }

    return {
      id: V2.id(match),
      providerEventId:
        String(odds.providerEventId),
      sportKey:
        String(odds.sportKey),
      providerAway:
        String(
          odds.providerAway ||
          match?.teams?.away?.name ||
          ""
        ),
      providerHome:
        String(
          odds.providerHome ||
          match?.teams?.home?.name ||
          ""
        )
    };
  }

  function schedule() {
    clearTimeout(refreshTimer);

    refreshTimer = window.setTimeout(
      () => refresh(S.events),
      document.hidden
        ? 10 * 60 * 1000
        : 60 * 1000
    );
  }

  async function refresh(events = S.events) {
    schedule();

    const candidates = events
      .map(candidate)
      .filter(Boolean);

    if (!candidates.length) {
      scoresByEvent.clear();
      return;
    }

    const token = ++requestToken;

    try {
      const response = await fetch(
        "/api/v2/card-scores",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            events: candidates
          }),
          cache: "no-store"
        }
      );

      if (
        !response.ok ||
        token !== requestToken
      ) {
        return;
      }

      const payload =
        await response.json();

      if (
        !payload?.ok ||
        !payload?.scores ||
        token !== requestToken
      ) {
        return;
      }

      scoresByEvent.clear();

      Object.entries(
        payload.scores
      ).forEach(([eventId, score]) => {
        if (
          score == null ||
          !Number.isFinite(
            Number(score.awayScore)
          ) ||
          !Number.isFinite(
            Number(score.homeScore)
          )
        ) {
          return;
        }

        scoresByEvent.set(
          String(eventId),
          score
        );
      });

      V2.events?.renderGrid?.();
    } catch {
      // Score enrichment is optional and must never break Events.
    }
  }

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        refresh(S.events);
      }
    }
  );

  V2.cardScores = {
    forMatch,
    refresh
  };
})();

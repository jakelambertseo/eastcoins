(() => {
  "use strict";

  const BASE =
    window.EastcoinPicksAPI;

  if (
    !BASE ||
    BASE.__eastcoinFootballWindow47
  ) {
    return;
  }

  const CATALOG_URL =
    "/api/picks/catalog";

  let rawCatalogPromise = null;

  function timestamp(value) {
    const direct = Number(value);

    if (
      Number.isFinite(direct) &&
      direct > 0
    ) {
      return direct < 1e12
        ? direct * 1000
        : direct;
    }

    const parsed =
      Date.parse(
        String(value || "")
      );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function sportBucket(game) {
    const key =
      String(
        game?.sportKey ||
        game?.sportTitle ||
        game?.family ||
        game?.sport ||
        ""
      ).toLowerCase();

    if (
      key.startsWith(
        "americanfootball_"
      ) ||
      key.includes("football") ||
      key.includes("nfl") ||
      key.includes("ncaaf")
    ) {
      return "football";
    }

    if (
      key.startsWith("baseball_") ||
      key.includes("baseball") ||
      key.includes("mlb")
    ) {
      return "baseball";
    }

    if (
      key ===
        "mma_mixed_martial_arts" ||
      key.includes("mma") ||
      key.includes("ufc") ||
      key.includes("combat")
    ) {
      return "combat";
    }

    return "other";
  }

  function todayTomorrow(game) {
    const start =
      timestamp(
        game?.commenceTime ||
        game?.startsAt ||
        game?.starts_at ||
        game?.startTs ||
        game?.date
      );

    if (!start) {
      return false;
    }

    const now = new Date();
    const floor =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    const end =
      new Date(floor);

    end.setDate(
      end.getDate() + 2
    );

    return (
      start >= floor.getTime() &&
      start < end.getTime()
    );
  }

  function visibleMarket(game) {
    const start =
      timestamp(
        game?.commenceTime ||
        game?.startsAt ||
        game?.starts_at ||
        game?.startTs ||
        game?.date
      );

    if (!start) {
      return false;
    }

    /*
      EastCoin's sportsbook catalog already limits games to the next 14 days.
      Football keeps every still-upcoming NFL/NCAAF market in that catalog,
      while Baseball and UFC/MMA retain the tighter today + tomorrow view.
    */
    if (
      sportBucket(game) ===
      "football"
    ) {
      return start > Date.now();
    }

    return todayTomorrow(game);
  }

  async function loadRawCatalog(
    force = false
  ) {
    if (
      !force &&
      rawCatalogPromise
    ) {
      return rawCatalogPromise;
    }

    const task =
      fetch(
        CATALOG_URL,
        {
          credentials:
            "same-origin",
          cache:
            force
              ? "reload"
              : "default",
          headers: {
            Accept:
              "application/json"
          }
        }
      )
        .then(
          async (response) => {
            const payload =
              await response
                .json()
                .catch(
                  () => null
                );

            if (
              !response.ok ||
              !payload?.ok
            ) {
              throw new Error(
                payload?.message ||
                "Live sportsbook catalog unavailable."
              );
            }

            return payload;
          }
        );

    rawCatalogPromise =
      task.catch(
        (error) => {
          rawCatalogPromise =
            null;

          throw error;
        }
      );

    return rawCatalogPromise;
  }

  const wrapped = {
    ...BASE,

    __eastcoinFootballWindow47:
      true,

    async getCatalog(
      ...args
    ) {
      /*
        Calling the existing runtime first keeps its internal moneyline index,
        team matching, and ticket pricing hydrated. The raw request then
        restores eligible football games that Iteration 45 trimmed away.
      */
      const [
        current,
        raw
      ] =
        await Promise.all([
          BASE.getCatalog
            ? BASE
                .getCatalog(
                  ...args
                )
                .catch(
                  () => null
                )
            : Promise.resolve(
                null
              ),

          loadRawCatalog(
            Boolean(
              args?.[0]
                ?.force
            )
          ).catch(
            () => null
          )
        ]);

      const source =
        raw?.games
          ? raw
          : current;

      if (
        !source ||
        !Array.isArray(
          source.games
        )
      ) {
        return source;
      }

      return {
        ...source,
        games:
          source.games.filter(
            visibleMarket
          )
      };
    }
  };

  window.EastcoinPicksAPI =
    Object.freeze(
      wrapped
    );

  function activeFilter() {
    return (
      document.querySelector(
        "[data-picks-sport].active"
      )?.dataset
        ?.picksSport ||
      "all"
    );
  }

  function syncMarketTools() {
    const football =
      document.querySelector(
        '[data-picks-sport="football"]'
      );

    if (football) {
      football.hidden = false;
    }

    const filter =
      activeFilter();

    const note =
      document.querySelector(
        ".picks-market-window"
      );

    if (note) {
      note.textContent =
        filter === "football"
          ? "Upcoming football · 14-day catalog"
          : filter === "all"
            ? "Today + tomorrow · Football upcoming"
            : "Today + tomorrow only";
    }

    const status =
      document.getElementById(
        "catalogStatus"
      );

    if (
      status &&
      document.querySelector(
        "#marketList .market-card"
      )
    ) {
      const visible =
        [
          ...document.querySelectorAll(
            "#marketList .market-card"
          )
        ].filter(
          (card) =>
            !card.hidden
        ).length;

      if (
        filter === "football"
      ) {
        status.textContent =
          `Upcoming football · ${visible} ${
            visible === 1
              ? "market"
              : "markets"
          }`;
      } else if (
        filter === "all"
      ) {
        status.textContent =
          `Current slate · ${visible} ${
            visible === 1
              ? "market"
              : "markets"
          }`;
      }
    }
  }

  const observer =
    new MutationObserver(
      syncMarketTools
    );

  const marketRoot =
    document.querySelector(
      '[data-view-panel="markets"]'
    ) ||
    document.body;

  observer.observe(
    marketRoot,
    {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "class"
      ]
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          "[data-picks-sport]"
        )
      ) {
        requestAnimationFrame(
          syncMarketTools
        );
      }
    }
  );

  requestAnimationFrame(
    syncMarketTools
  );
})();

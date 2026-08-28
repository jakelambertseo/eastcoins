(() => {
  "use strict";

  const BASE =
    window.EastcoinPicksAPI;

  if (
    !BASE ||
    BASE.__eastcoinFootballWindow50
  ) {
    return;
  }

  const CATALOG_URL =
    "/api/picks/catalog";

  const RAW_TIMEOUT_MS = 5000;

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

  function isNflGame(game) {
    const key =
      String(
        game?.sportKey ||
        game?.sport_key ||
        ""
      ).toLowerCase();

    const title =
      String(
        game?.sportTitle ||
        game?.sport_title ||
        game?.league ||
        game?.sport ||
        ""
      ).toLowerCase();

    return (
      key ===
        "americanfootball_nfl" ||
      (
        !key &&
        (
          title === "nfl" ||
          title.includes(
            "national football league"
          )
        )
      )
    );
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
      The server catalog itself already has a 14-day maximum horizon.
      Football can therefore keep every still-upcoming NFL line,
      while NCAAF is excluded and Baseball/UFC/MMA retain today + tomorrow.
    */
    if (
      sportBucket(game) ===
      "football"
    ) {
      return (
        isNflGame(game) &&
        start > Date.now()
      );
    }

    return todayTomorrow(game);
  }

  async function fetchRawCatalog(
    force = false
  ) {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        () => controller.abort(),
        RAW_TIMEOUT_MS
      );

    try {
      const response =
        await fetch(
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
            },
            signal:
              controller.signal
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
        !payload?.ok
      ) {
        throw new Error(
          payload?.message ||
          "Live sportsbook catalog unavailable."
        );
      }

      return payload;
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        throw new Error(
          "NFL catalog request timed out."
        );
      }

      throw error;
    } finally {
      window.clearTimeout(
        timer
      );
    }
  }

  function loadRawCatalog(
    force = false
  ) {
    if (
      !force &&
      rawCatalogPromise
    ) {
      return rawCatalogPromise;
    }

    const task =
      fetchRawCatalog(
        force
      );

    rawCatalogPromise =
      task.catch(
        (error) => {
          console.warn(
            "EastCoin extended NFL catalog unavailable",
            error
          );

          rawCatalogPromise =
            null;

          return null;
        }
      );

    return rawCatalogPromise;
  }

  const wrapped = {
    ...BASE,

    __eastcoinFootballWindow50:
      true,

    async getCatalog(
      ...args
    ) {
      /*
        Both paths are bounded now:
        - BASE already has the Picks API's 12s request timeout.
        - The supplemental raw catalog aborts after 5s.

        If either one fails, use whichever result succeeded. Most importantly,
        the supplemental Football request can never leave Open Markets waiting
        forever.
      */
      const [
        currentResult,
        rawResult
      ] =
        await Promise.allSettled([
          BASE.getCatalog
            ? BASE.getCatalog(
                ...args
              )
            : Promise.resolve(
                null
              ),

          loadRawCatalog(
            Boolean(
              args?.[0]
                ?.force
            )
          )
        ]);

      const current =
        currentResult.status ===
        "fulfilled"
          ? currentResult.value
          : null;

      const raw =
        rawResult.status ===
        "fulfilled"
          ? rawResult.value
          : null;

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

  function setText(
    node,
    value
  ) {
    if (!node) return;

    const next =
      String(value);

    /*
      Critical: never rewrite identical text. The previous v47 helper wrote
      textContent from inside a MutationObserver that was watching childList,
      so its own text update immediately triggered itself again.
    */
    if (
      node.textContent !==
      next
    ) {
      node.textContent =
        next;
    }
  }

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

    setText(
      note,
      filter === "football"
        ? "Upcoming NFL · 14-day catalog"
        : filter === "all"
          ? "Today + tomorrow · NFL upcoming"
          : "Today + tomorrow only"
    );

    const status =
      document.getElementById(
        "catalogStatus"
      );

    const cards = [
      ...document.querySelectorAll(
        "#marketList .market-card"
      )
    ];

    if (
      status &&
      cards.length
    ) {
      const visible =
        cards.filter(
          (card) =>
            !card.hidden
        ).length;

      if (
        filter === "football"
      ) {
        setText(
          status,
          `Upcoming football · ${visible} ${
            visible === 1
              ? "market"
              : "markets"
          }`
        );
      } else if (
        filter === "all"
      ) {
        setText(
          status,
          `Current slate · ${visible} ${
            visible === 1
              ? "market"
              : "markets"
          }`
        );
      }
    }
  }

  /*
    NO MutationObserver here.

    The Picks controls are injected shortly after startup, so use a small,
    bounded readiness poll. It stops after 10 seconds and cannot create a
    self-triggering DOM loop.
  */
  let startupChecks = 0;

  const startupTimer =
    window.setInterval(
      () => {
        startupChecks += 1;
        syncMarketTools();

        if (
          startupChecks >= 40 ||
          (
            document.querySelector(
              "[data-picks-sport]"
            ) &&
            document.querySelector(
              "#marketList .market-card"
            )
          )
        ) {
          window.clearInterval(
            startupTimer
          );
        }
      },
      250
    );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          "[data-picks-sport]"
        )
      ) {
        window.requestAnimationFrame(
          syncMarketTools
        );
      }
    }
  );

  window.requestAnimationFrame(
    syncMarketTools
  );
})();

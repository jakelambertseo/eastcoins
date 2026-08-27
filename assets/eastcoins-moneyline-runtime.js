(() => {
  "use strict";

  const ML = window.EastcoinMoneyline;
  if (!ML) {
    console.error("EastCoin moneyline calculator failed to load.");
    return;
  }

  const CATALOG_URL = "/api/picks/catalog";
  const LOCKS_KEY = "eastcoinMoneylinePreviewLocksV1";
  const PREVIEW_SETTLEMENTS_KEY = "eastcoinPicksPreviewSettlementsV1";

  let catalogPromise = null;
  let catalog = [];
  let catalogByEvent = new Map();
  let catalogByPair = new Map();
  let renderQueued = false;

  const IS_PICKS_PAGE =
    Boolean(
      document.getElementById(
        "marketList"
      )
    );

  let picksSportFilter = "all";
  let teamLogoPromise = null;
  let teamLogoByName = new Map();

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&amp;/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function pairKey(away, home) {
    return `${norm(away)}|${norm(home)}`;
  }

  function eventTimestamp(value) {
    const direct = Number(value);

    if (Number.isFinite(direct) && direct > 0) {
      return direct < 1e12
        ? direct * 1000
        : direct;
    }

    const parsed = Date.parse(
      String(value || "")
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function picksWindow() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 2);

    return {
      start: start.getTime(),
      end: end.getTime()
    };
  }

  function isTodayOrTomorrow(game) {
    const ts = eventTimestamp(
      game?.commenceTime ||
      game?.startsAt ||
      game?.starts_at ||
      game?.startTs ||
      game?.date
    );

    if (!ts) return false;

    const window = picksWindow();

    return (
      ts >= window.start &&
      ts < window.end
    );
  }

  function picksCatalogGames(games) {
    if (!IS_PICKS_PAGE) {
      return Array.isArray(games)
        ? games
        : [];
    }

    return (
      Array.isArray(games)
        ? games
        : []
    ).filter(isTodayOrTomorrow);
  }

  function sportBucket(value) {
    const key = String(value || "")
      .toLowerCase();

    if (
      key.startsWith("americanfootball_") ||
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
      key === "mma_mixed_martial_arts" ||
      key.includes("mma") ||
      key.includes("ufc") ||
      key.includes("combat")
    ) {
      return "combat";
    }

    return "other";
  }

  function reversePairKey(away, home) {
    return `${norm(home)}|${norm(away)}`;
  }

  function money(value) {
    return Math.max(0, Math.round(Number(value) || 0))
      .toLocaleString("en-US");
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value);
    if (node.textContent !== next) {
      node.textContent = next;
    }
  }

  function lineFromCatalogGame(game, side) {
    return ML.normalize(game?.consensus?.[side]?.american);
  }

  function indexCatalog(games) {
    catalog = Array.isArray(games) ? games : [];
    catalogByEvent = new Map();
    catalogByPair = new Map();

    for (const game of catalog) {
      const eventId = String(game?.providerEventId || "");
      if (eventId) catalogByEvent.set(eventId, game);

      const away = game?.awayTeam;
      const home = game?.homeTeam;
      if (away && home) {
        catalogByPair.set(pairKey(away, home), game);
        catalogByPair.set(reversePairKey(away, home), {
          ...game,
          __eastcoinReversed: true
        });
      }
    }

    scheduleRender();
    return catalog;
  }

  async function loadCatalog(force = false) {
    if (!force && catalogPromise) return catalogPromise;

    catalogPromise = fetch(CATALOG_URL, {
      credentials: "same-origin",
      cache: force ? "reload" : "default",
      headers: { Accept: "application/json" }
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "Live sportsbook catalog unavailable.");
        }
        indexCatalog(payload.games);
        return payload;
      })
      .catch((error) => {
        console.warn("EastCoin moneyline catalog unavailable", error);
        indexCatalog([]);
        return null;
      });

    return catalogPromise;
  }

  function catalogGameByEvent(eventId) {
    return catalogByEvent.get(String(eventId || "")) || null;
  }

  function catalogGameByTeams(away, home) {
    const game = catalogByPair.get(pairKey(away, home));
    if (!game) return null;
    return game;
  }

  function normalizedSides(game) {
    if (!game) return null;

    if (game.__eastcoinReversed) {
      return {
        away: {
          american: game?.consensus?.home?.american
        },
        home: {
          american: game?.consensus?.away?.american
        }
      };
    }

    return {
      away: {
        american: game?.consensus?.away?.american
      },
      home: {
        american: game?.consensus?.home?.american
      }
    };
  }

  function pricingWeights(game) {
    const sides = normalizedSides(game);
    const awayML = ML.normalize(sides?.away?.american);
    const homeML = ML.normalize(sides?.home?.american);
    const awayDecimal = ML.toDecimal(awayML);
    const homeDecimal = ML.toDecimal(homeML);

    if (!awayDecimal || !homeDecimal) return null;

    // Compatibility weights derived only from sportsbook prices. They are not
    // community wagers; the existing Picks renderer sees the same decimal
    // return while EastCoin transitions its old pool-shaped data interface.
    const total = 1000000;
    const away = total / awayDecimal;
    const home = total / homeDecimal;

    return {
      away,
      home,
      total: away + home,
      awayCount: 1,
      homeCount: 1,
      awayZcoins: away,
      homeZcoins: home,
      totalZcoins: away + home,
      awayTickets: 1,
      homeTickets: 1
    };
  }

  function decorateMarket(raw, fallbackEventId = "") {
    if (!raw || typeof raw !== "object") return raw;

    const eventId = String(
      raw.providerEventId ||
      raw.eventId ||
      raw.event_id ||
      fallbackEventId ||
      ""
    );

    let game = catalogGameByEvent(eventId);

    if (!game) {
      const away = raw?.away?.name || raw?.away || raw?.teams?.away?.name;
      const home = raw?.home?.name || raw?.home || raw?.teams?.home?.name;
      game = catalogGameByTeams(away, home);
    }

    const weights = pricingWeights(game);
    if (!weights) return raw;

    const sides = normalizedSides(game);

    return {
      ...raw,
      sportsbook: {
        away: {
          american: ML.normalize(sides?.away?.american)
        },
        home: {
          american: ML.normalize(sides?.home?.american)
        }
      },
      pool: {
        ...(raw.pool || {}),
        ...weights
      }
    };
  }

  function readLocks() {
    try {
      const data = JSON.parse(localStorage.getItem(LOCKS_KEY) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function writeLock(
    gameId,
    side,
    price,
    away = "",
    home = "",
    pickedTeam = ""
  ) {
    const value = ML.normalize(price);
    if (!gameId || !side || value == null) return;

    try {
      const locks = readLocks();
      locks[String(gameId)] = {
        side,
        moneyline: value,
        away: String(away || ""),
        home: String(home || ""),
        pickedTeam: String(pickedTeam || ""),
        savedAt: Date.now()
      };
      localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
    } catch {}
  }

  function wrapPicksApi() {
    const api = window.EastcoinPicksAPI;
    if (!api || api.__eastcoinMoneylineWrapped) return Boolean(api);

    const wrapped = {
      ...api,
      __eastcoinMoneylineWrapped: true,

      async getCatalog(...args) {
        const payload = api.getCatalog
          ? await api.getCatalog(...args)
          : await loadCatalog();

        if (payload?.games) {
          indexCatalog(payload.games);

          if (IS_PICKS_PAGE) {
            return {
              ...payload,
              games:
                picksCatalogGames(
                  payload.games
                )
            };
          }
        }

        return payload;
      },

      async getBootstrap(...args) {
        const [payload] = await Promise.all([
          api.getBootstrap(...args),
          loadCatalog()
        ]);

        if (Array.isArray(payload?.markets)) {
          payload.markets =
            (IS_PICKS_PAGE
              ? payload.markets.filter(
                  isTodayOrTomorrow
                )
              : payload.markets
            ).map((market) =>
              decorateMarket(market)
            );
        }

        if (Array.isArray(payload?.myPicks)) {
          payload.myPicks = payload.myPicks.map((pick) => ({
            ...pick,
            market: decorateMarket(pick?.market || {})
          }));
        }

        if (Array.isArray(payload?.communityLedger)) {
          payload.communityLedger = payload.communityLedger.map((row) => ({
            ...row,
            market: decorateMarket(row?.market || {})
          }));
        }

        return payload;
      },

      async ensureMarket(args) {
        await loadCatalog();
        const result = await api.ensureMarket(args);
        if (result?.market) {
          result.market = decorateMarket(result.market, args?.providerEventId);
        }
        return result;
      }
    };

    window.EastcoinPicksAPI = Object.freeze(wrapped);
    return true;
  }

  function wrapPicksPreview() {
    const preview = window.EastcoinPicksPreview;
    if (!preview || preview.__eastcoinMoneylineWrapped) return Boolean(preview);

    const wrapped = {
      ...preview,
      __eastcoinMoneylineWrapped: true,

      async loadGames(...args) {
        const [result] = await Promise.all([
          preview.loadGames(...args),
          loadCatalog()
        ]);

        if (!Array.isArray(result?.games)) return result;

        return {
          ...result,
          games: (IS_PICKS_PAGE
            ? result.games.filter(
                isTodayOrTomorrow
              )
            : result.games
          ).map((game) => {
            const live = catalogGameByTeams(game?.away, game?.home);
            const sides = normalizedSides(live);
            return live
              ? {
                  ...game,
                  sportsbook: {
                    away: { american: ML.normalize(sides?.away?.american) },
                    home: { american: ML.normalize(sides?.home?.american) }
                  }
                }
              : game;
          })
        };
      },

      market(game) {
        const live =
          catalogGameByTeams(game?.away, game?.home) ||
          null;

        const sides = normalizedSides(live);
        const awayML = ML.normalize(
          game?.sportsbook?.away?.american ??
          sides?.away?.american
        );
        const homeML = ML.normalize(
          game?.sportsbook?.home?.american ??
          sides?.home?.american
        );
        const awayOdds = ML.toDecimal(awayML);
        const homeOdds = ML.toDecimal(homeML);

        if (!awayOdds || !homeOdds) return preview.market(game);

        return {
          away: 1 / awayOdds,
          home: 1 / homeOdds,
          total: 1,
          awayCount: 1,
          homeCount: 1,
          active: true,
          awayShare: 1 / awayOdds,
          homeShare: 1 / homeOdds,
          awayOdds,
          homeOdds,
          awayMoneyline: awayML,
          homeMoneyline: homeML,
          settlement: preview.settlementFor?.(game?.id) || null
        };
      },

      placeTicket({ game, side, wager, previewMultiplier }) {
        const snap = wrapped.market(game);
        const price = side === "away"
          ? snap.awayMoneyline
          : snap.homeMoneyline;
        const decimal = ML.toDecimal(price);

        const ticket = preview.placeTicket({
          game,
          side,
          wager,
          previewMultiplier: decimal || previewMultiplier
        });

        writeLock(
          game?.id,
          side,
          price,
          game?.away,
          game?.home,
          side === "away" ? game?.away : game?.home
        );
        return ticket;
      },

      settleMarket(game, result) {
        if (!["away", "home", "void", "no_action"].includes(result)) {
          throw new Error("Invalid settlement result.");
        }

        const snap = wrapped.market(game);
        const settlements = (() => {
          try {
            const data = JSON.parse(
              localStorage.getItem(PREVIEW_SETTLEMENTS_KEY) || "{}"
            );
            return data && typeof data === "object" ? data : {};
          } catch {
            return {};
          }
        })();

        settlements[game.id] = {
          marketId: game.id,
          result,
          settledAt: Date.now(),
          finalMultiplier: {
            away: snap.awayOdds || 1,
            home: snap.homeOdds || 1
          },
          moneyline: {
            away: snap.awayMoneyline ?? null,
            home: snap.homeMoneyline ?? null
          }
        };

        localStorage.setItem(
          PREVIEW_SETTLEMENTS_KEY,
          JSON.stringify(settlements)
        );

        return settlements[game.id];
      }
    };

    window.EastcoinPicksPreview = Object.freeze(wrapped);
    return true;
  }

  function setupEarlyPicksWrapping() {
    // This runtime is intentionally placed after picks-api + picks-preview but
    // before eastcoins-picks.js, so the Picks application captures the wrappers.
    wrapPicksApi();
    wrapPicksPreview();
  }

  function rootQuickBetPrice(side) {
    const node = document.getElementById(
      side === "away" ? "quickBetAwayML" : "quickBetHomeML"
    );
    return ML.parse(node?.textContent);
  }

  function rootSelectedSide() {
    if (document.getElementById("quickBetAway")?.classList.contains("selected")) {
      return "away";
    }
    if (document.getElementById("quickBetHome")?.classList.contains("selected")) {
      return "home";
    }
    return null;
  }

  function rootWager() {
    return Math.max(
      1,
      Math.floor(
        Number(
          document.getElementById("quickBetAmount")?.value ||
          document.getElementById("quickBetRange")?.value ||
          1
        ) || 1
      )
    );
  }

  function renderRootQuickBet() {
    if (!document.getElementById("quickBetModal")) return;

    const awayML = rootQuickBetPrice("away");
    const homeML = rootQuickBetPrice("home");

    const awayProjection = document.getElementById("quickBetAwayProjection");
    const homeProjection = document.getElementById("quickBetHomeProjection");

    if (awayML != null) setText(awayProjection, ML.format(awayML));
    if (homeML != null) setText(homeProjection, ML.format(homeML));

    const side = rootSelectedSide();
    if (!side) return;

    const price = side === "away" ? awayML : homeML;
    const projection = ML.payout(rootWager(), price);
    if (!projection.available) return;

    const multiplier = document.getElementById("quickBetMultiplier");
    const potential = document.getElementById("quickBetReturn");
    setText(multiplier, ML.format(price));
    setText(potential, `${money(projection.totalReturn)} ZCoins`);

    const reviewML = ML.parse(
      document.getElementById("quickBetReviewML")?.textContent
    ) ?? price;
    const reviewWager = ML.parse(
      document.getElementById("quickBetReviewWager")?.textContent
    ) ?? rootWager();
    const reviewProjection = ML.payout(reviewWager, reviewML);

    if (reviewProjection.available) {
      const reviewPrice = document.getElementById("quickBetReviewMultiplier");
      const reviewReturn = document.getElementById("quickBetReviewReturn");
      setText(reviewPrice, ML.format(reviewML));
      setText(reviewReturn, `${money(reviewProjection.totalReturn)} ZCoins`);

      const successPrice = document.getElementById("quickBetSuccessMultiplier");
      const successReturn = document.getElementById("quickBetSuccessReturn");
      setText(successPrice, ML.format(reviewML));
      setText(successReturn, `${money(reviewProjection.totalReturn)} ZCoins`);
    }
  }

  function cardTeamNames(card) {
    const names = [...card.querySelectorAll(".team-choice .team-name strong")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    return names.length >= 2 ? { away: names[0], home: names[1] } : null;
  }

  function catalogForCard(card) {
    const teams = cardTeamNames(card);
    return teams ? catalogGameByTeams(teams.away, teams.home) : null;
  }

  function injectPicksMarketStyles() {
    if (
      document.getElementById(
        "eastcoinPicksMarketToolsStyle"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "eastcoinPicksMarketToolsStyle";

    style.textContent = `
      .picks-market-filters {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin: 0 0 14px;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 12px;
        background: rgba(255,255,255,.025);
      }

      .picks-market-filters > span {
        margin-right: 2px;
        color: #8f8f96;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .picks-market-filter {
        appearance: none;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 999px;
        background: #17171b;
        color: #c9c9ce;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 750;
        line-height: 1;
        padding: 8px 11px;
        transition: border-color .15s ease, background .15s ease, color .15s ease;
      }

      .picks-market-filter:hover {
        border-color: rgba(215,174,84,.42);
        color: #f1f1f3;
      }

      .picks-market-filter.active {
        border-color: rgba(215,174,84,.55);
        background: rgba(215,174,84,.12);
        color: #e7c879;
      }

      .picks-market-filter[hidden] {
        display: none !important;
      }

      .picks-market-window {
        margin-left: auto;
        color: #7f7f86;
        font-size: 11px;
        font-weight: 700;
      }

      .market-card[hidden] {
        display: none !important;
      }

      .market-filter-empty {
        padding: 28px 18px;
        border: 1px dashed rgba(255,255,255,.1);
        border-radius: 12px;
        color: #8f8f96;
        text-align: center;
      }

      .team-logo img[data-eastcoin-market-logo="1"] {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      @media (max-width: 720px) {
        .picks-market-window {
          width: 100%;
          margin-left: 0;
          padding-top: 2px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePicksMarketFilters() {
    if (!IS_PICKS_PAGE) return null;

    const list =
      document.getElementById(
        "marketList"
      );

    if (!list) return null;

    let controls =
      document.getElementById(
        "picksMarketFilters"
      );

    if (controls) return controls;

    injectPicksMarketStyles();

    controls =
      document.createElement("div");

    controls.id =
      "picksMarketFilters";
    controls.className =
      "picks-market-filters";
    controls.setAttribute(
      "aria-label",
      "Filter Picks markets by sport"
    );

    controls.innerHTML = `
      <span>Sport</span>
      <button class="picks-market-filter active" type="button" data-picks-sport="all">All</button>
      <button class="picks-market-filter" type="button" data-picks-sport="football">🏈 Football</button>
      <button class="picks-market-filter" type="button" data-picks-sport="baseball">⚾ Baseball</button>
      <button class="picks-market-filter" type="button" data-picks-sport="combat">🥊 UFC / MMA</button>
      <small class="picks-market-window">Today + tomorrow only</small>
    `;

    controls.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "[data-picks-sport]"
          );

        if (!button) return;

        picksSportFilter =
          button.dataset.picksSport ||
          "all";

        controls
          .querySelectorAll(
            "[data-picks-sport]"
          )
          .forEach((item) => {
            item.classList.toggle(
              "active",
              item === button
            );
          });

        scheduleRender();
      }
    );

    list.parentNode.insertBefore(
      controls,
      list
    );

    return controls;
  }

  function rawTeamObjects(match) {
    const teams = match?.teams;

    if (Array.isArray(teams)) {
      return teams;
    }

    if (
      teams &&
      typeof teams === "object"
    ) {
      return [
        teams.away ||
          teams.visitor ||
          teams.team1 ||
          teams.a,
        teams.home ||
          teams.host ||
          teams.team2 ||
          teams.h
      ].filter(Boolean);
    }

    return [];
  }

  function streamedBadgeUrl(team) {
    if (!team || typeof team !== "object") {
      return "";
    }

    const ref = String(
      team.badge ||
      team.logo ||
      team.image ||
      team.icon ||
      ""
    ).trim();

    if (!ref) return "";

    if (/^https?:\/\//i.test(ref)) {
      return ref;
    }

    try {
      return (
        window.EastcoinStreamedAPI
          ?.badgeUrl?.(ref) ||
        ""
      );
    } catch {
      return "";
    }
  }

  function teamDisplayName(team) {
    if (typeof team === "string") {
      return team;
    }

    return String(
      team?.name ||
      team?.title ||
      team?.team ||
      team?.displayName ||
      ""
    ).trim();
  }

  function indexStreamedTeamLogos(matches) {
    const next = new Map();

    for (
      const match of
      Array.isArray(matches)
        ? matches
        : []
    ) {
      for (
        const team of
        rawTeamObjects(match)
      ) {
        const name =
          teamDisplayName(team);
        const url =
          streamedBadgeUrl(team);

        if (!name || !url) continue;

        next.set(
          norm(name),
          url
        );
      }
    }

    if (next.size) {
      teamLogoByName = next;
    }

    scheduleRender();
  }

  async function loadTeamLogos() {
    if (!IS_PICKS_PAGE) return null;
    if (teamLogoPromise) return teamLogoPromise;

    teamLogoPromise = (async () => {
      const api =
        window.EastcoinStreamedAPI;

      if (!api) return null;

      try {
        let result = null;

        if (typeof api.getAll === "function") {
          result = await api.getAll(false);
        } else if (
          typeof api.getDiscovery ===
          "function"
        ) {
          result =
            await api.getDiscovery(false);
        } else if (
          typeof api.getToday ===
          "function"
        ) {
          result = await api.getToday(false);
        }

        const matches =
          Array.isArray(result)
            ? result
            : Array.isArray(result?.data)
              ? result.data
              : [];

        indexStreamedTeamLogos(
          matches
        );
      } catch (error) {
        console.warn(
          "EastCoin Picks team logos unavailable",
          error
        );
      }

      return teamLogoByName;
    })();

    return teamLogoPromise;
  }

  function logoForTeam(name) {
    const exact =
      teamLogoByName.get(
        norm(name)
      );

    if (exact) return exact;

    const target = norm(name);
    if (!target) return "";

    for (
      const [key, url] of
      teamLogoByName
    ) {
      if (
        key.length >= 5 &&
        target.length >= 5 &&
        (
          key.includes(target) ||
          target.includes(key)
        )
      ) {
        return url;
      }
    }

    return "";
  }

  function hydratePicksTeamLogos(card) {
    for (
      const choice of
      card.querySelectorAll(
        ".team-choice"
      )
    ) {
      const name =
        choice.querySelector(
          ".team-name strong"
        )?.textContent?.trim();

      const holder =
        choice.querySelector(
          ".team-logo"
        );

      if (!name || !holder) continue;
      if (holder.querySelector("img")) {
        continue;
      }

      const url =
        logoForTeam(name);

      if (!url) continue;

      const image =
        document.createElement("img");

      image.src = url;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.dataset.eastcoinMarketLogo =
        "1";

      image.addEventListener(
        "error",
        () => image.remove(),
        { once: true }
      );

      holder.prepend(image);
    }
  }

  function cardSportBucket(
    card,
    game
  ) {
    const fromGame =
      sportBucket(
        game?.sportKey ||
        game?.sportTitle ||
        game?.sport ||
        ""
      );

    if (fromGame !== "other") {
      return fromGame;
    }

    return sportBucket(
      card.querySelector(
        ".sport-badge"
      )?.textContent ||
      ""
    );
  }

  function applyPicksMarketFilter() {
    const list =
      document.getElementById(
        "marketList"
      );

    if (!list) return;

    const controls =
      ensurePicksMarketFilters();

    const counts = {
      all: 0,
      football: 0,
      baseball: 0,
      combat: 0
    };

    let visible = 0;

    const cards = [
      ...list.querySelectorAll(
        ".market-card"
      )
    ];

    for (const card of cards) {
      const game =
        catalogForCard(card);
      const bucket =
        cardSportBucket(
          card,
          game
        );

      card.dataset.marketSport =
        bucket;

      counts.all += 1;

      if (counts[bucket] != null) {
        counts[bucket] += 1;
      }

      const show =
        picksSportFilter === "all" ||
        bucket === picksSportFilter;

      card.hidden = !show;

      if (show) visible += 1;
    }

    if (controls) {
      controls
        .querySelectorAll(
          "[data-picks-sport]"
        )
        .forEach((button) => {
          const key =
            button.dataset.picksSport;

          button.hidden =
            key !== "all" &&
            !counts[key];
        });
    }

    let empty =
      document.getElementById(
        "marketFilterEmpty"
      );

    if (!empty) {
      empty =
        document.createElement("div");
      empty.id =
        "marketFilterEmpty";
      empty.className =
        "market-filter-empty";
      empty.hidden = true;
      list.parentNode.appendChild(empty);
    }

    empty.hidden =
      visible > 0 ||
      cards.length === 0;

    if (!empty.hidden) {
      empty.textContent =
        "No markets in this sport are available today or tomorrow.";
    }

    const status =
      document.getElementById(
        "catalogStatus"
      );

    if (cards.length) {
      setText(
        status,
        `Today + tomorrow · ${visible} ${visible === 1 ? "market" : "markets"}`
      );
    }
  }

  function removeEventsDateRail() {
    if (IS_PICKS_PAGE) return;

    const dates =
      document.getElementById(
        "dates"
      );

    if (!dates) return;

    dates.remove();
  }

  function renderPicksMarkets() {
    const list = document.getElementById("marketList");
    if (!list) return;

    ensurePicksMarketFilters();

    for (const card of list.querySelectorAll(".market-card")) {
      const game = catalogForCard(card);
      const sides = normalizedSides(game);

      hydratePicksTeamLogos(card);

      if (!game || !sides) continue;

      const choices = [...card.querySelectorAll(".team-choice")];
      for (const choice of choices) {
        const side = choice.dataset.pick;
        const price = ML.normalize(sides?.[side]?.american);
        const priceNode = choice.querySelector(".team-price strong");
        const labelNode = choice.querySelector(".team-price small");

        setText(priceNode, ML.format(price));
        setText(labelNode, "Moneyline");
      }

      const awayDecimal = ML.toDecimal(sides?.away?.american);
      const homeDecimal = ML.toDecimal(sides?.home?.american);
      const higher =
        awayDecimal && homeDecimal
          ? awayDecimal > homeDecimal
            ? "away"
            : homeDecimal > awayDecimal
              ? "home"
              : null
          : null;

      for (const choice of choices) {
        choice.classList.toggle(
          "higher-payout",
          Boolean(higher && choice.dataset.pick === higher)
        );
      }

      const status = card.querySelector(".market-status");
      if (status && !card.classList.contains("locked")) {
        setText(status, "Moneyline");
        status.classList.remove("waiting");
      }

      const pool = card.querySelector(".market-pool");
      if (pool && pool.dataset.moneylineUi !== "1") {
        pool.dataset.moneylineUi = "1";
        pool.innerHTML = `
          <div class="pool-head">
            <span>Payout source</span>
            <strong>Sportsbook Moneyline</strong>
          </div>
          <div class="pool-labels">
            <span>Live consensus from The Odds API</span>
            <span>Locks when the Pick is confirmed</span>
          </div>
        `;
      }
    }

    applyPicksMarketFilter();
  }

  function selectedPicksMatch() {
    const match = document.getElementById("selectedMatch");
    if (!match) return null;

    const names = [...match.querySelectorAll("strong")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    if (names.length >= 2) {
      return { away: names[0], home: names[names.length - 1] };
    }

    return null;
  }

  function selectedPicksSide(match) {
    const selected = norm(
      document.getElementById("selectedSide")?.textContent
    );

    if (!selected || !match) return null;
    if (selected === norm(match.away)) return "away";
    if (selected === norm(match.home)) return "home";
    return null;
  }

  function picksWager() {
    return Math.max(
      1,
      Math.floor(Number(document.getElementById("wagerRange")?.value || 1) || 1)
    );
  }

  function renderPicksBetSlip() {
    if (!document.getElementById("betBackdrop")) return;

    const match = selectedPicksMatch();
    if (!match) return;

    const game = catalogGameByTeams(match.away, match.home);
    const sides = normalizedSides(game);
    const side = selectedPicksSide(match);
    if (!game || !sides || !side) return;

    const price = ML.normalize(sides?.[side]?.american);
    const projection = ML.payout(picksWager(), price);
    if (!projection.available) return;

    const projectedOdds = document.getElementById("projectedOdds");
    const oddsNote = document.getElementById("oddsNote");
    const projectedPools = document.getElementById("projectedPools");
    const totalRiding = document.getElementById("totalRiding");
    const potentialWinnings = document.getElementById("potentialWinnings");
    const lockButton = document.getElementById("lockPickBtn");

    setText(projectedOdds, ML.format(price));
    setText(
      oddsNote,
      "Your ZCoin payout is calculated directly from the displayed consensus moneyline. The price locks when your Pick is confirmed."
    );

    if (projectedPools) {
      projectedPools.innerHTML = `
        <div class="projected-side">
          <div class="projected-team"><strong>${match.away}</strong></div>
          <strong>ML ${ML.format(sides.away.american)}</strong>
        </div>
        <div class="projected-side">
          <div class="projected-team"><strong>${match.home}</strong></div>
          <strong>ML ${ML.format(sides.home.american)}</strong>
        </div>
      `;
    }

    setText(totalRiding, `+${money(projection.profit)} ZCoins`);
    setText(potentialWinnings, `${money(projection.totalReturn)} ZCoins`);

    if (lockButton) lockButton.disabled = false;
  }

  function renderPicksTickets() {
    const list = document.getElementById("ticketList");
    if (!list) return;

    const locks = readLocks();

    for (const ticket of list.querySelectorAll(".ticket")) {
      const team = ticket.querySelector(".ticket-team strong")?.textContent?.trim();
      const opponentText =
        ticket.querySelector(".ticket-team small")?.textContent || "";
      const opponent = opponentText.replace(/^vs\s+/i, "").trim();
      if (!team || !opponent) continue;

      const game = catalogGameByTeams(team, opponent);
      const pickedSide = "away";
      const sides = normalizedSides(game);
      if (!game || !sides) continue;

      const wagerText =
        ticket.querySelector(".ticket-stat strong")?.textContent || "";
      const wager = ML.parse(wagerText);
      if (!wager) continue;

      const locked = Object.values(locks).find((row) => {
        if (!row || ML.normalize(row.moneyline) == null) {
          return false;
        }

        if (row.pickedTeam) {
          return norm(row.pickedTeam) === norm(team);
        }

        return (
          norm(row.away) === norm(team) ||
          norm(row.home) === norm(team)
        );
      });

      const price =
        ML.normalize(locked?.moneyline) ??
        ML.normalize(sides?.[pickedSide]?.american);

      const projection = ML.payout(wager, price);

      const stats = ticket.querySelectorAll(".ticket-stat");
      if (stats[1]) {
        const label = stats[1].querySelector("span");
        const value = stats[1].querySelector("strong");
        setText(label, locked ? "Locked ML" : "Current ML");
        setText(value, ML.format(price));
      }

      if (
        stats[2] &&
        projection.available &&
        ticket.classList.contains("pending")
      ) {
        const value = stats[2].querySelector("strong");
        setText(value, `${money(projection.totalReturn)} ZC`);
      }

      const foot = ticket.querySelector(".ticket-foot");
      if (foot && ticket.classList.contains("pending")) {
        setText(
          foot,
          locked
            ? "Moneyline locked when this Pick was confirmed."
            : "The displayed sportsbook moneyline locks when the Pick is confirmed."
        );
      }
    }
  }

  function renderLedger() {
    const ledger = document.getElementById("communityLedger");
    if (!ledger) return;

    for (const row of ledger.querySelectorAll(".community-ledger-row")) {
      const labels = [...row.querySelectorAll(".ledger-stat span")];
      for (const label of labels) {
        if (label.textContent.trim() === "Pool") {
          setText(label, "Position");
        }
      }
    }
  }

  function renderAll() {
    renderQueued = false;
    renderRootQuickBet();
    renderPicksMarkets();
    renderPicksBetSlip();
    renderPicksTickets();
    renderLedger();
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(renderAll);
  }

  function observeUi() {
    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    document.addEventListener("input", scheduleRender, true);
    document.addEventListener("change", scheduleRender, true);
    document.addEventListener("click", () => {
      scheduleRender();
      setTimeout(scheduleRender, 0);
      setTimeout(scheduleRender, 50);
    }, true);

    scheduleRender();
  }

  setupEarlyPicksWrapping();
  removeEventsDateRail();
  loadCatalog();
  loadTeamLogos();
  observeUi();
})();

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

        if (payload?.games) indexCatalog(payload.games);
        return payload;
      },

      async getBootstrap(...args) {
        const [payload] = await Promise.all([
          api.getBootstrap(...args),
          loadCatalog()
        ]);

        if (Array.isArray(payload?.markets)) {
          payload.markets = payload.markets.map((market) => decorateMarket(market));
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
          games: result.games.map((game) => {
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

  function renderPicksMarkets() {
    const list = document.getElementById("marketList");
    if (!list) return;

    for (const card of list.querySelectorAll(".market-card")) {
      const game = catalogForCard(card);
      const sides = normalizedSides(game);
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
  loadCatalog();
  observeUi();
})();

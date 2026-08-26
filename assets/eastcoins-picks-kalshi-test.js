(() => {
  "use strict";

  const CATALOG_ENDPOINT =
    "/api/picks-kalshi/catalog";
  const QUOTE_ENDPOINT =
    "/api/picks-kalshi/quote";
  const SESSION_ENDPOINT =
    "/api/picks/auth/session-health";

  const STARTING_BALANCE = 1000;
  const HARD_MAX = 50;

  const state = {
    session: {
      authenticated: false,
      user: null
    },
    data: null,
    markets: [],
    error: null,
    wallet: 0,
    picks: [],
    activeTicker: null,
    activeSide: null,
    quotePrice: null
  };

  const $ = (id) =>
    document.getElementById(id);

  const els = {
    authCardLoggedOut:$("authCardLoggedOut"),
    authCardLoggedIn:$("authCardLoggedIn"),
    navAvatar:$("navAvatar"),
    navUserName:$("navUserName"),
    logoutBtn:$("logoutBtn"),
    sidebarWallet:$("sidebarWallet"),
    summaryWallet:$("summaryWallet"),
    marketCount:$("marketCount"),
    categoryCount:$("categoryCount"),
    categoryPreview:$("categoryPreview"),
    snapshotAge:$("snapshotAge"),
    cacheStatus:$("cacheStatus"),
    catalogStatus:$("catalogStatus"),
    marketList:$("marketList"),
    testPicksList:$("testPicksList"),
    pickCount:$("pickCount"),
    refreshBtn:$("refreshBtn"),
    resetTestBtn:$("resetTestBtn"),
    explainBtn:$("explainBtn"),
    explainBtnNav:$("explainBtnNav"),
    explainBackdrop:$("explainBackdrop"),
    closeExplain:$("closeExplain"),
    betBackdrop:$("betBackdrop"),
    closeBet:$("closeBet"),
    slipCategory:$("slipCategory"),
    slipEvent:$("slipEvent"),
    slipMarket:$("slipMarket"),
    slipSide:$("slipSide"),
    slipPrice:$("slipPrice"),
    slipOdds:$("slipOdds"),
    betWallet:$("betWallet"),
    betMax:$("betMax"),
    wagerValue:$("wagerValue"),
    wagerRange:$("wagerRange"),
    maxScale:$("maxScale"),
    fixedPrice:$("fixedPrice"),
    potentialReturn:$("potentialReturn"),
    potentialProfit:$("potentialProfit"),
    quoteNote:$("quoteNote"),
    lockPickBtn:$("lockPickBtn"),
    toast:$("toast")
  };

  let toastTimer = 0;
  let ageTimer = 0;

  function money(value) {
    return Math.max(
      0,
      Math.floor(
        Number(value) || 0
      )
    ).toLocaleString("en-US");
  }

  function cents(value) {
    const p = Number(value);

    if (!Number.isFinite(p)) {
      return "—";
    }

    return `${Math.round(p * 100)}¢`;
  }

  function americanText(value) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
      return "—";
    }

    return n > 0
      ? `+${n}`
      : String(n);
  }

  function compactNumber(value) {
    const n =
      Math.max(
        0,
        Number(value) || 0
      );

    return new Intl.NumberFormat(
      "en-US",
      {
        notation:"compact",
        maximumFractionDigits:1
      }
    ).format(n);
  }

  function formatDate(value) {
    const date =
      new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "No close time";
    }

    return date.toLocaleString(
      undefined,
      {
        month:"short",
        day:"numeric",
        hour:"numeric",
        minute:"2-digit"
      }
    );
  }

  function initials(value) {
    const words =
      String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    return (
      words.slice(0,2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() ||
      "EC"
    );
  }

  function showToast(message) {
    clearTimeout(toastTimer);

    els.toast.textContent =
      String(message || "");

    els.toast.classList.add("show");

    toastTimer =
      setTimeout(
        () =>
          els.toast.classList.remove(
            "show"
          ),
        2600
      );
  }

  function userKey(base) {
    const id =
      state.session.user?.id;

    return id
      ? `${base}:${id}`
      : null;
  }

  function loadLocalData() {
    if (!state.session.authenticated) {
      state.wallet = 0;
      state.picks = [];
      return;
    }

    const walletKey =
      userKey(
        "eastcoinKalshiTestWalletV1"
      );

    const picksKey =
      userKey(
        "eastcoinKalshiTestPicksV1"
      );

    const stored =
      localStorage.getItem(
        walletKey
      );

    state.wallet =
      stored == null
        ? STARTING_BALANCE
        : Math.max(
            0,
            Math.floor(
              Number(stored) || 0
            )
          );

    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(
            picksKey
          ) || "[]"
        );

      state.picks =
        Array.isArray(parsed)
          ? parsed
          : [];
    } catch {
      state.picks = [];
    }
  }

  function saveLocalData() {
    if (!state.session.authenticated) {
      return;
    }

    localStorage.setItem(
      userKey(
        "eastcoinKalshiTestWalletV1"
      ),
      String(state.wallet)
    );

    localStorage.setItem(
      userKey(
        "eastcoinKalshiTestPicksV1"
      ),
      JSON.stringify(
        state.picks
      )
    );
  }

  function resetLocalData() {
    if (!state.session.authenticated) {
      showToast(
        "Log in with Twitch first."
      );
      return;
    }

    state.wallet =
      STARTING_BALANCE;

    state.picks = [];
    saveLocalData();
    renderAll();

    showToast(
      "Kalshi test data reset to 1,000 ZCoins."
    );
  }

  function currentMax() {
    if (
      !state.session.authenticated ||
      state.wallet < 1
    ) {
      return 0;
    }

    return Math.min(
      state.wallet,
      Math.max(
        1,
        Math.floor(
          state.wallet * 0.15
        )
      ),
      HARD_MAX
    );
  }

  function existingPick(ticker) {
    return state.picks.find(
      (pick) =>
        String(pick.ticker) ===
        String(ticker)
    );
  }

  function marketByTicker(ticker) {
    return state.markets.find(
      (market) =>
        String(market.ticker) ===
        String(ticker)
    );
  }

  function sideData(market, side) {
    return side === "no"
      ? market?.no
      : market?.yes;
  }

  async function loadSession() {
    try {
      const response =
        await fetch(
          SESSION_ENDPOINT,
          {
            credentials:"same-origin",
            cache:"no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          `Session ${response.status}`
        );
      }

      const payload =
        await response.json();

      state.session = {
        authenticated:
          Boolean(
            payload.authenticated
          ),
        user:
          payload.user || null
      };
    } catch {
      state.session = {
        authenticated:false,
        user:null
      };
    }

    loadLocalData();
  }

  async function loadCatalog(
    announce = false
  ) {
    els.refreshBtn.disabled = true;

    try {
      const response =
        await fetch(
          CATALOG_ENDPOINT,
          {
            cache:"no-store"
          }
        );

      const payload =
        await response.json();

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.message ||
          `Kalshi ${response.status}`
        );
      }

      state.error = null;
      state.data = payload;
      state.markets =
        Array.isArray(
          payload.markets
        )
          ? payload.markets
          : [];

      if (announce) {
        showToast(
          payload.cache?.status === "HIT"
            ? "Using the current 30-second Kalshi snapshot."
            : "Kalshi markets refreshed."
        );
      }

      return payload;
    } catch (error) {
      state.error =
        String(
          error?.message ||
          "Kalshi markets could not be loaded."
        );

      state.data = null;
      state.markets = [];

      return null;
    } finally {
      els.refreshBtn.disabled = false;
      renderAll();
    }
  }

  function renderAuth() {
    const loggedIn =
      state.session.authenticated;

    document.body.classList.toggle(
      "logged-in",
      loggedIn
    );

    document.body.classList.toggle(
      "logged-out",
      !loggedIn
    );

    els.authCardLoggedOut.hidden =
      loggedIn;

    els.authCardLoggedIn.hidden =
      !loggedIn;

    if (
      loggedIn &&
      state.session.user
    ) {
      const user =
        state.session.user;

      els.navUserName.textContent =
        user.displayName ||
        user.login ||
        "EastCoin User";

      if (user.profileImageUrl) {
        els.navAvatar.innerHTML =
          `<img src="${user.profileImageUrl}" alt="">`;
      } else {
        els.navAvatar.textContent =
          initials(
            user.displayName ||
            user.login
          );
      }
    }
  }

  function renderSummary() {
    els.sidebarWallet.textContent =
      state.session.authenticated
        ? money(state.wallet)
        : "—";

    els.summaryWallet.textContent =
      state.session.authenticated
        ? `${money(state.wallet)} ZCoins`
        : "Sign in";

    els.marketCount.textContent =
      String(state.markets.length);

    const categories =
      [...new Set(
        state.markets.map(
          (market) =>
            market.category
        )
      )];

    els.categoryCount.textContent =
      String(categories.length);

    els.categoryPreview.textContent =
      categories.length
        ? categories.slice(0,4).join(" · ")
        : "No categories";

    updateSnapshotAge();
  }

  function updateSnapshotAge() {
    clearTimeout(ageTimer);

    const generated =
      Date.parse(
        state.data?.generatedAt || ""
      );

    if (!Number.isFinite(generated)) {
      els.snapshotAge.textContent = "—";
      return;
    }

    const seconds =
      Math.max(
        0,
        Math.floor(
          (Date.now() - generated) /
          1000
        )
      );

    els.snapshotAge.textContent =
      seconds < 60
        ? `${seconds}s ago`
        : `${Math.floor(seconds/60)}m ago`;

    els.cacheStatus.textContent =
      `${state.data?.cache?.status || "—"} · 30-second cache`;

    ageTimer =
      setTimeout(
        updateSnapshotAge,
        1000
      );
  }

  function marketCanPick(market) {
    const close =
      Date.parse(
        market.closeTime || ""
      );

    return (
      state.session.authenticated &&
      !existingPick(market.ticker) &&
      currentMax() >= 1 &&
      (
        !Number.isFinite(close) ||
        close > Date.now()
      )
    );
  }

  function sideButton(
    market,
    side
  ) {
    const data =
      sideData(market, side);

    const label =
      side === "yes"
        ? "YES"
        : "NO";

    return `
      <button
        class="kalshi-side"
        type="button"
        data-ticker="${market.ticker}"
        data-side="${side}"
        ${marketCanPick(market) ? "" : "disabled"}
      >
        <span class="kalshi-side-copy">
          <small>${label}</small>
          <strong>${side === "yes" ? market.yesLabel : market.noLabel}</strong>
        </span>
        <span class="kalshi-price">
          <strong>${cents(data?.ask)}</strong>
          <b>${americanText(data?.american)}</b>
          <small>ask · ${Number(data?.decimal || 0).toFixed(2)}x</small>
        </span>
      </button>
    `;
  }

  function renderMarkets() {
    if (state.error) {
      els.catalogStatus.textContent =
        "Kalshi public market data unavailable.";

      els.marketList.innerHTML = `
        <div class="kalshi-error">
          ${state.error}
        </div>
      `;

      return;
    }

    if (!state.markets.length) {
      els.catalogStatus.textContent =
        "No eligible open non-sports markets were returned.";

      els.marketList.innerHTML = `
        <div class="kalshi-empty">
          Kalshi returned no open non-sports markets with executable YES and NO asks.
        </div>
      `;

      return;
    }

    els.catalogStatus.textContent =
      `${state.markets.length} live Kalshi markets · ${state.data?.selection?.eligibleEventCount || 0} eligible events scanned · category diversity first`;

    els.marketList.innerHTML =
      state.markets.map(
        (market, index) => {
          const pick =
            existingPick(
              market.ticker
            );

          return `
            <article class="kalshi-market">
              <header class="kalshi-market-head">
                <div class="kalshi-market-title">
                  <span class="kalshi-category">${market.category}</span>
                  <strong>${index + 1}. ${market.eventTitle}</strong>
                  <small>${market.marketTitle}${market.subtitle && market.subtitle !== market.marketTitle ? ` · ${market.subtitle}` : ""}</small>
                </div>
                <div class="kalshi-close">
                  <strong>${formatDate(market.closeTime)}</strong>
                  <small>market close</small>
                </div>
              </header>

              <div class="kalshi-sides">
                ${sideButton(market,"yes")}
                ${sideButton(market,"no")}
              </div>

              <footer class="kalshi-market-foot">
                <span class="kalshi-stat">Volume ${compactNumber(market.volume)}</span>
                <span class="kalshi-stat">24h ${compactNumber(market.volume24h)}</span>
                <span class="kalshi-stat">Liquidity $${compactNumber(market.liquidityDollars)}</span>
                <span class="kalshi-stat">Spread ${(Number(market.spreadDollars || 0)*100).toFixed(0)}¢</span>
                ${pick ? `<span class="kalshi-stat kalshi-pick-note">✓ Locked ${pick.side.toUpperCase()} ${cents(pick.price)}</span>` : ""}
              </footer>
            </article>
          `;
        }
      ).join("");

    els.marketList
      .querySelectorAll(
        "[data-ticker][data-side]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openBet(
                button.dataset.ticker,
                button.dataset.side
              )
          );
        }
      );
  }

  function renderPicks() {
    els.pickCount.textContent =
      String(state.picks.length);

    if (!state.session.authenticated) {
      els.testPicksList.innerHTML = `
        <div class="kalshi-empty">
          Log in with Twitch to create local Kalshi test Picks.
        </div>
      `;
      return;
    }

    if (!state.picks.length) {
      els.testPicksList.innerHTML = `
        <div class="kalshi-empty">
          No Kalshi test Picks yet.
        </div>
      `;
      return;
    }

    els.testPicksList.innerHTML =
      [...state.picks]
        .sort(
          (a,b) =>
            b.lockedAt - a.lockedAt
        )
        .map(
          (pick) => `
            <article class="kalshi-test-pick">
              <div>
                <small>${pick.category} · ${new Date(pick.lockedAt).toLocaleString()}</small>
                <strong>${pick.eventTitle}</strong>
                <div class="kalshi-pick-tags">
                  <span>${pick.side.toUpperCase()}</span>
                  <span class="locked">${cents(pick.price)} · ${americanText(pick.american)}</span>
                  <span>${money(pick.wager)} wagered</span>
                </div>
              </div>
              <div class="kalshi-pick-return">
                <span>Potential Return</span>
                <strong>${money(pick.potentialReturn)} ZCoins</strong>
                <small>+${money(pick.potentialProfit)} profit</small>
              </div>
            </article>
          `
        ).join("");
  }

  function renderAll() {
    renderAuth();
    renderSummary();
    renderMarkets();
    renderPicks();
  }

  function openBackdrop(node) {
    node.classList.add("open");
    node.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function closeBackdrop(node) {
    node.classList.remove("open");
    node.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function openBet(
    ticker,
    side
  ) {
    if (!state.session.authenticated) {
      location.href =
        `/api/picks/auth/twitch/start?returnTo=${encodeURIComponent("/picks-kalshi-test.html")}`;
      return;
    }

    const market =
      marketByTicker(ticker);

    if (
      !market ||
      existingPick(ticker)
    ) {
      return;
    }

    const max =
      currentMax();

    if (max < 1) {
      showToast(
        "Your test wallet has no available ZCoins."
      );
      return;
    }

    state.activeTicker =
      ticker;
    state.activeSide =
      side;
    state.quotePrice =
      Number(
        sideData(
          market,
          side
        )?.ask
      );

    els.slipCategory.textContent =
      market.category;
    els.slipEvent.textContent =
      market.eventTitle;
    els.slipMarket.textContent =
      market.marketTitle;
    els.slipSide.textContent =
      side.toUpperCase();

    els.betWallet.textContent =
      `${money(state.wallet)} ZCoins`;
    els.betMax.textContent =
      `${money(max)} ZCoins`;

    els.wagerRange.min = "1";
    els.wagerRange.max =
      String(max);
    els.wagerRange.value =
      String(
        Math.min(10,max)
      );
    els.maxScale.textContent =
      `${money(max)} max`;

    els.quoteNote.classList.remove(
      "moved"
    );
    els.quoteNote.textContent =
      "EastCoin will request this exact Kalshi market again before the Pick locks.";

    updateSlip();
    openBackdrop(
      els.betBackdrop
    );
  }

  function quoteAmerican(price) {
    const p =
      Number(price);

    if (
      !Number.isFinite(p) ||
      p <= 0 ||
      p >= 1
    ) {
      return null;
    }

    if (Math.abs(p-.5) < .000001) {
      return 100;
    }

    return p < .5
      ? Math.round(
          100*(1-p)/p
        )
      : -Math.round(
          100*p/(1-p)
        );
  }

  function updateSlip() {
    const price =
      Number(
        state.quotePrice
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return;
    }

    const wager =
      Math.max(
        1,
        Math.floor(
          Number(
            els.wagerRange.value
          ) || 1
        )
      );

    const decimal =
      1 / price;

    const totalReturn =
      Math.floor(
        wager * decimal +
        1e-9
      );

    const profit =
      Math.max(
        0,
        totalReturn - wager
      );

    const american =
      quoteAmerican(price);

    els.slipPrice.textContent =
      cents(price);
    els.fixedPrice.textContent =
      cents(price);
    els.slipOdds.textContent =
      americanText(american);
    els.wagerValue.textContent =
      `${money(wager)} ZCoin${wager===1?"":"s"}`;
    els.potentialReturn.textContent =
      `${money(totalReturn)} ZCoins`;
    els.potentialProfit.textContent =
      `+${money(profit)} ZCoins`;
  }

  async function lockPick() {
    const market =
      marketByTicker(
        state.activeTicker
      );

    if (!market) return;

    els.lockPickBtn.disabled = true;
    els.lockPickBtn.textContent =
      "Checking Kalshi…";

    try {
      const response =
        await fetch(
          `${QUOTE_ENDPOINT}?ticker=${encodeURIComponent(market.ticker)}`,
          {
            cache:"no-store"
          }
        );

      const payload =
        await response.json();

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.message ||
          "Fresh Kalshi quote failed."
        );
      }

      if (!payload.market?.open) {
        throw new Error(
          "This Kalshi market is no longer open."
        );
      }

      const fresh =
        state.activeSide === "no"
          ? payload.market.no
          : payload.market.yes;

      const freshPrice =
        Number(
          fresh?.ask
        );

      if (
        !Number.isFinite(
          freshPrice
        )
      ) {
        throw new Error(
          "The selected side no longer has an executable ask."
        );
      }

      const previous =
        Number(
          state.quotePrice
        );

      if (
        Number.isFinite(previous) &&
        Math.abs(
          freshPrice - previous
        ) >= 0.005
      ) {
        state.quotePrice =
          freshPrice;

        updateSlip();

        els.quoteNote.classList.add(
          "moved"
        );

        els.quoteNote.textContent =
          `Kalshi moved from ${cents(previous)} to ${cents(freshPrice)}. Review the new ${americanText(fresh.american)} line and click Lock again.`;

        showToast(
          "Kalshi price moved — review the new quote."
        );

        return;
      }

      if (
        existingPick(
          market.ticker
        )
      ) {
        throw new Error(
          "You already picked this market."
        );
      }

      const max =
        currentMax();

      let wager =
        Math.floor(
          Number(
            els.wagerRange.value
          ) || 1
        );

      wager =
        Math.max(
          1,
          Math.min(
            wager,
            max,
            state.wallet
          )
        );

      if (wager < 1) {
        throw new Error(
          "Your test wallet cannot cover the wager."
        );
      }

      const decimal =
        1 / freshPrice;

      const totalReturn =
        Math.floor(
          wager * decimal +
          1e-9
        );

      const profit =
        Math.max(
          0,
          totalReturn - wager
        );

      const pick = {
        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        ticker:
          market.ticker,
        eventTicker:
          market.eventTicker,
        category:
          market.category,
        eventTitle:
          market.eventTitle,
        marketTitle:
          market.marketTitle,
        side:
          state.activeSide,
        price:
          freshPrice,
        american:
          fresh.american,
        decimal,
        wager,
        potentialReturn:
          totalReturn,
        potentialProfit:
          profit,
        closeTime:
          payload.market.closeTime,
        lockedAt:
          Date.now()
      };

      state.wallet -= wager;
      state.picks.push(pick);
      saveLocalData();

      closeBackdrop(
        els.betBackdrop
      );

      state.activeTicker = null;
      state.activeSide = null;
      state.quotePrice = null;

      renderAll();

      showToast(
        `${pick.side.toUpperCase()} locked at ${cents(pick.price)} (${americanText(pick.american)}).`
      );
    } catch (error) {
      showToast(
        error?.message ||
        "Kalshi test Pick failed."
      );
    } finally {
      els.lockPickBtn.disabled = false;
      els.lockPickBtn.textContent =
        "Check & Lock Test Pick";
    }
  }

  function wireTabs() {
    document
      .querySelectorAll("[data-view]")
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const view =
                button.dataset.view;

              document
                .querySelectorAll("[data-view]")
                .forEach(
                  (item) =>
                    item.classList.toggle(
                      "active",
                      item === button
                    )
                );

              document
                .querySelectorAll("[data-view-panel]")
                .forEach(
                  (panel) =>
                    panel.classList.toggle(
                      "active",
                      panel.dataset.viewPanel === view
                    )
                );
            }
          );
        }
      );
  }

  function wireEvents() {
    document
      .querySelectorAll("[data-login]")
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              location.href =
                `/api/picks/auth/twitch/start?returnTo=${encodeURIComponent("/picks-kalshi-test.html")}`;
            }
          );
        }
      );

    els.logoutBtn.addEventListener(
      "click",
      async () => {
        try {
          await fetch(
            "/api/picks/auth/logout",
            {
              method:"POST",
              credentials:"same-origin"
            }
          );
        } finally {
          location.reload();
        }
      }
    );

    els.refreshBtn.addEventListener(
      "click",
      () =>
        loadCatalog(true)
    );

    els.resetTestBtn.addEventListener(
      "click",
      () => {
        if (
          confirm(
            "Reset the Kalshi test wallet to 1,000 ZCoins and delete all Kalshi test Picks?"
          )
        ) {
          resetLocalData();
        }
      }
    );

    const openExplain =
      () =>
        openBackdrop(
          els.explainBackdrop
        );

    els.explainBtn.addEventListener(
      "click",
      openExplain
    );

    els.explainBtnNav.addEventListener(
      "click",
      openExplain
    );

    els.closeExplain.addEventListener(
      "click",
      () =>
        closeBackdrop(
          els.explainBackdrop
        )
    );

    els.closeBet.addEventListener(
      "click",
      () =>
        closeBackdrop(
          els.betBackdrop
        )
    );

    els.explainBackdrop.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          els.explainBackdrop
        ) {
          closeBackdrop(
            els.explainBackdrop
          );
        }
      }
    );

    els.betBackdrop.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          els.betBackdrop
        ) {
          closeBackdrop(
            els.betBackdrop
          );
        }
      }
    );

    els.wagerRange.addEventListener(
      "input",
      updateSlip
    );

    els.lockPickBtn.addEventListener(
      "click",
      lockPick
    );
  }

  async function init() {
    wireTabs();
    wireEvents();

    await Promise.all([
      loadSession(),
      loadCatalog(false)
    ]);

    renderAll();
  }

  init();
})();

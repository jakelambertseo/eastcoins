(() => {
  "use strict";

  const ODDS_ENDPOINT =
    "/api/picks-odds/nfl";

  const SESSION_ENDPOINT =
    "/api/picks/auth/session-health";

  const TEST_STARTING_BALANCE = 1000;
  const HARD_MAX_WAGER = 50;

  const state = {
    session: {
      authenticated: false,
      user: null
    },
    data: null,
    games: [],
    oddsError: null,
    picks: [],
    wallet: 0,
    activeGameId: null,
    activeSide: null
  };

  const $ = (id) =>
    document.getElementById(id);

  const els = {
    authCardLoggedOut:
      $("authCardLoggedOut"),
    authCardLoggedIn:
      $("authCardLoggedIn"),
    navAvatar:
      $("navAvatar"),
    navUserName:
      $("navUserName"),
    logoutBtn:
      $("logoutBtn"),
    sidebarWallet:
      $("sidebarWallet"),
    summaryWallet:
      $("summaryWallet"),
    gameCount:
      $("gameCount"),
    oddsAge:
      $("oddsAge"),
    cacheStatus:
      $("cacheStatus"),
    creditsRemaining:
      $("creditsRemaining"),
    creditsUsed:
      $("creditsUsed"),
    marketList:
      $("marketList"),
    testPicksList:
      $("testPicksList"),
    pickCount:
      $("pickCount"),
    catalogStatus:
      $("catalogStatus"),
    refreshBtn:
      $("refreshBtn"),
    resetTestBtn:
      $("resetTestBtn"),
    methodBtn:
      $("methodBtn"),
    navMethodBtn:
      $("navMethodBtn"),
    methodBackdrop:
      $("methodBackdrop"),
    closeMethod:
      $("closeMethod"),
    betBackdrop:
      $("betBackdrop"),
    closeBet:
      $("closeBet"),
    slipGameTime:
      $("slipGameTime"),
    slipMatchup:
      $("slipMatchup"),
    slipTeam:
      $("slipTeam"),
    slipOdds:
      $("slipOdds"),
    betWallet:
      $("betWallet"),
    betMax:
      $("betMax"),
    wagerValue:
      $("wagerValue"),
    wagerRange:
      $("wagerRange"),
    maxScale:
      $("maxScale"),
    fixedOdds:
      $("fixedOdds"),
    potentialReturn:
      $("potentialReturn"),
    potentialProfit:
      $("potentialProfit"),
    quoteNote:
      $("quoteNote"),
    lockPickBtn:
      $("lockPickBtn"),
    toast:
      $("toast")
  };

  let toastTimer = 0;
  let ageTimer = 0;

  function initials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "NFL";

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 3)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }

  function money(value) {
    return Math.max(
      0,
      Math.floor(Number(value) || 0)
    ).toLocaleString("en-US");
  }

  function americanText(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "—";
    }

    return number > 0
      ? `+${number}`
      : String(number);
  }

  function americanToDecimal(value) {
    const odds = Number(value);

    if (!Number.isFinite(odds) || odds === 0) {
      return 1;
    }

    return odds > 0
      ? 1 + odds / 100
      : 1 + 100 / Math.abs(odds);
  }

  function formatProbability(value) {
    const p = Number(value);

    if (!Number.isFinite(p)) {
      return "—";
    }

    return `${(p * 100).toFixed(1)}%`;
  }

  function formatGameTime(value) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "Time unavailable";
    }

    return date.toLocaleString(
      undefined,
      {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  }

  function timeUntil(value) {
    const ms =
      new Date(value).getTime() -
      Date.now();

    if (ms <= 0) return "Kickoff";

    const mins =
      Math.ceil(ms / 60000);

    if (mins < 60) {
      return `Locks in ${mins}m`;
    }

    const hours =
      Math.floor(mins / 60);

    if (hours < 24) {
      const remainder =
        mins % 60;

      return `Locks in ${hours}h ${remainder}m`;
    }

    const days =
      Math.floor(hours / 24);

    return `Locks in ${days}d`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);

    els.toast.textContent =
      String(message || "");

    els.toast.classList.add("show");

    toastTimer = setTimeout(
      () => {
        els.toast.classList.remove(
          "show"
        );
      },
      2600
    );
  }

  function userKey(base) {
    const userId =
      state.session.user?.id;

    if (!userId) return null;

    return `${base}:${userId}`;
  }

  function loadLocalTestData() {
    if (!state.session.authenticated) {
      state.wallet = 0;
      state.picks = [];
      return;
    }

    const walletKey =
      userKey(
        "eastcoinOddsTestWalletV1"
      );

    const picksKey =
      userKey(
        "eastcoinOddsTestPicksV1"
      );

    const storedWallet =
      localStorage.getItem(walletKey);

    if (storedWallet == null) {
      state.wallet =
        TEST_STARTING_BALANCE;
    } else {
      state.wallet = Math.max(
        0,
        Math.floor(
          Number(storedWallet) || 0
        )
      );
    }

    try {
      const parsed = JSON.parse(
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

  function saveLocalTestData() {
    if (!state.session.authenticated) {
      return;
    }

    localStorage.setItem(
      userKey(
        "eastcoinOddsTestWalletV1"
      ),
      String(state.wallet)
    );

    localStorage.setItem(
      userKey(
        "eastcoinOddsTestPicksV1"
      ),
      JSON.stringify(state.picks)
    );
  }

  function resetLocalTestData() {
    if (!state.session.authenticated) {
      showToast(
        "Log in with Twitch before resetting test data."
      );
      return;
    }

    localStorage.removeItem(
      userKey(
        "eastcoinOddsTestWalletV1"
      )
    );

    localStorage.removeItem(
      userKey(
        "eastcoinOddsTestPicksV1"
      )
    );

    state.wallet =
      TEST_STARTING_BALANCE;

    state.picks = [];

    saveLocalTestData();
    renderAll();

    showToast(
      "Test wallet restored to 1,000 ZCoins."
    );
  }

  function currentMaxWager() {
    if (!state.session.authenticated) {
      return 0;
    }

    if (state.wallet < 1) {
      return 0;
    }

    const personalMax =
      Math.max(
        1,
        Math.floor(
          state.wallet * 0.15
        )
      );

    return Math.min(
      state.wallet,
      personalMax,
      HARD_MAX_WAGER
    );
  }

  function existingPick(gameId) {
    return state.picks.find(
      (pick) =>
        String(pick.gameId) ===
        String(gameId)
    );
  }

  function gameById(gameId) {
    return state.games.find(
      (game) =>
        String(game.id) ===
        String(gameId)
    );
  }

  function sideData(game, side) {
    if (!game) return null;

    if (side === "home") {
      return {
        team: game.homeTeam,
        opponent: game.awayTeam,
        odds:
          game.consensus?.home
      };
    }

    return {
      team: game.awayTeam,
      opponent: game.homeTeam,
      odds:
        game.consensus?.away
    };
  }

  function canPick(game) {
    return (
      state.session.authenticated &&
      new Date(game.commenceTime).getTime() >
        Date.now() &&
      !existingPick(game.id) &&
      currentMaxWager() >= 1
    );
  }

  async function loadSession() {
    try {
      const response =
        await fetch(
          SESSION_ENDPOINT,
          {
            credentials: "same-origin",
            cache: "no-store"
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
    } catch (error) {
      console.warn(
        "EastCoin session check failed",
        error
      );

      state.session = {
        authenticated: false,
        user: null
      };
    }

    loadLocalTestData();
    renderAuth();
    renderWallet();
  }

  async function loadOdds(
    announce = false
  ) {
    els.refreshBtn.disabled = true;

    if (announce) {
      els.catalogStatus.textContent =
        "Checking the latest 60-second NFL consensus snapshot…";
    }

    try {
      const response =
        await fetch(
          ODDS_ENDPOINT,
          {
            cache: "no-store",
            credentials: "same-origin"
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
          `Odds ${response.status}`
        );
      }

      state.oddsError = null;
      state.data = payload;
      state.games =
        Array.isArray(payload.games)
          ? payload.games
          : [];

      renderAll();

      if (announce) {
        showToast(
          payload.cache?.status === "HIT"
            ? "Using the current cached odds snapshot."
            : "NFL odds refreshed from The Odds API."
        );
      }

      return payload;
    } catch (error) {
      console.error(
        "NFL odds load failed",
        error
      );

      state.oddsError =
        String(
          error?.message ||
          "NFL odds could not be loaded."
        );

      state.data = null;
      state.games = [];

      renderAll();

      return null;
    } finally {
      els.refreshBtn.disabled = false;
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

      const avatarUrl =
        String(
          user.profileImageUrl || ""
        );

      if (avatarUrl) {
        els.navAvatar.innerHTML =
          `<img src="${avatarUrl}" alt="" referrerpolicy="no-referrer">`;
      } else {
        els.navAvatar.textContent =
          initials(
            user.displayName ||
            user.login
          );
      }
    }
  }

  function renderWallet() {
    const display =
      state.session.authenticated
        ? money(state.wallet)
        : "—";

    els.sidebarWallet.textContent =
      display;

    els.summaryWallet.textContent =
      state.session.authenticated
        ? `${display} ZCoins`
        : "Sign in";
  }

  function renderSummary() {
    renderWallet();

    els.gameCount.textContent =
      String(state.games.length);

    const quota =
      state.data?.quota || {};

    els.creditsRemaining.textContent =
      quota.remaining ?? "—";

    els.creditsUsed.textContent =
      quota.used != null
        ? `${quota.used} used · last request ${quota.lastCost ?? "—"}`
        : "Usage unavailable";

    updateOddsAge();
  }

  function updateOddsAge() {
    clearTimeout(ageTimer);

    const generated =
      Date.parse(
        state.data?.generatedAt || ""
      );

    if (!Number.isFinite(generated)) {
      els.oddsAge.textContent = "—";
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

    els.oddsAge.textContent =
      seconds < 60
        ? `${seconds}s ago`
        : `${Math.floor(seconds / 60)}m ago`;

    els.cacheStatus.textContent =
      `${state.data?.cache?.status || "—"} · 60-second edge cache`;

    ageTimer = setTimeout(
      updateOddsAge,
      1000
    );
  }

  function booksMarkup(game) {
    const books =
      Array.isArray(game.bookmakers)
        ? game.bookmakers
        : [];

    if (!books.length) {
      return "";
    }

    return `
      <details class="book-details">
        <summary>
          <span>Compare ${books.length} US bookmaker lines</span>
          <span>⌄</span>
        </summary>
        <table class="book-table">
          <thead>
            <tr>
              <th>Book</th>
              <th>${game.awayTeam}</th>
              <th>${game.homeTeam}</th>
            </tr>
          </thead>
          <tbody>
            ${books.map(
              (book) => `
                <tr>
                  <td>${book.title}</td>
                  <td class="price">${americanText(book.away?.american)}</td>
                  <td class="price">${americanText(book.home?.american)}</td>
                </tr>
              `
            ).join("")}
          </tbody>
        </table>
      </details>
    `;
  }

  function choiceMarkup(
    game,
    side
  ) {
    const data =
      sideData(game, side);

    const odds =
      data?.odds;

    const disabled =
      !canPick(game);

    const role =
      side === "away"
        ? "Away"
        : "Home";

    return `
      <button
        class="odds-choice"
        type="button"
        data-pick-game="${game.id}"
        data-pick-side="${side}"
        ${disabled ? "disabled" : ""}
      >
        <span class="team-mark">${initials(data.team)}</span>
        <span class="odds-choice-copy">
          <small>${role}</small>
          <strong>${data.team}</strong>
        </span>
        <span class="odds-price">
          <strong>${americanText(odds?.american)}</strong>
          <small>${formatProbability(odds?.fairProbability)} fair</small>
        </span>
      </button>
    `;
  }

  function renderMarkets() {
    if (state.oddsError) {
      els.marketList.innerHTML = `
        <div class="odds-error">
          <strong>NFL odds request failed.</strong>
          <div>${state.oddsError}</div>
          <small>Open /api/picks-odds/provider-check for provider diagnostics.</small>
        </div>
      `;

      els.catalogStatus.textContent =
        "NFL odds unavailable — provider diagnostics needed.";

      return;
    }

    if (!state.games.length) {
      els.marketList.innerHTML = `
        <div class="odds-empty">
          No upcoming NFL games with US h2h consensus odds are currently available.
        </div>
      `;

      els.catalogStatus.textContent =
        "The provider returned no eligible upcoming NFL moneylines.";

      return;
    }

    els.catalogStatus.textContent =
      `${state.games.length} upcoming NFL games · median no-vig consensus · ${state.data?.cache?.status || "cache"} snapshot`;

    els.marketList.innerHTML =
      state.games.map(
        (game) => {
          const locked =
            new Date(
              game.commenceTime
            ).getTime() <= Date.now();

          const pick =
            existingPick(game.id);

          const bookCount =
            game.consensus?.home?.bookCount ||
            game.bookmakers?.length ||
            0;

          return `
            <article class="odds-market ${locked ? "locked" : ""}">
              <header class="odds-market-head">
                <div class="odds-market-head-left">
                  <span class="nfl-chip">NFL</span>
                  <span class="odds-market-time">
                    <strong>${formatGameTime(game.commenceTime)}</strong>
                    <small>${locked ? "Closed" : timeUntil(game.commenceTime)}</small>
                  </span>
                </div>
                <span class="consensus-chip">${bookCount} books · no-vig median</span>
              </header>

              <div class="odds-teams">
                ${choiceMarkup(game, "away")}
                ${choiceMarkup(game, "home")}
              </div>

              <div class="odds-market-footer">
                ${pick ? `
                  <span class="existing-pick-note">
                    ✓ Test Pick locked: ${pick.team} ${americanText(pick.odds)}
                  </span>
                ` : ""}
                ${booksMarkup(game)}
              </div>
            </article>
          `;
        }
      ).join("");

    els.marketList
      .querySelectorAll(
        "[data-pick-game]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              openBet(
                button.dataset.pickGame,
                button.dataset.pickSide
              );
            }
          );
        }
      );
  }

  function renderTestPicks() {
    els.pickCount.textContent =
      String(state.picks.length);

    if (!state.session.authenticated) {
      els.testPicksList.innerHTML = `
        <div class="odds-empty">
          Log in with Twitch to create local NFL test Picks.
        </div>
      `;
      return;
    }

    if (!state.picks.length) {
      els.testPicksList.innerHTML = `
        <div class="odds-empty">
          You have not locked any NFL odds test Picks yet.
        </div>
      `;
      return;
    }

    els.testPicksList.innerHTML =
      [...state.picks]
        .sort(
          (a, b) =>
            Number(b.lockedAt || 0) -
            Number(a.lockedAt || 0)
        )
        .map(
          (pick) => `
            <article class="test-pick">
              <div class="test-pick-main">
                <small>${formatGameTime(pick.commenceTime)} · locked ${new Date(pick.lockedAt).toLocaleString()}</small>
                <strong>${pick.team} over ${pick.opponent}</strong>
                <div class="test-pick-line">
                  <span class="pick-odds">${americanText(pick.odds)} fixed</span>
                  <span>${money(pick.wager)} wagered</span>
                  <span>${Number(pick.decimalOdds).toFixed(3)}x return</span>
                </div>
              </div>
              <div class="test-pick-return">
                <span>Potential Return</span>
                <strong>${money(pick.potentialReturn)} ZCoins</strong>
                <small>+${money(pick.potentialProfit)} profit</small>
              </div>
            </article>
          `
        )
        .join("");
  }

  function renderAll() {
    renderAuth();
    renderSummary();
    renderMarkets();
    renderTestPicks();
  }

  function openBackdrop(element) {
    element.classList.add("open");
    element.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function closeBackdrop(element) {
    element.classList.remove("open");
    element.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function openBet(
    gameId,
    side
  ) {
    if (!state.session.authenticated) {
      location.href =
        `/api/picks/auth/twitch/start?returnTo=${encodeURIComponent("/picks-odds-test.html")}`;
      return;
    }

    const game =
      gameById(gameId);

    if (!game) return;

    if (
      new Date(
        game.commenceTime
      ).getTime() <= Date.now()
    ) {
      showToast(
        "This game has reached kickoff and is closed."
      );
      renderMarkets();
      return;
    }

    if (existingPick(gameId)) {
      showToast(
        "You already have a test Pick on this game."
      );
      return;
    }

    const max =
      currentMaxWager();

    if (max < 1) {
      showToast(
        "Your test wallet has no available ZCoins."
      );
      return;
    }

    state.activeGameId =
      String(gameId);

    state.activeSide =
      side;

    const data =
      sideData(game, side);

    els.slipGameTime.textContent =
      formatGameTime(
        game.commenceTime
      );

    els.slipMatchup.textContent =
      `${game.awayTeam} @ ${game.homeTeam}`;

    els.slipTeam.textContent =
      data.team;

    els.slipOdds.textContent =
      americanText(
        data.odds?.american
      );

    els.betWallet.textContent =
      `${money(state.wallet)} ZCoins`;

    els.betMax.textContent =
      `${money(max)} ZCoins`;

    els.wagerRange.min = "1";
    els.wagerRange.max =
      String(max);

    els.wagerRange.value =
      String(
        Math.min(10, max)
      );

    els.maxScale.textContent =
      `${money(max)} max`;

    updateSlip();

    openBackdrop(
      els.betBackdrop
    );
  }

  function updateSlip() {
    const game =
      gameById(
        state.activeGameId
      );

    const data =
      sideData(
        game,
        state.activeSide
      );

    if (!data?.odds) return;

    const wager =
      Math.max(
        1,
        Math.floor(
          Number(
            els.wagerRange.value
          ) || 1
        )
      );

    const american =
      Number(
        data.odds.american
      );

    const decimal =
      americanToDecimal(
        american
      );

    const totalReturn =
      Math.floor(
        wager * decimal + 1e-9
      );

    const profit =
      Math.max(
        0,
        totalReturn - wager
      );

    els.wagerValue.textContent =
      `${money(wager)} ZCoin${wager === 1 ? "" : "s"}`;

    els.fixedOdds.textContent =
      americanText(american);

    els.potentialReturn.textContent =
      `${money(totalReturn)} ZCoins`;

    els.potentialProfit.textContent =
      `+${money(profit)} ZCoins`;
  }

  async function lockTestPick() {
    if (
      !state.activeGameId ||
      !state.activeSide
    ) {
      return;
    }

    els.lockPickBtn.disabled = true;
    els.lockPickBtn.textContent =
      "Checking latest line…";

    try {
      // Pull the latest available server snapshot immediately before
      // locking. The server itself is rate-protected by the 60s cache.
      const latest =
        await loadOdds(false);

      if (!latest) {
        throw new Error(
          "Could not verify the latest odds."
        );
      }

      const game =
        gameById(
          state.activeGameId
        );

      if (!game) {
        throw new Error(
          "This game is no longer available."
        );
      }

      if (
        new Date(
          game.commenceTime
        ).getTime() <= Date.now()
      ) {
        throw new Error(
          "Kickoff has arrived. This game is closed."
        );
      }

      if (
        existingPick(game.id)
      ) {
        throw new Error(
          "You already have a test Pick on this game."
        );
      }

      const max =
        currentMaxWager();

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
            max
          )
        );

      if (
        wager > state.wallet ||
        max < 1
      ) {
        throw new Error(
          "Your test wallet cannot cover this wager."
        );
      }

      const data =
        sideData(
          game,
          state.activeSide
        );

      const american =
        Number(
          data.odds?.american
        );

      if (!Number.isFinite(american)) {
        throw new Error(
          "The current consensus line is unavailable."
        );
      }

      const decimal =
        americanToDecimal(
          american
        );

      const totalReturn =
        Math.floor(
          wager * decimal + 1e-9
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
        gameId:
          String(game.id),
        side:
          state.activeSide,
        team:
          data.team,
        opponent:
          data.opponent,
        wager,
        odds:
          american,
        decimalOdds:
          decimal,
        potentialReturn:
          totalReturn,
        potentialProfit:
          profit,
        lockedAt:
          Date.now(),
        sourceGeneratedAt:
          latest.generatedAt,
        commenceTime:
          game.commenceTime
      };

      state.wallet -= wager;
      state.picks.push(pick);

      saveLocalTestData();

      closeBackdrop(
        els.betBackdrop
      );

      state.activeGameId = null;
      state.activeSide = null;

      renderAll();

      showToast(
        `${pick.team} ${americanText(pick.odds)} locked for ${money(pick.wager)} test ZCoins.`
      );
    } catch (error) {
      showToast(
        error?.message ||
        "The test Pick could not be locked."
      );
    } finally {
      els.lockPickBtn.disabled = false;
      els.lockPickBtn.textContent =
        "Lock Test Pick";
    }
  }

  function wireTabs() {
    document
      .querySelectorAll(
        "[data-view]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const view =
                button.dataset.view;

              document
                .querySelectorAll(
                  "[data-view]"
                )
                .forEach(
                  (item) =>
                    item.classList.toggle(
                      "active",
                      item === button
                    )
                );

              document
                .querySelectorAll(
                  "[data-view-panel]"
                )
                .forEach(
                  (panel) =>
                    panel.classList.toggle(
                      "active",
                      panel.dataset.viewPanel ===
                        view
                    )
                );
            }
          );
        }
      );
  }

  function wireEvents() {
    document
      .querySelectorAll(
        "[data-login]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              location.href =
                `/api/picks/auth/twitch/start?returnTo=${encodeURIComponent("/picks-odds-test.html")}`;
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
              method: "POST",
              credentials: "same-origin"
            }
          );
        } finally {
          location.reload();
        }
      }
    );

    els.refreshBtn.addEventListener(
      "click",
      () => loadOdds(true)
    );

    els.resetTestBtn.addEventListener(
      "click",
      () => {
        if (
          confirm(
            "Reset your local NFL odds test wallet to 1,000 ZCoins and delete all test Picks?"
          )
        ) {
          resetLocalTestData();
        }
      }
    );

    const openMethod =
      () => openBackdrop(
        els.methodBackdrop
      );

    els.methodBtn.addEventListener(
      "click",
      openMethod
    );

    els.navMethodBtn.addEventListener(
      "click",
      openMethod
    );

    els.closeMethod.addEventListener(
      "click",
      () => closeBackdrop(
        els.methodBackdrop
      )
    );

    els.closeBet.addEventListener(
      "click",
      () => closeBackdrop(
        els.betBackdrop
      )
    );

    els.methodBackdrop.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          els.methodBackdrop
        ) {
          closeBackdrop(
            els.methodBackdrop
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
      lockTestPick
    );
  }

  async function init() {
    wireTabs();
    wireEvents();

    await Promise.all([
      loadSession(),
      loadOdds(false)
    ]);

    renderAll();
  }

  init();
})();

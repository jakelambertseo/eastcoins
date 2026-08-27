(() => {
  "use strict";

  const V2 = window.ECV2;
  const $ = V2.$;

  const els = {
    modal: $("#quickBetModal"),
    close: $("#quickBetClose"),
    title: $("#quickBetTitle"),
    start: $("#quickBetStart"),
    loading: $("#quickBetLoading"),
    loadingMeta: $("#quickBetLoadingMeta"),
    body: $("#quickBetBody"),
    error: $("#quickBetError"),
    errorTitle: $("#quickBetErrorTitle"),
    errorText: $("#quickBetErrorText"),
    reference: $("#quickBetReference"),
    awayML: $("#quickBetAwayML"),
    homeML: $("#quickBetHomeML"),
    away: $("#quickBetAway"),
    home: $("#quickBetHome"),
    awayLogo: $("#quickBetAwayLogo"),
    homeLogo: $("#quickBetHomeLogo"),
    awayName: $("#quickBetAwayName"),
    homeName: $("#quickBetHomeName"),
    awayProjection: $("#quickBetAwayProjection"),
    homeProjection: $("#quickBetHomeProjection"),
    range: $("#quickBetRange"),
    amount: $("#quickBetAmount"),
    wagerLabel: $("#quickBetWagerLabel"),
    wagerValue: $("#quickBetWagerValue"),
    min: $("#quickBetMin"),
    max: $("#quickBetMax"),
    previewStatus: $("#quickBetPreviewStatus"),
    wallet: $("#quickBetWallet"),
    multiplier: $("#quickBetMultiplier"),
    potentialReturn: $("#quickBetReturn"),
    note: $("#quickBetNote"),
    fullPicks: $("#quickBetFullPicks"),
    submit: $("#quickBetSubmit")
  };

  const state = {
    match: null,
    market: null,
    bootstrap: null,
    side: null,
    wager: 0,
    cardOdds: null,
    busy: false
  };

  const PREVIEW_MIN_WAGER = 1;
  const PREVIEW_MAX_WAGER = 50;
  const PREVIEW_DEFAULT_WAGER = 10;

  function money(value) {
    return Math.max(
      0,
      Math.floor(Number(value) || 0)
    ).toLocaleString("en-US");
  }

  function american(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number === 0) {
      return "—";
    }

    return number > 0
      ? `+${Math.round(number)}`
      : String(Math.round(number));
  }

  function badgeMarkup(team) {
    const url = V2.badge(team);

    if (url) {
      return `<img src="${V2.esc(url)}" alt="">`;
    }

    return `<span>${V2.esc(V2.initials(team?.name))}</span>`;
  }

  function openModal() {
    els.modal.classList.add("open");
    els.modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function close() {
    if (state.busy) return;

    els.modal.classList.remove("open");
    els.modal.setAttribute(
      "aria-hidden",
      "true"
    );

    reset();
  }

  function reset() {
    state.match = null;
    state.market = null;
    state.bootstrap = null;
    state.side = null;
    state.wager = PREVIEW_DEFAULT_WAGER;
    state.cardOdds = null;
    state.busy = false;

    els.body.hidden = true;
    els.error.hidden = true;
    els.loading.hidden = false;
    els.loadingMeta.textContent =
      "Verifying the game and loading Picks.";

    els.submit.disabled = true;
    els.submit.textContent = "Place Bet";

    els.away.classList.remove("selected");
    els.home.classList.remove("selected");
  }

  function showError(
    title,
    message
  ) {
    state.busy = false;
    els.loading.hidden = true;
    els.body.hidden = true;
    els.error.hidden = false;
    els.errorTitle.textContent =
      title || "Quick Bet unavailable";
    els.errorText.textContent =
      message ||
      "This Picks market could not be prepared.";
    els.submit.disabled = true;
  }

  function walletState() {
    const session =
      state.bootstrap?.session || {};

    const config =
      state.bootstrap?.config || {};

    const wallet =
      session.wallet || {};

    const balance = Math.max(
      0,
      Math.floor(Number(wallet.balance || 0))
    );

    const personalMax =
      balance >= 1
        ? Math.min(
            Math.floor(balance * 0.15),
            50
          )
        : 0;

    const serverMax = Math.floor(
      Number(
        wallet.maxWager ??
        config.maxWager ??
        0
      ) || 0
    );

    const max =
      serverMax > 0
        ? Math.min(
            balance,
            personalMax || serverMax,
            serverMax
          )
        : Math.min(
            balance,
            personalMax
          );

    return {
      authenticated:
        Boolean(session.authenticated),
      walletConnected:
        Boolean(wallet.connected),
      wageringEnabled:
        Boolean(config.wageringEnabled),
      balance,
      max: Math.max(0, max)
    };
  }

  function wagerLimits() {
    const config =
      state.bootstrap?.config || {};

    const wallet =
      walletState();

    if (
      wallet.authenticated &&
      wallet.walletConnected &&
      wallet.max >= 1
    ) {
      const serverMin =
        Math.max(
          1,
          Math.floor(
            Number(config.minWager || 1)
          )
        );

      return {
        preview: false,
        min: serverMin,
        max: Math.max(
          serverMin,
          wallet.max
        )
      };
    }

    return {
      preview: true,
      min: PREVIEW_MIN_WAGER,
      max: PREVIEW_MAX_WAGER
    };
  }

  function normalizeWager(value) {
    const limits = wagerLimits();

    return Math.min(
      limits.max,
      Math.max(
        limits.min,
        Math.floor(
          Number(value) || limits.min
        )
      )
    );
  }

  function poolSnapshot(
    side = state.side,
    wager = state.wager
  ) {
    const pool =
      state.market?.pool || {};

    let away = Number(pool.away || 0);
    let home = Number(pool.home || 0);
    let awayCount =
      Number(pool.awayCount || 0);
    let homeCount =
      Number(pool.homeCount || 0);

    if (side === "away" && wager > 0) {
      away += wager;
      awayCount += 1;
    }

    if (side === "home" && wager > 0) {
      home += wager;
      homeCount += 1;
    }

    const total = away + home;
    const active =
      away > 0 &&
      home > 0 &&
      awayCount + homeCount >= 2;

    return {
      away,
      home,
      total,
      active,
      awayMultiplier:
        active
          ? total / away
          : 2,
      homeMultiplier:
        active
          ? total / home
          : 2
    };
  }

  function sideMultiplier(side) {
    const snapshot = poolSnapshot(
      side,
      state.wager
    );

    return side === "away"
      ? snapshot.awayMultiplier
      : snapshot.homeMultiplier;
  }

  function renderProjectionLabels() {
    const away = poolSnapshot(
      "away",
      Math.max(1, state.wager || 1)
    );

    const home = poolSnapshot(
      "home",
      Math.max(1, state.wager || 1)
    );

    els.awayProjection.textContent =
      `${away.awayMultiplier.toFixed(2)}x`;

    els.homeProjection.textContent =
      `${home.homeMultiplier.toFixed(2)}x`;
  }

  function renderTicket() {
    const wallet = walletState();
    const limits = wagerLimits();

    els.away.classList.toggle(
      "selected",
      state.side === "away"
    );

    els.home.classList.toggle(
      "selected",
      state.side === "home"
    );

    if (
      state.wager < limits.min ||
      state.wager > limits.max
    ) {
      state.wager = normalizeWager(
        state.wager || PREVIEW_DEFAULT_WAGER
      );
    }

    els.range.disabled = false;
    els.range.min = String(limits.min);
    els.range.max = String(limits.max);
    els.range.value = String(state.wager);

    els.amount.disabled = false;
    els.amount.min = String(limits.min);
    els.amount.max = String(limits.max);
    els.amount.value = String(state.wager);

    els.min.textContent =
      `${money(limits.min)} ZCoin${limits.min === 1 ? "" : "s"}`;

    els.max.textContent =
      `${money(limits.max)} ZCoins`;

    els.wagerValue.textContent =
      money(state.wager);

    els.wagerLabel.textContent =
      limits.preview
        ? "PREVIEW WAGER"
        : "WAGER";

    els.previewStatus.hidden =
      !limits.preview;

    els.previewStatus.textContent =
      limits.preview
        ? "Preview only · no ZCoins will be charged until the StreamElements wallet is connected."
        : "";

    els.wallet.textContent =
      wallet.walletConnected
        ? `${money(wallet.balance)} ZCoins`
        : "Pending StreamElements";

    renderProjectionLabels();

    if (
      state.side &&
      state.wager > 0
    ) {
      const multiplier =
        sideMultiplier(state.side);

      els.multiplier.textContent =
        `${multiplier.toFixed(2)}x`;

      els.potentialReturn.textContent =
        `${money(
          Math.floor(
            state.wager * multiplier
          )
        )} ZCoins`;
    } else {
      els.multiplier.textContent = "—";
      els.potentialReturn.textContent = "—";
    }

    if (!wallet.authenticated) {
      els.note.textContent =
        "You can preview this ticket now. Log in with Twitch before real wagering becomes available.";

      els.submit.disabled = false;
      els.submit.textContent =
        "Log in with Twitch";
      return;
    }

    if (!wallet.walletConnected) {
      els.note.textContent =
        state.side
          ? "Ticket preview ready. Your team, wager and projected return are shown above. Real submission will unlock when the StreamElements ZCoin wallet is connected."
          : "Choose a team to preview the complete ticket. Real submission will unlock when the StreamElements ZCoin wallet is connected.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Connect ZCoin Wallet to Bet";
      return;
    }

    if (!wallet.wageringEnabled) {
      els.note.textContent =
        "Your wallet is connected, but real ZCoin wagering is currently disabled by the Picks backend.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Wagering offline";
      return;
    }

    if (!state.side) {
      els.note.textContent =
        "Choose the team you want to back.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Choose a side";
      return;
    }

    if (state.wager < limits.min) {
      els.note.textContent =
        "Choose a valid ZCoin wager.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Choose wager";
      return;
    }

    const snapshot = poolSnapshot();

    els.note.textContent =
      snapshot.active
        ? "Projected pool payout updates as other EastCoin users bet. The final multiplier is locked with the market."
        : "Early pool preview. If only one side receives action by lock, the market can settle as No Action.";

    els.submit.disabled = false;
    els.submit.textContent = "Place Bet";
  }

  function setWager(value) {
    state.wager =
      normalizeWager(value);

    renderTicket();
  }

  function renderPrepared() {
    state.busy = false;

    const match = state.match;
    const market = state.market;
    const cardOdds = state.cardOdds;

    els.title.textContent =
      `${market.away.name} vs ${market.home.name}`;

    els.start.textContent =
      V2.datetime(match);

    els.awayName.textContent =
      market.away.name;

    els.homeName.textContent =
      market.home.name;

    els.awayLogo.innerHTML =
      badgeMarkup(
        match?.teams?.away || {
          name: market.away.name
        }
      );

    els.homeLogo.innerHTML =
      badgeMarkup(
        match?.teams?.home || {
          name: market.home.name
        }
      );

    const hasReference =
      Number.isFinite(
        Number(cardOdds?.away?.american)
      ) &&
      Number.isFinite(
        Number(cardOdds?.home?.american)
      );

    els.reference.hidden =
      !hasReference;

    if (hasReference) {
      els.awayML.textContent =
        american(
          cardOdds.away.american
        );

      els.homeML.textContent =
        american(
          cardOdds.home.american
        );
    }

    els.loading.hidden = true;
    els.error.hidden = true;
    els.body.hidden = false;

    renderTicket();
  }

  async function fetchBootstrap() {
    const response = await fetch(
      "/api/picks/bootstrap",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const payload =
      await response
        .json()
        .catch(() => null);

    if (!response.ok || !payload?.ok) {
      throw new Error(
        payload?.message ||
        "EastCoin Picks could not load your current session."
      );
    }

    return payload;
  }

  async function ensureMarket(match) {
    const odds =
      V2.cardOdds?.forMatch?.(match) ||
      null;

    const response = await fetch(
      "/api/picks/markets/ensure",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          providerEventId:
            odds?.providerEventId || "",
          title:
            String(match?.title || ""),
          sport:
            V2.family(match),
          startsAt:
            V2.ts(match?.date) || null,
          away:
            String(
              match?.teams?.away?.name ||
              ""
            ),
          home:
            String(
              match?.teams?.home?.name ||
              ""
            ),
          awayBadge:
            V2.badge(
              match?.teams?.away
            ),
          homeBadge:
            V2.badge(
              match?.teams?.home
            )
        }),
        cache: "no-store"
      }
    );

    const payload =
      await response
        .json()
        .catch(() => null);

    if (!response.ok || !payload?.ok) {
      const error = new Error(
        payload?.message ||
        "This game could not be prepared for Picks."
      );

      error.code =
        payload?.code ||
        "MARKET_ENSURE_FAILED";

      throw error;
    }

    return payload;
  }

  async function open(match) {
    if (!match) return;

    if (
      V2.live(match) ||
      V2.ts(match?.date) <= Date.now()
    ) {
      V2.toast(
        "Betting is closed for this event."
      );
      return;
    }

    reset();

    state.match = match;
    state.wager = PREVIEW_DEFAULT_WAGER;
    state.cardOdds =
      V2.cardOdds?.forMatch?.(match) ||
      null;
    state.busy = true;

    els.title.textContent =
      match.title || "Quick Bet";

    els.start.textContent =
      V2.datetime(match);

    openModal();

    try {
      els.loadingMeta.textContent =
        "Verifying the exact Odds API event…";

      const ensured =
        await ensureMarket(match);

      state.market =
        ensured.market;

      els.loadingMeta.textContent =
        ensured.created
          ? "Picks market created. Loading your wallet…"
          : "Picks market found. Loading your wallet…";

      state.bootstrap =
        await fetchBootstrap();

      renderPrepared();
    } catch (error) {
      showError(
        "Quick Bet unavailable",
        error?.message ||
        "This Picks market could not be prepared."
      );
    }
  }

  async function submit() {
    if (state.busy) return;

    const wallet = walletState();

    if (!wallet.authenticated) {
      const returnTo =
        encodeURIComponent(
          "/v2/"
        );

      location.href =
        `/api/picks/auth/twitch/start?returnTo=${returnTo}`;
      return;
    }

    if (
      !wallet.walletConnected ||
      !wallet.wageringEnabled ||
      !state.market?.id ||
      !state.side ||
      state.wager < 1
    ) {
      renderTicket();
      return;
    }

    state.busy = true;
    els.submit.disabled = true;
    els.submit.textContent =
      "Placing…";

    try {
      const response = await fetch(
        "/api/picks/wagers",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            marketId:
              state.market.id,
            selection:
              state.side,
            wager:
              state.wager
          }),
          credentials: "same-origin"
        }
      );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.message ||
          "EastCoin could not place this wager."
        );
      }

      state.busy = false;
      V2.toast("Bet placed.");

      els.modal.classList.remove(
        "open"
      );

      els.modal.setAttribute(
        "aria-hidden",
        "true"
      );

      V2.integrations?.identity?.();
    } catch (error) {
      state.busy = false;
      els.note.textContent =
        error?.message ||
        "EastCoin could not place this wager.";
      renderTicket();
    }
  }

  function openFullPicks() {
    const market = state.market;
    const match = state.match;

    close();

    if (market && match) {
      V2.router?.openPicksForMatch?.({
        id: market.id,
        date:
          Date.parse(
            market.startsAt || ""
          ) ||
          V2.ts(match?.date),
        teams: {
          away: {
            name:
              market.away.name
          },
          home: {
            name:
              market.home.name
          }
        }
      });

      return;
    }

    V2.router?.go?.("picks");
  }

  els.close.onclick = close;

  els.modal.addEventListener(
    "click",
    (event) => {
      if (event.target === els.modal) {
        close();
      }
    }
  );

  els.away.onclick = () => {
    state.side = "away";
    renderTicket();
  };

  els.home.onclick = () => {
    state.side = "home";
    renderTicket();
  };

  els.range.oninput = () => {
    setWager(els.range.value);
  };

  els.amount.oninput = () => {
    if (els.amount.value === "") return;
    setWager(els.amount.value);
  };

  els.amount.onblur = () => {
    setWager(els.amount.value);
  };

  document.querySelectorAll(
    "[data-quick-amount]"
  ).forEach((button) => {
    button.onclick = () => {
      setWager(
        button.dataset.quickAmount
      );
    };
  });

  els.fullPicks.onclick =
    openFullPicks;

  els.submit.onclick =
    submit;

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        els.modal.classList.contains(
          "open"
        )
      ) {
        close();
      }
    }
  );

  V2.quickBet = {
    open,
    close
  };
})();

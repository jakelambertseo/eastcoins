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
    review: $("#quickBetReview"),
    reviewLogo: $("#quickBetReviewLogo"),
    reviewSide: $("#quickBetReviewSide"),
    reviewTeam: $("#quickBetReviewTeam"),
    reviewOpponent: $("#quickBetReviewOpponent"),
    reviewML: $("#quickBetReviewML"),
    reviewWager: $("#quickBetReviewWager"),
    reviewMultiplier: $("#quickBetReviewMultiplier"),
    reviewReturn: $("#quickBetReviewReturn"),
    reviewMode: $("#quickBetReviewMode"),
    success: $("#quickBetSuccess"),
    successTeam: $("#quickBetSuccessTeam"),
    successMatchup: $("#quickBetSuccessMatchup"),
    successWager: $("#quickBetSuccessWager"),
    successMultiplier: $("#quickBetSuccessMultiplier"),
    successReturn: $("#quickBetSuccessReturn"),
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
    previewOnly: false,
    previewReason: "",
    stage: "ticket",
    receipt: null,
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
    state.previewOnly = false;
    state.previewReason = "";
    state.stage = "ticket";
    state.receipt = null;
    state.busy = false;

    els.body.hidden = true;
    els.review.hidden = true;
    els.success.hidden = true;
    els.error.hidden = true;
    els.loading.hidden = false;
    els.loadingMeta.textContent =
      "Verifying the game and loading Picks.";

    els.submit.disabled = true;
    els.submit.textContent = "Lock In Pick";
    els.fullPicks.textContent = "Full Picks";

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
    els.review.hidden = true;
    els.success.hidden = true;
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
        state.side
          ? "Ticket preview ready. You can review the pick before logging in; Twitch authentication is only required at final confirmation."
          : "Choose a team to build your ticket. You can review it before logging in.";

      els.submit.disabled = !state.side;
      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";
      return;
    }

    if (state.previewOnly) {
      els.note.textContent =
        state.side
          ? "Preview ticket ready. Lock In Pick will open the confirmation screen, but no active Picks season exists yet so the final confirmation cannot submit."
          : "Choose a team to preview the complete V1-style lock-in and confirmation flow.";

      els.submit.disabled = !state.side;
      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";
      return;
    }

    if (!wallet.walletConnected) {
      els.note.textContent =
        state.side
          ? "Ticket preview ready. Lock In Pick will open the review screen; StreamElements is only required for the final confirmation."
          : "Choose a team to preview the complete ticket and review screen.";

      els.submit.disabled = !state.side;
      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";
      return;
    }

    if (!wallet.wageringEnabled) {
      els.note.textContent =
        state.side
          ? "You can review this ticket, but real confirmation remains disabled while wagering is offline."
          : "Choose a team to build the ticket.";

      els.submit.disabled = !state.side;
      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";
      return;
    }

    if (!state.side) {
      els.note.textContent =
        "Choose the team you want to back.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Choose a Side";
      return;
    }

    if (state.wager < limits.min) {
      els.note.textContent =
        "Choose a valid ZCoin wager.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Choose Wager";
      return;
    }

    const snapshot = poolSnapshot();

    els.note.textContent =
      snapshot.active
        ? "Review your projected community-pool payout, then lock in the ticket for confirmation."
        : "Early pool preview. Review your ticket before confirming; one-sided markets can still settle as No Action.";

    els.submit.disabled = false;
    els.submit.textContent = "Lock In Pick";
  }

  function setWager(value) {
    state.wager =
      normalizeWager(value);

    renderTicket();
  }

  function selectedTeam() {
    if (!state.market || !state.side) {
      return null;
    }

    return state.side === "away"
      ? state.market.away
      : state.market.home;
  }

  function opponentTeam() {
    if (!state.market || !state.side) {
      return null;
    }

    return state.side === "away"
      ? state.market.home
      : state.market.away;
  }

  function selectedReferenceML() {
    if (!state.side) return null;

    return Number(
      state.cardOdds?.[state.side]?.american
    );
  }

  function ticketProjection() {
    if (!state.side || state.wager < 1) {
      return {
        multiplier: 0,
        estimatedReturn: 0
      };
    }

    const multiplier =
      sideMultiplier(state.side);

    return {
      multiplier,
      estimatedReturn:
        Math.floor(
          state.wager * multiplier
        )
    };
  }

  function showTicketStage() {
    state.stage = "ticket";

    els.body.hidden = false;
    els.review.hidden = true;
    els.success.hidden = true;
    els.error.hidden = true;

    els.fullPicks.textContent = "Full Picks";

    renderTicket();
  }

  function renderReview() {
    if (!state.side) {
      showTicketStage();
      return;
    }

    const team = selectedTeam();
    const opponent = opponentTeam();
    const projection = ticketProjection();
    const referenceML = selectedReferenceML();
    const wallet = walletState();

    state.stage = "review";

    els.body.hidden = true;
    els.review.hidden = false;
    els.success.hidden = true;
    els.error.hidden = true;

    const matchTeam =
      state.side === "away"
        ? state.match?.teams?.away
        : state.match?.teams?.home;

    els.reviewLogo.innerHTML =
      badgeMarkup(
        matchTeam || {
          name: team?.name
        }
      );

    els.reviewSide.textContent =
      state.side === "away"
        ? "YOUR PICK · AWAY"
        : "YOUR PICK · HOME";

    els.reviewTeam.textContent =
      team?.name || "Team";

    els.reviewOpponent.textContent =
      `vs ${opponent?.name || "Opponent"}`;

    els.reviewML.textContent =
      Number.isFinite(referenceML)
        ? `ML ${american(referenceML)}`
        : "ML —";

    els.reviewWager.textContent =
      `${money(state.wager)} ZCoins`;

    els.reviewMultiplier.textContent =
      `${projection.multiplier.toFixed(2)}x`;

    els.reviewReturn.textContent =
      `${money(projection.estimatedReturn)} ZCoins`;

    if (state.previewOnly) {
      els.reviewMode.textContent =
        "PREVIEW MODE · No active Picks season exists. This review is not saved and cannot be submitted.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Season Required to Confirm";
    } else if (!wallet.authenticated) {
      els.reviewMode.textContent =
        "Twitch login is required only for the final confirmation.";

      els.submit.disabled = false;
      els.submit.textContent =
        "Log In to Confirm";
    } else if (!wallet.walletConnected) {
      els.reviewMode.textContent =
        "StreamElements wallet connection is required for the final ZCoin debit.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Wallet Required to Confirm";
    } else if (!wallet.wageringEnabled) {
      els.reviewMode.textContent =
        "The ticket is ready, but real wagering is currently disabled.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Wagering Offline";
    } else {
      els.reviewMode.textContent =
        "Confirming will debit the displayed ZCoins and permanently record this pick.";

      els.submit.disabled = false;
      els.submit.textContent =
        "Confirm Pick";
    }

    els.fullPicks.textContent =
      "← Edit Pick";
  }

  function renderSuccess(payload = null) {
    const team = selectedTeam();
    const opponent = opponentTeam();
    const projection = ticketProjection();

    state.stage = "success";
    state.receipt = payload || {};

    els.body.hidden = true;
    els.review.hidden = true;
    els.success.hidden = false;
    els.error.hidden = true;

    els.successTeam.textContent =
      team?.name || "Pick Confirmed";

    els.successMatchup.textContent =
      `vs ${opponent?.name || "Opponent"}`;

    els.successWager.textContent =
      `${money(state.wager)} ZCoins`;

    els.successMultiplier.textContent =
      `${projection.multiplier.toFixed(2)}x`;

    els.successReturn.textContent =
      `${money(projection.estimatedReturn)} ZCoins`;

    els.fullPicks.textContent =
      "View My Picks";

    els.submit.disabled = false;
    els.submit.textContent =
      "Done";
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

    els.body.classList.toggle(
      "quickbet-preview-only",
      state.previewOnly
    );

    showTicketStage();
  }

  async function fetchBootstrap() {
    if (
      V2.integrations
        ?.picksBootstrap
    ) {
      return (
        V2.integrations
          .picksBootstrap()
      );
    }

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

    if (
      !response.ok ||
      !payload?.ok
    ) {
      throw new Error(
        payload?.message ||
        "EastCoin Picks could not load your current session."
      );
    }

    return payload;
  }

  function previewMarket(match) {
    const odds =
      V2.cardOdds?.forMatch?.(match) ||
      state.cardOdds ||
      null;

    const away =
      String(
        odds?.providerAway ||
        match?.teams?.away?.name ||
        "Away"
      );

    const home =
      String(
        odds?.providerHome ||
        match?.teams?.home?.name ||
        "Home"
      );

    return {
      id: "",
      provider: "odds_api",
      providerEventId:
        String(
          odds?.providerEventId || ""
        ),
      seasonId: "",
      sport:
        V2.family(match),
      league:
        String(
          odds?.sportTitle ||
          odds?.sportKey ||
          ""
        ),
      away: {
        name: away,
        badge:
          V2.badge(
            match?.teams?.away
          ) || ""
      },
      home: {
        name: home,
        badge:
          V2.badge(
            match?.teams?.home
          ) || ""
      },
      startsAt:
        odds?.commenceTime ||
        new Date(
          V2.ts(match?.date)
        ).toISOString(),
      state: "PREVIEW",
      pool: {
        away: 0,
        home: 0,
        total: 0,
        awayCount: 0,
        homeCount: 0
      }
    };
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

      try {
        const ensured =
          await ensureMarket(match);

        state.market =
          ensured.market;

        state.previewOnly = false;
        state.previewReason = "";

        els.loadingMeta.textContent =
          ensured.created
            ? "Picks market created. Loading your wallet…"
            : "Picks market found. Loading your wallet…";
      } catch (error) {
        if (
          error?.code !==
          "NO_ACTIVE_PICKS_SEASON"
        ) {
          throw error;
        }

        // Previewing the ticket should not require creating a real D1 market.
        // The exact Odds API event was already verified by /markets/ensure
        // before it returned NO_ACTIVE_PICKS_SEASON.
        state.market =
          previewMarket(match);

        state.previewOnly = true;
        state.previewReason =
          "NO_ACTIVE_PICKS_SEASON";

        els.loadingMeta.textContent =
          "Event verified. Opening preview ticket…";
      }

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

  async function confirmPick() {
    if (state.busy) return;

    const wallet = walletState();

    if (!wallet.authenticated) {
      location.href =
        V2.authUrl();
      return;
    }

    if (
      state.previewOnly ||
      !wallet.walletConnected ||
      !wallet.wageringEnabled ||
      !state.market?.id ||
      !state.side ||
      state.wager < 1
    ) {
      renderReview();
      return;
    }

    state.busy = true;
    els.submit.disabled = true;
    els.submit.textContent =
      "Confirming…";

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
          "EastCoin could not confirm this pick."
        );
      }

      state.busy = false;

      renderSuccess(payload);

      V2.integrations?.identity?.({ force: true });
    } catch (error) {
      state.busy = false;

      els.reviewMode.textContent =
        error?.message ||
        "EastCoin could not confirm this pick.";

      renderReview();
    }
  }

  function primaryAction() {
    if (state.busy) return;

    if (state.stage === "ticket") {
      if (!state.side) {
        renderTicket();
        return;
      }

      renderReview();
      return;
    }

    if (state.stage === "review") {
      confirmPick();
      return;
    }

    if (state.stage === "success") {
      close();
    }
  }

  function openFullPicks() {
    const market = state.market;
    const match = state.match;

    close();

    if (market && match && market.id) {
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

  function secondaryAction() {
    if (state.stage === "review") {
      showTicketStage();
      return;
    }

    if (state.stage === "success") {
      openFullPicks();
      return;
    }

    openFullPicks();
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
els.fullPicks.onclick =
    secondaryAction;

  els.submit.onclick =
    primaryAction;

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

(() => {
  "use strict";

  const V2 =
    window.ECV2;

  const $ =
    V2.$;

  const ML =
    window.EastcoinMoneyline;

  if (!ML) {
    console.error(
      "EastCoin Quick Bet could not load the moneyline calculator."
    );
    return;
  }

  const els = {
    modal:
      $("#quickBetModal"),
    close:
      $("#quickBetClose"),
    title:
      $("#quickBetTitle"),
    start:
      $("#quickBetStart"),
    loading:
      $("#quickBetLoading"),
    loadingMeta:
      $("#quickBetLoadingMeta"),
    body:
      $("#quickBetBody"),
    error:
      $("#quickBetError"),
    errorTitle:
      $("#quickBetErrorTitle"),
    errorText:
      $("#quickBetErrorText"),
    reference:
      $("#quickBetReference"),
    awayML:
      $("#quickBetAwayML"),
    homeML:
      $("#quickBetHomeML"),
    away:
      $("#quickBetAway"),
    home:
      $("#quickBetHome"),
    awayLogo:
      $("#quickBetAwayLogo"),
    homeLogo:
      $("#quickBetHomeLogo"),
    awayName:
      $("#quickBetAwayName"),
    homeName:
      $("#quickBetHomeName"),
    awayProjection:
      $("#quickBetAwayProjection"),
    homeProjection:
      $("#quickBetHomeProjection"),
    range:
      $("#quickBetRange"),
    amount:
      $("#quickBetAmount"),
    wagerLabel:
      $("#quickBetWagerLabel"),
    wagerValue:
      $("#quickBetWagerValue"),
    min:
      $("#quickBetMin"),
    max:
      $("#quickBetMax"),
    previewStatus:
      $("#quickBetPreviewStatus"),
    wallet:
      $("#quickBetWallet"),
    multiplier:
      $("#quickBetMultiplier"),
    potentialReturn:
      $("#quickBetReturn"),
    note:
      $("#quickBetNote"),
    review:
      $("#quickBetReview"),
    reviewLogo:
      $("#quickBetReviewLogo"),
    reviewSide:
      $("#quickBetReviewSide"),
    reviewTeam:
      $("#quickBetReviewTeam"),
    reviewOpponent:
      $("#quickBetReviewOpponent"),
    reviewML:
      $("#quickBetReviewML"),
    reviewWager:
      $("#quickBetReviewWager"),
    reviewMultiplier:
      $("#quickBetReviewMultiplier"),
    reviewReturn:
      $("#quickBetReviewReturn"),
    reviewMode:
      $("#quickBetReviewMode"),
    success:
      $("#quickBetSuccess"),
    successTeam:
      $("#quickBetSuccessTeam"),
    successMatchup:
      $("#quickBetSuccessMatchup"),
    successWager:
      $("#quickBetSuccessWager"),
    successMultiplier:
      $("#quickBetSuccessMultiplier"),
    successReturn:
      $("#quickBetSuccessReturn"),
    fullPicks:
      $("#quickBetFullPicks"),
    submit:
      $("#quickBetSubmit")
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
      Math.round(
        Number(value) || 0
      )
    ).toLocaleString(
      "en-US"
    );
  }

  function badgeMarkup(team) {
    const url =
      V2.badge(team);

    if (url) {
      return (
        `<img src="${V2.esc(url)}" alt="">`
      );
    }

    return (
      `<span>${V2.esc(
        V2.initials(
          team?.name
        )
      )}</span>`
    );
  }

  function moneylineForSide(
    side
  ) {
    if (
      ![
        "away",
        "home"
      ].includes(side)
    ) {
      return null;
    }

    return ML.normalize(
      state.cardOdds
        ?.[side]
        ?.american ??
      state.market
        ?.sportsbook
        ?.[side]
        ?.american
    );
  }

  function ticketProjection(
    side = state.side,
    wager = state.wager
  ) {
    const moneyline =
      moneylineForSide(
        side
      );

    const payout =
      ML.payout(
        wager,
        moneyline
      );

    return {
      ...payout,
      moneyline,
      loss:
        payout.available
          ? -payout.wager
          : 0,
      refund:
        payout.available
          ? payout.wager
          : 0
    };
  }

  function installOutcomeUi() {
    if (
      document.getElementById(
        "eastcoinQuickBetOutcomeStyle"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "eastcoinQuickBetOutcomeStyle";

    style.textContent = `
      .quickbet-outcomes{
        display:grid;
        gap:6px;
        margin-top:9px;
        padding:9px;
        border:1px solid rgba(255,255,255,.075);
        border-radius:9px;
        background:#080808;
      }

      .quickbet-outcome{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        min-height:32px;
        padding:6px 8px;
        border-radius:7px;
        background:#0d0d0d;
      }

      .quickbet-outcome span{
        color:#7e7e84;
        font-size:.64rem;
        font-weight:850;
        letter-spacing:.045em;
        text-transform:uppercase;
      }

      .quickbet-outcome strong{
        color:#d9d9de;
        font-size:.72rem;
        text-align:right;
      }

      .quickbet-outcome.win strong{
        color:#76d294;
      }

      .quickbet-outcome.loss strong{
        color:#e07986;
      }

      .quickbet-outcome.void strong{
        color:#d3bd74;
      }

      .quickbet-review-outcomes{
        margin-top:10px;
      }
    `;

    document.head.appendChild(
      style
    );

    const summary =
      document.querySelector(
        ".quickbet-summary"
      );

    if (
      summary &&
      !document.getElementById(
        "quickBetOutcomes"
      )
    ) {
      const block =
        document.createElement(
          "div"
        );

      block.id =
        "quickBetOutcomes";

      block.className =
        "quickbet-outcomes";

      block.innerHTML = `
        <div class="quickbet-outcome win">
          <span>If Pick Wins</span>
          <strong id="quickBetOutcomeWin">—</strong>
        </div>
        <div class="quickbet-outcome loss">
          <span>If Pick Loses</span>
          <strong id="quickBetOutcomeLoss">—</strong>
        </div>
        <div class="quickbet-outcome void">
          <span>Void / No Action</span>
          <strong id="quickBetOutcomeVoid">—</strong>
        </div>
      `;

      summary.insertAdjacentElement(
        "afterend",
        block
      );
    }

    const reviewGrid =
      document.querySelector(
        ".quickbet-review-grid"
      );

    if (
      reviewGrid &&
      !document.getElementById(
        "quickBetReviewOutcomes"
      )
    ) {
      const block =
        document.createElement(
          "div"
        );

      block.id =
        "quickBetReviewOutcomes";

      block.className =
        "quickbet-outcomes quickbet-review-outcomes";

      block.innerHTML = `
        <div class="quickbet-outcome win">
          <span>If Pick Wins</span>
          <strong id="quickBetReviewOutcomeWin">—</strong>
        </div>
        <div class="quickbet-outcome loss">
          <span>If Pick Loses</span>
          <strong id="quickBetReviewOutcomeLoss">—</strong>
        </div>
        <div class="quickbet-outcome void">
          <span>Void / No Action</span>
          <strong id="quickBetReviewOutcomeVoid">—</strong>
        </div>
      `;

      reviewGrid.insertAdjacentElement(
        "afterend",
        block
      );
    }

    const summaryReturnLabel =
      els.potentialReturn
        ?.parentElement
        ?.querySelector(
          "span"
        );

    if (summaryReturnLabel) {
      summaryReturnLabel.textContent =
        "If Pick Wins";
    }

    const reviewMoneylineLabel =
      els.reviewMultiplier
        ?.parentElement
        ?.querySelector(
          "span"
        );

    if (reviewMoneylineLabel) {
      reviewMoneylineLabel.textContent =
        "Moneyline";
    }

    const reviewReturnLabel =
      els.reviewReturn
        ?.parentElement
        ?.querySelector(
          "span"
        );

    if (reviewReturnLabel) {
      reviewReturnLabel.textContent =
        "If Pick Wins";
    }

    const successReturnLabel =
      els.successReturn
        ?.parentElement
        ?.querySelector(
          "span"
        );

    if (successReturnLabel) {
      successReturnLabel.textContent =
        "If Pick Wins";
    }
  }

  function setText(
    id,
    value
  ) {
    const node =
      document.getElementById(
        id
      );

    if (node) {
      node.textContent =
        String(value);
    }
  }

  function renderOutcomeValues(
    prefix,
    projection
  ) {
    if (
      !projection.available
    ) {
      setText(
        `${prefix}Win`,
        "—"
      );

      setText(
        `${prefix}Loss`,
        "—"
      );

      setText(
        `${prefix}Void`,
        "—"
      );

      return;
    }

    setText(
      `${prefix}Win`,
      `+${money(
        projection.profit
      )} profit · ${money(
        projection.totalReturn
      )} total`
    );

    setText(
      `${prefix}Loss`,
      `-${money(
        projection.wager
      )} ZCoins · 0 returned`
    );

    setText(
      `${prefix}Void`,
      `${money(
        projection.refund
      )} ZCoins refunded`
    );
  }

  function openModal() {
    installOutcomeUi();

    els.modal.classList.add(
      "open"
    );

    els.modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function close() {
    if (state.busy) {
      return;
    }

    els.modal.classList.remove(
      "open"
    );

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
    state.wager =
      PREVIEW_DEFAULT_WAGER;
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
    els.submit.textContent =
      "Lock In Pick";

    els.fullPicks.textContent =
      "Full Picks";

    els.away.classList.remove(
      "selected"
    );

    els.home.classList.remove(
      "selected"
    );

    renderOutcomeValues(
      "quickBetOutcome",
      {
        available: false
      }
    );

    renderOutcomeValues(
      "quickBetReviewOutcome",
      {
        available: false
      }
    );
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
      title ||
      "Quick Bet unavailable";

    els.errorText.textContent =
      message ||
      "This Picks market could not be prepared.";

    els.submit.disabled = true;
  }

  function walletState() {
    const session =
      state.bootstrap
        ?.session || {};

    const config =
      state.bootstrap
        ?.config || {};

    const wallet =
      session.wallet || {};

    const balance =
      Math.max(
        0,
        Math.floor(
          Number(
            wallet.balance ||
            0
          )
        )
      );

    const personalMax =
      balance >= 1
        ? Math.min(
            Math.floor(
              balance * 0.15
            ),
            50
          )
        : 0;

    const serverMax =
      Math.floor(
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
            personalMax ||
              serverMax,
            serverMax
          )
        : Math.min(
            balance,
            personalMax
          );

    return {
      authenticated:
        Boolean(
          session.authenticated
        ),
      walletConnected:
        Boolean(
          wallet.connected
        ),
      wageringEnabled:
        Boolean(
          config.wageringEnabled
        ),
      balance,
      max:
        Math.max(
          0,
          max
        )
    };
  }

  function wagerLimits() {
    const config =
      state.bootstrap
        ?.config || {};

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
            Number(
              config.minWager ||
              1
            )
          )
        );

      return {
        preview: false,
        min:
          serverMin,
        max:
          Math.max(
            serverMin,
            wallet.max
          )
      };
    }

    return {
      preview: true,
      min:
        PREVIEW_MIN_WAGER,
      max:
        PREVIEW_MAX_WAGER
    };
  }

  function normalizeWager(
    value
  ) {
    const limits =
      wagerLimits();

    return Math.min(
      limits.max,
      Math.max(
        limits.min,
        Math.floor(
          Number(value) ||
          limits.min
        )
      )
    );
  }

  function renderProjectionLabels() {
    const away =
      moneylineForSide(
        "away"
      );

    const home =
      moneylineForSide(
        "home"
      );

    els.awayProjection.textContent =
      ML.format(away);

    els.homeProjection.textContent =
      ML.format(home);
  }

  function renderTicket() {
    const wallet =
      walletState();

    const limits =
      wagerLimits();

    els.away.classList.toggle(
      "selected",
      state.side === "away"
    );

    els.home.classList.toggle(
      "selected",
      state.side === "home"
    );

    if (
      state.wager <
        limits.min ||
      state.wager >
        limits.max
    ) {
      state.wager =
        normalizeWager(
          state.wager ||
          PREVIEW_DEFAULT_WAGER
        );
    }

    els.range.disabled = false;
    els.range.min =
      String(limits.min);
    els.range.max =
      String(limits.max);
    els.range.value =
      String(state.wager);

    els.amount.disabled = false;
    els.amount.min =
      String(limits.min);
    els.amount.max =
      String(limits.max);
    els.amount.value =
      String(state.wager);

    els.min.textContent =
      `${money(
        limits.min
      )} ZCoin${
        limits.min === 1
          ? ""
          : "s"
      }`;

    els.max.textContent =
      `${money(
        limits.max
      )} ZCoins`;

    els.wagerValue.textContent =
      money(
        state.wager
      );

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
        ? `${money(
            wallet.balance
          )} ZCoins`
        : "Pending StreamElements";

    renderProjectionLabels();

    const projection =
      ticketProjection();

    if (
      state.side &&
      projection.available
    ) {
      els.multiplier.textContent =
        ML.format(
          projection.moneyline
        );

      els.potentialReturn.textContent =
        `${money(
          projection.totalReturn
        )} ZCoins`;

      renderOutcomeValues(
        "quickBetOutcome",
        projection
      );
    } else {
      els.multiplier.textContent =
        "—";

      els.potentialReturn.textContent =
        "—";

      renderOutcomeValues(
        "quickBetOutcome",
        {
          available: false
        }
      );
    }

    if (
      state.side &&
      !projection.available
    ) {
      els.note.textContent =
        "This side no longer has a valid sportsbook moneyline. Refresh Events and try again.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Moneyline Unavailable";

      return;
    }

    if (
      !wallet.authenticated
    ) {
      els.note.textContent =
        state.side
          ? `If this Pick wins, it returns ${money(
              projection.totalReturn
            )} ZCoins total. If it loses, the full ${money(
              state.wager
            )} ZCoin wager is lost.`
          : "Choose a team to build your ticket. The displayed return applies only if that team wins.";

      els.submit.disabled =
        !state.side;

      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";

      return;
    }

    if (state.previewOnly) {
      els.note.textContent =
        state.side
          ? `Preview only. A win returns ${money(
              projection.totalReturn
            )} total; a loss returns 0 and loses the ${money(
              state.wager
            )} ZCoin wager; Void / No Action refunds the wager.`
          : "Choose a team to preview the complete moneyline ticket.";

      els.submit.disabled =
        !state.side;

      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";

      return;
    }

    if (
      !wallet.walletConnected
    ) {
      els.note.textContent =
        state.side
          ? "Ticket preview ready. A losing Pick returns 0 ZCoins; Void / No Action refunds the wager."
          : "Choose a team to build your ticket.";

      els.submit.disabled =
        !state.side;

      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";

      return;
    }

    if (
      !wallet.wageringEnabled
    ) {
      els.note.textContent =
        state.side
          ? "You can review this sportsbook ticket, but real confirmation remains disabled while wagering is offline."
          : "Choose a team to build the ticket.";

      els.submit.disabled =
        !state.side;

      els.submit.textContent =
        state.side
          ? "Lock In Pick"
          : "Choose a Side";

      return;
    }

    if (!state.side) {
      els.note.textContent =
        "Choose the team you want to back. Returns shown on a team apply only if that team wins.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Choose a Side";

      return;
    }

    if (
      state.wager <
      limits.min
    ) {
      els.note.textContent =
        "Choose a valid ZCoin wager.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Choose Wager";

      return;
    }

    els.note.textContent =
      `Moneyline ${ML.format(
        projection.moneyline
      )}: win = +${money(
        projection.profit
      )} profit / ${money(
        projection.totalReturn
      )} total; loss = -${money(
        projection.wager
      )} ZCoins / 0 returned; Void / No Action = ${money(
        projection.refund
      )} refunded.`;

    els.submit.disabled = false;
    els.submit.textContent =
      "Lock In Pick";
  }

  function setWager(
    value
  ) {
    state.wager =
      normalizeWager(
        value
      );

    renderTicket();
  }

  function selectedTeam() {
    if (
      !state.market ||
      !state.side
    ) {
      return null;
    }

    return (
      state.side === "away"
        ? state.market.away
        : state.market.home
    );
  }

  function opponentTeam() {
    if (
      !state.market ||
      !state.side
    ) {
      return null;
    }

    return (
      state.side === "away"
        ? state.market.home
        : state.market.away
    );
  }

  function showTicketStage() {
    state.stage =
      "ticket";

    els.body.hidden = false;
    els.review.hidden = true;
    els.success.hidden = true;
    els.error.hidden = true;

    els.fullPicks.textContent =
      "Full Picks";

    renderTicket();
  }

  function renderReview() {
    if (!state.side) {
      showTicketStage();
      return;
    }

    const team =
      selectedTeam();

    const opponent =
      opponentTeam();

    const projection =
      ticketProjection();

    const wallet =
      walletState();

    if (
      !projection.available
    ) {
      showTicketStage();
      return;
    }

    state.stage =
      "review";

    els.body.hidden = true;
    els.review.hidden = false;
    els.success.hidden = true;
    els.error.hidden = true;

    const matchTeam =
      state.side ===
        "away"
        ? state.match
            ?.teams
            ?.away
        : state.match
            ?.teams
            ?.home;

    els.reviewLogo.innerHTML =
      badgeMarkup(
        matchTeam || {
          name:
            team?.name
        }
      );

    els.reviewSide.textContent =
      state.side ===
        "away"
        ? "YOUR PICK · AWAY"
        : "YOUR PICK · HOME";

    els.reviewTeam.textContent =
      team?.name ||
      "Team";

    els.reviewOpponent.textContent =
      `vs ${
        opponent?.name ||
        "Opponent"
      }`;

    els.reviewML.textContent =
      `ML ${ML.format(
        projection.moneyline
      )}`;

    els.reviewWager.textContent =
      `${money(
        state.wager
      )} ZCoins`;

    els.reviewMultiplier.textContent =
      ML.format(
        projection.moneyline
      );

    els.reviewReturn.textContent =
      `${money(
        projection.totalReturn
      )} ZCoins`;

    renderOutcomeValues(
      "quickBetReviewOutcome",
      projection
    );

    if (state.previewOnly) {
      els.reviewMode.textContent =
        "PREVIEW MODE · No active Picks season exists. No ZCoins are charged.";
      els.submit.disabled = true;
      els.submit.textContent =
        "Season Required to Confirm";
    } else if (
      !wallet.authenticated
    ) {
      els.reviewMode.textContent =
        `Twitch login is required to confirm. If this Pick loses, the ${money(
          state.wager
        )} ZCoin wager is lost and 0 ZCoins are returned.`;

      els.submit.disabled = false;
      els.submit.textContent =
        "Log In to Confirm";
    } else if (
      !wallet.walletConnected
    ) {
      els.reviewMode.textContent =
        "StreamElements wallet connection is required for the final ZCoin debit.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Wallet Required to Confirm";
    } else if (
      !wallet.wageringEnabled
    ) {
      els.reviewMode.textContent =
        "The ticket is ready, but real wagering is currently disabled.";

      els.submit.disabled = true;
      els.submit.textContent =
        "Wagering Offline";
    } else {
      els.reviewMode.textContent =
        `Confirming debits ${money(
          state.wager
        )} ZCoins. Win = ${money(
          projection.totalReturn
        )} total; loss = 0 returned; Void / No Action = ${money(
          projection.refund
        )} refunded.`;

      els.submit.disabled = false;
      els.submit.textContent =
        "Confirm Pick";
    }

    els.fullPicks.textContent =
      "← Edit Pick";
  }

  function renderSuccess(
    payload = null
  ) {
    const team =
      selectedTeam();

    const opponent =
      opponentTeam();

    const projection =
      ticketProjection();

    state.stage =
      "success";

    state.receipt =
      payload || {};

    els.body.hidden = true;
    els.review.hidden = true;
    els.success.hidden = false;
    els.error.hidden = true;

    els.successTeam.textContent =
      team?.name ||
      "Pick Confirmed";

    els.successMatchup.textContent =
      `vs ${
        opponent?.name ||
        "Opponent"
      }`;

    els.successWager.textContent =
      `${money(
        state.wager
      )} ZCoins`;

    els.successMultiplier.textContent =
      ML.format(
        projection.moneyline
      );

    els.successReturn.textContent =
      `${money(
        projection.totalReturn
      )} ZCoins`;

    els.fullPicks.textContent =
      "View My Picks";

    els.submit.disabled = false;
    els.submit.textContent =
      "Done";
  }

  function renderPrepared() {
    state.busy = false;

    const match =
      state.match;

    const market =
      state.market;

    const cardOdds =
      state.cardOdds;

    els.title.textContent =
      `${market.away.name} vs ${market.home.name}`;

    els.start.textContent =
      V2.datetime(
        match
      );

    els.awayName.textContent =
      market.away.name;

    els.homeName.textContent =
      market.home.name;

    els.awayLogo.innerHTML =
      badgeMarkup(
        match?.teams
          ?.away || {
          name:
            market.away.name
        }
      );

    els.homeLogo.innerHTML =
      badgeMarkup(
        match?.teams
          ?.home || {
          name:
            market.home.name
        }
      );

    const awayLine =
      moneylineForSide(
        "away"
      );

    const homeLine =
      moneylineForSide(
        "home"
      );

    const hasReference =
      awayLine != null &&
      homeLine != null;

    els.reference.hidden =
      !hasReference;

    if (hasReference) {
      els.awayML.textContent =
        ML.format(
          awayLine
        );

      els.homeML.textContent =
        ML.format(
          homeLine
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

    const response =
      await fetch(
        "/api/picks/bootstrap",
        {
          credentials:
            "same-origin",
          cache:
            "no-store"
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
        "EastCoin Picks could not load your current session."
      );
    }

    return payload;
  }

  function previewMarket(
    match
  ) {
    const odds =
      V2.cardOdds
        ?.forMatch?.(
          match
        ) ||
      state.cardOdds ||
      null;

    const away =
      String(
        odds?.providerAway ||
        match?.teams
          ?.away?.name ||
        "Away"
      );

    const home =
      String(
        odds?.providerHome ||
        match?.teams
          ?.home?.name ||
        "Home"
      );

    return {
      id: "",
      provider:
        "odds_api",
      providerEventId:
        String(
          odds
            ?.providerEventId ||
          ""
        ),
      seasonId: "",
      sport:
        V2.family(
          match
        ),
      league:
        String(
          odds?.sportTitle ||
          odds?.sportKey ||
          ""
        ),
      away: {
        name:
          away,
        badge:
          V2.badge(
            match?.teams
              ?.away
          ) || ""
      },
      home: {
        name:
          home,
        badge:
          V2.badge(
            match?.teams
              ?.home
          ) || ""
      },
      startsAt:
        odds
          ?.commenceTime ||
        new Date(
          V2.ts(
            match?.date
          )
        ).toISOString(),
      state:
        "PREVIEW"
    };
  }

  async function ensureMarket(
    match
  ) {
    const odds =
      V2.cardOdds
        ?.forMatch?.(
          match
        ) ||
      null;

    const response =
      await fetch(
        "/api/picks/markets/ensure",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              providerEventId:
                odds
                  ?.providerEventId ||
                "",
              title:
                String(
                  match?.title ||
                  ""
                ),
              sport:
                V2.family(
                  match
                ),
              startsAt:
                V2.ts(
                  match?.date
                ) ||
                null,
              away:
                String(
                  match?.teams
                    ?.away?.name ||
                  ""
                ),
              home:
                String(
                  match?.teams
                    ?.home?.name ||
                  ""
                ),
              awayBadge:
                V2.badge(
                  match?.teams
                    ?.away
                ),
              homeBadge:
                V2.badge(
                  match?.teams
                    ?.home
                )
            }),
          cache:
            "no-store"
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
      const error =
        new Error(
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

  async function open(
    match
  ) {
    if (!match) {
      return;
    }

    if (
      V2.live(match) ||
      V2.ts(
        match?.date
      ) <= Date.now()
    ) {
      V2.toast(
        "Betting is closed for this event."
      );

      return;
    }

    reset();

    state.match =
      match;

    state.wager =
      PREVIEW_DEFAULT_WAGER;

    state.cardOdds =
      V2.cardOdds
        ?.forMatch?.(
          match
        ) ||
      null;

    const awayLine =
      moneylineForSide(
        "away"
      );

    const homeLine =
      moneylineForSide(
        "home"
      );

    if (
      awayLine == null ||
      homeLine == null
    ) {
      V2.toast(
        "This event does not currently have a wagerable moneyline."
      );

      return;
    }

    state.busy = true;

    els.title.textContent =
      match.title ||
      "Quick Bet";

    els.start.textContent =
      V2.datetime(
        match
      );

    openModal();

    try {
      els.loadingMeta.textContent =
        "Verifying the exact sportsbook event…";

      try {
        const ensured =
          await ensureMarket(
            match
          );

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

        state.market =
          previewMarket(
            match
          );

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
    if (state.busy) {
      return;
    }

    const wallet =
      walletState();

    if (
      !wallet.authenticated
    ) {
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

    const projection =
      ticketProjection();

    if (
      !projection.available
    ) {
      renderTicket();
      return;
    }

    state.busy = true;
    els.submit.disabled = true;
    els.submit.textContent =
      "Confirming…";

    try {
      const response =
        await fetch(
          "/api/picks/wagers",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                marketId:
                  state.market.id,
                selection:
                  state.side,
                wager:
                  state.wager
              }),
            credentials:
              "same-origin"
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
          "EastCoin could not confirm this pick."
        );
      }

      state.busy = false;

      renderSuccess(
        payload
      );

      V2.integrations
        ?.identity?.({
          force: true
        });
    } catch (error) {
      state.busy = false;

      els.reviewMode.textContent =
        error?.message ||
        "EastCoin could not confirm this pick.";

      renderReview();
    }
  }

  function primaryAction() {
    if (state.busy) {
      return;
    }

    if (
      state.stage ===
      "ticket"
    ) {
      if (!state.side) {
        renderTicket();
        return;
      }

      renderReview();
      return;
    }

    if (
      state.stage ===
      "review"
    ) {
      confirmPick();
      return;
    }

    if (
      state.stage ===
      "success"
    ) {
      close();
    }
  }

  function openFullPicks() {
    const market =
      state.market;

    const match =
      state.match;

    close();

    if (
      market &&
      match &&
      market.id
    ) {
      V2.router
        ?.openPicksForMatch?.({
          id:
            market.id,
          date:
            Date.parse(
              market.startsAt ||
              ""
            ) ||
            V2.ts(
              match?.date
            ),
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

    V2.router
      ?.go?.(
        "picks"
      );
  }

  function secondaryAction() {
    if (
      state.stage ===
      "review"
    ) {
      showTicketStage();
      return;
    }

    if (
      state.stage ===
      "success"
    ) {
      openFullPicks();
      return;
    }

    openFullPicks();
  }

  els.close.onclick =
    close;

  els.modal.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        els.modal
      ) {
        close();
      }
    }
  );

  els.away.onclick =
    () => {
      state.side =
        "away";

      renderTicket();
    };

  els.home.onclick =
    () => {
      state.side =
        "home";

      renderTicket();
    };

  els.range.oninput =
    () => {
      setWager(
        els.range.value
      );
    };

  els.amount.oninput =
    () => {
      if (
        els.amount.value ===
        ""
      ) {
        return;
      }

      setWager(
        els.amount.value
      );
    };

  els.amount.onblur =
    () => {
      setWager(
        els.amount.value
      );
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
        els.modal.classList
          .contains(
            "open"
          )
      ) {
        close();
      }
    }
  );

  installOutcomeUi();

  V2.quickBet = {
    open,
    close
  };
})();

(() => {
  "use strict";

  const API = window.EastcoinPicksAPI;
  const Preview = window.EastcoinPicksPreview;
  const params = new URLSearchParams(location.search);
  const FORCE_DEMO = params.get("demo") === "1";

  const state = {
    mode:"loading",
    games:[],
    markets:[],
    pending:null
  };

  let toastTimer = 0;

  const $ = (id) => document.getElementById(id);
  const els = {
    modeBanner:$("modeBanner"),
    modeText:$("modeText"),
    marketCount:$("marketCount"),
    adminMarketList:$("adminMarketList"),
    refreshAdmin:$("refreshAdmin"),
    confirmBackdrop:$("confirmBackdrop"),
    closeConfirm:$("closeConfirm"),
    confirmTitle:$("confirmTitle"),
    confirmCopy:$("confirmCopy"),
    confirmGrid:$("confirmGrid"),
    confirmWarning:$("confirmWarning"),
    confirmAction:$("confirmAction"),
    adminToast:$("adminToast")
  };

  function money(value) {
    return Math.max(0, Math.floor(Number(value) || 0))
      .toLocaleString("en-US");
  }

  function initials(value) {
    return Preview?.initials?.(value) || "EC";
  }

  function logo(name, src) {
    return `
      <span class="team-logo">
        ${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ""}
        <span>${initials(name)}</span>
      </span>
    `;
  }

  function familyLabel(game) {
    const map = {
      "american-football":"NFL",
      baseball:"MLB",
      basketball:"NBA",
      hockey:"NHL",
      soccer:"SOCCER",
      combat:"UFC",
      wrestling:"WRESTLING",
      motorsport:"MOTORSPORT",
      tennis:"TENNIS",
      golf:"GOLF"
    };

    return map[game.family] ||
      String(game.sport || "SPORT").toUpperCase();
  }

  function formatTime(ts) {
    const date = new Date(Number(ts || 0));
    if (Number.isNaN(date.getTime())) return "Unknown start";

    return date.toLocaleString([], {
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit"
    });
  }

  function setMode(kind, text) {
    els.modeBanner.className =
      `mode-banner ${kind || ""}`;
    els.modeText.textContent = text;
  }

  function normalizeBackendAdminMarket(raw) {
    const away = raw?.away || raw?.teams?.away || {};
    const home = raw?.home || raw?.teams?.home || {};
    const pool = raw?.pool || {};

    let startTs = Number(
      raw?.startsAt ||
      raw?.starts_at ||
      raw?.date ||
      0
    );

    if (startTs && startTs < 1e12) {
      startTs *= 1000;
    }

    return {
      id:String(raw?.id || raw?.marketId || ""),
      sport:String(raw?.sport || raw?.category || "other"),
      family:String(raw?.family || "other"),
      away:String(away?.name || "Away"),
      home:String(home?.name || "Home"),
      awayLogo:String(away?.badge || away?.logo || ""),
      homeLogo:String(home?.badge || home?.logo || ""),
      startTs,
      state:String(raw?.state || "LOCKED").toUpperCase(),
      pool:{
        away:Number(pool?.awayZcoins ?? pool?.away ?? 0),
        home:Number(pool?.homeZcoins ?? pool?.home ?? 0),
        total:Number(
          pool?.totalZcoins ??
          pool?.total ??
          0
        ),
        awayCount:Number(pool?.awayTickets ?? 0),
        homeCount:Number(pool?.homeTickets ?? 0)
      },
      settlement:raw?.settlement || null,
      settlementPreview:raw?.settlementPreview || null
    };
  }

  async function loadDemo() {
    if (!Preview) {
      throw new Error("Preview engine unavailable.");
    }

    const catalog =
      await Preview.loadGames(false);

    state.mode = "demo";
    state.games = catalog.games;
    state.markets = state.games
      .map((game) =>
        Preview.adminMarket(game)
      );

    setMode(
      "demo",
      "Local demo console — settlement actions only affect this browser. No real ZCoins or user accounts are changed."
    );

    render();
  }

  async function loadBackend() {
    const payload =
      await API.getAdminMarkets();

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.markets)
        ? payload.markets
        : [];

    state.mode = "backend";
    state.markets =
      rows.map(normalizeBackendAdminMarket);

    setMode(
      "live",
      "Authenticated admin session — winner, No Action, and Void commands are enforced and settled by the EastCoin Worker."
    );

    render();
  }

  async function load() {
    els.adminMarketList.innerHTML =
      '<div class="empty">Checking settlement console…</div>';

    if (FORCE_DEMO) {
      await loadDemo();
      return;
    }

    try {
      await loadBackend();
    } catch (error) {
      state.mode = "locked";

      const status =
        Number(error?.status || 0);

      if (status === 401 || status === 403) {
        setMode(
          "denied",
          "Admin authorization required. Access must be granted by the Worker using your authenticated Twitch identity."
        );

        els.adminMarketList.innerHTML = `
          <div class="empty">
            <strong>Admin access denied</strong>
            This page intentionally has no frontend password or browser-side admin bypass.
          </div>
        `;
      } else {
        setMode(
          "",
          "Admin backend not connected yet. Real settlement controls remain disabled until Worker authentication is live."
        );

        els.adminMarketList.innerHTML = `
          <div class="empty">
            <strong>Settlement API not connected</strong>
            The admin interface is ready, but real markets cannot be settled from the browser until the authenticated Worker endpoints are deployed.
            <br><br>
            For UI testing only, open <code>picks-admin.html?demo=1</code>.
          </div>
        `;
      }

      els.marketCount.textContent = "0 actionable markets";
    }
  }

  function render() {
    const rows = [...state.markets]
      .sort((a, b) =>
        Number(a.startTs || 0) -
        Number(b.startTs || 0)
      );

    els.marketCount.textContent =
      `${rows.length} market${rows.length === 1 ? "" : "s"}`;

    if (!rows.length) {
      els.adminMarketList.innerHTML =
        '<div class="empty"><strong>No markets need settlement</strong>Locked markets will appear here when they require a result.</div>';
      return;
    }

    els.adminMarketList.innerHTML =
      rows.map(renderMarket).join("");

    els.adminMarketList
      .querySelectorAll("[data-result]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const market = state.markets.find(
            (row) => row.id === button.dataset.market
          );

          if (!market) return;

          openConfirm(
            market,
            button.dataset.result
          );
        });
      });
  }

  function renderMarket(market) {
    const pool = market.pool || {};
    const settled =
      Boolean(market.settlement);

    const settlementText =
      settled
        ? market.settlement.result === "away"
          ? `${market.away} won`
          : market.settlement.result === "home"
            ? `${market.home} won`
            : market.settlement.result === "no_action"
              ? "No Action"
              : "Void"
        : "";

    return `
      <article class="admin-market ${settled ? "settled" : ""}">
        <header class="market-top">
          <div class="market-meta">
            <span class="sport">${familyLabel(market)}</span>
            <span class="market-state">
              ${formatTime(market.startTs)} · ${market.state || "LOCKED"}
            </span>
          </div>
          ${settled ? `<span class="settled-pill">${settlementText}</span>` : ""}
        </header>

        <div class="market-grid">
          <div class="admin-team">
            ${logo(market.away, market.awayLogo)}
            <div class="team-copy">
              <strong>${market.away}</strong>
              <small>${money(pool.away)} ZCoins · ${Number(pool.awayCount || 0)} tickets</small>
            </div>
          </div>

          <div class="admin-team">
            ${logo(market.home, market.homeLogo)}
            <div class="team-copy">
              <strong>${market.home}</strong>
              <small>${money(pool.home)} ZCoins · ${Number(pool.homeCount || 0)} tickets</small>
            </div>
          </div>

          <div class="market-actions">
            ${
              settled
                ? `<button class="settle-btn" type="button" disabled>Already settled</button>`
                : `
                  <div class="winner-actions">
                    <button class="settle-btn" type="button" data-market="${market.id}" data-result="away">${market.away} Won</button>
                    <button class="settle-btn" type="button" data-market="${market.id}" data-result="home">${market.home} Won</button>
                  </div>
                  <div class="secondary-actions">
                    <button class="settle-btn" type="button" data-market="${market.id}" data-result="no_action">No Action</button>
                    <button class="settle-btn" type="button" data-market="${market.id}" data-result="void">Void</button>
                  </div>
                `
            }
          </div>
        </div>

        <div class="market-pool">
          <div class="pool-stat"><span>Total Pool</span><strong>${money(pool.total)} ZCoins</strong></div>
          <div class="pool-stat"><span>Away Action</span><strong>${money(pool.away)} ZCoins</strong></div>
          <div class="pool-stat"><span>Home Action</span><strong>${money(pool.home)} ZCoins</strong></div>
          <div class="pool-stat"><span>Tickets</span><strong>${Number(pool.awayCount || 0) + Number(pool.homeCount || 0)}</strong></div>
        </div>
      </article>
    `;
  }

  function resultLabel(market, result) {
    if (result === "away") return `${market.away} wins`;
    if (result === "home") return `${market.home} wins`;
    if (result === "no_action") return "No Action";
    return "Void market";
  }

  function openConfirm(market, result) {
    state.pending = {
      market,
      result
    };

    const pool = market.pool || {};
    const label = resultLabel(market, result);

    els.confirmTitle.textContent = label;
    els.confirmCopy.textContent =
      `${market.away} vs ${market.home}. Review the market before confirming the settlement.`;

    els.confirmGrid.innerHTML = `
      <div class="confirm-stat">
        <span>Result</span>
        <strong>${label}</strong>
      </div>
      <div class="confirm-stat">
        <span>Total Pool</span>
        <strong>${money(pool.total)} ZCoins</strong>
      </div>
      <div class="confirm-stat">
        <span>Away Tickets</span>
        <strong>${Number(pool.awayCount || 0)}</strong>
      </div>
      <div class="confirm-stat">
        <span>Home Tickets</span>
        <strong>${Number(pool.homeCount || 0)}</strong>
      </div>
    `;

    els.confirmWarning.textContent =
      state.mode === "demo"
        ? "Demo mode only: this writes the result to localStorage so you can test the Picks History and ticket settlement UI. It does not touch StreamElements."
        : "Production settlement is authoritative and should be treated as irreversible. The Worker calculates payouts from the frozen market snapshot and writes the audit ledger.";

    els.confirmAction.textContent =
      result === "away" || result === "home"
        ? "Confirm Winner"
        : result === "no_action"
          ? "Confirm No Action"
          : "Confirm Void";

    openBackdrop(els.confirmBackdrop);
  }

  async function confirmSettlement() {
    const pending = state.pending;
    if (!pending) return;

    els.confirmAction.disabled = true;
    els.confirmAction.textContent = "Settling…";

    try {
      if (state.mode === "demo") {
        Preview.settleMarket(
          pending.market,
          pending.result
        );

        state.markets =
          state.games.map((game) =>
            Preview.adminMarket(game)
          );

        closeBackdrop(els.confirmBackdrop);
        state.pending = null;
        render();
        toast("Demo market settled.");
        return;
      }

      if (state.mode === "backend") {
        await API.settleMarket(
          pending.market.id,
          pending.result
        );

        closeBackdrop(els.confirmBackdrop);
        state.pending = null;
        await loadBackend();
        toast("Market settled.");
        return;
      }
    } catch (error) {
      toast(
        error?.message ||
        "Could not settle that market."
      );
    } finally {
      els.confirmAction.disabled = false;
      els.confirmAction.textContent = "Confirm Result";
    }
  }

  function openBackdrop(node) {
    node.classList.add("open");
    node.setAttribute("aria-hidden", "false");
  }

  function closeBackdrop(node) {
    node.classList.remove("open");
    node.setAttribute("aria-hidden", "true");
  }

  function toast(message) {
    els.adminToast.textContent = message;
    els.adminToast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
      () =>
        els.adminToast.classList.remove("show"),
      2400
    );
  }

  els.refreshAdmin.addEventListener(
    "click",
    async () => {
      els.refreshAdmin.disabled = true;
      els.refreshAdmin.textContent = "Refreshing…";

      try {
        await load();
      } finally {
        els.refreshAdmin.disabled = false;
        els.refreshAdmin.textContent = "Refresh Markets";
      }
    }
  );

  els.closeConfirm.addEventListener(
    "click",
    () => closeBackdrop(els.confirmBackdrop)
  );

  els.confirmAction.addEventListener(
    "click",
    confirmSettlement
  );

  els.confirmBackdrop.addEventListener(
    "click",
    (event) => {
      if (event.target === els.confirmBackdrop) {
        closeBackdrop(els.confirmBackdrop);
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        els.confirmBackdrop.classList.contains("open")
      ) {
        closeBackdrop(els.confirmBackdrop);
      }
    }
  );

  load();
})();

(() => {
  "use strict";

  const API = window.EastcoinPicksAPI;
  const Preview = window.EastcoinPicksPreview;

  const QUERY =
    new URLSearchParams(
      window.location.search
    );

  const V2_EMBEDDED =
    QUERY.get(
      "ecV2Embedded"
    ) === "1";

  const PREVIEW_REQUESTED =
    QUERY.get(
      "preview"
    ) === "1";

  const LOCAL_PREVIEW_ALLOWED =
    [
      "localhost",
      "127.0.0.1",
      "::1"
    ].includes(
      window.location.hostname
    );

  if (!Preview) {
    console.error("EastCoin Picks preview engine failed to load.");
    return;
  }

  const state = {
    mode:"loading",
    backend:null,
    games:[],
    leaderboard:[],
    tickets:[],
    history:[],
    communityLedger:[],
    session:{
      authenticated:false,
      user:null,
      walletBalance:0,
      walletConnected:false
    },
    season:{
      wins:0,
      losses:0,
      profit:0,
      accuracy:null,
      rank:null,
      rankTitle:""
    },
    activeBet:null,
    pendingAuthPick:null
  };

  let toastTimer = 0;
  let topLeaderScrollFrame = 0;
  let topLeaderLastTime = 0;
  const twitchAvatarMemory = new Map();

  const $ = (id) => document.getElementById(id);
  const els = {
    marketList:$("marketList"),
    ticketList:$("ticketList"),
    leaderboard:$("leaderboard"),
    topLeadersList:$("topLeadersList"),
    topLeadersTrack:$("topLeadersTrack"),
    historyList:$("historyList"),
    communityLedger:$("communityLedger"),
    ledgerCount:$("ledgerCount"),
    catalogStatus:$("catalogStatus"),
    pendingCount:$("pendingCount"),
    seasonProfit:$("seasonProfit"),
    seasonRecord:$("seasonRecord"),
    seasonAccuracy:$("seasonAccuracy"),
    seasonRank:$("seasonRank"),
    authCardLoggedOut:$("authCardLoggedOut"),
    authCardLoggedIn:$("authCardLoggedIn"),
    walletSync:$("walletSync"),
    mainWalletSync:$("mainWalletSync"),
    logoutBtn:$("logoutBtn"),
    betBackdrop:$("betBackdrop"),
    closeBet:$("closeBet"),
    selectedMatch:$("selectedMatch"),
    selectedSide:$("selectedSide"),
    betWallet:$("betWallet"),
    betMax:$("betMax"),
    wagerValue:$("wagerValue"),
    wagerRange:$("wagerRange"),
    maxScale:$("maxScale"),
    balanceAfter:$("balanceAfter"),
    projectedOdds:$("projectedOdds"),
    oddsNote:$("oddsNote"),
    projectedPools:$("projectedPools"),
    totalRiding:$("totalRiding"),
    potentialWinnings:$("potentialWinnings"),
    lockPickBtn:$("lockPickBtn"),
    authBackdrop:$("authBackdrop"),
    closeAuth:$("closeAuth"),
    mockLoginBtn:$("mockLoginBtn"),
    authNote:$("authNote"),
    rulesBackdrop:$("rulesBackdrop"),
    rulesBtn:$("rulesBtn"),
    closeRules:$("closeRules"),
    refreshBtn:$("refreshBtn"),
    navSearch:$("navSearch"),
    toast:$("toast"),
    modeBadge:$("modeBadge")
  };

  function money(value) {
    return Math.max(0, Math.floor(Number(value) || 0))
      .toLocaleString("en-US");
  }

  function toTimestamp(
    value,
    fallback = 0
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    const numeric =
      Number(value);

    if (
      Number.isFinite(numeric) &&
      numeric > 0
    ) {
      return numeric < 1e12
        ? numeric * 1000
        : numeric;
    }

    const parsed =
      Date.parse(
        String(value)
      );

    return Number.isFinite(
      parsed
    )
      ? parsed
      : fallback;
  }

  function normalizePickStatus(
    value
  ) {
    const status =
      String(value || "")
        .toUpperCase();

    if (
      [
        "ACTIVE",
        "PENDING_PAYMENT",
        "PENDING"
      ].includes(status)
    ) {
      return "pending";
    }

    if (status === "WON") {
      return "won";
    }

    if (status === "LOST") {
      return "lost";
    }

    if (status === "REFUNDED") {
      return "refunded";
    }

    if (status === "CANCELLED") {
      return "cancelled";
    }

    return status
      ? status.toLowerCase()
      : "pending";
  }

  function sportFamilyFromKey(
    value
  ) {
    const key =
      String(value || "")
        .toLowerCase();

    if (
      key.startsWith(
        "americanfootball_"
      )
    ) {
      return "american-football";
    }

    if (
      key.startsWith(
        "baseball_"
      )
    ) {
      return "baseball";
    }

    if (
      key ===
        "mma_mixed_martial_arts" ||
      key.includes("mma") ||
      key.includes("ufc")
    ) {
      return "combat";
    }

    if (
      key.startsWith(
        "basketball_"
      )
    ) {
      return "basketball";
    }

    if (
      key.startsWith(
        "icehockey_"
      )
    ) {
      return "hockey";
    }

    if (
      key.startsWith(
        "soccer_"
      )
    ) {
      return "soccer";
    }

    return "other";
  }

  function initials(value) {
    return Preview.initials(value);
  }

  function normalizeUser(raw = {}) {
    const login = String(
      raw.login ||
      raw.username ||
      raw.name ||
      ""
    ).toLowerCase();

    return {
      id:String(raw.id || raw.twitchId || ""),
      login,
      displayName:String(
        raw.displayName ||
        raw.display_name ||
        raw.name ||
        login ||
        "EastCoin User"
      ),
      profileImageUrl:String(
        raw.profileImageUrl ||
        raw.profile_image_url ||
        raw.avatar ||
        ""
      )
    };
  }

  function normalizeBackendMarket(raw) {
    const awayRaw =
      raw?.away ||
      raw?.teams?.away ||
      {};

    const homeRaw =
      raw?.home ||
      raw?.teams?.home ||
      {};

    const startsAt =
      toTimestamp(
        raw?.startsAt ||
        raw?.starts_at ||
        raw?.date,
        Date.now()
      );

    const awayZ =
      Number(
        raw?.pool?.awayZcoins ??
        raw?.pool?.away ??
        raw?.awayZcoins ??
        0
      );

    const homeZ =
      Number(
        raw?.pool?.homeZcoins ??
        raw?.pool?.home ??
        raw?.homeZcoins ??
        0
      );

    const awayTickets =
      Number(
        raw?.pool?.awayTickets ??
        raw?.awayTickets ??
        0
      );

    const homeTickets =
      Number(
        raw?.pool?.homeTickets ??
        raw?.homeTickets ??
        0
      );

    return {
      id:String(
        raw?.id ||
        raw?.marketId ||
        raw?.eventId ||
        ""
      ),
      eventId:String(
        raw?.eventId ||
        raw?.event_id ||
        ""
      ),
      sport:String(
        raw?.sport ||
        raw?.category ||
        "other"
      ),
      family:String(
        raw?.family ||
        raw?.sportFamily ||
        sportFamilyFromKey(
          raw?.sport
        )
      ),
      away:String(
        awayRaw?.name ||
        awayRaw?.displayName ||
        "Away"
      ),
      home:String(
        homeRaw?.name ||
        homeRaw?.displayName ||
        "Home"
      ),
      awayLogo:String(
        awayRaw?.badge ||
        awayRaw?.logo ||
        awayRaw?.image ||
        ""
      ),
      homeLogo:String(
        homeRaw?.badge ||
        homeRaw?.logo ||
        homeRaw?.image ||
        ""
      ),
      startTs:startsAt,
      live:Boolean(raw?.live),
      popular:Boolean(
        raw?.popular
      ),
      state:String(
        raw?.state ||
        "OPEN"
      ).toUpperCase(),
      pool:{
        away:awayZ,
        home:homeZ,
        total:Number(
          raw?.pool?.totalZcoins ??
          raw?.pool?.total ??
          awayZ + homeZ
        ),
        awayCount:
          awayTickets,
        homeCount:
          homeTickets
      },
      userPick:
        raw?.userPick ||
        null
    };
  }

  function normalizeBackendPick(raw) {
    const market =
      raw?.market || {};

    const game =
      normalizeBackendMarket({
        ...market,
        id:
          raw?.marketId ||
          market?.id,
        away:
          market?.away ||
          raw?.away,
        home:
          market?.home ||
          raw?.home
      });

    return {
      id:String(
        raw?.id ||
        ""
      ),
      gameId:String(
        raw?.marketId ||
        raw?.gameId ||
        game.id
      ),
      side:String(
        raw?.selection ||
        raw?.side ||
        ""
      ),
      wager:Number(
        raw?.wager ||
        0
      ),
      status:
        normalizePickStatus(
          raw?.status
        ),
      createdAt:
        toTimestamp(
          raw?.createdAt ||
          raw?.created_at,
          Date.now()
        ),
      settledAt:
        toTimestamp(
          raw?.settledAt ||
          raw?.settled_at,
          0
        ) || null,
      lockedPreview:Number(
        raw?.finalMultiplier ||
        raw?.projectedMultiplier ||
        raw?.lockedPreview ||
        2
      ),
      payout:Number(
        raw?.payout ||
        0
      ),
      profit:Number(
        raw?.profit ||
        0
      ),
      game
    };
  }

  function normalizeCommunityLedgerRow(
    raw
  ) {
    const market =
      raw?.market || {};

    const game =
      normalizeBackendMarket({
        ...market,
        id:
          raw?.marketId ||
          market?.id
      });

    return {
      id:String(
        raw?.id ||
        ""
      ),
      user:
        normalizeUser(
          raw?.user ||
          {}
        ),
      side:String(
        raw?.selection ||
        raw?.side ||
        ""
      ),
      wager:Number(
        raw?.wager ||
        0
      ),
      status:
        normalizePickStatus(
          raw?.status
        ),
      payout:Number(
        raw?.payout ||
        0
      ),
      profit:Number(
        raw?.profit ||
        0
      ),
      finalMultiplier:
        raw?.finalMultiplier ==
        null
          ? null
          : Number(
              raw.finalMultiplier
            ),
      createdAt:
        toTimestamp(
          raw?.createdAt ||
          raw?.created_at,
          Date.now()
        ),
      settledAt:
        toTimestamp(
          raw?.settledAt ||
          raw?.settled_at,
          0
        ) || null,
      game
    };
  }

  function backendMarketSnapshot(
    game,
    prospectiveSide = null,
    prospectiveWager = 0
  ) {
    let away = Number(game?.pool?.away || 0);
    let home = Number(game?.pool?.home || 0);
    let awayCount = Number(game?.pool?.awayCount || 0);
    let homeCount = Number(game?.pool?.homeCount || 0);

    if (prospectiveSide === "away" && prospectiveWager > 0) {
      away += prospectiveWager;
      awayCount += 1;
    }

    if (prospectiveSide === "home" && prospectiveWager > 0) {
      home += prospectiveWager;
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
      awayCount,
      homeCount,
      active,
      awayShare:total ? away / total : .5,
      homeShare:total ? home / total : .5,
      awayOdds:active ? total / away : 2,
      homeOdds:active ? total / home : 2
    };
  }

  function marketSnapshot(
    game,
    prospectiveSide = null,
    prospectiveWager = 0
  ) {
    if (state.mode === "backend") {
      return backendMarketSnapshot(
        game,
        prospectiveSide,
        prospectiveWager
      );
    }

    return Preview.market(
      game,
      prospectiveSide,
      prospectiveWager
    );
  }

  function currentWallet() {
    return Math.max(
      0,
      Math.floor(
        Number(state.session.walletBalance || 0)
      )
    );
  }

  function currentMaxBet() {
    if (state.mode === "backend") {
      const serverMax = Number(
        state.backend?.session?.wallet?.maxWager ??
        state.backend?.config?.maxWager ??
        0
      );

      if (serverMax > 0) {
        return Math.min(
          currentWallet(),
          Math.floor(serverMax)
        );
      }
    }

    return Preview.maxBet(currentWallet());
  }

  function familyLabel(family, sport) {
    const map = {
      "american-football":"FOOTBALL",
      baseball:"BASEBALL",
      basketball:"NBA",
      hockey:"NHL",
      soccer:"SOCCER",
      combat:"UFC / MMA",
      wrestling:"WRESTLING",
      motorsport:"MOTORSPORT",
      tennis:"TENNIS",
      golf:"GOLF"
    };

    return map[family] ||
      String(sport || "SPORT").toUpperCase();
  }

  function gameById(id) {
    return state.games.find(
      (game) => String(game.id) === String(id)
    );
  }

  function ticketForGame(id) {
    return state.tickets.find(
      (ticket) =>
        String(ticket.gameId) === String(id)
    );
  }

  function oddsText(multiplier, active) {
    return active
      ? `${Number(multiplier).toFixed(2)}x`
      : "Even";
  }

  function isLocked(game) {
    if (
      ["LOCKED", "SETTLED", "VOID", "NO_ACTION"]
        .includes(String(game?.state || "").toUpperCase())
    ) {
      return true;
    }

    return Boolean(
      game?.live ||
      Number(game?.startTs || 0) <= Date.now()
    );
  }

  function formatStart(game) {
    if (game?.live) return "Live";

    const stateName = String(game?.state || "").toUpperCase();
    if (stateName === "SETTLED") return "Settled";
    if (stateName === "VOID") return "Void";
    if (stateName === "NO_ACTION") return "No Action";

    const diff = Number(game?.startTs || 0) - Date.now();

    if (diff <= 0 || stateName === "LOCKED") {
      return "Locked";
    }

    const mins = Math.ceil(diff / 60000);

    if (mins < 60) {
      return `Locks in ${mins}m`;
    }

    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `Locks in ${h}h ${m}m`;
  }

  function logoMarkup(name, src) {
    const safeName = String(name || "");
    const safeSrc = String(src || "");

    return `
      <span class="team-logo">
        ${safeSrc
          ? `<img src="${safeSrc}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
          : ""}
        <span>${initials(safeName)}</span>
      </span>
    `;
  }

  function renderMode() {
    const preview = state.mode === "preview";

    els.modeBadge.hidden = !preview;

    if (preview) {
      els.modeBadge.textContent = "Frontend Preview";
      els.catalogStatus.classList.add("backend-note", "preview");
    } else {
      els.catalogStatus.classList.add("backend-note", "live");
    }
  }

  function renderAuth() {
    const loggedIn = state.session.authenticated;

    document.body.classList.toggle("logged-in", loggedIn);
    document.body.classList.toggle("logged-out", !loggedIn);

    els.authCardLoggedOut.hidden = loggedIn;
    els.authCardLoggedIn.hidden = !loggedIn;

    document
      .querySelectorAll("[data-wallet]")
      .forEach((node) => {
        node.textContent = loggedIn
          ? money(currentWallet())
          : "—";
      });

    const user = state.session.user;

    if (loggedIn && user) {
      const nameNode =
        els.authCardLoggedIn.querySelector(".nav-user strong");
      const avatarNode =
        els.authCardLoggedIn.querySelector(".nav-avatar");

      if (nameNode) {
        nameNode.textContent =
          user.displayName ||
          user.login ||
          "EastCoin User";
      }

      if (avatarNode) {
        avatarNode.textContent = initials(
          user.displayName || user.login
        );
      }
    }

    const syncLabel =
      state.mode === "backend"
        ? "● Twitch connected · StreamElements wallet"
        : "● Frontend preview · StreamElements wallet mock";

    els.walletSync.textContent = loggedIn
      ? syncLabel
      : state.mode === "backend"
        ? "Sign in to sync StreamElements"
        : "Preview wallet available after mock sign-in";

    els.mainWalletSync.textContent = loggedIn
      ? state.mode === "backend"
        ? "StreamElements ZCoins"
        : "StreamElements ZCoins preview"
      : "Sign in to view balance";
  }

  function renderSummary() {
    const season = state.season;
    const profit = Number(season.profit || 0);

    els.seasonProfit.textContent =
      `${profit >= 0 ? "+" : "−"}${money(Math.abs(profit))} ZCoins`;

    els.seasonRecord.textContent =
      `${Number(season.wins || 0)}–${Number(season.losses || 0)}`;

    els.seasonAccuracy.textContent =
      season.accuracy == null
        ? "No settled picks"
        : `${season.accuracy}% accuracy`;

    els.seasonRank.textContent =
      state.session.authenticated && season.rank
        ? `#${season.rank}${season.rankTitle ? " " + season.rankTitle : ""}`
        : "Unranked";

    els.pendingCount.textContent = String(
      state.tickets.filter(
        (ticket) => ticket.status === "pending"
      ).length
    );

    if (els.ledgerCount) {
      els.ledgerCount.textContent =
        String(
          state.communityLedger.length
        );
    }
  }

  function marketChoice(
    game,
    side,
    snapshot,
    ticket,
    locked,
    lower
  ) {
    const name =
      side === "away" ? game.away : game.home;

    const logo =
      side === "away" ? game.awayLogo : game.homeLogo;

    const odds =
      side === "away"
        ? snapshot.awayOdds
        : snapshot.homeOdds;

    const selected =
      ticket?.side === side ||
      String(game?.userPick?.selection || "") === side;

    const higher = lower === side;

    return `
      <button
        class="team-choice ${selected ? "user-pick" : ""} ${higher ? "higher-payout" : ""}"
        type="button"
        data-pick="${side}"
        data-game="${game.id}"
        ${locked || Boolean(ticket) || Boolean(game?.userPick) ? "disabled" : ""}>
        ${logoMarkup(name, logo)}
        <span class="team-name">
          <strong>${name}</strong>
          <small>${
            selected
              ? "Your locked pick"
              : higher
                ? "Higher payout"
                : "Pick winner"
          }</small>
        </span>
        <span class="team-price">
          <strong>${oddsText(odds, snapshot.active)}</strong>
          <small>${state.session.authenticated ? "Pick" : "Login"}</small>
        </span>
      </button>
    `;
  }

  function renderMarkets(filter = "") {
    const query =
      String(filter || "")
        .trim()
        .toLowerCase();

    const list = state.games.filter((game) => {
      if (!query) return true;

      return [
        game.away,
        game.home,
        game.sport,
        game.family
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    if (!list.length) {
      els.marketList.innerHTML =
        '<div class="empty">No current markets match that search.</div>';
      return;
    }

    els.marketList.innerHTML = list
      .map((game) => {
        const snapshot = marketSnapshot(game);
        const ticket = ticketForGame(game.id);
        const locked = isLocked(game);

        const lower = snapshot.active
          ? snapshot.awayOdds > snapshot.homeOdds
            ? "away"
            : snapshot.homeOdds > snapshot.awayOdds
              ? "home"
              : null
          : null;

        let statusText = "Waiting";
        let statusClass = "waiting";

        if (locked) {
          statusText = String(game.state || "").toUpperCase() === "SETTLED"
            ? "Settled"
            : "Locked";
          statusClass = "locked";
        } else if (snapshot.active) {
          statusText = "Live odds";
          statusClass = "";
        }

        return `
          <article class="market-card ${locked ? "locked" : ""}">
            <header class="market-card-head">
              <div class="market-meta">
                <span class="sport-badge">${familyLabel(game.family, game.sport)}</span>
                <span class="market-lock">${formatStart(game)}</span>
              </div>
              <span class="market-status ${statusClass}">${statusText}</span>
            </header>

            <div class="market-body">
              ${marketChoice(game, "away", snapshot, ticket, locked, lower)}
              ${marketChoice(game, "home", snapshot, ticket, locked, lower)}
            </div>

            <div class="market-pool">
              <div class="pool-head">
                <span>EastCoin Pool</span>
                <strong>
                  <img src="assets/eastcoins-logo.webp" alt="">
                  ${money(snapshot.total)} ZCoins
                </strong>
              </div>
              <div class="pool-track">
                <i style="width:${Math.max(
                  0,
                  Math.min(100, snapshot.awayShare * 100)
                )}%"></i>
              </div>
              <div class="pool-labels">
                <span><b>${game.away}</b> ${Math.round(snapshot.awayShare * 100)}%</span>
                <span>${Math.round(snapshot.homeShare * 100)}% <b>${game.home}</b></span>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    els.marketList
      .querySelectorAll("[data-pick]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          requestPick(
            button.dataset.game,
            button.dataset.pick
          );
        });
      });
  }

  function ticketGame(ticket) {
    return (
      ticket.game ||
      gameById(ticket.gameId) ||
      {
        id:ticket.gameId,
        away:"Away",
        home:"Home",
        awayLogo:"",
        homeLogo:"",
        startTs:Date.now()
      }
    );
  }

  function renderTickets() {
    const sorted = [...state.tickets]
      .sort(
        (a, b) =>
          Number(b.createdAt || 0) -
          Number(a.createdAt || 0)
      );

    if (!sorted.length) {
      els.ticketList.innerHTML =
        '<div class="empty">No picks yet. Choose a team from Markets to create your first ticket.</div>';
      return;
    }

    els.ticketList.innerHTML = sorted
      .map((ticket) => {
        const game = ticketGame(ticket);

        const pickedName =
          ticket.side === "away"
            ? game.away
            : game.home;

        const pickedLogo =
          ticket.side === "away"
            ? game.awayLogo
            : game.homeLogo;

        const opponent =
          ticket.side === "away"
            ? game.home
            : game.away;

        const currentGame =
          gameById(ticket.gameId) ||
          game;

        const snapshot =
          marketSnapshot(currentGame);

        const currentOdds =
          ticket.side === "away"
            ? snapshot.awayOdds
            : snapshot.homeOdds;

        const projected =
          ticket.status === "won"
            ? Number(ticket.payout || 0)
            : ticket.status === "lost"
              ? 0
              : ticket.status === "refunded"
                ? ticket.wager
                : snapshot.active
                  ? Math.max(
                      ticket.wager,
                      Math.round(ticket.wager * currentOdds)
                    )
                  : ticket.wager * 2;

        return `
          <article class="ticket ${ticket.status}">
            <header class="ticket-head">
              <div class="ticket-team">
                ${logoMarkup(pickedName, pickedLogo)}
                <span>
                  <strong>${pickedName}</strong>
                  <small>vs ${opponent}</small>
                </span>
              </div>
              <span class="ticket-status">${ticket.status}</span>
            </header>

            <div class="ticket-grid">
              <div class="ticket-stat">
                <span>Wager</span>
                <strong>${money(ticket.wager)} ZC</strong>
              </div>
              <div class="ticket-stat">
                <span>${ticket.status === "pending" ? "Current Odds" : "Final"}</span>
                <strong>${
                  snapshot.active
                    ? currentOdds.toFixed(2) + "x"
                    : "Even"
                }</strong>
              </div>
              <div class="ticket-stat return">
                <span>${
                  ticket.status === "pending"
                    ? "Potential"
                    : ticket.status === "won"
                      ? "Payout"
                      : ticket.status === "refunded"
                        ? "Refund"
                        : "Return"
                }</span>
                <strong>${money(projected)} ZC</strong>
              </div>
            </div>

            <div class="ticket-foot">
              ${
                ticket.status === "pending"
                  ? "Final pool multiplier locks when the game starts."
                  : ticket.status === "won"
                    ? "Winning ticket settled."
                    : ticket.status === "refunded"
                      ? "Full wager returned."
                      : "Ticket settled."
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  function normalizeLeaderboardRow(row, index) {
    const user = normalizeUser(row?.user || row);

    return {
      rank:Number(row?.rank || index + 1),
      user,
      profit:Number(row?.profit || row?.picksProfit || 0),
      wins:Number(row?.wins || 0),
      losses:Number(row?.losses || 0),
      wallet:Number(
        row?.walletBalance ??
        row?.wallet ??
        0
      ),
      title:String(row?.title || "")
    };
  }

  function twitchAvatarCacheKey(username) {
    return `eastcoinTwitchAvatarV1:${String(username || "").toLowerCase()}`;
  }

  function readCachedTwitchAvatar(username) {
    const key = String(username || "").toLowerCase();

    if (twitchAvatarMemory.has(key)) {
      return twitchAvatarMemory.get(key);
    }

    try {
      const cached = JSON.parse(
        localStorage.getItem(twitchAvatarCacheKey(key)) ||
        "null"
      );

      if (
        cached &&
        /^https?:\/\//i.test(String(cached.url || "")) &&
        Date.now() - Number(cached.savedAt || 0) <
          6 * 60 * 60 * 1000
      ) {
        twitchAvatarMemory.set(key, cached.url);
        return cached.url;
      }
    } catch {}

    return "";
  }

  function cacheTwitchAvatar(username, url) {
    const key = String(username || "").toLowerCase();

    if (
      !key ||
      !/^https?:\/\//i.test(String(url || ""))
    ) {
      return;
    }

    twitchAvatarMemory.set(key, url);

    try {
      localStorage.setItem(
        twitchAvatarCacheKey(key),
        JSON.stringify({
          url,
          savedAt:Date.now()
        })
      );
    } catch {}
  }

  async function getTwitchAvatar(username) {
    const cached = readCachedTwitchAvatar(username);
    if (cached) return cached;

    const response = await fetch(
      `https://decapi.me/twitch/avatar/${encodeURIComponent(
        String(username || "").toLowerCase()
      )}`,
      {
        headers:{Accept:"text/plain"},
        cache:"no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Avatar request returned ${response.status}`
      );
    }

    const url = (await response.text()).trim();

    if (!/^https?:\/\//i.test(url)) {
      throw new Error(
        "Avatar service returned an invalid URL"
      );
    }

    cacheTwitchAvatar(username, url);
    return url;
  }

  async function hydrateTwitchAvatars(root = document) {
    const nodes = [
      ...root.querySelectorAll("[data-twitch-avatar]")
    ];

    const groups = new Map();

    nodes.forEach((node) => {
      const username = String(
        node.dataset.twitchAvatar || ""
      ).toLowerCase();

      if (!username) return;

      if (!groups.has(username)) {
        groups.set(username, []);
      }

      groups.get(username).push(node);
    });

    await Promise.allSettled(
      [...groups.entries()].map(
        async ([username, usernameNodes]) => {
          const first = usernameNodes[0];
          const provided = String(
            first.dataset.avatarUrl || ""
          );

          let url = provided;

          if (!url) {
            try {
              url = await getTwitchAvatar(username);
            } catch (error) {
              console.warn(
                `Twitch avatar unavailable for ${username}`,
                error
              );
              return;
            }
          }

          usernameNodes.forEach((node) => {
            if (node.querySelector("img")) return;

            const img = document.createElement("img");
            img.src = url;
            img.alt = "";
            img.loading = "lazy";
            img.decoding = "async";
            img.referrerPolicy = "no-referrer";

            img.addEventListener(
              "load",
              () => node.classList.add("has-image"),
              {once:true}
            );

            img.addEventListener(
              "error",
              () => img.remove(),
              {once:true}
            );

            node.prepend(img);
          });
        }
      )
    );
  }

  function leaderChipMarkup(row) {
    const rank = row.rank;
    const user = row.user;
    const record = `${row.wins}–${row.losses}`;

    return `
      <article class="top-leader-chip">
        <span
          class="top-leader-avatar"
          data-twitch-avatar="${user.login}"
          data-avatar-url="${user.profileImageUrl || ""}">
          <span>${initials(user.displayName || user.login)}</span>
          <b>${rank === 1 ? "👑" : "#" + rank}</b>
        </span>
        <span class="top-leader-name">
          <strong>${user.displayName || user.login}</strong>
          <small>${record}</small>
        </span>
        <span class="top-leader-profit">
          ${row.profit >= 0 ? "+" : "−"}${money(Math.abs(row.profit))} ZC
        </span>
      </article>
    `;
  }

  function stopTopLeaderAutoScroll() {
    if (topLeaderScrollFrame) {
      cancelAnimationFrame(topLeaderScrollFrame);
      topLeaderScrollFrame = 0;
    }

    topLeaderLastTime = 0;
  }

  function startTopLeaderAutoScroll() {
    stopTopLeaderAutoScroll();

    const viewport = els.topLeadersList;
    const firstSet =
      els.topLeadersTrack?.querySelector(".top-leader-set");

    if (!viewport || !firstSet) return;

    viewport.scrollLeft = 0;

    const tick = (time) => {
      if (!topLeaderLastTime) {
        topLeaderLastTime = time;
      }

      const delta = Math.min(
        50,
        time - topLeaderLastTime
      );

      topLeaderLastTime = time;

      const setWidth =
        firstSet.getBoundingClientRect().width;

      if (
        setWidth > viewport.clientWidth &&
        !viewport.matches(":hover") &&
        !document.hidden
      ) {
        viewport.scrollLeft += delta * .030;

        if (viewport.scrollLeft >= setWidth) {
          viewport.scrollLeft -= setWidth;
        }
      }

      topLeaderScrollFrame =
        requestAnimationFrame(tick);
    };

    topLeaderScrollFrame =
      requestAnimationFrame(tick);
  }

  function renderTopLeaders() {
    const leaders = state.leaderboard
      .map(normalizeLeaderboardRow)
      .slice(0, 8);

    if (!leaders.length) {
      els.topLeadersTrack.innerHTML = `
        <div class="top-leader-set">
          <article class="top-leader-chip">
            <span class="top-leader-avatar"><span>EC</span><b>—</b></span>
            <span class="top-leader-name">
              <strong>Season leaderboard</strong>
              <small>Starts with real Picks activity</small>
            </span>
            <span class="top-leader-profit">—</span>
          </article>
        </div>
      `;
      stopTopLeaderAutoScroll();
      return;
    }

    const chips = leaders
      .map(leaderChipMarkup)
      .join("");

    els.topLeadersTrack.innerHTML = `
      <div class="top-leader-set">${chips}</div>
      <div class="top-leader-set" aria-hidden="true">${chips}</div>
    `;

    hydrateTwitchAvatars(els.topLeadersTrack);
    startTopLeaderAutoScroll();
  }

  function renderLeaderboard() {
    const rows =
      state.leaderboard
        .map(
          normalizeLeaderboardRow
        );

    if (!rows.length) {
      els.leaderboard.innerHTML =
        '<div class="empty">The Picks leaderboard begins once real Picks are settled.</div>';
      return;
    }

    els.leaderboard.innerHTML = `
      <div class="leader-head">
        <span>Rank</span>
        <span>User</span>
        <span style="text-align:right">Picks Profit</span>
        <span style="text-align:right">Record</span>
      </div>

      ${rows
        .map(
          (row) => `
          <div class="leader-row ${
            row.user.login ===
            state.session.user?.login
              ? "me"
              : ""
          }">
            <span class="leader-rank">#${row.rank}</span>
            <div class="leader-user">
              <span
                class="leader-avatar"
                data-twitch-avatar="${row.user.login}"
                data-avatar-url="${row.user.profileImageUrl || ""}">
                <span>${initials(row.user.displayName || row.user.login)}</span>
              </span>
              <span>
                <strong>${row.user.displayName || row.user.login}${row.rank === 1 ? " 👑" : ""}</strong>
                <small>${row.title || "EastCoin Picks"}</small>
              </span>
            </div>
            <span class="leader-profit">
              ${row.profit >= 0 ? "+" : "−"}${money(Math.abs(row.profit))} ZC
            </span>
            <span class="leader-record">${row.wins}–${row.losses}</span>
          </div>
        `
        )
        .join("")}
    `;

    hydrateTwitchAvatars(
      els.leaderboard
    );
  }

  function historyTime(timestamp) {
    const diff = Math.max(
      0,
      Date.now() - Number(timestamp || 0)
    );

    const mins = Math.floor(diff / 60000);

    if (mins < 60) {
      return mins <= 1
        ? "Just now"
        : `${mins}m ago`;
    }

    const hours = Math.floor(mins / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    return `${Math.floor(hours / 24)}d ago`;
  }

  function renderHistory() {
    const rows = [...state.history]
      .sort(
        (a, b) =>
          Number(b.createdAt || 0) -
          Number(a.createdAt || 0)
      );

    if (!rows.length) {
      els.historyList.innerHTML =
        '<div class="empty">Your Picks wagers, payouts and refunds will appear here.</div>';
      return;
    }

    const icon = {
      wager:"↗",
      payout:"✓",
      refund:"↩"
    };

    els.historyList.innerHTML = rows
      .map((row) => `
        <article class="history-row ${row.type}">
          <span class="history-icon">${icon[row.type] || "•"}</span>
          <span class="history-copy">
            <strong>${row.title}</strong>
            <small>${row.detail}</small>
          </span>
          <span class="history-amount">
            <strong>${Number(row.amount) < 0 ? "−" : "+"}${money(Math.abs(row.amount))} ZCoins</strong>
            <small>${historyTime(row.createdAt)}</small>
          </span>
        </article>
      `)
      .join("");
  }

  function ledgerStatusLabel(
    status
  ) {
    return ({
      pending: "Bet Open",
      won: "Won",
      lost: "Lost",
      refunded: "Refund"
    })[status] ||
      status ||
      "Pick";
  }

  function renderCommunityLedger() {
    if (
      !els.communityLedger
    ) {
      return;
    }

    const rows =
      [
        ...state.communityLedger
      ].sort(
        (left, right) =>
          Number(
            right.settledAt ||
            right.createdAt ||
            0
          ) -
          Number(
            left.settledAt ||
            left.createdAt ||
            0
          )
      );

    if (!rows.length) {
      els.communityLedger.innerHTML =
        state.mode === "preview"
          ? '<div class="empty">Community Ledger uses live Picks database records and is not populated with preview users.</div>'
          : '<div class="empty">No community Picks activity has been recorded yet.</div>';
      return;
    }

    els.communityLedger.innerHTML =
      rows.map((row) => {
        const game =
          row.game || {};

        const picked =
          row.side === "away"
            ? game.away
            : game.home;

        const opponent =
          row.side === "away"
            ? game.home
            : game.away;

        const status =
          row.status ||
          "pending";

        const returned =
          status === "won"
            ? Number(
                row.payout || 0
              )
            : status ===
                "refunded"
              ? Number(
                  row.wager || 0
                )
              : status === "lost"
                ? 0
                : null;

        const net =
          status === "won"
            ? Number(
                row.profit ||
                returned -
                  Number(
                    row.wager || 0
                  )
              )
            : status === "lost"
              ? -Math.abs(
                  Number(
                    row.wager || 0
                  )
                )
              : status ===
                  "refunded"
                ? 0
                : null;

        const user =
          row.user || {};

        const mine =
          Boolean(
            state.session.user?.id &&
            user.id &&
            String(
              state.session.user.id
            ) ===
              String(user.id)
          );

        return `
          <article class="community-ledger-row ${status} ${mine ? "me" : ""}">
            <div class="ledger-user">
              <span
                class="ledger-avatar"
                data-twitch-avatar="${user.login || ""}"
                data-avatar-url="${user.profileImageUrl || ""}">
                <span>${initials(user.displayName || user.login || "EC")}</span>
              </span>
              <span class="ledger-user-copy">
                <strong>${user.displayName || user.login || "EastCoin User"}</strong>
                <small>${user.login ? "@" + user.login : "Community member"}</small>
              </span>
            </div>

            <div class="ledger-pick">
              <strong>${picked || "Pick"}</strong>
              <small>
                vs ${opponent || "Opponent"} ·
                ${familyLabel(game.family, game.sport)}
              </small>
            </div>

            <div class="ledger-stat">
              <span>Wager</span>
              <strong>${money(row.wager)} ZC</strong>
            </div>

            <div class="ledger-stat net ${net == null ? "" : net >= 0 ? "positive" : "negative"}">
              <span>${returned == null ? "Pool" : "Net"}</span>
              <strong>
                ${net == null
                  ? "Open"
                  : (net > 0 ? "+" : net < 0 ? "−" : "") +
                    money(
                      Math.abs(net)
                    ) +
                    " ZC"}
              </strong>
            </div>

            <div class="ledger-result">
              <span class="ledger-status">${ledgerStatusLabel(status)}</span>
              <small>${historyTime(row.settledAt || row.createdAt)}</small>
            </div>
          </article>
        `;
      }).join("");

    hydrateTwitchAvatars(
      els.communityLedger
    );
  }

  function render() {
    renderMode();
    renderAuth();
    renderSummary();
    renderTopLeaders();
    renderMarkets(els.navSearch.value);
    renderTickets();
    renderLeaderboard();
    renderHistory();
    renderCommunityLedger();
  }

  async function loadPreview(force = false) {
    const catalog = await Preview.loadGames(force);

    state.mode = "preview";
    state.backend = null;
    state.games = catalog.games;
    state.session.authenticated =
      Preview.isLoggedIn();

    state.session.user =
      state.session.authenticated
        ? {
            id:"preview-zwades",
            login:"zwades",
            displayName:"Zwades",
            profileImageUrl:""
          }
        : null;

    state.session.walletBalance =
      Preview.walletBalance();

    state.tickets =
      Preview.enrichedTickets();

    state.history =
      Preview.historyEntries();

    state.communityLedger = [];

    state.session.walletConnected = true;

    const previewSeason =
      Preview.seasonStats();

    state.season = {
      ...previewSeason
    };

    state.leaderboard =
      Preview.leaderboardSeed.map(
        (row) => ({
          ...row,
          user:{
            login:row.login,
            displayName:row.displayName,
            profileImageUrl:""
          }
        })
      );

    els.catalogStatus.textContent =
      catalog.status;

    render();
  }

  function applyBackendBootstrap(payload) {
    state.mode = "backend";
    state.backend = payload || {};

    const session = payload?.session || {};
    const user = session?.user
      ? normalizeUser(session.user)
      : null;

    state.session = {
      authenticated:Boolean(
        session?.authenticated ||
        user?.id ||
        user?.login
      ),
      user,
      walletBalance:Number(
        session?.wallet?.balance ??
        session?.walletBalance ??
        0
      ),
      walletConnected:Boolean(
        session?.wallet?.connected
      )
    };

    state.games = Array.isArray(payload?.markets)
      ? payload.markets
          .map(normalizeBackendMarket)
          .filter((market) => market.id)
      : [];

    state.tickets = Array.isArray(payload?.myPicks)
      ? payload.myPicks
          .map(normalizeBackendPick)
      : [];

    state.history = Array.isArray(payload?.history)
      ? payload.history.map((row) => ({
          id:String(row?.id || ""),
          type:String(row?.type || "wager").toLowerCase(),
          amount:Number(row?.amount || 0),
          title:String(row?.title || "EastCoin Picks"),
          detail:String(row?.detail || ""),
          createdAt:toTimestamp(
            row?.createdAt ||
            row?.created_at,
            Date.now()
          )
        }))
      : [];

    state.communityLedger =
      Array.isArray(
        payload?.communityLedger
      )
        ? payload.communityLedger
            .map(
              normalizeCommunityLedgerRow
            )
        : [];

    const season = payload?.season || {};

    state.season = {
      wins:Number(season?.wins || 0),
      losses:Number(season?.losses || 0),
      profit:Number(
        season?.profit ||
        season?.picksProfit ||
        0
      ),
      accuracy:
        season?.accuracy == null
          ? null
          : Number(season.accuracy),
      rank:
        season?.rank == null
          ? null
          : Number(season.rank),
      rankTitle:String(
        season?.rankTitle ||
        season?.title ||
        ""
      )
    };

    state.leaderboard = Array.isArray(payload?.leaderboard)
      ? payload.leaderboard
      : [];

    els.catalogStatus.textContent =
      `Live Picks · ${state.games.length} current markets`;

    render();
  }

  function setUnavailable(
    error
  ) {
    state.mode =
      "unavailable";

    state.backend = null;
    state.games = [];
    state.leaderboard = [];
    state.tickets = [];
    state.history = [];
    state.communityLedger = [];

    state.session = {
      authenticated:false,
      user:null,
      walletBalance:0,
      walletConnected:false
    };

    state.season = {
      wins:0,
      losses:0,
      profit:0,
      accuracy:null,
      rank:null,
      rankTitle:""
    };

    els.catalogStatus.textContent =
      error?.message ||
      "Picks is temporarily unavailable.";

    render();
  }

  async function bootstrap({
    forcePreview = false
  } = {}) {
    els.catalogStatus.textContent =
      "Loading current EastCoin markets…";

    if (
      forcePreview ||
      PREVIEW_REQUESTED
    ) {
      await loadPreview(false);
      return;
    }

    if (API?.getBootstrap) {
      try {
        const payload =
          await API.getBootstrap();

        if (
          payload &&
          Array.isArray(
            payload.markets
          )
        ) {
          applyBackendBootstrap(
            payload
          );
          return;
        }

        throw new Error(
          "Picks returned an invalid response."
        );
      } catch (error) {
        if (
          LOCAL_PREVIEW_ALLOWED
        ) {
          await loadPreview(
            false
          );
          return;
        }

        console.error(
          "Live Picks bootstrap failed.",
          error
        );

        setUnavailable(
          error
        );
        return;
      }
    }

    if (
      LOCAL_PREVIEW_ALLOWED
    ) {
      await loadPreview(false);
      return;
    }

    setUnavailable(
      new Error(
        "The Picks API did not load."
      )
    );
  }

  async function refresh() {
    if (
      state.mode === "preview"
    ) {
      await loadPreview(true);
      return;
    }

    await bootstrap();
  }

  function requestPick(gameId, side) {
    const game = gameById(gameId);

    if (
      !game ||
      isLocked(game) ||
      ticketForGame(gameId) ||
      game.userPick
    ) {
      return;
    }

    if (!state.session.authenticated) {
      state.pendingAuthPick = {
        gameId,
        side
      };

      openAuth();
      return;
    }

    openBet(gameId, side);
  }

  function openAuth() {
    if (state.mode === "preview") {
      els.authNote.textContent =
        "Frontend preview only — this simulates Twitch OAuth as Zwades. The real Worker will redirect to Twitch and EastCoin will never receive your Twitch password.";
    } else {
      els.authNote.textContent =
        "Twitch sign-in happens on Twitch. EastCoin never sees or stores your Twitch password.";
    }

    openBackdrop(els.authBackdrop);
  }

  function openBet(gameId, side) {
    const game = gameById(gameId);
    if (!game) return;

    const max = currentMaxBet();

    if (max < 1) {
      toast("You do not have enough ZCoins to place a pick.");
      return;
    }

    state.activeBet = {
      gameId,
      side,
      wager:Math.min(10, max)
    };

    els.selectedMatch.innerHTML = `
      <span class="match-side">
        ${logoMarkup(game.away, game.awayLogo)}
        <strong>${game.away}</strong>
      </span>
      <span class="match-vs">VS</span>
      <span class="match-side" style="justify-content:flex-end">
        <strong>${game.home}</strong>
        ${logoMarkup(game.home, game.homeLogo)}
      </span>
    `;

    const selectedName =
      side === "away"
        ? game.away
        : game.home;

    const selectedLogo =
      side === "away"
        ? game.awayLogo
        : game.homeLogo;

    els.selectedSide.innerHTML = `
      ${logoMarkup(selectedName, selectedLogo)}
      <span>${selectedName}</span>
    `;

    els.betWallet.textContent =
      `${money(currentWallet())} ZCoins`;

    els.betMax.textContent =
      `${money(max)} ZCoins`;

    els.wagerRange.min = "1";
    els.wagerRange.max = String(max);
    els.wagerRange.value =
      String(state.activeBet.wager);

    els.maxScale.textContent =
      `${money(max)} max`;

    updateBet();
    openBackdrop(els.betBackdrop);
    els.wagerRange.focus();
  }

  function updateBet() {
    const activeBet = state.activeBet;
    if (!activeBet) return;

    const game =
      gameById(activeBet.gameId);

    if (!game) return;

    const max = currentMaxBet();

    const wager = Math.max(
      1,
      Math.min(
        max,
        Math.floor(
          Number(els.wagerRange.value) || 1
        )
      )
    );

    activeBet.wager = wager;

    const pct =
      max === 1
        ? 100
        : ((wager - 1) / (max - 1)) * 100;

    els.wagerRange.style.setProperty(
      "--pct",
      `${Math.max(0, Math.min(100, pct))}%`
    );

    els.wagerValue.textContent =
      `${money(wager)} ${wager === 1 ? "ZCoin" : "ZCoins"}`;

    els.balanceAfter.textContent =
      `${money(currentWallet() - wager)} ZCoins`;

    const snapshot = marketSnapshot(
      game,
      activeBet.side,
      wager
    );

    const multiplier =
      activeBet.side === "away"
        ? snapshot.awayOdds
        : snapshot.homeOdds;

    const returnAmount =
      snapshot.active
        ? Math.round(wager * multiplier)
        : wager * 2;

    els.projectedOdds.textContent =
      oddsText(multiplier, snapshot.active);

    els.oddsNote.textContent =
      snapshot.active
        ? "Your wager is included in this projected pool. Projected pool multiplier remains live until game start."
        : "Even is shown while the projected pool is still one-sided. A one-sided market at lock is No Action and refunded.";

    els.projectedPools.innerHTML = `
      <div class="projected-side">
        <div class="projected-team">
          ${logoMarkup(game.away, game.awayLogo)}
          <strong>${game.away}</strong>
        </div>
        <strong>
          ${money(snapshot.away)} ZCoins ·
          ${Math.round(snapshot.awayShare * 100)}%
        </strong>
      </div>

      <div class="projected-side">
        <div class="projected-team">
          ${logoMarkup(game.home, game.homeLogo)}
          <strong>${game.home}</strong>
        </div>
        <strong>
          ${money(snapshot.home)} ZCoins ·
          ${Math.round(snapshot.homeShare * 100)}%
        </strong>
      </div>
    `;

    els.totalRiding.textContent =
      money(snapshot.total);

    els.potentialWinnings.textContent =
      `${money(returnAmount)} ZCoins`;
  }

  async function lockPick() {
    const activeBet = state.activeBet;

    if (
      !activeBet ||
      !state.session.authenticated
    ) {
      return;
    }

    const game =
      gameById(activeBet.gameId);

    if (!game) return;

    els.lockPickBtn.disabled = true;
    els.lockPickBtn.textContent =
      "Locking Pick…";

    try {
      const snapshot =
        marketSnapshot(
          game,
          activeBet.side,
          activeBet.wager
        );

      const multiplier =
        activeBet.side === "away"
          ? snapshot.awayOdds
          : snapshot.homeOdds;

      if (state.mode === "backend") {
        const idempotencyKey =
          crypto.randomUUID
            ? crypto.randomUUID()
            : `pick-${Date.now()}-${Math.random()}`;

        await API.placePick({
          marketId:game.id,
          selection:activeBet.side,
          wager:activeBet.wager,
          idempotencyKey
        });

        closeBackdrop(els.betBackdrop);
        state.activeBet = null;
        await bootstrap();
        toast("Pick locked.");
        return;
      }

      Preview.placeTicket({
        game,
        side:activeBet.side,
        wager:activeBet.wager,
        previewMultiplier:multiplier
      });

      closeBackdrop(els.betBackdrop);
      state.activeBet = null;
      await loadPreview(false);
      toast(
        "Preview pick locked. Final odds will be set when the game starts."
      );
    } catch (error) {
      toast(
        error?.message ||
        "Could not lock that pick."
      );
    } finally {
      els.lockPickBtn.disabled = false;
      els.lockPickBtn.textContent =
        "Lock Pick";
    }
  }

  function authReturnTo() {
    if (
      V2_EMBEDDED &&
      window.parent !== window
    ) {
      try {
        return (
          window.parent.location.pathname +
          window.parent.location.search +
          window.parent.location.hash
        );
      } catch {}
    }

    return (
      window.location.pathname +
      window.location.search +
      window.location.hash
    );
  }

  async function completeLogin() {
    if (state.mode !== "preview") {
      window.location.href =
        API.authUrl(
          authReturnTo()
        );
      return;
    }

    Preview.login();
    closeBackdrop(els.authBackdrop);
    await loadPreview(false);

    toast(
      "Preview Twitch account connected."
    );

    if (state.pendingAuthPick) {
      const pending =
        state.pendingAuthPick;

      state.pendingAuthPick = null;

      window.setTimeout(
        () =>
          openBet(
            pending.gameId,
            pending.side
          ),
        100
      );
    }
  }

  async function logout() {
    try {
      if (state.mode !== "preview") {
        await API.logout();
        await bootstrap();
        return;
      }

      Preview.logout();
      await loadPreview(false);
      toast("Logged out of the preview Twitch account.");
    } catch (error) {
      toast(
        error?.message ||
        "Could not log out."
      );
    }
  }

  function openBackdrop(node) {
    node.classList.add("open");
    node.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeBackdrop(node) {
    node.classList.remove("open");
    node.setAttribute("aria-hidden", "true");

    if (!document.querySelector(".backdrop.open")) {
      document.body.style.overflow = "";
    }
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");

    window.clearTimeout(toastTimer);

    toastTimer = window.setTimeout(
      () => els.toast.classList.remove("show"),
      2600
    );
  }

  document
    .querySelectorAll("[data-jump-view]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const target =
          button.dataset.jumpView;

        const tab =
          document.querySelector(
            `[data-view="${target}"]`
          );

        if (tab) tab.click();

        window.scrollTo({
          top:0,
          behavior:"smooth"
        });
      });
    });

  document
    .querySelectorAll("[data-view]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        document
          .querySelectorAll("[data-view]")
          .forEach((item) =>
            item.classList.toggle(
              "active",
              item === button
            )
          );

        document
          .querySelectorAll("[data-view-panel]")
          .forEach((panel) =>
            panel.classList.toggle(
              "active",
              panel.dataset.viewPanel ===
                button.dataset.view
            )
          );
      });
    });

  document
    .querySelectorAll("[data-login]")
    .forEach((button) =>
      button.addEventListener(
        "click",
        openAuth
      )
    );

  els.mockLoginBtn.addEventListener(
    "click",
    completeLogin
  );

  els.closeAuth.addEventListener(
    "click",
    () => closeBackdrop(els.authBackdrop)
  );

  els.logoutBtn.addEventListener(
    "click",
    logout
  );

  els.closeBet.addEventListener(
    "click",
    () => closeBackdrop(els.betBackdrop)
  );

  els.wagerRange.addEventListener(
    "input",
    updateBet
  );

  els.lockPickBtn.addEventListener(
    "click",
    lockPick
  );

  els.rulesBtn.addEventListener(
    "click",
    () => openBackdrop(els.rulesBackdrop)
  );

  els.closeRules.addEventListener(
    "click",
    () => closeBackdrop(els.rulesBackdrop)
  );

  els.navSearch.addEventListener(
    "input",
    () =>
      renderMarkets(
        els.navSearch.value
      )
  );

  els.refreshBtn.addEventListener(
    "click",
    async () => {
      els.refreshBtn.disabled = true;
      els.refreshBtn.textContent =
        "Refreshing…";

      try {
        await refresh();
      } finally {
        els.refreshBtn.disabled = false;
        els.refreshBtn.textContent =
          "Refresh Games";
      }
    }
  );

  document
    .querySelectorAll("[data-shell-message]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        toast(button.dataset.shellMessage);
      });
    });

  [
    els.betBackdrop,
    els.authBackdrop,
    els.rulesBackdrop
  ].forEach((backdrop) => {
    backdrop.addEventListener(
      "click",
      (event) => {
        if (event.target === backdrop) {
          closeBackdrop(backdrop);
        }
      }
    );
  });

  document.addEventListener(
    "visibilitychange",
    () => {
      topLeaderLastTime = 0;
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      const open = [
        els.betBackdrop,
        els.authBackdrop,
        els.rulesBackdrop
      ].find((node) =>
        node.classList.contains("open")
      );

      if (open) {
        closeBackdrop(open);
      }
    }
  );

  function initializeStandalonePicksChat() {
    if (V2_EMBEDDED) {
      return;
    }

    const frame =
      document.querySelector(
        ".chat iframe[data-src]"
      );

    if (
      frame &&
      frame.getAttribute(
        "src"
      ) === "about:blank"
    ) {
      frame.src =
        frame.dataset.src;
    }
  }

  initializeStandalonePicksChat();
  bootstrap();
})();

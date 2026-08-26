(() => {
  "use strict";

  const BASE_WALLET = 3051;
  const MIN_BET = 1;
  const HARD_CAP = 50;
  const WALLET_CAP = 0.15;

  const AUTH_KEY = "eastcoinPicksPreviewAuthV1";
  const TICKETS_KEY = "eastcoinPicksPreviewTicketsV1";
  const SETTLEMENTS_KEY = "eastcoinPicksPreviewSettlementsV1";

  const fallbackGames = [
    {
      id:"demo-cle-bos",
      sport:"MLB",
      family:"baseball",
      away:"Cleveland Guardians",
      home:"Boston Red Sox",
      awayLogo:"",
      homeLogo:"",
      startTs:Date.now()+75*60*1000
    },
    {
      id:"demo-min-oak",
      sport:"MLB",
      family:"baseball",
      away:"Minnesota Twins",
      home:"Oakland Athletics",
      awayLogo:"",
      homeLogo:"",
      startTs:Date.now()+135*60*1000
    },
    {
      id:"demo-kc-phi",
      sport:"NFL",
      family:"american-football",
      away:"Kansas City Chiefs",
      home:"Philadelphia Eagles",
      awayLogo:"",
      homeLogo:"",
      startTs:Date.now()+210*60*1000
    },
    {
      id:"demo-lal-bos",
      sport:"NBA",
      family:"basketball",
      away:"Los Angeles Lakers",
      home:"Boston Celtics",
      awayLogo:"",
      homeLogo:"",
      startTs:Date.now()+270*60*1000
    }
  ];

  // These are UI-preview Picks stats, not claims about real Picks history.
  const leaderboardSeed = [
    {rank:1,login:"heartlarva",displayName:"heartlarva",profit:428,wins:18,losses:9,wallet:4117,title:"Hall of Famer"},
    {rank:2,login:"jimmytomato",displayName:"jimmytomato",profit:352,wins:16,losses:10,wallet:3747,title:"Super Bowl Winner"},
    {rank:3,login:"charleskellybirdlaw",displayName:"charleskellybirdlaw",profit:281,wins:14,losses:10,wallet:2890,title:"Pro Bowler"},
    {rank:4,login:"zwades",displayName:"zwades",profit:214,wins:13,losses:11,wallet:3051,title:"All-Pro",me:true},
    {rank:5,login:"danielsdong",displayName:"danielsdong",profit:182,wins:12,losses:10,wallet:1760,title:"Franchise Player"},
    {rank:6,login:"psilocyboone",displayName:"psilocyboone",profit:138,wins:11,losses:10,wallet:1697,title:"Team Captain"},
    {rank:7,login:"curiousfolk",displayName:"curiousfolk",profit:94,wins:10,losses:10,wallet:1032,title:"Starter"},
    {rank:8,login:"bootypaper",displayName:"bootypaper",profit:61,wins:9,losses:10,wallet:501,title:"Role Player"}
  ];

  const seedHistory = [
    {
      id:"preview-history-1",
      type:"payout",
      amount:42,
      title:"Kansas City Chiefs won",
      detail:"25 ZCoin wager · 1.68x final return",
      createdAt:Date.now()-18*60*60*1000,
      preview:true
    },
    {
      id:"preview-history-2",
      type:"wager",
      amount:-25,
      title:"Kansas City Chiefs vs Philadelphia Eagles",
      detail:"Picked Kansas City Chiefs",
      createdAt:Date.now()-26*60*60*1000,
      preview:true
    },
    {
      id:"preview-history-3",
      type:"refund",
      amount:15,
      title:"Minnesota Twins vs Oakland Athletics",
      detail:"Market closed No Action · full refund",
      createdAt:Date.now()-2*24*60*60*1000,
      preview:true
    }
  ];

  function safeParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadTickets() {
    const rows = safeParse(localStorage.getItem(TICKETS_KEY), []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveTickets(tickets) {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  }

  function loadSettlements() {
    const rows = safeParse(localStorage.getItem(SETTLEMENTS_KEY), {});
    return rows && typeof rows === "object" ? rows : {};
  }

  function saveSettlements(settlements) {
    localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(settlements));
  }

  function isLoggedIn() {
    return localStorage.getItem(AUTH_KEY) === "1";
  }

  function login() {
    localStorage.setItem(AUTH_KEY, "1");
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
  }

  function hashString(value) {
    let h = 2166136261;
    for (const ch of String(value)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function initials(value) {
    const words = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return (
      words
        .slice(-2)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 3) || "EC"
    );
  }

  function badgeRef(team) {
    return String(
      team?.badge ||
      team?.logo ||
      team?.image ||
      team?.icon ||
      ""
    ).trim();
  }

  function badgeUrl(team) {
    const ref = badgeRef(team);
    if (!ref) return "";
    if (/^https?:\/\//i.test(ref)) return ref;

    const api = window.EastcoinStreamedAPI;
    if (api?.badgeUrl) {
      try {
        return api.badgeUrl(ref) || "";
      } catch {}
    }

    if (ref.startsWith("/")) {
      return `https://streamed.st${ref}`;
    }

    return `https://streamed.st/api/images/badge/${encodeURIComponent(
      ref.replace(/\.webp$/i, "")
    )}.webp`;
  }

  function teamObject(raw, fallback) {
    if (!raw) return {name:fallback, badge:""};
    if (typeof raw === "string") return {name:raw, badge:""};

    return {
      name:String(raw.name || raw.title || raw.team || fallback),
      badge:badgeRef(raw)
    };
  }

  function splitTitle(title) {
    const parts = String(title || "")
      .split(/\s+(?:vs\.?|v\.?|@|at)\s+/i);

    if (parts.length !== 2) return null;

    return {
      away:{name:parts[0].trim(), badge:""},
      home:{name:parts[1].trim(), badge:""}
    };
  }

  function normalizeMatch(match) {
    const rawTeams = match?.teams;
    let away = null;
    let home = null;

    if (Array.isArray(rawTeams)) {
      away = teamObject(rawTeams[0], "Away");
      home = teamObject(rawTeams[1], "Home");
    } else if (rawTeams && typeof rawTeams === "object") {
      away = teamObject(
        rawTeams.away || rawTeams.visitor || rawTeams.team1 || rawTeams.a,
        "Away"
      );
      home = teamObject(
        rawTeams.home || rawTeams.host || rawTeams.team2 || rawTeams.h,
        "Home"
      );
    }

    if (!away || !home) {
      const parsed = splitTitle(match?.title);
      away ||= parsed?.away;
      home ||= parsed?.home;
    }

    if (!away?.name || !home?.name) return null;

    let ts = Number(
      match?.date ||
      match?.start ||
      match?.starts_at ||
      0
    );

    if (ts && ts < 1e12) ts *= 1000;
    if (!ts) ts = Date.now() + 60 * 60 * 1000;

    let family = "other";
    try {
      family =
        window.EastcoinStreamedAPI?.categoryFamily?.(
          match?.category || match?.sport || ""
        ) || "other";
    } catch {}

    return {
      id:String(
        match?.id ||
        `${away.name}-${home.name}-${ts}`
      ),
      sport:String(match?.category || match?.sport || family),
      family,
      away:away.name,
      home:home.name,
      awayLogo:badgeUrl(away),
      homeLogo:badgeUrl(home),
      startTs:ts,
      popular:Boolean(match?.popular),
      live:Boolean(match?._eastcoinLive),
      state:"OPEN"
    };
  }

  async function loadGames(force = false) {
    const api = window.EastcoinStreamedAPI;

    if (!api) {
      return {
        games:[...fallbackGames],
        status:"Demo markets · Streamed adapter unavailable"
      };
    }

    try {
      let result = null;

      if (typeof api.getToday === "function") {
        result = await api.getToday(force);
      } else if (typeof api.getDiscovery === "function") {
        result = await api.getDiscovery(force);
      } else if (typeof api.getAll === "function") {
        result = await api.getAll(force);
      }

      const raw = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : [];

      const mapped = raw
        .map(normalizeMatch)
        .filter(Boolean)
        .filter((game) =>
          game.startTs > Date.now() - 3 * 60 * 60 * 1000
        )
        .sort(
          (a, b) =>
            Number(b.popular) - Number(a.popular) ||
            a.startTs - b.startTs
        )
        .slice(0, 12);

      if (mapped.length) {
        return {
          games:mapped,
          status:`Frontend preview · ${mapped.length} current events`
        };
      }
    } catch (error) {
      console.warn("Picks preview catalog load failed", error);
    }

    return {
      games:[...fallbackGames],
      status:"Demo markets · current catalog temporarily unavailable"
    };
  }

  function basePool(game) {
    const h = hashString(game.id);
    let away = 45 + (h % 180);
    let home = 45 + ((h >>> 8) % 180);

    if ((h % 9) === 0) home = 0;
    if ((h % 11) === 0) away = 0;

    return {away, home};
  }

  function settlementFor(gameId) {
    return loadSettlements()[gameId] || null;
  }

  function ticketStatus(ticket, settlement = settlementFor(ticket.gameId)) {
    if (!settlement) return ticket.status || "pending";

    if (settlement.result === "void" || settlement.result === "no_action") {
      return "refunded";
    }

    return ticket.side === settlement.result ? "won" : "lost";
  }

  function ticketPayout(ticket, settlement = settlementFor(ticket.gameId)) {
    const status = ticketStatus(ticket, settlement);

    if (status === "won") {
      return Math.max(
        ticket.wager,
        Math.round(
          ticket.wager *
          Number(
            settlement?.finalMultiplier?.[ticket.side] ||
            ticket.lockedPreview ||
            2
          )
        )
      );
    }

    if (status === "refunded") {
      return ticket.wager;
    }

    return 0;
  }

  function enrichedTickets() {
    const settlements = loadSettlements();

    return loadTickets().map((ticket) => {
      const settlement = settlements[ticket.gameId] || null;
      const status = ticketStatus(ticket, settlement);
      const payout = ticketPayout(ticket, settlement);

      return {
        ...ticket,
        status,
        payout,
        profit:
          status === "won"
            ? payout - ticket.wager
            : status === "lost"
              ? -ticket.wager
              : 0,
        settledAt:
          settlement?.settledAt ||
          ticket.settledAt ||
          null
      };
    });
  }

  function walletBalance() {
    const tickets = enrichedTickets();

    let balance = BASE_WALLET;

    for (const ticket of tickets) {
      balance -= Number(ticket.wager || 0);

      if (
        ticket.status === "won" ||
        ticket.status === "refunded"
      ) {
        balance += Number(ticket.payout || 0);
      }
    }

    return Math.max(0, Math.floor(balance));
  }

  function maxBet(balance = walletBalance()) {
    if (balance <= 0) return 0;

    return Math.max(
      MIN_BET,
      Math.min(
        HARD_CAP,
        Math.floor(balance * WALLET_CAP)
      )
    );
  }

  function market(
    game,
    prospectiveSide = null,
    prospectiveWager = 0
  ) {
    const base = basePool(game);
    const settlement = settlementFor(game.id);
    const tickets = loadTickets()
      .filter((ticket) => ticket.gameId === game.id);

    let away = base.away;
    let home = base.home;
    let awayCount =
      away > 0 ? 2 + (hashString(game.id + "a") % 6) : 0;
    let homeCount =
      home > 0 ? 2 + (hashString(game.id + "h") % 6) : 0;

    for (const ticket of tickets) {
      if (ticket.side === "away") {
        away += Number(ticket.wager || 0);
        awayCount += 1;
      } else {
        home += Number(ticket.wager || 0);
        homeCount += 1;
      }
    }

    if (!settlement) {
      if (prospectiveSide === "away" && prospectiveWager > 0) {
        away += prospectiveWager;
        awayCount += 1;
      }

      if (prospectiveSide === "home" && prospectiveWager > 0) {
        home += prospectiveWager;
        homeCount += 1;
      }
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
      homeOdds:active ? total / home : 2,
      settlement
    };
  }

  function placeTicket({game, side, wager, previewMultiplier}) {
    const tickets = loadTickets();

    if (tickets.some((ticket) => ticket.gameId === game.id)) {
      throw new Error("You already have a pick on this game.");
    }

    const currentWallet = walletBalance();
    const allowed = maxBet(currentWallet);

    const amount = Math.floor(Number(wager || 0));

    if (amount < MIN_BET) {
      throw new Error("Minimum wager is 1 ZCoin.");
    }

    if (amount > allowed) {
      throw new Error(`Your current maximum wager is ${allowed} ZCoins.`);
    }

    if (amount > currentWallet) {
      throw new Error("You do not have enough ZCoins for that wager.");
    }

    const ticket = {
      id:`ticket-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      gameId:game.id,
      side,
      wager:amount,
      status:"pending",
      createdAt:Date.now(),
      lockedPreview:Number(previewMultiplier || 2),
      game:{...game}
    };

    tickets.push(ticket);
    saveTickets(tickets);

    return ticket;
  }

  function settleMarket(game, result) {
    if (!["away", "home", "void", "no_action"].includes(result)) {
      throw new Error("Invalid settlement result.");
    }

    const snapshot = market(game);
    const settlements = loadSettlements();

    settlements[game.id] = {
      marketId:game.id,
      result,
      settledAt:Date.now(),
      finalMultiplier:{
        away:snapshot.active ? snapshot.awayOdds : 2,
        home:snapshot.active ? snapshot.homeOdds : 2
      },
      pool:{
        away:snapshot.away,
        home:snapshot.home,
        total:snapshot.total,
        awayCount:snapshot.awayCount,
        homeCount:snapshot.homeCount
      }
    };

    saveSettlements(settlements);
    return settlements[game.id];
  }

  function clearSettlement(gameId) {
    const settlements = loadSettlements();
    delete settlements[gameId];
    saveSettlements(settlements);
  }

  function seasonStats() {
    const settled = enrichedTickets().filter((ticket) =>
      ["won", "lost", "refunded"].includes(ticket.status)
    );

    const wins = settled.filter((ticket) => ticket.status === "won").length;
    const losses = settled.filter((ticket) => ticket.status === "lost").length;
    const profit = settled.reduce(
      (sum, ticket) => sum + Number(ticket.profit || 0),
      0
    );

    return {
      wins,
      losses,
      profit,
      accuracy:
        wins + losses
          ? Math.round((wins / (wins + losses)) * 100)
          : null,
      rank:4,
      rankTitle:"All-Pro"
    };
  }

  function historyEntries() {
    const rows = enrichedTickets().flatMap((ticket) => {
      const game = ticket.game || {};
      const pickedName =
        ticket.side === "away" ? game.away : game.home;

      const matchup = [game.away, game.home]
        .filter(Boolean)
        .join(" vs ");

      const entries = [
        {
          id:`${ticket.id}-wager`,
          type:"wager",
          amount:-ticket.wager,
          title:matchup || "EastCoin Picks wager",
          detail:`Picked ${pickedName || "team"}`,
          createdAt:ticket.createdAt
        }
      ];

      if (ticket.status === "won") {
        entries.push({
          id:`${ticket.id}-payout`,
          type:"payout",
          amount:ticket.payout,
          title:`${pickedName || "Your pick"} won`,
          detail:`${ticket.wager} ZCoin wager · payout settled`,
          createdAt:ticket.settledAt || ticket.createdAt + 1
        });
      } else if (ticket.status === "refunded") {
        entries.push({
          id:`${ticket.id}-refund`,
          type:"refund",
          amount:ticket.wager,
          title:matchup || "Market refunded",
          detail:"No Action / Void · full wager refunded",
          createdAt:ticket.settledAt || ticket.createdAt + 1
        });
      }

      return entries;
    });

    return [...seedHistory, ...rows]
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function adminMarket(game) {
    const snapshot = market(game);
    const settlement = settlementFor(game.id);

    return {
      ...game,
      pool:snapshot,
      settlement,
      ticketCount:
        snapshot.awayCount + snapshot.homeCount,
      userTicketCount:
        loadTickets().filter((ticket) => ticket.gameId === game.id).length
    };
  }

  window.EastcoinPicksPreview = Object.freeze({
    BASE_WALLET,
    MIN_BET,
    HARD_CAP,
    WALLET_CAP,
    fallbackGames,
    leaderboardSeed,
    initials,
    normalizeMatch,
    loadGames,
    loadTickets,
    saveTickets,
    loadSettlements,
    saveSettlements,
    isLoggedIn,
    login,
    logout,
    walletBalance,
    maxBet,
    market,
    placeTicket,
    enrichedTickets,
    settleMarket,
    clearSettlement,
    settlementFor,
    seasonStats,
    historyEntries,
    adminMarket
  });
})();

/* ============================================================
   EastCoin V3 — Picks

   Carries the decisions already settled elsewhere in the rebuild:
     · no maximum stake — 1 ZCoin minimum, up to your balance
     · odds are locked when the market opens; everyone gets the
       same line, so nothing here shows a "current" price
     · prices read as American moneylines (−150), never as a
       decimal multiplier (1.67x)
     · payouts round UP, in the bettor's favour, computed in one
       place so the ticket and the settlement cannot disagree
     · no community-pool language anywhere

   Markets come from the live catalog. The four secondary views
   use demo data, because the wager backend is still locked and
   inventing balances would be worse than labelling examples.
   ============================================================ */
(() => {
  "use strict";

  const MIN_STAKE = 1;

  const local = {
    tab: "markets",
    markets: [],
    loaded: false,
    failed: false,
    wallet: null,
    ticket: null,
    myPicks: [],
    leaderboard: [],
    upcoming: [],
    upcomingAt: null,
    sort: { key: "profit", dir: "desc" },
    sport: "all",   // Markets tab filter: "all" or a league key like "mlb"
    day: "",        // Markets tab: which day's slate is showing (a toDateString key)
    communityLedger: [],
    season: null,
    login: "",
    config: {},
    authed: false
  };

  let root = null;
  let shell = null;

  /* ---------------------------------------------------------- money
     One implementation, used by every surface that shows a number. */

  function decimalFrom(american) {
    const line = Number(american);
    if (!Number.isFinite(line) || line === 0) return 1;
    return line < 0 ? 1 + 100 / Math.abs(line) : 1 + line / 100;
  }

  // Total return, rounded UP — always in the bettor's favour.
  function totalReturn(stake, american) {
    const amount = Math.max(0, Math.floor(Number(stake) || 0));
    if (!amount) return 0;
    return Math.max(amount, Math.ceil(amount * decimalFrom(american)));
  }

  function formatLine(american) {
    const line = Number(american);
    if (!Number.isFinite(line) || line === 0) return "—";
    return line > 0 ? `+${line}` : String(line);
  }

  /* ---------------------------------------------------------- data */

  async function loadUpcoming() {
    try {
      const response = await fetch("/api/picks/upcoming");
      if (!response.ok) return;
      const payload = await response.json();
      local.upcoming = Array.isArray(payload?.games) ? payload.games : [];
      local.upcomingAt = payload?.fetchedAt || null;
    } catch {
      /* the list is a preview; the page is fine without it */
    }
  }

  async function loadMarkets() {
    try {
      const response = await fetch("/api/picks/bootstrap", { credentials: "include" });
      if (!response.ok) throw new Error("bootstrap");
      const payload = await response.json();
      if (!payload?.ok) throw new Error("bootstrap");

      local.markets = Array.isArray(payload.markets) ? payload.markets : [];
      local.myPicks = Array.isArray(payload.myPicks) ? payload.myPicks : [];
      local.leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
      local.communityLedger = Array.isArray(payload.communityLedger) ? payload.communityLedger : [];
      local.season = payload.season || null;
      local.login = String(payload.session?.user?.login || "").toLowerCase();
      local.wallet = payload.session?.wallet || null;
      local.authed = Boolean(payload.session?.authenticated);
      local.config = payload.config || {};
      local.loaded = true;
      local.failed = false;
    } catch {
      local.failed = true;
      local.loaded = true;
    }
  }

  /**
   * Places a real wager. The server is the authority on every check
   * here — this only reports what it decided. Its refusal messages are
   * written for the person reading them, so they are shown as-is rather
   * than remapped into something vaguer.
   */
  async function placePick(market, side, stake) {
    try {
      const response = await fetch("/api/picks/wagers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, selection: side, wager: stake })
      });
      const payload = await response.json().catch(() => null);
      if (payload?.ok) return payload;
      return {
        ok: false,
        message: payload?.message || `Couldn't place that pick (${response.status}).`
      };
    } catch {
      return { ok: false, message: "Couldn't reach the server — nothing was charged." };
    }
  }

  /* ---------------------------------------------------------- helpers */

  /* ---------------------------------------------------------- skeletons
     Grey blocks in the shape of the real thing while the first fetch
     is out. Each one mirrors the layout it stands in for, so the page
     does not move when the data arrives. */

  function sk(width, height, cls) {
    const b = el("span", `sk${cls ? " " + cls : ""}`);
    b.style.width = typeof width === "number" ? `${width}px` : width;
    b.style.height = `${height}px`;
    return b;
  }

  function skelLeader() {
    const box = el("section", "leaderwidget is-sk");
    box.setAttribute("aria-busy", "true");
    const copy = el("div", "lw-copy sk-lines");
    copy.append(sk(110, 8), sk(190, 22), sk(120, 9));
    const stats = el("div", "lw-stats");
    for (let i = 0; i < 2; i += 1) {
      const st = el("div", "lw-stat sk-lines");
      st.append(sk(64, 8), sk(70, 20));
      stats.append(st);
    }
    box.append(sk(30, 30, "circle"), sk(48, 48, "circle"), copy, stats);
    return box;
  }

  function skelSummary() {
    const strip = el("div", "summarystrip");
    strip.setAttribute("aria-busy", "true");
    for (let i = 0; i < 4; i += 1) {
      const card = el("article", `summarycard is-sk sk-lines${i === 0 ? " wallet" : ""}`);
      card.append(sk(84, 8), sk(70, 22), sk(120, 8));
      strip.append(card);
    }
    return strip;
  }

  function skelRows(count, ledger) {
    const card = el("div", `tablecard${ledger ? " ledger" : " standings"}`);
    card.setAttribute("aria-busy", "true");
    for (let i = 0; i < count; i += 1) {
      const row = el("div", "trow is-sk");
      const user = el("div", "tuser");
      const lines = el("span", "sk-lines");
      lines.append(sk(120 + (i % 3) * 30, 11), sk(80, 8));
      user.append(sk(36, 36, "tile"), lines);
      const a = sk(64, 12);
      const b = sk(52, 12);
      a.style.justifySelf = "end";
      b.style.justifySelf = "end";
      row.append(sk(26, 12), user, a, b);
      if (!ledger) { const c = sk(52, 12); c.style.justifySelf = "end"; row.append(c); }
      card.append(row);
    }
    return card;
  }

  function skelTickets(count) {
    const grid = el("div", "ticketgrid");
    grid.setAttribute("aria-busy", "true");
    for (let i = 0; i < count; i += 1) {
      const t = el("div", "skel");
      const lines = el("div", "lines");
      lines.append(sk("60%", 12), sk("40%", 9), sk("100%", 31));
      t.append(lines);
      grid.append(t);
    }
    return grid;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** A person's name, linking to their profile. */
  function nameLink(user, text) {
    const a = el("a", "ulink", text != null ? text : (user?.displayName || user?.login || ""));
    a.href = `/u/${encodeURIComponent(String(user?.login || "").toLowerCase())}`;
    return a;
  }

  /** A name with its badges after it. */
  function nameWithBadges(user, text) {
    const wrap = el("span", "namewrap");
    wrap.append(nameLink(user, text));
    window.ECBadges?.decorate(wrap, user?.login);
    return wrap;
  }

  /** A person: their Twitch picture when we have it, initials until then. */
  function avatar(user, className) {
    const name = user?.displayName || user?.login || "?";
    const box = el("span", className, initials(name));
    const src = String(user?.profileImageUrl || user?.avatar || "");
    if (!src) return box;
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => box.classList.add("has-logo"));
    img.addEventListener("error", () => img.remove());
    img.src = src;
    box.append(img);
    return box;
  }

  function crest(market, name, className) {
    if (window.ECLogos) return window.ECLogos.crest(market?.sport, market?.league, name, className);
    return el("span", className, initials(name));
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function zc(value, { sign = false } = {}) {
    const wrap = el("span", "zc-amount nums");
    const img = document.createElement("img");
    img.className = "zcoin-mark";
    img.src = "/v3/assets/img/zcoin.webp";
    img.alt = "";
    img.width = 15;
    img.height = 15;
    const n = Number(value) || 0;
    const prefix = sign && n > 0 ? "+" : sign && n < 0 ? "−" : "";
    wrap.append(img, document.createTextNode(`${prefix}${Math.abs(n).toLocaleString()}`));
    return wrap;
  }

  /* ---------------------------------------------------------- markets */

  // bootstrap sends {name, badge}; tolerate a bare string too.
  function teamName(value) {
    if (value && typeof value === "object") return String(value.name || "");
    return String(value || "");
  }

  function startLabel(iso) {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return "";
    const time = when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return when.toDateString() === new Date().toDateString()
      ? `Today ${time}`
      : `${when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
  }

  function marketCard(market) {
    const card = el("article", "market");

    const away = teamName(market.away);
    const home = teamName(market.home);
    const mine = local.myPicks.find((p) => p.marketId === market.id) || null;

    const priced =
      Number.isFinite(Number(market.awayOdds)) && Number(market.awayOdds) !== 0 &&
      Number.isFinite(Number(market.homeOdds)) && Number(market.homeOdds) !== 0;
    const started =
      Boolean(market.startsAt) && new Date(market.startsAt).getTime() <= Date.now();

    // Every one of these is re-checked by the server. Mirroring them here
    // is only so a button is never offered that would be refused.
    const canBet =
      local.authed && local.config.wageringEnabled !== false &&
      priced && !started && market.state === "OPEN" && !mine;

    const head = el("div", "market-head");
    head.append(
      el("span", "market-league", market.league || market.sport || "Market"),
      el("span", "market-tag open", "Open for betting"),
      el("span", "market-time", startLabel(market.startsAt))
    );

    const sides = el("div", "market-sides");
    for (const side of ["away", "home"]) {
      const name = side === "away" ? away : home;
      const line = side === "away" ? market.awayOdds : market.homeOdds;
      const btn = el("button", "side");
      btn.type = "button";

      // Full name where there is room, the club's nickname where there
      // is not — CSS picks, by the card's width, so nothing ever truncates.
      const label = el("span", "side-team");
      const short = window.ECLogos ? window.ECLogos.nickname(name).replace(/\b\w/g, (c) => c.toUpperCase()) : String(name || "").split(" ").pop();
      label.append(el("span", "side-team-full", name || "TBC"), el("span", "side-team-short", short || name || "TBC"));
      const price = el("span", "side-line nums", formatLine(line));
      const pays = el("span", "side-pays");
      pays.append(document.createTextNode("10 pays "), zc(totalReturn(10, line)));

      btn.append(crest(market, name, "side-crest"), label, price, pays);
      if (mine && mine.selection === side) btn.classList.add("is-mine");

      if (canBet) {
        btn.addEventListener("click", () => openTicket(market, side, name, line));
      } else {
        btn.disabled = true;
      }
      sides.append(btn);
    }

    card.append(head, sides);

    // A dead button with no explanation reads as a bug. Say which it is.
    const reason = mine
      ? `Your pick: ${Number(mine.wager).toLocaleString()} on ${mine.selection === "away" ? away : home}.`
      : !priced
        ? "No price on this market yet."
        : started || market.state !== "OPEN"
          ? "Betting is closed on this game."
          : !local.authed
            ? "Log in with Twitch to make a pick."
            : local.config.wageringEnabled === false
              ? (local.config.inWagerTest
                  ? "ZCoin transfers aren't switched on for this server yet."
                  : "Picks is in limited testing and isn't open to everyone yet.")
              : "";
    if (reason) card.append(el("p", "market-foot", reason));

    return card;
  }

  function dayHeading(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 864e5);
    const label = d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    if (d.toDateString() === today.toDateString()) return `Today · ${label}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${label}`;
    return label;
  }

  function upcomingCard(game) {
    const card = el("article", "market upcoming");
    // The server says when each game opens (NFL an hour out, MLB at the
    // 4 PM Central slot); the hour-before rule is only the fallback.
    const opensAt = new Date(game.opensAt || new Date(game.startsAt).getTime() - 60 * 60 * 1000);

    const head = el("div", "market-head");
    head.append(
      el("span", "market-league", game.league || game.sport || "Upcoming"),
      el("span", "market-tag soon", "Upcoming"),
      el("span", "market-time", startLabel(game.startsAt))
    );

    const sides = el("div", "market-sides");
    for (const side of ["away", "home"]) {
      const name = side === "away" ? game.away : game.home;
      const line = side === "away" ? game.awayLine : game.homeLine;
      const box = el("div", "side preview");
      box.append(
        crest(game, name, "side-crest"),
        el("span", "side-team", name),
        el("span", "side-line nums", line ? formatLine(line) : "—")
      );
      const pays = el("span", "side-pays");
      if (line) pays.append(document.createTextNode("10 pays "), zc(totalReturn(10, line)));
      else pays.textContent = "No line yet";
      box.append(pays);
      sides.append(box);
    }

    // "Betting opens in 4 hours, 38 minutes" — kept current by a ticker
    // while the tab is open, so it never reads stale.
    const foot = el("p", "market-foot");
    const when = el("b", "opens-in");
    if (!Number.isNaN(opensAt.getTime())) when.dataset.opensAt = String(opensAt.getTime());
    when.textContent = opensInText(opensAt.getTime());
    foot.append(when, document.createTextNode(" · line locks when it opens, and may move until then."));
    card.append(head, sides, foot);
    return card;
  }

  /** "Betting opens in 4 hours, 38 minutes", or the wait for a free slot once the time has passed. */
  function opensInText(at) {
    if (!Number.isFinite(at)) return "Betting opens an hour before kickoff";
    const ms = at - Date.now();
    if (ms <= 0) return "Betting opens when a slot frees up";
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "Betting opens any minute";
    if (mins < 60) return `Betting opens in ${mins} minute${mins === 1 ? "" : "s"}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const hh = h % 24;
      return `Betting opens in ${d} day${d === 1 ? "" : "s"}${hh ? `, ${hh} hour${hh === 1 ? "" : "s"}` : ""}`;
    }
    return `Betting opens in ${h} hour${h === 1 ? "" : "s"}${m ? `, ${m} minute${m === 1 ? "" : "s"}` : ""}`;
  }

  let opensTimer = 0;
  function startOpensTicker() {
    window.clearInterval(opensTimer);
    opensTimer = window.setInterval(() => {
      const nodes = root ? root.querySelectorAll(".opens-in[data-opens-at]") : [];
      if (!nodes.length) { window.clearInterval(opensTimer); return; }
      for (const n of nodes) n.textContent = opensInText(Number(n.dataset.opensAt));
    }, 30 * 1000);
  }

  function upcomingSection(games = local.upcoming) {
    if (!games.length) return null;

    const section = el("section", "upcoming");
    const head = el("div", "upcoming-head");
    const copy = el("div");
    copy.append(el("h2", null, "Upcoming"));
    const stamp = local.upcomingAt ? new Date(local.upcomingAt) : null;
    const asOf = stamp && !Number.isNaN(stamp.getTime())
      ? ` · lines as of ${stamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "";
    copy.append(el("p", null, `${games.length} game${games.length === 1 ? "" : "s"} on the way — NFL opens an hour before kickoff, MLB every day at 4 PM CT${asOf}.`));
    head.append(copy);
    section.append(head);

    // Days, then kickoff slots inside each — the same shape as the open slate.
    const days = new Map();
    for (const game of games.slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))) {
      const day = dayHeading(game.startsAt);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(game);
    }
    section.classList.add("slate");
    for (const [day, list] of days) {
      const dh = el("h3", "upcoming-day", day);
      dh.append(el("small", null, ` · ${list.length} game${list.length === 1 ? "" : "s"}`));
      section.append(dh);
      appendSlots(section, list, upcomingCard, (start) => `betting closes at ${start}`);
    }
    return section;
  }

  function marketsView() {
    const wrap = document.createDocumentFragment();


    if (!local.loaded) {
      const grid = el("div", "marketlist");
      for (let i = 0; i < 3; i += 1) {
        const s = el("div", "skel");
        s.innerHTML = '<div class="lines"><span class="bar w80"></span><span class="bar w100"></span></div>';
        grid.append(s);
      }
      wrap.append(grid);
      return wrap;
    }

    // The Markets tab is for placing picks, so it lists only what can
    // actually be picked. A game already under way belongs in My Picks,
    // not here looking like an option with the button greyed out.
    const allOpen = local.markets.filter((m) =>
      m.state === "OPEN" &&
      (!m.startsAt || new Date(m.startsAt).getTime() > Date.now()));

    // One sport at a time, when there is more than one to choose from.
    const { leagues, counts } = leagueCounts(allOpen.map(leagueOf), local.upcoming.map(leagueOf));
    if (leagues.length > 1) mountTools(sportFilter(leagues, counts, allOpen.length));

    const openNow = local.sport === "all" ? allOpen : allOpen.filter((m) => leagueOf(m) === local.sport);

    if (local.failed || !openNow.length) {
      const empty = el("div", "empty");
      empty.append(
        el("strong", null, local.failed ? "Couldn't load markets" : "No open markets"),
        el("p", null,
          local.failed
            ? "The Picks catalog didn't answer. This is usually temporary."
            : local.upcoming.length
              ? "The next games are listed below. Each opens an hour before kickoff."
              : "Markets open an hour before kickoff. Check back closer to game time.")
      );
      wrap.append(empty);
    } else {
      wrap.append(slateByDay(openNow));
    }
    startOpensTicker();

    const upcoming = upcomingSection(local.sport === "all" ? local.upcoming : local.upcoming.filter((g) => leagueOf(g) === local.sport));
    if (upcoming) wrap.append(upcoming);
    return wrap;
  }

  /* ---------------------------------------------------------- sport filter
     Shared by Markets, History and the Community Ledger. The choice
     is one value for all three and rides in the URL as &sport=. */

  const leagueOf = (x) => String(x?.league || x?.market?.league || x?.sport || x?.market?.sport || "other").toLowerCase();

  /** Leagues present, NFL first, with how many of `present` each has. */
  function leagueCounts(present, alsoKnown = []) {
    const counts = new Map();
    for (const k of present) counts.set(k, (counts.get(k) || 0) + 1);
    for (const k of alsoKnown) if (!counts.has(k)) counts.set(k, 0);
    const leagues = [...counts.keys()].sort((a, b) => (a === "nfl" ? -1 : b === "nfl" ? 1 : a.localeCompare(b)));
    if (local.sport !== "all" && !leagues.includes(local.sport)) local.sport = "all";
    return { leagues, counts };
  }

  /* ---------------------------------------------------------- the slate

     Open markets by day, then by kickoff. "Tonight" and "Tomorrow" are
     pills; under the chosen day each kickoff slot (games starting
     within the same half hour) gets a header with its time, and the
     cards sit in a grid rather than one long column. */

  const startOf = (m) => new Date(m.startsAt).getTime();

  function dayTabLabel(key, first) {
    const d = new Date(first);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 864e5);
    if (d.toDateString() === today.toDateString()) return d.getHours() >= 17 ? "Tonight" : "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  function slotLabel(markets) {
    const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const times = [...new Set(markets.map(startOf))].sort((a, b) => a - b);
    return times.length > 1 ? `${fmt(times[0])} – ${fmt(times[times.length - 1])}` : fmt(times[0]);
  }

  function slateByDay(markets) {
    const box = el("div", "slate");
    const sorted = markets.slice().sort((a, b) => startOf(a) - startOf(b));

    // Days, in order of first kickoff.
    const days = new Map();
    for (const m of sorted) {
      const key = Number.isFinite(startOf(m)) ? new Date(m.startsAt).toDateString() : "unknown";
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(m);
    }
    if (!days.has(local.day)) local.day = days.keys().next().value;

    // The head, in the same voice as Upcoming: the day, how many are
    // open, and — when there is more than one day — the pills to switch.
    const todays = days.get(local.day) || [];
    const head = el("div", "upcoming-head slate-head");
    const copy = el("div");
    copy.append(el("h2", null, dayTabLabel(local.day, todays[0]?.startsAt)));
    const leaguesOpen = [...new Set(todays.map((m) => String(m.league || "").toUpperCase()))];
    const closeWord = { MLB: "first pitch", NFL: "kickoff", CFB: "kickoff", NBA: "tip-off", NHL: "puck drop" };
    const closes = leaguesOpen.map((l) => `${l} at ${closeWord[l] || "game time"}`).join(", ");
    copy.append(el("p", null, `${todays.length} game${todays.length === 1 ? "" : "s"} open for picks · closes ${closes || "at game time"}.`));
    head.append(copy);
    if (days.size > 1) {
      const tabs = el("div", "daytabs");
      tabs.setAttribute("aria-label", "Which day");
      for (const [key, list] of days) {
        const b = el("button", `daytab${key === local.day ? " on" : ""}`);
        b.type = "button";
        b.append(document.createTextNode(dayTabLabel(key, list[0].startsAt)), el("small", null, String(list.length)));
        b.addEventListener("click", () => { local.day = key; paint(); });
        tabs.append(b);
      }
      head.append(tabs);
    }
    box.append(head);

    appendSlots(box, todays, marketCard, (start) => `picks close at ${start}`);
    return box;
  }

  /** The word each sport uses for its start. */
  function startWord(list) {
    const leagues = new Set(list.map((m) => String(m.league || "").toUpperCase()));
    return leagues.size === 1
      ? ({ MLB: "first pitch", NFL: "kickoff", CFB: "kickoff", NBA: "tip-off", NHL: "puck drop" }[[...leagues][0]] || "game time")
      : "game time";
  }

  /**
   * Kickoff slots: games within the same half hour share a header with
   * the time, then their cards in a grid. Used for the open slate and
   * for Upcoming alike, so the two read the same.
   */
  function appendSlots(box, games, cardFor, noteFor) {
    const at = (g) => new Date(g.startsAt).getTime();
    const slots = new Map();
    for (const g of games.slice().sort((a, b) => at(a) - at(b))) {
      const t = at(g);
      const key = Number.isFinite(t) ? Math.floor(t / (30 * 60 * 1000)) : "tbd";
      if (!slots.has(key)) slots.set(key, []);
      slots.get(key).push(g);
    }
    for (const [key, list] of slots) {
      const head = el("div", "slothead");
      head.append(el("strong", null, key === "tbd" ? "Time TBD" : slotLabel(list)));
      head.append(el("span", null, `${list.length} game${list.length === 1 ? "" : "s"} · ${noteFor(startWord(list))}`));
      box.append(head);
      const grid = el("div", "marketlist");
      for (const g of list) grid.append(cardFor(g));
      box.append(grid);
    }
  }

  /** The sport dropdown; `note` is the line of copy beside it, if any. */
  function sportFilter(leagues, counts, total) {
    const seg = el("div", "sportseg");
    seg.setAttribute("aria-label", "Sport");
    const mk = (key, label, n) => {
      const btn = el("button", `sportseg-btn${local.sport === key ? " on" : ""}`, label);
      btn.type = "button";
      btn.append(el("small", null, String(n)));
      btn.addEventListener("click", () => {
        local.sport = key;
        writeSportToUrl(local.sport);
        paint();
      });
      return btn;
    };
    seg.append(mk("all", "All", total));
    for (const key of leagues) seg.append(mk(key, key.toUpperCase(), counts.get(key) || 0));
    return seg;
  }

  /** The tab bar's right-hand slot, so a tab's tools sit on the tab row. */
  function mountTools(node) {
    if (local.toolsSlot?.isConnected) local.toolsSlot.append(node);
    else if (local.toolsSlot) local.toolsSlot.append(node);
    return document.createDocumentFragment();
  }

  function readSportFromUrl() {
    const raw = String(new URL(location.href).searchParams.get("sport") || "").toLowerCase();
    return /^[a-z]{2,12}$/.test(raw) ? raw : "all";
  }

  function writeSportToUrl(key) {
    const url = new URL(location.href);
    if (url.searchParams.get("view") !== "picks") return;
    if (key === "all") url.searchParams.delete("sport");
    else url.searchParams.set("sport", key);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  /* ---------------------------------------------------------- ticket */

  function openTicket(market, side, team, line) {
    local.ticket = { market, side, team, line, stake: 10 };
    renderTicket();
  }

  function renderTicket() {
    document.getElementById("v3Ticket")?.remove();
    if (!local.ticket) return;

    const { team, line } = local.ticket;
    const balance = Number(local.wallet?.balance) || 0;

    const backdrop = el("div", "ticket-backdrop");
    backdrop.id = "v3Ticket";

    const panel = el("section", "ticket");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `Lock pick on ${team}`);

    const head = el("header", "ticket-head");
    const heading = el("strong", null, "Lock your pick");
    head.append(heading);
    const close = el("button", "iconbtn", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => dismiss());
    head.append(close);

    function dismiss() {
      local.ticket = null;
      renderTicket();
    }

    function show(body) {
      panel.append(head, ...body);
      backdrop.append(panel);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) dismiss();
      });
      document.body.append(backdrop);
    }

    // Already placed: show what was actually taken, from the server's
    // own reply rather than from what the form hoped for.
    if (local.ticket.receipt) {
      const r = local.ticket.receipt;
      heading.textContent = "Pick locked";

      const done = el("div", "ticket-done");
      const rows = [
        ["Pick", `${Number(r.wager).toLocaleString()} on ${r.team}`],
        ["Locked price", formatLine(r.odds)],
        ["Returns if it wins", Number(r.returnsIfWon).toLocaleString()],
        ["ZCoins left", local.ticket.balance == null
          ? "—" : Number(local.ticket.balance).toLocaleString()]
      ];
      for (const [k, v] of rows) {
        const row = el("div", "ticket-row");
        row.append(el("span", "ticket-row-k", k), el("span", "ticket-row-v", v));
        done.append(row);
      }
      done.append(el("p", "ticket-hint",
        "Your price is locked at what you saw. It settles on its own once the game is final."));

      const ok = el("button", "btn primary", "Done");
      ok.type = "button";
      ok.style.height = "38px";
      ok.addEventListener("click", dismiss);

      show([done, ok]);
      ok.focus();
      return;
    }

    const pick = el("div", "ticket-pick");
    pick.append(
      (() => {
        const t = el("span", "ticket-team");
        t.append(crest(local.ticket.market, team, "ticket-crest"), document.createTextNode(team));
        return t;
      })(),
      el("span", "ticket-line nums", formatLine(line))
    );

    const field = el("div", "ticket-field");
    const label = el("label", "ticket-label", "Stake");
    label.htmlFor = "v3Stake";
    const input = document.createElement("input");
    input.id = "v3Stake";
    input.type = "number";
    input.min = String(MIN_STAKE);
    input.step = "1";
    input.value = String(local.ticket.stake);
    input.inputMode = "numeric";
    field.append(label, input);

    const summary = el("div", "ticket-summary");

    function refresh() {
      const stake = Math.max(0, Math.floor(Number(input.value) || 0));
      local.ticket.stake = stake;
      const ret = totalReturn(stake, line);
      const profit = ret - stake;

      summary.replaceChildren();
      const rows = [
        ["If it wins", zc(ret), `+${profit.toLocaleString()} profit`],
        ["If it loses", zc(0), `you lose your ${stake.toLocaleString()} stake`],
        ["Void / no action", zc(stake), "stake returned in full"]
      ];
      for (const [k, v, note] of rows) {
        const row = el("div", "ticket-row");
        row.append(el("span", "ticket-row-k", k));
        const val = el("span", "ticket-row-v");
        val.append(v);
        row.append(val, el("span", "ticket-row-note", note));
        summary.append(row);
      }

      const problem =
        stake < MIN_STAKE
          ? `Minimum stake is ${MIN_STAKE} ZCoin.`
          : balance && stake > balance
            ? `That's more than your ${balance.toLocaleString()} ZCoins.`
            : "";
      confirm.disabled = Boolean(problem);
      hint.textContent =
        problem ||
        (balance
          ? `${balance.toLocaleString()} ZCoins available · no maximum stake`
          : "1 ZCoin minimum · stake up to your full balance");
      hint.classList.toggle("is-error", Boolean(problem));
    }

    const hint = el("p", "ticket-hint");
    const confirm = el("button", "btn primary", "Lock it in");
    confirm.type = "button";
    confirm.style.height = "38px";

    confirm.addEventListener("click", async () => {
      const stake = Math.max(0, Math.floor(Number(input.value) || 0));

      confirm.disabled = true;
      input.disabled = true;
      confirm.textContent = "Placing…";
      hint.classList.remove("is-error");
      hint.textContent = "Taking your stake and locking the price…";

      const result = await placePick(local.ticket.market, local.ticket.side, stake);

      if (result.ok) {
        // Re-read from the server so the wallet and the card's
        // "your pick" state come from the record, not from optimism.
        local.ticket = { ...local.ticket, receipt: result.pick, balance: result.balance };
        await loadMarkets();
        renderTicket();
        paint();
        return;
      }

      confirm.disabled = false;
      input.disabled = false;
      confirm.textContent = "Lock it in";
      hint.textContent = result.message;
      hint.classList.add("is-error");
    });

    input.addEventListener("input", refresh);

    show([pick, field, summary, hint, confirm]);
    refresh();
    input.focus();
    input.select();
  }

  /* ---------------------------------------------------------- demo views */

  /* ---------------------------------------------------------- real views

     Every tab reads what bootstrap returns. Nothing here is invented:
     an empty tab says so, and says when it will stop being empty. */

  function emptyNote(strong, text) {
    const box = el("div", "empty");
    box.append(el("strong", null, strong), el("p", null, text));
    return box;
  }

  function sideName(pick, side) {
    const s = side || pick.selection;
    return s === "home" ? teamName(pick.market?.home) : teamName(pick.market?.away);
  }

  function oppName(pick) {
    return pick.selection === "home" ? teamName(pick.market?.away) : teamName(pick.market?.home);
  }

  function dayLabel(iso) {
    const raw = iso && !/[TZ]/.test(iso) ? iso.replace(" ", "T") + "Z" : iso;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "Unknown day";
    const today = new Date();
    const yesterday = new Date(today.getTime() - 864e5);
    const tomorrow = new Date(today.getTime() + 864e5);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }

  function whenLabel(iso) {
    const raw = iso && !/[TZ]/.test(iso) ? iso.replace(" ", "T") + "Z" : iso;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return today ? `Today, ${time}` : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
  }

  function ticketsView() {
    const wrap = document.createDocumentFragment();
    // Grouped by the day the game is played, latest day first — so what
    // is still to come sits on top and what is done reads down from
    // today. Within a day, by kickoff.
    const gameTime = (p) => String(p.market?.startsAt || p.createdAt || "");
    const picks = local.myPicks.slice().sort((a, b) => gameTime(b).localeCompare(gameTime(a)));

    if (!local.authed) {
      wrap.append(emptyNote("Log in to see your picks", "Your picks and payouts show here once you're logged in with Twitch."));
      return wrap;
    }
    if (!local.loaded) {
      wrap.append(skelTickets(3));
      return wrap;
    }
    if (!picks.length) {
      wrap.append(emptyNote("No picks yet", "Anything you lock in — from here or with !pick in chat — shows up here with what happened to it."));
      return wrap;
    }

    let grid = null;
    let lastDay = "";
    for (const p of picks) {
      const day = dayLabel(gameTime(p));
      if (day !== lastDay) {
        lastDay = day;
        const inDay = picks.filter((x) => dayLabel(gameTime(x)) === day);
        const settledNet = inDay.filter((x) => x.status === "WON" || x.status === "LOST").reduce((n, x) => n + Number(x.profit || 0), 0);
        const open = inDay.filter((x) => x.status === "ACTIVE").length;
        const header = el("div", "historyday");
        header.append(el("strong", null, day));
        const right = el("span", `nums ${settledNet > 0 ? "up" : settledNet < 0 ? "down" : ""}`);
        if (open && open === inDay.length) right.textContent = `${open} open`;
        else right.append(zc(settledNet, { sign: true }), document.createTextNode(open ? ` · ${open} open` : ""));
        header.append(right);
        wrap.append(header);
        grid = el("div", "ticketgrid");
        wrap.append(grid);
      }
      const status = { ACTIVE: "pending", WON: "won", LOST: "lost", REFUNDED: "refunded" }[p.status] || "pending";
      // The whole ticket is a link to the game's page.
      const card = el("a", `pickticket ${status}${p.market?.slug ? " glink" : ""}`);
      if (p.market?.slug) card.href = `/g/${p.market.slug}`;

      const head = el("div", "pickticket-head");
      const teamWrap = el("div", "pickticket-team");
      teamWrap.append(crest(p.market, sideName(p), "pickticket-crest"));
      const names = el("span");
      names.append(el("strong", null, sideName(p)), el("small", null, `vs ${oppName(p)}`));
      teamWrap.append(names);
      head.append(teamWrap, el("span", "pickticket-status", status));

      const grid3 = el("div", "pickticket-grid");
      const line = Number(p.oddsLocked ?? p.odds ?? 0);
      const ret = status === "won" ? Number(p.payout) : status === "lost" ? 0
        : status === "refunded" ? Number(p.wager) : totalReturn(p.wager, line);
      const cells = [
        ["Wager", zc(p.wager)],
        [status === "pending" ? "Locked odds" : "Final", el("span", "nums", line ? formatLine(line) : "—")],
        [status === "pending" ? "Potential" : status === "won" ? "Payout" : status === "refunded" ? "Refund" : "Return", zc(ret)]
      ];
      cells.forEach(([k, v], i) => {
        const cell = el("div", `pickticket-stat${i === 2 ? " return" : ""}`);
        cell.append(el("span", null, k));
        const strong = el("strong");
        strong.append(v);
        cell.append(strong);
        grid3.append(cell);
      });

      const foot = status === "pending"
        ? `${p.market?.state === "OPEN" ? "Kicks off" : "In play since"} ${whenLabel(p.market?.startsAt)} · line locked when the market opened`
        : status === "won" ? `Won · paid ${whenLabel(p.settledAt)}`
          : status === "lost" ? `Lost · settled ${whenLabel(p.settledAt)}`
            : `Refunded · ${whenLabel(p.settledAt)}`;
      card.append(head, grid3, el("div", "pickticket-foot", foot));
      grid.append(card);
    }
    return wrap;
  }

  const recordOf = (r, league) => r.records?.[league] || null;
  const recordScore = (r, league) => { const x = recordOf(r, league); return x ? x.wins * 1000 - x.losses : -1e9; };
  const LEADER_COLUMNS = [
    ["rank", "Rank", (r) => r.rank, "asc"],
    ["user", "User", (r) => String(r.user?.displayName || r.user?.login || "").toLowerCase(), "asc"],
    ["profit", "Picks profit", (r) => r.profit, "desc"],
    ["nfl", "NFL record", (r) => recordScore(r, "NFL"), "desc"],
    ["mlb", "MLB record", (r) => recordScore(r, "MLB"), "desc"]
  ];
  const RIGHT_COLUMNS = new Set(["profit", "nfl", "mlb"]);

  function sortedLeaders() {
    const col = LEADER_COLUMNS.find(([key]) => key === local.sort.key) || LEADER_COLUMNS[2];
    const value = col[2];
    const dir = local.sort.dir === "asc" ? 1 : -1;
    return local.leaderboard.slice().sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.rank - b.rank;   // ties keep season order
    });
  }

  function leaderboardView() {
    const wrap = document.createDocumentFragment();
    const rows = local.leaderboard;

    if (!local.loaded) {
      wrap.append(skelRows(6));
      return wrap;
    }
    if (!rows.length) {
      wrap.append(emptyNote("No standings yet", "The board fills in as games settle. NFL markets open an hour before each kick-off."));
      return wrap;
    }

    const card = el("div", "tablecard standings");
    const head = el("div", "trow thead");
    for (const [key, label, , natural] of LEADER_COLUMNS) {
      const on = local.sort.key === key;
      const btn = el("button", `tsort${on ? " on " + local.sort.dir : ""}${RIGHT_COLUMNS.has(key) ? " right" : ""}`);
      btn.type = "button";
      btn.append(el("span", null, label), el("i", "tsort-arrow", on ? (local.sort.dir === "asc" ? "▲" : "▼") : "⇅"));
      btn.setAttribute("aria-sort", on ? (local.sort.dir === "asc" ? "ascending" : "descending") : "none");
      btn.title = `Sort by ${label.toLowerCase()}`;
      btn.addEventListener("click", () => {
        // First click sorts the way the column reads best; the second flips it.
        local.sort = on ? { key, dir: local.sort.dir === "asc" ? "desc" : "asc" } : { key, dir: natural };
        paint();
      });
      head.append(btn);
    }
    card.append(head);

    for (const row of sortedLeaders()) {
      const me = local.login && row.user?.login === local.login;
      const line = el("div", `trow${me ? " me" : ""}${row.rank === 1 ? " first" : ""}`);
      line.append(el("span", "trank", `#${row.rank}`));

      const user = el("div", "tuser");
      user.append(avatar(row.user, "tavatar"));
      const copy = el("span");
      const strong = el("strong");
      strong.append(nameWithBadges(row.user, row.user?.displayName));
      copy.append(strong, el("small", null, me ? "You" : row.accuracy !== null ? `${row.accuracy}% right` : ""));
      user.append(copy);
      line.append(user);

      const profit = el("span", `tprofit right ${row.profit < 0 ? "down" : "up"}`);
      profit.append(zc(row.profit, { sign: true }));
      const rec = (league) => {
        const x = recordOf(row, league);
        const cell = el("span", `trecord right nums${x ? "" : " dim"}`, x ? `${x.wins}\u2013${x.losses}` : "\u2014");
        if (x) cell.title = `${league}: ${x.profit > 0 ? "+" : ""}${x.profit} ZC`;
        return cell;
      };
      line.append(profit, rec("NFL"), rec("MLB"));
      card.append(line);
    }
    wrap.append(card);
    return wrap;
  }

  function historyView() {
    const wrap = document.createDocumentFragment();

    if (!local.authed) {
      wrap.append(emptyNote("Log in to see your history", "Every stake taken and every payout returned shows here."));
      return wrap;
    }
    if (!local.loaded) {
      wrap.append(skelRows(5, true));
      return wrap;
    }

    // Built from the picks themselves: a stake goes out when a pick locks,
    // and something comes back when it settles. That is the whole story
    // and it needs no second source to tell it.
    const hl = leagueCounts(local.myPicks.map(leagueOf));
    if (hl.leagues.length > 1) mountTools(sportFilter(hl.leagues, hl.counts, local.myPicks.length));
    const shownPicks = local.sport === "all" ? local.myPicks : local.myPicks.filter((p) => leagueOf(p) === local.sport);

    const entries = [];
    for (const p of shownPicks) {
      const line = Number(p.oddsLocked ?? p.odds ?? 0);
      const game = `${sideName(p)} vs ${oppName(p)}${p.market?.league ? " · " + p.market.league : ""}`;
      entries.push({
        type: "wager", at: p.createdAt, amount: -Number(p.wager),
        title: `Pick locked · ${sideName(p)} ${formatLine(line)}`,
        detail: `${game} · returns ${totalReturn(p.wager, line)} if it lands`
      });
      if (p.status === "WON") entries.push({ type: "payout", at: p.settledAt, amount: Number(p.payout),
        title: `Won · ${sideName(p)} ${formatLine(line)}`, detail: `${game} · settled from the final score` });
      if (p.status === "LOST") entries.push({ type: "loss", at: p.settledAt, amount: 0,
        title: `Lost · ${sideName(p)} ${formatLine(line)}`, detail: `${game} · stake gone` });
      if (p.status === "REFUNDED") entries.push({ type: "refund", at: p.settledAt, amount: Number(p.wager),
        title: `Refunded · ${sideName(p)} vs ${oppName(p)}`, detail: "No action · full stake returned" });
    }
    entries.sort((a, b) => String(b.at).localeCompare(String(a.at)));

    if (!entries.length) {
      wrap.append(emptyNote("Nothing yet", "Lock a pick and it lands here, then again when it settles."));
      return wrap;
    }

    const list = el("div", "historylist");
    const icons = { wager: "↗", payout: "✓", loss: "✕", refund: "↩" };
    let lastDay = "";
    for (const row of entries) {
      // A header each time the calendar day changes, newest day first.
      const day = dayLabel(row.at);
      if (day !== lastDay) {
        lastDay = day;
        const net = entries
          .filter((e) => dayLabel(e.at) === day)
          .reduce((n, e) => n + e.amount, 0);
        const header = el("div", "historyday");
        header.append(el("strong", null, day));
        const sum = el("span", `nums ${net > 0 ? "up" : net < 0 ? "down" : ""}`);
        sum.append(zc(net, { sign: true }));
        header.append(sum);
        list.append(header);
      }
      const item = el("article", `historyrow ${row.type}`);
      item.append(el("span", "historyicon", icons[row.type] || "•"));
      const copy = el("span", "historycopy");
      copy.append(el("strong", null, row.title), el("small", null, row.detail));
      const amount = el("span", "historyamount");
      const strong = el("strong");
      strong.append(zc(row.amount, { sign: true }));
      amount.append(strong, el("small", null, whenLabel(row.at)));
      item.append(copy, amount);
      list.append(item);
    }
    wrap.append(list);
    return wrap;
  }

  function ledgerView() {
    const wrap = document.createDocumentFragment();

    if (!local.loaded) {
      wrap.append(skelRows(8, true));
      return wrap;
    }
    const ll = leagueCounts(local.communityLedger.map(leagueOf));
    if (ll.leagues.length > 1) mountTools(sportFilter(ll.leagues, ll.counts, local.communityLedger.length));
    const rows = local.sport === "all" ? local.communityLedger : local.communityLedger.filter((r) => leagueOf(r) === local.sport);

    if (!rows.length) {
      wrap.append(emptyNote("No picks yet", "Every pick anyone makes shows here — who, which side, how much, and what came of it."));
      return wrap;
    }

    const card = el("div", "tablecard ledger");
    for (const row of rows) {
      const status = { ACTIVE: "pending", WON: "won", LOST: "lost", REFUNDED: "refunded" }[row.status] || "pending";
      const me = local.login && row.user?.login === local.login;
      const line = el("div", `trow ledgerrow ${status}${me ? " me" : ""}`);

      const user = el("div", "tuser");
      user.append(avatar(row.user, "tavatar"));
      const copy = el("span");
      const strong = el("strong");
      strong.append(nameWithBadges(row.user));
      copy.append(strong, el("small", null, `@${row.user?.login}`));
      user.append(copy);

      const pick = el("div", "tpick");
      const pickCopy = el("span");
      const teamEl = el("strong");
      if (row.market?.slug) {
        const g = el("a", "glink", sideName(row));
        g.href = `/g/${row.market.slug}`;
        teamEl.append(g);
      } else {
        teamEl.textContent = sideName(row);
      }
      pickCopy.append(teamEl, el("small", null, `vs ${oppName(row)}${row.market?.league ? " · " + row.market.league : ""}`));
      pick.append(crest(row.market, sideName(row), "tpick-crest"), pickCopy);

      const stake = el("div", "tstat right");
      stake.append(el("span", null, "Wager"));
      const sv = el("strong");
      sv.append(zc(row.wager));
      stake.append(sv);

      const settled = status !== "pending";
      const net = settled ? Number(row.profit) : null;
      const netEl = el("div", `tstat right ${net > 0 ? "up" : net < 0 ? "down" : ""}`);
      netEl.append(el("span", null, "Net"));
      const nv = el("strong");
      if (net === null) nv.textContent = "Open";
      else nv.append(zc(net, { sign: true }));
      netEl.append(nv);

      const result = el("div", "tresult right");
      const label = { pending: "Bet open", won: "Won", lost: "Lost", refunded: "Refund" }[status];
      result.append(el("span", "tstatus", label), el("small", null, whenLabel(settled ? row.settledAt : row.createdAt)));

      line.append(user, pick, stake, netEl, result);
      card.append(line);
    }
    wrap.append(card);
    return wrap;
  }

  /* ---------------------------------------------------------- shell */

  const TABS = [
    ["markets", "Markets", marketsView],
    ["mypicks", "My Picks", ticketsView],
    ["leaderboard", "Leaderboard", leaderboardView],
    ["history", "History", historyView],
    ["ledger", "Community Ledger", ledgerView]
  ];

  /**
   * The season leader, up top where nobody can miss it. Purple on purpose:
   * gold is the wallet, green is a win, red is a loss — the crown gets a
   * colour nothing else on the page uses.
   */
  /* ---------------------------------------------------------- header

     The season leader is one pill on the title row; your own numbers
     are one card under it. The tabs follow. Nothing else sits above
     the first market. */

  function leaderPill() {
    const top = local.leaderboard[0] || null;
    const pill = el("a", `leaderpill${top ? "" : " empty"}`);
    pill.href = "/?view=picks&tab=leaderboard";
    pill.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      local.tab = "leaderboard";
      writeTabToUrl("leaderboard");
      paint();
    });
    pill.append(el("span", "lp-crown", "👑"));
    if (!top) {
      const copy0 = el("span", "lp-copy");
      copy0.append(el("span", "lp-kicker", "Season leader"), el("b", null, "Crown up for grabs"));
      pill.append(copy0);
      return pill;
    }
    pill.append(avatar(top.user, "lp-av"));
    const copy = el("span", "lp-copy");
    copy.append(el("span", "lp-kicker", "Season leader"));
    const line = el("span", "lp-line");
    line.append(el("b", null, top.user?.displayName || top.user?.login || "—"));
    const profit = el("span", "lp-profit");
    profit.append(zc(top.profit, { sign: true }));
    line.append(profit);
    copy.append(line);
    pill.append(copy);
    const me = local.authed && local.season?.rank ? `you're #${local.season.rank}` : "leads";
    pill.append(el("small", "lp-note", me));
    pill.title = `${top.user?.displayName || ""} leads the season · ${top.record} · ${top.accuracy}% right`;
    return pill;
  }

  function skelPill() {
    const pill = el("span", "leaderpill is-sk");
    pill.setAttribute("aria-busy", "true");
    pill.append(sk(22, 22, "circle"), sk(90, 12), sk(50, 12));
    return pill;
  }

  function quick(label, value, note, tone) {
    const box = el("div", `pf-q${tone ? " " + tone : ""}`);
    box.append(el("span", null, label));
    const big = el("b", "nums");
    if (value instanceof Node) big.append(value); else big.textContent = value;
    box.append(big);
    if (note) box.append(el("small", null, note));
    return box;
  }

  function myCard() {
    if (!local.authed) {
      const card = el("div", "pf-card picks-login");
      const copy = el("div");
      copy.append(el("b", null, "Log in with Twitch to make picks"),
        el("span", null, "Your ZCoins from chat come with you. One pick per game, wins pay out at the final."));
      const go = el("a", "login-btn", "Log in with Twitch");
      go.href = "/api/picks/auth/twitch/start?returnTo=" + encodeURIComponent("/?view=picks");
      card.append(copy, go);
      return card;
    }
    const balance = Number(local.wallet?.balance);
    const season = local.season || {};
    const settled = Number(season.wins || 0) + Number(season.losses || 0);
    const profit = Number(season.profit || 0);
    const card = el("div", "pf-card picks-me");
    const row = el("div", "pf-quick five");
    const wallet = el("span", "zc-amount nums");
    const coin = document.createElement("img");
    coin.className = "zcoin-mark";
    coin.src = "/v3/assets/img/zcoin.webp";
    coin.alt = "";
    coin.width = 18; coin.height = 18;
    wallet.append(coin, document.createTextNode(Number.isFinite(balance) ? balance.toLocaleString() : "—"));
    const walletTile = quick("My wallet", wallet, local.wallet?.connected ? "live from StreamElements" : "not connected", "wallet");
    const big = document.createElement("img");
    big.className = "zc-full";
    big.src = "/v3/assets/img/zcoin.webp";
    big.alt = "";
    big.width = 56; big.height = 56;
    walletTile.append(big);
    row.append(
      walletTile,
      quick(`${season.name || season.id || "Season"} profit`, zc(profit, { sign: true }), settled ? `${settled} settled` : "nothing settled yet", profit > 0 ? "up" : profit < 0 ? "down" : ""),
      quick("Record", `${Number(season.wins || 0)}–${Number(season.losses || 0)}`, recordNoteOf(season.records) || (settled ? `${season.accuracy}% right` : "first game decides it")),
      quick("Rank", season.rank ? `#${season.rank} of ${season.players}` : "—", season.rank ? "by Picks profit" : "unranked until a pick settles"),
      quick("Open", String(local.myPicks.filter((x) => x.status === "ACTIVE").length), "picks in play")
    );
    card.append(row);
    return card;
  }

  function recordNoteOf(records) {
    const parts = [];
    for (const league of ["NFL", "MLB"]) {
      const r = records?.[league];
      if (r && (r.wins || r.losses)) parts.push(`${league} ${r.wins}–${r.losses}`);
    }
    return parts.join(" · ");
  }

  function skelMyCard() {
    const card = el("div", "pf-card picks-me is-sk");
    card.setAttribute("aria-busy", "true");
    const row = el("div", "pf-quick five");
    for (let i = 0; i < 5; i += 1) {
      const q = el("div", "pf-q sk-lines");
      q.append(sk(60, 8), sk(70, 22), sk(90, 8));
      row.append(q);
    }
    card.append(row);
    return card;
  }

  /** "NFL 1–0" over "MLB 3–1" — a dash for a league with nothing settled. */
  function recordSplit(records) {
    const box = el("span", "recsplit");
    for (const league of ["NFL", "MLB"]) {
      const r = records?.[league];
      const row = el("span", `recsplit-row${r ? "" : " dim"}`);
      row.append(el("small", null, league), document.createTextNode(r ? `${r.wins}\u2013${r.losses}` : "\u2014"));
      if (r) row.title = `${league}: ${r.profit > 0 ? "+" : ""}${r.profit} ZC`;
      box.append(row);
    }
    return box;
  }

  function paint() {
    root.replaceChildren();

    const head = el("div", "viewhead picks-head");
    const wrap = el("div");
    const titleRow = el("div", "picks-title");
    titleRow.append(el("h1", null, "Picks"), local.loaded ? leaderPill() : skelPill());
    wrap.append(titleRow);
    head.append(wrap);
    root.append(head);
    root.append(local.loaded ? myCard() : skelMyCard());

    // Tabs, with a count where one helps, and a slot on the right for
    // the tab's own tools (the sport switch) so nothing else stacks up.
    const openCount = local.markets.filter((m) => m.state === "OPEN" && (!m.startsAt || new Date(m.startsAt).getTime() > Date.now())).length;
    const counts = { markets: openCount, mypicks: local.myPicks.filter((x) => x.status === "ACTIVE").length };
    const tabs = el("nav", "pf-tabs picks-tabs");
    tabs.setAttribute("aria-label", "Picks views");
    for (const [key, label] of TABS) {
      const btn = el("button", "pf-tab", label);
      btn.type = "button";
      if (local.loaded && counts[key]) btn.append(el("i", null, String(counts[key])));
      if (key === local.tab) {
        btn.classList.add("on");
        btn.setAttribute("aria-current", "page");
      }
      btn.addEventListener("click", () => {
        local.tab = key;
        writeTabToUrl(key);
        paint();
      });
      tabs.append(btn);
    }
    local.toolsSlot = el("span", "tabs-tools");
    tabs.append(local.toolsSlot);
    root.append(tabs);

    const active = TABS.find(([k]) => k === local.tab);
    root.append(active[2]());
  }

  /* ---------------------------------------------------------- tab links
     /?view=picks&tab=history is a link someone can paste. The tab is
     read from the URL on the way in and written back on every click,
     with replaceState so the back button still leaves the page rather
     than walking through every tab that was looked at. */

  const TAB_ALIASES = { picks: "mypicks", my: "mypicks", "my-picks": "mypicks", leaders: "leaderboard", board: "leaderboard", community: "ledger" };

  function readTabFromUrl() {
    const raw = String(new URL(location.href).searchParams.get("tab") || "").toLowerCase();
    const key = TAB_ALIASES[raw] || raw;
    return TABS.some(([k]) => k === key) ? key : null;
  }

  function writeTabToUrl(key) {
    const url = new URL(location.href);
    if (url.searchParams.get("view") !== "picks") return;
    if (key === "markets") url.searchParams.delete("tab");
    else url.searchParams.set("tab", key);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;
      local.wallet = api.state.session?.wallet || local.wallet;
      local.tab = readTabFromUrl() || local.tab;
      local.sport = readSportFromUrl();
      paint();
      if (!local.loaded) {
        await loadMarkets();
        if (root.isConnected) paint();
        await loadUpcoming();
        if (root.isConnected) paint();
      }
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("picks", view);
  }
  boot();
})();

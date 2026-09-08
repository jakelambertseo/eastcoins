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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
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
      el("span", "market-time", startLabel(market.startsAt))
    );

    const sides = el("div", "market-sides");
    for (const side of ["away", "home"]) {
      const name = side === "away" ? away : home;
      const line = side === "away" ? market.awayOdds : market.homeOdds;
      const btn = el("button", "side");
      btn.type = "button";

      const label = el("span", "side-team", name || "TBC");
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
    const opensAt = new Date(new Date(game.startsAt).getTime() - 30 * 60 * 1000);

    const head = el("div", "market-head");
    head.append(
      el("span", "market-league", game.league || game.sport || "Upcoming"),
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

    const opens = Number.isNaN(opensAt.getTime()) ? "" : opensAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    card.append(head, sides, el("p", "market-foot",
      `Opens for picks ${opens ? "at " + opens : "30 minutes before kickoff"} · line locks then, and may move until it does.`));
    return card;
  }

  function upcomingSection() {
    const games = local.upcoming;
    if (!games.length) return null;

    const section = el("section", "upcoming");
    const head = el("div", "upcoming-head");
    const copy = el("div");
    copy.append(el("h2", null, "Upcoming"));
    const stamp = local.upcomingAt ? new Date(local.upcomingAt) : null;
    const asOf = stamp && !Number.isNaN(stamp.getTime())
      ? ` · lines as of ${stamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "";
    copy.append(el("p", null, `${games.length} game${games.length === 1 ? "" : "s"} on the way — each opens for picks 30 minutes before kickoff${asOf}.`));
    head.append(copy);
    section.append(head);

    let lastDay = "";
    let list = null;
    for (const game of games) {
      const day = dayHeading(game.startsAt);
      if (day !== lastDay) {
        lastDay = day;
        section.append(el("h3", "upcoming-day", day));
        list = el("div", "marketlist");
        section.append(list);
      }
      list.append(upcomingCard(game));
    }
    return section;
  }

  function marketsView() {
    const wrap = document.createDocumentFragment();

    const note = el("p", "picks-note");
    note.textContent =
      "Prices are sportsbook moneylines, fixed when the market opens — everyone gets the same line. " +
      "Payouts show what a stake returns if that side wins; a losing pick returns nothing.";
    wrap.append(note);

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
    const openNow = local.markets.filter((m) =>
      m.state === "OPEN" &&
      (!m.startsAt || new Date(m.startsAt).getTime() > Date.now()));

    if (local.failed || !openNow.length) {
      const empty = el("div", "empty");
      empty.append(
        el("strong", null, local.failed ? "Couldn't load markets" : "No open markets"),
        el("p", null,
          local.failed
            ? "The Picks catalog didn't answer. This is usually temporary."
            : local.upcoming.length
              ? "The next games are listed below. Each opens 30 minutes before kickoff."
              : "Markets open around 30 minutes before kickoff. Check back closer to game time.")
      );
      wrap.append(empty);
    } else {
      const list = el("div", "marketlist");
      for (const market of openNow) list.append(marketCard(market));
      wrap.append(list);
    }

    const upcoming = upcomingSection();
    if (upcoming) wrap.append(upcoming);
    return wrap;
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
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
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
    const picks = local.myPicks.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    if (!local.authed) {
      wrap.append(emptyNote("Log in to see your picks", "Your picks and payouts show here once you're logged in with Twitch."));
      return wrap;
    }
    if (!picks.length) {
      wrap.append(emptyNote("No picks yet", "Anything you lock in — from here or with !pick in chat — shows up here with what happened to it."));
      return wrap;
    }

    const grid = el("div", "ticketgrid");
    for (const p of picks) {
      const status = { ACTIVE: "pending", WON: "won", LOST: "lost", REFUNDED: "refunded" }[p.status] || "pending";
      const card = el("article", `pickticket ${status}`);

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
    wrap.append(grid);
    return wrap;
  }

  const LEADER_COLUMNS = [
    ["rank", "Rank", (r) => r.rank, "asc"],
    ["user", "User", (r) => String(r.user?.displayName || r.user?.login || "").toLowerCase(), "asc"],
    ["profit", "Picks profit", (r) => r.profit, "desc"],
    ["record", "Record", (r) => r.wins * 1000 - r.losses, "desc"]
  ];

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

    if (!rows.length) {
      wrap.append(emptyNote("No standings yet", "The board fills in as games settle. First NFL markets open 30 minutes before each kick-off."));
      return wrap;
    }

    const card = el("div", "tablecard");
    const head = el("div", "trow thead");
    for (const [key, label, , natural] of LEADER_COLUMNS) {
      const on = local.sort.key === key;
      const btn = el("button", `tsort${on ? " on " + local.sort.dir : ""}${key === "profit" || key === "record" ? " right" : ""}`);
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
      user.append(el("span", "tavatar", initials(row.user?.displayName || row.user?.login)));
      const copy = el("span");
      copy.append(
        el("strong", null, row.rank === 1 ? `${row.user?.displayName} 👑` : row.user?.displayName),
        el("small", null, me ? "You" : row.accuracy !== null ? `${row.accuracy}% right` : "")
      );
      user.append(copy);
      line.append(user);

      const profit = el("span", `tprofit right ${row.profit < 0 ? "down" : "up"}`);
      profit.append(zc(row.profit, { sign: true }));
      line.append(profit, el("span", "trecord right nums", row.record));
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

    // Built from the picks themselves: a stake goes out when a pick locks,
    // and something comes back when it settles. That is the whole story
    // and it needs no second source to tell it.
    const entries = [];
    for (const p of local.myPicks) {
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
    const rows = local.communityLedger;

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
      user.append(el("span", "tavatar", initials(row.user?.displayName || row.user?.login)));
      const copy = el("span");
      copy.append(el("strong", null, row.user?.displayName || row.user?.login), el("small", null, `@${row.user?.login}`));
      user.append(copy);

      const pick = el("div", "tpick");
      const pickCopy = el("span");
      pickCopy.append(el("strong", null, sideName(row)), el("small", null, `vs ${oppName(row)}${row.market?.league ? " · " + row.market.league : ""}`));
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
  function leaderWidget() {
    const top = local.leaderboard[0] || null;
    const box = el("section", `leaderwidget${top ? "" : " empty"}`);
    box.setAttribute("aria-label", "Season leader");
    box.append(el("span", "lw-shine"));

    const crown = el("span", "lw-crown", "👑");
    const copy = el("div", "lw-copy");
    const season = local.season?.name || "Season";

    if (!top) {
      copy.append(el("span", "lw-kicker", `${season} leader`),
        el("strong", "lw-name", "The crown is up for grabs"),
        el("small", "lw-note", "First settled pick takes it. Markets open 30 minutes before kick-off."));
      box.append(crown, copy);
      return box;
    }

    const me = local.login && top.user?.login === local.login;
    copy.append(
      el("span", "lw-kicker", `${season} leader`),
      el("strong", "lw-name", top.user?.displayName || top.user?.login),
      el("small", "lw-note", me ? "That's you. Keep it." : `${top.record} · ${top.accuracy}% right`)
    );

    const stats = el("div", "lw-stats");
    const profit = el("div", "lw-stat");
    profit.append(el("span", null, "Picks profit"));
    const big = el("strong", "nums");
    big.append(zc(top.profit, { sign: true }));
    profit.append(big);
    const lead = local.leaderboard[1] ? top.profit - local.leaderboard[1].profit : null;
    const gap = el("div", "lw-stat");
    // How far ahead of #2 they are — or, with nobody else on the board
    // yet, say so rather than show a lead over no one.
    gap.append(el("span", null, "Lead over #2"),
      el("strong", "nums", lead === null ? "no #2 yet" : `${lead > 0 ? "+" : ""}${lead.toLocaleString()}`));
    stats.append(profit, gap);

    const av = el("span", "lw-avatar", initials(top.user?.displayName || top.user?.login));
    box.append(crown, av, copy, stats);
    return box;
  }

  function summaryStrip() {
    const strip = el("div", "summarystrip");
    const balance = Number(local.wallet?.balance);
    const season = local.season || {};
    const settled = Number(season.wins || 0) + Number(season.losses || 0);
    const year = season.name || season.id || "Season";

    const cards = [
      ["ZCoins wallet", Number.isFinite(balance) ? balance.toLocaleString() : "—",
        local.wallet?.connected ? "Live from StreamElements" : "Log in with Twitch", true],
      [`${year} Picks profit`,
        local.authed ? `${season.profit > 0 ? "+" : season.profit < 0 ? "\u2212" : ""}${Math.abs(Number(season.profit || 0)).toLocaleString()}` : "—",
        settled ? "Wagers vs settled returns" : "Nothing settled yet"],
      ["Record",
        local.authed ? `${season.wins || 0}\u2013${season.losses || 0}` : "—",
        settled ? `${season.accuracy}% of settled picks` : "First game decides it"],
      ["Picks rank",
        local.authed && season.rank ? `#${season.rank} of ${season.players}` : "—",
        season.rank ? "Ranked by Picks profit" : "Unranked until a pick settles"]
    ];
    for (const [k, v, note, wallet] of cards) {
      const card = el("article", `summarycard${wallet ? " wallet" : ""}`);
      card.append(el("span", null, k), el("strong", "nums", v), el("small", null, note));
      strip.append(card);
    }
    return strip;
  }

  function paint() {
    root.replaceChildren();

    const head = el("div", "viewhead");
    const wrap = el("div");
    wrap.append(el("h1", null, "Picks"));
    head.append(wrap);
    root.append(head);

    root.append(leaderWidget());
    root.append(summaryStrip());

    const tabs = el("nav", "viewtabs");
    tabs.setAttribute("aria-label", "Picks views");
    for (const [key, label] of TABS) {
      const btn = el("button", "viewtab", label);
      btn.type = "button";
      if (key === local.tab) {
        btn.classList.add("active");
        btn.setAttribute("aria-current", "page");
      }
      btn.addEventListener("click", () => {
        local.tab = key;
        paint();
      });
      tabs.append(btn);
    }
    root.append(tabs);

    const active = TABS.find(([k]) => k === local.tab);
    root.append(active[2]());
  }

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;
      local.wallet = api.state.session?.wallet || local.wallet;
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

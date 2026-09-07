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
    ticket: null
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

  async function loadMarkets() {
    try {
      const response = await fetch("/api/picks/bootstrap", { credentials: "include" });
      if (!response.ok) throw new Error("bootstrap");
      const payload = await response.json();
      if (!payload?.ok) throw new Error("bootstrap");

      local.markets = Array.isArray(payload.markets) ? payload.markets : [];
      local.wallet = payload.session?.wallet || null;
      local.loaded = true;
    } catch {
      local.failed = true;
      local.loaded = true;
    }
  }

  /* ---------------------------------------------------------- demo rows */

  const DEMO_TICKETS = [
    { team: "49ers", opp: "Rams", code: "SF", stake: 100, line: -150, status: "pending", foot: "Kicks off 4:25 PM · line locked when the market opened" },
    { team: "Chiefs", opp: "Broncos", code: "KC", stake: 40, line: -220, status: "pending", foot: "Kicks off Mon 7:15 PM · line locked when the market opened" },
    { team: "Ravens", opp: "Bengals", code: "BAL", stake: 60, line: 130, status: "won", foot: "Ravens 24–17 · paid 9 min after full time" },
    { team: "Packers", opp: "Vikings", code: "GB", stake: 80, line: -105, status: "won", foot: "Packers 31–28 · paid 14 min after full time" },
    { team: "Cowboys", opp: "Eagles", code: "DAL", stake: 25, line: -110, status: "lost", foot: "Eagles 20–13 · stake lost" },
    { team: "Ortega", opp: "Volkanovski", code: "UFC", stake: 30, line: 0, status: "refunded", foot: "Bout scratched at weigh-in · full stake returned" }
  ];

  const DEMO_LEADERS = [
    { rank: 1, name: "heartlarva", note: "Longest streak · 7", profit: 412, record: "22–14" },
    { rank: 2, name: "charleskellybirdlaw", note: "EastCoin Picks", profit: 327, record: "19–12" },
    { rank: 3, name: "jimmytomato", note: "You", profit: 312, record: "14–9", me: true },
    { rank: 4, name: "zwades", note: "EastCoin Picks", profit: 180, record: "16–15" },
    { rank: 5, name: "andyreidisapawg", note: "EastCoin Picks", profit: 96, record: "11–10" },
    { rank: 6, name: "bootypaper", note: "EastCoin Picks", profit: -45, record: "8–13" },
    { rank: 7, name: "psilocyboone", note: "Backs the dog every time", profit: -118, record: "6–15" }
  ];

  const DEMO_HISTORY = [
    { type: "wager", title: "Pick locked · 49ers −150", detail: "49ers vs Rams · NFL · returns 167 if it lands", amount: -100, when: "Today, 3:55 PM" },
    { type: "wager", title: "Pick locked · Chiefs −220", detail: "Chiefs vs Broncos · NFL · returns 59 if it lands", amount: -40, when: "Today, 3:51 PM" },
    { type: "payout", title: "Won · Packers −105", detail: "Packers 31–28 Vikings · settled from final score", amount: 157, when: "Yesterday, 10:41 PM" },
    { type: "wager", title: "Pick locked · Packers −105", detail: "Packers vs Vikings · NFL", amount: -80, when: "Yesterday, 7:32 PM" },
    { type: "payout", title: "Won · Ravens +130", detail: "Ravens 24–17 Bengals · settled from final score", amount: 138, when: "Sun, 7:48 PM" },
    { type: "refund", title: "Refunded · Ortega vs Volkanovski", detail: "Bout scratched at weigh-in · no action", amount: 30, when: "Sat, 11:02 PM" }
  ];

  const DEMO_LEDGER = [
    { user: "heartlarva", pick: "49ers", opp: "Rams", league: "NFL", stake: 100, net: null, status: "pending", when: "3:58 PM" },
    { user: "jimmytomato", pick: "49ers", opp: "Rams", league: "NFL", stake: 100, net: null, status: "pending", when: "3:55 PM", me: true },
    { user: "psilocyboone", pick: "Rams", opp: "49ers", league: "NFL", stake: 60, net: null, status: "pending", when: "3:52 PM" },
    { user: "charleskellybirdlaw", pick: "Ravens", opp: "Bengals", league: "NFL", stake: 80, net: 104, status: "won", when: "Sun, 7:48 PM" },
    { user: "zwades", pick: "Bengals", opp: "Ravens", league: "NFL", stake: 50, net: -50, status: "lost", when: "Sun, 7:48 PM" },
    { user: "bootypaper", pick: "Ortega", opp: "Volkanovski", league: "UFC", stake: 30, net: 0, status: "refunded", when: "Sat, 11:02 PM" }
  ];

  /* ---------------------------------------------------------- helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
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

  function marketCard(market) {
    const card = el("article", "market");

    const head = el("div", "market-head");
    head.append(
      el("span", "market-league", market.league || market.sport || "Market"),
      el("span", "market-time", market.startLabel || market.commenceLabel || "")
    );

    const sides = el("div", "market-sides");
    for (const side of ["away", "home"]) {
      const name = side === "away" ? market.away : market.home;
      const line = side === "away" ? market.awayOdds : market.homeOdds;
      const btn = el("button", "side");
      btn.type = "button";

      const label = el("span", "side-team", name || "TBC");
      const price = el("span", "side-line nums", formatLine(line));
      const pays = el("span", "side-pays");
      pays.append(document.createTextNode("10 pays "), zc(totalReturn(10, line)));

      btn.append(label, price, pays);
      btn.addEventListener("click", () => openTicket(market, side, name, line));
      sides.append(btn);
    }

    card.append(head, sides);
    return card;
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

    if (local.failed || !local.markets.length) {
      const empty = el("div", "empty");
      empty.append(
        el("strong", null, local.failed ? "Couldn't load markets" : "No open markets"),
        el("p", null,
          local.failed
            ? "The Picks catalog didn't answer. This is usually temporary."
            : "Markets open around 30 minutes before kickoff. Check back closer to game time.")
      );
      wrap.append(empty);
      return wrap;
    }

    const list = el("div", "marketlist");
    for (const market of local.markets) list.append(marketCard(market));
    wrap.append(list);
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
    head.append(el("strong", null, "Lock your pick"));
    const close = el("button", "iconbtn", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => {
      local.ticket = null;
      renderTicket();
    });
    head.append(close);

    const pick = el("div", "ticket-pick");
    pick.append(
      el("span", "ticket-team", team),
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

    confirm.addEventListener("click", () => {
      // The wager endpoint is still safety-locked, so this must not
      // pretend a pick was placed.
      hint.textContent =
        "Wagering isn't switched on yet — this would place the pick once it is.";
      hint.classList.add("is-error");
      confirm.disabled = true;
    });

    input.addEventListener("input", refresh);

    panel.append(head, pick, field, summary, hint, confirm);
    backdrop.append(panel);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        local.ticket = null;
        renderTicket();
      }
    });

    document.body.append(backdrop);
    refresh();
    input.focus();
    input.select();
  }

  /* ---------------------------------------------------------- demo views */

  function demoBadge() {
    const strip = el("div", "demo-strip");
    strip.append(el("b", null, "Example"), el("span", null,
      "Demo data — real picks appear here once wagering is switched on."));
    return strip;
  }

  function ticketsView() {
    const wrap = document.createDocumentFragment();
    wrap.append(demoBadge());
    const grid = el("div", "ticketgrid");

    for (const t of DEMO_TICKETS) {
      const card = el("article", `pickticket ${t.status}`);

      const head = el("div", "pickticket-head");
      const teamWrap = el("div", "pickticket-team");
      teamWrap.append(el("span", "pickticket-crest", t.code));
      const names = el("span");
      names.append(el("strong", null, t.team), el("small", null, `vs ${t.opp}`));
      teamWrap.append(names);
      head.append(teamWrap, el("span", "pickticket-status", t.status));

      const grid3 = el("div", "pickticket-grid");
      const ret =
        t.status === "won" ? totalReturn(t.stake, t.line)
          : t.status === "lost" ? 0
            : t.status === "refunded" ? t.stake
              : totalReturn(t.stake, t.line);

      const cells = [
        ["Wager", zc(t.stake), ""],
        [t.status === "pending" ? "Locked odds" : "Final",
          el("span", "nums", t.line ? formatLine(t.line) : "No action"), ""],
        [t.status === "pending" ? "Potential" : t.status === "won" ? "Payout"
          : t.status === "refunded" ? "Refund" : "Return", zc(ret), "return"]
      ];
      cells.forEach(([k, v], i) => {
        const cell = el("div", `pickticket-stat${i === 2 ? " return" : ""}`);
        cell.append(el("span", null, k));
        const strong = el("strong");
        strong.append(v);
        cell.append(strong);
        grid3.append(cell);
      });

      card.append(head, grid3, el("div", "pickticket-foot", t.foot));
      grid.append(card);
    }
    wrap.append(grid);
    return wrap;
  }

  function leaderboardView() {
    const wrap = document.createDocumentFragment();
    wrap.append(demoBadge());
    const card = el("div", "tablecard");

    const head = el("div", "trow thead");
    ["Rank", "User", "Picks profit", "Record"].forEach((h, i) => {
      const c = el("span", i > 1 ? "right" : null, h);
      head.append(c);
    });
    card.append(head);

    for (const row of DEMO_LEADERS) {
      const line = el("div", `trow${row.me ? " me" : ""}`);
      line.append(el("span", "trank", `#${row.rank}`));

      const user = el("div", "tuser");
      user.append(el("span", "tavatar", initials(row.name)));
      const copy = el("span");
      copy.append(
        el("strong", null, row.rank === 1 ? `${row.name} 👑` : row.name),
        el("small", null, row.note)
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
    wrap.append(demoBadge());
    const list = el("div", "historylist");
    const icons = { wager: "↗", payout: "✓", refund: "↩" };

    for (const row of DEMO_HISTORY) {
      const item = el("article", `historyrow ${row.type}`);
      item.append(el("span", "historyicon", icons[row.type] || "•"));
      const copy = el("span", "historycopy");
      copy.append(el("strong", null, row.title), el("small", null, row.detail));
      const amount = el("span", "historyamount");
      const strong = el("strong");
      strong.append(zc(row.amount, { sign: true }));
      amount.append(strong, el("small", null, row.when));
      item.append(copy, amount);
      list.append(item);
    }
    wrap.append(list);
    return wrap;
  }

  function ledgerView() {
    const wrap = document.createDocumentFragment();
    wrap.append(demoBadge());
    const card = el("div", "tablecard ledger");

    for (const row of DEMO_LEDGER) {
      const line = el("div", `trow ledgerrow ${row.status}${row.me ? " me" : ""}`);

      const user = el("div", "tuser");
      user.append(el("span", "tavatar", initials(row.user)));
      const copy = el("span");
      copy.append(el("strong", null, row.user), el("small", null, `@${row.user}`));
      user.append(copy);

      const pick = el("div", "tpick");
      pick.append(el("strong", null, row.pick), el("small", null, `vs ${row.opp} · ${row.league}`));

      const stake = el("div", "tstat right");
      stake.append(el("span", null, "Wager"));
      const sv = el("strong");
      sv.append(zc(row.stake));
      stake.append(sv);

      const net = el("div", `tstat right ${row.net > 0 ? "up" : row.net < 0 ? "down" : ""}`);
      net.append(el("span", null, row.net === null ? "Net" : "Net"));
      const nv = el("strong");
      if (row.net === null) nv.textContent = "Open";
      else nv.append(zc(row.net, { sign: true }));
      net.append(nv);

      const result = el("div", "tresult right");
      const label = { pending: "Bet open", won: "Won", lost: "Lost", refunded: "Refund" }[row.status];
      result.append(el("span", "tstatus", label), el("small", null, row.when));

      line.append(user, pick, stake, net, result);
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

  function summaryStrip() {
    const strip = el("div", "summarystrip");
    const balance = Number(local.wallet?.balance);
    const cards = [
      ["ZCoins wallet", Number.isFinite(balance) ? balance.toLocaleString() : "—",
        local.wallet?.connected ? "Live from StreamElements" : "Log in with Twitch", true],
      ["2026 Picks profit", "+312", "Wagers vs settled returns"],
      ["Record", "14–9", "61% of settled picks"],
      ["Picks rank", "#3 of 24", "Ranked by Picks profit"]
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
      }
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("picks", view);
  }
  boot();
})();

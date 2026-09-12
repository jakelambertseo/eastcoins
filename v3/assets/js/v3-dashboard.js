/* ============================================================
   EastCoin V3 — the dashboard

     /?view=dashboard   (one person)

   The headline first — users, bets, what each side of the house took,
   what is still riding, who is here — then four tabs: Overview, the
   Picks book, the Casino, and Health (the cron, Odds API credits, the
   wallet, the music worker, TMDB, keys, backups; green, amber, red).
   Refreshes itself every minute, keeping the open tab and every list's
   page where the reader left them.
   ============================================================ */
(() => {
  "use strict";

  let root = null;
  let timer = 0;
  let token = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  const fmt = (n) => Number(n || 0).toLocaleString();
  const ago = (iso) => {
    if (!iso) return "never";
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  };

  // The open tab and each list's page, kept across the one-minute
  // refresh: a repaint must not yank the page out from under whoever is
  // reading it.
  const ui = { tab: "", pages: new Map() };

  /** The same headline stat the profile and Picks pages use. */
  function quickStat(label, value, note, tone) {
    const box = el("div", `pf-q${tone ? " " + tone : ""}`);
    box.append(el("span", null, label));
    const big = el("b", "nums");
    if (value instanceof Node) big.append(value); else big.textContent = value;
    box.append(big);
    if (note) box.append(el("small", null, note));
    return box;
  }

  /** Chicago day keys, so windows line up with the server's day chart. */
  const dayKeyBack = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  };
  function windowOf(days, since) {
    const rows = (days || []).filter((r) => r.day >= since);
    return {
      bets: rows.reduce((s, r) => s + Number(r.bets || 0), 0),
      staked: rows.reduce((s, r) => s + Number(r.staked || 0), 0),
      houseNet: rows.reduce((s, r) => s + Number(r.houseNet || 0), 0)
    };
  }

  function card(title, state, lines) {
    const c = el("article", `db-card ${state}`);
    const h = el("h2");
    h.append(el("span", "db-dot"), document.createTextNode(title));
    c.append(h);
    for (const [k, v] of lines) {
      const row = el("div", "db-row");
      row.append(el("span", null, k));
      const val = el("strong");
      if (v instanceof Node) val.append(v); else val.textContent = v;
      row.append(val);
      c.append(row);
    }
    return c;
  }

  /* ---------------------------------------------------------- the book

     The house's side of Picks. Money still riding is shown apart from
     the take, because an open pick is a liability, not a profit. */

  const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
  const zcs = (n) => {
    const span = el("span", "zc-amount");
    const mark = el("img", "zcoin-mark");
    mark.src = "/v3/assets/img/zcoin.webp";
    mark.alt = "ZC";
    span.append(document.createTextNode(signed(n)), mark);
    return span;
  };

  function stat(label, value, sub, tone) {
    const box = el("div", `db-stat${tone ? ` ${tone}` : ""}`);
    box.append(el("span", "db-stat-k", label));
    const b = el("b");
    if (value instanceof Node) b.append(value); else b.textContent = value;
    box.append(b);
    if (sub) box.append(el("span", "db-stat-s", sub));
    return box;
  }

  function miniTable(title, head, rows) {
    const box = el("div", "db-mini");
    box.append(el("h3", null, title));
    box.append(tableOf(head, rows));
    return box;
  }

  /**
   * The same table, a page at a time. `key` is what the page number is
   * remembered under, so the minute refresh lands the reader back on the
   * page they were on rather than on page one.
   */
  function pagedTable(key, title, head, rows, perPage = 8) {
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    const box = el("div", "db-mini");
    const draw = () => {
      const at = Math.min(Math.max(1, ui.pages.get(key) || 1), pages);
      ui.pages.set(key, at);
      box.replaceChildren();
      const h = el("h3", null, title);
      if (pages > 1) h.append(el("small", "db-of", `${at} / ${pages}`));
      box.append(h, tableOf(head, rows.slice((at - 1) * perPage, at * perPage)));
      if (pages > 1) {
        const nav = el("div", "db-pager");
        const step = (label, to, dead) => {
          const b = el("button", "db-pagebtn", label);
          b.type = "button";
          b.disabled = dead;
          b.addEventListener("click", () => { ui.pages.set(key, to); draw(); });
          return b;
        };
        nav.append(step("‹ Prev", at - 1, at <= 1),
          el("span", "db-pagecount", `${fmt(rows.length)} row${rows.length === 1 ? "" : "s"}`),
          step("Next ›", at + 1, at >= pages));
        box.append(nav);
      }
    };
    draw();
    return box;
  }

  /** pagedTable's paging, for rows that are nodes rather than cells. */
  function pagedList(key, title, nodes, perPage = 8) {
    const pages = Math.max(1, Math.ceil(nodes.length / perPage));
    const box = el("section", "db-attn");
    const draw = () => {
      const at = Math.min(Math.max(1, ui.pages.get(key) || 1), pages);
      ui.pages.set(key, at);
      box.replaceChildren();
      const h = el("h2", null, title);
      if (pages > 1) h.append(el("small", "db-of", `${at} / ${pages}`));
      const list = el("div", "db-list");
      nodes.slice((at - 1) * perPage, at * perPage).forEach((n) => list.append(n));
      box.append(h, list);
      if (pages > 1) {
        const nav = el("div", "db-pager");
        const step = (label, to, dead) => {
          const b = el("button", "db-pagebtn", label);
          b.type = "button";
          b.disabled = dead;
          b.addEventListener("click", () => { ui.pages.set(key, to); draw(); });
          return b;
        };
        nav.append(step("‹ Prev", at - 1, at <= 1),
          el("span", "db-pagecount", `${fmt(nodes.length)} row${nodes.length === 1 ? "" : "s"}`),
          step("Next ›", at + 1, at >= pages));
        box.append(nav);
      }
    };
    draw();
    return box;
  }

  function tableOf(head, rows) {
    const table = el("table");
    const tr = el("tr");
    head.forEach((h, i) => tr.append(el("th", i ? "num" : null, h)));
    const thead = el("thead");
    thead.append(tr);
    table.append(thead);
    const body = el("tbody");
    if (!rows.length) {
      const empty = el("tr");
      const td = el("td", "empty");
      td.colSpan = head.length;
      td.textContent = "Nothing yet.";
      empty.append(td);
      body.append(empty);
    }
    for (const cells of rows) {
      const line = el("tr");
      cells.forEach((c, i) => {
        const td = el("td", i ? "num" : null);
        if (c instanceof Node) td.append(c); else td.textContent = c;
        line.append(td);
      });
      body.append(line);
    }
    table.append(body);
    return table;
  }

  function bookBlock(b) {
    const wrap = el("section", "db-book");
    const head = el("div", "db-book-head");
    head.append(el("h2", null, "The book"), el("span", null, "Picks, all time · the house's take is exactly what players lost"));
    wrap.append(head);

    const stats = el("div", "db-stats");
    stats.append(
      stat("Bets taken", fmt(b.bets), `${fmt(b.bettors)} people · ${fmt(b.active)} still riding`),
      stat("Amount bet", fmt(b.staked), `avg ${fmt(b.avgBet)} · biggest ${fmt(b.biggestBet)}`),
      stat("House take", zcs(b.houseNet), b.holdPct === null ? "nothing settled yet" : `${b.holdPct}% of ${fmt(b.settledStaked)} settled`, b.houseNet >= 0 ? "good" : "bad"),
      stat("Paid out", fmt(b.paidOut), `${fmt(b.won)} winning picks`),
      stat("Players' record", `${fmt(b.won)}–${fmt(b.lost)}`, `${fmt(b.voided)} refunded`),
      stat("On the hook", fmt(b.exposure), `if every open pick wins · ${fmt(b.riding)} staked`)
    );
    wrap.append(stats);

    // Fourteen days of the house's take, in Chicago days.
    const days = b.days || [];
    if (days.length) {
      const chart = el("div", "db-chart");
      const peak = Math.max(1, ...days.map((d) => Math.abs(d.houseNet)));
      for (const day of days) {
        const col = el("div", "db-col");
        col.title = `${day.day}: house ${signed(day.houseNet)} ZC · ${day.bets} bets · ${fmt(day.staked)} staked`;
        const up = el("div", "db-up");
        const down = el("div", "db-down");
        const size = `${Math.round((Math.abs(day.houseNet) / peak) * 100)}%`;
        if (day.houseNet >= 0) up.style.height = size; else down.style.height = size;
        col.append(up, el("i"), down);
        col.append(el("span", null, day.day.slice(5).replace("-", "/")));
        chart.append(col);
      }
      const chartWrap = el("div", "db-chartwrap");
      chartWrap.append(el("h3", null, "House take by day"), chart);
      wrap.append(chartWrap);
    }

    const tables = el("div", "db-tables");
    tables.append(pagedTable("leagues", "By league", ["League", "Bets", "Bet", "House"],
      (b.leagues || []).map((l) => [l.league, fmt(l.bets), fmt(l.staked), zcs(l.houseNet)])));
    tables.append(pagedTable("bettors", "Biggest bettors", ["Who", "Bets", "Bet", "Their net"],
      (b.people || []).map((p) => [p.login, fmt(p.bets), fmt(p.staked), zcs(p.net)])));
    wrap.append(tables);

    return wrap;
  }

  /** Today / 7 / 14 days, the same three cells for either side of the house. */
  function windowsRow(title, cells) {
    const box = el("section", "db-winblock");
    box.append(el("h3", null, title));
    const windows = el("div", "db-windows");
    for (const [label, w] of cells) {
      const cell = el("div", "db-window");
      cell.append(el("span", "db-stat-k", label));
      const line = el("div", "db-window-row");
      line.append(el("span", null, `${fmt(w.bets)} bets`), el("span", null, `${fmt(w.staked)} bet`));
      const net = el("b", w.houseNet >= 0 ? "good" : "bad");
      net.append(zcs(w.houseNet));
      line.append(net);
      cell.append(line);
      windows.append(cell);
    }
    box.append(windows);
    return box;
  }

  /* The casino's side, read the same way: stake minus payout on decided
     bets. A bet still live counts as neither win nor loss. */
  function casinoBlock(c) {
    const wrap = el("section", "db-book");
    const head = el("div", "db-book-head");
    head.append(el("h2", null, "The casino"), el("span", null, "Coin Flip, Wheel, Horse Race, Higher or Lower, Mines and Plinko"));
    wrap.append(head);

    const stats = el("div", "db-stats");
    stats.append(
      stat("Bets settled", fmt(c.bets), `${fmt(c.players)} players${c.live ? ` · ${fmt(c.live)} live now` : ""}`),
      stat("Amount bet", fmt(c.staked), `${fmt(c.paidOut)} paid back`),
      stat("House take", zcs(c.houseNet), c.holdPct === null ? "nothing settled yet" : `${c.holdPct}% hold`, c.houseNet >= 0 ? "good" : "bad")
    );
    wrap.append(stats);

    if ((c.days || []).length) {
      const chart = el("div", "db-chart");
      const peak = Math.max(1, ...c.days.map((d) => Math.abs(d.houseNet)));
      for (const day of c.days) {
        const col = el("div", "db-col");
        col.title = `${day.day}: house ${signed(day.houseNet)} ZC · ${day.bets} bets · ${fmt(day.staked)} staked`;
        const up = el("div", "db-up");
        const down = el("div", "db-down");
        const size = `${Math.round((Math.abs(day.houseNet) / peak) * 100)}%`;
        if (day.houseNet >= 0) up.style.height = size; else down.style.height = size;
        col.append(up, el("i"), down, el("span", null, day.day.slice(5).replace("-", "/")));
        chart.append(col);
      }
      const chartWrap = el("div", "db-chartwrap");
      chartWrap.append(el("h3", null, "House take by day"), chart);
      wrap.append(chartWrap);
    }

    const tables = el("div", "db-tables");
    tables.append(pagedTable("cgames", "By game", ["Game", "Bets", "Bet", "House", "Hold"],
      (c.games || []).map((g) => [
        g.name,
        fmt(g.bets),
        fmt(g.staked),
        zcs(g.houseNet),
        g.holdPct === null ? "—" : `${g.holdPct}%`
      ]), 6));
    tables.append(pagedTable("cwins", "Biggest single win", ["Game", "Win", "Players", "Live"],
      (c.games || []).map((g) => [g.name, fmt(g.biggestWin), fmt(g.players), g.live ? fmt(g.live) : "—"]), 6));
    wrap.append(tables);
    return wrap;
  }

  function page(d) {
    const wrap = el("section", "dashboard");
    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Dashboard"), el("p", null, `As of ${new Date(d.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes every minute`));
    head.append(copy);

    // ---- the headline: what the page is opened to find out
    const b = d.book;
    const c = d.casinoBook;
    const online = d.presence ? d.presence.people + d.presence.guests : null;
    const quick = el("div", "pf-quick db-quick");
    quick.append(
      quickStat("Total users", fmt(d.users.total),
        d.users.today ? `${fmt(d.users.today)} joined today` : "none joined today"),
      quickStat("Total bets", fmt((b?.bets || 0) + (c?.bets || 0)),
        `${fmt(b?.bets || 0)} picks · ${fmt(c?.bets || 0)} casino`),
      quickStat("Picks take", b ? zcs(b.houseNet) : "—",
        b ? (b.holdPct === null ? "nothing settled yet" : `${b.holdPct}% hold · ${fmt(b.staked)} bet`) : "",
        b ? (b.houseNet >= 0 ? "up" : "down") : ""),
      quickStat("Casino take", c ? zcs(c.houseNet) : "—",
        c ? (c.holdPct === null ? "nothing settled yet" : `${c.holdPct}% hold · ${fmt(c.staked)} bet`) : "",
        c ? (c.houseNet >= 0 ? "up" : "down") : ""),
      quickStat("On the hook", b ? fmt(b.exposure) : "—",
        b ? `${fmt(b.active)} open pick${b.active === 1 ? "" : "s"} · ${fmt(b.riding)} staked` : ""),
      quickStat("Here now", online === null ? "—" : fmt(online),
        d.presence ? `${fmt(d.presence.people)} logged in · ${fmt(d.presence.guests)} guest${d.presence.guests === 1 ? "" : "s"}` : "")
    );
    head.append(quick);
    wrap.append(head);

    // ---- the tabs, the same shape Picks and the profiles use
    const TABS = [["overview", "Overview"], ["picks", "Picks book"], ["casino", "Casino"], ["health", "Health"]];
    const bar = el("nav", "pf-tabs db-tabs");
    bar.setAttribute("aria-label", "Dashboard sections");
    const panels = {};
    const buttons = {};
    for (const [key, label] of TABS) {
      const btn = el("button", "pf-tab", label);
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () => select(key, true));
      bar.append(btn);
      buttons[key] = btn;
      const panel = el("div", "pf-panel");
      panel.hidden = true;
      panels[key] = panel;
    }
    function select(key, push) {
      if (!panels[key]) key = "overview";
      ui.tab = key;
      for (const [k2, panel] of Object.entries(panels)) {
        panel.hidden = k2 !== key;
        buttons[k2].classList.toggle("on", k2 === key);
        buttons[k2].setAttribute("aria-selected", String(k2 === key));
      }
      if (push) {
        const url = new URL(location.href);
        url.hash = key === "overview" ? "" : key;
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      }
    }
    wrap.append(bar);

    // ---- Overview: how both sides of the house are doing lately
    if (b) {
      panels.overview.append(windowsRow("Picks", [
        ["Today", b.today], ["Last 7 days", b.week], ["Last 14 days", b.fortnight]
      ]));
    }
    if (c) {
      panels.overview.append(windowsRow("Casino", [
        ["Today", windowOf(c.days, dayKeyBack(0))],
        ["Last 7 days", windowOf(c.days, dayKeyBack(6))],
        ["Last 14 days", windowOf(c.days, dayKeyBack(13))]
      ]));
    }
    const glance = el("div", "pf-glance");
    const glanceCard = (key, icon, title, big, small) => {
      const g = el("button", "pf-glance-card");
      g.type = "button";
      g.append(el("span", "pf-glance-k", `${icon} ${title}`));
      const strong = el("b", "nums");
      if (big instanceof Node) strong.append(big); else strong.textContent = big;
      g.append(strong, el("small", null, small), el("em", null, "Open →"));
      g.addEventListener("click", () => select(key, true));
      return g;
    };
    glance.append(
      glanceCard("picks", "🪙", "Picks book", b ? zcs(b.houseNet) : "—",
        b ? `${fmt(b.bets)} bets from ${fmt(b.bettors)} people` : "no data"),
      glanceCard("casino", "🎰", "Casino", c ? zcs(c.houseNet) : "—",
        c ? `${fmt(c.bets)} plays from ${fmt(c.players)} players` : "no data"),
      glanceCard("health", "🩺", "Health", "—", "cron, keys, wallet, backups")
    );
    panels.overview.append(glance);

    // ---- the two books
    if (b) panels.picks.append(bookBlock(b));
    if (c) panels.casino.append(casinoBlock(c));

    const grid = el("div", "db-grid");

    // Cron
    const cronState = d.cron.healthy ? "ok" : d.cron.last ? "warn" : "bad";
    const detail = d.cron.detail || {};
    grid.append(card("Settlement cron", cronState, [
      ["Last run", `${ago(d.cron.last)}${d.cron.ageMinutes !== null ? ` (${d.cron.ageMinutes} min)` : ""}`],
      ["Ran as", detail.by || "—"],
      ["Last tick", detail.summary || "—"],
      ["Expected", "every 10 minutes"]
    ]));

    // Odds API
    const q = d.odds.quota;
    const oddsState = !d.odds.keyConfigured ? "bad" : !q ? "warn" : q.remaining < 1000 ? "warn" : "ok";
    grid.append(card("The Odds API", oddsState, [
      ["Key", d.odds.keyConfigured ? "configured" : "MISSING"],
      ["Credits remaining", q && Number.isFinite(q.remaining) ? fmt(q.remaining) : "unknown until the next fetch"],
      ["Used this month", q && Number.isFinite(q.used) ? fmt(q.used) : "—"],
      ["Last seen", q ? `${ago(d.odds.quotaAt)} · ${q.last || ""}` : "—"]
    ]));

    // Wallet
    const attention = d.wallet.attention || [];
    const needs = attention.filter((a) => a.status === "NEEDS_RECONCILIATION").length;
    const walletState = !d.wallet.writesEnabled || !d.wallet.probe?.ok || !d.wallet.probe?.readable ? "bad" : needs ? "warn" : "ok";
    grid.append(card("ZCoin wallet (StreamElements)", walletState, [
      ["Writes", d.wallet.writesEnabled ? "enabled" : "NOT configured"],
      ["Read probe", d.wallet.probe?.readable ? `ok · your balance ${fmt(d.wallet.probe.balance)} · ${d.wallet.probe.ms} ms` : "FAILED"],
      ["Confirmed ops", fmt(d.wallet.byStatus.CONFIRMED || 0)],
      ["Needs reconciliation", String(d.wallet.byStatus.NEEDS_RECONCILIATION || 0)],
      ["Failed / pending", `${d.wallet.byStatus.FAILED || 0} / ${d.wallet.byStatus.PENDING || 0}`]
    ]));

    // Picks
    const m = d.picks.markets;
    grid.append(card("Picks", "ok", [
      ["Open markets", `${m.OPEN || 0}${d.picks.nextStart ? ` · next ${new Date(d.picks.nextStart).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}`],
      ["In play (locked)", String(m.LOCKED || 0)],
      ["Settled / voided", `${m.SETTLED || 0} / ${m.VOID || 0}`],
      ["Active picks", `${fmt(d.picks.active)} · ${fmt(d.picks.riding)} ZC riding`],
      ["Picks today", fmt(d.picks.today)],
      ["Open wagering", d.chat.openWagering ? "everyone" : "allowlist only"]
    ]));

    // Music worker
    grid.append(card("Music worker", d.music?.ok && d.music.status === 200 ? "ok" : "bad", [
      ["Health", d.music?.ok ? `${d.music.status} · ${d.music.ms} ms` : `down · ${d.music?.error || ""}`],
      ["Service", d.music?.service || "—"]
    ]));

    // TMDB
    grid.append(card("TMDB (Movies & TV)", d.tmdb?.ok && d.tmdb.status === 200 ? "ok" : "bad", [
      ["Probe", d.tmdb?.ok && d.tmdb.status === 200 ? `ok · ${d.tmdb.ms} ms` : `${d.tmdb?.code || d.tmdb?.error || "failed"}`]
    ]));

    // Chat / keys
    grid.append(card("Chat & keys", d.chat.seJwt && d.chat.botKey && d.chat.cronKey ? "ok" : "bad", [
      ["SE bot token", d.chat.seJwt ? "set" : "MISSING"],
      ["Picks bot key", d.chat.botKey ? "set" : "MISSING"],
      ["Cron key", d.chat.cronKey ? "set" : "MISSING"]
    ]));

    // Nightly database backup to R2, with a way to run one now
    const bk = d.backup || {};
    const bkBtn = el("button", "db-btn", "Back up now");
    bkBtn.type = "button";
    bkBtn.disabled = !bk.bound;
    bkBtn.addEventListener("click", async () => {
      bkBtn.disabled = true;
      bkBtn.textContent = "Backing up…";
      let r = null;
      try { r = await (await fetch("/api/admin/backup", { method: "POST", credentials: "include" })).json(); } catch { r = null; }
      bkBtn.textContent = r?.ok ? `Done · ${Math.round(r.bytes / 1024)} KB` : `Failed${r?.code ? " · " + r.code : ""}`;
      setTimeout(() => { bkBtn.textContent = "Back up now"; bkBtn.disabled = false; }, 5000);
    });
    const bkState = !bk.bound ? "bad" : bk.ageHours === null ? "warn" : bk.ageHours > 30 ? "bad" : "ok";
    grid.append(card("Database backup", bkState, [
      ["R2 bucket", bk.bound ? "bound" : "NOT BOUND — add BACKUPS"],
      ["Last backup", bk.last ? `${ago(bk.last)}${bk.ageHours !== null ? ` (${bk.ageHours} h)` : ""} · ${bk.by || ""}` : "never"],
      ["Size", bk.bytes ? `${Math.round(bk.bytes / 1024)} KB · ${bk.tables} tables · ${fmt(bk.rows)} rows` : "—"],
      ["Expected", "nightly at 4 AM CT"],
      ["Run", bkBtn]
    ]));

    // Discord ledger mirror, with a way to post a sample
    const testBtn = el("button", "db-btn", "Post test card");
    testBtn.type = "button";
    testBtn.disabled = !d.discord?.configured;
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      testBtn.textContent = "Posting…";
      let r = null;
      try { r = await (await fetch("/api/admin/discord-test", { method: "POST", credentials: "include" })).json(); } catch { r = null; }
      testBtn.textContent = r?.ok ? "Posted ✓" : `Failed${r?.error ? " · " + r.error : ""}`;
      setTimeout(() => { testBtn.textContent = "Post test card"; testBtn.disabled = false; }, 4000);
    });
    const recapBtn = el("button", "db-btn", "Post yesterday's recap");
    recapBtn.type = "button";
    recapBtn.disabled = !d.discord?.configured;
    recapBtn.addEventListener("click", async () => {
      recapBtn.disabled = true;
      recapBtn.textContent = "Posting…";
      let r = null;
      try { r = await (await fetch("/api/admin/recap?force=1", { method: "POST", credentials: "include" })).json(); } catch { r = null; }
      recapBtn.textContent = r?.ok ? `Posted ✓ ${r.day} · ${r.people} players` : `Failed${r?.code ? " · " + r.code : ""}`;
      setTimeout(() => { recapBtn.textContent = "Post yesterday's recap"; recapBtn.disabled = false; }, 5000);
    });
    grid.append(card("Discord ledger", d.discord?.configured ? "ok" : "warn", [
      ["Webhook", d.discord?.configured ? "set" : "not set"],
      ["Sample", testBtn],
      ["Daily recap", "8:50 AM CT, yesterday's picks"],
      ["Now", recapBtn]
    ]));

    // People
    grid.append(card("People", "ok", [
      ["Online now", d.presence ? `${d.presence.people} logged in · ${d.presence.guests} guests · ${d.presence.tabs} tabs` : "—"],
      ["Accounts", `${fmt(d.users.total)} · ${d.users.today} new today`],
      ["Coin flip", d.coin ? `${d.coin.roundsToday} rounds · ${d.coin.betsToday} bets today · ${d.coin.inRoom} in room` : "—"]
    ]));

    panels.health.append(grid);

    // Wallet attention list, newest first and a page at a time.
    if (attention.length) {
      panels.health.append(pagedList("attention", "Wallet operations needing attention",
        attention.map((a) => {
          const row = el("div", `db-attn-row ${a.status.toLowerCase()}`);
          row.append(
            el("b", null, a.status),
            el("span", null, `${a.login || "?"} · ${a.type} · ${a.amount > 0 ? "+" : ""}${a.amount}`),
            el("small", null, `${new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${a.error ? " · " + a.error : ""}`)
          );
          return row;
        })));
    }

    // Counted off the built cards rather than tracked by hand, so a new
    // card is included in the badge without anyone remembering to.
    const problems = grid.querySelectorAll(".db-card.bad, .db-card.warn").length;
    if (problems) {
      buttons.health.append(el("i", null, String(problems)));
      buttons.health.classList.add("warn");
    }
    const overviewHealth = glance.querySelector(".pf-glance-card:last-child b");
    if (overviewHealth) overviewHealth.textContent = problems ? `${problems} to look at` : "All green";

    for (const [key] of TABS) wrap.append(panels[key]);
    // The refresh keeps whichever tab was open; a fresh load reads the hash.
    select(ui.tab || location.hash.replace("#", "") || "overview", false);
    return wrap;
  }

  function notice(strong, text) {
    const box = el("div", "empty");
    box.append(el("strong", null, strong), el("p", null, text));
    return box;
  }

  async function load() {
    const mine = ++token;
    let payload = null;
    try { payload = await (await fetch("/api/admin/dashboard", { credentials: "include" })).json(); } catch { payload = null; }
    if (mine !== token || !root?.isConnected) return;
    if (!payload?.ok) {
      root.replaceChildren(notice(payload?.code === "NOT_ALLOWED" ? "Not for you" : "Couldn't load", payload?.code === "NOT_ALLOWED" ? "This page is for the site owner." : "The dashboard endpoint didn't answer."));
      return;
    }
    root.replaceChildren(page(payload));
  }

  const view = {
    mount(container) {
      root = container;
      root.replaceChildren(notice("Loading…", "Checking everything."));
      load();
      timer = window.setInterval(load, 60000);
    },
    unmount() {
      window.clearInterval(timer);
      timer = 0;
      token++;
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("dashboard", view);
  }
  boot();
})();

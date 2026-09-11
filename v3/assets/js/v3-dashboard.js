/* ============================================================
   EastCoin V3 — the dashboard

     /?view=dashboard   (one person)

   Is everything fine? The cron, the Odds API credits, the wallet,
   the music worker, TMDB, who's around, what's riding. Green,
   amber, red. Refreshes itself every minute.
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
    box.append(table);
    return box;
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

    const windows = el("div", "db-windows");
    [["Today", b.today], ["Last 7 days", b.week], ["Last 14 days", b.fortnight]].forEach(([label, w]) => {
      const cell = el("div", "db-window");
      cell.append(el("span", "db-stat-k", label));
      const line = el("div", "db-window-row");
      line.append(el("span", null, `${fmt(w.bets)} bets`), el("span", null, `${fmt(w.staked)} bet`));
      const net = el("b", w.houseNet >= 0 ? "good" : "bad");
      net.append(zcs(w.houseNet));
      line.append(net);
      cell.append(line);
      windows.append(cell);
    });
    wrap.append(windows);

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
    tables.append(miniTable("By league", ["League", "Bets", "Bet", "House"],
      (b.leagues || []).map((l) => [l.league, fmt(l.bets), fmt(l.staked), zcs(l.houseNet)])));
    tables.append(miniTable("Biggest bettors", ["Who", "Bets", "Bet", "Their net"],
      (b.people || []).map((p) => [p.login, fmt(p.bets), fmt(p.staked), zcs(p.net)])));
    wrap.append(tables);

    return wrap;
  }

  /* The casino's side, read the same way: stake minus payout on decided
     bets. A bet still live counts as neither win nor loss. */
  function casinoBlock(c) {
    const wrap = el("section", "db-book");
    const head = el("div", "db-book-head");
    head.append(el("h2", null, "The casino"), el("span", null, "Coin Flip, Wheel, Horse Race and Higher or Lower"));
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
    tables.append(miniTable("By game", ["Game", "Bets", "Bet", "House", "Hold"],
      (c.games || []).map((g) => [
        g.name,
        fmt(g.bets),
        fmt(g.staked),
        zcs(g.houseNet),
        g.holdPct === null ? "—" : `${g.holdPct}%`
      ])));
    tables.append(miniTable("Biggest single win", ["Game", "Win", "Players", "Live"],
      (c.games || []).map((g) => [g.name, fmt(g.biggestWin), fmt(g.players), g.live ? fmt(g.live) : "—"])));
    wrap.append(tables);
    return wrap;
  }

  function page(d) {
    const wrap = el("section", "dashboard");
    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Dashboard"), el("p", null, `As of ${new Date(d.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes every minute`));
    head.append(copy);
    wrap.append(head);

    // The book first: it's the thing worth opening the page for.
    if (d.book) wrap.append(bookBlock(d.book));
    if (d.casinoBook) wrap.append(casinoBlock(d.casinoBook));

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

    wrap.append(grid);

    // Wallet attention list
    if (attention.length) {
      const sec = el("section", "db-attn");
      sec.append(el("h2", null, "Wallet operations needing attention"));
      const list = el("div", "db-list");
      for (const a of attention) {
        const row = el("div", `db-attn-row ${a.status.toLowerCase()}`);
        row.append(
          el("b", null, a.status),
          el("span", null, `${a.login || "?"} · ${a.type} · ${a.amount > 0 ? "+" : ""}${a.amount}`),
          el("small", null, `${new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${a.error ? " · " + a.error : ""}`)
        );
        list.append(row);
      }
      sec.append(list);
      wrap.append(sec);
    }
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

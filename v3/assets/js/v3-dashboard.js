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

  function page(d) {
    const wrap = el("section", "dashboard");
    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Dashboard"), el("p", null, `As of ${new Date(d.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes every minute`));
    head.append(copy);
    wrap.append(head);

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

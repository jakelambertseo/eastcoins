/* ============================================================
   EastCoin V3 — Casino: The Grind

     /?view=grind

   Work, not a bet. Anyone under the broke line clocks in, clicks one
   button a hundred times, and is paid for the shift — once an hour.
   The page counts clicks the moment they happen so the bar feels
   instant, and hands them to the server in small batches; the server
   is the one that counts, at most about eight a second, so the bar
   settles to its number after every batch.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 20000;
  const FLUSH_MS = 350;
  let root = null;
  let refs = {};
  let data = null;
  let pollTimer = 0;
  let tickTimer = 0;
  let flushTimer = 0;
  let queued = 0;          // clicks made here that the server has not seen
  let inFlight = false;
  let busy = false;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;

  const fmt = K.fmt;
  const cfg = () => data?.config || { clicks: 100, pay: 10, cooldownMinutes: 60, brokeLine: 50, batchMax: 25 };
  const shift = () => data?.me?.shift || null;

  async function load({ balance = false } = {}) {
    if (document.hidden && !balance) return;
    try {
      const payload = await fetch(`/api/casino/grind/state${balance ? "?balance=1" : ""}`, { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "state");
      // A balance read is sticky: a plain poll does not carry one, and
      // eligibility should not flicker back to "unknown" between them.
      const keep = data?.me && data.me.balance !== undefined ? { balance: data.me.balance, eligible: data.me.eligible } : null;
      data = payload;
      if (data.me && data.me.balance === undefined && keep) Object.assign(data.me, keep);
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  async function post(path, body) {
    return fetch(`/api/casino/grind/${path}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then((r) => r.json()).catch(() => null);
  }

  async function clockIn() {
    if (busy) return;
    busy = true; render();
    try {
      const payload = await post("start");
      if (!payload?.ok) {
        toast(payload?.message || "Couldn't clock you in.", true);
        await load({ balance: true });
        return;
      }
      data.me = { ...(data.me || {}), shift: payload.shift };
      if (payload.balance != null) { data.me.balance = payload.balance; data.me.eligible = true; }
      toast("Clocked in. A hundred and it's payday.");
    } finally { busy = false; render(); }
  }

  function press() {
    const s = shift();
    if (!s) {
      // The last clicks of a shift land after payday but before the button
      // has redrawn; they must not try to clock in again.
      const next = data?.me?.nextShiftAt ? Date.parse(data.me.nextShiftAt) : 0;
      if (next > Date.now() || data?.me?.eligible === false) return;
      clockIn();
      return;
    }
    const room = cfg().clicks - s.clicks - queued;
    if (room <= 0) return;
    queued += 1;
    bump();
    render();
    if (queued >= cfg().batchMax) flush();
    else if (!flushTimer) flushTimer = window.setTimeout(flush, FLUSH_MS);
  }

  async function flush() {
    window.clearTimeout(flushTimer);
    flushTimer = 0;
    const s = shift();
    if (!s || !queued || inFlight) return;
    const sent = Math.min(queued, cfg().batchMax);
    inFlight = true;
    let retryIn = FLUSH_MS;
    try {
      const payload = await post("work", { id: s.id, clicks: sent });
      if (!data) return;
      // A dropped connection loses nothing: the clicks stay queued and go
      // again in a couple of seconds.
      if (!payload) { retryIn = 2000; return; }
      /* Only what the server CREDITED leaves the queue. It counts about
         eight a second, so a fast clicker gets ahead of it; the rest are
         handed in as the time comes, and the bar never runs backwards. */
      queued = Math.max(0, queued - Number(payload.credited || 0));
      if (payload.shift) data.me.shift = payload.shift.status === "WORKING" ? payload.shift : null;
      const left = data.me.shift ? cfg().clicks - data.me.shift.clicks : 0;
      queued = Math.min(queued, Math.max(0, left));
      if (payload.throttled && !payload.credited) retryIn = 400;
      if (payload.paid) {
        queued = 0;
        data.me.shift = null;
        if (payload.nextShiftAt) data.me.nextShiftAt = payload.nextShiftAt;
        render();
        if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
        pop({ won: true, big: false, amount: payload.payout, headline: "Payday", detail: `A hundred clicks, ${fmt(payload.payout)} ZC. Next shift in ${cfg().cooldownMinutes} minutes.` });
        window.ECV3?.refreshSession?.();
        await load({ balance: true });
      } else if (payload.code === "PAYOUT_FAILED") {
        queued = 0;
        data.me.shift = null;
        if (payload.nextShiftAt) data.me.nextShiftAt = payload.nextShiftAt;
        toast(payload.message, true);
      }
    } finally {
      inFlight = false;
      if (data) {
        render();
        if (queued && shift()) flushTimer = window.setTimeout(flush, retryIn);
      }
    }
  }

  /* The button gives back something for every press: a squash and a
     "+1" that floats off. Floaters are capped so a fast clicker cannot
     pile hundreds of nodes into the page. */
  function bump() {
    const b = refs.btn;
    if (!b) return;
    b.classList.remove("hit");
    void b.offsetWidth;
    b.classList.add("hit");
    if (refs.floaters.childElementCount > 12) return;
    const f = K.el("span", "grd-float", "+1");
    f.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 90)}px`);
    f.addEventListener("animationend", () => f.remove());
    refs.floaters.append(f);
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = K.el("section", "coinflip casino-grind");

    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    copy.append(K.el("h1", null, "The Grind"),
      K.el("p", null, `Broke? Clock in. A hundred clicks is a shift, a shift pays ${cfg().pay} ZC, and you get one an hour. It's for anyone under ${cfg().brokeLine} — a way back to the tables, not a job.`));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage grd-stage");
    refs.phase = K.el("div", "cf-phase", "");

    const shop = K.el("div", "grd-shop");
    const btnWrap = K.el("div", "grd-btnwrap");
    refs.btn = K.el("button", "grd-btn");
    refs.btn.type = "button";
    refs.btnLabel = K.el("b", null, "Clock in");
    refs.btnSub = K.el("small", null, "");
    refs.btn.append(refs.btnLabel, refs.btnSub);
    refs.btn.addEventListener("click", press);
    refs.floaters = K.el("div", "grd-floaters");
    refs.floaters.setAttribute("aria-hidden", "true");
    btnWrap.append(refs.btn, refs.floaters);

    const meter = K.el("div", "grd-meter");
    refs.bar = K.el("div", "grd-bar");
    refs.bar.setAttribute("role", "progressbar");
    refs.bar.setAttribute("aria-valuemin", "0");
    refs.bar.setAttribute("aria-valuemax", String(cfg().clicks));
    refs.fill = K.el("i", "grd-fill");
    refs.bar.append(refs.fill);
    const meterLine = K.el("div", "grd-meterline");
    refs.count = K.el("b", "nums", "0");
    refs.of = K.el("span", null, ` / ${cfg().clicks}`);
    const countBox = K.el("span");
    countBox.append(refs.count, refs.of);
    refs.pay = K.el("span", "grd-pay");
    meterLine.append(countBox, refs.pay);
    meter.append(refs.bar, meterLine);

    shop.append(btnWrap, meter);
    refs.note = K.el("p", "cf-note grd-note", "");
    stage.append(refs.phase, shop, refs.note);
    grid.append(stage);

    const col = K.el("div", "cf-side-col");

    const you = K.el("section", "cf-card");
    const yh = K.el("h2", null, "Your shifts");
    refs.youNote = K.el("small");
    yh.append(refs.youNote);
    refs.youList = K.el("div", "hl-stats");
    you.append(yh, refs.youList);

    const rules = K.el("section", "cf-card");
    rules.append(K.el("h2", null, "How it works"));
    const list = K.el("ul", "grd-rules");
    for (const line of [
      `Under ${cfg().brokeLine} ZC when you clock in.`,
      `${cfg().clicks} clicks is a shift; a shift pays ${cfg().pay} ZC.`,
      `One shift an hour, counted from when your last one finished.`,
      `The foreman counts about eight clicks a second. Faster doesn't finish sooner.`
    ]) list.append(K.el("li", null, line));
    rules.append(list);

    const room = K.el("section", "cf-card");
    const rh = K.el("h2", null, "On the floor");
    refs.roomCount = K.el("small");
    rh.append(refs.roomCount);
    refs.roomList = K.el("div", "cf-room");
    room.append(rh, refs.roomList);

    col.append(you, rules, room);
    grid.append(col);
    page.append(grid);

    const ledger = K.el("section", "cf-card cf-ledger");
    const lgh = K.el("h2", null, "Recent paydays");
    refs.ledgerNote = K.el("small");
    lgh.append(refs.ledgerNote);
    refs.ledgerList = K.el("div", "cf-list paged");
    ledger.append(lgh, refs.ledgerList);
    page.append(ledger);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function mmss(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(t / 60);
    return `${m}:${String(t % 60).padStart(2, "0")}`;
  }

  function render() {
    if (!refs.btn) return;
    const c = cfg();
    const me = data?.me || null;
    const s = shift();
    const nextAt = me?.nextShiftAt ? Date.parse(me.nextShiftAt) : 0;
    const cooling = !s && nextAt > Date.now();
    const notBroke = !s && me?.eligible === false;

    refs.status.textContent = data ? (data.room?.length ? `${data.room.length} on the floor` : "Quiet shift") : "Connecting…";

    const done = s ? Math.min(c.clicks, s.clicks + queued) : cooling ? c.clicks : 0;
    refs.count.textContent = String(done);
    refs.fill.style.width = `${(100 * done) / c.clicks}%`;
    refs.bar.setAttribute("aria-valuenow", String(done));
    K.withCoins(refs.pay, `Pays [[${c.pay}]]`);

    refs.btn.classList.toggle("working", Boolean(s));
    refs.btn.classList.toggle("resting", cooling || notBroke);
    if (!data?.config?.canWork) {
      refs.btn.disabled = true;
      refs.btnLabel.textContent = "Closed";
      refs.btnSub.textContent = "";
      refs.phase.textContent = "Not taking shifts right now";
      refs.phase.className = "cf-phase bad";
      refs.note.textContent = "The wallet isn't connected, so there's nobody to pay you. Check back soon.";
    } else if (s) {
      refs.btn.disabled = false;
      refs.btnLabel.textContent = "Grind";
      refs.btnSub.textContent = queued > 12 ? "counting…" : `${c.clicks - done} to go`;
      refs.btn.setAttribute("aria-label", `Grind — ${done} of ${c.clicks}`);
      refs.phase.textContent = "On shift";
      refs.phase.className = "cf-phase open";
      refs.note.textContent = "Keep clicking. Leave and come back — the shift waits for you.";
    } else if (cooling) {
      refs.btn.disabled = true;
      refs.btnLabel.textContent = mmss(nextAt - Date.now());
      refs.btnSub.textContent = "until your next shift";
      refs.btn.setAttribute("aria-label", "Resting until your next shift");
      refs.phase.textContent = "Shift done";
      refs.phase.className = "cf-phase";
      refs.note.textContent = "One shift an hour. Go spend it.";
    } else if (notBroke) {
      refs.btn.disabled = true;
      refs.btnLabel.textContent = "Not today";
      refs.btnSub.textContent = `for under ${c.brokeLine} ZC`;
      refs.btn.setAttribute("aria-label", "Not eligible");
      refs.phase.textContent = "You're doing fine";
      refs.phase.className = "cf-phase";
      refs.note.textContent = `You've got ${fmt(me.balance)} ZC. The Grind is for anyone under ${c.brokeLine} — come back if the tables go cold.`;
    } else {
      refs.btn.disabled = busy;
      refs.btnLabel.textContent = "Clock in";
      refs.btnSub.textContent = `${c.clicks} clicks · ${c.pay} ZC`;
      refs.btn.setAttribute("aria-label", "Clock in for a shift");
      refs.phase.textContent = "Ready when you are";
      refs.phase.className = "cf-phase open";
      refs.note.textContent = `Checked when you clock in: you need to be under ${c.brokeLine} ZC.`;
    }

    // Your shifts
    refs.youList.replaceChildren();
    const row = (label, value) => {
      const r = K.el("div", "hl-stat");
      r.append(K.el("span", null, label));
      const v = K.el("strong", "nums");
      if (value instanceof Node) v.append(value); else v.textContent = value;
      r.append(v);
      return r;
    };
    if (me) {
      refs.youNote.textContent = me.shifts ? `${me.shifts} worked` : "";
      refs.youList.append(
        row("Shifts", String(me.shifts || 0)),
        row("Earned", K.zc(me.earned || 0)),
        row("Next shift", s ? "on one now" : cooling ? mmss(nextAt - Date.now()) : "now")
      );
    }

    // On the floor
    const room = data?.room || [];
    refs.roomCount.textContent = room.length ? String(room.length) : "";
    refs.roomList.replaceChildren();
    if (!room.length) refs.roomList.append(K.el("p", "cf-empty", "Nobody on the floor right now."));
    for (const u of room) {
      const chip = K.el("a", "cf-chipuser ulink");
      chip.href = `/u/${encodeURIComponent(u.login)}`;
      chip.append(K.avatar(u, "cf-av small"), document.createTextNode(u.displayName));
      refs.roomList.append(chip);
    }

    // Recent paydays
    const recent = data?.recent || [];
    refs.ledgerList.replaceChildren();
    refs.ledgerNote.textContent = recent.length ? `${recent.length} recent` : "";
    if (!recent.length) refs.ledgerList.append(K.el("p", "cf-empty", "Nobody has worked a shift yet."));
    const pg = K.pageOf(recent, ledgerPage, 10);
    for (const e of pg.slice) {
      const r = K.el("div", `cf-row won${me && e.user.id === me.id ? " me" : ""}`);
      r.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      who.append(K.el("small", null, `${c.clicks} clicks · ${new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`));
      r.append(who);
      const res = K.el("span", "cf-res nums up");
      res.append(K.el("span", "cf-tag win", "PAID"), K.zc(e.payout, { sign: true }));
      r.append(res);
      refs.ledgerList.append(r);
    }
    if (recent.length) refs.ledgerList.append(K.pager(pg, (n) => { ledgerPage = n; render(); }, "shifts"));
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "The Grind — EastCoin Casino";
      window.ECPresence?.beat("grind");
      build();
      load({ balance: true });
      pollTimer = window.setInterval(() => { if (!inFlight && !queued) load(); }, POLL_MS);
      // The cooldown clock counts down on the page between polls.
      tickTimer = window.setInterval(() => {
        if (data?.me?.nextShiftAt && !shift()) {
          const left = Date.parse(data.me.nextShiftAt) - Date.now();
          render();
          if (left <= 0) { data.me.nextShiftAt = null; load({ balance: true }); }
        }
      }, 1000);
    },
    unmount() {
      window.clearInterval(pollTimer);
      window.clearInterval(tickTimer);
      window.clearTimeout(flushTimer);
      pollTimer = 0; tickTimer = 0; flushTimer = 0;
      // Clicks still queued are sent on the way out, not dropped.
      if (queued && shift()) flush();
      data = null; refs = {}; queued = 0;
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("grind", view);
  }
  boot();
})();

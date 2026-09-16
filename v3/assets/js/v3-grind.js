/* ============================================================
   EastCoin V3 — Casino: The Grind

     /?view=grind

   Work, not a bet. Anyone under the broke line can clock in to either
   job, once an hour each:

     Clock in        press one button a hundred times — 10 ZC
     Sort the Chips  put 75 chips in the tray for their suit — 15 ZC

   The server does the counting for both. Clicks are counted here the
   moment they happen so the bar feels instant and handed in in small
   batches; only what the server CREDITS leaves the queue, so the bar
   never runs backwards. Chips go one at a time: the server grades each
   and tells the page the next one, and a wrong tray locks the trays for
   a second.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 20000;
  const FLUSH_MS = 350;
  const SUITS = ["♠", "♥", "♦", "♣"];
  const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
  const DEFAULT_JOBS = {
    clicks: { key: "clicks", name: "Clock in", units: 100, unitName: "clicks", pay: 10, msPerUnit: 120, batchMax: 25 },
    sort: { key: "sort", name: "Sort the Chips", units: 75, unitName: "chips", pay: 15, msPerUnit: 300, penaltyMs: 1000 }
  };

  let root = null;
  let refs = {};
  let data = null;
  let job = null;           // the job on screen
  let pollTimer = 0;
  let tickTimer = 0;
  let flushTimer = 0;
  let queued = 0;           // clicks made here that the server has not credited
  let inFlight = false;
  let busy = false;
  let sorting = false;      // a chip is on its way to the server
  let lastSortAt = 0;
  let lockUntil = 0;        // a wrong tray locks the trays until here
  let lockTimer = 0;
  let onKey = null;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;

  const fmt = K.fmt;
  const cfg = () => data?.config || { brokeLine: 50, cooldownMinutes: 60, jobs: DEFAULT_JOBS };
  const jobCfg = (k) => cfg().jobs?.[k] || DEFAULT_JOBS[k];
  const jobState = (k) => data?.me?.jobs?.[k] || { shift: null, nextShiftAt: null };
  const shiftOf = (k) => jobState(k).shift || null;
  const nextAtOf = (k) => (jobState(k).nextShiftAt ? Date.parse(jobState(k).nextShiftAt) : 0);
  const coolingOf = (k) => !shiftOf(k) && nextAtOf(k) > Date.now();

  function setJobState(k, patch) {
    if (!data?.me) return;
    data.me.jobs = data.me.jobs || {};
    data.me.jobs[k] = { ...jobState(k), ...patch };
  }

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
      // On arrival, open the job that has a shift running.
      if (!job) job = shiftOf("sort") && !shiftOf("clicks") ? "sort" : "clicks";
      const s = shiftOf("sort");
      if (s?.waitMs) holdTrays(s.waitMs);
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

  async function clockIn(k) {
    if (busy) return;
    busy = true; render();
    try {
      const payload = await post("start", { job: k });
      if (!data) return;
      if (!payload?.ok) {
        toast(payload?.message || "Couldn't clock you in.", true);
        await load({ balance: true });
        return;
      }
      setJobState(k, { shift: payload.shift });
      if (payload.balance != null) { data.me.balance = payload.balance; data.me.eligible = true; }
      lastSortAt = Date.now();
      toast(k === "sort" ? `Belt's running. ${jobCfg("sort").units} chips and it's payday.` : "Clocked in. A hundred and it's payday.");
    } finally { busy = false; if (data) render(); }
  }

  /** The job's main button when no shift is running: clock in, or nothing while it cannot. */
  function startPressed(k) {
    if (shiftOf(k)) return;
    // The last clicks of a shift land after payday but before the button
    // has redrawn; they must not try to clock in again.
    if (coolingOf(k) || data?.me?.eligible === false) return;
    clockIn(k);
  }

  /* ---------------------------------------------------------- clocking in */

  function press() {
    const s = shiftOf("clicks");
    if (!s) { startPressed("clicks"); return; }
    const room = jobCfg("clicks").units - s.clicks - queued;
    if (room <= 0) return;
    queued += 1;
    bump();
    render();
    if (queued >= jobCfg("clicks").batchMax) flush();
    else if (!flushTimer) flushTimer = window.setTimeout(flush, FLUSH_MS);
  }

  async function flush() {
    window.clearTimeout(flushTimer);
    flushTimer = 0;
    const s = shiftOf("clicks");
    if (!s || !queued || inFlight) return;
    const sent = Math.min(queued, jobCfg("clicks").batchMax);
    inFlight = true;
    let retryIn = FLUSH_MS;
    try {
      const payload = await post("work", { id: s.id, clicks: sent });
      if (!data) return;
      // A dropped connection loses nothing: the clicks stay queued.
      if (!payload) { retryIn = 2000; return; }
      queued = Math.max(0, queued - Number(payload.credited || 0));
      if (payload.shift) setJobState("clicks", { shift: payload.shift.status === "WORKING" ? payload.shift : null });
      const left = shiftOf("clicks") ? jobCfg("clicks").units - shiftOf("clicks").clicks : 0;
      queued = Math.min(queued, Math.max(0, left));
      if (payload.throttled && !payload.credited) retryIn = 400;
      if (payload.paid) {
        queued = 0;
        setJobState("clicks", { shift: null, nextShiftAt: payload.nextShiftAt || null });
        render();
        if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
        pop({ won: true, big: false, amount: payload.payout, headline: "Payday", detail: `A hundred clicks, ${fmt(payload.payout)} ZC. Next shift in ${cfg().cooldownMinutes} minutes.` });
        window.ECV3?.refreshSession?.();
        await load({ balance: true });
      } else if (payload.code === "PAYOUT_FAILED") {
        queued = 0;
        setJobState("clicks", { shift: null, nextShiftAt: payload.nextShiftAt || null });
        toast(payload.message, true);
      }
    } finally {
      inFlight = false;
      if (data) {
        render();
        if (queued && shiftOf("clicks")) flushTimer = window.setTimeout(flush, retryIn);
      }
    }
  }

  /* The button gives back something for every press: a squash and a
     "+1" that floats off, capped so a fast clicker cannot pile nodes up. */
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

  /* ---------------------------------------------------------- sorting */

  function holdTrays(ms) {
    lockUntil = Date.now() + ms;
    // Restart the drain so every recount shows its whole second.
    if (refs.lockBar) {
      refs.lockBar.style.animation = "none";
      void refs.lockBar.offsetWidth;
      refs.lockBar.style.animation = `grd-drain ${ms}ms linear forwards`;
    }
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => { lockUntil = 0; if (data) render(); }, ms + 20);
  }

  async function sortInto(suit) {
    const s = shiftOf("sort");
    if (!s || sorting || !data) return;
    const now = Date.now();
    if (now < lockUntil) return;
    // The server takes one chip per msPerUnit; so does the page, so a
    // quick hand never sees a chip refused.
    if (now - lastSortAt < jobCfg("sort").msPerUnit) return;
    sorting = true;
    lastSortAt = now;
    const tray = refs.trays?.[suit];
    try {
      const payload = await post("sort", { id: s.id, suit });
      if (!data) return;
      if (!payload) { toast("Lost the connection — sort that one again.", true); return; }
      if (payload.shift) setJobState("sort", { shift: payload.shift.status === "WORKING" ? payload.shift : null });
      if (payload.result === "sorted") {
        flash(tray, "ok");
        refs.chip?.classList.remove("in");
        void refs.chip?.offsetWidth;
        refs.chip?.classList.add("in");
        if (payload.paid) {
          setJobState("sort", { shift: null, nextShiftAt: payload.nextShiftAt || null });
          render();
          if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
          pop({ won: true, big: false, amount: payload.payout, headline: "Payday", detail: `${jobCfg("sort").units} chips sorted, ${fmt(payload.payout)} ZC. Next shift in ${cfg().cooldownMinutes} minutes.` });
          window.ECV3?.refreshSession?.();
          await load({ balance: true });
        }
      } else if (payload.result === "miss") {
        flash(tray, "bad");
        holdTrays(payload.shift?.waitMs || jobCfg("sort").penaltyMs || 1000);
      } else if (payload.result === "wait") {
        holdTrays(payload.shift?.waitMs || 300);
      } else if (payload.result === "over" || payload.result === "stale") {
        await load();
      } else if (payload.code === "PAYOUT_FAILED") {
        setJobState("sort", { shift: null, nextShiftAt: payload.nextShiftAt || null });
        toast(payload.message, true);
      }
    } finally {
      sorting = false;
      if (data) render();
    }
  }

  function flash(node, kind) {
    if (!node) return;
    node.classList.remove("ok", "bad");
    void node.offsetWidth;
    node.classList.add(kind);
  }

  /* ---------------------------------------------------------- page */

  function build() {
    root.replaceChildren();
    refs = {};
    const page = K.el("section", "coinflip casino-grind");

    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    // The sign on the door, loud on purpose.
    const poor = K.el("div", "grd-poor");
    const coin = document.createElement("img");
    coin.className = "zcoin-mark";
    coin.src = "/v3/assets/img/zcoin.webp";
    coin.alt = "ZCoin";
    coin.width = 18;
    coin.height = 18;
    const line = K.el("span", "grd-poor-line");
    line.append(document.createTextNode(`(<${cfg().brokeLine} `), coin, document.createTextNode(")"));
    poor.append(K.el("b", null, "Only for poors!"), line);
    copy.append(K.el("h1", null, "The Grind"), poor,
      K.el("p", null, `Broke? Pick up a shift. Clock in for ${DEFAULT_JOBS.clicks.pay} ZC, or sort chips for ${DEFAULT_JOBS.sort.pay} if you can stand it. One shift of each an hour, for anyone under ${cfg().brokeLine} — a way back to the tables, not a job.`));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage grd-stage");
    refs.phase = K.el("div", "cf-phase", "");

    // The two jobs.
    const jobs = K.el("div", "grd-jobs");
    jobs.setAttribute("role", "tablist");
    refs.jobBtns = {};
    for (const k of ["clicks", "sort"]) {
      const b = K.el("button", "grd-job");
      b.type = "button";
      b.setAttribute("role", "tab");
      const name = K.el("b", null, DEFAULT_JOBS[k].name);
      const pay = K.el("span", "grd-job-pay");
      const sub = K.el("small", null, "");
      b.append(name, pay, sub);
      b.addEventListener("click", () => { job = k; render(); });
      refs.jobBtns[k] = { b, pay, sub };
      jobs.append(b);
    }

    // Clock in: one big button.
    const clickShop = K.el("div", "grd-shop");
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
    refs.clickMeter = meter();
    clickShop.append(btnWrap, refs.clickMeter.node);
    refs.clickShop = clickShop;

    // Sort the Chips: a belt with one chip on it, and four trays.
    const sortShop = K.el("div", "grd-shop grd-sortshop");
    refs.sortBtn = K.el("button", "grd-btn");
    refs.sortBtn.type = "button";
    refs.sortBtnLabel = K.el("b", null, "Start");
    refs.sortBtnSub = K.el("small", null, "");
    refs.sortBtn.append(refs.sortBtnLabel, refs.sortBtnSub);
    refs.sortBtn.addEventListener("click", () => startPressed("sort"));
    const belt = K.el("div", "grd-belt");
    refs.chip = K.el("div", "grd-chip in");
    refs.chipSym = K.el("span", null, "");
    refs.chip.append(refs.chipSym);
    refs.chip.setAttribute("aria-live", "polite");
    belt.append(refs.chip);
    refs.belt = belt;
    const trays = K.el("div", "grd-trays");
    refs.trays = SUITS.map((sym, i) => {
      const t = K.el("button", `grd-tray t${i}`);
      t.type = "button";
      t.setAttribute("aria-label", `${SUIT_NAMES[i]} tray (key ${i + 1})`);
      t.append(K.el("b", null, sym), K.el("small", null, String(i + 1)));
      t.addEventListener("click", () => sortInto(i));
      trays.append(t);
      return t;
    });
    refs.trayRow = trays;
    refs.lock = K.el("div", "grd-lock");
    refs.lockBar = K.el("i");
    refs.lock.append(K.el("span", null, "Wrong tray — recount"), refs.lockBar);
    refs.sortMeter = meter();
    sortShop.append(refs.sortBtn, belt, trays, refs.lock, refs.sortMeter.node);
    refs.sortShop = sortShop;

    refs.note = K.el("p", "cf-note grd-note", "");
    stage.append(refs.phase, jobs, clickShop, sortShop, refs.note);
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
      `Under ${cfg().brokeLine} ZC when you clock in, for either job.`,
      `Clock in: ${DEFAULT_JOBS.clicks.units} clicks pays ${DEFAULT_JOBS.clicks.pay} ZC. The foreman counts about eight a second.`,
      `Sort the Chips: ${DEFAULT_JOBS.sort.units} chips into their suit's tray pays ${DEFAULT_JOBS.sort.pay} ZC. A wrong tray costs a second. Keys 1–4 work too.`,
      `One shift of each job an hour, counted from when that shift finished.`
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

  function meter() {
    const node = K.el("div", "grd-meter");
    const bar = K.el("div", "grd-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    const fill = K.el("i", "grd-fill");
    bar.append(fill);
    const line = K.el("div", "grd-meterline");
    const count = K.el("b", "nums", "0");
    const of = K.el("span", null, "");
    const box = K.el("span");
    box.append(count, of);
    const pay = K.el("span", "grd-pay");
    line.append(box, pay);
    node.append(bar, line);
    return { node, bar, fill, count, of, pay };
  }

  function paintMeter(m, done, units, pay) {
    m.count.textContent = String(done);
    m.of.textContent = ` / ${units}`;
    m.fill.style.width = `${(100 * done) / units}%`;
    m.bar.setAttribute("aria-valuemax", String(units));
    m.bar.setAttribute("aria-valuenow", String(done));
    K.withCoins(m.pay, `Pays [[${pay}]]`);
  }

  function mmss(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  }

  /** What a job's big button and the stage copy say when no shift is running. */
  function idleFace(k) {
    const c = cfg();
    const j = jobCfg(k);
    const me = data?.me || null;
    if (!data?.config?.canWork) return { label: "Closed", sub: "", disabled: true, resting: true, phase: "Not taking shifts right now", phaseCls: "bad", note: "The wallet isn't connected, so there's nobody to pay you. Check back soon." };
    if (coolingOf(k)) return { label: mmss(nextAtOf(k) - Date.now()), sub: "until your next shift", disabled: true, resting: true, phase: "Shift done", phaseCls: "", note: `One ${j.name} shift an hour.${coolingOf(k === "clicks" ? "sort" : "clicks") ? " Go spend it." : ` The other job's still open.`}` };
    if (me?.eligible === false) return { label: "Not today", sub: `for under ${c.brokeLine} ZC`, disabled: true, resting: true, phase: "You're doing fine", phaseCls: "", note: `You've got ${fmt(me.balance)} ZC. The Grind is for anyone under ${c.brokeLine} — come back if the tables go cold.` };
    return { label: k === "sort" ? "Start sorting" : "Clock in", sub: `${j.units} ${j.unitName} · ${j.pay} ZC`, disabled: busy, resting: false, phase: "Ready when you are", phaseCls: "open", note: `Checked when you clock in: you need to be under ${c.brokeLine} ZC.` };
  }

  function render() {
    if (!refs.btn) return;
    const me = data?.me || null;
    if (!job) job = "clicks";

    refs.status.textContent = data ? (data.room?.length ? `${data.room.length} on the floor` : "Quiet shift") : "Connecting…";

    // Job tabs
    for (const k of ["clicks", "sort"]) {
      const t = refs.jobBtns[k];
      const j = jobCfg(k);
      const s = shiftOf(k);
      t.b.classList.toggle("on", job === k);
      t.b.setAttribute("aria-selected", String(job === k));
      K.withCoins(t.pay, `[[${j.pay}]]`);
      t.sub.textContent = s ? `On shift · ${Math.min(j.units, s.done + (k === "clicks" ? queued : 0))}/${j.units}` : coolingOf(k) ? `Next in ${mmss(nextAtOf(k) - Date.now())}` : me?.eligible === false ? "Under 50 ZC only" : "Open";
      t.b.classList.toggle("resting", coolingOf(k));
    }

    refs.clickShop.hidden = job !== "clicks";
    refs.sortShop.hidden = job !== "sort";

    if (job === "clicks") {
      const j = jobCfg("clicks");
      const s = shiftOf("clicks");
      const done = s ? Math.min(j.units, s.clicks + queued) : coolingOf("clicks") ? j.units : 0;
      paintMeter(refs.clickMeter, done, j.units, j.pay);
      refs.btn.classList.toggle("working", Boolean(s));
      if (s) {
        refs.btn.disabled = false;
        refs.btn.classList.remove("resting");
        refs.btnLabel.textContent = "Grind";
        refs.btnSub.textContent = queued > 12 ? "counting…" : `${j.units - done} to go`;
        refs.btn.setAttribute("aria-label", `Grind — ${done} of ${j.units}`);
        refs.phase.textContent = "On shift";
        refs.phase.className = "cf-phase open";
        refs.note.textContent = "Keep clicking. Leave and come back — the shift waits for you.";
      } else {
        const f = idleFace("clicks");
        refs.btn.disabled = f.disabled;
        refs.btn.classList.toggle("resting", f.resting);
        refs.btnLabel.textContent = f.label;
        refs.btnSub.textContent = f.sub;
        refs.btn.setAttribute("aria-label", f.label);
        refs.phase.textContent = f.phase;
        refs.phase.className = `cf-phase ${f.phaseCls}`.trim();
        refs.note.textContent = f.note;
      }
    } else {
      const j = jobCfg("sort");
      const s = shiftOf("sort");
      const locked = Date.now() < lockUntil;
      paintMeter(refs.sortMeter, s ? s.done : coolingOf("sort") ? j.units : 0, j.units, j.pay);
      refs.sortBtn.hidden = Boolean(s);
      refs.belt.hidden = !s;
      refs.trayRow.hidden = !s;
      refs.lock.hidden = !(s && locked);
      if (s) {
        const chip = Number.isInteger(s.chip) ? s.chip : null;
        refs.chip.className = `grd-chip${chip === null ? "" : ` c${chip}`}${refs.chip.classList.contains("in") ? " in" : ""}`;
        refs.chipSym.textContent = chip === null ? "·" : SUITS[chip];
        refs.chip.setAttribute("aria-label", chip === null ? "No chip" : `${SUIT_NAMES[chip]} chip`);
        refs.trayRow.classList.toggle("jam", locked);
        for (const t of refs.trays) t.disabled = locked || sorting;
        refs.phase.textContent = locked ? "Recounting" : "On shift";
        refs.phase.className = `cf-phase ${locked ? "bad" : "open"}`;
        refs.note.textContent = `${j.units - s.done} to go${s.misses ? ` · ${s.misses} in the wrong tray` : ""}. Keys 1–4 sort too.`;
      } else {
        const f = idleFace("sort");
        refs.sortBtn.disabled = f.disabled;
        refs.sortBtn.classList.toggle("resting", f.resting);
        refs.sortBtnLabel.textContent = f.label;
        refs.sortBtnSub.textContent = f.sub;
        refs.sortBtn.setAttribute("aria-label", f.label);
        refs.phase.textContent = f.phase;
        refs.phase.className = `cf-phase ${f.phaseCls}`.trim();
        refs.note.textContent = f.note;
      }
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
      const when = (k) => (shiftOf(k) ? "on one now" : coolingOf(k) ? mmss(nextAtOf(k) - Date.now()) : "now");
      refs.youNote.textContent = me.shifts ? `${me.shifts} worked` : "";
      refs.youList.append(
        row("Shifts", String(me.shifts || 0)),
        row("Earned", K.zc(me.earned || 0)),
        row("Clock in", when("clicks")),
        row("Sorting", when("sort"))
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
      const j = jobCfg(e.job || "clicks");
      const r = K.el("div", `cf-row won${me && e.user.id === me.id ? " me" : ""}`);
      r.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      who.append(K.el("small", null, `${j.units} ${j.unitName === "chips" ? "chips sorted" : j.unitName} · ${new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`));
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
      job = null;
      build();
      load({ balance: true });
      pollTimer = window.setInterval(() => { if (!inFlight && !queued && !sorting) load(); }, POLL_MS);
      // Countdowns tick on the page between polls; a clock that runs out reloads.
      tickTimer = window.setInterval(() => {
        if (!data?.me) return;
        let expired = false;
        for (const k of ["clicks", "sort"]) {
          const at = nextAtOf(k);
          if (at && !shiftOf(k) && at <= Date.now()) { setJobState(k, { nextShiftAt: null }); expired = true; }
        }
        if (coolingOf("clicks") || coolingOf("sort")) render();
        if (expired) load({ balance: true });
      }, 1000);
      // Keys 1-4 sort, when the belt is on screen. Holding a key does not repeat.
      onKey = (e) => {
        if (job !== "sort" || !shiftOf("sort") || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
        const n = "1234".indexOf(e.key);
        if (n < 0) return;
        e.preventDefault();
        sortInto(n);
      };
      document.addEventListener("keydown", onKey);
    },
    unmount() {
      window.clearInterval(pollTimer);
      window.clearInterval(tickTimer);
      window.clearTimeout(flushTimer);
      window.clearTimeout(lockTimer);
      pollTimer = 0; tickTimer = 0; flushTimer = 0; lockTimer = 0;
      if (onKey) document.removeEventListener("keydown", onKey);
      onKey = null;
      // Clicks still queued are sent on the way out, not dropped.
      if (queued && shiftOf("clicks")) flush();
      data = null; refs = {}; queued = 0; lockUntil = 0; sorting = false;
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("grind", view);
  }
  boot();
})();

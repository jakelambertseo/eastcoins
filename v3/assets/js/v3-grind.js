/* ============================================================
   EastCoin V3 — Casino: The Grind

     /?view=grind

   Work, not a bet. Anyone under the broke line can clock in and beg:

     Beg for ZCoins  type "I am broke as shit and need Zcoins" — 1 ZC a
                     line, up to 15 ZC in any rolling hour

   (2026-10-05) It replaced both earlier jobs, Clock in (100 clicks) and
   Sort the Chips, which were deleted. The server grades every line and
   takes at most one per msPerUnit, so the page checks a line before it
   sends it (a typo never costs a request), sends it the moment it
   matches, and holds a fast typist's next line until the server will
   take it. No pasting: the paste and drop events are refused, and any
   input that lands more than a couple of characters at once (a paste
   by any route, autofill, an extension) empties the box. The server's
   clock and cap are what actually hold.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 20000;
  const DEFAULT_JOB = { key: "type", name: "Beg for ZCoins", units: 15, unitName: "lines", pay: 1, hourCap: 15, msPerUnit: 2500, phrase: "I am broke as shit and need Zcoins" };
  // Paydays from the jobs that were retired still show in the list.
  const OLD_JOBS = { clicks: "100 clicks", sort: "chips sorted" };

  let root = null;
  let refs = {};
  let data = null;
  let pollTimer = 0;
  let tickTimer = 0;
  let holdTimer = 0;
  let busy = false;
  let sending = false;
  let lastSentAt = 0;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;
  let prevLen = 0;          // the box's length before the last input, to catch text that arrives all at once

  const fmt = K.fmt;
  const cfg = () => data?.config || { brokeLine: 50, hourCap: 15, payPerLine: 1, jobs: { type: DEFAULT_JOB } };
  const cap = () => Number(cfg().hourCap) || DEFAULT_JOB.hourCap;
  const hour = () => data?.me?.hour || { earned: 0, cap: cap(), left: cap() };
  const job = () => cfg().jobs?.type || DEFAULT_JOB;
  const state = () => data?.me?.jobs?.type || { shift: null, nextShiftAt: null };
  const shift = () => state().shift || null;
  const nextAt = () => (state().nextShiftAt ? Date.parse(state().nextShiftAt) : 0);
  const cooling = () => !shift() && nextAt() > Date.now();

  // The same rule the server uses (typedRight in _grind.js): every word, case and spacing aside.
  const norm = (t) => String(t || "").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").trim();
  const isRight = (t) => norm(t) === norm(job().phrase);

  function setState(patch) {
    if (!data?.me) return;
    data.me.jobs = data.me.jobs || {};
    data.me.jobs.type = { ...state(), ...patch };
  }

  async function load({ balance = false } = {}) {
    if (document.hidden && !balance) return;
    try {
      const payload = await fetch(`/api/casino/grind/state${balance ? "?balance=1" : ""}`, { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "state");
      // A balance read is sticky: a plain poll does not carry one.
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
    if (busy || shift() || cooling() || data?.me?.eligible === false) return;
    busy = true; render();
    try {
      const payload = await post("start", { job: "type" });
      if (!data) return;
      if (!payload?.ok) {
        toast(payload?.message || "Couldn't clock you in.", true);
        await load({ balance: true });
        return;
      }
      setState({ shift: payload.shift });
      if (payload.balance != null) { data.me.balance = payload.balance; data.me.eligible = true; }
      lastSentAt = Date.now();
      toast(`Start begging. Every line is ${job().pay} ZC, up to ${cap()} this hour.`);
    } finally {
      busy = false;
      if (data) { render(); refs.input?.focus(); }
    }
  }

  /* ---------------------------------------------------------- typing */

  function onType() {
    // Typed, not pasted: a real keystroke adds one character (two for some
    // keyboards' accents). Anything bigger arriving at once is thrown out.
    const len = refs.input.value.length;
    if (len - prevLen > 2) {
      refs.input.value = "";
      prevLen = 0;
      flash(refs.box, "bad");
      toast("No pasting. Beg properly.", true);
      paintLine();
      return;
    }
    prevLen = len;
    paintLine();
    if (isRight(refs.input.value)) send();
  }

  /** Sends the line in the box, now or as soon as the server will take one. */
  function send() {
    const s = shift();
    if (!s || sending || !isRight(refs.input.value)) return;
    const wait = lastSentAt + job().msPerUnit - Date.now();
    if (wait > 0) {
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(send, wait + 30);
      refs.hint.textContent = "Easy — the foreman reads one line every few seconds…";
      return;
    }
    submit(s);
  }

  async function submit(s) {
    sending = true;
    lastSentAt = Date.now();
    const text = refs.input.value;
    try {
      const payload = await post("type", { id: s.id, text });
      if (!data) return;
      if (!payload) { toast("Lost the connection — that line wasn't counted. Press Enter to try again.", true); return; }
      if ("shift" in payload) setState({ shift: payload.shift && payload.shift.status === "WORKING" ? payload.shift : null });
      if (payload.hour && data.me) data.me.hour = payload.hour;
      if (payload.result === "typed") {
        refs.input.value = "";
        prevLen = 0;
        flash(refs.box, "ok");
        if (payload.paid) {
          float(`+${fmt(payload.payout)} ZC`);
          if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
          if (data.me && payload.balance != null) data.me.balance = payload.balance;
          if (!payload.shift) {
            // That was the hour's cap: the shift is over.
            setState({ shift: null, nextShiftAt: payload.nextShiftAt || null });
            render();
            pop({ won: true, big: false, amount: hour().earned || cap(), headline: "That's the hour", detail: `${fmt(cap())} ZC begged this hour. The next line pays at ${new Date(nextAt() || Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` });
            window.ECV3?.refreshSession?.();
            await load({ balance: true });
          }
        }
      } else if (payload.result === "capped") {
        setState({ shift: null, nextShiftAt: payload.nextShiftAt || null });
        toast(`You've begged your ${fmt(cap())} ZC this hour.`, true);
      } else if (payload.result === "slow") {
        // The page and the server disagree on the clock by a moment: try again when it says.
        lastSentAt = Date.now() - job().msPerUnit + (payload.shift?.waitMs || 500);
        window.clearTimeout(holdTimer);
        holdTimer = window.setTimeout(send, (payload.shift?.waitMs || 500) + 30);
      } else if (payload.result === "typo") {
        flash(refs.box, "bad");
        toast("That's not quite it. Every word counts.", true);
      } else if (payload.result === "over" || payload.result === "stale") {
        await load();
      } else if (payload.code === "PAYOUT_FAILED") {
        refs.input.value = "";
        prevLen = 0;
        toast(payload.message, true);
      } else if (!payload.ok) {
        toast(payload.message || "That line didn't go through.", true);
      }
    } finally {
      sending = false;
      if (data) { render(); paintLine(); }
    }
  }

  /* A "+1 ZC" that floats off the box, capped so a quick typist cannot pile nodes up. */
  function float(text) {
    if (!refs.floaters || refs.floaters.childElementCount > 6) return;
    const f = K.el("span", "grd-float", text);
    f.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 120)}px`);
    f.addEventListener("animationend", () => f.remove());
    refs.floaters.append(f);
  }

  function flash(node, kind) {
    if (!node) return;
    node.classList.remove("ok", "bad");
    void node.offsetWidth;
    node.classList.add(kind);
  }

  /* The phrase above the box, lit up as far as what's typed matches it. */
  function paintLine() {
    if (!refs.phrase) return;
    const target = job().phrase;
    const typed = refs.input?.value || "";
    let ok = 0;
    while (ok < typed.length && ok < target.length && typed[ok].toLowerCase() === target[ok].toLowerCase()) ok += 1;
    const wrong = typed.length > ok;
    refs.phrase.replaceChildren(
      K.el("span", "grd-typed", target.slice(0, ok)),
      K.el("span", wrong ? "grd-wrong" : "grd-cursor", target.slice(ok, ok + 1)),
      K.el("span", null, target.slice(ok + 1))
    );
    refs.box.classList.toggle("off", wrong);
    if (!holdTimer || !isRight(typed)) refs.hint.textContent = wrong ? "Backspace — that's not what it says." : "Type the line. It sends itself when it's right.";
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
    // The emote beside the title, sized and placed like the casino floor's.
    const h1 = K.el("h1", null, "The Grind");
    const emote = document.createElement("img");
    emote.className = "cf-title-emote";
    emote.src = "https://cdn.betterttv.net/emote/63fab670d67ca5b27401fc0e/2x.webp";
    emote.alt = "";
    emote.width = 32; emote.height = 32;
    // A dead CDN link must not leave a broken-image box beside the title.
    emote.addEventListener("error", () => emote.remove());
    h1.append(emote);
    copy.append(h1, poor,
      K.el("p", null, `Broke? Beg for it. Every line you type is ${DEFAULT_JOB.pay} ZC, up to ${DEFAULT_JOB.hourCap} an hour, for anyone under ${cfg().brokeLine} — a way back to the tables, not a job.`));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage grd-stage");
    refs.phase = K.el("div", "cf-phase", "");

    const shop = K.el("div", "grd-shop grd-typeshop");
    refs.btn = K.el("button", "grd-btn");
    refs.btn.type = "button";
    refs.btnLabel = K.el("b", null, "Clock in");
    refs.btnSub = K.el("small", null, "");
    refs.btn.append(refs.btnLabel, refs.btnSub);
    refs.btn.addEventListener("click", clockIn);

    refs.desk = K.el("div", "grd-desk");
    refs.phrase = K.el("p", "grd-phrase");
    refs.phrase.setAttribute("aria-hidden", "true");
    refs.box = K.el("div", "grd-typebox");
    refs.input = document.createElement("input");
    refs.input.type = "text";
    refs.input.className = "grd-input";
    refs.input.autocomplete = "off";
    refs.input.spellcheck = false;
    refs.input.setAttribute("autocapitalize", "off");
    refs.input.setAttribute("autocorrect", "off");
    refs.input.maxLength = 120;
    refs.input.setAttribute("aria-label", `Type: ${DEFAULT_JOB.phrase}`);
    refs.input.addEventListener("input", onType);
    refs.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (isRight(refs.input.value)) send(); else { flash(refs.box, "bad"); } } });
    for (const ev of ["paste", "drop"]) refs.input.addEventListener(ev, (e) => { e.preventDefault(); toast("No pasting. Beg properly.", true); });
    refs.input.addEventListener("beforeinput", (e) => { if (/^insertFrom(Paste|Drop|Yank)|insertReplacementText/.test(e.inputType || "")) { e.preventDefault(); toast("No pasting. Beg properly.", true); } });
    refs.floaters = K.el("div", "grd-floaters");
    refs.floaters.setAttribute("aria-hidden", "true");
    refs.box.append(refs.input, refs.floaters);
    refs.hint = K.el("small", "grd-hint", "");
    refs.desk.append(refs.phrase, refs.box, refs.hint);

    refs.meter = meter();
    shop.append(refs.btn, refs.desk, refs.meter.node);

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
      `Type "${DEFAULT_JOB.phrase}". Every word counts; capitals don't.`,
      `Every right line pays ${DEFAULT_JOB.pay} ZC on the spot, up to ${DEFAULT_JOB.hourCap} ZC in any hour.`,
      `The foreman reads one line every couple of seconds. No pasting — type it.`
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
    paintLine();
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
    m.of.textContent = ` / ${units} ZC this hour`;
    m.fill.style.width = `${(100 * done) / units}%`;
    m.bar.setAttribute("aria-valuemax", String(units));
    m.bar.setAttribute("aria-valuenow", String(done));
    K.withCoins(m.pay, `Pays [[${pay}]] a line`);
  }

  function mmss(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    if (t >= 3600) return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;   /* a four-hour wait reads 3:59:59, not 239:59 */
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  }

  /** What the big button and the stage copy say when no shift is running. */
  function idleFace() {
    const c = cfg();
    const j = job();
    const me = data?.me || null;
    if (data?.config?.closed) return { label: "Closed", sub: "", disabled: true, phase: "Not taking shifts right now", phaseCls: "bad", note: "The Grind is closed for now." };
    if (!data?.config?.canWork) return { label: "Closed", sub: "", disabled: true, phase: "Not taking shifts right now", phaseCls: "bad", note: "The wallet isn't connected, so there's nobody to pay you. Check back soon." };
    if (cooling()) return { label: mmss(nextAt() - Date.now()), sub: "until a line pays again", disabled: true, phase: "That's the hour", phaseCls: "", note: `You've begged your ${fmt(cap())} ZC this hour. Go spend it.` };
    if (me?.eligible === false) return { label: "Not today", sub: `for under ${c.brokeLine} ZC`, disabled: true, phase: "You're doing fine", phaseCls: "", note: `You've got ${fmt(me.balance)} ZC. The Grind is for anyone under ${c.brokeLine} — come back if the tables go cold.` };
    const left = hour().left ?? cap();
    return { label: "Clock in", sub: `${j.pay} ZC a line · ${left} left this hour`, disabled: busy, phase: "Ready when you are", phaseCls: "open", note: `Checked when you clock in: you need to be under ${c.brokeLine} ZC.` };
  }

  function render() {
    if (!refs.btn) return;
    const me = data?.me || null;
    const j = job();
    const s = shift();

    refs.status.textContent = data ? (data.room?.length ? `${data.room.length} on the floor` : "Quiet shift") : "Connecting…";

    const h = hour();
    paintMeter(refs.meter, Math.min(cap(), Number(h.earned || 0)), cap(), j.pay);
    refs.btn.hidden = Boolean(s);
    refs.desk.hidden = !s;
    if (s) {
      refs.phase.textContent = "On shift";
      refs.phase.className = "cf-phase open";
      refs.note.textContent = `${Math.max(0, cap() - Number(h.earned || 0))} ZC left this hour${s.misses ? ` · ${s.misses} botched` : ""}. Leave and come back — the shift waits for you.`;
    } else {
      const f = idleFace();
      refs.btn.disabled = f.disabled;
      refs.btn.classList.toggle("resting", f.disabled && !busy);
      refs.btnLabel.textContent = f.label;
      refs.btnSub.textContent = f.sub;
      refs.btn.setAttribute("aria-label", f.label);
      refs.phase.textContent = f.phase;
      refs.phase.className = `cf-phase ${f.phaseCls}`.trim();
      refs.note.textContent = f.note;
    }

    // Your shifts (its coin icons would flash too if rebuilt every second)
    const when = s ? "on one now" : cooling() ? mmss(nextAt() - Date.now()) : "now";
    const youSig = me ? [me.shifts, me.earned, when, h.earned].join("|") : "";
    if (youSig !== refs.youSig) {
      refs.youSig = youSig;
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
          row("This hour", K.zc(h.earned || 0)),
          row("Next shift", when)
        );
      }
    }

    // On the floor: rebuilt only when it changes, or the avatars flash.
    const room = data?.room || [];
    refs.roomCount.textContent = room.length ? String(room.length) : "";
    const roomSig = room.map((u) => u.login + "|" + u.avatar + "|" + u.displayName).join(",");
    if (roomSig !== refs.roomSig) {
      refs.roomSig = roomSig;
      refs.roomList.replaceChildren();
      if (!room.length) refs.roomList.append(K.el("p", "cf-empty", "Nobody on the floor right now."));
      for (const u of room) {
        const chip = K.el("a", "cf-chipuser ulink");
        chip.href = `/u/${encodeURIComponent(u.login)}`;
        chip.append(K.avatar(u, "cf-av small"), document.createTextNode(u.displayName));
        refs.roomList.append(chip);
      }
    }

    // Recent paydays
    const recent = data?.recent || [];
    refs.ledgerNote.textContent = recent.length ? `${recent.length} recent` : "";
    const recentSig = ledgerPage + "#" + (me?.id || "") + "#" + recent.map((e) => e.id + "|" + e.user.avatar).join(",");
    if (recentSig === refs.recentSig) return;
    refs.recentSig = recentSig;
    refs.ledgerList.replaceChildren();
    if (!recent.length) refs.ledgerList.append(K.el("p", "cf-empty", "Nobody has worked a shift yet."));
    const pg = K.pageOf(recent, ledgerPage, 10);
    for (const e of pg.slice) {
      const what = OLD_JOBS[e.job] || `${fmt(e.payout)} line${e.payout === 1 ? "" : "s"} begged`;
      const r = K.el("div", `cf-row won${me && e.user.id === me.id ? " me" : ""}`);
      r.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      who.append(K.el("small", null, `${what} · ${new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`));
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
      pollTimer = window.setInterval(() => { if (!sending) load(); }, POLL_MS);
      // The countdown ticks on the page between polls; a clock that runs out reloads.
      tickTimer = window.setInterval(() => {
        if (!data?.me) return;
        const at = nextAt();
        if (at && !shift() && at <= Date.now()) { setState({ nextShiftAt: null }); load({ balance: true }); return; }
        if (cooling()) render();
      }, 1000);
    },
    unmount() {
      window.clearInterval(pollTimer);
      window.clearInterval(tickTimer);
      window.clearTimeout(holdTimer);
      pollTimer = 0; tickTimer = 0; holdTimer = 0;
      data = null; refs = {}; sending = false; busy = false;
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("grind", view);
  }
  boot();
})();

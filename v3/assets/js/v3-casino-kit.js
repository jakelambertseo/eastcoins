/* ============================================================
   EastCoin V3 — Casino kit

   What every casino page shares: the ZCoin amount, avatars and
   names, toasts and the win/lose popup — and, for the games the
   whole room plays together on the clock, one page frame:

     head · stage (the game's own drawing) · bet controls
     this round · last round + fairness line · room · ledger

   A game supplies only its stage, its pick buttons and its words.
   The poll, the countdown, the bet, the lists and the ledger are
   all here, once, so Wheel and Horse Race can never drift from
   each other or from the Coin Flip they are modelled on.
   ============================================================ */
(() => {
  "use strict";

  const POLL_MS = 1500;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function btn(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  const fmt = (n) => Number(n || 0).toLocaleString();

  function zc(value, { sign = false } = {}) {
    const wrap = el("span", "zc-amount nums");
    const img = document.createElement("img");
    img.className = "zcoin-mark";
    img.src = "/v3/assets/img/zcoin.webp";
    img.alt = "ZCoins";
    img.width = 15;
    img.height = 15;
    const n = Number(value) || 0;
    const prefix = sign && n > 0 ? "+" : sign && n < 0 ? "−" : "";
    wrap.append(img, document.createTextNode(`${prefix}${Math.abs(n).toLocaleString()}`));
    return wrap;
  }

  /** Plain words on a node, only touching it when they change. */
  function plain(node, text) {
    if (node.dataset.wc === "t:" + text) return node;
    node.dataset.wc = "t:" + text;
    node.textContent = text;
    return node;
  }

  /** Text with every [[n]] turned into a ZCoin amount. */
  function withCoins(node, text) {
    // Same words as last time: leave the nodes alone. Rebuilding a
    // button's children every tick makes Chrome drop the click whose
    // mousedown landed on a node that is gone by mouseup.
    if (node.dataset.wc === String(text)) return node;
    node.dataset.wc = String(text);
    node.replaceChildren();
    const parts = String(text).split(/\[\[(-?\d[\d,]*)\]\]/);
    parts.forEach((part, i) => {
      if (i % 2 === 0) { if (part) node.append(document.createTextNode(part)); }
      else node.append(zc(Number(part.replace(/,/g, ""))));
    });
    return node;
  }

  function avatar(user, className) {
    const box = el("span", className, String(user?.displayName || user?.login || "?").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?");
    if (user?.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      img.addEventListener("load", () => box.classList.add("has-logo"));
      img.addEventListener("error", () => img.remove());
      img.src = user.avatar;
      box.append(img);
    }
    return box;
  }

  function nameLink(user) {
    const a = el("a", "ulink", user?.displayName || user?.login || "someone");
    a.href = `/u/${encodeURIComponent(String(user?.login || "").toLowerCase())}`;
    return a;
  }

  function casinoLink(text = "← Casino") {
    const a = el("a", "btn cas-back", text);
    a.href = "/?view=casino";
    a.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      history.pushState({ view: "casino" }, "", "/?view=casino");
      window.ECV3?.go("casino", { push: false });
    });
    return a;
  }

  /** The same pager the profile and Picks use, for a list that is all here already. */
  function pager(info, onGo, what = "rows") {
    if (info.pages <= 1) return document.createDocumentFragment();
    const box = el("div", "mpager pf-pager cf-pager");
    const prev = el("button", "mpager-btn", "‹");
    const next = el("button", "mpager-btn", "›");
    prev.type = next.type = "button";
    prev.disabled = info.at <= 1;
    next.disabled = info.at >= info.pages;
    prev.addEventListener("click", () => onGo(info.at - 1));
    next.addEventListener("click", () => onGo(info.at + 1));
    box.append(prev, el("span", "mpager-at", `Page ${info.at} of ${info.pages} · ${info.total} ${what}`), next);
    return box;
  }
  function pageOf(items, at, size) {
    const pages = Math.max(1, Math.ceil(items.length / size));
    const page = Math.min(pages, Math.max(1, at || 1));
    return { slice: items.slice((page - 1) * size, page * size), at: page, pages, total: items.length };
  }

  /** "Verify this round": the full hash and seed behind a disclosure, not a truncated line. */
  function verifyBox(title = "Verify this round") {
    const d = el("details", "cf-verify");
    d.append(el("summary", null, title));
    const body = el("pre", "cf-verify-body", "");
    d.append(body);
    d.hidden = true;
    return { node: d, body };
  }

  function makeToast(host) {
    const node = el("div", "cf-toast");
    host.append(node);
    let t = 0;
    return (text, bad) => {
      node.textContent = text;
      node.className = `cf-toast show${bad ? " bad" : ""}`;
      clearTimeout(t);
      t = setTimeout(() => { node.className = "cf-toast"; }, 2600);
    };
  }

  function makePop(host) {
    const node = el("div", "cf-pop");
    host.append(node);
    let t = 0;
    return ({ won, amount, headline, detail }) => {
      node.replaceChildren();
      node.className = `cf-pop show ${won ? "win" : "lose"}`;
      node.append(el("span", "cf-pop-k", headline || (won ? "You won" : "You lost")));
      const big = el("strong");
      big.append(zc(amount));
      node.append(big);
      if (detail) node.append(el("small", null, detail));
      clearTimeout(t);
      t = setTimeout(() => { node.className = "cf-pop"; }, 5000);
    };
  }

  /* ---------------------------------------------------------- shared-round frame */

  /**
   * spec = {
   *   key, title, intro, emote?,
   *   buildStage(refs) -> element        the game's drawing, kept across polls
   *   renderStage(refs, ctx)             ctx: { round, config, inBets, left, now, freshResult }
   *   pickButton(pick, config) -> { label, className, pays }
   *   pickLabel(pick, config) -> string  short, for rows
   *   describe(result, config) -> string what happened, for the popup and phase line
   * }
   */
  function sharedGame(spec) {
    let root = null;
    let refs = {};
    let pollTimer = 0;
    let tickTimer = 0;
    let data = null;
    let offset = 0;
    let shownResultFor = -1;
    let announcedFor = -1;
    let historyFor = -1;
    let lastSig = "";
    let history = null;
    let ledgerPage = 1;
    let stake = 10;
    let pick = null;
    let busy = false;
    let toast = () => {};
    let pop = () => {};
    const serverNow = () => Date.now() + offset;
    const api = (path) => `/api/casino/${spec.key}/${path}`;

    async function poll() {
      try {
        const response = await fetch(api("state"), { credentials: "include" });
        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.code || "state");
        offset = payload.now - Date.now();
        data = payload;
        if (!pick) pick = payload.config.picks[0];
        render();
      } catch {
        if (refs.status) refs.status.textContent = "Reconnecting…";
      }
    }

    async function loadHistory() {
      try {
        const payload = await fetch(api("history"), { credentials: "include" }).then((r) => r.json());
        if (payload?.ok) { history = payload; renderHistory(); }
      } catch { /* the ledger is a record; the game runs without it */ }
    }

    async function placeBet() {
      if (busy || !data?.config?.canBet || !pick) return;
      busy = true;
      refs.lock.disabled = true;
      try {
        const payload = await fetch(api("bet"), {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pick, wager: stake })
        }).then((r) => r.json()).catch(() => null);
        if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); return; }
        toast(`${fmt(stake)} on ${spec.pickLabel(pick, data.config)} — locked in.`);
        if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
        await poll();
      } finally {
        busy = false;
        render();
      }
    }

    function build() {
      root.replaceChildren();
      refs = {};
      const page = el("section", `coinflip casino-${spec.key}`);

      const head = el("div", "viewhead");
      const copy = el("div");
      const h1 = el("h1", null, spec.title);
      if (spec.emote) {
        const emote = document.createElement("img");
        emote.className = "cf-title-emote";
        emote.src = spec.emote;
        emote.alt = "";
        emote.width = 32;
        emote.height = 32;
        h1.append(emote);
      }
      copy.append(h1, el("p", null, spec.intro));
      head.append(copy);
      const right = el("div", "cas-headright");
      refs.status = el("span", "cf-status", "Connecting…");
      right.append(refs.status, casinoLink());
      head.append(right);
      page.append(head);

      const grid = el("div", "cf-grid");
      const stage = el("section", "cf-stage");
      refs.phase = el("div", "cf-phase", "");
      refs.stageBox = spec.buildStage(refs);
      refs.clock = el("div", "cf-clock nums", "—");
      refs.clockNote = el("div", "cf-clocknote", "");
      stage.append(refs.phase, refs.stageBox, refs.clock, refs.clockNote);

      const bet = el("div", "cf-bet");
      refs.picks = el("div", "kpicks");
      bet.append(refs.picks);
      const stakeRow = el("div", "cf-stakerow");
      refs.stakeInput = el("input", "cf-stake nums");
      refs.stakeInput.type = "number";
      refs.stakeInput.min = "1";
      refs.stakeInput.max = "20";
      refs.stakeInput.value = String(stake);
      refs.stakeInput.setAttribute("aria-label", "Stake");
      refs.stakeInput.addEventListener("input", () => { stake = Math.max(1, Math.min(20, Math.floor(Number(refs.stakeInput.value) || 1))); render(); });
      refs.stakeInput.addEventListener("blur", () => { refs.stakeInput.value = String(stake); });
      const chips = el("div", "cf-chips");
      for (const v of [5, 10, 20]) chips.append(btn(String(v), "cf-chip", () => { stake = v; refs.stakeInput.value = String(v); render(); }));
      stakeRow.append(refs.stakeInput, chips);
      refs.lock = btn("Lock it in", "cf-lock", placeBet);
      refs.betNote = el("p", "cf-note", "");
      refs.limits = el("p", "cf-limits", "");
      bet.append(stakeRow, refs.lock, refs.betNote, refs.limits);
      stage.append(bet);
      grid.append(stage);

      const col = el("div", "cf-side-col");
      const thisRound = el("section", "cf-card");
      const th = el("h2", null, "This round");
      refs.thisCount = el("small");
      th.append(refs.thisCount);
      refs.thisList = el("div", "cf-list");
      thisRound.append(th, refs.thisList);
      const lastRound = el("section", "cf-card");
      const lh = el("h2", null, "Last round");
      refs.lastNote = el("small");
      lh.append(refs.lastNote);
      refs.lastList = el("div", "cf-list");
      const verify = verifyBox();
      refs.fair = verify.node;
      refs.fairBody = verify.body;
      lastRound.append(lh, refs.lastList, refs.fair);
      const room = el("section", "cf-card");
      const rh = el("h2", null, "In the room");
      refs.roomCount = el("small");
      rh.append(refs.roomCount);
      refs.roomList = el("div", "cf-room");
      room.append(rh, refs.roomList);
      col.append(thisRound, lastRound, room);
      grid.append(col);
      page.append(grid);

      const ledger = el("section", "cf-card cf-ledger");
      const lgh = el("h2", null, "Ledger");
      refs.ledgerNote = el("small");
      lgh.append(refs.ledgerNote);
      refs.ledgerList = el("div", "cf-list paged");
      ledger.append(lgh, refs.ledgerList);
      page.append(ledger);

      pop = makePop(page);
      toast = makeToast(page);
      root.append(page);
    }

    function buildPicks(config) {
      if (refs.pickBtns) return;
      refs.pickBtns = {};
      refs.picks.replaceChildren();
      for (const p of config.picks) {
        const meta = spec.pickButton(p, config);
        const b = btn("", `kpick ${meta.className || p}`, () => { pick = p; render(); });
        b.append(el("span", "kpick-label", meta.label), el("span", "kpick-pays", `${meta.pays}×`));
        refs.pickBtns[p] = b;
        refs.picks.append(b);
      }
    }

    function betRow(b, showResult, config) {
      const row = el("div", `cf-row pick-${b.pick}${showResult ? " " + b.status.toLowerCase() : ""}${data?.me && b.user.id === data.me.id ? " me" : ""}`);
      row.append(avatar(b.user, "cf-av"));
      const who = el("div", "cf-who");
      who.append(nameLink(b.user));
      const sub = el("small");
      sub.append(document.createTextNode(`${spec.pickLabel(b.pick, config)} · `), zc(b.wager));
      who.append(sub);
      row.append(who);
      const res = el("span", "cf-res nums");
      if (showResult) {
        if (b.status === "WON") { res.classList.add("up"); res.append(el("span", "cf-tag win", "WIN"), zc(b.profit, { sign: true })); }
        else if (b.status === "LOST") { res.classList.add("down"); res.append(el("span", "cf-tag loss", "LOSS"), zc(-b.wager, { sign: true })); }
        else res.textContent = "…";
      } else {
        res.classList.add("pick");
        res.textContent = `${config.payout[b.pick]}×`;
      }
      row.append(res);
      return row;
    }

    function render() {
      if (!data || !refs.stageBox) return;
      buildPicks(data.config);
      renderClock();
      const revealed = isRevealed(data.round);
      const sig = JSON.stringify([data.bets, data.last, data.room, data.me?.bet, data.round.result, revealed]);
      if (sig === lastSig) return;
      lastSig = sig;
      renderLists();
    }

    /** The result counts as known once the stage has had time to show it. */
    function isRevealed(r) {
      return Boolean(r.result) && serverNow() >= r.closesAt + (spec.revealMs || 0);
    }

    function renderClock() {
      const r = data.round;
      const config = data.config;
      const now = serverNow();
      const inBets = now < r.closesAt;
      const left = Math.max(0, Math.ceil(((inBets ? r.closesAt : r.endsAt) - now) / 1000));
      const freshResult = Boolean(r.result) && !inBets && shownResultFor !== r.no;
      if (freshResult) shownResultFor = r.no;
      if (inBets) shownResultFor = -1;
      const revealed = isRevealed(r);

      refs.status.textContent = `Round #${r.no}`;
      refs.phase.textContent = inBets ? "Bets open" : revealed ? spec.describe(r.result, config) : spec.running || "Running…";
      refs.phase.className = `cf-phase${inBets ? " open" : revealed ? " done" : ""}`;
      refs.clock.textContent = `${left}s`;
      refs.clockNote.textContent = inBets ? "until bets close" : "until the next round";

      spec.renderStage(refs, { round: r, config, inBets, left, now, freshResult });

      const mine = data.me?.bet || null;
      for (const [p, b] of Object.entries(refs.pickBtns)) {
        b.classList.toggle("on", pick === p);
        b.disabled = Boolean(mine) || !inBets;
      }
      const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
      const canBet = config.canBet && inBets && !mine && !busy && !capped;
      refs.lock.disabled = !canBet;
      refs.stakeInput.disabled = Boolean(mine) || !inBets;
      const pays = (p, w) => Math.floor(w * (config.payout[p] || 0));
      if (config.paused) { plain(refs.lock, `${config.name} is closed for now`); refs.betNote.textContent = "It's in the shop. Back on the floor once it's been tuned up — the other games are open."; }
      else if (!data.me) { plain(refs.lock, "Log in to play"); refs.betNote.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
      else if (!config.canBet) { plain(refs.lock, "Casino paused"); refs.betNote.textContent = "ZCoin transfers aren't switched on right now."; }
      else if (mine) {
        withCoins(refs.lock, `You're in: [[${mine.wager}]] on ${spec.pickLabel(mine.pick, config)}`);
        if (!revealed) withCoins(refs.betNote, `Pays [[${pays(mine.pick, mine.wager)}]] if it comes in.`);
        else if (mine.status === "WON") withCoins(refs.betNote, `${spec.describe(r.result, config)} — you won [[${mine.profit}]].`);
        else if (mine.status === "LOST") withCoins(refs.betNote, `${spec.describe(r.result, config)} — you lost [[${mine.wager}]].`);
        else refs.betNote.textContent = "Settling…";
        // The big moment, once the stage has shown it and not before.
        if (revealed && (mine.status === "WON" || mine.status === "LOST") && announcedFor !== r.no) {
          announcedFor = r.no;
          pop({ won: mine.status === "WON", amount: mine.status === "WON" ? mine.profit : mine.wager,
            detail: `${spec.describe(r.result, config)}. ${mine.status === "WON" ? `${fmt(mine.payout)} back on ${fmt(mine.wager)}.` : "Next round in a moment."}` });
          loadHistory();
          window.ECV3?.refreshSession?.();
        }
      }
      else if (capped) { withCoins(refs.lock, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.betNote.textContent = "The tables reopen for you as the hour rolls on."; }
      else if (!inBets) { plain(refs.lock, "Next round soon"); refs.betNote.textContent = "Bets open again when the clock hits zero."; }
      else { withCoins(refs.lock, `Lock in [[${stake}]] on ${spec.pickLabel(pick, config)}`); withCoins(refs.betNote, `Pays [[${pays(pick, stake)}]] if it comes in.`); }

      const used = data.me?.betsThisHour;
      withCoins(refs.limits, `Max bet [[${config.maxBet}]] · ${config.maxPerHour} bets an hour · winnings cap [[${config.hourCap}]] an hour` +
        (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));
    }

    function renderHistory() {
      if (!refs.ledgerList || !history || !data) return;
      const list = refs.ledgerList;
      const config = data.config;
      list.replaceChildren();
      const me = history.me;
      if (me && (me.wins || me.losses)) {
        const note = el("span");
        note.append(document.createTextNode(`you: ${me.wins}–${me.losses} · `), zc(me.net, { sign: true }));
        refs.ledgerNote.replaceChildren(note);
      } else {
        refs.ledgerNote.textContent = history.entries.length ? `${history.entries.length} recent` : "";
      }
      if (!history.entries.length) { list.append(el("p", "cf-empty", "Nothing settled yet. The first round writes the first line.")); return; }
      let lastRound = null;
      const pg = pageOf(history.entries, ledgerPage, 10);
      for (const e of pg.slice) {
        if (e.round !== lastRound) {
          lastRound = e.round;
          const head = el("div", "cf-ledger-round");
          head.append(el("span", `cf-ledger-result ${spec.resultClass ? spec.resultClass(e.result) : ""}`, spec.describe(e.result, config)),
            el("small", null, `Round #${e.round}${e.settledAt ? " · " + new Date(e.settledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`));
          list.append(head);
        }
        list.append(betRow(e, true, config));
      }
      list.append(pager(pg, (n) => { ledgerPage = n; renderHistory(); }, "bets"));
    }

    function renderLists() {
      const r = data.round;
      const config = data.config;
      const now = serverNow();
      const inBets = now < r.closesAt;
      const bets = data.bets || [];
      const revealed = isRevealed(r);
      if (bets.length) { const c = el("span"); c.append(document.createTextNode(`${bets.length} in · `), zc(bets.reduce((n, b) => n + b.wager, 0))); refs.thisCount.replaceChildren(c); }
      else refs.thisCount.textContent = "nobody yet";
      refs.thisList.replaceChildren();
      if (!bets.length) refs.thisList.append(el("p", "cf-empty", inBets ? "Be the first in." : "Nobody bet this round."));
      for (const b of bets) refs.thisList.append(betRow(b, revealed, config));

      if (revealed && historyFor !== r.no) { historyFor = r.no; loadHistory(); }

      const last = data.last;
      refs.lastList.replaceChildren();
      if (last?.result) {
        const paid = last.bets.filter((b) => b.status === "WON").reduce((n, b) => n + b.payout, 0);
        const ln = el("span"); ln.append(document.createTextNode(`${spec.describe(last.result, config)} · ${last.bets.length} in · `), zc(paid), document.createTextNode(" paid")); refs.lastNote.replaceChildren(ln);
        for (const b of last.bets) refs.lastList.append(betRow(b, true, config));
        if (!last.bets.length) refs.lastList.append(el("p", "cf-empty", "Nobody bet that round."));
        refs.fair.hidden = false;
        refs.fairBody.textContent = `round      #${last.no}\nhash       ${last.hash}   (shown before bets opened)\nseed       ${last.seed}   (revealed after)\ncheck      sha256(seed) = hash · result from sha256(seed:${spec.key})`;
      } else {
        refs.lastNote.textContent = "";
        refs.lastList.append(el("p", "cf-empty", "First round coming up."));
        refs.fair.hidden = true;
      }

      const room = data.room || [];
      refs.roomCount.textContent = String(room.length);
      refs.roomList.replaceChildren();
      if (!room.length) refs.roomList.append(el("p", "cf-empty", "Nobody logged in is here yet."));
      for (const u of room) {
        const chip = el("a", "cf-chipuser ulink");
        chip.href = `/u/${encodeURIComponent(u.login)}`;
        chip.append(avatar(u, "cf-av small"), document.createTextNode(u.displayName));
        refs.roomList.append(chip);
      }
    }

    return {
      mount(container) {
        root = container;
        document.title = `${spec.title} — EastCoin Casino`;
        window.ECPresence?.beat(spec.key);
        build();
        poll();
        loadHistory();
        pollTimer = window.setInterval(poll, POLL_MS);
        tickTimer = window.setInterval(render, 250);
      },
      unmount() {
        window.clearInterval(pollTimer);
        window.clearInterval(tickTimer);
        pollTimer = tickTimer = 0;
        data = null; lastSig = ""; history = null; historyFor = -1; announcedFor = -1; shownResultFor = -1;
        refs = {};
        document.title = "EastCoin";
      }
    };
  }

  window.ECCasino = Object.freeze({ el, btn, zc, withCoins, plain, avatar, nameLink, casinoLink, makeToast, makePop, sharedGame, fmt, pager, pageOf, verifyBox });
})();

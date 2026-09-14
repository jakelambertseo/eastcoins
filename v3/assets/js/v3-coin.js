/* ============================================================
   EastCoin V3 — Casino: Coin Flip

     /?view=flip   ("casino" is kept for the casino home page)

   One coin for the whole room. Fifteen seconds of bets, a flip,
   fifteen seconds to see who won, again. The server owns the clock
   and the result; this page polls it, counts down locally, and
   draws the coin landing the way the server said it did.
   ============================================================ */
(() => {
  "use strict";

  // 3s, halved on 2026-09-12. This was the busiest page on the site: a tab
  // left open at 1.5s is 57,600 requests a day, and that is what exhausted
  // D1's daily read allowance. The countdown is unaffected — tickTimer
  // redraws it every 250ms off a server-corrected local clock — so all this
  // changes is how soon a flip's result and other people's bets appear,
  // inside a 15-second result window.
  const POLL_MS = 3000;
  let root = null;
  let shell = null;
  let refs = {};
  let pollTimer = 0;
  let tickTimer = 0;
  let data = null;
  let offset = 0;             // server clock minus ours
  let shownResultFor = -1;    // the round whose flip animation has played
  let stake = 10;
  let side = "heads";
  let busy = false;

  /* ---------------------------------------------------------- helpers */

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
  const serverNow = () => Date.now() + offset;

  /** An amount with the ZCoin mark in front of it. */
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

  /** Text, with every [[n]] turned into a ZCoin amount. */
  function plain(node, text) {
    if (node.dataset.wc === "t:" + text) return node;
    node.dataset.wc = "t:" + text;
    node.textContent = text;
    return node;
  }
  function withCoins(node, text) {
    // Same words as last time: leave the nodes alone, so a click on the
    // button never lands on a child that was replaced mid-press.
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

  let announcedFor = -1;
  function announce(bet, result) {
    const won = bet.status === "WON";
    const pop = refs.pop;
    pop.replaceChildren();
    pop.className = `cf-pop show ${won ? "win" : "lose"}`;
    pop.append(el("span", "cf-pop-k", won ? "You won" : "You lost"));
    const big = el("strong");
    big.append(zc(won ? bet.profit : bet.wager));
    pop.append(big);
    pop.append(el("small", null, `It landed ${result}. ${won ? `${fmt(bet.payout)} back on ${fmt(bet.wager)}.` : "Next flip in a moment."}`));
    clearTimeout(announce.t);
    announce.t = setTimeout(() => { pop.className = "cf-pop"; }, 5000);
  }

  let history = null;
  let ledgerPage = 1;
  async function loadHistory() {
    try {
      const response = await fetch("/api/coin/history", { credentials: "include" });
      const payload = await response.json();
      if (payload?.ok) { history = payload; renderHistory(); }
    } catch { /* the ledger is a record; the game is fine without it for a poll */ }
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

  function toast(text, bad) {
    refs.toast.textContent = text;
    refs.toast.className = `cf-toast show${bad ? " bad" : ""}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { refs.toast.className = "cf-toast"; }, 2600);
  }

  /* ---------------------------------------------------------- data */

  // Hidden tabs still poll, at a fifth of the rate. Stopping outright
  // would be wrong here: the first poll after a flip is what settles the
  // round and pays people, and that cannot wait for someone to look.
  let idleTick = 0;
  async function poll() {
    if (document.hidden && (idleTick = (idleTick + 1) % 5) !== 0) return;
    try {
      const response = await fetch("/api/coin/state", { credentials: "include" });
      const payload = await response.json();
      if (!payload?.ok) throw new Error(payload?.code || "state");
      offset = payload.now - Date.now();
      data = payload;
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  async function placeBet() {
    if (busy || !data?.config?.canBet) return;
    busy = true;
    refs.lock.disabled = true;
    try {
      const response = await fetch("/api/coin/bet", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, wager: stake })
      });
      const payload = await response.json().catch(() => null);
      if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); return; }
      toast(`${fmt(stake)} on ${side} — locked in.`);
      // The stake just left the wallet; say so in the nav right away.
      if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
      await poll();
    } finally {
      busy = false;
      render();
    }
  }

  /* ---------------------------------------------------------- render */

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "coinflip");

    const head = el("div", "viewhead");
    const copy = el("div");
    const h1 = el("h1", null, "Coin Flip");
    const emote = document.createElement("img");
    emote.className = "cf-title-emote";
    emote.src = "https://cdn.betterttv.net/emote/6928e7173a375a69ca4d0d47/2x.webp";
    emote.alt = "";
    emote.width = 32;
    emote.height = 32;
    h1.append(emote);
    copy.append(h1, el("p", null, "One coin for the whole room. Fifteen seconds to get in, then it flips. Heads or tails pays 2×."));
    head.append(copy);
    const right = el("div", "cas-headright");
    refs.status = el("span", "cf-status", "Connecting…");
    right.append(refs.status);
    if (window.ECCasino) right.append(window.ECCasino.casinoLink());
    else { const back = el("a", "btn cas-back", "← Casino"); back.href = "/?view=casino"; right.append(back); }
    head.append(right);
    page.append(head);

    const grid = el("div", "cf-grid");

    // Stage: the coin and the clock
    const stage = el("section", "cf-stage");
    refs.phase = el("div", "cf-phase", "");
    refs.coinWrap = el("div", "cf-coinwrap");
    refs.coin = el("div", "cf-coin");
    // A real quarter, both sides (US Mint images, public domain).
    const heads = el("div", "cf-face heads");
    const headsImg = document.createElement("img");
    headsImg.src = "/v3/assets/img/quarter-heads.jpg";
    headsImg.alt = "Heads";
    heads.append(headsImg);
    const tails = el("div", "cf-face tails");
    const tailsImg = document.createElement("img");
    tailsImg.src = "/v3/assets/img/quarter-tails.jpg";
    tailsImg.alt = "Tails";
    tails.append(tailsImg);
    refs.coin.append(heads, tails);
    refs.coinWrap.append(refs.coin);
    refs.clock = el("div", "cf-clock nums", "—");
    refs.clockNote = el("div", "cf-clocknote", "");
    stage.append(refs.phase, refs.coinWrap, refs.clock, refs.clockNote);

    // Bet controls
    const bet = el("div", "cf-bet");
    const sides = el("div", "cf-sides");
    refs.headsBtn = btn("Heads", "cf-side heads", () => { side = "heads"; render(); });
    refs.tailsBtn = btn("Tails", "cf-side tails", () => { side = "tails"; render(); });
    sides.append(refs.headsBtn, refs.tailsBtn);
    const stakeRow = el("div", "cf-stakerow");
    refs.stakeInput = el("input", "cf-stake nums");
    refs.stakeInput.type = "number";
    refs.stakeInput.min = "1";
    refs.stakeInput.max = "20";
    refs.stakeInput.value = String(stake);
    refs.stakeInput.setAttribute("aria-label", "Stake");
    refs.stakeInput.addEventListener("input", () => { stake = Math.max(1, Math.min(20, Math.floor(Number(refs.stakeInput.value) || 1))); });
    refs.stakeInput.addEventListener("blur", () => { refs.stakeInput.value = String(stake); });
    const chips = el("div", "cf-chips");
    for (const v of [5, 10, 20]) chips.append(btn(String(v), "cf-chip", () => { stake = v; refs.stakeInput.value = String(v); }));
    stakeRow.append(refs.stakeInput, chips);
    refs.lock = btn("Lock it in", "cf-lock", placeBet);
    refs.betNote = el("p", "cf-note", "");
    refs.limits = el("p", "cf-limits", "");
    bet.append(sides, stakeRow, refs.lock, refs.betNote, refs.limits);
    stage.append(bet);
    grid.append(stage);

    // Side column: this round, last round, room
    const side_ = el("div", "cf-side-col");
    const thisRound = el("section", "cf-card");
    const th = el("h2", null, "This round");
    refs.thisCount = el("small");
    th.append(refs.thisCount);
    refs.thisList = el("div", "cf-list");
    thisRound.append(th, refs.thisList);

    const lastRound = el("section", "cf-card");
    const lh = el("h2", null, "Last flip");
    refs.lastNote = el("small");
    lh.append(refs.lastNote);
    refs.lastList = el("div", "cf-list");
    const verify = window.ECCasino?.verifyBox ? window.ECCasino.verifyBox("Verify this flip") : null;
    refs.fair = verify ? verify.node : el("p", "cf-fair", "");
    refs.fairBody = verify ? verify.body : refs.fair;
    lastRound.append(lh, refs.lastList, refs.fair);

    const room = el("section", "cf-card");
    const rh = el("h2", null, "In the room");
    refs.roomCount = el("small");
    rh.append(refs.roomCount);
    refs.roomList = el("div", "cf-room");
    room.append(rh, refs.roomList);

    side_.append(thisRound, lastRound, room);
    grid.append(side_);
    page.append(grid);

    // Ledger: every flip anyone has taken, newest first
    const ledger = el("section", "cf-card cf-ledger");
    const lgh = el("h2", null, "Ledger");
    refs.ledgerNote = el("small");
    lgh.append(refs.ledgerNote);
    refs.ledgerList = el("div", "cf-list paged");
    ledger.append(lgh, refs.ledgerList);
    page.append(ledger);

    refs.pop = el("div", "cf-pop");
    page.append(refs.pop);
    refs.toast = el("div", "cf-toast");
    page.append(refs.toast);
    root.append(page);
  }

  function betRow(b, showResult) {
    const row = el("div", `cf-row ${b.side}${showResult ? " " + b.status.toLowerCase() : ""}${data?.me && b.user.id === data.me.id ? " me" : ""}`);
    row.append(avatar(b.user, "cf-av"));
    const who = el("div", "cf-who");
    who.append(nameLink(b.user));
    const sub = el("small");
    sub.append(document.createTextNode(`${b.side} · `), zc(b.wager));
    who.append(sub);
    row.append(who);
    const res = el("span", "cf-res nums");
    if (showResult) {
      if (b.status === "WON") { res.classList.add("up"); res.append(el("span", "cf-tag win", "WIN"), zc(b.profit, { sign: true })); }
      else if (b.status === "LOST") { res.classList.add("down"); res.append(el("span", "cf-tag loss", "LOSS"), zc(-b.wager, { sign: true })); }
      else res.textContent = "…";
    } else {
      res.textContent = b.side === "heads" ? "H" : "T";
      res.classList.add("pick");
    }
    row.append(res);
    return row;
  }

  function render() {
    if (!data || !refs.coin) return;
    renderClock();
    // Rebuilding the lists on every tick re-created every avatar image,
    // which flickered. They change only when a poll brings new data.
    const sig = JSON.stringify([data.bets, data.last, data.room, data.me?.bet, data.round.result]);
    if (sig === lastSig) return;
    lastSig = sig;
    renderLists();
  }

  let lastSig = "";
  let historyFor = -1;

  function renderClock() {
    const r = data.round;
    const now = serverNow();
    const inBets = now < r.flipsAt;
    const left = Math.max(0, Math.ceil(((inBets ? r.flipsAt : r.endsAt) - now) / 1000));

    refs.status.textContent = `Round #${r.no}`;
    refs.phase.textContent = inBets ? "Bets open" : r.result ? `${r.result.toUpperCase()}!` : "Flipping…";
    refs.phase.className = `cf-phase${inBets ? " open" : r.result ? " " + r.result : ""}`;
    refs.clock.textContent = `${left}s`;
    refs.clockNote.textContent = inBets ? "until the flip" : "until the next round";

    // The coin: spins while bets are open, lands on the result once.
    if (inBets) {
      refs.coin.className = "cf-coin spin";
      shownResultFor = -1;
    } else if (r.result && shownResultFor !== r.no) {
      shownResultFor = r.no;
      refs.coin.className = `cf-coin land ${r.result}`;
    } else if (r.result) {
      refs.coin.className = `cf-coin still ${r.result}`;
    }

    // Bet controls
    const mine = data.me?.bet || null;
    refs.headsBtn.classList.toggle("on", side === "heads");
    refs.tailsBtn.classList.toggle("on", side === "tails");
    const canBet = data.config.canBet && inBets && !mine && !busy;
    refs.lock.disabled = !canBet;
    refs.headsBtn.disabled = refs.tailsBtn.disabled = Boolean(mine) || !inBets;
    refs.stakeInput.disabled = Boolean(mine) || !inBets;
    if (!data.me) { plain(refs.lock, "Log in to play"); refs.betNote.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
    else if (!data.config.canBet) { plain(refs.lock, "Casino paused"); refs.betNote.textContent = "ZCoin transfers aren't switched on right now."; }
    else if (mine) {
      withCoins(refs.lock, `You're in: [[${mine.wager}]] on ${mine.side}`);
      if (inBets) withCoins(refs.betNote, `Wins [[${mine.wager * 2}]] back if it lands ${mine.side}.`);
      else if (mine.status === "WON") withCoins(refs.betNote, `It landed ${r.result} — you won [[${mine.profit}]].`);
      else if (mine.status === "LOST") withCoins(refs.betNote, `It landed ${r.result} — you lost [[${mine.wager}]].`);
      else refs.betNote.textContent = "Settling…";
      // The big moment, once per round, the first time we see it decided.
      if (!inBets && (mine.status === "WON" || mine.status === "LOST") && announcedFor !== r.no) {
        announcedFor = r.no;
        announce(mine, r.result);
        loadHistory();
        // A win just landed in the wallet (or a loss did not come back);
        // re-read the balance so the nav matches.
        window.ECV3?.refreshSession?.();
      }
    }
    else if (!inBets) { plain(refs.lock, "Next round soon"); refs.betNote.textContent = "Bets open again when the clock hits zero."; }
    else { withCoins(refs.lock, `Lock in [[${stake}]] on ${side}`); withCoins(refs.betNote, `Wins [[${stake * 2}]] back if it lands ${side}.`); }

    const used = data.me?.betsThisHour;
    withCoins(refs.limits, `Max bet [[${data.config.maxBet}]] · up to ${data.config.maxPerHour} bets an hour` +
      (Number.isFinite(used) ? ` · you've used ${used} of ${data.config.maxPerHour}` : ""));
  }

  function renderHistory() {
    if (!refs.ledgerList || !history) return;
    const list = refs.ledgerList;
    list.replaceChildren();
    const me = history.me;
    if (me && (me.wins || me.losses)) {
      const note = el("span");
      note.append(document.createTextNode(`you: ${me.wins}–${me.losses} · `), zc(me.net, { sign: true }));
      refs.ledgerNote.replaceChildren(note);
    } else {
      refs.ledgerNote.textContent = history.entries.length ? `${history.entries.length} recent` : "";
    }
    if (!history.entries.length) { list.append(el("p", "cf-empty", "No flips settled yet. The first one writes the first line.")); return; }
    let lastRound = null;
    const pg = window.ECCasino.pageOf(history.entries, ledgerPage, 10);
    for (const e of pg.slice) {
      if (e.round !== lastRound) {
        lastRound = e.round;
        const head = el("div", "cf-ledger-round");
        head.append(el("span", `cf-ledger-result ${e.result}`, e.result), el("small", null, `Round #${e.round}${e.settledAt ? " · " + new Date(e.settledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`));
        list.append(head);
      }
      list.append(betRow({ ...e, payout: e.wager * 2 }, true));
    }
    list.append(window.ECCasino.pager(pg, (n) => { ledgerPage = n; renderHistory(); }, "bets"));
  }

  function renderLists() {
    const r = data.round;
    const now = serverNow();
    const inBets = now < r.flipsAt;
    const bets = data.bets || [];
    if (bets.length) { const c = el("span"); c.append(document.createTextNode(`${bets.length} in · `), zc(bets.reduce((n, b) => n + b.wager, 0))); refs.thisCount.replaceChildren(c); }
    else refs.thisCount.textContent = "nobody yet";
    refs.thisList.replaceChildren();
    if (!bets.length) refs.thisList.append(el("p", "cf-empty", inBets ? "Be the first in." : "Nobody bet this round."));
    for (const b of bets) refs.thisList.append(betRow(b, !inBets && Boolean(r.result)));

    if (r.result && !inBets && historyFor !== r.no) { historyFor = r.no; loadHistory(); }

    const last = data.last;
    refs.lastList.replaceChildren();
    if (last?.result) {
      const paid = last.bets.filter((b) => b.status === "WON").reduce((n, b) => n + b.payout, 0);
      const ln = el("span"); ln.append(document.createTextNode(`${last.result} · ${last.bets.length} in · `), zc(paid), document.createTextNode(" paid")); refs.lastNote.replaceChildren(ln);
      for (const b of last.bets) refs.lastList.append(betRow(b, true));
      if (!last.bets.length) refs.lastList.append(el("p", "cf-empty", "Nobody bet that round."));
      refs.fair.hidden = false;
      refs.fairBody.textContent = `round      #${last.no}\nhash       ${last.hash}   (shown before bets opened)\nseed       ${last.seed}   (revealed after)\ncheck      sha256(seed) = hash · heads if the first byte is even`;
    } else {
      refs.lastNote.textContent = "";
      refs.lastList.append(el("p", "cf-empty", "First flip coming up."));
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

  /* ---------------------------------------------------------- view */

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
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
      data = null;
      lastSig = "";
      history = null;
      historyFor = -1;
      announcedFor = -1;
      refs = {};
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("flip", view);
  }
  boot();
})();

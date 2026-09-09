/* ============================================================
   EastCoin V3 — Casino: Coin Flip

     /?view=casino

   One coin for the whole room. Thirty seconds of bets, a flip,
   twenty seconds to see who won, again. The server owns the clock
   and the result; this page polls it, counts down locally, and
   draws the coin landing the way the server said it did.
   ============================================================ */
(() => {
  "use strict";

  const POLL_MS = 1500;
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
    window.ECBadges?.decorate(a, user?.login);
    return a;
  }

  function toast(text, bad) {
    refs.toast.textContent = text;
    refs.toast.className = `cf-toast show${bad ? " bad" : ""}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { refs.toast.className = "cf-toast"; }, 2600);
  }

  /* ---------------------------------------------------------- data */

  async function poll() {
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
    copy.append(el("h1", null, "Coin Flip"), el("p", null, "One coin for the whole room. Thirty seconds to get in, then it flips. Heads or tails pays 2× — no edge, no house."));
    head.append(copy);
    refs.status = el("span", "cf-status", "Connecting…");
    head.append(refs.status);
    page.append(head);

    const grid = el("div", "cf-grid");

    // Stage: the coin and the clock
    const stage = el("section", "cf-stage");
    refs.phase = el("div", "cf-phase", "");
    refs.coinWrap = el("div", "cf-coinwrap");
    refs.coin = el("div", "cf-coin");
    const heads = el("div", "cf-face heads");
    heads.append(el("span", null, "H"));
    const tails = el("div", "cf-face tails");
    tails.append(el("span", null, "T"));
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
    bet.append(sides, stakeRow, refs.lock, refs.betNote);
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
    refs.fair = el("p", "cf-fair", "");
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

    refs.toast = el("div", "cf-toast");
    page.append(refs.toast);
    root.append(page);
  }

  function betRow(b, showResult) {
    const row = el("div", `cf-row ${b.side}${showResult ? " " + b.status.toLowerCase() : ""}${data?.me && b.user.id === data.me.id ? " me" : ""}`);
    row.append(avatar(b.user, "cf-av"));
    const who = el("div", "cf-who");
    who.append(nameLink(b.user));
    who.append(el("small", null, `${b.side} · ${fmt(b.wager)} ZC`));
    row.append(who);
    const res = el("span", "cf-res nums");
    if (showResult) {
      if (b.status === "WON") { res.classList.add("up"); res.textContent = `+${fmt(b.profit)}`; }
      else if (b.status === "LOST") { res.classList.add("down"); res.textContent = `−${fmt(b.wager)}`; }
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
    if (!data.me) { refs.lock.textContent = "Log in to play"; refs.betNote.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
    else if (!data.config.canBet) { refs.lock.textContent = "Casino paused"; refs.betNote.textContent = "ZCoin transfers aren't switched on right now."; }
    else if (mine) { refs.lock.textContent = `You're in: ${fmt(mine.wager)} on ${mine.side}`; refs.betNote.textContent = inBets ? `Wins ${fmt(mine.wager * 2)} back if it lands ${mine.side}.` : mine.status === "WON" ? `It landed ${r.result} — you won ${fmt(mine.profit)}.` : mine.status === "LOST" ? `It landed ${r.result}. Next one.` : "Settling…"; }
    else if (!inBets) { refs.lock.textContent = "Next round soon"; refs.betNote.textContent = "Bets open again when the clock hits zero."; }
    else { refs.lock.textContent = `Lock in ${fmt(stake)} on ${side}`; refs.betNote.textContent = `Max ${data.config.maxBet} a round. Wins ${fmt(stake * 2)} back.`; }

    // Lists
    const bets = data.bets || [];
    refs.thisCount.textContent = bets.length ? `${bets.length} in · ${fmt(bets.reduce((n, b) => n + b.wager, 0))} ZC` : "nobody yet";
    refs.thisList.replaceChildren();
    if (!bets.length) refs.thisList.append(el("p", "cf-empty", inBets ? "Be the first in." : "Nobody bet this round."));
    for (const b of bets) refs.thisList.append(betRow(b, !inBets && Boolean(r.result)));

    const last = data.last;
    refs.lastList.replaceChildren();
    if (last?.result) {
      const paid = last.bets.filter((b) => b.status === "WON").reduce((n, b) => n + b.payout, 0);
      refs.lastNote.textContent = `${last.result} · ${last.bets.length} in · ${fmt(paid)} paid`;
      for (const b of last.bets) refs.lastList.append(betRow(b, true));
      if (!last.bets.length) refs.lastList.append(el("p", "cf-empty", "Nobody bet that round."));
      refs.fair.textContent = `Round #${last.no} · hash ${last.hash.slice(0, 6)}… published before bets · seed ${last.seed.slice(0, 6)}… revealed after · sha256(seed) = hash`;
    } else {
      refs.lastNote.textContent = "";
      refs.lastList.append(el("p", "cf-empty", "First flip coming up."));
      refs.fair.textContent = "";
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
      pollTimer = window.setInterval(poll, POLL_MS);
      tickTimer = window.setInterval(render, 250);
    },
    unmount() {
      window.clearInterval(pollTimer);
      window.clearInterval(tickTimer);
      pollTimer = tickTimer = 0;
      data = null;
      refs = {};
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("casino", view);
  }
  boot();
})();

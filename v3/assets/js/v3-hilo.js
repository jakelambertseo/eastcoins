/* ============================================================
   EastCoin V3 — Casino: Higher or Lower

     /?view=hilo

   Your own deck, dealt from a seed the server committed before
   the first card. Call the next card higher or lower; every
   right call multiplies the stake, a wrong one busts it, and you
   can cash out after any right call. Ties lose. Ace low, king high.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 4000;
  let root = null;
  let refs = {};
  let data = null;
  let pollTimer = 0;
  let stake = 10;
  let busy = false;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;
  let lastLiveId = null;

  const fmt = K.fmt;

  async function poll() {
    try {
      const payload = await fetch("/api/casino/hilo/state", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "state");
      data = payload;
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  async function post(path, body) {
    const payload = await fetch(`/api/casino/hilo/${path}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then((r) => r.json()).catch(() => null);
    return payload;
  }

  async function start() {
    if (busy || !data?.config?.canBet) return;
    busy = true; render();
    try {
      const payload = await post("start", { stake });
      if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); return; }
      if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
      data.live = payload.game;
      toast(`${fmt(stake)} on the table. Higher or lower?`);
    } finally { busy = false; render(); }
  }

  async function call(which) {
    if (busy || !data?.live) return;
    busy = true; render();
    try {
      const payload = await post("call", { id: data.live.id, call: which });
      if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); await poll(); return; }
      data.live = payload.game.status === "LIVE" ? payload.game : null;
      refs.lastGame = payload.game;
      flipIn(payload.card);
      if (payload.outcome === "bust") {
        pop({ won: false, amount: payload.game.stake, headline: "Bust", detail: `${cardText(payload.card)} — ${which} was wrong. Next deal when you're ready.` });
        window.ECV3?.refreshSession?.();
        await poll();
      } else if (payload.autoCashed) {
        pop({ won: true, amount: payload.payout - payload.game.stake, headline: "Maxed out", detail: `×${payload.game.multiplier} — ${fmt(payload.payout)} back on ${fmt(payload.game.stake)}.` });
        if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
        await poll();
      } else {
        toast(`${cardText(payload.card)} — right. ×${payload.game.multiplier}`);
      }
    } finally { busy = false; render(); }
  }

  async function cashOut() {
    if (busy || !data?.live) return;
    busy = true; render();
    try {
      const payload = await post("cashout", { id: data.live.id });
      if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); await poll(); return; }
      if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
      pop({ won: true, amount: payload.payout - payload.game.stake, headline: "Cashed out", detail: `×${payload.game.multiplier} — ${fmt(payload.payout)} back on ${fmt(payload.game.stake)}.` });
      data.live = null;
      refs.lastGame = payload.game;
      await poll();
    } finally { busy = false; render(); }
  }

  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const cardText = (c) => `${c.label || RANKS[Number(c.rank) - 1] || c.rank}${typeof c.suit === "number" ? SUITS[c.suit] || "" : c.suit || ""}`;
  function flipIn(card) {
    if (!refs.bigCard) return;
    refs.bigCard.classList.remove("flip");
    void refs.bigCard.offsetWidth;
    refs.bigCard.classList.add("flip");
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = K.el("section", "coinflip casino-hilo");
    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    copy.append(K.el("h1", null, "Higher or Lower"),
      K.el("p", null, "Your own deck, committed before the first card. Each right call multiplies your stake; a wrong one — ties included — busts it. Cash out whenever you like."));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage");
    refs.phase = K.el("div", "cf-phase", "");
    const table = K.el("div", "hl-table");
    refs.history = K.el("div", "hl-history");
    refs.bigCard = K.el("div", "hl-card big");
    refs.mult = K.el("div", "hl-mult nums", "");
    table.append(refs.history, refs.bigCard, refs.mult);
    stage.append(refs.phase, table);

    const bet = K.el("div", "cf-bet");
    refs.calls = K.el("div", "hl-calls");
    refs.lowerBtn = K.btn("", "hl-call lower", () => call("lower"));
    refs.higherBtn = K.btn("", "hl-call higher", () => call("higher"));
    refs.calls.append(refs.lowerBtn, refs.higherBtn);
    refs.cash = K.btn("Cash out", "cf-lock hl-cash", cashOut);
    const stakeRow = K.el("div", "cf-stakerow");
    refs.stakeInput = K.el("input", "cf-stake nums");
    refs.stakeInput.type = "number"; refs.stakeInput.min = "1"; refs.stakeInput.max = "20"; refs.stakeInput.value = String(stake);
    refs.stakeInput.setAttribute("aria-label", "Stake");
    refs.stakeInput.addEventListener("input", () => { stake = Math.max(1, Math.min(20, Math.floor(Number(refs.stakeInput.value) || 1))); render(); });
    refs.stakeInput.addEventListener("blur", () => { refs.stakeInput.value = String(stake); });
    const chips = K.el("div", "cf-chips");
    for (const v of [5, 10, 20]) chips.append(K.btn(String(v), "cf-chip", () => { stake = v; refs.stakeInput.value = String(v); render(); }));
    stakeRow.append(refs.stakeInput, chips);
    refs.stakeRow = stakeRow;
    refs.deal = K.btn("Deal", "cf-lock", start);
    refs.note = K.el("p", "cf-note", "");
    refs.limits = K.el("p", "cf-limits", "");
    bet.append(refs.calls, refs.cash, stakeRow, refs.deal, refs.note, refs.limits);
    stage.append(bet);
    grid.append(stage);

    const col = K.el("div", "cf-side-col");
    const you = K.el("section", "cf-card");
    const yh = K.el("h2", null, "Your record");
    refs.youNote = K.el("small");
    yh.append(refs.youNote);
    refs.youList = K.el("div", "hl-stats");
    you.append(yh, refs.youList);
    const fair = K.el("section", "cf-card cf-card-verify");
    const verify = K.verifyBox("Verify this deck");
    refs.fair = verify.node;
    refs.fairBody = verify.body;
    refs.fairCard = fair;
    fair.append(refs.fair);
    const room = K.el("section", "cf-card");
    const rh = K.el("h2", null, "At the table");
    refs.roomCount = K.el("small");
    rh.append(refs.roomCount);
    refs.roomList = K.el("div", "cf-room");
    room.append(rh, refs.roomList);
    col.append(you, fair, room);
    grid.append(col);
    page.append(grid);

    const ledger = K.el("section", "cf-card cf-ledger");
    const lgh = K.el("h2", null, "Recent runs");
    refs.ledgerNote = K.el("small");
    lgh.append(refs.ledgerNote);
    refs.ledgerList = K.el("div", "cf-list paged");
    ledger.append(lgh, refs.ledgerList);
    page.append(ledger);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function cardEl(c, cls) {
    const box = K.el("div", `hl-card ${cls || ""}${["♥", "♦"].includes(c.suit) ? " red" : ""}`);
    box.append(K.el("span", "hl-rank", c.label), K.el("span", "hl-suit", c.suit));
    return box;
  }

  function render() {
    if (!data || !refs.bigCard) return;
    const config = data.config;
    const live = data.live;
    const shown = live || refs.lastGame || null;
    refs.status.textContent = live ? `Run · ×${live.multiplier}` : "Ready";

    // The table
    refs.history.replaceChildren();
    if (shown) {
      const past = shown.cards.slice(0, -1);
      past.slice(-6).forEach((c) => refs.history.append(cardEl(c, "small")));
      const cur = shown.cards[shown.cards.length - 1];
      refs.bigCard.replaceChildren(K.el("span", "hl-rank", cur.label), K.el("span", "hl-suit", cur.suit));
      refs.bigCard.classList.toggle("red", ["♥", "♦"].includes(cur.suit));
      refs.bigCard.classList.toggle("bust", shown.status === "BUST");
      refs.bigCard.classList.toggle("cashed", shown.status === "CASHED");
      refs.bigCard.classList.remove("empty");
    } else {
      refs.bigCard.replaceChildren(K.el("span", "hl-rank", "?"));
      refs.bigCard.className = "hl-card big empty";
    }
    if (live) {
      refs.mult.replaceChildren();
      K.withCoins(refs.mult, `×${live.multiplier} · [[${live.potential}]] on the table`);
      refs.phase.textContent = live.step ? `${live.step} right so far` : "Fresh deal";
      refs.phase.className = "cf-phase open";
    } else if (shown) {
      refs.mult.textContent = shown.status === "CASHED" ? `Cashed at ×${shown.multiplier}` : "Bust";
      refs.phase.textContent = shown.status === "CASHED" ? "Paid out" : "Busted";
      refs.phase.className = `cf-phase ${shown.status === "CASHED" ? "open" : "bad"}`;
    } else {
      refs.mult.textContent = "";
      refs.phase.textContent = "Ready to deal";
      refs.phase.className = "cf-phase";
    }

    // Controls
    const inRun = Boolean(live);
    refs.calls.hidden = !inRun;
    refs.cash.hidden = !inRun;
    refs.stakeRow.hidden = inRun;
    refs.deal.hidden = inRun;
    if (inRun) {
      const o = live.odds || {};
      const oddsSig = `${o.higher}|${o.lower}`;
      if (refs.oddsSig !== oddsSig) {
        refs.oddsSig = oddsSig;
        refs.higherBtn.replaceChildren(K.el("b", null, "Higher"), K.el("small", null, o.higher ? `×${o.higher}` : "—"));
        refs.lowerBtn.replaceChildren(K.el("b", null, "Lower"), K.el("small", null, o.lower ? `×${o.lower}` : "—"));
      }
      refs.higherBtn.disabled = busy || !o.higher;
      refs.lowerBtn.disabled = busy || !o.lower;
      refs.cash.disabled = busy || live.step < 1;
      K.withCoins(refs.cash, live.step < 1 ? "Cash out after one right call" : `Cash out [[${live.potential}]]`);
      refs.note.textContent = `Ties lose. Run ends at ×${config.maxMultiplier} or ${config.maxSteps} calls.`;
    } else {
      const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
      refs.deal.disabled = busy || !config.canBet || capped;
      if (!data.me) { K.plain(refs.deal, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
      else if (!config.canBet) { K.plain(refs.deal, "Casino paused"); refs.note.textContent = "ZCoin transfers aren't switched on right now."; }
      else if (capped) { K.withCoins(refs.deal, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.note.textContent = "The tables reopen for you as the hour rolls on."; }
      else { K.withCoins(refs.deal, `Deal for [[${stake}]]`); refs.note.textContent = "First card is free to look at; the stake rides on your calls."; }
    }
    const used = data.me?.gamesThisHour;
    K.withCoins(refs.limits, `Max stake [[${config.maxBet}]] · ${config.maxPerHour} runs an hour · winnings cap [[${config.hourCap}]] an hour` + (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));

    // Side column
    refs.youList.replaceChildren();
    if (data.me) {
      refs.youNote.textContent = `${data.me.wins}–${data.me.busts}`;
      const row = (k, v) => { const r = K.el("div", "hl-stat"); r.append(K.el("span", null, k)); const s = K.el("strong"); if (v instanceof Node) s.append(v); else s.textContent = v; r.append(s); return r; };
      refs.youList.append(row("Net", K.zc(data.me.net, { sign: true })), row("Best run", data.me.best ? `×${data.me.best}` : "—"), row("Cashed out", String(data.me.wins)), row("Busted", String(data.me.busts)));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(K.el("p", "cf-empty", "Log in to keep a record."));
    }
    refs.fairCard.hidden = !shown;
    if (shown) {
      refs.fair.hidden = false;
      refs.fairBody.textContent = shown.seed
        ? `deck hash  ${shown.hash}   (shown at the deal)\nseed       ${shown.seed}   (revealed when the run ended)\ncheck      sha256(seed) = hash · card i = 1 + (sha256(seed:i) mod 13)`
        : `deck hash  ${shown.hash}   (shown at the deal)\nseed       revealed when the run ends`;
    } else {
      refs.fair.hidden = true;
    }
    const room = data.room || [];
    refs.roomCount.textContent = String(room.length);
    refs.roomList.replaceChildren();
    if (!room.length) refs.roomList.append(K.el("p", "cf-empty", "Nobody logged in is here yet."));
    for (const u of room) {
      const chip = K.el("a", "cf-chipuser ulink");
      chip.href = `/u/${encodeURIComponent(u.login)}`;
      chip.append(K.avatar(u, "cf-av small"), document.createTextNode(u.displayName));
      refs.roomList.append(chip);
    }

    // Ledger
    refs.ledgerList.replaceChildren();
    refs.ledgerNote.textContent = data.ledger.length ? `${data.ledger.length} recent` : "";
    if (!data.ledger.length) refs.ledgerList.append(K.el("p", "cf-empty", "No runs finished yet."));
    const pg = K.pageOf(data.ledger, ledgerPage, 10);
    for (const e of pg.slice) {
      const row = K.el("div", `cf-row ${e.status === "CASHED" ? "won" : "lost"}${data.me && e.user.id === data.me.id ? " me" : ""}`);
      row.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      const sub = K.el("small");
      sub.append(document.createTextNode(`${e.steps} right · ×${e.multiplier} · `), K.zc(e.stake));
      who.append(sub);
      row.append(who);
      const res = K.el("span", `cf-res nums ${e.status === "CASHED" ? "up" : "down"}`);
      res.append(K.el("span", `cf-tag ${e.status === "CASHED" ? "win" : "loss"}`, e.status === "CASHED" ? "CASHED" : "BUST"), K.zc(e.profit, { sign: true }));
      row.append(res);
      refs.ledgerList.append(row);
    }
    refs.ledgerList.append(K.pager(pg, (n) => { ledgerPage = n; render(); }, "runs"));
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "Higher or Lower — EastCoin Casino";
      window.ECPresence?.beat("hilo");
      build();
      poll();
      pollTimer = window.setInterval(() => { if (!busy) poll(); }, POLL_MS);
    },
    unmount() {
      window.clearInterval(pollTimer);
      pollTimer = 0;
      data = null; refs = {}; lastLiveId = null;
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("hilo", view);
  }
  boot();
})();

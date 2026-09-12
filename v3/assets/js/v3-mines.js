/* ============================================================
   EastCoin V3 — Casino: Mines

     /?view=mines

   Twenty-five tiles, a few of them bombs, all placed from a seed
   the server committed before the first tile was touched. Every
   safe tile raises the multiplier; a bomb ends it. Cash out
   whenever you like.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 5000;
  let root = null;
  let refs = {};
  let data = null;
  let pollTimer = 0;
  let stake = 10;
  let mines = 3;
  let busy = false;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;

  const fmt = K.fmt;

  async function poll() {
    try {
      const payload = await fetch("/api/casino/mines/state", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "state");
      data = payload;
      if (data.live) mines = data.live.mines;
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  async function post(path, body) {
    return fetch(`/api/casino/mines/${path}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then((r) => r.json()).catch(() => null);
  }

  async function start() {
    if (busy || !data?.config?.canBet) return;
    busy = true; render();
    try {
      const payload = await post("start", { stake, mines });
      if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); return; }
      if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
      data.live = payload.game;
      refs.lastGame = null;
      toast(`${fmt(stake)} down, ${mines} bomb${mines === 1 ? "" : "s"} hidden. Pick a tile.`);
    } finally { busy = false; render(); }
  }

  async function pick(tile) {
    if (busy || !data?.live) return;
    if (data.live.picks.includes(tile)) return;
    busy = true; render();
    try {
      const wouldBe = data.live.next;   // what this tile was worth, if safe
      const payload = await post("pick", { id: data.live.id, tile });
      if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); await poll(); return; }
      const game = payload.game;
      data.live = game.status === "LIVE" ? game : null;
      refs.lastGame = game;

      if (payload.outcome === "bomb") {
        boom(tile);
        pop({ won: false, amount: game.stake, headline: "Bomb", detail: `${game.picks.length - 1} safe before it. Board's over.` });
        if (wouldBe && game.picks.length > 1) window.setTimeout(() => toast(`That tile would have made it ×${wouldBe}.`, "near"), 900);
        window.ECV3?.refreshSession?.();
        await poll();
      } else if (payload.autoCashed) {
        const headline = payload.cleared ? "Board cleared" : "Maxed out";
        pop({ won: true, big: true, amount: payload.payout - game.stake, headline, detail: `×${game.multiplier} — ${fmt(payload.payout)} back on ${fmt(game.stake)}.` });
        if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
        await poll();
      } else {
        toast(`Safe — ×${game.multiplier}, ${fmt(game.potential)} on the table.`);
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
      pop({ won: true, big: Number(payload.game.multiplier) >= 3, amount: payload.payout - payload.game.stake, headline: "Cashed out", detail: `×${payload.game.multiplier} — ${fmt(payload.payout)} back on ${fmt(payload.game.stake)}.` });
      data.live = null;
      refs.lastGame = payload.game;
      await poll();
    } finally { busy = false; render(); }
  }

  function boom(tile) {
    const cell = refs.cells?.[tile];
    if (!cell) return;
    cell.classList.remove("shake");
    void cell.offsetWidth;
    cell.classList.add("shake");
  }

  function build() {
    root.replaceChildren();
    refs = { cells: [] };
    const page = K.el("section", "coinflip casino-mines");

    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    copy.append(K.el("h1", null, "Mines"),
      K.el("p", null, "Twenty-five tiles, a few of them bombs, placed before you touch anything. Every safe tile pays more; one bomb takes the lot. Cash out whenever you like."));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage");
    refs.phase = K.el("div", "cf-phase", "");

    refs.board = K.el("div", "mn-board");
    for (let i = 0; i < 25; i += 1) {
      const cell = K.el("button", "mn-tile");
      cell.type = "button";
      cell.dataset.tile = String(i);
      cell.addEventListener("click", () => pick(i));
      refs.cells.push(cell);
      refs.board.append(cell);
    }
    refs.mult = K.el("div", "hl-mult nums", "");
    stage.append(refs.phase, refs.board, refs.mult);

    const bet = K.el("div", "cf-bet");
    refs.cash = K.btn("Cash out", "cf-lock hl-cash", cashOut);

    // Bomb count picker, only before a board starts.
    refs.minesRow = K.el("div", "mn-minesrow");
    refs.minesRow.append(K.el("span", "mn-label", "Bombs"));
    refs.mineBtns = [];
    for (const n of [1, 3, 5, 10]) {
      const b = K.btn(String(n), "mn-mine", () => { mines = n; render(); });
      b.dataset.mines = String(n);
      refs.mineBtns.push(b);
      refs.minesRow.append(b);
    }
    refs.minesHint = K.el("small", "mn-hint", "");
    refs.minesRow.append(refs.minesHint);

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

    refs.deal = K.btn("Start", "cf-lock", start);
    refs.note = K.el("p", "cf-note", "");
    refs.limits = K.el("p", "cf-limits", "");
    bet.append(refs.cash, refs.minesRow, stakeRow, refs.deal, refs.note, refs.limits);
    stage.append(bet);
    grid.append(stage);

    const col = K.el("div", "cf-side-col");

    const you = K.el("section", "cf-card");
    const yh = K.el("h2", null, "Your record");
    refs.youNote = K.el("small");
    yh.append(refs.youNote);
    refs.youList = K.el("div", "hl-stats");
    you.append(yh, refs.youList);

    const pays = K.el("section", "cf-card");
    const ph = K.el("h2", null, "What it pays");
    refs.paysNote = K.el("small");
    ph.append(refs.paysNote);
    refs.paysList = K.el("div", "mn-ladder");
    pays.append(ph, refs.paysList);

    const fair = K.el("section", "cf-card cf-card-verify");
    const verify = K.verifyBox("Verify this board");
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

    col.append(you, pays, fair, room);
    grid.append(col);
    page.append(grid);

    const ledger = K.el("section", "cf-card cf-ledger");
    const lgh = K.el("h2", null, "Recent boards");
    refs.ledgerNote = K.el("small");
    lgh.append(refs.ledgerNote);
    refs.ledgerList = K.el("div", "cf-list paged");
    ledger.append(lgh, refs.ledgerList);
    page.append(ledger);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function paintBoard(shown, live) {
    const picks = new Set(shown ? shown.picks : []);
    const bombs = new Set(shown?.bombs || []);
    const last = shown && shown.picks.length ? shown.picks[shown.picks.length - 1] : -1;
    refs.cells.forEach((cell, i) => {
      const safe = picks.has(i) && !bombs.has(i);
      const isBomb = bombs.has(i);
      cell.className = "mn-tile";
      cell.textContent = "";
      if (safe) { cell.classList.add("safe"); cell.textContent = "💎"; }
      if (isBomb) {
        cell.classList.add("bomb");
        // The one that ended it reads louder than the rest of the board.
        if (i === last) cell.classList.add("hit");
        cell.textContent = "💣";
      }
      if (!live) cell.classList.add("done");
      cell.disabled = busy || !live || picks.has(i);
    });
  }

  function render() {
    if (!data || !refs.board) return;
    const config = data.config;
    const live = data.live;
    const shown = live || refs.lastGame || null;
    const inRun = Boolean(live);

    refs.status.textContent = live ? `Board · ×${live.multiplier}` : "Ready";
    paintBoard(shown, inRun);

    if (live) {
      refs.mult.replaceChildren();
      K.withCoins(refs.mult, `×${live.multiplier} · [[${live.potential}]] on the table`);
      refs.phase.textContent = live.picks.length
        ? `${live.picks.length} safe · next tile ×${live.next ?? "—"}`
        : `${live.mines} bomb${live.mines === 1 ? "" : "s"} hidden — pick a tile`;
      refs.phase.className = "cf-phase open";
    } else if (shown) {
      refs.mult.textContent = shown.status === "CASHED" ? `Cashed at ×${shown.multiplier}` : "Hit a bomb";
      refs.phase.textContent = shown.status === "CASHED" ? "Paid out" : "Board's over";
      refs.phase.className = `cf-phase ${shown.status === "CASHED" ? "open" : "bad"}`;
    } else {
      refs.mult.textContent = "";
      refs.phase.textContent = "Ready to start";
      refs.phase.className = "cf-phase";
    }

    // Controls
    refs.cash.hidden = !inRun;
    refs.minesRow.hidden = inRun;
    refs.stakeRow.hidden = inRun;
    refs.deal.hidden = inRun;

    if (inRun) {
      refs.cash.disabled = busy || !live.canCashOut;
      K.withCoins(refs.cash, live.canCashOut ? `Cash out [[${live.potential}]]` : "Uncover a tile first");
      refs.note.textContent = live.next
        ? `One more safe tile makes it ×${live.next}. ${live.safeLeft} safe tile${live.safeLeft === 1 ? "" : "s"} left.`
        : "Every safe tile is uncovered.";
    } else {
      for (const b of refs.mineBtns) b.classList.toggle("on", Number(b.dataset.mines) === mines);
      const first = config.firstStep?.[mines];
      refs.minesHint.textContent = first ? `first tile ×${first}` : "";
      const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
      refs.deal.disabled = busy || !config.canBet || capped;
      if (!data.me) { K.plain(refs.deal, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
      else if (!config.canBet) { K.plain(refs.deal, "Casino paused"); refs.note.textContent = "ZCoin transfers aren't switched on right now."; }
      else if (capped) { K.withCoins(refs.deal, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.note.textContent = "The tables reopen for you as the hour rolls on."; }
      else {
        K.withCoins(refs.deal, `Start for [[${stake}]]`);
        refs.note.textContent = `${mines} bomb${mines === 1 ? "" : "s"} among 25 tiles. More bombs, bigger jumps, shorter life.`;
      }
    }
    const used = data.me?.gamesThisHour;
    K.withCoins(refs.limits, `Max stake [[${config.maxBet}]] · ${config.maxPerHour} boards an hour · winnings cap [[${config.hourCap}]] an hour` + (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));

    // Your record
    refs.youList.replaceChildren();
    if (data.me) {
      refs.youNote.textContent = `${data.me.wins}–${data.me.busts}`;
      const row = (k, v) => { const r = K.el("div", "hl-stat"); r.append(K.el("span", null, k)); const s = K.el("strong"); if (v instanceof Node) s.append(v); else s.textContent = v; r.append(s); return r; };
      refs.youList.append(row("Net", K.zc(data.me.net, { sign: true })), row("Best board", data.me.best ? `×${data.me.best}` : "—"), row("Cashed out", String(data.me.wins)), row("Blown up", String(data.me.busts)));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(K.el("p", "cf-empty", "Log in to keep a record."));
    }

    // The ladder for the board in play, or for whatever the picker is on.
    const shownMines = live ? live.mines : mines;
    const ladder = (data.ladders && data.ladders[shownMines]) || data.ladder || [];
    refs.paysNote.textContent = `${shownMines} bomb${shownMines === 1 ? "" : "s"}`;
    refs.paysList.replaceChildren();
    const at = live ? live.picks.length : 0;
    for (const step of ladder) {
      const r = K.el("div", `mn-rung${step.picks === at ? " at" : ""}${step.picks === at + 1 ? " next" : ""}`);
      r.append(K.el("span", null, `${step.picks} safe`), K.el("strong", null, `×${step.multiplier}`));
      refs.paysList.append(r);
    }

    // Fairness
    refs.fairCard.hidden = !shown;
    if (shown) {
      refs.fair.hidden = false;
      refs.fairBody.textContent = shown.seed
        ? `board hash  ${shown.hash}   (shown at the start)\nseed        ${shown.seed}   (revealed when the board ended)\nbombs       ${(shown.bombs || []).join(", ")}\ncheck       sha256(seed) = hash · bombs = first ${shown.mines} of 0..24 shuffled by sha256(seed:shuffle:i)`
        : `board hash  ${shown.hash}   (shown at the start)\nseed        revealed when the board ends`;
    } else {
      refs.fair.hidden = true;
    }

    // Room
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
    if (!data.ledger.length) refs.ledgerList.append(K.el("p", "cf-empty", "No boards finished yet."));
    const pg = K.pageOf(data.ledger, ledgerPage, 10);
    for (const e of pg.slice) {
      const row = K.el("div", `cf-row ${e.status === "CASHED" ? "won" : "lost"}${data.me && e.user.id === data.me.id ? " me" : ""}`);
      row.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      const sub = K.el("small");
      sub.append(document.createTextNode(`${e.picks} safe · ${e.mines} bomb${e.mines === 1 ? "" : "s"} · ×${e.multiplier} · `), K.zc(e.stake));
      who.append(sub);
      row.append(who);
      const res = K.el("span", `cf-res nums ${e.status === "CASHED" ? "up" : "down"}`);
      res.append(K.el("span", `cf-tag ${e.status === "CASHED" ? "win" : "loss"}`, e.status === "CASHED" ? "CASHED" : "BOOM"), K.zc(e.profit, { sign: true }));
      row.append(res);
      refs.ledgerList.append(row);
    }
    refs.ledgerList.append(K.pager(pg, (n) => { ledgerPage = n; render(); }, "boards"));
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "Mines — EastCoin Casino";
      window.ECPresence?.beat("mines");
      build();
      poll();
      pollTimer = window.setInterval(() => { if (!busy) poll(); }, POLL_MS);
    },
    unmount() {
      window.clearInterval(pollTimer);
      pollTimer = 0;
      data = null; refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("mines", view);
  }
  boot();
})();

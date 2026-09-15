/* ============================================================
   EastCoin V3 — Casino: Scratch-Off

     /?view=scratch

   Buy a card, rub the foil off, match three. The server decides the
   whole card from a seed whose hash it showed beforehand and pays it
   the moment it is bought; this page only reveals it. The foil is a
   canvas erased under the pointer; at 60% scratched the rest clears
   and the result pops. "Reveal all" skips the rubbing.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 6000;
  const BRUSH = 22;
  const DONE_AT = 0.6;
  const EMOJI = { crown: "👑", diamond: "💎", fire: "🔥", clover: "🍀", target: "🎯", football: "🏈", coin: "🪙" };
  let root = null;
  let refs = {};
  let data = null;
  let pollTimer = 0;
  let stake = 10;
  let busy = false;
  let card = null;            // the card under the foil, until it is fully revealed
  let scratching = false;
  let cleared = 0;
  let area = 1;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;

  const fmt = K.fmt;
  const sym = (k) => EMOJI[k] || "·";

  async function poll() {
    if (card) return;                     // never redraw with a card under the foil
    if (document.hidden) return;
    try {
      const payload = await fetch("/api/casino/scratch/state", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "state");
      data = payload;
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  async function buy() {
    if (busy || card || !data?.config?.canBet) return;
    busy = true; render();
    let payload = null;
    try {
      payload = await fetch("/api/casino/scratch/buy", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake })
      }).then((r) => r.json()).catch(() => null);
    } finally { busy = false; }

    if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); render(); await poll(); return; }

    // Already paid; what follows is the reveal.
    if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
    if (data) { data.nextHash = payload.nextHash; }
    card = payload.card;
    refs.pendingLast = payload.card;
    dealCard(card);
    render();
  }

  /* ---------------------------------------------------------- the card */

  function dealCard(c) {
    refs.cells.replaceChildren();
    for (const k of c.grid) {
      const cell = K.el("div", "sc-cell");
      cell.append(K.el("span", "sc-sym", sym(k)));
      const p = (data?.config?.prizes || []).find((x) => x.key === k);
      if (p) cell.append(K.el("small", null, `×${p.multiplier}`));
      refs.cells.append(cell);
    }
    refs.pop.className = "sc-pop";
    refs.pop.replaceChildren();
    refs.ticket.classList.remove("idle");
    refs.cardNo.textContent = `#${String(c.id).slice(-6)}`;
    refs.scratched.textContent = "0% scratched";
    paintFoil();
  }

  function paintFoil() {
    const foil = refs.foil;
    const rect = refs.grid.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    foil.width = Math.round(rect.width * dpr);
    foil.height = Math.round(rect.height * dpr);
    const ctx = foil.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    g.addColorStop(0, "#cdc6bb"); g.addColorStop(0.5, "#8f8880"); g.addColorStop(1, "#b9b1a6");
    ctx.fillStyle = g; ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "rgba(0,0,0,.16)";
    for (let i = 0; i < 300; i += 1) ctx.fillRect(Math.random() * rect.width, Math.random() * rect.height, 2, 2);
    ctx.fillStyle = "rgba(20,16,12,.7)"; ctx.textAlign = "center";
    ctx.font = "800 15px 'Bricolage Grotesque', sans-serif";
    ctx.fillText("SCRATCH HERE", rect.width / 2, rect.height / 2 - 6);
    ctx.font = "700 11px Figtree, sans-serif";
    ctx.fillText("match 3 to win", rect.width / 2, rect.height / 2 + 12);
    ctx.globalCompositeOperation = "destination-out";
    area = rect.width * rect.height; cleared = 0;
    foil.classList.remove("gone");
  }

  let lastPt = null;
  function scratchAt(x, y) {
    const ctx = refs.foil.getContext("2d");
    // A fast swipe fires few pointer events; joining them with a stroke
    // keeps the rub continuous instead of a row of dots.
    if (lastPt) {
      ctx.lineCap = "round"; ctx.lineWidth = BRUSH * 2;
      ctx.beginPath(); ctx.moveTo(lastPt[0], lastPt[1]); ctx.lineTo(x, y); ctx.stroke();
      cleared += Math.hypot(x - lastPt[0], y - lastPt[1]) * BRUSH * 2 * 0.6;
    }
    lastPt = [x, y];
    ctx.beginPath(); ctx.arc(x, y, BRUSH, 0, Math.PI * 2); ctx.fill();
    cleared += Math.PI * BRUSH * BRUSH * 0.35;
    const pct = Math.min(100, Math.round((100 * cleared) / area));
    refs.scratched.textContent = `${pct}% scratched`;
    if (pct >= DONE_AT * 100) finish();
  }

  function finish() {
    if (!card) return;
    const c = card;
    card = null;
    refs.foil.classList.add("gone");
    refs.scratched.textContent = "Scratched";
    if (c.prize) {
      [...refs.cells.children].forEach((cell) => { if (cell.firstChild.textContent === sym(c.prize)) cell.classList.add("win"); });
      refs.pop.className = "sc-pop show";
      refs.pop.append(K.el("b", null, `×${c.multiplier}`), K.el("span", null, `${sym(c.prize)}${sym(c.prize)}${sym(c.prize)} · ${fmt(c.payout)} ZC`));
      const top = Number(data?.config?.maxMultiplier || 0);
      pop({ won: true, big: c.multiplier >= 25 || c.profit >= 100, amount: c.profit, headline: `${c.prizeName} × 3`, detail: `×${c.multiplier} — ${fmt(c.payout)} back on ${fmt(c.stake)}.` });
      if (c.multiplier >= top) K.burst?.();
    } else {
      refs.pop.className = "sc-pop show lose";
      refs.pop.append(K.el("b", null, "No match"), K.el("span", null, `−${fmt(c.stake)} ZC`));
      // A pair of the big ones is a real near-miss: the grid never lies.
      const counts = {}; for (const k of c.grid) counts[k] = (counts[k] || 0) + 1;
      const near = ["crown", "diamond", "fire"].find((k) => counts[k] === 2);
      toast(near ? `Two ${sym(near)} — one short of ×${(data?.config?.prizes || []).find((p) => p.key === near)?.multiplier}!` : `No match — ${fmt(c.stake)} ZC gone.`, near ? "near" : true);
    }
    if (data) data.last = c;
    render();
    poll();
  }

  /* ---------------------------------------------------------- build */

  function build() {
    root.replaceChildren();
    refs = {};
    const page = K.el("section", "coinflip casino-scratch");

    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    copy.append(K.el("h1", null, "Scratch-Off"),
      K.el("p", null, "Buy a card and rub the foil off. Nine cells; three of a kind pays that symbol's price, from money back on coins to ×100 on crowns. Most cards that win pay small — that's the point."));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage");
    refs.phase = K.el("div", "cf-phase", "");

    const ticket = K.el("div", "sc-ticket idle");
    const top = K.el("div", "sc-top");
    refs.cardNo = K.el("span", null, "card");
    top.append(K.el("b", null, "EastCoin Scratch"), refs.cardNo);
    const gridBox = K.el("div", "sc-grid");
    refs.cells = K.el("div", "sc-cells");
    refs.foil = document.createElement("canvas");
    refs.foil.className = "sc-foil gone";
    refs.foil.setAttribute("aria-label", "Scratch here");
    refs.pop = K.el("div", "sc-pop");
    gridBox.append(refs.cells, refs.foil, refs.pop);
    refs.grid = gridBox;
    const foot = K.el("div", "sc-foot");
    refs.stakeLabel = K.el("b", null, "");
    refs.scratched = K.el("span", null, "");
    const fl = K.el("span"); fl.append(document.createTextNode("Match 3 · "), refs.stakeLabel);
    foot.append(fl, refs.scratched);
    ticket.append(top, gridBox, foot);
    refs.ticket = ticket;
    stage.append(refs.phase, ticket);

    const pos = (e) => { const r = refs.foil.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    refs.foil.addEventListener("pointerdown", (e) => { if (!card) return; scratching = true; lastPt = null; refs.foil.setPointerCapture(e.pointerId); scratchAt(...pos(e)); });
    refs.foil.addEventListener("pointermove", (e) => { if (!scratching || !card) return; scratchAt(...pos(e)); });
    refs.foil.addEventListener("pointerup", () => { scratching = false; lastPt = null; });
    refs.foil.addEventListener("pointercancel", () => { scratching = false; lastPt = null; });

    const bet = K.el("div", "cf-bet");
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

    refs.buy = K.btn("Buy a card", "cf-lock", buy);
    refs.reveal = K.btn("Reveal all", "cf-cash sc-reveal", finish);
    refs.note = K.el("p", "cf-note", "");
    refs.limits = K.el("p", "cf-limits", "");
    bet.append(stakeRow, refs.buy, refs.reveal, refs.note, refs.limits);
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
    const ph = K.el("h2", null, "Prizes");
    refs.paysNote = K.el("small", null, "match 3");
    ph.append(refs.paysNote);
    refs.paysList = K.el("div", "sc-prizes");
    pays.append(ph, refs.paysList);

    const fair = K.el("section", "cf-card cf-card-verify");
    const verify = K.verifyBox("Verify this card");
    refs.fair = verify.node;
    refs.fairBody = verify.body;
    fair.append(refs.fair);

    const room = K.el("section", "cf-card");
    const rh = K.el("h2", null, "At the counter");
    refs.roomCount = K.el("small");
    rh.append(refs.roomCount);
    refs.roomList = K.el("div", "cf-room");
    room.append(rh, refs.roomList);

    col.append(you, pays, fair, room);
    window.ECPot?.mount(col, { compact: true });
    grid.append(col);
    page.append(grid);

    const ledger = K.el("section", "cf-card cf-ledger");
    const lgh = K.el("h2", null, "Recent cards");
    refs.ledgerNote = K.el("small");
    lgh.append(refs.ledgerNote);
    refs.ledgerList = K.el("div", "cf-list paged");
    ledger.append(lgh, refs.ledgerList);
    page.append(ledger);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function render() {
    if (!data || !refs.ticket) return;
    const config = data.config;

    refs.status.textContent = card ? "Scratch it" : "Ready";
    refs.stakeLabel.textContent = `${stake} ZC`;
    const last = data.last;
    if (card) {
      refs.phase.textContent = "Rub the foil off";
      refs.phase.className = "cf-phase open";
    } else if (last) {
      refs.phase.textContent = last.prize ? `Last card ${last.prizeName} × 3 — ×${last.multiplier}, ${fmt(last.payout)} on ${fmt(last.stake)}` : `Last card no match — ${fmt(last.stake)} gone`;
      refs.phase.className = `cf-phase ${last.profit >= 0 ? "open" : "bad"}`;
    } else {
      refs.phase.textContent = "Ready when you are";
      refs.phase.className = "cf-phase";
    }

    // Controls
    const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
    refs.buy.disabled = busy || Boolean(card) || !config.canBet || capped;
    refs.buy.hidden = Boolean(card);
    refs.reveal.hidden = !card;
    refs.stakeRow.hidden = Boolean(card);
    if (!data.me) { K.plain(refs.buy, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
    else if (!config.canBet) { K.plain(refs.buy, "Casino paused"); refs.note.textContent = "ZCoin transfers aren't switched on right now."; }
    else if (capped) { K.withCoins(refs.buy, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.note.textContent = "The tables reopen for you as the hour rolls on."; }
    else if (card) { refs.note.textContent = "The card is already paid. Scratch to see it, or reveal it all at once."; }
    else {
      K.withCoins(refs.buy, `Buy a card for [[${stake}]]`);
      refs.note.textContent = `${config.winChance}% of cards win something. Three crowns pay ×${config.maxMultiplier}, once in a thousand.`;
    }
    const used = data.me?.cardsThisHour;
    K.withCoins(refs.limits, `Max stake [[${config.maxBet}]] · ${config.maxPerHour} cards an hour · winnings cap [[${config.hourCap}]] an hour` + (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));

    // Your record
    refs.youList.replaceChildren();
    if (data.me) {
      refs.youNote.textContent = `${data.me.wins}–${data.me.losses}`;
      const row = (k, v) => { const r = K.el("div", "hl-stat"); r.append(K.el("span", null, k)); const s = K.el("strong"); if (v instanceof Node) s.append(v); else s.textContent = v; r.append(s); return r; };
      refs.youList.append(row("Net", K.zc(data.me.net, { sign: true })), row("Best card", data.me.best ? `×${data.me.best}` : "—"), row("Cards", String(data.me.cards)));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(K.el("p", "cf-empty", "Log in to keep a record."));
    }

    // Prize table
    refs.paysList.replaceChildren();
    for (const p of config.prizes || []) {
      const r = K.el("div", `sc-prow${last && last.prize === p.key ? " at" : ""}`);
      const chance = p.chance >= 0.01 ? `${Math.round(p.chance * 100)}%` : `1 in ${Math.round(1 / p.chance).toLocaleString()}`;
      r.append(K.el("span", "sc-psym", `${sym(p.key)}${sym(p.key)}${sym(p.key)}`), K.el("span", "sc-pname", p.name), K.el("strong", null, `×${p.multiplier}`), K.el("small", null, chance));
      refs.paysList.append(r);
    }

    // Fairness: the NEXT card's hash, plus the last one revealed.
    refs.fair.hidden = false;
    refs.fairBody.textContent = [
      data.nextHash ? `next seed hash  ${data.nextHash}   (shown before you buy)` : "next seed hash  log in to be dealt one",
      last ? `last seed       ${last.seed}` : "last seed       none yet",
      last ? `last hash       ${last.hash}` : "",
      last ? `last card       ${last.grid.map(sym).join(" ")}  ->  ${last.prize ? `${last.prizeName} × 3, ×${last.multiplier}` : "no match"}` : "",
      "check           sha256(seed) = hash · outcome from sha256(seed:scratch) walked down the prize table · cells from sha256(seed:cell:i)"
    ].filter(Boolean).join("\n");
    K.verifyLink(refs.fair, last?.seed ? { game: "scratch", seed: last.seed, hash: last.hash } : null);

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
    if (!data.ledger.length) refs.ledgerList.append(K.el("p", "cf-empty", "No cards scratched yet."));
    const pg = K.pageOf(data.ledger, ledgerPage, 10);
    for (const e of pg.slice) {
      const won = e.profit > 0;
      const row = K.el("div", `cf-row ${won ? "won" : "lost"}${data.me && e.user.id === data.me.id ? " me" : ""}`);
      row.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      const sub = K.el("small");
      sub.append(document.createTextNode(`${e.prize ? `${sym(e.prize)} × 3 · ×${e.multiplier}` : "no match"} · `), K.zc(e.stake));
      who.append(sub);
      row.append(who);
      const res = K.el("span", `cf-res nums ${won ? "up" : "down"}`);
      res.append(K.el("span", `cf-tag ${won ? "win" : "loss"}`, e.prize ? `×${e.multiplier}` : "—"), K.zc(e.profit, { sign: true }));
      row.append(res);
      refs.ledgerList.append(row);
    }
    refs.ledgerList.append(K.pager(pg, (n) => { ledgerPage = n; render(); }, "cards"));
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "Scratch-Off — EastCoin Casino";
      window.ECPresence?.beat("scratch");
      build();
      poll();
      pollTimer = window.setInterval(() => { if (!busy && !card) poll(); }, POLL_MS);
      refs.onResize = () => { if (card) paintFoil(); };
      window.addEventListener("resize", refs.onResize);
    },
    unmount() {
      window.clearInterval(pollTimer);
      pollTimer = 0;
      if (refs.onResize) window.removeEventListener("resize", refs.onResize);
      data = null; refs = {}; card = null; scratching = false;
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("scratch", view);
  }
  boot();
})();

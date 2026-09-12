/* ============================================================
   EastCoin V3 — Casino: Plinko

     /?view=plinko

   Drop a ball through eight rows of pegs into one of nine buckets.
   The server decides the whole path from a seed whose hash it
   showed beforehand; this page only plays that path back, one row
   at a time, and lands the ball where the server already said.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 6000;
  const STEP_MS = 110;          // one peg row
  const BALL_TOP = 4;           // matches .pk-ball top in v3.css
  let root = null;
  let refs = {};
  let data = null;
  let pollTimer = 0;
  let stake = 10;
  let busy = false;
  let dropping = false;
  let toast = () => {};
  let pop = () => {};
  let ledgerPage = 1;

  const fmt = K.fmt;

  async function poll() {
    if (dropping) return;                 // never redraw mid-flight
    try {
      const payload = await fetch("/api/casino/plinko/state", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "state");
      data = payload;
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  async function drop() {
    if (busy || dropping || !data?.config?.canBet) return;
    busy = true; render();
    let payload = null;
    try {
      payload = await fetch("/api/casino/plinko/drop", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake })
      }).then((r) => r.json()).catch(() => null);
    } finally { busy = false; }

    if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); render(); await poll(); return; }

    // The result is already decided; the animation just shows it.
    await play(payload.drop);
    if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
    if (data) { data.last = payload.drop; data.nextHash = payload.nextHash; }

    const profit = payload.drop.profit;
    const top = Number(data?.config?.maxMultiplier || 0);
    if (profit > 0) {
      pop({ won: true, big: Number(payload.drop.multiplier) >= top, amount: profit, headline: `×${payload.drop.multiplier}`, detail: `${fmt(payload.drop.payout)} back on ${fmt(payload.drop.stake)}.` });
    } else {
      toast(`×${payload.drop.multiplier} — ${fmt(payload.drop.payout)} back on ${fmt(payload.drop.stake)}.`, profit < 0);
    }
    // The buckets beside the edges are one bounce from the top prize.
    const b = Number(payload.drop.bucket);
    if (b === 1 || b === 7) window.setTimeout(() => toast(`One peg from ×${top}!`, "near"), 1200);
    await poll();
  }

  /** Walks the ball down the path the server sent, one row at a time. */
  function play(drop) {
    return new Promise((resolve) => {
      const board = refs.board;
      if (!board) return resolve();
      dropping = true;
      render();

      const ball = refs.ball;
      const path = String(drop.path || "");
      const rows = data?.config?.rows || 8;
      let right = 0;

      // Measured, not read from the CSS: --pk-pitch is a clamp() and an
      // unregistered custom property hands back its raw text, so parsing
      // it gives NaN and the ball would fall back to a stale number while
      // the board sat at another size. The bucket row and a peg row are
      // laid out from the same pitch, so measuring them is exact.
      const across = measure(refs.buckets, "left") || 26;
      const down = board.querySelector(".pk-row")?.getBoundingClientRect().height || across;
      const place = (row, rights) => {
        // Centre of the row, shifted half a slot per step taken.
        const slot = rights - row / 2;
        ball.style.transform = `translate(${slot * across}px, ${row * down}px)`;
      };

      ball.hidden = false;
      ball.classList.remove("landed");
      place(0, 0);

      // The last hop is into the bucket itself, measured rather than
      // assumed: eight peg rows leave the ball a row short of the slots,
      // which reads as the ball stopping early.
      const intoBucket = () => {
        const top = refs.bucketRow?.getBoundingClientRect().top;
        const from = board.getBoundingClientRect().top + BALL_TOP;
        const slot = right - rows / 2;
        const y = Number.isFinite(top) ? top - from + 6 : rows * down;
        ball.classList.add("landed");
        ball.style.transform = `translate(${slot * across}px, ${y}px)`;
      };

      let i = 0;
      const step = () => {
        if (i >= rows) {
          intoBucket();
          highlight(drop.bucket);
          dropping = false;
          window.setTimeout(() => { render(); resolve(); }, 420);
          return;
        }
        if (path[i] === "R") right += 1;
        i += 1;
        place(i, right);
        window.setTimeout(step, STEP_MS);
      };
      window.setTimeout(step, 60);
    });
  }

  /** Distance between the first two of a row of elements, or 0. */
  function measure(nodes, edge) {
    if (!nodes || nodes.length < 2) return 0;
    const a = nodes[0].getBoundingClientRect()[edge];
    const b = nodes[1].getBoundingClientRect()[edge];
    return Math.abs(b - a);
  }

  function highlight(bucket) {
    (refs.buckets || []).forEach((b, i) => b.classList.toggle("hit", i === bucket));
  }

  function build() {
    root.replaceChildren();
    refs = { buckets: [] };
    const page = K.el("section", "coinflip casino-plinko");

    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    copy.append(K.el("h1", null, "Plinko"),
      K.el("p", null, "Drop a ball through the pegs. It bounces left or right at each one and pays whatever bucket it lands in. Every bucket but the middle one pays more than you put in; the edges pay most."));
    head.append(copy);
    const right = K.el("div", "cas-headright");
    refs.status = K.el("span", "cf-status", "Connecting…");
    right.append(refs.status, K.casinoLink());
    head.append(right);
    page.append(head);

    const grid = K.el("div", "cf-grid");
    const stage = K.el("section", "cf-stage");
    refs.phase = K.el("div", "cf-phase", "");

    // The pegs, then the buckets under them.
    const board = K.el("div", "pk-board");
    const pegs = K.el("div", "pk-pegs");
    for (let row = 0; row < 8; row += 1) {
      const line = K.el("div", "pk-row");
      for (let i = 0; i <= row + 1; i += 1) line.append(K.el("i", "pk-peg"));
      pegs.append(line);
    }
    refs.ball = K.el("div", "pk-ball");
    refs.ball.hidden = true;
    board.append(pegs, refs.ball);
    refs.board = board;

    const buckets = K.el("div", "pk-buckets");
    refs.bucketRow = buckets;
    stage.append(refs.phase, board, buckets);

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

    refs.drop = K.btn("Drop", "cf-lock", drop);
    refs.note = K.el("p", "cf-note", "");
    refs.limits = K.el("p", "cf-limits", "");
    bet.append(stakeRow, refs.drop, refs.note, refs.limits);
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
    refs.paysNote = K.el("small", null, "per drop");
    ph.append(refs.paysNote);
    refs.paysList = K.el("div", "mn-ladder");
    pays.append(ph, refs.paysList);

    const fair = K.el("section", "cf-card cf-card-verify");
    const verify = K.verifyBox("Verify this drop");
    refs.fair = verify.node;
    refs.fairBody = verify.body;
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
    const lgh = K.el("h2", null, "Recent drops");
    refs.ledgerNote = K.el("small");
    lgh.append(refs.ledgerNote);
    refs.ledgerList = K.el("div", "cf-list paged");
    ledger.append(lgh, refs.ledgerList);
    page.append(ledger);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function paintBuckets(payouts) {
    if (refs.paintedBuckets) return;
    refs.paintedBuckets = true;
    refs.bucketRow.replaceChildren();
    refs.buckets = payouts.map((m) => {
      const b = K.el("div", `pk-bucket${m >= 6 ? " big" : m >= 1.4 ? " mid" : ""}`, `×${m}`);
      refs.bucketRow.append(b);
      return b;
    });
  }

  function render() {
    if (!data || !refs.board) return;
    const config = data.config;
    paintBuckets(config.payouts);

    refs.status.textContent = dropping ? "Dropping…" : "Ready";
    const last = data.last;
    if (dropping) {
      refs.phase.textContent = "Watch it fall";
      refs.phase.className = "cf-phase open";
    } else if (last) {
      refs.phase.textContent = `Last drop ×${last.multiplier} — ${fmt(last.payout)} on ${fmt(last.stake)}`;
      refs.phase.className = `cf-phase ${last.profit >= 0 ? "open" : "bad"}`;
    } else {
      refs.phase.textContent = "Ready to drop";
      refs.phase.className = "cf-phase";
    }

    // Controls
    const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
    refs.drop.disabled = busy || dropping || !config.canBet || capped;
    refs.stakeRow.hidden = false;
    if (!data.me) { K.plain(refs.drop, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
    else if (!config.canBet) { K.plain(refs.drop, "Casino paused"); refs.note.textContent = "ZCoin transfers aren't switched on right now."; }
    else if (capped) { K.withCoins(refs.drop, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.note.textContent = "The tables reopen for you as the hour rolls on."; }
    else {
      K.withCoins(refs.drop, `Drop for [[${stake}]]`);
      refs.note.textContent = `Every bucket but the middle pays. The ×${config.maxMultiplier} edges land about once in 128 drops.`;
    }
    const used = data.me?.dropsThisHour;
    K.withCoins(refs.limits, `Max stake [[${config.maxBet}]] · ${config.maxPerHour} drops an hour · winnings cap [[${config.hourCap}]] an hour` + (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));

    // Your record
    refs.youList.replaceChildren();
    if (data.me) {
      refs.youNote.textContent = `${data.me.wins}–${data.me.losses}`;
      const row = (k, v) => { const r = K.el("div", "hl-stat"); r.append(K.el("span", null, k)); const s = K.el("strong"); if (v instanceof Node) s.append(v); else s.textContent = v; r.append(s); return r; };
      refs.youList.append(row("Net", K.zc(data.me.net, { sign: true })), row("Best bucket", data.me.best ? `×${data.me.best}` : "—"), row("Drops", String(data.me.drops)));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(K.el("p", "cf-empty", "Log in to keep a record."));
    }

    // Odds table
    refs.paysList.replaceChildren();
    for (const o of config.odds || []) {
      const r = K.el("div", `mn-rung${last && last.bucket === o.bucket ? " at" : ""}`);
      const chance = o.chance >= 0.01 ? `${Math.round(o.chance * 100)}%` : `1 in ${Math.round(1 / o.chance)}`;
      r.append(K.el("span", null, chance), K.el("strong", null, `×${o.multiplier}`));
      refs.paysList.append(r);
    }

    // Fairness: the hash of the NEXT drop's seed, plus the last one revealed.
    refs.fair.hidden = false;
    refs.fairBody.textContent = [
      data.nextHash ? `next seed hash  ${data.nextHash}   (shown before you drop)` : "next seed hash  log in to be dealt one",
      last ? `last seed       ${last.seed}` : "last seed       none yet",
      last ? `last hash       ${last.hash}` : "",
      last ? `last path       ${last.path}  ->  bucket ${last.bucket}  ×${last.multiplier}` : "",
      "check           sha256(seed) = hash · step i goes right when sha256(seed:i) is odd"
    ].filter(Boolean).join("\n");

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
    if (!data.ledger.length) refs.ledgerList.append(K.el("p", "cf-empty", "No drops yet."));
    const pg = K.pageOf(data.ledger, ledgerPage, 10);
    for (const e of pg.slice) {
      const won = e.profit > 0;
      const row = K.el("div", `cf-row ${won ? "won" : "lost"}${data.me && e.user.id === data.me.id ? " me" : ""}`);
      row.append(K.avatar(e.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(e.user));
      const sub = K.el("small");
      sub.append(document.createTextNode(`×${e.multiplier} · `), K.zc(e.stake));
      who.append(sub);
      row.append(who);
      const res = K.el("span", `cf-res nums ${won ? "up" : "down"}`);
      res.append(K.el("span", `cf-tag ${won ? "win" : "loss"}`, `×${e.multiplier}`), K.zc(e.profit, { sign: true }));
      row.append(res);
      refs.ledgerList.append(row);
    }
    refs.ledgerList.append(K.pager(pg, (n) => { ledgerPage = n; render(); }, "drops"));
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "Plinko — EastCoin Casino";
      window.ECPresence?.beat("plinko");
      build();
      poll();
      pollTimer = window.setInterval(() => { if (!busy && !dropping) poll(); }, POLL_MS);
    },
    unmount() {
      window.clearInterval(pollTimer);
      pollTimer = 0;
      data = null; refs = {}; dropping = false;
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("plinko", view);
  }
  boot();
})();

/* ============================================================
   EastCoin V3 — Casino: the player-versus-player tables

     /?view=roulette    Russian Roulette
     /?view=standing    Last One Standing

   One file, two games, because they are the same shape: a lobby
   that the first person to sit down opens, a clock, and a result the
   server has already settled that this page only plays back. The
   buy-in is fixed at 20, so there is nothing to choose but whether
   to sit.

   The page never decides anything. The result arrives settled, paid,
   with its seed revealed; the animation is theatre, and closing the
   tab during it changes nothing about who got paid.

   Layout (2026-09-16, night): the board and "At the table" share the first
   screen — the board is the game, the panel beside it is who is in,
   the pot, the clock and the one button. Everything that is reference
   (this hour, what it pays, the seed, the Jackpot) folds shut below.
   A finished table stays on the board for HOLD_MS and then clears, so
   nobody arrives to a result from hours ago. On Roulette the board is
   a ring of seats round a big cylinder, and an open seat is a button.
   (A revolver in the middle with skins was tried and held back; that
   version is kept in mockups-archive/.)
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const LOBBY_POLL = 2500;      // while a clock is running
  const IDLE_POLL = 6000;       // nothing open
  const HOLD_MS = 2600;         // a finished table stays up this long, then the board clears
  const STALE_MS = 45000;       // a table that finished longer ago than this is not replayed
  const WATCHERS_SHOWN = 14;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = K.fmt;

  /* --------------------------------------------------- one table */

  function table(spec) {
    let root = null;
    let refs = {};
    let data = null;
    let pollTimer = 0;
    let tickTimer = 0;
    let busy = false;
    let playing = false;
    let offset = 0;                 // server clock minus ours
    let shownRoundId = null;        // the last finished round drawn
    let ledgerPage = 1;
    let toast = () => {};
    let pop = () => {};
    let polledPastZero = false;     // one immediate poll when the clock ends
    let onVis = null;               // polls the moment the tab comes back
    let holdUntil = 0;              // the finished table is on the board until then
    let holdTimer = 0;
    let arenaSig = "";              // what the arena is drawing; unchanged means leave it alone
    let seatedSig = "";
    let watchSig = "";

    const serverNow = () => Date.now() + offset;
    const myLogin = () => String(data?.me?.login || "");

    async function poll() {
      if (playing || document.hidden) return;
      try {
        const payload = await fetch(`/api/casino/pvp/state?game=${spec.key}`, { credentials: "include" }).then((r) => r.json());
        if (!payload?.ok) throw new Error(payload?.code || "state");
        offset = payload.now - Date.now();
        data = payload;
        if (data.lobby) polledPastZero = false;
        schedule();
        await maybePlayback();
        render();
      } catch (error) {
        console.warn(`pvp ${spec.key}:`, error);
        if (refs.status) refs.status.textContent = "Reconnecting…";
      }
    }

    // Faster while a clock is running, so the start is not missed by
    // long; slower when the table is empty.
    function schedule() {
      window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => { if (!busy) poll(); }, data?.lobby ? LOBBY_POLL : IDLE_POLL);
    }

    /** Keep the finished table on the board for ms, then clear it. */
    function holdFor(ms) {
      holdUntil = Date.now() + Math.max(0, ms);
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => { holdUntil = 0; render(); }, Math.max(0, ms) + 20);
    }

    /** A round that finished since we last looked gets played back — if it is recent. */
    async function maybePlayback() {
      const last = data?.last;
      // An empty table with no history still counts as seen, so the first
      // round it ever plays is played back rather than shown settled.
      if (!last) { if (shownRoundId === null) shownRoundId = "none"; return; }
      const age = serverNow() - Number(last.settledAt || 0);
      if (shownRoundId === null) {
        // First paint: never replay, and only show the result if it is
        // still inside its hold — otherwise the board opens empty.
        shownRoundId = last.id;
        if (last.status === "SETTLED" && age < HOLD_MS) holdFor(HOLD_MS - age);
        return;
      }
      if (last.id === shownRoundId) return;
      shownRoundId = last.id;
      const mine = last.players.find((p) => p.login === myLogin());
      if (last.status !== "SETTLED") {
        if (mine && age < STALE_MS) toast("Only one at the table — buy-ins returned.", "near");
        return;
      }
      // The tab was away while it played: say what happened to you, but
      // don't sit everyone through a table that is long over.
      if (age > STALE_MS) {
        if (mine) {
          const won = mine.payout > last.stake;
          toast(won ? `While you were away you won a table: ${fmt(mine.payout)} ZC.` : `A table you were in played while you were away. ${fmt(last.stake)} ZC gone.`, !won);
        }
        return;
      }
      playing = true;
      try {
        render();                   // the side panel gets the seats before anything moves
        await spec.animate(last, refs, { wait, me: myLogin() });
        // The animation ends on exactly what the settled draw would show,
        // so the hold keeps that drawing rather than rebuilding it.
        arenaSig = `hold:${last.id}`;
        announce(last);
      } finally {
        playing = false;
        holdFor(HOLD_MS);
      }
    }

    function announce(round) {
      const me = myLogin();
      const mine = round.players.find((p) => p.login === me);
      if (!mine) return;
      const profit = mine.payout - round.stake;
      if (profit > 0) {
        pop({ won: true, big: profit >= 30, amount: profit, headline: spec.wonHeadline(round, mine), detail: `${fmt(mine.payout)} back on ${fmt(round.stake)}.` });
      } else {
        toast(spec.lostLine(round, mine), true);
      }
    }

    async function join() {
      if (busy || playing || !data?.config?.canBet) return;
      busy = true; render();
      try {
        const payload = await fetch("/api/casino/pvp/join", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: spec.key })
        }).then((r) => r.json()).catch(() => null);
        if (!payload?.ok) { toast(payload?.message || "That didn't go through.", true); return; }
        if (payload.balance != null) window.ECV3?.setWallet?.(payload.balance);
        data.lobby = payload.lobby;
        polledPastZero = false;
        schedule();
        toast(`You're in for ${fmt(data.config.stake)}. ${spec.joinedLine}`);
      } finally { busy = false; render(); }
    }

    /* ----------------------------------------------------- build */

    function build() {
      root.replaceChildren();
      refs = {};
      arenaSig = seatedSig = watchSig = "";
      const page = K.el("section", `coinflip casino-pvp casino-${spec.key}`);

      const head = K.el("div", "viewhead");
      const copy = K.el("div");
      const h1 = K.el("h1", null, spec.title);
      if (spec.iconUrl) {
        const img = document.createElement("img");
        img.className = "pv-title-img";
        img.src = spec.iconUrl;
        img.alt = "";
        img.decoding = "async";
        h1.append(img);
      }
      copy.append(h1, K.el("p", null, spec.blurb));
      head.append(copy);
      const right = K.el("div", "cas-headright");
      refs.status = K.el("span", "cf-status", "Connecting…");
      right.append(refs.status, K.casinoLink());
      head.append(right);
      page.append(head);

      // The first screen: the board, and who is at the table.
      const main = K.el("div", "pv-main");
      const board = K.el("section", "pv-board");
      const hud = K.el("div", "pv-hud");
      refs.phase = K.el("div", "cf-phase", "");
      refs.phase.setAttribute("aria-live", "polite");
      refs.count = K.el("div", "pv-count", "");
      refs.count.hidden = true;
      hud.append(refs.phase, refs.count);
      refs.arena = K.el("div", `pv-arena ${spec.key}`);
      board.append(hud, refs.arena);

      const side = K.el("aside", "pv-side");
      const sh = K.el("div", "pv-side-h");
      refs.seatCount = K.el("span", "pv-seatcount", "");
      sh.append(K.el("h2", null, "At the table"), refs.seatCount);
      const pot = K.el("div", "pv-pot");
      refs.pot = K.el("div", "pv-pot-amt");
      refs.potNote = K.el("div", "pv-pot-note");
      pot.append(refs.pot, refs.potNote);
      refs.clock = K.el("div", "pv-clock");
      refs.clockFill = K.el("i");
      refs.clock.append(refs.clockFill);
      refs.clock.hidden = true;
      refs.join = K.btn("Join", "cf-lock pv-join", join);
      refs.note = K.el("p", "cf-note pv-note", "");
      refs.seated = K.el("div", "pv-seated");
      const watch = K.el("div", "pv-watch");
      refs.watchHead = K.el("h3", null, "Watching");
      refs.watchList = K.el("div", "pv-watchlist");
      watch.append(refs.watchHead, refs.watchList);
      refs.limits = K.el("p", "cf-limits pv-limits", "");
      side.append(sh, pot, refs.clock, refs.join, refs.note, refs.seated, watch, refs.limits);
      main.append(board, side);
      page.append(main);

      // Below the fold: reference, shut until someone opens it.
      const folds = K.el("div", "pv-folds");
      const fold = (title) => {
        const d = K.el("details", "pv-fold");
        const s = K.el("summary");
        const v = K.el("span", "pv-fold-v", "");
        s.append(K.el("span", "pv-fold-t", title), v);
        const body = K.el("div", "pv-fold-b");
        d.append(s, body);
        folds.append(d);
        return { d, v, body };
      };
      const hour = fold("This hour");
      refs.hourSum = hour.v;
      refs.hourList = K.el("div", "hl-stats");
      hour.body.append(refs.hourList);

      const pays = fold(spec.paysTitle);
      refs.paysSum = pays.v;
      refs.paysList = K.el("div", "mn-ladder");
      pays.body.append(K.el("p", "pv-fold-note", "By table size. The buy-in is always 20 and the house takes nothing."), refs.paysList);

      const fair = fold("Verify this round");
      refs.fairSum = fair.v;
      refs.fair = fair.body;
      refs.fairBody = K.el("pre", "cf-verify-body", "");
      fair.body.append(refs.fairBody);

      const jack = fold("Daily Jackpot");
      if (window.ECPot) {
        // The amount rides the summary; the full card mounts the first
        // time the fold is opened, so a shut fold costs one poll, not two.
        window.ECPot.mount(jack.v, { pill: true });
        jack.d.addEventListener("toggle", () => {
          if (jack.d.open && !jack.body.childElementCount) window.ECPot.mount(jack.body, { compact: true });
        });
      } else {
        jack.v.textContent = "on the floor";
        jack.body.append(K.el("p", "cf-empty", "The Jackpot shows on the casino floor."));
      }
      page.append(folds);

      // Recent tables: a fold like the others, shut until opened.
      const ledger = K.el("details", "pv-fold pv-ledger");
      const lgh = K.el("summary");
      refs.ledgerNote = K.el("span", "pv-fold-v", "");
      lgh.append(K.el("span", "pv-fold-t", "Recent tables"), refs.ledgerNote);
      refs.ledgerList = K.el("div", "cf-list paged");
      const lgb = K.el("div", "pv-fold-b");
      lgb.append(refs.ledgerList);
      ledger.append(lgh, lgb);
      page.append(ledger);

      pop = K.makePop(page);
      toast = K.makeToast(page);
      root.append(page);
    }

    /* ---------------------------------------------------- render */

    function drawArena(sig, draw) {
      if (sig === arenaSig) return;
      arenaSig = sig;
      draw();
    }

    function render() {
      if (!data || !refs.arena) return;
      const config = data.config;
      const lobby = data.lobby;
      const last = data.last;
      const me = myLogin();
      const holding = !playing && Date.now() < holdUntil && last?.status === "SETTLED";
      const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
      const full = lobby && lobby.players.length >= config.maxPlayers;
      const canSit = Boolean(data.me && config.canBet && !config.paused && !capped && !busy && !playing && !lobby?.youIn && !full);

      refs.status.textContent = playing ? "Playing…" : holding ? "Table over" : lobby ? "Lobby open" : config.paused ? "Closed" : "Ready";

      // The board
      if (!playing) {
        if (holding) {
          const won = last.players.find((p) => p.login === me)?.payout > last.stake;
          refs.phase.textContent = spec.resultLine(last, me);
          refs.phase.className = `cf-phase ${won ? "open" : "done"}`;
          drawArena(`hold:${last.id}`, () => spec.drawSeats(last.players, refs.arena, { id: last.id, me, result: last.result, settled: true }));
        } else if (lobby) {
          refs.phase.textContent = lobby.youIn ? "You're in — waiting for the clock" : `${lobby.players.length} seated — starts in`;
          refs.phase.className = "cf-phase open";
          drawArena(`lobby:${lobby.id}:${lobby.players.map((p) => p.login).join(",")}:${canSit}`,
            () => spec.drawSeats(lobby.players, refs.arena, { id: lobby.id, me, lobby: true, canSit, onSit: join, stake: config.stake }));
        } else {
          refs.phase.textContent = config.paused ? "Closed for now" : "Table's empty";
          refs.phase.className = "cf-phase";
          drawArena(`idle:${canSit}:${Boolean(config.paused)}`, () => spec.drawSeats([], refs.arena, { me, canSit, onSit: join, stake: config.stake }));
        }
      }
      tick();

      // The button
      refs.join.disabled = busy || playing || !config.canBet || capped || Boolean(lobby?.youIn) || Boolean(full) || Boolean(config.paused);
      if (playing) { K.plain(refs.join, "Playing…"); refs.note.textContent = "The table is playing out. The next one opens the moment it's done."; }
      else if (config.paused) { K.plain(refs.join, "Closed for now"); refs.note.textContent = "This table is off the floor while it's being worked on. Try it on the practice page at eastcoin.vip/pvp-test — no ZCoins change hands there."; }
      else if (!data.me) { K.plain(refs.join, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
      else if (!config.canBet) { K.plain(refs.join, "Casino paused"); refs.note.textContent = "ZCoin transfers aren't switched on right now."; }
      else if (capped) { K.withCoins(refs.join, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.note.textContent = "The tables reopen for you as the hour rolls on."; }
      else if (lobby?.youIn) { K.plain(refs.join, "You're in"); refs.note.textContent = spec.waitingLine(lobby); }
      else if (full) { K.plain(refs.join, "Table's full"); refs.note.textContent = `${config.maxPlayers} is the most that fit. The next table opens when this one plays.`; }
      else if (lobby) { K.withCoins(refs.join, `Join for [[${config.stake}]]`); refs.note.textContent = spec.openLine(lobby); }
      else { K.withCoins(refs.join, `Sit down for [[${config.stake}]]`); refs.note.textContent = `You open the table. The clock starts at ${config.lobbySeconds} seconds and whoever's in when it hits zero plays.`; }
      const used = data.me?.joinsThisHour;
      K.withCoins(refs.limits, `Buy-in always [[${config.stake}]] · ${config.maxPerHour} tables an hour · winnings cap [[${config.hourCap}]] an hour` + (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));

      // At the table: the lobby, or the table that is playing or just played.
      const afterPlay = playing || holding;
      const shown = afterPlay ? (last?.players || []) : (lobby?.players || []);
      const n = shown.length;
      refs.seatCount.textContent = afterPlay ? `${n} played` : `${n} of ${config.maxPlayers} seats`;
      refs.pot.replaceChildren(K.zc(afterPlay ? last.pot : lobby ? lobby.pot : config.stake));
      if (holding) {
        const w = last.players.find((p) => p.status === "WON");
        refs.potNote.textContent = w ? `taken by ${w.login === me ? "you" : w.displayName}` : "paid";
      } else if (playing) refs.potNote.textContent = "on the table — last one standing takes it";
      else if (lobby?.youIn) refs.potNote.textContent = `in the pot · you're 1 in ${n}`;
      else if (lobby) refs.potNote.textContent = `in the pot · sit and it's ${fmt(lobby.pot + config.stake)}`;
      else refs.potNote.textContent = "to sit · the last one standing takes every buy-in";

      const sSig = `${afterPlay ? (holding ? "h" : "p") : "l"}:${shown.map((p) => `${p.login}/${p.status}`).join(",")}:${me}`;
      if (sSig !== seatedSig) {
        seatedSig = sSig;
        refs.seated.replaceChildren();
        if (!n) {
          refs.seated.append(K.el("p", "cf-empty", config.paused ? "Nobody can sit while the table is closed." : "No one yet."));
        }
        for (const p of shown) {
          const mineRow = p.login === me;
          const rowNode = K.el("div", `pv-seat-row${mineRow ? " me" : ""}${holding && p.status === "WON" ? " won" : ""}${holding && p.status === "LOST" ? " out" : ""}`);
          const name = K.el("div", "pv-seat-name");
          name.append(mineRow ? K.el("b", null, "You") : K.nameLink(p));
          let r;
          if (holding && p.status === "WON") { r = K.el("span", "pv-seat-r won"); r.append(K.zc(p.payout - last.stake, { sign: true })); }
          else if (holding) r = K.el("span", "pv-seat-r out", "Out");
          else r = K.el("span", "pv-seat-r", playing ? "" : `1 in ${n}`);
          rowNode.append(K.avatar(p, "cf-av"), name, r);
          refs.seated.append(rowNode);
        }
      }

      // Watching: here, but not sitting.
      const seatedLogins = new Set(shown.map((p) => p.login));
      const watching = (data.room || []).filter((u) => !seatedLogins.has(u.login));
      const wSig = watching.map((u) => u.login).join(",");
      if (wSig !== watchSig) {
        watchSig = wSig;
        refs.watchHead.textContent = watching.length ? `Watching · ${watching.length}` : "Watching";
        refs.watchList.replaceChildren();
        if (!watching.length) refs.watchList.append(K.el("span", "pv-watchmore", "Nobody else is watching."));
        for (const u of watching.slice(0, WATCHERS_SHOWN)) {
          const a = K.el("a", "pv-watcher ulink");
          a.href = `/u/${encodeURIComponent(u.login)}`;
          a.title = u.displayName || u.login;
          a.append(K.avatar(u, "cf-av"));
          refs.watchList.append(a);
        }
        if (watching.length > WATCHERS_SHOWN) refs.watchList.append(K.el("span", "pv-watchmore", `+${watching.length - WATCHERS_SHOWN}`));
      }

      // This hour
      refs.hourList.replaceChildren();
      const row = (k, v) => { const r = K.el("div", "hl-stat"); r.append(K.el("span", null, k)); const s = K.el("strong"); if (v instanceof Node) s.append(v); else s.textContent = v; r.append(s); return r; };
      if (data.me) {
        refs.hourSum.textContent = `${data.me.joinsThisHour} of ${config.maxPerHour} tables`;
        refs.hourList.append(row("Tables", `${data.me.joinsThisHour} of ${config.maxPerHour}`), row("Casino net", K.zc(data.me.hourNet, { sign: true })), row("Cap", K.zc(config.hourCap)));
      } else {
        refs.hourSum.textContent = "Log in";
        refs.hourList.append(K.el("p", "cf-empty", "Log in to keep a record."));
      }

      // What it pays
      const at = lobby ? lobby.players.length : last?.players.length;
      refs.paysSum.textContent = lobby && lobby.players.length >= 2 ? `${fmt(lobby.pot)} ZC at ${lobby.players.length} seats` : `${config.stake} × seats`;
      refs.paysList.replaceChildren();
      for (const t of config.table || []) {
        const r = K.el("div", `mn-rung${t.players === at ? " at" : ""}`);
        r.append(K.el("span", null, `${t.players} players`), K.el("strong", null, spec.payCell(t)));
        refs.paysList.append(r);
      }

      // Fairness
      const hash = lobby?.hash || last?.hash || "";
      refs.fairSum.textContent = hash ? `${hash.slice(0, 8)}…` : "";
      const lines = [];
      if (lobby) lines.push(`this table's hash  ${lobby.hash}   (the seed is revealed when it plays)`);
      if (last) {
        lines.push(`last seed          ${last.seed || "—"}`);
        lines.push(`last hash          ${last.hash}`);
        if (last.result) lines.push(`last result        ${spec.verifyLine(last)}`);
      }
      lines.push(`check              sha256(seed) = hash · ${spec.verifyRule}`);
      refs.fairBody.textContent = lines.join("\n");
      // Only a round that played has a result to check; a refunded table
      // of one has a seed but nothing it decided.
      K.verifyLink(refs.fair, last?.seed && last.status === "SETTLED" ? { game: spec.key, seed: last.seed, hash: last.hash, players: last.players.length } : null);

      // Ledger
      const items = data.history || [];
      const pg = K.pageOf(items, ledgerPage, 8);
      refs.ledgerNote.textContent = items.length ? `${items.length} table${items.length === 1 ? "" : "s"}` : "";
      refs.ledgerList.replaceChildren();
      if (!items.length) refs.ledgerList.append(K.el("p", "cf-empty", "No tables have played yet."));
      for (const h of pg.slice) {
        // The same row every other ledger uses: a face, then a name line
        // with a small line under it. The name line here is a sentence.
        const seats = h.seats || [];
        const mine = seats.some((s) => s.login === me);
        const line = K.el("div", `cf-row pv${mine ? " me" : ""}`);
        const face = spec.ledgerFace(h) || seats[0];
        if (face) line.append(K.avatar(face, "cf-av"));
        const who = K.el("div", "cf-who");
        who.append(h.status === "VOID" ? document.createTextNode("Only one at the table — refunded") : spec.sentence(h));
        const sub = K.el("small", null, `${h.players} player${h.players === 1 ? "" : "s"} · ${h.at ? new Date(h.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`);
        who.append(sub);
        line.append(who);
        refs.ledgerList.append(line);
      }
      refs.ledgerList.append(K.pager(pg, (p) => { ledgerPage = p; render(); }, "tables"));
    }

    /** The countdown and its bar, off the server clock, four times a second. */
    function tick() {
      if (!refs.count) return;
      const lobby = data?.lobby;
      if (!lobby || playing) { refs.count.hidden = true; refs.clock.hidden = true; return; }
      const leftMs = Math.max(0, lobby.startsAt - serverNow());
      const left = leftMs / 1000;
      refs.count.hidden = false;
      refs.count.textContent = left > 0 ? `${Math.ceil(left)}s` : "Starting…";
      refs.count.classList.toggle("soon", left > 0 && left <= 5);
      const total = Math.max(1000, lobby.startsAt - (lobby.opensAt || lobby.startsAt - (data.config.lobbySeconds || 30) * 1000));
      refs.clock.hidden = false;
      refs.clockFill.style.width = `${Math.min(100, (100 * leftMs) / total)}%`;
      if (left <= 0 && !polledPastZero && !busy) { polledPastZero = true; poll(); }
    }

    return {
      mount(container) {
        root = container;
        document.title = `${spec.title} — EastCoin Casino`;
        window.ECPresence?.beat(spec.key);
        shownRoundId = null;
        holdUntil = 0;
        build();
        poll();
        schedule();
        tickTimer = window.setInterval(tick, 250);
        // A tab that comes back into view gets its state now, not on the
        // next tick: with a clock on screen, six seconds of stale page
        // reads as broken.
        onVis = () => { if (!document.hidden && !busy) poll(); };
        document.addEventListener("visibilitychange", onVis);
      },
      unmount() {
        window.clearInterval(pollTimer);
        window.clearInterval(tickTimer);
        window.clearTimeout(holdTimer);
        pollTimer = tickTimer = holdTimer = 0;
        if (onVis) document.removeEventListener("visibilitychange", onVis);
        onVis = null;
        data = null; refs = {}; playing = false;
        document.title = "EastCoin";
      }
    };
  }

  /** The winner's banner over the arena: a trophy, a name, the pot. */
  function banner(arena, text, amount) {
    arena.querySelector(".pv-banner")?.remove();
    const b = K.el("div", "pv-banner");
    b.append(K.el("span", "pv-banner-trophy", "🏆"), document.createTextNode(text), K.zc(amount));
    arena.append(b);
  }

  /** "A", "A and B", "A, B and C" — as profile links, in a fragment. */
  function names(list) {
    const frag = document.createDocumentFragment();
    list.forEach((p, i) => {
      if (i > 0) frag.append(document.createTextNode(i === list.length - 1 ? " and " : ", "));
      frag.append(K.nameLink(p));
    });
    return frag;
  }

  /* -------------------------------------------- Russian Roulette */

  function seatNode(p, me) {
    const s = K.el("div", `rr-seat${p.login === me ? " me" : ""}`);
    s.append(K.avatar(p, "rr-av"), K.el("b", null, p.login === me ? "You" : p.displayName));
    return s;
  }

  // A result's rounds. Rounds settled before 2026-09-12 stopped at the
  // first shot and carry {chambers, live, loser}; they read as one round.
  const stagesOf = (r, n) => Array.isArray(r?.stages) ? r.stages
    : (r && Number.isInteger(r.loser) ? [{ players: n, chambers: r.chambers, live: r.live, shot: r.loser }] : []);
  const winnerOf = (r, n) => {
    if (Number.isInteger(r?.winner)) return r.winner;
    const st = stagesOf(r, n);
    return st.length === 1 && n === 2 ? 1 - st[0].shot : null;
  };

  /* The cylinder, in the middle of the ring. Chambers sit on a ring
     inside a rotating disc; the hammer is a fixed mark at the top, and
     turning the disc brings one chamber under it. --a places a chamber,
     --d sizes it as a share of the cylinder (tighter with more chambers),
     so the same drawing works at any size. */
  const CYL_R = 35;
  function loadCylinder(cyl, chambers, stage) {
    cyl.replaceChildren();
    const d = Math.max(7, Math.min(17, Math.floor((2 * Math.PI * CYL_R) / (chambers * 1.45))));
    cyl.style.setProperty("--d", String(d));
    for (let c = 0; c < chambers; c += 1) {
      const ch = K.el("i", "rr-ch");
      ch.style.setProperty("--a", `${(c * 360) / chambers}deg`);
      if (stage) {
        if (c === stage.live) ch.classList.add("live");
        else if (c < stage.live) ch.classList.add("spent");
      }
      cyl.append(ch);
    }
    cyl.dataset.chambers = String(chambers);
    // Settled: left as the round ended, the bullet under the hammer.
    cyl.classList.remove("spin");
    cyl.style.transition = "none";
    turnTo(cyl, stage ? stage.live : 0, false);
    void cyl.offsetWidth;
    cyl.style.transition = "";
  }
  // Bring chamber c under the hammer, always turning the same way. A spin
  // adds two full turns first so it reads as a spin, not a nudge.
  function turnTo(cyl, c, spin) {
    const chambers = Number(cyl.dataset.chambers || 6);
    const cur = Number(cyl.dataset.angle || 0);
    const want = -((c * 360) / chambers);
    let target = want;
    while (target > cur - (spin ? 720 : 0)) target -= 360;
    if (!spin && target < cur - 360) target += 360;
    cyl.classList.toggle("spin", spin);
    cyl.style.transform = `rotate(${target}deg)`;
    cyl.dataset.angle = String(target);
  }

  /* Last One Standing picks its victim the way a wheel does: the light
     runs round everyone still in, fast, and slows until it stops on the
     one going out. The stop is fixed by the server's order; only the
     start of the run is random, so the run always ends where it must. */
  async function spinTo(nodes, alive, who, ms, wait) {
    const L = alive.length;
    const end = alive.indexOf(who);
    if (end < 0 || L < 2) return;
    const start = Math.floor(Math.random() * L);
    const steps = (((end - start) % L) + L) % L + L * (L > 6 ? 1 : 2);
    const delays = [];
    for (let i = 0; i <= steps; i += 1) { const x = i / steps; delays.push(50 + x * x * x * 320); }
    const scale = ms / delays.reduce((a, b) => a + b, 0);
    let last = null;
    for (let i = 0; i <= steps; i += 1) {
      last?.classList.remove("pick");
      last = nodes[alive[(start + i) % L]];
      last?.classList.add("pick");
      await wait(delays[i] * scale);
    }
    await wait(260);
    last?.classList.remove("pick");
  }

  const roulette = {
    key: "roulette",
    title: "Russian Roulette - PVP",
    iconUrl: "https://cdn.7tv.app/emote/01G1FDHE4R0005G1MWWMPGSX71/1x.webp",
    blurb: "Everyone puts in 20. Pull until someone gets it, reload, go again. The last one standing takes the lot.",
    joinedLine: "The clock's running.",
    paysTitle: "What the winner takes",
    verifyRule: "round k: live = sha256(seed:roulette:k) mod chambers · chamber c is pulled by the c-th seat still in, wrapping · last left wins",
    payCell: (t) => `${t.pot} · 1 in ${t.chance}${t.chambers ? ` · ${t.chambers} chambers` : ""}`,
    openLine: (l) => `${l.players.length} in so far. Sit and it's ${l.pot + 20} to the last one standing.`,
    waitingLine: (l) => `${l.players.length} at the table, ${l.pot} in the pot. You're on 1 in ${l.players.length}.`,
    resultLine: (r, me) => { const w = r.players[winnerOf(r.result, r.players.length)]; return w ? (w.login === me ? `You survive — you take ${r.pot}` : `${w.displayName} survived — takes ${r.pot}`) : `Table played — ${r.pot} paid`; },
    wonHeadline: () => "Last one standing",
    lostLine: (r, mine) => {
      const k = stagesOf(r.result, r.players.length).findIndex((s) => s.shot === mine.seat);
      return `You got shot in round ${k + 1}. ${r.stake} ZC gone.`;
    },
    verifyLine: (r) => stagesOf(r.result, r.players.length).map((s, k) => `r${k + 1}: ${s.chambers}ch live ${s.live} seat ${s.shot} shot`).join(" · ") + ` · seat ${winnerOf(r.result, r.players.length)} won`,
    ledgerFace: (h) => (h.seats || []).find((s) => s.status === "WON"),
    // "Zwades won 40 — BootyPaper and Andy got shot and lost 20 each".
    sentence(h) {
      const frag = document.createDocumentFragment();
      const winner = (h.seats || []).find((s) => s.status === "WON");
      const shot = (h.seats || []).filter((s) => s.status === "LOST");
      if (!winner) { frag.append(document.createTextNode("Table played")); return frag; }
      frag.append(K.nameLink(winner), document.createTextNode(" won "), K.zc(winner.payout - winner.stake));
      if (shot.length) {
        frag.append(document.createTextNode(" — "), names(shot), document.createTextNode(" got shot and lost "), K.zc(shot[0].stake));
        if (shot.length > 1) frag.append(document.createTextNode(" each"));
      }
      return frag;
    },

    /* The board: seats on a ring round a big cylinder. An open seat is a
       button — clicking it is the same as the Join button. */
    drawSeats(players, arena, { me, result, settled, canSit, onSit, stake }) {
      arena.replaceChildren();
      arena.classList.remove("bang");
      const ring = K.el("div", "rr-ring");
      const n = players.length;
      const ghost = !settled && canSit ? 1 : 0;
      const slots = Math.max(1, n + ghost);
      const angleOf = (i) => (i / slots) * Math.PI * 2 - Math.PI / 2;
      const place = (node, a) => {
        node.style.left = `${50 + Math.cos(a) * 41}%`;
        node.style.top = `${50 + Math.sin(a) * 41}%`;
        node.dataset.angle = String(a);
      };
      const stages = settled ? stagesOf(result, n) : [];
      const winner = settled ? winnerOf(result, n) : null;
      players.forEach((p, i) => {
        const s = seatNode(p, me);
        place(s, angleOf(i));
        if (settled && winner !== null) s.classList.add(i === winner ? "winner" : "dead");
        ring.append(s);
      });
      if (ghost) {
        const g = K.el("button", "rr-seat rr-sit");
        g.type = "button";
        g.append(K.el("span", "rr-av", "+"), K.el("b", null, "Sit here"));
        const price = K.el("small");
        price.append(K.zc(stake || 20));
        g.append(price);
        g.addEventListener("click", () => onSit?.());
        place(g, angleOf(n));
        ring.append(g);
      }

      const center = K.el("div", "rr-center");
      const wrap = K.el("div", "rr-cylwrap");
      const cyl = K.el("div", "rr-cyl");
      // Idle: a cylinder sized for the table. Settled: the last round's,
      // as it was left, spent up to the live one.
      const lastStage = stages[stages.length - 1];
      const chambers = lastStage ? lastStage.chambers : (n ? n * Math.max(1, Math.ceil(6 / n)) : 6);
      wrap.append(K.el("div", "rr-hammer"), cyl, K.el("div", "rr-word", ""));
      center.append(wrap, K.el("div", "rr-odds", n && !settled ? `${chambers} chambers · 1 live` : ""));
      ring.append(center);
      if (!n && !canSit) ring.append(K.el("p", "cf-empty rr-empty", "Nobody at the table."));
      arena.append(ring);
      loadCylinder(cyl, chambers, lastStage || null);

      if (settled && winner !== null && players[winner]) {
        const w = players[winner];
        banner(arena, `${w.login === me ? "You take" : `${w.displayName} takes`} `, 20 * n);
      }
    },

    async animate(round, refs, { wait, me }) {
      const n = round.players.length;
      const stages = stagesOf(round.result, n);
      const nameOf = (i) => (round.players[i]?.login === me ? "You" : round.players[i]?.displayName || "Someone");
      const verb = (i, third, second) => (round.players[i]?.login === me ? second : third);
      roulette.drawSeats(round.players, refs.arena, { me });
      const arena = refs.arena;
      const seats = [...arena.querySelectorAll(".rr-seat")];
      const cyl = arena.querySelector(".rr-cyl");
      const word = arena.querySelector(".rr-word");
      const odds = arena.querySelector(".rr-odds");
      let remaining = round.players.map((_, i) => i);

      for (let k = 0; k < stages.length; k += 1) {
        const st = stages[k];
        // Load for whoever is left, then spin. Said out loud between rounds so a second BANG reads as
        // a new round, not the same one.
        loadCylinder(cyl, st.chambers, null);
        const chs = [...cyl.children];
        word.textContent = k > 0 ? "Reload" : "";
        word.className = k > 0 ? "rr-word reload" : "rr-word";
        refs.phase.className = "cf-phase open";
        refs.phase.textContent = k > 0 ? `${remaining.length} left — reloading…` : "Spinning…";
        odds.textContent = `${st.chambers} chambers · 1 live`;
        if (k > 0) await wait(700);
        turnTo(cyl, 0, true);
        await wait(1000);
        for (let c = 0; c < st.chambers; c += 1) {
          // The live chamber goes to the seat the server recorded as shot.
          // Equal to the arithmetic for a real round, but the record is the
          // authority: the page must never contradict what was paid.
          const who = c === st.live && Number.isInteger(st.shot) ? st.shot : remaining[c % remaining.length];
          seats.forEach((s) => s.classList.remove("up"));
          seats[who]?.classList.add("up");
          chs.forEach((ch) => ch.classList.remove("under"));
          chs[c].classList.add("under");
          turnTo(cyl, c, false);
          refs.phase.textContent = `${nameOf(who)} ${verb(who, "pulls", "pull")}…`;
          odds.textContent = `${st.chambers - c} chamber${st.chambers - c === 1 ? "" : "s"} left · 1 live`;
          word.textContent = "";
          word.className = "rr-word";
          await wait(700);
          if (c === st.live) {
            chs[c].className = "rr-ch live under";
            arena.classList.remove("bang"); void arena.offsetWidth; arena.classList.add("bang");
            word.textContent = "BANG";
            word.className = "rr-word bang";
            odds.textContent = "";
            seats[who]?.classList.remove("up");
            seats[who]?.classList.add("dead");
            refs.phase.className = "cf-phase bad";
            refs.phase.textContent = `${nameOf(who)} ${verb(who, "is", "are")} out`;
            remaining = remaining.filter((s) => s !== who);
            await wait(1150);
            arena.classList.remove("bang");
            break;
          }
          chs[c].className = "rr-ch spent under";
          word.textContent = "click";
          word.className = "rr-word click";
          await wait(340);
        }
      }

      // The last one standing. Everyone else is already marked; the
      // winner is lit, the banner drops in, and the room gets confetti.
      const w = Number.isInteger(winnerOf(round.result, n)) ? winnerOf(round.result, n) : remaining[0];
      seats.forEach((s, i) => { s.classList.remove("up"); if (i !== w) s.classList.add("dead"); });
      seats[w]?.classList.remove("dead");
      seats[w]?.classList.add("winner");
      word.textContent = "";
      word.className = "rr-word";
      banner(arena, `${nameOf(w)} ${verb(w, "takes", "take")} `, round.pot);
      refs.phase.className = "cf-phase open";
      refs.phase.textContent = `${nameOf(w)} ${verb(w, "survives", "survive")} — takes ${round.pot}`;
      K.burst?.();
      await wait(500);
    }
  };

  /* ------------------------------------------ Last One Standing */

  const standing = {
    key: "standing",
    title: "Last One Standing - PVP",
    blurb: "Everyone puts in 20. One player is knocked out every couple of seconds until one is left, and they take the lot.",
    joinedLine: "The clock's running.",
    paysTitle: "What the winner takes",
    verifyRule: "elimination order = Fisher–Yates over the seats, swap i from sha256(seed:shuffle:i) · last left wins",
    // "Zwades won 80 — BootyPaper, Milo and Pax lost 20 each".
    ledgerFace: (h) => (h.seats || []).find((s) => s.status === "WON"),
    sentence(h) {
      const frag = document.createDocumentFragment();
      const winner = (h.seats || []).find((s) => s.status === "WON");
      const losers = (h.seats || []).filter((s) => s.status === "LOST");
      if (!winner) { frag.append(document.createTextNode("Table played")); return frag; }
      frag.append(K.nameLink(winner), document.createTextNode(" won "), K.zc(winner.payout - winner.stake));
      if (losers.length) {
        frag.append(document.createTextNode(" — "), names(losers), document.createTextNode(" lost "), K.zc(losers[0].stake));
        if (losers.length > 1) frag.append(document.createTextNode(" each"));
      }
      return frag;
    },
    payCell: (t) => `${t.pot} · 1 in ${t.chance}`,
    openLine: (l) => `${l.players.length} in so far. Sit and it's ${l.pot + 20} to one person.`,
    waitingLine: (l) => `${l.players.length} at the table, ${l.pot} in the pot. You're on 1 in ${l.players.length}.`,
    resultLine: (r, me) => { const w = r.players[r.result.winner]; return w ? (w.login === me ? `You take ${r.pot} — last of ${r.players.length}` : `${w.displayName} took ${r.pot} — last of ${r.players.length}`) : `Table played — ${r.pot} paid`; },
    wonHeadline: () => "Last one standing",
    lostLine: (r, mine) => { const place = r.result.order.indexOf(mine.seat); return `Knocked out ${place === 0 ? "first" : `${r.players.length - place}${ordinal(r.players.length - place)}`} of ${r.players.length}.`; },
    verifyLine: (r) => `order ${r.result.order.join(",")} · seat ${r.result.winner} won`,

    drawSeats(players, arena, { me, result, settled }) {
      arena.replaceChildren();
      const floor = K.el("div", "ls-floor");
      players.forEach((p, i) => {
        const s = K.el("div", `ls-p${p.login === me ? " me" : ""}`);
        s.append(K.el("span", "ls-rank", ""), K.avatar(p, "ls-av"), K.el("b", null, p.login === me ? "You" : p.displayName));
        if (settled && result) {
          if (i === result.winner) s.classList.add("winner");
          else { s.classList.add("gone"); s.querySelector(".ls-rank").textContent = String(players.length - result.order.indexOf(i)); }
        }
        floor.append(s);
      });
      if (!players.length) floor.append(K.el("p", "cf-empty", "Sit down to open the table."));
      arena.append(floor);
      if (settled && result && players[result.winner]) {
        const w = players[result.winner];
        banner(arena, `${w.login === me ? "You take" : `${w.displayName} takes`} `, 20 * players.length);
      }
    },

    async animate(round, refs, { wait, me }) {
      const r = round.result;
      const n = round.players.length;
      standing.drawSeats(round.players, refs.arena, { me });
      const nodes = [...refs.arena.querySelectorAll(".ls-p")];
      refs.phase.className = "cf-phase open";
      refs.phase.textContent = "Round starting…";
      await wait(900);
      // Faster with a big table, so twelve players is not forty seconds.
      const gap = n > 8 ? 900 : n > 4 ? 1300 : 1700;
      const spinMs = n > 8 ? 800 : 1200;
      let alive = round.players.map((_, i) => i);
      for (let k = 0; k < n - 1; k += 1) {
        const who = r.order[k];
        const node = nodes[who];
        refs.phase.className = "cf-phase open";
        refs.phase.textContent = `${alive.length} left — spinning…`;
        await spinTo(nodes, alive, who, spinMs, wait);
        alive = alive.filter((i) => i !== who);
        node?.classList.add("hit");
        refs.phase.className = "cf-phase bad";
        refs.phase.textContent = `${round.players[who]?.login === me ? "You're" : `${round.players[who]?.displayName} is`} out — ${n - k - 1} left`;
        await wait(gap * 0.6);
        node?.classList.remove("hit");
        node?.classList.add("gone");
        const rank = node?.querySelector(".ls-rank");
        if (rank) rank.textContent = String(n - k);
        await wait(gap * 0.4);
      }
      const w = nodes[r.winner];
      w?.classList.add("winner");
      refs.phase.className = "cf-phase open";
      refs.phase.textContent = `${round.players[r.winner]?.login === me ? "You take" : `${round.players[r.winner]?.displayName} takes`} ${round.pot}`;
      banner(refs.arena, `${round.players[r.winner]?.login === me ? "You take" : `${round.players[r.winner]?.displayName} takes`} `, round.pot);
      K.burst?.();
      await wait(500);
    }
  };

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("roulette", table(roulette));
    window.ECV3.register("standing", table(standing));
  }
  boot();
})();

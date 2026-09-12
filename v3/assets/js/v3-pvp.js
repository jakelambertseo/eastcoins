/* ============================================================
   EastCoin V3 — Casino: the player-versus-player tables

     /?view=roulette    Russian Roulette
     /?view=standing    Last One Standing

   One file, two games, because they are the same shape: a lobby
   that the first person to sit down opens, a sixty-second clock,
   and a result the server has already settled that this page only
   plays back. The buy-in is fixed at 20, so there is nothing to
   choose but whether to sit.

   The page never decides anything. The result arrives settled, paid,
   with its seed revealed; the animation is theatre, and closing the
   tab during it changes nothing about who got paid.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const LOBBY_POLL = 2500;      // while a clock is running
  const IDLE_POLL = 6000;       // nothing open
  const NAMES_MAX = 12;

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
      } catch {
        if (refs.status) refs.status.textContent = "Reconnecting…";
      }
    }

    // Faster while a clock is running, so the start is not missed by
    // long; slower when the table is empty.
    function schedule() {
      window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => { if (!busy) poll(); }, data?.lobby ? LOBBY_POLL : IDLE_POLL);
    }

    /** A round that finished since we last looked gets played back. */
    async function maybePlayback() {
      const last = data?.last;
      if (!last) return;
      if (shownRoundId === null) { shownRoundId = last.id; return; }   // first paint: just show it
      if (last.id === shownRoundId) return;
      shownRoundId = last.id;
      if (last.status !== "SETTLED") { toast("Only one at the table — buy-ins returned.", "near"); return; }
      playing = true;
      try {
        render();                   // the arena gets the seats before anything moves
        await spec.animate(last, refs, { wait, me: myLogin() });
        announce(last);
      } finally {
        playing = false;
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
      const page = K.el("section", `coinflip casino-pvp casino-${spec.key}`);

      const head = K.el("div", "viewhead");
      const copy = K.el("div");
      copy.append(K.el("h1", null, spec.title), K.el("p", null, spec.blurb));
      head.append(copy);
      const right = K.el("div", "cas-headright");
      refs.status = K.el("span", "cf-status", "Connecting…");
      right.append(refs.status, K.casinoLink());
      head.append(right);
      page.append(head);

      const grid = K.el("div", "cf-grid");
      const stage = K.el("section", "cf-stage");
      refs.phase = K.el("div", "cf-phase", "");
      refs.count = K.el("div", "pv-count", "");
      refs.arena = K.el("div", `pv-arena ${spec.key}`);
      stage.append(refs.phase, refs.count, refs.arena);

      const bet = K.el("div", "cf-bet");
      refs.join = K.btn("Join", "cf-lock", join);
      refs.note = K.el("p", "cf-note", "");
      refs.limits = K.el("p", "cf-limits", "");
      bet.append(refs.join, refs.note, refs.limits);
      stage.append(bet);
      grid.append(stage);

      const col = K.el("div", "cf-side-col");

      const hour = K.el("section", "cf-card");
      const hh = K.el("h2", null, "This hour");
      refs.hourNote = K.el("small");
      hh.append(refs.hourNote);
      refs.hourList = K.el("div", "hl-stats");
      hour.append(hh, refs.hourList);

      const pays = K.el("section", "cf-card");
      const ph = K.el("h2", null, spec.paysTitle);
      ph.append(K.el("small", null, "by table size"));
      refs.paysList = K.el("div", "mn-ladder");
      pays.append(ph, refs.paysList);

      const fair = K.el("section", "cf-card cf-card-verify");
      const verify = K.verifyBox("Verify this round");
      refs.fair = verify.node;
      refs.fairBody = verify.body;
      fair.append(refs.fair);

      const room = K.el("section", "cf-card");
      const rh = K.el("h2", null, "At the table");
      refs.roomCount = K.el("small");
      rh.append(refs.roomCount);
      refs.roomList = K.el("div", "cf-room");
      room.append(rh, refs.roomList);

      col.append(hour, pays, fair, room);
      grid.append(col);
      page.append(grid);

      const ledger = K.el("section", "cf-card cf-ledger");
      const lgh = K.el("h2", null, "Recent tables");
      refs.ledgerNote = K.el("small");
      lgh.append(refs.ledgerNote);
      refs.ledgerList = K.el("div", "cf-list paged");
      ledger.append(lgh, refs.ledgerList);
      page.append(ledger);

      pop = K.makePop(page);
      toast = K.makeToast(page);
      root.append(page);
    }

    /* ---------------------------------------------------- render */

    function render() {
      if (!data || !refs.arena) return;
      const config = data.config;
      const lobby = data.lobby;
      const last = data.last;
      const me = myLogin();

      refs.status.textContent = playing ? "Playing…" : lobby ? "Lobby open" : "Ready";

      if (!playing) {
        if (lobby) {
          refs.phase.textContent = lobby.youIn ? "You're in — waiting for the clock" : `${lobby.players.length} at the table`;
          refs.phase.className = "cf-phase open";
          spec.drawSeats(lobby.players, refs.arena, { me, lobby: true });
        } else if (last?.status === "SETTLED") {
          refs.phase.textContent = spec.resultLine(last);
          refs.phase.className = `cf-phase ${last.players.find((p) => p.login === me)?.payout > last.stake ? "open" : ""}`;
          spec.drawSeats(last.players, refs.arena, { me, result: last.result, settled: true });
        } else {
          refs.phase.textContent = "Nobody at the table";
          refs.phase.className = "cf-phase";
          spec.drawSeats([], refs.arena, { me });
        }
      }
      tick();

      // Controls
      const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
      const full = lobby && lobby.players.length >= config.maxPlayers;
      refs.join.disabled = busy || playing || !config.canBet || capped || Boolean(lobby?.youIn) || Boolean(full);
      if (!data.me) { K.plain(refs.join, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
      else if (!config.canBet) { K.plain(refs.join, "Casino paused"); refs.note.textContent = "ZCoin transfers aren't switched on right now."; }
      else if (capped) { K.withCoins(refs.join, `Up [[${data.me.hourNet}]] this hour — the cap`); refs.note.textContent = "The tables reopen for you as the hour rolls on."; }
      else if (lobby?.youIn) { K.plain(refs.join, "You're in"); refs.note.textContent = spec.waitingLine(lobby); }
      else if (full) { K.plain(refs.join, "Table's full"); refs.note.textContent = `Twelve is the most that fit. The next table opens when this one plays.`; }
      else if (lobby) { K.withCoins(refs.join, `Join for [[${config.stake}]]`); refs.note.textContent = spec.openLine(lobby); }
      else { K.withCoins(refs.join, `Sit down for [[${config.stake}]]`); refs.note.textContent = `You open the table. The clock starts at ${config.lobbySeconds} seconds and whoever's in when it hits zero plays.`; }
      const used = data.me?.joinsThisHour;
      K.withCoins(refs.limits, `Buy-in is always [[${config.stake}]] · ${config.maxPerHour} tables an hour · winnings cap [[${config.hourCap}]] an hour` + (Number.isFinite(used) ? ` · you've used ${used} of ${config.maxPerHour}` : ""));

      // This hour
      refs.hourList.replaceChildren();
      const row = (k, v) => { const r = K.el("div", "hl-stat"); r.append(K.el("span", null, k)); const s = K.el("strong"); if (v instanceof Node) s.append(v); else s.textContent = v; r.append(s); return r; };
      if (data.me) {
        refs.hourNote.textContent = "";
        refs.hourList.append(row("Tables", `${data.me.joinsThisHour} of ${config.maxPerHour}`), row("Casino net", K.zc(data.me.hourNet, { sign: true })), row("Cap", K.zc(config.hourCap)));
      } else {
        refs.hourList.append(K.el("p", "cf-empty", "Log in to keep a record."));
      }

      // What it pays
      refs.paysList.replaceChildren();
      const at = lobby ? lobby.players.length : last?.players.length;
      for (const t of config.table || []) {
        const r = K.el("div", `mn-rung${t.players === at ? " at" : ""}`);
        r.append(K.el("span", null, `${t.players} players`), K.el("strong", null, spec.payCell(t)));
        refs.paysList.append(r);
      }

      // Fairness
      refs.fair.hidden = false;
      const lines = [];
      if (lobby) lines.push(`this table's hash  ${lobby.hash}   (the seed is revealed when it plays)`);
      if (last) {
        lines.push(`last seed          ${last.seed || "—"}`);
        lines.push(`last hash          ${last.hash}`);
        if (last.result) lines.push(`last result        ${spec.verifyLine(last)}`);
      }
      lines.push(`check              sha256(seed) = hash · ${spec.verifyRule}`);
      refs.fairBody.textContent = lines.join("\n");

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
      const items = data.history || [];
      const pg = K.pageOf(items, ledgerPage, 8);
      refs.ledgerNote.textContent = items.length ? `${items.length} table${items.length === 1 ? "" : "s"}` : "";
      refs.ledgerList.replaceChildren();
      if (!items.length) refs.ledgerList.append(K.el("p", "cf-empty", "No tables have played yet."));
      for (const h of pg.slice) {
        const line = K.el("div", `cf-row ${h.status === "VOID" ? "" : "won"}`);
        const who = K.el("span", "cf-row-who");
        if (h.who) { who.append(K.avatar(h.who, "cf-av small"), K.nameLink(h.who)); }
        else who.textContent = h.status === "VOID" ? "Nobody showed" : "—";
        const what = K.el("span", "cf-row-what", h.status === "VOID" ? "refunded" : spec.ledgerWord);
        const amt = K.el("span", "cf-row-amt");
        amt.append(h.status === "VOID" ? document.createTextNode("—") : K.zc(spec.ledgerAmount(h), { sign: true }));
        const when = K.el("span", "cf-row-when", `${h.players} player${h.players === 1 ? "" : "s"} · ${h.at ? new Date(h.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`);
        line.append(who, what, amt, when);
        refs.ledgerList.append(line);
      }
      refs.ledgerList.append(K.pager(pg, (n) => { ledgerPage = n; render(); }, "tables"));
    }

    /** The countdown, off the server clock, four times a second. */
    function tick() {
      if (!refs.count) return;
      const lobby = data?.lobby;
      if (!lobby || playing) { refs.count.textContent = ""; refs.count.hidden = true; return; }
      const left = Math.max(0, (lobby.startsAt - serverNow()) / 1000);
      refs.count.hidden = false;
      refs.count.textContent = left > 0 ? `${Math.ceil(left)}s` : "Starting…";
      if (left <= 0 && !polledPastZero && !busy) { polledPastZero = true; poll(); }
    }

    return {
      mount(container) {
        root = container;
        document.title = `${spec.title} — EastCoin Casino`;
        window.ECPresence?.beat(spec.key);
        shownRoundId = null;
        build();
        poll();
        schedule();
        tickTimer = window.setInterval(tick, 250);
        // A tab that comes back into view gets its state now, not on the
        // next tick: with a sixty-second clock on screen, six seconds of
        // stale page reads as broken.
        onVis = () => { if (!document.hidden && !busy) poll(); };
        document.addEventListener("visibilitychange", onVis);
      },
      unmount() {
        window.clearInterval(pollTimer);
        window.clearInterval(tickTimer);
        pollTimer = tickTimer = 0;
        if (onVis) document.removeEventListener("visibilitychange", onVis);
        onVis = null;
        data = null; refs = {}; playing = false;
        document.title = "EastCoin";
      }
    };
  }

  /* -------------------------------------------- Russian Roulette */

  function seatNode(p, me) {
    const s = K.el("div", `rr-seat${p.login === me ? " me" : ""}`);
    s.append(K.avatar(p, "rr-av"), K.el("b", null, p.login === me ? "You" : p.displayName));
    return s;
  }

  const roulette = {
    key: "roulette",
    title: "Russian Roulette",
    blurb: "Everyone puts in 20. One live round. Whoever it fires on loses their stake, and everyone still standing splits it.",
    joinedLine: "The clock's running.",
    paysTitle: "What survivors win",
    ledgerWord: "got it",
    verifyRule: "live chamber = sha256(seed:roulette) mod chambers · chamber c is pulled by seat c mod players",
    ledgerAmount: (h) => -20,
    payCell: (t) => `+${t.win} · ${t.pullsEach} pull${t.pullsEach === 1 ? "" : "s"} each`,
    openLine: (l) => `${l.players.length} in so far. Everyone's on exactly 1 in ${Math.max(2, l.players.length + 1)} once you sit.`,
    waitingLine: (l) => `${l.players.length} at the table. With ${l.players.length} it's 1 in ${l.players.length} and +${Math.floor(20 / Math.max(1, l.players.length - 1))} if you walk away.`,
    resultLine: (r) => { const loser = r.players[r.result.loser]; return `${loser ? loser.displayName : "Someone"} got it — ${r.players.length} at the table`; },
    wonHeadline: (r, mine) => `Survived`,
    lostLine: (r) => `It was you. ${r.stake} ZC gone; the other ${r.players.length - 1} split it.`,
    verifyLine: (r) => `chambers ${r.result.chambers} · live ${r.result.live} · seat ${r.result.loser} lost`,

    drawSeats(players, arena, { me, result, settled }) {
      arena.replaceChildren();
      const ring = K.el("div", "rr-ring");
      const n = players.length;
      players.forEach((p, i) => {
        const s = seatNode(p, me);
        const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        s.style.left = `${50 + Math.cos(a) * 40}%`;
        s.style.top = `${50 + Math.sin(a) * 40}%`;
        if (settled && result && i === result.loser) s.classList.add("dead");
        else if (settled) s.classList.add("safe");
        ring.append(s);
      });
      if (!n) ring.append(K.el("p", "cf-empty rr-empty", "Sit down to open the table."));
      const gun = K.el("div", "rr-gun");
      const cyl = K.el("div", "rr-cyl");
      const chambers = result?.chambers || (n ? n * Math.max(1, Math.ceil(6 / n)) : 6);
      for (let c = 0; c < chambers; c += 1) {
        const ch = K.el("i", "rr-ch");
        if (settled && result) ch.classList.add(c === result.live ? "live" : c < result.live ? "spent" : "");
        cyl.append(ch);
      }
      const word = K.el("div", "rr-word", settled ? "BANG" : n ? "Loaded" : "");
      if (settled) word.classList.add("bang");
      gun.append(cyl, word, K.el("div", "rr-odds", ""));
      ring.append(gun);
      arena.append(ring);
    },

    async animate(round, refs, { wait, me }) {
      const r = round.result;
      const n = round.players.length;
      roulette.drawSeats(round.players, refs.arena, { me });
      refs.phase.className = "cf-phase open";
      refs.phase.textContent = "Spinning the cylinder…";
      const seats = [...refs.arena.querySelectorAll(".rr-seat")];
      const chs = [...refs.arena.querySelectorAll(".rr-ch")];
      const word = refs.arena.querySelector(".rr-word");
      const odds = refs.arena.querySelector(".rr-odds");
      await wait(900);
      for (let c = 0; c < r.chambers; c += 1) {
        const who = c % n;
        seats.forEach((s) => s.classList.remove("up"));
        seats[who]?.classList.add("up");
        refs.phase.textContent = `${round.players[who]?.login === me ? "You pull" : `${round.players[who]?.displayName} pulls`}…`;
        odds.textContent = `1 chamber in ${r.chambers - c} is live`;
        word.textContent = "";
        word.className = "rr-word";
        await wait(760);
        if (c === r.live) {
          chs[c].className = "rr-ch live";
          word.textContent = "BANG";
          word.className = "rr-word bang";
          odds.textContent = "";
          seats[who]?.classList.remove("up");
          seats[who]?.classList.add("dead");
          seats.forEach((s, i) => { if (i !== who) s.classList.add("safe"); });
          await wait(1200);
          return;
        }
        chs[c].className = "rr-ch spent";
        word.textContent = "click";
        word.className = "rr-word click";
        await wait(340);
      }
    }
  };

  /* ------------------------------------------ Last One Standing */

  const standing = {
    key: "standing",
    title: "Last One Standing",
    blurb: "Everyone puts in 20. One player is knocked out every couple of seconds until one is left, and they take the lot.",
    joinedLine: "The clock's running.",
    paysTitle: "What the winner takes",
    ledgerWord: "took the pot",
    verifyRule: "elimination order = Fisher–Yates over the seats, swap i from sha256(seed:shuffle:i) · last left wins",
    ledgerAmount: (h) => h.pot - 20,
    payCell: (t) => `${t.pot} · 1 in ${t.chance}`,
    openLine: (l) => `${l.players.length} in so far, ${l.pot} in the pot. Sit and it's ${l.pot + 20} to one person.`,
    waitingLine: (l) => `${l.players.length} at the table, ${l.pot} in the pot. You're on 1 in ${l.players.length}.`,
    resultLine: (r) => { const w = r.players[r.result.winner]; return `${w ? w.displayName : "Someone"} took ${r.pot} — last of ${r.players.length}`; },
    wonHeadline: (r) => `Last one standing`,
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
      for (let k = 0; k < n - 1; k += 1) {
        const who = r.order[k];
        const node = nodes[who];
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
      await wait(1200);
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

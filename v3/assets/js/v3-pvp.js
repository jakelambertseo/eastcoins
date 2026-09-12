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
    let arenaFresh = false;         // the animation just drew the final state; skip one redraw

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

    /** A round that finished since we last looked gets played back. */
    async function maybePlayback() {
      const last = data?.last;
      // An empty table with no history still counts as seen, so the first
      // round it ever plays is played back rather than shown settled.
      if (!last) { if (shownRoundId === null) shownRoundId = "none"; return; }
      if (shownRoundId === null) { shownRoundId = last.id; return; }   // first paint: just show it
      if (last.id === shownRoundId) return;
      shownRoundId = last.id;
      if (last.status !== "SETTLED") { toast("Only one at the table — buy-ins returned.", "near"); return; }
      playing = true;
      try {
        render();                   // the arena gets the seats before anything moves
        await spec.animate(last, refs, { wait, me: myLogin() });
        // The animation ends on exactly what the settled draw would show,
        // so the next render leaves the arena alone rather than rebuilding
        // it — rebuilding was the flash at the end of every round.
        arenaFresh = true;
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

      if (playing) {
        /* the animation owns the arena */
      } else if (arenaFresh) {
        arenaFresh = false;
      } else {
        if (lobby) {
          refs.phase.textContent = lobby.youIn ? "You're in — waiting for the clock" : `${lobby.players.length} at the table`;
          refs.phase.className = "cf-phase open";
          spec.drawSeats(lobby.players, refs.arena, { me, lobby: true });
        } else if (last?.status === "SETTLED") {
          refs.phase.textContent = spec.resultLine(last, me);
          refs.phase.className = `cf-phase ${last.players.find((p) => p.login === me)?.payout > last.stake ? "open" : ""}`;
          spec.drawSeats(last.players, refs.arena, { me, result: last.result, settled: true });
        } else {
          refs.phase.textContent = config.paused ? "Closed for now" : "Nobody at the table";
          refs.phase.className = "cf-phase";
          spec.drawSeats([], refs.arena, { me });
        }
      }
      tick();

      // Controls
      const capped = Number.isFinite(data.me?.hourNet) && data.me.hourNet >= config.hourCap;
      const full = lobby && lobby.players.length >= config.maxPlayers;
      refs.join.disabled = busy || playing || !config.canBet || capped || Boolean(lobby?.youIn) || Boolean(full) || Boolean(config.paused);
      if (playing) { K.plain(refs.join, "Playing…"); refs.note.textContent = "The table is playing out. The next one opens the moment it's done."; }
      else if (config.paused) { K.plain(refs.join, "Closed for now"); refs.note.textContent = "This table is off the floor while it's being worked on. Try it on the practice page at eastcoin.vip/pvp-test — no ZCoins change hands there."; }
      else if (!data.me) { K.plain(refs.join, "Log in to play"); refs.note.textContent = "Log in with Twitch — the button up top — and your ZCoins come with you."; }
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

  /* The cylinder. Chambers sit on a ring inside a rotating disc; the
     hammer is a fixed mark at the top, and turning the disc brings one
     chamber under it. --a places a chamber, --d sizes it (tighter with
     more chambers: a 22-chamber round still fits the same disc). */
  const CYL_R = 44;
  function loadCylinder(cyl, chambers, stage) {
    cyl.replaceChildren();
    const d = Math.max(9, Math.min(16, Math.floor((2 * Math.PI * CYL_R) / (chambers * 1.45))));
    cyl.style.setProperty("--d", `${d}px`);
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
    openLine: (l) => `${l.players.length} in so far, ${l.pot} in the pot. Sit and it's ${l.pot + 20} to the last one standing.`,
    waitingLine: (l) => `${l.players.length} at the table, ${l.pot} in the pot. You're on 1 in ${l.players.length}.`,
    resultLine: (r, me) => { const w = r.players[winnerOf(r.result, r.players.length)]; return w ? (w.login === me ? `You survive — takes ${r.pot}` : `${w.displayName} survived — takes ${r.pot}`) : `Table played — ${r.pot} paid`; },
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

    drawSeats(players, arena, { me, result, settled }) {
      arena.replaceChildren();
      const ring = K.el("div", "rr-ring");
      const n = players.length;
      const stages = settled ? stagesOf(result, n) : [];
      const winner = settled ? winnerOf(result, n) : null;
      players.forEach((p, i) => {
        const s = seatNode(p, me);
        const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        s.style.left = `${50 + Math.cos(a) * 40}%`;
        s.style.top = `${50 + Math.sin(a) * 40}%`;
        if (settled && winner !== null) s.classList.add(i === winner ? "winner" : "dead");
        ring.append(s);
      });
      if (!n) ring.append(K.el("p", "cf-empty rr-empty", "Sit down to open the table."));
      const gun = K.el("div", "rr-gun");
      const wrap = K.el("div", "rr-cylwrap");
      const cyl = K.el("div", "rr-cyl");
      // Idle: a cylinder sized for the table. Settled: the last round's,
      // as it was left, spent up to the live one.
      const lastStage = stages[stages.length - 1];
      const chambers = lastStage ? lastStage.chambers : (n ? n * Math.max(1, Math.ceil(6 / n)) : 6);
      loadCylinder(cyl, chambers, lastStage || null);
      const word = K.el("div", "rr-word", n && !settled ? "Loaded" : "");
      wrap.append(K.el("div", "rr-hammer"), cyl, word);
      gun.append(wrap, K.el("div", "rr-odds", n && !settled ? `${chambers} chambers · 1 live` : ""));
      ring.append(gun);
      arena.append(ring);
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
      const seats = [...refs.arena.querySelectorAll(".rr-seat")];
      const gun = refs.arena.querySelector(".rr-gun");
      const cyl = refs.arena.querySelector(".rr-cyl");
      const word = refs.arena.querySelector(".rr-word");
      const odds = refs.arena.querySelector(".rr-odds");
      let remaining = round.players.map((_, i) => i);

      for (let k = 0; k < stages.length; k += 1) {
        const st = stages[k];
        // Load for whoever is left, then spin. Said out loud between
        // rounds so a second BANG reads as a new round, not the same one.
        loadCylinder(cyl, st.chambers, null);
        const chs = [...cyl.children];
        word.textContent = k > 0 ? "Reload" : "";
        word.className = k > 0 ? "rr-word reload" : "rr-word";
        refs.phase.className = "cf-phase open";
        refs.phase.textContent = k > 0 ? `${remaining.length} left — reloading…` : "Spinning the cylinder…";
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
            gun.classList.add("bang");
            word.textContent = "BANG";
            word.className = "rr-word bang";
            odds.textContent = "";
            seats[who]?.classList.remove("up");
            seats[who]?.classList.add("dead");
            refs.phase.className = "cf-phase bad";
            refs.phase.textContent = `${nameOf(who)} ${verb(who, "is", "are")} out`;
            remaining = remaining.filter((s) => s !== who);
            await wait(1100);
            gun.classList.remove("bang");
            break;
          }
          chs[c].className = "rr-ch spent under";
          word.textContent = "click";
          word.className = "rr-word click";
          await wait(320);
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
      banner(refs.arena, `${nameOf(w)} ${verb(w, "takes", "take")} `, round.pot);
      refs.phase.className = "cf-phase open";
      refs.phase.textContent = `${nameOf(w)} ${verb(w, "survives", "survive")} — takes ${round.pot}`;
      K.burst?.();
      await wait(1800);
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
    openLine: (l) => `${l.players.length} in so far, ${l.pot} in the pot. Sit and it's ${l.pot + 20} to one person.`,
    waitingLine: (l) => `${l.players.length} at the table, ${l.pot} in the pot. You're on 1 in ${l.players.length}.`,
    resultLine: (r, me) => { const w = r.players[r.result.winner]; return w ? (w.login === me ? `You take ${r.pot} — last of ${r.players.length}` : `${w.displayName} took ${r.pot} — last of ${r.players.length}`) : `Table played — ${r.pot} paid`; },
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
      await wait(1800);
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

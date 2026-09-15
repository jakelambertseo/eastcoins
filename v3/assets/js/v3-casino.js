/* ============================================================
   EastCoin V3 — Casino home

     /?view=casino

   The floor: one tile per game with its clock and who's in, the
   biggest wins of the last day, and the house rules in plain
   words. Polls /api/casino/home every five seconds and counts
   down locally in between.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 5000;
  let root = null;
  let refs = {};
  let data = null;
  let offset = 0;
  let pollTimer = 0;
  let tickTimer = 0;
  let lowerTab = "results";
  let boardPage = 1;

  const GAMES = {
    flip: { title: "Coin Flip", icon: "🪙", blurb: "Heads or tails, just over 2×. One coin for the whole room, every 30 seconds.", route: "flip" },
    wheel: { title: "Wheel", icon: "🎡", blurb: "Red or black 2.05×, the gold sliver 60×. One spin a minute.", route: "wheel" },
    race: { title: "Horse Race", icon: "🐎", blurb: "Four runners from 2× to 14×. They're off every minute.", route: "race", hidden: true },
    hilo: { title: "Higher or Lower", icon: "🃏", blurb: "Your own deck. Every right call multiplies the stake; cash out any time.", route: "hilo" },
    mines: { title: "Mines", icon: "💣", blurb: "Twenty-five tiles, a few of them bombs. Every safe one pays more; cash out before you find one.", route: "mines" },
    plinko: { title: "Plinko", icon: "🎯", blurb: "Drop a ball through the pegs. Every bucket but the middle pays; the edges pay 25×.", route: "plinko" },
    scratch: { title: "Scratch-Off", icon: "🎟️", blurb: "Rub the foil off. Three of a kind pays, from money back on coins to 100× on crowns.", route: "scratch" },
    roulette: { title: "Russian Roulette - PVP", iconUrl: "https://cdn.7tv.app/emote/01G1FDHE4R0005G1MWWMPGSX71/1x.webp", icon: "🔫", blurb: "Everyone puts in 20. One live round. Whoever it fires on pays the rest.", route: "roulette" },
    standing: { title: "Last One Standing - PVP", icon: "🏆", blurb: "Everyone puts in 20. One knocked out at a time; the last one takes the lot.", route: "standing", hidden: true }
  };

  // Polls the moment the tab comes back into view; see the note in
  // v3-pvp.js. The floor carries the PvP tables' lobby clocks now.
  let onVis = null;

  function go(route) {
    history.pushState({ view: route }, "", `/?view=${route}`);
    window.ECV3?.go(route, { push: false });
  }

  async function poll() {
    if (document.hidden) return;          // the floor is a display; it can wait
    try {
      const payload = await fetch("/api/casino/home", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error("home");
      offset = payload.now - Date.now();
      data = payload;
      renderTiles();
      renderBoard();
      renderMe();
    } catch { /* keep the last picture */ }
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = K.el("section", "casino");

    /* People come here to play, so the games are the first thing on the
       page and everything else is a footnote under them. Until
       2026-09-16 the tiles started 528px down a 595px viewport — a
       laptop opened the floor on the ticker, the wallet strip and the
       Jackpot meter, and not one game. The limits line moved into the
       subtitle and the wallet numbers into one bar in the header, so
       the head costs a row rather than a screen. */
    const head = K.el("div", "viewhead cas-head");
    const copy = K.el("div");
    const h1 = K.el("h1", null, "Casino");
    const emote = document.createElement("img");
    emote.className = "cf-title-emote";
    emote.src = "https://cdn.betterttv.net/emote/68e8507220472aa979f64123/2x.webp";
    emote.alt = "";
    emote.width = 32; emote.height = 32;
    h1.append(emote);
    copy.append(h1, K.el("p", null, "20 ZC a bet · ten an hour per game · 750 an hour out"));
    head.append(copy);
    refs.me = K.el("div", "cas-headme");
    head.append(refs.me);
    page.append(head);

    refs.tiles = K.el("div", "cas-tiles");
    for (const [key, g] of Object.entries(GAMES)) {
      if (g.hidden) continue;
      const tile = K.el("a", `cas-tile cas-${key}`);
      tile.href = `/?view=${g.route}`;
      tile.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        go(g.route);
      });
      const top = K.el("div", "cas-tile-top");
      // An image where a game has one (the 7TV emote on Russian Roulette),
      // the emoji otherwise. The emoji stays as the alt so a failed load
      // still reads.
      const icon = K.el("span", "cas-icon", g.iconUrl ? "" : g.icon);
      if (g.iconUrl) {
        const img = document.createElement("img");
        img.src = g.iconUrl;
        img.alt = g.icon || "";
        img.loading = "lazy";
        img.decoding = "async";
        icon.append(img);
      }
      top.append(icon, K.el("h2", null, g.title));
      const status = K.el("div", "cas-status");
      const clock = K.el("span", "cas-clock nums", "—");
      const phase = K.el("span", "cas-phase", "");
      status.append(phase, clock);
      const meta = K.el("div", "cas-meta");
      const inRound = K.el("span", null, "");
      const room = K.el("span", null, "");
      meta.append(inRound, room);
      const people = K.el("div", "cas-people wh-list");
      tile.append(top, K.el("p", "cas-blurb", g.blurb), status, meta, people, K.el("span", "cas-play", "Play →"));
      refs[`tile_${key}`] = { tile, clock, phase, inRound, room, people, peopleSig: "" };
      refs.tiles.append(tile);
    }
    page.append(refs.tiles);

    // Under the games, in the order someone would want them: what the
    // house is giving away today, then what the room is doing.
    const potSlot = K.el("div", "cas-pot");
    page.append(potSlot);
    window.ECPot?.mount(potSlot);

    const ticker = K.el("section", "ticker cas-ticker");
    page.append(ticker);
    window.setTimeout(() => {
      if (ticker.isConnected && window.ECActivity) {
        window.ECActivity.mountTicker(ticker, { types: ["casino", "pot"], label: "TABLES", href: "/?view=activity", empty: "Quiet for now — the first spin lands here." });
      }
    }, 0);

    // Below that: Recent results and House rules as two tabs.
    const tabs = K.el("nav", "pf-tabs cas-tabs");
    const panels = {};
    for (const [key, label] of [["results", "Recent results"], ["rules", "House rules"]]) {
      const btn = K.el("button", `pf-tab${key === lowerTab ? " on" : ""}`, label);
      btn.type = "button";
      btn.addEventListener("click", () => { lowerTab = key; for (const x of tabs.children) x.classList.toggle("on", x === btn); for (const [k2, pn] of Object.entries(panels)) pn.hidden = k2 !== key; });
      tabs.append(btn);
      panels[key] = K.el("div", "cas-panel");
      panels[key].hidden = key !== lowerTab;
    }
    page.append(tabs);
    const lower = K.el("div", "cas-lower");
    const board = K.el("section", "cf-card");
    refs.board = K.el("div", "cf-list paged");
    board.append(refs.board);

    const rules = K.el("section", "cf-card cas-rules");
    const ul = K.el("ul");
    for (const t of [
      "20 ZCoins a bet, at most. Ten bets an hour per game, and nobody takes more than 750 ZC out of the casino in any hour.",
      "A game only runs while someone is in its room — with nobody there, nothing is drawn.",
      "One bet per person per round. Bets close before anything is drawn.",
      "Results come from a random seed made when the round is created. Its hash is shown while bets are open; the seed is revealed after, so anyone can check.",
      "Wins land in your StreamElements wallet the moment the round settles — the same wallet Picks uses."
    ]) ul.append(K.el("li", null, t));
    ul.append(K.el("li", null, "The Daily Jackpot: 100 ZC from the house, every day, paid on a bet at a moment nobody can predict. A hidden line is set in the day's play (between 300 and 2,500 ZC staked, sealed by hash at midnight); the bet that crosses it pays the Jackpot to one player drawn from everyone who played that day, by stake. After 11 PM Central the next bet pays it. A day nobody plays rolls into the next. It's the house's money, so it sits outside the hourly cap."));
    const check = K.el("li");
    const checkLink = K.el("a", "cas-rules-link", "Check a seed");
    checkLink.href = "/?view=verify";
    checkLink.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      history.pushState({ view: "verify" }, "", "/?view=verify");
      window.ECV3?.go("verify", { push: false });
    });
    check.append(
      document.createTextNode("Every result comes from a seed whose hash is shown before bets and revealed after — Verify this round on any game page shows both, and "),
      checkLink,
      document.createTextNode(" replays any seed: the deck you were dealt, where the bombs were, the path, the angle.")
    );
    ul.append(check);
    rules.append(ul);
    panels.results.append(board);
    panels.rules.append(rules);
    lower.append(panels.results, panels.rules);
    page.append(lower);
    root.append(page);
  }

  /** Wallet, net, record and the hour's cap — one bar in the header.
      These were four summary cards taking 83px above the games; the
      same four numbers read fine small, and the wallet is in the nav
      pill as well, so none of it earned a band of its own. */
  function renderMe() {
    if (!refs.me) return;
    const me = data?.me;
    refs.me.replaceChildren();
    if (!me) {
      if (data && !data.me && !window.ECV3?.state?.session?.user) {
        const go = K.el("a", "login-btn", "Log in with Twitch to play");
        go.href = "/api/picks/auth/twitch/start?returnTo=" + encodeURIComponent("/?view=casino");
        refs.me.append(go);
      }
      return;
    }
    const balance = Number(window.ECV3?.state?.session?.wallet?.balance);
    const bar = K.el("div", "cas-mebar");
    const settled = me.wins + me.losses;
    const sign = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString()}`;
    const stat = (label, value, tone, tail) => {
      const cell = K.el("span");
      cell.append(K.el("small", null, label));
      const b = K.el("b", `nums${tone ? " " + tone : ""}`, value);
      if (tail) b.append(K.el("i", null, tail));
      cell.append(b);
      return cell;
    };
    bar.append(
      stat("Wallet", Number.isFinite(balance) ? balance.toLocaleString() : "—"),
      stat("Net", sign(me.net), me.net > 0 ? "up" : me.net < 0 ? "down" : ""),
      stat("Record", settled ? `${me.wins}–${me.losses}` : "—"),
      stat("This hour", sign(me.hourNet), me.hourNet >= me.hourCap ? "down" : "", ` / ${me.hourCap.toLocaleString()}`)
    );
    refs.me.append(bar);
  }

  function renderTiles() {
    if (!data) return;
    const now = Date.now() + offset;
    for (const g of data.games) {
      const r = refs[`tile_${g.key}`];
      if (!r) continue;
      if (g.round && !g.room && !g.inRound) {
        // Nobody there: the clock is not running for anyone.
        r.phase.textContent = "Waiting for a player";
        r.phase.className = "cas-phase";
        r.clock.textContent = "";
        r.inRound.textContent = "opens when someone sits down";
      } else if (g.round) {
        const inBets = now < g.round.closesAt;
        const left = Math.max(0, Math.ceil(((inBets ? g.round.closesAt : g.round.endsAt) - now) / 1000));
        r.phase.textContent = inBets ? "Bets open" : g.key === "race" ? "Running" : g.key === "wheel" ? "Spinning" : "Result";
        r.phase.className = `cas-phase${inBets ? " open" : ""}`;
        r.clock.textContent = `${left}s`;
        r.inRound.replaceChildren();
        if (g.inRound) { r.inRound.append(document.createTextNode(`${g.inRound} in · `), K.zc(g.staked)); }
        else r.inRound.textContent = "nobody in yet";
      } else if (g.pvp) {
        // A PvP table: a lobby with a clock, or nothing until someone sits.
        if (g.lobby) {
          const left = Math.max(0, Math.ceil((g.lobby.startsAt - now) / 1000));
          r.phase.textContent = left > 0 ? "Lobby open" : "Playing";
          r.phase.className = "cas-phase open";
          r.clock.textContent = left > 0 ? `${left}s` : "";
          r.inRound.replaceChildren();
          r.inRound.append(document.createTextNode(`${g.lobby.players} in · `), K.zc(g.lobby.pot));
        } else {
          r.phase.textContent = "Sit down to open a table";
          r.phase.className = "cas-phase";
          r.clock.textContent = "";
          r.inRound.textContent = `20 a seat · starts ${g.lobbySeconds || 60}s after the first`;
        }
      } else {
        r.phase.textContent = g.inRound ? `${g.inRound} run${g.inRound === 1 ? "" : "s"} live` : "Deal any time";
        r.phase.className = `cas-phase${g.inRound ? " open" : ""}`;
        r.clock.textContent = "";
        r.inRound.textContent = "your own deck";
      }
      r.room.textContent = `${g.room} in the room`;
      renderPeople(r, g.people || []);
    }
  }

  /** The room's people as the same chips the Sports page's Who's here uses. */
  function renderPeople(r, people) {
    const sig = people.map((p) => p.login).join(",");
    if (sig === r.peopleSig) return;
    r.peopleSig = sig;
    r.people.replaceChildren();
    const shown = people.slice(0, 4);
    for (const p of shown) {
      const chip = K.el("a", "wh-chip ulink");
      chip.href = `/u/${encodeURIComponent(p.login)}`;
      chip.title = p.displayName;
      chip.addEventListener("click", (event) => event.stopPropagation());
      chip.append(K.avatar(p, "wh-av"), K.el("b", null, p.displayName));
      r.people.append(chip);
    }
    if (people.length > shown.length) r.people.append(K.el("span", "wh-chip guests", `+${people.length - shown.length} more`));
    r.people.hidden = !people.length;
  }

  function renderBoard() {
    if (!data || !refs.board) return;
    refs.board.replaceChildren();
    if (!data.board.length) { refs.board.append(K.el("p", "cf-empty", "Nothing settled yet. The first result goes here.")); return; }
    const pg = K.pageOf(data.board, boardPage, 10);
    for (const w of pg.slice) {
      const won = w.status === "WON";
      const row = K.el("div", `cf-row ${won ? "won" : "lost"}`);
      row.append(K.avatar(w.user, "cf-av"));
      const who = K.el("div", "cf-who");
      who.append(K.nameLink(w.user));
      const sub = K.el("small");
      sub.append(document.createTextNode(`${GAMES[w.game]?.title || w.game} · ${w.pick} · `), K.zc(w.wager),
        document.createTextNode(w.at ? ` · ${new Date(w.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""));
      who.append(sub);
      row.append(who);
      const res = K.el("span", `cf-res nums ${won ? "up" : "down"}`);
      res.append(K.el("span", `cf-tag ${won ? "win" : "loss"}`, won ? "WIN" : "LOSS"), K.zc(w.profit, { sign: true }));
      row.append(res);
      refs.board.append(row);
    }
    refs.board.append(K.pager(pg, (n) => { boardPage = n; renderBoard(); }, "results"));
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "Casino — EastCoin";
      window.ECPresence?.beat("casino");
      build();
      poll();
      pollTimer = window.setInterval(poll, POLL_MS);
      onVis = () => { if (!document.hidden) poll(); };
      document.addEventListener("visibilitychange", onVis);
      tickTimer = window.setInterval(renderTiles, 500);
    },
    unmount() {
      window.clearInterval(pollTimer);
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      onVis = null;
      window.clearInterval(tickTimer);
      data = null; refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("casino", view);
  }
  boot();
})();

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
    flip: { title: "Coin Flip", icon: "🪙", blurb: "Heads or tails, 2×. One coin for the whole room, every 30 seconds.", route: "flip" },
    wheel: { title: "Wheel", icon: "🎡", blurb: "Red or black 2×, the gold sliver 20×. One spin a minute.", route: "wheel" },
    race: { title: "Horse Race", icon: "🐎", blurb: "Four runners from 2× to 14×. They're off every minute.", route: "race", hidden: true },
    hilo: { title: "Higher or Lower", icon: "🃏", blurb: "Your own deck. Every right call multiplies the stake; cash out any time.", route: "hilo" }
  };

  function go(route) {
    history.pushState({ view: route }, "", `/?view=${route}`);
    window.ECV3?.go(route, { push: false });
  }

  async function poll() {
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
    const head = K.el("div", "viewhead");
    const copy = K.el("div");
    const h1 = K.el("h1", null, "Casino");
    const emote = document.createElement("img");
    emote.className = "cf-title-emote";
    emote.src = "https://cdn.betterttv.net/emote/6928e7173a375a69ca4d0d47/2x.webp";
    emote.alt = "";
    emote.width = 32; emote.height = 32;
    h1.append(emote);
    copy.append(h1);
    head.append(copy);
    page.append(head);

    // Your own numbers, once the poll says who you are.
    refs.me = K.el("div", "cas-me");
    page.append(refs.me);

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
      top.append(K.el("span", "cas-icon", g.icon), K.el("h2", null, g.title));
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

    // Below the tiles: Recent results and House rules as two tabs.
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
      "20 ZCoins a bet, at most. Ten bets an hour per game, and nobody takes more than 300 ZC out of the casino in any hour.",
      "A game only runs while someone is in its room — with nobody there, nothing is drawn.",
      "One bet per person per round. Bets close before anything is drawn.",
      "Results come from a random seed made when the round is created. Its hash is shown while bets are open; the seed is revealed after, so anyone can check.",
      "Wins land in your StreamElements wallet the moment the round settles — the same wallet Picks uses."
    ]) ul.append(K.el("li", null, t));
    ul.append(K.el("li", null, "Every result comes from a seed whose hash is shown before bets and revealed after — Verify this round on any game page shows both."));
    rules.append(ul);
    panels.results.append(board);
    panels.rules.append(rules);
    lower.append(panels.results, panels.rules);
    page.append(lower);
    root.append(page);
  }

  /** The strip: wallet, casino net, record, and where you stand against the hour's cap. */
  function renderMe() {
    if (!refs.me) return;
    const me = data?.me;
    refs.me.replaceChildren();
    if (!me) {
      if (data && !data.me && !window.ECV3?.state?.session?.user) {
        const card = K.el("div", "pf-card picks-login");
        const copy = K.el("div");
        copy.append(K.el("b", null, "Log in with Twitch to play"), K.el("span", null, "Your ZCoins from chat come with you. 20 a bet, ten an hour per game."));
        const go = K.el("a", "login-btn", "Log in with Twitch");
        go.href = "/api/picks/auth/twitch/start?returnTo=" + encodeURIComponent("/?view=casino");
        card.append(copy, go);
        refs.me.append(card);
      }
      return;
    }
    const balance = Number(window.ECV3?.state?.session?.wallet?.balance);
    const strip = K.el("div", "summarystrip four");
    const cards = [
      ["My ZCoins wallet", Number.isFinite(balance) ? balance.toLocaleString() : "—", "Live from StreamElements", "wallet"],
      ["Casino net", `${me.net > 0 ? "+" : me.net < 0 ? "−" : ""}${Math.abs(me.net).toLocaleString()}`, me.wins + me.losses ? `${me.wins + me.losses} bet${me.wins + me.losses === 1 ? "" : "s"} settled` : "Nothing settled yet", me.net > 0 ? "up" : me.net < 0 ? "down" : ""],
      ["Record", `${me.wins}–${me.losses}`, me.wins + me.losses ? `${Math.round(100 * me.wins / (me.wins + me.losses))}% of settled bets` : "First bet decides it", ""],
      ["This hour", `${me.hourNet > 0 ? "+" : me.hourNet < 0 ? "−" : ""}${Math.abs(me.hourNet).toLocaleString()}`, me.hourNet >= me.hourCap ? "At the cap — back next hour" : `Winnings cap ${me.hourCap.toLocaleString()} an hour`, me.hourNet >= me.hourCap ? "down" : ""]
    ];
    for (const [k, v, note, tone] of cards) {
      const card = K.el("article", `summarycard${tone ? " " + tone : ""}`);
      card.append(K.el("span", null, k), K.el("strong", "nums", v), K.el("small", null, note));
      if (tone === "wallet") {
        const coin = document.createElement("img");
        coin.className = "zc-full"; coin.src = "/v3/assets/img/zcoin.webp"; coin.alt = ""; coin.width = 64; coin.height = 64;
        card.append(coin);
      }
      strip.append(card);
    }
    refs.me.append(strip);
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
      tickTimer = window.setInterval(renderTiles, 500);
    },
    unmount() {
      window.clearInterval(pollTimer);
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

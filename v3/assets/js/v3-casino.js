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

  const GAMES = {
    flip: { title: "Coin Flip", icon: "🪙", blurb: "Heads or tails, 2×. One coin for the whole room, every 30 seconds.", route: "flip" },
    wheel: { title: "Wheel", icon: "🎡", blurb: "Red or black 2×, the gold sliver 8×. One spin a minute.", route: "wheel" },
    race: { title: "Horse Race", icon: "🐎", blurb: "Four runners from 2× to 14×. They're off every minute.", route: "race" },
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
    copy.append(h1, K.el("p", null, "ZCoins only. Every result is drawn from a seed whose hash you see before you bet, and every game pays back the same 96% over time — except the coin, which pays the full 100%."));
    head.append(copy);
    page.append(head);

    refs.tiles = K.el("div", "cas-tiles");
    for (const [key, g] of Object.entries(GAMES)) {
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
      tile.append(top, K.el("p", "cas-blurb", g.blurb), status, meta, K.el("span", "cas-play", "Play →"));
      refs[`tile_${key}`] = { tile, clock, phase, inRound, room };
      refs.tiles.append(tile);
    }
    page.append(refs.tiles);

    const lower = K.el("div", "cas-lower");
    const board = K.el("section", "cf-card");
    const bh = K.el("h2", null, "Recent results");
    bh.append(K.el("small", null, "every game, wins and losses"));
    refs.board = K.el("div", "cf-list");
    board.append(bh, refs.board);

    const rules = K.el("section", "cf-card cas-rules");
    rules.append(K.el("h2", null, "House rules"));
    const ul = K.el("ul");
    for (const t of [
      "20 ZCoins a bet, at most. Ten bets an hour per game, and nobody takes more than 300 ZC out of the casino in any hour.",
      "A game only runs while someone is in its room — with nobody there, nothing is drawn.",
      "One bet per person per round. Bets close before anything is drawn.",
      "Results come from a random seed made when the round is created. Its hash is shown while bets are open; the seed is revealed after, so anyone can check.",
      "Wins land in your StreamElements wallet the moment the round settles — the same wallet Picks uses.",
      "The house edge is 4% on the Wheel, the Race and Higher or Lower. The Coin Flip has none."
    ]) ul.append(K.el("li", null, t));
    rules.append(ul);
    lower.append(board, rules);
    page.append(lower);
    root.append(page);
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
    }
  }

  function renderBoard() {
    if (!data || !refs.board) return;
    refs.board.replaceChildren();
    if (!data.board.length) { refs.board.append(K.el("p", "cf-empty", "Nothing settled yet. The first result goes here.")); return; }
    for (const w of data.board) {
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

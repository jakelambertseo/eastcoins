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
  /* The card art is served with an hour of cache and no version in its
     own path, so a redrawn card would take up to an hour to appear.
     Bump this whenever an image in /v3/assets/img/casino/ changes. */
  const ART_V = 2;
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
    wheel: { title: "Wheel", icon: "🎡", blurb: "Red or black 1.97×, the gold sliver 58×. One spin a minute.", route: "wheel" },
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

  /* Two calls. The floor itself is public and shared at the edge, so
     polling it every five seconds costs the origin almost nothing. The
     viewer's own numbers are private and cost a dozen queries, so they
     are asked for every fifteen seconds and whenever the tab comes back.
     Nothing on them changes faster than that on the floor: plays happen
     on the game pages. */
  const ME_MS = 15000;
  let me = null;
  let meAt = 0;

  async function pollMe() {
    await window.ECV3?.sessionReady;      // never guess "signed out" before the session read lands
    if (!window.ECV3?.state?.session?.user) { me = null; return; }
    if (Date.now() - meAt < ME_MS) return;
    meAt = Date.now();
    try {
      const p = await fetch("/api/casino/me", { credentials: "include" }).then((r) => r.json());
      if (p?.ok) me = p.me || null;
    } catch { /* keep the last numbers */ }
  }

  async function poll() {
    if (document.hidden) return;          // the floor is a display; it can wait
    try {
      const [payload] = await Promise.all([
        fetch("/api/casino/home").then((r) => r.json()),
        pollMe()
      ]);
      if (!payload?.ok) throw new Error("home");
      offset = payload.now - Date.now();
      data = { ...payload, me };
      renderTiles();
      renderBoard();
      renderMe();
    } catch { /* keep the last picture */ }
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = K.el("section", "casino");

    /* The tables, wins and losses both, as the first thing on the page
       above the title. It ran wins-only for a day; a casino that only
       ever reports winning is not telling the room anything. */
    const ticker = K.el("section", "ticker cas-ticker");
    page.append(ticker);
    window.setTimeout(() => {
      if (ticker.isConnected && window.ECActivity) {
        window.ECActivity.mountTicker(ticker, {
          types: ["casino", "pot"],
          label: "TABLES", href: "/?view=activity",
          empty: "Quiet for now — the first spin lands here."
        });
      }
    }, 0);

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

    /* The bar is built once and only its numbers change afterwards.
       renderMe() used to replace the whole thing every five seconds,
       which would have torn the Jackpot's poller down and stood a new
       one up at three times its rate. */
    refs.me = K.el("div", "cas-headme");
    refs.mebar = K.el("div", "cas-mebar");
    window.ECPot?.mount(refs.mebar, { pill: true });
    refs.stats = {};
    for (const [key, label] of [["wallet", "Wallet"], ["net", "Net"], ["record", "Record"], ["hour", "This hour"]]) {
      const cell = K.el("span");
      const value = K.el("b", "nums", "—");
      const tag = K.el("small");
      if (key === "wallet") {
        // The wallet is the one number here that is money rather than a
        // score, so it wears the coin.
        const coin = document.createElement("img");
        coin.className = "zcoin-mark";
        coin.src = "/v3/assets/img/zcoin.webp";
        coin.alt = "";
        coin.width = 12; coin.height = 12;
        coin.loading = "lazy"; coin.decoding = "async";
        tag.append(document.createTextNode("My "), coin, document.createTextNode(" Wallet"));
      } else {
        tag.textContent = label;
      }
      cell.append(tag, value);
      cell.hidden = true;
      refs.stats[key] = { cell, value };
      refs.mebar.append(cell);
    }
    refs.login = K.el("a", "login-btn", "Log in to play");
    refs.login.href = "/api/picks/auth/twitch/start?returnTo=" + encodeURIComponent("/?view=casino");
    refs.login.hidden = true;
    refs.me.append(refs.mebar, refs.login);
    head.append(refs.me);
    page.append(head);

    /* Portrait colour panels with the name on the art and the live
       line under it, the way a casino lobby usually reads. The blurb
       and who is in the room moved to the card's title, so the face
       carries the game and its state and nothing else. These are
       `cas-card`, not `cas-tile`: the Game Room still uses `cas-tile`
       and is not part of this. */
    refs.tiles = K.el("div", "cas-cards");
    for (const [key, g] of Object.entries(GAMES)) {
      if (g.hidden) continue;
      const tile = K.el("a", `cas-card cas-${key}`);
      tile.href = `/?view=${g.route}`;
      tile.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        go(g.route);
      });

      const art = K.el("div", "cas-card-art");
      /* The painted art for this game. Every card is eager: all seven
         are above the fold, so lazy-loading them only buys a flash of
         empty panel. The accent behind it shows until it arrives, and
         the emoji comes back if it never does. */
      const pic = document.createElement("img");
      pic.className = "cas-card-img";
      pic.src = `/v3/assets/img/casino/${key}.webp?v=${ART_V}`;
      pic.alt = "";
      pic.width = 540; pic.height = 720;
      pic.decoding = "async";
      pic.addEventListener("error", () => { pic.remove(); art.classList.add("no-art"); });
      const icon = K.el("span", "cas-card-ico", g.icon || "");
      const name = K.el("div", "cas-card-name");
      name.append(K.el("b", null, g.title), K.el("small", null, "EastCoin original"));
      art.append(pic, icon, name);

      const live = K.el("div", "cas-card-live");
      const dot = K.el("i", "cas-card-dot");
      const phase = K.el("span", "cas-card-phase", "");
      const clock = K.el("b", "cas-card-clock nums", "");
      // Who is in the room, as a pile of small faces with the count after
      // it. Only rebuilt when the roster changes: this runs twice a second.
      const right = K.el("span", "cas-card-right");
      const who = K.el("span", "cas-card-who");
      const room = K.el("span", "cas-card-room", "");
      right.append(who, room);
      live.append(dot, phase, clock, right);

      // Plays left this hour, in this game. Signed out it stays hidden.
      const plays = K.el("div", "cas-card-plays");
      plays.hidden = true;

      tile.append(art, live, plays);
      refs[`tile_${key}`] = { tile, clock, phase, room, who, plays, name: g.title, blurb: g.blurb, peopleSig: "" };
      refs.tiles.append(tile);
    }
    page.append(refs.tiles);

    /* The Jackpot rides in the header bar now and the tables' ticker is
       gone: it repeated what the ledger below already says, in a strip
       nobody reads while deciding what to play. */
    /* The ledger folds away and starts closed. It is the longest thing
       on the page and it is reference, not a reason anyone opened the
       casino — so it costs a line until it is asked for. */
    const ledgerHead = K.el("button", "cas-ledger-head");
    ledgerHead.type = "button";
    ledgerHead.setAttribute("aria-expanded", "false");
    const ledgerTitle = K.el("h2", null, "Casino ledger");
    ledgerTitle.append(K.el("i", "cas-fold-mark"));
    ledgerHead.append(ledgerTitle, K.el("span", null, "Every settled bet, newest first"));
    page.append(ledgerHead);

    // Recent results and House rules as two tabs.
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
    const ledgerBody = K.el("div", "cas-ledger-body");
    ledgerBody.hidden = true;
    ledgerHead.addEventListener("click", () => {
      const open = ledgerBody.hidden;
      ledgerBody.hidden = !open;
      ledgerHead.setAttribute("aria-expanded", String(open));
      ledgerHead.classList.toggle("open", open);
    });
    ledgerBody.append(tabs);
    page.append(ledgerBody);
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
    ledgerBody.append(lower);
    root.append(page);
  }

  /** Wallet, net, record and the hour's cap, written into the header
      bar the build already made. These were four summary cards taking
      83px above the games; the same numbers read fine small, and the
      wallet is in the nav pill as well. The Jackpot cell beside them
      is ECPot's, and is left alone. */
  function renderMe() {
    if (!refs.mebar) return;
    const me = data?.me;
    if (!me) {
      const anon = data && !data.me && !window.ECV3?.state?.session?.user;
      refs.login.hidden = !anon;
      for (const k of Object.keys(refs.stats)) refs.stats[k].cell.hidden = true;
      return;
    }
    refs.login.hidden = true;
    const balance = Number(window.ECV3?.state?.session?.wallet?.balance);
    const settled = me.wins + me.losses;
    const sign = (n) => `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${Math.abs(n).toLocaleString()}`;
    const put = (key, value, tone, tail) => {
      const { cell, value: node } = refs.stats[key];
      cell.hidden = false;
      node.className = `nums${tone ? " " + tone : ""}`;
      node.replaceChildren(document.createTextNode(value));
      if (tail) node.append(K.el("i", null, tail));
    };
    put("wallet", Number.isFinite(balance) ? balance.toLocaleString() : "\u2014");
    put("net", sign(me.net), me.net > 0 ? "up" : me.net < 0 ? "down" : "");
    put("record", settled ? `${me.wins}\u2013${me.losses}` : "\u2014");
    put("hour", sign(me.hourNet), me.hourNet >= me.hourCap ? "down" : "", ` / ${me.hourCap.toLocaleString()}`);
  }

  function renderTiles() {
    if (!data) return;
    const now = Date.now() + offset;
    for (const g of data.games) {
      const r = refs[`tile_${g.key}`];
      if (!r) continue;
      let phase = "";
      let clock = "";
      let hot = false;

      if (g.round && !g.room && !g.inRound) {
        phase = "Waiting for a player";              // the clock runs for nobody
      } else if (g.round) {
        const inBets = now < g.round.closesAt;
        const left = Math.max(0, Math.ceil(((inBets ? g.round.closesAt : g.round.endsAt) - now) / 1000));
        phase = inBets ? "Bets open" : g.key === "race" ? "Running" : g.key === "wheel" ? "Spinning" : "Result";
        clock = `${left}s`;
        hot = inBets;
      } else if (g.pvp) {
        if (g.lobby) {
          const left = Math.max(0, Math.ceil((g.lobby.startsAt - now) / 1000));
          phase = left > 0 ? "Lobby open" : "Playing";
          clock = left > 0 ? `${left}s` : "";
          hot = true;
        } else {
          phase = "Sit down to open a table";
        }
      } else {
        phase = g.inRound ? `${g.inRound} run${g.inRound === 1 ? "" : "s"} live` : "Deal any time";
        hot = Boolean(g.inRound);
      }

      r.phase.textContent = phase;
      r.clock.textContent = clock;

      const cap = Number(data.me?.playsCap || 0);
      if (cap && data.me?.played) {
        const left = Math.max(0, cap - Number(data.me.played[g.key] || 0));
        r.plays.hidden = false;
        // Short on purpose: the long form ran to the exact width of a
        // card, so any narrower column would have clipped it.
        r.plays.textContent = `${left}/${cap} plays left`;
        r.plays.classList.toggle("out", left === 0);
        r.plays.title = left
          ? `${left} of ${cap} plays left this hour in ${r.name}. The limit is ten per game, not ten across the floor.`
          : `That's ${cap} this hour in this game — the limit. Back next hour.`;
      } else {
        r.plays.hidden = true;
      }
      const seats = g.pvp && g.lobby ? g.lobby.players : g.room;
      r.room.textContent = seats ? String(seats) : "";
      r.tile.classList.toggle("hot", hot);

      // The blurb and who is in the room live here rather than on the
      // face of the card, so nothing was lost by quieting it down.
      const names = (g.people || []).map((x) => x.displayName || x.login).filter(Boolean);
      const sig = names.join(",");
      if (sig !== r.peopleSig) {
        r.peopleSig = sig;
        r.who.replaceChildren();
        for (const person of (g.people || []).slice(0, 4)) {
          const face = K.avatar(person, "cf-av cas-face");
          face.title = person.displayName || person.login;
          r.who.append(face);
        }
        r.tile.title = names.length ? `${r.blurb}\n\nIn the room: ${names.join(", ")}` : r.blurb;
      }
    }
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
      onVis = () => { if (!document.hidden) { meAt = 0; poll(); } };
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

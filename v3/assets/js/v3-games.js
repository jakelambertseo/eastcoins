/* ============================================================
   EastCoin V3 — the Games floor

     /?view=games

   (2026-10-11, the owner: "make the games page highly mimic the casino
   page (with cards, etc), but give it a slightly different formatting.
   then put it on the games page alone, and move the eastscape card
   there too." Then: "remove all the quick games / section under CS67
   and EastScape.") The casino's cards, two of them: CS67 and EastScape
   as wide 16:9 cards, and nothing else. The quick games (Helmet Zoom,
   Simon, Field Goal, Dead Centre, the Gold Button) keep their routes and
   their API, but the floor no longer lists them or their boards.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 45000;
  const ART_V = 1;
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const ARCADE = LOCAL ? "http://localhost:8788" : "https://arcade.eastcoin.vip";
  let root = null;
  let refs = {};
  let timer = 0;

  const el = (t, c, x) => K.el(t, c, x);

  /* The two big games. CS67's key in /api/games/home is still "blockshot"
     (its files keep that name); the card is CS67 whatever the API calls it. */
  const BIG = {
    cs67: { title: "CS67", sub: "EastCoin's shooter", icon: "🔫", route: "cs67", art: `/v3/assets/img/games/cs67.webp?v=${ART_V}`, rgb: "26,120,200", ribbon: "Now Open", spooky: true,   /* (2026-10-11, the owner) the glow, fog and bats moved here from EastScape */
      blurb: "",   /* (2026-10-11, the owner) no hover description */
      feats: [["Fast-paced arena shooting", "against EastCoin members"], ["Free-for-all, Gun Game, Bomb 3v3", "and Parkour with friends"], ["Spin cases for knife and gun finishes", "with Brass you earn"], ["Levels, skins and daily challenges", "on your Twitch account"]] },
    eastscape: { title: "EastScape", sub: "EastCoin Casino MMO", icon: "🗺️", href: "/eastscape", art: "/v3/assets/img/casino/eastscape.webp?v=5", rgb: "255,122,26",
      online: "/api/eastscape/online", blurb: "Every casino game, in a world you walk around. Fight, mine, fish and craft for ZCoins.",
      feats: [["A world you walk around", "with every casino table in it"], ["Fight, mine, fish and craft", "for ZCoins and tickets"], ["Dungeons, raids and world events", "with everyone online at once"], ["Pets, rolled loot and artifacts", "to chase for the long haul"]] }
  };

  /* COMING SOON (2026-10-11, the owner: "add another section with Coming Soon and add poker to the games section as a card … there
     will be Texas Hold Em, BlackJack"). A card with a ribbon and no link; the picture is the Lounge's poker table mid-hand. */
  const SOON = {
    poker: { title: "Poker", sub: "Cards for tickets", icon: "🃏", art: `/v3/assets/img/games/poker.webp?v=${ART_V}`, rgb: "214,40,110", ribbon: "Coming Soon", soon: true,
      blurb: "Sit down at a table in the Lounge and play the regulars for tickets.",
      feats: [["Texas Hold 'Em", "sit-and-go tables against EastCoin members"], ["Blackjack", "against the house, hand after hand"], ["Tickets on the table", "ZCoins become tickets at the cashier"], ["Dealt by the room server", "you are only ever shown your own cards"]] }
  };
  function go(route) {
    history.pushState({ view: route }, "", `/?view=${route}`);
    window.ECV3?.go(route, { push: false });
  }

  /* One card, the casino's shape: an art panel with the name across the
     foot of it, a live line under the panel. */
  function card(key, g, { big = false } = {}) {
    const playable = Boolean(g.route || g.href) && !g.soon;
    const tile = el(playable ? "a" : "div", `cas-card games-card games-${key}${big ? " big" : ""}${g.href ? " open" : ""}${g.spooky ? " spooky" : ""}`);
    tile.style.setProperty("--card-rgb", g.rgb);
    if (g.href) tile.href = g.href;   // a page of its own, not a route: an ordinary link
    else if (g.route) {
      tile.href = `/?view=${g.route}`;
      tile.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(g.route); });
    }
    tile.title = g.blurb || "";

    const art = el("div", "cas-card-art");
    if (g.art) {
      const pic = document.createElement("img");
      pic.className = "cas-card-img";
      pic.src = g.art; pic.alt = ""; pic.decoding = "async";
      pic.addEventListener("error", () => { pic.remove(); art.classList.add("no-art"); });
      art.append(pic);
    } else art.classList.add("no-art");
    art.append(el("span", "cas-card-ico", g.icon || ""));
    const name = el("div", "cas-card-name");
    name.append(el("b", null, g.title), el("small", null, g.sub || (g.daily ? "One a day" : "Play any time")));
    art.append(name);
    if (g.ribbon) art.append(el("span", `cas-card-ribbon${g.soon ? "" : " open"}`, g.ribbon));
    if (g.spooky) for (const c of ["es-fog", "es-bat b1", "es-bat b2", "es-glow"]) art.append(el("span", `es-fx ${c}`));
    tile.append(art);

    const live = el("div", "cas-card-live");
    tile.append(live);
    /* (2026-10-11, the owner: "add stylized features below every game of what it includes") */
    if (g.feats) { const ul = el("ul", "games-feats"); for (const [lead, rest] of g.feats) { const li = el("li"), txt = el("span"); txt.append(el("b", null, lead), document.createTextNode(` ${rest}`)); li.append(txt); ul.append(li); } tile.append(ul); }
    return { tile, live };
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "casino gameroom games-floor");

    const head = el("div", "viewhead cas-head");
    const copy = el("div");
    copy.append(el("h1", null, "Games"), el("p", null, "Two worlds: Counterstrike 67 and EastScape."));
    head.append(copy);
    page.append(head);

    // the two worlds
    refs.big = el("div", "cas-cards games-cards");
    for (const [key, g] of Object.entries(BIG)) {
      const c = card(key, g, { big: true });
      if (key === "cs67") { refs.cs67 = c.live; c.live.append(el("i", "cas-card-dot"), el("span", "cas-card-phase", "Looking for the rooms…")); }
      if (g.online) { const on = el("div", "cas-card-online"); on.hidden = true; c.live.replaceWith(on); refs.online = { el: on, url: g.online }; }   // in the live line's place, above the features, so both columns line up
      refs.big.append(c.tile);
    }
    page.append(refs.big);

    // coming soon
    page.append(el("p", "games-eyebrow", "Coming soon"));
    const soon = el("div", "cas-cards games-cards");
    for (const [key, g] of Object.entries(SOON)) { const c = card(key, g, { big: true }); c.tile.classList.add("soon"); c.live.append(el("i", "cas-card-dot"), el("span", "cas-card-phase", g.blurb)); soon.append(c.tile); }
    page.append(soon);

    root.append(page);
  }

  /* Who is in CS67 right now: the four rooms' public /state, added up
     (names from every room, the count from all four). Four small CORS
     reads every 45 s while the page is open; nothing touches a database. */
  async function pollRooms() {
    const live = refs.cs67; if (!live || document.hidden) return;
    const rooms = [["bs", "Free-for-all"], ["gg", "Gun Game"], ["bomb", "Bomb"], ["park", "Parkour"]];
    const got = await Promise.all(rooms.map(async ([p, n]) => { try { const j = await fetch(`${ARCADE}/${p}/state`, { cache: "no-store" }).then((r) => r.json()); return j?.ok ? { n, playing: j.playing || 0, names: j.names || [] } : null; } catch { return null; } }));
    if (refs.cs67 !== live) return;
    const up = got.filter(Boolean);
    live.replaceChildren();
    const dot = el("i", "cas-card-dot");
    if (!up.length) { live.append(dot, el("span", "cas-card-phase", "The match server isn't answering")); live.parentElement?.classList.remove("hot"); return; }
    const total = up.reduce((s, r) => s + r.playing, 0), names = [...new Set(up.flatMap((r) => r.names))].slice(0, 6);
    live.parentElement?.classList.toggle("hot", total > 0);
    live.append(dot, el("span", "cas-card-phase", total ? `${total} playing now${names.length ? ` · ${names.join(", ")}` : ""}` : "Bots only right now · jump in"));
    const busiest = up.filter((r) => r.playing).sort((a, b) => b.playing - a.playing)[0];
    if (busiest) { const right = el("span", "cas-card-right"); right.append(el("span", "cas-card-room", busiest.n)); live.append(right); }
  }

  /* EastScape's "N people online now", the casino floor's own code: once a
     minute while the tab is visible, from /api/eastscape/online's 30-second
     edge cache. */
  let onlineTimer = 0;
  async function pollOnline() {
    const o = refs.online; if (!o || document.hidden) return;
    try {
      const r = await fetch(o.url, { cache: "no-store" }); if (!r.ok) throw new Error(String(r.status));
      const n = Math.max(0, Number((await r.json()).online) || 0);
      if (refs.online !== o) return;
      o.el.textContent = "";
      o.el.classList.toggle("none", n === 0);
      o.el.append(el("i"), n === 0 ? document.createTextNode("Nobody online right now") : el("span", null, `${n.toLocaleString()} ${n === 1 ? "person" : "people"} online now`));
      o.el.hidden = false;
    } catch (e) { o.el.hidden = true; }
  }

  const view = {
    mount(container) {
      root = container;
      document.title = "Games — EastCoin";
      window.ECPresence?.beat("games");
      build();
      pollRooms();
      pollOnline();
      timer = window.setInterval(() => { if (!document.hidden) pollRooms(); }, POLL_MS);
      onlineTimer = window.setInterval(pollOnline, 60000);
      document.addEventListener("visibilitychange", pollOnline);
    },
    unmount() {
      window.clearInterval(timer); timer = 0;
      window.clearInterval(onlineTimer); onlineTimer = 0;
      document.removeEventListener("visibilitychange", pollOnline);
      refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("games", view);
  }
  boot();
})();

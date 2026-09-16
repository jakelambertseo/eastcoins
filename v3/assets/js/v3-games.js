/* ============================================================
   EastCoin V3 — the Game Room

     /?view=games

   Small games played for titles. Today's games with where you got to
   in each, the day's boards, and who has taken the most days this
   month. No ZCoins anywhere: that is what the casino is for, and
   keeping them out is what lets these games be quick and silly.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POLL_MS = 45000;
  let root = null;
  let shell = null;
  let refs = {};
  let data = null;
  let timer = 0;

  const el = (t, c, x) => K.el(t, c, x);

  async function load() {
    try {
      const payload = await fetch("/api/games/home", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error(payload?.code || "home");
      data = payload;
      render();
    } catch {
      if (refs.status) refs.status.textContent = "Reconnecting…";
    }
  }

  function go(route) {
    history.pushState({ view: route }, "", `/?view=${route}`);
    window.ECV3?.go(route, { push: false });
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "gameroom");

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Game Room"),
      el("p", null, "Quick games for titles, not ZCoins. The crest is a new one every day at midnight Central, the rest are open all hours, and the gold button turns up when it feels like it."));
    head.append(copy);
    refs.status = el("span", "cf-status", "Loading…");
    head.append(refs.status);
    page.append(head);

    refs.tiles = el("div", "gr-tiles");
    page.append(refs.tiles);

    const lower = el("div", "gr-lower");
    const boards = el("section", "cf-card");
    const bh = el("h2", null, "Today's board");
    refs.boardNote = el("small");
    bh.append(refs.boardNote);
    refs.boards = el("div", "gr-boards");
    boards.append(bh, refs.boards);

    const champs = el("section", "cf-card");
    const ch = el("h2", null, "Most days won");
    ch.append(el("small", null, "last 30 days"));
    refs.champs = el("div", "gr-champs");
    champs.append(ch, refs.champs);

    lower.append(boards, champs);
    page.append(lower);
    root.append(page);
  }

  function tile(g) {
    // The Gold Button has no page of its own: it comes to you.
    const playable = Boolean(g.route);
    const a = el(playable ? "a" : "div", `cas-tile gr-tile gr-${g.key}${g.open ? " is-open" : ""}`);
    if (playable) {
      a.href = `/?view=${g.route}`;
      a.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(g.route); });
    }

    const top = el("div", "cas-tile-top");
    top.append(el("span", "cas-ico", g.icon));
    const name = el("div");
    name.append(el("b", null, g.name));
    name.append(el("small", null, g.daily ? "One a day" : "Play as often as you like"));
    top.append(name);
    a.append(top);
    a.append(el("p", "cas-blurb", g.blurb));

    const foot = el("div", "gr-tile-foot");
    if (g.state) foot.append(el("span", `gr-state${g.played ? " done" : ""}`, g.state));
    else if (g.daily) foot.append(el("span", "gr-state new", "Not played yet"));
    const top1 = g.key === "gold" ? null : g.board?.[0];
    if (top1) {
      const lead = el("span", "gr-lead");
      lead.append(document.createTextNode("Leader "), el("b", null, top1.user.displayName), document.createTextNode(` · ${top1.score}`));
      foot.append(lead);
    }
    a.append(foot);

    if (g.record?.streak > 1) a.append(el("span", "gr-streak", `🔥 ${g.record.streak} days`));
    a.append(el("span", "cas-play", playable ? "Play →"
      : g.open ? "It's up — look bottom left"
        : g.winner ? `Taken by ${g.winner.user.displayName}`
          : "Watch for it"));
    return a;
  }

  /** Each game counts something different; say which. */
  function scoreWords(key, row) {
    if (key === "helmet") return row.detail?.solved ? `${row.detail.guesses}${row.detail.guesses === 1 ? " guess" : " guesses"}` : "missed";
    if (key === "simon") return `${row.score} round${row.score === 1 ? "" : "s"}`;
    if (key === "centre") return `${row.score} points`;
    if (key === "gold") return row.detail?.tookMs ? `${(row.detail.tookMs / 1000).toFixed(1)}s` : "took it";
    return `${row.score} made${row.detail?.longest ? ` · ${row.detail.longest}yd` : ""}`;
  }

  function render() {
    if (!data || !refs.tiles) return;
    refs.status.textContent = data.playersToday ? `${data.playersToday} played today` : "Nobody has played yet today";

    refs.tiles.replaceChildren();
    for (const g of data.games) refs.tiles.append(tile(g));

    refs.boardNote.textContent = data.day;
    refs.boards.replaceChildren();
    for (const g of data.games) {
      const col = el("div", "gr-boardcol");
      col.append(el("h3", null, `${g.icon} ${g.name}`));
      if (!g.board.length) { col.append(el("p", "cf-empty", "Nobody yet — first score takes it.")); refs.boards.append(col); continue; }
      for (const row of g.board) {
        const line = el("div", `gr-row${data.me && row.user.login === data.me.login ? " me" : ""}`);
        line.append(el("span", "gr-rank", `${row.rank}`));
        line.append(K.avatar(row.user, "cf-av small"));
        line.append(K.nameLink(row.user));
        line.append(el("span", "gr-score nums", scoreWords(g.key, row)));
        col.append(line);
      }
      refs.boards.append(col);
    }

    refs.champs.replaceChildren();
    if (!data.champions.length) refs.champs.append(el("p", "cf-empty", "Nobody has taken a day yet."));
    for (const c of data.champions) {
      const row = el("div", "gr-row");
      row.append(K.avatar(c.user, "cf-av small"), K.nameLink(c.user));
      row.append(el("span", "gr-score nums", `${c.wins} day${c.wins === 1 ? "" : "s"}`));
      refs.champs.append(row);
    }
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      document.title = "Game Room — EastCoin";
      window.ECPresence?.beat("games");
      build();
      load();
      timer = window.setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    },
    unmount() {
      window.clearInterval(timer);
      timer = 0;
      data = null; refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("games", view);
  }
  boot();
})();

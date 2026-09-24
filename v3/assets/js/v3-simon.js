/* ============================================================
   EastCoin V3 — Simon

     /?view=simon

   Four pads. The server shows a sequence one round at a time, you
   play it back, and it adds a pad. The page is never told more than
   the round it is about to show, so there is nothing to read ahead:
   this is the straightest game in the room.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const NAMES = ["Green", "Red", "Gold", "Blue"];
  const SHOW_MS = 460;              // a pad stays lit this long
  const GAP_MS = 150;
  let root = null;
  let shell = null;
  let refs = {};
  let toast = () => {};
  let pop = () => {};

  const game = {
    run: null, round: 0, sequence: [], answer: [],
    phase: "idle",                  // idle | showing | yours | over
    busy: false, cleared: 0, record: null, board: []
  };

  const el = (t, c, x) => K.el(t, c, x);
  const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));

  /* ---------------------------------------------------------- the run */

  async function start() {
    if (game.busy || game.phase === "showing" || game.phase === "yours") return;
    game.busy = true;
    render();
    let payload = null;
    try { payload = await fetch("/api/games/simon/start", { method: "POST", credentials: "include" }).then((r) => r.json()); } catch { payload = null; }
    game.busy = false;
    if (!payload?.ok) { toast(payload?.message || "Couldn't start a run.", true); render(); return; }
    game.run = payload.run;
    game.round = payload.round;
    game.cleared = 0;
    await show(payload.sequence);
  }

  /** Plays the round back at the player, then hands them the pads. */
  async function show(sequence) {
    game.sequence = sequence;
    game.answer = [];
    game.phase = "showing";
    render();
    await wait(600);
    for (const pad of sequence) {
      if (game.phase !== "showing") return;      // they left
      light(pad, true);
      await wait(SHOW_MS);
      light(pad, false);
      await wait(GAP_MS);
    }
    if (game.phase !== "showing") return;
    game.phase = "yours";
    render();
  }

  function light(pad, on) {
    refs.pads?.[pad]?.classList.toggle("lit", on);
  }

  async function press(pad) {
    if (game.phase !== "yours" || game.busy) return;
    light(pad, true);
    window.setTimeout(() => light(pad, false), 180);
    game.answer.push(pad);

    // Wrong the moment it is wrong, rather than after the whole round.
    const at = game.answer.length - 1;
    if (game.sequence[at] !== pad) return send();
    if (game.answer.length < game.sequence.length) return;
    send();
  }

  async function send() {
    game.busy = true;
    game.phase = "showing";
    render();
    let payload = null;
    try {
      payload = await fetch("/api/games/simon/step", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: game.run, answer: game.answer })
      }).then((r) => r.json());
    } catch { payload = null; }
    game.busy = false;
    if (!payload?.ok) { toast(payload?.message || "Lost that round.", true); game.phase = "idle"; render(); return; }

    if (!payload.over) {
      game.round = payload.round;
      game.cleared = payload.round - 1;
      toast(`Round ${payload.round}`, false);
      await wait(450);
      await show(payload.sequence);
      return;
    }

    game.phase = "over";
    game.cleared = payload.cleared;
    game.run = null;
    game.record = payload.record || game.record;
    game.board = payload.board || game.board;
    render();
    if (payload.cleared > 0) {
      pop({
        won: payload.best, big: payload.cleared >= 10, amount: 0,
        headline: `${payload.cleared} round${payload.cleared === 1 ? "" : "s"}`,
        detail: payload.best ? "Best of the day so far." : "Go again."
      });
      if (payload.cleared >= 12) K.burst?.();
    } else {
      toast("Out on the first one.", true);
    }
  }

  /* ---------------------------------------------------------- build */

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "coinflip simongame");

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Simon"),
      el("p", null, "Watch the pads, then play them back. One more every round, until you don't."));
    head.append(copy);
    const right = el("div", "cas-headright");
    refs.status = el("span", "cf-status", "Ready");
    const back = el("a", "btn cas-back", "← Game Room");
    back.href = "/?view=games";
    back.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); history.pushState({ view: "games" }, "", "/?view=games"); window.ECV3?.go("games", { push: false }); });
    right.append(refs.status, back);
    head.append(right);
    page.append(head);

    const grid = el("div", "cf-grid");
    const stage = el("section", "cf-stage");

    refs.round = el("div", "cf-phase", "");
    stage.append(refs.round);

    const boardEl = el("div", "sm-board");
    refs.pads = [];
    for (let i = 0; i < 4; i += 1) {
      const pad = el("button", `sm-pad sm-${i}`);
      pad.type = "button";
      pad.setAttribute("aria-label", NAMES[i]);
      pad.addEventListener("click", () => press(i));
      refs.pads.push(pad);
      boardEl.append(pad);
    }
    refs.hub = el("div", "sm-hub");
    refs.hubNum = el("b", null, "—");
    refs.hub.append(refs.hubNum, el("small", null, "round"));
    boardEl.append(refs.hub);
    stage.append(boardEl);

    refs.go = K.btn("Start", "cf-lock", start);
    refs.note = el("p", "cf-note", "");
    refs.limits = el("p", "cf-limits", "Keys 1 to 4 work too. Nothing here costs or pays ZCoins.");
    const bet = el("div", "cf-bet");
    bet.append(refs.go, refs.note, refs.limits);
    stage.append(bet);
    grid.append(stage);

    const col = el("div", "cf-side-col");
    const you = el("section", "cf-card");
    const yh = el("h2", null, "Your record");
    refs.youNote = el("small");
    yh.append(refs.youNote);
    refs.youList = el("div", "hl-stats");
    you.append(yh, refs.youList);

    const bd = el("section", "cf-card");
    const bh = el("h2", null, "Today");
    refs.boardNote = el("small");
    bh.append(refs.boardNote);
    refs.boardList = el("div", "gr-boardcol");
    bd.append(bh, refs.boardList);

    col.append(you, bd);
    grid.append(col);
    page.append(grid);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function render() {
    if (!refs.go) return;
    const playing = game.phase === "showing" || game.phase === "yours";
    refs.status.textContent = game.phase === "showing" ? "Watch" : game.phase === "yours" ? "Your turn" : game.phase === "over" ? `Out at ${game.cleared}` : "Ready";
    refs.round.textContent = playing ? `Round ${game.round}` : game.phase === "over" ? `${game.cleared} round${game.cleared === 1 ? "" : "s"} cleared` : "Four pads, one more every round";
    refs.round.className = `cf-phase${game.phase === "yours" ? " open" : game.phase === "over" ? " bad" : ""}`;
    refs.hubNum.textContent = playing || game.phase === "over" ? String(game.round) : "—";

    for (const pad of refs.pads) pad.disabled = game.phase !== "yours";
    refs.go.hidden = playing;
    K.plain(refs.go, game.phase === "over" ? "Go again" : "Start");
    refs.go.disabled = game.busy;
    refs.note.textContent = game.phase === "showing" ? "Watch the order."
      : game.phase === "yours" ? "Now play it back."
        : game.phase === "over" ? "Best of the day goes on the board."
          : "The sequence lives on the server and arrives one round at a time.";

    refs.youList.replaceChildren();
    if (game.record) {
      refs.youNote.textContent = `${game.record.played} day${game.record.played === 1 ? "" : "s"}`;
      const row = (k, v) => { const x = el("div", "hl-stat"); x.append(el("span", null, k), el("strong", null, v)); return x; };
      refs.youList.append(row("Best", `${game.record.best} rounds`), row("Streak", game.record.streak ? `${game.record.streak} day${game.record.streak === 1 ? "" : "s"}` : "—"));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(el("p", "cf-empty", "Log in with Twitch to keep a record."));
    }

    refs.boardList.replaceChildren();
    if (!game.board.length) refs.boardList.append(el("p", "cf-empty", "Nobody yet — first run takes it."));
    for (const row of game.board) {
      const line = el("div", "gr-row");
      line.append(el("span", "gr-rank", String(row.rank)), K.avatar(row.user, "cf-av small"), K.nameLink(row.user));
      line.append(el("span", "gr-score nums", `${row.score} round${row.score === 1 ? "" : "s"}`));
      refs.boardList.append(line);
    }
  }

  async function loadBoard() {
    try {
      const payload = await fetch("/api/games/home", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) return;
      const g = (payload.games || []).find((x) => x.key === "simon");
      if (g) { game.board = g.board || []; game.record = g.record || null; }
      refs.boardNote.textContent = payload.day;
      render();
    } catch { /* the board is decoration */ }
  }

  function onKey(e) {
    const n = ["1", "2", "3", "4"].indexOf(e.key);
    const tag = String(e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (n >= 0) { e.preventDefault(); press(n); return; }
    if ((e.code === "Space" || e.key === " ") && (game.phase === "idle" || game.phase === "over")) { e.preventDefault(); start(); }
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      document.title = "Simon — EastCoin";
      window.ECPresence?.beat("games", "Simon");
      Object.assign(game, { run: null, round: 0, sequence: [], answer: [], phase: "idle", busy: false, cleared: 0, board: [], record: null });
      build();
      render();
      loadBoard();
      document.addEventListener("keydown", onKey);
    },
    unmount() {
      document.removeEventListener("keydown", onKey);
      game.phase = "idle";
      refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("simon", view);
  }
  boot();
})();

/* ============================================================
   EastCoin V3 — Dead Centre

     /?view=centre

   A bar sweeps back and forth; stop it in the middle. Five goes, a
   couple of hundred points each, so a thousand is a good set. The sweep speeds come
   from the server and the set is scored there, so a good run cannot
   be copied into a later one.

   Like Field Goal, the meter is read from the clock at the moment of
   the press rather than from the last painted frame, so a throttled
   tab never judges a stop the player did not see.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const BASE_MS = 1900;             // one sweep at the gentlest speed
  const FAST_MS = 750;              // and at the unkindest
  let root = null;
  let shell = null;
  let refs = {};
  let toast = () => {};
  let pop = () => {};

  const game = {
    run: null, speeds: [], stops: [], shot: 0,
    phase: "idle",                  // idle | sweeping | over
    startedAt: 0, raf: 0, at: 0.5, busy: false, shots: [], total: 0, record: null, board: []
  };

  const el = (t, c, x) => K.el(t, c, x);
  const sweepMs = (speed) => BASE_MS - (BASE_MS - FAST_MS) * Math.min(1, Math.max(0, speed));

  /* ---------------------------------------------------------- the run */

  async function start() {
    if (game.busy || game.phase === "sweeping") return;
    game.busy = true;
    render();
    let payload = null;
    try { payload = await fetch("/api/games/centre/start", { method: "POST", credentials: "include" }).then((r) => r.json()); } catch { payload = null; }
    game.busy = false;
    if (!payload?.ok) { toast(payload?.message || "Couldn't start a run.", true); render(); return; }
    game.run = payload.run;
    game.speeds = payload.speeds;
    game.stops = [];
    game.shots = [];
    game.shot = 0;
    game.total = 0;
    sweep();
  }

  function sweep() {
    game.phase = "sweeping";
    game.startedAt = performance.now();
    render();
    cancelAnimationFrame(game.raf);
    const step = () => {
      if (game.phase !== "sweeping") return;
      game.at = barAt();
      paintBar();
      game.raf = requestAnimationFrame(step);
    };
    game.raf = requestAnimationFrame(step);
  }

  /** Where the bar is now, from the clock — never from the last frame. */
  function barAt() {
    const ms = sweepMs(game.speeds[game.shot] ?? 0.5);
    const t = ((performance.now() - game.startedAt) % ms) / ms;
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }

  function stop() {
    if (game.phase !== "sweeping") { if (!game.busy) start(); return; }
    const at = barAt();
    cancelAnimationFrame(game.raf);
    game.at = at;
    game.stops.push(Math.round(at * 1000) / 1000);
    const error = Math.abs(at - 0.5);
    game.shots.push({ error });
    paintBar();
    flash(error);
    game.shot += 1;
    if (game.shot >= 5) { finish(); return; }
    window.setTimeout(() => { if (game.phase === "sweeping" || game.phase === "idle") return; }, 0);
    game.phase = "between";
    render();
    window.setTimeout(() => { if (game.phase === "between") sweep(); }, 700);
  }

  function flash(error) {
    const mark = refs.pin;
    if (!mark) return;
    mark.classList.remove("good", "close", "off");
    mark.classList.add(error < 0.01 ? "good" : error < 0.04 ? "close" : "off");
    toast(error < 0.005 ? `Dead centre — ${Math.round(error * 1000)} thousandths` : `${Math.round(error * 1000)} thousandths off`, error >= 0.05);
  }

  async function finish() {
    game.phase = "over";
    cancelAnimationFrame(game.raf);
    render();
    if (!game.run) return;
    let payload = null;
    try {
      payload = await fetch("/api/games/centre/finish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: game.run, stops: game.stops })
      }).then((r) => r.json());
    } catch { payload = null; }
    game.run = null;
    if (!payload?.ok) { toast(payload?.message || "Couldn't file that run.", true); return; }
    game.total = payload.total;
    game.shots = payload.shots;
    game.record = payload.record || game.record;
    game.board = payload.board || game.board;
    render();
    pop({
      won: payload.best, big: payload.total >= 900, amount: 0,
      headline: `${payload.total}`,
      detail: payload.best ? "Best of the day so far." : "A thousand is a good set."
    });
    if (payload.total >= 950) K.burst?.();
  }

  /* ---------------------------------------------------------- paint */

  function paintBar() {
    if (!refs.pin) return;
    refs.pin.style.left = `${Math.round(game.at * 100)}%`;
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "coinflip centregame");

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Dead Centre"),
      el("p", null, "Stop the bar in the middle. Five goes, about 200 a time, and a quick sweep pays more than a slow one."));
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
    refs.phase = el("div", "cf-phase", "");
    stage.append(refs.phase);

    const track = el("div", "dc-track");
    track.append(el("i", "dc-zone"), el("i", "dc-mid"));
    refs.pin = el("b", "dc-pin");
    track.append(refs.pin);
    refs.track = track;
    stage.append(track);

    refs.dots = el("div", "dc-dots");
    stage.append(refs.dots);

    refs.go = K.btn("Start", "cf-lock", stop);
    refs.note = el("p", "cf-note", "");
    refs.limits = el("p", "cf-limits", "Space or the button. Nothing here costs or pays ZCoins.");
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
    const playing = game.phase === "sweeping" || game.phase === "between";
    refs.status.textContent = playing ? `Shot ${Math.min(5, game.shot + 1)} of 5` : game.phase === "over" ? `${game.total} points` : "Ready";
    refs.phase.textContent = playing ? `Shot ${Math.min(5, game.shot + 1)} of 5` : game.phase === "over" ? `${game.total} points` : "Five goes at the middle";
    refs.phase.className = `cf-phase${game.phase === "sweeping" ? " open" : ""}`;

    // How fast this sweep is, so the difficulty is visible before the press.
    const speed = game.speeds[game.shot] ?? 0;
    refs.track.dataset.speed = playing ? (speed > 0.66 ? "fast" : speed > 0.33 ? "mid" : "slow") : "";

    refs.dots.replaceChildren();
    for (let i = 0; i < 5; i += 1) {
      const shot = game.shots[i];
      const d = el("span", `dc-dot${shot ? (shot.points !== undefined ? (shot.points >= 150 ? " good" : shot.points > 0 ? " close" : " off") : (shot.error < 0.01 ? " good" : shot.error < 0.04 ? " close" : " off")) : ""}${i === game.shot && playing ? " at" : ""}`);
      d.textContent = shot?.points !== undefined ? String(shot.points) : shot ? "·" : "";
      refs.dots.append(d);
    }

    K.plain(refs.go, game.phase === "sweeping" ? "Stop" : game.phase === "between" ? "…" : game.phase === "over" ? "Go again" : "Start");
    refs.go.disabled = game.busy || game.phase === "between";
    refs.note.textContent = game.phase === "sweeping" ? "Stop it on the line."
      : game.phase === "over" ? "Best of the day goes on the board."
        : "The sweeps get quicker as they go, and a quicker one is worth more.";

    refs.youList.replaceChildren();
    if (game.record) {
      refs.youNote.textContent = `${game.record.played} day${game.record.played === 1 ? "" : "s"}`;
      const row = (k, v) => { const x = el("div", "hl-stat"); x.append(el("span", null, k), el("strong", null, v)); return x; };
      refs.youList.append(row("Best", `${game.record.best}`), row("Streak", game.record.streak ? `${game.record.streak} day${game.record.streak === 1 ? "" : "s"}` : "—"));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(el("p", "cf-empty", "Log in with Twitch to keep a record."));
    }

    refs.boardList.replaceChildren();
    if (!game.board.length) refs.boardList.append(el("p", "cf-empty", "Nobody yet — first run takes it."));
    for (const row of game.board) {
      const line = el("div", "gr-row");
      line.append(el("span", "gr-rank", String(row.rank)), K.avatar(row.user, "cf-av small"), K.nameLink(row.user));
      line.append(el("span", "gr-score nums", String(row.score)));
      refs.boardList.append(line);
    }
  }

  async function loadBoard() {
    try {
      const payload = await fetch("/api/games/home", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) return;
      const g = (payload.games || []).find((x) => x.key === "centre");
      if (g) { game.board = g.board || []; game.record = g.record || null; }
      refs.boardNote.textContent = payload.day;
      render();
    } catch { /* the board is decoration */ }
  }

  function onKey(e) {
    if (e.code !== "Space" && e.key !== " ") return;
    const tag = String(e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    e.preventDefault();
    stop();
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      document.title = "Dead Centre — EastCoin";
      window.ECPresence?.beat("games", "Dead Centre");
      Object.assign(game, { run: null, speeds: [], stops: [], shots: [], shot: 0, phase: "idle", busy: false, total: 0, at: 0.5, board: [], record: null });
      build();
      render();
      loadBoard();
      document.addEventListener("keydown", onKey);
    },
    unmount() {
      cancelAnimationFrame(game.raf);
      document.removeEventListener("keydown", onKey);
      game.phase = "idle";
      refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("centre", view);
  }
  boot();
})();

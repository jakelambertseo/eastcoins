/* ============================================================
   EastCoin V3 — Field Goal

     /?view=fg

   Stop the power meter, then stop the aim meter, and watch it into
   the wind. Every kick is five yards further than the last; one miss
   ends the run.

   THE MATHS HERE MIRRORS functions/api/games/fg/_fg.js — change one,
   change the other. It lives in both places because the page has to
   show the ball drifting the instant the meter stops, and the server
   has to be the one that says what the run was worth: it picks the
   wind and replays every stop at the end.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const POWER_MS = 1100;            // one sweep of the power meter
  const AIM_MS = 1500;
  let root = null;
  let shell = null;
  let refs = {};
  let toast = () => {};
  let pop = () => {};

  // The mirror. Keep these four in step with _fg.js.
  const yardsFor = (k) => 20 + k * 5;
  const powerNeeded = (yards) => (yards - 15) / 55;
  const toleranceFor = (yards) => Math.max(0.03, 0.34 - yards * 0.0032);
  const windEffectFor = (yards) => yards * 0.0035;
  const judge = (yards, wind, power, aim) => {
    if (power < powerNeeded(yards)) return { made: false, why: "short", drift: 0 };
    const drift = (aim - 0.5) * 2 + wind * windEffectFor(yards);
    const made = Math.abs(drift) <= toleranceFor(yards);
    return { made, why: made ? "good" : drift < 0 ? "wide left" : "wide right", drift };
  };

  const run = {
    id: null, winds: [], kicks: [], made: 0, kick: 0,
    phase: "idle",                  // idle | power | aim | flying | over
    power: 0, aim: 0.5, raf: 0, startedAt: 0, busy: false, best: null, record: null, board: []
  };

  const el = (t, c, x) => K.el(t, c, x);

  /* ---------------------------------------------------------- the run */

  async function start() {
    if (run.busy || run.phase === "power" || run.phase === "aim" || run.phase === "flying") return;
    run.busy = true;
    render();
    let payload = null;
    try {
      payload = await fetch("/api/games/fg/start", { method: "POST", credentials: "include" }).then((r) => r.json());
    } catch { payload = null; }
    run.busy = false;
    if (!payload?.ok) { toast(payload?.message || "Couldn't start a run.", true); render(); return; }
    run.id = payload.run;
    run.winds = payload.winds;
    run.kicks = [];
    run.made = 0;
    run.kick = 0;
    beginPower();
  }

  function beginPower() {
    run.phase = "power";
    run.startedAt = performance.now();
    render();
    tick();
  }

  /**
   * Where a meter is right now, from the clock rather than from the last
   * frame that was painted. A tab the browser has stopped animating —
   * hidden, throttled, a slow machine — would otherwise hand back
   * whatever the meter was showing when the frames stopped, and the
   * kick would be judged on a number the player never saw move.
   * Up and back down, so the top of the bar is a moment, not a shelf.
   */
  function meterAt(ms) {
    const t = ((performance.now() - run.startedAt) % ms) / ms;
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }

  function tick() {
    cancelAnimationFrame(run.raf);
    const step = () => {
      if (run.phase === "power") run.power = meterAt(POWER_MS);
      else if (run.phase === "aim") run.aim = meterAt(AIM_MS);
      else return;
      paintMeters();
      run.raf = requestAnimationFrame(step);
    };
    run.raf = requestAnimationFrame(step);
  }

  function hit() {
    if (run.phase === "power") {
      run.power = meterAt(POWER_MS);
      cancelAnimationFrame(run.raf);
      run.phase = "aim";
      run.startedAt = performance.now();
      render();
      tick();
      return;
    }
    if (run.phase === "aim") {
      run.aim = meterAt(AIM_MS);
      cancelAnimationFrame(run.raf);
      kick();
      return;
    }
    if (run.phase === "idle" || run.phase === "over") start();
  }

  async function kick() {
    const yards = yardsFor(run.kick);
    const wind = run.winds[run.kick] ?? 0;
    const shot = judge(yards, wind, run.power, run.aim);
    run.kicks.push({ power: Math.round(run.power * 1000) / 1000, aim: Math.round(run.aim * 1000) / 1000 });
    run.phase = "flying";
    render();
    await fly(shot, yards);

    if (shot.made) {
      run.made += 1;
      run.kick += 1;
      toast(`${yards} yards — good.`, false);
      if (run.kick >= run.winds.length) return finish();
      window.setTimeout(() => { if (run.phase === "flying") beginPower(); }, 550);
      return;
    }
    toast(`${yards} yards — ${shot.why}.`, true);
    finish();
  }

  /** The ball goes up, drifts by however far the aim and the wind put it. */
  function fly(shot, yards) {
    return new Promise((resolve) => {
      const ball = refs.ball;
      if (!ball) return resolve();
      // Drift of one tolerance is about a post's width on screen.
      const across = Math.max(-1.6, Math.min(1.6, shot.drift / Math.max(0.05, toleranceFor(yards)))) * 46;
      const up = shot.why === "short" ? 120 : 250;
      ball.classList.remove("made", "missed");
      ball.style.transition = "transform .95s cubic-bezier(.2,.7,.4,1)";
      ball.style.transform = `translate(${across}px, ${-up}px) scale(${shot.why === "short" ? 0.75 : 0.45}) rotate(720deg)`;
      ball.classList.add(shot.made ? "made" : "missed");
      if (shot.made) refs.posts?.classList.add("scored");
      window.setTimeout(() => {
        refs.posts?.classList.remove("scored");
        ball.style.transition = "none";
        ball.style.transform = "";
        resolve();
      }, 1000);
    });
  }

  async function finish() {
    run.phase = "over";
    cancelAnimationFrame(run.raf);
    render();
    if (!run.id) return;
    let payload = null;
    try {
      payload = await fetch("/api/games/fg/finish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: run.id, kicks: run.kicks })
      }).then((r) => r.json());
    } catch { payload = null; }
    run.id = null;
    if (!payload?.ok) { toast(payload?.message || "Couldn't file that run.", true); return; }
    run.made = payload.made;
    run.record = payload.record;
    run.board = payload.board || run.board;
    render();
    if (payload.made > 0) {
      pop({
        won: payload.best, big: payload.made >= 8, amount: 0,
        headline: `${payload.made} made`,
        detail: payload.best ? `Longest ${payload.longest} yards. Best of the day so far.` : `Longest ${payload.longest} yards.`
      });
      if (payload.made >= 10) K.burst?.();
    }
  }

  /* ---------------------------------------------------------- paint */

  function paintMeters() {
    if (!refs.powerFill) return;
    refs.powerFill.style.height = `${Math.round(run.power * 100)}%`;
    refs.aimPin.style.left = `${Math.round(run.aim * 100)}%`;
    const yards = yardsFor(run.kick);
    refs.powerMark.style.bottom = `${Math.round(Math.min(1, powerNeeded(yards)) * 100)}%`;
    const tol = toleranceFor(yards);
    refs.aimZone.style.left = `${Math.round((0.5 - tol / 2) * 100)}%`;
    refs.aimZone.style.width = `${Math.round(tol * 100)}%`;
  }

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "coinflip fggame");

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Field Goal"),
      el("p", null, "Stop the power, then stop the aim, and read the wind. Five yards further every kick; one miss ends it."));
    head.append(copy);
    const right = el("div", "cas-headright");
    refs.status = el("span", "cf-status", "");
    const back = el("a", "btn cas-back", "← Game Room");
    back.href = "/?view=games";
    back.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); history.pushState({ view: "games" }, "", "/?view=games"); window.ECV3?.go("games", { push: false }); });
    right.append(refs.status, back);
    head.append(right);
    page.append(head);

    const grid = el("div", "cf-grid");
    const stage = el("section", "cf-stage");

    const field = el("div", "fg-field");
    refs.posts = el("div", "fg-posts");
    refs.posts.append(el("i", "fg-post l"), el("i", "fg-post r"), el("i", "fg-bar"));
    field.append(refs.posts);
    refs.flag = el("div", "fg-flag");
    refs.flag.append(el("i"), el("span"));
    field.append(refs.flag);
    refs.yards = el("div", "fg-yards", "");
    field.append(refs.yards);
    refs.ball = el("div", "fg-ball", "🏈");
    field.append(refs.ball);
    stage.append(field);

    const meters = el("div", "fg-meters");
    const power = el("div", "fg-power");
    power.append(el("span", "fg-mlabel", "Power"));
    const ptrack = el("div", "fg-ptrack");
    refs.powerFill = el("i", "fg-pfill");
    refs.powerMark = el("b", "fg-pmark");
    ptrack.append(refs.powerFill, refs.powerMark);
    power.append(ptrack);
    const aim = el("div", "fg-aim");
    aim.append(el("span", "fg-mlabel", "Aim"));
    const atrack = el("div", "fg-atrack");
    refs.aimZone = el("i", "fg-azone");
    refs.aimPin = el("b", "fg-apin");
    atrack.append(refs.aimZone, refs.aimPin);
    aim.append(atrack);
    meters.append(power, aim);
    stage.append(meters);

    refs.go = K.btn("Kick", "cf-lock", hit);
    refs.note = el("p", "cf-note", "");
    refs.limits = el("p", "cf-limits", "Space or the button stops each meter. Nothing here costs or pays ZCoins.");
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
    refs.board = el("div", "gr-boardcol");
    bd.append(bh, refs.board);

    const how = el("section", "cf-card");
    how.append(el("h2", null, "The kick"));
    const ul = document.createElement("ul");
    ul.className = "hz-how";
    for (const t of [
      "Power first: the bar has to reach the mark, which climbs with the distance.",
      "Then aim: the pin has to stop inside the posts, which narrow as you go back.",
      "The wind pushes the ball across, and it pushes harder the further out you are.",
      "One miss ends the run. Best of the day goes on the board.",
      "Nobody has ever made the 75-yarder."
    ]) ul.append(el("li", null, t));
    how.append(ul);

    col.append(you, bd, how);
    grid.append(col);
    page.append(grid);

    pop = K.makePop(page);
    toast = K.makeToast(page);
    root.append(page);
  }

  function render() {
    if (!refs.go) return;
    const playing = run.phase === "power" || run.phase === "aim" || run.phase === "flying";
    const yards = yardsFor(run.kick);
    const wind = run.winds[run.kick] ?? 0;

    refs.status.textContent = playing ? `${run.made} made` : run.phase === "over" ? `Run over — ${run.made} made` : "Ready";
    refs.yards.textContent = playing || run.phase === "over" ? `${yards} yards` : "";
    refs.flag.hidden = !playing;
    refs.flag.style.setProperty("--tilt", `${Math.round(wind * 34)}deg`);
    refs.flag.querySelector("span").textContent = Math.abs(wind) < 0.12 ? "calm" : `${Math.abs(Math.round(wind * 15))} mph ${wind < 0 ? "←" : "→"}`;
    refs.flag.classList.toggle("left", wind < 0);

    const signedIn = Boolean(run.record) || run.id || run.phase !== "idle";
    K.plain(refs.go, run.phase === "power" ? "Stop the power" : run.phase === "aim" ? "Stop the aim" : run.phase === "flying" ? "…" : run.phase === "over" ? "Kick again" : "Start kicking");
    refs.go.disabled = run.busy || run.phase === "flying";
    refs.note.textContent = run.phase === "power" ? "Higher is longer. The mark is what this distance needs."
      : run.phase === "aim" ? "Stop it inside the posts, and aim into the wind."
        : run.phase === "over" ? `${run.made} made. Best of the day goes on the board.`
          : "Space or the button. Every kick is five yards further than the last.";

    refs.powerFill.style.height = `${Math.round(run.power * 100)}%`;
    refs.aimPin.style.left = `${Math.round(run.aim * 100)}%`;
    paintMeters();

    refs.youList.replaceChildren();
    if (run.record) {
      refs.youNote.textContent = `${run.record.played} day${run.record.played === 1 ? "" : "s"}`;
      const row = (k, v) => { const x = el("div", "hl-stat"); x.append(el("span", null, k), el("strong", null, v)); return x; };
      refs.youList.append(row("Best", `${run.record.best} made`), row("Streak", run.record.streak ? `${run.record.streak} day${run.record.streak === 1 ? "" : "s"}` : "—"));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(el("p", "cf-empty", "Log in with Twitch to keep a record."));
    }

    refs.board.replaceChildren();
    if (!run.board.length) refs.board.append(el("p", "cf-empty", "Nobody yet — first run takes it."));
    for (const row of run.board) {
      const line = el("div", "gr-row");
      line.append(el("span", "gr-rank", String(row.rank)), K.avatar(row.user, "cf-av small"), K.nameLink(row.user));
      line.append(el("span", "gr-score nums", `${row.score} made${row.detail?.longest ? ` · ${row.detail.longest}yd` : ""}`));
      refs.board.append(line);
    }
  }

  async function loadBoard() {
    try {
      const payload = await fetch("/api/games/home", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) return;
      const g = (payload.games || []).find((x) => x.key === "fg");
      if (g) { run.board = g.board || []; run.record = g.record || null; }
      refs.boardNote.textContent = payload.day;
      render();
    } catch { /* the board is decoration */ }
  }

  function onKey(e) {
    if (e.code !== "Space" && e.key !== " ") return;
    const tag = String(e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    e.preventDefault();
    hit();
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      document.title = "Field Goal — EastCoin";
      window.ECPresence?.beat("games", "Field Goal");
      Object.assign(run, { id: null, winds: [], kicks: [], made: 0, kick: 0, phase: "idle", power: 0, aim: 0.5, busy: false, board: [], record: null });
      build();
      render();
      loadBoard();
      document.addEventListener("keydown", onKey);
    },
    unmount() {
      cancelAnimationFrame(run.raf);
      document.removeEventListener("keydown", onKey);
      run.phase = "idle";
      refs = {};
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("fg", view);
  }
  boot();
})();

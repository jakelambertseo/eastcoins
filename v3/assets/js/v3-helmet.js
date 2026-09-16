/* ============================================================
   EastCoin V3 — Helmet Zoom

     /?view=helmet

   One NFL crest a day, cropped so close it could be anything. Six
   guesses; the crop pulls back with each wrong one, the conference
   arrives after three and the division after four.

   The page never knows the answer. It draws from
   /api/games/helmet/img, which is keyed on the day, and every guess
   is graded by the server.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const SIZE = 460;                 // the canvas, in CSS pixels
  let root = null;
  let shell = null;
  let refs = {};
  let data = null;
  let img = null;
  let busy = false;
  let toast = () => {};
  let pop = () => {};

  const el = (t, c, x) => K.el(t, c, x);

  async function load() {
    try {
      const payload = await fetch("/api/games/helmet/state", { credentials: "include" }).then((r) => r.json());
      if (!payload?.ok) throw new Error("state");
      data = payload;
      render();
    } catch { if (refs.note) refs.note.textContent = "Couldn't reach today's crest."; }
  }

  /* ---------------------------------------------------------- the crop */

  function loadImage() {
    if (img) return Promise.resolve(img);
    return new Promise((resolve) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.addEventListener("load", () => { img = i; resolve(i); });
      i.addEventListener("error", () => resolve(null));
      // The day is in the URL, never the club.
      i.src = `/api/games/helmet/img?d=${encodeURIComponent(data?.day || "")}`;
    });
  }

  async function paint() {
    const canvas = refs.canvas;
    if (!canvas || !data) return;
    const picture = await loadImage();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!picture) { ctx.fillStyle = "#1e1a17"; ctx.fillRect(0, 0, SIZE, SIZE); return; }

    const src = Math.min(picture.width, picture.height);
    const view = src / Math.max(1, data.zoom);
    // The crop stays inside the picture however tight the zoom is.
    const half = view / 2;
    const cx = Math.min(src - half, Math.max(half, data.crop.x * src));
    const cy = Math.min(src - half, Math.max(half, data.crop.y * src));
    ctx.imageSmoothingEnabled = data.zoom < 4;
    ctx.drawImage(picture, cx - half, cy - half, view, view, 0, 0, SIZE, SIZE);
  }

  /* ---------------------------------------------------------- guessing */

  async function guess(text) {
    if (busy || !text || data?.done) return;
    busy = true;
    refs.go.disabled = true;
    let payload = null;
    try {
      payload = await fetch("/api/games/helmet/guess", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: text })
      }).then((r) => r.json());
    } catch { payload = null; }
    busy = false;

    if (!payload?.ok) {
      refs.go.disabled = false;
      toast(payload?.message || "That didn't go through.", true);
      if (payload?.code === "DONE") load();
      return;
    }

    Object.assign(data, {
      guesses: payload.guesses, done: payload.done, solved: payload.right,
      left: payload.left, zoom: payload.zoom, hints: payload.hints, answer: payload.answer
    });
    if (payload.record && data.me) data.me.record = payload.record;
    if (payload.board) data.board = payload.board;
    refs.input.value = "";
    render();
    await paint();

    if (payload.done && payload.right) {
      pop({ won: true, big: payload.guesses.length <= 2, amount: 0, headline: `Got it in ${payload.guesses.length}`, detail: `${payload.answer.name}. Score ${payload.score}.` });
      if (payload.guesses.length === 1) K.burst?.();
    } else if (payload.done) {
      toast(`It was the ${payload.answer.name}.`, true);
    }
  }

  /* ---------------------------------------------------------- the share line */

  function shareLine() {
    if (!data?.done) return "";
    const squares = data.guesses.map((g) => (g.right ? "🟩" : "🟥")).join("");
    const tail = data.solved ? `${data.guesses.length}/6` : "X/6";
    return `EastCoin Helmet Zoom ${data.day} ${tail}\n${squares}\neastcoin.vip/?view=helmet`;
  }

  /* ---------------------------------------------------------- build */

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "coinflip helmetgame");

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Helmet Zoom"),
      el("p", null, "One NFL crest, far too close. Six guesses; it pulls back with every wrong one."));
    head.append(copy);
    const right = el("div", "cas-headright");
    refs.left = el("span", "cf-status", "");
    const back = el("a", "btn cas-back", "← Game Room");
    back.href = "/?view=games";
    back.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); history.pushState({ view: "games" }, "", "/?view=games"); window.ECV3?.go("games", { push: false }); });
    right.append(refs.left, back);
    head.append(right);
    page.append(head);

    const grid = el("div", "cf-grid");
    const stage = el("section", "cf-stage");

    const frame = el("div", "hz-frame");
    refs.canvas = document.createElement("canvas");
    refs.canvas.className = "hz-canvas";
    refs.canvas.setAttribute("role", "img");
    refs.canvas.setAttribute("aria-label", "A very close crop of an NFL crest");
    frame.append(refs.canvas);
    refs.reveal = el("div", "hz-reveal");
    refs.reveal.hidden = true;
    frame.append(refs.reveal);
    stage.append(frame);

    refs.hints = el("div", "hz-hints");
    stage.append(refs.hints);

    const form = el("form", "hz-form");
    refs.input = document.createElement("input");
    refs.input.className = "hz-input";
    refs.input.type = "text";
    refs.input.placeholder = "Which club?";
    refs.input.autocomplete = "off";
    refs.input.setAttribute("list", "hzTeams");
    refs.input.setAttribute("aria-label", "Your guess");
    refs.list = document.createElement("datalist");
    refs.list.id = "hzTeams";
    refs.go = el("button", "btn primary", "Guess");
    refs.go.type = "submit";
    form.append(refs.input, refs.list, refs.go);
    form.addEventListener("submit", (e) => { e.preventDefault(); guess(refs.input.value.trim()); });
    refs.form = form;
    stage.append(form);

    refs.rows = el("div", "hz-rows");
    stage.append(refs.rows);

    refs.note = el("p", "cf-note", "");
    stage.append(refs.note);

    refs.share = K.btn("Copy result", "btn hz-share", async () => {
      try { await navigator.clipboard.writeText(shareLine()); refs.share.textContent = "Copied"; }
      catch { refs.share.textContent = "Couldn't copy"; }
      window.setTimeout(() => { refs.share.textContent = "Copy result"; }, 1600);
    });
    refs.share.hidden = true;
    stage.append(refs.share);
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
    how.append(el("h2", null, "How it scores"));
    const ul = document.createElement("ul");
    ul.className = "hz-how";
    for (const t of [
      "Six guesses. First guess is worth 6, sixth is worth 1, a miss is worth nothing.",
      "The crop pulls back every time you're wrong.",
      "Three wrong and you're told the conference; four and you get the division.",
      "The same crest for everyone, from midnight Central. One play a day.",
      "No ZCoins here — the Game Room pays in titles."
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
    if (!data || !refs.rows) return;

    if (refs.list.childElementCount !== data.teams.length) {
      refs.list.replaceChildren();
      for (const t of data.teams) { const o = document.createElement("option"); o.value = t.name; refs.list.append(o); }
    }

    refs.left.textContent = data.done ? (data.solved ? "Solved" : "Out of guesses") : `${data.left} guess${data.left === 1 ? "" : "es"} left`;

    refs.hints.replaceChildren();
    if (data.hints?.conference) refs.hints.append(el("span", "hz-hint", `Conference: ${data.hints.conference}`));
    if (data.hints?.division) refs.hints.append(el("span", "hz-hint", `Division: ${data.hints.division}`));
    refs.hints.hidden = !refs.hints.childElementCount;

    refs.rows.replaceChildren();
    for (const g of data.guesses || []) {
      const row = el("div", `hz-guess${g.right ? " right" : ""}`);
      if (window.ECLogos) row.append(window.ECLogos.crest("american-football", "NFL", g.name, "hz-crest"));
      row.append(el("b", null, g.name));
      row.append(el("span", "hz-mark", g.right ? "✓" : "✗"));
      refs.rows.append(row);
    }

    const signedIn = Boolean(data.me);
    refs.form.hidden = data.done || !signedIn;
    refs.share.hidden = !data.done;
    refs.reveal.hidden = !data.done;
    if (data.done && data.answer) {
      refs.reveal.replaceChildren();
      if (window.ECLogos) refs.reveal.append(window.ECLogos.crest("american-football", "NFL", data.answer.name, "hz-answer-crest"));
      refs.reveal.append(el("b", null, data.answer.name));
    }

    refs.note.textContent = !signedIn
      ? "Log in with Twitch to play today's crest."
      : data.done
        ? (data.solved ? `Got it in ${data.guesses.length}. A new crest at midnight Central.` : `It was the ${data.answer?.name}. A new crest at midnight Central.`)
        : "City, nickname or the lot — “KC”, “chiefs” and “Kansas City Chiefs” all count.";

    refs.youList.replaceChildren();
    if (data.me?.record) {
      const r = data.me.record;
      refs.youNote.textContent = `${r.played} played`;
      const row = (k, v) => { const x = el("div", "hl-stat"); x.append(el("span", null, k), el("strong", null, v)); return x; };
      refs.youList.append(row("Best", r.best ? `${7 - r.best} guess${7 - r.best === 1 ? "" : "es"}` : "—"), row("Streak", r.streak ? `${r.streak} day${r.streak === 1 ? "" : "s"}` : "—"));
    } else {
      refs.youNote.textContent = "";
      refs.youList.append(el("p", "cf-empty", "Log in to keep a record."));
    }

    refs.boardNote.textContent = data.day;
    refs.board.replaceChildren();
    if (!data.board?.length) refs.board.append(el("p", "cf-empty", "Nobody yet — first one takes it."));
    for (const row of data.board || []) {
      const line = el("div", `gr-row${data.me && row.user.login === data.me.login ? " me" : ""}`);
      line.append(el("span", "gr-rank", String(row.rank)), K.avatar(row.user, "cf-av small"), K.nameLink(row.user));
      line.append(el("span", "gr-score nums", row.detail?.solved ? `${row.detail.guesses}${row.detail.guesses === 1 ? " guess" : " guesses"}` : "missed"));
      refs.board.append(line);
    }
  }

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;
      document.title = "Helmet Zoom — EastCoin";
      window.ECPresence?.beat("games", "Helmet Zoom");
      img = null;
      build();
      await load();
      await paint();
      refs.input?.focus();
    },
    unmount() { data = null; refs = {}; img = null; document.title = "EastCoin"; }
  };

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("helmet", view);
  }
  boot();
})();

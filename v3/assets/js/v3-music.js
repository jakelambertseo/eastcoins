/* ============================================================
   EastCoin V3 — The Green Room

   One module, three jobs:

     · a single connection to the shared room Worker
     · the full room view at /v3/?view=music
     · a small dock that follows you around the rest of V3

   Only one of those two surfaces holds a player at a time. The
   room is position-synced — every client seeks to (now - startedAt)
   — so handing playback from the dock to the view is a reload that
   lands in the same place, and that is far simpler than trying to
   move a live iframe between parents (which reloads it anyway).

   The room only advances when a client says a song ENDED. There is
   no server-side timer on song length, so a player that cannot
   report that would quietly stall the queue for everybody. That is
   why this uses the real YouTube IFrame API rather than a plain
   embed with an autoplay parameter.
   ============================================================ */
(() => {
  "use strict";

  const CATJAM = "https://cdn.7tv.app/emote/01KWJNR4DE37RDZ816WYAYDG3K/3x.webp";
  const DOCK_KEY = "ec_v3_music_dock";

  const config = window.EASTCOIN_MUSIC_CONFIG || {};
  const ROOM = String(config.room || "main");
  const BASE = String(config.websocketUrl || "").trim();

  /* ============================================================ connection */

  const conn = {
    socket: null,
    state: null,
    token: null,
    attempts: 0,
    clientId: "",
    listeners: new Set()
  };

  function clientId() {
    if (conn.clientId) return conn.clientId;
    try {
      conn.clientId = window.localStorage.getItem("ec_v3_music_client") || "";
    } catch { /* blocked storage just means a new id each visit */ }
    if (!conn.clientId) {
      conn.clientId = (crypto.randomUUID?.() || String(Math.random())).slice(0, 36);
      try { window.localStorage.setItem("ec_v3_music_client", conn.clientId); } catch {}
    }
    return conn.clientId;
  }

  function emit() {
    for (const fn of conn.listeners) {
      try { fn(conn.state); } catch (error) { console.error("music listener threw", error); }
    }
  }

  function subscribe(fn) {
    conn.listeners.add(fn);
    if (conn.state) fn(conn.state);
    return () => conn.listeners.delete(fn);
  }

  function send(message) {
    if (conn.socket?.readyState === 1) {
      conn.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async function fetchToken() {
    try {
      const response = await fetch("/api/music/token", {
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = await response.json();
      conn.token = payload?.ok && payload.authenticated ? payload.token : null;
    } catch {
      conn.token = null;
    }
    return conn.token;
  }

  function sendIdentity() {
    send({ type: "identity", name: "", avatar: "", token: conn.token });
  }

  function connect() {
    if (!BASE || conn.socket) return;

    let url;
    try {
      url = new URL(`/room/${encodeURIComponent(ROOM)}`, BASE);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("client", clientId());
    } catch {
      return;
    }

    let socket;
    try {
      socket = new WebSocket(url.href);
    } catch {
      return;
    }
    conn.socket = socket;

    socket.addEventListener("open", async () => {
      conn.attempts = 0;
      await fetchToken();
      sendIdentity();
    });

    socket.addEventListener("message", (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload?.type === "state" && payload.state) {
        conn.state = payload.state;
        emit();
      }
    });

    const drop = () => {
      if (conn.socket !== socket) return;
      conn.socket = null;
      // Backing off matters: the room stops its own polling alarm when
      // empty, so a tight reconnect loop from many tabs is real load.
      const delay = Math.min(30000, 1000 * 2 ** Math.min(conn.attempts++, 5));
      window.setTimeout(connect, delay);
    };
    socket.addEventListener("close", drop);
    socket.addEventListener("error", drop);
  }

  /* ============================================================ player */

  let ytReady = null;

  function loadYouTubeApi() {
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve) => {
      if (window.YT?.Player) return resolve(window.YT);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.append(script);
    });
    return ytReady;
  }

  const player = { instance: null, host: null, videoId: "", itemId: "" };

  function elapsedSeconds(state) {
    if (!state?.startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - Number(state.startedAt)) / 1000));
  }

  function reportEnded(reason) {
    // Guarded server-side against a stale id, so several tabs reporting
    // the same song is harmless — only the first one advances anything.
    if (player.itemId) send({ type: "ended", currentId: player.itemId, reason });
  }

  async function mountPlayer(host, state) {
    const current = state?.current;
    if (!host || !current?.videoId) return;

    const YT = await loadYouTubeApi();
    if (!host.isConnected) return;

    // Same song, same surface: leave it alone rather than restarting it.
    if (player.instance && player.host === host && player.videoId === current.videoId) {
      player.itemId = current.id;
      return;
    }

    destroyPlayer();
    const slot = document.createElement("div");
    host.replaceChildren(slot);

    player.host = host;
    player.videoId = current.videoId;
    player.itemId = current.id;

    player.instance = new YT.Player(slot, {
      videoId: current.videoId,
      playerVars: {
        autoplay: 1,
        start: elapsedSeconds(state),
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onReady: (event) => {
          try { event.target.playVideo(); } catch {}
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) reportEnded("ended");
        },
        onError: () => reportEnded("player-error")
      }
    });
  }

  function destroyPlayer() {
    try { player.instance?.destroy?.(); } catch {}
    player.instance = null;
    player.host = null;
    player.videoId = "";
    player.itemId = "";
  }

  /* ============================================================ catjam */

  let jamTimer = 0;

  function stopJam(surface) {
    window.clearInterval(jamTimer);
    jamTimer = 0;
    surface?.classList.remove("is-jamming");
    surface?.querySelectorAll(".jam-cat").forEach((node) => node.remove());
  }

  function startJam(surface) {
    if (!surface || jamTimer) return;
    surface.classList.add("is-jamming");

    const spawn = () => {
      if (!surface.isConnected) return stopJam(surface);
      const cat = document.createElement("img");
      cat.className = "jam-cat";
      cat.src = CATJAM;
      cat.alt = "";
      cat.style.left = `${Math.random() * 88 + 2}%`;
      cat.style.animationDuration = `${2.6 + Math.random() * 1.8}s`;
      cat.style.setProperty("--drift", `${Math.random() * 60 - 30}px`);
      surface.append(cat);
      window.setTimeout(() => cat.remove(), 4600);
    };

    spawn();
    jamTimer = window.setInterval(spawn, 620);
  }

  function isRasputin(state) {
    return String(state?.current?.special || "") === "rasputin";
  }

  /* ============================================================ helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function nowPlayingLine(state) {
    const current = state?.current;
    if (!current) return "Nothing playing";
    return current.requestedBy ? `${current.title} — ${current.requestedBy}` : current.title;
  }

  /* ============================================================ dock */

  const dock = { root: null, body: null, stage: null, open: false, unsub: null };

  function dockPref() {
    try { return window.localStorage.getItem(DOCK_KEY) !== "closed"; } catch { return true; }
  }

  function setDockOpen(open) {
    dock.open = open;
    try { window.localStorage.setItem(DOCK_KEY, open ? "open" : "closed"); } catch {}
    if (dock.body) dock.body.hidden = !open;
    dock.root?.classList.toggle("is-open", open);
    if (!open) {
      destroyPlayer();
      stopJam(dock.stage);
    } else if (conn.state && !document.body.classList.contains("music-view")) {
      mountPlayer(dock.stage, conn.state);
    }
  }

  function buildDock() {
    if (dock.root || !BASE) return;

    const root = el("aside", "musicdock");
    root.id = "ecv3MusicDock";
    root.hidden = true;

    const head = el("button", "musicdock-head");
    head.type = "button";
    head.title = "The Green Room";
    const label = el("span", "musicdock-title", "Nothing playing");
    head.append(el("span", "musicdock-dot"), label);
    head.addEventListener("click", () => setDockOpen(!dock.open));

    const body = el("div", "musicdock-body");
    const stage = el("div", "musicdock-stage");
    body.append(stage);

    const foot = el("div", "musicdock-foot");
    const openFull = el("button", "musicdock-btn", "Open room");
    openFull.type = "button";
    openFull.addEventListener("click", () => window.ECV3?.go?.("music"));
    foot.append(openFull);
    body.append(foot);

    root.append(head, body);
    document.body.append(root);

    Object.assign(dock, { root, body, stage, open: dockPref() });
    body.hidden = !dock.open;
    root.classList.toggle("is-open", dock.open);

    dock.unsub = subscribe((state) => {
      const playing = Boolean(state?.current);
      root.hidden = !playing;
      label.textContent = playing ? nowPlayingLine(state) : "Nothing playing";

      // The music view owns playback while it is open.
      if (document.body.classList.contains("music-view")) {
        stopJam(stage);
        return;
      }

      // !rasputin is an event, not background music: it opens the dock
      // for anyone who had it folded away, wherever they are on the site.
      if (isRasputin(state) && !dock.open) setDockOpen(true);

      if (playing && dock.open) mountPlayer(stage, state);
      if (isRasputin(state) && dock.open) startJam(stage);
      else stopJam(stage);
    });
  }

  /* ============================================================ view */

  const view = (() => {
    let root = null;
    let unsub = null;
    let stage = null;

    function queueList(state) {
      const wrap = el("div", "mq");
      const items = state?.queue || [];
      if (!items.length) {
        wrap.append(el("p", "mq-empty", "Nothing queued. Add something, or ask in chat with !sr."));
        return wrap;
      }
      items.forEach((item, index) => {
        const row = el("div", "mq-row");
        row.append(el("span", "mq-n", String(index + 1)));
        const meta = el("div", "mq-meta");
        meta.append(el("strong", null, item.title || "Untitled"));
        meta.append(el("small", null, item.requestedBy ? `added by ${item.requestedBy}` : "added from chat"));
        row.append(meta);
        if (item.special === "rasputin") row.append(el("span", "mq-tag", "RASPUTIN"));
        wrap.append(row);
      });
      return wrap;
    }

    function paint(state) {
      if (!root) return;
      root.replaceChildren();

      const head = el("div", "mhead");
      const title = el("h1", "mtitle");
      const emote = document.createElement("img");
      emote.className = "mtitle-emote";
      emote.src = "https://cdn.7tv.app/emote/01KSPAJV30RAHACSE3E173FS46/3x.webp";
      emote.alt = "";
      title.append(emote, document.createTextNode("The Green Room"));
      head.append(title);

      const who = el("span", "mlisteners");
      who.textContent = state
        ? `${state.listeners} listening`
        : (BASE ? "Connecting…" : "Room not configured");
      head.append(who);
      root.append(head);

      if (!BASE) {
        root.append(el("p", "mq-empty", "No room server is configured for this build."));
        return;
      }

      const shellEl = el("div", "mshell");

      stage = el("div", "mstage");
      shellEl.append(stage);

      const side = el("div", "mside");

      const now = el("div", "mnow");
      now.append(el("span", "mnow-k", "Now playing"));
      now.append(el("strong", "mnow-v", state?.current?.title || "Nothing playing"));
      if (state?.current?.requestedBy) {
        now.append(el("small", null, `added by ${state.current.requestedBy}`));
      }
      side.append(now);

      if (state?.current) {
        const skip = el("button", "watchbtn", `Vote skip (${state.skipVotes}/${state.skipThreshold})`);
        skip.type = "button";
        skip.addEventListener("click", () => send({ type: "skip-vote" }));
        side.append(skip);
      }

      side.append(el("span", "mq-k", "Up next"));
      side.append(queueList(state));

      shellEl.append(side);
      root.append(shellEl);

      if (state?.current) mountPlayer(stage, state);
      if (isRasputin(state)) startJam(stage); else stopJam(stage);
    }

    return {
      async mount(container) {
        root = container;
        document.body.classList.add("music-view");
        // The dock steps aside; two players would fight over the same song.
        destroyPlayer();
        if (dock.root) dock.root.hidden = true;
        connect();
        paint(conn.state);
        unsub = subscribe(paint);
      },
      unmount() {
        document.body.classList.remove("music-view");
        stopJam(stage);
        destroyPlayer();
        unsub?.();
        unsub = null;
        root = null;
        stage = null;
        // Hand playback back to the dock, if it is meant to be showing.
        if (dock.root && conn.state?.current) {
          dock.root.hidden = false;
          if (dock.open) mountPlayer(dock.stage, conn.state);
        }
      }
    };
  })();

  /* ============================================================ boot */

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("music", view);
    buildDock();
    // Connect once something is listening for it, not on every page load
    // of every view — the room stops polling when nobody is connected.
    window.requestIdleCallback
      ? window.requestIdleCallback(connect, { timeout: 3000 })
      : window.setTimeout(connect, 1200);
  }
  boot();

  window.ECV3Music = Object.freeze({ subscribe, send, connect, state: () => conn.state });
})();

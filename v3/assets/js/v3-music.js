/* ============================================================
   EastCoin V3 — The Green Room

   The room lives at /v3/?view=music and nowhere else. There is
   deliberately no floating dock: anything fixed to a corner sits
   over the Twitch chat iframe, and Twitch disables the message
   box for the broadcaster and moderators the moment it detects
   something covering it. A player that costs the mods their chat
   is not worth having.

   The room only advances when a client reports a song ENDED —
   there is no server-side timer on song length — so this uses the
   real YouTube IFrame API rather than a plain autoplay embed. A
   player that could not report that would quietly stall the queue
   for everybody.
   ============================================================ */
(() => {
  "use strict";

  const CATJAM = "https://cdn.7tv.app/emote/01KWJNR4DE37RDZ816WYAYDG3K/3x.webp";
  const ROOM_EMOTE = "https://cdn.7tv.app/emote/01FAEEN908000D3SP26B2JBAC1/2x.webp";
  const JAMGIE = "https://cdn.7tv.app/emote/01KKEGKRN9HP64BX2ERWRWWJ3G/2x.webp";
  const VOLUME_KEY = "ec_v3_music_volume";

  // Mirrors the room's own list. Cosmetic only — the server re-checks the
  // verified login on every force-skip, so revealing the button proves
  // nothing and grants nothing.
  const MODS = new Set(["zwades", "andyreidisapawg", "bootypaper"]);

  const config = window.EASTCOIN_MUSIC_CONFIG || {};
  const ROOM = String(config.room || "main");
  const BASE = String(config.websocketUrl || "").trim();

  /* ============================================================ connection */

  const conn = {
    socket: null,
    state: null,
    token: null,
    login: "",
    attempts: 0,
    clientId: "",
    listeners: new Set()
  };

  function clientId() {
    if (conn.clientId) return conn.clientId;
    try { conn.clientId = window.localStorage.getItem("ec_v3_music_client") || ""; } catch {}
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
      if (payload?.ok && payload.authenticated) {
        conn.token = payload.token || null;
        conn.login = String(payload.login || "").toLowerCase();
      } else {
        conn.token = null;
        conn.login = "";
      }
    } catch {
      conn.token = null;
      conn.login = "";
    }
    return conn.token;
  }

  function canForceSkip() {
    return MODS.has(conn.login);
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
    try { socket = new WebSocket(url.href); } catch { return; }
    conn.socket = socket;

    socket.addEventListener("open", async () => {
      conn.attempts = 0;
      await fetchToken();
      send({ type: "identity", name: "", avatar: "", token: conn.token });
      emit();
    });

    socket.addEventListener("message", (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload?.type === "state" && payload.state) {
        conn.state = payload.state;
        emit();
      }
      if (payload?.type === "error" && payload.message) {
        setNotice(String(payload.message), true);
      }
    });

    const drop = () => {
      if (conn.socket !== socket) return;
      conn.socket = null;
      // Backing off matters: the room stops its polling alarm when empty,
      // so a tight reconnect loop across many tabs is real load.
      const delay = Math.min(30000, 1000 * 2 ** Math.min(conn.attempts++, 5));
      window.setTimeout(connect, delay);
    };
    socket.addEventListener("close", drop);
    socket.addEventListener("error", drop);
  }

  function disconnect() {
    const socket = conn.socket;
    conn.socket = null;
    try { socket?.close(); } catch {}
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

  const player = { instance: null, videoId: "", itemId: "" };

  function readVolume() {
    try {
      const stored = Number(window.localStorage.getItem(VOLUME_KEY));
      return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : 60;
    } catch {
      return 60;
    }
  }

  function writeVolume(value) {
    try { window.localStorage.setItem(VOLUME_KEY, String(value)); } catch {}
  }

  function setVolume(value) {
    writeVolume(value);
    try { player.instance?.setVolume?.(value); } catch {}
  }

  function elapsedSeconds(state) {
    if (!state?.startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - Number(state.startedAt)) / 1000));
  }

  function reportEnded(reason) {
    // Guarded server-side against a stale id, so several tabs reporting
    // the same song is harmless — only the first advances anything.
    if (player.itemId) send({ type: "ended", currentId: player.itemId, reason });
  }

  async function mountPlayer(host, state) {
    const current = state?.current;
    if (!host || !current?.videoId) return;

    const YT = await loadYouTubeApi();
    if (!host.isConnected) return;

    // Same song: leave it playing rather than restarting it on every
    // state broadcast (a listener joining sends one).
    if (player.instance && player.videoId === current.videoId) {
      player.itemId = current.id;
      return;
    }

    destroyPlayer();
    const slot = document.createElement("div");
    host.replaceChildren(slot);

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
          try {
            event.target.setVolume(readVolume());
            event.target.playVideo();
          } catch {}
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

  let noticeEl = null;
  let noticeTimer = 0;

  function setNotice(text, isError) {
    if (!noticeEl) return;
    noticeEl.textContent = text;
    noticeEl.classList.toggle("is-error", Boolean(isError));
    noticeEl.hidden = !text;
    window.clearTimeout(noticeTimer);
    if (text) noticeTimer = window.setTimeout(() => { noticeEl.hidden = true; }, 5000);
  }

  /**
   * YouTube's thumbnail for a video id. Derived rather than fetched: the
   * room's queue entries carry no thumbnail field, and this needs neither
   * a request nor an API key.
   */
  function thumbUrl(videoId) {
    return /^[A-Za-z0-9_-]{11}$/.test(String(videoId || ""))
      ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      : "";
  }

  function thumb(videoId, className) {
    const url = thumbUrl(videoId);
    if (!url) return null;
    const img = document.createElement("img");
    img.className = className;
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    return img;
  }

  function timeAgo(timestamp) {
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp || 0)) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  /* ============================================================ view */

  const view = (() => {
    let root = null;
    let unsub = null;
    let stage = null;
    let history = [];
    let requesters = [];
    let tab = "queue";
    let searchResults = [];
    let searching = false;
    let searchNote = "";
    // Held outside the DOM because paint() rebuilds the whole view on every
    // state broadcast - someone joining the room would otherwise wipe what
    // you were halfway through typing.
    let searchQuery = "";
    let searchFocused = false;

    /* ---------------------------------------------------- add + search */

    function addVideo(videoId) {
      if (!conn.token) {
        setNotice("Log in with Twitch to add songs.", true);
        return;
      }
      if (send({ type: "add", videoId })) setNotice("Added to the queue.");
      else setNotice("Not connected to the room.", true);
    }

    async function runSearch(query) {
      const raw = String(query || "").trim();
      if (!raw) return;

      // A pasted link never needs the search API — pull the id straight
      // out of it and queue it, which also works when search has no key.
      const pasted = window.EastcoinYouTube?.extractVideo?.(raw)?.id || "";
      if (pasted) {
        addVideo(pasted);
        searchResults = [];
        searchNote = "";
        paint(conn.state);
        return;
      }

      if (!BASE) return;
      searching = true;
      searchNote = "";
      paint(conn.state);

      try {
        const url = new URL("/search", BASE);
        url.searchParams.set("q", raw);
        const response = await fetch(url.href);
        const payload = await response.json();
        if (payload?.ok) {
          searchResults = payload.results || [];
          searchNote = searchResults.length ? "" : "Nothing found for that.";
        } else {
          searchResults = [];
          // Pass the room's own explanation through — "search is not
          // configured" is a very different problem from "search failed".
          searchNote = payload?.message || "Search didn't work.";
        }
      } catch {
        searchResults = [];
        searchNote = "Couldn't reach search. You can still paste a link.";
      }
      searching = false;
      paint(conn.state);
    }

    async function loadHistory() {
      if (!BASE) return;
      try {
        const url = new URL(`/history/${encodeURIComponent(ROOM)}`, BASE);
        const response = await fetch(url.href);
        const payload = await response.json();
        history = Array.isArray(payload?.history) ? payload.history.slice().reverse() : [];
        // Comes back on the same request, already ordered by count.
        requesters = Array.isArray(payload?.userStats) ? payload.userStats : [];
      } catch {
        history = [];
        requesters = [];
      }
      if (root?.isConnected) paint(conn.state);
    }

    /* ---------------------------------------------------- panels */

    function searchPanel() {
      const box = el("div", "msearch");

      const input = document.createElement("input");
      input.className = "msearch-input";
      input.type = "search";
      input.placeholder = "Search YouTube, or paste a link";
      input.setAttribute("aria-label", "Search YouTube or paste a link");
      input.value = searchQuery;
      input.addEventListener("input", () => { searchQuery = input.value; });
      input.addEventListener("focus", () => { searchFocused = true; });
      input.addEventListener("blur", () => { searchFocused = false; });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") runSearch(input.value);
        if (event.key === "Escape") {
          searchResults = [];
          searchNote = "";
          paint(conn.state);
        }
      });
      // Restored after a repaint so the caret does not jump to the start.
      if (searchFocused) {
        window.requestAnimationFrame(() => {
          if (!input.isConnected) return;
          input.focus();
          const end = input.value.length;
          try { input.setSelectionRange(end, end); } catch {}
        });
      }

      const go = el("button", "watchbtn", searching ? "Searching…" : "Search");
      go.type = "button";
      go.disabled = searching;
      go.addEventListener("click", () => runSearch(input.value));

      box.append(input, go);

      const wrap = el("div", "msearchwrap");
      wrap.append(box);

      if (searchNote) wrap.append(el("p", "mq-empty", searchNote));

      if (searchResults.length) {
        const panel = el("div", "mresults");

        const head = el("div", "mresults-head");
        head.append(el("span", "mq-k", `${searchResults.length} results - pick one to queue`));
        const clear = el("button", "mresults-clear", "\u2715");
        clear.type = "button";
        clear.setAttribute("aria-label", "Clear results");
        clear.addEventListener("click", () => {
          searchResults = [];
          searchNote = "";
          paint(conn.state);
        });
        head.append(clear);
        panel.append(head);

        const list = el("div", "mresults-list");
        for (const result of searchResults.slice(0, 10)) {
          const videoId = result.videoId || result.id;
          const row = el("button", "mresult");
          row.type = "button";

          // Prefer the id-derived thumbnail: the API returns the 120px
          // "default" size, which looks soft at the size this row uses.
          const art = thumb(videoId, "mresult-thumb");
          if (art) row.append(art);

          const meta = el("div", "mresult-meta");
          meta.append(el("strong", null, result.title || "Untitled"));
          if (result.channelTitle) meta.append(el("small", null, result.channelTitle));
          row.append(meta);
          row.append(el("span", "mresult-add", "+ Queue"));

          row.addEventListener("click", () => {
            addVideo(videoId);
            searchResults = [];
            searchQuery = "";
            paint(conn.state);
          });
          list.append(row);
        }
        panel.append(list);
        wrap.append(panel);
      }

      return wrap;
    }

    function volumePanel() {
      const box = el("div", "mvol");
      box.append(el("span", "mvol-k", "Volume"));

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "mvol-range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.value = String(readVolume());
      slider.setAttribute("aria-label", "Playback volume");

      const readout = el("span", "mvol-v", `${slider.value}`);
      slider.addEventListener("input", () => {
        readout.textContent = slider.value;
        setVolume(Number(slider.value));
      });

      box.append(slider, readout);
      return box;
    }

    function requestersPanel() {
      const box = el("div", "mwho");
      box.append(el("span", "mq-k", "Top requesters"));

      if (!requesters.length) {
        box.append(el("p", "mwho-none", "Nobody has queued anything yet."));
        return box;
      }

      const list = el("div", "mtop");
      requesters.slice(0, 5).forEach((entry, index) => {
        const row = el("div", "mtop-row");
        row.append(el("span", "mtop-n", `${index + 1}`));
        if (entry.avatar) {
          const img = document.createElement("img");
          img.className = "mtop-av";
          img.src = entry.avatar;
          img.alt = "";
          img.loading = "lazy";
          row.append(img);
        }
        row.append(el("span", "mtop-name", entry.displayName || entry.login || "someone"));
        row.append(el("span", "mtop-c", String(entry.count || 0)));
        list.append(row);
      });
      box.append(list);
      return box;
    }

    function listenersPanel(state) {
      const box = el("div", "mwho");
      const names = state?.listenerNames || [];
      const total = Number(state?.listeners || 0);

      const head = el("div", "mwho-head");
      head.append(el("span", "mq-k", "In the room"));
      head.append(el("span", "mwho-count", `${total}`));
      box.append(head);

      if (!names.length) {
        // The roster only ever shows verified Twitch logins, so a room of
        // logged-out listeners is a real count with an empty list.
        box.append(el("p", "mwho-none", total
          ? `${total} listening, none logged in with Twitch.`
          : "Nobody here yet."));
        return box;
      }

      const list = el("div", "mwho-list");
      for (const name of names) list.append(el("span", "mwho-chip", name));
      box.append(list);

      if (total > names.length) {
        box.append(el("p", "mwho-none", `+${total - names.length} not logged in`));
      }
      return box;
    }

    function queueList(state) {
      const wrap = el("div", "mq");
      const items = state?.queue || [];
      if (!items.length) {
        wrap.append(el("p", "mq-empty", "Nothing queued. Search above, or ask in chat with !sr."));
        return wrap;
      }
      items.forEach((item, index) => {
        const row = el("div", "mq-row");
        row.append(el("span", "mq-n", String(index + 1)));
        const art = thumb(item.videoId, "mq-thumb");
        if (art) row.append(art);
        const meta = el("div", "mq-meta");
        meta.append(el("strong", null, item.title || "Untitled"));
        meta.append(el("small", null, item.requestedBy ? `added by ${item.requestedBy}` : "added from chat"));
        row.append(meta);
        if (item.special === "rasputin") row.append(el("span", "mq-tag", "RASPUTIN"));
        wrap.append(row);
      });
      return wrap;
    }

    function historyList() {
      const wrap = el("div", "mq");
      if (!history.length) {
        wrap.append(el("p", "mq-empty", "Nothing has played yet."));
        return wrap;
      }
      for (const entry of history.slice(0, 40)) {
        const row = el("div", "mq-row");
        const art = thumb(entry.videoId, "mq-thumb");
        if (art) row.append(art);
        const meta = el("div", "mq-meta");
        meta.append(el("strong", null, entry.title || "Untitled"));
        meta.append(el("small", null,
          `${entry.requestedBy || "chat"} · ${timeAgo(entry.requestedAt)}`));
        row.append(meta);

        const again = el("button", "watchbtn mq-again", "Play again");
        again.type = "button";
        again.addEventListener("click", () => addVideo(entry.videoId));
        row.append(again);

        wrap.append(row);
      }
      return wrap;
    }

    /* ---------------------------------------------------- paint */

    function paint(state) {
      if (!root) return;
      root.replaceChildren();

      const head = el("div", "mhead");
      const title = el("h1", "mtitle");
      const emote = document.createElement("img");
      emote.className = "mtitle-emote";
      emote.src = ROOM_EMOTE;
      emote.alt = "";
      const jamgie = document.createElement("img");
      jamgie.className = "mtitle-emote";
      jamgie.src = JAMGIE;
      jamgie.alt = "";
      title.append(emote, el("span", "mtitle-text", "The Green Room"), jamgie);
      head.append(title);
      head.append(el("span", "mlisteners", state
        ? `${state.listeners} listening`
        : (BASE ? "Connecting…" : "Room not configured")));
      root.append(head);

      noticeEl = el("p", "mnotice");
      noticeEl.hidden = true;
      root.append(noticeEl);

      if (!BASE) {
        root.append(el("p", "mq-empty", "No room server is configured for this build."));
        return;
      }

      const shellEl = el("div", "mshell");

      const left = el("div", "mleft");

      // The glow cannot follow the actual audio — the YouTube frame is
      // cross-origin and its waveform is not readable — so it is a steady
      // pulse that runs while something is playing and lifts during a
      // !rasputin block. Honest decoration rather than a fake visualiser.
      const stagewrap = el("div", "mstagewrap");
      stage = el("div", "mstage");
      stagewrap.append(el("span", "mstage-glow"), stage);
      if (state?.current) stagewrap.classList.add("is-playing");
      if (isRasputin(state)) stagewrap.classList.add("is-hot");

      left.append(stagewrap, volumePanel(), searchPanel());
      shellEl.append(left);

      const side = el("div", "mside");

      const now = el("div", "mnow");
      const nowArt = state?.current ? thumb(state.current.videoId, "mnow-thumb") : null;
      if (nowArt) now.append(nowArt);

      const nowText = el("div", "mnow-text");
      nowText.append(el("span", "mnow-k", "Now playing"));
      nowText.append(el("strong", "mnow-v", state?.current?.title || "Nothing playing"));
      if (state?.current?.requestedBy) {
        nowText.append(el("small", null, `added by ${state.current.requestedBy}`));
      }
      now.append(nowText);
      side.append(now);

      if (state?.current) {
        const actions = el("div", "mactions");

        const vote = el("button", "watchbtn", `Vote skip (${state.skipVotes}/${state.skipThreshold})`);
        vote.type = "button";
        vote.addEventListener("click", () => send({ type: "skip-vote" }));
        actions.append(vote);

        // Shown only to the room mods. The server re-checks the verified
        // login on every force-skip, so this is presentation, not a gate.
        if (canForceSkip()) {
          const force = el("button", "watchbtn mforce", "Skip now");
          force.type = "button";
          force.title = "Skip immediately, without a vote";
          force.addEventListener("click", () => send({ type: "force-skip" }));
          actions.append(force);
        }

        side.append(actions);
      }

      side.append(listenersPanel(state));
      side.append(requestersPanel());

      const tabs = el("div", "mtabs");
      for (const [key, label] of [["queue", "Up next"], ["history", "History"]]) {
        const btn = el("button", `mtab${tab === key ? " active" : ""}`, label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          tab = key;
          if (key === "history" && !history.length) loadHistory();
          paint(conn.state);
        });
        tabs.append(btn);
      }
      side.append(tabs);
      side.append(tab === "queue" ? queueList(state) : historyList());

      shellEl.append(side);
      root.append(shellEl);

      if (state?.current) mountPlayer(stage, state);
      if (isRasputin(state)) startJam(stage); else stopJam(stage);
    }

    return {
      async mount(container) {
        root = container;
        document.body.classList.add("music-view");
        connect();
        paint(conn.state);
        unsub = subscribe(paint);
        loadHistory();
      },
      unmount() {
        document.body.classList.remove("music-view");
        stopJam(stage);
        destroyPlayer();
        // Leaving the room stops counting you as a listener, which keeps
        // the skip threshold honest for the people still here.
        disconnect();
        unsub?.();
        unsub = null;
        root = null;
        stage = null;
        noticeEl = null;
      }
    };
  })();

  /* ============================================================ boot */

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("music", view);
  }
  boot();

  window.ECV3Music = Object.freeze({ subscribe, send, connect, state: () => conn.state });
})();

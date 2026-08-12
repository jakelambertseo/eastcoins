(() => {
  "use strict";

  const body = document.body;
  const viewArea = document.querySelector(".ec-persistent-view-area");
  const controlsDrawer = document.getElementById("persistentControlsDrawer");
  const controlsList = controlsDrawer?.querySelector(".ec-persistent-controls-list");
  const controlsToggle = document.getElementById("persistentControlsToggle");

  if (!body || !viewArea || !controlsList) return;

  const STORAGE_KEY = "eastcoinMusicLocalStateV1";
  const OPEN_KEY = "eastcoinMusicDockOpen";
  const NICKNAME_KEY = "eastcoinMusicNickname";
  const CLIENT_KEY = "eastcoinMusicClientId";
  const VOLUME_KEY = "eastcoinMusicVolume";
  const MAX_QUEUE = 25;

  const config = window.EASTCOIN_MUSIC_CONFIG || {};
  const roomName = String(config.room || "main").trim() || "main";
  const configuredEndpoint = String(config.websocketUrl || "").trim();

  let player = null;
  let playerReady = false;
  let autoplayBlocked = false;
  let socket = null;
  let reconnectTimer = 0;
  let currentLoadedId = "";
  let progressTimer = 0;
  let remoteMode = Boolean(configuredEndpoint);
  let connectionState = remoteMode ? "connecting" : "local";
  let state = loadLocalState();

  const clientId = getOrCreateClientId();

  ensureControlButton();
  const dock = createDock();
  const els = collectElements();
  bindUi();
  loadYouTubeApi();

  if (remoteMode) connectSharedRoom();
  restoreDockState();
  render();
  startProgressSync();

  function getOrCreateClientId() {
    try {
      let value = localStorage.getItem(CLIENT_KEY);
      if (!value) {
        value = crypto.randomUUID();
        localStorage.setItem(CLIENT_KEY, value);
      }
      return value;
    } catch {
      return crypto.randomUUID();
    }
  }

  function readNickname() {
    try {
      return (localStorage.getItem(NICKNAME_KEY) || "Guest").trim() || "Guest";
    } catch {
      return "Guest";
    }
  }

  function writeNickname(value) {
    const clean = String(value || "Guest").trim().slice(0, 24) || "Guest";
    try { localStorage.setItem(NICKNAME_KEY, clean); } catch {}
    return clean;
  }

  function loadLocalState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") throw new Error("missing");
      return sanitizeState(parsed);
    } catch {
      return emptyState();
    }
  }

  function saveLocalState() {
    if (remoteMode) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function emptyState() {
    return {
      current: null,
      queue: [],
      startedAt: null,
      revision: 0,
      listeners: 1,
      skipVotes: 0,
      skipThreshold: 1
    };
  }

  function sanitizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const videoId = String(item.videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    return {
      id: String(item.id || crypto.randomUUID()),
      videoId,
      requestedBy: String(item.requestedBy || "Guest").slice(0, 24),
      addedAt: Number(item.addedAt) || Date.now()
    };
  }

  function sanitizeState(input) {
    const current = sanitizeItem(input.current);
    const queue = Array.isArray(input.queue)
      ? input.queue.map(sanitizeItem).filter(Boolean).slice(0, MAX_QUEUE)
      : [];
    return {
      current,
      queue,
      startedAt: current ? (Number(input.startedAt) || Date.now()) : null,
      revision: Number(input.revision) || 0,
      listeners: Math.max(1, Number(input.listeners) || 1),
      skipVotes: Math.max(0, Number(input.skipVotes) || 0),
      skipThreshold: Math.max(1, Number(input.skipThreshold) || 1)
    };
  }

  function ensureControlButton() {
    if (document.getElementById("persistentMusicButton")) return;

    const button = document.createElement("button");
    button.id = "persistentMusicButton";
    button.type = "button";
    button.setAttribute("aria-label", "Music Player");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="ec-persistent-control-icon">♫</span>
      <span><strong>Music Player</strong><small>Music + song requests</small></span>
    `;

    const gameButton = document.getElementById("persistentGameButton");
    controlsList.insertBefore(button, gameButton || null);
  }

  function createDock() {
    let existing = document.getElementById("eastcoinMusicDock");
    if (existing) return existing;

    const section = document.createElement("section");
    section.className = "ec-music-dock";
    section.id = "eastcoinMusicDock";
    section.setAttribute("aria-label", "EastCoin Music Player");
    section.hidden = true;
    section.innerHTML = `
      <div class="ec-music-panel">
        <header class="ec-music-head">
          <div class="ec-music-title-wrap">
            <span class="ec-music-kicker">EastCoin jukebox</span>
            <strong>Music Player</strong>
          </div>
          <div class="ec-music-head-actions">
            <span class="ec-music-mode" id="eastcoinMusicMode">Local</span>
            <button class="ec-music-icon-button" id="eastcoinMusicClose" type="button" aria-label="Close Music Player">×</button>
          </div>
        </header>

        <div class="ec-music-youtube-shell">
          <div id="eastcoinMusicYoutube"></div>
          <div class="ec-music-empty-player" id="eastcoinMusicEmptyPlayer">
            <strong>No song playing</strong>
            <small>Paste a YouTube link below to start the room.</small>
          </div>
        </div>

        <button class="ec-music-autoplay" id="eastcoinMusicJoin" type="button">▶ Join music</button>

        <section class="ec-music-now" aria-label="Now playing">
          <div class="ec-music-now-row">
            <div class="ec-music-now-copy">
              <strong id="eastcoinMusicNowTitle">Nothing queued</strong>
              <small id="eastcoinMusicNowMeta">Paste a YouTube URL to start</small>
            </div>
          </div>
          <div class="ec-music-room-stats">
            <span id="eastcoinMusicListeners">1 listener</span>
            <span id="eastcoinMusicSkipStatus">0 / 1 skip votes</span>
          </div>
        </section>

        <section class="ec-music-request">
          <label for="eastcoinMusicUrl">Request a song</label>
          <div class="ec-music-request-row">
            <input id="eastcoinMusicUrl" type="url" inputmode="url" autocomplete="off" placeholder="Paste YouTube link" />
            <button id="eastcoinMusicAdd" type="button">Add</button>
          </div>
          <div class="ec-music-request-help" id="eastcoinMusicHelp">youtube.com, music.youtube.com and youtu.be links work.</div>
        </section>

        <div class="ec-music-queue-wrap">
          <div class="ec-music-queue-head"><span>Up next</span><span id="eastcoinMusicQueueCount">0</span></div>
          <ol class="ec-music-queue" id="eastcoinMusicQueue"></ol>
          <div class="ec-music-empty-queue" id="eastcoinMusicEmptyQueue">Queue is empty.</div>
        </div>

        <footer class="ec-music-footer">
          <div class="ec-music-nickname">
            <label for="eastcoinMusicNickname">Requested by</label>
            <input id="eastcoinMusicNickname" type="text" maxlength="24" autocomplete="nickname" />
          </div>
          <button class="ec-music-skip" id="eastcoinMusicSkip" type="button">Vote skip</button>
        </footer>
      </div>
    `;

    // The music player belongs to the persistent video surface, but it is
    // deliberately not a grid column. Keeping it inside the view area lets it
    // float over the lower-right corner of the active video immediately to the
    // left of Twitch chat, with no empty column above it.
    viewArea.appendChild(section);
    return section;
  }

  function collectElements() {
    return {
      control: document.getElementById("persistentMusicButton"),
      close: document.getElementById("eastcoinMusicClose"),
      mode: document.getElementById("eastcoinMusicMode"),
      join: document.getElementById("eastcoinMusicJoin"),
      emptyPlayer: document.getElementById("eastcoinMusicEmptyPlayer"),
      nowTitle: document.getElementById("eastcoinMusicNowTitle"),
      nowMeta: document.getElementById("eastcoinMusicNowMeta"),
      listeners: document.getElementById("eastcoinMusicListeners"),
      skipStatus: document.getElementById("eastcoinMusicSkipStatus"),
      url: document.getElementById("eastcoinMusicUrl"),
      add: document.getElementById("eastcoinMusicAdd"),
      help: document.getElementById("eastcoinMusicHelp"),
      queue: document.getElementById("eastcoinMusicQueue"),
      queueCount: document.getElementById("eastcoinMusicQueueCount"),
      emptyQueue: document.getElementById("eastcoinMusicEmptyQueue"),
      nickname: document.getElementById("eastcoinMusicNickname"),
      skip: document.getElementById("eastcoinMusicSkip")
    };
  }

  function bindUi() {
    els.nickname.value = readNickname();

    els.control?.addEventListener("click", () => {
      setDockOpen(!body.classList.contains("music-dock-open"));
      closeControlsDrawer();
    });

    els.close?.addEventListener("click", () => setDockOpen(false));
    els.join?.addEventListener("click", () => {
      autoplayBlocked = false;
      els.join.classList.remove("is-visible");
      try { player?.playVideo(); } catch {}
    });

    els.add?.addEventListener("click", submitRequest);
    els.url?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitRequest();
    });

    els.nickname?.addEventListener("change", () => {
      els.nickname.value = writeNickname(els.nickname.value);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "identity", name: readNickname() }));
      }
    });

    els.skip?.addEventListener("click", voteSkip);

    window.addEventListener("storage", (event) => {
      if (!remoteMode && event.key === STORAGE_KEY) {
        state = loadLocalState();
        render();
        syncPlayerToState();
      }
    });
  }

  function closeControlsDrawer() {
    if (!controlsDrawer) return;
    controlsDrawer.classList.remove("is-open");
    controlsDrawer.setAttribute("aria-hidden", "true");
    controlsToggle?.setAttribute("aria-expanded", "false");
    controlsToggle?.setAttribute("aria-label", "Open view controls");
  }

  function restoreDockState() {
    let open = false;
    try { open = localStorage.getItem(OPEN_KEY) === "true"; } catch {}
    setDockOpen(open, false);
  }

  function setDockOpen(open, persist = true) {
    const enabled = Boolean(open);
    body.classList.toggle("music-dock-open", enabled);
    dock.hidden = !enabled;
    els.control?.setAttribute("aria-pressed", String(enabled));
    els.control?.classList.toggle("ec-music-control-active", enabled);
    if (persist) {
      try { localStorage.setItem(OPEN_KEY, String(enabled)); } catch {}
    }
    if (enabled) syncPlayerToState();
  }

  function setHelp(message, error = false) {
    els.help.textContent = message;
    els.help.classList.toggle("is-error", Boolean(error));
  }

  function normalizeYouTubeId(value) {
    const raw = String(value || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

    let url;
    try { url = new URL(raw); } catch { return ""; }

    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  }

  function submitRequest() {
    const videoId = normalizeYouTubeId(els.url.value);
    if (!videoId) {
      setHelp("That does not look like a valid YouTube video link.", true);
      return;
    }

    const requestedBy = writeNickname(els.nickname.value);
    els.nickname.value = requestedBy;

    if (remoteMode) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setHelp("Shared music room is reconnecting. Try again in a moment.", true);
        return;
      }
      socket.send(JSON.stringify({ type: "add", videoId, requestedBy }));
    } else {
      addLocal(videoId, requestedBy);
    }

    els.url.value = "";
    setHelp(remoteMode ? "Request sent to the shared queue." : "Added to your local queue.");
  }

  function addLocal(videoId, requestedBy) {
    if (state.current?.videoId === videoId || state.queue.some((item) => item.videoId === videoId)) {
      setHelp("That video is already in the queue.", true);
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      videoId,
      requestedBy,
      addedAt: Date.now()
    };

    const startsPlayback = !state.current;

    if (startsPlayback) {
      state.current = item;
      state.startedAt = Date.now();
      state.skipVotes = 0;
    } else if (state.queue.length < MAX_QUEUE) {
      state.queue.push(item);
    } else {
      setHelp(`Queue is limited to ${MAX_QUEUE} songs.`, true);
      return;
    }

    state.revision += 1;
    saveLocalState();
    render();

    // Adding an item to Up Next must not reload/restart the song that is
    // already playing. Only force a YouTube load when this request starts an
    // otherwise empty room.
    syncPlayerToState(startsPlayback);
  }

  function voteSkip() {
    if (!state.current) return;

    if (remoteMode) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "skip-vote", currentId: state.current.id }));
      }
      return;
    }

    advanceLocal();
  }

  function advanceLocal(expectedCurrentId = "") {
    // YouTube can emit overlapping error/ended callbacks. Never let a stale
    // callback for the previous song skip the newly promoted song.
    if (expectedCurrentId && state.current?.id !== expectedCurrentId) return;

    state.current = state.queue.shift() || null;
    state.startedAt = state.current ? Date.now() : null;
    state.skipVotes = 0;
    state.revision += 1;
    saveLocalState();
    render();
    syncPlayerToState(true);
  }

  function handleEnded(expectedCurrentId = state.current?.id || "") {
    if (!state.current || !expectedCurrentId) return;
    if (state.current.id !== expectedCurrentId) return;

    if (remoteMode) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ended", currentId: expectedCurrentId }));
      }
    } else {
      advanceLocal(expectedCurrentId);
    }
  }

  function render() {
    const current = state.current;
    const listeners = Math.max(1, Number(state.listeners) || 1);
    const skipThreshold = Math.max(1, Number(state.skipThreshold) || 1);

    els.mode.textContent = remoteMode
      ? (connectionState === "open" ? "Shared" : "Connecting")
      : "Local";

    els.mode.title = remoteMode
      ? "Shared Cloudflare music room"
      : "Single-browser mode — deploy the included Worker to sync everyone";

    els.nowTitle.textContent = current ? formatVideoLabel(current.videoId) : "Nothing queued";
    els.nowMeta.textContent = current
      ? `Requested by ${current.requestedBy || "Guest"}`
      : "Paste a YouTube URL to start";
    els.emptyPlayer.hidden = Boolean(current);

    els.listeners.textContent = `${listeners} ${listeners === 1 ? "listener" : "listeners"}`;
    els.skipStatus.textContent = `${state.skipVotes || 0} / ${skipThreshold} skip votes`;
    els.skip.disabled = !current || (remoteMode && connectionState !== "open");

    els.queueCount.textContent = String(state.queue.length);
    els.queue.replaceChildren();

    state.queue.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "ec-music-queue-item";
      li.innerHTML = `
        <span class="ec-music-queue-index">${index + 1}</span>
        <span class="ec-music-queue-copy">
          <strong>${escapeHtml(formatVideoLabel(item.videoId))}</strong>
          <small>Requested by ${escapeHtml(item.requestedBy || "Guest")}</small>
        </span>
      `;
      els.queue.appendChild(li);
    });

    els.emptyQueue.hidden = state.queue.length > 0;
    els.join.classList.toggle("is-visible", autoplayBlocked && Boolean(current));
  }

  function formatVideoLabel(videoId) {
    return `YouTube · ${videoId}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) {
      createYouTubePlayer();
      return;
    }

    const priorReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { priorReady?.(); } catch {}
      createYouTubePlayer();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  }

  function createYouTubePlayer() {
    if (player || !window.YT?.Player) return;

    player = new YT.Player("eastcoinMusicYoutube", {
      width: "100%",
      height: "100%",
      playerVars: {
        playsinline: 1,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          playerReady = true;
          try {
            const stored = Number(localStorage.getItem(VOLUME_KEY));
            event.target.setVolume(Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 55);
          } catch {
            event.target.setVolume(55);
          }
          syncPlayerToState(true);
        },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.ENDED) {
            handleEnded(state.current?.id || "");
          }
          if (event.data === YT.PlayerState.PLAYING) {
            autoplayBlocked = false;
            render();
          }
        },
        onAutoplayBlocked: () => {
          autoplayBlocked = true;
          render();
        },
        onError: () => {
          const failedCurrentId = state.current?.id || "";
          setHelp("YouTube could not play that video. Skipping it.", true);
          window.setTimeout(() => handleEnded(failedCurrentId), 800);
        }
      }
    });
  }

  function syncPlayerToState(force = false) {
    if (!playerReady || !player) return;

    const current = state.current;
    if (!current) {
      if (currentLoadedId) {
        try { player.stopVideo(); } catch {}
      }
      currentLoadedId = "";
      return;
    }

    const elapsed = Math.max(0, (Date.now() - (Number(state.startedAt) || Date.now())) / 1000);

    if (force || currentLoadedId !== current.id) {
      currentLoadedId = current.id;
      try {
        player.loadVideoById({ videoId: current.videoId, startSeconds: elapsed });
      } catch {}
      return;
    }

    if (remoteMode) {
      try {
        const playerState = player.getPlayerState();
        const localTime = player.getCurrentTime();
        if (playerState === YT.PlayerState.PLAYING && Math.abs(localTime - elapsed) > 4) {
          player.seekTo(elapsed, true);
        }
      } catch {}
    }
  }

  function startProgressSync() {
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(() => {
      if (remoteMode && state.current) syncPlayerToState(false);
      try {
        if (playerReady && player && player.getVolume) {
          localStorage.setItem(VOLUME_KEY, String(player.getVolume()));
        }
      } catch {}
    }, 5000);
  }

  function normalizeWebSocketUrl(base) {
    let url;
    try { url = new URL(base); } catch { return ""; }
    if (url.protocol === "https:") url.protocol = "wss:";
    else if (url.protocol === "http:") url.protocol = "ws:";
    if (!/^wss?:$/.test(url.protocol)) return "";

    let path = url.pathname.replace(/\/+$/, "");
    if (!/\/room\//.test(path)) path += `/room/${encodeURIComponent(roomName)}`;
    url.pathname = path;
    url.searchParams.set("client", clientId);
    url.searchParams.set("name", readNickname());
    return url.toString();
  }

  function connectSharedRoom() {
    const wsUrl = normalizeWebSocketUrl(configuredEndpoint);
    if (!wsUrl) {
      remoteMode = false;
      connectionState = "local";
      setHelp("Shared-room URL is invalid. Running in local mode.", true);
      render();
      return;
    }

    window.clearTimeout(reconnectTimer);
    connectionState = "connecting";
    render();

    try { socket?.close(); } catch {}

    socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      connectionState = "open";
      setHelp("Connected to the shared EastCoin music room.");
      socket.send(JSON.stringify({ type: "identity", name: readNickname() }));
      render();
    });

    socket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }

      if (message.type === "state" && message.state) {
        const previousId = state.current?.id || "";
        state = sanitizeState(message.state);
        render();
        syncPlayerToState(previousId !== (state.current?.id || ""));
      } else if (message.type === "error") {
        setHelp(message.message || "Music room rejected that request.", true);
      }
    });

    socket.addEventListener("close", () => {
      connectionState = "connecting";
      render();
      reconnectTimer = window.setTimeout(connectSharedRoom, 2500);
    });

    socket.addEventListener("error", () => {
      setHelp("Shared room connection failed. Reconnecting…", true);
    });
  }
})();

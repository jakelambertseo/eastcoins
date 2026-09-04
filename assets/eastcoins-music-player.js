(() => {
  "use strict";

  const body = document.body;
  const controlButton = document.getElementById("musicBtn");

  if (!body || !controlButton) return;

  const STORAGE_KEY = "eastcoinMusicLocalStateV1";
  const OPEN_KEY = "eastcoinMusicDockOpen";
  const CLIENT_KEY = "eastcoinMusicClientId";
  const VOLUME_KEY = "eastcoinMusicVolume";
  const MAX_QUEUE = 25;
  const TITLE_FETCH_TIMEOUT_MS = 3500;

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
  let currentUser = null;

  const clientId = getOrCreateClientId();

  let dock = null;
  let els = null;

  // Identity resolves before the dock ever renders so "Requested by" always
  // reflects the real signed-in Twitch member (or an honest "Guest"/login
  // prompt) instead of a placeholder that gets swapped in a beat later.
  fetchIdentity().finally(init);

  function init() {
    dock = createDock();
    els = collectElements();
    bindUi();
    renderIdentity();
    loadYouTubeApi();

    if (remoteMode) connectSharedRoom();
    restoreDockState();
    render();
    startProgressSync();
  }

  async function fetchIdentity() {
    try {
      const response = await fetch("/api/picks/bootstrap", {
        credentials: "same-origin",
        cache: "no-store"
      });

      const payload = await response.json().catch(() => null);
      const session = payload?.ok ? payload.session : null;

      if (session?.authenticated && session.user?.login) {
        currentUser = session.user;
      }
    } catch {
      currentUser = null;
    }
  }

  function identityName() {
    return currentUser?.displayName || currentUser?.login || "Guest";
  }

  function identityAvatar() {
    return currentUser?.profileImageUrl || "";
  }

  function authUrl() {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    return `/api/picks/auth/twitch/start?returnTo=${encodeURIComponent(returnTo)}`;
  }

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

  function sanitizeAvatarUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function sanitizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const videoId = String(item.videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    return {
      id: String(item.id || crypto.randomUUID()),
      videoId,
      title: String(item.title || "").slice(0, 120).trim(),
      requestedBy: String(item.requestedBy || "Guest").slice(0, 24),
      requestedByAvatar: sanitizeAvatarUrl(item.requestedByAvatar),
      addedAt: Number(item.addedAt) || Date.now(),
      reactions: Math.max(0, Number(item.reactions) || 0)
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
            <span class="ec-music-kicker" id="eastcoinMusicStatus">Music Player</span>
            <div class="ec-music-title-row">
              <img class="ec-music-title-icon" src="https://cdn.betterttv.net/emote/635dd342ed98a03da0ce387d/3x.webp" alt="" />
              <strong>EastCoin Music Player</strong>
            </div>
          </div>
          <div class="ec-music-head-actions">
            <div class="ec-music-share-wrap">
              <button class="ec-music-icon-button" id="eastcoinMusicShare" type="button" aria-label="Copy shareable room link" title="Copy shareable room link">⤴</button>
              <div class="ec-music-copytip" id="eastcoinMusicCopyTip" role="status" aria-live="polite">
                <strong>Link Copied!</strong>
                <span>Music room link copied</span>
              </div>
            </div>
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

        <div class="ec-music-volume-row">
          <button class="ec-music-icon-button ec-music-mute" id="eastcoinMusicMute" type="button" aria-label="Mute">🔊</button>
          <input class="ec-music-volume" id="eastcoinMusicVolume" type="range" min="0" max="100" value="55" aria-label="Volume" />
        </div>

        <section class="ec-music-now" aria-label="Now playing">
          <div class="ec-music-now-label" id="eastcoinMusicNowLabel" hidden>
            <span class="ec-music-now-label-dot"></span>Now Playing
          </div>
          <div class="ec-music-now-row">
            <span class="ec-music-now-avatar" id="eastcoinMusicNowAvatar" hidden></span>
            <div class="ec-music-now-copy">
              <strong id="eastcoinMusicNowTitle">Nothing queued</strong>
              <small id="eastcoinMusicNowMeta">Paste a YouTube URL to start</small>
            </div>
            <button class="ec-music-react" id="eastcoinMusicReact" type="button" hidden aria-label="React with a thumbs up">
              👍 <span id="eastcoinMusicReactCount">0</span>
            </button>
          </div>
        </section>

        <section class="ec-music-request">
          <div class="ec-music-identity" id="eastcoinMusicIdentity"></div>
          <div class="ec-music-request-row">
            <input id="eastcoinMusicUrl" type="url" inputmode="url" autocomplete="off" placeholder="Paste a YouTube link" />
            <button id="eastcoinMusicAdd" type="button">Add</button>
          </div>
          <div class="ec-music-request-help" id="eastcoinMusicHelp">youtube.com, music.youtube.com and youtu.be links work.</div>
        </section>

        <div class="ec-music-queue-wrap">
          <div class="ec-music-queue-head"><span>Up next</span><span id="eastcoinMusicQueueCount">0</span></div>
          <ol class="ec-music-queue" id="eastcoinMusicQueue"></ol>
          <div class="ec-music-empty-queue" id="eastcoinMusicEmptyQueue">Queue is empty.</div>
        </div>
      </div>
    `;

    // Mounted directly on <body> as a fixed overlay rather than inside any
    // one V2 route container (main / .workspace / #player) — that's what
    // lets it stay open and keep playing across Events, the watch view, and
    // MultiView/Picks (which live inside #workspaceFrame) without the outer
    // shell ever unmounting it, the same way #persistentTwitchChat does.
    body.appendChild(section);
    return section;
  }

  function collectElements() {
    return {
      control: controlButton,
      close: document.getElementById("eastcoinMusicClose"),
      share: document.getElementById("eastcoinMusicShare"),
      copyTip: document.getElementById("eastcoinMusicCopyTip"),
      status: document.getElementById("eastcoinMusicStatus"),
      join: document.getElementById("eastcoinMusicJoin"),
      emptyPlayer: document.getElementById("eastcoinMusicEmptyPlayer"),
      nowLabel: document.getElementById("eastcoinMusicNowLabel"),
      nowAvatar: document.getElementById("eastcoinMusicNowAvatar"),
      nowTitle: document.getElementById("eastcoinMusicNowTitle"),
      nowMeta: document.getElementById("eastcoinMusicNowMeta"),
      react: document.getElementById("eastcoinMusicReact"),
      reactCount: document.getElementById("eastcoinMusicReactCount"),
      identity: document.getElementById("eastcoinMusicIdentity"),
      url: document.getElementById("eastcoinMusicUrl"),
      add: document.getElementById("eastcoinMusicAdd"),
      help: document.getElementById("eastcoinMusicHelp"),
      queue: document.getElementById("eastcoinMusicQueue"),
      queueCount: document.getElementById("eastcoinMusicQueueCount"),
      emptyQueue: document.getElementById("eastcoinMusicEmptyQueue"),
      mute: document.getElementById("eastcoinMusicMute"),
      volume: document.getElementById("eastcoinMusicVolume")
    };
  }

  function renderIdentity() {
    if (currentUser?.login) {
      els.identity.innerHTML = `
        <span class="ec-music-identity-avatar">${avatarMarkup(currentUser.displayName || currentUser.login, currentUser.profileImageUrl)}</span>
        <span>Requesting as <strong>${escapeHtml(identityName())}</strong></span>
      `;
    } else {
      els.identity.innerHTML = `
        <span class="ec-music-identity-avatar">T</span>
        <span>Requesting as <strong>Guest</strong></span>
        <a class="ec-music-identity-login" href="${escapeHtml(authUrl())}">Log in with Twitch</a>
      `;
    }
  }

  function bindUi() {
    els.control?.addEventListener("click", () => {
      setDockOpen(!body.classList.contains("music-dock-open"));
    });

    els.close?.addEventListener("click", () => setDockOpen(false));
    els.share?.addEventListener("click", shareRoomLink);
    els.join?.addEventListener("click", () => {
      autoplayBlocked = false;
      els.join.classList.remove("is-visible");
      try { player?.playVideo(); } catch {}
    });

    els.add?.addEventListener("click", submitRequest);
    els.url?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitRequest();
    });

    els.react?.addEventListener("click", sendReaction);

    els.volume?.addEventListener("input", () => {
      if (!player) return;
      const value = Math.max(0, Math.min(100, Number(els.volume.value) || 0));
      try {
        player.setVolume(value);
        if (value > 0 && player.isMuted?.()) player.unMute();
        try { localStorage.setItem(VOLUME_KEY, String(value)); } catch {}
      } catch {}
      renderMuteIcon();
    });

    els.mute?.addEventListener("click", () => {
      if (!player) return;
      try {
        if (player.isMuted?.()) {
          player.unMute();
        } else {
          player.mute();
        }
      } catch {}
      renderMuteIcon();
    });

    window.addEventListener("storage", (event) => {
      if (!remoteMode && event.key === STORAGE_KEY) {
        state = loadLocalState();
        render();
        syncPlayerToState();
      }
    });
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

    // Shared with the top search bar, the Custom Stream modal and /submit
    // (assets/eastcoins-youtube.js) so all four accept the same link shapes.
    return window.EastcoinYouTube?.extractVideo?.(raw)?.id || "";
  }

  async function fetchVideoTitle(videoId) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), TITLE_FETCH_TIMEOUT_MS);

      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
        { signal: controller.signal }
      );

      window.clearTimeout(timer);
      if (!response.ok) return "";

      const payload = await response.json().catch(() => null);
      return String(payload?.title || "").trim().slice(0, 120);
    } catch {
      return "";
    }
  }

  async function submitRequest() {
    const videoId = normalizeYouTubeId(els.url.value);
    if (!videoId) {
      setHelp("That does not look like a valid YouTube video link.", true);
      return;
    }

    els.add.disabled = true;
    els.add.textContent = "Adding…";

    const title = await fetchVideoTitle(videoId);
    const requestedBy = identityName();
    const requestedByAvatar = identityAvatar();

    els.add.disabled = false;
    els.add.textContent = "Add";

    if (remoteMode) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setHelp("Shared music room is reconnecting. Try again in a moment.", true);
        return;
      }
      socket.send(JSON.stringify({ type: "add", videoId, title, requestedBy, requestedByAvatar }));
    } else {
      addLocal(videoId, title, requestedBy, requestedByAvatar);
    }

    els.url.value = "";
    setHelp(remoteMode ? "Request sent to the shared queue." : "Added to your queue.");
  }

  function addLocal(videoId, title, requestedBy, requestedByAvatar) {
    if (state.current?.videoId === videoId || state.queue.some((item) => item.videoId === videoId)) {
      setHelp("That video is already in the queue.", true);
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      videoId,
      title,
      requestedBy,
      requestedByAvatar,
      addedAt: Date.now(),
      reactions: 0
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

  function sendReaction() {
    const current = state.current;
    if (!current) return;

    if (remoteMode) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "react", currentId: current.id }));
      }
      return;
    }

    current.reactions = (Number(current.reactions) || 0) + 1;
    saveLocalState();
    render();
  }

  let copyTipTimer = 0;

  function showCopyTip() {
    if (!els.copyTip) return;
    window.clearTimeout(copyTipTimer);
    els.copyTip.classList.add("show");
    copyTipTimer = window.setTimeout(() => els.copyTip.classList.remove("show"), 2200);
  }

  async function shareRoomLink() {
    const url = `${window.location.origin}/?music=on`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      showCopyTip();
    } catch {
      window.prompt("Copy this music room link:", url);
    }
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

  function statusText() {
    if (!remoteMode) return "Solo queue";
    if (connectionState !== "open") return "Reconnecting…";

    const listeners = Math.max(1, Number(state.listeners) || 1);
    return listeners === 1 ? "Just you" : `${listeners} listening`;
  }

  function avatarMarkup(name, avatarUrl) {
    if (avatarUrl) return `<img src="${escapeHtml(avatarUrl)}" alt="">`;
    return escapeHtml((String(name || "G").trim().slice(0, 1) || "G").toUpperCase());
  }

  // Tracks the last reaction count we've already animated for the current
  // song so every listener — not just the person who clicked — sees a
  // floating 👍 burst the moment the shared count ticks up.
  let lastReactionSnapshot = { id: "", count: 0 };

  function maybeAnimateReaction(current) {
    if (!current) {
      lastReactionSnapshot = { id: "", count: 0 };
      return;
    }

    const count = Math.max(0, Number(current.reactions) || 0);

    if (current.id !== lastReactionSnapshot.id) {
      lastReactionSnapshot = { id: current.id, count };
      return;
    }

    if (count > lastReactionSnapshot.count) spawnReactionBurst();
    lastReactionSnapshot = { id: current.id, count };
  }

  function spawnReactionBurst() {
    if (!els.react) return;
    const burst = document.createElement("span");
    burst.className = "ec-music-reaction-burst";
    burst.textContent = "👍";
    burst.setAttribute("aria-hidden", "true");
    els.react.appendChild(burst);
    window.setTimeout(() => burst.remove(), 900);
  }

  function render() {
    const current = state.current;
    maybeAnimateReaction(current);

    els.status.textContent = statusText();
    els.status.classList.toggle("is-live", remoteMode && connectionState === "open");
    els.status.title = !remoteMode
      ? "Only playing in your browser"
      : connectionState === "open"
        ? "Synced with everyone in the room"
        : "Reconnecting to the shared room";

    if (current) {
      els.nowTitle.textContent = current.title || "YouTube video";
      els.nowMeta.textContent = `Requested by ${current.requestedBy || "Guest"}`;
      els.nowAvatar.innerHTML = avatarMarkup(current.requestedBy, current.requestedByAvatar);
      els.nowAvatar.hidden = false;
    } else {
      els.nowTitle.textContent = "Nothing queued";
      els.nowMeta.textContent = "Paste a YouTube URL to start";
      els.nowAvatar.hidden = true;
    }

    els.emptyPlayer.hidden = Boolean(current);
    els.nowLabel.hidden = !current;

    els.react.hidden = !current;
    els.react.disabled = !current || (remoteMode && connectionState !== "open");
    els.reactCount.textContent = String(Math.max(0, Number(current?.reactions) || 0));

    els.queueCount.textContent = String(state.queue.length);
    els.queue.replaceChildren();

    state.queue.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "ec-music-queue-item";
      li.innerHTML = `
        <span class="ec-music-queue-num">${index + 1}</span>
        <span class="ec-music-queue-avatar">${avatarMarkup(item.requestedBy, item.requestedByAvatar)}</span>
        <span class="ec-music-queue-copy">
          <strong>${escapeHtml(item.title || "YouTube video")}</strong>
          <small>Requested by ${escapeHtml(item.requestedBy || "Guest")}</small>
        </span>
      `;
      els.queue.appendChild(li);
    });

    els.emptyQueue.hidden = state.queue.length > 0;
    els.join.classList.toggle("is-visible", autoplayBlocked && Boolean(current));
  }

  function renderMuteIcon() {
    if (!els.mute || !player) return;
    let muted = false;
    try { muted = Boolean(player.isMuted?.()); } catch {}
    els.mute.textContent = muted ? "🔇" : "🔊";
    els.mute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
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
      // Tried pointing this at youtube-nocookie.com (same fix used for the
      // plain <iframe src> embeds elsewhere) but the IFrame Player API's
      // widget script does not create a player at all when mixed with the
      // standard youtube.com/iframe_api bootstrap — confirmed by testing,
      // not by assumption. Left on youtube.com; only the Firefox-embed fix
      // for direct <iframe> URLs (search bar, Custom Stream, /submit) uses
      // the nocookie domain.
      playerVars: {
        playsinline: 1,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          playerReady = true;
          let volume = 55;
          try {
            const stored = Number(localStorage.getItem(VOLUME_KEY));
            volume = Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 55;
          } catch {}
          try { event.target.setVolume(volume); } catch {}
          if (els.volume) els.volume.value = String(volume);
          renderMuteIcon();
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
    url.searchParams.set("name", identityName());
    if (identityAvatar()) url.searchParams.set("avatar", identityAvatar());
    return url.toString();
  }

  function connectSharedRoom() {
    const wsUrl = normalizeWebSocketUrl(configuredEndpoint);
    if (!wsUrl) {
      remoteMode = false;
      connectionState = "local";
      setHelp("Shared-room URL is invalid. Running in solo mode.", true);
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
      socket.send(JSON.stringify({ type: "identity", name: identityName(), avatar: identityAvatar() }));
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

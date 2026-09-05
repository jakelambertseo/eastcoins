(() => {
  "use strict";

  const body = document.body;
  const controlButton = document.getElementById("musicBtn");

  if (!body || !controlButton) return;

  const STORAGE_KEY = "eastcoinMusicLocalStateV1";
  const OPEN_KEY = "eastcoinMusicDockOpen";
  const CLIENT_KEY = "eastcoinMusicClientId";
  const VOLUME_KEY = "eastcoinMusicVolume";
  const SIZE_KEY = "eastcoinMusicDockSize";
  const MINIMIZED_KEY = "eastcoinMusicDockMinimized";
  const MAX_QUEUE = 25;
  const TITLE_FETCH_TIMEOUT_MS = 3500;
  const TOKEN_REFRESH_MS = 10 * 60 * 1000;
  const SEARCH_DEBOUNCE_MS = 450;
  const SEARCH_MIN_LENGTH = 2;
  const MIN_DOCK_WIDTH = 300;
  const MAX_DOCK_WIDTH = 560;
  const MIN_DOCK_HEIGHT = 420;
  // Shared with /music (assets/eastcoins-music-page.js) so the two surfaces
  // coordinate over the same channel — whichever one the visitor last
  // focused silences the other's YouTube player instead of both playing the
  // shared room's audio at once.
  const AUDIO_LOCK_CHANNEL = "eastcoin-music-audio-lock";

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
  let musicAuthToken = null;
  let musicAuthTokenExpiresAt = 0;
  let isAudioOwner = true;
  let audioChannel = null;

  const clientId = getOrCreateClientId();
  const audioInstanceId = crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

  let dock = null;
  let els = null;

  // Identity resolves before the dock ever renders so "Requested by" always
  // reflects the real signed-in Twitch member (or an honest "Guest"/login
  // prompt) instead of a placeholder that gets swapped in a beat later. The
  // signed music-room token only makes sense to fetch once we know there's a
  // real session to sign it from.
  fetchIdentity()
    .then(() => (currentUser ? fetchMusicAuthToken() : null))
    .finally(init);

  function init() {
    dock = createDock();
    els = collectElements();
    bindUi();
    renderIdentity();
    initAudioLock();

    // The YouTube player is created lazily — only once the dock is actually
    // opened (see setDockOpen) — never eagerly here. Creating it on every
    // page load meant YT.Player.loadVideoById() (which cues AND plays)
    // fired for every visitor the instant the shared room had a current
    // song, regardless of whether they'd ever opened the dock.
    if (remoteMode) connectSharedRoom();
    restoreDockState();
    restoreDockSize();
    render();
    startProgressSync();

    window.setInterval(() => {
      if (currentUser) fetchMusicAuthToken().then(sendIdentity);
    }, TOKEN_REFRESH_MS);
  }

  async function fetchMusicAuthToken() {
    try {
      const response = await fetch("/api/music/token", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (payload?.ok && payload.authenticated && payload.token) {
        musicAuthToken = payload.token;
        musicAuthTokenExpiresAt = Number(payload.expiresAt) || 0;
      } else {
        musicAuthToken = null;
        musicAuthTokenExpiresAt = 0;
      }
    } catch {
      musicAuthToken = null;
      musicAuthTokenExpiresAt = 0;
    }
  }

  // Sent on connect and again after every token refresh, so the room's
  // "who's listening" roster (verified server-side against the token, never
  // trusted from the client) drops a name within one refresh cycle of that
  // person logging out or their session expiring.
  function sendIdentity() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "identity", name: identityName(), avatar: identityAvatar(), token: musicAuthToken }));
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
      reactions: Math.max(0, Number(item.reactions) || 0),
      special: item.special === "rasputin" ? "rasputin" : null,
      unskippable: Boolean(item.unskippable)
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
      listenerNames: Array.isArray(input.listenerNames) ? input.listenerNames.map(String).slice(0, 40) : [],
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
            <button class="ec-music-icon-button" id="eastcoinMusicMinimize" type="button" aria-label="Minimize player" title="Minimize player">–</button>
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

        <div class="ec-music-resize-handle" id="eastcoinMusicResizeHandle" aria-hidden="true"></div>

        <div class="ec-music-youtube-shell" id="eastcoinMusicYoutubeShell">
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
            <button class="ec-music-skip" id="eastcoinMusicSkip" type="button" hidden>Skip</button>
            <button class="ec-music-react" id="eastcoinMusicReact" type="button" hidden aria-label="React with a thumbs up">
              👍 <span id="eastcoinMusicReactCount">0</span>
            </button>
          </div>
        </section>

        <section class="ec-music-request">
          <div class="ec-music-identity" id="eastcoinMusicIdentity"></div>
          <div class="ec-music-request-row" id="eastcoinMusicRequestRow">
            <input id="eastcoinMusicUrl" type="text" autocomplete="off" placeholder="Search YouTube or paste a link" />
            <button id="eastcoinMusicAdd" type="button">Add</button>
          </div>
          <div class="ec-music-request-help" id="eastcoinMusicHelp">youtube.com, music.youtube.com and youtu.be links work.</div>
          <ol class="ec-music-search-results" id="eastcoinMusicSearchResults" hidden></ol>
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
      minimize: document.getElementById("eastcoinMusicMinimize"),
      resizeHandle: document.getElementById("eastcoinMusicResizeHandle"),
      share: document.getElementById("eastcoinMusicShare"),
      copyTip: document.getElementById("eastcoinMusicCopyTip"),
      status: document.getElementById("eastcoinMusicStatus"),
      join: document.getElementById("eastcoinMusicJoin"),
      emptyPlayer: document.getElementById("eastcoinMusicEmptyPlayer"),
      youtubeShell: document.getElementById("eastcoinMusicYoutubeShell"),
      nowLabel: document.getElementById("eastcoinMusicNowLabel"),
      nowAvatar: document.getElementById("eastcoinMusicNowAvatar"),
      nowTitle: document.getElementById("eastcoinMusicNowTitle"),
      nowMeta: document.getElementById("eastcoinMusicNowMeta"),
      skip: document.getElementById("eastcoinMusicSkip"),
      react: document.getElementById("eastcoinMusicReact"),
      reactCount: document.getElementById("eastcoinMusicReactCount"),
      identity: document.getElementById("eastcoinMusicIdentity"),
      requestRow: document.getElementById("eastcoinMusicRequestRow"),
      url: document.getElementById("eastcoinMusicUrl"),
      add: document.getElementById("eastcoinMusicAdd"),
      help: document.getElementById("eastcoinMusicHelp"),
      searchResults: document.getElementById("eastcoinMusicSearchResults"),
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
    els.minimize?.addEventListener("click", toggleMinimized);
    els.share?.addEventListener("click", shareRoomLink);
    els.join?.addEventListener("click", () => {
      autoplayBlocked = false;
      els.join.classList.remove("is-visible");
      try { player?.playVideo(); } catch {}
    });

    els.add?.addEventListener("click", submitRequest);
    els.url?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      // Enter adds the top search result when the dropdown is open (so
      // typing a query and hitting Enter behaves like a normal search box);
      // otherwise it falls back to the paste-a-link flow.
      const firstResult = els.searchResults?.hidden ? null : els.searchResults?.querySelector(".ec-music-search-result");
      if (firstResult && !firstResult.disabled) {
        firstResult.click();
      } else {
        submitRequest();
      }
    });

    let searchTimer = 0;
    els.url?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      const query = els.url.value.trim();

      if (normalizeYouTubeId(query) || query.length < SEARCH_MIN_LENGTH) {
        clearSearchResults();
        return;
      }

      searchTimer = window.setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    });

    document.addEventListener("click", (event) => {
      if (!els.url || !els.searchResults) return;
      if (event.target === els.url || els.searchResults.contains(event.target)) return;
      clearSearchResults();
    });

    els.skip?.addEventListener("click", voteSkip);
    els.react?.addEventListener("click", sendReaction);
    bindResizeHandle();

    els.volume?.addEventListener("input", () => {
      const value = Math.max(0, Math.min(100, Number(els.volume.value) || 0));
      try { localStorage.setItem(VOLUME_KEY, String(value)); } catch {}
      if (player && isAudioOwner) {
        try {
          player.setVolume(value);
          if (value > 0 && player.isMuted?.()) player.unMute();
        } catch {}
      }
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
    let minimized = false;
    try { open = localStorage.getItem(OPEN_KEY) === "true"; } catch {}
    try { minimized = localStorage.getItem(MINIMIZED_KEY) === "true"; } catch {}
    setDockOpen(open, false);
    setMinimized(minimized, false);
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
    if (enabled) {
      // Lazy — no-ops if the player already exists. This is the only path
      // that creates the YouTube player, so nothing plays until the visitor
      // (or a previously-open, persisted session) actually opens the dock.
      loadYouTubeApi();
      syncPlayerToState();
    }
  }

  // Minimizing collapses the panel's visible height via CSS (overflow, not
  // display:none) so the YouTube iframe stays mounted and keeps playing
  // audio in the background — only the Close button actually tears it down.
  function setMinimized(minimized, persist = true) {
    const enabled = Boolean(minimized);
    dock.classList.toggle("is-minimized", enabled);
    els.minimize?.setAttribute("aria-label", enabled ? "Restore player" : "Minimize player");
    els.minimize?.setAttribute("title", enabled ? "Restore player" : "Minimize player");
    if (persist) {
      try { localStorage.setItem(MINIMIZED_KEY, String(enabled)); } catch {}
    }
  }

  function toggleMinimized() {
    setMinimized(!dock.classList.contains("is-minimized"));
  }

  function restoreDockSize() {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      const width = Number(saved.width);
      const height = Number(saved.height);
      if (Number.isFinite(width) && Number.isFinite(height)) {
        applyDockSize(width, height);
      }
    } catch {}
  }

  function applyDockSize(width, height) {
    const maxHeight = Math.max(MIN_DOCK_HEIGHT, window.innerHeight - 28);
    const clampedWidth = Math.max(MIN_DOCK_WIDTH, Math.min(MAX_DOCK_WIDTH, width));
    const clampedHeight = Math.max(MIN_DOCK_HEIGHT, Math.min(maxHeight, height));
    dock.style.width = `${clampedWidth}px`;
    dock.style.height = `${clampedHeight}px`;
    dock.classList.add("is-resized");
  }

  function bindResizeHandle() {
    const handle = els.resizeHandle;
    if (!handle) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      const rect = dock.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      try { handle.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      // The dock is anchored via right/bottom, so the handle sits at the
      // panel's top-left — dragging up and left (away from that anchor)
      // is what should grow the box, hence the reversed deltas here.
      const nextWidth = startWidth + (startX - event.clientX);
      const nextHeight = startHeight + (startY - event.clientY);
      applyDockSize(nextWidth, nextHeight);
    });

    const stopDragging = (event) => {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture(event.pointerId); } catch {}
      const rect = dock.getBoundingClientRect();
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify({ width: rect.width, height: rect.height }));
      } catch {}
    };

    handle.addEventListener("pointerup", stopDragging);
    handle.addEventListener("pointercancel", stopDragging);
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
    if (remoteMode && !currentUser) {
      setHelp("Log in with Twitch above to request a song.", true);
      return;
    }

    const videoId = normalizeYouTubeId(els.url.value);
    if (!videoId) {
      setHelp("That does not look like a valid YouTube video link.", true);
      return;
    }

    els.add.disabled = true;
    els.add.textContent = "Adding…";
    const title = await fetchVideoTitle(videoId);
    els.add.disabled = false;
    els.add.textContent = "Add";

    await sendAddRequest(videoId, title);
    els.url.value = "";
    clearSearchResults();
  }

  // Shared by the paste-a-link flow above and search-result clicks below —
  // both already know the videoId/title, they just differ in how they got it.
  async function addFromSearchResult(videoId, title) {
    if (remoteMode && !currentUser) {
      setHelp("Log in with Twitch above to request a song.", true);
      return;
    }
    await sendAddRequest(videoId, title);
    els.url.value = "";
    clearSearchResults();
  }

  async function sendAddRequest(videoId, title) {
    const requestedBy = identityName();
    const requestedByAvatar = identityAvatar();

    if (remoteMode && (!musicAuthToken || Date.now() > musicAuthTokenExpiresAt - 60000)) {
      await fetchMusicAuthToken();
    }

    if (remoteMode) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setHelp("Shared music room is reconnecting. Try again in a moment.", true);
        return;
      }
      if (!musicAuthToken) {
        setHelp("Log in with Twitch above to request a song.", true);
        return;
      }
      socket.send(JSON.stringify({ type: "add", videoId, title, requestedBy, requestedByAvatar, token: musicAuthToken }));
      setHelp("Added to the queue.");
    } else {
      addLocal(videoId, title, requestedBy, requestedByAvatar);
      setHelp("Added to your queue.");
    }
  }

  async function runSearch(query) {
    if (!remoteMode) return;
    const url = searchUrl(query);
    if (!url) return;

    setHelp("Searching…");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!payload?.ok) {
        setHelp(payload?.message || "Search is unavailable right now.", true);
        return;
      }
      renderSearchResults(payload.results || []);
    } catch {
      setHelp("Search failed. Try again.", true);
    }
  }

  function renderSearchResults(results) {
    if (!els.searchResults) return;

    if (!results.length) {
      els.searchResults.hidden = true;
      els.searchResults.replaceChildren();
      setHelp("No results.");
      return;
    }

    setHelp("");
    els.searchResults.hidden = false;
    els.searchResults.replaceChildren();

    const gated = remoteMode && !currentUser;
    results.forEach((result) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ec-music-search-result";
      button.disabled = gated;
      button.innerHTML = `
        <span class="ec-music-search-thumb">${result.thumbnail ? `<img src="${escapeHtml(result.thumbnail)}" alt="">` : ""}</span>
        <span class="ec-music-search-copy">
          <strong>${escapeHtml(result.title || "YouTube video")}</strong>
          <small>${escapeHtml(result.channelTitle || "")}</small>
        </span>
        <span class="ec-music-search-add">${gated ? "Log in" : "+ Add"}</span>
      `;
      button.addEventListener("click", () => {
        addFromSearchResult(result.videoId, result.title);
      });
      li.appendChild(button);
      els.searchResults.appendChild(li);
    });
  }

  function clearSearchResults() {
    if (!els.searchResults) return;
    els.searchResults.hidden = true;
    els.searchResults.replaceChildren();
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

  function handleEnded(expectedCurrentId = state.current?.id || "", reason = "state-change") {
    if (!state.current || !expectedCurrentId) return;
    if (state.current.id !== expectedCurrentId) return;

    if (remoteMode) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ended", currentId: expectedCurrentId, reason }));
      }
    } else {
      advanceLocal(expectedCurrentId);
    }
  }

  function statusText() {
    if (!remoteMode) return "Solo queue";
    if (connectionState !== "open") return "Reconnecting…";

    const listeners = Math.max(1, Number(state.listeners) || 1);
    const names = Array.isArray(state.listenerNames) ? state.listenerNames : [];
    if (!names.length) return listeners === 1 ? "Just you" : `${listeners} listening`;

    const shown = names.slice(0, 3).join(", ");
    const extra = names.length > 3 ? ` +${names.length - 3} more` : "";
    return listeners === 1 ? `Just you (${shown})` : `${listeners} listening: ${shown}${extra}`;
  }

  function avatarMarkup(name, avatarUrl) {
    if (avatarUrl) return `<img src="${escapeHtml(avatarUrl)}" alt="">`;
    return escapeHtml((String(name || "G").trim().slice(0, 1) || "G").toUpperCase());
  }

  function thumbnailMarkup(videoId) {
    return `<img src="https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg" alt="" loading="lazy">`;
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
    els.status.title = state.listenerNames?.length
      ? `Listening now: ${state.listenerNames.join(", ")}`
      : !remoteMode
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
    els.youtubeShell?.classList.toggle("is-special-rasputin", current?.special === "rasputin");

    const listeners = Math.max(1, Number(state.listeners) || 1);
    const skipThreshold = Math.max(1, Number(state.skipThreshold) || 1);

    els.skip.hidden = !current;
    els.skip.disabled = !current || current?.unskippable || (remoteMode && connectionState !== "open");
    els.skip.textContent = current?.unskippable
      ? "🎉 Unskippable"
      : remoteMode && current && listeners > 1
        ? `Skip ${state.skipVotes || 0}/${skipThreshold}`
        : "Skip";

    els.react.hidden = !current;
    els.react.disabled = !current || (remoteMode && connectionState !== "open");
    els.reactCount.textContent = String(Math.max(0, Number(current?.reactions) || 0));

    els.queueCount.textContent = String(state.queue.length);
    els.queue.replaceChildren();

    state.queue.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "ec-music-queue-item";
      li.classList.toggle("is-special-rasputin", item.special === "rasputin");
      li.innerHTML = `
        <span class="ec-music-queue-num">${index + 1}</span>
        <span class="ec-music-queue-thumb">${thumbnailMarkup(item.videoId)}</span>
        <span class="ec-music-queue-copy">
          <strong>${item.special === "rasputin" ? "🎉 " : ""}${escapeHtml(item.title || "YouTube video")}</strong>
          <small>Requested by ${escapeHtml(item.requestedBy || "Guest")}</small>
        </span>
      `;
      els.queue.appendChild(li);
    });

    els.emptyQueue.hidden = state.queue.length > 0;
    els.join.classList.toggle("is-visible", autoplayBlocked && Boolean(current));

    // Searching/pasting a link stays open to guests — each search result is
    // individually gated with its own "Log in" prompt (renderSearchResults),
    // so only the direct-paste Add button needs blocking here.
    const requestsGated = remoteMode && !currentUser;
    els.add.disabled = requestsGated;
    els.requestRow.classList.toggle("is-gated", requestsGated);
    if (els.searchResults && !els.searchResults.hidden) {
      els.searchResults.querySelectorAll(".ec-music-search-result").forEach((button) => {
        button.disabled = requestsGated;
        const addLabel = button.querySelector(".ec-music-search-add");
        if (addLabel) addLabel.textContent = requestsGated ? "Log in" : "+ Add";
      });
    }
  }

  function renderMuteIcon() {
    if (!els.mute || !player) return;
    let muted = false;
    try { muted = Boolean(player.isMuted?.()); } catch {}
    els.mute.textContent = muted ? "🔇" : "🔊";
    els.mute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
  }

  // Both /music and this floating dock play the same shared room
  // independently — without this, opening one while the other's tab is
  // still open means the room's audio plays twice at once. Whichever
  // surface last had real OS/tab focus "owns" audible sound; the other
  // silences its player via volume, not the mute button, so the visitor's
  // own mute/volume choice stays untouched and instantly resumes the
  // moment they get ownership back.
  function initAudioLock() {
    if (typeof BroadcastChannel === "undefined") return;

    audioChannel = new BroadcastChannel(AUDIO_LOCK_CHANNEL);
    audioChannel.addEventListener("message", (event) => {
      if (event.data?.type === "claim" && event.data.id !== audioInstanceId) {
        isAudioOwner = false;
        applyAudioOwnership();
      }
    });

    const claim = () => {
      isAudioOwner = true;
      applyAudioOwnership();
      try { audioChannel.postMessage({ type: "claim", id: audioInstanceId }); } catch {}
    };

    window.addEventListener("focus", claim);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") claim();
    });

    if (document.hasFocus()) {
      claim();
    } else {
      isAudioOwner = false;
    }
  }

  function applyAudioOwnership() {
    if (!player) return;
    try {
      if (isAudioOwner) {
        player.setVolume(Math.max(0, Math.min(100, Number(els.volume?.value) || 0)));
      } else {
        player.setVolume(0);
      }
    } catch {}
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
      // controls:0 hides YouTube's own seek bar/play-pause button, and
      // disablekb:1 blocks spacebar/arrow-key shortcuts for the same — the
      // shared queue's position is server-driven, so scrubbing or pausing
      // only desyncs the one listener who does it (see syncPlayerToState),
      // but removing the affordance avoids the "did I break something"
      // confusion of a control that quietly does nothing useful.
      playerVars: {
        playsinline: 1,
        rel: 0,
        controls: 0,
        disablekb: 1,
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
          if (els.volume) els.volume.value = String(volume);
          applyAudioOwnership();
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
          window.setTimeout(() => handleEnded(failedCurrentId, "player-error"), 800);
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
        const duration = player.getDuration();
        // Wall-clock elapsed keeps growing while waiting on the "song ended,
        // advance to next" round-trip to the Worker, so right at the end of a
        // song it can briefly exceed the video's real length. Seeking a
        // YouTube player to a time at/past its duration is a known trigger
        // for it to snap back and replay from 0 instead of staying ended —
        // skip the resync there and let the natural ENDED event (or the
        // next state broadcast once the server actually advances) handle it.
        const pastEnd = Number.isFinite(duration) && duration > 0 && elapsed >= duration - 0.5;
        if (!pastEnd && playerState === YT.PlayerState.PLAYING && Math.abs(localTime - elapsed) > 4) {
          player.seekTo(elapsed, true);
        }
      } catch {}
    }
  }

  function startProgressSync() {
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(() => {
      if (remoteMode && state.current) {
        syncPlayerToState(false);
        // Safety net: if the player has genuinely finished but the normal
        // onStateChange(ENDED) handler never fired, or its "ended" message
        // never reached the Worker (a dropped WS frame at the wrong moment),
        // this catches it within one tick instead of leaving the room stuck
        // on a finished song. Idempotent — the server ignores an "ended" for
        // a song that isn't current anymore, so this is a no-op once the
        // real advance has already happened.
        try {
          if (playerReady && player && player.getPlayerState() === YT.PlayerState.ENDED) {
            handleEnded(state.current.id, "safety-net");
          }
        } catch {}
      }
      try {
        // Skipped while not the audio owner — the lock has forced the real
        // player volume to 0 in that case, and persisting that would
        // overwrite the visitor's actual chosen volume for next time.
        if (playerReady && player && player.getVolume && isAudioOwner) {
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

  function searchUrl(query) {
    let url;
    try { url = new URL(configuredEndpoint); } catch { return ""; }
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    url.pathname = "/search";
    url.search = "";
    url.searchParams.set("q", query);
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
      sendIdentity();
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

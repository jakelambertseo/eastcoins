(() => {
  "use strict";

  const VOLUME_KEY = "eastcoinMusicVolume";
  const CLIENT_KEY = "eastcoinMusicClientId";
  const MAX_QUEUE = 25;
  const TITLE_FETCH_TIMEOUT_MS = 3500;
  const TOKEN_REFRESH_MS = 10 * 60 * 1000;
  const SEARCH_DEBOUNCE_MS = 450;
  const SEARCH_MIN_LENGTH = 2;

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
  let connectionState = remoteMode ? "connecting" : "unavailable";
  let state = emptyState();
  let currentUser = null;
  let musicAuthToken = null;
  let musicAuthTokenExpiresAt = 0;
  let history = [];
  let leaderboard = [];

  const clientId = getOrCreateClientId();
  let els = null;

  fetchIdentity()
    .then(() => (currentUser ? fetchMusicAuthToken() : null))
    .finally(init);

  function init() {
    els = collectElements();
    if (!els.youtube) return;

    bindUi();
    if (siteChatDisabled()) {
      document.body.classList.add("music-chat-hidden");
    } else {
      bindDeferredChat();
    }
    renderIdentity();

    // Deliberately not synchronous with the rest of init() — see the comment
    // on bindDeferredChat() for why this page in particular (the only place
    // a live YouTube player and Twitch chat both run on the same document)
    // avoids starting both of their GPU/video pipelines in the same tick.
    (window.requestIdleCallback || window.setTimeout)(loadYouTubeApi);

    if (remoteMode) {
      connectSharedRoom();
      fetchHistory();
    } else {
      setHelp("Shared music room is not configured.", true);
    }

    render();
    startProgressSync();

    window.setInterval(() => {
      if (currentUser) fetchMusicAuthToken().then(sendIdentity);
    }, TOKEN_REFRESH_MS);
  }

  function emptyState() {
    return {
      current: null,
      queue: [],
      startedAt: null,
      revision: 0,
      listeners: 1,
      listenerNames: [],
      skipVotes: 0,
      skipThreshold: 1
    };
  }

  async function fetchIdentity() {
    try {
      const response = await fetch("/api/picks/bootstrap", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      const session = payload?.ok ? payload.session : null;
      if (session?.authenticated && session.user?.login) currentUser = session.user;
    } catch {
      currentUser = null;
    }
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

  function collectElements() {
    return {
      status: document.getElementById("pageStatus"),
      statusText: document.getElementById("pageStatusText"),
      youtube: document.getElementById("pageYoutube"),
      emptyPlayer: document.getElementById("pageEmptyPlayer"),
      join: document.getElementById("pageJoin"),
      mute: document.getElementById("pageMute"),
      volume: document.getElementById("pageVolume"),
      nowLabel: document.getElementById("pageNowLabel"),
      nowAvatar: document.getElementById("pageNowAvatar"),
      nowTitle: document.getElementById("pageNowTitle"),
      nowMeta: document.getElementById("pageNowMeta"),
      skip: document.getElementById("pageSkip"),
      react: document.getElementById("pageReact"),
      reactCount: document.getElementById("pageReactCount"),
      identity: document.getElementById("pageIdentity"),
      queue: document.getElementById("pageQueue"),
      queueCount: document.getElementById("pageQueueCount"),
      emptyQueue: document.getElementById("pageEmptyQueue"),
      leaderboard: document.getElementById("pageLeaderboard"),
      leaderboardTotal: document.getElementById("pageLeaderboardTotal"),
      emptyLeaderboard: document.getElementById("pageEmptyLeaderboard"),
      history: document.getElementById("pageHistory"),
      historyCount: document.getElementById("pageHistoryCount"),
      emptyHistory: document.getElementById("pageEmptyHistory"),
      search: document.getElementById("pageSearch"),
      searchHelp: document.getElementById("pageSearchHelp"),
      searchResults: document.getElementById("pageSearchResults"),
      chatFrame: document.getElementById("pageTwitchChat"),
      chatDefer: document.getElementById("pageChatDefer")
    };
  }

  function renderIdentity() {
    if (currentUser?.login) {
      els.identity.innerHTML = `
        <span class="identity-avatar">${avatarMarkup(currentUser.displayName || currentUser.login, currentUser.profileImageUrl)}</span>
        <span>Requesting as <strong>${escapeHtml(identityName())}</strong></span>
      `;
    } else {
      els.identity.innerHTML = `
        <span class="identity-avatar">T</span>
        <span>Requesting as <strong>Guest</strong></span>
        <a class="identity-login" href="${escapeHtml(authUrl())}">Log in with Twitch</a>
      `;
    }
  }

  function bindUi() {
    els.join?.addEventListener("click", () => {
      autoplayBlocked = false;
      els.join.classList.remove("is-visible");
      try { player?.playVideo(); } catch {}
    });

    els.skip?.addEventListener("click", voteSkip);
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
        if (player.isMuted?.()) player.unMute();
        else player.mute();
      } catch {}
      renderMuteIcon();
    });

    let searchTimer = 0;
    els.search?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      const query = els.search.value.trim();

      if (query.length < SEARCH_MIN_LENGTH) {
        clearSearchResults();
        return;
      }

      // A pasted YouTube link resolves to a real video ID immediately — skip
      // the search API entirely and show it as a single ready-to-add result.
      const pastedId = normalizeYouTubeId(query);
      if (pastedId) {
        runPastedLink(pastedId);
        return;
      }

      searchTimer = window.setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    });

    document.addEventListener("click", (event) => {
      if (!els.search || !els.searchResults) return;
      if (event.target === els.search || els.searchResults.contains(event.target)) return;
      clearSearchResults();
    });
  }

  // This page has never had its own chat toggle — it needs to honor whatever
  // the visitor already set sitewide (root Settings modal's "Close Twitch
  // Chat", or the older standalone pages' own chat-collapsed toggle), rather
  // than loading the embed unconditionally regardless of that preference.
  function siteChatDisabled() {
    try {
      const settings = JSON.parse(localStorage.getItem("eastcoinV2SettingsV1") || "null");
      if (settings && typeof settings === "object" && settings.chatVisible === false) return true;
    } catch {}
    try {
      if (localStorage.getItem("eastcoinsChatCollapsed") === "true") return true;
    } catch {}
    return false;
  }

  // Twitch chat is deferred behind the visitor's first interaction, matching
  // the same performance-minded pattern the root EastCoin shell uses for its
  // own persistent chat — no reason to pay Twitch's script/request cost
  // before anyone actually engages with the page.
  //
  // This is also the only EastCoin page where a live YouTube player and a
  // live Twitch chat embed both run in the same top-level document at once
  // (the floating dock's own player only exists once someone opens the
  // dock, so it rarely overlaps with chat the way this page's player —
  // which loads for every visitor — always does). A Firefox user reported
  // this page crashing their entire browser, including an unrelated window
  // that also had Twitch chat open elsewhere — consistent with a shared
  // GPU-process crash from two heavy embeds negotiating hardware video/GPU
  // contexts at the same moment, rather than anything scoped to one tab.
  // There's no way to confirm that without reproducing it, so the fix here
  // is a best-effort mitigation: give the YouTube player's own startup (see
  // the requestIdleCallback in init()) a head start by delaying chat's
  // mount a couple of seconds after the qualifying interaction, instead of
  // firing the instant the visitor so much as scrolls.
  function bindDeferredChat() {
    const frame = els.chatFrame;
    if (!frame || !frame.dataset.src) return;

    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    const mount = () => {
      events.forEach((name) => window.removeEventListener(name, mount));
      window.setTimeout(() => {
        if (frame.getAttribute("src") === "about:blank") {
          frame.src = frame.dataset.src;
        }
        if (els.chatDefer) els.chatDefer.hidden = true;
      }, 2000);
    };

    events.forEach((name) => window.addEventListener(name, mount, { passive: true }));
  }

  function clearSearchResults() {
    if (!els.searchResults) return;
    els.searchResults.hidden = true;
    els.searchResults.replaceChildren();
    if (els.searchHelp) els.searchHelp.textContent = "";
  }

  async function runSearch(query) {
    if (!remoteMode) return;
    const url = searchUrl(query);
    if (!url) return;

    if (els.searchHelp) {
      els.searchHelp.textContent = "Searching…";
      els.searchHelp.classList.remove("is-error");
    }

    try {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!payload?.ok) {
        if (els.searchHelp) {
          els.searchHelp.textContent = payload?.message || "Search is unavailable right now.";
          els.searchHelp.classList.add("is-error");
        }
        return;
      }

      renderSearchResults(payload.results || []);
    } catch {
      if (els.searchHelp) {
        els.searchHelp.textContent = "Search failed. Try again.";
        els.searchHelp.classList.add("is-error");
      }
    }
  }

  let pastedLinkToken = 0;

  async function runPastedLink(videoId) {
    const token = ++pastedLinkToken;

    if (els.searchHelp) {
      els.searchHelp.textContent = "Looking up that link…";
      els.searchHelp.classList.remove("is-error");
    }

    const title = await fetchVideoTitle(videoId);
    if (token !== pastedLinkToken) return; // input changed again while this was in flight

    renderSearchResults([{
      videoId,
      title: title || "YouTube video",
      channelTitle: "",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    }]);
  }

  function renderSearchResults(results) {
    if (!els.searchResults) return;

    if (!results.length) {
      els.searchResults.hidden = true;
      els.searchResults.replaceChildren();
      if (els.searchHelp) els.searchHelp.textContent = "No results.";
      return;
    }

    if (els.searchHelp) els.searchHelp.textContent = "";
    els.searchResults.hidden = false;
    els.searchResults.replaceChildren();

    const gated = !currentUser;

    results.forEach((result) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.disabled = gated;
      button.innerHTML = `
        <span class="search-thumb">${result.thumbnail ? `<img src="${escapeHtml(result.thumbnail)}" alt="">` : ""}</span>
        <span class="search-copy">
          <strong>${escapeHtml(result.title || "YouTube video")}</strong>
          <small>${escapeHtml(result.channelTitle || "")}</small>
        </span>
        <span class="search-add">${gated ? "Log in" : "+ Add"}</span>
      `;
      button.addEventListener("click", () => {
        requestAgain(result.videoId, result.title);
        clearSearchResults();
        els.search.value = "";
      });
      li.appendChild(button);
      els.searchResults.appendChild(li);
    });
  }

  function searchUrl(query) {
    const url = endpointBase({ "wss:": "https:", "ws:": "http:", "https:": "https:", "http:": "http:" });
    if (!url) return "";
    url.pathname = "/search";
    url.search = "";
    url.searchParams.set("q", query);
    return url.toString();
  }

  function setHelp(message, error = false) {
    if (!els.searchHelp) return;
    els.searchHelp.textContent = message;
    els.searchHelp.classList.toggle("is-error", Boolean(error));
  }

  function normalizeYouTubeId(value) {
    const raw = String(value || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
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

  async function requestAgain(videoId, title) {
    if (!currentUser) {
      setHelp("Log in with Twitch above to request a song.", true);
      return;
    }
    await sendAdd(videoId, title);
  }

  async function sendAdd(videoId, title) {
    setHelp("Adding…");

    if (!musicAuthToken || Date.now() > musicAuthTokenExpiresAt - 60000) {
      await fetchMusicAuthToken();
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setHelp("Shared music room is reconnecting. Try again in a moment.", true);
      return;
    }
    if (!musicAuthToken) {
      setHelp("Log in with Twitch above to request a song.", true);
      return;
    }

    socket.send(JSON.stringify({
      type: "add",
      videoId,
      title,
      requestedBy: identityName(),
      requestedByAvatar: identityAvatar(),
      token: musicAuthToken
    }));

    setHelp("Added to the queue.");
  }

  function sendReaction() {
    const current = state.current;
    if (!current || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "react", currentId: current.id }));
  }

  function voteSkip() {
    if (!state.current || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "skip-vote", currentId: state.current.id }));
  }

  function statusText() {
    if (!remoteMode) return "Unavailable";
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

  function relativeTime(timestamp) {
    const diffMs = Date.now() - Number(timestamp || 0);
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

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
    burst.className = "reaction-burst";
    burst.textContent = "👍";
    burst.setAttribute("aria-hidden", "true");
    els.react.appendChild(burst);
    window.setTimeout(() => burst.remove(), 900);
  }

  function render() {
    const current = state.current;
    maybeAnimateReaction(current);

    els.statusText.textContent = statusText();
    els.status.classList.toggle("is-live", remoteMode && connectionState === "open");
    els.status.title = state.listenerNames?.length ? `Listening now: ${state.listenerNames.join(", ")}` : "";

    if (current) {
      els.nowTitle.textContent = current.title || "YouTube video";
      els.nowMeta.textContent = `Requested by ${current.requestedBy || "Guest"}`;
      els.nowAvatar.innerHTML = avatarMarkup(current.requestedBy, current.requestedByAvatar);
      els.nowAvatar.hidden = false;
    } else {
      els.nowTitle.textContent = "Nothing queued";
      els.nowMeta.textContent = "Search for a song above to start";
      els.nowAvatar.hidden = true;
    }

    els.emptyPlayer.hidden = Boolean(current);
    els.nowLabel.hidden = !current;

    const listeners = Math.max(1, Number(state.listeners) || 1);
    const skipThreshold = Math.max(1, Number(state.skipThreshold) || 1);

    els.skip.hidden = !current;
    els.skip.disabled = !current || connectionState !== "open";
    els.skip.textContent = current && listeners > 1
      ? `Skip ${state.skipVotes || 0}/${skipThreshold}`
      : "Skip";

    els.react.hidden = !current;
    els.react.disabled = !current || connectionState !== "open";
    els.reactCount.textContent = String(Math.max(0, Number(current?.reactions) || 0));

    els.queueCount.textContent = String(state.queue.length);
    els.queue.replaceChildren();

    state.queue.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `
        <span class="list-num">${index + 1}</span>
        <span class="queue-thumb">${thumbnailMarkup(item.videoId)}</span>
        <span class="list-copy">
          <strong>${escapeHtml(item.title || "YouTube video")}</strong>
          <small>Requested by ${escapeHtml(item.requestedBy || "Guest")}</small>
        </span>
      `;
      els.queue.appendChild(li);
    });

    els.emptyQueue.hidden = state.queue.length > 0;

    // Searching/pasting a link stays open to guests — each result button is
    // already individually gated (see renderSearchResults) with its own
    // "Log in" prompt, so there's no need to block the search box itself.
    els.join.classList.toggle("is-visible", autoplayBlocked && Boolean(current));

    renderHistory();
    renderLeaderboard();
  }

  function renderHistory() {
    els.historyCount.textContent = String(history.length);
    els.emptyHistory.hidden = history.length > 0;
    els.history.replaceChildren();

    // Newest first.
    [...history].reverse().forEach((entry) => {
      const li = document.createElement("li");
      li.className = "list-item";
      const disabled = !currentUser ? "disabled" : "";
      li.innerHTML = `
        <span class="history-thumb">${thumbnailMarkup(entry.videoId)}</span>
        <span class="list-copy">
          <strong>${escapeHtml(entry.title || "YouTube video")}</strong>
          <small>${escapeHtml(entry.requestedBy || "Guest")} · ${relativeTime(entry.requestedAt)}</small>
        </span>
        <button class="again-btn" type="button" ${disabled} data-video-id="${escapeHtml(entry.videoId)}" data-title="${escapeHtml(entry.title || "")}">↻ Again</button>
      `;
      li.querySelector(".again-btn")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        requestAgain(button.getAttribute("data-video-id"), button.getAttribute("data-title"));
      });
      els.history.appendChild(li);
    });
  }

  function renderLeaderboard() {
    els.leaderboardTotal.textContent = String(leaderboard.reduce((sum, entry) => sum + (entry.count || 0), 0));
    els.emptyLeaderboard.hidden = leaderboard.length > 0;
    els.leaderboard.replaceChildren();

    const medals = ["🥇", "🥈", "🥉"];

    leaderboard.forEach((entry, index) => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `
        <span class="rank">${medals[index] || index + 1}</span>
        <span class="list-avatar">${avatarMarkup(entry.displayName, entry.avatar)}</span>
        <span class="list-copy">
          <strong>${escapeHtml(entry.displayName || entry.login || "Guest")}</strong>
          <small>${entry.count} request${entry.count === 1 ? "" : "s"}</small>
        </span>
      `;
      els.leaderboard.appendChild(li);
    });
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

    player = new YT.Player("pageYoutube", {
      width: "100%",
      height: "100%",
      // controls:0 hides YouTube's own seek bar/play-pause button, and
      // disablekb:1 blocks spacebar/arrow-key shortcuts for the same — the
      // shared queue's position is server-driven, so letting one listener
      // scrub or pause the video would only desync their own view anyway
      // (see syncPlayerToState), but removing the affordance avoids the
      // "did I break something" confusion of a control that quietly does
      // nothing useful.
      playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, origin: window.location.origin },
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
          if (event.data === YT.PlayerState.ENDED) handleEnded(state.current?.id || "");
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

  function handleEnded(expectedCurrentId) {
    if (!state.current || !expectedCurrentId || state.current.id !== expectedCurrentId) return;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ended", currentId: expectedCurrentId }));
    }
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
      try { player.loadVideoById({ videoId: current.videoId, startSeconds: elapsed }); } catch {}
      return;
    }

    try {
      const playerState = player.getPlayerState();
      const localTime = player.getCurrentTime();
      const duration = player.getDuration();
      // See the matching comment in assets/eastcoins-music-player.js: seeking
      // to/past a video's real duration while the "ended, advance" round-trip
      // is still in flight can make YouTube snap back and replay from 0.
      const pastEnd = Number.isFinite(duration) && duration > 0 && elapsed >= duration - 0.5;
      if (!pastEnd && playerState === YT.PlayerState.PLAYING && Math.abs(localTime - elapsed) > 4) {
        player.seekTo(elapsed, true);
      }
    } catch {}
  }

  function startProgressSync() {
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(() => {
      if (remoteMode && state.current) {
        syncPlayerToState(false);
        // Safety net — see the matching comment in
        // assets/eastcoins-music-player.js: catches a genuinely-finished
        // video whose ENDED event or "ended" message never made it through.
        try {
          if (playerReady && player && player.getPlayerState() === YT.PlayerState.ENDED) {
            handleEnded(state.current.id);
          }
        } catch {}
      }
      try {
        if (playerReady && player && player.getVolume) {
          localStorage.setItem(VOLUME_KEY, String(player.getVolume()));
        }
      } catch {}
    }, 5000);
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
      listenerNames: Array.isArray(input.listenerNames) ? input.listenerNames.map(String).slice(0, 40) : [],
      skipVotes: Math.max(0, Number(input.skipVotes) || 0),
      skipThreshold: Math.max(1, Number(input.skipThreshold) || 1)
    };
  }

  function endpointBase(protocolMap) {
    let url;
    try { url = new URL(configuredEndpoint); } catch { return ""; }
    if (protocolMap[url.protocol]) url.protocol = protocolMap[url.protocol];
    return url;
  }

  function normalizeWebSocketUrl() {
    const url = endpointBase({ "https:": "wss:", "http:": "ws:" });
    if (!url || !/^wss?:$/.test(url.protocol)) return "";

    let path = url.pathname.replace(/\/+$/, "");
    if (!/\/room\//.test(path)) path += `/room/${encodeURIComponent(roomName)}`;
    url.pathname = path;
    url.searchParams.set("client", clientId);
    url.searchParams.set("name", identityName());
    if (identityAvatar()) url.searchParams.set("avatar", identityAvatar());
    return url.toString();
  }

  function historyUrl() {
    const url = endpointBase({ "wss:": "https:", "ws:": "http:", "https:": "https:", "http:": "http:" });
    if (!url) return "";
    let path = url.pathname.replace(/\/+$/, "");
    if (!/\/history\//.test(path)) path += `/history/${encodeURIComponent(roomName)}`;
    url.pathname = path;
    return url.toString();
  }

  async function fetchHistory() {
    const url = historyUrl();
    if (!url) return;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (Array.isArray(payload?.history)) history = payload.history;
      if (Array.isArray(payload?.userStats)) leaderboard = payload.userStats;
      render();
    } catch {}
  }

  function connectSharedRoom() {
    const wsUrl = normalizeWebSocketUrl();
    if (!wsUrl) {
      remoteMode = false;
      connectionState = "unavailable";
      setHelp("Shared-room URL is invalid.", true);
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
        const currentChanged = previousId !== (state.current?.id || "");
        render();
        syncPlayerToState(currentChanged);
        // A song transition is the only time a new history/leaderboard entry
        // could have appeared server-side, so refetch only then.
        if (currentChanged) fetchHistory();
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

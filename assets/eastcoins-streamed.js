(() => {
  "use strict";

  const API_BASE = "https://streamed.pk/api";
  const MATCH_CACHE_MS = 60_000;
  const state = {
    mode: "live",
    matches: [],
    visibleMatches: [],
    match: null,
    streams: [],
    activeStream: null,
    matchCache: new Map(),
    panelOpen: false
  };

  const form = document.getElementById("streamForm");
  const input = document.getElementById("streamUrl");
  const urlError = document.getElementById("urlError");
  const playerShell = document.getElementById("playerShell");
  const playerToolbar = document.getElementById("playerToolbar");
  const toolbarActions =
    playerToolbar?.querySelector(".toolbar-actions");
  const currentHost = document.getElementById("currentHost");
  const changeButton = document.getElementById("changeButton");
  const quickStreamedButton =
    document.getElementById("streamedBrowseButton");

  if (
    !form ||
    !input ||
    !playerShell ||
    !playerToolbar ||
    !toolbarActions
  ) {
    return;
  }

  const launcher = document.getElementById("streamedLauncher");
  const browser = document.getElementById("streamedBrowser");
  const searchInput = document.getElementById("streamedSearch");
  const status = document.getElementById("streamedStatus");
  const matchList = document.getElementById("streamedMatchList");
  const liveButton = document.getElementById("streamedLiveButton");
  const todayButton = document.getElementById("streamedTodayButton");
  const refreshButton = document.getElementById("streamedRefresh");

  const serverButton = document.createElement("button");
  serverButton.className = "toolbar-button";
  serverButton.id = "streamedServersButton";
  serverButton.type = "button";
  serverButton.hidden = true;
  serverButton.textContent = "Servers";

  toolbarActions.insertBefore(
    serverButton,
    toolbarActions.firstChild
  );

  const serverPanel = document.createElement("section");
  serverPanel.className = "streamed-server-panel";
  serverPanel.id = "streamedServerPanel";
  serverPanel.hidden = true;
  serverPanel.setAttribute(
    "aria-label",
    "Streamed server selector"
  );

  serverPanel.innerHTML = `
    <div class="streamed-server-header">
      <div class="streamed-server-heading">
        <span>Available servers</span>
        <strong id="streamedServerMatch">
          Streamed event
        </strong>
      </div>

      <div class="streamed-server-actions">
        <button
          class="streamed-server-back"
          id="streamedServerBack"
          type="button">
          ← View all streams
        </button>

        <button
          class="streamed-server-close"
          id="streamedServerClose"
          type="button"
          aria-label="Close server selector">
          ×
        </button>
      </div>
    </div>

    <div
      class="streamed-source-groups"
      id="streamedSourceGroups">
    </div>
  `;

  playerToolbar.insertAdjacentElement(
    "afterend",
    serverPanel
  );

  const serverMatch =
    document.getElementById("streamedServerMatch");
  const sourceGroups =
    document.getElementById("streamedSourceGroups");
  const serverBack =
    document.getElementById("streamedServerBack");
  const serverClose =
    document.getElementById("streamedServerClose");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function sourceLabel(value) {
    const normalized = String(value ?? "").trim();

    if (!normalized) {
      return "Unknown";
    }

    return normalized
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDate(timestamp) {
    const date = new Date(Number(timestamp));

    if (Number.isNaN(date.getTime())) {
      return "Time unavailable";
    }

    return date.toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  async function fetchJson(path) {
    const response = await fetch(
      `${API_BASE}${path}`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Streamed API returned ${response.status}.`
      );
    }

    return response.json();
  }

  async function fetchMatches(mode, force = false) {
    const endpoint =
      mode === "today"
        ? "/matches/all-today"
        : mode === "all"
          ? "/matches/all"
          : "/matches/live";

    const cached = state.matchCache.get(endpoint);

    if (
      !force &&
      cached &&
      Date.now() - cached.savedAt < MATCH_CACHE_MS
    ) {
      return cached.data;
    }

    const matches = await fetchJson(endpoint);

    if (!Array.isArray(matches)) {
      throw new Error(
        "Streamed returned an unexpected match response."
      );
    }

    state.matchCache.set(endpoint, {
      data: matches,
      savedAt: Date.now()
    });

    return matches;
  }

  function eventSourceCount(match) {
    return Array.isArray(match.sources)
      ? match.sources.length
      : 0;
  }

  function sortMatches(matches) {
    return [...matches].sort((left, right) => {
      const popularDifference =
        Number(Boolean(right.popular)) -
        Number(Boolean(left.popular));

      if (popularDifference) {
        return popularDifference;
      }

      return Number(left.date || 0) -
        Number(right.date || 0);
    });
  }

  function filterMatches() {
    const query = searchInput.value
      .trim()
      .toLowerCase();

    if (!query) {
      state.visibleMatches = state.matches;
      return;
    }

    state.visibleMatches = state.matches.filter(
      (match) => {
        const searchable = [
          match.title,
          match.category,
          match.id,
          ...(Array.isArray(match.sources)
            ? match.sources.flatMap((source) => [
                source.source,
                source.id
              ])
            : [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      }
    );
  }

  function renderMatches() {
    filterMatches();

    if (!state.visibleMatches.length) {
      matchList.innerHTML = `
        <div class="streamed-empty">
          No matching events were returned.
        </div>
      `;
      return;
    }

    matchList.innerHTML = state.visibleMatches
      .slice(0, 70)
      .map((match, index) => {
        const sources = eventSourceCount(match);
        const category =
          match.category
            ? sourceLabel(match.category)
            : "Sport";

        return `
          <button
            class="streamed-match"
            type="button"
            data-streamed-match-index="${index}">
            <span class="streamed-match-copy">
              <span class="streamed-match-title">
                ${escapeHtml(match.title || match.id)}
              </span>
              <span class="streamed-match-meta">
                <span>${escapeHtml(category)}</span>
                <span>${escapeHtml(formatDate(match.date))}</span>
                <span>
                  ${sources} source${sources === 1 ? "" : "s"}
                </span>
                ${match.popular
                  ? "<span>Popular</span>"
                  : ""}
              </span>
            </span>

            <span class="streamed-match-open">
              Load event →
            </span>
          </button>
        `;
      })
      .join("");
  }

  async function openBrowser(mode, force = false) {
    state.mode = mode;
    browser.hidden = false;
    launcher?.scrollIntoView({
      behavior:
        document.documentElement.classList.contains(
          "ec-reduced-motion"
        )
          ? "auto"
          : "smooth",
      block: "nearest"
    });

    liveButton.classList.toggle(
      "active",
      mode === "live"
    );
    todayButton.classList.toggle(
      "active",
      mode === "today"
    );

    setStatus(
      mode === "today"
        ? "Loading today’s Streamed events…"
        : "Loading live Streamed events…"
    );
    matchList.innerHTML = "";

    try {
      const matches = await fetchMatches(
        mode,
        force
      );

      state.matches = sortMatches(matches);
      searchInput.value = "";
      renderMatches();

      setStatus(
        `${state.matches.length} event${
          state.matches.length === 1 ? "" : "s"
        } returned. Select one to load all available servers.`
      );
    } catch (error) {
      state.matches = [];
      state.visibleMatches = [];
      matchList.innerHTML = `
        <div class="streamed-empty">
          The Streamed API could not be reached from this browser.
          Test the deployed eastcoin.vip page rather than opening the
          HTML file directly. If it still fails, the provider may need
          a small server-side CORS proxy.
        </div>
      `;
      setStatus(
        error.message ||
          "Unable to load Streamed events.",
        true
      );
    }
  }

  function watchTokenFromUrl(rawValue) {
    let parsed;

    try {
      parsed = new URL(
        /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(
          rawValue.trim()
        )
          ? rawValue.trim()
          : `https://${rawValue.trim()}`
      );
    } catch {
      return "";
    }

    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      hostname !== "streamed.pk" &&
      hostname !== "streamed.st" &&
      hostname !== "strmd.link"
    ) {
      return "";
    }

    const parts = parsed.pathname
      .split("/")
      .filter(Boolean);

    const watchIndex = parts.findIndex(
      (part) => part.toLowerCase() === "watch"
    );

    if (watchIndex === -1 || !parts[watchIndex + 1]) {
      return "";
    }

    return decodeURIComponent(parts[watchIndex + 1]);
  }

  function matchIdentifiers(match) {
    const identifiers = new Set();

    [
      match.id,
      slugify(match.title)
    ]
      .filter(Boolean)
      .forEach((value) =>
        identifiers.add(String(value).toLowerCase())
      );

    if (Array.isArray(match.sources)) {
      match.sources.forEach((source) => {
        const sourceName = String(
          source.source || ""
        ).toLowerCase();
        const sourceId = String(
          source.id || ""
        ).toLowerCase();

        if (sourceId) {
          identifiers.add(sourceId);
        }

        if (sourceName && sourceId) {
          identifiers.add(
            `${sourceName}-${sourceId}`
          );
        }
      });
    }

    return identifiers;
  }

  function findMatch(matches, token) {
    const normalizedToken = String(token)
      .toLowerCase()
      .replace(/^\/+|\/+$/g, "");

    const exact = matches.find((match) =>
      matchIdentifiers(match).has(normalizedToken)
    );

    if (exact) {
      return exact;
    }

    const tokenSlug = slugify(normalizedToken);

    return matches.find((match) => {
      const titleSlug = slugify(match.title);

      return (
        titleSlug &&
        (
          tokenSlug === titleSlug ||
          tokenSlug.endsWith(`-${titleSlug}`) ||
          titleSlug.endsWith(`-${tokenSlug}`)
        )
      );
    });
  }

  async function resolveMatchToken(token) {
    const endpoints = [
      "live",
      "today",
      "all"
    ];

    for (const mode of endpoints) {
      const matches = await fetchMatches(mode);
      const match = findMatch(matches, token);

      if (match) {
        return match;
      }
    }

    throw new Error(
      "That Streamed event was not found in the current API listings."
    );
  }

  async function fetchStreamsForMatch(match) {
    const sources = Array.isArray(match.sources)
      ? match.sources
      : [];

    if (!sources.length) {
      throw new Error(
        "No stream sources are currently listed for this event."
      );
    }

    const results = await Promise.allSettled(
      sources.map(async (source, sourceIndex) => {
        const sourceName = String(source.source || "");
        const sourceId = String(source.id || "");

        if (!sourceName || !sourceId) {
          return [];
        }

        const streams = await fetchJson(
          `/stream/${encodeURIComponent(sourceName)}/` +
          `${encodeURIComponent(sourceId)}`
        );

        if (!Array.isArray(streams)) {
          return [];
        }

        return streams.map((stream) => ({
          ...stream,
          source:
            stream.source || sourceName,
          sourceOrder: sourceIndex,
          sourceMatchId: sourceId
        }));
      })
    );

    const flattened = results.flatMap((result) =>
      result.status === "fulfilled"
        ? result.value
        : []
    );

    const unique = [];
    const seen = new Set();

    flattened.forEach((stream) => {
      if (!stream?.embedUrl) {
        return;
      }

      const key = [
        stream.source,
        stream.streamNo,
        stream.embedUrl
      ].join("|");

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      unique.push(stream);
    });

    unique.sort((left, right) => {
      const sourceDifference =
        Number(left.sourceOrder || 0) -
        Number(right.sourceOrder || 0);

      if (sourceDifference) {
        return sourceDifference;
      }

      return Number(left.streamNo || 0) -
        Number(right.streamNo || 0);
    });

    if (!unique.length) {
      throw new Error(
        "The event exists, but no playable streams were returned."
      );
    }

    return unique;
  }

  function isEnglish(stream) {
    return String(stream.language || "")
      .toLowerCase()
      .startsWith("english");
  }

  function recommendedStream(streams) {
    return (
      streams.find(
        (stream) => stream.hd && isEnglish(stream)
      ) ||
      streams.find((stream) => stream.hd) ||
      streams.find(isEnglish) ||
      streams[0]
    );
  }

  function streamKey(stream) {
    return [
      stream.source,
      stream.streamNo,
      stream.embedUrl
    ].join("|");
  }

  function preferredStream(
    streams,
    source,
    streamNo
  ) {
    if (!source && !streamNo) {
      return null;
    }

    return streams.find((stream) => {
      const sourceMatches =
        !source ||
        String(stream.source).toLowerCase() ===
          String(source).toLowerCase();

      const numberMatches =
        !streamNo ||
        String(stream.streamNo) === String(streamNo);

      return sourceMatches && numberMatches;
    }) || null;
  }

  function groupStreams(streams) {
    const groups = new Map();

    streams.forEach((stream) => {
      const key = String(stream.source || "unknown");

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(stream);
    });

    return groups;
  }

  function renderServerPanel() {
    const groups = groupStreams(state.streams);
    const recommended = recommendedStream(
      state.streams
    );
    const recommendedKey = streamKey(recommended);

    serverMatch.textContent =
      state.match?.title || "Streamed event";

    sourceGroups.innerHTML = Array.from(groups)
      .map(([source, streams]) => {
        return `
          <section class="streamed-source-group">
            <div class="streamed-source-title">
              <strong>${escapeHtml(
                sourceLabel(source)
              )}</strong>
              <span>
                ${streams.length} stream${
                  streams.length === 1 ? "" : "s"
                }
              </span>
            </div>

            <div class="streamed-stream-buttons">
              ${streams.map((stream) => {
                const active =
                  state.activeStream &&
                  streamKey(stream) ===
                    streamKey(state.activeStream);
                const isRecommended =
                  streamKey(stream) === recommendedKey;
                const quality = stream.hd ? "HD" : "SD";
                const language =
                  stream.language || "Unknown";

                return `
                  <button
                    class="streamed-stream-button${
                      active ? " active" : ""
                    }"
                    type="button"
                    data-stream-key="${escapeHtml(
                      streamKey(stream)
                    )}">
                    <span class="streamed-quality">
                      ${quality}
                    </span>
                    <span>
                      Stream ${escapeHtml(stream.streamNo)}
                    </span>
                    <span>
                      ${escapeHtml(language)}
                    </span>
                    ${isRecommended
                      ? '<span class="streamed-recommended">Recommended</span>'
                      : ""}
                  </button>
                `;
              }).join("")}
            </div>
          </section>
        `;
      })
      .join("");

    serverButton.hidden = false;
    serverButton.textContent =
      `Servers · ${state.streams.length}`;
  }

  function updateGlobalShareState() {
    if (!state.match || !state.activeStream) {
      window.eastcoinStreamedState = null;
      return;
    }

    window.eastcoinStreamedState = {
      matchId: state.match.id,
      title: state.match.title,
      source: state.activeStream.source,
      streamNo: state.activeStream.streamNo,
      embedUrl: state.activeStream.embedUrl
    };
  }

  function selectStream(stream, openPanel = false) {
    if (!stream?.embedUrl) {
      return;
    }

    state.activeStream = stream;

    if (typeof window.loadStream === "function") {
      window.loadStream(stream.embedUrl, true);
    } else {
      throw new Error(
        "The EastCoin player function is unavailable."
      );
    }

    currentHost.textContent = [
      state.match?.title || "Streamed",
      sourceLabel(stream.source),
      `Stream ${stream.streamNo}`,
      stream.hd ? "HD" : "SD",
      stream.language || ""
    ]
      .filter(Boolean)
      .join(" · ");

    renderServerPanel();
    updateGlobalShareState();

    if (openPanel) {
      setServerPanelOpen(true);
    }

    if (typeof window.showToast === "function") {
      window.showToast(
        `${sourceLabel(stream.source)} Stream ` +
        `${stream.streamNo} loaded.`
      );
    }
  }

  function setServerPanelOpen(open) {
    state.panelOpen = Boolean(open);
    serverPanel.hidden = !state.panelOpen;
    serverButton.classList.toggle(
      "active",
      state.panelOpen
    );
    serverButton.setAttribute(
      "aria-expanded",
      String(state.panelOpen)
    );
  }

  async function loadMatch(
    match,
    preferredSource = "",
    preferredNo = ""
  ) {
    state.match = match;
    setStatus(
      `Loading every available server for ${
        match.title || match.id
      }…`
    );

    try {
      const streams = await fetchStreamsForMatch(match);
      state.streams = streams;

      const selected =
        preferredStream(
          streams,
          preferredSource,
          preferredNo
        ) ||
        recommendedStream(streams);

      selectStream(selected, true);

      setStatus(
        `${streams.length} stream${
          streams.length === 1 ? "" : "s"
        } loaded across ${
          groupStreams(streams).size
        } source${
          groupStreams(streams).size === 1 ? "" : "s"
        }.`
      );
    } catch (error) {
      state.streams = [];
      state.activeStream = null;
      updateGlobalShareState();
      setStatus(
        error.message ||
          "Unable to load streams for this event.",
        true
      );
      throw error;
    }
  }

  function clearStreamedState() {
    state.match = null;
    state.streams = [];
    state.activeStream = null;
    state.panelOpen = false;
    window.eastcoinStreamedState = null;
    serverButton.hidden = true;
    serverPanel.hidden = true;
    sourceGroups.innerHTML = "";
  }

  async function handleStreamedUrl(rawValue) {
    const token = watchTokenFromUrl(rawValue);

    if (!token) {
      return false;
    }

    browser.hidden = false;
    setStatus(
      "Finding this Streamed event and its available servers…"
    );

    try {
      const match = await resolveMatchToken(token);
      await loadMatch(match);
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to resolve this Streamed event.",
        true
      );
      urlError.textContent =
        error.message ||
        "Unable to resolve this Streamed event.";
    }

    return true;
  }

  liveButton.addEventListener("click", () => {
    openBrowser("live");
  });

  todayButton.addEventListener("click", () => {
    openBrowser("today");
  });

  refreshButton.addEventListener("click", () => {
    openBrowser(state.mode, true);
  });

  searchInput.addEventListener("input", renderMatches);

  matchList.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-streamed-match-index]"
    );

    if (!button) {
      return;
    }

    const index = Number(
      button.dataset.streamedMatchIndex
    );
    const match = state.visibleMatches[index];

    if (match) {
      loadMatch(match).catch(() => {});
    }
  });

  serverButton.addEventListener("click", () => {
    setServerPanelOpen(!state.panelOpen);
  });

  function returnToAllStreams() {
    setServerPanelOpen(false);

    if (changeButton) {
      changeButton.click();
    }

    window.setTimeout(() => {
      openBrowser("live");
      launcher?.scrollIntoView({
        behavior:
          document.documentElement.classList.contains(
            "ec-reduced-motion"
          )
            ? "auto"
            : "smooth",
        block: "start"
      });
    }, 0);
  }

  serverBack.addEventListener(
    "click",
    returnToAllStreams
  );

  serverClose.addEventListener("click", () => {
    setServerPanelOpen(false);
  });

  sourceGroups.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-stream-key]"
    );

    if (!button) {
      return;
    }

    const stream = state.streams.find(
      (candidate) =>
        streamKey(candidate) ===
        button.dataset.streamKey
    );

    if (stream) {
      selectStream(stream, false);
    }
  });

  form.addEventListener(
    "submit",
    (event) => {
      const token = watchTokenFromUrl(input.value);

      if (!token) {
        clearStreamedState();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      urlError.textContent = "";
      handleStreamedUrl(input.value);
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const favorite = event.target.closest(
        ".quick-favorite-button[data-watch-url]"
      );

      if (favorite) {
        clearStreamedState();
      }
    },
    true
  );

  quickStreamedButton?.addEventListener(
    "click",
    () => {
      openBrowser("live");
    }
  );

  changeButton?.addEventListener("click", () => {
    clearStreamedState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.panelOpen) {
      setServerPanelOpen(false);
    }
  });

  async function restoreSharedStreamedRoom() {
    const params = new URLSearchParams(
      window.location.search
    );
    const matchId = params.get("streamedEvent");
    const normalWatchUrl = params.get("watch");

    if (!matchId) {
      if (!normalWatchUrl) {
        await openBrowser("live");
      }

      return;
    }

    const preferredSource =
      params.get("streamedSource") || "";
    const preferredNo =
      params.get("streamedStream") || "";

    browser.hidden = false;
    setStatus(
      "Restoring the shared Streamed event and server selection…"
    );

    try {
      const match = await resolveMatchToken(matchId);
      await loadMatch(
        match,
        preferredSource,
        preferredNo
      );
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to restore this Streamed room.",
        true
      );
    }
  }

  restoreSharedStreamedRoom();
})();

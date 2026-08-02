(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const discoveryRoot = document.getElementById(
    "streamedDiscoveryRoot"
  );

  if (!API || !discoveryRoot) {
    return;
  }

  const FAVORITES_KEY = "eastcoinFavoriteTeamsV1";
  const SELECTED_MATCH_KEY =
    "eastcoinSelectedStreamedMatchV1";
  const CONTINUE_KEY =
    "eastcoinContinueStreamedEventV1";
  const RECENT_KEY =
    "eastcoinRecentStreamedEventsV1";
  const SERVER_PREFERENCES_KEY =
    "eastcoinServerPreferencesV1";
  const SERVER_FEEDBACK_KEY =
    "eastcoinServerFeedbackV1";
  const SHORTCUT_HINT_KEY =
    "eastcoinStreamedShortcutHintV1";
  const CONTINUE_MAX_AGE =
    36 * 60 * 60 * 1000;
  const RECENT_MAX_AGE =
    7 * 24 * 60 * 60 * 1000;
  const RECENT_LIMIT = 6;
  const AUTO_RECOVERY_TIMEOUT = 14_000;
  const AUTO_RECOVERY_LIMIT = 2;
  const pageContext = discoveryRoot.dataset.context || "player";
  const isEventsPage = pageContext === "events";

  const state = {
    live: [],
    today: [],
    tomorrow: [],
    tomorrowLoaded: false,
    tomorrowLoading: false,
    sports: [],
    mode: "live",
    selectedSport: "all",
    query: "",
    favoriteTeams: loadFavoriteTeams(),
    continueEvent: loadContinueEvent(),
    recentEvents: loadRecentEvents(),
    serverPreferences: loadServerPreferences(),
    serverFeedback: loadServerFeedback(),
    currentMatch: null,
    streams: [],
    activeStream: null,
    serverPanelOpen: false,
    gameBreakOpen: false,
    connectionMode: "idle",
    failedStreamKeys: new Set(),
    recoveryTimer: null,
    recoverySerial: 0,
    automaticRecoveryAttempts: 0,
    shortcutHintScheduled: false,
    updatedAt: 0,
    stale: false
  };

  const elements = {
    launcher: document.getElementById("streamedLauncher"),
    browser: document.getElementById("streamedBrowser"),
    search: document.getElementById("streamedSearch"),
    status: document.getElementById("streamedStatus"),
    refresh: document.getElementById("streamedRefresh"),
    liveButton: document.getElementById("streamedLiveButton"),
    todayButton: document.getElementById("streamedTodayButton"),
    tomorrowButton: document.getElementById(
      "streamedTomorrowButton"
    ),
    sportTabs: document.getElementById("streamedSportTabs"),
    continueSection: document.getElementById(
      "streamedContinueSection"
    ),
    continueList: document.getElementById(
      "streamedContinueList"
    ),
    recentSection: document.getElementById(
      "streamedRecentSection"
    ),
    recentList: document.getElementById(
      "streamedRecentList"
    ),
    nightSection: document.getElementById(
      "streamedNightSection"
    ),
    nightList: document.getElementById(
      "streamedNightList"
    ),
    popularSection: document.getElementById("streamedPopularSection"),
    popularList: document.getElementById("streamedPopularList"),
    favoriteSection: document.getElementById("streamedFavoriteSection"),
    favoriteHeading: document.getElementById(
      "streamedFavoriteHeading"
    ),
    favoriteCopy: document.getElementById(
      "streamedFavoriteCopy"
    ),
    favoriteTeamList: document.getElementById("streamedFavoriteTeamList"),
    favoriteEventList: document.getElementById("streamedFavoriteEventList"),
    soonSection: document.getElementById("streamedSoonSection"),
    soonList: document.getElementById("streamedSoonList"),
    listSectionTitle: document.getElementById("streamedListSectionTitle"),
    matchList: document.getElementById("streamedMatchList"),
    detail: document.getElementById("streamedEventDetail")
  };

  const player = initializePlayerBindings();

  function initializePlayerBindings() {
    const form = document.getElementById("streamForm");
    const input = document.getElementById("streamUrl");
    const urlError = document.getElementById("urlError");
    const playerShell = document.getElementById("playerShell");
    const playerToolbar = document.getElementById("playerToolbar");
    const toolbarActions =
      playerToolbar?.querySelector(".toolbar-actions");
    const toolbarTitle =
      playerToolbar?.querySelector(".toolbar-title");
    const toolbarHeading =
      toolbarTitle?.querySelector("strong");
    const currentHost = document.getElementById("currentHost");
    const changeButton = document.getElementById("changeButton");
    const quickButton = document.getElementById(
      "streamedBrowseButton"
    );

    if (
      !form ||
      !input ||
      !urlError ||
      !playerShell ||
      !playerToolbar ||
      !toolbarActions ||
      !toolbarTitle ||
      !toolbarHeading ||
      !currentHost
    ) {
      return null;
    }

    const toolbarArtwork = document.createElement("span");
    toolbarArtwork.className = "streamed-toolbar-artwork";
    toolbarArtwork.hidden = true;
    toolbarArtwork.setAttribute("aria-hidden", "true");
    toolbarTitle.insertBefore(
      toolbarArtwork,
      toolbarTitle.firstChild
    );

    const toolbarKicker = document.createElement("span");
    toolbarKicker.className = "streamed-room-kicker";
    toolbarKicker.textContent = "Event room";
    toolbarKicker.hidden = true;
    toolbarTitle.insertBefore(
      toolbarKicker,
      toolbarHeading
    );

    const serverButton = document.createElement("button");
    serverButton.className = "toolbar-button";
    serverButton.id = "streamedServersButton";
    serverButton.type = "button";
    serverButton.hidden = true;
    serverButton.textContent = "Server Selector";
    serverButton.setAttribute(
      "aria-controls",
      "streamedServerPanel"
    );
    serverButton.setAttribute(
      "aria-expanded",
      "false"
    );
    serverButton.setAttribute(
      "aria-keyshortcuts",
      "S"
    );
    toolbarActions.insertBefore(
      serverButton,
      toolbarActions.firstChild
    );

    const nextServerButton =
      document.createElement("button");
    nextServerButton.className =
      "toolbar-button streamed-next-server";
    nextServerButton.id =
      "streamedNextServerButton";
    nextServerButton.type = "button";
    nextServerButton.hidden = true;
    nextServerButton.textContent =
      "Try Next Server";
    nextServerButton.setAttribute(
      "aria-keyshortcuts",
      "N"
    );
    serverButton.insertAdjacentElement(
      "afterend",
      nextServerButton
    );

    const connectionStatus =
      document.createElement("span");
    connectionStatus.className =
      "streamed-connection-status";
    connectionStatus.hidden = true;
    connectionStatus.innerHTML = `
      <span
        class="streamed-connection-dot"
        aria-hidden="true"></span>
      <span data-connection-label>
        Waiting
      </span>
    `;
    toolbarActions.insertBefore(
      connectionStatus,
      serverButton
    );

    const feedbackGroup =
      document.createElement("span");
    feedbackGroup.className =
      "streamed-feedback-group";
    feedbackGroup.hidden = true;
    feedbackGroup.innerHTML = `
      <button
        class="toolbar-button streamed-feedback-button works"
        type="button"
        data-stream-works>
        ✓ Works
      </button>
      <button
        class="toolbar-button streamed-feedback-button broken"
        type="button"
        data-stream-broken>
        ✕ Broken
      </button>
    `;
    nextServerButton.insertAdjacentElement(
      "afterend",
      feedbackGroup
    );

    const gameBreakButton =
      document.createElement("button");
    gameBreakButton.className =
      "toolbar-button streamed-game-break-button";
    gameBreakButton.type = "button";
    gameBreakButton.hidden = true;
    gameBreakButton.textContent = "Game Break";
    gameBreakButton.setAttribute(
      "aria-keyshortcuts",
      "G"
    );
    feedbackGroup.insertAdjacentElement(
      "afterend",
      gameBreakButton
    );

    const serverPanel = document.createElement("section");
    serverPanel.className = "streamed-server-panel";
    serverPanel.id = "streamedServerPanel";
    serverPanel.hidden = true;
    serverPanel.setAttribute("aria-label", "Streamed server selector");
    serverPanel.innerHTML = `
      <div class="streamed-server-header">
        <div class="streamed-server-event">
          <div
            class="streamed-server-artwork"
            id="streamedServerArtwork"
            aria-hidden="true"></div>
          <div class="streamed-server-heading">
            <span>Available servers</span>
            <strong id="streamedServerMatch">Streamed event</strong>
          </div>
        </div>
        <div class="streamed-server-actions">
          <button
            class="streamed-server-back"
            id="streamedServerBack"
            type="button">← View all streams</button>
          <button
            class="streamed-server-close"
            id="streamedServerClose"
            type="button"
            aria-label="Close Server List">
            Close Server List
          </button>
        </div>
      </div>

      <section class="streamed-server-preferences">
        <div class="streamed-server-preferences-head">
          <strong>Your server preferences</strong>
          <span>Saved on this browser</span>
        </div>

        <div class="streamed-server-preference-grid">
          <label>
            <span>Provider</span>
            <select id="streamedPreferredSource">
              <option value="auto">Auto</option>
            </select>
          </label>

          <label>
            <span>Language</span>
            <select id="streamedPreferredLanguage">
              <option value="any">Any</option>
              <option value="english">English</option>
            </select>
          </label>

          <label>
            <span>Quality</span>
            <select id="streamedPreferredQuality">
              <option value="hd">Prefer HD</option>
              <option value="any">Any quality</option>
            </select>
          </label>
        </div>

        <button
          class="streamed-use-preferences"
          id="streamedUsePreferences"
          type="button">
          Use preferred server
        </button>
      </section>

      <div
        class="streamed-source-groups"
        id="streamedSourceGroups"></div>
    `;
    playerToolbar.insertAdjacentElement("afterend", serverPanel);

    const gameBreakPanel =
      document.createElement("aside");
    gameBreakPanel.className =
      "streamed-game-break-panel";
    gameBreakPanel.id =
      "streamedGameBreakPanel";
    gameBreakPanel.hidden = true;
    gameBreakPanel.setAttribute(
      "aria-label",
      "EastCoin game break"
    );
    gameBreakPanel.innerHTML = `
      <div class="streamed-game-break-head">
        <div>
          <span>While you wait</span>
          <strong>Take a quick game break</strong>
        </div>
        <button
          class="streamed-game-break-close"
          type="button"
          data-close-game-break>
          Return to event
        </button>
      </div>

      <p class="streamed-game-break-copy">
        Games open in a new tab so your stream stays ready here.
      </p>

      <div class="streamed-game-break-list">
        <a
          href="bonk.html"
          target="_blank"
          rel="noopener">
          <span>🔨</span>
          <strong>EastCoin Bonk</strong>
          <small>Fast reflex bonking</small>
        </a>
        <a
          href="aim-trainer.html?v=embedded1"
          target="_blank"
          rel="noopener">
          <span>🎯</span>
          <strong>Aim Trainer</strong>
          <small>Quick accuracy challenge</small>
        </a>
        <a
          href="button-masher.html?v=embedded1"
          target="_blank"
          rel="noopener">
          <span>🟥</span>
          <strong>Button Masher</strong>
          <small>Short competitive rounds</small>
        </a>
      </div>
    `;
    serverPanel.insertAdjacentElement(
      "afterend",
      gameBreakPanel
    );

    const bindings = {
      form,
      input,
      urlError,
      playerShell,
      playerToolbar,
      toolbarActions,
      toolbarTitle,
      toolbarHeading,
      toolbarKicker,
      toolbarArtwork,
      currentHost,
      changeButton,
      quickButton,
      connectionStatus,
      connectionLabel: connectionStatus.querySelector(
        "[data-connection-label]"
      ),
      feedbackGroup,
      worksButton: feedbackGroup.querySelector(
        "[data-stream-works]"
      ),
      brokenButton: feedbackGroup.querySelector(
        "[data-stream-broken]"
      ),
      serverButton,
      nextServerButton,
      gameBreakButton,
      gameBreakPanel,
      gameBreakClose: gameBreakPanel.querySelector(
        "[data-close-game-break]"
      ),
      serverPanel,
      preferredSource: serverPanel.querySelector(
        "#streamedPreferredSource"
      ),
      preferredLanguage: serverPanel.querySelector(
        "#streamedPreferredLanguage"
      ),
      preferredQuality: serverPanel.querySelector(
        "#streamedPreferredQuality"
      ),
      usePreferences: serverPanel.querySelector(
        "#streamedUsePreferences"
      ),
      serverArtwork: serverPanel.querySelector(
        "#streamedServerArtwork"
      ),
      serverMatch: serverPanel.querySelector("#streamedServerMatch"),
      sourceGroups: serverPanel.querySelector("#streamedSourceGroups"),
      serverBack: serverPanel.querySelector("#streamedServerBack"),
      serverClose: serverPanel.querySelector("#streamedServerClose")
    };

    serverButton.addEventListener("click", () => {
      setServerPanelOpen(!state.serverPanelOpen);
    });
    nextServerButton.addEventListener(
      "click",
      () => selectNextStream("manual")
    );

    bindings.worksButton.addEventListener(
      "click",
      () => reportCurrentStream("works")
    );

    bindings.brokenButton.addEventListener(
      "click",
      () => reportCurrentStream("broken")
    );

    gameBreakButton.addEventListener(
      "click",
      () => setGameBreakOpen(
        !state.gameBreakOpen
      )
    );

    bindings.gameBreakClose.addEventListener(
      "click",
      () => setGameBreakOpen(false)
    );

    [
      bindings.preferredSource,
      bindings.preferredLanguage,
      bindings.preferredQuality
    ].forEach((select) => {
      select.addEventListener("change", () => {
        state.serverPreferences = {
          source:
            bindings.preferredSource.value,
          language:
            bindings.preferredLanguage.value,
          quality:
            bindings.preferredQuality.value
        };
        saveServerPreferences();
        renderServerPanel();
        toast("Server preferences saved.");
      });
    });

    bindings.usePreferences.addEventListener(
      "click",
      () => {
        const preferred =
          recommendedStream(state.streams);

        if (preferred) {
          selectStream(
            preferred,
            false,
            "preference"
          );
          setServerPanelOpen(false);
        }
      }
    );

    bindings.serverClose.addEventListener("click", () => {
      setServerPanelOpen(false);
    });
    bindings.serverBack.addEventListener("click", returnToDiscovery);
    bindings.sourceGroups.addEventListener("click", (event) => {
      const button = event.target.closest("[data-stream-key]");
      if (!button) return;
      const stream = state.streams.find(
        (candidate) => streamKey(candidate) === button.dataset.streamKey
      );
      if (stream) {
        selectStream(stream, false);

        if (
          window.matchMedia(
            "(max-width: 1100px)"
          ).matches
        ) {
          setServerPanelOpen(false);
        }
      }
    });

    form.addEventListener(
      "submit",
      (event) => {
        const token = watchTokenFromUrl(input.value);
        if (!token) {
          clearPlayerState();
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        urlError.textContent = "";
        handleStreamedUrl(input.value);
      },
      true
    );

    quickButton?.addEventListener("click", () => {
      if (!state.live.length && !state.today.length) {
        loadDiscovery(false);
      } else {
        showDiscovery();
      }
    });
    changeButton?.addEventListener("click", clearPlayerState);

    return bindings;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
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
    if (!normalized) return "Sport";
    return normalized
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function initials(value, maximum = 2) {
    const words = String(value ?? "")
      .replace(/\b(vs?\.?|at)\b/gi, " ")
      .replace(/[^a-zA-Z0-9 ]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return "EC";
    return words
      .slice(0, maximum)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }

  function normalizeTeam(team) {
    if (!team?.name) return null;
    return {
      key: slugify(team.name),
      name: String(team.name),
      badge: String(team.badge || "")
    };
  }

  function loadFavoriteTeams() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(FAVORITES_KEY) || "[]"
      );
      return Array.isArray(parsed)
        ? parsed.filter((team) => team?.name && team?.key)
        : [];
    } catch {
      return [];
    }
  }

  function saveFavoriteTeams() {
    try {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(state.favoriteTeams)
      );
    } catch {}
  }

  function loadContinueEvent() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(CONTINUE_KEY) ||
        "null"
      );

      if (
        !saved?.match?.id ||
        !Number.isFinite(
          Number(saved.watchedAt)
        ) ||
        Date.now() -
          Number(saved.watchedAt) >
          CONTINUE_MAX_AGE
      ) {
        localStorage.removeItem(CONTINUE_KEY);
        return null;
      }

      return saved;
    } catch {
      return null;
    }
  }

  function saveContinueEvent(match, stream) {
    if (!match?.id || !stream) return;

    const saved = {
      match: compactMatch(match),
      source: String(stream.source || ""),
      streamNo: stream.streamNo,
      watchedAt: Date.now()
    };

    state.continueEvent = saved;

    try {
      localStorage.setItem(
        CONTINUE_KEY,
        JSON.stringify(saved)
      );

      /*
        Streamed events have a richer continue card, so remove the
        older generic iframe-only history entry.
      */
      localStorage.removeItem(
        "eastcoinsLastWatch"
      );
    } catch {}

    document
      .querySelector(
        "[data-ec-continue-watch]"
      )
      ?.remove();

    rememberRecentEvent(match, stream);
    renderContinueWatching();
  }

  function clearContinueEvent() {
    state.continueEvent = null;

    try {
      localStorage.removeItem(CONTINUE_KEY);
    } catch {}

    renderContinueWatching();
    toast("Continue Watching cleared.");
  }

  function continueAgeText(timestamp) {
    const difference =
      Date.now() - Number(timestamp || 0);

    if (difference < 60_000) {
      return "Watched just now";
    }

    const minutes = Math.floor(
      difference / 60_000
    );

    if (minutes < 60) {
      return `Watched ${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    return hours < 24
      ? `Watched ${hours}h ago`
      : "Watched yesterday";
  }

  function loadRecentEvents() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(RECENT_KEY) ||
        "[]"
      );

      if (!Array.isArray(parsed)) {
        return [];
      }

      const cutoff =
        Date.now() - RECENT_MAX_AGE;

      return parsed
        .filter(
          (item) =>
            item?.match?.id &&
            Number(item.watchedAt) >= cutoff
        )
        .slice(0, RECENT_LIMIT);
    } catch {
      return [];
    }
  }

  function saveRecentEvents() {
    try {
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify(state.recentEvents)
      );
    } catch {}
  }

  function rememberRecentEvent(match, stream) {
    if (!match?.id || !stream) return;

    const id = eventKey(match);
    const entry = {
      match: compactMatch(match),
      source: String(stream.source || ""),
      streamNo: stream.streamNo,
      watchedAt: Date.now()
    };

    state.recentEvents = [
      entry,
      ...state.recentEvents.filter(
        (item) =>
          eventKey(item.match) !== id
      )
    ].slice(0, RECENT_LIMIT);

    saveRecentEvents();
    renderRecentlyWatched();
  }

  function clearRecentEvents() {
    state.recentEvents = [];

    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}

    renderRecentlyWatched();
    toast("Recently Watched cleared.");
  }

  function removeRecentEvent(id) {
    state.recentEvents =
      state.recentEvents.filter(
        (item) =>
          eventKey(item.match) !== id
      );

    saveRecentEvents();
    renderRecentlyWatched();
  }

  function loadServerPreferences() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(
          SERVER_PREFERENCES_KEY
        ) || "null"
      );

      return {
        source: String(
          parsed?.source || "auto"
        ).toLowerCase(),
        language: String(
          parsed?.language || "english"
        ).toLowerCase(),
        quality:
          parsed?.quality === "any"
            ? "any"
            : "hd"
      };
    } catch {
      return {
        source: "auto",
        language: "english",
        quality: "hd"
      };
    }
  }

  function saveServerPreferences() {
    try {
      localStorage.setItem(
        SERVER_PREFERENCES_KEY,
        JSON.stringify(
          state.serverPreferences
        )
      );
    } catch {}
  }

  function loadServerFeedback() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(
          SERVER_FEEDBACK_KEY
        ) || "{}"
      );

      return parsed &&
        typeof parsed === "object"
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  function saveServerFeedback() {
    try {
      localStorage.setItem(
        SERVER_FEEDBACK_KEY,
        JSON.stringify(state.serverFeedback)
      );
    } catch {}
  }

  function sourceFeedback(source) {
    const key = String(source || "")
      .toLowerCase();

    return state.serverFeedback[key] || {
      works: 0,
      broken: 0
    };
  }

  function recordServerFeedback(source, kind) {
    const key = String(source || "")
      .toLowerCase();

    if (!key) return;

    const current = sourceFeedback(key);
    state.serverFeedback[key] = {
      works:
        Number(current.works || 0) +
        (kind === "works" ? 1 : 0),
      broken:
        Number(current.broken || 0) +
        (kind === "broken" ? 1 : 0),
      updatedAt: Date.now()
    };

    saveServerFeedback();
  }

  function isFavoriteTeam(team) {
    const normalized = normalizeTeam(team);
    return normalized
      ? state.favoriteTeams.some((item) => item.key === normalized.key)
      : false;
  }

  function toggleFavoriteTeam(team) {
    const normalized = normalizeTeam(team);
    if (!normalized) return;

    const index = state.favoriteTeams.findIndex(
      (item) => item.key === normalized.key
    );

    if (index >= 0) {
      state.favoriteTeams.splice(index, 1);
      toast(`${normalized.name} removed from favorite teams.`);
    } else {
      state.favoriteTeams.push(normalized);
      state.favoriteTeams.sort((a, b) => a.name.localeCompare(b.name));
      toast(`${normalized.name} added to favorite teams.`);
    }

    saveFavoriteTeams();
    renderDiscovery();
    renderEventDetailForCurrentUrl();
  }

  function matchTeams(match) {
    return [match?.teams?.home, match?.teams?.away].filter(Boolean);
  }

  function matchHasFavorite(match) {
    return matchTeams(match).some(isFavoriteTeam);
  }

  function eventTimestamp(value) {
    let timestamp = Number(value);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return 0;
    }

    if (timestamp < 1_000_000_000_000) {
      timestamp *= 1000;
    }

    return timestamp;
  }

  function localDayKey(timestamp) {
    const date = new Date(
      eventTimestamp(timestamp)
    );

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(
        2,
        "0"
      ),
      String(date.getDate()).padStart(
        2,
        "0"
      )
    ].join("-");
  }

  function tomorrowDayKey() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1)
        .padStart(2, "0"),
      String(tomorrow.getDate())
        .padStart(2, "0")
    ].join("-");
  }

  function currentModeMatches() {
    if (state.mode === "today") {
      return state.today;
    }

    if (state.mode === "tomorrow") {
      return state.tomorrow;
    }

    return state.live;
  }

  function allPersonalizedMatches() {
    return dedupeMatches([
      ...state.live,
      ...state.today,
      ...state.tomorrow
    ]);
  }

  function formatDate(timestamp, includeDate = false) {
    const date = new Date(eventTimestamp(timestamp));
    if (Number.isNaN(date.getTime())) return "Time unavailable";
    return date.toLocaleString([], includeDate
      ? {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }
      : {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit"
        });
  }

  function countdownText(timestamp) {
    const difference = eventTimestamp(timestamp) - Date.now();
    if (!Number.isFinite(difference)) return "Time unavailable";
    if (difference <= 0) return "Live or starting now";

    const minutes = Math.ceil(difference / 60_000);
    if (minutes < 60) return `Starts in ${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours < 24) {
      return remainder ? `Starts in ${hours}h ${remainder}m` : `Starts in ${hours}h`;
    }

    const days = Math.floor(hours / 24);
    return `Starts in ${days}d ${hours % 24}h`;
  }

  function isLiveMatch(match) {
    return state.live.some((item) => item.id === match.id);
  }

  function eventKey(match) {
    return String(match?.id || slugify(match?.title));
  }

  function dedupeMatches(matches) {
    const map = new Map();
    matches.forEach((match) => {
      const key = eventKey(match);
      if (!key) return;
      const existing = map.get(key);
      if (!existing || (match.sources?.length || 0) > (existing.sources?.length || 0)) {
        map.set(key, match);
      }
    });
    return Array.from(map.values());
  }

  function sortedMatches(matches) {
    return [...matches].sort((left, right) => {
      const popular = Number(Boolean(right.popular)) -
        Number(Boolean(left.popular));
      if (popular) return popular;
      return eventTimestamp(left.date) - eventTimestamp(right.date);
    });
  }

  function personalizedMatches(matches) {
    const sorted = sortedMatches(matches);

    if (
      isEventsPage ||
      !state.favoriteTeams.length
    ) {
      return sorted;
    }

    return sorted.sort((left, right) => {
      const favoriteDifference =
        Number(matchHasFavorite(right)) -
        Number(matchHasFavorite(left));

      return favoriteDifference;
    });
  }

  function sportName(category) {
    const sport = state.sports.find(
      (item) => String(item.id) === String(category)
    );
    return sport?.name || sourceLabel(category);
  }

  function searchableText(match) {
    return [
      match.title,
      match.category,
      sportName(match.category),
      match.id,
      match.teams?.home?.name,
      match.teams?.away?.name,
      ...(Array.isArray(match.sources)
        ? match.sources.flatMap((source) => [source.source, source.id])
        : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function applyFilters(matches) {
    const query = state.query.trim().toLowerCase();
    return matches.filter((match) => {
      const sportMatches =
        state.selectedSport === "all" ||
        String(match.category) === state.selectedSport;
      const queryMatches = !query || searchableText(match).includes(query);
      return sportMatches && queryMatches;
    });
  }

  function badgeMarkup(team, size = "medium") {
    if (!team) return "";
    const url = API.badgeUrl(team.badge);
    return `
      <span class="ec-team-badge ec-team-badge-${size}">
        <span>${escapeHtml(initials(team.name))}</span>
        ${url ? `
          <img
            src="${escapeAttr(url)}"
            alt=""
            width="48"
            height="48"
            loading="lazy"
            decoding="async"
            data-ec-image>
        ` : ""}
      </span>
    `;
  }

  function posterMarkup(match, context = "card") {
    const suppliedPoster = API.posterUrl(match.poster);
    const matchupPoster = API.matchupPosterUrl(match);
    const poster = suppliedPoster || matchupPoster;
    const home = match?.teams?.home;
    const away = match?.teams?.away;

    return `
      <div class="ec-event-art ec-event-art-${context}">
        ${poster ? `
          <img
            class="ec-event-poster"
            src="${escapeAttr(poster)}"
            alt=""
            loading="lazy"
            decoding="async"
            data-ec-image>
        ` : ""}
        <div class="ec-event-art-shade"></div>
        <div class="ec-matchup-badges" aria-hidden="true">
          ${badgeMarkup(home, context === "hero" ? "large" : "medium")}
          ${home && away ? '<span class="ec-matchup-vs">VS</span>' : ""}
          ${badgeMarkup(away, context === "hero" ? "large" : "medium")}
          ${!home && !away ? `
            <span class="ec-event-initials">${escapeHtml(
              initials(match.category || match.title)
            )}</span>
          ` : ""}
        </div>
      </div>
    `;
  }

  function favoriteButton(team) {
    const normalized = normalizeTeam(team);
    if (!normalized) return "";
    const active = isFavoriteTeam(team);
    return `
      <button
        class="ec-team-favorite${active ? " active" : ""}"
        type="button"
        data-favorite-team
        data-team-name="${escapeAttr(normalized.name)}"
        data-team-badge="${escapeAttr(normalized.badge)}"
        aria-label="${active ? "Remove" : "Add"} ${escapeAttr(normalized.name)} ${active ? "from" : "to"} favorites"
        title="${active ? "Remove favorite team" : "Favorite this team"}">
        ${active ? "★" : "☆"}
      </button>
    `;
  }

  function teamLine(team) {
    if (!team) return "";
    return `
      <div class="ec-event-team-line">
        ${badgeMarkup(team, "small")}
        <span>${escapeHtml(team.name)}</span>
        ${favoriteButton(team)}
      </div>
    `;
  }

  function renderEventCard(match, variant = "standard") {
    const id = eventKey(match);
    const live = isLiveMatch(match);
    const sourceCount = Array.isArray(match.sources) ? match.sources.length : 0;
    const home = match?.teams?.home;
    const away = match?.teams?.away;
    const detailsUrl = `events.html?event=${encodeURIComponent(id)}`;

    return `
      <article
        class="ec-event-card ec-event-card-${variant}${live ? " is-live" : ""}${match.popular ? " is-popular" : ""}"
        data-event-id="${escapeAttr(id)}">
        ${posterMarkup(match, variant === "feature" ? "feature" : "card")}
        <div class="ec-event-card-body">
          <div class="ec-event-tags">
            ${live ? '<span class="ec-event-tag ec-event-tag-live">Live</span>' : `
              <span
                class="ec-event-tag ec-event-tag-countdown"
                data-countdown="${eventTimestamp(match.date)}">
                ${escapeHtml(countdownText(match.date))}
              </span>
            `}
            ${match.popular ? '<span class="ec-event-tag">Popular</span>' : ""}
            <span class="ec-event-tag">${escapeHtml(sportName(match.category))}</span>
          </div>
          <h3>${escapeHtml(match.title || id)}</h3>
          <div class="ec-event-teams">
            ${teamLine(home)}
            ${teamLine(away)}
          </div>
          <div class="ec-event-meta">
            <span>${escapeHtml(formatDate(match.date))}</span>
            <span>${sourceCount} source${sourceCount === 1 ? "" : "s"}</span>
          </div>
          <div class="ec-event-actions">
            <button
              class="ec-event-watch"
              type="button"
              data-watch-event="${escapeAttr(id)}">
              ${live ? "Watch now" : "Open event"}
            </button>
            <a class="ec-event-details" href="${escapeAttr(detailsUrl)}">
              Event page →
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function emptyState(message) {
    return `<div class="streamed-empty">${escapeHtml(message)}</div>`;
  }

  function relevantSports() {
    const current = currentModeMatches();
    const counts = new Map();

    current.forEach((match) => {
      const id = String(match.category || "");
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });

    const known = new Map(
      state.sports.map((sport) => [String(sport.id), sport.name])
    );

    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        count,
        name: known.get(id) || sourceLabel(id)
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  function renderSportTabs() {
    if (!elements.sportTabs) return;
    const sports = relevantSports();
    elements.sportTabs.innerHTML = [
      {
        id: "all",
        name: "All",
        count: currentModeMatches().length
      },
      ...sports
    ]
      .map((sport) => `
        <button
          class="streamed-sport-tab${state.selectedSport === sport.id ? " active" : ""}"
          type="button"
          data-sport="${escapeAttr(sport.id)}">
          <span>${escapeHtml(sport.name)}</span>
          <small>${sport.count}</small>
        </button>
      `)
      .join("");
  }

  function renderContinueWatching() {
    if (
      !elements.continueSection ||
      !elements.continueList
    ) {
      return;
    }

    const saved = state.continueEvent;

    if (!saved?.match?.id) {
      elements.continueSection.hidden = true;
      elements.continueList.innerHTML = "";
      return;
    }

    const match = saved.match;
    const id = eventKey(match);
    const source = sourceLabel(saved.source);

    elements.continueSection.hidden = false;
    elements.continueList.innerHTML = `
      <article class="ec-continue-event-card">
        ${posterMarkup(match, "continue")}
        <div class="ec-continue-event-copy">
          <span class="ec-continue-event-kicker">
            ${escapeHtml(
              continueAgeText(saved.watchedAt)
            )}
          </span>
          <h3>${escapeHtml(
            match.title || id
          )}</h3>
          <p>
            ${escapeHtml(source)}
            ${saved.streamNo != null
              ? ` · Stream ${escapeHtml(saved.streamNo)}`
              : ""}
          </p>
        </div>
        <div class="ec-continue-event-actions">
          <button
            class="ec-event-watch"
            type="button"
            data-continue-event>
            Resume
          </button>
          <a
            class="ec-event-details"
            href="events.html?event=${encodeURIComponent(id)}">
            Event page
          </a>
          <button
            class="ec-continue-clear"
            type="button"
            data-clear-continue>
            Clear
          </button>
        </div>
      </article>
    `;
  }

  function renderRecentlyWatched() {
    if (
      !elements.recentSection ||
      !elements.recentList
    ) {
      return;
    }

    if (!state.recentEvents.length) {
      elements.recentSection.hidden = true;
      elements.recentList.innerHTML = "";
      return;
    }

    elements.recentSection.hidden = false;
    elements.recentList.innerHTML = `
      <div class="ec-recent-heading-actions">
        <button
          class="ec-recent-clear-all"
          type="button"
          data-clear-recent>
          Clear history
        </button>
      </div>
      <div class="ec-recent-event-row">
        ${state.recentEvents
          .map((saved) => {
            const match = saved.match;
            const id = eventKey(match);

            return `
              <article class="ec-recent-event-card">
                ${posterMarkup(match, "recent")}
                <div class="ec-recent-event-body">
                  <span>
                    ${escapeHtml(
                      continueAgeText(
                        saved.watchedAt
                      )
                    )}
                  </span>
                  <h3>
                    ${escapeHtml(
                      match.title || id
                    )}
                  </h3>
                  <p>
                    ${escapeHtml(
                      sourceLabel(saved.source)
                    )}
                    ${saved.streamNo != null
                      ? ` · Stream ${escapeHtml(saved.streamNo)}`
                      : ""}
                  </p>
                  <div>
                    <button
                      class="ec-event-watch"
                      type="button"
                      data-recent-event="${escapeAttr(id)}"
                      data-recent-source="${escapeAttr(saved.source)}"
                      data-recent-stream="${escapeAttr(saved.streamNo ?? "")}">
                      Watch again
                    </button>
                    <button
                      class="ec-recent-remove"
                      type="button"
                      data-remove-recent="${escapeAttr(id)}"
                      aria-label="Remove ${escapeAttr(match.title || id)} from history">
                      ×
                    </button>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function yourNightMatches() {
    const now = Date.now();
    const horizon =
      now + 12 * 60 * 60 * 1000;

    const candidates = dedupeMatches([
      ...state.live,
      ...state.today.filter((match) => {
        const time = eventTimestamp(match.date);
        return time >= now && time <= horizon;
      })
    ]);

    return candidates
      .sort((left, right) => {
        const liveDifference =
          Number(isLiveMatch(right)) -
          Number(isLiveMatch(left));

        if (liveDifference) {
          return liveDifference;
        }

        return (
          eventTimestamp(left.date) -
          eventTimestamp(right.date)
        );
      })
      .slice(0, 8);
  }

  function renderYourNight() {
    if (
      !elements.nightSection ||
      !elements.nightList
    ) {
      return;
    }

    const matches = yourNightMatches();

    if (!matches.length) {
      elements.nightSection.hidden = true;
      elements.nightList.innerHTML = "";
      return;
    }

    elements.nightSection.hidden = false;
    elements.nightList.innerHTML = matches
      .map((match) => {
        const id = eventKey(match);
        const live = isLiveMatch(match);
        const favorite =
          matchHasFavorite(match);

        return `
          <button
            class="ec-night-event${favorite ? " is-favorite" : ""}"
            type="button"
            data-watch-event="${escapeAttr(id)}">
            <span class="ec-night-time">
              ${live
                ? "LIVE"
                : escapeHtml(
                    new Date(
                      eventTimestamp(match.date)
                    ).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit"
                    })
                  )}
            </span>
            <span class="ec-night-line" aria-hidden="true"></span>
            <span class="ec-night-art">
              ${badgeMarkup(
                match?.teams?.home,
                "tiny"
              )}
              ${badgeMarkup(
                match?.teams?.away,
                "tiny"
              )}
            </span>
            <span class="ec-night-copy">
              <strong>
                ${escapeHtml(
                  match.title || id
                )}
              </strong>
              <small>
                ${favorite
                  ? "★ Favorite team"
                  : escapeHtml(
                      sportName(
                        match.category
                      )
                    )}
              </small>
            </span>
          </button>
        `;
      })
      .join("");
  }

  function renderPopularLive() {
    if (!elements.popularList || !elements.popularSection) return;

    const filteredLive = applyFilters(sortedMatches(state.live));
    const markedPopular = filteredLive.filter((match) => match.popular);
    const remaining = filteredLive.filter((match) => !match.popular);
    const popular = [...markedPopular, ...remaining].slice(0, 6);

    elements.popularList.innerHTML = popular.length
      ? popular.map((match) => renderEventCard(match, "feature")).join("")
      : emptyState("Nothing is live right now. Check Today for upcoming events.");
  }

  function renderStartingSoon() {
    if (!elements.soonList || !elements.soonSection) return;

    const now = Date.now();
    const future = applyFilters(
      personalizedMatches(
        state.today.filter(
          (match) =>
            eventTimestamp(match.date) > now
        )
      )
    ).slice(0, 6);

    elements.soonList.innerHTML = future.length
      ? future.map((match) => renderEventCard(match, "compact")).join("")
      : emptyState("No upcoming events are listed for later today.");
  }

  function suggestedTeams() {
    const unique = new Map();

    sortedMatches(allPersonalizedMatches())
      .forEach((match) => {
        matchTeams(match).forEach((team) => {
          const normalized = normalizeTeam(team);
          if (!normalized || unique.has(normalized.key)) return;
          unique.set(normalized.key, normalized);
        });
      });

    return Array.from(unique.values()).slice(0, 12);
  }

  function renderFavoriteTeams() {
    if (
      !elements.favoriteSection ||
      !elements.favoriteTeamList ||
      !elements.favoriteEventList
    ) {
      return;
    }

    const personalized =
      !isEventsPage &&
      state.favoriteTeams.length > 0;

    elements.favoriteSection.classList.toggle(
      "is-personalized",
      personalized
    );

    if (elements.favoriteHeading) {
      elements.favoriteHeading.textContent =
        personalized
          ? "For You"
          : "Favorite Teams";
    }

    if (elements.favoriteCopy) {
      elements.favoriteCopy.textContent =
        personalized
          ? `Live and upcoming events for ` +
            `${state.favoriteTeams
              .slice(0, 3)
              .map((team) => team.name)
              .join(", ")}.`
          : "Follow teams and see their available events in one place.";
    }

    if (!state.favoriteTeams.length) {
      const suggestions = suggestedTeams();
      elements.favoriteTeamList.innerHTML = suggestions.length
        ? `
          <span class="ec-favorite-empty-copy">
            Pick a team to follow:
          </span>
          ${suggestions.map((team) => `
            <button
              class="ec-favorite-team-chip ec-favorite-team-suggestion"
              type="button"
              data-add-favorite
              data-team-name="${escapeAttr(team.name)}"
              data-team-badge="${escapeAttr(team.badge)}">
              ${team.badge ? badgeMarkup(team, "tiny") : ""}
              <span>${escapeHtml(team.name)}</span>
              <span aria-hidden="true">＋</span>
            </button>
          `).join("")}
        `
        : `
          <span class="ec-favorite-empty-copy">
            Favorite teams will appear here once event listings include teams.
          </span>
        `;
      elements.favoriteEventList.innerHTML = emptyState(
        "Choose a team above to collect its available events here."
      );
      return;
    }

    elements.favoriteTeamList.innerHTML = state.favoriteTeams
      .map((team) => `
        <button
          class="ec-favorite-team-chip"
          type="button"
          data-remove-favorite="${escapeAttr(team.key)}">
          ${team.badge ? badgeMarkup(team, "tiny") : ""}
          <span>${escapeHtml(team.name)}</span>
          <span aria-hidden="true">×</span>
        </button>
      `)
      .join("");

    const matches = applyFilters(
      personalizedMatches(
        allPersonalizedMatches()
      ).filter(matchHasFavorite)
    ).slice(0, 10);

    elements.favoriteEventList.innerHTML = matches.length
      ? matches.map((match) => renderEventCard(match, "compact")).join("")
      : emptyState("There are no listed events for your favorite teams right now.");
  }

  function renderMainList() {
    if (!elements.matchList) return;

    const source = currentModeMatches();
    const matches = applyFilters(
      personalizedMatches(source)
    ).slice(
      0,
      isEventsPage ? 120 : 60
    );

    if (elements.listSectionTitle) {
      elements.listSectionTitle.textContent =
        state.mode === "today"
          ? "Today’s events"
          : state.mode === "tomorrow"
            ? "Tomorrow’s events"
            : "All live events";
    }

    elements.matchList.innerHTML = matches.length
      ? matches
          .map((match) =>
            renderEventCard(match, "standard")
          )
          .join("")
      : emptyState(
          state.mode === "live"
            ? "Nothing is live right now. Switch to Today to browse upcoming events."
            : state.mode === "tomorrow"
              ? "No events are currently listed for tomorrow."
              : "No events match the current filters."
        );
  }

  function renderDiscovery() {
    renderSportTabs();
    renderContinueWatching();
    renderRecentlyWatched();
    renderYourNight();
    renderPopularLive();
    renderFavoriteTeams();
    renderStartingSoon();
    renderMainList();
    updateCountdowns();
  }

  function updateCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach((element) => {
      element.textContent = countdownText(Number(element.dataset.countdown));
    });
  }

  function setStatus(message, error = false) {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.classList.toggle("error", error);
  }

  function freshnessMessage(discovery) {
    const saved = Math.max(
      Number(discovery.live.savedAt || 0),
      Number(discovery.today.savedAt || 0)
    );
    const stale = discovery.live.stale || discovery.today.stale;
    state.updatedAt = saved;
    state.stale = stale;
    const time = saved
      ? new Date(saved).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit"
        })
      : "just now";

    if (stale) {
      return `Showing the most recent event list we could load (${time}).`;
    }

    if (discovery.warnings?.length) {
      return `Events updated ${time}. Some sport labels may be simplified.`;
    }

    return `Events updated ${time}.`;
  }

  async function loadDiscovery(forceMatches = false) {
    elements.browser.hidden = false;
    setStatus(forceMatches ? "Refreshing events…" : "Loading events…");

    try {
      const discovery = await API.getDiscovery({ forceMatches });
      state.live = dedupeMatches(discovery.live.data);
      state.today = dedupeMatches(discovery.today.data);
      state.sports = discovery.sports.data;

      if (!state.live.length && state.today.length) {
        state.mode = "today";
      }

      updateModeButtons();

      expandDiscoveryLayout();
      renderDiscovery();
      setStatus(freshnessMessage(discovery));
      await renderEventDetailForCurrentUrl();
      await restoreRequestedPlayerEvent();
    } catch (error) {
      setStatus(error.message || "Unable to load Streamed events.", true);
      elements.matchList.innerHTML = emptyState(
        "Events could not be loaded right now. Try Refresh in a moment."
      );
    }
  }

  function expandDiscoveryLayout() {
    elements.launcher
      ?.closest(".url-card")
      ?.classList.add("streamed-directory-open");
  }

  function showDiscovery() {
    elements.browser.hidden = false;
    expandDiscoveryLayout();
    elements.launcher?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateModeButtons() {
    elements.liveButton?.classList.toggle(
      "active",
      state.mode === "live"
    );
    elements.todayButton?.classList.toggle(
      "active",
      state.mode === "today"
    );
    elements.tomorrowButton?.classList.toggle(
      "active",
      state.mode === "tomorrow"
    );
    if (elements.tomorrowButton) {
      elements.tomorrowButton.disabled =
        state.tomorrowLoading;
    }
  }

  async function loadTomorrow(force = false) {
    if (state.tomorrowLoading) return;

    state.tomorrowLoading = true;
    updateModeButtons();
    setStatus("Loading tomorrow’s events…");

    try {
      const all = await API.getAll(force);
      const key = tomorrowDayKey();

      state.tomorrow = dedupeMatches(
        all.data.filter(
          (match) =>
            localDayKey(match.date) === key
        )
      );
      state.tomorrowLoaded = true;
      renderDiscovery();
      setStatus(
        state.tomorrow.length
          ? "Tomorrow’s schedule is ready."
          : "No events are currently listed for tomorrow."
      );
    } catch (error) {
      setStatus(
        error.message ||
          "Tomorrow’s events could not be loaded.",
        true
      );
    } finally {
      state.tomorrowLoading = false;
      updateModeButtons();
    }
  }

  async function setMode(mode) {
    state.mode = ["today", "tomorrow"].includes(
      mode
    )
      ? mode
      : "live";
    state.selectedSport = "all";
    updateModeButtons();

    if (
      state.mode === "tomorrow" &&
      !state.tomorrowLoaded
    ) {
      await loadTomorrow(false);
      return;
    }

    renderDiscovery();
  }

  function findLoadedMatch(id) {
    const normalized = String(id || "").toLowerCase();
    return dedupeMatches([...state.live, ...state.today]).find((match) => {
      return eventKey(match).toLowerCase() === normalized ||
        slugify(match.title) === normalized;
    }) || null;
  }

  function rememberSelectedMatch(match) {
    try {
      sessionStorage.setItem(SELECTED_MATCH_KEY, JSON.stringify(match));
    } catch {}
  }

  function readSelectedMatch(id) {
    try {
      const match = JSON.parse(sessionStorage.getItem(SELECTED_MATCH_KEY) || "null");
      return match && eventKey(match) === String(id) ? match : null;
    } catch {
      return null;
    }
  }

  async function resolveMatch(id, allowAllFallback = false) {
    const loaded = findLoadedMatch(id) || readSelectedMatch(id);
    if (loaded) return loaded;

    if (!allowAllFallback) return null;
    const all = await API.getAll(false);
    return all.data.find((match) =>
      eventKey(match) === String(id) || slugify(match.title) === String(id)
    ) || null;
  }

  function eventDetailMarkup(match) {
    const live = isLiveMatch(match);
    const home = match?.teams?.home;
    const away = match?.teams?.away;
    const sourceCount = Array.isArray(match.sources) ? match.sources.length : 0;

    return `
      <article class="ec-event-detail-card">
        ${posterMarkup(match, "hero")}
        <div class="ec-event-detail-body">
          <div class="ec-event-tags">
            ${live ? '<span class="ec-event-tag ec-event-tag-live">Live now</span>' : `
              <span class="ec-event-tag" data-countdown="${eventTimestamp(match.date)}">
                ${escapeHtml(countdownText(match.date))}
              </span>
            `}
            ${match.popular ? '<span class="ec-event-tag">Popular</span>' : ""}
            <span class="ec-event-tag">${escapeHtml(sportName(match.category))}</span>
          </div>
          <h1>${escapeHtml(match.title || eventKey(match))}</h1>
          <p class="ec-event-detail-time">${escapeHtml(formatDate(match.date, true))}</p>
          <div class="ec-event-detail-teams">
            ${home ? `
              <div class="ec-event-detail-team">
                ${badgeMarkup(home, "large")}
                <strong>${escapeHtml(home.name)}</strong>
                ${favoriteButton(home)}
              </div>
            ` : ""}
            ${home && away ? '<span class="ec-event-detail-vs">VS</span>' : ""}
            ${away ? `
              <div class="ec-event-detail-team">
                ${badgeMarkup(away, "large")}
                <strong>${escapeHtml(away.name)}</strong>
                ${favoriteButton(away)}
              </div>
            ` : ""}
          </div>
          <p class="ec-event-detail-summary">
            ${sourceCount} viewing option${sourceCount === 1 ? "" : "s"} available for this event.
          </p>
          <div class="ec-event-detail-actions">
            <button
              class="ec-event-watch ec-event-watch-large"
              type="button"
              data-watch-event="${escapeAttr(eventKey(match))}">
              ${live ? "Watch event now" : "Open event in player"}
            </button>
            <a class="ec-event-details" href="events.html">← All events</a>
          </div>
        </div>
      </article>
    `;
  }

  async function renderEventDetailForCurrentUrl() {
    if (!isEventsPage || !elements.detail) return;
    const id = new URLSearchParams(location.search).get("event");
    if (!id) {
      elements.detail.innerHTML = "";
      return;
    }

    elements.detail.innerHTML = emptyState("Loading event page…");
    try {
      const match = await resolveMatch(id, true);
      elements.detail.innerHTML = match
        ? eventDetailMarkup(match)
        : emptyState("This event is no longer available in the current listings.");
      updateCountdowns();
      elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      elements.detail.innerHTML = emptyState(
        error.message || "Unable to load this event page."
      );
    }
  }

  function teamFromButton(button) {
    return {
      name: button.dataset.teamName || "",
      badge: button.dataset.teamBadge || ""
    };
  }

  function handleDiscoveryClick(event) {
    const clearRecent =
      event.target.closest(
        "[data-clear-recent]"
      );

    if (clearRecent) {
      event.preventDefault();
      clearRecentEvents();
      return;
    }

    const removeRecent =
      event.target.closest(
        "[data-remove-recent]"
      );

    if (removeRecent) {
      event.preventDefault();
      removeRecentEvent(
        removeRecent.dataset.removeRecent
      );
      return;
    }

    const recent =
      event.target.closest(
        "[data-recent-event]"
      );

    if (recent) {
      event.preventDefault();

      const saved =
        state.recentEvents.find(
          (item) =>
            eventKey(item.match) ===
            recent.dataset.recentEvent
        );

      if (saved) {
        watchMatch(
          saved.match,
          recent.dataset.recentSource || "",
          recent.dataset.recentStream || ""
        );
      }
      return;
    }

    const clearContinue =
      event.target.closest(
        "[data-clear-continue]"
      );

    if (clearContinue) {
      event.preventDefault();
      clearContinueEvent();
      return;
    }

    const resume =
      event.target.closest(
        "[data-continue-event]"
      );

    if (resume && state.continueEvent?.match) {
      event.preventDefault();
      watchMatch(
        state.continueEvent.match,
        state.continueEvent.source || "",
        state.continueEvent.streamNo ?? ""
      );
      return;
    }

    const addFavorite = event.target.closest("[data-add-favorite]");
    if (addFavorite) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavoriteTeam(teamFromButton(addFavorite));
      return;
    }

    const favorite = event.target.closest("[data-favorite-team]");
    if (favorite) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavoriteTeam(teamFromButton(favorite));
      return;
    }

    const remove = event.target.closest("[data-remove-favorite]");
    if (remove) {
      const team = state.favoriteTeams.find(
        (item) => item.key === remove.dataset.removeFavorite
      );
      if (team) toggleFavoriteTeam(team);
      return;
    }

    const watch = event.target.closest("[data-watch-event]");
    if (watch) {
      const match = findLoadedMatch(watch.dataset.watchEvent) ||
        readSelectedMatch(watch.dataset.watchEvent);
      if (!match) return;
      watchMatch(match);
    }
  }

  async function watchMatch(
    match,
    preferredSource = "",
    preferredNo = ""
  ) {
    rememberSelectedMatch(match);

    if (!player) {
      const destination = new URL(
        "index.html",
        window.location.href
      );

      destination.searchParams.set(
        "event",
        eventKey(match)
      );

      if (preferredSource) {
        destination.searchParams.set(
          "source",
          preferredSource
        );
      }

      if (
        preferredNo !== "" &&
        preferredNo != null
      ) {
        destination.searchParams.set(
          "stream",
          preferredNo
        );
      }

      location.href = destination.href;
      return;
    }

    await loadMatch(
      match,
      preferredSource,
      preferredNo
    );
  }

  function toast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }

  function encodeBase64Url(value) {
    const bytes = new TextEncoder().encode(String(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeBase64Url(value) {
    const normalized = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padding = normalized.length % 4 === 0
      ? ""
      : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + padding);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function compactMatch(match) {
    return {
      id: match.id || "",
      title: match.title || "",
      category: match.category || "",
      date: eventTimestamp(match.date),
      poster: match.poster || "",
      popular: Boolean(match.popular),
      teams: match.teams || null,
      sources: Array.isArray(match.sources)
        ? match.sources
            .filter((source) => source?.source && source?.id)
            .map((source) => ({
              source: String(source.source),
              id: String(source.id)
            }))
        : []
    };
  }

  function createRoomToken(match, stream) {
    if (!match || !stream) return "";
    return encodeBase64Url(JSON.stringify({
      version: 1,
      match: compactMatch(match),
      source: stream.source || "",
      streamNo: stream.streamNo
    }));
  }

  function parseRoomToken(token) {
    if (!token) return null;
    try {
      const parsed = JSON.parse(decodeBase64Url(token));
      return Number(parsed?.version) === 1 && parsed?.match?.id
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  function isEnglish(stream) {
    return String(stream.language || "").toLowerCase().startsWith("english");
  }

  function streamPreferenceScore(stream) {
    const preferences =
      state.serverPreferences;
    const source = String(
      stream.source || ""
    ).toLowerCase();
    const language = String(
      stream.language || ""
    ).toLowerCase();
    const feedback =
      sourceFeedback(source);

    let score = 0;

    if (
      preferences.source !== "auto" &&
      source === preferences.source
    ) {
      score += 120;
    }

    if (
      preferences.language !== "any" &&
      language.startsWith(
        preferences.language
      )
    ) {
      score += 45;
    } else if (
      preferences.language === "any" &&
      isEnglish(stream)
    ) {
      score += 8;
    }

    if (
      preferences.quality === "hd" &&
      stream.hd
    ) {
      score += 24;
    }

    score +=
      Math.max(
        -6,
        Math.min(
          8,
          Number(feedback.works || 0) -
          Number(feedback.broken || 0)
        )
      ) * 4;

    score -= Number(stream.sourceOrder || 0);
    score -= Number(stream.streamNo || 0) / 100;

    return score;
  }

  function recommendedStream(streams) {
    return [...streams]
      .sort(
        (left, right) =>
          streamPreferenceScore(right) -
          streamPreferenceScore(left)
      )[0] || null;
  }

  function preferredStream(streams, source, number) {
    return streams.find((stream) => {
      const sourceMatches = !source ||
        String(stream.source).toLowerCase() === String(source).toLowerCase();
      const numberMatches = number === "" || number == null ||
        String(stream.streamNo) === String(number);
      return sourceMatches && numberMatches;
    }) || null;
  }

  function streamKey(stream) {
    return [stream.source, stream.streamNo, stream.embedUrl].join("|");
  }

  function setConnectionStatus(
    mode,
    label
  ) {
    state.connectionMode = mode;

    if (!player) return;

    player.connectionStatus.hidden =
      mode === "idle";

    player.connectionStatus.className =
      `streamed-connection-status ${mode}`;

    player.connectionLabel.textContent =
      label || "Waiting";
  }

  function reportCurrentStream(kind) {
    const stream = state.activeStream;

    if (!stream) {
      toast("No active stream to rate.");
      return;
    }

    recordServerFeedback(
      stream.source,
      kind
    );

    if (kind === "works") {
      state.failedStreamKeys.delete(
        streamKey(stream)
      );
      setConnectionStatus(
        "connected",
        "Working"
      );
      renderServerPanel();
      toast(
        `${sourceLabel(stream.source)} marked as working.`
      );
      return;
    }

    setConnectionStatus(
      "switching",
      "Finding another server"
    );
    toast(
      `${sourceLabel(stream.source)} marked as broken.`
    );

    if (!selectNextStream("reported")) {
      setConnectionStatus(
        "attention",
        "Choose another server"
      );
    }
  }

  function renderServerPreferences() {
    if (!player) return;

    const sources = Array.from(
      new Set(
        state.streams
          .map((stream) =>
            String(stream.source || "")
              .toLowerCase()
          )
          .filter(Boolean)
      )
    );

    const languages = Array.from(
      new Set(
        state.streams
          .map((stream) =>
            String(stream.language || "")
              .trim()
          )
          .filter(Boolean)
      )
    );

    player.preferredSource.innerHTML = [
      '<option value="auto">Auto</option>',
      ...sources.map(
        (source) =>
          `<option value="${escapeAttr(source)}">` +
          `${escapeHtml(sourceLabel(source))}` +
          `</option>`
      )
    ].join("");

    player.preferredLanguage.innerHTML = [
      '<option value="any">Any</option>',
      ...languages.map(
        (language) =>
          `<option value="${escapeAttr(language.toLowerCase())}">` +
          `${escapeHtml(language)}` +
          `</option>`
      )
    ].join("");

    player.preferredSource.value =
      sources.includes(
        state.serverPreferences.source
      )
        ? state.serverPreferences.source
        : "auto";

    const preferredLanguage =
      state.serverPreferences.language;

    if (
      preferredLanguage !== "any" &&
      !Array.from(
        player.preferredLanguage.options
      ).some(
        (option) =>
          option.value === preferredLanguage
      )
    ) {
      const option =
        document.createElement("option");
      option.value = preferredLanguage;
      option.textContent =
        sourceLabel(preferredLanguage);
      player.preferredLanguage.append(option);
    }

    player.preferredLanguage.value =
      preferredLanguage;
    player.preferredQuality.value =
      state.serverPreferences.quality;
  }

  function setGameBreakOpen(open) {
    if (!player) return;

    state.gameBreakOpen = Boolean(open);

    if (state.gameBreakOpen) {
      setServerPanelOpen(false);
    }

    player.gameBreakPanel.hidden =
      !state.gameBreakOpen;

    player.playerShell.classList.toggle(
      "streamed-game-break-open",
      state.gameBreakOpen
    );

    player.gameBreakButton.classList.toggle(
      "active",
      state.gameBreakOpen
    );
  }

  function clearRecoveryTimer() {
    if (state.recoveryTimer) {
      window.clearTimeout(
        state.recoveryTimer
      );
      state.recoveryTimer = null;
    }
  }

  function nextStreamCandidate() {
    if (
      !state.streams.length ||
      !state.activeStream
    ) {
      return null;
    }

    const activeKey =
      streamKey(state.activeStream);
    const activeIndex =
      state.streams.findIndex(
        (stream) =>
          streamKey(stream) === activeKey
      );

    const rotated = [
      ...state.streams.slice(activeIndex + 1),
      ...state.streams.slice(0, activeIndex)
    ];

    return (
      rotated.find(
        (stream) =>
          !state.failedStreamKeys.has(
            streamKey(stream)
          )
      ) ||
      rotated[0] ||
      null
    );
  }

  function selectNextStream(
    reason = "manual"
  ) {
    if (
      !state.activeStream ||
      state.streams.length < 2
    ) {
      toast("No alternate server is available.");
      return false;
    }

    state.failedStreamKeys.add(
      streamKey(state.activeStream)
    );

    let next = nextStreamCandidate();

    if (!next) {
      state.failedStreamKeys.clear();
      next = nextStreamCandidate();
    }

    if (!next) {
      toast("No alternate server is available.");
      return false;
    }

    setConnectionStatus(
      "switching",
      "Switching servers"
    );

    if (reason === "automatic") {
      state.automaticRecoveryAttempts += 1;
      toast(
        `That server did not load. Trying ` +
        `${sourceLabel(next.source)} ` +
        `Stream ${next.streamNo}…`
      );
    } else {
      state.automaticRecoveryAttempts = 0;
      toast(
        `Trying ${sourceLabel(next.source)} ` +
        `Stream ${next.streamNo}…`
      );
    }

    selectStream(
      next,
      false,
      reason
    );

    return true;
  }

  function armAutomaticRecovery(stream) {
    clearRecoveryTimer();

    if (
      !stream ||
      state.streams.length < 2
    ) {
      return;
    }

    const serial =
      ++state.recoverySerial;
    const frame =
      document.getElementById("activeFrame");

    if (!frame) return;

    let settled = false;

    const markLoaded = () => {
      if (
        settled ||
        serial !== state.recoverySerial
      ) {
        return;
      }

      settled = true;
      clearRecoveryTimer();
      setConnectionStatus(
        "connected",
        "Player loaded"
      );
    };

    const recover = () => {
      if (
        settled ||
        serial !== state.recoverySerial
      ) {
        return;
      }

      settled = true;
      clearRecoveryTimer();

      if (
        state.automaticRecoveryAttempts >=
        AUTO_RECOVERY_LIMIT
      ) {
        setConnectionStatus(
          "attention",
          "Needs another server"
        );
        setStatus(
          "The player is taking longer than expected. Try Next Server or open Server Selector.",
          true
        );
        return;
      }

      selectNextStream("automatic");
    };

    frame.addEventListener(
      "load",
      markLoaded,
      { once: true }
    );

    frame.addEventListener(
      "error",
      recover,
      { once: true }
    );

    state.recoveryTimer =
      window.setTimeout(
        recover,
        AUTO_RECOVERY_TIMEOUT
      );
  }

  function showShortcutHintOnce() {
    if (
      state.shortcutHintScheduled ||
      !player
    ) {
      return;
    }

    try {
      if (
        localStorage.getItem(
          SHORTCUT_HINT_KEY
        ) === "true"
      ) {
        return;
      }

      localStorage.setItem(
        SHORTCUT_HINT_KEY,
        "true"
      );
    } catch {}

    state.shortcutHintScheduled = true;

    window.setTimeout(() => {
      toast(
        "Quick keys: S servers · N next · G games · T theater · C chat · M menu"
      );
    }, 1200);
  }

  function groupStreams(streams) {
    const groups = new Map();
    streams.forEach((stream) => {
      const key = String(stream.source || "unknown");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(stream);
    });
    return groups;
  }

  function selectedArtwork(match) {
    return `
      <span class="streamed-team-pair">
        ${badgeMarkup(match?.teams?.home, "small")}
        ${badgeMarkup(match?.teams?.away, "small")}
      </span>
    `;
  }

  function updateRoomHeader() {
    if (!player) return;

    const match = state.currentMatch;
    const stream = state.activeStream;

    if (!match || !stream) {
      player.playerToolbar.classList.remove(
        "streamed-room-toolbar"
      );
      player.toolbarKicker.hidden = true;
      player.toolbarHeading.textContent =
        "Embedded Stream";
      player.currentHost.textContent =
        "External provider";
      player.nextServerButton.hidden = true;
      player.feedbackGroup.hidden = true;
      player.gameBreakButton.hidden = true;
      setConnectionStatus("idle", "");
      return;
    }

    const live = isLiveMatch(match);

    player.playerToolbar.classList.add(
      "streamed-room-toolbar"
    );
    player.toolbarKicker.hidden = false;
    player.toolbarKicker.textContent =
      live ? "Live event" : "Event room";
    player.toolbarHeading.textContent =
      match.title || "EastCoin event";
    player.currentHost.textContent = [
      live
        ? "Live now"
        : formatDate(match.date, true),
      `${sourceLabel(stream.source)} ` +
        `Stream ${stream.streamNo}`,
      stream.hd ? "HD" : "SD",
      stream.language || ""
    ].filter(Boolean).join(" · ");

    player.nextServerButton.hidden =
      state.streams.length < 2;
    player.feedbackGroup.hidden = false;

    /*
      Game Break now lives in the centered utility dock as a
      same-page playable overlay.
    */
    player.gameBreakButton.hidden = true;
  }

  function renderServerPanel() {
    if (!player) return;
    const groups = groupStreams(state.streams);
    const recommended = recommendedStream(state.streams);
    const recommendedKey = recommended ? streamKey(recommended) : "";

    player.serverMatch.textContent = state.currentMatch?.title || "Streamed event";
    const artwork = selectedArtwork(state.currentMatch);
    player.serverArtwork.innerHTML = artwork;
    player.toolbarArtwork.innerHTML = artwork;
    player.toolbarArtwork.hidden = !artwork;
    player.toolbarTitle.classList.toggle("streamed-has-artwork", Boolean(artwork));

    player.sourceGroups.innerHTML = Array.from(groups)
      .map(([source, streams]) => `
        <section class="streamed-source-group">
          <div class="streamed-source-title">
            <strong>${escapeHtml(sourceLabel(source))}</strong>
            <span>${streams.length} stream${streams.length === 1 ? "" : "s"}</span>
          </div>
          <div class="streamed-stream-buttons">
            ${streams.map((stream) => {
              const active = state.activeStream &&
                streamKey(stream) === streamKey(state.activeStream);
              const recommendedFlag =
                streamKey(stream) ===
                recommendedKey;
              const failed =
                state.failedStreamKeys.has(
                  streamKey(stream)
                );
              return `
                <button
                  class="streamed-stream-button${active ? " active" : ""}${failed ? " failed" : ""}"
                  type="button"
                  data-stream-key="${escapeAttr(streamKey(stream))}">
                  <span class="streamed-quality">${stream.hd ? "HD" : "SD"}</span>
                  <span>Stream ${escapeHtml(stream.streamNo)}</span>
                  <span>${escapeHtml(stream.language || "Unknown")}</span>
                  ${failed
                    ? '<span class="streamed-failed-label">Skipped</span>'
                    : recommendedFlag
                      ? '<span class="streamed-recommended">Recommended</span>'
                      : ""}
                </button>
              `;
            }).join("")}
          </div>
        </section>
      `)
      .join("");

    player.serverButton.hidden = false;
    player.serverButton.textContent = "Server Selector";
    player.serverButton.setAttribute(
      "aria-label",
      `Server Selector, ${state.streams.length} ` +
      `available stream${state.streams.length === 1 ? "" : "s"}`
    );

    renderServerPreferences();
    updateRoomHeader();
  }

  function updateShareState() {
    if (!state.currentMatch || !state.activeStream) {
      window.eastcoinStreamedState = null;
      return;
    }

    const match = state.currentMatch;
    const stream = state.activeStream;
    const home = match?.teams?.home || null;
    const away = match?.teams?.away || null;

    window.eastcoinStreamedState = {
      matchId: match.id,
      title: match.title,
      source: stream.source,
      sourceLabel: sourceLabel(stream.source),
      streamNo: stream.streamNo,
      quality: stream.hd ? "HD" : "SD",
      language: stream.language || "",
      embedUrl: stream.embedUrl,
      roomToken: createRoomToken(match, stream),
      event: {
        title: match.title || "",
        category: sportName(match.category),
        date: eventTimestamp(match.date),
        live: isLiveMatch(match),
        posterUrl:
          API.posterUrl(match.poster) ||
          API.matchupPosterUrl(match) ||
          "",
        home: home
          ? {
              name: home.name || "",
              badgeUrl:
                API.badgeUrl(home.badge) || ""
            }
          : null,
        away: away
          ? {
              name: away.name || "",
              badgeUrl:
                API.badgeUrl(away.badge) || ""
            }
          : null
      }
    };
  }

  function setServerPanelOpen(open) {
    if (!player) return;

    state.serverPanelOpen = Boolean(open);

    if (
      state.serverPanelOpen &&
      state.gameBreakOpen
    ) {
      setGameBreakOpen(false);
    }

    player.serverPanel.hidden =
      !state.serverPanelOpen;

    player.playerShell.classList.toggle(
      "streamed-server-open",
      state.serverPanelOpen
    );

    player.serverButton.classList.toggle(
      "active",
      state.serverPanelOpen
    );

    player.serverButton.setAttribute(
      "aria-expanded",
      String(state.serverPanelOpen)
    );

    player.serverPanel.setAttribute(
      "aria-hidden",
      String(!state.serverPanelOpen)
    );
  }

  function revealPlayerControls() {
    if (!player) return;

    if (
      typeof window
        .setEastcoinPlayerToolbarCollapsed ===
      "function"
    ) {
      window.setEastcoinPlayerToolbarCollapsed(
        false,
        false
      );
    } else {
      player.playerToolbar.classList.remove(
        "collapsed"
      );
    }

    player.playerToolbar.hidden = false;

    /*
      Keep the server list closed until the visitor explicitly
      clicks Server Selector.
    */
    setServerPanelOpen(false);
  }

  function selectStream(
    stream,
    openPanel = false,
    reason = "initial"
  ) {
    if (!player || !stream?.embedUrl) return;

    clearRecoveryTimer();
    state.recoverySerial += 1;

    if (reason !== "automatic") {
      state.failedStreamKeys.delete(
        streamKey(stream)
      );
      state.automaticRecoveryAttempts = 0;
    }

    state.activeStream = stream;
    setConnectionStatus(
      reason === "automatic" ||
      reason === "reported"
        ? "switching"
        : "connecting",
      reason === "automatic" ||
      reason === "reported"
        ? "Trying another server"
        : "Connecting"
    );

    if (typeof window.loadStream !== "function") {
      throw new Error(
        "The EastCoin player is unavailable."
      );
    }

    /*
      Publish the event artwork before loadStream creates the iframe,
      allowing the loading overlay to render the correct matchup
      immediately.
    */
    updateShareState();
    window.loadStream(stream.embedUrl, true);
    renderServerPanel();
    saveContinueEvent(
      state.currentMatch,
      stream
    );
    armAutomaticRecovery(stream);
    showShortcutHintOnce();

    if (openPanel) {
      setServerPanelOpen(true);
    }

    if (reason === "initial") {
      toast(
        `${sourceLabel(stream.source)} ` +
        `Stream ${stream.streamNo} loaded.`
      );
    }
  }

  async function loadMatch(
    match,
    preferredSource = "",
    preferredNo = ""
  ) {
    if (!player) return;

    state.currentMatch = match;
    state.failedStreamKeys.clear();
    state.automaticRecoveryAttempts = 0;
    clearRecoveryTimer();

    /*
      New events always begin with the video fully visible.
      The server drawer opens only from Server Selector.
    */
    setServerPanelOpen(false);

    setStatus(
      `Loading available servers for ` +
      `${match.title || match.id}…`
    );

    try {
      state.streams = await API.getStreams(match, false);
      const selected = preferredStream(
        state.streams,
        preferredSource,
        preferredNo
      ) || recommendedStream(state.streams);
      selectStream(selected, false);
      setStatus(
        `${state.streams.length} stream${state.streams.length === 1 ? "" : "s"} loaded. ` +
        "Choose another server whenever the current one is not working."
      );
    } catch (error) {
      state.streams = [];
      state.activeStream = null;
      updateShareState();
      setStatus(error.message || "Unable to load event streams.", true);
    }
  }

  function clearPlayerState() {
    clearRecoveryTimer();
    state.recoverySerial += 1;
    state.currentMatch = null;
    state.streams = [];
    state.activeStream = null;
    state.serverPanelOpen = false;
    state.gameBreakOpen = false;
    state.failedStreamKeys.clear();
    state.automaticRecoveryAttempts = 0;
    window.eastcoinStreamedState = null;
    if (!player) return;
    player.serverButton.hidden = true;
    player.serverPanel.hidden = true;
    player.gameBreakPanel.hidden = true;
    player.playerShell.classList.remove(
      "streamed-server-open",
      "streamed-game-break-open"
    );
    player.serverPanel.setAttribute(
      "aria-hidden",
      "true"
    );
    player.sourceGroups.innerHTML = "";
    player.serverArtwork.innerHTML = "";
    player.toolbarArtwork.innerHTML = "";
    player.toolbarArtwork.hidden = true;
    player.toolbarTitle.classList.remove(
      "streamed-has-artwork"
    );
    updateRoomHeader();
  }

  function returnToDiscovery() {
    setServerPanelOpen(false);

    /*
      Change URL was intentionally removed from the player toolbar,
      so return directly through the exposed player reset instead of
      trying to click the old button.
    */
    if (
      typeof window.restoreEastcoinUrlPrompt ===
      "function"
    ) {
      window.restoreEastcoinUrlPrompt();
    }

    clearPlayerState();

    /*
      Remove player-specific parameters so refreshing the browser does
      not immediately reopen the event the visitor just left.
    */
    const currentUrl = new URL(
      window.location.href
    );

    [
      "event",
      "source",
      "stream",
      "watch",
      "streamedRoom",
      "streamedEvent",
      "streamedSource",
      "streamedStream"
    ].forEach((parameter) => {
      currentUrl.searchParams.delete(parameter);
    });

    window.history.replaceState(
      null,
      "",
      `${currentUrl.pathname}` +
      `${currentUrl.search}` +
      `${currentUrl.hash}`
    );

    window.setTimeout(() => {
      if (
        !state.live.length &&
        !state.today.length
      ) {
        loadDiscovery(false);
      } else {
        showDiscovery();
      }
    }, 0);
  }

  function watchTokenFromUrl(rawValue) {
    let parsed;
    try {
      parsed = new URL(
        /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawValue.trim())
          ? rawValue.trim()
          : `https://${rawValue.trim()}`
      );
    } catch {
      return "";
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!["streamed.pk", "streamed.st", "strmd.link"].includes(hostname)) {
      return "";
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const watchIndex = parts.findIndex((part) => part.toLowerCase() === "watch");
    return watchIndex >= 0 && parts[watchIndex + 1]
      ? decodeURIComponent(parts[watchIndex + 1])
      : "";
  }

  function matchIdentifiers(match) {
    const values = new Set([
      eventKey(match).toLowerCase(),
      slugify(match.title)
    ]);
    (match.sources || []).forEach((source) => {
      values.add(String(source.id || "").toLowerCase());
      values.add(`${String(source.source || "").toLowerCase()}-${String(source.id || "").toLowerCase()}`);
    });
    return values;
  }

  async function resolvePastedToken(token) {
    const normalized = String(token).toLowerCase().replace(/^\/+|\/+$/g, "");
    const loaded = dedupeMatches([...state.live, ...state.today]).find(
      (match) => matchIdentifiers(match).has(normalized) ||
        slugify(normalized) === slugify(match.title)
    );
    if (loaded) return loaded;

    /* /matches/all is only used after an explicit pasted URL misses the two cached lists. */
    const all = await API.getAll(false);
    return all.data.find(
      (match) => matchIdentifiers(match).has(normalized) ||
        slugify(normalized) === slugify(match.title)
    ) || null;
  }

  async function handleStreamedUrl(rawValue) {
    const token = watchTokenFromUrl(rawValue);
    if (!token) return false;
    showDiscovery();
    setStatus("Finding that event…");

    try {
      const match = await resolvePastedToken(token);
      if (!match) throw new Error("That event was not found in current listings.");
      await loadMatch(match);
    } catch (error) {
      setStatus(error.message || "Unable to resolve this event.", true);
      if (player) player.urlError.textContent = error.message || "Unable to resolve this event.";
    }
    return true;
  }

  async function restoreSharedRoom() {
    if (!player) return false;
    const params = new URLSearchParams(location.search);
    const room = parseRoomToken(params.get("streamedRoom"));
    const eventId = params.get("streamedEvent");
    if (!room && !eventId) return false;

    setStatus("Opening the shared event…");
    try {
      const match = room?.match || await resolveMatch(eventId, true);
      if (!match) throw new Error("The shared event is no longer listed.");
      await loadMatch(
        match,
        room?.source || params.get("streamedSource") || "",
        room?.streamNo ?? params.get("streamedStream") ?? ""
      );
      revealPlayerControls();
    } catch (error) {
      setStatus(error.message || "Unable to restore this shared event.", true);
      const watch = params.get("watch");
      if (watch && typeof window.loadStream === "function") {
        window.loadStream(watch, true);
      }
    }
    return true;
  }

  let requestedPlayerRestored = false;
  async function restoreRequestedPlayerEvent() {
    if (!player || requestedPlayerRestored) return;

    /*
      Legacy streamedRoom/streamedEvent links remain supported
      before checking the newer compact event link.
    */
    const shared = await restoreSharedRoom();

    if (shared) {
      requestedPlayerRestored = true;
      return;
    }

    const parameters = new URLSearchParams(
      location.search
    );
    const id = parameters.get("event");

    if (!id) return;

    requestedPlayerRestored = true;

    const match = await resolveMatch(id, true);

    if (!match) return;

    await loadMatch(
      match,
      parameters.get("source") || "",
      parameters.get("stream") || ""
    );
  }

  elements.liveButton?.addEventListener(
    "click",
    () => setMode("live")
  );
  elements.todayButton?.addEventListener(
    "click",
    () => setMode("today")
  );
  elements.tomorrowButton?.addEventListener(
    "click",
    () => setMode("tomorrow")
  );
  elements.refresh?.addEventListener(
    "click",
    () => {
      if (state.mode === "tomorrow") {
        loadTomorrow(true);
      } else {
        loadDiscovery(true);
      }
    }
  );
  elements.search?.addEventListener("input", () => {
    state.query = elements.search.value;
    renderDiscovery();
  });
  elements.sportTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sport]");
    if (!button) return;
    state.selectedSport = button.dataset.sport;
    renderDiscovery();
  });

  discoveryRoot.addEventListener("click", handleDiscoveryClick);
  elements.detail?.addEventListener("click", handleDiscoveryClick);

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches("[data-ec-image]")) return;
      image.parentElement?.classList.add("image-failed");
      image.remove();
    },
    true
  );

  window.addEventListener("storage", (event) => {
    if (event.key === FAVORITES_KEY) {
      state.favoriteTeams = loadFavoriteTeams();
      renderDiscovery();
      renderEventDetailForCurrentUrl();
      return;
    }

    if (event.key === CONTINUE_KEY) {
      state.continueEvent =
        loadContinueEvent();
      renderContinueWatching();
      return;
    }

    if (event.key === RECENT_KEY) {
      state.recentEvents =
        loadRecentEvents();
      renderRecentlyWatched();
      return;
    }

    if (
      event.key === SERVER_PREFERENCES_KEY
    ) {
      state.serverPreferences =
        loadServerPreferences();
      renderServerPanel();
    }
  });

  function typingTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        typingTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (
        key === "escape" &&
        state.serverPanelOpen
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setServerPanelOpen(false);
        return;
      }

      if (
        key === "escape" &&
        state.gameBreakOpen
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setGameBreakOpen(false);
        return;
      }

      if (event.repeat) return;

      if (
        key === "s" &&
        player &&
        !player.serverButton.hidden
      ) {
        event.preventDefault();
        player.serverButton.click();
        return;
      }

      if (key === "n" && player) {
        event.preventDefault();
        selectNextStream("manual");
        return;
      }

      if (key === "t") {
        const theater = document.querySelector(
          "[data-ec-theater-toggle]"
        );

        if (theater) {
          event.preventDefault();
          theater.click();
        }
        return;
      }

      if (key === "c") {
        const chat = document.querySelector(
          "[data-ec-chat-toggle]"
        );

        if (chat) {
          event.preventDefault();
          chat.click();
        }
        return;
      }

      if (key === "g") {
        const gameButton =
          document.querySelector(
            "[data-ec-game-overlay-toggle]"
          );

        if (gameButton) {
          event.preventDefault();
          gameButton.click();
        }
        return;
      }

      if (key === "m") {
        const menu =
          document.getElementById("mobileMenu") ||
          document.getElementById(
            "sidebarToggle"
          );

        if (menu) {
          event.preventDefault();
          menu.click();
        }
      }
    },
    true
  );

  window.setInterval(updateCountdowns, 15_000);

  setMode("live");

  const startupParameters = new URLSearchParams(
    window.location.search
  );
  const hasStreamedPlayerTarget = Boolean(
    player &&
    (
      startupParameters.has("streamedRoom") ||
      startupParameters.has("streamedEvent") ||
      startupParameters.has("event")
    )
  );
  const hasGenericWatchTarget = Boolean(
    player &&
    startupParameters.has("watch") &&
    !hasStreamedPlayerTarget
  );

  if (hasStreamedPlayerTarget) {
    /*
      Shared rooms and event links carry enough information to load without
      first requesting the discovery endpoints. The discovery dashboard is
      fetched only if the visitor later returns to View all streams.
    */
    restoreRequestedPlayerEvent();
  } else if (!hasGenericWatchTarget) {
    loadDiscovery(false);
  }
})();

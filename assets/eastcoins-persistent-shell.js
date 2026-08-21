(() => {
  "use strict";

  const body = document.body;
  const layout = document.getElementById("persistentLayout");
  const sidebar = document.getElementById("persistentSidebar");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileOverlay = document.getElementById("mobileOverlay");
  const resizeHandle = document.getElementById("resizeHandle");
  const playerFrame = document.getElementById("eastcoinViewFrame");
  const playerLoader = document.getElementById("viewLoader");
  const playerLoaderLabel = document.getElementById("viewLoaderLabel");
  const playerLoaderHint = document.getElementById("viewLoaderHint");
  const playerLoaderActions = document.getElementById("viewLoaderActions");
  const playerLoaderRetry = document.getElementById("viewLoaderRetry");
  const playerLoaderEvents = document.getElementById("viewLoaderEvents");
  const browseDrawer = document.getElementById("persistentBrowseDrawer");
  const browsePanel = document.getElementById("persistentBrowsePanel");
  const browseScrim = document.getElementById("persistentBrowseScrim");
  const browseClose = document.getElementById("persistentBrowseClose");
  const browseTitle = document.getElementById("persistentBrowseTitle");
  const browseKicker = document.getElementById("persistentBrowseKicker");
  const browseFrame = document.getElementById("eastcoinBrowseFrame");
  const browseLoader = document.getElementById("browseLoader");
  const browseLoaderLabel = document.getElementById("browseLoaderLabel");
  const toast = document.getElementById("toast");
  const settingsButton = document.getElementById("persistentSettingsButton");
  const settingsModal = document.getElementById("persistentSettingsModal");
  const settingsClose = document.getElementById("persistentSettingsClose");
  const settingsDone = document.getElementById("persistentSettingsDone");
  const settingChat = document.getElementById("persistentSettingChat");
  const settingSidebar = document.getElementById("persistentSettingSidebar");
  const settingMotion = document.getElementById("persistentSettingMotion");
  const settingArtwork = document.getElementById("persistentSettingArtwork");
  const settingCompactEvents = document.getElementById("persistentSettingCompactEvents");
  const settingSoonFirst = document.getElementById("persistentSettingSoonFirst");
  const resetChatWidth = document.getElementById("persistentResetChatWidth");
  const controlsToggle = document.getElementById("persistentControlsToggle");
  const controlsDrawer = document.getElementById("persistentControlsDrawer");
  const controlsClose = document.getElementById("persistentControlsClose");
  const theaterButton = document.getElementById("persistentTheaterButton");
  const chatButton = document.getElementById("persistentChatButton");
  const navButton = document.getElementById("persistentNavButton");
  const gameButton = document.getElementById("persistentGameButton");
  const dockSettingsButton = document.getElementById(
    "persistentDockSettingsButton"
  );
  const brandButton = document.getElementById("persistentBrandButton");
  const mobileSidebarClose = document.getElementById("mobileSidebarClose");
  const eventsLiveBadge = document.getElementById("eventsLiveBadge");
  const eventsLiveCount = document.getElementById("eventsLiveCount");
  const otherStreamsBadge = document.getElementById("otherStreamsBadge");
  const otherStreamsCount = document.getElementById("otherStreamsCount");
  const allEventsCount = document.getElementById("persistentAllEventsCount");
  const trendingEventsCount = document.getElementById("persistentTrendingCount");
  const omniForm = document.getElementById("persistentOmniForm");
  const omniInput = document.getElementById("persistentOmniInput");
  const omniAction = document.getElementById("persistentOmniAction");
  const omniHint = document.getElementById("persistentOmniHint");
  const railSearch = document.getElementById("persistentRailSearch");

  if (
    !body || !layout || !sidebar || !mobileMenu || !mobileOverlay ||
    !resizeHandle || !playerFrame || !playerLoader || !playerLoaderLabel ||
    !browseDrawer || !browsePanel || !browseScrim || !browseClose ||
    !browseTitle || !browseKicker || !browseFrame || !browseLoader ||
    !browseLoaderLabel
  ) {
    return;
  }

  document
    .querySelectorAll(
      ".ec-settings-only-button, .ec-utility-dock, #ecSettingsModal, .ec-settings-modal"
    )
    .forEach((element) => element.remove());

  const SIDEBAR_STORAGE_KEY = "eastcoinsSidebarCollapsed";
  const SIDEBAR_MODE_STORAGE_KEY = "eastcoinsSidebarMode";
  const COUNTDOWN_EXPANDED_STORAGE_KEY = "eastcoinsCountdownExpanded";
  const CHAT_WIDTH_STORAGE_KEY = "eastcoinsChatWidthV2";
  const CHAT_COLLAPSED_STORAGE_KEY = "eastcoinsChatCollapsed";
  const REDUCED_MOTION_STORAGE_KEY = "eastcoinsReducedMotion";
  const EVENT_PREFS_STORAGE_KEY = "eastcoinEventsRedesignV2Prefs";
  const DEFAULT_CHAT_WIDTH = 360;
  const MIN_CHAT_WIDTH = 280;
  const MIN_VIEW_WIDTH = 420;
  const PLAYER_PARAMETER_NAMES = [
    "event",
    "source",
    "stream",
    "watch",
    "streamedRoom",
    "streamedEvent",
    "streamedSource",
    "streamedStream",
    "new"
  ];
  const DRAWER_VIEWS = new Set(["events", "favorites", "emotes", "status"]);
  const EVENT_FILTER_PARAMETER_NAMES = ["scope", "sport", "q", "mode"];
  const SHARED_PLAYER_PARAMETER_NAMES = [
    "event",
    "source",
    "stream",
    "watch",
    "streamedRoom",
    "streamedEvent",
    "streamedSource",
    "streamedStream"
  ];

  function initialRequestUsesSharedPlayerLink() {
    const url = new URL(window.location.href);

    return (
      /\/watch\/?$/i.test(url.pathname) ||
      SHARED_PLAYER_PARAMETER_NAMES.some((name) =>
        url.searchParams.has(name)
      )
    );
  }

  const sharedInitialPlayerRequest =
    initialRequestUsesSharedPlayerLink();

  let currentView = "events";
  let lastEventsParameters = new URLSearchParams("scope=all");
  let drawerReturnView = null;
  let currentPlayerUrl = "";
  let currentBrowseUrl = "";
  let currentPlayerParameters = new URLSearchParams("shell=1");
  let activePointerId = null;
  let toastTimer = 0;
  let theaterActive = false;
  let pendingGameOverlay = false;
  let playerReady = false;
  let browseReady = false;
  let pendingPlayerReveal = null;
  let pendingPlayerRevealPollTimer = 0;
  let pendingPlayerRevealWarningTimer = 0;
  let pendingPlayerRevealStopTimer = 0;
  let playerDocumentWarningTimer = 0;
  let playerLoaderFailsafeTimer = 0;
  let browseLoaderFailsafeTimer = 0;
  let lastSettingsTrigger = settingsButton;
  let lastDrawerTrigger = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => toast.classList.remove("show"),
      2600
    );
  }

  window.showToast = showToast;

  function readStoredBoolean(key, fallback = false) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === "true";
    } catch {
      return fallback;
    }
  }

  function writeStoredBoolean(key, value) {
    try {
      localStorage.setItem(key, String(Boolean(value)));
    } catch {}
  }

  function readEventPrefs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(EVENT_PREFS_STORAGE_KEY) || "null") || {};
      return {
        artwork: parsed.artwork !== false,
        compact: Boolean(parsed.compact),
        soonFirst: parsed.soonFirst !== false
      };
    } catch {
      return { artwork: true, compact: false, soonFirst: true };
    }
  }

  function writeEventPrefs(prefs) {
    try {
      localStorage.setItem(EVENT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
    if (!browseDrawer.hidden) {
      postToFrame(browseFrame, { type: "eastcoin:event-prefs-updated", prefs });
    }
  }

  function clearDockHideTimer() {}
  function scheduleDockHide() {}
  function showUtilityDock() {}

  function controlsDrawerIsOpen() {
    return Boolean(controlsDrawer && controlsDrawer.classList.contains("is-open"));
  }

  function setControlsDrawerOpen(open) {
    if (!controlsDrawer || !controlsToggle) return;
    const enabled = Boolean(open);
    controlsDrawer.classList.toggle("is-open", enabled);
    controlsDrawer.setAttribute("aria-hidden", String(!enabled));
    controlsToggle.setAttribute("aria-expanded", String(enabled));
    controlsToggle.setAttribute("aria-label", enabled ? "Close view controls" : "Open view controls");
  }

  function setUtilityButton(button, icon, label, active = false) {
    if (!button) return;
    const iconElement = button.querySelector(".ec-persistent-control-icon");
    const labelElement = button.querySelector("strong");
    if (iconElement) iconElement.textContent = icon;
    if (labelElement) labelElement.textContent = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("is-active", Boolean(active));
  }

  function desktopSidebarMode() {
    if (body.classList.contains("sidebar-hidden")) return "hidden";
    if (body.classList.contains("sidebar-collapsed")) return "rail";
    return "expanded";
  }

  function navigationIsVisible() {
    if (theaterActive) return false;
    return isMobileNavigation()
      ? body.classList.contains("menu-open")
      : desktopSidebarMode() !== "hidden";
  }

  function chatIsVisible() {
    return !theaterActive && !body.classList.contains("chat-collapsed");
  }

  function updateUtilityDock() {
    const navigationVisible = navigationIsVisible();
    const chatVisible = chatIsVisible();

    setUtilityButton(
      theaterButton,
      theaterActive ? "↙" : "⛶",
      theaterActive ? "Exit theater" : "Theater",
      theaterActive
    );
    theaterButton?.setAttribute("aria-pressed", String(theaterActive));

    setUtilityButton(
      chatButton,
      "💬",
      chatVisible ? "Hide chat" : "Show chat",
      chatVisible
    );
    chatButton?.setAttribute("aria-pressed", String(chatVisible));

    const sidebarMode = isMobileNavigation()
      ? (navigationVisible ? "expanded" : "hidden")
      : desktopSidebarMode();
    const navVisible = sidebarMode !== "hidden";
    const navIcon = navVisible ? "◀" : "☰";
    const navLabel = navVisible ? "Hide nav" : "Show nav";
    setUtilityButton(navButton, navIcon, navLabel, navVisible);
    navButton?.setAttribute("aria-pressed", String(navVisible));
  }

  function shellState() {
    return {
      type: "eastcoin:shell-state",
      navigationVisible: navigationIsVisible(),
      chatVisible: chatIsVisible(),
      theaterActive
    };
  }

  function postToFrame(frame, message) {
    try {
      frame?.contentWindow?.postMessage(message, window.location.origin);
    } catch {}
  }

  function postToPlayer(message) {
    postToFrame(playerFrame, message);
  }

  function postShellState() {
    const state = shellState();
    postToFrame(playerFrame, state);
    if (!browseDrawer.hidden) postToFrame(browseFrame, state);
  }

  function drawerIsOpen() {
    return !browseDrawer.hidden;
  }

  function clearPendingPlayerRevealTimers() {
    window.clearInterval(pendingPlayerRevealPollTimer);
    window.clearTimeout(pendingPlayerRevealWarningTimer);
    window.clearTimeout(pendingPlayerRevealStopTimer);
    pendingPlayerRevealPollTimer = 0;
    pendingPlayerRevealWarningTimer = 0;
    pendingPlayerRevealStopTimer = 0;
  }

  function playerHasVisibleContent() {
    try {
      return Boolean(
        playerFrame.contentDocument?.getElementById("activeFrame")
      );
    } catch {
      return false;
    }
  }

  function clearPlayerDocumentWarningTimer() {
    window.clearTimeout(playerDocumentWarningTimer);
    playerDocumentWarningTimer = 0;
  }

  function clearPlayerLoaderFailsafe() {
    window.clearTimeout(playerLoaderFailsafeTimer);
    playerLoaderFailsafeTimer = 0;
  }

  function clearBrowseLoaderFailsafe() {
    window.clearTimeout(browseLoaderFailsafeTimer);
    browseLoaderFailsafeTimer = 0;
  }

  /*
    The child pages own their real loading/error UI. The outer shell loader is
    only a transition cover, so it must fail open even if a browser misses an
    iframe load event. This prevents a fully rendered player/events page from
    remaining trapped behind "Loading Live Player" or "Loading Events".
  */
  function startPlayerLoaderFailsafe() {
    clearPlayerLoaderFailsafe();

    playerLoaderFailsafeTimer = window.setTimeout(() => {
      if (playerLoader.classList.contains("is-hidden")) return;

      playerReady = true;
      finishPlayerDocumentLoad();
      postToFrame(playerFrame, shellState());
      flushPendingGameOverlay();

      if (pendingPlayerReveal) {
        startPendingPlayerRevealWatch();
      }
    }, 3000);
  }

  function startBrowseLoaderFailsafe() {
    clearBrowseLoaderFailsafe();

    browseLoaderFailsafeTimer = window.setTimeout(() => {
      if (browseLoader.classList.contains("is-hidden")) return;

      browseReady = true;
      browseLoader.classList.add("is-hidden");
      postToFrame(browseFrame, shellState());
    }, 3000);
  }

  function finishPlayerDocumentLoad() {
    clearPlayerDocumentWarningTimer();
    clearPlayerLoaderFailsafe();
    playerLoader.classList.add("is-hidden");
    if (playerLoaderActions) playerLoaderActions.hidden = true;
  }

  /*
    The outer shell is responsible only for loading EastCoin's own
    player.html document. It must not remain on top while waiting for a
    provider iframe. player.html already owns event resolution, server
    selection, provider loading, retries, and provider error states.
  */
  function startPlayerDocumentWarning() {
    clearPlayerDocumentWarningTimer();

    playerDocumentWarningTimer = window.setTimeout(() => {
      if (playerReady) return;

      playerLoaderLabel.textContent =
        "EastCoin player is taking longer than expected";

      if (playerLoaderHint) {
        playerLoaderHint.textContent =
          "The player page has not finished loading. You can retry it or return to Events.";
      }

      if (playerLoaderActions) {
        playerLoaderActions.hidden = false;
      }
    }, 7000);
  }

  function cancelPendingPlayerReveal({ hideLoader = true } = {}) {
    if (!pendingPlayerReveal) return;

    pendingPlayerReveal = null;
    clearPendingPlayerRevealTimers();
    body.classList.remove("player-transition-pending");

    if (hideLoader) {
      browseLoader.classList.add("is-hidden");
    }
  }

  function finishPendingPlayerReveal() {
    if (!pendingPlayerReveal) return;

    pendingPlayerReveal = null;
    clearPendingPlayerRevealTimers();
    body.classList.remove("player-transition-pending");
    browseLoader.classList.add("is-hidden");

    /*
      The requested player is now ready enough to reveal. Dismiss the
      OUTER shell loader before removing the Events drawer; otherwise the
      viewLoader can remain layered above a stream that is already playing.
    */
    finishPlayerDocumentLoad();

    closeBrowseDrawer({
      replaceHistory: false,
      restoreFocus: false
    });

    body.classList.remove("menu-open");
    updateNavigationButton();
    postShellState();
    showUtilityDock(true);
  }

  function startPendingPlayerRevealWatch() {
    if (!pendingPlayerReveal || pendingPlayerReveal.watchStarted) {
      return;
    }

    pendingPlayerReveal.watchStarted = true;

    const checkPlayer = () => {
      if (!pendingPlayerReveal) return;

      if (playerHasVisibleContent()) {
        finishPendingPlayerReveal();
      }
    };

    checkPlayer();
    if (!pendingPlayerReveal) return;

    pendingPlayerRevealPollTimer = window.setInterval(
      checkPlayer,
      100
    );

    /*
      Prefer the seamless real-frame handoff, but do not keep Events
      covering a provider that is simply slow to resolve.

      Once player.html itself is ready, give the player a brief chance
      to create activeFrame. If it still has not, reveal player.html so
      its own loading/server/error UI can take over.
    */
    pendingPlayerRevealWarningTimer = window.setTimeout(() => {
      if (!pendingPlayerReveal) return;

      if (playerReady) {
        showToast(
          "The provider is still loading. Opening the player so you can see its status."
        );
        finishPendingPlayerReveal();
        return;
      }

      browseLoader.classList.add("is-hidden");
      showToast(
        "EastCoin is still preparing the player. You can retry the event or choose another."
      );
    }, 3500);

    pendingPlayerRevealStopTimer = window.setTimeout(() => {
      if (!pendingPlayerReveal) return;

      if (playerReady) {
        finishPendingPlayerReveal();
      } else {
        cancelPendingPlayerReveal({ hideLoader: true });
      }
    }, 10000);
  }

  function beginPendingPlayerReveal(parameters) {
    cancelPendingPlayerReveal({ hideLoader: false });
    drawerReturnView = null;

    const request = new URLSearchParams(parameters);
    pendingPlayerReveal = {
      watchStarted: false,
      requestedAt: Date.now()
    };

    body.classList.add("player-transition-pending");
    browseLoaderLabel.textContent = request.has("event")
      ? "Opening event…"
      : "Opening stream…";
    browseLoader.classList.remove("is-hidden");
  }

  function setPlayerLoading(label = "Loading Live Player") {
    clearPlayerDocumentWarningTimer();
    playerLoaderLabel.textContent = label;
    if (playerLoaderHint) {
      playerLoaderHint.textContent = "Preparing the EastCoin player.";
    }
    if (playerLoaderActions) {
      playerLoaderActions.hidden = true;
    }
    playerLoader.classList.remove("is-hidden");
    startPlayerDocumentWarning();
    startPlayerLoaderFailsafe();
  }

  function setBrowseLoading(view) {
    browseLoaderLabel.textContent =
      view === "events"
        ? "Loading Events"
        : view === "favorites"
          ? "Loading Other Streams"
          : view === "emotes"
            ? "Loading Emote Help"
            : "Loading Status";
    browseLoader.classList.remove("is-hidden");
    startBrowseLoaderFailsafe();
  }

  function copyParameters(source, target, names) {
    names.forEach((name) => {
      source.getAll(name).forEach((value) => target.append(name, value));
    });
  }

  function childUrl(view, parameters) {
    const filename =
      view === "events"
        ? "events.html"
        : view === "favorites"
          ? "favorites.html"
          : view === "emotes"
            ? "emote-help.html"
            : view === "status"
              ? "status.html"
              : "player.html";
    const url = new URL(filename, window.location.href);
    url.search = parameters.toString();
    return url.href;
  }

  function shellUrl(view, parameters = new URLSearchParams()) {
    const url = new URL("index.html", window.location.href);
    const clean = new URLSearchParams();

    if (DRAWER_VIEWS.has(view)) {
      clean.set("view", view);
      if (view === "events") {
        copyParameters(parameters, clean, EVENT_FILTER_PARAMETER_NAMES);
      }
    } else {
      copyParameters(parameters, clean, PLAYER_PARAMETER_NAMES);
      if (!Array.from(clean.keys()).length) clean.set("view", "player");
    }

    url.search = clean.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function updateActiveNavigation(view, parameters = new URLSearchParams()) {
    const scope = parameters.get("scope") || "all";
    const sport = parameters.get("sport") || "";

    document.querySelectorAll("[data-ec-shell-view]").forEach((item) => {
      const itemView = item.dataset.ecShellView;
      let active = itemView === view;

      if (active && view === "events") {
        const itemScope = item.dataset.ecEventsScope || "";
        const itemSport = item.dataset.ecEventsSport || "";
        if (itemSport) active = itemSport === sport;
        else if (itemScope) active = !sport && itemScope === scope;
        else active = false;
      }

      item.classList.toggle("is-active", active);
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function updateNavigationCounts({ allCount, liveCount, trendingCount, categoryCounts, favoriteCount } = {}) {
    if (Number.isFinite(Number(allCount)) && allEventsCount) allEventsCount.textContent = String(Math.max(0, Number(allCount)));
    if (Number.isFinite(Number(trendingCount)) && trendingEventsCount) trendingEventsCount.textContent = String(Math.max(0, Number(trendingCount)));
    if (categoryCounts && typeof categoryCounts === "object") {
      document.querySelectorAll("[data-ec-category-count]").forEach((badge) => {
        const count = Math.max(0, Number(categoryCounts[badge.dataset.ecCategoryCount] || 0));
        badge.textContent = String(count);
        badge.hidden = count === 0;
      });
    }
    if (Number.isFinite(Number(liveCount)) && eventsLiveBadge && eventsLiveCount) {
      const count = Math.max(0, Number(liveCount));
      eventsLiveCount.textContent = String(count);
      eventsLiveBadge.hidden = false;
      eventsLiveBadge.classList.toggle("is-zero", count === 0);
      eventsLiveBadge.setAttribute(
        "aria-label",
        count === 1 ? "1 live event" : `${count} live events`
      );
    }

    if (Number.isFinite(Number(favoriteCount)) && otherStreamsBadge && otherStreamsCount) {
      const count = Math.max(0, Number(favoriteCount));
      otherStreamsCount.textContent = String(count);
      otherStreamsBadge.hidden = false;
      otherStreamsBadge.setAttribute(
        "aria-label",
        count === 1 ? "1 approved stream" : `${count} approved streams`
      );
    }
  }

  function updateDocumentTitle(view) {
    document.title =
      view === "events"
        ? "Events | EastCoin"
        : view === "status"
          ? "Status | EastCoin"
          : view === "favorites"
          ? "Other Streams | EastCoin"
          : view === "emotes"
            ? "Emote Help | EastCoin"
            : "Live Player | EastCoin";
  }

  function updateHistory(view, parameters, { push = true, replace = false } = {}) {
    if (!push && !replace) return;
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ view }, "", shellUrl(view, parameters));
  }

  function loadPlayer(parameters = new URLSearchParams(), force = false) {
    const nextParameters = new URLSearchParams(parameters);
    nextParameters.set("shell", "1");
    const nextUrl = childUrl("player", nextParameters);
    currentPlayerParameters = new URLSearchParams(nextParameters);

    if (!force && nextUrl === currentPlayerUrl) return false;

    currentPlayerUrl = nextUrl;
    playerReady = false;
    setPlayerLoading();
    playerFrame.title = "EastCoin Live Player";
    playerFrame.src = nextUrl;
    return true;
  }

  function drawerCopy(view) {
    if (view === "events") {
      return {
        title: "Events",
        kicker: "Browse games without stopping playback"
      };
    }
    if (view === "favorites") {
      return {
        title: "Other Streams",
        kicker: "Browse sites without stopping playback"
      };
    }
    if (view === "emotes") {
      return { title: "Emote Help", kicker: "Review setup help without stopping playback" };
    }
    return { title: "Status", kicker: "Check EastCoin without stopping playback" };
  }

  function openBrowseDrawer(view, parameters = new URLSearchParams(), trigger = null) {
    const nextParameters = new URLSearchParams(parameters);
    nextParameters.set("shell", "1");
    const nextUrl = childUrl(view, nextParameters);
    const copy = drawerCopy(view);
    const previousView = currentView;

    if (view !== "events" && previousView === "events") {
      drawerReturnView = "events";
    } else if (view === "events") {
      lastEventsParameters = new URLSearchParams(nextParameters);
      drawerReturnView = null;
    }

    currentView = view;
    lastDrawerTrigger = trigger || lastDrawerTrigger;
    browseTitle.textContent = copy.title;
    browseKicker.textContent = copy.kicker;
    browsePanel.setAttribute("aria-label", copy.title);
    browseFrame.title = `EastCoin ${copy.title}`;
    browseDrawer.hidden = false;
    browseDrawer.setAttribute("aria-hidden", "false");
    body.classList.add("drawer-open");
    body.classList.toggle("drawer-events-home", view === "events");
    updateActiveNavigation(view, nextParameters);
    updateDocumentTitle(view);
    body.classList.remove("menu-open");
    updateNavigationButton();
    showUtilityDock(true);

    if (nextUrl !== currentBrowseUrl) {
      currentBrowseUrl = nextUrl;
      browseReady = false;
      setBrowseLoading(view);
      browseFrame.src = nextUrl;
    } else if (browseReady) {
      browseLoader.classList.add("is-hidden");
    } else {
      setBrowseLoading(view);
    }

    if (view === "events") {
      browseClose.textContent = "▶ Back to video";
      browseClose.setAttribute("aria-label", "Return to the current video");
      browseClose.hidden = !currentPlayerUrl;
    } else {
      browseClose.hidden = false;
      browseClose.textContent = previousView === "events"
        ? "Back to Events"
        : "Back to video";
      browseClose.setAttribute(
        "aria-label",
        previousView === "events"
          ? "Return to Events"
          : "Close browser and return to video"
      );
      window.setTimeout(() => {
        browseClose.focus({ preventScroll: true });
      }, 40);
    }
  }

  function closeBrowseDrawer({ replaceHistory = true, restoreFocus = true } = {}) {
    cancelPendingPlayerReveal();

    if (!drawerIsOpen()) return;

    if (replaceHistory && drawerReturnView === "events") {
      drawerReturnView = null;
      openBrowseDrawer("events", lastEventsParameters, null);
      updateHistory("events", lastEventsParameters, {
        push: false,
        replace: true
      });
      return;
    }

    browseDrawer.hidden = true;
    browseDrawer.setAttribute("aria-hidden", "true");
    body.classList.remove("drawer-open", "drawer-events-home");

    /*
      Back to video can expose an already-ready player. Make sure no
      stale shell loader survives underneath the browse drawer.
    */
    if (playerReady) {
      finishPlayerDocumentLoad();
    }

    currentView = "player";
    updateActiveNavigation("player");
    updateDocumentTitle("player");
    showUtilityDock(true);

    if (replaceHistory) {
      updateHistory("player", currentPlayerParameters, {
        push: false,
        replace: true
      });
    }

    if (restoreFocus) {
      const playerLink = document.querySelector('[data-ec-shell-view="player"]');
      (lastDrawerTrigger || playerLink)?.focus?.({ preventScroll: true });
    }
  }

  function openView(
    view,
    parameters = new URLSearchParams(),
    { push = true, replace = false, trigger = null } = {}
  ) {
    const normalizedView = DRAWER_VIEWS.has(view) ? view : "player";
    const nextParameters = new URLSearchParams(parameters);
    nextParameters.set("shell", "1");

    if (normalizedView === "player") {
      const hasExplicitPlayerRequest = PLAYER_PARAMETER_NAMES.some(
        (name) => nextParameters.has(name)
      );
      const startFresh = nextParameters.get("new") === "1";
      const hasMediaRequest =
        !startFresh &&
        SHARED_PLAYER_PARAMETER_NAMES.some((name) => {
          const value = nextParameters.get(name);
          return value !== null && String(value).trim() !== "";
        });
      const deferPlayerReveal =
        drawerIsOpen() &&
        hasMediaRequest;

      if (deferPlayerReveal) {
        /*
          Events and Other Streams are browse drawers over the persistent
          player. Keep the drawer visible until player.html has replaced its
          homepage/form with the requested event or external stream.
        */
        beginPendingPlayerReveal(nextParameters);
        body.classList.remove("menu-open");
        updateNavigationButton();

        const playerReloaded = loadPlayer(
          nextParameters,
          false
        );

        /*
          If the requested player URL is already mounted (for example,
          selecting the same event again), its active frame can be checked
          immediately. Otherwise the player iframe load handler starts the
          watch against the newly loaded document.
        */
        if (!playerReloaded) {
          startPendingPlayerRevealWatch();
        }
      } else {
        closeBrowseDrawer({
          replaceHistory: false,
          restoreFocus: false
        });
        currentView = "player";
        updateActiveNavigation("player");
        updateDocumentTitle("player");
        body.classList.remove("menu-open");
        updateNavigationButton();

        if (hasExplicitPlayerRequest || !currentPlayerUrl) {
          /*
            Live Player is also the shell's Home action. Force a reload for
            ?new=1 even when the parent still remembers the same player.html URL.
            This matters after a user manually loads a stream inside the already
            mounted player iframe, because the outer shell URL does not change.
          */
          loadPlayer(nextParameters, startFresh);
        }
      }
    } else {
      openBrowseDrawer(normalizedView, nextParameters, trigger);
    }

    updateHistory(normalizedView, nextParameters, { push, replace });
  }

  function routeFromLocation() {
    const url = new URL(window.location.href);
    const parameters = url.searchParams;
    const hasPlayerParameter = PLAYER_PARAMETER_NAMES.some(
      (name) => parameters.has(name)
    );
    const requestedView = parameters.get("view");
    const eventDetail = parameters.get("eventDetail");
    const pathView = /\/events(?:\.html)?\/?$/i.test(url.pathname)
      ? "events"
      : /\/favorites(?:\.html)?\/?$/i.test(url.pathname)
        ? "favorites"
        : /\/emotes(?:\.html)?\/?$/i.test(url.pathname)
          ? "emotes"
          : /\/watch\/?$/i.test(url.pathname)
            ? "player"
            : "";
    const view = hasPlayerParameter
      ? "player"
      : ["player", "events", "favorites", "emotes", "status"].includes(requestedView)
        ? requestedView
        : pathView || "events";
    const childParameters = new URLSearchParams();
    childParameters.set("shell", "1");

    if (view === "player") {
      copyParameters(parameters, childParameters, PLAYER_PARAMETER_NAMES);
    } else if (view === "events") {
      copyParameters(parameters, childParameters, EVENT_FILTER_PARAMETER_NAMES);
    } else if (eventDetail) {
      childParameters.set("event", eventDetail);
    }

    return { view, childParameters };
  }

  function flushPendingGameOverlay() {
    if (!pendingGameOverlay || !playerReady) return;
    pendingGameOverlay = false;
    postToPlayer({ type: "eastcoin:toggle-game-overlay" });
  }

  function requestGameOverlay() {
    showUtilityDock(true);
    if (drawerIsOpen()) {
      closeBrowseDrawer({ replaceHistory: false, restoreFocus: false });
      updateHistory("player", currentPlayerParameters, { push: true });
    }

    currentView = "player";
    updateActiveNavigation("player");
    updateDocumentTitle("player");

    if (!currentPlayerUrl) {
      loadPlayer(new URLSearchParams("shell=1"), true);
    }

    if (playerReady) {
      postToPlayer({ type: "eastcoin:toggle-game-overlay" });
    } else {
      pendingGameOverlay = true;
    }
  }

  function togglePersistentChat() {
    if (theaterActive) {
      setTheaterMode(false);
      setChatCollapsed(false, true);
      return;
    }
    setChatCollapsed(!body.classList.contains("chat-collapsed"), true);
  }

  function setTheaterMode(enabled) {
    if (enabled && !currentPlayerUrl) {
      showToast("Open a stream before entering Theater mode.");
      return;
    }
    if (enabled && drawerIsOpen()) {
      closeBrowseDrawer({ replaceHistory: true, restoreFocus: false });
    }
    theaterActive = Boolean(enabled);
    body.classList.toggle("theater-mode", theaterActive);
    body.classList.remove("menu-open");
    updateNavigationButton();
    updateUtilityDock();
    postShellState();
    showUtilityDock(true);
  }

  function setDesktopSidebarMode(mode, save = true) {
    const normalized = ["expanded", "rail", "hidden"].includes(mode)
      ? mode
      : "expanded";

    body.classList.toggle("sidebar-collapsed", normalized === "rail");
    body.classList.toggle("sidebar-hidden", normalized === "hidden");

    if (save) {
      try {
        localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, normalized);
        localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          String(normalized !== "expanded")
        );
      } catch {}
    }

    updateNavigationButton();
    postShellState();
  }

  function setDesktopSidebarCollapsed(collapsed, save = true) {
    setDesktopSidebarMode(collapsed ? "rail" : "expanded", save);
  }

  function toggleShellNavigation() {
    if (theaterActive) {
      setTheaterMode(false);

      if (isMobileNavigation()) {
        body.classList.add("menu-open");
        updateNavigationButton();
        postShellState();
      } else {
        setDesktopSidebarMode("rail", true);
      }

      return;
    }

    if (isMobileNavigation()) {
      body.classList.toggle("menu-open");
      updateNavigationButton();
      postShellState();
      return;
    }

    const mode = desktopSidebarMode();

    /*
      The top hamburger is now a dedicated compact-nav control:
      expanded <-> rail. Fully hiding navigation remains the job of
      the separate right-side View Controls drawer.
    */
    setDesktopSidebarMode(
      mode === "expanded" ? "rail" : mode === "rail" ? "expanded" : "rail",
      true
    );
  }

  function toggleNavigationVisibility() {
    if (theaterActive) {
      setTheaterMode(false);
    }

    if (isMobileNavigation()) {
      body.classList.toggle("menu-open");
      updateNavigationButton();
      postShellState();
      return;
    }

    const current = desktopSidebarMode();
    if (current === "hidden") {
      const preferRail = settingSidebar?.checked === true;
      setDesktopSidebarMode(preferRail ? "rail" : "expanded", true);
    } else {
      setDesktopSidebarMode("hidden", true);
    }
  }

  function setChatCollapsed(collapsed, save = true) {
    body.classList.toggle("chat-collapsed", Boolean(collapsed));
    if (save) writeStoredBoolean(CHAT_COLLAPSED_STORAGE_KEY, collapsed);
    if (settingChat) settingChat.checked = !collapsed;
    updateUtilityDock();
    postShellState();
  }

  function setReducedMotion(enabled, save = true) {
    document.documentElement.classList.toggle(
      "ec-shell-reduced-motion",
      Boolean(enabled)
    );
    if (save) writeStoredBoolean(REDUCED_MOTION_STORAGE_KEY, enabled);
    if (settingMotion) settingMotion.checked = Boolean(enabled);
  }

  function syncSettings() {
    if (settingChat) {
      settingChat.checked = !body.classList.contains("chat-collapsed");
    }
    if (settingSidebar) {
      settingSidebar.checked = desktopSidebarMode() === "rail";
    }
    if (settingMotion) {
      settingMotion.checked = document.documentElement.classList.contains(
        "ec-shell-reduced-motion"
      );
    }
    const eventPrefs = readEventPrefs();
    if (settingArtwork) settingArtwork.checked = eventPrefs.artwork;
    if (settingCompactEvents) settingCompactEvents.checked = eventPrefs.compact;
    if (settingSoonFirst) settingSoonFirst.checked = eventPrefs.soonFirst;
  }

  function openSettings(trigger = settingsButton) {
    if (!settingsModal) return;
    lastSettingsTrigger = trigger || settingsButton;
    syncSettings();
    clearDockHideTimer();
    showUtilityDock(false);
    settingsModal.hidden = false;
    settingsModal.setAttribute("aria-hidden", "false");
    settingsClose?.focus({ preventScroll: true });
  }

  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.hidden = true;
    settingsModal.setAttribute("aria-hidden", "true");
    lastSettingsTrigger?.focus?.({ preventScroll: true });
    scheduleDockHide();
  }

  settingsButton?.addEventListener("click", () => openSettings(settingsButton));
  controlsToggle?.addEventListener("click", () => setControlsDrawerOpen(!controlsDrawerIsOpen()));
  controlsClose?.addEventListener("click", () => setControlsDrawerOpen(false));
  dockSettingsButton?.addEventListener("click", () => { setControlsDrawerOpen(false); openSettings(dockSettingsButton); });
  theaterButton?.addEventListener("click", () => { setTheaterMode(!theaterActive); setControlsDrawerOpen(false); });
  chatButton?.addEventListener("click", () => { togglePersistentChat(); setControlsDrawerOpen(false); });
  navButton?.addEventListener("click", () => { toggleNavigationVisibility(); setControlsDrawerOpen(false); });
  mobileSidebarClose?.addEventListener("click", () => {
    body.classList.remove("menu-open");
    updateNavigationButton();
    postShellState();
  });
  brandButton?.addEventListener("click", () => {
    if (!isMobileNavigation() && desktopSidebarMode() === "rail") {
      setDesktopSidebarMode("expanded", true);
      return;
    }
    openView("events", new URLSearchParams("scope=all"), { push: true, trigger: brandButton });
  });
  gameButton?.addEventListener("click", () => { requestGameOverlay(); setControlsDrawerOpen(false); });
  settingsClose?.addEventListener("click", closeSettings);
  settingsDone?.addEventListener("click", closeSettings);
  browseClose.addEventListener("click", () => closeBrowseDrawer());
  browseScrim.addEventListener("click", () => closeBrowseDrawer());

  settingsModal?.addEventListener("click", (event) => {
    if (event.target === settingsModal) closeSettings();
  });
  settingChat?.addEventListener("change", () => {
    setChatCollapsed(!settingChat.checked, true);
  });
  settingSidebar?.addEventListener("change", () => {
    if (!isMobileNavigation()) {
      setDesktopSidebarMode(settingSidebar.checked ? "rail" : "expanded", true);
    }
  });
  settingMotion?.addEventListener("change", () => {
    setReducedMotion(settingMotion.checked, true);
  });
  [settingArtwork, settingCompactEvents, settingSoonFirst].forEach((input) => {
    input?.addEventListener("change", () => {
      writeEventPrefs({
        artwork: settingArtwork?.checked !== false,
        compact: Boolean(settingCompactEvents?.checked),
        soonFirst: settingSoonFirst?.checked !== false
      });
    });
  });
  resetChatWidth?.addEventListener("click", () => {
    try {
      localStorage.removeItem(CHAT_WIDTH_STORAGE_KEY);
    } catch {}
    setChatWidth(DEFAULT_CHAT_WIDTH, false);
    showToast("Chat width reset.");
  });

  document.querySelectorAll("[data-football-countdown]").forEach((countdown) => {
    const summary = countdown.querySelector(".football-countdown-summary");
    summary?.addEventListener("click", (event) => {
      if (!isMobileNavigation() && desktopSidebarMode() === "rail") {
        event.preventDefault();
        setDesktopSidebarMode("expanded", true);
        countdown.open = true;
      }
    });
    countdown.addEventListener("toggle", () => {
      writeStoredBoolean(COUNTDOWN_EXPANDED_STORAGE_KEY, countdown.open);
    });
  });

  function isTypingTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    );
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (controlsDrawerIsOpen()) {
        event.preventDefault();
        setControlsDrawerOpen(false);
        return;
      }
      if (settingsModal && !settingsModal.hidden) {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (drawerIsOpen()) {
        event.preventDefault();
        closeBrowseDrawer();
        return;
      }
    }

    if (
      event.defaultPrevented || event.repeat ||
      event.ctrlKey || event.metaKey || event.altKey ||
      isTypingTarget(event.target)
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "t") {
      event.preventDefault();
      setTheaterMode(!theaterActive);
    } else if (key === "c") {
      event.preventDefault();
      togglePersistentChat();
    } else if (key === "m") {
      event.preventDefault();
      toggleNavigationVisibility();
    } else if (key === "g") {
      event.preventDefault();
      requestGameOverlay();
    }
  });

  function isMobileNavigation() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function updateNavigationButton() {
    if (isMobileNavigation()) {
      const open = body.classList.contains("menu-open");
      mobileMenu.textContent = open ? "×" : "☰";
      mobileMenu.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation"
      );
      mobileMenu.setAttribute("aria-expanded", String(open));
    } else {
      const mode = desktopSidebarMode();
      const label =
        mode === "expanded"
          ? "Compact navigation"
          : mode === "rail"
            ? "Expand navigation"
            : "Show compact navigation";

      mobileMenu.textContent = "☰";
      mobileMenu.setAttribute("aria-label", label);
      mobileMenu.setAttribute("title", label);
      mobileMenu.setAttribute("aria-expanded", String(mode !== "hidden"));
      mobileMenu.dataset.sidebarMode = mode;
    }
    updateUtilityDock();
  }

  mobileMenu.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleShellNavigation();
    },
    true
  );

  mobileOverlay.addEventListener("click", () => {
    body.classList.remove("menu-open");
    updateNavigationButton();
    postShellState();
  });

  function getChatWidthLimits() {
    const layoutWidth = layout.getBoundingClientRect().width;
    const sidebarWidth = sidebar.getBoundingClientRect().width;
    const dividerWidth = resizeHandle.getBoundingClientRect().width;
    const availableMaximum =
      layoutWidth - sidebarWidth - dividerWidth - MIN_VIEW_WIDTH;
    const practicalMaximum = Math.min(560, layoutWidth * .4);
    return {
      min: MIN_CHAT_WIDTH,
      max: Math.max(
        MIN_CHAT_WIDTH,
        Math.min(availableMaximum, practicalMaximum)
      )
    };
  }

  function clampChatWidth(width) {
    const limits = getChatWidthLimits();
    return Math.min(Math.max(width, limits.min), limits.max);
  }

  function setChatWidth(width, save = false) {
    if (isMobileNavigation()) return;
    const clampedWidth = Math.round(clampChatWidth(width));
    document.documentElement.style.setProperty(
      "--ec-chat-width",
      `${clampedWidth}px`
    );
    resizeHandle.setAttribute("aria-valuenow", String(clampedWidth));
    resizeHandle.setAttribute(
      "aria-valuemax",
      String(Math.round(getChatWidthLimits().max))
    );
    if (save) {
      try {
        localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(clampedWidth));
      } catch {}
    }
  }

  function widthFromPointer(clientX) {
    return layout.getBoundingClientRect().right - clientX;
  }

  resizeHandle.addEventListener("pointerdown", (event) => {
    if (isMobileNavigation() || event.button !== 0) return;
    activePointerId = event.pointerId;
    resizeHandle.setPointerCapture(activePointerId);
    body.classList.add("resizing-chat");
    setChatWidth(widthFromPointer(event.clientX));
    event.preventDefault();
  });
  resizeHandle.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    setChatWidth(widthFromPointer(event.clientX));
  });

  function finishChatResize(event) {
    if (event.pointerId !== activePointerId) return;
    setChatWidth(widthFromPointer(event.clientX), true);
    body.classList.remove("resizing-chat");
    if (resizeHandle.hasPointerCapture(activePointerId)) {
      resizeHandle.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
  }

  resizeHandle.addEventListener("pointerup", finishChatResize);
  resizeHandle.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;
    body.classList.remove("resizing-chat");
    activePointerId = null;
  });
  resizeHandle.addEventListener("keydown", (event) => {
    if (isMobileNavigation()) return;
    const currentWidth = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ec-chat-width")
    ) || DEFAULT_CHAT_WIDTH;
    const step = event.shiftKey ? 50 : 20;
    let nextWidth = currentWidth;
    if (event.key === "ArrowLeft") nextWidth += step;
    else if (event.key === "ArrowRight") nextWidth -= step;
    else if (event.key === "Home") nextWidth = MIN_CHAT_WIDTH;
    else if (event.key === "End") nextWidth = getChatWidthLimits().max;
    else return;
    event.preventDefault();
    setChatWidth(nextWidth, true);
  });
  resizeHandle.addEventListener("dblclick", () => {
    setChatWidth(DEFAULT_CHAT_WIDTH, true);
    showToast("Chat width reset.");
  });

  function looksLikeOmniUrl(value) {
    const trimmed = String(value || "").trim();
    return /^(https?:\/\/)/i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}(?:[\/:?#]|$)/i.test(trimmed);
  }

  function normalizeOmniUrl(value) {
    const trimmed = String(value || "").trim();
    const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    const local = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Only HTTP or HTTPS URLs can be embedded.");
    if (parsed.protocol === "http:" && !local) throw new Error("Use an HTTPS stream URL on EastCoin.");
    return parsed.href;
  }

  function updateOmniMode() {
    if (!omniForm || !omniInput || !omniAction) return;
    const urlMode = looksLikeOmniUrl(omniInput.value);
    omniForm.classList.toggle("is-url", urlMode);
    omniAction.textContent = urlMode ? "Load" : "Search";
    if (omniHint) omniHint.textContent = urlMode
      ? "Press Enter to open this stream in EastCoin."
      : "Search teams, games and leagues — or paste a stream URL.";
  }

  omniInput?.addEventListener("input", updateOmniMode);
  omniForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = String(omniInput?.value || "").trim();
    if (!value) {
      openView("events", new URLSearchParams("scope=all"), { push: true, trigger: omniInput });
      return;
    }
    if (looksLikeOmniUrl(value)) {
      try {
        const parameters = new URLSearchParams();
        parameters.set("watch", normalizeOmniUrl(value));
        openView("player", parameters, { push: true, trigger: omniInput });
      } catch (error) {
        showToast(error?.message || "Enter a valid HTTPS stream URL.");
      }
      return;
    }
    const parameters = new URLSearchParams();
    parameters.set("scope", "all");
    parameters.set("q", value);
    openView("events", parameters, { push: true, trigger: omniInput });
  });

  railSearch?.addEventListener("click", () => {
    if (!isMobileNavigation()) setDesktopSidebarMode("expanded", true);
    window.setTimeout(() => omniInput?.focus({ preventScroll: true }), 40);
  });

  playerLoaderRetry?.addEventListener("click", () => {
    loadPlayer(currentPlayerParameters, true);
  });

  playerLoaderEvents?.addEventListener("click", () => {
    clearPlayerDocumentWarningTimer();
    openView("events", lastEventsParameters, { push: true });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!controlsDrawerIsOpen()) return;
    if (controlsDrawer?.contains(event.target) || controlsToggle?.contains(event.target)) return;
    setControlsDrawerOpen(false);
  }, true);

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-ec-shell-view]");
    if (!link) return;
    event.preventDefault();
    const view = link.dataset.ecShellView;
    const url = new URL(link.href, window.location.href);
    const parameters = new URLSearchParams();
    parameters.set("shell", "1");
    if (url.searchParams.get("new") === "1") parameters.set("new", "1");
    if (view === "events") {
      if (link.dataset.ecEventsScope) parameters.set("scope", link.dataset.ecEventsScope);
      if (link.dataset.ecEventsSport) parameters.set("sport", link.dataset.ecEventsSport);
    }
    openView(view, parameters, { push: true, trigger: link });
  });

  playerFrame.addEventListener("load", () => {
    clearPlayerLoaderFailsafe();
    playerReady = true;
    clearPlayerDocumentWarningTimer();
    postToFrame(playerFrame, shellState());
    window.setTimeout(flushPendingGameOverlay, 120);

    if (pendingPlayerReveal) {
      startPendingPlayerRevealWatch();
    } else {
      /*
        EastCoin's own player document is ready. Remove the outer loader
        immediately and let player.html handle the event/provider from here.
      */
      finishPlayerDocumentLoad();
    }
  });

  browseFrame.addEventListener("load", () => {
    clearBrowseLoaderFailsafe();
    browseReady = true;
    browseLoader.classList.add("is-hidden");
    postToFrame(browseFrame, shellState());
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const fromPlayer = event.source === playerFrame.contentWindow;
    const fromBrowse = event.source === browseFrame.contentWindow;
    if (!fromPlayer && !fromBrowse) return;

    const message = event.data || {};

    if (message.type === "eastcoin:navigation-counts") {
      updateNavigationCounts(message);
      return;
    }

    if (message.type === "eastcoin:event-nav-state") {
      updateNavigationCounts(message);
      return;
    }

    if (message.type === "eastcoin:open-multiview") {
      window.location.href = new URL("multiview.html", window.location.href).href;
      return;
    }

    if (message.type === "eastcoin:view-ready") {
      if (fromPlayer) {
        playerReady = true;
        clearPlayerDocumentWarningTimer();
        postToFrame(playerFrame, shellState());
        flushPendingGameOverlay();

        if (pendingPlayerReveal) {
          startPendingPlayerRevealWatch();
        } else {
          finishPlayerDocumentLoad();
        }
      } else {
        browseReady = true;
        browseLoader.classList.add("is-hidden");
        postToFrame(browseFrame, shellState());
      }
      return;
    }

    if (message.type === "eastcoin:request-shell-state") {
      postToFrame(fromPlayer ? playerFrame : browseFrame, shellState());
      return;
    }

    if (fromPlayer && message.type === "eastcoin:toggle-navigation") {
      toggleShellNavigation();
      return;
    }
    if (fromPlayer && message.type === "eastcoin:toggle-chat") {
      togglePersistentChat();
      return;
    }
    if (fromPlayer && message.type === "eastcoin:toggle-theater") {
      setTheaterMode(!theaterActive);
      return;
    }

    if (message.type === "eastcoin:open-player") {
      const parameters = new URLSearchParams();
      parameters.set("shell", "1");
      ["event", "source", "stream", "watch", "new"].forEach((name) => {
        const value = message[name];
        if (value !== undefined && value !== null && String(value) !== "") {
          parameters.set(name, String(value));
        }
      });
      openView("player", parameters, { push: true });
      return;
    }

    if (message.type === "eastcoin:open-events") {
      const parameters = new URLSearchParams();
      parameters.set("shell", "1");
      if (message.event) parameters.set("event", String(message.event));
      openView("events", parameters, { push: true });
      return;
    }

    if (message.type === "eastcoin:open-favorites") {
      openView("favorites", new URLSearchParams("shell=1"), { push: true });
    }
  });

  window.addEventListener("popstate", () => {
    const route = routeFromLocation();
    openView(route.view, route.childParameters, { push: false });
  });

  window.addEventListener("pagehide", () => {
    clearPlayerDocumentWarningTimer();
    clearPlayerLoaderFailsafe();
    clearBrowseLoaderFailsafe();
    clearPendingPlayerRevealTimers();
  }, { once: true });

  window.addEventListener("resize", () => {
    body.classList.remove("menu-open");
    if (!isMobileNavigation()) {
      const currentWidth = parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--ec-chat-width")
      ) || DEFAULT_CHAT_WIDTH;
      setChatWidth(currentWidth);
    }
    updateNavigationButton();
    postShellState();
    showUtilityDock(true);
  });

  function initializeFootballCountdowns() {
    const kickoffTime = new Date("2026-09-09T19:20:00-05:00");
    const savedExpanded = readStoredBoolean(
      COUNTDOWN_EXPANDED_STORAGE_KEY,
      false
    );

    document.querySelectorAll("[data-football-countdown]").forEach((countdown) => {
      countdown.open = savedExpanded;
      const daysElement = countdown.querySelector("[data-countdown-days]");
      const hoursElement = countdown.querySelector("[data-countdown-hours]");
      const minutesElement = countdown.querySelector("[data-countdown-minutes]");
      const secondsElement = countdown.querySelector("[data-countdown-seconds]");
      const compactElement = countdown.querySelector("[data-countdown-compact]");
      const titleElement = countdown.querySelector(".football-countdown-title");
      const statusElement = countdown.querySelector(".football-countdown-live");

      function update() {
        const remaining = kickoffTime.getTime() - Date.now();
        if (remaining <= 0) {
          countdown.classList.add("is-live");
          titleElement.textContent = "Football is back";
          statusElement.textContent = "Live";
          compactElement.textContent = "LIVE";
          daysElement.textContent = "00";
          hoursElement.textContent = "00";
          minutesElement.textContent = "00";
          secondsElement.textContent = "00";
          return false;
        }

        const totalSeconds = Math.floor(remaining / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        daysElement.textContent = String(days);
        hoursElement.textContent = String(hours).padStart(2, "0");
        minutesElement.textContent = String(minutes).padStart(2, "0");
        secondsElement.textContent = String(seconds).padStart(2, "0");
        compactElement.textContent = days > 0
          ? `${days}d ${hours}h`
          : `${hours}h ${minutes}m`;
        return true;
      }

      update();
      const timer = window.setInterval(() => {
        if (!update()) window.clearInterval(timer);
      }, 1000);
    });
  }

  let savedSidebarMode = "expanded";
  let savedChatWidth = DEFAULT_CHAT_WIDTH;
  let savedChatCollapsed = false;
  let savedReducedMotion = false;

  try {
    const storedMode = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
    savedSidebarMode = ["expanded", "rail", "hidden"].includes(storedMode)
      ? storedMode
      : localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
        ? "rail"
        : "expanded";
    savedChatCollapsed = readStoredBoolean(CHAT_COLLAPSED_STORAGE_KEY, false);
    savedReducedMotion = readStoredBoolean(REDUCED_MOTION_STORAGE_KEY, false);
    const candidate = Number(localStorage.getItem(CHAT_WIDTH_STORAGE_KEY));
    if (Number.isFinite(candidate) && candidate > 0) savedChatWidth = candidate;
  } catch {}

  if (!isMobileNavigation()) {
    /*
      Shared event and watch URLs should open with the compact icon rail so
      the video gets priority without removing navigation entirely. This is
      intentionally not saved, preserving the visitor's normal preference
      for future non-shared EastCoin visits.
    */
    setDesktopSidebarMode(
      sharedInitialPlayerRequest ? "rail" : savedSidebarMode,
      false
    );
    setChatWidth(savedChatWidth);
  } else {
    updateNavigationButton();
  }

  setChatCollapsed(savedChatCollapsed, false);
  setReducedMotion(savedReducedMotion, false);
  syncSettings();
  updateUtilityDock();
  initializeFootballCountdowns();

  const initialRoute = routeFromLocation();
  if (initialRoute.view === "player") {
    currentPlayerParameters = new URLSearchParams(initialRoute.childParameters);
  }
  openView(initialRoute.view, initialRoute.childParameters, {
    push: false,
    replace: true
  });
  setControlsDrawerOpen(false);
  updateOmniMode();
})();

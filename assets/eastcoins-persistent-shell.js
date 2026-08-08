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
  const settingDockAutohide = document.getElementById(
    "persistentSettingDockAutohide"
  );
  const resetChatWidth = document.getElementById("persistentResetChatWidth");
  const utilityDock = document.getElementById("persistentUtilityDock");
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
  const DOCK_AUTOHIDE_STORAGE_KEY = "eastcoinsDockAutohide";
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
  const DRAWER_VIEWS = new Set(["events", "favorites", "emotes"]);
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

  let currentView = "player";
  let currentPlayerUrl = "";
  let currentBrowseUrl = "";
  let currentPlayerParameters = new URLSearchParams("shell=1");
  let activePointerId = null;
  let toastTimer = 0;
  let theaterActive = false;
  let pendingGameOverlay = false;
  let playerReady = false;
  let browseReady = false;
  let lastSettingsTrigger = settingsButton;
  let lastDrawerTrigger = null;
  let dockAutoHideEnabled = true;
  let dockHideTimer = 0;
  let dockActivityFrame = 0;

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

  function clearDockHideTimer() {
    window.clearTimeout(dockHideTimer);
    dockHideTimer = 0;
  }

  function dockShouldRemainVisible() {
    return Boolean(
      !dockAutoHideEnabled ||
      (settingsModal && !settingsModal.hidden) ||
      utilityDock?.matches(":hover") ||
      utilityDock?.contains(document.activeElement)
    );
  }

  function scheduleDockHide() {
    clearDockHideTimer();
    if (!dockAutoHideEnabled || !utilityDock) return;

    const delay = isMobileNavigation() ? 4300 : 3000;
    dockHideTimer = window.setTimeout(() => {
      if (dockShouldRemainVisible()) {
        scheduleDockHide();
        return;
      }
      body.classList.add("dock-idle");
    }, delay);
  }

  function showUtilityDock(schedule = true) {
    body.classList.remove("dock-idle");
    if (schedule) scheduleDockHide();
  }

  function setDockAutoHide(enabled, save = true) {
    dockAutoHideEnabled = Boolean(enabled);
    body.classList.toggle("dock-autohide-disabled", !dockAutoHideEnabled);

    if (settingDockAutohide) {
      settingDockAutohide.checked = dockAutoHideEnabled;
    }

    if (save) {
      writeStoredBoolean(DOCK_AUTOHIDE_STORAGE_KEY, dockAutoHideEnabled);
    }

    clearDockHideTimer();
    showUtilityDock(dockAutoHideEnabled);
  }

  function noteDockActivity() {
    if (dockActivityFrame) return;
    dockActivityFrame = window.requestAnimationFrame(() => {
      dockActivityFrame = 0;
      showUtilityDock(true);
    });
  }

  ["pointermove", "pointerdown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, noteDockActivity, { passive: true });
  });

  document.addEventListener("keydown", noteDockActivity);
  document.addEventListener("focusin", noteDockActivity);
  utilityDock?.addEventListener("pointerenter", () => {
    clearDockHideTimer();
    showUtilityDock(false);
  });
  utilityDock?.addEventListener("pointerleave", scheduleDockHide);
  utilityDock?.addEventListener("focusout", scheduleDockHide);

  function setUtilityButton(button, icon, label, active = false) {
    if (!button) return;
    const iconElement = button.querySelector(".ec-persistent-utility-icon");
    const labelElement = button.querySelector(".ec-persistent-utility-label");

    if (iconElement) iconElement.textContent = icon;
    if (labelElement) labelElement.textContent = label;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
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
    const navIcon = sidebarMode === "expanded" ? "‹" : sidebarMode === "rail" ? "×" : "☰";
    const navLabel = sidebarMode === "expanded"
      ? "Compact nav"
      : sidebarMode === "rail"
        ? "Hide nav"
        : "Show nav";
    setUtilityButton(navButton, navIcon, navLabel, sidebarMode !== "expanded");
    navButton?.setAttribute("aria-pressed", String(sidebarMode !== "expanded"));
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

  function setPlayerLoading(label = "Loading Live Player") {
    playerLoaderLabel.textContent = label;
    playerLoader.classList.remove("is-hidden");
  }

  function setBrowseLoading(view) {
    browseLoaderLabel.textContent =
      view === "events"
        ? "Loading Events"
        : view === "favorites"
          ? "Loading Other Streams"
          : "Loading Emote Help";
    browseLoader.classList.remove("is-hidden");
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
      if (view === "events" && parameters.has("event")) {
        clean.set("eventDetail", parameters.get("event"));
      }
    } else {
      copyParameters(parameters, clean, PLAYER_PARAMETER_NAMES);
      if (!Array.from(clean.keys()).length) clean.set("view", "player");
    }

    url.search = clean.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function updateActiveNavigation(view) {
    document.querySelectorAll("[data-ec-shell-view]").forEach((link) => {
      const active = link.dataset.ecShellView === view;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function updateNavigationCounts({ liveCount, favoriteCount } = {}) {
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
    return {
      title: "Emote Help",
      kicker: "Review setup help without stopping playback"
    };
  }

  function openBrowseDrawer(view, parameters = new URLSearchParams(), trigger = null) {
    const nextParameters = new URLSearchParams(parameters);
    nextParameters.set("shell", "1");
    const nextUrl = childUrl(view, nextParameters);
    const copy = drawerCopy(view);

    currentView = view;
    lastDrawerTrigger = trigger || lastDrawerTrigger;
    browseTitle.textContent = copy.title;
    browseKicker.textContent = copy.kicker;
    browsePanel.setAttribute("aria-label", copy.title);
    browseFrame.title = `EastCoin ${copy.title}`;
    browseDrawer.hidden = false;
    browseDrawer.setAttribute("aria-hidden", "false");
    body.classList.add("drawer-open");
    updateActiveNavigation(view);
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

    window.setTimeout(() => {
      browseClose.focus({ preventScroll: true });
    }, 40);
  }

  function closeBrowseDrawer({ replaceHistory = true, restoreFocus = true } = {}) {
    if (!drawerIsOpen()) return;

    browseDrawer.hidden = true;
    browseDrawer.setAttribute("aria-hidden", "true");
    body.classList.remove("drawer-open");
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

    if (!currentPlayerUrl) loadPlayer(currentPlayerParameters);

    if (normalizedView === "player") {
      closeBrowseDrawer({ replaceHistory: false, restoreFocus: false });
      currentView = "player";
      updateActiveNavigation("player");
      updateDocumentTitle("player");
      body.classList.remove("menu-open");
      updateNavigationButton();
      const hasExplicitPlayerRequest = PLAYER_PARAMETER_NAMES.some(
        (name) => nextParameters.has(name)
      );
      const startFresh = nextParameters.get("new") === "1";

      if (hasExplicitPlayerRequest || !currentPlayerUrl) {
        /*
          Live Player is also the shell's Home action. Force a reload for
          ?new=1 even when the parent still remembers the same player.html URL.
          This matters after a user manually loads a stream inside the already
          mounted player iframe, because the outer shell URL does not change.
        */
        loadPlayer(nextParameters, startFresh);
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
      : ["player", "events", "favorites", "emotes"].includes(requestedView)
        ? requestedView
        : pathView || "player";
    const childParameters = new URLSearchParams();
    childParameters.set("shell", "1");

    if (view === "player") {
      copyParameters(parameters, childParameters, PLAYER_PARAMETER_NAMES);
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
        setDesktopSidebarMode("expanded", true);
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
    setDesktopSidebarMode(
      mode === "expanded" ? "rail" : mode === "rail" ? "hidden" : "expanded"
    );
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
    if (settingDockAutohide) {
      settingDockAutohide.checked = dockAutoHideEnabled;
    }
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
  dockSettingsButton?.addEventListener("click", () => openSettings(dockSettingsButton));
  theaterButton?.addEventListener("click", () => setTheaterMode(!theaterActive));
  chatButton?.addEventListener("click", togglePersistentChat);
  navButton?.addEventListener("click", toggleShellNavigation);
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
    openView("player", currentPlayerParameters, { push: true, trigger: brandButton });
  });
  gameButton?.addEventListener("click", requestGameOverlay);
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
  settingDockAutohide?.addEventListener("change", () => {
    setDockAutoHide(settingDockAutohide.checked, true);
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
      toggleShellNavigation();
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
      mobileMenu.textContent = mode === "expanded" ? "‹" : mode === "rail" ? "×" : "☰";
      mobileMenu.setAttribute(
        "aria-label",
        mode === "expanded"
          ? "Collapse navigation to icon rail"
          : mode === "rail"
            ? "Hide navigation"
            : "Show navigation"
      );
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

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-ec-shell-view]");
    if (!link) return;
    event.preventDefault();
    const view = link.dataset.ecShellView;
    const url = new URL(link.href, window.location.href);
    const parameters = new URLSearchParams();
    parameters.set("shell", "1");
    if (url.searchParams.get("new") === "1") parameters.set("new", "1");
    openView(view, parameters, { push: true, trigger: link });
  });

  playerFrame.addEventListener("load", () => {
    playerLoader.classList.add("is-hidden");
    playerReady = true;
    postToFrame(playerFrame, shellState());
    window.setTimeout(flushPendingGameOverlay, 120);
  });

  browseFrame.addEventListener("load", () => {
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

    if (message.type === "eastcoin:view-ready") {
      if (fromPlayer) {
        playerLoader.classList.add("is-hidden");
        playerReady = true;
        postToFrame(playerFrame, shellState());
        flushPendingGameOverlay();
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
  let savedDockAutohide = true;

  try {
    const storedMode = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
    savedSidebarMode = ["expanded", "rail", "hidden"].includes(storedMode)
      ? storedMode
      : localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
        ? "rail"
        : "expanded";
    savedChatCollapsed = readStoredBoolean(CHAT_COLLAPSED_STORAGE_KEY, false);
    savedReducedMotion = readStoredBoolean(REDUCED_MOTION_STORAGE_KEY, false);
    savedDockAutohide = readStoredBoolean(DOCK_AUTOHIDE_STORAGE_KEY, true);
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
  setDockAutoHide(savedDockAutohide, false);
  syncSettings();
  updateUtilityDock();
  initializeFootballCountdowns();

  const initialRoute = routeFromLocation();
  if (initialRoute.view === "player") {
    currentPlayerParameters = new URLSearchParams(initialRoute.childParameters);
  }
  loadPlayer(currentPlayerParameters);
  openView(initialRoute.view, initialRoute.childParameters, {
    push: false,
    replace: true
  });
  showUtilityDock(true);
})();

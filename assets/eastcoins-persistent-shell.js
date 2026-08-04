(() => {
  "use strict";

  const body = document.body;
  const layout = document.getElementById("persistentLayout");
  const sidebar = document.getElementById("persistentSidebar");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileOverlay = document.getElementById("mobileOverlay");
  const resizeHandle = document.getElementById("resizeHandle");
  const viewFrame = document.getElementById("eastcoinViewFrame");
  const viewLoader = document.getElementById("viewLoader");
  const viewLoaderLabel = document.getElementById("viewLoaderLabel");
  const toast = document.getElementById("toast");

  if (
    !body || !layout || !sidebar || !mobileMenu || !mobileOverlay ||
    !resizeHandle || !viewFrame || !viewLoader || !viewLoaderLabel
  ) {
    return;
  }

  /*
    The persistent shell owns navigation and no longer uses the legacy
    sitewide settings dock. Remove any stale controls restored from browser
    back/forward cache before initializing the shell.
  */
  document
    .querySelectorAll(
      ".ec-settings-only-button, .ec-utility-dock, #ecSettingsModal, .ec-settings-modal"
    )
    .forEach((element) => element.remove());

  const SIDEBAR_STORAGE_KEY = "eastcoinsSidebarCollapsed";
  const CHAT_WIDTH_STORAGE_KEY = "eastcoinsChatWidthV2";
  const DEFAULT_CHAT_WIDTH = 360;
  const MIN_CHAT_WIDTH = 280;
  const MIN_VIEW_WIDTH = 420;

  let currentView = "";
  let currentFrameUrl = "";
  let activePointerId = null;
  let toastTimer = 0;

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

  function isMobileNavigation() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function updateNavigationButton() {
    if (isMobileNavigation()) {
      const open = body.classList.contains("menu-open");
      mobileMenu.textContent = open ? "✕" : "☰";
      mobileMenu.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation"
      );
      mobileMenu.setAttribute("aria-expanded", String(open));
      return;
    }

    const collapsed = body.classList.contains("sidebar-collapsed");
    mobileMenu.textContent = collapsed ? "☰" : "◀";
    mobileMenu.setAttribute(
      "aria-label",
      collapsed ? "Show navigation" : "Hide navigation"
    );
    mobileMenu.setAttribute("aria-expanded", String(!collapsed));
  }

  function setDesktopSidebarCollapsed(collapsed, save = true) {
    body.classList.toggle("sidebar-collapsed", collapsed);

    if (save) {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
      } catch {}
    }

    updateNavigationButton();
  }

  mobileMenu.addEventListener(
    "click",
    (event) => {
      /*
        Capture the toggle before any legacy page script can also react to
        the same button and immediately undo the sidebar state change.
      */
      event.preventDefault();
      event.stopImmediatePropagation();

      if (isMobileNavigation()) {
        body.classList.toggle("menu-open");
        updateNavigationButton();
        return;
      }

      setDesktopSidebarCollapsed(
        !body.classList.contains("sidebar-collapsed")
      );
    },
    true
  );

  mobileOverlay.addEventListener("click", () => {
    body.classList.remove("menu-open");
    updateNavigationButton();
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

  function copyParameters(source, target, names) {
    names.forEach((name) => {
      const values = source.getAll(name);
      values.forEach((value) => target.append(name, value));
    });
  }

  function routeFromLocation() {
    const url = new URL(window.location.href);
    const parameters = url.searchParams;
    const playerParameters = [
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
    const hasPlayerParameter = playerParameters.some(
      (name) => parameters.has(name)
    );
    const requestedView = parameters.get("view");
    const eventDetail = parameters.get("eventDetail");
    const pathView = /\/events\/?$/i.test(url.pathname)
      ? "events"
      : /\/emotes\/?$/i.test(url.pathname)
        ? "emotes"
        : /\/watch\/?$/i.test(url.pathname)
          ? "player"
          : "";
    const view = hasPlayerParameter
      ? "player"
      : ["player", "events", "emotes"].includes(requestedView)
        ? requestedView
        : pathView || "player";

    const childParameters = new URLSearchParams();
    childParameters.set("shell", "1");

    if (view === "player") {
      copyParameters(parameters, childParameters, playerParameters);
    } else if (eventDetail) {
      childParameters.set("event", eventDetail);
    }

    return { view, childParameters };
  }

  function shellUrl(view, childParameters = new URLSearchParams()) {
    const url = new URL("index.html", window.location.href);
    const clean = new URLSearchParams();

    if (view === "events") {
      clean.set("view", "events");
      if (childParameters.has("event")) {
        clean.set("eventDetail", childParameters.get("event"));
      }
    } else if (view === "emotes") {
      clean.set("view", "emotes");
    } else {
      const playerNames = [
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
      copyParameters(childParameters, clean, playerNames);
      if (!Array.from(clean.keys()).length) {
        clean.set("view", "player");
      }
    }

    url.search = clean.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function childUrl(view, parameters) {
    const filename =
      view === "events"
        ? "events.html"
        : view === "emotes"
          ? "emote-help.html"
          : "player.html";
    const url = new URL(filename, window.location.href);
    url.search = parameters.toString();
    return url.href;
  }

  function updateActiveNavigation(view) {
    document.querySelectorAll("[data-ec-shell-view]").forEach((link) => {
      link.classList.toggle(
        "active",
        link.dataset.ecShellView === view
      );
    });
  }

  function setLoading(view) {
    viewLoaderLabel.textContent =
      view === "events"
        ? "Loading Events"
        : view === "emotes"
          ? "Loading Emote Help"
          : "Loading Live Player";
    viewLoader.classList.remove("is-hidden");
  }

  function updateDocumentTitle(view) {
    document.title =
      view === "events"
        ? "Events | EastCoin"
        : view === "emotes"
          ? "Emote Help | EastCoin"
          : "Live Player | EastCoin";
  }

  function openView(
    view,
    parameters = new URLSearchParams(),
    { push = true, replace = false } = {}
  ) {
    const normalizedView =
      ["events", "emotes"].includes(view)
        ? view
        : "player";
    const nextParameters = new URLSearchParams(parameters);
    nextParameters.set("shell", "1");
    const nextFrameUrl = childUrl(normalizedView, nextParameters);

    currentView = normalizedView;
    updateActiveNavigation(normalizedView);
    updateDocumentTitle(normalizedView);
    body.classList.remove("menu-open");
    updateNavigationButton();

    if (nextFrameUrl !== currentFrameUrl) {
      currentFrameUrl = nextFrameUrl;
      setLoading(normalizedView);
      viewFrame.title =
        normalizedView === "events"
          ? "EastCoin Events"
          : normalizedView === "emotes"
            ? "EastCoin Emote Help"
            : "EastCoin Live Player";
      viewFrame.src = nextFrameUrl;
    }

    if (push || replace) {
      const nextShellUrl = shellUrl(normalizedView, nextParameters);
      window.history[replace ? "replaceState" : "pushState"](
        { view: normalizedView },
        "",
        nextShellUrl
      );
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-ec-shell-view]");
    if (!link) return;

    event.preventDefault();
    const view = link.dataset.ecShellView;
    const url = new URL(link.href, window.location.href);
    const parameters = new URLSearchParams();
    parameters.set("shell", "1");

    if (url.searchParams.get("new") === "1") {
      parameters.set("new", "1");
    }

    openView(view, parameters, { push: true });
  });

  viewFrame.addEventListener("load", () => {
    viewLoader.classList.add("is-hidden");
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== viewFrame.contentWindow) {
      return;
    }

    const message = event.data || {};

    if (message.type === "eastcoin:view-ready") {
      viewLoader.classList.add("is-hidden");
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
  });

  function initializeFootballCountdowns() {
    const kickoffTime = new Date("2026-09-09T19:20:00-05:00");

    document.querySelectorAll("[data-football-countdown]").forEach((countdown) => {
      const daysElement = countdown.querySelector("[data-countdown-days]");
      const hoursElement = countdown.querySelector("[data-countdown-hours]");
      const minutesElement = countdown.querySelector("[data-countdown-minutes]");
      const secondsElement = countdown.querySelector("[data-countdown-seconds]");
      const titleElement = countdown.querySelector(".football-countdown-title");
      const statusElement = countdown.querySelector(".football-countdown-live");

      function update() {
        const remaining = kickoffTime.getTime() - Date.now();

        if (remaining <= 0) {
          countdown.classList.add("is-live");
          titleElement.textContent = "Football is back";
          statusElement.textContent = "Live";
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
        return true;
      }

      update();
      const timer = window.setInterval(() => {
        if (!update()) window.clearInterval(timer);
      }, 1000);
    });
  }

  let savedSidebarState = false;
  let savedChatWidth = DEFAULT_CHAT_WIDTH;

  try {
    savedSidebarState = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    const candidate = Number(localStorage.getItem(CHAT_WIDTH_STORAGE_KEY));
    if (Number.isFinite(candidate) && candidate > 0) savedChatWidth = candidate;
  } catch {}

  if (!isMobileNavigation()) {
    setDesktopSidebarCollapsed(savedSidebarState, false);
    setChatWidth(savedChatWidth);
  } else {
    updateNavigationButton();
  }

  initializeFootballCountdowns();

  const initialRoute = routeFromLocation();
  openView(initialRoute.view, initialRoute.childParameters, {
    push: false,
    replace: true
  });
})();

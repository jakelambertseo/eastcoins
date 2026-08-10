(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const STORAGE_KEY = "eastcoinMultiviewV1";
  const SIDEBAR_MODE_KEY = "eastcoinsSidebarMode";
  const LEGACY_SIDEBAR_KEY = "eastcoinsSidebarCollapsed";
  const REDUCED_MOTION_KEY = "eastcoinsReducedMotion";
  const DEFAULT_LAYOUT = 4;
  const VALID_LAYOUTS = new Set([2, 3, 4]);

  const body = document.body;
  const grid = document.getElementById("mvGrid");
  const panels = Array.from(document.querySelectorAll(".mv-panel[data-slot]"));
  const statusText = document.getElementById("mvStatusText");

  const navToggle = document.getElementById("mvNavToggle");
  const mobileOverlay = document.getElementById("mvMobileOverlay");
  const mobileSidebarClose = document.getElementById("mvMobileSidebarClose");

  const chatButton = document.getElementById("mvChatButton");
  const chatClose = document.getElementById("mvChatClose");
  const chatDrawer = document.getElementById("mvChatDrawer");
  const chatFrame = document.getElementById("mvChatFrame");

  const sourceModal = document.getElementById("mvSourceModal");
  const sourceClose = document.getElementById("mvSourceClose");
  const sourceSlotNumber = document.getElementById("mvSourceSlotNumber");
  const sourceTabs = Array.from(document.querySelectorAll("[data-source-tab]"));
  const sourceViews = Array.from(document.querySelectorAll("[data-source-view]"));
  const eventModeButtons = Array.from(document.querySelectorAll("[data-event-mode]"));
  const eventSearch = document.getElementById("mvEventSearch");
  const eventStatus = document.getElementById("mvEventStatus");
  const eventList = document.getElementById("mvEventList");
  const urlInput = document.getElementById("mvUrlInput");
  const urlAdd = document.getElementById("mvUrlAdd");
  const urlError = document.getElementById("mvUrlError");

  const settingsButton = document.getElementById("mvSettingsButton");
  const settingsModal = document.getElementById("mvSettingsModal");
  const settingsClose = document.getElementById("mvSettingsClose");
  const settingsDone = document.getElementById("mvSettingsDone");
  const settingCompactNav = document.getElementById("mvSettingCompactNav");
  const settingReducedMotion = document.getElementById("mvSettingReducedMotion");

  const clearButton = document.getElementById("mvClearButton");
  const toast = document.getElementById("mvToast");

  let toastTimer = 0;
  let activeSlot = 0;
  let sourceTab = "events";
  let eventMode = "live";
  let focusedSlot = null;
  let eventsLoaded = false;
  let eventsLoading = false;
  let eventData = {
    live: [],
    today: [],
    liveIds: new Set(),
    sports: new Map()
  };

  function blankState() {
    return {
      layout: DEFAULT_LAYOUT,
      slots: [null, null, null, null]
    };
  }

  function readState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || !Array.isArray(raw.slots)) return blankState();

      const layout = VALID_LAYOUTS.has(Number(raw.layout))
        ? Number(raw.layout)
        : DEFAULT_LAYOUT;

      return {
        layout,
        slots: Array.from({ length: 4 }, (_, index) => {
          const source = raw.slots[index];
          if (!source || !["event", "url"].includes(source.type)) return null;

          if (source.type === "event" && source.id) {
            return {
              type: "event",
              id: String(source.id),
              title: String(source.title || "EastCoin event"),
              meta: String(source.meta || "")
            };
          }

          if (source.type === "url" && source.url) {
            return {
              type: "url",
              url: String(source.url),
              title: String(source.title || hostLabel(source.url)),
              meta: "Manual URL"
            };
          }

          return null;
        })
      };
    } catch {
      return blankState();
    }
  }

  let state = readState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function desktopSidebarMode() {
    if (body.classList.contains("sidebar-hidden")) return "hidden";
    if (body.classList.contains("sidebar-collapsed")) return "rail";
    return "expanded";
  }

  function setDesktopSidebarMode(mode, save = true) {
    const normalized = ["expanded", "rail", "hidden"].includes(mode)
      ? mode
      : "expanded";

    body.classList.toggle("sidebar-collapsed", normalized === "rail");
    body.classList.toggle("sidebar-hidden", normalized === "hidden");

    if (save) {
      try {
        localStorage.setItem(SIDEBAR_MODE_KEY, normalized);
        localStorage.setItem(LEGACY_SIDEBAR_KEY, String(normalized !== "expanded"));
      } catch {}
    }

    updateNavigationButton();
  }

  function updateNavigationButton() {
    if (isMobile()) {
      const open = body.classList.contains("menu-open");
      navToggle.textContent = open ? "×" : "☰";
      navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      navToggle.setAttribute("aria-expanded", String(open));
      return;
    }

    const mode = desktopSidebarMode();
    navToggle.textContent = mode === "expanded" ? "‹" : mode === "rail" ? "×" : "☰";
    navToggle.setAttribute(
      "aria-label",
      mode === "expanded"
        ? "Collapse navigation to icon rail"
        : mode === "rail"
          ? "Hide navigation"
          : "Show navigation"
    );
    navToggle.setAttribute("aria-expanded", String(mode !== "hidden"));
  }

  function toggleNavigation() {
    if (isMobile()) {
      body.classList.toggle("menu-open");
      updateNavigationButton();
      return;
    }

    const mode = desktopSidebarMode();
    setDesktopSidebarMode(
      mode === "expanded" ? "rail" : mode === "rail" ? "hidden" : "expanded",
      true
    );
  }

  navToggle.addEventListener("click", toggleNavigation);
  mobileSidebarClose?.addEventListener("click", () => {
    body.classList.remove("menu-open");
    updateNavigationButton();
  });
  mobileOverlay?.addEventListener("click", () => {
    body.classList.remove("menu-open");
    updateNavigationButton();
  });

  function hostLabel(value) {
    try {
      const parsed = new URL(
        /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(String(value).trim())
          ? String(value).trim()
          : `https://${String(value).trim()}`
      );
      return parsed.hostname.replace(/^www\./, "") || "Manual stream";
    } catch {
      return "Manual stream";
    }
  }

  function normalizeUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) throw new Error("Enter a stream URL first.");

    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only HTTP or HTTPS URLs can be used.");
    }

    return parsed.href;
  }

  function playerUrl(source) {
    const url = new URL("player.html", window.location.href);
    url.searchParams.set("shell", "1");
    url.searchParams.set("multiview", "1");

    if (source.type === "event") {
      url.searchParams.set("event", source.id);
    } else {
      url.searchParams.set("watch", source.url);
    }

    return url.href;
  }

  function soloUrl(source) {
    const url = new URL("index.html", window.location.href);

    if (source.type === "event") {
      url.searchParams.set("event", source.id);
    } else {
      url.searchParams.set("watch", source.url);
    }

    return url.href;
  }

  function emptyMarkup(slot) {
    return `
      <div class="mv-empty">
        <div class="mv-empty-card">
          <span class="mv-empty-icon" aria-hidden="true">＋</span>
          <strong>Add stream ${slot + 1}</strong>
          <p>Pick an EastCoin event or paste any URL you would normally use in Live Player.</p>
          <div class="mv-empty-actions">
            <button type="button" data-empty-event>Choose Event</button>
            <button type="button" data-empty-url>Paste URL</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSlot(slot) {
    const panel = panels[slot];
    if (!panel) return;

    const source = state.slots[slot];
    const title = panel.querySelector("[data-panel-title]");
    const bodyEl = panel.querySelector("[data-panel-body]");

    panel.classList.toggle("is-loaded", Boolean(source));
    title.textContent = source?.title || `Stream ${slot + 1}`;

    if (!source) {
      if (bodyEl.dataset.renderedType !== "empty") {
        bodyEl.dataset.renderedType = "empty";
        bodyEl.innerHTML = emptyMarkup(slot);

        bodyEl.querySelector("[data-empty-event]")?.addEventListener("click", () => {
          openSourcePicker(slot, "events");
        });

        bodyEl.querySelector("[data-empty-url]")?.addEventListener("click", () => {
          openSourcePicker(slot, "url");
        });
      }
      return;
    }

    const nextUrl = playerUrl(source);
    const existing = bodyEl.querySelector(".mv-player-frame");

    if (existing && existing.dataset.playerUrl === nextUrl) {
      return;
    }

    bodyEl.dataset.renderedType = source.type;
    bodyEl.innerHTML = "";

    const frame = document.createElement("iframe");
    frame.className = "mv-player-frame";
    frame.dataset.playerUrl = nextUrl;
    frame.src = nextUrl;
    frame.title = source.title || `MultiView stream ${slot + 1}`;
    frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    bodyEl.appendChild(frame);
  }

  function visiblePanelCount() {
    return state.layout;
  }

  function updateStatus() {
    if (!statusText) return;

    const loadedVisible = state.slots
      .slice(0, state.layout)
      .filter(Boolean)
      .length;

    statusText.textContent =
      `${loadedVisible}/${state.layout} visible panels loaded · ` +
      "Each panel keeps the normal EastCoin player and server selector.";
  }

  function setLayout(count, save = true) {
    const layout = VALID_LAYOUTS.has(Number(count)) ? Number(count) : DEFAULT_LAYOUT;
    state.layout = layout;

    grid.classList.remove("layout-2", "layout-3", "layout-4");
    grid.classList.add(`layout-${layout}`);

    document.querySelectorAll("[data-layout-count]").forEach((button) => {
      const active = Number(button.dataset.layoutCount) === layout;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    panels.forEach((panel, index) => {
      panel.hidden = index >= layout;
    });

    if (focusedSlot !== null && focusedSlot >= layout) {
      clearFocus();
    }

    if (save) {
      saveState();
    }

    updateStatus();
  }

  document.querySelectorAll("[data-layout-count]").forEach((button) => {
    button.addEventListener("click", () => {
      setLayout(Number(button.dataset.layoutCount));
    });
  });

  function setSource(slot, source) {
    state.slots[slot] = source;
    saveState();
    renderSlot(slot);
    updateStatus();
  }

  function removeSource(slot) {
    state.slots[slot] = null;
    saveState();

    if (focusedSlot === slot) {
      clearFocus();
    }

    renderSlot(slot);
    updateStatus();
  }

  function clearFocus() {
    focusedSlot = null;
    grid.classList.remove("is-focus");
    panels.forEach((panel) => panel.classList.remove("is-focused"));
    panels.forEach((panel) => {
      const button = panel.querySelector("[data-panel-focus]");
      if (button) button.textContent = "Focus";
    });
  }

  function toggleFocus(slot) {
    if (focusedSlot === slot) {
      clearFocus();
      return;
    }

    focusedSlot = slot;
    grid.classList.add("is-focus");

    panels.forEach((panel, index) => {
      const focused = index === slot;
      panel.classList.toggle("is-focused", focused);
      const button = panel.querySelector("[data-panel-focus]");
      if (button) button.textContent = focused ? "Grid" : "Focus";
    });
  }

  panels.forEach((panel, slot) => {
    panel.querySelector("[data-panel-replace]")?.addEventListener("click", () => {
      openSourcePicker(slot, "events");
    });

    panel.querySelector("[data-panel-remove]")?.addEventListener("click", () => {
      removeSource(slot);
    });

    panel.querySelector("[data-panel-focus]")?.addEventListener("click", () => {
      if (state.slots[slot]) toggleFocus(slot);
    });

    panel.querySelector("[data-panel-solo]")?.addEventListener("click", () => {
      const source = state.slots[slot];
      if (source) window.location.href = soloUrl(source);
    });
  });

  clearButton.addEventListener("click", () => {
    if (!state.slots.some(Boolean)) {
      showToast("MultiView is already empty.");
      return;
    }

    if (!window.confirm("Clear all MultiView panels?")) return;

    state.slots = [null, null, null, null];
    saveState();
    clearFocus();
    panels.forEach((_, index) => renderSlot(index));
    updateStatus();
    showToast("MultiView cleared.");
  });

  function setSourceTab(tab) {
    sourceTab = tab === "url" ? "url" : "events";

    sourceTabs.forEach((button) => {
      const active = button.dataset.sourceTab === sourceTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    sourceViews.forEach((view) => {
      view.hidden = view.dataset.sourceView !== sourceTab;
    });

    if (sourceTab === "events") {
      ensureEvents();
      window.setTimeout(() => eventSearch.focus({ preventScroll: true }), 0);
    } else {
      urlError.textContent = "";
      window.setTimeout(() => urlInput.focus({ preventScroll: true }), 0);
    }
  }

  sourceTabs.forEach((button) => {
    button.addEventListener("click", () => setSourceTab(button.dataset.sourceTab));
  });

  function openSourcePicker(slot, tab = "events") {
    activeSlot = slot;
    sourceSlotNumber.textContent = String(slot + 1);
    sourceModal.hidden = false;
    sourceModal.setAttribute("aria-hidden", "false");
    body.classList.add("mv-modal-open");
    setSourceTab(tab);
  }

  function closeSourcePicker() {
    sourceModal.hidden = true;
    sourceModal.setAttribute("aria-hidden", "true");
    body.classList.remove("mv-modal-open");
    urlError.textContent = "";
  }

  sourceClose.addEventListener("click", closeSourcePicker);
  sourceModal.addEventListener("click", (event) => {
    if (event.target === sourceModal) closeSourcePicker();
  });

  function eventKey(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      `${match?.category || "event"}:${match?.title || ""}:${match?.date || ""}`
    );
  }

  function dedupeMatches(matches) {
    const unique = new Map();
    matches.forEach((match) => {
      const key = eventKey(match);
      if (key && !unique.has(key)) unique.set(key, match);
    });
    return Array.from(unique.values());
  }

  function eventTimestamp(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sportLabel(match) {
    const id = String(match?.category || "");
    return eventData.sports.get(id) || id || "Event";
  }

  function formatEventTime(match, live) {
    if (live) return "Live now";
    const time = eventTimestamp(match?.date);
    if (!time) return "Today";

    try {
      return new Date(time).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return "Today";
    }
  }

  function eventSearchText(match) {
    return [
      match?.title,
      match?.category,
      match?.teams?.home?.name,
      match?.teams?.away?.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function initials(value) {
    return String(value || "EC")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "EC";
  }

  function eventArt(match) {
    const poster = API?.posterUrl?.(match?.poster) || API?.matchupPosterUrl?.(match) || "";
    const fallback = initials(match?.title || match?.category);

    return poster
      ? `<span class="mv-event-art"><span class="mv-event-art-fallback">${escapeHtml(fallback)}</span><img data-mv-event-image src="${escapeAttr(poster)}" alt="" loading="lazy"></span>`
      : `<span class="mv-event-art"><span class="mv-event-art-fallback">${escapeHtml(fallback)}</span></span>`;
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

  function filteredEvents() {
    const source = eventMode === "today" ? eventData.today : eventData.live;
    const query = eventSearch.value.trim().toLowerCase();

    const filtered = query
      ? source.filter((match) => eventSearchText(match).includes(query))
      : source;

    return [...filtered].sort((left, right) => {
      const leftLive = eventData.liveIds.has(eventKey(left));
      const rightLive = eventData.liveIds.has(eventKey(right));
      const liveDifference = Number(rightLive) - Number(leftLive);
      if (liveDifference) return liveDifference;

      return eventTimestamp(left?.date) - eventTimestamp(right?.date);
    });
  }

  function renderEvents() {
    if (!eventsLoaded) return;

    const matches = filteredEvents();
    const modeLabel = eventMode === "today" ? "today" : "live";

    eventStatus.textContent = matches.length
      ? `${matches.length} ${modeLabel} event${matches.length === 1 ? "" : "s"} available.`
      : `No ${modeLabel} events match that search.`;

    if (!matches.length) {
      eventList.innerHTML = '<div class="mv-event-empty">No matching events are available right now.</div>';
      return;
    }

    eventList.innerHTML = matches
      .map((match) => {
        const id = eventKey(match);
        const live = eventData.liveIds.has(id);
        const meta = `${sportLabel(match)} · ${formatEventTime(match, live)}`;

        return `
          <button class="mv-event-option" type="button" data-event-id="${escapeAttr(id)}">
            ${eventArt(match)}
            <span class="mv-event-copy">
              <strong>${escapeHtml(match?.title || id)}</strong>
              <small>${escapeHtml(meta)}</small>
            </span>
            ${live ? '<span class="mv-event-live">LIVE</span>' : ""}
          </button>
        `;
      })
      .join("");

    eventList.querySelectorAll("[data-mv-event-image]").forEach((image) => {
      image.addEventListener(
        "error",
        () => image.remove(),
        { once: true }
      );
    });

    eventList.querySelectorAll("[data-event-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.eventId;
        const all = dedupeMatches([...eventData.live, ...eventData.today]);
        const match = all.find((candidate) => eventKey(candidate) === id);
        if (!match) return;

        const live = eventData.liveIds.has(id);
        const title = match?.title || id;
        const meta = `${sportLabel(match)} · ${formatEventTime(match, live)}`;

        setSource(activeSlot, {
          type: "event",
          id,
          title,
          meta
        });

        closeSourcePicker();
        showToast(`${title} added to panel ${activeSlot + 1}.`);
      });
    });
  }

  async function ensureEvents() {
    if (eventsLoaded || eventsLoading) {
      if (eventsLoaded) renderEvents();
      return;
    }

    if (!API) {
      eventStatus.textContent = "The EastCoin event API did not load.";
      return;
    }

    eventsLoading = true;
    eventStatus.textContent = "Loading events…";
    eventList.innerHTML = "";

    try {
      const discovery = await API.getDiscovery();
      const live = dedupeMatches(discovery.live.data || []);
      const today = dedupeMatches(discovery.today.data || []);

      eventData.live = live;
      eventData.today = dedupeMatches([...live, ...today]);
      eventData.liveIds = new Set(live.map(eventKey));

      eventData.sports = new Map(
        (discovery.sports.data || []).map((sport) => [
          String(sport?.id || sport?.slug || sport?.name || ""),
          String(sport?.name || sport?.title || sport?.id || "Event")
        ])
      );

      eventsLoaded = true;

      if (!live.length && eventData.today.length) {
        setEventMode("today");
      } else {
        renderEvents();
      }
    } catch (error) {
      eventStatus.textContent =
        error?.message || "Events could not be loaded right now.";
      eventList.innerHTML =
        '<div class="mv-event-empty">The event directory is temporarily unavailable. You can still use Paste URL.</div>';
    } finally {
      eventsLoading = false;
    }
  }

  function setEventMode(mode) {
    eventMode = mode === "today" ? "today" : "live";

    eventModeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.eventMode === eventMode);
    });

    renderEvents();
  }

  eventModeButtons.forEach((button) => {
    button.addEventListener("click", () => setEventMode(button.dataset.eventMode));
  });

  eventSearch.addEventListener("input", renderEvents);

  function addManualUrl() {
    urlError.textContent = "";

    let url;
    try {
      url = normalizeUrl(urlInput.value);
    } catch (error) {
      urlError.textContent = error.message || "Enter a valid URL.";
      return;
    }

    setSource(activeSlot, {
      type: "url",
      url,
      title: hostLabel(url),
      meta: "Manual URL"
    });

    urlInput.value = "";
    closeSourcePicker();
    showToast(`Stream added to panel ${activeSlot + 1}.`);
  }

  urlAdd.addEventListener("click", addManualUrl);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualUrl();
    }
  });

  function setChatOpen(open) {
    const enabled = Boolean(open);
    body.classList.toggle("mv-chat-open", enabled);
    chatDrawer.setAttribute("aria-hidden", String(!enabled));
    chatButton.setAttribute("aria-expanded", String(enabled));

    if (enabled && chatFrame.src === "about:blank") {
      chatFrame.src = chatFrame.dataset.src;
    }
  }

  chatButton.addEventListener("click", () => {
    setChatOpen(!body.classList.contains("mv-chat-open"));
  });
  chatClose.addEventListener("click", () => setChatOpen(false));

  function readReducedMotion() {
    try {
      return localStorage.getItem(REDUCED_MOTION_KEY) === "true";
    } catch {
      return false;
    }
  }

  function setReducedMotion(enabled, save = true) {
    document.documentElement.classList.toggle("ec-shell-reduced-motion", Boolean(enabled));
    body.classList.toggle("ec-shell-reduced-motion", Boolean(enabled));
    settingReducedMotion.checked = Boolean(enabled);

    if (save) {
      try {
        localStorage.setItem(REDUCED_MOTION_KEY, String(Boolean(enabled)));
      } catch {}
    }
  }

  function syncSettings() {
    settingCompactNav.checked = desktopSidebarMode() === "rail";
    settingReducedMotion.checked = readReducedMotion();
  }

  function openSettings() {
    syncSettings();
    settingsModal.hidden = false;
    settingsModal.setAttribute("aria-hidden", "false");
    settingsClose.focus({ preventScroll: true });
  }

  function closeSettings() {
    settingsModal.hidden = true;
    settingsModal.setAttribute("aria-hidden", "true");
    settingsButton.focus({ preventScroll: true });
  }

  settingsButton.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsDone.addEventListener("click", closeSettings);
  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) closeSettings();
  });

  settingCompactNav.addEventListener("change", () => {
    if (isMobile()) return;
    setDesktopSidebarMode(settingCompactNav.checked ? "rail" : "expanded", true);
  });

  settingReducedMotion.addEventListener("change", () => {
    setReducedMotion(settingReducedMotion.checked, true);
  });

  function initializeCountdown() {
    const kickoffTime = new Date("2026-09-09T19:20:00-05:00");

    document.querySelectorAll("[data-football-countdown]").forEach((countdown) => {
      const daysEl = countdown.querySelector("[data-countdown-days]");
      const hoursEl = countdown.querySelector("[data-countdown-hours]");
      const minutesEl = countdown.querySelector("[data-countdown-minutes]");
      const secondsEl = countdown.querySelector("[data-countdown-seconds]");
      const compactEl = countdown.querySelector("[data-countdown-compact]");
      const titleEl = countdown.querySelector(".football-countdown-title");
      const statusEl = countdown.querySelector(".football-countdown-live");

      const update = () => {
        const remaining = kickoffTime.getTime() - Date.now();

        if (remaining <= 0) {
          countdown.classList.add("is-live");
          titleEl.textContent = "Football is back";
          statusEl.textContent = "Live";
          compactEl.textContent = "LIVE";
          daysEl.textContent = "00";
          hoursEl.textContent = "00";
          minutesEl.textContent = "00";
          secondsEl.textContent = "00";
          return false;
        }

        const totalSeconds = Math.floor(remaining / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        daysEl.textContent = String(days);
        hoursEl.textContent = String(hours).padStart(2, "0");
        minutesEl.textContent = String(minutes).padStart(2, "0");
        secondsEl.textContent = String(seconds).padStart(2, "0");
        compactEl.textContent = days > 0
          ? `${days}d ${hours}h`
          : `${hours}h ${minutes}m`;
        return true;
      };

      update();
      const timer = window.setInterval(() => {
        if (!update()) window.clearInterval(timer);
      }, 1000);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (!sourceModal.hidden) {
      closeSourcePicker();
      return;
    }

    if (!settingsModal.hidden) {
      closeSettings();
      return;
    }

    if (body.classList.contains("mv-chat-open")) {
      setChatOpen(false);
      return;
    }

    if (focusedSlot !== null) {
      clearFocus();
      return;
    }

    if (body.classList.contains("menu-open")) {
      body.classList.remove("menu-open");
      updateNavigationButton();
    }
  });

  window.addEventListener("resize", () => {
    body.classList.remove("menu-open");
    updateNavigationButton();
  });

  let savedMode = "expanded";
  try {
    const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
    savedMode = ["expanded", "rail", "hidden"].includes(stored)
      ? stored
      : localStorage.getItem(LEGACY_SIDEBAR_KEY) === "true"
        ? "rail"
        : "expanded";
  } catch {}

  if (!isMobile()) {
    setDesktopSidebarMode(savedMode, false);
  } else {
    updateNavigationButton();
  }

  setReducedMotion(readReducedMotion(), false);
  initializeCountdown();
  setLayout(state.layout, false);
  panels.forEach((_, index) => renderSlot(index));
  updateStatus();
})();

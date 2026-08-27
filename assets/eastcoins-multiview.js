(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const STORAGE_KEY = "eastcoinMultiviewV1";
  const SIDEBAR_MODE_KEY = "eastcoinsSidebarMode";
  const LEGACY_SIDEBAR_KEY = "eastcoinsSidebarCollapsed";
  const REDUCED_MOTION_KEY = "eastcoinsReducedMotion";
  const CONTROLS_HIDDEN_KEY = "eastcoinMultiviewControlsHidden";
  const DEFAULT_LAYOUT = 4;
  const V2_EMBEDDED =
    new URLSearchParams(
      window.location.search
    ).get("ecV2Embedded") === "1";
  const VALID_LAYOUTS = new Set([2, 3, 4]);
  const DEFAULT_SPLITS = {
    2: { col: 50, row: 50 },
    3: { col: 65, row: 50 },
    4: { col: 50, row: 50 }
  };

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
  const controlsHideButton = document.getElementById("mvControlsHide");
  const controlsShowButton = document.getElementById("mvControlsShow");
  const controlsBar = document.getElementById("mvControlsBar");
  const toast = document.getElementById("mvToast");

  let toastTimer = 0;
  let activeSlot = 0;
  let sourceTab = "events";
  let eventMode = "live";
  let focusedSlot = null;
  let draggedSlot = null;
  let activeResize = null;
  let verticalResizer = null;
  let horizontalResizer = null;
  let diagonalResizer = null;
  let eventsLoaded = false;
  let eventsLoading = false;
  let eventData = {
    live: [],
    today: [],
    liveIds: new Set(),
    sports: new Map()
  };

  function defaultSplits() {
    return {
      2: { ...DEFAULT_SPLITS[2] },
      3: { ...DEFAULT_SPLITS[3] },
      4: { ...DEFAULT_SPLITS[4] }
    };
  }

  function normalizeSplit(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Math.min(75, Math.max(25, numeric))
      : fallback;
  }

  function normalizeSplits(raw) {
    const defaults = defaultSplits();

    [2, 3, 4].forEach((layout) => {
      defaults[layout] = {
        col: normalizeSplit(
          raw?.[layout]?.col ?? raw?.[String(layout)]?.col,
          DEFAULT_SPLITS[layout].col
        ),
        row: normalizeSplit(
          raw?.[layout]?.row ?? raw?.[String(layout)]?.row,
          DEFAULT_SPLITS[layout].row
        )
      };
    });

    /*
      The 3-panel layout is intentionally asymmetric: keep the main panel
      from becoming too narrow even if an older saved value is extreme.
    */
    defaults[3].col = Math.min(
      75,
      Math.max(45, defaults[3].col)
    );

    return defaults;
  }

  function blankState() {
    return {
      layout: DEFAULT_LAYOUT,
      slots: [null, null, null, null],
      splits: defaultSplits()
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
            try {
              const normalizedUrl = normalizeUrl(source.url);

              return {
                type: "url",
                url: normalizedUrl,
                eventId: String(
                  source.eventId || ""
                ),
                title: String(
                  source.title ||
                  hostLabel(
                    normalizedUrl
                  )
                ),
                meta: String(
                  source.meta ||
                  "Manual URL"
                )
              };
            } catch {
              return null;
            }
          }

          return null;
        }),
        splits: normalizeSplits(raw.splits)
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

  function readControlsHidden() {
    try {
      return localStorage.getItem(CONTROLS_HIDDEN_KEY) === "true";
    } catch {
      return false;
    }
  }

  function setControlsHidden(hidden, save = true) {
    const shouldHide = Boolean(hidden);

    body.classList.toggle("mv-controls-hidden", shouldHide);

    if (controlsBar) {
      controlsBar.setAttribute(
        "aria-hidden",
        String(shouldHide)
      );
    }

    if (controlsShowButton) {
      controlsShowButton.hidden = !shouldHide;
      controlsShowButton.setAttribute(
        "aria-expanded",
        String(!shouldHide)
      );
    }

    if (controlsHideButton) {
      controlsHideButton.setAttribute(
        "aria-expanded",
        String(!shouldHide)
      );
    }

    if (save) {
      try {
        localStorage.setItem(
          CONTROLS_HIDDEN_KEY,
          String(shouldHide)
        );
      } catch {}
    }
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

    const localDevelopment =
      ["localhost", "127.0.0.1", "::1"].includes(
        window.location.hostname
      );

    if (
      parsed.protocol === "http:" &&
      !localDevelopment
    ) {
      throw new Error(
        "Use an HTTPS stream URL on EastCoin. HTTP is only allowed during local development."
      );
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
    const dragHandle = panel.querySelector(".mv-panel-title");

    panel.classList.toggle("is-loaded", Boolean(source));
    title.textContent = source?.title || `Stream ${slot + 1}`;

    if (dragHandle) {
      dragHandle.draggable = Boolean(source) && !isMobile();
      dragHandle.setAttribute(
        "title",
        source
          ? "Drag this title to move the stream to another panel"
          : "Add a stream before reordering this panel"
      );
      dragHandle.setAttribute(
        "aria-label",
        source
          ? `Drag ${source.title || `Stream ${slot + 1}`} to reorder MultiView`
          : `Empty MultiView panel ${slot + 1}`
      );
    }

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

  function splitForLayout(layout = state.layout) {
    state.splits = normalizeSplits(state.splits);
    return state.splits[layout];
  }

  function applyGridSplits() {
    const split = splitForLayout();

    grid.style.setProperty(
      "--mv-col-split",
      `${split.col}%`
    );
    grid.style.setProperty(
      "--mv-row-split",
      `${split.row}%`
    );

    verticalResizer?.setAttribute(
      "aria-valuenow",
      String(Math.round(split.col))
    );
    horizontalResizer?.setAttribute(
      "aria-valuenow",
      String(Math.round(split.row))
    );

    diagonalResizer?.setAttribute(
      "aria-valuetext",
      `Player 1 width ${Math.round(split.col)} percent, height ${Math.round(split.row)} percent`
    );
  }

  function setSplit(axis, value, save = false) {
    const split = splitForLayout();
    const minimum =
      axis === "col" && state.layout === 3
        ? 45
        : 25;
    const next = Math.min(
      75,
      Math.max(minimum, Number(value))
    );

    if (!Number.isFinite(next)) return;

    split[axis] = next;
    applyGridSplits();

    if (save) {
      saveState();
    }
  }

  function resetSplit(axis) {
    const fallback = DEFAULT_SPLITS[state.layout][axis];
    setSplit(axis, fallback, true);
    showToast(
      axis === "col"
        ? "Panel widths reset."
        : "Panel heights reset."
    );
  }

  function resetDiagonalSplit() {
    state.splits[4] = {
      ...DEFAULT_SPLITS[4]
    };
    applyGridSplits();
    saveState();
    showToast("Player 1 size reset.");
  }

  function finishGridResize() {
    if (!activeResize) return;

    activeResize.element?.classList.remove("is-active");
    body.classList.remove(
      "mv-grid-resizing",
      "mv-grid-resizing-col",
      "mv-grid-resizing-row",
      "mv-grid-resizing-both"
    );

    activeResize = null;
    saveState();
  }

  function updateGridResize(clientX, clientY) {
    if (!activeResize) return;

    const rect = grid.getBoundingClientRect();

    if (activeResize.axis === "col") {
      const percent =
        ((clientX - rect.left) / rect.width) * 100;
      setSplit("col", percent, false);
      return;
    }

    if (activeResize.axis === "both") {
      const columnPercent =
        ((clientX - rect.left) / rect.width) * 100;
      const rowPercent =
        ((clientY - rect.top) / rect.height) * 100;

      setSplit("col", columnPercent, false);
      setSplit("row", rowPercent, false);
      return;
    }

    const percent =
      ((clientY - rect.top) / rect.height) * 100;
    setSplit("row", percent, false);
  }

  function startGridResize(axis, event, element) {
    if (
      isMobile() ||
      focusedSlot !== null ||
      (axis === "both" && state.layout !== 4)
    ) {
      return;
    }

    event.preventDefault();

    activeResize = {
      axis,
      element,
      pointerId: event.pointerId
    };

    element.classList.add("is-active");
    element.setPointerCapture?.(event.pointerId);

    body.classList.add("mv-grid-resizing");

    body.classList.add(
      axis === "col"
        ? "mv-grid-resizing-col"
        : axis === "row"
          ? "mv-grid-resizing-row"
          : "mv-grid-resizing-both"
    );

    updateGridResize(
      event.clientX,
      event.clientY
    );
  }

  function createGridResizers() {
    verticalResizer = document.createElement("button");
    verticalResizer.type = "button";
    verticalResizer.className =
      "mv-grid-resizer mv-grid-resizer-vertical";
    verticalResizer.setAttribute(
      "aria-label",
      "Resize MultiView panel widths"
    );
    verticalResizer.setAttribute(
      "aria-orientation",
      "vertical"
    );
    verticalResizer.setAttribute(
      "aria-valuemin",
      state.layout === 3 ? "45" : "25"
    );
    verticalResizer.setAttribute(
      "aria-valuemax",
      "75"
    );
    verticalResizer.title =
      "Drag to resize panel widths · double-click to reset";

    horizontalResizer = document.createElement("button");
    horizontalResizer.type = "button";
    horizontalResizer.className =
      "mv-grid-resizer mv-grid-resizer-horizontal";
    horizontalResizer.setAttribute(
      "aria-label",
      "Resize MultiView panel heights"
    );
    horizontalResizer.setAttribute(
      "aria-orientation",
      "horizontal"
    );
    horizontalResizer.setAttribute(
      "aria-valuemin",
      "25"
    );
    horizontalResizer.setAttribute(
      "aria-valuemax",
      "75"
    );
    horizontalResizer.title =
      "Drag to resize panel heights · double-click to reset";

    diagonalResizer = document.createElement("button");
    diagonalResizer.type = "button";
    diagonalResizer.className =
      "mv-grid-resizer mv-grid-resizer-diagonal";
    diagonalResizer.innerHTML =
      '<span aria-hidden="true">↘</span>';
    diagonalResizer.setAttribute(
      "aria-label",
      "Resize Player 1 width and height"
    );
    diagonalResizer.title =
      "Drag down-right to make Player 1 larger · double-click to reset";

    grid.append(
      verticalResizer,
      horizontalResizer,
      diagonalResizer
    );

    verticalResizer.addEventListener(
      "pointerdown",
      (event) =>
        startGridResize(
          "col",
          event,
          verticalResizer
        )
    );

    horizontalResizer.addEventListener(
      "pointerdown",
      (event) =>
        startGridResize(
          "row",
          event,
          horizontalResizer
        )
    );

    diagonalResizer.addEventListener(
      "pointerdown",
      (event) =>
        startGridResize(
          "both",
          event,
          diagonalResizer
        )
    );

    [
      verticalResizer,
      horizontalResizer,
      diagonalResizer
    ].forEach(
      (resizer) => {
        resizer.addEventListener(
          "pointermove",
          (event) => {
            if (
              !activeResize ||
              activeResize.pointerId !==
                event.pointerId
            ) {
              return;
            }

            updateGridResize(
              event.clientX,
              event.clientY
            );
          }
        );

        resizer.addEventListener(
          "pointerup",
          finishGridResize
        );
        resizer.addEventListener(
          "pointercancel",
          finishGridResize
        );
      }
    );

    verticalResizer.addEventListener(
      "dblclick",
      () => resetSplit("col")
    );
    horizontalResizer.addEventListener(
      "dblclick",
      () => resetSplit("row")
    );

    diagonalResizer.addEventListener(
      "dblclick",
      resetDiagonalSplit
    );

    verticalResizer.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "ArrowLeft" &&
          event.key !== "ArrowRight"
        ) {
          return;
        }

        event.preventDefault();
        setSplit(
          "col",
          splitForLayout().col +
            (event.key === "ArrowRight" ? 2 : -2),
          true
        );
      }
    );

    horizontalResizer.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "ArrowUp" &&
          event.key !== "ArrowDown"
        ) {
          return;
        }

        event.preventDefault();
        setSplit(
          "row",
          splitForLayout().row +
            (event.key === "ArrowDown" ? 2 : -2),
          true
        );
      }
    );

    diagonalResizer.addEventListener(
      "keydown",
      (event) => {
        if (state.layout !== 4) {
          return;
        }

        if (
          ![
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown"
          ].includes(event.key)
        ) {
          return;
        }

        event.preventDefault();

        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight"
        ) {
          setSplit(
            "col",
            splitForLayout().col +
              (event.key === "ArrowRight" ? 2 : -2),
            true
          );
        } else {
          setSplit(
            "row",
            splitForLayout().row +
              (event.key === "ArrowDown" ? 2 : -2),
            true
          );
        }
      }
    );

    applyGridSplits();
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

    verticalResizer?.setAttribute(
      "aria-valuemin",
      layout === 3 ? "45" : "25"
    );
    applyGridSplits();

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

  function clearDragState() {
    draggedSlot = null;

    panels.forEach((panel) => {
      panel.classList.remove(
        "is-dragging",
        "is-drop-target"
      );
    });
  }

  function swapPanelSources(fromSlot, toSlot) {
    if (
      fromSlot === toSlot ||
      fromSlot == null ||
      toSlot == null
    ) {
      return;
    }

    const fromSource = state.slots[fromSlot];
    const toSource = state.slots[toSlot];

    if (!fromSource) return;

    state.slots[fromSlot] = toSource;
    state.slots[toSlot] = fromSource;

    if (focusedSlot !== null) {
      clearFocus();
    }

    saveState();
    renderSlot(fromSlot);
    renderSlot(toSlot);
    updateStatus();

    showToast(
      toSource
        ? `Swapped panels ${fromSlot + 1} and ${toSlot + 1}.`
        : `Moved stream to panel ${toSlot + 1}.`
    );
  }

  panels.forEach((panel, slot) => {
    const dragHandle =
      panel.querySelector(".mv-panel-title");

    dragHandle?.addEventListener(
      "dragstart",
      (event) => {
        if (!state.slots[slot]) {
          event.preventDefault();
          return;
        }

        draggedSlot = slot;
        panel.classList.add("is-dragging");

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            String(slot)
          );
        }
      }
    );

    dragHandle?.addEventListener(
      "dragend",
      clearDragState
    );

    panel.addEventListener(
      "dragover",
      (event) => {
        if (
          draggedSlot == null ||
          draggedSlot === slot
        ) {
          return;
        }

        event.preventDefault();

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }

        panels.forEach((candidate, index) => {
          candidate.classList.toggle(
            "is-drop-target",
            index === slot
          );
        });
      }
    );

    panel.addEventListener(
      "dragleave",
      (event) => {
        if (
          !panel.contains(event.relatedTarget)
        ) {
          panel.classList.remove(
            "is-drop-target"
          );
        }
      }
    );

    panel.addEventListener(
      "drop",
      (event) => {
        event.preventDefault();

        const sourceSlot =
          draggedSlot ??
          Number(
            event.dataTransfer?.getData(
              "text/plain"
            )
          );

        swapPanelSources(
          Number(sourceSlot),
          slot
        );
        clearDragState();
      }
    );
  });

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
      if (!source) return;

      if (
        V2_EMBEDDED &&
        window.parent !== window
      ) {
        window.parent.postMessage(
          {
            type: "ec-v2-multiview-solo",
            source
          },
          window.location.origin
        );
        return;
      }

      window.location.href = soloUrl(source);
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

  controlsHideButton?.addEventListener("click", () => {
    setControlsHidden(true, true);
  });

  controlsShowButton?.addEventListener("click", () => {
    setControlsHidden(false, true);
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
    /*
      V2 already owns one persistent Twitch chat iframe outside this document.
      Never mount or reserve a second chat drawer when MultiView is embedded.
    */
    if (V2_EMBEDDED) {
      body.classList.remove("mv-chat-open");
      chatDrawer?.setAttribute(
        "aria-hidden",
        "true"
      );
      chatButton?.setAttribute(
        "aria-expanded",
        "false"
      );
      return;
    }

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

    if (activeResize) {
      finishGridResize();
      return;
    }

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
    finishGridResize();
    applyGridSplits();
    panels.forEach((_, index) =>
      renderSlot(index)
    );
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

  if (V2_EMBEDDED) {
    /*
      The parent V2 shell owns navigation. Keep the standalone sidebar state
      completely out of layout calculations and do not overwrite its saved mode.
    */
    body.classList.add(
      "sidebar-hidden"
    );
    body.classList.remove(
      "sidebar-collapsed",
      "menu-open",
      "mv-chat-open"
    );
    updateNavigationButton();
  } else if (!isMobile()) {
    setDesktopSidebarMode(savedMode, false);
  } else {
    updateNavigationButton();
  }

  setReducedMotion(readReducedMotion(), false);
  setControlsHidden(readControlsHidden(), false);
  createGridResizers();
  setLayout(state.layout, false);
  panels.forEach((_, index) => renderSlot(index));
  updateStatus();

  const unifiedOmni = document.getElementById("mvUnifiedOmni");
  const unifiedOmniInput = document.getElementById("mvUnifiedOmniInput");
  const unifiedOmniAction = document.getElementById("mvUnifiedOmniAction");
  const unifiedOmniHint = document.getElementById("mvUnifiedOmniHint");
  const unifiedRailSearch = document.getElementById("mvUnifiedRailSearch");

  function unifiedLooksLikeUrl(value) {
    const trimmed = String(value || "").trim();
    return /^(https?:\/\/)/i.test(trimmed) ||
      /^[a-z0-9.-]+\.[a-z]{2,}(?:[\/:?#]|$)/i.test(trimmed);
  }

  function updateUnifiedOmni() {
    const urlMode = unifiedLooksLikeUrl(unifiedOmniInput?.value);
    unifiedOmni?.classList.toggle("is-url", urlMode);
    if (unifiedOmniAction) unifiedOmniAction.textContent = urlMode ? "Load" : "Search";
    if (unifiedOmniHint) unifiedOmniHint.textContent = urlMode
      ? "Press Enter to open this stream in EastCoin."
      : "Search teams, games and leagues — or paste a stream URL.";
  }

  unifiedOmniInput?.addEventListener("input", updateUnifiedOmni);
  unifiedOmni?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = String(unifiedOmniInput?.value || "").trim();
    if (!value) {
      window.location.href = "index.html";
      return;
    }
    if (unifiedLooksLikeUrl(value)) {
      try {
        const normalized = normalizeUrl(value);
        window.location.href = `index.html?watch=${encodeURIComponent(normalized)}`;
      } catch (error) {
        showToast(error?.message || "Enter a valid HTTPS stream URL.");
      }
      return;
    }
    window.location.href = `index.html?view=events&q=${encodeURIComponent(value)}`;
  });

  unifiedRailSearch?.addEventListener("click", () => {
    if (!isMobile()) setDesktopSidebarMode("expanded", true);
    window.setTimeout(() => unifiedOmniInput?.focus({ preventScroll: true }), 40);
  });

  updateUnifiedOmni();
})();

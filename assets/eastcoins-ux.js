
(() => {
  "use strict";

  const KEYS = {
    chatCollapsed: "eastcoinsChatCollapsed",
    sidebarCollapsed: "eastcoinsSidebarCollapsed",
    toolbarCollapsed: "eastcoinsPlayerToolbarCollapsed",
    soundEnabled: "eastcoinsSoundEnabled",
    reducedMotion: "eastcoinsReducedMotion",
    lastWatch: "eastcoinsLastWatch",
    lastActivity: "eastcoinsLastActivity",
    recentGames: "eastcoinsRecentGames"
  };

  const body = document.body;
  const playerShell = document.querySelector(".player-shell");
  const chatPanel = document.querySelector(".chat-panel");
  const resizeHandle = document.querySelector(".resize-handle");
  const playerToolbar = document.querySelector(".player-toolbar");
  const toolbarCollapseButton =
    document.getElementById("toolbarCollapseButton");

  let embedStatus = null;
  let watchedFrame = null;
  let loadTimer = null;
  let settingsModal = null;
  let theaterActive = false;

  function readBoolean(key, fallback) {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return value === "true";
  }

  function safeJsonRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function safeJsonWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function pageName() {
    return (
      window.location.pathname.split("/").pop() ||
      "index.html"
    ).toLowerCase();
  }

  function gameDefinitionForPage() {
    const page = pageName();
    const definitions = {
      "bonk.html": {
        name: "EastCoin Bonk",
        url: "bonk-game.html?v=trap10",
        icon: "🔨",
        wrapper: "bonk.html"
      },
      "aim-trainer.html": {
        name: "EastCoin Aim Trainer",
        url: "aim-trainer-game.html?v=ux1",
        icon: "🎯",
        wrapper: "aim-trainer.html"
      },
      "button-masher.html": {
        name: "EastCoin Button Masher",
        url: "button-masher-game.html?v=ux1",
        icon: "🟥",
        wrapper: "button-masher.html"
      }
    };

    return definitions[page] || null;
  }

  function applyReducedMotion(enabled) {
    document.documentElement.classList.toggle(
      "ec-reduced-motion",
      enabled
    );
    body.classList.toggle("ec-reduced-motion", enabled);
  }

  function setChatVisible(visible, save = true) {
    if (!chatPanel) {
      if (save) {
        localStorage.setItem(
          KEYS.chatCollapsed,
          String(!visible)
        );
      }
      updateChatButtons();
      return;
    }

    if (isMobile()) {
      body.classList.toggle("ec-chat-open", visible);
    } else {
      body.classList.toggle(
        "ec-chat-collapsed",
        !visible
      );
      body.classList.remove("ec-chat-open");
    }

    if (save) {
      localStorage.setItem(
        KEYS.chatCollapsed,
        String(!visible)
      );
    }

    updateChatButtons();
  }

  function chatIsVisible() {
    if (!chatPanel) {
      return !readBoolean(KEYS.chatCollapsed, false);
    }

    if (isMobile()) {
      return body.classList.contains("ec-chat-open");
    }

    return !body.classList.contains(
      "ec-chat-collapsed"
    );
  }

  function updateChatButtons() {
    const visible = chatIsVisible();

    document
      .querySelectorAll("[data-ec-chat-toggle]")
      .forEach((button) => {
        button.textContent = visible
          ? "💬 Hide chat"
          : "💬 Show chat";
        button.classList.toggle("is-active", visible);
        button.setAttribute(
          "aria-pressed",
          String(visible)
        );
      });

    const settingsChat =
      document.getElementById("ecSettingChat");

    if (settingsChat) {
      settingsChat.checked =
        !readBoolean(KEYS.chatCollapsed, false);
    }
  }

  function setTheaterMode(enabled) {
    theaterActive = enabled;
    document.documentElement.classList.toggle(
      "ec-theater-mode",
      enabled
    );
    body.classList.toggle("ec-theater-mode", enabled);
    body.classList.remove("ec-chat-open");

    document
      .querySelectorAll("[data-ec-theater-toggle]")
      .forEach((button) => {
        button.textContent = enabled
          ? "↙ Exit theater"
          : "⛶ Theater";
        button.classList.toggle("is-active", enabled);
        button.setAttribute(
          "aria-pressed",
          String(enabled)
        );
      });
  }

  function sendSettingsToFrames() {
    const message = {
      type: "eastcoin-settings",
      soundEnabled: readBoolean(
        KEYS.soundEnabled,
        true
      ),
      reducedMotion: readBoolean(
        KEYS.reducedMotion,
        false
      )
    };

    document.querySelectorAll("iframe").forEach((frame) => {
      try {
        frame.contentWindow.postMessage(message, "*");
      } catch {}
    });
  }

  function applyToolbarPreference(collapsed) {
    if (!playerToolbar) {
      return;
    }

    playerToolbar.classList.toggle(
      "collapsed",
      collapsed
    );

    if (toolbarCollapseButton) {
      toolbarCollapseButton.textContent = collapsed
        ? "Show controls ▼"
        : "Hide controls ▲";

      toolbarCollapseButton.setAttribute(
        "aria-expanded",
        String(!collapsed)
      );
    }
  }

  function applySidebarPreference(collapsed) {
    if (isMobile()) {
      return;
    }

    body.classList.toggle(
      "sidebar-collapsed",
      collapsed
    );

    const mobileMenu =
      document.getElementById("mobileMenu");
    const sidebarToggle =
      document.getElementById("sidebarToggle");

    const button = mobileMenu || sidebarToggle;

    if (button) {
      button.textContent = collapsed ? "☰" : "◀";
      button.setAttribute(
        "aria-label",
        collapsed
          ? "Show navigation"
          : "Hide navigation"
      );
      button.setAttribute(
        "aria-expanded",
        String(!collapsed)
      );
    }
  }

  function showSettings() {
    if (!settingsModal) {
      return;
    }

    syncSettingsInputs();
    settingsModal.classList.add("is-open");
    settingsModal.setAttribute(
      "aria-hidden",
      "false"
    );

    const closeButton =
      settingsModal.querySelector(".ec-settings-close");

    closeButton?.focus();
  }

  function hideSettings() {
    if (!settingsModal) {
      return;
    }

    settingsModal.classList.remove("is-open");
    settingsModal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function syncSettingsInputs() {
    const mappings = {
      ecSettingSound: readBoolean(
        KEYS.soundEnabled,
        true
      ),
      ecSettingChat: !readBoolean(
        KEYS.chatCollapsed,
        false
      ),
      ecSettingMotion: readBoolean(
        KEYS.reducedMotion,
        false
      ),
      ecSettingSidebar: readBoolean(
        KEYS.sidebarCollapsed,
        false
      ),
      ecSettingControls: readBoolean(
        KEYS.toolbarCollapsed,
        false
      )
    };

    Object.entries(mappings).forEach(
      ([id, checked]) => {
        const input = document.getElementById(id);

        if (input) {
          input.checked = checked;
        }
      }
    );
  }

  function buildSettingsModal() {
    settingsModal = document.createElement("div");
    settingsModal.className = "ec-settings-modal";
    settingsModal.id = "ecSettingsModal";
    settingsModal.setAttribute("aria-hidden", "true");

    settingsModal.innerHTML = `
      <section
        class="ec-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ecSettingsTitle">
        <header class="ec-settings-header">
          <div>
            <div class="ec-settings-kicker">
              EastCoin preferences
            </div>
            <h2 id="ecSettingsTitle">Settings</h2>
          </div>

          <button
            class="ec-settings-close"
            type="button"
            aria-label="Close settings">
            ×
          </button>
        </header>

        <div class="ec-settings-list">
          <label class="ec-setting-row">
            <span class="ec-setting-copy">
              <strong>Game sounds</strong>
              <span>
                Enable countdowns, hits, jackpots, and event sounds.
              </span>
            </span>
            <span class="ec-switch">
              <input id="ecSettingSound" type="checkbox">
              <span class="ec-switch-track"></span>
            </span>
          </label>

          <label class="ec-setting-row">
            <span class="ec-setting-copy">
              <strong>Show Twitch chat</strong>
              <span>
                Keep chat visible on desktop or available as a mobile drawer.
              </span>
            </span>
            <span class="ec-switch">
              <input id="ecSettingChat" type="checkbox">
              <span class="ec-switch-track"></span>
            </span>
          </label>

          <label class="ec-setting-row">
            <span class="ec-setting-copy">
              <strong>Reduce motion</strong>
              <span>
                Minimize interface and game animation effects.
              </span>
            </span>
            <span class="ec-switch">
              <input id="ecSettingMotion" type="checkbox">
              <span class="ec-switch-track"></span>
            </span>
          </label>

          <label class="ec-setting-row">
            <span class="ec-setting-copy">
              <strong>Start with navigation collapsed</strong>
              <span>
                Give the player more room whenever EastCoin opens.
              </span>
            </span>
            <span class="ec-switch">
              <input id="ecSettingSidebar" type="checkbox">
              <span class="ec-switch-track"></span>
            </span>
          </label>

          <label class="ec-setting-row">
            <span class="ec-setting-copy">
              <strong>Keep player controls hidden</strong>
              <span>
                Start embedded videos and games with the top controls collapsed.
              </span>
            </span>
            <span class="ec-switch">
              <input id="ecSettingControls" type="checkbox">
              <span class="ec-switch-track"></span>
            </span>
          </label>
        </div>

        <footer class="ec-settings-footer">
          <button
            class="ec-settings-action danger"
            id="ecResetSettings"
            type="button">
            Reset interface preferences
          </button>

          <button
            class="ec-settings-action"
            id="ecDoneSettings"
            type="button">
            Done
          </button>
        </footer>
      </section>
    `;

    document.body.appendChild(settingsModal);

    settingsModal
      .querySelector(".ec-settings-close")
      .addEventListener("click", hideSettings);

    document
      .getElementById("ecDoneSettings")
      .addEventListener("click", hideSettings);

    settingsModal.addEventListener("click", (event) => {
      if (event.target === settingsModal) {
        hideSettings();
      }
    });

    document
      .getElementById("ecSettingSound")
      .addEventListener("change", (event) => {
        localStorage.setItem(
          KEYS.soundEnabled,
          String(event.target.checked)
        );
        sendSettingsToFrames();
      });

    document
      .getElementById("ecSettingChat")
      .addEventListener("change", (event) => {
        setChatVisible(event.target.checked, true);
      });

    document
      .getElementById("ecSettingMotion")
      .addEventListener("change", (event) => {
        localStorage.setItem(
          KEYS.reducedMotion,
          String(event.target.checked)
        );
        applyReducedMotion(event.target.checked);
        sendSettingsToFrames();
      });

    document
      .getElementById("ecSettingSidebar")
      .addEventListener("change", (event) => {
        localStorage.setItem(
          KEYS.sidebarCollapsed,
          String(event.target.checked)
        );
        applySidebarPreference(event.target.checked);
      });

    document
      .getElementById("ecSettingControls")
      .addEventListener("change", (event) => {
        localStorage.setItem(
          KEYS.toolbarCollapsed,
          String(event.target.checked)
        );
        applyToolbarPreference(event.target.checked);
      });

    document
      .getElementById("ecResetSettings")
      .addEventListener("click", () => {
        [
          KEYS.chatCollapsed,
          KEYS.sidebarCollapsed,
          KEYS.toolbarCollapsed,
          KEYS.soundEnabled,
          KEYS.reducedMotion,
          "eastcoinsChatWidthV2",
          "eastcoinsChatWidth"
        ].forEach((key) => localStorage.removeItem(key));

        applyReducedMotion(false);
        setChatVisible(true, false);
        applySidebarPreference(false);
        applyToolbarPreference(false);
        syncSettingsInputs();
        sendSettingsToFrames();
      });
  }

  function buildUtilityDock() {
    if (!playerShell) {
      const button = document.createElement("button");
      button.className = "ec-settings-only-button";
      button.type = "button";
      button.setAttribute("aria-label", "Open settings");
      button.textContent = "⚙";
      button.addEventListener("click", showSettings);
      document.body.appendChild(button);
      return;
    }

    const dock = document.createElement("div");
    dock.className = "ec-utility-dock";
    dock.setAttribute(
      "aria-label",
      "Player display controls"
    );

    dock.innerHTML = `
      <button
        class="ec-utility-button"
        type="button"
        data-ec-theater-toggle
        aria-pressed="false">
        ⛶ Theater
      </button>

      <button
        class="ec-utility-button"
        type="button"
        data-ec-chat-toggle
        aria-pressed="true">
        💬 Hide chat
      </button>
      <button
        class="ec-utility-button"
        type="button"
        data-ec-settings>
        ⚙ Settings
      </button>
    `;

    playerShell.appendChild(dock);

    dock
      .querySelector("[data-ec-theater-toggle]")
      .addEventListener("click", () => {
        setTheaterMode(!theaterActive);
      });

    dock
      .querySelector("[data-ec-chat-toggle]")
      .addEventListener("click", () => {
        setChatVisible(!chatIsVisible(), true);
      });
    dock
      .querySelector("[data-ec-settings]")
      .addEventListener("click", showSettings);

    updateChatButtons();
  }

  function buildChatScrim() {
    if (!chatPanel) {
      return;
    }

    const scrim = document.createElement("button");
    scrim.className = "ec-chat-scrim";
    scrim.type = "button";
    scrim.setAttribute("aria-label", "Close Twitch chat");
    scrim.addEventListener("click", () => {
      body.classList.remove("ec-chat-open");
      updateChatButtons();
    });
    document.body.appendChild(scrim);
  }

  function buildEmbedStatus() {
    if (!playerShell) {
      return;
    }

    embedStatus = document.createElement("div");
    embedStatus.className = "ec-embed-status";
    embedStatus.hidden = true;

    embedStatus.innerHTML = `
      <div class="ec-embed-status-card">
        <div class="ec-embed-spinner" aria-hidden="true"></div>
        <strong class="ec-embed-status-title">
          Loading…
        </strong>
        <p class="ec-embed-status-message">
          Preparing the embedded player.
        </p>
        <div class="ec-embed-status-actions">
          <button
            class="ec-embed-action primary"
            type="button"
            data-ec-retry>
            Try again
          </button>
          <button
            class="ec-embed-action"
            type="button"
            data-ec-open>
            Open directly ↗
          </button>
          <button
            class="ec-embed-action"
            type="button"
            data-ec-back>
            Go back
          </button>
        </div>
      </div>
    `;

    playerShell.appendChild(embedStatus);

    embedStatus
      .querySelector("[data-ec-retry]")
      .addEventListener("click", retryActiveFrame);

    embedStatus
      .querySelector("[data-ec-open]")
      .addEventListener("click", openActiveFrame);

    embedStatus
      .querySelector("[data-ec-back]")
      .addEventListener("click", returnFromFrame);
  }

  function showEmbedLoading(title = "Loading…") {
    if (!embedStatus) {
      return;
    }

    embedStatus.hidden = false;
    embedStatus.classList.remove("is-trouble");
    embedStatus.querySelector(
      ".ec-embed-status-title"
    ).textContent = title;
    embedStatus.querySelector(
      ".ec-embed-status-message"
    ).textContent =
      "Preparing the embedded player. This normally takes only a moment.";
  }

  function showEmbedTrouble(title, message) {
    if (!embedStatus) {
      return;
    }

    embedStatus.hidden = false;
    embedStatus.classList.add("is-trouble");
    embedStatus.querySelector(
      ".ec-embed-status-title"
    ).textContent = title;
    embedStatus.querySelector(
      ".ec-embed-status-message"
    ).textContent = message;
  }

  function hideEmbedStatus() {
    if (!embedStatus) {
      return;
    }

    embedStatus.hidden = true;
    embedStatus.classList.remove("is-trouble");
  }

  function activeFrame() {
    return (
      playerShell?.querySelector(
        "iframe:not(.twitch-chat-frame)"
      ) || null
    );
  }

  function retryActiveFrame() {
    const frame = activeFrame();

    if (!frame) {
      return;
    }

    showEmbedLoading("Trying again…");

    if (frame.srcdoc) {
      const source = frame.srcdoc;
      frame.srcdoc = "";
      requestAnimationFrame(() => {
        frame.srcdoc = source;
      });
      return;
    }

    const source = frame.getAttribute("src");

    if (source) {
      frame.setAttribute("src", source);
    }
  }

  function directUrlForFrame(frame) {
    const definition = gameDefinitionForPage();

    if (definition) {
      return new URL(
        definition.url,
        window.location.href
      ).href;
    }

    const source = frame?.getAttribute("src");

    if (
      source &&
      source !== "about:blank" &&
      !source.startsWith("javascript:")
    ) {
      return new URL(source, window.location.href).href;
    }

    return "";
  }

  function openActiveFrame() {
    const frame = activeFrame();
    const directUrl = directUrlForFrame(frame);

    if (directUrl) {
      window.open(
        directUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }

  function returnFromFrame() {
    const changeButton =
      document.getElementById("changeButton");

    if (changeButton) {
      hideEmbedStatus();
      changeButton.click();
      return;
    }

    window.location.href = "games.html?new=1";
  }

  function rememberGame(game) {
    if (!game?.url || !game?.name) {
      return;
    }

    const recent = safeJsonRead(KEYS.recentGames, []);
    const deduped = recent.filter(
      (item) =>
        item.url !== game.url &&
        item.name !== game.name
    );

    deduped.unshift({
      ...game,
      playedAt: new Date().toISOString()
    });

    safeJsonWrite(
      KEYS.recentGames,
      deduped.slice(0, 6)
    );

    safeJsonWrite(KEYS.lastActivity, {
      type: "game",
      ...game,
      updatedAt: new Date().toISOString()
    });
  }

  function rememberFrame(frame) {
    if (!frame) {
      return;
    }

    const page = pageName();
    const definition = gameDefinitionForPage();

    if (definition) {
      rememberGame(definition);
      return;
    }

    /*
      Streamed events are remembered by event ID and server in
      eastcoins-streamed.js, so do not create a duplicate raw iframe card.
    */
    if (
      window.eastcoinStreamedState?.matchId
    ) {
      return;
    }

    const source = frame.getAttribute("src");

    if (
      !source ||
      source === "about:blank" ||
      source.startsWith("data:")
    ) {
      return;
    }

    const absoluteUrl = new URL(
      source,
      window.location.href
    ).href;

    if (page === "index.html" || page === "") {
      let host = "Last stream";

      try {
        host = new URL(absoluteUrl).hostname || host;
      } catch {}

      const watch = {
        url: absoluteUrl,
        name: host
      };

      safeJsonWrite(KEYS.lastWatch, watch);
      safeJsonWrite(KEYS.lastActivity, {
        type: "watch",
        ...watch,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    if (page === "games.html") {
      const currentHost =
        document.getElementById("currentHost");
      const rawName =
        currentHost?.textContent?.split("·")[0]?.trim() ||
        frame.title?.replace(/\s+game$/i, "") ||
        "Recent game";

      const icon =
        rawName.includes("Bonk")
          ? "🔨"
          : rawName.includes("Aim")
            ? "🎯"
            : rawName.includes("Masher")
              ? "🟥"
              : "🎮";

      rememberGame({
        name: rawName,
        url: source,
        icon
      });
    }
  }

  function watchFrame(frame) {
    if (!frame || frame === watchedFrame) {
      return;
    }

    watchedFrame = frame;
    clearTimeout(loadTimer);
    showEmbedLoading(
      frame.title
        ? `Loading ${frame.title}…`
        : "Loading player…"
    );

    const finish = () => {
      clearTimeout(loadTimer);
      rememberFrame(frame);
      sendSettingsToFrames();

      window.setTimeout(() => {
        hideEmbedStatus();
      }, 350);
    };

    frame.addEventListener("load", finish, {
      once: true
    });

    frame.addEventListener(
      "error",
      () => {
        clearTimeout(loadTimer);
        showEmbedTrouble(
          "Unable to load this embed",
          "Try loading it again or open the source directly in a new tab."
        );
      },
      { once: true }
    );

    loadTimer = window.setTimeout(() => {
      showEmbedTrouble(
        "This is taking longer than expected",
        "The provider may be slow or may block iframe embedding. You can retry or open it directly."
      );
    }, 9000);
  }

  function observeFrames() {
    if (!playerShell) {
      return;
    }

    const existing = activeFrame();

    if (existing) {
      watchFrame(existing);
    }

    const observer = new MutationObserver(() => {
      const frame = activeFrame();

      if (frame && frame !== watchedFrame) {
        watchFrame(frame);
      }
    });

    observer.observe(playerShell, {
      childList: true,
      subtree: true
    });
  }

  function buildContinueCards() {
    const urlCard = document.querySelector(".url-card");

    if (!urlCard) {
      return;
    }

    const streamedContinue =
      safeJsonRead(
        "eastcoinContinueStreamedEventV1",
        null
      );
    const lastWatch = streamedContinue
      ? null
      : safeJsonRead(KEYS.lastWatch, null);
    const recentGames =
      safeJsonRead(KEYS.recentGames, []);

    if (!lastWatch && !recentGames.length) {
      return;
    }

    const stack = document.createElement("div");
    stack.className = "ec-continue-stack";

    if (lastWatch?.url) {
      const card = document.createElement("div");
      card.className = "ec-continue-card";
      card.dataset.ecContinueWatch = "true";
      card.innerHTML = `
        <div class="ec-continue-copy">
          <span>Continue watching</span>
          <strong>${escapeHtml(
            lastWatch.name || "Last stream"
          )}</strong>
        </div>
        <button
          class="ec-continue-button"
          type="button">
          Resume
        </button>
      `;

      card
        .querySelector("button")
        .addEventListener("click", () => {
          const input =
            document.getElementById("streamUrl");
          const form =
            document.getElementById("streamForm");

          if (!input || !form) {
            return;
          }

          input.value = lastWatch.url;
          form.requestSubmit();
        });

      stack.appendChild(card);
    }

    if (recentGames[0]) {
      const game = recentGames[0];
      const card = document.createElement("div");
      card.className = "ec-continue-card";
      card.innerHTML = `
        <div class="ec-continue-copy">
          <span>Continue playing</span>
          <strong>${escapeHtml(game.name)}</strong>
        </div>
        <button
          class="ec-continue-button"
          type="button">
          Play
        </button>
      `;

      card
        .querySelector("button")
        .addEventListener("click", () => {
          const destination = new URL(
            "games.html",
            window.location.href
          );

          destination.searchParams.set(
            "game",
            game.url
          );
          destination.searchParams.set(
            "name",
            game.name
          );

          window.location.href = destination.href;
        });

      stack.appendChild(card);
    }

    const quickFavorites =
      urlCard.querySelector(".quick-favorites");

    if (quickFavorites) {
      urlCard.insertBefore(stack, quickFavorites);
    } else {
      urlCard.appendChild(stack);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function gameTags(name) {
    const map = {
      "EastCoin Bonk": [
        "Solo",
        "45 sec",
        "High score"
      ],
      "EastCoin Aim Trainer": [
        "Solo",
        "30 sec",
        "Accuracy"
      ],
      "EastCoin Button Masher": [
        "Solo",
        "10 sec",
        "Speed"
      ],
      "Skribbl.io": [
        "Multiplayer",
        "Drawing",
        "Party"
      ],
      "Gartic Phone": [
        "Multiplayer",
        "Drawing",
        "Party"
      ],
      "TypeRacer": [
        "Multiplayer",
        "Typing",
        "Race"
      ],
      "PlayingCards.io": [
        "Multiplayer",
        "Tabletop"
      ],
      "Lichess": [
        "1v1",
        "Strategy"
      ],
      "AirConsole": [
        "Multiplayer",
        "Phones",
        "Party"
      ]
    };

    return map[name] || ["Game"];
  }

  function addTagsToCard(card) {
    if (card.querySelector(".ec-game-tags")) {
      return;
    }

    const name =
      card.dataset.gameName ||
      card.querySelector("h2")?.textContent?.trim() ||
      "Game";

    const tags = document.createElement("span");
    tags.className = "ec-game-tags";

    gameTags(name).forEach((tag) => {
      const badge = document.createElement("span");
      badge.className = "ec-game-tag";
      badge.textContent = tag;
      tags.appendChild(badge);
    });

    const footer =
      card.querySelector(".game-card-footer");

    if (footer) {
      card.insertBefore(tags, footer);
    } else {
      card.appendChild(tags);
    }
  }

  function makeGameSection(title, subtitle, cards) {
    const section = document.createElement("section");
    section.className = "ec-game-section";

    const head = document.createElement("div");
    head.className = "ec-game-section-head";
    head.innerHTML = `
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(subtitle)}</p>
    `;

    const grid = document.createElement("div");
    grid.className = "game-grid";

    cards.forEach((card) => {
      addTagsToCard(card);
      grid.appendChild(card);
    });

    section.append(head, grid);
    return section;
  }

  function createRecentGameCard(game) {
    const card = document.createElement("button");
    card.className = "game-card";
    card.type = "button";
    card.dataset.gameUrl = game.url;
    card.dataset.gameName = game.name;

    card.innerHTML = `
      <span class="game-card-icon">
        ${escapeHtml(game.icon || "🎮")}
      </span>
      <h2>${escapeHtml(game.name)}</h2>
      <p>
        Resume one of the games most recently opened on this device.
      </p>
      <span class="game-card-footer">
        <span class="game-card-type">
          Recently played
        </span>
        <span class="game-card-action">
          Continue
        </span>
      </span>
    `;

    addTagsToCard(card);
    return card;
  }

  function enhanceGamesLibrary() {
    const library =
      document.querySelector(".games-library");
    const originalGrid =
      library?.querySelector(".game-grid");

    if (!library || !originalGrid) {
      return;
    }

    const cards = Array.from(
      originalGrid.querySelectorAll(
        ":scope > .game-card"
      )
    );

    if (!cards.length) {
      return;
    }

    const originals = cards.filter((card) =>
      (card.dataset.gameName || "")
        .startsWith("EastCoin")
    );

    const party = cards.filter(
      (card) => !originals.includes(card)
    );

    const recent =
      safeJsonRead(KEYS.recentGames, [])
        .slice(0, 3)
        .map(createRecentGameCard);

    const roomForm =
      library.querySelector(".game-room-form");

    const insertionPoint =
      roomForm?.nextSibling || originalGrid;

    const recentSection =
      recent.length
        ? makeGameSection(
            "Recently Played",
            "Pick up where you left off.",
            recent
          )
        : null;

    const originalSection = makeGameSection(
      "EastCoin Games",
      "Fast solo games built for the EastCoin group.",
      originals
    );

    const partySection = makeGameSection(
      "Party Games",
      "Multiplayer games and private rooms.",
      party
    );

    if (recentSection) {
      library.insertBefore(
        recentSection,
        insertionPoint
      );
    }

    library.insertBefore(
      originalSection,
      insertionPoint
    );

    library.insertBefore(
      partySection,
      insertionPoint
    );

    originalGrid.remove();
  }

  function bindSettingsLinks() {
    document
      .querySelectorAll(".ec-settings-link")
      .forEach((button) => {
        button.addEventListener(
          "click",
          showSettings
        );
      });
  }

  applyReducedMotion(
    readBoolean(KEYS.reducedMotion, false)
  );

  if (chatPanel) {
    if (isMobile()) {
      body.classList.remove("ec-chat-open");
    } else {
      body.classList.toggle(
        "ec-chat-collapsed",
        readBoolean(KEYS.chatCollapsed, false)
      );
    }
  }

  buildSettingsModal();
  bindSettingsLinks();
  buildChatScrim();
  buildEmbedStatus();
  buildContinueCards();
  enhanceGamesLibrary();
  buildUtilityDock();
  observeFrames();
  syncSettingsInputs();
  updateChatButtons();

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      body.classList.remove("ec-chat-open");
      body.classList.toggle(
        "ec-chat-collapsed",
        readBoolean(KEYS.chatCollapsed, false)
      );
    }

    updateChatButtons();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (settingsModal?.classList.contains("is-open")) {
      hideSettings();
      return;
    }

    if (body.classList.contains("ec-chat-open")) {
      body.classList.remove("ec-chat-open");
      updateChatButtons();
      return;
    }

    if (theaterActive) {
      setTheaterMode(false);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === KEYS.reducedMotion) {
      applyReducedMotion(
        readBoolean(KEYS.reducedMotion, false)
      );
    }

    if (event.key === KEYS.chatCollapsed) {
      setChatVisible(
        !readBoolean(KEYS.chatCollapsed, false),
        false
      );
    }

    if (event.key === KEYS.soundEnabled) {
      sendSettingsToFrames();
    }
  });
})();

(() => {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const embedded =
    parameters.get("shell") === "1" &&
    window.parent !== window;

  function buildCopyLinkUrl() {
    const streamedState = window.eastcoinStreamedState;

    if (streamedState?.matchId) {
      const eventUrl = new URL("/", window.location.origin);
      eventUrl.searchParams.set("event", streamedState.matchId);

      if (streamedState.source) {
        eventUrl.searchParams.set("source", streamedState.source);
      }

      if (
        streamedState.streamNo !== undefined &&
        streamedState.streamNo !== null
      ) {
        eventUrl.searchParams.set(
          "stream",
          String(streamedState.streamNo)
        );
      }

      return eventUrl.href;
    }

    const activeFrame = document.getElementById("activeFrame");
    const activeUrl =
      activeFrame?.getAttribute("src") ||
      activeFrame?.src ||
      localStorage.getItem("eastcoinsEmbedUrl") ||
      "";

    if (!activeUrl) return "";

    const shareUrl = new URL("/", window.location.origin);
    shareUrl.searchParams.set("watch", activeUrl);
    return shareUrl.href;
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const fallback = document.createElement("textarea");
    fallback.value = value;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      fallback.remove();
    }

    return copied;
  }

  function enhanceCopyLinkButton() {
    const shareButton = document.getElementById("shareButton");
    if (!shareButton || shareButton.dataset.copyLinkReady === "true") {
      return;
    }

    shareButton.dataset.copyLinkReady = "true";
    shareButton.textContent = "🔗 Copy Link";
    shareButton.setAttribute("aria-describedby", "copyLinkTooltip");

    const tooltip = document.createElement("span");
    tooltip.className = "copy-link-tooltip";
    tooltip.id = "copyLinkTooltip";
    tooltip.setAttribute("role", "status");
    tooltip.setAttribute("aria-live", "polite");
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.textContent = "Link Copied! Paste in chat";
    document.body.appendChild(tooltip);

    let hideTimer = 0;

    function showTooltip() {
      const rect = shareButton.getBoundingClientRect();
      const tooltipWidth = Math.min(220, window.innerWidth - 20);
      const left = Math.min(
        Math.max(10, rect.right - tooltipWidth),
        Math.max(10, window.innerWidth - tooltipWidth - 10)
      );
      const top = Math.min(
        rect.bottom + 9,
        Math.max(10, window.innerHeight - 50)
      );

      tooltip.style.width = `${tooltipWidth}px`;
      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `${Math.round(top)}px`;
      tooltip.classList.add("show");
      tooltip.setAttribute("aria-hidden", "false");

      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        tooltip.classList.remove("show");
        tooltip.setAttribute("aria-hidden", "true");
      }, 2400);
    }

    shareButton.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const shareUrl = buildCopyLinkUrl();
        if (!shareUrl) return;

        try {
          const copied = await copyText(shareUrl);
          if (!copied) throw new Error("Clipboard copy failed");
          showTooltip();
        } catch {
          window.prompt("Copy this watch link:", shareUrl);
        }
      },
      true
    );
  }

  enhanceCopyLinkButton();

  if (!embedded) return;

  function removeServerPreferenceUi() {
    document
      .querySelectorAll(".streamed-server-preferences")
      .forEach((section) => section.remove());
  }

  removeServerPreferenceUi();

  function post(message) {
    window.parent.postMessage(message, window.location.origin);
  }

  function stopNavigation(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  let lastShellState = null;
  let controlUpdateFrame = 0;

  function setControlText(button, text) {
    if (button.textContent !== text) {
      button.textContent = text;
    }
  }

  function setControlPressed(button, pressed) {
    const value = String(Boolean(pressed));

    if (button.getAttribute("aria-pressed") !== value) {
      button.setAttribute("aria-pressed", value);
    }
  }

  function applyShellState(state) {
    if (!state) return;
    lastShellState = state;

    document
      .querySelectorAll("[data-ec-theater-toggle]")
      .forEach((button) => {
        setControlText(
          button,
          state.theaterActive
            ? "↙ Exit theater"
            : "⛶ Theater"
        );
        button.classList.toggle(
          "is-active",
          Boolean(state.theaterActive)
        );
        setControlPressed(
          button,
          state.theaterActive
        );
      });

    document
      .querySelectorAll("[data-ec-chat-toggle]")
      .forEach((button) => {
        setControlText(
          button,
          state.chatVisible
            ? "💬 Hide chat"
            : "💬 Show chat"
        );
        button.classList.toggle(
          "is-active",
          Boolean(state.chatVisible)
        );
        setControlPressed(
          button,
          state.chatVisible
        );
      });

    document
      .querySelectorAll("[data-ec-nav-toggle]")
      .forEach((button) => {
        setControlText(
          button,
          state.navigationVisible
            ? "◀ Hide nav"
            : "☰ Show nav"
        );
        button.classList.toggle(
          "is-active",
          !state.navigationVisible
        );
        setControlPressed(
          button,
          !state.navigationVisible
        );
      });
  }

  function scheduleControlUpdate() {
    if (!lastShellState || controlUpdateFrame) return;

    controlUpdateFrame = window.requestAnimationFrame(() => {
      controlUpdateFrame = 0;
      applyShellState(lastShellState);
    });
  }

  function toggleGameOverlayFromShell(attempt = 0) {
    const button = document.querySelector(
      "[data-ec-game-overlay-toggle]"
    );

    if (button) {
      button.click();
      return;
    }

    if (attempt < 12) {
      window.setTimeout(
        () => toggleGameOverlayFromShell(attempt + 1),
        75
      );
    }
  }

  window.addEventListener("message", (event) => {
    if (
      event.origin !== window.location.origin ||
      event.source !== window.parent
    ) {
      return;
    }

    const message = event.data || {};

    if (message.type === "eastcoin:shell-state") {
      applyShellState(message);
      return;
    }

    if (message.type === "eastcoin:toggle-game-overlay") {
      toggleGameOverlayFromShell();
    }
  });

  function eventFromContinueStorage() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("eastcoinContinueStreamedEventV1") || "null"
      );

      return {
        event: saved?.match?.id || "",
        source: saved?.source || "",
        stream: saved?.streamNo ?? ""
      };
    } catch {
      return { event: "", source: "", stream: "" };
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const shellControl = event.target.closest(
        "[data-ec-theater-toggle], " +
        "[data-ec-chat-toggle], " +
        "[data-ec-nav-toggle]"
      );

      if (shellControl) {
        stopNavigation(event);

        if (shellControl.matches("[data-ec-theater-toggle]")) {
          post({ type: "eastcoin:toggle-theater" });
        } else if (shellControl.matches("[data-ec-chat-toggle]")) {
          post({ type: "eastcoin:toggle-chat" });
        } else {
          post({ type: "eastcoin:toggle-navigation" });
        }
        return;
      }

      const playerExists = Boolean(
        document.getElementById("playerShell")
      );

      /*
        On the full Events view, stop the existing no-player redirect before
        eastcoins-streamed.js changes the iframe location. The shell receives
        the event instead and swaps only the center frame to player.html.
      */
      if (!playerExists) {
        const watch = event.target.closest("[data-watch-event]");

        if (watch) {
          stopNavigation(event);
          post({
            type: "eastcoin:open-player",
            event: watch.dataset.watchEvent || ""
          });
          return;
        }

        const recent = event.target.closest("[data-recent-event]");

        if (recent) {
          stopNavigation(event);
          post({
            type: "eastcoin:open-player",
            event: recent.dataset.recentEvent || "",
            source: recent.dataset.recentSource || "",
            stream: recent.dataset.recentStream || ""
          });
          return;
        }

        const resume = event.target.closest("[data-continue-event]");

        if (resume) {
          const saved = eventFromContinueStorage();
          if (saved.event) {
            stopNavigation(event);
            post({ type: "eastcoin:open-player", ...saved });
            return;
          }
        }
      }

      const link = event.target.closest("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) {
        return;
      }

      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const filename = url.pathname.split("/").pop().toLowerCase();

      if (filename === "events.html") {
        stopNavigation(event);
        post({
          type: "eastcoin:open-events",
          event: url.searchParams.get("event") || ""
        });
        return;
      }

      if (filename === "favorites.html") {
        stopNavigation(event);
        post({ type: "eastcoin:open-favorites" });
        return;
      }

      if (
        filename === "index.html" ||
        filename === "player.html" ||
        filename === ""
      ) {
        stopNavigation(event);
        post({
          type: "eastcoin:open-player",
          event: url.searchParams.get("event") || "",
          source: url.searchParams.get("source") || "",
          stream: url.searchParams.get("stream") || "",
          watch: url.searchParams.get("watch") || "",
          new: url.searchParams.get("new") || ""
        });
      }
    },
    true
  );

  const controlObserver = new MutationObserver(() => {
    removeServerPreferenceUi();
    scheduleControlUpdate();
  });

  controlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  post({ type: "eastcoin:request-shell-state" });
  const readyView = document.getElementById("playerShell")
    ? "player"
    : document.querySelector(".favorite-list")
      ? "favorites"
      : document.getElementById("streamedDiscoveryRoot")
        ? "events"
        : "content";

  post({
    type: "eastcoin:view-ready",
    view: readyView
  });
})();

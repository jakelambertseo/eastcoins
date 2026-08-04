(() => {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const embedded =
    parameters.get("shell") === "1" &&
    window.parent !== window;

  if (!embedded) return;

  function post(message) {
    window.parent.postMessage(message, window.location.origin);
  }

  function stopNavigation(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

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

  post({
    type: "eastcoin:view-ready",
    view: document.getElementById("playerShell") ? "player" : "events"
  });
})();

(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");

  if (!root || !document.body.classList.contains("ec-events-clean")) {
    return;
  }

  let enhancementFrame = 0;

  function normalizeBrowserCopy() {
    root.querySelectorAll(".streamed-empty").forEach((element) => {
      const currentText = element.textContent || "";
      const updatedText = currentText.replace(
        "Try Refresh in a moment.",
        "Try again in a moment."
      );

      /*
        Only touch the DOM when the copy actually changes. The previous
        version assigned textContent on every MutationObserver callback,
        which created another child-list mutation and could trap the event
        browser in a continuous render loop.
      */
      if (updatedText !== currentText) {
        element.textContent = updatedText;
      }
    });
  }

  function prepareEventCards() {
    root.querySelectorAll(".ec-event-card").forEach((card) => {
      if (!card.classList.contains("ec-event-card-selectable")) {
        card.classList.add("ec-event-card-selectable");
      }

      if (!card.hasAttribute("tabindex")) {
        card.tabIndex = 0;
      }

      if (!card.hasAttribute("role")) {
        card.setAttribute("role", "group");
      }
    });
  }

  function refreshEnhancements() {
    enhancementFrame = 0;
    normalizeBrowserCopy();
    prepareEventCards();
  }

  function scheduleEnhancements() {
    if (enhancementFrame) {
      return;
    }

    enhancementFrame = window.requestAnimationFrame(
      refreshEnhancements
    );
  }

  root.addEventListener("click", (event) => {
    if (event.target.closest("button, a, input, select, textarea")) {
      return;
    }

    const card = event.target.closest(".ec-event-card-selectable");
    const watchButton = card?.querySelector("[data-watch-event]");

    watchButton?.click();
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (event.target.closest("button, a, input, select, textarea")) {
      return;
    }

    const card = event.target.closest(".ec-event-card-selectable");
    const watchButton = card?.querySelector("[data-watch-event]");

    if (!watchButton) {
      return;
    }

    event.preventDefault();
    watchButton.click();
  });

  const observer = new MutationObserver(scheduleEnhancements);

  observer.observe(root, {
    childList: true,
    subtree: true
  });

  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();

      if (enhancementFrame) {
        window.cancelAnimationFrame(enhancementFrame);
        enhancementFrame = 0;
      }
    },
    { once: true }
  );

  scheduleEnhancements();
})();

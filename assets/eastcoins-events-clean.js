(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");

  if (!root || !document.body.classList.contains("ec-events-clean")) {
    return;
  }

  function normalizeBrowserCopy() {
    document.querySelectorAll(".streamed-empty").forEach((element) => {
      element.textContent = element.textContent.replace(
        "Try Refresh in a moment.",
        "Try again in a moment."
      );
    });
  }

  function prepareEventCards() {
    root.querySelectorAll(".ec-event-card").forEach((card) => {
      card.classList.add("ec-event-card-selectable");

      if (!card.hasAttribute("tabindex")) {
        card.tabIndex = 0;
      }

      card.setAttribute("role", "group");
    });
  }

  function refreshEnhancements() {
    normalizeBrowserCopy();
    prepareEventCards();
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

  const observer = new MutationObserver(refreshEnhancements);
  observer.observe(root, {
    childList: true,
    subtree: true
  });

  refreshEnhancements();
})();

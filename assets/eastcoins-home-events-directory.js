(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");

  if (
    !root ||
    root.dataset.context !== "player" ||
    !document.body.classList.contains("ec-home-events-directory")
  ) {
    return;
  }

  const sportTabs = document.getElementById("streamedSportTabs");
  const liveSection = document.getElementById("streamedPopularSection");
  const soonSection = document.getElementById("streamedSoonSection");
  const continueSection = document.getElementById("streamedContinueSection");
  const recentSection = document.getElementById("streamedRecentSection");
  const nightSection = document.getElementById("streamedNightSection");
  const favoriteSection = document.getElementById("streamedFavoriteSection");
  const matchList = document.getElementById("streamedMatchList");
  const directorySection = matchList?.closest(".streamed-discovery-section");

  let enhancementFrame = 0;
  let countdownTimer = 0;

  function setCopy(element, text) {
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  function arrangeHomepageSections() {
    if (!sportTabs) return;

    /*
      Keep the watch-first hierarchy intentionally simple:
      Live Now -> Starting Soon -> full event directory.
      Existing personalized/history sections remain available below it.
    */
    const orderedSections = [
      liveSection,
      soonSection,
      directorySection,
      continueSection,
      recentSection,
      nightSection,
      favoriteSection
    ].filter(Boolean);

    let previous = sportTabs;

    orderedSections.forEach((section) => {
      if (previous.nextElementSibling !== section) {
        previous.insertAdjacentElement("afterend", section);
      }
      previous = section;
    });

    const liveHeading = liveSection?.querySelector(
      ".streamed-discovery-section-head h2"
    );
    const liveCopy = liveSection?.querySelector(
      ".streamed-discovery-section-head p"
    );
    const soonCopy = soonSection?.querySelector(
      ".streamed-discovery-section-head p"
    );
    const directoryCopy = directorySection?.querySelector(
      ".streamed-discovery-section-head p"
    );

    setCopy(liveHeading, "Live Now");
    setCopy(
      liveCopy,
      "Jump straight into events that are available to watch right now."
    );
    setCopy(
      soonCopy,
      "The next events to begin, with a live countdown to kickoff."
    );
    setCopy(
      directoryCopy,
      "Browse every currently listed event after Live Now and Starting Soon."
    );

    liveSection?.classList.add("ec-home-live-now");
    soonSection?.classList.add("ec-home-starting-soon");
    directorySection?.classList.add("ec-home-full-directory");
  }

  function normalizedTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return NaN;
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  function countdownText(timestamp) {
    const difference = normalizedTimestamp(timestamp) - Date.now();

    if (!Number.isFinite(difference)) {
      return "Time unavailable";
    }

    if (difference <= 0) {
      return "Starting now";
    }

    const totalSeconds = Math.ceil(difference / 1000);

    /*
      Near kickoff, show a true clock instead of a rounded minute value.
      Farther out, keep the compact wording that fits event cards cleanly.
    */
    if (totalSeconds <= 10 * 60) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `Starts in ${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    const minutes = Math.ceil(totalSeconds / 60);

    if (minutes < 60) {
      return `Starts in ${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainderMinutes = minutes % 60;

    if (hours < 24) {
      return remainderMinutes
        ? `Starts in ${hours}h ${remainderMinutes}m`
        : `Starts in ${hours}h`;
    }

    const days = Math.floor(hours / 24);
    return `Starts in ${days}d ${hours % 24}h`;
  }

  function updateCountdowns() {
    root.querySelectorAll("[data-countdown]").forEach((element) => {
      const timestamp = normalizedTimestamp(element.dataset.countdown);
      if (!Number.isFinite(timestamp)) return;

      const difference = timestamp - Date.now();
      const nextText = countdownText(timestamp);

      if (element.textContent !== nextText) {
        element.textContent = nextText;
      }

      element.classList.toggle(
        "is-imminent",
        difference > 0 && difference <= 10 * 60 * 1000
      );
      element.classList.toggle(
        "is-starting",
        difference <= 0 && difference > -15 * 60 * 1000
      );
    });
  }

  function refreshEnhancements() {
    enhancementFrame = 0;
    arrangeHomepageSections();
    updateCountdowns();
  }

  function scheduleEnhancements() {
    if (enhancementFrame) return;

    enhancementFrame = window.requestAnimationFrame(
      refreshEnhancements
    );
  }

  const observer = new MutationObserver(scheduleEnhancements);

  observer.observe(root, {
    childList: true,
    subtree: true
  });

  /*
    One-second updates only change text when the visible countdown actually
    needs to change. This makes the last ten minutes feel live without
    continuously re-rendering the event cards themselves.
  */
  countdownTimer = window.setInterval(updateCountdowns, 1000);

  scheduleEnhancements();

  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      window.clearInterval(countdownTimer);

      if (enhancementFrame) {
        window.cancelAnimationFrame(enhancementFrame);
      }
    },
    { once: true }
  );
})();

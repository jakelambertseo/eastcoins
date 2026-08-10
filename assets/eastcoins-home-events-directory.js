(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");
  const list = document.getElementById("streamedMatchList");

  if (
    !root ||
    !list ||
    root.dataset.context !== "player" ||
    !document.body.classList.contains("ec-home-events-directory")
  ) {
    return;
  }

  const directorySection = list.closest(".streamed-discovery-section");
  const search = document.getElementById("streamedSearch");
  const HOME_CATEGORY_LIMIT = 4;
  const CATEGORY_PRIORITIES = [
    /american football|nfl/i,
    /basketball|nba|wnba/i,
    /baseball|mlb/i,
    /hockey|nhl/i,
    /soccer|^football$/i,
    /mma|ufc|boxing|combat/i,
    /motorsport|racing|formula|nascar/i,
    /tennis/i,
    /cricket/i,
    /24\/7|always live/i,
    /other/i
  ];

  let frameId = 0;
  let countdownTimer = 0;
  let observer;

  directorySection?.classList.add("ec-home-simple-directory-section");

  function categoryName(card) {
    const tags = Array.from(card.querySelectorAll(".ec-event-tag"));
    const categoryTag = tags.find((tag) => {
      const text = (tag.textContent || "").trim().toLowerCase();
      return (
        !tag.classList.contains("ec-event-tag-live") &&
        !tag.classList.contains("ec-event-tag-countdown") &&
        text !== "popular"
      );
    });
    return (categoryTag?.textContent || "Other").trim() || "Other";
  }

  function categoryRank(name) {
    const rank = CATEGORY_PRIORITIES.findIndex((pattern) => pattern.test(name));
    return rank === -1 ? CATEGORY_PRIORITIES.length : rank;
  }

  function normalizedTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return NaN;
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  function eventStart(card) {
    if (card.classList.contains("is-live")) return Number.NEGATIVE_INFINITY;
    const timestamp = normalizedTimestamp(card.querySelector("[data-countdown]")?.dataset.countdown);
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
  }

  function eventTitle(card) {
    return (card.querySelector("h3")?.textContent || "Event").trim().toLowerCase();
  }

  function sortCards(cards) {
    return cards.sort((left, right) => {
      const time = eventStart(left) - eventStart(right);
      return time || eventTitle(left).localeCompare(eventTitle(right));
    });
  }

  function slug(value) {
    return String(value || "other")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other";
  }

  function prepareOriginal(card) {
    card.classList.add("ec-event-card-selectable");
    card.tabIndex = 0;
    const title = card.querySelector("h3")?.textContent?.trim();
    if (title) card.setAttribute("aria-label", `Watch ${title}`);
  }

  function makeProxy(original) {
    const proxy = original.cloneNode(true);
    proxy.removeAttribute("id");
    proxy.classList.add("ec-home-simple-live-proxy", "ec-event-card-selectable");
    proxy.tabIndex = 0;

    const activate = (event) => {
      event.preventDefault();
      original.querySelector("[data-watch-event]")?.click();
    };

    proxy.addEventListener("click", activate);
    proxy.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });
    return proxy;
  }

  function buildJump(categories) {
    const section = document.createElement("section");
    section.className = "ec-home-simple-jump";

    const heading = document.createElement("h2");
    heading.className = "ec-home-simple-heading";
    heading.textContent = "Jump to category";

    const grid = document.createElement("div");
    grid.className = "ec-home-simple-jump-grid";

    categories.forEach(([name]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ec-home-simple-jump-button";
      button.textContent = name;
      button.addEventListener("click", () => {
        document.getElementById(`ec-home-simple-category-${slug(name)}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
      grid.appendChild(button);
    });

    section.append(heading, grid);
    return section;
  }

  function buildLive(liveCards) {
    if (!liveCards.length) return null;

    const section = document.createElement("section");
    section.className = "ec-home-simple-live";
    const head = document.createElement("div");
    head.className = "ec-home-simple-section-head";
    head.innerHTML = '<span class="ec-home-simple-live-dot" aria-hidden="true"></span><h2 class="ec-home-simple-heading">Live now</h2>';

    const grid = document.createElement("div");
    grid.className = "ec-home-simple-grid";
    sortCards([...liveCards]).slice(0, 8).forEach((card) => grid.appendChild(makeProxy(card)));

    section.append(head, grid);
    return section;
  }

  function buildCategory(name, cards, showAll) {
    const section = document.createElement("section");
    section.className = "ec-home-simple-category";
    section.id = `ec-home-simple-category-${slug(name)}`;

    const head = document.createElement("div");
    head.className = "ec-home-simple-category-head";
    const heading = document.createElement("h3");
    heading.className = "ec-home-simple-category-title";
    heading.textContent = name;
    const more = document.createElement("a");
    more.className = "ec-home-simple-more";
    more.href = "events.html";
    more.textContent = cards.length > HOME_CATEGORY_LIMIT && !showAll
      ? `View all ${cards.length} →`
      : "Open events →";
    head.append(heading, more);

    const grid = document.createElement("div");
    grid.className = "ec-home-simple-grid";
    const ordered = sortCards(cards);
    const visible = showAll ? ordered : ordered.slice(0, HOME_CATEGORY_LIMIT);
    visible.forEach((card) => {
      prepareOriginal(card);
      grid.appendChild(card);
    });

    section.append(head, grid);
    return section;
  }

  function countdownText(timestamp) {
    const difference = normalizedTimestamp(timestamp) - Date.now();
    if (!Number.isFinite(difference)) return "Time unavailable";
    if (difference <= 0) return "Starting now";

    const totalSeconds = Math.ceil(difference / 1000);
    if (totalSeconds <= 10 * 60) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `Starts in ${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    const minutes = Math.ceil(totalSeconds / 60);
    if (minutes < 60) return `Starts in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours < 24) return remainder ? `Starts in ${hours}h ${remainder}m` : `Starts in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Starts in ${days}d ${hours % 24}h`;
  }

  function updateCountdowns() {
    root.querySelectorAll("[data-countdown]").forEach((element) => {
      const timestamp = normalizedTimestamp(element.dataset.countdown);
      if (!Number.isFinite(timestamp)) return;
      const text = countdownText(timestamp);
      if (element.textContent !== text) element.textContent = text;
    });
  }

  function groupCards() {
    frameId = 0;
    const rawCards = Array.from(list.children).filter((element) =>
      element.classList.contains("ec-event-card")
    );

    if (!rawCards.length) return;

    observer?.disconnect();
    const grouped = new Map();
    rawCards.forEach((card) => {
      const name = categoryName(card);
      const items = grouped.get(name) || [];
      items.push(card);
      grouped.set(name, items);
    });

    const categories = Array.from(grouped.entries()).sort(([left], [right]) => {
      const rank = categoryRank(left) - categoryRank(right);
      return rank || left.localeCompare(right);
    });
    const liveCards = rawCards.filter((card) => card.classList.contains("is-live"));
    const showAll = Boolean(search?.value.trim());

    const fragment = document.createDocumentFragment();
    fragment.appendChild(buildJump(categories));
    const live = buildLive(liveCards);
    if (live) fragment.appendChild(live);
    categories.forEach(([name, cards]) => fragment.appendChild(buildCategory(name, cards, showAll)));

    list.classList.add("ec-home-simple-directory");
    list.replaceChildren(fragment);
    observer?.observe(list, { childList: true });
    updateCountdowns();
  }

  function schedule() {
    if (frameId) return;
    frameId = requestAnimationFrame(groupCards);
  }

  observer = new MutationObserver(() => {
    if (Array.from(list.children).some((element) => element.classList.contains("ec-event-card"))) {
      schedule();
    }
  });

  observer.observe(list, { childList: true });
  countdownTimer = window.setInterval(updateCountdowns, 1000);
  schedule();

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    window.clearInterval(countdownTimer);
    if (frameId) cancelAnimationFrame(frameId);
  }, { once: true });
})();

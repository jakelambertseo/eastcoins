(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");
  const list = document.getElementById("streamedMatchList");

  if (!root || !list || root.dataset.context !== "events") {
    return;
  }

  const directorySection = list.closest(".streamed-discovery-section");
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
  let observer;

  directorySection?.classList.add("ec-simple-directory-section");

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

  function eventStart(card) {
    if (card.classList.contains("is-live")) return Number.NEGATIVE_INFINITY;
    const timestamp = Number(card.querySelector("[data-countdown]")?.dataset.countdown);
    if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
    return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
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
    proxy.classList.add("ec-simple-live-proxy", "ec-event-card-selectable");
    proxy.tabIndex = 0;

    const activate = (event) => {
      event.preventDefault();
      const watchButton = original.querySelector("[data-watch-event]");
      watchButton?.click();
    };

    proxy.addEventListener("click", activate);
    proxy.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });
    return proxy;
  }

  function buildJump(categories) {
    const section = document.createElement("section");
    section.className = "ec-simple-jump-nav";

    const heading = document.createElement("h2");
    heading.className = "ec-simple-heading";
    heading.textContent = "Jump to category";

    const grid = document.createElement("div");
    grid.className = "ec-simple-jump-grid";

    categories.forEach(([name]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ec-simple-jump-button";
      button.textContent = name;
      button.addEventListener("click", () => {
        document.getElementById(`ec-simple-category-${slug(name)}`)?.scrollIntoView({
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
    section.className = "ec-simple-live-section";
    const head = document.createElement("div");
    head.className = "ec-simple-section-head";
    head.innerHTML = '<span class="ec-simple-live-dot" aria-hidden="true"></span><h2 class="ec-simple-heading">Live now</h2>';

    const grid = document.createElement("div");
    grid.className = "ec-simple-grid";
    sortCards([...liveCards]).forEach((card) => grid.appendChild(makeProxy(card)));

    section.append(head, grid);
    return section;
  }

  function buildCategory(name, cards) {
    const section = document.createElement("section");
    section.className = "ec-simple-category";
    section.id = `ec-simple-category-${slug(name)}`;

    const heading = document.createElement("h2");
    heading.className = "ec-simple-category-title";
    heading.textContent = name;

    const grid = document.createElement("div");
    grid.className = "ec-simple-grid";
    sortCards(cards).forEach((card) => {
      prepareOriginal(card);
      grid.appendChild(card);
    });

    section.append(heading, grid);
    return section;
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
    const fragment = document.createDocumentFragment();
    fragment.appendChild(buildJump(categories));

    const live = buildLive(liveCards);
    if (live) fragment.appendChild(live);

    categories.forEach(([name, cards]) => fragment.appendChild(buildCategory(name, cards)));

    list.classList.add("ec-simple-event-directory");
    list.replaceChildren(fragment);
    observer?.observe(list, { childList: true });
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
  schedule();

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    if (frameId) cancelAnimationFrame(frameId);
  }, { once: true });
})();

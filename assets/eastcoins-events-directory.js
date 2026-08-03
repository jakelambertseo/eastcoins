(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");
  const list = document.getElementById("streamedMatchList");

  if (!root || !list || root.dataset.context !== "events") {
    return;
  }

  const CATEGORY_PRIORITIES = [
    /american football|nfl/i,
    /basketball|nba|wnba/i,
    /baseball|mlb/i,
    /hockey|nhl/i,
    /soccer|^football$/i,
    /tennis/i,
    /cricket/i,
    /mma|ufc|boxing|combat/i,
    /wrestling|wwe/i,
    /motorsport|racing|formula/i,
    /other/i
  ];

  const CATEGORY_ICONS = [
    [/american football|nfl/i, "🏈"],
    [/basketball|nba|wnba/i, "🏀"],
    [/baseball|mlb/i, "⚾"],
    [/hockey|nhl/i, "🏒"],
    [/soccer|^football$/i, "⚽"],
    [/tennis/i, "🎾"],
    [/cricket/i, "🏏"],
    [/mma|ufc|boxing|combat/i, "🥊"],
    [/wrestling|wwe/i, "🤼"],
    [/motorsport|racing|formula/i, "🏁"]
  ];

  let frameId = 0;
  let observer;

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

  function categoryIcon(name) {
    return CATEGORY_ICONS.find(([pattern]) => pattern.test(name))?.[1] || "🏆";
  }

  function categoryRank(name) {
    const rank = CATEGORY_PRIORITIES.findIndex((pattern) =>
      pattern.test(name)
    );

    return rank === -1 ? CATEGORY_PRIORITIES.length : rank;
  }

  function eventStart(card) {
    if (card.classList.contains("is-live")) {
      return Number.NEGATIVE_INFINITY;
    }

    const countdown = card.querySelector("[data-countdown]");
    const timestamp = Number(countdown?.dataset.countdown);

    return Number.isFinite(timestamp)
      ? timestamp
      : Number.POSITIVE_INFINITY;
  }

  function eventTitle(card) {
    return (card.querySelector("h3")?.textContent || "Event")
      .trim()
      .toLowerCase();
  }

  function sortCards(cards) {
    return cards.sort((left, right) => {
      const timeDifference = eventStart(left) - eventStart(right);

      if (timeDifference) {
        return timeDifference;
      }

      return eventTitle(left).localeCompare(eventTitle(right));
    });
  }

  function buildCategory(name, cards) {
    const section = document.createElement("section");
    section.className = "ec-event-category";
    section.dataset.category = name;

    const header = document.createElement("header");
    header.className = "ec-event-category-head";
    header.innerHTML = `
      <span class="ec-event-category-icon" aria-hidden="true">
        ${categoryIcon(name)}
      </span>
      <div class="ec-event-category-copy">
        <div class="ec-event-category-title-row">
          <h2 class="ec-event-category-title"></h2>
          <span class="ec-event-category-count"></span>
        </div>
        <div class="ec-event-category-rule" aria-hidden="true"></div>
      </div>
    `;

    header.querySelector(".ec-event-category-title").textContent = name;
    header.querySelector(".ec-event-category-count").textContent = String(cards.length);

    const grid = document.createElement("div");
    grid.className = "ec-event-category-grid";

    sortCards(cards).forEach((card) => {
      card.dataset.ecEventCategory = name;
      card.setAttribute("role", "button");

      const title = card.querySelector("h3")?.textContent?.trim();
      if (title) {
        card.setAttribute("aria-label", `Watch ${title}`);
      }

      grid.appendChild(card);
    });

    section.append(header, grid);
    return section;
  }

  function groupRenderedCards() {
    frameId = 0;

    const cards = Array.from(list.children).filter((element) =>
      element.classList.contains("ec-event-card")
    );

    if (!cards.length) {
      return;
    }

    observer?.disconnect();

    const grouped = new Map();

    cards.forEach((card) => {
      const name = categoryName(card);
      const collection = grouped.get(name) || [];
      collection.push(card);
      grouped.set(name, collection);
    });

    const categories = Array.from(grouped.entries()).sort(
      ([leftName], [rightName]) => {
        const rankDifference = categoryRank(leftName) - categoryRank(rightName);
        return rankDifference || leftName.localeCompare(rightName);
      }
    );

    list.classList.add("ec-event-category-list");
    list.replaceChildren(
      ...categories.map(([name, categoryCards]) =>
        buildCategory(name, categoryCards)
      )
    );

    observer?.observe(list, { childList: true });
  }

  function scheduleGrouping() {
    if (frameId) {
      return;
    }

    frameId = window.requestAnimationFrame(groupRenderedCards);
  }

  observer = new MutationObserver(() => {
    const hasUngroupedCards = Array.from(list.children).some((element) =>
      element.classList.contains("ec-event-card")
    );

    if (hasUngroupedCards) {
      scheduleGrouping();
    }
  });

  observer.observe(list, { childList: true });
  scheduleGrouping();

  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    },
    { once: true }
  );
})();

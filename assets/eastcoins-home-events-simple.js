
(() => {
  "use strict";

  const root = document.getElementById("streamedDiscoveryRoot");
  const list = document.getElementById("streamedMatchList");
  const pageMain = document.querySelector(".url-stage, .player-shell");

  if (!root || !list || root.dataset.context !== "player") {
    return;
  }

  const CATEGORY_PRIORITIES = [
    /24\/7|always live/i,
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

  let frameId = 0;
  let observer;

  function categoryName(card) {
    const tags = Array.from(card.querySelectorAll('.ec-event-tag'));
    const categoryTag = tags.find((tag) => {
      const text = (tag.textContent || '').trim().toLowerCase();
      return (
        !tag.classList.contains('ec-event-tag-live') &&
        !tag.classList.contains('ec-event-tag-countdown') &&
        text !== 'popular'
      );
    });

    return (categoryTag?.textContent || 'Other').trim() || 'Other';
  }

  function categoryRank(name) {
    const index = CATEGORY_PRIORITIES.findIndex((pattern) => pattern.test(name));
    return index === -1 ? CATEGORY_PRIORITIES.length : index;
  }

  function eventStart(card) {
    if (card.classList.contains('is-live')) {
      return Number.NEGATIVE_INFINITY;
    }

    const countdown = card.querySelector('[data-countdown]');
    const timestamp = Number(countdown?.dataset.countdown);
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
  }

  function eventTitle(card) {
    return (card.querySelector('h3')?.textContent || 'Event').trim().toLowerCase();
  }

  function sortCards(cards) {
    return cards.sort((left, right) => {
      const diff = eventStart(left) - eventStart(right);
      return diff || eventTitle(left).localeCompare(eventTitle(right));
    });
  }

  function slugify(value) {
    return String(value || 'section')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  function wireProxy(proxy, original) {
    proxy.classList.add("ec-home-simple-event-proxy");
    proxy.setAttribute('role', 'button');
    proxy.tabIndex = 0;
    proxy.addEventListener('click', (event) => {
      event.preventDefault();
      original.click();
    });
    proxy.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        original.click();
      }
    });
  }

  function buildJump(categories) {
    if (!categories.length) return null;

    const section = document.createElement('section');
    section.className = "ec-home-simple-jumps";
    section.innerHTML = `
      <h2 class="${"ec-home-simple-title"}">Jump to category</h2>
      <div class="${"ec-home-simple-jump-grid"}"></div>
    `;

    const grid = section.querySelector('.' + "ec-home-simple-jump-grid");

    categories.forEach(([name]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = "ec-home-simple-jump-button";
      button.textContent = name;
      button.addEventListener('click', () => {
        const target = document.getElementById(`${"ec-home-category"}-${slugify(name)}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      grid.appendChild(button);
    });

    return section;
  }

  function buildLiveSection(liveCards) {
    if (!liveCards.length) return null;

    const section = document.createElement('section');
    section.className = "ec-home-simple-section";
    section.innerHTML = `
      <div class="${"ec-home-simple-section-head"}">
        <span class="${"ec-home-simple-dot"}" aria-hidden="true"></span>
        <h2 class="${"ec-home-simple-title"}">Live now</h2>
      </div>
      <div class="${"ec-home-simple-grid"}"></div>
    `;

    const grid = section.querySelector('.' + "ec-home-simple-grid");
    sortCards([...liveCards]).forEach((card) => {
      const proxy = card.cloneNode(true);
      wireProxy(proxy, card);
      grid.appendChild(proxy);
    });

    return section;
  }

  function buildCategory(name, cards, options = {}) {
    const section = document.createElement('section');
    section.className = "ec-home-simple-category";
    section.id = `${"ec-home-category"}-${slugify(name)}`;

    const title = document.createElement("h3");
    title.textContent = name;
    section.appendChild(title);

    if (options.moreLink) {
      const row = document.createElement('div');
      row.className = "ec-home-simple-category-meta";
      const link = document.createElement('a');
      link.href = 'events.html';
      link.className = "ec-home-simple-more";
      link.textContent = options.moreText || 'Open full events page →';
      row.appendChild(link);
      section.appendChild(row);
    }

    const grid = document.createElement('div');
    grid.className = "ec-home-simple-grid";

    const ordered = sortCards([...cards]);
    const visible = typeof 4 === 'number' && 4 > 0 && !options.showAll
      ? ordered.slice(0, 4)
      : ordered;

    visible.forEach((card) => {
      card.setAttribute('role', 'button');
      const titleText = card.querySelector('h3')?.textContent?.trim();
      if (titleText) {
        card.setAttribute('aria-label', `Watch ${titleText}`);
      }
      grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
  }

  function shouldShowAll() {
    const search = document.getElementById('streamedSearch');
    return Boolean(search?.value.trim());
  }

  function render() {
    frameId = 0;
    const cards = Array.from(list.children).filter((element) =>
      element.classList.contains('ec-event-card')
    );

    if (!cards.length) {
      list.classList.add("ec-home-simple-directory");
      list.replaceChildren();
      const empty = document.createElement('div');
      empty.className = "ec-home-simple-empty";
      empty.textContent = 'No events are available for the current view.';
      list.appendChild(empty);
      observer?.observe(list, { childList: true });
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

    const categories = Array.from(grouped.entries()).sort(([a], [b]) => {
      const diff = categoryRank(a) - categoryRank(b);
      return diff || a.localeCompare(b);
    });

    const fragment = document.createDocumentFragment();
    const jump = buildJump(categories);
    if (jump) fragment.appendChild(jump);

    const liveCards = cards.filter((card) => card.classList.contains('is-live'));
    const liveSection = buildLiveSection(liveCards);
    if (liveSection) fragment.appendChild(liveSection);

    const showAll = shouldShowAll();
    categories.forEach(([name, categoryCards]) => {
      fragment.appendChild(buildCategory(name, categoryCards, {
        showAll,
        moreLink: true
      }));
    });

    list.classList.add("ec-home-simple-directory");
    list.replaceChildren(fragment);
    observer?.observe(list, { childList: true });
  }

  function schedule() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(render);
  }

  observer = new MutationObserver(() => {
    const hasRawCards = Array.from(list.children).some((element) =>
      element.classList.contains('ec-event-card')
    );
    if (hasRawCards) {
      schedule();
    }
  });

  observer.observe(list, { childList: true });
  schedule();

  document.getElementById('streamedSearch')?.addEventListener('input', () => {
    window.setTimeout(schedule, 40);
  });

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
  }, { once: true });
})();

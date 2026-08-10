(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const rail = document.getElementById("liveEventRail");
  const showButton = document.getElementById("liveRailShow");
  const hideButton = document.getElementById("liveRailHide");
  const viewport = document.getElementById("liveRailViewport");
  const list = document.getElementById("liveRailList");
  const previous = document.getElementById("liveRailPrevious");
  const next = document.getElementById("liveRailNext");
  const count = document.getElementById("liveRailCount");
  const playerFrame = document.getElementById("eastcoinViewFrame");
  const loader = document.getElementById("viewLoader");
  const loaderLabel = document.getElementById("viewLoaderLabel");

  if (
    !rail ||
    !showButton ||
    !hideButton ||
    !viewport ||
    !list ||
    !previous ||
    !next ||
    !count ||
    !playerFrame
  ) {
    return;
  }

  let activeEventId = "";
  let events = [];

  const fallbackEvents = [
    {
      id: "demo-astros-padres",
      title: "Houston Astros vs. San Diego Padres",
      category: "Baseball",
      live: true
    },
    {
      id: "demo-packers-bears",
      title: "Green Bay Packers vs. Chicago Bears",
      category: "Football",
      live: true
    },
    {
      id: "demo-lakers-celtics",
      title: "Los Angeles Lakers vs. Boston Celtics",
      category: "Basketball",
      live: true
    },
    {
      id: "demo-ufc",
      title: "UFC Main Event",
      category: "Combat Sports",
      live: false,
      date: Date.now() + 46 * 60 * 1000
    }
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function timestamp(value) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }

    return numeric < 10_000_000_000
      ? numeric * 1000
      : numeric;
  }

  function eventId(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      ""
    );
  }

  function sportName(match) {
    if (typeof API?.sportName === "function") {
      return API.sportName(match?.category);
    }

    return String(match?.category || "Event");
  }

  function upcomingLabel(match) {
    const start = timestamp(match?.date);

    if (!start) {
      return "Soon";
    }

    const difference = start - Date.now();

    if (difference <= 0) {
      return "Soon";
    }

    const minutes = Math.ceil(difference / 60_000);

    if (minutes < 60) {
      return `${minutes}m`;
    }

    return new Date(start).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function normalize(match, liveIds) {
    const id = eventId(match);

    return {
      raw: match,
      id,
      title: String(match?.title || id || "Event"),
      category: sportName(match),
      live: liveIds.has(id),
      date: timestamp(match?.date)
    };
  }

  function uniqueMatches(matches) {
    const map = new Map();

    matches.forEach((match) => {
      const id = eventId(match);

      if (!id || map.has(id)) {
        return;
      }

      map.set(id, match);
    });

    return Array.from(map.values());
  }

  function buildEvents(discovery) {
    const liveMatches = Array.isArray(discovery?.live?.data)
      ? discovery.live.data
      : [];
    const todayMatches = Array.isArray(discovery?.today?.data)
      ? discovery.today.data
      : [];

    const liveIds = new Set(liveMatches.map(eventId));
    const live = uniqueMatches(liveMatches)
      .map((match) => normalize(match, liveIds));

    const upcoming = uniqueMatches(todayMatches)
      .map((match) => normalize(match, liveIds))
      .filter((match) => {
        return (
          !match.live &&
          match.date > Date.now()
        );
      })
      .sort((left, right) => left.date - right.date)
      .slice(0, 6);

    return [...live, ...upcoming];
  }

  function render() {
    if (!events.length) {
      list.innerHTML = `
        <div class="ec-live-event-rail-loading">
          No live or upcoming events are currently listed.
        </div>
      `;
      count.textContent = "No events";
      updateArrows();
      return;
    }

    const liveCount = events.filter((event) => event.live).length;
    const upcomingCount = events.length - liveCount;

    count.textContent =
      liveCount && upcomingCount
        ? `${liveCount} live · ${upcomingCount} next`
        : liveCount
          ? `${liveCount} live now`
          : `${upcomingCount} upcoming`;

    list.innerHTML = events
      .map((event) => {
        const label = event.live
          ? "LIVE"
          : upcomingLabel(event);

        return `
          <button
            class="ec-live-event-rail-item${event.live ? " is-live" : ""}${event.id === activeEventId ? " is-active" : ""}"
            type="button"
            data-live-rail-event="${escapeHtml(event.id)}"
            ${event.id.startsWith("demo-") ? 'data-demo-event="true"' : ""}
            title="${escapeHtml(event.title)}"
          >
            <span class="ec-live-event-rail-status">${escapeHtml(label)}</span>
            <span class="ec-live-event-rail-copy">
              <strong>${escapeHtml(event.title)}</strong>
              <small>
                <span>${escapeHtml(event.category)}</span>
                <b>${event.live ? "●" : "Next"}</b>
              </small>
            </span>
          </button>
        `;
      })
      .join("");

    updateArrows();
  }

  function setRailVisible(visible) {
    rail.hidden = !visible;
    showButton.hidden = visible;
  }

  function updateArrows() {
    const maxScroll =
      viewport.scrollWidth - viewport.clientWidth;

    previous.disabled = viewport.scrollLeft <= 4;
    next.disabled =
      maxScroll <= 4 ||
      viewport.scrollLeft >= maxScroll - 4;
  }

  function scrollRail(direction) {
    const distance = Math.max(
      220,
      Math.round(viewport.clientWidth * .72)
    );

    viewport.scrollBy({
      left: distance * direction,
      behavior: "smooth"
    });
  }

  function loadEvent(event) {
    if (!event || event.id.startsWith("demo-")) {
      window.showToast?.(
        "Demo card only — live API data will be clickable when available."
      );
      return;
    }

    activeEventId = event.id;
    render();

    const url = new URL(
      "player.html",
      window.location.href
    );

    url.searchParams.set("shell", "1");
    url.searchParams.set("event", event.id);

    if (loader && loaderLabel) {
      loaderLabel.textContent = `Opening ${event.title}`;
      loader.classList.remove("is-hidden");
    }

    playerFrame.src = url.href;

    playerFrame.addEventListener(
      "load",
      () => {
        loader?.classList.add("is-hidden");
      },
      { once: true }
    );

    window.showToast?.(
      `Switching to ${event.title}`
    );
  }

  async function loadDiscovery() {
    if (!API?.getDiscovery) {
      events = fallbackEvents;
      render();
      return;
    }

    try {
      const discovery = await API.getDiscovery();
      events = buildEvents(discovery);

      if (!events.length) {
        events = fallbackEvents;
      }

      render();
    } catch {
      events = fallbackEvents;
      render();
      count.textContent = "Demo data";
    }
  }

  list.addEventListener("click", (clickEvent) => {
    const button = clickEvent.target.closest(
      "[data-live-rail-event]"
    );

    if (!button) {
      return;
    }

    const event = events.find(
      (candidate) =>
        candidate.id === button.dataset.liveRailEvent
    );

    loadEvent(event);
  });

  hideButton.addEventListener(
    "click",
    () => setRailVisible(false)
  );

  showButton.addEventListener(
    "click",
    () => setRailVisible(true)
  );

  previous.addEventListener(
    "click",
    () => scrollRail(-1)
  );

  next.addEventListener(
    "click",
    () => scrollRail(1)
  );

  viewport.addEventListener(
    "scroll",
    updateArrows,
    { passive: true }
  );

  window.addEventListener(
    "resize",
    updateArrows
  );

  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollRail(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollRail(1);
    }
  });

  loadDiscovery();
})();

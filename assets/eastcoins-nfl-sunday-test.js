(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;

  const grid = document.getElementById("nflMultiviewGrid");
  const railList = document.getElementById("nflRailList");
  const railViewport = document.getElementById("nflRailViewport");
  const railPrevious = document.getElementById("nflRailPrevious");
  const railNext = document.getElementById("nflRailNext");
  const railSummary = document.getElementById("nflRailSummary");

  const alertButton = document.getElementById("nflAlertCenterButton");
  const alertCount = document.getElementById("nflAlertCount");
  const alertCenter = document.getElementById("nflAlertCenter");
  const alertCenterClose = document.getElementById("nflAlertCenterClose");
  const alertList = document.getElementById("nflAlertList");
  const demoAlertButton = document.getElementById("nflDemoAlertButton");

  const kickoffAlert = document.getElementById("nflKickoffAlert");
  const kickoffAlertTitle = document.getElementById("nflKickoffAlertTitle");
  const kickoffAlertMeta = document.getElementById("nflKickoffAlertMeta");
  const kickoffWatch = document.getElementById("nflKickoffWatch");
  const kickoffAdd = document.getElementById("nflKickoffAdd");
  const kickoffDismiss = document.getElementById("nflKickoffDismiss");

  const panels = Array.from(
    document.querySelectorAll("[data-nfl-slot]")
  );

  const TEAM_WORDS = [
    "49ers", "bears", "bengals", "bills", "broncos", "browns",
    "buccaneers", "cardinals", "chargers", "chiefs", "colts",
    "commanders", "cowboys", "dolphins", "eagles", "falcons",
    "giants", "jaguars", "jets", "lions", "packers", "panthers",
    "patriots", "raiders", "rams", "ravens", "saints", "seahawks",
    "steelers", "texans", "titans", "vikings"
  ];

  const FALLBACK = [
    {
      id: "demo-gb-chi",
      title: "Packers @ Bears",
      category: "NFL",
      live: true,
      start: Date.now() - 48 * 60 * 1000,
      demo: true
    },
    {
      id: "demo-buf-ne",
      title: "Bills @ Patriots",
      category: "NFL",
      live: true,
      start: Date.now() - 22 * 60 * 1000,
      demo: true
    },
    {
      id: "demo-phi-nyg",
      title: "Eagles @ Giants",
      category: "NFL",
      live: true,
      start: Date.now() - 9 * 60 * 1000,
      demo: true
    },
    {
      id: "demo-kc-lac",
      title: "Chiefs @ Chargers",
      category: "NFL",
      live: false,
      start: Date.now() + 5 * 60 * 1000,
      demo: true
    },
    {
      id: "demo-bal-cin",
      title: "Ravens @ Bengals",
      category: "NFL",
      live: false,
      start: Date.now() + 42 * 60 * 1000,
      demo: true
    },
    {
      id: "demo-dal-was",
      title: "Cowboys @ Commanders",
      category: "NFL",
      live: false,
      start: Date.now() + 2 * 60 * 60 * 1000,
      demo: true
    }
  ];

  let events = [];
  let slots = [null, null, null, null];
  let reminders = new Map();
  let activeAlertEvent = null;

  function eventId(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      ""
    );
  }

  function timestamp(value) {
    let numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }

    if (numeric < 1_000_000_000_000) {
      numeric *= 1000;
    }

    return numeric;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function categoryText(match) {
    return String(
      match?._eastcoinProviders?.ppv?.category ||
      match?.category ||
      "NFL"
    );
  }

  function isNfl(match) {
    const category = categoryText(match).toLowerCase();
    const title = String(match?.title || "").toLowerCase();

    if (
      category.includes("nfl") ||
      category.includes("american football") ||
      category.includes("american-football")
    ) {
      return true;
    }

    return TEAM_WORDS.some((team) => title.includes(team));
  }

  function normalize(match, liveIds) {
    const id = eventId(match);
    const live =
      Boolean(match?._eastcoinLive) ||
      liveIds.has(id);

    return {
      id,
      title: String(match?.title || id || "NFL game"),
      category: "NFL",
      live,
      start: timestamp(match?.date),
      raw: match,
      demo: false
    };
  }

  function buildEvents(discovery) {
    const liveRaw = Array.isArray(discovery?.live?.data)
      ? discovery.live.data
      : [];

    const todayRaw = Array.isArray(discovery?.today?.data)
      ? discovery.today.data
      : [];

    const liveIds = new Set(liveRaw.map(eventId));
    const byId = new Map();

    [...liveRaw, ...todayRaw]
      .filter(isNfl)
      .forEach((match) => {
        const id = eventId(match);

        if (!id || byId.has(id)) {
          return;
        }

        byId.set(id, normalize(match, liveIds));
      });

    return Array.from(byId.values())
      .sort((left, right) => {
        if (left.live !== right.live) {
          return Number(right.live) - Number(left.live);
        }

        return (left.start || Infinity) - (right.start || Infinity);
      });
  }

  function mergeWithFallback(realEvents) {
    if (realEvents.length >= 6) {
      return realEvents.slice(0, 10);
    }

    const output = [...realEvents];

    FALLBACK.forEach((event) => {
      if (output.length >= 8) {
        return;
      }

      if (
        output.some((candidate) =>
          candidate.title.toLowerCase() === event.title.toLowerCase()
        )
      ) {
        return;
      }

      output.push({ ...event });
    });

    return output;
  }

  function gameStatus(event) {
    if (!event) {
      return "EMPTY";
    }

    if (event.live) {
      return "LIVE";
    }

    const difference = event.start - Date.now();

    if (!event.start || difference <= 0) {
      return "SOON";
    }

    const minutes = Math.ceil(difference / 60_000);

    if (minutes < 60) {
      return `${minutes} MIN`;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;

    return remainder
      ? `${hours}H ${remainder}M`
      : `${hours}H`;
  }

  function gameMeta(event) {
    if (!event) {
      return "From the rail or an alert";
    }

    if (event.live) {
      return event.demo
        ? "Prototype live game"
        : "Available through EastCoin";
    }

    if (!event.start) {
      return "Upcoming NFL event";
    }

    return new Date(event.start).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function renderPanels() {
    panels.forEach((panel, index) => {
      const event = slots[index];
      const title = panel.querySelector("[data-nfl-panel-title]");
      const matchup = panel.querySelector("[data-nfl-panel-matchup]");
      const status = panel.querySelector("[data-nfl-panel-status]");
      const meta = panel.querySelector("[data-nfl-panel-meta]");

      panel.dataset.state = event?.live
        ? "live"
        : event
          ? "upcoming"
          : "empty";

      if (title) {
        title.textContent =
          index === 0
            ? (event?.title || "Featured game")
            : (event?.title || `Game ${index + 1}`);
      }

      if (matchup) {
        matchup.textContent =
          event?.title ||
          (index === 0 ? "Select an NFL game" : "Add a game");
      }

      if (status) {
        status.textContent = gameStatus(event);
      }

      if (meta) {
        meta.textContent = gameMeta(event);
      }
    });

    renderRail();
  }

  function addToMultiview(event) {
    if (!event) return;

    const existing = slots.findIndex(
      (candidate) => candidate?.id === event.id
    );

    if (existing !== -1) {
      if (existing !== 0) {
        promote(existing);
      }
      return;
    }

    let target = slots.findIndex(
      (candidate, index) => index > 0 && !candidate
    );

    if (target === -1) {
      target = 3;
    }

    slots[target] = event;
    renderPanels();
    window.showToast?.(`${event.title} added to MultiView`);
  }

  function watchFeatured(event) {
    if (!event) return;

    const existing = slots.findIndex(
      (candidate) => candidate?.id === event.id
    );

    if (existing === 0) {
      return;
    }

    if (existing > 0) {
      promote(existing);
      return;
    }

    const previousFeatured = slots[0];
    slots[0] = event;

    if (previousFeatured) {
      const empty = slots.findIndex(
        (candidate, index) => index > 0 && !candidate
      );

      if (empty > 0) {
        slots[empty] = previousFeatured;
      }
    }

    renderPanels();
  }

  function promote(index) {
    if (index <= 0 || !slots[index]) {
      return;
    }

    [slots[0], slots[index]] = [
      slots[index],
      slots[0]
    ];

    renderPanels();
    window.showToast?.(`${slots[0].title} promoted to featured`);
  }

  function clearSlot(index) {
    slots[index] = null;
    renderPanels();
  }

  function openLivePlayer(index) {
    const event = slots[index];

    if (!event) {
      window.showToast?.("Add a game to this panel first.");
      return;
    }

    if (event.demo) {
      window.showToast?.("Demo matchup only — use a live API event to open the player.");
      return;
    }

    const url = new URL("index.html", window.location.href);
    url.searchParams.set("event", event.id);
    window.location.href = url.href;
  }

  function reminderLabel(event) {
    if (!event?.start) {
      return "Reminder armed";
    }

    const difference = event.start - Date.now();
    const minutes = Math.max(0, Math.ceil(difference / 60_000));

    return minutes <= 60
      ? `Starts in ${minutes}m`
      : new Date(event.start).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit"
        });
  }

  function renderReminderCenter() {
    const reminderEvents = Array.from(reminders.values());

    alertCount.textContent = String(reminderEvents.length);

    if (!reminderEvents.length) {
      alertList.innerHTML = `
        <p>No reminders armed yet. Use the bell on an upcoming game.</p>
      `;
      return;
    }

    alertList.innerHTML = reminderEvents.map((event) => `
      <article class="nfl-alert-item">
        <div>
          <strong>${escapeHtml(event.title)}</strong>
          <small>${escapeHtml(reminderLabel(event))}</small>
        </div>
        <button type="button" data-nfl-remove-reminder="${escapeHtml(event.id)}">Remove</button>
      </article>
    `).join("");
  }

  function toggleReminder(event) {
    if (!event || event.live) {
      return;
    }

    if (reminders.has(event.id)) {
      reminders.delete(event.id);
      window.showToast?.(`Reminder removed for ${event.title}`);
    } else {
      reminders.set(event.id, event);
      window.showToast?.(`Reminder armed for ${event.title}`);
    }

    renderReminderCenter();
    renderRail();
  }

  function showKickoffAlert(event) {
    if (!event) return;

    activeAlertEvent = event;
    kickoffAlertTitle.textContent = event.title;
    kickoffAlertMeta.textContent = event.live
      ? "This game is live now."
      : `${reminderLabel(event)} · prototype alert`;

    kickoffAlert.hidden = false;
  }

  function hideKickoffAlert() {
    kickoffAlert.hidden = true;
    activeAlertEvent = null;
  }

  function renderRail() {
    if (!events.length) {
      railList.innerHTML = `
        <div class="nfl-rail-loading">No NFL events available.</div>
      `;
      railSummary.textContent = "No games";
      return;
    }

    const liveCount = events.filter((event) => event.live).length;
    const upcomingCount = events.length - liveCount;

    railSummary.textContent =
      `${liveCount} live · ${upcomingCount} upcoming`;

    railList.innerHTML = events.map((event) => {
      const featured = slots[0]?.id === event.id;
      const armed = reminders.has(event.id);

      return `
        <article
          class="nfl-rail-card${event.live ? " is-live" : ""}${featured ? " is-featured" : ""}"
          data-nfl-rail-event="${escapeHtml(event.id)}"
        >
          <button
            class="nfl-rail-status"
            type="button"
            data-nfl-watch-event="${escapeHtml(event.id)}"
            title="${event.live ? "Make featured" : "Preview this game"}"
          >${escapeHtml(gameStatus(event))}</button>

          <button
            class="nfl-rail-copy"
            type="button"
            data-nfl-watch-event="${escapeHtml(event.id)}"
          >
            <strong>${escapeHtml(event.title)}</strong>
            <small>${escapeHtml(event.live ? "Click to make featured" : gameMeta(event))}</small>
          </button>

          <span class="nfl-rail-actions">
            ${
              event.live
                ? `<button type="button" data-nfl-add-event="${escapeHtml(event.id)}" title="Add to MultiView">＋</button>`
                : `<button class="${armed ? "is-armed" : ""}" type="button" data-nfl-remind-event="${escapeHtml(event.id)}" title="${armed ? "Reminder armed" : "Remind me"}">🔔</button>`
            }
          </span>
        </article>
      `;
    }).join("");
  }

  function eventById(id) {
    return events.find((event) => event.id === id) || null;
  }

  function setLayout(mode) {
    grid.classList.toggle("is-grid", mode === "grid");

    document
      .querySelectorAll("[data-nfl-layout]")
      .forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.dataset.nflLayout === mode
        );
      });
  }

  async function loadEvents() {
    let realEvents = [];

    try {
      if (API?.getDiscovery) {
        const discovery = await API.getDiscovery();
        realEvents = buildEvents(discovery);
      }
    } catch {}

    events = mergeWithFallback(realEvents);

    const live = events.filter((event) => event.live);
    const upcoming = events.filter((event) => !event.live);

    slots = [
      live[0] || events[0] || null,
      live[1] || events[1] || null,
      live[2] || events[2] || null,
      live[3] || upcoming[0] || events[3] || null
    ];

    renderPanels();
    renderReminderCenter();

    /*
      Automatically arm the first upcoming demo/real game so the feature
      is visible immediately without requiring browser notification access.
    */
    const nextGame = upcoming[0];

    if (nextGame) {
      reminders.set(nextGame.id, nextGame);
      renderReminderCenter();
      renderRail();

      window.setTimeout(() => {
        if (reminders.has(nextGame.id)) {
          showKickoffAlert(nextGame);
        }
      }, 6500);
    }
  }

  document.addEventListener("click", (event) => {
    const layout = event.target.closest("[data-nfl-layout]");
    if (layout) {
      setLayout(layout.dataset.nflLayout);
      return;
    }

    const promoteButton = event.target.closest("[data-nfl-promote]");
    if (promoteButton) {
      promote(Number(promoteButton.dataset.nflPromote));
      return;
    }

    const clearButton = event.target.closest("[data-nfl-clear-slot]");
    if (clearButton) {
      clearSlot(Number(clearButton.dataset.nflClearSlot));
      return;
    }

    const openButton = event.target.closest("[data-nfl-open-player]");
    if (openButton) {
      openLivePlayer(Number(openButton.dataset.nflOpenPlayer));
      return;
    }

    const watch = event.target.closest("[data-nfl-watch-event]");
    if (watch) {
      watchFeatured(eventById(watch.dataset.nflWatchEvent));
      return;
    }

    const add = event.target.closest("[data-nfl-add-event]");
    if (add) {
      addToMultiview(eventById(add.dataset.nflAddEvent));
      return;
    }

    const remind = event.target.closest("[data-nfl-remind-event]");
    if (remind) {
      toggleReminder(eventById(remind.dataset.nflRemindEvent));
      return;
    }

    const removeReminder = event.target.closest("[data-nfl-remove-reminder]");
    if (removeReminder) {
      const reminderEvent = eventById(
        removeReminder.dataset.nflRemoveReminder
      );

      if (reminderEvent) {
        toggleReminder(reminderEvent);
      }
    }
  });

  alertButton.addEventListener("click", () => {
    alertCenter.hidden = !alertCenter.hidden;
    alertButton.setAttribute(
      "aria-expanded",
      String(!alertCenter.hidden)
    );
  });

  alertCenterClose.addEventListener("click", () => {
    alertCenter.hidden = true;
    alertButton.setAttribute("aria-expanded", "false");
  });

  demoAlertButton.addEventListener("click", () => {
    const target =
      events.find((event) => !event.live) ||
      events[0];

    showKickoffAlert(target);
  });

  kickoffDismiss.addEventListener("click", hideKickoffAlert);

  kickoffWatch.addEventListener("click", () => {
    if (activeAlertEvent) {
      watchFeatured(activeAlertEvent);
    }

    hideKickoffAlert();
  });

  kickoffAdd.addEventListener("click", () => {
    if (activeAlertEvent) {
      addToMultiview(activeAlertEvent);
    }

    hideKickoffAlert();
  });

  railPrevious.addEventListener("click", () => {
    railViewport.scrollBy({
      left: -Math.max(220, railViewport.clientWidth * .72),
      behavior: "smooth"
    });
  });

  railNext.addEventListener("click", () => {
    railViewport.scrollBy({
      left: Math.max(220, railViewport.clientWidth * .72),
      behavior: "smooth"
    });
  });

  /*
    The production shell's outer player is intentionally left mounted under
    this prototype overlay. That lets navigation, settings and Twitch chat
    behave exactly as they do on the real EastCoin shell while the NFL UI is
    evaluated independently.
  */
  loadEvents();
})();

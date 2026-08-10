(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const PPV = window.EastcoinPpvAPI;

  const eventList = document.getElementById("ptEventList");
  const searchInput = document.getElementById("ptSearch");
  const filterButtons = Array.from(
    document.querySelectorAll("[data-filter]")
  );
  const refreshButton = document.getElementById("ptRefresh");
  const directoryStatus = document.getElementById("ptDirectoryStatus");

  const streamedHealth = document.getElementById("ptStreamedHealth");
  const ppvHealth = document.getElementById("ptPpvHealth");
  const streamedHealthCard = document.querySelector('[data-health="streamed"]');
  const ppvHealthCard = document.querySelector('[data-health="ppv"]');

  const totalCount = document.getElementById("ptTotalCount");
  const bothCount = document.getElementById("ptBothCount");
  const streamedOnlyCount = document.getElementById("ptStreamedOnlyCount");
  const ppvOnlyCount = document.getElementById("ptPpvOnlyCount");
  const playablePpvCount = document.getElementById("ptPlayablePpvCount");

  const playerTitle = document.getElementById("ptPlayerTitle");
  const serverRow = document.getElementById("ptServerRow");
  const playerStage = document.getElementById("ptPlayerStage");
  const clearPlayer = document.getElementById("ptClearPlayer");
  const debugTitle = document.getElementById("ptDebugTitle");
  const debugOutput = document.getElementById("ptDebugOutput");
  const toast = document.getElementById("ptToast");

  let activeFilter = "all";
  let unifiedEvents = [];
  let selectedEvent = null;
  let countdownTimer = 0;
  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => toast.classList.remove("show"),
      2400
    );
  }

  function setHealth(card, copy, state, message) {
    if (card) card.dataset.state = state;
    if (copy) copy.textContent = message;
  }

  function eventTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric < 1_000_000_000_000
      ? numeric * 1000
      : numeric;
  }

  function eventId(event) {
    return String(event?.id || event?.title || "");
  }

  function dedupe(matches) {
    const map = new Map();

    matches.forEach((match) => {
      const id = eventId(match);
      if (!id) return;

      const existing = map.get(id);
      if (!existing || (match.sources?.length || 0) > (existing.sources?.length || 0)) {
        map.set(id, match);
      }
    });

    return Array.from(map.values());
  }

  function providerFlags(event) {
    const providers = event?._eastcoinProviders || {};
    const hasPpv = Boolean(
      providers.ppv ||
      event?.sources?.some(
        (source) => String(source?.source || "").toLowerCase() === "ppv"
      )
    );
    const hasStreamed = Boolean(
      providers.streamed ||
      event?.sources?.some(
        (source) => String(source?.source || "").toLowerCase() !== "ppv"
      )
    );

    return { hasPpv, hasStreamed };
  }

  function providerType(event) {
    const { hasPpv, hasStreamed } = providerFlags(event);
    if (hasPpv && hasStreamed) return "both";
    return hasPpv ? "ppv" : "streamed";
  }

  function eventIsLive(event) {
    return Boolean(event?._eastcoinLive);
  }

  function isStartingSoon(event) {
    if (eventIsLive(event)) return false;
    const start = eventTimestamp(event?.date);
    if (!start) return false;
    const difference = start - Date.now();
    return difference > 0 && difference <= 6 * 60 * 60 * 1000;
  }

  function countdown(event) {
    if (eventIsLive(event)) return "LIVE";

    const start = eventTimestamp(event?.date);
    if (!start) return "Time unavailable";

    const difference = start - Date.now();
    if (difference <= 0) return "Starting now";

    const minutes = Math.ceil(difference / 60000);
    if (minutes < 60) return `Starts in ${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours < 24) {
      return remainder
        ? `Starts in ${hours}h ${remainder}m`
        : `Starts in ${hours}h`;
    }

    return new Date(start).toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function providerBadges(event) {
    const { hasPpv, hasStreamed } = providerFlags(event);
    const badges = [];

    if (hasStreamed) {
      badges.push('<span class="pt-provider-badge is-streamed">Streamed</span>');
    }
    if (hasPpv) {
      badges.push('<span class="pt-provider-badge is-ppv">PPV</span>');
    }

    return badges.join("");
  }

  function eventImage(event) {
    const poster = API?.posterUrl?.(event?.poster) || "";

    if (!poster) {
      return '<div class="pt-event-image pt-event-image-empty">EC</div>';
    }

    return `
      <div class="pt-event-image">
        <img src="${escapeHtml(poster)}" alt="" loading="lazy" data-event-image>
        <span>EC</span>
      </div>
    `;
  }

  function eventMatchesFilter(event) {
    const type = providerType(event);

    if (activeFilter === "live") return eventIsLive(event);
    if (activeFilter === "soon") return isStartingSoon(event);
    if (activeFilter === "both") return type === "both";
    if (activeFilter === "streamed") return providerFlags(event).hasStreamed;
    if (activeFilter === "ppv") return providerFlags(event).hasPpv;
    return true;
  }

  function filteredEvents() {
    const query = String(searchInput?.value || "").trim().toLowerCase();

    return unifiedEvents.filter((event) => {
      if (!eventMatchesFilter(event)) return false;
      if (!query) return true;

      return [
        event.title,
        event.category,
        event.id,
        event?._eastcoinProviders?.ppv?.tag,
        event?._eastcoinProviders?.ppv?.uriName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function renderEvents() {
    const events = filteredEvents();

    directoryStatus.textContent =
      `${events.length} of ${unifiedEvents.length} unified events`;

    if (!events.length) {
      eventList.innerHTML = '<div class="pt-loading-card">No events match this filter.</div>';
      return;
    }

    eventList.innerHTML = events.map((event) => {
      const type = providerType(event);
      const ppv = event?._eastcoinProviders?.ppv;

      return `
        <button
          class="pt-event-card ${eventId(event) === eventId(selectedEvent) ? "is-selected" : ""}"
          type="button"
          data-event-id="${escapeHtml(eventId(event))}">
          ${eventImage(event)}
          <span class="pt-event-copy">
            <span class="pt-event-topline">
              <span>${escapeHtml(event.category || "Event")}</span>
              <span class="pt-event-status ${eventIsLive(event) ? "is-live" : ""}" data-event-countdown="${escapeHtml(eventId(event))}">
                ${escapeHtml(countdown(event))}
              </span>
            </span>
            <strong>${escapeHtml(event.title || eventId(event))}</strong>
            <small>
              ${providerBadges(event)}
              ${type === "both" ? '<span class="pt-match-score">merged event</span>' : ""}
              ${ppv && !ppv.iframeReady ? '<span class="pt-warning-pill">PPV embed pending</span>' : ""}
            </small>
          </span>
        </button>
      `;
    }).join("");

    eventList.querySelectorAll("[data-event-image]").forEach((image) => {
      image.addEventListener("error", () => image.remove(), { once: true });
    });

    eventList.querySelectorAll("[data-event-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const event = unifiedEvents.find(
          (candidate) => eventId(candidate) === button.dataset.eventId
        );
        if (event) selectEvent(event);
      });
    });
  }

  function updateCountdowns() {
    document.querySelectorAll("[data-event-countdown]").forEach((element) => {
      const event = unifiedEvents.find(
        (candidate) => eventId(candidate) === element.dataset.eventCountdown
      );
      if (!event) return;
      const next = countdown(event);
      if (element.textContent.trim() !== next) element.textContent = next;
    });
  }

  function updateStats(ppvCatalog) {
    let both = 0;
    let streamedOnly = 0;
    let ppvOnly = 0;

    unifiedEvents.forEach((event) => {
      const type = providerType(event);
      if (type === "both") both += 1;
      else if (type === "ppv") ppvOnly += 1;
      else streamedOnly += 1;
    });

    const ppvReady = (ppvCatalog?.streams || []).filter(
      (stream) => PPV?.iframeReady?.(stream)
    ).length;

    totalCount.textContent = String(unifiedEvents.length);
    bothCount.textContent = String(both);
    streamedOnlyCount.textContent = String(streamedOnly);
    ppvOnlyCount.textContent = String(ppvOnly);
    playablePpvCount.textContent = String(ppvReady);
  }

  function debugValue(event) {
    const providers = event?._eastcoinProviders || {};

    return {
      id: event.id,
      title: event.title,
      category: event.category,
      date: eventTimestamp(event.date)
        ? new Date(eventTimestamp(event.date)).toISOString()
        : null,
      live: eventIsLive(event),
      providers,
      sources: event.sources || []
    };
  }

  function emptyPlayer(message = "Choose an event") {
    playerStage.innerHTML = `
      <div class="pt-player-empty">
        <span>▶</span>
        <strong>${escapeHtml(message)}</strong>
        <p>Select a provider server to render the exact production playback path here.</p>
      </div>
    `;
  }

  function playServer(server, event) {
    serverRow.querySelectorAll("button").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.serverKey === server.key
      );
    });

    playerStage.innerHTML = "";
    const frame = document.createElement("iframe");
    frame.src = server.embedUrl;
    frame.title = `${event.title || "EastCoin event"} · ${server.source || "server"}`;
    frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    playerStage.appendChild(frame);
  }

  async function selectEvent(event) {
    selectedEvent = event;
    renderEvents();

    playerTitle.textContent = event.title || "EastCoin event";
    clearPlayer.hidden = false;
    debugTitle.textContent = event.title || eventId(event);
    debugOutput.textContent = JSON.stringify(debugValue(event), null, 2);

    serverRow.hidden = false;
    serverRow.innerHTML = '<span class="pt-server-loading">Loading production server list…</span>';
    emptyPlayer("Loading servers…");

    try {
      const streams = await API.getStreams(event, false);

      if (eventId(selectedEvent) !== eventId(event)) return;

      serverRow.innerHTML = "";

      streams.forEach((server, index) => {
        const key = `${server.source || "server"}:${server.streamNo ?? index}:${index}`;
        server.key = key;

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.serverKey = key;
        button.dataset.provider = String(server.provider || server.source || "").toLowerCase();
        button.textContent = `${server.source || "Server"} ${server.streamNo ?? index + 1}`;
        button.addEventListener("click", () => playServer(server, event));
        serverRow.appendChild(button);
      });

      if (streams[0]) {
        playServer(streams[0], event);
      } else {
        emptyPlayer("No playable servers returned");
      }
    } catch (error) {
      serverRow.innerHTML = '<span class="pt-server-loading">No playable sources returned.</span>';
      emptyPlayer(error?.message || "Provider playback failed");
    }
  }

  function clearSelection() {
    selectedEvent = null;
    playerTitle.textContent = "Choose an event";
    clearPlayer.hidden = true;
    serverRow.hidden = true;
    serverRow.innerHTML = "";
    debugTitle.textContent = "No event selected";
    debugOutput.textContent =
      "Select an event to inspect the production unified event object.";
    emptyPlayer();
    renderEvents();
  }

  clearPlayer?.addEventListener("click", clearSelection);

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";
      filterButtons.forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
      renderEvents();
    });
  });

  searchInput?.addEventListener("input", renderEvents);

  async function loadProviders(force = false) {
    refreshButton.disabled = true;
    refreshButton.textContent = "↻ Loading…";
    directoryStatus.textContent = "Loading production provider layer…";

    setHealth(streamedHealthCard, streamedHealth, "loading", "Loading…");
    setHealth(ppvHealthCard, ppvHealth, "loading", "Loading…");

    try {
      const [discovery, ppvCatalog] = await Promise.all([
        API.getDiscovery({ forceMatches: force }),
        PPV.getCatalog(force)
      ]);

      unifiedEvents = dedupe([
        ...(discovery.live.data || []),
        ...(discovery.today.data || [])
      ]);

      const streamedCount = unifiedEvents.filter(
        (event) => providerFlags(event).hasStreamed
      ).length;
      const ppvCount = unifiedEvents.filter(
        (event) => providerFlags(event).hasPpv
      ).length;

      setHealth(
        streamedHealthCard,
        streamedHealth,
        discovery.live.stale || discovery.today.stale ? "warning" : "ok",
        `${streamedCount} unified events`
      );
      setHealth(
        ppvHealthCard,
        ppvHealth,
        ppvCatalog.stale ? "warning" : "ok",
        `${ppvCount} unified events`
      );

      updateStats(ppvCatalog);
      renderEvents();
    } catch (error) {
      eventList.innerHTML = `
        <div class="pt-loading-card is-error">
          ${escapeHtml(error?.message || "Provider layer failed.")}
        </div>
      `;
      directoryStatus.textContent = "Provider load failed";
      setHealth(streamedHealthCard, streamedHealth, "error", "Unavailable");
      setHealth(ppvHealthCard, ppvHealth, "error", "Unavailable");
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ Refresh APIs";
    }
  }

  refreshButton?.addEventListener("click", () => loadProviders(true));

  countdownTimer = window.setInterval(updateCountdowns, 15_000);
  window.addEventListener(
    "pagehide",
    () => window.clearInterval(countdownTimer),
    { once: true }
  );

  if (!API || !PPV) {
    eventList.innerHTML = '<div class="pt-loading-card is-error">The production provider adapters did not load.</div>';
    return;
  }

  loadProviders(false);
})();

(() => {
  "use strict";

  const WORKER_KEY = "eastcoinDlstreamsPrototypeWorker";
  const DEFAULT_WORKER = "http://127.0.0.1:8787";

  const workerInput = document.getElementById("dlWorkerUrl");
  const connectButton = document.getElementById("dlConnect");
  const refreshButton = document.getElementById("dlRefresh");
  const status = document.getElementById("dlStatus");
  const searchInput = document.getElementById("dlSearch");
  const sportSelect = document.getElementById("dlSport");
  const liveOnly = document.getElementById("dlLiveOnly");
  const eventsRoot = document.getElementById("dlEvents");
  const statEvents = document.getElementById("dlStatEvents");
  const statChannels = document.getElementById("dlStatChannels");
  const statSports = document.getElementById("dlStatSports");
  const statCache = document.getElementById("dlStatCache");
  const frame = document.getElementById("dlFrame");
  const empty = document.getElementById("dlEmpty");
  const playerTitle = document.getElementById("dlPlayerTitle");
  const playerMeta = document.getElementById("dlPlayerMeta");
  const nextPlayer = document.getElementById("dlNextPlayer");
  const openSource = document.getElementById("dlOpenSource");
  const debug = document.getElementById("dlDebug");

  let payload = null;
  let activeChannel = null;
  let activeEmbedIndex = 0;

  workerInput.value = readWorker();

  connectButton.addEventListener("click", () => load(false));
  refreshButton.addEventListener("click", () => load(true));
  searchInput.addEventListener("input", render);
  sportSelect.addEventListener("change", render);
  liveOnly.addEventListener("click", () => {
    liveOnly.classList.toggle("is-active");
    liveOnly.dataset.enabled =
      liveOnly.dataset.enabled === "true" ? "false" : "true";
    liveOnly.textContent =
      liveOnly.dataset.enabled === "true" ? "Live-ish only: on" : "Live-ish only: off";
    render();
  });
  nextPlayer.addEventListener("click", () => {
    if (!activeChannel?.embedUrls?.length) return;
    activeEmbedIndex = (activeEmbedIndex + 1) % activeChannel.embedUrls.length;
    loadActiveEmbed();
  });
  openSource.addEventListener("click", () => {
    if (!activeChannel?.watchUrl) return;
    window.open(activeChannel.watchUrl, "_blank", "noopener,noreferrer");
  });

  function readWorker() {
    try {
      return localStorage.getItem(WORKER_KEY) || DEFAULT_WORKER;
    } catch {
      return DEFAULT_WORKER;
    }
  }

  function normalizedWorker() {
    return String(workerInput.value || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function saveWorker(value) {
    try { localStorage.setItem(WORKER_KEY, value); } catch {}
  }

  function setStatus(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }

  async function load(force) {
    const base = normalizedWorker();
    if (!/^https?:\/\//i.test(base)) {
      setStatus("Enter a full Worker URL, including https://.", "error");
      return;
    }

    saveWorker(base);
    connectButton.disabled = true;
    refreshButton.disabled = true;
    setStatus(force ? "Forcing a fresh DLStreams schedule fetch…" : "Loading DLStreams schedule…");

    try {
      const health = await fetch(`${base}/health`, { cache: "no-store" });
      if (!health.ok) throw new Error(`Worker health returned ${health.status}.`);

      const response = await fetch(
        `${base}/schedule${force ? "?force=1" : ""}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || `Schedule returned ${response.status}.`);
      }

      payload = data;
      populateSportOptions();
      renderStats();
      render();
      setStatus(
        `Connected. Parsed ${data.summary.eventCount} public schedule events from DLStreams.`,
        "ok"
      );
    } catch (error) {
      payload = null;
      eventsRoot.innerHTML = `<div class="dl-empty">${escapeHtml(error.message || String(error))}</div>`;
      setStatus(error.message || String(error), "error");
      renderStats();
    } finally {
      connectButton.disabled = false;
      refreshButton.disabled = false;
    }
  }

  function populateSportOptions() {
    const current = sportSelect.value;
    const sports = Object.entries(payload?.summary?.sports || {})
      .sort((a, b) => b[1] - a[1]);

    sportSelect.innerHTML =
      `<option value="">All sports</option>` +
      sports.map(([sport, count]) =>
        `<option value="${escapeHtml(sport)}">${escapeHtml(labelSport(sport))} (${count})</option>`
      ).join("");

    if ([...sportSelect.options].some((option) => option.value === current)) {
      sportSelect.value = current;
    }
  }

  function renderStats() {
    statEvents.textContent = String(payload?.summary?.eventCount || 0);
    statChannels.textContent = String(payload?.summary?.channelCount || 0);
    statSports.textContent = String(Object.keys(payload?.summary?.sports || {}).length);
    statCache.textContent = payload
      ? (payload.sourceFromCache ? "cached" : "fresh")
      : "—";
  }

  function filteredEvents() {
    const query = String(searchInput.value || "").trim().toLowerCase();
    const sport = sportSelect.value;
    const live = liveOnly.dataset.enabled === "true";
    const now = Date.now();

    return (payload?.events || []).filter((event) => {
      if (sport && event.sport !== sport) return false;

      if (query) {
        const haystack = [
          event.title,
          event.category,
          event.sport,
          ...(event.channels || []).map((channel) => channel.name)
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (live && event.timestamp) {
        const delta = now - Number(event.timestamp);
        if (delta < -45 * 60 * 1000 || delta > 5 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }

  function render() {
    if (!payload) return;

    const events = filteredEvents();

    if (!events.length) {
      eventsRoot.innerHTML =
        `<div class="dl-empty">No DLStreams prototype events match the current filters.</div>`;
      return;
    }

    eventsRoot.innerHTML = events.slice(0, 300).map((event) => {
      const channels = (event.channels || []).map((channel) => `
        <button
          class="dl-channel"
          type="button"
          data-channel-id="${escapeHtml(channel.id)}"
          data-event-id="${escapeHtml(event.id)}">
          ${escapeHtml(channel.name)}
        </button>
      `).join("");

      return `
        <article class="dl-event">
          <div class="dl-event-top">
            <div>
              <h2>${escapeHtml(event.title)}</h2>
              <div class="dl-meta">
                <span>${escapeHtml(labelSport(event.sport))}</span>
                <span>${escapeHtml(event.category || "Other")}</span>
                <span>${event.channels.length} source${event.channels.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div class="dl-time">${escapeHtml(formatTime(event))}</div>
          </div>
          <div class="dl-channels">${channels}</div>
        </article>
      `;
    }).join("");

    eventsRoot.querySelectorAll("[data-channel-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const event = payload.events.find((item) => item.id === button.dataset.eventId);
        const channel = event?.channels?.find((item) => item.id === button.dataset.channelId);
        if (event && channel) selectChannel(event, channel);
      });
    });
  }

  function selectChannel(event, channel) {
    activeChannel = channel;
    activeEmbedIndex = 0;
    playerTitle.textContent = event.title;
    playerMeta.textContent = `${channel.name} · DLStreams channel ${channel.id}`;
    nextPlayer.disabled = !(channel.embedUrls?.length > 1);
    openSource.disabled = false;
    empty.hidden = true;
    frame.hidden = false;
    loadActiveEmbed();
  }

  function loadActiveEmbed() {
    const url = activeChannel?.embedUrls?.[activeEmbedIndex] || activeChannel?.embedUrl;
    if (!url) return;

    frame.src = url;
    debug.textContent =
      `Player ${activeEmbedIndex + 1}/${activeChannel.embedUrls.length} · ${url}`;
  }

  function formatTime(event) {
    if (!event.timestamp) return `${event.time || "?"} UK`;
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(event.timestamp));
    } catch {
      return `${event.time || "?"} UK`;
    }
  }

  function labelSport(value) {
    const labels = {
      "american-football": "Football",
      baseball: "Baseball",
      basketball: "Basketball",
      hockey: "Hockey",
      soccer: "Soccer",
      combat: "UFC / Combat",
      wrestling: "Wrestling",
      motorsport: "Motorsport",
      tennis: "Tennis",
      golf: "Golf",
      other: "Other"
    };
    return labels[value] || value || "Other";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();

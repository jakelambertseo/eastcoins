(() => {
  "use strict";

  const Streamed = window.EastcoinStreamedAPI;
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
  const streamedHealthCard = document.querySelector(
    '[data-health="streamed"]'
  );
  const ppvHealthCard = document.querySelector(
    '[data-health="ppv"]'
  );

  const totalCount = document.getElementById("ptTotalCount");
  const bothCount = document.getElementById("ptBothCount");
  const streamedOnlyCount = document.getElementById(
    "ptStreamedOnlyCount"
  );
  const ppvOnlyCount = document.getElementById("ptPpvOnlyCount");
  const playablePpvCount = document.getElementById(
    "ptPlayablePpvCount"
  );

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
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => toast.classList.remove("show"),
      2400
    );
  }

  function setHealth(card, copy, state, message) {
    card.dataset.state = state;
    copy.textContent = message;
  }

  function eventTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }

    return numeric < 10_000_000_000
      ? numeric * 1000
      : numeric;
  }

  function cleanWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/\bversus\b/g, " vs ")
      .replace(/\bvs\.\b/g, " vs ")
      .replace(/\bv\.\b/g, " vs ")
      .replace(/\bv\b/g, " vs ")
      .replace(/\s+@\s+/g, " at ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sideKey(value) {
    return cleanWords(value)
      .replace(
        /\b(fc|cf|sc|afc|club|team|the)\b/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleParts(value) {
    const cleaned = cleanWords(value)
      .replace(/\s+vs\s+/g, " at ");

    const parts = cleaned
      .split(/\s+at\s+/)
      .map(sideKey)
      .filter(Boolean);

    if (parts.length === 2) {
      return parts.sort();
    }

    return [];
  }

  function titleKey(value) {
    const parts = titleParts(value);

    if (parts.length === 2) {
      return parts.join(" | ");
    }

    return sideKey(value);
  }

  function tokenSet(value) {
    return new Set(
      sideKey(value)
        .split(" ")
        .filter((token) => token.length > 1)
    );
  }

  function similarity(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);

    if (!a.size || !b.size) return 0;

    let intersection = 0;

    a.forEach((token) => {
      if (b.has(token)) intersection += 1;
    });

    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }

  function categoryFamily(value) {
    const text = cleanWords(value);

    const families = [
      ["basketball", ["basketball", "nba", "wnba", "ncaab"]],
      ["football", ["football", "nfl", "ncaaf", "college football"]],
      ["baseball", ["baseball", "mlb"]],
      ["hockey", ["hockey", "nhl"]],
      ["soccer", ["soccer", "football soccer", "epl", "uefa", "fifa"]],
      ["combat", ["combat", "ufc", "mma", "boxing", "wrestling"]],
      ["motorsport", ["motorsport", "formula", "nascar", "racing"]],
      ["tennis", ["tennis"]],
      ["golf", ["golf", "pga"]]
    ];

    for (const [family, aliases] of families) {
      if (aliases.some((alias) => text.includes(alias))) {
        return family;
      }
    }

    return text || "other";
  }

  function streamedId(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      `${match?.category || "event"}:${match?.title || ""}:${match?.date || ""}`
    );
  }

  function normalizeStreamed(match, liveIds) {
    const id = streamedId(match);
    const start = eventTimestamp(match?.date);
    const isLive = liveIds.has(id);

    return {
      id: `streamed:${id}`,
      title: String(match?.title || id),
      category: String(match?.category || "Other"),
      categoryFamily: categoryFamily(match?.category),
      start,
      end: 0,
      poster:
        Streamed?.posterUrl?.(match?.poster) ||
        Streamed?.matchupPosterUrl?.(match) ||
        "",
      isLive,
      alwaysLive: false,
      provider: "streamed",
      providerRef: match,
      providerId: id,
      iframeReady: false,
      uriName: "",
      tag: ""
    };
  }

  function normalizePpv(stream) {
    const start = eventTimestamp(stream?.starts_at);
    const end = eventTimestamp(stream?.ends_at);
    const alwaysLive =
      Number(stream?.always_live || 0) === 1 ||
      Number(stream?.category_always_live || 0) === 1;
    const now = Date.now();

    const isLive =
      alwaysLive ||
      (
        start > 0 &&
        start <= now &&
        (!end || now <= end)
      );

    return {
      id: `ppv:${stream?.id}`,
      title: String(stream?.name || `PPV ${stream?.id}`),
      category: String(stream?.category_name || "Other"),
      categoryFamily: categoryFamily(stream?.category_name),
      start,
      end,
      poster: String(stream?.poster || ""),
      isLive,
      alwaysLive,
      provider: "ppv",
      providerRef: stream,
      providerId: String(stream?.id || ""),
      iframeReady:
        typeof stream?.iframe === "string" &&
        /<iframe\b/i.test(stream.iframe),
      uriName: String(stream?.uri_name || ""),
      tag: String(stream?.tag || "")
    };
  }

  function matchScore(streamed, ppv) {
    const keyA = titleKey(streamed.title);
    const keyB = titleKey(ppv.title);
    const exactTitle = keyA && keyA === keyB;
    const similar = similarity(
      streamed.title,
      ppv.title
    );

    const familyMatch =
      streamed.categoryFamily === ppv.categoryFamily ||
      streamed.categoryFamily === "other" ||
      ppv.categoryFamily === "other";

    let timeDifference = Infinity;

    if (streamed.start && ppv.start) {
      timeDifference =
        Math.abs(streamed.start - ppv.start);
    }

    const closeTime =
      timeDifference <= 20 * 60 * 1000;

    let score = 0;

    if (exactTitle) score += 70;
    else if (similar >= 0.82) score += 55;
    else if (similar >= 0.68) score += 35;

    if (familyMatch) score += 15;

    if (closeTime) {
      score += 20;
    } else if (
      !streamed.start ||
      !ppv.start ||
      streamed.isLive ||
      ppv.alwaysLive
    ) {
      score += 5;
    }

    return {
      score,
      exactTitle,
      similarity: similar,
      familyMatch,
      timeDifference,
      closeTime
    };
  }

  function mergeCatalog(streamedEvents, ppvEvents) {
    const usedStreamed = new Set();
    const merged = [];

    ppvEvents.forEach((ppvEvent) => {
      let best = null;

      streamedEvents.forEach((streamedEvent, index) => {
        if (usedStreamed.has(index)) return;

        const result = matchScore(
          streamedEvent,
          ppvEvent
        );

        if (!best || result.score > best.result.score) {
          best = {
            index,
            event: streamedEvent,
            result
          };
        }
      });

      if (best && best.result.score >= 75) {
        usedStreamed.add(best.index);

        const streamedEvent = best.event;
        const title =
          streamedEvent.title.length >= ppvEvent.title.length
            ? streamedEvent.title
            : ppvEvent.title;

        merged.push({
          id: `merged:${streamedEvent.providerId}:${ppvEvent.providerId}`,
          title,
          category:
            streamedEvent.category !== "Other"
              ? streamedEvent.category
              : ppvEvent.category,
          categoryFamily:
            streamedEvent.categoryFamily !== "other"
              ? streamedEvent.categoryFamily
              : ppvEvent.categoryFamily,
          start:
            streamedEvent.start ||
            ppvEvent.start,
          end: ppvEvent.end,
          poster:
            streamedEvent.poster ||
            ppvEvent.poster,
          isLive:
            streamedEvent.isLive ||
            ppvEvent.isLive,
          providers: {
            streamed: streamedEvent,
            ppv: ppvEvent
          },
          match: {
            method: best.result.exactTitle
              ? "normalized-title"
              : "title-similarity",
            score: best.result.score,
            similarity:
              Math.round(
                best.result.similarity * 100
              ) / 100,
            timeDifferenceMinutes:
              Number.isFinite(best.result.timeDifference)
                ? Math.round(
                    best.result.timeDifference /
                    60000
                  )
                : null,
            categoryMatched:
              best.result.familyMatch
          }
        });

        return;
      }

      merged.push({
        id: ppvEvent.id,
        title: ppvEvent.title,
        category: ppvEvent.category,
        categoryFamily: ppvEvent.categoryFamily,
        start: ppvEvent.start,
        end: ppvEvent.end,
        poster: ppvEvent.poster,
        isLive: ppvEvent.isLive,
        providers: {
          streamed: null,
          ppv: ppvEvent
        },
        match: {
          method: "ppv-only",
          score: best?.result?.score || 0
        }
      });
    });

    streamedEvents.forEach((streamedEvent, index) => {
      if (usedStreamed.has(index)) return;

      merged.push({
        id: streamedEvent.id,
        title: streamedEvent.title,
        category: streamedEvent.category,
        categoryFamily: streamedEvent.categoryFamily,
        start: streamedEvent.start,
        end: 0,
        poster: streamedEvent.poster,
        isLive: streamedEvent.isLive,
        providers: {
          streamed: streamedEvent,
          ppv: null
        },
        match: {
          method: "streamed-only",
          score: 0
        }
      });
    });

    return merged.sort((left, right) => {
      if (left.isLive !== right.isLive) {
        return Number(right.isLive) -
          Number(left.isLive);
      }

      const leftStart =
        left.start || Number.MAX_SAFE_INTEGER;
      const rightStart =
        right.start || Number.MAX_SAFE_INTEGER;

      return leftStart - rightStart;
    });
  }

  function isStartingSoon(event) {
    if (event.isLive || !event.start) {
      return false;
    }

    const difference = event.start - Date.now();

    return (
      difference > 0 &&
      difference <= 6 * 60 * 60 * 1000
    );
  }

  function countdown(event) {
    if (event.isLive) return "LIVE";
    if (!event.start) return "Time unavailable";

    const difference = event.start - Date.now();

    if (difference <= 0) return "Starting now";

    const minutes = Math.ceil(
      difference / 60000
    );

    if (minutes < 60) {
      return `Starts in ${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;

    if (hours < 24) {
      return remainder
        ? `Starts in ${hours}h ${remainder}m`
        : `Starts in ${hours}h`;
    }

    const date = new Date(event.start);

    return date.toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function providerType(event) {
    const hasStreamed = Boolean(
      event.providers.streamed
    );
    const hasPpv = Boolean(
      event.providers.ppv
    );

    if (hasStreamed && hasPpv) {
      return "both";
    }

    return hasPpv ? "ppv" : "streamed";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function eventMatchesFilter(event) {
    const provider = providerType(event);

    if (activeFilter === "live") {
      return event.isLive;
    }

    if (activeFilter === "soon") {
      return isStartingSoon(event);
    }

    if (activeFilter === "both") {
      return provider === "both";
    }

    if (activeFilter === "streamed") {
      return Boolean(event.providers.streamed);
    }

    if (activeFilter === "ppv") {
      return Boolean(event.providers.ppv);
    }

    return true;
  }

  function filteredEvents() {
    const query = searchInput.value
      .trim()
      .toLowerCase();

    return unifiedEvents.filter((event) => {
      if (!eventMatchesFilter(event)) {
        return false;
      }

      if (!query) return true;

      return [
        event.title,
        event.category,
        event.providers.ppv?.tag,
        event.providers.ppv?.uriName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function providerBadges(event) {
    const badges = [];

    if (event.providers.streamed) {
      badges.push(
        '<span class="pt-provider-badge is-streamed">Streamed</span>'
      );
    }

    if (event.providers.ppv) {
      badges.push(
        '<span class="pt-provider-badge is-ppv">PPV</span>'
      );
    }

    return badges.join("");
  }

  function eventImage(event) {
    if (!event.poster) {
      return `<div class="pt-event-image pt-event-image-empty">EC</div>`;
    }

    return `
      <div class="pt-event-image">
        <img
          src="${escapeHtml(event.poster)}"
          alt=""
          loading="lazy"
          data-event-image
        >
        <span>EC</span>
      </div>
    `;
  }

  function renderEvents() {
    const events = filteredEvents();

    directoryStatus.textContent =
      `${events.length} of ${unifiedEvents.length} unified events`;

    if (!events.length) {
      eventList.innerHTML = `
        <div class="pt-loading-card">
          No events match this filter.
        </div>
      `;
      return;
    }

    eventList.innerHTML = events
      .map((event) => {
        const provider = providerType(event);
        const ppvReady =
          event.providers.ppv?.iframeReady;

        return `
          <button
            class="pt-event-card ${event.id === selectedEvent?.id ? "is-selected" : ""}"
            type="button"
            data-event-id="${escapeHtml(event.id)}"
          >
            ${eventImage(event)}
            <span class="pt-event-copy">
              <span class="pt-event-topline">
                <span>${escapeHtml(event.category)}</span>
                <span class="pt-event-status ${event.isLive ? "is-live" : ""}" data-event-countdown="${escapeHtml(event.id)}">
                  ${escapeHtml(countdown(event))}
                </span>
              </span>
              <strong>${escapeHtml(event.title)}</strong>
              <small>
                ${providerBadges(event)}
                ${
                  provider === "both"
                    ? `<span class="pt-match-score">merge ${escapeHtml(event.match.score)}</span>`
                    : ""
                }
                ${
                  event.providers.ppv && !ppvReady
                    ? '<span class="pt-warning-pill">PPV iframe missing</span>'
                    : ""
                }
              </small>
            </span>
          </button>
        `;
      })
      .join("");

    eventList
      .querySelectorAll("[data-event-image]")
      .forEach((image) => {
        image.addEventListener(
          "error",
          () => image.remove(),
          { once: true }
        );
      });

    eventList
      .querySelectorAll("[data-event-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const event = unifiedEvents.find(
            (candidate) =>
              candidate.id === button.dataset.eventId
          );

          if (event) {
            selectEvent(event);
          }
        });
      });
  }

  function updateCountdowns() {
    document
      .querySelectorAll("[data-event-countdown]")
      .forEach((element) => {
        const event = unifiedEvents.find(
          (candidate) =>
            candidate.id ===
            element.dataset.eventCountdown
        );

        if (!event) return;

        const next = countdown(event);

        if (element.textContent.trim() !== next) {
          element.textContent = next;
        }
      });
  }

  function updateStats() {
    const both = unifiedEvents.filter(
      (event) =>
        event.providers.streamed &&
        event.providers.ppv
    ).length;

    const streamedOnly = unifiedEvents.filter(
      (event) =>
        event.providers.streamed &&
        !event.providers.ppv
    ).length;

    const ppvOnly = unifiedEvents.filter(
      (event) =>
        !event.providers.streamed &&
        event.providers.ppv
    ).length;

    const ppvReady = unifiedEvents.filter(
      (event) =>
        event.providers.ppv?.iframeReady
    ).length;

    totalCount.textContent = String(
      unifiedEvents.length
    );
    bothCount.textContent = String(both);
    streamedOnlyCount.textContent =
      String(streamedOnly);
    ppvOnlyCount.textContent =
      String(ppvOnly);
    playablePpvCount.textContent =
      String(ppvReady);
  }

  function safeDebug(event) {
    return {
      title: event.title,
      category: event.category,
      normalizedTitle: titleKey(event.title),
      start:
        event.start
          ? new Date(event.start).toISOString()
          : null,
      end:
        event.end
          ? new Date(event.end).toISOString()
          : null,
      live: event.isLive,
      match: event.match,
      streamed: event.providers.streamed
        ? {
            id:
              event.providers.streamed.providerId,
            title:
              event.providers.streamed.title,
            category:
              event.providers.streamed.category,
            sourceCount:
              Array.isArray(
                event.providers.streamed.providerRef?.sources
              )
                ? event.providers.streamed.providerRef.sources.length
                : 0
          }
        : null,
      ppv: event.providers.ppv
        ? {
            id:
              event.providers.ppv.providerId,
            title:
              event.providers.ppv.title,
            category:
              event.providers.ppv.category,
            tag:
              event.providers.ppv.tag,
            uriName:
              event.providers.ppv.uriName,
            iframePresent:
              event.providers.ppv.iframeReady,
            alwaysLive:
              event.providers.ppv.alwaysLive
          }
        : null
    };
  }

  function emptyPlayer(message = "Choose an event") {
    playerStage.innerHTML = `
      <div class="pt-player-empty">
        <span>▶</span>
        <strong>${escapeHtml(message)}</strong>
        <p>
          Select a playable provider server to render it here.
        </p>
      </div>
    `;
  }

  function renderUrlFrame(url, label) {
    playerStage.innerHTML = "";

    const frame = document.createElement("iframe");
    frame.src = url;
    frame.title = label;
    frame.allow =
      "autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write";
    frame.allowFullscreen = true;
    frame.referrerPolicy =
      "strict-origin-when-cross-origin";

    playerStage.appendChild(frame);
  }

  function renderPpvIframe(iframeMarkup, label) {
    const template =
      document.createElement("template");
    template.innerHTML =
      String(iframeMarkup || "").trim();

    const iframe = template.content.querySelector(
      "iframe"
    );

    const otherElements =
      template.content.querySelectorAll("*");

    if (
      !iframe ||
      otherElements.length !== 1
    ) {
      throw new Error(
        "PPV iframe markup was missing or contained unexpected extra HTML."
      );
    }

    playerStage.innerHTML = "";

    /*
      Preserve the provider-supplied iframe and its attributes rather
      than reconstructing or sandboxing it. This test intentionally
      does not alter PPV's required embed behavior.
    */
    iframe.title =
      iframe.getAttribute("title") ||
      label;

    playerStage.appendChild(iframe);
  }

  async function gatherServers(event) {
    const servers = [];

    if (event.providers.streamed) {
      try {
        const streams =
          await Streamed.getStreams(
            event.providers.streamed.providerRef
          );

        streams.forEach((stream, index) => {
          if (!stream?.embedUrl) return;

          servers.push({
            provider: "streamed",
            label:
              `Streamed ${stream.streamNo || index + 1}`,
            type: "url",
            value: stream.embedUrl,
            source:
              stream.source ||
              "streamed"
          });
        });
      } catch (error) {
        servers.push({
          provider: "streamed",
          label: "Streamed unavailable",
          disabled: true,
          error:
            error?.message ||
            "Streamed lookup failed."
        });
      }
    }

    if (event.providers.ppv) {
      const ppvRef =
        event.providers.ppv.providerRef;

      if (
        typeof ppvRef?.iframe === "string" &&
        /<iframe\b/i.test(ppvRef.iframe)
      ) {
        servers.push({
          provider: "ppv",
          label:
            ppvRef.tag
              ? `PPV · ${ppvRef.tag}`
              : "PPV",
          type: "iframe",
          value: ppvRef.iframe,
          source: ppvRef.uri_name
        });
      } else {
        servers.push({
          provider: "ppv",
          label: "PPV · iframe missing",
          disabled: true,
          error:
            "The PPV catalog listed this event but did not include iframe markup."
        });
      }
    }

    return servers;
  }

  function playServer(server, event) {
    if (server.disabled) {
      showToast(
        server.error ||
        "That source is unavailable."
      );
      return;
    }

    serverRow
      .querySelectorAll("button")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.serverKey ===
            server.key
        );
      });

    try {
      if (server.type === "iframe") {
        renderPpvIframe(
          server.value,
          `${event.title} · PPV`
        );
      } else {
        renderUrlFrame(
          server.value,
          `${event.title} · Streamed`
        );
      }
    } catch (error) {
      emptyPlayer("Provider embed failed");
      showToast(
        error?.message ||
        "The provider embed could not be rendered."
      );
    }
  }

  async function selectEvent(event) {
    selectedEvent = event;
    renderEvents();

    playerTitle.textContent = event.title;
    clearPlayer.hidden = false;
    debugTitle.textContent = event.title;
    debugOutput.textContent =
      JSON.stringify(
        safeDebug(event),
        null,
        2
      );

    serverRow.hidden = false;
    serverRow.innerHTML =
      '<span class="pt-server-loading">Loading provider servers…</span>';
    emptyPlayer("Loading servers…");

    const servers = await gatherServers(event);

    if (selectedEvent?.id !== event.id) {
      return;
    }

    serverRow.innerHTML = "";

    if (!servers.length) {
      serverRow.innerHTML =
        '<span class="pt-server-loading">No playable sources returned.</span>';
      emptyPlayer("No playable sources");
      return;
    }

    servers.forEach((server, index) => {
      server.key = `${server.provider}:${index}`;

      const button =
        document.createElement("button");

      button.type = "button";
      button.dataset.serverKey =
        server.key;
      button.dataset.provider =
        server.provider;
      button.disabled =
        Boolean(server.disabled);
      button.textContent =
        server.label;

      if (server.error) {
        button.title =
          server.error;
      }

      button.addEventListener(
        "click",
        () => playServer(server, event)
      );

      serverRow.appendChild(button);
    });

    const firstPlayable =
      servers.find(
        (server) => !server.disabled
      );

    if (firstPlayable) {
      playServer(
        firstPlayable,
        event
      );
    } else {
      emptyPlayer(
        "Metadata found, but no playable embed"
      );
    }
  }

  function clearSelection() {
    selectedEvent = null;
    playerTitle.textContent =
      "Choose an event";
    clearPlayer.hidden = true;
    serverRow.hidden = true;
    serverRow.innerHTML = "";
    debugTitle.textContent =
      "No event selected";
    debugOutput.textContent =
      "Select an event to inspect how it was normalized and matched.";
    emptyPlayer();
    renderEvents();
  }

  clearPlayer.addEventListener(
    "click",
    clearSelection
  );

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter =
        button.dataset.filter || "all";

      filterButtons.forEach(
        (candidate) => {
          candidate.classList.toggle(
            "active",
            candidate === button
          );
        }
      );

      renderEvents();
    });
  });

  searchInput.addEventListener(
    "input",
    renderEvents
  );

  async function loadProviders(force = false) {
    refreshButton.disabled = true;
    refreshButton.textContent =
      "↻ Loading…";
    directoryStatus.textContent =
      "Loading providers…";

    setHealth(
      streamedHealthCard,
      streamedHealth,
      "loading",
      "Loading…"
    );
    setHealth(
      ppvHealthCard,
      ppvHealth,
      "loading",
      "Loading…"
    );

    const [streamedResult, ppvResult] =
      await Promise.allSettled([
        Streamed.getDiscovery({
          forceMatches: force
        }),
        PPV.getCatalog(force)
      ]);

    let streamedEvents = [];
    let ppvEvents = [];

    if (
      streamedResult.status ===
      "fulfilled"
    ) {
      const discovery =
        streamedResult.value;

      const liveIds = new Set(
        (discovery.live.data || [])
          .map(streamedId)
      );

      const byId = new Map();

      [
        ...(discovery.live.data || []),
        ...(discovery.today.data || [])
      ].forEach((match) => {
        const id = streamedId(match);

        if (!byId.has(id)) {
          byId.set(id, match);
        }
      });

      streamedEvents =
        Array.from(byId.values())
          .map((match) =>
            normalizeStreamed(
              match,
              liveIds
            )
          );

      const stale =
        discovery.live.stale ||
        discovery.today.stale;

      setHealth(
        streamedHealthCard,
        streamedHealth,
        stale ? "warning" : "ok",
        `${streamedEvents.length} events${stale ? " · cached" : ""}`
      );
    } else {
      setHealth(
        streamedHealthCard,
        streamedHealth,
        "error",
        streamedResult.reason?.message ||
          "Unavailable"
      );
    }

    if (
      ppvResult.status ===
      "fulfilled"
    ) {
      const catalog = ppvResult.value;

      ppvEvents =
        (catalog.streams || [])
          .map(normalizePpv);

      setHealth(
        ppvHealthCard,
        ppvHealth,
        catalog.stale
          ? "warning"
          : "ok",
        `${ppvEvents.length} streams${catalog.stale ? " · cached" : ""}`
      );
    } else {
      setHealth(
        ppvHealthCard,
        ppvHealth,
        "error",
        ppvResult.reason?.message ||
          "Unavailable"
      );
    }

    if (
      !streamedEvents.length &&
      !ppvEvents.length
    ) {
      unifiedEvents = [];
      eventList.innerHTML = `
        <div class="pt-loading-card is-error">
          Neither provider returned a usable catalog.
        </div>
      `;
      directoryStatus.textContent =
        "Provider load failed";
    } else {
      unifiedEvents = mergeCatalog(
        streamedEvents,
        ppvEvents
      );
      updateStats();
      renderEvents();
    }

    refreshButton.disabled = false;
    refreshButton.textContent =
      "↻ Refresh APIs";
  }

  refreshButton.addEventListener(
    "click",
    () => {
      loadProviders(true).catch(
        (error) => showToast(
          error?.message ||
          "Refresh failed."
        )
      );
    }
  );

  countdownTimer =
    window.setInterval(
      updateCountdowns,
      15_000
    );

  window.addEventListener(
    "pagehide",
    () => {
      window.clearInterval(
        countdownTimer
      );
    },
    { once: true }
  );

  if (!Streamed || !PPV) {
    eventList.innerHTML = `
      <div class="pt-loading-card is-error">
        The provider adapters did not load.
      </div>
    `;
    return;
  }

  loadProviders(false).catch((error) => {
    eventList.innerHTML = `
      <div class="pt-loading-card is-error">
        ${escapeHtml(error?.message || "Provider test failed.")}
      </div>
    `;
  });
})();

(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const root = document.getElementById("eventsRedesignLab");

  if (!API || !root) return;

  const elements = {
    rail: document.getElementById("eventsFilterRail"),
    collapse: document.getElementById("eventsFilterCollapse"),
    close: document.getElementById("eventsFilterClose"),
    mobileFilter: document.getElementById("eventsMobileFilterButton"),
    scrim: document.getElementById("eventsFilterScrim"),
    railSearch: document.getElementById("eventsRailSearch"),
    mainSearch: document.getElementById("eventsMainSearch"),
    sportFilters: document.getElementById("eventsSportFilters"),
    content: document.getElementById("eventsDirectoryContent"),
    statusStrip: document.getElementById("eventsStatusStrip"),
    statusText: document.getElementById("eventsStatusText"),
    statusMeta: document.getElementById("eventsStatusMeta"),
    refresh: document.getElementById("eventsRefreshButton"),
    prefsButton: document.getElementById("eventsPrefsButton"),
    prefsPanel: document.getElementById("eventsPrefsPanel"),
    prefArtwork: document.getElementById("eventsPrefArtwork"),
    prefCompact: document.getElementById("eventsPrefCompact"),
    prefSoonFirst: document.getElementById("eventsPrefSoonFirst"),
    allCount: document.getElementById("eventsAllCount"),
    liveCount: document.getElementById("eventsLiveFilterCount"),
    trendingCount: document.getElementById("eventsTrendingCount"),
    favoriteCount: document.getElementById("eventsFavoriteCount"),
    continueStrip: document.getElementById("eventsContinueStrip"),
    continueArt: document.getElementById("eventsContinueArt"),
    continueTitle: document.getElementById("eventsContinueTitle"),
    continueMeta: document.getElementById("eventsContinueMeta"),
    continueButton: document.getElementById("eventsContinueButton"),
    toast: document.getElementById("eventsTestToast")
  };

  const STORAGE = {
    filterRail: "eastcoinEventsRedesignFilterRailV1",
    favorites: "eastcoinEventsRedesignFavoritesV1",
    prefs: "eastcoinEventsRedesignPrefsV1",
    continue: "eastcoinContinueStreamedEventV1"
  };

  const SPORT_ORDER = [
    "american-football",
    "baseball",
    "basketball",
    "hockey",
    "soccer",
    "combat",
    "wrestling",
    "motorsport",
    "tennis",
    "golf",
    "other"
  ];

  const SPORT_META = {
    "american-football": { label: "Football", icon: "🏈" },
    baseball: { label: "Baseball", icon: "⚾" },
    basketball: { label: "Basketball", icon: "🏀" },
    hockey: { label: "Hockey", icon: "🏒" },
    soccer: { label: "Soccer", icon: "⚽" },
    combat: { label: "UFC / Combat", icon: "🥊" },
    wrestling: { label: "Wrestling", icon: "🤼" },
    motorsport: { label: "Motorsport", icon: "🏎" },
    tennis: { label: "Tennis", icon: "🎾" },
    golf: { label: "Golf", icon: "⛳" },
    other: { label: "Other Events", icon: "≡" }
  };

  const state = {
    live: [],
    today: [],
    tomorrow: [],
    all: [],
    mode: "live",
    scope: "all",
    sport: "all",
    query: "",
    favorites: loadJson(STORAGE.favorites, []),
    prefs: {
      artwork: true,
      compact: false,
      soonFirst: true,
      ...loadJson(STORAGE.prefs, {})
    },
    updatedAt: 0,
    stale: false
  };

  let toastTimer = 0;
  let countdownTimer = 0;

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function timestamp(value) {
    let numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    if (numeric < 1_000_000_000_000) numeric *= 1000;
    return numeric;
  }

  function eventId(match) {
    return String(match?.id || match?.matchId || match?.slug || "");
  }

  function isLive(match) {
    return Boolean(match?._eastcoinLive);
  }

  function providerLabel(match) {
    const providers = match?._eastcoinProviders || {};
    const streamed = providers.streamed;
    const ppv = providers.ppv;
    if (streamed && ppv) return "Streamed + PPV";
    if (ppv) return "PPV";
    return "Streamed";
  }

  function categoryText(match) {
    return String(
      match?._eastcoinProviders?.ppv?.category ||
      match?.category ||
      "Other"
    );
  }

  function sportFamily(match) {
    const text = categoryText(match)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const includesAny = (values) =>
      values.some((value) => text.includes(value));

    if (includesAny(["nfl", "ncaaf", "american football", "college football"])) return "american-football";
    if (includesAny(["mlb", "baseball"])) return "baseball";
    if (includesAny(["nba", "wnba", "ncaab", "basketball"])) return "basketball";
    if (includesAny(["nhl", "hockey"])) return "hockey";
    if (includesAny(["ufc", "mma", "boxing", "combat"])) return "combat";
    if (includesAny(["wwe", "aew", "wrestling"])) return "wrestling";
    if (includesAny(["nascar", "formula", "motorsport", "racing"])) return "motorsport";
    if (includesAny(["tennis"])) return "tennis";
    if (includesAny(["golf", "pga"])) return "golf";
    if (includesAny(["soccer", "epl", "uefa", "fifa", "premier league"]) || text === "football") return "soccer";
    return "other";
  }

  function sportMeta(matchOrFamily) {
    const family = typeof matchOrFamily === "string"
      ? matchOrFamily
      : sportFamily(matchOrFamily);
    return SPORT_META[family] || SPORT_META.other;
  }

  function uniqueMatches(matches) {
    const map = new Map();
    matches.forEach((match) => {
      const id = eventId(match);
      if (!id || map.has(id)) return;
      map.set(id, match);
    });
    return [...map.values()];
  }

  function localDayKey(value) {
    const date = new Date(timestamp(value));
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function tomorrowKey() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function timeLabel(match) {
    if (isLive(match)) return "LIVE";
    const start = timestamp(match?.date);
    if (!start) return "Upcoming";
    const diff = start - Date.now();
    if (diff <= 0) return "Starting";
    const minutes = Math.ceil(diff / 60_000);
    if (minutes <= 90) return `In ${minutes}m`;
    const date = new Date(start);
    const sameDay = localDayKey(start) === localDayKey(Date.now());
    return `${sameDay ? "Today · " : ""}${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function fullTimeLabel(match) {
    if (isLive(match)) return "Live now";
    const start = timestamp(match?.date);
    if (!start) return "Upcoming";
    const date = new Date(start);
    return date.toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function teamObjects(match) {
    return [match?.teams?.away, match?.teams?.home].filter(Boolean);
  }

  function favoriteKey(match) {
    return eventId(match);
  }

  function isFavorite(match) {
    return state.favorites.includes(favoriteKey(match));
  }

  function toggleFavorite(match) {
    const key = favoriteKey(match);
    if (!key) return;
    if (state.favorites.includes(key)) {
      state.favorites = state.favorites.filter((value) => value !== key);
      toast("Removed from test favorites.");
    } else {
      state.favorites.push(key);
      toast("Added to test favorites.");
    }
    saveJson(STORAGE.favorites, state.favorites);
    render();
  }

  function imageUrlForMatch(match) {
    return API.posterUrl?.(match?.poster) || API.matchupPosterUrl?.(match) || "";
  }

  function teamBadge(team) {
    return API.badgeUrl?.(team?.badge) || "";
  }

  function teamArtMarkup(match) {
    const away = match?.teams?.away;
    const home = match?.teams?.home;
    const poster = imageUrlForMatch(match);
    const meta = sportMeta(match);

    if (away && home) {
      const awayBadge = teamBadge(away);
      const homeBadge = teamBadge(home);
      return `
        <div class="ec-simple-event-visual">
          ${poster ? `<img class="ec-simple-event-poster" src="${escapeAttr(poster)}" alt="" loading="lazy" decoding="async" data-event-image>` : ""}
          <span class="ec-simple-event-status${isLive(match) ? " is-live" : ""}" data-time-for="${escapeAttr(eventId(match))}">${escapeHtml(timeLabel(match))}</span>
          <div class="ec-simple-team-art">
            <div class="ec-simple-team-side">
              <span class="ec-simple-team-badge">${awayBadge ? `<img src="${escapeAttr(awayBadge)}" alt="" loading="lazy" decoding="async" data-event-image>` : escapeHtml((away.name || "A").slice(0, 2).toUpperCase())}</span>
              <span class="ec-simple-team-name">${escapeHtml(away.name || "Away")}</span>
            </div>
            <span class="ec-simple-team-vs">VS</span>
            <div class="ec-simple-team-side is-home">
              <span class="ec-simple-team-badge">${homeBadge ? `<img src="${escapeAttr(homeBadge)}" alt="" loading="lazy" decoding="async" data-event-image>` : escapeHtml((home.name || "H").slice(0, 2).toUpperCase())}</span>
              <span class="ec-simple-team-name">${escapeHtml(home.name || "Home")}</span>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="ec-simple-event-visual">
        ${poster ? `<img class="ec-simple-event-poster" src="${escapeAttr(poster)}" alt="" loading="lazy" decoding="async" data-event-image>` : ""}
        <span class="ec-simple-event-status${isLive(match) ? " is-live" : ""}" data-time-for="${escapeAttr(eventId(match))}">${escapeHtml(timeLabel(match))}</span>
        <div class="ec-simple-single-art">
          ${poster ? `<span class="ec-simple-event-poster-only"><img src="${escapeAttr(poster)}" alt="" loading="lazy" decoding="async" data-event-image></span>` : `<span class="ec-simple-single-art-icon">${meta.icon}</span>`}
          <span class="ec-simple-team-name">${escapeHtml(meta.label)}</span>
        </div>
      </div>`;
  }

  function matchSearchText(match) {
    return [
      match?.title,
      categoryText(match),
      ...teamObjects(match).map((team) => team?.name)
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function currentSource() {
    if (state.mode === "today") return state.today;
    if (state.mode === "tomorrow") return state.tomorrow;
    return state.live;
  }

  function filteredMatches() {
    let matches = [...currentSource()];
    const query = state.query.trim().toLowerCase();

    if (state.scope === "live") {
      matches = matches.filter(isLive);
    } else if (state.scope === "trending") {
      const popular = matches.filter((match) => match?.popular || isLive(match));
      matches = popular.length ? popular : matches;
    } else if (state.scope === "favorites") {
      matches = matches.filter(isFavorite);
    }

    if (state.sport !== "all") {
      matches = matches.filter((match) => sportFamily(match) === state.sport);
    }

    if (query) {
      matches = matches.filter((match) => matchSearchText(match).includes(query));
    }

    matches.sort((a, b) => {
      if (state.scope === "trending" && Boolean(a?.popular) !== Boolean(b?.popular)) {
        return Number(Boolean(b?.popular)) - Number(Boolean(a?.popular));
      }
      if (state.prefs.soonFirst && isLive(a) !== isLive(b)) {
        return Number(isLive(b)) - Number(isLive(a));
      }
      return (timestamp(a?.date) || Infinity) - (timestamp(b?.date) || Infinity);
    });

    return matches;
  }

  function cardMarkup(match) {
    const id = eventId(match);
    const meta = sportMeta(match);
    const sources = Array.isArray(match?.sources) ? match.sources.length : 0;
    const favorite = isFavorite(match);
    const live = isLive(match);
    const title = String(match?.title || "Untitled event");

    return `
      <article class="ec-simple-event-card${live ? " is-live" : ""}${favorite ? " is-favorite" : ""}" data-event-card="${escapeAttr(id)}">
        ${teamArtMarkup(match)}
        <div class="ec-simple-event-card-body">
          <div class="ec-simple-event-title-row">
            <h3 title="${escapeAttr(title)}">${escapeHtml(title)}</h3>
            <button class="ec-simple-event-favorite${favorite ? " is-active" : ""}" type="button" data-event-favorite="${escapeAttr(id)}" aria-label="${favorite ? "Remove from" : "Add to"} test favorites" title="Favorite">${favorite ? "★" : "☆"}</button>
          </div>
          <div class="ec-simple-event-meta">
            <span>${escapeHtml(meta.label)}</span>
            <span>·</span>
            <span>${escapeHtml(fullTimeLabel(match))}</span>
            <span>·</span>
            <span>${sources || 1} source${sources === 1 ? "" : "s"}</span>
            <span class="ec-simple-event-provider">${escapeHtml(providerLabel(match))}</span>
          </div>
          <div class="ec-simple-event-actions">
            <button type="button" data-event-multiview="${escapeAttr(id)}">+ MultiView</button>
            ${!live ? `<button type="button" data-event-reminder="${escapeAttr(id)}">🔔 Reminder</button>` : ""}
            <button class="is-primary" type="button" data-event-watch="${escapeAttr(id)}">${live ? "Watch" : "Open"}</button>
          </div>
        </div>
      </article>`;
  }

  function sectionMarkup(family, matches) {
    const meta = sportMeta(family);
    const liveCount = matches.filter(isLive).length;
    return `
      <section class="ec-simple-events-section" data-sport-section="${escapeAttr(family)}">
        <header class="ec-simple-events-section-header">
          <div class="ec-simple-events-section-heading">
            <span class="ec-simple-events-section-icon">${meta.icon}</span>
            <span class="ec-simple-events-section-title">
              <strong>${escapeHtml(meta.label)}</strong>
              <small>${liveCount ? `${liveCount} live now` : "Upcoming events"}</small>
            </span>
          </div>
          <span class="ec-simple-events-section-counts">
            ${liveCount ? `<span class="is-live">${liveCount} LIVE</span>` : ""}
            <span>${matches.length} total</span>
          </span>
        </header>
        <div class="ec-simple-events-grid">${matches.map(cardMarkup).join("")}</div>
      </section>`;
  }

  function renderSports(matches) {
    const counts = new Map();
    currentSource().forEach((match) => {
      const family = sportFamily(match);
      const previous = counts.get(family) || { total: 0, live: 0 };
      previous.total += 1;
      if (isLive(match)) previous.live += 1;
      counts.set(family, previous);
    });

    const families = [...counts.keys()].sort((a, b) => {
      const ai = SPORT_ORDER.indexOf(a);
      const bi = SPORT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    elements.sportFilters.innerHTML = `
      <button class="ec-events-sport-filter${state.sport === "all" ? " is-active" : ""}" type="button" data-events-sport="all" data-filter-tooltip="All categories">
        <span class="ec-events-sport-icon">▦</span>
        <span class="ec-events-sport-label">All Categories</span>
        <span class="ec-events-sport-counts"><span class="ec-events-sport-count">${currentSource().length}</span></span>
      </button>
      ${families.map((family) => {
        const meta = sportMeta(family);
        const count = counts.get(family);
        return `<button class="ec-events-sport-filter${state.sport === family ? " is-active" : ""}" type="button" data-events-sport="${escapeAttr(family)}" data-filter-tooltip="${escapeAttr(meta.label)}">
          <span class="ec-events-sport-icon">${meta.icon}</span>
          <span class="ec-events-sport-label">${escapeHtml(meta.label)}</span>
          <span class="ec-events-sport-counts">${count.live ? `<span class="ec-events-sport-count ec-events-sport-live">${count.live}</span>` : ""}<span class="ec-events-sport-count">${count.total}</span></span>
        </button>`;
      }).join("")}`;
  }

  function render() {
    root.classList.toggle("no-artwork", !state.prefs.artwork);
    root.classList.toggle("is-compact-density", state.prefs.compact);

    const source = currentSource();
    const matches = filteredMatches();
    const liveTotal = source.filter(isLive).length;
    const trendingTotal = source.filter((match) => match?.popular || isLive(match)).length;
    const favoriteTotal = source.filter(isFavorite).length;

    elements.allCount.textContent = String(source.length);
    elements.liveCount.textContent = String(liveTotal);
    elements.trendingCount.textContent = String(trendingTotal);
    elements.favoriteCount.textContent = String(favoriteTotal);

    document.querySelectorAll("[data-events-scope]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.eventsScope === state.scope);
    });
    document.querySelectorAll("[data-events-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.eventsMode === state.mode);
    });

    renderSports(matches);

    if (!matches.length) {
      elements.content.innerHTML = `<div class="ec-events-empty-state"><strong>No matching events</strong><small>Try another filter, date, sport, or search.</small></div>`;
      updateCountdowns();
      return;
    }

    const groups = new Map();
    matches.forEach((match) => {
      const family = sportFamily(match);
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(match);
    });

    const families = [...groups.keys()].sort((a, b) => {
      const aMatches = groups.get(a);
      const bMatches = groups.get(b);
      const aLive = aMatches.filter(isLive).length;
      const bLive = bMatches.filter(isLive).length;
      if (aLive !== bLive) return bLive - aLive;
      const ai = SPORT_ORDER.indexOf(a);
      const bi = SPORT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    elements.content.innerHTML = families.map((family) => sectionMarkup(family, groups.get(family))).join("");
    installImageFallbacks();
    updateCountdowns();
  }

  function installImageFallbacks() {
    root.querySelectorAll("[data-event-image]").forEach((image) => {
      image.addEventListener("error", () => {
        image.style.display = "none";
      }, { once: true });
    });
  }

  function updateCountdowns() {
    const byId = new Map(currentSource().map((match) => [eventId(match), match]));
    root.querySelectorAll("[data-time-for]").forEach((element) => {
      const match = byId.get(element.dataset.timeFor);
      if (!match) return;
      element.textContent = timeLabel(match);
      element.classList.toggle("is-live", isLive(match));
    });
  }

  function syncSearch(value) {
    state.query = String(value || "");
    elements.railSearch.value = state.query;
    elements.mainSearch.value = state.query;
    render();
  }

  function openEvent(match) {
    if (!match) return;
    const destination = new URL("index.html", window.location.href);
    destination.searchParams.set("event", eventId(match));
    window.location.href = destination.href;
  }

  function queueMultiview(match) {
    if (!match) return;
    toast(`${match.title} queued for the MultiView handoff prototype.`);
  }

  function setReminder(match) {
    if (!match) return;
    toast(`Reminder prototype armed for ${match.title}.`);
  }

  function toast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
  }

  function findMatch(id) {
    return uniqueMatches([...state.live, ...state.today, ...state.tomorrow, ...state.all])
      .find((match) => eventId(match) === id) || null;
  }

  function loadContinueWatching() {
    const saved = loadJson(STORAGE.continue, null);
    const match = saved?.match || saved?.event || null;
    if (!match || !eventId(match)) {
      elements.continueStrip.hidden = true;
      return;
    }

    elements.continueStrip.hidden = false;
    elements.continueTitle.textContent = match.title || "Recent event";
    elements.continueMeta.textContent = saved?.source?.source
      ? `${providerLabel(match)} · ${String(saved.source.source)}`
      : "Resume your last EastCoin event.";
    const art = imageUrlForMatch(match);
    elements.continueArt.innerHTML = art ? `<img src="${escapeAttr(art)}" alt="" loading="lazy" decoding="async">` : "";
    elements.continueButton.onclick = () => openEvent(match);
  }

  async function loadEvents(force = false) {
    elements.statusStrip.classList.remove("is-ready", "is-error");
    elements.statusText.textContent = force ? "Refreshing event feed…" : "Loading the EastCoin event feed…";
    elements.content.innerHTML = `<div class="ec-events-loading-state"><span class="ec-events-loading-spinner" aria-hidden="true"></span><strong>Loading events</strong><small>Using the current Streamed + PPV event feed.</small></div>`;

    try {
      const [discovery, allResult] = await Promise.all([
        API.getDiscovery({ forceMatches: force }),
        API.getAll(force)
      ]);

      state.live = uniqueMatches(Array.isArray(discovery?.live?.data) ? discovery.live.data : []);
      state.today = uniqueMatches(Array.isArray(discovery?.today?.data) ? discovery.today.data : []);
      state.all = uniqueMatches(Array.isArray(allResult?.data) ? allResult.data : []);
      state.tomorrow = state.all.filter((match) => localDayKey(match?.date) === tomorrowKey());
      state.updatedAt = Math.max(
        Number(discovery?.live?.savedAt || 0),
        Number(discovery?.today?.savedAt || 0),
        Number(allResult?.savedAt || 0)
      );
      state.stale = Boolean(discovery?.live?.stale || discovery?.today?.stale || allResult?.stale);

      elements.statusStrip.classList.add("is-ready");
      elements.statusText.textContent = state.stale
        ? "Showing cached event data while a provider is unavailable."
        : "Event feed ready.";
      elements.statusMeta.textContent = `${state.live.length} live · ${state.today.length} today · Streamed + PPV`;
      render();
      loadContinueWatching();
    } catch (error) {
      elements.statusStrip.classList.add("is-error");
      elements.statusText.textContent = "The event feed could not be loaded.";
      elements.statusMeta.textContent = "Retry available";
      elements.content.innerHTML = `<div class="ec-events-empty-state"><strong>Event feed unavailable</strong><small>${escapeHtml(error?.message || "Try refreshing in a moment.")}</small></div>`;
    }
  }

  function setMobileFilters(open) {
    root.classList.toggle("filters-open", open);
    elements.scrim.hidden = !open;
    elements.mobileFilter.setAttribute("aria-expanded", String(open));
  }

  function applyPrefs() {
    state.prefs.artwork = elements.prefArtwork.checked;
    state.prefs.compact = elements.prefCompact.checked;
    state.prefs.soonFirst = elements.prefSoonFirst.checked;
    saveJson(STORAGE.prefs, state.prefs);
    render();
  }

  elements.prefArtwork.checked = state.prefs.artwork;
  elements.prefCompact.checked = state.prefs.compact;
  elements.prefSoonFirst.checked = state.prefs.soonFirst;

  const railCollapsed = localStorage.getItem(STORAGE.filterRail) === "true";
  root.classList.toggle("is-filter-collapsed", railCollapsed);
  elements.collapse.textContent = railCollapsed ? "›" : "‹";
  elements.collapse.setAttribute("aria-label", railCollapsed ? "Expand event filters" : "Collapse event filters");

  elements.collapse.addEventListener("click", () => {
    const collapsed = !root.classList.contains("is-filter-collapsed");
    root.classList.toggle("is-filter-collapsed", collapsed);
    elements.collapse.textContent = collapsed ? "›" : "‹";
    elements.collapse.setAttribute("aria-label", collapsed ? "Expand event filters" : "Collapse event filters");
    try { localStorage.setItem(STORAGE.filterRail, String(collapsed)); } catch {}
  });

  elements.mobileFilter.addEventListener("click", () => setMobileFilters(true));
  elements.close.addEventListener("click", () => setMobileFilters(false));
  elements.scrim.addEventListener("click", () => setMobileFilters(false));

  [elements.railSearch, elements.mainSearch].forEach((input) => {
    input.addEventListener("input", (event) => syncSearch(event.target.value));
  });

  elements.prefsButton.addEventListener("click", () => {
    const open = elements.prefsPanel.hidden;
    elements.prefsPanel.hidden = !open;
    elements.prefsButton.setAttribute("aria-expanded", String(open));
  });

  [elements.prefArtwork, elements.prefCompact, elements.prefSoonFirst].forEach((input) => {
    input.addEventListener("change", applyPrefs);
  });

  elements.refresh.addEventListener("click", () => loadEvents(true));

  root.addEventListener("click", (event) => {
    const scopeButton = event.target.closest("[data-events-scope]");
    if (scopeButton) {
      state.scope = scopeButton.dataset.eventsScope;
      render();
      setMobileFilters(false);
      return;
    }

    const modeButton = event.target.closest("[data-events-mode]");
    if (modeButton) {
      state.mode = modeButton.dataset.eventsMode;
      state.sport = "all";
      render();
      return;
    }

    const sportButton = event.target.closest("[data-events-sport]");
    if (sportButton) {
      state.sport = sportButton.dataset.eventsSport;
      render();
      setMobileFilters(false);
      return;
    }

    const favoriteButton = event.target.closest("[data-event-favorite]");
    if (favoriteButton) {
      toggleFavorite(findMatch(favoriteButton.dataset.eventFavorite));
      return;
    }

    const multiviewButton = event.target.closest("[data-event-multiview]");
    if (multiviewButton) {
      queueMultiview(findMatch(multiviewButton.dataset.eventMultiview));
      return;
    }

    const reminderButton = event.target.closest("[data-event-reminder]");
    if (reminderButton) {
      setReminder(findMatch(reminderButton.dataset.eventReminder));
      return;
    }

    const watchButton = event.target.closest("[data-event-watch]");
    if (watchButton) {
      openEvent(findMatch(watchButton.dataset.eventWatch));
    }
  });

  /* Keep the copied production shell visually on Events, even if the shell JS
     initializes its normal player state underneath this isolated overlay. */
  window.setTimeout(() => {
    document.querySelectorAll("#persistentSidebar .nav-link").forEach((link) => link.classList.remove("active"));
    document.querySelector('#persistentSidebar [data-ec-shell-view="events"]')?.classList.add("active");
  }, 0);

  countdownTimer = window.setInterval(updateCountdowns, 30_000);
  window.addEventListener("pagehide", () => window.clearInterval(countdownTimer), { once: true });

  loadEvents(false);
})();

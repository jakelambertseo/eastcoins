(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const directory = document.getElementById("eventsV2Directory");

  if (!API || !directory) return;

  const STORAGE = {
    eventPrefs: "eastcoinEventsRedesignV2Prefs",
    continueEvent: "eastcoinContinueStreamedEventV1",
    multiview: "eastcoinMultiviewV1",
    sidebarMode: "eastcoinsSidebarMode",
    sidebarLegacy: "eastcoinsSidebarCollapsed",
    chatWidth: "eastcoinsChatWidthV2",
    chatCollapsed: "eastcoinsChatCollapsed",
    reducedMotion: "eastcoinsReducedMotion",
    dockAutohide: "eastcoinsDockAutohide"
  };

  const SPORT_ORDER = [
    "american-football",
    "combat",
    "basketball",
    "baseball",
    "hockey",
    "soccer",
    "wrestling",
    "motorsport",
    "tennis",
    "golf",
    "other"
  ];

  const SPORT_META = {
    "american-football": { label: "Football", icon: "🏈" },
    combat: { label: "UFC / Combat", icon: "🥊" },
    basketball: { label: "Basketball", icon: "🏀" },
    baseball: { label: "Baseball", icon: "⚾" },
    hockey: { label: "Hockey", icon: "🏒" },
    soccer: { label: "Soccer", icon: "⚽" },
    wrestling: { label: "Wrestling", icon: "🤼" },
    motorsport: { label: "Motorsport", icon: "🏎" },
    tennis: { label: "Tennis", icon: "🎾" },
    golf: { label: "Golf", icon: "⛳" },
    other: { label: "Other Events", icon: "≡" }
  };

  const elements = {
    nav: document.getElementById("eventsV2Nav"),
    mobileMenu: document.getElementById("eventsV2MobileMenu"),
    mobileClose: document.getElementById("eventsV2MobileClose"),
    mobileOverlay: document.getElementById("eventsV2MobileOverlay"),
    navCycle: document.getElementById("eventsV2NavCycle"),
    railSearch: document.getElementById("eventsV2RailSearch"),
    omniForm: document.getElementById("eventsV2OmniForm"),
    omniInput: document.getElementById("eventsV2OmniInput"),
    omniAction: document.getElementById("eventsV2OmniAction"),
    omniHint: document.getElementById("eventsV2OmniHint"),
    categories: document.getElementById("eventsV2CategoryNav"),
    navLiveCount: document.getElementById("eventsV2NavLiveCount"),
    allCount: document.getElementById("eventsV2AllCount"),
    liveCount: document.getElementById("eventsV2LiveCount"),
    trendingCount: document.getElementById("eventsV2TrendingCount"),
    viewTitle: document.getElementById("eventsV2ViewTitle"),
    refresh: document.getElementById("eventsV2Refresh"),
    status: document.getElementById("eventsV2Status"),
    statusText: document.getElementById("eventsV2StatusText"),
    statusMeta: document.getElementById("eventsV2StatusMeta"),
    continueStrip: document.getElementById("eventsV2Continue"),
    continueArt: document.getElementById("eventsV2ContinueArt"),
    continueTitle: document.getElementById("eventsV2ContinueTitle"),
    continueMeta: document.getElementById("eventsV2ContinueMeta"),
    continueButton: document.getElementById("eventsV2ContinueButton"),
    chat: document.getElementById("eventsV2Chat"),
    chatResizer: document.getElementById("eventsV2ChatResizer"),
    prefsButton: document.getElementById("eventsV2PrefsButton"),
    prefsModal: document.getElementById("eventsV2PrefsModal"),
    prefsClose: document.getElementById("eventsV2PrefsClose"),
    prefsDone: document.getElementById("eventsV2PrefsDone"),
    prefArtwork: document.getElementById("eventsV2PrefArtwork"),
    prefCompact: document.getElementById("eventsV2PrefCompact"),
    prefSoon: document.getElementById("eventsV2PrefSoon"),
    prefChat: document.getElementById("eventsV2PrefChat"),
    prefCompactNav: document.getElementById("eventsV2PrefCompactNav"),
    prefMotion: document.getElementById("eventsV2PrefMotion"),
    prefDock: document.getElementById("eventsV2PrefDock"),
    resetChat: document.getElementById("eventsV2ResetChat"),
    mvModal: document.getElementById("eventsV2MvModal"),
    mvClose: document.getElementById("eventsV2MvClose"),
    mvSlots: document.getElementById("eventsV2MvSlots"),
    toast: document.getElementById("eventsV2Toast")
  };

  const state = {
    live: [],
    today: [],
    tomorrow: [],
    all: [],
    mode: "today",
    scope: "all",
    sport: "all",
    query: "",
    eventPrefs: {
      artwork: true,
      compact: false,
      soonFirst: true,
      ...readJson(STORAGE.eventPrefs, {})
    },
    updatedAt: 0,
    stale: false,
    pendingMvMatch: null
  };

  let toastTimer = 0;
  let countdownTimer = 0;
  let activeResize = null;

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function readBoolean(key, fallback = false) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === "true";
    } catch {
      return fallback;
    }
  }

  function writeBoolean(key, value) {
    try {
      localStorage.setItem(key, String(Boolean(value)));
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

  function eventId(match) {
    return String(match?.id || match?.matchId || match?.slug || "");
  }

  function timestamp(value) {
    let numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    if (numeric < 1_000_000_000_000) numeric *= 1000;
    return numeric;
  }

  function isLive(match) {
    return Boolean(match?._eastcoinLive);
  }

  function categoryText(match) {
    return String(
      match?._eastcoinProviders?.ppv?.category ||
      match?.category ||
      "Other"
    );
  }

  function isAlwaysOn(match) {
    const ppv = match?._eastcoinProviders?.ppv || {};
    const text = [
      match?.title,
      categoryText(match),
      ppv.tag,
      ppv.category
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      /\b24\s*\/?\s*7\b/.test(text) ||
      /\b24\s*hour/.test(text) ||
      text.includes("always live") ||
      text.includes("always-on") ||
      text.includes("always on") ||
      /\bchannels?\b/.test(text)
    );
  }

  function sportFamily(match) {
    if (isAlwaysOn(match)) return "other";

    const text = categoryText(match)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const has = (...values) => values.some((value) => text.includes(value));

    if (has("nfl", "ncaaf", "american football", "college football")) return "american-football";
    if (has("ufc", "mma", "boxing", "combat")) return "combat";
    if (has("nba", "wnba", "ncaab", "basketball")) return "basketball";
    if (has("mlb", "baseball")) return "baseball";
    if (has("nhl", "hockey")) return "hockey";
    if (has("soccer", "epl", "uefa", "fifa", "premier league") || text === "football") return "soccer";
    if (has("wwe", "aew", "wrestling")) return "wrestling";
    if (has("nascar", "formula", "motorsport", "racing")) return "motorsport";
    if (has("tennis")) return "tennis";
    if (has("golf", "pga")) return "golf";
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
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function tomorrowKey() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function matchSearchText(match) {
    const teams = normalizedTeams(match);
    return [
      match?.title,
      categoryText(match),
      teams.away?.name,
      teams.home?.name
    ].filter(Boolean).join(" ").toLowerCase();
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
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function fullTimeLabel(match) {
    if (isLive(match)) return "Live now";
    const start = timestamp(match?.date);
    if (!start) return "Upcoming";
    return new Date(start).toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function currentSource() {
    if (state.mode === "tomorrow") return state.tomorrow;
    return uniqueMatches([...state.live, ...state.today]);
  }

  function filteredMatches() {
    let matches = [...currentSource()];

    if (state.scope === "live") {
      /* 24/7 channels stay under Other Events in All Events, but are not
         allowed to crowd the actual live-game view. */
      matches = matches.filter((match) => isLive(match) && !isAlwaysOn(match));
    } else if (state.scope === "trending") {
      const candidates = matches.filter((match) => !isAlwaysOn(match));
      const popular = candidates.filter((match) => Boolean(match?.popular) || isLive(match));
      matches = popular.length ? popular : candidates;
    }

    if (state.sport !== "all") {
      matches = matches.filter((match) => sportFamily(match) === state.sport);
    }

    if (state.query) {
      matches = matches.filter((match) => matchSearchText(match).includes(state.query));
    }

    matches.sort((a, b) => {
      if (state.eventPrefs.soonFirst && isLive(a) !== isLive(b)) {
        return Number(isLive(b)) - Number(isLive(a));
      }
      return (timestamp(a?.date) || Infinity) - (timestamp(b?.date) || Infinity);
    });

    return matches;
  }

  function badgeReference(team) {
    return team?.badge || team?.logo || team?.image || team?.icon || "";
  }

  function normalizedTeam(value, fallback = "") {
    if (!value) return null;
    if (typeof value === "string") return { name: value, badge: "" };
    return {
      ...value,
      name: String(value.name || value.title || value.team || fallback || "Team"),
      badge: badgeReference(value)
    };
  }

  function splitTitleTeams(title) {
    const text = String(title || "").trim();
    const parts = text.split(/\s+(?:vs\.?|versus|@|at)\s+/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) return { away: null, home: null };
    return {
      away: { name: parts[0], badge: "" },
      home: { name: parts[1], badge: "" }
    };
  }

  function normalizedTeams(match) {
    const raw = match?.teams;
    let away = null;
    let home = null;

    if (Array.isArray(raw)) {
      away = normalizedTeam(raw[0], "Away");
      home = normalizedTeam(raw[1], "Home");
    } else if (raw && typeof raw === "object") {
      away = normalizedTeam(raw.away || raw.visitor || raw.team1 || raw.a, "Away");
      home = normalizedTeam(raw.home || raw.host || raw.team2 || raw.h, "Home");
    }

    away ||= normalizedTeam(match?.awayTeam || match?.away || match?.visitor, "Away");
    home ||= normalizedTeam(match?.homeTeam || match?.home || match?.host, "Home");

    if (!away || !home) {
      const parsed = splitTitleTeams(match?.title);
      away ||= parsed.away;
      home ||= parsed.home;
    }

    return { away, home };
  }

  function initials(name) {
    const words = String(name || "Team").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
  }

  function badgeUrl(team) {
    const reference = badgeReference(team);
    return reference ? API.badgeUrl?.(reference) || "" : "";
  }

  function posterUrl(match) {
    /* Prefer an explicit provider poster. If that is absent, ask EastCoin's
       API layer for the same generated matchup artwork production already uses. */
    return API.posterUrl?.(match?.poster) || API.matchupPosterUrl?.(match) || "";
  }

  function teamLogoMarkup(team) {
    if (!team) return `<span class="ec-events-v2-team-logo"><span>?</span></span>`;
    const src = badgeUrl(team);
    const fallback = initials(team.name);
    return `
      <span class="ec-events-v2-team-logo${src ? " has-image" : ""}" data-badge-container>
        ${src ? `<img src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" data-team-logo>` : ""}
        <span>${escapeHtml(fallback)}</span>
      </span>`;
  }

  function cardVisualMarkup(match) {
    const id = eventId(match);
    const meta = sportMeta(match);
    const teams = normalizedTeams(match);
    const poster = posterUrl(match);
    const hasUsefulMatchup = Boolean(teams.away && teams.home);

    const backdrop = poster
      ? `<img class="ec-events-v2-card-poster" src="${escapeAttr(poster)}" alt="" loading="lazy" decoding="async" data-card-poster><span class="ec-events-v2-card-poster-shade"></span>`
      : "";

    if (hasUsefulMatchup) {
      return `
        <div class="ec-events-v2-card-visual">
          ${backdrop}
          <span class="ec-events-v2-card-time${isLive(match) ? " is-live" : ""}" data-time-for="${escapeAttr(id)}">${escapeHtml(timeLabel(match))}</span>
          <button class="ec-events-v2-add-mv" type="button" data-add-multiview="${escapeAttr(id)}">+ MultiView</button>
          <div class="ec-events-v2-matchup">
            <div class="ec-events-v2-team">
              ${teamLogoMarkup(teams.away)}
              <span class="ec-events-v2-team-name">${escapeHtml(teams.away.name || "Away")}</span>
            </div>
            <span class="ec-events-v2-vs">VS</span>
            <div class="ec-events-v2-team">
              ${teamLogoMarkup(teams.home)}
              <span class="ec-events-v2-team-name">${escapeHtml(teams.home.name || "Home")}</span>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="ec-events-v2-card-visual">
        ${backdrop}
        <span class="ec-events-v2-card-time${isLive(match) ? " is-live" : ""}" data-time-for="${escapeAttr(id)}">${escapeHtml(timeLabel(match))}</span>
        <button class="ec-events-v2-add-mv" type="button" data-add-multiview="${escapeAttr(id)}">+ MultiView</button>
        <div class="ec-events-v2-single-event">
          <span class="ec-events-v2-single-icon">${poster ? `<img src="${escapeAttr(poster)}" alt="" loading="lazy" decoding="async" data-card-poster>` : meta.icon}</span>
          <span class="ec-events-v2-single-copy"><strong>${escapeHtml(match?.title || "Untitled event")}</strong><small>${escapeHtml(meta.label)}</small></span>
        </div>
      </div>`;
  }

  function cardMarkup(match) {
    const id = eventId(match);
    const title = String(match?.title || "Untitled event");
    return `
      <article class="ec-events-v2-card${isLive(match) ? " is-live" : ""}" data-event-card="${escapeAttr(id)}" tabindex="0" aria-label="${escapeAttr(title)}">
        ${cardVisualMarkup(match)}
        <div class="ec-events-v2-card-footer">
          <span class="ec-events-v2-card-title" title="${escapeAttr(title)}">${escapeHtml(title)}</span>
          <button class="ec-events-v2-watch" type="button" data-watch-event="${escapeAttr(id)}">${isLive(match) ? "Watch" : "Open"}</button>
        </div>
      </article>`;
  }

  function sectionMarkup(family, matches) {
    const meta = sportMeta(family);
    const liveCount = matches.filter((match) => isLive(match) && !isAlwaysOn(match)).length;
    return `
      <section class="ec-events-v2-section" data-sport-section="${escapeAttr(family)}">
        <header class="ec-events-v2-section-head">
          <div class="ec-events-v2-section-title">
            <span class="ec-events-v2-section-icon">${meta.icon}</span>
            <span class="ec-events-v2-section-copy"><strong>${escapeHtml(meta.label)}</strong><small>${family === "other" ? "Miscellaneous events and 24/7 feeds" : (liveCount ? `${liveCount} live now` : "Upcoming events")}</small></span>
          </div>
          <span class="ec-events-v2-section-counts">
            ${liveCount ? `<span class="is-live">${liveCount} LIVE</span>` : ""}
            <span>${matches.length} total</span>
          </span>
        </header>
        <div class="ec-events-v2-grid">${matches.map(cardMarkup).join("")}</div>
      </section>`;
  }

  function orderedFamilies(families) {
    return [...families].sort((a, b) => {
      const ai = SPORT_ORDER.indexOf(a);
      const bi = SPORT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  function renderCategoryNav() {
    const counts = new Map();
    currentSource().forEach((match) => {
      const family = sportFamily(match);
      const current = counts.get(family) || { total: 0, live: 0 };
      current.total += 1;
      if (isLive(match) && !isAlwaysOn(match)) current.live += 1;
      counts.set(family, current);
    });

    const families = orderedFamilies(counts.keys());
    elements.categories.innerHTML = families.map((family) => {
      const meta = sportMeta(family);
      const count = counts.get(family);
      return `
        <button class="ec-events-v2-nav-item${state.sport === family ? " is-active" : ""}" type="button" data-events-sport="${escapeAttr(family)}" data-nav-tooltip="${escapeAttr(meta.label)}">
          <span class="ec-events-v2-nav-icon">${meta.icon}</span>
          <span class="ec-events-v2-nav-copy"><strong>${escapeHtml(meta.label)}</strong><small>${family === "other" ? "Includes 24/7 feeds" : `${count.total} event${count.total === 1 ? "" : "s"}`}</small></span>
          <span class="ec-events-v2-count${count.live ? " is-live" : ""}">${count.live || count.total}</span>
        </button>`;
    }).join("");
  }

  function render() {
    document.body.classList.toggle("events-no-artwork", !state.eventPrefs.artwork);
    document.body.classList.toggle("events-compact", state.eventPrefs.compact);

    const source = currentSource();
    const matches = filteredMatches();
    const liveTotal = source.filter((match) => isLive(match) && !isAlwaysOn(match)).length;
    const trendingTotal = source.filter((match) => !isAlwaysOn(match) && (match?.popular || isLive(match))).length;

    elements.navLiveCount.textContent = String(liveTotal);
    elements.allCount.textContent = String(source.length);
    elements.liveCount.textContent = String(liveTotal);
    elements.trendingCount.textContent = String(trendingTotal);

    document.querySelectorAll("[data-events-scope]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.eventsScope === state.scope);
    });
    document.querySelectorAll("[data-events-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.eventsMode === state.mode);
    });

    elements.viewTitle.textContent = state.sport !== "all"
      ? sportMeta(state.sport).label
      : state.scope === "live"
        ? "Live Only"
        : state.scope === "trending"
          ? "Trending"
          : "All Events";

    renderCategoryNav();

    if (!matches.length) {
      directory.innerHTML = `<div class="ec-events-v2-empty"><strong>No matching events</strong><small>Try another category, date, or search.</small></div>`;
      updateImageStates();
      return;
    }

    const groups = new Map();
    matches.forEach((match) => {
      const family = sportFamily(match);
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(match);
    });

    const families = orderedFamilies(groups.keys());
    directory.innerHTML = families.map((family) => sectionMarkup(family, groups.get(family))).join("");
    updateImageStates();
    updateCountdowns();
    updateMultiviewButtonStates();
  }

  function updateImageStates() {
    document.querySelectorAll("[data-team-logo]").forEach((image) => {
      const container = image.closest("[data-badge-container]");
      const markLoaded = () => container?.classList.add("has-image");
      const markFailed = () => {
        container?.classList.remove("has-image");
        image.remove();
      };
      if (image.complete) {
        image.naturalWidth ? markLoaded() : markFailed();
      } else {
        image.addEventListener("load", markLoaded, { once: true });
        image.addEventListener("error", markFailed, { once: true });
      }
    });

    document.querySelectorAll("[data-card-poster]").forEach((image) => {
      image.addEventListener("error", () => image.remove(), { once: true });
    });
  }

  function updateCountdowns() {
    const byId = new Map(uniqueMatches([...state.live, ...state.today, ...state.tomorrow, ...state.all]).map((match) => [eventId(match), match]));
    document.querySelectorAll("[data-time-for]").forEach((element) => {
      const match = byId.get(element.dataset.timeFor);
      if (!match) return;
      element.textContent = timeLabel(match);
      element.classList.toggle("is-live", isLive(match));
    });
  }

  function findMatch(id) {
    return uniqueMatches([...state.live, ...state.today, ...state.tomorrow, ...state.all])
      .find((match) => eventId(match) === String(id)) || null;
  }

  function openEvent(match) {
    if (!match) return;
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("event", eventId(match));
    window.location.href = url.href;
  }

  function isLocalDevelopment() {
    return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  }

  function normalizeManualUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) throw new Error("Paste a stream URL first.");
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Only HTTP or HTTPS URLs can be loaded.");
    if (parsed.protocol === "http:" && !isLocalDevelopment()) throw new Error("Use an HTTPS stream URL on EastCoin.");
    return parsed.href;
  }

  function looksLikeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (/^https?:\/\//i.test(raw) || /^www\./i.test(raw)) return true;
    return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#]|$)/i.test(raw);
  }

  function updateOmniMode() {
    const value = elements.omniInput.value;
    const urlMode = looksLikeUrl(value);
    elements.omniForm.classList.toggle("is-url", urlMode);
    elements.omniAction.textContent = urlMode ? "Load" : "Search";
    elements.omniHint.textContent = urlMode
      ? "Press Enter to load this URL in the EastCoin player."
      : "Search teams, games and leagues — or paste a stream URL.";

    if (!urlMode) {
      state.query = String(value || "").trim().toLowerCase();
      render();
    } else if (state.query) {
      state.query = "";
      render();
    }
  }

  function submitOmni() {
    const value = elements.omniInput.value.trim();
    if (!value) {
      state.query = "";
      render();
      return;
    }

    if (looksLikeUrl(value)) {
      try {
        const streamUrl = normalizeManualUrl(value);
        const destination = new URL("index.html", window.location.href);
        destination.searchParams.set("watch", streamUrl);
        window.location.href = destination.href;
      } catch (error) {
        toast(error?.message || "That URL could not be loaded.");
      }
      return;
    }

    state.query = value.toLowerCase();
    render();
  }

  function defaultMultiviewState() {
    return {
      layout: 4,
      slots: [null, null, null, null],
      splits: {
        2: { col: 50, row: 50 },
        3: { col: 65, row: 50 },
        4: { col: 50, row: 50 }
      }
    };
  }

  function readMultiviewState() {
    const raw = readJson(STORAGE.multiview, null);
    if (!raw || !Array.isArray(raw.slots)) return defaultMultiviewState();
    return {
      ...defaultMultiviewState(),
      ...raw,
      slots: Array.from({ length: 4 }, (_, index) => raw.slots[index] || null),
      splits: raw.splits || defaultMultiviewState().splits
    };
  }

  function multiviewSource(match) {
    return {
      type: "event",
      id: eventId(match),
      title: String(match?.title || "EastCoin event"),
      meta: sportMeta(match).label
    };
  }

  function saveMatchToSlot(match, slot) {
    const mv = readMultiviewState();
    mv.slots[slot] = multiviewSource(match);
    if (slot >= 3) mv.layout = 4;
    else if (slot === 2 && Number(mv.layout) < 3) mv.layout = 3;
    else if (slot === 1 && Number(mv.layout) < 2) mv.layout = 2;
    writeJson(STORAGE.multiview, mv);
    toast(`${match.title} added to MultiView slot ${slot + 1}.`);
    updateMultiviewButtonStates();
  }

  function addToMultiview(match) {
    if (!match) return;
    const mv = readMultiviewState();
    const existing = mv.slots.findIndex((slot) => slot?.type === "event" && String(slot.id) === eventId(match));
    if (existing !== -1) {
      toast(`${match.title} is already in MultiView slot ${existing + 1}.`);
      return;
    }

    const empty = mv.slots.findIndex((slot) => !slot);
    if (empty !== -1) {
      saveMatchToSlot(match, empty);
      return;
    }

    state.pendingMvMatch = match;
    elements.mvSlots.innerHTML = mv.slots.map((slot, index) => `
      <div class="ec-events-v2-mv-slot">
        <span>${index + 1}</span>
        <span><strong>${escapeHtml(slot?.title || `Stream ${index + 1}`)}</strong><small>${escapeHtml(slot?.meta || "Loaded stream")}</small></span>
        <button type="button" data-replace-mv-slot="${index}">Replace</button>
      </div>`).join("");
    setModal(elements.mvModal, true);
  }

  function updateMultiviewButtonStates() {
    const mv = readMultiviewState();
    const slotsById = new Map();
    mv.slots.forEach((slot, index) => {
      if (slot?.type === "event" && slot.id) slotsById.set(String(slot.id), index);
    });
    document.querySelectorAll("[data-add-multiview]").forEach((button) => {
      const slot = slotsById.get(button.dataset.addMultiview);
      button.classList.toggle("is-added", slot !== undefined);
      button.textContent = slot !== undefined ? `✓ MV ${slot + 1}` : "+ MultiView";
    });
  }

  function setModal(modal, open) {
    if (!modal) return;
    modal.hidden = !open;
    modal.setAttribute("aria-hidden", String(!open));
  }

  function toast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2500);
  }

  function applyEventPrefs() {
    state.eventPrefs.artwork = elements.prefArtwork.checked;
    state.eventPrefs.compact = elements.prefCompact.checked;
    state.eventPrefs.soonFirst = elements.prefSoon.checked;
    writeJson(STORAGE.eventPrefs, state.eventPrefs);
    render();
  }

  function navMode() {
    if (document.body.classList.contains("sidebar-hidden")) return "hidden";
    if (document.body.classList.contains("sidebar-collapsed")) return "rail";
    return "expanded";
  }

  function setNavMode(mode, save = true) {
    const normalized = ["expanded", "rail", "hidden"].includes(mode) ? mode : "expanded";
    document.body.classList.toggle("sidebar-collapsed", normalized === "rail");
    document.body.classList.toggle("sidebar-hidden", normalized === "hidden");
    elements.navCycle.textContent = normalized === "expanded" ? "‹" : normalized === "rail" ? "×" : "☰";
    elements.navCycle.setAttribute("aria-label", normalized === "expanded" ? "Compact navigation" : normalized === "rail" ? "Hide navigation" : "Show navigation");
    elements.prefCompactNav.checked = normalized === "rail";
    if (save) {
      try {
        localStorage.setItem(STORAGE.sidebarMode, normalized);
        localStorage.setItem(STORAGE.sidebarLegacy, String(normalized !== "expanded"));
      } catch {}
    }
  }

  function cycleNav() {
    const mode = navMode();
    setNavMode(mode === "expanded" ? "rail" : mode === "rail" ? "hidden" : "expanded", true);
  }

  function setMobileMenu(open) {
    document.body.classList.toggle("menu-open", open);
    elements.mobileOverlay.hidden = !open;
    elements.mobileMenu.setAttribute("aria-expanded", String(open));
  }

  function setChatVisible(visible, save = true) {
    document.body.classList.toggle("chat-collapsed", !visible);
    elements.prefChat.checked = visible;
    if (save) writeBoolean(STORAGE.chatCollapsed, !visible);
  }

  function setReducedMotion(reduced, save = true) {
    document.documentElement.classList.toggle("ec-events-reduced-motion", reduced);
    elements.prefMotion.checked = reduced;
    if (save) writeBoolean(STORAGE.reducedMotion, reduced);
  }

  function setChatWidth(value, save = true) {
    const width = Math.min(620, Math.max(280, Number(value) || 360));
    document.documentElement.style.setProperty("--ec-chat-width", `${width}px`);
    if (save) {
      try { localStorage.setItem(STORAGE.chatWidth, String(width)); } catch {}
    }
  }

  function openPrefs() {
    elements.prefArtwork.checked = state.eventPrefs.artwork;
    elements.prefCompact.checked = state.eventPrefs.compact;
    elements.prefSoon.checked = state.eventPrefs.soonFirst;
    elements.prefChat.checked = !document.body.classList.contains("chat-collapsed");
    elements.prefCompactNav.checked = navMode() === "rail";
    elements.prefMotion.checked = document.documentElement.classList.contains("ec-events-reduced-motion");
    elements.prefDock.checked = readBoolean(STORAGE.dockAutohide, true);
    setModal(elements.prefsModal, true);
  }

  function loadContinueWatching() {
    const saved = readJson(STORAGE.continueEvent, null);
    const match = saved?.match || saved?.event || null;
    if (!match || !eventId(match)) {
      elements.continueStrip.hidden = true;
      return;
    }
    elements.continueStrip.hidden = false;
    elements.continueTitle.textContent = match.title || "Recent event";
    elements.continueMeta.textContent = "Resume your last EastCoin event.";
    const art = posterUrl(match);
    elements.continueArt.innerHTML = art ? `<img src="${escapeAttr(art)}" alt="" loading="lazy" decoding="async">` : sportMeta(match).icon;
    elements.continueButton.onclick = () => openEvent(match);
  }

  async function loadEvents(force = false) {
    elements.status.classList.remove("is-ready", "is-error");
    elements.statusText.textContent = force ? "Refreshing events…" : "Loading events…";
    elements.statusMeta.textContent = "";
    directory.innerHTML = `<div class="ec-events-v2-loading"><span></span><strong>Loading events</strong><small>Building the simplified EastCoin event list.</small></div>`;

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

      const liveGames = state.live.filter((match) => !isAlwaysOn(match)).length;
      const alwaysOn = state.live.filter(isAlwaysOn).length;
      elements.status.classList.add("is-ready");
      elements.statusText.textContent = state.stale ? "Showing cached events while part of the feed refreshes." : "Events ready.";
      elements.statusMeta.textContent = `${liveGames} live games · ${state.today.length} today${alwaysOn ? ` · ${alwaysOn} 24/7 feed${alwaysOn === 1 ? "" : "s"} under Other Events` : ""}`;
      render();
      loadContinueWatching();
    } catch (error) {
      elements.status.classList.add("is-error");
      elements.statusText.textContent = "The event feed could not be loaded.";
      elements.statusMeta.textContent = "Retry available";
      directory.innerHTML = `<div class="ec-events-v2-empty"><strong>Event feed unavailable</strong><small>${escapeHtml(error?.message || "Try refreshing in a moment.")}</small></div>`;
    }
  }

  /* Initial interface state uses the same storage keys as production. */
  const storedMode = (() => {
    try {
      const mode = localStorage.getItem(STORAGE.sidebarMode);
      return ["expanded", "rail", "hidden"].includes(mode) ? mode : "expanded";
    } catch { return "expanded"; }
  })();
  setNavMode(storedMode, false);
  setChatVisible(!readBoolean(STORAGE.chatCollapsed, false), false);
  setReducedMotion(readBoolean(STORAGE.reducedMotion, false), false);
  setChatWidth((() => { try { return localStorage.getItem(STORAGE.chatWidth) || 360; } catch { return 360; } })(), false);

  elements.prefArtwork.checked = state.eventPrefs.artwork;
  elements.prefCompact.checked = state.eventPrefs.compact;
  elements.prefSoon.checked = state.eventPrefs.soonFirst;

  elements.omniInput.addEventListener("input", updateOmniMode);
  elements.omniForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitOmni();
  });
  elements.railSearch.addEventListener("click", () => {
    setNavMode("expanded", true);
    window.setTimeout(() => elements.omniInput.focus(), 40);
  });

  elements.navCycle.addEventListener("click", cycleNav);
  elements.mobileMenu.addEventListener("click", () => setMobileMenu(true));
  elements.mobileClose.addEventListener("click", () => setMobileMenu(false));
  elements.mobileOverlay.addEventListener("click", () => setMobileMenu(false));

  document.querySelectorAll("[data-events-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scope = button.dataset.eventsScope;
      if (state.scope === "live") state.mode = "today";
      state.sport = "all";
      render();
      setMobileMenu(false);
    });
  });

  document.querySelectorAll("[data-events-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.eventsMode;
      if (state.mode === "tomorrow" && state.scope === "live") state.scope = "all";
      state.sport = "all";
      render();
    });
  });

  elements.categories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-events-sport]");
    if (!button) return;
    state.sport = button.dataset.eventsSport;
    state.scope = "all";
    render();
    setMobileMenu(false);
  });

  elements.refresh.addEventListener("click", () => loadEvents(true));
  elements.prefsButton.addEventListener("click", openPrefs);
  elements.prefsClose.addEventListener("click", () => setModal(elements.prefsModal, false));
  elements.prefsDone.addEventListener("click", () => setModal(elements.prefsModal, false));
  elements.prefsModal.addEventListener("click", (event) => {
    if (event.target === elements.prefsModal) setModal(elements.prefsModal, false);
  });

  [elements.prefArtwork, elements.prefCompact, elements.prefSoon].forEach((input) => input.addEventListener("change", applyEventPrefs));
  elements.prefChat.addEventListener("change", () => setChatVisible(elements.prefChat.checked, true));
  elements.prefCompactNav.addEventListener("change", () => setNavMode(elements.prefCompactNav.checked ? "rail" : "expanded", true));
  elements.prefMotion.addEventListener("change", () => setReducedMotion(elements.prefMotion.checked, true));
  elements.prefDock.addEventListener("change", () => writeBoolean(STORAGE.dockAutohide, elements.prefDock.checked));
  elements.resetChat.addEventListener("click", () => {
    setChatWidth(360, true);
    toast("Twitch chat width reset.");
  });

  directory.addEventListener("click", (event) => {
    const mvButton = event.target.closest("[data-add-multiview]");
    if (mvButton) {
      event.preventDefault();
      event.stopPropagation();
      addToMultiview(findMatch(mvButton.dataset.addMultiview));
      return;
    }

    const watchButton = event.target.closest("[data-watch-event]");
    if (watchButton) {
      event.preventDefault();
      event.stopPropagation();
      openEvent(findMatch(watchButton.dataset.watchEvent));
      return;
    }

    const card = event.target.closest("[data-event-card]");
    if (card) openEvent(findMatch(card.dataset.eventCard));
  });

  directory.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("button")) return;
    const card = event.target.closest("[data-event-card]");
    if (!card) return;
    event.preventDefault();
    openEvent(findMatch(card.dataset.eventCard));
  });

  elements.mvClose.addEventListener("click", () => setModal(elements.mvModal, false));
  elements.mvModal.addEventListener("click", (event) => {
    if (event.target === elements.mvModal) setModal(elements.mvModal, false);
  });
  elements.mvSlots.addEventListener("click", (event) => {
    const button = event.target.closest("[data-replace-mv-slot]");
    if (!button || !state.pendingMvMatch) return;
    saveMatchToSlot(state.pendingMvMatch, Number(button.dataset.replaceMvSlot));
    state.pendingMvMatch = null;
    setModal(elements.mvModal, false);
  });

  elements.chatResizer.addEventListener("pointerdown", (event) => {
    if (document.body.classList.contains("chat-collapsed")) return;
    activeResize = { pointerId: event.pointerId };
    elements.chatResizer.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  window.addEventListener("pointermove", (event) => {
    if (!activeResize || activeResize.pointerId !== event.pointerId) return;
    const width = window.innerWidth - event.clientX;
    setChatWidth(width, false);
  });
  window.addEventListener("pointerup", (event) => {
    if (!activeResize || activeResize.pointerId !== event.pointerId) return;
    const width = window.innerWidth - event.clientX;
    setChatWidth(width, true);
    activeResize = null;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!elements.mvModal.hidden) {
      state.pendingMvMatch = null;
      setModal(elements.mvModal, false);
      return;
    }
    if (!elements.prefsModal.hidden) {
      setModal(elements.prefsModal, false);
      return;
    }
    if (document.body.classList.contains("menu-open")) setMobileMenu(false);
  });

  countdownTimer = window.setInterval(updateCountdowns, 30_000);
  window.addEventListener("pagehide", () => window.clearInterval(countdownTimer), { once: true });

  loadEvents(false);
})();

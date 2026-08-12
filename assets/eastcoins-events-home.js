(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const directory = document.getElementById("eventsV2Directory");
  const pageUrl = new URL(window.location.href);
  const embedded = pageUrl.searchParams.get("shell") === "1" && window.parent !== window;

  if (embedded) document.documentElement.classList.add("ec-events-shell-embedded");
  if (!API || !directory) return;

  const STORAGE = {
    eventPrefs: "eastcoinEventsRedesignV2Prefs",
    continueEvent: "eastcoinContinueStreamedEventV1",
    multiview: "eastcoinMultiviewV1",
    sidebarMode: "eastcoinsSidebarMode",
    sidebarLegacy: "eastcoinsSidebarCollapsed",
    chatWidth: "eastcoinsChatWidthV2",
    chatCollapsed: "eastcoinsChatCollapsed",
    reducedMotion: "eastcoinsReducedMotion"
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
    resetChat: document.getElementById("eventsV2ResetChat"),
    mvModal: document.getElementById("eventsV2MvModal"),
    mvClose: document.getElementById("eventsV2MvClose"),
    mvSlots: document.getElementById("eventsV2MvSlots"),
    mvPromptModal: document.getElementById("eventsV2MvPromptModal"),
    mvPromptClose: document.getElementById("eventsV4MvPromptClose"),
    mvPromptKeep: document.getElementById("eventsV4MvKeepBrowsing"),
    mvPromptOpen: document.getElementById("eventsV4MvOpen"),
    mvPromptCopy: document.getElementById("eventsV4MvPromptCopy"),
    mvPromptStreams: document.getElementById("eventsV4MvPromptStreams"),
    supportDrawer: document.getElementById("eventsV2SupportDrawer"),
    supportScrim: document.getElementById("eventsV2SupportScrim"),
    supportClose: document.getElementById("eventsV2SupportClose"),
    supportTitle: document.getElementById("eventsV2SupportTitle"),
    supportKicker: document.getElementById("eventsV2SupportKicker"),
    supportFrame: document.getElementById("eventsV2SupportFrame"),
    statusDrawerContent: document.getElementById("eventsV2StatusDrawerContent"),
    emoteHelpButton: document.getElementById("eventsV2EmoteHelpButton"),
    statusButton: document.getElementById("eventsV2StatusButton"),
    playerStage: document.getElementById("eventsV5PlayerStage"),
    playerFrame: document.getElementById("eventsV5PlayerFrame"),
    playerLoader: document.getElementById("eventsV5PlayerLoader"),
    playerLoaderTitle: document.getElementById("eventsV5PlayerLoaderTitle"),
    playerLoaderMeta: document.getElementById("eventsV5PlayerLoaderMeta"),
    backVideo: document.getElementById("eventsV5BackVideo"),
    controlsToggle: document.getElementById("eventsV5ControlsToggle"),
    controlsDrawer: document.getElementById("eventsV5ControlsDrawer"),
    controlsClose: document.getElementById("eventsV5ControlsClose"),
    theaterControl: document.getElementById("eventsV5TheaterControl"),
    chatControl: document.getElementById("eventsV5ChatControl"),
    navControl: document.getElementById("eventsV5NavControl"),
    gameControl: document.getElementById("eventsV5GameControl"),
    settingsControl: document.getElementById("eventsV5SettingsControl"),
    toast: document.getElementById("eventsV2Toast")
  };

  const state = {
    live: [],
    today: [],
    tomorrow: [],
    all: [],
    mode: ["today", "tomorrow"].includes(pageUrl.searchParams.get("mode")) ? pageUrl.searchParams.get("mode") : "today",
    scope: ["all", "live", "trending"].includes(pageUrl.searchParams.get("scope")) ? pageUrl.searchParams.get("scope") : "all",
    sport: pageUrl.searchParams.get("sport") || "all",
    query: String(pageUrl.searchParams.get("q") || "").trim().toLowerCase(),
    eventPrefs: {
      artwork: true,
      compact: false,
      soonFirst: true,
      ...readJson(STORAGE.eventPrefs, {})
    },
    updatedAt: 0,
    stale: false,
    pendingMvMatch: null,
    lastMvPromptSignature: "",
    playerMounted: false,
    playerVisible: false,
    playerRequestToken: 0,
    playerRevealTimer: 0,
    playerRevealTimeout: 0,
    theater: false
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

  function teamKey(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(w|women|womens|men|mens|fc|cf|sc|afc|club)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function displayPairKey(match) {
    const family = sportFamily(match);
    const teams = normalizedTeams(match);
    const names = [teams.away?.name, teams.home?.name]
      .filter(Boolean)
      .map(teamKey)
      .filter(Boolean)
      .sort();

    if (names.length === 2) {
      return `${family}:${localDayKey(match?.date)}:${names.join("|")}`;
    }

    return `${family}:${localDayKey(match?.date)}:${teamKey(match?.title)}`;
  }

  function displayMatchQuality(match) {
    const teams = normalizedTeams(match);
    const badgeCount = [teams.away, teams.home]
      .filter((team) => Boolean(badgeReference(team))).length;
    const sourceCount = Array.isArray(match?.sources) ? match.sources.length : 0;

    return (
      badgeCount * 20 +
      (match?.teams ? 15 : 0) +
      (match?.poster ? 8 : 0) +
      Math.min(sourceCount, 6) * 2 +
      (match?._eastcoinProviders?.streamed ? 4 : 0)
    );
  }

  function dedupeDisplayMatches(matches) {
    const groups = new Map();

    uniqueMatches(matches).forEach((match) => {
      const key = displayPairKey(match);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, match);
        return;
      }

      const leftTime = timestamp(existing?.date);
      const rightTime = timestamp(match?.date);
      const closeEnough =
        !leftTime ||
        !rightTime ||
        Math.abs(leftTime - rightTime) <= 90 * 60 * 1000;

      if (!closeEnough) {
        groups.set(`${key}:${eventId(match)}`, match);
        return;
      }

      if (displayMatchQuality(match) > displayMatchQuality(existing)) {
        groups.set(key, match);
      }
    });

    return [...groups.values()];
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
    if (state.mode === "tomorrow") return dedupeDisplayMatches(state.tomorrow);
    return dedupeDisplayMatches([...state.live, ...state.today]);
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
        <div class="ec-events-v2-single-event">
          <span class="ec-events-v2-single-icon">${poster ? `<img src="${escapeAttr(poster)}" alt="" loading="lazy" decoding="async" data-card-poster>` : meta.icon}</span>
          <span class="ec-events-v2-single-copy"><strong>${escapeHtml(match?.title || "Untitled event")}</strong><small>${escapeHtml(meta.label)}</small></span>
        </div>
      </div>`;
  }

  function cardMarkup(match) {
    const id = eventId(match);
    const title = String(match?.title || "Untitled event");
    const meta = sportMeta(match);
    const footerDetail = isLive(match)
      ? "Live now"
      : fullTimeLabel(match);

    return `
      <article class="ec-events-v2-card${isLive(match) ? " is-live" : ""}" data-event-card="${escapeAttr(id)}" tabindex="0" aria-label="${escapeAttr(title)}">
        ${cardVisualMarkup(match)}
        <div class="ec-events-v2-card-footer">
          <span class="ec-events-v2-card-footer-meta">
            <strong>${escapeHtml(meta.label)}</strong>
            <small>${escapeHtml(footerDetail)}</small>
          </span>
          <span class="ec-events-v2-card-actions">
            <button class="ec-events-v2-add-mv" type="button" data-add-multiview="${escapeAttr(id)}">+ MultiView</button>
            <button class="ec-events-v2-watch" type="button" data-watch-event="${escapeAttr(id)}">${isLive(match) ? "Watch" : "Open"}</button>
          </span>
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
      const sport = state.sport !== "all" ? sportMeta(state.sport).label : "";
      const copy = state.query
        ? {
            title: `No events match “${state.query}”`,
            detail: "Try another team, league, category, or date."
          }
        : state.scope === "live"
          ? {
              title: sport ? `No live ${sport} events right now` : "No live events right now",
              detail: "Try All Events or check back when the next game starts."
            }
          : sport
            ? {
                title: `No ${sport} events in this view`,
                detail: "Try another date or return to All Events."
              }
            : {
                title: "No events scheduled in this view",
                detail: "Try another date or refresh the event feed."
              };

      directory.innerHTML = `<div class="ec-events-v2-empty"><strong>${escapeHtml(copy.title)}</strong><small>${escapeHtml(copy.detail)}</small></div>`;
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

    if (embedded) {
      const allMatches = dedupeDisplayMatches([...state.live, ...state.today]);
      const liveMatches = dedupeDisplayMatches(state.live.filter((match) => !isAlwaysOn(match)));
      const trendingMatchesList = allMatches.filter((match) => !isAlwaysOn(match) && (match?.popular || isLive(match)));
      const categoryCounts = {};
      allMatches.forEach((match) => {
        const family = sportFamily(match);
        categoryCounts[family] = (categoryCounts[family] || 0) + 1;
      });
      window.parent.postMessage({
        type: "eastcoin:event-nav-state",
        allCount: allMatches.length,
        liveCount: liveMatches.length,
        trendingCount: trendingMatchesList.length,
        categoryCounts
      }, window.location.origin);
    }
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

  function clearPlayerRevealTimers() {
    window.clearInterval(state.playerRevealTimer);
    window.clearTimeout(state.playerRevealTimeout);
    state.playerRevealTimer = 0;
    state.playerRevealTimeout = 0;
  }

  function setPlayerLoader(title, meta) {
    elements.playerLoaderTitle.textContent = title;
    elements.playerLoaderMeta.textContent = meta;
    elements.playerLoader.classList.remove("is-hidden");
  }

  function revealPlayerWhenReady(token) {
    clearPlayerRevealTimers();

    const check = () => {
      if (token !== state.playerRequestToken) return;

      try {
        const activeFrame =
          elements.playerFrame.contentDocument?.getElementById("activeFrame");

        if (activeFrame) {
          clearPlayerRevealTimers();
          elements.playerLoader.classList.add("is-hidden");
        }
      } catch {}
    };

    check();

    if (token !== state.playerRequestToken) return;

    state.playerRevealTimer = window.setInterval(check, 90);
    state.playerRevealTimeout = window.setTimeout(() => {
      if (token !== state.playerRequestToken) return;
      clearPlayerRevealTimers();
      elements.playerLoaderTitle.textContent = "Still opening this stream…";
      elements.playerLoaderMeta.textContent =
        "The provider is taking longer than usual. EastCoin will keep trying.";
    }, 12000);
  }

  function showPlayerStage() {
    state.playerVisible = true;
    elements.playerStage.hidden = false;
    elements.playerStage.setAttribute("aria-hidden", "false");
    elements.backVideo.hidden = true;
    setMobileMenu(false);
    updateSideControls();
  }

  function showEventsHome() {
    state.playerVisible = false;
    elements.playerStage.hidden = true;
    elements.playerStage.setAttribute("aria-hidden", "true");
    elements.backVideo.hidden = !state.playerMounted;
    document.body.classList.remove("events-v5-theater");
    state.theater = false;
    updateSideControls();
  }

  function loadPlayerParameters(parameters, label = "Opening stream…") {
    const next = new URLSearchParams(parameters);
    next.set("shell", "1");

    const playerUrl = new URL("player.html", window.location.href);
    playerUrl.search = next.toString();

    state.playerMounted = true;
    state.playerRequestToken += 1;
    const token = state.playerRequestToken;

    setPlayerLoader(
      label,
      next.has("event")
        ? "Loading the selected event without leaving EastCoin."
        : "Loading the pasted stream without rebuilding the page."
    );

    showPlayerStage();
    elements.playerFrame.src = playerUrl.href;
    revealPlayerWhenReady(token);
  }

  function openEvent(match) {
    if (!match) return;

    if (embedded) {
      window.parent.postMessage({
        type: "eastcoin:open-player",
        event: eventId(match)
      }, window.location.origin);
      return;
    }

    const parameters = new URLSearchParams();
    parameters.set("event", eventId(match));

    loadPlayerParameters(
      parameters,
      `Opening ${String(match.title || "event")}…`
    );
  }

  function loadManualStream(streamUrl) {
    if (embedded) {
      window.parent.postMessage({
        type: "eastcoin:open-player",
        watch: streamUrl
      }, window.location.origin);
      return;
    }
    const parameters = new URLSearchParams();
    parameters.set("watch", streamUrl);
    loadPlayerParameters(parameters, "Opening stream…");
  }

  function openGameOverlay() {
    const sendOverlayMessage = () => {
      try {
        elements.playerFrame.contentWindow?.postMessage(
          { type: "eastcoin:toggle-game-overlay" },
          window.location.origin
        );
      } catch {}
    };

    if (!state.playerMounted) {
      state.playerMounted = true;
      state.playerRequestToken += 1;
      const token = state.playerRequestToken;

      setPlayerLoader("Opening EastCoin Games…", "Preparing the game overlay.");
      showPlayerStage();

      const url = new URL("player.html", window.location.href);
      url.searchParams.set("shell", "1");
      elements.playerFrame.src = url.href;

      const wait = window.setInterval(() => {
        if (token !== state.playerRequestToken) {
          window.clearInterval(wait);
          return;
        }

        try {
          if (elements.playerFrame.contentDocument?.body) {
            window.clearInterval(wait);
            elements.playerLoader.classList.add("is-hidden");
            window.setTimeout(sendOverlayMessage, 120);
          }
        } catch {}
      }, 90);

      return;
    }

    showPlayerStage();
    sendOverlayMessage();
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
      if (String(value || "").trim()) showEventsHome();
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
        loadManualStream(streamUrl);
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

    const layout = [2, 3, 4].includes(Number(raw.layout))
      ? Number(raw.layout)
      : 2;

    return {
      ...defaultMultiviewState(),
      ...raw,
      layout,
      slots: Array.from({ length: 4 }, (_, index) => {
        const slot = raw.slots[index];
        if (!slot || !["event", "url"].includes(slot.type)) return null;
        return slot;
      }),
      splits:
        raw.splits && typeof raw.splits === "object"
          ? raw.splits
          : defaultMultiviewState().splits
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

  function occupiedMultiviewSlots(mv = readMultiviewState()) {
    return mv.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => Boolean(slot));
  }

  function multiviewPromptSignature(mv = readMultiviewState()) {
    return occupiedMultiviewSlots(mv)
      .map(({ slot, index }) =>
        `${index}:${slot?.type || "stream"}:${slot?.id || slot?.url || slot?.title || ""}`
      )
      .join("|");
  }

  function maybePromptOpenMultiview(mv = readMultiviewState()) {
    const occupied = occupiedMultiviewSlots(mv);

    if (occupied.length < 2 || !elements.mvPromptModal) {
      return;
    }

    const signature = multiviewPromptSignature(mv);
    if (!signature || signature === state.lastMvPromptSignature) {
      return;
    }

    state.lastMvPromptSignature = signature;

    elements.mvPromptCopy.textContent =
      `${occupied.length} streams are queued. Open them together now, or keep browsing and add more.`;

    elements.mvPromptStreams.innerHTML = occupied.map(({ slot, index }) => `
      <div class="ec-events-v4-open-mv-stream">
        <span>${index + 1}</span>
        <span>
          <strong>${escapeHtml(slot?.title || `Stream ${index + 1}`)}</strong>
          <small>${escapeHtml(slot?.meta || "EastCoin stream")}</small>
        </span>
      </div>`).join("");

    setModal(elements.mvPromptModal, true);
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

    window.setTimeout(() => {
      maybePromptOpenMultiview(readMultiviewState());
    }, 0);
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
    if (elements.navControl) updateSideControls();
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
    if (elements.chatControl) updateSideControls();
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

  function controlsOpen() {
    return document.body.classList.contains("events-v5-controls-open");
  }

  function setControlsOpen(open) {
    document.body.classList.toggle("events-v5-controls-open", Boolean(open));
    elements.controlsDrawer.setAttribute("aria-hidden", String(!open));
    elements.controlsToggle.setAttribute("aria-expanded", String(Boolean(open)));
    elements.controlsToggle.setAttribute(
      "aria-label",
      open ? "Close view controls" : "Open view controls"
    );
  }

  function updateSideControls() {
    const chatVisible = !document.body.classList.contains("chat-collapsed");
    const navVisible = navMode() !== "hidden";

    elements.theaterControl.classList.toggle("is-active", state.theater);
    elements.theaterControl.querySelector("strong").textContent =
      state.theater ? "Exit Theater" : "Theater";
    elements.theaterControl.querySelector(".ec-events-v5-control-icon").textContent =
      state.theater ? "↙" : "⛶";

    elements.chatControl.classList.toggle("is-active", chatVisible);
    elements.chatControl.querySelector("strong").textContent =
      chatVisible ? "Hide chat" : "Show chat";

    elements.navControl.classList.toggle("is-active", navVisible);
    elements.navControl.querySelector("strong").textContent =
      navVisible ? "Hide nav" : "Show nav";
    elements.navControl.querySelector(".ec-events-v5-control-icon").textContent =
      navVisible ? "◀" : "☰";
  }

  function setTheaterMode(enabled) {
    const next = Boolean(enabled);

    if (next && !state.playerMounted) {
      toast("Open a stream before entering Theater mode.");
      return;
    }

    state.theater = next;

    if (next) {
      showPlayerStage();
    }

    document.body.classList.toggle("events-v5-theater", next);
    updateSideControls();
  }

  function toggleNavFromControls() {
    const current = navMode();

    if (current === "hidden") {
      const preferred = elements.prefCompactNav.checked ? "rail" : "expanded";
      setNavMode(preferred, true);
    } else {
      setNavMode("hidden", true);
    }

    updateSideControls();
  }

  function openPrefs() {
    elements.prefArtwork.checked = state.eventPrefs.artwork;
    elements.prefCompact.checked = state.eventPrefs.compact;
    elements.prefSoon.checked = state.eventPrefs.soonFirst;
    elements.prefChat.checked = !document.body.classList.contains("chat-collapsed");
    elements.prefCompactNav.checked = navMode() === "rail";
    elements.prefMotion.checked = document.documentElement.classList.contains("ec-events-reduced-motion");
    setModal(elements.prefsModal, true);
  }

  function closeSupportDrawer() {
    if (!elements.supportDrawer) return;

    elements.supportDrawer.hidden = true;
    elements.supportDrawer.setAttribute("aria-hidden", "true");

    if (elements.supportFrame) {
      elements.supportFrame.hidden = true;
      elements.supportFrame.src = "about:blank";
    }

    if (elements.statusDrawerContent) {
      elements.statusDrawerContent.hidden = true;
      elements.statusDrawerContent.innerHTML = "";
    }
  }

  function statusCardMarkup(name, detail, state = "good", value = "") {
    return `
      <article class="ec-events-v2-status-card is-${escapeAttr(state)}">
        <span class="ec-events-v2-status-light" aria-hidden="true"></span>
        <span>
          <strong>${escapeHtml(name)}</strong>
          <small>${escapeHtml(detail)}</small>
        </span>
        <span>${escapeHtml(value)}</span>
      </article>`;
  }

  async function renderStatusDrawer() {
    elements.statusDrawerContent.hidden = false;
    elements.supportFrame.hidden = true;

    elements.statusDrawerContent.innerHTML = `
      <div class="ec-events-v2-loading">
        <span></span>
        <strong>Checking EastCoin</strong>
        <small>Refreshing event and score health.</small>
      </div>`;

    const started = performance.now();
    let discoveryState = "good";
    let discoveryMessage = "Event discovery responded normally.";
    let eventCount = state.today.length;

    try {
      const discovery = await API.getDiscovery({ forceMatches: true });
      const live = Array.isArray(discovery?.live?.data) ? discovery.live.data.length : 0;
      const today = Array.isArray(discovery?.today?.data) ? discovery.today.data.length : 0;
      eventCount = today;
      discoveryMessage = `${live} live · ${today} scheduled today`;
    } catch (error) {
      discoveryState = "bad";
      discoveryMessage = error?.message || "Event discovery did not respond.";
    }

    let ppvState = "good";
    let ppvMessage = "Additional event feed responded.";
    try {
      if (typeof API.getPpvStatus === "function") {
        await API.getPpvStatus();
      } else {
        ppvState = "warn";
        ppvMessage = "Additional event status check is not exposed.";
      }
    } catch (error) {
      ppvState = "warn";
      ppvMessage = error?.message || "Additional event feed did not respond.";
    }

    const chatState =
      document.body.classList.contains("chat-collapsed")
        ? "warn"
        : "good";

    const elapsed = Math.max(1, Math.round(performance.now() - started));

    elements.statusDrawerContent.innerHTML = `
      <div class="ec-events-v2-status-drawer-grid">
        ${statusCardMarkup(
          "Event discovery",
          discoveryMessage,
          discoveryState,
          `${elapsed}ms`
        )}
        ${statusCardMarkup(
          "Additional event feed",
          ppvMessage,
          ppvState,
          eventCount ? `${eventCount} today` : ""
        )}
        ${statusCardMarkup(
          "Twitch chat",
          document.body.classList.contains("chat-collapsed")
            ? "Chat is hidden by your current interface setting."
            : "The EastCoin Twitch chat panel is enabled.",
          chatState,
          document.body.classList.contains("chat-collapsed") ? "Hidden" : "Visible"
        )}
        ${statusCardMarkup(
          "Browser connection",
          navigator.onLine
            ? "Your browser currently reports an active network connection."
            : "Your browser reports that it is offline.",
          navigator.onLine ? "good" : "bad",
          navigator.onLine ? "Online" : "Offline"
        )}
      </div>
      <p class="ec-events-v2-status-note">
        This drawer checks EastCoin's event discovery, additional event feed,
        chat visibility, and the browser connection without affecting playback.
      </p>`;
  }

  function openSupportDrawer(view) {
    if (!elements.supportDrawer) return;

    elements.supportDrawer.hidden = false;
    elements.supportDrawer.setAttribute("aria-hidden", "false");

    if (view === "emotes") {
      elements.supportKicker.textContent = "EastCoin support";
      elements.supportTitle.textContent = "Emote Help";
      elements.statusDrawerContent.hidden = true;
      elements.supportFrame.hidden = false;
      elements.supportFrame.src = "emote-help.html?shell=1";
      return;
    }

    elements.supportKicker.textContent = "EastCoin diagnostics";
    elements.supportTitle.textContent = "Status";
    elements.supportFrame.hidden = true;
    elements.supportFrame.src = "about:blank";
    renderStatusDrawer();
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
  elements.omniInput.value = pageUrl.searchParams.get("q") || "";
  updateOmniMode();
  setControlsOpen(false);
  updateSideControls();

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

  elements.backVideo?.addEventListener("click", () => {
    showPlayerStage();
  });

  elements.controlsToggle?.addEventListener("click", () => {
    setControlsOpen(!controlsOpen());
  });
  elements.controlsClose?.addEventListener("click", () => {
    setControlsOpen(false);
  });
  elements.theaterControl?.addEventListener("click", () => {
    setTheaterMode(!state.theater);
    setControlsOpen(false);
  });
  elements.chatControl?.addEventListener("click", () => {
    setChatVisible(
      document.body.classList.contains("chat-collapsed"),
      true
    );
    setControlsOpen(false);
  });
  elements.navControl?.addEventListener("click", () => {
    toggleNavFromControls();
    setControlsOpen(false);
  });
  elements.gameControl?.addEventListener("click", () => {
    openGameOverlay();
    setControlsOpen(false);
  });
  elements.settingsControl?.addEventListener("click", () => {
    openPrefs();
    setControlsOpen(false);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!controlsOpen()) return;
    if (
      elements.controlsDrawer.contains(event.target) ||
      elements.controlsToggle.contains(event.target)
    ) {
      return;
    }
    setControlsOpen(false);
  }, true);

  elements.playerFrame?.addEventListener("load", () => {
    if (!state.playerMounted) return;
    revealPlayerWhenReady(state.playerRequestToken);
  });

  elements.emoteHelpButton?.addEventListener("click", () => {
    openSupportDrawer("emotes");
    setMobileMenu(false);
  });
  elements.statusButton?.addEventListener("click", () => {
    openSupportDrawer("status");
    setMobileMenu(false);
  });
  elements.supportClose?.addEventListener("click", closeSupportDrawer);
  elements.supportScrim?.addEventListener("click", closeSupportDrawer);

  document.querySelectorAll("[data-events-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      showEventsHome();
      state.scope = button.dataset.eventsScope;
      if (state.scope === "live") state.mode = "today";
      state.sport = "all";
      render();
      setMobileMenu(false);
    });
  });

  document.querySelectorAll("[data-events-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      showEventsHome();
      state.mode = button.dataset.eventsMode;
      if (state.mode === "tomorrow" && state.scope === "live") state.scope = "all";
      state.sport = "all";
      render();
    });
  });

  elements.categories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-events-sport]");
    if (!button) return;
    showEventsHome();
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

  elements.mvPromptClose?.addEventListener("click", () => {
    setModal(elements.mvPromptModal, false);
  });

  elements.mvPromptKeep?.addEventListener("click", () => {
    setModal(elements.mvPromptModal, false);
    toast("MultiView queue kept. Add another event anytime.");
  });

  elements.mvPromptOpen?.addEventListener("click", () => {
    if (embedded) {
      window.parent.postMessage({ type: "eastcoin:open-multiview" }, window.location.origin);
      return;
    }
    window.location.href = new URL("multiview.html", window.location.href).href;
  });

  elements.mvPromptModal?.addEventListener("click", (event) => {
    if (event.target === elements.mvPromptModal) {
      setModal(elements.mvPromptModal, false);
    }
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

  window.addEventListener("message", (event) => {
    if (!embedded || event.origin !== window.location.origin || event.source !== window.parent) return;
    const message = event.data || {};
    if (message.type !== "eastcoin:event-prefs-updated") return;
    state.eventPrefs = {
      artwork: message.prefs?.artwork !== false,
      compact: Boolean(message.prefs?.compact),
      soonFirst: message.prefs?.soonFirst !== false
    };
    writeJson(STORAGE.eventPrefs, state.eventPrefs);
    elements.prefArtwork.checked = state.eventPrefs.artwork;
    elements.prefCompact.checked = state.eventPrefs.compact;
    elements.prefSoon.checked = state.eventPrefs.soonFirst;
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (controlsOpen()) {
      setControlsOpen(false);
      return;
    }

    if (state.theater) {
      setTheaterMode(false);
      return;
    }

    if (elements.supportDrawer && !elements.supportDrawer.hidden) {
      closeSupportDrawer();
      return;
    }
    if (elements.mvPromptModal && !elements.mvPromptModal.hidden) {
      setModal(elements.mvPromptModal, false);
      return;
    }
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


  window.addEventListener("pagehide", () => {
    window.clearInterval(countdownTimer);
    clearPlayerRevealTimers();
  }, { once: true });

  loadEvents(false);
})();

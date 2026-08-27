(() => {
  "use strict";

  const V2 = window.ECV2 = window.ECV2 || {};

  V2.$ = (selector, root = document) => root.querySelector(selector);
  V2.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  V2.API = () => window.EastcoinStreamedAPI;

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  V2.state = {
    events: [],
    live: new Set(),
    sport: "all",
    date: "today",
    status: "all",
    search: "",
    sort: "recommended",
    featured: null,
    active: null,
    streams: [],
    activeStreamIndex: 0,
    favorites: new Set(read("eastcoinV2Favorites", [])),
    recent: read("eastcoinV2Recent", [])
  };

  const $ = V2.$;

  V2.els = {
    status: $("#status"),
    statusTitle: $("#statusTitle"),
    statusMeta: $("#statusMeta"),
    refresh: $("#refresh"),
    featured: $("#featured"),
    featureOpen: $("#featureOpen"),
    upnext: $("#upnext"),
    grid: $("#grid"),
    empty: $("#empty"),
    eventCount: $("#eventCount"),
    cacheMeta: $("#cacheMeta"),
    search: $("#search"),
    dates: $("#dates"),
    liveCount: $("#liveCount"),
    sort: $("#sort"),
    chat: $("#chat"),
    player: $("#player"),
    frame: $("#frame"),
    playerLoading: $("#playerLoading"),
    loaderTitle: $("#loaderTitle"),
    loaderMeta: $("#loaderMeta"),
    playerTitle: $("#playerTitle"),
    playerMeta: $("#playerMeta"),
    playerKicker: $("#playerKicker"),
    sideTitle: $("#sideTitle"),
    sideMeta: $("#sideMeta"),
    streams: $("#streams"),
    saveActive: $("#saveActive"),
    custom: $("#custom"),
    customUrl: $("#customUrl"),
    toast: $("#toast"),
    recent: $("#recent"),
    picks: $("#picks"),
    sicko: $("#sicko"),
    sickoTitle: $("#sickoTitle"),
    sickoMeta: $("#sickoMeta"),
    sickoSide: $("#sickoSide"),
    sickoOdds: $("#sickoOdds"),
    sickoPrice: $("#sickoPrice"),
    profile: $("#profile"),
    avatar: $("#avatar"),
    profileName: $("#profileName"),
    walletLabel: $("#walletLabel"),
    workspace: $("#workspace"),
    workspaceFrame: $("#workspaceFrame"),
    workspaceTitle: $("#workspaceTitle"),
    workspaceHome: $("#workspaceHome"),
    sportMoreBtn: $("#sportMoreBtn"),
    sportMoreMenu: $("#sportMoreMenu")
  };

  let toastTimer = 0;

  function toast(message) {
    clearTimeout(toastTimer);
    V2.els.toast.textContent = String(message || "");
    V2.els.toast.classList.add("show");
    toastTimer = setTimeout(() => V2.els.toast.classList.remove("show"), 2400);
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function id(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      `${match?.category || "event"}:${match?.title || ""}:${match?.date || ""}`
    );
  }

  function ts(value) {
    let numeric = Number(value);

    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function familyFromText(value) {
    const text = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");

    if (/american football|nfl|ncaaf|college football|cfl/.test(text)) return "american-football";
    if (/basketball|nba|wnba|ncaab/.test(text)) return "basketball";
    if (text.trim() === "football" || /soccer|premier league|epl|uefa|fifa|mls/.test(text)) return "soccer";
    if (/ufc|mma|boxing|combat|fight/.test(text)) return "combat";
    if (/baseball|mlb/.test(text)) return "baseball";
    if (/hockey|nhl/.test(text)) return "hockey";
    if (/tennis|atp|wta/.test(text)) return "tennis";
    if (/wrestling|wwe|aew/.test(text)) return "wrestling";
    if (/formula|nascar|motorsport|racing/.test(text)) return "motorsport";
    if (/golf|pga/.test(text)) return "golf";
    return "other";
  }

  function family(match) {
    for (const value of [
      match?.category,
      match?.sport,
      match?.league,
      match?._eastcoinProviders?.ppv?.category,
      match?.title
    ]) {
      const result = familyFromText(value);
      if (result !== "other") return result;
    }

    return "other";
  }

  function sportMeta(name) {
    return ({
      "american-football": ["🏈", "Football"],
      basketball: ["🏀", "Basketball"],
      baseball: ["⚾", "Baseball"],
      hockey: ["🏒", "Hockey"],
      combat: ["🥊", "UFC / Combat"],
      soccer: ["⚽", "Soccer"],
      tennis: ["🎾", "Tennis"],
      wrestling: ["🤼", "Wrestling"],
      motorsport: ["🏎", "Motorsport"],
      golf: ["⛳", "Golf"],
      other: ["•", "Other"]
    })[name] || ["•", "Other"];
  }

  function live(match) {
    return Boolean(match?._eastcoinLive) || V2.state.live.has(id(match));
  }

  function provider(match) {
    const providers = [];

    if (match?._eastcoinProviders?.streamed) providers.push("Streamed");
    if (match?._eastcoinProviders?.ppv) providers.push("PPV");

    return providers.length ? providers.join(" + ") : "EastCoin";
  }

  function network(match) {
    for (const value of [
      match?.network,
      match?.channel,
      match?.broadcast,
      match?.broadcaster,
      match?.station,
      match?.tv,
      match?.network_name,
      match?.channel_name,
      match?._eastcoinProviders?.ppv?.network,
      match?._eastcoinProviders?.ppv?.channel
    ]) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }

    return provider(match);
  }

  function viewerCount(match) {
    for (const value of [
      match?.viewers,
      match?.viewerCount,
      match?.viewer_count,
      match?.watching,
      match?.watchers,
      match?.audience,
      match?._eastcoinProviders?.ppv?.viewers,
      match?._eastcoinProviders?.streamed?.viewers
    ]) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) return numeric;
    }

    return null;
  }

  function viewerText(match) {
    const count = viewerCount(match);

    if (count == null) return "Viewers —";

    return `${new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(count)} viewer${count === 1 ? "" : "s"}`;
  }

  function sources(match) {
    return Array.isArray(match?.sources) ? match.sources.length : 0;
  }

  function dayKey(match) {
    const eventTime = ts(match?.date);
    if (!eventTime) return "unknown";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const eventDate = new Date(eventTime);
    const eventDay = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate()
    ).getTime();

    const difference = Math.round((eventDay - today) / 86400000);

    if (difference === 0) return "today";
    if (difference > 0 && difference < 5) return `day${difference}`;
    if (difference >= 0 && difference <= 6) return "week";
    return difference < 0 ? "past" : "future";
  }

  function time(match) {
    if (live(match)) return "LIVE";

    const value = ts(match?.date);

    return value
      ? new Date(value).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit"
        })
      : "TBD";
  }

  function datetime(match) {
    const value = ts(match?.date);

    return value
      ? new Date(value).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        })
      : live(match)
        ? "Live now"
        : "Schedule TBD";
  }

  function badge(team) {
    try {
      return team?.badge ? V2.API().badgeUrl(team.badge) : "";
    } catch {
      return "";
    }
  }

  function poster(match) {
    try {
      return (
        V2.API().posterUrl?.(match?.poster || "") ||
        V2.API().matchupPosterUrl?.(match) ||
        ""
      );
    } catch {
      return "";
    }
  }

  function initials(value) {
    return String(value || "EC")
      .replace(/[^a-z0-9 ]/gi, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "EC";
  }

  function logo(team, small = false) {
    const url = badge(team);
    const className = small ? "mini" : "team";

    return `<span class="${className}">${
      url
        ? `<img src="${esc(url)}" alt="">`
        : esc(initials(team?.name))
    }</span>`;
  }

  function american(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? numeric > 0
        ? `+${numeric}`
        : String(numeric)
      : "—";
  }

  function cents(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}¢` : "—";
  }

  Object.assign(V2, {
    read,
    write,
    toast,
    esc,
    id,
    ts,
    family,
    sportMeta,
    live,
    provider,
    network,
    viewerCount,
    viewerText,
    sources,
    dayKey,
    time,
    datetime,
    badge,
    poster,
    initials,
    logo,
    american,
    cents
  });
})();

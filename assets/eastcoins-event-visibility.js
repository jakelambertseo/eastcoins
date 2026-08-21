(() => {
  "use strict";

  /*
    EastCoin event visibility + DLStreams provider bridge.

    Production responsibilities:
      - keep the main EastCoin sports as normal card sections;
      - keep secondary sports out of the default All/Live/Trending views;
      - expose secondary sports through a collapsible More Sports menu;
      - merge the proven no-key DLStreams schedule into Events/MultiView;
      - expose DLStreams' public channel catalog as a separate Live TV category;
      - keep Live TV immediately above Other Events;
      - preserve the existing EastcoinStreamedAPI contract.

    Basketball remains a primary card category. Soccer and tennis are secondary
    browse-on-demand categories. Direct/shared event links and MultiView resolution
    remain available because provider data is filtered only inside events.html.
  */

  const PRIMARY_FAMILIES = new Set([
    "american-football",
    "combat",
    "basketball",
    "baseball",
    "hockey",
    "wrestling",
    "motorsport",
    "golf"
  ]);

  const SECONDARY_FAMILIES = new Set([
    "soccer",
    "tennis"
  ]);

  const SECONDARY_META = Object.freeze({
    soccer: { label: "Soccer", icon: "⚽" },
    tennis: { label: "Tennis", icon: "🎾" }
  });

  const DL_EVENT_FAMILIES = new Set([
    ...PRIMARY_FAMILIES,
    ...SECONDARY_FAMILIES
  ]);

  const DL_BASE =
    "https://eastcoin-dlstreams-prototype.jake-7f5.workers.dev";
  const DL_CACHE_TTL = 90_000;
  const DL_CACHE_KEY = "eastcoinDlstreamsProviderCacheV1";
  const LIVE_TV_PREFIX = "dl-tv:";
  const DL_EVENT_PREFIX = "dl-event:";
  const isEventsDocument = /(?:^|\/)events\.html$/i.test(
    window.location.pathname
  );

  const initialEventParameters = isEventsDocument
    ? new URLSearchParams(window.location.search)
    : null;
  const requestedSport = String(
    initialEventParameters?.get("sport") || ""
  ).toLowerCase();
  const selectedSecondaryFamily = SECONDARY_FAMILIES.has(requestedSport)
    ? requestedSport
    : "";

  let dlMemoryCache = null;
  let dlInFlight = null;
  let liveTvViewRequested = false;
  let liveTvArrangeQueued = false;
  let lastLiveTvCount = 0;
  let lastOtherCount = 0;

  /* ------------------------------------------------------------
     Core normalization / visibility
     ------------------------------------------------------------ */

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function normalizedWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function categoryFamily(value) {
    const text = normalizedWords(value);
    if (!text) return "";

    if (
      text === "american football" ||
      text.includes("american football") ||
      text.includes("nfl") ||
      text.includes("ncaaf") ||
      text.includes("college football") ||
      text.includes("high school football") ||
      text.includes("cfl")
    ) {
      return "american-football";
    }

    if (
      text.includes("basketball") ||
      text.includes("nba") ||
      text.includes("wnba") ||
      text.includes("ncaab") ||
      text.includes("college hoops")
    ) {
      return "basketball";
    }

    if (
      text === "football" ||
      text.includes("soccer") ||
      text.includes("premier league") ||
      text.includes("epl") ||
      text.includes("uefa") ||
      text.includes("fifa") ||
      text.includes("champions league") ||
      text.includes("la liga") ||
      text.includes("mls")
    ) {
      return "soccer";
    }

    if (
      text.includes("combat") ||
      text.includes("ufc") ||
      text.includes("mma") ||
      text.includes("boxing") ||
      text.includes("fight")
    ) {
      return "combat";
    }

    if (text.includes("baseball") || text.includes("mlb")) {
      return "baseball";
    }

    if (text.includes("hockey") || text.includes("nhl")) {
      return "hockey";
    }

    if (
      text.includes("wrestling") ||
      text.includes("wwe") ||
      text.includes("aew")
    ) {
      return "wrestling";
    }

    if (
      text.includes("motorsport") ||
      text.includes("formula") ||
      text.includes("nascar") ||
      text.includes("racing")
    ) {
      return "motorsport";
    }

    if (text.includes("tennis") || text.includes("atp") || text.includes("wta")) {
      return "tennis";
    }

    if (text.includes("golf") || text.includes("pga")) {
      return "golf";
    }

    if (
      text.includes("live tv") ||
      text.includes("24 7 channel") ||
      text.includes("24 7 live")
    ) {
      return "live-tv";
    }

    return text;
  }

  function itemFamilies(item) {
    if (!item || typeof item !== "object") return [];

    return [
      item.category,
      item.sport,
      item.league,
      item.category_name,
      item.categoryName,
      item.id,
      item.name,
      item?._eastcoinProviders?.ppv?.category,
      item?._eastcoinProviders?.dlstreams?.sport
    ]
      .map(categoryFamily)
      .filter(Boolean);
  }

  function primaryFamily(item) {
    return itemFamilies(item)[0] || "other";
  }

  function isHiddenItem(item) {
    /*
      Only the Events directory suppresses secondary sports by default.
      MultiView and other consumers receive the full provider catalog so a
      secondary event added by a user can still resolve and play normally.
    */
    if (!isEventsDocument) return false;

    const family = primaryFamily(item);
    return (
      SECONDARY_FAMILIES.has(family) &&
      family !== selectedSecondaryFamily
    );
  }

  function filterResult(result) {
    if (
      !result ||
      typeof result !== "object" ||
      !Array.isArray(result.data)
    ) {
      return result;
    }

    return {
      ...result,
      data: result.data.filter((item) => !isHiddenItem(item))
    };
  }

  function eventId(item) {
    return String(
      item?.id ||
      item?.matchId ||
      item?.slug ||
      ""
    );
  }

  function eventTimestamp(value) {
    let n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n < 1_000_000_000_000) n *= 1000;
    return n;
  }

  function cleanTitle(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/\bversus\b/g, " vs ")
      .replace(/\bvs\.?\b/g, " vs ")
      .replace(/\bv\.?\b/g, " vs ")
      .replace(/\s+@\s+/g, " at ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleTokens(value) {
    return new Set(
      cleanTitle(value)
        .split(" ")
        .filter((token) => token.length > 1)
    );
  }

  function titleSimilarity(a, b) {
    const left = titleTokens(a);
    const right = titleTokens(b);
    if (!left.size || !right.size) return 0;

    let overlap = 0;
    left.forEach((token) => {
      if (right.has(token)) overlap += 1;
    });

    return overlap / new Set([...left, ...right]).size;
  }

  function uniqueSources(sources) {
    const seen = new Set();
    const output = [];

    (Array.isArray(sources) ? sources : []).forEach((source) => {
      const key = [
        String(source?.source || "").toLowerCase(),
        String(source?.id || ""),
        String(source?.embedUrl || source?.embed || "")
      ].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      output.push({ ...source });
    });

    return output;
  }

  /* ------------------------------------------------------------
     DLStreams Worker client
     ------------------------------------------------------------ */

  function readDlCache() {
    if (dlMemoryCache) return dlMemoryCache;

    try {
      const cached = safeParse(localStorage.getItem(DL_CACHE_KEY));
      if (
        cached &&
        Array.isArray(cached.schedule) &&
        Array.isArray(cached.channels) &&
        Date.now() - Number(cached.savedAt || 0) < DL_CACHE_TTL
      ) {
        dlMemoryCache = cached;
        return cached;
      }
    } catch {}

    return null;
  }

  function writeDlCache(value) {
    dlMemoryCache = value;
    try {
      localStorage.setItem(DL_CACHE_KEY, JSON.stringify(value));
    } catch {}
  }

  async function dlJson(path) {
    /*
      DLStreams is an additive provider. A slow upstream page must never block
      EastCoin's Streamed/PPV event directory from rendering.

      The provider bridge already uses Promise.allSettled(), so aborting a slow
      DLStreams request lets the normal event feed continue while preserving any
      schedule/channel result that did arrive in time.
    */
    const controller = new AbortController();
    const timeoutMs = path.startsWith("/channels") ? 2500 : 3500;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${DL_BASE}${path}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`DLStreams Worker returned ${response.status}.`);
      }

      const payload = await response.json();
      if (payload?.ok !== true) {
        throw new Error(
          payload?.error || "DLStreams Worker returned an unsuccessful response."
        );
      }

      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          path.startsWith("/channels")
            ? "DLStreams Live TV request timed out."
            : "DLStreams schedule request timed out."
        );
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function getDlData(force = false) {
    const cached = readDlCache();
    if (!force && cached) return cached;
    if (dlInFlight) return dlInFlight;

    dlInFlight = (async () => {
      const suffix = force ? "?force=1" : "";
      const [scheduleResult, channelResult] = await Promise.allSettled([
        dlJson(`/schedule${suffix}`),
        dlJson(`/channels${suffix}`)
      ]);

      const schedulePayload =
        scheduleResult.status === "fulfilled"
          ? scheduleResult.value
          : null;
      const channelPayload =
        channelResult.status === "fulfilled"
          ? channelResult.value
          : null;

      /*
        During a Worker rollout, /channels may briefly be unavailable while
        /schedule is already healthy. Derive a useful channel list from the
        schedule so EastCoin never loses the sports feed just because the TV
        endpoint has not propagated yet.
      */
      const fallbackChannels = [];
      const channelMap = new Map();

      (Array.isArray(schedulePayload?.events)
        ? schedulePayload.events
        : []
      ).forEach((event) => {
        (Array.isArray(event?.channels) ? event.channels : []).forEach(
          (channel) => {
            const id = String(channel?.id || "").trim();
            if (!id || channelMap.has(id)) return;
            const item = normalizeDlChannel(channel);
            channelMap.set(id, item);
            fallbackChannels.push(item);
          }
        );
      });

      const channels = Array.isArray(channelPayload?.channels)
        ? channelPayload.channels.map(normalizeDlChannel).filter(Boolean)
        : fallbackChannels;

      const value = {
        schedule: Array.isArray(schedulePayload?.events)
          ? schedulePayload.events
          : [],
        channels,
        savedAt: Date.now(),
        stale:
          scheduleResult.status !== "fulfilled" ||
          channelResult.status !== "fulfilled",
        scheduleError:
          scheduleResult.status === "rejected"
            ? String(scheduleResult.reason?.message || scheduleResult.reason)
            : "",
        channelError:
          channelResult.status === "rejected"
            ? String(channelResult.reason?.message || channelResult.reason)
            : ""
      };

      if (value.schedule.length || value.channels.length) {
        writeDlCache(value);
        return value;
      }

      if (cached) {
        return { ...cached, stale: true };
      }

      return value;
    })().finally(() => {
      dlInFlight = null;
    });

    return dlInFlight;
  }

  function normalizeDlChannel(channel) {
    if (!channel || typeof channel !== "object") return null;

    const id = String(channel.id || channel.channel_id || "").trim();
    if (!id) return null;

    const name = String(
      channel.name ||
      channel.channel_name ||
      `Channel ${id}`
    )
      .replace(/\s+/g, " ")
      .trim();

    const embedUrl = String(
      channel.embedUrl ||
      `https://dlstreams.st/stream/stream-${encodeURIComponent(id)}.php`
    );

    return {
      id,
      name,
      watchUrl: String(
        channel.watchUrl ||
        `https://dlstreams.st/watch.php?id=${encodeURIComponent(id)}`
      ),
      embedUrl,
      embedUrls: Array.isArray(channel.embedUrls)
        ? channel.embedUrls.map(String)
        : [embedUrl]
    };
  }

  function dlEventIsLive(event) {
    const start = eventTimestamp(event?.timestamp || event?.date);
    if (!start) return false;
    const now = Date.now();
    return start <= now && now - start <= 5 * 60 * 60 * 1000;
  }

  function dlScheduleMatch(event) {
    if (!event || typeof event !== "object") return null;

    const family = categoryFamily(
      event.sport || event.category || event.categoryName || ""
    );

    /*
      Keep DLStreams limited to EastCoin's known sports taxonomy. Primary
      sports remain visible in the normal event directory. Secondary sports
      are retained here but hidden from default Events views until the user
      opens them from More Sports. Live TV is handled separately below.
    */
    if (!DL_EVENT_FAMILIES.has(family)) return null;

    const channels = (Array.isArray(event.channels) ? event.channels : [])
      .map(normalizeDlChannel)
      .filter(Boolean);

    if (!channels.length) return null;

    const id = String(event.id || "")
      .replace(/^dlstreams:/i, "")
      .trim();
    const eastcoinId = `${DL_EVENT_PREFIX}${id || cleanTitle(event.title)}`;
    const date = eventTimestamp(event.timestamp || event.date);

    return {
      id: eastcoinId,
      title: String(event.title || "DLStreams event").trim(),
      category: family,
      sport: family,
      date,
      poster: "",
      popular: false,
      teams: null,
      sources: channels.map((channel) => ({
        source: "dlstreams",
        id: channel.id,
        name: channel.name,
        embedUrl: channel.embedUrl
      })),
      _eastcoinLive: dlEventIsLive(event),
      _eastcoinProviders: {
        streamed: false,
        dlstreams: {
          eventId: eastcoinId,
          workerEventId: String(event.id || ""),
          sport: family,
          liveTv: false,
          channels
        }
      }
    };
  }

  function dlLiveTvMatch(channel) {
    const item = normalizeDlChannel(channel);
    if (!item) return null;

    return {
      id: `${LIVE_TV_PREFIX}${item.id}`,
      title: item.name,
      /*
        events-home currently treats 24/7 channels as Other Events. The UI
        bridge below splits only DLStreams channel cards into Live TV, which
        keeps existing Other Events semantics untouched.
      */
      category: "24/7 Channels",
      sport: "other",
      date: Date.now(),
      poster: "",
      popular: false,
      teams: null,
      sources: [
        {
          source: "dlstreams",
          id: item.id,
          name: item.name,
          embedUrl: item.embedUrl
        }
      ],
      _eastcoinLive: true,
      _eastcoinProviders: {
        streamed: false,
        dlstreams: {
          liveTv: true,
          sport: "live-tv",
          channelId: item.id,
          channelName: item.name,
          channels: [item]
        }
      }
    };
  }

  function matchScore(baseMatch, dlMatch) {
    if (!baseMatch || !dlMatch) return 0;

    const baseFamily = primaryFamily(baseMatch);
    const dlFamily = primaryFamily(dlMatch);
    if (baseFamily !== dlFamily) return 0;

    const leftTitle = cleanTitle(baseMatch.title);
    const rightTitle = cleanTitle(dlMatch.title);
    const exact = Boolean(leftTitle && leftTitle === rightTitle);
    const similarity = titleSimilarity(baseMatch.title, dlMatch.title);

    const leftTime = eventTimestamp(baseMatch.date);
    const rightTime = eventTimestamp(dlMatch.date);
    const timeDiff =
      leftTime && rightTime
        ? Math.abs(leftTime - rightTime)
        : Infinity;

    let score = 20; // category family
    if (exact) score += 70;
    else if (similarity >= 0.85) score += 58;
    else if (similarity >= 0.72) score += 40;
    else return 0;

    if (timeDiff <= 30 * 60 * 1000) score += 25;
    else if (timeDiff <= 90 * 60 * 1000) score += 12;
    else if (leftTime && rightTime) score -= 25;

    return score;
  }

  function mergeDlSchedule(baseMatches, dlMatches) {
    const output = (Array.isArray(baseMatches) ? baseMatches : []).map(
      (match) => ({
        ...match,
        sources: uniqueSources(match?.sources),
        _eastcoinProviders: {
          ...(match?._eastcoinProviders || {})
        }
      })
    );

    dlMatches.forEach((dlMatch) => {
      let bestIndex = -1;
      let bestScore = 0;

      output.forEach((candidate, index) => {
        if (String(candidate?.id || "").startsWith(LIVE_TV_PREFIX)) return;
        const score = matchScore(candidate, dlMatch);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      if (bestIndex !== -1 && bestScore >= 80) {
        const existing = output[bestIndex];
        output[bestIndex] = {
          ...existing,
          sources: uniqueSources([
            ...(existing.sources || []),
            ...(dlMatch.sources || [])
          ]),
          _eastcoinLive:
            Boolean(existing._eastcoinLive) ||
            Boolean(dlMatch._eastcoinLive),
          _eastcoinProviders: {
            ...(existing._eastcoinProviders || {}),
            dlstreams: dlMatch._eastcoinProviders?.dlstreams || null
          }
        };
      } else {
        output.push(dlMatch);
      }
    });

    return output;
  }

  function appendLiveTv(matches, liveTvMatches) {
    const output = [...(Array.isArray(matches) ? matches : [])];
    const ids = new Set(output.map(eventId));

    liveTvMatches.forEach((match) => {
      if (!match || ids.has(eventId(match))) return;
      ids.add(eventId(match));
      output.push(match);
    });

    return output;
  }

  function resultWithData(result, data, savedAt = Date.now(), stale = false) {
    return {
      ...(result || {}),
      data,
      savedAt: Math.max(
        Number(result?.savedAt || 0),
        Number(savedAt || 0)
      ),
      stale: Boolean(result?.stale || stale)
    };
  }

  async function buildDlMatches(force = false) {
    const data = await getDlData(force);

    const schedule = (Array.isArray(data.schedule) ? data.schedule : [])
      .map(dlScheduleMatch)
      .filter(Boolean);

    const liveTv = (Array.isArray(data.channels) ? data.channels : [])
      .map(dlLiveTvMatch)
      .filter(Boolean);

    return {
      schedule,
      liveTv,
      savedAt: Number(data.savedAt || Date.now()),
      stale: Boolean(data.stale)
    };
  }

  function dlStreamsForMatch(match) {
    return (Array.isArray(match?.sources) ? match.sources : [])
      .filter(
        (source) =>
          String(source?.source || "").toLowerCase() === "dlstreams"
      )
      .map((source, index) => {
        const id = String(source?.id || "");
        const embedUrl = String(
          source?.embedUrl ||
          `https://dlstreams.st/stream/stream-${encodeURIComponent(id)}.php`
        );

        return {
          source: "DLStreams",
          streamNo: index + 1,
          embedUrl,
          hd: false,
          language: String(source?.name || "DLStreams"),
          provider: "dlstreams",
          dlstreamsId: id,
          dlstreamsName: String(source?.name || "DLStreams")
        };
      });
  }

  /* ------------------------------------------------------------
     API wrapper: Streamed + PPV + DLStreams, then visibility filter
     ------------------------------------------------------------ */

  function installApiFilter() {
    const API = window.EastcoinStreamedAPI;
    if (!API || API.__eastcoinVisibilityWrapped) return;

    window.EastcoinStreamedAPI = Object.freeze({
      ...API,

      async getDiscovery(options = {}) {
        const force = Boolean(options?.forceMatches);
        const [discovery, dl] = await Promise.all([
          API.getDiscovery(options),
          buildDlMatches(force)
        ]);

        const baseLive = Array.isArray(discovery?.live?.data)
          ? discovery.live.data
          : [];
        const baseToday = Array.isArray(discovery?.today?.data)
          ? discovery.today.data
          : [];

        const dlLive = dl.schedule.filter((match) => match._eastcoinLive);
        const mergedLive = mergeDlSchedule(baseLive, dlLive);
        const mergedToday = appendLiveTv(
          mergeDlSchedule(baseToday, dl.schedule),
          dl.liveTv
        );

        const sportsData = Array.isArray(discovery?.sports?.data)
          ? discovery.sports.data
          : [];
        const sports = sportsData.some(
          (sport) =>
            categoryFamily(sport?.id || sport?.name || sport?.title) === "live-tv"
        )
          ? sportsData
          : [...sportsData, { id: "live-tv", name: "Live TV" }];

        return {
          ...discovery,
          live: filterResult(
            resultWithData(discovery?.live, mergedLive, dl.savedAt, dl.stale)
          ),
          today: filterResult(
            resultWithData(discovery?.today, mergedToday, dl.savedAt, dl.stale)
          ),
          sports: filterResult(
            resultWithData(discovery?.sports, sports, dl.savedAt, dl.stale)
          )
        };
      },

      async getLive(force = false) {
        const [result, dl] = await Promise.all([
          API.getLive(force),
          buildDlMatches(Boolean(force))
        ]);
        const base = Array.isArray(result?.data) ? result.data : [];
        const dlLive = dl.schedule.filter((match) => match._eastcoinLive);
        return filterResult(
          resultWithData(
            result,
            mergeDlSchedule(base, dlLive),
            dl.savedAt,
            dl.stale
          )
        );
      },

      async getToday(force = false) {
        const [result, dl] = await Promise.all([
          API.getToday(force),
          buildDlMatches(Boolean(force))
        ]);
        const base = Array.isArray(result?.data) ? result.data : [];
        return filterResult(
          resultWithData(
            result,
            appendLiveTv(
              mergeDlSchedule(base, dl.schedule),
              dl.liveTv
            ),
            dl.savedAt,
            dl.stale
          )
        );
      },

      async getSports(force = false) {
        const result = await API.getSports(force);
        const data = Array.isArray(result?.data) ? result.data : [];
        const hasLiveTv = data.some(
          (sport) =>
            categoryFamily(sport?.id || sport?.name || sport?.title) === "live-tv"
        );
        return filterResult(
          resultWithData(
            result,
            hasLiveTv
              ? data
              : [...data, { id: "live-tv", name: "Live TV" }]
          )
        );
      },

      async getAll(force = false) {
        const [result, dl] = await Promise.all([
          API.getAll(force),
          buildDlMatches(Boolean(force))
        ]);
        const base = Array.isArray(result?.data) ? result.data : [];
        return filterResult(
          resultWithData(
            result,
            appendLiveTv(
              mergeDlSchedule(base, dl.schedule),
              dl.liveTv
            ),
            dl.savedAt,
            dl.stale
          )
        );
      },

      async getStreams(match, force = false) {
        const dlStreams = dlStreamsForMatch(match);
        const baseSources = (Array.isArray(match?.sources) ? match.sources : [])
          .filter(
            (source) =>
              String(source?.source || "").toLowerCase() !== "dlstreams"
          );

        let baseStreams = [];
        let baseError = null;

        const canUseBase =
          baseSources.length > 0 ||
          Boolean(match?._eastcoinProviders?.streamed) ||
          Boolean(match?._eastcoinProviders?.ppv);

        if (canUseBase) {
          try {
            baseStreams = await API.getStreams(
              { ...match, sources: baseSources },
              force
            );
          } catch (error) {
            baseError = error;
          }
        }

        const combined = [];
        const seen = new Set();

        [...(Array.isArray(baseStreams) ? baseStreams : []), ...dlStreams]
          .forEach((stream) => {
            const key = String(
              stream?.embedUrl ||
              `${stream?.source || ""}:${stream?.streamNo || ""}`
            );
            if (!key || seen.has(key)) return;
            seen.add(key);
            combined.push(stream);
          });

        if (combined.length) return combined;
        if (baseError) throw baseError;
        return combined;
      },

      __eastcoinVisibilityWrapped: true,
      __eastcoinDlstreamsWrapped: true,
      DLSTREAMS_WORKER_BASE: DL_BASE
    });
  }

  /* ------------------------------------------------------------
     Live TV category UI
     ------------------------------------------------------------ */

  function translateInitialLiveTvView() {
    if (!isEventsDocument) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("sport") !== "live-tv") return;

    liveTvViewRequested = true;

    const url = new URL(window.location.href);
    url.searchParams.set("sport", "other");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function ensurePersistentLiveTvNavigation(root = document) {
    const other = root.querySelector?.(
      '[data-ec-events-sport="other"]'
    );
    if (!other || root.querySelector?.('[data-ec-events-sport="live-tv"]')) {
      return;
    }

    const clone = other.cloneNode(true);
    clone.dataset.ecEventsSport = "live-tv";
    clone.dataset.navTooltip = "Live TV";
    clone.setAttribute("data-ec-live-tv-nav", "true");

    const icon = clone.querySelector(".ec-events-v2-nav-icon");
    const strong = clone.querySelector("strong");
    const small = clone.querySelector("small");
    const count = clone.querySelector(".ec-events-v2-count");

    if (icon) icon.textContent = "📺";
    if (strong) strong.textContent = "Live TV";
    if (small) small.textContent = "24/7 channels";
    if (count) {
      count.dataset.ecCategoryCount = "live-tv";
      count.textContent = "0";
      count.hidden = true;
    }

    other.parentNode?.insertBefore(clone, other);
  }

  function ensureEventsLiveTvNavigation() {
    if (!isEventsDocument) return null;

    const nav = document.getElementById("eventsV2CategoryNav");
    if (!nav) return null;

    const other = nav.querySelector('[data-events-sport="other"]');
    if (!other) return null;

    let liveTv = nav.querySelector('[data-ec-live-tv-category="true"]');
    if (!liveTv) {
      liveTv = other.cloneNode(true);
      liveTv.dataset.eventsSport = "other";
      liveTv.dataset.ecLiveTvCategory = "true";
      liveTv.dataset.navTooltip = "Live TV";

      const icon = liveTv.querySelector(".ec-events-v2-nav-icon");
      const strong = liveTv.querySelector("strong");
      const small = liveTv.querySelector("small");
      if (icon) icon.textContent = "📺";
      if (strong) strong.textContent = "Live TV";
      if (small) small.textContent = "24/7 channels";

      other.parentNode?.insertBefore(liveTv, other);
    }

    return { liveTv, other };
  }

  function updateCategoryCount(button, count) {
    if (!button) return;
    const badge = button.querySelector(".ec-events-v2-count");
    if (!badge) return;
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  }

  function sectionTemplate(count) {
    const section = document.createElement("section");
    section.className = "ec-events-v2-section";
    section.dataset.sportSection = "live-tv";
    section.dataset.ecLiveTvSection = "true";
    section.innerHTML = `
      <header class="ec-events-v2-section-head">
        <div class="ec-events-v2-section-title">
          <span class="ec-events-v2-section-icon" aria-hidden="true">📺</span>
          <span>
            <strong>Live TV</strong>
            <small>24/7 sports & entertainment channels</small>
          </span>
        </div>
        <div class="ec-events-v2-section-counts">
          <span>Always on</span>
          <span data-ec-live-tv-total>${count} channel${count === 1 ? "" : "s"}</span>
        </div>
      </header>
      <div class="ec-events-v2-grid" data-ec-live-tv-grid></div>
    `;
    return section;
  }

  function decorateLiveTvCard(card) {
    card.dataset.ecLiveTvCard = "true";

    const footerStrong = card.querySelector(
      ".ec-events-v2-card-footer-meta strong"
    );
    if (footerStrong) footerStrong.textContent = "Live TV";

    const footerSmall = card.querySelector(
      ".ec-events-v2-card-footer-meta small"
    );
    if (footerSmall && /other events/i.test(footerSmall.textContent || "")) {
      footerSmall.textContent = "DLStreams · 24/7 channel";
    }
  }

  function organizeLiveTvSections() {
    liveTvArrangeQueued = false;
    if (!isEventsDocument) return;

    const directory = document.getElementById("eventsV2Directory");
    if (!directory) return;

    const otherSection = directory.querySelector(
      '[data-sport-section="other"]'
    );
    let liveSection = directory.querySelector(
      '[data-ec-live-tv-section="true"]'
    );

    if (!otherSection) {
      liveSection?.remove();
      return;
    }

    const otherGrid = otherSection.querySelector(".ec-events-v2-grid");
    if (!otherGrid) return;

    const liveCards = Array.from(
      otherGrid.querySelectorAll(
        `[data-event-card^="${LIVE_TV_PREFIX}"]`
      )
    );

    if (!liveCards.length) {
      /* Cards may already have been moved by a previous observer pass. */
      liveCards.push(
        ...Array.from(
          liveSection?.querySelectorAll(
            `[data-event-card^="${LIVE_TV_PREFIX}"]`
          ) || []
        )
      );
    }

    if (!liveCards.length) {
      liveSection?.remove();
      const navPair = ensureEventsLiveTvNavigation();
      if (navPair) updateCategoryCount(navPair.liveTv, 0);
      return;
    }

    if (!liveSection) {
      liveSection = sectionTemplate(liveCards.length);
      otherSection.parentNode?.insertBefore(liveSection, otherSection);
    }

    const liveGrid = liveSection.querySelector("[data-ec-live-tv-grid]");
    liveCards.forEach((card) => {
      decorateLiveTvCard(card);
      if (card.parentNode !== liveGrid) liveGrid.appendChild(card);
    });

    const liveCount = liveGrid.querySelectorAll(
      `[data-event-card^="${LIVE_TV_PREFIX}"]`
    ).length;
    const otherCount = otherGrid.querySelectorAll("[data-event-card]").length;

    const total = liveSection.querySelector("[data-ec-live-tv-total]");
    if (total) {
      total.textContent = `${liveCount} channel${liveCount === 1 ? "" : "s"}`;
    }

    const navPair = ensureEventsLiveTvNavigation();
    if (navPair) {
      updateCategoryCount(navPair.liveTv, liveCount);
      updateCategoryCount(navPair.other, otherCount);

      if (liveTvViewRequested) {
        navPair.other.classList.remove("is-active");
        navPair.liveTv.classList.add("is-active");
      } else {
        navPair.liveTv.classList.remove("is-active");
      }
    }

    /*
      If Events was opened specifically as sport=live-tv, events-home is
      internally rendering its existing `other` filter. Show only the split
      DLStreams channel section and relabel the toolbar.
    */
    if (liveTvViewRequested) {
      liveSection.hidden = false;
      otherSection.hidden = true;
      document.querySelectorAll(
        '#eventsV2Directory > [data-sport-section]:not([data-ec-live-tv-section="true"])'
      ).forEach((section) => {
        section.hidden = true;
      });
      const title = document.getElementById("eventsV2ViewTitle");
      if (title) title.textContent = "Live TV";
    } else {
      liveSection.hidden = false;
      /* events-home owns whether Other should be visible for current filters. */
      if (otherCount === 0) otherSection.hidden = true;
    }

    lastLiveTvCount = liveCount;
    lastOtherCount = otherCount;

    if (window.parent !== window) {
      try {
        window.parent.postMessage(
          {
            type: "eastcoin:live-tv-counts",
            liveTv: liveCount,
            other: otherCount
          },
          window.location.origin
        );
      } catch {}
    }
  }

  function queueLiveTvArrange() {
    if (!isEventsDocument || liveTvArrangeQueued) return;
    liveTvArrangeQueued = true;
    window.requestAnimationFrame(organizeLiveTvSections);
  }

  function updatePersistentSplitCounts(liveTv, other) {
    const liveBadges = document.querySelectorAll(
      '[data-ec-category-count="live-tv"]'
    );
    const otherBadges = document.querySelectorAll(
      '[data-ec-category-count="other"]'
    );

    liveBadges.forEach((badge) => {
      badge.textContent = String(liveTv);
      badge.hidden = Number(liveTv) <= 0;
    });

    otherBadges.forEach((badge) => {
      badge.textContent = String(other);
      badge.hidden = Number(other) <= 0;
    });
  }

  /* ------------------------------------------------------------
     DLStreams-only card playback
     ------------------------------------------------------------ */

  async function dlMatchById(id) {
    const dl = await buildDlMatches(false);
    return [...dl.schedule, ...dl.liveTv].find(
      (match) => eventId(match) === String(id || "")
    ) || null;
  }

  async function openDlOnlyMatch(id) {
    const match = await dlMatchById(id);
    const stream = dlStreamsForMatch(match)[0];
    const watch = String(stream?.embedUrl || "");
    if (!watch) return false;

    if (window.parent !== window) {
      try {
        window.parent.postMessage(
          { type: "eastcoin:open-player", watch },
          window.location.origin
        );
        return true;
      } catch {}
    }

    const url = new URL("player.html", window.location.href);
    url.searchParams.set("watch", watch);
    window.location.href = url.href;
    return true;
  }

  function installDlCardOpenBridge() {
    if (!isEventsDocument) return;

    document.addEventListener(
      "click",
      (event) => {
        const card = event.target.closest?.("[data-event-card]");
        if (!card) return;

        const id = String(card.dataset.eventCard || "");
        if (
          !id.startsWith(DL_EVENT_PREFIX) &&
          !id.startsWith(LIVE_TV_PREFIX)
        ) {
          return;
        }

        /* Let the existing MultiView button save the event ID. Multiview.html
           also loads this provider bridge and can resolve DLStreams sources. */
        if (event.target.closest("[data-add-multiview]")) return;

        const watchButton = event.target.closest("[data-watch-event]");
        if (!watchButton && event.target.closest("button")) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        openDlOnlyMatch(id).catch(() => {});
      },
      true
    );
  }

  /* ------------------------------------------------------------
     More Sports navigation + lifecycle
     ------------------------------------------------------------ */

  function installMoreSportsStyles() {
    if (document.getElementById("eastcoinMoreSportsStyles")) return;

    const style = document.createElement("style");
    style.id = "eastcoinMoreSportsStyles";
    style.textContent = `
      .ec-more-sports-details {
        display: block;
        margin: 2px 0 4px;
      }

      .ec-more-sports-details > summary {
        list-style: none;
        cursor: pointer;
      }

      .ec-more-sports-details > summary::-webkit-details-marker {
        display: none;
      }

      .ec-more-sports-details .ec-more-sports-chevron {
        margin-left: auto;
        opacity: .72;
        transition: transform .16s ease;
      }

      .ec-more-sports-details[open] .ec-more-sports-chevron {
        transform: rotate(180deg);
      }

      .ec-more-sports-menu {
        display: grid;
        gap: 2px;
        margin: 2px 0 4px 16px;
        padding: 2px 0 2px 8px;
        border-left: 1px solid rgba(255,255,255,.09);
      }

      .ec-more-sports-menu .ec-events-v2-nav-item {
        margin: 0;
      }

      .sidebar-collapsed .ec-more-sports-menu {
        margin-left: 5px;
        padding-left: 0;
        border-left: 0;
      }

      .sidebar-collapsed .ec-more-sports-details > summary
        .ec-more-sports-chevron {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function configureSecondaryButton(button, family, persistent) {
    if (!button) return null;

    const meta = SECONDARY_META[family] || {
      label: family,
      icon: "•"
    };

    if (persistent) {
      button.dataset.ecEventsSport = family;
    } else {
      button.dataset.eventsSport = family;
    }

    button.dataset.ecSecondarySport = family;
    button.dataset.navTooltip = meta.label;
    button.hidden = false;
    button.removeAttribute("aria-hidden");

    const icon = button.querySelector(".ec-events-v2-nav-icon");
    const strong = button.querySelector("strong");
    const small = button.querySelector("small");
    const count = button.querySelector(".ec-events-v2-count");

    if (icon) icon.textContent = meta.icon;
    if (strong) strong.textContent = meta.label;
    if (small) {
      small.textContent =
        selectedSecondaryFamily === family
          ? "Browsing now"
          : "Browse on demand";
    }
    if (count && !String(count.textContent || "").trim()) {
      count.hidden = true;
    }

    return button;
  }

  function createMoreSportsDetails(persistent) {
    const details = document.createElement("details");
    details.className = "ec-more-sports-details";
    details.dataset.ecMoreSports = persistent ? "persistent" : "events";

    const summary = document.createElement("summary");
    summary.className = "ec-events-v2-nav-item";
    summary.dataset.navTooltip = "More Sports";
    summary.innerHTML = `
      <span class="ec-events-v2-nav-icon">＋</span>
      <span class="ec-events-v2-nav-copy">
        <strong>More Sports</strong>
        <small>Browse hidden categories</small>
      </span>
      <span class="ec-more-sports-chevron" aria-hidden="true">⌄</span>
    `;

    const menu = document.createElement("div");
    menu.className = "ec-more-sports-menu";
    menu.dataset.ecMoreSportsMenu = "true";

    details.append(summary, menu);
    return details;
  }

  function ensurePersistentMoreSportsNavigation(root = document) {
    const categoryButtons = Array.from(
      root.querySelectorAll?.("[data-ec-events-sport]") || []
    );
    if (!categoryButtons.length) return null;

    const other = root.querySelector?.(
      '[data-ec-events-sport="other"]'
    );
    if (!other) return null;

    const section = other.parentElement;
    if (!section) return null;

    let details = section.querySelector(
      ':scope > details[data-ec-more-sports="persistent"]'
    );

    if (!details) {
      details = createMoreSportsDetails(true);
      const liveTv = section.querySelector(
        ':scope > [data-ec-events-sport="live-tv"]'
      );
      section.insertBefore(details, liveTv || other);
    }

    const menu = details.querySelector("[data-ec-more-sports-menu]");

    SECONDARY_FAMILIES.forEach((family) => {
      let button = section.querySelector(
        `[data-ec-events-sport="${family}"]`
      );

      if (!button) {
        button = other.cloneNode(true);
        configureSecondaryButton(button, family, true);
      } else {
        configureSecondaryButton(button, family, true);
      }

      if (button.parentElement !== menu) {
        menu.appendChild(button);
      }
    });

    const activeSport = String(
      new URLSearchParams(window.location.search).get("sport") || ""
    ).toLowerCase();

    if (SECONDARY_FAMILIES.has(activeSport)) {
      details.open = true;
    }

    return details;
  }

  function ensureEventsMoreSportsNavigation() {
    if (!isEventsDocument) return null;

    const nav = document.getElementById("eventsV2CategoryNav");
    if (!nav) return null;

    const other = nav.querySelector('[data-events-sport="other"]');
    if (!other) return null;

    let details = nav.querySelector(
      ':scope > details[data-ec-more-sports="events"]'
    );

    if (!details) {
      details = createMoreSportsDetails(false);
      const liveTv = nav.querySelector(
        ':scope > [data-ec-live-tv-category="true"]'
      );
      nav.insertBefore(details, liveTv || other);
    }

    const menu = details.querySelector("[data-ec-more-sports-menu]");

    SECONDARY_FAMILIES.forEach((family) => {
      let button = Array.from(
        nav.querySelectorAll(`[data-events-sport="${family}"]`)
      ).find((candidate) => candidate !== details);

      if (!button) {
        button = other.cloneNode(true);
      }

      configureSecondaryButton(button, family, false);

      if (family === selectedSecondaryFamily) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }

      if (button.parentElement !== menu) {
        menu.appendChild(button);
      }
    });

    details.open = Boolean(selectedSecondaryFamily);
    return details;
  }

  function reloadEventsWith(parameters) {
    const url = new URL(window.location.href);

    Object.entries(parameters).forEach(([name, value]) => {
      if (value === null || value === undefined || value === "") {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(name, String(value));
      }
    });

    window.location.href = url.href;
  }

  function installSecondaryNavigationBridge() {
    if (!isEventsDocument) return;

    document.addEventListener(
      "click",
      (event) => {
        const secondary = event.target.closest?.(
          "[data-ec-secondary-sport]"
        );

        if (secondary) {
          const family = String(
            secondary.dataset.ecSecondarySport || ""
          ).toLowerCase();

          if (!SECONDARY_FAMILIES.has(family)) return;

          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: family,
            scope: "all",
            q: null
          });
          return;
        }

        /*
          A secondary Events page loads that one category on demand. If the
          user leaves it for All Events or a primary category, reload without
          the secondary opt-in so it does not leak back into the default view.
        */
        if (!selectedSecondaryFamily) return;

        const scopeButton = event.target.closest?.("[data-events-scope]");
        if (scopeButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: null,
            scope: scopeButton.dataset.eventsScope || "all"
          });
          return;
        }

        const liveTvButton = event.target.closest?.(
          '[data-ec-live-tv-category="true"]'
        );
        if (liveTvButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: "live-tv",
            scope: "all",
            q: null
          });
          return;
        }

        const categoryButton = event.target.closest?.("[data-events-sport]");
        if (categoryButton) {
          const family = String(
            categoryButton.dataset.eventsSport || ""
          ).toLowerCase();

          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: family || null,
            scope: "all",
            q: null
          });
        }
      },
      true
    );
  }

  function organizeNavigation(root = document) {
    installMoreSportsStyles();
    ensurePersistentMoreSportsNavigation(root);
    ensureEventsMoreSportsNavigation();
  }

  function finishUiSetup() {
    ensurePersistentLiveTvNavigation();
    ensureEventsLiveTvNavigation();
    organizeNavigation();
    queueLiveTvArrange();

    if (isEventsDocument) {
      document.addEventListener(
        "click",
        (event) => {
          const liveTvButton = event.target.closest?.(
            '[data-ec-live-tv-category="true"]'
          );
          const categoryButton = event.target.closest?.(
            "[data-events-sport]"
          );

          if (liveTvButton) {
            liveTvViewRequested = true;
          } else if (categoryButton) {
            liveTvViewRequested = false;
          }

          if (liveTvButton || categoryButton) {
            window.setTimeout(queueLiveTvArrange, 0);
          }
        },
        true
      );
    }

    const observer = new MutationObserver((mutations) => {
      let relevant = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          relevant = true;
          break;
        }
      }

      if (!relevant) return;

      ensurePersistentLiveTvNavigation();
      ensureEventsLiveTvNavigation();
      organizeNavigation();
      queueLiveTvArrange();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const message = event.data || {};

    if (message.type === "eastcoin:live-tv-counts") {
      lastLiveTvCount = Number(message.liveTv || 0);
      lastOtherCount = Number(message.other || 0);
      updatePersistentSplitCounts(lastLiveTvCount, lastOtherCount);
      return;
    }

    /* Persistent shell may write the combined Other count immediately before
       our split message. Re-apply the split on the next task if needed. */
    if (
      (message.type === "eastcoin:event-nav-state" ||
        message.type === "eastcoin:navigation-counts") &&
      (lastLiveTvCount || lastOtherCount)
    ) {
      window.setTimeout(
        () => updatePersistentSplitCounts(lastLiveTvCount, lastOtherCount),
        0
      );
    }
  });

  translateInitialLiveTvView();
  installApiFilter();
  installDlCardOpenBridge();
  installSecondaryNavigationBridge();

  window.EASTCOIN_EVENT_VISIBILITY = Object.freeze({
    primaryFamilies: Object.freeze(Array.from(PRIMARY_FAMILIES)),
    secondaryFamilies: Object.freeze(Array.from(SECONDARY_FAMILIES)),
    hiddenFamilies: Object.freeze(Array.from(SECONDARY_FAMILIES)),
    selectedSecondaryFamily,
    dlEventFamilies: Object.freeze(Array.from(DL_EVENT_FAMILIES)),
    dlstreamsWorker: DL_BASE,
    isHiddenItem
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishUiSetup, { once: true });
  } else {
    finishUiSetup();
  }
})();

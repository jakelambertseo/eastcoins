(() => {
  "use strict";

  const API_BASE = "https://streamed.pk/api";
  const CACHE_PREFIX = "eastcoinStreamedCacheV2:";
  const STREAM_CACHE_PREFIX = "eastcoinStreamedStreamsV1:";
  const TTL = {
    live: 90_000,
    today: 300_000,
    sports: 86_400_000,
    all: 300_000,
    streams: 300_000
  };
  const inFlight = new Map();

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function readStorage(storage, key) {
    try {
      return safeParse(storage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function cacheKey(name) {
    return `${CACHE_PREFIX}${name}`;
  }

  function readCache(name) {
    return readStorage(localStorage, cacheKey(name));
  }

  function writeCache(name, data) {
    writeStorage(localStorage, cacheKey(name), {
      data,
      savedAt: Date.now()
    });
  }

  function normalizeCollection(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    const candidates = [
      payload?.data,
      payload?.matches,
      payload?.sports,
      payload?.results,
      payload?.items
    ];

    return candidates.find(Array.isArray) || null;
  }

  async function requestJson(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Streamed API returned ${response.status}.`);
    }

    const payload = await response.json();
    const collection = normalizeCollection(payload);

    if (!collection) {
      throw new Error("Streamed returned an unexpected response.");
    }

    return collection;
  }

  async function cachedRequest(name, path, ttl, force = false) {
    const cached = readCache(name);
    const isFresh =
      cached &&
      Array.isArray(cached.data) &&
      Date.now() - Number(cached.savedAt || 0) < ttl;

    if (!force && isFresh) {
      return {
        data: cached.data,
        savedAt: cached.savedAt,
        fromCache: true,
        stale: false
      };
    }

    const flightKey = `${name}:${force ? "force" : "normal"}`;

    if (inFlight.has(flightKey)) {
      return inFlight.get(flightKey);
    }

    const task = (async () => {
      try {
        const data = await requestJson(path);
        writeCache(name, data);

        return {
          data,
          savedAt: Date.now(),
          fromCache: false,
          stale: false
        };
      } catch (error) {
        if (cached && Array.isArray(cached.data)) {
          return {
            data: cached.data,
            savedAt: cached.savedAt,
            fromCache: true,
            stale: true,
            error
          };
        }

        throw error;
      } finally {
        inFlight.delete(flightKey);
      }
    })();

    inFlight.set(flightKey, task);
    return task;
  }

  function getLive(force = false) {
    return cachedRequest(
      "live",
      "/matches/live",
      TTL.live,
      force
    );
  }

  function getToday(force = false) {
    return cachedRequest(
      "today",
      "/matches/all-today",
      TTL.today,
      force
    );
  }

  function getSports(force = false) {
    return cachedRequest(
      "sports",
      "/sports",
      TTL.sports,
      force
    );
  }

  function getAll(force = false) {
    return cachedRequest(
      "all",
      "/matches/all",
      TTL.all,
      force
    );
  }

  function emptyResult(error = null) {
    return {
      data: [],
      savedAt: 0,
      fromCache: false,
      stale: false,
      error
    };
  }

  async function getDiscovery({ forceMatches = false } = {}) {
    /*
      Courtesy plan:
      - at most one Live request and one Today request per refresh
      - Sports is cached for 24 hours and is optional
      - no Popular or per-sport requests
      - no automatic polling

      Each request settles independently so a temporary Sports failure does
      not prevent Live and Today events from rendering.
    */
    const settled = await Promise.allSettled([
      getLive(forceMatches),
      getToday(forceMatches),
      getSports(false)
    ]);

    const live = settled[0].status === "fulfilled"
      ? settled[0].value
      : emptyResult(settled[0].reason);
    const today = settled[1].status === "fulfilled"
      ? settled[1].value
      : emptyResult(settled[1].reason);
    const sports = settled[2].status === "fulfilled"
      ? settled[2].value
      : emptyResult(settled[2].reason);

    if (!live.data.length && !today.data.length) {
      throw live.error || today.error || new Error(
        "No event listings are available right now."
      );
    }

    return {
      live,
      today,
      sports,
      warnings: [live.error, today.error, sports.error].filter(Boolean)
    };
  }

  function streamCacheKey(source, id) {
    return (
      `${STREAM_CACHE_PREFIX}` +
      `${String(source).toLowerCase()}:${String(id)}`
    );
  }

  async function getSourceStreams(source, id, force = false) {
    const key = streamCacheKey(source, id);
    const cached = readStorage(sessionStorage, key);
    const fresh =
      cached &&
      Array.isArray(cached.data) &&
      Date.now() - Number(cached.savedAt || 0) < TTL.streams;

    if (!force && fresh) {
      return cached.data;
    }

    try {
      const data = await requestJson(
        `/stream/${encodeURIComponent(source)}/` +
        `${encodeURIComponent(id)}`
      );

      if (!Array.isArray(data)) {
        return [];
      }

      writeStorage(sessionStorage, key, {
        data,
        savedAt: Date.now()
      });

      return data;
    } catch (error) {
      if (cached && Array.isArray(cached.data)) {
        return cached.data;
      }

      throw error;
    }
  }

  async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;

        try {
          results[index] = {
            status: "fulfilled",
            value: await worker(items[index], index)
          };
        } catch (reason) {
          results[index] = {
            status: "rejected",
            reason
          };
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      () => runWorker()
    );

    await Promise.all(workers);
    return results;
  }

  async function getStreams(match, force = false) {
    const sources = Array.isArray(match?.sources)
      ? match.sources
      : [];

    if (!sources.length) {
      throw new Error("No stream sources are listed for this event.");
    }

    /* Stream endpoints are requested only after a user chooses an event. */
    const settled = await mapWithConcurrency(
      sources,
      3,
      async (source, sourceOrder) => {
        const streams = await getSourceStreams(
          source.source,
          source.id,
          force
        );

        return streams.map((stream) => ({
          ...stream,
          source: stream.source || source.source,
          sourceOrder,
          sourceMatchId: source.id
        }));
      }
    );

    const unique = [];
    const seen = new Set();

    settled.forEach((result) => {
      if (result.status !== "fulfilled") {
        return;
      }

      result.value.forEach((stream) => {
        if (!stream?.embedUrl) {
          return;
        }

        const key = [
          stream.source,
          stream.streamNo,
          stream.embedUrl
        ].join("|");

        if (!seen.has(key)) {
          seen.add(key);
          unique.push(stream);
        }
      });
    });

    unique.sort((left, right) => {
      const sourceOrder =
        Number(left.sourceOrder || 0) -
        Number(right.sourceOrder || 0);

      if (sourceOrder) {
        return sourceOrder;
      }

      return Number(left.streamNo || 0) -
        Number(right.streamNo || 0);
    });

    if (!unique.length) {
      throw new Error(
        "The event exists, but no playable streams were returned."
      );
    }

    return unique;
  }

  function cleanImageReference(value) {
    return String(value ?? "").trim();
  }

  function ensureWebp(value) {
    return /\.webp(?:[?#].*)?$/i.test(value)
      ? value
      : `${value}.webp`;
  }

  function badgeUrl(value) {
    const reference = cleanImageReference(value);

    if (!reference) return "";
    if (/^https?:\/\//i.test(reference)) return ensureWebp(reference);
    if (reference.startsWith("/")) {
      return `https://streamed.pk${ensureWebp(reference)}`;
    }

    return (
      `${API_BASE}/images/badge/` +
      `${encodeURIComponent(reference.replace(/\.webp$/i, ""))}.webp`
    );
  }

  function posterUrl(value) {
    const reference = cleanImageReference(value);

    if (!reference) return "";
    if (/^https?:\/\//i.test(reference)) return ensureWebp(reference);
    if (reference.startsWith("/")) {
      return `https://streamed.pk${ensureWebp(reference)}`;
    }

    return (
      `${API_BASE}/images/proxy/` +
      `${encodeURIComponent(reference.replace(/\.webp$/i, ""))}.webp`
    );
  }

  function matchupPosterUrl(match) {
    const home = cleanImageReference(match?.teams?.home?.badge)
      .replace(/\.webp$/i, "");
    const away = cleanImageReference(match?.teams?.away?.badge)
      .replace(/\.webp$/i, "");

    if (!home || !away) return "";

    return (
      `${API_BASE}/images/poster/` +
      `${encodeURIComponent(home)}/` +
      `${encodeURIComponent(away)}.webp`
    );
  }

  window.EastcoinStreamedAPI = Object.freeze({
    API_BASE,
    TTL,
    getLive,
    getToday,
    getSports,
    getAll,
    getDiscovery,
    getStreams,
    badgeUrl,
    posterUrl,
    matchupPosterUrl
  });
})();

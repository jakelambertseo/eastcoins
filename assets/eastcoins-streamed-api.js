(() => {
  "use strict";

  /*
    Compatibility layer:
    EastCoin's existing UI still reads window.EastcoinStreamedAPI.
    This file now merges Streamed + PPV underneath that interface so
    Events, Live Player, shared rooms, and MultiView can keep their
    existing controller code.
  */

  const API_BASE = "https://streamed.pk/api";
  const PPV = window.EastcoinPpvAPI || null;

  const CACHE_PREFIX =
    "eastcoinStreamedCacheV2:";
  const STREAM_CACHE_PREFIX =
    "eastcoinStreamedStreamsV1:";

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
      storage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch {}
  }

  function cacheKey(name) {
    return `${CACHE_PREFIX}${name}`;
  }

  function readCache(name) {
    return readStorage(
      localStorage,
      cacheKey(name)
    );
  }

  function writeCache(name, data) {
    writeStorage(
      localStorage,
      cacheKey(name),
      {
        data,
        savedAt: Date.now()
      }
    );
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

    return candidates.find(Array.isArray) ||
      null;
  }

  async function requestJson(path) {
    const response = await fetch(
      `${API_BASE}${path}`,
      {
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Streamed API returned ${response.status}.`
      );
    }

    const payload = await response.json();
    const collection =
      normalizeCollection(payload);

    if (!collection) {
      throw new Error(
        "Streamed returned an unexpected response."
      );
    }

    return collection;
  }

  async function cachedRequest(
    name,
    path,
    ttl,
    force = false
  ) {
    const cached = readCache(name);
    const isFresh =
      cached &&
      Array.isArray(cached.data) &&
      Date.now() -
        Number(cached.savedAt || 0) <
        ttl;

    if (!force && isFresh) {
      return {
        data: cached.data,
        savedAt: cached.savedAt,
        fromCache: true,
        stale: false
      };
    }

    const flightKey =
      `${name}:${force ? "force" : "normal"}`;

    if (inFlight.has(flightKey)) {
      return inFlight.get(flightKey);
    }

    const task = (async () => {
      try {
        const data =
          await requestJson(path);

        writeCache(name, data);

        return {
          data,
          savedAt: Date.now(),
          fromCache: false,
          stale: false
        };
      } catch (error) {
        if (
          cached &&
          Array.isArray(cached.data)
        ) {
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

  function getStreamedLive(force = false) {
    return cachedRequest(
      "live",
      "/matches/live",
      TTL.live,
      force
    );
  }

  function getStreamedToday(force = false) {
    return cachedRequest(
      "today",
      "/matches/all-today",
      TTL.today,
      force
    );
  }

  function getStreamedSports(force = false) {
    return cachedRequest(
      "sports",
      "/sports",
      TTL.sports,
      force
    );
  }

  function getStreamedAll(force = false) {
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

  function slugify(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function eventTimestamp(value) {
    let timestamp = Number(value);

    if (
      !Number.isFinite(timestamp) ||
      timestamp <= 0
    ) {
      return 0;
    }

    if (timestamp < 1_000_000_000_000) {
      timestamp *= 1000;
    }

    return timestamp;
  }

  function localDayKey(timestamp) {
    const date = new Date(
      eventTimestamp(timestamp)
    );

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1)
        .padStart(2, "0"),
      String(date.getDate())
        .padStart(2, "0")
    ].join("-");
  }

  function todayKey() {
    return localDayKey(Date.now());
  }

  function categoryFamily(value) {
    const text = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const families = [
      [
        "basketball",
        [
          "basketball",
          "nba",
          "wnba",
          "ncaab"
        ]
      ],
      [
        "american-football",
        [
          "american football",
          "nfl",
          "ncaaf",
          "college football"
        ]
      ],
      [
        "baseball",
        [
          "baseball",
          "mlb"
        ]
      ],
      [
        "hockey",
        [
          "hockey",
          "nhl"
        ]
      ],
      [
        "soccer",
        [
          "soccer",
          "epl",
          "uefa",
          "fifa",
          "premier league"
        ]
      ],
      [
        "combat",
        [
          "combat",
          "ufc",
          "mma",
          "boxing"
        ]
      ],
      [
        "wrestling",
        [
          "wrestling",
          "wwe",
          "aew"
        ]
      ],
      [
        "motorsport",
        [
          "motorsport",
          "formula",
          "nascar",
          "racing"
        ]
      ],
      ["tennis", ["tennis"]],
      ["golf", ["golf", "pga"]]
    ];

    for (
      const [family, aliases] of families
    ) {
      if (
        aliases.some((alias) =>
          text.includes(alias)
        )
      ) {
        return family;
      }
    }

    /*
      Streamed sometimes uses "football" for soccer.
      Only treat a bare football label as soccer after
      American-football aliases have been checked.
    */
    if (text === "football") {
      return "soccer";
    }

    return text || "other";
  }

  function cleanTitle(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/\bversus\b/g, " vs ")
      .replace(/\bvs\.\b/g, " vs ")
      .replace(/\bv\.\b/g, " vs ")
      .replace(/\s+@\s+/g, " at ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sideKey(value) {
    return cleanTitle(value)
      .replace(
        /\b(the|fc|cf|sc|afc|club|team)\b/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleSides(value) {
    const cleaned = cleanTitle(value)
      .replace(/\s+vs\s+/g, " at ");

    const sides = cleaned
      .split(/\s+at\s+/)
      .map(sideKey)
      .filter(Boolean);

    return sides.length === 2
      ? sides.sort()
      : [];
  }

  function normalizedTitleKey(value) {
    const sides = titleSides(value);

    return sides.length === 2
      ? sides.join(" | ")
      : sideKey(value);
  }

  function tokenSet(value) {
    return new Set(
      sideKey(value)
        .split(" ")
        .filter(
          (token) => token.length > 1
        )
    );
  }

  function titleSimilarity(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);

    if (!a.size || !b.size) {
      return 0;
    }

    let intersection = 0;

    a.forEach((token) => {
      if (b.has(token)) {
        intersection += 1;
      }
    });

    const union =
      new Set([...a, ...b]).size;

    return union
      ? intersection / union
      : 0;
  }

  function ppvCategoryId(name) {
    return `ppv-${slugify(name || "other")}`;
  }

  function ppvIsLive(stream) {
    const now = Date.now();
    const start =
      eventTimestamp(stream?.starts_at);
    const end =
      eventTimestamp(stream?.ends_at);
    const alwaysLive =
      Number(stream?.always_live || 0) === 1 ||
      Number(
        stream?.category_always_live || 0
      ) === 1;

    return (
      alwaysLive ||
      (
        start > 0 &&
        start <= now &&
        (!end || now <= end)
      )
    );
  }

  function ppvToMatch(stream) {
    const categoryName = String(
      stream?.category_name || "Other"
    );
    const start =
      eventTimestamp(stream?.starts_at);
    const live = ppvIsLive(stream);
    const id = String(stream?.id ?? "");

    return {
      id: `ppv:${id}`,
      title: String(
        stream?.name || `PPV ${id}`
      ),
      category:
        ppvCategoryId(categoryName),
      date:
        start ||
        (live ? Date.now() : 0),
      poster: String(
        stream?.poster || ""
      ),
      popular: false,
      teams: null,
      sources: [
        {
          source: "ppv",
          id
        }
      ],
      _eastcoinLive: live,
      _eastcoinProviders: {
        streamed: false,
        ppv: {
          id,
          category: categoryName,
          tag: String(stream?.tag || ""),
          uriName: String(
            stream?.uri_name || ""
          ),
          startsAt: start,
          endsAt:
            eventTimestamp(
              stream?.ends_at
            ),
          iframeReady:
            Boolean(
              PPV?.iframeReady?.(stream)
            )
        }
      }
    };
  }

  function streamEventId(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      `${match?.category || "event"}:` +
      `${match?.title || ""}:` +
      `${match?.date || ""}`
    );
  }

  function streamedMatchCopy(
    match,
    liveIds
  ) {
    const id = streamEventId(match);

    return {
      ...match,
      id,
      sources:
        Array.isArray(match?.sources)
          ? match.sources.map((source) => ({
              ...source
            }))
          : [],
      _eastcoinLive:
        liveIds.has(id),
      _eastcoinProviders: {
        ...(match?._eastcoinProviders || {}),
        streamed: true
      }
    };
  }

  function matchScore(
    streamed,
    ppvMatch
  ) {
    const exact =
      normalizedTitleKey(
        streamed.title
      ) ===
      normalizedTitleKey(
        ppvMatch.title
      );

    const similarity =
      titleSimilarity(
        streamed.title,
        ppvMatch.title
      );

    const categoryMatched =
      categoryFamily(
        streamed.category
      ) ===
      categoryFamily(
        ppvMatch
          ._eastcoinProviders
          ?.ppv?.category
      );

    const streamedTime =
      eventTimestamp(streamed.date);
    const ppvTime =
      eventTimestamp(ppvMatch.date);

    const timeDifference =
      streamedTime && ppvTime
        ? Math.abs(
            streamedTime - ppvTime
          )
        : Infinity;

    const closeTime =
      timeDifference <=
      20 * 60 * 1000;

    let score = 0;

    if (exact) {
      score += 70;
    } else if (similarity >= 0.84) {
      score += 55;
    } else if (similarity >= 0.72) {
      score += 35;
    }

    if (categoryMatched) {
      score += 15;
    }

    if (closeTime) {
      score += 20;
    } else if (
      !streamedTime ||
      !ppvTime ||
      streamed._eastcoinLive ||
      ppvMatch._eastcoinLive
    ) {
      score += 5;
    }

    return {
      score,
      exact,
      similarity,
      categoryMatched,
      timeDifference
    };
  }

  function mergePpvIntoMatch(
    streamed,
    ppvMatch
  ) {
    const ppvSource =
      ppvMatch.sources?.[0] || null;

    const sources = [
      ...(Array.isArray(streamed.sources)
        ? streamed.sources
        : [])
    ];

    if (
      ppvSource &&
      !sources.some(
        (source) =>
          String(source.source)
            .toLowerCase() === "ppv" &&
          String(source.id) ===
            String(ppvSource.id)
      )
    ) {
      sources.push(ppvSource);
    }

    return {
      ...streamed,
      poster:
        streamed.poster ||
        ppvMatch.poster ||
        "",
      sources,
      _eastcoinLive:
        Boolean(
          streamed._eastcoinLive ||
          ppvMatch._eastcoinLive
        ),
      _eastcoinProviders: {
        ...(streamed
          ._eastcoinProviders || {}),
        ppv:
          ppvMatch
            ._eastcoinProviders
            ?.ppv || null
      }
    };
  }

  function mergeCatalog(
    streamedMatches,
    ppvStreams,
    liveIds = new Set()
  ) {
    const streamed =
      streamedMatches.map(
        (match) =>
          streamedMatchCopy(
            match,
            liveIds
          )
      );

    const ppvMatches =
      ppvStreams.map(ppvToMatch);

    const usedStreamed = new Set();
    const merged = [];

    ppvMatches.forEach((ppvMatch) => {
      let best = null;

      streamed.forEach(
        (streamedMatch, index) => {
          if (
            usedStreamed.has(index)
          ) {
            return;
          }

          const result = matchScore(
            streamedMatch,
            ppvMatch
          );

          if (
            !best ||
            result.score >
              best.result.score
          ) {
            best = {
              index,
              match: streamedMatch,
              result
            };
          }
        }
      );

      /*
        Be conservative in production. A PPV listing is merged only
        when title/category/time evidence is strong enough; otherwise
        it remains a separate PPV event instead of risking a false
        server attachment.
      */
      if (
        best &&
        best.result.score >= 80
      ) {
        usedStreamed.add(
          best.index
        );

        merged.push(
          mergePpvIntoMatch(
            best.match,
            ppvMatch
          )
        );
      } else {
        merged.push(ppvMatch);
      }
    });

    streamed.forEach(
      (match, index) => {
        if (
          !usedStreamed.has(index)
        ) {
          merged.push(match);
        }
      }
    );

    const deduped = new Map();

    merged.forEach((match) => {
      const key = streamEventId(match);
      const existing =
        deduped.get(key);

      if (!existing) {
        deduped.set(key, match);
        return;
      }

      const existingSources =
        existing.sources?.length || 0;
      const nextSources =
        match.sources?.length || 0;

      if (
        nextSources >
        existingSources
      ) {
        deduped.set(key, match);
      }
    });

    return Array.from(
      deduped.values()
    );
  }

  function ppvSports(catalog) {
    const names = new Map();

    (catalog?.streams || [])
      .forEach((stream) => {
        const name = String(
          stream?.category_name ||
          "Other"
        );
        const id =
          ppvCategoryId(name);

        if (!names.has(id)) {
          names.set(id, {
            id,
            name
          });
        }
      });

    return Array.from(
      names.values()
    );
  }

  function combineSports(
    streamedSports,
    ppvCatalog
  ) {
    const map = new Map();

    (streamedSports || [])
      .forEach((sport) => {
        const id = String(
          sport?.id ?? sport?.name ?? ""
        );

        if (!id) return;

        map.set(id, sport);
      });

    ppvSports(ppvCatalog)
      .forEach((sport) => {
        if (!map.has(sport.id)) {
          map.set(
            sport.id,
            sport
          );
        }
      });

    return Array.from(
      map.values()
    );
  }

  async function getDiscovery(
    {
      forceMatches = false
    } = {}
  ) {
    const tasks = [
      getStreamedLive(
        forceMatches
      ),
      getStreamedToday(
        forceMatches
      ),
      getStreamedSports(false),
      PPV
        ? PPV.getCatalog(
            forceMatches
          )
        : Promise.reject(
            new Error(
              "PPV adapter unavailable."
            )
          )
    ];

    const settled =
      await Promise.allSettled(tasks);

    const streamedLive =
      settled[0].status ===
      "fulfilled"
        ? settled[0].value
        : emptyResult(
            settled[0].reason
          );

    const streamedToday =
      settled[1].status ===
      "fulfilled"
        ? settled[1].value
        : emptyResult(
            settled[1].reason
          );

    const streamedSports =
      settled[2].status ===
      "fulfilled"
        ? settled[2].value
        : emptyResult(
            settled[2].reason
          );

    const ppvCatalog =
      settled[3].status ===
      "fulfilled"
        ? settled[3].value
        : {
            streams: [],
            savedAt: 0,
            stale: false,
            error:
              settled[3].reason
          };

    if (
      !streamedLive.data.length &&
      !streamedToday.data.length &&
      !ppvCatalog.streams.length
    ) {
      throw (
        streamedLive.error ||
        streamedToday.error ||
        ppvCatalog.error ||
        new Error(
          "No event listings are available right now."
        )
      );
    }

    const liveIds = new Set(
      streamedLive.data
        .map(streamEventId)
    );

    const streamedUnion =
      new Map();

    [
      ...streamedLive.data,
      ...streamedToday.data
    ].forEach((match) => {
      const id =
        streamEventId(match);

      const existing =
        streamedUnion.get(id);

      if (
        !existing ||
        (match.sources?.length || 0) >
          (existing.sources?.length || 0)
      ) {
        streamedUnion.set(
          id,
          match
        );
      }
    });

    const unified = mergeCatalog(
      Array.from(
        streamedUnion.values()
      ),
      ppvCatalog.streams || [],
      liveIds
    );

    const today = todayKey();

    const live = unified.filter(
      (match) =>
        Boolean(match._eastcoinLive)
    );

    const todayMatches =
      unified.filter((match) => {
        if (match._eastcoinLive) {
          return true;
        }

        return (
          localDayKey(match.date) ===
          today
        );
      });

    const latestSavedAt = Math.max(
      Number(
        streamedLive.savedAt || 0
      ),
      Number(
        streamedToday.savedAt || 0
      ),
      Number(
        ppvCatalog.savedAt || 0
      )
    );

    const providerStale = Boolean(
      streamedLive.stale ||
      streamedToday.stale ||
      ppvCatalog.stale
    );

    const warnings = [
      streamedLive.error,
      streamedToday.error,
      streamedSports.error,
      ppvCatalog.error
    ].filter(Boolean);

    return {
      live: {
        data: live,
        savedAt: latestSavedAt,
        fromCache:
          Boolean(
            streamedLive.fromCache &&
            streamedToday.fromCache &&
            ppvCatalog.fromCache
          ),
        stale: providerStale
      },
      today: {
        data: todayMatches,
        savedAt: latestSavedAt,
        fromCache:
          Boolean(
            streamedToday.fromCache &&
            ppvCatalog.fromCache
          ),
        stale: providerStale
      },
      sports: {
        data: combineSports(
          streamedSports.data,
          ppvCatalog
        ),
        savedAt: Math.max(
          Number(
            streamedSports.savedAt ||
            0
          ),
          Number(
            ppvCatalog.savedAt || 0
          )
        ),
        fromCache:
          Boolean(
            streamedSports.fromCache &&
            ppvCatalog.fromCache
          ),
        stale:
          Boolean(
            streamedSports.stale ||
            ppvCatalog.stale
          )
      },
      warnings
    };
  }

  function streamCacheKey(
    source,
    id
  ) {
    return (
      `${STREAM_CACHE_PREFIX}` +
      `${String(source).toLowerCase()}:` +
      `${String(id)}`
    );
  }

  async function getSourceStreams(
    source,
    id,
    force = false
  ) {
    const key =
      streamCacheKey(source, id);

    const cached = readStorage(
      sessionStorage,
      key
    );

    const fresh =
      cached &&
      Array.isArray(cached.data) &&
      Date.now() -
        Number(cached.savedAt || 0) <
        TTL.streams;

    if (!force && fresh) {
      return cached.data;
    }

    try {
      const data =
        await requestJson(
          `/stream/` +
          `${encodeURIComponent(source)}/` +
          `${encodeURIComponent(id)}`
        );

      if (!Array.isArray(data)) {
        return [];
      }

      writeStorage(
        sessionStorage,
        key,
        {
          data,
          savedAt: Date.now()
        }
      );

      return data;
    } catch (error) {
      if (
        cached &&
        Array.isArray(cached.data)
      ) {
        return cached.data;
      }

      throw error;
    }
  }

  async function mapWithConcurrency(
    items,
    limit,
    worker
  ) {
    const results =
      new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
      while (
        nextIndex < items.length
      ) {
        const index = nextIndex;
        nextIndex += 1;

        try {
          results[index] = {
            status: "fulfilled",
            value:
              await worker(
                items[index],
                index
              )
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
      {
        length:
          Math.min(
            limit,
            items.length
          )
      },
      () => runWorker()
    );

    await Promise.all(workers);
    return results;
  }

  function ppvSourceFromMatch(match) {
    return (
      Array.isArray(match?.sources)
        ? match.sources.find(
            (source) =>
              String(
                source?.source || ""
              ).toLowerCase() ===
              "ppv"
          )
        : null
    );
  }

  function findPpvMatch(
    match,
    catalog
  ) {
    if (!catalog?.streams?.length) {
      return null;
    }

    const explicitSource =
      ppvSourceFromMatch(match);

    const explicitId =
      explicitSource?.id ??
      match?._eastcoinProviders
        ?.ppv?.id;

    if (
      explicitId !== undefined &&
      explicitId !== null &&
      explicitId !== ""
    ) {
      const exact =
        catalog.streams.find(
          (stream) =>
            String(stream?.id ?? "") ===
            String(explicitId)
        );

      if (exact) {
        return {
          stream: exact,
          score: 100,
          method: "id"
        };
      }
    }

    const ppvCandidates =
      catalog.streams.map(
        ppvToMatch
      );

    let best = null;

    ppvCandidates.forEach(
      (candidate, index) => {
        const result =
          matchScore(
            streamedMatchCopy(
              match,
              new Set()
            ),
            candidate
          );

        if (
          !best ||
          result.score >
            best.score
        ) {
          best = {
            stream:
              catalog.streams[index],
            score:
              result.score,
            method:
              result.exact
                ? "normalized-title"
                : "similarity"
          };
        }
      }
    );

    return (
      best &&
      best.score >= 80
    )
      ? best
      : null;
  }

  function ppvWrapperUrl(stream) {
    const id = String(
      stream?.id ?? ""
    );

    const relative =
      `ppv-player.html?id=` +
      encodeURIComponent(id);

    try {
      return new URL(
        relative,
        window.location.href
      ).href;
    } catch {
      return relative;
    }
  }

  function ppvPlayerStream(
    stream,
    ready = false
  ) {
    return {
      /*
        Keep PPV as a normal server in EastCoin even while its
        provider iframe is still preparing. The same-origin wrapper
        handles the one-minute availability checks without blocking
        a working Streamed server.
      */
      source: "PPV",
      streamNo: 1,
      embedUrl:
        ppvWrapperUrl(stream),
      hd: false,
      language:
        String(
          stream?.tag ||
          "Provider backup"
        ),
      provider: "ppv",
      ppvId: String(
        stream?.id ?? ""
      ),
      ppvReady: Boolean(ready)
    };
  }

  async function getPpvStatus(
    match,
    force = false
  ) {
    if (!PPV) {
      return {
        state: "unavailable",
        stream: null,
        ppvEvent: null,
        message:
          "PPV adapter unavailable."
      };
    }

    let catalog;

    try {
      catalog =
        await PPV.getCatalog(
          force
        );
    } catch (error) {
      return {
        state: "unavailable",
        stream: null,
        ppvEvent: null,
        error,
        message:
          "PPV is temporarily unavailable."
      };
    }

    const found =
      findPpvMatch(
        match,
        catalog
      );

    if (!found?.stream) {
      return {
        state: "missing",
        stream: null,
        ppvEvent: null,
        checkedAt: Date.now(),
        message:
          "No PPV listing is matched yet."
      };
    }

    if (
      PPV.iframeReady(
        found.stream
      )
    ) {
      return {
        state: "ready",
        stream:
          ppvPlayerStream(
            found.stream,
            true
          ),
        ppvEvent:
          found.stream,
        matchMethod:
          found.method,
        matchScore:
          found.score,
        checkedAt: Date.now()
      };
    }

    return {
      state: "pending",
      stream:
        ppvPlayerStream(
          found.stream,
          false
        ),
      ppvEvent:
        found.stream,
      matchMethod:
        found.method,
      matchScore:
        found.score,
      checkedAt: Date.now(),
      message:
        "PPV embed pending."
    };
  }

  async function getStreams(
    match,
    force = false
  ) {
    const sources =
      Array.isArray(match?.sources)
        ? match.sources
        : [];

    const streamedSources =
      sources.filter(
        (source) =>
          String(
            source?.source || ""
          ).toLowerCase() !==
          "ppv"
      );

    const settled =
      await mapWithConcurrency(
        streamedSources,
        3,
        async (
          source,
          sourceOrder
        ) => {
          const streams =
            await getSourceStreams(
              source.source,
              source.id,
              force
            );

          return streams.map(
            (stream) => ({
              ...stream,
              source:
                stream.source ||
                source.source,
              sourceOrder,
              sourceMatchId:
                source.id
            })
          );
        }
      );

    const unique = [];
    const seen = new Set();

    settled.forEach((result) => {
      if (
        result.status !==
        "fulfilled"
      ) {
        return;
      }

      result.value.forEach(
        (stream) => {
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
        }
      );
    });

    const ppvStatus =
      await getPpvStatus(
        match,
        false
      );

    if (
      (
        ppvStatus.state ===
          "ready" ||
        ppvStatus.state ===
          "pending"
      ) &&
      ppvStatus.stream
    ) {
      const key = [
        ppvStatus.stream.source,
        ppvStatus.stream.streamNo,
        ppvStatus.stream.embedUrl
      ].join("|");

      if (!seen.has(key)) {
        unique.push(
          ppvStatus.stream
        );
      }
    }

    unique.sort(
      (left, right) => {
        const leftPpv =
          String(
            left.source || ""
          ).toLowerCase() ===
          "ppv";
        const rightPpv =
          String(
            right.source || ""
          ).toLowerCase() ===
          "ppv";

        /*
          Streamed remains the first-choice path when it is
          already working; PPV joins as a backup.
        */
        if (leftPpv !== rightPpv) {
          return Number(leftPpv) -
            Number(rightPpv);
        }

        const sourceOrder =
          Number(
            left.sourceOrder || 0
          ) -
          Number(
            right.sourceOrder || 0
          );

        if (sourceOrder) {
          return sourceOrder;
        }

        return (
          Number(
            left.streamNo || 0
          ) -
          Number(
            right.streamNo || 0
          )
        );
      }
    );

    if (!unique.length) {
      throw new Error(
        "The event exists, but no playable streams were returned."
      );
    }

    return unique;
  }

  async function getAll(
    force = false
  ) {
    const settled =
      await Promise.allSettled([
        getStreamedAll(force),
        PPV
          ? PPV.getCatalog(force)
          : Promise.reject(
              new Error(
                "PPV adapter unavailable."
              )
            )
      ]);

    const streamed =
      settled[0].status ===
      "fulfilled"
        ? settled[0].value
        : emptyResult(
            settled[0].reason
          );

    const ppvCatalog =
      settled[1].status ===
      "fulfilled"
        ? settled[1].value
        : {
            streams: [],
            savedAt: 0,
            stale: false,
            error:
              settled[1].reason
          };

    if (
      !streamed.data.length &&
      !ppvCatalog.streams.length
    ) {
      throw (
        streamed.error ||
        ppvCatalog.error ||
        new Error(
          "No event listings are available."
        )
      );
    }

    const data = mergeCatalog(
      streamed.data,
      ppvCatalog.streams || [],
      new Set()
    );

    return {
      data,
      savedAt: Math.max(
        Number(
          streamed.savedAt || 0
        ),
        Number(
          ppvCatalog.savedAt || 0
        )
      ),
      fromCache:
        Boolean(
          streamed.fromCache &&
          ppvCatalog.fromCache
        ),
      stale:
        Boolean(
          streamed.stale ||
          ppvCatalog.stale
        ),
      error:
        streamed.error ||
        ppvCatalog.error ||
        null
    };
  }

  async function getLive(
    force = false
  ) {
    const discovery =
      await getDiscovery({
        forceMatches: force
      });

    return discovery.live;
  }

  async function getToday(
    force = false
  ) {
    const discovery =
      await getDiscovery({
        forceMatches: force
      });

    return discovery.today;
  }

  async function getSports(
    force = false
  ) {
    const discovery =
      await getDiscovery({
        forceMatches: force
      });

    return discovery.sports;
  }

  function cleanImageReference(value) {
    return String(value ?? "")
      .trim();
  }

  function ensureWebp(value) {
    return /\.webp(?:[?#].*)?$/i
      .test(value)
      ? value
      : `${value}.webp`;
  }

  function badgeUrl(value) {
    const reference =
      cleanImageReference(value);

    if (!reference) return "";

    /*
      PPV and other future providers can supply ordinary PNG/JPG
      URLs. Never append Streamed's .webp suffix to absolute URLs.
    */
    if (
      /^https?:\/\//i.test(
        reference
      )
    ) {
      return reference;
    }

    if (
      reference.startsWith("/")
    ) {
      return (
        `https://streamed.pk` +
        `${ensureWebp(reference)}`
      );
    }

    return (
      `${API_BASE}/images/badge/` +
      `${encodeURIComponent(
        reference.replace(
          /\.webp$/i,
          ""
        )
      )}.webp`
    );
  }

  function posterUrl(value) {
    const reference =
      cleanImageReference(value);

    if (!reference) return "";

    if (
      /^https?:\/\//i.test(
        reference
      )
    ) {
      return reference;
    }

    if (
      reference.startsWith("/")
    ) {
      return (
        `https://streamed.pk` +
        `${ensureWebp(reference)}`
      );
    }

    return (
      `${API_BASE}/images/proxy/` +
      `${encodeURIComponent(
        reference.replace(
          /\.webp$/i,
          ""
        )
      )}.webp`
    );
  }

  function matchupPosterUrl(match) {
    const home =
      cleanImageReference(
        match?.teams?.home?.badge
      ).replace(
        /\.webp$/i,
        ""
      );

    const away =
      cleanImageReference(
        match?.teams?.away?.badge
      ).replace(
        /\.webp$/i,
        ""
      );

    if (!home || !away) {
      return "";
    }

    return (
      `${API_BASE}/images/poster/` +
      `${encodeURIComponent(home)}/` +
      `${encodeURIComponent(away)}.webp`
    );
  }

  window.EastcoinStreamedAPI =
    Object.freeze({
      API_BASE,
      TTL,
      getLive,
      getToday,
      getSports,
      getAll,
      getDiscovery,
      getStreams,
      getPpvStatus,
      badgeUrl,
      posterUrl,
      matchupPosterUrl
    });
})();

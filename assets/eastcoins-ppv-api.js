(() => {
  "use strict";

  const PRIMARY_BASE = "https://api.ppv.st";
  const EMBED_BASE = "https://embedindia.st/embed";
  const CACHE_KEY = "eastcoinPpvCatalogV2";
  const MIRROR_CACHE_KEY = "eastcoinPpvMirrorsV2";
  const LAST_NETWORK_KEY = "eastcoinPpvLastNetworkV1";
  const CATALOG_TTL = 60_000;
  const MIN_NETWORK_INTERVAL = 55_000;
  const MIRROR_TTL = 6 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 3500;
  const inFlight = new Map();

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function readStorage(key) {
    try {
      return safeParse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function readNumber(key) {
    try {
      return Number(localStorage.getItem(key) || 0);
    } catch {
      return 0;
    }
  }

  function writeNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }

  function normalizeBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    try {
      const url = new URL(
        /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)
          ? raw
          : `https://${raw}`
      );

      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }

      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }

  function uniqueBases(values) {
    const seen = new Set();
    const output = [];

    values.forEach((value) => {
      const normalized = normalizeBase(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      output.push(normalized);
    });

    return output;
  }

  function cachedMirrors() {
    const cached = readStorage(MIRROR_CACHE_KEY);
    const fresh =
      cached &&
      Array.isArray(cached.domains) &&
      Date.now() - Number(cached.savedAt || 0) < MIRROR_TTL;

    return fresh ? cached.domains : [];
  }

  function cachedCatalog() {
    const cached = readStorage(CACHE_KEY);

    return (
      cached &&
      Array.isArray(cached.data?.streams)
    )
      ? cached
      : null;
  }

  async function requestJson(base, path) {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${base}${path}`,
        {
          headers: {
            Accept: "application/json"
          },
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `PPV API returned ${response.status}.`
        );
      }

      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("PPV request timed out.");
      }

      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function refreshMirrors(force = false) {
    const cached = cachedMirrors();

    if (!force && cached.length) {
      return uniqueBases([
        PRIMARY_BASE,
        ...cached
      ]);
    }

    const candidates = uniqueBases([
      PRIMARY_BASE,
      ...cached
    ]);

    let lastError = null;

    for (const base of candidates) {
      try {
        const payload = await requestJson(
          base,
          "/api/ping"
        );

        const domains = Array.isArray(payload?.domains)
          ? payload.domains
          : [];

        const result = uniqueBases([
          PRIMARY_BASE,
          base,
          ...domains
        ]);

        writeStorage(MIRROR_CACHE_KEY, {
          domains: result,
          savedAt: Date.now()
        });

        return result;
      } catch (error) {
        lastError = error;
      }
    }

    if (cached.length) {
      return uniqueBases([
        PRIMARY_BASE,
        ...cached
      ]);
    }

    throw lastError || new Error(
      "PPV mirror discovery failed."
    );
  }

  function flattenCatalog(payload, apiBase) {
    if (!payload || payload.success !== true) {
      throw new Error(
        "PPV returned an unsuccessful response."
      );
    }

    const categories = Array.isArray(payload.streams)
      ? payload.streams
      : [];

    const streams = [];
    const categoryMetadata = [];

    categories.forEach((category) => {
      const categoryName = String(
        category?.category || "Other"
      );
      const categoryId = category?.id ?? "";
      const categoryAlwaysLive =
        Number(category?.always_live || 0);

      categoryMetadata.push({
        id: categoryId,
        name: categoryName,
        always_live: categoryAlwaysLive
      });

      const categoryStreams = Array.isArray(
        category?.streams
      )
        ? category.streams
        : [];

      categoryStreams.forEach((stream) => {
        streams.push({
          ...stream,
          category_name:
            stream.category_name ||
            categoryName,
          category_id: categoryId,
          category_always_live:
            categoryAlwaysLive
        });
      });
    });

    return {
      timestamp: Number(payload.timestamp || 0),
      readMe: String(payload.READ_ME || ""),
      performance: Number(payload.performance || 0),
      apiBase,
      categories: categoryMetadata,
      streams
    };
  }

  async function networkCatalogRequest() {
    let bases = uniqueBases([
      PRIMARY_BASE,
      ...cachedMirrors()
    ]);

    try {
      const mirrors = await refreshMirrors(false);
      bases = uniqueBases([
        ...bases,
        ...mirrors
      ]);
    } catch {
      // Known bases are still attempted below.
    }

    let lastError = null;

    for (const base of bases) {
      try {
        const payload = await requestJson(
          base,
          "/api/streams"
        );

        const data = flattenCatalog(
          payload,
          base
        );

        writeStorage(CACHE_KEY, {
          data,
          savedAt: Date.now()
        });
        writeNumber(
          LAST_NETWORK_KEY,
          Date.now()
        );

        return {
          ...data,
          savedAt: Date.now(),
          fromCache: false,
          stale: false
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(
      "PPV catalog is unavailable."
    );
  }

  async function getCatalog(force = false) {
    const cached = cachedCatalog();
    const now = Date.now();

    const fresh =
      cached &&
      now - Number(cached.savedAt || 0) <
        CATALOG_TTL;

    if (!force && fresh) {
      return {
        ...cached.data,
        savedAt: cached.savedAt,
        fromCache: true,
        stale: false
      };
    }

    /*
      MultiView can contain several same-origin player iframes.
      Respect PPV's roughly-one-minute polling guidance across all of
      them by refusing another network refresh inside this interval.
    */
    const lastNetwork =
      readNumber(LAST_NETWORK_KEY);

    if (
      force &&
      cached &&
      now - lastNetwork <
        MIN_NETWORK_INTERVAL
    ) {
      return {
        ...cached.data,
        savedAt: cached.savedAt,
        fromCache: true,
        stale:
          now - Number(cached.savedAt || 0) >=
          CATALOG_TTL
      };
    }

    const flightKey = force
      ? "catalog-force"
      : "catalog-normal";

    if (inFlight.has(flightKey)) {
      return inFlight.get(flightKey);
    }

    const task = (async () => {
      try {
        return await networkCatalogRequest();
      } catch (error) {
        if (cached) {
          return {
            ...cached.data,
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

  function iframeReady(stream) {
    return (
      typeof stream?.iframe === "string" &&
      /<iframe\b/i.test(stream.iframe)
    );
  }

  function iframeSrc(
    stream,
    apiBase = PRIMARY_BASE
  ) {
    if (!iframeReady(stream)) {
      return "";
    }

    const template =
      document.createElement("template");

    template.innerHTML =
      String(stream.iframe || "").trim();

    const children =
      Array.from(
        template.content.children
      );

    if (
      children.length !== 1 ||
      children[0].tagName !== "IFRAME"
    ) {
      return "";
    }

    const iframe = children[0];

    if (
      iframe.hasAttribute("srcdoc")
    ) {
      return "";
    }

    const rawSrc =
      iframe.getAttribute("src") || "";

    if (!rawSrc) {
      return "";
    }

    try {
      const resolved = new URL(
        rawSrc,
        apiBase || PRIMARY_BASE
      );

      return ["http:", "https:"].includes(
        resolved.protocol
      )
        ? resolved.href
        : "";
    } catch {
      return "";
    }
  }

  function decodeURIComponentSafe(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function uriEmbedUrl(stream) {
    const raw =
      String(
        stream?.uri_name || ""
      ).trim();

    if (!raw) {
      return "";
    }

    /*
      PPV's current event pages publish copyable embeds using:
        https://embedindia.st/embed/{uri_name}

      Preserve slash-separated PPV paths while safely encoding each
      individual path segment.
    */
    const path = raw
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean)
      .map((segment) =>
        encodeURIComponent(
          decodeURIComponentSafe(segment)
        )
      )
      .join("/");

    return path
      ? `${EMBED_BASE}/${path}`
      : "";
  }

  function embedUrl(
    stream,
    apiBase = PRIMARY_BASE
  ) {
    /*
      Explicit API iframe wins if PPV begins returning it again.
      Otherwise use the same uri_name mapping PPV currently exposes
      in its copyable embed code.
    */
    return (
      iframeSrc(stream, apiBase) ||
      uriEmbedUrl(stream)
    );
  }

  function playbackReady(
    stream,
    apiBase = PRIMARY_BASE
  ) {
    return Boolean(
      embedUrl(stream, apiBase)
    );
  }

  async function getStreamById(id, force = false) {
    const catalog = await getCatalog(force);
    const normalized = String(id || "");

    const stream =
      catalog.streams.find(
        (candidate) =>
          String(candidate?.id ?? "") ===
          normalized
      ) || null;

    const apiBase =
      catalog.apiBase || PRIMARY_BASE;

    const explicitSrc =
      iframeSrc(stream, apiBase);

    const resolvedEmbed =
      explicitSrc ||
      uriEmbedUrl(stream);

    return {
      stream,
      apiBase,
      savedAt: catalog.savedAt || 0,
      stale: Boolean(catalog.stale),
      iframeReady: iframeReady(stream),
      playbackReady:
        Boolean(resolvedEmbed),
      embedUrl: resolvedEmbed,
      embedSource:
        explicitSrc
          ? "api-iframe"
          : resolvedEmbed
            ? "uri-name"
            : "none"
    };
  }

  window.EastcoinPpvAPI = Object.freeze({
    PRIMARY_BASE,
    EMBED_BASE,
    CATALOG_TTL,
    MIN_NETWORK_INTERVAL,
    refreshMirrors,
    getCatalog,
    getStreamById,
    iframeReady,
    iframeSrc,
    uriEmbedUrl,
    embedUrl,
    playbackReady
  });
})();

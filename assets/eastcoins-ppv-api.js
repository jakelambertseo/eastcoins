(() => {
  "use strict";

  const PRIMARY_BASE = "https://api.ppv.st";
  const CACHE_KEY = "eastcoinPpvCatalogV1";
  const MIRROR_CACHE_KEY = "eastcoinPpvMirrorsV1";
  const CATALOG_TTL = 60_000;
  const MIRROR_TTL = 6 * 60 * 60 * 1000;

  function parseJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function readCache(key) {
    try {
      return parseJson(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
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
    const cached = readCache(MIRROR_CACHE_KEY);
    const fresh =
      cached &&
      Array.isArray(cached.domains) &&
      Date.now() - Number(cached.savedAt || 0) < MIRROR_TTL;

    return fresh ? cached.domains : [];
  }

  async function request(base, path) {
    const response = await fetch(`${base}${path}`, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `PPV API ${base} returned ${response.status}.`
      );
    }

    return response.json();
  }

  async function refreshMirrors() {
    const candidates = uniqueBases([
      PRIMARY_BASE,
      ...cachedMirrors()
    ]);

    let lastError = null;

    for (const base of candidates) {
      try {
        const payload = await request(base, "/api/ping");
        const domains = Array.isArray(payload?.domains)
          ? uniqueBases(payload.domains)
          : [];

        const result = uniqueBases([
          PRIMARY_BASE,
          base,
          ...domains
        ]);

        writeCache(MIRROR_CACHE_KEY, {
          domains: result,
          savedAt: Date.now()
        });

        return result;
      } catch (error) {
        lastError = error;
      }
    }

    if (cachedMirrors().length) {
      return uniqueBases([
        PRIMARY_BASE,
        ...cachedMirrors()
      ]);
    }

    throw lastError || new Error(
      "PPV mirror discovery failed."
    );
  }

  function flattenCatalog(payload) {
    if (!payload || payload.success !== true) {
      throw new Error(
        "PPV returned an unsuccessful response."
      );
    }

    const categories = Array.isArray(payload.streams)
      ? payload.streams
      : [];

    const streams = [];

    categories.forEach((category) => {
      const categoryStreams = Array.isArray(category?.streams)
        ? category.streams
        : [];

      categoryStreams.forEach((stream) => {
        streams.push({
          ...stream,
          category_name:
            stream.category_name ||
            category.category ||
            "Other",
          category_id: category.id,
          category_always_live:
            Number(category.always_live || 0)
        });
      });
    });

    return {
      timestamp: Number(payload.timestamp || 0),
      readMe: String(payload.READ_ME || ""),
      performance: Number(payload.performance || 0),
      streams
    };
  }

  async function getCatalog(force = false) {
    const cached = readCache(CACHE_KEY);
    const fresh =
      cached &&
      Array.isArray(cached.data?.streams) &&
      Date.now() - Number(cached.savedAt || 0) < CATALOG_TTL;

    if (!force && fresh) {
      return {
        ...cached.data,
        fromCache: true,
        stale: false
      };
    }

    let bases = uniqueBases([
      PRIMARY_BASE,
      ...cachedMirrors()
    ]);

    try {
      const mirrors = await refreshMirrors();
      bases = uniqueBases([
        ...bases,
        ...mirrors
      ]);
    } catch {
      // Catalog can still be attempted against known bases.
    }

    let lastError = null;

    for (const base of bases) {
      try {
        const payload = await request(
          base,
          "/api/streams"
        );
        const data = flattenCatalog(payload);

        writeCache(CACHE_KEY, {
          data,
          savedAt: Date.now()
        });

        return {
          ...data,
          apiBase: base,
          fromCache: false,
          stale: false
        };
      } catch (error) {
        lastError = error;
      }
    }

    if (cached && Array.isArray(cached.data?.streams)) {
      return {
        ...cached.data,
        fromCache: true,
        stale: true,
        error: lastError
      };
    }

    throw lastError || new Error(
      "PPV catalog is unavailable."
    );
  }

  window.EastcoinPpvAPI = Object.freeze({
    PRIMARY_BASE,
    CATALOG_TTL,
    refreshMirrors,
    getCatalog
  });
})();

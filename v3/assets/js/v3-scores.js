/* ============================================================
   EastCoin V3 — live scores from ESPN

   ESPN's public scoreboard endpoints answer with
   Access-Control-Allow-Origin: *, so this runs straight from the
   browser — no key, no proxy, nothing to deploy.

   The hard part isn't fetching, it's matching: streamed.st and
   ESPN are different catalogues with different naming. Matching
   is therefore deliberately conservative. A missed match shows
   no score, which is fine; a WRONG score attached to the wrong
   game is much worse than none, so every rule here errs toward
   giving up rather than guessing.
   ============================================================ */
(() => {
  "use strict";

  const LEAGUES = [
    { key: "american-football", path: "football/nfl" },
    { key: "american-football", path: "football/college-football" },
    { key: "baseball", path: "baseball/mlb" },
    { key: "basketball", path: "basketball/nba" },
    { key: "hockey", path: "hockey/nhl" }
  ];

  const BASE = "https://site.api.espn.com/apis/site/v2/sports";
  const TTL_MS = 45 * 1000;

  let cache = { at: 0, index: new Map() };
  let inflight = null;

  /* ---------------------------------------------------------- matching */

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\b(fc|cf|sc|afc|club|the)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // "Los Angeles Angels" -> "angels". Team nicknames are the most stable
  // token across providers; city prefixes vary ("LA", "Los Angeles").
  function nickname(value) {
    const parts = norm(value).split(" ").filter(Boolean);
    if (!parts.length) return "";
    // Two-word nicknames that would otherwise collide on their last word.
    const tail2 = parts.slice(-2).join(" ");
    if (/^(red sox|white sox|blue jays|maple leafs|golden knights|trail blazers)$/.test(tail2)) {
      return tail2;
    }
    return parts[parts.length - 1];
  }

  function pairKey(a, b) {
    return [nickname(a), nickname(b)].filter(Boolean).sort().join("|");
  }

  /* ---------------------------------------------------------- fetching */

  async function fetchLeague(path) {
    try {
      const response = await fetch(`${BASE}/${path}/scoreboard`, { mode: "cors" });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload?.events) ? payload.events : [];
    } catch {
      return [];
    }
  }

  function readEvent(event) {
    const competition = event?.competitions?.[0];
    const competitors = competition?.competitors || [];
    if (competitors.length !== 2) return null;

    const home = competitors.find((c) => c.homeAway === "home") || competitors[0];
    const away = competitors.find((c) => c.homeAway === "away") || competitors[1];
    const status = event?.status?.type || {};

    return {
      state: status.state || "pre",           // pre | in | post
      detail: status.shortDetail || status.detail || "",
      completed: Boolean(status.completed),
      home: {
        name: home?.team?.displayName || "",
        score: home?.score ?? null,
        logo: home?.team?.logo || ""
      },
      away: {
        name: away?.team?.displayName || "",
        score: away?.score ?? null,
        logo: away?.team?.logo || ""
      }
    };
  }

  async function refresh() {
    const results = await Promise.all(LEAGUES.map((l) => fetchLeague(l.path)));
    const index = new Map();

    results.forEach((events) => {
      for (const raw of events) {
        const entry = readEvent(raw);
        if (!entry || !entry.home.name || !entry.away.name) continue;
        const key = pairKey(entry.home.name, entry.away.name);
        if (key && !index.has(key)) index.set(key, entry);
      }
    });

    cache = { at: Date.now(), index };
    return cache.index;
  }

  async function ensure() {
    if (Date.now() - cache.at < TTL_MS && cache.index.size) return cache.index;
    if (inflight) return inflight;
    inflight = refresh().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  /* ---------------------------------------------------------- lookup */

  function teamNames(match) {
    const home = match?.teams?.home?.name;
    const away = match?.teams?.away?.name;
    if (home && away) return [home, away];

    // Fall back to splitting the title on " vs " / " at ".
    const title = String(match?.title || "");
    const parts = title.split(/\s+(?:vs\.?|at|v)\s+/i);
    if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
    return [null, null];
  }

  /**
   * Returns a score entry for a streamed.st match, or null.
   * Orientation is resolved against ESPN's own home/away, so the
   * numbers always follow the names shown on the card.
   */
  async function forMatch(match) {
    const [homeName, awayName] = teamNames(match);
    if (!homeName || !awayName) return null;

    const index = await ensure();
    const entry = index.get(pairKey(homeName, awayName));
    if (!entry) return null;

    // Which of our two names is ESPN's home side?
    const ourHomeIsEspnHome = nickname(homeName) === nickname(entry.home.name);

    return {
      state: entry.state,
      detail: entry.detail,
      completed: entry.completed,
      home: ourHomeIsEspnHome ? entry.home : entry.away,
      away: ourHomeIsEspnHome ? entry.away : entry.home
    };
  }

  window.ECV3Scores = Object.freeze({ forMatch, ensure, nickname });
})();

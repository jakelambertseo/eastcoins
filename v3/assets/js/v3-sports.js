/* ============================================================
   EastCoin V3 — shared sport taxonomy

   Events and the MultiView picker must group and order matches
   identically. Keeping one copy here means a change to the
   running order can't apply in one place and not the other.
   ============================================================ */
(() => {
  "use strict";

  const SPORT_LABELS = {
    "american-football": "🏈 NFL/CFB",
    baseball: "⚾ Baseball",
    fight: "🥊 Fighting",
    basketball: "🏀 Basketball",
    hockey: "🏒 Hockey",
    football: "⚽ Soccer",
    "motor-sports": "🏎 Motorsport",
    tennis: "🎾 Tennis",
    golf: "⛳ Golf",
    cricket: "🏏 Cricket",
    rugby: "🏉 Rugby",
    other: "📺 Other"
  };

  // Fixed running order; anything unlisted sorts after these, and
  // "other" is always last.
  const SPORT_ORDER = ["american-football", "baseball", "fight"];

  // streamed.st files NFL, US college and the CFL under one category with
  // no league field, so the only signal is the teams. The 32 NFL clubs and
  // the nine CFL clubs are enumerable; everything left over is college,
  // which is far too large to list, so it is inferred as neither.
  // Full club names, not nicknames: a Division II "Raiders" or "Rams"
  // must not be filed as the NFL. The provider names NFL clubs in full.
  const NFL_TEAMS = new Set([
    "arizona cardinals", "atlanta falcons", "baltimore ravens", "buffalo bills", "carolina panthers",
    "chicago bears", "cincinnati bengals", "cleveland browns", "dallas cowboys", "denver broncos",
    "detroit lions", "green bay packers", "houston texans", "indianapolis colts", "jacksonville jaguars",
    "kansas city chiefs", "las vegas raiders", "los angeles chargers", "los angeles rams", "miami dolphins",
    "minnesota vikings", "new england patriots", "new orleans saints", "new york giants", "new york jets",
    "philadelphia eagles", "pittsburgh steelers", "san francisco 49ers", "seattle seahawks",
    "tampa bay buccaneers", "tennessee titans", "washington commanders"
  ]);
  const CFL_TEAMS = new Set([
    "argonauts", "tiger-cats", "alouettes", "redblacks", "blue bombers", "roughriders",
    "stampeders", "elks", "lions bc"
  ]);

  function sportKey(match) {
    const raw = String(match?.category || "other").toLowerCase();
    return SPORT_LABELS[raw] ? raw : "other";
  }

  function label(key) {
    return SPORT_LABELS[key] || SPORT_LABELS.other;
  }

  function footballRank(match) {
    const names = [match?.teams?.home?.name, match?.teams?.away?.name, match?.title]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const team of NFL_TEAMS) if (names.includes(team)) return 0;
    for (const team of CFL_TEAMS) if (names.includes(team)) return 2;
    return 1;
  }

  function groupRank(key) {
    if (key === "other") return 900;
    const fixed = SPORT_ORDER.indexOf(key);
    return fixed === -1 ? 100 : fixed;
  }

  function isLive(match) {
    const start = Number(match?.date) || 0;
    if (!start) return Boolean(match?.popular && match?.sources?.length);
    const now = Date.now();
    return now >= start && now - start < 4 * 60 * 60 * 1000;
  }

  function sortWithin(key, list) {
    return [...list].sort((a, b) => {
      if (key === "american-football") {
        const leagueDelta = footballRank(a) - footballRank(b);
        if (leagueDelta) return leagueDelta;
      }
      const liveDelta = Number(isLive(b)) - Number(isLive(a));
      if (liveDelta) return liveDelta;
      return (Number(a.date) || 0) - (Number(b.date) || 0);
    });
  }

  /** Returns [[key, sortedMatches], ...] in the canonical running order. */
  function grouped(matches) {
    const groups = new Map();
    for (const match of matches) {
      const key = sportKey(match);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    }

    return [...groups.entries()]
      .sort((a, b) => {
        const rankDelta = groupRank(a[0]) - groupRank(b[0]);
        if (rankDelta) return rankDelta;
        const aLive = a[1].filter(isLive).length;
        const bLive = b[1].filter(isLive).length;
        if (aLive !== bLive) return bLive - aLive;
        return b[1].length - a[1].length;
      })
      .map(([key, list]) => [key, sortWithin(key, list)]);
  }

  window.ECV3Sports = Object.freeze({
    SPORT_LABELS,
    SPORT_ORDER,
    sportKey,
    label,
    footballRank,
    groupRank,
    isLive,
    sortWithin,
    grouped
  });
})();

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

  /* ---------------------------------------------------------- what is shown at all

     Two cuts, both about the community as it is today (2026-09-12):

       · whole sports nobody here watches are hidden — soccer, motorsport,
         rugby, cricket. Take a key out of HIDDEN_SPORTS to bring one back.
       · college football is Division I only. A Saturday listed hundreds
         of D2/D3 games and buried the ones people wanted. A college game
         stays if either side is an FBS or FCS school (EC_CFB_TEAMS.d1).
         A football listing whose sides do not resolve to ANY college —
         a channel like "NFL Network", a title we cannot read — is left
         alone, because hiding it would hide things that are not D2/D3.

     keep() is applied where matches are loaded (the Sports page, the
     MultiView picker) so every count agrees, and again in grouped() so
     nothing can slip past. */

  const HIDDEN_SPORTS = new Set(["football", "motor-sports", "rugby", "cricket"]);

  let d1Set = null;
  function divisionOne() {
    if (!d1Set && Array.isArray(window.EC_CFB_TEAMS?.d1)) d1Set = new Set(window.EC_CFB_TEAMS.d1);
    return d1Set;
  }

  // Both sides' names, from the team fields or, failing that, the title.
  function sideNames(match) {
    const named = [match?.teams?.home?.name, match?.teams?.away?.name].filter(Boolean);
    if (named.length) return named;
    return String(match?.title || "").split(/\s+(?:at|vs\.?|v)\s+/i).map((s) => s.trim()).filter(Boolean).slice(0, 2);
  }

  function keep(match) {
    const key = sportKey(match);
    if (HIDDEN_SPORTS.has(key)) return false;
    if (key !== "american-football" || footballRank(match) !== 1) return true;
    const resolve = window.ECLogos?.collegeId;
    const d1 = divisionOne();
    if (typeof resolve !== "function" || !d1) return true;   // no table yet: show everything
    const ids = sideNames(match).map((n) => resolve(n)).filter(Boolean);
    if (!ids.length) return true;                            // not a college matchup we can read
    return ids.some((id) => d1.has(id));
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
    for (const match of matches.filter(keep)) {
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

  /* streamed.st sometimes lists one game twice: the full entry (art,
     badges, every server) and a bare copy from a single stream source
     ("golf" for MLB), dated two hours before first pitch and with no art.
     isLive() goes by the date, so the copy read LIVE while the real card
     said SOON. A match is a copy when a fuller match carries every stream
     it has AND is the same game — same teams, or, when either side has no
     team names, a start within three hours. A 24/7 channel shared by two
     different games is therefore never folded. */
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const sourceKey = (s) => `${String(s?.source || "").toLowerCase()}:${String(s?.id ?? "")}`;
  const teamKey = (m) => {
    const names = [m?.teams?.home?.name, m?.teams?.away?.name]
      .map((n) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(Boolean);
    return names.length === 2 ? names.sort().join("|") : "";
  };
  const richness = (m) =>
    (m?.sources?.length || 0) * 4 + (m?.poster ? 2 : 0) + (m?.teams?.home?.badge ? 1 : 0);
  // Strict, so two copies can never each drop the other.
  const fuller = (a, b) =>
    richness(a) > richness(b) || (richness(a) === richness(b) && String(a.id) < String(b.id));

  function sameGame(a, b) {
    const ta = teamKey(a);
    const tb = teamKey(b);
    if (ta && tb) return ta === tb;
    const da = Number(a?.date) || 0;
    const db = Number(b?.date) || 0;
    return Boolean(da && db && Math.abs(da - db) <= THREE_HOURS);
  }

  /** The fuller listing of the same game that carries all of match's streams, or null. */
  function fullerCopy(match, matches) {
    const keys = (match?.sources || []).map(sourceKey);
    if (!keys.length) return null;
    for (const other of matches) {
      if (!other || other === match || other.id === match.id || !fuller(other, match)) continue;
      const has = new Set((other.sources || []).map(sourceKey));
      if (keys.every((k) => has.has(k)) && sameGame(match, other)) return other;
    }
    return null;
  }

  /** The list without bare copies of games already listed in full. */
  function withoutCopies(matches) {
    const list = matches.filter(Boolean);
    return list.filter((m) => !fullerCopy(m, list));
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
    grouped,
    fullerCopy,
    withoutCopies,
    keep,
    HIDDEN_SPORTS
  });
})();

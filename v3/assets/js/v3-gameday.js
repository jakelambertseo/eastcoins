/* ============================================================
   EastCoin V3 — MLB Gameday resolver

   Turns an EastCoin event into an MLB gamePk so the existing
   /mlb-gameday.html page can be embedded against it. That page
   is unchanged and does all the real work; this only answers
   "which MLB game is this card?".

   The matching is deliberately strict. A wrong answer here
   shows somebody a completely different baseball game while
   they think they are watching this one, so both teams have to
   agree before it will claim a match — which is also what keeps
   college and minor-league cards from resolving to an MLB game
   that happens to share a nickname.

   Ported from v2/assets/js/mlb-gameday.js rather than shared
   with it: that version is welded to window.ECV2 and the V2
   watch DOM. When V3 replaces V2 this becomes the only copy.
   ============================================================ */
(() => {
  "use strict";

  const CACHE_PREFIX = "ecV3MlbGame:";
  const TIMEOUT_MS = 6000;

  // Below this, refuse. Both teams must broadly agree; a single
  // strong side is not enough, because "Athletics" alone matches
  // several things across levels of baseball.
  const MIN_CONFIDENCE = 0.72;
  const GOOD_ENOUGH = 0.91;

  /* ---------------------------------------------------------- dates */

  function dateKey(value) {
    const timestamp = Number(new Date(value || Date.now()).getTime()) || Date.now();
    const date = new Date(timestamp);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function addDays(key, amount) {
    const [year, month, day] = key.split("-").map(Number);
    // Noon avoids a DST shift moving the result to the wrong day.
    const date = new Date(year, month - 1, day + amount, 12, 0, 0);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  /* ---------------------------------------------------------- names */

  function normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\bthe\b/g, " ")
      .replace(/\bd-backs\b/g, "diamondbacks")
      .replace(/\ba's\b/g, "athletics")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nameTokens(value) {
    return normalizeName(value)
      .split(" ")
      .filter((token) => token.length > 1 && !["baseball", "club", "team"].includes(token));
  }

  function teamScore(left, right) {
    const a = normalizeName(left);
    const b = normalizeName(right);

    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.94;

    const aa = new Set(nameTokens(a));
    const bb = new Set(nameTokens(b));
    if (!aa.size || !bb.size) return 0;

    let intersection = 0;
    aa.forEach((token) => { if (bb.has(token)) intersection += 1; });

    const union = new Set([...aa, ...bb]).size;
    let score = union ? intersection / union : 0;

    // Nicknames carry most of the identity: "Blue Jays" against
    // "Toronto Blue Jays" should not be punished for the city.
    const aLast = Array.from(aa).at(-1);
    const bLast = Array.from(bb).at(-1);
    if (aLast && bLast && aLast === bLast) score = Math.max(score, 0.78);

    return score;
  }

  function teamsOf(match) {
    return {
      away: match?.teams?.away?.name || "",
      home: match?.teams?.home?.name || ""
    };
  }

  function pairScore(match, game) {
    const { away: eventAway, home: eventHome } = teamsOf(match);
    const gameAway = game?.teams?.away?.team?.name || "";
    const gameHome = game?.teams?.home?.team?.name || "";
    if (!eventAway || !eventHome || !gameAway || !gameHome) return 0;

    const direct = (teamScore(eventAway, gameAway) + teamScore(eventHome, gameHome)) / 2;
    // Home/away swapped still identifies the fixture, but is discounted:
    // if the sides disagree, one of the two sources has it wrong.
    const reversed = (teamScore(eventAway, gameHome) + teamScore(eventHome, gameAway)) / 2;
    return Math.max(direct, reversed * 0.94);
  }

  function eligible(match) {
    const Sports = window.ECV3Sports;
    if (!match || !Sports) return false;
    if (Sports.sportKey(match) !== "baseball") return false;
    const { away, home } = teamsOf(match);
    return Boolean(away && home);
  }

  /* ---------------------------------------------------------- cache */

  function readCached(id) {
    try {
      const value = JSON.parse(sessionStorage.getItem(CACHE_PREFIX + id) || "null");
      return value?.gamePk && value?.date ? value : null;
    } catch {
      return null;
    }
  }

  function writeCached(id, value) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + id, JSON.stringify(value));
    } catch {
      /* blocked storage just means we resolve again next time */
    }
  }

  /* ---------------------------------------------------------- schedule */

  async function fetchSchedule(key) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
      url.searchParams.set("sportId", "1");
      url.searchParams.set("date", key);
      url.searchParams.set("hydrate", "team");

      const response = await fetch(url.href, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`MLB schedule returned ${response.status}.`);
      const payload = await response.json();
      return payload?.dates?.[0]?.games || [];
    } finally {
      window.clearTimeout(timer);
    }
  }

  /**
   * Resolves a match to { gamePk, date, away, home }, or null when it
   * cannot say confidently. Null always means "don't offer Gameday"
   * rather than "try harder" — a wrong game is worse than no button.
   */
  async function resolve(match) {
    if (!eligible(match)) return null;

    const id = String(match?.id || "");
    const cached = id ? readCached(id) : null;
    if (cached) return cached;

    // Neighbouring days too: a late start crosses midnight in one
    // timezone or the other, and the provider and MLB rarely agree
    // about which day that is.
    const base = dateKey(match?.date);
    let best = null;

    for (const key of [base, addDays(base, -1), addDays(base, 1)]) {
      let games = [];
      try {
        games = await fetchSchedule(key);
      } catch {
        continue;
      }

      for (const game of games) {
        const score = pairScore(match, game);
        if (!best || score > best.score) {
          best = {
            gamePk: Number(game.gamePk),
            date: key,
            score,
            away: game?.teams?.away?.team?.name || "",
            home: game?.teams?.home?.team?.name || ""
          };
        }
      }

      if (best?.score >= GOOD_ENOUGH) break;
    }

    if (!best?.gamePk || best.score < MIN_CONFIDENCE) return null;
    if (id) writeCached(id, best);
    return best;
  }

  /**
   * The same-origin Gameday page, pointed at a resolved game.
   *
   * Extensionless: Pages canonicalises /mlb-gameday.html to this with a
   * 308, and an iframe would follow it every single time the panel opens.
   */
  function gamedayUrl(game) {
    const url = new URL("/mlb-gameday", location.origin);
    url.searchParams.set("embed", "1");
    url.searchParams.set("gamePk", String(game.gamePk));
    url.searchParams.set("date", game.date);
    return url.href;
  }

  window.ECV3Gameday = Object.freeze({ eligible, resolve, gamedayUrl });
})();

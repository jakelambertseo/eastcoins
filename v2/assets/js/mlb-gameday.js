(() => {
  "use strict";

  const V2 = window.ECV2;
  const button = document.querySelector("#watchGameday");
  const surface = document.querySelector(".watch-surface");

  if (!V2 || !button || !surface) {
    return;
  }

  const CACHE_PREFIX = "eastcoinMlbGameResolutionV2:";
  const REQUEST_TIMEOUT_MS = 6000;

  let resolutionSerial = 0;
  let resolvedGame = null;
  let currentMatchId = "";
  let frameLoadTimer = 0;

  const overlay = document.createElement("section");
  overlay.id = "ecMlbGamedayOverlay";
  overlay.className = "ec-v2-mlb-gameday";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-label", "MLB Gameday");
  overlay.innerHTML = `
    <div class="ec-v2-mlb-gameday-loading" data-gameday-loading>
      <span class="ec-v2-mlb-gameday-spinner" aria-hidden="true"></span>
      <strong>Opening MLB Gameday</strong>
      <small>Loading live MLB game data…</small>
    </div>
    <button
      class="ec-v2-mlb-gameday-close"
      type="button"
      data-gameday-close
      aria-label="Close MLB Gameday">×</button>
    <iframe
      class="ec-v2-mlb-gameday-frame"
      title="EastCoin MLB Gameday"
      src="about:blank"
      allow="fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"></iframe>
  `;

  surface.appendChild(overlay);

  const frame = overlay.querySelector(".ec-v2-mlb-gameday-frame");
  const closeButton = overlay.querySelector("[data-gameday-close]");
  const loading = overlay.querySelector("[data-gameday-loading]");

  function matchId(match) {
    return V2.id(match);
  }

  function eventDateKey(value) {
    const timestamp = V2.ts(value) || Date.now();
    const date = new Date(timestamp);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function addDays(dateKey, amount) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day + amount, 12, 0, 0);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

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
    aa.forEach((token) => {
      if (bb.has(token)) intersection += 1;
    });

    const union = new Set([...aa, ...bb]).size;
    let score = union ? intersection / union : 0;

    const aLast = Array.from(aa).at(-1);
    const bLast = Array.from(bb).at(-1);

    if (aLast && bLast && aLast === bLast) {
      score = Math.max(score, 0.78);
    }

    return score;
  }

  function looksLikeBaseball(match) {
    if (!match || V2.family(match) !== "baseball") {
      return false;
    }

    return Boolean(
      match?.teams?.away?.name &&
      match?.teams?.home?.name
    );
  }

  function pairScore(match, game) {
    const eventAway = match?.teams?.away?.name || "";
    const eventHome = match?.teams?.home?.name || "";
    const gameAway = game?.teams?.away?.team?.name || "";
    const gameHome = game?.teams?.home?.team?.name || "";

    if (!eventAway || !eventHome || !gameAway || !gameHome) {
      return 0;
    }

    const direct = (
      teamScore(eventAway, gameAway) +
      teamScore(eventHome, gameHome)
    ) / 2;

    const reversed = (
      teamScore(eventAway, gameHome) +
      teamScore(eventHome, gameAway)
    ) / 2;

    return Math.max(direct, reversed * 0.94);
  }

  function cacheKey(id) {
    return `${CACHE_PREFIX}${String(id || "")}`;
  }

  function readCached(id) {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey(id)) || "null");
      return value?.gamePk && value?.date ? value : null;
    } catch {
      return null;
    }
  }

  function writeCached(id, value) {
    try {
      sessionStorage.setItem(cacheKey(id), JSON.stringify(value));
    } catch {}
  }

  async function fetchSchedule(dateKey) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
      url.searchParams.set("sportId", "1");
      url.searchParams.set("date", dateKey);
      url.searchParams.set("hydrate", "team");

      const response = await fetch(url.href, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`MLB schedule returned ${response.status}.`);
      }

      const payload = await response.json();
      return payload?.dates?.[0]?.games || [];
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function resolve(match, serial) {
    if (!looksLikeBaseball(match)) return null;

    const id = matchId(match);
    const cached = readCached(id);
    if (cached) return cached;

    const baseDate = eventDateKey(match.date);
    const dates = [baseDate, addDays(baseDate, -1), addDays(baseDate, 1)];
    let best = null;

    for (const dateKey of dates) {
      if (serial !== resolutionSerial) return null;

      let games = [];
      try {
        games = await fetchSchedule(dateKey);
      } catch {
        continue;
      }

      for (const game of games) {
        const score = pairScore(match, game);
        if (!best || score > best.score) {
          best = {
            gamePk: Number(game.gamePk),
            date: dateKey,
            score,
            away: game?.teams?.away?.team?.name || "",
            home: game?.teams?.home?.team?.name || ""
          };
        }
      }

      if (best?.score >= 0.91) break;
    }

    // Requiring both teams to match protects college/minor-league baseball cards.
    if (!best?.gamePk || best.score < 0.72) {
      return null;
    }

    writeCached(id, best);
    return best;
  }

  function resetLoadingCopy() {
    if (!loading) return;
    const strong = loading.querySelector("strong");
    const small = loading.querySelector("small");
    if (strong) strong.textContent = "Opening MLB Gameday";
    if (small) small.textContent = "Loading live MLB game data…";
  }

  function close() {
    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = 0;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.classList.remove("is-ready", "is-slow");
    button.classList.remove("active");
    button.setAttribute("aria-expanded", "false");
    resetLoadingCopy();

    window.setTimeout(() => {
      if (overlay.hidden) frame.src = "about:blank";
    }, 160);
  }

  function open() {
    if (!resolvedGame?.gamePk) return;

    const url = new URL("/mlb-gameday.html", window.location.origin);
    url.searchParams.set("embed", "1");
    url.searchParams.set("gamePk", String(resolvedGame.gamePk));
    url.searchParams.set("date", resolvedGame.date);

    overlay.classList.remove("is-ready", "is-slow");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    button.classList.add("active");
    button.setAttribute("aria-expanded", "true");
    frame.src = url.href;

    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = window.setTimeout(() => {
      if (overlay.hidden || overlay.classList.contains("is-ready")) return;
      overlay.classList.add("is-slow");
      const strong = loading?.querySelector("strong");
      const small = loading?.querySelector("small");
      if (strong) strong.textContent = "Gameday is taking longer than expected";
      if (small) small.textContent = "The player is still waiting for MLB game data.";
    }, 8000);
  }

  function hideButton() {
    button.hidden = true;
    button.removeAttribute("data-game-pk");
  }

  async function sync(match) {
    const id = match ? matchId(match) : "";
    const serial = ++resolutionSerial;
    currentMatchId = id;
    resolvedGame = null;
    hideButton();
    close();

    if (!looksLikeBaseball(match)) return;

    const result = await resolve(match, serial);
    if (serial !== resolutionSerial || currentMatchId !== id || !result) return;

    resolvedGame = result;
    button.dataset.gamePk = String(result.gamePk);
    button.hidden = false;
  }

  function reset() {
    ++resolutionSerial;
    currentMatchId = "";
    resolvedGame = null;
    hideButton();
    close();
  }

  button.hidden = true;
  button.setAttribute("aria-expanded", "false");

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (overlay.hidden) open();
    else close();
  });

  closeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  });

  frame.addEventListener("load", () => {
    if (overlay.hidden || frame.src === "about:blank") return;
    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = 0;
    overlay.classList.add("is-ready");
    overlay.classList.remove("is-slow");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      event.preventDefault();
      close();
    }
  }, true);

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "eastcoin:mlb-gameday-close") close();
  });

  V2.mlbGameday = {
    sync,
    reset,
    open,
    close
  };
})();

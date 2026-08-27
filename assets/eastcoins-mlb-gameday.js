(() => {
  "use strict";

  if (
    new URLSearchParams(
      window.location.search
    ).get("multiview") === "1"
  ) {
    return;
  }

  const BUTTON_ID = "eastcoinMlbGamedayButton";
  const OVERLAY_ID = "eastcoinMlbGamedayOverlay";
  const CACHE_PREFIX = "eastcoinMlbGameResolutionV1:";
  const CHECK_INTERVAL_MS = 650;
  const REQUEST_TIMEOUT_MS = 6000;

  const toolbarActions =
    document.querySelector(".player-toolbar .toolbar-actions");
  const playerShell =
    document.getElementById("playerShell");

  if (!toolbarActions || !playerShell) {
    return;
  }

  const button = document.createElement("button");
  button.className =
    "toolbar-button ec-mlb-gameday-button";
  button.id = BUTTON_ID;
  button.type = "button";
  button.hidden = true;
  button.textContent = "⚾ Gameday";
  button.setAttribute(
    "aria-label",
    "Open MLB Gameday"
  );

  const shareButton =
    document.getElementById("shareButton");

  if (shareButton) {
    toolbarActions.insertBefore(
      button,
      shareButton
    );
  } else {
    toolbarActions.append(button);
  }

  const overlay = document.createElement("section");
  overlay.id = OVERLAY_ID;
  overlay.className = "ec-mlb-gameday-overlay";
  overlay.hidden = true;
  overlay.setAttribute(
    "aria-label",
    "MLB Gameday"
  );
  overlay.setAttribute(
    "aria-hidden",
    "true"
  );

  overlay.innerHTML = `
    <div
      class="ec-mlb-gameday-loading"
      data-mlb-gameday-loading>
      <span class="ec-mlb-gameday-spinner" aria-hidden="true"></span>
      <strong>Opening MLB Game Center</strong>
      <small>Loading live Gameday data…</small>
    </div>

    <button
      class="ec-mlb-gameday-close"
      type="button"
      data-mlb-gameday-close
      aria-label="Close MLB Gameday">
      ×
    </button>

    <iframe
      class="ec-mlb-gameday-frame"
      title="EastCoin MLB Game Center"
      src="about:blank"
      allow="fullscreen"
      referrerpolicy="strict-origin-when-cross-origin">
    </iframe>
  `;

  /*
    Production player.html runs inside the persistent EastCoin center frame.
    Mount the Gameday surface at document.body instead of inside playerShell
    so player-shell overflow/stacking rules cannot hide the overlay.
  */
  document.body.append(overlay);

  const frame = overlay.querySelector(
    ".ec-mlb-gameday-frame"
  );
  const overlayClose = overlay.querySelector(
    "[data-mlb-gameday-close]"
  );
  const overlayLoading = overlay.querySelector(
    "[data-mlb-gameday-loading]"
  );

  let frameLoadTimer = 0;

  let lastStateKey = "";
  let resolutionSerial = 0;
  let resolvedGame = null;

  function eventDateKey(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());

    if (Number.isNaN(date.getTime())) {
      return new Date()
        .toISOString()
        .slice(0, 10);
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1)
        .padStart(2, "0"),
      String(date.getDate())
        .padStart(2, "0")
    ].join("-");
  }

  function addDays(dateKey, amount) {
    const [year, month, day] =
      dateKey.split("-").map(Number);
    const date = new Date(
      year,
      month - 1,
      day + amount,
      12,
      0,
      0
    );

    return [
      date.getFullYear(),
      String(date.getMonth() + 1)
        .padStart(2, "0"),
      String(date.getDate())
        .padStart(2, "0")
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
      .replace(/\bsox\b/g, "sox")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nameTokens(value) {
    return normalizeName(value)
      .split(" ")
      .filter(
        (token) =>
          token.length > 1 &&
          ![
            "baseball",
            "club",
            "team"
          ].includes(token)
      );
  }

  function teamScore(left, right) {
    const a = normalizeName(left);
    const b = normalizeName(right);

    if (!a || !b) {
      return 0;
    }

    if (a === b) {
      return 1;
    }

    if (
      a.includes(b) ||
      b.includes(a)
    ) {
      return 0.94;
    }

    const aa = new Set(nameTokens(a));
    const bb = new Set(nameTokens(b));

    if (!aa.size || !bb.size) {
      return 0;
    }

    let intersection = 0;

    aa.forEach((token) => {
      if (bb.has(token)) {
        intersection += 1;
      }
    });

    const union =
      new Set([...aa, ...bb]).size;

    let score =
      union
        ? intersection / union
        : 0;

    const aLast =
      Array.from(aa).at(-1);
    const bLast =
      Array.from(bb).at(-1);

    if (
      aLast &&
      bLast &&
      aLast === bLast
    ) {
      score = Math.max(score, 0.78);
    }

    return score;
  }

  function categoryLooksBaseball(event) {
    const category = String(
      event?.category || ""
    ).toLowerCase();

    return (
      category.includes("baseball") ||
      category.includes("mlb")
    );
  }

  function pairScore(event, game) {
    const eventHome =
      event?.home?.name || "";
    const eventAway =
      event?.away?.name || "";

    const gameHome =
      game?.teams?.home?.team?.name || "";
    const gameAway =
      game?.teams?.away?.team?.name || "";

    if (
      eventHome &&
      eventAway
    ) {
      const direct =
        (
          teamScore(
            eventHome,
            gameHome
          ) +
          teamScore(
            eventAway,
            gameAway
          )
        ) / 2;

      const reversed =
        (
          teamScore(
            eventHome,
            gameAway
          ) +
          teamScore(
            eventAway,
            gameHome
          )
        ) / 2;

      return Math.max(
        direct,
        reversed * 0.94
      );
    }

    const title =
      normalizeName(
        event?.title || ""
      );

    if (!title) {
      return 0;
    }

    const homeScore =
      teamScore(title, gameHome);
    const awayScore =
      teamScore(title, gameAway);

    return (
      homeScore &&
      awayScore
        ? (homeScore + awayScore) / 2
        : 0
    );
  }

  function cacheKey(matchId) {
    return (
      CACHE_PREFIX +
      String(matchId || "")
    );
  }

  function readCached(matchId) {
    try {
      const parsed = JSON.parse(
        sessionStorage.getItem(
          cacheKey(matchId)
        ) || "null"
      );

      if (
        parsed?.gamePk &&
        parsed?.date
      ) {
        return parsed;
      }
    } catch {}

    return null;
  }

  function writeCached(
    matchId,
    result
  ) {
    try {
      sessionStorage.setItem(
        cacheKey(matchId),
        JSON.stringify(result)
      );
    } catch {}
  }

  async function fetchSchedule(dateKey) {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

    try {
      const url = new URL(
        "https://statsapi.mlb.com/api/v1/schedule"
      );

      url.searchParams.set(
        "sportId",
        "1"
      );
      url.searchParams.set(
        "date",
        dateKey
      );
      url.searchParams.set(
        "hydrate",
        "team"
      );

      const response = await fetch(
        url.href,
        {
          headers: {
            Accept:
              "application/json"
          },
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `MLB schedule returned ${response.status}.`
        );
      }

      const payload =
        await response.json();

      return (
        payload?.dates?.[0]
          ?.games || []
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function resolveMlbGame(
    state,
    serial
  ) {
    const event =
      state?.event || null;

    if (
      !state?.matchId ||
      !event ||
      !categoryLooksBaseball(event)
    ) {
      return null;
    }

    const cached =
      readCached(
        state.matchId
      );

    if (cached) {
      return cached;
    }

    const baseDate =
      eventDateKey(event.date);

    const dates = [
      baseDate,
      addDays(baseDate, -1),
      addDays(baseDate, 1)
    ];

    let best = null;

    for (const dateKey of dates) {
      if (
        serial !==
        resolutionSerial
      ) {
        return null;
      }

      let games;

      try {
        games =
          await fetchSchedule(
            dateKey
          );
      } catch {
        continue;
      }

      for (const game of games) {
        const score =
          pairScore(
            event,
            game
          );

        if (
          !best ||
          score > best.score
        ) {
          best = {
            gamePk:
              Number(
                game.gamePk
              ),
            date: dateKey,
            score,
            home:
              game.teams?.home
                ?.team?.name || "",
            away:
              game.teams?.away
                ?.team?.name || ""
          };
        }
      }

      if (
        best?.score >= 0.91
      ) {
        break;
      }
    }

    /*
      Requiring both teams to match strongly is what prevents
      non-MLB baseball events from receiving a Gameday button.
    */
    if (
      !best?.gamePk ||
      best.score < 0.72
    ) {
      return null;
    }

    writeCached(
      state.matchId,
      best
    );

    return best;
  }

  function hideButton() {
    button.hidden = true;
    button.removeAttribute(
      "data-game-pk"
    );
    resolvedGame = null;
  }

  function closeGameday() {
    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = 0;

    overlay.hidden = true;
    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
    overlay.classList.remove(
      "is-ready",
      "is-slow"
    );
    document.body.classList.remove(
      "ec-mlb-gameday-open"
    );

    if (overlayLoading) {
      overlayLoading.querySelector("strong").textContent =
        "Opening MLB Game Center";
      overlayLoading.querySelector("small").textContent =
        "Loading live Gameday data…";
    }

    button.classList.remove(
      "active"
    );
    button.setAttribute(
      "aria-expanded",
      "false"
    );

    /*
      Blank only the Game Center iframe. The actual video iframe remains
      mounted and untouched behind this fixed overlay.
    */
    window.setTimeout(() => {
      if (overlay.hidden) {
        frame.src = "about:blank";
      }
    }, 180);
  }

  function openGameday() {
    if (!resolvedGame?.gamePk) {
      return;
    }

    const url = new URL(
      "mlb-gameday.html",
      window.location.href
    );

    url.searchParams.set(
      "embed",
      "1"
    );
    url.searchParams.set(
      "gamePk",
      String(
        resolvedGame.gamePk
      )
    );
    url.searchParams.set(
      "date",
      resolvedGame.date
    );

    /*
      Make the overlay visible BEFORE navigating the child iframe. This
      guarantees immediate visual feedback from the click even if the
      Game Center document or MLB API takes a moment to respond.
    */
    overlay.classList.remove(
      "is-ready",
      "is-slow"
    );
    overlay.hidden = false;
    overlay.setAttribute(
      "aria-hidden",
      "false"
    );
    document.body.classList.add(
      "ec-mlb-gameday-open"
    );

    button.classList.add(
      "active"
    );
    button.setAttribute(
      "aria-expanded",
      "true"
    );

    frame.src = url.href;

    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = window.setTimeout(() => {
      if (!overlay.hidden && !overlay.classList.contains("is-ready")) {
        overlay.classList.add("is-slow");

        if (overlayLoading) {
          overlayLoading.querySelector("strong").textContent =
            "Game Center is taking longer than expected";
          overlayLoading.querySelector("small").textContent =
            "The overlay opened correctly; waiting for the Gameday document.";
        }
      }
    }, 8000);
  }

  button.setAttribute(
    "aria-expanded",
    "false"
  );

  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (overlay.hidden) {
        openGameday();
      } else {
        closeGameday();
      }
    },
    true
  );

  overlayClose?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeGameday();
    }
  );

  frame.addEventListener(
    "load",
    () => {
      if (overlay.hidden || frame.src === "about:blank") {
        return;
      }

      window.clearTimeout(frameLoadTimer);
      frameLoadTimer = 0;
      overlay.classList.add("is-ready");
      overlay.classList.remove("is-slow");
    }
  );

  window.addEventListener(
    "message",
    (event) => {
      if (
        event.origin !==
        window.location.origin
      ) {
        return;
      }

      if (
        event.data?.type ===
        "eastcoin:mlb-gameday-close"
      ) {
        closeGameday();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !overlay.hidden
      ) {
        event.preventDefault();
        closeGameday();
      }
    },
    true
  );

  async function sync() {
    const state =
      window.eastcoinStreamedState;

    const stateKey = state?.matchId
      ? [
          state.matchId,
          state.event?.category || "",
          state.event?.date || ""
        ].join("|")
      : "";

    if (
      stateKey ===
      lastStateKey
    ) {
      return;
    }

    lastStateKey =
      stateKey;

    if (!stateKey) {
      hideButton();
      closeGameday();
      return;
    }

    hideButton();

    const event =
      state?.event;

    if (
      !categoryLooksBaseball(
        event
      )
    ) {
      closeGameday();
      return;
    }

    const serial =
      ++resolutionSerial;

    const result =
      await resolveMlbGame(
        state,
        serial
      );

    if (
      serial !==
      resolutionSerial
    ) {
      return;
    }

    if (!result) {
      hideButton();
      return;
    }

    resolvedGame =
      result;

    button.dataset.gamePk =
      String(result.gamePk);

    button.hidden = false;
  }

  window.setInterval(
    sync,
    CHECK_INTERVAL_MS
  );

  sync();
})();

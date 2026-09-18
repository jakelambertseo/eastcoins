(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;
  const E = V2.els;
  const $ = V2.$;
  const $$ = V2.$$;

  let extendedCatalogReady = false;
  let extendedCatalogPromise = null;
  let allowExtendedCatalog = false;

  const NFL_TEAMS = new Set([
    "arizona cardinals",
    "atlanta falcons",
    "baltimore ravens",
    "buffalo bills",
    "carolina panthers",
    "chicago bears",
    "cincinnati bengals",
    "cleveland browns",
    "dallas cowboys",
    "denver broncos",
    "detroit lions",
    "green bay packers",
    "houston texans",
    "indianapolis colts",
    "jacksonville jaguars",
    "kansas city chiefs",
    "las vegas raiders",
    "los angeles chargers",
    "los angeles rams",
    "miami dolphins",
    "minnesota vikings",
    "new england patriots",
    "new orleans saints",
    "new york giants",
    "new york jets",
    "philadelphia eagles",
    "pittsburgh steelers",
    "san francisco 49ers",
    "seattle seahawks",
    "tampa bay buccaneers",
    "tennessee titans",
    "washington commanders"
  ]);

  function normalizeTeam(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isNflEvent(match) {
    return (
      NFL_TEAMS.has(
        normalizeTeam(
          match?.teams?.away?.name
        )
      ) &&
      NFL_TEAMS.has(
        normalizeTeam(
          match?.teams?.home?.name
        )
      )
    );
  }

  function installStartupStyles() {
    if (
      document.getElementById(
        "eastcoinPerformanceV51"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "eastcoinPerformanceV51";

    style.textContent = `
      .dates{
        display:none!important;
      }

      #grid:empty{
        position:relative;
        min-height:clamp(300px,44vh,520px);
      }

      #grid:empty::before{
        content:"Loading events…";
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        color:#6f7480;
        font-size:.78rem;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .chatdefer{
        position:absolute;
        inset:0;
        z-index:2;
        display:grid;
        place-content:center;
        justify-items:center;
        gap:7px;
        padding:24px;
        color:#8f95a0;
        background:
          radial-gradient(
            circle at 50% 42%,
            rgba(145,70,255,.08),
            transparent 36%
          ),
          #050505;
        text-align:center;
        pointer-events:none;
      }

      .chatdefer[hidden]{
        display:none!important;
      }

      .chatdefer span{
        color:#a970ff;
        font-size:1.55rem;
        line-height:1;
      }

      .chatdefer strong{
        color:#d9dce2;
        font-size:.82rem;
      }

      .chatdefer small{
        max-width:180px;
        color:#676c75;
        font-size:.68rem;
        line-height:1.45;
      }

      @media(max-width:900px){
        #grid:empty{
          min-height:280px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function installDeferredExtendedCatalog() {
    const api =
      window.EastcoinStreamedAPI;

    if (
      !api ||
      api.__eastcoinStartup50
    ) {
      return;
    }

    const wrapped = {
      ...api,
      __eastcoinStartup50:
        true,

      async getAll(
        force = false
      ) {
        /*
          Initial Events paint only needs Live + Today. Return a lightweight
          empty extended result until Search, Upcoming or Saved explicitly
          asks for the seven-day catalog.
        */
        if (
          !allowExtendedCatalog &&
          !force
        ) {
          return {
            data: [],
            savedAt: Date.now(),
            fromCache: true,
            stale: false,
            error: null
          };
        }

        return api.getAll(
          force
        );
      }
    };

    window.EastcoinStreamedAPI =
      Object.freeze(
        wrapped
      );
  }

  function ensureExtendedEvents() {
    if (
      extendedCatalogReady
    ) {
      return Promise.resolve();
    }

    if (
      extendedCatalogPromise
    ) {
      return extendedCatalogPromise;
    }

    allowExtendedCatalog = true;

    extendedCatalogPromise =
      Promise.resolve()
        .then(
          () =>
            V2.events.load(
              false
            )
        )
        .then(
          () => {
            extendedCatalogReady =
              true;
          }
        )
        .catch(
          (error) => {
            console.warn(
              "EastCoin extended event catalog unavailable",
              error
            );
          }
        )
        .finally(
          () => {
            extendedCatalogPromise =
              null;
          }
        );

    return extendedCatalogPromise;
  }

  function installNflOnlyCardOdds() {
    const cardOdds =
      V2.cardOdds;

    if (
      !cardOdds?.refresh ||
      cardOdds.__eastcoinNflOnly50
    ) {
      return;
    }

    const originalRefresh =
      cardOdds.refresh.bind(
        cardOdds
      );

    cardOdds.refresh =
      (
        events =
          S.events
      ) => {
        const eligible =
          (
            Array.isArray(events)
              ? events
              : []
          ).filter(
            (match) => {
              if (
                V2.family(match) !==
                "american-football"
              ) {
                return true;
              }

              return isNflEvent(
                match
              );
            }
          );

        return originalRefresh(
          eligible
        );
      };

    cardOdds.__eastcoinNflOnly50 =
      true;
  }

  function setupDeferredChat() {
    const frame =
      document.getElementById(
        "persistentTwitchChat"
      );

    if (
      !frame ||
      !frame.dataset.src
    ) {
      return;
    }

    let placeholder =
      document.getElementById(
        "chatDefer"
      );

    if (!placeholder) {
      placeholder =
        document.createElement(
          "div"
        );

      placeholder.id =
        "chatDefer";

      placeholder.className =
        "chatdefer";

      placeholder.setAttribute(
        "role",
        "status"
      );

      placeholder.setAttribute(
        "aria-live",
        "polite"
      );

      placeholder.innerHTML = `
        <span aria-hidden="true">◫</span>
        <strong>Twitch Chat</strong>
        <small>Loads when you interact with EastCoin.</small>
      `;

      E.chat.prepend(
        placeholder
      );
    }

    const realOpenChat =
      V2.player.openChat.bind(
        V2.player
      );

    const interactionEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel"
    ];

    let mounted =
      frame.getAttribute(
        "src"
      ) !== "about:blank";

    function cleanup() {
      interactionEvents.forEach(
        (name) =>
          window.removeEventListener(
            name,
            openNow,
            true
          )
      );
    }

    function openNow() {
      if (!mounted) {
        mounted = true;
        cleanup();
      }

      placeholder.hidden =
        true;

      return realOpenChat();
    }

    /*
      Settings, Quick Chat and other modules call V2.player.openChat dynamically.
      Point them at the wrapper so the placeholder always clears correctly.
    */
    V2.player.openChat =
      openNow;

    const params =
      new URLSearchParams(
        window.location.search
      );

    const directWatch =
      params.has("event") ||
      params.has("watch") ||
      document.body.classList.contains(
        "ec-watching"
      );

    if (
      directWatch &&
      V2.state.settings.chatVisible
    ) {
      V2.idle(
        openNow,
        0
      );

      return;
    }

    if (
      !V2.state.settings.chatVisible
    ) {
      placeholder.hidden =
        true;

      return;
    }

    interactionEvents.forEach(
      (name) =>
        window.addEventListener(
          name,
          openNow,
          {
            capture: true,
            passive: true,
            once: false
          }
        )
    );
  }

  function clearFilters() {
    S.sport = "all";
    S.date = "today";
    S.status = "all";
    S.search = "";
    E.search.value = "";

    if (V2.router?.current() !== "events") {
      V2.router.go("events");
    }

    $$("[data-sport]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sport === "all");
    });
    E.sportMoreBtn.classList.remove("active");
    E.sportMoreMenu.hidden = true;
    E.sportMoreBtn.setAttribute("aria-expanded", "false");

    $$("[data-status]").forEach((button) => {
      button.classList.toggle("active", button.dataset.status === "all");
    });

    V2.events.renderDates();
    V2.events.renderGrid();
  }

  function positionSportMoreMenu() {
    const rect = E.sportMoreBtn.getBoundingClientRect();
    const menuWidth = 170;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    E.sportMoreMenu.style.left = `${left}px`;
    E.sportMoreMenu.style.top = `${rect.bottom + 5}px`;
  }

  function wire() {
    $$("[data-sport]").forEach((button) => {
      button.onclick = () => {
        S.sport = button.dataset.sport;

        if (V2.router?.current() !== "events") {
          V2.router.go("events");
        }

        $$("[data-sport]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        E.sportMoreBtn.classList.toggle(
          "active",
          ["hockey", "tennis", "other"].includes(S.sport)
        );
        E.sportMoreMenu.hidden = true;
        E.sportMoreBtn.setAttribute("aria-expanded", "false");

        V2.events.renderGrid();
      };
    });

    $$("[data-status]").forEach((button) => {
      button.onclick = () => {
        S.status = button.dataset.status;

        $$("[data-status]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        if (
          S.status === "upcoming" ||
          S.status === "saved"
        ) {
          S.date = "week";
          V2.events.renderDates();
          ensureExtendedEvents();
        }

        V2.events.renderGrid();
      };
    });

    E.search.oninput = () => {
      S.search = E.search.value.trim().toLowerCase();

      if (S.search) {
        if (V2.router?.current() !== "events") {
          V2.router.go("events");
        }
        S.date = "week";
        V2.events.renderDates();
        ensureExtendedEvents();
      }

      V2.events.renderGrid();
    };

    E.search.onkeydown = (event) => {
      if (event.key !== "Enter") return;

      const raw = E.search.value.trim();
      if (!raw) return;

      try {
        const url = new URL(raw);
        if (["http:", "https:"].includes(url.protocol)) {
          event.preventDefault();
          E.search.value = "";
          S.search = "";
          V2.player.openCustom(url.href);
          return;
        }
      } catch {
        // Continue below as a normal EastCoin event search.
      }

      event.preventDefault();

      if (
        document.body.classList.contains(
          "ec-watching"
        )
      ) {
        V2.player.closePlayer({
          clearUrl: true
        });
      }

      if (
        V2.router?.current() !==
        "events"
      ) {
        V2.router.go("events");
      }

      S.search =
        raw.toLowerCase();
      S.date = "week";

      V2.events.renderDates();
      ensureExtendedEvents();
      V2.events.renderGrid();

      E.search.blur();
    };

    $("#clear").onclick = clearFilters;

    E.sort.onclick = () => {
      S.sort = S.sort === "recommended" ? "time" : "recommended";
      E.sort.textContent =
        S.sort === "recommended"
          ? "Sort: Recommended ▾"
          : "Sort: Time ▾";
      V2.events.renderGrid();
    };

    E.sportMoreBtn.onclick = (event) => {
      event.stopPropagation();
      const opening = E.sportMoreMenu.hidden;
      if (opening) positionSportMoreMenu();
      E.sportMoreMenu.hidden = !opening;
      E.sportMoreBtn.setAttribute("aria-expanded", String(opening));
    };

    window.addEventListener("resize", () => {
      if (!E.sportMoreMenu.hidden) positionSportMoreMenu();
    });

    document.addEventListener("click", (event) => {
      if (
        !E.sportMoreMenu.hidden &&
        !E.sportMoreMenu.contains(event.target) &&
        event.target !== E.sportMoreBtn
      ) {
        E.sportMoreMenu.hidden = true;
        E.sportMoreBtn.setAttribute("aria-expanded", "false");
      }
    });

    $("#quickChat").onclick = V2.player.openChat;
    $("#closePlayer").onclick = V2.player.closePlayer;

    E.player.onclick = (event) => {
      if (event.target === E.player) V2.player.closePlayer();
    };

    E.saveActive.onclick = () => {
      if (S.active) V2.events.toggleFavorite(V2.id(S.active));
    };

    const closeCustom = () => V2.player.closeModal(E.custom);

    $("#closeCustom").onclick = closeCustom;
    $("#cancelCustom").onclick = closeCustom;

    E.custom.onclick = (event) => {
      if (event.target === E.custom) closeCustom();
    };

    $("#customForm").onsubmit = (event) => {
      event.preventDefault();

      let url;

      try {
        url = new URL(E.customUrl.value);
      } catch {
        V2.toast("Enter a valid URL.");
        return;
      }

      if (!["http:", "https:"].includes(url.protocol)) {
        V2.toast("Only http and https URLs are supported.");
        return;
      }

      closeCustom();
      V2.player.openCustom(url.href);
    };

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        E.search.focus();
      }

      if (event.key === "Escape") {
        V2.settings?.close?.();
        V2.player.closePlayer();
        V2.player.closeModal(E.custom);
        E.sportMoreMenu.hidden = true;
        E.sportMoreBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  function init() {
    installStartupStyles();
    installDeferredExtendedCatalog();
    installNflOnlyCardOdds();

    V2.settings.init();
    V2.events.renderDates();
    V2.events.renderRecent();
    V2.router.init();

    /*
      GTmetrix showed the Twitch embed expanding into the majority of EastCoin's
      startup request count and JavaScript work. Arm it only after settings/router
      are ready, then wire controls to the wrapped openChat function.
    */
    setupDeferredChat();
    wire();

    V2.integrations.handleAuthStatus?.();

    Promise.all([
      V2.events.load(false),
      V2.integrations.identity()
    ]);

    V2.idle(
      () =>
        V2.integrations.sicko(),
      1400
    );
  }

  V2.app = {
    clearFilters,
    wire,
    init,
    ensureExtendedEvents
  };

  init();
})();
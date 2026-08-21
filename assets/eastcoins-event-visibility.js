(() => {
  "use strict";

  /*
    EastCoin event visibility.

    DLStreams / DaddyLive is intentionally NOT connected to the production
    event catalog here. The isolated DLStreams prototype can remain in the repo
    for future work, but this production bridge only controls EastCoin's
    secondary-sport browsing behavior for the existing Streamed + PPV catalog.
  */

  const PRIMARY_FAMILIES = new Set([
    "american-football",
    "combat",
    "basketball",
    "baseball",
    "hockey",
    "wrestling",
    "motorsport",
    "golf"
  ]);

  const SECONDARY_FAMILIES = new Set(["soccer", "tennis"]);

  const SECONDARY_META = Object.freeze({
    soccer: { label: "Soccer", icon: "⚽" },
    tennis: { label: "Tennis", icon: "🎾" }
  });

  const isEventsDocument = /(?:^|\/)events\.html$/i.test(
    window.location.pathname
  );

  const initialEventParameters = isEventsDocument
    ? new URLSearchParams(window.location.search)
    : null;

  const requestedSport = String(
    initialEventParameters?.get("sport") || ""
  ).toLowerCase();

  const selectedSecondaryFamily = SECONDARY_FAMILIES.has(requestedSport)
    ? requestedSport
    : "";

  function normalizedWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function categoryFamily(value) {
    const text = normalizedWords(value);
    if (!text) return "";

    if (
      text === "american football" ||
      text.includes("american football") ||
      text.includes("nfl") ||
      text.includes("ncaaf") ||
      text.includes("college football") ||
      text.includes("high school football") ||
      text.includes("cfl")
    ) return "american-football";

    if (
      text.includes("basketball") ||
      text.includes("nba") ||
      text.includes("wnba") ||
      text.includes("ncaab") ||
      text.includes("college hoops")
    ) return "basketball";

    if (
      text === "football" ||
      text.includes("soccer") ||
      text.includes("premier league") ||
      text.includes("epl") ||
      text.includes("uefa") ||
      text.includes("fifa") ||
      text.includes("champions league") ||
      text.includes("la liga") ||
      text.includes("mls")
    ) return "soccer";

    if (
      text.includes("combat") ||
      text.includes("ufc") ||
      text.includes("mma") ||
      text.includes("boxing") ||
      text.includes("fight")
    ) return "combat";

    if (text.includes("baseball") || text.includes("mlb")) return "baseball";
    if (text.includes("hockey") || text.includes("nhl")) return "hockey";

    if (
      text.includes("wrestling") ||
      text.includes("wwe") ||
      text.includes("aew")
    ) return "wrestling";

    if (
      text.includes("motorsport") ||
      text.includes("formula") ||
      text.includes("nascar") ||
      text.includes("racing")
    ) return "motorsport";

    if (
      text.includes("tennis") ||
      text.includes("atp") ||
      text.includes("wta")
    ) return "tennis";

    if (text.includes("golf") || text.includes("pga")) return "golf";

    return text;
  }

  function itemFamilies(item) {
    if (!item || typeof item !== "object") return [];

    return [
      item.category,
      item.sport,
      item.league,
      item.category_name,
      item.categoryName,
      item.id,
      item.name,
      item.title,
      item?._eastcoinProviders?.ppv?.category
    ]
      .map(categoryFamily)
      .filter(Boolean);
  }

  function primaryFamily(item) {
    return itemFamilies(item)[0] || "other";
  }

  function isHiddenItem(item) {
    if (!isEventsDocument) return false;

    const family = primaryFamily(item);
    return (
      SECONDARY_FAMILIES.has(family) &&
      family !== selectedSecondaryFamily
    );
  }

  function filterResult(result) {
    if (
      !result ||
      typeof result !== "object" ||
      !Array.isArray(result.data)
    ) return result;

    return {
      ...result,
      data: result.data.filter((item) => !isHiddenItem(item))
    };
  }

  function installApiFilter() {
    const API = window.EastcoinStreamedAPI;
    if (!API || API.__eastcoinVisibilityWrapped) return;

    window.EastcoinStreamedAPI = Object.freeze({
      ...API,

      async getDiscovery(...args) {
        const discovery = await API.getDiscovery(...args);
        return {
          ...discovery,
          live: filterResult(discovery?.live),
          today: filterResult(discovery?.today),
          sports: filterResult(discovery?.sports)
        };
      },

      async getLive(...args) {
        return filterResult(await API.getLive(...args));
      },

      async getToday(...args) {
        return filterResult(await API.getToday(...args));
      },

      async getSports(...args) {
        return filterResult(await API.getSports(...args));
      },

      async getAll(...args) {
        return filterResult(await API.getAll(...args));
      },

      __eastcoinVisibilityWrapped: true,
      __eastcoinDlstreamsWrapped: false
    });
  }

  function installMoreSportsStyles() {
    if (document.getElementById("eastcoinMoreSportsStyles")) return;

    const style = document.createElement("style");
    style.id = "eastcoinMoreSportsStyles";
    style.textContent = `
      .ec-more-sports-details { display:block; margin:2px 0 4px; }
      .ec-more-sports-details > summary { list-style:none; cursor:pointer; }
      .ec-more-sports-details > summary::-webkit-details-marker { display:none; }
      .ec-more-sports-details .ec-more-sports-chevron {
        margin-left:auto; opacity:.72; transition:transform .16s ease;
      }
      .ec-more-sports-details[open] .ec-more-sports-chevron {
        transform:rotate(180deg);
      }
      .ec-more-sports-menu {
        display:grid; gap:2px; margin:2px 0 4px 16px; padding:2px 0 2px 8px;
        border-left:1px solid rgba(255,255,255,.09);
      }
      .ec-more-sports-menu .ec-events-v2-nav-item { margin:0; }
      .sidebar-collapsed .ec-more-sports-menu {
        margin-left:5px; padding-left:0; border-left:0;
      }
      .sidebar-collapsed .ec-more-sports-details > summary .ec-more-sports-chevron {
        display:none;
      }
    `;
    document.head.appendChild(style);
  }

  function configureSecondaryButton(button, family, persistent) {
    if (!button) return null;

    const meta = SECONDARY_META[family] || { label: family, icon: "•" };

    if (persistent) button.dataset.ecEventsSport = family;
    else button.dataset.eventsSport = family;

    button.dataset.ecSecondarySport = family;
    button.dataset.navTooltip = meta.label;
    button.hidden = false;
    button.removeAttribute("aria-hidden");

    const icon = button.querySelector(".ec-events-v2-nav-icon");
    const strong = button.querySelector("strong");
    const small = button.querySelector("small");

    if (icon) icon.textContent = meta.icon;
    if (strong) strong.textContent = meta.label;
    if (small) {
      small.textContent = selectedSecondaryFamily === family
        ? "Browsing now"
        : "Browse on demand";
    }

    return button;
  }

  function createMoreSportsDetails(persistent) {
    const details = document.createElement("details");
    details.className = "ec-more-sports-details";
    details.dataset.ecMoreSports = persistent ? "persistent" : "events";

    const summary = document.createElement("summary");
    summary.className = "ec-events-v2-nav-item";
    summary.dataset.navTooltip = "More Sports";
    summary.innerHTML = `
      <span class="ec-events-v2-nav-icon">＋</span>
      <span class="ec-events-v2-nav-copy">
        <strong>More Sports</strong>
        <small>Browse hidden categories</small>
      </span>
      <span class="ec-more-sports-chevron" aria-hidden="true">⌄</span>
    `;

    const menu = document.createElement("div");
    menu.className = "ec-more-sports-menu";
    menu.dataset.ecMoreSportsMenu = "true";

    details.append(summary, menu);
    return details;
  }

  function ensurePersistentMoreSportsNavigation(root = document) {
    const other = root.querySelector?.('[data-ec-events-sport="other"]');
    if (!other) return null;

    const section = other.parentElement;
    if (!section) return null;

    let details = section.querySelector(
      'details[data-ec-more-sports="persistent"]'
    );

    if (!details) {
      details = createMoreSportsDetails(true);
      section.insertBefore(details, other);
    }

    const menu = details.querySelector("[data-ec-more-sports-menu]");
    if (!menu) return details;

    SECONDARY_FAMILIES.forEach((family) => {
      let button = section.querySelector(`[data-ec-events-sport="${family}"]`);
      if (!button) button = other.cloneNode(true);

      configureSecondaryButton(button, family, true);
      if (button.parentElement !== menu) menu.appendChild(button);
    });

    const activeSport = String(
      new URLSearchParams(window.location.search).get("sport") || ""
    ).toLowerCase();

    if (SECONDARY_FAMILIES.has(activeSport)) details.open = true;
    return details;
  }

  function ensureEventsMoreSportsNavigation() {
    if (!isEventsDocument) return null;

    const nav = document.getElementById("eventsV2CategoryNav");
    if (!nav) return null;

    const other = nav.querySelector('[data-events-sport="other"]');
    if (!other) return null;

    let details = nav.querySelector('details[data-ec-more-sports="events"]');

    if (!details) {
      details = createMoreSportsDetails(false);
      nav.insertBefore(details, other);
    }

    const menu = details.querySelector("[data-ec-more-sports-menu]");
    if (!menu) return details;

    SECONDARY_FAMILIES.forEach((family) => {
      let button = nav.querySelector(`[data-events-sport="${family}"]`);
      if (!button) button = other.cloneNode(true);

      configureSecondaryButton(button, family, false);
      button.classList.toggle("is-active", family === selectedSecondaryFamily);
      if (button.parentElement !== menu) menu.appendChild(button);
    });

    details.open = Boolean(selectedSecondaryFamily);
    return details;
  }

  function reloadEventsWith(parameters) {
    const url = new URL(window.location.href);

    Object.entries(parameters).forEach(([name, value]) => {
      if (value === null || value === undefined || value === "") {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(name, String(value));
      }
    });

    window.location.href = url.href;
  }

  function installSecondaryNavigationBridge() {
    if (!isEventsDocument) return;

    document.addEventListener(
      "click",
      (event) => {
        const secondary = event.target.closest?.("[data-ec-secondary-sport]");

        if (secondary) {
          const family = String(
            secondary.dataset.ecSecondarySport || ""
          ).toLowerCase();

          if (!SECONDARY_FAMILIES.has(family)) return;

          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({ sport: family, scope: "all", q: null });
          return;
        }

        if (!selectedSecondaryFamily) return;

        const scopeButton = event.target.closest?.("[data-events-scope]");
        if (scopeButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: null,
            scope: scopeButton.dataset.eventsScope || "all"
          });
          return;
        }

        const modeButton = event.target.closest?.("[data-events-mode]");
        if (modeButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: null,
            mode: modeButton.dataset.eventsMode || "today"
          });
          return;
        }

        const categoryButton = event.target.closest?.("[data-events-sport]");
        if (categoryButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          reloadEventsWith({
            sport: categoryButton.dataset.eventsSport || null,
            scope: "all",
            q: null
          });
        }
      },
      true
    );
  }

  function organizeNavigation(root = document) {
    installMoreSportsStyles();
    ensurePersistentMoreSportsNavigation(root);
    ensureEventsMoreSportsNavigation();
  }

  function clearRetiredDlstreamsCache() {
    try {
      localStorage.removeItem("eastcoinDlstreamsProviderCacheV1");
    } catch {}
  }

  function finishUiSetup() {
    organizeNavigation();

    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.addedNodes.length)) return;
      organizeNavigation();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  clearRetiredDlstreamsCache();
  installApiFilter();
  installSecondaryNavigationBridge();

  window.EASTCOIN_EVENT_VISIBILITY = Object.freeze({
    primaryFamilies: Object.freeze(Array.from(PRIMARY_FAMILIES)),
    secondaryFamilies: Object.freeze(Array.from(SECONDARY_FAMILIES)),
    hiddenFamilies: Object.freeze(Array.from(SECONDARY_FAMILIES)),
    selectedSecondaryFamily,
    isHiddenItem,
    dlstreamsProductionEnabled: false
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishUiSetup, { once: true });
  } else {
    finishUiSetup();
  }
})();

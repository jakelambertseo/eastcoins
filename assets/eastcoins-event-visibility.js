(() => {
  "use strict";

  const HIDDEN_FAMILIES = new Set(["basketball", "soccer"]);

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
      text.includes("american football") ||
      text.includes("nfl") ||
      text.includes("ncaaf") ||
      text.includes("college football")
    ) {
      return "american-football";
    }

    if (
      text.includes("basketball") ||
      text.includes("nba") ||
      text.includes("wnba") ||
      text.includes("ncaab") ||
      text.includes("college hoops")
    ) {
      return "basketball";
    }

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
    ) {
      return "soccer";
    }

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
      item?._eastcoinProviders?.ppv?.category
    ]
      .map(categoryFamily)
      .filter(Boolean);
  }

  function isHiddenItem(item) {
    return itemFamilies(item).some((family) => HIDDEN_FAMILIES.has(family));
  }

  function filterResult(result) {
    if (!result || typeof result !== "object" || !Array.isArray(result.data)) {
      return result;
    }

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
      __eastcoinVisibilityWrapped: true
    });
  }

  function hideNavigationEntries(root = document) {
    const selector = [
      '[data-ec-events-sport="basketball"]',
      '[data-ec-events-sport="soccer"]',
      '[data-sport="basketball"]',
      '[data-sport="soccer"]',
      '[href*="sport=basketball"]',
      '[href*="sport=soccer"]'
    ].join(",");

    root.querySelectorAll(selector).forEach((element) => {
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
    });
  }

  window.EASTCOIN_EVENT_VISIBILITY = Object.freeze({
    hiddenFamilies: Object.freeze(Array.from(HIDDEN_FAMILIES)),
    isHiddenItem
  });

  installApiFilter();

  const finishUiSetup = () => {
    hideNavigationEntries();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          hideNavigationEntries(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishUiSetup, { once: true });
  } else {
    finishUiSetup();
  }
})();

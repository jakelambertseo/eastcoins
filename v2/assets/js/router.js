(() => {
  "use strict";

  const V2 = window.ECV2;
  const E = V2.els;
  const $$ = V2.$$;

  const ROUTES = Object.freeze({
    events: { title: "Events", src: null },
    multiview: { title: "MultiView", src: "../multiview.html?ecV2Embedded=1" },
    picks: { title: "Picks", src: "../picks.html?ecV2Embedded=1" },
    games: { title: "Games", src: "../games.html?ecV2Embedded=1" },
    streams: { title: "Other Streams", src: "../favorites.html?ecV2Embedded=1" },
    sicko: { title: "Sicko Prop", src: "../picks-kalshi-test.html?ecV2Embedded=1#prop-of-week" }
  });

  let current = "events";

  function routeFromLocation() {
    const requested = new URLSearchParams(location.search).get("view") || "events";
    return ROUTES[requested] ? requested : "events";
  }

  function urlFor(name) {
    return name === "events" ? "./" : `?view=${encodeURIComponent(name)}`;
  }

  function setNav(name) {
    $$(".nav [data-v2-route]").forEach((link) => {
      link.classList.toggle("active", link.dataset.v2Route === name);
    });
  }

  function injectEmbeddedCleanup() {
    try {
      const doc = E.workspaceFrame.contentDocument;
      if (!doc?.head || !doc?.body) return;

      doc.body.dataset.ecV2Embedded = "true";

      if (!doc.getElementById("ecV2EmbeddedCleanup")) {
        const style = doc.createElement("style");
        style.id = "ecV2EmbeddedCleanup";
        style.textContent = `
          #ec-weekly-prop-float,
          .sidebar,
          .chat,
          .ec-events-v2-nav,
          .ec-events-v2-chat,
          .ec-events-v2-chat-resizer,
          .ec-events-v2-mobile-menu,
          .ec-events-v2-nav-cycle { display:none !important; }
          .shell { grid-template-columns:minmax(0,1fr) !important; }
          .main { grid-column:1 !important; width:100% !important; max-width:none !important; }
          .ec-events-v2-layout { grid-template-columns:minmax(0,1fr) !important; }
        `;
        doc.head.appendChild(style);
      }
    } catch {
      // If a future route becomes cross-origin, the persistent shell still works;
      // it simply cannot clean up that child document's internal chrome.
    }
  }

  function go(name, options = {}) {
    const route = ROUTES[name] || ROUTES.events;
    const routeName = ROUTES[name] ? name : "events";
    const push = options.push !== false;

    current = routeName;
    setNav(routeName);

    if (routeName === "events") {
      document.body.classList.remove("workspace-active");
      E.workspace.hidden = true;
      document.querySelector("main").hidden = false;
    } else {
      document.body.classList.add("workspace-active");
      document.querySelector("main").hidden = true;
      E.workspace.hidden = false;
      E.workspaceTitle.textContent = route.title;

      const absolute = new URL(route.src, location.href).href;
      if (E.workspaceFrame.src !== absolute) {
        E.workspaceFrame.src = route.src;
      }
    }

    // Critical V2 invariant: this router never touches #persistentTwitchChat.
    // The outer document remains mounted, so Twitch chat keeps the same iframe.
    if (push) {
      history.pushState({ ecV2Route: routeName }, "", urlFor(routeName));
    }
  }

  function wire() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("[data-v2-route]");
      if (!link) return;

      // OAuth login intentionally remains a normal top-level navigation until
      // integrations.js marks the authenticated profile as a V2 route.
      const route = link.dataset.v2Route;
      if (!ROUTES[route]) return;

      event.preventDefault();
      go(route);
    });

    E.workspaceHome.onclick = () => go("events");
    E.workspaceFrame.addEventListener("load", injectEmbeddedCleanup);

    window.addEventListener("popstate", () => {
      go(routeFromLocation(), { push: false });
    });
  }

  function init() {
    wire();
    go(routeFromLocation(), { push: false });
  }

  V2.router = {
    routes: ROUTES,
    go,
    current: () => current,
    init
  };
})();

/* ============================================================
   EastCoin V3 — shell
   Owns the nav, routing, session and the Twitch chat iframe.

   The one rule this file exists to enforce: the chat iframe is
   created once and is never moved, re-created or re-assigned.
   V2 needed an iframed workspace to guarantee that; here views
   are ordinary DOM swapped inside <main>, so chat simply sits
   outside the part of the page that changes.
   ============================================================ */
(() => {
  "use strict";

  const CHAT_PREF_KEY = "eastcoinV3ChatVisible";

  const els = {
    view: document.getElementById("view"),
    navLinks: Array.from(document.querySelectorAll(".nav-link, .brand")),
    search: document.getElementById("navSearch"),
    chatRail: document.getElementById("chatRail"),
    chatFrame: document.getElementById("twitchChat"),
    chatPlaceholder: document.getElementById("chatPlaceholder"),
    chatToggle: document.getElementById("chatToggle"),
    chatClose: document.getElementById("chatClose"),
    loginBtn: document.getElementById("loginBtn"),
    walletChip: document.getElementById("walletChip"),
    walletValue: document.getElementById("walletValue"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingsMenu: document.getElementById("settingsMenu"),
    navPeek: document.getElementById("navPeek")
  };

  const views = Object.create(null);
  let currentView = null;
  const state = {
    route: "events",
    search: "",
    session: null
  };

  /* ---------------------------------------------------------- routing */

  // Known routes are listed rather than read from the registry: view
  // modules load after the shell, so checking registration here would
  // send every deep link (?view=picks) back to Events before its module
  // had a chance to register. An unknown name still falls back.
  const ROUTES = ["events", "multiview", "picks", "music", "watch"];

  function routeFromUrl() {
    const view = new URL(location.href).searchParams.get("view");
    return ROUTES.includes(view) ? view : "events";
  }

  function register(name, view) {
    views[name] = view;
    // Views register after the shell has already painted, so the current
    // route must be re-rendered to replace the placeholder with the real
    // view. Guarding on "has rendered" would leave the stub on screen.
    if (state.route === name) render();
  }

  function go(name, { push = true } = {}) {
    if (!ROUTES.includes(name)) name = "events";
    state.route = name;

    if (push) {
      const url = name === "events" ? "/v3/" : `/v3/?view=${name}`;
      history.pushState({ view: name }, "", url);
    }
    render();
  }

  function render() {
    const view = views[state.route];

    for (const link of els.navLinks) {
      const on = link.dataset.route === state.route;
      if (link.classList.contains("nav-link")) {
        link.toggleAttribute("aria-current", on);
        if (on) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    }

    // Give the outgoing view a chance to clean up anything it put
    // outside its own container (body classes, open dialogs).
    if (currentView && currentView !== view) currentView.unmount?.();
    currentView = view || null;

    els.view.replaceChildren();
    els.view.dataset.rendered = "1";

    if (!view) {
      els.view.append(stub("Not built yet", "This view arrives in a later phase."));
      return;
    }
    view.mount(els.view, { state, go, stub });
  }

  function stub(title, body, bullets) {
    const el = document.createElement("div");
    el.className = "stub";
    const h = document.createElement("h2");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = body;
    el.append(h, p);
    if (bullets?.length) {
      const ul = document.createElement("ul");
      for (const item of bullets) {
        const li = document.createElement("li");
        li.textContent = item;
        ul.append(li);
      }
      el.append(ul);
    }
    return el;
  }

  /* ---------------------------------------------------------- chat
     Deferred until the first real interaction: Twitch's embed is
     expensive and nobody needs it before they've touched the page.
     Hiding it afterwards is a CSS-only operation — the iframe keeps
     its connection, so re-showing costs nothing and never reloads. */

  let chatMounted = false;

  function mountChat() {
    if (chatMounted) return;
    chatMounted = true;
    els.chatFrame.src = els.chatFrame.dataset.src;
    els.chatFrame.hidden = false;
    // .chat-placeholder sets display:grid, which beats [hidden]'s UA
    // display:none — so remove it outright rather than hiding it.
    els.chatPlaceholder.remove();
  }

  function chatVisible() {
    try {
      return localStorage.getItem(CHAT_PREF_KEY) !== "0";
    } catch {
      return true;
    }
  }

  function setChatVisible(visible) {
    document.body.classList.toggle("chat-hidden", !visible);
    document.body.classList.toggle("chat-open", visible);
    els.chatToggle.setAttribute("aria-pressed", String(visible));
    els.chatToggle.classList.toggle("on", visible);
    try {
      localStorage.setItem(CHAT_PREF_KEY, visible ? "1" : "0");
    } catch {
      /* private mode — the preference simply doesn't persist */
    }
    if (visible) mountChat();
  }

  // Chat is core to this site, not an extra, so it should not wait for a
  // click. It is still kept off the critical path: the browser paints the
  // events grid first, then mounts Twitch on the first idle moment. That
  // keeps the original performance win without the page sitting there
  // half-built until someone happens to touch it.
  function armChatLoad() {
    if (!chatVisible()) return;
    const start = () => mountChat();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 1500 });
    } else {
      window.setTimeout(start, 300);
    }
  }

  /* ---------------------------------------------------------- settings */

  const PREF_KEY = "eastcoinV3Prefs";
  const prefs = { chat: true, topnav: true, art: true, scores: true };

  function loadPrefs() {
    try {
      Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || "{}"));
    } catch {
      /* defaults are fine */
    }
    prefs.chat = chatVisible();
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {
      /* private mode */
    }
  }

  function applyPrefs() {
    document.body.classList.toggle("nav-hidden", !prefs.topnav);
    document.body.classList.toggle("no-art", !prefs.art);
    for (const item of els.settingsMenu.querySelectorAll("[data-toggle]")) {
      const on = Boolean(prefs[item.dataset.toggle]);
      item.querySelector(".switch").dataset.on = on ? "1" : "0";
      item.setAttribute("aria-checked", String(on));
    }
  }

  function setMenuOpen(open) {
    els.settingsMenu.hidden = !open;
    els.settingsBtn.setAttribute("aria-expanded", String(open));
    els.settingsBtn.classList.toggle("on", open);
  }

  els.settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(els.settingsMenu.hidden);
  });
  document.addEventListener("click", (event) => {
    if (!els.settingsMenu.hidden && !els.settingsMenu.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });

  els.settingsMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-toggle]");
    if (!item) return;
    const key = item.dataset.toggle;
    prefs[key] = !prefs[key];

    if (key === "chat") setChatVisible(prefs.chat);
    savePrefs();
    applyPrefs();
    if (key === "art" || key === "scores") views.events?.onPrefs?.(prefs);
  });

  // Restores the nav once it's hidden — otherwise the settings menu that
  // turned it off is itself out of reach.
  els.navPeek.addEventListener("click", () => {
    prefs.topnav = true;
    savePrefs();
    applyPrefs();
  });

  window.ECV3Prefs = prefs;

  /* ---------------------------------------------------------- session */

  async function loadSession() {
    try {
      const response = await fetch("/api/picks/bootstrap", { credentials: "include" });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.ok) return;

      state.session = payload.session || null;
      const user = state.session?.user;
      const wallet = state.session?.wallet;

      if (user?.login) {
        els.loginBtn.textContent = user.displayName || user.login;
        els.loginBtn.href = "/v3/?view=picks";
      }
      if (wallet?.connected && Number.isFinite(Number(wallet.balance))) {
        els.walletValue.textContent = Number(wallet.balance).toLocaleString();
        els.walletChip.hidden = false;
      }
    } catch {
      /* signed out or offline: the nav just stays in its logged-out state */
    }
  }

  /* ---------------------------------------------------------- wiring */

  for (const link of els.navLinks) {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      const name = link.dataset.route;
      if (!name) return;
      event.preventDefault();
      go(name);
    });
  }

  window.addEventListener("popstate", () => {
    state.route = routeFromUrl();
    render();
  });

  els.chatToggle.addEventListener("click", () => setChatVisible(document.body.classList.contains("chat-hidden")));
  els.chatClose.addEventListener("click", () => setChatVisible(false));

  function looksLikeUrl(value) {
    return /^(https?:\/\/|www\.)\S+$/i.test(value) || /^[a-z0-9-]+\.[a-z]{2,}\/\S+$/i.test(value);
  }

  function embedUrl(raw) {
    let value = raw.trim();
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  let searchTimer = 0;

  // A pasted link is an instruction to watch it, not a search term.
  els.search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const value = els.search.value.trim();
    if (!looksLikeUrl(value)) return;
    const url = embedUrl(value);
    if (!url) return;
    event.preventDefault();
    window.clearTimeout(searchTimer);
    els.search.value = "";
    state.search = "";
    history.pushState({ view: "watch" }, "", `/v3/?view=watch&url=${encodeURIComponent(url)}`);
    state.route = "watch";
    render();
  });

  els.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    const value = els.search.value.trim();
    // Don't filter the grid down to nothing while a URL is being pasted.
    if (looksLikeUrl(value)) return;
    searchTimer = window.setTimeout(() => {
      state.search = value;
      if (state.route !== "events") go("events");
      else views.events?.onSearch?.(state.search);
    }, 220);
  });

  window.ECV3 = { register, go, state, stub };

  state.route = routeFromUrl();
  loadPrefs();
  setChatVisible(prefs.chat);
  applyPrefs();
  armChatLoad();
  render();
  loadSession();
})();

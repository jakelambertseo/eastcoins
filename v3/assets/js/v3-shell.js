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
    chatReload: document.getElementById("chatReload"),
    chatToggle: document.getElementById("chatToggle"),
    chatClose: document.getElementById("chatClose"),
    chatPopout: document.getElementById("chatPopout"),
    loginBtn: document.getElementById("loginBtn"),
    walletChip: document.getElementById("walletChip"),
    walletValue: document.getElementById("walletValue"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingsMenu: document.getElementById("settingsMenu"),
    navPeek: document.getElementById("navPeek"),
    navAdmin: document.getElementById("navAdmin")
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
  // "game" is the /g/<slug> page chat links to. It is a route, not a nav
  // item: the only way in is a link.
  const ROUTES = ["events", "multiview", "picks", "music", "screen", "flip", "watch", "admin", "game", "profile", "dashboard", "users", "activity", "casino", "wheel", "race", "hilo"];

  /* ------------------------------------------------------------ legacy URLs

     Every link anyone has already pasted into chat was produced by the
     older shell, and most of them do not name a view at all. Rewriting
     them here means an old link opens the thing it always opened,
     instead of dropping the person on the events page wondering what
     happened.

     Done with replaceState rather than a redirect so the address bar
     ends up canonical without costing a round trip or a history entry
     the back button would then have to fight through. */

  // Views the old shell had that this one does not. They still exist as
  // standalone pages, so the link keeps its meaning rather than being
  // quietly swallowed.
  // Extensionless: Pages canonicalises away the .html with a 308, and
  // sending someone through a redirect to reach a redirect is a hop for
  // nothing.
  const LEGACY_PAGES = {
    games: "/games",
    streams: "/favorites",
    sicko: "/picks-kalshi-test#prop-of-week"
  };

  function normalizeLegacyUrl() {
    const url = new URL(location.href);
    const params = url.searchParams;
    const view = params.get("view");

    if (view && LEGACY_PAGES[view]) {
      location.replace(LEGACY_PAGES[view]);
      return true;   // navigating away; stop booting
    }

    let changed = false;

    // /?watch=<url> — a pasted embed
    const watch = params.get("watch");
    if (watch) {
      params.set("view", "watch");
      params.set("url", watch);
      params.delete("watch");
      changed = true;
    }

    // /?event=<id> — what the old player's Copy Link produced, and by far
    // the most shared shape. source and stream rode along with it; they
    // are dropped rather than half-honoured, since this player picks its
    // own server and pretending otherwise would be worse than not saying.
    if (!params.get("view") && params.get("event")) {
      params.set("view", "watch");
      params.delete("source");
      // The old player's stream number is this player's server number.
      const stream = params.get("stream");
      params.delete("stream");
      if (stream && !params.get("server")) params.set("server", stream);
      changed = true;
    }

    if (changed) {
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    return false;
  }

  function routeFromUrl() {
    if (/^\/g\/./i.test(location.pathname)) return "game";
    if (/^\/u\/./i.test(location.pathname)) return "profile";
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

    // The game view owns its own URL (/g/<slug>); every other view is
    // reached by name.
    if (push && name !== "game" && name !== "profile") {
      const url = name === "events" ? "/" : `/?view=${name}`;
      history.pushState({ view: name }, "", url);
    }
    render();
  }

  const TITLES = {
    events: "EastCoin — Sports", music: "The Green Room — EastCoin", screen: "Movies & TV — EastCoin",
    multiview: "MultiView — EastCoin", picks: "Picks — EastCoin", casino: "Casino — EastCoin",
    flip: "Coin Flip — EastCoin Casino", wheel: "Wheel — EastCoin Casino", race: "Horse Race — EastCoin Casino",
    hilo: "Higher or Lower — EastCoin Casino", users: "All Users — EastCoin", activity: "Activity — EastCoin",
    dashboard: "Dashboard — EastCoin", admin: "Admin — EastCoin", watch: "Watching — EastCoin"
  };

  function render() {
    const view = views[state.route];

    for (const link of els.navLinks) {
      // A game page is a Picks page as far as the nav is concerned.
      const on = link.dataset.route === state.route ||
        ((state.route === "game" || state.route === "profile") && link.dataset.route === "picks") ||
        (["flip", "wheel", "race", "hilo"].includes(state.route) && link.dataset.route === "casino");
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
    // Tell the room where this tab is now.
    window.ECPresence?.beat(state.route);
    // A title per section; views with a name of their own (a profile,
    // a game page) set a better one once they know it.
    document.title = TITLES[state.route] || "EastCoin";

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
  let chatMountedAt = 0;
  let chatHiddenSince = 0;
  let chatWatchdog = 0;

  /* ------------------------------------------------------- chat lifetime

     The embed was mounted once and then left alone for the life of the
     tab, and hiding it was CSS only — so a session open all evening kept
     one Twitch document growing the entire time.

     That is survivable for a viewer and it is not for a moderator.
     Twitch renders moderation controls on EVERY message for mods, loads
     the AutoMod queue, subscribes to moderation events, and runs a
     periodic check for whether the embed is being covered — none of
     which a normal viewer pays for. Same chat, several times the memory,
     and under Fission it is twitch.tv's own content process that gets
     killed, which is why nothing ever appeared in about:crashes.

     So the fix is to stop letting it live that long. Nothing here
     touches route changes: navigating between views still leaves chat
     completely alone, which is the invariant that matters. */

  // Closed this long and it is genuinely not being read; drop it.
  const CHAT_UNLOAD_AFTER_HIDDEN_MS = 10 * 60 * 1000;
  // Old enough to recycle at the next moment nobody is looking.
  const CHAT_SOFT_MAX_AGE_MS = 45 * 60 * 1000;
  // Old enough to recycle even if they are, because losing scrollback
  // once beats losing the tab.
  const CHAT_HARD_MAX_AGE_MS = 3 * 60 * 60 * 1000;

  function chatAge() {
    return chatMountedAt ? Date.now() - chatMountedAt : 0;
  }

  /** True while they are actually typing in it — never interrupt that. */
  function chatHasFocus() {
    return document.activeElement === els.chatFrame;
  }

  function unmountChat() {
    if (!chatMounted) return;
    chatMounted = false;
    chatMountedAt = 0;
    // about:blank rather than removing the node: the element, its place
    // in the layout and every listener stay put, and only the Twitch
    // document goes.
    els.chatFrame.src = "about:blank";
  }

  function recycleChat() {
    if (!chatMounted) return;
    els.chatFrame.src = els.chatFrame.dataset.src;
    chatMountedAt = Date.now();
  }

  function chatWatchdogTick() {
    if (!chatMounted) return;

    const hidden = document.body.classList.contains("chat-hidden");
    if (hidden) {
      if (chatHiddenSince && Date.now() - chatHiddenSince > CHAT_UNLOAD_AFTER_HIDDEN_MS) {
        unmountChat();
      }
      return;
    }

    const age = chatAge();
    if (age < CHAT_SOFT_MAX_AGE_MS) return;

    // Backgrounded tab: the ideal moment, since nobody loses their place.
    if (document.hidden) return recycleChat();

    if (age > CHAT_HARD_MAX_AGE_MS && !chatHasFocus()) recycleChat();
  }

  function mountChat() {
    if (chatMounted) return;
    chatMounted = true;
    chatMountedAt = Date.now();
    els.chatFrame.hidden = false;
    // .chat-placeholder sets display:grid, which beats [hidden]'s UA
    // display:none — so remove it outright rather than hiding it.
    els.chatPlaceholder?.remove();

    // Which channel is a deployment's choice now (TWITCH_CHAT_CHANNEL,
    // via /api/config), and eastcoins-config.js writes the answer into
    // data-src. Loading what the HTML shipped with and swapping on
    // arrival would mount one channel's chat only to throw it away, so
    // wait for the answer instead — a same-origin fetch that has been in
    // flight since the first script on the page. It resolves even when it
    // fails, in which case data-src is what the HTML said and chat mounts
    // exactly as it always did.
    const load = () => {
      // Hidden again while we waited: unmountChat() already had its say.
      if (!chatMounted) return;
      els.chatFrame.src = els.chatFrame.dataset.src;
      chatMountedAt = Date.now();
    };
    if (window.ECConfig?.ready) window.ECConfig.ready.then(load);
    else load();

    if (!chatWatchdog) {
      chatWatchdog = window.setInterval(chatWatchdogTick, 60000);
    }
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
    els.chatToggle?.setAttribute("aria-pressed", String(visible));
    els.chatToggle?.classList.toggle("on", visible);
    try {
      localStorage.setItem(CHAT_PREF_KEY, visible ? "1" : "0");
    } catch {
      /* private mode — the preference simply doesn't persist */
    }
    chatHiddenSince = visible ? 0 : Date.now();
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
        // Signed in, the button is your name and goes to your profile.
        // Routed by the same ulink handler every other name uses.
        els.loginBtn.replaceChildren();
        const face = document.createElement("span");
        face.className = "me-av";
        face.textContent = String(user.displayName || user.login).slice(0, 1).toUpperCase();
        if (user.profileImageUrl) {
          const img = document.createElement("img");
          img.alt = "";
          img.addEventListener("load", () => face.classList.add("has-logo"));
          img.addEventListener("error", () => img.remove());
          img.src = user.profileImageUrl;
          face.append(img);
        }
        const name = document.createElement("span");
        name.className = "me-name";
        name.textContent = user.displayName || user.login;
        els.loginBtn.append(face, name);
        els.loginBtn.href = `/u/${encodeURIComponent(String(user.login).toLowerCase())}`;
        els.loginBtn.classList.add("ulink");
        els.loginBtn.title = "Your profile";
        document.getElementById("mePill")?.classList.add("on");

        // The Admin link stays out of the nav now that testing is done;
        // admins reach it at /?view=admin. The server re-checks every
        // admin endpoint regardless.
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

  // Names link to profiles from every view. Handled once here so no
  // view has to know how the profile route works.
  document.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const a = event.target.closest("a.ulink, a.glink");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const target = href.startsWith("/u/") ? "profile" : href.startsWith("/g/") ? "game" : "";
    if (!target) return;
    event.preventDefault();
    history.pushState({ view: target }, "", href);
    go(target, { push: false });
  });

  window.addEventListener("popstate", () => {
    state.route = routeFromUrl();
    render();
  });

  els.chatToggle?.addEventListener("click", () => setChatVisible(document.body.classList.contains("chat-hidden")));
  // The rail's own close button must leave the menu's switch telling the truth.
  els.chatClose.addEventListener("click", () => { setChatVisible(false); prefs.chat = false; savePrefs(); applyPrefs(); });

  // For when it has gone sluggish and they would rather not wait for the
  // watchdog. Also the honest answer to "chat is being weird".
  els.chatReload?.addEventListener("click", () => {
    if (chatMounted) recycleChat();
    else mountChat();
  });

  // A tab coming back after a long time away is the cheapest possible
  // moment to have replaced the document, so check on the way in and out.
  document.addEventListener("visibilitychange", chatWatchdogTick);

  // Real Twitch in its own window rather than the embed.
  //
  // Worth having for whoever chats most. The embedded chat makes Twitch
  // ask for confirmation before the first message of every page load, and
  // disables the box outright for mods and the broadcaster if anything
  // overlaps it. Neither protection applies on twitch.tv itself, and
  // neither is something this site can switch off — they exist precisely
  // so an embedding page cannot.
  els.chatPopout?.addEventListener("click", () => {
    const frame = document.getElementById("twitchChat");
    // Read the channel off the embed rather than repeating it here, so
    // there stays exactly one place it is written down.
    const src = frame?.dataset?.src || frame?.src || "";
    const channel = /twitch\.tv\/embed\/([^/?]+)\/chat/.exec(src)?.[1] || "zwades";

    const url = "https://www.twitch.tv/popout/" + encodeURIComponent(channel) + "/chat?popout=";

    // Deliberately WITHOUT noopener in the features string. That flag
    // makes window.open return null even when the window opened fine, so
    // there is no way left to tell success from a blocked popup — which
    // meant the fallback below fired every single time and every click
    // opened two windows.
    let opened = null;
    try {
      opened = window.open(url, "ecChat_" + channel, "width=420,height=760");
    } catch {
      opened = null;
    }

    if (opened) {
      // Sever the back-reference by hand instead. Cross-origin will
      // usually refuse this, which is fine — it is belt and braces on a
      // window we are deliberately sending to Twitch.
      try { opened.opener = null; } catch {}
      opened.focus?.();
    } else {
      // Popup blockers are common and silent; a tab beats a button that
      // appears to do nothing.
      window.open(url, "_blank", "noopener,noreferrer");
    }

    // Two chats side by side is just noise, and the embedded one is the
    // copy with Twitch's restrictions on it. Hiding it also gives the
    // width back to whatever is being watched.
    setChatVisible(false);
  });


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

  // The magnifier opens the box; the box closes again once it is
  // empty and nobody is typing in it.
  const searchBox = document.getElementById("navSearchBox");
  const searchBtn = document.getElementById("navSearchBtn");
  function openSearch() {
    searchBox?.classList.add("open");
    window.setTimeout(() => els.search.focus(), 30);
  }
  function closeSearchIfEmpty() {
    if (!els.search.value.trim()) searchBox?.classList.remove("open");
  }
  searchBtn?.addEventListener("click", () => {
    if (searchBox?.classList.contains("open")) { els.search.value = ""; state.search = ""; searchBox.classList.remove("open"); views.events?.onSearch?.(""); }
    else openSearch();
  });
  els.search.addEventListener("blur", () => window.setTimeout(closeSearchIfEmpty, 120));
  els.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { els.search.value = ""; state.search = ""; els.search.blur(); searchBox?.classList.remove("open"); views.events?.onSearch?.(""); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const t = event.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    event.preventDefault();
    openSearch();
  });

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
    history.pushState({ view: "watch" }, "", `/?view=watch&url=${encodeURIComponent(url)}`);
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

  /** Views that move ZCoins can keep the nav honest without a reload. */
  function setWallet(balance) {
    const n = Number(balance);
    if (!Number.isFinite(n)) return;
    els.walletValue.textContent = n.toLocaleString();
    els.walletChip.hidden = false;
    if (state.session?.wallet) state.session.wallet.balance = n;
  }

  window.ECV3 = { register, go, state, stub, setWallet, refreshSession: loadSession };

  // Before anything reads the URL: an old-shaped link is rewritten to
  // its V3 equivalent, and one pointing at a view that only exists as a
  // standalone page navigates away instead of booting.
  if (normalizeLegacyUrl()) return;

  state.route = routeFromUrl();
  loadPrefs();
  setChatVisible(prefs.chat);
  applyPrefs();
  armChatLoad();
  render();
  // Views that draw differently for the person logged in (their own
  // profile) wait on this rather than racing the first session read.
  window.ECV3.sessionReady = loadSession();
})();

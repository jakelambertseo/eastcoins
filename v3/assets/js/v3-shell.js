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
    walletValue: document.getElementById("walletValue")
  };

  const views = Object.create(null);
  const state = {
    route: "events",
    search: "",
    session: null
  };

  /* ---------------------------------------------------------- routing */

  function routeFromUrl() {
    const view = new URL(location.href).searchParams.get("view");
    return views[view] ? view : "events";
  }

  function register(name, view) {
    views[name] = view;
    // Views register after the shell has already painted, so the current
    // route must be re-rendered to replace the placeholder with the real
    // view. Guarding on "has rendered" would leave the stub on screen.
    if (state.route === name) render();
  }

  function go(name, { push = true } = {}) {
    if (!views[name]) name = "events";
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
    els.chatPlaceholder.hidden = true;
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

  function armChatDeferral() {
    if (!chatVisible()) return;
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    const fire = () => {
      events.forEach((e) => window.removeEventListener(e, fire));
      mountChat();
    };
    events.forEach((e) => window.addEventListener(e, fire, { once: true, passive: true }));
    // Don't wait forever for someone who is only reading.
    window.setTimeout(fire, 4000);
  }

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

  let searchTimer = 0;
  els.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.search = els.search.value.trim();
      if (state.route !== "events") go("events");
      else views.events?.onSearch?.(state.search);
    }, 220);
  });

  window.ECV3 = { register, go, state, stub };

  state.route = routeFromUrl();
  setChatVisible(chatVisible());
  armChatDeferral();
  render();
  loadSession();
})();

/* ============================================================
   EastCoin V3 — who's here

   Two halves. The heartbeat: every open tab tells the server where
   it is, every 30 seconds and whenever the view changes. The strip:
   the home page asks who's around and draws them — pictures for
   people logged in, a count for guests, and where each one is.
   ============================================================ */
(() => {
  "use strict";

  const BEAT_MS = 30 * 1000;
  const KEY = "eastcoinPresenceClient";
  const PLACES = {
    events: "on Sports", watch: "watching a game", multiview: "in MultiView", picks: "on Picks",
    music: "in the Green Room", screen: "in Movies & TV", flip: "at the coin flip", game: "on a game page",
    profile: "reading profiles", admin: "in admin", dashboard: "on the dashboard"
  };

  function clientId() {
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        sessionStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      return "anon";
    }
  }

  let lastWhere = "";
  async function beat(where) {
    lastWhere = where || lastWhere || "events";
    if (document.hidden) return;
    try {
      await fetch("/api/presence", {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientId(), where: lastWhere })
      });
    } catch { /* next beat */ }
  }

  window.setInterval(() => beat(), BEAT_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) beat(); });

  /* ---------------------------------------------------------- the strip */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function avatar(p) {
    const box = el("span", "wh-av", String(p.displayName || p.login || "?").slice(0, 1).toUpperCase());
    if (p.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      img.addEventListener("load", () => box.classList.add("has-logo"));
      img.addEventListener("error", () => img.remove());
      img.src = p.avatar;
      box.append(img);
    }
    return box;
  }

  async function fetchRoom() {
    try {
      const r = await fetch("/api/presence", { credentials: "include" });
      const payload = await r.json();
      return payload?.ok ? payload : null;
    } catch {
      return null;
    }
  }

  function draw(container, data) {
    container.replaceChildren();
    const head = el("div", "wh-head");
    head.append(el("span", "wh-k", "Who's here"));
    const total = data ? data.total : 0;
    head.append(el("span", "wh-count", total ? `${total} online` : "just you"));
    container.append(head);

    const list = el("div", "wh-list");
    if (data) {
      for (const p of data.people) {
        const chip = el("a", "wh-chip ulink");
        chip.href = `/u/${encodeURIComponent(p.login)}`;
        chip.title = `${p.displayName} · ${PLACES[p.where] || "around"}`;
        chip.append(avatar(p));
        const copy = el("span", "wh-copy");
        copy.append(el("b", null, p.displayName), el("small", null, PLACES[p.where] || "around"));
        chip.append(copy);
        window.ECBadges?.decorate(chip.querySelector("b"), p.login);
        list.append(chip);
      }
      if (data.guests) {
        const g = el("span", "wh-chip guests");
        g.append(el("span", "wh-av ghost", "👤"), el("span", "wh-copy"));
        g.lastChild.append(el("b", null, `${data.guests} guest${data.guests === 1 ? "" : "s"}`), el("small", null, "not logged in"));
        list.append(g);
      }
    }
    if (!list.children.length) list.append(el("span", "wh-empty", "Nobody else around right now."));
    container.append(list);
  }

  let stripTimer = 0;
  function mountStrip(container) {
    window.clearInterval(stripTimer);
    const refresh = async () => {
      if (!container.isConnected) { window.clearInterval(stripTimer); return; }
      draw(container, await fetchRoom());
    };
    refresh();
    stripTimer = window.setInterval(refresh, 20 * 1000);
  }

  window.ECPresence = Object.freeze({ beat, mountStrip });
})();

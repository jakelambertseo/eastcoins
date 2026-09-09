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
    events: "browsing Sports", watch: "watching a game", multiview: "in MultiView", picks: "on Picks",
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
  let lastDetail = "";
  // Hidden tabs still beat: someone with the Green Room in a background
  // tab is still in the Green Room.
  async function beat(where, detail) {
    if (where && where !== lastWhere) lastDetail = "";
    // With no route given, ask the shell where this tab actually is —
    // the first paint happens before this script is ready, and a Music
    // tab must not spend its first minute reported as Sports.
    lastWhere = where || lastWhere || window.ECV3?.state?.route || "events";
    if (detail !== undefined) lastDetail = String(detail || "");
    try {
      await fetch("/api/presence", {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientId(), where: lastWhere, detail: lastDetail })
      });
    } catch { /* next beat */ }
  }

  // One glyph per place, so a chip can say where someone is in one line.
  const ICONS = {
    events: "🏈", watch: "📺", multiview: "🔲", picks: "🪙", music: "🎵", screen: "🎬", flip: "🪙",
    game: "🪙", profile: "👤", admin: "🛠", dashboard: "🛠"
  };
  const SHOW_MAX = 14;

  /** "watching Mariners vs Rangers", "looking at Reds at Dodgers", or the plain place. */
  function placeLabel(p) {
    const d = String(p.detail || "").trim();
    if (p.where === "watch" && d) return "watching " + d;
    if (p.where === "game" && d) return "looking at " + d;
    return PLACES[p.where] || "around";
  }

  window.setInterval(() => beat(), BEAT_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) beat(); });
  // First beat as soon as this script is up, from the shell's route.
  beat();

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
      // People doing something specific first (watching, listening),
      // browsers after; so the interesting chips are the visible ones.
      const rank = (p) => (p.where === "watch" ? 0 : p.where === "music" ? 1 : p.where === "flip" ? 2 : p.where === "picks" ? 3 : 5);
      const people = data.people.slice().sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName));
      const chipFor = (p) => {
        const chip = el("a", "wh-chip ulink");
        chip.href = `/u/${encodeURIComponent(p.login)}`;
        chip.title = `${p.displayName} · ${placeLabel(p)}`;
        chip.append(avatar(p));
        const name = el("b", null, p.displayName);
        chip.append(name, el("span", "wh-where", ICONS[p.where] || "·"));
        window.ECBadges?.decorate(name, p.login);
        return chip;
      };
      const shown = container.dataset.expanded === "1" ? people : people.slice(0, SHOW_MAX);
      for (const p of shown) list.append(chipFor(p));
      if (people.length > shown.length) {
        const more = el("button", "wh-chip more", `+${people.length - shown.length} more`);
        more.type = "button";
        more.addEventListener("click", () => { container.dataset.expanded = "1"; draw(container, data); });
        list.append(more);
      }
      if (data.guests) {
        const g = el("span", "wh-chip guests");
        g.title = "Not logged in";
        g.append(el("span", "wh-av ghost", "👤"), el("b", null, `${data.guests} guest${data.guests === 1 ? "" : "s"}`));
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
      const data = await fetchRoom();
      if (!container.isConnected) { window.clearInterval(stripTimer); return; }
      draw(container, data);
    };
    draw(container, null);   // the frame first, so it never sits empty
    refresh();
    stripTimer = window.setInterval(refresh, 20 * 1000);
  }

  window.ECPresence = Object.freeze({ beat, mountStrip });
})();

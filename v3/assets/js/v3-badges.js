/* ============================================================
   EastCoin V3 — badges next to names

   One fetch of /api/picks/badges, shared by every view, refreshed
   every minute. A view renders a name, calls decorate(), and the
   badges appear once the answer is in — or straight away if it
   already is. Hover a badge for what it means.
   ============================================================ */
(() => {
  "use strict";

  const TTL_MS = 60 * 1000;
  let map = null;
  let fetchedAt = 0;
  let inflight = null;

  async function load() {
    if (map && Date.now() - fetchedAt < TTL_MS) return map;
    if (inflight) return inflight;
    inflight = fetch("/api/picks/badges")
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.ok) { map = payload.badges || {}; fetchedAt = Date.now(); }
        return map || {};
      })
      .catch(() => map || {})
      .finally(() => { inflight = null; });
    return inflight;
  }

  function render(badges, compact) {
    const wrap = document.createElement("span");
    wrap.className = `badges${compact ? " compact" : ""}`;
    for (const b of badges) {
      const s = document.createElement("span");
      s.className = `badge ${b.key}`;
      s.textContent = compact ? b.emoji : `${b.emoji} ${b.label}`;
      s.title = b.label;
      wrap.append(s);
    }
    return wrap;
  }

  /**
   * Appends this person's badges to a node. Emoji only by default;
   * `full` spells the labels out (the profile head uses that).
   */
  function decorate(node, login, { full = false } = {}) {
    const key = String(login || "").toLowerCase();
    if (!node || !key) return;
    const apply = (m) => {
      const list = m[key] || [];
      // Views decorate names before attaching them to the page, so a
      // detached node is the normal case, not a reason to skip.
      node.querySelector(":scope > .badges")?.remove();
      if (list.length) node.append(render(list, !full));
    };
    if (map && Date.now() - fetchedAt < TTL_MS) apply(map);
    else load().then(apply);
  }

  function forLogin(login) {
    return load().then((m) => m[String(login || "").toLowerCase()] || []);
  }

  window.ECBadges = Object.freeze({ decorate, forLogin, load });
})();

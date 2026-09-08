/* ============================================================
   EastCoin V3 — MultiView

   The governing rule here: an iframe is created once and is only
   ever touched when ITS OWN source changes. Re-rendering the grid
   on every interaction reloads every panel, so switching one
   panel's server used to restart all four. Panels are therefore
   built once and updated surgically; layout, resizing, hiding
   controls and sharing never rebuild a frame.

   Panels mount the provider iframe directly rather than nesting
   player.html, which is what forced V2's loading mask.
   ============================================================ */
(() => {
  "use strict";

  const STORE_KEY = "eastcoinV3MultiviewV2";
  const MAX_PANELS = 4;
  const MIN_SPLIT = 18;
  const MAX_SPLIT = 82;

  const local = {
    count: 4,
    x: 50,               // vertical split, %
    y: 50,               // horizontal split, %
    panels: [],          // { match, streams, active, loading, reason }
    catalog: [],
    catalogLoaded: false,
    hideControls: false,
    picking: -1,
    search: ""
  };

  // Live DOM references, so updates don't require a rebuild.
  const dom = { root: null, grid: null, cells: [], head: null };
  let shell = null;

  /* ---------------------------------------------------------- storage */

  function snapshot() {
    return {
      c: local.count,
      x: Math.round(local.x),
      y: Math.round(local.y),
      i: local.panels.slice(0, MAX_PANELS).map((p) => p?.match?.id || null)
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(snapshot()));
    } catch {
      /* private mode */
    }
  }

  function restore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (raw.c >= 2 && raw.c <= MAX_PANELS) local.count = raw.c;
      if (Number.isFinite(raw.x)) local.x = clamp(raw.x);
      if (Number.isFinite(raw.y)) local.y = clamp(raw.y);
      return Array.isArray(raw.i) ? raw.i : [];
    } catch {
      return [];
    }
  }

  function clamp(value) {
    return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, Number(value) || 50));
  }

  /* ---------------------------------------------------------- sharing */

  function encodeShare() {
    const json = JSON.stringify(snapshot());
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function fromBase64Url(value) {
    const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    // The old encoder stripped "=" padding; atob wants it back.
    return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  }

  /**
   * A share token from the previous shell.
   *
   * Shaped "2.<layout>.<col>.<row>.<slot>.<slot>…", where a slot is "_"
   * for empty, "e<base64url id>" for an event, or "u<base64url url>" for
   * a pasted link.
   *
   * Pasted-link panels cannot be carried over: this MultiView holds
   * events only. They are counted rather than dropped in silence, so the
   * person opening the link is told the layout came back short instead of
   * assuming somebody shared it that way.
   */
  function decodeLegacyShare(token) {
    const parts = String(token || "").split(".");
    if (parts.length < 5 || parts[0] !== "2") return null;

    const count = Number(parts[1]);
    if (![2, 3, 4].includes(count)) return null;

    let dropped = 0;
    const ids = parts.slice(4).slice(0, MAX_PANELS).map((slot) => {
      if (!slot || slot === "_") return null;
      const kind = slot[0];
      const data = slot.slice(1);
      if (!data) return null;
      if (kind === "e") {
        try { return fromBase64Url(data) || null; } catch { return null; }
      }
      if (kind === "u") dropped += 1;
      return null;
    });

    if (!ids.some(Boolean)) return null;
    return { count, x: clamp(Number(parts[2])), y: clamp(Number(parts[3])), ids, dropped };
  }

  function decodeShare(token) {
    // A dotted token is from the old shell; this one's is plain base64.
    if (String(token || "").includes(".")) return decodeLegacyShare(token);

    try {
      const json = decodeURIComponent(escape(fromBase64Url(token)));
      const raw = JSON.parse(json);
      return {
        count: raw.c >= 2 && raw.c <= MAX_PANELS ? raw.c : 4,
        x: clamp(raw.x),
        y: clamp(raw.y),
        ids: Array.isArray(raw.i) ? raw.i : [],
        dropped: 0
      };
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------- data */

  function unwrap(result) {
    return (Array.isArray(result) ? result : result?.data) || [];
  }

  async function loadCatalog() {
    const API = window.EastcoinStreamedAPI;
    if (!API) return;
    const [live, today] = await Promise.all([
      API.getLive().catch(() => null),
      API.getToday().catch(() => null)
    ]);
    const seen = new Map();
    for (const match of [...unwrap(live), ...unwrap(today)]) {
      if (match?.id && !seen.has(match.id)) seen.set(match.id, match);
    }
    local.catalog = [...seen.values()];
    local.catalogLoaded = true;
  }

  async function fillPanel(index, match) {
    local.panels[index] = { match, streams: [], active: 0, loading: true, reason: "" };
    updatePanel(index);

    let streams = [];
    let reason = "";
    try {
      // getStreams takes the MATCH — it walks match.sources itself.
      streams = unwrap(await window.EastcoinStreamedAPI.getStreams(match))
        .filter((s) => s?.embedUrl);
    } catch (error) {
      reason = String(error?.message || "").trim();
    }

    local.panels[index] = { match, streams, active: 0, loading: false, reason };
    save();
    updatePanel(index);
  }

  /* ---------------------------------------------------------- helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function teamBadge(team, size = 18) {
    const badge = el("span", "picker-logo");
    badge.style.width = `${size}px`;
    badge.style.height = `${size}px`;
    const API = window.EastcoinStreamedAPI;
    const url = team?.badge && API?.badgeUrl ? API.badgeUrl(team.badge) : "";
    if (url) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => badge.classList.add("has-badge"));
      img.addEventListener("error", () => img.remove());
      img.src = url;
      badge.append(img);
    }
    return badge;
  }

  /* ---------------------------------------------------------- panels
     Each cell owns its own chrome and body. Updating a panel replaces
     only that cell's contents, and the iframe is reused whenever its
     src is unchanged — so a server switch in panel 1 cannot restart
     panels 2, 3 or 4. */

  function buildCell(index) {
    const cell = el("div", "mv-panel");
    cell.dataset.index = String(index);

    const bar = el("div", "mv-bar");
    bar.append(
      el("span", "mv-title", `Panel ${index + 1}`),
      el("span", "filters-spacer"),
      el("span", "mv-bar-actions")
    );

    const body = el("div", "mv-body");
    cell.append(bar, body);
    return cell;
  }

  function updatePanel(index) {
    const cell = dom.cells[index];
    if (!cell) return;

    const panel = local.panels[index];
    const title = cell.querySelector(".mv-title");
    const actions = cell.querySelector(".mv-bar-actions");
    const body = cell.querySelector(".mv-body");

    title.textContent = panel?.match?.title || `Panel ${index + 1}`;
    actions.replaceChildren();

    if (panel?.match) {
      if (panel.streams.length > 1) actions.append(serverSelect(index, panel));

      const solo = el("button", "mv-chip", "Solo");
      solo.type = "button";
      solo.addEventListener("click", () => {
        history.pushState({ view: "watch" }, "",
          `/?view=watch&event=${encodeURIComponent(panel.match.id)}`);
        shell.go("watch", { push: false });
      });

      const replace = el("button", "mv-chip", "Replace");
      replace.type = "button";
      replace.addEventListener("click", () => openPicker(index));

      const remove = el("button", "mv-chip", "✕");
      remove.type = "button";
      remove.title = "Remove";
      remove.addEventListener("click", () => {
        local.panels[index] = null;
        save();
        updatePanel(index);
      });

      actions.append(solo, replace, remove);
    }

    // --- body ------------------------------------------------
    if (!panel) {
      body.replaceChildren(emptyBody(index));
      return;
    }
    if (panel.loading) {
      body.replaceChildren(el("div", "mv-frame shimmer"));
      return;
    }

    const stream = panel.streams[panel.active];
    if (!stream) {
      const empty = el("div", "mv-empty");
      empty.append(el("span", "mv-empty-note",
        panel.reason || "No playable stream for this one yet."));
      const change = el("button", "btn", "Choose another");
      change.type = "button";
      change.style.cssText = "flex:0 0 auto;padding:0 14px";
      change.addEventListener("click", () => openPicker(index));
      empty.append(change);
      body.replaceChildren(empty);
      return;
    }

    // Reuse the existing iframe when the source hasn't changed.
    const existing = body.querySelector("iframe");
    if (existing && existing.dataset.src === stream.embedUrl) return;

    if (existing && existing.parentElement) {
      existing.dataset.src = stream.embedUrl;
      existing.src = stream.embedUrl;
      return;
    }

    const frame = el("div", "mv-frame");
    const iframe = document.createElement("iframe");
    iframe.dataset.src = stream.embedUrl;
    iframe.src = stream.embedUrl;
    iframe.title = panel.match?.title || `Panel ${index + 1}`;
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer";
    frame.append(iframe);
    body.replaceChildren(frame);
  }

  function serverSelect(index, panel) {
    const wrap = el("label", "mv-select");
    wrap.append(el("span", "sr-only", `Server for panel ${index + 1}`));
    const select = document.createElement("select");
    panel.streams.forEach((stream, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `Server ${i + 1}${stream.hd ? " · HD" : ""}`;
      if (i === panel.active) option.selected = true;
      select.append(option);
    });
    select.addEventListener("change", () => {
      panel.active = Number(select.value) || 0;
      // Only this panel is touched; every other frame keeps playing.
      updatePanel(index);
    });
    wrap.append(select);
    return wrap;
  }

  function emptyBody(index) {
    const empty = el("div", "mv-empty");
    const btn = el("button", "btn primary", "Choose event");
    btn.type = "button";
    btn.style.cssText = "flex:0 0 auto;padding:0 16px";
    btn.addEventListener("click", () => openPicker(index));
    empty.append(el("span", "mv-empty-num", String(index + 1)), btn);
    return empty;
  }

  /* ---------------------------------------------------------- layout */

  function applyLayout() {
    dom.grid.className = `mv-grid count-${local.count}`;
    dom.grid.style.setProperty("--mv-x", `${local.x}%`);
    dom.grid.style.setProperty("--mv-y", `${local.y}%`);

    dom.cells.forEach((cell, index) => {
      cell.hidden = index >= local.count;
    });
    document.body.classList.toggle("mv-bare", local.hideControls);
  }

  function makeResizer(axis) {
    const bar = el("div", `mv-resizer ${axis}`);
    bar.setAttribute("role", "separator");
    bar.setAttribute("aria-orientation", axis === "x" ? "vertical" : "horizontal");
    bar.tabIndex = 0;

    const apply = (value) => {
      local[axis] = clamp(value);
      dom.grid.style.setProperty(`--mv-${axis}`, `${local[axis]}%`);
    };

    bar.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      bar.setPointerCapture(event.pointerId);
      // Iframes swallow pointer events, so drags would stall over them.
      dom.grid.classList.add("is-resizing");

      const move = (ev) => {
        const rect = dom.grid.getBoundingClientRect();
        const pct = axis === "x"
          ? ((ev.clientX - rect.left) / rect.width) * 100
          : ((ev.clientY - rect.top) / rect.height) * 100;
        apply(pct);
      };
      const up = () => {
        dom.grid.classList.remove("is-resizing");
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", up);
        save();
      };
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", up);
    });

    bar.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 5 : 2;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") apply(local[axis] - step);
      else if (event.key === "ArrowRight" || event.key === "ArrowDown") apply(local[axis] + step);
      else return;
      event.preventDefault();
      save();
    });

    bar.addEventListener("dblclick", () => {
      apply(50);
      save();
    });

    return bar;
  }

  /* ---------------------------------------------------------- picker */

  function openPicker(index) {
    local.picking = index;
    local.search = "";
    renderPicker();
  }

  function closePicker() {
    local.picking = -1;
    document.getElementById("mvPicker")?.remove();
  }

  function renderPicker() {
    document.getElementById("mvPicker")?.remove();
    if (local.picking < 0) return;

    const backdrop = el("div", "ticket-backdrop");
    backdrop.id = "mvPicker";

    const panel = el("section", "picker");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Choose an event");

    const head = el("header", "ticket-head");
    head.append(el("strong", null, `Panel ${local.picking + 1}`));
    const close = el("button", "iconbtn", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", closePicker);
    head.append(close);

    const search = document.createElement("input");
    search.className = "picker-search";
    search.type = "search";
    search.placeholder = "Filter events, or paste an https link";
    search.value = local.search;
    search.addEventListener("input", () => {
      local.search = search.value.trim();
      renderList();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (!/^https:\/\/\S+$/i.test(local.search)) return;
      const index = local.picking;
      local.panels[index] = {
        match: { id: `url:${local.search}`, title: "Custom stream" },
        streams: [{ embedUrl: local.search }],
        active: 0,
        loading: false,
        reason: ""
      };
      closePicker();
      save();
      updatePanel(index);
    });

    const list = el("div", "picker-list");

    function renderList() {
      list.replaceChildren();
      if (!local.catalogLoaded) {
        list.append(el("p", "filters-note", "Loading events…"));
        return;
      }

      const term = local.search.toLowerCase();
      const filtered = local.catalog.filter((m) => {
        if (!term) return true;
        return [m.title, m.category, m.teams?.home?.name, m.teams?.away?.name]
          .filter(Boolean).join(" ").toLowerCase().includes(term);
      });

      if (!filtered.length) {
        list.append(el("p", "filters-note", "Nothing matches that."));
        return;
      }

      const Sports = window.ECV3Sports;
      const groups = Sports ? Sports.grouped(filtered) : [["other", filtered]];

      for (const [key, matches] of groups) {
        const header = el("div", "picker-group", Sports ? Sports.label(key) : "Events");
        list.append(header);

        for (const match of matches.slice(0, 40)) {
          const row = el("button", "picker-row");
          row.type = "button";

          const teams = el("span", "picker-teams");
          const home = match?.teams?.home;
          const away = match?.teams?.away;
          if (home?.name && away?.name) {
            const a = el("span", "picker-team");
            a.append(teamBadge(home), el("span", null, home.name));
            const b = el("span", "picker-team");
            b.append(teamBadge(away), el("span", null, away.name));
            teams.append(a, b);
          } else {
            teams.append(el("span", "picker-title", match.title || "Untitled"));
          }

          const meta = el("span", "picker-meta",
            Sports && Sports.isLive(match) ? "Live" : "");
          if (meta.textContent) meta.classList.add("live");

          row.append(teams, meta);
          row.addEventListener("click", () => {
            const index = local.picking;
            closePicker();
            fillPanel(index, match);
          });
          list.append(row);
        }
      }
    }

    panel.append(head, search, list);
    backdrop.append(panel);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closePicker();
    });
    document.body.append(backdrop);
    renderList();
    window.setTimeout(() => search.focus(), 0);
  }

  /* ---------------------------------------------------------- chrome */

  function buildHead() {
    const head = el("div", "viewhead mv-head");
    const wrap = el("div");
    wrap.append(el("h1", null, "MultiView"));
    head.append(wrap);

    const controls = el("div", "mv-controls");
    for (const n of [2, 3, 4]) {
      const btn = el("button", "chip", `${n} panels`);
      btn.type = "button";
      btn.dataset.count = String(n);
      btn.addEventListener("click", () => {
        local.count = n;
        save();
        applyLayout();
        syncCountChips();
      });
      controls.append(btn);
    }

    const clear = el("button", "chip", "Clear all");
    clear.type = "button";
    clear.addEventListener("click", () => {
      local.panels = [];
      save();
      dom.cells.forEach((_, i) => updatePanel(i));
    });

    const hide = el("button", "chip", "Hide controls");
    hide.type = "button";
    hide.addEventListener("click", () => {
      local.hideControls = !local.hideControls;
      hide.textContent = local.hideControls ? "Show controls" : "Hide controls";
      applyLayout();
    });

    const share = el("button", "chip", "Share");
    share.type = "button";
    share.addEventListener("click", async () => {
      const url = `${location.origin}/?view=multiview&m=${encodeShare()}`;
      try {
        await navigator.clipboard.writeText(url);
        share.textContent = "Link copied";
        window.setTimeout(() => {
          share.textContent = "Share";
        }, 1600);
      } catch {
        // Clipboard access can be refused (permissions, insecure context,
        // no user activation). Show the link so it can still be copied by
        // hand rather than leaving a dead "copy failed".
        showShareFallback(url);
      }
    });

    controls.append(clear, hide, share);
    head.append(controls);
    return head;
  }

  function showShareFallback(url) {
    document.getElementById("mvShare")?.remove();
    const backdrop = el("div", "ticket-backdrop");
    backdrop.id = "mvShare";

    const panel = el("section", "picker");
    panel.style.maxHeight = "none";
    const head = el("header", "ticket-head");
    head.append(el("strong", null, "Share this layout"));
    const close = el("button", "iconbtn", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => backdrop.remove());
    head.append(close);

    const field = document.createElement("input");
    field.className = "picker-search";
    field.readOnly = true;
    field.value = url;
    field.addEventListener("focus", () => field.select());

    panel.append(head, field,
      el("p", "filters-note", "Copy the link above — it restores this layout, panels and split."));
    backdrop.append(panel);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.append(backdrop);
    field.focus();
  }

  function syncCountChips() {
    for (const btn of dom.head.querySelectorAll("[data-count]")) {
      btn.setAttribute("aria-pressed", String(Number(btn.dataset.count) === local.count));
    }
  }

  // A floating control so the layout can still be restored once the
  // chrome is hidden — otherwise "Hide controls" is a one-way door.
  function buildRestore() {
    const btn = el("button", "mv-restore", "Show controls");
    btn.type = "button";
    btn.addEventListener("click", () => {
      local.hideControls = false;
      applyLayout();
      const hide = dom.head.querySelector(".mv-controls .chip:nth-last-child(2)");
      if (hide) hide.textContent = "Hide controls";
    });
    return btn;
  }

  /* ---------------------------------------------------------- view */

  const view = {
    async mount(container, api) {
      dom.root = container;
      shell = api;

      const shared = new URL(location.href).searchParams.get("m");
      const decoded = shared ? decodeShare(shared) : null;
      const ids = decoded ? decoded.ids : restore();
      if (decoded) {
        local.count = decoded.count;
        local.x = decoded.x;
        local.y = decoded.y;
      }

      dom.head = buildHead();

      // A shared layout from the old shell could hold pasted links, which
      // this MultiView has no panel type for. Say so: a layout that comes
      // back one short looks like the sender got it wrong otherwise.
      if (decoded?.dropped) {
        const n = decoded.dropped;
        const strip = el("div", "notice-strip");
        strip.textContent =
          n + " panel" + (n === 1 ? " was" : "s were") +
          " a pasted link, which this MultiView can’t restore — " +
          "add " + (n === 1 ? "it" : "them") + " again from the picker.";
        root.append(strip);
      }

      dom.grid = el("div", "mv-grid");
      dom.cells = [];
      for (let i = 0; i < MAX_PANELS; i += 1) {
        const cell = buildCell(i);
        dom.cells.push(cell);
        dom.grid.append(cell);
      }
      dom.grid.append(makeResizer("x"), makeResizer("y"));

      // Lets .view become a flex column so the grid can absorb the
      // leftover height instead of a hardcoded subtraction.
      document.body.classList.add("mv-on");
      container.replaceChildren(dom.head, dom.grid, buildRestore());
      applyLayout();
      syncCountChips();
      dom.cells.forEach((_, i) => updatePanel(i));

      if (!local.catalogLoaded) await loadCatalog();
      if (!container.isConnected) return;

      ids.forEach((id, index) => {
        if (!id || index >= MAX_PANELS || local.panels[index]) return;
        if (String(id).startsWith("url:")) {
          const url = String(id).slice(4);
          local.panels[index] = {
            match: { id, title: "Custom stream" },
            streams: [{ embedUrl: url }],
            active: 0, loading: false, reason: ""
          };
          updatePanel(index);
          return;
        }
        const match = local.catalog.find((m) => m.id === id);
        if (match) fillPanel(index, match);
      });
    },

    unmount() {
      document.body.classList.remove("mv-bare", "mv-on");
      closePicker();
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("multiview", view);
  }
  boot();
})();

/* ============================================================
   EastCoin V3 — MultiView

   The V2 version nests three pages deep: shell -> player.html ->
   provider iframe. That nesting is why it needed a loading mask
   to hide player.html's own first paint. Here each panel resolves
   its streams with the same provider layer the watch view uses
   and mounts the provider iframe directly, so there is no
   intermediate EastCoin page to flash.

   Layout state persists per device; a shared layout does not
   overwrite it.
   ============================================================ */
(() => {
  "use strict";

  const STORE_KEY = "eastcoinV3MultiviewV1";
  const MAX_PANELS = 4;

  const local = {
    count: 4,
    panels: [],          // { match, streams, active, loading, reason }
    picking: -1,         // index of the panel currently choosing an event
    catalog: [],
    catalogLoaded: false,
    search: ""
  };

  let root = null;
  let shell = null;

  /* ---------------------------------------------------------- storage */

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          count: local.count,
          ids: local.panels.map((p) => p?.match?.id || null)
        })
      );
    } catch {
      /* private mode */
    }
  }

  function restore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (raw.count >= 2 && raw.count <= MAX_PANELS) local.count = raw.count;
      return Array.isArray(raw.ids) ? raw.ids : [];
    } catch {
      return [];
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
    const API = window.EastcoinStreamedAPI;
    local.panels[index] = { match, streams: [], active: 0, loading: true, reason: "" };
    paint();

    let streams = [];
    let reason = "";
    try {
      // getStreams takes the MATCH — it walks match.sources itself.
      streams = unwrap(await API.getStreams(match)).filter((s) => s?.embedUrl);
    } catch (error) {
      reason = String(error?.message || "").trim();
    }

    local.panels[index] = { match, streams, active: 0, loading: false, reason };
    save();
    paint();
  }

  /* ---------------------------------------------------------- render */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function panelChrome(index) {
    const panel = local.panels[index];
    const bar = el("div", "mv-bar");

    const title = el("span", "mv-title", panel?.match?.title || `Panel ${index + 1}`);
    bar.append(title);

    const spacer = el("span", "filters-spacer");
    bar.append(spacer);

    if (panel?.streams?.length > 1) {
      panel.streams.forEach((_, i) => {
        const btn = el("button", "mv-chip", String(i + 1));
        btn.type = "button";
        btn.title = `Server ${i + 1}`;
        btn.setAttribute("aria-pressed", String(i === panel.active));
        btn.addEventListener("click", () => {
          panel.active = i;
          paint();
        });
        bar.append(btn);
      });
    }

    if (panel?.match) {
      const solo = el("button", "mv-chip", "Solo");
      solo.type = "button";
      solo.addEventListener("click", () => {
        history.pushState({ view: "watch" }, "",
          `/v3/?view=watch&event=${encodeURIComponent(panel.match.id)}`);
        shell.go("watch", { push: false });
      });

      const clear = el("button", "mv-chip", "✕");
      clear.type = "button";
      clear.title = "Remove";
      clear.addEventListener("click", () => {
        local.panels[index] = null;
        save();
        paint();
      });
      bar.append(solo, clear);
    }

    return bar;
  }

  function panelBody(index) {
    const panel = local.panels[index];

    if (!panel) {
      const empty = el("div", "mv-empty");
      const btn = el("button", "btn primary", "Choose event");
      btn.type = "button";
      btn.style.flex = "0 0 auto";
      btn.style.padding = "0 16px";
      btn.addEventListener("click", () => {
        local.picking = index;
        local.search = "";
        paint();
      });
      empty.append(el("span", "mv-empty-num", String(index + 1)), btn);
      return empty;
    }

    if (panel.loading) return el("div", "mv-frame shimmer");

    const stream = panel.streams[panel.active];
    if (!stream) {
      const empty = el("div", "mv-empty");
      empty.append(el("span", "mv-empty-note",
        panel.reason || "No playable stream for this one yet."));
      const change = el("button", "btn", "Choose another");
      change.type = "button";
      change.style.cssText = "flex:0 0 auto;padding:0 14px";
      change.addEventListener("click", () => {
        local.picking = index;
        paint();
      });
      empty.append(change);
      return empty;
    }

    const frame = el("div", "mv-frame");
    const iframe = document.createElement("iframe");
    iframe.src = stream.embedUrl;
    iframe.title = panel.match?.title || `Panel ${index + 1}`;
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer";
    frame.append(iframe);
    return frame;
  }

  function picker() {
    const backdrop = el("div", "ticket-backdrop");
    const panel = el("section", "picker");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Choose an event");

    const head = el("header", "ticket-head");
    head.append(el("strong", null, `Panel ${local.picking + 1}`));
    const close = el("button", "iconbtn", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => {
      local.picking = -1;
      paint();
    });
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
      const value = local.search;
      if (!/^https:\/\/\S+$/i.test(value)) return;
      const index = local.picking;
      local.panels[index] = {
        match: { id: `url:${value}`, title: "Custom stream" },
        streams: [{ embedUrl: value }],
        active: 0,
        loading: false,
        reason: ""
      };
      local.picking = -1;
      save();
      paint();
    });

    const list = el("div", "picker-list");

    function renderList() {
      list.replaceChildren();
      const term = local.search.toLowerCase();
      const rows = local.catalog
        .filter((m) => !term || String(m.title || "").toLowerCase().includes(term))
        .slice(0, 60);

      if (!local.catalogLoaded) {
        list.append(el("p", "filters-note", "Loading events…"));
        return;
      }
      if (!rows.length) {
        list.append(el("p", "filters-note", "Nothing matches that."));
        return;
      }
      for (const match of rows) {
        const row = el("button", "picker-row");
        row.type = "button";
        row.append(
          el("span", "picker-title", match.title || "Untitled"),
          el("span", "picker-meta", String(match.category || "").replace("-", " "))
        );
        row.addEventListener("click", () => {
          const index = local.picking;
          local.picking = -1;
          fillPanel(index, match);
        });
        list.append(row);
      }
    }

    panel.append(head, search, list);
    backdrop.append(panel);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        local.picking = -1;
        paint();
      }
    });
    renderList();
    window.setTimeout(() => search.focus(), 0);
    return backdrop;
  }

  function paint() {
    root.replaceChildren();

    const head = el("div", "viewhead");
    const wrap = el("div");
    wrap.append(el("h1", null, "MultiView"));
    head.append(wrap);

    const controls = el("div", "mv-controls");
    for (const n of [2, 3, 4]) {
      const btn = el("button", "chip", `${n} panels`);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(local.count === n));
      btn.addEventListener("click", () => {
        local.count = n;
        save();
        paint();
      });
      controls.append(btn);
    }
    const clear = el("button", "chip", "Clear all");
    clear.type = "button";
    clear.addEventListener("click", () => {
      local.panels = [];
      save();
      paint();
    });
    controls.append(clear);
    head.append(controls);
    root.append(head);

    const grid = el("div", `mv-grid count-${local.count}`);
    for (let i = 0; i < local.count; i += 1) {
      const cell = el("div", "mv-panel");
      cell.append(panelChrome(i), panelBody(i));
      grid.append(cell);
    }
    root.append(grid);

    if (local.picking >= 0) root.append(picker());
  }

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;

      const ids = restore();
      paint();

      if (!local.catalogLoaded) {
        await loadCatalog();
        if (!root.isConnected) return;

        // Rehydrate saved panels once the catalogue is known.
        ids.forEach((id, index) => {
          if (!id || index >= local.count || local.panels[index]) return;
          const match = local.catalog.find((m) => m.id === id);
          if (match) fillPanel(index, match);
        });
        paint();
      }
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("multiview", view);
  }
  boot();
})();

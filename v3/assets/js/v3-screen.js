/* ============================================================
   EastCoin V3 — Screening Room

   Movies and shows, inside the shell. The player is vidy.st,
   keyed by TMDB id; the catalog, artwork and episode lists come
   from TMDB through /api/screen/*. Progress is kept on the device
   (same key the test page used, so nothing is lost moving over).

     /?view=screen                         browse
     /?view=screen&kind=tv&list=top        a shelf
     /?view=screen&t=tv&id=1396&s=2&e=5    playing something
   ============================================================ */
(() => {
  "use strict";

  const PLAYER = "https://www.vidy.st";
  const ACCENT = "e8bf35";
  const STORE = "eastcoinScreenProgressV1";

  const LISTS = [
    ["trending", "Trending"],
    ["popular", "Popular"],
    ["top", "Top rated"],
    ["new", "New"],
    ["upcoming", "Upcoming"]
  ];
  const SORTS = [["", "Default order"], ["popular", "Most popular"], ["rating", "Highest rated"], ["date", "Newest first"]];

  const local = {
    kind: "movie",          // movie | tv
    list: "trending",
    genre: "",
    sort: "",
    page: 1,
    pages: 1,
    items: [],
    genres: { movie: [], tv: [] },
    query: "",
    results: null,
    now: null,              // what is playing
    details: null,
    episodes: [],
    loading: false,
    epsOpen: false,
    hasKey: true
  };

  let root = null;
  let shell = null;
  let refs = {};
  let iframe = null;
  let searchTimer = 0;
  let seq = 0;

  /* ---------------------------------------------------------- helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function btn(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  async function getJson(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch {
      return null;
    }
  }

  function keyFor(item) { return `${item.type}:${item.id}`; }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
  }
  function saveProgress(map) {
    try { localStorage.setItem(STORE, JSON.stringify(map)); } catch { /* private mode */ }
  }

  function remember(item, current, duration) {
    if (!item || !Number.isFinite(current) || !Number.isFinite(duration) || duration < 60) return;
    const map = loadProgress();
    const done = current / duration > 0.95;
    map[keyFor(item)] = {
      type: item.type, id: item.id, title: item.title, year: item.year || "", poster: item.poster || "",
      season: item.season || null, episode: item.episode || null,
      seconds: done ? 0 : Math.floor(current), duration: Math.floor(duration), at: Date.now()
    };
    if (done && item.type === "movie") delete map[keyFor(item)];
    saveProgress(map);
    renderContinue();
  }

  function writeUrl() {
    const url = new URL(location.href);
    if (url.searchParams.get("view") !== "screen") return;
    for (const k of ["t", "id", "s", "e", "kind", "list", "genre", "sort"]) url.searchParams.delete(k);
    if (local.now) {
      url.searchParams.set("t", local.now.type);
      url.searchParams.set("id", String(local.now.id));
      if (local.now.type === "tv") { url.searchParams.set("s", String(local.now.season)); url.searchParams.set("e", String(local.now.episode)); }
    }
    if (local.kind !== "movie") url.searchParams.set("kind", local.kind);
    if (local.list !== "trending") url.searchParams.set("list", local.list);
    if (local.genre) url.searchParams.set("genre", local.genre);
    if (local.sort) url.searchParams.set("sort", local.sort);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  function readUrl() {
    const p = new URL(location.href).searchParams;
    local.kind = p.get("kind") === "tv" ? "tv" : "movie";
    local.list = LISTS.some(([k]) => k === p.get("list")) ? p.get("list") : "trending";
    local.genre = String(p.get("genre") || "").replace(/[^\d]/g, "");
    local.sort = SORTS.some(([k]) => k === p.get("sort")) ? p.get("sort") : "";
    const t = p.get("t");
    const id = Number(p.get("id"));
    if ((t === "movie" || t === "tv") && Number.isInteger(id) && id > 0) {
      return { type: t, id, title: t === "tv" ? `Show #${id}` : `Movie #${id}`, season: Number(p.get("s")) || 1, episode: Number(p.get("e")) || 1 };
    }
    return null;
  }

  /* ---------------------------------------------------------- player */

  function embedUrl(item, resume) {
    const p = new URLSearchParams({ color: ACCENT });
    if (resume > 0) p.set("progress", String(resume));
    if (item.type === "tv") {
      p.set("nextEpisode", "true");
      p.set("episodeSelector", "true");
      p.set("autoplayNextEpisode", "true");
      return `${PLAYER}/tv/${item.id}/${item.season || 1}/${item.episode || 1}?${p}`;
    }
    return `${PLAYER}/movie/${item.id}?${p}`;
  }

  function play(item, { resume = 0 } = {}) {
    local.now = { ...item };
    if (item.type === "tv") {
      local.now.season = item.season || 1;
      local.now.episode = item.episode || 1;
    }
    const saved = loadProgress()[keyFor(local.now)];
    const from = resume || (saved && saved.season === (local.now.season || null) && saved.episode === (local.now.episode || null) ? saved.seconds : 0);

    if (iframe) iframe.remove();
    iframe = document.createElement("iframe");
    iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "origin";
    iframe.src = embedUrl(local.now, from);
    refs.frame.append(iframe);
    refs.stage.hidden = false;
    refs.stage.classList.add("is-playing");
    // The video is the page while something plays: heading, search and
    // shelves step aside, same as the event player.
    document.body.classList.add("screen-on");

    refs.nowTitle.textContent = local.now.title;
    refs.nowMeta.textContent = local.now.type === "tv"
      ? `S${local.now.season} · E${local.now.episode}${local.now.year ? " · " + local.now.year : ""}`
      : local.now.year || "";
    refs.prevEp.hidden = refs.nextEp.hidden = local.now.type !== "tv";
    refs.seasonSel.hidden = local.now.type !== "tv";
    refs.epToggle.hidden = local.now.type !== "tv";
    if (local.now.type !== "tv") refs.epStrip.hidden = true;

    writeUrl();
    window.scrollTo(0, 0);
    loadDetails();
  }

  function stop() {
    if (iframe) iframe.remove();
    iframe = null;
    local.now = null;
    refs.stage.hidden = true;
    refs.stage.classList.remove("is-playing");
    document.body.classList.remove("screen-on");
    writeUrl();
    renderContinue();
  }

  async function loadDetails() {
    const item = local.now;
    if (!item || !local.hasKey) return;
    const q = new URLSearchParams({ type: item.type, id: String(item.id) });
    if (item.type === "tv") q.set("season", String(item.season));
    const payload = await getJson(`/api/screen/title?${q}`);
    if (!payload?.ok || local.now !== item) return;

    const t = payload.title;
    local.details = t;
    if (t.title && /^(Show|Movie) #/.test(item.title)) { item.title = t.title; refs.nowTitle.textContent = t.title; }
    if (t.poster && !item.poster) item.poster = t.poster;
    if (t.year && !item.year) item.year = t.year;
    refs.nowMeta.textContent = item.type === "tv"
      ? `S${item.season} · E${item.episode} · ${t.year}${t.runtime ? " · " + t.runtime + " min" : ""}`
      : [t.year, t.runtime ? `${t.runtime} min` : "", t.rating ? `★ ${t.rating}` : ""].filter(Boolean).join(" · ");

    if (item.type === "tv") {
      refs.seasonSel.replaceChildren();
      for (const s of t.seasons || []) {
        const o = el("option", null, `${s.name || "Season " + s.number} · ${s.episodes} ep`);
        o.value = String(s.number);
        if (s.number === item.season) o.selected = true;
        refs.seasonSel.append(o);
      }
      local.episodes = payload.season?.episodes || [];
      renderEpisodes();
    }
  }

  function renderEpisodes() {
    const item = local.now;
    refs.epStrip.replaceChildren();
    if (!item || item.type !== "tv" || !local.episodes.length) { refs.epStrip.hidden = true; return; }
    // Stays folded unless the viewer opened it; the bar's Episodes button toggles it.
    for (const ep of local.episodes) {
      const b = el("button", `sc-ep${ep.number === item.episode ? " on" : ""}`);
      b.type = "button";
      if (ep.still) { const img = el("img", "sc-still"); img.src = ep.still; img.alt = ""; img.loading = "lazy"; b.append(img); }
      else b.append(el("div", "sc-still"));
      const meta = el("div", "sc-ep-meta");
      meta.append(el("b", null, `${ep.number}. ${ep.name || "Episode " + ep.number}`), el("small", null, ep.runtime ? `${ep.runtime} min` : ep.aired || ""));
      b.append(meta);
      b.addEventListener("click", () => play({ ...item, episode: ep.number }));
      refs.epStrip.append(b);
    }
    refs.epStrip.hidden = !local.epsOpen;
    if (local.epsOpen) refs.epStrip.querySelector(".sc-ep.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }

  function onMessage(event) {
    let host = "";
    try { host = new URL(event.origin).hostname; } catch { return; }
    if (!/(^|\.)vidy\.st$/.test(host)) return;
    let data = event.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
    if (!data || data.type !== "PLAYER_EVENT") return;
    const d = data.data || data;
    const ev = d.event || d.name;
    if (ev === "timeupdate" || ev === "pause" || ev === "ended") remember(local.now, Number(d.currentTime), Number(d.duration));
  }

  /* ---------------------------------------------------------- cards */

  function card(item, progress) {
    const b = el("button", "sc-card");
    b.type = "button";
    if (item.poster) { const img = el("img", "sc-poster"); img.src = item.poster; img.alt = ""; img.loading = "lazy"; b.append(img); }
    else b.append(el("div", "sc-ph", (item.title || "?").split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()));
    b.append(el("span", "sc-kind", item.type === "tv" ? "SHOW" : "MOVIE"));
    const cap = el("div", "sc-cap");
    cap.append(el("b", null, item.title));
    const pct = progress ? Math.round(100 * progress.seconds / progress.duration) : 0;
    cap.append(el("small", null, progress
      ? `${progress.season ? `S${progress.season} · E${progress.episode} · ` : ""}${pct}%`
      : [item.year, item.rating ? `★ ${item.rating}` : ""].filter(Boolean).join(" · ")));
    b.append(cap);
    if (progress) {
      const bar = el("div", "sc-prog");
      const i = el("i");
      i.style.width = `${pct}%`;
      bar.append(i);
      b.append(bar);
    }
    b.addEventListener("click", () => play(
      progress ? { ...item, season: progress.season, episode: progress.episode } : item,
      { resume: progress ? progress.seconds : 0 }
    ));
    return b;
  }

  function renderContinue() {
    if (!refs.continueRow) return;
    const items = Object.values(loadProgress()).filter((p) => p.seconds > 30).sort((a, b) => b.at - a.at).slice(0, 12);
    refs.continueRow.replaceChildren();
    for (const p of items) refs.continueRow.append(card(p, p));
    refs.continueSec.hidden = !items.length;
  }

  /* ---------------------------------------------------------- shelves */

  async function loadShelf({ append = false } = {}) {
    if (!local.hasKey) return;
    const mine = ++seq;
    local.loading = true;
    renderShelfHead();
    if (!append) { local.page = 1; refs.grid.replaceChildren(); refs.grid.append(skeletons()); }

    const q = new URLSearchParams({ type: local.kind, list: local.list, page: String(local.page) });
    if (local.genre) q.set("genre", local.genre);
    if (local.sort) q.set("sort", local.sort);
    const payload = await getJson(`/api/screen/browse?${q}`);
    if (mine !== seq) return;
    local.loading = false;

    if (!payload?.ok) {
      refs.grid.replaceChildren(emptyNote("Couldn't load that shelf", payload?.code === "NO_TMDB_KEY" ? "The server has no TMDB key." : "TMDB didn't answer. Try again in a moment."));
      refs.more.hidden = true;
      return;
    }
    local.pages = payload.pages;
    if (!append) { refs.grid.replaceChildren(); local.items = []; }
    for (const item of payload.results) { local.items.push(item); refs.grid.append(card(item)); }
    if (!local.items.length) refs.grid.append(emptyNote("Nothing here", "Try another genre or list."));
    refs.more.hidden = local.page >= local.pages;
    renderShelfHead();
  }

  function skeletons() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 12; i += 1) frag.append(el("div", "sc-card sc-skel"));
    return frag;
  }

  function emptyNote(strong, text) {
    const box = el("div", "empty");
    box.append(el("strong", null, strong), el("p", null, text));
    return box;
  }

  function renderShelfHead() {
    const listName = (LISTS.find(([k]) => k === local.list) || LISTS[0])[1];
    const genreName = local.genres[local.kind].find((g) => String(g.id) === local.genre)?.name;
    const sortName = SORTS.find(([k]) => k === local.sort)?.[1];
    refs.shelfTitle.textContent = genreName ? `${genreName} ${local.kind === "tv" ? "shows" : "movies"}` : `${listName} ${local.kind === "tv" ? "shows" : "movies"}`;
    refs.shelfNote.textContent = local.sort && sortName ? sortName.toLowerCase() : local.loading ? "loading…" : `${local.items.length} title${local.items.length === 1 ? "" : "s"}`;
  }

  function renderFilters() {
    refs.filters.replaceChildren();

    const kinds = el("div", "sc-seg");
    for (const [k, label] of [["movie", "Movies"], ["tv", "Shows"]]) {
      const b = btn(label, `sc-seg-btn${local.kind === k ? " on" : ""}`, () => {
        if (local.kind === k) return;
        local.kind = k;
        local.genre = "";
        renderFilters();
        writeUrl();
        loadShelf();
      });
      kinds.append(b);
    }
    refs.filters.append(kinds);

    const lists = el("div", "sc-chips");
    for (const [k, label] of LISTS) {
      lists.append(btn(label, `sc-chip${local.list === k && !local.genre && !local.sort ? " on" : ""}`, () => {
        local.list = k;
        local.genre = "";
        local.sort = "";
        renderFilters();
        writeUrl();
        loadShelf();
      }));
    }
    refs.filters.append(lists);

    const genre = el("select", "sc-select");
    genre.setAttribute("aria-label", "Genre");
    const any = el("option", null, "All genres");
    any.value = "";
    genre.append(any);
    for (const g of local.genres[local.kind]) {
      const o = el("option", null, g.name);
      o.value = String(g.id);
      if (String(g.id) === local.genre) o.selected = true;
      genre.append(o);
    }
    genre.addEventListener("change", () => {
      local.genre = genre.value;
      renderFilters();
      writeUrl();
      loadShelf();
    });

    const sort = el("select", "sc-select");
    sort.setAttribute("aria-label", "Sort");
    for (const [k, label] of SORTS) {
      const o = el("option", null, label);
      o.value = k;
      if (k === local.sort) o.selected = true;
      sort.append(o);
    }
    sort.addEventListener("change", () => {
      local.sort = sort.value;
      renderFilters();
      writeUrl();
      loadShelf();
    });

    const selects = el("div", "sc-selects");
    selects.append(genre, sort);
    refs.filters.append(selects);
  }

  /* ---------------------------------------------------------- search */

  async function search(q) {
    const mine = ++seq;
    const payload = await getJson(`/api/screen/search?q=${encodeURIComponent(q)}`);
    if (mine !== seq) return;
    refs.resultsRow.replaceChildren();
    if (!payload?.ok) {
      refs.resultsNote.textContent = payload?.code === "NO_TMDB_KEY" ? "needs a TMDB key" : "search didn't answer";
    } else {
      refs.resultsNote.textContent = `${payload.results.length} for “${q}”`;
      for (const r of payload.results) refs.resultsRow.append(card(r));
      if (!payload.results.length) refs.resultsRow.append(emptyNote("Nothing by that name", "Check the spelling, or try the shelves below."));
    }
    refs.resultsSec.hidden = false;
  }

  /* ---------------------------------------------------------- build */

  function build() {
    root.replaceChildren();
    refs = {};
    const page = el("section", "screen");

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Screening Room"), el("p", null, "Movies and shows. Pick something; it plays right here, with chat alongside."));
    head.append(copy);
    const search = el("div", "sc-search");
    const input = el("input");
    input.type = "search";
    input.placeholder = "Search movies and shows";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Search movies and shows");
    input.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      local.query = q;
      if (q.length < 2) { refs.resultsSec.hidden = true; seq += 1; return; }
      searchTimer = setTimeout(() => search(q), 350);
    });
    search.append(input);
    head.append(search);
    page.append(head);

    // Player
    const stage = el("section", "sc-stage");
    stage.hidden = true;
    const frame = el("div", "sc-frame");
    stage.append(frame);
    const bar = el("div", "sc-bar");
    const title = el("div", "sc-now");
    const nowTitle = el("strong");
    const nowMeta = el("span");
    title.append(nowTitle, nowMeta);
    const seasonSel = el("select", "sc-select");
    seasonSel.hidden = true;
    seasonSel.setAttribute("aria-label", "Season");
    seasonSel.addEventListener("change", () => { if (local.now?.type === "tv") play({ ...local.now, season: Number(seasonSel.value), episode: 1 }); });
    const prevEp = btn("‹ Prev", "sc-btn", () => { if (local.now?.type === "tv" && local.now.episode > 1) play({ ...local.now, episode: local.now.episode - 1 }); });
    const nextEp = btn("Next ›", "sc-btn", () => { if (local.now?.type === "tv") play({ ...local.now, episode: local.now.episode + 1 }); });
    const epToggle = btn("Episodes", "sc-btn", () => {
      local.epsOpen = !local.epsOpen;
      epToggle.classList.toggle("on", local.epsOpen);
      renderEpisodes();
    });
    epToggle.hidden = true;
    const openSrc = btn("Open source ↗", "sc-btn", () => { if (iframe) window.open(iframe.src, "_blank", "noopener"); });
    const copyLink = btn("Copy link", "sc-btn gold", async () => {
      try { await navigator.clipboard.writeText(location.href); copyLink.textContent = "Copied"; }
      catch { copyLink.textContent = "Couldn't copy"; }
      setTimeout(() => { copyLink.textContent = "Copy link"; }, 1600);
    });
    const close = btn("✕", "sc-btn", stop);
    close.title = "Close player";
    bar.append(title, seasonSel, prevEp, nextEp, epToggle, openSrc, copyLink, close);
    stage.append(bar);
    const epStrip = el("div", "sc-eps");
    epStrip.hidden = true;
    stage.append(epStrip);
    page.append(stage);
    Object.assign(refs, { stage, frame, nowTitle, nowMeta, seasonSel, prevEp, nextEp, epToggle, epStrip });

    // Continue watching
    const continueSec = el("section", "sc-section");
    continueSec.hidden = true;
    const ch = el("h2", null, "Continue watching");
    ch.append(el("small", null, "saved on this device"));
    const continueRow = el("div", "sc-grid");
    continueSec.append(ch, continueRow);
    page.append(continueSec);
    Object.assign(refs, { continueSec, continueRow });

    // Search results
    const resultsSec = el("section", "sc-section");
    resultsSec.hidden = true;
    const rh = el("h2", null, "Results");
    const resultsNote = el("small");
    rh.append(resultsNote);
    const resultsRow = el("div", "sc-grid");
    resultsSec.append(rh, resultsRow);
    page.append(resultsSec);
    Object.assign(refs, { resultsSec, resultsNote, resultsRow });

    // Shelves
    const shelf = el("section", "sc-section");
    const filters = el("div", "sc-filters");
    shelf.append(filters);
    const sh = el("h2");
    const shelfTitle = el("span");
    const shelfNote = el("small");
    sh.append(shelfTitle, shelfNote);
    shelf.append(sh);
    const grid = el("div", "sc-grid");
    shelf.append(grid);
    const more = btn("Load more", "sc-btn sc-more", () => {
      if (local.loading || local.page >= local.pages) return;
      local.page += 1;
      loadShelf({ append: true });
    });
    more.hidden = true;
    shelf.append(more);
    page.append(shelf);
    Object.assign(refs, { filters, shelfTitle, shelfNote, grid, more });

    // TMDB's terms ask for the logo and this exact wording.
    const credit = el("footer", "sc-credit");
    const logo = el("img");
    logo.src = "/v3/assets/img/tmdb.svg";
    logo.alt = "TMDB";
    logo.width = 92;
    logo.height = 12;
    const creditLink = el("a", null, "TMDB");
    creditLink.href = "https://www.themoviedb.org/";
    creditLink.target = "_blank";
    creditLink.rel = "noopener";
    const line = el("p");
    line.append("Titles, artwork and episode data from ", creditLink, ". This product uses the TMDB API but is not endorsed or certified by TMDB.");
    credit.append(logo, line);
    page.append(credit);

    root.append(page);
  }

  /* ---------------------------------------------------------- view */

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;
      build();
      window.addEventListener("message", onMessage);

      const wanted = readUrl();
      renderFilters();
      renderContinue();
      if (wanted) play(wanted);

      // Genres once per kind, then the shelf.
      for (const kind of ["movie", "tv"]) {
        if (local.genres[kind].length) continue;
        const payload = await getJson(`/api/screen/browse?type=${kind}&list=genres`);
        if (payload?.code === "NO_TMDB_KEY") { local.hasKey = false; break; }
        if (payload?.ok) local.genres[kind] = payload.genres;
      }
      if (!root.isConnected) return;
      renderFilters();
      if (!local.hasKey) {
        refs.grid.replaceChildren(emptyNote("Screening Room isn't configured", "The server needs a TMDB key (TMDB_API_KEY) for the catalog."));
        return;
      }
      loadShelf();
    },
    unmount() {
      document.body.classList.remove("screen-on");
      window.removeEventListener("message", onMessage);
      clearTimeout(searchTimer);
      seq += 1;
      if (iframe) iframe.remove();
      iframe = null;
      local.now = null;
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("screen", view);
  }
  boot();
})();

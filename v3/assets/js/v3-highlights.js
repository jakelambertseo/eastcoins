/* ============================================================
   Highlights — /?view=highlights (2026-09-15, test page, not linked)

   Sports Shorts from chosen YouTube channels (/api/highlights): a
   strip of vertical cards, and a player that opens above it. The
   player sits in the page, never over the Twitch chat rail, and moves
   to the next clip when one ends (the YouTube embed reports its state
   through postMessage once it is told we are listening).
   ============================================================ */
(() => {
  const CSS = "/v3/assets/css/v3-highlights.css?v=1";
  const FILTERS = [["all", "All"], ["nfl", "NFL"], ["cfb", "College"], ["mlb", "MLB"]];

  let root = null;
  let refs = {};
  let clips = [];
  let filter = "all";
  let playing = -1;
  let token = 0;

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
  function needCss() {
    if (document.getElementById("css-highlights")) return;
    const link = document.createElement("link");
    link.id = "css-highlights"; link.rel = "stylesheet"; link.href = CSS;
    document.head.append(link);
  }
  function ago(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (!Number.isFinite(s)) return "";
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  }
  const shown = () => clips.filter((c) => filter === "all" || c.sport === filter);

  /* ---------------------------------------------------------- cards */

  function card(c, i) {
    const b = el("button", `hl-card${i === playing ? " on" : ""}`);
    b.type = "button";
    b.setAttribute("aria-label", `${c.title}, ${c.channel}`);
    // Shorts carry a vertical thumbnail at oardefault; fall back to the
    // standard one, cropped by object-fit, when a clip has none.
    const img = el("img", "hl-thumb");
    img.alt = "";
    img.loading = "lazy";
    img.src = `https://i.ytimg.com/vi/${c.id}/oardefault.jpg`;
    img.addEventListener("error", () => { if (!img.dataset.fell) { img.dataset.fell = "1"; img.src = `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`; } }, { once: false });
    b.append(img, el("span", "hl-shade"));
    const top = el("span", "hl-src");
    top.append(el("i", `hl-sport ${c.sport}`, c.sport === "other" ? "SPORTS" : c.sport.toUpperCase()), document.createTextNode(c.channel));
    const cap = el("span", "hl-cap");
    cap.append(el("b", null, c.title), el("small", null, ago(c.publishedAt)));
    b.append(top, el("span", "hl-play", "▶"), cap);
    b.addEventListener("click", () => play(i));
    return b;
  }

  function renderRow() {
    const list = shown();
    refs.row.replaceChildren();
    if (!list.length) {
      refs.row.append(el("p", "hl-empty", clips.length ? "Nothing in this filter right now." : "No highlights yet."));
      return;
    }
    list.forEach((c, i) => refs.row.append(card(c, i)));
    for (const [key, b] of Object.entries(refs.chips)) {
      const n = key === "all" ? clips.length : clips.filter((c) => c.sport === key).length;
      b.classList.toggle("on", key === filter);
      b.setAttribute("aria-pressed", String(key === filter));
      b.lastChild.textContent = String(n);
    }
  }

  /* ---------------------------------------------------------- player */

  function play(i) {
    const list = shown();
    if (!list.length) return;
    playing = (i + list.length) % list.length;
    const c = list[playing];
    const frame = el("iframe", "hl-frame");
    const q = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0", modestbranding: "1", enablejsapi: "1", origin: location.origin });
    frame.src = `https://www.youtube-nocookie.com/embed/${c.id}?${q}`;
    frame.title = c.title;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.addEventListener("load", () => {
      // Ask the embed to report its state, so an ended clip rolls on.
      try { frame.contentWindow.postMessage(JSON.stringify({ event: "listening", id: playing, channel: "widget" }), "*"); } catch { /* cross-origin quirks */ }
    });
    refs.video.replaceChildren(frame);
    refs.title.textContent = c.title;
    refs.meta.textContent = `${c.channel} · ${ago(c.publishedAt)}`;
    refs.count.textContent = `${playing + 1} of ${list.length}`;
    refs.yt.href = `https://www.youtube.com/shorts/${c.id}`;
    refs.stage.hidden = false;
    renderRow();
    refs.row.children[playing]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    refs.stage.scrollIntoView({ block: "nearest" });
  }

  function close() {
    playing = -1;
    refs.video.replaceChildren();
    refs.stage.hidden = true;
    renderRow();
  }

  function onMessage(event) {
    if (playing < 0 || !/youtube(-nocookie)?\.com$/.test(new URL(event.origin || "https://x").hostname)) return;
    let data = event.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
    const ended = (data?.event === "onStateChange" && data.info === 0) || (data?.event === "infoDelivery" && data.info?.playerState === 0);
    if (ended) play(playing + 1);
  }

  function onKey(event) {
    if (!root?.isConnected || refs.stage?.hidden || event.target.closest?.("input, textarea, select")) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); play(playing + 1); }
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); play(playing - 1); }
    else if (event.key === "Escape") close();
  }

  /* ---------------------------------------------------------- page */

  function build() {
    refs = { chips: {} };
    const page = el("section", "hl");
    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Highlights"), el("p", null, "Sports Shorts from the NFL, ESPN and friends. Test page — not linked anywhere yet."));
    head.append(copy);
    page.append(head);

    const bar = el("div", "hl-bar");
    const chips = el("div", "hl-chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Filter highlights");
    for (const [key, label] of FILTERS) {
      const b = btn(label, "hl-chip", () => { filter = key; playing = -1; refs.stage.hidden = true; refs.video.replaceChildren(); renderRow(); });
      b.append(el("em", null, ""));
      refs.chips[key] = b;
      chips.append(b);
    }
    refs.note = el("small", "hl-note", "Loading…");
    bar.append(chips, refs.note);
    page.append(bar);

    // The player: in the page, above the strip.
    const stage = el("div", "hl-stage");
    stage.hidden = true;
    const video = el("div", "hl-video");
    const side = el("div", "hl-side");
    const count = el("span", "hl-count");
    const title = el("h2", "hl-title");
    const meta = el("p", "hl-meta");
    const controls = el("div", "hl-controls");
    const yt = el("a", "hl-btn", "Open on YouTube ↗");
    yt.target = "_blank"; yt.rel = "noopener";
    const copyBtn = btn("Copy link", "hl-btn", async () => {
      try { await navigator.clipboard.writeText(yt.href); copyBtn.textContent = "Copied"; } catch { copyBtn.textContent = "Couldn't copy"; }
      setTimeout(() => { copyBtn.textContent = "Copy link"; }, 1500);
    });
    controls.append(btn("↑ Previous", "hl-btn", () => play(playing - 1)), btn("Next ↓", "hl-btn gold", () => play(playing + 1)), yt, copyBtn, btn("Close", "hl-btn", close));
    side.append(count, title, meta, controls, el("p", "hl-tip", "Arrow keys move between clips. The next one starts when a clip ends."));
    stage.append(video, side);
    page.append(stage);
    Object.assign(refs, { stage, video, count, title, meta, yt });

    const rowWrap = el("div", "hl-rowwrap");
    const row = el("div", "hl-row");
    rowWrap.append(btn("‹", "hl-arrow l", () => row.scrollBy({ left: -row.clientWidth * 0.8, behavior: "smooth" })), row,
      btn("›", "hl-arrow r", () => row.scrollBy({ left: row.clientWidth * 0.8, behavior: "smooth" })));
    rowWrap.firstChild.setAttribute("aria-label", "Scroll left");
    rowWrap.lastChild.setAttribute("aria-label", "Scroll right");
    refs.row = row;
    page.append(rowWrap);

    refs.channels = el("details", "hl-channels");
    page.append(refs.channels);
    root.replaceChildren(page);
  }

  async function load() {
    const mine = ++token;
    const r = await fetch("/api/highlights").then((x) => x.json()).catch(() => null);
    if (mine !== token || !root?.isConnected) return;
    if (!r?.ok) {
      clips = [];
      refs.note.textContent = r?.message || "Highlights didn't load.";
      renderRow();
    } else {
      clips = r.clips || [];
      refs.note.textContent = `${clips.length} clips · updated ${ago(r.fetchedAt)}${r.stale ? " · showing the last good copy" : ""}`;
      renderRow();
    }
    // For testing: which channels answered.
    const list = r?.channels || [];
    refs.channels.replaceChildren(el("summary", null, `Channels (${list.filter((c) => c.ok).length} of ${list.length} working)`));
    const ul = el("ul");
    for (const c of list) ul.append(el("li", c.ok ? "ok" : "bad", `@${c.handle} — ${c.ok ? `${c.clips} clips` : c.why}`));
    refs.channels.append(ul);
  }

  const view = {
    mount(container) {
      root = container;
      needCss();
      filter = "all"; playing = -1;
      build();
      window.addEventListener("message", onMessage);
      document.addEventListener("keydown", onKey);
      load();
    },
    unmount() {
      token += 1;
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKey);
      if (refs.video) refs.video.replaceChildren();
      root = null;
    }
  };

  function boot() {
    if (window.ECV3?.register) window.ECV3.register("highlights", view);
    else setTimeout(boot, 30);
  }
  boot();
})();

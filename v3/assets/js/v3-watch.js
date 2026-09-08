/* ============================================================
   EastCoin V3 — watch view

   Deliberately thin: it resolves streams through the existing
   provider layer and mounts one iframe. It does NOT nest a
   second EastCoin page inside itself the way V2's MultiView
   does (shell -> player.html -> provider), which is what made
   the old first-paint flash necessary.

   The video is the page. There is no heading — you already know
   what you clicked — and the frame takes every pixel the shell
   is not using. Controls sit in a bar above it that folds away
   to a single chevron.

   One rule shapes the DOM here: the iframe is built once and
   only ever has its src reassigned. Rebuilding it restarts the
   stream, so anything that is not a deliberate server change —
   folding the bar, copying a link — must not touch it.
   ============================================================ */
(() => {
  "use strict";

  const CONTROLS_KEY = "ec_v3_watch_controls";

  const local = {
    match: null,
    streams: [],
    active: 0,
    loading: false,
    error: "",
    reason: "",
    custom: "",
    hidden: false
  };

  // Built once per mount, then mutated.
  const dom = { wrap: null, bar: null, peek: null, frame: null, iframe: null, select: null };

  let root = null;
  let shell = null;

  function readPref() {
    try {
      return window.localStorage.getItem(CONTROLS_KEY) === "hidden";
    } catch {
      return false;
    }
  }

  function writePref(hidden) {
    try {
      window.localStorage.setItem(CONTROLS_KEY, hidden ? "hidden" : "shown");
    } catch {
      /* private windows and blocked storage are fine; the default holds */
    }
  }

  /* ---------------------------------------------------------- data */

  function params() {
    return new URL(location.href).searchParams;
  }

  async function findMatch(id) {
    const API = window.EastcoinStreamedAPI;
    if (!API) return null;
    const unwrap = (r) => (Array.isArray(r) ? r : r?.data) || [];
    const [live, today] = await Promise.all([
      API.getLive().catch(() => null),
      API.getToday().catch(() => null)
    ]);
    return [...unwrap(live), ...unwrap(today)].find((m) => m?.id === id) || null;
  }

  // getStreams takes the MATCH, not (source, id) — it walks match.sources
  // itself with its own concurrency and de-duplication. Passing a source
  // pair silently yields nothing, because it finds no .sources to iterate.
  async function loadStreams(match) {
    const API = window.EastcoinStreamedAPI;
    if (!API?.getStreams || !match) return { streams: [], reason: "" };

    try {
      const result = await API.getStreams(match);
      const list = (Array.isArray(result) ? result : result?.data) || [];
      return { streams: list.filter((s) => s?.embedUrl), reason: "" };
    } catch (error) {
      // The provider layer explains itself well; pass that through rather
      // than replacing it with a vaguer message of our own.
      return { streams: [], reason: String(error?.message || "").trim() };
    }
  }

  /* ---------------------------------------------------------- helpers */

  function currentSrc() {
    if (local.custom) return local.custom;
    return local.streams[local.active]?.embedUrl || "";
  }

  function shareLink() {
    const url = new URL("/v3/", location.origin);
    url.searchParams.set("view", "watch");
    if (local.custom) url.searchParams.set("url", local.custom);
    else if (local.match?.id) url.searchParams.set("event", local.match.id);
    return url.href;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setHidden(hidden) {
    local.hidden = hidden;
    writePref(hidden);
    // Attribute flips only — the iframe is never touched, so folding the
    // bar cannot restart the stream.
    if (dom.bar) dom.bar.hidden = hidden;
    if (dom.peek) dom.peek.hidden = !hidden;
  }

  /* ---------------------------------------------------------- controls */

  function syncServers() {
    if (!dom.select) return;
    dom.select.replaceChildren();

    if (!local.streams.length) {
      const option = document.createElement("option");
      option.textContent = "No servers";
      dom.select.append(option);
      dom.select.disabled = true;
      return;
    }

    dom.select.disabled = local.streams.length < 2;
    local.streams.forEach((_, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `Server ${index + 1}`;
      if (index === local.active) option.selected = true;
      dom.select.append(option);
    });
  }

  function buildBar() {
    const bar = el("div", "watchbar");

    // Server selector. A dropdown rather than a row of chips: a provider
    // with nine feeds would otherwise wrap the bar onto a second line and
    // eat the video space this view exists to protect.
    if (!local.custom) {
      const select = document.createElement("select");
      select.className = "watchsel";
      select.setAttribute("aria-label", "Stream server");
      select.addEventListener("change", () => {
        local.active = Number(select.value) || 0;
        // Deliberate reload: a new server is a new stream.
        if (dom.iframe) dom.iframe.src = currentSrc();
      });
      dom.select = select;
      bar.append(select);
      syncServers();
    }

    const source = el("button", "watchbtn", "Open source");
    source.type = "button";
    source.title = "Open this stream in a new tab";
    source.addEventListener("click", () => {
      const src = currentSrc();
      if (src) window.open(src, "_blank", "noopener,noreferrer");
    });
    bar.append(source);

    const copy = el("button", "watchbtn", "Copy link");
    copy.type = "button";
    copy.title = "Copy a link back to this stream";
    copy.addEventListener("click", async () => {
      const link = shareLink();
      try {
        await navigator.clipboard.writeText(link);
        copy.textContent = "Copied";
      } catch {
        // Clipboard access is refused in plenty of ordinary situations;
        // say so rather than appearing to have worked.
        copy.textContent = "Press Ctrl+C";
        window.prompt("Copy this link", link);
      }
      window.setTimeout(() => { copy.textContent = "Copy link"; }, 1600);
    });
    bar.append(copy);

    bar.append(el("span", "watchbar-spacer"));

    const back = el("button", "watchbtn", "← Events");
    back.type = "button";
    back.addEventListener("click", () => shell.go("events"));
    bar.append(back);

    const fold = el("button", "watchbtn watchfold", "⌃ Hide");
    fold.type = "button";
    fold.title = "Hide these controls";
    fold.addEventListener("click", () => setHidden(true));
    bar.append(fold);

    return bar;
  }

  /* ---------------------------------------------------------- render */

  function buildShell() {
    root.replaceChildren();

    const wrap = el("div", "watchwrap");

    const bar = buildBar();
    bar.hidden = local.hidden;

    // Floats over the video rather than occupying a row, so a folded bar
    // gives its full height to the picture.
    const peek = el("button", "watchpeek", "⌄");
    peek.type = "button";
    peek.title = "Show controls";
    peek.setAttribute("aria-label", "Show player controls");
    peek.hidden = !local.hidden;
    peek.addEventListener("click", () => setHidden(false));

    const frame = el("div", "playerframe");
    const iframe = document.createElement("iframe");
    iframe.title = local.match?.title || "Stream";
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer";
    iframe.src = currentSrc();
    frame.append(iframe);

    wrap.append(bar, peek, frame);
    root.append(wrap);

    Object.assign(dom, { wrap, bar, peek, frame, iframe });
  }

  function paintMessage(kind) {
    root.replaceChildren();
    const wrap = el("div", "watchwrap");

    if (kind === "loading") {
      wrap.append(el("div", "playerframe shimmer"));
      root.append(wrap);
      return;
    }

    const box = el("div", "empty");
    if (local.error) {
      box.append(el("strong", null, "Can't open that"), el("p", null, local.error));
    } else {
      box.append(
        el("strong", null, "No playable stream yet"),
        el("p", null, local.reason ||
          "Providers usually publish a feed close to kickoff. Try again in a few minutes.")
      );
    }
    const back = el("button", "btn", "← All events");
    back.type = "button";
    back.style.cssText = "flex:0 0 auto;padding:0 15px;margin-top:12px";
    back.addEventListener("click", () => shell.go("events"));
    box.append(back);

    wrap.append(box);
    root.append(wrap);
  }

  function paint() {
    if (local.loading) return paintMessage("loading");
    if (local.error) return paintMessage("error");
    if (!currentSrc()) return paintMessage("empty");
    buildShell();
  }

  /* ---------------------------------------------------------- view */

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;

      document.body.classList.add("watch-on");

      const search = params();
      const custom = search.get("url") || "";
      const eventId = search.get("event") || "";

      local.custom = "";
      local.match = null;
      local.streams = [];
      local.active = 0;
      local.error = "";
      local.reason = "";
      local.hidden = readPref();

      if (custom) {
        // Only ever hand an https URL to an iframe.
        try {
          const parsed = new URL(custom);
          if (parsed.protocol !== "https:") throw new Error("insecure");
          local.custom = parsed.href;
        } catch {
          local.error = "That doesn't look like a valid https link.";
        }
        paint();
        return;
      }

      if (!eventId) {
        local.error = "No event selected.";
        paint();
        return;
      }

      local.loading = true;
      paint();

      local.match = await findMatch(eventId);
      if (!local.match) {
        local.loading = false;
        local.error = "That event isn't on the current schedule any more.";
        paint();
        return;
      }

      const outcome = await loadStreams(local.match);
      local.streams = outcome.streams;
      local.reason = outcome.reason;
      local.loading = false;
      if (root.isConnected) paint();
    },

    unmount() {
      document.body.classList.remove("watch-on");
      Object.assign(dom, {
        wrap: null, bar: null, peek: null, frame: null, iframe: null, select: null
      });
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("watch", view);
  }
  boot();
})();

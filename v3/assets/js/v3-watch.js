/* ============================================================
   EastCoin V3 — watch view

   Deliberately thin: it resolves streams through the existing
   provider layer and mounts one iframe. It does NOT nest a
   second EastCoin page inside itself the way V2's MultiView
   does (shell -> player.html -> provider), which is what made
   the old first-paint flash necessary.

   Two entry points:
     ?view=watch&event=<id>   an EastCoin event
     ?view=watch&url=<url>    a pasted embed URL
   ============================================================ */
(() => {
  "use strict";

  const local = {
    match: null,
    streams: [],
    active: 0,
    loading: false,
    error: "",
    reason: "",
    custom: ""
  };

  let root = null;
  let shell = null;

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

  /* ---------------------------------------------------------- render */

  function frame(url, title) {
    const wrap = document.createElement("div");
    wrap.className = "playerframe";
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = title || "Stream";
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer";
    wrap.append(iframe);
    return wrap;
  }

  function serverBar() {
    const bar = document.createElement("div");
    bar.className = "serverbar";

    const label = document.createElement("span");
    label.className = "serverbar-label";
    label.textContent = local.streams.length
      ? `${local.streams.length} server${local.streams.length === 1 ? "" : "s"}`
      : "No servers";
    bar.append(label);

    local.streams.forEach((_, index) => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(index === local.active));
      btn.textContent = `Server ${index + 1}`;
      btn.addEventListener("click", () => {
        local.active = index;
        paint();
      });
      bar.append(btn);
    });

    const spacer = document.createElement("span");
    spacer.className = "filters-spacer";
    bar.append(spacer);

    const back = document.createElement("button");
    back.className = "btn";
    back.type = "button";
    back.style.flex = "0 0 auto";
    back.style.padding = "0 15px";
    back.textContent = "← All events";
    back.addEventListener("click", () => shell.go("events"));
    bar.append(back);

    return bar;
  }

  function paint() {
    root.replaceChildren();

    const head = document.createElement("div");
    head.className = "viewhead";
    const wrap = document.createElement("div");
    const h1 = document.createElement("h1");
    h1.textContent = local.custom
      ? "Custom stream"
      : local.match?.title || (local.loading ? "Loading…" : "Watch");
    wrap.append(h1);
    head.append(wrap);
    root.append(head);

    if (local.custom) {
      root.append(frame(local.custom, "Custom stream"));
      const note = document.createElement("p");
      note.className = "filters-note";
      note.style.marginTop = "10px";
      note.textContent =
        "Pasted embed. Some sites refuse to load inside another page — that's their setting, not something EastCoin can override.";
      root.append(note);

      const back = document.createElement("button");
      back.className = "btn";
      back.type = "button";
      back.style.cssText = "flex:0 0 auto;padding:0 15px;margin-top:12px";
      back.textContent = "← All events";
      back.addEventListener("click", () => shell.go("events"));
      root.append(back);
      return;
    }

    if (local.loading) {
      const skel = document.createElement("div");
      skel.className = "playerframe shimmer";
      root.append(skel);
      return;
    }

    if (local.error) {
      const strip = document.createElement("div");
      strip.className = "notice-strip";
      strip.textContent = local.error;
      root.append(strip);
      const back = document.createElement("button");
      back.className = "btn";
      back.type = "button";
      back.style.cssText = "flex:0 0 auto;padding:0 15px";
      back.textContent = "← All events";
      back.addEventListener("click", () => shell.go("events"));
      root.append(back);
      return;
    }

    const stream = local.streams[local.active];
    if (stream) {
      root.append(frame(stream.embedUrl, local.match?.title));
      root.append(serverBar());
    } else {
      const empty = document.createElement("div");
      empty.className = "empty";
      const strong = document.createElement("strong");
      strong.textContent = "No playable stream yet";
      const p = document.createElement("p");
      p.textContent =
        local.reason ||
        "Providers usually publish a feed close to kickoff. Try again in a few minutes.";
      empty.append(strong, p);
      root.append(empty);
      root.append(serverBar());
    }
  }

  /* ---------------------------------------------------------- view */

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;

      const search = params();
      const custom = search.get("url") || "";
      const eventId = search.get("event") || "";

      local.custom = "";
      local.match = null;
      local.streams = [];
      local.active = 0;
      local.error = "";
      local.reason = "";

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
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("watch", view);
  }
  boot();
})();

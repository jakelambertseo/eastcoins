/* ============================================================
   EastCoin V3 — watch view

   Deliberately thin: it resolves streams through the existing
   provider layer and mounts one iframe. It does NOT nest a
   second EastCoin page inside itself the way V2's MultiView
   does (shell -> player.html -> provider), which is what made
   the old first-paint flash necessary.

   The video is the page. There is no heading — you already know
   what you clicked — and the frame takes every pixel the shell
   is not using. Controls sit in a bar under it that folds away
   to a single chevron.

   One rule shapes the DOM here: the stream iframe is built once
   and only ever has its src reassigned. Rebuilding it restarts
   the stream, so anything that is not a deliberate server change
   — folding the bar, copying a link, opening Gameday — must not
   touch it.
   ============================================================ */
(() => {
  "use strict";

  const CONTROLS_KEY = "ec_v3_watch_controls";
  // Servers the viewer pasted themselves, kept per event so a refresh
  // doesn't cost them the link they went and found.
  const MINE_KEY = "ec_v3_watch_mine";
  const MINE_PER_EVENT = 3;
  const MINE_EVENTS = 20;
  // The dropdown's last entry. A string nothing else uses, so it can never
  // collide with a stream index.
  const ADD_VALUE = "ec-add-your-own";

  const local = {
    match: null,
    streams: [],
    active: 0,
    loading: false,
    error: "",
    reason: "",
    custom: "",
    hidden: false,
    game: null
  };

  // Built once per mount, then mutated.
  const dom = {
    wrap: null, bar: null, peek: null, frame: null,
    iframe: null, select: null, gd: null, gdFrame: null, add: null
  };

  let root = null;
  let shell = null;
  let messageHandler = null;

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
    const all = [...unwrap(live), ...unwrap(today)];
    const found = all.find((m) => m?.id === id) || null;
    // A link to the provider's bare copy of a game (one server, no art)
    // opens the full listing instead, which carries that server and the rest.
    return (found && window.ECV3Sports?.fullerCopy?.(found, all)) || found;
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

  // Every stream frame is loaded through here so the referrer policy can
  // never drift from the source it was chosen for. The rule itself lives in
  // assets/eastcoins-youtube.js; with that module missing this falls back to
  // the stricter policy, which is how the site behaved before.
  function setStreamSrc(iframe, url) {
    // Checked as a function, not with ?. — a browser holding an older
    // cached copy of the module has the object but not this method, and
    // `obj?.missing(x)` still throws. That blanked the whole watch view.
    const policy = window.EastcoinYouTube?.framePolicy;
    iframe.referrerPolicy = (typeof policy === "function" ? policy(url) : "") || "no-referrer";
    iframe.src = url;
  }

  /* ------------------------------------------------- your own servers */

  function readMineAll() {
    try { return JSON.parse(window.localStorage.getItem(MINE_KEY)) || {}; } catch { return {}; }
  }

  function readMine(eventId) {
    const all = readMineAll();
    const list = all[String(eventId)];
    return Array.isArray(list) ? list.filter((u) => typeof u === "string").slice(0, MINE_PER_EVENT) : [];
  }

  function writeMine(eventId, urls) {
    try {
      const all = readMineAll();
      if (urls.length) all[String(eventId)] = urls.slice(-MINE_PER_EVENT);
      else delete all[String(eventId)];
      // Events finish; without a cap this would grow for the life of the
      // browser. Oldest keys go first — insertion order is good enough.
      const keys = Object.keys(all);
      for (const key of keys.slice(0, Math.max(0, keys.length - MINE_EVENTS))) delete all[key];
      window.localStorage.setItem(MINE_KEY, JSON.stringify(all));
    } catch {
      /* a private window just means it lasts for this visit */
    }
  }

  /**
   * What someone pasted, turned into something an iframe will play, or a
   * reason it can't be. The YouTube rewrite is the same one the nav search
   * uses, so an ordinary watch?v= page works rather than being refused by
   * YouTube's framing rules.
   */
  function embedFor(raw) {
    const text = String(raw || "").trim();
    if (!text) return { error: "Paste a link first." };
    let parsed;
    try {
      parsed = new URL(/^[a-z]+:\/\//i.test(text) ? text : "https://" + text);
    } catch {
      return { error: "That doesn't look like a link." };
    }
    if (parsed.protocol !== "https:") return { error: "Only https:// links can be embedded." };
    // new URL() is happy with a host that could never resolve: typing a
    // few words gives "https://not%20a%20link/", which parses, loads, and
    // fails silently in the frame. A real host is letters, digits, dots
    // and hyphens, with at least one dot inside it.
    const host = parsed.hostname;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) {
      return { error: "That doesn't look like a link." };
    }
    if (host === location.hostname) return { error: "That's a link back to EastCoin." };
    return { url: window.ECEmbed?.youtube?.(parsed.href) || parsed.href };
  }

  /** Adds a pasted server, switches to it, and remembers it for this event. */
  function addOwnServer(url) {
    local.streams.push({ embedUrl: url, mine: true });
    local.active = local.streams.length - 1;
    if (local.match?.id) {
      writeMine(local.match.id, [...readMine(local.match.id).filter((u) => u !== url), url]);
    }
    syncServers();
    rememberServer();
    if (dom.iframe) setStreamSrc(dom.iframe, currentSrc());
  }

  function closeAddForm() {
    if (dom.add) dom.add.hidden = true;
  }

  /** The little "Embed your own server" panel, above the bar. */
  function openAddForm() {
    if (!dom.wrap) return;
    if (!dom.add) {
      const box = el("div", "watchadd");
      box.append(el("h3", null, "Embed your own server"));
      box.append(el("p", null, "Paste a link to a stream and it plays here. Yours only — nobody else on this event sees it."));

      const input = document.createElement("input");
      input.type = "url";
      input.placeholder = "https://…";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", "Link to embed");
      box.append(input);

      const note = el("p", "watchadd-note", "");
      note.hidden = true;
      box.append(note);

      const row = el("div", "watchadd-row");
      const cancel = el("button", "watchbtn", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", closeAddForm);
      const go = el("button", "watchbtn watchadd-go", "Embed");
      go.type = "button";

      const submit = () => {
        const result = embedFor(input.value);
        if (result.error) {
          note.hidden = false;
          note.className = "watchadd-note bad";
          note.textContent = result.error;
          input.focus();
          return;
        }
        addOwnServer(result.url);
        input.value = "";
        note.hidden = true;
        closeAddForm();
      };
      go.addEventListener("click", submit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); submit(); }
        if (event.key === "Escape") closeAddForm();
      });
      // Typing again clears the last complaint rather than leaving it to
      // contradict what is now in the box.
      input.addEventListener("input", () => { note.hidden = true; });

      row.append(cancel, go);
      box.append(row);
      dom.add = box;
      dom.wrap.append(box);
    }
    dom.add.hidden = false;
    dom.add.querySelector("input")?.focus();
  }

  function currentSrc() {
    if (local.custom) return local.custom;
    return local.streams[local.active]?.embedUrl || "";
  }

  function shareLink() {
    const url = new URL("/", location.origin);
    url.searchParams.set("view", "watch");
    // A server the viewer pasted exists only in this browser, so "server 7"
    // would mean nothing to whoever opens the link. Share the stream itself.
    const own = local.streams[local.active];
    if (!local.custom && own?.mine) url.searchParams.set("url", own.embedUrl);
    else if (local.custom) url.searchParams.set("url", local.custom);
    else if (local.match?.id) {
      url.searchParams.set("event", local.match.id);
      // The server they are actually on, 1-based like the dropdown says.
      // Server 1 is the default, so it is left off to keep links short.
      if (local.active > 0) url.searchParams.set("server", String(local.active + 1));
    }
    return url.href;
  }

  // Keeps the address bar honest as servers change, so copying it by
  // hand works as well as the button does.
  function rememberServer() {
    const url = new URL(location.href);
    // Same reason as shareLink: a pasted server has no number anyone else
    // could follow, so the address bar keeps quiet about it.
    if (local.streams[local.active]?.mine) url.searchParams.delete("server");
    else if (local.active > 0) url.searchParams.set("server", String(local.active + 1));
    else url.searchParams.delete("server");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
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
    // The form is anchored to the bar; folding the bar takes it too.
    if (hidden) closeAddForm();
    // Attribute flips only — the iframe is never touched, so folding the
    // bar cannot restart the stream.
    if (dom.bar) dom.bar.hidden = hidden;
    if (dom.peek) dom.peek.hidden = !hidden;
  }

  /* ---------------------------------------------------------- gameday */

  function openGameday() {
    if (!local.game || !dom.gd || !dom.gdFrame) return;
    dom.gdFrame.src = window.ECV3Gameday.gamedayUrl(local.game);
    dom.gd.hidden = false;
  }

  function closeGameday() {
    if (!dom.gd || !dom.gdFrame) return;
    dom.gd.hidden = true;
    // Blanked rather than left loaded: Gameday polls MLB, and a hidden
    // panel quietly doing that behind the video is waste nobody can see.
    dom.gdFrame.src = "about:blank";
  }

  function buildGameday() {
    const panel = el("div", "gameday");
    panel.hidden = true;
    panel.setAttribute("aria-label", "MLB Gameday");

    const close = el("button", "gameday-close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close Gameday");
    close.addEventListener("click", closeGameday);

    const iframe = document.createElement("iframe");
    iframe.className = "gameday-frame";
    iframe.title = "EastCoin MLB Gameday";
    iframe.src = "about:blank";
    iframe.allow = "fullscreen";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    panel.append(close, iframe);
    dom.gd = panel;
    dom.gdFrame = iframe;
    return panel;
  }

  /* ---------------------------------------------------------- controls */

  function syncServers() {
    if (!dom.select) return;
    dom.select.replaceChildren();

    // "Server 1 of 4" rather than "Server 1": the closed control has to
    // say that there is something else to try, because that is the whole
    // reason someone looks for it. Anything the viewer pasted is counted
    // separately and named "Your server" — calling it "Server 7 of 7"
    // would claim a number no other viewer's list agrees with.
    const mine = local.streams.filter((s) => s.mine).length;
    const count = local.streams.length - mine;
    let seen = 0;
    local.streams.forEach((stream, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      if (stream.mine) {
        seen += 1;
        option.textContent = mine > 1 ? `Your server ${seen}` : "Your server";
      } else {
        option.textContent = count > 1 ? `Server ${index + 1} of ${count}` : "Server 1";
      }
      if (index === local.active) option.selected = true;
      dom.select.append(option);
    });

    if (!local.streams.length) {
      const none = document.createElement("option");
      none.value = "none";
      none.textContent = "No servers";
      none.selected = true;
      dom.select.append(none);
    }

    // Always last. The control is never disabled any more: one dead server
    // and no way to paste a working one is exactly the case this exists for.
    const add = document.createElement("option");
    add.value = ADD_VALUE;
    add.textContent = "+ Add Your Own";
    dom.select.append(add);

    dom.select.disabled = false;
    dom.select.title = count > 1
      ? `Stream not working? Switch between ${count} servers, or paste your own.`
      : "Stream not working? Paste your own server.";
    // A few pulses when a stream first arrives, then it settles down.
    dom.select.classList.toggle("nudge", count > 1);
  }

  // The pile keeps its own timer and the bar is rebuilt whenever the
  // view repaints, so the previous one has to be stopped by hand.
  let stopWho = null;
  function stopWatchers() {
    if (stopWho) stopWho();
    stopWho = null;
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
      // Switching is the fix for a dead stream, so stop pulsing once
      // they have found it.
      select.addEventListener("pointerenter", () => select.classList.remove("nudge"), { once: true });
      select.addEventListener("change", () => {
        if (select.value === ADD_VALUE) {
          // Opening the form is not a change of server. Put the dropdown
          // back where it was, or it would sit reading "Add Your Own"
          // while the old stream carried on playing underneath.
          select.value = String(local.active);
          openAddForm();
          return;
        }
        if (select.value === "none") return;
        local.active = Number(select.value) || 0;
        rememberServer();
        // Deliberate reload: a new server is a new stream.
        if (dom.iframe) setStreamSrc(dom.iframe, currentSrc());
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

    // Only when the event resolved to a real MLB game. A button that
    // opens the wrong game is worse than no button, so the resolver
    // refuses anything it can't match on both teams.
    if (local.game) {
      const gd = el("button", "watchbtn watchgd", "⚾ Gameday");
      gd.type = "button";
      gd.title = `Live MLB Gameday for ${local.game.away} at ${local.game.home}`;
      gd.addEventListener("click", openGameday);
      bar.append(gd);
    }

    bar.append(el("span", "watchbar-spacer"));

    // Who else is on this event, the way the Green Room shows who is
    // listening. Only for a real event: a pasted URL carries no id for
    // anyone else's heartbeat to match.
    stopWatchers();
    if (local.match?.id) {
      const who = el("div", "wwho");
      who.hidden = true;
      bar.append(who);
      stopWho = window.ECPresence?.mountWatchers?.(who, local.match.id) || null;
    }

    const back = el("button", "watchbtn", "← Events");
    back.type = "button";
    back.addEventListener("click", () => shell.go("events"));
    bar.append(back);

    const fold = el("button", "watchbtn watchfold", "⌄ Hide");
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

    const frame = el("div", "playerframe");
    const iframe = document.createElement("iframe");
    iframe.title = local.match?.title || "Stream";
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    setStreamSrc(iframe, currentSrc());
    frame.append(iframe, buildGameday());

    const bar = buildBar();
    bar.hidden = local.hidden;

    // Floats over the video rather than occupying a row, so a folded bar
    // gives its full height to the picture.
    const peek = el("button", "watchpeek", "⌃");
    peek.type = "button";
    peek.title = "Show controls";
    peek.setAttribute("aria-label", "Show player controls");
    peek.hidden = !local.hidden;
    peek.addEventListener("click", () => setHidden(false));

    wrap.append(frame, bar, peek);
    root.append(wrap);

    Object.assign(dom, { wrap, bar, peek, frame, iframe, add: null });
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

      // Gameday closes itself from inside the frame. Same-origin only:
      // the panel loads our own page, so anything from elsewhere is not
      // it and gets ignored.
      if (!messageHandler) {
        messageHandler = (event) => {
          if (event.origin !== location.origin) return;
          if (event.data?.type === "eastcoin:mlb-gameday-close") closeGameday();
        };
        window.addEventListener("message", messageHandler);
      }

      const search = params();
      const custom = search.get("url") || "";
      const eventId = search.get("event") || "";

      local.custom = "";
      local.match = null;
      local.streams = [];
      local.active = 0;
      local.error = "";
      local.reason = "";
      local.game = null;
      local.hidden = readPref();

      if (custom) {
        // Only ever hand an https URL to an iframe.
        try {
          const parsed = new URL(custom);
          if (parsed.protocol !== "https:") throw new Error("insecure");
          // A YouTube page link (shared before search rewrote them) still plays.
          local.custom = window.ECEmbed?.youtube?.(parsed.href) || parsed.href;
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

      // Both at once, and painted once at the end: resolving Gameday
      // after the first paint would mean rebuilding the bar, and the
      // bar and the stream iframe share a parent.
      const [outcome, game] = await Promise.all([
        loadStreams(local.match),
        window.ECV3Gameday?.resolve(local.match).catch(() => null) ?? null
      ]);

      local.streams = outcome.streams;
      // Anything this viewer pasted for this event last time, back on the end.
      for (const url of readMine(local.match.id)) local.streams.push({ embedUrl: url, mine: true });
      local.reason = outcome.reason;
      local.game = game;
      // Who's here can name the game rather than just "watching".
      window.ECPresence?.beat("watch", local.match?.title || "", local.match?.id || "");
      // A shared link names the server it was copied from (1-based);
      // the old shell's ?stream= is honoured the same way.
      const wanted = Number(params().get("server") || params().get("stream") || 0);
      if (wanted >= 1 && wanted <= local.streams.length) local.active = wanted - 1;
      local.loading = false;
      if (root.isConnected) paint();
    },

    unmount() {
      document.body.classList.remove("watch-on");
      stopWatchers();
      if (messageHandler) {
        window.removeEventListener("message", messageHandler);
        messageHandler = null;
      }
      Object.assign(dom, {
        wrap: null, bar: null, peek: null, frame: null,
        iframe: null, select: null, gd: null, gdFrame: null, add: null
      });
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("watch", view);
  }
  boot();
})();

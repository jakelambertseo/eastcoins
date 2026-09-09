/* ============================================================
   EastCoin V3 — The Green Room

   The room lives at /?view=music and nowhere else. There is
   deliberately no floating dock: anything fixed to a corner sits
   over the Twitch chat iframe, and Twitch disables the message
   box for the broadcaster and moderators the moment it detects
   something covering it. A player that costs the mods their chat
   is not worth having.

   The room only advances when a client reports a song ENDED —
   there is no server-side timer on song length — so this uses the
   real YouTube IFrame API rather than a plain autoplay embed. A
   player that could not report that would quietly stall the queue
   for everybody.
   ============================================================ */
(() => {
  "use strict";

  const CATJAM = "https://cdn.7tv.app/emote/01KWJNR4DE37RDZ816WYAYDG3K/3x.webp";
  const ROOM_EMOTE = "https://cdn.7tv.app/emote/01FAEEN908000D3SP26B2JBAC1/2x.webp";
  const JAMGIE = "https://cdn.7tv.app/emote/01GAJBNT780004XAVG6P7AZAK2/4x.webp";
  const JAMGIE2 = "https://cdn.7tv.app/emote/01KXKXKF3D20SSJAGPWQY9YYA7/4x.webp";
  const VOLUME_KEY = "ec_v3_music_volume";

  // Order and labels are ours; the kinds themselves are fixed server-side,
  // because a client able to invent one could grow the stored state
  // without limit.
  const REACTIONS = [
    { kind: "up",    emoji: "\u{1F44D}", label: "Nice" },
    { kind: "fire",  emoji: "\u{1F525}", label: "Banger" },
    { kind: "trash", emoji: "\u{1F5D1}\uFE0F", label: "Bin it" },
    { kind: "del",   emoji: "\u274C", label: "Delete this" }
  ];

  // Mirrors the room's own list. Cosmetic only — the server re-checks the
  // verified login on every force-skip, so revealing the button proves
  // nothing and grants nothing.
  const MODS = new Set(["zwades", "andyreidisapawg", "bootypaper"]);

  const config = window.EASTCOIN_MUSIC_CONFIG || {};
  const ROOM = String(config.room || "main");
  const BASE = String(config.websocketUrl || "").trim();

  /* ============================================================ connection */

  const conn = {
    socket: null,
    state: null,
    token: null,
    tokenExpiresAt: 0,
    tokenTimer: 0,
    login: "",
    attempts: 0,
    clientId: "",
    listeners: new Set()
  };

  function clientId() {
    if (conn.clientId) return conn.clientId;
    try { conn.clientId = window.localStorage.getItem("ec_v3_music_client") || ""; } catch {}
    if (!conn.clientId) {
      conn.clientId = (crypto.randomUUID?.() || String(Math.random())).slice(0, 36);
      try { window.localStorage.setItem("ec_v3_music_client", conn.clientId); } catch {}
    }
    return conn.clientId;
  }

  function emit() {
    for (const fn of conn.listeners) {
      try { fn(conn.state); } catch (error) { console.error("music listener threw", error); }
    }
  }

  function subscribe(fn) {
    conn.listeners.add(fn);
    if (conn.state) fn(conn.state);
    return () => conn.listeners.delete(fn);
  }

  function send(message) {
    if (conn.socket?.readyState === 1) {
      conn.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async function fetchToken() {
    try {
      const response = await fetch("/api/music/token", {
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = await response.json();
      if (payload?.ok && payload.authenticated) {
        conn.token = payload.token || null;
        conn.tokenExpiresAt = Number(payload.expiresAt) || 0;
        conn.login = String(payload.login || "").toLowerCase();
      } else {
        conn.token = null;
        conn.tokenExpiresAt = 0;
        conn.login = "";
      }
    } catch {
      conn.token = null;
      conn.tokenExpiresAt = 0;
      conn.login = "";
    }
    return conn.token;
  }

  /**
   * These tokens last fifteen minutes.
   *
   * An expired one is still a non-empty string, so "do we have a token"
   * is not the same question as "will the room accept it" — and a page
   * left open past the quarter hour was cheerfully sending a dead token
   * and being told to log in.
   *
   * A minute of headroom, because the room checks the expiry when the
   * message lands and one that dies in flight is refused exactly like
   * one long gone.
   */
  function tokenIsFresh() {
    return Boolean(conn.token) && conn.tokenExpiresAt - Date.now() > 60000;
  }

  async function ensureToken() {
    if (tokenIsFresh()) return conn.token;
    await fetchToken();
    // Re-announce: the room derives the verified login from the token it
    // was given at identity time, so a refresh it never hears about
    // leaves it holding the old one.
    if (conn.token) {
      send({ type: "identity", name: "", avatar: "", token: conn.token });
    }
    scheduleTokenRefresh();
    return conn.token;
  }

  function scheduleTokenRefresh() {
    window.clearTimeout(conn.tokenTimer);
    if (!conn.tokenExpiresAt) return;
    // Renew a minute early rather than on expiry, so nothing is ever sent
    // during the gap.
    const wait = Math.max(30000, conn.tokenExpiresAt - Date.now() - 60000);
    conn.tokenTimer = window.setTimeout(() => { ensureToken(); }, wait);
  }

  function canForceSkip() {
    return MODS.has(conn.login);
  }

  function connect() {
    if (!BASE || conn.socket) return;

    let url;
    try {
      url = new URL(`/room/${encodeURIComponent(ROOM)}`, BASE);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("client", clientId());
    } catch {
      return;
    }

    let socket;
    try { socket = new WebSocket(url.href); } catch { return; }
    conn.socket = socket;

    socket.addEventListener("open", async () => {
      conn.attempts = 0;
      await fetchToken();
      send({ type: "identity", name: "", avatar: "", token: conn.token });
      scheduleTokenRefresh();
      emit();
    });

    socket.addEventListener("message", (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload?.type === "state" && payload.state) {
        conn.state = payload.state;
        emit();
      }
      if (payload?.type === "error" && payload.message) {
        setNotice(String(payload.message), true);
      }
    });

    const drop = () => {
      if (conn.socket !== socket) return;
      conn.socket = null;
      // Backing off matters: the room stops its polling alarm when empty,
      // so a tight reconnect loop across many tabs is real load.
      const delay = Math.min(30000, 1000 * 2 ** Math.min(conn.attempts++, 5));
      window.setTimeout(connect, delay);
    };
    socket.addEventListener("close", drop);
    socket.addEventListener("error", drop);
  }

  function disconnect() {
    window.clearTimeout(conn.tokenTimer);
    conn.tokenTimer = 0;
    const socket = conn.socket;
    conn.socket = null;
    try { socket?.close(); } catch {}
  }

  /* ============================================================ player */

  let ytReady = null;

  function loadYouTubeApi() {
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve) => {
      if (window.YT?.Player) return resolve(window.YT);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.append(script);
    });
    return ytReady;
  }

  const player = { instance: null, host: null, shield: null, videoId: "", itemId: "" };

  function readVolume() {
    try {
      const stored = Number(window.localStorage.getItem(VOLUME_KEY));
      return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : 60;
    } catch {
      return 60;
    }
  }

  function writeVolume(value) {
    try { window.localStorage.setItem(VOLUME_KEY, String(value)); } catch {}
  }

  function setVolume(value) {
    writeVolume(value);
    applyAudioOwnership();
  }

  /* ---------------------------------------------------------- audio lock

     Two tabs on the room means the same song playing twice, a second or
     two apart, which sounds like a fault rather than a feature. Whichever
     tab last had real focus owns audible sound; the others drop their
     player to zero.

     Volume, not mute: the visitor's own volume choice is never touched,
     so ownership coming back is instant and silent. And the forced zero
     is never written to storage — persisting it would rewrite the volume
     they actually chose. */

  const AUDIO_LOCK_CHANNEL = "eastcoin-music-audio-lock";
  const audioId = (crypto.randomUUID?.() || String(Math.random())).slice(0, 36);
  let audioChannel = null;
  let isAudioOwner = true;

  function applyAudioOwnership() {
    try { player.instance?.setVolume?.(isAudioOwner ? readVolume() : 0); } catch {}
  }

  function initAudioLock() {
    if (audioChannel || typeof BroadcastChannel === "undefined") return;

    try {
      audioChannel = new BroadcastChannel(AUDIO_LOCK_CHANNEL);
    } catch {
      return;
    }

    audioChannel.addEventListener("message", (event) => {
      if (event.data?.type === "claim" && event.data.id !== audioId) {
        isAudioOwner = false;
        applyAudioOwnership();
      }
    });

    const claim = () => {
      isAudioOwner = true;
      applyAudioOwnership();
      try { audioChannel.postMessage({ type: "claim", id: audioId }); } catch {}
    };

    window.addEventListener("focus", claim);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") claim();
    });

    if (document.hasFocus()) claim();
    else isAudioOwner = false;
  }

  function elapsedSeconds(state) {
    if (!state?.startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - Number(state.startedAt)) / 1000));
  }

  function reportEnded(reason) {
    // Guarded server-side against a stale id, so several tabs reporting
    // the same song is harmless — only the first advances anything.
    if (player.itemId) send({ type: "ended", currentId: player.itemId, reason });
  }

  async function mountPlayer(host, state) {
    const current = state?.current;
    if (!host || !current?.videoId) return;

    const YT = await loadYouTubeApi();
    if (!host.isConnected) return;

    // Same song AND still living in this exact element: leave it playing
    // rather than restarting it on every state broadcast (a listener
    // joining sends one). The host check matters — without it, a rebuilt
    // stage leaves this returning early while the iframe it is guarding
    // has already been removed from the document, which is a black box.
    if (player.instance && player.host === host && player.videoId === current.videoId) {
      player.itemId = current.id;
      return;
    }

    destroyPlayer();
    const slot = document.createElement("div");
    host.replaceChildren(slot);

    // controls:0 hides the bar but a click on the video still toggles
    // playback, so the frame gets a transparent cover.
    //
    // It is only up WHILE PLAYING. Browsers refuse to autoplay audio
    // until the person has interacted with the page, so the room opens
    // showing YouTube's play button and needs exactly one real click to
    // start — and a cover that is always on eats it, leaving a video that
    // cannot be started at all.
    const shield = document.createElement("div");
    shield.className = "mstage-shield";
    shield.title = "Playback is shared - use the volume slider";
    shield.hidden = true;
    host.append(shield);
    player.shield = shield;

    player.host = host;
    player.videoId = current.videoId;
    player.itemId = current.id;

    startDriftWatch();
    player.instance = new YT.Player(slot, {
      videoId: current.videoId,
      playerVars: {
        autoplay: 1,
        start: elapsedSeconds(state),
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        // No transport controls. This is a shared room playing one
        // timeline for everybody: pausing or scrubbing only desynchronises
        // the person who did it, and they then hear something different
        // from everyone else with no way to tell. Volume stays local and
        // lives on our own slider.
        controls: 0,
        disablekb: 1,
        fs: 0
      },
      events: {
        onReady: (event) => {
          try {
            event.target.setVolume(isAudioOwner ? readVolume() : 0);

            // Same stale-room case as correctDrift, caught at the point
            // the duration first becomes knowable.
            const duration = Number(event.target.getDuration?.()) || 0;
            if (duration > 0 && elapsedSeconds(conn.state) >= duration - 1) {
              reportEnded("overran");
              return;
            }
            event.target.playVideo();
          } catch {}
        },
        onAutoplayBlocked: () => {
          // Not an error. The browser is waiting for a real click, and the
          // cover is already down so YouTube's own play button is live —
          // this just says so rather than leaving a still frame.
          setNotice("Press play to join the room \u2014 your browser blocked autoplay.");
        },
        onStateChange: (event) => {
          const YTS = window.YT.PlayerState;
          // Cover it once it is actually playing; lift it any other time
          // so the person can start, or restart, what they are watching.
          if (player.shield) player.shield.hidden = event.data !== YTS.PLAYING;

          if (event.data === YTS.PLAYING) {
            // They have just pressed play, which may be long after the
            // room moved on. Land them where everyone else is rather than
            // waiting up to five seconds for the drift check.
            correctDrift();
          }
          if (event.data === YTS.ENDED) reportEnded("ended");
        },
        onError: () => reportEnded("player-error")
      }
    });
  }

  /**
   * Nudges a drifting player back onto the room's timeline.
   *
   * Buffering, a slow start, or a tab throttled in the background all
   * pull a client out of step. Correcting only past a few seconds keeps
   * this from fighting ordinary jitter, and only while actually playing,
   * since seeking mid-buffer just makes it worse.
   */
  function correctDrift() {
    const instance = player.instance;
    const state = conn.state;
    if (!instance || !state?.current) return;

    let actual;
    let playerState;
    try {
      actual = instance.getCurrentTime?.();
      playerState = instance.getPlayerState?.();
    } catch {
      return;
    }

    // A video that finished without its ENDED event reaching us — or whose
    // report never reached the room — leaves the whole room parked on a
    // song nobody is playing. Nothing else notices, because the room only
    // ever advances when a client tells it to.
    if (playerState === window.YT?.PlayerState?.ENDED) {
      reportEnded("safety-net");
      return;
    }

    if (playerState !== window.YT?.PlayerState?.PLAYING) return;
    if (!Number.isFinite(actual)) return;

    const expected = elapsedSeconds(state);
    let duration = 0;
    try { duration = Number(instance.getDuration?.()) || 0; } catch {}

    // The room only advances when a client reports ENDED, so a song left
    // current with nobody connected keeps accumulating elapsed time. The
    // next person to arrive would otherwise be told to seek past the end
    // and just get a black frame. Report it finished instead.
    if (duration > 0 && expected >= duration - 1) {
      reportEnded("overran");
      return;
    }

    if (Math.abs(actual - expected) > 3) {
      const target = duration > 0 ? Math.min(expected, duration - 1) : expected;
      try { instance.seekTo(Math.max(0, target), true); } catch {}
    }
  }

  let driftTimer = 0;

  function startDriftWatch() {
    if (driftTimer) return;
    driftTimer = window.setInterval(correctDrift, 5000);
  }

  function stopDriftWatch() {
    window.clearInterval(driftTimer);
    driftTimer = 0;
  }

  function destroyPlayer() {
    stopDriftWatch();
    try { player.instance?.destroy?.(); } catch {}
    player.instance = null;
    player.host = null;
    player.shield = null;
    player.videoId = "";
    player.itemId = "";
  }

  /* ============================================================ catjam */

  let jamTimer = 0;

  function stopJam(surface) {
    window.clearInterval(jamTimer);
    jamTimer = 0;
    surface?.classList.remove("is-jamming");
    surface?.querySelectorAll(".jam-cat, .jam-floor, .jam-banner, .jam-flash").forEach((node) => node.remove());
    document.body.classList.remove("is-rasputin");
  }

  /**
   * The full catJAM treatment for a !rasputin block: a row of cats
   * bouncing along the bottom of the stage, more cats floating up
   * through it, a banner sliding across the top, a colour wash on the
   * frame and the page, and a flash on the way in. All of it is CSS
   * animation on decorative nodes — nothing here touches playback.
   */
  function startJam(surface) {
    if (!surface || jamTimer) return;
    surface.classList.add("is-jamming");
    document.body.classList.add("is-rasputin");

    // The flash on the way in.
    const flash = document.createElement("div");
    flash.className = "jam-flash";
    surface.append(flash);
    window.setTimeout(() => flash.remove(), 1400);

    // The banner.
    const banner = document.createElement("div");
    banner.className = "jam-banner";
    const strip = document.createElement("div");
    strip.className = "jam-banner-strip";
    for (let i = 0; i < 6; i += 1) {
      const cat = document.createElement("img");
      cat.src = CATJAM;
      cat.alt = "";
      strip.append(cat, el("span", null, "RASPUTIN"));
    }
    banner.append(strip);
    surface.append(banner);

    // The floor: a dozen cats bouncing out of phase with each other.
    const floor = document.createElement("div");
    floor.className = "jam-floor";
    for (let i = 0; i < 12; i += 1) {
      const cat = document.createElement("img");
      cat.src = CATJAM;
      cat.alt = "";
      cat.style.animationDelay = `${(i % 4) * -0.16}s`;
      cat.style.animationDuration = `${0.56 + (i % 3) * 0.08}s`;
      floor.append(cat);
    }
    surface.append(floor);

    // And the risers.
    const spawn = () => {
      if (!surface.isConnected) return stopJam(surface);
      const cat = document.createElement("img");
      cat.className = "jam-cat";
      cat.src = CATJAM;
      cat.alt = "";
      cat.style.left = `${Math.random() * 88 + 2}%`;
      cat.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
      cat.style.setProperty("--drift", `${Math.random() * 80 - 40}px`);
      cat.style.setProperty("--size", `${36 + Math.random() * 32}px`);
      surface.append(cat);
      window.setTimeout(() => cat.remove(), 4200);
    };

    spawn();
    jamTimer = window.setInterval(spawn, 420);
  }

  /**
   * A burst of the emoji that was just pressed.
   *
   * Anchored to the button rather than the stage so it reads as a
   * response to the click. Purely decorative, and skipped entirely under
   * prefers-reduced-motion.
   */
  function burst(button, emoji) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    for (let i = 0; i < 7; i += 1) {
      const bit = el("span", "react-bit", emoji);
      bit.style.setProperty("--dx", `${Math.random() * 96 - 48}px`);
      bit.style.setProperty("--dy", `${-46 - Math.random() * 46}px`);
      bit.style.setProperty("--rot", `${Math.random() * 90 - 45}deg`);
      bit.style.animationDelay = `${i * 26}ms`;
      button.append(bit);
      window.setTimeout(() => bit.remove(), 1200 + i * 26);
    }

    button.classList.remove("is-popped");
    // Reading offsetWidth forces the class removal to take effect before
    // it is added again, so a second click actually replays the pop.
    void button.offsetWidth;
    button.classList.add("is-popped");
    window.setTimeout(() => button.classList.remove("is-popped"), 400);
  }

  function reactionTip(entry, label) {
    const count = Number(entry?.count || 0);
    if (!count) return `${label} — nobody yet`;

    const names = (entry?.names || []).filter(Boolean);
    const others = Math.max(0, count - names.length);

    if (!names.length) {
      return `${label} — ${count}, nobody logged in`;
    }
    const list = names.join(", ");
    if (!others) return `${label} — ${list}`;
    return `${label} — ${list} and ${others} other${others === 1 ? "" : "s"}`;
  }

  function isRasputin(state) {
    return String(state?.current?.special || "") === "rasputin";
  }

  /* ============================================================ helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let noticeEl = null;
  let noticeTimer = 0;

  function setNotice(text, isError) {
    if (!noticeEl) return;
    noticeEl.textContent = text;
    noticeEl.classList.toggle("is-error", Boolean(isError));
    noticeEl.hidden = !text;
    window.clearTimeout(noticeTimer);
    if (text) noticeTimer = window.setTimeout(() => { noticeEl.hidden = true; }, 5000);
  }

  /**
   * YouTube's thumbnail for a video id. Derived rather than fetched: the
   * room's queue entries carry no thumbnail field, and this needs neither
   * a request nor an API key.
   */
  function thumbUrl(videoId) {
    return /^[A-Za-z0-9_-]{11}$/.test(String(videoId || ""))
      ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      : "";
  }

  function thumb(videoId, className) {
    const url = thumbUrl(videoId);
    if (!url) return null;
    const img = document.createElement("img");
    img.className = className;
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    return img;
  }

  /**
   * The video id in whatever was typed, or "" if it looks like a search.
   *
   * Covers every youtube.com / youtu.be / shorts shape through the shared
   * parser, plus a bare id pasted on its own — which the parser does not
   * claim, since in isolation eleven characters could be anything.
   */
  function pastedVideoId(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    const parsed = window.EastcoinYouTube?.extractVideo?.(text)?.id || "";
    if (parsed) return parsed;
    return /^[A-Za-z0-9_-]{11}$/.test(text) ? text : "";
  }

  function timeAgo(timestamp) {
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp || 0)) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  /* ============================================================ view */

  const view = (() => {
    let root = null;
    let unsub = null;
    let stage = null;
    let history = [];
    let requesters = [];
    // Kept across repaints so a state broadcast — anyone joining, any
    // reaction — does not throw you back to page one mid-browse.
    let historyPage = 0;
    const HISTORY_PER_PAGE = 25;
    // What was playing last time we painted. A history entry is only
    // completed when a song leaves, so a change here is the one signal
    // that there is something new to fetch.
    let lastCurrentId = null;
    let tab = "queue";
    let searchResults = [];
    let searching = false;
    let searchNote = "";
    // The field keeps its own value; this mirrors it so a remount restores
    // what was typed.
    let searchQuery = "";
    // Which song this browser has voted to skip. The room knows too, but
    // it broadcasts one shared state to everybody and cannot say in it
    // which of them is you.
    let votedFor = "";

    /* ---------------------------------------------------- add + search */

    async function addVideo(videoId, title) {
      // The room verifies the token carried BY THIS MESSAGE, not the one
      // presented at identity time. Sending an add without it — or with a
      // stale one — fails as "you need to be logged in" no matter how
      // logged in you are.
      await ensureToken();
      if (!conn.token) {
        setNotice("Log in with Twitch to add songs.", true);
        return;
      }
      // Send the title when it is already known — a search result carries
      // one — so the room does not have to look up what we can just tell
      // it. It falls back to its own lookup when this is empty.
      if (send({ type: "add", videoId, title: title || "", token: conn.token })) {
        setNotice("Added to the queue.");
      } else {
        setNotice("Not connected to the room.", true);
      }
    }

    async function runSearch(query) {
      const raw = String(query || "").trim();
      if (!raw) return;

      // A pasted link never needs the search API — pull the id straight
      // out of it and queue it, which also works when search has no key.
      const pasted = pastedVideoId(raw);
      if (pasted) {
        addVideo(pasted);
        searchResults = [];
        searchNote = "";
        renderResults();
        return;
      }

      if (!BASE) return;
      searching = true;
      searchNote = "";
      renderResults();

      try {
        const url = new URL("/search", BASE);
        url.searchParams.set("q", raw);
        const response = await fetch(url.href);
        const payload = await response.json();
        if (payload?.ok) {
          searchResults = payload.results || [];
          searchNote = searchResults.length ? "" : "Nothing found for that.";
        } else {
          searchResults = [];
          // Pass the room's own explanation through — "search is not
          // configured" is a very different problem from "search failed".
          searchNote = payload?.message || "Search didn't work.";
        }
      } catch {
        searchResults = [];
        searchNote = "Couldn't reach search. You can still paste a link.";
      }
      searching = false;
      renderResults();
    }

    async function loadHistory() {
      if (!BASE) return;
      try {
        const url = new URL(`/history/${encodeURIComponent(ROOM)}`, BASE);
        const response = await fetch(url.href);
        const payload = await response.json();
        // Newest first by when it actually PLAYED, falling back to the
        // request for entries written before the room stamped that.
        const when = (row) => Number(row?.playedAt || row?.requestedAt || 0);
        history = Array.isArray(payload?.history)
          ? payload.history.slice().sort((a, b) => when(b) - when(a))
          : [];
        // Comes back on the same request, already ordered by count.
        requesters = Array.isArray(payload?.userStats) ? payload.userStats : [];
      } catch {
        history = [];
        requesters = [];
      }
      if (root?.isConnected) renderSide(conn.state);
    }

    /* ---------------------------------------------------- panels */

    /* ------------------------------------------------- search

       The input is created once and kept. Results replace only their own
       container, never the field — rebuilding an input while somebody is
       typing into it loses the caret, and with autocomplete firing on
       every keystroke that would be constant.

       Debounced at 400ms with a three-character floor because each miss
       is a real YouTube Data API search, which is 100 quota units. The
       room caches repeats, so a backspace over a query already sent is
       free, but a fresh one is not. */

    const SEARCH_DEBOUNCE_MS = 400;
    const SEARCH_MIN_CHARS = 3;
    let searchDebounce = 0;

    function buildSearchField() {
      const box = el("div", "msearch");

      const input = document.createElement("input");
      input.className = "msearch-input";
      input.type = "search";
      input.placeholder = "Search YouTube, or paste a link";
      input.setAttribute("aria-label", "Search YouTube or paste a link");
      input.setAttribute("autocomplete", "off");
      input.value = searchQuery;

      input.addEventListener("input", () => {
        searchQuery = input.value;
        window.clearTimeout(searchDebounce);

        const trimmed = searchQuery.trim();

        // A pasted link resolves locally, so it never waits on the timer
        // and never spends a search.
        if (pastedVideoId(trimmed)) {
          searchDebounce = window.setTimeout(() => runSearch(trimmed), 150);
          return;
        }

        if (trimmed.length < SEARCH_MIN_CHARS) {
          searchResults = [];
          searchNote = "";
          renderResults();
          return;
        }
        searchDebounce = window.setTimeout(() => runSearch(trimmed), SEARCH_DEBOUNCE_MS);
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          window.clearTimeout(searchDebounce);
          runSearch(input.value);
        }
        if (event.key === "Escape") {
          window.clearTimeout(searchDebounce);
          searchResults = [];
          searchNote = "";
          renderResults();
        }
      });

      refs.searchInput = input;
      box.append(input);

      refs.searchSpinner = el("span", "msearch-icon", "\u2315");
      box.append(refs.searchSpinner);

      return box;
    }

    function renderResults() {
      const slot = refs.resultsSlot;
      if (!slot) return;
      slot.replaceChildren();

      if (refs.searchSpinner) {
        refs.searchSpinner.classList.toggle("is-busy", searching);
      }

      if (searchNote) {
        slot.append(el("p", "mq-empty", searchNote));
        return;
      }
      if (!searchResults.length) return;

      const panel = el("div", "mresults");

      const head = el("div", "mresults-head");
      head.append(el("span", "mq-k", `${searchResults.length} results - pick one to queue`));
      const clear = el("button", "mresults-clear", "\u2715");
      clear.type = "button";
      clear.setAttribute("aria-label", "Clear results");
      clear.addEventListener("click", () => {
        searchResults = [];
        searchNote = "";
        renderResults();
      });
      head.append(clear);
      panel.append(head);

      const list = el("div", "mresults-list");
      for (const result of searchResults.slice(0, 10)) {
        const videoId = result.videoId || result.id;
        const row = el("button", "mresult");
        row.type = "button";

        // Prefer the id-derived thumbnail: the API returns the 120px
        // "default" size, which looks soft at the size this row uses.
        const art = thumb(videoId, "mresult-thumb");
        if (art) row.append(art);

        const meta = el("div", "mresult-meta");
        meta.append(el("strong", null, result.title || "Untitled"));
        if (result.channelTitle) meta.append(el("small", null, result.channelTitle));
        row.append(meta);
        row.append(el("span", "mresult-add", "+ Add"));

        row.addEventListener("click", () => {
          addVideo(videoId, result.title || "");
          searchResults = [];
          searchNote = "";
          searchQuery = "";
          if (refs.searchInput) refs.searchInput.value = "";
          renderResults();
        });
        list.append(row);
      }
      panel.append(list);
      slot.append(panel);
    }

    function volumePanel() {
      const box = el("div", "mvol");
      box.append(el("span", "mvol-k", "Volume"));

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "mvol-range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.value = String(readVolume());
      slider.setAttribute("aria-label", "Playback volume");

      const readout = el("span", "mvol-v", `${slider.value}`);
      slider.addEventListener("input", () => {
        readout.textContent = slider.value;
        setVolume(Number(slider.value));
      });

      box.append(slider, readout);
      return box;
    }

    function requestersPanel() {
      const box = el("div", "mwho");
      box.append(el("span", "mq-k", "Top requesters"));

      if (!requesters.length) {
        box.append(el("p", "mwho-none", "Nobody has queued anything yet."));
        return box;
      }

      const list = el("div", "mtop");
      requesters.slice(0, 5).forEach((entry, index) => {
        const row = el("div", "mtop-row");
        row.append(el("span", "mtop-n", `${index + 1}`));
        if (entry.avatar) {
          const img = document.createElement("img");
          img.className = "mtop-av";
          img.src = entry.avatar;
          img.alt = "";
          img.loading = "lazy";
          row.append(img);
        }
        row.append(el("span", "mtop-name", entry.displayName || entry.login || "someone"));
        row.append(el("span", "mtop-c", String(entry.count || 0)));
        list.append(row);
      });
      box.append(list);
      return box;
    }

    function listenersPanel(state) {
      const box = el("div", "mwho");
      const names = state?.listenerNames || [];
      const total = Number(state?.listeners || 0);

      const head = el("div", "mwho-head");
      head.append(el("span", "mq-k", "In the room"));
      head.append(el("span", "mwho-count", `${total}`));
      box.append(head);

      if (!names.length) {
        // The roster only ever shows verified Twitch logins, so a room of
        // logged-out listeners is a real count with an empty list.
        box.append(el("p", "mwho-none", total
          ? `${total} listening, none logged in with Twitch.`
          : "Nobody here yet."));
        return box;
      }

      const list = el("div", "mwho-list");
      for (const name of names) list.append(el("span", "mwho-chip", name));
      box.append(list);

      if (total > names.length) {
        box.append(el("p", "mwho-none", `+${total - names.length} not logged in`));
      }
      return box;
    }

    function queueList(state) {
      const wrap = el("div", "mq");
      const items = state?.queue || [];
      if (!items.length) {
        wrap.append(el("p", "mq-empty", "Nothing queued. Search above, or ask in chat with !sr."));
        return wrap;
      }
      items.forEach((item, index) => {
        const row = el("div", "mq-row");
        row.append(el("span", "mq-n", String(index + 1)));
        const art = thumb(item.videoId, "mq-thumb");
        if (art) row.append(art);
        const meta = el("div", "mq-meta");
        meta.append(el("strong", null, item.title || "Untitled"));
        meta.append(el("small", null, item.requestedBy ? `added by ${item.requestedBy}` : "added from chat"));
        row.append(meta);
        if (item.special === "rasputin") row.append(el("span", "mq-tag", "RASPUTIN"));

        // Your own rows, plus everything if you run the room. The server
        // re-checks on every removal, so showing the button is only ever
        // about not offering one that would be refused.
        const mine = conn.login &&
          String(item.requestedByLogin || "").toLowerCase() === conn.login;
        if (mine || canForceSkip()) {
          const drop = el("button", "mq-drop", "\u2715");
          drop.type = "button";
          drop.title = mine ? "Remove your song" : `Remove ${item.requestedBy}'s song`;
          drop.setAttribute("aria-label", drop.title);
          drop.addEventListener("click", () => send({ type: "remove", itemId: item.id }));
          row.append(drop);
        }

        wrap.append(row);
      });
      return wrap;
    }

    /**
     * Highest and lowest rated requesters.
     *
     * Only people with a song actually scored appear. Everyone starts at
     * 1000 and stays there until the room reacts to something of theirs,
     * so listing the unrated would be a wall of ties that says nothing.
     */
    function ratingsList() {
      const wrap = el("div", "mq");

      const rated = requesters
        .filter((entry) => Number(entry.rated) > 0)
        .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));

      if (!rated.length) {
        wrap.append(el("p", "mq-empty",
          "No ratings yet. React to a song and its requester gets scored when it finishes."));
        return wrap;
      }

      const row = (entry, place) => {
        const line = el("div", "mq-row elo-row");
        line.append(el("span", "mq-n", String(place)));

        if (entry.avatar) {
          const img = document.createElement("img");
          img.className = "mtop-av";
          img.src = entry.avatar;
          img.alt = "";
          img.loading = "lazy";
          line.append(img);
        }

        const meta = el("div", "mq-meta");
        const nameEl = el("strong");
        if (entry.login) {
          const a = el("a", "ulink", entry.displayName || entry.login);
          a.href = `/u/${encodeURIComponent(String(entry.login).toLowerCase())}`;
          nameEl.append(a);
        } else {
          nameEl.textContent = entry.displayName || "someone";
        }
        meta.append(nameEl);
        const good = Number(entry.up || 0) + Number(entry.fire || 0);
        const bad = Number(entry.trash || 0) + Number(entry.del || 0);
        const songs = Number(entry.rated || 0);
        meta.append(el("small", null,
          `${songs} song${songs === 1 ? "" : "s"} rated \u00b7 ${good} good reaction${good === 1 ? "" : "s"}, ${bad} bad`));
        line.append(meta);

        const score = el("span", "elo-score", String(Math.round(Number(entry.rating) || 1000)));
        score.classList.add(Number(entry.rating) >= 1000 ? "up" : "down");
        line.append(score);
        return line;
      };

      const top = rated.slice(0, 5);
      wrap.append(el("p", "elo-head", "Highest"));
      top.forEach((entry, i) => wrap.append(row(entry, i + 1)));

      // The bottom list is whoever is left below the top five, so nobody
      // appears in both. With six rated people that is one row; with
      // fewer than six there is no bottom list at all.
      const rest = rated.slice(top.length);
      if (rest.length) {
        wrap.append(el("p", "elo-head", "Lowest"));
        rest.slice(-5).reverse().forEach((entry) => wrap.append(row(entry, rated.indexOf(entry) + 1)));
      }

      return wrap;
    }

    function historyList() {
      const wrap = el("div", "mq");
      if (!history.length) {
        wrap.append(el("p", "mq-empty", "Nothing has played yet."));
        return wrap;
      }

      const pages = Math.max(1, Math.ceil(history.length / HISTORY_PER_PAGE));
      // Clamped rather than trusted: the room trims history as it grows,
      // so the page you were on can stop existing under you.
      historyPage = Math.min(Math.max(0, historyPage), pages - 1);

      const start = historyPage * HISTORY_PER_PAGE;
      for (const entry of history.slice(start, start + HISTORY_PER_PAGE)) {
        const row = el("div", "mq-row");
        const art = thumb(entry.videoId, "mq-thumb");
        if (art) row.append(art);
        const meta = el("div", "mq-meta");
        meta.append(el("strong", null, entry.title || "Untitled"));
        meta.append(el("small", null,
          entry.playedAt
            ? `${entry.requestedBy || "chat"} · played ${timeAgo(entry.playedAt)}`
            : `${entry.requestedBy || "chat"} · added ${timeAgo(entry.requestedAt)}`));
        row.append(meta);

        const again = el("button", "watchbtn mq-again", "Play again");
        again.type = "button";
        again.addEventListener("click", () => addVideo(entry.videoId, entry.title || ""));
        row.append(again);

        wrap.append(row);
      }

      if (pages > 1) {
        const pager = el("div", "mpager");

        const step = (label, delta, disabled) => {
          const btn = el("button", "mpager-btn", label);
          btn.type = "button";
          btn.disabled = disabled;
          btn.addEventListener("click", () => {
            historyPage += delta;
            // Only the list is redrawn, so the player is never touched.
            renderSide(conn.state);
          });
          return btn;
        };

        pager.append(step("\u2039", -1, historyPage === 0));
        pager.append(el("span", "mpager-at",
          `${start + 1}\u2013${Math.min(start + HISTORY_PER_PAGE, history.length)} of ${history.length}`));
        pager.append(step("\u203a", 1, historyPage >= pages - 1));

        wrap.append(pager);
      }

      return wrap;
    }

    /* ---------------------------------------------------- paint */

    /* ------------------------------------------------------ structure

       Built once, then only the changing parts are replaced.

       This used to rebuild the whole view on every state broadcast,
       which tore the stage — and the playing iframe inside it — out of
       the document. mountPlayer then saw the same video id, assumed the
       player was fine, and returned without remounting. The result was a
       black box, appearing at what looked like random moments but was
       actually any time somebody joined, left, voted or reacted.

       So the stage and everything above it in the tree are created once
       and never touched again. Only slots that cannot contain the player
       get replaced. */

    const refs = {};

    function build() {
      root.replaceChildren();

      const head = el("div", "mhead");
      const title = el("h1", "mtitle");
      const emote = document.createElement("img");
      emote.className = "mtitle-emote";
      emote.src = ROOM_EMOTE;
      emote.alt = "";
      const jamgie = document.createElement("img");
      jamgie.className = "mtitle-emote";
      jamgie.src = JAMGIE;
      jamgie.alt = "";
      const jamgie2 = document.createElement("img");
      jamgie2.className = "mtitle-emote";
      jamgie2.src = JAMGIE2;
      jamgie2.alt = "";
      title.append(emote, el("span", "mtitle-text", "The Green Room"), jamgie, jamgie2);
      refs.listeners = el("span", "mlisteners", BASE ? "Connecting\u2026" : "Room not configured");
      head.append(title, refs.listeners);
      root.append(head);

      noticeEl = el("p", "mnotice");
      noticeEl.hidden = true;
      root.append(noticeEl);

      if (!BASE) {
        root.append(el("p", "mq-empty", "No room server is configured for this build."));
        return;
      }

      const shellEl = el("div", "mshell");
      const left = el("div", "mleft");

      // The glow cannot follow the actual audio — the YouTube frame is
      // cross-origin and its waveform is not readable — so it is a steady
      // pulse that runs while something is playing and lifts during a
      // !rasputin block. Honest decoration rather than a fake visualiser.
      refs.stagewrap = el("div", "mstagewrap");
      stage = el("div", "mstage");
      refs.stagewrap.append(el("span", "mstage-glow"), stage);

      // Volume is built once so dragging the slider is never interrupted
      // by somebody else joining the room.
      refs.reactSlot = el("div", "reactbar");
      refs.resultsSlot = el("div", "mslot");
      left.append(refs.stagewrap, refs.reactSlot, volumePanel(), buildSearchField(), refs.resultsSlot);
      shellEl.append(left);

      refs.side = el("div", "mside");
      shellEl.append(refs.side);
      root.append(shellEl);
    }

    /**
   * Who is currently voting to skip.
   *
   * The room only names people it has verified through Twitch, so the
   * count and the list can disagree — anyone logged out is real but
   * anonymous. Saying "and 2 others" is honest about that rather than
   * quietly under-reporting.
   */
    function skipVoterTip(state) {
      const total = Number(state?.skipVotes || 0);
      if (!total) return "Nobody has voted to skip yet";

      const named = (state?.skipVoterNames || []).filter(Boolean);
      const others = Math.max(0, total - named.length);

      if (!named.length) {
        return `${total} vote${total === 1 ? "" : "s"} to skip, nobody logged in`;
      }
      const list = named.join(", ");
      if (!others) return `Voted to skip: ${list}`;
      return `Voted to skip: ${list} and ${others} other${others === 1 ? "" : "s"}`;
    }

    function renderReactions(state) {
      const slot = refs.reactSlot;
      if (!slot) return;
      slot.replaceChildren();
      if (!state?.current) return;

      const all = state.reactions || {};
      for (const { kind, emoji, label } of REACTIONS) {
        const entry = all[kind] || { count: 0, names: [] };
        const btn = el("button", "reactbtn");
        btn.type = "button";
        btn.title = reactionTip(entry, label);
        btn.setAttribute("aria-label", reactionTip(entry, label));

        btn.append(el("span", "reactbtn-emoji", emoji));
        if (entry.count) btn.append(el("span", "reactbtn-n", String(entry.count)));

        btn.addEventListener("click", () => {
          // currentId is required: the room refuses a reaction aimed at a
          // song that has already changed, which is what stops a late
          // click landing on whatever happens to be playing now.
          send({ type: "react", kind, currentId: state.current.id });
          burst(btn, emoji);
        });
        slot.append(btn);
      }
    }

    function renderSide(state) {
      const side = refs.side;
      if (!side) return;
      side.replaceChildren();

      const now = el("div", "mnow");
      const nowArt = state?.current ? thumb(state.current.videoId, "mnow-thumb") : null;
      if (nowArt) now.append(nowArt);

      const nowText = el("div", "mnow-text");
      nowText.append(el("span", "mnow-k", "Now playing"));
      nowText.append(el("strong", "mnow-v", state?.current?.title || "Nothing playing"));
      if (state?.current?.requestedBy) {
        nowText.append(el("small", null, `added by ${state.current.requestedBy}`));
      }
      now.append(nowText);
      side.append(now);

      if (state?.current) {
        const actions = el("div", "mactions");

        const vote = el("button", "watchbtn", `Vote skip (${state.skipVotes}/${state.skipThreshold})`);
        vote.type = "button";
        vote.title = skipVoterTip(state);
        if (votedFor === state.current.id) vote.classList.add("mvoted");
        vote.addEventListener("click", () => {
          // currentId is required. Without it the room drops the vote on
          // its very first line, silently, which is exactly what made
          // this look like it was not counting.
          if (!send({ type: "skip-vote", currentId: state.current.id })) return;
          votedFor = votedFor === state.current.id ? "" : state.current.id;
          renderSide(conn.state);
        });
        actions.append(vote);

        // Mods, or whoever queued what is playing. The server re-checks
        // the verified login on every skip, so this is presentation only.
        const ownsCurrent = conn.login &&
          String(state.current.requestedByLogin || "").toLowerCase() === conn.login;
        const canPull = canForceSkip() || (ownsCurrent && !state.current.unskippable);

        if (canPull) {
          const mine = ownsCurrent && !canForceSkip();
          const force = el("button", "watchbtn mforce", mine ? "Skip mine" : "Skip now");
          force.type = "button";
          force.title = mine
            ? "Take your own song off, no vote needed"
            : "Skip immediately, without a vote";
          force.addEventListener("click", () => send({ type: "force-skip" }));
          actions.append(force);
        }
        side.append(actions);
      }

      side.append(listenersPanel(state));
      side.append(requestersPanel());

      const tabs = el("div", "mtabs");
      for (const [key, label] of [["queue", "Up next"], ["history", "History"], ["elo", "Music ELO"]]) {
        const btn = el("button", `mtab${tab === key ? " active" : ""}`, label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          tab = key;
          // Both come back on the same request, so either tab warms both.
          if ((key === "history" || key === "elo") && !history.length) loadHistory();
          renderSide(conn.state);
        });
        tabs.append(btn);
      }
      side.append(tabs);
      side.append(
        tab === "queue" ? queueList(state)
          : tab === "elo" ? ratingsList()
            : historyList()
      );
    }

    function paint(state) {
      if (!root) return;
      if (!refs.side && !refs.stagewrap) { build(); renderResults(); }
      if (!BASE) return;

      refs.listeners.textContent = state
        ? `${state.listeners} listening`
        : "Connecting\u2026";

      refs.stagewrap.classList.toggle("is-playing", Boolean(state?.current));
      refs.stagewrap.classList.toggle("is-hot", isRasputin(state));

      // History was fetched once on mount and never again, so anything
      // that played or was skipped after you opened the page simply never
      // appeared — and Top Requesters and Ratings quietly froze with it.
      const currentId = state?.current?.id || null;
      if (currentId !== lastCurrentId) {
        lastCurrentId = currentId;
        loadHistory();
      }

      renderReactions(state);
      renderSide(state);

      if (state?.current) mountPlayer(stage, state);
      else destroyPlayer();

      if (isRasputin(state)) startJam(stage); else stopJam(stage);
    }

    return {
      async mount(container) {
        root = container;
        refs.side = null;
        refs.stagewrap = null;
        document.body.classList.add("music-view");
        initAudioLock();
        connect();
        paint(conn.state);
        unsub = subscribe(paint);
        loadHistory();
      },
      unmount() {
        document.body.classList.remove("music-view");
        stopJam(stage);
        destroyPlayer();
        // Leaving the room stops counting you as a listener, which keeps
        // the skip threshold honest for the people still here.
        disconnect();
        unsub?.();
        unsub = null;
        root = null;
        stage = null;
        noticeEl = null;
      }
    };
  })();

  /* ============================================================ boot */

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("music", view);
  }
  boot();

  window.ECV3Music = Object.freeze({ subscribe, send, connect, state: () => conn.state });
})();

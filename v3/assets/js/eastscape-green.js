/* ============================================================
   EastScape: the jukebox IS the Green Room

   Loaded the first time it is needed — the first tick after arriving, or when a jukebox is opened — and never at login.

   ONE ROOM, NOT A SECOND ONE (the owner, 2026-09-21: "would it be possible to replicate the green room / music player
   functionality in eastscape?"). The jukebox used to run its own queue on the game server, which meant EastScape had a music
   room of three people while eastcoin.vip had one of thirteen. This file throws that away and connects to the REAL room: the
   same socket v3-music.js opens, the same queue, the same history and ELO, the same reactions and skip votes. A song put on
   from the Yard appears on the site as that person's; the site's listener count includes anyone standing in the casino.

   WHAT THAT COST: a song is FREE here now, as it is on the site. It used to take RADIO.song.cost tickets, and the jukebox was
   a ticket sink. The scarcity that remains is the QUEUE SLOT, which is what the Green Room already limits and what people
   actually feel. If a sink is wanted back it should not be this: charging in-game for what the website gives away is the kind
   of difference nobody can explain.

   HOW IT TALKS (all of this is v3-music.js's protocol, not a new one):
     - a short-lived signed token from /api/music/token, which bridges the site's session cookie (the music Worker is a
       different origin and cannot see it). Renewed a minute before it expires.
     - wss://<worker>/room/main?client=<id>, then { type:"identity", token } on open.
     - in:  { type:"state", state } and { type:"error", message }.
     - out: add / react / skip-vote / force-skip / remove / ended.
   Playback is the same sync as before: the room says startedAt, the page seeks the player to (now - startedAt).

   THE PLAYER IS ONE PER BROWSER. Somebody with the site's Green Room or its floating player open in another tab would
   otherwise hear two of everything. `claim` below is a BroadcastChannel handshake: this page asks whether anything else is
   playing, and if something answers it stays quiet and says so. The site answers on the same channel.

   IT PLAYS EVERYWHERE (2026-09-21, the owner: "lets make it play on all maps/areas the same way it does in the yard"). It
   used to stop at the edge of a floor with a jukebox on it. It no longer asks where you are, so the socket is opened once and
   kept: a connection is a listener, and someone with the game open IS listening, wherever they are standing. leave() is kept
   for a caller that wants the old behaviour back and is no longer used.
   ============================================================ */
export function createGreen(env) {
  const { G, SFX, esc, $, host, vol, silent, mute, isOff, panelOn } = env;
  const R = G.RADIO.song;
  /* Decodes HTML entities by letting the parser do it in a textarea, whose content is never executed. Everything that
     passes through here is esc()'d again before it reaches the page, so decoding cannot introduce markup. */
  const unent = (v) => { const t = document.createElement("textarea"); t.innerHTML = String(v ?? ""); return t.value; };
  const BASE = "https://eastcoin-music-room.jake-7f5.workers.dev", ROOM = "main";
  const LEAVE_MS = 45000;

  let state = null, sock = null, tok = null, tokAt = 0, tokTimer = 0, tries = 0, leaveTimer = 0, login = "";
  let dock = null, player = null, ready = false, cur = "", apiAsked = false;
  let tabEl = null, tab = "queue", results = [], note = "", busy = false, paint = 0;
  let hist = null, histAt = 0, voted = "", quiet = false, err = "";

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const elapsed = () => (state?.startedAt ? Math.max(0, (Date.now() - Number(state.startedAt)) / 1000) : 0);
  const idOf = (text) => { const t = String(text || "").trim(), m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(t); return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(t) ? t : null; };
  /* WHO THE ROOM THINKS YOU ARE, from /api/music/token's own answer — not from the game's idea of your name. The room decides
     what you may do from the login inside the verified token and nothing else, so anything drawn off a different name is a
     button that does nothing. An empty login matches nothing: "" === "" would otherwise make every row in the queue yours,
     which is what the first cut did to a signed-out visitor.

     MODS must match FORCE_SKIP_LOGINS in worker/src/index.js and MODS in v3-music.js — change one, change all three. It is
     the MUSIC room's list, not EastScape's admin list: they happen to overlap today, but they answer different questions, and
     keying this off the game's `admin` flag would draw buttons the room refuses for an EastScape admin who does not run the
     room. The worker checks it again anyway, so being wrong here only ever costs a button, never a permission. */
  const MODS = new Set(["zwades", "andyreidisapawg", "bootypaper"]);
  const mineIs = (who) => !!login && String(who || "").toLowerCase() === login;
  const canManage = (who) => mineIs(who) || (!!login && MODS.has(login));

  /* ---------------------------------------------------------------- one player per browser */
  /* The site answers "who is playing" on this channel. If anything does, this page does not start a player at all and the
     jukebox says where the sound is coming from instead — which is better than silently losing to it. */
  let chan = null;
  function claim() {
    try { chan = new BroadcastChannel("eastcoin-music-player"); } catch { return; }
    chan.addEventListener("message", (e) => {
      const m = e.data;
      if (m?.type === "playing" && m.who !== "eastscape") { if (!quiet) { quiet = true; stop(); draw(); } }
      if (m?.type === "who") chan.postMessage({ type: "playing", who: "eastscape" });
      if (m?.type === "stopped" && m.who !== "eastscape") { if (quiet) { quiet = false; sync(); draw(); } }
    });
    chan.postMessage({ type: "who" });
    // Nothing answered inside a moment: the sound is ours.
    setTimeout(() => { if (!quiet) chan?.postMessage({ type: "playing", who: "eastscape" }); }, 350);
  }

  /* ---------------------------------------------------------------- the token */
  async function fetchToken() {
    try {
      /* (2026-09-22, the owner: "i get this error at the jukebox") GET, NOT POST. functions/api/music/token.js exports
         onRequestGet alone, so a POST came back 405 and tok stayed null - which is why the panel said "Couldn't confirm
         your Twitch login" no matter how signed in you were. The game's Green Room had never once minted a token. The
         retry added on 2026-09-21 for the same complaint could not have helped: it re-ran the same 405. Every other
         caller (v3-music.js, the two site players) has always used GET, which is the shape the endpoint answers. */
      const r = await fetch("/api/music/token", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) { tok = null; tokAt = 0; return null; }
      const p = await r.json();
      tok = p.token || null; tokAt = Number(p.expiresAt) || 0;
      login = String(p.login || "").toLowerCase();
    } catch { tok = null; tokAt = 0; login = ""; }
    return tok;
  }
  /* An expired token is still a non-empty string, so "have we got one" is not the question — "is it still good" is. */
  const tokFresh = () => Boolean(tok) && tokAt - Date.now() > 60000;
  async function ensureToken() { if (tokFresh()) return tok; await fetchToken(); if (tok) say({ type: "identity", name: "", avatar: "", token: tok }); renewLater(); return tok; }
  function renewLater() { clearTimeout(tokTimer); if (!tokAt) return; tokTimer = setTimeout(ensureToken, Math.max(30000, tokAt - Date.now() - 60000)); }

  /* ---------------------------------------------------------------- the socket */
  function say(msg) { if (sock?.readyState !== 1) return false; try { sock.send(JSON.stringify(msg)); return true; } catch { return false; } }
  function clientId() {
    try { const k = "ec_music_client"; let v = localStorage.getItem(k); if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); } return v; }
    catch { return Math.random().toString(36).slice(2); }
  }
  function connect() {
    clearTimeout(leaveTimer); leaveTimer = 0;
    if (sock) return;
    let url;
    try { url = new URL(`/room/${encodeURIComponent(ROOM)}`, BASE); url.protocol = url.protocol === "https:" ? "wss:" : "ws:"; url.searchParams.set("client", clientId()); }
    catch { return; }
    let s; try { s = new WebSocket(url.href); } catch { return; }
    sock = s;
    s.addEventListener("open", async () => { tries = 0; await fetchToken(); say({ type: "identity", name: "", avatar: "", token: tok }); renewLater(); if (!chan) claim(); });
    s.addEventListener("message", (e) => {
      let p; try { p = JSON.parse(e.data); } catch { return; }
      if (p?.type === "state" && p.state) { state = p.state; if (busy) { busy = false; note = ""; results = []; } sync(); draw(); }
      if (p?.type === "error" && p.message) { err = String(p.message); busy = false; draw(); }
    });
    const drop = () => {
      if (sock !== s) return;
      sock = null; stop();
      /* Backing off matters: the room stops its polling alarm when it is empty, so a tight retry across several tabs is real
         load on somebody else's Worker. */
      setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(tries++, 5)));
    };
    s.addEventListener("close", drop);
    s.addEventListener("error", drop);
  }
  /** Walking off the floor: keep the socket for a moment, because walking through is not leaving. */
  function leave() {
    if (!sock || leaveTimer) return;
    leaveTimer = setTimeout(() => { leaveTimer = 0; disconnect(); }, LEAVE_MS);
    sync();
  }
  function disconnect() {
    clearTimeout(tokTimer); clearTimeout(leaveTimer); tokTimer = leaveTimer = 0;
    const s = sock; sock = null; stop();
    try { s?.close(); } catch { /* already gone */ }
    try { chan?.postMessage({ type: "stopped", who: "eastscape" }); } catch { /* fine */ }
  }

  /* ---------------------------------------------------------------- the player */
  /* MINIMISED IS REMEMBERED, OFF IS NOT A THIRD SETTING (2026-09-21, the owner: "the mini player on the main site ... has a
     minimize button, an exit button, and a bar that shows the songs progress").

     Minimising hides the picture and keeps the sound, the way the site's dock does — `display:none` on the stage does not
     stop a YouTube iframe's audio, which the site has relied on in production for a while (it hides the stage on every
     phone). The choice is kept per browser.

     The ✕ does NOT invent an "the dock is closed" flag. It turns the Green Room off through the game's OWN es_radio_off —
     the same switch the jukebox window's Mute button reads — so there is exactly one idea of "off" and the way back is a
     button that already exists and already says "Muted". A second flag would have let the dock be closed while the game
     still thought music was on, with nothing on screen to turn it back. */
  const MIN_KEY = "es_green_min";
  const minOn = () => { try { return localStorage.getItem(MIN_KEY) === "1"; } catch { return false; } };

  function ensureDock() {
    if (dock) return dock; css();
    dock = document.createElement("div"); dock.className = "sgdock"; dock.hidden = true; dock.setAttribute("aria-label", "The Green Room");
    dock.innerHTML = `<div class="sg-head"><span class="sg-nm">🎵<b class="sg-nw"> Green Room</b></span><small class="sg-ht" id="sgHt"></small><span class="sg-sp"></span>
        <button type="button" class="sg-b" id="sgMin">–</button>
        <button type="button" class="sg-b" id="sgOff" title="Turn the Green Room off">✕</button></div>
      <div class="sg-stage"><div id="sgPlayer"></div></div>
      <div class="sg-bar"><i id="sgFill"></i></div>
      <div class="sg-cap"><small id="sgCap"></small><span class="sg-t" id="sgT"></span></div>`;
    host().append(dock);

    const mb = dock.querySelector("#sgMin");
    const paintMin = () => { const v = dock.classList.contains("min"); mb.textContent = v ? "□" : "–"; mb.title = v ? "Expand" : "Minimise"; mb.setAttribute("aria-pressed", String(v)); };
    dock.classList.toggle("min", minOn()); paintMin();
    mb.addEventListener("click", () => {
      const v = !dock.classList.contains("min");
      dock.classList.toggle("min", v);
      try { localStorage.setItem(MIN_KEY, v ? "1" : "0"); } catch { /* private window: it just won't be remembered */ }
      paintMin(); SFX.play("ui_click");
    });
    dock.querySelector("#sgOff").addEventListener("click", () => { SFX.play("ui_click"); mute?.(true); stop(); });
    return dock;
  }
  /* (2026-09-22, the owner: "the green room player isnt opening for me ... i think i exited out of it with the new X button")
     THE X LEFT NOTHING ON SCREEN. Turning the room off through es_radio_off is still right - one switch, and the jukebox's
     Mute button reads the same one - but stop() then hid the dock completely, so the only way back was a button labelled
     "Muted" inside the jukebox window, which nothing points at. es_radio_off is per-browser localStorage, so it outlives a
     character reset and the player never comes back on its own. (The owner could not reach that button at all: the
     jukebox's radio tab was not loading either, which left the browser console as the only way back.)

     This is NOT a second flag - the state is still es_radio_off alone. It is the OFF STATE of the same dock: when a song is
     playing and the room is switched off, the corner shows a pill instead of nothing, and clicking it writes that same flag
     back. Not shown when the whole game is muted (the top bar's mute button already says so and owns that switch), nor when
     another tab holds the player. */
  let offEl = null;
  function offPill(show) {
    if (!show) { if (offEl) offEl.hidden = true; return; }
    if (!offEl) {
      css();
      offEl = document.createElement("div"); offEl.className = "sgoff";
      offEl.innerHTML = `<button type="button" id="sgOn" title="Turn the Green Room back on">\u{1F3B5} Green Room is off — <b>turn it on</b></button>`;
      host().append(offEl);
      offEl.querySelector("#sgOn").addEventListener("click", () => { SFX.play("ui_click"); mute?.(false); sync(); });
    }
    offEl.hidden = false;
  }

  function ensureApi() {
    if (apiAsked) return; apiAsked = true; ensureDock();
    const go = () => { player = new window.YT.Player("sgPlayer", { width: "240", height: "135", playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onReady: () => { ready = true; sync(); }, onStateChange: (e) => { if (e.data === 0) ended("ended"); },
        onError: () => { ended("error"); cur = ""; const c = $("sgCap"); if (c) c.textContent = "YouTube won't play this one here."; } } }); };
    if (window.YT?.Player) return go();
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch { /* somebody else's */ } go(); };
    const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; sc.async = true; document.head.append(sc);
  }
  /* Guarded server-side against a stale id, so several tabs reporting the same song is harmless: only the first advances. */
  function ended(why) { if (state?.current?.id) say({ type: "ended", currentId: state.current.id, reason: why }); }
  function stop() { clearInterval(barTimer); barTimer = 0; if (dock) dock.hidden = true; if (ready && cur) { try { player.stopVideo(); } catch { /* not started */ } cur = ""; } }

  /* THE BAR MOVES ON ITS OWN CLOCK. sync() runs every three seconds (eastscape.html's tick), so a bar drawn only from
     there crawls in three-second jerks. This is local arithmetic against startedAt — no request, no call into the YouTube
     player — and it only runs while something is actually playing, so it costs nothing when the room is quiet. */
  let barTimer = 0;
  function tickBar() {
    const c = state?.current; if (!dock || dock.hidden || !c) return;
    let at = elapsed(), dur = Number(c.duration) || 0;
    /* THE ROOM DOES NOT SEND A DURATION (2026-09-21, the owner: "dont see the progress bar"). The first cut divided by
       state.current.duration, which is simply not in the room's state — so every song was "unknown length", the fill
       stayed at 0% and the time read as a bare elapsed figure with no total. The PLAYER is the only thing that knows how
       long a video is, which is where v3-music.js reads it from too; the room clock is the fallback for the second or
       two before it is ready. */
    try {
      const t = Number(player?.getCurrentTime?.()), d = Number(player?.getDuration?.());
      if (Number.isFinite(t) && t > 0) at = t;
      if (Number.isFinite(d) && d > 0) dur = d;
    } catch { /* between states: the room clock will do */ }
    if (dur) at = Math.min(at, dur);
    const f = $("sgFill"); if (f) f.style.width = dur ? `${Math.min(100, (at / dur) * 100).toFixed(1)}%` : "0%";
    const el = $("sgT"); if (el) el.textContent = dur ? `${mmss(at)} / ${mmss(dur)}` : mmss(at);
  }

  /** Make the player match what the room says: the right video, at the right second, at the right volume, or nothing at all. */
  function sync() {
    const c = state?.current, at = elapsed(), dur = Number(c?.duration) || 0;
    /* (2026-09-21, the owner: "lets make it play on all maps/areas the same way it does in the yard") It used to stop the moment
       you left a floor with a jukebox on it. It no longer asks where you are: the Green Room follows you into the Wilderness,
       down the Crypt and out to the islands. Only the volume, the mute and another tab's player can silence it. */
    const on = !!c && !silent() && !quiet;
    if (!on) { stop(); offPill(!!c && !quiet && !!isOff?.() && !SFX.muted()); return; }
    offPill(false);
    ensureApi(); dock.hidden = false;
    const cap = `${c.title}${c.requestedBy ? ` · ${c.requestedBy}` : ""}`;
    $("sgCap").textContent = cap;
    $("sgHt").textContent = c.title || "";   /* shown only while minimised, so a bar still says what is on */
    tickBar();
    if (!barTimer) barTimer = setInterval(tickBar, 1000);
    if (!ready) return;
    try {
      player.setVolume(Math.round(Math.max(0, Math.min(1, vol())) * 100));
      if (cur !== c.id) { cur = c.id; player.loadVideoById({ videoId: c.videoId, startSeconds: Math.max(0, at) }); return; }
      const t = player.getCurrentTime?.() || 0;
      if (Math.abs(t - at) > 3 && (!dur || at < dur - 2)) player.seekTo(at, true);
      if (player.getPlayerState?.() === 2) player.playVideo();   // a background tab paused it: carry on
    } catch { /* the player is between states; the next pass catches up */ }
  }

  /* ---------------------------------------------------------------- asking for things */
  async function find(q) {
    const id = idOf(q); if (id) return add(id, "");
    if (q.length < 3) { note = "Three letters or more."; return draw(); }
    note = "Looking…"; results = []; draw();
    try {
      const j = await fetch(R.search + encodeURIComponent(q)).then((r) => r.json());
      /* YOUTUBE'S TITLES ARRIVE HTML-ESCAPED ("Let&#39;s Dance, Boys!"). esc() then escaped the ampersand again, so the
         entity itself was drawn. Decode once here, at the edge, and every esc() downstream stays correct and safe. */
      results = (j?.ok ? j.results || [] : []).map((x) => ({ ...x, title: unent(x.title), channelTitle: unent(x.channelTitle) }));
      note = results.length ? "" : j?.ok ? "Nothing found. Try other words." : "Search isn't answering. Paste a YouTube link instead.";
    } catch { note = "Search isn't answering. Paste a YouTube link instead."; }
    draw();
  }
  /* THE TOKEN IS ASKED FOR AGAIN IF WE DO NOT HAVE ONE (fixed 2026-09-21, the owner: "says i need to be logged in with
     twitch to request a song as well. i should already be signed in"). fetchToken ran exactly once, in the socket open
     handler — so if that call raced the page, failed, or the session arrived a moment later,  stayed empty for the
     rest of the session and the panel kept insisting you were signed out. Asking again costs one request and only happens
     when we genuinely have nothing. */
  let retried = 0;
  async function needToken() {
    if (tok && login) return true;
    if (Date.now() - retried < 4000) return Boolean(tok);
    retried = Date.now();
    await fetchToken();
    if (tok) { say({ type: "identity", name: "", avatar: "", token: tok }); renewLater(); }
    draw();
    return Boolean(tok);
  }
  async function add(videoId, title) {
    if (busy) return;
    busy = true; err = ""; note = "Putting it in…"; SFX.play("chip"); draw();
    if (!(await needToken())) {
      busy = false; note = "";
      err = "Couldn't confirm your Twitch login. Open eastcoin.vip in this tab and sign in, then try again.";
      return draw();
    }
    if (!say({ type: "add", videoId, title: title || "", token: tok })) { busy = false; note = "Not connected to the room."; }
    draw();
    setTimeout(() => { if (busy) { busy = false; note = ""; draw(); } }, 6000);
  }
  const REACTS = [["up", "👍"], ["fire", "🔥"], ["trash", "🗑️"]];
  function react(kind) { if (!state?.current) return; SFX.play("ui_click"); say({ type: "react", kind, currentId: state.current.id }); }
  function voteSkip() {
    if (!state?.current) return;
    say({ type: "skip-vote", currentId: state.current.id });
    voted = voted === state.current.id ? "" : state.current.id; draw();
  }

  /* ---------------------------------------------------------------- history and rankings */
  async function loadHist() {
    if (hist && Date.now() - histAt < 60000) return hist;
    try {
      const j = await fetch(`${BASE}/history/${ROOM}?limit=40`).then((r) => r.json());
      hist = { plays: j?.history || [], top: j?.ratings || j?.stats || [] }; histAt = Date.now();
    } catch { hist = { plays: [], top: [] }; }
    return hist;
  }

  /* ---------------------------------------------------------------- the tab */
  function css() {
    if (document.getElementById("esGreenCss")) return;
    const st = document.createElement("style"); st.id = "esGreenCss";
    st.textContent = `.sgdock{position:absolute;right:10px;bottom:10px;z-index:5;width:240px;border-radius:8px;overflow:hidden;background:#0c0a09;box-shadow:0 0 0 2px #3a2e22,0 8px 24px rgba(0,0,0,.6)}
.sgdock[hidden]{display:none}
.sgoff{position:absolute;right:10px;bottom:10px;z-index:5}.sgoff[hidden]{display:none}
.sgoff button{cursor:pointer;border:0;border-radius:8px;padding:7px 11px;font:inherit;font-size:12px;font-weight:700;color:#f4ede5;background:#0c0a09;box-shadow:0 0 0 2px #3a2e22,0 8px 24px rgba(0,0,0,.6)}.sgoff button b{color:#ffd77a}.sgoff button:hover{background:#171310}.sgdock .sg-stage{position:relative;aspect-ratio:16/9;background:#000}.sgdock .sg-stage iframe,.sgdock .sg-stage>div{position:absolute;inset:0;width:100%;height:100%;border:0}
.sgdock .sg-cap{display:flex;gap:6px;align-items:baseline;padding:4px 8px;font-size:12px;font-weight:800;color:#f4ede5;white-space:nowrap;overflow:hidden}.sgdock .sg-cap small{flex:1;min-width:0;color:#aca298;font-weight:700;overflow:hidden;text-overflow:ellipsis}
.sgdock .sg-t{flex:none;color:#8d8279;font-weight:700;font-size:11px;font-variant-numeric:tabular-nums}
.sgdock .sg-bar{height:4px;background:#2a2118}.sgdock .sg-bar i{display:block;height:100%;width:0;background:#f2c94c;transition:width .95s linear}
/* the header: what it is, then minimise and off. Same two controls, same order, as the site's floating player. */
.sgdock .sg-head{display:flex;gap:6px;align-items:center;padding:3px 4px 3px 8px;background:#161210;border-bottom:1px solid #2a2118}
.sgdock .sg-nm{font-size:11px;font-weight:800;color:#e8dccb;white-space:nowrap;flex:none}
.sgdock .sg-ht{display:none;flex:1;min-width:0;font-size:11px;font-weight:700;color:#aca298;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sgdock .sg-sp{flex:1}
.sgdock .sg-b{width:20px;height:20px;flex:none;padding:0;border:0;border-radius:4px;background:#2a2118;color:#f4ede5;font:inherit;font-size:12px;font-weight:800;line-height:20px;cursor:pointer}
.sgdock .sg-b:hover{background:#4a3a28;color:#fff}
.sgdock.min{width:230px}
.sgdock.min .sg-stage,.sgdock.min .sg-bar,.sgdock.min .sg-cap{display:none}
/* minimised, the words "Green Room" give way to the song: a bar that does not say what is on is just a bar */
.sgdock.min .sg-ht{display:block}.sgdock.min .sg-sp{display:none}.sgdock.min .sg-nw{display:none}
@media (prefers-reduced-motion:reduce){.sgdock .sg-bar i{transition:none}}
.gr-now{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:6px;background:#2a1a10;color:#f3e7cc;margin-bottom:6px}.gr-now>div{flex:1;min-width:0}.gr-now b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gr-now small{color:#e0c890}
.gr-now img{width:52px;height:39px;object-fit:cover;border-radius:3px;flex:none}
.gr-bar{display:flex;gap:5px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.gr-bar .lk-btn{padding:3px 8px}.gr-bar .on{background:#ffe9a8}
.gr-who{margin-left:auto;font-size:12px;font-weight:800;color:#6a5a40;white-space:nowrap}
.gr-tabs{display:flex;gap:4px;margin:8px 0 6px;flex-wrap:wrap}
.gr-list{display:flex;flex-direction:column;gap:3px;max-height:230px;overflow:auto}
.gr-list>div,.gr-list>button{display:flex;gap:8px;align-items:center;text-align:left;padding:4px 6px;border:0;border-radius:5px;background:rgba(0,0,0,.05);font:inherit;font-weight:700;font-size:13px}
.gr-list button{cursor:pointer}.gr-list button:hover{background:#ffe9a8}
.gr-list img{width:44px;height:33px;object-fit:cover;border-radius:3px;flex:none}
.gr-list span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gr-list small{color:#6a5a40;white-space:nowrap;font-weight:700}
.gr-find{display:flex;gap:6px;margin-bottom:6px}.gr-find input{flex:1;min-width:0;padding:6px 8px;border:2px solid #b89a6a;border-radius:5px;background:#fff8e6;font:inherit}
.gr-bad{color:#a8291f}`;
    document.head.append(st);
  }

  function nowBlock() {
    const c = state?.current;
    if (!c) return `<div class="gr-now"><div><b>Nothing on</b><small>${state ? `${state.listeners || 0} listening · be the DJ` : "Connecting to the Green Room…"}</small></div></div>`;
    const dur = Number(c.duration) || 0, left = dur ? Math.max(0, dur - elapsed()) : 0;
    return `<div class="gr-now">${c.videoId ? `<img src="https://i.ytimg.com/vi/${esc(c.videoId)}/default.jpg" alt="" loading="lazy">` : ""}
      <div><b>${esc(c.title || "A song")}</b><small>${c.requestedBy ? `${esc(c.requestedBy)}'s pick` : "on the jukebox"}${dur ? ` · ${mmss(left)} left` : ""}</small></div></div>`;
  }
  function barBlock() {
    const c = state?.current, rx = state?.reactions || {};
    const bits = REACTS.map(([k, e]) => `<button type="button" class="lk-btn" data-react="${k}" title="${k}">${e}${rx[k]?.count ? ` ${rx[k].count}` : ""}</button>`).join("");
    const skip = c ? `<button type="button" class="lk-btn${voted === c.id ? " on" : ""}" data-skip="1">Skip · ${state.skipVotes || 0}/${state.skipThreshold || 0}</button>` : "";
    /* Your own song is yours to pull — the vote protects the room from a song somebody ELSE chose — and the room's own
       moderators can pull anything. */
    const pull = c && canManage(c.requestedByLogin) ? `<button type="button" class="lk-btn" data-pull="1">Skip now</button>` : "";
    return `<div class="gr-bar">${bits}${skip}${pull}<span class="gr-who">${state ? `${state.listeners || 0} listening` : ""}</span></div>`;
  }
  function queueList() {
    const q = state?.queue || [];
    if (!q.length) return `<div class="jk-msg">Nothing waiting. Put something on.</div>`;
    return `<div class="gr-list">${q.map((it, i) => `<div>${it.videoId ? `<img src="https://i.ytimg.com/vi/${esc(it.videoId)}/default.jpg" alt="" loading="lazy">` : ""}
        <span>${i + 1}. ${esc(it.title || "A song")}<small style="display:block">${esc(it.requestedBy || "")}</small></span>
        ${canManage(it.requestedByLogin) ? `<button type="button" class="lk-btn" data-drop="${esc(it.id)}" title="${mineIs(it.requestedByLogin) ? "Take it off" : "Remove it (you run the room)"}">×</button>` : ""}</div>`).join("")}</div>`;
  }
  function histList() {
    const rows = hist?.plays || [];
    if (!rows.length) return `<div class="jk-msg">${hist ? "Nothing played yet." : "Reading the history…"}</div>`;
    return `<div class="gr-list">${rows.slice(0, 40).map((h) => `<button type="button" data-again="${esc(h.videoId || "")}">
      ${h.videoId ? `<img src="https://i.ytimg.com/vi/${esc(h.videoId)}/default.jpg" alt="" loading="lazy">` : ""}
      <span>${esc(h.title || "A song")}<small style="display:block">${esc(h.requestedBy || "")} · play again</small></span></button>`).join("")}</div>`;
  }
  function topList() {
    const rows = (hist?.top || []).slice(0, 30);
    if (!rows.length) return `<div class="jk-msg">${hist ? "No rankings yet." : "Reading the rankings…"}</div>`;
    return `<div class="gr-list">${rows.map((t, i) => `<div><span>${i + 1}. ${esc(t.title || t.name || "A song")}</span><small>${Math.round(Number(t.rating ?? t.elo ?? t.plays ?? 0))}</small></div>`).join("")}</div>`;
  }

  function draw() {
    /* (2026-09-22, the owner: "the radio tab still doesnt work") THE JUKEBOX'S TWO TABS SHARE ONE ELEMENT. #jukeBody holds
       the Green Room panel or the radio panel, whichever tab is up - and this function rewrites that element's innerHTML
       on every message from the room AND once a second for the countdown. isConnected was the only guard, and #jukeBody is
       a permanent div that is never detached, so it was always true: switching to the radio tab drew the radio UI and the
       Green Room painted over it within a second. The radio tab rendered fine and then vanished, which is why the Mute
       button in it - the documented way to undo the dock's X - could not be reached at all. */
    if (!tabEl?.isConnected || (panelOn && !panelOn())) return; css();
    /* WHAT YOU WERE TYPING SURVIVES THE REDRAW (fixed 2026-09-21, the owner: "i can paste it then it disappears"). This
       panel rebuilds its whole innerHTML — on every state message from the room AND once a second for the countdown — so a
       pasted link was wiped within a second of landing, every time. The box's value, the caret and the focus are carried
       across; a search box nobody can type into is worse than no search box. */
    const box = tabEl.querySelector("#grQ");
    const keep = box ? { v: box.value, a: box.selectionStart, b: box.selectionEnd, had: document.activeElement === box } : null;
    const TABS = [["queue", `Up next${state?.queue?.length ? ` · ${state.queue.length}` : ""}`], ["hist", "History"], ["top", "Rankings"]];
    tabEl.innerHTML = `${nowBlock()}${barBlock()}
      ${quiet ? `<div class="jk-msg">Playing in your other EastCoin tab. Close it to hear it here.</div>` : ""}
      <form class="gr-find" id="grForm" autocomplete="off"><input id="grQ" maxlength="120" placeholder="Search a song, or paste a YouTube link…" aria-label="Search a song or paste a YouTube link"><button type="submit" class="lk-btn">Find</button></form>
      <div class="jk-msg${err ? " gr-bad" : ""}" id="grNote">${esc(err || note || (sock && !login
        ? "You can listen, but putting a song on needs your Twitch login on eastcoin.vip."
        : `Free, and the whole of eastcoin.vip hears it with you. Up to ${state?.queueLimit || R.queue} in the queue.`))}</div>
      ${results.length ? `<div class="gr-list">${results.map((x, i) => `<button type="button" data-i="${i}">${x.thumbnail ? `<img src="${esc(x.thumbnail)}" alt="" loading="lazy">` : ""}<span>${esc(x.title)}<small style="display:block">${esc(x.channelTitle || "")}</small></span></button>`).join("")}</div>` : ""}
      <div class="gr-tabs">${TABS.map(([k, l]) => `<button type="button" class="lk-btn" role="tab" data-gt="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>
      ${tab === "queue" ? queueList() : tab === "hist" ? histList() : topList()}`;

    if (keep) { const box2 = tabEl.querySelector("#grQ"); if (box2) { box2.value = keep.v; if (keep.had) { box2.focus(); try { box2.setSelectionRange(keep.a, keep.b); } catch { /* not a text input any more */ } } } }
    tabEl.querySelector("#grForm").addEventListener("submit", (e) => { e.preventDefault(); err = ""; find(tabEl.querySelector("#grQ").value.trim()); });
    tabEl.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { const x = results[+b.dataset.i]; if (x) add(x.videoId, x.title); }));
    tabEl.querySelectorAll("[data-react]").forEach((b) => b.addEventListener("click", () => react(b.dataset.react)));
    tabEl.querySelector("[data-skip]")?.addEventListener("click", voteSkip);
    tabEl.querySelector("[data-pull]")?.addEventListener("click", () => say({ type: "force-skip" }));
    tabEl.querySelectorAll("[data-drop]").forEach((b) => b.addEventListener("click", () => say({ type: "remove", itemId: b.dataset.drop })));
    tabEl.querySelectorAll("[data-again]").forEach((b) => b.addEventListener("click", () => b.dataset.again && add(b.dataset.again, "")));
    tabEl.querySelectorAll("[data-gt]").forEach((b) => b.addEventListener("click", () => {
      tab = b.dataset.gt; SFX.play("ui_click");
      if (tab === "hist" || tab === "top") loadHist().then(draw);
      draw();
    }));
  }

  /** The window is open: redraw once a second for the countdown, and stop the moment it closes. */
  function render(el) {
    tabEl = el; connect(); draw();
    clearInterval(paint);
    paint = setInterval(() => { if (!tabEl?.isConnected) return clearInterval(paint); draw(); }, 1000);
    if (tab === "hist" || tab === "top") loadHist().then(draw);
  }

  return {
    render, sync, connect, leave, disconnect,
    playing: () => !!state?.current,
    listeners: () => state?.listeners || 0,
    count: () => (state?.queue?.length || 0) + (state?.current ? 1 : 0)
  };
}

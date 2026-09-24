/* ============================================================
   EastScape: the Picture House — eastcoin.vip's Movies & TV, on the big screen

   Loaded the first time somebody walks up to the screen, never at login.

   IT IS THE SITE'S OWN ROOMS (the owner, 2026-09-21: "is it possible to create a movie theatre room and wire in the Screen
   aka movies and tv section of eastcoin into eastscape so users could watch shows and stuff there together?"). Nothing here
   is a second implementation: the catalog is /api/screen/{browse,search}, the player is vidy.st with the same embed URL
   v3-screen.js builds, and a room is /api/screen/room — create, beat, end — which already did the hard part on 2026-09-15.
   Same origin, so the session cookie rides along and the members-only gate is satisfied without a bridge.

   HOW A ROOM STAYS IN STEP, and why it is not frame-locked. vidy.st only REPORTS its clock; nothing can press play on
   somebody else's embed. So the host writes position and playing every ~5 s (and at once on play, pause or a seek), and a
   guest who has drifted past 8 s has their embed RELOADED at the host's projected position — paused there if the host is
   paused. A reload is visible, so it is rate-limited to one per 12 s and the bar says what is happening. Close enough for a
   film. This mirrors v3-screen.js deliberately: change the sync here and the two rooms disagree about the same film.

   THE MUSIC DUCKS. The Green Room follows you everywhere since it stopped asking where you are, and a film with a song over
   it is the one thing this room must not do. Opening the window claims the browser's player on the same BroadcastChannel
   the Green Room and the site's music page already use, so the jukebox goes quiet and says why. Closing it hands playback
   back.

   ITS URL IS ?v=2, NOT ?v=1. The first version is POISONED at the edge: something asked for it before the file had finished
   deploying, got the SPA fallback (the shell, as text/html), and /v3/assets/js/* is cached immutable for a year — so that URL
   will serve an HTML document until 2027. Nothing can purge it; the only move is a version nobody has asked for yet. Check
   the CONTENT and the content-type of a new asset before a page ever points at it, and do not touch the real URL to do it.

   POLL COST, said out loud because /api/screen/room is not edge-cached: a guest reads every 5 s while the window is OPEN and
   stops the moment it closes — no background polling, ever. The host writes on its own events plus every 5 s. That is the
   same rate the website uses, and the room API's own header note covers the arithmetic.
   ============================================================ */
export function createScreen(env) {
  const { SFX, esc, $, host, onClose } = env;

  const PLAYER = "https://www.vidy.st", ACCENT = "b8863a";
  const DRIFT_S = 8, RELOAD_MS = 12000, BEAT_MS = 5000, POLL_MS = 5000;

  let el = null, tab = "rooms", q = "", results = [], browse = null, note = "", busy = false;
  let rooms = [], roomsAt = 0;
  let now = null;                 // what this tab is playing: { type, id, title, poster, year, season, episode }
  let room = null;                // the room we are in, as the server last described it
  let offset = 0;                 // server clock minus ours
  let myPos = 0, myPlaying = false, lastReloadAt = 0, lastBeatAt = 0, lastBeatPos = 0;
  let pollTimer = 0, paintTimer = 0, frame = null, chan = null, ducked = false;

  const clock = (s) => { const n = Math.max(0, Math.floor(s)); const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), x = n % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
  const keyOf = (i) => (i ? `${i.type}:${i.id}:${i.season || 0}:${i.episode || 0}` : "");
  const serverNow = () => Date.now() + offset;
  /** Where the host is now: their last written position, plus the time since they wrote it if they were playing. */
  const hostPos = () => (!room ? 0 : room.playing ? room.position + Math.max(0, serverNow() - room.updatedAt) / 1000 : room.position);

  /* ---------------------------------------------------------------- the music gets out of the way */
  function duck(on) {
    if (on === ducked) return;
    ducked = on;
    try {
      chan ||= new BroadcastChannel("eastcoin-music-player");
      /* Claiming the player is what the Green Room listens for; releasing it lets the jukebox start again. */
      chan.postMessage({ type: on ? "playing" : "stopped", who: "theatre" });
    } catch { /* no BroadcastChannel: the mute in the top bar is the fallback */ }
  }

  /* ---------------------------------------------------------------- the catalog */
  const getJson = async (url) => {
    try {
      const r = await fetch(url, { credentials: "include" });
      return r.headers.get("content-type")?.includes("json") ? await r.json() : null;
    } catch { return null; }
  };

  /* A refusal has to SAY so. Movies & TV is members-only (screen/_gate.js answers 401 without a Twitch session), and an
     expired session would otherwise leave an empty shelf that looks like "nothing is on" rather than "you are logged out". */
  function refused(p) {
    if (!p) { note = "The Picture House isn't reachable right now."; return true; }
    if (!p.ok) { note = p.message || "Movies & TV turned that down."; return true; }
    return false;
  }
  async function loadRooms(force) {
    if (!force && Date.now() - roomsAt < 10000) return;
    const p = await getJson("/api/screen/room?list=1");
    if (refused(p)) return draw();
    rooms = p.rooms || []; roomsAt = Date.now(); offset = (p.now || Date.now()) - Date.now(); note = "";
    draw();
  }
  async function loadBrowse() {
    if (browse) return;
    const [m, t] = await Promise.all([
      getJson("/api/screen/browse?type=movie&list=trending"),
      getJson("/api/screen/browse?type=tv&list=trending")
    ]);
    if (refused(m) && refused(t)) return draw();
    browse = [...(m?.results || []).slice(0, 12), ...(t?.results || []).slice(0, 12)];
    if (browse.length) note = "";
    draw();
  }
  async function search(text) {
    if (text.length < 2) { note = "Two letters or more."; return draw(); }
    note = "Looking…"; results = []; draw();
    const p = await getJson(`/api/screen/search?q=${encodeURIComponent(text)}`);
    if (refused(p)) return draw();
    results = p.results || [];
    note = results.length ? "" : "Nothing found.";
    draw();
  }

  /* ---------------------------------------------------------------- the player */
  function embedUrl(item, resume, autoplay) {
    const p = new URLSearchParams({ color: ACCENT });
    if (resume > 0) p.set("progress", String(Math.floor(resume)));
    if (autoplay !== undefined) p.set("autoplay", autoplay ? "true" : "false");
    if (item.type === "tv") {
      p.set("nextEpisode", "true"); p.set("episodeSelector", "true"); p.set("autoplayNextEpisode", "true");
      return `${PLAYER}/tv/${item.id}/${item.season || 1}/${item.episode || 1}?${p}`;
    }
    return `${PLAYER}/movie/${item.id}?${p}`;
  }
  function reloadEmbed(resume, autoplay) {
    if (!now || !frame) return;
    frame.src = embedUrl(now, Math.max(0, resume), autoplay);
    myPlaying = Boolean(autoplay); myPos = Math.max(0, resume); lastReloadAt = Date.now();
  }
  function play(item, { resume = 0, autoplay = true } = {}) {
    now = { ...item };
    if (now.type === "tv") { now.season = item.season || 1; now.episode = item.episode || 1; }
    duck(true); SFX.play("ui_open");
    tab = "watch"; draw();
    reloadEmbed(resume, autoplay);
  }
  function stopPlaying() {
    now = null; myPlaying = false; myPos = 0;
    duck(false);
    if (frame) { frame.removeAttribute("src"); frame = null; }
  }

  /* vidy.st talks back through postMessage and that is the ONLY thing it does — it takes no commands. */
  function onMessage(e) {
    let h = ""; try { h = new URL(e.origin).hostname; } catch { return; }
    if (!/(^|\.)vidy\.st$/.test(h)) return;
    let d = e.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
    if (!d || d.type !== "PLAYER_EVENT") return;
    const x = d.data || d, ev = x.event || x.name, t = Number(x.currentTime);
    if (Number.isFinite(t)) myPos = t;
    if (ev === "play" || ev === "timeupdate") myPlaying = true;
    if (ev === "pause" || ev === "ended") myPlaying = false;
    if (room?.isHost) {
      const jumped = Math.abs(t - (lastBeatPos + (Date.now() - lastBeatAt) / 1000)) > 3;
      if (ev === "play" || ev === "pause" || ev === "ended" || jumped || Date.now() - lastBeatAt > BEAT_MS) {
        beat({ playing: !(ev === "pause" || ev === "ended") });
      }
    }
  }

  /* ---------------------------------------------------------------- rooms */
  const roomPost = (body) => fetch("/api/screen/room", {
    method: "POST", credentials: "include", keepalive: true,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }).then((r) => r.json()).catch(() => null);

  function takeRoom(p) {
    if (!p?.room) return;
    room = p.room; offset = (p.now || Date.now()) - Date.now();
  }
  async function beat({ playing }) {
    if (!room?.isHost || !now) return;
    lastBeatAt = Date.now(); lastBeatPos = myPos;
    await roomPost({ action: "beat", room: room.id, position: Math.floor(myPos), playing, item: now });
  }
  async function hostRoom() {
    if (!now || busy) return;
    busy = true; note = "Opening the room…"; draw();
    const p = await roomPost({ action: "create", item: now, position: Math.floor(myPos) });
    busy = false;
    if (!p?.ok) { note = p?.message || "Couldn't open a room."; return draw(); }
    takeRoom(p); note = ""; startPoll(); draw();
  }
  async function joinRoom(id) {
    if (busy) return;
    busy = true; note = "Taking a seat…"; draw();
    const p = await getJson(`/api/screen/room?room=${encodeURIComponent(id)}`);
    busy = false;
    if (!p?.ok) { note = "That room has gone."; loadRooms(true); return draw(); }
    takeRoom(p); note = "";
    play({ ...room.item }, { resume: Math.floor(hostPos()), autoplay: room.playing });
    startPoll();
  }
  async function leaveRoom() {
    const was = room;
    room = null; stopPoll(); draw();
    if (was?.isHost) await roomPost({ action: "end", room: was.id });
  }

  function startPoll() { stopPoll(); pollTimer = setInterval(poll, POLL_MS); }
  function stopPoll() { clearInterval(pollTimer); pollTimer = 0; }
  async function poll() {
    if (!room || !el?.isConnected) return stopPoll();
    const p = await getJson(`/api/screen/room?room=${encodeURIComponent(room.id)}`);
    if (!p?.ok) { if (p?.code === "NO_ROOM") { room = null; stopPoll(); draw(); } return; }
    const wasHost = room.isHost;
    takeRoom(p);
    if (wasHost) return draw();                       // the host only wants to see who is in
    if (room.ended) { note = "The host closed the room. The film keeps playing for you."; room = null; stopPoll(); return draw(); }
    if (keyOf(room.item) !== keyOf(now)) { play({ ...room.item }, { resume: Math.floor(hostPos()), autoplay: room.playing }); return; }
    draw();
    if (room.stale) return;                           // the host's clock has stopped; say so and touch nothing
    if (Date.now() - lastReloadAt < RELOAD_MS) return;   // a reload is visible: let the last one settle
    const at = hostPos();
    if (!room.playing && myPlaying) reloadEmbed(room.position, false);
    else if (room.playing && (!myPlaying || Math.abs(myPos - at) > DRIFT_S)) reloadEmbed(at + 1, true);
  }

  /* ---------------------------------------------------------------- drawing */
  function css() {
    if (document.getElementById("esScreenCss")) return;
    const st = document.createElement("style"); st.id = "esScreenCss";
    st.textContent = `.sx-tabs{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}
.sx-stage{position:relative;aspect-ratio:16/9;background:#000;border-radius:6px;overflow:hidden;margin-bottom:8px}
.sx-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.sx-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:12px;font-weight:700}
.sx-bar .sx-who{margin-left:auto;color:#6a5a40;white-space:nowrap}
.sx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px;max-height:300px;overflow:auto}
.sx-grid button{display:block;padding:0;border:0;background:none;font:inherit;cursor:pointer;text-align:left}
.sx-grid img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:5px;display:block;background:#2a2118}
.sx-grid span{display:block;font-size:11px;font-weight:800;line-height:1.2;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3a2a14}
.sx-grid button:hover span{color:#8a1a2a}
.sx-rooms{display:flex;flex-direction:column;gap:5px;max-height:290px;overflow:auto}
.sx-room{display:flex;gap:8px;align-items:center;padding:5px 7px;border-radius:6px;background:rgba(0,0,0,.05)}
.sx-room img{width:32px;height:48px;object-fit:cover;border-radius:4px;flex:none;background:#2a2118}
.sx-room div{flex:1;min-width:0}
.sx-room b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx-room small{color:#6a5a40;font-weight:700}
.sx-find{display:flex;gap:6px;margin-bottom:6px}
.sx-find input{flex:1;min-width:0;padding:6px 8px;border:2px solid #b89a6a;border-radius:5px;background:#fff8e6;font:inherit}`;
    document.head.append(st);
  }

  function poster(u, w = 185) { return u ? (/^https?:/.test(u) ? u : `https://image.tmdb.org/t/p/w${w}${u}`) : ""; }

  function card(x) {
    const t = x.title || x.name || "Untitled";
    return `<button type="button" data-pick='${esc(JSON.stringify({ type: x.type || (x.name ? "tv" : "movie"), id: x.id, title: t, poster: x.poster || x.poster_path || "", year: x.year || "" }))}'>
      ${x.poster || x.poster_path ? `<img src="${esc(poster(x.poster || x.poster_path))}" alt="" loading="lazy">` : `<img alt="">`}
      <span>${esc(t)}</span></button>`;
  }

  function stage() {
    if (!now) return "";
    const mine = room?.isHost;
    const what = `${esc(now.title || "Playing")}${now.type === "tv" ? ` · S${now.season}E${now.episode}` : ""}`;
    return `<div class="sx-stage" id="sxStage"></div>
      <div class="sx-bar"><b>${what}</b>
        ${room
          ? `<span>${mine ? "You're hosting" : `Following ${esc(room.host?.displayName || room.host?.login || "the host")}`}${room.stale && !mine ? " · their clock has stopped" : ""}</span>
             <button type="button" class="lk-btn" id="sxLeave">${mine ? "Close the room" : "Watch on your own"}</button>`
          : `<button type="button" class="lk-btn" id="sxHost">Put it on for the room</button>`}
        <button type="button" class="lk-btn" id="sxStop">Stop</button>
        <span class="sx-who">${room ? `${room.watching || 1} watching` : clock(myPos)}</span></div>`;
  }

  function roomsList() {
    if (!rooms.length) return `<div class="jk-msg">Nothing on right now. Find something and put it on — everyone in here watches it with you.</div>`;
    return `<div class="sx-rooms">${rooms.map((r) => `<div class="sx-room">
      ${r.item?.poster ? `<img src="${esc(poster(r.item.poster, 185))}" alt="" loading="lazy">` : `<img alt="">`}
      <div><b>${esc(r.item?.title || "Something")}</b><small>${esc(r.host?.displayName || r.host?.login || "someone")} · ${r.watching || 1} watching${r.stale ? " · paused" : ""}</small></div>
      <button type="button" class="lk-btn" data-join="${esc(r.id)}">Sit in</button></div>`).join("")}</div>`;
  }

  function draw() {
    if (!el?.isConnected) return; css();
    const TABS = [["rooms", `Now showing${rooms.length ? ` · ${rooms.length}` : ""}`], ["find", "Find something"]];
    el.innerHTML = `${stage()}
      ${now ? "" : `<div class="sx-tabs">${TABS.map(([k, l]) => `<button type="button" class="lk-btn" role="tab" data-sx="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>`}
      ${note ? `<div class="jk-msg">${esc(note)}</div>` : ""}
      ${now ? "" : tab === "rooms" ? roomsList()
        : `<form class="sx-find" id="sxForm" autocomplete="off"><input id="sxQ" maxlength="80" placeholder="Search a film or a show…" value="${esc(q)}" aria-label="Search a film or a show"><button type="submit" class="lk-btn">Find</button></form>
           <div class="sx-grid">${(results.length ? results : browse || []).map(card).join("")}</div>`}`;

    // The iframe is moved, never rebuilt: re-creating it would restart the film on every repaint.
    const st = el.querySelector("#sxStage");
    if (st) { frame ||= Object.assign(document.createElement("iframe"), { allow: "autoplay; fullscreen; encrypted-media", allowFullscreen: true }); st.append(frame); }

    el.querySelectorAll("[data-sx]").forEach((b) => b.addEventListener("click", () => {
      tab = b.dataset.sx; SFX.play("ui_click");
      if (tab === "find") loadBrowse(); else loadRooms(true);
      draw();
    }));
    el.querySelectorAll("[data-join]").forEach((b) => b.addEventListener("click", () => joinRoom(b.dataset.join)));
    el.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
      let x; try { x = JSON.parse(b.dataset.pick); } catch { return; }
      play(x, { resume: 0, autoplay: true });
    }));
    el.querySelector("#sxHost")?.addEventListener("click", hostRoom);
    el.querySelector("#sxLeave")?.addEventListener("click", leaveRoom);
    el.querySelector("#sxStop")?.addEventListener("click", () => { leaveRoom(); stopPlaying(); tab = "rooms"; draw(); });
    const form = el.querySelector("#sxForm");
    form?.addEventListener("submit", (e) => { e.preventDefault(); q = el.querySelector("#sxQ").value.trim(); search(q); });
  }

  function open(node) {
    el = node; css(); note = ""; draw();
    addEventListener("message", onMessage);
    loadRooms(true);
    clearInterval(paintTimer);
    paintTimer = setInterval(() => { if (!el?.isConnected) return clearInterval(paintTimer); if (!room && !now) loadRooms(false); }, 10000);
  }
  /** Closing the window stops everything: the film, the polling and the claim on the browser's player. */
  function close() {
    removeEventListener("message", onMessage);
    stopPoll(); clearInterval(paintTimer);
    if (room?.isHost) roomPost({ action: "end", room: room.id });
    room = null; stopPlaying(); el = null;
    onClose?.();
  }

  return { open, close, playing: () => !!now };
}

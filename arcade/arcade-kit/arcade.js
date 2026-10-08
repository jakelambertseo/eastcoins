/* The Arcade's shell (2026-10-07): what every page in the arcade shares — the lounge and every game behind its cabinets.

     Arcade.start({ stage, room, title, where, look, help, ...callbacks }) -> A

   It puts the arcade's own chrome inside the game's stage, all from the Arcade Kit:
     top left      MENU (Esc): resume, back to the lounge, every game, settings, how to play, exit to EastCoin
     top right     you: your Twitch picture and name (or "Log in with Twitch"), and the jukebox's now-playing chip
     bottom left   the chat (Enter), like EastScape's: ONE chat for the lounge and all its games; EastScape's is separate
     toasts        under the menu button
   and it holds the connection to the room server (arcade-worker): a member signed in to eastcoin.vip arrives as themselves, with their
   saved look, no second login. On localhost it connects as a dev login (?as=name) to `wrangler dev` on :8788; with no server there it
   runs OFFLINE (the page can fill the room with bots) so the mockups still open on their own.

   Settings live in this browser (localStorage ecArcadeSettings) and every game reads the same ones: sound, music, the glow, quality,
   names over heads, camera. A game listens with onSettings. */
import { ROOMS, CHARS, CHAR_NAMES, HATS, RADIO, NET, CHAT, cleanLook, DEFAULT_LOOK } from "/v3/assets/js/arcade-rules.js?v=2";

const DEV = ["localhost", "127.0.0.1"].includes(location.hostname);
// framed inside eastcoin.vip (v3-arcade.js, ?embed=1): moving between games and leaving go through the site's shell, so its address bar and nav follow
const EMBED = window.parent !== window && new URLSearchParams(location.search).has("embed");
const toShell = (go) => { try { window.parent.postMessage({ type: "ec-arcade", go }, location.origin); } catch {} };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const NAME_COLS = ["#19e3ff", "#ff7ac0", "#b6ff2e", "#ffd400", "#c49bff", "#ff9a4a", "#7affd8", "#ff8a8a"];
export const nameColor = (login) => { let h = 0; for (const c of String(login)) h = (h * 31 + c.charCodeAt(0)) | 0; return NAME_COLS[Math.abs(h) % NAME_COLS.length]; };

// the games on the menu. Paths are the mockups' for now; on the site they become /lounge, /climb, ...
export const GAMES = [
  { room: "lounge", name: "The Lounge", href: "../lounge3d-mock/", icon: "🕹️", col: "var(--ak-pink)", open: true },
  { room: "climb", name: "The Climb", href: "../climb3d-mock/", icon: "🧗", col: "var(--ak-purple)", open: true },
  { room: "tycoon", name: "Franchise Tycoon", href: "../tycoon3d-mock/", icon: "🏟️", col: "var(--ak-yellow)" },
  { room: "hooked", name: "Hooked", href: "../hooked-mock/", icon: "🎣", col: "var(--ak-cyan)" },
  { room: "gridiron", name: "Gridiron Career", href: "../gridiron-mock/", icon: "🏈", col: "var(--ak-lime)" },
  { room: "party", name: "Party Mix", href: "../partymix3d-mock/", icon: "🎉", col: "var(--ak-pink)" }
];

export const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.8, music: 0.4, mute: false, musicInGames: true, glow: true, quality: "auto", showFps: true, names: true, camSens: 1, invertY: false, chatOpen: true };
const SET_KEY = "ecArcadeSettings";

export async function start(opts) {
  const { stage, room = "lounge" } = opts;
  // on a phone the chat starts closed (open, it covers half the screen); a saved choice still wins
  const settings = { ...DEFAULT_SETTINGS, chatOpen: !matchMedia("(pointer: coarse)").matches, ...store.get(SET_KEY, {}) };
  const setListeners = [];
  const A = {
    room, settings, online: false, guest: false, me: null, people: new Map(), radio: null, unlocks: [],
    look: cleanLook({ ...DEFAULT_LOOK, ...store.get("ecPlayer", {}) }),
    onSettings(fn) { setListeners.push(fn); fn(settings); },
    isTyping: () => ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
  };
  const cb = (name, ...a) => { try { opts[name]?.(...a); } catch (e) { console.error(e); } };

  /* ------------------------------------------------------------------ the chrome */
  stage.classList.add("ak-stage");
  const hud = document.createElement("div"); hud.className = "ak-hud";
  hud.innerHTML = `
    <div class="ak-hud-tl"><button type="button" class="ak-btn sm ak-menubtn" data-act="menu" title="Menu (Esc)">☰ MENU</button><span class="ak-roomchip">${esc(opts.title || ROOMS[room]?.name || "")}</span><span class="ak-fps" hidden></span></div>
    <div class="ak-toasts ak-toasts-hud"></div>
    <div class="ak-hud-tr"><button type="button" class="ak-np" data-act="radio" hidden></button>
      <button type="button" class="ak-whobtn" data-act="who" aria-expanded="false" title="Who's online"><span class="ak-dot"></span><b>1</b> online</button><span class="ak-me"></span>
      <div class="ak-who ak-panel" hidden></div></div>
    <div class="ak-hud-bl">
      <div class="ak-chatbox ak-panel" hidden><div class="ak-chat" aria-live="polite"></div>
        <form class="ak-chatform"><input class="ak-input" maxlength="${CHAT.max}" placeholder="Say something to the arcade" autocomplete="off" enterkeyhint="send"><button class="ak-btn sm" type="submit">Send</button></form></div>
      <button type="button" class="ak-btn round ak-chatbtn" data-act="chat" title="Chat (Enter)" aria-label="Chat">💬<span class="ak-unread" hidden></span></button>
    </div>
    <div class="ak-overlay" hidden><div class="ak-win ak-panel lit" role="dialog" aria-modal="true"></div></div>`;
  stage.append(hud);
  const q = (s) => hud.querySelector(s);
  const chatBox = q(".ak-chatbox"), chatLog = q(".ak-chat"), chatIn = q(".ak-chatform input"), unread = q(".ak-unread"), overlay = q(".ak-overlay"), win = q(".ak-win");
  const focusGame = () => stage.querySelector("canvas")?.focus({ preventScroll: true });

  function drawMe() {
    const el = q(".ak-me");
    if (A.me) el.innerHTML = `<span class="ak-av sm" style="--ring:${A.online ? "var(--ak-lime)" : "var(--ak-mute)"}">${A.me.avatar ? `<img src="${esc(A.me.avatar)}" alt="">` : esc(A.me.name[0]?.toUpperCase())}</span><b>${esc(A.me.name)}</b>${A.online ? "" : `<small>offline</small>`}`;
    else if (A.guest) el.innerHTML = `<a class="ak-btn sm" target="_top" href="/api/picks/auth/twitch/start?returnTo=${encodeURIComponent(EMBED ? window.top.location.pathname + window.top.location.search : location.pathname + location.search)}">Log in with Twitch</a>`;
    else el.innerHTML = `<span class="ak-av sm" style="--ring:var(--ak-mute)">?</span><b>Connecting…</b>`;
  }
  drawMe();

  /* ---- toasts */
  A.notify = (text, icon = "🔔", tone = "") => {
    const box = q(".ak-toasts-hud"), n = document.createElement("div");
    n.className = `ak-toast ${tone}`; n.innerHTML = `<i>${icon}</i><span>${text}</span>`; box.prepend(n);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => n.classList.add("out"), 6000); setTimeout(() => n.remove(), 6600);
  };

  /* ---- chat */
  const lines = [];
  let unreadN = 0;
  function chatLine(m) {
    const mine = A.me && m.id === A.me.id, col = nameColor(m.login || m.name);
    const where = m.room && m.room !== room ? `<small>in ${esc(ROOMS[m.room]?.name || m.room)}</small>` : "";
    if (m.sys) return `<p class="sys">${esc(m.text)}</p>`;
    return `<p class="${mine ? "me" : ""}" style="--c:${col}">${mine ? "" : `<span class="ak-av xs" style="--ring:${col}">${m.avatar ? `<img src="${esc(m.avatar)}" alt="">` : esc(String(m.name)[0]?.toUpperCase())}</span><b>${esc(m.name)}</b>`}${where}${esc(m.text)}</p>`;
  }
  function addChat(m) {
    lines.push(m); if (lines.length > 60) lines.shift();
    const atEnd = chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 30;
    chatLog.insertAdjacentHTML("beforeend", chatLine(m)); while (chatLog.children.length > 60) chatLog.firstChild.remove();
    if (atEnd || (A.me && m.id === A.me.id)) chatLog.scrollTop = chatLog.scrollHeight;
    if (chatBox.hidden && !m.sys && !(A.me && m.id === A.me.id)) { unreadN++; unread.hidden = false; unread.textContent = unreadN > 9 ? "9+" : unreadN; }
  }
  A.localChat = (name, text, sys = false) => addChat({ id: "bot:" + name, login: name, name, text, room, at: Date.now(), sys });   // offline bots
  function setChatOpen(open, focus = false) {
    chatBox.hidden = !open; settings.chatOpen = open; store.set(SET_KEY, settings);
    if (open) { unreadN = 0; unread.hidden = true; chatLog.scrollTop = chatLog.scrollHeight; if (focus) chatIn.focus(); }
  }
  setChatOpen(settings.chatOpen);
  q(".ak-chatform").addEventListener("submit", (e) => {
    e.preventDefault(); const text = chatIn.value.trim(); if (!text) { focusGame(); return; }
    if (A.online) send({ t: "chat", text }); else if (A.guest) A.notify("Log in with Twitch to chat.", "💬", "pink");
    else addChat({ id: A.me?.id || "me", login: A.me?.login || "you", name: A.me?.name || "You", text, room, at: Date.now() });
    chatIn.value = ""; focusGame();
  });
  chatIn.addEventListener("keydown", (e) => { if (e.key === "Escape") { chatIn.blur(); focusGame(); } e.stopPropagation(); });

  /* ---- windows: the menu, settings, the jukebox, how to play */
  let open = null;
  function openWin(kind) {
    open = kind; overlay.hidden = false; win.className = `ak-win ak-panel lit ak-win-${kind}`;
    if (kind === "menu") drawMenu(); else if (kind === "custom") drawCustom(); else if (kind === "look") drawLook(); else if (kind === "settings") drawSettings(); else if (kind === "juke") drawJuke(); else if (kind === "help") drawHelp();
    win.querySelector("button, input")?.focus({ preventScroll: true });
  }
  function closeWin() { open = null; overlay.hidden = true; win.innerHTML = ""; focusGame(); }
  A.openMenu = () => openWin("menu"); A.openSettings = () => openWin("settings"); A.openJukebox = () => openWin("juke"); A.closeWindow = closeWin;
  A.windowOpen = () => Boolean(open);
  overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) closeWin(); });
  const head = (t, back = true) => `<div class="ak-win-head"><b class="ak-h2 ak-neon">${t}</b>${back ? `<button type="button" class="ak-btn sm ghost" data-act="${open === "menu" ? "close" : "menu"}">${open === "menu" ? "✕" : "← Menu"}</button>` : ""}</div>`;
  function countIn(r) { let n = 0; for (const p of A.people.values()) if (p.room === r) n++; if (A.me && room === r) n++; return n; }
  function drawMenu() {
    win.innerHTML = `${head("MENU")}
      <div class="ak-menu-main"><button type="button" class="ak-btn" data-act="close">▶ Resume</button>
        ${room !== "lounge" ? `<button type="button" class="ak-btn cyan" data-go="lounge">🕹️ Back to the lounge</button>` : ""}
        <button type="button" class="ak-btn ghost" data-act="settings">⚙ Settings</button>
        ${opts.help ? `<button type="button" class="ak-btn ghost" data-act="help">? How to play</button>` : ""}</div>
      <p class="ak-eyebrow" style="margin:18px 0 8px">Games</p>
      <div class="ak-menu-games">${GAMES.map((g) => `<button type="button" class="ak-mg${g.room === room ? " here" : ""}${g.open ? "" : " soon"}" data-go="${g.room}" style="--g:${g.col}"><i>${g.icon}</i><b>${esc(g.name)}</b><small>${g.room === room ? "you're here" : g.open ? `${countIn(g.room)} here` : "coming soon"}</small></button>`).join("")}</div>
      <div class="ak-menu-foot"><a class="ak-btn sm ghost" href="/" target="_top" data-act="exit">Exit to EastCoin</a>${DEV ? `<small>dev · ${A.online ? "connected to :8788" : "offline"}</small>` : ""}</div>`;
  }
  /* YOUR LOOK, from the lounge's prize clerk (the owner: "the vanity widget needs to be an NPC in the lounge instead"). A game opens it with
     A.openLook({ name, line }); online, what's unlocked is the server's word, offline this browser's saves. */
  let lookNpc = null;
  A.openLook = (npc = null) => { lookNpc = npc; openWin("look"); };
  const hasHat = (h) => h.free || (A.online ? A.unlocks : opts.localUnlocks || []).includes(h.key);
  function drawLook() {
    const locked = HATS.filter((h) => !hasHat(h));
    win.innerHTML = `${head(lookNpc ? "PRIZE COUNTER" : "YOUR LOOK")}
      ${lookNpc ? `<div class="ak-npcsay"><span class="ak-av" style="--ring:var(--ak-lime)">${esc(lookNpc.icon || "🎟️")}</span><p><b>${esc(lookNpc.name)}</b>${esc(lookNpc.line || "")}</p></div>` : ""}
      <p class="ak-eyebrow">Character</p><div class="ak-opick">${CHARS.map((c, i) => `<button type="button" class="ak-btn sm${A.look.model === c ? "" : " ghost"}" data-model="${c}">${CHAR_NAMES[i]}</button>`).join("")}</div>
      <p class="ak-eyebrow">Hat</p><div class="ak-opick">${HATS.map((h) => `<button type="button" class="ak-btn sm${A.look.hat === h.key ? " yellow" : " ghost"}" data-hat="${h.key}" ${hasHat(h) ? "" : "disabled"} title="${esc(h.note || "")}">${esc(h.name)}${hasHat(h) ? "" : " 🔒"}</button>`).join("")}</div>
      <p class="ak-note">${A.online ? "Saved to your account: it follows you into every game, on any device." : "Saved in this browser."}${locked.length ? ` 🔒 ${locked.map((h) => esc(h.note)).join("; ")}.` : ""}</p>`;
  }
  /* A game's own window, in the shell's frame: A.openCustom({ title, html, onClick(button, win), onOpen(win) }). The poker room's lobby
     and cashier use it. `redraw` re-renders it in place. */
  let custom = null;
  A.openCustom = (c) => { custom = c; openWin("custom"); };
  A.redrawCustom = () => { if (open === "custom") drawCustom(); };
  function drawCustom() { win.innerHTML = `${head(esc(custom.title))}<div class="ak-custom">${typeof custom.html === "function" ? custom.html() : custom.html}</div>`; custom.onOpen?.(win); }
  win.addEventListener("click", (e) => { if (open !== "custom") return; const b = e.target.closest("button, [data-c]"); if (b && !b.dataset.act) custom?.onClick?.(b, win); });
  function drawHelp() { win.innerHTML = `${head("HOW TO PLAY")}<div class="ak-help">${opts.help}</div>`; }
  const slider = (k, label) => `<label class="ak-set"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(settings[k] * 100)}" data-set="${k}" data-scale="100"><output>${Math.round(settings[k] * 100)}</output></label>`;
  const toggle = (k, label, sub = "") => `<div class="ak-set"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><button type="button" class="ak-toggle" aria-pressed="${Boolean(settings[k])}" data-tog="${k}" aria-label="${esc(label)}"></button></div>`;
  function drawSettings() {
    win.innerHTML = `${head("SETTINGS")}
      <div class="ak-sets">
        <section><p class="ak-eyebrow">Sound</p>${toggle("mute", "Mute everything", "M")}${slider("master", "Master")}${slider("sfx", "Effects")}${slider("music", "Jukebox")}${toggle("musicInGames", "Jukebox in the games", "the lounge's station follows you")}</section>
        <section><p class="ak-eyebrow">Graphics</p>${toggle("glow", "Neon glow", "turn off on a slow machine")}
          <div class="ak-set"><span>Quality</span><span class="ak-seg">${["auto", "low", "medium", "high"].map((v) => `<button type="button" class="ak-chip${settings.quality === v ? " on" : ""}" data-qual="${v}">${v}</button>`).join("")}</span></div>
          ${toggle("names", "Names over heads")}${toggle("showFps", "Show FPS", "frames per second, top left")}</section>
        <section><p class="ak-eyebrow">Camera</p><label class="ak-set"><span>Look speed</span><input type="range" min="40" max="200" value="${Math.round(settings.camSens * 100)}" data-set="camSens" data-scale="100"><output>${settings.camSens.toFixed(1)}×</output></label>${toggle("invertY", "Invert up and down")}</section>
        <section><p class="ak-eyebrow">Your look</p><p class="ak-note">${esc(opts.lookHint || "Your character and hat are changed at the prize counter in the lounge.")}</p></section>
      </div>`;
  }
  A.set = (k, v) => { settings[k] = v; applySettings(); };
  function applySettings(save = true) { if (save) store.set(SET_KEY, settings); for (const fn of setListeners) fn(settings); syncRadio(); }
  win.addEventListener("input", (e) => {
    const k = e.target.dataset.set; if (!k) return;
    settings[k] = Number(e.target.value) / Number(e.target.dataset.scale); e.target.nextElementSibling.textContent = k === "camSens" ? `${settings[k].toFixed(1)}×` : e.target.value;
    applySettings();
  });
  win.addEventListener("click", (e) => {
    const b = e.target.closest("button, a"); if (!b) return;
    if (b.dataset.tog) { settings[b.dataset.tog] = !settings[b.dataset.tog]; b.setAttribute("aria-pressed", settings[b.dataset.tog]); applySettings(); }
    else if (b.dataset.qual) { settings.quality = b.dataset.qual; applySettings(); drawSettings(); }
    else if (b.dataset.model) { A.setLook({ ...A.look, model: b.dataset.model }); drawLook(); }
    else if (b.dataset.hat) { A.setLook({ ...A.look, hat: b.dataset.hat }); drawLook(); }
    else if (b.dataset.go) { const g = GAMES.find((x) => x.room === b.dataset.go); if (g.room === room) closeWin(); else go(g); }
    else if (b.dataset.station) { A.radioSet(b.dataset.station); }
    else if (b.dataset.genre) { jukeSearch({ tag: b.dataset.genre }); }
  });
  /* WHO'S ONLINE (the owner: "the whose online needs to be a button in the lounge/other lounge games, which drops down and shows whose
     where"). Everyone the room server knows, by room, with the floor or table they're at; Join takes you to their game. Offline, the
     page can hand in its bots (A.setFakePeople) so the mockup still shows the shape. */
  const whoBtn = q(".ak-whobtn"), whoBox = q(".ak-who");
  let fake = [];
  A.setFakePeople = (list) => { fake = list; drawWho(); };
  function everyone() { const me = { id: A.me?.id || "me", name: A.me?.name || "You", login: A.me?.login || "you", avatar: A.me?.avatar, room, where, me: true }; return [me, ...(A.online ? [...A.people.values()] : fake)]; }
  function drawWho() {
    const all = everyone();
    whoBtn.querySelector("b").textContent = all.length;
    if (whoBox.hidden) return;
    const order = [...GAMES.map((g) => g.room), ...all.map((p) => p.room)].filter((r, i, a) => a.indexOf(r) === i);
    whoBox.innerHTML = `<p class="ak-eyebrow">Who's online · ${all.length}${A.online ? "" : " · bots"}</p>` + order.map((r) => {
      const ps = all.filter((p) => p.room === r); if (!ps.length) return "";
      const g = GAMES.find((x) => x.room === r);
      return `<div class="ak-who-room"><div class="ak-who-head" style="--g:${g?.col || "var(--ak-cyan)"}"><span>${g?.icon || "🎮"} ${esc(ROOMS[r]?.name || g?.name || r)}</span><small>${ps.length}</small>${r !== room && g?.open ? `<button type="button" class="ak-btn sm cyan" data-joinroom="${esc(r)}">Join</button>` : ""}</div>
        <ul class="ak-roster">${ps.map((p) => `<li class="${p.me ? "me" : ""}"><span class="ak-av xs" style="--ring:${nameColor(p.login || p.name)}">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc(String(p.name)[0]?.toUpperCase())}</span><b>${esc(p.name)}</b><small>${esc(p.where || (p.me ? "you" : ""))}</small></li>`).join("")}</ul></div>`;
    }).join("");
  }
  A.redrawWho = drawWho;
  function setWho(open) { whoBox.hidden = !open; whoBtn.setAttribute("aria-expanded", String(open)); if (open) drawWho(); }
  whoBox.addEventListener("click", (e) => { const b = e.target.closest("[data-joinroom]"); if (b) { setWho(false); A.go(b.dataset.joinroom); } });
  addEventListener("pointerdown", (e) => { if (!whoBox.hidden && !e.target.closest(".ak-who, .ak-whobtn")) setWho(false); });
  hud.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
    if (a === "who") { setWho(whoBox.hidden); return; }
    if (a === "exit" && EMBED) { e.preventDefault(); toShell("exit"); return; }
    if (a === "menu") open === "menu" ? closeWin() : openWin("menu");
    else if (a === "close") closeWin();
    else if (a === "settings") openWin("settings");
    else if (a === "help") openWin("help");
    else if (a === "chat") setChatOpen(chatBox.hidden, chatBox.hidden);
    else if (a === "radio") { if (room === "lounge") openWin("juke"); else { settings.musicInGames = !settings.musicInGames; applySettings(); A.notify(settings.musicInGames ? "Jukebox on in the games" : "Jukebox off in the games", "🎵"); } }
    else if (a === "radiostop") A.radioStop();
  });
  function go(g) {
    if (!g.open) { A.notify(`${g.name} isn't in the arcade yet: opening its mockup.`, g.icon); }
    cb("onLeaving", g); if (EMBED && g.open) return void setTimeout(() => toShell(g.room), 250);
    setTimeout(() => { location.href = g.href + (DEV && new URLSearchParams(location.search).get("as") ? `?as=${encodeURIComponent(new URLSearchParams(location.search).get("as"))}` : ""); }, 250);
  }
  A.go = (r) => go(GAMES.find((g) => g.room === r));
  addEventListener("keydown", (e) => {
    if (A.isTyping()) return;
    if (e.key === "Escape" && !whoBox.hidden) { setWho(false); return; }
    if (e.key === "Escape") { e.preventDefault(); open ? (open === "menu" ? closeWin() : openWin("menu")) : openWin("menu"); }
    else if (e.key === "Enter" && !open) { e.preventDefault(); setChatOpen(true, true); }
    else if (e.code === "KeyM" && !open) { settings.mute = !settings.mute; applySettings(); A.notify(settings.mute ? "Muted" : "Sound on", settings.mute ? "🔇" : "🔊"); }
  });

  /* ------------------------------------------------------------------ the jukebox: playback for everyone, the picker in the lounge */
  const audio = new Audio(); audio.preload = "none"; audio.crossOrigin = "anonymous";
  let audioSrc = "", wantPlay = false;
  function syncRadio() {
    const r = A.radio, np = q(".ak-np");
    np.hidden = !r; if (r) np.innerHTML = `<span class="ak-eq${audio.paused ? " off" : ""}"><i></i><i></i><i></i></span>${esc(r.name)}`;
    const should = r && !settings.mute && (room === "lounge" || settings.musicInGames);
    audio.volume = Math.max(0, Math.min(1, settings.music * settings.master));
    if (!should) { if (!audio.paused) audio.pause(); wantPlay = false; return; }
    if (audioSrc !== r.url) { audioSrc = r.url; audio.src = r.url; }
    if (audio.paused) { wantPlay = true; audio.play().then(() => { wantPlay = false; syncNp(); }).catch(() => {}); }
  }
  const syncNp = () => q(".ak-np .ak-eq")?.classList.toggle("off", audio.paused);
  audio.addEventListener("playing", syncNp); audio.addEventListener("pause", syncNp);
  audio.addEventListener("error", () => { if (A.radio && audio.src) A.notify(`"${esc(A.radio.name)}" won't play in this browser. Pick another at the jukebox.`, "📻", "pink"); });
  addEventListener("pointerdown", () => { if (wantPlay) syncRadio(); }, true);   // a browser won't start sound before you've touched the page
  addEventListener("keydown", () => { if (wantPlay) syncRadio(); }, true);
  addEventListener("pagehide", () => audio.pause());
  let jukeResults = null, jukeBusy = false;
  async function jukeSearch(params) {
    jukeBusy = true; drawJuke();
    const qs = new URLSearchParams({ ...params, limit: "24", hidebroken: "true", is_https: "true", order: "clickcount", reverse: "true" });
    jukeResults = [];
    for (const h of RADIO.hosts) {
      try { const r = await fetch(`https://${h}/json/stations/search?${qs}`, { signal: AbortSignal.timeout(6000) }); if (!r.ok) continue; jukeResults = (await r.json()).filter((s) => /^https:/.test(s.url_resolved || "")); break; } catch {}
    }
    jukeBusy = false; if (open === "juke") drawJuke();
  }
  function drawJuke() {
    const r = A.radio, held = r && r.holdUntil > Date.now() && r.byId !== A.me?.id;
    win.innerHTML = `${head("JUKEBOX")}
      <div class="ak-juke-now">${r ? `<span class="ak-eq${audio.paused ? " off" : ""}"><i></i><i></i><i></i></span><div><b>${esc(r.name)}</b><small>${esc([r.tags, r.country].filter(Boolean).join(" · "))} · picked by ${esc(r.by)}</small></div>${held ? "" : `<button type="button" class="ak-btn sm ghost" data-act="radiostop">Stop</button>`}` : `<div><b>Nothing playing</b><small>Pick a station and the whole arcade hears it.</small></div>`}</div>
      <p class="ak-note">${room !== "lounge" ? "The jukebox is in the lounge." : held ? `${esc(r.by)} picked this one: it's theirs for a few minutes.` : "Free to pick. One change every 20 seconds, and your pick is yours for 3 minutes."} Radio from <a href="https://www.radio-browser.info/" target="_blank" rel="noopener">Radio Browser</a>.</p>
      <div class="ak-opick">${RADIO.genres.map(([n, t]) => `<button type="button" class="ak-chip" data-genre="${esc(t)}">${esc(n)}</button>`).join("")}</div>
      <form class="ak-chatform ak-juke-search"><input class="ak-input" placeholder="Search stations" value="${esc(jukeSearch.last || "")}"><button class="ak-btn sm cyan" type="submit">Search</button></form>
      <div class="ak-juke-list">${jukeBusy ? `<p class="ak-note">Tuning in…</p>` : jukeResults ? (jukeResults.length ? jukeResults.map((s) => `<button type="button" class="ak-station" data-station="${esc(s.stationuuid)}"><b>${esc(s.name.trim().slice(0, 50))}</b><small>${esc([String(s.tags || "").split(",").slice(0, 2).join(", "), s.countrycode].filter(Boolean).join(" · "))}</small><span>▶</span></button>`).join("") : `<p class="ak-note">No stations found.</p>`) : `<p class="ak-note">Choose a genre or search.</p>`}</div>
      <label class="ak-set"><span>Your jukebox volume</span><input type="range" min="0" max="100" value="${Math.round(settings.music * 100)}" data-set="music" data-scale="100"><output>${Math.round(settings.music * 100)}</output></label>`;
    win.querySelector(".ak-juke-search").addEventListener("submit", (e) => { e.preventDefault(); const v = e.target.querySelector("input").value.trim(); jukeSearch.last = v; if (v) jukeSearch({ name: v }); });
  }
  A.radioSet = (id) => { if (!A.online) return A.notify(A.guest ? "Log in with Twitch to pick a station." : "The jukebox needs the room server (offline).", "📻", "pink"); send({ t: "radio", op: "set", id }); };
  A.radioStop = () => A.online && send({ t: "radio", op: "stop" });

  /* ------------------------------------------------------------------ the connection */
  let ws = null, lastPos = 0, retry = 0, replaced = false;
  const send = (o) => { if (ws?.readyState === 1) ws.send(JSON.stringify(o)); };
  A.sendPos = (x, y, z, f, a) => { const now = performance.now(); if (!A.online || now - lastPos < NET.sendMs) return; lastPos = now; send({ t: "pos", x, y, z, f, a }); };
  let where = opts.where || "";
  A.setWhere = (w) => { w = String(w).slice(0, NET.where); if (w === where) return; where = w; send({ t: "where", where: w }); };
  A.setLook = (l) => { A.look = cleanLook(l, A.unlocks.concat(A.online ? [] : HATS.filter((h) => !h.free && opts.localUnlocks?.includes(h.key)).map((h) => h.key))); store.set("ecPlayer", A.look); send({ t: "look", ...A.look }); cb("onLook", A.me?.id || "me", A.look, true); };
  A.say = (text) => send({ t: "chat", text });
  A.send = (o) => { if (A.online) send(o); };   // a game's own messages to the room server

  async function connect() {
    let url;
    if (DEV) {
      const as = new URLSearchParams(location.search).get("as") || "bootypaper";
      url = `ws://${location.hostname}:8788/ws?dev=1&login=${encodeURIComponent(as)}`;
      A.me = A.me || { id: "dev:" + as, login: as, name: as, avatar: null };
    } else {
      try {
        const r = await fetch("/api/arcade/ticket", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
        if (r.status === 401) { A.guest = true; drawMe(); return offline("guest"); }
        const j = await r.json(); if (!j.ok) return offline("down");
        A.me = { id: null, login: j.login, name: j.name, avatar: j.avatar }; url = `${j.ws}?ticket=${j.ticket}`;
      } catch { return offline("down"); }
    }
    try { ws = new WebSocket(url); } catch { return offline("down"); }
    let opened = false;
    ws.onopen = () => { opened = true; retry = 0; send({ t: "hi", room, where, look: A.look }); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
    ws.onclose = (e) => {
      const was = A.online; A.online = false; drawMe();
      if (e.code === 4000) { replaced = true; return A.notify("You opened the arcade in another tab.", "🕹️", "pink"); }
      if (!opened && !was) return offline("down");
      if (was) { A.notify("Lost the connection. Reconnecting…", "📡", "pink"); cb("onDisconnect"); }
      if (!replaced) setTimeout(connect, Math.min(15000, 1500 * 2 ** retry++));
    };
  }
  function offline(why) {
    A.online = false; drawMe();
    if (!offline.told) { offline.told = true; cb("onOffline", why); if (why !== "guest") addChat({ sys: true, text: DEV ? "Offline: the room server isn't running (cd arcade-worker && npx wrangler dev --port 8788 --var DEV:1). Bots stand in." : "The arcade's room server is offline. Bots stand in." }); else addChat({ sys: true, text: "Log in with Twitch to join the room and chat." }); }
  }
  function onMsg(m) {
    switch (m.t) {
      case "hello": {
        A.online = true; A.hello = m; A.me = m.you; A.unlocks = m.unlocks || []; A.look = m.look; store.set("ecPlayer", A.look);
        A.people.clear(); for (const p of m.people) A.people.set(p.id, p);
        chatLog.innerHTML = ""; lines.length = 0; for (const c of m.chat || []) addChat(c); unreadN = 0; unread.hidden = true;
        A.radio = m.radio; syncRadio(); drawMe(); drawWho(); cb("onHello", A); cb("onLook", A.me.id, A.look, true); return;
      }
      case "join": A.people.set(m.p.id, m.p); drawWho(); cb("onJoin", m.p); if (m.p.room === room) addChat({ sys: true, text: `${m.p.name} walked in` }); return;
      case "leave": { const p = A.people.get(m.id); A.people.delete(m.id); drawWho(); cb("onLeave", m.id, p); return; }
      case "pos": for (const [id, x, y, z, f, a] of m.list) { const p = A.people.get(id); if (p) { p.pos = [x, y, z, f, a]; cb("onPos", id, p.pos); } } return;
      case "room": { const p = A.people.get(m.id); if (!p) return; const was = p.room; p.room = m.room; p.where = m.where; drawWho(); cb("onRoom", p, was); return; }
      case "look": { if (A.me && m.id === A.me.id) { A.look = m.look; store.set("ecPlayer", A.look); } else { const p = A.people.get(m.id); if (p) p.look = m.look; } cb("onLook", m.id, m.look, A.me && m.id === A.me.id); return; }
      case "chat": addChat(m.m); cb("onChat", m.m); return;
      case "radio": { const before = A.radio?.id; A.radio = m.radio; syncRadio(); if (m.radio && m.radio.id !== before) A.notify(`<b>${esc(m.radio.by)}</b> put on ${esc(m.radio.name)}`, "📻", "lime"); else if (!m.radio && before) A.notify(`${esc(m.by || "Someone")} stopped the jukebox`, "📻"); if (open === "juke") drawJuke(); return; }
      case "err": A.notify(esc(m.text), "⚠️", "pink"); return;
      default: cb("onMessage", m);   // a game's own messages (the lounge's air hockey: hk, hkf)
    }
  }
  /* TOUCH (2026-10-07, the owner: "add touch controls"). One kit for every game: a thumbstick bottom left, big round buttons bottom right,
     and the game's own drag-to-look on the rest of the screen. A game passes { state, buttons }: the stick writes state.x / state.y
     (-1..1, y negative = forward, the way the games' keys already read), a held button sets state[id] true, and a button with `tap`
     calls it once per press. Shown on a touch screen (coarse pointer), or the first time anything is touched. */
  if (opts.touch) {
    const T = opts.touch, st = T.state;
    const pad = document.createElement("div"); pad.className = "ak-touch";
    pad.innerHTML = `<div class="ak-stick"><i></i></div><div class="ak-tbtns">${T.buttons.map((b) => `<button type="button" class="ak-tbtn ${b.cls || ""}" data-tb="${b.id}">${esc(b.label)}</button>`).join("")}</div>`;
    hud.append(pad);
    const show = () => { stage.classList.add("ak-touching"); };
    if (matchMedia("(pointer: coarse)").matches) show();
    addEventListener("touchstart", show, { once: true, passive: true });
    const stick = pad.querySelector(".ak-stick"), knob = stick.querySelector("i");
    let sid = null, cx = 0, cy = 0;
    const R = 46;
    stick.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); sid = e.pointerId; try { stick.setPointerCapture(sid); } catch {} const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
    const move = (e) => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`; st.x = dx / R; st.y = dy / R;
    };
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; st.x = 0; st.y = 0; knob.style.transform = ""; };
    stick.addEventListener("pointermove", move); stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
    for (const el of pad.querySelectorAll("[data-tb]")) {
      const b = T.buttons.find((x) => x.id === el.dataset.tb);
      el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch {} el.classList.add("on"); st[b.id] = true; b.tap?.(); });
      const up = () => { el.classList.remove("on"); st[b.id] = false; };
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }

  /* THE FPS COUNTER (2026-10-07, the owner: "add a fps counter so i can see how much fps this is getting"). Counts the browser's frames
     (the game draws on every one), shows frames per second, the slowest frame in the last half second, and whatever the game adds with
     A.fpsNote() (the lounge: its quality level and lights). Switch: Settings → Graphics → Show FPS. */
  {
    const el = q(".ak-fps"); let n = 0, from = performance.now(), prev = from, worst = 0, note = "";
    A.fpsNote = (t) => { note = t; };
    const tick = (now) => {
      n++; worst = Math.max(worst, now - prev); prev = now;
      if (now - from >= 500) {
        const fps = Math.round((n * 1000) / (now - from)), col = fps >= 50 ? "var(--ak-lime)" : fps >= 30 ? "var(--ak-yellow)" : "var(--ak-red)";
        el.hidden = !settings.showFps;
        if (settings.showFps) el.innerHTML = `<b style="color:${col}">${fps}</b> FPS · worst ${Math.round(worst)} ms${note ? ` · ${esc(note)}` : ""}`;
        n = 0; from = now; worst = 0;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  connect();
  return A;
}

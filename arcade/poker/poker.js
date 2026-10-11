/* EastCoin Poker — the page (2026-10-10; the backroom kit and the polish pass 2026-10-13). A view of the table the server deals: it draws
   what the server says (top down, you at the bottom), sends what you want to do, and never decides anything. Rules shared with the
   server: /v3/assets/js/poker-rules.js. What moves: cards fly out at the deal, bets sweep into the pot at the end of a street, the pot
   slides to whoever won it, the winning five light up, the clock ticks in its last five seconds. */
import { TABLE, rankOf, suitOf, RANKS, RANK_NAMES, handName, evalBest } from "/v3/assets/js/poker-rules.js?v=9";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const KIT = { bg: "#0f1413", panel: "#141b19", panel2: "#1a2321", rail: "#2a211c", rail2: "#1b1512", felt: "#0e5c58", felt2: "#0a4542", chalk: "#f1ece2", ink: "#dfe6e2", mute: "#8f9c98", copper: "#c9772f", copper2: "#e39a56", win: "#7fd1a9", bad: "#d9534f", cardInk: "#1b1f1e", cardRed: "#c4453b", back: "#1f3b3a" };
const DISP = "'Instrument Serif', Georgia, serif", SANS = "'Instrument Sans', system-ui, sans-serif", CARD = "'Playfair Display', 'Times New Roman', serif";   // the card face: a traditional heavy roman, easy to read small (the owner, 2026-10-13)
try { document.fonts?.load("900 40px 'Playfair Display'"); document.fonts?.load("400 20px 'Instrument Serif'"); } catch {}
const SUIT_GLYPH = ["♠", "♥", "♦", "♣"], SUIT_RED = [false, true, true, false];
const cv = $("cv"), g = cv.getContext("2d"); const W = cv.width, H = cv.height;
let you = null, bank = 0, view = null, people = [], ws = null, lastView = null, seenBoard = 0, boardAt = 0, showAt = 0, flash = { seat: -1, at: 0 };
let lastAct = {}, anims = [], dealing = {}, winSet = null, lastTick = -1, turnAt = 0;
let parts = [], glow = { seat: -1, until: 0, color: "#7fd1a9" }, streak = { name: "", n: 0 }, turnFlashT = 0;
/** YOUR TURN: the words flash over your seat and the plate glows while the action is on you. */
function showTurn() { const el = $("turnFlash"); if (!view || view.me < 0) return; const p = seatPos(view.me); const rect = cv.getBoundingClientRect(), st = $("stage").getBoundingClientRect(); el.style.left = `${rect.left - st.left + p.x * rect.width / W}px`; el.style.top = `${rect.top - st.top + (p.y - 150) * rect.height / H}px`; el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); clearTimeout(turnFlashT); turnFlashT = setTimeout(() => { el.hidden = true; }, 2500); }
function burst(x, y, n = 60) { const cols = ["#e39a56", "#f1ece2", "#7fd1a9", "#c9772f", "#0e5c58"]; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 1.2 + Math.random() * 0.8, max: 2, w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, c: cols[i % cols.length] }); } }
function drawParts(dt) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += 420 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; g.save(); g.globalAlpha = Math.min(1, p.life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); } }
const turnLeft = () => (view && view.phase === "hand" && view.cur >= 0 ? Math.max(0, TABLE.TURN_MS - (performance.now() - turnAt)) : 0);   // the clock runs on the page between pushes
const avatars = new Map();
/* ---------------------------------------------------------------- settings (localStorage ec_poker_*): sound, four-colour deck, hand label, the dealer's log, animations */
const SET = { vol: 0.7, four: false, hand: true, feed: true, anim: true };
try { const s = JSON.parse(localStorage.getItem("ec_poker_set") || "{}"); Object.assign(SET, s); } catch {}
const saveSet = () => { try { localStorage.setItem("ec_poker_set", JSON.stringify(SET)); } catch {} };
let wait = { list: [], hold: null, free: TABLE.SEATS };
const TEX_V = 1, TEX = {}; for (const n of ["felt", "rail", "card_back", "card_face", "chip_white", "chip_red", "chip_blue", "chip_black", "dealer_button", "pot_tray", "avatar_1", "avatar_2", "avatar_3", "avatar_4", "muck", "sitting_out", "logo_mark"]) { const im = new Image(); im.src = `tex/${n}.webp?v=${TEX_V}`; TEX[n] = im; }
const tex = (n) => (TEX[n] && TEX[n].complete && TEX[n].naturalWidth ? TEX[n] : null); let feltPat = null, railPat = null;
const chipFor = (amount) => (amount >= 100 ? "chip_black" : amount >= 25 ? "chip_blue" : amount >= 5 ? "chip_red" : "chip_white");

/* ---------------------------------------------------------------- sound: small tones, no files yet */
let AC = null; const audioOn = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (AC?.state === "suspended") AC.resume(); };
function tone(f, to, dur, type = "sine", gain = 0.08) { if (!AC || SET.vol <= 0) return; gain *= SET.vol / 0.7; const o = AC.createOscillator(), a = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, AC.currentTime); if (to) o.frequency.exponentialRampToValueAtTime(to, AC.currentTime + dur); a.gain.setValueAtTime(gain, AC.currentTime); a.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(a); a.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur); }
const SFX = { deal: () => tone(1800, 600, 0.06, "triangle", 0.05), chip: () => { tone(2400, 1200, 0.05, "square", 0.04); setTimeout(() => tone(2600, 1300, 0.05, "square", 0.03), 40); }, check: () => tone(180, 120, 0.09, "sine", 0.12), fold: () => tone(500, 200, 0.12, "triangle", 0.05), turn: () => tone(880, 0, 0.1, "sine", 0.07), tick: () => tone(1200, 0, 0.04, "square", 0.03), win: () => { [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0, 0.18, "triangle", 0.07), i * 90)); }, err: () => tone(220, 160, 0.15, "square", 0.05) };
addEventListener("pointerdown", audioOn, { once: true }); addEventListener("keydown", audioOn, { once: true });

/* ---------------------------------------------------------------- the connection */
function status(text) { const el = $("status"); if (!text) { el.hidden = true; return; } el.hidden = false; el.textContent = text; }
async function connect() {
  let url;
  const PV = "16";   // this page's version, so the dealer knows it is current (older pages are asked to refresh)
  if (DEV) { const as = new URLSearchParams(location.search).get("as") || "you"; url = `ws://${location.hostname}:8788/pk?dev=1&login=${encodeURIComponent(as)}&pv=${PV}`; }
  else {
    try { const r = await fetch("/api/arcade/ticket", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }); const j = await r.json().catch(() => ({}));
      if (!j.ok) { status(""); $("signin").hidden = false; return; } url = `${j.ws.replace(/\/ws$/, "/pk")}?ticket=${j.ticket}&pv=${PV}`; }
    catch { status("The site did not answer. Try again in a moment."); return; }
  }
  status("Finding the table…");
  ws = new WebSocket(url);
  ws.onopen = () => status("");
  ws.onclose = (e) => { status(e.code === 4000 ? "You opened the table somewhere else." : "Lost the table. Reconnecting…"); if (e.code !== 4000) setTimeout(connect, 2500); };
  ws.onerror = () => {};
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
}
const send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function onMsg(m) {
  if (m.t === "hello") { you = m.you; bank = m.bank; people = m.people || []; $("who").textContent = you.name; $("btnBot").hidden = !you.admin; $("btnBotOff").hidden = !you.admin; $("btnReset").hidden = !you.admin; if (m.wait) { wait = m.wait; } drawWait(); $("chat").innerHTML = ""; for (const c of m.chat || []) chatLine(c); $("hands").innerHTML = ""; for (const h of (m.hands || []).slice().reverse()) handLine(h); setView(m.view); feed(`Welcome, ${esc(you.name)}. ${m.view.seats.filter(Boolean).length} at the table.`, "dim"); peopleLine(); }
  else if (m.t === "view") { bank = m.bank; setView(m.view); }
  else if (m.t === "ev") { for (const e of m.e) onEvent(e); }
  else if (m.t === "hand") { handLine(m.rec); onHand(m.rec); }
  else if (m.t === "chat") chatLine(m.m);
  else if (m.t === "people") { people = m.list; peopleLine(); }
  else if (m.t === "wait") { wait = m; drawWait(); }
  else if (m.t === "err") { feed(esc(m.text), "warm"); SFX.err(); }
}
function peopleLine() { $("peopleN").textContent = `· ${people.length} here`; }
function setView(v) {
  lastView = view; view = v; $("bankN").textContent = bank.toLocaleString(); turnAt = performance.now() - (TABLE.TURN_MS - v.turnLeft);
  const seated = v.seats.filter(Boolean).length; $("tableN").textContent = seated ? `${seated} seated` : "empty";
  const me = v.me >= 0 ? v.seats[v.me] : null;
  $("btnStand").hidden = !me; $("btnSitout").hidden = !me; $("btnAddon").hidden = !me || (v.phase === "hand" && me.inHand) || me.stack >= TABLE.MAX_BUY;
  if (me) $("btnSitout").textContent = me.sitOut ? "I'm back" : "Sit out";
  const now = performance.now();
  // a new hand: the cards fly out; what everyone did last round is wiped
  if (v.phase === "hand" && (!lastView || lastView.handNo !== v.handNo)) { lastAct = {}; winSet = null; $("banner").hidden = true; let k = 0; for (let i = 0; i < TABLE.SEATS; i++) { const s = v.seats[i]; if (!s || !s.cards.length) continue; const slot = slotOf(i); for (let c = 0; c < 2; c++) { const to = cardPos(i, c); if (SET.anim) anims.push({ kind: "card", from: { x: CX, y: CY - 30 }, to, t0: now + (c * TABLE.SEATS + slot) * 55, dur: 260 }); } dealing[i] = SET.anim ? now + (TABLE.SEATS + slot) * 55 + 260 : 0; k++; } if (k) SFX.deal(); }
  // a new street: last round's actions are over; the bets sweep into the pot
  if (lastView && v.phase === "hand" && lastView.phase === "hand" && v.street !== lastView.street) { for (const k of Object.keys(lastAct)) if (lastAct[k].a !== "fold") delete lastAct[k]; }   // a fold stays on the plate for the hand
  if (lastView) for (let i = 0; i < TABLE.SEATS; i++) { const a = lastView.seats[i], b = v.seats[i]; if (a && b && a.bet > 0 && b.bet === 0 && (v.phase === "hand" || v.phase === "showdown")) anims.push({ kind: "chips", from: betPos(i), to: { x: CX, y: CY - 44 }, t0: now, dur: 320, amount: a.bet }); }
  if (v.board.length !== seenBoard) { if (v.board.length > seenBoard && v.phase === "hand") SFX.deal(); seenBoard = v.board.length; boardAt = now; }
  if (v.phase === "showdown" && (!lastView || lastView.phase !== "showdown")) { showAt = now; const pots = v.last?.result?.pots || []; winSet = pots[0]?.cards ? new Set(pots[0].cards) : null; for (let i = 0; i < TABLE.SEATS; i++) { const s = v.seats[i]; if (s && s.won > 0) anims.push({ kind: "chips", from: { x: CX, y: CY - 44 }, to: { x: seatPos(i).x, y: seatPos(i).y + 18 }, t0: now + 700, dur: 420, amount: s.won }); } }
  if (v.phase !== "showdown" && lastView?.phase === "showdown") { $("banner").hidden = true; winSet = null; }
  if (v.legal && (!lastView || !lastView.legal || lastView.handNo !== v.handNo || lastView.street !== v.street)) { SFX.turn(); raiseTo = 0; lastTick = -1; if (SET.anim) showTurn(); }
  if (v.phase !== "hand" || (lastView && lastView.handNo !== v.handNo)) pre = null;
  if (v.legal && pre) { const L = v.legal; const a = pre === "cf" ? (L.check ? "check" : "fold") : pre === "ck" ? (L.check ? "check" : null) : (L.toCall > 0 ? "call" : "check"); const label = pre === "cf" ? "Check / Fold" : pre === "ck" ? "Check" : "Call any"; pre = null; if (a) { send({ t: "act", a }); feed(`You had <b>${label}</b> set: ${a === "call" ? `called ${L.call}` : a === "check" ? "checked" : "folded"}.`, "dim"); } else feed(`You had <b>Check</b> set, but there is a bet to you.`, "dim"); }
  drawActs(); drawSeatButtons(); drawWait();
}
/** The wait list: shown when the table is full, or whenever there is a line. */
function drawWait() {
  const box = $("waitbox"); if (!view || !you) { box.hidden = true; return; }
  const seated = view.me >= 0; const full = view.seats.every(Boolean); const inLine = wait.list.includes(you.name); const mine = wait.hold && wait.hold.id === you.id;
  box.hidden = seated || (!full && !wait.list.length && !wait.hold);
  $("waitN").textContent = wait.list.length ? `· ${wait.list.length}` : ""; $("waitList").innerHTML = [...(wait.hold ? [`<div class="hold">${esc(wait.hold.name)} · seat held</div>`] : []), ...wait.list.map((n) => `<div class="${n === you.name ? "me" : ""}">${esc(n)}</div>`)].join("") || `<div class="dim">Nobody waiting.</div>`;
  $("btnWait").textContent = inLine ? "Leave the wait list" : "Join the wait list"; $("btnWait").hidden = Boolean(mine);
  const note = $("waitNote"); if (mine) { note.hidden = false; note.textContent = "A seat is yours. Pick one now."; } else if (wait.hold && !full) { note.hidden = false; note.textContent = `${wait.hold.name} is next in line.`; } else note.hidden = true;
  $("seatBtns").hidden = Boolean(wait.hold && !mine);
}
$("btnWait").onclick = () => send({ t: "wait", on: !wait.list.includes(you?.name) });
/* ---------------------------------------------------------------- settings and the jukebox */
const pops = { settings: $("settings"), juke: $("juke"), tv: $("tv") }; function pop(k) { for (const [n, el] of Object.entries(pops)) el.hidden = n === k ? !el.hidden : true; }
$("btnSettings").onclick = () => pop("settings"); $("btnJuke").onclick = () => pop("juke"); $("btnTv").onclick = () => { pop("tv"); if (!$("tv").hidden) tvLoad(); };
/* ---------------------------------------------------------------- the mini player: one stream from the site's own provider list, in a window you can drag; it stays while you play */
let tvApi = null, tvMatches = [], tvOn = null, tvStreams = [];
const TV_KEY = "ec_poker_tv";
function tvScript() { if (tvApi || window.EastcoinStreamedAPI) { tvApi = window.EastcoinStreamedAPI; return Promise.resolve(); } return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/assets/eastcoins-streamed-api.js?v=1"; s.onload = () => { tvApi = window.EastcoinStreamedAPI; res(); }; s.onerror = rej; document.head.append(s); }); }
async function tvLoad() {
  const list = $("tvList"); try { await tvScript(); } catch { list.innerHTML = `<button disabled>The stream list did not load.</button>`; return; }
  if (!tvApi?.getLive) { list.innerHTML = `<button disabled>No stream provider on this site.</button>`; return; }
  try { const unwrap = (r) => (Array.isArray(r) ? r : r?.data) || []; const [live, today] = await Promise.all([tvApi.getLive().catch(() => []), tvApi.getToday().catch(() => [])]); const seen = new Set(); tvMatches = [...unwrap(live).map((m) => ({ ...m, _live: true })), ...unwrap(today)].filter((m) => m && m.id && !seen.has(m.id) && seen.add(m.id)); if (window.ECV3Sports?.withoutCopies) tvMatches = window.ECV3Sports.withoutCopies(tvMatches); } catch { tvMatches = []; }
  tvDraw();
}
function tvDraw() {
  const q = $("tvQ").value.trim().toLowerCase(); const list = $("tvList"); const rows = tvMatches.filter((m) => !q || String(m.title || "").toLowerCase().includes(q) || String(m.category || "").toLowerCase().includes(q)).slice(0, 60);
  list.innerHTML = rows.map((m) => `<button data-id="${esc(m.id)}" class="${tvOn?.id === m.id ? "on" : ""}">${m._live ? "<i>LIVE</i>" : ""}<span>${esc(m.title || "")}</span><small>${esc(String(m.category || "").replace(/-/g, " "))}</small></button>`).join("") || `<button disabled>${tvMatches.length ? "Nothing matches." : "Nothing is on right now."}</button>`;
  for (const b of list.querySelectorAll("button[data-id]")) b.onclick = () => tvPick(tvMatches.find((m) => m.id === b.dataset.id));
}
$("tvQ").oninput = tvDraw;
async function tvPick(m, srv = 0) {
  if (!m) return; tvOn = m; tvDraw(); $("miniTitle").textContent = m.title || "Stream"; $("mini").hidden = false; $("miniSrv").innerHTML = `<option>Loading…</option>`;
  let streams = []; try { const r = await tvApi.getStreams(m); streams = ((Array.isArray(r) ? r : r?.data) || []).filter((s) => s?.embedUrl); } catch {}
  tvStreams = streams; if (!streams.length) { $("miniSrv").innerHTML = `<option>No servers</option>`; $("miniFrame").removeAttribute("src"); return; }
  $("miniSrv").innerHTML = streams.map((s, i) => `<option value="${i}">Server ${i + 1}</option>`).join(""); $("miniSrv").value = String(Math.min(srv, streams.length - 1)); tvPlay();
  try { localStorage.setItem(TV_KEY, JSON.stringify({ id: m.id, srv: Number($("miniSrv").value) })); } catch {}
}
function tvPlay() { const s = tvStreams[Number($("miniSrv").value)]; if (!s) return; $("miniFrame").src = s.embedUrl; try { localStorage.setItem(TV_KEY, JSON.stringify({ id: tvOn?.id, srv: Number($("miniSrv").value) })); } catch {} }
$("miniSrv").onchange = tvPlay; $("miniSize").onclick = () => $("mini").classList.toggle("big"); $("miniOff").onclick = () => { $("mini").hidden = true; $("miniFrame").removeAttribute("src"); tvOn = null; tvDraw(); try { localStorage.removeItem(TV_KEY); } catch {} };
// drag it by its head
{ const head = $("miniHead"), box = $("mini"); let drag = null; head.addEventListener("pointerdown", (e) => { if (e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return; const r = box.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; head.setPointerCapture(e.pointerId); }); head.addEventListener("pointermove", (e) => { if (!drag) return; const r = box.getBoundingClientRect(); box.style.left = `${Math.max(0, Math.min(innerWidth - r.width, e.clientX - drag.dx))}px`; box.style.top = `${Math.max(0, Math.min(innerHeight - r.height, e.clientY - drag.dy))}px`; box.style.right = "auto"; box.style.bottom = "auto"; }); head.addEventListener("pointerup", () => { drag = null; }); }
// the stream you had on last time comes back
try { const last = JSON.parse(localStorage.getItem(TV_KEY) || "null"); if (last?.id) tvLoad().then(() => { const m = tvMatches.find((x) => x.id === last.id); if (m) tvPick(m, last.srv || 0); }); } catch {} for (const b of document.querySelectorAll("[data-close]")) b.onclick = () => { pops[b.dataset.close].hidden = true; };
$("setVol").value = Math.round(SET.vol * 100); $("setFour").checked = SET.four; $("setHand").checked = SET.hand; $("setFeed").checked = SET.feed; $("setAnim").checked = SET.anim;
const applySet = () => { document.querySelector(".panel.feed").style.display = SET.feed ? "" : "none"; };
$("setVol").oninput = () => { SET.vol = Number($("setVol").value) / 100; saveSet(); }; $("setFour").onchange = () => { SET.four = $("setFour").checked; saveSet(); }; $("setHand").onchange = () => { SET.hand = $("setHand").checked; saveSet(); }; $("setFeed").onchange = () => { SET.feed = $("setFeed").checked; saveSet(); applySet(); }; $("setAnim").onchange = () => { SET.anim = $("setAnim").checked; saveSet(); }; applySet();
/* the jukebox: the same open directory the lounge and EastScape use (Radio Browser), the same volume key (es_radio_vol); plays on this page only */
const JUKE = { hosts: ["de1.api.radio-browser.info", "de2.api.radio-browser.info", "fi1.api.radio-browser.info"], genres: [["Classic rock", "classic rock"], ["Hip-hop", "hip hop"], ["80s", "80s"], ["90s", "90s"], ["Country", "country"], ["Lo-fi", "lofi"], ["Dance", "dance"], ["Sports talk", "sports"]] };
const jukeAudio = new Audio(); jukeAudio.crossOrigin = "anonymous"; let jukeOn = null;
try { $("jukeVol").value = Math.round((Number(localStorage.getItem("es_radio_vol") ?? 0.6)) * 100); } catch {} jukeAudio.volume = Number($("jukeVol").value) / 100;
$("jukeVol").oninput = () => { jukeAudio.volume = Number($("jukeVol").value) / 100; try { localStorage.setItem("es_radio_vol", String(jukeAudio.volume)); } catch {} };
$("jukeGenres").innerHTML = JUKE.genres.map(([n, q]) => `<button data-q="${esc(q)}">${esc(n)}</button>`).join(""); for (const b of $("jukeGenres").querySelectorAll("button")) b.onclick = () => { for (const o of $("jukeGenres").querySelectorAll("button")) o.classList.toggle("on", o === b); jukeSearch(b.dataset.q, true); };
$("jukeForm").onsubmit = (e) => { e.preventDefault(); const q = $("jukeQ").value.trim(); if (q) jukeSearch(q, false); };
async function jukeSearch(q, byTag) { const list = $("jukeList"); list.innerHTML = `<button disabled>Looking…</button>`; for (const h of JUKE.hosts) { try { const u = `https://${h}/json/stations/search?${byTag ? "tag" : "name"}=${encodeURIComponent(q)}&limit=24&hidebroken=true&order=clickcount&reverse=true`; const r = await fetch(u, { headers: { "user-agent": "eastcoin-poker/1" } }); const j = await r.json(); list.innerHTML = j.filter((s) => /^https:/.test(s.url_resolved || "")).map((s) => `<button data-url="${esc(s.url_resolved)}" data-name="${esc(s.name)}" class="${jukeOn === s.url_resolved ? "on" : ""}"><span>${esc(s.name)}</span><small>${esc(s.country || "")}</small></button>`).join("") || `<button disabled>Nothing found.</button>`; for (const b of list.querySelectorAll("button[data-url]")) b.onclick = () => jukePlay(b.dataset.url, b.dataset.name); return; } catch {} } list.innerHTML = `<button disabled>The directory is not answering.</button>`; }
function jukePlay(url, name) { jukeOn = url; jukeAudio.src = url; jukeAudio.play().catch(() => { $("jukeNow").textContent = "That station would not play."; }); $("jukeNow").textContent = name; $("btnJuke").classList.add("on"); for (const b of $("jukeList").querySelectorAll("button[data-url]")) b.classList.toggle("on", b.dataset.url === url); }
$("jukeStop").onclick = () => { jukeOn = null; jukeAudio.pause(); jukeAudio.removeAttribute("src"); try { jukeAudio.load(); } catch {} $("jukeNow").textContent = "Nothing playing"; $("btnJuke").classList.remove("on"); for (const b of $("jukeList").querySelectorAll("button[data-url]")) b.classList.remove("on"); };

/* ---------------------------------------------------------------- the dealer's lines, table talk, the last hands */
function feed(html, cls = "") { const p = document.createElement("p"); p.className = cls; p.innerHTML = html; const el = $("feed"); el.append(p); while (el.children.length > 80) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
/* CHANNEL EMOTES IN TABLE TALK (2026-10-13): the same list EastScape's chat uses (/api/eastscape/emotes, the channel's 7TV and BetterTTV
   boiled down by the site once an hour), fetched the first time talk is drawn. A WORD that is exactly an emote's name becomes its
   picture; everything else goes in as a text node, so nothing a player types is ever read as HTML. Lines that arrived before the
   list did are redrawn when it lands. */
let EMO = null; const emoLoad = () => (emoLoad.p ||= fetch("/api/eastscape/emotes").then((r) => r.json()).then((j) => { EMO = new Map((j?.emotes || []).map((e) => [e[0], e])); document.querySelectorAll("#chat span[data-t]").forEach((s) => { const t = s.dataset.t; s.textContent = ""; emoWords(s, t); }); emoGrid(); }).catch(() => { EMO = new Map(); }));
function emoWords(span, text) { if (!EMO?.size) { span.append(text); return; } for (const part of String(text).split(/(\s+)/)) { const e = EMO.get(part); if (!e) { span.append(part); continue; } const im = document.createElement("img"); im.src = e[1]; im.alt = im.title = e[0]; im.className = "emo" + (e[2] ? " wide" : ""); im.loading = "lazy"; span.append(im); } }
function chatLine(c) { emoLoad(); const p = document.createElement("p"); if (c.avatar) { const av = document.createElement("img"); av.className = "av"; av.src = c.avatar; av.alt = ""; p.append(av); } const b = document.createElement("b"); b.textContent = c.name; p.append(b, " "); const span = document.createElement("span"); span.dataset.t = c.text; emoWords(span, c.text); p.append(span); const el = $("chat"); el.append(p); while (el.children.length > 80) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
function emoGrid() { const q = $("emoQ").value.trim().toLowerCase(); const grid = $("emoGrid"); if (!EMO) { grid.innerHTML = "<span class='dim'>Loading the channel's emotes…</span>"; return; } const rows = [...EMO.values()].filter((e) => !q || e[0].toLowerCase().includes(q)).slice(0, 160); grid.innerHTML = rows.map((e) => `<button type="button" data-n="${esc(e[0])}" title="${esc(e[0])}"><img src="${esc(e[1])}" alt="${esc(e[0])}" loading="lazy"></button>`).join("") || "<span class='dim'>Nothing matches.</span>"; for (const b of grid.querySelectorAll("button")) b.onclick = () => { const i = $("chatIn"); i.value = (i.value ? i.value.replace(/\s*$/, " ") : "") + b.dataset.n + " "; i.focus(); }; }
$("emoBtn").onclick = () => { const p = $("emoPick"); p.hidden = !p.hidden; $("emoBtn").classList.toggle("on", !p.hidden); if (!p.hidden) { emoLoad(); emoGrid(); $("emoQ").focus(); } }; $("emoQ").oninput = emoGrid;
const pretty = (cs) => cs.map((c) => c.replace(/s$/, "♠").replace(/h$/, "♥").replace(/d$/, "♦").replace(/c$/, "♣").replace(/^T/, "10")).join(" ");
function handLine(h) { const p = document.createElement("p"); const pots = h.pots.map((p) => `<b>${esc(p.winners.join(" & "))}</b> ${p.amount}${p.hand ? ` · ${esc(p.hand)}` : ""}`).join("; "); p.innerHTML = `<span class="dim">#${h.no}</span> ${pots}${h.board.length ? ` <span class="cards">${pretty(h.board)}</span>` : ""}`; const el = $("hands"); el.prepend(p); while (el.children.length > 12) el.lastChild.remove(); }
function onEvent(e) {
  const nm = (n) => `<b>${esc(n)}</b>`;
  switch (e.k) {
    case "sit": feed(`${nm(e.name)} sits down with ${e.buy}.${e.bot ? " (a test bot)" : ""}`); break;
    case "stand": feed(`${nm(e.name)} leaves with ${e.stack}${e.why === "gone" ? " (connection lost)" : e.why === "nobody here" ? " (nobody here)" : ""}.`, "dim"); break;
    case "leaving": feed(`${nm(e.name)} is leaving after this hand.`, "dim"); break;
    case "deal": feed(`Hand #${e.no}. Button on ${nm(view?.seats[e.button]?.name || "?")}.`, "dim"); break;
    case "act": {
      const v = e.a === "fold" ? "folds" : e.a === "check" ? "checks" : e.a === "call" ? `calls ${e.v}${e.allIn ? " (all in)" : ""}` : e.a === "allin" ? `is ALL IN for ${e.to}` : `raises to ${e.to}`;
      feed(`${nm(e.name)} ${v}.`); if (e.a === "fold") SFX.fold(); else if (e.a === "check") SFX.check(); else SFX.chip();
      if (e.a === "fold" && SET.anim && e.i !== view?.me) { const now = performance.now(); for (let k = 0; k < 2; k++) { const from = cardPos(e.i, k); anims.push({ kind: "toss", from, to: { x: from.x + (k - 0.5) * 30, y: from.y + 22 }, t0: now + k * 40, dur: 420 }); } }
      if (e.a === "allin" || (e.a === "call" && e.allIn)) { const f = $("flash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }
      lastAct[e.i] = { a: e.a === "call" && e.allIn ? "allin" : e.a, n: e.a === "call" ? e.v : e.to, at: performance.now() };
      if (e.a === "allin" || (e.a === "call" && e.allIn) || (e.a === "raise" && e.to >= 40)) flash = { seat: e.i, at: performance.now() }; break; }
    case "timeout": feed(`${nm(e.name)} ran out of time and ${e.did === "check" ? "checks" : "folds"}${e.out ? " — sat out" : ""}.`, "warm"); lastAct[e.i] = { a: e.did, n: 0, at: performance.now(), slow: true }; break;
    case "sitout": feed(`${nm(e.name)} sits out.`, "dim"); break;
    case "back": feed(`${nm(e.name)} is back.`, "dim"); break;
    case "addon": feed(`${nm(e.name)} adds ${e.amt}.`, "dim"); break;
    case "waitjoin": feed(`${nm(e.name)} joins the wait list.`, "dim"); break;
    case "waitleave": feed(`${nm(e.name)} leaves the wait list.`, "dim"); break;
    case "waitup": feed(`A seat is open: it is ${nm(e.name)}'s for thirty seconds.`, "warm"); if (you && e.name === you.name) { SFX.turn(); } break;
    case "waitmiss": feed(`${nm(e.name)} did not take the seat.`, "dim"); break;
    case "show": feed(`${nm(e.name)} shows ${pretty(e.hole)}${e.hand ? ` — ${esc(e.hand)}` : ""}.`, e.name === you?.name ? "dim" : "warm"); break;
    case "reset": feed(`${nm(e.name)} reset the table${e.banks ? " and every bank" : ""}. Sit down to start again.`, "warm"); lastAct = {}; anims = []; $("banner").hidden = true; pre = null; break;
  }
}
function onHand(rec) {
  const me = you && view?.me >= 0 ? view.seats[view.me] : null;
  const won = rec.pots.filter((p) => me && p.winners.includes(me.name)).reduce((n, p) => n + p.amount, 0);
  const first = rec.pots[0];
  const total = rec.pots.reduce((n, p) => n + p.amount, 0);
  if (first && first.winners.length === 1) { streak = streak.name === first.winners[0] ? { name: streak.name, n: streak.n + 1 } : { name: first.winners[0], n: 1 }; } else streak = { name: "", n: 0 };
  if (first) { const b = $("banner"); b.hidden = false; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); b.innerHTML = `<i>${esc(first.winners.join(" & "))}</i> ${first.winners.length > 1 ? "split" : "takes"} ${total}<small>${streak.n >= 3 ? `on a heater · ${streak.n} in a row` : first.hand ? esc(first.hand) : "everyone folded"}</small>`; if (streak.n === 3) feed(`${esc(streak.name)} is on a heater: three in a row.`, "warm"); }
  if (SET.anim && view) for (let i = 0; i < TABLE.SEATS; i++) { const s = view.seats[i]; if (s && first && first.winners.includes(s.name)) { const p = seatPos(i); setTimeout(() => burst(p.x, p.y + 10, total >= 500 ? 110 : 60), 500); glow = { seat: i, until: performance.now() + 4000, color: "#7fd1a9" }; } }
  if (won > 0) SFX.win();
  feed(rec.pots.map((p) => `${p.winners.map((n) => `<b>${esc(n)}</b>`).join(" & ")} ${p.winners.length > 1 ? "split" : "take"}${p.winners.length > 1 ? "" : "s"} ${p.amount}${p.hand ? ` with ${esc(p.hand)}` : ""}.`).join(" "), won > 0 ? "win" : "");
  for (const s of rec.shows) feed(`${esc(s.name)} shows ${pretty(s.hole)} — ${esc(s.hand)}.`, "dim");
}

/* ---------------------------------------------------------------- the action bar and the seat buttons */
let raiseTo = 0, pre = null;   // pre: "cf" (check or fold) | "ca" (call any), armed while waiting
/** Raise sizes land on round numbers: fives to 50, tens to 200, twenty-fives past that — the minimum raise and all in are always allowed as they are. */
function snap(x, L) { if (x >= L.maxTo) return L.maxTo; if (x <= L.minTo) return L.minTo; const step = x <= 200 ? 5 : x <= 1000 ? 10 : 25; const r = Math.round(x / step) * step; return Math.max(L.minTo, Math.min(L.maxTo, r)); }
function fit(text, maxW) { if (g.measureText(text).width <= maxW) return text; let t = text; while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1); return t + "…"; }
function drawActs() {
  const L = view?.legal; const box = $("acts"); const me = view && view.me >= 0 ? view.seats[view.me] : null;
  const waiting = !L && me && view.phase === "hand" && me.inHand && !me.folded && !me.allIn; const mayShow = Boolean(view?.mayShow);
  box.classList.toggle("off", !L && !waiting && !mayShow); $("pre").hidden = !waiting; $("actsMain").hidden = !L; $("showRow").hidden = !mayShow; if (!L) $("raisePop").hidden = true;
  $("preCK").classList.toggle("on", pre === "ck"); $("preCF").classList.toggle("on", pre === "cf"); $("preCA").classList.toggle("on", pre === "ca");
  if (waiting) { const toCall = Math.max(0, view.bet - me.bet); $("preCA").lastChild.textContent = toCall > 0 ? `Call any · ${Math.min(toCall, me.stack)}` : "Call any"; }
  if (!L) return;
  $("aCheck").lastChild.textContent = L.check ? "Check" : `Call ${L.call}${L.allIn ? " · all in" : ""}`;
  const canRaise = L.maxTo > view.bet; $("aRaise").disabled = !canRaise;
  const sl = $("aSlider"); sl.min = L.minTo; sl.max = L.maxTo; if (raiseTo < L.minTo || raiseTo > L.maxTo || !raiseTo) raiseTo = L.minTo; raiseTo = snap(raiseTo, L); sl.value = raiseTo; $("aTo").textContent = raiseTo; $("aRaiseN").textContent = raiseTo;
  $("aRaiseL").textContent = raiseTo >= L.maxTo ? "All in " : (view.bet > 0 ? "Raise " : "Bet "); $("aGoN").textContent = raiseTo; $("aGoL").textContent = raiseTo >= L.maxTo ? "All in" : (view.bet > 0 ? "Raise to" : "Bet");
}
function drawSeatButtons() {
  const box = $("seatBtns"); box.innerHTML = ""; if (!view || view.me >= 0) return;
  const rect = cv.getBoundingClientRect(), st = $("stage").getBoundingClientRect(), sx = rect.width / W, sy = rect.height / H;
  for (let i = 0; i < TABLE.SEATS; i++) { if (view.seats[i]) continue; const p = seatPos(i); const b = document.createElement("button"); b.textContent = "Sit here"; b.style.left = `${rect.left - st.left + p.x * sx}px`; b.style.top = `${rect.top - st.top + (p.y + 18) * sy}px`; b.onclick = () => openBuyin(i); box.append(b); }
}
let buySeat = -1;
function openBuyin(i) { if (!you) return; const max = Math.min(TABLE.MAX_BUY, bank); if (max < TABLE.MIN_BUY) { feed(`You need at least ${TABLE.MIN_BUY} chips in the bank. ${bank < TABLE.MIN_BUY ? "The bank tops you up once an hour." : ""}`, "warm"); return; } buySeat = i; const r = $("buyRange"); r.min = TABLE.MIN_BUY; r.max = max; r.step = 5; r.value = max; $("buyN").textContent = max; $("buyinLine").textContent = `Buy in for ${TABLE.MIN_BUY} to ${max} chips. You have ${bank} in the bank.`; $("buyin").hidden = false; }
$("buyRange").oninput = () => { $("buyN").textContent = $("buyRange").value; };
$("buyGo").onclick = () => { send({ t: "sit", seat: buySeat, buy: Number($("buyRange").value) }); $("buyin").hidden = true; };
$("buyNo").onclick = () => { $("buyin").hidden = true; };
$("btnStand").onclick = () => send({ t: "stand" });
$("btnSitout").onclick = () => { const me = view?.seats[view.me]; if (me) send({ t: "sitout", on: !me.sitOut }); };
$("btnAddon").onclick = () => { const me = view?.seats[view.me]; if (!me) return; const amt = Math.min(TABLE.MAX_BUY - me.stack, bank); if (amt > 0) send({ t: "addon", amt }); };
$("btnHow").onclick = () => { $("how").hidden = false; }; $("howNo").onclick = () => { $("how").hidden = true; };
$("btnBot").onclick = () => send({ t: "bot", n: 1 }); $("btnBotOff").onclick = () => send({ t: "bot", n: 0 });
$("aShow").onclick = () => send({ t: "show" });
$("btnReset").onclick = () => { $("resetBox").hidden = false; }; $("resetNo").onclick = () => { $("resetBox").hidden = true; }; $("resetGo").onclick = () => { send({ t: "reset", banks: $("resetBanks").checked }); $("resetBox").hidden = true; };
$("aFold").onclick = () => send({ t: "act", a: "fold" });
$("aCheck").onclick = () => send({ t: "act", a: view?.legal?.check ? "check" : "call" });
const raiseNow = () => { send({ t: "act", a: raiseTo >= (view?.legal?.maxTo || 0) ? "allin" : "raise", to: raiseTo }); $("raisePop").hidden = true; };
$("aRaise").onclick = () => { $("raisePop").hidden = !$("raisePop").hidden; }; $("aGo").onclick = raiseNow;
$("aSlider").oninput = () => { const L = view?.legal; raiseTo = L ? snap(Number($("aSlider").value), L) : Number($("aSlider").value); $("aTo").textContent = raiseTo; $("aRaiseN").textContent = raiseTo; drawActs(); };
$("preCF").onclick = () => { pre = pre === "cf" ? null : "cf"; drawActs(); }; $("preCA").onclick = () => { pre = pre === "ca" ? null : "ca"; drawActs(); }; $("preCK").onclick = () => { pre = pre === "ck" ? null : "ck"; drawActs(); };
for (const b of document.querySelectorAll("[data-size]")) b.onclick = () => { const L = view?.legal; if (!L) return; const pot = L.pot + L.toCall; const k = b.dataset.size; raiseTo = k === "min" ? L.minTo : k === "half" ? Math.round(view.bet + L.toCall + pot / 2) : k === "pot" ? Math.round(view.bet + L.toCall + pot) : L.maxTo; raiseTo = snap(raiseTo, L); drawActs(); };
$("chatForm").onsubmit = (e) => { e.preventDefault(); const t = $("chatIn").value.trim(); if (t) send({ t: "chat", text: t }); $("chatIn").value = ""; $("emoPick").hidden = true; $("emoBtn").classList.remove("on"); };
addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT") return; if (!view?.legal) return; if (e.code === "KeyF") $("aFold").click(); if (e.code === "KeyC") $("aCheck").click(); if (e.code === "KeyR") { if ($("raisePop").hidden) $("aRaise").click(); else raiseNow(); } if (e.code === "Escape") $("raisePop").hidden = true; });
addEventListener("resize", drawSeatButtons);

/* ---------------------------------------------------------------- the table, top down */
const CX = W / 2, CY = H / 2 - 34, RX = 470, RY = 248;
function slotOf(i) { return view && view.me >= 0 ? (i - view.me + TABLE.SEATS) % TABLE.SEATS : i; }
function seatPos(i) { const slot = slotOf(i); const a = Math.PI / 2 + slot * (Math.PI * 2 / TABLE.SEATS); return { x: CX + Math.cos(a) * (RX + 98), y: CY + Math.sin(a) * (RY + 96), a }; }
function betPos(i) { const slot = slotOf(i); const a = Math.PI / 2 + slot * (Math.PI * 2 / TABLE.SEATS); return { x: CX + Math.cos(a) * (RX - 112), y: CY + Math.sin(a) * (RY - 86) }; }
function cardPos(i, k) { const p = seatPos(i), big = i === view?.me; if (big) return { x: p.x + (k - 0.5) * 46, y: p.y - 78 }; const left = p.x < CX; return { x: p.x + (left ? 1 : -1) * (46 + k * 16), y: p.y - 26 }; }
function avatar(url) { if (!url) return null; let im = avatars.get(url); if (!im) { im = new Image(); im.crossOrigin = "anonymous"; im.src = url; avatars.set(url, im); } return im.complete && im.naturalWidth ? im : null; }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const ease = (t) => 1 - Math.pow(1 - t, 3);
function drawCard(c, x, y, w, h, faceUp, dim = false, lit = false, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 12; g.shadowOffsetY = 5;
  rr(-w / 2, -h / 2, w, h, 5); g.fillStyle = faceUp ? KIT.chalk : KIT.back; g.fill(); g.shadowColor = "transparent";
  const art = tex(faceUp ? "card_face" : "card_back"); if (art) { g.save(); rr(-w / 2, -h / 2, w, h, 5); g.clip(); g.drawImage(art, -w / 2, -h / 2, w, h); g.restore(); }
  if (!faceUp) { rr(-w / 2 + 0.75, -h / 2 + 0.75, w - 1.5, h - 1.5, 4.5); g.strokeStyle = KIT.chalk; g.lineWidth = 1.5; g.stroke(); }   /* the back's teal is the felt's: without an edge it reads as glass */
  if (!faceUp && !art) { rr(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 3); g.strokeStyle = "rgba(227,154,86,.7)"; g.lineWidth = 1.5; g.stroke(); g.fillStyle = "rgba(227,154,86,.22)"; for (let yy = -h / 2 + 11; yy < h / 2 - 9; yy += 9) for (let xx = -w / 2 + 11; xx < w / 2 - 9; xx += 9) { g.beginPath(); g.moveTo(xx, yy - 3); g.lineTo(xx + 3, yy); g.lineTo(xx, yy + 3); g.lineTo(xx - 3, yy); g.fill(); } }
  else if (faceUp) { const r = rankOf(c), s = suitOf(c); const ten = RANKS[r] === "T"; g.fillStyle = SET.four ? ["#1b1f1e", "#c4453b", "#2d5f8a", "#2e7d4f"][s] : (SUIT_RED[s] ? KIT.cardRed : KIT.cardInk); g.font = `900 ${Math.round(h * (ten ? 0.3 : 0.38))}px ${CARD}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(ten ? "10" : RANKS[r], -w / 2 + 5, -h / 2 + 2); g.font = `${Math.round(h * 0.26)}px serif`; g.fillText(SUIT_GLYPH[s], -w / 2 + 6, -h / 2 + 2 + h * 0.36); g.font = `${Math.round(h * 0.5)}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(SUIT_GLYPH[s], w * 0.16, h * 0.22); }
  if (lit) { rr(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 6); g.strokeStyle = KIT.copper2; g.lineWidth = 3; g.stroke(); }
  if (dim) { rr(-w / 2, -h / 2, w, h, 5); g.fillStyle = "rgba(15,20,19,.6)"; g.fill(); }
  g.restore();
}
function chipStack(x, y, amount, label = true) {
  if (amount <= 0) return; const n = Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, amount)))); const col = amount >= 100 ? "#1b1f1e" : amount >= 25 ? "#2d5f8a" : amount >= 5 ? "#a63a31" : "#e9e2d4";
  const art = tex(chipFor(amount));
  if (art) { for (let i = 0; i < n; i++) { g.save(); g.translate(x, y - i * 3.4); g.scale(1, 0.62); g.drawImage(art, -15, -15, 30, 30); g.restore(); } }
  else for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(x, y - i * 3.2, 14, 9, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(241,236,226,.6)"; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.ellipse(x, y - i * 3.2, 9, 5.5, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(227,154,86,.5)"; g.stroke(); }
  if (label) { g.font = `600 12px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; rr(x - 24, y + 12, 48, 18, 3); g.fillStyle = "rgba(15,20,19,.85)"; g.fill(); g.strokeStyle = "rgba(201,119,47,.5)"; g.lineWidth = 1; g.stroke(); g.fillStyle = KIT.chalk; g.fillText(amount, x, y + 21); }
}
function chipIcon(x, y, alpha = 1) { g.save(); g.globalAlpha = alpha; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fillStyle = KIT.copper; g.fill(); g.strokeStyle = KIT.chalk; g.lineWidth = 1.5; g.setLineDash([2.2, 2.2]); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fillStyle = KIT.copper2; g.fill(); g.restore(); }
function tag(x, y, text, color, fill = "rgba(15,20,19,.9)") { g.font = `600 10px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; const w = g.measureText(text).width + 16; rr(x - w / 2, y - 9, w, 18, 3); g.fillStyle = fill; g.fill(); g.strokeStyle = color; g.lineWidth = 1; g.stroke(); g.fillStyle = color; g.fillText(text, x, y + 0.5); }
function draw() {
  requestAnimationFrame(draw); if (document.hidden && !DEV) return;
  const now = performance.now(); g.clearRect(0, 0, W, H);
  // the rail and the felt
  g.save(); g.shadowColor = "rgba(0,0,0,.65)"; g.shadowBlur = 44; g.shadowOffsetY = 18; g.beginPath(); g.ellipse(CX, CY, RX + 40, RY + 40, 0, 0, Math.PI * 2); g.fillStyle = KIT.rail; g.fill(); g.restore();
  g.beginPath(); g.ellipse(CX, CY, RX + 40, RY + 40, 0, 0, Math.PI * 2); const wg = g.createLinearGradient(0, CY - RY, 0, CY + RY); wg.addColorStop(0, "#342a22"); wg.addColorStop(1, "#1b1512"); g.fillStyle = wg; g.fill();
  if (!railPat && tex("rail")) railPat = g.createPattern(tex("rail"), "repeat"); if (railPat) { g.save(); g.beginPath(); g.ellipse(CX, CY, RX + 40, RY + 40, 0, 0, Math.PI * 2); g.clip(); g.fillStyle = railPat; g.globalAlpha = 0.9; g.fillRect(CX - RX - 40, CY - RY - 40, (RX + 40) * 2, (RY + 40) * 2); g.restore(); }
  g.beginPath(); g.ellipse(CX, CY, RX + 22, RY + 22, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(201,119,47,.35)"; g.lineWidth = 1; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]);   // the stitch
  g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); const fg = g.createRadialGradient(CX, CY - 30, 40, CX, CY, RX); fg.addColorStop(0, "#136b66"); fg.addColorStop(1, KIT.felt2); g.fillStyle = fg; g.fill();
  if (!feltPat && tex("felt")) feltPat = g.createPattern(tex("felt"), "repeat"); if (feltPat) { g.save(); g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); g.clip(); g.fillStyle = feltPat; g.fillRect(CX - RX, CY - RY, RX * 2, RY * 2); const vg = g.createRadialGradient(CX, CY - 30, 60, CX, CY, RX); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.42)"); g.fillStyle = vg; g.fillRect(CX - RX, CY - RY, RX * 2, RY * 2); g.restore(); }
  g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(201,119,47,.45)"; g.lineWidth = 2; g.stroke();
  if (tex("logo_mark")) { g.save(); g.globalAlpha = 0.28; g.drawImage(tex("logo_mark"), CX - 300, CY - 140, 600, 300); g.restore(); }
  if (tex("pot_tray")) g.drawImage(tex("pot_tray"), CX - 100, CY - 118, 200, 100);
  g.beginPath(); g.ellipse(CX, CY, RX - 72, RY - 62, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(241,236,226,.1)"; g.lineWidth = 1.5; g.stroke();
  g.font = `italic 400 46px ${DISP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(241,236,226,.07)"; g.fillText("EastCoin", CX, CY + 96);
  if (!view) return;
  const v = view; const me = v.me;
  // the pot and the board
  if (v.pot > 0 || v.phase === "showdown") { g.font = `600 10px ${SANS}`; g.fillStyle = "rgba(241,236,226,.55)"; g.fillText("POT", CX, CY - 90); g.font = `400 30px ${DISP}`; g.fillStyle = KIT.chalk; g.fillText(v.pot.toLocaleString(), CX, CY - 66); if (v.pot > 0 && v.phase === "hand") chipStack(CX + 62, CY - 64, v.pot, false); if (v.pot >= 500 && v.phase === "hand") { g.save(); g.globalAlpha = 0.7 + Math.sin(now / 220) * 0.3; tag(CX, CY - 44, "BIG POT", KIT.copper2); g.restore(); } }
  const cw = 64, ch = 90;
  for (let i = 0; i < 5; i++) { const x = CX + (i - 2) * (cw + 10), y = CY + 10; if (i < v.board.length) { const pop = i >= (lastView?.board.length ?? 0) ? Math.min(1, (now - boardAt) / 200) : 1; const lit = winSet ? winSet.has(v.board[i]) : false, dim = winSet ? !winSet.has(v.board[i]) : false; g.save(); g.translate(x, y); g.scale(0.86 + ease(pop) * 0.14, 0.86 + ease(pop) * 0.14); g.translate(-x, -y); drawCard(v.board[i], x, y, cw, ch, true, dim, lit); g.restore(); } else { rr(x - cw / 2, y - ch / 2, cw, ch, 5); g.strokeStyle = "rgba(241,236,226,.12)"; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); } }
  if (v.phase === "waiting") { g.font = `italic 400 20px ${DISP}`; g.fillStyle = "rgba(241,236,226,.75)"; const n = v.seats.filter((s) => s && !s.sitOut && s.stack > 0).length; g.fillText(n < TABLE.MIN_PLAYERS ? (n === 0 ? "Waiting for players. Take a seat." : "Waiting for one more player…") : "Shuffling up…", CX, CY + 76); }
  // the seats
  for (let i = 0; i < TABLE.SEATS; i++) {
    const s = v.seats[i], p = seatPos(i), isMe = i === me; if (!s) continue;
    const acting = v.phase === "hand" && v.cur === i; const out = !s.inHand || s.folded || s.sitOut; const isBot = String(s.id).startsWith("bot:");
    if (s.inHand && s.folded && !isMe && tex("muck")) { const cp = cardPos(i, 0); g.save(); g.globalAlpha = 0.8; g.drawImage(tex("muck"), cp.x - 24, cp.y - 20, 56, 42); g.restore(); }
    if (s.sitOut && tex("sitting_out")) { const cp = cardPos(i, 0); g.save(); g.globalAlpha = 0.9; g.drawImage(tex("sitting_out"), cp.x - 28, cp.y - 20, 60, 30); g.restore(); }
    if (s.cards.length && !(dealing[i] > now)) { const big = isMe; const w = big ? 74 : 42, h = big ? 104 : 58; for (let k = 0; k < 2; k++) { const faceUp = s.cards[k] >= 0; const cp = cardPos(i, k); const lit = faceUp && winSet && s.won > 0 && winSet.has(s.cards[k]); const dim = s.folded || (faceUp && winSet && s.won > 0 && !winSet.has(s.cards[k])); drawCard(faceUp ? s.cards[k] : 0, cp.x, cp.y, w, h, faceUp, dim, lit, big ? (k - 0.5) * 0.12 : (p.x < CX ? 1 : -1) * (0.1 + k * 0.1)); } }
    // the plate: avatar, name, stack
    const pw = 164, ph = 52; g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 16; g.shadowOffsetY = 7; rr(p.x - pw / 2, p.y - 8, pw, ph, 26); g.fillStyle = out ? "rgba(20,27,25,.86)" : KIT.panel2; g.fill(); g.restore();
    if ((acting && isMe) || (glow.seat === i && now < glow.until)) { const mine = acting && isMe; const k = 0.6 + Math.sin(now / 180) * 0.4; g.save(); g.shadowColor = mine ? KIT.copper2 : glow.color; g.shadowBlur = 18 + k * 16; rr(p.x - pw / 2, p.y - 8, pw, ph, 26); g.strokeStyle = mine ? `rgba(227,154,86,${0.5 + k * 0.5})` : glow.color; g.lineWidth = 3; g.stroke(); g.restore(); }
    rr(p.x - pw / 2, p.y - 8, pw, ph, 26); g.strokeStyle = acting ? KIT.copper2 : isMe ? "rgba(201,119,47,.45)" : "rgba(241,236,226,.12)"; g.lineWidth = acting ? 2 : 1; g.stroke();
    if (acting) { const leftMs = turnLeft(); const left = leftMs / TABLE.TURN_MS; const col = left < 0.25 ? KIT.bad : KIT.copper2; g.save(); rr(p.x - pw / 2, p.y - 8, pw, ph, 26); g.clip(); rr(p.x - pw / 2 + 8, p.y + ph - 14, (pw - 16) * left, 3, 2); g.fillStyle = col; g.fill(); g.restore(); if (isMe && leftMs < 5000) { const sec = Math.ceil(leftMs / 1000); if (sec !== lastTick) { lastTick = sec; SFX.tick(); } } }
    if (flash.seat === i && now - flash.at < 900) { rr(p.x - pw / 2 - 4, p.y - 12, pw + 8, ph + 8, 30); g.strokeStyle = `rgba(227,154,86,${1 - (now - flash.at) / 900})`; g.lineWidth = 3; g.stroke(); }
    const im = avatar(s.avatar) || tex(`avatar_${1 + (i % 4)}`); g.save(); g.beginPath(); g.arc(p.x - pw / 2 + 26, p.y + 18, 21, 0, Math.PI * 2); g.closePath(); g.clip(); if (im) g.drawImage(im, p.x - pw / 2 + 5, p.y - 3, 42, 42); else { g.fillStyle = isMe ? KIT.copper : isBot ? "#3a4a47" : "#2d5f8a"; g.fillRect(p.x - pw / 2 + 8, p.y - 2, 40, 40); g.fillStyle = KIT.chalk; g.font = `400 18px ${DISP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(s.name).slice(0, 2).toUpperCase(), p.x - pw / 2 + 28, p.y + 18); } g.restore();
    g.beginPath(); g.arc(p.x - pw / 2 + 26, p.y + 18, 21, 0, Math.PI * 2); g.strokeStyle = acting ? KIT.copper2 : "rgba(241,236,226,.18)"; g.lineWidth = 2; g.stroke();
    g.textAlign = "left"; g.textBaseline = "middle"; g.font = `600 13px ${SANS}`; g.fillStyle = out ? KIT.mute : KIT.chalk; g.fillText(fit(String(s.name), pw - 56 - 14 - (isBot ? 26 : 0)), p.x - pw / 2 + 56, p.y + 7);
    const allIn = s.stack === 0 && s.inHand && !s.folded; if (!allIn) chipIcon(p.x - pw / 2 + 62, p.y + 30, out ? 0.5 : 1);
    g.font = `400 19px ${DISP}`; g.textAlign = "left"; g.fillStyle = allIn ? KIT.bad : KIT.copper2; g.fillText(allIn ? "ALL IN" : s.stack.toLocaleString(), p.x - pw / 2 + (allIn ? 56 : 72), p.y + 30);
    if (acting) { const secs = Math.ceil(turnLeft() / 1000); g.font = `600 12px ${SANS}`; g.textAlign = "right"; g.fillStyle = secs <= 5 ? KIT.bad : "rgba(241,236,226,.45)"; g.fillText(`0:${String(secs).padStart(2, "0")}`, p.x + pw / 2 - 14, p.y + 30); }
    if (isBot && !s.sitOut) { g.font = `600 9px ${SANS}`; g.fillStyle = KIT.mute; g.textAlign = "right"; g.fillText("BOT", p.x + pw / 2 - 14, p.y + 7); }
    if (s.sitOut) tag(p.x, p.y + ph + 4, "SITTING OUT", KIT.mute);
    else if (s.gone) tag(p.x, p.y + ph + 4, "AWAY", KIT.bad);
    else if (lastAct[i]) { const a = lastAct[i]; const text = a.a === "fold" ? "FOLD" : a.a === "check" ? "CHECK" : a.a === "call" ? `CALL ${a.n}` : a.a === "allin" ? `ALL IN ${a.n}` : `RAISE ${a.n}`; const col = a.a === "fold" ? KIT.mute : a.a === "allin" ? KIT.bad : a.a === "raise" ? KIT.copper2 : KIT.chalk; const age = Math.min(1, (now - a.at) / 160); g.save(); g.globalAlpha = age; tag(p.x, p.y + ph + 4 - (1 - age) * 6, text + (a.slow ? " · SLOW" : ""), col); g.restore(); }
    // the dealer button, this street's bet
    if (v.button === i) { const b = betPos(i); if (tex("dealer_button")) g.drawImage(tex("dealer_button"), b.x + 30, b.y - 30, 28, 28); else { g.beginPath(); g.arc(b.x + 44, b.y - 16, 12, 0, Math.PI * 2); g.fillStyle = KIT.chalk; g.fill(); g.strokeStyle = KIT.copper; g.lineWidth = 2; g.stroke(); g.font = `400 14px ${DISP}`; g.fillStyle = KIT.bg; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("D", b.x + 44, b.y - 16); } }
    if (s.bet > 0) { const b = betPos(i); chipStack(b.x, b.y, s.bet); }
    if (v.phase === "showdown" && s.won > 0) { const t = Math.min(1, Math.max(0, (now - showAt - 900) / 400)); if (t > 0) { g.font = `400 22px ${DISP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = `rgba(127,209,169,${t})`; g.fillText(`+${s.won}`, p.x + pw / 2 + 28, p.y + 18 - t * 4); } }
  }
  // what I have
  if (SET.hand && me >= 0 && v.seats[me]?.cards.length === 2 && v.seats[me].cards[0] >= 0 && !v.seats[me].folded && !(dealing[me] > now)) { const hole = v.seats[me].cards, pr = rankOf(hole[0]) === rankOf(hole[1]) ? RANK_NAMES[rankOf(hole[0])] : null; const best = v.board.length >= 3 ? handName(evalBest([...hole, ...v.board])) : (pr ? `Pair of ${pr === "Six" ? "Sixes" : pr + "s"}` : null); if (best && !lastAct[me]) tag(seatPos(me).x, seatPos(me).y + 56, best.toUpperCase(), KIT.copper2); else if (best) tag(seatPos(me).x, seatPos(me).y + 78, best.toUpperCase(), "rgba(241,236,226,.55)"); }
  // what moves: cards dealt, chips to the pot, the pot to the winner
  for (let k = anims.length - 1; k >= 0; k--) { const a = anims[k]; if (now < a.t0) continue; const t = Math.min(1, (now - a.t0) / a.dur); const e = ease(t); const x = a.from.x + (a.to.x - a.from.x) * e, y = a.from.y + (a.to.y - a.from.y) * e - Math.sin(t * Math.PI) * (a.kind === "card" ? 30 : 18);
    if (a.kind === "card") drawCard(0, x, y, 46, 64, false, false, false, (1 - e) * 0.8); else if (a.kind === "toss") { g.save(); g.globalAlpha = 1 - e; drawCard(0, x, y, 42, 58, false, false, false, e * 1.6); g.restore(); } else chipStack(x, y, a.amount, t > 0.9);
    if (t >= 1) { anims.splice(k, 1); if (a.kind === "chips") SFX.chip(); } }
  drawParts(1 / 60);
}
requestAnimationFrame(draw);
connect();
window.__poker = { get view() { return view; }, send, get you() { return you; } };

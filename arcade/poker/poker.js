/* EastCoin Poker — the page (2026-10-10; the backroom kit and the polish pass 2026-10-13). A view of the table the server deals: it draws
   what the server says (top down, you at the bottom), sends what you want to do, and never decides anything. Rules shared with the
   server: /v3/assets/js/poker-rules.js. What moves: cards fly out at the deal, bets sweep into the pot at the end of a street, the pot
   slides to whoever won it, the winning five light up, the clock ticks in its last five seconds. */
import { TABLE, rankOf, suitOf, RANKS, RANK_NAMES, handName, evalBest } from "/v3/assets/js/poker-rules.js?v=5";

const $ = (id) => document.getElementById(id);
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const KIT = { bg: "#0f1413", panel: "#141b19", panel2: "#1a2321", rail: "#2a211c", rail2: "#1b1512", felt: "#0e5c58", felt2: "#0a4542", chalk: "#f1ece2", ink: "#dfe6e2", mute: "#8f9c98", copper: "#c9772f", copper2: "#e39a56", win: "#7fd1a9", bad: "#d9534f", cardInk: "#1b1f1e", cardRed: "#c4453b", back: "#1f3b3a" };
const DISP = "'Instrument Serif', Georgia, serif", SANS = "'Instrument Sans', system-ui, sans-serif", CARD = "'Playfair Display', 'Times New Roman', serif";   // the card face: a traditional heavy roman, easy to read small (the owner, 2026-10-13)
try { document.fonts?.load("900 40px 'Playfair Display'"); document.fonts?.load("400 20px 'Instrument Serif'"); } catch {}
const SUIT_GLYPH = ["♠", "♥", "♦", "♣"], SUIT_RED = [false, true, true, false];
const cv = $("cv"), g = cv.getContext("2d"); const W = cv.width, H = cv.height;
let you = null, bank = 0, view = null, people = [], ws = null, lastView = null, seenBoard = 0, boardAt = 0, showAt = 0, flash = { seat: -1, at: 0 };
let lastAct = {}, anims = [], dealing = {}, winSet = null, lastTick = -1;
const avatars = new Map();
const TEX_V = 1, TEX = {}; for (const n of ["felt", "rail", "card_back", "card_face", "chip_white", "chip_red", "chip_blue", "chip_black", "dealer_button", "pot_tray"]) { const im = new Image(); im.src = `tex/${n}.webp?v=${TEX_V}`; TEX[n] = im; }
const tex = (n) => (TEX[n] && TEX[n].complete && TEX[n].naturalWidth ? TEX[n] : null); let feltPat = null, railPat = null;
const chipFor = (amount) => (amount >= 100 ? "chip_black" : amount >= 25 ? "chip_blue" : amount >= 5 ? "chip_red" : "chip_white");

/* ---------------------------------------------------------------- sound: small tones, no files yet */
let AC = null; const audioOn = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (AC?.state === "suspended") AC.resume(); };
function tone(f, to, dur, type = "sine", gain = 0.08) { if (!AC) return; const o = AC.createOscillator(), a = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, AC.currentTime); if (to) o.frequency.exponentialRampToValueAtTime(to, AC.currentTime + dur); a.gain.setValueAtTime(gain, AC.currentTime); a.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(a); a.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur); }
const SFX = { deal: () => tone(1800, 600, 0.06, "triangle", 0.05), chip: () => { tone(2400, 1200, 0.05, "square", 0.04); setTimeout(() => tone(2600, 1300, 0.05, "square", 0.03), 40); }, check: () => tone(180, 120, 0.09, "sine", 0.12), fold: () => tone(500, 200, 0.12, "triangle", 0.05), turn: () => tone(880, 0, 0.1, "sine", 0.07), tick: () => tone(1200, 0, 0.04, "square", 0.03), win: () => { [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0, 0.18, "triangle", 0.07), i * 90)); }, err: () => tone(220, 160, 0.15, "square", 0.05) };
addEventListener("pointerdown", audioOn, { once: true }); addEventListener("keydown", audioOn, { once: true });

/* ---------------------------------------------------------------- the connection */
function status(text) { const el = $("status"); if (!text) { el.hidden = true; return; } el.hidden = false; el.textContent = text; }
async function connect() {
  let url;
  if (DEV) { const as = new URLSearchParams(location.search).get("as") || "you"; url = `ws://${location.hostname}:8788/pk?dev=1&login=${encodeURIComponent(as)}`; }
  else {
    try { const r = await fetch("/api/arcade/ticket", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }); const j = await r.json().catch(() => ({}));
      if (!j.ok) { status(""); $("signin").hidden = false; return; } url = `${j.ws.replace(/\/ws$/, "/pk")}?ticket=${j.ticket}`; }
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
  if (m.t === "hello") { you = m.you; bank = m.bank; people = m.people || []; $("who").textContent = you.name; $("btnBot").hidden = !you.admin; $("btnBotOff").hidden = !you.admin; $("chat").innerHTML = ""; for (const c of m.chat || []) chatLine(c); $("hands").innerHTML = ""; for (const h of (m.hands || []).slice().reverse()) handLine(h); setView(m.view); feed(`Welcome, ${esc(you.name)}. ${m.view.seats.filter(Boolean).length} at the table.`, "dim"); peopleLine(); }
  else if (m.t === "view") { bank = m.bank; setView(m.view); }
  else if (m.t === "ev") { for (const e of m.e) onEvent(e); }
  else if (m.t === "hand") { handLine(m.rec); onHand(m.rec); }
  else if (m.t === "chat") chatLine(m.m);
  else if (m.t === "people") { people = m.list; peopleLine(); }
  else if (m.t === "err") { feed(esc(m.text), "warm"); SFX.err(); }
}
function peopleLine() { $("peopleN").textContent = `· ${people.length} here`; }
function setView(v) {
  lastView = view; view = v; $("bankN").textContent = bank.toLocaleString();
  const seated = v.seats.filter(Boolean).length; $("tableN").textContent = seated ? `${seated} seated` : "empty";
  const me = v.me >= 0 ? v.seats[v.me] : null;
  $("btnStand").hidden = !me; $("btnSitout").hidden = !me; $("btnAddon").hidden = !me || (v.phase === "hand" && me.inHand) || me.stack >= TABLE.MAX_BUY;
  if (me) $("btnSitout").textContent = me.sitOut ? "I'm back" : "Sit out";
  const now = performance.now();
  // a new hand: the cards fly out; what everyone did last round is wiped
  if (v.phase === "hand" && (!lastView || lastView.handNo !== v.handNo)) { lastAct = {}; winSet = null; $("banner").hidden = true; let k = 0; for (let i = 0; i < TABLE.SEATS; i++) { const s = v.seats[i]; if (!s || !s.cards.length) continue; const slot = slotOf(i); for (let c = 0; c < 2; c++) { const to = cardPos(i, c); anims.push({ kind: "card", from: { x: CX, y: CY - 30 }, to, t0: now + (c * TABLE.SEATS + slot) * 55, dur: 260 }); } dealing[i] = now + (TABLE.SEATS + slot) * 55 + 260; k++; } if (k) SFX.deal(); }
  // a new street: last round's actions are over; the bets sweep into the pot
  if (lastView && v.phase === "hand" && lastView.phase === "hand" && v.street !== lastView.street) { for (const k of Object.keys(lastAct)) if (lastAct[k].a !== "fold") delete lastAct[k]; }   // a fold stays on the plate for the hand
  if (lastView) for (let i = 0; i < TABLE.SEATS; i++) { const a = lastView.seats[i], b = v.seats[i]; if (a && b && a.bet > 0 && b.bet === 0 && (v.phase === "hand" || v.phase === "showdown")) anims.push({ kind: "chips", from: betPos(i), to: { x: CX, y: CY - 44 }, t0: now, dur: 320, amount: a.bet }); }
  if (v.board.length !== seenBoard) { if (v.board.length > seenBoard && v.phase === "hand") SFX.deal(); seenBoard = v.board.length; boardAt = now; }
  if (v.phase === "showdown" && (!lastView || lastView.phase !== "showdown")) { showAt = now; const pots = v.last?.result?.pots || []; winSet = pots[0]?.cards ? new Set(pots[0].cards) : null; for (let i = 0; i < TABLE.SEATS; i++) { const s = v.seats[i]; if (s && s.won > 0) anims.push({ kind: "chips", from: { x: CX, y: CY - 44 }, to: { x: seatPos(i).x, y: seatPos(i).y + 18 }, t0: now + 700, dur: 420, amount: s.won }); } }
  if (v.phase !== "showdown" && lastView?.phase === "showdown") { $("banner").hidden = true; winSet = null; }
  if (v.legal && (!lastView || !lastView.legal || lastView.handNo !== v.handNo || lastView.street !== v.street)) { SFX.turn(); raiseTo = 0; lastTick = -1; }
  if (v.phase !== "hand" || (lastView && lastView.handNo !== v.handNo)) pre = null;
  if (v.legal && pre) { const L = v.legal; const a = pre === "cf" ? (L.check ? "check" : "fold") : (L.toCall > 0 ? "call" : "check"); pre = null; send({ t: "act", a }); feed(`You had <b>${a === "fold" ? "Check / Fold" : "Call any"}</b> set: ${a === "call" ? `called ${L.call}` : a === "check" ? "checked" : "folded"}.`, "dim"); }
  drawActs(); drawSeatButtons();
}

/* ---------------------------------------------------------------- the dealer's lines, table talk, the last hands */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function feed(html, cls = "") { const p = document.createElement("p"); p.className = cls; p.innerHTML = html; const el = $("feed"); el.append(p); while (el.children.length > 80) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
function chatLine(c) { const p = document.createElement("p"); p.innerHTML = `${c.avatar ? `<img class="av" src="${esc(c.avatar)}" alt="">` : ""}<b>${esc(c.name)}</b> ${esc(c.text)}`; const el = $("chat"); el.append(p); while (el.children.length > 80) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
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
      lastAct[e.i] = { a: e.a === "call" && e.allIn ? "allin" : e.a, n: e.a === "call" ? e.v : e.to, at: performance.now() };
      if (e.a === "allin" || (e.a === "call" && e.allIn) || (e.a === "raise" && e.to >= 40)) flash = { seat: e.i, at: performance.now() }; break; }
    case "timeout": feed(`${nm(e.name)} ran out of time and ${e.did === "check" ? "checks" : "folds"}${e.out ? " — sat out" : ""}.`, "warm"); lastAct[e.i] = { a: e.did, n: 0, at: performance.now(), slow: true }; break;
    case "sitout": feed(`${nm(e.name)} sits out.`, "dim"); break;
    case "back": feed(`${nm(e.name)} is back.`, "dim"); break;
    case "addon": feed(`${nm(e.name)} adds ${e.amt}.`, "dim"); break;
  }
}
function onHand(rec) {
  const me = you && view?.me >= 0 ? view.seats[view.me] : null;
  const won = rec.pots.filter((p) => me && p.winners.includes(me.name)).reduce((n, p) => n + p.amount, 0);
  const first = rec.pots[0];
  if (first) { const b = $("banner"); b.hidden = false; b.innerHTML = `<i>${esc(first.winners.join(" & "))}</i> ${first.winners.length > 1 ? "split" : "takes"} ${rec.pots.reduce((n, p) => n + p.amount, 0)}<small>${first.hand ? esc(first.hand) : "everyone folded"}</small>`; }
  if (won > 0) SFX.win();
  feed(rec.pots.map((p) => `${p.winners.map((n) => `<b>${esc(n)}</b>`).join(" & ")} ${p.winners.length > 1 ? "split" : "take"}${p.winners.length > 1 ? "" : "s"} ${p.amount}${p.hand ? ` with ${esc(p.hand)}` : ""}.`).join(" "), won > 0 ? "win" : "");
  for (const s of rec.shows) feed(`${esc(s.name)} shows ${pretty(s.hole)} — ${esc(s.hand)}.`, "dim");
}

/* ---------------------------------------------------------------- the action bar and the seat buttons */
let raiseTo = 0, pre = null;   // pre: "cf" (check or fold) | "ca" (call any), armed while waiting
/** Raise sizes land on round numbers: fives to 50, tens to 200, twenty-fives past that — the minimum raise and all in are always allowed as they are. */
function snap(x, L) { if (x >= L.maxTo) return L.maxTo; if (x <= L.minTo) return L.minTo; const step = x <= 50 ? 5 : x <= 200 ? 10 : 25; const r = Math.round(x / step) * step; return Math.max(L.minTo, Math.min(L.maxTo, r)); }
function drawActs() {
  const L = view?.legal; const box = $("acts"); const me = view && view.me >= 0 ? view.seats[view.me] : null;
  const waiting = !L && me && view.phase === "hand" && me.inHand && !me.folded && !me.allIn;
  box.classList.toggle("off", !L && !waiting); $("pre").hidden = !waiting; $("actsMain").hidden = !L; $("actsSizes").hidden = !L;
  $("preCF").classList.toggle("on", pre === "cf"); $("preCA").classList.toggle("on", pre === "ca");
  if (waiting) { const toCall = Math.max(0, view.bet - me.bet); $("preCA").textContent = toCall > 0 ? `Call any (${Math.min(toCall, me.stack)} now)` : "Call any"; $("preCF").textContent = toCall > 0 ? "Check / Fold" : "Check / Fold"; }
  if (!L) return;
  $("aCheck").firstChild.textContent = L.check ? "Check" : `Call ${L.call}${L.allIn ? " · all in" : ""}`;
  const canRaise = L.maxTo > view.bet; $("aRaise").disabled = !canRaise;
  const sl = $("aSlider"); sl.min = L.minTo; sl.max = L.maxTo; if (raiseTo < L.minTo || raiseTo > L.maxTo || !raiseTo) raiseTo = L.minTo; raiseTo = snap(raiseTo, L); sl.value = raiseTo; $("aTo").textContent = raiseTo; $("aRaiseN").textContent = raiseTo;
  $("aRaiseL").textContent = raiseTo >= L.maxTo ? "All in " : (view.bet > 0 ? "Raise to " : "Bet ");
}
function drawSeatButtons() {
  const box = $("seatBtns"); box.innerHTML = ""; if (!view || view.me >= 0) return;
  const rect = cv.getBoundingClientRect(), st = $("stage").getBoundingClientRect(), sx = rect.width / W, sy = rect.height / H;
  for (let i = 0; i < TABLE.SEATS; i++) { if (view.seats[i]) continue; const p = seatPos(i); const b = document.createElement("button"); b.textContent = "Sit here"; b.style.left = `${rect.left - st.left + p.x * sx}px`; b.style.top = `${rect.top - st.top + (p.y + 18) * sy}px`; b.onclick = () => openBuyin(i); box.append(b); }
}
let buySeat = -1;
function openBuyin(i) { if (!you) return; const max = Math.min(TABLE.MAX_BUY, bank); if (max < TABLE.MIN_BUY) { feed(`You need at least ${TABLE.MIN_BUY} chips in the bank. ${bank < TABLE.MIN_BUY ? "The bank tops you up once an hour." : ""}`, "warm"); return; } buySeat = i; const r = $("buyRange"); r.min = TABLE.MIN_BUY; r.max = max; r.value = max; $("buyN").textContent = max; $("buyinLine").textContent = `Buy in for ${TABLE.MIN_BUY} to ${max} chips. You have ${bank} in the bank.`; $("buyin").hidden = false; }
$("buyRange").oninput = () => { $("buyN").textContent = $("buyRange").value; };
$("buyGo").onclick = () => { send({ t: "sit", seat: buySeat, buy: Number($("buyRange").value) }); $("buyin").hidden = true; };
$("buyNo").onclick = () => { $("buyin").hidden = true; };
$("btnStand").onclick = () => send({ t: "stand" });
$("btnSitout").onclick = () => { const me = view?.seats[view.me]; if (me) send({ t: "sitout", on: !me.sitOut }); };
$("btnAddon").onclick = () => { const me = view?.seats[view.me]; if (!me) return; const amt = Math.min(TABLE.MAX_BUY - me.stack, bank); if (amt > 0) send({ t: "addon", amt }); };
$("btnHow").onclick = () => { $("how").hidden = false; }; $("howNo").onclick = () => { $("how").hidden = true; };
$("btnBot").onclick = () => send({ t: "bot", n: 1 }); $("btnBotOff").onclick = () => send({ t: "bot", n: 0 });
$("aFold").onclick = () => send({ t: "act", a: "fold" });
$("aCheck").onclick = () => send({ t: "act", a: view?.legal?.check ? "check" : "call" });
$("aRaise").onclick = () => send({ t: "act", a: raiseTo >= (view?.legal?.maxTo || 0) ? "allin" : "raise", to: raiseTo });
$("aSlider").oninput = () => { const L = view?.legal; raiseTo = L ? snap(Number($("aSlider").value), L) : Number($("aSlider").value); $("aTo").textContent = raiseTo; $("aRaiseN").textContent = raiseTo; drawActs(); };
$("preCF").onclick = () => { pre = pre === "cf" ? null : "cf"; drawActs(); }; $("preCA").onclick = () => { pre = pre === "ca" ? null : "ca"; drawActs(); };
for (const b of document.querySelectorAll("[data-size]")) b.onclick = () => { const L = view?.legal; if (!L) return; const pot = L.pot + L.toCall; const k = b.dataset.size; raiseTo = k === "min" ? L.minTo : k === "half" ? Math.round(view.bet + L.toCall + pot / 2) : k === "pot" ? Math.round(view.bet + L.toCall + pot) : L.maxTo; raiseTo = snap(raiseTo, L); drawActs(); };
$("chatForm").onsubmit = (e) => { e.preventDefault(); const t = $("chatIn").value.trim(); if (t) send({ t: "chat", text: t }); $("chatIn").value = ""; };
addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT") return; if (!view?.legal) return; if (e.code === "KeyF") $("aFold").click(); if (e.code === "KeyC") $("aCheck").click(); if (e.code === "KeyR") $("aRaise").click(); });
addEventListener("resize", drawSeatButtons);

/* ---------------------------------------------------------------- the table, top down */
const CX = W / 2, CY = H / 2 - 34, RX = 470, RY = 248;
function slotOf(i) { return view && view.me >= 0 ? (i - view.me + TABLE.SEATS) % TABLE.SEATS : i; }
function seatPos(i) { const slot = slotOf(i); const a = Math.PI / 2 + slot * (Math.PI * 2 / TABLE.SEATS); return { x: CX + Math.cos(a) * (RX + 98), y: CY + Math.sin(a) * (RY + 96), a }; }
function betPos(i) { const slot = slotOf(i); const a = Math.PI / 2 + slot * (Math.PI * 2 / TABLE.SEATS); return { x: CX + Math.cos(a) * (RX - 112), y: CY + Math.sin(a) * (RY - 86) }; }
function cardPos(i, k) { const p = seatPos(i), big = i === view?.me; return { x: p.x + (k - 0.5) * (big ? 46 : 28), y: p.y + (big ? -78 : -50) }; }
function avatar(url) { if (!url) return null; let im = avatars.get(url); if (!im) { im = new Image(); im.crossOrigin = "anonymous"; im.src = url; avatars.set(url, im); } return im.complete && im.naturalWidth ? im : null; }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const ease = (t) => 1 - Math.pow(1 - t, 3);
function drawCard(c, x, y, w, h, faceUp, dim = false, lit = false, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 12; g.shadowOffsetY = 5;
  rr(-w / 2, -h / 2, w, h, 5); g.fillStyle = faceUp ? KIT.chalk : KIT.back; g.fill(); g.shadowColor = "transparent";
  const art = tex(faceUp ? "card_face" : "card_back"); if (art) { g.save(); rr(-w / 2, -h / 2, w, h, 5); g.clip(); g.drawImage(art, -w / 2, -h / 2, w, h); g.restore(); }
  if (!faceUp && !art) { rr(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 3); g.strokeStyle = "rgba(227,154,86,.7)"; g.lineWidth = 1.5; g.stroke(); g.fillStyle = "rgba(227,154,86,.22)"; for (let yy = -h / 2 + 11; yy < h / 2 - 9; yy += 9) for (let xx = -w / 2 + 11; xx < w / 2 - 9; xx += 9) { g.beginPath(); g.moveTo(xx, yy - 3); g.lineTo(xx + 3, yy); g.lineTo(xx, yy + 3); g.lineTo(xx - 3, yy); g.fill(); } }
  else { const r = rankOf(c), s = suitOf(c); const ten = RANKS[r] === "T"; g.fillStyle = SUIT_RED[s] ? KIT.cardRed : KIT.cardInk; g.font = `900 ${Math.round(h * (ten ? 0.3 : 0.38))}px ${CARD}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(ten ? "10" : RANKS[r], -w / 2 + 5, -h / 2 + 2); g.font = `${Math.round(h * 0.26)}px serif`; g.fillText(SUIT_GLYPH[s], -w / 2 + 6, -h / 2 + 2 + h * 0.36); g.font = `${Math.round(h * 0.5)}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(SUIT_GLYPH[s], w * 0.16, h * 0.22); }
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
  if (tex("pot_tray")) g.drawImage(tex("pot_tray"), CX - 100, CY - 118, 200, 100);
  g.beginPath(); g.ellipse(CX, CY, RX - 72, RY - 62, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(241,236,226,.1)"; g.lineWidth = 1.5; g.stroke();
  g.font = `italic 400 46px ${DISP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(241,236,226,.07)"; g.fillText("EastCoin", CX, CY + 96);
  if (!view) return;
  const v = view; const me = v.me;
  // the pot and the board
  if (v.pot > 0 || v.phase === "showdown") { g.font = `600 10px ${SANS}`; g.fillStyle = "rgba(241,236,226,.55)"; g.fillText("POT", CX, CY - 90); g.font = `400 30px ${DISP}`; g.fillStyle = KIT.chalk; g.fillText(v.pot.toLocaleString(), CX, CY - 66); if (v.pot > 0 && v.phase === "hand") chipStack(CX + 62, CY - 64, v.pot, false); }
  const cw = 64, ch = 90;
  for (let i = 0; i < 5; i++) { const x = CX + (i - 2) * (cw + 10), y = CY + 10; if (i < v.board.length) { const pop = i >= (lastView?.board.length ?? 0) ? Math.min(1, (now - boardAt) / 200) : 1; const lit = winSet ? winSet.has(v.board[i]) : false, dim = winSet ? !winSet.has(v.board[i]) : false; g.save(); g.translate(x, y); g.scale(0.86 + ease(pop) * 0.14, 0.86 + ease(pop) * 0.14); g.translate(-x, -y); drawCard(v.board[i], x, y, cw, ch, true, dim, lit); g.restore(); } else { rr(x - cw / 2, y - ch / 2, cw, ch, 5); g.strokeStyle = "rgba(241,236,226,.12)"; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); } }
  if (v.phase === "waiting") { g.font = `italic 400 20px ${DISP}`; g.fillStyle = "rgba(241,236,226,.75)"; const n = v.seats.filter((s) => s && !s.sitOut && s.stack > 0).length; g.fillText(n < TABLE.MIN_PLAYERS ? (n === 0 ? "Waiting for players. Take a seat." : "Waiting for one more player…") : "Shuffling up…", CX, CY + 76); }
  // the seats
  for (let i = 0; i < TABLE.SEATS; i++) {
    const s = v.seats[i], p = seatPos(i), isMe = i === me; if (!s) continue;
    const acting = v.phase === "hand" && v.cur === i; const out = !s.inHand || s.folded || s.sitOut; const isBot = String(s.id).startsWith("bot:");
    if (s.cards.length && !(dealing[i] > now)) { const big = isMe; const w = big ? 74 : 46, h = big ? 104 : 64; for (let k = 0; k < 2; k++) { const faceUp = s.cards[k] >= 0; const cp = cardPos(i, k); const lit = faceUp && winSet && s.won > 0 && winSet.has(s.cards[k]); const dim = s.folded || (faceUp && winSet && s.won > 0 && !winSet.has(s.cards[k])); drawCard(faceUp ? s.cards[k] : 0, cp.x, cp.y, w, h, faceUp, dim, lit, (k - 0.5) * 0.12); } }
    // the plate: avatar, name, stack
    const pw = 158, ph = 56; g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 16; g.shadowOffsetY = 7; rr(p.x - pw / 2, p.y - 10, pw, ph, 6); g.fillStyle = out ? "rgba(20,27,25,.86)" : KIT.panel2; g.fill(); g.restore();
    rr(p.x - pw / 2, p.y - 10, pw, ph, 6); g.strokeStyle = acting ? KIT.copper2 : isMe ? "rgba(201,119,47,.45)" : "rgba(241,236,226,.12)"; g.lineWidth = acting ? 2 : 1; g.stroke();
    if (acting) { const left = v.turnLeft / TABLE.TURN_MS; const col = left < 0.25 ? KIT.bad : KIT.copper2; rr(p.x - pw / 2, p.y + ph - 14, pw * left, 4, 2); g.fillStyle = col; g.fill(); if (isMe && v.turnLeft < 5000) { const sec = Math.ceil(v.turnLeft / 1000); if (sec !== lastTick) { lastTick = sec; SFX.tick(); } } }
    if (flash.seat === i && now - flash.at < 900) { rr(p.x - pw / 2 - 4, p.y - 14, pw + 8, ph + 8, 8); g.strokeStyle = `rgba(227,154,86,${1 - (now - flash.at) / 900})`; g.lineWidth = 3; g.stroke(); }
    const im = avatar(s.avatar); g.save(); rr(p.x - pw / 2 + 8, p.y - 2, 40, 40, 4); g.clip(); if (im) g.drawImage(im, p.x - pw / 2 + 8, p.y - 2, 40, 40); else { g.fillStyle = isMe ? KIT.copper : isBot ? "#3a4a47" : "#2d5f8a"; g.fillRect(p.x - pw / 2 + 8, p.y - 2, 40, 40); g.fillStyle = KIT.chalk; g.font = `400 18px ${DISP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(s.name).slice(0, 2).toUpperCase(), p.x - pw / 2 + 28, p.y + 18); } g.restore();
    g.textAlign = "left"; g.textBaseline = "middle"; g.font = `600 13px ${SANS}`; g.fillStyle = out ? KIT.mute : KIT.chalk; g.fillText(String(s.name).slice(0, 14), p.x - pw / 2 + 56, p.y + 7);
    const allIn = s.stack === 0 && s.inHand && !s.folded; if (!allIn) chipIcon(p.x - pw / 2 + 62, p.y + 30, out ? 0.5 : 1);
    g.font = `400 19px ${DISP}`; g.textAlign = "left"; g.fillStyle = allIn ? KIT.bad : KIT.copper2; g.fillText(allIn ? "ALL IN" : s.stack.toLocaleString(), p.x - pw / 2 + (allIn ? 56 : 72), p.y + 30);
    if (acting) { const secs = Math.ceil(v.turnLeft / 1000); g.font = `600 11px ${SANS}`; g.textAlign = "right"; g.fillStyle = secs <= 5 ? KIT.bad : "rgba(241,236,226,.42)"; g.fillText(`0:${String(secs).padStart(2, "0")}`, p.x + pw / 2 - 8, p.y + 7); }
    if (isBot && !s.sitOut) { g.font = `600 9px ${SANS}`; g.fillStyle = KIT.mute; g.textAlign = "right"; g.fillText("BOT", p.x + pw / 2 - 8, p.y + 32); }
    if (s.sitOut) tag(p.x, p.y + ph + 2, "SITTING OUT", KIT.mute);
    else if (s.gone) tag(p.x, p.y + ph + 2, "AWAY", KIT.bad);
    else if (lastAct[i]) { const a = lastAct[i]; const text = a.a === "fold" ? "FOLD" : a.a === "check" ? "CHECK" : a.a === "call" ? `CALL ${a.n}` : a.a === "allin" ? `ALL IN ${a.n}` : `RAISE ${a.n}`; const col = a.a === "fold" ? KIT.mute : a.a === "allin" ? KIT.bad : a.a === "raise" ? KIT.copper2 : KIT.chalk; const age = Math.min(1, (now - a.at) / 160); g.save(); g.globalAlpha = age; tag(p.x, p.y + ph + 2 - (1 - age) * 6, text + (a.slow ? " · SLOW" : ""), col); g.restore(); }
    // the dealer button, this street's bet
    if (v.button === i) { const b = betPos(i); if (tex("dealer_button")) g.drawImage(tex("dealer_button"), b.x + 30, b.y - 30, 28, 28); else { g.beginPath(); g.arc(b.x + 44, b.y - 16, 12, 0, Math.PI * 2); g.fillStyle = KIT.chalk; g.fill(); g.strokeStyle = KIT.copper; g.lineWidth = 2; g.stroke(); g.font = `400 14px ${DISP}`; g.fillStyle = KIT.bg; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("D", b.x + 44, b.y - 16); } }
    if (s.bet > 0) { const b = betPos(i); chipStack(b.x, b.y, s.bet); }
    if (v.phase === "showdown" && s.won > 0) { const t = Math.min(1, Math.max(0, (now - showAt - 900) / 400)); if (t > 0) { g.font = `400 22px ${DISP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = `rgba(127,209,169,${t})`; g.fillText(`+${s.won}`, p.x + pw / 2 + 28, p.y + 18 - t * 4); } }
  }
  // what I have
  if (me >= 0 && v.seats[me]?.cards.length === 2 && v.seats[me].cards[0] >= 0 && !v.seats[me].folded && !(dealing[me] > now)) { const hole = v.seats[me].cards, pr = rankOf(hole[0]) === rankOf(hole[1]) ? RANK_NAMES[rankOf(hole[0])] : null; const best = v.board.length >= 3 ? handName(evalBest([...hole, ...v.board])) : (pr ? `Pair of ${pr === "Six" ? "Sixes" : pr + "s"}` : null); if (best && !lastAct[me]) tag(seatPos(me).x, seatPos(me).y + 58, best.toUpperCase(), KIT.copper2); else if (best) { g.font = `600 10px ${SANS}`; g.textAlign = "center"; g.fillStyle = "rgba(241,236,226,.6)"; g.fillText(best.toUpperCase(), seatPos(me).x, seatPos(me).y + 78); } }
  // what moves: cards dealt, chips to the pot, the pot to the winner
  for (let k = anims.length - 1; k >= 0; k--) { const a = anims[k]; if (now < a.t0) continue; const t = Math.min(1, (now - a.t0) / a.dur); const e = ease(t); const x = a.from.x + (a.to.x - a.from.x) * e, y = a.from.y + (a.to.y - a.from.y) * e - Math.sin(t * Math.PI) * (a.kind === "card" ? 30 : 18);
    if (a.kind === "card") drawCard(0, x, y, 46, 64, false, false, false, (1 - e) * 0.8); else chipStack(x, y, a.amount, t > 0.9);
    if (t >= 1) { anims.splice(k, 1); if (a.kind === "chips") SFX.chip(); } }
}
requestAnimationFrame(draw);
connect();
window.__poker = { get view() { return view; }, send, get you() { return you; } };

/* EastCoin Poker — the page (2026-10-10). A view of the table the server deals: it draws what the server says (top down, you at the
   bottom), sends what you want to do, and never decides anything. Rules shared with the server: /v3/assets/js/poker-rules.js. */
import { TABLE, rankOf, suitOf, RANKS, handName, evalBest } from "/v3/assets/js/poker-rules.js?v=2";

const $ = (id) => document.getElementById(id);
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const SUIT_GLYPH = ["♠", "♥", "♦", "♣"], SUIT_RED = [false, true, true, false];
const cv = $("cv"), g = cv.getContext("2d"); const W = cv.width, H = cv.height;
let you = null, bank = 0, view = null, people = [], ws = null, lastView = null, seenBoard = 0, boardAt = 0, showAt = 0, flash = { seat: -1, at: 0 }, errT = 0;
const avatars = new Map();

/* ---------------------------------------------------------------- sound: small tones, no files yet */
let AC = null; const audioOn = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (AC?.state === "suspended") AC.resume(); };
function tone(f, to, dur, type = "sine", gain = 0.08) { if (!AC) return; const o = AC.createOscillator(), a = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, AC.currentTime); if (to) o.frequency.exponentialRampToValueAtTime(to, AC.currentTime + dur); a.gain.setValueAtTime(gain, AC.currentTime); a.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(a); a.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur); }
const SFX = { deal: () => tone(1800, 600, 0.06, "triangle", 0.05), chip: () => { tone(2400, 1200, 0.05, "square", 0.04); setTimeout(() => tone(2600, 1300, 0.05, "square", 0.03), 40); }, check: () => tone(180, 120, 0.09, "sine", 0.12), fold: () => tone(500, 200, 0.12, "triangle", 0.05), turn: () => tone(880, 0, 0.1, "sine", 0.07), win: () => { [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0, 0.18, "triangle", 0.07), i * 90)); }, err: () => tone(220, 160, 0.15, "square", 0.05) };
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
  if (m.t === "hello") { you = m.you; bank = m.bank; people = m.people || []; $("who").textContent = you.name; $("btnBot").hidden = !you.admin; $("btnBotOff").hidden = !you.admin; $("chat").innerHTML = ""; for (const c of m.chat || []) chatLine(c); $("hands").innerHTML = ""; for (const h of (m.hands || []).slice().reverse()) handLine(h); setView(m.view); feed(`Welcome, ${esc(you.name)}. ${m.view.seats.filter(Boolean).length} at the table.`, "dim"); }
  else if (m.t === "view") { bank = m.bank; setView(m.view); }
  else if (m.t === "ev") { for (const e of m.e) onEvent(e); }
  else if (m.t === "hand") { handLine(m.rec); onHand(m.rec); }
  else if (m.t === "chat") chatLine(m.m);
  else if (m.t === "people") { people = m.list; $("peopleN").textContent = `· ${people.length} here`; }
  else if (m.t === "err") { feed(esc(m.text), "gold"); SFX.err(); }
}
function setView(v) {
  lastView = view; view = v; $("bankN").textContent = bank.toLocaleString();
  const me = v.me >= 0 ? v.seats[v.me] : null;
  $("btnStand").hidden = !me; $("btnSitout").hidden = !me; $("btnAddon").hidden = !me || (v.phase === "hand" && me.inHand) || me.stack >= TABLE.MAX_BUY;
  if (me) $("btnSitout").textContent = me.sitOut ? "I'm back" : "Sit out";
  if (v.board.length !== seenBoard) { if (v.board.length > seenBoard && v.phase === "hand") SFX.deal(); seenBoard = v.board.length; boardAt = performance.now(); }
  if (v.phase === "showdown" && (!lastView || lastView.phase !== "showdown")) showAt = performance.now();
  if (v.phase !== "showdown" && lastView?.phase === "showdown") { $("banner").hidden = true; }
  if (v.legal && (!lastView || !lastView.legal || lastView.handNo !== v.handNo || lastView.street !== v.street)) { SFX.turn(); raiseTo = 0; }   // a fresh decision starts the slider at the minimum
  drawActs(); drawSeatButtons();
}

/* ---------------------------------------------------------------- the dealer's lines and the chat */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function feed(html, cls = "") { const p = document.createElement("p"); p.className = cls; p.innerHTML = html; const el = $("feed"); el.append(p); while (el.children.length > 60) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
function chatLine(c) { const p = document.createElement("p"); p.innerHTML = `${c.avatar ? `<img class="av" src="${esc(c.avatar)}" alt="">` : ""}<b>${esc(c.name)}</b> ${esc(c.text)}`; const el = $("chat"); el.append(p); while (el.children.length > 80) el.firstChild.remove(); el.scrollTop = el.scrollHeight; }
function handLine(h) { const p = document.createElement("p"); const pots = h.pots.map((p) => `<b>${esc(p.winners.join(" & "))}</b> ${p.amount}${p.hand ? ` · ${esc(p.hand)}` : ""}`).join("; "); p.innerHTML = `<span class="dim">#${h.no}</span> ${pots}${h.board.length ? ` <span class="dim">${h.board.join(" ")}</span>` : ""}`; const el = $("hands"); el.prepend(p); while (el.children.length > 12) el.lastChild.remove(); }
function onEvent(e) {
  const nm = (n) => `<b>${esc(n)}</b>`;
  switch (e.k) {
    case "sit": feed(`${nm(e.name)} sits down with ${e.buy}.${e.bot ? " (a test bot)" : ""}`); break;
    case "stand": feed(`${nm(e.name)} leaves with ${e.stack}${e.why === "gone" ? " (connection lost)" : ""}.`, "dim"); break;
    case "leaving": feed(`${nm(e.name)} is leaving after this hand.`, "dim"); break;
    case "deal": feed(`Hand #${e.no}. Button on ${nm(view?.seats[e.button]?.name || "?")}.`, "dim"); SFX.deal(); break;
    case "act": { const v = e.a === "fold" ? "folds" : e.a === "check" ? "checks" : e.a === "call" ? `calls ${e.v}${e.allIn ? " (all in)" : ""}` : e.a === "allin" ? `is ALL IN for ${e.to}` : `raises to ${e.to}`; feed(`${nm(e.name)} ${v}.`); if (e.a === "fold") SFX.fold(); else if (e.a === "check") SFX.check(); else SFX.chip(); if (e.a === "allin" || (e.a === "raise" && e.to >= 40)) flash = { seat: e.i, at: performance.now() }; break; }
    case "timeout": feed(`${nm(e.name)} ran out of time and ${e.did === "check" ? "checks" : "folds"}${e.out ? " — sat out" : ""}.`, "gold"); break;
    case "sitout": feed(`${nm(e.name)} sits out.`, "dim"); break;
    case "back": feed(`${nm(e.name)} is back.`, "dim"); break;
    case "addon": feed(`${nm(e.name)} adds ${e.amt}.`, "dim"); break;
  }
}
function onHand(rec) {
  const me = you && view?.me >= 0 ? view.seats[view.me] : null;
  const won = rec.pots.filter((p) => me && p.winners.includes(me.name)).reduce((n, p) => n + p.amount, 0);
  const first = rec.pots[0];
  if (first) { const b = $("banner"); b.hidden = false; b.innerHTML = `${esc(first.winners.join(" & "))} ${first.winners.length > 1 ? "split" : "wins"} ${rec.pots.reduce((n, p) => n + p.amount, 0)}<small>${first.hand ? esc(first.hand) : "everyone folded"}</small>`; }
  if (won > 0) SFX.win();
  feed(rec.pots.map((p) => `${p.winners.map((n) => `<b>${esc(n)}</b>`).join(" & ")} ${p.winners.length > 1 ? "split" : "take"}${p.winners.length > 1 ? "" : "s"} ${p.amount}${p.hand ? ` with ${esc(p.hand)}` : ""}.`).join(" "), won > 0 ? "gold" : "");
  for (const s of rec.shows) feed(`${esc(s.name)} shows ${s.hole.join(" ")} — ${esc(s.hand)}.`, "dim");
}

/* ---------------------------------------------------------------- the action bar and the seat buttons */
let raiseTo = 0;
function drawActs() {
  const L = view?.legal; const box = $("acts"); if (!L) { box.hidden = true; return; } box.hidden = false;
  $("aCheck").textContent = L.check ? "Check" : `Call ${L.call}${L.allIn ? " · all in" : ""}`;
  const canRaise = L.maxTo > view.bet; $("aRaise").disabled = !canRaise;
  const sl = $("aSlider"); sl.min = L.minTo; sl.max = L.maxTo; if (raiseTo < L.minTo || raiseTo > L.maxTo || !raiseTo) raiseTo = L.minTo; sl.value = raiseTo; $("aTo").textContent = raiseTo; $("aRaiseN").textContent = raiseTo;
  $("aRaise").firstChild.textContent = raiseTo >= L.maxTo ? "All in " : (view.bet > 0 ? "Raise to " : "Bet ");
}
function drawSeatButtons() {
  const box = $("seatBtns"); box.innerHTML = ""; if (!view || view.me >= 0) return;
  const rect = cv.getBoundingClientRect(), sx = rect.width / W, sy = rect.height / H;
  for (let i = 0; i < TABLE.SEATS; i++) { if (view.seats[i]) continue; const p = seatPos(i); const b = document.createElement("button"); b.textContent = "Sit here"; b.style.left = `${rect.left - $("stage").getBoundingClientRect().left + p.x * sx}px`; b.style.top = `${rect.top - $("stage").getBoundingClientRect().top + p.y * sy}px`; b.onclick = () => openBuyin(i); box.append(b); }
}
let buySeat = -1;
function openBuyin(i) { if (!you) return; const max = Math.min(TABLE.MAX_BUY, bank); if (max < TABLE.MIN_BUY) { feed(`You need at least ${TABLE.MIN_BUY} chips in the bank. ${bank < TABLE.MIN_BUY ? "The bank tops you up once an hour." : ""}`, "gold"); return; } buySeat = i; const r = $("buyRange"); r.min = TABLE.MIN_BUY; r.max = max; r.value = max; $("buyN").textContent = max; $("buyinLine").textContent = `Buy in for ${TABLE.MIN_BUY} to ${max} chips. You have ${bank} in the bank.`; $("buyin").hidden = false; }
$("buyRange").oninput = () => { $("buyN").textContent = $("buyRange").value; };
$("buyGo").onclick = () => { send({ t: "sit", seat: buySeat, buy: Number($("buyRange").value) }); $("buyin").hidden = true; };
$("buyNo").onclick = () => { $("buyin").hidden = true; };
$("btnStand").onclick = () => send({ t: "stand" });
$("btnSitout").onclick = () => { const me = view?.seats[view.me]; if (me) send({ t: "sitout", on: !me.sitOut }); };
$("btnAddon").onclick = () => { const me = view?.seats[view.me]; if (!me) return; const amt = Math.min(TABLE.MAX_BUY - me.stack, bank); if (amt > 0) send({ t: "addon", amt }); };
$("btnHow").onclick = () => { $("how").hidden = false; };
$("btnBot").onclick = () => send({ t: "bot", n: 1 }); $("btnBotOff").onclick = () => send({ t: "bot", n: 0 }); $("howNo").onclick = () => { $("how").hidden = true; };
$("aFold").onclick = () => send({ t: "act", a: "fold" });
$("aCheck").onclick = () => send({ t: "act", a: view?.legal?.check ? "check" : "call" });
$("aRaise").onclick = () => send({ t: "act", a: raiseTo >= (view?.legal?.maxTo || 0) ? "allin" : "raise", to: raiseTo });
$("aSlider").oninput = () => { raiseTo = Number($("aSlider").value); $("aTo").textContent = raiseTo; $("aRaiseN").textContent = raiseTo; drawActs(); };
for (const b of document.querySelectorAll("[data-size]")) b.onclick = () => { const L = view?.legal; if (!L) return; const pot = L.pot + L.toCall; const k = b.dataset.size; raiseTo = k === "min" ? L.minTo : k === "half" ? Math.round(view.bet + L.toCall + pot / 2) : k === "pot" ? Math.round(view.bet + L.toCall + pot) : L.maxTo; raiseTo = Math.max(L.minTo, Math.min(L.maxTo, raiseTo)); drawActs(); };
$("chatForm").onsubmit = (e) => { e.preventDefault(); const t = $("chatIn").value.trim(); if (t) send({ t: "chat", text: t }); $("chatIn").value = ""; };
addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT") return; if (!view?.legal) return; if (e.code === "KeyF") $("aFold").click(); if (e.code === "KeyC") $("aCheck").click(); if (e.code === "KeyR") $("aRaise").click(); });
addEventListener("resize", drawSeatButtons);

/* ---------------------------------------------------------------- the table, top down */
const CX = W / 2, CY = H / 2 - 30, RX = 470, RY = 250;
/** Seat positions round the oval: display slot 0 is the bottom (you, when seated). */
function slotOf(i) { return view && view.me >= 0 ? (i - view.me + TABLE.SEATS) % TABLE.SEATS : i; }
function seatPos(i) { const slot = slotOf(i); const a = Math.PI / 2 + slot * (Math.PI * 2 / TABLE.SEATS); return { x: CX + Math.cos(a) * (RX + 95), y: CY + Math.sin(a) * (RY + 92), a }; }
function betPos(i) { const slot = slotOf(i); const a = Math.PI / 2 + slot * (Math.PI * 2 / TABLE.SEATS); return { x: CX + Math.cos(a) * (RX - 110), y: CY + Math.sin(a) * (RY - 85) }; }
function avatar(url) { if (!url) return null; let im = avatars.get(url); if (!im) { im = new Image(); im.crossOrigin = "anonymous"; im.src = url; avatars.set(url, im); } return im.complete && im.naturalWidth ? im : null; }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function drawCard(c, x, y, w, h, faceUp, dim = false) {
  g.save(); g.translate(x, y);
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 10; g.shadowOffsetY = 4;
  rr(-w / 2, -h / 2, w, h, w * 0.1); g.fillStyle = faceUp ? "#fbf7ee" : "#8f1d1d"; g.fill(); g.shadowColor = "transparent";
  if (!faceUp) { rr(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, w * 0.07); g.strokeStyle = "rgba(244,239,228,.7)"; g.lineWidth = 2; g.stroke(); g.fillStyle = "rgba(244,239,228,.25)"; for (let yy = -h / 2 + 10; yy < h / 2 - 8; yy += 9) for (let xx = -w / 2 + 10; xx < w / 2 - 8; xx += 9) { g.beginPath(); g.moveTo(xx, yy - 3); g.lineTo(xx + 3, yy); g.lineTo(xx, yy + 3); g.lineTo(xx - 3, yy); g.fill(); } }
  else { const r = rankOf(c), s = suitOf(c); g.fillStyle = SUIT_RED[s] ? "#c0392b" : "#1b1c22"; g.font = `900 ${Math.round(h * 0.3)}px ${"Figtree, sans-serif"}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(RANKS[r] === "T" ? "10" : RANKS[r], -w / 2 + 6, -h / 2 + 4); g.font = `${Math.round(h * 0.24)}px serif`; g.fillText(SUIT_GLYPH[s], -w / 2 + 6, -h / 2 + 4 + h * 0.3); g.font = `${Math.round(h * 0.5)}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(SUIT_GLYPH[s], w * 0.12, h * 0.16); }
  if (dim) { rr(-w / 2, -h / 2, w, h, w * 0.1); g.fillStyle = "rgba(18,13,11,.55)"; g.fill(); }
  g.restore();
}
function chipStack(x, y, amount, label = true) {
  if (amount <= 0) return; const n = Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, amount)))); const col = amount >= 100 ? "#1b1c22" : amount >= 25 ? "#2f7fc6" : amount >= 5 ? "#c0392b" : "#f4efe4";
  for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(x, y - i * 3.2, 14, 9, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(244,239,228,.6)"; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.ellipse(x, y - i * 3.2, 9, 5.5, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,.35)"; g.stroke(); }
  if (label) { g.font = "800 13px Figtree, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#120d0b"; rr(x - 24, y + 12, 48, 18, 9); g.fillStyle = "rgba(244,239,228,.92)"; g.fill(); g.fillStyle = "#120d0b"; g.fillText(amount, x, y + 21); }
}
function draw() {
  requestAnimationFrame(draw); if (document.hidden && !DEV) return;
  const now = performance.now(); g.clearRect(0, 0, W, H);
  // the rail and the felt
  g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 40; g.shadowOffsetY = 16; g.beginPath(); g.ellipse(CX, CY, RX + 38, RY + 38, 0, 0, Math.PI * 2); g.fillStyle = "#3a2416"; g.fill(); g.restore();
  g.beginPath(); g.ellipse(CX, CY, RX + 38, RY + 38, 0, 0, Math.PI * 2); const wg = g.createLinearGradient(0, CY - RY, 0, CY + RY); wg.addColorStop(0, "#4a2f1c"); wg.addColorStop(1, "#2a1810"); g.fillStyle = wg; g.fill();
  g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); const fg = g.createRadialGradient(CX, CY, 40, CX, CY, RX); fg.addColorStop(0, "#237a52"); fg.addColorStop(1, "#15503a"); g.fillStyle = fg; g.fill(); g.strokeStyle = "rgba(232,195,90,.35)"; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.ellipse(CX, CY, RX - 70, RY - 60, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(244,239,228,.12)"; g.lineWidth = 2; g.stroke();
  g.font = "900 44px Fraunces, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(244,239,228,.07)"; g.fillText("EASTCOIN", CX, CY + 95);
  if (!view) return;
  const v = view; const me = v.me;
  // the pot and the board
  const potAll = v.pot; if (potAll > 0 || v.phase === "showdown") { g.font = "800 12px Figtree, sans-serif"; g.fillStyle = "rgba(244,239,228,.7)"; g.fillText("POT", CX, CY - 92); g.font = "900 26px Fraunces, serif"; g.fillStyle = "#f4efe4"; g.fillText(potAll.toLocaleString(), CX, CY - 70); }
  const cw = 64, ch = 90; for (let i = 0; i < 5; i++) { const x = CX + (i - 2) * (cw + 10), y = CY + 8; if (i < v.board.length) { const age = i >= seenBoard - (v.board.length - seenBoard) ? 1 : 1; const pop = i >= (lastView?.board.length ?? 0) ? Math.min(1, (now - boardAt) / 180) : 1; g.save(); g.translate(x, y); g.scale(0.85 + pop * 0.15, 0.85 + pop * 0.15); g.translate(-x, -y); drawCard(v.board[i], x, y, cw, ch, true); g.restore(); } else { rr(x - cw / 2, y - ch / 2, cw, ch, 6); g.strokeStyle = "rgba(244,239,228,.14)"; g.lineWidth = 2; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); } }
  if (v.phase === "waiting") { g.font = "700 15px Figtree, sans-serif"; g.fillStyle = "rgba(244,239,228,.75)"; const n = v.seats.filter((s) => s && !s.sitOut && s.stack > 0).length; g.fillText(n < TABLE.MIN_PLAYERS ? (n === 0 ? "Waiting for players. Take a seat." : "Waiting for one more player…") : "Shuffling up…", CX, CY + 72); }
  // the seats
  for (let i = 0; i < TABLE.SEATS; i++) {
    const s = v.seats[i], p = seatPos(i), isMe = i === me; if (!s) continue;
    const acting = v.phase === "hand" && v.cur === i; const out = !s.inHand || s.folded || s.sitOut;
    // cards first (they sit behind the plate)
    if (s.cards.length) { const big = isMe; const w = big ? 74 : 44, h = big ? 104 : 62; const dy = big ? -74 : -46; for (let k = 0; k < 2; k++) { const faceUp = s.cards[k] >= 0; const ang = (k - 0.5) * 0.14; g.save(); g.translate(p.x + (k - 0.5) * (big ? 44 : 26), p.y + dy); g.rotate(ang); drawCard(faceUp ? s.cards[k] : 0, 0, 0, w, h, faceUp, s.folded); g.restore(); } }
    // the plate: avatar, name, stack
    const pw = 150, ph = 54; g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 14; g.shadowOffsetY = 6; rr(p.x - pw / 2, p.y - 10, pw, ph, 14); g.fillStyle = out ? "rgba(27,21,18,.86)" : "#1b1512"; g.fill(); g.restore();
    if (acting) { const left = v.turnLeft / TABLE.TURN_MS; rr(p.x - pw / 2, p.y - 10, pw, ph, 14); g.strokeStyle = left < 0.25 ? "#c0392b" : "#e8c35a"; g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(p.x - pw / 2 + 27, p.y + 17, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); g.strokeStyle = left < 0.25 ? "#c0392b" : "#e8c35a"; g.lineWidth = 4; g.stroke(); }
    if (flash.seat === i && now - flash.at < 900) { rr(p.x - pw / 2 - 4, p.y - 14, pw + 8, ph + 8, 18); g.strokeStyle = `rgba(232,195,90,${1 - (now - flash.at) / 900})`; g.lineWidth = 3; g.stroke(); }
    const im = avatar(s.avatar); g.save(); g.beginPath(); g.arc(p.x - pw / 2 + 27, p.y + 17, 20, 0, Math.PI * 2); g.closePath(); g.clip(); if (im) g.drawImage(im, p.x - pw / 2 + 7, p.y - 3, 40, 40); else { g.fillStyle = isMe ? "#e8c35a" : "#3b7fbf"; g.fillRect(p.x - pw / 2 + 7, p.y - 3, 40, 40); g.fillStyle = "#120d0b"; g.font = "900 16px Figtree, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(s.name).slice(0, 2).toUpperCase(), p.x - pw / 2 + 27, p.y + 17); } g.restore();
    g.textAlign = "left"; g.textBaseline = "middle"; g.font = "800 14px Figtree, sans-serif"; g.fillStyle = out ? "#a79e8f" : "#f4efe4"; g.fillText(String(s.name).slice(0, 14), p.x - pw / 2 + 54, p.y + 8);
    g.font = "900 16px Fraunces, serif"; g.fillStyle = s.stack === 0 ? "#c0392b" : "#e8c35a"; g.fillText(s.stack === 0 && s.inHand && !s.folded ? "ALL IN" : s.stack.toLocaleString(), p.x - pw / 2 + 54, p.y + 29);
    if (String(s.id).startsWith("bot:") && !s.sitOut && !(s.folded && s.inHand)) { g.font = "700 10px Figtree, sans-serif"; g.fillStyle = "#e8c35a"; g.textAlign = "right"; g.fillText("TEST BOT", p.x + pw / 2 - 8, p.y + 29); }
    if (s.sitOut) { g.font = "700 10px Figtree, sans-serif"; g.fillStyle = "#a79e8f"; g.textAlign = "right"; g.fillText("SITTING OUT", p.x + pw / 2 - 8, p.y + 29); }
    else if (s.gone) { g.font = "700 10px Figtree, sans-serif"; g.fillStyle = "#c0392b"; g.textAlign = "right"; g.fillText("AWAY", p.x + pw / 2 - 8, p.y + 29); }
    else if (s.folded && s.inHand) { g.font = "700 10px Figtree, sans-serif"; g.fillStyle = "#a79e8f"; g.textAlign = "right"; g.fillText("FOLDED", p.x + pw / 2 - 8, p.y + 29); }
    // the dealer button
    if (v.button === i) { const b = betPos(i); g.beginPath(); g.arc(b.x + 40, b.y + 18, 12, 0, Math.PI * 2); g.fillStyle = "#f4efe4"; g.fill(); g.strokeStyle = "#120d0b"; g.lineWidth = 2; g.stroke(); g.font = "900 11px Figtree, sans-serif"; g.fillStyle = "#120d0b"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("D", b.x + 40, b.y + 18); }
    // this street's bet, in front of the seat
    if (s.bet > 0) { const b = betPos(i); chipStack(b.x, b.y, s.bet); }
    // the showdown: what they won, with their hand's name
    if (v.phase === "showdown" && s.won > 0) { const t = Math.min(1, (now - showAt) / 500); g.font = "900 18px Fraunces, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = `rgba(232,195,90,${t})`; g.fillText(`+${s.won}`, p.x, p.y - (isMe ? 150 : 100) - t * 6); }
  }
  // my hand's name while I am in it
  if (me >= 0 && v.seats[me]?.cards.length === 2 && v.seats[me].cards[0] >= 0 && v.board.length >= 3 && !v.seats[me].folded) { const best = evalBest([...v.seats[me].cards, ...v.board]); g.font = "700 13px Figtree, sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(244,239,228,.8)"; g.fillText(handName(best), seatPos(me).x, seatPos(me).y + 58); }
}
requestAnimationFrame(draw);
connect();
window.__poker = { get view() { return view; }, send, get you() { return you; } };

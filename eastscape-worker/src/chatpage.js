/* THE STAFF CHAT VIEW's page (2026-09-30). The owner: "is there a way i can view the chat on eastscape without having to log in? ... i dont
   really want to be in the game but would like to see the chat in case im needed", "and dont want it to show me online".
   Served by the worker at /chat?k=<CHAT_KEY>; it polls /chat.json with the same key every 5 s (every 30 s while the tab is hidden). It is a web
   page, not a player: nothing about it is in the world, so nobody can see it is open. Read-only on purpose: answering means logging in.
   (2026-10-01) START SOMETHING: a panel that starts or ends events (chatact.js), unlocked with a second key (ACT_KEY) kept in this browser. */
export const CHAT_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>EastScape chat</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#0f0b09;color:#ece2cc;font:15px/1.45 Lora,Georgia,serif}
body{display:grid;grid-template-columns:minmax(0,1fr) 280px;grid-template-rows:auto minmax(0,1fr);height:100vh}
header{grid-column:1/-1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;background:#1a120c;border-bottom:2px solid #3a2616}
header b{font:800 19px Georgia,serif;color:#ffe7b0}
header .st{font-size:12.5px;color:#a89070}.st.bad{color:#ff9a8a}
.ev{display:flex;gap:6px;flex-wrap:wrap}.ev span{padding:2px 9px;border-radius:999px;background:#2a1a10;box-shadow:0 0 0 1px #5a3a1a;font-size:12.5px;font-weight:700;color:#ffd98a}
.ev span.hot{background:#5a1a10;box-shadow:0 0 0 1px #ff8a6a;color:#fff}
label.opt{margin-left:auto;font-size:13px;color:#cdbfa2;display:flex;gap:6px;align-items:center;cursor:pointer}
#log{overflow:auto;padding:10px 16px}
.l{display:grid;grid-template-columns:58px auto minmax(0,1fr);gap:8px;padding:3px 6px;border-radius:5px}
.l:hover{background:#1a120c}
.l .t{color:#7a6a50;font-size:12px;padding-top:2px;font-variant-numeric:tabular-nums}
.l .n{font-weight:800;color:#9fd0ff;white-space:nowrap}
.l .n.staff{color:#7ee07e}.l .n.staff::after{content:" ★";color:#7ee07e}
.l.house .n{color:#ffd84a}.l.house .x{color:#ffe7b0}
.l .x{overflow-wrap:anywhere}
.l.flag{background:rgba(200,60,40,.18);box-shadow:inset 3px 0 0 #ff6a4a}
.l.new{animation:fade 2.5s ease-out}@keyframes fade{from{background:rgba(255,216,74,.18)}to{background:transparent}}
aside{border-left:2px solid #3a2616;background:#140e0a;overflow:auto;padding:10px 14px}
aside h2{margin:0 0 8px;font:800 15px Georgia,serif;color:#ffe7b0}
.p{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #2a1c12;font-size:13.5px}
.p b{font-weight:700}.p small{color:#a89070;text-align:right}
.empty{color:#7a6a50;font-style:italic;padding:12px 0}
#act{margin:0 0 14px;padding:0 0 12px;border-bottom:2px solid #3a2616}
#act select,#act input,#act button{font:inherit;font-size:13.5px;border-radius:7px;border:1px solid #5a3a1a;background:#221710;color:#ece2cc;padding:5px 8px;width:100%;margin:0 0 6px}
#act button{background:#5a2a10;border-color:#a8602a;color:#ffe7b0;font-weight:800;cursor:pointer}#act button:hover{background:#7a3a14}
#act button.link{background:none;border:0;color:#a89070;font-weight:600;font-size:12px;text-decoration:underline;padding:2px 0;width:auto}
#act .msg{font-size:12.5px;color:#cdbfa2;margin:2px 0 6px}#act .msg.bad{color:#ff9a8a}#act .msg.good{color:#9ce07e}
#act .plan{font-size:13px;color:#ffd98a;margin:4px 0}#act .plan button{width:auto;padding:2px 8px;margin:0 0 0 6px;font-size:12px}
#act .acts{font-size:12px;color:#a89070}#act .acts div{padding:2px 0;border-bottom:1px solid #2a1c12}
@media (max-width:720px){body{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr) auto}aside{border-left:0;border-top:2px solid #3a2616;max-height:30vh}}
@media (prefers-reduced-motion:reduce){.l.new{animation:none}}
</style></head><body>
<header><b>EastScape chat</b><span class="st" id="st">connecting…</span><span class="ev" id="ev"></span>
  <label class="opt"><input type="checkbox" id="ding"> ding when someone asks for help</label></header>
<main id="log"><p class="empty">Loading…</p></main>
<aside><section id="act"><h2>Start something</h2>
  <div id="lock"><input type="password" id="ak" placeholder="Action key" autocomplete="off"><button id="akGo">Unlock</button><div class="msg" id="lockMsg">Starts and ends events without logging in, so nobody sees you online.</div></div>
  <div id="ctl" hidden>
    <select id="what"><optgroup label="Start"><option value="raid">The Yard raid (the Ice Man)</option><option value="flood">The Flood</option><option value="star">A shooting star</option><option value="wanted">A Wanted poster</option><option value="thief">The Jackpot Thief</option><option value="wyrm">The Ice Wyrm</option><option value="king">The Pumpkin King</option></optgroup>
      <optgroup label="Stop or skip"><option value="skip">Skip the raid's warning</option><option value="raidend">End the raid or the Flood</option><option value="starend">End the star</option><option value="wantedend">End the poster</option><option value="thiefend">End the thief</option><option value="wyrmdown">Send the Wyrm back</option></optgroup></select>
    <select id="when"><option value="now">Now</option><option value="m10">In 10 minutes</option><option value="m30">In 30 minutes</option><option value="r60">At a random time in the next hour</option><option value="r120">At a random time in the next 2 hours</option></select>
    <button id="go">Start it</button>
    <div class="msg" id="said"></div><div class="plan" id="plan"></div><div class="acts" id="acts"></div>
    <button class="link" id="forget">Forget the key on this browser</button>
  </div></section>
  <h2 id="onH">Online</h2><div id="on"></div></aside>
<script>
const K = new URLSearchParams(location.search).get("k") || "", $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/* a line worth a look: someone asking for staff, or for help */
const FLAG = /\\b(admin|admins|mod|mods|staff|help|bug|bugged|stuck|broken|refund|lost my|scam|hack)\\b/i;
let seen = 0, first = true, timer = 0;
try { $("ding").checked = localStorage.getItem("es_chat_ding") === "1"; } catch (e) {}
$("ding").addEventListener("change", (e) => { try { localStorage.setItem("es_chat_ding", e.target.checked ? "1" : "0"); } catch (x) {} });
function ding() { try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.18); } catch (e) {} }
const when = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
async function pull() {
  clearTimeout(timer);
  try {
    const r = await fetch("chat.json?k=" + encodeURIComponent(K), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json(), log = $("log"), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    const lines = d.lines || [];
    let flagged = false;
    log.innerHTML = lines.length ? lines.map((m) => { const f = !m.house && FLAG.test(m.text), fresh = !first && m.t > seen; if (f && fresh) flagged = true;
      return '<div class="l' + (m.house ? " house" : "") + (f ? " flag" : "") + (fresh ? " new" : "") + '"><span class="t">' + when(m.t) + '</span><span class="n' + (m.staff ? " staff" : "") + '">' + esc(m.name) + '</span><span class="x">' + esc(m.text) + '</span></div>'; }).join("") : '<p class="empty">Nobody has said anything yet.</p>';
    if (atEnd || first) log.scrollTop = log.scrollHeight;
    if (flagged && $("ding").checked) ding();
    seen = Math.max(seen, ...lines.map((m) => m.t || 0)); first = false;
    const on = d.online || [];
    $("onH").textContent = "Online · " + on.length; $("on").innerHTML = on.length ? on.map((p) => '<div class="p"><b>' + esc(p.name) + (p.staff ? " ★" : "") + '</b><small>' + esc(p.where) + '</small></div>').join("") : '<p class="empty">Nobody is on.</p>';
    const ev = [], E = d.events || {};
    if (E.raid?.kind === "flood") ev.push('<span class="hot">🌊 Flood ' + (E.raid.phase === "warn" ? "coming" : "on") + " · " + Math.ceil(E.raid.leftS / 60) + "m · water " + (E.raid.water || 0) + "%</span>");
    else if (E.raid?.phase) ev.push('<span class="hot">❄️ Ice Man ' + (E.raid.phase === "warn" ? "coming" : "raid on") + " · " + Math.ceil(E.raid.leftS / 60) + "m</span>");
    else if (E.raid?.sacked) ev.push("<span>Yard stalls shut · " + Math.ceil(E.raid.leftS / 60) + "m</span>");
    if (E.king?.up) ev.push('<span class="hot">🎃 Pumpkin King up · ' + Math.ceil(E.king.leftS / 60) + "m</span>"); else if (E.king?.nextS != null) ev.push("<span>🎃 King in " + Math.ceil(E.king.nextS / 60) + "m</span>");
    if (E.wyrm?.up) ev.push('<span class="hot">❄️ Ice Wyrm up</span>');
    const Wd = E.world || {};
    if (Wd.star) ev.push('<span class="hot">⭐ Star ' + (Wd.star.phase === "warn" ? "falling" : "down") + "</span>");
    if (Wd.wanted) ev.push('<span class="hot">📜 Wanted: ' + esc(Wd.wanted.name || "") + "</span>");
    if (Wd.thief) ev.push('<span class="hot">💰 Thief loose</span>');
    actShow(d.act);
    $("ev").innerHTML = ev.join("");
    $("st").textContent = "live · rules " + d.version + " · updated " + when(d.t); $("st").className = "st";
  } catch (e) { $("st").textContent = "can't reach the game server (" + e.message + "), retrying"; $("st").className = "st bad"; }
  timer = setTimeout(pull, document.hidden ? 30000 : 5000);
}
/* START SOMETHING: the key lives in this browser only; a wrong one gets the same 404 as anything else */
let AK = ""; try { AK = localStorage.getItem("es_chat_act") || ""; } catch (e) {}
const STOPS = new Set(["skip", "raidend", "starend", "wantedend", "thiefend", "wyrmdown"]);
async function act(body) {
  const r = await fetch("chat/act?k=" + encodeURIComponent(K), { method: "POST", headers: { "content-type": "application/json", "X-Act-Key": AK }, body: JSON.stringify(body) });
  if (r.status === 404) throw new Error("wrong key");
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
function unlocked(on) { $("lock").hidden = on; $("ctl").hidden = !on; }
async function tryKey(k) {
  AK = k; $("lockMsg").textContent = "Checking…"; $("lockMsg").className = "msg";
  try { await act({}); try { localStorage.setItem("es_chat_act", k); } catch (e) {} unlocked(true); }
  catch (e) { AK = ""; unlocked(false); $("lockMsg").textContent = e.message === "wrong key" ? "That key isn't right." : "Can't reach the game server (" + e.message + ")."; $("lockMsg").className = "msg bad"; }
}
$("akGo").addEventListener("click", () => tryKey($("ak").value.trim()));
$("ak").addEventListener("keydown", (e) => { if (e.key === "Enter") tryKey($("ak").value.trim()); });
$("forget").addEventListener("click", () => { AK = ""; try { localStorage.removeItem("es_chat_act"); } catch (e) {} $("ak").value = ""; unlocked(false); $("lockMsg").textContent = "Forgotten on this browser."; $("lockMsg").className = "msg"; });
$("what").addEventListener("change", () => { const stop = STOPS.has($("what").value); $("when").disabled = stop; if (stop) $("when").value = "now"; $("go").textContent = stop ? "Do it" : "Start it"; });
$("go").addEventListener("click", async () => {
  const w = $("what"), label = w.options[w.selectedIndex].text, when = $("when").value, wl = $("when").options[$("when").selectedIndex].text.toLowerCase();
  if (!confirm((STOPS.has(w.value) ? label : label + ", " + wl) + "?")) return;
  $("go").disabled = true;
  try { const j = await act({ what: w.value, when }); $("said").textContent = j.said || "Done."; $("said").className = "msg " + (j.ok ? "good" : "bad"); }
  catch (e) { $("said").textContent = e.message === "wrong key" ? "The key stopped working. Unlock again." : "Didn't go through (" + e.message + ")."; $("said").className = "msg bad"; if (e.message === "wrong key") unlocked(false); }
  $("go").disabled = false; pull();
});
$("plan").addEventListener("click", async (e) => { if (!e.target.matches("button")) return; try { const j = await act({ cancel: true }); $("said").textContent = j.said; $("said").className = "msg good"; } catch (x) { $("said").textContent = "Didn't go through."; $("said").className = "msg bad"; } pull(); });
function actShow(a) {
  if (!a || $("ctl").hidden) return;
  $("plan").innerHTML = a.plan ? "Waiting: " + esc(a.plan.what) + " at " + when(a.plan.at) + (a.plan.random ? " (picked at random)" : "") + '<button type="button">Call it off</button>' : "";
  $("acts").innerHTML = (a.acts || []).map((x) => "<div>" + when(x.t) + " · " + esc(x.what) + ": " + esc(x.said) + "</div>").join("");
}
if (AK) tryKey(AK);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(); });
pull();
</script></body></html>`;

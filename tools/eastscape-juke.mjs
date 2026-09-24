/* EastScape: the jukebox takes tickets —  node tools/eastscape-juke.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   Signs in the dev admin (bootypaper, who can give himself tickets) and one ordinary player, stands both at the casino's jukebox
   and checks the v89 rules over the real socket: a pick costs RADIO.cost, being short is refused and charges nothing, the room is
   told, and a paid pick can't be changed or switched off by somebody else while it is held. It talks to Radio Browser for one
   real station (the server looks the station up itself), and never touches the site or a ZCoin. */
import * as G from "../v3/assets/js/eastscape-shared.js";
const URL_ = (n, plain) => `ws://127.0.0.1:8787/ws?dev=1${plain ? "&plain=1" : ""}&login=${n}`,   /* (&plain=1 is an ordinary player; without it a dev login is an admin) */ wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
function player(name, plain = true) {
  const ws = new WebSocket(URL_(name, plain), { headers: { Origin: "http://localhost:4321" } }), p = { name, ws, you: null, me: null, ev: [] };
  p.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`can't reach the game server for ${name}: is wrangler dev running on 8787 with DEV:1?`)); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello") { p.you = m.you; p.me = m.me; } else if (m.type === "me") p.me = m.me; for (const x of m.list || m.ev || []) p.ev.push(x); if (m.type && !["hello", "me", "snap", "who"].includes(m.type)) p.ev.push(m); };
  p.send = (m) => ws.send(JSON.stringify(m)); p.saw = (type, f = () => true) => p.ev.some((x) => x.type === type && f(x)); p.clear = () => { p.ev = []; };
  p.tix = () => (p.me ? G.tixIn(p.me) : 0);
  return p;
}
let uuid = null;
for (const h of G.RADIO.hosts) { try { const r = await fetch(`https://${h}/json/stations/search?tag=oldies&limit=5&hidebroken=true&is_https=true&order=clickcount&reverse=true`); const j = await r.json(); uuid = j.find((x) => String(x.url_resolved || "").startsWith("https://"))?.stationuuid; if (uuid) break; } catch (e) { /* next mirror */ } }
if (!uuid) { console.log("SKIP  Radio Browser isn't answering, so there is no station to pay for"); process.exit(0); }

const tag = Date.now().toString(36).slice(-5), A = player("bootypaper", false), B = player(`juke_b_${tag}`);
await Promise.all([A.open, B.open]); await wait(1500);
const juke = G.buildScene("casino").objs.find((o) => o.t === "jukebox");
for (const p of [A, B]) p.send({ t: "admin", cmd: "tp", scene: "casino", x: juke.x, y: juke.y + 1 });   // B is no admin: refused, so B walks
B.send({ t: "walk", x: juke.x + 1, y: juke.y + 1 }); A.send({ t: "radio", op: "stop" }); await wait(9000);

B.clear(); const b0 = B.tix(); B.send({ t: "radio", op: "set", uuid }); await wait(2500);
check(`short of ${G.RADIO.cost} tickets: refused, nothing charged, nothing plays`, B.tix() === b0 && b0 < G.RADIO.cost && !B.saw("radio", (x) => x.radio), `B has ${b0}`);

A.send({ t: "admin", cmd: "item", k: "tickets", n: 500 }); await wait(1200);
A.clear(); B.clear(); const a0 = A.tix(); A.send({ t: "radio", op: "set", uuid }); await wait(5000);
check("a pick charges exactly the price", a0 - A.tix() === G.RADIO.cost, `${a0} -> ${A.tix()}`);
check("the room hears it, with the buyer and a hold on it", B.saw("radio", (x) => x.radio?.by === "bootypaper" && x.radio.hold > Date.now() && x.radio.url.startsWith("https://")));
check("the room is told who paid", B.saw("casinonote", (x) => /paid 100 tickets/.test(x.text)));

B.send({ t: "admin", cmd: "item", k: "tickets", n: 500 }); await wait(600);   // refused: B is no admin. Give B tickets the honest way: none. So B stays short,
B.clear(); B.send({ t: "radio", op: "stop" }); await wait(1200);              // but switching it off needs no tickets, and must still be refused.
check("somebody else can't switch a paid pick off", !B.saw("radio", (x) => x.radio === null) && B.saw("say", (x) => /paid for that/.test(x.text || "")), JSON.stringify(B.ev.slice(-3)));
A.clear(); B.clear(); A.send({ t: "radio", op: "stop" }); await wait(1200);
check("the buyer can switch their own pick off", B.saw("radio", (x) => x.radio === null));
A.ws.close(); B.ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

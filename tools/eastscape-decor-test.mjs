/* EastScape: Yahsmeena's decor shop —  node tools/eastscape-decor-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   The dev admin goes to his island over the real socket and the v101 rules are checked: buying charges the price and needs
   Yahsmeena beside you, a piece goes down and everybody on the island is told, the refusals refuse (water, an unowned piece,
   a cottage piece outside, walling the dock off), picking up and selling back work, and a visitor can do none of it. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createDecorRules } from "../v3/assets/js/eastscape-decor-rules.js"; const DR = createDecorRules(G);
const URL_ = (n, plain) => `ws://127.0.0.1:8787/ws?dev=1${plain ? "&plain=1" : ""}&login=${n}`, wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
function player(name, plain = true) {
  const ws = new WebSocket(URL_(name, plain), { headers: { Origin: "http://localhost:4321" } }), p = { name, ws, you: null, me: null, ev: [], scene: null, objs: [] };
  p.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`can't reach the game server for ${name}`)); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello") { p.you = m.you; p.me = m.me; } else if (m.type === "me") p.me = m.me; if (m.type === "snap" && m.scene) p.scene = m.scene; for (const x of m.list || m.ev || []) { p.ev.push(x); if (x.type === "scene") p.scene = x.key; } if (m.type && !["hello", "me", "snap", "who"].includes(m.type)) p.ev.push(m); };
  p.send = (m) => ws.send(JSON.stringify(m)); p.last = (type) => [...p.ev].reverse().find((x) => x.type === type); p.said = (re) => p.ev.some((x) => x.type === "say" && re.test(x.text || "")); p.clear = () => { p.ev = []; };
  p.tix = () => (p.me ? G.tixIn(p.me) : 0); return p;
}
const A = player("bootypaper", false); await A.open; await wait(1500);
A.send({ t: "admin", cmd: "reset" }); await wait(1500);   // a brand-new character every run (the dev admin's island keeps whatever the last session left on it, and these checks count pieces)
const toIsle = async (p, id) => { p.send({ t: "admin", cmd: "tp", scene: "workyard", x: 38, y: 15 }); await wait(2500); const cart = G.buildScene("workyard").objs.find((o) => o.t === "cart"); p.send({ t: "act", kind: "ob", ob: cart.id }); await wait(2500); p.send({ t: "isle", op: "go", id }); await wait(3500); };
await toIsle(A, A.you.id);
check("the owner reaches his island and is told what stands on it", /^isle/.test(String(A.scene)) && !!A.last("decor"), String(A.scene));
// start clean: pick everything up and sell it
for (const d of [...(A.me.isle.decor || [])]) { A.send({ t: "decor", op: "take", x: d.x, y: d.y }); await wait(250); }
A.send({ t: "admin", cmd: "item", k: "tickets", n: 60000 }); await wait(1200);
A.clear(); const t0 = A.tix(); A.send({ t: "decor", op: "buy", k: "bench" }); await wait(900);
check("away from Yahsmeena, nothing is sold", A.tix() === t0 && A.said(/by the cottage/));
A.send({ t: "walk", x: 12, y: 4 }); await wait(5000);
const own0 = A.me.isle.owned?.bench | 0; A.clear(); A.send({ t: "decor", op: "buy", k: "bench" }); await wait(900);
check("beside her, a bench costs its price and is owned", t0 - A.tix() === DR.DECOR.bench.price && (A.me.isle.owned?.bench | 0) === own0 + 1, `${t0} -> ${A.tix()}`);
A.clear(); A.send({ t: "decor", op: "place", k: "bench", x: 0, y: 0 }); await wait(700); check("it can't go in the sea", A.said(/no room/) && !(A.me.isle.decor || []).length);
A.clear(); A.send({ t: "decor", op: "place", k: "gnome", x: 9, y: 6 }); await wait(700); check("a piece you don't own can't be placed", A.said(/spare/));
A.send({ t: "decor", op: "buy", k: "toilet" }); await wait(800); A.clear(); A.send({ t: "decor", op: "place", k: "toilet", x: 9, y: 6 }); await wait(700); check("a cottage piece can't go outside", A.said(/inside the cottage/));
A.clear(); A.send({ t: "decor", op: "place", k: "bench", x: 10, y: 9 }); await wait(700); check("a piece that would wall the dock off is refused", A.said(/wall|no room|standing/i) && !(A.me.isle.decor || []).length, JSON.stringify(A.ev.filter((x) => x.type === "say").slice(-1)));
A.clear(); A.send({ t: "decor", op: "place", k: "bench", x: 9, y: 6 }); await wait(900);
check("on open grass it goes down, and the island is told", (A.me.isle.decor || []).some((d) => d.k === "bench" && d.x === 9 && d.y === 6) && (A.last("decor")?.decor || []).length === 1);
A.clear(); A.send({ t: "walk", x: 9, y: 6 }); await wait(2500); check("you can't walk through it", !(A.me && A.ev.some((x) => x.type === "arrived")) );
A.clear(); A.send({ t: "decor", op: "sell", k: "bench" }); await wait(700); check("she won't buy back something still standing", A.said(/Pick it up first/));
A.clear(); A.send({ t: "decor", op: "take", x: 10, y: 6 }); await wait(900); check("clicking any tile of it picks it up", !(A.me.isle.decor || []).length && (A.last("decor")?.decor || []).length === 0);
A.send({ t: "walk", x: 12, y: 4 }); await wait(4000); const t1 = A.tix(); A.send({ t: "decor", op: "sell", k: "bench" }); await wait(900);
check("and then she buys it back for a quarter", A.tix() - t1 === Math.floor(DR.DECOR.bench.price * DR.DECOR_SELLBACK), `${t1} -> ${A.tix()}`);
A.send({ t: "decor", op: "sell", k: "toilet" }); await wait(600);
A.ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

/* EastScape: tickets change hands —  node tools/eastscape-trade-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   The dev admin gives himself tickets, trades 200 of them to an ordinary player over the real socket (request, offer, accept,
   confirm), and the books are checked on both sides. Offering more than you hold is clamped to what you hold. */
import * as G from "../v3/assets/js/eastscape-shared.js";
const URL_ = (n, plain) => `ws://127.0.0.1:8787/ws?dev=1${plain ? "&plain=1" : ""}&login=${n}`, wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
function player(name, plain = true) {
  const ws = new WebSocket(URL_(name, plain), { headers: { Origin: "http://localhost:4321" } }), p = { name, ws, you: null, me: null, trade: null };
  p.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`can't reach the game server for ${name}`)); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello") { p.you = m.you; p.me = m.me; } else if (m.type === "me") p.me = m.me; else if (m.type === "trade") p.trade = m; };
  p.send = (m) => ws.send(JSON.stringify(m)); p.tix = () => (p.me ? G.tixIn(p.me) : 0); return p;
}
const tag = Date.now().toString(36).slice(-5), A = player("bootypaper", false), B = player(`trade_b_${tag}`);
await Promise.all([A.open, B.open]); await wait(1500);
A.send({ t: "admin", cmd: "tp", scene: "casino", x: 21, y: 19 }); A.send({ t: "admin", cmd: "item", k: "tickets", n: 500 }); await wait(2500);   // B arrives at the front door, a step away
const a0 = A.tix(), b0 = B.tix();
A.send({ t: "trade", op: "req", to: B.you.id }); await wait(500); B.send({ t: "trade", op: "req", to: A.you.id }); await wait(800);
check("the trade opens", !!A.trade && !A.trade.closed && !!B.trade, JSON.stringify(A.trade).slice(0, 120));
A.send({ t: "trade", op: "cash", n: 99999999 }); await wait(600);
const offered = JSON.stringify(B.trade); check("offering more than you hold is clamped to what you hold", offered.includes(`"cash":${a0}`), offered.slice(0, 200));
A.send({ t: "trade", op: "cash", n: 200 }); await wait(500);
for (const p of [A, B]) p.send({ t: "trade", op: "accept" }); await wait(700); for (const p of [A, B]) p.send({ t: "trade", op: "accept" }); await wait(1500);
check("200 tickets left the giver", a0 - A.tix() === 200, `${a0} -> ${A.tix()}`);
check("and arrived with the other player, to the ticket", B.tix() - b0 === 200, `${b0} -> ${B.tix()}`);
A.ws.close(); B.ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

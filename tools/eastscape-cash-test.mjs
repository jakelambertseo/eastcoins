/* EastScape: trading tickets for ZCoins at the Prize Counter —  node tools/eastscape-cash-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   In dev mode the site is a PRETEND exchange inside the game server (dexDev): the same answers, no real ZCoins. This checks the
   game server's half: the tickets taken are exactly rate x ZCoins, taken once; too few tickets takes nothing; away from the
   counter takes nothing; the hour's allowance holds and a refusal takes nothing; the window is told what it needs for the pop-up. */
import * as G from "../v3/assets/js/eastscape-shared.js";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
const name = `cash_${Date.now().toString(36).slice(-5)}`, ws = new WebSocket(`ws://127.0.0.1:8787/ws?dev=1&login=${name}`, { headers: { Origin: "http://localhost:4321" } });
let me = null, dex = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello" || m.type === "me") me = m.me; for (const x of m.list || []) if (x.type === "dex") dex.push(x); if (m.type === "dex") dex.push(m); };
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("can't reach the game server")); }); await wait(1200);
const send = (m) => ws.send(JSON.stringify(m)), tix = () => G.tixIn(me), R = G.DEX.rate, last = () => dex[dex.length - 1];
const counter = G.buildScene("casino").objs.find((o) => o.t === "prizecase" || o.t === "bomkiosk" || /Prize Counter|Bom Trady/i.test(o.name || ""));
send({ t: "admin", cmd: "reset" }); await wait(500);
send({ t: "admin", cmd: "tp", scene: "workyard", x: 20, y: 12 }); send({ t: "admin", cmd: "item", k: "tickets", n: 5 * R + 300 }); await wait(1500);
const t0 = tix(); dex = []; send({ t: "dex", op: "cash", zc: 1 }); await wait(2000);
check("away from the counter nothing is taken", tix() === t0, `${t0} -> ${tix()}`);
send({ t: "admin", cmd: "tp", scene: "casino", x: counter.x, y: counter.y + (counter.h || 1) }); await wait(1500);
dex = []; send({ t: "dex", op: "cash", zc: 2 }); await wait(3000);
check("two ZCoins costs exactly 2 x the rate, once", t0 - tix() === 2 * R, `${t0} -> ${tix()}`);
check("the window is told: op cash, 2 ZCoins, the tickets it took", last()?.done?.op === "cash" && last().done.zc === 2 && last().done.tix === 2 * R, JSON.stringify(last()));
const t1 = tix(); dex = []; send({ t: "dex", op: "cash", zc: 9 }); await wait(2500);
check("asking for more than your tickets cover takes nothing, and says why", tix() === t1 && /tickets|ZCoin/i.test(last()?.error || ""), `${t1} -> ${tix()} | ${last()?.error}`);
dex = []; send({ t: "dex", op: "cash", zc: 0 }); await wait(2000); check("zero, or nonsense, takes nothing", tix() === t1, `${tix()}`);
dex = []; send({ t: "dex", op: "cash", zc: 3 }); await wait(3000);
check("the rest: three more, exactly", t1 - tix() === 3 * R && last()?.done?.zc === 3, `${t1} -> ${tix()} ${JSON.stringify(last())}`);
// the hour's allowance: give plenty of tickets, ask for the cap, then for one more
send({ t: "admin", cmd: "item", k: "tickets", n: (G.DEX.capHour + 5) * R }); await wait(1500);
const t2 = tix(), leftNow = last()?.status?.left ?? 0; dex = []; send({ t: "dex", op: "cash", zc: leftNow }); await wait(3500);
check(`the rest of the hour's allowance (${leftNow}) goes through`, t2 - tix() === leftNow * R, `${t2} -> ${tix()} ${JSON.stringify(last())}`);
const t3 = tix(); dex = []; send({ t: "dex", op: "cash", zc: 1 }); await wait(3000);
check("and one more is refused, taking nothing", tix() === t3 && !!last()?.error, `${t3} -> ${tix()} | ${last()?.error}`);
ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

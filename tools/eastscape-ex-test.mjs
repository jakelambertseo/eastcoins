/* EastScape: taking an Exchange offer down —  node tools/eastscape-ex-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   A beta tester listed an item, took the offer down to give the item to a friend, and thought it had vanished: it had gone to his
   BANK with one fading line to say so. This checks what happens now: it comes back to the BAG, the line names it, nothing is
   lost or doubled, and with a full bag it goes to the bank and the line says THAT. */
import * as G from "../v3/assets/js/eastscape-shared.js";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
const name = `ex_${Date.now().toString(36).slice(-5)}`, ws = new WebSocket(`ws://127.0.0.1:8787/ws?dev=1&login=${name}`, { headers: { Origin: "http://localhost:4321" } });
let me = null, says = [], orders = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello" || m.type === "me") me = m.me; for (const x of m.list || []) { if (x.type === "say") says.push(x.text); } if (m.type === "exch") orders = m.mine || orders; };
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("can't reach the game server")); }); await wait(1200);
const send = (m) => ws.send(JSON.stringify(m)), bag = (k) => (me.inv || []).filter((s) => s && s.k === k).reduce((a, s) => a + s.n, 0), bank = (k) => (me.bank || []).filter((s) => s.k === k).reduce((a, s) => a + s.n, 0);
const stall = G.buildScene("workyard").objs.find((o) => o.t === "stall");
send({ t: "admin", cmd: "reset" }); await wait(500); send({ t: "admin", cmd: "tp", scene: "workyard", x: stall.x, y: stall.y + 1 }); send({ t: "admin", cmd: "item", k: "trout", n: 7 }); await wait(1500);
check("set up: seven trout in the bag, standing at the stall", bag("trout") === 7, `bag ${bag("trout")}`);
send({ t: "ex", op: "place", side: "sell", k: "trout", qty: 7, price: 999999 }); await wait(1500);
check("listing them takes them out of the bag", bag("trout") === 0 && bank("trout") === 0, `bag ${bag("trout")} bank ${bank("trout")}`);
send({ t: "ex", op: "open" }); await wait(800);
const mine = (orders || []).find((o) => o.k === "trout" && o.open); check("the offer is up", !!mine, JSON.stringify(orders).slice(0, 160));
says = []; send({ t: "ex", op: "cancel", id: mine?.id }); await wait(1500);
check("taking it down puts all seven back in the BAG", bag("trout") === 7 && bank("trout") === 0, `bag ${bag("trout")} bank ${bank("trout")}`);
check("and the line names the thing and the place", says.some((t) => /7 × .*trout.* back in your BAG/i.test(t)), says.join(" | "));
// a full bag: fill every slot with different things, list the trout from the bank, take it down
send({ t: "bank", op: "depinv" }); await wait(300);
send({ t: "admin", cmd: "tp", scene: "workyard", x: stall.x, y: stall.y + 1 }); await wait(600);
send({ t: "ex", op: "place", side: "sell", k: "trout", qty: 7, price: 999999 }); await wait(1200);
const fillers = Object.keys(G.ITEMS).filter((k) => k !== "trout" && k !== "tickets" && !G.ITEMS[k].slot).slice(0, G.INV_MAX + 4); for (const k of fillers) send({ t: "admin", cmd: "item", k, n: 1 }); await wait(2500);
send({ t: "ex", op: "open" }); await wait(800); const again = (orders || []).find((o) => o.k === "trout" && o.open);
says = []; send({ t: "ex", op: "cancel", id: again?.id }); await wait(1500);
check("with no room in the bag it goes to the BANK instead, none lost, none doubled", bag("trout") + bank("trout") === 7 && bank("trout") > 0, `bag ${bag("trout")} bank ${bank("trout")} (${me.inv.length} slots used)`);
check("and the line says BANK, with where to find one", says.some((t) => /in your BANK \(a bank booth/.test(t)), says.join(" | "));
ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

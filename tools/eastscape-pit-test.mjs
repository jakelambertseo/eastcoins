/* EastScape: ticket bets on the Fight Pit —  node tools/eastscape-pit-test.mjs      (takes up to three minutes: it waits for a real 90 s round)
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   FIRST, with no server: the game server works out each round's card and each round's edge draw BY ITSELF, and they have to be
   the site's. This imports the site's own pitCard and edgeFor (functions/api/casino/_engine.js) and compares them over 400
   rounds and 400 seeds. If the site's pool, clamp or formula ever changes, this fails before a player is paid the wrong price.
   THEN over the socket, against dev mode's pretend result: the stake leaves the bag once; the other side and an oversize bet are
   refused and take nothing; nothing is paid before the fight ends; the pay-out is round(stake x price x edge) for a win and
   nothing for a loss, in tickets, exactly once. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { PIT, pitCard, pitEdge } from "../eastscape-worker/src/pit.js";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
let site = null; try { site = await import("../functions/api/casino/_engine.js"); } catch (e) { console.log("(could not import the site's engine: " + e.message.split("\n")[0] + ")"); }
if (site) {
  let bad = []; for (let no = 19000000; no < 19000400; no++) { const a = await pitCard(G, no), b = await site.pitCard(no); if (a.f[0] !== b.f[0].t || a.f[1] !== b.f[1].t || Math.abs(a.p[0] - b.p[0]) > 1e-12 || Math.abs(a.price[0] - b.price.a) > 1e-9 || Math.abs(a.price[1] - b.price.b) > 1e-9) bad.push(no); }
  check("400 rounds: the same two fighters at the same prices as the site's own pitCard", !bad.length, `first mismatch at round ${bad[0]}`);
  bad = []; for (let i = 0; i < 400; i++) { const seed = `seed-${i}-${i * 7919}`; if ((await pitEdge(G, seed)) !== (await site.edgeFor(seed))) bad.push(seed); }
  check("400 seeds: the same edge draw as the site's own edgeFor, always inside the band", !bad.length, bad[0]);
  check("the clock is the site's: 90 s rounds, 40 s of betting", PIT.cycle === site.GAMES.pit.cycleMs && PIT.bet === site.GAMES.pit.betMs);
} else { check("the site's engine could be imported to compare against", false); }

const name = `pit_${Date.now().toString(36).slice(-5)}`, ws = new WebSocket(`ws://127.0.0.1:8787/ws?dev=1&login=${name}`, { headers: { Origin: "http://localhost:4321" } });
let me = null, pit = [], says = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello" || m.type === "me") me = m.me; for (const x of m.list || []) { if (x.type === "pit") pit.push(x); if (x.type === "say") says.push(x.text); } };
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("can't reach the game server")); }); await wait(1200);
const send = (m) => ws.send(JSON.stringify(m)), tix = () => G.tixIn(me);
send({ t: "admin", cmd: "reset" }); await wait(500); send({ t: "admin", cmd: "tp", scene: "fightpit", x: 21, y: 18 }); send({ t: "admin", cmd: "item", k: "tickets", n: 50000 }); await wait(1500);
// wait for a betting window with at least 15 s left in it
for (;;) { const tIn = Date.now() % PIT.cycle; if (tIn < PIT.bet - 15000) break; console.log(`  (waiting ${Math.ceil((PIT.cycle - tIn) / 1000)} s for the next fight to open)`); await wait(PIT.cycle - tIn + 500); }
const no = Math.floor(Date.now() / PIT.cycle), card = await pitCard(G, no), t0 = tix();
send({ t: "pit", op: "bet", side: 0, amt: 1000 }); await wait(1500);
check("1,000 tickets leave the bag, once", t0 - tix() === 1000, `${t0} -> ${tix()}`);
check("the room is told who has what on this round", pit.some((x) => x.kind === "bets" && x.no === no && x.bets.some((b) => b.amt === 1000 && b.side === 0)), JSON.stringify(pit.slice(-1)));
send({ t: "pit", op: "bet", side: 1, amt: 500 }); await wait(1200); check("backing the OTHER fighter as well is refused and takes nothing", t0 - tix() === 1000 && says.some((t) => /other one/.test(t)), `${tix()}`);
send({ t: "pit", op: "bet", side: 0, amt: 20000 }); await wait(1200); check("going over 20,000 on one fight is refused and takes nothing", t0 - tix() === 1000, `${tix()}`);
send({ t: "pit", op: "bet", side: 0, amt: 500 }); await wait(1500); check("adding to the same side is allowed", t0 - tix() === 1500, `${tix()}`);
const due = no * PIT.cycle + PIT.bet + PIT.show; await wait(Math.max(0, due - Date.now() - 3000));
check("nothing is paid before the fight in the window ends", !pit.some((x) => x.kind === "paid") && t0 - tix() === 1500, `${tix()}`);
console.log(`  (waiting for the fight to end)`); for (let i = 0; i < 40 && !pit.some((x) => x.kind === "paid"); i++) await wait(500); await wait(800);
const paid = pit.find((x) => x.kind === "paid");
check("then it is settled, once", pit.filter((x) => x.kind === "paid").length === 1 && paid?.no === no && paid.stake === 1500, JSON.stringify(paid));
if (paid) { const want = paid.won ? Math.round(1500 * card.price[0] * paid.edge) : 0;
  check(`${paid.won ? "WON" : "LOST"}: paid ${paid.payout}, the rule says ${want} (price ${card.price[0].toFixed(3)}, this round's draw ${paid.edge})`, paid.payout === want && paid.edge >= G.EDGE_BAND[0] && paid.edge <= G.EDGE_BAND[1]);
  check("and the bag holds exactly what it should, in tickets", tix() === t0 - 1500 + paid.payout, `${tix()} vs ${t0 - 1500 + paid.payout}`); }
await wait(6000); check("and it is not paid a second time", pit.filter((x) => x.kind === "paid").length === 1 && tix() === t0 - 1500 + (paid?.payout || 0));
ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

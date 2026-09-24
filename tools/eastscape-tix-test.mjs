/* EastScape: the ticket tables (tickets in, tickets out, every play in the 96-104% band) —  node tools/eastscape-tix-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   FIRST, with no server at all: the rule itself. For every simple game the nominal table divided by tableReturn() must come to
   exactly 1 (so the draw IS the return), and the draw must be uniform over the band with a mean of 1.
   THEN over the real socket: the floor's tables take tickets from anywhere on the floor; every result carries its draw; the draw is
   inside the band; what was paid is round(stake x nominal x draw / tableReturn); the bag moves by exactly payout - stake; the limits
   are 10 to 20,000; a Mines board and a Hi-Lo run carry one draw for the whole run and pay by it. */
import * as G from "../v3/assets/js/eastscape-shared.js";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol, [LO, HI] = G.EDGE_BAND;

/* ---- the rule, exactly */
check("coin: nominal / tableReturn is fair", near(0.5 * G.FLIP_PAYS / G.tableReturn("cointable"), 1));
{ let ok = true; for (let t = G.DICE.min; t <= G.DICE.max; t++) if (!near(((t - 1) / 100) * G.diceMult(t) / G.tableReturn("dicetable", { target: t }), 1)) ok = false; check("dice: fair at every target from 5 to 95", ok); }
{ const n = { red: 0, black: 0, gold: 0 }; for (let a = 0; a < 3600; a++) n[G.wheelColor(a / 10)]++; check("wheel: fair on red, black and gold", ["red", "black", "gold"].every((k) => near((n[k] / 3600) * G.WHEEL.pays[k] / G.tableReturn("wheel", { pick: k }), 1))); }
{ const N = G.PLINKO.rows; let c = 1, t = 0; for (let b = 0; b <= N; b++) { t += (c / 2 ** N) * G.PLINKO.pays[b]; c = (c * (N - b)) / (b + 1); } check("plinko: fair over all 13 buckets", near(t / G.tableReturn("plinko"), 1)); }
check("scratch: fair over the prize table", near(G.SCRATCH.reduce((a, s) => a + (s.w / 1000) * s.x, 0) / G.tableReturn("scratch"), 1));
{ const W = G.REELS.reduce((a, r) => a + r.w, 0); let t = 0; for (const a of G.REELS) for (const b of G.REELS) for (const c of G.REELS) t += ((a.w * b.w * c.w) / W ** 3) * G.slotsPay([a.k, b.k, c.k]);
  const e = 1.0; check("slots: the table pays the draw LESS the jackpot's 2%, and the jackpot is the rest", near(t * G.paidMult("slots", 1, {}, e), e - G.JACKPOT.slice, 1e-9), `${t * G.paidMult("slots", 1, {}, e)}`); }
{ let s = 0, lo = 9, hi = 0; const n = 200000; for (let i = 0; i < n; i++) { const e = G.edgeDraw(Math.random()); s += e; lo = Math.min(lo, e); hi = Math.max(hi, e); } check(`the draw: inside ${LO}-${HI}, mean 1.00 (got ${(s / n).toFixed(4)}, ${lo.toFixed(4)} to ${hi.toFixed(4)})`, lo >= LO && hi <= HI && Math.abs(s / n - 1) < 0.001); }
check("Mines and Hi-Lo: the run's draw is the whole edge (fair price x draw)", near(G.minesMult(3, 1, 1), Math.floor((25 / 22) * 100) / 100) && G.hiloPays(1000, 2, 1.04) === 2080 && G.hiloPays(1000, 2, 0.96) === 1920);

/* ---- over the socket */
const name = `tix_${Date.now().toString(36).slice(-5)}`, ws = new WebSocket(`ws://127.0.0.1:8787/ws?dev=1&login=${name}`, { headers: { Origin: "http://localhost:4321" } });
let me = null, results = [], runs = [], says = [], games = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello" || m.type === "me") me = m.me; for (const x of m.list || []) { if (x.type === "gameResult") results.push(x); if (x.type === "run") runs.push(x); if (x.type === "say") says.push(x.text); if (x.type === "game") games.push(x); } };
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("can't reach the game server")); }); await wait(1200);
const send = (m) => ws.send(JSON.stringify(m)), tix = () => G.tixIn(me);
send({ t: "admin", cmd: "reset" }); await wait(500); send({ t: "admin", cmd: "tp", scene: "casino", x: 21, y: 14 }); send({ t: "admin", cmd: "item", k: "tickets", n: 400000 }); await wait(1500);
send({ t: "tixgame", g: "slots" }); await wait(800); check("the Tickets button's message opens a ticket table, with the ticket jackpot", games[0]?.g === "slots" && games[0].tix === true && games[0].pot >= G.JACKPOT.seed, JSON.stringify(games[0]));
const play = async (g, amt, pick) => { const before = tix(), n = results.length; send({ t: "bet", g, amt, pick }); for (let i = 0; i < 30 && results.length === n; i++) await wait(100); await wait(G.CASINO.betMs + 60); const r = results[n]; return r ? { r, moved: tix() - before } : null; };
says = []; send({ t: "bet", g: "cointable", amt: 5, pick: "heads" }); await wait(1100); check("under 10 tickets is refused", results.length === 0 && says.some((t) => /Bets here are/.test(t)), says.join(" | "));
says = []; send({ t: "bet", g: "cointable", amt: 20001, pick: "heads" }); await wait(1100); check("over 20,000 is refused", results.length === 0 && says.some((t) => /Bets here are/.test(t)), says.join(" | "));
const all = []; let bad = [];
for (const [g, amt, pick, n] of [["cointable", 1000, "heads", 14], ["dicetable", 500, 50, 6], ["wheel", 500, "red", 6], ["plinko", 1000, null, 8], ["scratch", 200, null, 8], ["slots", 20000, null, 6]]) for (let i = 0; i < n; i++) {
  const p = await play(g, amt, pick); if (!p) { bad.push(`${g}: no answer`); continue; } const { r, moved } = p; all.push(r);
  const want = Math.round(amt * G.paidMult(g, r.mult, r, r.edge)) + (r.jackpot || 0);
  if (!(r.edge >= LO && r.edge <= HI)) bad.push(`${g}: draw ${r.edge}`); if (Math.abs(r.payout - want) > Math.max(1, amt * r.mult * 0.0006)) bad.push(`${g}: paid ${r.payout}, rule says ${want} (x${r.mult}, draw ${r.edge})`); if (moved !== r.payout - amt) bad.push(`${g}: bag moved ${moved}, payout - stake is ${r.payout - amt}`);
}
check(`${all.length} plays across six tables: every draw in the band, every payout by the rule, the bag moved by exactly payout - stake`, !bad.length, bad.slice(0, 4).join(" | "));
check("a win pays TICKETS (and the draws differ from play to play)", all.some((r) => r.payout > r.bet) && new Set(all.map((r) => r.edge)).size > 5);
// a Mines board: one draw for the run, the ladder follows it, cashing pays round(stake x rung)
runs = []; const t0 = tix(); send({ t: "run", g: "mines", op: "start", amt: 1000, mines: 1 }); await wait(700); let picked = 0, over = null;
for (let i = 0; i < 25 && picked < 2 && !over; i++) { send({ t: "run", g: "mines", op: "pick", i }); await wait(450); const last = runs[runs.length - 1]; if (last?.over) over = last.over; else if (last?.run?.open?.length > picked) picked = last.run.open.length; }
if (!over) { const live = runs[runs.length - 1].run; send({ t: "run", g: "mines", op: "cash" }); await wait(700); over = runs[runs.length - 1].over; const fair = (k) => { let x = 1; for (let i = 0; i < k; i++) x *= (25 - i) / (24 - i); return x; }, e = live.mult / fair(picked);
  check(`Mines: the rung shown (${live.mult}x after ${picked}) is the fair price times a draw in the band`, e >= LO - 0.01 && e <= HI + 0.01, `implied ${e.toFixed(4)}`);
  check("Mines: cashing pays round(stake x that rung), in tickets", over?.how === "cash" && over.payout === Math.round(1000 * live.mult) && tix() - t0 === over.payout - 1000, JSON.stringify(over)); }
else check("Mines: hit the one bomb in two picks (1 in 12): the stake is gone and nothing else", tix() - t0 === -1000, `${tix() - t0}`);
ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

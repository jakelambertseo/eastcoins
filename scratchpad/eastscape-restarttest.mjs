/* Planned restarts: the announcement, the countdown, and — the part that
   matters — that every character is written before the sockets close.
   Run: node scratchpad/eastscape-restarttest.mjs */
import { World } from "../eastscape-worker/src/index.js";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  ok  " + n); } else { fail++; console.log("FAIL  " + n + (x ? "  -> " + x : "")); } };

function makeCtx(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { _map: map, blockConcurrencyWhile: (fn) => fn(), storage: {
    async get(k) { return map.get(k); },
    async put(a, b) { if (a && typeof a === "object") { for (const k in a) map.set(k, a[k]); } else map.set(a, b); },
    async delete(k) { return map.delete(k); },
    async list({ prefix = "" } = {}) { const o = new Map(); for (const [k, v] of map) if (k.startsWith(prefix)) o.set(k, v); return o; } } };
}
const WS = () => ({ sent: [], closed: null, send(m) { this.sent.push(typeof m === "string" ? JSON.parse(m) : m); }, addEventListener() {}, close(code, why) { this.closed = { code, why }; } });
const ENV = { DEV: "1", ALLOWED_ORIGINS: "", SITE: "" };
const said = (ws) => ws.sent.filter((m) => m.type === "say").map((m) => m.text);

async function world(n = 2) {
  const ctx = makeCtx(); const w = new World(ctx, ENV);
  await new Promise((r) => setTimeout(r, 0));
  const socks = [];
  for (let i = 0; i < n; i++) { const ws = WS(); socks.push(ws); await w.join({ id: `u${i}`, login: `p${i}`, name: `P${i}`, admin: true }, ws); }
  w.stop();
  return { w, ctx, socks };
}
// the server batches chat into pl.out and flushes on the tick; drain it by hand
const flush = (w) => { for (const pl of w.pls.values()) { for (const m of pl.out) w.send(pl, m); pl.out.length = 0; } };

console.log("\n-- announcing --");
{
  const { w, socks } = await world();
  await w.planRestart(300);
  flush(w);
  ok("a restart is pending", w.restartAt > Date.now() + 290000);
  ok("everyone is told", said(socks[0]).some((t) => /restarting in 5 minutes/i.test(t)), JSON.stringify(said(socks[0])));
  ok("both players are told", said(socks[1]).some((t) => /restarting/i.test(t)));
  ok("nobody has been closed yet", socks[0].closed === null);
}

console.log("\n-- the countdown warns once per threshold --");
{
  const { w, socks } = await world(1);
  await w.planRestart(300);
  socks[0].sent.length = 0;
  for (const pl of w.pls.values()) pl.out.length = 0;
  w.restartAt = Date.now() + 59000;            // slide to just under a minute
  for (let i = 0; i < 6; i++) w.restartTick(Date.now());
  flush(w);
  const warns = said(socks[0]).filter((t) => /restarting in/i.test(t));
  ok("warns for the thresholds now passed", warns.length >= 1, JSON.stringify(warns));
  ok("does not repeat a threshold", new Set(warns).size === warns.length, JSON.stringify(warns));
  const n = warns.length;
  for (let i = 0; i < 10; i++) w.restartTick(Date.now());
  flush(w);
  ok("and stays quiet after", said(socks[0]).filter((t) => /restarting in/i.test(t)).length === n);
}

console.log("\n-- cancelling --");
{
  const { w, socks } = await world(1);
  await w.planRestart(300);
  w.restartAt = 0; w.warned = null; w.tellAll("The restart is called off. Carry on.", "good");
  flush(w);
  ok("nothing is pending", !w.restartAt);
  ok("people are told", said(socks[0]).some((t) => /called off/i.test(t)));
  w.restartTick(Date.now());
  ok("the countdown does nothing", socks[0].closed === null);
}

console.log("\n-- the restart itself --");
{
  const { w, ctx, socks } = await world(3);
  // give one of them something unsaved, the case this whole feature exists for
  const pl = w.pls.get("u1");
  w.give(pl, "logs", 17);
  ok("it is unsaved before the restart", !ctx._map.get("char:u1"));

  await w.planRestart(0);

  ok("every character is written", ["char:u0", "char:u1", "char:u2"].every((k) => !!ctx._map.get(k)), JSON.stringify([...ctx._map.keys()]));
  const saved = ctx._map.get("char:u1");
  ok("including the unsaved change", saved.inv.some((s) => s.k === "logs" && s.n === 17), JSON.stringify(saved.inv));
  ok("the Exchange is written too", !!ctx._map.get("exchange"));
  ok("every page is told it is a restart", socks.every((s) => s.sent.some((m) => m.type === "restarting")));
  ok("with a hold to wait out", socks[0].sent.find((m) => m.type === "restarting").holdMs >= 10000);
  ok("and closed with the restart code", socks.every((s) => s.closed?.code === 4001), JSON.stringify(socks[0].closed));
}

console.log("\n-- an empty world still keeps its appointment --");
{
  const { w } = await world(0);
  await w.planRestart(120);
  ok("the tick is running with nobody on", w.timer !== null);
  w.tick();
  ok("and does not switch itself off", w.timer !== null);
  w.restartAt = 0; w.stop();
}

console.log("\n-- a failing write does not stop the rest --");
{
  const { w, ctx } = await world(3);
  let n = 0;
  const real = ctx.storage.put.bind(ctx.storage);
  ctx.storage.put = async (a, b) => { if (typeof a === "string" && a === "char:u1") throw new Error("disk gone"); return real(a, b); };
  const r = await w.saveAll();
  ok("the others are still saved", !!ctx._map.get("char:u0") && !!ctx._map.get("char:u2"));
  ok("and it reports without throwing", typeof r.saved === "number");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

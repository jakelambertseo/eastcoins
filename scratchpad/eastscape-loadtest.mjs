/* ============================================================
   EastScape load test — the world's own tick, with N players on it.

     node scratchpad/eastscape-loadtest.mjs [players] [seconds] [scenes]
     node scratchpad/eastscape-loadtest.mjs 100 30

   This drives the REAL World class in Node with storage and sockets
   stubbed, so what it measures is the game logic: how long a tick
   takes, how big the snapshots are, and how much the world sends per
   second. It does NOT measure Cloudflare, the network, or the edge —
   tools/eastscape-loadtest-ws.mjs does that half over real sockets.

   The number that matters is tick time against the 50ms budget: the
   world steps twenty times a second, and if a tick takes longer than
   50ms the world runs slow for everybody at once.
   ============================================================ */
import { World } from "../eastscape-worker/src/index.js";
import * as G from "../v3/assets/js/eastscape-shared.js";

const PLAYERS = Number(process.argv[2]) || 50;
const SECONDS = Number(process.argv[3]) || 20;
const SCENES = (process.argv[4] || "farm,river,forum,grove,tomato,appia").split(",");
const TICK_MS = 50;

const ctxMap = new Map();
let writes = 0, writeBytes = 0;
const ctx = {
  blockConcurrencyWhile: (fn) => fn(),
  storage: {
    async get(k) { return ctxMap.get(k); },
    async put(a, b) { if (a && typeof a === "object") { for (const k in a) { ctxMap.set(k, a[k]); writes++; writeBytes += JSON.stringify(a[k]).length; } } else { ctxMap.set(a, b); writes++; writeBytes += JSON.stringify(b).length; } },
    async delete(k) { return ctxMap.delete(k); },
    async list({ prefix = "", startAfter, limit = 1000 } = {}) { const o = new Map(); for (const k of [...ctxMap.keys()].sort()) { if (prefix && !k.startsWith(prefix)) continue; if (startAfter !== undefined && k <= startAfter) continue; if (o.size >= limit) break; o.set(k, ctxMap.get(k)); } return o; }
  }
};

let sent = 0, sentBytes = 0;
const sock = () => ({ send(m) { const s = typeof m === "string" ? m : JSON.stringify(m); sent++; sentBytes += s.length; }, addEventListener() {}, close() {} });

const rnd = (n) => Math.floor(Math.random() * n);
const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const kb = (n) => `${fmt(n / 1024)} KB`;

console.log(`\nEastScape load test — ${PLAYERS} players, ${SECONDS}s of world time, across ${SCENES.length} scene(s)\n`);

const w = new World(ctx, { DEV: "1", ALLOWED_ORIGINS: "", SITE: "" });
await new Promise((r) => setTimeout(r, 0));
w.stop();                                   // the test drives the tick by hand, at full speed

const joinStart = process.hrtime.bigint();
const players = [];
for (let i = 0; i < PLAYERS; i++) {
  const ws = sock();
  await w.join({ id: `load:${i}`, login: `bot${i}`, name: `Bot${i}`, admin: false }, ws);
  const pl = w.pls.get(`load:${i}`);
  // spread them over the world, the way a real evening looks
  const key = SCENES[i % SCENES.length];
  if (G.SCENES[key]) w.moveToScene(pl, key, null, null);
  players.push(pl);
}
w.stop();
const joinMs = Number(process.hrtime.bigint() - joinStart) / 1e6;
console.log(`joined ${PLAYERS} in ${fmt(joinMs)}ms (${fmt(joinMs / PLAYERS)}ms each)\n`);

// what a player does: mostly walk, sometimes swing at something, rarely talk
function act(pl) {
  const S = w.scene(pl.C.scene);
  const r = Math.random();
  if (r < 0.62) w.onMessage(pl, { t: "walk", x: 1 + rnd(G.COLS - 2), y: 1 + rnd(G.ROWS - 2) });
  else if (r < 0.90) {
    const live = S.mobs.filter((m) => !m.dead);
    if (live.length) w.onMessage(pl, { t: "act", kind: "mob", id: live[rnd(live.length)].id });
    else w.onMessage(pl, { t: "walk", x: 1 + rnd(G.COLS - 2), y: 1 + rnd(G.ROWS - 2) });
  } else if (r < 0.97) {
    const ob = S.objs.filter((o) => ["tree", "oak", "rock", "vein", "wheat", "spot"].includes(o.t));
    if (ob.length) w.onMessage(pl, { t: "act", kind: "obj", ob: ob[rnd(ob.length)].id ?? undefined, x: ob[rnd(ob.length)].x, y: ob[rnd(ob.length)].y });
  } else w.onMessage(pl, { t: "chat", text: "hello" });
}

const ticks = Math.round((SECONDS * 1000) / TICK_MS);
const times = [];
const t0 = process.hrtime.bigint();
for (let i = 0; i < ticks; i++) {
  // each player does something about every 1.5s, which is brisk for a person
  for (const pl of players) if (Math.random() < 0.033) { pl.msgWindow = 0; pl.msgs = 0; act(pl); }
  const a = process.hrtime.bigint();
  w.tick();
  times.push(Number(process.hrtime.bigint() - a) / 1e6);
}
const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;

times.sort((a, b) => a - b);
const at = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];
const mean = times.reduce((n, v) => n + v, 0) / times.length;
const over = times.filter((t) => t > TICK_MS).length;
const simSec = (ticks * TICK_MS) / 1000;

console.log("tick time (the 50ms budget)");
console.log(`  mean ${fmt(mean)}ms   p50 ${fmt(at(0.5))}ms   p95 ${fmt(at(0.95))}ms   p99 ${fmt(at(0.99))}ms   max ${fmt(times.at(-1))}ms`);
console.log(`  over budget: ${over} of ${ticks} ticks (${fmt((over / ticks) * 100)}%)`);
console.log(`  headroom at p95: ${fmt((1 - at(0.95) / TICK_MS) * 100)}%\n`);

console.log("what the world sends");
console.log(`  ${fmt(sent / simSec)} messages/s, ${kb(sentBytes / simSec)}/s total`);
console.log(`  per player: ${fmt(sent / simSec / PLAYERS)} msg/s, ${kb(sentBytes / simSec / PLAYERS)}/s`);
console.log(`  scenes live: ${w.scenes.size}\n`);

console.log("storage");
console.log(`  ${fmt(writes / simSec)} writes/s, ${kb(writeBytes / simSec)}/s`);
console.log(`  a character is ${kb(JSON.stringify(players[0].C).length)}\n`);

const mem = process.memoryUsage();
console.log(`memory: heap ${kb(mem.heapUsed)} for ${PLAYERS} players and ${w.scenes.size} scenes (${kb(mem.heapUsed / PLAYERS)} each)`);
console.log(`ran ${simSec}s of world in ${fmt(wallMs / 1000)}s wall clock — ${fmt(simSec / (wallMs / 1000))}x real time\n`);

const verdict = at(0.95) < TICK_MS * 0.5 ? "comfortable" : at(0.95) < TICK_MS ? "tight — watch it" : "OVER BUDGET: the world will run slow for everyone";
console.log(`verdict at ${PLAYERS} players: ${verdict}\n`);
process.exit(over / ticks > 0.01 ? 1 : 0);

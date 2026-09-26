/* DO DUNGEON RUNS SURVIVE A RESTART? —  node tools/eastscape-runs-test.mjs
   (2026-09-27) Four people were in the Count Room when a deploy landed; the run lived only in memory, so they came back
   to the door with the ante refunded and no pay. The real World with storage stubbed: a run is started, worked, written,
   a SECOND World is built over the same storage (which is what a deploy is), and the run is expected to be there with
   its quota, its monsters (dead ones still dead - JSON turns Infinity into null), its open gates and its party. Then
   the run is finished in the new world and it pays. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const is = (got, want, what) => { if (got === want) console.log(`  ${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const store = new Map();
const mkCtx = () => { const ctx = { storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); }, delete: async (k) => { store.delete(k); }, list: async () => new Map() } };
  ctx.blockConcurrencyWhile = (fn) => { ctx.ready = fn(); ctx.ready.catch(() => {}); return ctx.ready; }; return ctx; };
const boot = async () => { const ctx = mkCtx(); const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await ctx.ready; W.save = async () => {}; return W; };
const mk = (W, id, scene, x, y) => { const C = G.freshChar(); C.scene = scene; C.x = x; C.y = y; for (const sk of ["melee", "hp"]) C.xp[sk] = G.XP_AT[60]; G.addInv(C.inv, "tickets", 20000, C);
  const A = { id, login: id, name: id, admin: true, role: "admin", ws: { send() {} }, C, x, y, path: [], out: [], joinedAt: Date.now(), lastInput: Date.now() }; W.pls.set(id, A); return A; };
const said = (A) => A.out.filter((o) => o.type === "say").map((o) => String(o.text || ""));
const CN = World.rules?.count || null;

/* ---------------- 1. the Count Room, solo as an admin (the same door a party uses) */
const W1 = await boot();
const casino = W1.scene("casino");
const a = mk(W1, "a", "casino", 12, 18);
W1.countEnter(casino, a);
const ckey = String(a.C.scene);
is(ckey.startsWith("count:"), true, "a run opened and the player is inside");
const S1 = W1.scenes.get(ckey);
let now = Date.now();
for (let i = 0; i < 12; i++) { now += 3000; W1.countSpawn(S1, now); }
is(S1.mobs.length > 0, true, "the doors have let some of the house out");
for (const m of S1.mobs.slice(0, 5)) W1.countKill(S1, a, m, now);
is(S1.run.done, 5, "five counted toward the quota");
const before = { done: S1.run.done, quota: S1.run.quota, mobs: S1.mobs.length, dead: S1.mobs.filter((m) => m.dead).length, keys: S1.run.keys };
/* a locker searched, so the run has state beyond the count */
const locker = S1.objs.find((o) => o.t === "countsearch" && S1.run.spots[o.spot]); W1.countSearch(S1, a, locker);
is(S1.run.keys, 1, "a key found in a locker");
await W1.runsSave(true);
is(!!store.get("runs"), true, "the run was written to storage");
is(store.get("runs").runs[0].mobs.some((m) => m.respawnAt === null), true, "(and JSON did turn a dead monster's Infinity into null)");

/* ---------------- 2. the restart: a new World over the same storage */
const W2 = await boot();
const S2 = W2.scenes.get(ckey);
is(!!S2?.run, true, "the run is there in the new world");
is(S2.run.done, before.done, "the quota count survived");
is(S2.run.quota, before.quota, "and the quota");
is(S2.run.keys, 1, "and the key in hand");
is(S2.mobs.length, before.mobs, "every monster is back");
is(S2.mobs.filter((m) => m.dead).length, before.dead, "the dead ones are still dead");
is(S2.mobs.every((m) => m.respawnAt === Infinity), true, "and none of them will respawn (Infinity restored)");
/* the player reconnects: their saved scene is the run, and countRejoin must keep them in it rather than send them to the door */
const a2 = mk(W2, "a", ckey, a.x, a.y);
W2.countRejoin(a2);
is(String(a2.C.scene), ckey, "the reconnecting player stays in the run");
is(/back in the count room/.test(a2.afterJoin?.[0] || ""), true, "and is told so");
W2.countHello(a2, S2);
/* the run goes on: finish the quota and the floor, then walk out and get paid */
for (let guard = 0; guard < 400 && !S2.run.met; guard++) { now += 3000; W2.countSpawn(S2, now); for (const m of S2.mobs) if (!m.dead) W2.countKill(S2, a2, m, now); }
is(S2.run.met, true, "the quota was met in the new world");
for (const m of S2.mobs) if (!m.dead) W2.countKill(S2, a2, m, now);
W2.countTick(now);
is(S2.run.open, true, "the way out opened");
const tixBefore = G.tixIn(a2.C);
W2.countExit(S2, a2, S2.objs.find((o) => o.t === "countexit" && !o.bolt));
is(G.tixIn(a2.C) > tixBefore, true, `the job paid (${G.tixIn(a2.C) - tixBefore} tickets)`);
is(String(a2.C.scene), "casino", "and they are back on the floor");
is(a2.out.some((o) => o.type === "countwon"), true, "the OUT CLEAN banner was sent");

/* ---------------- 3. the Crypt: an open gate is open again, the party is remembered, a member marked away */
const W3 = await boot();
const yard = W3.scene("workyard");
const b = mk(W3, "b", "workyard", 35, 12), c = mk(W3, "c", "workyard", 35, 12);
W3.parties ||= new Map(); W3.parties.set("p1", { id: "p1", leader: "b", members: ["b", "c"] }); b.party = "p1"; c.party = "p1";
W3.cryptEnter(yard, b, { tier: 1 });
const kkey = String(b.C.scene);
is(kkey.startsWith("crypt:"), true, "a crypt run opened for the party");
const K1 = W3.scenes.get(kkey);
W3.cryptOpenGate(K1, 0);
const gate = K1.objs.find((o) => o.t === "cryptgate" && o.gate === 0);
is(K1.g[gate.y][gate.x], "i", "the first gate is open");
await W3.runsSave(true);
const W4 = await boot();
const K2 = W4.scenes.get(kkey);
is(!!K2?.run, true, "the crypt run is there after the restart");
is(K2.run.gates[0], true, "the gate is recorded open");
is(K2.g[gate.y][gate.x], "i", "and the grid lets you through it");
is(K2.mobs.filter((m) => G.MOBS[m.t]?.boss).length, 1, "the Hoodie is down there");
const pt = W4.parties.get("p1");
is(pt?.members.join(","), "b,c", "the party is remembered");
is(!!pt?.away?.b && !!pt?.away?.c, true, "and both members are marked away until they reconnect");
const b2 = mk(W4, "b", kkey, b.x, b.y);
W4.cryptRejoin(b2);
is(String(b2.C.scene), kkey, "a member reconnecting is back in the crypt");
W4.cryptHello(b2, K2);
is(b2.party, "p1", "and back in the party");
is(!pt.away.b, true, "no longer away");

/* ---------------- 4. a snapshot older than ten minutes is left alone */
const old = store.get("runs"); store.set("runs", { ...old, at: Date.now() - 11 * 60 * 1000 });
const W5 = await boot();
is(W5.scenes.has(kkey), false, "a stale snapshot restores nothing");

/* ---------------- 5. the idle sweep leaves a run alone */
const W6 = await boot();
const S6 = W6.scene("count:test1"); S6.run = { members: ["zz"], started: Date.now(), quota: 60, done: 0, kills: {}, died: {}, keys: 0, found: 0, spots: {}, searched: {}, boxes: [false, false, false, false], open: false, paid: {}, nextSpawn: 0, doorAt: 0, seq: 0 };
S6.idleSince = Date.now() - 10 * 60 * 1000;
W6.tickN = 1; W6.tick();
is(W6.scenes.has("count:test1"), true, "the two-minute idle sweep does not take a run (its own clock does)");

console.log(bad ? `\n${bad} problem(s)` : "\na run survives a restart: the count, the dead, the gates, the party and the pay");
process.exitCode = bad ? 1 : 0;

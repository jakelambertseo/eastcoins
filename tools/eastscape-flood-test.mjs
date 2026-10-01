/* THE FLOOD —  node tools/eastscape-flood-test.mjs
   (2026-09-30) The real World, storage kept in a Map, the real raid tick, hand-in and step:
     - an admin starts it; after the warning the five sandbag spots stand on dry land beside the water, none on the dock;
     - THE DOCK (the Tinkerer's project, built here at tier 3): its planks never flood, the map's own grid is never edited, and its three
       fishing spots are still where they were;
     - the water only ever takes the west bank's ground, it slows a player who wades, and the page's own prediction uses the same number;
     - a sandbag spot takes only what it asks for, never a favourite, counts toward the share, and once full drains the water round it;
     - all five held: the Undertow climbs out; beat him and everybody is paid (haulers too) and the water is gone;
     - a restart mid-flood brings back the water, the spots and their counts;
     - a loss: the water reaches half the west bank, the stalls board up, the water stays, and both go when the time's out. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
G.setProjects({ dock: 3 });
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const mem = new Map(), ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => mem.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) mem.set(a, structuredClone(b)); else mem.set(k, structuredClone(v)); }, delete: async (k) => { mem.delete(k); }, list: async () => new Map() } };
const make = async () => { const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; clearInterval(W.timer); const said = []; W.houseSay = (t) => said.push(t); return { W, said }; };
let { W, said } = await make();
const S = W.scene("workyard"), F = G.FLOOD, COLS = G.COLS;
let n = 0;
const player = (W, x, y, lvl = 60) => { const C = G.freshChar(); C.inv = []; C.scene = "workyard"; for (const k of ["hp", "melee", "defence"]) C.xp[k] = G.XP_AT[lvl]; C.hp = G.maxHpOf(C); C.eq.weapon = "onyx_sword";
  const id = `f${++n}`, pl = { id, login: id, name: `Hauler${n}`, role: "admin", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, pl); return pl; };
const grid0 = JSON.stringify(S.g), dockSpots = S.objs.filter((o) => o.proj === "dock" && o.t === "spot").map((o) => [o.x, o.y]);
const a = player(W, 12, 20), b = player(W, 22, 17), c = player(W, 23, 9);
/* 1. start */
W.raidAdmin(S, a, "flood", () => {});
is([W.raid?.kind, W.raid?.phase, said.some((x) => /FLOOD!/.test(x))], ["flood", "warn", true], "an admin starts it: a warning in CASINO's voice");
let t = W.raid.at; W.raidTick(t);
const bags = S.mobs.filter((m) => m.bag);
is([W.raid.phase, bags.length, bags.every((m) => S.g[m.y][m.x] === "." && !(m.x >= 16 && m.x <= 17 && m.y >= 18 && m.y <= 21)), said.some((x) => /OVER THE BANK/.test(x))], ["on", 5, true, true], "it comes over: five sandbag spots, all on dry ground, none on the dock");
/* 2. the water: west bank ground only, never the dock, the map untouched */
for (let i = 0; i < 40; i++) { t += F.riseMs; W.raidTick(t); }
const tiles = [...S.flood].map((i) => [i % COLS, Math.floor(i / COLS)]);
is([S.flood.size > 0, tiles.every(([x, y]) => x <= G.RAID.zoneX && ".,".includes(S.g[y][x])), tiles.some(([x, y]) => x >= 16 && x <= 17 && y >= 18 && y <= 21), JSON.stringify(S.g) === grid0, JSON.stringify(S.objs.filter((o) => o.proj === "dock" && o.t === "spot").map((o) => [o.x, o.y])) === JSON.stringify(dockSpots)],
  [true, true, false, true, true], `the water (${S.flood.size} tiles): only the west bank's ground, never the dock's planks; the map and the dock's three fishing spots untouched`);
/* 3. wading is slower, on the server, by the same number the page uses */
{ let wx, wy, dry = null; for (const [tx, ty] of tiles) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = tx + dx, y = ty + dy; if (G.walkableIn(S.g, x, y) && !S.flood.has(y * COLS + x)) { dry = [x, y]; break; } } if (dry) { wx = tx; wy = ty; break; } }
  const p = player(W, wx, wy);
  if (!dry) { bad++; console.log("  !! no flooded tile with a dry neighbour to test wading"); }
  if (dry) { p.x = dry[0]; p.y = dry[1]; p.path = [{ x: wx, y: wy }]; p.step = null; W.stepEntity(S, p, Date.now(), true); const wet = p.step?.ms;
    p.x = wx; p.y = wy; p.path = [{ x: dry[0], y: dry[1] }]; p.step = null; W.stepEntity(S, p, Date.now(), true); const out = p.step?.ms;
    is([wet > out, Math.round(wet / out * 10) / 10], [true, F.slow], "stepping into water takes FLOOD.slow times as long as stepping out"); }
  W.pls.delete(p.id); }
/* 4. a sandbag spot */
const Rd = W.raid, sp0 = Rd.spots[0], bag0 = S.mobs.find((m) => m.bag && m.spot === 0), M0 = G.FLOOD_MATS[sp0.mat];
const want = sp0.mat === "wood" ? "logs" : sp0.mat === "ore" ? "copper" : "sand", wrong = sp0.mat === "sand" ? "logs" : "sand";
a.x = bag0.x - 1; a.y = bag0.y; G.addInv(a.C.inv, wrong, 50, a.C); a.out = [];
a.act = { kind: "mob", id: bag0.id }; W.floodBag(S, a, bag0, a.act, Date.now());
is([sp0.got, a.out.some((o) => /wants/.test(o.text || ""))], [0, true], `a spot that wants ${M0.name} takes nothing else, and says what it wants`);
G.addInv(a.C.inv, want, 40, a.C); a.C.fav = [want]; W.floodBag(S, a, bag0, a.act, Date.now());
is(sp0.got, 0, "a favourited stack is never handed in");
a.C.fav = []; W.floodBag(S, a, bag0, a.act, Date.now());
is([sp0.got, G.countItems({ inv: a.C.inv, bank: [] }, [want]), Rd.by[a.id], bag0.nm.includes("40/")], [40, 0, 40 * F.handValue, true], "40 handed in: off the bag, onto the spot, and 40 × FLOOD.handValue onto the share");
G.addInv(a.C.inv, want, sp0.need, a.C); W.floodBag(S, a, bag0, a.act, Date.now());
const [sx, sy] = F.spots[0].at, near = [...S.flood].filter((i) => Math.max(Math.abs(i % COLS - sx), Math.abs(Math.floor(i / COLS) - sy)) <= F.protect).length;
is([sp0.held, sp0.got, near, G.countItems({ inv: a.C.inv, bank: [] }, [want])], [true, sp0.need, 0, 40], "filled: held, only what it needed was taken, and the water round it drained");
for (let i = 0; i < 20; i++) { t += F.riseMs; W.raidTick(t); }
is([...S.flood].filter((i) => Math.max(Math.abs(i % COLS - sx), Math.abs(Math.floor(i / COLS) - sy)) <= F.protect).length, 0, "and it stays dry while the rest of the water keeps rising");
/* 5. a restart mid-flood */
W.raidSave(Date.now(), true);
const before = { water: S.flood.size, held: Rd.spots.filter((x) => x.held).length, got: Rd.spots.map((x) => x.got) };
({ W, said } = await make());
const S2 = W.scene("workyard"); W.pls.set(a.id, a); W.raidTick(Date.now());
is([W.raid?.kind, S2.flood?.size >= before.water, S2.mobs.filter((m) => m.bag).length, W.raid.spots.map((x) => x.got), said.some((x) => /CARRIES ON/.test(x))], ["flood", true, 5, before.got, true], "a restart: the water, the five spots and every count come back, and CASINO says so");
/* 6. all five held: the Undertow, and a win */
const Rd2 = W.raid;
for (const sp of Rd2.spots) if (!sp.held) { const m = S2.mobs.find((x) => x.bag && x.spot === sp.i), p = player(W, m.x - 1, m.y), k = sp.mat === "wood" ? "logs" : sp.mat === "ore" ? "copper" : "sand"; G.addInv(p.C.inv, k, sp.need, p.C); W.floodBag(S2, p, m, { kind: "mob", id: m.id }, Date.now()); }
const boss = S2.mobs.find((m) => m.t === "undertow");
is([Rd2.spots.every((x) => x.held), Rd2.drain, !!boss, boss && [boss.x, boss.y].join(","), said.some((x) => /THE UNDERTOW/.test(x))], [true, true, true, F.boss.at.join(","), true], "all five held: the water turns, and the Undertow climbs out where it should");
for (let i = 0; i < 300 && S2.flood.size; i++) { W.raidTick(Date.now() + i * F.riseMs + 10 * 60000 * 0); Rd2.nextRise = 0; }
is(S2.flood.size, 0, "and the water goes all the way down");
const fighter = player(W, boss.x - 1, boss.y, 99); Rd2.by[fighter.id] = 5000;
const tix0 = { a: G.tixIn(a.C), f: G.tixIn(fighter.C) }; boss.hp = 1;
fighter.C.eq.weapon = "singularity_sword"; for (let i = 0; i < 40 && S2.mobs.includes(boss); i++) { fighter.act = { kind: "mob", id: boss.id, x: boss.x, y: boss.y, started: 1 }; fighter.lastSwing = 0; fighter.path = []; fighter.lastInput = Date.now(); W.doAction(S2, fighter, Date.now() + i * 3000); }
is([W.raid, S2.mobs.some((m) => m.raid), G.tixIn(a.C) > tix0.a, G.tixIn(fighter.C) > tix0.f, !!S2.flood?.size, said.some((x) => /UNDERTOW IS BEATEN/.test(x))], [null, false, true, true, false, true], "a win: the raid's over, the hauler and the fighter both paid, the Yard dry, CASINO says so");
/* 7. a loss: the water takes half the west bank */
({ W, said } = await make());
const S3 = W.scene("workyard"); const z = player(W, 12, 20); W.raidAdmin(S3, z, "flood", () => {}); let t3 = W.raid.at; W.raidTick(t3);
for (let i = 0; i < 2000 && W.raid; i++) { t3 += F.riseMs; W.raid.until = t3 + 60000; W.raidTick(t3); }
const L = F.loss, court = [...S3.flood].filter((i) => i % COLS >= L.courtX[0] && i % COLS <= L.courtX[1] && "pP".includes(S3.g[Math.floor(i / COLS)][i % COLS]));
is([W.raid, W.raidSack?.kind, Math.round((W.raidSack.until - t3) / 60000), S3.flood?.size > 0, court.length > 0, said.some((x) => /UNDER WATER/.test(x))], [null, "flood", 20, true, true, true], "a loss: the water stays twenty minutes, and takes the west half of the court too");
is([["counter", "eggtrade", "ex", "hw", "order"].map((op) => W.raidClosed(op))], [[true, true, true, true, true]], "Bom, Nestor, Livia, Hexa and Bronny are shut for those twenty minutes");
W.raidSack.until = Date.now() - 1; W.raidTick(Date.now());
is([W.raidSack, S3.flood, said.some((x) => /receding, finally/.test(x))], [null, null, true], "twenty minutes on: the water is receding, finally, and the stalls open");
console.log(bad ? `\n${bad} problem(s)` : "\nThe Flood holds: the water keeps off the dock, wading is slower, sandbags fill and drain, a restart keeps it, a win pays the haulers, a loss floods the Yard");
process.exitCode = bad ? 1 : 0;

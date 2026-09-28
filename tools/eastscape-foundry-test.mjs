/* DOES THE FOUNDRY WORK? —  node tools/eastscape-foundry-test.mjs
   (2026-09-27) The real World with storage stubbed: the map opens off the Thunderhead's south edge (and the Thunderhead's south door is
   walkable), every open tile is reachable from that door, every monster stands on floor (Old Bessemer on lava, within his own reach of
   it), the veins and the blast furnace are real objects on blocked tiles, the blast furnace serves every furnace recipe with one bar
   and half as much xp again, Basalt's quests are wired, every drop is an item, and the pay sits in the band. */
import "./eastscape-open-all.mjs";   /* the map ships held (HOLD); this test opens it */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("foundry"), T = W.scene("thunderhead");
is(G.SCENES.thunderhead.exits.s, "foundry", "south of the Thunderhead is the Foundry (the Works)"); is(G.SCENES.foundry.exits.n, "thunderhead", "and the Works' north edge is the Thunderhead");
const walkIn = (g) => (x, y) => G.walkableIn(g, x, y);
const reach = (g, sx, sy) => { const walk = walkIn(g), seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const nx = x + dx, ny = y + dy, k = ny * G.COLS + nx; if (!seen.has(k) && nx >= 0 && ny >= 0 && nx < G.COLS && ny < G.ROWS && walk(nx, ny) && (!dx || !dy || (walk(x + dx, y) && walk(x, y + dy)))) { seen.add(k); q.push([nx, ny]); } } } return seen; };
const walk = walkIn(S.g);
is(T.g[G.ROWS - 1][22], "e", "the Thunderhead's south door is a door"); is(reach(T.g, 22, G.ROWS - 1).has(10 * G.COLS + 22), true, "and it reaches the Thunderhead's altar");

/* (2026-09-27) THE SEVEN AREAS. Each is open, has no bank tiles (the picture is the ground), and every open tile in it is reachable from
   where people arrive; every edge door leads somewhere that sends you back; every portal and the burning door land on floor. */
const AREAS = ["foundry", ...G.FD_AREAS];
is(G.FD_AREAS.length, 6, "six areas besides the Works"); is(AREAS.every((k) => G.OPEN.has(k)), true, "all seven open together");
const SC = Object.fromEntries(AREAS.map((k) => [k, W.scene(k)]));
for (const k of AREAS) {
  const A = SC[k], d = G.SCENES[k], wk = walkIn(A.g);
  if (A.g.flat().includes("b")) fail(`${k} has bank tiles`);
  const start = Object.values(d.arrive || {})[0] || (() => { const v = SC[G.FD_AREAS.find((x) => G.buildScene(x).objs.some((o) => o.row?.to === k))]; const o = v && G.buildScene(v.key).objs.find((q) => q.row?.to === k); return o && { x: o.row.x, y: o.row.y }; })();
  let open = 0; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (wk(x, y)) open++;
  const r = reach(A.g, start.x, start.y); if (r.size !== open) fail(`${k}: ${open - r.size} open tiles cannot be reached from ${start.x},${start.y}`); else ok(`${k} (${d.name}): all ${open} open tiles reachable`);
  for (const [side, to] of Object.entries(d.exits || {})) {
    if (!A.g.some((row, y) => row.some((c, x) => c === "e" && (side === "n" ? y === 0 : side === "s" ? y === G.ROWS - 1 : side === "w" ? x === 0 : x === G.COLS - 1)))) fail(`${k}: no door on its ${side} edge`);
    if (to !== "thunderhead" && !Object.values(G.SCENES[to].exits || {}).includes(k) && !SC[to].objs.some((o) => o.row?.to === k)) fail(`${k} -> ${to}, but ${to} has no way back`);   /* (the Gate's way into the Hall is its burning door) */
    const at = d.arrive?.[side]; if (!at || !wk(at.x, at.y)) fail(`${k}: arriving from the ${side} lands on nothing`);
  }
  for (const o of A.objs.filter((q) => q.row)) { const to = SC[o.row.to]; if (!to || !walkIn(to.g)(o.row.x, o.row.y)) fail(`${k}'s ${o.name} lands on nothing in ${o.row.to}`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (wk(x, y)) near = Math.min(near, G.cheb({ x, y }, o)); if (near > 1) fail(`${k}'s ${o.name} cannot be walked up to`); }
  for (const m of A.mobs) if (!m.perch && !wk(m.hx, m.hy)) fail(`${k}: ${m.t} at ${m.hx},${m.hy} stands on nothing`);
}
is(G.SCENES.fd_gate.arrive.n && walkIn(SC.fd_gate.g)(G.SCENES.fd_gate.arrive.n.x, G.SCENES.fd_gate.arrive.n.y), true, "walking back out of the Hall puts you in front of the burning door");
{ const all = AREAS.flatMap((k) => SC[k].mobs), n = (t) => all.filter((m) => m.t === t).length;
  is([n("slaggolem"), n("furnaceimp"), n("cinderelemental"), n("bessemer")], [5, 5, 5, 1], "five of each across seven areas, and Old Bessemer"); }
is(S.npcs.some((n) => n.name === "Basalt"), true, "Basalt is in the Works"); if (!walk(S.npcs[0].x, S.npcs[0].y)) fail("Basalt stands on nothing");
for (const q of ["fdslag", "fdimps", "fdbessemer"]) if (!G.QUESTS[q]?.stages?.length || !S.npcs[0].quests.includes(q)) fail(`quest ${q}`);
const kinds = ["bessemer", "cinderelemental", "furnaceimp", "slaggolem"];
for (const m of kinds) for (const [k] of [...G.MOBS[m].drops, ...(G.MOBS[m].rare || [])]) if (!G.ITEMS[k]) fail(`${m} drops ${k}, which is not an item`);
for (const k of ["slag", "emberglass", "tally"]) if (!(G.VALUE[k] > 0)) fail(`${k} has no price`);
const veins = AREAS.flatMap((k) => SC[k].objs.filter((o) => o.t === "rock" && o.ore).map((o) => ({ ...o, area: k })));
is(veins.map((v) => v.ore).sort().join(","), Array(4).fill("eclipse_ore").concat(Array(3).fill("nova_ore"), Array(2).fill("singularity_ore")).join(","), "four Eclipse, three Nova, two Singularity, spread over the areas");
for (const o of [...veins, ...S.objs.filter((q) => q.t === "blast").map((q) => ({ ...q, area: "foundry" }))]) { const A = SC[o.area], wk = walkIn(A.g); if (A.g[o.y][o.x] !== "#") fail(`${o.name} in ${o.area} is not on a blocked tile`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (wk(x, y)) near = Math.min(near, G.cheb({ x, y }, o)); if (near > 1) fail(`${o.name} in ${o.area} cannot be walked up to`); }
is(S.objs.filter((o) => o.t === "blast").length, 1, "one blast furnace, in the Works");
const furnace = G.recipesAt("furnace").map((r) => r.id).sort(), blast = G.recipesAt("blast").map((r) => r.id).sort();
is(blast.join(","), [...furnace, "blast_eclipse", "blast_nova"].sort().join(","), "the blast furnace serves every furnace recipe, and its own two slag batches"); is(G.STATIONS.blast.nexus && G.STATIONS.blast.boost.mult === 1 && G.STATIONS.blast.boost.xp === 1.5, true, "one bar, half as much xp again");

/* THE GIANT: an open boss, reach three, perched in front of the wall with floor within his reach */
{ const H = SC.fd_hall, m = H.mobs.find((x) => x.t === "bessemer"), wk = walkIn(H.g); is(G.MOBS.bessemer.open && G.BOSSES.has("bessemer") && G.MOBS.bessemer.range === 3 && m.perch, true, "Old Bessemer is the Hall's open boss, perched, with reach three");
  let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (wk(x, y)) near = Math.min(near, G.cheb({ x, y }, m)); is(near <= 3, true, "and there is floor within his reach to fight him from"); }

/* THE TRAPS: one of each of the six, each on its own area; a player on a strike tile is hit once a strike, for TRAP_HIT of their health; a
   player beside it is not; nobody is hit while it only warns */
{ const traps = AREAS.flatMap((k) => SC[k].objs.filter((o) => o.t === "trap").map((o) => [k, o]));
  is(traps.map(([, o]) => o.trap).sort().join(","), "burn,crush,geyser,spikes,spit,volc", "one of each of the six traps");
  is(new Set(traps.map(([k]) => k)).size, 6, "each in its own area");
  for (const [k, o] of traps) {
    const A = SC[k], wk = walkIn(A.g), T0 = G.TRAPS[o.trap];
    let t = 1e12; while (G.trapPhase(o, t).phase !== "strike") t += 50; const cyc = G.trapPhase(o, t).cycle;
    const cells = G.trapCells(o, cyc).filter(([x, y]) => wk(x, y)); if (!cells.length) { fail(`${k}'s ${o.trap} covers no floor`); continue; }
    const C = G.freshChar(); C.scene = k; C.hp = G.maxHpOf(C);
    const pl = { id: "trap" + o.trap, name: "t", C, x: cells[0][0], y: cells[0][1], out: [], path: [] }; W.pls.set(pl.id, pl);
    const safe = (() => { for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (wk(x, y) && !G.trapCells(o, cyc).some(([a, b]) => a === x && b === y)) return [x, y]; })();
    const pl2 = { id: "safe" + o.trap, name: "s", C: { ...G.freshChar(), scene: k }, x: safe[0], y: safe[1], out: [], path: [] }; pl2.C.hp = G.maxHpOf(pl2.C); W.pls.set(pl2.id, pl2);
    const warnT = t - T0.warn + 10, h0 = C.hp; A.trapHits = new Map(); W.trapsTick(A, warnT);
    const h1 = C.hp; W.trapsTick(A, t); const h2 = C.hp; W.trapsTick(A, t + 40); const h3 = C.hp;
    const want = Math.max(1, Math.round(G.maxHpOf(C) * G.TRAP_HIT * (1 - G.fxOf(C).tough)));
    is([h0 - h1, h1 - h2, h2 - h3, pl2.C.hp === G.maxHpOf(pl2.C), pl.out.some((e) => e.type === "say" || e.type === "msg" || e.text)], [0, want, 0, true, true], `${k}'s ${T0.name}: nothing while it warns, ${want} on the strike, once, and not beside it`);
    W.pls.delete(pl.id); W.pls.delete(pl2.id);
  }
  const V = SC.fd_gate.objs.find((o) => o.trap === "volc"), picks = new Set(); for (let c = 0; c < 40; c++) for (const [x, y] of G.trapCells(V, c)) picks.add(`${x},${y}`);
  is([...picks].every((xy) => { const [x, y] = xy.split(",").map(Number); return walkIn(SC.fd_gate.g)(x, y); }) && picks.size > 10, true, "the volcano's balls land on the causeway, different tiles each cycle"); }
is(G.BANDS.foundry.join("-"), "76-86", "the Works' band"); is(G.BANDS.fd_hall.join("-"), "84-90", "and the Hall's, the highest");
is(G.FUNG_WILD.foundry?.length, 3, "three wild mushroom clusters"); is(S.objs.filter((o) => o.t === "shroom").length, 3, "and they stand on the map");
is(G.EGGS.egg_cindered.from.includes("foundry"), true, "a Cindered egg can turn up here");
/* (2026-09-27, the owner's picks: "Smithing uses", "Smithing piece", "Lower to ~1%") */
is([G.MOBS.slaggolem.drops.find(([k]) => k === "sapphire")[2], G.MOBS.cinderelemental.drops.find(([k]) => k === "opal")[2]], [0.01, 0.01], "their jewels are 1% now");
for (const k of ["slag", "emberglass"]) is(Object.values(G.RECIPES).some((r) => r.in.some(([i]) => i === k)), true, `${k} goes into a recipe`);
is([G.RECIPES.blast_eclipse.out, G.RECIPES.blast_nova.out, G.RECIPES.blast_eclipse.station], [["eclipse_bar", 3], ["nova_bar", 3], "blast"], "slag makes a third bar, at the blast furnace only");
is(G.ITEMS.pot_ember?.drink?.fx, { tough: 0.12, heal: 0.2 }, "emberglass brews the Emberglass tonic");
/* Basalt buys tallies, through the real talk */
{ const C = G.freshChar(), b = S.npcs.find((x) => x.name === "Basalt"), pl = { id: "tally", name: "t", C, x: b.x + 1, y: b.y, out: [], path: [] }; W.pls.set(pl.id, pl); C.scene = "foundry";
  G.addInv(C.inv, "tally", 7, C); const before = G.countItems(C, ["tickets"]);
  pl.act = { kind: "npc", id: b.id, x: b.x, y: b.y, started: 0 }; W.doAction(S, pl, Date.now());
  is([G.countItems(C, ["tally"]), G.countItems(C, ["tickets"]) - before, pl.out.some((e) => e.type === "talk")], [0, 1050, true], "Basalt takes seven tallies for 1,050 tickets, and the conversation still opens"); }
/* Bessemer's Gauntlets */
{ const g = G.ITEMS.bessemergloves; is([g.slot, g.chase, g.req.skill, G.MOBS.bessemer.drops.some(([k, , p]) => k === "bessemergloves" && p === 0.01)], ["gloves", "ember", "smithing", true], "Old Bessemer's chase: gloves, one kill in a hundred");
  const C = { eq: { gloves: "bessemergloves" } }; is([G.fxOf(C).smelt, G.fxOf(C).forge], [0.15, 0.1], "worn: 15% double bars, +10% reforge odds");
  const src = (await import("fs")).readFileSync(new URL("../eastscape-worker/src/index.js", import.meta.url), "utf8");
  is([/G\.fxOf\(C\)\.smelt/.test(src), /\+ G\.fxOf\(C\)\.forge\)/.test(src)], [true, true], "the server reads both where a bar is handed over and where the anvil rolls"); }
console.log(bad ? `\n${bad} problem(s)` : "\nthe Foundry works: seven areas and their doors and portals, the veins, the blast furnace, six traps, the Giant, Basalt's quests");
process.exitCode = bad ? 1 : 0;

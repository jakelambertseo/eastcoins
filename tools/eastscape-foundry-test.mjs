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
is(G.SCENES.thunderhead.exits.s, "foundry", "south of the Thunderhead is the Foundry"); is(G.SCENES.foundry.exits.n, "thunderhead", "and the Foundry's north edge is the Thunderhead"); is(G.OPEN.has("foundry"), true, "it is open");
const walkIn = (g) => (x, y) => G.walkableIn(g, x, y);
const reach = (g, sx, sy) => { const walk = walkIn(g), seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const nx = x + dx, ny = y + dy, k = ny * G.COLS + nx; if (!seen.has(k) && nx >= 0 && ny >= 0 && nx < G.COLS && ny < G.ROWS && walk(nx, ny) && (!dx || !dy || (walk(x, ny) && walk(nx, y)))) { seen.add(k); q.push([nx, ny]); } } } return seen; };
const walk = walkIn(S.g);
let open = 0; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) open++;
is(reach(S.g, 22, 0).size, open, `every open tile is reachable from the north door (${open})`);
is(T.g[G.ROWS - 1][22], "e", "the Thunderhead's south door is a door"); is(reach(T.g, 22, G.ROWS - 1).has(10 * G.COLS + 22), true, "and it reaches the Thunderhead's altar");
is(S.g.flat().includes("b"), false, "no bank tiles: the picture is the ground");
for (const m of S.mobs) if (!m.perch && !walk(m.hx, m.hy)) fail(`${m.t} at ${m.hx},${m.hy} stands on nothing`);
for (const m of S.mobs.filter((x) => x.perch)) { if (S.g[m.hy][m.hx] !== "~") fail(`${m.t} at ${m.hx},${m.hy} is not over lava`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, m)); if (near > (G.MOBS[m.t].range || 1)) fail(`${m.t} at ${m.hx},${m.hy} cannot be reached even by its own range (${near})`); }
const kinds = [...new Set(S.mobs.map((m) => m.t))].sort(); is(kinds.join(","), "bessemer,cinderelemental,furnaceimp,slaggolem", "four kinds of monster");
is(S.npcs.some((n) => n.name === "Basalt"), true, "Basalt is by the gate"); if (!walk(S.npcs[0].x, S.npcs[0].y)) fail("Basalt stands on nothing");
for (const q of ["fdslag", "fdimps", "fdbessemer"]) if (!G.QUESTS[q]?.stages?.length || !S.npcs[0].quests.includes(q)) fail(`quest ${q}`);
for (const m of kinds) for (const [k] of [...G.MOBS[m].drops, ...(G.MOBS[m].rare || [])]) if (!G.ITEMS[k]) fail(`${m} drops ${k}, which is not an item`);
for (const k of ["slag", "emberglass", "tally"]) if (!(G.VALUE[k] > 0)) fail(`${k} has no price`);
const veins = S.objs.filter((o) => o.t === "rock" && o.ore); is(veins.length, 9, "nine veins"); is(veins.map((v) => v.ore).sort().join(","), Array(4).fill("eclipse_ore").concat(Array(3).fill("nova_ore"), Array(2).fill("singularity_ore")).join(","), "four Eclipse, three Nova, two Singularity");
for (const o of [...veins, ...S.objs.filter((o) => o.t === "blast")]) { if (S.g[o.y][o.x] !== "#") fail(`${o.name} at ${o.x},${o.y} is not on a blocked tile`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, o)); if (near > 1) fail(`${o.name} cannot be reached (${near})`); }
is(S.objs.filter((o) => o.t === "blast").length, 1, "one blast furnace");
const furnace = G.recipesAt("furnace").map((r) => r.id).sort(), blast = G.recipesAt("blast").map((r) => r.id).sort();
is(blast.join(","), [...furnace, "blast_eclipse", "blast_nova"].sort().join(","), "the blast furnace serves every furnace recipe, and its own two slag batches"); is(G.STATIONS.blast.nexus && G.STATIONS.blast.boost.mult === 1 && G.STATIONS.blast.boost.xp === 1.5, true, "one bar, half as much xp again");
is(G.MOBS.bessemer.open && G.BOSSES.has("bessemer") && G.MOBS.bessemer.range === 2, true, "Old Bessemer is an open boss with reach two");
is(G.BANDS.foundry.join("-"), "76-86", "the band");
is(G.FUNG_WILD.foundry?.length, 3, "three wild mushroom clusters"); is(S.objs.filter((o) => o.t === "shroom").length, 3, "and they stand on the map");
is(G.EGGS.egg_cindered.from.includes("foundry"), true, "a Cindered egg can turn up here");
/* (2026-09-27, the owner's picks: "3 of each", "Smithing uses", "Smithing piece", "Lower to ~1%") */
{ const n = (t) => S.mobs.filter((m) => m.t === t).length; is([n("slaggolem"), n("furnaceimp"), n("cinderelemental"), n("bessemer")], [3, 3, 3, 1], "three of each, and Old Bessemer"); }
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
console.log(bad ? `\n${bad} problem(s)` : "\nthe Foundry works: the map, the door, the veins, the blast furnace, the monsters, Basalt's quests");
process.exitCode = bad ? 1 : 0;

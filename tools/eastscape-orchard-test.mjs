/* DOES THE ORCHARD WALL WORK? —  node tools/eastscape-orchard-test.mjs
   (2026-09-27) The real World with storage stubbed: the map opens off the Boneyard's south edge (and the Boneyard's south door is
   walkable), every open tile is reachable from that door, every monster stands on grass (the perched wasps on water, within their reach
   of the bank), the trees and hives are real objects on blocked tiles and can be reached, the stove is a range, Pomona's quests are
   wired, every drop is an item, the walnut burns, and the pay sits in the band. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("orchard"), B = W.scene("boneyard");
is(G.SCENES.boneyard.exits.s, "orchard", "south of the Boneyard is the Orchard Wall"); is(G.SCENES.orchard.exits.n, "boneyard", "and the Orchard's north edge is the Boneyard"); is(G.OPEN.has("orchard"), true, "it is open");
const walkIn = (g) => (x, y) => G.walkableIn(g, x, y);
const reach = (g, sx, sy) => { const walk = walkIn(g), seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const nx = x + dx, ny = y + dy, k = ny * G.COLS + nx; if (!seen.has(k) && nx >= 0 && ny >= 0 && nx < G.COLS && ny < G.ROWS && walk(nx, ny) && (!dx || !dy || (walk(x, ny) && walk(nx, y)))) { seen.add(k); q.push([nx, ny]); } } } return seen; };
const walk = walkIn(S.g);
let open = 0; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) open++;
is(reach(S.g, 12, 0).size, open, `every open tile is reachable from the north door (${open})`);
is(B.g[G.ROWS - 1][22], "e", "the Boneyard's south door is a door"); is(reach(B.g, 22, G.ROWS - 1).size > 200, true, "and it reaches the Boneyard");
is(S.g.flat().includes("b"), false, "no bank tiles: the picture is the ground");
for (const m of S.mobs) if (!m.perch && !walk(m.hx, m.hy)) fail(`${m.t} at ${m.hx},${m.hy} stands on nothing`);
for (const m of S.mobs.filter((x) => x.perch)) { if (S.g[m.hy][m.hx] !== "~") fail(`${m.t} at ${m.hx},${m.hy} is not over water`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, m)); if (near > (G.MOBS[m.t].range || 1)) fail(`${m.t} at ${m.hx},${m.hy} cannot be reached even by its own range (${near})`); }
const kinds = [...new Set(S.mobs.map((m) => m.t))].sort(); is(kinds.join(","), "gardener,hedgething,orchardkeeper,orchardorc,wasp", "five kinds of monster");
is(S.npcs.some((n) => n.name === "Pomona"), true, "Pomona is by the wagon"); if (!walk(S.npcs[0].x, S.npcs[0].y)) fail("Pomona stands on nothing");
for (const q of ["orwasps", "orbands", "orgardener"]) if (!G.QUESTS[q]?.stages?.length || !S.npcs[0].quests.includes(q)) fail(`quest ${q}`);
for (const m of kinds) for (const [k] of [...G.MOBS[m].drops, ...(G.MOBS[m].rare || [])]) if (!G.ITEMS[k]) fail(`${m} drops ${k}, which is not an item`);
for (const k of ["walnutlogs", "honeycomb", "orcband"]) if (!(G.VALUE[k] > 0)) fail(`${k} has no price`);
is(G.RECIPES.burn_walnutlogs?.out?.[0], "charcoal", "walnut burns to charcoal"); is(G.ITEMS.honeycomb.heal > 0, true, "honeycomb heals");
const trees = S.objs.filter((o) => o.t === "yew"); is(trees.length, 12, "twelve trees"); is(trees.filter((t) => t.log === "pinelogs").length, 7, "seven pines"); is(trees.filter((t) => t.log === "walnutlogs").length, 5, "five walnuts");
for (const o of [...trees, ...S.objs.filter((o) => o.t === "hive" || o.t === "range")]) { if (S.g[o.y][o.x] !== "#") fail(`${o.name} at ${o.x},${o.y} is not on a blocked tile`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, o)); if (near > 1) fail(`${o.name} cannot be reached (${near})`); }
is(S.objs.filter((o) => o.t === "range").length, 1, "one stove"); is(S.objs.filter((o) => o.t === "hive").length, 2, "two hives");
is(G.MOBS.gardener.open && G.BOSSES.has("gardener"), true, "the Gardener is an open boss");
is(G.MOBS.wasp.sky && G.MOBS.wasp.range === 2, true, "a wasp hangs in the air and is reached from the bank");
is(G.BANDS.orchard.join("-"), "58-70", "the band");
is(G.FUNG_WILD.orchard?.length, 3, "three wild mushroom clusters"); is(S.objs.filter((o) => o.t === "shroom").length, 3, "and they stand on the map");
is(G.EGGS.egg_sparking.from.includes("orchard"), true, "a Sparking egg can turn up here");
console.log(bad ? `\n${bad} problem(s)` : "\nthe Orchard Wall works: the map, the door, the bridge, the trees, the wasps, the camp, Pomona's quests");
process.exitCode = bad ? 1 : 0;

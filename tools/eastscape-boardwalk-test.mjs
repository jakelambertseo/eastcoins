/* DOES THE BOARDWALK WORK? —  node tools/eastscape-boardwalk-test.mjs
   (2026-09-27) The real World with storage stubbed: the map opens off the Carnival's west fence and every open tile is reachable from
   that door, the gulls and the Kraken Arms hang over water a sword cannot reach, the fishing spots, the Chip Shop and Salty Meg are
   real, her quests are wired, every monster's drops and every fish's cook are real items and recipes, and the pay sits in the band. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("boardwalk");
is(G.SCENES.carnival.exits.w, "boardwalk", "west of the Carnival is the Boardwalk"); is(G.SCENES.boardwalk.exits.e, "carnival", "and the Boardwalk's east edge is the Carnival"); is(G.OPEN.has("boardwalk"), true, "it is open");
const walk = (x, y) => G.walkableIn(S.g, x, y);
const reach = (sx, sy) => { const seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const nx = x + dx, ny = y + dy, k = ny * G.COLS + nx; if (!seen.has(k) && nx >= 0 && ny >= 0 && nx < G.COLS && ny < G.ROWS && walk(nx, ny) && (!dx || !dy || (walk(x, ny) && walk(nx, y)))) { seen.add(k); q.push([nx, ny]); } } } return seen; };
let open = 0; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) open++;
is(reach(43, 2).size, open, `every open tile is reachable from the east door (${open})`);
is(S.g.flat().includes("b"), false, "no bank tiles: the picture is the ground");
for (const m of S.mobs) if (!m.perch && !walk(m.hx, m.hy)) fail(`${m.t} at ${m.hx},${m.hy} stands on nothing`);
for (const m of S.mobs.filter((x) => x.perch)) { if (S.g[m.hy][m.hx] !== "~") fail(`${m.t} at ${m.hx},${m.hy} is not over water`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, m)); if (near > (G.MOBS[m.t].range || 1)) fail(`${m.t} at ${m.hx},${m.hy} cannot be reached even by its own range (${near})`); }
ok(`${S.mobs.filter((x) => x.perch).length} gulls and arms hang over the water`);
const kinds = [...new Set(S.mobs.map((m) => m.t))].sort(); is(kinds.join(","), "captainclaw,clawhand,deckhand,gull,krakenarm", "five kinds of monster");
is(S.npcs.some((n) => n.name === "Salty Meg"), true, "Salty Meg is on the bank");
for (const q of ["bwmackerel", "bwdeckhands", "bwcaptain"]) if (!G.QUESTS[q]?.stages?.length || !S.npcs[0].quests.includes(q)) fail(`quest ${q}`);
for (const m of kinds) for (const [k] of [...G.MOBS[m].drops, ...(G.MOBS[m].rare || [])]) if (!G.ITEMS[k]) fail(`${m} drops ${k}, which is not an item`);
for (const f of ["mackerel", "bluefin", "swordfish"]) { if (!G.RECIPES[`cook_${f}`] || !G.ITEMS[`c${f}`] || !G.RECIPES[`smoke_${f}`] || !G.ITEMS[`s${f}`]) fail(`${f}: no cook or smoke`); if (!(G.ZDROP.fish[f] > 0)) fail(`${f}: no ZCoin chance`); }
const spots = S.objs.filter((o) => o.t === "spot"); is(spots.length, 6, "six fishing spots"); for (const sp of spots) { if (S.g[sp.y][sp.x] !== "~") fail(`spot ${sp.name} at ${sp.x},${sp.y} is not on water`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, sp)); if (near > 1) fail(`spot ${sp.name} cannot be fished from the pier (${near})`); }
is(S.objs.some((o) => o.t === "range"), true, "the Chip Shop is a range");
is(G.MOBS.captainclaw.open && G.BOSSES.has("captainclaw"), true, "Captain Claw is an open boss");
is(G.MOBS.gull.guard.melee === 0 && G.MOBS.gull.sky, true, "a gull takes nothing from a sword and hangs in the air");
is(G.BANDS.boardwalk.join("-"), "66-78", "the band");
is(G.FUNG_WILD.boardwalk?.length, 3, "three wild mushroom clusters"); is(S.objs.filter((o) => o.t === "shroom").length, 3, "and they stand on the map");
console.log(bad ? `\n${bad} problem(s)` : "\nthe Boardwalk works: the map, the piers, the gulls, the arms, the captain, Salty Meg's quests");
process.exitCode = bad ? 1 : 0;

/* DOES THE DEPTHS OF THE MOUNTAIN WORK? —  node tools/eastscape-depths-test.mjs
   (2026-09-27) The real World with storage stubbed: the map joins the Thunderhead to the Trailer Park and every tile is reachable,
   the guards do what the owner asked (a tenth from a guarded style, only Void through the Iron Ogre), a wisp over the drop cannot
   be reached with a sword but can with a bow, shoots back from range and comes back on its perch when it dies, the Deepwarden is
   an open boss, and Old Pickett's quests, the fish and the veins are all real. */
import "./eastscape-open-all.mjs";   /* the Depths and Jewelcrafting ship held (HOLD); these tests open them */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("depths");

/* 1. the map */
is(G.SCENES.thunderhead.exits.n, "depths", "north of the Thunderhead is the Depths"); is(G.SCENES.trailer.exits.s, "depths", "south of the Trailer Park is the Depths"); is(G.SCENES.depths.exits.e, "trailer", "and the Depths' east edge leads there");
is(G.OPEN.has("depths"), true, "it is open");
const walk = (x, y) => G.walkableIn(S.g, x, y);
const reach = (sx, sy) => { const seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const nx = x + dx, ny = y + dy, k = ny * G.COLS + nx; if (!seen.has(k) && G.canStepIn(S.g, x, y, dx, dy)) { seen.add(k); q.push([nx, ny]); } } } return seen; };
/* (2026-10-01, v1.1) a map's fenced nook is reached over its shortcut, not on foot: its one tile is not "cut off" */
const nookTiles = (k) => Object.entries(G.WORLD_SC || {}).filter(([id, s]) => (s.scene || id) === k && s.walls && !G.HOLD.thief2).length;
let open = 0; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) open++;
open -= nookTiles("depths");
is(reach(21, 25).size, open, `every open tile is reachable from the south exit (${open})`); is(reach(43, 23).size, open, "and from the east exit, the sand bridge to the Trailer Park");
is(S.g.flat().includes("b"), false, "no unwalkable bank round the drop");
for (const m of S.mobs) if (!m.perch && !walk(m.hx, m.hy)) fail(`${m.t} at ${m.hx},${m.hy} stands on nothing`);
for (const m of S.mobs.filter((x) => x.perch)) { if (S.g[m.hy][m.hx] !== "~") fail(`wisp at ${m.hx},${m.hy} is not over the drop`); let near = 9; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (walk(x, y)) near = Math.min(near, G.cheb({ x, y }, { x: m.hx, y: m.hy })); if (near < 2) fail(`a sword could reach the wisp at ${m.hx},${m.hy}`); }
ok(`${S.mobs.filter((x) => x.perch).length} wisps hang over the drop, none within a sword's reach`);
const kinds = [...new Set(S.mobs.map((m) => m.t))].sort(); is(kinds.join(","), "deepwarden,dgoblin,diron,dogre,dwisp,potboy", "six kinds of monster");
is(S.npcs.some((n) => n.name === "Old Pickett"), true, "Old Pickett is on the landing");
for (const q of ["deepcrystal", "deepgoblins", "deepkeeper"]) if (!G.QUESTS[q]?.stages?.length || !S.npcs[0].quests.includes(q)) fail(`quest ${q}`);
ok("his three quests have stages");
for (const o of S.objs.filter((o) => o.t === "rock")) if (!G.ITEMS[o.ore]) fail(`vein of ${o.ore}`);
for (const o of S.objs.filter((o) => o.t === "spot")) if (!G.ITEMS[o.fish] || !G.ITEMS[o.fish2]) fail("fishing spot fish");
ok(`${S.objs.filter((o) => o.t === "rock").length} veins and ${S.objs.filter((o) => o.t === "spot").length} fishing spots, all real items`);

/* 2. the guards */
is(G.guardMul("diron", "melee"), 0.1, "the Iron Ogre takes a tenth from a sword"); is(G.guardMul("diron", "archery"), 0.1, "and from an arrow");
is(G.guardMul("diron", "magic", "fire"), 0.1, "and from Fire"); is(G.guardMul("diron", "magic", "void"), 1, "but all of Void");
is(G.elementMul("diron", "void"), G.MAGIC.weakMul, "and Void is its weakness too"); is(G.guardMul("dogre", "archery"), 0.1, "the Crystal Ogre shrugs off arrows");
is(G.guardMul("dwisp", "magic", "fire"), 0.1, "spells pass through a wisp"); is(G.guardMul("dwisp", "archery"), 1, "arrows do not");
is(G.elementMul("pumpkinking", "fire"), G.MAGIC.weakMul, "a list of weaknesses works (the Pumpkin King's fire)");

/* 3. a real hit through the server: a sword on an Iron Ogre */
const C = G.freshChar(); C.xp.melee = G.XP_AT[99]; C.xp.hp = G.XP_AT[99];
const pl = { id: "u1", login: "u1", name: "Delver", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), lastSwing: 0 };
W.pls.set("u1", pl); C.scene = S.key;
const said = () => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop();
const ogre = S.mobs.find((m) => m.t === "diron");
for (const [dx, dy] of G.D8) if (walk(ogre.x + dx, ogre.y + dy)) { pl.x = ogre.x + dx; pl.y = ogre.y + dy; break; }
const R0 = Math.random; let flip = 0; Math.random = () => (flip++ % 2 ? 0.999 : 0.0);   /* the hit roll lands, the damage roll is high */
const hp0 = ogre.hp; pl.act = { kind: "mob", id: ogre.id, x: ogre.x, y: ogre.y, started: 0 }; let now = Date.now(); for (let i = 0; i < 4; i++) { now += 3000; pl.lastInput = now; pl.urge = false; W.doAction(S, pl, now); }
Math.random = R0;
const took = hp0 - ogre.hp; is(took > 0 && took <= Math.ceil((G.maxHitOf(C) + 1) * 0.1) * 4, true, `a maxed sword barely marks it (${took} in four swings, max hit ${G.maxHitOf(C)})`);
is(/only Void magic gets through/.test(pl.out.filter((o) => o.type === "say").map((o) => o.text).join(" ")), true, "and the player is told why");

/* 4. the wisp: out of a sword's reach, in a bow's, shoots back, and respawns on its perch */
const wisp = S.mobs.find((m) => m.perch);
let sp = null; for (const d of [2, 3]) for (let y = 0; y < G.ROWS && !sp; y++) for (let x = 0; x < G.COLS && !sp; x++) if (walk(x, y) && G.cheb({ x, y }, wisp) === d) sp = { x, y };   /* the nearest standing spot, inside its range */
pl.x = sp.x; pl.y = sp.y; pl.path = []; C.eq.weapon = null; pl.out = []; pl.act = { kind: "mob", id: wisp.id, x: wisp.x, y: wisp.y, started: 0 }; W.doAction(S, pl, Date.now() + 99999);
is(pl.act, null, "a sword cannot reach a wisp"); is(/arrow/.test(said() || ""), true, "and says to use a bow");
C.hp = G.maxHpOf(C); wisp.lastSwing = 0; pl.act = { kind: "mob", id: wisp.id, x: wisp.x, y: wisp.y, started: 0 }; pl.step = null;
Math.random = () => 0.0; W.mobsTick(S, Date.now() + 100000); Math.random = R0;
is(C.hp < G.maxHpOf(C), true, `the wisp shoots the player from ${G.cheb(sp, wisp)} tiles off (hp ${C.hp} of ${G.maxHpOf(C)})`);
wisp.dead = true; wisp.respawnAt = 0; wisp.x = 0; wisp.y = 0; W.mobsTick(S, Date.now() + 200000);
is(!wisp.dead && wisp.x === wisp.hx && wisp.y === wisp.hy, true, "a dead wisp comes back on its own perch");

/* 5. the boss */
is(!!(G.MOBS.deepwarden.open && G.MOBS.deepwarden.boss && G.BOSSES.has("deepwarden")), true, "the Deepwarden is an open boss");
is(G.MOBS.deepwarden.hp, 5200, "with the Pumpkin King's hitpoints"); is(G.MOBS.deepwarden.max > G.MOBS.pumpkinking.max * 2, true, "and hits over twice as hard");
is(G.MOBS.deepwarden.pet[0], "potboy", "and carries the Pot Boy");
is(S.mobs.find((m) => m.t === "deepwarden").hy <= 4, true, "and sits at the far end, in front of his throne");
is(G.GEM_DROP.abyss_crystal?.length, 4, "an abyss crystal vein can turn up all four gems");

console.log(bad ? `\n${bad} problem(s)` : "\nthe Depths work: the map, the guards, the wisps, the boss, the quests");
process.exitCode = bad ? 1 : 0;

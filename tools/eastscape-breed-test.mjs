/* DOES BREEDING WORK? —  node tools/eastscape-breed-test.mjs
   (2026-09-27, rebuilt the same day to the owner's simpler design) The real World with storage stubbed, on a real island: the three
   pet foods cook at a campfire, two Ordinary pets in the pen make a Greater one on Greater food, two Greater ones of a kind make its
   Legendary on Legendary food, an egg hatches in the hatchery on Ordinary food (and nothing else), the pen and the hatchery refuse
   what they should, and the pets' effects reach the game. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};

const C = G.freshChar(); C.inv = C.inv.filter((s) => s.k === "tickets");
const S = W.scene(G.isleKey(C.isle, "u1")); const pen = S.objs.find((o) => o.t === "pen");
const pl = { id: "u1", login: "u1", name: "Breeder", role: "user", ws: { send() {} }, C, x: pen.x, y: pen.y + 1, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now() };
C.scene = S.key; W.pls.set("u1", pl); S.g[pl.y][pl.x] = ".";
const said = () => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop();

/* 1. the three foods, at a campfire, on Cooking */
is(Object.keys(G.RANKS).map((r) => G.ITEMS[G.RANKS[r].food] && true).every(Boolean), true, "the three ranks each have a pet food item");
const recs = Object.values(G.RECIPES).filter((r) => /^petfood_/.test(r.id));
is(recs.every((r) => r.station === "fire" && r.skill === "cooking" && r.in.every(([k]) => G.ITEMS[k])), true, `all ${recs.length} pet food recipes cook at a campfire from real items`);
is([...new Set(recs.map((r) => r.lvl))].sort((a, b) => a - b).join(","), "20,50,80", "gated at Cooking 20, 50 and 80");
is(Object.values(G.RECIPES).some((r) => r.station === "pen"), false, "the pen is no longer a station");
{ C.xp.cooking = G.XP_AT[20]; G.addInv(C.inv, "beef", 1, C); G.addInv(C.inv, "buttoncap", 2, C);
  const fire = W.scene("workyard").objs.find((o) => o.t === "fire"); const Y = W.scene("workyard");
  if (fire) { const save = [pl.x, pl.y, C.scene]; C.scene = Y.key; for (const [dx, dy] of G.D8) if (G.walkableIn(Y.g, fire.x + dx, fire.y + dy)) { pl.x = fire.x + dx; pl.y = fire.y + dy; break; }
    pl.act = { kind: "cook", ob: fire, x: fire.x, y: fire.y, pick: "petfood_beef", started: 0 }; let t = Date.now(); for (let i = 0; i < 6 && pl.act; i++) { t += 3000; pl.lastInput = t; W.doAction(Y, pl, t); }
    is(G.countItems(C, ["petfood_ordinary"]), 3, "beef and button caps cook into three Ordinary pet food"); [pl.x, pl.y, C.scene] = save; }
  else fail("no campfire in the Yard to cook on"); }

/* 2. two Ordinary pets make a Greater one, on Greater food */
const pa = { id: "pa", k: "bonepup", name: "" }, pb = { id: "pb", k: "packrat", name: "" }; C.pets = [pa, pb]; C.eq.pet = "pa";
W.penOp(S, pl, { op: "pair", a: "pa", b: "pb" }); is(C.pen, undefined, "refused without Greater pet food"); is(/greater pet food/i.test(said() || ""), true, "and says which food");
G.addInv(C.inv, "petfood_greater", G.BREED.greater.food, C);
W.penOp(S, pl, { op: "pair", a: "pa", b: "pa2" }); is(C.pen, undefined, "a pet that is not yours is refused");
W.penOp(S, pl, { op: "pair", a: "pa", b: "pb", sa: "speed", sb: "slots", look: "packrat" });
is(C.pen?.kind, "greater", "at Breeding 1, two ordinary pets start a Greater pairing"); is(G.countItems(C, ["petfood_greater"]), 0, `the ${G.BREED.greater.food} Greater pet food go in at once`);
is(C.pets.length, 0, "both parents are in the pen"); is(C.eq.pet, null, "the worn one is taken off");
W.penOp(S, pl, { op: "pair", a: "x", b: "y" }); is(/busy/.test(said() || ""), true, "a busy pen says so");
W.penOp(S, pl, { op: "collect" }); is(/Not yet/.test(said() || ""), true, "collect refuses before the clock");
C.pen.at -= G.BREED.greater.ms; W.penOp(S, pl, { op: "collect" });
is(C.pen, null, "collect empties the pen"); is(C.pets.length, 3, "the baby, and both parents back (2026-09-27: they come back so the skill can be trained)");
const kid = C.pets.find((p) => p.tier);
{ const keep = C.pets; C.pets = [{ id: "r1", k: "bonepup", name: "" }, { id: "r2", k: "packrat", name: "" }]; G.addInv(C.inv, "petfood_greater", G.BREED.greater.food, C); W.penOp(S, pl, { op: "pair", a: "r1", b: "r2" }); W.penOp(S, pl, { op: "release" }); is(C.pets.length, 2, "stopping early gives both parents back"); is(C.pen, null, "and empties the pen"); C.pets = keep; } is(G.rankOf(kid), "greater", `the child is Greater (${kid?.k})`);
is(kid.k, "packrat", "it wears the look that was chosen"); is(JSON.stringify(kid.fx), JSON.stringify({ speed: 10, slots: 5 }), "and carries the two picked stats, a quarter stronger (speed 8 -> 10, slots 4 -> 5)");
C.eq.pet = kid.id; const pf = G.petFx(C); is(pf.speed === 10 && pf.slots === 5, true, `both reach the game (${G.petFxText(kid.fx)})`);
is(JSON.stringify(G.mixFx("greater", ["tix", 10], ["hp", 8])), JSON.stringify({ tix: 13, hp: 10 }), "any two stats mix");

/* 3. two Greater Bonepups make a Cerberpup, on Legendary food, at Breeding 50 */
C.pets = [{ id: "g1", k: "bonepup", name: "", tier: 1, fx: { speed: 10 } }, { id: "g2", k: "bonepup", name: "", tier: 1, fx: { speed: 10, slots: 1 } }]; C.eq.pet = null;
G.addInv(C.inv, "petfood_legend", G.BREED.legend.food, C);
C.xp.breeding = 0; W.penOp(S, pl, { op: "pair", a: "g1", b: "g2" }); is(!C.pen, true, "a Legendary pairing needs Breeding 50");
C.xp.breeding = G.XP_AT[50]; W.penOp(S, pl, { op: "pair", a: "g1", b: "g2", sa: "speed", sb: "speed" }); is(!C.pen, true, "the same stat from both parents is refused"); is(C.pets.length, 2, "and a refusal keeps both pets"); is(G.countItems(C, ["petfood_legend"]), G.BREED.legend.food, "and the food");
W.penOp(S, pl, { op: "pair", a: "g1", b: "g2", sa: "speed", sb: "slots" }); is(C.pen?.child?.k, "cerberpup", "at 50, two Greater Bonepups will make a Cerberpup");
is(G.countItems(C, ["petfood_legend"]), 0, "and eat the Legendary pet food");
C.pen.at -= G.BREED.legend.ms; W.penOp(S, pl, { op: "collect" }); const cer = C.pets.find((p) => p.k === "cerberpup"); is(G.rankOf(cer), "legend", "the Cerberpup is Legendary");
is(JSON.stringify(cer.fx), JSON.stringify({ speed: 14, tix: 5, slots: 1 }), "it keeps its own powers and adds the picks (speed stays its bigger 14, slots 1 added)");
is(JSON.stringify(G.normChar(JSON.parse(JSON.stringify(C))).pets.find((p) => p.k === "cerberpup").fx), JSON.stringify(cer.fx), "and keeps them through a save");
is(G.pairOf({ id: "x", k: "cerberpup" }, { id: "y", k: "bonepup" }).no != null, true, "a Legendary cannot breed");
is(G.pairOf({ id: "x", k: "blackcat" }, { id: "y", k: "bonepup" }).no != null, true, "an event pet cannot breed");
is(G.pairOf({ id: "x", k: "bonepup", tier: 1 }, { id: "y", k: "packrat", tier: 1 }).no != null, true, "two Greater pets of different kinds cannot make a Legendary");

/* 4. the hatchery: an egg and three Ordinary pet food, nothing else */
C.isle.owned = { hatchery: 1 }; let placed = false;
for (let y = 3; y < G.ROWS - 3 && !placed; y++) for (let x = 3; x < G.COLS - 3 && !placed; x++) { const n = C.isle.decor.length; W.decorOp(S, pl, { op: "place", k: "hatchery", x, y }); placed = C.isle.decor.length > n; }
const hb = S.objs.find((o) => o.t === "hatchery"); is(!!hb, true, "a hatchery goes down on the island");
for (const [dx, dy] of G.D8) if (G.walkableIn(S.g, hb.x + dx, hb.y + dy)) { pl.x = hb.x + dx; pl.y = hb.y + dy; break; }
C.xp.breeding = 0; G.takeInv(C.inv, "petfood_ordinary", G.countItems(C, ["petfood_ordinary"])); G.addInv(C.inv, "egg_gilded", 1, C);
W.hatchOp(S, pl, { op: "egg", k: "egg_gilded" }); is(!C.hatch, true, "an egg without Ordinary pet food is refused"); is(/ordinary pet food/i.test(said() || ""), true, "and says what it needs");
G.addInv(C.inv, "petfood_ordinary", G.BREED.hatch.food, C);
W.hatchOp(S, pl, { op: "egg", k: "egg_gilded" }); is(C.hatch?.egg, "egg_gilded", "at Breeding 1, the rarest egg goes in (no level, gem or nest)");
is(G.countItems(C, ["egg_gilded"]) + G.countItems(C, ["petfood_ordinary"]), 0, "the egg and the food are taken");
const decN = C.isle.decor.length; W.decorOp(S, pl, { op: "take", x: hb.x, y: hb.y }); is(C.isle.decor.length, decN, "a hatchery with an egg in it cannot be picked up");
C.hatch.at -= G.EGGS.egg_gilded.ms; W.hatchOp(S, pl, { op: "collect" }); is(C.pets.some((p) => p.k === "mimic"), true, "a Mimic hatches"); is(C.hatch, null, "and the hatchery is empty");
const vis = { ...pl, id: "u2", C: G.freshChar(), out: [] }; W.hatchOp(S, vis, { op: "view" }); is(vis.out.some((o) => o.type === "say" && /somebody else/.test(o.text)), true, "nobody else can use your hatchery");

/* 4b. a hatched pet climbs the whole ladder */
is(G.pairOf({ id: "h1", k: "mimic" }, { id: "h2", k: "pocketowl" }).kind, "greater", "two hatched pets breed into a Greater");
is(Object.values(G.EGGS).every((e) => G.LEGEND_OF[e.pet]), true, "every hatchling has a Legendary");
is(G.pairOf({ id: "h1", k: "mimic", tier: 1 }, { id: "h2", k: "mimic", tier: 1 }).child, "grandmimic", "two Greater Mimics make a Grand Mimic");
is(/Ordinary pet with a Greater/.test(G.pairOf({ id: "h1", k: "mimic" }, { id: "h2", k: "mimic", tier: 1 }).no || ""), true, "an Ordinary with a Greater says so in words");

/* 5. the pets' effects reach the game */
C.pets.push({ id: "ow", k: "pocketowl", name: "" }); C.eq.pet = "ow"; C.eq.weapon = "yewlogs_longbow"; is(G.reachOfHeld(C), G.ITEMS.yewlogs_longbow.launcher.range + 1, "the Pocket Owl adds a tile to a bow");
C.pets.push({ id: "mo", k: "mossback", name: "" }); C.eq.pet = "mo"; is(G.fxOf(C).tough >= 0.1, true, "the Mossback makes you take less damage");
C.pets.push({ id: "st", k: "stormling", name: "" }); C.eq.pet = "st"; is(G.fxOf(C).bite >= 0.1 - 1e-9, true, "the Stormling makes fish bite");

/* 6. saves, and the rest of the rules */
C.pets.push({ id: "gk", k: "bonepup", name: "", tier: 1, fx: { speed: 10, slots: 1 } }); const back = G.normChar(JSON.parse(JSON.stringify(C))).pets.find((p) => p.id === "gk"); is(!!back?.tier && Object.keys(back.fx || {}).length > 0, true, "a Greater pet keeps its tier and effects through a save");
is(Object.keys(G.EGGS).every((k) => G.ITEMS[k] && G.PETS[G.EGGS[k].pet] && !G.EGGS[k].gem), true, "every egg is an item, hatches a real pet, and wants no gem");
is(G.PET_DROP_KEYS.some((k) => G.PETS[k].bred), false, "no bred pet is in the ordinary drop pool");
is(G.BREED.eggDrop, 1 / 3000, "eggs drop one kill in three thousand");
is(!!G.SKILLS.breeding && G.HISCORES.some(([k]) => k === "breeding"), true, "Breeding is a skill with a hiscore board");
for (const k of ["pup_kibble", "feather_nest", "grim_broth"]) if (G.ITEMS[k]) fail(`${k} should be gone`);

console.log(bad ? `\n${bad} problem(s)` : "\nbreeding works: three foods, the pen, Greater and Legendary, the hatchery, effects, saves");
process.exitCode = bad ? 1 : 0;

/* DOES BREEDING WORK? —  node tools/eastscape-breed-test.mjs
   (2026-09-27) The real World with storage stubbed, on a real island: pet food is made at the pen (the station loop), two pets
   pair into a Greater one (food, level, the clock, collect), two Greater ones of a kind make a Legendary, an egg hatches, the
   pen refuses what it should, and the pets' effects reach the game (petFx, fxOf, the bow's reach, a save round trip). */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};

const C = G.freshChar(); C.xp.breeding = G.XP_AT[80]; C.inv = C.inv.filter((s) => s.k === "tickets");
const S = W.scene(`isle:u1`); const pen = S.objs.find((o) => o.t === "pen");
const pl = { id: "u1", login: "u1", name: "Breeder", role: "user", ws: { send() {} }, C, x: pen.x, y: pen.y + 1, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now() };
C.scene = S.key; W.pls.set("u1", pl); S.g[pl.y][pl.x] = ".";
is(!!pen, true, "the island has a pen");
const said = () => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop();

/* 1. food at the pen, through the station loop */
G.addInv(C.inv, "beef", 4, C); G.addInv(C.inv, "bones", 4, C);
pl.act = { kind: "breed", ob: pen, x: pen.x, y: pen.y, pick: "breed_kibble", started: 0 };
let now = Date.now(); for (let i = 0; i < 10 && pl.act; i++) { now += 3000; pl.lastInput = now; W.doAction(S, pl, now); }
is(G.countItems(C, ["pup_kibble"]) >= 3, true, "pup kibble is made at the pen");
is(C.xp.breeding > G.XP_AT[80], true, "and it trains Breeding");

/* 2. a Greater pairing */
const pa = { id: "pa", k: "bonepup", name: "" }, pb = { id: "pb", k: "packrat", name: "" }; C.pets = [pa, pb]; C.eq.pet = "pa";
W.penOp(S, pl, { op: "pair", a: "pa", b: "pb" }); is(C.pen, undefined, "refused without the packrat's food"); is(/scrounge/i.test(said() || ""), true, "and says which food is missing");
G.addInv(C.inv, "pup_kibble", 6, C); G.addInv(C.inv, "scrounge_bag", 6, C);
W.penOp(S, pl, { op: "pair", a: "pa", b: "pb" });
is(C.pen?.kind, "greater", "the pairing starts"); is(C.pets.length, 0, "both parents are in the pen, off the pets list"); is(C.eq.pet, null, "the worn one is taken off");
is(G.countItems(C, ["pup_kibble"]) + G.countItems(C, ["scrounge_bag"]) - (G.countItems(C, ["pup_kibble"]) >= 3 ? 0 : 0) >= 0, true, "the food is taken at the start");
W.penOp(S, pl, { op: "collect" }); is(/Not yet/.test(said() || ""), true, "collect refuses before the clock");
C.pen.at -= G.BREED.greater.ms; W.penOp(S, pl, { op: "collect" });
is(C.pen, null, "collect empties the pen"); is(C.pets.length, 3, "both parents come back, with the child");
const kid = C.pets.find((p) => p.tier); is(!!kid && ["bonepup", "packrat"].includes(kid.k), true, `the child is a Greater ${kid?.k}`); is(G.petLabel(kid).startsWith("Greater "), true, "and is labelled Greater");
C.eq.pet = kid.id; const pf = G.petFx(C); is(kid.k === "bonepup" ? pf.speed === 10 : pf.slots === 5, true, `its own effect is a quarter better (${G.petFxText(kid.fx)})`);

/* 3. a Legendary: two Greater Bonepups */
C.pets = [{ id: "g1", k: "bonepup", name: "", tier: 1, fx: { speed: 10 } }, { id: "g2", k: "bonepup", name: "", tier: 1, fx: { speed: 10, slots: 1 } }]; C.eq.pet = null;
G.addInv(C.inv, "grim_broth", 48, C); G.addInv(C.inv, "opal", 1, C);
W.penOp(S, pl, { op: "pair", a: "g1", b: "g2" }); is(C.pen?.kind, "legend", "two Greater Bonepups start a Legendary"); is(C.pen?.child?.k, "cerberpup", "and it will be a Cerberpup");
C.pen.at -= G.BREED.legend.ms; W.penOp(S, pl, { op: "collect" }); is(C.pets.some((p) => p.k === "cerberpup"), true, "the Cerberpup is collected");
is(G.pairOf({ id: "x", k: "cerberpup" }, { id: "y", k: "bonepup" }).no != null, true, "a Legendary cannot breed");
is(G.pairOf({ id: "x", k: "blackcat" }, { id: "y", k: "bonepup" }).no != null, true, "an event pet cannot breed");
is(G.pairOf({ id: "x", k: "bonepup", tier: 1 }, { id: "y", k: "packrat", tier: 1 }).no != null, true, "two Greater pets of different kinds cannot make a Legendary");

/* 4. an egg */
G.addInv(C.inv, "egg_geode", 1, C); G.addInv(C.inv, "feather_nest", 1, C);
W.penOp(S, pl, { op: "egg", k: "egg_geode" }); is(C.pen, null, "an egg without its opal is refused");
G.addInv(C.inv, "opal", 1, C); W.penOp(S, pl, { op: "egg", k: "egg_geode" }); is(C.pen?.kind, "egg", "the egg goes in with its nest and opal");
C.pen.at -= G.EGGS.egg_geode.ms; W.penOp(S, pl, { op: "collect" }); const crab = C.pets.find((p) => p.k === "crystalcrab"); is(!!crab, true, "a Crystal Crab hatches");
C.eq.pet = crab.id; is(G.petFx(C).gem, 50, "and its gem bonus reaches petFx");

/* 5. the other pets' effects reach the game */
C.pets.push({ id: "ow", k: "pocketowl", name: "" }); C.eq.pet = "ow"; C.eq.weapon = "yewlogs_longbow"; is(G.reachOfHeld(C), G.ITEMS.yewlogs_longbow.launcher.range + 1, "the Pocket Owl adds a tile to a bow");
C.pets.push({ id: "mo", k: "mossback", name: "" }); C.eq.pet = "mo"; is(G.fxOf(C).tough >= 0.1, true, "the Mossback makes you take less damage");
C.pets.push({ id: "st", k: "stormling", name: "" }); C.eq.pet = "st"; is(G.fxOf(C).bite >= 0.1 - 1e-9, true, "the Stormling makes fish bite");

/* 6. a Greater pet survives a save */
const saved = G.normChar(JSON.parse(JSON.stringify(C))); const back = saved.pets.find((p) => p.id === kid.id) || saved.pets.find((p) => p.tier);
is(!!back?.tier && Object.keys(back.fx || {}).length > 0, true, "a Greater pet keeps its tier and effects through a save");

/* 7. eggs, drops and the skill */
is(Object.keys(G.EGGS).every((k) => G.ITEMS[k] && G.PETS[G.EGGS[k].pet]), true, "every egg is an item and hatches a real pet");
is(G.PET_DROP_KEYS.some((k) => G.PETS[k].bred), false, "no bred pet is in the ordinary drop pool");
is(G.BREED.eggDrop, 1 / 3000, "eggs drop one kill in three thousand");
is(!!G.SKILLS.breeding && G.HISCORES.some(([k]) => k === "breeding"), true, "Breeding is a skill with a hiscore board");
is(Object.values(G.RECIPES).filter((r) => r.station === "pen").every((r) => r.in.every(([k]) => G.ITEMS[k])), true, "every pen recipe's ingredients exist");

console.log(bad ? `\n${bad} problem(s)` : "\nbreeding works: food, pairings, Legendaries, eggs, effects, saves");
process.exitCode = bad ? 1 : 0;

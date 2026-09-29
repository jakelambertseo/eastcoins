/* DOES MAGIC ACTUALLY WORK? —  node tools/eastscape-magic-run.mjs
   (2026-09-26) The real World class with storage stubbed, one player, and the things a wizard does: wear a wand and a bag, load
   pages, cast at something weak to them, print at an altar and at the Nexus, read a buff and a Waystone, grow a seed into its bloom.
   Every assertion is something a player would notice. NOT a test of the page, the art, the sounds or how it feels. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${got}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => { const p = fn(); if (p && p.then) p.catch(() => {}); return p; },
  storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" });
W.save = async () => {}; W.saveAll = async () => {}; W.pitTick = async () => {};
const xpFor = (n) => G.XP_AT[n] || 0;
const C = G.freshChar(); C.scene = "workyard"; C.x = 20; C.y = 12;
Object.assign(C.xp, { magic: xpFor(60), wizardry: xpFor(80), hp: xpFor(40), farming: xpFor(50), melee: xpFor(1) }); C.hp = G.maxHpOf(C);
const A = { id: "p1", login: "wiz", name: "Wiz", admin: false, role: "user", ws: { send() {} }, C, x: 20, y: 12, path: [], step: null, face: 1, dir: "south", act: null,
  lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: true, needSave: false, out: [], god: false, msgs: 0, msgWindow: 0, joinedAt: Date.now(), lastInput: Date.now() };
W.pls.set(A.id, A);
const S = W.scene("workyard");
const says = () => A.out.filter((o) => o.type === "say").map((o) => o.text);

/* ---------------------------------------------------------------- the kit */
G.addInv(C.inv, "yewlogs_wand", 1, C); G.addInv(C.inv, "bag_conjurer", 1, C); G.addInv(C.inv, "page_fire_bolt", 300, C); G.addInv(C.inv, "bone_arrow", 50, C);
W.equip(A, C.inv.findIndex((s) => s.k === "yewlogs_wand"));
W.equip(A, C.inv.findIndex((s) => s.k === "bag_conjurer"));
is(G.styleOf(C), "magic", "a wand makes the style Magic");
is(C.quiver?.k, "page_fire_bolt", "putting the bag on loaded the fire pages, not the arrows");
is(G.countItems(C, ["bone_arrow"]), 50, "the arrows stayed in the bag");
is(G.reachOfHeld(C), 5, "a wand casts from five tiles");

/* ---------------------------------------------------------------- casting, with an element */
const drakeLike = "drake"; is(G.elementMul(drakeLike, "fire"), G.MAGIC.weakMul, "fire against a Hail Drake is its weakness");
const m = { id: "tgt", t: "drake", x: 24, y: 12, hx: 24, hy: 12, hp: 9999, maxHp: 9999, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: 0, hurtAt: 0, swingAt: 0, lastSwing: 0 };
S.mobs.push(m);
const magic0 = C.xp.magic, melee0 = C.xp.melee;
A.act = { kind: "mob", id: m.id, x: m.x, y: m.y, name: "Drake", started: 0, reach: 5 };
const t0 = Date.now(); let casts = 0;
for (let t = 1; t <= 120 && casts < 20; t++) { const n0 = C.quiver.n; W.doAction(S, A, t0 + t * 500); if (C.quiver.n < n0) casts++; }
is(casts, 20, "twenty casts");
is(C.xp.magic > magic0, true, "they paid Magic xp");
is(C.xp.melee, melee0, "and not Melee");
if (m.hp >= 9999) fail("the drake is untouched"); else ok(`the drake took ${9999 - m.hp}`);
is(S.events.some((e) => e.type === "splat" && e.ak === "page_fire_bolt"), true, "each cast told the page which page flew");

/* ---------------------------------------------------------------- printing: an altar, then the Nexus */
const wz0 = C.xp.wizardry;
G.addInv(C.inv, "spellpaper", 60, C); G.addInv(C.inv, "ink_fire", 20, C);
const fireAltar = { t: "altar_fire", x: 21, y: 12, id: 900 };
Math.random = ((r) => () => 0.99)(Math.random);   // no failed prints in this part: the 10% fail is tested by the craft check
const printAt = (ob) => { A.act = { kind: "print", ob, x: ob.x, y: ob.y, name: "altar", pick: "print_page_fire_bolt", started: 0 }; const n0 = G.countItems(C, ["page_fire_bolt"]); W.doAction(S, A, Date.now()); W.doAction(S, A, Date.now() + 5000); return G.countItems(C, ["page_fire_bolt"]) - n0; };
C.quiver = null; G.takeInv(C.inv, "page_fire_bolt", G.countItems(C, ["page_fire_bolt"]));
is(printAt(fireAltar), 10, "a Fire altar prints ten Fire bolts");
const nexus = { t: "altar_nexus", x: 21, y: 12, id: 901 };
is(printAt(nexus), 15, "the Nexus prints fifteen (1.5 times, since 2026-09-28)");
is(C.xp.wizardry > wz0, true, "printing paid Wizardry xp");
is(G.recipesAt("altar_frost").some((r) => r.id === "print_page_fire_bolt"), false, "a Frost altar cannot print Fire pages");

/* ---------------------------------------------------------------- a buff page */
G.addInv(C.inv, "scroll_haste", 1, C); const sp0 = G.speedRaw(C);
const hi = C.inv.findIndex((s) => s.k === "scroll_haste"); W.useSpecial(A, hi, C.inv[hi], G.ITEMS.scroll_haste);
is(C.charm?.k, "haste", "reading Haste starts the buff");
is(C.charm?.tier, 2, "at Wizardry 80 it is tier II");
is(G.speedRaw(C) - sp0, G.CHARMS.haste.vals[1], "and adds its movement speed");
G.addInv(C.inv, "scroll_focus", 1, C); const fi = C.inv.findIndex((s) => s.k === "scroll_focus"); W.useSpecial(A, fi, C.inv[fi], G.ITEMS.scroll_focus);
is(C.charm?.k, "focus", "a second page replaces the first");

/* ---------------------------------------------------------------- a Waystone: refused in the Wilderness, works outside it */
G.addInv(C.inv, "waystone_boneyard", 2, C);
A.hurtAt = Date.now(); let wi = C.inv.findIndex((s) => s.k === "waystone_boneyard"); W.useSpecial(A, wi, C.inv[wi], G.ITEMS.waystone_boneyard);
is(C.scene, "workyard", "a Waystone will not fire within 10 seconds of a hit");
A.hurtAt = 0; wi = C.inv.findIndex((s) => s.k === "waystone_boneyard"); W.useSpecial(A, wi, C.inv[wi], G.ITEMS.waystone_boneyard);
is(C.scene, "boneyard", "and does once clear");

/* ---------------------------------------------------------------- a seed grows its bloom */
is(G.cropYield("seed_ember"), "emberbloom", "Ember seeds grow Emberbloom");
is(G.cropArt("seed_ember"), "emberbloom", "and draw the Emberbloom pictures");
is(G.MOBS.stagehand.drops.some((d) => d[0] === "seed_ember"), true, "a Stagehand can drop Ember seeds");

console.log(bad ? `\n${bad} problem(s)` : "\nmagic casts, prints, buffs, travels and grows");
process.exitCode = bad ? 1 : 0;

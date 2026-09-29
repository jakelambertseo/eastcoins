/* DOES A BOW ONLY FIRE WHAT IS IN ITS QUIVER? —  node tools/eastscape-ammo-test.mjs
   (2026-09-27, the owner: "users magic pouches and quivers being empty but keeping firing, switching spells, switching arrows, etc.
   users are abusing it") The real World with storage stubbed. A bow with a bag full of arrows and no quiver does not fire; an empty
   quiver does not fire; a Magic Bag does not feed a bow and a quiver does not feed a wand; every shot takes one from the quiver and the
   last one stops the fight; swapping arrow kinds hands the old load back; a smaller quiver cannot carry more than it holds; a load
   left with no pouch comes back to the bag at login; and a pocket count that is not a whole number cannot fire for free. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
await new Promise((r) => setTimeout(r, 50));
const S = W.scene("workyard"), C = G.freshChar(); C.inv = []; C.xp.archery = G.XP_AT[60]; C.xp.magic = G.XP_AT[60]; C.xp.hp = G.XP_AT[60]; C.hp = G.maxHpOf(C);
const pl = { id: "u1", login: "u1", name: "Archer", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
W.pls.set("u1", pl); C.scene = S.key;
const said = () => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";
const mob = S.mobs.find((m) => !m.dead); pl.x = mob.x + 2; pl.y = mob.y; mob.hp = 1e9;
const swing = (t) => { pl.act = { kind: "mob", id: mob.id, x: mob.x, y: mob.y, started: 1 }; pl.lastInput = t; pl.lastSwing = 0; W.doAction(S, pl, t); return !!pl.act; };   /* started: past the opener, so the first call swings */
let t = Date.now();

/* 1. a bow with a bag full of arrows and no quiver does not fire */
C.eq.weapon = "logs_shortbow"; G.addInv(C.inv, "bone_arrow", 1000, C);
is(G.ammoOf(C), null, "no quiver: nothing to fire, whatever the bag holds");
is(swing(t += 5000), false, "and the swing is refused"); is(/quiver/.test(said()), true, "with a line that says to wear a quiver");
/* 2. an empty quiver does not fire; loading it does */
C.eq.shield = "logs_quiver"; C.quiver = null;
is(swing(t += 5000), false, "an empty quiver: refused"); is(/empty/i.test(said()), true, "and told it is empty");
W.quiverOp(pl, { op: "load", i: C.inv.findIndex((s) => s.k === "bone_arrow") });
is(C.quiver?.n, 300, "loading fills it to its size (300)"); is(G.countItems(C, ["bone_arrow"]), 700, "from the bag");
const n0 = C.quiver.n; swing(t += 5000); is(n0 - C.quiver.n, 1, "a shot takes one from the quiver"); is(G.countItems(C, ["bone_arrow"]), 700, "and none from the bag");
/* 3. the last arrow stops the fight, with 700 still in the bag */
C.quiver.n = 1; swing(t += 5000); is(C.quiver, null, "the last arrow empties the quiver"); is(swing(t += 5000), false, "and the next swing is refused"); is(G.countItems(C, ["bone_arrow"]), 700, "the bag's 700 untouched");
/* 4. a wand does not fire arrows and a bow does not fire pages */
W.quiverOp(pl, { op: "load", i: C.inv.findIndex((s) => s.k === "bone_arrow") });
C.eq.weapon = "logs_wand"; is(G.ammoOf(C), null, "a wand with a loaded quiver has nothing to cast"); is(swing(t += 5000), false, "refused"); is(/Magic Bag/.test(said()), true, "and told to wear a Magic Bag");
C.eq.weapon = "logs_shortbow";
/* 5. a whole-number pocket: a fractional or NaN count cannot fire for free */
C.quiver = { k: "bone_arrow", n: 0.5 }; is(G.ammoOf(C), null, "half an arrow is nothing"); C.quiver = { k: "bone_arrow", n: NaN }; is(G.ammoOf(C), null, "NaN is nothing"); C.quiver = { k: "bone_arrow", n: 2.7 }; swing(t += 5000); is(C.quiver?.n, 1, "2.7 arrows fire as 2: one shot leaves 1");
/* 6. switching arrows: the old load comes back, the new one goes in */
C.quiver = { k: "bone_arrow", n: 50 }; G.addInv(C.inv, "bronze_arrow", 30, C); const bone0 = G.countItems(C, ["bone_arrow"]);
W.quiverOp(pl, { op: "load", i: C.inv.findIndex((s) => s.k === "bronze_arrow") });
is([C.quiver?.k, C.quiver?.n], ["bronze_arrow", 30], "clicking bronze arrows swaps them in"); is(G.countItems(C, ["bone_arrow"]) - bone0, 50, "and the 50 bone arrows are back in the bag");
/* 7. a smaller pouch cannot carry the bigger one's load */
C.eq.shield = "yewlogs_quiver"; C.quiver = { k: "bronze_arrow", n: 900 }; G.addInv(C.inv, "logs_quiver", 1, C);
W.equip(pl, C.inv.findIndex((s) => s.k === "logs_quiver"));
is([C.eq.shield, C.quiver?.n], ["logs_quiver", 300], "swapping to a rough quiver keeps 300"); is(G.countItems(C, ["bronze_arrow"]), 600, "and 600 go back to the bag");
/* 8. a load with no pouch to hold it comes back at login */
C.eq.shield = null; C.quiver = { k: "bronze_arrow", n: 40 }; W.pls.delete("u1");
const p2 = { ...pl, out: [] }; W.pls.set("u1", p2);
{ const before = G.countItems(C, ["bronze_arrow"]); if (C.quiver && !(G.pouchOf(C) && G.pouchOf(C).pouch.ammo === G.ammoKind(C.quiver.k))) W.pocketOut(p2); is([C.quiver, G.countItems(C, ["bronze_arrow"]) - before], [null, 40], "the join's sweep hands an orphaned load back"); }
W.pls.set("u1", pl);   /* the real player object back, so the monster's claim is his again */
/* 9. the Magic Bag, the same way */
C.eq.weapon = "logs_wand"; C.eq.shield = "bag_scrap"; C.quiver = null; const page = Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].ammo?.kind === "page").sort((a, b) => (G.ITEMS[a].req?.lvl || 0) - (G.ITEMS[b].req?.lvl || 0))[0];
G.addInv(C.inv, page, 20, C); is(swing(t += 5000), false, "a wand with pages in the bag and an empty Magic Bag: refused");
W.quiverOp(pl, { op: "load", i: C.inv.findIndex((s) => s.k === page) }); const c0 = C.quiver.n; swing(t += 5000); is(c0 - C.quiver.n, 1, "loaded, a cast takes one page from the bag's pocket");
console.log(bad ? `\n${bad} problem(s)` : "\nammo is honest: only a loaded pouch of the right kind fires, one round a shot");
process.exitCode = bad ? 1 : 0;

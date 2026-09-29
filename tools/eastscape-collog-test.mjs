/* THE COLLECTION LOG —  node tools/eastscape-collog-test.mjs
   (2026-09-27, the owner: "build the collection log ... a free item at yasmeena that people can place down on their island") The real World over
   a storage in memory: the book has its tabs (events among them), a slot fills the first time an item comes from the world and says so, the
   bank and an unsold Exchange offer coming back do not fill one, a pet counts, what a character already held is written in once on load, the
   podium is free at Yahsmeena and shows its owner's log to its owner and to a visitor (online or not), and the bag's "Used in" knows the
   Foundry's drops. */
import "./eastscape-open-all.mjs";
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
import { createDecorRules } from "../v3/assets/js/eastscape-decor-rules.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const B = G.collectionBook(), DR = createDecorRules(G);
is(B.tabs.map((t) => t.id), ["bosses", "rares", "skilling", "pets", "finds", "chase", "cards", "events"], "the tabs, events last");
is(B.tabs.find((t) => t.id === "events").sections[0].name, G.EVENT_TAG, "the events tab has a section per event");
is(B.total > 60 && B.keys.has("deepheart") && B.keys.has("bessemergloves") && B.keys.has("pet:potboy") && !B.keys.has("copper") && !B.keys.has("tickets"), true, "the chase rings, a pet in; ore and tickets out");
const player = (id) => { const C = G.freshChar(); const pl = { id, name: id, C, x: 1, y: 1, out: [], path: [] }; W.pls.set(id, pl); return pl; };
const says = (pl) => pl.out.filter((e) => e.type === "say" || e.type === "msg" || e.text).map((e) => e.text || e.msg || "").join(" | ");

/* 1: the first one from the world fills the slot and says so; the second only counts */
{ const pl = player("a"); W.give(pl, "angels_ring", 1); is([pl.C.col.angels_ring, /New collection log slot: Angel's ring/.test(says(pl)), pl.out.some((e) => e.type === "colnew")], [1, true, true], "a drop fills the slot, with a message and a chime");
  pl.out = []; W.give(pl, "angels_ring", 1); is([pl.C.col.angels_ring, /New collection log/.test(says(pl))], [2, false], "a second one only counts");
  W.give(pl, "copper", 5); is(pl.C.col.copper, undefined, "ore is not in the book");
  W.keepRare(pl, "deepheart", 1); is(pl.C.col.deepheart, 1, "a rare kept (bag or bank) counts"); }
/* 2: your own bank, and your own unsold offer, do not fill slots */
{ const pl = player("b"); pl.C.bank.push({ k: "gamblers_ring", n: 1 });
  const S = W.scene("workyard"); pl.C.scene = "workyard"; const booth = S.objs.find((o) => o.t === "booth" || o.t === "bank"); if (booth) { pl.x = booth.x + 1; pl.y = booth.y; }
  W.bankOp(S, pl, { t: "bank", op: "wd", i: 0, n: 1 });
  is([G.countItems(pl.C, ["gamblers_ring"]), pl.C.col?.gamblers_ring], [1, undefined], "out of your own bank: in the bag, not in the log");
  is(pl.noCol, false, "and the flag comes back down"); }
/* 3: a pet counts as pet:<kind> */
{ const pl = player("c"); W.colGet(pl, "pet:potboy", 1); is(pl.C.col?.["pet:potboy"], 1, "a pet fills its slot"); }
/* 4: what a character already held is written in, once, quietly */
{ const C = G.freshChar(); C.inv.push({ k: "bookies_amulet", n: 1 }); C.bank.push({ k: "opal", n: 3 }); C.pets.push({ id: "p1", k: "pocketowl" }); C.eq.ring = "angels_ring";
  W.colSeed(C); is([C.col.bookies_amulet, C.col.opal, C.col["pet:pocketowl"], C.col.angels_ring, C.colSeeded], [1, 1, 1, 1, 1], "seeded from the bag, bank, pets and what is worn");
  C.inv.push({ k: "gamblers_ring", n: 1 }); W.colSeed(C); is(C.col.gamblers_ring, undefined, "and only the first time"); }
/* 5: a saved log survives a load, cleaned */
{ const C = G.normChar({ col: { angels_ring: 3, bogus: -2, opal: "7" } }); is(C.col, { angels_ring: 3, opal: 7 }, "normChar keeps whole positive counts"); }
/* 6: the podium: first in the shop, free, one each; placed, it opens its owner's log for the owner and for a visitor */
{ is(Object.keys(DR.DECOR)[0], "podium", "the podium is the first piece in Yahsmeena's shop"); is([DR.DECOR.podium.price, DR.DECOR.podium.max, DR.DECOR.podium.isNew], [0, 1, true], "free, one each, marked new");
  const pl = player("owner"); pl.C.isle = { tier: 1, owned: {}, decor: [], shelf: [] }; const key = G.isleKey(pl.C.isle, pl.id); const S = W.scene(key); S.owner = pl.id; pl.C.scene = key;
  const y = S.npcs.find((n) => n.name === "Yahsmeena"); if (y) { pl.x = y.x + 1; pl.y = y.y; }
  pl.C.inv = pl.C.inv.filter((s) => s.k !== "tickets");
  W.decorOp(S, pl, { t: "decor", op: "buy", k: "podium" }); is(pl.C.isle.owned.podium, 1, "taken with no tickets at all");
  W.decorOp(S, pl, { t: "decor", op: "buy", k: "podium" }); is(pl.C.isle.owned.podium, 1, "and only one");
  const built = DR.decorInto(key, G.buildScene(key), { decor: [{ k: "podium", x: 5, y: 5, at: DR.decorAt(key) }] }), ob = built.objs.find((o) => o.k === "podium");
  is(ob?.t, "podium", "a placed podium is a podium object, not scenery");
  W.give(pl, "angels_ring", 1); pl.out = [];
  W.doAction(S, pl, Date.now()); pl.act = { kind: "podium", ob, x: ob.x, y: ob.y, started: 0 }; pl.x = ob.x; pl.y = ob.y + 1; W.doAction(S, pl, Date.now());
  const m = pl.out.find((e) => e.type === "collog"); is([m?.mine, m?.col?.angels_ring], [true, 1], "its owner reads their own log");
  const v = player("visitor"); v.C.scene = key; v.x = ob.x; v.y = ob.y + 1; v.act = { kind: "podium", ob, x: ob.x, y: ob.y, started: 0 }; W.doAction(S, v, Date.now());
  const mv = v.out.find((e) => e.type === "collog"); is([mv?.mine, mv?.name, mv?.col?.angels_ring], [false, "owner", 1], "a visitor reads the owner's log");
  W.pls.delete("owner"); S.colCopy = pl.C.col; v.out = []; v.act = { kind: "podium", ob, x: ob.x, y: ob.y, started: 0 }; W.doAction(S, v, Date.now());
  is(v.out.find((e) => e.type === "collog")?.col?.angels_ring, 1, "and still after the owner has gone, from the copy kept when they left"); }
/* 7: the bag's Used in */
is(G.usesOf("slag").map((u) => u.what), ["Eclipse bar", "Nova bar", "Slag Run"], "slag: the two blast batches and Basalt's quest");
is(G.usesOf("emberglass").map((u) => u.what), ["Emberglass tonic"], "emberglass: the tonic");
is(G.usesOf("feather").some((u) => u.what === "Feather"), false, "a recipe that gives the same thing back is not a use");
is(G.usesOf("spawn_puffball")[0]?.what, "Planting a fungus bed", "spawn: planting");
console.log(bad ? `\n${bad} problem(s)` : "\nthe collection log works: the book, first slots, the bank and trades left out, pets, the seed, the podium, and Used in");
process.exitCode = bad ? 1 : 0;

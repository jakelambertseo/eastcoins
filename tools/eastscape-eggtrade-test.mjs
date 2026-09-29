/* NESTOR THE EGG MAN —  node tools/eastscape-eggtrade-test.mjs
   (2026-09-28, the owner: "a pet trader NPC ... trade raw thematically same items for pet eggs ... in the yard, in the court at tile 25 15")
   The real World: Nestor stands at 25,15 in the Yard, every egg has a trade whose items are real and not held, a trade takes exactly the price
   and gives the egg, one short refuses and takes nothing, and he will not trade from across the map. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("workyard"), n = S.npcs.find((x) => x.name === "Nestor the Egg Man");
is([n?.x, n?.y, n?.opens], [25, 15, "eggtrade"], "Nestor stands in the Yard's court, at 25,15");
{ const g = G.buildScene("workyard").g; is([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => G.walkableIn(g, 25 + dx, 15 + dy)), true, "with open ground beside him (the river's bank runs under him since 2026-09-29)"); }
is(Object.keys(G.EGGS).every((e) => G.EGG_TRADES[e]), true, "every egg has a trade");
is(Object.values(G.EGG_TRADES).flat().every(([k, q]) => G.ITEMS[k] && q > 0), true, "and every price is real items");
const pl = { id: "t", name: "t", C: G.freshChar(), x: 25, y: 16, out: [], path: [] }; W.pls.set(pl.id, pl); pl.C.scene = "workyard";
G.addInv(pl.C.inv, "pork", 150, pl.C); G.addInv(pl.C.inv, "puffball", 49, pl.C);
W.eggTrade(S, pl, { k: "egg_truffle" }); is([G.countItems(pl.C, ["egg_truffle"]), G.countItems(pl.C, ["pork"]), G.countItems(pl.C, ["puffball"])], [0, 150, 49], "one puffball short: refused, nothing taken");
G.addInv(pl.C.inv, "puffball", 1, pl.C); W.eggTrade(S, pl, { k: "egg_truffle" });
is([G.countItems(pl.C, ["egg_truffle"]), G.countItems(pl.C, ["pork"]), G.countItems(pl.C, ["puffball"])], [1, 0, 0], "150 raw boar and 50 puffballs make a Truffle-scented egg");
G.addInv(pl.C.inv, "pork", 150, pl.C); G.addInv(pl.C.inv, "puffball", 50, pl.C); pl.x = 5; pl.y = 5; W.eggTrade(S, pl, { k: "egg_truffle" });
is(G.countItems(pl.C, ["egg_truffle"]), 1, "not from across the Yard");
is(G.usesOf("pork").some((u) => u.what === "Truffle-scented egg"), true, "the bag's Used in names the trade");
console.log(bad ? `\n${bad} problem(s)` : "\nNestor works: his stand, every egg's price, the trade, a short refused, and Used in");
process.exitCode = bad ? 1 : 0;

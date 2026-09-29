/* TINKERING —  node tools/eastscape-tinker-test.mjs
   (2026-09-28) The real World with storage stubbed, Tinkering opened as on the dev server, standing at Sprocket Sal's Scrap Bench: a stack
   salvages into exactly the parts salvageOf says, out of the bag and into the pouch, and pays its part value as Tinkering xp; the lot takes
   plain drops and never gear, bars, food or a favourite; a reforged piece is salvaged by its level; away from the bench nothing happens;
   and the pouch survives a save. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("workyard"), bench = S.objs.find((o) => o.t === "scrapbench");
is([!!bench, !!S.npcs.find((n) => n.name === G.TINK.npc)], [true, true], "Sal and her bench are in the Yard (Tinkering open)");
const pl = { id: "t1", name: "t1", C: G.freshChar(), x: bench.x + 1, y: bench.y, out: [], path: [] }; pl.C.scene = "workyard"; W.pls.set("t1", pl);
const C = pl.C, cnt = (k, f) => C.inv.filter((s) => s.k === k && (f == null || (G.fOf(s) | 0) === f)).reduce((a, s) => a + s.n, 0), last = (t) => [...pl.out].reverse().find((e) => e.type === t);

/* 1. one stack */
G.addInv(C.inv, "bones", 46, C); const want = G.salvageOf("bones", 46), xp0 = C.xp.tinkering || 0;
W.tinkerOp(S, pl, { op: "salvage", k: "bones" });
is([cnt("bones"), C.parts.scrap, (C.xp.tinkering || 0) - xp0], [0, want.scrap, want.pv], "46 bones: gone from the bag, their scrap in the pouch, their part value as xp");

/* 2. the lot: plain drops only */
G.addInv(C.inv, "pit", 30, C); G.addInv(C.inv, "husk", 10, C); G.addInv(C.inv, "cchicken", 5, C); G.addInv(C.inv, "bronze_bar", 3, C); G.addInv(C.inv, "feather", 20, C);
C.inv.push({ k: "bronze_helm", n: 1 }); C.fav = ["feather"];
W.tinkerOp(S, pl, { op: "salvage", lot: true });
is([cnt("pit"), cnt("husk"), cnt("cchicken"), cnt("bronze_bar"), cnt("bronze_helm"), cnt("feather")], [0, 0, 5, 3, 1, 20], "the lot takes pits and husks; never food, bars, gear or a favourite");
C.fav = [];

/* 3. gear, and a reforged piece by its level */
C.inv.push({ k: "bronze_helm", n: 1, f: 3 }); const g3 = G.salvageOf("bronze_helm", 1, 3), gears0 = C.parts.gears;
W.tinkerOp(S, pl, { op: "salvage", k: "bronze_helm", f: 3 });
is([cnt("bronze_helm", 3), cnt("bronze_helm", 0), C.parts.gears - gears0], [0, 1, g3.gears], "the +3 helm goes, at its level; the plain one stays");

/* 4. never money or an egg; away from the bench nothing */
G.addInv(C.inv, "tickets", 500, C); W.tinkerOp(S, pl, { op: "salvage", k: "tickets" }); is(G.tixIn(C) >= 500, true, "tickets can't be salvaged");
pl.x = 30; pl.y = 5; const s0 = C.parts.scrap; G.addInv(C.inv, "pit", 10, C); W.tinkerOp(S, pl, { op: "salvage", k: "pit" });
is([cnt("pit"), C.parts.scrap], [10, s0], "away from the bench: nothing taken, nothing given");

/* 5. the pouch survives a save */
const round = G.normChar(JSON.parse(JSON.stringify(C)));
is(round.parts, C.parts, "the pouch survives a save");
is(!!last("tinker")?.view?.parts, true, "the window is told the pouch");

console.log(bad ? `\n${bad} problem(s)` : "\nTinkering's salvage works: parts by the rules, the lot is safe, reforges by level, only at the bench, and it saves");
process.exitCode = bad ? 1 : 0;

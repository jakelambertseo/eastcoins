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

/* 6. GADGETS: building */
pl.x = bench.x + 1; pl.y = bench.y; W.hwTick = () => {}; W.pitTick = async () => {}; W.songTick = () => {};
C.parts = { scrap: 1000, gears: 100, sparks: 100, relic: 10 }; G.addInv(C.inv, "tickets", 5000, C); C.xp.tinkering = 0;
W.tinkerOp(S, pl, { op: "build", id: "whetstone" }); is(cnt("tk_whetstone"), 0, "a Tinkering 12 build at level 1 is refused");
C.xp.tinkering = G.XP_AT[30]; W.grant(pl, "tinkering", 1);   /* (the level-30 achievements pay tickets: settle them before measuring the fee) */
const t0 = G.tixIn(C), s1 = C.parts.scrap, xpb = C.xp.tinkering;
W.tinkerOp(S, pl, { op: "build", id: "whetstone" }); const g = G.GADGETS.whetstone;
is([cnt("tk_whetstone") >= 1, t0 - G.tixIn(C), s1 - C.parts.scrap, C.xp.tinkering > xpb], [true, g.fee, g.parts.scrap, true], "a Whetstone: parts and the fee gone, the gadget in the bag, xp paid");
const before = { ...C.parts }; C.parts.gears = 0; W.tinkerOp(S, pl, { op: "build", id: "bellows" }); is(cnt("tk_bellows"), 0, "short of parts: refused, nothing taken"); C.parts = before;

/* 7. using one: a timed gadget runs, can't be doubled, counts down and breaks into a little scrap */
const useK = (k) => W.useItem(pl, C.inv.findIndex((s) => s.k === k));
pl.x = 30; pl.y = 5;   /* out in the Yard, where buff clocks run */
useK("tk_whetstone"); is([!!C.tk?.whetstone, G.tkDmg(C, "melee")], [true, g.dmg.melee], "the Whetstone is running: melee damage up");
G.addInv(C.inv, "tk_whetstone", 1, C); useK("tk_whetstone"); is(cnt("tk_whetstone"), 1, "a second one while it runs is refused and kept");
const sc = C.parts.scrap; C.tk.whetstone.left = 900; let t = Date.now(); pl.fxAt = t; for (let i = 0; i < 40; i++) { t += 50; W.tickTimed(t); }
is([!!C.tk.whetstone, C.parts.scrap - sc], [false, Math.floor(g.parts.scrap * 0.1)], "it runs out and hands back a tenth of its scrap");

/* 8. the Medkit heals; the Humidifier adds xp; the bomb arms; the banner reaches the party */
G.addInv(C.inv, "tk_medkit", 1, C); C.xp.hp = G.XP_AT[40]; C.hp = 5; useK("tk_medkit"); pl.fxAt = t; for (let i = 0; i < 120; i++) { t += 50; W.tickTimed(t); }
is(C.hp > 5, true, `the Medkit heals over time (5 -> ${C.hp})`);
G.addInv(C.inv, "tk_humidifier", 1, C); useK("tk_humidifier"); const f0 = C.xp.fungiculture || 0; W.grant(pl, "fungiculture", 100); is((C.xp.fungiculture || 0) - f0, 125, "the Humidifier: 100 xp becomes 125");
G.addInv(C.inv, "tk_bomb", 1, C); useK("tk_bomb"); is(C.tkBomb, G.GADGETS.bomb.bomb, "the Boss Bomb is armed");
const mate = { id: "t2", name: "t2", C: G.freshChar(), x: pl.x + 2, y: pl.y, out: [], path: [] }; mate.C.scene = "workyard"; W.pls.set("t2", mate);
W.parties ||= new Map(); W.parties.set("pp", { id: "pp", leader: "t1", members: ["t1", "t2"] }); pl.party = mate.party = "pp";
G.addInv(C.inv, "tk_banner", 1, C); useK("tk_banner"); is([!!C.tk.banner_buff, !!mate.C.tk?.banner_buff, G.fxOf(mate.C).tough >= 0.05], [true, true, true], "the Party Banner buffs you and your party");
G.addInv(C.inv, "tk_confetti", 3, C); mate.out = []; useK("tk_confetti"); is([cnt("tk_confetti"), !!mate.out.find((e) => e.type === "confetti")], [2, true], "confetti: one shot used, everyone around sees it");

/* 9. THE AUTOMATION TOOLS: slower only while nobody is there, and on to the next rock of the same ore */
const miner = { id: "m1", name: "m1", C: G.freshChar(), x: 5, y: 8, out: [], path: [], lastInput: Date.now() }; miner.C.scene = "workyard"; W.pls.set("m1", miner);
const now9 = Date.now(); miner.C.tk = { auger: { left: 600000 } };
is([W.tkSlow(miner, now9, "rock"), (miner.lastInput = now9 - 10 * 60000, Math.round(W.tkSlow(miner, now9, "rock") * 100) / 100), W.tkSlow(miner, now9, "tree")], [1, 1.33, 1], "the Auger: full speed while you're there, 75% while you're away, nothing for trees");
const rocks = S.objs.map((o, i) => [o, i]).filter(([o]) => o.t === "rock" && o.ore === "copper"), [r0] = rocks[0];
miner.x = r0.x + 1; miner.y = r0.y; miner.act = null; W.tkNext(S, miner, r0, "rock");
const went = S.objs[miner.act?.ob ?? -1] || (miner.act && S.objs.find((o) => o.x === miner.act.x && o.y === miner.act.y));
is([!!miner.act, went && went !== r0 && went.ore === "copper"], [true, true], "a rock runs dry: the Auger walks you to the next copper rock");
miner.act = null; miner.C.tk = {}; W.tkNext(S, miner, r0, "rock"); is(miner.act, null, "without an Auger: you stop, as ever");

console.log(bad ? `\n${bad} problem(s)` : "\nTinkering works: salvage by the rules and safe, gadgets built, used and broken, and the automation tools carry on while you're away");
process.exitCode = bad ? 1 : 0;

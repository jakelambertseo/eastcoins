/* GEMS —  node tools/eastscape-gems-test.mjs
   (2026-09-28, rebuilt 2026-09-29 with the gem bag) The real World with storage stubbed, opened as on the dev server. A sorted gem keeps
   its roll through the bag, the bank and a save; a reforged piece keeps its level (a sealed +4 included) and carries nothing else; the
   Sorter stands in the Yard and sorts, re-rolls and sells there and nowhere else; the gem bag takes each gem on its own side only, opens
   its slots for their prices, gives a gem back with its roll, and counts only the best two of any one gem; the gems do what they say; and
   the odds are the odds. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);

/* 1. the codes: a gem's roll, a piece's level, nothing else */
is([G.codeOk("ruby", G.gemCode(10)), G.codeOk("ruby", G.gemCode(11)), G.codeOk("nova_sword", 4), G.codeOk("nova_sword", 5), G.codeOk("nova_sword", 12), G.codeOk("logs", 1)], [true, false, true, false, false, false], "real codes only: a gem up to +10, a piece up to +4, nothing on logs");
is([G.fOf({ f: 4 }), G.forgeNameAt("nova_sword", 4), G.forgeNameAt("ruby", G.gemCode(-3)), G.forgeNameAt("ruby", 0)], [4, "Nova halberd +4", "Ruby -3%", "Ruby (unsorted)"], "names: a sealed +4 stays +4; a gem says its roll");
{ const c = G.freshChar(); c.inv = [{ k: "ruby", n: 2, f: G.gemCode(9) }, { k: "nova_sword", n: 1, f: 4 }, { k: "nova_sword", n: 1, f: 99 }];
  c.eq.weapon = "nova_sword"; c.eqf = { weapon: 3 }; c.gembag = { cn: 2, sn: 1, c: [{ k: "ruby", roll: 10 }, { k: "topaz", roll: 5 }], s: [{ k: "topaz", roll: 7 }] };
  const o = G.normChar(JSON.parse(JSON.stringify(c))), rubies = o.inv.filter((s) => s.k === "ruby"), swords = o.inv.filter((s) => s.k === "nova_sword").map((s) => G.fOf(s));
  is([rubies.every((s) => G.rollOf(s) === 9), rubies.reduce((a, s) => a + s.n, 0), rubies.map((s) => s.n), swords, o.eqf.weapon, o.gembag], [true, 2, [1, 1], [4, 3], 3, { cn: 2, sn: 1, c: [{ k: "ruby", roll: 10 }, null], s: [{ k: "topaz", roll: 7 }] }],
    "a save and a load: sorted gems keep their rolls and count (as single items: a stack of two is split), a +4 stays +4, a junk code keeps only a level, and the bag keeps what fits each side"); }

/* 2. the Sorter stands in the Yard's north court, and works only there */
const S = W.scene("workyard"), sorter = S.objs.find((o) => o.t === "gemsorter");
is([!!sorter, sorter?.x, sorter?.y], [true, 30, 9], "the Gem Sorter stands in the Yard's north court");
const pl = { id: "p1", name: "Pip", login: "pip", C: G.freshChar(), x: 5, y: 5, out: [], path: [], admin: false }; pl.C.scene = "workyard"; W.pls.set("p1", pl);
const C = pl.C; G.addInv(C.inv, "tickets", 900000, C); G.addInv(C.inv, "ruby", 3, C); G.addInv(C.inv, "topaz", 2, C);
{ const n0 = G.tixIn(C); W.gemOp(S, pl, { op: "sort", i: C.inv.findIndex((s) => s.k === "ruby") }); is(G.tixIn(C), n0, "across the Yard from the bench: no roll"); }
pl.x = sorter.x; pl.y = sorter.y + 1;
const t0 = G.tixIn(C); W.gemOp(S, pl, { op: "sort", i: C.inv.findIndex((s) => s.k === "ruby" && !G.fCode(s)) });
const ruby = () => C.inv.find((s) => s.k === "ruby" && G.fCode(s));
is([t0 - G.tixIn(C), C.inv.filter((s) => s.k === "ruby" && !G.fCode(s)).reduce((a, s) => a + s.n, 0), G.rollOf(ruby()) >= -5 && G.rollOf(ruby()) <= 10], [G.GEMSET.cost, 2, true], `sort: one ruby off the stack of three, rolled ${G.rollOf(ruby())}%, for 10,000`);
{ const r = Math.random; Math.random = () => 0.9999; W.gemOp(S, pl, { op: "sort", i: C.inv.indexOf(ruby()) }); Math.random = r; }   /* (a perfect is 1 in 213: the dice are forced) */
is([G.rollOf(ruby()), said.some((t) => /PERFECT ruby/.test(t))], [10, true], "re-rolled until perfect, and the room hears about it");
{ const t1 = G.tixIn(C); W.gemOp(S, pl, { op: "sell", i: C.inv.findIndex((s) => s.k === "ruby" && !G.fCode(s)) }); is(G.tixIn(C) - t1, G.GEMSET.sell, "sell one back: a flat 1,500"); }

/* 3. the gem bag: anywhere, each gem on its own side, slots for tickets, out with its roll */
pl.x = 5; pl.y = 5;
is([G.bagOf(C).cn, G.bagOf(C).sn, G.bagPrice(C, "c"), G.bagPrice(C, "s")], [1, 1, 25000, 25000], "a new bag: one combat and one skilling setting, the next of each 25,000");
W.gemOp(S, pl, { op: "sort", i: 0 });   /* (not at the bench: refused, and nothing charged) */
W.gemOp(S, pl, { op: "put", side: "c", slot: 0, i: C.inv.findIndex((s) => s.k === "topaz") }); is(G.bagOf(C).c[0], null, "an unsorted topaz won't go in");
G.addInv(C.inv, "topaz", 1, C, G.gemCode(6));
W.gemOp(S, pl, { op: "put", side: "c", slot: 0, i: C.inv.findIndex((s) => s.k === "topaz" && G.fCode(s)) }); is(G.bagOf(C).c[0], null, "a sorted topaz is a skilling gem: not on the combat side");
W.gemOp(S, pl, { op: "put", side: "s", slot: 0, i: C.inv.findIndex((s) => s.k === "topaz" && G.fCode(s)) }); is(G.bagOf(C).s[0], { k: "topaz", roll: 6 }, "on the skilling side it goes in, out here in the Yard");
is(W.tkSlow(pl, Date.now(), "tree") < 1, true, "and chopping is faster (+6%)");
W.gemOp(S, pl, { op: "put", side: "c", slot: 0, i: C.inv.indexOf(ruby()) }); is(G.bagOf(C).c[0], { k: "ruby", roll: 10 }, "the perfect ruby on the combat side");
is([G.gemBonus(C).ruby, G.tkDmg(C, "melee")], [10, 0.1], "+10% melee damage");
{ const t = G.tixIn(C); W.gemOp(S, pl, { op: "open", side: "c" }); W.gemOp(S, pl, { op: "open", side: "c" }); W.gemOp(S, pl, { op: "open", side: "c" });
  is([G.bagOf(C).cn, t - G.tixIn(C), G.bagPrice(C, "c")], [4, 375000, null], "three more combat settings: 25,000 + 100,000 + 250,000, and then it's full");
  W.gemOp(S, pl, { op: "open", side: "c" }); is(G.bagOf(C).cn, 4, "no fifth"); }
{ const poor = { id: "p2", name: "Poor", login: "poor", C: G.freshChar(), x: 5, y: 5, out: [], path: [] }; poor.C.scene = "workyard"; W.pls.set("p2", poor);
  W.gemOp(S, poor, { op: "open", side: "s" }); is(G.bagOf(poor.C).sn, 1, "no tickets: no new setting"); }
W.gemOp(S, pl, { op: "take", side: "s", slot: 0 }); is([G.bagOf(C).s[0], C.inv.some((s) => s.k === "topaz" && G.rollOf(s) === 6)], [null, true], "taken out: the setting is empty and the topaz comes back as it went in, +6%");
{ const T = { gembag: { cn: 4, sn: 1, c: [{ k: "ruby", roll: 10 }, { k: "ruby", roll: 9 }, { k: "ruby", roll: 10 }, { k: "ruby", roll: -5 }], s: [null] } };
  is([G.gemBonus(T).ruby, G.gemRolls(T).ruby.length], [20, 4], "four rubies set (10, 9, 10, -5): only the best two count, +20%"); }
is(G.normChar(JSON.parse(JSON.stringify(C))).gembag.cn, 4, "the bag's settings survive a save");

/* 4. the elements, the odds, the price */
is(G.gemVs({ gembag: { cn: 1, sn: 1, c: [{ k: "carnelian", roll: 10 }], s: [null] } }, "pumpkinking"), 0.1, "a +10% carnelian against the Pumpkin King (weak to fire): +10%");
{ const n = 200000, got = {}; for (let i = 0; i < n; i++) { const r = G.gemRoll(); got[r] = (got[r] || 0) + 1; }
  const near = (r) => Math.abs((got[r] || 0) / n - G.gemOdds(r)) < 0.004, hi = [5, 6, 7, 8, 9, 10].map((r) => G.gemOdds(r));
  is([G.GEMSET.odds.length, G.GEMSET.odds.reduce((a, w) => a + w, 0), Array.from({ length: 16 }, (_, i) => near(i - 5)).every(Boolean), hi.every((p, i) => i === 0 || p < hi[i - 1]), hi[0] < G.gemOdds(4), Math.min(...Object.keys(got).map(Number)), Math.max(...Object.keys(got).map(Number))],
    [16, 213, true, true, true, -5, 10], `the odds: every roll lands as often as the table says, and +5 to +10 each rarer than the last (a perfect ${((got[10] || 0) / n * 100).toFixed(2)}% of the time, 1 in 213 = 0.47%)`); }
is(G.sortCost(), G.GEMSET.cost, "a roll is always 10,000");

/* 5. finding them */
{ const r = Math.random; Math.random = () => 0; C.xp.woodcutting = G.XP_AT[70]; const cnt = () => [...C.inv, ...C.bank].filter((s) => s.k === "topaz").reduce((a, s) => a + s.n, 0), n0 = cnt(); W.gemOnXp(pl, "woodcutting", 25); Math.random = r; is(cnt() - n0, 1, "woodcutting at 70 turns up a topaz (forced roll)"); }

console.log(bad ? `\n${bad} problem(s)` : "\nGems work: codes are what they say, the Sorter sorts at its bench, the bag takes the right gems and grows for tickets, the bonuses add up and cap, and the odds are the odds");
process.exitCode = bad ? 1 : 0;

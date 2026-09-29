/* GEMS —  node tools/eastscape-gems-test.mjs
   (2026-09-28) The real World with storage stubbed and Tinkering opened as on the dev server. A socketed piece and a sorted gem keep
   their whole code through equipping, taking off, the bank and a reforge; the Gem Sorter sorts, re-rolls, sells, punches, sockets
   and pulls (combat gems only, and the roll lost on the way out); the Gem Case takes skilling gems anywhere and grows with its kits;
   the gems do what they say (capped), and the odds are the odds. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
const said = []; W.houseSay = (t) => said.push(t);

/* 1. the code */
const sw = G.withSockets(2, [{ k: "ruby", roll: 8 }, null]);
is([G.fOf({ f: sw }), G.socketsOf(sw), G.forgeNameAt("nova_sword", sw)], [2, [{ k: "ruby", roll: 8 }, null], "Nova halberd +2 [Ruby +8%, empty socket]"], "one number: reforge +2, a ruby at +8% and an empty socket");
is([G.sockMax("nova_sword"), G.sockMax("nova_axe"), G.sockMax("nova_body"), G.sockMax("bronze_sword")], [2, 2, 1, 0], "sockets: two on a level-80 weapon (tools too), one on armour, none below 80");
is([G.codeOk("ruby", G.gemCode(10)), G.codeOk("ruby", G.gemCode(11)), G.codeOk("nova_sword", G.withSockets(0, [{ k: "topaz", roll: 5 }]))], [true, false, false], "the Exchange takes only real codes: no +11, no topaz in a sword");

/* 2. a socketed piece keeps its code when it moves */
const S = W.scene("workyard"), pl = { id: "p1", name: "Pip", login: "pip", C: G.freshChar(), x: 35, y: 15, out: [], path: [], admin: true }; pl.C.scene = "workyard"; W.pls.set("p1", pl);
const C = pl.C; C.xp.melee = G.XP_AT[99]; C.xp.hp = G.XP_AT[99];
G.addInv(C.inv, "nova_sword", 1, C, sw);
W.equip(pl, C.inv.findIndex((s) => s.k === "nova_sword"));
is([C.eq.weapon, G.eqCode(C, "weapon") === sw], ["nova_sword", true], "equipped: the whole code rides in eqf");
W.unequip(pl, "weapon"); is(G.fCode(C.inv.find((s) => s.k === "nova_sword")), sw, "taken off: back on the bag entry, sockets and all");
W.bankOp(S, pl, { op: "dep", i: C.inv.findIndex((s) => s.k === "nova_sword") }); const inBank = C.bank.find((s) => s.k === "nova_sword");
is(G.fCode(inBank), sw, "banked with its code");
W.bankOp(S, pl, { op: "wd", i: C.bank.indexOf(inBank) }); is(G.fCode(C.inv.find((s) => s.k === "nova_sword") || {}), sw, "and out again");
W.equip(pl, C.inv.findIndex((s) => s.k === "nova_sword"));

/* 3. the Sorter: shut until built, then sort, re-roll, sell */
W.projOf("sorter").tier = 1; G.setProjects(W.projTiers());
const D = W.scene("depths"), sorter = D.objs.find((o) => o.t === "gemsorter");
is(!!sorter, true, "the Gem Sorter stands in the Depths at tier 1");
pl.C.scene = "depths"; pl.x = sorter.x; pl.y = sorter.y + 1;
G.addInv(C.inv, "tickets", 500000, C); G.addInv(C.inv, "ruby", 3, C); G.addInv(C.inv, "topaz", 2, C);
const t0 = G.tixIn(C); W.gemOp(D, pl, { op: "sort", i: C.inv.findIndex((s) => s.k === "ruby" && !G.fCode(s)) });
const sortedRuby = C.inv.find((s) => s.k === "ruby" && G.fCode(s));
is([t0 - G.tixIn(C), C.inv.filter((s) => s.k === "ruby" && !G.fCode(s)).reduce((a, s) => a + s.n, 0), G.rollOf(sortedRuby) >= -5 && G.rollOf(sortedRuby) <= 10], [G.GEMSET.cost, 2, true], `sort: one ruby out of the stack of three, rolled ${G.rollOf(sortedRuby)}%, 10,000 tickets`);
for (let k = 0; k < 40 && G.rollOf(sortedRuby) < 10; k++) W.gemOp(D, pl, { op: "sort", i: C.inv.indexOf(sortedRuby) });
is(G.rollOf(sortedRuby), 10, "re-roll until it's perfect");
is(said.some((t) => /PERFECT ruby/.test(t)), true, "a perfect roll is announced");
const t1 = G.tixIn(C); W.gemOp(D, pl, { op: "sell", i: C.inv.findIndex((s) => s.k === "ruby" && !G.fCode(s)) }); is(G.tixIn(C) - t1, G.GEMSET.sell, "sell one back: a flat 1,500");
/* 4. sockets: a punch makes one, only combat gems go in, pulling loses the roll */
W.gemOp(D, pl, { op: "punch", slot: "weapon" }); is(G.socketsOf(G.eqCode(C, "weapon")).length, 2, "the sword already has two: no third");
G.addInv(C.inv, "nova_body", 1, C); W.equip(pl, C.inv.findIndex((s) => s.k === "nova_body"));
W.gemOp(D, pl, { op: "punch", slot: "body" }); is(G.socketsOf(G.eqCode(C, "body")).length, 0, "no Socket Punch in the bag: no socket");
G.addInv(C.inv, "tk_punch", 1, C); W.gemOp(D, pl, { op: "punch", slot: "body" }); is([G.socketsOf(G.eqCode(C, "body")), C.inv.some((s) => s.k === "tk_punch")], [[null], false], "a Socket Punch: an empty socket, the punch used up");
W.gemOp(D, pl, { op: "sort", i: C.inv.findIndex((s) => s.k === "topaz" && !G.fCode(s)) }); const sortedTopaz = C.inv.find((s) => s.k === "topaz" && G.fCode(s));
W.gemOp(D, pl, { op: "socket", slot: "body", s: 0, i: C.inv.indexOf(sortedTopaz) }); is(G.socketsOf(G.eqCode(C, "body")), [null], "a topaz (skilling) won't go in a socket");
W.gemOp(D, pl, { op: "socket", slot: "body", s: 0, i: C.inv.indexOf(sortedRuby) }); is(G.socketsOf(G.eqCode(C, "body")), [{ k: "ruby", roll: 10 }], "the +10% ruby goes in the body's socket");
is([G.gemBonus(C).ruby, G.tkDmg(C, "melee")], [18, 0.18], "the sword's +8 and the body's +10: +18% melee damage");
{ const T = { eq: { weapon: "nova_sword", body: "nova_body", legs: "nova_legs", helm: "nova_helm" }, eqf: { weapon: G.withSockets(0, [{ k: "ruby", roll: 10 }, { k: "ruby", roll: 10 }]), body: G.withSockets(0, [{ k: "ruby", roll: 10 }]), legs: G.withSockets(0, [{ k: "ruby", roll: 9 }]), helm: G.withSockets(0, [{ k: "ruby", roll: -5 }]) } };
  is([G.gemBonus(T).ruby, G.gemRolls(T).ruby.length], [20, 5], "five rubies worn (10, 10, 10, 9, -5): only the best two count, +20%"); }
W.gemOp(D, pl, { op: "pull", slot: "body", s: 0 }); is([G.socketsOf(G.eqCode(C, "body")), C.inv.some((s) => s.k === "ruby" && !G.fCode(s))], [[null], true], "pulled: the socket is empty and the ruby comes back unsorted");
const lvBefore = G.fLevelOf(C, "weapon"); { const code = G.eqCode(C, "weapon"); C.eqf.weapon = code - (code % 4) + 3; } is([G.fLevelOf(C, "weapon"), G.socketsOf(G.eqCode(C, "weapon"))[0]], [3, { k: "ruby", roll: 8 }], "a reforge changes the level bits and leaves the gems");
/* 5. the Gem Case: anywhere, skilling gems only, grows with Sal's kits */
pl.C.scene = "workyard"; pl.x = 20; pl.y = 5;
W.gemOp(S, pl, { op: "case", s: 0, i: C.inv.indexOf(sortedTopaz) }); is(G.caseOf(C).g[0]?.k, "topaz", "the topaz goes in the Gem Case, out in the Yard");
is(W.tkSlow(pl, Date.now(), "tree") < 1, G.rollOf(sortedTopaz) > 0, `and chopping is ${G.rollOf(sortedTopaz) > 0 ? "faster" : "no faster"} (topaz ${G.rollOf(sortedTopaz)}%)`);
G.addInv(C.inv, "jasper", 1, C, G.gemCode(6)); W.gemOp(S, pl, { op: "case", s: 1, i: C.inv.findIndex((s) => s.k === "jasper") }); is(G.caseOf(C).g[1], null, "a combat gem won't go in the case");
W.gemOp(S, pl, { op: "caseout", s: 0 }); is([G.caseOf(C).g[0], C.inv.some((s) => s.k === "topaz" && !G.fCode(s))], [null, true], "out of the case: unsorted again");
G.addInv(C.inv, "tk_caseslot2", 1, C); W.useItem(pl, C.inv.findIndex((s) => s.k === "tk_caseslot2")); is(G.caseOf(C).n, 3, "a Frame won't fit a 3-slot case");
G.addInv(C.inv, "tk_caseslot", 1, C); W.useItem(pl, C.inv.findIndex((s) => s.k === "tk_caseslot")); is([G.caseOf(C).n, C.inv.some((s) => s.k === "tk_caseslot")], [4, false], "a Hinge: 4 slots");
is(G.normChar(JSON.parse(JSON.stringify(C))).gemcase.n, 4, "the case survives a save");
/* 6. the elements, the odds, the prices */
is(G.gemVs({ eq: { weapon: "nova_sword" }, eqf: { weapon: G.withSockets(0, [{ k: "carnelian", roll: 10 }]) } }, "pumpkinking"), 0.1, "a +10% carnelian against the Pumpkin King (weak to fire): +10%");
{ let top = 0, n = 100000; for (let i = 0; i < n; i++) if (G.gemRoll() === 10) top++; is(Math.abs(top / n - 1 / 16) < 0.004, true, `tier 1: a perfect roll ${(top / n * 100).toFixed(2)}% of the time (1 in 16 = 6.25%)`); }
W.projOf("sorter").tier = 3; G.setProjects(W.projTiers());
{ let top = 0, n = 100000; for (let i = 0; i < n; i++) if (G.gemRoll() === 10) top++; is(Math.abs(top / n - (1 - (15 / 16) ** 2)) < 0.005, true, `tier 3's double sort: ${(top / n * 100).toFixed(2)}% (12.1%)`); }
is(G.sortCost(), 7500, "tier 2 onwards: a quarter off");
/* 7. finding them */
{ const r = Math.random; Math.random = () => 0; C.xp.woodcutting = G.XP_AT[70]; const cnt = () => [...C.inv, ...C.bank].filter((s) => s.k === "topaz").reduce((a, s) => a + s.n, 0), n0 = cnt(); W.gemOnXp(pl, "woodcutting", 25); Math.random = r; is(cnt() - n0, 1, "woodcutting at 70 turns up a topaz (forced roll)"); }

console.log(bad ? `\n${bad} problem(s)` : "\nGems work: the code travels, the Sorter sorts, sockets and the case take the right gems, the bonuses add up and cap, and the odds are the odds");
process.exitCode = bad ? 1 : 0;

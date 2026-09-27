/* DOES JEWELCRAFTING WORK? —  node tools/eastscape-jewel-test.mjs
   (2026-09-27) The real World with storage stubbed: the bench stands in the Yard, beads come from the Yard's own copper and tin at level 1,
   a ruby cuts and sets into an emerald ring through the station loop, the ring keeps its metal's numbers and gains the gem's power, the
   power reaches worn gear, and every recipe's parts are real. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("workyard"), bench = S.objs.find((o) => o.t === "jbench");
is(!!bench, true, "the jeweller's bench stands in the Yard");
const C = G.freshChar(); C.inv = C.inv.filter((s) => s.k === "tickets");
const pl = { id: "u1", login: "u1", name: "Jeweller", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now() };
W.pls.set("u1", pl); C.scene = S.key;
for (const [dx, dy] of G.D8) if (G.walkableIn(S.g, bench.x + dx, bench.y + dy)) { pl.x = bench.x + dx; pl.y = bench.y + dy; break; }
const work = (pick, n = 6) => { pl.act = { kind: "jewel", ob: bench, x: bench.x, y: bench.y, pick, started: 0 }; let t = Date.now(); for (let i = 0; i < n && pl.act; i++) { t += 3000; pl.lastInput = t; W.doAction(S, pl, t); } };

/* 1. level 1: the Yard's copper and tin make bronze beads */
G.addInv(C.inv, "copper", 2, C); G.addInv(C.inv, "tin", 2, C);
work("jc_bbead"); is(G.countItems(C, ["bronze_bead"]), 6, "two copper and two tin make six bronze beads at level 1"); is(C.xp.jewelcrafting > 0, true, "and train Jewelcrafting");
/* 2. cut a ruby, set it into an emerald ring */
C.xp.jewelcrafting = G.XP_AT[20]; G.addInv(C.inv, "ruby", 1, C); G.addInv(C.inv, "emerald_ring", 1, C);
work("jc_cutruby"); is(G.countItems(C, ["cut_ruby"]), 1, "a ruby cuts");
work("jc_setrubyring"); is(G.countItems(C, ["emerald_ring_ruby"]), 1, "and sets into an emerald ring"); is(G.countItems(C, ["emerald_ring"]) + G.countItems(C, ["cut_ruby"]), 0, "using up the ring and the stone");
const R = G.ITEMS.emerald_ring_ruby, B = G.ITEMS.emerald_ring;
is(R.acc === B.acc && R.str === B.str && R.def === B.def && R.slot === "ring", true, "the set ring keeps its metal's numbers");
is(R.fx.tough, 0.03, "and gains the ruby's 3% less damage"); is(G.ITEMS.emerald_amulet_ruby.fx.tough, 0.06, "an amulet carries it twice");
C.xp.hp = G.XP_AT[30]; C.eq.ring = "emerald_ring_ruby"; is(G.fxOf(C).tough >= 0.03, true, "worn, the power reaches the game");
/* 3. refusals and the rest */
work("jc_setopalring"); is(/level of 75/i.test(pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || ""), true, "an opal setting says it needs level 75");
const recs = Object.values(G.RECIPES).filter((r) => r.station === "jbench");
is(recs.every((r) => r.skill === "jewelcrafting" && r.in.every(([k]) => G.ITEMS[k]) && G.ITEMS[r.out[0]]), true, `all ${recs.length} bench recipes use and make real items`);
is(Math.min(...recs.map((r) => r.lvl)), 1, "the skill starts at level 1"); is(Math.max(...recs.map((r) => r.lvl)) >= 90, true, "and runs past 90");
is(recs.every((r) => (G.VALUE[r.out[0]] ?? 0) <= 2500), true, "nothing it makes sells past Bom's gear cap");
is(!!G.SKILLS.jewelcrafting && G.HISCORES.some(([k]) => k === "jewelcrafting"), true, "Jewelcrafting is a skill with a hiscore board");
console.log(bad ? `\n${bad} problem(s)` : "\njewelcrafting works: beads, polishing, cutting, setting, the powers");
process.exitCode = bad ? 1 : 0;

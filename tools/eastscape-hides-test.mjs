/* LEATHER FOR KELLZ —  node tools/eastscape-hides-test.mjs
   (2026-09-27, a player: "the Kellz NPC wont accept his hides") The quest's first stage is "gather 6 hides", and hides are a MONSTER DROP,
   which the quest engine did not count. This checks both ways a player gets there: hides looted after accepting, and hides already in the
   bag when they talk to Kellz. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const player = () => { const C = G.freshChar(); const pl = { id: "u" + Math.random(), name: "t", C, x: 1, y: 1, out: [], path: [] }; W.pls.set(pl.id, pl); C.qs.hidesale = { state: "active", stage: 0, n: 0 }; return pl; };
/* 1: hides that drop off cows after the quest is taken */
{ const pl = player(); for (let i = 0; i < 6; i++) { W.give(pl, "hide", 1); W.emit(pl, "loot", { k: "hide", n: 1 }); }
  is(pl.C.qs.hidesale.stage, 1, "six looted hides move the quest to 'bring them'"); }
/* 2: hides already in the bag (bought, banked, or looted before the fix) - talking to Kellz moves it on */
{ const pl = player(); G.addInv(pl.C.inv, "hide", 6, pl.C); is(pl.C.qs.hidesale.stage, 0, "six hides carried, before talking: still on 'gather'");
  const S = W.scene("casino"), k = S.npcs.find((n) => n.name === "Kellz"); pl.C.scene = "casino"; pl.x = k.x + 1; pl.y = k.y;
  pl.act = { kind: "npc", id: k.id, x: k.x, y: k.y, started: 0 }; W.doAction(S, pl, Date.now());
  is(pl.C.qs.hidesale.stage, 1, "talking to Kellz moves it to 'bring them'"); is(pl.out.some((e) => e.type === "talk"), true, "and the conversation still opens"); }
console.log(bad ? `\n${bad} problem(s)` : "\nKellz takes the hides: looted ones count, and carried ones count the moment you talk to him");
process.exitCode = bad ? 1 : 0;

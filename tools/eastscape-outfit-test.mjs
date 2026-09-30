/* THE OUTFITTERS —  node tools/eastscape-outfit-test.mjs
   (2026-09-29) The real World with storage stubbed: Wren and Morwenna stand in the Yard's south court; each sells her style's five-piece sets
   in five tiers and her weapons, and buys them back at Bom's rate and never at a profit; the sets give their style's damage (and an archer's
   speed) and nothing to the other style; a stall far away refuses; a sale in a 2X is not doubled; and longbows are twice as strong. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("cloud"), S2 = W.scene("thunderhead"), wren = S.npcs.find((n) => n.shop === "ranger"), mor = S2.npcs.find((n) => n.shop === "mage");
is([!!wren, !!mor, wren?.name, mor?.name, W.scene("workyard").npcs.some((n) => n.shop)], [true, true, "Wren the Ranger", "Morwenna the Mage", false], "Wren in Cloudreach, Morwenna on the Thunderhead, neither in the Yard");
is([S.objs.some((o) => o.art === "o_rangerstall"), S2.objs.some((o) => o.art === "o_magestall")], [true, true], "each has her stall");
is([G.outfitShelf("ranger").filter((r) => r.kind === "armour").length, G.outfitShelf("mage").filter((r) => r.kind === "armour").length], [25, 25], "five pieces in five tiers each");
is(G.outfitShelf("ranger").concat(G.outfitShelf("mage")).some((r) => /longcount|lastword|^logs_(shortbow|quiver|wand)$|^bag_scrap$/.test(r.k)), false, "no legendary and nothing Bom already sells cheaply");
const pl = { id: "p1", name: "Ari", login: "ari", C: G.freshChar(), x: wren.x, y: wren.y - 1, out: [], path: [] }; pl.C.scene = "cloud"; W.pls.set("p1", pl);
const C = pl.C; G.addInv(C.inv, "tickets", 400000, C);
{ const t0 = G.tixIn(C), row = G.outfitShelf("ranger").find((r) => r.k === "wyvern_body");
  W.outfitOp(S, pl, { shop: "ranger", op: "buy", k: "wyvern_body" });
  is([G.countItems(C, ["wyvern_body"]), t0 - G.tixIn(C)], [1, row.price], `buy a Wyvernhide jerkin for ${row.price}`); }
{ const t0 = G.tixIn(C), i = C.inv.findIndex((s) => s.k === "wyvern_body"); W.doubleStart("Test", 60000);
  W.outfitOp(S, pl, { shop: "ranger", op: "sell", i }); const got = G.tixIn(C) - t0;
  is([got, got === G.gearSell("wyvern_body"), got < G.outfitShelf("ranger").find((r) => r.k === "wyvern_body").price], [got, true, true], "sell it back: Bom's rate, not doubled in a 2X, and far under the price"); W.dbl = null; }
{ W.outfitOp(S, pl, { shop: "mage", op: "buy", k: "silk_robe" }); is(G.countItems(C, ["silk_robe"]), 0, "Morwenna is on another map: refused"); }
{ G.addInv(C.inv, "linen_body", 1, C); const i = C.inv.findIndex((s) => s.k === "linen_body"), t0 = G.tixIn(C); W.outfitOp(S, pl, { shop: "ranger", op: "sell", i }); is([G.tixIn(C) - t0, G.countItems(C, ["linen_body"])], [0, 1], "Wren won't buy a mage's robe"); }
{ const c = G.freshChar(); c.xp.archery = G.XP_AT[90]; c.eq.weapon = "bogwoodlogs_longbow"; const bare = G.maxHitOf(c), sp0 = G.speedBonus(c);
  for (const s of ["helm", "body", "legs", "gloves", "boots"]) c.eq[s] = `voidstalker_${s}`;
  is([Math.round(G.outfitDmg(c, "archery") * 100), G.outfitDmg(c, "magic"), G.maxHitOf(c) > bare, Math.round((G.speedBonus(c) - sp0) * 10) / 10], [10, 0, true, 6], "a full Voidstalker set: +10% archery, nothing to magic, a harder hit, 6% faster");
  const plate = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].tier === "singularity" && G.ITEMS[k].slot === "body");
  is(G.ITEMS.voidstalker_body.def, Math.round(G.ITEMS[plate].def / 2), "half the defence of the plate at its level"); }
is([G.ITEMS.logs_longbow.str, G.ITEMS.bogwoodlogs_longbow.str], [4, 36], "longbows twice as strong (4 + 4 a wood)");
is([G.craftGearPrice("yewlogs_wand") > 0, G.craftGearPrice("bag_conjurer") > 0], [true, true], "wands and bags made with gems have a price again");
/* (2026-09-30) the owner: "yes make the armour reforgeable too". Every piece, with the bars and the Smithing of the plate it matches, at an anvil */
{ const all = Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].outfit);
  is(all.every((k) => G.canForge(k)), true, "every outfit piece can be reforged");
  const plate = Object.keys(G.ITEMS).find((x) => G.ITEMS[x].tier === G.OUTFIT.plate[90] && G.ITEMS[x].slot === "body" && !G.ITEMS[x].event);
  is([JSON.stringify(G.forgeCost("voidstalker_body")), G.ITEMS.voidstalker_body.forgeReq.skill], [JSON.stringify(G.forgeCost(plate)), "smithing"], "with the same bars as its plate, and Smithing");
  is(G.forgeSellStep("voidstalker_body"), G.forgeSellStep(plate), "and a reforge adds to its sale price exactly as it does the plate's"); }
console.log(bad ? `\n${bad} problem(s)` : "\nThe outfitters work: two stalls, five tiers a style, weapons dear, buy-back at Bom's rate and never a profit, and the sets do what they say");
process.exitCode = bad ? 1 : 0;

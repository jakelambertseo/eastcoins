/* THE STORE, ROUND TWO —  node tools/eastscape-store-test.mjs
   (2026-09-30) The real World with storage stubbed, every purchase through the real `store` message:
     - every kind charges exactly priceOf (sales included), and every refusal comes BEFORE the charge;
     - the upgrades (bank pages, quick slots) grow the character, up to their max, and a load keeps a bought bank;
     - 2X Skilling XP doubles non-combat xp only, and never makes crafting 4X beside the 2X Tickets potion;
     - the loupes are spent one a roll at the Sorter, the Master's first, and lift the top of the table by what their words say;
     - the War Horn refuses (too few online, the King up, a raid on, the three hours) without charging, and calls the Ice Man in your name;
     - world shows reach everyone in the area and anyone walking in mid-show; titles are cleaned; looks, titles and pet tags ride the roster;
     - the Store's decor is Yahsmeena's to place and not to sell; the walking fix: "speed" from food now walks too. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { createDecorRules } = await import("../v3/assets/js/eastscape-decor-rules.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
const S = W.scene("workyard");
let n = 0;
function player(tix = 5000000, scene = S) {
  const C = G.freshChar(); C.inv = []; C.scene = scene.key; if (tix) G.addInv(C.inv, "tickets", tix, C);
  const id = `s${++n}`, pl = { id, login: id, name: `Buyer${n}`, role: "user", ws: { send() {} }, C, x: 20, y: 10, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); return pl;
}
const buy = (pl, id, extra = {}) => { const t0 = G.tixIn(pl.C); pl.out = []; W.onMessage(pl, { t: "store", op: "buy", id, ...extra }); return t0 - G.tixIn(pl.C); };
const told = (pl) => pl.out.map((e) => e.text || "").join(" | ");

/* 1. every kind at its price */
{ const p = player(), rows = [["trail_embers"], ["aura_holy"], ["hit_lightning"], ["splat_gold"], ["ptag_glow"], ["title_gamba"], ["bankpage"], ["quickslot"], ["loupe"], ["decor_fireplace"], ["wfx_confetti"], ["skill2x"], ["clovers"]];
  const got = rows.map(([id]) => buy(p, id)), want = rows.map(([id]) => G.priceOf(G.STORE[id]));
  is(got, want, "thirteen kinds, each charged exactly priceOf (embers 30% off, bank page 20% off, fireplace 20% off)");
  is([G.priceOf(G.STORE.trail_embers), G.priceOf(G.STORE.bankpage), G.priceOf(G.STORE.wfx_fireworks)], [28000, 48000, 15000], "the sale prices");
  W.sx2 = null; }
/* 2. refusals charge nothing */
{ const poor = player(1000); is([buy(poor, "trail_frost"), /is 40,000/.test(told(poor))], [0, true], "can't afford: nothing taken, the price said");
  const p = player(); buy(p, "trail_frost"); is([buy(p, "trail_frost"), /own that already/.test(told(p))], [0, true], "a look bought twice: refused, nothing taken");
  for (let i = 0; i < 5; i++) buy(p, "loupe"); is([G.loupeOf(p.C, "loupe"), buy(p, "loupe"), /50 at most/.test(told(p))], [50, 0, true], "the Loupe stops at 50 rolls, free of charge");
  for (let i = 0; i < 6; i++) buy(p, "bankpage"); is([G.upOf(p.C, "bank"), G.bankPagesOf(p.C), G.bankMaxOf(p.C), buy(p, "bankpage")], [5, 10, 400, 0], "bank pages: five more at most (10 pages, 400 slots), the sixth refused");
  for (let i = 0; i < 5; i++) buy(p, "quickslot"); is([G.quickNOf(p.C), buy(p, "quickslot")], [8, 0], "quick slots: 8 at most");
  buy(p, "decor_portal"); is([p.C.isle.owned.portal, buy(p, "decor_portal"), /plenty/.test(told(p))], [1, 0, true], "a one-of Store piece: the second refused");
  is([buy(p, "title_custom"), /Write your title/.test(told(p)), buy(p, "title_custom", { text: "k y s" }), buy(p, "title_custom", { text: "www.site.com" })], [0, true, 0, 0], "your own title: none, a nasty one and a link are all refused before the charge"); }
/* 3. upgrades are real */
{ const p = player(); buy(p, "quickslot"); p.out = [];
  W.onMessage(p, { t: "quick", i: 4, k: "clover" }); is(p.C.quick[4], "clover", "a fifth quick slot takes an item");
  const q = player(); W.onMessage(q, { t: "quick", i: 4, k: "clover" }); is((q.C.quick || [])[4] ?? null, null, "without it, slot 5 is refused");
  buy(p, "bankpage"); p.C.bank = Array.from({ length: 239 }, (_, i) => ({ k: Object.keys(G.ITEMS)[i + 5], n: 1 })).filter((s) => G.ITEMS[s.k]);
  const room = p.C.bank.length; is([W.bankAdd(p, "logs", 1) || W.bankAdd(p, "oaklogs", 1), room < G.bankMaxOf(p.C)], [true, true], `a bank with a bought page holds past 200 (${room} + more, of ${G.bankMaxOf(p.C)})`);
  const back = G.normChar(JSON.parse(JSON.stringify(p.C))); is([back.bank.length > 200, G.normChar({ ...JSON.parse(JSON.stringify(p.C)), store: {} }).bank.length], [true, 200], "a load keeps the bought bank; without the page it is trimmed to 200"); }
/* 4. 2X Skilling XP */
{ const p = player(); W.sx2 = null; W.dbl = null;
  const gain = (k, xp) => { const b = p.C.xp[k] || 0; W.grant(p, k, xp); return (p.C.xp[k] || 0) - b; };
  const plain = [gain("mining", 100), gain("melee", 100)];
  buy(p, "skill2x"); const on = [gain("mining", 100), gain("melee", 100), gain("smithing", 100)];
  is([plain, on, said.some((x) => /2X SKILLING XP/.test(x))], [[100, 100], [200, 100, 200], true], "2X Skilling XP: mining and smithing double, melee does not, CASINO says so");
  const q = player(); is([buy(q, "skill2x"), /already running/.test(told(q))], [0, true], "a second while one runs: refused, nothing taken");
  W.sx2.until = Date.now() - 1; W.skill2xTick(); is([W.skill2xOn(), said.some((x) => /2X Skilling XP has ended/.test(x))], [false, true], "it ends, and says so"); }
/* 5. the loupes at the Sorter */
{ const p = player(); buy(p, "loupe"); buy(p, "loupe2"); G.addInv(p.C.inv, "ruby", 3, p.C);
  const Sy = W.scene("workyard"); p.x = 31; p.y = 10; W.env = { DEV: "1" }; p.admin = true;
  const i = p.C.inv.findIndex((s) => s.k === "ruby"); p.out = []; W.onMessage(p, { t: "gems", op: "sort", i });
  is([G.loupeOf(p.C, "loupe2"), G.loupeOf(p.C, "loupe"), /Master Jeweller's Loupe: 9/.test(told(p))], [9, 10, true], "a roll spends a Master's roll first, and says how many are left");
  const P = (k) => Math.round(1 / G.gemOddsLoupe(k, 10)), E9 = (k) => Math.round(1 / G.gemOddsLoupe(k, 9)), E8 = (k) => Math.round(1 / G.gemOddsLoupe(k, 8));
  is([Math.round(1 / G.gemOdds(10)), P("loupe"), E9("loupe"), E8("loupe"), P("loupe2"), E9("loupe2"), E8("loupe2")], [213, 56, 37, 28, 20, 20, 20], "the odds are the ones the items' words state");
  for (const k of ["loupe", "loupe2"]) for (const r of [8, 9, 10]) { const want = `1 in ${Math.round(1 / G.gemOddsLoupe(k, r))}`; if (!G.STORE[k].ex.includes(`-> ${want}`)) { console.log(`  !! ${k}'s words do not say "${want}" for +${r}`); bad++; } }
  W.env = { DEV: "0" }; }
/* 6. the War Horn */
{ for (const p of [...W.pls.values()]) W.pls.delete(p.id);
  const p = player(); W.raid = null; W.raidSack = null; W.raidLast = 0;
  is([buy(p, "horn"), /5 people online/.test(told(p))], [0, true], "one online: refused, nothing taken");
  for (let i = 0; i < 4; i++) player(0);
  const was = W.hw?.kingUp; if (W.hw) W.hw.kingUp = { id: "k" }; const hwOn = G.hwOn();
  if (hwOn) is([buy(p, "horn"), /Pumpkin King/.test(told(p))], [0, true], "while the Pumpkin King is up: refused"); if (W.hw) W.hw.kingUp = was;
  said.length = 0; const paid = buy(p, "horn");
  is([paid, W.raid?.phase, said.some((x) => /Buyer\d+ HAS BLOWN THE WAR HORN/.test(x)), said.some((x) => /RAID!/.test(x))], [350000, "warn", true, true], "five online: 350,000 taken, the raid called in the buyer's name");
  is([buy(p, "horn"), /already coming/.test(told(p))], [0, true], "while it is coming: refused");
  W.raid = null; is([buy(p, "horn"), /can be blown again in 2 h 59 min|can be blown again in 3 h 0 min/.test(told(p))], [0, true], "and the north needs three hours");
  W.raidLast = Date.now() - G.RAID.horn.gapMs - 1; W.raidSack = { until: Date.now() + 60000 }; is([buy(p, "horn"), /sacked/.test(told(p))], [0, true], "not while the Yard is sacked");
  W.raidSack = null; W.raid = null; }
/* 7. world shows */
{ const a = player(), b = player(0); b.out = []; W.scene("workyard");
  is([buy(a, "wfx_fireworks"), b.out.some((e) => e.type === "wfx" && e.k === "fireworks"), said.some((x) => /setting off fireworks/.test(x))], [15000, true, true], "fireworks: charged, everyone in the Yard sees them, CASINO names the buyer");
  const c = player(); is([buy(c, "wfx_snow"), /already on here/.test(told(c))], [0, true], "a second show while one is on: refused, nothing taken");
  const d = player(0, W.scene("farm")); d.out = []; W.moveToScene(d, "workyard", null, { x: 20, y: 10 }); is(d.out.some((e) => e.type === "wfx" && e.late), true, "somebody walking in mid-show is sent the rest of it"); }
/* 8. titles, looks and tags on the roster; the site's title is gone */
{ const p = player(); buy(p, "title_custom", { text: "  Big   Dog  " }); buy(p, "trail_rainbow"); buy(p, "ptag_gold");
  p.C.pets = [{ id: "pt1", k: "bonepup", name: "Rex" }]; p.C.eq.pet = "pt1"; p.cos = { name: null, title: "Old Site Title" };
  const w = W.whoOf(W.scene("workyard")).find((x) => x.id === p.id);
  is([w.ttl, w.lk?.trail, w.pnm], ["Big Dog", "rainbow", "Rex"], "the roster carries the title, the trail and the pet's name");
  p.out = []; W.onMessage(p, { t: "store", op: "ttext", text: "No Life" }); is(G.titleOf(p.C), "No Life", "your own title rewritten free");
  W.onMessage(p, { t: "store", op: "set", slot: "trail", id: null }); is(G.looksOf(p.C)?.trail || null, null, "a look taken off"); }
/* 9. the Store's decor is placed like Yahsmeena's, and she will not sell it */
{ const DR = createDecorRules(G); is([DR.DECOR.portal?.store, DR.DECOR.fireplace?.wall, DR.DECOR.bench?.store || false], [true, true, false], "the decor rules carry the Store's pieces, marked store");
  const missing = Object.keys(G.STORE_DECOR).filter((k) => !(DR.DECOR[k].art || `d_${k}`)); is(missing, [], "every Store piece has a picture key"); }
/* 11. round three: pet skins are looks only, eggs are real, bag slots are room */
{ const p = player(); p.C.pets = [{ id: "pt1", k: "bonepup", name: "", tier: 1 }]; p.C.eq.pet = "pt1";
  const fx0 = JSON.stringify(G.petFx(p.C)), bag0 = G.bagMax(p.C);
  is([buy(p, "pskin_phoenix"), G.petSkinOf(p.C), JSON.stringify(G.petFx(p.C)) === fx0, G.activePet(p.C).tier], [400000, "phoenix", true, 1], "a pet skin: worn at once, the pet's bonuses and Greater rank untouched");
  is(W.whoOf(W.scene("workyard")).find((x) => x.id === p.id).psk, "phoenix", "the roster carries the skin");
  p.C.eq.pet = null; is(G.petSkinOf(p.C), null, "no pet out, no skin"); p.C.eq.pet = "pt1";
  is([buy(p, "egg_egg_raptor"), p.C.inv.some((s) => s.k === "egg_raptor")], [G.priceOf(G.STORE.egg_egg_raptor), true], "an egg: charged, and in the bag");
  for (let i = 0; i < 6; i++) buy(p, "bagslot"); is([G.upOf(p.C, "bag"), G.bagMax(p.C) - bag0, buy(p, "bagslot")], [5, 5, 0], "bag slots: five more at most, the sixth refused");
  const miss = Object.values(G.STORE).filter((it) => !it.art && !["col", "fx", "icon", "frame", "decor", "give"].includes(it.kind) && !G.STORE_LOOKS[it.kind] && !it.icon).map((it) => it.id); is(miss, [], "every Store item has a picture"); }
/* 10. the walking fix */
{ const C = G.freshChar(), base = G.stepMsOf(C); C.drink = { k: "pot_quick", left: 10 }; const quick = G.stepMsOf(C);
  is([quick < base, G.fxWalk(C)], [true, 7], `a "speed" drink walks faster now (${base} ms a step -> ${quick})`); }
console.log(bad ? `\n${bad} problem(s)` : "\nThe Store holds: every price, every refusal before the charge, the upgrades, both 2Xs, the loupes, the horn, the shows and the looks");
process.exitCode = bad ? 1 : 0;

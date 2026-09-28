/* THE TRUFFLE PETS —  node tools/eastscape-truffle-test.mjs
   (2026-09-27, the owner: "let the baron find truffles too at a better rate", then "when wearing either ... the spores you harvest in the open
   world and in your cellar triple") The real World: with no truffle pet a wild pick's spawn is one and a bed gives SEED_BACK back; with the
   Truffle Pig or the Truffle Baron out both are tripled; the Baron's truffle chances are TRUFFLE_BARON times the pig's; and the wiki's pet
   pages open for every pet (they threw on any effect the page did not know). */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const withPet = (k) => { const C = G.freshChar(); for (const s of Object.keys(C.xp)) C.xp[s] = 13034431; if (k) { C.pets.push({ id: "p", k }); C.eq.pet = "p"; } return C; };
is([G.truffleNose(withPet(null)), G.truffleNose(withPet("trufflepig")), G.truffleNose(withPet("trufflebaron")), G.truffleNose(withPet("cointoad"))], [0, 1, G.TRUFFLE_BARON, 0], "the nose: none, the pig, the Baron (better), any other pet");

/* a wild pick, with its spawn roll forced to land: one spawn, or three with either truffle pet */
const pick = (k) => {
  const pl = { id: "w" + k, name: "w", C: withPet(k), x: 1, y: 1, out: [], path: [] }; W.pls.set(pl.id, pl);
  const S = W.scene("mire"), ob = S.objs.find((o) => o.t === "shroom"); pl.C.scene = "mire";
  const R = Math.random; Math.random = () => 0.001; try { W.fungPick(S, pl, ob); } finally { Math.random = R; }
  return G.countItems(pl.C, [`spawn_${ob.k}`]);
};
is([pick(null), pick("trufflepig"), pick("trufflebaron")], [1, 3, 3], "wild spawn: one, or three with the pig or the Baron");

/* a bed harvest: SEED_BACK spawn back, tripled with either pet */
const bed = (k) => {
  const pl = { id: "b" + k, name: "b", C: withPet(k), x: 1, y: 1, out: [], path: [] }; W.pls.set(pl.id, pl);
  pl.C.isle = { tier: 1, owned: {}, decor: [], shelf: [], beds: [{ k: "spawn_puffball", at: 0 }, null, null, null, null, null] };
  const key = `cellar:${pl.id}`, S = W.scene(key); S.owner = pl.id; pl.C.scene = key;
  const ob = S.objs.find((o) => o.t === "fbed" && o.i === 0);
  const R = Math.random; Math.random = () => 0.99; try { W.fungBed(S, pl, ob, Date.now()); } finally { Math.random = R; }
  return G.countItems(pl.C, ["spawn_puffball"]);
};
is([bed(null), bed("trufflepig"), bed("trufflebaron")], [G.SEED_BACK, G.SEED_BACK * 3, G.SEED_BACK * 3], "cellar spawn back: two, or six with either");
/* the shrooms themselves: a wild pick's 1-3 and a bed's yield, both tripled (the bed's in place of its harvest bonus) */
const shrooms = (k, where) => { if (where === "wild") { const pl = { id: "sw" + k, name: "s", C: withPet(k), x: 1, y: 1, out: [], path: [] }; W.pls.set(pl.id, pl); const S = W.scene("mire"), ob = S.objs.find((o) => o.t === "shroom"); pl.C.scene = "mire";
    const R = Math.random; Math.random = () => 0.999; try { W.fungPick(S, pl, ob); } finally { Math.random = R; } return G.countItems(pl.C, [ob.k]); }
  const pl = { id: "sb" + k, name: "b", C: withPet(k), x: 1, y: 1, out: [], path: [] }; W.pls.set(pl.id, pl); pl.C.isle = { tier: 1, owned: {}, decor: [], shelf: [], beds: [{ k: "spawn_puffball", at: 0 }, null, null, null, null, null] };
  const key = `cellar:${pl.id}`, S = W.scene(key); S.owner = pl.id; pl.C.scene = key; const ob = S.objs.find((o) => o.t === "fbed" && o.i === 0);
  const R = Math.random; Math.random = () => 0.999; try { W.fungBed(S, pl, ob, Date.now()); } finally { Math.random = R; } return G.countItems(pl.C, ["puffball"]); };
const wildMax = G.FUNG.wildN[1], bedMax = G.FUNGI.spawn_puffball.yield[1];
is([shrooms(null, "wild"), shrooms("trufflepig", "wild"), shrooms("trufflebaron", "wild")], [wildMax, wildMax * 3, wildMax * 3], "wild shrooms: tripled with either");
is([shrooms(null, "bed"), shrooms("trufflepig", "bed"), shrooms("trufflebaron", "bed")], [bedMax, bedMax * 3, bedMax * 3], "cellar shrooms: tripled with either");

/* the Baron's truffles: a roll that the pig's 20% misses and the Baron's 35% catches */
const truffle = (k, roll) => { const pl = { id: "t" + k, name: "t", C: withPet(k), x: 1, y: 1, out: [], path: [] }; W.pls.set(pl.id, pl);
  const S = W.scene("mire"), ob = S.objs.find((o) => o.t === "shroom"); pl.C.scene = "mire"; pl.C.fung = null;
  const R = Math.random; Math.random = () => roll; try { W.fungPick(S, pl, ob); } finally { Math.random = R; } return G.countItems(pl.C, ["truffle"]); };
const mid = (G.FUNG.truffle.pick + G.FUNG.truffle.pick * G.TRUFFLE_BARON) / 2;
is([truffle("trufflepig", mid), truffle("trufflebaron", mid)], [0, 1], `a ${Math.round(mid * 100)}% roll: the pig misses, the Baron finds one`);

/* every pet's effects can be said in words (the wiki's pet page threw on any it did not know) */
const unsaid = Object.entries(G.PETS).flatMap(([k, p]) => Object.keys(p.fx || {}).filter((f) => /undefined/.test(G.petFxText({ [f]: 1 })) || G.petFxText({ [f]: 1 }) === `${f} 1`).map((f) => `${k}:${f}`));
is(unsaid, [], "every pet effect has words");
console.log(bad ? `\n${bad} problem(s)` : "\nthe truffle pets work: the Baron's better nose, tripled spawn wild and in the cellar, and every pet's wiki page");
process.exitCode = bad ? 1 : 0;

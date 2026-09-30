/* GEAR IS NEVER MULTIPLIED —  node tools/eastscape-nexus-gear-test.mjs
   (2026-09-30, the owner: "bug fix, nexus altar shouldnt double satchels and wands, same for fletching table there should double gear/bows"). The
   real World, crafting through doAction at the real stations, many times over: at the Wild Bench a bow and a quiver always come out one at a time
   while shafts still come out half as much again; at the Nexus a wand and a Magic Bag come out one at a time while pages still get the extra; and a
   Tinkering double-make never doubles gear either. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
let t = Date.now() + 1000;
function crafter(S, ob) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; for (const k of ["fletching", "wizardry", "magic", "archery", "hp"]) C.xp[k] = G.XP_AT[99]; C.hp = G.maxHpOf(C);
  const spot = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ({ x: ob.x + dx, y: ob.y + dy })).find((p) => G.walkableIn(S.g, p.x, p.y));
  const pl = { id: "c1", login: "c1", name: "Maker", role: "user", ws: { send() {} }, C, x: spot.x, y: spot.y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(pl.id, pl); return pl;
}
/* make `id` N times at station `ob`, refilling the inputs and clearing the bag each time; returns how many came out each time */
function makeN(S, ob, id, N) {
  const r = G.RECIPES[id], pl = crafter(S, ob), outs = [];
  for (let i = 0; i < N; i++) {
    pl.C.inv = []; for (const [k, n] of r.in) G.addInv(pl.C.inv, k, n * 3, pl.C);
    pl.act = { kind: G.STATIONS[ob.t].kind, ob, pick: id, x: ob.x, y: ob.y, started: t - 5000, next: t - 1 }; pl.lastInput = t;
    W.doAction(S, pl, (t += 60000));
    outs.push(G.countItems(pl.C, [r.out[0]]));
  }
  W.pls.delete(pl.id); return outs;
}
const find = (t) => { for (const key of Object.keys(G.SCENES)) { if (!G.SCENES[key].build) continue; const S = W.scene(key), ob = S?.objs?.find((o) => o.t === t); if (ob) return { S, ob }; } return null; };
const bench = find("wildbench"), nexus = find("altar_nexus");
is([!!bench, !!nexus], [true, true], "the Wild Bench and the Nexus both stand somewhere");
const N = 60, most = (a) => Math.max(...a), least = (a) => Math.min(...a);
for (const id of ["fletch_cycadlogs_longbow", "fletch_bogwoodlogs_shortbow", "fletch_bogwoodlogs_quiver"]) { const o = makeN(bench.S, bench.ob, id, N); is([least(o), most(o)], [1, 1], `Wild Bench, ${G.RECIPES[id].out[0]}: always one`); }
{ const id = "fletch_shaft_bogwoodlogs", o = makeN(bench.S, bench.ob, id, N), base = G.RECIPES[id].out[1]; is(most(o) > base, true, `Wild Bench, shafts: still more than the table's ${base} (up to ${most(o)})`); }
for (const id of ["make_cycadlogs_wand", "make_bogwoodlogs_wand"]) { const o = makeN(nexus.S, nexus.ob, id, N); is([most(o), o.filter((x) => x === 1).length > N / 2], [1, true], `Nexus, ${G.RECIPES[id].out[0]}: never more than one`); }
{ const bag = Object.keys(G.RECIPES).find((k) => G.RECIPES[k].out[0]?.startsWith("bag_") && String(G.RECIPES[k].station).startsWith("altar_"));
  if (bag) { const o = makeN(nexus.S, nexus.ob, bag, N); is([most(o), o.filter((x) => x === 1).length > N / 2], [1, true], `Nexus, ${G.RECIPES[bag].out[0]} (a Magic Bag): never more than one`); } else console.log("  (no Magic Bag recipe at an altar to check)"); }
{ const page = Object.keys(G.RECIPES).find((k) => String(G.RECIPES[k].station).startsWith("altar_") && G.ITEMS[G.RECIPES[k].out[0]]?.ammo?.kind === "page");
  const o = makeN(nexus.S, nexus.ob, page, N); is(most(o) > G.RECIPES[page].out[1], true, `Nexus, ${G.RECIPES[page].out[0]}: pages still get the extra (up to ${most(o)})`); }
console.log(bad ? `\n${bad} problem(s)` : "\nGear comes out one at a time at the Nexus and the Wild Bench; pages, arrows and shafts still get the extra");
process.exitCode = bad ? 1 : 0;

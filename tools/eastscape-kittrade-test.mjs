/* FIELD KITS ARE YOURS —  node tools/eastscape-kittrade-test.mjs
   (2026-10-02, the owner: "on the live server, lets disallow trading or selling field kits ... the ones archers use. lets also update the mats needed
   for all recipes by 2x"). The real World, storage stubbed:
     - the rule: the seven timed kits, grapple arrows, snares and fishing arrows don't change hands; their materials do;
     - a trade: a kit can't be offered, and a trade that somehow holds one is cancelled at the final confirm, with the right words;
     - the Exchange: a kit can't be listed or bid for; a shop never bought one;
     - the sweep: a kit offer already up comes down at start, its kits held for the owner;
     - the recipes: every field kit recipe asks for twice what it did, and makes and pays the same. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !!  ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ok = (c, what) => is(!!c, true, what);

console.log("The rule");
const KITS = [...Object.keys(G.FIELD_KITS).map((k) => `kit_${k}`), "grapple_arrow", "snare", "fishing_arrow"];
for (const k of KITS) ok(G.noTrade(k) && !G.canSell(k), `${k} doesn't trade or sell`);
for (const k of ["feather", "bowstring", "shaft", "small_vial", "sporecap", "hide"]) ok(!G.noTrade(k), `${k} (a kit's material) still trades`);

console.log("The recipes (the inputs before this change, doubled; outputs and xp unchanged)");
const WAS = { grapple: [[["shaft", 3], ["bowstring", 1], ["emerald_bar", 1]], ["grapple_arrow", 3], 60], snare: [[["willowlogs", 1], ["bowstring", 1]], ["snare", 2], 40],
  fishing_arrow: [[["shaft", 10], ["feather", 10], ["diamond_bar", 1]], ["fishing_arrow", 10], 50],
  kit_camo: [[["hide", 2], ["sporecap", 2]], ["kit_camo", 1]], kit_flare: [[["shaft", 2], ["ink_fire", 1]], ["kit_flare", 2]], kit_mark: [[["feather", 15], ["bones", 5]], ["kit_mark", 1]],
  kit_eagle: [[["small_vial", 1], ["sporecap", 3], ["feather", 5]], ["kit_eagle", 1]], kit_quickdraw: [[["palmlogs", 2], ["small_vial", 1]], ["kit_quickdraw", 1]],
  kit_fleet: [[["small_vial", 1], ["sporecap", 2], ["feather", 5]], ["kit_fleet", 1]], kit_retriever: [[["hide", 3], ["bowstring", 2], ["feather", 20]], ["kit_retriever", 1]] };
for (const [k, [inp, out, xp]] of Object.entries(WAS)) {
  const r = G.RECIPES[`fletch_${k}`];
  is([r?.in, r?.out], [inp.map(([m, n]) => [m, n * 2]), out], `fletch_${k}`);
  if (xp) is(r.xp, xp, `fletch_${k}'s xp`);
}

const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
store.set("exchange", { next: 3, last: {}, tax: 0, orders: [
  { id: 1, owner: "old1", name: "Old", side: "sell", k: "kit_quickdraw", f: 0, qty: 4, done: 1, price: 900, at: 1, open: true, box: { items: 0, cash: 0 } },
  { id: 2, owner: "old1", name: "Old", side: "sell", k: "feather", f: 0, qty: 50, done: 0, price: 5, at: 1, open: true, box: { items: 0, cash: 0 } }] });
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 30)); W.save = async () => {};

console.log("The sweep");
const O = (id) => W.ex.orders.find((o) => o.id === id);
ok(!O(1).open && O(1).box.items === 3, "a kit sell offer came down, its three unsold kits held for the owner");
ok(O(2).open, "the feather offer is untouched");

let n = 0;
function player(S, x, y) {
  const C = G.freshChar(); C.scene = S.key; C.hp = G.maxHpOf(C);
  const id = `p${++n}`, pl = { id, login: id, name: `P${n}`, role: "user", ws: { send() {}, close() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 };
  W.pls.set(id, pl); return pl;
}
const said = (pl) => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";

console.log("A trade");
{
  const S = W.scene("workyard"), a = player(S, 20, 12), b = player(S, 21, 12);
  G.addInv(a.C.inv, "kit_fleet", 2, a.C); G.addInv(a.C.inv, "snare", 2, a.C); G.addInv(a.C.inv, "feather", 30, a.C);
  W.tradeOp(S, a, { op: "req", to: b.id }); W.tradeOp(S, b, { op: "req", to: a.id });
  ok(a.trade && a.trade === b.trade, "the trade opens");
  a.out = []; W.tradeOp(S, a, { op: "add", k: "kit_fleet", n: 1 });
  ok(!a.trade.off[a.id].items.kit_fleet && /Field kits can't be traded/.test(said(a)), `a kit can't be offered ("${said(a)}")`);
  W.tradeOp(S, a, { op: "add", k: "snare", n: 1 });
  ok(!a.trade.off[a.id].items.snare, "nor a snare");
  W.tradeOp(S, a, { op: "add", k: "feather", n: 30 });
  is(a.trade.off[a.id].items.feather, 30, "feathers still can");
  a.trade.off[a.id].items.kit_fleet = 1;   /* as if it had got in somehow */
  for (const p of [a, b]) W.tradeOp(S, p, { op: "accept" }); for (const p of [a, b]) W.tradeOp(S, p, { op: "accept" });
  ok(G.countItems(b.C, ["kit_fleet"]) === 0 && G.countItems(a.C, ["kit_fleet"]) === 2, "a trade holding a kit is cancelled at the confirm: the kits stay put");
}

console.log("The Exchange");
{
  const S = W.scene("workyard"), stall = S.objs.find((o) => o.t === "stall"), c = G.nearestCell(stall, { x: stall.x, y: stall.y + 3 });
  const p = player(S, c.x, c.y); G.addInv(p.C.inv, "kit_mark", 2, p.C); G.addInv(p.C.inv, "feather", 20, p.C); G.addInv(p.C.inv, "tickets", 100000, p.C);
  const before = W.ex.orders.length;
  p.out = []; W.exOp(S, p, { op: "place", side: "sell", k: "kit_mark", qty: 1, price: 1000 });
  ok(/Field kits can't be traded or sold/.test(said(p)) && G.countItems(p.C, ["kit_mark"]) === 2, `a kit can't be listed, and stays in the bag ("${said(p)}")`);
  W.exOp(S, p, { op: "place", side: "buy", k: "grapple_arrow", qty: 3, price: 500 });
  ok(W.ex.orders.length === before, "nor grapple arrows bid for");
  W.exOp(S, p, { op: "buynow", side: "buy", k: "fishing_arrow", qty: 10, price: 100 });
  ok(W.ex.orders.length === before, "nor fishing arrows bought outright");
  W.exOp(S, p, { op: "place", side: "sell", k: "feather", qty: 20, price: 4 });
  ok(W.ex.orders.length === before + 1, "feathers still list");
}

console.log(bad ? `\n${bad} FAILED` : "\nField kits are yours: no trade, no Exchange, the old offers down, and every recipe twice the materials");
process.exit(bad ? 1 : 0);

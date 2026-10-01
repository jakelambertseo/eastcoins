/* GEMS IN v1.1: RARER, AND YOURS —  node tools/eastscape-gemcut-test.mjs
   (2026-10-01) The real World, storage stubbed:
     - the rates: the gem bag's skilling drop, the boss drop, a gem off ore, a monster's gem drop and Captain Claw's chest are each a quarter
       of what they were with the switch off; the keystone no longer asks for a gem;
     - a trade: a gem can't be offered (sorted or not, combat or skilling, or a mining gem), anything else still can; a trade that somehow
       holds a gem is cancelled at the final confirm;
     - the Exchange: a gem can't be listed for sale or bid for; anything else still can;
     - the sweep: gem offers already up are taken down at start, gems and tickets held for their owners; other offers are untouched. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !!  ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ok = (c, what) => is(!!c, true, what);
const near = (a, b) => Math.abs(a - b) < 1e-12;

console.log("The rates (the same numbers with the switch off are what the rules file says before this section)");
ok(near(G.GEMSET.drop, 1 / 1500 * 0.25), `the gem bag's skilling drop is 1 in ${Math.round(1 / G.GEMSET.drop)}`);
ok(near(G.GEMSET.bossDrop, 0.05), "an open boss: 1 in 20");
ok(near(G.GEM_DROP.copper[0][1], 0.0075), "a ruby off copper: 0.75% a swing");
ok(G.MOBS.undertow.drops.some(([k, , p]) => k === "topaz" && near(p, 0.05)), "the Undertow's topaz: 20% -> 5%");
ok(G.CLAW_CHEST.items.some(([k, , p]) => k === "opal" && near(p, 0.15)), "Captain Claw's chest: opal 60% -> 15%");
ok(!G.ORDER.keystone.list.some(([k]) => G.isGem(k)), "Bronny's keystone asks for no gem");
for (const k of ["ruby", "jade", "moonstone", "sapphire", "opal"]) ok(G.noTrade(k), `${k} doesn't trade`);
for (const k of ["hide", "fossil", "agilmark"]) ok(!G.noTrade(k), `${k} still trades`);

const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
/* an Exchange from before the switch: a gem sell offer, a gem buy offer, and a hide offer */
store.set("exchange", { next: 4, last: {}, tax: 0, orders: [
  { id: 1, owner: "old1", name: "Old", side: "sell", k: "ruby", f: 0, qty: 3, done: 1, price: 900, at: 1, open: true, box: { items: 0, cash: 0 } },
  { id: 2, owner: "old2", name: "Old2", side: "buy", k: "opal", f: 0, qty: 2, done: 0, price: 1000, at: 1, open: true, box: { items: 0, cash: 0 } },
  { id: 3, owner: "old1", name: "Old", side: "sell", k: "hide", f: 0, qty: 5, done: 0, price: 50, at: 1, open: true, box: { items: 0, cash: 0 } }] });
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 30)); W.save = async () => {};

console.log("The sweep");
const O = (id) => W.ex.orders.find((o) => o.id === id);
ok(!O(1).open && O(1).box.items === 2, "a gem sell offer came down, its two unsold rubies held for the owner");
ok(!O(2).open && O(2).box.cash === 2000, "a gem buy offer came down, its 2,000 tickets held");
ok(O(3).open, "the hide offer is untouched");

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
  G.addInv(a.C.inv, "ruby", 1, a.C); G.addInv(a.C.inv, "jade", 1, a.C, G.gemCode(5)); G.addInv(a.C.inv, "hide", 3, a.C);
  W.tradeOp(S, a, { op: "req", to: b.id }); W.tradeOp(S, b, { op: "req", to: a.id });
  ok(a.trade && a.trade === b.trade, "the trade opens");
  a.out = []; W.tradeOp(S, a, { op: "add", k: "ruby", n: 1 });
  ok(!a.trade.off[a.id].items.ruby && /Gems can't be traded/.test(said(a)), "an unsorted ruby can't be offered");
  W.tradeOp(S, a, { op: "add", k: "jade", n: 1 });
  ok(!a.trade.off[a.id].items.jade, "nor a sorted jade");
  W.tradeOp(S, a, { op: "add", k: "hide", n: 3 });
  is(a.trade.off[a.id].items.hide, 3, "hides still can");
  a.trade.off[a.id].items.ruby = 1;   /* as if it had got in somehow */
  for (const p of [a, b]) W.tradeOp(S, p, { op: "accept" }); for (const p of [a, b]) W.tradeOp(S, p, { op: "accept" });
  ok(G.countItems(b.C, ["ruby"]) === 0 && G.countItems(a.C, ["ruby"]) === 1, "a trade holding a gem is cancelled at the confirm: the ruby stays put");
}

console.log("The Exchange");
{
  const S = W.scene("workyard"), stall = S.objs.find((o) => o.t === "stall"), c = G.nearestCell(stall, { x: stall.x, y: stall.y + 3 });
  const p = player(S, c.x, c.y); G.addInv(p.C.inv, "ruby", 2, p.C); G.addInv(p.C.inv, "hide", 2, p.C); G.addInv(p.C.inv, "tickets", 100000, p.C);
  const before = W.ex.orders.length;
  p.out = []; W.exOp(S, p, { op: "place", side: "sell", k: "ruby", qty: 1, price: 1000 });
  ok(/Gems can't be bought or sold/.test(said(p)) && G.countItems(p.C, ["ruby"]) === 2, "a ruby can't be listed, and stays in the bag");
  W.exOp(S, p, { op: "place", side: "buy", k: "opal", qty: 1, price: 1000 });
  ok(W.ex.orders.length === before, "nor an opal bid for");
  W.exOp(S, p, { op: "buynow", side: "buy", k: "sapphire", qty: 1, price: 1000 });
  ok(W.ex.orders.length === before, "nor a sapphire bought outright");
  W.exOp(S, p, { op: "place", side: "sell", k: "hide", qty: 2, price: 40 });
  ok(W.ex.orders.length === before + 1, "a hide still lists");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);

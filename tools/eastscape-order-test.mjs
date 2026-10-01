/* BRONNY'S ORDER —  node tools/eastscape-order-test.mjs
   (2026-09-28, the owner: the server's daily) The real World with storage stubbed, standing at Bronny in the Yard: an order goes up with five
   lines of different kinds; handing in takes the items out of the bag for good and fills the bars; a favourited stack is never taken;
   a full order stops its countdown and waits (it never runs out filled); only somebody who helped can claim; a claim during a running 2X
   is refused; a claim starts the server's 2X and puts the next order up; an unfilled order that runs out is replaced; and you have to be
   standing at Bronny. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {};
const said = []; W.houseSay = (t, n) => said.push(`${n}: ${t}`);
const S = W.scene("workyard"), foreman = S.npcs.find((n) => n.name === G.ORDER.npc);
const mk = (id) => { const pl = { id, name: id, C: G.freshChar(), x: foreman.x + 1, y: foreman.y, out: [], path: [] }; pl.C.scene = "workyard"; W.pls.set(id, pl); return pl; };
const a = mk("ann"), b = mk("bob"), c = mk("cat");
const cnt = (pl, k) => G.countItems({ inv: pl.C.inv, bank: [] }, [k]);
const last = (pl, type) => [...pl.out].reverse().find((e) => e.type === type);

/* 1. the first order */
W.order = null; W.orderTick(Date.now());
const o1 = W.order;
is([o1.lines.length, new Set(o1.lines.map((l) => l.kind)).size, !!said.at(-1)?.includes("REBUILDING THE YARD")], [7, 7, true], "the first order: six lines and a keystone, seven different kinds, announced");
is(o1.lines.every((l) => !G.prizesOf().some((p) => p.give?.[0] === l.k)), true, "nothing on it is anything Bom sells");
{ let ok = true; for (let i = 0; i < 300; i++) { const L = G.orderPick(), t = L.map((l) => l.tier).sort().join(","); if (t !== "early,early,keystone,late,late,mid,mid" || new Set(L.map((l) => l.kind)).size !== 7 || L.at(-1).kind !== "keystone") ok = false; }   /* (2026-09-30) six lines and a keystone */ is(ok, true, "300 fresh orders: every one two early, two mid, one late, five kinds"); }

/* 2. handing in: partial, then a favourite, then the lot */
const [L0, L1] = o1.lines;
G.addInv(a.C.inv, L0.k, 10, a.C); G.addInv(a.C.inv, "tickets", 1, a.C);
W.orderOp(S, a, { op: "give", k: L0.k, n: 4 });
is([L0.got, cnt(a, L0.k), o1.by.ann?.n], [4, 6, 4], "give 4 of a line: the bar moves 4, the bag loses 4, Ann is credited 4");
a.C.fav = [...(a.C.fav || []), L0.k];
W.orderOp(S, a, { op: "give" });
is([L0.got, cnt(a, L0.k)], [4, 6], "a favourited stack is never handed over");
a.C.fav = [];
for (const l of o1.lines) G.addInv(b.C.inv, l.k, l.n + 5, b.C);
W.orderOp(S, b, { op: "give" });
{ const K = o1.lines.at(-1); is([K.kind, K.got, !o1.doneAt], ["keystone", 0, true], "Hand in everything leaves the keystone in the bag");
  const mine = b.C.inv.filter((x) => x.k === K.k); for (const x of mine) x.f = 2;   /* every copy reforged: none of them counts */
  W.orderOp(S, b, { op: "give", k: K.k }); is(K.got, 0, "the keystone never takes a reforged copy");
  for (const x of mine) delete x.f;
  W.orderOp(S, b, { op: "give", k: K.k }); }
is([o1.lines.every((l) => l.got >= l.n), o1.lines.map((l) => cnt(b, l.k) >= 5).every(Boolean), !!o1.doneAt, said.some((t) => t.includes("IS FILLED"))], [true, true, true, true], "Bob fills the lot: every bar full, only what was needed taken, filled and announced");
is(said.filter((t) => /\d+% there/.test(t)).length <= 3, true, "the 25/50/75 lines at most once each");

/* 3. a filled order waits: it never runs out */
o1.until = Date.now() - 1000; W.orderTick(Date.now());
is(W.order.id, o1.id, "past its countdown but filled: still the same order, still waiting");
W.orderOp(S, b, { op: "give" }); is(!!last(b, "say")?.text.includes("filled"), true, "no more handing in once it's filled");

/* 4. claiming */
W.orderOp(S, c, { op: "claim" }); is([W.doubleOn(), W.order.id], [false, o1.id], "Cat didn't help: can't claim");
W.dbl = { until: Date.now() + 60000, by: "someone", told: true };
W.orderOp(S, a, { op: "claim" }); is(W.order.id, o1.id, "a 2X already running: the claim waits");
W.dbl = null;
W.orderOp(S, a, { op: "claim" });
is([W.doubleOn(), W.dbl.by, W.order.id !== o1.id, W.order.lines.every((l) => l.got === 0), said.some((t) => t.includes("ann claimed"))], [true, "ann", true, true, true], "Ann claims: the server's 2X starts in her name and the next order goes up");

/* 5. an unfilled order that runs out is replaced */
const o2 = W.order; o2.lines[0].got = 3; o2.until = Date.now() - 1;
W.orderTick(Date.now());
is([W.order.id !== o2.id, W.order.lines[0].got, said.some((t) => t.includes("ran out"))], [true, 0, true], "unfilled and out of time: a fresh order, announced");

/* 6. you have to be at Bronny */
G.addInv(c.C.inv, W.order.lines[0].k, 5, c.C); c.x = 1; c.y = 1;
W.orderOp(S, c, { op: "give" }); is([W.order.lines[0].got, cnt(c, W.order.lines[0].k)], [0, 5], "not from across the Yard");

/* 7. the view */
c.x = foreman.x; c.y = foreman.y + 1; W.orderOp(S, c, { op: "view" }); const v = last(c, "order").view;
is([v.lines.length, v.lines[0].have, typeof v.until, v.canClaim], [7, 5, "number", false], "the window's view: lines, what's in your bag, the clock, whether you can claim");
/* 8. A RESTART (2026-09-28: every deploy threw the order away and posted a new one). Two worlds on the same storage. */
{
  const store = new Map(), sctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a2, b2] of Object.entries(k)) store.set(a2, structuredClone(b2)); else store.set(k, structuredClone(v)); }, delete: async (k) => store.delete(k), list: async () => new Map() } };
  const W1 = new World(sctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W1.houseSay = () => {};
  W1.order = null; W1.orderTick(Date.now()); W1.order.lines[0].got = 7; W1.orderSave(); W1.doubleStart("ann", 30 * 60000);
  await new Promise((r) => setTimeout(r, 20));
  const W2 = new World(sctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W2.houseSay = () => {};
  W2.orderTick(Date.now());
  is([W2.order?.id === W1.order.id, W2.order?.lines[0].got, W2.order?.until === W1.order.until, W2.doubleOn(), W2.dbl?.by], [true, 7, true, true, "ann"], "after a restart: the same order, what was handed in, the same clock, and the 2X still running");
}

console.log(bad ? `\n${bad} problem(s)` : "\nBronny's order works: hand-ins are gone for good, a filled order waits for a helper to claim it, and the claim starts the 2X and the next order");
process.exitCode = bad ? 1 : 0;

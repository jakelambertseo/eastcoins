/* BOM'S BUY-BACK —  node tools/eastscape-buyback-test.mjs
   (2026-09-28, the owner: "build the buy-back section too") The real World with storage stubbed, standing at the Prize Counter: selling puts
   the sale on the buy-back list, buying it back costs exactly what Bom paid and returns exactly what was sold (a reforged piece at its
   level), the round trip leaves tickets AND the VIP credit where they started, the 2X event cannot turn it into a ticket printer, an old
   entry is gone, and a short purse or a full bag is refused without taking anything. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("casino"), statue = S.objs.find((o) => o.t === "coinstatue");
const pl = { id: "b", name: "b", C: G.freshChar(), x: statue.x - 1, y: statue.y, out: [], path: [] }; W.pls.set(pl.id, pl); pl.C.scene = "casino";
const C = pl.C, tix = () => G.tixIn(C), cnt = (k, f) => C.inv.filter((x) => x.k === k && (f == null || G.fOf(x) === f)).reduce((a, x) => a + x.n, 0);
G.addInv(C.inv, "tickets", 5000 - tix(), C);

/* 1. loot: sell, then buy back */
G.addInv(C.inv, "catalytic", 4, C);
const t0 = tix(), e0 = Number(C.earned) || 0;
W.cashOut(S, pl, { op: "all" });
const sold = C.buyback?.[0];
is([sold?.k, sold?.n, sold?.paid], ["catalytic", 4, tix() - t0], "a sale goes on the buy-back list at what Bom paid");
W.counterOp(S, pl, { op: "buyback", id: sold.id });
is([cnt("catalytic"), tix(), Number(C.earned) || 0, C.buyback.length], [4, t0, e0, 0], "buying it back: the converters return, tickets and VIP credit are where they started, and the entry is gone");

/* 2. during 2X the sale pays double, and so does the buy-back */
W.doubleOn = () => true; G.addInv(C.inv, "catalytic", 4, C);
const t1 = tix(); W.cashOut(S, pl, { op: "one", k: "catalytic" }); const got2x = tix() - t1, e2 = C.buyback[0];
is(e2.paid >= got2x, true, `during 2X the buy-back costs at least what the sale paid (${e2.paid} for ${got2x})`);
W.counterOp(S, pl, { op: "buyback", id: e2.id }); is(tix() <= t1, true, "so selling and buying back during 2X makes nothing");
W.doubleOn = () => false;

/* 3. a reforged piece comes back at its level */
C.inv.push({ k: "bronze_helm", n: 1, f: 3 }); const t3 = tix();
W.cashOut(S, pl, { k: "bronze_helm", f: 3 }); const e3 = C.buyback[0];
is([e3.k, e3.f, cnt("bronze_helm", 3)], ["bronze_helm", 3, 0], "a +3 helm sells and is listed as a +3");
W.counterOp(S, pl, { op: "buyback", id: e3.id }); is([cnt("bronze_helm", 3), tix()], [1, t3], "and comes back as a +3, for what Bom paid");

/* 4. refusals take nothing */
G.addInv(C.inv, "catalytic", 2, C); W.cashOut(S, pl, { op: "all" }); const e4 = C.buyback[0];
const keep = tix(); G.takeInv(C.inv, "tickets", keep); W.counterOp(S, pl, { op: "buyback", id: e4.id });
is([cnt("catalytic"), C.buyback.length > 0], [0, true], "short of tickets: refused, nothing moves");
G.addInv(C.inv, "tickets", keep, C);
e4.at -= G.BUYBACK.ms + 1000; W.counterOp(S, pl, { op: "buyback", id: e4.id }); is(cnt("catalytic"), 0, "an entry older than the hour is gone");
for (let i = 0; i < 12; i++) W.bbAdd(C, { k: "sardine", n: 1, f: 0, paid: 1 }); is(C.buyback.length, G.BUYBACK.keep, `Bom keeps the last ${G.BUYBACK.keep}`);
pl.x = 1; pl.y = 1; W.counterOp(S, pl, { op: "buyback", id: C.buyback[0].id }); is(cnt("sardine"), 0, "not from across the room");
console.log(bad ? `\n${bad} problem(s)` : "\nbuy-back works: the price is what Bom paid, round trips make nothing (2X included), reforges come back at their level");
process.exitCode = bad ? 1 : 0;

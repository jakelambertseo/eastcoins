/* DO BANK PAGES HOLD? —  node tools/eastscape-bankpages-test.mjs
   (2026-09-27, the owner: "add bank pages ... 5 bank pages to start, replicate osrs") The real World with storage stubbed: a deposit lands on
   the page the window sent, a stack the bank already holds grows where it is whatever page was sent, a row is refiled by its true index,
   a page past the last is clamped, the page survives a save (normChar), and "deposit bag" files every new row on the page you are on. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
await new Promise((r) => setTimeout(r, 50));
const S = W.scene("workyard"), C = G.freshChar(); C.inv = []; C.bank = [];
const pl = { id: "u1", login: "u1", name: "Banker", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 };
W.pls.set("u1", pl); C.scene = S.key; const booth = S.objs.find((o) => o.t === "booth"); pl.x = booth.x - 1; pl.y = booth.y;
const row = (k) => C.bank.find((s) => s.k === k);
G.addInv(C.inv, "copper", 30, C); G.addInv(C.inv, "logs", 20, C); G.addInv(C.inv, "trout", 9, C);
W.onMessage(pl, { t: "bank", op: "dep", i: C.inv.findIndex((s) => s.k === "copper"), n: 10, p: 2 });
is(row("copper")?.p, 2, "a deposit lands on the page the window sent (page 3)");
W.onMessage(pl, { t: "bank", op: "dep", i: C.inv.findIndex((s) => s.k === "copper"), n: 10, p: 4 });
is([row("copper").n, row("copper").p], [20, 2], "the same stack grows where it already is, whatever page was sent");
W.onMessage(pl, { t: "bank", op: "dep", i: C.inv.findIndex((s) => s.k === "logs"), n: "all", p: 0 });
is(row("logs")?.p, undefined, "the first page is not stored on the row");
W.onMessage(pl, { t: "bank", op: "page", i: C.bank.indexOf(row("logs")), p: 4 }); is(row("logs").p, 4, "a row is refiled by its true index");
W.onMessage(pl, { t: "bank", op: "page", i: C.bank.indexOf(row("logs")), p: 99 }); is(row("logs").p, G.BANK_PAGES - 1, "a page past the last is clamped");
W.onMessage(pl, { t: "bank", op: "page", i: C.bank.indexOf(row("logs")), p: 0 }); is(row("logs").p, undefined, "back to the first page clears it");
W.onMessage(pl, { t: "bank", op: "depinv", p: 1 }); is(row("trout")?.p, 1, "deposit bag files every new row on the page you are on");
const back = G.normChar(JSON.parse(JSON.stringify(C))); is([back.bank.find((s) => s.k === "copper").p, back.bank.find((s) => s.k === "trout").p, back.bank.find((s) => s.k === "logs").p], [2, 1, undefined], "the pages survive a save");
is(G.BANK_PAGES, 5, "five pages");
/* (2026-09-27) arranging the bag: swap, to the end, and nothing on a bad index */
C.inv = [{ k: "copper", n: 5 }, { k: "logs", n: 2 }, { k: "trout", n: 1 }];
W.onMessage(pl, { t: "inv", op: "move", from: 0, to: 2 }); is(C.inv.map((s) => s.k), ["trout", "logs", "copper"], "dropping on an occupied slot swaps the two");
W.onMessage(pl, { t: "inv", op: "move", from: 0, to: 20 }); is(C.inv.map((s) => s.k), ["logs", "copper", "trout"], "dropping on an empty slot puts it last");
W.onMessage(pl, { t: "inv", op: "move", from: 7, to: 0 }); is(C.inv.map((s) => s.k), ["logs", "copper", "trout"], "a bad source index does nothing");
console.log(bad ? `\n${bad} problem(s)` : "\nbank pages hold: filed, grown in place, refiled, clamped, saved");
process.exitCode = bad ? 1 : 0;

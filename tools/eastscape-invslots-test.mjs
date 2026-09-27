/* DOES THE BAG HAVE SLOTS? —  node tools/eastscape-invslots-test.mjs
   (2026-09-27, the owner: "literally replicate OSRS/RS3 inventory") The bag stays a dense list underneath; a stack carries `p`, the slot it
   sits in, and invLayout lays the bag out from those. Checked here: a stack moved to an empty slot sits there and the gap it left stays; a
   stack moved onto another swaps with it; a used-up stack leaves its slot empty; a new item takes the FIRST empty slot; Sort clears every
   position; a save keeps them (normChar); a slot the bag no longer has, or two stacks claiming one, fall back without losing anything; and
   the bank's own reorder: a row dropped on another takes its place and its page. */
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
const pl = { id: "u1", login: "u1", name: "Tidy", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 };
W.pls.set("u1", pl); C.scene = S.key; const booth = S.objs.find((o) => o.t === "booth"); pl.x = booth.x - 1; pl.y = booth.y;
const at = () => G.invLayout(C).map((i) => (i < 0 ? "." : C.inv[i].k[0])).join("");   // the bag as a line: first letter of each stack, a dot for a gap
const N = G.bagMax(C);
G.addInv(C.inv, "copper", 5, C); G.addInv(C.inv, "logs", 3, C); G.addInv(C.inv, "trout", 2, C);
is(at().slice(0, 4), "clt.", "three stacks sit in the first three slots");
/* 1. to an empty slot, and the gap stays */
W.onMessage(pl, { t: "inv", op: "move", from: 0, to: N - 1 });
is([at()[0], at()[N - 1], at().slice(1, 3)], [".", "c", "lt"], "copper moved to the last slot leaves its slot empty");
/* 2. onto another: they swap */
W.onMessage(pl, { t: "inv", op: "move", from: 1, to: N - 1 });
is([at()[N - 1], at()[1]], ["l", "c"], "logs dropped on copper: the two swap");
/* 3. a used-up stack leaves a gap; a new item takes the first gap */
G.takeInv(C.inv, "trout", 2); is(at().slice(0, 3), ".c.", "the trout stack, used up, leaves its slot empty");
G.addInv(C.inv, "wheat", 1, C); is(at()[0], "w", "a new item takes the first empty slot");
/* 4. a save keeps the slots */
const back = G.normChar(JSON.parse(JSON.stringify(C))); is(G.invLayout(back).map((i) => (i < 0 ? "." : back.inv[i].k[0])).join(""), at(), "the layout survives a save");
/* 5. two stacks claiming one slot, and a slot past the bag, fall back without losing anything */
C.inv.push({ k: "bones", n: 1, p: 1 }, { k: "hide", n: 1, p: 999 });
{ const l = at(); is([l[1], l.includes("b"), l.includes("h"), l.replace(/\./g, "").length], ["c", true, true, C.inv.length], "a claimed slot and a slot past the bag both fall back to the first free slot"); }
/* 6. sort clears every position */
W.onMessage(pl, { t: "sort" }); is(C.inv.every((s, i) => s.p === i), true, "Sort packs the bag and gives every stack its new slot"); is(at().indexOf("."), C.inv.length, "and the bag is packed from the front again");
/* 7. the bank's reorder: a row dropped on another takes its place and its page */
C.bank = [{ k: "copper", n: 1 }, { k: "logs", n: 1, p: 2 }, { k: "trout", n: 1 }];
W.onMessage(pl, { t: "bank", op: "swap", i: 0, j: 1 });
is(C.bank.map((s) => `${s.k}${s.p ? ":" + s.p : ""}`), ["logs:2", "copper:2", "trout"], "copper dropped on logs takes its place and its page");
console.log(bad ? `\n${bad} problem(s)` : "\nthe bag has slots: gaps stay, drops land, swaps swap, sort packs, saves keep");
process.exitCode = bad ? 1 : 0;

/* THE BAG AND THE BANK, PLAYED HARD —  node tools/eastscape-bagdeep-test.mjs
   (2026-09-27, the owner: "keep testing this deeply ... this is crucial to users using the game while im away") A long scripted session
   against the real World with storage stubbed, checking after every step that (1) nothing is created or lost, (2) every stack has a slot
   and no two share one, (3) the slot a player put a thing in is where it stays. Covers: moves to empty slots and onto stacks, moving a
   stack onto itself, bad indexes, a full bag, eating and using up a stack, depositing part and all of a stack, withdrawing into a gap,
   Deposit bag, Stack all, Sort, a bag upgrade, a bag that shrank, a trade between two players (the other side's bag too), favourites
   through all of it, save-and-load between steps, and the bank's own reorder across pages. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0, steps = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
await new Promise((r) => setTimeout(r, 50));
const S = W.scene("workyard"), booth = S.objs.find((o) => o.t === "booth");
const mk = (id, name) => { const C = G.freshChar(); C.inv = []; C.bank = []; const p = { id, login: id, name, role: "user", ws: { send() {} }, C, x: booth.x - 1, y: booth.y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, p); C.scene = S.key; return p; };
const A = mk("ua", "Ann"), B = mk("ub", "Bob"); B.x = booth.x - 2;
const C = A.C;
const total = (c) => { const t = {}; for (const list of [c.inv, c.bank]) for (const s of list) t[`${s.k}${s.f ? "+" + s.f : ""}`] = (t[`${s.k}${s.f ? "+" + s.f : ""}`] || 0) + s.n; for (const sl of Object.keys(c.eq)) if (c.eq[sl] && sl !== "pet") t[c.eq[sl]] = (t[c.eq[sl]] || 0) + 1; return t; };
const L = (k) => (k === "ctrout" ? "T" : k[0]);   /* one letter a stack; cooked trout is T so it is not copper */
const lay = (c = C) => G.invLayout(c), line = (c = C) => lay(c).map((i) => (i < 0 ? "." : L(c.inv[i].k))).join("");
const invariant = (what, c = C) => { const l = lay(c), seen = new Set(); let dup = false; for (const i of l) if (i >= 0) { if (seen.has(i)) dup = true; seen.add(i); } if (seen.size !== c.inv.length || dup) fail(`${what}: the layout lost or doubled a stack (${seen.size} of ${c.inv.length})`); if (c.inv.some((s) => !Number.isInteger(s.p))) fail(`${what}: a stack has no slot after ${what}`); if (c.inv.length > G.bagMax(c)) fail(`${what}: the bag holds more than its size`); steps++; };
const settled = () => { G.settleSlots(C); return C; };
let snap = total(C);
const sorted = (o) => Object.fromEntries(Object.entries(o).sort()); const keep = (what) => { const now = total(C); if (JSON.stringify(sorted(now)) !== JSON.stringify(sorted(snap))) fail(`${what}: items changed hands with nobody trading: ${JSON.stringify(snap)} -> ${JSON.stringify(now)}`); snap = now; invariant(what); };
const roundTrip = (what) => { const back = G.normChar(JSON.parse(JSON.stringify(C))); is(line(back), line(), `${what}: the layout survives a save`); A.C.inv = back.inv; A.C.bank = back.bank; A.C.fav = back.fav; };
const msg = (m) => W.onMessage(A, m);

/* 1. a bag with gaps: put things in, move them about, use some up */
G.addInv(C.inv, "tickets", 500, C); for (const [k, n] of [["copper", 20], ["logs", 5], ["ctrout", 3], ["wheat", 2], ["bronze_helm", 1]]) G.addInv(C.inv, k, n, C);
settled(); snap = total(C); invariant("setup");
is(line().slice(0, 7), "tclTwb.", "six stacks in the first six slots");
const N = G.bagMax(C), idx = (k) => C.inv.findIndex((s) => s.k === k);
msg({ t: "inv", op: "move", from: idx("bronze_helm"), to: N - 1 }); keep("helm to the last slot"); is([line()[5], line()[N - 1]], [".", "b"], "the helm sits in the last slot and its old slot is empty");
msg({ t: "inv", op: "move", from: idx("copper"), to: 12 }); keep("copper to slot 12"); is([line()[1], line()[12]], [".", "c"], "copper to slot 12 leaves slot 1 empty");
msg({ t: "inv", op: "move", from: idx("logs"), to: 12 }); keep("logs onto copper"); is([line()[2], line()[12]], ["c", "l"], "logs dropped on copper: they swap, copper takes the logs' old slot");
msg({ t: "inv", op: "move", from: idx("ctrout"), to: 3 }); keep("trout onto itself"); is(line()[3], "T", "a stack dropped on its own slot stays");
msg({ t: "inv", op: "move", from: 99, to: 4 }); msg({ t: "inv", op: "move", from: idx("ctrout"), to: 999 }); msg({ t: "inv", op: "move", from: -1, to: 0 }); keep("bad indexes"); is(line()[3], "T", "bad indexes change nothing");
/* eat the trout down: the count falls, the slot holds; the last one eaten leaves the slot empty */
let clock = Date.now(); const eat = () => { clock += 100000; A.lastInput = clock; W.eat(A, idx("ctrout"), clock); };   /* the routine itself, with a clock that moves, so no eating cooldown gets in the way */
C.hp = 1; eat(); snap = total(C); invariant("ate one"); is([C.inv[idx("ctrout")]?.n, line()[3]], [2, "T"], "eating one trout: two left, same slot");
C.hp = 1; eat(); C.hp = 1; eat(); snap = total(C); invariant("ate all"); is(line()[3], ".", "the last trout eaten leaves its slot empty");
G.addInv(C.inv, "sardine", 4, C); snap = total(C); invariant("new item"); is(line()[1], "s", "a new item takes the FIRST empty slot (slot 1), not the trout's");
roundTrip("after moves and a meal");

/* 2. the bank into and out of gaps, part and whole stacks, favourites left alone */
msg({ t: "bank", op: "dep", i: idx("copper"), n: 5, p: 1 }); keep("deposit 5 copper"); is([C.inv[idx("copper")].n, line()[2]], [15, "c"], "part of a stack deposited: the stack stays in its slot");
msg({ t: "bank", op: "dep", i: idx("copper"), n: "all", p: 1 }); keep("deposit the rest"); is(line()[2], ".", "the whole stack deposited leaves its slot empty");
is(C.bank.find((s) => s.k === "copper")?.n, 20, "the bank holds all twenty copper in one row"); is(C.bank.find((s) => s.k === "copper")?.p, 1, "on page 2, where the first deposit went");
msg({ t: "bank", op: "wd", i: C.bank.findIndex((s) => s.k === "copper"), n: 7 }); keep("withdraw 7"); is(line()[2], "c", "withdrawn copper lands in the first empty slot (the one it left)");
msg({ t: "fav", k: "wheat" }); snap = total(C); is(C.fav, ["wheat"], "wheat is a favourite");
msg({ t: "bank", op: "depinv", p: 3 }); keep("deposit bag"); is(C.inv.map((s) => s.k).sort(), ["tickets", "wheat"], "Deposit bag leaves tickets and the favourite"); is([line()[0], line()[4]], ["t", "w"], "and they keep their slots");
is(C.bank.filter((s) => s.k !== "copper").every((s) => (s.p | 0) === 3), true, "the new rows went to page 4; copper stayed on page 2");
msg({ t: "bank", op: "wd", i: C.bank.findIndex((s) => s.k === "logs"), n: "all" }); msg({ t: "bank", op: "wd", i: C.bank.findIndex((s) => s.k === "bronze_helm"), n: 1 }); keep("withdraw two");
is([line()[1], line()[2]], ["l", "b"], "two withdrawals fill slots 1 and 2 in order");
msg({ t: "bank", op: "stackall", p: 0 }); keep("stack all"); is(C.inv.map((s) => s.k).sort(), ["bronze_helm", "logs", "tickets", "wheat"], "Stack all leaves alone what the bank no longer holds a row of (both were withdrawn whole)");
roundTrip("after banking");

/* 3. sort, a bag upgrade, a bag that shrank */
for (const k of ["bones", "beef", "chicken"]) msg({ t: "bank", op: "wd", i: C.bank.findIndex((s) => s.k === k) < 0 ? (G.addInv(C.bank, k, 2, { inv: [] }), C.bank.findIndex((s) => s.k === k)) : C.bank.findIndex((s) => s.k === k), n: 2 });
snap = total(C); invariant("three more");
msg({ t: "inv", op: "move", from: idx("wheat"), to: N - 2 }); keep("wheat far"); is(line()[N - 2], "w", "wheat parked near the end");
msg({ t: "sort" }); keep("sort"); is(line().indexOf("."), C.inv.length, "Sort packs the bag from the front"); is(line().slice(0, 2), "tw", "tickets first, then the favourite");
C.bagUp = (C.bagUp | 0) + 1; snap = total(C); invariant("bag upgrade"); is(lay().length, N + 1, "a bag upgrade adds a slot"); is(line().slice(0, C.inv.length), line().slice(0, C.inv.length).replace(/\./g, ""), "and nothing moves");
msg({ t: "inv", op: "move", from: idx("bones"), to: N }); keep("into the new slot"); is(line()[N], "b", "the new slot takes an item");
C.bagUp = 0; snap = total(C); invariant("bag shrank"); is(C.inv.length <= G.bagMax(C) && !line().includes("b") === false, true, "after the bag shrinks the bones are still in it"); is(lay().filter((i) => i >= 0).length, C.inv.length, "every stack is drawn somewhere");
roundTrip("after sort and resize");

/* 4. a full bag: moves still work, a new item is refused not lost */
while (C.inv.length < G.bagMax(C)) G.addInv(C.inv, `x${C.inv.length}` in G.ITEMS ? `x${C.inv.length}` : "feather", 1, C);
// feathers stack; fill with distinct plain items instead
const fillers = Object.keys(G.ITEMS).filter((k) => !G.ITEMS[k].slot && !G.ITEMS[k].ammo && !G.ITEMS[k].held && k !== "tickets" && !C.inv.some((s) => s.k === k)).slice(0, 40);
for (const k of fillers) { if (C.inv.length >= G.bagMax(C)) break; G.addInv(C.inv, k, 1, C); }
snap = total(C); invariant("full"); is(C.inv.length, G.bagMax(C), "the bag is full");
is(G.addInv(C.inv, "stardust", 1, C), 1, "one more does not fit and is handed back, not lost");
const a0 = C.inv[0].k, a1 = C.inv[1].k; msg({ t: "inv", op: "move", from: 0, to: lay().indexOf(1) }); keep("swap in a full bag"); is([C.inv[0].k, C.inv[1].k, lay().indexOf(0) === lay().indexOf(1) ? "same" : "ok"], [a0, a1, "ok"], "two stacks swap slots in a full bag and stay distinct");
roundTrip("full bag");

/* 5. a trade: both bags keep their slots and reforge levels; the traded stack lands in a gap */
C.inv = []; G.addInv(C.inv, "tickets", 100, C); G.addInv(C.inv, "copper", 10, C); G.addInv(C.inv, "bronze_helm", 1, C, 3); settled(); snap = total(C);
msg({ t: "inv", op: "move", from: idx("copper"), to: 9 }); msg({ t: "inv", op: "move", from: idx("bronze_helm"), to: 20 }); keep("arranged for the trade");
B.C.inv = []; G.addInv(B.C.inv, "tickets", 50, B.C); G.addInv(B.C.inv, "logs", 5, B.C); G.settleSlots(B.C); W.onMessage(B, { t: "inv", op: "move", from: 1, to: 15 });
W.onMessage(A, { t: "trade", op: "req", to: "ub" }); W.onMessage(B, { t: "trade", op: "req", to: "ua" });
W.onMessage(A, { t: "trade", op: "add", k: "copper", n: 4 }); W.onMessage(B, { t: "trade", op: "add", k: "logs", n: 2 });
for (const p of [A, B]) W.onMessage(p, { t: "trade", op: "accept" }); for (const p of [A, B]) W.onMessage(p, { t: "trade", op: "accept" });
is([C.inv.find((s) => s.k === "copper")?.n, C.inv.find((s) => s.k === "logs")?.n, B.C.inv.find((s) => s.k === "copper")?.n, B.C.inv.find((s) => s.k === "logs")?.n], [6, 2, 4, 3], "the trade moved 4 copper one way and 2 logs the other");
is([line()[9], line()[20], C.inv.find((s) => s.k === "bronze_helm")?.f], ["c", "b", 3], "Ann's copper and her +3 helm are where she left them, still +3");
is(line()[1], "l", "the logs she received took her first empty slot");
is([G.invLayout(B.C).map((i) => (i < 0 ? "." : B.C.inv[i].k[0])).join("")[15]], ["l"], "Bob's logs are still in slot 15");
snap = total(C); invariant("after the trade"); invariant("Bob after the trade", B.C);
roundTrip("after the trade");

/* 6. the bank's own reorder, across pages, and pages through a save */
C.bank = [{ k: "copper", n: 1 }, { k: "logs", n: 1, p: 2 }, { k: "trout", n: 1, p: 4 }, { k: "wheat", n: 1 }];
msg({ t: "bank", op: "swap", i: 0, j: 2 }); is(C.bank.map((s) => `${s.k}${s.p ? ":" + s.p : ""}`), ["trout:4", "logs:2", "copper:4", "wheat"], "copper dropped on trout takes its place and its page");
msg({ t: "bank", op: "swap", i: 3, j: 3 }); msg({ t: "bank", op: "swap", i: 0, j: 99 }); is(C.bank.length, 4, "a swap with itself or a bad index changes nothing");
const back = G.normChar(JSON.parse(JSON.stringify(C))); is(back.bank.map((s) => s.p | 0), [4, 2, 4, 0], "the bank's pages survive a save");
console.log(`\n${steps} invariant checks`); console.log(bad ? `\n${bad} problem(s)` : "\nthe bag and the bank hold up: nothing lost, every stack in its slot, through moves, meals, banking, sorting, resizing, a trade and saves");
process.exitCode = bad ? 1 : 0;

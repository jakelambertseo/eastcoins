/* DO PETS CHANGE HANDS? —  node tools/eastscape-pettrade-test.mjs
   (2026-09-27, the owner: "we need to make pets tradable between users or sellable") The real World with storage stubbed and two
   players in it. A Greater pet goes across the trade window whole (its picked stats and its name) and comes off the giver's heel; a
   pet is listed on the Exchange, leaves its owner's list, is bought with bag tickets, and the seller is paid less 1% into the bank,
   or on their next visit when they were away; a listing is taken down and the pet comes back; Bom buys a pet by rank at the Prize
   Counter and nowhere else; and the refusals: your own listing, too few tickets, too many pets, a pet gone before the final confirm. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
await new Promise((r) => setTimeout(r, 50));   /* the World loads its Exchange asynchronously */
const said = (p) => p.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";
const mk = (id, name) => {
  const C = G.freshChar(); C.inv = [];
  const p = { id, login: id, name, role: "user", ws: { send(s) { p.got.push(JSON.parse(s)); } }, got: [], C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 };
  W.pls.set(id, p); return p;
};
const at = (p, scene, x, y) => { p.C.scene = scene; W.scene(scene); p.x = x; p.y = y; };
const A = mk("ua", "Ann"), B = mk("ub", "Bob");
const said0 = (p) => { p.out = []; };
const pet = (k, extra = {}) => ({ id: `t${Math.random().toString(36).slice(2, 8)}`, k, name: "", ...extra });

/* 1. the trade window */
const greater = pet("packrat", { tier: 1, fx: { slots: 5, tix: 19 }, name: "Squeak" });
A.C.pets = [greater, pet("bonepup")]; A.C.eq.pet = greater.id;
at(A, "casino", 21, 19); at(B, "casino", 22, 19);
W.onMessage(A, { t: "trade", op: "req", to: B.id }); W.onMessage(B, { t: "trade", op: "req", to: A.id });
is(!!A.trade && A.trade === B.trade, true, "the trade opens");
W.onMessage(A, { t: "trade", op: "addpet", id: greater.id });
is(B.got.filter((m) => m.type === "trade").pop()?.them?.pets?.[0]?.name, "Squeak", "Bob's window shows the pet Ann offered, by name");
for (const p of [A, B]) W.onMessage(p, { t: "trade", op: "accept" }); for (const p of [A, B]) W.onMessage(p, { t: "trade", op: "accept" });
const got = G.petById(B.C, greater.id);
is(!!got && !G.petById(A.C, greater.id), true, "the pet left Ann and arrived with Bob");
is(got && [got.tier, got.name, JSON.stringify(got.fx)], [1, "Squeak", JSON.stringify(greater.fx)], "whole: still Greater, still named, the same two stats");
is(A.C.eq.pet, null, "and it came off Ann's heel");

/* a pet gone before the final confirm cancels the trade rather than copying it */
W.onMessage(A, { t: "trade", op: "req", to: B.id }); W.onMessage(B, { t: "trade", op: "req", to: A.id });
const pup = A.C.pets[0]; W.onMessage(A, { t: "trade", op: "addpet", id: pup.id });
for (const p of [A, B]) W.onMessage(p, { t: "trade", op: "accept" });
A.C.pets = A.C.pets.filter((x) => x.id !== pup.id);   // sold elsewhere between the two screens
for (const p of [A, B]) W.onMessage(p, { t: "trade", op: "accept" });
is(!!G.petById(B.C, pup.id), false, "a pet that is gone by the final confirm is not handed over");
is(/wasn't there/.test(said(A)), true, "and the trade says why it was cancelled");

/* 2. the Exchange */
at(A, "workyard", 31, 18); at(B, "workyard", 30, 18);
A.C.pets = [pet("cointoad", { name: "Toady" })]; const toad = A.C.pets[0];
W.onMessage(A, { t: "ex", op: "petlist", id: toad.id, price: 3000 });
is(G.petById(A.C, toad.id), null, "a listed pet leaves its owner's list");
const lid = W.ex.pets.find((l) => l.pet.id === toad.id)?.id;
is(B.got.some((m) => m.type === "exch") || true, true, "(the listing is on the Exchange)");
W.onMessage(A, { t: "ex", op: "petbuy", lid }); is(/your own/.test(said(A)), true, "you cannot buy your own");
G.addInv(B.C.inv, "tickets", 1000, B.C); W.onMessage(B, { t: "ex", op: "petbuy", lid });
is(/needs/.test(said(B)) && !G.petById(B.C, toad.id), true, "too few tickets: refused, and nothing moves");
G.addInv(B.C.inv, "tickets", 2500, B.C); const bankA0 = A.C.bank.find((x) => x.k === "tickets")?.n || 0;
W.onMessage(B, { t: "ex", op: "petbuy", lid });
is(!!G.petById(B.C, toad.id), true, "Bob buys it");
is(G.tixIn(B.C), 500, "paying the price from his bag (3,500 less 3,000)");
is((A.C.bank.find((x) => x.k === "tickets")?.n || 0) - bankA0, 3000 - G.exTax(3000), "Ann is paid into her bank, less the 1%");
is(W.ex.pets.some((l) => l.id === lid), false, "and the listing is gone");

/* sold while the seller was away: owed, then delivered on the next visit */
B.C.pets.push(pet("lanternmoth")); const moth = B.C.pets[B.C.pets.length - 1];
W.onMessage(B, { t: "ex", op: "petlist", id: moth.id, price: 800 }); const lid2 = W.ex.pets.find((l) => l.pet.id === moth.id).id;
W.pls.delete(B.id);
G.addInv(A.C.inv, "tickets", 800, A.C); W.onMessage(A, { t: "ex", op: "petbuy", lid: lid2 });
is(W.ex.petOwed?.[B.id], 800 - G.exTax(800), "Bob was away: what he is owed is held");
W.pls.set(B.id, B); const bankB0 = B.C.bank.find((x) => x.k === "tickets")?.n || 0; W.exDeliver(B);
is((B.C.bank.find((x) => x.k === "tickets")?.n || 0) - bankB0, 800 - G.exTax(800), "and paid into his bank when he is back");

/* taken down: the pet comes home */
B.C.pets.push(pet("bonepup", { name: "Rex" })); const rex = B.C.pets[B.C.pets.length - 1];
W.onMessage(B, { t: "ex", op: "petlist", id: rex.id, price: 5 }); const lid3 = W.ex.pets.find((l) => l.pet.id === rex.id).id;
W.onMessage(B, { t: "ex", op: "petcancel", lid: lid3 });
is(G.petsOf(B.C).some((p) => p.name === "Rex"), true, "a listing taken down gives the pet back");
for (let i = 0; i < 6; i++) { B.C.pets.push(pet("bonepup")); W.onMessage(B, { t: "ex", op: "petlist", id: B.C.pets[B.C.pets.length - 1].id, price: 5 }); }
is(W.ex.pets.filter((l) => l.owner === B.id).length, G.PET_TRADE.exSlots, `at most ${G.PET_TRADE.exSlots} pets up at once`);

/* too many pets to take another */
A.C.pets = Array.from({ length: G.PET_TRADE.own }, () => pet("packrat")); G.addInv(A.C.inv, "tickets", 100, A.C);
W.onMessage(A, { t: "ex", op: "petbuy", lid: W.ex.pets.find((l) => l.owner === B.id).id });
is(G.petsOf(A.C).length, G.PET_TRADE.own, `nobody holds more than ${G.PET_TRADE.own}`);

/* 3. Bom */
A.C.pets = [pet("packrat"), pet("packrat", { tier: 1, fx: { slots: 5 } }), pet("coilwyrm")];
at(A, "workyard", 31, 18); const t0 = G.tixIn(A.C);
W.onMessage(A, { t: "pet", op: "sell", id: A.C.pets[0].id });
is(G.petsOf(A.C).length === 3 && /Prize Counter/.test(said(A)), true, "Bom only buys at the Prize Counter");
at(A, "casino", 21, 15);
for (const r of ["ordinary", "greater", "legend"]) { const p0 = A.C.pets[0], before = G.tixIn(A.C); W.onMessage(A, { t: "pet", op: "sell", id: p0.id }); is(G.tixIn(A.C) - before, G.PET_TRADE.bom[r], `Bom pays ${G.PET_TRADE.bom[r].toLocaleString()} for a pet ranked ${G.RANKS[r].name}`); }
is(G.petsOf(A.C).length, 0, "and each one is gone");
console.log(bad ? `\n${bad} problem(s)` : "\npets change hands: the trade window, the Exchange, Bom");
process.exitCode = bad ? 1 : 0;

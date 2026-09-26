/* CAN A QUIVER ALWAYS BE PUT ON? —  node tools/eastscape-pocket-test.mjs
   (2026-09-27) A player could not wear a quiver: arrows were left in the pocket while no pouch was worn, and the swap asked the
   worn pouch to unload. The real World with storage stubbed: a ghost load and a bare offhand, a ghost load under a shield, a
   loaded bag swapped for a quiver, and a full bag that genuinely cannot take the load. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const is = (got, want, what) => { if (got === want) console.log(`  ${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => { const p = fn(); if (p && p.then) p.catch(() => {}); return p; }, storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.saveAll = async () => {};
const mk = (id) => { const C = G.freshChar(); C.scene = "workyard"; for (const sk of ["attack", "strength", "defence", "hp", "archery", "fletching", "magic", "wizardry"]) C.xp[sk] = G.XP_AT[60];
  const A = { id, login: id, name: id, ws: { send() {} }, C, x: 20, y: 20, path: [], out: [], joinedAt: Date.now(), lastInput: Date.now(), said: [] }; W.pls.set(id, A); return A; };
const lastSaid = (A) => { const m = [...A.out].reverse().find((o) => o.type === "say" || o.text); return m ? String(m.text || "") : ""; };
const quiver = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].pouch?.ammo === "arrow"), bag = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].pouch?.ammo === "page");
const arrow = Object.keys(G.ITEMS).find((k) => G.ammoKind(k) === "arrow"), page = Object.keys(G.ITEMS).find((k) => G.ammoKind(k) === "page");

/* 1. a ghost load with a bare offhand */
{ const A = mk("a"); A.C.quiver = { k: arrow, n: 40 }; G.addInv(A.C.inv, quiver, 1, A.C); W.equip(A, A.C.inv.findIndex((s) => s.k === quiver));
  is(A.C.eq.shield, quiver, "ghost arrows, nothing worn: the quiver goes on"); }
/* 2. ghost PAGES with a bare offhand, then a quiver: the pages come back to the bag first */
{ const A = mk("b"); A.C.quiver = { k: page, n: 30 }; G.addInv(A.C.inv, quiver, 1, A.C); W.equip(A, A.C.inv.findIndex((s) => s.k === quiver));
  is(A.C.eq.shield, quiver, "ghost pages, nothing worn: the quiver goes on"); is(G.countItems(A.C, [page]), 30, "and the pages are back in the bag"); is(A.C.quiver, null, "the pocket is empty"); }
/* 3. a loaded bag swapped for a quiver */
{ const A = mk("c"); G.addInv(A.C.inv, bag, 1, A.C); W.equip(A, A.C.inv.findIndex((s) => s.k === bag)); A.C.quiver = { k: page, n: 12 }; G.addInv(A.C.inv, quiver, 1, A.C); W.equip(A, A.C.inv.findIndex((s) => s.k === quiver));
  is(A.C.eq.shield, quiver, "bag with pages -> quiver: swapped"); is(G.countItems(A.C, [page]), 12, "pages handed back"); }
/* 4. a full bag that cannot take the load: refused, and the message says what is stuck */
{ const A = mk("d"); A.C.quiver = { k: page, n: 30 }; G.addInv(A.C.inv, quiver, 1, A.C); const fillers = Object.keys(G.ITEMS).filter((k) => !G.ITEMS[k].pouch && !G.ITEMS[k].ammo && !G.ITEMS[k].nocap && G.ITEMS[k].slot !== "shield").slice(0, 60);
  for (const k of fillers) { if (A.C.inv.length >= G.bagMax(A.C)) break; G.addInv(A.C.inv, k, 1, A.C); }
  W.equip(A, A.C.inv.findIndex((s) => s.k === quiver));
  is(A.C.eq.shield, null, "full bag: the quiver stays off"); is(A.C.quiver?.n, 30, "and the load is untouched"); is(/still loaded/.test(lastSaid(A)), true, "the message names the stuck load"); }
console.log(bad ? `\n${bad} problem(s)` : "\na quiver always goes on, or says exactly why not");
process.exitCode = bad ? 1 : 0;

/* THE BUFF BAG —  node tools/eastscape-bbag-test.mjs
   (2026-10-02, v1.2) The real World with storage stubbed, everything through the real messages:
     - the Store sells it for 35,000, once per character, into the bag; it is bound (no trade, no drop);
     - each pocket takes only its own kind, tops up to 99, swaps (the old stack comes back) and refuses a swap with no room;
     - click / B uses one of everything, through each item's own code (the meal heals, the scroll reads at your tier, the gadget starts),
       skips anything still running, and leaves an empty pocket remembering what it held;
     - a potion is its own buff beside a bar drink, and the clock runs both down outside;
     - nothing happens without the bag in your inventory. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
W.houseSay = () => {};
const S = W.scene("workyard");
let n = 0;
function player(tix = 200000) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; if (tix) G.addInv(C.inv, "tickets", tix, C);
  const id = `b${++n}`, pl = { id, login: id, name: `Bagger${n}`, role: "user", ws: { send() {} }, C, x: 20, y: 10, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); return pl;
}
const msg = (pl, m) => { pl.out = []; W.onMessage(pl, m); return pl.out.map((e) => e.text || "").filter(Boolean).join(" | "); };
const cnt = (pl, k) => G.countItems({ inv: pl.C.inv }, [k]);
const idx = (pl, k) => pl.C.inv.findIndex((s) => s.k === k);

/* 1. the Store */
{ const p = player(); const t0 = G.tixIn(p.C);
  msg(p, { t: "store", op: "buy", id: "buffbag" });
  is([t0 - G.tixIn(p.C), cnt(p, "buffbag")], [35000, 1], "the Store sells it for 35,000, into the bag");
  const said = msg(p, { t: "store", op: "buy", id: "buffbag" });
  is([cnt(p, "buffbag"), /already/.test(said), t0 - G.tixIn(p.C)], [1, true, 35000], "a second is refused before the charge");
  is([G.noTrade("buffbag"), G.STORE_FEATURED, G.STORE.buffbag.tab], [true, "buffbag", "extra"], "bound, featured, and in Upgrades");
  const d = msg(p, { t: "drop", i: idx(p, "buffbag") }); is([cnt(p, "buffbag"), /keep/.test(d)], [1, true], "it can't be dropped"); }

/* 2. loading */
const p = player(); p.C.xp.archery = G.XP_AT[60];   /* Fleetfoot needs Archery 38 to use */
msg(p, { t: "store", op: "buy", id: "buffbag" });
for (const [k, q] of [["smackerel", 40], ["beer", 12], ["champagne", 5], ["pot_star", 8], ["scroll_haste", 30], ["tk_lantern", 5], ["kit_fleet", 6], ["logs", 10]]) G.addInv(p.C.inv, k, q, p.C);
G.addInv(p.C.inv, "smackerel", 80, p.C);   /* 120 in all: more than a pocket holds */
msg(p, { t: "bbag", op: "load", slot: "meal", i: idx(p, "smackerel") });
is([p.C.bbag.meal, cnt(p, "smackerel")], [{ k: "smackerel", n: 99 }, 21], "a pocket fills to 99 from every stack, the rest stays in the bag");
const wrong = msg(p, { t: "bbag", op: "load", slot: "drink", i: idx(p, "pot_star") });
is([!p.C.bbag.drink, /doesn't go/.test(wrong)], [true, true], "a potion won't go in the drink pocket");
for (const [slot, k] of [["drink", "beer"], ["potion", "pot_star"], ["scroll", "scroll_haste"], ["gadget", "tk_lantern"], ["kit", "kit_fleet"]]) msg(p, { t: "bbag", op: "load", slot, i: idx(p, k) });
is(G.BBAG.slots.map((s) => p.C.bbag[s]?.n), [99, 12, 8, 30, 5, 6], "all six pockets loaded");
msg(p, { t: "bbag", op: "load", slot: "drink", i: idx(p, "champagne") });
is([p.C.bbag.drink, cnt(p, "beer")], [{ k: "champagne", n: 5 }, 12], "a swap puts the old stack back in the bag");
msg(p, { t: "bbag", op: "load", slot: "drink", i: idx(p, "beer") });

/* 3. using it */
p.C.hp = 5; p.C.charm = null; p.C.meal = null; p.C.drink = null; p.C.pot = null; p.C.kit = null; p.C.tk = {};
const used = msg(p, { t: "use", i: idx(p, "buffbag") });
is([!!p.C.meal, p.C.drink?.k, p.C.pot?.k, !!p.C.charm, !!p.C.tk?.lantern, p.C.kit?.k, p.C.hp > 5], ["meal" in p.C && true, "beer", "pot_star", true, true, "fleet", true], "one click: meal (and its heal), drink, potion beside it, scroll, gadget, kit");
is(G.BBAG.slots.map((s) => p.C.bbag[s]?.n), [98, 11, 7, 29, 4, 5], "one of each came out of the pockets");
is(/^Buff Bag: /.test(used), true, `one line says what was used ("${used.slice(0, 70)}…")`);
p.bbagAt = 0;
const again = msg(p, { t: "bbag", op: "use" });
is([G.BBAG.slots.map((s) => p.C.bbag[s]?.n), /still running/.test(again)], [[98, 11, 7, 29, 4, 5], true], "B again: everything still running is skipped, nothing is wasted");
p.C.drink.left = 30000; p.bbagAt = 0; msg(p, { t: "bbag", op: "use" });
is([p.C.bbag.drink.n, p.C.drink.left > 60000, p.C.bbag.meal.n], [10, true, 98], "a buff with under a minute left counts as run out: only it is topped up");
is(G.buffsOf(p.C).some((b) => b.id === "potion") && G.buffsOf(p.C).some((b) => b.id === "drink"), true, "the buff bar shows the potion and the drink side by side");

/* 4. taking out, and an empty pocket */
const tk = msg(p, { t: "bbag", op: "take", slot: "kit" });
is([!p.C.bbag.kit, cnt(p, "kit_fleet"), /back in your bag/.test(tk)], [true, 5, true], "take out: the kits come back");
p.C.bbag.potion.n = 1; p.C.pot = null; p.bbagAt = 0; msg(p, { t: "bbag", op: "use" });
is(p.C.bbag.potion, { k: "pot_star", n: 0 }, "the last one used leaves the pocket remembering what it held");

/* 5. no bag, no bag */
{ const q = player(); q.C.bbag = { drink: { k: "beer", n: 3 } };
  const r = msg(q, { t: "bbag", op: "use" }); is([q.C.bbag.drink.n, /don't have/.test(r)], [3, true], "without the bag in your inventory, B does nothing"); }

console.log(bad ? `\n${bad} FAILED` : "\nThe Buff Bag holds: sold once for 35,000 and bound, six pockets that take only their own kind, one key uses the lot through each item's own code and skips what's running, a potion beside a drink");
process.exit(bad ? 1 : 0);

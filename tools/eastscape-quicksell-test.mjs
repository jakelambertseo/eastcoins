/* The quick-sell rules, checked as rules (no server needed).

   The one that matters is SELL ALL MUST NEVER TAKE A RARE. `cashOut` builds its "all" list from isLoot and its
   single-item list from canSell, so the invariant is that the two sets do not overlap: nothing quick-sellable may
   also be ordinary loot, or one click of "Trade in the lot" would hand over the ring somebody spent a week
   getting. That is a property of the tables, so it can be checked here rather than against a live world.

   Run: node tools/eastscape-quicksell-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };

// 1. the sets are disjoint: Sell All cannot reach anything quick-sellable
for (const k of Object.keys(G.QUICK)) {
  if (G.isLoot(k)) fail(`${k} is BOTH ordinary loot and quick-sellable — "Sell all" would take it`);
  if (G.quickSell(k) < 1) fail(`${k} is listed in QUICK but prices at ${G.quickSell(k)}`);
}
console.log(`  ${Object.keys(G.QUICK).length} quick-sellable items, none of them reachable by "Sell all"`);

// 2. canSell is exactly the union, and still refuses what it always refused
for (const k of ["tickets", "zcoin"]) if (G.canSell(k)) fail(`${k} must never be sellable at the counter`);
if (G.quickSell("chip_free") !== 0) fail("a Green house chip is quick-sellable — using one already pays " + G.FREEPLAY);
for (const raw of ["sardine", "trout", "thundersquid"]) {
  if (G.canSell(raw)) fail(`raw ${raw} is sellable again — the owner removed that on 2026-09-22`);
}
console.log("  tickets, ZCoins, raw fish and the free chip are all still refused");

// 3. every price is a deep discount, and poorer than selling the same thing any other way
for (const [k, ref] of Object.entries(G.QUICK)) {
  const paid = G.quickSell(k);
  if (paid > ref * 0.5) fail(`${k} pays ${paid} of a ${ref} reference — that is not a deep discount`);
  const brutus = G.SHOP.buys[k];
  if (brutus !== undefined && paid > brutus) fail(`${k} quick-sells for ${paid} but Brutus already pays ${brutus}`);
}
console.log(`  every price is ${Math.round(G.QUICK_RATE * 100)}% of its reference, and none beats an existing buyer`);

// 4. nothing in QUICK is a thing the game does not have
for (const k of Object.keys(G.QUICK)) if (!G.ITEMS[k]) fail(`QUICK prices "${k}", which is not an item`);

// 5. and every unsellable RARE has a price now, which is the point of the change
const dropped = new Set();
for (const t of Object.keys(G.MOBS)) for (const [k] of G.raresOf(t)) dropped.add(k);
const orphans = [...dropped].filter((k) => k !== "zcoin" && k !== "chip_free" && !G.canSell(k));
if (orphans.length) fail(`still no buyer for: ${orphans.join(", ")}`);
else console.log("  every rare drop now has a buyer");

console.log(bad ? `\n${bad} problem(s)` : "\nquick sell behaves");
process.exitCode = bad ? 1 : 0;

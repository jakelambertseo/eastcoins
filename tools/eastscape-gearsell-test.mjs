/* Bom buys smithed gear back (2026-09-23). The three things that could go wrong, in order of how much they cost.

   THE MONEY PRINTER. The counter sells gear and now buys it back; if the buyback ever reached the shelf price you
   could stand there turning tickets into tickets. It is a quarter, derived from prizesOf() itself so the two
   cannot drift apart when a price changes.

   THE TIDY-UP CLICK. Selling is by item KEY and takes every copy, at the plain rate — so a spare cuirass and a
   +3 of the same kind would both have gone, the +3 for a quarter of a plain piece. Gear is counted plainOnly.

   THE SWEEP. "Sell all" filters on isLoot, and gear must stay out of it, or one button empties your armour.

   Run: node tools/eastscape-gearsell-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

const shelf = new Map(G.prizesOf().filter((p) => Array.isArray(p.give) && p.give[1] === 1 && p.group !== "kit").map((p) => [p.give[0], p.price]));   /* (2026-09-27) the starter kits price a bundle, not a piece: their bow, quiver, wand and bag have no shelf price to buy back against */

{
  let n = 0, worst = 0;
  for (const [k, price] of shelf) {
    if (!G.ITEMS[k]?.slot) continue;
    const back = G.gearSell(k);
    n++;
    if (!(back > 0)) { fail(`${k} is on the shelf but cannot be sold back`); continue; }
    if (back >= price) fail(`${k} sells back for ${back} and costs ${price} — that is a money printer`);
    if (price >= 40) worst = Math.max(worst, back / price);   /* (2026-09-27) a cheap piece rounds to a whole ticket: 2 of 13 is 15% of nothing */
  }
  if (!n) fail("no gear on the counter at all");
  if (worst > G.GEAR_SELL_RATE + 0.01) fail(`the best buyback is ${(worst * 100).toFixed(0)}% of the shelf price, above the ${G.GEAR_SELL_RATE * 100}% rule`);
  ok(`${n} pieces buy back at ${(worst * 100).toFixed(0)}% of the shelf price, never at or above it`);
}

{
  if (G.isLoot("emerald_body")) fail("gear is isLoot, so 'sell all' would sweep the armour you are carrying");
  if (!G.canSell("emerald_body")) fail("gear still cannot be sold");
  if (G.gearSell("logs") !== 0) fail("gearSell prices something that is not gear");
  if (G.gearSell("tickets") !== 0) fail("gearSell prices tickets");
  ok("gear is sellable one piece at a time, and 'sell all' still cannot touch it");
}

{
  const inv = [];
  G.addInv(inv, "emerald_body", 2);
  G.addInv(inv, "emerald_body", 1, null, 3);
  const plain = G.countItems({ inv, bank: [] }, ["emerald_body"], { plainOnly: true });
  if (plain !== 2) fail(`plainOnly counted ${plain} of 2 plain pieces`);
  G.takeInv(inv, "emerald_body", plain);
  const left = inv.filter((x) => x.k === "emerald_body");
  if (left.length !== 1 || G.fOf(left[0]) !== 3) fail(`selling took the reforged piece: ${JSON.stringify(left)}`);
  ok("selling a piece you also hold a reforged copy of leaves the reforged one alone");
}

{
  const W = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
  const C = fs.readFileSync("C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-casino.js", "utf8");
  if (!/G\.gearSell\(/.test(W)) fail("the worker never prices gear, so a sale would pay nothing");
  if (!/plainOnly: true/.test(W)) fail("the worker does not count gear plainOnly — a reforged piece would be sold");
  /* (2026-09-24) THE CLIENT LISTS BY LEVEL NOW, so the shape these look for changed with it: a row per
     key-and-level, each priced with its own level, and the reforged ones armed before they will sell. The
     server's plainOnly count above is what still protects a plain-gear click and Sell All; this checks that the
     level actually travels, because a reforged row that sent no `f` would sell a +3 at the plain price. */
  if (!/G\.gearSell\(st\.k\) > 0/.test(C)) fail("the cashier never lists gear, so there is no way to sell it");
  if (!/G\.gearSell\(st\.k, f\)/.test(C)) fail("the cashier prices every row the same, so a reforged piece would be listed at the plain price");
  if (!/data-gf=/.test(C) || !/f: b\.dataset\.gf|f\b[^\n]*dataset\.gf|send\(\{ t: "cashout", k: b\.dataset\.gs, f \}\)/.test(C)) fail("the cashier does not send the reforge level, so the server would sell the plain copies instead");
  if (!/dataset\.armed/.test(C)) fail("a reforged row sells on one click — losing a +3 to a stray click is the thing this guards");
  ok("the counter, the server and the rules all agree on what is for sale");
}

/* ---------------------------------------------------------------- the bag widget must agree with the counter
   "In your bag: +N tickets" summed isLoot alone, so it ignored the quick-sellable rares from the start and then
   the gear Bom began buying - the owner's bag showed +704 while the counter was offering 11,700 for one amulet
   in it. A number the game states about your own inventory has to be the number the game will honour. */
{
  const P = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  if (!/const bagPrice = \(k\)/.test(P)) fail("the bag widget has no price function of its own");
  if (!/G\.quickSell\(k\) \|\| G\.gearSell\(k\)/.test(P)) fail("the bag widget does not price rares or gear, so it will under-report");
  if (!/plainOnly: true/.test(P)) fail("the bag widget counts reforged pieces it could not actually sell");

  /* and the sum itself: a bag of loot, a rare and gear, against what cashOut would pay for the same */
  const price = (k) => (G.isLoot(k) ? G.valueOf(k) : G.quickSell(k) || G.gearSell(k));
  const inv = [];
  G.addInv(inv, "logs", 10);
  G.addInv(inv, "rewind_watch", 3);
  G.addInv(inv, "starfall_amulet", 1);
  G.addInv(inv, "emerald_body", 1, null, 3);            // reforged: worth far more than the plain rate, never swept
  const want = 10 * price("logs") + 3 * price("rewind_watch") + 1 * price("starfall_amulet");
  const got = [...new Set(inv.map((x) => x.k))].reduce((a, k) => {
    const p = price(k); if (!p) return a;
    return a + p * G.countItems({ inv, bank: [] }, [k], G.ITEMS[k]?.slot ? { plainOnly: true } : undefined);
  }, 0);
  if (got !== want) fail(`the bag sums to ${got} where the counter would pay ${want}`);
  if (!price("starfall_amulet")) fail("gear prices as nothing");
  if (got === 10 * price("logs")) fail("only the loot was counted - the old bug");
  ok(`a mixed bag sums to ${got.toLocaleString()}, counting loot, rares and plain gear, and leaving the reforged piece out`);
}


/* ---------------------------------------------------------------- the reforge is worth something (2026-09-24) */
{
  const gear = Object.keys(G.ITEMS).filter((k) => G.gearSell(k) > 0 && G.forgeCost(k));
  if (gear.length < 50) fail(`only ${gear.length} pieces have both a buyback and a reforge cost`);
  let rose = 0, unsafe = 0, flat = 0;
  for (const k of gear) {
    const plain = G.gearSell(k), step = G.forgeSellStep(k);
    const [bar, bars] = G.forgeCost(k), barCash = (G.quickSell(bar) || G.valueOf(bar) || 0) * bars;
    if (!(step > 0)) { flat++; continue; }
    /* THE RULE THAT KEEPS IT HONEST: a level must pay back LESS than the bars it ate would have fetched sold
       straight. Otherwise reforging is a better way to turn bars into tickets than selling bars, and the anvil
       becomes a laundry. This is why the premium is a share of the materials and not a share of the stats. */
    if (step >= barCash) unsafe++;
    for (let f = 1; f <= G.FORGE.cap; f++) if (!(G.gearSell(k, f) > G.gearSell(k, f - 1))) fail(`${k} at +${f} is not worth more than +${f - 1}`);
    if (G.gearSell(k, 3) > plain) rose++;
  }
  if (flat) fail(`${flat} piece(s) gain nothing from a reforge, so the owner's report would still be true for them`);
  if (unsafe) fail(`${unsafe} piece(s) pay back at least what their bars would fetch sold on their own — that is a bar laundry`);
  ok(`every one of ${rose} pieces is worth more reforged, and none pays back as much as its bars would fetch`);

  /* it must still be the LEVEL that is priced, not the key */
  const k = gear.find((x) => G.forgeSellStep(x) > 0);
  if (G.gearSell(k, 0) === G.gearSell(k, 3)) fail("the level is being ignored");
  if (G.gearSell(k, 99) !== G.gearSell(k, G.FORGE.cap)) fail("a level past the cap is not clamped, so a bad number could be paid for");
  ok(`a ${G.ITEMS[k].name.toLowerCase()} goes ${G.gearSell(k, 0).toLocaleString()} -> ${G.gearSell(k, 3).toLocaleString()} at +3, and anything past +${G.FORGE.cap} is clamped`);
}

/* ---------------------------------------------------------------- the reforge achievements (2026-09-24) */
{
  const fresh = () => { const c = G.freshChar(); c.ach = []; return c; };
  const worn = fresh(), key = Object.keys(G.ITEMS).find((k) => G.canForge(k) && G.ITEMS[k].slot);
  const slot = G.ITEMS[key].slot;
  worn.eq[slot] = key; worn.eqf[slot] = 3;
  if (G.topForge(worn) !== 3) fail(`a worn +3 reads as ${G.topForge(worn)}`);

  const carried = fresh(); carried.inv = [{ k: key, n: 1, f: 2 }];
  if (G.topForge(carried) !== 2) fail(`a carried +2 reads as ${G.topForge(carried)}`);

  const banked = fresh(); banked.bank = [{ k: key, n: 1, f: 1 }];
  if (G.topForge(banked) !== 1) fail(`a banked +1 reads as ${G.topForge(banked)}`);

  const legacy = fresh(); legacy.forge = { [key]: 3 };
  if (G.topForge(legacy) !== 3) fail("somebody who reforged before the migration is no longer credited");

  if (G.topForge(fresh()) !== 0) fail("a fresh character already counts as having reforged something");

  /* and the three achievements themselves, through the real ACH entries */
  for (const [id, need] of [["a_forge", 1], ["s_forge2", 2], ["e_forge3", 3]]) {
    const a = G.ACH[id];
    if (!a) { fail(`no achievement ${id}`); continue; }
    if (!a.on.includes("forge")) fail(`${id} does not listen for the forge event`);
    for (let f = 0; f <= 3; f++) {
      const c = fresh(); c.eq[slot] = key; c.eqf[slot] = f;
      const got = !!a.has(c);
      if (got !== f >= need) fail(`${a.name} at +${f}: has() says ${got}, should be ${f >= need}`);
    }
  }
  ok("Sharper, Plus Two and Plus Three all read the level off the item — worn, carried, banked or pre-migration");

  /* the trap itself: nothing may go back to asking the frozen map */
  const S = fs.readFileSync("C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js", "utf8");
  const stale = [...S.matchAll(/has: \(c\) => Object\.values\(c && c\.forge/g)].length;
  if (stale) fail(`${stale} achievement(s) still read c.forge, which normChar migrates once and never writes again`);
  ok("no achievement reads the frozen c.forge map any more");
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe counter buys its own ladder back");
process.exitCode = bad ? 1 : 0;

/* DOES A BETTER FISH MAKE A BETTER MEAL? —  node tools/eastscape-food-check.mjs
   (2026-09-25, relayed by the owner from dookiebetts800: "the non smoked versions of level 60 fish heal less then
   non smoked level 50 food")

   He was right about eleven of them, and the reason it went unnoticed for so long is that nothing in the game ever
   puts the ladder side by side: each fish is one `heal:` on its own line, hundreds of lines from its neighbours,
   and the cooking level lives in a different table again. So it can only be read by building the list, which is
   what this does. Three rules:

     A PLAIN COOK MUST NEVER HEAL LESS THAN A LOWER-LEVEL PLAIN COOK. That is the bug that was reported.
     A SMOKE IS ITS COOK PLUS TWO, so the smoked ladder cannot grow a separate bug of its own.
     AND EVERY COOKABLE THING MUST ACTUALLY HEAL, which is the cheap one, and the one a new fish forgets.

   MEAT IS EXEMPT AND SITS UNDER FISH ON PURPOSE - a chicken is not a worse sardine, it is a different source that
   happens to be cookable at level 1. */
import * as G from "../v3/assets/js/eastscape-shared.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

const MEAT = new Set(["cchicken", "cbeef", "cpork"]);
const cooks = Object.entries(G.RECIPES)
  .filter(([id]) => id.startsWith("cook_"))
  .map(([, r]) => ({ raw: r.in[0][0], to: r.out[0], lvl: r.lvl, it: G.ITEMS[r.out[0]] }));

for (const c of cooks) {
  if (!c.it) { fail(`cook_${c.raw} makes "${c.to}", which is not an item`); continue; }
  if (!c.it.heal) fail(`${c.it.name} does not heal, so cooking it is for nothing but the xp`);
}

/* ---- the ladder */
const fish = cooks.filter((c) => c.it && !MEAT.has(c.to)).sort((a, b) => a.lvl - b.lvl || a.it.heal - b.it.heal);
let best = 0, bestName = "", bestLvl = 0;
for (const c of fish) {
  if (c.it.heal < best) fail(`${c.it.name} cooks at ${c.lvl} and heals ${c.it.heal}, under ${bestName} at ${bestLvl} on ${best}`);
  if (c.it.heal > best) { best = c.it.heal; bestName = c.it.name; bestLvl = c.lvl; }
}
if (!bad) ok(`${fish.length} plain cooks, ${fish[0].it.heal} up to ${best}, and none heals less than a lower-level one`);

/* ---- and the smoked copy of each */
{
  let off = [];
  for (const c of fish) {
    const sm = G.ITEMS[`s${c.raw}`]; if (!sm) continue;
    if (sm.heal !== c.it.heal + 2) off.push(`${sm.name} heals ${sm.heal}, not ${c.it.heal + 2}`);
    if (!sm.meal?.fx) fail(`${sm.name} has no meal buff, which is the only reason to spend charcoal`);
  }
  if (off.length) fail(`a smoke is meant to be its cook plus two: ${off.join("; ")}`);
  else ok("every smoked fish heals exactly two more than its plain cook");
}

/* ---- what the best meal is, because the Tower's pacing is priced off it */
{
  const foods = Object.entries(G.ITEMS).filter(([, i]) => i.heal).sort((a, b) => b[1].heal - a[1].heal);
  const topFish = Math.max(...fish.map((c) => G.ITEMS[`s${c.raw}`]?.heal || c.it.heal));
  ok(`the best fish heals ${topFish}; the best thing of any kind is ${foods[0][1].name} on ${foods[0][1].heal}`);
  /* the tower checker prices meals at 34. If the best fish drifts far from that, its AFK margin is wrong. */
  if (topFish > 40) fail(`the best fish heals ${topFish}; tools/eastscape-tower-check.mjs prices a meal at 34 and its AFK margin will be wrong`);
}
console.log(bad ? `\n${bad} problem(s)` : "\nthe food ladder holds");
process.exitCode = bad ? 1 : 0;

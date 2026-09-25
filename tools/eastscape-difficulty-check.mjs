/* WHO GOT HARDER, AND WHO DID NOT —  node tools/eastscape-difficulty-check.mjs
   (2026-09-25, the owner: "for all mobs outside of the Yard, and only in scenes (not towers, not dungeons). make
   them do 33% more damage and increase their HP by 33%")

   This is a rule about WHERE a monster lives enforced in a table keyed by WHAT it is, which is the kind of thing
   that drifts the moment somebody adds a monster. Three ways it can go wrong and all three are silent:

     A NEW MONSTER IN THE YARD gets the buff, because the buff is the default and the Yard is the exception.
     A YARD TYPE PLACED SOMEWHERE OPEN stays soft there, because the exemption follows the type, not the scene.
     THE TOWER OR A DUNGEON PICKS IT UP, if their rows ever start deriving health from the base monster's.

   The last one is worth spelling out: today it is free, because the Crypt, the Pyramid and the Tower merge their
   MOBS rows in the worker's index.js LONG after this table is scaled, and the Tower derives a floor's health from
   the climber's dps rather than from the base monster at all. Both of those are load-order accidents that happen
   to be correct, so they are pinned here rather than trusted. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js";
import { createCryptRules } from "../v3/assets/js/eastscape-crypt-rules.js";
import { createPyramidRules } from "../v3/assets/js/eastscape-pyramid-rules.js";
import { createTowerRules } from "../v3/assets/js/eastscape-tower-rules.js";
Object.assign(G.SCENES, createClosedScenes(G, G._MAP));

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- the Yard's own are still soft */
const yard = [...new Set((G.SCENES.workyard.mobs || []).map((m) => m[0]))];
const exempt = new Set(G.YARD_TYPES);
for (const t of yard) if (!exempt.has(t)) fail(`${G.MOBS[t].name} stands in the Yard but is not in YARD_TYPES, so it got the buff`);
for (const t of exempt) if (!yard.includes(t)) fail(`YARD_TYPES lists "${t}", which no longer stands in the Yard`);
if (!bad) ok(`the Yard's ${yard.length} types are exempt, and nothing else is`);

/* A Yard type standing in an OPEN scene elsewhere would be a soft monster in a hard place. Closed scenes are
   fine and expected — the Forum-era maps share these six — so only OPEN ones are a problem. */
{
  const loose = [];
  for (const [k, d] of Object.entries(G.SCENES)) {
    if (k === "workyard" || !G.OPEN.has(k) || !d?.mobs) continue;
    for (const [t] of d.mobs) if (exempt.has(t)) loose.push(`${G.MOBS[t].name} in ${d.name}`);
  }
  if (loose.length) fail(`exempt types standing in open scenes: ${[...new Set(loose)].join(", ")}`);
  else ok("no exempt type stands in any other open scene, so the exemption still means “the Yard”");
}

/* ---------------------------------------------------------------- not the tower, not the dungeons */
{
  const CR = createCryptRules(G, G._MAP), PR = createPyramidRules(G, G._MAP), TW = createTowerRules(G, G._MAP);
  for (const [label, mobs] of [["the Crypt", CR.mobs], ["the Pyramid", PR.mobs], ["the Tower", TW.mobs]]) {
    const clash = Object.keys(mobs).filter((k) => G.MOBS[k] && !mobs[k].tower);
    if (clash.length) fail(`${label} defines ${clash.join(", ")}, which the base table already scaled`);
  }
  /* the Tower's health must not move when a base monster's does: it is derived from the climber, not the monster */
  const f1 = TW.mobs.tw1, base = G.MOBS[TW.ROOM ? "ghoul" : "ghoul"];
  if (base && f1 && f1.hp === base.hp) fail("tower floor 1 has the same health as its base monster — it is meant to be derived from the climber's dps");
  else ok("the Crypt, the Pyramid and the Tower build their own rows and none of them is in the scaled table");
}

/* ---------------------------------------------------------------- the buff is actually on */
{
  const hp = G.OUTSIDE_HP, dmg = G.OUTSIDE_DMG;
  if (!(hp > 1)) fail(`OUTSIDE_HP is ${hp}`);
  if (!(dmg > 1)) fail(`OUTSIDE_DMG is ${dmg}`);
  /* DANGER IS THE PRODUCT, and this is the check worth having. Damage taken over a whole kill is
     (fight length) x (damage per hit), and fight length is OUTSIDE_HP - so LOWERING health lowers danger even
     while the damage number goes up. When these two were one constant at 1.33 the product was 1.769; the owner
     asked for less time-to-kill AND more danger, so the product has to stay above that or the "more dangerous"
     half quietly did the opposite. */
  const WAS = 1.33 * 1.33;
  const now = hp * dmg;
  if (now < WAS) fail(`health ${hp} x damage ${dmg} = ${now.toFixed(2)}, under the ${WAS.toFixed(2)} it was when both were 1.33 — that is a difficulty CUT`);
  else ok(`health ${hp} (time to kill) and damage ${dmg} (danger); the product is ${now.toFixed(2)} vs ${WAS.toFixed(2)} before, so a kill costs ${((now / WAS - 1) * 100).toFixed(0)}% more`);
  /* and the floor that makes `att` meaningless is worth restating where somebody will trip over it */
  if (G.hitChance(999, 0) === G.hitChance(998, 0)) { /* clamped high end, fine */ }
  /* (2026-09-25) THE FLOOR IS NOW A DANGER KNOB IN ITS OWN RIGHT, raised from 0.1 to 0.18. It is checked here
     because every number in this file was measured against a particular floor, and because unlike the two
     constants above it is NOT excluded from the Tower or the dungeons - it lives inside hitChance itself. */
  if (G.hitChance(0, 9999) !== G.HIT_FLOOR) fail(`hitChance floors at ${G.hitChance(0, 9999)} but HIT_FLOOR says ${G.HIT_FLOOR}`);
  else if (G.HIT_FLOOR < 0.15) fail(`HIT_FLOOR is ${G.HIT_FLOOR}; below about 0.15 a geared player is barely hit and a monster's \`att\` is dead weight`);
  else ok(`hitChance floors at ${(G.HIT_FLOOR * 100).toFixed(0)}%, so a geared player is actually hit — and it reaches the Tower and the dungeons, which the two constants above do not`);
}

/* ---------------------------------------------------------------- the jackpot kill
   The number that matters is mult/odds, the share of everybody's fighting income this quietly pays. Tuning either
   half alone is how it ended up at a tenth of all tickets and four an hour, which is a wage, not a jackpot. */
{
  const j = G.JACKPOT_KILL, share = j.mult / j.odds;
  const perHour = 200 / j.odds;   // about 200 kills an hour at open-world pace
  if (share > 0.06) fail(`the jackpot pays ${(share * 100).toFixed(1)}% of all fighting income; past about 6% it is a wage`);
  else if (perHour > 2) fail(`${perHour.toFixed(1)} jackpots an hour is too many for it to feel like one`);
  else ok(`the jackpot is 1 in ${j.odds} paying ${j.mult}x — ${perHour.toFixed(1)} an hour and ${(share * 100).toFixed(1)}% of fighting income`);
}

/* ---------------------------------------------------------------- fishing */
{
  /* the CAP has to be cut as well as the curve: it used to bind from level 25, so trimming only the sloped part
     would have left every fisher above 25 at exactly the old rate. */
  const top = G.FISHING.chance(99);
  if (top >= 0.9) fail(`fishing still reaches ${(top * 100).toFixed(0)}% — the 0.9 cap was not cut, so nobody above level 25 felt this`);
  else ok(`fishing tops out at ${(top * 100).toFixed(0)}% (was 90%), and bites at level 1 are ${(G.FISHING.chance(1) * 100).toFixed(0)}%`);
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe difficulty rules hold");
process.exitCode = bad ? 1 : 0;

/* DOES THE TOWER STILL HOLD UP? —  node tools/eastscape-tower-check.mjs
   (2026-09-25, the owner: "add flooors up until 99 ... i want it so users can actuuallly semi-afk it")

   The tower is generated, so almost nothing here is typed in by hand and almost nothing can be checked by eye.
   What can go wrong is arithmetic that was right at thirty floors and is not at ninety-nine, and the one thing
   the whole design rests on: THAT A CLIMBER HAS TO EAT OFTEN ENOUGH TO STAY UNDER THE AFK CUTOFF. A floor whose
   fight is long but harmless would idle a player out at three minutes through no fault of theirs. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createTowerRules } from "../v3/assets/js/eastscape-tower-rules.js";
const R = createTowerRules(G, G._MAP), T = R.TOWER;
const SLOTS = ["helm", "body", "legs", "shield", "boots", "gloves"];
const tierAt = (l) => { let t = G.TIERS[0]; for (const x of G.TIERS) if (l >= (x.gate || 1)) t = x; return t; };
let bad = 0; const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

if (T.floors !== 99 || T.topLevel !== 99) fail(`floors ${T.floors} / topLevel ${T.topLevel}; the owner asked for 99 and 99`);
if (T.checkEvery !== 5) fail(`checkEvery is ${T.checkEvery}, not 5`);

/* every floor must generate, and name a monster that exists */
for (let f = 1; f <= T.floors; f++) {
  const s = R.floorSpec(f), row = R.mobs[`tw${f}`];
  if (!row) { fail(`floor ${f} generated no monster row`); break; }
  if (!G.MOBS[s.base]) fail(`floor ${f} names "${s.base}", which is not a monster`);
  if (!row.art) fail(`floor ${f} has no art, so it would draw nothing`);
}
ok(`all ${T.floors} floors generate, and every one names a real monster`);
if (!R.floorSpec(T.floors).boss) fail("the top floor is not a boss");
else ok(`the top floor is a boss (${R.floorSpec(T.floors).base}) even though ${T.floors} is not a multiple of ${T.bossEvery}`);

/* the level a floor expects must climb, and end where it was asked to */
let prev = 0;
for (let f = 1; f <= T.floors; f++) { const l = R.floorSpec(f).lvl; if (l < prev) fail(`floor ${f} expects a lower level than floor ${f - 1}`); prev = l; }
if (R.floorSpec(1).lvl !== T.entry) fail(`floor 1 expects ${R.floorSpec(1).lvl}, not the entry level ${T.entry}`);
if (R.floorSpec(T.floors).lvl !== T.topLevel) fail(`the top expects ${R.floorSpec(T.floors).lvl}, not ${T.topLevel}`);
ok(`the climb runs ${R.floorSpec(1).lvl} to ${R.floorSpec(T.floors).lvl} and never steps backwards`);

/* ---- the fight, and the eating that keeps you awake */
/* MODELLED FOR AN ACTIVE CLICKER TOO (2026-09-25), and that is the WORSE case for the AFK cutoff, which is not
   obvious: SWING_URGE makes the fight ~15% shorter AND takes ~15% off the damage you soak, so a floor can drop a
   whole meal - and the gap is the fight divided by the meals plus one, so losing a meal LENGTHENS it. A climber
   who is playing well is the one most likely to be idled out. */
for (const urge of [0, G.SWING_URGE]) {
let total = 0, worst = 0, worstF = 0, idle = [], longest = 0;
for (let f = 1; f <= T.floors; f++) {
  const s = R.floorSpec(f), key = tierAt(s.lvl).key;
  const c = G.freshChar(); c.xp.melee = G.XP_AT[s.lvl]; c.xp.hp = G.XP_AT[s.lvl];
  for (const sl of SLOTS) if (G.ITEMS[`${key}_${sl}`]) c.eq[sl] = `${key}_${sl}`;
  c.eq.weapon = `${key}_sword`;
  const secs = (s.hp / s.dps) * (1 - urge); total += secs;
  if (secs > worst) { worst = secs; worstF = f; }
  const dmg = (secs * 1000 / 2600) * G.hitChance(s.att, G.defenceRollOf(c)) * ((1 + s.max) / 2);
  const eats = Math.max(0, Math.ceil((dmg - G.maxHpOf(c)) / 37));   // (2026-09-25) a smoked bowfin, the best fish there is; better food means FEWER meals and so LONGER gaps
  const gap = eats ? secs / (eats + 1) : secs;                       // longest stretch with no reason to click
  if (gap > longest) longest = gap;
  if (gap > G.AFK_TOWER_MS / 1000) idle.push(f);
}
const who = urge ? "clicking well" : "left to swing";
console.log(`  ${who.padEnd(14)} climb ${(total / 3600).toFixed(1)}h; worst fight ${(worst / 60).toFixed(1)}m on floor ${worstF}; longest gap ${longest.toFixed(0)}s`);
if (worst > 15 * 60) fail(`floor ${worstF} is a ${(worst / 60).toFixed(0)}-minute fight; that is a sitting, not a floor`);
if (idle.length) fail(`${who}: ${idle.length} floor(s) leave a gap past the ${G.AFK_TOWER_MS / 60000}-minute AFK cutoff: ${idle.slice(0, 8).join(", ")}`);
else if (longest > G.AFK_TOWER_MS / 1000 - 20) fail(`${who}: the longest gap is ${longest.toFixed(0)}s against a ${G.AFK_TOWER_MS / 1000}s cutoff — under 20s of margin is too close`);
else ok(`${who}: longest stretch with no reason to click ${longest.toFixed(0)}s, ${(G.AFK_TOWER_MS / 1000 - longest).toFixed(0)}s inside the cutoff`);
}

/* ---- what a death costs */
{
  const back = R.checkpointAt(T.floors - 9), lost = (T.floors - 9) - back;
  if (lost > 6) fail(`dying near the top costs ${lost} floors`);
  else ok(`dying at floor ${T.floors - 9} puts you at ${back} — ${lost} floors to re-climb, not ${T.floors - 9 - 1}`);
}
console.log(bad ? `\n${bad} problem(s)` : "\nthe tower holds up");
process.exitCode = bad ? 1 : 0;

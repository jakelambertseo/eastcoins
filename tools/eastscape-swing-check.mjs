/* CAN CLICKING FASTER MAKE YOU HIT FASTER? —  node tools/eastscape-swing-check.mjs
   (2026-09-25, the re-click exploit.) The swing loop is the hottest path in the game and its opener is the one
   place a click touches a timer, so this replays that logic against every way somebody might abuse it. The rule
   The rule CHANGED on 2026-09-25. Clicking is meant to be worth something again - the owner's players missed it
   and called it active clicking - so "no better than leaving it alone" is no longer the test. What is enforced now:

     ONE CLICK PER SWING IS THE CEILING. Spamming must pay exactly what a single well-timed click pays, or the
     mechanic is a race and a macro wins it.
     THE GAIN IS BOUNDED BY SWING_URGE. Whatever this pays, a script gets all of it, so the number has to be one
     we would hand a bot on purpose.
     AND CLICKING MAY NEVER STOP A MONSTER SWINGING. That half of the original exploit bought immunity, and it
     stays gone: the monster's clock is not touched by a click at all. */
import fs from "node:fs";
import * as G from "../v3/assets/js/eastscape-shared.js";
const src = fs.readFileSync("eastscape-worker/src/index.js", "utf8");
let bad = 0; const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* the three guards must actually be in the file */
for (const [what, re] of [
  ["the same-target carry-over", /String\(pl\.act\.id\) === String\(act\.id\) && pl\.act\.started\) \{ act\.started = pl\.act\.started; pl\.urge = true; \}/],
  ["the player's max()",         /pl\.lastSwing = Math\.max\(pl\.lastSwing, now - Math\.max\(0, swingMs - 600\)\)/],
  ["the monster's one grace",    /if \(m\.graceFor !== pl\.id\) \{ m\.lastSwing = now; m\.graceFor = pl\.id; \}/],
  ["PvP's max()",                /pl\.lastSwing = Math\.max\(pl\.lastSwing, now - 1800\)/],
  ["grace returns on respawn",   /graceFor: null/],
]) if (!re.test(src)) fail(`${what} is not in index.js`);

/* SECS is long on purpose: over a two-minute sample the single swing you do or do not get at the very start is
   worth 2.5% of the total, which reads as the shave being bigger than it is. Twenty minutes washes it out and
   the measured gain lands on 1/(1-SWING_URGE), which is what the arithmetic says it should be. */
const TICK = 50, swingMs = 3000, mobSpeed = 2600, SECS = 1200;
const URGE = G.SWING_URGE;
function run(clicks, targets = 1) {
  const pl = { id: "me", lastSwing: 0, act: null, urge: false, urgeStep: 0 };
  const mobs = [...Array(targets)].map((_, i) => ({ id: "m" + i, lastSwing: 0, graceFor: null }));
  let hits = 0, taken = 0;
  for (let now = 0; now < SECS * 1000; now += TICK) {
    const want = clicks(now);
    if (want !== null && want !== undefined) {
      const m = mobs[want], act = { kind: "mob", id: m.id };
      if (pl.act && pl.act.kind === act.kind && String(pl.act.id) === String(act.id) && pl.act.started) { act.started = pl.act.started; pl.urge = true; }
      pl.act = act;
    }
    const a = pl.act; if (!a) continue;
    const m = mobs.find((x) => x.id === a.id);
    if (!a.started) {
      a.started = now;
      pl.urgeStep = 0;
      pl.lastSwing = Math.max(pl.lastSwing, now - Math.max(0, swingMs - 600));
      if (m.graceFor !== pl.id) { m.lastSwing = now; m.graceFor = pl.id; }
    }
    const urged = pl.urge ? Math.round(swingMs * G.swingShave(pl.urgeStep)) : 0;
    if (now - pl.lastSwing >= swingMs - urged) {
      pl.urgeStep = pl.urge ? Math.min((pl.urgeStep | 0) + 1, G.SWING_STACK.length - 1) : 0;
      pl.urge = false; pl.lastSwing = now; hits++;
    }
    for (const x of mobs) if (x.graceFor && now - x.lastSwing >= mobSpeed) { x.lastSwing = now; taken++; }
  }
  return { hits, taken };
}
const alone = run((t) => (t === 0 ? 0 : null));
/* clicks at the pace of the FASTEST swing the ladder allows - a fixed interval keyed to the first step misses
   beats as the swing speeds up, drops the step, and made this read as if stacking did nothing. */
const perfect = run((t) => (t % Math.max(TICK, Math.round(swingMs * (1 - G.SWING_STACK[G.SWING_STACK.length - 1]))) < TICK ? 0 : null));
const ceiling = perfect.hits;
const TOP = G.SWING_STACK[G.SWING_STACK.length - 1];
ok(`left alone ${alone.hits} swings; holding the rhythm ${ceiling} (+${((ceiling / alone.hits - 1) * 100).toFixed(0)}%; ladder ${G.SWING_STACK.map((x) => (x * 100).toFixed(0) + "%").join(" -> ")})`);
if (ceiling <= alone.hits) fail("clicking is worth nothing - the mechanic is not wired up");
/* THE CEILING IS THE TOP OF THE LADDER. 1/(1-top) is the most dps any cadence may buy; past it a step is being
   climbed more than once a swing, which is how the original re-click turned into a 4.5x exploit. */
const max = 1 / (1 - TOP);
if (ceiling / alone.hits > max + 0.05) fail(`holding the rhythm pays ${(ceiling / alone.hits).toFixed(2)}x, past the ${max.toFixed(2)}x the top step allows`);
/* and a rhythm must beat a SINGLE click, or the ladder is decoration */
if (ceiling <= run((t) => (t === 0 ? 0 : null)).hits) fail("holding the rhythm is worth no more than one click - the ladder does nothing");

for (const [name, fn, n] of [
  ["spamming every tick",            (t) => 0, 1],
  ["spamming every 200ms",           (t) => (t % 200 < TICK ? 0 : null), 1],
  ["spamming every 650ms",           (t) => (t % 650 < TICK ? 0 : null), 1],
  ["alternating two, every 650ms",   (t) => (t % 650 < TICK ? (Math.floor(t / 650) % 2) : null), 2],
  ["alternating two, every tick",    (t) => Math.floor(t / TICK) % 2, 2],
]) {
  const r = run(fn, n);
  if (r.hits > ceiling) fail(`${name}: ${r.hits} swings, past the ${ceiling} a single click per swing earns \u2014 spam is winning`);
  else if (n === 1 && r.taken === 0 && alone.taken > 0) fail(`${name}: took nothing \u2014 clicking bought immunity`);
  else ok(`${name}: ${r.hits} swings, ${r.taken} taken \u2014 no better than one click per swing`);
}
console.log(bad ? `\n${bad} problem(s)` : "\nclicking is worth one swing's shave and never more");
process.exitCode = bad ? 1 : 0;

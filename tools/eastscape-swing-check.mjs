/* CAN CLICKING FASTER MAKE YOU HIT FASTER? —  node tools/eastscape-swing-check.mjs
   (2026-09-25, the re-click exploit.) The swing loop is the hottest path in the game and its opener is the one
   place a click touches a timer, so this replays that logic against every way somebody might abuse it. The rule
   it enforces: NO pattern of clicking may beat leaving the fight alone, and none may stop a monster swinging. */
import fs from "node:fs";
const src = fs.readFileSync("eastscape-worker/src/index.js", "utf8");
let bad = 0; const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* the three guards must actually be in the file */
for (const [what, re] of [
  ["the same-target carry-over", /String\(pl\.act\.id\) === String\(act\.id\) && pl\.act\.started\) act\.started = pl\.act\.started/],
  ["the player's max()",         /pl\.lastSwing = Math\.max\(pl\.lastSwing, now - Math\.max\(0, swingMs - 600\)\)/],
  ["the monster's one grace",    /if \(m\.graceFor !== pl\.id\) \{ m\.lastSwing = now; m\.graceFor = pl\.id; \}/],
  ["PvP's max()",                /pl\.lastSwing = Math\.max\(pl\.lastSwing, now - 1800\)/],
  ["grace returns on respawn",   /graceFor: null/],
]) if (!re.test(src)) fail(`${what} is not in index.js`);

const TICK = 50, swingMs = 3000, mobSpeed = 2600, SECS = 60;
/* `clicks` decides, for a given moment, which target the player clicks (null = no click) */
function run(clicks, targets = 1) {
  const pl = { id: "me", lastSwing: 0, act: null };
  const mobs = [...Array(targets)].map((_, i) => ({ id: "m" + i, lastSwing: 0, graceFor: null }));
  let hits = 0, taken = 0;
  for (let now = 0; now < SECS * 1000; now += TICK) {
    const want = clicks(now);
    if (want !== null && want !== undefined) {
      const m = mobs[want];
      const act = { kind: "mob", id: m.id };
      if (pl.act && pl.act.kind === act.kind && String(pl.act.id) === String(act.id) && pl.act.started) act.started = pl.act.started;
      pl.act = act;
    }
    const a = pl.act; if (!a) continue;
    const m = mobs.find((x) => x.id === a.id);
    if (!a.started) {
      a.started = now;
      pl.lastSwing = Math.max(pl.lastSwing, now - Math.max(0, swingMs - 600));
      if (m.graceFor !== pl.id) { m.lastSwing = now; m.graceFor = pl.id; }
    }
    if (now - pl.lastSwing >= swingMs) { pl.lastSwing = now; hits++; }
    for (const x of mobs) if (x.graceFor && now - x.lastSwing >= mobSpeed) { x.lastSwing = now; taken++; }
  }
  return { hits, taken };
}
const base = run((t) => (t === 0 ? 0 : null));
ok(`left alone: ${base.hits} swings and ${base.taken} taken in ${SECS}s`);
const cases = [
  ["re-clicking the same one every 650ms", (t) => (t % 650 < TICK ? 0 : null), 1],
  ["re-clicking as fast as the tick",      (t) => 0,                            1],
  ["alternating two, every 650ms",         (t) => (t % 650 < TICK ? (Math.floor(t / 650) % 2) : null), 2],
  ["alternating two, every tick",          (t) => Math.floor(t / TICK) % 2,     2],
];
for (const [name, fn, n] of cases) {
  const r = run(fn, n);
  if (r.hits > base.hits) fail(`${name}: ${r.hits} swings vs ${base.hits} left alone`);
  else if (r.taken === 0 && base.taken > 0) fail(`${name}: took ${r.taken} hits — clicking bought immunity`);
  else ok(`${name}: ${r.hits} swings, ${r.taken} taken — no better than leaving it alone`);
}
console.log(bad ? `\n${bad} problem(s)` : "\nclicking cannot buy damage or safety");
process.exitCode = bad ? 1 : 0;

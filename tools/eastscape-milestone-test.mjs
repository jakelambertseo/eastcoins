/* Level milestones: the list, the crossing, and that the wiring exists.

   THE BIT WORTH TESTING is that a grant spanning several levels announces EVERY milestone inside it. One swing
   normally moves you one level, so the loop looks like a formality — but a quest reward, an admin grant or a
   first kill at a high level can jump two or three, and the obvious version (`if (MILESTONES.has(after))`) would
   sail straight over 50 and say nothing. That is the failure this file exists for, and it is not one anybody
   would notice until somebody was owed a congratulation they never got.

   Run: node tools/eastscape-milestone-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };

// the crossing rule, exactly as the worker runs it
const crossed = (before, after) => { const out = []; for (let l = before + 1; l <= after; l++) if (G.MILESTONES.has(l)) out.push(l); return out; };

for (const [before, after, want] of [
  [29, 30, [30]],                 // the ordinary case: one level, one milestone
  [30, 31, []],                   // past it, nothing
  [28, 29, []],                   // short of it, nothing
  [48, 51, [50]],                 // a jump straight over 50
  [29, 41, [30, 40]],             // a big jump takes BOTH
  [1, 99, [30, 40, 50, 60, 70, 80, 90, 99]],   // an admin grant to the cap announces the lot
  [98, 99, [99]],
  [99, 99, []],                   // no movement, no announcement
]) {
  const got = crossed(before, after);
  if (got.join(",") !== want.join(",")) fail(`${before} -> ${after} announced [${got}], expected [${want}]`);
}
console.log(`  the crossing rule holds over ${8} cases, jumps included`);

// the list itself, and the levels past the cap that are deliberately in it
const cap = G.XP_AT.length - 1;
for (const l of [30, 40, 50, 60, 70, 80, 90, 99, 110, 120]) if (!G.MILESTONES.has(l)) fail(`${l} is missing from MILESTONES`);
const future = [...G.MILESTONES].filter((l) => l > cap);
console.log(`  ${G.MILESTONES.size} milestones, ${future.length} of them past today's cap of ${cap} (${future.join(", ")}) and waiting`);
if (!future.length) fail("nothing is listed past the cap — 110 and 120 were meant to be carried");

/* THE WIRING. The rule being right is no use if grant does not call it, and this is a broadcast, so it also has
   to reach every player rather than just the one who levelled. Read out of the worker rather than trusted. */
{
  const src = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
  const grant = src.slice(src.indexOf("  grant(pl, k, xp, track = true) {"), src.indexOf("  milestone(pl, k, lvl) {"));
  if (!/for \(let l = before \+ 1; l <= after; l\+\+\) if \(G\.MILESTONES\.has\(l\)\) this\.milestone\(/.test(grant))
    fail("grant() no longer walks every level it crossed");
  const m = src.slice(src.indexOf("  milestone(pl, k, lvl) {"), src.indexOf("  /* ------------------------------------------------------------ the event hook"));
  if (!/for \(const p of this\.pls\.values\(\)\)/.test(m)) fail("milestone() does not reach every player");
  if (!/type: "milestone"/.test(m)) fail("milestone() does not send a milestone message");
  if (!/name: pl\.name/.test(m)) fail("milestone() does not carry the name, so the page cannot link the profile");
  console.log("  grant walks every crossed level, and milestone() goes to everyone online");
}

// and the page has to know what to do with it
{
  const page = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  if (!/e\.type === "milestone"/.test(page)) fail("the page ignores a milestone message");
  if (!/cls === "milestone"/.test(page)) fail("a milestone's name is not clickable, so nobody can open their profile");
  if (!/p\.milestone\{/.test(page)) fail("the milestone chat line has no styling");
  console.log("  the page draws it, styles it, and keeps the name clickable");
}

console.log(bad ? `\n${bad} problem(s)` : "\nmilestones behave");
process.exitCode = bad ? 1 : 0;

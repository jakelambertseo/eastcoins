/* THE DUNGEON PAYOUT, SHARED (2026-09-24) —  node tools/eastscape-dungeon-pay-test.mjs

   The owner, commissioning the Pyramid: "mirror it and then factor out the payout yourself so its different."
   The Crypt's payout arithmetic was inline in cryptPayOne; it is World.dungeonOwe now, and the Pyramid will pay
   through the same method rather than a second copy of the same rules.

   WHY THIS FILE EXISTS. tools/eastscape-crypt-test.mjs is an INTEGRATION test - it opens a WebSocket to a
   running game server - so it cannot check a refactor offline, and a refactor of the money path is exactly the
   thing you want checked before it ships. This reads the formula OUT OF THE SHIPPED SOURCE and evaluates it, so
   it is testing the line the server runs rather than a copy of it pasted in here.

   The old line, for the record:
     let pay = T.pay;
     if (share < C_.fullShare) pay *= C_.lowShare;
     if (runs >= C_.runsPaid) pay *= C_.lateShare;
     pay = Math.round(pay);
*/
import fs from "node:fs";

const SRC = "C:/Users/jake/code/eastcoins/eastscape-worker/src/";
const IDX = fs.readFileSync(SRC + "index.js", "utf8"), CRY = fs.readFileSync(SRC + "crypt.js", "utf8");
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- the method exists and the Crypt uses it */
if (!/dungeonOwe\(pl, \{ key, tier, pay, share, cfg, runs \}\)/.test(IDX)) fail("World.dungeonOwe is gone or its signature changed");
else ok("World.dungeonOwe is where the payout lives");

if (!/this\.dungeonOwe\(p, \{ key: "crypt"/.test(CRY)) fail("cryptPayOne no longer pays through dungeonOwe, so there are two copies of the rules again");
else ok("the Crypt pays through it");

/* the old inline arithmetic must be GONE from crypt.js, or the refactor left a second path behind */
if (/if \(share < C_\.fullShare\) pay \*= C_\.lowShare/.test(CRY)) fail("the old inline arithmetic is still in crypt.js");
if (/p\.C\.crypt = \{ day: dayOf\(\)/.test(CRY)) fail("crypt.js still writes the owed loot itself, so a Pyramid change would not reach it");
ok("the old inline copy is gone");

/* ---------------------------------------------------------------- and the formula still pays what it always did */
const m = IDX.match(/const owed = (Math\.round\([^;]+\));/);
if (!m) { fail("could not find the `owed` expression in dungeonOwe to evaluate"); }
else {
  /* eval the SHIPPED expression, with the same names it uses, against the old behaviour computed here */
  const shipped = new Function("pay", "low", "late", "cfg", `return ${m[1]};`);
  const cfg = { fullShare: 0.10, lowShare: 0.5, runsPaid: 3, lateShare: 0.25 };
  const was = (pay, share, runs) => {
    let p = pay;
    if (share < cfg.fullShare) p *= cfg.lowShare;
    if (runs >= cfg.runsPaid) p *= cfg.lateShare;
    return Math.round(p);
  };
  let checked = 0;
  for (const pay of [2500, 7000, 22000, 12345, 1]) {
    for (const share of [0, 0.05, 0.0999, 0.1, 0.4, 1]) {
      for (const runs of [0, 2, 3, 9]) {
        const low = share < cfg.fullShare, late = runs >= cfg.runsPaid;
        const got = shipped(pay, low, late, cfg), want = was(pay, share, runs);
        checked++;
        if (got !== want) fail(`pay ${pay}, share ${share}, runs ${runs}: shipped pays ${got}, the Crypt always paid ${want}`);
      }
    }
  }
  ok(`the shipped formula matches the Crypt's old one over all ${checked} combinations of pay, damage share and runs today`);

  /* the two rules worth stating on their own, so a later "simplification" cannot quietly drop one */
  if (shipped(1000, true, false, cfg) !== 500) fail("under a tenth of the boss no longer halves the pay");
  if (shipped(1000, false, true, cfg) !== 250) fail("past the day's paid runs no longer quarters the pay");
  if (shipped(1000, true, true, cfg) !== 125) fail("the two penalties no longer compound");
  if (shipped(1000, false, false, cfg) !== 1000) fail("a full share inside the paid runs is no longer full pay");
  ok("half for a passenger, a quarter past the daily runs, and they compound");
}

/* ---------------------------------------------------------------- written down before anything is handed over */
if (!/pl\.C\[key\] = \{ day: G\.chicagoDay\(\), n: runs \+ 1, loot:/.test(IDX))
  fail("the owed loot is no longer written onto the character, so a crash or a lag-out could lose somebody's clear");
else ok("what somebody is owed is written on the character, not held in memory");

console.log(bad ? `\n${bad} problem(s)` : "\nboth dungeons will pay by one set of rules");
process.exitCode = bad ? 1 : 0;

/* A CLIMB SURVIVES A RESTART (2026-09-24) —  node tools/eastscape-tower-test.mjs

   Reported by jimmytomato: "I was on Floor 30 of the Tower ... now demoted back to Floor 21".

   It was true, and it was not the tower's code. The Tower and the Crypt both put a player in a scene keyed to
   them — `tower:<id>`, `crypt:<id>` — which is built on demand and so is NOT in SCENES. normChar rejects a scene
   it cannot find and sends the player to the casino, and its exemption for a run in progress named only
   `crypt:`. So every load threw a tower climber out of the tower: a deploy, a reconnect, any restart of the
   Durable Object.

   The floor was never lost. c.tower still said {floor:30,best:29}. What was lost was the SCENE KEY, which is
   what towerRejoin matches on to rebuild the room you were standing in — so the climber arrived at the door
   instead, and re-entry recomputed checkpointAt(best + 1) = 21. Nine floors, exactly as reported.

   Two fixes, and the second is the one that makes it safe rather than merely fixed: the resume floor is now the
   floor you were ON, and the checkpoint is the price of DYING and nothing else. towerDeath writes that demotion
   down instead of leaving it to be recomputed.
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import { createTowerRules } from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-tower-rules.js";
import fs from "node:fs";

const R = createTowerRules(G, G._MAP);
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- the reported bug */
{
  const c = G.freshChar();
  c.tower = { floor: 30, best: 29 };
  c.scene = "tower:12345"; c.x = 21; c.y = 20;
  const out = G.normChar(c);
  if (out.scene !== "tower:12345") fail(`a climber saved on floor 30 came back in "${out.scene}" — the scene key is what towerRejoin rebuilds the room from`);
  else ok("a character saved inside the Tower still has its tower scene after a load");
  if (out.tower?.floor !== 30 || out.tower?.best !== 29) fail(`the floor itself changed: ${JSON.stringify(out.tower)}`);
}

/* ---------------------------------------------------------------- and the Crypt still does */
{
  const c = G.freshChar(); c.scene = "crypt:abc"; c.x = 21; c.y = 20;
  if (G.normChar(c).scene !== "crypt:abc") fail("a crypt run no longer survives a load — the regex broke the case that already worked");
  else ok("a crypt run still survives a load");
}

/* ---------------------------------------------------------------- an ordinary scene is still checked */
{
  const c = G.freshChar(); c.scene = "tower"; c.x = 21; c.y = 20;             // no id: not a real scene
  if (G.normChar(c).scene === "tower") fail('the bare word "tower" is now accepted as a scene, so a junk value would strand somebody');
  const c2 = G.freshChar(); c2.scene = "nonsense:9"; c2.x = 21; c2.y = 20;
  if (G.normChar(c2).scene !== G.START.scene) fail("an unknown per-player key is accepted, so the check no longer does anything");
  else ok("an unknown scene key still sends a player somewhere real");
}

/* ---------------------------------------------------------------- every per-player scene, not just this one */
{
  /* THE GENERAL SHAPE OF THE BUG: a scene keyed to a player, built on demand, that normChar has never heard of.
     This scans the worker for the ones it actually moves a player INTO and insists each is either exempt as a run
     in progress or on the list below of ones that are MEANT to be transient. That is what stops the next one. */
  const TRANSIENT = {
    pit: "the Fight Pit's rounds are transient; coming back in the casino afterwards costs nothing",
    home: "a player's house on their island. Being put in the casino instead of your own front room loses no progress, so it is left alone deliberately — see the backlog",
  };
  const src = ["index.js", "crypt.js", "tower.js", "pit.js"].map((f) => fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/" + f, "utf8")).join("\n");
  const prefixes = new Set();
  for (const m of src.matchAll(/moveToScene\([^,]+,\s*`([a-z]+):\$\{/g)) prefixes.add(m[1]);
  for (const m of src.matchAll(/keyOf\s*=\s*\([^)]*\)\s*=>\s*`([a-z]+):\$\{/g)) prefixes.add(m[1]);
  if (!prefixes.size) fail("the scan found no per-player scenes at all, so it is not checking anything");
  for (const p of [...prefixes].sort()) {
    const c = G.freshChar(); c.scene = `${p}:test`; c.x = 21; c.y = 20;
    const kept = G.normChar(c).scene === `${p}:test`;
    if (kept) ok(`${p}:<id> survives a load`);
    else if (TRANSIENT[p]) ok(`${p}:<id> is reset on purpose — ${TRANSIENT[p]}`);
    else fail(`${p}:<id> is a scene players are moved into and normChar throws it away — the same bug the Tower had. Add it to the run-in-progress test in normChar, or to TRANSIENT here with the reason.`);
  }
}

/* ---------------------------------------------------------------- the checkpoint is the price of dying */
{
  if (R.checkpointAt(30) !== 21) fail(`checkpointAt(30) is ${R.checkpointAt(30)}; the reported demotion was to 21`);
  if (R.checkpointAt(31) !== 31) fail("a boss floor is not its own checkpoint");
  if (R.checkpointAt(1) !== 1) fail("floor 1 is not a checkpoint");
  ok(`checkpoints every ${R.TOWER.checkEvery}: floor 30 falls back to ${R.checkpointAt(30)}, which is what was reported`);

  const T = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/tower.js", "utf8");
  /* ONE resume rule, read by both the door and the stairs. When each worked it out for itself the door's window
     could promise one floor and the stairs deliver another. */
  if (!/const resumeAt = /.test(T)) fail("there is no single resumeAt, so the door and the stairs can disagree again");
  /* the definition is `const resumeAt = (C) =>`, which does not contain "resumeAt(" - so the CALLS are what this
     counts, and there should be one in towerDoor and one in towerEnter. */
  const uses = [...T.matchAll(/resumeAt\(/g)].length;
  if (uses < 2) fail(`resumeAt is called ${uses} time(s); both towerDoor and towerEnter should read it`);
  if (/resume: R\.checkpointAt/.test(T)) fail("the door still computes the checkpoint itself");
  if (/const floor = R\.checkpointAt/.test(T)) fail("towerEnter still resumes at the checkpoint, so every interruption still costs the band");
  if (!/pl\.C\.tower = \{ floor: back/.test(T)) fail("towerDeath does not write the demotion, so nothing would move a player down any more");
  ok("one resume rule, used by the door and the stairs, and death is the only thing that writes a demotion");
}

console.log(bad ? `\n${bad} problem(s)` : "\na climb survives a restart");
process.exitCode = bad ? 1 : 0;

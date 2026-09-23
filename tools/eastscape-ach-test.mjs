/* Every achievement predicate, run against three characters: brand new, a mid-game one, and a maxed one.
   It proves three things and nothing else: no predicate throws, a new character earns only what they should,
   and the milestone buffs land in fxOf and bagMax rather than being computed and dropped. */
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

const blank = () => G.normChar({ name: "Fresh" });

const mid = () => {
  const c = G.normChar({ name: "Mid" });
  for (const k of Object.keys(G.SKILLS)) c.xp[k] = G.XP_AT[30];
  c.stats.kills = { goat: 600, toadstool: 500, ghoul: 200 };
  c.stats.gathered = { copper: 300, tin: 300, logs: 400, sardine: 300, trout: 200, wheat: 40, tomatoe: 30, rattlebean: 20 };
  c.stats.cooked = { csardine: 150 }; c.stats.crafted = { charcoal: 150, bronze_bar: 60, bronze_helm: 2 };
  c.stats.burnt = 60; c.stats.deaths = 12; c.stats.sessions = 40; c.stats.casPlays = 30; c.stats.casBest = 400;
  c.stats.played = { wheel: 10, hilo: 8, mines: 7, slots: 5 }; c.stats.crypt = 2;
  c.forge = { bronze_helm: 2 }; c.pets = [{ id: "p1", k: "bonepup" }];
  c.eq.weapon = "bronze_sword"; c.eq.body = "bronze_body"; c.eq.helm = "bronze_helm";
  return c;
};

const maxed = () => {
  const c = mid();
  for (const k of Object.keys(G.SKILLS)) c.xp[k] = G.XP_AT[80];
  c.stats.kills = Object.fromEntries(Object.keys(G.MOBS).map((k) => [k, 900]));
  const fish = ["sardine","perch","trout","catfish","lanternfish","mudskipper","bonefish","ghostcarp","skyeel","cloudray","stormmarlin","thundersquid","mudcat","bowfin"];
  c.stats.gathered = Object.fromEntries([...fish, ...Object.keys(G.CROPS), "copper", "tin", "logs", "yewlogs"].map((k) => [k, 900]));
  c.stats.crafted = { charcoal: 900, bronze_bar: 200, bronze_helm: 9 };
  c.stats.cooked = Object.fromEntries(["csardine", "sghostcarp", "scloudray"].map((k) => [k, 60]));
  c.stats.looted = { zcoin: 14 }; c.stats.played = Object.fromEntries(Object.keys(G.GAMES).map((k) => [k, 9]));
  c.stats.crypt = 20; c.stats.casNet = 20000; c.stats.playMs = 30 * 3600 * 1000; c.stats.deaths = 60; c.stats.forgeBroke = 1;
  c.qs = Object.fromEntries(Object.keys(G.QUESTS).map((k) => [k, { done: true, step: 99 }]));
  c.forge = { bronze_helm: 3 }; c.pets = Object.keys(G.PETS).map((k, i) => ({ id: "p" + i, k }));
  return c;
};

let bad = 0;
for (const [label, c] of [["fresh", blank()], ["mid-game", mid()], ["maxed", maxed()]]) {
  let due;
  try { due = G.achDue(c); } catch (e) { console.log(`  ${label}: achDue THREW ${e.message}`); bad++; continue; }
  c.ach = due;
  const pts = G.achPts(c), fx = G.achFx(c);
  console.log(`  ${label.padEnd(9)} earns ${String(due.length).padStart(2)}/${Object.keys(G.ACH).length}  ${String(pts).padStart(3)} pts  buffs ${JSON.stringify(fx)}  bag ${G.bagMax(c)}`);
  if (label === "fresh" && due.length > 2) { console.log("    !! a brand-new character should earn almost nothing"); bad++; }
  if (label === "maxed" && due.length < 40) { console.log("    !! a maxed character should earn most of them"); bad++; }
}

// every predicate must survive junk without throwing — a bad save must never stop a kill paying out
for (const junk of [{}, { stats: null }, { stats: {}, xp: null }, { ach: "nonsense" }]) {
  try { G.achDue(junk); } catch (e) { console.log("  junk character THREW:", e.message); bad++; }
}

// the buffs must actually reach fxOf and bagMax, not just achFx
const rich = maxed(); rich.ach = G.achDue(rich);
const poor = blank();
const gained = G.fxOf(rich).tix - G.fxOf(poor).tix;
const slots = G.bagMax(rich) - G.bagMax(poor);
console.log(`\n  milestone buffs reach fxOf: +${(gained * 100).toFixed(0)}% tickets   and bagMax: +${slots} slots`);
if (gained <= 0 || slots <= 0) { console.log("  !! milestones computed but not applied"); bad++; }

/* EVERY `on:` MUST BE A TYPE THE SERVER ACTUALLY EMITS. This is the assertion that would have caught the real
   bug on the day it shipped: "Sat Down" listened for "play", nothing in the game emitted "play", and so every
   casino achievement sat unearned until the next login swept it up. It reads the emit sites rather than trusting
   a list written alongside them. */
{
  const src = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8")
            + fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/crypt.js", "utf8");
  const emitted = new Set([...src.matchAll(/emit\(p[a-z]*,\s*"([a-z]+)"/g)].map((m) => m[1]));
  // gained(S, pl, k, n, how) forwards its `how`, and these are the values it is called with
  for (const k of ["gather", "cook", "craft"]) emitted.add(k);
  // the login sweep tests every achievement with no type at all, so "login" needs no emit of its own
  emitted.add("login");
  const listen = new Set();
  for (const a of Object.values(G.ACH)) for (const o of a.on || []) listen.add(o);
  const orphan = [...listen].filter((t) => !emitted.has(t));
  console.log(`\n  emitted: ${[...emitted].sort().join(", ")}`);
  if (orphan.length) { console.log(`  !! listened for but NEVER emitted: ${orphan.join(", ")}`); bad++; }
  else console.log("  every achievement listens for a type the game actually emits");
}

console.log(bad ? `\n${bad} problem(s)` : "\nall achievement predicates behave");
process.exitCode = bad ? 1 : 0;

/* DOES THE GREAT PYRAMID HOLD TOGETHER? —  node tools/eastscape-pyramid-test.mjs
   (2026-09-24) The party dungeon under the Golden Sands. It cannot be played offline - eastscape-crypt-test.mjs
   needs a running server and so would this - so what this proves is everything that is decided before anybody
   swings: the shape of the map, who can reach what, and that the chest always holds the one thing the dungeon
   exists to give.

   IT HAS ALREADY EARNED ITS KEEP. It caught the offering altar sitting squarely in the only doorway into the
   burial chamber (the boss was walled off from the party entirely), two gargoyles being placed inside solid
   rock, a Grave Grifter standing on a skull heap, and - after the monsters moved onto the scene where the run
   machinery can see them - the missing hoard chest, without which the loot could never be opened. */
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import { createPyramidRules } from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-pyramid-rules.js";

const R = createPyramidRules(G, G._MAP);
const P = R.PYRAMID;
const b = R.scenes.pyramid.build();
const g = b.g, ROWS = g.length, COLS = g[0].length;
const WALK = ".,isbep";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* two things on one tile */
const at = new Map();
for (const o of b.objs) {
  for (let j = 0; j < (o.h || 1); j++) for (let i = 0; i < (o.w || 1); i++) {
    const k = `${o.x + i},${o.y + j}`;
    if (at.has(k)) fail(`two objects on ${k}: ${at.get(k)} and ${o.t}`);
    at.set(k, o.t);
  }
}
ok(`${b.objs.length} objects, no two on a tile`);

/* every monster on a standable, unoccupied tile, in the chamber it is assigned to */
/* the monsters live on the scene now, in [t, x, y]; the chamber comes from roomOf */
const SPAWNS = R.scenes.pyramid.mobs.map(([t, x, y]) => [R.roomOf(x, y), t, x, y]);
for (const [room, t, x, y] of SPAWNS) {
  const tile = g[y]?.[x];
  if (!WALK.includes(tile)) fail(`${t} at ${x},${y} is on "${tile}", which cannot be stood on`);
  if (at.has(`${x},${y}`)) fail(`${t} at ${x},${y} is standing on a ${at.get(`${x},${y}`)}`);
  if (R.roomOf(x, y) !== room) fail(`${t} at ${x},${y} is marked chamber ${room} but sits in chamber ${R.roomOf(x, y)}`);
}
ok(`all ${SPAWNS.length} monsters stand on clear floor in their own chamber`);

/* the fixtures are where they should be */
const inRoom = (p, n, what) => { if (R.roomOf(p.x, p.y) !== n) fail(`${what} is in chamber ${R.roomOf(p.x, p.y)}, not ${n}`); };
inRoom(P.lever, 2, "the lever");
inRoom(P.loot.at, 3, "the chest drop");
if (R.roomOf(R.scenes.pyramid.entry.x, R.scenes.pyramid.entry.y) !== 0) fail("the entry is not in the first chamber");
ok("the lever is in chamber 3, the hoard lands in the burial chamber, and you come in at the base");

/* REACHABILITY, gate by gate: with gates 0..k-1 open you can reach chamber k and no further */
const reach = (openGates) => {
  const blocked = new Set();
  P.gates.forEach((q, i) => { if (!openGates.includes(i)) blocked.add(`${q.x},${q.y}`); });
  const start = R.scenes.pyramid.entry, seen = new Set([`${start.x},${start.y}`]), q = [[start.x, start.y]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || blocked.has(k)) continue;
      const t = g[ny][nx];
      /* a gate tile is "#" but passable once open; everything else must be floor */
      if (!WALK.includes(t) && !P.gates.some((gt) => gt.x === nx && gt.y === ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
};
for (let k = 0; k <= 3; k++) {
  const open = [...Array(k).keys()], seen = reach(open);
  const can = P.rooms.map((r, i) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (seen.has(`${x},${y}`)) return i;
    return -1;
  }).filter((i) => i >= 0);
  const want = [...Array(k + 1).keys()];
  if (String(can) !== String(want)) fail(`with ${k} gate(s) open you can reach chambers [${can}]; it should be [${want}]`);
  /* and every monster of the chambers you CAN reach must be standable-next-to */
  for (const [room, t, x, y] of SPAWNS) {
    if (room > k) continue;
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
    if (!beside) fail(`with ${k} gate(s) open, ${t} at ${x},${y} in chamber ${room} cannot be reached to be fought`);
  }
}
ok("each gate opens exactly one more chamber, and every monster in an open chamber can be fought");

/* the boss's own room: the party has to be able to stand round it */
const sq = SPAWNS.find(([, t]) => t === "squeeze");
const room4 = reach([0, 1, 2]);
const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => room4.has(`${sq[2] + dx},${sq[3] + dy}`)).length;
if (around < 3) fail(`only ${around} tile(s) beside the Squeeze are standable - four people cannot fight it`);
else ok(`${around} sides of the Squeeze are open, so a party of four can surround it`);

/* the numbers the owner asked to match */
const T = P.tiers[1];
if (P.tiers.length !== 2) fail(`${P.tiers.length - 1} tiers; the owner asked for one`);
ok(`one tier: "${T.name}", door Combat ${T.lvl}, the fight wants ${T.rec}, ante ${T.ante}, pays ${T.pay}`);
if (T.pay >= 11000) fail("it pays as much as the Black Crypt, so the chest is not the reason to come");
else ok(`it pays ${Math.round((1 - T.pay / 11000) * 100)}% less than the Black Crypt on purpose - the venom and the pet are the draw`);
const boss = R.mobs.squeeze;
console.log(`  the Squeeze: level ${boss.lvl}, ${boss.hp} health (the Hoodie's hardest is 3780), and ${[2, 3, 4].map((n) => P.bossHp(boss.hp, n)).join(" / ")} for 2/3/4 players`);

/* the chest always yields the thing that only it yields */
let venom = 0, pets = 0, runs = 4000;
for (let i = 0; i < runs; i++) {
  const { items } = R.rollLoot({ tier: 1, pay: T.pay, low: false, late: false });
  if (items.some((x) => x.k === "serpentvenom")) venom++;
  if (items.some((x) => x.k === "pet:coilling")) pets++;
}
if (venom !== runs) fail(`only ${venom} of ${runs} chests held venom; it is supposed to be every one`);
else ok(`every one of ${runs} chests held serpent venom, and ${(pets / runs * 100).toFixed(1)}% held the pet`);

/* ---------------------------------------------------------------- the three things live testing found
   None of these can be PROVED without a running server, so what is checked is that the guard is still there.
   Every one was a real bug in the first live run. */
{
  const fs = await import("node:fs");
  const IDX = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
  const PYR = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/pyramid.js", "utf8");

  /* 1. a held player could still walk a step and be yanked back, because the hold was only enforced from the
        boss's tick. It is refused where the walk is accepted. */
  if (!IDX.includes("S.run.coil && S.run.coil.id === pl.id) return this.say"))
    fail("the walk handler no longer refuses a held player, so the coil is back to arguing with the client");
  else ok("a held player's click is refused where the walk is accepted, not undone a tick later");

  /* 2. the serpent coiled people four chambers away, through three shut stone doors */
  if (!PYR.includes("if (!run.gates[2]) return;"))
    fail("the boss tick runs before the burial chamber is open - it will coil people in the entrance hall again");
  else if (!PYR.includes("R.roomOf(p.x, p.y) === R.roomOf(m.x, m.y)"))
    fail("the boss can target players outside its own chamber again");
  else ok("the serpent does nothing until its door is open, and only takes hold of somebody in the room with it");

  /* 3. clearing a chamber let the next one's monsters follow you through the opened door */
  if (!IDX.includes("PR.roomOf(p.x, p.y) === PR.roomOf(m.hx, m.hy)"))
    fail("a pyramid monster is leashed by distance again, not by chamber - a cleared room will not stay cleared");
  else ok("a chamber's monsters cannot follow you out of it");

  if (!IDX.includes("S.def.crypt || S.def.pyramid || now < m.respawnAt"))
    fail("pyramid monsters can respawn again, and could re-lock a cleared chamber");
  else ok("nothing killed in a run comes back");

  /* the monster homed nearest a door is what exposed this, so the distance is worth printing */
  const gate = P.gates[0];
  const near = SPAWNS.filter(([r]) => r === 1)
    .map(([r, t, x, y]) => [t, Math.max(Math.abs(x - gate.x), Math.abs(y - gate.y))])
    .sort((a, b) => a[1] - b[1])[0];
  console.log(`  (the second chamber's nearest monster to its door is a ${near[0]}, ${near[1]} tile away — it is the chamber check and not distance that holds it)`);
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe Great Pyramid holds together");
process.exitCode = bad ? 1 : 0;

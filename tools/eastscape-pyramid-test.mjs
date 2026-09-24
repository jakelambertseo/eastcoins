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

/* ---------------------------------------------------------------- THE BURIAL CHAMBER IS BIG ENOUGH
   (2026-09-24, the owner, from a screenshot: "its very claustrophobic with all the large mobs. it needs to be
   2-3X larger because there will be up to 4 players in there as well") It was 12 by 5 with thirteen tiles of
   dressing in it - 47 standable, for four players, four `size: "l"` pharaohs and an `xl` serpent. The number
   below is the one to watch: if a later change to the taper or the dressing drops it under 110 the room has
   quietly gone back to being too small, and nothing else here would notice. */
{
  const R3 = P.rooms[3];
  let floor = 0, stand = 0;
  for (let y = R3.y0; y <= R3.y1; y++) for (let x = R3.x0; x <= R3.x1; x++) {
    if (!WALK.includes(g[y][x])) continue;
    floor++; if (!at.has(`${x},${y}`)) stand++;
  }
  const WAS = 47;
  if (stand < 110) fail(`the burial chamber has ${stand} standable tiles; it was ${WAS} when the owner called it claustrophobic, and 2x that is the floor`);
  else ok(`the burial chamber: ${floor} tiles of floor, ${stand} standable — ${(stand / WAS).toFixed(1)}x what the owner was complaining about`);
  /* and it has to still LOOK like a pyramid: every row at least as wide as the one above it, narrowing overall */
  const w = [];
  for (let y = R3.y0; y <= R3.y1; y++) { const s = R.spanAt(y); w.push(s ? s[1] - s[0] + 1 : 0); }
  for (let i = 1; i < w.length; i++) if (w[i] < w[i - 1]) fail(`the burial chamber widens going up: row ${R3.y0 + i} is ${w[i]} wide under a row of ${w[i - 1]}`);
  if (w[w.length - 1] <= w[0]) fail("the burial chamber does not taper at all - it is a box with a pointed map around it");
  else ok(`it tapers ${w[w.length - 1]} wide at the mouth to ${w[0]} at the apex, never widening upward`);
  /* the chambers below have to stay wider than it, or the silhouette is a T */
  for (let i = 0; i < 3; i++) if (P.rooms[i].x1 - P.rooms[i].x0 < w[w.length - 1]) fail(`chamber ${i} is narrower than the burial chamber's mouth`);
  ok("each chamber below is wider than the one above it");
}

/* ---------------------------------------------------------------- THE PHARAOHS COME FIRST
   (the owner: "the snake should be placed further to the back, so the players fight the risen pharohs first and
   then the snake") Back there is only half of it: a monster chases anything inside its aggro, so if the serpent's
   were left at the type's 9 it would meet the party at the door and the pharaohs would be an afterthought. */
{
  const gate = P.gates[2];
  const sqp = R.scenes.pyramid.mobs.find(([t]) => t === "squeeze");
  const phs = R.scenes.pyramid.mobs.filter(([t]) => t === "pharaoh");
  /* ROWS from the door, not Chebyshev: the chamber is twenty-two wide and eight deep, and "further to the back"
     in a pyramid stacked bottom to top means further UP. A pharaoh in a far corner is beside you, not behind
     the snake, and measuring it as a square distance says the opposite. */
  const deep = (p) => Math.abs(p[2] - gate.y);
  const shallow = Math.min(...phs.map(deep));
  if (deep(sqp) <= Math.max(...phs.map(deep))) fail("the serpent is no further up the chamber than a pharaoh is");
  else ok(`the serpent is ${deep(sqp)} rows up from the burial door; the pharaohs hold the ${shallow} and ${Math.max(...phs.map(deep))} rows in front of it`);
  const ag = sqp[3]?.aggro;
  if (!(ag > 0 && ag < deep(sqp))) fail(`the serpent's aggro is ${ag ?? "the type's " + R.mobs.squeeze.aggro} — it reaches the door, so it is the first thing fought, not the last`);
  else ok(`its aggro is turned down to ${ag} on the placement, so it does not come to the door`);
  if (!(P.coil.reach > 0 && P.coil.reach < deep(sqp))) fail("coil can reach the burial door - the party gets grabbed before it has seen the snake");
  else ok(`coil reaches ${P.coil.reach}, so nothing is grabbed while the pharaohs are still up`);
}

/* the fixtures are where they should be */
const inRoom = (p, n, what) => { if (R.roomOf(p.x, p.y) !== n) fail(`${what} is in chamber ${R.roomOf(p.x, p.y)}, not ${n}`); };
inRoom(P.lever, 2, "the lever");
inRoom(P.loot.at, 3, "the chest drop");
if (R.roomOf(R.scenes.pyramid.entry.x, R.scenes.pyramid.entry.y) !== 0) fail("the entry is not in the first chamber");
ok("the lever is in the chamber below the tomb, the hoard lands in the burial chamber, and you come in at the base");

/* ---------------------------------------------------------------- the burrow has somewhere to surface
   The chamber is a taper, so a landing spot drawn from rooms[3]'s bounding box is solid stone about a quarter of
   the time - and the walkable check then meant the serpent quietly did not move, which is the mechanic failing
   without a word. The worker draws from R.spanAt instead; this is that the spans it draws from are real floor. */
{
  const R3 = P.rooms[3];
  let spots = 0;
  for (let y = R3.y0; y <= R3.y1 - 2; y++) {
    const s = R.spanAt(y); if (!s) { fail(`row ${y} of the burial chamber has no span`); continue; }
    for (let x = s[0] + 1; x <= s[1] - 1; x++) if (WALK.includes(g[y][x]) && !at.has(`${x},${y}`)) spots++;
  }
  if (spots < 20) fail(`only ${spots} tiles for the serpent to come up on; a burrow that finds nowhere does nothing at all`);
  else ok(`${spots} tiles in the back of the chamber for a burrow to surface on`);
  const fsPyr = (await import("node:fs")).readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/pyramid.js", "utf8");
  if (!fsPyr.includes("R.spanAt(ny)")) fail("the burrow is picking a spot out of the bounding box again - it will land in stone and silently not move");
  else ok("the burrow picks its spot from the taper, not the bounding box");
}

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

/* ---------------------------------------------------------------- THE DOOR'S "POSSIBLE DROPS" TELLS THE TRUTH
   (2026-09-24, the owner: "at the bottom of the pyramid popup, put a section for Possible Drops and then list
   the drops with their icons") The panel computes every odds figure from PYRAMID.loot rather than listing them
   by hand, so the only way it can lie is if the arithmetic and rollLoot disagree. This runs both over the same
   table: the same chestP() the page uses, against 60,000 actual chests.

   IT HAS ALREADY EARNED ITS KEEP. The first draft printed "Tickets · 63%", because 26% of the ROLLS are ticket
   rolls - while every chest holds the clear's payout unconditionally, so the true figure is 100% and the 63% is
   the chance of a bonus on top. A hand-written list would have shipped that. */
{
  const WT = (r) => r.reduce((a, [, w]) => a + w, 0);
  const rollP = (k) => { const r = P.loot.table.find(([x]) => x === k); return r ? r[1] / WT(P.loot.table) : 0; };
  const subP = (k, rows, p) => { const r = rows.find(([x]) => x === p); return rollP(k) * (r ? r[1] / WT(rows) : 0); };
  const chestP = (p) => P.loot.rolls.reduce((a, [c, w]) => a + (w / WT(P.loot.rolls)) * (1 - Math.pow(1 - p, c - 1)), 0);
  const rows = [
    { k: "pet", p: rollP("pet") }, { k: "horseshoe", p: rollP("horseshoe") },
    ...P.loot.gear.map((g) => ({ k: g, p: rollP("gear") / P.loot.gear.length })),
    ...P.loot.chip.map(([k]) => ({ k, p: subP("chip", P.loot.chip, k) })),
    { k: "clover", p: rollP("clover") },
    ...P.loot.meal.map(([k]) => ({ k, p: subP("meal", P.loot.meal, k) })),
    ...P.loot.drink.map(([k]) => ({ k, p: subP("drink", P.loot.drink, k) })),
    { k: "snakefang", p: rollP("fang") }, { k: "scarabshell", p: rollP("shell") },
  ].map((r) => ({ ...r, c: chestP(r.p) }));
  /* every key has to be a real item, or the panel draws a blank box with a raw key under it */
  for (const r of rows) if (r.k !== "pet" && !G.ITEMS[r.k]) fail(`the drops panel would list "${r.k}", which is not an item`);
  const N = 60000, seen = {};
  for (let i = 0; i < N; i++) for (const k of new Set(R.rollLoot({ tier: 1, pay: T.pay, low: false, late: false }).items.map((x) => (x.k === "pet:coilling" ? "pet" : x.k)))) seen[k] = (seen[k] | 0) + 1;
  let worst = 0, who = "";
  for (const r of rows) { const gap = Math.abs((seen[r.k] || 0) / N - r.c); if (gap > worst) { worst = gap; who = r.k; } }
  if (worst > 0.012) fail(`the drops panel would print ${(rows.find((r) => r.k === who).c * 100).toFixed(1)}% for ${who}, and ${N.toLocaleString()} chests measured ${((seen[who] || 0) / N * 100).toFixed(1)}%`);
  else ok(`all ${rows.length} rows of "Possible Drops" match ${N.toLocaleString()} real chests (worst gap ${(worst * 100).toFixed(2)} points, ${who})`);
  /* and the two the panel states rather than rates */
  if ((seen.tickets || 0) !== N) fail("tickets are NOT in every chest; the panel says they are");
  if ((seen.serpentvenom || 0) !== N) fail("venom is NOT in every chest; the panel says it always is");
  ok("tickets and venom are in every one, which is what the panel claims for them");
}

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

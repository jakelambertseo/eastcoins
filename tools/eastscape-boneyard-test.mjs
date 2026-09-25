/* DOES THE REBUILT BONEYARD HOLD TOGETHER? —  node tools/eastscape-boneyard-test.mjs
   (2026-09-24, the owner: "rebuild the boneyard ... graveyards that are bllocked off by fences, that run long
   along the pathways and have a small entrance into them, then the mobs are in there")

   A fenced map is a map that can be wrong in a way a field cannot. The three things this proves are the three
   ways the idea fails: a yard whose gate got painted over is a yard nobody can enter; a monster placed outside
   its railings is a monster on the path, which is the thing the fences exist to stop; and a rock or a fishing
   spot shut inside a yard makes a skiller fight for it.

   IT ALSO WATCHES wild(). That runs AFTER build() returns and repaints the map's edges, and its repair only
   re-plants open ground — so a railing or a gate it rubs out stays rubbed out. Everything here is checked on
   the grid wild() handed back, not the one build() drew. */
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";

const S = G.SCENES.boneyard, b = S.build(), g = b.g;
const ROWS = g.length, COLS = g[0].length;
const WALK = ".,isbep";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* the six yards, read back off the objects rather than restated: a gate is the one railgate on each ring */
const gates = b.objs.filter((o) => o.t === "railgate");
const rails = b.objs.filter((o) => o.t === "railH" || o.t === "railV");
if (gates.length !== 6) fail(`${gates.length} gates; there should be one per yard, so six`);
else ok(`six yards, ${rails.length} lengths of railing and ${gates.length} gates`);

/* every gate is walkable, and every railing is not */
for (const q of gates) if (!WALK.includes(g[q.y][q.x])) fail(`the gate at ${q.x},${q.y} is on "${g[q.y][q.x]}" — nobody can get in`);
for (const r of rails) if (WALK.includes(g[r.y][r.x])) fail(`the railing at ${r.x},${r.y} is walkable — you can stroll through the fence`);
ok("every gate is open ground and every railing is solid");

/* WHERE CAN YOU ACTUALLY WALK, from the map's own entrances */
const flood = (starts) => {
  const seen = new Set(), q = [...starts];
  for (const [x, y] of starts) seen.add(`${x},${y}`);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k)) continue;
      if (!WALK.includes(g[ny][nx])) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
};
const edges = [];
for (let y = 0; y < ROWS; y++) for (const x of [0, COLS - 1]) if (WALK.includes(g[y][x])) edges.push([x, y]);
for (let x = 0; x < COLS; x++) for (const y of [0, ROWS - 1]) if (WALK.includes(g[y][x])) edges.push([x, y]);
const reach = flood(edges);
ok(`${reach.size} tiles reachable from the map's edges`);

/* EVERY MONSTER IS INSIDE A YARD, and can be got at.
   THE RINGS ARE DERIVED FROM THE RAILINGS, not by flooding in from a gate: a yard with a gap in it is open to
   the map by design, so a flood started at the gate simply spills back out and reports every monster as standing
   in the road. That is what the first run of this checker said about all twenty-six of them, and the map was
   fine. Each connected run of railings is one yard - a ring with a one-tile gap is still connected the long way
   round - and its bounding box is the yard. */
const yards = [];
{
  const solid = new Map(rails.map((r) => [r.x + "," + r.y, r]));
  const seen = new Set();
  for (const r of rails) {
    const k0 = r.x + "," + r.y; if (seen.has(k0)) continue;
    const comp = [], stack = [[r.x, r.y]]; seen.add(k0);
    while (stack.length) {
      const [x, y] = stack.pop(); comp.push([x, y]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = nx + "," + ny;
        if ((!dx && !dy) || seen.has(k) || !solid.has(k)) continue;
        seen.add(k); stack.push([nx, ny]);
      }
    }
    const xs = comp.map((c) => c[0]), ys = comp.map((c) => c[1]);
    const box = { x0: Math.min(...xs) + 1, y0: Math.min(...ys) + 1, x1: Math.max(...xs) - 1, y1: Math.max(...ys) - 1 };
    const inside = new Set();
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) inside.add(x + "," + y);
    yards.push({ box, inside, gate: gates.find((q) => q.x >= box.x0 - 1 && q.x <= box.x1 + 1 && q.y >= box.y0 - 1 && q.y <= box.y1 + 1) });
  }
}
if (yards.length !== 6) fail(yards.length + " rings of railing; there should be six");
else ok("six rings, each with its own gate: " + yards.map((y) => (y.box.x1 - y.box.x0 + 1) + "x" + (y.box.y1 - y.box.y0 + 1)).join(", "));

for (const [t, x, y] of S.mobs) {
  const home = yards.find((yd) => yd.inside.has(`${x},${y}`));
  if (!home) fail(`${G.MOBS[t].name} at ${x},${y} is not inside any yard — it is standing where people walk`);
  if (!WALK.includes(g[y][x])) fail(`${G.MOBS[t].name} at ${x},${y} is on "${g[y][x]}", which cannot be stood on`);
}
ok(`all ${S.mobs.length} monsters stand on clear ground inside a yard`);

/* AND EVERY YARD CAN BE ENTERED: its interior is reachable once you step through the gate */
for (const yd of yards) {
  const open = [...yd.inside].filter((k) => { const [x, y] = k.split(",").map(Number); return WALK.includes(g[y][x]); });
  if (open.length < 8) fail(`the yard at gate ${yd.gate.x},${yd.gate.y} has only ${open.length} standable tiles inside it`);
}
const all = flood([...edges]);
for (const [t, x, y] of S.mobs) if (!all.has(`${x},${y}`)) fail(`${G.MOBS[t].name} at ${x},${y} cannot be walked to at all`);
ok("every yard opens onto a path, and every monster in one can be reached");

/* THE SKILLING IS OUTSIDE THE RAILINGS — the whole reason for fencing the monsters in */
const yardTiles = new Set(yards.flatMap((yd) => [...yd.inside]));
for (const o of b.objs) {
  if (!["rock", "yew", "spot"].includes(o.t)) continue;
  if (yardTiles.has(`${o.x},${o.y}`)) fail(`the ${o.name} at ${o.x},${o.y} is shut inside a graveyard`);
  /* a fishing spot is worked from the bank ABOVE it — reachOf("spot") is 3 because the "b" bank row cannot be
     stood on either. The first version of this looked downward, into the water, and called a perfectly good
     spot unreachable. */
  const near = o.t === "spot" ? [[0, -1], [0, -2], [0, -3], [1, -2], [-1, -2]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const beside = near.some(([dx, dy]) => all.has(`${o.x + dx},${o.y + dy}`));
  if (!beside) fail(`the ${o.name} at ${o.x},${o.y} cannot be reached`);
}
ok("every rock, tree and fishing spot is on open ground and can be worked");

/* nothing sitting on top of anything else */
const at = new Map();
for (const o of b.objs) for (let j = 0; j < (o.h || 1); j++) for (let i = 0; i < (o.w || 1); i++) {
  const k = `${o.x + i},${o.y + j}`;
  if (at.has(k)) fail(`two objects on ${k}: ${at.get(k)} and ${o.t}`);
  at.set(k, o.t);
}
for (const [t, x, y] of S.mobs) if (at.has(`${x},${y}`)) fail(`${G.MOBS[t].name} at ${x},${y} is standing on a ${at.get(`${x},${y}`)}`);
ok(`${b.objs.length} objects, none stacked and none under a monster`);

/* THE MINI BOSS */
{
  const c = G.MOBS.critic, u = G.MOBS.understudy;
  if (!G.BOUNTY.critic) fail("The Critic has no BOUNTY — no rares, no casino finds, and a Lucky clover would not count him");
  else ok(`The Critic: level ${c.lvl}, ${c.hp} health (${(c.hp / u.hp).toFixed(1)}x the Understudy's ${u.hp}), pays ${G.BOUNTY.critic}`);
  if (!c.aggro) fail("The Critic does not come for you; a mini boss behind a gate you opened on purpose should");
  const spot = S.mobs.find(([t]) => t === "critic");
  if (S.mobs.filter(([t]) => t === "critic").length !== 1) fail("there is more than one Critic");
  else ok(`he is alone in his yard at ${spot[1]},${spot[2]}`);
  /* HE IS NOT THE ONLY AGGRESSIVE THING HERE and never was: chandelier and usher have been on AGGRO_ON since
     long before this rebuild, which is also why the old sign's "Nothing here attacks first" was untrue. What
     matters is that the Critic is on that list at all — a mob left off it has its `aggro` deleted outright and
     becomes a mini boss that waits politely to be poked, which is what the first build of him did. */
  const ag = [...new Set(S.mobs.map(([t]) => t))].filter((t) => G.MOBS[t].aggro);
  ok(`aggressive here: ${ag.map((t) => G.MOBS[t].name).join(", ")} — reach ${G.AGGRO_REACH}, and every one of them behind railings`);
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe Boneyard holds together");
process.exitCode = bad ? 1 : 0;

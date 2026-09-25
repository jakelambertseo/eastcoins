/* DOES THE CARNIVAL HOLD TOGETHER? —  node tools/eastscape-carnival-test.mjs
   (2026-09-24, the owner: "build a map for level 60s ... The Carnival ... a game area ... dont open it until i
   tell you, just let me teleport in there", then "mmake carnival 62-72")

   THE FIRST CHECK IS THE ONE THAT MATTERS MOST: it is not open. That is enforced by omission — the scene is not
   in OPEN, it has no exits, and nothing else has an exit to it — which is the kind of thing that gets undone by
   accident while adding something nearby. If this test starts failing and nobody meant it to, a map the owner
   asked to keep shut has been let out.

   The rest is what a map can be wrong about: a monster nobody can walk to, a game area you cannot reach, and an
   aggressive monster able to reach the plaza people are meant to queue on. */
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";

const KEY = "carnival", S = G.SCENES[KEY], b = S.build(), g = b.g;
const COLS = g[0].length, ROWS = g.length, WALK = ".,isbep";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- SHUT */
if (G.OPEN.has(KEY)) fail("the Carnival is in OPEN — the owner asked for it to stay shut until he says");
if (Object.keys(S.exits || {}).length) fail(`the Carnival has exits (${Object.keys(S.exits).join(", ")}) — it should have none until it is opened`);
{
  const into = Object.entries(G.SCENES).filter(([k, d]) => k !== KEY && Object.values(d.exits || {}).includes(KEY));
  if (into.length) fail(`${into.map(([k]) => G.SCENES[k].name).join(", ")} leads into the Carnival — it should not be reachable on foot yet`);
}
if (!bad) ok("SHUT: not in OPEN, no exits of its own, and nothing leads into it. /tp carnival still works");

/* ---------------------------------------------------------------- the band it was built for */
const band = G.BANDS[KEY];
if (!band) fail("no BANDS entry — anybody of any level could fight here");
else if (band[0] !== 62 || band[1] !== 72) fail(`band is ${band.join("-")}; the owner asked for 62-72`);
else ok(`band ${band.join("-")}, filling the hole between The House (70) and the Junkyard Dog (80)`);
if (!G.DEATH[KEY]) fail("no DEATH entry — dying here would cost nothing");

/* ---------------------------------------------------------------- everything can be walked to */
const flood = (sx, sy) => {
  const seen = new Set([`${sx},${sy}`]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || !WALK.includes(g[ny][nx])) continue;
      seen.add(k); q.push([nx, ny]); } }
  return seen;
};
const reach = flood(30, 13);
ok(`${reach.size} tiles walkable from the midway`);
const beside = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(`${x + dx},${y + dy}`));
for (const [t, x, y] of S.mobs) {
  if (!WALK.includes(g[y]?.[x])) fail(`${G.MOBS[t].name} at ${x},${y} is on "${g[y]?.[x]}", which cannot be stood on`);
  else if (!beside(x, y)) fail(`${G.MOBS[t].name} at ${x},${y} cannot be walked to`);
}
ok(`all ${S.mobs.length} monsters stand on clear ground and can be reached`);

/* ---------------------------------------------------------------- THE GAME AREA
   Paved, reachable, and nothing aggressive able to get at it. The reach model is the aggro checker's: where a
   monster can STAND (home, wandered three by two) plus its aggro. */
const stalls = b.objs.filter((o) => ["balloonpop", "shootgallery", "whackamole"].includes(o.t));
if (stalls.length !== 3) fail(`${stalls.length} game stalls; the owner asked for balloon pop, shooting targets and whack-a-mole`);
else ok(`three stalls: ${stalls.map((o) => o.t).join(", ")}`);
const plaza = [];
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "p") plaza.push([x, y]);
if (plaza.length < 40) fail(`the plaza is only ${plaza.length} paved tiles`);
else ok(`${plaza.length} paved tiles of plaza`);
for (const [x, y] of plaza) if (!reach.has(`${x},${y}`)) { fail(`the plaza tile ${x},${y} cannot be reached`); break; }
for (const o of stalls) {
  const at = [[-1, 0], [o.w, 0], [0, -1], [0, o.h]].some(([dx, dy]) => reach.has(`${o.x + dx},${o.y + dy}`));
  if (!at) fail(`you cannot stand next to the ${o.t}`);
}
ok("the plaza is reachable and you can stand at every stall");
{
  let menaced = 0;
  for (const [t, hx, hy] of S.mobs) {
    const a = G.MOBS[t].aggro; if (!a) continue;
    const stand = flood(hx, hy);   // walkable, then clipped to the wander box below
    for (const [x, y] of plaza) {
      const near = [...stand].some((k) => { const [sx, sy] = k.split(",").map(Number);
        return Math.abs(sx - hx) <= 3 && Math.abs(sy - hy) <= 2 && Math.max(Math.abs(x - sx), Math.abs(y - sy)) <= a; });
      if (near) { fail(`${G.MOBS[t].name} at ${hx},${hy} can reach the plaza`); menaced++; break; }
    }
  }
  if (!menaced) ok("nothing aggressive can reach the plaza — a fairground you get mauled queueing on is not a fairground");
}

/* ---------------------------------------------------------------- the cast, and the boss in the north-west */
for (const t of [...new Set(S.mobs.map((m) => m[0]))]) {
  const m = G.MOBS[t];
  if (!m) { fail(`the scene spawns "${t}", which is not a monster`); continue; }
  if (!G.BOUNTY[t]) fail(`${m.name} has no BOUNTY — no rares, no casino finds, and a Lucky clover would not count it`);
  if (m.lvl < 62 || m.lvl > 72) fail(`${m.name} is level ${m.lvl}, outside the 62-72 band`);
}
ok("every monster here is inside the band and pays a bounty");
{
  const boss = S.mobs.find(([t]) => t === "grinner");
  if (!boss) fail("there is no boss");
  else {
    if (boss[1] > COLS / 3 || boss[2] > ROWS / 2) fail(`the boss is at ${boss[1]},${boss[2]}; the owner asked for the north-west`);
    else ok(`The Grinning Man is at ${boss[1]},${boss[2]} — north-west, in front of his funhouse`);
    if (!G.MOBS.grinner.aggro) fail("the boss is not aggressive; a mob left off AGGRO_ON has its aggro deleted outright");
  }
  const ag = [...new Set(S.mobs.map(([t]) => t))].filter((t) => G.MOBS[t].aggro);
  if (ag.length !== 1 || ag[0] !== "grinner") fail(`aggressive here: ${ag.join(", ")} — only the boss should be`);
  else ok("and he is the only thing here that comes for you");
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe Carnival holds together");
process.exitCode = bad ? 1 : 0;

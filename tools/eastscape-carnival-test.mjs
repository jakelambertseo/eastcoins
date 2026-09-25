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
import fsSync from "node:fs";
const ROOT = "C:/Users/jake/code/eastcoins";
const join = (a2, b2) => a2 + "/" + b2;

const KEY = "carnival", S = G.SCENES[KEY], b = S.build(), g = b.g;
const COLS = g[0].length, ROWS = g.length, WALK = ".,isbep";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- OPEN (2026-09-24)
   This check used to assert the opposite. The Carnival was built on 2026-09-24 and held shut at the owner's word
   ("dont open it until i tell you, just let me teleport in there") until he said to launch it. What the check is
   FOR has not changed: a map is reachable or it is not, and either way it should be on purpose. It now pins the
   way in, because a door that quietly disappears is the same class of accident as one that quietly appears. */
if (!G.OPEN.has(KEY)) fail("the Carnival is not in OPEN — a scene is not enterable until it is, and the door answers \"Room's shut\"");
{
  const out = Object.entries(S.exits || {});
  if (!out.length) fail("the Carnival has no exits — you could walk in and not get out");
  else if (!out.some(([, to]) => to === "workyard")) fail(`the Carnival leads to ${out.map(([, t]) => t).join(", ")} but not back to the Yard`);
  const into = Object.entries(G.SCENES).filter(([k, d]) => k !== KEY && Object.values(d.exits || {}).includes(KEY));
  if (!into.length) fail("nothing leads INTO the Carnival — it is open but unreachable on foot");
  else {
    const back = into.map(([k, d]) => `${d.name} (${Object.entries(d.exits).find(([, t]) => t === KEY)[0]})`).join(", ");
    if (!bad) ok(`OPEN, and reached from ${back}; it leads back to ${out.map(([d2, t]) => `${t} (${d2})`).join(", ")}`);
  }
}

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
  /* (2026-09-24) THE PLACEMENT aggro, not the type. Half the Carnival is aggressive per placement now, and the
     types are not on AGGRO_ON at all — reading MOBS[t].aggro would find nothing and quietly pass forever. */
  for (const [t, hx, hy, over] of S.mobs) {
    const a = over?.aggro ?? G.MOBS[t].aggro; if (!a) continue;
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
  /* HE IS ALONE IN A CAGE, SO HIS RESPAWN IS HIS PAY RATE (2026-09-25, the owner: "the grinning man in the
     carnival is getting exploited"). The turnstile takes a ticket to go IN and nothing to come out, so the cover
     charge is paid once and after that the only thing between one 2,000-ticket kill and the next is the timer.
     eastscape-balance.mjs cannot see this: it models walking 3s to the NEXT monster, which is right on a map with
     twenty of them and meaningless for one boss behind bars. So it is checked here instead.
     The party divisor is the other half of it - on an ordinary mob it stops a crowd standing around, on a boss it
     means the more people farming it the faster it returns. A mob with its own `respawn` is not divided. */
  {
    const KILL_S = 28;   // measured by eastscape-balance.mjs for a character at the band's level
    for (const f of [1, 2, 4]) {
      const wait = G.respawnMs(S, "grinner", f) / 1000;
      const perMin = Math.round(G.BOUNTY.grinner / (KILL_S + wait) * 60);
      if (wait < 300) fail(`the boss is back in ${wait}s with ${f} on him; the owner asked for at least five minutes`);
      else if (perMin > 480) fail(`the boss pays ${perMin}/min with ${f} on him, past the band`);
      else if (f === 4) ok(`caged and camped, he pays ${perMin}/min at ${wait}s — the same with one on him or four`);
    }
  }

  /* HALF THE MAP COMES FOR YOU (2026-09-24, the owner: "randomly in the carnival about 50% of the mobs need to
     be agressive"). Per PLACEMENT, so one Pinhead charges and the next does not — which is what makes it read
     as random rather than as a rule about Pinheads. */
  const marked = S.mobs.filter(([t, , , o]) => t !== "grinner" && o?.aggro);
  const total = S.mobs.filter(([t]) => t !== "grinner").length;
  const share = marked.length / total;
  if (share < 0.4 || share > 0.6) fail(`${marked.length} of ${total} placements are aggressive (${Math.round(share * 100)}%); the owner asked for about half`);
  else ok(`${marked.length} of ${total} placements come for you (${Math.round(share * 100)}%), and the boss on top`);
  /* every KIND has some and none is nearly all, or it reads as a bug rather than a coin toss */
  for (const t of [...new Set(S.mobs.map(([k]) => k))].filter((t) => t !== "grinner")) {
    const all = S.mobs.filter(([k]) => k === t).length, on = S.mobs.filter(([k, , , o]) => k === t && o?.aggro).length;
    if (on === 0 || on === all) fail(`every ${G.MOBS[t].name} is ${on ? "aggressive" : "passive"} — that is a rule about the type, not a scatter`);
  }
  /* and the reach matches the rest of the game: a placement override is NOT clamped by the AGGRO_ON loop */
  for (const [t, hx, hy, o] of marked) if (o.aggro !== G.AGGRO_REACH) fail(`${G.MOBS[t].name}@${hx},${hy} has reach ${o.aggro}; AGGRO_REACH is ${G.AGGRO_REACH} and nothing clamps a placement`);
  ok(`each at reach ${G.AGGRO_REACH}, the same as everything else in the game`);
}

/* ---------------------------------------------------------------- NOTHING STANDS ON ANYTHING ELSE
   The Carnival's build uses a put() that blocks and keeps but does NOT check what is already there, and the
   first pass at Banner Alley put a banner squarely inside the entrance arch because of it. Two pictures on one
   tile draw over each other and only one of them can be clicked. */
{
  const at = new Map();
  for (const o of b.objs) for (let j = 0; j < (o.h || 1); j++) for (let i = 0; i < (o.w || 1); i++) {
    const k = `${o.x + i},${o.y + j}`;
    if (at.has(k)) fail(`two objects on ${k}: ${at.get(k)} and ${o.t}`);
    at.set(k, o.t);
  }
  for (const [t, x, y] of S.mobs) if (at.has(`${x},${y}`)) fail(`${G.MOBS[t].name} at ${x},${y} is standing on a ${at.get(`${x},${y}`)}`);
  ok(`${b.objs.length} objects, none stacked and none under a monster`);
}

/* ---------------------------------------------------------------- AND NO TWO PICTURES SIT ON TOP OF EACH OTHER
   (2026-09-24, the owner on a screenshot of the entrance: "the entrance area is a bit too busy, break it up and
   spread some stuff out")

   THE FOOTPRINT IS NOT THE PICTURE, and that is the whole of this map's crowding problem. A tile is 16px and
   almost nothing here is: a banner is 53px on a ONE-tile footprint, so it draws three and a third tiles wide;
   the entrance arch is 113px on three tiles and draws seven; a sideshow tent is 110px on two. Six banners at
   three-tile spacing therefore never touched as footprints and never stopped touching as pictures, and the
   check above — which only knows about footprints — called it fine.

   So this measures the drawn rectangles. Fences and cage runs are excluded because a wall is SUPPOSED to be
   continuous, and so is the row of game stalls: a midway is stalls shoulder to shoulder. Everything else that
   overlaps by more than a third of a tile is crowding. */
{
  const wide = {};
  for (const o of b.objs) if (!(o.t in wide)) {
    try { const buf = fsSync.readFileSync(join(ROOT, `v3/assets/img/glad/flat/o_${o.t}.png`));
      /* PNG width and height live at bytes 16..24, so no image library is needed for this */
      wide[o.t] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    } catch { wide[o.t] = null; }
  }
  const RUN = new Set(["cagebarH", "cagebarV", "railH", "railV"]);          // a wall is meant to be continuous
  const STALL = new Set(["balloonpop", "shootgallery", "whackamole"]);     // a midway is stalls shoulder to shoulder
  const box = (o) => { const [w, h] = wide[o.t];
    const cx = (o.x + (o.w || 1) / 2) * 16, foot = (o.y + (o.h || 1)) * 16;
    return { x0: cx - w / 2, x1: cx + w / 2, y0: foot - h, y1: foot }; };
  const props = b.objs.filter((o) => wide[o.t] && wide[o.t][0] > 60 && !RUN.has(o.t));
  let worst = 0, who = "";
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
    if (STALL.has(props[i].t) && STALL.has(props[j].t)) continue;
    const A = box(props[i]), B = box(props[j]);
    const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
    const n = Math.min(ox, oy);
    if (ox > 0 && oy > 0 && n > worst) { worst = n; who = `${props[i].t}@${props[i].x},${props[i].y} and ${props[j].t}@${props[j].x},${props[j].y}`; }
  }
  if (worst > 24) fail(`${who} overlap by ${Math.round(worst)}px — more than a tile and a half of one drawn over the other`);
  else ok(`no two prop pictures overlap by more than ${Math.round(worst)}px (${props.length} props measured, walls and the stall row excepted)`);
}

/* ---------------------------------------------------------------- IT IS NOT A STRAIGHT LINE
   (the owner: "the circus is also very linear as far as walk ways, etc. can we randomize it so it feels like
   theres unique sections?") The old midway was one row from edge to edge. A road that doglegs is what stops you
   seeing the whole map from the gate, so what is measured is how many rows and columns the path actually
   occupies: a straight road across y13 scores 1. */
{
  const rows = new Set(), cols = new Set();
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === ",") { rows.add(y); cols.add(x); }
  if (rows.size < 8) fail(`the midway only occupies ${rows.size} rows — that is still a straight road`);
  else ok(`the midway winds through ${rows.size} rows and ${cols.size} columns, so no two sections share a sightline`);
}

/* ---------------------------------------------------------------- THE MENAGERIE
   (2026-09-24, the owner testing it: "the grinning man needs to be in a horroresque locked in area, and the
   other mobs in the area need a chance too drop a carnival ticket")

   A CAGE THAT LEAKS IS NOT A CAGE. One walkable tile in the wrong place and the ticket becomes decoration, and
   it is the kind of gap that appears from a change three lines away — a piece of clutter not placed, a bar
   rubbed out by wild(). So this floods the map from the midway with the turnstile treated as SOLID, and
   insists nothing inside can be reached that way. */
{
  const ts = b.objs.find((o) => o.t === "turnstile");
  if (!ts) fail("there is no turnstile");
  else {
    const c = ts.cage;
    if (!c) fail("the turnstile does not carry its cage, so the worker cannot tell inside from outside");
    const seen = new Set(["30,13"]), q = [[30, 13]];
    while (q.length) { const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k)) continue;
        if (nx === ts.x && ny === ts.y) continue;                        // not a doorway you can simply walk through
        if (!WALK.includes(g[ny][nx])) continue; seen.add(k); q.push([nx, ny]); } }
    const inside = [];
    for (let y = c.y0 + 1; y < c.y1; y++) for (let x = c.x0 + 1; x < c.x1; x++) if (WALK.includes(g[y][x])) inside.push([x, y]);
    const leak = inside.filter(([x, y]) => seen.has(`${x},${y}`));
    if (leak.length) fail(`${leak.length} tiles inside the cage can be reached without the turnstile (e.g. ${leak[0]})`);
    else ok(`the cage is sealed: ${inside.length} standable tiles inside, and the turnstile is the only way to any of them`);
    const boss = S.mobs.find(([t]) => t === "grinner");
    if (!inside.some(([x, y]) => x === boss[1] && y === boss[2])) fail("The Grinning Man is not inside his own cage");
    else ok("The Grinning Man is inside it, and nothing else is");
    /* and it turns both ways onto ground you can actually stand on */
    const out = { x: ts.x + 1, y: ts.y }, into = { x: ts.x - 1, y: ts.y };
    if (!seen.has(`${out.x},${out.y}`)) fail(`the turnstile's outside tile ${out.x},${out.y} cannot be reached`);
    if (!WALK.includes(g[into.y][into.x])) fail(`the turnstile's inside tile ${into.x},${into.y} is blocked`);
    ok(`it steps between ${out.x},${out.y} outside and ${into.x},${into.y} inside`);
    if (WALK.includes(g[ts.y][ts.x])) ok("and its own tile is walkable, so it is a turnstile and not a wall");
    else fail("the turnstile tile is blocked — nobody could ever click it from inside");
  }
}

/* THE KEY EXISTS AND SOMETHING DROPS IT. A locked cage whose key drops from nothing is a locked cage. */
{
  if (!G.ITEMS.carnivalticket) fail("there is no Carnival ticket item");
  const carriers = [...new Set(S.mobs.map(([t]) => t))].filter((t) => (G.MOBS[t].drops || []).some((d) => d[0] === "carnivalticket"));
  if (!carriers.length) fail("nothing on this map drops a Carnival ticket, so the cage can never be opened");
  else {
    const rate = (G.MOBS[carriers[0]].drops.find((d) => d[0] === "carnivalticket") || [])[2];
    ok(`${carriers.length} of the map's monsters drop a Carnival ticket at ${(rate * 100).toFixed(0)}% — about ${Math.round(1 / rate)} kills a ticket`);
    if (carriers.includes("grinner")) fail("the boss drops the key to his own cage");

    /* AND HE HAS TO BE WORTH THE DOOR (2026-09-24, the owner: "the grinning man needs to give boosted tickets
       since it takes the carnival tickets, and carnival tickets are a 1% drop chance now").
       The ticket does not cost TICKETS — a hundred kills earns about fourteen thousand of them on the way — so
       what the turnstile charges is TIME, and the only question that matters is whether spending a ticket beats
       carrying on farming. He was paying two and a half normal kills for a door that takes twenty-five minutes
       to find, which is a reason never to open it. The rule is simply that he must be worth appreciably more
       than the things that drop his key, and the arithmetic is printed so the next person changing either
       number can see what it does to the other. */
    const freaks = carriers.map((t) => G.BOUNTY[t]);
    const avg = freaks.reduce((a, n) => a + n, 0) / freaks.length;
    const ratio = G.BOUNTY.grinner / avg;
    if (ratio < 6) fail(`the boss pays ${G.BOUNTY.grinner}, only ${ratio.toFixed(1)} normal kills, for a cage that costs ${Math.round(1 / rate)} of them to open`);
    else ok(`the boss pays ${G.BOUNTY.grinner} — ${ratio.toFixed(1)} normal kills, against ${Math.round(1 / rate)} to find the ticket that lets you in`);
  }
}

/* THE HORROR IS EVERYWHERE, not only where the boss stands (the owner: "the ashetic needs more horror esque
   elements, bloody things, knives on the ground") */
{
  const gore = b.objs.filter((o) => ["bloodpool", "knives", "meathook"].includes(o.t));
  const outside = gore.filter((o) => o.x > 13);
  if (gore.length < 20) fail(`only ${gore.length} bloody things on the whole map`);
  else if (!outside.length) fail("all the gore is inside the cage; the midway is still a cheerful fairground");
  else ok(`${gore.length} stains, knives and hooks, ${outside.length} of them out on the midway`);
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe Carnival holds together");
process.exitCode = bad ? 1 : 0;

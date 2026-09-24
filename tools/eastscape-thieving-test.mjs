/* THIEVING: the rules that would break quietly (2026-09-23).

   A new skill is mostly data, and data fails without an error. These are the properties the design rests on, in
   the order they would hurt:

     - a mark NEVER drops tickets. Thieving pays instantly with no input cost, so a ticket drop would make it the
       best faucet in the game and undo the halving TIX_RATE exists to do. Everything is a GOOD, so the Cashier
       price stays the lever and TIX_RATE already reaches it.
     - the chance CLIMBS with level. Agility is 557 hours to 99 because its lap pays a flat 222 xp and nothing
       about it compounds; the sim measured its rate moving 12% across 98 levels. That is the one mistake this
       skill exists not to repeat.
     - the guild has NO level band, or a skill you cannot fight your way into would need a combat level anyway.
     - the seal chain cannot be commoner than the flux it eats.
     - and the whole ladder still lands 1 to 99 near mining and woodcutting rather than near Agility.

   Run: node tools/eastscape-thieving-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import { createCryptRules } from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-crypt-rules.js";
import fs from "node:fs";

const GUILD_HOME = "gloam";   /* the scene the guild door stands in */
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- the skill is really declared */
{
  if (!G.SKILLS.thieving) fail("SKILLS has no thieving");
  if (G.freshChar().xp.thieving !== 0) fail("a new character has no thieving xp - the skills panel will render NaN");
  if (G.normChar({ name: "old" }).xp.thieving !== 0) fail("an existing character was not backfilled with the new skill");
  /* whether the panel lists it depends on THIEF.live; the switch block at the bottom owns that */
  ok("the skill exists and every character, new or saved, starts it at zero");
}

/* ---------------------------------------------------------------- NEVER TICKETS */
{
  let lines = 0;
  for (const [key, m] of Object.entries(G.MARKS)) {
    for (const [k] of m.drop) {
      if (k === "tickets") fail(`${key} drops tickets - that is the faucet rule broken`);
      if (!G.ITEMS[k]) fail(`${key} drops ${k}, which is not an item`);
      lines++;
    }
  }
  /* and prove it over a real sample rather than by reading the table */
  let rolls = 0;
  for (const key of Object.keys(G.MARKS)) {
    for (let i = 0; i < 4000; i++) { rolls++; if (G.markDrop(key) === "tickets") { fail(`${key} rolled tickets`); break; } }
  }
  ok(`no mark can drop tickets (${lines} drop lines, ${rolls.toLocaleString()} rolls)`);
}

/* ---------------------------------------------------------------- the tables are distributions */
{
  for (const [key, m] of Object.entries(G.MARKS)) {
    const sum = m.drop.reduce((a, [, w]) => a + w, 0);
    if (Math.abs(sum - 1) > 1e-9) fail(`${key}'s drop weights sum to ${sum}, not 1 - markDrop walks them subtracting, so the tail is unreachable`);
    if (m.drop.some(([, w]) => !(w > 0))) fail(`${key} has a drop line with no weight`);
  }
  /* the measured share must match the declared weight, or the walk is wrong */
  const N = 60000, m = G.MARKS.quarter, seen = {};
  for (let i = 0; i < N; i++) { const k = G.markDrop("quarter"); seen[k] = (seen[k] || 0) + 1; }
  for (const [k, w] of m.drop) {
    const got = (seen[k] || 0) / N;
    if (Math.abs(got - w) > 0.02) fail(`quarter drops ${k} ${(got * 100).toFixed(1)}% of the time, declared ${w * 100}%`);
  }
  ok("every table is a real distribution and markDrop honours the weights");
}

/* ---------------------------------------------------------------- THE ANTI-AGILITY RULE */
{
  const at = (lvl, mark) => G.pickChance({ xp: { thieving: G.XP_AT[lvl] } }, mark);
  if (!(at(50, 25) > at(25, 25))) fail("being 25 levels over the mark is no better than being level with it");
  if (at(99, 1) > G.THIEF.cap + 1e-9) fail("the chance runs past its cap");
  if (Math.abs(at(25, 25) - G.THIEF.base) > 1e-9) fail("at your own level the chance is not the declared base");
  if (!(at(1, 25) < at(25, 25))) fail("being under the mark's level is not a penalty");
  const climb = at(75, 1) / at(1, 1);
  if (!(climb > 1.4)) fail(`the chance only climbs ${((climb - 1) * 100).toFixed(0)}% from level 1 to 75 - that is the Agility mistake`);
  ok(`success climbs with level (${(at(1, 1) * 100).toFixed(0)}% to ${(at(75, 1) * 100).toFixed(0)}% on the same mark) and caps at ${G.THIEF.cap * 100}%`);
}

/* ---------------------------------------------------------------- the guild */
{
  if (G.bandOf("guild")) fail("the guild has a LEVEL BAND - a skill you cannot fight your way into would then need a combat level");
  const b = G.SCENES.guild.build(), marks = b.objs.filter((o) => o.t === "mark");
  if (marks.length < 8) fail(`only ${marks.length} marks in the guild`);
  for (const m of marks) {
    const want = G.GUILD_ORDER[G.guildRoom(m.x)];
    if (m.mark !== want) fail(`a ${m.mark} stands in the ${want} room (x=${m.x})`);
    if (m.req?.skill !== "thieving") fail(`${m.mark} is not gated on thieving`);
    if (m.req.lvl !== G.MARKS[m.mark].lvl) fail(`${m.mark}'s door level and its own level disagree`);
  }
  const rooms = new Set(marks.map((m) => G.guildRoom(m.x)));
  if (rooms.size !== G.GUILD_ORDER.length) fail(`marks occupy ${rooms.size} rooms, not ${G.GUILD_ORDER.length}`);
  /* (2026-09-24) THE GUILD LIVES IN THE GLOAM NOW. It opened off the Yard, which is the brightest and busiest
     square in the game; the owner moved it to a far corner of the Gloam. GUILD_HOME is the one place this test
     names the scene, so the next move is a one-line change rather than six. */
  if (G.SCENES.guild.exitTo?.scene !== GUILD_HOME) fail(`the guild comes out in ${G.SCENES.guild.exitTo?.scene}, not ${GUILD_HOME}`);
  /* (2026-09-23) THE CHAMBERS HAVE TO BE SEALED. Found by the owner walking straight into the Quartermaster's
     room at level 1: the marks' own `req` stops you PICKING above your level and never stopped you WALKING, so
     without a solid wall and a gate the four rooms were one corridor. */
  const gates = b.objs.filter((o) => o.t === "guildgate");
  if (gates.length !== G.GUILD_WALLS.length) fail(`${gates.length} gates for ${G.GUILD_WALLS.length} walls`);
  for (const gt of gates) {
    /* a gate sits ON the wall, so guildRoom() answers for the room BEHIND it; what it leads to is its own `room`. */
    const want = G.MARKS[G.GUILD_ORDER[gt.room]];
    if (gt.room !== G.guildRoom(gt.x) + 1) fail(`the gate at x=${gt.x} says it leads to room ${gt.room}, but it stands between ${G.guildRoom(gt.x)} and ${G.guildRoom(gt.x) + 1}`);
    if (!(gt.lvl > 0)) fail("a gate asks for no level at all");
    /* (2026-09-23) A DOOR MAY OPEN BEFORE ITS MARKS DO - the first one opens at 10 for marks you cannot pick
       until 25, deliberately, so a new thief has somewhere to walk to. What must never happen is the reverse:
       a door that opens only once you could already work the room is a wall for no reason. */
    if (want && gt.lvl > want.lvl) fail(`the gate at x=${gt.x} asks Thieving ${gt.lvl} but its marks are pickable at ${want.lvl} - the door outlives its purpose`);
  }
  for (const wx of G.GUILD_WALLS) {
    const open = [];
    for (let y = 7; y <= 18; y++) if (b.g[y][wx] === "i") open.push(y);
    if (open.length) fail(`the wall at x=${wx} has walkable tiles at y=${open.join(",")} - you can stroll past the gate`);
    if (!gates.some((gt) => gt.x === wx)) fail(`the wall at x=${wx} has no gate, so that chamber is sealed for ever`);
  }
  /* and the rooms have to LOOK different, which is the other thing testing turned up */
  const kinds = [0, 1, 2, 3].map((i) => new Set(b.objs.filter((o) => o.t !== "guildgate" && G.guildRoom(o.x) === i && o.t !== "mark" && o.t !== "sign").map((o) => o.t)));
  kinds.forEach((set, i) => { if (set.size < 3) fail(`room ${i} has only ${set.size} kinds of furniture - the rooms read as one corridor`); });
  if (b.objs.filter((o) => o.t === "sign").length < 4) fail("not every room has a sign saying whose it is");
  ok(`${marks.length} marks across ${rooms.size} sealed rooms, ${gates.length} gates on the right levels, each room furnished differently`);
}

/* ---------------------------------------------------------------- the stolen line reaches the anvil */
{
  const R = G.RECIPES;
  for (const id of ["make_temper", "make_flux", "make_seal"]) {
    const r = R[id];
    if (!r) { fail(`${id} is not a recipe`); continue; }
    if (r.station !== "anvil") fail(`${id} is not made at the anvil`);
    if (r.skill !== "smithing") fail(`${id} pays ${r.skill} xp, not smithing`);
    for (const [k] of r.in) if (!G.ITEMS[k]) fail(`${id} takes ${k}, which is not an item`);
    if (!G.ITEMS[r.out[0]]) fail(`${id} makes ${r.out[0]}, which is not an item`);
  }
  if (!R.make_seal?.in.some(([k]) => k === "flux")) fail("a seal does not eat a flux, so it could be commoner than one");
  if (!(R.make_seal.lvl > R.make_flux.lvl && R.make_flux.lvl > R.make_temper.lvl)) fail("the three consumables are not a ladder");
  const dropped = new Set(Object.values(G.MARKS).flatMap((m) => m.drop.map(([k]) => k)));
  for (const k of ["whetgrit", "quench_salts", "seal_wax"]) if (!dropped.has(k)) fail(`${k} is in a recipe but no mark drops it`);
  ok("all three consumables are anvil recipes, in a ladder, from materials marks actually carry");
}

/* ---------------------------------------------------------------- the fence, and what an hour pays */
{
  /* (2026-09-23) THE SAME MODEL THE SKILL SIM USES, because the two disagreeing is how the design got a wrong
     number into the wiki. Priced as "attempts x 70%" these rooms read 3k/8k/13k/24k an hour; the sim charges the
     HOP to the next mark after a lift and the STUN on every miss, and the same prices then measured a little over
     half that. An attempt costs its own time, plus a hop when it lands and a stun when it does not. */
  const HOP = 0.9, P = 0.70, stun = (G.THIEF.stun[0] + G.THIEF.stun[1]) / 2000;
  const PICKS = (3600 / (G.THIEF.ms / 1000 + P * HOP + (1 - P) * stun)) * P;
  const rows = [];
  for (const key of G.GUILD_ORDER) {
    const m = G.MARKS[key];
    const tix = m.drop.reduce((a, [k, w]) => a + w * (G.SHOP.buys[k] || 0), 0) * PICKS;
    rows.push([m.name, Math.round(tix), Math.round(PICKS * m.xp)]);
  }
  const top = rows[rows.length - 1][1];
  if (top > 24000) fail(`the top room pays ${top.toLocaleString()} tickets an hour - mining tops out at 23,600 and a room where nothing fights back must sit under it`);
  if (top < 10000) fail(`the top room pays only ${top.toLocaleString()} tickets an hour, which is beneath a level-30 miner`);
  for (let i = 1; i < rows.length; i++) if (rows[i][1] <= rows[i - 1][1]) fail(`${rows[i][0]} pays no more than ${rows[i - 1][0]}`);
  for (const [n, t, x] of rows) console.log(`     ${n.padEnd(20)} ${t.toLocaleString().padStart(7)} tickets/hr   ${x.toLocaleString().padStart(8)} xp/hr`);
  ok("each room pays more than the last, and the best of them stays under combat");
}

/* ---------------------------------------------------------------- 1 to 99 lands where it was designed to */
{
  /* Stepped through the levels rather than assuming one success rate, because pickChance CLIMBS inside a room -
     you enter the Quartermaster's at 55% and leave it at 90%. Flattening that to 70% read 110 hours where the
     skill sim, which does step, reads 92. Same shape as the sim on purpose: if these two ever disagree by much,
     one of them has stopped modelling the game. */
  const HOP = 0.9, stun = (G.THIEF.stun[0] + G.THIEF.stun[1]) / 2000, STEP = 3;
  const picksAt = (lvl, markLvl) => { const p = G.pickChance({ xp: { thieving: G.XP_AT[lvl] } }, markLvl); return (3600 / (G.THIEF.ms / 1000 + p * HOP + (1 - p) * stun)) * p; };
  const tops = [...G.THIEF.rooms.slice(1), 99];
  let hours = 0;
  for (const [i, key] of G.GUILD_ORDER.entries()) {
    const m = G.MARKS[key];
    for (let l = G.THIEF.rooms[i]; l < tops[i]; l += STEP) {
      const to = Math.min(tops[i], l + STEP);
      hours += (G.XP_AT[to] - G.XP_AT[l]) / (picksAt(l, m.lvl) * m.xp);
    }
  }
  if (hours > 130) fail(`${Math.round(hours)} hours to 99 - woodcutting is 73 and combat 149; anything near Agility's 557 is the bug this skill exists not to repeat`);
  if (hours < 50) fail(`${Math.round(hours)} hours to 99 is quicker than mining, for a skill that needs no tool and no gear`);
  ok(`${Math.round(hours)} hours from 1 to 99 (mining 65, woodcutting 73, combat 149, agility 557) — cross-check with the skill sim`);
}

/* ---------------------------------------------------------------- the way in that is not 50,000 tickets */
{
  const CR = createCryptRules(G, G._MAP);
  const line = CR.CRYPT.loot.table.find(([k]) => k === "permit");
  if (!!line !== !!G.THIEF.live) fail(`THIEF.live is ${!!G.THIEF.live} but the Crypt permit line is ${!!line} - a chest paying the key to a locked room`);
  if (!line) { ok("the Crypt pays no permit while the guild is dark"); }
  else {
  const gear = CR.CRYPT.loot.table.find(([k]) => k === "gear");
  if (line && gear && !line[1].every((w, i) => w < gear[1][i])) fail("a permit is commoner than gear in the hoard");
  /* how often a chest actually carries one, per difficulty */
  for (const tier of [1, 2, 3]) {
    let hits = 0; const N = 40000;
    for (let i = 0; i < N; i++) if (CR.rollLoot({ tier, pay: 2500 }).items.some((x) => x.k === "thieves_permit")) hits++;
    const one = hits ? Math.round(N / hits) : Infinity;
    if (one < 15) fail(`tier ${tier} pays a permit every ${one} chests — that is commoner than gear and the 50,000 price stops meaning anything`);
    if (one > 400) fail(`tier ${tier} pays a permit every ${one} chests, which is not a route at all`);
    console.log(`     tier ${tier}: about one permit every ${one} chests`);
  }
  /* and it must not be farmable past the paid runs, exactly as gear is not */
  let late = 0;
  for (let i = 0; i < 20000; i++) if (CR.rollLoot({ tier: 3, pay: 2500, late: true }).items.some((x) => x.k === "thieves_permit")) late++;
  if (late) fail(`${late} permits fell out of chests past the three paid runs — the Crypt can be farmed for them`);
  ok("the Crypt is a real second route, rarer than gear, and closed once the paid runs are used up");
  }
}

/* ---------------------------------------------------------------- THE WIRING
   Every one of these is data that exists and a place that has to know about it. This codebase's recurring bug is
   the other half being forgotten - meOf is a hand-picked subset and has now caught seven features that way, and
   the click map at the top of useObj is what decides whether a click does ANYTHING at all. Read them and insist. */
{
  const W = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
  const has = (re, what) => { if (!re.test(W)) fail(what); };
  has(/const kind = \{ mark: "mark"/, "the click map has no `mark`, so clicking one does nothing at all");
  has(/a\.kind === "mark"/, "there is no pick action in the worker");
  has(/G\.pickChance\(/, "the pick does not use pickChance, so the chance does not climb with level");
  has(/G\.markDrop\(/, "the pick does not roll the mark's drop table");
  has(/pl\.stunUntil/, "a failed pick costs nothing");
  has(/a\.ob\?\.permit/, "the guild door does not check for a permit");
  has(/takeInv\(C\.inv, "thieves_permit"/, "the door does not SPEND the permit, so one could be reused or resold after use");
  has(/guild: C\.guild/, "meOf does not carry `guild`, so the page cannot tell an opened door from a locked one");
  has(/using\.includes\("flux"\)/, "flux does nothing at the anvil");
  has(/G\.forgeOdds\(lvl, sealed\)/, "a master's seal does not reach forgeOdds, so +4 is unreachable");
  has(/G\.FORGE\.temper/, "a temper does not change the odds");
  /* the aids must be checked BEFORE the bars are taken, or a refusal charges you */
  const head = W.slice(W.indexOf("forgeDo(S, pl, m)"), W.indexOf("forgeDo(S, pl, m)") + 3000);
  if (head.indexOf('for (const k of using) if (G.countItems') > head.indexOf('G.takeInv(C.inv, barKey, n)')) fail("the anvil takes your bars before checking you hold the consumables — a refusal would charge you");
  /* THE PAGE IS THE OTHER HALF, and the worker's own comment on that click map says it out loud: "adding a
     clickable object means adding it in BOTH". A mark missing from KIND_OF is not an error anywhere - the click
     simply does nothing, for ever. */
  const P = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  const page = (re, what) => { if (!re.test(P)) fail(what); };
  /* (2026-09-24) MEMBERSHIP, not position. This asked for `KIND_OF = { mark: "mark"` - the opening brace and
     the key on one line - so it failed the moment another feature added a key ahead of it, which Alchemy did.
     What matters is that the page knows `mark` at all, wherever in the table it sits. */
  page(/mark: "mark"/, "the page's KIND_OF has no `mark` - the worker would accept the click and the page would never send one");
  page(/ob\.t === "mark"/, "the page never draws a mark, so the guild is a room of invisible people");
  page(/drawPerson\(X, Y/, "marks have no fallback drawing, so they vanish until sprites exist");
  page(/type === "caught"/, "a failed pick gives the player no feedback at all");
  page(/use: \[\.\.\.forgeUse\]/, "the anvil never tells the server which consumables to spend");
  page(/forgeOdds\(f, sealed\)/, "the anvil's shown odds ignore the seal, so it would disagree with what the server rolls");
  page(/forgeNextAt\(k, f, sealed\)/, "the anvil's \"next\" line ignores the seal");
  ok("every half of the feature knows about the other half");
}

/* ---------------------------------------------------------------- THE SWITCH, AND IT HAS TO BE ALL OR NOTHING
   Thieving ships DARK: the rules and the server are finished, the page cannot draw a mark yet, so THIEF.live
   hides everything a player could see. The danger in a flag like this is that it is half-applied - a door with no
   scene behind it, a skill on the panel with nothing to train, a permit on the shelf that buys a locked room -
   so this checks every visible surface against the SAME flag rather than against a hard-coded expectation. When
   the client lands, flip THIEF.live and this test follows it. */
{
  const live = !!G.THIEF.live;
  const surfaces = {
    "the guild is enterable": G.OPEN.has("guild"),
    "its home scene has a door to it": !!G.SCENES[GUILD_HOME].build().objs.find((o) => o.enter === "guild"),
    "the shop stocks a permit": !!G.SHOP.sells.find(([k]) => k === "thieves_permit"),
    "the skills panel lists it": G.SKILL_GROUPS.some((g) => g.keys.includes("thieving")),
    "the hiscores have a board": G.HISCORES.some(([k]) => k === "thieving"),
    "the wiki shows the guild": !G.SCENES.guild.wikiHide,
  };
  for (const [what, on] of Object.entries(surfaces)) if (on !== live) fail(`THIEF.live is ${live} but ${what} is ${on} - the switch is half-applied`);
  /* and whichever way the flag sits, the things that must always resolve, must resolve */
  if (!G.SKILLS.thieving) fail("thieving left SKILLS - name lookups and the xp field go with it");
  if (G.freshChar().xp.thieving !== 0) fail("a character no longer carries thieving xp");
  if (live) { const d = G.SCENES[GUILD_HOME].build().objs.find((o) => o.enter === "guild"); if (!d?.permit) fail("the guild door is live but asks for no permit"); }
  ok(`THIEF.live is ${live}, and all ${Object.keys(surfaces).length} player-facing surfaces agree with it`);
}

/* ---------------------------------------------------------------- the sounds, and the people who move */
{
  const P = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  const SFX = fs.readFileSync("C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-sfx.js", "utf8");
  for (const k of ["steal", "caught"]) {
    /* Plain string matching on purpose: this needed `takes\(` inside a template literal to survive, and it did
       not - the regex came out as `takes("steal", *(d+))` and quietly matched nothing. */
    const decl = SFX.split(String.fromCharCode(10)).find((ln) => ln.trimStart().startsWith(k + ":"));
    if (!decl) { fail(`${k} is not a registered sound`); continue; }
    const call = `takes("${k}", `, at = decl.indexOf(call);
    if (at < 0) { fail(`${k} has no recordings, only a synth fallback`); continue; }
    const n = parseInt(decl.slice(at + call.length), 10);
    if (!(n > 0)) { fail(`${k} asks for ${n} takes`); continue; }
    for (let i = 1; i <= n; i++) {
      const f = `C:/Users/jake/code/eastcoins/v3/assets/sfx/${k}${i}.wav`;
      if (!fs.existsSync(f)) fail(`${k} asks for ${n} takes but ${k}${i}.wav is not there - takes(name, n) always requests 1..n`);
    }
  }
  if (!/SFX\.play\("caught"\)/.test(P)) fail("being caught does not play its own sound");
  if (!/SFX\.play\("steal"\)/.test(P)) fail("a successful lift does not play its own sound");
  /* the people who actually move, as opposed to the marks, which cannot */
  const npcs = G.SCENES.guild.npcs || [];
  if (npcs.length < 3) fail(`only ${npcs.length} npcs in the guild - the rooms read as empty between picks`);
  if (!npcs.every((n) => n.level)) fail("an npc has no `level`, so it shuffles on the spot instead of walking the room");
  const gb = G.SCENES.guild.build();
  for (const n of npcs) if (gb.g[n.y]?.[n.x] !== "i") fail(`${n.name} stands on a ${gb.g[n.y]?.[n.x]} tile, not floor`);
  if (new Set(npcs.map((n) => G.guildRoom(n.x))).size !== 4) fail("the npcs are not spread one to a room");
  /* and the walls have to be DRAWN, not merely present - paintRoom floors the whole room rectangle */
  if (!/INTERNAL WALLS/.test(P)) fail("paintRoom does not draw internal walls, so the dividers are invisible floor");
  ok(`steal and caught are recorded and wired; ${npcs.length} npcs walk the rooms; internal walls are drawn`);
}

/* ---------------------------------------------------------------- CAN A PLAYER ACTUALLY GET THERE
   The guild door was placed at 20,23 in the Yard, which is the far side of the pond. It existed, it drew, it was
   in OPEN, every other test passed - and no one could walk to it. Placing a thing on a map is not the same as
   putting it within reach, and the only honest check is a flood fill from where players actually start. */
{
  const b = G.SCENES[GUILD_HOME].build(), g = b.g;
  /* the walk starts from the edge the player arrives by, not from spawn: the guild is no longer in the start scene */
  const st = GUILD_HOME === "workyard" ? G.START : { x: G.COLS - 1, y: 13 };
  const k = (x, y) => x + "," + y, seen = new Set([k(st.x, st.y)]), q = [[st.x, st.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= G.COLS || ny >= G.ROWS || seen.has(k(nx, ny)) || !G.walkableIn(g, nx, ny)) continue;
      seen.add(k(nx, ny)); q.push([nx, ny]);
    }
  }
  const door = b.objs.find((o) => o.enter === "guild");
  if (!door) fail(`there is no guild door in ${GUILD_HOME}`);
  else if (![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has(k(door.x + dx, door.y + dy))))
    fail(`the guild door at ${door.x},${door.y} in ${GUILD_HOME} has no reachable tile beside it - nobody can walk to it`);
  /* and the man who sells the way in has to be reachable too, and near the door he is selling */
  const vance = (G.SCENES[GUILD_HOME].npcs || []).find((n) => n.opens === "permit");
  if (!vance) fail(`nobody in ${GUILD_HOME} sells a permit - SHOP.sells is unreachable, so there would be no way in but the Crypt`);
  else {
    if (!seen.has(k(vance.x, vance.y))) fail(`${vance.name} stands at ${vance.x},${vance.y}, where no player can reach him`);
    if (door && Math.max(Math.abs(vance.x - door.x), Math.abs(vance.y - door.y)) > 6) fail(`${vance.name} is nowhere near the door he sells for`);
    if (!(vance.lines || []).some((l) => /crypt/i.test(l))) fail("Vance never mentions that permits also drop in the Crypt");
    if (!(vance.lines || []).some((l) => /50,000|fifty thousand/i.test(l))) fail("Vance never says the price");
  }
  /* (2026-09-23) AND NOT BURIED. Reachable is not the same as visible: the Yard's south edge is forest three
     deep, so the door and Vance came out inside a canopy with his nameplate behind a tree. Trees draw from their
     base upward, so the row BEHIND a thing hides it too - hence counting a box rather than the tile itself. */
  const scen = b.objs.filter((o) => ["tree", "bush", "boulder"].includes(o.t));
  const around = (x, y, r) => scen.filter((o) => Math.abs(o.x - x) <= r && Math.abs(o.y - y) <= r).length;
  if (door && around(door.x, door.y, 2) > 3) fail(`${around(door.x, door.y, 2)} bits of scenery within two tiles of the guild door - it is buried`);
  if (vance && around(vance.x, vance.y, 2) > 3) fail(`${around(vance.x, vance.y, 2)} bits of scenery within two tiles of Vance - he is buried`);
  ok(`the guild door is reachable on foot, the man who sells the permit stands beside it, and neither is buried in trees`);
}

/* ---------------------------------------------------------------- the art exists and the game is allowed to use it */
{
  const P = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  const has = (f) => fs.existsSync("C:/Users/jake/code/eastcoins/v3/assets/img/glad/" + f);
  const icons = ["thieves_permit", "brass_button", "pocket_watch", "stolen_signet", "blackmarket_ledger",
    "whetgrit", "quench_salts", "seal_wax", "temper", "flux", "masters_seal"];
  for (const k of icons) {
    if (!has(`flat/items/${k}.png`)) fail(`items/${k}.png is missing`);
    /* ITEM_ART is an ALLOWLIST: a file that is not named there is never looked for and the item keeps its emoji. */
    if (!P.includes(`"${k}"`)) fail(`${k} is not in ITEM_ART, so its icon will never be drawn`);
  }
  for (const a of ["pete", "marla", "quietman", "odile", "vance"])
    for (const d of ["south", "east"]) if (!has(`flat/${a}_${d}.png`)) fail(`${a}_${d}.png is missing`);
  if (!has("flat/t_guild.png")) fail("the guild floor tile is missing");
  if (!/def\.floor === "guild" && IMG\.t_guild/.test(P)) fail("nothing draws the guild floor, so it falls through to bare boards");
  for (const n of G.SCENES.guild.npcs) if (!n.art) fail(`${n.name} has no art and will be drawn as a generic figure`);
  ok(`${icons.length} item icons, 5 npcs with both facings, and a floor tile - all present and all reachable by the code`);
}

/* ---------------------------------------------------------------- THE DITCHED SET compensates, it does not nerf
   The owner found the curve long and asked for gear rather than a nerf, which is a real constraint: an UNGEARED
   thief must be exactly as fast as before, and a geared one meaningfully faster. Half the gain is the set and
   half is that the pick now respects fx.speed at all - it was the one skill in the game ignoring it. */
{
  const HOP = 0.9, stun = (G.THIEF.stun[0] + G.THIEF.stun[1]) / 2000, STEP = 3, tops = [...G.THIEF.rooms.slice(1), 99];
  const climb = (steal, speed) => {
    let h = 0;
    for (const [i, key] of G.GUILD_ORDER.entries()) {
      const m = G.MARKS[key];
      for (let l = G.THIEF.rooms[i]; l < tops[i]; l += STEP) {
        const to = Math.min(tops[i], l + STEP);
        const p = G.pickChance({ xp: { thieving: G.XP_AT[l] } }, m.lvl, steal);
        const picks = (3600 / (G.THIEF.ms / 1000 / (1 + speed) + p * HOP + (1 - p) * stun)) * p;
        h += (G.XP_AT[to] - G.XP_AT[l]) / (picks * m.xp);
      }
    }
    return h;
  };
  const c = G.freshChar();
  for (const k of G.DITCHED) { if (!G.ITEMS[k]) { fail(`${k} is not an item`); continue; } c.eq[G.ITEMS[k].slot] = k; }
  const fx = G.fxOf(c);
  if (Math.abs(fx.steal - 0.10) > 1e-9) fail(`a full set gives ${fx.steal} steal, not 0.10`);
  if (Math.abs(fx.speed - 0.12) > 1e-9) fail(`a full set gives ${fx.speed} speed, not 0.12`);
  if (fx.steal > G.OUT_CAP.steal || fx.speed > G.OUT_CAP.speed) fail("the set alone reaches the effect caps, leaving nothing for anything else");
  if (new Set(G.DITCHED.map((k) => G.ITEMS[k].slot)).size !== G.DITCHED.length) fail("two pieces of the set want the same slot");

  const bare = climb(0, 0), geared = climb(fx.steal, fx.speed);
  /* (2026-09-24) A BAND, NOT A NUMBER. This pinned the ungeared climb to 90 hours, which was right while the only
     question was "does the gear nerf anybody" - and wrong the moment the owner deliberately moved mark xp. What
     must stay true is that an ungeared thief sits between the quickest gathering skill and combat. */
  if (bare < 50 || bare > 110) fail(`an ungeared thief takes ${Math.round(bare)} hours; fishing is 36 and combat 149, so this belongs between them`);
  if (geared >= bare) fail("the set makes no difference at all");
  const saved = (bare - geared) / bare;
  if (saved < 0.10) fail(`the full set saves only ${(saved * 100).toFixed(0)}% - not worth an evening of fishing`);
  if (saved > 0.35) fail(`the full set saves ${(saved * 100).toFixed(0)}% - that is a nerf to everyone without it`);
  /* the ceiling must still be a ceiling */
  if (G.pickChance({ xp: { thieving: G.XP_AT[99] } }, 1, G.OUT_CAP.steal) > G.THIEF.cap + 1e-9) fail("gear lets the pick chance run past its cap");
  console.log(`     ungeared ${Math.round(bare)} hours -> fully kitted ${Math.round(geared)} (${(saved * 100).toFixed(0)}% off; woodcutting is 73)`);
  ok("the set compensates without nerfing anybody, and the 90% ceiling still holds");
}

/* ---------------------------------------------------------------- it comes out of the water, and the wiring is there */
{
  const W = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
  if (!/G\.DITCHED_ODDS/.test(W)) fail("nothing drops the set, so it cannot be got at all");
  if (!/G\.pickChance\(C, M\.lvl, fxT\.steal\)/.test(W)) fail("the pick ignores the gear's steal bonus");
  if (!/G\.THIEF\.ms \/ \(1 \+ fxT\.speed\)/.test(W)) fail("the pick still ignores fx.speed - the one skill in the game that did");
  const P = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  for (const k of G.DITCHED) {
    if (!fs.existsSync(`C:/Users/jake/code/eastcoins/v3/assets/img/glad/flat/items/${k}.png`)) fail(`${k} has no icon`);
    if (!P.includes(`"${k}"`)) fail(`${k} is not in ITEM_ART, so its icon will never be drawn`);
  }
  ok("fishing turns it up, the pick reads it, and every piece has an icon the game is allowed to use");
}

console.log(bad ? `\n${bad} problem(s)` : "\nthieving holds together");
process.exitCode = bad ? 1 : 0;

#!/usr/bin/env node
/* ============================================================
   EastScape content check — run before every deploy.

     node tools/eastscape-content-check.mjs

   Asserts that the world is internally consistent: every drop, shop
   row, recipe, crop and quest reward is a real item; every mob has a
   size and a picture; every exit leads somewhere that leads back;
   every quest has a giver who offers it; every art file the page asks
   for exists on disk.

   None of this is checkable by playing — a missing drop key is one
   silent monster that pays nothing, and a one-way exit is a room
   somebody gets stuck in. Exits with 1, warnings with 0.
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { lists as packLists } from "./eastscape-pack.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // the closed areas' maps are their own file since 2026-09-21: these tools still look at every scene

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "eastscape.html"), "utf8");

let errors = 0, warns = 0;
const bad = (what, detail) => { errors++; console.log(`  ERROR  ${what}${detail ? " — " + detail : ""}`); };
const warn = (what, detail) => { warns++; console.log(`   warn  ${what}${detail ? " — " + detail : ""}`); };
const head = (t) => console.log(`\n${t}`);

/* the page's art manifests, read out of the page itself so the two cannot drift */
function listFromHtml(name) {
  const m = html.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n?\\];)`)) || html.match(new RegExp(`const ${name} = (new Set\\(\\[[\\s\\S]*?\\]\\))`));
  if (!m) { bad(`could not read ${name} out of eastscape.html`); return []; }
  try { return [...eval(m[1].replace(/;$/, ""))]; } catch (e) { bad(`could not evaluate ${name}`, e.message); return []; }
}
/* ART_FILES spreads CROP_ART (one entry per crop, four stages), so it is no longer a self-contained literal.
   tools/eastscape-pack.mjs is the one place that knows how to resolve the page's art manifests — it derives the
   crop half from what is on disk — and this asks it rather than keeping a fourth copy of the same eval. */
const ART_FILES = (() => { try { return packLists().ART_FILES; } catch (e) { bad("could not read ART_FILES", e.message); return []; } })();
const ITEM_ART = listFromHtml("ITEM_ART");
// an NPC's picture comes from its `art` field, or failing that from NPC_ART by name
const NPC_ART = (() => {
  const m = html.match(/const NPC_ART = (\{[\s\S]*?\});/);
  if (!m) { bad("could not read NPC_ART out of eastscape.html"); return {}; }
  try { return eval(`(${m[1]})`); } catch (e) { bad("could not evaluate NPC_ART", e.message); return {}; }
})();
const artDir = join(ROOT, "v3/assets/img/glad/flat");
const itemDir = join(artDir, "items");

head("art files the page asks for");
{
  const missing = ART_FILES.filter((f) => !existsSync(join(artDir, `${f}.png`)));
  for (const f of missing) bad(`no art file`, `v3/assets/img/glad/flat/${f}.png (listed in ART_FILES)`);
  if (!missing.length) console.log(`  ok  all ${ART_FILES.length} scene/character files present`);
  const missingItems = ITEM_ART.filter((f) => !existsSync(join(itemDir, `${f}.png`)));
  for (const f of missingItems) bad(`no item icon`, `items/${f}.png (listed in ITEM_ART)`);
  if (!missingItems.length) console.log(`  ok  all ${ITEM_ART.length} item icons present`);
}

head("items");
{
  for (const [k, it] of Object.entries(G.ITEMS)) {
    if (!it.name) bad(`item "${k}" has no name`);
    if (!ITEM_ART.includes(k) && !it.icon) bad(`item "${k}" has neither an icon nor art`);
    if (it.slot && !G.SLOTS.includes(it.slot)) bad(`item "${k}" wears slot "${it.slot}"`, `not one of ${G.SLOTS.join(", ")}`);
    if (it.req?.skill && !G.SKILLS[it.req.skill]) bad(`item "${k}" requires skill "${it.req.skill}"`, "no such skill");
    if (it.tool && !G.SKILLS[it.tool]) bad(`item "${k}" is a tool for "${it.tool}"`, "no such skill");
  }
  for (const [from, to] of Object.entries(G.ITEM_ALIASES)) {
    if (!G.ITEMS[to] && !G.ITEM_ALIASES[to]) bad(`ITEM_ALIASES "${from}" points at "${to}"`, "which is not an item");
    if (G.ITEMS[from]) bad(`ITEM_ALIASES renames "${from}"`, "but an item still uses that key — the alias will never fire");
  }
  console.log(`  checked ${Object.keys(G.ITEMS).length} items, ${Object.keys(G.ITEM_ALIASES).length} aliases`);
}

head("monsters");
{
  const obtainable = new Set();
  for (const [k, m] of Object.entries(G.MOBS)) {
    if (!m.size) bad(`mob "${k}" has no size`, `one of ${Object.keys(G.MOB_SIZES).join(", ")}`);
    else if (!G.MOB_SIZES[m.size]) bad(`mob "${k}" has size "${m.size}"`, "not a real size");
    if (!ART_FILES.includes(k)) bad(`mob "${k}" has no picture`, `expected "${k}" in ART_FILES`);
    if (!Array.isArray(m.drops)) { bad(`mob "${k}" has no drops array`); continue; }
    for (const d of m.drops) {
      const [item, n, chance] = d;
      if (!G.ITEMS[item]) bad(`mob "${k}" drops "${item}"`, "no such item");
      else obtainable.add(item);
      if (chance != null && (chance <= 0 || chance > 1)) bad(`mob "${k}" drops "${item}" at chance ${chance}`, "should be between 0 and 1");
      const qty = Array.isArray(n) ? n : [n, n];
      if (!(qty[0] >= 1) || qty[1] < qty[0]) bad(`mob "${k}" drops a bad quantity for "${item}"`, JSON.stringify(n));
    }
    /* (2026-09-22) A RARE DROP IS A WAY TO GET A THING. Only m.drops counted, so every item that exists solely as a
       rare roll — the grudge knife, the wraith hood, the ring of mild menace, and now the Junk King's two — was
       reported as unobtainable. The check for "nothing gives you this" is only useful if it knows every way. */
    for (const [item] of m.rare || []) { if (!G.ITEMS[item]) bad(`mob "${k}" rarely drops "${item}"`, "no such item"); else obtainable.add(item); }
    if (!(m.hp > 0)) bad(`mob "${k}" has no hp`);
    if (!(m.lvl > 0)) warn(`mob "${k}" has no level`);
  }
  /* A MONSTER WITHOUT A BOUNTY IS HALF A MONSTER (2026-09-24, reported by the owner: "lucky clover kills arent
     counting in the golden sands"). killFinds() opens with `if (!G.BOUNTY[mob]) return`, so a monster missing
     from that table silently gives NO rare roll, NO casino find and NO luck spent - a clover burns nothing and
     the player has no way to tell. BOUNTY is also what REBUILDS the monster's ticket drop, so an absent entry
     means its pay was hand-written and never measured.

     The nine below are a PRE-EXISTING gap in the Vault and the Trailer Park, not news: they are listed so this
     rule fails on the NEXT map's monsters rather than on the ones already out there, because giving them
     bounties would rewrite their ticket drops and that is a balance decision rather than a fix. See the backlog. */
  const NO_BOUNTY_OK = new Set(["warden", "pitboss", "hoard", "dealer", "junkdog", "possum", "scrapper", "gator", "junkking"]);
  const spawned = new Set();
  for (const sc of Object.values(G.SCENES)) for (const m of sc.mobs || []) spawned.add(m[0]);
  for (const t of [...spawned].sort()) {
    if (G.BOUNTY[t] !== undefined || NO_BOUNTY_OK.has(t) || G.MOBS[t]?.boss) continue;
    bad(`monster "${t}" (${G.MOBS[t]?.name || "?"}) is spawned on a map but has no BOUNTY entry — no rare drops, no casino finds, and a Lucky clover will not count its kills. Measure it with tools/eastscape-balance.mjs (want$/kill, doubled: the literals are pre-TIX_RATE).`);
  }
  console.log(`  checked ${Object.keys(G.MOBS).length} monsters, ${spawned.size} of them spawned on a map`);
  global.__dropped = obtainable;
}

head("the shop");
{
  for (const [k, price] of G.SHOP.sells) {
    if (!G.ITEMS[k]) bad(`the shop sells "${k}"`, "no such item");
    if (!(price > 0)) bad(`the shop sells "${k}" for ${price}`);
  }
  for (const [k, price] of Object.entries(G.SHOP.buys)) {
    if (!G.ITEMS[k]) bad(`the shop buys "${k}"`, "no such item");
    if (!(price > 0)) bad(`the shop buys "${k}" for ${price}`);
  }
  // buying back for more than it sells for is a money printer
  const sells = new Map(G.SHOP.sells);
  for (const [k, buy] of Object.entries(G.SHOP.buys)) {
    const sell = sells.get(k);
    if (sell != null && buy >= sell) bad(`the shop buys "${k}" for ${buy} and sells it for ${sell}`, "buy low, sell high, forever — this mints Cash");
  }
  console.log(`  checked ${G.SHOP.sells.length} for sale, ${Object.keys(G.SHOP.buys).length} bought`);
}

head("cooking and crops");
{
  for (const [raw, r] of Object.entries(G.COOK)) {
    if (!G.ITEMS[raw]) bad(`the recipe for "${raw}"`, "no such raw item");
    if (!G.ITEMS[r.to]) bad(`cooking "${raw}" makes "${r.to}"`, "no such item");
    else if (!G.ITEMS[r.to].heal) warn(`cooked "${r.to}" heals nothing`);
    if (!(r.lvl >= 1)) bad(`the recipe for "${raw}" has no level`);
    if (!(r.xp > 0)) bad(`the recipe for "${raw}" gives no xp`);
  }
  /* (2026-09-22) RAW MEAT IS A TYPED LIST, so it is checked. Everything with a cooked twin is treated as raw FISH
     unless it is in G.RAW_MEAT — not eatable, not sellable, not loot. That is right for a fish and wrong for a
     steak, and the first version of the rule caught beef, chicken and pork by accident and quietly took a cow's
     drop out of the loot table. So: anything flagged raw must actually be caught at a fishing spot somewhere in
     the game, and anything listed as meat must NOT be. */
  {
    const caught = new Set();
    for (const key of Object.keys(G.SCENES)) { let b; try { b = G.buildScene(key); } catch { continue; } for (const o of b.objs || []) { if (o.fish) caught.add(o.fish); if (o.fish2) caught.add(o.fish2); } }
    const CLOSED_WATER = new Set(["mooncarp", "gloomfin"]);   // real fish, but their ponds are in maps that are shut today
    for (const k of Object.keys(G.ITEMS)) {
      if (G.ITEMS[k].raw && !caught.has(k) && !CLOSED_WATER.has(k)) bad(`"${k}" is treated as raw fish`, "but nothing catches it — add it to RAW_MEAT in the rules if it is meat");
      if (G.RAW_MEAT.has(k) && caught.has(k)) bad(`"${k}" is listed as RAW_MEAT`, "but it is caught at a fishing spot");
    }
  }
  for (const [k, c] of Object.entries(G.CROPS)) {
    if (!G.ITEMS[k]) bad(`crop "${k}"`, "no such item");
    if (!(c.yield?.[0] >= 1)) bad(`crop "${k}" yields nothing`);
    if (!(c.ms > 0)) bad(`crop "${k}" never grows`);
  }
  console.log(`  checked ${Object.keys(G.COOK).length} recipes, ${Object.keys(G.CROPS).length} crops`);
}

head("recipes");
{
  const stations = new Set(Object.keys(G.STATIONS));
  for (const [id, r] of Object.entries(G.RECIPES)) {
    if (!G.SKILLS[r.skill]) bad(`recipe "${id}" trains "${r.skill}"`, "no such skill");
    if (!stations.has(r.station)) bad(`recipe "${id}" is made at "${r.station}"`, `not one of ${[...stations].join(", ")}`);
    if (G.STATIONS[r.station] && G.STATIONS[r.station].skill !== r.skill) bad(`recipe "${id}" trains ${r.skill} at a ${r.station}`, `which is a ${G.STATIONS[r.station].skill} station`);
    for (const [k, n] of r.in || []) { if (!G.ITEMS[k]) bad(`recipe "${id}" needs "${k}"`, "no such item"); if (!(n >= 1)) bad(`recipe "${id}" needs a bad amount of "${k}"`, String(n)); }
    if (!G.ITEMS[r.out?.[0]]) bad(`recipe "${id}" makes "${r.out?.[0]}"`, "no such item");
    if (!(r.lvl >= 1)) bad(`recipe "${id}" has no level`);
    if (!(r.xp > 0)) bad(`recipe "${id}" gives no xp`);
    if ((r.in || []).some(([k]) => k === r.out?.[0])) bad(`recipe "${id}" makes what it consumes`, "an infinite loop");
  }
  // a station nothing can be made at is a thing players will click forever
  for (const st of stations) if (!G.recipesAt(st).length) bad(`the ${st} has no recipes`);
  // and a station that exists in no map cannot be used at all
  const placed = new Set();
  for (const def of Object.values(G.SCENES)) { try { for (const o of def.build?.().objs || []) placed.add(o.t); } catch (e) { /* island scenes need args */ } }
  for (const st of stations) if (!placed.has(st)) warn(`the ${st} is in no map`, "its recipes cannot be reached");
  console.log(`  checked ${Object.keys(G.RECIPES).length} recipes across ${stations.size} stations`);
}

head("quests");
{
  const npcNames = new Set(), npcQuests = new Set();
  /* EVERY FISHING SPOT CAN BE FISHED (2026-09-21: v105 scattered the spots into the water's second row, which is one tile further than a
     rod reached, and nothing caught it). From every walkable tile that touches the scene's path or an exit, flood the walkable ground;
     a spot is good if some flooded tile is within the rod's reach of it. */
  { let okSpots = 0; for (const key of Object.keys(G.SCENES)) { let b; try { b = G.buildScene(key); } catch (e) { continue; } const spots = b.objs.filter((o) => o.t === "spot"); if (!spots.length) continue;
      const seen = new Set(), q = []; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if ((b.g[y][x] === "," || b.g[y][x] === "e") && !seen.has(y * 100 + x)) { seen.add(y * 100 + x); q.push([x, y]); }
      if (!q.length) for (let y = 0; y < G.ROWS && !q.length; y++) for (let x = 0; x < G.COLS && !q.length; x++) if (G.walkableIn(b.g, x, y)) { seen.add(y * 100 + x); q.push([x, y]); }
      while (q.length) { const [x, y] = q.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (G.walkableIn(b.g, X, Y) && !seen.has(Y * 100 + X)) { seen.add(Y * 100 + X); q.push([X, Y]); } } }
      const R = G.reachOf("spot"); for (const o of spots) { let ok = false; for (let dy = -R; dy <= R && !ok; dy++) for (let dx = -R; dx <= R && !ok; dx++) if ((dx || dy) && seen.has((o.y + dy) * 100 + o.x + dx)) ok = true; if (ok) okSpots++; else bad(`fishing spot at ${o.x},${o.y} in ${key}`, `nowhere to stand within ${R} tiles of it`); } }
    console.log(`  ok  ${okSpots} fishing spots can each be reached`); }
  for (const [key, def] of Object.entries(G.SCENES)) for (const n of def.npcs || []) {
    npcNames.add(n.name);
    for (const q of n.quests || []) { npcQuests.add(q); if (!G.QUESTS[q]) bad(`NPC "${n.name}" in ${key} offers quest "${q}"`, "no such quest"); }
  }
  for (const [k, q] of Object.entries(G.QUESTS)) {
    if (!q.name) bad(`quest "${k}" has no name`);
    if (!npcQuests.has(k)) bad(`quest "${k}" ("${q.name}") is offered by nobody`, "no NPC lists it");
    if (q.giver && !npcNames.has(q.giver)) bad(`quest "${k}" names giver "${q.giver}"`, `no NPC by that name (have: ${[...npcNames].join(", ")})`);
    const goal = q.goal || {};
    if (goal.type === "bring") for (const it of goal.items || []) { if (!G.ITEMS[it]) bad(`quest "${k}" asks for "${it}"`, "no such item"); }
    if (goal.type === "kill" && !G.MOBS[goal.mob]) bad(`quest "${k}" asks you to kill "${goal.mob}"`, "no such monster");
    if (!(goal.n >= 1)) bad(`quest "${k}" has no goal count`);
    for (const [it] of q.reward?.items || []) if (!G.ITEMS[it]) bad(`quest "${k}" rewards "${it}"`, "no such item");
    for (const sk of Object.keys(q.reward?.xp || {})) if (!G.SKILLS[sk]) bad(`quest "${k}" rewards "${sk}" xp`, "no such skill");
    if (!q.reward?.coins && !q.reward?.xp && !q.reward?.items) warn(`quest "${k}" rewards nothing`);
  }
  console.log(`  checked ${Object.keys(G.QUESTS).length} quests across ${npcNames.size} NPCs`);
}

head("the map");
{
  const OPP = { n: "s", s: "n", e: "w", w: "e" };
  for (const [key, def] of Object.entries(G.SCENES)) {
    if (!def.name) bad(`scene "${key}" has no name`);
    for (const [dir, to] of Object.entries(def.exits || {})) {
      if (!G.SCENES[to]) { bad(`${key} exits ${dir} to "${to}"`, "no such scene"); continue; }
      const back = G.SCENES[to].exits?.[OPP[dir]];
      // interiors and one-way drops (the Wilderness pit) are exempt: they are entered by an object, not an edge
      if (back !== key && !G.SCENES[to].interior && !def.interior) warn(`${key} exits ${dir} to ${to}, but ${to} does not exit ${OPP[dir]} back`, back ? `it goes to ${back}` : "it has no exit that way");
    }
    for (const m of def.mobs || []) { const [t] = m; if (!G.MOBS[t]) bad(`scene "${key}" places a "${t}"`, "no such monster"); }
    for (const n of def.npcs || []) {
      const art = n.art || NPC_ART[n.name];
      /* (v99) an NPC may wear a made LOOK instead of art (Yahsmeena on the islands): fine if the eight numbers are a real look */
      if (!art && n.look) { if (!G.normLook(n.look)) bad(`NPC "${n.name}" in ${key} has a look that is not a look`, JSON.stringify(n.look)); continue; }
      if (!art) bad(`NPC "${n.name}" in ${key} has no picture`, "no `art` field and no NPC_ART entry — they will render as a blank");
      else for (const face of ["south", "east"]) if (!ART_FILES.includes(`${art}_${face}`)) bad(`NPC "${n.name}" in ${key} uses art "${art}"`, `no ${art}_${face} in ART_FILES`);
    }
    for (const b of def.bots || []) if (b.art && !ART_FILES.includes(`${b.art}_south`)) bad(`bot "${b.name}" in ${key} uses art "${b.art}"`, `no ${b.art}_south in ART_FILES`);
  }
  // every scene should be reachable from the start
  const seen = new Set([G.START.scene]), q = [G.START.scene];
  while (q.length) { const k = q.pop(); for (const to of Object.values(G.SCENES[k]?.exits || {})) if (!seen.has(to)) { seen.add(to); q.push(to); } for (const o of (G.SCENES[k]?.build ? [] : [])) void o; }
  const unreachable = Object.keys(G.SCENES).filter((k) => !seen.has(k));
  if (unreachable.length) warn(`not reachable by edge exits from ${G.START.scene}`, `${unreachable.join(", ")} — fine if they are entered by a door, pit, ferry or island`);
  console.log(`  checked ${Object.keys(G.SCENES).length} scenes`);
}

head("dead inventory");
{
  // an item nothing drops, nothing sells and no quest gives is an item nobody can get
  const dropped = global.__dropped || new Set();
  const sold = new Set(G.SHOP.sells.map(([k]) => k));
  const cooked = new Set(Object.values(G.COOK).map((r) => r.to));
  const crops = new Set(Object.keys(G.CROPS));
  const quested = new Set(Object.values(G.QUESTS).flatMap((q) => (q.reward?.items || []).map(([k]) => k)));
  const made = new Set(Object.values(G.RECIPES).map((r) => r.out[0]));
  const start = new Set([...G.freshChar().inv.map((s) => s.k), ...Object.values(G.freshChar().eq).filter(Boolean)]);
  const gatherable = new Set(["logs", "yewlogs", "ashlogs", "copper", "tin", "grimstone", "marble", "stardust", "olives", "sunolive", "wheat", "tomatoe", "goldtomatoe", "sardine", "trout", "mooncarp", "gloomfin", "geode", "burnt", "coins",
    "agilmark",   // (2026-09-22) scattered on the agility course by the server at the start of each run, which no table here can see
    "catalytic", "slagstone", "pinelogs", "bogwoodlogs", "mudcat", "bowfin"]);   // the Trailer Park's, all cut, mined, chopped or caught out of its scene
  for (const k of Object.keys(G.ITEMS)) {
    if (dropped.has(k) || sold.has(k) || cooked.has(k) || crops.has(k) || quested.has(k) || start.has(k) || gatherable.has(k) || made.has(k)) continue;
    warn(`item "${k}" (${G.ITEMS[k].name})`, "nothing drops, sells, cooks, grows or rewards it — check it is gatherable");
  }
  // and anything you can get but cannot sell is a dead end in the bag
  const rawForCooking = new Set(Object.keys(G.COOK));   // raw meat and fish exist to be cooked; the cooked one is what sells
  const usedInARecipe = new Set(Object.values(G.RECIPES).flatMap((r) => r.in.map(([k]) => k)));
  for (const k of [...dropped, ...cooked, ...crops, ...made]) {
    if (k in G.SHOP.buys || k === "coins" || G.ITEMS[k]?.heal || G.ITEMS[k]?.slot || rawForCooking.has(k) || usedInARecipe.has(k)) continue;
    warn(`item "${k}" can be obtained but the shop will not buy it`, "and it neither heals, is worn, nor cooks into something");
  }
}

// the size budget rides along, so one command checks both the content and the weight
{
  const { spawnSync } = await import("child_process");
  const { fileURLToPath } = await import("url");
  console.log("");
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./eastscape-budget.mjs", import.meta.url))], { stdio: "inherit" });
  if (r.status) errors++;
}

/* ONE RATE FOR EVERY NAMED RARE (2026-09-23). raresOf applies RARE_RATE, so this cannot drift by someone editing
   a number in LOOT - but it CAN drift if somebody adds a second path that builds a rare line, which is exactly how
   LOOT itself came to silently overwrite the MOBS literals. Checked against what raresOf actually returns, with
   the two deliberate exceptions named rather than assumed: ZCoins climb with level, casino finds with bounty. */
{
  const find = new Set(G.FINDS.map((f) => f[0]));
  let n = 0;
  for (const t of Object.keys(G.MOBS)) for (const [k, p] of G.raresOf(t)) {
    if (k === "zcoin" || find.has(k)) continue;
    n++;
    if (Math.abs(p - G.RARE_RATE) > 1e-9) bad(`${G.MOBS[t].name} drops ${k} at ${(p * 100).toFixed(2)}%`, `every named rare is RARE_RATE (${G.RARE_RATE * 100}%)`);
  }
  for (const t of Object.keys(G.MOBS)) if (G.raresOf(t).reduce((a, [, p]) => a + p, 0) >= 1)
    bad(`${G.MOBS[t].name}'s rare chances add to 100% or more`, "rollRare walks them in order, so the tail would never drop");
  console.log(`
rare drops`);
  console.log(`  ok  all ${n} named rares at ${G.RARE_RATE * 100}%, and no monster's line reaches 100%`);
}

/* AN OBJECT'S id IS ITS INDEX (2026-09-23). A click sends ob.id and the server reads S.objs[m.ob], so the two
   must mean the same thing. buildScene stamps id = i over the whole array, but anything PUSHED afterwards --
   decor was, and carried a hand-set 5000 + n -- breaks that silently: the action resolves to undefined and is
   dropped without a message. It cost the bank chest a day of looking fine and doing nothing. */
{
  const { createDecorRules } = await import("../v3/assets/js/eastscape-decor-rules.js");
  const DR = createDecorRules(G);
  const piece = Object.keys(DR.DECOR).find((k) => DR.DECOR[k].in === "isle");
  const isle = { tier: 1, plots: Array(8).fill(null), shelf: Array(6).fill(null), theme: "meadow", themes: ["meadow"], open: true,
    owned: { [piece]: 1 }, decor: [{ k: piece, x: 6, y: 3, at: "isle" }] };
  let n = 0, wrong = 0;
  for (const key of [...G.OPEN, "isle"]) {
    const sc = G.SCENES[key]; if (!sc?.build) continue;
    let b; try { b = G.isIsle(key) ? DR.decorInto(key, G.buildScene(key), isle) : G.buildScene(key); } catch { continue; }
    (b.objs || []).forEach((o, i) => { n++; if (o.id !== i) { wrong++; bad(`${key}: object ${i} (${o.t}) has id ${o.id}`, "a click sends ob.id and the server reads S.objs[that], so id must BE the index"); } });
  }
  if (!wrong) console.log(`
scene objects
  ok  all ${n} objects (decor included) have id === index`);
}

/* THE ARMOUR LADDER HAS TO CLIMB. `set` goes up 14 a tier and boots and gloves take 0.06 of it, so consecutive
   tiers differ by 0.84 and Math.round put onyx and starfall on the same 5 - two whole tiers of upgrade that gave
   nothing in two slots. It is arithmetic, so it will happen again to any small-share slot the day a tier is
   added; the generator forces each rung above the last and this insists it worked. */
{
  const slots = [...new Set(Object.values(G.ITEMS).map((it) => it.slot).filter(Boolean))].filter((sl) => sl !== "pet" && sl !== "weapon");
  let n = 0, flat = 0;
  for (const sl of slots) {
    for (let i = 1; i < G.TIERS.length; i++) {
      const a = G.ITEMS[G.TIERS[i - 1].key + "_" + sl], b = G.ITEMS[G.TIERS[i].key + "_" + sl];
      if (!a || !b) continue;
      n++;
      if ((b.def | 0) <= (a.def | 0)) { flat++; bad(sl + ": " + G.TIERS[i].key + " has " + b.def + " defence and " + G.TIERS[i - 1].key + " has " + a.def + " - upgrading a tier gains nothing", "a rung that does not beat the one below"); }
    }
  }
  if (!flat) console.log("\narmour ladder\n  ok  all " + n + " tier steps across " + slots.length + " slots gain defence");
}

/* ---------------------------------------------------------------- EVERY PET CAN ACTUALLY BE SEEN
   (2026-09-24, the owner: "the coilings icon is missing in the drop list") The Coilling was in PETS, had a
   picture on disk, and was in NEITHER of the two lists the page loads art from — so its icon drew an empty box
   in the Pyramid's chest, AND an equipped one would have walked around invisible. Nothing else noticed: a pet
   is not an item and not a scene object, so neither the item checks nor artreach covered it. A pet needs three
   things to be visible and this is the only place that says so. */
{
  head("pets");
  const listOf = (n) => (html.match(new RegExp(`const ${n} = \\[[\\s\\S]*?\\];`)) || [""])[0];
  const AF = listOf("ART_FILES"), CA = listOf("CASINO_ART");
  let n = 0;
  for (const pt of Object.values(G.PETS)) {
    const on = (l) => new RegExp(`"${pt.art}"`).test(l);
    const miss = [!existsSync(join(ROOT, `v3/assets/img/glad/flat/${pt.art}.png`)) && "no picture on disk",
      !on(AF) && "not in ART_FILES", !on(CA) && "not in CASINO_ART"].filter(Boolean);
    if (miss.length) bad(`${pt.name} (${pt.art})`, miss.join(", ")); else n++;
  }
  if (n === Object.keys(G.PETS).length) console.log(`  ok  all ${n} pets have a picture, and both lists carry it`);

  /* AND A RAID PET IS NOT IN THE POOL A KILL ROLLS (2026-09-24, the owner, reading the wiki: "it says coilling
     drops in Where it drops ... but its only the great pyramid right"). It was not only the wiki: the roll
     picked out of PET_KEYS, every pet there is, so the Great Pyramid's reward was also falling off ordinary
     kills in the Boneyard and beyond. The flag, the pool and the page have to agree, and this is what says so. */
  const raid = Object.entries(G.PETS).filter(([, p]) => p.raid).map(([k]) => k);
  for (const k of raid) if (G.PET_DROP_KEYS.includes(k)) bad(`${G.PETS[k].name} is a raid pet`, "but a kill can still roll it — it is in PET_DROP_KEYS");
  for (const [k, p] of Object.entries(G.PETS)) if (!p.raid && !G.PET_DROP_KEYS.includes(k)) bad(`${p.name} drops from nowhere`, "not a raid pet, and not in PET_DROP_KEYS either");
  if (raid.length) console.log(`  ok  ${raid.length} raid pet${raid.length === 1 ? " is" : "s are"} out of the kill pool (${G.PET_DROP_KEYS.length} of ${G.PET_KEYS.length} can drop)`);
  /* and the hand-typed wiki page has to say so, because that page imports nothing and cannot compute it */
  const wiki = readFileSync(join(ROOT, "v3/assets/js/eastscape-wiki.js"), "utf8");
  for (const k of raid) {
    if (!wiki.includes(G.PETS[k].name)) bad(`the wiki's pets page never mentions ${G.PETS[k].name}`, "its table is typed by hand");
    else if (!/does not drop from a kill/i.test(wiki)) bad("the wiki's pets page lists a raid pet", "without saying it does not drop from a kill");
  }
  if (raid.length) console.log("  ok  the hand-typed wiki page names them and says they do not drop from kills");
}

console.log(`\n${errors} error${errors === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}\n`);
process.exit(errors ? 1 : 0);

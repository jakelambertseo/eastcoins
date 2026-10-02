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
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // the closed areas' maps are their own file since 2026-09-21: these tools still look at every scene
import fs from "node:fs";   /* (2026-09-25) the Wilderness gathering check reads index.js, which no other check here needed */

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

/* (2026-09-30) HELD CONTENT MAY WAIT FOR ITS ART. A map built but held shut (HOLD) ships in the rules while its pictures are still being drawn;
   nobody can reach it, so a monster that lives ONLY on held maps (or a daily boss whose map is held), and a pet that hatches only from them, is
   a warning here rather than an error until the map opens. The moment it opens (OPEN has the map) the same miss is an error again. */
const homesOf = (t) => Object.entries(G.SCENES).filter(([, d]) => (d.mobs || []).some(([x]) => x === t)).map(([k]) => k);
const heldMob = (t) => { const h = homesOf(t); return (h.length > 0 && h.every((k) => !G.OPEN.has(k))) || (t === "icewyrm" && G.WYRM && !G.OPEN.has(G.WYRM.scene)); };
const heldPet = (pt) => { const egg = pt.egg && G.EGGS[pt.egg], base = pt.base && G.PETS[pt.base];
  if (egg) return (egg.from || []).length > 0 && egg.from.every((k) => !G.OPEN.has(k));
  return base ? heldPet(base) : false; };
head("monsters");
{
  const obtainable = new Set();
  for (const [k, m] of Object.entries(G.MOBS)) {
    if (!m.size) bad(`mob "${k}" has no size`, `one of ${Object.keys(G.MOB_SIZES).join(", ")}`);
    else if (!G.MOB_SIZES[m.size]) bad(`mob "${k}" has size "${m.size}"`, "not a real size");
    if (!ART_FILES.includes(m.art || k)) (heldMob(k) ? warn : bad)(`mob "${k}" has no picture${heldMob(k) ? " (its map is held)" : ""}`, `expected "${m.art || k}" in ART_FILES`);   /* m.art: a twin drawn from another's picture (the Golden Raptor) */
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
    /* (2026-09-25) a recipe may make what it consumes when the loop COSTS something: the cauldron's feather brew turns three feathers, a vial and a sporecap into fifteen. What it must not be is free. */
    if ((r.in || []).some(([k]) => k === r.out?.[0]) && !(r.in || []).some(([k]) => k !== r.out?.[0])) bad(`recipe "${id}" makes what it consumes`, "an infinite loop");
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
    if (!Array.isArray(q.stages) || !q.stages.length) bad(`quest "${k}" has no stages`);
    if (q.tier && !G.QUEST_TIERS[q.tier]) bad(`quest "${k}" has tier "${q.tier}"`, "easy, medium or hard");
    if (q.handTo && !npcNames.has(q.handTo)) bad(`quest "${k}" hands in to "${q.handTo}"`, "no NPC by that name");
    for (const [i, s] of (q.stages || []).entries()) {
      const at = `quest "${k}" stage ${i + 1} (${s.type})`;
      if (!["talk", "bring", "kill", "gather", "visit"].includes(s.type)) bad(at, "unknown stage type");
      if (s.type === "talk" && !npcNames.has(s.npc)) bad(`${at} talks to "${s.npc}"`, "no NPC by that name");
      if (s.type === "bring") { for (const it of s.items || []) if (!G.ITEMS[it]) bad(`${at} asks for "${it}"`, "no such item"); if (s.to && !npcNames.has(s.to)) bad(`${at} brings to "${s.to}"`, "no NPC by that name"); }
      if (s.type === "gather") for (const it of s.items || []) if (!G.ITEMS[it]) bad(`${at} gathers "${it}"`, "no such item");
      if (s.type === "kill" && !G.MOBS[s.mob]) bad(`${at} kills "${s.mob}"`, "no such monster");
      if (s.type === "visit" && !G.SCENES[s.scene]) bad(`${at} visits "${s.scene}"`, "no such area");
      if (["bring", "kill", "gather"].includes(s.type) && !(s.n >= 1)) bad(at, "no count");
      for (const [it] of s.give || []) if (!G.ITEMS[it]) bad(`${at} gives "${it}"`, "no such item");
    }
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
  const quested = new Set(Object.values(G.QUESTS).flatMap((q) => [...(q.reward?.items || []).map(([k]) => k), ...(q.stages || []).flatMap((st) => (st.give || []).map(([k]) => k))]));   /* (2026-09-27) a stage may hand you a thing to carry */
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
  /* (2026-09-29) and every open map loads the pictures it stands on: a picture named in one area's list leaves core and vanishes
     from every other map (the Yard's barrels, the Boneyard's and Cloudreach's rocks) */
  console.log("\nart every map loads");
  const r2 = spawnSync(process.execPath, [fileURLToPath(new URL("./eastscape-art-reach.mjs", import.meta.url))], { stdio: "inherit" });
  if (r2.status) errors++;
}

/* ONE RATE FOR EVERY NAMED RARE (2026-09-23). raresOf applies RARE_RATE, so this cannot drift by someone editing
   a number in LOOT - but it CAN drift if somebody adds a second path that builds a rare line, which is exactly how
   LOOT itself came to silently overwrite the MOBS literals. Checked against what raresOf actually returns, with
   the two deliberate exceptions named rather than assumed: ZCoins climb with level, casino finds with bounty. */
{
  const find = new Set(G.FINDS.map((f) => f[0]));
  {
    const rates = new Set(Object.keys(G.MOBS).flatMap((t) => G.raresOf(t).filter(([k]) => k === "pot_double").map(([, p]) => p)));
    if (rates.size > 1) bad("the 2X potion drops at " + [...rates].join(" / "), "it is meant to be the same flat chance on every monster in the game");
    const r = [...rates][0];
    if (r != null && Math.abs(r - G.DOUBLE.drop) > 1e-12) bad("the 2X potion drops at " + r, "DOUBLE.drop says " + G.DOUBLE.drop);
    if (r != null && r > 0.001) bad("the 2X potion drops at " + (r * 100).toFixed(3) + "%", "it doubles the ticket supply for EVERYBODY, so past about 1 in 1,000 it stops being an event");
  }
  let n = 0;
  for (const t of Object.keys(G.MOBS)) for (const [k, p] of G.raresOf(t)) {
    /* (2026-09-25) pot_double joins zcoin as a GLOBAL flat drop rather than a monster's named rare: it is the
       same chance on a chicken and on the Junk King, which is most of what makes "it can come from anywhere"
       true. Exempted here for the same reason zcoin is - the rule below is about a monster's OWN rare table. */
    if (k === "zcoin" || k === "pot_double" || find.has(k)) continue;
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
    if (miss.length) (heldPet(pt) ? warn : bad)(`${pt.name} (${pt.art})${heldPet(pt) ? " (its map is held)" : ""}`, miss.join(", ")); else n++;
  }
  if (n === Object.keys(G.PETS).length) console.log(`  ok  all ${n} pets have a picture, and both lists carry it`);

  /* AND A RAID PET IS NOT IN THE POOL A KILL ROLLS (2026-09-24, the owner, reading the wiki: "it says coilling
     drops in Where it drops ... but its only the great pyramid right"). It was not only the wiki: the roll
     picked out of PET_KEYS, every pet there is, so the Great Pyramid's reward was also falling off ordinary
     kills in the Boneyard and beyond. The flag, the pool and the page have to agree, and this is what says so. */
  const raid = Object.entries(G.PETS).filter(([, p]) => p.raid).map(([k]) => k);
  for (const k of raid) if (G.PET_DROP_KEYS.includes(k)) bad(`${G.PETS[k].name} is a raid pet`, "but a kill can still roll it — it is in PET_DROP_KEYS");
  for (const [k, p] of Object.entries(G.PETS)) if (!p.raid && !p.bred && !G.PET_DROP_KEYS.includes(k)) bad(`${p.name} drops from nowhere`, "not a raid pet, and not in PET_DROP_KEYS either");
  /* (2026-09-27) A BRED PET COMES FROM THE PEN: a hatchling from an egg that exists, a Legendary from a kind that has one */
  for (const [k, p] of Object.entries(G.PETS)) if (p.bred && !p.held && !(p.egg ? G.EGGS?.[p.egg]?.pet === k : p.legend && G.LEGEND_OF?.[p.base] === k)) bad(`${p.name} is a bred pet with no way in`, "no egg hatches it and no pairing makes it");
  if (raid.length) console.log(`  ok  ${raid.length} raid pet${raid.length === 1 ? " is" : "s are"} out of the kill pool (${G.PET_DROP_KEYS.length} of ${G.PET_KEYS.length} can drop)`);
  /* (2026-09-27) the wiki's pets page is BUILT from the rules now, so render it and read the rows: every raid pet is listed, and its
     "how to get it" is not the kill pool's line */
  const { GUIDES } = await import(pathToFileURL(join(ROOT, "v3/assets/js/eastscape-wiki.js")).href);
  const pg = GUIDES.find((g) => g.id === "pets"), petsHtml = typeof pg?.body === "function" ? pg.body(G, { esc: (x) => String(x), ico: () => "", wl: (r, t) => t }) : String(pg?.body || "");
  for (const k of raid.filter((k) => !G.PETS[k].held)) {   /* a pet held shut (HOLD) is kept off the page on purpose */
    const row = petsHtml.split("<tr>").find((r) => r.includes(`<b>${G.PETS[k].name}</b>`));
    if (!row) bad(`the wiki's pets page never lists ${G.PETS[k].name}`, "a raid pet has to be on it");
    else if (/Any monster/.test(row)) bad(`the wiki's pets page says ${G.PETS[k].name} drops from any monster`, "it is a raid pet");
  }
  if (raid.length) console.log("  ok  the wiki's pets page lists them, and not as kill drops");
}

/* ---------------------------------------------------------------- YOU CANNOT FARM KILLS WHILE AFK
   (2026-09-24, the owner: "can you make sure users arent afking vs aggressive mobs? ... can we have an afk rule
   of 3 minutes like skilling?") It takes BOTH halves, and either one alone does nothing. Stopping the fight
   after three minutes is useless while a mob that hits an actionless player hands them a fresh one — the very
   next swing restarts the loop. Refusing the free retaliate is useless on its own too, because a fight already
   running never stops. Both, or it is not closed. */
{
  head("afk");
  const worker = readFileSync(join(ROOT, "eastscape-worker/src/index.js"), "utf8");
  if (!G.AFK_KINDS.mob) bad("fighting is not in AFK_KINDS", "a fight already running never times out");
  else console.log(`  ok  a fight stops after ${Math.round(G.AFK_MS / 60000)} idle minutes, like every skill`);
  if (!/foe\.act = \{ kind: "mob"/.test(worker)) console.log("   warn  the auto-retaliate line has moved; check the AFK guard moved with it");
  else if (!/!foe\.lingerUntil && now - foe\.lastInput <= G\.(AFK_MS|RETALIATE_MS)/.test(worker) || !(G.RETALIATE_MS <= G.AFK_MS))   /* (2026-09-30) one minute now: RETALIATE_MS */
    bad("a mob still hands an idle player a free retaliate", "so the three-minute cutoff restarts on the next swing");
  else console.log("  ok  and no new fight is handed to somebody who has not touched the game since");
}

/* GATHERING IS HALVED IN THE WILDERNESS, and there are FOUR separate rolls that have to know it — a vein, a
   rock, a tree and a cast, each written out in its own branch of index.js hundreds of lines apart. That is
   exactly the shape that leaves one behind: the Vault shipped with five ore nodes nobody could stand next to
   for the same reason. This counts the rolls and counts the multipliers, so a fifth gathering skill cannot be
   added without somebody noticing this rule exists. */
head("wilderness gathering");
{
  const idx = fs.readFileSync("eastscape-worker/src/index.js", "utf8");
  const applied = idx.split("G.gatherMul(").length - 1;
  if (applied < 4) bad(`only ${applied} gathering roll(s) apply G.gatherMul`, "a vein, a rock, a tree and a cast all need it");

  const pvp = Object.entries(G.SCENES).filter(([, d]) => d.pvp).map(([k]) => k);
  if (!pvp.length) bad("no scene is pvp", "gatherMul keys off it, so the rule would apply nowhere");
  else console.log(`  checked ${applied} gathering rolls, halved x${G.WILD_GATHER} in ${pvp.join(", ")}`);

  if (!(G.WILD_GATHER > 0 && G.WILD_GATHER <= 1)) bad(`WILD_GATHER is ${G.WILD_GATHER}`, "it multiplies a chance, so it belongs in (0, 1]");
}

/* THE 2X EVENT HAS TO REACH BOTH TICKET PATHS, and there are exactly two, which is the whole problem. Tickets
   are PAID through tixTo (a dungeon clear, a jackpot, a chip you cash) and they are DROPPED as the first line
   of every monster's table, handed over by the ordinary item path. I shipped the doubling in tixTo alone and
   described it as "the one place every ticket passes through", which was simply wrong, and the event missed the
   biggest ticket source in the game until the owner asked whether it applied to drops.
   Neither path can prove the other exists, so this counts both. */
head("the 2X event");
{
  const idx = fs.readFileSync("eastscape-worker/src/index.js", "utf8");
  const paidLine = idx.split(String.fromCharCode(10)).find((l) => /tixTo\(pl, n(, src)?\) \{/.test(l)) || "";
  const dropLine = idx.split(String.fromCharCode(10)).find((l) => l.includes('k === "tickets"') && l.includes("qty = Math.round")) || "";
  const inPaid = paidLine.includes("doubleOn()"), inDropped = dropLine.includes("doubleOn()");
  if (!inPaid) bad("tixTo does not apply the 2X event", "everything PAID in tickets would miss it");
  if (!inDropped) bad("a kill's dropped tickets do not apply the 2X event", "the biggest ticket source in the game would miss it");
  const xp = idx.includes("this.craft2xOn() && !this.skill2xOn() ? G.CRAFT2X.mult : 1") && !idx.includes("this.doubleOn() && !this.skill2xOn() ? G.DOUBLE.mult") && idx.includes("this.skill2xOn() && !G.SKILL2X.not.has(k)");   /* (2026-09-30) the 2X Tickets potion doubles crafting xp unless 2X Skilling XP (which doubles it in grant) is running: never 4X */
  if (!xp) bad("crafting xp does not apply 2X Crafting XP (or 2X Tickets still doubles it)", "the station loop is what the owner meant by crafting");
  if (inPaid && inDropped && xp) console.log(`  checked both ticket paths and crafting xp (its own 2X, x${G.CRAFT2X.mult}) for ${Math.round(G.DOUBLE.ms / 60000)} minutes`);
}

console.log(`\n${errors} error${errors === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}\n`);
process.exit(errors ? 1 : 0);

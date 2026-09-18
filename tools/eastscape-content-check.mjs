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
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as G from "../v3/assets/js/eastscape-shared.js";

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
const ART_FILES = listFromHtml("ART_FILES");
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
    if (!(m.hp > 0)) bad(`mob "${k}" has no hp`);
    if (!(m.lvl > 0)) warn(`mob "${k}" has no level`);
  }
  console.log(`  checked ${Object.keys(G.MOBS).length} monsters`);
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
  for (const [k, c] of Object.entries(G.CROPS)) {
    if (!G.ITEMS[k]) bad(`crop "${k}"`, "no such item");
    if (!(c.yield?.[0] >= 1)) bad(`crop "${k}" yields nothing`);
    if (!(c.ms > 0)) bad(`crop "${k}" never grows`);
  }
  console.log(`  checked ${Object.keys(G.COOK).length} recipes, ${Object.keys(G.CROPS).length} crops`);
}

head("quests");
{
  const npcNames = new Set(), npcQuests = new Set();
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
  const start = new Set([...G.freshChar().inv.map((s) => s.k), ...Object.values(G.freshChar().eq).filter(Boolean)]);
  const gatherable = new Set(["logs", "yewlogs", "ashlogs", "copper", "tin", "grimstone", "marble", "stardust", "olives", "sunolive", "wheat", "tomatoe", "goldtomatoe", "sardine", "trout", "mooncarp", "gloomfin", "geode", "burnt", "coins"]);
  for (const k of Object.keys(G.ITEMS)) {
    if (dropped.has(k) || sold.has(k) || cooked.has(k) || crops.has(k) || quested.has(k) || start.has(k) || gatherable.has(k)) continue;
    warn(`item "${k}" (${G.ITEMS[k].name})`, "nothing drops, sells, cooks, grows or rewards it — check it is gatherable");
  }
  // and anything you can get but cannot sell is a dead end in the bag
  const rawForCooking = new Set(Object.keys(G.COOK));   // raw meat and fish exist to be cooked; the cooked one is what sells
  for (const k of [...dropped, ...cooked, ...crops]) {
    if (k in G.SHOP.buys || k === "coins" || G.ITEMS[k]?.heal || G.ITEMS[k]?.slot || rawForCooking.has(k)) continue;
    warn(`item "${k}" can be obtained but the shop will not buy it`, "and it neither heals, is worn, nor cooks into something");
  }
}

console.log(`\n${errors} error${errors === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}\n`);
process.exit(errors ? 1 : 0);

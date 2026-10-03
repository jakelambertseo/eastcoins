/* ============================================================ EAST ARENA: THE RULES (2026-10-03). One file, imported by the page (arena.html) and
   the Worker (eastscape-worker/src/arena.js), so the two can never disagree about what an item, a monster or a level is. IMPORT-FREE on
   purpose: nothing here reads EastScape's rules or a player's EastScape character. The owner: "Seasonal character that resets each season.
   this is entirely seperate from a users EastScape account and they should not touch at all"; "Nothing moves". What came across from
   EastScape is ART (paths below) and SHAPES (gear tiers, the loot mock's lines), never data. The design is EAST-ARENA.md; the test is
   tools/arena-rules-test.mjs (every art path exists, every node is reachable, every affix range is sane).

   A CONTENT CHANGE IS A DATA CHANGE: a new monster, base, affix or tree node is a row here, and the test says if it is wired wrong. */
export const RULES_V = 1;

/* ------------------------------------------------------------ the grid and the look (2026-10-03). The page used to import EastScape's whole rules
   file for these two things. That tied the arena to EastScape's versioned file: shipping the arena would have cached EastScape's live file
   under its next, unreleased ?v=, which is the one way to break EastScape from here. So the arena keeps its own copies.
   GRID: EastScape's room size (44 x 26 tiles at 16 px), which the owner asked the arena to match. lookFor: which of the six everyday looks a
   player wears, the SAME answer EastScape gives (the FNV hash of the account id, and the pinned looks), so you look like yourself in both. */
export const GRID = { cols: 44, rows: 26 };
const LOOKS = 6, LOOK_PICKS = { bootypaper: 1 };
const lookOf = (key) => { let h = 2166136261; for (const ch of String(key)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % LOOKS) + 1; };
export const lookFor = (p) => LOOK_PICKS[String(p?.name || "").toLowerCase()] || lookOf(p?.id ?? p?.name);

/* ------------------------------------------------------------ the season (the owner: "1 month season length"; a ~30-player community) */
export const SEASON = { id: "S1", name: "Season 1", days: 28, offDays: 3, levelCap: 60,
  /* one ladder (no "standard" league: thirty people split two ways is two empty leagues), a weekly event, a race, a Hall of Fame */
  weekly: ["Campaign race: first to finish Act 1, Act 2, Act 3", "Boss rush: fastest Hoodie kill", "Deep maps: highest map tier cleared", "Party week: clears by a party of 2+ count double"],
  ladder: "highest map tier cleared, then character level, then who got there first" };

/* ------------------------------------------------------------ currency: one, unique to the arena, tradeable (the owner: "unique currency and trade is encouraged") */
export const CURRENCY = { key: "crowns", name: "Crowns", one: "Crown", icon: "items/coins.png",
  drop: (mlvl) => Math.max(1, Math.round(1 + mlvl * 0.35)),   /* a pile: about a third of the monster's level */
  pileChance: 0.35 };

/* ------------------------------------------------------------ the character: its own level, its own numbers. NOTHING from EastScape. */
export const LEVEL = { cap: 60,
  xpFor: (l) => Math.round(30 * Math.pow(l, 2.15)),   /* to go from l to l + 1: Act 1 is ~10 levels in an evening, 60 is a month */
  killXp: (mlvl, plvl) => { const base = 3 + mlvl * 1.6, gap = plvl - mlvl; return Math.max(1, Math.round(base * (gap > 5 ? Math.max(0.1, 1 - (gap - 5) * 0.15) : 1))); },
  base: (l) => ({ hp: 50 + l * 6, mp: 40 + l * 3, dmg: 4 + Math.floor(l * 0.6) }) };

/* ------------------------------------------------------------ classes: three styles, two ascendancies each (the owner: "Melee, archery, magic (each with 2 sub classes / ascendencies)") */
export const STYLES = {
  melee:   { name: "Melee",   icon: "items/skill_melee.png",   portrait: "items/bronze_gladius.png", start: "cleave",      weapon: "Gladius", asc: ["gladiator", "juggernaut"],
    blurb: "Up close. Wide swings that hit the whole pack, a dash through the line, and the most health and armour of the three.",
    mods: { hp: 1.3, mp: 0.6, def: 15 } },
  archery: { name: "Archery", icon: "items/skill_archery.png", portrait: "items/yewlogs_shortbow.png", start: "quick_shot",  weapon: "Bow", asc: ["deadeye", "trapper"],
    blurb: "From range, moving. Fast arrows, fans of them, and traps and rain to hold a pack where you want it.",
    mods: { hp: 1.0, mp: 0.8, def: 5, move: 0.05 } },
  magic:   { name: "Magic",   icon: "items/skill_magic.png",   portrait: "items/yewlogs_wand.png",   start: "arcane_bolt", weapon: "Wand", asc: ["elementalist", "occultist"],
    blurb: "Glass and power. The biggest hits and the biggest mana pool, for the least health: kill it before it reaches you.",
    mods: { hp: 0.85, mp: 1.4, def: 0 } } };
export const ASCENDANCIES = {
  gladiator:    { style: "melee",   name: "Gladiator",    does: "fast hits, bleeds, a crowd that cheers: every kill in a pack makes the next one quicker" },
  juggernaut:   { style: "melee",   name: "Juggernaut",   does: "slow and unstoppable: armour, stun, and a slam that knocks packs flat" },
  deadeye:      { style: "archery", name: "Deadeye",      does: "range and pierce: one arrow through the whole line" },
  trapper:      { style: "archery", name: "Trapper",      does: "the field kits made a class: snares, flares and traps that fight for you" },
  elementalist: { style: "magic",   name: "Elementalist", does: "fire, frost, storm and sun: switch elements to hit what a monster is weak to" },
  occultist:    { style: "magic",   name: "Occultist",    does: "the void: curses, a black hole, health paid for power" } };
/* when an ascendancy is chosen and how its points come: a trial at the end of each act (3 acts, 2 points each) */
export const ASC_POINTS = { perTrial: 2, trials: 3 };

/* ------------------------------------------------------------ skills: what the tree unlocks. fx are EastScape's spell strips (72 px frames) */
export const SKILLS = {
  /* magic */
  arcane_bolt: { style: "magic",   name: "Arcane Bolt",    kind: "bolt",   mult: 1.0,  mp: 1.5, cd: 0.17, speed: 300, fx: "fx/spell_bolt.png",      icon: "items/skill_magic.png",     does: "a bolt where you aim" },
  nova:        { style: "magic",   name: "Nova",           kind: "ring",   mult: 1.6,  mp: 35,  cd: 5,    count: 16, speed: 210, fx: "fx/spell_fireball.png", icon: "items/skill_wizardry.png", does: "a ring of bolts around you" },
  frost_lance: { style: "magic",   name: "Frost Lance",    kind: "lance",  mult: 1.5,  mp: 8,   cd: 0.6,  speed: 330, pierce: 3, slow: 1.5, fx: "fx/spell_lightning.png", icon: "items/frostpine_wand.png", does: "pierces three monsters and slows them" },
  chain_spark: { style: "magic",   name: "Chain Spark",    kind: "chain",  mult: 1.0,  mp: 10,  cd: 0.8,  speed: 320, jumps: 4, range: 5, fx: "fx/spell_bolt.png", icon: "items/skill_wizardry.png", does: "jumps to four more monsters nearby" },
  black_hole:  { style: "magic",   name: "Black Hole",     kind: "pull",   mult: 0.4,  mp: 60,  cd: 12,   fx: "fx/spell_blackhole.png", icon: "items/skill_magic.png",     does: "pulls a pack together (Occultist)" },
  /* archery */
  quick_shot:  { style: "archery", name: "Quick Shot",     kind: "arrow",  mult: 0.85, mp: 0,   cd: 0.22, speed: 380, fx: null, icon: "items/skill_archery.png",   does: "an arrow where you aim" },
  split_arrow: { style: "archery", name: "Split Arrow",    kind: "fan",    mult: 0.75, mp: 6,   cd: 0.7,  count: 5, spread: 0.13, speed: 360, fx: null, icon: "items/yewlogs_longbow.png", does: "five arrows in a fan" },
  rain:        { style: "archery", name: "Rain of Arrows", kind: "rain",   mult: 0.55, mp: 25,  cd: 5,    radius: 1.8, ticks: 6, every: 0.25, range: 9, fx: "fx/spell_spikes.png", icon: "items/bronze_arrow.png", does: "arrows fall on an area for a second and a half" },
  snare_trap:  { style: "archery", name: "Snare",          kind: "trap",   mult: 1.2,  mp: 15,  cd: 4,    radius: 1.2, root: 2.5, life: 10, range: 6, fx: "fx/spell_spikes.png", icon: "items/skill_fletching.png", does: "a trap that roots and hurts what walks into it" },
  /* melee */
  cleave:      { style: "melee",   name: "Cleave",         kind: "arc",    mult: 1.5,  mp: 0,   cd: 0.45, reach: 1.9, width: 1.2, fx: null, icon: "items/skill_melee.png",     does: "an arc in front of you that hits everything in it" },
  dash_strike: { style: "melee",   name: "Dash Strike",    kind: "dash",   mult: 1.8,  mp: 12,  cd: 2,    dist: 5, fx: null, icon: "items/skill_agility.png",   does: "dash where you aim and hit everything on the way" },
  ground_slam: { style: "melee",   name: "Ground Slam",    kind: "slam",   mult: 2.0,  mp: 25,  cd: 5,    reach: 3, width: 1.6, stun: 1.2, fx: "fx/spell_explosion.png", icon: "items/skill_strength.png", does: "a cone that stuns for a second" },
  war_cry:     { style: "melee",   name: "War Cry",        kind: "cry",    mult: 0,    mp: 20,  cd: 10,   dur: 4, cut: 0.4, range: 6, fx: null, icon: "items/skill_defence.png",   does: "pulls everything nearby to you, and you take 40% less for four seconds" },
  /* everyone */
  dodge:       { style: null,      name: "Dodge",          kind: "dodge",  mult: 0,    mp: 0,   cd: 1.2, fx: null, icon: "items/skill_agility.png",   does: "0.3 s with no hitbox" } };

/* ------------------------------------------------------------ the tree (the owner: "Skills unlock on a tree"). One point a level from level 2.
   A hub in the middle and a branch per class, all three the same SHAPE (so the pacing is the same): your class's start is free; three skills
   sit 2, 5 and 6 points out (so clearing Act 1's first area, about level 3, hands you your second skill); two notables; a keystone at the far end. The branches meet at the hub, so a character can walk into another
   class's branch, the PoE way. u is along the branch, v across it; the screen turns them into x, y. */
const BRANCH = [   /* [id suffix, kind, u, v, links (suffixes; "hub" is the middle)] */
  ["0", "start", 1, 0, ["hub", "1"]], ["1", "small", 2, 0, ["0", "2", "3"]], ["2", "skill", 3, -1, ["1", "4"]], ["3", "small", 3, 1, ["1", "5"]],
  ["4", "small", 4, -1.5, ["2", "6"]], ["5", "notable", 4, 1.5, ["3", "7"]], ["6", "small", 5, -1, ["4", "8"]], ["7", "small", 5, 1, ["5", "9"]],
  ["8", "skill", 6, -1, ["6", "10"]], ["9", "skill", 6, 1, ["7", "10"]], ["10", "notable", 7, 0, ["8", "9", "11"]], ["11", "keystone", 8, 0, ["10"]]];
const GRANTS = {
  melee: { 0: { skill: "cleave" }, 1: { hp: 0.06 }, 2: { skill: "dash_strike" }, 3: { def: 10 }, 4: { dmg: 0.08 }, 5: { hp: 0.15, def: 15, name: "Iron Hide" }, 6: { speed: 0.06 }, 7: { hp: 0.08 },
    8: { skill: "war_cry" }, 9: { skill: "ground_slam" }, 10: { dmg: 0.15, leech: 0.02, name: "Bloodlust" }, 11: { rule: "iron_will", name: "Iron Will", says: "Skills cost health instead of mana, and you have 30% more health" } },
  archery: { 0: { skill: "quick_shot" }, 1: { speed: 0.05 }, 2: { skill: "split_arrow" }, 3: { move: 0.05 }, 4: { dmg: 0.08 }, 5: { dmg: 0.12, pierce: 1, name: "Eagle Eye" }, 6: { dmg: 0.08 }, 7: { speed: 0.06 },
    8: { skill: "rain" }, 9: { skill: "snare_trap" }, 10: { bolts: 1, name: "Full Quiver" }, 11: { rule: "point_blank", name: "Point Blank", says: "Arrows hit 50% harder up close and 30% weaker far away" } },
  magic: { 0: { skill: "arcane_bolt" }, 1: { mp: 0.08 }, 2: { skill: "nova" }, 3: { mpRegen: 0.2 }, 4: { dmg: 0.08 }, 5: { dmg: 0.12, mpRegen: 0.2, name: "Focus" }, 6: { mp: 0.1 }, 7: { dmg: 0.08 },
    8: { skill: "frost_lance" }, 9: { skill: "chain_spark" }, 10: { dmg: 0.18, name: "Overcharge" }, 11: { rule: "blood_magic", name: "Blood Magic", says: "Spells cost health instead of mana, and you have 40% more health" } } };
const DIR = { melee: -Math.PI / 2, archery: Math.PI / 6, magic: (5 * Math.PI) / 6 };   /* up, down-right, down-left */
const PRE = { melee: "m", archery: "a", magic: "g" };
export const TREE = { pointsPerLevel: 1, nodes: { hub: { style: null, kind: "hub", x: 0, y: 0, links: ["m0", "a0", "g0"], grants: { hp: 0.04 } } } };
for (const [style, pre] of Object.entries(PRE)) for (const [id, kind, u, v, links] of BRANCH) {
  const a = DIR[style], x = Math.cos(a) * u * 1.15 - Math.sin(a) * v, y = Math.sin(a) * u * 1.15 + Math.cos(a) * v;
  TREE.nodes[pre + id] = { style, kind, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, links: links.map((l) => (l === "hub" ? "hub" : pre + l)), grants: GRANTS[style][id] };
}
/** points a level gives */
export const treePoints = (level) => Math.max(0, (level - 1) * TREE.pointsPerLevel);
/** is this allocation legal for a class at a level? (the page and the Worker both ask). The class's start is free and always in. */
export function treeValid(style, alloc, level) {
  const N = TREE.nodes, start = PRE[style] + "0"; if (!N[start]) return false;
  const set = new Set(alloc); set.add(start);
  for (const k of set) if (!N[k]) return false;
  if (set.size - 1 > treePoints(level)) return false;
  const seen = new Set([start]), q = [start];
  while (q.length) for (const l of N[q.shift()].links) if (set.has(l) && !seen.has(l)) { seen.add(l); q.push(l); }
  return seen.size === set.size;
}
/** what an allocation adds up to: percentages as fractions, flat armour, extra projectiles, pierce, the skills it unlocks, the keystones */
export function treeGrants(style, alloc) {
  const N = TREE.nodes, set = new Set(alloc); set.add(PRE[style] + "0");
  const g = { dmg: 0, hp: 0, mp: 0, mpRegen: 0, speed: 0, move: 0, def: 0, leech: 0, pierce: 0, bolts: 0, skills: [], rules: [] };
  for (const k of set) { const G = N[k]?.grants || {}; for (const [a, v] of Object.entries(G)) { if (a === "skill") g.skills.push(v); else if (a === "rule") g.rules.push(v); else if (a in g) g[a] += v; } }
  return g;
}
export const startNode = (style) => PRE[style] + "0";

/* ------------------------------------------------------------ items: EastScape's nine gear tiers become BASES by item level (ilvl). The owner:
   "items (these need to be adjusted for ARPG style rather than single craft/drop)". A drop is a base (its slot, its tier from the item level,
   an implicit from the tier) plus a rarity plus rolled lines. Nothing is crafted from bars; everything drops and can be traded. */
export const SLOTS = ["weapon", "offhand", "helm", "body", "gloves", "boots", "ring", "amulet"];
export const TIERS = [
  { k: "bronze",      ilvl: 1,  wood: "logs" },       { k: "emerald",  ilvl: 8,  wood: "willowlogs" }, { k: "diamond",     ilvl: 15, wood: "ashlogs" },
  { k: "dragonstone", ilvl: 22, wood: "yewlogs" },    { k: "onyx",     ilvl: 29, wood: "palmlogs" },   { k: "starfall",    ilvl: 36, wood: "skyashlogs" },
  { k: "eclipse",     ilvl: 43, wood: "pinelogs" },   { k: "nova",     ilvl: 50, wood: "voidlogs" },   { k: "singularity", ilvl: 57, wood: "cycadlogs" }];
export const tierFor = (ilvl) => { let t = TIERS[0]; for (const x of TIERS) if (ilvl >= x.ilvl) t = x; return t; };
const TITLE = (s) => s[0].toUpperCase() + s.slice(1);
/** the base an item level gives for a slot (and, for a weapon or an offhand, a style): { slot, style, tier, name, icon, implicit } */
export function baseFor(slot, ilvl, style = "magic") {
  const t = tierFor(ilvl), i = TIERS.indexOf(t);
  if (slot === "weapon") {
    if (style === "archery") return { slot, style, tier: t.k, name: `${TITLE(t.k)} Bow`, icon: `items/${t.wood}_shortbow.png`, implicit: { dmg: 3 + i * 3 } };
    if (style === "melee")   return { slot, style, tier: t.k, name: `${TITLE(t.k)} Gladius`, icon: `items/${GLADIUS[t.k] || "bronze"}_gladius.png`, implicit: { dmg: 4 + i * 3 } };
    return { slot, style: "magic", tier: t.k, name: `${TITLE(t.k)} Wand`, icon: `items/${t.wood}_wand.png`, implicit: { dmg: 3 + i * 3 } };
  }
  if (slot === "offhand") return { slot, style: null, tier: t.k, name: `${TITLE(t.k)} Shield`, icon: `items/${SHIELD[t.k] || "bronze"}_shield.png`, implicit: { def: 2 + i * 2 } };
  const word = { helm: "Helm", body: "Plate", gloves: "Gloves", boots: "Boots", ring: "Ring", amulet: "Amulet" }[slot];
  const implicit = slot === "ring" ? { mp: 5 + i * 3 } : slot === "amulet" ? { hp: 6 + i * 4 } : { def: 1 + i * (slot === "body" ? 3 : 1.5) };
  return { slot, style: null, tier: t.k, name: `${TITLE(t.k)} ${word}`, icon: `items/${t.k}_${slot}.png`, implicit: Object.fromEntries(Object.entries(implicit).map(([k, v]) => [k, Math.round(v)])) };
}
/* not every tier has every picture: these fall back to the nearest tier that does (the test checks every icon) */
const GLADIUS = { bronze: "bronze", emerald: "emerald", diamond: "diamond", dragonstone: "dragonstone", onyx: "dragonstone", starfall: "eclipse", eclipse: "eclipse", nova: "nova", singularity: "nova" };
const SHIELD = { bronze: "bronze", emerald: "emerald", diamond: "diamond", dragonstone: "dragonstone", onyx: "onyx", starfall: "starfall", eclipse: "eclipse", nova: "nova", singularity: "singularity" };

/* rarity: the loot mock's names (EastScape's casino flavour), ARPG counts */
export const RARITY = [
  { k: "plain",   name: "Plain",   lines: [0, 0], weight: 70, col: "#e8e0cc" },
  { k: "lucky",   name: "Lucky",   lines: [1, 2], weight: 22, col: "#7ee07e" },
  { k: "hot",     name: "Hot",     lines: [3, 4], weight: 7.5, col: "#ff9a4a" },
  { k: "jackpot", name: "Jackpot", lines: [4, 5], weight: 0.5, col: "#c89aff" }];
/* affixes: each has tiers by item level; a roll picks the best tier the item level allows, then a value in its range */
export const AFFIXES = {
  dmg:     { say: (v) => `+${v} damage`,                  slots: ["weapon", "ring", "amulet", "gloves"], tiers: [[1, 1, 2], [12, 3, 4], [25, 5, 7], [40, 8, 11], [55, 12, 15]] },
  pdmg:    { say: (v) => `+${v}% damage`,                 slots: ["weapon", "amulet"],                   tiers: [[1, 4, 7], [15, 8, 12], [30, 13, 18], [45, 19, 25]], pct: true },
  speed:   { say: (v) => `${v}% faster attacks and casts`, slots: ["weapon", "gloves", "ring"],          tiers: [[1, 2, 4], [20, 5, 7], [40, 8, 11]], pct: true },
  hp:      { say: (v) => `+${v} health`,                  slots: ["helm", "body", "gloves", "boots", "ring", "amulet", "offhand"], tiers: [[1, 5, 10], [10, 11, 20], [22, 21, 35], [36, 36, 55], [50, 56, 80]] },
  mp:      { say: (v) => `+${v} mana`,                    slots: ["helm", "ring", "amulet", "offhand"],  tiers: [[1, 5, 10], [15, 11, 20], [30, 21, 35], [48, 36, 50]] },
  mpRegen: { say: (v) => `+${v}% mana regeneration`,       slots: ["ring", "amulet", "helm"],            tiers: [[1, 10, 20], [25, 21, 35], [45, 36, 50]], pct: true },
  def:     { say: (v) => `+${v} armour`,                  slots: ["helm", "body", "gloves", "boots", "offhand"], tiers: [[1, 1, 3], [12, 4, 7], [25, 8, 12], [40, 13, 18], [55, 19, 25]] },
  move:    { say: (v) => `${v}% faster movement`,          slots: ["boots"],                             tiers: [[1, 5, 8], [20, 9, 12], [40, 13, 16]], pct: true },
  leech:   { say: (v) => `${v}% of damage dealt heals you`, slots: ["weapon", "amulet", "ring"],          tiers: [[10, 1, 1], [30, 2, 2], [50, 3, 3]], pct: true },
  find:    { say: (v) => `${v}% more drops`,               slots: ["helm", "ring", "amulet", "boots"],   tiers: [[1, 4, 8], [20, 9, 14], [40, 15, 20]], pct: true },
  crowns:  { say: (v) => `${v}% more Crowns`,              slots: ["gloves", "ring", "amulet"],          tiers: [[1, 5, 10], [25, 11, 18], [45, 19, 25]], pct: true } };
/** the tier of an affix an item level can roll (the best one it reaches), or null */
export const affixTier = (id, ilvl) => { const A = AFFIXES[id]; if (!A) return null; let t = null; for (const x of A.tiers) if (ilvl >= x[0]) t = x; return t; };
/** roll one item: a base, a rarity, lines. rnd is injectable so the server can roll from a seed later. */
export function rollItem(ilvl, { style = "magic", boss = false, rnd = Math.random, slot = null } = {}) {
  const s = slot || SLOTS[Math.floor(rnd() * SLOTS.length)], base = baseFor(s, ilvl, style);
  let r = 0, x = rnd() * RARITY.reduce((a, q) => a + q.weight, 0); for (let i = 0; i < RARITY.length; i++) { x -= RARITY[i].weight; if (x < 0) { r = i; break; } }
  if (boss) r = Math.max(r, 2);
  const [lo, hi] = RARITY[r].lines, n = lo + Math.floor(rnd() * (hi - lo + 1));
  const pool = Object.keys(AFFIXES).filter((id) => AFFIXES[id].slots.includes(s) && affixTier(id, ilvl)), lines = [];
  for (let i = 0; i < n && pool.length; i++) { const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0], [, a, b] = affixTier(id, ilvl); lines.push({ id, v: a + Math.floor(rnd() * (b - a + 1)) }); }
  return { slot: s, ilvl, r: lines.length ? r : 0, base: base.name, tier: base.tier, style: base.style, icon: base.icon, implicit: base.implicit, lines };
}
/** what an item says, line by line */
export const sayLine = (l) => (AFFIXES[l.id] ? AFFIXES[l.id].say(l.v) : `${l.id} ${l.v}`);
/** is this item one the rules could have made? (the Worker clamps every report through this) */
export function validItem(it) {
  if (!it || typeof it !== "object" || !SLOTS.includes(it.slot)) return false;
  const ilvl = it.ilvl | 0; if (ilvl < 1 || ilvl > 100) return false;
  if (!Array.isArray(it.lines) || it.lines.length > 5) return false;
  const seen = new Set();
  for (const l of it.lines) { const t = affixTier(l?.id, ilvl); if (!t || seen.has(l.id) || !AFFIXES[l.id].slots.includes(it.slot)) return false; seen.add(l.id); if (!(l.v >= AFFIXES[l.id].tiers[0][1] && l.v <= t[2])) return false; }
  return true;
}

/* ------------------------------------------------------------ monsters: EastScape's art, arena numbers. Health and damage scale with the area level. */
export const ARCHETYPES = { melee: "walks at you and hits", ranged: "keeps its distance and fires aimed shots", caster: "slow, fires fans", charger: "lunges", boss: "patterns" };
export const MONSTERS = {
  guard:  { name: "Skeleton Guard", art: "cryptguard", type: "melee",  hp: 1.0, dmg: 1.0, spd: 46, r: 9,  acc: 420 },
  ghost:  { name: "Crypt Ghost",    art: "cryptghost", type: "ranged", hp: 0.6, dmg: 0.8, spd: 34, r: 9,  acc: 300, keep: 90, pat: "aim", every: 2.4 },
  golem:  { name: "Bone Golem",     art: "cryptgolem", type: "caster", hp: 3.0, dmg: 1.4, spd: 24, r: 14, acc: 220, pat: "fan", every: 3.2 },
  hoodie: { name: "THE HOODIE",     art: "hoodie",     type: "boss",   hp: 35,  dmg: 1.3, spd: 22, r: 22, acc: 160, boss: true } };
/** a monster's numbers at an area level */
export const monsterAt = (k, alvl) => { const M = MONSTERS[k], hp = Math.round((14 + alvl * 6) * M.hp), dmg = Math.round((3 + alvl * 0.9) * M.dmg); return { ...M, k, lvl: alvl, hp, maxHp: hp, max: dmg }; };

/* ------------------------------------------------------------ the campaign and maps (the owner: "a campaign to get users through the basics, and then maps") */
export const CAMPAIGN = [
  { act: 1, name: "The Cellars", art: "crypt", areas: [{ n: 1, name: "The Cellars I", alvl: 1, rooms: 4, pool: ["guard", "guard", "ghost"], boss: null },
    { n: 2, name: "The Cellars II", alvl: 4, rooms: 4, pool: ["guard", "ghost", "golem"], boss: null },
    { n: 3, name: "The Hoodie's Sanctum", alvl: 7, rooms: 4, pool: ["guard", "ghost", "golem"], boss: "hoodie", trial: true }] },
  { act: 2, name: "The Wild Woods (art from the Gloam and the Mire)", areas: [], todo: true },
  { act: 3, name: "The Frozen Reach (art from the Reach)", areas: [], todo: true }];
export const MAPS = { tiers: 10, alvlAt: (tier) => 20 + tier * 4, note: "generated rooms, a random modifier or two, a boss; a map drops maps" };

/* ------------------------------------------------------------ perks: rare, kept for the season (the owner: "the perks should appear way less/slower, and only persist through maps") */
export const PERKS = { bolt: ["One more projectile", "every shot fires one more in a spread"], dmg: ["+15% damage", "everything you do"], speed: ["+10% move speed", "you and your dodge"], dodge: ["Quicker dodge", "the roll comes back 25% sooner"],
  hp: ["+25 health", "for the season"], leech: ["3% leech", "of damage dealt heals you"], blast: ["Bigger blast", "the area skill hits wider and comes back a second sooner"], rare: ["Lucky", "drops 20% more often"] };
export const PERKS_MAX = 8;

/* ------------------------------------------------------------ THE SAVE (2026-10-03). The arena is live, so real characters exist. Every saved character
   carries `v`, the SAVE_V it was last written at; the server upgrades an older one step by step when it loads (arena-worker/src/arena.js
   `migrate`), so the season's data can change without breaking anyone mid-month. Bump SAVE_V and add a step there for any change to the shape. */
export const SAVE_V = 2;

/* ------------------------------------------------------------ CRAFTING CURRENCY (the owner, 2026-10-03: "crowns and crafting items/currency, just like
   diablo/poe/last epoch/chronicon"). Crowns are money; these are the orbs. Each does ONE thing to one item, they stack in their own pouch
   (not the bag), they drop for each player separately, and they trade. EastScape's casino art: chips, dice, a marked card, a horseshoe.
   weight: how often each is the one that drops (out of the total). Dex sells the common three for Crowns: the economy's main sink. */
export const CHIPS = {
  lucky:     { name: "Lucky Chip",   icon: "items/chip_free.png",   weight: 40, does: "makes a Plain item Lucky: one or two lines" },
  dice:      { name: "Devil's Dice", icon: "items/devils_dice.png", weight: 24, does: "rerolls every line on a Lucky, Hot or Jackpot item" },
  hot:       { name: "Hot Chip",     icon: "items/chip_red.png",    weight: 14, does: "makes a Lucky item Hot: three or four lines" },
  black:     { name: "Black Chip",   icon: "items/chip_black.png",  weight: 10, does: "takes every line off an item: back to Plain" },
  card:      { name: "Marked Card",  icon: "items/markedcard.png",  weight: 7,  does: "rerolls the numbers on an item's lines, keeping the lines" },
  horseshoe: { name: "Horseshoe",    icon: "items/horseshoe.png",   weight: 4,  does: "adds one line to an item that has room for another" },
  jackpot:   { name: "Jackpot Chip", icon: "items/chip_gold.png",   weight: 1,  does: "makes a Hot item a Jackpot: four or five lines" } };
export const CHIP_CHANCE = 0.05;   // per kill, per player (bosses always drop two)
/** which chip drops (or null), for one kill and one player */
export function chipDrop(rnd = Math.random, { boss = false, find = 0 } = {}) {
  if (!boss && rnd() >= CHIP_CHANCE * (1 + find)) return null;
  let x = rnd() * Object.values(CHIPS).reduce((a, c) => a + c.weight, 0);
  for (const [k, c] of Object.entries(CHIPS)) { x -= c.weight; if (x < 0) return k; }
  return "lucky";
}
/* Dex, the Lounge's cashier: Crowns for the common chips (prices in Crowns). The economy's sink: Crowns come in from every kill and salvage. */
export const SHOP = { lucky: 20, black: 40, dice: 60 };
/* refunding tree points costs Crowns after level 10 (adding is always free): the second sink, and it makes a build a decision */
export const RESPEC = { freeUntil: 10, perPoint: (level) => 5 + level * 2 };
export const respecCost = (level, refunded) => (level < RESPEC.freeUntil ? 0 : Math.max(0, refunded) * RESPEC.perPoint(level));

/* fresh lines for an item: n affixes its slot can roll at its level, never one it already has */
function rollLines(slot, ilvl, n, have, rnd) {
  const pool = Object.keys(AFFIXES).filter((id) => AFFIXES[id].slots.includes(slot) && affixTier(id, ilvl) && !have.some((l) => l.id === id)), out = [];
  for (let i = 0; i < n && pool.length; i++) { const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0], [, a, b] = affixTier(id, ilvl); out.push({ id, v: a + Math.floor(rnd() * (b - a + 1)) }); }
  return out;
}
const countIn = ([lo, hi], rnd) => lo + Math.floor(rnd() * (hi - lo + 1));
/** use a chip on an item. Returns { item } (a new object; id and history are the server's business) or { err } saying why not. */
export function craft(it, k, rnd = Math.random) {
  if (!CHIPS[k]) return { err: "That isn't a crafting item." };
  if (!validItem(it)) return { err: "That item can't be crafted." };
  const r = it.r | 0, lines = it.lines.map((l) => ({ ...l })), out = (nr, nl) => ({ item: { ...it, r: nl.length ? nr : 0, lines: nl } });
  const name = RARITY[r].name;
  if (k === "lucky") return r === 0 ? out(1, rollLines(it.slot, it.ilvl, countIn(RARITY[1].lines, rnd), [], rnd)) : { err: "A Lucky Chip only works on a Plain item." };
  if (k === "hot") { if (r !== 1) return { err: "A Hot Chip only works on a Lucky item." }; const want = countIn(RARITY[2].lines, rnd); return out(2, lines.concat(rollLines(it.slot, it.ilvl, Math.max(0, want - lines.length), lines, rnd))); }
  if (k === "jackpot") { if (r !== 2) return { err: "A Jackpot Chip only works on a Hot item." }; const want = countIn(RARITY[3].lines, rnd); return out(3, lines.concat(rollLines(it.slot, it.ilvl, Math.max(1, want - lines.length), lines, rnd))); }
  if (r === 0) return { err: `A ${CHIPS[k].name} needs an item with lines: use a Lucky Chip first.` };
  if (k === "black") return out(0, []);
  if (k === "dice") return out(r, rollLines(it.slot, it.ilvl, countIn(RARITY[r].lines, rnd), [], rnd));
  if (k === "card") return out(r, lines.map((l) => { const [, a, b] = affixTier(l.id, it.ilvl); return { id: l.id, v: a + Math.floor(rnd() * (b - a + 1)) }; }));
  if (k === "horseshoe") { if (lines.length >= RARITY[r].lines[1]) return { err: `A ${name} item can't hold another line.` }; const add = rollLines(it.slot, it.ilvl, 1, lines, rnd); if (!add.length) return { err: "There's no line left this item can roll." }; return out(r, lines.concat(add)); }
  return { err: "That does nothing." };
}

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
  weekly: ["Campaign race: first to finish Act 1, Act 2, Act 3", "Boss rush: fastest Hoodie kill", "Deep Rifts: highest Rift cleared", "Party week: clears by a party of 2+ count double"],
  ladder: "highest Rift cleared, then character level, then who got there first" };

/* ------------------------------------------------------------ currencies (the brief, EAST-ARENA-GDD.md: "a small currency set"). GOLD for services, from kills and
   selling; ESSENCE from salvaging gear, spent at the Enchanter; Boss Shards come later with boss tiers. The Gold field on a character is still
   called `crowns` (its first name, 2026-10-03): every save, op and tally uses it, so the NAME changed and the field did not. */
export const CURRENCY = { key: "crowns", name: "Gold", one: "Gold", icon: "items/coins.png",
  drop: (mlvl) => Math.max(1, Math.round(1 + mlvl * 0.35)),   /* a pile: about a third of the monster's level */
  pileChance: 0.18 };   /* (was 0.35: packs are four times the size now) */
export const ESSENCE = { key: "essence", name: "Essence", icon: "items/stardust.png", ex: "What's left of a salvaged piece. The Enchanter works in it." };

/* ------------------------------------------------------------ the character: its own level, its own numbers. NOTHING from EastScape. */
export const LEVEL = { cap: 60,
  xpFor: (l) => Math.round(30 * Math.pow(l, 2.15)),   /* to go from l to l + 1: Act 1 is ~10 levels in an evening, 60 is a month */
  killXp: (mlvl, plvl) => { const base = 1.5 + mlvl * 0.8, gap = plvl - mlvl;   /* (halved on 2026-10-03 with packs four times the size) */ return Math.max(1, Math.round(base * (gap > 5 ? Math.max(0.1, 1 - (gap - 5) * 0.15) : 1))); },
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
  /* gloves and boots carry something you feel (2026-10-03: they used to be a little armour, like a helm): speed in the hands, pace on the feet */
  const implicit = slot === "ring" ? { mp: 5 + i * 3 } : slot === "amulet" ? { hp: 6 + i * 4 } : slot === "gloves" ? { speed: 2 + i } : slot === "boots" ? { move: 3 + i } : { def: 1 + i * (slot === "body" ? 3 : 1.5) };
  return { slot, style: null, tier: t.k, name: `${TITLE(t.k)} ${word}`, icon: `items/${t.k}_${slot}.png`, implicit: Object.fromEntries(Object.entries(implicit).map(([k, v]) => [k, Math.round(v)])) };
}
/* not every tier has every picture: these fall back to the nearest tier that does (the test checks every icon) */
const GLADIUS = { bronze: "bronze", emerald: "emerald", diamond: "diamond", dragonstone: "dragonstone", onyx: "dragonstone", starfall: "eclipse", eclipse: "eclipse", nova: "nova", singularity: "nova" };
const SHIELD = { bronze: "bronze", emerald: "emerald", diamond: "diamond", dragonstone: "dragonstone", onyx: "onyx", starfall: "starfall", eclipse: "eclipse", nova: "nova", singularity: "singularity" };

/* rarity: the brief's ladder, "Common, Magic, Rare, Legendary, Set" (the casino names Plain/Lucky/Hot/Jackpot went on 2026-10-03: a new
   player knows these). Common, Magic and Rare are rolled (weights); a Legendary or a Set piece is made by rollDrop from the tables below. */
export const RARITY = [
  { k: "common",    name: "Common",    lines: [0, 0], weight: 70, col: "#e8e0cc" },
  { k: "magic",     name: "Magic",     lines: [1, 2], weight: 22, col: "#7ee07e" },
  { k: "rare",      name: "Rare",      lines: [3, 5], weight: 8,  col: "#ff9a4a" },
  { k: "legendary", name: "Legendary", lines: [2, 3], weight: 0,  col: "#ffcf3a" },
  { k: "set",       name: "Set",       lines: [2, 2], weight: 0,  col: "#5ab4ff" }];
/* affixes: each has tiers by item level; a roll picks the best tier the item level allows, then a value in its range. `pre` and `suf` are
   the words an item takes its NAME from (itemName): its first line's prefix and its second line's suffix, "Keen Bronze Ring of Haste". */
export const AFFIXES = {
  dmg:     { say: (v) => `+${v} damage`,                  pre: "Keen",     suf: "of Striking",  slots: ["weapon", "ring", "amulet", "gloves"], tiers: [[1, 1, 2], [12, 3, 4], [25, 5, 7], [40, 8, 11], [55, 12, 15]] },
  pdmg:    { say: (v) => `+${v}% damage`,                 pre: "Savage",   suf: "of Ruin",      slots: ["weapon", "amulet"],                   tiers: [[1, 4, 7], [15, 8, 12], [30, 13, 18], [45, 19, 25]], pct: true },
  speed:   { say: (v) => `${v}% faster attacks and casts`, pre: "Quick",    suf: "of Haste",     slots: ["weapon", "gloves", "ring"],          tiers: [[1, 2, 4], [20, 5, 7], [40, 8, 11]], pct: true },
  hp:      { say: (v) => `+${v} health`,                  pre: "Stout",    suf: "of the Bear",  slots: ["helm", "body", "gloves", "boots", "ring", "amulet", "offhand"], tiers: [[1, 5, 10], [10, 11, 20], [22, 21, 35], [36, 36, 55], [50, 56, 80]] },
  mp:      { say: (v) => `+${v} mana`,                    pre: "Clear",    suf: "of the Owl",   slots: ["helm", "ring", "amulet", "offhand"],  tiers: [[1, 5, 10], [15, 11, 20], [30, 21, 35], [48, 36, 50]] },
  mpRegen: { say: (v) => `+${v}% mana regeneration`,       pre: "Flowing",  suf: "of the Tide",  slots: ["ring", "amulet", "helm"],            tiers: [[1, 10, 20], [25, 21, 35], [45, 36, 50]], pct: true },
  def:     { say: (v) => `+${v} armour`,                  pre: "Iron",     suf: "of the Wall",  slots: ["helm", "body", "gloves", "boots", "offhand"], tiers: [[1, 1, 3], [12, 4, 7], [25, 8, 12], [40, 13, 18], [55, 19, 25]] },
  move:    { say: (v) => `${v}% faster movement`,          pre: "Fleet",    suf: "of the Wind",  slots: ["boots"],                             tiers: [[1, 5, 8], [20, 9, 12], [40, 13, 16]], pct: true },
  leech:   { say: (v) => `${v}% of damage dealt heals you`, pre: "Vampiric", suf: "of Blood",     slots: ["weapon", "amulet", "ring"],          tiers: [[10, 1, 1], [30, 2, 2], [50, 3, 3]], pct: true },
  find:    { say: (v) => `${v}% more drops`,               pre: "Lucky",    suf: "of Plenty",    slots: ["helm", "ring", "amulet", "boots"],   tiers: [[1, 4, 8], [20, 9, 14], [40, 15, 20]], pct: true },
  crowns:  { say: (v) => `${v}% more Gold`,              pre: "Gilded",   suf: "of Fortune",   slots: ["gloves", "ring", "amulet"],          tiers: [[1, 5, 10], [25, 11, 18], [45, 19, 25]], pct: true },
  /* (2026-10-03, gear and loot) */
  crit:     { say: (v) => `+${v}% critical strike chance`, pre: "Precise",  suf: "of the Eye",   slots: ["gloves", "ring", "amulet", "helm"],  tiers: [[1, 1, 2], [20, 3, 4], [40, 5, 6]], pct: true },
  critX:    { say: (v) => `+${v}% critical strike damage`, pre: "Brutal",   suf: "of Cruelty",   slots: ["weapon", "amulet", "gloves"],        tiers: [[5, 10, 15], [25, 16, 25], [45, 26, 35]], pct: true },
  lifeKill: { say: (v) => `+${v} health on kill`,          pre: "Hungry",   suf: "of the Hunt",  slots: ["weapon", "body", "ring", "amulet"],  tiers: [[1, 2, 4], [20, 5, 9], [40, 10, 16]] },
  manaKill: { say: (v) => `+${v} mana on kill`,            pre: "Thirsty",  suf: "of the Well",  slots: ["weapon", "helm", "ring"],            tiers: [[1, 1, 3], [20, 4, 6], [40, 7, 10]] },
  dodge:    { say: (v) => `${v}% faster dodge recovery`,   pre: "Nimble",   suf: "of the Cat",   slots: ["boots", "gloves"],                   tiers: [[8, 5, 8], [30, 9, 12], [50, 13, 16]], pct: true },
  /* (2026-10-03, the owner: "the loot feels very bland right now ... how can we spice it up?") Lines that DO something you can see, on
     starting gear too: elemental damage (fire burns big, frost can slow, storm can stun; the hit's number and sparks take the colour),
     health on every hit, and cooldown reduction. The brief's own list: Elemental Damage, Status Chance, Life on Hit, Cooldown Reduction. */
  fire:    { say: (v) => `+${v} fire damage`,                      pre: "Burning",  suf: "of Flame",     slots: ["weapon", "ring", "gloves"],          tiers: [[1, 2, 3], [15, 4, 6], [30, 7, 10], [45, 11, 15]] },
  frost:   { say: (v) => `+${v} frost damage, and a chance to slow`, pre: "Frozen",   suf: "of Frost",     slots: ["weapon", "ring", "amulet"],          tiers: [[1, 1, 2], [15, 3, 4], [30, 5, 7], [45, 8, 11]] },
  storm:   { say: (v) => `+${v} storm damage, and a chance to stun`, pre: "Charged",  suf: "of Storms",    slots: ["weapon", "amulet", "gloves"],        tiers: [[1, 1, 2], [15, 3, 4], [30, 5, 7], [45, 8, 11]] },
  lifeHit: { say: (v) => `+${v} health on every hit`,              pre: "Mending",  suf: "of Mending",   slots: ["weapon", "amulet", "gloves"],        tiers: [[1, 1, 1], [20, 2, 2], [40, 3, 4]] },
  cdr:     { say: (v) => `${v}% cooldown reduction`,               pre: "Hasty",    suf: "of Readiness", slots: ["weapon", "helm", "ring", "amulet"],  tiers: [[5, 3, 5], [25, 6, 9], [45, 10, 14]], pct: true } };
/* what frost and storm do on top of their damage, per hit (the server's hit) */
export const ELEMENT = { fire: { name: "fire" }, frost: { name: "frost", slow: 0.25, slowFor: 1.5 }, storm: { name: "storm", stun: 0.1, stunFor: 0.45 } };
/** the tier of an affix an item level can roll (the best one it reaches), or null */
export const affixTier = (id, ilvl) => { const A = AFFIXES[id]; if (!A) return null; let t = null; for (const x of A.tiers) if (ilvl >= x[0]) t = x; return t; };
/** roll one item: a base, a rarity, lines. rnd is injectable so the server can roll from a seed later. */
export function rollItem(ilvl, { style = "magic", boss = false, elite = false, rnd = Math.random, slot = null } = {}) {
  const s = slot || SLOTS[Math.floor(rnd() * SLOTS.length)], base = baseFor(s, ilvl, style);
  let r = 0, x = rnd() * RARITY.reduce((a, q) => a + q.weight, 0); for (let i = 0; i < RARITY.length; i++) { x -= RARITY[i].weight; if (x < 0) { r = i; break; } }
  if (boss) r = Math.max(r, 2); else if (elite) r = Math.max(r, 1);
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
  if (it.r === 3 || it.r === 4) {   /* a legendary or a set piece: exactly its own lines, each inside its range at this item level */
    const sp = specFor(it); if (!sp || sp.slot !== it.slot || it.lines.length !== sp.lines.length) return false;
    return it.lines.every((l, i) => l?.id === sp.lines[i][0] && Number.isInteger(l.v) && l.v >= 1 && l.v <= rollRange(it, l.id)[1]);
  }
  if ((it.r | 0) > 2 || it.lg != null || it.s != null) return false;   /* only a legendary or a set piece carries lg or s */
  if (it.rr != null && !(Number.isInteger(it.rr) && it.rr >= 0 && it.rr < it.lines.length)) return false;   /* the Enchanter's chosen line */
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
  hoodie: { name: "THE HOODIE",     art: "hoodie",     type: "boss",   hp: 35,  dmg: 1.3, spd: 22, r: 22, acc: 160, boss: true },
  /* (2026-10-03, the brief's "Treasure Goblin") runs from you, never fights, gone in GOBLIN.flees seconds; a kill pays like a chest */
  goblin: { name: "Treasure Goblin", art: "dgoblin",    type: "flee",   hp: 1.4, dmg: 0,   spd: 62, r: 8,  acc: 520, flee: true, fleeFor: 14 } };
/** a monster's numbers at an area level */
/* PACKS (2026-10-03, the owner: "pack sizes should be at least quadrupled, with random 1 off monsters here and there"): 10-16 a pack (it was
   3-5), three packs a room, and 4-7 strays asleep on their own. The trash scaled down to match (TRASH: 55% health, 75% damage, half the XP
   a kill, fewer piles and drops per kill), so a room is about twice the fight it was and the drops per room about double, not four times. */
export const PACK = { size: [10, 16], packs: 3, strays: [4, 7] };
export const TRASH = { hp: 0.55, dmg: 0.75 };
export const monsterAt = (k, alvl) => { const M = MONSTERS[k], hp = Math.round((14 + alvl * 6) * M.hp * (M.boss ? 1 : TRASH.hp)), dmg = Math.round((3 + alvl * 0.9) * M.dmg * (M.boss ? 1 : TRASH.dmg)); return { ...M, k, lvl: alvl, hp, maxHp: hp, max: dmg }; };

/* ------------------------------------------------------------ ELITES (2026-10-03, the brief: "Elites ... Fast, Armored, Vampiric, Explosive, ... Storm, Summoner,
   Shielded. Limit stacking. Early: 1 modifier. Mid: 2. Deep endgame: maximum 3."). A pack may carry one elite: a bigger, named monster with
   2.6x health and 1.3x damage and one to three of these, rolled from the room's seed so every browser sees the same one. It pays 4x the
   XP, 3x the Gold, always drops gear (Magic or better) and finds legendaries more often. Drawn larger with an aura in its first modifier's colour. */
export const ELITES = {
  fast:      { name: "Fast",      says: "moves 45% faster",                       col: "#9ef0a0", mob: { spd: 1.45 } },
  armored:   { name: "Armored",   says: "takes 35% less damage",                  col: "#c8c8d0", armor: 0.35 },
  explosive: { name: "Explosive", says: "bursts into shots when it dies",         col: "#ff9a4a", burst: 12 },
  storm:     { name: "Storm",     says: "fires aimed bolts",                      col: "#d8ecff", pat: "aim", every: 2.6 },
  summoner:  { name: "Summoner",  says: "calls two guards when it wakes",         col: "#d8b4ff", summon: 2 },
  shielded:  { name: "Shielded",  says: "a shield takes its first three hits",    col: "#ffe27a", shield: 3 } };
export const ELITE = { chance: (tier) => Math.min(0.6, 0.15 + 0.015 * tier), modsAt: (tier) => (tier >= 30 ? 3 : tier >= 10 ? 2 : 1), hp: 2.6, dmg: 1.3, xp: 4, crowns: 3, scale: 1.25 };
/** a monster definition made elite: name, numbers, what its modifiers do */
export function eliteDef(d, mods = []) {
  const ms = mods.filter((k) => ELITES[k]); if (!ms.length) return d;
  d.elite = ms; d.name = `${ms.map((k) => ELITES[k].name).join(" ")} ${d.name}`; d.hp = d.maxHp = Math.round(d.hp * ELITE.hp); d.max = Math.round(d.max * ELITE.dmg); d.r = Math.round(d.r * 1.2);
  for (const k of ms) { const E = ELITES[k]; if (E.mob?.spd) d.spd *= E.mob.spd; if (E.armor) d.armor = (d.armor || 0) + E.armor; if (E.pat) { d.pat = E.pat; d.every = E.every; d.keep = 0; } if (E.shield) d.shield = E.shield; if (E.summon) d.summon = E.summon; if (E.burst) d.burst = E.burst; }
  return d;
}
/** which elite modifiers a pack's elite gets, from the room's rng (distinct) */
export function rollElite(tier, rnd) { const pool = Object.keys(ELITES), out = []; for (let i = 0; i < ELITE.modsAt(tier) && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return out; }
/* ROOM EVENTS (the brief: "Random dungeon events ... Treasure Goblin, Cursed Chest, Shrine ..."): about one room in three, never the last.
   A shrine heals you and gives +25% damage for the rest of the room (press E). A cursed chest opens for gear and Gold, and an ambush (E).
   The goblin is a monster (MONSTERS.goblin) that runs and vanishes; a kill pays three pieces of gear. Which one is the room's seed. */
export const EVENTS = { chance: 0.32, kinds: ["shrine", "chest", "goblin"], shrine: { dmg: 0.25 }, chest: { items: 2, ambush: 4, crowns: 6 }, goblin: { items: 3, crowns: 10 } };

/* ------------------------------------------------------------ BOSS TIERS (2026-10-03, the brief: "Normal, Veteran, Nightmare, Torment, Ascended ... stronger
   enemies, additional mechanics, better loot, exclusive drops ... Boss tier selection should happen in The Lounge before the party enters").
   Picked at the campaign door for an area with a boss; a tier opens when the one below is cleared (`progress.bosses[boss]` is how many are).
   Each tier multiplies the boss's health and damage and quickens his patterns; from Nightmare his ring calls guards, from Torment he
   ENRAGES under a share of his health (faster, harder), Ascended fires a second ring and always drops a Legendary. A clear pays BOSS SHARDS,
   the third currency: Hexa rerolls a Legendary's or a Set piece's line for them ("Modify Legendary properties later", now). */
export const BOSS_TIERS = [
  { k: "normal",    name: "Normal",    hp: 1,   dmg: 1,    every: 1,    shards: 1, says: "the boss as he is" },
  { k: "veteran",   name: "Veteran",   hp: 1.6, dmg: 1.25, every: 0.85, shards: 2, says: "tougher, and his patterns come sooner" },
  { k: "nightmare", name: "Nightmare", hp: 2.5, dmg: 1.5,  every: 0.75, shards: 3, adds: 2, says: "his ring calls two guards" },
  { k: "torment",   name: "Torment",   hp: 4,   dmg: 1.8,  every: 0.7,  shards: 5, adds: 2, enrage: 0.3, says: "and he enrages under 30% health" },
  { k: "ascended",  name: "Ascended",  hp: 6.5, dmg: 2.2,  every: 0.6,  shards: 8, adds: 3, enrage: 0.4, second: true, legendary: true, says: "a second ring, enraged under 40%, and a Legendary every time" } ];
export const SHARDS = { key: "shards", name: "Boss Shards", one: "Boss Shard", icon: "items/abyss_crystal.png", ex: "What a boss leaves behind. Hexa reworks a Legendary's line for them.",
  enchant: (it) => (it?.r === 3 ? 3 : 2) };
export const ENRAGE = { every: 0.7, dmg: 1.3 };
/** the boss at a tier: health, damage, the pace of his patterns, what the tier adds */
export function bossTierDef(d, btier = 0) {
  const B = BOSS_TIERS[btier | 0]; if (!B || !d.boss || !(btier | 0)) return d;
  d.btier = btier | 0; d.name = `${B.name} ${d.name}`; d.hp = d.maxHp = Math.round(d.hp * B.hp); d.max = Math.round(d.max * B.dmg); d.bossEvery = (d.bossEvery || 2.1) * B.every;
  if (B.adds) d.adds = B.adds; if (B.enrage) d.enrage = B.enrage; if (B.second) d.second = true; return d;
}
/** the number of a boss's tiers a character has cleared (0: none; Normal is always open) */
export const bossTop = (A, boss) => (A?.progress?.bosses?.[boss] | 0);
/** a Legendary's or a Set piece's line, rerolled in its own range (Hexa, for Boss Shards) */
export function rework(it, i, rnd = Math.random) {
  if (!validItem(it) || !(it.r === 3 || it.r === 4)) return { err: "Only a Legendary or a Set piece is reworked for Boss Shards." };
  i |= 0; const l = it.lines[i]; if (!l) return { err: "Pick one of the item's lines." };
  const [lo, hi] = rollRange(it, l.id), lines = it.lines.map((x) => ({ ...x })); lines[i] = { id: l.id, v: lo + Math.floor(rnd() * (hi - lo + 1)) };
  return { item: { ...it, lines } };
}

/* ------------------------------------------------------------ the campaign and maps (the owner: "a campaign to get users through the basics, and then maps") */
export const CAMPAIGN = [
  { act: 1, name: "The Cellars", art: "crypt", areas: [{ n: 1, name: "The Cellars I", alvl: 1, rooms: 4, pool: ["guard", "guard", "ghost"], boss: null },
    { n: 2, name: "The Cellars II", alvl: 4, rooms: 4, pool: ["guard", "ghost", "golem"], boss: null },
    { n: 3, name: "The Hoodie's Sanctum", alvl: 7, rooms: 4, pool: ["guard", "ghost", "golem"], boss: "hoodie", trial: true }] },
  { act: 2, name: "The Wild Woods (art from the Gloam and the Mire)", areas: [], todo: true },
  { act: 3, name: "The Frozen Reach (art from the Reach)", areas: [], todo: true }];
/* ------------------------------------------------------------ THE RIFTS (2026-10-03, the brief: "an endlessly scaling dungeon mode ... Rift 1, Rift 2 ... Rift 100+").
   Opened one at a time from Charon, the Rift Keeper, in the Lounge, once the campaign's last area (RIFTS.unlock) is cleared: clearing Rift t
   opens t + 1, and any cleared tier can be run again. A Rift is an area like any other (four generated rooms, the boss at the end) with the
   monsters' numbers scaled by the tier on top of the area level (which stops at the level cap), so Rift 60 is still harder than Rift 59.
   From Rift 5 a run rolls MODIFIERS (1 at 5-14, 2 at 15-29, 3 from 30), each adding to the rewards. The season's ladder is the highest Rift
   cleared. Perks stay rare: only the first clears of RIFTS.perkTiers offer one. Areas are numbered RIFTS.base + tier. */
export const RIFTS = { base: 100, unlock: 3, rooms: 4, pool: ["guard", "ghost", "golem"], boss: "hoodie", perkTiers: [5, 15, 30, 50],
  alvlAt: (t) => Math.min(LEVEL.cap, 8 + t * 2),
  scale: (t) => ({ hp: 1 + 0.05 * t, dmg: 1 + 0.03 * t }),
  reward: (t) => Math.min(1, 0.02 * t),   /* 2% more XP, drops and Gold per tier, up to double */
  note: "endless: clear one to open the next; modifiers from Rift 5" };
export const MAP_MODS = {
  tough:   { name: "Tough",    says: "Monsters have 40% more health",         reward: 0.15, mob: { hp: 1.4 } },
  fierce:  { name: "Fierce",   says: "Monsters hit 30% harder",               reward: 0.2,  mob: { dmg: 1.3 } },
  swift:   { name: "Swift",    says: "Monsters move 20% faster",              reward: 0.15, mob: { spd: 1.2 } },
  crowded: { name: "Crowded",  says: "An extra pack in every room",           reward: 0.15, packs: 1 },
  volley:  { name: "Volley",   says: "Ranged monsters fire 30% more often",    reward: 0.15, mob: { every: 0.7 } },
  drain:   { name: "Draining", says: "You regenerate 40% less mana",           reward: 0.1,  player: { mpRegen: 0.6 } },
  elite:   { name: "Elite",    says: "The boss has 60% more health",           reward: 0.1,  boss: { hp: 1.6 } },
  barrage: { name: "Barrage",  says: "The boss's patterns come 25% faster",    reward: 0.15, boss: { every: 0.75 } } };
export const modsFor = (tier) => (tier >= 30 ? 3 : tier >= 15 ? 2 : tier >= 5 ? 1 : 0);
/** the modifiers for a run of a tier: distinct, from rnd */
export function rollMods(tier, rnd = Math.random) { const pool = Object.keys(MAP_MODS), out = []; for (let i = 0; i < modsFor(tier) && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return out; }
/** how much more a run gives for its modifiers (0.15 = 15% more XP, item chance and Gold) */
export const modReward = (mods = []) => mods.reduce((a, k) => a + (MAP_MODS[k]?.reward || 0), 0);
export const isRift = (n) => n > RIFTS.base;
export const riftOf = (n) => (isRift(n) ? n - RIFTS.base : 0);
/** a Rift tier as an area (the same shape as a campaign area) */
export const riftArea = (t) => ({ n: RIFTS.base + t, name: `Rift ${t}`, act: 0, actName: "The Rifts", alvl: RIFTS.alvlAt(t), rooms: RIFTS.rooms, pool: RIFTS.pool, boss: RIFTS.boss, rift: true, tier: t });
/** any area by number: a campaign area (1, 2, 3, ...) or a Rift (101, 102, ...) */
export function areaOf(n) { if (isRift(n)) return riftArea(riftOf(n)); for (const a of CAMPAIGN) for (const x of a.areas) if (x.n === n) return { ...x, act: a.act, actName: a.name }; return null; }
/** a monster at an area level, with a run's modifiers and Rift tier baked in (the server and the page both use this, so a hit is judged on the same numbers) */
export function mobDef(k, alvl, mods = [], tier = 0, btier = 0) {
  const d = monsterAt(k, alvl), sc = tier > 0 ? RIFTS.scale(tier) : { hp: 1, dmg: 1 }; let hp = sc.hp, dmg = sc.dmg, spd = 1, every = 1, bossEvery = 1;
  for (const key of mods) { const M = MAP_MODS[key]; if (!M) continue; if (M.mob) { hp *= M.mob.hp || 1; dmg *= M.mob.dmg || 1; spd *= M.mob.spd || 1; every *= M.mob.every || 1; } if (d.boss && M.boss) { hp *= M.boss.hp || 1; bossEvery *= M.boss.every || 1; } }
  d.hp = d.maxHp = Math.round(d.hp * hp); d.max = Math.round(d.max * dmg); d.spd = d.spd * spd; if (d.every) d.every = d.every * every; d.bossEvery = 2.1 * bossEvery;
  return d.boss ? bossTierDef(d, btier) : d;
}
/** a character's numbers in a run with these modifiers (only Draining touches the player) */
export function applyPlayerMods(g, mods = []) { for (const k of mods) { const P = MAP_MODS[k]?.player; if (P?.mpRegen) g.mpRegen *= P.mpRegen; } return g; }
/** extra packs a room gets from the modifiers */
export const extraPacks = (mods = []) => mods.reduce((a, k) => a + (MAP_MODS[k]?.packs || 0), 0);

/* ------------------------------------------------------------ perks: rare, kept for the season (the owner: "the perks should appear way less/slower, and only persist through maps") */
export const PERKS = { bolt: ["One more projectile", "every shot fires one more in a spread"], dmg: ["+15% damage", "everything you do"], speed: ["+10% move speed", "you and your dodge"], dodge: ["Quicker dodge", "the roll comes back 25% sooner"],
  hp: ["+25 health", "for the season"], leech: ["3% leech", "of damage dealt heals you"], blast: ["Bigger blast", "the area skill hits wider and comes back a second sooner"], rare: ["Lucky", "drops 20% more often"] };
export const PERKS_MAX = 8;

/* ------------------------------------------------------------ THE SAVE (2026-10-03). The arena is live, so real characters exist. Every saved character
   carries `v`, the SAVE_V it was last written at; the server upgrades an older one step by step when it loads (arena-worker/src/arena.js
   `migrate`), so the season's data can change without breaking anyone mid-month. Bump SAVE_V and add a step there for any change to the shape. */
export const SAVE_V = 4;   /* 4 (2026-10-03, the reshape to the brief): the rarity ladder renumbered, chips became Essence, supplies became potions, buffs gone, legendaries keyed `lg` */

/* ------------------------------------------------------------ SALVAGE AND SELL (the brief: "Unwanted loot should become useful"). Two doors out of the bag:
   Brutus, the Blacksmith, SALVAGES a piece into ESSENCE (more for rarer); Dex, the Merchant, BUYS it for GOLD. Both from the Lounge. */
export const salvageEssence = (it) => [1, 2, 5, 15, 10][it.r | 0] + Math.floor((it.ilvl | 0) / 12);
export const sellValue = (it) => Math.max(1, Math.round((2 + (it.ilvl | 0) / 2) * (1 + Math.min(2, it.r | 0)) * (it.r >= 3 ? 3 : 1)));
/* respecs are FREE (the brief: "Respec should be inexpensive or free"). The function stays so nothing that calls it changes. */
export const respecCost = () => 0;

/* ============================================================ LEGENDARIES AND SETS (2026-10-03, the brief: "Legendary items should alter gameplay ... build-defining
   effects are more important than simply increasing numbers"; "Prefer 50 meaningful Legendaries over 500 generic ones").

   LEGENDARY (gold, rarity 3): a fixed name, slot and art (EastScape's own named gear), fixed lines whose numbers scale with the item level
   (each line rolls in its affix's range at that level, times the legendary's multiplier), and one POWER. A weapon legendary is for one class
   and drops only for it. SET PIECE (blue, rarity 4): the same shape with no power; wearing 2 and 4 of a set turns its bonuses on.
   Both drop rarely from anything (SPECIAL_DROP) and trade like any item. The Enchanter doesn't touch them yet (the brief: "Modify Legendary
   properties later"). Twelve and three sets to start; the plan is to grow them by boss (bosses drop their own). */
function rollIn([lo, hi], rnd = Math.random) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
const tierOrFirst = (id, ilvl) => affixTier(id, ilvl) || AFFIXES[id].tiers[0];
export const LEGENDARIES = {
  wrench:      { name: "The King's Wrench",        slot: "weapon",  style: "melee",   icon: "items/wrench.png",         lines: [["dmg", 1.3], ["critX", 1.2], ["lifeKill", 1]], power: ["Hits have a 15% chance to land twice", { double: 0.15 }], ex: "Four feet of rusted pipe. It has settled a great many arguments." },
  skyripper:   { name: "Skyripper",                slot: "weapon",  style: "archery", icon: "items/skyripper.png",      lines: [["dmg", 1.3], ["speed", 1.2]], power: ["Arrows pierce two more enemies", { pierce: 2 }], ex: "Strung with something that hums when the wind gets up." },
  rimeheart:   { name: "Rimeheart",                slot: "weapon",  style: "magic",   icon: "items/rimeheart.png",      lines: [["dmg", 1.3], ["manaKill", 1.3]], power: ["+1 projectile, and 25% more mana regeneration", { bolts: 1, mpRegenPct: 0.25 }], ex: "Cold to hold. Colder to be hit by." },
  grudge:      { name: "The Grudge Knife",         slot: "offhand",                   icon: "items/grudge.png",         lines: [["hp", 1.2], ["crit", 1.2]], power: ["Kills restore 3% of your health", { lifeKillPct: 0.03 }], ex: "It remembers everyone it has ever cut." },
  kingcrown:   { name: "The Pumpkin King's Crown", slot: "helm",                      icon: "items/king_crown.png",     lines: [["hp", 1.3], ["find", 1.2]], power: ["You take 10% less damage", { tough: 0.1 }], ex: "Still warm. It is October, after all." },
  bogplate:    { name: "Bog-Hound Hide",           slot: "body",                      icon: "items/bogplate.png",       lines: [["hp", 1.3], ["def", 1.2]], power: ["+25% maximum health", { hpPct: 0.25 }], ex: "Still damp. It will always be damp." },
  sharps:      { name: "Card Sharp's Gloves",      slot: "gloves",                    icon: "items/sharps_gloves.png",  lines: [["speed", 1.2], ["crit", 1.3]], power: ["Critical strikes deal ×2.25 instead of ×1.5", { critX: 0.75 }], ex: "There's still a card up one sleeve." },
  eightleague: { name: "Eight-League Boots",       slot: "boots",                     icon: "items/spiderboots.png",    lines: [["move", 1.3], ["hp", 1.1]], power: ["Your dodge comes back 40% sooner", { dodgePct: 0.4 }], ex: "Four boots, sewn into two. Nobody asks about the spider." },
  gambler:     { name: "The Gambler's Ring",       slot: "ring",                      icon: "items/gamblers_ring.png",  lines: [["dmg", 1.2], ["crowns", 1.3]], power: ["+30% more Gold and 15% more drops", { crownsPct: 0.3, find: 0.15 }], ex: "Never lucky twice. Always lucky once." },
  coffin:      { name: "The Coffin Ring",          slot: "ring",                      icon: "items/coffin_ring.png",    lines: [["dmg", 1.3], ["leech", 1]], power: ["Hits have a 10% chance to land twice", { double: 0.1 }], ex: "Coffin iron, with a coffin on it." },
  ferryman:    { name: "The Ferryman's Coin",      slot: "amulet",                    icon: "items/ferry_coin.png",     lines: [["hp", 1.2], ["mpRegen", 1.2]], power: ["Kills restore 5% of your mana and 2% of your health", { manaKillPct: 0.05, lifeKillPct: 0.02 }], ex: "Charon's own fare. He'll want it back." },
  hunter:      { name: "Hunter's Fang",            slot: "amulet",                    icon: "items/hunters_fang.png",   lines: [["pdmg", 1.2], ["critX", 1.2]], power: ["+1 projectile", { bolts: 1 }], ex: "A tooth from something that hunted back." } };
/* SETS: bonus = [[pieces worn, what it says, what it grants], ...]; pieces = { slot: [name, icon (null = the slot's base art), [[affix, multiplier], ...]] } */
export const SETS = {
  roller: { name: "High Roller", ex: "Dressed for the big table.",
    bonus: [[2, "+6% critical strike chance", { crit: 0.06 }], [4, "+60% critical strike damage and 10% faster skills", { critX: 0.6, speed: 0.1 }]],
    pieces: { helm: ["High Roller's Cap", "items/kingcap.png", [["hp", 1.1], ["crit", 1.1]]], gloves: ["High Roller's Grip", "items/clawgrip.png", [["speed", 1.1], ["critX", 1.1]]],
      ring: ["High Roller's Band", "items/deepheart.png", [["dmg", 1.1], ["crit", 1.1]]], amulet: ["High Roller's Tooth", "items/rex_necklace.png", [["pdmg", 1.1], ["critX", 1.1]]] } },
  night: { name: "The Night Shift", ex: "For the ones still standing at closing.",
    bonus: [[2, "+20% maximum health", { hpPct: 0.2 }], [4, "You take 12% less damage, and kills restore 3% of your health", { tough: 0.12, lifeKillPct: 0.03 }]],
    pieces: { helm: ["Night Shift Hood", "items/wraithhood.png", [["hp", 1.1], ["def", 1.1]]], body: ["Night Shift Coat", "items/ditched_coat.png", [["hp", 1.1], ["def", 1.1]]],
      boots: ["Night Shift Loafers", "items/stake_loafers.png", [["move", 1.1], ["hp", 1.1]]], amulet: ["Night Shift Sigil", "items/deep_sigil.png", [["hp", 1.1], ["lifeKill", 1.1]]] } },
  dealer: { name: "Dealer's Choice", ex: "The house dresses well.",
    bonus: [[2, "12% faster movement and 20% more drops", { move: 0.12, find: 0.2 }], [4, "+1 projectile and +15% damage", { bolts: 1, pdmg: 0.15 }]],
    pieces: { body: ["Dealer's Toga", "items/toga.png", [["hp", 1.1], ["def", 1.1]]], gloves: ["Dealer's Gloves", "items/bessemergloves.png", [["dmg", 1.1], ["speed", 1.1]]],
      ring: ["Dealer's Ring", "items/raptor_ring.png", [["dmg", 1.1], ["find", 1.1]]], offhand: ["Dealer's Shield", null, [["hp", 1.1], ["mp", 1.1]]] } } };
export const SPECIAL_DROP = { legendary: 0.02, set: 0.02, bossLegendary: 0.08, bossSet: 0.08, eliteLegendary: 0.05, eliteSet: 0.05 };
/** a legendary's or set piece's fixed shape: { name, slot, style, icon, lines: [[affix, multiplier]] }, or null for an ordinary item */
export function specFor(it) {
  if (it?.r === 3 && LEGENDARIES[it.lg]) { const U = LEGENDARIES[it.lg]; return { name: U.name, slot: U.slot, style: U.style || null, icon: U.icon, lines: U.lines }; }
  if (it?.r === 4 && SETS[it.s]?.pieces[it.slot]) { const [name, icon, lines] = SETS[it.s].pieces[it.slot]; return { name, slot: it.slot, style: null, icon, lines }; }
  return null;
}
/** the range a line ROLLS in on this item at its item level: the affix's tier there (times the multiplier for a legendary or set piece) */
export function rollRange(it, id) {
  const t = tierOrFirst(id, it.ilvl | 0), sp = specFor(it); if (!sp) return [t[1], t[2]];
  const m = (sp.lines.find((x) => x[0] === id) || [id, 1])[1]; return [Math.max(1, Math.round(t[1] * m)), Math.max(1, Math.round(t[2] * m))];
}
function special(r, key, sp, ilvl, rnd) {
  const base = baseFor(sp.slot, ilvl, sp.style || "magic");
  const it = { slot: sp.slot, ilvl, r, base: sp.name, tier: base.tier, style: sp.slot === "weapon" ? base.style : null, icon: sp.icon || base.icon, implicit: base.implicit, lines: [] };
  if (r === 3) it.lg = key; else it.s = key;
  it.lines = sp.lines.map(([id]) => ({ id, v: rollIn(rollRange(it, id), rnd) }));
  return it;
}
/** a legendary: any (for this class), or `key` */
export function rollLegendary(ilvl, { style = "magic", rnd = Math.random, key = null } = {}) {
  const keys = key ? [key] : Object.keys(LEGENDARIES).filter((k) => !LEGENDARIES[k].style || LEGENDARIES[k].style === style), k = keys[Math.floor(rnd() * keys.length)];
  return special(3, k, specFor({ r: 3, lg: k }), ilvl, rnd);
}
/** a set piece: any, or one of set `key`, or for `slot` */
export function rollSetPiece(ilvl, { rnd = Math.random, key = null, slot = null } = {}) {
  const all = Object.entries(SETS).flatMap(([s, S]) => Object.keys(S.pieces).map((sl) => [s, sl])).filter(([s, sl]) => (!key || s === key) && (!slot || sl === slot));
  if (!all.length) return null; const [s, sl] = all[Math.floor(rnd() * all.length)];
  return special(4, s, specFor({ r: 4, s, slot: sl }), ilvl, rnd);
}
/** what an item drop is: now and then a legendary or a set piece, otherwise an ordinary roll */
export function rollDrop(ilvl, { style = "magic", boss = false, elite = false, rnd = Math.random } = {}) {
  const x = rnd(), u = boss ? SPECIAL_DROP.bossLegendary : elite ? SPECIAL_DROP.eliteLegendary : SPECIAL_DROP.legendary, s = boss ? SPECIAL_DROP.bossSet : elite ? SPECIAL_DROP.eliteSet : SPECIAL_DROP.set;
  if (x < u) return rollLegendary(ilvl, { style, rnd }); if (x < u + s) return rollSetPiece(ilvl, { rnd });
  return rollItem(ilvl, { style, boss, elite, rnd });
}
/** what an item is called: a Common is its base ("Diamond Helm"); a Magic or Rare takes its first line's prefix and its second line's suffix
    ("Keen Diamond Helm of the Bear"); a Legendary or Set piece has its own name. The colour says the rarity. */
export function itemName(it) {
  if (!it) return ""; if (it.r >= 3 || !it.r || !it.lines?.length) return it.base || "";
  const pre = AFFIXES[it.lines[0]?.id]?.pre, suf = it.lines[1] ? AFFIXES[it.lines[1].id]?.suf : null;
  return `${pre ? `${pre} ` : ""}${it.base}${suf ? ` ${suf}` : ""}`;
}
/* A GRANT is the one shape every power and set bonus is written in. Keys: pdmg, speed, crit, critX, hpPct, mpPct, def, move, leech, find,
   crownsPct, bolts, pierce, double (chance a hit lands twice), lifeKill / manaKill (flat on a kill), lifeKillPct / manaKillPct (of the
   maximum, on a kill), dodgePct (faster dodge recovery), mpRegenPct, tough (damage taken, -0.1 = 10% MORE). arena-sim's statsFor adds them. */
const GKEY = { move: "spd", tough: "toughPlus" };
export function applyGrant(g, G) { for (const [k, v] of Object.entries(G || {})) { const key = GKEY[k] || k; g[key] = (g[key] || 0) + v; } return g; }
/** what a worn set turns on: { list: [{ from, says, g, kind }], sets: { setKey: pieces worn } } */
export function gearPowers(worn = {}) {
  const list = [], sets = {};
  for (const it of Object.values(worn || {})) { if (it?.r === 3 && LEGENDARIES[it.lg]) list.push({ from: LEGENDARIES[it.lg].name, says: LEGENDARIES[it.lg].power[0], g: LEGENDARIES[it.lg].power[1], kind: "legendary" }); if (it?.r === 4 && SETS[it.s]) sets[it.s] = (sets[it.s] || 0) + 1; }
  for (const [s, n] of Object.entries(sets)) for (const [need, says, g] of SETS[s].bonus) if (n >= need) list.push({ from: `${SETS[s].name} (${need} pieces)`, says, g, kind: "set" });
  return { list, sets };
}

/* ------------------------------------------------------------ THE ENCHANTER (Hexa, in the Lounge). The brief's one rule for rerolling: "Players should be
   able to alter one unwanted affix ... Once selected, that affix slot remains the rerollable slot." Pick a line on a Magic or Rare item, pay
   Essence, and it becomes a different line (one the slot can roll at this level, that the item doesn't have) with a fresh number; from then
   on only that line can be rerolled (`rr`). Legendaries and sets keep their lines for now ("Modify Legendary properties later"). */
export const ENCHANT = { cost: (it) => Math.round((it.r === 2 ? 12 : 6) + (it.ilvl | 0) / 2) };
export function enchant(it, i, rnd = Math.random) {
  if (!validItem(it)) return { err: "That item can't be enchanted." };
  if (!(it.r === 1 || it.r === 2)) return { err: it.r ? "Legendaries and set pieces keep their lines, for now." : "A Common item has no line to change." };
  i |= 0; if (!it.lines[i]) return { err: "Pick one of the item's lines." };
  if (it.rr != null && it.rr !== i) return { err: `This item's rerollable line is "${sayLine(it.lines[it.rr])}": once chosen, it stays.` };
  const pool = Object.keys(AFFIXES).filter((id) => AFFIXES[id].slots.includes(it.slot) && affixTier(id, it.ilvl) && !it.lines.some((l) => l.id === id));
  if (!pool.length) return { err: "There's no other line this item can take." };
  const id = pool[Math.floor(rnd() * pool.length)], lines = it.lines.map((x) => ({ ...x })); lines[i] = { id, v: rollIn(rollRange(it, id), rnd) };
  const out = { ...it, rr: i, lines }; return validItem(out) ? { item: out } : { err: "That line doesn't fit." };
}

/* ------------------------------------------------------------ POTIONS (the brief: "health potion or equivalent simple recovery mechanic"). Two, and
   nothing else to carry: a Health Potion on 4, a Mana Potion on 5, one of each every POTION_CD seconds, never at full. They drop (each
   player their own), Dex sells them, and only the ones you drink are used up. EastScape's bottle art. */
export const POTIONS = {
  health: { name: "Health Potion", icon: "items/pot_salve1.png", heal: 0.5, key: "4", ex: "Half your health back. Salt, mostly." },
  mana:   { name: "Mana Potion",   icon: "items/pot_star.png",   mana: 0.5, key: "5", ex: "Half your mana back. Bottled on a clear night." } };
export const POTION_CD = 6, POTION_MAX = 20, POTION_CHANCE = 0.035;   /* per kill, per player (a boss always drops one) */
export const POTION_SHOP = { health: 10, mana: 10 };   /* Gold each, at Dex */
export function potionDrop(rnd = Math.random, { boss = false, find = 0 } = {}) { if (!boss && rnd() >= POTION_CHANCE * (1 + find)) return null; return rnd() < 0.65 ? "health" : "mana"; }

/* ------------------------------------------------------------ DEX'S STOCK (the brief's Merchant: "Buy basic equipment"). A Common base for any slot at your
   level, for Gold, so a new player has something to spend on and no slot stays empty. The Gambler (random gear for Gold) comes later. */
export const gearPrice = (ilvl) => 8 + (ilvl | 0) * 2;

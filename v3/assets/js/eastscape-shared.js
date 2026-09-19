/* ============================================================
   EastScape — the rules both sides share

   The browser draws with this and the server (eastscape-worker)
   decides with it, so the two can never disagree about a map, an
   item, a level or a quest. Nothing in here touches the DOM, the
   network or Math.random: scenes are built from hashRand, so the
   same scene comes out tile-for-tile the same everywhere.

   Served from /v3/assets/js/, which is cached for a year: bump the
   ?v= in eastscape.html whenever this file changes, and redeploy the
   worker (cd eastscape-worker && npx wrangler deploy).
   ============================================================ */

// bump with every change to this file: the server says which version it runs, and a page on another version reloads
export const VERSION = 29;
export const COLS = 22, ROWS = 13;
export function hashRand(x, y, s = 1) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ------------------------------------------------------------ OSRS curve */
export const XP_AT = [0, 0];
{ let p = 0; for (let l = 1; l < 99; l++) { p += Math.floor(l + 300 * Math.pow(2, l / 7)); XP_AT[l + 1] = Math.floor(p / 4); } }
export const levelOf = (xp) => { let l = 1; while (l < 99 && xp >= XP_AT[l + 1]) l++; return l; };

/* ------------------------------------------------------------ things you can carry */
export const ITEMS = {
  coins: { name: "Cash", icon: "💵", nocap: true, ex: "The money of EastScape. Earned from quests and the Exchange." }, wheat: { name: "Wheat", icon: "🌾" }, bones: { name: "Bones", icon: "🦴" },
  beef: { name: "Raw beef", icon: "🥩" }, hide: { name: "Cowhide", icon: "🟫" }, chicken: { name: "Raw chicken", icon: "🍗" },
  feather: { name: "Feather", icon: "🪶" }, sardine: { name: "Raw sardine", icon: "🐟" }, trout: { name: "Raw trout", icon: "🐠" },
  copper: { name: "Copper ore", icon: "🟠" }, tin: { name: "Tin ore", icon: "⚪" }, logs: { name: "Logs", icon: "🪵" }, olives: { name: "Olives", icon: "🫒" },
  pork: { name: "Raw boar", icon: "🥓" }, tusk: { name: "Boar tusk", icon: "🦷" },
  tomatoe: { name: "Tomatoe", icon: "🍅", ex: "Nonna insists on the e. Nobody has ever won that argument." },
  goldtomatoe: { name: "Golden tomatoe", icon: "🍅", ex: "Heavy as a coin and warm as a hug. It hums when it's ripe." },
  husk: { name: "Hornworm husk", icon: "🐛", ex: "Still a little squishy. Still a little angry." },
  marble: { name: "Marble chunk", icon: "🪨", ex: "The same stone the Bank is made of. Someone will want this." },
  mask: { name: "Highwayman's mask", short: "Mask", icon: "🎭", slot: "helm", def: 1, acc: 1, ex: "Smells of the road. Makes you look shifty." },
  yewlogs: { name: "Ancient yew logs", icon: "🪵", ex: "Heavy, dark and faintly warm. The grain moves if you stare." },
  mooncarp: { name: "Raw moon carp", icon: "🐡", ex: "It's looking at you. It's always looking at you." },
  stardust: { name: "Stardust", icon: "✨", ex: "Warm, and humming a note you almost recognise." },
  sunolive: { name: "Sun olive", icon: "🫒", ex: "Glows in the dark. Tastes like a summer you never had." },
  grimstone: { name: "Grimstone ore", icon: "🟣", ex: "Heavy, cold, and it hums when nobody's holding it. Only found in the Deep Wild." },
  ashlogs: { name: "Deadwood logs", icon: "🪵", ex: "Grey all the way through. They burn with no smoke and a faint sigh." },
  gloomfin: { name: "Raw gloomfin", icon: "🐟", ex: "It has too many fins and not enough patience." },
  geode: { name: "Glimmering geode", icon: "💎", ex: "Found now and then by anyone gathering in the Deep Wild. Worth a lot to the right person. Everyone is the right person." },
  receipt: { name: "Tax receipt", icon: "🧾", ex: "Proof you paid. Paid what, and to whom? It won't say." },
  cobweb: { name: "Enormous cobweb", icon: "🕸️", ex: "Still sticky. Still somebody's home." },
  grudge: { name: "Grudge knife", short: "Grudge", icon: "🔪", slot: "weapon", acc: 9, str: 7, ex: "It remembers everyone it has ever cut, and it holds the grudges so you don't have to." },
  wraithhood: { name: "Tax Wraith hood", short: "Hood", icon: "🥷", slot: "helm", def: 4, acc: 2, ex: "Smells of paperwork. Faintly see-through." },
  bogplate: { name: "Bog-hound hide", short: "Hide", icon: "🦺", slot: "body", def: 7, ex: "Still damp. It will always be damp." },
  lantern: { name: "Lantern shield", short: "Lantern", icon: "🏮", slot: "shield", def: 6, acc: 1, ex: "A very small man lives inside the lantern. He keeps it lit. Don't knock." },
  menace: { name: "Ring of Mild Menace", short: "Menace", icon: "💍", slot: "ring", str: 3, acc: 2, ex: "Makes you about eleven percent more threatening. People notice, but can't say why." },
  spiderboots: { name: "Eight-league boots", short: "Boots", icon: "🥾", slot: "boots", def: 2, spd: 6, ex: "Four boots, sewn into two. Nobody asks what happened to the spider. You walk a little faster." },
  pit: { name: "Olive pit", icon: "🌰", ex: "It's still warm. And still angry." },
  monocle: { name: "Tiny monocle", icon: "🧐", ex: "The olive was wearing it. You feel slightly more distinguished just holding it." },
  manifesto: { name: "Goat's manifesto", icon: "📜", ex: "Mostly bleats. Page three is surprisingly moving." },
  // things you wear: a slot, and what they add. Tools go in the weapon hand and must be held to use.
  rudis: { name: "Wooden rudis", short: "Rudis", icon: "🗡️", slot: "weapon", acc: 4, str: 2 },
  pickaxe: { name: "Bronze pickaxe", short: "Pickaxe", icon: "⛏️", slot: "weapon", tool: "mining", acc: 1, str: 1 },
  axe: { name: "Bronze axe", short: "Axe", icon: "🪓", slot: "weapon", tool: "woodcutting", acc: 2, str: 2 },
  rod: { name: "Fishing rod", short: "Rod", icon: "🎣", slot: "weapon", tool: "fishing" },
  cap: { name: "Leather cap", short: "Cap", icon: "⛑️", slot: "helm", def: 1 },
  tunic: { name: "Tunic", icon: "🥋", slot: "body", def: 2 },
  // cooked food: click it in your bag to eat. heal is hitpoints back
  csardine: { name: "Cooked sardine", icon: "🐟", heal: 3, ex: "Crunchy. Mostly bones, some joy." },
  cchicken: { name: "Cooked chicken", icon: "🍗", heal: 3, ex: "Tastes like chicken. Waldy is relieved." },
  cbeef: { name: "Cooked beef", icon: "🥩", heal: 4, ex: "A good honest steak." },
  cpork: { name: "Roast boar", icon: "🍖", heal: 6, ex: "Crackling on the outside, grudge on the inside." },
  ctrout: { name: "Cooked trout", icon: "🐠", heal: 7, ex: "Flaky, buttery, and it no longer judges you." },
  cgloomfin: { name: "Cooked gloomfin", icon: "🐟", heal: 10, ex: "Still slightly annoyed. Very filling." },
  cmooncarp: { name: "Cooked moon carp", icon: "🐡", heal: 14, ex: "It glows faintly in your stomach. That's normal. Probably." },
  burnt: { name: "Burnt food", icon: "⚫", ex: "Whatever it was, it's charcoal now." },
  // the Gloam and Cloudreach (2026-09-18): where the tier ores actually live
  emerald_ore: { name: "Emerald ore", icon: "🟢", ex: "Green rock with greener bits. Smelt two for an Emerald bar." },
  diamond_ore: { name: "Diamond ore", icon: "💠", ex: "It was pressed into this shape in the dark for a very long time. It is not grateful." },
  dragonstone_ore: { name: "Dragonstone ore", icon: "🔴", ex: "Warm. Always warm. The clouds up there keep their distance from it." },
  onyx_ore: { name: "Onyx ore", icon: "⚫", ex: "Lightning hit this and it held on to some. Your hair stands up when you carry it." },
  willowlogs: { name: "Gloomwillow logs", icon: "🪵", ex: "Damp, dark and faintly glowing at the ends. They burn blue." },
  skyashlogs: { name: "Skyash logs", icon: "🪵", ex: "Light enough to float. Please don't let go of them." },
  lanternfish: { name: "Raw lanternfish", icon: "🐟", ex: "It has its own little light. It keeps it on even now." },
  clanternfish: { name: "Cooked lanternfish", icon: "🐟", heal: 12, ex: "The light goes out when it's cooked. That's how you know." },
  skyeel: { name: "Raw sky eel", icon: "🐍", ex: "Caught from a cloud, out of the open sky. It is very surprised about it too." },
  cskyeel: { name: "Cooked sky eel", icon: "🐍", heal: 16, ex: "Tastes like a thunderstorm smells." },
  // the Forge's Bronze set (Brutus sells it); req is what you need to wear it
  toga: { name: "Goat-sized toga", short: "Toga", icon: "🥻", slot: "body", def: 3, acc: 1, ex: "Smells of goat. Fits you perfectly, which is worrying." },
  parma: { name: "Parma", icon: "🛡️", slot: "shield", def: 3 },
  sandals: { name: "Sandals", icon: "🩴", slot: "boots", def: 1 }
};
// what a character looks like comes from their body armour: "tiro" (a recruit) unless it has a tier
export const outfitOf = (eq) => ITEMS[eq?.body]?.tier || "tiro";
export const SLOTS = ["helm", "amulet", "weapon", "body", "shield", "legs", "gloves", "boots", "ring"];
// the two jewelry slots, which gate on Hitpoints rather than Attack or Defence
export const JEWELRY = ["amulet", "ring"];

/* ------------------------------------------------------------ the gear ladder

   Five tiers, one every ten levels, generated rather than typed out: ten items
   a tier by hand is fifty chances to fat-finger a number, and level 100 means
   ten tiers. The knobs are the TIERS table; everything else is arithmetic.

   What gates what:
     weapons   Attack        (and the maul also wants Strength — it is the
                              heavy one, and it should be the Aggressive
                              player's reward for going that way)
     armour    Defence       so Defence cannot be skipped
     jewelry   Hitpoints     all-round bonuses, equal in each, which is the
                             shape RPG MO uses: Armor, Aim and Power the same
                             number, behind a Health requirement well above it

   Three weapons a tier, at roughly equal damage per second but very different
   feels: the gladius lands often for little, the maul rarely for a lot. Fast is
   better against something armoured, slow is better against something soft.
   ------------------------------------------------------------ */

// per-tier knobs. `set` is the whole suit's defence; `wAcc`/`wStr` are the
// middle weapon's, which the other two are scaled from; `jewel` is the ring's
// bonus, the same in all three stats.
export const TIERS = [
  { key: "bronze",      name: "Bronze",      gate: 10, set: 20, wAcc: 8,  wStr: 6,  jewel: 2, mark: "🟫", ex: "Soft, cheap and honest. It has saved more recruits than it has failed." },
  { key: "emerald",     name: "Emerald",     gate: 20, set: 34, wAcc: 12, wStr: 10, jewel: 3, mark: "🟩", ex: "Green glass that turned out not to be glass. It hums faintly in the cold." },
  { key: "diamond",     name: "Diamond",     gate: 30, set: 48, wAcc: 16, wStr: 14, jewel: 5, mark: "💎", ex: "Cuts everything, including the person carrying it, if they are careless." },
  { key: "dragonstone", name: "Dragonstone", gate: 40, set: 62, wAcc: 20, wStr: 18, jewel: 6, mark: "🔶", ex: "Warm to the touch, always, whatever the weather. Nobody asks why." },
  { key: "onyx",        name: "Onyx",        gate: 50, set: 76, wAcc: 24, wStr: 22, jewel: 8, mark: "⬛", ex: "Black all the way through. Light goes in and does not come back out." }
];
export const tierOf = (key) => TIERS.find((t) => t.key === key) || null;

// how a suit's defence is shared out, and what each piece is called
const ARMOUR = {
  body:   { share: 0.30, name: "cuirass", short: "Cuirass", icon: "🦺" },
  shield: { share: 0.25, name: "shield",  short: "Shield",  icon: "🛡️" },
  legs:   { share: 0.18, name: "greaves", short: "Greaves", icon: "👖" },
  helm:   { share: 0.15, name: "helm",    short: "Helm",    icon: "⛑️" },
  boots:  { share: 0.06, name: "boots",   short: "Boots",   icon: "🥾" },
  gloves: { share: 0.06, name: "gloves",  short: "Gloves",  icon: "🧤" }
};
// acc and str are multiples of the tier's middle weapon
const WEAPONS = {
  gladius: { name: "gladius", short: "Gladius", icon: "🔪", speed: 1800, acc: 1.3, str: 0.6, ex: "Quick, and it asks nothing of your shoulders." },
  sword:   { name: "longsword", short: "Sword", icon: "🗡️", speed: 2400, acc: 1.0, str: 1.0, ex: "The one everybody learns on, at every tier." },
  maul:    { name: "maul",    short: "Maul",    icon: "🔨", speed: 3000, acc: 0.7, str: 1.4, needsStr: true, ex: "Slow, stupid and enormous. When it lands, it lands." }
};

for (const t of TIERS) {
  for (const [slot, a] of Object.entries(ARMOUR)) {
    ITEMS[`${t.key}_${slot}`] = {
      name: `${t.name} ${a.name}`, short: a.short, icon: a.icon, slot,
      def: Math.round(t.set * a.share), tier: t.key,
      req: { skill: "defence", lvl: t.gate }, ex: t.ex
    };
  }
  for (const [kind, w] of Object.entries(WEAPONS)) {
    ITEMS[`${t.key}_${kind}`] = {
      name: `${t.name} ${w.name}`, short: w.short, icon: w.icon, slot: "weapon",
      acc: Math.round(t.wAcc * w.acc), str: Math.round(t.wStr * w.str), speed: w.speed, tier: t.key,
      req: w.needsStr
        ? [{ skill: "attack", lvl: t.gate }, { skill: "strength", lvl: t.gate }]
        : { skill: "attack", lvl: t.gate },
      ex: w.ex
    };
  }
  ITEMS[`${t.key}_amulet`] = {
    name: `${t.name} amulet`, short: "Amulet", icon: "📿", slot: "amulet",
    acc: t.jewel + 1, str: t.jewel + 1, def: t.jewel + 1, tier: t.key,
    req: { skill: "hp", lvl: t.gate },
    ex: "Heavier than it looks, and it sits right over the notch in your collarbone."
  };
  ITEMS[`${t.key}_ring`] = {
    name: `${t.name} ring`, short: "Ring", icon: "💍", slot: "ring",
    acc: t.jewel, str: t.jewel, def: t.jewel, tier: t.key,
    req: { skill: "hp", lvl: t.gate },
    ex: "Jewelry asks for a strong constitution and gives a little of everything back."
  };
}

/* A requirement is one {skill, lvl} or a list of them, so the maul can want
   both Attack and Strength. Both sides read it through here. */
export const reqsOf = (it) => (!it?.req ? [] : Array.isArray(it.req) ? it.req : [it.req]);export const missingReq = (c, it) => reqsOf(it).find((r) => lvlOf(c, r.skill) < r.lvl) || null;

/* What swapping to an item would do. Fifty-five pieces is too many to hold in
   your head, and "is this better" is the only question the inventory is really
   being asked. Returns nulls for anything that is not worn. */
export function compareOf(c, k) {
  const it = ITEMS[k];
  if (!it?.slot) return null;
  const now = { ...c, eq: { ...c.eq } };
  const then = { ...c, eq: { ...c.eq, [it.slot]: k } };
  const a = bonusOf(now), b = bonusOf(then);
  return {
    slot: it.slot, replacing: c.eq?.[it.slot] || null,
    acc: b.acc - a.acc, str: b.str - a.str, def: b.def - a.def,
    maxHit: [maxHitOf(now), maxHitOf(then)],
    swingMs: it.slot === "weapon" ? [swingMsOf(now), swingMsOf(then)] : null,
    missing: missingReq(c, it)
  };
}
/** The same thing as a short line of text, so every surface words it the same. */
export function compareText(c, k) {
  const d = compareOf(c, k);
  if (!d) return "";
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  const bits = [];
  for (const [q, label] of [["acc", "acc"], ["str", "str"], ["def", "def"]]) if (d[q]) bits.push(`${sign(d[q])} ${label}`);
  if (d.maxHit[0] !== d.maxHit[1]) bits.push(`max hit ${d.maxHit[0]}\u2192${d.maxHit[1]}`);
  if (d.swingMs && d.swingMs[0] !== d.swingMs[1]) bits.push(`swing ${(d.swingMs[0] / 1000).toFixed(1)}s\u2192${(d.swingMs[1] / 1000).toFixed(1)}s`);
  if (d.missing) return `Needs ${SKILLS[d.missing.skill].name} ${d.missing.lvl}`;
  if (!bits.length) return d.replacing === k ? "Already worn" : "No change";
  return bits.join(", ");
}
export const SKILLS = {
  attack: { name: "Attack", icon: "⚔️" }, strength: { name: "Strength", icon: "💪" }, defence: { name: "Defence", icon: "🛡️" },
  hp: { name: "Hitpoints", icon: "❤️" }, fishing: { name: "Fishing", icon: "🎣" }, cooking: { name: "Cooking", icon: "🍳" },
  farming: { name: "Harvesting", icon: "🌾" }, mining: { name: "Mining", icon: "⛏️" }, woodcutting: { name: "Woodcutting", icon: "🪓" },
  smithing: { name: "Smithing", icon: "🔨" }
};
export const COMBAT_SKILLS = ["attack", "strength", "defence"];
// how the skills panel groups them. Hitpoints sits with combat because that is
// the only place it is earned, even though it is not something you choose.
export const SKILL_GROUPS = [
  { name: "Combat", keys: ["attack", "strength", "defence", "hp"] },
  { name: "Skilling", keys: ["fishing", "cooking", "farming", "mining", "woodcutting", "smithing"] }
];

/* ------------------------------------------------------------ stances

   How a hit's xp is shared out. The rule that makes this work, and the one
   thing not to break: EVERY stance gives the same total. Four xp per point of
   damage to combat, plus four thirds to Hitpoints, whichever you pick. Only the
   destination changes.

   Break that and one stance becomes the fast one, everybody uses it, and the
   choice stops being about the character you are building. A stance that pays
   less is a trap for exactly the players who do not do the arithmetic.

   Thirds are kept as thirds rather than rounded to 1: at one damage, rounding
   1.33 down to 1 three times would quietly pay Controlled 3 instead of 4. Xp is
   a number, not an integer, and levels come off thresholds — so the fraction
   simply carries. Only the display rounds.
   ------------------------------------------------------------ */
export const COMBAT_XP = 4;        // per point of damage, split by the stance
export const HP_XP = 4 / 3;        // per point of damage, in every stance
export const DEFAULT_STANCE = "controlled";
export const STANCES = {
  accurate:   { name: "Accurate",   icon: "🎯", share: { attack: 1 },                       blurb: "Every hit teaches you to land the next one. Attack xp." },
  aggressive: { name: "Aggressive", icon: "💥", share: { strength: 1 },                     blurb: "Swing like you mean it. Strength xp, and a bigger maximum hit as it climbs." },
  defensive:  { name: "Defensive",  icon: "🛡️", share: { defence: 1 },                      blurb: "Watch what they do before you do it. Defence xp, and you get hit less." },
  controlled: { name: "Controlled", icon: "⚖️", share: { attack: 1 / 3, strength: 1 / 3, defence: 1 / 3 }, blurb: "A little of each. Slower to a milestone, further along everywhere." }
};
export const stanceOf = (c) => (STANCES[c?.stance] ? c.stance : DEFAULT_STANCE);
/** What one hit is worth, as [skill, xp] pairs. Always totals COMBAT_XP + HP_XP per damage. */
export function xpForDamage(c, dmg) {
  const out = [];
  for (const [skill, share] of Object.entries(STANCES[stanceOf(c)].share)) out.push([skill, COMBAT_XP * share * dmg]);
  out.push(["hp", HP_XP * dmg]);
  return out;
}

/* How long a swing takes. A weapon with no speed of its own swings at SWING_MS,
   which is what the game used for everything before weapons had speeds. */
export const SWING_MS = 2400;
export const swingMsOf = (c) => ITEMS[c?.eq?.weapon]?.speed || SWING_MS;
export const TOOL_OF = { mining: "pickaxe", woodcutting: "axe", fishing: "rod" };
export const INV_MAX = 30;
export const BANK_MAX = 200;
// a bag slot holds up to 99 of a thing; Cash (and anything marked nocap) piles up without limit. The bank has no cap.
export const STACK_MAX = 99;
export const capOf = (k) => (ITEMS[k]?.nocap ? Infinity : STACK_MAX);
// how many more of k the bag can take
export const roomFor = (inv, k) => {
  const cap = capOf(k), free = INV_MAX - inv.length;
  if (cap === Infinity) return inv.some((s) => s.k === k) || free > 0 ? Infinity : 0;
  return inv.reduce((r, s) => r + (s.k === k ? Math.max(0, cap - s.n) : 0), 0) + free * cap;
};
// top up the stacks already there, then open new ones; returns what didn't fit
export const addInv = (inv, k, n) => {
  const cap = capOf(k);
  for (const s of inv) { if (n <= 0) break; if (s.k === k && s.n < cap) { const t = Math.min(n, cap - s.n); s.n += t; n -= t; } }
  while (n > 0 && inv.length < INV_MAX) { const t = Math.min(n, cap); inv.push({ k, n: t }); n -= t; }
  return n;
};
// take up to n of k, from the last stacks first; returns how many were taken
// the bag's tidy order: Cash, tools, weapons and armour (by slot, best tier first), food, then everything else by name.
// Partial stacks of the same thing are merged back into 99s, so a sort can free slots.
export function sortInv(inv) {
  const tierRank = (k) => { const t = ITEMS[k]?.tier, i = TIERS.findIndex((x) => x.key === t); return i < 0 ? 99 : -i; };
  const group = (k) => { const it = ITEMS[k] || {}; return k === "coins" ? 0 : it.tool ? 1 : it.slot ? 2 + SLOTS.indexOf(it.slot) / 10 : it.heal ? 3 : 4; };
  const totals = new Map(); for (const s of inv) totals.set(s.k, (totals.get(s.k) || 0) + s.n);
  const keys = [...totals.keys()].sort((a, b) => group(a) - group(b) || tierRank(a) - tierRank(b) || (ITEMS[a]?.name || a).localeCompare(ITEMS[b]?.name || b));
  const out = []; for (const k of keys) addInv(out, k, totals.get(k));
  return out;
}
export const takeInv = (inv, k, n) => {
  let got = 0;
  for (let i = inv.length - 1; i >= 0 && got < n; i--) { const s = inv[i]; if (s.k !== k) continue; const t = Math.min(n - got, s.n); s.n -= t; got += t; if (!s.n) inv.splice(i, 1); }
  return got;
};       // different items the bank holds (stacks are unlimited)
export const EX_SLOTS = 8;         // Exchange offers a player can have open at once
export const EX_TAX = 0.01;        // the Exchange keeps 1% of every sale (rounded down); direct trades are free
export const TRADE_RANGE = 5;      // how close two players must stay to trade face to face
export const cashIn = (c) => c.inv.find((x) => x.k === "coins")?.n || 0;
export const fmtCash = (n) => `${Math.round(n).toLocaleString()} Cash`;

/* ------------------------------------------------------------ directions and reach */
export const DIRS = { "1,0": "east", "-1,0": "west", "0,1": "south", "0,-1": "north", "1,1": "south-east", "-1,1": "south-west", "1,-1": "north-east", "-1,-1": "north-west" };
export const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const SPAN = { n: [16, 18], s: [16, 18], e: [5, 7], w: [5, 7] }, OPP = { n: "s", s: "n", e: "w", w: "e" };
/* movement speed. Walking one tile takes STEP_MS; a speed bonus (boots, pets, potions later: an item's "spd", in %)
   shortens that. The first 20% counts in full, anything past it counts half, and the total can't pass +50%
   (about 6 tiles a second), so every upgrade is worth having but nothing stacks into chaos. The server times your
   steps with this and the page predicts with the same rule, so they always agree. */
export const STEP_MS = 240, SPEED_FULL = 20, SPEED_CAP = 50;
export function speedRaw(c, extra = 0) { let raw = extra; for (const k of Object.values(c.eq || {})) if (k && ITEMS[k]?.spd) raw += ITEMS[k].spd; return raw; }
export function speedBonus(c, extra = 0) { const raw = speedRaw(c, extra); return Math.max(0, Math.min(SPEED_CAP, Math.min(SPEED_FULL, raw) + Math.max(0, raw - SPEED_FULL) * 0.5)); }
export const stepMsOf = (c, extra = 0) => Math.round(STEP_MS / (1 + speedBonus(c, extra) / 100));
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// fishing reaches two tiles (the river's edge is a bank you can't stand on); everything else is next to you
export const reachOf = (kind) => (kind === "spot" || kind === "ferry" ? 2 : 1);
/** Where a recipe is made, in words, for the wiki and the anvil list. */
export const stationName = (id) => STATIONS[RECIPES[id]?.station]?.name || "";
export const inReach = (a, b, r) => { const d = cheb(a, b); return d >= 1 && d <= r; };

/* ------------------------------------------------------------ building scenes
   grid: . grass  , path  ~ water  s sand  p paving  P paved but blocked  b bank (water reaches it; nobody stands there)
         f soil: a picked wheat tile, walkable until the wheat grows back
         i indoor floor   v the dark outside a room (never walkable)
         # blocked by something  e exit (blue) */
const grid = (fill = ".") => Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
const block = (g, x, y, w = 1, h = 1) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = "#"; };
const keepOf = (sc) => [...sc.mobs.map(([, x, y]) => [x, y]), ...sc.npcs.map((n) => [n.x, n.y])];
export function markBanks(g) {
  const wetAt = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === "~") return true; return false; };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (".,s".includes(g[y][x]) && wetAt(x, y)) g[y][x] = "b";
    else if (g[y][x] === "b" && !wetAt(x, y)) g[y][x] = ".";
  }
}
// natural edges instead of a fence: forest, brush, rocks or water, deeper in some places than others, with the
// exits cut through. Runs after a scene's own things are placed, so it only fills open grass; then opens up (or
// fills in) anything cut off from the exits.
function wild(g, objs, exits, edges, keep = [], seed = 1) {
  const kept = new Set(keep.map(([x, y]) => `${x},${y}`)), rim = [];
  const wet = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === "~") return true; return false; };
  const put = (t, x, y) => { if (wet(x, y)) return; const ob = { t, x, y, name: { tree: "Tree", bush: "Bush", boulder: "Boulder" }[t] }; objs.push(ob); g[y][x] = "#"; rim.push(ob); };
  for (const d of ["n", "s", "w", "e"]) {
    const kind = edges[d] || "forest", len = d === "n" || d === "s" ? COLS : ROWS, dc = d.charCodeAt(0);
    if (kind !== "open") for (let i = 0; i < len; i++) {
      const nearExit = exits[d] && i >= SPAN[d][0] - 1 && i <= SPAN[d][1] + 1;
      const depth = nearExit ? 0 : Math.max(1, Math.min(3, Math.round(1.3 + Math.sin(i * 0.8 + seed * 3.1 + dc) * 0.9 + hashRand(i, seed, dc) * 0.9)));
      for (let k = 0; k < depth; k++) {
        const x = d === "w" ? k : d === "e" ? COLS - 1 - k : i, y = d === "n" ? k : d === "s" ? ROWS - 1 - k : i;
        if (g[y][x] !== "." || kept.has(`${x},${y}`)) continue;
        if (kind === "water") {
          let clear = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = g[y + dy]?.[x + dx]; if ((t && !".~".includes(t)) || kept.has(`${x + dx},${y + dy}`)) clear = false; }
          if (clear) { g[y][x] = "~"; rim.push({ x, y }); }
          continue;
        }
        const r = hashRand(x, y, seed + 11);
        const t = kind === "scrub" ? (r < 0.6 ? "bush" : "boulder") : kind === "rocky" ? (r < 0.45 ? "boulder" : r < 0.8 ? "tree" : "bush") : (r < 0.62 ? "tree" : r < 0.88 ? "bush" : "boulder");
        if (t === "tree" && k > 0 && hashRand(x, y, seed + 13) < 0.45) continue;   // woods, not a wall of forest
        if (kind === "scrub" && hashRand(x, y, seed + 14) < (k > 0 ? 0.6 : 0.3)) continue;   // clumps, not a hedge
        put(t, x, y);
      }
    }
    if (exits[d]) for (let i = SPAN[d][0]; i <= SPAN[d][1]; i++) { const x = d === "w" ? 0 : d === "e" ? COLS - 1 : i, y = d === "n" ? 0 : d === "s" ? ROWS - 1 : i; g[y][x] = "e"; }
  }
  for (let y = 2; y < ROWS - 2; y++) for (let x = 2; x < COLS - 2; x++) {
    if (g[y][x] !== "." || kept.has(`${x},${y}`)) continue;
    let open = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] !== ".") open = false;
    if (open && hashRand(x, y, seed + 21) < 0.04) put(hashRand(x, y, seed + 22) < 0.6 ? "bush" : "boulder", x, y);
  }
  for (const ob of objs) if (["tree", "bush", "boulder", "oak"].includes(ob.t) && wet(ob.x, ob.y)) { ob.gone = true; g[ob.y][ob.x] = "."; }
  for (let pass = 0; pass < 12; pass++) {
    markBanks(g);
    const q = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "e") q.push([x, y]);
    const seen = new Set(q.map(([x, y]) => y * COLS + x));
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * COLS + nx; if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen.has(k) && ".,sep".includes(g[ny][nx])) { seen.add(k); q.push([nx, ny]); } } }
    const stuck = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (".,sp".includes(g[y][x]) && !seen.has(y * COLS + x)) stuck.push([x, y]);
    if (!stuck.length) break;
    for (const [x, y] of stuck) {
      if (g[y][x] === "." && !kept.has(`${x},${y}`)) put(hashRand(x, y, seed + 41) < 0.3 ? "tree" : "bush", x, y);
      else for (const ob of rim) if (!ob.gone && Math.abs(ob.x - x) <= 1 && Math.abs(ob.y - y) <= 1) { ob.gone = true; g[ob.y][ob.x] = "."; }
    }
  }
  for (let i = objs.length - 1; i >= 0; i--) if (objs[i].gone) objs.splice(i, 1);
  markBanks(g);
}

export const SCENES = {
  farm: {
    name: "Ludus Farm", exits: { e: "river", n: "forum" },
    build() {
      const g = grid(), objs = [];
      for (let x = 13; x < COLS; x++) g[6][x] = ",";
      for (let y = 0; y < 6; y++) g[y][17] = ",";
      for (let y = 5; y < 10; y++) g[y][8] = ",";
      for (let x = 8; x < 14; x++) g[9][x] = ",";
      const house = { t: "house", img: "farmhouse", x: 2, y: 2, w: 5, h: 3, door: { x: 4, y: 4 }, name: "Farmhouse", enter: "farmhouse" }; objs.push(house);
      block(g, house.x, house.y, house.w, house.h);
      objs.push({ t: "well", x: 9, y: 2, name: "Well" }); g[3][9] = "#"; g[3][10] = "#";
      // the pond sits a row down from the top so its bank never runs under the treeline
      objs.push({ t: "pond", x: 12, y: 2, w: 3, h: 2 }); for (let y = 2; y < 4; y++) for (let x = 12; x < 15; x++) g[y][x] = "~";
      objs.push({ t: "hay", x: 7, y: 4, name: "Hay bale" }); g[4][7] = "#";
      // the way down to the Wilderness (PvP): the pit art is two tiles square, so its footprint is too (11,8 to 12,9)
      objs.push({ t: "hole", x: 11, y: 8, w: 2, h: 2, name: "Wilderness pit" }); block(g, 11, 8, 2, 2);
      for (let y = 6; y < 9; y++) for (const x of [2, 3]) { objs.push({ t: "wheat", x, y, name: "Wheat" }); g[y][x] = "#"; }
      for (const [x, y] of [[20, 2], [19, 11], [14, 11]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      objs.push({ t: "oak", x: 17, y: 8, name: "Oak tree" }); g[8][17] = "#";
      // the teaser: a tree you'll walk past for weeks before you can touch it, in its own clearing
      objs.push({ t: "yew", x: 8, y: 2, name: "Ancient Yew", special: true, req: { skill: "woodcutting", lvl: 60 }, log: "yewlogs", xp: 175, tease: "Its golden needles hum as you get close." }); g[2][8] = "#";
      const clearing = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) clearing.push([8 + dx, 2 + dy]);
      wild(g, objs, this.exits, { n: "forest", w: "forest", s: "water", e: "forest" }, [...keepOf(this), ...clearing], 1);
      return { g, objs, blobs: [] };
    },
    mobs: [["cow", 12, 5], ["cow", 19, 4], ["cow", 18, 10]],
    npcs: [{ name: "Bom Trady", art: "tom", quests: ["firewood", "cattle"], outOfWork: "I'm all out of work for you, rookie. You've earned your cleats.", x: 10, y: 5, still: true, hair: "#c86a2a", shirt: "#3a6ac8", pants: "#2a2a4a", lines: ["Mind the cows, gladiator. They blitz.", "Your pickaxe, axe and rod are in your bag. Hold the right one for the job.", "Town's north, through the gate. The river's east.", "Sundays I play. The rest of the week, I farm. Don't ask."] },
           { name: "Waldy", art: "waldy", x: 6, y: 9, hair: "#3a2a1a", shirt: "#8a3a2a", pants: "#4a3a2a", lines: ["Every champion started on cows.", "Hit them until they stop mooing. That's the whole trick.", "The bucket? Keeps the thoughts in.", "Don't go west of town. The olives have opinions."] }],
    bots: [{ name: "Crixus", level: 91, art: "legend" }]
  },
  river: {
    name: "River Bend", exits: { w: "farm" },
    build() {
      const g = grid(), objs = [];
      for (let y = 0; y < ROWS; y++) { if (y && y < ROWS - 1) g[y][16] = "s"; for (let x = 17; x < COLS; x++) g[y][x] = "~"; }
      objs.push({ t: "spot", x: 17, y: 4, name: "Fishing spot" }, { t: "spot", x: 17, y: 8, name: "Fishing spot" });
      objs.push({ t: "spot", x: 17, y: 6, name: "Moonlit Eddy", special: true, glow: "#d8c8ff", req: { skill: "fishing", lvl: 40 }, fish: "mooncarp", xp: 120, tease: "Something silver circles down there. It knows you're watching." });
      for (let x = 0; x < 16; x++) g[6][x] = ",";
      const house = { t: "house", img: "hut", x: 9, y: 1, w: 5, h: 3, door: { x: 11, y: 3 }, name: "Fisher's hut" }; objs.push(house);
      block(g, house.x, house.y, house.w, house.h);
      for (let x = 2; x <= 7; x++) { if (x !== 4) { g[8][x] = "#"; objs.push({ t: "fenceH", x, y: 8 }); } g[11][x] = "#"; }
      for (let y = 9; y <= 10; y++) { g[y][2] = "#"; g[y][7] = "#"; objs.push({ t: "fenceV", x: 2, y }, { t: "fenceV", x: 7, y }); }
      for (const [x, y] of [[3, 2], [14, 9], [6, 3]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (const [x, y] of [[9, 9], [10, 10], [11, 9]]) { objs.push({ t: "rock", ore: "copper", x, y, name: "Copper rock" }); g[y][x] = "#"; }
      objs.push({ t: "vein", ore: "copper", x: 12, y: 10, w: 2, h: 2, name: "Copper vein" }); block(g, 12, 10, 2, 2);
      objs.push({ t: "ferry", x: 17, y: 10, w: 2, h: 1, name: "Ferry" });
      // a clearing round the copper, so the rocks aren't buried in the treeline
      const clearing = []; for (let y = 8; y <= 12; y++) for (let x = 8; x <= 14; x++) clearing.push([x, y]);
      // the ferry landing: open shore south of the copper
      for (let y = 9; y <= 12; y++) clearing.push([15, y]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "open" }, [...keepOf(this), ...clearing], 2);
      return { g, objs, blobs: [] };
    },
    mobs: [["chicken", 4, 9], ["chicken", 5, 10], ["chicken", 6, 9], ["chicken", 3, 10]],
    npcs: [{ name: "Charon the Ferryman", x: 15, y: 11, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Islands. Everyone gets one. Nobody knows who's paying for them.", "I row, you ride. No refunds, no questions, no singing.", "Your island grows while you're away. Mine doesn't. I don't have one. It's fine."] },
      { name: "Old Tullius", art: "tullius", quests: ["catch"], x: 15, y: 6, hair: "#d8d8d8", shirt: "#5a7a3a", pants: "#3a3a2a", lines: ["The fish bite best where the water bubbles.", "Can't fish with a sword, lad. Hold your rod.", "Don't let the chickens fool you. One took my eye.", "That big copper vein never runs dry. Slow, mind."] }],
    bots: [{ name: "Spartacus", level: 77 }]
  },
  forum: {
    name: "The Forum", exits: { s: "farm", w: "grove", n: "tomato", e: "appia" },
    build() {
      const g = grid(), objs = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const dx = (x - 10.5) / 9.6, dy = (y - 5.6) / 5.4, wob = (hashRand(x, y, 51) - 0.5) * 0.22;
        if (dx * dx + dy * dy < 1 + wob) g[y][x] = "p";
      }
      // roads out of town on all four sides
      for (let y = 7; y < ROWS; y++) for (let x = 16; x <= 18; x++) g[y][x] = "p";
      for (let x = 0; x < 4; x++) for (let y = 5; y <= 7; y++) g[y][x] = "p";
      for (let y = 0; y < 5; y++) for (let x = 16; x <= 18; x++) g[y][x] = "p";
      for (let x = 18; x < COLS; x++) for (let y = 5; y <= 7; y++) g[y][x] = "p";
      const paved = g.map((r) => r.slice());
      const bath = { t: "house", img: "bank", x: 2, y: 2, w: 5, h: 3, door: { x: 4, y: 4 }, name: "Bank", roof: "#8a9aa8", wall: "#efe6d4", sign: "BANK", enter: "bathhouse" };
      const forge = { t: "house", img: "casino", x: 11, y: 1, w: 5, h: 3, door: { x: 13, y: 3 }, name: "Casino", roof: "#7a2a2a", wall: "#9a3a3a", enter: "casino" };
      objs.push(bath, forge); block(g, 2, 2, 5, 3); block(g, 11, 1, 5, 3);
      objs.push({ t: "fountain", x: 10, y: 6, w: 2, h: 2, name: "Fountain" }); block(g, 10, 6, 2, 2);
      objs.push({ t: "rock", ore: "stardust", x: 4, y: 8, name: "Fallen Star", special: true, glow: "#e0b0ff", req: { skill: "mining", lvl: 50 }, xp: 150, tease: "It landed during the games last spring. Nobody's managed to chip it since." }); g[8][4] = "#";
      // the smithy corner, left of Brutus's door: the furnace and the anvil side by side, Brutus between them and his shop
      objs.push({ t: "furnace", x: 10, y: 3, name: "Furnace" }); g[3][10] = "#";
      objs.push({ t: "anvil", x: 9, y: 3, name: "Anvil" }); g[3][9] = "#";
      // the Exchange: a market stall down in the south-west of the square, away from the shop front
      objs.push({ t: "stall", x: 7, y: 8, w: 2, h: 1, name: "Exchange stall" }); block(g, 7, 8, 2, 1);
      objs.push({ t: "statue", x: 15, y: 9, name: "Statue" }); g[9][15] = "#";
      objs.push({ t: "sign", x: 19, y: 3, name: "Signpost" }); g[3][19] = "#";
      for (const [x, y] of [[13, 9]]) { objs.push({ t: "bush", x, y, name: "Planter" }); g[y][x] = "#"; }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "#" && paved[y][x] === "p") g[y][x] = "P";
      // open ground in front of the Exchange so the treeline doesn't swallow Livia's stall
      const clear = []; for (let y = 9; y <= 11; y++) for (let x = 5; x <= 10; x++) clear.push([x, y]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, [...keepOf(this), ...clear], 4);
      return { g, objs, blobs: [] };
    },
    mobs: [],
    npcs: [{ name: "Brutus the Smith", x: 11, y: 4, still: true, opens: "shop", hair: "#2a1a10", shirt: "#5a3a2a", pants: "#3a2a1a", lines: ["Tools, bronze, and I'll buy whatever you dug up. Fair prices. Mostly fair.", "Bronze is where it starts. Nobody walks into the Wilderness in a tunic twice.", "Brought ore? I'll take it. Brought a goat? Take it back."] },
      { name: "Livia the Broker", x: 8, y: 7, still: true, opens: "exchange", reach: 2, hair: "#2a1a10", shirt: "#c89a2a", pants: "#3a2a1a", lines: ["Selling? Buying? Use the stall. I just take my 1%.", "Offers keep working while you sleep. Come back and collect.", "The best price wins, and whoever was there first."] },
           { name: "Gaius", x: 13, y: 7, hair: "#5a3a2a", shirt: "#9a3a5a", pants: "#3a2a3a", pigeon: true, lines: ["PIGEON: Coo. The Forge buys ore. Coo.", "PIGEON: He doesn't talk. I do the talking. Coo.", "PIGEON: The Bank keeps your things safe. Aurelia counts everything twice. Coo.", "PIGEON: West is the Olive Grove. Bring a sword. Seriously. Coo.", "PIGEON: North is Tomatoe Hill. Don't correct her spelling. Coo.", "PIGEON: East is the Via Appia. Highwaymen. Hold on to your Cash. Coo."] }],
    bots: [{ name: "Gannicus", level: 55 }, { name: "Naevia", level: 31 }]
  },
  grove: {
    name: "Olive Grove", exits: { e: "forum", w: "gloam" },
    build() {
      const g = grid(), objs = [];
      for (let x = 13; x < COLS; x++) g[6][x] = ",";
      for (const [x, y] of [[2, 2], [5, 2], [8, 2], [2, 5], [5, 5], [8, 5], [3, 8], [6, 8]]) { objs.push({ t: "olive", x, y, name: "Olive tree" }); g[y][x] = "#"; }
      for (const [x, y] of [[18, 2], [20, 9], [13, 11]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      objs.push({ t: "olive", x: 18, y: 4, name: "Sun Olive tree", picks: 3, special: true, req: { skill: "farming", lvl: 35 }, crop: "sunolive", xp: 60, tease: "The olives glow like little suns. The Angry Olives won't go near it." }); g[4][18] = "#";
      objs.push({ t: "hive", x: 15, y: 2, name: "Beehive" }, { t: "hive", x: 16, y: 2, name: "Beehive" }); g[2][15] = "#"; g[2][16] = "#";
      objs.push({ t: "shrine", x: 2, y: 10, w: 2, h: 1, name: "Shrine" }); block(g, 2, 10, 2, 1);
      objs.push({ t: "fire", x: 12, y: 8, name: "Campfire" }); g[8][12] = "#";
      for (const [x, y] of [[8, 10], [9, 11], [10, 10]]) { objs.push({ t: "rock", ore: "tin", x, y, name: "Tin rock" }); g[y][x] = "#"; }
      wild(g, objs, this.exits, { w: "water", n: "rocky", s: "forest", e: "forest" }, keepOf(this), 3);
      return { g, objs, blobs: [] };
    },
    mobs: [["olive", 11, 3], ["olive", 13, 4], ["olive", 11, 6], ["boar", 15, 9], ["boar", 17, 4], ["goat", 17, 10]],
    npcs: [],
    bots: [{ name: "Agron", level: 23 }]
  }
};
// where a brand-new character appears: just outside the farmhouse door
Object.assign(SCENES, {
  // north of the Forum: a hill of tomato vines, a giant tomato, and a Nonna who insists on the spelling
  tomato: {
    name: "Tomatoe Hill", exits: { s: "forum", n: "cloud" },
    build() {
      const g = grid(), objs = [];
      for (let y = 6; y < ROWS; y++) g[y][17] = ",";
      for (let x = 3; x <= 17; x++) g[6][x] = ",";
      // two rows of vines, with walking room between them
      for (const y of [8, 10]) for (let x = 3; x <= 8; x++) { objs.push({ t: "vine", x, y, name: "Tomatoe vine", crop: "tomatoe", xp: 10, picks: 3 }); g[y][x] = "#"; }
      objs.push({ t: "bigtomato", x: 10, y: 2, w: 3, h: 3, name: "The Big Tomatoe" }); block(g, 10, 2, 3, 3);
      objs.push({ t: "press", x: 14, y: 3, w: 2, h: 1, name: "Tomatoe press" }); block(g, 14, 3, 2, 1);
      for (const x of [14, 15]) { objs.push({ t: "crate", x, y: 5, name: "Crate of tomatoes" }); g[5][x] = "#"; }
      objs.push({ t: "scarecrow", x: 6, y: 4, name: "Scarecrow" }); g[4][6] = "#";
      // the teaser
      objs.push({ t: "vine", x: 19, y: 3, name: "Golden Tomatoe vine", special: true, glow: "#ffd84a", req: { skill: "farming", lvl: 50 }, crop: "goldtomatoe", xp: 70, picks: 2, tease: "The tomatoes on this one are gold. Actual gold. Nonna guards it with her eyes." }); g[3][19] = "#";
      wild(g, objs, this.exits, { n: "forest", w: "forest", e: "forest", s: "forest" }, keepOf(this), 5);
      return { g, objs, blobs: [] };
    },
    mobs: [["rotten", 12, 8], ["rotten", 14, 10], ["rotten", 11, 11], ["hornworm", 19, 6], ["hornworm", 15, 8]],
    npcs: [{ name: "Nonna Tomatoe", x: 13, y: 7, still: true, hair: "#e8e8e8", shirt: "#c43a3a", pants: "#3a2a2a", lines: ["Tomatoe. With an e. Say it back to me.", "The big one? That's the Big Tomatoe. It was here before the town. Probably before the hill.", "The rotten ones walk at night. And in the day. Mostly they just walk.", "The golden vine is not for you. Not yet. Maybe not ever."] }],
    bots: [{ name: "Oenomaus", level: 38 }]
  },
  // west of the Olive Grove: a wood where it is always five minutes before dark. Levels 20-38.
  gloam: {
    name: "The Gloam", ground: "gloam", exits: { e: "grove" }, tint: "rgba(8,30,48,.32)",
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 8; x < COLS; x++) g[6][x] = ",";
      for (let y = 3; y <= 6; y++) g[y][8] = ",";
      for (let x = 3; x <= 8; x++) g[3][x] = ",";
      // the black pond, fished from its south bank
      for (let y = 8; y <= 10; y++) for (let x = 2; x <= 6; x++) g[y][x] = "~";
      for (const x of [3, 5]) objs.push({ t: "spot", x, y: 8, name: "Lantern pool", req: { skill: "fishing", lvl: 30 }, fish: "lanternfish", xp: 95, glow: "#7ad8ff", tease: "Little lights drift under the surface. They move away when you lean closer." });
      for (let x = 2; x <= 7; x++) keep.push([x, 7]);
      for (const [x, y] of [[17, 3], [18, 4], [16, 9]]) { objs.push({ t: "rock", ore: "emerald_ore", x, y, name: "Emerald rock", req: { skill: "mining", lvl: 20 }, xp: 45, tease: "Green glints in the rock. Your pickaxe isn't up to it yet." }); g[y][x] = "#"; }
      for (const [x, y] of [[4, 1], [6, 1]]) { objs.push({ t: "rock", ore: "diamond_ore", x, y, name: "Diamond rock", req: { skill: "mining", lvl: 30 }, xp: 65, tease: "Something in there catches light that isn't here." }); g[y][x] = "#"; }
      for (const [x, y] of [[11, 2], [13, 10], [10, 10]]) { objs.push({ t: "willow", x, y, name: "Gloomwillow", log: "willowlogs", req: { skill: "woodcutting", lvl: 35 }, xp: 110, tease: "The fronds close up around the trunk when you raise your axe." }); g[y][x] = "#"; }
      objs.push({ t: "fire", x: 12, y: 7, name: "Campfire" }); g[7][12] = "#";
      for (let x = 8; x < COLS; x++) keep.push([x, 5], [x, 7]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 9);
      return { g, objs, blobs: [] };
    },
    mobs: [["moth", 15, 5], ["moth", 19, 8], ["moth", 14, 3], ["ghoul", 9, 9], ["ghoul", 7, 4], ["understudy", 3, 5]],
    npcs: [], bots: []
  },
  // north off Tomatoe Hill, up past the tops of the vines: an island of cloud in the open sky. Levels 40-55.
  cloud: {
    name: "Cloudreach", ground: "cloud", exits: { s: "tomato" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let y = 4; y < ROWS; y++) { g[y][16] = ","; g[y][17] = ","; }
      for (let x = 5; x <= 17; x++) g[4][x] = ",";
      // a hole in the cloud: the sky below, and eels in it, fished from its east side
      for (let y = 7; y <= 9; y++) for (let x = 8; x <= 11; x++) g[y][x] = "~";
      for (const y of [7, 9]) objs.push({ t: "spot", x: 11, y, name: "Hole in the cloud", req: { skill: "fishing", lvl: 50 }, fish: "skyeel", xp: 150, glow: "#bfe8ff", tease: "Long shapes swim through the open sky below. Your line isn't long enough yet." });
      for (let y = 6; y <= 10; y++) keep.push([12, y]);
      for (const [x, y] of [[4, 7], [5, 9], [3, 9]]) { objs.push({ t: "rock", ore: "dragonstone_ore", x, y, name: "Dragonstone rock", req: { skill: "mining", lvl: 40 }, xp: 90, tease: "Red crystal, warm through your gloves. It laughs at your pickaxe." }); g[y][x] = "#"; }
      for (const [x, y] of [[14, 2], [16, 2]]) { objs.push({ t: "rock", ore: "onyx_ore", x, y, name: "Storm-struck onyx", req: { skill: "mining", lvl: 50 }, xp: 120, tease: "Black stone, still crackling from the last lightning. Not yet." }); g[y][x] = "#"; }
      for (const [x, y] of [[7, 2], [3, 5], [13, 11]]) { objs.push({ t: "skyash", x, y, name: "Skyash", log: "skyashlogs", req: { skill: "woodcutting", lvl: 50 }, xp: 150, tease: "The leaves ring like little bells. Your axe would just bounce off." }); g[y][x] = "#"; }
      objs.push({ t: "fire", x: 14, y: 6, name: "Cloud-fire" }); g[6][14] = "#";
      for (let x = 5; x <= 17; x++) keep.push([x, 3], [x, 5]);
      for (let y = 5; y < ROWS; y++) keep.push([15, y], [18, y]);
      wild(g, objs, this.exits, { n: "water", s: "water", w: "water", e: "water" }, [...keepOf(this), ...keep], 10);
      return { g, objs, blobs: [] };
    },
    mobs: [["ram", 6, 6], ["ram", 7, 11], ["angel", 14, 9], ["angel", 12, 2], ["goose", 9, 5]],
    npcs: [], bots: []
  },
  // east of the Forum: the great road, a toll post, highwaymen, and a barricade where the road washed out
  appia: {
    name: "Via Appia", exits: { w: "forum" },
    build() {
      const g = grid(), objs = [];
      for (let x = 0; x < 19; x++) for (let y = 5; y <= 7; y++) g[y][x] = "p";
      for (const x of [2, 6, 10, 14]) for (const y of [3, 9]) { objs.push({ t: "cypress", x, y, name: "Cypress" }); g[y][x] = "#"; }
      for (const x of [4, 12]) { objs.push({ t: "milestone", x, y: 4, name: "Milestone" }); g[4][x] = "#"; }
      objs.push({ t: "toll", x: 16, y: 3, w: 2, h: 1, name: "Toll post" }); block(g, 16, 3, 2, 1);
      // the road washed out here; the Bandit Camp is beyond, for later
      for (let y = 4; y <= 8; y++) { objs.push({ t: "barricade", x: 19, y, name: "Barricade" }); g[y][19] = "#"; }
      objs.push({ t: "chariot", x: 8, y: 9, w: 2, h: 1, name: "Abandoned chariot" }); block(g, 8, 9, 2, 1);
      objs.push({ t: "mule", x: 11, y: 10, name: "Mule" }); g[10][11] = "#";
      objs.push({ t: "rock", ore: "marble", x: 3, y: 10, name: "Marble outcrop", special: true, glow: "#ffffff", req: { skill: "mining", lvl: 30 }, xp: 65, tease: "Pure white marble. The Bank was built from this hill. Your pickaxe just bounces." }); g[10][3] = "#";
      wild(g, objs, this.exits, { n: "forest", s: "rocky", w: "forest", e: "forest" }, keepOf(this), 6);
      return { g, objs, blobs: [] };
    },
    mobs: [["highwayman", 5, 2], ["highwayman", 12, 11], ["highwayman", 17, 10]],
    npcs: [{ name: "Centurion Vibius", x: 16, y: 4, still: true, hair: "#3a2a1a", shirt: "#9a2a2a", pants: "#6a5a4a", lines: ["Halt. Toll's waived. The road's closed past the barricade anyway.", "Highwaymen on my road. When you can swing a sword properly, come and see me.", "The Bandit Camp's past the washout. When the road's fixed, we go in.", "That mule has not moved in eleven years. I respect it."] }],
    bots: []
  }
});
// everyone starts (and wakes up after dying) on the casino floor: GAMBA is the casino, the world is outside it
export const START = { scene: "casino", x: 10, y: 9 };

/* interiors: a room in the middle of the dark. "e" tiles on the room's bottom edge lead back out to exitTo.
   Rooms are drawn by the page from their floor kind and objects; nothing grows or spawns indoors. */
function room(x0, y0, x1, y1, doorX) {
  const g = grid("v");
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = "i";
  g[y1 + 1][doorX] = "e"; g[y1 + 1][doorX + 1] = "e";
  return g;
}
Object.assign(SCENES, {
  // the scene key stays "bathhouse" so saved characters standing in it still load; everything a player sees says Bank
  bathhouse: {
    name: "The Bank", interior: true, floor: "marble", room: [4, 3, 17, 10], exitTo: { scene: "forum", x: 4, y: 5 }, entry: { x: 10, y: 10 },
    // on the back wall, left to right: a banner, a lamp, the vault door, a lamp, a banner
    wall: [{ t: "banner", x: 6 }, { t: "lamp", x: 8.5 }, { t: "vault", x: 10.5 }, { t: "lamp", x: 12.5 }, { t: "banner", x: 15 }],
    build() {
      const g = room(4, 3, 17, 10, 10), objs = [];
      // the bank counter runs wall to wall; the tellers work behind it
      for (const x of [6, 10, 14]) objs.push({ t: "booth", x, y: 4, name: "Bank booth" });
      objs.push({ t: "counter", x: 4, y: 4, w: 14, h: 1, name: "Counter" }); block(g, 4, 4, 14, 1);
      // a red runner from the door to the counter (you walk on it)
      objs.push({ t: "rug", x: 10, y: 5, w: 2, h: 6, color: "#9a2a2a", name: "Runner" });
      for (const [x, y] of [[4, 6], [17, 6], [4, 9], [17, 9]]) { objs.push({ t: "column", x, y, name: "Column" }); g[y][x] = "#"; }
      for (const [x, y] of [[5, 5], [16, 5], [6, 10], [15, 10]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      objs.push({ t: "bench", x: 6, y: 7, w: 3, h: 1, name: "Bench" }); block(g, 6, 7, 3, 1);
      objs.push({ t: "bench", x: 13, y: 7, w: 3, h: 1, name: "Bench" }); block(g, 13, 7, 3, 1);
      objs.push({ t: "goatstatue", x: 7, y: 9, name: "Statue" }); g[9][7] = "#";
      objs.push({ t: "chest", x: 14, y: 9, name: "Strongbox" }); g[9][14] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Aurelia", x: 10, y: 3, still: true, opens: "bank", reach: 2, hair: "#1a1a2a", shirt: "#3a6a8a", pants: "#2a2a3a", lines: ["Welcome to the Bank. Your things are safe with us. Mostly.", "Use any booth. I'm the one counting.", "Two hundred different things we'll hold for you. Stack them as high as you like."] }]
  },
  // WEST of the casino, the first stop on the skilling line: a bit of everything a beginner gathers
  workyard: {
    name: "The Workyard", exits: { e: "casino" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 7; x < COLS; x++) g[6][x] = ",";
      for (const [x, y] of [[4, 3], [7, 2], [10, 3], [5, 10], [8, 11]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      objs.push({ t: "oak", x: 13, y: 2, name: "Oak tree" }); g[2][13] = "#";
      for (const [x, y] of [[16, 2], [17, 3], [18, 2]]) { objs.push({ t: "rock", ore: "copper", x, y, name: "Copper rock" }); g[y][x] = "#"; }
      for (const [x, y] of [[17, 10], [18, 11], [19, 10]]) { objs.push({ t: "rock", ore: "tin", x, y, name: "Tin rock" }); g[y][x] = "#"; }
      for (let y = 5; y < 8; y++) for (const x of [3, 4]) { objs.push({ t: "wheat", x, y, name: "Wheat" }); g[y][x] = "#"; }
      // a fishing pond, fished from its north bank
      for (let y = 9; y <= 10; y++) for (let x = 11; x <= 14; x++) g[y][x] = "~";
      objs.push({ t: "spot", x: 12, y: 9, name: "Fishing spot" }, { t: "spot", x: 13, y: 9, name: "Fishing spot" });
      for (let x = 10; x <= 15; x++) keep.push([x, 8], [x, 7]);
      objs.push({ t: "fire", x: 9, y: 4, name: "Campfire" }); g[4][9] = "#";
      for (let x = 7; x < COLS; x++) keep.push([x, 5], [x, 7]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, [...keepOf(this), ...keep], 12);
      return { g, objs, blobs: [] };
    },
    mobs: [], npcs: [], bots: []
  },
  // EAST of the casino, the first stop on the combat line: things a beginner can win a fight with
  paddock: {
    name: "The Paddock", exits: { w: "casino" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x <= 14; x++) g[6][x] = ",";
      objs.push({ t: "hay", x: 9, y: 3, name: "Hay bale" }, { t: "hay", x: 10, y: 3, name: "Hay bale" }); g[3][9] = "#"; g[3][10] = "#";
      objs.push({ t: "fire", x: 8, y: 9, name: "Campfire" }); g[9][8] = "#";
      for (const [x, y] of [[3, 2], [19, 11], [2, 10]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (let x = 0; x <= 14; x++) keep.push([x, 5], [x, 7]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "rocky" }, [...keepOf(this), ...keep], 13);
      return { g, objs, blobs: [] };
    },
    mobs: [["chicken", 5, 3], ["chicken", 7, 4], ["chicken", 4, 9], ["chicken", 6, 10], ["cow", 12, 3], ["cow", 14, 9], ["cow", 16, 4], ["rotten", 18, 8], ["rotten", 19, 3]],
    npcs: [], bots: []
  },
  // inside the Casino: a hangout first, a gambling den second. Games of chance for Cash (never ZCoins), the
  // daily-task board, a bar, and Dex, who has seen everything and will tell you about most of it.
  /* GAMBA's hub (2026-09-19): the casino is the middle of the world and where everyone starts. Four ways out, as on
     the owner's map: NORTH the upper floors (Floor 2 is the Roulette Room), WEST the skilling line, EAST the combat
     line, SOUTH the town (crafting: the smithy and the market). The side archways are real exits at the grid's edge;
     the south door is the building's front door onto the Forum. */
  casino: {
    name: "The Casino", interior: true, floor: "casino", wallH: 34, room: [1, 3, 20, 10], exits: { w: "workyard", e: "paddock" }, exitTo: { scene: "forum", x: 13, y: 4 }, entry: { x: 10, y: 10 },
    wall: [{ t: "banner", x: 2.5 }, { t: "lamp", x: 4.5 }, { t: "lamp", x: 7.5 }, { t: "lamp", x: 11 }, { t: "lamp", x: 17 }, { t: "banner", x: 19 }],
    build() {
      const g = room(1, 3, 20, 10, 10), objs = [];
      for (let y = SPAN.w[0]; y <= SPAN.w[1]; y++) { g[y][0] = "e"; g[y][COLS - 1] = "e"; }
      objs.push({ t: "bar", x: 12, y: 4, w: 4, h: 1, name: "Bar" }); block(g, 12, 4, 4, 1);
      objs.push({ t: "notice", x: 6, y: 3, name: "Task board" }); g[3][6] = "#";
      objs.push({ t: "walldoor", x: 9, y: 2, name: "Floor 2: the Roulette Room", enter: "roulette" });
      objs.push({ t: "roulsign", x: 9, y: 1, name: "Roulette", dy: -3 });
      for (const y of [3, 8, 10]) { objs.push({ t: "slots", x: 1, y, name: "Slot machine", flip: true }); g[y][1] = "#"; }
      for (const y of [3, 9]) { objs.push({ t: "slots", x: 20, y, name: "Slot machine" }); g[y][20] = "#"; }
      objs.push({ t: "cointable", x: 6, y: 6, w: 2, h: 1, name: "Coin Flip table" }); block(g, 6, 6, 2, 1);
      objs.push({ t: "dicetable", x: 14, y: 7, w: 2, h: 1, name: "Dice table" }); block(g, 14, 7, 2, 1);
      objs.push({ t: "rug", img: "rug_casino", x: 9, y: 8, w: 4, h: 3, color: "#5a1a2a", name: "Rug" });
      for (const [x, y] of [[17, 10], [4, 10]]) { objs.push({ t: "sofa", x, y, w: 2, h: 1, name: "Sofa" }); block(g, x, y, 2, 1); }
      for (const [x, y] of [[20, 4], [3, 3], [7, 10], [14, 10]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Dex the Dealer", art: "dex", x: 13, y: 3, still: true, reach: 2, hair: "#1a1a1a", shirt: "#9a2a2a", pants: "#1a1a1a", lines: [
      "Welcome in. Slots on the left, coins in the middle, dice by the bar. The house always wins, a little.",
      "Broke? Happens to the best of us. The board by the door has jobs that pay. Fresh ones every morning.",
      "Biggest win I've seen? Someone hit three sevens on that end machine. Bought everyone a drink. We don't sell drinks.",
      "Every roll's decided by the house, fair and square. I just hand over the money.",
      "No ZCoins in here, friend. Cash only. What happens in EastScape stays in EastScape."] },
      { name: "DookieBetts", art: "dookie", x: 15, y: 6, still: true, reach: 2, hair: "#1a1a1a", shirt: "#c8102e", pants: "#1a1a1a", lines: [
        "One more roll. Just one. Then one more after that. Then we'll talk.",
        "You're up? That's the dice telling you to bet bigger. You're down? That's the dice telling you you're due.",
        "Roll under five. Twenty-four times your money. Honestly it'd be irresponsible NOT to.",
        "I haven't left this table since the doors opened. My island's all weeds now. Worth it.",
        "Broke? Beautiful. Board by the door pays for chopping logs. Chop, come back, roll. That's a business plan.",
        "Coin flip's fifty-fifty. That means you literally cannot lose half the time. Do the math. Then bet it all.",
        "Last week I lost my pickaxe, my boots and my good trousers in one night. Best night of my life.",
        "Scared money don't make money. Scared money doesn't make anything. Put the whole stack on it.",
        "The sevens are hot tonight. They're always hot. That's why I sleep here.",
        "You walking away? On THIS streak? Nah. Nah nah nah. One more."] }]
  },
  // through the curtains at the back of the Casino: one big table everyone plays at once
  roulette: {
    name: "The Roulette Room", interior: true, floor: "casino", carpet: "t_roulette", room: [4, 3, 17, 10], exitTo: { scene: "casino", x: 9, y: 4 }, entry: { x: 10, y: 10 },
    wall: [{ t: "banner", x: 5 }, { t: "lamp", x: 7.5 }, { t: "lamp", x: 10.5 }, { t: "lamp", x: 13.5 }, { t: "banner", x: 16.5 }],
    build() {
      const g = room(4, 3, 17, 10, 10), objs = [];
      objs.push({ t: "roulette", x: 8, y: 5, w: 4, h: 2, name: "Roulette table" }); block(g, 8, 5, 4, 2);
      for (const [x, y] of [[5, 9], [15, 9]]) { objs.push({ t: "sofa", x, y, w: 2, h: 1, name: "Sofa" }); block(g, x, y, 2, 1); }
      for (const [x, y] of [[4, 4], [17, 4], [4, 7], [17, 7]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Rouge the Croupier", art: "rouge", x: 10, y: 4, still: true, reach: 3, hair: "#1a1a1a", shirt: "#1a1a1a", pants: "#1a1a1a", lines: [
      "Place your bets. The wheel waits for no one, but it does wait twenty-five seconds.",
      "Red, black, odd, even, a dozen or a single number. A single number pays thirty-six times. It also mostly doesn't.",
      "Everyone at this table plays the same spin. Win together, lose together. Mostly lose together.",
      "No more bets once the ball is rolling. I will know.",
      "Zero is green, and zero belongs to the house. Nothing personal."] }]
  },
  farmhouse: {
    name: "The Farmhouse", interior: true, floor: "wood", room: [6, 4, 15, 10], exitTo: { scene: "farm", x: 4, y: 5 }, entry: { x: 10, y: 10 },
    wall: [{ t: "herbs", x: 9.5 }, { t: "shelf", x: 11.5 }, { t: "window", x: 13.5 }],
    build() {
      const g = room(6, 4, 15, 10, 10), objs = [];
      objs.push({ t: "rug", x: 9, y: 5, w: 5, h: 4, color: "#6a7a3a", name: "Rug" });
      objs.push({ t: "range", x: 7, y: 4, w: 2, h: 1, name: "Range" }); block(g, 7, 4, 2, 1);
      objs.push({ t: "table", x: 10, y: 6, w: 3, h: 2, name: "Table" }); block(g, 10, 6, 3, 2);
      objs.push({ t: "barrel", x: 15, y: 4, name: "Barrel" }); g[4][15] = "#";
      objs.push({ t: "barrel", x: 14, y: 4, name: "Barrel" }); g[4][14] = "#";
      objs.push({ t: "bed", x: 6, y: 8, w: 1, h: 2, name: "Bed" }); block(g, 6, 8, 1, 2);
      for (const x of [9, 13]) { objs.push({ t: "chair", x, y: 7, name: "Stool" }); g[7][x] = "#"; }
      objs.push({ t: "sack", x: 6, y: 5, name: "Flour sack" }); g[5][6] = "#";
      objs.push({ t: "cat", x: 7, y: 9, name: "Cat" }); g[9][7] = "#";
      objs.push({ t: "bucket", x: 15, y: 9, name: "Bucket" }); g[9][15] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Cassia", x: 12, y: 9, still: true, hair: "#8a3a1a", shirt: "#e8e0c8", pants: "#6a5a4a", lines: ["Mind the range, it's hot. Cooking lessons start soon.", "Bom eats like three gladiators.", "If you catch fish, I can teach you to cook them. Soon."] }]
  }
});
// island land: an ellipse of grass with a sand edge (the edge next to the water becomes bank)
function isleLand(g, cx, cy, rx, ry) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) g[y][x] = ".";
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === ".") { let wet = false; for (const [dx, dy] of D8) if (g[y + dy]?.[x + dx] === "~") wet = true; if (wet) g[y][x] = "s"; }
}
function isleBuild(tier) {
  const g = grid("~"), objs = [], big = tier >= 2;
  if (big) isleLand(g, 10.5, 6, 10.3, 5.6); else isleLand(g, 10.5, 5.5, 8.6, 4.9);
  // the dock: planks out to the ferry; the far end takes you back to River Bend
  const d0 = big ? 11 : 10;
  for (let y = d0; y < ROWS; y++) for (const x of [10, 11]) g[y][x] = y === ROWS - 1 ? "e" : "p";
  objs.push({ t: "dock", x: 10, y: d0, w: 2, h: ROWS - d0 });
  objs.push({ t: "boatback", x: 12, y: 11, w: 2, h: 1, name: "Ferry" });
  // the Far Shore: a bridge off the east side
  if (tier >= 3) { for (let y = 5; y <= 7; y++) { g[y][COLS - 1] = "e"; for (let x = 19; x < COLS - 1; x++) g[y][x] = "p"; } objs.push({ t: "dock", x: 19, y: 5, w: 2, h: 3 }); }
  const house = { t: "house", img: "cottage", x: 8, y: 1, w: 5, h: 3, door: { x: 10, y: 3 }, name: "Cottage", enter: "home" }; objs.push(house); block(g, 8, 1, 5, 3);
  const plots = big ? [[3, 5], [4, 5], [5, 5], [6, 5], [3, 7], [4, 7], [5, 7], [6, 7], [7, 5], [8, 5], [7, 7], [8, 7]] : [[4, 5], [5, 5], [6, 5], [7, 5], [4, 7], [5, 7], [6, 7], [7, 7]];
  plots.forEach(([x, y], i) => { objs.push({ t: "plot", i, x, y, name: "Plot" }); g[y][x] = "#"; });
  const peds = big ? [[13, 5], [15, 5], [17, 5], [13, 7], [15, 7], [17, 7], [13, 9], [15, 9], [17, 9]] : [[13, 5], [15, 5], [17, 5], [13, 7], [15, 7], [17, 7]];
  peds.forEach(([x, y], i) => { objs.push({ t: "pedestal", i, x, y, name: "Pedestal" }); g[y][x] = "#"; });
  if (big) { objs.push({ t: "pen", x: 4, y: 9, w: 3, h: 1, name: "Pet pen" }); block(g, 4, 9, 3, 1); }
  else { objs.push({ t: "pen", x: 13, y: 9, w: 3, h: 1, name: "Pet pen" }); block(g, 13, 9, 3, 1); }
  objs.push({ t: "islesign", x: 8, y: 9, name: "Island sign" }); g[9][8] = "#";
  for (const [x, y] of big ? [[3, 3], [18, 3], [2, 8], [19, 9]] : [[4, 3], [16, 3], [3, 8]]) { objs.push({ t: "palm", x, y, name: "Tree" }); g[y][x] = "#"; }
  markBanks(g);
  return { g, objs, blobs: [] };
}

/* the Wilderness: down the pit on the farm. pvp: anyone can attack anyone. The Cage is a fenced ring where
   fights cost nothing; beyond it, and in the Deep Wild, monsters come for you and dying can cost you. */
Object.assign(SCENES, {
  wild: {
    name: "The Wilderness", pvp: true, exits: { n: "deep" }, entry: { x: 3, y: 10 }, tint: "rgba(60,20,70,.26)",
    cage: [6, 3, 12, 6], cageOut: { x: 9, y: 9 },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 3; x <= 17; x++) g[10][x] = ",";
      for (let y = 0; y < 10; y++) g[y][17] = ",";
      for (let y = 8; y < 10; y++) g[y][9] = ",";
      objs.push({ t: "rope", x: 2, y: 10, name: "Rope" }); g[10][2] = "#";
      // the Cage: iron bars round a ring, one gap at the bottom
      for (let x = 5; x <= 13; x++) { objs.push({ t: "cageH", x, y: 2 }); g[2][x] = "#"; if (x !== 9) { objs.push({ t: "cageH", x, y: 7 }); g[7][x] = "#"; } }
      for (let y = 3; y <= 6; y++) for (const x of [5, 13]) { objs.push({ t: "cageV", x, y }); g[y][x] = "#"; }
      for (let y = 3; y <= 6; y++) for (let x = 6; x <= 12; x++) { g[y][x] = "s"; keep.push([x, y]); }
      objs.push({ t: "cagesign", x: 8, y: 8, name: "The Cage" }); g[8][8] = "#";
      for (const [x, y] of [[15, 3], [20, 7]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      objs.push({ t: "skeleton", x: 12, y: 11, name: "Skeleton" }); g[11][12] = "#";
      for (const [x, y] of [[15, 8], [20, 2], [3, 5]]) { objs.push({ t: "snag", x, y, name: "Dead tree" }); g[y][x] = "#"; }
      for (let x = 3; x <= 17; x++) keep.push([x, 10], [x, 9]);
      wild(g, objs, this.exits, { n: "rocky", s: "rocky", w: "rocky", e: "rocky" }, [...keepOf(this), ...keep], 7);
      return { g, objs, blobs: [] };
    },
    mobs: [["gnasher", 16, 6], ["gnasher", 20, 10], ["gnasher", 4, 3]],
    npcs: [], bots: []
  },
  deep: {
    name: "The Deep Wild", pvp: true, exits: { s: "wild" }, tint: "rgba(50,10,45,.38)", xpMul: 1.5, luck: 0.1, geode: 0.01,
    build() {
      const g = grid(), objs = [], keep = [];
      for (let y = 7; y < ROWS; y++) g[y][17] = ",";
      for (let x = 4; x <= 17; x++) g[7][x] = ",";
      // the Black Pool, fished from two tiles back
      for (let y = 2; y <= 4; y++) for (let x = 2; x <= 6; x++) g[y][x] = "~";
      for (const x of [3, 5]) objs.push({ t: "spot", x, y: 4, name: "Black pool", req: { skill: "fishing", lvl: 20 }, fish: "gloomfin", xp: 80, glow: "#b080ff", tease: "The water is black and very still. Something down there is even stiller." });
      for (let y = 5; y <= 6; y++) for (let x = 2; x <= 7; x++) keep.push([x, y]);
      for (const [x, y] of [[10, 3], [12, 2], [13, 4]]) { objs.push({ t: "rock", ore: "grimstone", x, y, name: "Grimstone rock", req: { skill: "mining", lvl: 20 }, xp: 60, tease: "Cold purple stone. Your pickaxe skids right off." }); g[y][x] = "#"; }
      for (const [x, y] of [[8, 10], [10, 11], [13, 10]]) { objs.push({ t: "deadtree", x, y, name: "Deadwood tree", log: "ashlogs", req: { skill: "woodcutting", lvl: 20 }, xp: 70, tease: "Grey, hard as bone. Your axe just bounces." }); g[y][x] = "#"; }
      for (const [x, y] of [[20, 3], [7, 12], [19, 11]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      objs.push({ t: "skeleton", x: 15, y: 9, name: "Skeleton" }); g[9][15] = "#";
      for (const [x, y] of [[9, 5], [16, 2]]) { objs.push({ t: "snag", x, y, name: "Dead tree" }); g[y][x] = "#"; }
      for (let x = 4; x <= 17; x++) keep.push([x, 7], [x, 8], [x, 6]);
      for (let y = 7; y < ROWS; y++) keep.push([16, y], [18, y]);
      wild(g, objs, this.exits, { n: "rocky", s: "rocky", w: "rocky", e: "rocky" }, [...keepOf(this), ...keep], 8);
      return { g, objs, blobs: [] };
    },
    mobs: [["taxwraith", 15, 4], ["taxwraith", 19, 6], ["chandelier", 5, 10], ["chandelier", 20, 9], ["revenant", 11, 9]],
    npcs: [], bots: []
  },
  /* a player's island: one layout per upgrade tier (isle, isle2, isle3), plus the Far Shore past isle3's bridge
     and the cottage inside. Keys are "<layout>:<owner id>". What's planted, shown and painted lives on the owner's
     character (c.isle); the server sends it with each snapshot. Plot and pedestal numbers carry over between tiers. */
  isle: { name: "Island", island: true, exitTo: { scene: "river", x: 15, y: 10 }, entry: { x: 10, y: 10 }, build() { return isleBuild(1); }, mobs: [], npcs: [], bots: [] },
  isle2: { name: "Island", island: true, wikiHide: true, exitTo: { scene: "river", x: 15, y: 10 }, entry: { x: 10, y: 10 }, build() { return isleBuild(2); }, mobs: [], npcs: [], bots: [] },
  isle3: { name: "Island", island: true, wikiHide: true, exits: { e: "shore" }, exitTo: { scene: "river", x: 15, y: 10 }, entry: { x: 10, y: 10 }, build() { return isleBuild(3); }, mobs: [], npcs: [], bots: [] },
  shore: {
    name: "The Far Shore", island: true, exits: { w: "isle3" },
    build() {
      const g = grid("~"), objs = [];
      isleLand(g, 11, 6, 8.6, 5.3);
      for (let y = 5; y <= 7; y++) { g[y][0] = "e"; for (let x = 1; x <= 3; x++) g[y][x] = "p"; }
      objs.push({ t: "dock", x: 1, y: 5, w: 3, h: 3 });
      [[6, 3], [7, 3], [8, 3], [9, 3], [6, 9], [7, 9], [8, 9], [9, 9]].forEach(([x, y], k) => { objs.push({ t: "plot", i: 12 + k, x, y, name: "Plot" }); g[y][x] = "#"; });
      [[13, 4], [15, 4], [17, 4], [13, 8], [15, 8], [17, 8]].forEach(([x, y], k) => { objs.push({ t: "pedestal", i: 9 + k, x, y, name: "Pedestal" }); g[y][x] = "#"; });
      objs.push({ t: "lighthouse", x: 10, y: 1, w: 2, h: 2, name: "Lighthouse" }); block(g, 10, 1, 2, 2);
      objs.push({ t: "pen", x: 11, y: 10, w: 4, h: 1, name: "Pet pen" }); block(g, 11, 10, 4, 1);
      for (const [x, y] of [[18, 6], [5, 8], [16, 2]]) { objs.push({ t: "palm", x, y, name: "Tree" }); g[y][x] = "#"; }
      markBanks(g);
      return { g, objs, blobs: [] };
    },
    mobs: [], npcs: [], bots: []
  },
  home: {
    name: "The Cottage", interior: true, home: true, floor: "wood", room: [5, 3, 16, 10], exitTo: { scene: "isle", x: 10, y: 4 }, entry: { x: 10, y: 10 },
    wall: [{ t: "window", x: 8 }, { t: "shelf", x: 11 }, { t: "window", x: 14 }],
    build() {
      // the furniture that comes with it; the rest of the floor is left open for your own, later
      const g = room(5, 3, 16, 10, 10), objs = [];
      objs.push({ t: "range", x: 5, y: 3, w: 2, h: 1, name: "Hearth" }); block(g, 5, 3, 2, 1);
      objs.push({ t: "bed", x: 16, y: 3, w: 1, h: 2, name: "Bed" }); block(g, 16, 3, 1, 2);
      objs.push({ t: "rug", x: 8, y: 5, w: 6, h: 4, color: "#3a6a8a", name: "Rug" });
      objs.push({ t: "chest", x: 15, y: 3, name: "Chest" }); g[3][15] = "#";
      objs.push({ t: "plant", x: 5, y: 10, name: "Potted fern" }); g[10][5] = "#";
      objs.push({ t: "plant", x: 16, y: 10, name: "Potted fern" }); g[10][16] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [], npcs: [], bots: []
  }
});

// scene keys: most are a SCENES key; a player's island is "isle:<owner id>", every island built from SCENES.isle
export const sceneDef = (key) => SCENES[String(key).split(":")[0]];
export const isIsle = (key) => /^(isle\d?|shore|home):/.test(String(key));
export const ownerOf = (key) => (isIsle(key) ? String(key).slice(String(key).indexOf(":") + 1) : null);
// which island layout an owner's island uses, by upgrade tier
export const isleKey = (isle, id) => `${["isle", "isle", "isle2", "isle3"][isle?.tier || 1]}:${id}`;
// the same scene, built the same way everywhere; every object gets its index as its id
export function buildScene(key) {
  const sc = sceneDef(key), b = sc.build.call(sc);
  markBanks(b.g);
  b.objs.forEach((o, i) => { o.id = i; o.w ??= 1; o.h ??= 1; });
  return b;
}
export const walkableIn = (g, x, y, swim = false) => x >= 0 && y >= 0 && x < COLS && y < ROWS && (swim ? ".,sepfib~" : ".,sepfi").includes(g[y][x]);
export const canStepIn = (g, x, y, dx, dy, swim = false) => walkableIn(g, x + dx, y + dy, swim) && (!dx || !dy || (walkableIn(g, x + dx, y, swim) && walkableIn(g, x, y + dy, swim)));
// 8-way BFS with no corner cutting. reach 0: stand on it; n: stand within n tiles of it
export function findPath(g, from, to, reach = 0) {
  const key = (x, y) => y * COLS + x, prev = new Map([[key(from.x, from.y), null]]), q = [{ x: from.x, y: from.y }];
  const done = (c) => { const d = cheb(c, to); return reach ? d >= 1 && d <= reach : d === 0; };
  if (done(from)) return [];
  while (q.length) {
    const c = q.shift();
    if (done(c)) { const p = []; let k = key(c.x, c.y); while (k != null) { p.unshift({ x: k % COLS, y: Math.floor(k / COLS) }); k = prev.get(k); } p.shift(); return p; }
    for (const [dx, dy] of D8) { const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny); if (!prev.has(k) && canStepIn(g, c.x, c.y, dx, dy)) { prev.set(k, key(c.x, c.y)); q.push({ x: nx, y: ny }); } }
  }
  return null;
}
// the tile an object is worked from: the footprint cell nearest to you
export function nearestCell(ob, from) {
  const x = Math.max(ob.x, Math.min(from.x, ob.x + (ob.w || 1) - 1)), y = Math.max(ob.y, Math.min(from.y, ob.y + (ob.h || 1) - 1));
  return { x, y };
}

/* ------------------------------------------------------------ monsters */
// drops: [item, n] always; [item, [lo, hi]] a range; [item, n, chance] sometimes
// every mob is tagged small, medium or large (s/m/l); xl is for bosses. Ask for the size when adding one.
export const MOB_SIZES = { s: "Small", m: "Medium", l: "Large", xl: "Boss" };
export const MOBS = {
  cow: { name: "Cow", size: "m", lvl: 2, hp: 8, att: 1, def: 1, max: 1, speed: 3000, oy: 11, box: [14, 21], drops: [["beef", 1], ["hide", 1], ["bones", 1]] },
  chicken: { name: "Chicken", size: "s", lvl: 1, hp: 3, att: 1, def: 1, max: 1, speed: 2400, oy: 11, box: [6, 16], drops: [["chicken", 1], ["feather", [5, 15]], ["bones", 1]] },
  olive: { name: "Angry Olive", size: "s", lvl: 6, hp: 12, att: 5, def: 4, max: 2, speed: 2600, box: [6, 16], drops: [["olives", [2, 5]], ["pit", 1], ["monocle", 1, 0.1]] },
  boar: { name: "Wild boar", size: "m", lvl: 8, hp: 16, att: 6, def: 6, max: 2, speed: 2800, box: [15, 23], drops: [["pork", 1], ["tusk", 1], ["bones", 1]] },
  rotten: { name: "Rotten Tomatoe", size: "s", lvl: 4, hp: 10, att: 3, def: 2, max: 1, speed: 2600, box: [6, 15], drops: [["tomatoe", [1, 3]], ["husk", 1, 0.05]] },
  hornworm: { name: "Tomatoe Hornworm", size: "m", lvl: 7, hp: 15, att: 6, def: 5, max: 2, speed: 2800, box: [15, 13], drops: [["husk", 1], ["tomatoe", 1, 0.5]] },
  highwayman: { name: "Highwayman", size: "m", lvl: 12, hp: 22, att: 10, def: 9, max: 3, speed: 2400, box: [7, 26], drops: [["coins", [5, 20]], ["bones", 1], ["mask", 1, 0.15]] },
  gnasher: { name: "Bog Gnasher", size: "m", lvl: 18, hp: 30, att: 14, def: 12, max: 4, speed: 2600, aggro: 3, oy: 12, box: [10, 24], drops: [["bones", 1], ["coins", [5, 25]], ["bogplate", 1, 0.03]] },
  taxwraith: { name: "Tax Wraith", size: "m", lvl: 28, hp: 42, att: 20, def: 18, max: 5, speed: 2400, aggro: 4, box: [9, 25], drops: [["coins", [20, 80]], ["receipt", 1], ["wraithhood", 1, 0.03], ["menace", 1, 0.02], ["spiderboots", 1, 0.004]] },
  chandelier: { name: "Chandelier Spider", size: "l", lvl: 34, hp: 50, att: 24, def: 20, max: 6, speed: 2600, aggro: 4, oy: 12, box: [17, 41], drops: [["cobweb", 1], ["bones", 1], ["lantern", 1, 0.03], ["spiderboots", 1, 0.01]] },
  revenant: { name: "Sulking Revenant", size: "l", lvl: 45, hp: 80, att: 32, def: 28, max: 8, speed: 2800, aggro: 5, box: [9, 30], drops: [["bones", 2], ["coins", [50, 150]], ["grudge", 1, 0.04], ["menace", 1, 0.03]] },
  // the Gloam
  moth: { name: "Lantern Moth", size: "s", lvl: 22, hp: 28, att: 16, def: 12, max: 4, speed: 2200, box: [4, 15], drops: [["coins", [5, 20]], ["emerald_ore", 1, 0.3]] },
  ghoul: { name: "Sorry Ghoul", size: "m", lvl: 30, hp: 46, att: 22, def: 19, max: 5, speed: 2400, box: [7, 24], drops: [["bones", 1], ["coins", [20, 60]], ["diamond_ore", 1, 0.2]] },
  understudy: { name: "The Understudy", size: "l", lvl: 38, hp: 62, att: 27, def: 23, max: 7, speed: 2600, box: [12, 43], drops: [["coins", [40, 120]], ["diamond_ore", [1, 2], 0.25]] },
  // Cloudreach
  ram: { name: "Cumulus Ram", size: "m", lvl: 42, hp: 66, att: 29, def: 26, max: 7, speed: 2600, box: [14, 25], drops: [["bones", 1], ["coins", [30, 90]], ["dragonstone_ore", 1, 0.15]] },
  angel: { name: "Angel of Minor Inconvenience", size: "m", lvl: 48, hp: 84, att: 34, def: 30, max: 8, speed: 2400, aggro: 4, box: [8, 25], drops: [["coins", [60, 160]], ["dragonstone_ore", 1, 0.25]] },
  goose: { name: "Thunder Goose", size: "l", lvl: 55, hp: 110, att: 40, def: 36, max: 10, speed: 2800, box: [21, 35], drops: [["bones", 2], ["feather", [10, 30]], ["coins", [100, 250]], ["onyx_ore", 1, 0.3]] },
  goat: { name: "Goat in a Toga", size: "m", lvl: 12, hp: 24, att: 9, def: 8, max: 3, speed: 2400, box: [7, 26], drops: [["manifesto", 1], ["bones", 1], ["toga", 1, 0.25]] }
};

/* ---------------------------------------------------------- tier drops

   Everything above Bronze is found, not bought. Each of these monsters can drop
   any piece of a tier; the chance below is the chance of getting SOMETHING from
   that tier, spread evenly over its ten pieces, so no single slot is the one
   everybody farms for.

   A tier drops from things around its own gate and a little above, and the
   tier above it drops rarely from the same monster — so a good night at the Tax
   Wraiths is mostly Emerald with the occasional Diamond, which is the shape
   that keeps somebody coming back. */
const TIER_DROPS = {
  gnasher:    [["emerald", 0.04]],
  taxwraith:  [["emerald", 0.08], ["diamond", 0.02]],
  chandelier: [["diamond", 0.08], ["dragonstone", 0.015]],
  revenant:   [["dragonstone", 0.10], ["onyx", 0.02]],
  moth:       [["emerald", 0.03]],
  ghoul:      [["emerald", 0.05], ["diamond", 0.02]],
  understudy: [["diamond", 0.06], ["dragonstone", 0.015]],
  ram:        [["dragonstone", 0.04]],
  angel:      [["dragonstone", 0.06], ["onyx", 0.015]],
  goose:      [["onyx", 0.05]]
};
for (const [mob, tiers] of Object.entries(TIER_DROPS)) {
  if (!MOBS[mob]) continue;
  for (const [tier, chance] of tiers) {
    const pieces = Object.keys(ITEMS).filter((k) => k.startsWith(`${tier}_`));
    for (const k of pieces) MOBS[mob].drops.push([k, 1, chance / pieces.length]);
  }
}

/* ------------------------------------------------------------ words */
// what it takes to climb down into the Wilderness (PvP). Change it here.
export const WILD_REQ = { skill: "defence", lvl: 10 };   // the Wilderness asks you to be able to take a hit

/* ------------------------------------------------------------ making things

   One table for everything made from something else. Cooking used to be
   hardcoded into the action loop, which meant Smithing would have been a second
   copy of the same twenty lines, and Crafting a third. Here a recipe is data:

     { skill, station, in: [[item, n], ...], out: [item, n], lvl, xp, ms, burnStop? }

   `station` is the object you stand at — a fire, a range, a furnace, an anvil.
   `burnStop` is cooking's own idea (the level past which nothing burns) and the
   only skill-specific field in here; anything without it never fails.

   Adding a skill that makes things is now rows in this table plus a station in
   STATIONS. It is not new code.
   ------------------------------------------------------------ */
export const STATIONS = {
  fire:    { skill: "cooking",  verb: "cook",  name: "campfire", auto: true,  kind: "cook" },
  range:   { skill: "cooking",  verb: "cook",  name: "range",    auto: true,  kind: "cook", kind2: "range" },
  furnace: { skill: "smithing", verb: "smelt", name: "furnace",  auto: true,  kind: "smelt" },
  anvil:   { skill: "smithing", verb: "smith", name: "anvil",    auto: false, kind: "smith" }
};

export const RECIPES = {};
const recipe = (id, r) => { RECIPES[id] = { id, ms: 1800, ...r }; };

// cooking, unchanged in every number from when it lived in its own table
for (const [raw, c] of Object.entries({
  sardine: { to: "csardine", lvl: 1, xp: 30, burnStop: 20 }, chicken: { to: "cchicken", lvl: 1, xp: 30, burnStop: 20 },
  beef: { to: "cbeef", lvl: 5, xp: 40, burnStop: 25 }, pork: { to: "cpork", lvl: 10, xp: 60, burnStop: 35 },
  trout: { to: "ctrout", lvl: 15, xp: 70, burnStop: 40 }, gloomfin: { to: "cgloomfin", lvl: 25, xp: 100, burnStop: 55 },
  mooncarp: { to: "cmooncarp", lvl: 40, xp: 150, burnStop: 70 },
  lanternfish: { to: "clanternfish", lvl: 30, xp: 120, burnStop: 60 }, skyeel: { to: "cskyeel", lvl: 50, xp: 190, burnStop: 80 }
})) recipe(`cook_${raw}`, { skill: "cooking", station: "fire", in: [[raw, 1]], out: [c.to, 1], lvl: c.lvl, xp: c.xp, burnStop: c.burnStop });

/* ------------------------------------------------------------ the Casino (2026-09-18)

   Games of chance for Cash, never ZCoins. The server rolls every result; the page only shows it. Each game keeps a
   small edge (a Cash sink, which the economy wants), bets are capped, and big wins are announced so the room feels
   alive. Placeholders to iterate on: the numbers all live here. */
export const CASINO = { minBet: 1, maxBet: 500, betMs: 900, roomWin: 5, worldWin: 25 };
export const GAMES = {
  slots: { name: "Slots", icon: "🎰", ex: "Three of a kind pays; two cherries pay 1.4×. Three sevens also wins the jackpot." },
  cointable: { name: "Coin Flip", icon: "🪙", ex: "Heads or tails. Pays 1.95×." },
  dicetable: { name: "Dice", icon: "🎲", ex: "Roll 1–100 under your number. The lower you go, the more it pays." }
};
export const FLIP_PAYS = 1.95;                                          // 97.5% back
export const DICE = { min: 5, max: 95, rtp: 0.97 };                     // win if the roll (1-100) is under your number
export const diceMult = (target) => Math.floor((DICE.rtp * 100 / (target - 1)) * 100) / 100;
// reel weights (of 80) and what three of each pay; about 96.9% back, a win about one spin in three, top prize 1 in 64,000
export const REELS = [
  { k: "cherry", icon: "🍒", w: 30, pay: 5 }, { k: "lemon", icon: "🍋", w: 22, pay: 8 }, { k: "bell", icon: "🔔", w: 14, pay: 15 },
  { k: "star", icon: "⭐", w: 8, pay: 40 }, { k: "diamond", icon: "💎", w: 4, pay: 120 }, { k: "seven", icon: "7️⃣", w: 2, pay: 500 }
];
export const SLOT_TWO_CHERRIES = 1.4;
/* the slots jackpot: 2% of every spin goes into one pot everybody shares; three sevens wins it (a 500 Cash spin
   wins all of it, smaller spins a share in proportion, the rest stays in the pot). The regular pays above were
   trimmed to make room, so slots still return about 96.5% overall. The house seeds it again after a win. */
export const JACKPOT = { slice: 0.02, seed: 1000, cap: 50000 };
export const jackpotShare = (bet) => Math.min(1, bet / CASINO.maxBet);
export function slotsPay(reels) {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return REELS.find((x) => x.k === reels[0]).pay;
  return reels.filter((r) => r === "cherry").length === 2 ? SLOT_TWO_CHERRIES : 0;
}

/* ------------------------------------------------------------ roulette: one shared table, one spin for everyone

   A single-zero wheel on a clock: bets are open for `betMs`, then the ball rolls for `spinMs` and the room sees the
   result together. Standard payouts, so the house keeps the green zero (97.3% back). */
export const ROULETTE = { betMs: 25000, spinMs: 6000, maxStake: 500, bigWin: 20 };
export const ROULETTE_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const rouletteColor = (n) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");
// kind -> what it pays (total returned per 1 staked) and when it wins
export const ROULETTE_BETS = {
  red:   { label: "Red",    pays: 2,  wins: (n) => RED.has(n) },
  black: { label: "Black",  pays: 2,  wins: (n) => n > 0 && !RED.has(n) },
  odd:   { label: "Odd",    pays: 2,  wins: (n) => n > 0 && n % 2 === 1 },
  even:  { label: "Even",   pays: 2,  wins: (n) => n > 0 && n % 2 === 0 },
  low:   { label: "1–18",   pays: 2,  wins: (n) => n >= 1 && n <= 18 },
  high:  { label: "19–36",  pays: 2,  wins: (n) => n >= 19 },
  d1:    { label: "1st 12", pays: 3,  wins: (n) => n >= 1 && n <= 12 },
  d2:    { label: "2nd 12", pays: 3,  wins: (n) => n >= 13 && n <= 24 },
  d3:    { label: "3rd 12", pays: 3,  wins: (n) => n >= 25 },
  num:   { label: "Number", pays: 36, wins: (n, pick) => n === pick }
};
export const rouletteLabel = (kind, pick) => (kind === "num" ? String(pick) : ROULETTE_BETS[kind]?.label || kind);

/* ------------------------------------------------------------ daily tasks: the board in the Casino

   Three a day per person, picked from what their levels allow, the same three all day (by who and which day), fresh
   each Chicago morning. They count what you gather and kill after the day starts; claim the Cash at the board. */
export const DAILY = [
  { id: "logs", what: "gather", k: "logs", n: 50, cash: 150, req: null },
  { id: "tin", what: "gather", k: "tin", n: 25, cash: 120, req: null },
  { id: "copper", what: "gather", k: "copper", n: 25, cash: 120, req: null },
  { id: "sardine", what: "gather", k: "sardine", n: 20, cash: 100, req: null },
  { id: "wheat", what: "gather", k: "wheat", n: 30, cash: 90, req: null },
  { id: "olives", what: "gather", k: "olives", n: 40, cash: 110, req: null },
  { id: "cows", what: "kill", k: "cow", n: 5, cash: 80, req: null },
  { id: "chickens", what: "kill", k: "chicken", n: 10, cash: 80, req: null },
  { id: "rotten", what: "kill", k: "rotten", n: 8, cash: 120, req: null },
  { id: "trout", what: "gather", k: "trout", n: 20, cash: 220, req: { skill: "fishing", lvl: 15 } },
  { id: "boar", what: "kill", k: "boar", n: 6, cash: 200, req: { skill: "attack", lvl: 8 } },
  { id: "highwayman", what: "kill", k: "highwayman", n: 5, cash: 260, req: { skill: "attack", lvl: 12 } },
  { id: "ashlogs", what: "gather", k: "ashlogs", n: 20, cash: 350, req: { skill: "woodcutting", lvl: 20 } },
  { id: "emerald", what: "gather", k: "emerald_ore", n: 15, cash: 400, req: { skill: "mining", lvl: 20 } },
  { id: "moths", what: "kill", k: "moth", n: 8, cash: 380, req: { skill: "attack", lvl: 20 } },
  { id: "lantern", what: "gather", k: "lanternfish", n: 12, cash: 420, req: { skill: "fishing", lvl: 30 } },
  { id: "diamond", what: "gather", k: "diamond_ore", n: 12, cash: 520, req: { skill: "mining", lvl: 30 } },
  { id: "ghouls", what: "kill", k: "ghoul", n: 6, cash: 520, req: { skill: "attack", lvl: 28 } },
  { id: "willow", what: "gather", k: "willowlogs", n: 20, cash: 560, req: { skill: "woodcutting", lvl: 35 } },
  { id: "rams", what: "kill", k: "ram", n: 6, cash: 700, req: { skill: "attack", lvl: 40 } },
  { id: "dragonstone", what: "gather", k: "dragonstone_ore", n: 10, cash: 800, req: { skill: "mining", lvl: 40 } }
];
export const DAILY_COUNT = 3;
export const chicagoDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
// the day's three for a character: the ones their levels allow, shuffled by who and which day
export function dailyFor(c, id, day) {
  const ok = DAILY.filter((t) => !t.req || lvlOf(c, t.req.skill) >= t.req.lvl);
  const seed = [...`${id}:${day}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  return ok.map((t, i) => [hashRand(i, seed, 97), t]).sort((a, b) => a[0] - b[0]).slice(0, DAILY_COUNT).map(([, t]) => t.id);
}
export const dailyDef = (id) => DAILY.find((t) => t.id === id);

// the old name, kept so the wiki and anything else reading it still work
export const COOK = Object.fromEntries(Object.values(RECIPES)
  .filter((r) => r.skill === "cooking")
  .map((r) => [r.in[0][0], { to: r.out[0], lvl: r.lvl, xp: r.xp, burnStop: r.burnStop }]));

/* ---------------------------------------------------------- smithing

   Ore goes in a furnace and comes out a bar; bars go on an anvil and come out
   gear. Everything above Bronze drops rarely on purpose, so this is the route
   that is meant to feel normal — a drop should be luck, not the plan.

   PROVISIONAL ORES. Bronze is copper + tin, which is not up for debate. The
   other four use the ores that already exist at roughly the right mining
   levels (grimstone 20, marble 30, stardust 50) purely so the chain is
   playable today. Jake is mapping where ore actually lives; when that lands,
   it is one `smelt` line per tier here and nothing else changes. */
const SMELT = {
  bronze:      [["copper", 1], ["tin", 1]],
  emerald:     [["emerald_ore", 2]],                       // the Gloam, Mining 20
  diamond:     [["diamond_ore", 2]],                       // the Gloam, Mining 30
  dragonstone: [["dragonstone_ore", 2]],                   // Cloudreach, Mining 40
  onyx:        [["onyx_ore", 2], ["grimstone", 1]]         // Cloudreach, Mining 50, plus a trip to the Wilderness
};
// how many bars a piece takes — the big slots cost more, and a maul costs most
const BARS = { body: 5, legs: 3, shield: 3, helm: 2, boots: 1, gloves: 1, gladius: 1, sword: 2, maul: 3 };

for (const [i, t] of TIERS.entries()) {
  const tierN = i + 1, bar = `${t.key}_bar`;
  ITEMS[bar] = { name: `${t.name} bar`, icon: "🧱", tier: t.key, ex: `Smelted ${t.name.toLowerCase()}, still warm. It wants to be something.` };
  recipe(`smelt_${t.key}`, { skill: "smithing", station: "furnace", in: SMELT[t.key], out: [bar, 1], lvl: t.gate, xp: 15 * tierN, ms: 2400 });
  for (const [slot, n] of Object.entries(BARS)) {
    const key = `${t.key}_${slot}`;
    if (!ITEMS[key]) continue;
    recipe(`smith_${key}`, { skill: "smithing", station: "anvil", in: [[bar, n]], out: [key, 1], lvl: t.gate, xp: n * 20 * tierN, ms: 2600 });
  }
}

/** Every recipe a station can run, hardest first so "the best thing you can make" is recipesAt()[0]. */
export const recipesAt = (station) => Object.values(RECIPES)
  .filter((r) => r.station === station || (station === "range" && r.station === "fire"))
  .sort((a, b) => b.lvl - a.lvl);
/** Do they have everything the recipe needs? */
export const canMake = (c, r) => lvlOf(c, r.skill) >= r.lvl && r.in.every(([k, n]) => countItems(c, [k]) >= n);

// the chance to burn at a cooking level: about half when you first can, nothing by burnStop; a range is kinder than a fire
export const burnChance = (r, lvl, range) => lvl >= r.burnStop ? 0 : Math.max(0.03, 0.5 * (r.burnStop - lvl) / Math.max(1, r.burnStop - r.lvl)) * (range ? 0.8 : 1);
export const EAT_MS = 1200;
// repeating skills stop after this long with no input from the player: the resources never run dry, but you have to be there
export const AFK_MS = 3 * 60 * 1000;
export const AFK_KINDS = { rock: "mining", vein: "mining", spot: "fishing", tree: "chopping", olive: "picking", wheat: "picking", cook: "cooking", smelt: "smelting", smith: "smithing" };

// the Forge: Brutus sells tools and the Bronze set, and buys what you gather (for less than you'll get on the Exchange, usually)
export const SHOP = {
  // Brutus stocks tools and BRONZE ONLY. Everything above bronze is found, not
  // bought — otherwise the fastest route to the best gear in the game is to
  // stand at the copper vein and walk away, which is not a route anybody should
  // enjoy discovering.
  sells: [["pickaxe", 25], ["axe", 25], ["rod", 20],
    ["bronze_gladius", 220], ["bronze_sword", 250], ["bronze_maul", 280],
    ["bronze_helm", 200], ["bronze_shield", 300], ["bronze_body", 600], ["bronze_legs", 360], ["bronze_boots", 120], ["bronze_gloves", 120], ["bronze_ring", 180], ["bronze_amulet", 260]],
  buys: { emerald_ore: 30, diamond_ore: 50, dragonstone_ore: 80, onyx_ore: 120, willowlogs: 40, skyashlogs: 65, clanternfish: 18, cskyeel: 32,
    copper: 6, tin: 6, grimstone: 45, marble: 35, stardust: 120, logs: 4, yewlogs: 70, ashlogs: 28, hide: 8, bones: 2, feather: 1, tusk: 10, husk: 4, pit: 1,
    receipt: 3, cobweb: 5, geode: 400, olives: 1, sunolive: 30, wheat: 1, tomatoe: 2, goldtomatoe: 60, mask: 40, monocle: 25, manifesto: 15,
    csardine: 3, cchicken: 3, cbeef: 4, cpork: 7, ctrout: 9, cgloomfin: 14, cmooncarp: 25,
    pickaxe: 8, axe: 8, rod: 6 }
};
/* Brutus buys gear back at a fraction of what a piece is worth, generated from
   the same table that made it. Never at or above what he sells it for — that is
   a money printer, and the content check fails the build if it ever becomes one. */
{
  const worth = (it) => Math.round(((it.def || 0) * 9 + (it.acc || 0) * 5 + (it.str || 0) * 6) * 1.6);
  for (const t of TIERS) for (const k of Object.keys(ITEMS)) {
    if (!k.startsWith(`${t.key}_`)) continue;
    SHOP.buys[k] = Math.max(2, Math.round(worth(ITEMS[k]) * 0.35));
  }
}
// dying outside the Cage: a quarter of the time one worn item falls where you died. The killer alone can take it
// for lootMs, then anyone, until it's gone. Leaving mid-fight leaves your character standing there for lingerMs.
export const PVP = { drop: 0.25, lootMs: 60000, groundMs: 180000, lingerMs: 10000 };
// how long a monster stays dead: 15s everywhere, but in the Wilderness it scales with level, from 1 minute
// (level 15 and under) to 3 minutes (level 45 and up), so a kill there is worth something
// how long a monster stays dead. Outside the Wilderness it's 15s for one person, shared out between everyone who has
// fought in the area in the last minute (15s, 7.5s, 5s, then a 4s floor), so a busy area refills without more monsters on it.
export const RESPAWN = { base: 15000, floor: 4000 };
export const respawnMs = (sc, t, fighters = 1) => (sc?.pvp ? 60000 + Math.round(Math.max(0, Math.min(1, (MOBS[t].lvl - 15) / 30)) * 120000)
  : Math.max(RESPAWN.floor, Math.round(RESPAWN.base / Math.max(1, fighters))));
export const fmtWait = (ms) => { const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? `${m}m${s % 60 ? ` ${s % 60}s` : ""}` : `${s}s`; };
export const inCage = (def, x, y) => !!def?.cage && x >= def.cage[0] && x <= def.cage[2] && y >= def.cage[1] && y <= def.cage[3];

// islands: everyone has one. Plots grow in real time (online or not); pedestals show off one item each.
export const ISLE = { plots: 20, shelf: 15 };
// upgrades, bought from Charon: each tier is a bigger layout; the plots and pedestals you already have stay put
export const ISLE_TIERS = [null,
  { name: "Island", plots: 8, shelf: 6 },
  { name: "Bigger island", price: 5000, plots: 12, shelf: 9, ex: "More land: 12 plots, 9 pedestals and a bigger pen." },
  { name: "The Far Shore", price: 20000, plots: 20, shelf: 15, ex: "A bridge off the east side to a second island: 8 more plots, 6 more pedestals and a lighthouse." }];
export const ISLE_FERRY = { scene: "river", x: 15, y: 10 };
export const CROPS = {
  wheat: { lvl: 1, ms: 10 * 60000, yield: [3, 5], xp: 30 },
  tomatoe: { lvl: 5, ms: 20 * 60000, yield: [3, 6], xp: 70 },
  goldtomatoe: { lvl: 50, ms: 4 * 3600000, yield: [1, 3], xp: 600 }
};
// a theme repaints your island; price null means you can't buy it (events, quests)
export const THEMES = {
  meadow: { name: "Meadow", icon: "🌿", ex: "Green grass, round trees, a nice breeze.", price: 0 },
  dunes: { name: "Sunny Dunes", icon: "🏝️", ex: "Warm sand, palm trees and one crab that watches you.", price: 2500 },
  gloom: { name: "Gloom", icon: "🕸️", ex: "Grey grass, bare trees, a little fog. Not for sale.", price: null }
};
export const EXAMINE = {
  notice: ["NOTICE: Lost, one (1) sense of smell. If found, return to Waldy.", "NOTICE: The Forge buys ore. The Forge always buys ore.", "NOTICE: Do NOT feed the olives.", "NOTICE: Wanted: goat, wears a toga, answers to 'Senator'. Do not debate him."],
  sign: ["Via Appia → Closed: bandits. (Coming soon.)"],
  furnace: ["Hot enough to argue with. Ore goes in, bars come out."],
  anvil: ["Scarred all over. Every mark on it used to be somebody's sword."],
  hive: ["The bees are humming the same four notes. Over and over.", "One bee is wearing a tiny helmet. It salutes you."],
  statue: ["'GALLUS THE BRAVE. He did not flinch.' It's a chicken."],
  fountain: ["The water tastes faintly of coins. People keep throwing Cash in it."],
  fire: ["A campfire. Bring raw food and click it to cook."],
  bush: ["A bush. Something inside it is breathing.", "Just a bush. Probably.", "A bush. It rustles when you aren't looking."],
  boulder: ["A big rock. Too big for your pickaxe. For now.", "Someone has scratched 'CRIXUS WAS HERE' into it."],
  hay: ["A hay bale. Waldy sleeps on it, sometimes."],
  counter: ["Polished marble. Aurelia polishes it when she's nervous, which is always."],
  pool: ["Warm, and suspiciously green. Nobody bathes here any more; they just store things."],
  column: ["A marble column. Someone has carved 'Z WAS HERE' into the base."],
  range: ["A wood-burning range. Bring raw food and click it to cook; it burns less than a campfire."],
  table: ["A heavy farmhouse table. It's seen a lot of stew."],
  barrel: ["Full of something that smells like olives. Or feet."],
  bed: ["Waldy's bed, apparently. There's a bucket-shaped dent in the pillow."],
  plant: ["A potted palm. Someone has been watering it with wine.", "A potted palm. It's doing better than most of the customers."],
  bench: ["A marble bench, for waiting. Nobody waits. Aurelia is very fast."],
  goatstatue: ["'THE FIRST DEPOSITOR.' A bronze goat, clutching a coin purse. It looks smug."],
  chest: ["The vault's overflow. Locked. Aurelia has the key and won't say where."],
  rug: ["A good rug. Mind your sandals."],
  chair: ["A three-legged stool. Bom has broken four of these."],
  sack: ["A sack of flour. Baking comes later."],
  cat: ["A cat wearing a tiny gladiator helmet. It judges you.", "The cat's helmet has a little crest. It has clearly won fights."],
  bucket: ["Waldy's spare bucket. Freshly polished. It has googly eyes too."],
  bigtomato: ["The Big Tomatoe. It's warm. It's slightly soft. There's a door-shaped outline you choose not to think about."],
  press: ["A tomatoe press. It smells like every summer at once."],
  crate: ["A crate of tomatoes, each one labelled TOMATOE in careful handwriting."],
  scarecrow: ["A scarecrow with a tomato for a head. The crows seem fine with it. The crows seem to love it."],
  cypress: ["A tall, thin cypress. The road is lined with them, all leaning very slightly east."],
  milestone: ["'ROMA · MILES: ' and then nothing. Someone scratched the number off. Twice.", "'YOU ARE HERE.' Helpful."],
  toll: ["A toll post. The price board has been painted over with 'NO'."],
  barricade: ["Timber and rope. Past it, the road just stops: washed out. The Bandit Camp is somewhere beyond."],
  chariot: ["A chariot with one wheel. Whoever left it left in a hurry, or a very bad mood."],
  rope: ["A rope back up to the farm. Somebody has tied a very bad knot, but it holds."],
  cagesign: ["THE CAGE. Fight anyone in here as much as you like: nobody loses anything, and nobody learns anything."],
  gravestone: ["'HERE LIES KEVIN. He went in for one more ore.'", "'HERE LIES A PERSON WHO SAID IT WAS SAFE.'", "The name's worn off. Someone has left a single, very small shoe."],
  skeleton: ["A skeleton, still holding a fishing rod. It's got a bite.", "A skeleton in a comfortable pose. It looks like it's waiting for someone."],
  snag: ["A dead tree. It creaks when nothing is moving."],
  pen: ["A pet pen, empty for now. Something will live here one day."],
  lighthouse: ["A lighthouse. The light points inward, at the island. Nobody knows who it's warning.", "The door's painted on. The light is on anyway."],
  mule: ["A mule. It refuses to move. It has refused for eleven years.", "The mule looks at you. You feel judged by a professional."]
};
export const VERB = { game: "Play", board: "Read", roulette: "Play", roomdoor: "Enter", walldoor: "Enter", cook: "Cook-at", smelt: "Smelt-at", smith: "Smith-at", pvp: "Attack", ground: "Take", rope: "Climb-up", ferry: "Board", boatback: "Sail-home", plot: "Tend", pedestal: "Use", islesign: "Read", bank: "Bank at", exchange: "Trade at", player: "Trade with", enter: "Enter", hole: "Climb-down", mob: "Attack", npc: "Talk-to", wheat: "Pick", spot: "Fish", door: "Open", well: "Search", rock: "Mine", vein: "Mine", tree: "Chop down", olive: "Pick", shrine: "Pray-at", notice: "Read", sign: "Read" };

/* ------------------------------------------------------------ quests are data
   goal.type "bring": have goal.n of goal.items in your bag when you talk to the giver (they're taken)
   goal.type "kill":  defeat goal.n of goal.mob after you've accepted
   requires: quests that must be done first. {have} in a line is replaced with your progress. */
export const QUESTS = {
  firewood: {
    name: "Firewood", giver: "Bom Trady", where: "Ludus Farm", icon: "🪵",
    goal: { type: "bring", items: ["logs"], n: 5, what: "logs" },
    brief: "Bring Bom Trady 5 logs for the ludus kitchen.",
    talk: {
      offer: ["Hey, rookie. Kitchen's out of firewood, and I've got a game Sunday.", "Bring me 5 logs. The oak down by the path is a good one. Hold your axe, not your sword, then click a tree."],
      accept: "I'll get your logs.", decline: "Not right now.",
      accepted: "Attaboy. The oak's just southeast of here. Don't chop Waldy.",
      progress: "How's that firewood coming? I need 5 logs. You've got {have}.",
      ready: "Now those are logs. Hand 'em over.", hand: "Here you go.",
      done: "Kitchen's warm. You did good, rookie. Come back when you want real work."
    },
    reward: { coins: 40, xp: { woodcutting: 150 }, text: "40 Cash, 150 Woodcutting xp" }
  },
  cattle: {
    name: "Cattle Drive", giver: "Bom Trady", where: "Ludus Farm", icon: "🐄", requires: ["firewood"],
    goal: { type: "kill", mob: "cow", n: 5, what: "cows" },
    brief: "Bom Trady wants 5 cows seen to.",
    talk: {
      offer: ["Real work, as promised. The cows have been running routes on my field.", "Put 5 of them down. Hold your sword for this one."],
      accept: "Consider it done.", decline: "Maybe later.",
      accepted: "Hit them until they stop mooing. Waldy says that's the whole trick.",
      progress: "That's {have} cows so far. I said 5.",
      ready: "Field's quiet. You're a natural.", hand: "What do I get?",
      done: "Cash, and my respect. Mostly the Cash."
    },
    reward: { coins: 60, xp: { attack: 100, strength: 100 }, text: "60 Cash, 100 Attack and 100 Strength xp" }
  },
  catch: {
    name: "Catch of the Day", giver: "Old Tullius", where: "River Bend", icon: "🐟",
    hint: "Old Tullius needs a hand down at River Bend. Head east from the farm, through the blue, and look for the old man by the water.",
    goal: { type: "bring", items: ["sardine", "trout"], n: 3, what: "raw fish" },
    brief: "Bring Old Tullius 3 raw fish.",
    talk: {
      offer: ["My back's gone, lad, and the fish won't catch themselves.", "Bring me 3 raw fish. Hold your rod and click where the water bubbles."],
      accept: "I'll catch you some.", decline: "Not today.",
      accepted: "Good lad. Mind the chickens.",
      progress: "{have} fish so far. I said 3.",
      ready: "Oh, lovely fish. Give them here.", hand: "Here they are.",
      done: "Supper sorted. Here, take something for your trouble."
    },
    reward: { coins: 40, xp: { fishing: 150 }, text: "40 Cash, 150 Fishing xp" }
  }
};

/* ------------------------------------------------------------ a character */
export const DEFAULT_SETTINGS = { xpDrops: true, gainPops: true, skillRing: true, names: true, hoverTile: true, groupNotes: true, debug: false, reducedMotion: false, confirmDrop: true };
export const SETTING_INFO = {
  xpDrops: ["XP drops", "Show +xp over your head when you earn it."],
  gainPops: ["Item pops", "Show what you (and others) gather popping up over their heads."],
  skillRing: ["Skill ring", "Show the progress ring for the skill you're training."],
  names: ["Names", "Show names and levels under players, NPCs and monsters."],
  hoverTile: ["Tile outline", "Outline the tile under your mouse."],
  groupNotes: ["Group bonus messages", "Say so when others working the same thing give you a bonus."],
  confirmDrop: ["Confirm drops", "Ask before shift-click drops an item."],
  reducedMotion: ["Reduce motion", "No bobbing, flashing or drifting sparkles."],
  debug: ["Debug info", "Show your tile, the mouse tile and your action in the corner."]
};
/* ------------------------------------------------------------ the save format

   Two things make a saved character safe to change:

   ITEM_ALIASES  — an old item key mapped to the one that replaced it. Renaming
                   an item without a line here DELETES it from every bag and
                   bank that has not logged in since, because normChar drops
                   keys that are not in ITEMS. Never remove a line.

   MIGRATIONS    — one function per save version, run in order on any character
                   below the current one. The index IS the version it produces,
                   so SAVE_V is derived rather than typed twice.

   A migration must only ever add or reshape. If one throws, the character is
   kept as it was rather than lost.
   ------------------------------------------------------------ */

// old key -> current key. Chains are followed ("a" -> "b" -> "c"), so a second
// rename of the same item only needs its own line.
export const ITEM_ALIASES = {
  // The hand-written bronze pieces became rows of the generated tier table
  // (2026-09-18). Without these four lines every bronze item in every bag and
  // bank would be silently deleted on the next login.
  bronzesword: "bronze_sword",
  bronzehelm: "bronze_helm",
  bronzeshield: "bronze_shield",
  bronzecuirass: "bronze_body"
};
export function aliasKey(k) {
  let n = 0;
  while (ITEM_ALIASES[k] && n++ < 8) k = ITEM_ALIASES[k];
  return k;
}

export const STAT_DAYS = 60;   // how many days of the xp-per-day log are kept
const COUNT_MAPS = ["kills", "gathered", "looted", "cooked", "crafted"];
const STAT_NUMS = ["burnt", "deaths", "pvpKills", "pvpDeaths", "questsDone", "cashIn", "cashOut", "xpTotal", "playMs", "sessions", "firstSeen", "lastSeen"];

export function freshStats() {
  return {
    kills: {},      // mob type -> how many killed
    gathered: {},   // item key  -> how many gathered by skilling (mined, chopped, fished, picked)
    looted: {},     // item key  -> how many taken off a monster
    cooked: {},     // item key  -> how many cooked successfully
    crafted: {},    // item key  -> how many made (Smithing, Crafting, when they land)
    burnt: 0,
    deaths: 0, pvpKills: 0, pvpDeaths: 0, questsDone: 0,
    cashIn: 0, cashOut: 0,
    xpTotal: 0, xpDay: {},
    playMs: 0, sessions: 0,
    firstSeen: 0, lastSeen: 0
  };
}

let _ctFmt = null;
// the Chicago day, "YYYY-MM-DD" — the same day boundary the rest of the site uses
export function dayKeyCT(t = Date.now()) {
  _ctFmt ||= new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });
  return _ctFmt.format(new Date(t));
}

export function normStats(s) {
  const f = freshStats();
  if (!s || typeof s !== "object") return f;
  const out = { ...f, ...s };
  for (const key of COUNT_MAPS) {
    const src = out[key] && typeof out[key] === "object" ? out[key] : {};
    const o = {};
    for (const k in src) {
      const n = Number(src[k]);
      if (!Number.isFinite(n) || n <= 0) continue;
      // gathered/cooked/crafted are keyed by item, so they follow renames too;
      // if both the old and new key are present their counts add up.
      const key2 = key === "kills" ? k : aliasKey(k);
      o[key2] = (o[key2] || 0) + Math.trunc(n);
    }
    out[key] = o;
  }
  for (const k of STAT_NUMS) out[k] = Number.isFinite(Number(out[k])) ? Math.trunc(Number(out[k])) : 0;
  const d = out.xpDay && typeof out.xpDay === "object" ? out.xpDay : {};
  const days = Object.keys(d).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(Number(d[k]))).sort().slice(-STAT_DAYS);
  out.xpDay = {};
  for (const k of days) out.xpDay[k] = Math.trunc(Number(d[k]));
  return out;
}

// index = the version the step produces. Append only.
export const MIGRATIONS = [
  null,   // 0: not a real version
  null,   // 1: the original format
  // 2: per-character stat counters. Nothing to backfill - the counters start
  //    from the day this shipped, which is the whole reason they went in early.
  (c) => { c.stats = normStats(c.stats); c.stats.firstSeen ||= Number(c.created) || Date.now(); },
  // 3: Melee became Attack, Strength and Defence.
  //
  //    The old melee level did three jobs at once — it was your accuracy, your
  //    maximum hit AND your defence. So copying it into all three is not a
  //    generous reading, it is the EXACT one: accuracy, max hit and defence all
  //    come out identical to what the character had a moment ago. Dividing it
  //    would quietly nerf everyone for having played before, and the only
  //    visible side effect of copying is that total xp triples on paper.
  (c) => {
    const melee = Number(c.xp?.melee) || 0;
    c.xp = { ...(c.xp || {}) };
    for (const k of COMBAT_SKILLS) c.xp[k] = Math.max(Number(c.xp[k]) || 0, melee);
    delete c.xp.melee;
    if (!STANCES[c.stance]) c.stance = DEFAULT_STANCE;
  }
];
export const SAVE_V = MIGRATIONS.length - 1;

function migrate(out) {
  const from = Number.isFinite(Number(out.v)) ? Number(out.v) : 1;
  for (let n = from + 1; n < MIGRATIONS.length; n++) {
    try { MIGRATIONS[n]?.(out); }
    catch (e) { /* a broken migration must never cost someone their character */ }
  }
  out.v = SAVE_V;
  return out;
}

export function freshChar() {
  return {
    v: SAVE_V, scene: START.scene, x: START.x, y: START.y, hp: 10,
    inv: [{ k: "coins", n: 25 }, { k: "pickaxe", n: 1 }, { k: "axe", n: 1 }, { k: "rod", n: 1 }],
    eq: { helm: "cap", weapon: "rudis", body: "tunic", shield: "parma", legs: null, gloves: null, boots: "sandals", ring: null },
    stance: DEFAULT_STANCE,
    xp: { attack: 0, strength: 0, defence: 0, hp: XP_AT[10], fishing: 0, farming: 0, mining: 0, woodcutting: 0, cooking: 0, smithing: 0 },
    qs: {}, bank: [], settings: { ...DEFAULT_SETTINGS }, created: Date.now(), stats: freshStats(),
    isle: { plots: Array(ISLE.plots).fill(null), shelf: Array(ISLE.shelf).fill(null), theme: "meadow", themes: ["meadow"], open: true, tier: 1 }
  };
}
// fill in anything a stored character is missing, and drop what isn't real any more
export function normChar(c) {
  const f = freshChar();
  if (!c || typeof c !== "object") return f;
  const out = { ...f, ...c, xp: { ...f.xp, ...(c.xp || {}) }, eq: { ...f.eq, ...(c.eq || {}) }, settings: { ...f.settings, ...(c.settings || {}) }, qs: { ...(c.qs || {}) } };
  // renames are followed BEFORE anything is filtered against ITEMS: the filter
  // below deletes keys it does not recognise, so an un-aliased rename would
  // quietly empty every bag and bank that had not logged in since.
  const renamed = (st) => (st && st.k ? { k: aliasKey(st.k), n: st.n } : st);
  out.bank = (Array.isArray(c.bank) ? c.bank : []).map(renamed).filter((s) => s && ITEMS[s.k] && s.n > 0).slice(0, BANK_MAX).map((s) => ({ k: s.k, n: s.n }));
  // the bag is re-packed into stacks of 99; anything that no longer fits goes to the bank rather than vanishing
  out.inv = [];
  for (const s of (Array.isArray(c.inv) ? c.inv : f.inv).map(renamed).filter((s) => s && ITEMS[s.k] && s.n > 0)) {
    const left = addInv(out.inv, s.k, s.n); if (!left) continue;
    const b = out.bank.find((x) => x.k === s.k); if (b) b.n += left; else out.bank.push({ k: s.k, n: left });
  }
  for (const s of SLOTS) { if (out.eq[s]) out.eq[s] = aliasKey(out.eq[s]); if (out.eq[s] && !ITEMS[out.eq[s]]) out.eq[s] = null; }
  if (!SCENES[out.scene]) Object.assign(out, isIsle(out.scene) ? ISLE_FERRY : START);   // back from an island: the ferry at River Bend
  const fi = f.isle, ci = c.isle && typeof c.isle === "object" ? c.isle : {};
  out.isle = {
    plots: Array.from({ length: ISLE.plots }, (_, i) => { const p = ci.plots?.[i]; return p && CROPS[p.k] && Number.isFinite(p.at) ? { k: p.k, at: p.at } : null; }),
    shelf: Array.from({ length: ISLE.shelf }, (_, i) => { const k = ci.shelf?.[i] ? aliasKey(ci.shelf[i]) : null; return ITEMS[k] ? k : null; }),
    themes: [...new Set(["meadow", ...(Array.isArray(ci.themes) ? ci.themes : [])])].filter((t) => THEMES[t]),
    theme: fi.theme, open: ci.open !== false, tier: [1, 2, 3].includes(ci.tier) ? ci.tier : 1
  };
  if (out.isle.themes.includes(ci.theme)) out.isle.theme = ci.theme;
  out.stance = stanceOf(out);
  out.stats = normStats(out.stats);
  return migrate(out);          // brings an older save up to SAVE_V and stamps out.v
}
export const lvlOf = (c, k) => levelOf(c.xp[k] || 0);
export const maxHpOf = (c) => lvlOf(c, "hp");
// The three combat skills weigh the same. Equal thirds is also what keeps the
// split neutral: a character whose attack, strength and defence all equal their
// old melee level comes out at exactly the combat level they had before.
export const meleeOf = (c) => (lvlOf(c, "attack") + lvlOf(c, "strength") + lvlOf(c, "defence")) / 3;
export const combatOf = (c) => Math.floor((meleeOf(c) * 1.3 + lvlOf(c, "hp")) / 2.3) + 2;
export const totalOf = (c) => Object.keys(SKILLS).reduce((n, k) => n + lvlOf(c, k), 0);
export const bonusOf = (c) => { const b = { acc: 0, str: 0, def: 0 }; for (const k of Object.values(c.eq)) if (k && ITEMS[k]) for (const q in b) b[q] += ITEMS[k][q] || 0; return b; };
export const maxHitOf = (c) => 1 + Math.floor(lvlOf(c, "strength") / 6) + Math.floor(bonusOf(c).str / 2);

/* The two rolls, in one place so the server and the page can never disagree.

   Defence stays halved. Not for elegance — without it the numbers break: a
   level 50 defence with 20 from gear rolls 70 against a revenant's 32 attack,
   which clamps to the 10% floor and the hardest thing in the game stops landing
   hits. Halved, a Defensive character ends up exactly as hard to hit as a
   melee-50 character was before the split, while somebody who poured everything
   into Strength is genuinely fragile. That difference IS the split. */
export const attackRollOf = (c) => lvlOf(c, "attack") + 1 + bonusOf(c).acc;
export const defenceRollOf = (c) => (lvlOf(c, "defence") + bonusOf(c).def) / 2;
export const hitChance = (att, def) => Math.max(0.1, Math.min(0.95, 0.5 + (att - def) * 0.04));

/* ------------------------------------------------------------ the Exchange
   an offer: { id, owner, name, side: "sell"|"buy", k, qty, done, price (each), at, open,
               box: { items: n waiting to collect, cash: n waiting to collect } }
   A new offer fills against the other side at the RESTING offer's price, best price first then oldest. */
export const exTax = (cash) => Math.floor(cash * EX_TAX);
export function exSummary(orders) {
  const out = {};
  for (const o of orders) {
    if (!o.open || o.done >= o.qty) continue;
    const b = (out[o.k] ||= { sell: null, sellQty: 0, buy: null, buyQty: 0 });
    const left = o.qty - o.done;
    if (o.side === "sell") { b.sellQty += left; if (b.sell == null || o.price < b.sell) b.sell = o.price; }
    else { b.buyQty += left; if (b.buy == null || o.price > b.buy) b.buy = o.price; }
  }
  return out;
}

/* ------------------------------------------------------------ quest state, read from a character */
export const qGet = (c, k) => c.qs[k] || { state: "new", n: 0 };
export const countItems = (c, keys) => c.inv.filter((x) => keys.includes(x.k)).reduce((n, x) => n + x.n, 0);
export const qHave = (c, k) => { const q = QUESTS[k]; return q.goal.type === "bring" ? countItems(c, q.goal.items) : qGet(c, k).n; };
export const qOpen = (c, q) => (q.requires || []).every((r) => qGet(c, r).state === "done");
// where a quest is now: new, locked, active, ready (can hand in), done
export function qState(c, k) {
  const q = QUESTS[k], st = qGet(c, k).state;
  if (st === "done") return "done";
  if (st === "active") return qHave(c, k) >= q.goal.n ? "ready" : "active";
  return qOpen(c, q) ? "new" : "locked";
}
// the quest an NPC is dealing with right now: the first of theirs that isn't done or locked
export const npcQuest = (c, n) => (n.quests || []).find((k) => ["new", "active", "ready"].includes(qState(c, k)));
// what an NPC with no work left says to send you on
export function nextHint(c, n) {
  const next = Object.keys(QUESTS).find((q) => !(n.quests || []).includes(q) && ["new", "active", "ready"].includes(qState(c, q)));
  return next ? (QUESTS[next].hint || `${QUESTS[next].giver} at ${QUESTS[next].where} could use a hand.`) : "That's all the work there is for now. Check back soon.";
}

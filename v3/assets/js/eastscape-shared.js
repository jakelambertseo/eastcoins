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
export const VERSION = 74;
// Maps are 44 x 26 tiles (twice the old 22 x 13 each way, 2026-09-19). The screen shows a 22 x 13 window that follows
// you (ZOOM in the page), so characters look the size they always did and there's four times the room.
export const COLS = 44, ROWS = 26;
export function hashRand(x, y, s = 1) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ------------------------------------------------------------ OSRS curve */
export const XP_AT = [0, 0];
{ let p = 0; for (let l = 1; l < 99; l++) { p += Math.floor(l + 300 * Math.pow(2, l / 7)); XP_AT[l + 1] = Math.floor(p / 4); } }
export const levelOf = (xp) => { let l = 1; while (l < 99 && xp >= XP_AT[l + 1]) l++; return l; };

/* ------------------------------------------------------------ things you can carry */
export const ITEMS = {
  tickets: { name: "Tickets", icon: "🎟️", nocap: true, ex: "The one currency in EastScape. They stay on you: they can't be dropped, banked or handed over, only spent. Every kill, catch and daily job pays tickets. They buy everything at the Prize Counter, and every table takes them: 1,000 tickets stand in for 1 ZCoin at the real tables, and what you win there is paid in real ZCoins." },
  zcoin: { name: "ZCoin", icon: "🪙", ex: "A REAL ZCoin, from eastcoin.vip. Rare. Take it to the Prize Counter and it goes straight onto your ZCoin balance." }, wheat: { name: "Wheat", icon: "🌾" }, bones: { name: "Bones", icon: "🦴" },
  beef: { name: "Raw beef", icon: "🥩" }, hide: { name: "Cowhide", icon: "🟫" }, chicken: { name: "Raw chicken", icon: "🍗" },
  feather: { name: "Feather", icon: "🪶" }, sardine: { name: "Sardine", icon: "🐟", heal: 3, ex: "Sell it, or eat it as it comes. You're a gambler, not a chef." }, trout: { name: "Trout", icon: "🐠", heal: 5, ex: "Sell it or eat it. From Fishing 10 the Yard's pond gives these up too." },
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
  // ---- 2026-09-20: THE THINGS THAT CHANGE HOW THE CASINO TREATS YOU (see FX, below the casino's numbers) ----
  // fighting's windfalls: house chips, worth a lump of tickets at the Ruby or a Cashier
  chip_red: { name: "Red house chip", icon: "🔴", ex: "Somebody's winnings, dropped in a hurry. The Cashier will take it." },
  chip_black: { name: "Black house chip", icon: "⚫", ex: "A thousand dollars of somebody else's bad night." },
  chip_gold: { name: "Gold house chip", icon: "🟡", ex: "There are maybe six of these. One of them was inside that thing you just killed." },
  // fighting's other finds: things you click
  chip_free: { name: "Free-play chip", icon: "🟢", use: "bundle", worth: 100, ex: "A house chip from the old days. Click it: 100 tickets, straight into your bag." },
  mysterybox: { name: "Mystery box", icon: "🎁", use: "box", ex: "It rattles. Click it and find out." },
  devils_dice: { name: "Devil's dice", icon: "🎲", use: "devil", ex: "Click it and the Devil takes up to 1,000 of your tickets: one time in three he gives back TRIPLE. The other two times, they're gone." },
  rewind_watch: { name: "Rewind watch", icon: "⌚", use: "heal", ex: "Click it, even mid-fight: the hands spin back and you're at full health. Works once." },
  tp_scroll: { name: "Casino scroll", short: "Scroll", icon: "📜", use: "tp", ex: "Click it and you're standing on the casino floor, wherever you were. Dex sells them at the bar." },
  // gear (all of it DROPS since 2026-09-20: see LOOT)
  gamblers_ring: { name: "Gambler's ring", short: "G. ring", icon: "💍", slot: "ring", fx: { heal: 0.5 }, ex: "A rare drop, from the Yard's boars and hornworms." },
  bookies_amulet: { name: "Bookie's amulet", short: "Bookie's", icon: "📿", slot: "amulet", fx: { tix: 0.05 }, ex: "A rare drop, from highwaymen and Bog Gnashers." },
  adjusters_visor: { name: "Loss adjuster's visor", short: "Visor", icon: "🧢", slot: "helm", def: 1, fx: { tough: 0.1 }, ex: "A rare drop, from Lantern Moths and Tax Wraiths. Insurance, of a sort." },
  stake_loafers: { name: "Stakeholder's loafers", short: "Loafers", icon: "👞", slot: "boots", def: 1, fx: { power: 0.5 }, ex: "A rare drop, from Sorry Ghouls, Cumulus Rams and Thunder Geese. They do nothing on their own." },
  // gear, DROPPED: rare, and only from things that fight back
  sharps_gloves: { name: "Card sharp's gloves", short: "Sharp's", icon: "🧤", slot: "gloves", def: 1, fx: { speed: 0.05 }, ex: "A rare drop. There's still a card up one sleeve." },
  angels_ring: { name: "Angel's ring", short: "Angel's", icon: "💍", slot: "ring", fx: { rare: 0.15 }, ex: "A rare drop. Somebody up there owes you one." },
  // meals, COOKED from something gathered and something killed: all of them leave you Well Fed (no hunger or thirst while they last)
  chickendinner: { name: "Winner's chicken dinner", short: "Chicken d.", icon: "🍗", heal: 6, meal: { mins: 20, fx: { tix: 0.1 } }, ex: "From Dex's kitchen." },
  steakdinner: { name: "Steak dinner", icon: "🍽️", heal: 8, meal: { mins: 20, fx: { speed: 0.1 } }, ex: "From Dex's kitchen." },
  porkchops: { name: "High roller's chops", short: "Chops", icon: "🍖", heal: 10, meal: { mins: 20, fx: { rare: 0.25 } }, ex: "From Dex's kitchen." },
  fishplatter: { name: "Fisherman's platter", short: "Platter", icon: "🐟", heal: 14, meal: { mins: 20, fx: { bite: 0.1, tix: 0.1 } }, ex: "From Dex's kitchen." },
  // drinks, from Dex's bar: one at a time
  beer: { name: "House lager", short: "Lager", icon: "🍺", drink: { mins: 10, fx: { tix: 0.05 } }, ex: "Dex pours it. Click to drink." },
  whiskey: { name: "Top-shelf whiskey", short: "Whiskey", icon: "🥃", drink: { mins: 10, fx: { speed: 0.15, tough: -0.1 } }, ex: "Liquid confidence. Click to drink." },
  cocktail: { name: "The Safety Net", short: "Safety Net", icon: "🍸", drink: { mins: 10, fx: { tough: 0.2 } }, ex: "Pink, strong, and it takes the edge off. Click to drink." },
  champagne: { name: "Champagne", icon: "🍾", drink: { mins: 10, fx: { zdrop: 0.5 } }, ex: "Pop it before a long session out the arch. Click to drink." },
  clover: { name: "Lucky clover", icon: "🍀", luck: 15, ex: "Turns up while you fish. Click it: your next 15 kills or catches are LUCKY (a real ZCoin is 25% more likely to drop)." },
  horseshoe: { name: "Lucky horseshoe", icon: "🧲", luck: 25, ex: "Rare, and only found while fishing. Click it: your next 25 kills or catches are LUCKY." },
  // the Gloam and Cloudreach (2026-09-18): where the tier ores actually live
  emerald_ore: { name: "Emerald ore", icon: "🟢", ex: "Green rock with greener bits. Smelt two for an Emerald bar." },
  diamond_ore: { name: "Diamond ore", icon: "💠", ex: "It was pressed into this shape in the dark for a very long time. It is not grateful." },
  dragonstone_ore: { name: "Dragonstone ore", icon: "🔴", ex: "Warm. Always warm. The clouds up there keep their distance from it." },
  onyx_ore: { name: "Onyx ore", icon: "⚫", ex: "Lightning hit this and it held on to some. Your hair stands up when you carry it." },
  willowlogs: { name: "Gloomwillow logs", icon: "🪵", ex: "Damp, dark and faintly glowing at the ends. They burn blue." },
  skyashlogs: { name: "Skyash logs", icon: "🪵", ex: "Light enough to float. Please don't let go of them." },
  /* v68: two fish to a band. The first bites at the band's Fishing level, the second five levels on (spot.fish2). All heal as caught. */
  perch: { name: "Perch", icon: "🐟", heal: 4, ex: "Stripey, bony, and proud of neither. From the Yard's pond, once you've got the knack." },
  catfish: { name: "Catfish", icon: "🐟", heal: 7, ex: "Whiskers, mud, and an expression like it was expecting you. From the Gloam." },
  mudskipper: { name: "Mudskipper", icon: "🐟", heal: 11, ex: "It walked most of the way to your hook. From the lake in the Lantern Mire." },
  bonefish: { name: "Bonefish", icon: "🐟", heal: 12, ex: "Mostly bones, as advertised. From the Boneyard's flooded crypt." },
  ghostcarp: { name: "Ghost carp", icon: "🐟", heal: 13, ex: "You can see your hand through it. It still tastes of carp. From the Boneyard." },
  cloudray: { name: "Cloud ray", icon: "🐟", heal: 16, ex: "It glides through open sky like it owns the place. From Cloudreach." },
  stormmarlin: { name: "Storm marlin", icon: "🐟", heal: 18, ex: "The sword on its nose hums before rain. From the sea under the Thunderhead." },
  thundersquid: { name: "Thunder squid", icon: "🦑", heal: 20, ex: "Every sucker carries a small charge. Hold it by the head. From the Thunderhead." },
  sporecap: { name: "Sulky sporecap", icon: "🍄", ex: "It came off the toadstool still frowning." },
  markedcard: { name: "Marked card", icon: "🃏", ex: "The ace of spades, with a thumbnail crease in one corner. The Prize Counter takes them off the floor." },
  sharktooth: { name: "Gold shark tooth", icon: "🦷", ex: "He had it capped. You have it now." },
  flashlight: { name: "Usher's flashlight", icon: "🔦", ex: "It only ever points at people who are talking." },
  stormjelly: { name: "Storm jelly", icon: "🫧", ex: "A wobbling lump of bottled weather. It tingles." },
  staticfur: { name: "Static pelt", icon: "🧶", ex: "It stands on end whether you like it or not." },
  hailshard: { name: "Hail shard", icon: "🧊", ex: "A scale of ice that refuses to melt. Cold enough to ache." },
  lanternfish: { name: "Lanternfish", icon: "🐟", heal: 9, ex: "It has its own little light. It keeps it on even now." },
  clanternfish: { name: "Cooked lanternfish", icon: "🐟", heal: 12, ex: "The light goes out when it's cooked. That's how you know." },
  skyeel: { name: "Sky eel", icon: "🐍", heal: 14, ex: "Caught from a cloud, out of the open sky. It is very surprised about it too." },
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
      req: { skill: "melee", lvl: t.gate }, ex: t.ex
    };
  }
  for (const [kind, w] of Object.entries(WEAPONS)) {
    ITEMS[`${t.key}_${kind}`] = {
      name: `${t.name} ${w.name}`, short: w.short, icon: w.icon, slot: "weapon",
      acc: Math.round(t.wAcc * w.acc), str: Math.round(t.wStr * w.str), speed: w.speed, tier: t.key,
      req: w.needsStr
        ? { skill: "melee", lvl: t.gate }
        : { skill: "melee", lvl: t.gate },
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
  // ONE combat skill (2026-09-19): it is your accuracy, your max hit and your defence. The key stays "melee" (what it
  // was before the three-way split) so the hiscores' separate "combat level" board keeps its own name.
  melee: { name: "Combat", icon: "⚔️" },
  hp: { name: "Hitpoints", icon: "❤️" }, fishing: { name: "Fishing", icon: "🎣" }, cooking: { name: "Cooking", icon: "🍳" },
  farming: { name: "Harvesting", icon: "🌾" }, mining: { name: "Mining", icon: "⛏️" }, woodcutting: { name: "Woodcutting", icon: "🪓" },
  smithing: { name: "Smithing", icon: "🔨" }
};
export const COMBAT_SKILLS = ["melee"];
// how the skills panel groups them. Hitpoints sits with combat because that is
// the only place it is earned, even though it is not something you choose.
export const SKILL_GROUPS = [
  { name: "Combat", keys: ["melee", "hp"] },
  { name: "Skilling", keys: ["fishing", "farming"] }   // (cooking, mining, woodcutting and smithing still exist and keep their xp; nothing in the open world uses them since 2026-09-20)
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
  accurate:   { name: "Accurate",   icon: "🎯", share: { melee: 1 },                       blurb: "Every hit teaches you to land the next one. Attack xp." },
  aggressive: { name: "Aggressive", icon: "💥", share: { melee: 1 },                     blurb: "Swing like you mean it. Strength xp, and a bigger maximum hit as it climbs." },
  defensive:  { name: "Defensive",  icon: "🛡️", share: { melee: 1 },                      blurb: "Watch what they do before you do it. Defence xp, and you get hit less." },
  controlled: { name: "Controlled", icon: "⚖️", share: { melee: 1 }, blurb: "A little of each. Slower to a milestone, further along everywhere." }
};
export const stanceOf = () => DEFAULT_STANCE;   // stances were removed (2026-09-19): every hit trains all three evenly
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
export const swingMsOf = (c) => Math.round((ITEMS[c?.eq?.weapon]?.speed || SWING_MS) / (1 + fxOf(c).speed));   /* (fxOf: the outside buffs, further down; a function, so the order in this file does not matter) */
export const TOOL_OF = { mining: "pickaxe", woodcutting: "axe", fishing: "rod" };
export const INV_MAX = 20;   // (was 30 until 2026-09-20: a casino game wants a small bag that fills, so you walk back past the tables to the Cashier.
                             //  normChar re-packs an old 30-slot bag on load and sends what no longer fits to the bank, so nothing is lost.)
export const BANK_MAX = 200;
// a bag slot holds up to 99 of a thing; tickets (and anything marked nocap) piles up without limit. The bank has no cap.
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
// the bag's tidy order: tickets, tools, weapons and armour (by slot, best tier first), food, then everything else by name.
// Partial stacks of the same thing are merged back into 99s, so a sort can free slots.
export function sortInv(inv) {
  const tierRank = (k) => { const t = ITEMS[k]?.tier, i = TIERS.findIndex((x) => x.key === t); return i < 0 ? 99 : -i; };
  const group = (k) => { const it = ITEMS[k] || {}; return k === "tickets" ? 0 : it.tool ? 1 : it.slot ? 2 + SLOTS.indexOf(it.slot) / 10 : it.heal ? 3 : 4; };
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
export const cashIn = (c) => c.inv.find((x) => x.k === "tickets")?.n || 0;
export const fmtTix = (n) => `${Number(n).toLocaleString()} ticket${Number(n) === 1 ? "" : "s"}`;
export const tixIn = (c) => c.inv.find((x) => x.k === "tickets")?.n || 0;
export const fmtCash = (n) => `🎟${Math.round(n).toLocaleString()}`;   /* ONE currency since v57 (2026-09-19): "tickets" is tickets, and an amount wears the ticket, never a $ */   // tickets is written like money everywhere: it is what the tables take

/* ------------------------------------------------------------ directions and reach */
export const DIRS = { "1,0": "east", "-1,0": "west", "0,1": "south", "0,-1": "north", "1,1": "south-east", "-1,1": "south-west", "1,-1": "north-east", "-1,-1": "north-west" };
export const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const SPAN = { n: [21, 23], s: [21, 23], e: [12, 14], w: [12, 14] }, OPP = { n: "s", s: "n", e: "w", w: "e" };
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
  const put = (t, x, y) => { if (wet(x, y)) return; const ob = { t, x, y, edge: true, name: { tree: "Tree", bush: "Bush", boulder: "Boulder" }[t] }; objs.push(ob); /* (edge: the treeline, not a place to work; the page leaves its price off) */ g[y][x] = "#"; rim.push(ob); };
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

export const REAL_TABLES = { cointable: { name: "Coin Flip" }, wheel: { name: "Wheel" }, hilo: { name: "Higher or Lower" }, mines: { name: "Mines" }, plinko: { name: "Plinko" }, scratch: { name: "Scratch-Off" },
  slots: { name: "Slots" }, dicetable: { name: "Dice" } };   /* slots and dice (v58) are EastScape-only games on the site's casino backend: functions/api/casino/{slots,dice} */
/* THE RUSSIAN ROULETTE TABLE'S SEATS (v74), clockwise from the top left, round the 2x2 table at 21,11. The site seats at
   most six; the n-th player at the site's table takes the n-th stool here. */
export const RR_SEATS = [[21, 10], [22, 10], [23, 11], [23, 12], [22, 13], [21, 13]];
/* How the window plays a settled table back (eastscape-casino.js rrPlay), as times: the room's slumps and the floor's "who
   won" line follow the same clock. RR_LEAD is how long the room waits first, because a window only learns of the result on
   its next poll (up to 2 s): the room must never be ahead of the window somebody is watching. */
export const RR_T = { lead: 2200, reload: 700, spin: 1000, pull: 700, click: 340, bang: 1150 };
export function rrTimeline(stages) {   // -> [{ at, seat }] for every shot, then { at, end: true }
  const out = []; let t = RR_T.lead;
  stages.forEach((g, k) => { if (k > 0) t += RR_T.reload; t += RR_T.spin; for (let c = 0; c <= g.live; c++) { t += RR_T.pull; if (c === g.live) { out.push({ at: t, seat: g.shot }); t += RR_T.bang; } else t += RR_T.click; } });
  out.push({ at: t, end: true }); return out;
}
export const rrShowMs = (stages) => (rrTimeline(stages).pop()?.at || 0) + 600;
export const RR_SHOT = { price: 1, everyMs: 5000 };   // Bino's bar cart: a shot of whiskey. It does nothing. That is the point.
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
    npcs: [{ name: "Charon the Ferryman", x: 15, y: 11, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Everyone gets an island. Hop on.", "Plant something. It grows while you're gone."] },
      { name: "Old Tullius", art: "tullius", quests: ["catch"], x: 15, y: 6, hair: "#d8d8d8", shirt: "#5a7a3a", pants: "#3a3a2a", lines: ["The fish bite best where the water bubbles.", "Can't fish with a sword, lad. Hold your rod.", "Don't let the chickens fool you. One took my eye.", "That big copper vein never runs dry. Slow, mind."] }],
    bots: [{ name: "Spartacus", level: 77 }]
  },
  forum: {
    name: "The Forum", exits: {},   // (was s: farm, w: grove, n: tomato, e: appia — closed for now, see OPEN)
    build() {
      const g = grid(), objs = [];
      // a big paved square
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const dx = (x - 21.5) / 19, dy = (y - 13.5) / 10, wob = (hashRand(x, y, 51) - 0.5) * 0.2;
        if (dx * dx + dy * dy < 1 + wob) g[y][x] = "p";
      }
      // three roads out (all closed for now), and the run up to the casino's doors
      for (let y = 20; y < ROWS; y++) for (let x = 21; x <= 23; x++) g[y][x] = "p";
      for (let x = 0; x < 6; x++) for (let y = 12; y <= 14; y++) g[y][x] = "p";
      for (let x = 38; x < COLS; x++) for (let y = 12; y <= 14; y++) g[y][x] = "p";
      for (let y = 2; y < 8; y++) for (let x = 17; x <= 26; x++) g[y][x] = "p";
      const paved = g.map((r) => r.slice());
      for (const [x, y] of [[21, 25], [22, 25], [23, 25], [0, 12], [0, 13], [0, 14], [43, 12], [43, 13], [43, 14]]) { objs.push({ t: "roadblock", art: "o_barricade", x, y, name: "Road closed" }); g[y][x] = "#"; }
      const casino = { t: "house", img: "casino", x: 19, y: 2, w: 5, h: 3, door: { x: 21, y: 4 }, name: "Casino", roof: "#7a2a2a", wall: "#9a3a3a", enter: "casino" };
      const bank = { t: "house", img: "bank", x: 8, y: 5, w: 5, h: 3, door: { x: 10, y: 7 }, name: "Bank", roof: "#8a9aa8", wall: "#efe6d4", sign: "BANK", enter: "bathhouse" };
      objs.push(casino, bank); block(g, 19, 2, 5, 3); block(g, 8, 5, 5, 3);
      // (the smithy stood here until 2026-09-20: the furnace, the anvil, the range and Brutus are at the Yard's camp now, next to the rocks)
      objs.push({ t: "sign", x: 30, y: 8, name: "The smithy's closed. Arms and armour for every level are at the Prize Counter: the big ruby in the middle of the casino." }); g[8][30] = "#";
      // the market stall, south-west; Livia stands behind it
      objs.push({ t: "stall", x: 11, y: 17, w: 2, h: 1, name: "Exchange stall" }); block(g, 11, 17, 2, 1);
      objs.push({ t: "fountain", x: 21, y: 12, w: 2, h: 2, name: "Fountain" }); block(g, 21, 12, 2, 2);
      objs.push({ t: "statue", x: 31, y: 18, name: "Statue" }); g[18][31] = "#";
      objs.push({ t: "sign", x: 25, y: 20, name: "Signpost" }); g[20][25] = "#";
      // Charon's cart (2026-09-20): the way out to your island, now that River Bend and its ferry are closed
      objs.push({ t: "cart", art: "o_chariot", x: 15, y: 20, w: 2, h: 1, name: "Charon's cart" }); block(g, 15, 20, 2, 1);
      objs.push({ t: "rock", ore: "stardust", x: 6, y: 19, name: "Fallen Star", special: true, glow: "#e0b0ff", req: { skill: "mining", lvl: 50 }, xp: 150, tease: "It landed during the games last spring. Nobody's managed to chip it yet." }); g[19][6] = "#";
      for (const [x, y] of [[16, 9], [27, 9], [15, 18], [28, 17], [19, 20]]) { objs.push({ t: "bush", x, y, name: "Planter" }); g[y][x] = "#"; }
      for (const [x, y] of [[14, 12], [29, 13]]) { objs.push({ t: "bench", x, y, w: 3, h: 1, name: "Bench" }); block(g, x, y, 3, 1); }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "#" && paved[y][x] === "p") g[y][x] = "P";
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, keepOf(this), 4);
      return { g, objs, blobs: [] };
    },
    mobs: [],
    npcs: [
      { name: "Livia the Broker", x: 12, y: 16, still: true, opens: "exchange", reach: 2, hair: "#2a1a10", shirt: "#c89a2a", pants: "#3a2a1a", lines: ["Buying? Selling? Use the stall. I take 1%.", "It keeps selling while you sleep."] },
           { name: "Charon the Ferryman", art: "charon", x: 18, y: 21, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Islands. Everyone gets one. Nobody knows who's paying for them.", "The river's closed, so now it's a cart. Don't ask how a cart gets to an island. I don't.", "Plant something before you go back in there and lose your shirt. It grows while you're away.", "Wheat, ten minutes. Tomatoes, twenty. Both sell. Both cook."] },
           { name: "Gaius", x: 25, y: 15, hair: "#5a3a2a", shirt: "#9a3a5a", pants: "#3a2a3a", pigeon: true, lines: ["PIGEON: He doesn't talk. I do. Coo.", "PIGEON: Casino's that way. Everything's that way. Coo."] }],
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
  /* THE SKILLING LINE runs west from the casino: the Workyard, then the Gloam, then Cloudreach. Same three jobs at
     every stop (rock, wood, fish), worth more the further out you go, and gated by level so there is somewhere to
     be heading. No monsters on this line (2026-09-20): fighting is the other arch. */
  gloam: {
    name: "The Gloam", ground: "gloam", exits: { e: "workyard", w: "mire" }, tint: "rgba(8,30,48,.32)",
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 18; y++) g[y][19] = ",";
      // the black pond, fished from its north bank: trout from Fishing 10, catfish from 15
      for (let y = 20; y <= 23; y++) for (let x = 13; x <= 25; x++) g[y][x] = "~";
      for (const x of [15, 17, 19, 21, 23]) objs.push({ t: "spot", x, y: 20, name: "Black pond", req: { skill: "fishing", lvl: 10 }, fish: "trout", fish2: "catfish", fish2lvl: 15, xp: 50, xp2: 65, glow: "#7ad8ff", tease: "Something heavy turns over under the black water. Fishing 10, the sign says." });
      for (let x = 12; x <= 26; x++) keep.push([x, 19], [x, 18]);
      objs.push({ t: "fire", x: 21, y: 16, name: "Campfire" }); g[16][21] = "#";   // somewhere to stand
      objs.push({ t: "sign", x: 3, y: 11, name: "West: the Lantern Mire. It opens at Combat 20, and Fishing 20 for the lake." }); g[11][3] = "#";
      objs.push({ t: "sign", x: 16, y: 15, name: "THE GLOAM: Combat 10 to 19. Nothing out here attacks first: click a monster to fight it. Toadstools by the way in, highwaymen and goats further on, Bog Gnashers in the north clearing, and the idle dead in the south-west." }); g[15][16] = "#";
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 9);
      return { g, objs, blobs: [] };
    },
    // toadstools by the way in (east), highwaymen north-west and by the pond, goats in the middle, the idle dead in the south-west.
    // The gnashers attack on sight and are boxed in by their own reach, in the north clearing (tools/eastscape-aggro-check.mjs)
    mobs: [["toadstool", 31, 7], ["toadstool", 35, 8], ["toadstool", 37, 4], ["toadstool", 30, 10], ["toadstool", 38, 21], ["toadstool", 36, 16],
      ["highwayman", 8, 5], ["highwayman", 12, 8], ["highwayman", 5, 9], ["highwayman", 28, 17], ["highwayman", 30, 21], ["highwayman", 34, 18],
      ["goat", 27, 5], ["goat", 29, 8], ["goat", 32, 17], ["goat", 34, 22],
      ["boneidle", 4, 20], ["boneidle", 6, 21], ["boneidle", 5, 17], ["boneidle", 9, 19],
      ["gnasher", 21, 3], ["gnasher", 21, 5], ["gnasher", 21, 4], ["gnasher", 20, 4]],
    npcs: [], bots: []
  },
  /* THE LANTERN MIRE, 20-29 (v68). The Gloam's ground gone green, and a LAKE where the Gloam had a pond. */
  mire: {
    name: "The Lantern Mire", ground: "gloam", exits: { e: "gloam", w: "boneyard" }, tint: "rgba(14,52,22,.34)",
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 16; y++) g[y][24] = ",";
      for (let y = 18; y <= 23; y++) for (let x = 14; x <= 33; x++) g[y][x] = "~";   // the lake: most of the south
      for (const x of [16, 20, 24, 28, 32]) objs.push({ t: "spot", x, y: 18, name: "Lantern lake", req: { skill: "fishing", lvl: 20 }, fish: "lanternfish", fish2: "mudskipper", fish2lvl: 25, xp: 80, xp2: 95, glow: "#a8ffb0", tease: "Little lights drift under the surface. They move away when you lean close. Fishing 20." });
      for (let x = 13; x <= 34; x++) keep.push([x, 17], [x, 16]);
      objs.push({ t: "sign", x: 3, y: 11, name: "West: the Boneyard. It opens at Combat 30, and Fishing 30 for the flooded crypt." }); g[11][3] = "#";
      objs.push({ t: "sign", x: 30, y: 15, name: "THE LANTERN MIRE: Combat 20 to 29. Nothing here attacks first. Paper Twisters and moths to the east, Card Counters in the north-west, Tax Wraiths in the north clearing, Loan Sharks in the far south-west." }); g[15][30] = "#";
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 9);
      return { g, objs, blobs: [] };
    },
    mobs: [["twister", 36, 5], ["twister", 39, 8], ["twister", 33, 9], ["twister", 38, 3], ["twister", 41, 6], ["twister", 35, 10],
      ["moth", 37, 16], ["moth", 40, 18], ["moth", 38, 21], ["moth", 41, 22], ["moth", 36, 19], ["moth", 39, 15],
      ["counter", 8, 5], ["counter", 11, 8], ["counter", 6, 9], ["counter", 13, 4], ["counter", 9, 10],
      ["taxwraith", 21, 2], ["taxwraith", 22, 3], ["taxwraith", 20, 3], ["taxwraith", 21, 4],
      ["shark", 3, 21], ["shark", 5, 22], ["shark", 4, 23]],
    npcs: [], bots: []
  },
  cloud: {
    name: "Cloudreach", ground: "cloud", exits: { e: "boneyard", w: "thunderhead" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 17; y++) g[y][31] = ",";
      // a hole in the cloud: the sky below, fished from its north side. Sky eels from Fishing 40, cloud rays from 45
      for (let y = 19; y <= 22; y++) for (let x = 27; x <= 36; x++) g[y][x] = "~";
      for (const x of [28, 30, 32, 34, 36]) objs.push({ t: "spot", x, y: 19, name: "Hole in the cloud", req: { skill: "fishing", lvl: 40 }, fish: "skyeel", fish2: "cloudray", fish2lvl: 45, xp: 140, xp2: 165, glow: "#bfe8ff", tease: "Long shapes swim through the open sky below. Fishing 40." });
      for (let x = 26; x <= 37; x++) keep.push([x, 18], [x, 17]);
      objs.push({ t: "fire", x: 24, y: 10, name: "Cloud-fire" }); g[10][24] = "#";
      objs.push({ t: "sign", x: 20, y: 11, name: "Further west: the Thunderhead. It opens at Combat 50, and Fishing 50 for the sea underneath it. Nothing past it." }); g[11][20] = "#";   /* (not at the west edge: the revenants can reach that) */
      objs.push({ t: "sign", x: 26, y: 15, name: "CLOUDREACH: Combat 40 to 49. Nothing here attacks first. Rams by the way in, Brainstorms in the middle, Sea-Goats to the south-west, Sulking Revenants in the far north-west, Angels of Minor Inconvenience in the far south-west." }); g[15][26] = "#";
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "water", s: "water", w: "water", e: "water" }, [...keepOf(this), ...keep], 10);
      return { g, objs, blobs: [] };
    },
    mobs: [["ram", 39, 16], ["ram", 40, 19], ["ram", 38, 7], ["ram", 35, 5], ["ram", 33, 9], ["ram", 41, 10],
      ["brainstorm", 22, 6], ["brainstorm", 27, 4], ["brainstorm", 29, 8], ["brainstorm", 25, 8], ["brainstorm", 21, 17], ["brainstorm", 23, 20],
      ["seagoat", 15, 17], ["seagoat", 18, 20], ["seagoat", 16, 9],
      ["revenant", 8, 2], ["revenant", 10, 3], ["revenant", 7, 4], ["revenant", 11, 2],
      ["angel", 8, 22], ["angel", 11, 22], ["angel", 6, 21], ["angel", 9, 23]],
    npcs: [], bots: []
  },
  /* THE THUNDERHEAD, 50 and up (v68). The end of the road: Cloudreach's ground under a storm, and open SEA to the south-west. */
  thunderhead: {
    name: "The Thunderhead", ground: "cloud", exits: { e: "cloud" }, tint: "rgba(18,16,56,.42)",
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 12; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 16; y++) g[y][14] = ",";
      for (let y = 18; y <= 23; y++) for (let x = 3; x <= 22; x++) g[y][x] = "~";   // the sea, seen through the floor of the storm
      for (const x of [6, 10, 14, 18, 21]) objs.push({ t: "spot", x, y: 18, name: "The sea below", req: { skill: "fishing", lvl: 50 }, fish: "stormmarlin", fish2: "thundersquid", fish2lvl: 58, xp: 190, xp2: 230, glow: "#ffe27a", tease: "Far below, something with a sword for a nose cuts the water. Fishing 50." });
      for (let x = 2; x <= 23; x++) keep.push([x, 17], [x, 16]);
      objs.push({ t: "sign", x: 40, y: 11, name: "THE THUNDERHEAD: Combat 50 and up. The end of the road. Nothing here attacks first, not even THE HOUSE, in the north-west corner. The House always wins. Usually." }); g[11][40] = "#";
      for (let x = 12; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "water", s: "water", w: "water", e: "water" }, [...keepOf(this), ...keep], 10);
      return { g, objs, blobs: [] };
    },
    mobs: [["goose", 38, 5], ["goose", 40, 8], ["goose", 36, 9], ["goose", 39, 17], ["goose", 41, 19], ["goose", 35, 17],
      ["golem", 30, 5], ["golem", 33, 8], ["golem", 28, 9], ["golem", 31, 10], ["golem", 27, 17], ["golem", 30, 19],
      ["wolf", 18, 2], ["wolf", 21, 3], ["wolf", 24, 2], ["wolf", 26, 4], ["wolf", 22, 4],
      ["drake", 33, 22], ["drake", 36, 23], ["drake", 39, 22], ["drake", 41, 23],
      ["house", 5, 4]],
    npcs: [], bots: []
  },
  /* THE THIRD FIGHT MAP, past the Rough. It wears the Wilderness's clothes (dark: true) but nobody can attack you here
     but the residents. Gnashers and moths by the gate, ghouls and Tax Wraiths in the middle, a Chandelier Spider and
     the Understudy at the far end. Several of them come for you on sight. */
  boneyard: {
    name: "The Boneyard", dark: true, exits: { e: "mire", w: "cloud" }, tint: "rgba(60,20,70,.2)",
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 17; y++) g[y][35] = ",";
      // the flooded crypt, fished from its north side: bonefish from Fishing 30, ghost carp from 35
      for (let y = 19; y <= 22; y++) for (let x = 31; x <= 40; x++) g[y][x] = "~";
      for (const x of [32, 34, 36, 38, 40]) objs.push({ t: "spot", x, y: 19, name: "Flooded crypt", req: { skill: "fishing", lvl: 30 }, fish: "bonefish", fish2: "ghostcarp", fish2lvl: 35, xp: 110, xp2: 130, glow: "#d8c8ff", tease: "Pale shapes slide between the sunken headstones. Fishing 30." });
      for (let x = 30; x <= 41; x++) keep.push([x, 18], [x, 17]);
      for (const [x, y] of [[9, 5], [11, 6], [10, 8], [20, 18], [22, 19], [21, 21], [33, 5], [35, 6], [34, 8], [25, 5], [13, 20]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      for (const [x, y] of [[7, 19], [27, 9], [38, 11]]) { objs.push({ t: "skeleton", x, y, name: "Somebody who stayed" }); g[y][x] = "#"; }
      for (const [x, y] of [[4, 4], [18, 3], [40, 4], [24, 22]]) { objs.push({ t: "deadtree", x, y, name: "Dead tree" }); g[y][x] = "#"; }
      objs.push({ t: "sign", x: 3, y: 11, name: "West: Cloudreach. It opens at Combat 40, and Fishing 40. Bring a head for heights." }); g[11][3] = "#";
      objs.push({ t: "sign", x: 28, y: 15, name: "THE BONEYARD: Combat 30 to 39. Nothing here attacks first. Ghouls to the east, Stagehands to the west, Understudies in the middle, Chandelier Spiders in the north, One-Eyed Ushers in the far south-west." }); g[15][28] = "#";
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 33);
      return { g, objs, blobs: [] };
    },
    mobs: [["ghoul", 36, 7], ["ghoul", 39, 9], ["ghoul", 31, 9], ["ghoul", 37, 3], ["ghoul", 41, 7], ["ghoul", 30, 6],
      ["stagehand", 8, 8], ["stagehand", 13, 9], ["stagehand", 6, 6], ["stagehand", 14, 5], ["stagehand", 16, 17], ["stagehand", 18, 20],
      ["understudy", 24, 17], ["understudy", 26, 20], ["understudy", 27, 16], ["understudy", 23, 8],
      ["chandelier", 20, 2], ["chandelier", 22, 3], ["chandelier", 21, 4],
      ["usher", 4, 21], ["usher", 6, 22], ["usher", 8, 21], ["usher", 5, 23]],
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
export const START = { scene: "casino", x: 21, y: 18 };

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
    name: "The Bank", interior: true, floor: "marble", room: [15, 9, 28, 16], exitTo: { scene: "forum", x: 10, y: 8 }, entry: { x: 21, y: 16 },
    // on the back wall, left to right: a banner, a lamp, the vault door, a lamp, a banner
    wall: [{ t: "banner", x: 17 }, { t: "lamp", x: 19.5 }, { t: "vault", x: 21.5 }, { t: "lamp", x: 23.5 }, { t: "banner", x: 26 }],
    build() {
      const g = room(15, 9, 28, 16, 21), objs = [];
      for (const x of [17, 21, 25]) objs.push({ t: "booth", x, y: 10, name: "Bank booth" });
      objs.push({ t: "counter", x: 15, y: 10, w: 14, h: 1, name: "Counter" }); block(g, 15, 10, 14, 1);
      objs.push({ t: "rug", x: 21, y: 11, w: 2, h: 6, color: "#9a2a2a", name: "Runner" });
      for (const [x, y] of [[15, 12], [28, 12], [15, 15], [28, 15]]) { objs.push({ t: "column", x, y, name: "Column" }); g[y][x] = "#"; }
      for (const [x, y] of [[16, 11], [27, 11], [17, 16], [26, 16]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      objs.push({ t: "bench", x: 17, y: 13, w: 3, h: 1, name: "Bench" }); block(g, 17, 13, 3, 1);
      objs.push({ t: "bench", x: 24, y: 13, w: 3, h: 1, name: "Bench" }); block(g, 24, 13, 3, 1);
      objs.push({ t: "goatstatue", x: 18, y: 15, name: "Statue" }); g[15][18] = "#";
      objs.push({ t: "chest", x: 25, y: 15, name: "Strongbox" }); g[15][25] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Aurelia", x: 21, y: 9, still: true, opens: "bank", reach: 2, hair: "#1a1a2a", shirt: "#3a6a8a", pants: "#2a2a3a", lines: ["Welcome to the Bank. Use any booth.", "We hold anything. Not tickets."] }]
  },
  // WEST of the casino, the first stop on the skilling line: a bit of everything a beginner gathers
  /* ONE WAY OUT (2026-09-20, the owner: "one entrance for skilling/combat/crafting, all available in a few scenes"). The
     casino's arch leads to a single line of three scenes, and the further you walk the better it pays:
       the Yard (levels 1-14)  ->  the Gloam (15-29)  ->  Cloudreach (30+)
     Each has its rocks, trees, fish AND its monsters, so friends doing different jobs are standing in the same field.
     THE CAMP is in the Yard only: furnace, anvil, range and Brutus, right beside the rocks, and every walk home from
     anywhere passes it. Out deeper there is a campfire to cook on and nothing else. Cashing in is still only inside
     the casino: the walk past the tables is the point. Monsters that come for you on sight are kept where their reach
     (home +/-3 by +/-2 of wandering, plus their aggro) can't touch a rock, a pool or the path.
     The old combat line (paddock, rough, boneyard) is still defined below and closed, like the farm. */
  workyard: {
    name: "The Yard", exits: { e: "casino", w: "gloam" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 17; y++) g[y][20] = ",";
      // the pond, south: fished from its north bank. The one quiet job out here.
      for (let y = 19; y <= 22; y++) for (let x = 15; x <= 25; x++) g[y][x] = "~";
      for (const x of [16, 18, 20, 22, 24]) objs.push({ t: "spot", x, y: 19, name: "Fishing spot", fish: "sardine", fish2: "perch", fish2lvl: 5, xp: 20, xp2: 30 });
      for (let x = 14; x <= 26; x++) keep.push([x, 18], [x, 17]);
      /* A BANK CHEST in the Yard (the owner, 2026-09-19): a `booth` in a chest's clothes, so it IS the bank, the same
         window and the same rules as Aurelia's counters in town (tickets still can't go in). Saves the walk. */
      objs.push({ t: "booth", art: "o_chest", x: 35, y: 16, name: "Bank chest" }); g[16][35] = "#";
      objs.push({ t: "sign", x: 27, y: 15, name: "GEAR, CHIPS AND PRIZES are all at the Prize Counter now: the big ruby in the middle of the casino. Bring your tickets." }); g[15][27] = "#";
      objs.push({ t: "sign", x: 41, y: 11, name: "THE YARD. Click a monster to fight it. Chickens by the gate; it gets meaner the further west you walk. Nothing here attacks first. The pond is for anyone who'd rather fish." }); g[11][41] = "#";
      objs.push({ t: "sign", x: 3, y: 11, name: "West: the Gloam. It opens at Combat 10 for its monsters, and Fishing 10 for its pond. Bigger tickets, better fish." }); g[11][3] = "#";
      for (const [x, y] of [[36, 7], [29, 22], [17, 6], [7, 8]]) { objs.push({ t: "hay", x, y, name: "Hay bale" }); g[y][x] = "#"; }
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, [...keepOf(this), ...keep], 12);
      return { g, objs, blobs: [] };
    },
    // east to west, easy to hard: chickens at the gate, then cows, bad tomatoes, hornworms, and boars at the far end
    mobs: [["chicken", 38, 5], ["chicken", 41, 8], ["chicken", 36, 9], ["chicken", 39, 18], ["chicken", 41, 21], ["chicken", 36, 20],
      ["cow", 30, 4], ["cow", 33, 7], ["cow", 27, 6], ["cow", 30, 21], ["cow", 34, 22],
      ["rotten", 21, 4], ["rotten", 24, 7], ["rotten", 19, 8], ["rotten", 22, 10], ["olive", 16, 4], ["olive", 17, 10], ["olive", 25, 10],
      ["hornworm", 12, 5], ["hornworm", 15, 8], ["hornworm", 10, 9], ["hornworm", 11, 17],
      ["boar", 5, 5], ["boar", 8, 17], ["boar", 4, 19], ["boar", 11, 21], ["boar", 6, 22]],
    npcs: [],   // (Brutus sold gear here for a few hours on 2026-09-20; it is behind the Prize Counter now)
    bots: []
  },
  // EAST of the casino, the first stop on the combat line: things a beginner can win a fight with
  paddock: {
    name: "The Paddock", wikiHide: true, exits: { w: "casino", e: "rough" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 6; y <= 13; y++) g[y][11] = ","; for (let y = 13; y <= 20; y++) g[y][24] = ",";
      for (const [x, y] of [[15, 9], [16, 9], [28, 17]]) { objs.push({ t: "hay", x, y, name: "Hay bale" }); g[y][x] = "#"; }
      objs.push({ t: "fire", x: 14, y: 16, name: "Campfire" }); g[16][14] = "#";
      for (const [x, y] of [[3, 3], [40, 22], [4, 21], [39, 3], [20, 2]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      objs.push({ t: "sign", x: 40, y: 11, name: "East: the Rough. Bigger things, bigger money. Combat 8 or so." }); g[11][40] = "#";
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "rocky" }, [...keepOf(this), ...keep], 13);
      return { g, objs, blobs: [] };
    },
    // chickens by the gate, cows in the middle, rotten tomatoes at the far end
    mobs: [["chicken", 6, 5], ["chicken", 9, 8], ["chicken", 5, 10], ["chicken", 8, 18], ["chicken", 12, 20], ["chicken", 6, 21],
      ["cow", 19, 6], ["cow", 23, 9], ["cow", 27, 5], ["cow", 21, 19], ["cow", 27, 21],
      ["rotten", 34, 7], ["rotten", 38, 10], ["rotten", 36, 18], ["rotten", 39, 21]],
    npcs: [], bots: []
  },
  // the second (and last, for now) fight map: past the Paddock, where the money is better and so are the teeth
  rough: {
    name: "The Rough", wikiHide: true, exits: { w: "paddock", e: "boneyard" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 5; y <= 13; y++) g[y][14] = ","; for (let y = 13; y <= 21; y++) g[y][27] = ",";
      objs.push({ t: "fire", x: 6, y: 10, name: "Campfire" }); g[10][6] = "#";
      for (const [x, y] of [[4, 4], [39, 4], [5, 22], [40, 21], [21, 3], [22, 23], [33, 9]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (const [x, y] of [[18, 8], [31, 18], [36, 6]]) { objs.push({ t: "boulder", x, y, name: "Boulder" }); g[y][x] = "#"; }
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      objs.push({ t: "sign", x: 41, y: 11, name: "East: the Boneyard. Things that were buried for a reason. Combat 20 at the very least." }); g[11][41] = "#";
      wild(g, objs, this.exits, { n: "rocky", s: "forest", w: "forest", e: "rocky" }, [...keepOf(this), ...keep], 21);
      return { g, objs, blobs: [] };
    },
    // hornworms and boars by the gate, highwaymen (who carry actual tickets) in the middle, two gnashers at the far end
    mobs: [["hornworm", 7, 6], ["hornworm", 10, 18], ["hornworm", 5, 19], ["boar", 12, 8], ["boar", 17, 17], ["boar", 19, 6], ["boar", 15, 21],
      ["highwayman", 25, 7], ["highwayman", 29, 10], ["highwayman", 24, 19], ["highwayman", 31, 20], ["highwayman", 34, 15],
      ["gnasher", 37, 6], ["gnasher", 38, 20]],
    npcs: [], bots: []
  },
  /* THE FIGHT PIT (2026-09-20): through the door marked FIGHTING on the casino's back wall. Two monsters, one sand pit,
     and everybody round the rail with money on it. One fight at a time for the whole room, on a clock, exactly like
     the roulette table: FIGHTS.betMs to get your money down, then they go at it, then the next pair comes out. The
     fight is pure chance (FIGHTS, below); what you watch is the server's script of it. The pit itself is one big
     object (`fightring`) you click to bet; the floor round it is where the crowd stands. */
  fightpit: {
    /* realRound (v64): this room's game is one of eastcoin.vip's SHARED ROUNDS (functions/api/casino/_engine.js GAMES.pit /
       GAMES.roul), for ZCoins or tickets. The PAGE reads the site's round and builds the very view the ring, the wheel
       and both windows already draw from (eastscape-casino.js, "SHARED ROUNDS"); the game server runs no rounds of its
       own in a room that has this, takes no bets there, and never touches a ZCoin. */
    realRound: "pit",
    name: "The Fight Pit", interior: true, floor: "wood", wallH: 34, room: [9, 5, 34, 20], exitTo: { scene: "casino", x: 10, y: 5 }, entry: { x: 21, y: 20 },
    pit: { x: 15, y: 9, w: 14, h: 7 },
    wall: [{ t: "banner", x: 10 }, { t: "lamp", x: 13 }, { t: "lamp", x: 17.5 }, { t: "lamp", x: 26 }, { t: "lamp", x: 30.5 }, { t: "banner", x: 33.5 }],
    doorSigns: [{ x: 22, text: "HIGH ROLLERS" }],
    build() {
      const g = room(9, 5, 34, 20, 21), objs = [];
      objs.push({ t: "walldoor", x: 22, y: 4, name: "The High Roller Room", enter: "highroller" });   // (the owner, 2026-09-20: "a high roller section, accessible from a door in the fighting ring")
      objs.push({ t: "fightring", x: 15, y: 9, w: 14, h: 7, name: "The pit: bet on the fight" }); block(g, 15, 9, 14, 7);
      for (const [x, y] of [[12, 6], [31, 6]]) { objs.push({ t: "fightboard", art: "o_notice", x, y, name: "Tonight's card: bet on the fight" }); g[y][x] = "#"; }
      // somewhere to perch along the rail, crates and barrels in the corners, and a bin that's seen things
      for (const x of [16, 18, 20, 23, 25, 27]) for (const y of [8, 16]) if (g[y][x] === "i") objs.push({ t: "stool", x, y, name: "Stool", soft: true });
      for (const y of [10, 12, 14]) for (const x of [14, 29]) if (g[y][x] === "i") objs.push({ t: "stool", x, y, name: "Stool", soft: true });
      for (const [t, x, y, name] of [["crate", 9, 5, "Crate"], ["barrel", 10, 5, "Barrel"], ["barrel", 34, 5, "Barrel"], ["crate", 33, 5, "Crate"], ["crate", 9, 20, "Crate"], ["barrel", 34, 20, "Barrel"], ["trashcan", 25, 20, "Bin"], ["cooler", 17, 5, "Water cooler"]]) { objs.push({ t, x, y, name }); g[y][x] = "#"; }
      // a drink and a plate without leaving the rail: nobody should miss a fight for a sandwich
      objs.push({ t: "buffet", x: 18, y: 5, w: 2, h: 1, name: "Buffet" }); block(g, 18, 5, 2, 1);
      objs.push({ t: "cooler", x: 27, y: 5, name: "Water cooler" }); g[5][27] = "#"; objs.push({ t: "buffet", x: 25, y: 5, w: 2, h: 1, name: "Buffet" }); block(g, 25, 5, 2, 1);
      for (const [x, y] of [[11, 12], [32, 13], [19, 18], [26, 7]]) if (g[y][x] === "i") objs.push({ t: "l_slips", x, y, name: "Losing slips", soft: true, flat: true });
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [{ name: "RingsideRon", level: 22 }, { name: "bloodsport99", level: 47 }, { name: "ChalkEater", level: 9 }],
    npcs: [{ name: "Vince the Bouncer", art: "vince", x: 23, y: 5, still: true, hair: "#1a1a1a", shirt: "#141418", pants: "#141418", lines: ["Room's shut. Refit.", "Shoes. I always look at the shoes."] }]
  },
  /* THE HIGH ROLLER ROOM (2026-09-20): through the door in the Fight Pit's back wall. The same games, ten times the
     limits (def.limits), and a $100 floor. Vince lets you in with HIGH_ROLLER.cash in your bag or the High Roller buff
     (which you get from fighting, which is why the door is where it is). Luck and effects cover the first FX_COVER of a
     stake only, so big bets are big swings, not a better job. No slots in here: the jackpot belongs to the main floor. */
  highroller: {
    name: "The High Roller Room", interior: true, floor: "casino", wallH: 34, room: [11, 6, 32, 19], exitTo: { scene: "fightpit", x: 22, y: 5 }, entry: { x: 21, y: 19 },
    limits: { min: 100, mult: 10 }, door: { cash: 2500 },
    wall: [{ t: "lamp", x: 12.5 }, { t: "painting2", x: 15.5, dy: 5 }, { t: "lamp", x: 18.5 }, { t: "neon", x: 21.5, dy: 16 }, { t: "lamp", x: 24.5 }, { t: "painting1", x: 27.5, dy: 7, frame: true }, { t: "lamp", x: 30.5 }],
    build() {
      const g = room(11, 6, 32, 19, 21), objs = [];
      const put = (t, x, y, name, w = 1, extra = {}) => { objs.push({ t, x, y, ...(w > 1 ? { w, h: 1 } : {}), name, ...extra }); block(g, x, y, w, 1); };
      const seat = (x, y) => { if (g[y][x] === "i") objs.push({ t: "stool", x, y, name: "Stool", soft: true }); };
      put("cointable", 13, 9, "High-limit Coin Flip", 2); put("cointable", 13, 13, "High-limit Coin Flip", 2);
      put("dicetable", 17, 11, "High-limit Dice", 2); put("wheel", 17, 15, "High-limit Wheel", 2, { art: "o_prizewheel" });
      put("hilo", 25, 9, "High-limit Higher or Lower", 2); put("hilo", 25, 13, "High-limit Higher or Lower", 2);
      put("mines", 29, 9, "High-limit Mines", 2); put("plinko", 29, 13, "High-limit Plinko", 2); put("scratch", 29, 16, "High-limit Scratch-Off", 2);
      for (const [x, y] of [[13, 10], [14, 10], [13, 14], [14, 14], [17, 12], [18, 12], [25, 10], [26, 10], [25, 14], [26, 14], [17, 16], [18, 16]]) seat(x, y);
      // the lounge in the middle: somewhere to sit and be seen, and the good buffet
      put("cocktail", 21, 10, "Cocktail table"); put("cocktail", 22, 13, "Cocktail table");
      for (const [x, y] of [[20, 10], [22, 10], [21, 13], [23, 13]]) if (g[y][x] === "i") objs.push({ t: "armchair", x, y, name: "Armchair", soft: true });
      put("buffet", 19, 6, "The good buffet", 2); put("cooler", 21, 6, "Sparkling water"); put("atm", 31, 6, "tickets machine (it only takes)"); put("piano", 23, 6, "Piano", 2);
      put("planter", 11, 6, "Planter", 2); put("planter", 11, 19, "Planter", 2); put("planter", 31, 19, "Planter", 2); put("coatrack", 32, 12, "Coat rack"); put("suitcase", 12, 17, "Somebody's suitcase. It's heavy.");
      for (const [x, y] of [[16, 8], [24, 17], [28, 11]]) if (g[y][x] === "i") objs.push({ t: "l_chips", x, y, name: "Dropped chips", soft: true, flat: true });
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [{ name: "MaxBetMarv", level: 58 }, { name: "WhaleWatcher", level: 41 }],
    npcs: [{ name: "Sterling the Host", art: "sterling", x: 21, y: 17, still: true, hair: "#d8d8e0", shirt: "#f4f0e8", pants: "#1a1a1a", lines: ["Welcome to the room. Same games, ten times the limits, and nobody out there can hear you scream.", "A hundred dollars is the smallest bet at any table in here. If that stings, the door's behind you, and no hard feelings.", "A word on luck and dinners: they cover the first $1,500 of a bet. Past that you're on your own, like the rest of us.", "The buffet is better in here. That isn't a secret, it's the whole point.", "Biggest pot I've seen walk out of here was on Mines. Biggest I've seen walk IN, too."] }]
  },
  // inside the Casino: a hangout first, a gambling den second. Games of chance for tickets (never ZCoins), the
  // daily-task board, a bar, and Dex, who has seen everything and will tell you about most of it.
  /* GAMBA's hub (2026-09-19): the casino is the middle of the world and where everyone starts. Four ways out, as on
     the owner's map: NORTH the upper floors (Floor 2 is the Roulette Room), WEST the skilling line, EAST the combat
     line, SOUTH the town (crafting: the smithy and the market). The side archways are real exits at the grid's edge;
     the south door is the building's front door onto the Forum. */
  casino: {
    name: "The Casino", interior: true, floor: "casino", wallH: 34, room: [1, 4, 42, 21], exits: { w: "workyard" }, labels: { w: "OUTSIDE", s: "TOWN" }, exitTo: { scene: "forum", x: 21, y: 5 }, entry: { x: 21, y: 20 },
    wall: [{ t: "banner", x: 3 }, { t: "lamp", x: 7 }, { t: "lamp", x: 11 }, { t: "painting1", x: 14.5, dy: 7, frame: true }, { t: "lamp", x: 17 }, { t: "lamp", x: 24 }, { t: "painting2", x: 28, dy: 5 }, { t: "lamp", x: 31 }, { t: "neon", x: 35.5, dy: 16 }, { t: "lamp", x: 39.3 }, { t: "banner", x: 41 }],
    doorSigns: [{ x: 10, text: "FIGHTING" }],
    /* THE REAL TABLES (2026-09-20). On this floor, these tables are eastcoin.vip's own casino games, played for REAL
       ZCoins. The WINDOW is EastScape's own (the owner: "keep the current casino game interfaces... hook them up to
       zcoin"); behind it, every bet goes from the page straight to the site's endpoints (eastscape-casino.js, REAL MODE),
       so the limits (20 a bet, ten an hour a game, 400 an hour out), the result, the fairness seed and the ledger are
       the site's. The game server never touches a ZCoin. Their tickets copies are retired HERE (the server refuses a tickets bet at them on a floor that lists
       them); the High Roller Room keeps its own tickets tables, and slots, dice, roulette and the Fight Pit were always tickets. */
    real: REAL_TABLES,
    smoke: [38.5, 5.2, 42.6, 10.2],   // where the page hangs a haze: the smoking section (tile coordinates)
    // (the rooms were named in gold on the carpet, def.zones, until the owner found the lettering too big: 2026-09-20. The page still knows how to draw them.)
    build() {
      const g = room(1, 4, 42, 21, 21), objs = [];
      for (let y = SPAN.w[0]; y <= SPAN.w[1]; y++) g[y][0] = "e";   // one arch, west (the east one was the combat line's until 2026-09-20)
      objs.push({ t: "walldoor", x: 21, y: 3, name: "Floor 2: the Roulette Room", enter: "roulette" });
      objs.push({ t: "roulsign", x: 21, y: 2, name: "Roulette", dy: -3 });
      objs.push({ t: "walldoor", x: 10, y: 3, name: "The Fight Pit", enter: "fightpit" });   // (its sign is lettered by the page: def.doorSigns)
      /* THE FLOOR, LIKE A REAL ONE (2026-09-20, the owner: "put games together, as in sections... rope them off").
         Every kind of game has its own roped-off room, and you can see which is which from the aisles:

             SLOTS (three banks, back to back)   |  aisle  |   CARD ROOM          |  THE BAR
           --------- rope, one way in ----------    door     ------- rope --------------------
             Cashier        the long aisle, arch to arch, round the House Ruby        Cashier
           --------- rope, one way in ----------   entrance  ------- rope --------------------
             WHEELS    |    COIN FLIP            |  aisle  |   DICE PIT   |   INSTANT WINS

         Ropes are real (the posts AND the rope between them block the way), but there are only a few of them now
         (owner, later the same day: "reduce some of the roping off"): a short run either side of each room's way in,
         like the stanchions at a real door. The rest of each edge is planters, vending machines, bins and open carpet,
         and the rooms are broken up with the things a casino is full of: a stool at every other machine and two at
         every table (you can stand on a stool: it's where you'd sit), soda and snack machines, a water cooler, and a
         SMOKING SECTION in the north-east corner with club chairs, ashtrays and a haze the page draws (def.smoke).
         rope() lays a line of posts two tiles apart and leaves a "ropeline" marker the page draws the rope from. */
      const put = (t, x, y, name, w = 1, extra = {}) => { objs.push({ t, x, y, ...(w > 1 ? { w, h: 1 } : {}), name, ...extra }); block(g, x, y, w, 1); };
      const seat = (x, y) => { if (g[y][x] === "i") objs.push({ t: "stool", x, y, name: "Stool", soft: true }); };   // soft: it doesn't block; you stand where you'd sit
      const posts = new Set();
      const rope = (x1, y1, x2, y2) => {
        const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1), n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let k = 0; k <= n; k++) { const x = x1 + dx * k, y = y1 + dy * k; g[y][x] = "#"; if ((k % 2 === 0 || k === n) && !posts.has(`${x},${y}`)) { posts.add(`${x},${y}`); objs.push({ t: "ropepost", x, y, name: "Velvet rope" }); } }
        for (let k = 0; k < n; k += 2) { const a = Math.min(n, k + 2); objs.push({ t: "ropeline", x: x1 + dx * k, y: y1 + dy * k, x2: x1 + dx * a, y2: y1 + dy * a, name: "Velvet rope" }); }
      };
      put("notice", 19, 4, "Task board");
      // SLOTS: the whole north-west floor. Three banks, two machines deep, plus the wall.
      for (const bx of [4, 9, 14]) for (let y = 5; y <= 9; y++) { put("slots", bx, y, "Slot machine", 1, { flip: true }); put("slots", bx + 1, y, "Slot machine"); }
      for (const y of [5, 7, 9]) put("slots", 1, y, "Slot machine", 1, { flip: true });
      for (const bx of [4, 9, 14]) for (const y of [5, 7, 9]) { seat(bx - 1, y); seat(bx + 2, y); }
      put("soda", 7, 4, "Soda machine"); put("snacks", 8, 4, "Snack machine");
      rope(6, 11, 8, 11); rope(12, 11, 14, 11); put("planter", 16, 11, "Planter", 2);
      // WHEELS and COIN FLIP share the south-west, with a rope between them
      put("wheel", 4, 18, "Wheel", 2, { art: "o_prizewheel" }); put("wheel", 8, 19, "Wheel", 2, { art: "o_prizewheel" }); put("prizewheel", 6, 21, "Daily Prize Wheel: one free spin a day", 2);
      put("fameboard", 24, 4, "Winners' Wall: today's biggest wins", 1, { art: "o_notice" });
      for (const [x, y] of [[13, 17], [16, 18], [13, 20]]) put("cointable", x, y, "Coin Flip table", 2);
      for (const [x, y] of [[13, 17], [16, 18], [13, 20]]) { seat(x, y + 1); seat(x + 1, y + 1); }
      rope(6, 15, 8, 15); rope(12, 15, 14, 15); put("planter", 16, 15, "Planter", 2);
      put("trashcan", 11, 17, "Bin"); put("plant", 11, 19, "Potted palm"); put("soda", 10, 21, "Soda machine"); put("snacks", 11, 21, "Snack machine");
      // the House Ruby, properly roped now
      // THE HOUSE RUBY, dead centre: the place you bring everything back to. Click it to cash in what you found and made
      // (the same as a Cashier's window); it becomes the ZCoin exchange too. Four posts, no rope: you walk right up to it.
      put("coinstatue", 21, 13, "The House Ruby: cash in here", 2);
      for (const [x, y] of [[20, 12], [23, 12], [20, 14], [23, 14]]) put("ropepost", x, y, "Velvet rope");
      objs.push({ t: "rug", img: "rug_casino", x: 20, y: 17, w: 4, h: 3, color: "#5a1a2a", name: "Rug" });
      put("howto", 24, 21, "How GAMBA works", 1, { art: "o_notice" });
      // THE CARD ROOM: Higher or Lower up front, blackjack and poker behind (those two open soon)
      put("hilo", 26, 6, "Higher or Lower", 2); put("hilo", 29, 7, "Higher or Lower", 2);
      put("blackjack", 27, 9, "Blackjack table (opening soon)", 2); put("blackjack", 30, 10, "Blackjack table (opening soon)", 2); put("pokertable", 25, 10, "Poker table (opening soon)", 3);
      for (const [x, y] of [[26, 6], [29, 7], [27, 9]]) { seat(x, y + 1); seat(x + 1, y + 1); }
      rope(28, 11, 30, 11); put("cooler", 31, 4, "Water cooler"); put("buffet", 29, 4, "Buffet", 2); put("plant", 32, 7, "Potted palm"); put("trashcan", 32, 9, "Bin");
      // THE BAR and its lounge, north-east
      put("bar", 34, 5, "Bar", 4); put("atm", 40, 4, "tickets machine (out of order, thankfully)"); put("jukebox", 33, 4, "Jukebox"); put("piano", 33, 8, "Grand piano", 2);
      for (const x of [34, 35, 36, 37]) seat(x, 6);
      for (const [x, y] of [[36, 8], [36, 10]]) put("cocktail", x, y, "Cocktail table");
      put("sofa", 33, 10, "Sofa", 2);
      // the smoking section: the far corner, four club chairs round two ashtrays, and a sign to say so
      put("smokesign", 38, 7, "Smoking section"); for (const [x, y] of [[39, 6], [41, 6], [39, 9], [41, 9]]) put("armchair", x, y, "Club chair", 1, { flip: x > 40 }); put("ashtray", 40, 6, "Ashtray"); put("ashtray", 40, 9, "Ashtray");
      rope(34, 11, 36, 11);
      // THE DICE PIT
      for (const [x, y] of [[26, 16], [29, 17], [26, 19]]) put("dicetable", x, y, "Dice table", 2);
      for (const [x, y] of [[26, 16], [29, 17], [26, 19]]) { seat(x, y + 1); seat(x + 1, y + 1); }
      rope(28, 15, 30, 15); put("planter", 25, 15, "Planter", 2); put("plant", 32, 18, "Potted palm"); put("soda", 31, 21, "Soda machine"); put("snacks", 32, 21, "Snack machine");
      // INSTANT WINS: the machines you just walk up to
      put("plinko", 34, 17, "Plinko", 2); put("plinko", 37, 17, "Plinko", 2); put("mines", 34, 20, "Mines", 2); put("mines", 37, 20, "Mines", 2); put("scratch", 40, 17, "Scratch-Off", 2); put("scratch", 40, 20, "Scratch-Off", 2);
      rope(34, 15, 36, 15); put("trashcan", 39, 15, "Bin");
      // along the south wall, and greenery in the corners
      for (const [x, y] of [[3, 4], [12, 4], [25, 4], [42, 4], [17, 21], [27, 21], [2, 21], [42, 21], [42, 18]]) put("plant", x, y, "Potted palm");
      put("planter", 25, 11, "Planter", 2); put("trashcan", 17, 4, "Bin");
      // the Cashier buys everything you bring back, at the price written over it outside: one window by each arch
      put("cashier", 2, 11, "Cashier", 2); put("cashier", 40, 11, "Cashier", 2);
      /* LIVED IN. Somebody works here and a lot of people lose here: a janitor's bucket and a wet-floor sign by a spilled
         drink in the east aisle, coats by both doors, a suitcase somebody walked in with and never picked up again, and
         on the carpet what people drop: chips, cards, losing slips, one shoe. Litter is `soft` (you walk over it) and
         `flat` (drawn on the floor, under everyone). */
      const litter = (t, x, y, name) => { if (g[y][x] === "i") objs.push({ t, x, y, name, soft: true, flat: true }); };
      put("mopbucket", 38, 12, "Mop bucket"); put("wetfloor", 36, 14, "Wet floor"); litter("l_spill", 37, 13, "Somebody's drink");
      put("coatrack", 24, 4, "Coat rack"); put("coatrack", 19, 21, "Coat rack"); put("suitcase", 3, 15, "A suitcase. It's been here a while.");
      for (const [x, y] of [[27, 18], [8, 10], [22, 16], [35, 19]]) litter("l_chips", x, y, "Dropped chips");
      for (const [x, y] of [[28, 8], [31, 6], [25, 7]]) litter("l_cards", x, y, "Dropped cards");
      for (const [x, y] of [[12, 13], [30, 18], [16, 20], [7, 12], [33, 13], [3, 8]]) litter("l_slips", x, y, "Losing slips");
      litter("l_spill", 35, 7, "Somebody's drink"); litter("l_shoe", 13, 14, "One shoe. Just the one.");
      for (const o of objs) if (REAL_TABLES[o.t]) o.name = `${REAL_TABLES[o.t].name}: ZCoins or tickets`;
      return { g, objs, blobs: [] };
    },
    // the regulars at the machines are simulated players: they walk up to a game, play a while, and move on
    mobs: [], bots: [{ name: "due4aWin", level: 14 }, { name: "SlotGoblin", level: 37 }, { name: "AllInAlan", level: 61 }],
    npcs: [{ name: "Dex the Dealer", art: "dex", x: 35, y: 4, still: true, reach: 2, hair: "#1a1a1a", shirt: "#9a2a2a", pants: "#1a1a1a", lines: ["Drinks and dinner are at the Prize Counter. They help out the arch, not in here.", "Broke? Out the arch. Hit something.", "A round for the room is 300 tickets. Be a hero."] },
      { name: "DookieBetts", art: "dookie", x: 28, y: 18, still: true, reach: 2, hair: "#1a1a1a", shirt: "#c8102e", pants: "#1a1a1a", lines: ["One more. Then one more after that.", "Scared money don't make money.", "You walking away? On THIS streak? Nah."] },
      // the regulars (2026-09-19): nobody here is a good influence
      { name: "Parlay Pete", art: "pete", x: 40, y: 8, hair: "#3a2a1a", shirt: "#6a6a72", pants: "#3a3a44", lines: ["Five-leg parlay. Can't lose.", "It lost."] },
      { name: "Nana Jackpot", art: "nana", x: 2, y: 8, still: true, hair: "#e8e8e8", shirt: "#e8a0b8", pants: "#8a6a8a", lines: ["Three sevens, dear. That's the dream.", "I've had this machine since Tuesday."] },
      { name: "Rent Money Randy", art: "randy", x: 18, y: 21, hair: "#5a4a3a", shirt: "#8a5a32", pants: "#8a5a32", lines: ["It's fine. Rent's not due till the first.", "Double or nothing fixes everything."] },
      { name: "Whale Wendell", art: "wendell", x: 28, y: 8, hair: "#1a1a1a", shirt: "#f4f4f4", pants: "#f4f4f4", lines: ["Twenty a bet. It's the principle.", "Tickets, ZCoins. I've got both. Mostly neither."] }]
  },
  // through the curtains at the back of the Casino: one big table everyone plays at once
  roulette: {
    /* v73 (the owner, 2026-09-19: "the regular roulette game is a bit glitchy. can we remove it from the roulette room for now
       and have the russian roullete be center stage with bino"). The wheel, Rouge and `realRound: "roul"` are OUT of the room,
       not deleted: the page's roulette window, the windows module's round watcher, the game server's roulette code and the
       site's hidden `roul` game are all still there. To bring it back: `realRound: "roul"`, the table at 20,11 (4x2), Rouge at
       22,10, and move this table and Bino back left (16,11 and 15,11). */
    name: "The Roulette Room", interior: true, floor: "casino", carpet: "t_roulette", room: [14, 8, 29, 17], exitTo: { scene: "casino", x: 21, y: 5 }, entry: { x: 21, y: 17 },
    wall: [{ t: "banner", x: 15 }, { t: "lamp", x: 17.5 }, { t: "lamp", x: 21.5 }, { t: "lamp", x: 25.5 }, { t: "banner", x: 28.5 }],
    build() {
      const g = room(14, 8, 29, 17, 21), objs = [];
      /* RUSSIAN ROULETTE (v59, the owner: "can we add that to the roulette room as well?"). It is eastcoin.vip's own PvP table,
         the SAME table: an EastScape player and someone on the website sit in one lobby. ZCoins only, 20 a seat, the winner
         takes every buy-in, the house takes nothing. The window (eastscape-casino.js russian()) talks to /api/casino/pvp/*
         itself and the site's code is untouched; the game server only walks you to the table. */
      objs.push({ t: "rrtable", art: "o_rrtable", x: 21, y: 11, w: 2, h: 2, name: "Russian Roulette: real ZCoins, winner takes all" }); block(g, 21, 11, 2, 2);
      /* v74: SIX SEATS round the table (RR_SEATS, in the site's seat order), a wall of fame, and Bino's bar cart. A seat is
         soft (you stand where you'd sit) and clicking one is clicking the table. */
      RR_SEATS.forEach(([x, y], i) => objs.push({ t: "rrseat", art: "o_stool", x, y, name: "A seat at the table", soft: true, seat: i }));
      objs.push({ t: "rrboard", art: "o_notice", x: 26, y: 8, name: "The table's wall of fame" }); g[8][26] = "#";
      objs.push({ t: "barcart", art: "o_barcart", x: 19, y: 11, name: "Bino's bar cart: a shot, 1 ticket" }); g[11][19] = "#";
      for (const [x, y] of [[15, 16], [27, 16]]) { objs.push({ t: "sofa", x, y, w: 2, h: 1, name: "Sofa" }); block(g, x, y, 2, 1); }
      for (const [x, y] of [[14, 9], [29, 9], [14, 13], [29, 13]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [
      /* the Russian Roulette dealer (the owner, 2026-09-19): stands behind that table, striped jersey, ponytail, whiskey in hand */
      { name: "Bino", art: "arbino", x: 20, y: 11,   /* (beside the table, as the owner placed him, so his name isn't drawn over it) */ still: true, reach: 3, hair: "#5a3a1e", shirt: "#e8601c", pants: "#1a1a1a", lines: ["Twenty a seat. Last one standing takes the pot.", "The whiskey's for me.", "Who Dey."] }]
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
  isle: { name: "Island", island: true, exitTo: { scene: "forum", x: 16, y: 21 }, entry: { x: 10, y: 10 }, build() { return isleBuild(1); }, mobs: [], npcs: [], bots: [] },
  isle2: { name: "Island", island: true, wikiHide: true, exitTo: { scene: "forum", x: 16, y: 21 }, entry: { x: 10, y: 10 }, build() { return isleBuild(2); }, mobs: [], npcs: [], bots: [] },
  isle3: { name: "Island", island: true, wikiHide: true, exits: { e: "shore" }, exitTo: { scene: "forum", x: 16, y: 21 }, entry: { x: 10, y: 10 }, build() { return isleBuild(3); }, mobs: [], npcs: [], bots: [] },
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
  highwayman: { name: "Highwayman", size: "m", lvl: 12, hp: 22, att: 10, def: 9, max: 3, speed: 2400, box: [7, 26], drops: [["tickets", [5, 20]], ["bones", 1], ["mask", 1, 0.15]] },
  gnasher: { name: "Bog Gnasher", size: "m", lvl: 18, hp: 30, att: 14, def: 12, max: 4, speed: 2600, aggro: 3, oy: 12, box: [10, 24], drops: [["bones", 1], ["tickets", [5, 25]], ["bogplate", 1, 0.03]] },
  taxwraith: { name: "Tax Wraith", size: "m", lvl: 28, hp: 42, att: 20, def: 18, max: 5, speed: 2400, aggro: 4, box: [9, 25], drops: [["tickets", [20, 80]], ["receipt", 1], ["wraithhood", 1, 0.03], ["menace", 1, 0.02], ["spiderboots", 1, 0.004]] },
  chandelier: { name: "Chandelier Spider", size: "l", lvl: 34, hp: 50, att: 24, def: 20, max: 6, speed: 2600, aggro: 4, oy: 12, box: [17, 41], drops: [["cobweb", 1], ["bones", 1], ["lantern", 1, 0.03], ["spiderboots", 1, 0.01]] },
  revenant: { name: "Sulking Revenant", size: "l", lvl: 45, hp: 80, att: 32, def: 28, max: 8, speed: 2800, aggro: 5, box: [9, 30], drops: [["bones", 2], ["tickets", [50, 150]], ["grudge", 1, 0.04], ["menace", 1, 0.03]] },
  // the Gloam
  moth: { name: "Lantern Moth", size: "s", lvl: 22, hp: 28, att: 16, def: 12, max: 4, speed: 2200, box: [4, 15], drops: [["tickets", [5, 20]], ["emerald_ore", 1, 0.3]] },
  ghoul: { name: "Sorry Ghoul", size: "m", lvl: 30, hp: 46, att: 22, def: 19, max: 5, speed: 2400, box: [7, 24], drops: [["bones", 1], ["tickets", [20, 60]], ["diamond_ore", 1, 0.2]] },
  understudy: { name: "The Understudy", size: "l", lvl: 38, hp: 62, att: 27, def: 23, max: 7, speed: 2600, box: [12, 43], drops: [["tickets", [40, 120]], ["diamond_ore", [1, 2], 0.25]] },
  // Cloudreach
  ram: { name: "Cumulus Ram", size: "m", lvl: 42, hp: 66, att: 29, def: 26, max: 7, speed: 2600, box: [14, 25], drops: [["bones", 1], ["tickets", [30, 90]], ["dragonstone_ore", 1, 0.15]] },
  angel: { name: "Angel of Minor Inconvenience", size: "m", lvl: 48, hp: 84, att: 34, def: 30, max: 8, speed: 2400, aggro: 4, box: [8, 25], drops: [["tickets", [60, 160]], ["dragonstone_ore", 1, 0.25]] },
  goose: { name: "Thunder Goose", size: "l", lvl: 55, hp: 110, att: 40, def: 36, max: 10, speed: 2800, box: [21, 35], drops: [["bones", 2], ["feather", [10, 30]], ["tickets", [100, 250]], ["onyx_ore", 1, 0.3]] },
  /* v68 (2026-09-19): THE BANDS' NEW RESIDENTS. Stats follow the old curve by level (hp about 1.6 x level before the
     halving below, att .73, def .63, max level/6); what a kill PAYS is measured, not guessed (BOUNTY, tools/eastscape-balance.mjs). */
  toadstool: { name: "Sulking Toadstool", size: "s", lvl: 10, hp: 18, att: 7, def: 6, max: 2, speed: 2600, box: [6, 15], drops: [] },
  boneidle: { name: "Bone Idle", size: "m", lvl: 16, hp: 27, att: 12, def: 10, max: 3, speed: 2600, box: [8, 30], drops: [] },
  twister: { name: "Paper Twister", size: "s", lvl: 20, hp: 30, att: 15, def: 12, max: 4, speed: 2200, box: [7, 16], drops: [] },
  counter: { name: "Card Counter", size: "m", lvl: 24, hp: 38, att: 18, def: 15, max: 4, speed: 2400, box: [8, 26], drops: [] },
  shark: { name: "Loan Shark", size: "m", lvl: 26, hp: 42, att: 19, def: 16, max: 5, speed: 2400, aggro: 3, box: [12, 28], drops: [] },
  stagehand: { name: "The Stagehand", size: "m", lvl: 32, hp: 50, att: 23, def: 20, max: 5, speed: 2400, box: [8, 28], drops: [] },
  usher: { name: "One-Eyed Usher", size: "m", lvl: 36, hp: 56, att: 26, def: 23, max: 6, speed: 2400, aggro: 4, box: [8, 26], drops: [] },
  brainstorm: { name: "Brainstorm", size: "s", lvl: 40, hp: 60, att: 29, def: 25, max: 7, speed: 2200, box: [7, 16], drops: [] },
  seagoat: { name: "Sea-Goat of the Upper Air", size: "l", lvl: 46, hp: 78, att: 33, def: 29, max: 8, speed: 2800, box: [20, 36], drops: [] },
  golem: { name: "Storm Golem", size: "l", lvl: 52, hp: 100, att: 38, def: 35, max: 9, speed: 3000, box: [20, 40], drops: [] },
  wolf: { name: "Thunderwolf", size: "m", lvl: 58, hp: 104, att: 43, def: 36, max: 10, speed: 2200, aggro: 4, box: [10, 28], drops: [] },
  drake: { name: "Hail Drake", size: "l", lvl: 62, hp: 124, att: 46, def: 40, max: 11, speed: 2800, aggro: 5, box: [22, 36], drops: [] },
  house: { name: "The House", size: "xl", lvl: 70, hp: 170, att: 52, def: 46, max: 13, speed: 3000, aggro: 5, box: [26, 56], drops: [] },
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
/* FASTER KILLS (2026-09-20, the owner: "an arcade style feedback loop"). Fighting is click-and-wait, and a 20-second wait is
   a long time to look at a cow. Every monster has HALF the hit points it was written with, so a kill at your own level is
   about 8-12 seconds and the tickets, the drop and the rare roll come round twice as often. What a kill PAYS was re-measured
   for the shorter fight (BOUNTY), so an hour's fighting is worth what it was. */
for (const m of Object.values(MOBS)) m.hp = Math.max(2, Math.round(m.hp / 2));

/* WHAT A MONSTER DROPS (2026-09-20, the owner: "1-3 items, with the third being a rare one"). The same three lines for
   every monster, so nobody needs the wiki to know what a kill is:
     1. CASH, always: the bounty (BOUNTY, further down, fills this in so an average kill is worth what it should be)
     2. ITS ONE THING, always: whatever crafting wants from it (or, for the late ones, a piece of their scene's ore)
     3. A RARE: one roll a kill, and at most one rare a kill. It's either one of the monster's own named pieces (`rare`
        here: [item, chance a kill]) or one of the casino FINDS every monster shares (chips, free play, boxes, dice, watches).
   Gone with this: bones, pits, feathers and tusks (nothing used the first two; the recipes that used the others changed),
   and the thirty-row tables that gave every piece of emerald and diamond gear a fraction of a percent each. Tier gear is
   smithed; what DROPS is the named stuff you can't make. (Until then a Tax Wraith had 31 rows.) */
export const LOOT = {
  chicken:    { item: ["chicken", 1] },
  cow:        { item: ["beef", 1] },
  rotten:     { item: ["tomatoe", [1, 3]] },
  hornworm:   { item: ["husk", 1], rare: [["gamblers_ring", 0.006]] },
  boar:       { item: ["pork", 1], rare: [["gamblers_ring", 0.01]] },
  highwayman: { item: ["hide", 1], rare: [["mask", 0.1], ["bookies_amulet", 0.008], ["sharps_gloves", 0.006]] },
  gnasher:    { item: ["emerald_ore", 1], rare: [["bogplate", 0.03], ["bookies_amulet", 0.01]] },
  moth:       { item: ["emerald_ore", 1], rare: [["adjusters_visor", 0.01], ["angels_ring", 0.006]] },
  taxwraith:  { item: ["receipt", 1], rare: [["wraithhood", 0.03], ["menace", 0.02], ["adjusters_visor", 0.01], ["angels_ring", 0.01], ["spiderboots", 0.004]] },
  ghoul:      { item: ["diamond_ore", 1], rare: [["sharps_gloves", 0.012], ["stake_loafers", 0.008]] },
  understudy: { item: ["diamond_ore", [1, 2]], rare: [["sharps_gloves", 0.025]] },
  chandelier: { item: ["cobweb", 1], rare: [["lantern", 0.03], ["angels_ring", 0.02], ["spiderboots", 0.01]] },
  ram:        { item: ["dragonstone_ore", 1], rare: [["grudge", 0.02], ["stake_loafers", 0.015]] },
  // v68: the bands' new residents. One thing each; the buff gear is spread so every band past the Yard can drop some
  toadstool:  { item: ["sporecap", 1], rare: [["bookies_amulet", 0.006]] },
  boneidle:   { item: ["bones", [2, 4]], rare: [["mask", 0.05], ["sharps_gloves", 0.008]] },
  twister:    { item: ["receipt", 1], rare: [["adjusters_visor", 0.008]] },
  counter:    { item: ["markedcard", 1], rare: [["sharps_gloves", 0.015], ["monocle", 0.03]] },
  shark:      { item: ["sharktooth", 1], rare: [["bookies_amulet", 0.015], ["menace", 0.01]] },
  stagehand:  { item: ["cobweb", 1], rare: [["stake_loafers", 0.01]] },
  usher:      { item: ["flashlight", 1], rare: [["lantern", 0.03], ["adjusters_visor", 0.015]] },
  brainstorm: { item: ["stormjelly", 1], rare: [["angels_ring", 0.012]] },
  seagoat:    { item: ["dragonstone_ore", [1, 2]], rare: [["stake_loafers", 0.02], ["grudge", 0.02]] },
  golem:      { item: ["onyx_ore", 1], rare: [["bogplate", 0.03], ["gamblers_ring", 0.02]] },
  wolf:       { item: ["staticfur", 1], rare: [["sharps_gloves", 0.03], ["angels_ring", 0.015]] },
  drake:      { item: ["hailshard", 1], rare: [["stake_loafers", 0.03], ["spiderboots", 0.015]] },
  house:      { item: ["onyx_ore", [1, 3]], rare: [["angels_ring", 0.04], ["bookies_amulet", 0.04], ["spiderboots", 0.02]] },
  // once the closed roads' residents: placed again in v68 (olive in the Yard, goat in the Gloam, revenant and angel in Cloudreach)
  olive:      { item: ["olives", [2, 5]], rare: [["monocle", 0.1]] },
  goat:       { item: ["manifesto", 1], rare: [["toga", 0.25]] },
  revenant:   { item: ["dragonstone_ore", 1], rare: [["grudge", 0.04], ["menace", 0.03]] },
  angel:      { item: ["dragonstone_ore", 1] },
  goose:      { item: ["onyx_ore", 1], rare: [["stake_loafers", 0.02], ["spiderboots", 0.01]] }
};
/* NOTHING ATTACKS ON SIGHT, FOR NOW (the owner, 2026-09-19: "i dont want any monster to attack on site for now, its just too
   aggressive for a relaxed chill game like this"). Every monster only fights back. Each one's old reach is kept as
   `aggroWas`, so switching it back is this one flag; the scenes still keep those monsters in corners their old reach
   can't leave (tools/eastscape-aggro-check.mjs reads aggroWas), so turning it on again needs no map work. */
export const AGGRO_ON = false;
for (const m of Object.values(MOBS)) if (m.aggro) { m.aggroWas = m.aggro; if (!AGGRO_ON) delete m.aggro; }
for (const [t, L] of Object.entries(LOOT)) if (MOBS[t]) { MOBS[t].drops = [L.item]; MOBS[t].rare = L.rare || []; }

/* ------------------------------------------------------------ words */
// what it takes to climb down into the Wilderness (PvP). Change it here.
export const WILD_REQ = { skill: "melee", lvl: 10 };   // the Wilderness asks you to be able to take a hit

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

   Games of chance for tickets, never ZCoins. The server rolls every result; the page only shows it. Each game keeps a
   small edge (a tickets sink, which the economy wants), bets are capped, and big wins are announced so the room feels
   alive. Placeholders to iterate on: the numbers all live here. */
export const CASINO = { minBet: 1, maxBet: 500, betMs: 900, roomWin: 5, worldWin: 25 };
export const GAMES = {
  slots: { name: "Slots", icon: "🎰", ex: "Three of a kind pays; two cherries pay 1.4×. Three sevens also wins the jackpot." },
  cointable: { name: "Coin Flip", icon: "🪙", ex: "Heads or tails. Pays 1.95×." },
  dicetable: { name: "Dice", icon: "🎲", ex: "Roll 1–100 under your number. The lower you go, the more it pays." },
  // the games people know from the site's casino, for tickets (2026-09-19). They stand round the rug you arrive on.
  wheel: { name: "Wheel", icon: "🎡", ex: "Red or black pays 1.97×. The thin gold sliver pays 58×." },
  hilo: { name: "Higher or Lower", icon: "🃏", run: true, ex: "Is the next card higher or lower? Every right call multiplies your stake; cash out whenever you like. A tie is a push." },
  mines: { name: "Mines", icon: "💣", run: true, ex: "25 tiles, some are bombs. Every gem multiplies your stake; cash out before you find a bomb." },
  plinko: { name: "Plinko", icon: "🟠", ex: "Drop the ball through twelve rows of pegs. The edges pay 25×." },
  scratch: { name: "Scratch-Off", icon: "🎟️", ex: "Nine boxes. Three of a kind wins that symbol's prize." }
};
/* Every number for the new tables lives here; the server plays them and the page draws them from the same figures.
   Each returns about 97% before luck, the same as the coin and the dice, so no table is the smart one to farm. */
export const WHEEL = { gold: 6, slices: 24, pays: { red: 1.97, black: 1.97, gold: 58 } };   // degrees of gold; the rest is 24 equal slices
export function wheelColor(angle) { const a = ((angle % 360) + 360) % 360; if (a < WHEEL.gold) return "gold"; return Math.floor((a - WHEEL.gold) / ((360 - WHEEL.gold) / WHEEL.slices)) % 2 ? "black" : "red"; }
// Higher or Lower: ranks 1 (ace, low) to 13 (king). A call is priced fairly on the twelve cards that can settle it
// (a tie is a push), and the house's cut comes off once, at cash-out, so a long run isn't shaved on every card.
export const HILO = { edge: 0.97, maxMult: 50, maxCards: 12, names: ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] };
export const hiloWays = (rank, call) => (call === "higher" ? 13 - rank : rank - 1);           // how many of the 12 other ranks win
export const hiloFactor = (rank, call) => { const w = hiloWays(rank, call); return w > 0 ? 12 / w : 0; };
export const hiloPays = (stake, mult) => Math.floor(stake * Math.min(HILO.maxMult, mult) * HILO.edge);
// Mines: the fair price of k safe picks with m bombs is C(25,k)/C(25-m,k); the run cashes itself at the last rung under the cap
export const MINES = { tiles: 25, min: 1, max: 10, edge: 0.97, maxMult: 50 };
export function minesMult(m, k) { let x = 1; for (let i = 0; i < k; i++) x *= (MINES.tiles - i) / (MINES.tiles - m - i); return Math.floor(x * MINES.edge * 100) / 100; }
export function minesTop(m) { let k = 1; while (k < MINES.tiles - m && minesMult(m, k + 1) <= MINES.maxMult) k++; return k; }
// Plinko: 12 rows, 13 buckets. Returns 97.1%; every bucket but the middle pays the stake back or better.
export const PLINKO = { rows: 12, pays: [25, 4, 2, 1.4, 1.1, 1, 0.3, 1, 1.1, 1.4, 2, 4, 25] };
// Scratch-Off: chances in 1000, rarest first. 97.5% back; about three cards in eight win something.
export const SCRATCH = [
  { k: "seven", x: 100, w: 1 }, { k: "diamond", x: 25, w: 3 }, { k: "star", x: 10, w: 10 }, { k: "bell", x: 5, w: 30 },
  { k: "lemon", x: 3, w: 50 }, { k: "cherry", x: 2, w: 120 }, { k: "gem", x: 1, w: 160 }
];
export const FLIP_PAYS = 1.95;                                          // 97.5% back
export const DICE = { min: 5, max: 95, rtp: 0.97 };                     // win if the roll (1-100) is under your number
export const diceMult = (target) => Math.floor((DICE.rtp * 100 / (target - 1)) * 100) / 100;
// reel weights (of 80) and what three of each pay; about 96.9% back, a win about one spin in three, top prize 1 in 64,000
export const REELS = [
  { k: "cherry", icon: "🍒", w: 30, pay: 5 }, { k: "lemon", icon: "🍋", w: 22, pay: 8 }, { k: "bell", icon: "🔔", w: 14, pay: 15 },
  { k: "star", icon: "⭐", w: 8, pay: 40 }, { k: "diamond", icon: "💎", w: 4, pay: 120 }, { k: "seven", icon: "7️⃣", w: 2, pay: 500 }
];
export const SLOT_TWO_CHERRIES = 1.4;
/* the slots jackpot: 2% of every spin goes into one pot everybody shares; three sevens wins it (a 500 tickets spin
   wins all of it, smaller spins a share in proportion, the rest stays in the pot). The regular pays above were
   trimmed to make room, so slots still return about 96.5% overall. The house seeds it again after a win. */
export const JACKPOT = { slice: 0.02, seed: 1000, cap: 50000 };
export const jackpotShare = (bet) => Math.min(1, bet / CASINO.maxBet);
export function slotsPay(reels) {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return REELS.find((x) => x.k === reels[0]).pay;
  return reels.filter((r) => r === "cherry").length === 2 ? SLOT_TWO_CHERRIES : 0;
}

/* ------------------------------------------------------------ luck: the one buff (2026-09-19 reset)

   The whole game in a line: gamble in the casino; when you want better odds, go and skill or fight. Working in the
   world turns up lucky charms; using one makes your next N bets "lucky", and a lucky win pays `bonus` more. Even
   lucky, every game stays just under 100% back, so the casino can't be turned into a tickets printer. */
export const LUCK = { bonus: 0, zdrop: 0.25, gather: 1 / 12, shoe: 1 / 150, max: 300 };   // luck is SKILLING's reward alone (2026-09-20): clovers, and rarely a horseshoe
/* THE FIGHT PIT'S NUMBERS. Two monsters are drawn from `pool`; the chance each wins comes from their levels (square
   roots, so a chicken against a revenant is a long shot, not a no-hoper) and is clamped to 25-75%; each side pays
   `edge` / its chance, so whichever you back the house keeps 5%. WHO WINS IS ONE RANDOM NUMBER against that chance and
   nothing else: no stats, no gear, no streaks. The blows you watch are written afterwards to fit the result. */
export const FIGHTS = { betMs: 30000, fightMs: 40000, showMs: 10000,   // 30s to bet, a 40s fight, 10s to gloat: 40s between one fight ending and the next starting
  maxStake: 500, edge: 0.95, minP: 0.25, maxP: 0.75, bigWin: 2.5,
  pool: ["chicken", "cow", "rotten", "olive", "hornworm", "boar", "goat", "highwayman", "gnasher", "moth", "taxwraith", "ghoul", "chandelier", "understudy", "ram", "revenant", "angel", "goose"],
  titles: ["the Unpaid", "Two-Time Runner-Up", "of No Fixed Address", "the People's Champ", "on a Six-Fight Skid", "Who Owes Dex Money", "the Undercard", "from Accounts", "the Pride of the Paddock", "Fresh off a Bye", "the Contractually Obligated", "Last Seen Fleeing"] };
export function fightOdds(a, b) {
  const sa = Math.sqrt(MOBS[a].lvl), sb = Math.sqrt(MOBS[b].lvl), p = Math.max(FIGHTS.minP, Math.min(FIGHTS.maxP, sa / (sa + sb)));
  return { p: [p, 1 - p], pays: [Math.floor(FIGHTS.edge / p * 100) / 100, Math.floor(FIGHTS.edge / (1 - p) * 100) / 100] };
}

/* HUNGER AND THIRST (2026-09-20, the owner: "so that users don't spam gambling"). Two meters, 0 to 100. Every bet
   takes a little off both; under `floor` the tables turn you away until you've had something. The water cooler and
   the buffet beside it (the card room's back wall) give `sip` a click, free, as many clicks as it takes. Cooked food
   from your bag feeds you too (`food` per item), which is one more reason to go and catch a fish. Primitive on
   purpose: nothing drains while you work, fight or stand about, only when you bet. About forty bets to a drink. */
export const NEEDS = { floor: 20, sip: 20, food: 25, perBet: { thirst: 2, hunger: 1.25 } };
export const needOf = (c, k) => Math.max(0, Math.min(100, c?.[k] ?? 100));
/** Why the tables won't take this player's bet, or null if they will. */
export const tooEmpty = () => null;   /* HUNGER AND THIRST are switched off (the owner, 2026-09-19; on the backlog as a possible future feature): nothing drains them and no table looks */
export const NEED_TEXT = { thirst: "You're too thirsty to gamble. There's a water cooler on the card room's back wall, next to the bar, and two in the Fight Pit.", hunger: "You're too hungry to gamble. There's a buffet on the card room's back wall, next to the water cooler, and two in the Fight Pit." };

/* ------------------------------------------------------------ FX: gear, meals, drinks and finds (2026-09-20)

   The owner's brief: three jobs that each pay DIFFERENTLY, and the item effects of "Gamble With Your Friends" on gear,
   cooked meals and alcohol.
     SKILLING is the only way to get LUCKY (clovers while you gather).
     FIGHTING pays in windfalls: a tickets bounty on every monster (BOUNTY), house chips, free-play chips, mystery boxes,
       Devil's dice, rewind watches, the two rare-drop pieces of gambling gear, and HIGH ROLLER (double limits).
     CRAFTING makes what you keep: four smithed pieces of gambling gear and four cooked dinners, every one of which
       needs something dug up AND something killed. Dex's bar sells the drinks.
   An item carries `fx`: win (+share of PROFIT on a win), back (share of a lost stake returned), angel (chance a lost
   stake comes back whole), limit (+$ on every table's limit), thrift (hunger and thirst cost this much of normal),
   power (worn gear's other effects are this much stronger). A meal is `meal: {bets, fx}`, a drink `drink: {bets, fx}`;
   one of each at a time, a new one replaces the old.

   THE CEILING. Every game returns about 97% and luck adds ~2.4%. GEAR ALONE can add at most 1.5% of profit and 1.5% of
   losses (FX_CAP.gear), so gear never takes a game over 100% by itself. Everything stacked (gear + meal + drink) stops
   at FX_CAP.all, which with luck is about 104% back: the top of the band eastcoin.vip's own casino is drawn in, and
   only for as long as the dinner and the drink last, both of which cost work or tickets. edgeOf() is the ONE place this
   is added up and the server is the only thing that calls it for money.
   *** CASH ONLY. If a GAMBA table ever takes real ZCoins, none of this may touch it (see BACKLOG: "Never"). *** */
/* THE HOUSE RUBY's exchange (2026-09-20): tickets into real ZCoins, $100 each, or a $500 Ruby ticket (a scratch reveal with a
   face of 5 ZCoins that pays 25, 10, 5, 2 or nothing). ONE allowance of 25 an hour covers both. The SITE is the authority
   (functions/api/eastscape/exchange.js): these are its numbers, mirrored for the page and the game server, and
   tools/dex-test.mjs fails if they drift. */
/* v57 (2026-09-19, the owner): TICKETS ARE THE ONLY CURRENCY, and the real tables take ZCoins OR tickets. DEX.rate tickets
   stand in for 1 ZCoin; a ticket bet is an ordinary eastcoin.vip bet staked by the house (functions/api/eastscape/_stake.js)
   and it pays REAL ZCoins. capHour is the backstop: the most ZCoins' worth of tickets one player may stake in an hour
   (banking dropped ZCoins counts against it too). maxStake is the casino's own 20 a bet. The Ruby's scratch tickets and
   its tickets exchange are gone: betting tickets is the conversion. */
export const DEX = { rate: 1000, capHour: 50, maxStake: 20 };
export const FX_CAP = { gear: { win: 0.015, back: 0.015, angel: 0.0075 }, all: { win: 0.05, back: 0.03, angel: 0.01 } };
export const ROLLER = { kill: 0, bets: 10, max: 100, mult: 1 };   /* HIGH ROLLER is retired (the owner, 2026-09-19): nothing grants it and it doubles nothing */
export const FREEPLAY = 100, DEVIL = { ms: 120000, odds: 1 / 3, pays: 3, max: 1000 }, REWIND = { ms: 60000, max: 500 };
/* BUFFS WORK OUT THE ARCH, AND NOWHERE ELSE (v65, 2026-09-19). Every casino game is eastcoin.vip's now and nothing in
   EastScape may touch a bet, so the old gambling effects had no table left to act on. The owner approved their
   conversion, item by item, into five things that matter to fighting and fishing:
     tix    more tickets from a kill; on a catch, that chance of landing a second fish
     speed  swing faster, and the line bites sooner
     tough  take less damage (a negative one takes more: whiskey)
     rare   the monster's rare drops and the casino finds come up more often
     zdrop  a REAL ZCoin is more likely to drop. The only effect here that makes ZCoins, so it is small, it is mostly
            temporary (Champagne, luck), and banking what drops still comes out of the 50-an-hour allowance.
   plus `heal` (fish heal more, worn only), `bite` (fishing's own chance) and `power` (the loafers: other worn buff gear
   is stronger). Dinners last `mins` minutes and drinks `mins` minutes, and the clock only runs while you are OUTSIDE
   (the game server counts it down in scenes that have monsters). OUT_CAP is the ceiling from everything put together.
   fxOf() is the ONE place this is added up. edgeOf() is kept, inert, for the old ticket-table code that still calls it. */
export const OUT_CAP = { tix: 0.25, speed: 0.2, tough: 0.3, rare: 0.4, zdrop: 0.75, bite: 0.1, heal: 0.5 };
const OUT_KEYS = ["tix", "speed", "tough", "rare", "zdrop", "bite", "heal"];
export function fxOf(c) {
  const worn = SLOTS.map((k) => ITEMS[c?.eq?.[k]]?.fx).filter(Boolean), power = 1 + worn.reduce((a, f) => a + (f.power || 0), 0), out = Object.fromEntries(OUT_KEYS.map((k) => [k, 0]));
  for (const f of worn) for (const k of OUT_KEYS) out[k] += (f[k] || 0) * power;
  for (const st of [c?.meal, c?.drink]) { const it = st && (st.left | 0) > 0 && ITEMS[st.k], f = it && (it.meal || it.drink)?.fx; if (f) for (const k of OUT_KEYS) out[k] += f[k] || 0; }
  if ((c?.luck | 0) > 0) out.zdrop += LUCK.zdrop;
  for (const k of OUT_KEYS) out[k] = Math.max(k === "tough" ? -0.5 : 0, Math.min(OUT_CAP[k], out[k]));
  return out;
}
export function edgeOf() { return { win: 0, back: 0, angel: 0, limit: 0, thrift: 1, power: 1, fed: true }; }
/** The most this player may put on one bet right now: the table's limit, plus gear/meal/drink, doubled while a High Roller. */
/* THE DAILY PRIZE WHEEL (2026-09-20): one free spin a Chicago day at the wheel by the casino's front door. A reason to
   show up, and a first stake for anyone who arrives broke. Twelve slices, weighted; ticket slices grow 10% for every
   day in a row you've spun (up to +70%), so a streak is worth keeping and missing a day costs something. About $100 of tickets a
   spin on average plus the odd item, more with a streak: a minute of mining, so it's a gift and not a job. */
export const PRIZE = { streakStep: 0.1, streakMax: 7, slices: [
  { cash: 50, w: 18 }, { k: "clover", n: 1, w: 12 }, { cash: 100, w: 16 }, { k: "beer", n: 1, w: 10 }, { cash: 150, w: 12 }, { k: "chip_free", n: 1, w: 9 },
  { cash: 250, w: 8 }, { k: "tp_scroll", n: 2, w: 6 }, { cash: 500, w: 4 }, { k: "mysterybox", n: 1, w: 3 }, { cash: 1000, w: 1.5 }, { k: "chip_black", n: 1, w: 0.5 }] };
export const prizeText = (p, streak = 1) => (p.cash ? fmtCash(Math.round(p.cash * (1 + PRIZE.streakStep * Math.min(PRIZE.streakMax, Math.max(0, streak - 1))))) : `${p.n > 1 ? `${p.n} × ` : ""}${ITEMS[p.k].name}`);
export const dayBefore = (day) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/* VIP (2026-09-20): every dollar you've ever put on a table counts, win or lose, and the tier shows by your name for
   everyone to see. The long game for a grinder, and bragging rights for everybody else. Each tier raises every
   table's limit a little; nothing here touches what a bet is worth. */
export const VIP = [{ name: "Guest", at: 0, limit: 0, off: 0, col: "#aca298" }, { name: "Bronze", at: 25000, limit: 0, off: 0.02, col: "#c8864a" }, { name: "Silver", at: 100000, limit: 0, off: 0.04, col: "#d8d8e4" },
  { name: "Gold", at: 400000, limit: 0, off: 0.06, col: "#ffd84a" }, { name: "Platinum", at: 1500000, limit: 0, off: 0.08, col: "#9ae8e0" }, { name: "Diamond", at: 5000000, limit: 0, off: 0.1, col: "#b8a0ff" }];
/* (v65) The tiers are earned by LIFETIME TICKETS EARNED (c.earned: kills, trade-ins, daily jobs), not by what you bet:
   the betting is the site's now and the game cannot count it honestly. Each tier takes `off` off every Prize Counter price. */
export const vipOf = (c) => { const w = Math.max(0, Number(c?.earned) || 0); let i = 0; while (VIP[i + 1] && w >= VIP[i + 1].at) i++; return { i, ...VIP[i], wagered: w, earned: w, next: VIP[i + 1] || null }; };
export const counterPrice = (c, price) => Math.max(1, Math.ceil(price * (1 - vipOf(c).off)));

/* `def` is the room you're standing in: the High Roller Room (def.limits) multiplies every table's limit and has a floor. */
export const minBetOf = (def) => def?.limits?.min || CASINO.minBet;
export const baseBetOf = (c, def) => (CASINO.maxBet + Math.round(edgeOf(c).limit) + vipOf(c).limit) * (def?.limits?.mult || 1);
export const maxBetOf = (c, def) => baseBetOf(c, def);
/* Luck and every effect cover the first FX_COVER of a stake and no more: a $5,000 bet in the High Roller Room gets the
   bonus a $1,500 one would. Without this the ceiling above is a percentage of ANY stake, and the biggest room in the
   building would be the best job in the game for anyone holding a dinner. */
export const FX_COVER = 1500;
const cover = (stake) => (stake > FX_COVER ? FX_COVER / stake : 1);
/** What a winning bet pays with this player's effects (e from edgeOf, fixed when the stake went down). `plain` is the game's own payout. */
export const payWith = (plain, stake, e, lucky) => (plain > 0 ? Math.round(plain + (plain * (lucky ? LUCK.bonus : 0) + Math.max(0, plain - stake) * (e?.win || 0)) * cover(stake)) : 0);
/** What comes back from a LOST stake: all of it if the angel roll (0..1) lands, else the insured share. */
export const backWith = (lost, e, roll) => (lost > 0 && e ? Math.round((roll < (e.angel || 0) ? lost : lost * (e.back || 0)) * cover(lost)) : 0);
const pct = (n) => `${Math.round(n * 1000) / 10}%`;
export const fxText = (f) => [f.tix && `${pct(f.tix)} more tickets from kills, and that chance of a second fish on a catch`, f.speed && `you swing and fish ${pct(f.speed)} faster`,
  f.tough > 0 && `you take ${pct(f.tough)} less damage`, f.tough < 0 && `you take ${pct(-f.tough)} MORE damage`, f.rare && `rare drops come up ${pct(f.rare)} more often`, f.zdrop && `a real ZCoin is ${pct(f.zdrop)} more likely to drop`,
  f.bite && `fish bite ${pct(f.bite)} more often`, f.heal && `fish heal ${pct(f.heal)} more`, f.power && `your other worn buff gear is ${pct(f.power)} stronger`].filter(Boolean).join("; ");
for (const it of Object.values(ITEMS)) {   // say what it does, once, from the numbers
  if (it.fx) it.ex = `Worn: ${fxText(it.fx)}. ${it.ex || ""}`.trim();
  if (it.meal) it.ex = `${it.ex || ""} Eat it: for ${it.meal.mins} minutes out the arch, ${fxText(it.meal.fx)}.`.trim();
  if (it.drink) it.ex = `${it.ex || ""} For ${it.drink.mins} minutes out the arch: ${fxText(it.drink.fx)}.`.trim();
}

/* BUFFS: whatever is changing how the casino treats you right now, shown top-right of the game. buffsOf returns them
   ready to draw: { id, name, icon (an item icon), ex, left (null for something worn), unit }. */
export const buffsOf = (c) => {
  const out = [], one = (id, name, icon, ex, left = null, unit = "kill or catch") => out.push({ id, name, icon, ex, left, unit });
  if ((c?.luck | 0) > 0) one("luck", "Lucky", "clover", `A real ZCoin is ${LUCK.zdrop * 100}% more likely to drop. One is used up per kill or catch. Only fishing finds clovers.`, c.luck | 0);
  for (const st of [c?.meal, c?.drink]) { const it = st && (st.left | 0) > 0 && ITEMS[st.k]; if (it) one(it.meal ? "meal" : "drink", it.short || it.name, st.k, `${it.name}: ${fxText((it.meal || it.drink).fx)}. The clock only runs while you're out the arch.`, Math.max(1, Math.ceil((st.left | 0) / 60000)), "minute"); }
  for (const k0 of SLOTS) { const k = c?.eq?.[k0], it = k && ITEMS[k]; if (it?.fx) one(`worn:${k}`, it.short || it.name, k, `${it.name} (worn): ${fxText(it.fx)}.`); }
  return out;
};

/* ------------------------------------------------------------ what's open (2026-09-19 reset)
   One casino (with its Roulette Room), one town, one skilling area, one combat area. Everything else still exists in
   the code but can't be reached yet; a saved character standing somewhere closed wakes up in the casino. */
/* LEVEL BANDS (the owner, 2026-09-19): the world outside runs in ten-level bands, one a scene: the Yard is 1-9, the Gloam
   10-19, then 20-29, 30-39 and on. A SOFT gate: anyone may walk anywhere, but you can't START a fight in a scene until
   your COMBAT level reaches its band, and you can't fish its water until your FISHING level does (the two are separate,
   so a fisher reaches deep water without ever swinging a sword). A monster that is already attacking you can always be
   fought back. Ore and trees will take the same gate when they return; oceans and lakes are just more water in a band.
   v68: all six are built. West from the casino: the Yard, the Gloam, the Lantern Mire, the Boneyard, Cloudreach, the Thunderhead. */
export const BANDS = { workyard: [1, 9], gloam: [10, 19], mire: [20, 29], boneyard: [30, 39], cloud: [40, 49], thunderhead: [50, 99] };
/* THE HOSPITAL BILL (the owner, 2026-09-19: "lets do #1"): dying out the arch costs a share of the tickets you are CARRYING, capped by
   where you died, so the Yard stays forgiving. Nothing else is ever touched: gear, the bag, ZCoins, experience, the bank. The tickets go
   nowhere: a sink. (Tickets can't be banked, so there is always something for the bill to take from.) */
export const DEATH = { workyard: { share: 0.05, cap: 250 }, gloam: { share: 0.1, cap: 1000 }, mire: { share: 0.1, cap: 2000 }, boneyard: { share: 0.1, cap: 3500 }, cloud: { share: 0.1, cap: 5000 }, thunderhead: { share: 0.1, cap: 6000 } };
export const deathBill = (c, scene) => { const d = DEATH[String(scene || "").split(":")[0]]; return d ? Math.min(d.cap, Math.floor(tixIn(c) * d.share)) : 0; };
export const bandOf = (scene) => BANDS[String(scene || "").split(":")[0]] || null;
/** Why this character can't fight / fish in this scene yet, or null if they can. kind: "fight" | "fish". */
export const bandBlock = (c, scene, kind) => { const b = bandOf(scene); if (!b) return null; const skill = kind === "fish" ? "fishing" : "melee", need = b[0], have = lvlOf(c, skill);
  return have >= need ? null : { need, have, skill, text: `needs ${kind === "fish" ? "Fishing" : "Combat"} ${need}` }; };
export const OPEN = new Set(["casino", "roulette", "fightpit", /* "highroller": closed for now (the owner, 2026-09-19) */ "forum", "bathhouse", "workyard", "gloam", "mire", "boneyard", "cloud", "thunderhead"]);   // (paddock, rough, boneyard closed 2026-09-20: their monsters live in the three scenes of the one line out)
export const OPEN_DAILY = new Set(["sardine", "lantern", "trout", "cows", "chickens", "rotten", "boar", "highwayman", "moths", "ghouls", "rams",
  "olive", "hornworms", "perch", "toadstools", "goats", "boneidle", "gnashers", "catfish", "twisters", "counters", "sharks", "wraiths", "mudskipper", "stagehands", "spiders", "ushers", "understudies", "bonefish", "ghostcarp",
  "brainstorms", "revenants", "seagoats", "angels", "skyeel", "cloudray", "golems", "geese", "wolves", "drakes", "thehouse", "marlin", "squid"]);   // kills and fish: that's the world now
for (const k of Object.keys(SCENES)) if (!OPEN.has(k)) SCENES[k].wikiHide = true;   // closed areas stay out of the wiki

/* ------------------------------------------------------------ the House Tour: how a new player learns the loop

   Gamble first, run dry, do a job, get paid, come back. Dex walks you through it once, inside the casino. `step` is
   an index into TOUR; TOUR.length means finished. (Paid in tickets for now; the DEX exchange slots into the last step.) */
export const TOUR = [
  { id: "meet",  text: "Say hello to Dex, behind the bar" },
  { id: "play",  text: "Play any game on the floor with your free chip" },
  { id: "board", text: "Read the task board, left of the bar" },
  { id: "job",   text: "Do a job: out the arch to the Yard, and beat 3 chickens or catch 5 fish" },
  { id: "paid",  text: "Go back to Dex and get paid" }
];
export const TOUR_CHIP = 10, TOUR_PAY = 60, TOUR_GIFT = "clover", TOUR_JOB = { fish: 5, chickens: 3 };
export const tourOf = (c) => (c?.tour && c.tour.step < TOUR.length ? TOUR[c.tour.step] : null);
export const HOWTO = `PLAY. Click a table. Every game takes ZCoins or tickets. Wins pay real ZCoins. Press G for the list.

OUT OF TICKETS? Out the arch. Hit something, or fish. Nothing out there attacks first.

THE BIG RUBY is the Prize Counter: trade in your drops, buy gear, food and drinks.

SIX SCENES, WEST: the Yard 1-9, the Gloam 10-19, the Lantern Mire 20-29, the Boneyard 30-39, Cloudreach 40-49, the Thunderhead 50+.

DIE and you pay a small hospital bill in tickets. Nothing else.

FREE EVERY DAY: a spin on the Prize Wheel by the door, and three jobs on this board's neighbour.`;

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
   each Chicago morning. They count what you gather and kill after the day starts; claim the tickets at the board. */
// (`cash` is what the job pays, in TICKETS since 2026-09-20)
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
  { id: "trout", what: "gather", k: "trout", n: 20, cash: 160, req: { skill: "fishing", lvl: 10 } },
  { id: "boar", what: "kill", k: "boar", n: 6, cash: 200, req: { skill: "melee", lvl: 8 } },
  { id: "highwayman", what: "kill", k: "highwayman", n: 5, cash: 260, req: { skill: "melee", lvl: 12 } },
  { id: "ashlogs", what: "gather", k: "ashlogs", n: 20, cash: 350, req: { skill: "woodcutting", lvl: 20 } },
  { id: "emerald", what: "gather", k: "emerald_ore", n: 15, cash: 400, req: { skill: "mining", lvl: 15 } },
  { id: "moths", what: "kill", k: "moth", n: 8, cash: 380, req: { skill: "melee", lvl: 20 } },
  { id: "lantern", what: "gather", k: "lanternfish", n: 12, cash: 200, req: { skill: "fishing", lvl: 20 } },
  { id: "diamond", what: "gather", k: "diamond_ore", n: 12, cash: 520, req: { skill: "mining", lvl: 25 } },
  { id: "ghouls", what: "kill", k: "ghoul", n: 6, cash: 520, req: { skill: "melee", lvl: 30 } },
  { id: "willow", what: "gather", k: "willowlogs", n: 20, cash: 560, req: { skill: "woodcutting", lvl: 15 } },
  { id: "rams", what: "kill", k: "ram", n: 6, cash: 700, req: { skill: "melee", lvl: 40 } },
  { id: "dragonstone", what: "gather", k: "dragonstone_ore", n: 10, cash: 800, req: { skill: "mining", lvl: 30 } },
  /* v70: THE SIX BANDS' JOBS. One for every monster and every fish out the arch, each asking for the level its scene does (a kill
     job's `req` is Combat, a fish job's is Fishing), so the board only ever hands you work you can walk to and start. A job
     pays a bonus of about 45% of what those kills or catches are worth anyway. */
  { id: "olive", what: "kill", k: "olive", n: 8, cash: 125, req: { skill: "melee", lvl: 5 } },
  { id: "hornworms", what: "kill", k: "hornworm", n: 6, cash: 120, req: { skill: "melee", lvl: 6 } },
  { id: "perch", what: "gather", k: "perch", n: 20, cash: 110, req: { skill: "fishing", lvl: 5 } },
  { id: "toadstools", what: "kill", k: "toadstool", n: 8, cash: 130, req: { skill: "melee", lvl: 10 } },
  { id: "goats", what: "kill", k: "goat", n: 6, cash: 115, req: { skill: "melee", lvl: 10 } },
  { id: "boneidle", what: "kill", k: "boneidle", n: 6, cash: 215, req: { skill: "melee", lvl: 14 } },
  { id: "gnashers", what: "kill", k: "gnasher", n: 5, cash: 180, req: { skill: "melee", lvl: 16 } },
  { id: "catfish", what: "gather", k: "catfish", n: 15, cash: 150, req: { skill: "fishing", lvl: 15 } },
  { id: "twisters", what: "kill", k: "twister", n: 8, cash: 260, req: { skill: "melee", lvl: 20 } },
  { id: "counters", what: "kill", k: "counter", n: 6, cash: 240, req: { skill: "melee", lvl: 22 } },
  { id: "sharks", what: "kill", k: "shark", n: 5, cash: 320, req: { skill: "melee", lvl: 24 } },
  { id: "wraiths", what: "kill", k: "taxwraith", n: 5, cash: 320, req: { skill: "melee", lvl: 26 } },
  { id: "mudskipper", what: "gather", k: "mudskipper", n: 12, cash: 150, req: { skill: "fishing", lvl: 25 } },
  { id: "stagehands", what: "kill", k: "stagehand", n: 6, cash: 500, req: { skill: "melee", lvl: 30 } },
  { id: "spiders", what: "kill", k: "chandelier", n: 4, cash: 330, req: { skill: "melee", lvl: 32 } },
  { id: "ushers", what: "kill", k: "usher", n: 5, cash: 430, req: { skill: "melee", lvl: 34 } },
  { id: "understudies", what: "kill", k: "understudy", n: 5, cash: 465, req: { skill: "melee", lvl: 36 } },
  { id: "bonefish", what: "gather", k: "bonefish", n: 15, cash: 190, req: { skill: "fishing", lvl: 30 } },
  { id: "ghostcarp", what: "gather", k: "ghostcarp", n: 12, cash: 195, req: { skill: "fishing", lvl: 35 } },
  { id: "brainstorms", what: "kill", k: "brainstorm", n: 8, cash: 890, req: { skill: "melee", lvl: 40 } },
  { id: "revenants", what: "kill", k: "revenant", n: 5, cash: 650, req: { skill: "melee", lvl: 43 } },
  { id: "seagoats", what: "kill", k: "seagoat", n: 5, cash: 640, req: { skill: "melee", lvl: 44 } },
  { id: "angels", what: "kill", k: "angel", n: 5, cash: 645, req: { skill: "melee", lvl: 46 } },
  { id: "skyeel", what: "gather", k: "skyeel", n: 12, cash: 215, req: { skill: "fishing", lvl: 40 } },
  { id: "cloudray", what: "gather", k: "cloudray", n: 12, cash: 260, req: { skill: "fishing", lvl: 45 } },
  { id: "golems", what: "kill", k: "golem", n: 6, cash: 920, req: { skill: "melee", lvl: 50 } },
  { id: "geese", what: "kill", k: "goose", n: 6, cash: 985, req: { skill: "melee", lvl: 52 } },
  { id: "wolves", what: "kill", k: "wolf", n: 5, cash: 810, req: { skill: "melee", lvl: 56 } },
  { id: "drakes", what: "kill", k: "drake", n: 5, cash: 930, req: { skill: "melee", lvl: 60 } },
  { id: "thehouse", what: "kill", k: "house", n: 2, cash: 500, req: { skill: "melee", lvl: 65 } },
  { id: "marlin", what: "gather", k: "stormmarlin", n: 12, cash: 240, req: { skill: "fishing", lvl: 50 } },
  { id: "squid", what: "gather", k: "thundersquid", n: 10, cash: 235, req: { skill: "fishing", lvl: 58 } },
  // things you MAKE (2026-09-20): the workshop gets its share of the board, so ore has somewhere better to go than the Cashier
  { id: "bars", what: "make", k: "bronze_bar", n: 10, cash: 220, req: { skill: "smithing", lvl: 10 } },
  { id: "cooked", what: "make", k: "cchicken", n: 8, cash: 110, req: null },
  { id: "dinners", what: "make", k: "chickendinner", n: 3, cash: 200, req: { skill: "cooking", lvl: 3 } },
  { id: "steaks", what: "make", k: "steakdinner", n: 3, cash: 320, req: { skill: "cooking", lvl: 8 } },
  { id: "swords", what: "make", k: "bronze_sword", n: 3, cash: 380, req: { skill: "smithing", lvl: 10 } }
];
export const DAILY_COUNT = 3;
export const chicagoDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
// the day's three for a character: the ones their levels allow, shuffled by who and which day
export function dailyFor(c, id, day) {
  const ok = DAILY.filter((t) => OPEN_DAILY.has(t.id) && (!t.req || lvlOf(c, t.req.skill) >= t.req.lvl));
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

// (the gambling gear and the dinners had recipes here until 2026-09-20: the gear drops now, and Dex sells the dinners)

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
/* THE PRIZE COUNTER (2026-09-20, the owner: "an arcade style feedback loop... a central place where you can trade in
   tickets for prizes"). The world outside pays TICKETS; the House Ruby (and the two Cashier windows) is the one place
   they're spent. A ticket is worth what a dollar was, so every number in the game kept its size: a cow pays about 28
   tickets, $100 of casino chips costs 100. What's behind the counter:
     chips      tickets for the tables, 1 for 1 (the only way to get any, apart from the free wheel and winning)
     ZCoins     a Ruby scratch ticket (DEX.ticketPrice), and banking any ZCoins you found (no charge)
     the bar    Dex's drinks and dinners, and Casino scrolls, at his prices
     gear       the plain set of every tier, which Brutus used to sell out in the Yard
   NOT here on purpose: lucky clovers (fishing's alone) and the fighting finds (free-play chips, boxes, dice, watches).
   An entry is { id, group, price, give: [item, n] | cash: n }. */
export const PRIZE_CHIPS = [];   /* no chips to buy since v57: the tables take tickets */
export const prizesOf = () => [
  ...PRIZE_CHIPS.map((n) => ({ id: `chips${n}`, group: "chips", price: n, cash: n, name: `${fmtCash(n)} in chips` })),
  ...BAR.sells.map(([k, p]) => ({ id: k, group: "bar", price: p, give: [k, 1] })),
  { id: "rod", group: "bar", price: 20, give: ["rod", 1] },
  ...GEAR_FOR_SALE.map(([k, p]) => ({ id: k, group: `gear:${ITEMS[k].tier}`, price: p, give: [k, 1] }))
];
/* Brutus sells the PLAIN set of every tier (2026-09-20: nothing is smithed any more, so this is how you gear up, and it
   gives tickets somewhere to go that isn't a table). Bronze is what it always cost; each tier up costs several times the
   last, priced at roughly 20 minutes' fighting for emerald up to a couple of hours' for onyx. The good stuff still drops. */
const GEAR_PRICE = { gladius: 220, sword: 250, maul: 280, helm: 200, shield: 300, body: 600, legs: 360, boots: 120, gloves: 120, ring: 180, amulet: 260 };
const TIER_COST = { bronze: 1, emerald: 4, diamond: 12, dragonstone: 30, onyx: 75 };
const GEAR_FOR_SALE = TIERS.flatMap((t) => Object.entries(GEAR_PRICE).filter(([k]) => ITEMS[`${t.key}_${k}`]).map(([k, p]) => [`${t.key}_${k}`, p * TIER_COST[t.key]]));
/* Dex's bar (2026-09-20): drinks and the scroll home. Priced so a lager about pays for itself at the table limit and
   costs you at small stakes: a drink is for someone betting big, and otherwise a tickets sink. `round` buys everyone on
   the floor who isn't already drinking a lager's worth of bets. */
export const BAR = { sells: [["beer", 40], ["cocktail", 90], ["whiskey", 100], ["champagne", 200], ["chickendinner", 80], ["steakdinner", 150], ["porkchops", 150], ["fishplatter", 300], ["tp_scroll", 50]], round: { price: 300, k: "beer", bets: 10 } };
export const SHOP = {
  // Brutus stocks tools and BRONZE ONLY. Everything above bronze is found, not
  // bought — otherwise the fastest route to the best gear in the game is to
  // stand at the copper vein and walk away, which is not a route anybody should
  // enjoy discovering.
  sells: [["rod", 20], ...GEAR_FOR_SALE],
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
/* ------------------------------------------------------------ what things are worth (2026-09-20)

   GAMBA in one loop: gamble; go broke; go and get more. Skilling (west arch) and fighting (east arch) turn up things
   the Cashier on the casino floor buys for the amount written over them out in the world. Take them to the workshop
   (front door) first and whatever you MAKE sells for DOUBLE the raw materials in it, because you had to go and get
   them, and a quarter more again for every further step: copper $10 + tin $10 -> bronze bar $40 -> a bronze sword
   (2 bars, $40 of ore) $100. (Until 2026-09-20 each step doubled the last, so a sword was $160 and a miner with an
   anvil earned twice what anyone else could: see tools/eastscape-balance.mjs.) One list, read by the Cashier, by Brutus,
   by the labels over rocks and monsters, and by the wiki. A made thing is never priced here by hand. */
export const VALUE = {
  logs: 10, copper: 10, tin: 10, sardine: 8, trout: 14, wheat: 4, olives: 3,   /* (v70: sardine 10 -> 8 and trout 18 -> 14 after the grind sim: the Yard and the Gloam paid fishers as much as fighters) */   // (fish: see FISHING)
  willowlogs: 15, emerald_ore: 15, lanternfish: 20, diamond_ore: 22,            // the Gloam
  skyashlogs: 28, dragonstone_ore: 30, skyeel: 40, onyx_ore: 40,                // Cloudreach
  perch: 10, catfish: 18, mudskipper: 28, bonefish: 28, ghostcarp: 36, cloudray: 48, stormmarlin: 44, thundersquid: 52,   // v68: two fish a band (see the scenes' spots)
  sporecap: 12, markedcard: 22, sharktooth: 26, flashlight: 30, stormjelly: 34, staticfur: 42, hailshard: 46,            // v68: what the new monsters leave
  receipt: 15, cobweb: 25,                                                      // the Boneyard's leavings
  chip_red: 250, chip_black: 1000, chip_gold: 5000,                             // fighting's windfalls
  chicken: 8, feather: 1, bones: 3, beef: 12, hide: 14, tomatoe: 5, husk: 10, pork: 16, tusk: 18, pit: 2, mask: 60, monocle: 40, manifesto: 25
};
for (const [k, v] of Object.entries(SHOP.buys)) if (!(k in VALUE) && !ITEMS[k]?.slot) VALUE[k] = v;      // the closed areas keep Brutus's old prices until they reopen
/* FISHING is the one quiet job: you can't die, it never runs dry, and you can do it with a drink in your hand. A cast every
   `ms`, and your chance of a bite grows with your Fishing level exactly as mining's did. It is tuned to pay between two thirds and nine tenths of
   what fighting does at the same level (tools/eastscape-grind-sim.mjs): safe money is a little less money. It's also the
   only place lucky clovers come from now, and a fish is food as it comes out of the water. */
export const FISHING = { ms: 2600, chance: (lvl) => Math.min(0.9, 0.4 + lvl * 0.02), troutAt: 10, troutShare: 0.35, secondShare: 0.35 };
/** What a cast at this spot lands, for a fisher of this level: the spot's fish, or (secondShare of the time, once you are fish2lvl) its second one. r: a roll 0..1 */
export const fishAt = (ob, lvl, r) => (ob?.fish2 && lvl >= (ob.fish2lvl || 0) && r < FISHING.secondShare ? ob.fish2 : ob?.fish || "sardine");
export const CRAFT_PAYS = 2, CRAFT_STEP = 1.25;
{ // RAW[k]: the raw materials in one of a thing, and how many times it has been worked. Bars before the gear made of them.
  const RAW = Object.fromEntries(Object.entries(VALUE).map(([k, v]) => [k, { v, steps: 0 }]));
  for (let pass = 0; pass < 4; pass++) for (const r of Object.values(RECIPES)) {
    if (!r.in.every(([k]) => RAW[k])) continue;
    const raw = r.in.reduce((a, [k, n]) => a + RAW[k].v * n, 0) / (r.out[1] || 1), steps = 1 + Math.max(...r.in.map(([k]) => RAW[k].steps));
    RAW[r.out[0]] = { v: raw, steps }; VALUE[r.out[0]] = Math.round(CRAFT_PAYS * raw * CRAFT_STEP ** (steps - 1));
  }
}
{ // Brutus pays what the Cashier pays. Neither may pay what Brutus SELLS a thing for, or buying and selling it back is a money printer.
  const sold = Object.fromEntries(SHOP.sells);
  for (const [k, v] of Object.entries(VALUE)) { if (sold[k]) VALUE[k] = Math.min(v, Math.floor(sold[k] * 0.7)); SHOP.buys[k] = VALUE[k]; }
}
/* BOUNTY: what an average kill comes to, everything counted. From tools/eastscape-balance.mjs (2026-09-20): a fighter of
   the monster's own level, in the gear that level wears, should make 1.15x what a miner of that level makes in the same
   time (the owner: "mostly match, with fighting winning slightly"). Before this a hornworm paid a fifth of what the
   rock next to it did. 88% of it is the monster's own drops plus tickets it carries (a "tickets" drop fills the gap); the
   rest arrives as FINDS, below, which is why a bigger monster turns up more chips. */
export const BOUNTY = { chicken: 18, cow: 28, rotten: 34, olive: 35, hornworm: 45, boar: 47, highwayman: 40, goat: 42, gnasher: 80, moth: 74, taxwraith: 142, ghoul: 177, chandelier: 185, understudy: 207, ram: 255, angel: 287, revenant: 289, goose: 365,
  toadstool: 36, boneidle: 79, twister: 73, counter: 88, shark: 143, stagehand: 185, usher: 192, brainstorm: 247, seagoat: 283,
  /* THE 50+ BAND pays MORE than the tool asks: its reference wage goes flat at level 40 (there was no skilling past onyx), so left alone a level-70
     kill would pay a level-42 minute. These are the tool's numbers times 1 + 1.2% a level past 42, so the last band is worth reaching. The goose moved with them. */
  golem: 342, wolf: 360, drake: 414, house: 555 };   // (v68: measured with tools/eastscape-balance.mjs, like the rest)   // (re-measured 2026-09-20 for half-length fights: a kill pays less, and there are twice as many)
for (const [t, want] of Object.entries(BOUNTY)) {
  const m = MOBS[t]; m.drops = m.drops.filter(([k]) => k !== "tickets");
  const other = m.drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  if (gap >= 2) m.drops.unshift(["tickets", [Math.max(1, Math.round(gap * 0.6)), Math.round(gap * 1.4)]]);   // tickets first: line one of every table (it was tickets until 2026-09-20)
}
/* FINDS: what any kill can turn up on top of the monster's own drops. [item, share]: the chance is share x the
   monster's bounty / the find's worth, so every monster gives the same fraction of its pay this way and a chicken
   farmer sees a red chip about once in 250 kills while the Understudy coughs one up every 14. */
export const FINDS = [["chip_red", 0.04, 250], ["chip_black", 0.03, 1000], ["chip_gold", 0.03, 5000], ["chip_free", 0.008, 50], ["mysterybox", 0.008, 60], ["devils_dice", 0.004, 50], ["rewind_watch", 0.006, 250]];
export const findChance = (mob, [, share, worth]) => Math.min(0.25, share * (BOUNTY[mob] || 0) / worth);
/* REAL ZCOINS, RARELY (2026-09-20, the owner: "rare drops for raw zcoins from fishing and mob killing"). A `zcoin` is an
   item: it lands in your bag like anything else, and the Prize Counter banks it onto your eastcoin.vip balance through the
   same endpoint, the same hourly allowance (DEX.capHour) and the same day fuse as everything else that mints ZCoins, so
   the drop rate here can never out-run the cap. A kill's chance grows a little with the monster's level; a catch's with
   the water. One drop in twenty is a handful (`bigN`) instead of one. At these numbers an hour of fighting turns up
   about 2 to 5 ZCoins and an hour of fishing 1.5 to 5; tools/eastscape-grind-sim.mjs prints the measured figure. */
export const ZDROP = { kill: (lvl) => 0.006 + lvl * 0.0002, fish: { sardine: 0.0025, perch: 0.0025, trout: 0.0025, catfish: 0.0027, lanternfish: 0.003, mudskipper: 0.003, bonefish: 0.0031, ghostcarp: 0.0032, skyeel: 0.0033, cloudray: 0.0034, stormmarlin: 0.0035, thundersquid: 0.0036 }, big: 0.05, bigN: 5 };
/** A monster's whole rare line: its own named pieces, then the casino finds, each with its chance a kill. ONE roll decides. */
export const raresOf = (mob) => [...(BOUNTY[mob] ? [["zcoin", ZDROP.kill(MOBS[mob].lvl)]] : []), ...(MOBS[mob]?.rare || []), ...(BOUNTY[mob] ? FINDS.map((f) => [f[0], findChance(mob, f)]) : [])];
export const rollRare = (mob, r, fx) => { for (const [k, p0] of raresOf(mob)) { const p = p0 * (1 + (k === "zcoin" ? fx?.zdrop || 0 : fx?.rare || 0)); if (r < p) return k; r -= p; } return null; };   /* fx: fxOf(character) */
export const BOX = [["clover", 3], ["chip_red", 2], ["chip_free", 3], ["beer", 3], ["whiskey", 2], ["cocktail", 2], ["steakdinner", 2], ["tp_scroll", 3], ["devils_dice", 2], ["rewind_watch", 1], ["chip_black", 0.3]];   // what's in a mystery box, by weight
export const valueOf = (k) => VALUE[k] ?? SHOP.buys[k] ?? 0;
/** The first thing a raw material can be made into, and what that's worth each: the Cashier's "worth more made" nudge. */
export const madeFrom = (k) => { const r = Object.values(RECIPES).filter((x) => x.in.some(([i]) => i === k) && !ITEMS[x.out[0]]?.slot).sort((a, b) => a.lvl - b.lvl)[0]; return r ? { r, out: r.out[0], verb: STATIONS[r.station === "fire" ? "range" : r.station]?.verb || "make" } : null; };
/** What one go at a thing in the world is worth: the label drawn over a rock, a tree, a fishing spot. */
export const nodeValue = (ob) => (ob.t === "rock" || ob.t === "vein" ? valueOf(ob.ore) : ob.t === "spot" ? valueOf(ob.fish || "sardine") : ob.t === "wheat" ? valueOf("wheat")
  : ob.t === "olive" || ob.t === "vine" ? valueOf(ob.crop || "olives") : ["tree", "oak", "yew", "cypress", "deadtree", "willow", "skyash"].includes(ob.t) ? valueOf(ob.log || "logs") : 0);
/** What a monster's drops come to on an average kill. */
export const mobValue = (t) => Math.round((MOBS[t]?.drops || []).reduce((a, [k, n, p]) => a + (k === "tickets" || k === "tickets" ? 1 : valueOf(k)) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0)
  + raresOf(t).reduce((a, [k, p]) => a + (ITEMS[k]?.slot ? 0 : valueOf(k)) * p, 0));
/** What the Cashier will take off you in one go: loot and things you made, never tools, charms or anything you could wear. */
export const isLoot = (k) => k !== "tickets" && k !== "tickets" && k !== "zcoin" && valueOf(k) > 0 && !ITEMS[k]?.slot && !ITEMS[k]?.luck && !ITEMS[k]?.use && !ITEMS[k]?.drink;

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
export const ISLE_FERRY = { scene: "forum", x: 16, y: 21 };   // (was River Bend's ferry until 2026-09-20: Charon works from a cart in the square now)
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
  fountain: ["The water tastes faintly of coins. People keep throwing tickets in it."],
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
  roadblock: ["Road closed. There's more world out there, and it opens soon. For now: the casino, this town, and the three scenes out the casino's arch."],
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
export const VERB = { rrtable: "Sit at", rrseat: "Sit at", rrboard: "Read", barcart: "Drink at", prizewheel: "Spin", fameboard: "Read", cart: "Ride", fight: "Bet on", coinstatue: "tickets in at", cooler: "Drink at", buffet: "Eat at", cashier: "tickets in at", howto: "Read", game: "Play", board: "Read", roulette: "Play", roomdoor: "Enter", walldoor: "Enter", cook: "Cook-at", smelt: "Smelt-at", smith: "Smith-at", pvp: "Attack", ground: "Take", rope: "Climb-up", ferry: "Board", boatback: "Sail-home", plot: "Tend", pedestal: "Use", islesign: "Read", bank: "Bank at", exchange: "Trade at", player: "Trade with", enter: "Enter", hole: "Climb-down", mob: "Attack", npc: "Talk-to", wheat: "Pick", spot: "Fish", door: "Open", well: "Search", rock: "Mine", vein: "Mine", tree: "Chop down", olive: "Pick", shrine: "Pray-at", notice: "Read", sign: "Read" };

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
    reward: { coins: 40, xp: { woodcutting: 150 }, text: "40 tickets, 150 Woodcutting xp" }
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
      done: "tickets, and my respect. Mostly the tickets."
    },
    reward: { coins: 60, xp: { melee: 200 }, text: "60 tickets and 200 Combat xp" }
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
    reward: { coins: 40, xp: { fishing: 150 }, text: "40 tickets, 150 Fishing xp" }
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
    for (const k of ["attack", "strength", "defence"]) c.xp[k] = Math.max(Number(c.xp[k]) || 0, melee);   // (named here: step 4 folds them back into one)
    delete c.xp.melee;
    if (!STANCES[c.stance]) c.stance = DEFAULT_STANCE;
  },
  // 4: Attack, Strength and Defence became ONE Combat skill (key "melee" again). It takes the best of the three, so
  //    nobody comes out weaker at anything; for anyone who trained them evenly (every hit since stances went) it's exact.
  (c) => {
    c.xp = { ...(c.xp || {}) };
    c.xp.melee = Math.max(Number(c.xp.melee) || 0, Number(c.xp.attack) || 0, Number(c.xp.strength) || 0, Number(c.xp.defence) || 0);
    delete c.xp.attack; delete c.xp.strength; delete c.xp.defence;
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
    v: SAVE_V, scene: START.scene, x: START.x, y: START.y, hp: 10, hunger: 100, thirst: 100, wagered: 0, earned: 0, spin: null, roller: 0, free: 0, meal: null, drink: null, tour: { step: 0, logs: 0, chickens: 0 },
    inv: [{ k: "tickets", n: 25 }, { k: "rod", n: 1 }],
    eq: { helm: "cap", weapon: "rudis", body: "tunic", shield: "parma", legs: null, gloves: null, boots: "sandals", ring: null },
    stance: DEFAULT_STANCE,
    xp: { melee: 0, hp: XP_AT[10], fishing: 0, farming: 0, mining: 0, woodcutting: 0, cooking: 0, smithing: 0 },
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
  { const bt = out.bank.find((x) => x.k === "tickets"); if (bt) { out.bank.splice(out.bank.indexOf(bt), 1); addInv(out.inv, "tickets", bt.n); } }   /* tickets stay on you (2026-09-19): any that were banked come back to the bag (they never take a slot's cap) */
  for (const s of SLOTS) { if (out.eq[s]) out.eq[s] = aliasKey(out.eq[s]); if (out.eq[s] && !ITEMS[out.eq[s]]) out.eq[s] = null; }
  if (!OPEN.has(String(out.scene).split(":")[0])) Object.assign(out, START);
  if (!SCENES[out.scene]) Object.assign(out, isIsle(out.scene) ? ISLE_FERRY : START);   // back from an island: the ferry at River Bend
  const fi = f.isle, ci = c.isle && typeof c.isle === "object" ? c.isle : {};
  out.isle = {
    plots: Array.from({ length: ISLE.plots }, (_, i) => { const p = ci.plots?.[i]; return p && CROPS[p.k] && Number.isFinite(p.at) ? { k: p.k, at: p.at } : null; }),
    shelf: Array.from({ length: ISLE.shelf }, (_, i) => { const k = ci.shelf?.[i] ? aliasKey(ci.shelf[i]) : null; return ITEMS[k] ? k : null; }),
    themes: [...new Set(["meadow", ...(Array.isArray(ci.themes) ? ci.themes : [])])].filter((t) => THEMES[t]),
    theme: fi.theme, open: ci.open !== false, tier: [1, 2, 3].includes(ci.tier) ? ci.tier : 1
  };
  if (out.isle.themes.includes(ci.theme)) out.isle.theme = ci.theme;
  for (const k of ["meal", "drink"]) if (!out[k] || !ITEMS[out[k].k]?.[k] || !((out[k].left | 0) > 0)) out[k] = null;
  out.stance = stanceOf(out);
  out.stats = normStats(out.stats);
  return migrate(out);          // brings an older save up to SAVE_V and stamps out.v
}
export const lvlOf = (c, k) => levelOf(c.xp[k] || 0);
export const maxHpOf = (c) => lvlOf(c, "hp");
// The three combat skills weigh the same. Equal thirds is also what keeps the
// split neutral: a character whose attack, strength and defence all equal their
// old melee level comes out at exactly the combat level they had before.
export const meleeOf = (c) => lvlOf(c, "melee");
export const combatOf = (c) => Math.floor((meleeOf(c) * 1.3 + lvlOf(c, "hp")) / 2.3) + 2;
export const totalOf = (c) => Object.keys(SKILLS).reduce((n, k) => n + lvlOf(c, k), 0);
export const bonusOf = (c) => { const b = { acc: 0, str: 0, def: 0 }; for (const k of Object.values(c.eq)) if (k && ITEMS[k]) for (const q in b) b[q] += ITEMS[k][q] || 0; return b; };
export const maxHitOf = (c) => 1 + Math.floor(lvlOf(c, "melee") / 6) + Math.floor(bonusOf(c).str / 2);

/* The two rolls, in one place so the server and the page can never disagree.

   Defence stays halved. Not for elegance — without it the numbers break: a
   level 50 defence with 20 from gear rolls 70 against a revenant's 32 attack,
   which clamps to the 10% floor and the hardest thing in the game stops landing
   hits. Halved, a Defensive character ends up exactly as hard to hit as a
   melee-50 character was before the split, while somebody who poured everything
   into Strength is genuinely fragile. That difference IS the split. */
export const attackRollOf = (c) => lvlOf(c, "melee") + 1 + bonusOf(c).acc;
export const defenceRollOf = (c) => (lvlOf(c, "melee") + bonusOf(c).def) / 2;
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

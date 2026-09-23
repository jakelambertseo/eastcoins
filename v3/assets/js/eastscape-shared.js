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
export const VERSION = 186;
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
  /* FARMING'S MISSING MIDDLE (2026-09-23). Crops ran 1, 5, then 50 — a 45-level hole with nothing to plant in it,
     which is why planting was switched off rather than finished. These four fill it. They are the CROP, not a seed:
     planting spends one of the crop itself (see isleUse's "plant"), so a monster dropping the crop needs no new item
     class and no new UI. Emoji for now; four 32px icons are the whole art bill when someone gets to it. */
  rattlebean: { name: "Rattlebean", icon: "🫘", ex: "It rattles in the pod before you pick it, which growers say is the plant complaining." },
  lanternroot: { name: "Lanternroot", icon: "🥕", ex: "Glows faintly from the inside. Mire farmers plant a row of it instead of owning a lamp." },
  bonegourd: { name: "Bonegourd", icon: "🎃", ex: "Pale, heavy and hollow. It grows best where something used to be buried." },
  stormcorn: { name: "Stormcorn", icon: "🌽", ex: "Each kernel holds a little charge. A full cob makes your teeth ache pleasantly." },
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
  /* ---- THE TRAILER PARK (2026-09-22), the level-80 zone north of the Thunderhead ----
     Its two gathered metals are the point of the place: a catalytic converter cut out of a car up on blocks, and
     slagstone out of the bank behind the scrapyard. Both are MINED, which is why a converter needs a pickaxe and
     not a hacksaw — the game has one metal-gathering skill and inventing a second for one zone would mean a second
     tool ladder, a second set of nodes and a second thing to balance, for a joke that a name carries just as well. */
  catalytic: { name: "Catalytic converter", short: "Converter", icon: "⚙️", ex: "Cut from under a truck that was not going anywhere. Worth more than the truck." },
  slagstone: { name: "Slagstone", icon: "🪨", ex: "Whatever the scrapyard has been burning for thirty years, cooled into rock. Still warm in the middle." },
  pinelogs: { name: "Rustpine logs", icon: "🪵", ex: "Grew downwind of the yard. The rings are orange and it smells of brake fluid." },
  bogwoodlogs: { name: "Bogwood logs", icon: "🪵", ex: "Pulled out of the swamp black and dense as coal. It sinks in water and burns for a week." },
  mudcat: { name: "Raw mud cat", icon: "🐟", ex: "A catfish the colour of the bottom. It has been down there a long time and it has opinions." },
  bowfin: { name: "Raw bowfin", icon: "🐟", ex: "All teeth and bad temper. Older than the swamp it lives in." },
  cmudcat: { name: "Cooked mud cat", icon: "🐟", heal: 26, ex: "Better than it has any right to be." },
  cbowfin: { name: "Cooked bowfin", icon: "🐟", heal: 30, ex: "You have to work round the bones. Worth it." },
  wrench: { name: "The King's wrench", short: "Wrench", icon: "🔧", slot: "weapon", acc: 34, str: 38, speed: 3000, req: { skill: "melee", lvl: 80 }, ex: "Four feet of rusted pipe wrench. It has loosened exactly one nut in its life and settled a great many arguments." },
  kingcap: { name: "The King's cap", short: "Cap", icon: "🧢", slot: "helm", def: 14, acc: 4, ex: "Sweat-stained, sun-bleached, and it still smells of him. Nobody will say a word about you wearing it." },
  /* (2026-09-22) The Run's pickup. `pickXp` is read by the ground handler, so anything droppable can pay a skill
     for being picked up without the handler learning about agility — the same shape as `heal` or `luck`. */
  agilmark: { name: "Runner's mark", short: "Mark", icon: "🏅", pickXp: { skill: "agility", xp: 30 }, ex: "Dropped on the course by somebody quicker than you. Worth something at the counter, and worth more to your legs." },
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
  /* (2026-09-22) THE FIRST RUNG OF THE TOOL LADDER. These three keep their old plain keys — they are in every
     starting bag, in Dex's quest lines and on the counter — so the ladder is built AROUND them (see TOOL_KINDS,
     below TIERS) rather than renaming them and chasing the references. `tlvl` is the rung: what a node may ask for. */
  pickaxe: { name: "Bronze pickaxe", short: "Pickaxe", icon: "⛏️", slot: "weapon", tool: "mining", tier: "bronze", tlvl: 1, tspd: 1, acc: 1, str: 1 },
  axe: { name: "Bronze axe", short: "Axe", icon: "🪓", slot: "weapon", tool: "woodcutting", tier: "bronze", tlvl: 1, tspd: 1, acc: 2, str: 2 },
  rod: { name: "Fishing rod", short: "Rod", icon: "🎣", slot: "weapon", tool: "fishing", tier: "bronze", tlvl: 1, tspd: 1 },
  cap: { name: "Leather cap", short: "Cap", icon: "⛑️", slot: "helm", def: 1 },
  tunic: { name: "Tunic", icon: "🥋", slot: "body", def: 2 },
  // cooked food: click it in your bag to eat. heal is hitpoints back
  csardine: { name: "Cooked sardine", icon: "🐟", heal: 6, ex: "Crunchy. Mostly bones, some joy." },
  cchicken: { name: "Cooked chicken", icon: "🍗", heal: 3, ex: "Tastes like chicken. Waldy is relieved." },
  cbeef: { name: "Cooked beef", icon: "🥩", heal: 4, ex: "A good honest steak." },
  cpork: { name: "Roast boar", icon: "🍖", heal: 6, ex: "Crackling on the outside, grudge on the inside." },
  ctrout: { name: "Cooked trout", icon: "🐠", heal: 10, ex: "Flaky, buttery, and it no longer judges you." },
  cgloomfin: { name: "Cooked gloomfin", icon: "🐟", heal: 15, ex: "Still slightly annoyed. Very filling." },
  cmooncarp: { name: "Cooked moon carp", icon: "🐡", heal: 21, ex: "It glows faintly in your stomach. That's normal. Probably." },
  burnt: { name: "Burnt food", icon: "⚫", ex: "Whatever it was, it's charcoal now." },
  // ---- 2026-09-20: THE THINGS THAT CHANGE HOW THE CASINO TREATS YOU (see FX, below the casino's numbers) ----
  // fighting's windfalls: house chips, worth a lump of tickets at the Ruby or a Cashier
  chip_red: { name: "Red house chip", icon: "🔴", ex: "Somebody's winnings, dropped in a hurry. Bom Trady will take it." },
  chip_black: { name: "Black house chip", icon: "⚫", ex: "A thousand dollars of somebody else's bad night." },
  chip_gold: { name: "Gold house chip", icon: "🟡", ex: "There are maybe six of these. One of them was inside that thing you just killed." },
  // fighting's other finds: things you click
  chip_free: { name: "Green house chip" /* (v97: it was "Free-play chip", from when it covered a bet. A beta tester cashed one and then looked for it on the table.) */, icon: "🟢", use: "bundle", worth: 100, ex: "An old house chip. Click it to cash it: 100 tickets, straight into your bag. It is not a bet, so it never shows on a table." },
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
  champagne: { name: "Champagne", icon: "🍾", drink: { mins: 10, fx: { zdrop: 0.5 } }, ex: "Pop it before a long session outside. Click to drink." },
  clover: { name: "Lucky clover", icon: "🍀", luck: 15, ex: "Turns up while you fish. Click it: your next 15 kills or catches are LUCKY (a real ZCoin is 25% more likely to drop)." },
  horseshoe: { name: "Lucky horseshoe", icon: "🧲", luck: 25, ex: "Rare, and only found while fishing. Click it: your next 25 kills or catches are LUCKY." },
  // the Gloam and Cloudreach (2026-09-18): where the tier ores actually live
  emerald_ore: { name: "Emerald ore", icon: "🟢", ex: "Green rock with greener bits. Smelt two for an Emerald bar." },
  diamond_ore: { name: "Diamond ore", icon: "💠", ex: "It was pressed into this shape in the dark for a very long time. It is not grateful." },
  dragonstone_ore: { name: "Dragonstone ore", icon: "🔴", ex: "Warm. Always warm. The clouds up there keep their distance from it." },
  onyx_ore: { name: "Onyx ore", icon: "⚫", ex: "Lightning hit this and it held on to some. Your hair stands up when you carry it." },
  /* (v121) the two ores above onyx: the Vault's and the one below it. Mining 60 and 70, and they are only found down there. */
  starfall_ore: { name: "Starfall ore", icon: "☄️", ex: "Still faintly warm from the fall. Hold it to your ear and there is a sound a long way off." },
  eclipse_ore: { name: "Eclipse ore", icon: "🌑", ex: "It does not shine, it un-shines. Set it down and the shadows lean toward it." },
  voidglass: { name: "Voidglass", icon: "🔮", ex: "The Vault's windows, after whatever happened down there. Sharp, cold and very hard to look at." },
  willowlogs: { name: "Gloomwillow logs", icon: "🪵", ex: "Damp, dark and faintly glowing at the ends. They burn blue." },
  skyashlogs: { name: "Skyash logs", icon: "🪵", ex: "Light enough to float. Please don't let go of them." },
  voidlogs: { name: "Vaultwood logs", icon: "🪵", ex: "Grew in the dark with no water and no light. Nobody wants to think about what it lived on." },
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
  clanternfish: { name: "Cooked lanternfish", icon: "🐟", heal: 16, ex: "The light goes out when it's cooked. That's how you know." },
  skyeel: { name: "Sky eel", icon: "🐍", heal: 14, ex: "Caught from a cloud, out of the open sky. It is very surprised about it too." },
  /* (v104) every fish can be cooked now. A cooked fish sells for TWICE the raw one (CRAFT_PAYS, like anything made) and heals about two thirds more. */
  cperch: { name: "Cooked perch", icon: "🐟", heal: 7, ex: "The stripes are grill marks now." },
  ccatfish: { name: "Cooked catfish", icon: "🐟", heal: 12, ex: "The whiskers crisp up nicely. Don't think about it." },
  cmudskipper: { name: "Cooked mudskipper", icon: "🐟", heal: 18, ex: "It stopped walking. Tastes of pond, in a good way." },
  cbonefish: { name: "Cooked bonefish", icon: "🐟", heal: 20, ex: "Still mostly bones. Warm bones." },
  cghostcarp: { name: "Cooked ghost carp", icon: "🐟", heal: 22, ex: "You can see the plate through it." },
  ccloudray: { name: "Cooked cloud ray", icon: "🐟", heal: 26, ex: "Light as air. Fills you up anyway." },
  cstormmarlin: { name: "Cooked storm marlin", icon: "🐟", heal: 29, ex: "The nose still hums. Eat around it." },
  cthundersquid: { name: "Cooked thunder squid", icon: "🦑", heal: 32, ex: "Calamari with a kick. An actual kick." },
  cskyeel: { name: "Cooked sky eel", icon: "🐍", heal: 24, ex: "Tastes like a thunderstorm smells." },
  // the Forge's Bronze set (Brutus sells it); req is what you need to wear it
  toga: { name: "Goat-sized toga", short: "Toga", icon: "🥻", slot: "body", def: 3, acc: 1, ex: "Smells of goat. Fits you perfectly, which is worrying." },
  parma: { name: "Parma", icon: "🛡️", slot: "shield", def: 3 },
  sandals: { name: "Sandals", icon: "🩴", slot: "boots", def: 1 }
};
// what a character looks like comes from their body armour: "tiro" (a recruit) unless it has a tier
/* PEOPLE (v75). An unarmoured player used to be a Roman novice in a tunic, left over from when this was Gladiator, and the
   casino's fake players were one Spartan, colour-shifted. The owner picked SIX MODERN, EVERYDAY LOOKS (look1..look6, eight
   facings each, PixelLab), to match Dex, Bino and the rest. Nobody chooses: lookOf() turns an account id (or a fake player's
   name) into the same look every time, on every screen, with nothing stored. Armour still replaces the whole sprite. */
export const LOOKS = 6;
export const lookOf = (key) => { let h = 2166136261; for (const ch of String(key)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % LOOKS) + 1; };
/* YOUR LOOK (v80, the owner: "player looks and customization will be a BIG thing... mix and match. give a few options for hair
   styles, a few for bodies, and thats it. these are sports focused players, so maybe a few options for tshirts skinned like
   their favorite teams"; NFL only for now).
   HOW IT IS DRAWN. PixelLab drew a few BALD BODIES in key colours (bright magenta tee, bright green trousers) and a few
   HAIRSTYLES in bright blue, all on one skeleton, eight facings each. The page tells the parts apart by hue, lays the hair
   over the bald head, and repaints skin / hair / top / bottoms in the player's picks, keeping each pixel's own shading
   (eastscape.html, lookSprite). One repaint per person per facing, then it is kept: no new downloads per player.
   WHAT IS STORED. c.look = [body, hair, skin, hairColour, top, team, bottoms], seven small indexes into the lists below.
   `team` is -1 for a plain tee in LOOK.tops[top]; otherwise LOOK.teams[team] and the tee is that club's colours with a
   chest stripe. THE TEE IS COLOURS ONLY: no logo, no wordmark on the sprite (the same rule Bino's jersey follows). The LIST
   names each club in full ("Arizona Cardinals": the owner asked, 2026-09-20), as eastcoin.vip's Picks pages already do.
   A BALL CAP goes in the team's colour when a team tee is on. `beard` (the eighth number, 0 or 1) was added the same day:
   a look saved with seven numbers is read as clean-shaven. `abbr` is the site's own code for the club, so the first-login screen can start on the favourite team
   a player already chose on eastcoin.vip.
   A character with no look yet (c.look null) is asked "Who are you?" when they arrive, and until they answer they wear one of
   the six old drawn looks (lookFor, below). A look is changed at the MIRROR by the casino's front door, free.
   THE CASINO'S DRESS CODE (the owner said yes): on a casino floor everyone is drawn in their look, whatever they're wearing;
   armour shows outside. Otherwise the first Bronze body would erase all of this. */
export const LOOK = {
  bodies: ["avg", "big", "slimw", "curvyw", "fat"], bodyNames: ["Average", "Big guy", "Slim", "Curvy", "Fat as shit"],   // (new bodies go on the END: a saved look is a list of indexes)
  /* GUY OR GIRL (v90, the owner: "why is my character... a girl by default? is it random? we should let people choose boy or girl").
     It WAS random over every body, and half the bodies are women. The builder now asks first, opens on Guy, and steps and
     rolls the dice inside the choice: which bodies, and which hairstyles the dice may land on (any hair can still be picked by
     hand). Nothing new is stored: which one you are is read back off your body. */
  sexes: { guy: { name: "Guy", bodies: [0, 1, 4], hairs: [0, 1, 2, 3, 5, 6] }, girl: { name: "Girl", bodies: [2, 3], hairs: [3, 4, 7, 8, 9] } },
  /* (new hairstyles go on the END: a saved look is a list of indexes. bob / bun / pigtails were added 2026-09-20 when the owner asked
     for more options for the women in the community; any body can wear any of them.) */
  hairs: ["bald", "messy", "crop", "long", "pony", "afro", "cap", "bob", "bun", "pigtails"], hairNames: ["Bald", "Messy", "Short", "Long", "Ponytail", "Afro", "Ball cap", "Bob", "Bun", "Pigtails"], CAP: 6,
  skins: ["#f6cdb2", "#e8b48e", "#cf9468", "#a86f48", "#7a4c30", "#4f3020"],
  hairCols: ["#2a1c16", "#5a3a1e", "#8a5a2a", "#d6aa52", "#b4462a", "#9a9aa2", "#e8e4dc", "#c8283a", "#2a6ad0", "#2a9a5a"],
  tops: ["#f0f0f0", "#202028", "#8a8e98", "#c8283a", "#2a5ad0", "#2a9a5a", "#e8b83a", "#e0702a", "#7a3ad0", "#e05a9a"],
  pants: ["#2a3a6a", "#202028", "#6a6a72", "#b89a6a", "#4a5a3a", "#f0f0f0"],
  teams: [["Arizona Cardinals", "#97233f", "#ffb612", "ari"], ["Atlanta Falcons", "#a71930", "#101010", "atl"], ["Baltimore Ravens", "#241773", "#9e7c0c", "bal"], ["Buffalo Bills", "#00338d", "#c60c30", "buf"], ["Carolina Panthers", "#0085ca", "#101820", "car"], ["Chicago Bears", "#0b162a", "#c83803", "chi"], ["Cincinnati Bengals", "#fb4f14", "#101010", "cin"], ["Cleveland Browns", "#311d00", "#ff3c00", "cle"],
    ["Dallas Cowboys", "#003594", "#869397", "dal"], ["Denver Broncos", "#fb4f14", "#002244", "den"], ["Detroit Lions", "#0076b6", "#b0b7bc", "det"], ["Green Bay Packers", "#203731", "#ffb612", "gb"], ["Houston Texans", "#03202f", "#a71930", "hou"], ["Indianapolis Colts", "#002c5f", "#a2aaad", "ind"], ["Jacksonville Jaguars", "#006778", "#d7a22a", "jax"], ["Kansas City Chiefs", "#e31837", "#ffb81c", "kc"],
    ["Las Vegas Raiders", "#101010", "#a5acaf", "lv"], ["Los Angeles Rams", "#003594", "#ffa300", "lar"], ["Los Angeles Chargers", "#0080c6", "#ffc20e", "lac"], ["Miami Dolphins", "#008e97", "#fc4c02", "mia"], ["Minnesota Vikings", "#4f2683", "#ffc62f", "min"], ["New England Patriots", "#002244", "#c60c30", "ne"], ["New Orleans Saints", "#d3bc8d", "#101820", "no"], ["New York Giants", "#0b2265", "#a71930", "nyg"],
    ["New York Jets", "#125740", "#f0f0f0", "nyj"], ["Philadelphia Eagles", "#004c54", "#a5acaf", "phi"], ["Pittsburgh Steelers", "#101820", "#ffb612", "pit"], ["San Francisco 49ers", "#aa0000", "#b3995d", "sf"], ["Seattle Seahawks", "#002244", "#69be28", "sea"], ["Tampa Bay Buccaneers", "#d50a0a", "#34302b", "tb"], ["Tennessee Titans", "#0c2340", "#4b92db", "ten"], ["Washington Commanders", "#5a1414", "#ffb612", "wsh"]]
};
/** A look as the game keeps it: seven whole numbers, every one inside its list. Anything else comes back null. */
export function normLook(l) {
  if (!Array.isArray(l) || (l.length !== 7 && l.length !== 8)) return null; const [b, h, s, hc, t, tm, p, bd = 0] = l.map((v) => Math.floor(Number(v)));
  const ok = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  if (!ok(b, LOOK.bodies.length) || !ok(h, LOOK.hairs.length) || !ok(s, LOOK.skins.length) || !ok(hc, LOOK.hairCols.length) || !ok(t, LOOK.tops.length) || !ok(p, LOOK.pants.length)) return null;
  if (tm !== -1 && !ok(tm, LOOK.teams.length)) return null;
  if (bd !== 0 && bd !== 1) return null;
  return [b, h, s, hc, t, tm, p, bd];
}
/** Somebody plausible, from a number 0..1 generator: what the screen opens on, and what "Surprise me" rolls. */
export const sexOfLook = (l) => (LOOK.sexes.girl.bodies.includes(l?.[0]) ? "girl" : "guy");
/* (v90) With a `sex` the roll stays inside that choice (and only a guy rolls a beard). Without one it is the old roll over the
   first four bodies, number for number, because the casino's fake players are made from it and must not all change faces. */
export function randomLook(rnd = Math.random, sex = null) { const n = (k) => Math.floor(rnd() * k), S = LOOK.sexes[sex];
  if (S) return [S.bodies[n(S.bodies.length)], S.hairs[n(S.hairs.length)], n(LOOK.skins.length), n(6), n(LOOK.tops.length), rnd() < 0.5 ? n(LOOK.teams.length) : -1, n(LOOK.pants.length), sex === "guy" && rnd() < 0.25 ? 1 : 0];
  return [n(4), n(LOOK.hairs.length), n(LOOK.skins.length), n(6), n(LOOK.tops.length), rnd() < 0.5 ? n(LOOK.teams.length) : -1, n(LOOK.pants.length), rnd() < 0.2 ? 1 : 0]; }
/** The casino's fake players are people too: a made look from their name, the same one every time, on every screen. */
export function botLook(name) { let h = 2166136261; for (const ch of String(name)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } let x = (h >>> 0) || 1; const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296); const l = randomLook(rnd); if (l[0] > 1) l[7] = 0; return l; }

/* PINNED LOOKS (2026-09-20). The hash doesn't know who anybody is: it made the owner (a white guy) the dark-skinned polo look,
   and he asked why. A name here always gets that look; everyone else still gets theirs from their account id. This is a
   stopgap: if more people ask, the real answer is letting players pick (the owner chose "nobody picks" for now).
   1 hoodie · 2 Hawaiian-shirt dad · 3 cap and jersey · 4 denim jacket (woman) · 5 polo · 6 red tracksuit (woman) */
export const LOOK_PICKS = { bootypaper: 1 };
export const lookFor = (p) => LOOK_PICKS[String(p?.name || "").toLowerCase()] || lookOf(p?.id ?? p?.name);
export const outfitOf = (eq) => ITEMS[eq?.body]?.tier || "tiro";

/* ============================================================ VANITY (2026-09-21)
   Bought from Ronde Barber in the casino with TICKETS, worn over your look, seen by everyone, everywhere.

   WHY IT EXISTS: tickets had exactly one outlet — the Prize Counter at TIX_PER_ZC to 1 ZCoin — and that is a
   CONVERSION, not a sink: it moves value into the ZCoin economy rather than removing any. Vanity is a true sink.
   Tickets leave and nothing enters, and because it grants no power it can be priced freely without being unfair.

   HOW IT IS DRAWN: exactly the way hair already is. Each piece is a PART MAP (pv_<item>_<facing>.png, (0,0,v) where
   v is that pixel's own lightness), drawn by PixelLab as a state of the SAME base body — which is what keeps it
   aligned across all eight facings — and repainted into whichever colour the wearer picked. So one drawing of a
   helmet is twenty helmets, and a set can be matched to a club's colours. Players have no walk frames, so a piece
   is eight small files and nothing else.

   FOUR SLOTS, and `feet` is BOOTS ON PURPOSE: below the trousers there are four pixels of foot, which is too few to
   read as anything. A boot that climbs the shin gets eight to ten and can actually be seen, so every feet item is
   drawn to cover the bottom of the leg. Do not add a low shoe here; it will look like nothing at all.

   A HELMET HIDES HAIR, a cap does not — per item, because it is a property of the drawing. */
export const VANITY_SLOTS = ["head", "body", "legs", "feet"];
export const VANITY_SLOT_NAMES = { head: "Head", body: "Body", legs: "Legs", feet: "Boots" };
/* The colours a piece can be repainted in. Index into this; 0 is the piece's "natural" colour for that set. */
export const VANITY_COLS = ["#b6c0cb", "#c9342f", "#2f6fc9", "#2f9d5b", "#e0a52c", "#7a4bd0", "#e2712f", "#20232a", "#e8e3da", "#c94f9a"];
export const VANITY_COL_NAMES = ["Steel", "Red", "Blue", "Green", "Gold", "Purple", "Orange", "Black", "Bone", "Pink"];
/* One price per slot, in tickets. TUNE THESE WITH REAL EARN RATES — they are a first guess, not a measurement, and
   they are deliberately in one place so changing them is one line each. A full set is the four added together. */
export const VANITY_PRICE = { head: 4000, body: 3500, legs: 3000, feet: 2500 };
export const VANITY_SETS = {
  gridiron: { name: "Gridiron", blurb: "Sunday best." },
  firelord: { name: "Firelord", blurb: "Straight out of the Gloam." },
  pumpkin: { name: "Pumpkin King", blurb: "It is nearly October." },
  highroller: { name: "High Roller", blurb: "Dress for the table you want." },
  chicken: { name: "Chicken Suit", blurb: "No notes." },
  /* (2026-09-22) four more. The gold gladiator and the anime set were asked for by name; the other two are a
     neon runner (the casino's own palette, worn) and the Scrap King, which is the Trailer Park's boss as an
     outfit — a set that points at content rather than at a theme. */
  gladiator: { name: "Gold Gladiator", blurb: "Not actually gold. Nobody has to know." },
  sakura: { name: "Sakura", blurb: "Main character energy." },
  neon: { name: "Neon Runner", blurb: "Dressed for a floor that never closes." },
  scrapking: { name: "Scrap King", blurb: "Dress like the man who runs the yard." }
};
/* key -> { set, slot, name, hidesHair? }. The key is also the part-map's file name: pv_<key>_<facing>.png */
export const VANITY = {};
for (const [set, pieces] of Object.entries({
  gridiron: { head: ["Gridiron Helmet", true], body: ["Shoulder Pads", false], legs: ["Football Trousers", false], feet: ["Cleats", false] },
  firelord: { head: ["Firelord Helm", true], body: ["Firelord Plate", false], legs: ["Firelord Greaves", false], feet: ["Firelord Boots", false] },
  pumpkin: { head: ["Pumpkin Head", true], body: ["Tattered Robe", false], legs: ["Ragged Trousers", false], feet: ["Buckled Boots", false] },
  highroller: { head: ["High Roller Hat", false], body: ["Pinstripe Jacket", false], legs: ["Pinstripe Trousers", false], feet: ["Dress Boots", false] },
  chicken: { head: ["Chicken Head", true], body: ["Chicken Body", false], legs: ["Chicken Legs", false], feet: ["Chicken Feet", false] },
  /* hidesHair is true only for things that really cover the head. A helm does; a cap, a headband and a visor do
     not, and hiding the hair under them leaves a bald person wearing a hairband. */
  gladiator: { head: ["Crested Helm", true], body: ["Gilded Cuirass", false], legs: ["Battle Skirt", false], feet: ["Strapped Sandals", false] },
  sakura: { head: ["Ribbon Band", false], body: ["Sailor Top", false], legs: ["Pleated Skirt", false], feet: ["Knee Boots", false] },
  neon: { head: ["Runner's Visor", false], body: ["Racing Jacket", false], legs: ["Circuit Trousers", false], feet: ["High-Tops", false] },
  scrapking: { head: ["Trucker Cap", false], body: ["Work Vest", false], legs: ["Oil-Stained Jeans", false], feet: ["Steel Toes", false] }
})) for (const [slot, [name, hidesHair]] of Object.entries(pieces)) VANITY[`${set}_${slot}`] = { set, slot, name, hidesHair, price: VANITY_PRICE[slot] };

export const vanityPrice = (key) => VANITY[key]?.price || 0;
export const setPrice = (set) => VANITY_SLOTS.reduce((n, s) => n + (VANITY[`${set}_${s}`]?.price || 0), 0);
/** What a character is wearing, cleaned: only real items, only in their own slot, only colours that exist. */
export function normVanity(v) {
  const out = { head: null, body: null, legs: null, feet: null }, col = { head: 0, body: 0, legs: 0, feet: 0 };
  if (v && typeof v === "object") for (const s of VANITY_SLOTS) {
    const k = String(v.on?.[s] || ""); if (VANITY[k] && VANITY[k].slot === s) out[s] = k;
    const c = Math.trunc(Number(v.col?.[s])); if (Number.isInteger(c) && c >= 0 && c < VANITY_COLS.length) col[s] = c;
  }
  return { on: out, col, own: Array.isArray(v?.own) ? [...new Set(v.own.map(String).filter((k) => VANITY[k]))].slice(0, 200) : [] };
}
/** The compact form the roster carries and the sprite cache is keyed on: "" when nothing is worn. */
export const vanityKey = (v) => (v ? VANITY_SLOTS.map((s) => (v.on?.[s] ? `${v.on[s]}:${v.col?.[s] || 0}` : "")).join(",").replace(/,+$/, "") : "");
export const wearsVanity = (v) => VANITY_SLOTS.some((s) => v?.on?.[s]);
export const SLOTS = ["helm", "amulet", "weapon", "body", "shield", "legs", "gloves", "boots", "ring", "pet"];
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
  { key: "onyx",        name: "Onyx",        gate: 50, set: 76, wAcc: 24, wStr: 22, jewel: 8, mark: "⬛", ex: "Black all the way through. Light goes in and does not come back out." },
  /* (v121) TWO TIERS ABOVE ONYX, because the ceiling had come into view: the hardest monster in the game was the House at 70
     and Onyx was the last thing to wear, so a player past about 50 had nothing left to climb toward while the skills run to
     99. The ladder keeps its own arithmetic — gate +10, set +14, weapon +4/+4 — so nothing about the curve is a new rule,
     there is simply more of it. They drop in the two new areas and nowhere else. */
  { key: "starfall",    name: "Starfall",    gate: 60, set: 90,  wAcc: 28, wStr: 26, jewel: 10, mark: "☄️", ex: "Fell out of the Thunderhead one night and was still warm in the morning. Nobody saw it land." },
  { key: "eclipse",     name: "Eclipse",     gate: 70, set: 104, wAcc: 32, wStr: 30, jewel: 12, mark: "🌑", ex: "Forged in the dark at the bottom of the Vault. It weighs nothing and it is very cold." }
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

/* ------------------------------------------------- THE TOOL LADDER (2026-09-22)

   Mining, Woodcutting and Fishing each ran the whole game on one bronze tool, so the only thing a skill level ever
   bought was permission — the swing never got faster and nothing was ever out of reach for want of kit. Seven rungs
   each, one per gear tier, and a node now asks for a tool as well as a level.

   THE RUNG IS DERIVED FROM THE NODE'S OWN LEVEL (toolNeed, below) and is never written on a node. Every gathering
   spot in the game already carries `req: { skill, lvl }`; a second field saying "and an emerald pickaxe" would be
   the same fact in two places, and the day someone moved a rock's level the two would disagree. So the rungs sit on
   the same gates the ore does — 1, 20, 30, 40, 50, 60, 70 — and any node added later is gated correctly for free.

   A tool's OWN requirement is that same level, so a rung never locks out anyone who could already work the node: if
   you can mine emerald ore at Mining 20 you can hold the emerald pickaxe that mines it.

   What the rungs buy is SPEED (tspd, 8% a rung). Tools stay poor weapons on purpose — the eclipse pickaxe swings
   for less than a bronze sword — because a mining trip should not also be the best way to fight.
*/
export const TOOL_KINDS = {
  pickaxe: { skill: "mining",      noun: "pickaxe", icon: "⛏️", short: "Pickaxe", acc: 1, str: 1 },
  axe:     { skill: "woodcutting", noun: "axe",     icon: "🪓", short: "Axe",     acc: 2, str: 2 },
  rod:     { skill: "fishing",     noun: "rod",     icon: "🎣", short: "Rod",     acc: 0, str: 0 }
};
/* The rungs, low to high. Bronze is 1 and not the gear tier's 10: a starting bag holds a bronze pickaxe and the
   Yard's copper is Mining 1, so anything higher would make the tutorial's own rock unmineable. */
export const TOOL_GATES = TIERS.map((t, i) => (i ? t.gate : 1));
/* The rungs as their own list. A rung is NOT its gear tier: bronze gear gates at melee 10 while the bronze pickaxe
   gates at 1, and comparing a rung against TIERS[i].gate is what made the Yard's own copper unmineable in testing. */
export const TOOL_RUNGS = TIERS.map((t, i) => ({ key: t.key, name: t.name, mark: t.mark, gate: TOOL_GATES[i] }));
for (const [i, t] of TIERS.entries()) {
  if (!i) continue;                                  // bronze is the three plain keys above
  for (const [kind, w] of Object.entries(TOOL_KINDS)) {
    ITEMS[`${t.key}_${kind}`] = {
      name: `${t.name} ${w.noun}`, short: w.short, icon: w.icon, slot: "weapon",
      tool: w.skill, tier: t.key, tlvl: t.gate, tspd: 1 + i * 0.08,
      acc: w.acc && w.acc + i, str: w.str && w.str + i,
      req: { skill: w.skill, lvl: t.gate },
      ex: `${t.ex} It works everything up to the depth ${t.name.toLowerCase()} is found at, and works it ${i * 8}% faster.`
    };
  }
}
/** The rung a node of this level asks for: the highest gate at or below it. A pure function of the node's own req. */
export const toolNeed = (lvl) => { let i = 0; for (const [n, g] of TOOL_GATES.entries()) if (g <= (lvl || 1)) i = n; return TOOL_RUNGS[i]; };
/* (2026-09-22) YOU HOLD THE TOOL. ALL THREE. The owner, testing: "i can hit tin and copper ore without a pickaxe.
   world wide, all ore / trees / fishing spots MUST require their proper tools."

   This reverses the rule of 2026-09-20, which let a tool in the BAG count as a tool in the hand so that nobody had
   to learn to wield a pickaxe to go and earn ten dollars. That was a kindness when a tool was a single item you
   either owned or did not; with seven grades of each it made the weapon slot free — you could fight with a sword
   and mine with whatever was in your bag, and the ladder cost you nothing to carry. Holding it is what makes the
   slot a decision.

   It also closes the hole the owner found: a pickaxe at the bottom of the bag let you swing at a rock with a sword
   in your hands, which looks exactly like mining with no pickaxe at all.

   ONE SET, read by the server, the wiki and the hover line, so the three can never disagree. Emptying it restores
   the old behaviour everywhere at once. */
/* HOW MUCH ORE IS IN A ROCK (2026-09-22, the owner: "make all ores across all worlds give 1-5 ore before they
   expire"). A rock used to give exactly ONE and then go empty for eight seconds AND clear your action, so mining
   was a click per ore with a wait after it - measured at 720 an hour in most zones against fishing's 1,246, and the
   reason mining sat three times behind everything else. A rock now holds a few, rolled fresh each time it refills,
   so you stand and work it the way you work a tree or a fishing spot. The empty time is unchanged. */
export const ORE_IN_ROCK = [1, 5];
export const TOOL_HELD = new Set(["mining", "woodcutting", "fishing"]);
/* (2026-09-22) WHAT A TOOL IS FOR, in one sentence and in ONE PLACE. The Prize Counter had "you need one to fish"
   written into the row it draws, from when the rod was the only tool on the shelf; the day the bronze pickaxe and
   axe joined it, both of them said it too. Anything showing a tool asks here instead. */
const TOOL_FOR = { mining: "to mine", woodcutting: "to cut trees", fishing: "to fish" };
export const toolUse = (it) => {
  const sk = it?.tool; if (!sk) return "";
  const what = TOOL_FOR[sk] || `for ${SKILLS[sk]?.name || sk}`;
  return TOOL_HELD.has(sk) ? `you have to be holding one ${what}` : `you need one ${what}`;
};
/** A tool's own line for a tooltip: how far up it works, and what it saves. */
export const toolSpec = (it) => {
  if (!it?.tool) return "";
  const rung = TOOL_RUNGS.findIndex((r) => r.key === it.tier), next = TOOL_RUNGS[rung + 1];
  return `${toolUse(it)}; works ${next ? `up to level ${next.gate - 1}` : "at any level"}${rung > 0 ? `, ${rung * 8}% faster` : ""}`;
};
/** The best tool this character has for a skill: the hand first, then the bag unless the skill wants it held. */
export function bestTool(c, skill) {
  let best = null, bn = -1;
  /* Same tier, one reforged: pick the reforged one. Strict > used to keep whichever was seen first, so a +3 axe in
     the bag lost to the plain one on your back. Tiers still win outright - 3 levels is under a rung by design. */
  const look = (k) => { const it = ITEMS[k]; if (it?.tool !== skill) return; const n = (it.tlvl || 1) + forgeLevel(c, k) * 0.001; if (n > bn) { bn = n; best = k; } };
  look(c?.eq?.weapon);
  if (!TOOL_HELD.has(skill)) for (const st of c?.inv || []) look(st.k);
  return best;
}
/** Can they work a node of this level? -> null, or { have, need, held } naming what they are short of.
    `held` says the trouble is WHERE the tool is, not which one: they own one, it is good enough, it is in the bag. */
export function toolBlock(c, skill, lvl) {
  const need = toolNeed(lvl), have = bestTool(c, skill);
  if (!have) {
    const bagged = TOOL_HELD.has(skill) && (c?.inv || []).some((st) => ITEMS[st.k]?.tool === skill);
    return { have: null, need, held: bagged };
  }
  return need.gate <= 1 || (ITEMS[have].tlvl || 1) >= need.gate ? null : { have, need, held: false };
}
/** What reforging adds to a tool, as a fraction of speed: +2.5% a level, nothing on anything that is not a tool. */
export const forgeSpeed = (c, key) => (isTool(key) ? forgeLevel(c, key) * FORGE.tspd : 0);
/** How much faster the tool works. 1 with nothing, up to 1.48 at the top rung, plus any reforge on THAT tool. */
export const toolSpeed = (c, skill) => { const k = bestTool(c, skill); return k ? (ITEMS[k].tspd || 1) + forgeSpeed(c, k) : 1; };

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
  smithing: { name: "Smithing", icon: "🔨" },
  agility: { name: "Agility", icon: "🤸" }
};
export const COMBAT_SKILLS = ["melee"];
// how the skills panel groups them. Hitpoints sits with combat because that is
// the only place it is earned, even though it is not something you choose.
export const SKILL_GROUPS = [
  { name: "Combat", keys: ["melee", "hp"] },
  { name: "Skilling", keys: ["fishing", "cooking", "farming", "woodcutting", "mining", "smithing", "agility"] }   /* (v121) woodcutting, mining and smithing are back on the panel: every map has choppable trees again (1-2 a level, the owner's ask) and the Vault put the last two ore seams in the world, so the three of them lead somewhere once more. */
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
/* STANCES WERE REMOVED ON 2026-09-19 and this is what is left of them: ONE entry, kept only because
   xpForDamage() reads a share table and DEFAULT_STANCE indexes into this.

   It used to hold four — Accurate, Aggressive, Defensive, Controlled — each with a blurb promising "Attack xp",
   "Strength xp" and so on. Those three skills no longer exist (a migration folded them back into `melee`), the
   server's `case "stance"` does nothing but `return`, and stanceOf() ignores its argument. The blurbs survived
   anyway and were still on four buttons in the Skills tab that changed nothing when clicked — and they were
   convincing enough that a wiki page got written from them on 2026-09-23 describing a feature the game has not
   had for four days. If you are adding combat depth, build it; do not restore this. */
export const STANCES = {
  controlled: { name: "Combat", icon: "\u2694\uFE0F", share: { melee: 1 }, blurb: "Every hit trains Combat, and Hitpoints alongside it." }
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
/* (2026-09-22) `c` is the OWNER, and it is optional on purpose: a pet can give bag room, and the only way to know
   about it from an inv array is to be handed the character too. Left out, you get the plain INV_MAX — which can
   only ever under-fill a bag, never over-fill one, so an un-updated caller is safe rather than wrong. */
/* (2026-09-22) BOUGHT SLOTS. Five of them, at Bom's counter, at rising prices — a TICKET SINK, which is the point:
   the counter's cash-out is a conversion (tickets become ZCoins) and the only true sinks were one-off, so once you
   owned the gear and the vanity there was nowhere left to spend.

   FIVE AND NO MORE, and small ones, on purpose. INV_MAX was cut from 30 to 20 on 2026-09-20 so the bag FILLS and
   you walk back past the tables to the Cashier — that walk is the casino's whole geography. Selling your way out
   of it would undo a deliberate decision; five slots over a million tickets does not. With a Pack Rat's four on
   top the ceiling is 29, which is a tenth under the old 30 and takes both a rare pet and the full ladder.

   The prices are the owner's (2026-09-22): about half an hour of top-end farming for the first and roughly ten
   hours for all five, or two days of daily jobs rising to over a month. */
export const BAG_UPGRADES = [50000, 100000, 200000, 300000, 400000];
/** What the next slot costs, or null when they have them all. */
export const bagUpCost = (c) => BAG_UPGRADES[Math.min(BAG_UPGRADES.length, Math.max(0, (c?.bagUp | 0)))] ?? null;
export const bagMax = (c) => INV_MAX + (c ? petFx(c).slots + (achFx(c).slots | 0) + Math.min(BAG_UPGRADES.length, c.bagUp | 0) : 0);   /* achFx: the two pockets the milestones give */
export const roomFor = (inv, k, c = null) => {
  const cap = capOf(k), free = bagMax(c) - inv.length;
  if (cap === Infinity) return inv.some((s) => s.k === k) || free > 0 ? Infinity : 0;
  return inv.reduce((r, s) => r + (s.k === k ? Math.max(0, cap - s.n) : 0), 0) + free * cap;
};
// top up the stacks already there, then open new ones; returns what didn't fit
export const addInv = (inv, k, n, c = null) => {
  const cap = capOf(k);
  for (const s of inv) { if (n <= 0) break; if (s.k === k && s.n < cap) { const t = Math.min(n, cap - s.n); s.n += t; n -= t; } }
  while (n > 0 && inv.length < bagMax(c)) { const t = Math.min(n, cap); inv.push({ k, n: t }); n -= t; }
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
/* ============================================================ AGILITY (2026-09-22)
   The first skill you play rather than click. A course of GATES: tiles that open and shut on a fixed cycle, and you
   cross when yours is open. No physics and no new movement — the engine is tile-locked at STEP_MS and that is exactly
   the right grain for "did you step at the right moment" rather than "can you land an eight-pixel jump".

   THE CYCLE IS A PURE FUNCTION OF THE CLOCK, so the server can gate movement and the page can draw the same thing
   without a byte crossing the wire for it. Every snapshot already carries the server's `t`, which is what keeps the
   two honest; the page must use THAT clock, never its own, or it will draw a gate open that the server has shut.

   WHAT IT PAYS. Agility feeds `extra` in stepMsOf, the same hook meals and the speed test already use, so it lands
   inside SPEED_FULL/SPEED_CAP's diminishing returns and can never stack past the existing ceiling. At 99 it is
   AGIL_SPEED% raw — a real reward for a whole skill, and still bounded by a cap that was designed before it. */
export const AGIL_SPEED = 10;                     // raw speed % at level 99, before SPEED_FULL/SPEED_CAP soften it
export const agilBonus = (c) => (AGIL_SPEED * (lvlOf(c, "agility") - 1)) / 98;
/* A gate's cycle: `ms` long, open for `open` of it, started `at` into the cycle. Deterministic, so a run can be judged. */
export const gateOpenAt = (t, g) => ((t + g.at) % g.ms) < g.open;
/* WHICH TILES A GATE COVERS. It must span the WHOLE lane: the gates were two tiles tall against a three-tile lane,
   so the bottom row was a permanent gap and you could stroll round every shutter. One definition, used by the
   server to gate the step and the page to draw it, so the two can never disagree about how tall a gate is. */
export const AGIL_LANE = [11, 12, 13];
export const gateTiles = (g) => AGIL_LANE.map((y) => [g.x, y]);
/** How long until this gate's state flips — what the page uses to fade a tile rather than snap it. */
export const gateFlipIn = (t, g) => { const p = (t + g.at) % g.ms; return p < g.open ? g.open - p : g.ms - p; };
/* Eight shutters down the corridor, quickening as you go: 2.4s a cycle at the start, 1.2s at the end, each open for
   just under half of it. `at` staggers them so a runner cannot simply hold one rhythm the whole way. */
export const AGIL_GATES = [
  { x: 5,  y: 11, ms: 2400, open: 1150, at: 0 },
  { x: 9,  y: 11, ms: 2200, open: 1050, at: 700 },
  { x: 13, y: 11, ms: 2000, open: 950,  at: 1400 },
  { x: 17, y: 11, ms: 1800, open: 850,  at: 300 },
  { x: 21, y: 11, ms: 1650, open: 780,  at: 1100 },
  { x: 25, y: 11, ms: 1500, open: 700,  at: 500 },
  { x: 29, y: 11, ms: 1350, open: 640,  at: 1600 },
  { x: 33, y: 11, ms: 1200, open: 580,  at: 900 }
];
/* (2026-09-22) WHAT MAKES IT A SKILL AND NOT A QUEUE. Before this a gate was something you stood in front of until
   it opened: there was no way to be GOOD at The Run, only patient. Two things changed that.

   PERFECT: crossing within PERFECT_MS of a gate opening pays extra, and the count carries through the run — a
   flawless lap doubles what the finish pays. The window is generous on purpose (a quarter of a second, against a
   200ms step) because the course is played over a websocket and a player on 80ms should not be locked out of it.

   MARKS: MARKS_PER_RUN pickups are scattered down the lane at the start of every run. They pay tickets and agility
   xp, and they are placed off the middle row, so taking one costs you a beat and possibly the gate you were lined
   up for. That is the whole design: every run is a choice between a fast lap and a rich one. */
export const AGIL_PERFECT_MS = 260;
export const AGIL_MARKS = 3;
export const AGIL_XP = { gate: 12, finish: 150, perfect: 10 };  // per gate crossed, for reaching the end, and for crossing one the moment it opens
/* ============================================================ PETS (2026-09-22)
   A pet is the one thing in the game that is an INSTANCE, not a stack. Everything else in a bag is {k, n} — a key and
   a count — which has nowhere to put a name, cannot tell two of a kind apart, and could not carry a name to a buyer.
   So pets live in their own list on the character, `c.pets = [{ id, k, name }]`, and the slot holds an ID rather than
   an item key. That is the whole reason this costs more than a hat.

   ONE STRONG EFFECT EACH, not four. One slot, a 1-in-1000 drop and every bonus at once is an enormous spike for
   whoever gets lucky first; four specialists and one generalist give a reason to own several and swap instead.
   Speed goes through the same `extra` hook Agility and meals use, so it lands inside SPEED_FULL/SPEED_CAP and can
   never stack past a ceiling that was set before pets existed. */
export const PETS = {
  bonepup:     { name: "Bonepup",      art: "pet_bonepup",     fx: { speed: 8 },  ex: "It buried something. It will not say what." },
  packrat:     { name: "Pack Rat",     art: "pet_packrat",     fx: { slots: 4 },  ex: "Carries your things. Keeps some." },
  cointoad:    { name: "Coin Toad",    art: "pet_cointoad",    fx: { tix: 15 },   ex: "Sits on what it finds. Warm to the touch." },
  lanternmoth: { name: "Lantern Moth", art: "pet_lanternmoth", fx: { hp: 15 },    ex: "It keeps the dark an arm's length off." },
  housecat:    { name: "House Cat",    art: "pet_housecat",    fx: { speed: 3, slots: 1, hp: 5, tix: 5 }, ex: "Wears the visor. Owns the room." }
};
export const PET_KEYS = Object.keys(PETS);
/* (2026-09-22) "trailer" was missed when the Trailer Park was built: every zone from the Boneyard (level 30) up
   drops pets, and the newest and hardest of them — 80 to 98 — was the only one that did not. An oversight, not a
   decision. ANY monster in these scenes rolls PET_DROP, so a new zone needs adding here and nowhere else. */
export const PET_SCENES = new Set(["boneyard", "cloud", "thunderhead", "vault", "wild", "deep", "trailer"]);   // the 4th outdoor map and beyond
export const PET_DROP = 0.001;                 // 1 in 1,000, in the Boneyard and beyond
export const PET_NAME_MAX = 16;
/** A pet name that is safe to draw over somebody's head. Empty means "use the kind's own name". */
export const cleanPetName = (s) => String(s || "").replace(/[\u0000-\u001f<>&"']/g, "").replace(/\s+/g, " ").trim().slice(0, PET_NAME_MAX);
export const petsOf = (c) => (Array.isArray(c?.pets) ? c.pets.filter((p) => p && PETS[p.k]) : []);
export const petById = (c, id) => petsOf(c).find((p) => p.id === id) || null;
/** The one at your heel, or null. The slot holds an id, so a pet that was sold or banked simply stops applying. */
export const activePet = (c) => (c?.eq?.pet ? petById(c, c.eq.pet) : null);
export const petLabel = (p) => (p ? (p.name || PETS[p.k].name) : "");
/** Every bonus the worn pet gives, or zeroes. One place, so nothing has to remember the shape. */
export function petFx(c) {
  const p = activePet(c), fx = p ? PETS[p.k].fx : null;
  return { speed: fx?.speed || 0, slots: fx?.slots || 0, hp: fx?.hp || 0, tix: fx?.tix || 0 };
}
export const STEP_MS = 200 /* (v95, the owner: "make users default walk speed about 20% faster": it was 240. Players only: monsters, NPCs and the fake players keep the server's own 240.) */, SPEED_FULL = 20, SPEED_CAP = 50;
/* (2026-09-22) AGILITY IS PAID HERE. agilBonus was written the day the skill was built and never called from
   anywhere, so every level of it did precisely nothing — which is most of why The Run felt like a treadmill. It
   goes in with the meals and the boots rather than beside them, so it lands inside SPEED_FULL/SPEED_CAP's
   diminishing returns and cannot stack past a ceiling that was designed before the skill existed. */
export function speedRaw(c, extra = 0) { let raw = extra + petFx(c).speed + agilBonus(c); for (const k of Object.values(c.eq || {})) if (k && ITEMS[k]?.spd) raw += ITEMS[k].spd; return raw; }   /* eq.pet is an id, not an item key, so the loop below skips it and petFx adds it instead */
export function speedBonus(c, extra = 0) { const raw = speedRaw(c, extra); return Math.max(0, Math.min(SPEED_CAP, Math.min(SPEED_FULL, raw) + Math.max(0, raw - SPEED_FULL) * 0.5)); }
export const stepMsOf = (c, extra = 0) => Math.round(STEP_MS / (1 + speedBonus(c, extra) / 100));
/* (2026-09-22) THE NUMBER, FOR READING. Every speed source used to be a whole number, so the stat panel could print
   speedBonus() raw; agility is a fraction of a percent per level and the panel started showing
   "+0.40816326530612246%". Rounded HERE and not in speedBonus, because that one is the real number stepMsOf divides
   by — rounding the maths to make a label tidy would be a quiet change to how fast everyone walks. At most two
   decimals, and no trailing zeros, so a whole number still reads as a whole number. */
export const speedText = (c, extra = 0) => String(Math.round(speedBonus(c, extra) * 100) / 100);
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// fishing reaches two tiles (the river's edge is a bank you can't stand on); everything else is next to you
export const reachOf = (kind) => (kind === "spot" ? 3 : kind === "ferry" ? 2 : 1);   /* (v106) a rod reaches THREE: the bank row ("b") between the grass and the water can't be stood on, so the water's second row, where v105 put some of the scattered spots, was one tile out of reach and couldn't be fished. tools/eastscape-content-check.mjs now proves every spot can be reached. */
/** Where a recipe is made, in words, for the wiki and the anvil list. */
export const stationName = (id) => STATIONS[RECIPES[id]?.station]?.name || "";
export const inReach = (a, b, r) => { const d = cheb(a, b); return d >= 1 && d <= r; };

/* ------------------------------------------------------------ building scenes
   grid: . grass  , path  ~ water  s sand  p paving  P paved but blocked  b bank (water reaches it; nobody stands there)
         f soil: a picked wheat tile, walkable until the wheat grows back
         i indoor floor   v the dark outside a room (never walkable)
         # blocked by something  e exit (blue) */
const grid = (fill = ".") => Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
/* (v105) FISHING SPOTS, SCATTERED (the owner, 2026-09-21: "randomize the fishing spots layouts ... they're currently all in a row and it looks stock").
   Every body of water is fished from its north bank and a rod reaches three tiles (reachOf: one of them is the bank row nobody can stand on), so a spot
   may sit in the first OR the second row of water. n spots over the water's columns, never crowding each other, by a hash of the water's own position: no dice are
   rolled, so the game server and every page lay them out identically. `looks` is which pictures this water uses (o_spot1..5: ripples,
   bubbles over a school, lily pads, a whirlpool with a fin, reeds); which one a spot wears is fixed by where it is. */
const scatterSpots = (objs, x0, x1, y0, n, looks, props) => {
  let got = [];   // a few tries: the first layout that fits all n AND isn't evenly spaced (an even row is what this replaced)
  for (let k = 0; k < 60; k++) { const seed = x0 * 31 + y0 + k * 101, tryGot = []; for (let i = 0; tryGot.length < n && i < 200; i++) { const x = x0 + Math.floor(hashRand(i, seed, 3) * (x1 - x0 + 1)), y = y0 + (hashRand(i, seed, 7) < 0.45 ? 1 : 0); if (!tryGot.some(([a, b]) => Math.abs(a - x) < (b === y ? 3 : 2))) tryGot.push([x, y]); }   /* (three columns apart in the same row, two if they are staggered: the pictures are a tile and a bit wide) */
    const xs = tryGot.map(([x]) => x).sort((p, q) => p - q), gaps = new Set(xs.slice(1).map((x, i) => x - xs[i])); if (tryGot.length > got.length) got = tryGot; if (tryGot.length === n && gaps.size > 1) { got = tryGot; break; } }
  got.sort((a, b) => a[0] - b[0]); for (const [x, y] of got) objs.push({ t: "spot", x, y, ...props, look: looks[Math.floor(hashRand(x, y, 11) * looks.length)] });
};
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
/* THE JUKEBOX IS REAL (v86, the owner: "make it an actual interactive jukebox"). One station for the whole casino: whoever is at the
   jukebox picks, everyone on a casino floor hears it, each with their own volume and mute.
   THE DIRECTORY IS RADIO BROWSER (api.radio-browser.info), NOT RADIO GARDEN. The owner asked for Radio Garden's API; it is an
   unofficial spec of a private API that answers anything but their own site with a Cloudflare bot challenge (403), and getting
   round bot protection is not something we do. Radio Browser is the open equivalent, made for apps: no key, cross-origin
   allowed, tens of thousands of stations, https streams. The PAGE searches it directly; to change the room's station it sends
   only the station's UUID, and the GAME SERVER looks that UUID up itself and takes the name and stream address from the
   directory, never from the player: what gets played into other people's speakers is always a real listed https station.
   A change needs you at the jukebox, and the room can change station once every RADIO.everyMs. */
/* (v88, the owner: "put a jukebox copy... near the entrance of the yard, so users can play music and grind as well". It is the SAME
   station, not a second one: RADIO.heard is every scene with a jukebox in it, the station plays in all of them, and any of
   the jukeboxes changes it for everybody. One room, one DJ, wherever you are standing.) */
/* (v89, the owner: "emulate a real jukebox... someone has to pay 100 to play the jukebox that everyone else hears") IT TAKES TICKETS.
   RADIO.cost from your bag puts a station on, charged only once the station is known to play. What you paid for is YOURS for
   RADIO.holdMs: nobody else can change it or switch it off until then (you can, and an admin can). After that it keeps playing
   until somebody else pays. No refunds, like the real thing. */
/* SONGS (v96, the owner: "go, build the songs tab on the jukebox"). The jukebox plays a SONG YOU CHOSE as well as a station: RADIO.song.cost
   tickets puts one YouTube video in the queue, and everyone in a RADIO.heard scene hears it together. The game server owns the
   queue: it asks the site's music worker for the video's real title and length (RADIO.song.facts, one quota unit, cached a day)
   BEFORE taking a ticket, refuses live streams, things that can't be embedded and anything outside minSec..maxSec, and tells the
   room { id, at }: every browser seeks its player to (now - at), which is the whole of the sync. A song in the queue can't be
   jumped or removed by anybody but its buyer or an admin. While a song plays the station waits, and comes back after. */
export const RADIO = { song: { cost: 50, minSec: 20, maxSec: 8 * 60, queue: 10, each: 2, gapMs: 1500, facts: "https://eastcoin-music-room.jake-7f5.workers.dev/video?id=", search: "https://eastcoin-music-room.jake-7f5.workers.dev/search?q=" },
  cost: 100, holdMs: 10 * 60 * 1000, /* (2026-09-22, the owner: "can we make the radio music from the jukebox play in every map") THE JUKEBOX FOLLOWS
     YOU NOW, the same way the Green Room already did. `heard` is kept rather than deleted because it is still the
     honest record of where a jukebox physically stands, and flipping `everywhere` back is how you undo this
     without having to remember the list. Nothing else changed: the Green Room still takes precedence when a song
     is on, your volume and mute still apply, and there is still only one station for the whole world - there is no
     jukebox out in the Wilderness to change it at, so you take whatever the Yard put on. */
  everywhere: true,
  heard: ["casino", "roulette", "fightpit", "highroller", "workyard", "tower"]   /* (2026-09-22, owner) the Tower too, if you want it: a scene key is matched on the part before its ":", so "tower" covers every climber's private "tower:<id>" room. There is no jukebox up there to change the station at - you take whatever the Yard put on, which is the point of one station for the whole place. */, hosts: ["de1.api.radio-browser.info", "fi1.api.radio-browser.info", "de2.api.radio-browser.info"], everyMs: 20000,
  genres: [["Classic rock", "classic rock"], ["Country", "country"], ["Hip-hop", "hip hop"], ["80s", "80s"], ["90s", "90s"], ["Sports talk", "sports"], ["Lo-fi", "lofi"], ["Oldies", "oldies"]] };
/* THE FLOOR IS SHARED (v81, the owner: "this is a community focused game/casino, lets keep fun first and foremost").
   EMOTES: five things to say with one tap, for people with a beer in the other hand. They float over your head for everyone
   in the room, like a chat line, and never reach the chat log.
   BIG-WIN CALLOUTS: a win of CALLOUT.min times the stake or better, at any table, is told to every casino floor, and confetti
   goes off over the winner if you can see them. HONEST LIMIT: the real tables belong to eastcoin.vip and the game server never
   sees their results, so a callout is the player's own window saying "I just hit 25x". It is decoration and nothing else:
   bounded (min..max), only from a casino floor, one per CALLOUT.everyMs, names from CALLOUT.games. It moves no tickets and no
   ZCoins, and the site's own ledger is the record of what really happened. */
export const EMOTES = { cheers: "🍻", gg: "GG", gz: "GZ" /* (v101, the owner asked for it: congratulations, in two letters) */, rip: "🪦", wave: "👋", dance: "💃" };
export const CALLOUT = { min: 10, max: 500, everyMs: 10000, games: ["Coin Flip", "Wheel", "Dice", "Slots", "Plinko", "Scratch-Off", "Higher or Lower", "Mines", "The Fight Pit", "Roulette"] };
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
/* THE ROAD ISN'T ALWAYS WEST (v84, the owner: "currently all maps are just go west west west... as im playing through it, i just
   click left. there needs to be some randomization of where the next level's entrance is"). The way ON out of a scene is now
   north from the Yard, west from the Gloam, north from the Mire, north (up) from the Boneyard, west from Cloudreach. Every
   scene's way BACK is still its east edge, so nothing was moved that didn't sit on a new path, and no pond was touched: the
   game server drops you at whichever edge of the next scene leads back where you came from (not blindly the opposite side).
   NORTH_ROAD lays the branch: a path up column 22 from the main road to the top edge, kept clear of trees. */
const NORTH_ROAD = (g, keep) => { for (let y = 0; y <= 13; y++) { g[y][22] = ","; for (const x of [21, 22, 23]) keep.push([x, y]); } };
export const SCENES = {
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
      /* (v103) THE CRYPT's stairway, beside the bank: a party dungeon. Everything about it is in eastscape-crypt-rules.js, which is NOT part of the first load. */
      objs.push({ t: "cryptdoor", x: 14, y: 6, name: "Stairs down to the Crypt: bring a party" }); g[6][14] = "#";
      objs.push({ t: "rock", ore: "stardust", x: 6, y: 19, name: "Fallen Star", special: true, glow: "#e0b0ff", req: { skill: "mining", lvl: 50 }, xp: 150, tease: "It landed during the games last spring. Nobody's managed to chip it yet." }); g[19][6] = "#";
      for (const [x, y] of [[16, 9], [27, 9], [15, 18], [28, 17], [19, 20]]) { objs.push({ t: "bush", x, y, name: "Planter" }); g[y][x] = "#"; }
      for (const [x, y] of [[14, 12], [29, 13]]) { objs.push({ t: "bench", x, y, w: 3, h: 1, name: "Bench" }); block(g, x, y, 3, 1); }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "#" && paved[y][x] === "p") g[y][x] = "P";
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, keepOf(this), 4);
      return { g, objs, blobs: [] };
    },
    mobs: [],
    npcs: [
      { name: "Livia the Broker", art: "livia", x: 12, y: 16, still: true, opens: "exchange", reach: 2, hair: "#2a1a10", shirt: "#c89a2a", pants: "#3a2a1a", lines: ["Buying? Selling? Use the stall. I take 1%.", "It keeps selling while you sleep."] },
           { name: "Charon the Ferryman", art: "charon", x: 18, y: 21, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Islands. Everyone gets one. Nobody knows who's paying for them.", "The river's closed, so now it's a cart. Don't ask how a cart gets to an island. I don't.", "Plant something before you go back in there and lose your shirt. It grows while you're away.", "Wheat, ten minutes. Tomatoes, twenty. Both sell. Both cook."] },
           { name: "Gaius", art: "gaius", x: 25, y: 15, hair: "#5a3a2a", shirt: "#9a3a5a", pants: "#3a2a3a", pigeon: true, lines: ["PIGEON: He doesn't talk. I do. Coo.", "PIGEON: Casino's that way. Everything's that way. Coo."] }],
    bots: [{ name: "Gannicus", level: 55 }, { name: "Naevia", level: 31 }]
  },
};
// where a brand-new character appears: just outside the farmhouse door
Object.assign(SCENES, {
  // north of the Forum: a hill of tomato vines, a giant tomato, and a Nonna who insists on the spelling
  // west of the Olive Grove: a wood where it is always five minutes before dark. Levels 20-38.
  /* THE SKILLING LINE runs west from the casino: the Workyard, then the Gloam, then Cloudreach. Same three jobs at
     every stop (rock, wood, fish), worth more the further out you go, and gated by level so there is somewhere to
     be heading. No monsters on this line (2026-09-20): fighting is the other arch. */
  gloam: {
    name: "The Gloam", ground: "gloam", exits: { e: "workyard", w: "mire" }, tint: "rgba(8,30,48,.32)",
    build() {
      const g = grid(), objs = [], keep = [];
      /* (v122) woodcutting's second step. Every map has had choppable trees all along; these are the tiered ones, so the skill pays better as you go out further instead of paying `logs` forever. */
      /* (2026-09-22) one ore per tier, on the map whose level band matches it. `rock`, not `vein`, because the art is
         o_rock_<ore> and that is what exists for every middle tier; o_vein_* is only drawn for copper. */
      for (const [x, y] of [[5, 17], [8, 18]]) { objs.push({ t: "rock", x, y, ore: "emerald_ore", name: "Emerald rock", req: { skill: "mining", lvl: 20 }, xp: 40 }); g[y][x] = "#"; }
      for (const [tx, ty] of [[6, 6], [30, 19]]) { objs.push({ t: "willow", x: tx, y: ty, log: "willowlogs", name: "Gloomwillow", req: { skill: "woodcutting", lvl: 15 }, xp: 120 }); g[ty][tx] = "#"; }
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 18; y++) g[y][19] = ",";
      // the black pond, fished from its north bank: trout from Fishing 10, catfish from 15
      for (let y = 20; y <= 23; y++) for (let x = 13; x <= 25; x++) g[y][x] = "~";
      scatterSpots(objs, 13, 25, 20, 5, [1, 2, 3, 5], { name: "Black pond", req: { skill: "fishing", lvl: 10 }, fish: "trout", fish2: "catfish", fish2lvl: 15, xp: 50, xp2: 65, glow: "#7ad8ff", tease: "Something heavy turns over under the black water. Fishing 10, the sign says." });
      for (let x = 12; x <= 26; x++) keep.push([x, 19], [x, 18]);
      objs.push({ t: "fire", x: 21, y: 16, name: "Campfire" }); g[16][21] = "#";   // somewhere to stand
      /* (2026-09-22) THE WAY DOWN. The Wilderness's only entrance was a hole on the farm, which is a CLOSED area, so
         once the farm shut there was no way in at all. This is the same `hole` kind — same WILD_REQ check, same
         are-you-sure — just a rope ladder instead, out on the Gloam where a level 10 can reach it. */
      objs.push({ t: "wildladder", x: 7, y: 19, name: "Rope ladder: down into the Wilderness" }); g[19][7] = "#";
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
    name: "The Lantern Mire", ground: "gloam", exits: { e: "gloam", n: "boneyard" }, tint: "rgba(14,52,22,.34)",
    build() {
      const g = grid(), objs = [], keep = [];
      /* (v122) woodcutting's next step. Every map has had choppable trees all along; these are the tiered ones, so the skill pays better as you go out further instead of paying `logs` forever. */
      /* (2026-09-22) one ore per tier, on the map whose level band matches it. `rock`, not `vein`, because the art is
         o_rock_<ore> and that is what exists for every middle tier; o_vein_* is only drawn for copper. */
      for (const [x, y] of [[6, 18], [10, 19]]) { objs.push({ t: "rock", x, y, ore: "diamond_ore", name: "Diamond rock", req: { skill: "mining", lvl: 30 }, xp: 62 }); g[y][x] = "#"; }
      for (const [tx, ty] of [[8, 7], [33, 18]]) { objs.push({ t: "deadtree", x: tx, y: ty, log: "ashlogs", name: "Deadwood", req: { skill: "woodcutting", lvl: 20 }, xp: 140 }); g[ty][tx] = "#"; }
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 16; y++) g[y][24] = ",";
      for (let y = 18; y <= 23; y++) for (let x = 14; x <= 33; x++) g[y][x] = "~";   // the lake: most of the south
      scatterSpots(objs, 14, 33, 18, 5, [1, 2, 3, 5], { name: "Lantern lake", req: { skill: "fishing", lvl: 20 }, fish: "lanternfish", fish2: "mudskipper", fish2lvl: 25, xp: 80, xp2: 95, glow: "#a8ffb0", tease: "Little lights drift under the surface. They move away when you lean close. Fishing 20." });
      for (let x = 13; x <= 34; x++) keep.push([x, 17], [x, 16]);
      NORTH_ROAD(g, keep); objs.push({ t: "sign", x: 20, y: 11, name: "North: the Boneyard. It opens at Combat 30, and Fishing 30 for the flooded crypt." }); g[11][20] = "#";
      objs.push({ t: "sign", x: 30, y: 15, name: "THE LANTERN MIRE: Combat 20 to 29. Nothing here attacks first. Paper Twisters and moths to the east, Card Counters in the north-west, Tax Wraiths in the north-east clearing, Loan Sharks in the far south-west." }); g[15][30] = "#";
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 9);
      return { g, objs, blobs: [] };
    },
    mobs: [["twister", 36, 5], ["twister", 39, 8], ["twister", 33, 9], ["twister", 38, 3], ["twister", 41, 6], ["twister", 35, 10],
      ["moth", 37, 16], ["moth", 40, 18], ["moth", 38, 21], ["moth", 41, 22], ["moth", 36, 19], ["moth", 39, 15],
      ["counter", 8, 5], ["counter", 11, 8], ["counter", 6, 9], ["counter", 13, 4], ["counter", 9, 10],
      ["taxwraith", 29, 2], ["taxwraith", 30, 3], ["taxwraith", 28, 3], ["taxwraith", 29, 4],
      ["shark", 3, 21], ["shark", 5, 22], ["shark", 4, 23]],
    npcs: [], bots: []
  },
  cloud: {
    name: "Cloudreach", ground: "cloud", exits: { e: "boneyard", w: "thunderhead" },
    build() {
      const g = grid(), objs = [], keep = [];
      /* (v122) woodcutting's next step. Every map has had choppable trees all along; these are the tiered ones, so the skill pays better as you go out further instead of paying `logs` forever. */
      /* (2026-09-22) one ore per tier, on the map whose level band matches it. `rock`, not `vein`, because the art is
         o_rock_<ore> and that is what exists for every middle tier; o_vein_* is only drawn for copper. */
      for (const [x, y] of [[6, 17], [11, 18]]) { objs.push({ t: "rock", x, y, ore: "onyx_ore", name: "Onyx rock", req: { skill: "mining", lvl: 50 }, xp: 115 }); g[y][x] = "#"; }
      for (const [tx, ty] of [[9, 6], [32, 20]]) { objs.push({ t: "skyash", x: tx, y: ty, log: "skyashlogs", name: "Skyash", req: { skill: "woodcutting", lvl: 45 }, xp: 190 }); g[ty][tx] = "#"; }
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 17; y++) g[y][31] = ",";
      // a hole in the cloud: the sky below, fished from its north side. Sky eels from Fishing 40, cloud rays from 45
      for (let y = 19; y <= 22; y++) for (let x = 27; x <= 36; x++) g[y][x] = "~";
      scatterSpots(objs, 27, 36, 19, 5, [1, 2, 4], { name: "Hole in the cloud", req: { skill: "fishing", lvl: 40 }, fish: "skyeel", fish2: "cloudray", fish2lvl: 45, xp: 140, xp2: 165, glow: "#bfe8ff", tease: "Long shapes swim through the open sky below. Fishing 40." });
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
  /* (v121) THE VAULT. The last map, west out of the Thunderhead: the casino's own vault, or what is left of it. Combat 70
     and up, and everything in it hits hard enough that the Wilderness's rules would be unkind — so like the Thunderhead it
     is safe from other players and dangerous from everything else. Starfall ore is mineable here at 60, eclipse at 70. */
  vault: {
    name: "The Vault", ground: "cloud", carpet: "rug_casino", exits: { e: "thunderhead" }, tint: "rgba(10,6,2,.62)",
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 2; x < COLS - 1; x++) g[13][x] = ",";               // the long floor through the middle
      for (let y = 10; y <= 16; y++) for (let x = 6; x <= 38; x++) if (g[y][x] === ".") g[y][x] = ",";
      objs.push({ t: "sign", x: 40, y: 12, name: "THE VAULT: Combat 70 and up. Mining 60 for starfall, 70 for eclipse. Whatever the House was keeping, it is still down here." }); g[12][40] = "#";
      /* THE HOUSE'S OWN ROOM. Carpet down the middle, neon along both walls, and a rank of slot machines nobody has
         emptied — the page already draws a chasing bulb on a slot and a glow on neon, so these flash without new code. */
      objs.push({ t: "rug", img: "rug_casino", x: 8, y: 11, w: 28, h: 5, color: "#3a0f1c", name: "The vault carpet, still red under the dust." });
      for (const x of [9, 15, 21, 27, 33]) { objs.push({ t: "wall_neon", x, y: 3, name: "Neon, still lit" }); objs.push({ t: "wall_neon", x, y: 23, name: "Neon, still lit" }); }
      for (const [x, y] of [[12, 4], [14, 4], [16, 4], [26, 22], [28, 22], [30, 22]]) { objs.push({ t: "slots", x, y, name: "A machine nobody emptied" }); g[y][x] = "#"; }
      for (const [x, y] of [[7, 10], [7, 16], [37, 10], [37, 16]]) { objs.push({ t: "ropepost", x, y, name: "Rope post" }); g[y][x] = "#"; }
      objs.push({ t: "coinstatue", art: "o_coinstatue", x: 21, y: 4, name: "The House's own statue. It is not smiling." }); g[4][21] = "#";
      objs.push({ t: "prizewheel", x: 4, y: 13, name: "A prize wheel, seized solid." }); g[13][4] = "#";
      /* the ore. Starfall along the near wall, eclipse at the far end, voidglass where the windows went. */
      for (const [x, y] of [[10, 7], [13, 6], [16, 8], [11, 19], [15, 20]]) { objs.push({ t: "vein", x, y, ore: "starfall_ore", name: "Starfall seam", req: { skill: "mining", lvl: 60 }, xp: 150 }); g[y][x] = "#"; }
      for (const [x, y] of [[30, 6], [34, 7], [32, 20], [36, 19]]) { objs.push({ t: "vein", x, y, ore: "eclipse_ore", name: "Eclipse seam", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[y][x] = "#"; }
      for (const [x, y] of [[24, 4], [27, 22]]) { objs.push({ t: "rock", x, y, ore: "voidglass", name: "Shattered window", req: { skill: "mining", lvl: 70 }, xp: 190 }); g[y][x] = "#"; }
      /* (v121) woodcutting's last two: whatever grew down here in the dark. */
      for (const [x, y] of [[20, 8], [22, 18]]) { objs.push({ t: "yew", x, y, log: "voidlogs", name: "Vaultwood", req: { skill: "woodcutting", lvl: 60 }, xp: 200 }); g[y][x] = "#"; }
      for (let x = 2; x <= 42; x++) keep.push([x, 12], [x, 13], [x, 14]);
      wild(g, objs, this.exits, { n: "wall", s: "wall", w: "wall", e: "cloud" }, [...keepOf(this), ...keep], 10);
      return { g, objs, blobs: [] };
    },
    mobs: [["warden", 9, 10], ["warden", 12, 16], ["warden", 17, 11], ["warden", 8, 17], ["warden", 14, 9],
      ["pitboss", 20, 11], ["pitboss", 23, 15], ["pitboss", 19, 16], ["pitboss", 25, 10],
      ["hoard", 29, 11], ["hoard", 33, 15], ["hoard", 31, 17], ["hoard", 35, 10],
      ["dealer", 38, 13], ["dealer", 40, 16]],
    npcs: [], bots: []
  },
  thunderhead: {
    name: "The Thunderhead", ground: "cloud", exits: { e: "cloud", w: "vault", n: "trailer" }, tint: "rgba(18,16,56,.42)",
    build() {
      const g = grid(), objs = [], keep = [];
      /* (v122) woodcutting's next step. Every map has had choppable trees all along; these are the tiered ones, so the skill pays better as you go out further instead of paying `logs` forever. */
      for (const [tx, ty] of [[26, 6], [30, 21]]) { objs.push({ t: "skyash", x: tx, y: ty, log: "skyashlogs", name: "Storm-struck skyash", req: { skill: "woodcutting", lvl: 50 }, xp: 200 }); g[ty][tx] = "#"; }
      for (let x = 12; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 16; y++) g[y][14] = ",";
      for (let y = 18; y <= 23; y++) for (let x = 3; x <= 22; x++) g[y][x] = "~";   // the sea, seen through the floor of the storm
      scatterSpots(objs, 3, 22, 18, 5, [1, 2, 4], { name: "The sea below", req: { skill: "fishing", lvl: 50 }, fish: "stormmarlin", fish2: "thundersquid", fish2lvl: 58, xp: 190, xp2: 230, glow: "#ffe27a", tease: "Far below, something with a sword for a nose cuts the water. Fishing 50." });
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
    name: "The Boneyard", dark: true, exits: { e: "mire", n: "cloud" }, tint: "rgba(60,20,70,.2)",
    build() {
      const g = grid(), objs = [], keep = [];
      /* (v122) woodcutting's next step. Every map has had choppable trees all along; these are the tiered ones, so the skill pays better as you go out further instead of paying `logs` forever. */
      /* (2026-09-22) one ore per tier, on the map whose level band matches it. `rock`, not `vein`, because the art is
         o_rock_<ore> and that is what exists for every middle tier; o_vein_* is only drawn for copper. */
      for (const [x, y] of [[5, 19], [9, 20]]) { objs.push({ t: "rock", x, y, ore: "dragonstone_ore", name: "Dragonstone rock", req: { skill: "mining", lvl: 40 }, xp: 86 }); g[y][x] = "#"; }
      for (const [tx, ty] of [[7, 8], [34, 17]]) { objs.push({ t: "yew", x: tx, y: ty, log: "yewlogs", name: "Ancient yew", req: { skill: "woodcutting", lvl: 35 }, xp: 170 }); g[ty][tx] = "#"; }
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 17; y++) g[y][35] = ",";
      // the flooded crypt, fished from its north side: bonefish from Fishing 30, ghost carp from 35
      for (let y = 19; y <= 22; y++) for (let x = 31; x <= 40; x++) g[y][x] = "~";
      scatterSpots(objs, 31, 40, 19, 5, [1, 2, 4], { name: "Flooded crypt", req: { skill: "fishing", lvl: 30 }, fish: "bonefish", fish2: "ghostcarp", fish2lvl: 35, xp: 110, xp2: 130, glow: "#d8c8ff", tease: "Pale shapes slide between the sunken headstones. Fishing 30." });
      for (let x = 30; x <= 41; x++) keep.push([x, 18], [x, 17]);
      for (const [x, y] of [[9, 5], [11, 6], [10, 8], [20, 18], [22, 19], [21, 21], [33, 5], [35, 6], [34, 8], [25, 5], [13, 20]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      for (const [x, y] of [[7, 19], [27, 9], [38, 11]]) { objs.push({ t: "skeleton", x, y, name: "Somebody who stayed" }); g[y][x] = "#"; }
      for (const [x, y] of [[4, 4], [18, 3], [40, 4], [24, 22]]) { objs.push({ t: "deadtree", x, y, name: "Dead tree" }); g[y][x] = "#"; }
      NORTH_ROAD(g, keep); objs.push({ t: "sign", x: 20, y: 11, name: "North, and up: Cloudreach. It opens at Combat 40, and Fishing 40. Bring a head for heights." }); g[11][20] = "#";
      objs.push({ t: "sign", x: 28, y: 15, name: "THE BONEYARD: Combat 30 to 39. Nothing here attacks first. Ghouls to the east, Stagehands to the west, Understudies in the middle, Chandelier Spiders in the north-east, One-Eyed Ushers in the far south-west." }); g[15][28] = "#";
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 33);
      return { g, objs, blobs: [] };
    },
    mobs: [["ghoul", 36, 7], ["ghoul", 39, 9], ["ghoul", 31, 9], ["ghoul", 37, 3], ["ghoul", 41, 7], ["ghoul", 30, 6],
      ["stagehand", 8, 8], ["stagehand", 13, 9], ["stagehand", 6, 6], ["stagehand", 14, 5], ["stagehand", 16, 17], ["stagehand", 18, 20],
      ["understudy", 24, 17], ["understudy", 26, 20], ["understudy", 27, 16], ["understudy", 27, 8],
      ["chandelier", 29, 2], ["chandelier", 31, 3], ["chandelier", 30, 4],
      ["usher", 4, 21], ["usher", 6, 22], ["usher", 8, 21], ["usher", 5, 23]],
    npcs: [], bots: []
  },
  // east of the Forum: the great road, a toll post, highwaymen, and a barricade where the road washed out
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
    npcs: [{ name: "Aurelia", art: "aurelia", x: 21, y: 9, still: true, opens: "bank", reach: 2, hair: "#1a1a2a", shirt: "#3a6a8a", pants: "#2a2a3a", lines: ["Welcome to the Bank. Use any booth.", "We hold anything. Not tickets."] }]
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
    name: "The Yard", exits: { e: "casino", n: "gloam" },
    build() {
      const g = grid(), objs = [], keep = [];
      /* (2026-09-22) the way into the Agility course. A doorway, not a walk-through edge, so the Yard keeps its shape. */
      /* (2026-09-22) ORE YOU CAN ACTUALLY REACH. Every rung below Starfall sat in a CLOSED map (copper and tin in the
         river and the grove, marble on the Appia), so Mining had nothing to train on between 1 and 60 except grimstone
         in the middle of a PvP zone. One seam per tier, on the map whose level band matches it. */
      for (const [x, y] of [[4, 8], [6, 9]]) { objs.push({ t: "rock", x, y, ore: "copper", name: "Copper rock", req: { skill: "mining", lvl: 1 }, xp: 18 }); g[y][x] = "#"; }
      for (const [x, y] of [[3, 11]]) { objs.push({ t: "rock", x, y, ore: "tin", name: "Tin rock", req: { skill: "mining", lvl: 1 }, xp: 18 }); g[y][x] = "#"; }
      /* (2026-09-22, the owner) THE RUN's way in is a rope ladder now, up at 10,2 rather than a door at 6,5. It
         keeps the type `roomdoor` because that is what carries `enter` through to the scene change; only the
         picture and the tile move. Kept from wild(), or a bush grows over the entrance. */
      objs.push({ t: "roomdoor", art: "o_wildladder", x: 10, y: 2, name: "The Run: an agility course", enter: "agility" }); g[2][10] = "#"; keep.push([10, 2]);
      /* (v122) where woodcutting starts: two ordinary trees by the Yard's edge, Woodcutting 1. */
      /* (2026-09-22, the owner: "this tree in the yard should look unique, it currently looks like all the other
         trees and doesnt stand out") THESE TWO ARE THE ONLY CHOPPABLE TREES IN THE YARD. The other 126 tree objects
         here are wild() scenery, and every one of them shared this sprite - so nothing told you which two actually
         gave logs. Every other zone names its tree (willow, yew, skyash, rustpine, bogwood) and draws it
         differently; the Yard never got one. `art` is what separates them, since the TYPE has to stay "tree" for
         the chop handler and the stump to keep working. */
      for (const [tx, ty] of [[6, 6], [9, 20]]) { objs.push({ t: "tree", art: "o_yardtree", x: tx, y: ty, log: "logs", name: "Old oak", req: { skill: "woodcutting", lvl: 1 }, xp: 25 }); g[ty][tx] = "#"; }
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 17; y++) g[y][20] = ",";
      // the pond, south: fished from its north bank. The one quiet job out here.
      for (let y = 19; y <= 22; y++) for (let x = 15; x <= 25; x++) g[y][x] = "~";
      scatterSpots(objs, 15, 25, 19, 5, [1, 2, 3, 5], { name: "Fishing spot", fish: "sardine", fish2: "perch", fish2lvl: 5, xp: 20, xp2: 30 });
      /* (v104) A CAMPFIRE by the way in (the owner: "where is the low level campfire for cooking? ... add it near the entrance of the yard"): cook what you catch on the walk back to the casino. A cooked fish sells for twice the raw one. */
      objs.push({ t: "fire", x: 40, y: 15, name: "Campfire: cook your catch" }); g[15][40] = "#"; keep.push([39, 15], [41, 15], [40, 14], [40, 16], [40, 13]);
      /* (v108) THE FORUM IS GONE (the owner, 2026-09-21: "lets get rid of the forum area, and move the important npcs to the area by the
         jukebox. the market lady, the crypts entrance, and the boat guy should all be there. no need to move the bank since there's a
         bank box"). Everything a player walked to town for is now a few steps from the casino's door: Livia and her Exchange stall,
         Charon and his cart (the islands), the stairs down to the Crypt, beside the bank chest, the campfire and the jukebox that were
         already here. The Forum and the Bank building still exist in this file and are closed (OPEN, below). */
      objs.push({ t: "stall", x: 30, y: 17, w: 2, h: 1, name: "Exchange stall" }); block(g, 30, 17, 2, 1);
      objs.push({ t: "cart", art: "o_chariot", x: 37, y: 17, w: 2, h: 1, name: "Charon's cart" }); block(g, 37, 17, 2, 1);
      objs.push({ t: "cryptdoor", x: 35, y: 10, name: "Stairs down to the Crypt: bring a party" }); g[10][35] = "#";
      for (let x = 28; x <= 41; x++) keep.push([x, 16], [x, 15]); for (const [x, y] of [[29, 17], [32, 17], [36, 17], [39, 17], [30, 18], [31, 18], [37, 18], [38, 18], [34, 10], [36, 10], [34, 11], [35, 11], [36, 11], [35, 12], [34, 12], [36, 12]]) keep.push([x, y]);
      for (let x = 14; x <= 26; x++) keep.push([x, 18], [x, 17]);
      /* A BANK CHEST in the Yard (the owner, 2026-09-19): a `booth` in a chest's clothes, so it IS the bank, the same
         window and the same rules as Aurelia's counters in town (tickets still can't go in). Saves the walk. */
      objs.push({ t: "booth", art: "o_chest", x: 35, y: 16, name: "Bank chest" }); g[16][35] = "#";
      objs.push({ t: "sign", x: 27, y: 15, name: "GEAR AND PRIZES are at the Prize Counter: Bom Trady, in the middle of the casino. Bring your tickets." }); g[15][27] = "#";
      objs.push({ t: "sign", x: 41, y: 11, name: "THE YARD. Click a monster to fight it. Chickens by the gate; it gets meaner the further from the gate you walk. Nothing here attacks first. The pond is for anyone who'd rather fish." }); g[11][41] = "#";
      /* (v88) A JUKEBOX IN THE MARKET, the same station as the casino's: see RADIO.heard. (2026-09-22: moved from
         38,9 in the north court to the south one, because the Tower went up beside it and a five-tile building
         leaning over a jukebox is not somewhere you can see to click it.) It sits on paving the court lays, so it
         is set blocked here and court() turns that "#" into "P" on its way past — the same pass that puts paving
         under Livia and the bank chest. Kept from wild() explicitly: the south court has no keep box of its own,
         so without this a bush can grow through it. */
      objs.push({ t: "jukebox", x: 41, y: 18, name: "Jukebox" }); g[18][41] = "#"; keep.push([41, 18]);
      /* (2026-09-22) THE TOWER, in the same court as the jukebox and the stairs down. It is drawn from a sprite far
         taller than its tile, so it looms up out of the court and off the top of the screen — which is the whole
         point of it and the reason it went here rather than out in the open: the court's rails give it something to
         stand behind. Two tiles wide, and inside the keep box the jukebox already claims (36..41 x 8..12), so
         wild() cannot scatter a bush through the doorway. */
      /* (2026-09-22) THE SMITHY. A furnace and an anvil existed as recipes, as stations, in the click map, in
         ART_FILES and as two drawn pictures — and as NO OBJECT ANYWHERE IN THE WORLD. Eighty-eight smithing recipes
         and both cooking's range bonus were unreachable for want of these two lines, which is why smithing read as
         unbuilt when the data said otherwise. They go at the WEST end: the Tower's sprite covers the east side of
         this court from y5 down to y9, and anything put over there is drawn behind a building. */
      objs.push({ t: "furnace", x: 35, y: 6, name: "Furnace: smelt ore into bars, and burn logs to charcoal" });
      block(g, 35, 6, 1, 1); keep.push([35, 6]);
      objs.push({ t: "anvil", x: 37, y: 6, name: "Anvil: hammer bars into gear, and reforge what you have" });
      block(g, 37, 6, 1, 1); keep.push([37, 6]);
      objs.push({ t: "towerdoor", art: "o_tower", x: 40, y: 9, w: 2, h: 1, name: "The Tower: thirty floors, one room at a time" });   /* `art` because the picture is o_tower and the type is towerdoor: without it the page looks for "o_towerdoor", finds nothing and draws NO TOWER */
      block(g, 40, 9, 2, 1);
      for (let y = 8; y <= 12; y++) for (let x = 36; x <= 41; x++) keep.push([x, y]);
      /* ------------------------------------------------ THE MARKET (2026-09-22)

         Everything a player walks to — Livia, the bank chest, Charon, the campfire, the jukebox, the stairs down —
         was moved here one at a time, and each one ended up standing on open grass, so the busiest corner of the game
         read as a field with furniture in it. Two paved courts now flank the road in from the casino, fenced along
         their outside edges with gaps left in them: the owner asked for "semi gated off / fenced off areas with light
         brick flooring on both sides ... more of a market feel near the entrance."

         SEMI-gated is the design, not a compromise. A closed pen would trap the Yard's chickens, which wander, and
         would put a gate between a new player and the bank. So the railing runs along the OUTSIDE edges only and the
         road side of each court is wide open: it frames the market rather than shutting it.

         `p` is paving, which the page already draws (and paints with t_brick now the art exists). THE COURTS ARE LAID
         FIRST and every tile goes into `keep`, because wild() scatters trees and boulders over anything it has not
         been told to leave alone — otherwise a boulder lands on the bank counter. Only grass is paved, so a rock,
         a sign or the road that is already there stays exactly as it was. */
      const upTo = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
      /* (2026-09-22) PAVE UNDER THE FURNITURE TOO. The first version only turned GRASS into paving, and every tile
         holding something — the stall, the bank chest, Charon's cart, the fire, the stairs down, the jukebox — was
         already "#" by the time the court was laid, so each one sat on its own green square in the middle of the
         brick (the owner, testing: "some items like the bank, livias market, etc have grass underneath them still").
         "#" blocks and draws NOTHING, which is why the grass showed through; "P" is the paved blocked tile, so it
         keeps the block and paints the floor. Anything already paved, road, water or interior is left alone. */
      /* (2026-09-22) A COURT IS NOT A RECTANGLE (the owner, testing: "can you make it not feel so blocky? its just
         a square and a rectangle for now, and doesnt blend that well"). Two hard rects of brick dropped on grass
         read as a floor plan. `inset` pulls the WEST end of each row back, so the paving steps in as it goes away
         from the road and ends on a broken line rather than a ruled one; the grass it gives back becomes a verge
         between the brick and the railing, which is what stops the fence looking glued on.

         The ROAD side is never inset: it meets dirt rather than grass, it is where everyone walks in, and pulling
         it back would only narrow the entrance. */
      const pave = (x, y) => { if (g[y][x] === ".") g[y][x] = "p"; else if (g[y][x] === "#") g[y][x] = "P"; keep.push([x, y]); };
      const court = (x0, y0, x1, y1, inset = []) => { for (let y = y0; y <= y1; y++) for (let x = x0 + (inset[y - y0] || 0); x <= x1; x++) pave(x, y); };
      /* THE LOOSE SLABS ARE GONE (2026-09-22, second look). The idea was that a yard walked on for years does not
         stop dead, so single tiles were paved past the edge. On the map they were single SQUARES with grass either
         side of them, and under the railing they made the whole line read as checkered — the owner: "the court
         looks weird with random grass blocks now". A tile is the wrong grain for wear. The outline is softened in
         the PAGE instead, by rounding the corners of the paving where it meets grass, which works at the pixel and
         costs nothing here. */
      const railing = (pts, dir) => { for (const [x, y] of pts) { keep.push([x, y]); if (g[y][x] !== "." && g[y][x] !== "p") continue; objs.push({ t: dir === "h" ? "fenceH" : "fenceV", x, y, name: "Market railing" }); g[y][x] = g[y][x] === "p" ? "P" : "#"; } };
      court(28, 14, 42, 18, [0, 0, 1, 1, 2]);                   // south court: the Exchange, the bank chest, Charon's cart, the fire
      /* (2026-09-22) THE NORTH COURT GREW TWO ROWS NORTH, to y6, because the Tower went up in it and the smithy had
         to go somewhere: five rows were already holding the Crypt stairs and a five-tile building. The taper is kept
         so the left edge still reads as a shape rather than a box.

         THE FORGE GOES AT THE WEST END, and that is not decoration. The Tower's sprite is about four tiles tall and
         anchored at y9, so it covers y5..y9 on the EAST side of this court — a furnace at 41,6 would be drawn behind
         a building. The new space is only usable on the left. */
      court(33, 6, 42, 12, [2, 1, 1, 0, 0, 1, 2]);                // north court: the Crypt stairs, the Tower, and the smithy
      /* Each gap in a rail is somebody's way in: 31 and 38 on the south line up with Livia's stall and Charon's
         cart, 36 on the north lines up with the stairs down. */
      /* CLOSED ON THREE SIDES, OPEN ON THE ROAD (the owner: "they should be closed on three sides, so one is open
         to get in"). The road at y13 runs between the two courts, so each one's road side IS the entrance — which
         means the rails want no gaps cut in them at all. An earlier pass cut doorways at 31, 38 and 36 and then
         had to protect them from wild(); with a whole side open they are simply gone.

         The fourth side of each court is the map's east edge, which is already impassable and dressed as treeline
         by wild(), so the rails run along the outer long edge and down the west end and stop there.

         The vertical runs are drawn with their OWN tile (o_fencev), a full square whose rails touch the top and
         bottom edges, so a column of them joins up. The front-on rail could not do this: at seven pixels in a
         sixteen-pixel tile a stack of them is separate railings with gaps, which is what the west edges looked
         like before. Two pieces, each tiling along its own axis. */
      /* WHAT MAKES IT A MARKET AND NOT A CAR PARK (2026-09-22, the owner: "add a few artifacts to the courts, some
         light posts, etc. make it feel lived in", with concept art of a fenced yard full of crates and barrels).

         All of it is scenery: blocked, named so the hover says something, and nothing to click. It goes down AFTER
         the courts are paved, and each piece keeps whatever is under it: on brick it becomes "P" (blocked, but
         still drawn as floor) rather than the plain "#" that draws NOTHING and would give every crate the square
         of grass the bank chest and the stall had; on the verge outside the paving "#" is right, because there
         the ground really is grass. The railings do the same thing for the same reason. Since the courts were
         given their stepped west ends a few of these now stand on the verge rather than the brick, which is where
         you would put a crate anyway.

         Nothing goes on row 14 or row 12, the two rows nearest the road: that is where everyone walks in, and a
         crate there is something to path around on the way to the bank. The corners take the tall pieces (lamp
         posts, corner posts) because a tall thing at a corner reads as a boundary; the low clutter fills the dead
         ground behind the stalls where nobody stands. */
      const dress = (t, x, y, name) => { objs.push({ t, x, y, name }); g[y][x] = g[y][x] === "p" ? "P" : "#"; keep.push([x, y]); };
      dress("fencepost", 27, 19, "Corner post"); dress("fencepost", 32, 7, "Corner post");
      dress("lamppost", 28, 15, "A lamp post. It comes on when the light goes."); dress("lamppost", 42, 18, "A lamp post. It comes on when the light goes.");
      dress("lamppost", 33, 8, "A lamp post. It comes on when the light goes."); dress("lamppost", 42, 12, "A lamp post. It comes on when the light goes.");
      dress("crates", 28, 17, "Crates. Livia's, probably."); dress("crate", 29, 18, "A crate. Nailed shut.");
      dress("barrel", 33, 15, "A barrel. Something sloshes."); dress("sacks", 34, 18, "Sacks of grain.");
      dress("crates", 41, 17, "Crates, stacked by the cart."); dress("barrel", 42, 15, "A barrel, going soft in the rain.");
      dress("handcart", 34, 8, "A handcart, parked."); dress("crate", 41, 8, "A crate. Somebody sat on it.");
      dress("barrel", 33, 12, "A barrel by the stairs."); dress("sacks", 40, 12, "Sacks, dumped and forgotten.");
      railing(upTo(27, 42).map((x) => [x, 19]), "h");
      railing(upTo(34, 42).map((x) => [x, 5]), "h");        // the north court's top rail, moved up from y7 with the court
      railing(upTo(14, 18).map((y) => [27, y]), "v");
      railing(upTo(6, 12).map((y) => [32, y]), "v");        // and its west rail runs the full new height
      NORTH_ROAD(g, keep); objs.push({ t: "sign", x: 20, y: 11, name: "North: the Gloam. It opens at Combat 10 for its monsters, and Fishing 10 for its pond. Bigger tickets, better fish." }); g[11][20] = "#";
      /* (2026-09-22) the first bale moved off 36,7: that is now the north court's doorway, and a bale in it made a
         fence with no way through. The court is laid above, so anything decorative here must dodge it. */
      for (const [x, y] of [[30, 5], [29, 22], [17, 6], [7, 8]]) { objs.push({ t: "hay", x, y, name: "Hay bale" }); g[y][x] = "#"; }
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, [...keepOf(this), ...keep], 12);
      return { g, objs, blobs: [] };
    },
    // east to west, easy to hard: chickens at the gate, then cows, bad tomatoes, hornworms, and boars at the far end
    mobs: [["chicken", 38, 5], ["chicken", 41, 5], ["chicken", 33, 9],   /* (v88: two of them moved a little, off the jukebox's slab) */
       ["chicken", 39, 18], ["chicken", 41, 21], ["chicken", 36, 20],
      ["cow", 30, 4], ["cow", 33, 7], ["cow", 27, 6], ["cow", 30, 21], ["cow", 34, 22],
      ["rotten", 18, 4], ["rotten", 26, 7], ["rotten", 19, 8], ["rotten", 27, 10], ["olive", 16, 4], ["olive", 17, 10], ["olive", 25, 10],
      ["hornworm", 12, 5], ["hornworm", 15, 8], ["hornworm", 10, 9], ["hornworm", 11, 17],
      ["boar", 5, 5], ["boar", 8, 17], ["boar", 4, 19], ["boar", 11, 21], ["boar", 6, 22]],
    npcs: [   // (v108: Livia and Charon came over from the Forum, which is closed. Brutus sold gear here for a few hours on 2026-09-20; it is behind the Prize Counter now)
      { name: "Livia the Broker", art: "livia", x: 31, y: 16, still: true, opens: "exchange", reach: 2, hair: "#2a1a10", shirt: "#c89a2a", pants: "#3a2a1a", lines: ["Buying? Selling? Use the stall. I take 1%.", "It keeps selling while you sleep."] },
      { name: "Charon the Ferryman", art: "charon", x: 39, y: 16, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Islands. Everyone gets one. Nobody knows who's paying for them.", "The river's closed, so now it's a cart. Don't ask how a cart gets to an island. I don't.", "Plant something before you go back in there and lose your shirt. It grows while you're away.", "Wheat, ten minutes. Tomatoes, twenty. Both sell. Both cook."] }],
    bots: []
  },
  // EAST of the casino, the first stop on the combat line: things a beginner can win a fight with
  // the second (and last, for now) fight map: past the Paddock, where the money is better and so are the teeth
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
    pit: { x: 15, y: 9, w: 14, h: 7 }, pitFloor: "t_pit",
    wall: [{ t: "banner", x: 10 }, { t: "lamp", x: 13 }, { t: "lamp", x: 17.5 }, { t: "lamp", x: 26 }, { t: "lamp", x: 30.5 }, { t: "banner", x: 33.5 }],
    doorSigns: [{ x: 22, text: "HIGH ROLLERS" }],
    build() {
      const g = room(9, 5, 34, 20, 21), objs = [];
      objs.push({ t: "walldoor", x: 22, y: 4, name: "The High Roller Room", enter: "highroller" });   // (the owner, 2026-09-20: "a high roller section, accessible from a door in the fighting ring")
      objs.push({ t: "fightring", x: 15, y: 9, w: 14, h: 7, name: "The pit: bet on the fight" }); block(g, 15, 9, 14, 7);
      for (const [x, y] of [[12, 6], [31, 6]]) { objs.push({ t: "fightboard", art: "o_fightboard", x, y, name: "Tonight's card: bet on the fight" }); g[y][x] = "#"; }
      /* (v81, the owner: "have pixel labs draw art for the fight pit arena, ground tiles, and everything else in the fight pit that
         doesnt have custom ones".) A torch-topped padded post at each corner of the pit and a ring bell by the rail; the floor
         itself is the page's (def.pitFloor: flagstones, a raised ring of sand, a plank kerb between them). Each only goes down
         where the floor is free, so it can never land on a stool. */
      for (const [x, y] of [[14, 8], [29, 8], [14, 16], [29, 16]]) if (g[y][x] === "i") { objs.push({ t: "ringpost", art: "o_ringpost", x, y, name: "Corner post" }); g[y][x] = "#"; }
      if (g[8][22] === "i") { objs.push({ t: "ringbell", art: "o_ringbell", x: 22, y: 8, name: "Ring bell" }); g[8][22] = "#"; }
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
  // inside the Casino: a hangout first, a gambling den second. Games of chance for tickets (never ZCoins), the
  // daily-task board, a bar, and Dex, who has seen everything and will tell you about most of it.
  /* GAMBA's hub (2026-09-19): the casino is the middle of the world and where everyone starts. Four ways out, as on
     the owner's map: NORTH the upper floors (Floor 2 is the Roulette Room), WEST the skilling line, EAST the combat
     line, SOUTH the town (crafting: the smithy and the market). The side archways are real exits at the grid's edge;
     the south door is the building's front door onto the Forum. */
  casino: {
    name: "The Casino", interior: true, floor: "casino", wallH: 34, room: [1, 4, 42, 21], exits: { w: "workyard" }, labels: { w: "OUTSIDE" }, exitTo: { scene: "workyard", x: 38, y: 15 },   /* (v108: the front door led to the Forum) */ entry: { x: 21, y: 20 },
    wall: [{ t: "banner", x: 3 }, { t: "lamp", x: 7 }, { t: "lamp", x: 11 }, { t: "painting1", x: 14.5, dy: 7, frame: true }, { t: "lamp", x: 17 }, { t: "lamp", x: 24 }, { t: "painting2", x: 28, dy: 5 }, { t: "lamp", x: 31 }, { t: "neon", x: 35.5, dy: 16 }, { t: "lamp", x: 39.3 }, { t: "banner", x: 41 }],
    /* (2026-09-22) FIGHTING and PICTURES are drawn signs now, not lettered text — see the objs.push below. The
       Roulette door always had real art and the other two looked unfinished beside it. */
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
      g[22][21] = "v"; g[22][22] = "v";   /* (v111) the south door is shut: WALL, not floor, so nobody stands in the doorway and the page draws the wall across it. See the note above the scene. */
      for (let y = SPAN.w[0]; y <= SPAN.w[1]; y++) g[y][0] = "e";   // one arch, west (the east one was the combat line's until 2026-09-20)
      objs.push({ t: "walldoor", x: 21, y: 3, name: "Floor 2: the Roulette Room", enter: "roulette" });
      objs.push({ t: "roulsign", x: 21, y: 2, name: "Roulette", dy: -3 });
      objs.push({ t: "walldoor", x: 10, y: 3, name: "The Fight Pit", enter: "fightpit" });
      objs.push({ t: "fightsign", x: 10, y: 2, name: "Fighting", dy: -3 });
      /* (v118) THE PICTURE HOUSE, third door along the back wall. The room is the first half of wiring eastcoin.vip's
         Movies & TV into the game: the seats and the screen are here, and clicking the screen opens nothing yet. */
      objs.push({ t: "walldoor", x: 15, y: 3, name: "The Picture House", enter: "theatre" });
      objs.push({ t: "picsign", x: 15, y: 2, name: "Pictures", dy: -3 });
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
      put("notice", 24, 4, "Task board");   /* (v104) the three boards stood shoulder to shoulder and the tour sends new players to this one: it has the wall east of the roulette door to itself now, the Winners' Wall is west of the door and the Hiscores further east. The coat rack that shared its tile is gone. */
      // SLOTS: the whole north-west floor. Three banks, two machines deep, plus the wall.
      for (const bx of [4, 9, 14]) for (let y = 5; y <= 9; y++) { put("slots", bx, y, "Slot machine", 1, { flip: true }); put("slots", bx + 1, y, "Slot machine"); }
      for (const y of [5, 7, 9]) put("slots", 1, y, "Slot machine", 1, { flip: true });
      for (const bx of [4, 9, 14]) for (const y of [5, 7, 9]) { seat(bx - 1, y); seat(bx + 2, y); }
      put("soda", 7, 4, "Soda machine"); put("snacks", 8, 4, "Snack machine");
      rope(6, 11, 8, 11); rope(12, 11, 14, 11); put("planter", 16, 11, "Planter", 2);
      // WHEELS and COIN FLIP share the south-west, with a rope between them
      put("wheel", 4, 18, "Wheel", 2, { art: "o_prizewheel" }); put("wheel", 8, 19, "Wheel", 2, { art: "o_prizewheel" }); put("prizewheel", 6, 21, "Daily Prize Wheel: one free spin a day", 2);
      put("fameboard", 19, 4, "Winners' Wall: today's biggest wins", 1);   /* (2026-09-22) its own picture now: gold frame, portraits. It borrowed o_notice, so the taskboard, the hiscores and this stood in a row looking identical. */
      put("hsboard", 27, 4, "Hiscores: who's on top", 1);   /* (2026-09-22) its own picture now: slate, trophy, medals. */   /* (v96) the same window as the top bar's Hiscores button */
      for (const [x, y] of [[13, 17], [16, 18], [13, 20]]) put("cointable", x, y, "Coin Flip table", 2);
      for (const [x, y] of [[13, 17], [16, 18], [13, 20]]) { seat(x, y + 1); seat(x + 1, y + 1); }
      rope(6, 15, 8, 15); rope(12, 15, 14, 15); put("planter", 16, 15, "Planter", 2);
      put("trashcan", 11, 17, "Bin"); put("plant", 11, 19, "Potted palm"); put("soda", 10, 21, "Soda machine"); put("snacks", 11, 21, "Snack machine");
      // the House Ruby, properly roped now
      // THE HOUSE RUBY, dead centre: the place you bring everything back to. Click it to cash in what you found and made
      // (the same as a Cashier's window); it becomes the ZCoin exchange too. Four posts, no rope: you walk right up to it.
      /* BOM TRADY RUNS THE PRIZE COUNTER (v82, the owner: "replace the ruby portal thing in the middle of the casino with bom trady
         graphic, and put counters around him that have prizes. hes the head honcho and the goat"). He stands where the House
         Ruby stood, twice the size of anyone else, with a U of glass prize cases behind and beside him and the front left open,
         so you walk up to him from the door. He is still the `coinstatue` object underneath (the game server's Prize Counter,
         ZCoin banking and ticket stakes all key on it), and every case opens the same window. The ruby's art is unused now. */
      /* v85 (the owner, with three photos of shop counters: "make bom trady have actual counters around him, black ones with led
         lights on the item. like a guy standing around black counters"). THE KIOSK IS ONE OBJECT AND ONE PICTURE (o_bomkiosk, built
         by scratchpad kiosk.mjs from PixelLab's lit glass cases and LED-edged black counter blocks plus his sprite at 2x): five tiles
         wide, three deep, all of it blocked. One picture because the layering is the whole point: he stands BEHIND the front
         cases like a clerk, which separate objects can't do. Click any part of it and you walk to the nearest side and the Prize
         Counter opens. It is still `coinstatue` underneath. The single prize cases of v82 are gone. */
      objs.push({ t: "coinstatue", art: "o_bomkiosk", x: 19, y: 12, w: 5, h: 3, name: "Bom Trady: the Prize Counter" }); block(g, 19, 12, 5, 3);
      objs.push({ t: "rug", img: "rug_casino", x: 20, y: 17, w: 4, h: 3, color: "#5a1a2a", name: "Rug" });
      put("howto", 24, 21, "How EastScape works", 1, { art: "o_notice" });
      /* (v117) THE SPORTSBOOK, right beside the Prize Counter on purpose: cash your tickets for ZCoins at Bom Trady, turn
         round, and put them on a real game. It is EastCoin Picks and nothing else — the board reads the site's own markets
         and a pick posts to the site's own /api/picks/wagers, so the game server knows this object exists and nothing more. */
      put("oddsboard", 17, 13, "The Sportsbook: tonight's games and their prices", 1, { art: "o_oddsboard" });
      // THE CARD ROOM: Higher or Lower up front, blackjack and poker behind (those two open soon)
      put("hilo", 26, 6, "Higher or Lower", 2); put("hilo", 29, 7, "Higher or Lower", 2);
      put("blackjack", 27, 9, "Blackjack table (opening soon)", 2); put("blackjack", 30, 10, "Blackjack table (opening soon)", 2); put("pokertable", 25, 10, "Poker table (opening soon)", 3);
      for (const [x, y] of [[26, 6], [29, 7], [27, 9]]) { seat(x, y + 1); seat(x + 1, y + 1); }
      rope(28, 11, 30, 11); put("cooler", 31, 4, "Water cooler"); put("buffet", 29, 4, "Buffet", 2); put("plant", 32, 7, "Potted palm"); put("trashcan", 32, 9, "Bin");
      // THE BAR and its lounge, north-east
      put("bar", 34, 5, "Bar", 4); put("atm", 40, 4, "tickets machine (out of order, thankfully)"); /* (v87, the owner: "move the jukebox to tile 18 10 in the casino so its accessible for all". It stood in the bar's corner at 33,4; now it is in the middle aisle by Bom Trady's booth, open on every side.) */ put("jukebox", 18, 10, "Jukebox"); put("piano", 33, 8, "Grand piano", 2);
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
      for (const [x, y] of [[3, 4], [42, 4], [2, 21], [42, 21]]) put("plant", x, y, "Potted palm");   /* (v122) one in each corner, not nine round the walls */
      put("planter", 25, 11, "Planter", 2); put("trashcan", 17, 4, "Bin");
      /* (THE TWO CASHIER BOOTHS ARE GONE, 2026-09-20. The owner spotted them as leftovers: a booth with a "$" and a stack of cash
         from when the currency was Cash, one by the west arch where it hid the OUTSIDE plaque, one on the east wall beside an
         arch that closed. The House Ruby in the middle is the Prize Counter and does everything they did. The game server still
         knows what a `cashier` is, so putting one back is one put() line: they stood at 2,11 and 40,11, two tiles wide.) */
      /* LIVED IN. Somebody works here and a lot of people lose here: a janitor's bucket and a wet-floor sign by a spilled
         drink in the east aisle, coats by both doors, a suitcase somebody walked in with and never picked up again, and
         on the carpet what people drop: chips, cards, losing slips, one shoe. Litter is `soft` (you walk over it) and
         `flat` (drawn on the floor, under everyone). */
      const litter = (t, x, y, name) => { if (g[y][x] === "i") objs.push({ t, x, y, name, soft: true, flat: true }); };
      put("mopbucket", 38, 12, "Mop bucket"); put("wetfloor", 36, 14, "Wet floor");   /* (v122) the spill went: the bucket and the sign already tell it */
      put("coatrack", 19, 21, "Coat rack"); put("mirror", 18, 21, "Mirror: change your look", 1, { art: "o_mirror" }); put("suitcase", 3, 15, "A suitcase. It's been here a while.");
      /* (v122) FOUR PIECES, NOT THIRTEEN. The floor is meant to look lived in, not unswept: one drift of chips by the slots,
         cards where the card room is, slips in the middle aisle, and the shoe, which is the only one anybody mentions. */
      litter("l_chips", 8, 10, "Dropped chips");
      litter("l_cards", 28, 8, "Dropped cards");
      litter("l_slips", 16, 20, "Losing slips");
      litter("l_shoe", 13, 14, "One shoe. Just the one.");
      for (const o of objs) if (REAL_TABLES[o.t]) o.name = `${REAL_TABLES[o.t].name}: ZCoins or tickets`;
      return { g, objs, blobs: [] };
    },
    // the regulars at the machines are simulated players: they walk up to a game, play a while, and move on
    mobs: [], bots: [{ name: "due4aWin", level: 14 }, { name: "SlotGoblin", level: 37 }, { name: "AllInAlan", level: 61 }],
    npcs: [{ name: "Dex the Dealer", art: "dex", x: 35, y: 4, still: true, reach: 2, hair: "#1a1a1a", shirt: "#9a2a2a", pants: "#1a1a1a", lines: ["Drinks and dinner are at the Prize Counter. They help outside, not in here.", "Broke? Outside. Hit something.", "A round for the room is 3,000 tickets. Be a hero."   /* keep in step with BAR.round.price, which is defined below SCENES and so cannot be read from here */] },
      { name: "DookieBetts", art: "dookie", x: 28, y: 18, still: true, reach: 2, hair: "#1a1a1a", shirt: "#c8102e", pants: "#1a1a1a", lines: ["One more. Then one more after that.", "Scared money don't make money.", "You walking away? On THIS streak? Nah."] },
      // the regulars (2026-09-19): nobody here is a good influence
      /* Kellz (the owner, 2026-09-20, in Kellz's own words: a flight suit with a leather flight jacket, light-skinned, long hair "like Jesus"). He wandered the main aisle until v91, when the owner moved him "over to the smoking area": he hangs about between the club chairs now. */
      { name: "Kellz", art: "kellz", x: 36, y: 7,   /* (v94: the owner put him on this tile, at the edge of the smoking section by the sign) */ hair: "#3a2416", shirt: "#6a4a2a", pants: "#5a6a3a", /* (the owner, 2026-09-20: an ULTRA Bills superfan. Loves Josh Allen, and Buffalo's wings are the best there are.) */
        lines: ["GO BILLS. That's it. That's the whole conversation.", "Josh Allen could hurdle this entire casino.", "Seventeen's my lucky number. It should be yours.", "Best wings on earth are in Buffalo. It's not close. Don't start.", "Blue cheese. Never ranch. I will fight you.", "I've gone through a folding table for this team. Twice.", "I'd fly Josh to the Super Bowl myself. Free.", "I only smoke when the Bills are playing. Or not playing."] },
      /* Rony Tomo (the owner, 2026-09-20: "an npc that hangs out by the wheel that looks like tony romo getting drunk... always talking about how
         its the cowboys year", with "WE DEM BOYZ" and "Dez caught it"). A parody like Bom Trady: navy 9, colours and a number, no logo or star. */
      { name: "Rony Tomo", art: "rony", x: 7, y: 17, hair: "#4a3020", shirt: "#1a2a5a", pants: "#c8c8d0", lines: ["THIS is the Cowboys' year. I can feel it.", "WE DEM BOYZ!", "Dez caught it.", "It's our year. *hic* It's been our year since '96.", "How 'bout them Cowboys? ...No, really, how about them?", "One more beer, then a Super Bowl."] },
      { name: "Parlay Pete", art: "pete", x: 40, y: 8, hair: "#3a2a1a", shirt: "#6a6a72", pants: "#3a3a44", lines: ["Five-leg parlay. Can't lose.", "It lost."] },
      { name: "Nana Jackpot", art: "nana", x: 2, y: 8, still: true, hair: "#e8e8e8", shirt: "#e8a0b8", pants: "#8a6a8a", lines: ["Three sevens, dear. That's the dream.", "I've had this machine since Tuesday."] },
      { name: "Rent Money Randy", art: "randy", x: 18, y: 21, hair: "#5a4a3a", shirt: "#8a5a32", pants: "#8a5a32", lines: ["It's fine. Rent's not due till the first.", "Double or nothing fixes everything."] },
      { name: "Vince the Bouncer", art: "vince", x: 21, y: 21, still: true, reach: 2, hair: "#1a1a1a", shirt: "#141418", pants: "#141418", lines: ["Can't go out this door yet. Coming soon.", "Use the arch, west side. That's where everything is.", "Shoes. I always look at the shoes."] },
      { name: "Whale Wendell", art: "wendell", x: 28, y: 8, hair: "#1a1a1a", shirt: "#f4f4f4", pants: "#f4f4f4", lines: ["Twenty a bet. It's the principle.", "Tickets, ZCoins. I've got both. Mostly neither."] },
      /* (2026-09-21) Ronde Barber: hair, face and the vanity rail, all for tickets. `shop: "vanity"` is what the page
         opens his window on — he is the only NPC with it, and the mirror by the front door still does looks too. */
      { name: "Ronde Barber", art: "ronde", x: 28, y: 12, shop: "vanity", hair: "#1a1a1a", shirt: "#f4f4f4", pants: "#2a2a30", lines: ["Chair's free. Something for the head, something for the feet.", "Tickets only. I don't take ZCoins and I don't take excuses.", "You can look like a champion for the price of a good night's fishing.", "Mix and match. Nobody says you have to wear the whole set."] }]
  },
  // through the curtains at the back of the Casino: one big table everyone plays at once
  /* THE PICTURE HOUSE (v118, the owner: "is it possible to create a movie theatre room and wire in the Screen aka movies and
     tv section of eastcoin into eastscape so users could watch shows and stuff there together?" — then: "start with the room
     and the art"). This is the room and nothing else yet. The screen is an object you can walk up to and read; what it will
     open is the site's own Movies & TV, over functions/api/screen/*, whose watch rooms already do the hard part — one person
     hosts and writes their clock, everyone else follows it.

     IT IS NOT IN RADIO.heard ON PURPOSE. Every other indoor room has the jukebox's radio stations playing in it; a cinema is
     the one place a second soundtrack would be wrong. The Green Room follows you in here regardless, since it stopped asking
     where you are, and the mute in the top bar is what silences it when the film starts. */
  theatre: {
    name: "The Picture House", interior: true, floor: "casino", carpet: "t_casino", room: [13, 7, 30, 20],
    exitTo: { scene: "casino", x: 15, y: 5 }, entry: { x: 21, y: 20 },
    wall: [{ t: "banner", x: 14 }, { t: "lamp", x: 16.5 }, { t: "lamp", x: 27.5 }, { t: "banner", x: 29.5 }],
    build() {
      const g = room(13, 7, 30, 20, 21), objs = [];
      /* THE SCREEN: five tiles across the top of the room, its own picture, every tile of it blocked so nobody stands in
         front of it. You walk up to the row below and look up at it, which is what the seats are pointed at. */
      objs.push({ t: "cinescreen", art: "o_cinescreen", x: 20, y: 8, w: 3, h: 2, name: "The screen" }); block(g, 20, 8, 3, 2);   /* w and h match the PICTURE (102x75 art px = 3.2 x 2.3 tiles), so the blocked floor is what you can see */
      objs.push({ t: "projector", art: "o_projector", x: 21, y: 19, name: "The projector" }); g[19][21] = "#";
      objs.push({ t: "popcorn", art: "o_popcorn", x: 15, y: 18, name: "The popcorn machine" }); g[18][15] = "#";
      /* FOUR ROWS OF SEATS with a centre aisle, pointed at the screen. A seat is soft — you stand where you would sit — so a
         row never walls the room off, and the aisle down the middle is what you actually walk up. */
      for (const y of [13, 15, 17]) {
        for (const x of [15, 16, 17, 18, 19, 23, 24, 25, 26, 27, 28]) {
          objs.push({ t: "cineseat", art: "o_cineseat", x, y, name: "A seat", soft: true });
        }
      }
      for (const [x, y] of [[13, 8], [30, 8], [13, 19], [30, 19]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [
      /* (v120, the owner) Andy: Andy Reid with a walrus's head, headset on, burger in hand. He sits in the back row, which is
         where Rhonda told everyone not to sit. */
      { name: "Andy", art: "andy", x: 26, y: 10, still: true, reach: 2, hair: "#3a2a1a", shirt: "#c8102e", pants: "#4a4a52",
        lines: ["Back row's the best row. More leg room.", "I told the projectionist: no timeouts.", "You gonna finish that?", "Clock management is a myth. Pass the popcorn."] },
      { name: "Reel Rhonda", art: "nana", x: 16, y: 19, still: true, reach: 3, hair: "#6a4a2a", shirt: "#8a1a2a", pants: "#2a2028",
        lines: ["Pick something and I'll put it on the big one.", "Popcorn's free. It's always free. Nobody eats it.", "Back row's for talkers. Don't be a talker."] }]
  },
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
});
// island land: an ellipse of grass with a sand edge (the edge next to the water becomes bank)
function isleLand(g, cx, cy, rx, ry) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) g[y][x] = ".";
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === ".") { let wet = false; for (const [dx, dy] of D8) if (g[y + dy]?.[x + dx] === "~") wet = true; if (wet) g[y][x] = "s"; }
}
/* YAHSMEENA, ON EVERY ISLAND (v99, the owner: "add this npc on everyones island and they will eventually be an npc that users can buy
   decor/furniture/etc to decorate their island"; a beta tester asked for the job, and got it for helping). She wears HER OWN
   LOOK: an NPC may carry `look` (the same eight numbers a player's look is) instead of `art`, and the page paints her from the
   look parts like anybody else. She stands by the cottage, on every size of island. The shop itself is not built yet: for
   now she talks. When it is, she is the one who opens it. */
export const ISLE_NPCS = [{ name: "Yahsmeena", tag: "NPC" /* (v100, the owner: over her head it reads "Yahsmeena - NPC") */, look: [3, 9, 3, 0, 0, -1, 5, 0], x: 13, y: 3, still: true, opens: "decor",
  lines: ["Hi, I'm Yahsmeena. I'll be doing the decorating round here: furniture, rugs, the lot.", "The shop's open. Ask to see what I've got.", "Buy it from me, then press Decorate and put it where you like.", "Good taste isn't free. It is, however, for sale.", "That patch by the dock? I'm thinking a bench. Maybe a flamingo. Don't argue.", "Every island gets me. Lucky islands."] }];
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
  /* THE AGILITY COURSE (2026-09-22). A corridor of eight gates. Each is a two-tile-wide shutter across the only way
     forward: stand in the bay, watch the cycle, step through while yours is open. The gates get faster as you go, so
     the course teaches its own rhythm — and because every cycle comes from gateOpenAt(t, gate), the server can gate
     the step and the page can draw the shutter from the same number.
     Walled on every side but the door, so the only route is through the gates. */
  /* ================================================== THE TRAILER PARK (2026-09-22)

     The endgame's other half. The Vault is underground and cosmic; this is a scrapyard with a dog problem, and the
     two sit side by side at levels 80-98 rather than one after the other, so there are two places to be at the top
     of the game instead of one queue.

     WHY IT IS NORTH OF THE THUNDERHEAD and not past the Vault: the road west is a ladder of ten-level bands and the
     Vault is already its end. Hanging another band off the end would make the walk longer for no reason; a turning
     off the last stop makes the top of the game a FORK. The Thunderhead gains one exit, and nothing else about the
     road changes.

     What it is for: the richest gathering in the game. A catalytic converter cut from a truck up on blocks is worth
     more than anything else you can carry out of a scene, slagstone is the best ore, bogwood the best logs, and the
     swamp holds the two fish that cook into the best food. Every one of them asks for a top-rung tool — which is
     what the tool ladder was FOR, and until now nothing above Starfall had anything to work on. */
  trailer: {
    name: "The Trailer Park", exits: { s: "thunderhead" }, tint: "rgba(30,20,10,.18)",
    build() {
      const g = grid(), objs = [], keep = [];
      const put = (o, w = 1, h = 1) => { objs.push(o); if (w > 1 || h > 1) block(g, o.x, o.y, w, h); else g[o.y][o.x] = "#"; keep.push([o.x, o.y]); };
      /* the rutted tracks: one across, one down to the way out. Everything else hangs off them, so wherever you are
         you can see a road and the road goes somewhere. */
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 13; y <= 25; y++) g[y][21] = ",";
      /* THE SWAMP, north-west. It runs ACROSS and not down, because scatterSpots lays its spots in two rows fished
         from the bank above them — a tall pond puts the far ones out of a rod's three-tile reach, which is exactly
         what the first build did. The band gates it at Fishing 80 and the spots say so. */
      for (let y = 4; y <= 8; y++) for (let x = 1; x <= 14; x++) g[y][x] = "~";
      scatterSpots(objs, 2, 13, 4, 5, [1, 2, 3, 5], { name: "Black water", req: { skill: "fishing", lvl: 80 }, fish: "mudcat", fish2: "bowfin", fish2lvl: 88, xp: 300, xp2: 380, glow: "#8ad86a", tease: "Something rolls over out in the middle and goes back down." });
      for (let x = 1; x <= 14; x++) keep.push([x, 3], [x, 9]);
      /* WOODCUTTING, south-west: rustpine on the bank, bogwood out of the swamp itself. 65 and 80, so the Starfall
         and Eclipse axes finally have something above Vaultwood to cut. */
      for (const [x, y] of [[4, 17], [7, 19], [3, 21], [10, 20]]) put({ t: "rustpine", x, y, log: "pinelogs", name: "Rustpine", req: { skill: "woodcutting", lvl: 65 }, xp: 190 });
      for (const [x, y] of [[2, 11], [6, 10], [12, 11]]) put({ t: "bogwood", x, y, log: "bogwoodlogs", name: "Bogwood", req: { skill: "woodcutting", lvl: 80 }, xp: 290 });
      /* MINING, the bank behind the yard: slagstone at 85, the best ore in the game and an Eclipse pickaxe to get it. */
      for (const [x, y] of [[38, 4], [41, 6], [39, 8], [42, 10]]) put({ t: "rock", x, y, ore: "slagstone", name: "Slag bank", req: { skill: "mining", lvl: 85 }, xp: 210 });
      /* THE CARS ON BLOCKS. A `wreck` is a rock that looks like a truck: same handler, same pickaxe, its own picture
         and its own name. Mining 65, so a Starfall pickaxe opens the zone's bread and butter and Eclipse is for the
         slag bank. Scattered through the park rather than penned in, because stripping one is what you do while you
         walk between fights. */
      for (const [x, y] of [[18, 6], [20, 8], [26, 6], [30, 11], [16, 17], [27, 19], [31, 22], [12, 21]])
        put({ t: "wreck", x, y, ore: "catalytic", name: "Truck on blocks", req: { skill: "mining", lvl: 65 }, xp: 175, special: true });
      /* the park itself: four trailers, the burn barrel everyone stands round, and the litter of a lived-in place */
      for (const [x, y, n] of [[17, 2, "The Lomax place"], [24, 3, "A trailer, curtains drawn"], [16, 10, "A trailer with the porch light on"], [28, 16, "A trailer nobody claims"]])
        put({ t: "trailer", x, y, w: 3, h: 2, name: n }, 3, 2);
      put({ t: "fire", x: 20, y: 10, name: "Burn barrel" });
      for (const [x, y] of [[19, 9], [22, 10], [19, 11], [22, 9]]) keep.push([x, y]);
      for (const [x, y] of [[21, 11], [23, 6], [31, 8], [15, 19], [29, 21]]) put({ t: "tyres", x, y, name: "A stack of tyres" });
      for (const [x, y] of [[25, 12], [11, 15], [34, 18]]) put({ t: "dumpster", x, y, name: "A dumpster. Something moved in it." });
      /* THE YARD, east: fenced on three sides with the road as the way in, the way the market's courts are. The King
         stands in the middle of it. The fence is scenery, not a cage — a boss you cannot walk away from is a trap. */
      for (let x = 34; x <= 42; x++) { for (const y of [14, 25]) if (g[y][x] === ".") { objs.push({ t: "fenceH", x, y, name: "Junkyard fence" }); g[y][x] = "#"; keep.push([x, y]); } }
      for (let y = 15; y <= 24; y++) if (g[y][33] === ".") { objs.push({ t: "fenceV", x: 33, y, name: "Junkyard fence" }); g[y][33] = "#"; keep.push([33, y]); }
      for (const [x, y] of [[35, 16], [41, 16], [35, 23], [41, 23]]) put({ t: "lamppost", x, y, name: "A floodlight on a pole" });
      objs.push({ t: "sign", x: 32, y: 13, name: "JUNKYARD. Beep, honk, die." }); g[13][32] = "#";
      objs.push({ t: "sign", x: 20, y: 14, name: "THE TRAILER PARK: Combat 80 and up, and Fishing 80 for the black water. The yard at the east end is the King's. Trucks on blocks give up their converters to a pickaxe." }); g[14][20] = "#";
      objs.push({ t: "sign", x: 21, y: 24, name: "South: back to the Thunderhead." }); g[24][21] = "#";
      /* KEEP THE PLACES PEOPLE STAND. wild() scatters scrub over anything it is not told to leave, and the first
         build handed it the King's whole arena — the boss ended up walled into a solid block of junk. The park's
         middle, the yard's floor and the roads either side of them are held; the EDGES are left to wild(), which
         is what gives the zone its treeline and its litter without anyone having to place it. */
      for (let y = 15; y <= 24; y++) for (let x = 34; x <= 42; x++) keep.push([x, y]);      // the King's yard
      for (let y = 2; y <= 12; y++) for (let x = 15; x <= 32; x++) keep.push([x, y]);       // the park
      for (let y = 14; y <= 23; y++) for (let x = 10; x <= 31; x++) keep.push([x, y]);      // the south side
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      for (let y = 13; y <= 25; y++) keep.push([20, y], [21, y], [22, y]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 10);
      return { g, objs, blobs: [] };
    },
    // the dogs nearest the road, the gator in the swamp, the King alone in his yard
    mobs: [["junkdog", 6, 2], ["junkdog", 15, 2], ["junkdog", 26, 2]   /* (2026-09-22) MOVED OFF THE CAMP. These three sat within reach-plus-wander of Darla and the campfire, and with aggression switched back on for this band that means you cannot hand in a quest or cook without being mauled — the exact complaint that turned attack-on-sight off in the first place. They are along the top edge now, by the scrap, more than seven tiles from both. */, ["junkdog", 30, 5],
      ["possum", 22, 2], ["possum", 27, 11], ["possum", 19, 19], ["possum", 31, 18],
      ["scrapper", 25, 16], ["scrapper", 16, 22], ["scrapper", 29, 8],
      ["gator", 5, 10], ["gator", 11, 10], ["gator", 8, 16],   /* on the shore, not in the water: a mob on a "~" tile cannot move or be reached */
      ["junkking", 38, 19]],
    npcs: [{ name: "Darla", art: "darla", x: 19, y: 11, still: true, quests: ["scrapline", "theking"],   /* an NPC must LIST what it gives: a quest nobody offers is an error the content check catches, not a quest you find by walking about */ hair: "#8a5a2a", shirt: "#b04a3a", pants: "#3a3a48",
      lines: ["Forty years I've lived here. It was worse.", "Don't look at the King. Don't talk to the King. Take his converters and go.",
        "That dog is not mine. That dog is nobody's.", "There's good money in what people leave behind. There's better money in what they bolt on."] }],
    bots: []
  },
  agility: {
    /* An INTERIOR, so the course has real walls. It was built by filling the grid with "#" and cutting a corridor,
       which blocks movement but draws nothing — the run looked like open grass you mysteriously could not cross. */
    name: "The Run", interior: true, floor: "track", wallH: 34, room: [2, 9, 37, 15],
    exitTo: { scene: "workyard", x: 6, y: 6 }, entry: { x: 3, y: 12 }, tint: "rgba(20,26,50,.18)",
    gates: AGIL_GATES,
    build() {
      const g = room(2, 9, 37, 15, 3), objs = [];
      /* the bays between gates are the only floor: a wall either side of the lane turns the room into a corridor */
      for (let x = 2; x <= 37; x++) { g[9][x] = "v"; g[10][x] = "v"; g[14][x] = "v"; g[15][x] = "v"; }
      for (let x = 2; x <= 37; x++) for (let y = 11; y <= 13; y++) g[y][x] = "i";
      for (const gt of AGIL_GATES) { g[gt.y][gt.x] = "i"; g[gt.y + 1][gt.x] = "i"; }
      /* (2026-09-22) THE WAY OUT. room() cuts a door in the south wall at y16, and the two loops above then filled
         rows 14 and 15 with wall and sealed it off — so anyone who walked into The Run could not walk out of it
         again. A short passage from the west end of the lane down to that door, beside where you come in. */
      for (const x of [3, 4]) for (const y of [14, 15]) g[y][x] = "i";
      /* (2026-09-22) The sign was lost when the passage above was carved — the edit that added it replaced the line
         that pushed it — so the course had nothing in it at all to read. It is back, and a board of best laps with
         it: a time nobody can compare is not a time. */
      objs.push({ t: "sign", x: 3, y: 11, name: "THE RUN: eight gates, each quicker than the last. Cross the moment yours opens and it counts as PERFECT. Marks are scattered down the lane — they pay, but fetching one costs you a beat." });
      objs.push({ t: "hsboard", x: 4, y: 11, name: "Best laps" });
      objs.push({ t: "agilend", x: 36, y: 12, name: "The finish" });
      return { g, objs, blobs: [] };
    },
    mobs: [], npcs: [], bots: []
  },
  /* a player's island: one layout per upgrade tier (isle, isle2, isle3), plus the Far Shore past isle3's bridge
     and the cottage inside. Keys are "<layout>:<owner id>". What's planted, shown and painted lives on the owner's
     character (c.isle); the server sends it with each snapshot. Plot and pedestal numbers carry over between tiers. */
  isle: { name: "Island", island: true, exitTo: { scene: "workyard", x: 38, y: 15 }, entry: { x: 10, y: 10 }, build() { return isleBuild(1); }, mobs: [], npcs: ISLE_NPCS, bots: [] },
  isle2: { name: "Island", island: true, wikiHide: true, exitTo: { scene: "workyard", x: 38, y: 15 }, entry: { x: 10, y: 10 }, build() { return isleBuild(2); }, mobs: [], npcs: ISLE_NPCS, bots: [] },
  isle3: { name: "Island", island: true, wikiHide: true, exits: { e: "shore" }, exitTo: { scene: "workyard", x: 38, y: 15 }, entry: { x: 10, y: 10 }, build() { return isleBuild(3); }, mobs: [], npcs: ISLE_NPCS, bots: [] },
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
/* (2026-09-22) WALK AS FAR AS YOU CAN. findPath returns null when the target cannot be reached, and every caller
   treated that as "do nothing" — so a click past a shut agility gate, across water, or behind any temporary
   obstacle silently did NOTHING AT ALL, and the owner found The Run playable on WASD only: "i can only use WASD
   but not click to move everywhere".

   A closed gate is temporary by design, so refusing the whole walk is the wrong answer; walking up to it and
   stopping is what every game does and what the course wants, because you still have to time the step through
   yourself. This reaches for the target, and failing that for the reachable tile CLOSEST to it, nearest-in-steps
   breaking the tie so you never set off the long way round a wall.

   It searches at most SEEK_MAX tiles. A whole map is under a thousand, so the cap only ever bites on a pathological
   grid, and a click must never be able to cost a frame. */
const SEEK_MAX = 1200;
export function pathTowards(g, from, to, reach = 0) {
  const direct = findPath(g, from, to, reach);
  if (direct) return direct;
  const key = (x, y) => y * COLS + x, prev = new Map([[key(from.x, from.y), null]]), q = [{ x: from.x, y: from.y }];
  let best = null, bestD = cheb(from, to), seen = 0;
  while (q.length && seen++ < SEEK_MAX) {
    const c = q.shift(), d = cheb(c, to);
    if (d < bestD) { bestD = d; best = c; }
    for (const [dx, dy] of D8) { const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny); if (!prev.has(k) && canStepIn(g, c.x, c.y, dx, dy)) { prev.set(k, key(c.x, c.y)); q.push({ x: nx, y: ny }); } }
  }
  if (!best) return null;                       // already as close as this grid allows
  const p = []; let k = key(best.x, best.y);
  while (k != null) { p.unshift({ x: k % COLS, y: Math.floor(k / COLS) }); k = prev.get(k); }
  p.shift();
  return p.length ? p : null;
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
  /* (v121) THE VAULT'S FOUR. The House at 70 was the end of the road while the skills run to 99, so there was a thirty-level
     stretch with nothing to fight and nothing to wear. These carry on the same curve the Thunderhead ends on. Only the last
     two drop eclipse, and only the Last Dealer drops the voidglass a suit of it needs — so the final tier is a trip, not a
     grind in one corner. */
  warden:  { name: "Vault Warden", size: "l",  lvl: 74, hp: 150, att: 55, def: 52, max: 14, speed: 2900, box: [22, 38], drops: [["tickets", [140, 320]], ["starfall_ore", 1, 0.3]] },
  pitboss: { name: "The Pit Boss", size: "m",  lvl: 80, hp: 165, att: 60, def: 55, max: 15, speed: 2600, aggro: 5, box: [14, 34], drops: [["tickets", [200, 420]], ["starfall_ore", 1, 0.35]] },
  hoard:   { name: "Coin Hoard",   size: "l",  lvl: 86, hp: 190, att: 64, def: 58, max: 16, speed: 3000, box: [24, 40], drops: [["tickets", [300, 650]], ["eclipse_ore", 1, 0.25]] },
  /* ---- THE TRAILER PARK (2026-09-22). Levels 80-98, so it OVERLAPS the Vault rather than following it: the two
     are the endgame side by side, one underground and cosmic, one a scrapyard with a dog problem. What they carry
     is the pay — the most valuable gathering in the game — which is why they are priced through their drops. */
  junkdog: { name: "Junkyard Dog", size: "s", lvl: 80, hp: 164, att: 60, def: 52, max: 15, speed: 2100, oy: 11, box: [16, 20], aggro: 7, drops: [["bones", [1, 2]]] },
  possum: { name: "Rabid Possum", size: "s", lvl: 84, hp: 176, att: 62, def: 56, max: 15, speed: 2400, oy: 10, box: [14, 18], aggro: 6, drops: [["hide", 1]] },
  scrapper: { name: "The Scrapper", size: "m", lvl: 88, hp: 196, att: 66, def: 60, max: 17, speed: 2700, box: [16, 34], drops: [["catalytic", 1]] },
  gator: { name: "Yard Gator", size: "l", lvl: 92, hp: 224, att: 71, def: 64, max: 18, speed: 3000, oy: 9, box: [30, 22], aggro: 5, drops: [["hide", [1, 2]]] },
  /* (2026-09-22) THE ONLY MONSTER OUTSIDE THE CRYPT WITH A MECHANIC. `enrage` is read generically by the swing, so
     any mob can have one: below `at` of its starting hitpoints it hits `mul` times as hard, once, for the rest of
     the fight. 1.6 and not the crypt's 2 because the crypt's boss is fought by a PARTY and he is not — doubling a
     23-point max hit on one person is not a mechanic, it is a coin flip. The line is said to everyone in the
     scene, because a telegraph nobody sees is just extra damage. */
  junkking: { name: "The Junk King", size: "xl", lvl: 98, hp: 520, att: 80, def: 72, max: 23, speed: 3100, box: [28, 54], aggroWas: 8, drops: [["catalytic", [2, 4]]],
    enrage: { at: 0.5, mul: 1.6, say: "The Junk King throws the wrench into his other hand. \"Now you've annoyed me.\"" } },
  dealer:  { name: "The Last Dealer", size: "l", lvl: 92, hp: 220, att: 70, def: 62, max: 18, speed: 2700, aggro: 6, box: [20, 40], drops: [["tickets", [450, 900]], ["eclipse_ore", 1, 0.3], ["voidglass", 1, 0.2]] },
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
  highwayman: { item: ["hide", 1], rare: [["rattlebean", 0.0125], ["mask", 0.1], ["bookies_amulet", 0.008], ["sharps_gloves", 0.006]] },
  gnasher: { item: ["emerald_ore", 1], rare: [["rattlebean", 0.0125], ["bogplate", 0.03], ["bookies_amulet", 0.01]] },
  moth: { item: ["emerald_ore", 1], rare: [["lanternroot", 0.0125], ["adjusters_visor", 0.01], ["angels_ring", 0.006]] },
  taxwraith: { item: ["receipt", 1], rare: [["lanternroot", 0.0125], ["wraithhood", 0.03], ["menace", 0.02], ["adjusters_visor", 0.01], ["angels_ring", 0.01], ["spiderboots", 0.004]] },
  ghoul: { item: ["diamond_ore", 1], rare: [["bonegourd", 0.0125], ["sharps_gloves", 0.012], ["stake_loafers", 0.008]] },
  /* the Trailer Park. The King is the only thing that drops his two, and at 8% and 5% he is meant to be killed
     many times over — he is a reason to come back, not a box you open once. */
  junkdog:    { item: ["bones", [1, 2]], rare: [["stake_loafers", 0.02], ["spiderboots", 0.01]] },
  possum:     { item: ["hide", 1], rare: [["gamblers_ring", 0.03], ["sharps_gloves", 0.015]] },
  scrapper:   { item: ["catalytic", 1], rare: [["menace", 0.03], ["sharps_gloves", 0.02], ["grudge", 0.01]] },
  gator:      { item: ["hide", [1, 2]], rare: [["bogplate", 0.04], ["spiderboots", 0.02], ["angels_ring", 0.01]] },
  junkking:   { item: ["catalytic", [2, 4]], rare: [["kingcap", 0.08], ["wrench", 0.05], ["angels_ring", 0.04], ["slagstone", 0.5]] },
  understudy: { item: ["diamond_ore", [1, 2]], rare: [["bonegourd", 0.0125], ["sharps_gloves", 0.025]] },
  chandelier: { item: ["cobweb", 1], rare: [["bonegourd", 0.0125], ["lantern", 0.03], ["angels_ring", 0.02], ["spiderboots", 0.01]] },
  ram: { item: ["dragonstone_ore", 1], rare: [["stormcorn", 0.0125], ["grudge", 0.02], ["stake_loafers", 0.015]] },
  // v68: the bands' new residents. One thing each; the buff gear is spread so every band past the Yard can drop some
  toadstool: { item: ["sporecap", 1], rare: [["rattlebean", 0.0125], ["bookies_amulet", 0.006]] },
  boneidle: { item: ["bones", [2, 4]], rare: [["rattlebean", 0.0125], ["mask", 0.05], ["sharps_gloves", 0.008]] },
  twister: { item: ["receipt", 1], rare: [["lanternroot", 0.0125], ["adjusters_visor", 0.008]] },
  counter: { item: ["markedcard", 1], rare: [["lanternroot", 0.0125], ["sharps_gloves", 0.015], ["monocle", 0.03]] },
  shark: { item: ["sharktooth", 1], rare: [["lanternroot", 0.0125], ["bookies_amulet", 0.015], ["menace", 0.01]] },
  stagehand: { item: ["cobweb", 1], rare: [["bonegourd", 0.0125], ["stake_loafers", 0.01]] },
  usher: { item: ["flashlight", 1], rare: [["bonegourd", 0.0125], ["lantern", 0.03], ["adjusters_visor", 0.015]] },
  brainstorm: { item: ["stormjelly", 1], rare: [["stormcorn", 0.0125], ["angels_ring", 0.012]] },
  seagoat: { item: ["dragonstone_ore", [1, 2]], rare: [["stormcorn", 0.0125], ["stake_loafers", 0.02], ["grudge", 0.02]] },
  golem: { item: ["onyx_ore", 1], rare: [["stormcorn", 0.0125], ["bogplate", 0.03], ["gamblers_ring", 0.02]] },
  wolf: { item: ["staticfur", 1], rare: [["stormcorn", 0.0125], ["sharps_gloves", 0.03], ["angels_ring", 0.015]] },
  drake: { item: ["hailshard", 1], rare: [["stormcorn", 0.0125], ["stake_loafers", 0.03], ["spiderboots", 0.015]] },
  house: { item: ["onyx_ore", [1, 3]], rare: [["stormcorn", 0.0125], ["angels_ring", 0.04], ["bookies_amulet", 0.04], ["spiderboots", 0.02]] },
  // once the closed roads' residents: placed again in v68 (olive in the Yard, goat in the Gloam, revenant and angel in Cloudreach)
  olive:      { item: ["olives", [2, 5]], rare: [["monocle", 0.1]] },
  goat: { item: ["manifesto", 1], rare: [["rattlebean", 0.0125], ["toga", 0.25]] },
  revenant: { item: ["dragonstone_ore", 1], rare: [["stormcorn", 0.0125], ["grudge", 0.04], ["menace", 0.03]] },
  angel: { item: ["dragonstone_ore", 1], rare: [["stormcorn", 0.0125]] },
  goose: { item: ["onyx_ore", 1], rare: [["stormcorn", 0.0125], ["stake_loafers", 0.02], ["spiderboots", 0.01]] },
  warden:     { item: ["starfall_ore", [1, 2]], rare: [["angels_ring", 0.03], ["bogplate", 0.02]] },
  pitboss:    { item: ["starfall_ore", [1, 2]], rare: [["bookies_amulet", 0.04], ["gamblers_ring", 0.03]] },
  hoard:      { item: ["eclipse_ore", 1], rare: [["gamblers_ring", 0.05], ["angels_ring", 0.03]] },
  dealer:     { item: ["eclipse_ore", [1, 2]], rare: [["bookies_amulet", 0.06], ["spiderboots", 0.04], ["grudge", 0.03]] }
};
/* WHO ATTACKS ON SIGHT. This was a single `false` (the owner, 2026-09-19: "i dont want any monster to attack on site
   for now, its just too aggressive for a relaxed chill game like this"), and on 2026-09-22 it became a LIST, for a
   reason that does not contradict that one: "in higher tier maps, where higher tier ore/logs/fish exist, some mobs
   need to be aggressive when you get near them. this prevents people from just maining woodcutting and jumping
   straight to the highest tier trees."

   Chill where people learn, dangerous where the loot is worth guarding.

   WHY IT WAS NEEDED AT ALL: `bandBlock` is consulted for FIGHTING and FISHING only — the rock and tree handlers
   never call it — so the Trailer Park's bogwood (95 a log) and slagstone (110 an ore) were reachable at Combat 1,
   for nothing, with every monster in the zone ignoring you. Adding a band gate there would have been a wall; this
   is a risk, which leaves room for someone to pick their moment and get away with it.

   THE GLOAM AND THE MIRE ARE DELIBERATELY ABSENT (gnasher, shark, taxwraith keep their aggroWas and stay calm).
   That is where somebody learns the game with a beer in hand, and being chased by the scenery at level 12 is how
   you lose that person. Aggression starts at the Boneyard, which is where the loot starts being worth the trip.

   Every name here already HAD a reach before the 2026-09-19 switch-off; `aggroWas` kept the number, so this is a
   list of names and no re-balancing. The scenes were built to hold these monsters in corners their reach cannot
   leave — run tools/eastscape-aggro-check.mjs after touching this, which is what proves an aggressive thing cannot
   camp a doorway. */
export const AGGRO_ON = new Set([
  "chandelier", "usher",                       // The Boneyard (30): yewlogs, dragonstone ore
  "revenant", "angel",                         // Cloudreach (40): onyx ore, skyeel
  "wolf", "drake", "house",                    // The Thunderhead (50): thundersquid
  "junkdog", "possum", "gator", "junkking",    // The Trailer Park (80): bogwood, slagstone, bowfin
  "pitboss", "dealer"                          // The Vault
]);
/* AND THE REACH IS CAPPED AT THREE TILES, which is what "when you get near them" means. The old numbers ran to
   SEVEN (a junkdog), set in a world where nothing was ever switched on, and tools/eastscape-aggro-check.mjs is
   blunt about what that costs: at their original reach these monsters can hold the main path, the campfire, the
   fishing spots and Darla herself — you could not hand in a quest in the Trailer Park without being mauled, which
   is precisely the "too aggressive for a relaxed chill game" the 2026-09-19 switch-off was about.
   Three tiles is a monster you walked up to, not a monster that crossed the yard for you. */
export const AGGRO_REACH = 3;
/* Reads `aggro` OR `aggroWas`, because both spellings exist in the table: the older monsters are written with a
   live `aggro` that this loop used to strip, while anything added after the 2026-09-19 switch-off was written with
   `aggroWas` directly, copying what the file looked like by then. Checking only `aggro` silently skipped the second
   group — which is how The Junk King, named in the list above, came out not aggressive at all. */
for (const [k, m] of Object.entries(MOBS)) {
  const had = m.aggro || m.aggroWas; if (!had) continue;
  m.aggroWas = had;
  if (AGGRO_ON.has(k)) m.aggro = Math.min(had, AGGRO_REACH); else delete m.aggro;
}
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
  lanternfish: { to: "clanternfish", lvl: 30, xp: 120, burnStop: 60 }, skyeel: { to: "cskyeel", lvl: 50, xp: 190, burnStop: 80 },
  mudcat: { to: "cmudcat", lvl: 60, xp: 230, burnStop: 88 }, bowfin: { to: "cbowfin", lvl: 70, xp: 270, burnStop: 94 },   // the Trailer Park's swamp: the best food in the game, and the only reason to take Cooking past 50
  perch: { to: "cperch", lvl: 5, xp: 40, burnStop: 25 }, catfish: { to: "ccatfish", lvl: 18, xp: 80, burnStop: 45 }, mudskipper: { to: "cmudskipper", lvl: 22, xp: 95, burnStop: 50 },
  bonefish: { to: "cbonefish", lvl: 32, xp: 125, burnStop: 62 }, ghostcarp: { to: "cghostcarp", lvl: 36, xp: 140, burnStop: 66 }, cloudray: { to: "ccloudray", lvl: 45, xp: 170, burnStop: 75 },
  stormmarlin: { to: "cstormmarlin", lvl: 55, xp: 210, burnStop: 85 }, thundersquid: { to: "cthundersquid", lvl: 60, xp: 230, burnStop: 90 }   // (v104)
})) recipe(`cook_${raw}`, { skill: "cooking", station: "fire", in: [[raw, 1]], out: [c.to, 1], lvl: c.lvl, xp: c.xp, burnStop: c.burnStop });

/* ============================================================ SMOKING (2026-09-22)

   Cooking feeds you; SMOKING buffs you. The difference is charcoal, which is what makes woodcutting matter to a
   fisherman and gives the top of the fishing ladder a reason to exist beyond a bigger number on a sale.

   IT RIDES THE MEAL SYSTEM THAT WAS ALREADY HERE. Dex's dinners are `meal: { mins, fx }` and fxOf already folds a
   meal's fx in with worn gear, so a smoked fish is just another meal — no new buff plumbing, no new timer, and it
   stacks with gear up to the same OUT_CAP as everything else.

   NO XP BUFF, DELIBERATELY. The buff keys are tix, speed, tough, rare, zdrop, bite and heal, and none of them is
   experience. An xp buff plus the Tower is a multiplier on the one thing the Tower exists to pay, and that is the
   sort of thing that looks fine until somebody stacks it for six hours.

   IT SEQUENCES ITSELF, the same way the furnace does. recipesAt sorts level-DESCENDING and a smoke sits above its
   own cook, so a campfire smokes while you have charcoal and drops back to plain cooking when you run out. Nothing
   to toggle. A smoke is worth far more than the charcoal it eats, so spending it is always the right call. */
const SMOKE = {
  ghostcarp:    { lvl: 40, coal: 1, heal: 24, sell: 110, fx: { rare: 0.08 },              blurb: "Drops come a little easier." },
  cloudray:     { lvl: 50, coal: 1, heal: 28, sell: 145, fx: { tough: 0.08 },             blurb: "You take less of a beating." },
  skyeel:       { lvl: 55, coal: 1, heal: 26, sell: 125, fx: { speed: 0.08 },             blurb: "Lighter on your feet." },
  stormmarlin:  { lvl: 60, coal: 2, heal: 31, sell: 140, fx: { tix: 0.10 },               blurb: "Everything pays a bit more." },
  mudcat:       { lvl: 65, coal: 2, heal: 28, sell: 180, fx: { rare: 0.15 },              blurb: "The good stuff turns up." },
  thundersquid: { lvl: 65, coal: 2, heal: 34, sell: 165, fx: { tough: 0.15 },             blurb: "Hits land softer." },
  bowfin:       { lvl: 75, coal: 3, heal: 32, sell: 210, fx: { tough: 0.10, rare: 0.15 }, blurb: "The best thing out of that water." }
};
for (const [raw, sm] of Object.entries(SMOKE)) {
  if (!ITEMS[raw]) continue;
  const key = `s${raw}`, nm = ITEMS[raw].name.replace(/^Raw /, "");
  ITEMS[key] = { name: `Smoked ${nm.toLowerCase()}`, icon: "\u{1F41F}", heal: sm.heal,
    meal: { mins: 20, fx: sm.fx },
    ex: `Smoked slow over charcoal. Eat it for twenty minutes of it: ${sm.blurb}` };
  recipe(`smoke_${raw}`, { skill: "cooking", station: "fire", in: [[raw, 1], ["charcoal", sm.coal]], out: [key, 1], lvl: sm.lvl, xp: Math.round(sm.lvl * 4), ms: 2400 });
}

/* ------------------------------------------------------------ the Casino (2026-09-18)

   Games of chance for tickets, never ZCoins. The server rolls every result; the page only shows it. Each game keeps a
   small edge (a tickets sink, which the economy wants), bets are capped, and big wins are announced so the room feels
   alive. Placeholders to iterate on: the numbers all live here. */
/* (2026-09-22) THE HOUR'S LIMITS, FOR TICKETS. The site's ZCoin floor has had them since it opened — ten plays an
   hour AT EACH GAME and a 400 ZCoin cap on what you can be up across a rolling hour — and this floor, which plays
   the same eight games for tickets, had NONE of it. Only a 900ms gap between bets and the table's maximum.

   The owner, testing: "using tickets for betting doesnt apply the limiter on bets". So the same two rules, at the
   rate tickets convert: a ticket is a thousandth of a ZCoin, the table maximum here is 20,000 to the site's 20, so
   the cap is 400,000 to its 400. Written as the multiplication rather than as the number, so moving one moves both.

   THE CAP BLOCKS A NEW BET AND NEVER TRIMS A WIN ALREADY PAID, which is the site's rule too: somebody who is up
   399,999 may still stake, and may still win big on that stake. What they may not do is start another one.

   PER GAME, not per floor: ten plays at Slots does not stop you playing the Wheel. That is what the site means by
   its ten as well, and a single floor-wide count would quietly be an eighth of the limit it looks like. */
export const TIX_HOUR = { ms: 3600000, perGame: 10, winCap: 400 * 1000, keep: 240 };
/** Trim a play log to the last hour (and to a sane length), newest kept. Pure, so both sides can call it. */
export const recentPlays = (plays, now) => (Array.isArray(plays) ? plays : []).filter((p) => p && now - p.t < TIX_HOUR.ms).slice(-TIX_HOUR.keep);
/** Why this bet is refused, or null. -> { why: "plays" | "cap", n, cap } */
export function tixBlock(plays, g, now) {
  const recent = recentPlays(plays, now);
  const n = recent.filter((p) => p.g === g).length;
  if (n >= TIX_HOUR.perGame) return { why: "plays", n, cap: TIX_HOUR.perGame };
  const net = recent.reduce((a, p) => a + (Number(p.net) || 0), 0);
  if (net >= TIX_HOUR.winCap) return { why: "cap", n: net, cap: TIX_HOUR.winCap };
  return null;
}
export const CASINO = { minBet: 10, maxBet: 20000, betMs: 900, roomWin: 5, worldWin: 25 };   /* (v107) TICKET bets, now that a table takes tickets and PAYS tickets: 10 to 20,000 (20,000 is the ZCoin tables' 20, at 1,000 a ZCoin). It was 1 to 500 when these tables were a side show. */
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
export const WHEEL = { gold: 6, slices: 24, pays: { red: 2.03, black: 2.03, gold: 60 } };   /* (v107: the FAIR prices now, 360/177 and 60, like the site's wheel; each play's draw from the band is what moves them. They were 1.97 and 58.) */   // degrees of gold; the rest is 24 equal slices
export function wheelColor(angle) { const a = ((angle % 360) + 360) % 360; if (a < WHEEL.gold) return "gold"; return Math.floor((a - WHEEL.gold) / ((360 - WHEEL.gold) / WHEEL.slices)) % 2 ? "black" : "red"; }
// Higher or Lower: ranks 1 (ace, low) to 13 (king). A call is priced fairly on the twelve cards that can settle it
// (a tie is a push), and the house's cut comes off once, at cash-out, so a long run isn't shaved on every card.
export const HILO = { edge: 1,   /* (v107: the ladder shown is the fair one; the run's own draw from the band, G.EDGE_BAND, is the edge. It was a flat 0.97.) */ maxMult: 50, maxCards: 12, names: ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] };
export const hiloWays = (rank, call) => (call === "higher" ? 13 - rank : rank - 1);           // how many of the 12 other ranks win
export const hiloFactor = (rank, call) => { const w = hiloWays(rank, call); return w > 0 ? 12 / w : 0; };
export const hiloPays = (stake, mult, edge = HILO.edge) => Math.round(stake * Math.min(HILO.maxMult, mult) * edge);   /* (edge: this RUN's draw from the band, see EDGE_BAND) */
// Mines: the fair price of k safe picks with m bombs is C(25,k)/C(25-m,k); the run cashes itself at the last rung under the cap
export const MINES = { tiles: 25, min: 1, max: 10, edge: 1, maxMult: 50 };   /* (v107: as HILO) */
export function minesMult(m, k, edge = MINES.edge) { let x = 1; for (let i = 0; i < k; i++) x *= (MINES.tiles - i) / (MINES.tiles - m - i); return Math.floor(x * edge * 100) / 100; }   /* (edge: this BOARD's draw from the band; the ladder in the window is the nominal one) */
export function minesTop(m) { let k = 1; while (k < MINES.tiles - m && minesMult(m, k + 1) <= MINES.maxMult) k++; return k; }
// Plinko: 12 rows, 13 buckets. Returns 97.1%; every bucket but the middle pays the stake back or better.
export const PLINKO = { rows: 12, pays: [25, 4, 2, 1.4, 1.1, 1, 0.3, 1, 1.1, 1.4, 2, 4, 25] };
// Scratch-Off: chances in 1000, rarest first. 97.5% back; about three cards in eight win something.
export const SCRATCH = [
  { k: "seven", x: 100, w: 1 }, { k: "diamond", x: 25, w: 3 }, { k: "star", x: 10, w: 10 }, { k: "bell", x: 5, w: 30 },
  { k: "lemon", x: 3, w: 50 }, { k: "cherry", x: 2, w: 120 }, { k: "gem", x: 1, w: 160 }
];
export const FLIP_PAYS = 2;                                             // the fair price (v107; it was 1.95): the play's draw from the band moves it, 1.92 to 2.08
export const DICE = { min: 5, max: 95, rtp: 1 };   /* (v107: fair prices, was 0.97) */                     // win if the roll (1-100) is under your number
export const diceMult = (target) => Math.floor((DICE.rtp * 100 / (target - 1)) * 100) / 100;
// reel weights (of 80) and what three of each pay; about 96.9% back, a win about one spin in three, top prize 1 in 64,000
export const REELS = [
  { k: "cherry", icon: "🍒", w: 30, pay: 5 }, { k: "lemon", icon: "🍋", w: 22, pay: 8 }, { k: "bell", icon: "🔔", w: 14, pay: 15 },
  { k: "star", icon: "⭐", w: 8, pay: 40 }, { k: "diamond", icon: "💎", w: 4, pay: 120 }, { k: "seven", icon: "7️⃣", w: 2, pay: 500 }
];
export const SLOT_TWO_CHERRIES = 1.4;
/* THE BAND (v107; the owner, 2026-09-21: "all games should return between 96-104%, just like they do on the current eastcoin
   casino"). eastcoin.vip draws every PLAY's return uniformly from 96% to 104%, mean exactly 100%, so no game is the smart one
   to farm and nothing can be shopped for (functions/api/casino/_engine.js edgeFor). The ticket tables do the same now. The
   paytables above keep their shapes and their nominal numbers; what a play PAYS is

       stake x nominal multiplier x edge / tableReturn(game, pick)

   where tableReturn is what that nominal table gives back on its own for that pick (97.5% for the coin, 97.1% for Plinko,
   and so on: worked out from the tables below, never typed in). Dividing by it makes the game exactly fair; the draw then
   puts this play somewhere in the band. Hi-Lo and Mines take ONE draw for the whole run (hiloPays / minesMult take it as
   `edge`), so a long run is not shaved card by card. Slots give 2% of every spin to the jackpot, so their table part is
   priced at edge less that slice and the jackpot makes up the rest. The game server is the only thing that draws. */
export const EDGE_BAND = [0.96, 1.04];
export const edgeDraw = (r) => EDGE_BAND[0] + Math.max(0, Math.min(0.999999, r)) * (EDGE_BAND[1] - EDGE_BAND[0]);
const WHEEL_P = (() => { const n = { red: 0, black: 0, gold: 0 }; for (let a = 0; a < 3600; a++) n[wheelColor(a / 10)]++; return { red: n.red / 3600, black: n.black / 3600, gold: n.gold / 3600 }; })();   // (the wheel stops on one of 3,600 tenths of a degree: counted, so it is exact)
const PLINKO_RET = (() => { const n = PLINKO.rows; let c = 1, t = 0; for (let b = 0; b <= n; b++) { t += (c / 2 ** n) * PLINKO.pays[b]; c = (c * (n - b)) / (b + 1); } return t; })();
const SCRATCH_RET = SCRATCH.reduce((a, s) => a + (s.w / 1000) * s.x, 0);
let SLOTS_RET = 0;   // (filled in below slotsPay, which it needs)
/** what the nominal table returns for this game and this pick, 0..1 (res: the play's result, which carries the pick) */
export function tableReturn(g, res = {}) {
  if (g === "cointable") return 0.5 * FLIP_PAYS;
  if (g === "dicetable") { const t = Math.max(DICE.min, Math.min(DICE.max, res.target | 0)); return ((t - 1) / 100) * diceMult(t); }
  if (g === "wheel") return WHEEL_P[res.pick] * WHEEL.pays[res.pick];
  if (g === "plinko") return PLINKO_RET;
  if (g === "scratch") return SCRATCH_RET;
  if (g === "slots") return SLOTS_RET || (SLOTS_RET = (() => { const W = REELS.reduce((a, r) => a + r.w, 0); let t = 0; for (const a of REELS) for (const b of REELS) for (const c of REELS) t += ((a.w * b.w * c.w) / W ** 3) * slotsPay([a.k, b.k, c.k]); return t; })());
  return 1;
}
/** the multiplier a simple game actually pays: its nominal one, made fair, times this play's draw */
export const paidMult = (g, nominal, res, edge) => (nominal > 0 ? (nominal * (g === "slots" ? edge - JACKPOT.slice : edge)) / tableReturn(g, res) : 0);
/* the slots jackpot: 2% of every spin goes into one pot everybody shares; three sevens wins it (a 500 tickets spin
   wins all of it, smaller spins a share in proportion, the rest stays in the pot). The regular pays above were
   trimmed to make room, so slots still return about 96.5% overall. The house seeds it again after a win. */
export const JACKPOT = { slice: 0.02, seed: 20000, cap: 500000 };   /* (v107: grown with the bet limits, 40x; a full-size spin still wins the lot, see jackpotShare) */
export const jackpotShare = (bet) => Math.min(1, bet / CASINO.maxBet);
export function slotsPay(reels) {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return REELS.find((x) => x.k === reels[0]).pay;
  return reels.filter((r) => r === "cherry").length === 2 ? SLOT_TWO_CHERRIES : 0;
}

/* ------------------------------------------------------------ luck: the one buff (2026-09-19 reset)

   The whole game in a line: gamble in the casino; when you want better odds, go and skill or fight. Working in the
   world turns up lucky charms; using one makes your next N bets "lucky", and a lucky win pays `bonus` more. Even
   lucky, every game stays just under 100% back, so the casino can't be turned into a tickets printer. */
/* (2026-09-22) LUCK, CUT THREE WAYS. It was a quarter more likely to find a ZCoin, from a clover every TWELVE
   gathers worth fifteen lucky actions each — which is 1.25 charges earned per gather against one spent per
   action, so anybody skilling was lucky MORE than full time. A permanent buff is not a buff, it is the baseline
   with extra words, and it was quietly making real ZCoins a quarter commoner for everyone outside.

   Now: the bonus is 5% (the owner's number), and the charges are rare enough to be a find. At 1 in 100 and 1 in
   600 a gatherer earns 15/100 + 25/600 ≈ 0.19 charges a gather, so luck is on about a fifth of the time instead
   of always. The ITEMS text below is written FROM these numbers, so the tin cannot lie about what is in it. */
export const LUCK = { bonus: 0, zdrop: 0.05, gather: 1 / 100, shoe: 1 / 600, max: 300 };   // luck is SKILLING's reward alone (2026-09-20): clovers, and rarely a horseshoe
/* The two charms describe themselves. They sit in ITEMS hundreds of lines above LUCK, so they cannot hold a
   template that reads it — which is exactly how "25% more likely" survived the nerf in an earlier draft of this
   change. Written here, after both exist, one number reaches the tin, the buff line and the chat message. */
ITEMS.clover.ex = `Turns up while you fish. Click it: your next ${ITEMS.clover.luck} kills or catches are LUCKY (a real ZCoin is ${Math.round(LUCK.zdrop * 100)}% more likely to drop).`;
ITEMS.horseshoe.ex = `Rare, and only found while fishing. Click it: your next ${ITEMS.horseshoe.luck} kills or catches are LUCKY (a real ZCoin is ${Math.round(LUCK.zdrop * 100)}% more likely to drop).`;
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
/* CHARCOAL STEADIES A FIRE (2026-09-22). One charcoal is spent instead of the burn roll, so a cook that would
   have been lost is not. It only kicks in when the risk is worth the charcoal: below this the fish is cheaper than
   the fuel and spending it is a loss, which is exactly the sort of quiet waste nobody notices until they are out of
   charcoal and do not know why. It also fills a hole that was already open - burnChance has a `range` multiplier
   worth 20%, and the only range in the game is in the CLOSED Cottage, so no player has ever had it. */
export const COAL_STEADY_MIN = 0.10;
export const OUT_CAP = { tix: 0.25, speed: 0.2, tough: 0.3, rare: 0.4, zdrop: 0.75, bite: 0.1, heal: 0.5 };
const OUT_KEYS = ["tix", "speed", "tough", "rare", "zdrop", "bite", "heal"];

/* ============================================================ ACHIEVEMENTS (2026-09-23, the owner)

   Two jobs, in the owner's words: introduce players to mechanics, and push them further with harder goals. The
   FlatMMO model was the reference; what is NOT copied from it is Sleep Points. This game has two currencies and a
   deliberate wall between them, and a third would need its own sinks and its own balance. So: tickets per
   achievement, a POINT score that is only ever a score, and permanent buffs at point MILESTONES.

   BUFFS ARE PER MILESTONE, NEVER PER ACHIEVEMENT, and that is the load-bearing decision. Sixty achievements each
   granting 1% of something compounds into a number nobody chose. ACH_MILES bounds the whole feature by
   construction: whatever gets added to ACH later, the buffs stop where this table stops.

   EVERY TEST IS A PREDICATE OVER THE CHARACTER, not a counter of its own. That is what lets the same table be
   evaluated live after an event AND swept retroactively on login — C.stats has recorded kills, gathering, cooking,
   crafting, deaths and quests since 2026-09-18, so most of this list can be awarded for things people already did
   rather than showing them a panel of zeroes. `on` narrows which events are worth re-testing, so an ore gathered
   does not re-run sixty predicates.
   ============================================================ */
export const ACH_TIERS = {
  novice:  { name: "Novice",  pts: 1,  tix: 60,    col: "#9ad8a0" },
  skilled: { name: "Skilled", pts: 2,  tix: 250,   col: "#7fc8e8" },
  expert:  { name: "Expert",  pts: 3,  tix: 1250,  col: "#c0a0ff" },
  master:  { name: "Master",  pts: 5,  tix: 6000,  col: "#ffb03a" },
  legend:  { name: "Legend",  pts: 10, tix: 25000, col: "#ff6ad5" }
};
/* Points -> a permanent effect. `slots` rides bagMax, the rest ride fxOf, so nothing new is plumbed and the
   existing caps still apply. Two bag slots are deliberate (the owner, 2026-09-23) even though Bom sells five for
   50k-400k: it is about 150,000 tickets of his trade given away, and that was a decision rather than an oversight. */
export const ACH_MILES = [
  [10,  { slots: 1 },      "a pocket sewn onto your bag"],
  [25,  { tix: 0.02 },     "+2% tickets from everything you find"],
  [50,  { speed: 0.03 },   "+3% movement speed"],
  [75,  { rare: 0.03 },    "+3% chance at a rare drop"],
  [100, { slots: 1 },      "another pocket"],
  [150, { tix: 0.05 },     "+5% tickets from everything you find"]
];

const asum = (m) => Object.values(m || {}).reduce((a, v) => a + (Number(v) || 0), 0);
const aOf = (c, map) => (c && c.stats && c.stats[map]) || {};
const aHasKey = (c, map, re) => Object.keys(aOf(c, map)).some((k) => re.test(k));
const aCount = (c, map, re) => Object.entries(aOf(c, map)).reduce((a, [k, v]) => a + (re.test(k) ? v : 0), 0);
const aLvl = (c, sk) => lvlOf(c, sk);
const aSkills = (n) => (c) => Object.keys(SKILLS).every((k) => lvlOf(c, k) >= n);
const ORE = /^(copper|tin|grimstone|voidglass|slagstone|catalytic|[a-z]+_ore)$/;
const LOG = /logs?$/;
const FISHK = new RegExp(`^(${["sardine","perch","trout","catfish","lanternfish","mudskipper","bonefish","ghostcarp","skyeel","cloudray","stormmarlin","thundersquid","mudcat","bowfin"].join("|")})$`);
const CROPK = () => new RegExp(`^(${Object.keys(CROPS).join("|")})$`);

/** id -> { name, blurb, tier, on: [event types worth re-testing], has(c) } */
export const ACH = {
  /* ---- NOVICE: one per mechanic. This tier is the tutorial, and it is why the feature exists. ---- */
  a_swing:    { name: "First Blood",        blurb: "Kill something. Anything.",                      tier: "novice", on: ["kill"],   has: (c) => asum(aOf(c, "kills")) >= 1 },
  a_ore:      { name: "Pick and Mix",       blurb: "Mine your first ore.",                           tier: "novice", on: ["gather"], has: (c) => aHasKey(c, "gathered", ORE) },
  a_log:      { name: "Timber",             blurb: "Chop your first log.",                           tier: "novice", on: ["gather"], has: (c) => aHasKey(c, "gathered", LOG) },
  a_fish:     { name: "Something Bit",      blurb: "Catch your first fish.",                         tier: "novice", on: ["gather"], has: (c) => aHasKey(c, "gathered", FISHK) },
  a_cook:     { name: "Edible",             blurb: "Cook something without ruining it.",             tier: "novice", on: ["cook"],   has: (c) => asum(aOf(c, "cooked")) >= 1 },
  a_burn:     { name: "Charcoal Burner",    blurb: "Burn a log at the furnace. This is Smithing.",    tier: "novice", on: ["craft"],  has: (c) => (aOf(c, "crafted").charcoal | 0) >= 1 },
  a_bar:      { name: "Smelter",            blurb: "Smelt your first bar.",                          tier: "novice", on: ["craft"],  has: (c) => aHasKey(c, "crafted", /_bar$/) },
  a_gear:     { name: "Blacksmith",         blurb: "Hammer a bar into something wearable.",           tier: "novice", on: ["craft"],  has: (c) => Object.keys(aOf(c, "crafted")).some((k) => ITEMS[k] && ITEMS[k].slot) },
  a_forge:    { name: "Sharper",            blurb: "Reforge a piece of gear at the anvil.",           tier: "novice", on: ["forge"],  has: (c) => Object.values(c && c.forge || {}).some((v) => v > 0) },
  a_crop:     { name: "Green Fingers",      blurb: "Harvest something you grew.",                     tier: "novice", on: ["gather"], has: (c) => aHasKey(c, "gathered", CROPK()) },
  a_quest:    { name: "Errand Boy",         blurb: "Finish a quest.",                                 tier: "novice", on: ["quest"],  has: (c) => questsDone(c) >= 1 },
  /* TICKETS, NOT ZCOINS, AND THAT IS NOT A CHOICE. A ticket bet is sent to this server (`t: "bet"`) and lands in
     recordPlay; a real ZCoin bet goes straight from the page to the SITE's /api/casino/* and never touches the
     game server at all, so nothing here can see it. The blurb said "either currency counts" until 2026-09-23 and
     was simply wrong. Making ZCoin plays count means the site telling the game, which is a real piece of work. */
  a_table:    { name: "Sat Down",           blurb: "Play a table for tickets.",           tier: "novice", on: ["play"],   has: (c) => (c && c.stats && c.stats.casPlays | 0) >= 1 },
  a_win:      { name: "Beginner's Luck",    blurb: "Win a hand.",                                     tier: "novice", on: ["play"],   has: (c) => (c && c.stats && c.stats.casBest | 0) > 0 },
  a_died:     { name: "It Happens",         blurb: "Die. Everybody does.",                            tier: "novice", on: ["death"],  has: (c) => (c && c.stats && c.stats.deaths | 0) >= 1 },
  a_pet:      { name: "Company",            blurb: "Find a pet. One kill in a thousand.",             tier: "novice", on: ["kill"],   has: (c) => (c && c.pets || []).length >= 1 },
  a_smoke:    { name: "Smoke Signals",      blurb: "Smoke a fish over charcoal.",                     tier: "novice", on: ["cook"],   has: (c) => aHasKey(c, "cooked", /^s[a-z]+$/) && aHasKey(c, "cooked", new RegExp(`^s(${["ghostcarp","cloudray","skyeel","stormmarlin","mudcat","thundersquid","bowfin"].join("|")})$`)) },
  a_lap:      { name: "Warmed Up",          blurb: "Get round the Run once.",                         tier: "novice", on: ["xp"],     has: (c) => aLvl(c, "agility") >= 2 },
  /* NOT "any skill": Hitpoints starts at 10, so that version was earned by making a character. */
  a_lvl10:    { name: "Getting Somewhere",  blurb: "Reach level 10 in a skill you trained.",          tier: "novice", on: ["xp"],     has: (c) => Object.keys(SKILLS).some((k) => k !== "hp" && lvlOf(c, k) >= 10) },

  /* ---- SKILLED ---- */
  s_kill100:  { name: "Regular",            blurb: "Kill 100 monsters.",                             tier: "skilled", on: ["kill"],   has: (c) => asum(aOf(c, "kills")) >= 100 },
  s_ore250:   { name: "Rock Bottom",        blurb: "Mine 250 ore.",                                  tier: "skilled", on: ["gather"], has: (c) => aCount(c, "gathered", ORE) >= 250 },
  s_log250:   { name: "Lumberjack",         blurb: "Chop 250 logs.",                                 tier: "skilled", on: ["gather"], has: (c) => aCount(c, "gathered", LOG) >= 250 },
  s_fish250:  { name: "Angler",             blurb: "Catch 250 fish.",                                tier: "skilled", on: ["gather"], has: (c) => aCount(c, "gathered", FISHK) >= 250 },
  s_cook100:  { name: "Short Order",        blurb: "Cook 100 things.",                               tier: "skilled", on: ["cook"],   has: (c) => asum(aOf(c, "cooked")) >= 100 },
  s_burn100:  { name: "Kiln",               blurb: "Burn 100 logs into charcoal.",                   tier: "skilled", on: ["craft"],  has: (c) => (aOf(c, "crafted").charcoal | 0) >= 100 },
  s_bars50:   { name: "Foundry",            blurb: "Smelt 50 bars.",                                 tier: "skilled", on: ["craft"],  has: (c) => aCount(c, "crafted", /_bar$/) >= 50 },
  s_lvl25:    { name: "Competent",          blurb: "Reach level 25 in any skill.",                   tier: "skilled", on: ["xp"],     has: (c) => Object.keys(SKILLS).some((k) => lvlOf(c, k) >= 25) },
  s_lvl25all: { name: "Well Rounded",       blurb: "Reach level 25 in every skill.",                 tier: "skilled", on: ["xp"],     has: aSkills(25) },
  s_quest3:   { name: "Useful",             blurb: "Finish three quests.",                           tier: "skilled", on: ["quest"],  has: (c) => questsDone(c) >= 3 },
  s_crypt:    { name: "Not Alone",          blurb: "Clear a crypt with a party.",                    tier: "skilled", on: ["crypt"],  has: (c) => (c && c.stats && c.stats.crypt | 0) >= 1 },
  s_tables:   { name: "Tourist",            blurb: "Play four different tables.",                    tier: "skilled", on: ["play"],   has: (c) => Object.keys(aOf(c, "played")).length >= 4 },
  s_gear:     { name: "Kitted Out",         blurb: "Wear a weapon, a body and a helm at once.",      tier: "skilled", on: ["equip"],  has: (c) => !!(c && c.eq && c.eq.weapon && c.eq.body && c.eq.helm) },
  s_smoke10:  { name: "Smokehouse",         blurb: "Smoke ten fish.",                                tier: "skilled", on: ["cook"],   has: (c) => aCount(c, "cooked", /^s(ghostcarp|cloudray|skyeel|stormmarlin|mudcat|thundersquid|bowfin)$/) >= 10 },
  s_forge2:   { name: "Plus Two",           blurb: "Reforge something to +2.",                       tier: "skilled", on: ["forge"],  has: (c) => Object.values(c && c.forge || {}).some((v) => v >= 2) },
  s_crops3:   { name: "Smallholding",       blurb: "Grow three different crops.",                    tier: "skilled", on: ["gather"], has: (c) => Object.keys(CROPS).filter((k) => (aOf(c, "gathered")[k] | 0) > 0).length >= 3 },
  s_zcoin:    { name: "Real Money",         blurb: "Find a real ZCoin in the world.",                tier: "skilled", on: ["loot"],   has: (c) => (aOf(c, "looted").zcoin | 0) >= 1 },
  s_sessions: { name: "Regular Face",       blurb: "Log in on twenty separate occasions.",           tier: "skilled", on: ["login"],  has: (c) => (c && c.stats && c.stats.sessions | 0) >= 20 },

  /* ---- EXPERT ---- */
  e_kill1k:   { name: "Body Count",         blurb: "Kill 1,000 monsters.",                           tier: "expert", on: ["kill"],   has: (c) => asum(aOf(c, "kills")) >= 1000 },
  e_ore1k:    { name: "Open Cast",          blurb: "Mine 1,000 ore.",                                tier: "expert", on: ["gather"], has: (c) => aCount(c, "gathered", ORE) >= 1000 },
  e_log1k:    { name: "Clear Felling",      blurb: "Chop 1,000 logs.",                               tier: "expert", on: ["gather"], has: (c) => aCount(c, "gathered", LOG) >= 1000 },
  e_fish1k:   { name: "Trawlerman",         blurb: "Catch 1,000 fish.",                              tier: "expert", on: ["gather"], has: (c) => aCount(c, "gathered", FISHK) >= 1000 },
  e_lvl50:    { name: "Serious",            blurb: "Reach level 50 in any skill.",                   tier: "expert", on: ["xp"],     has: (c) => Object.keys(SKILLS).some((k) => lvlOf(c, k) >= 50) },
  e_lvl40all: { name: "No Weak Links",      blurb: "Reach level 40 in every skill.",                 tier: "expert", on: ["xp"],     has: aSkills(40) },
  e_forge3:   { name: "Plus Three",         blurb: "Reforge something to +3, the top.",              tier: "expert", on: ["forge"],  has: (c) => Object.values(c && c.forge || {}).some((v) => v >= 3) },
  e_allfish:  { name: "The Whole Shoal",    blurb: "Catch one of every fish in the game.",           tier: "expert", on: ["gather"], has: (c) => ["sardine","perch","trout","catfish","lanternfish","mudskipper","bonefish","ghostcarp","skyeel","cloudray","stormmarlin","thundersquid","mudcat","bowfin"].every((k) => (aOf(c, "gathered")[k] | 0) > 0) },
  e_allcrop:  { name: "Full Rotation",      blurb: "Grow every crop there is.",                      tier: "expert", on: ["gather"], has: (c) => Object.keys(CROPS).every((k) => (aOf(c, "gathered")[k] | 0) > 0) },
  e_tables:   { name: "Floor Walker",       blurb: "Play every table on the floor.",                 tier: "expert", on: ["play"],   has: (c) => Object.keys(GAMES).every((k) => (aOf(c, "played")[k] | 0) > 0) },
  e_crypt10:  { name: "Grave Robber",       blurb: "Clear ten crypts.",                              tier: "expert", on: ["crypt"],  has: (c) => (c && c.stats && c.stats.crypt | 0) >= 10 },
  e_quests:   { name: "Completionist",      blurb: "Finish every quest in the game.",                tier: "expert", on: ["quest"],  has: (c) => questsDone(c) >= Object.keys(QUESTS).length },
  e_pets3:    { name: "Menagerie",          blurb: "Own three pets.",                                tier: "expert", on: ["kill"],   has: (c) => (c && c.pets || []).length >= 3 },
  e_burn500:  { name: "Charcoal Baron",     blurb: "Burn 500 logs.",                                 tier: "expert", on: ["craft"],  has: (c) => (aOf(c, "crafted").charcoal | 0) >= 500 },

  /* ---- MASTER ---- */
  m_kill5k:   { name: "Industrial",         blurb: "Kill 5,000 monsters.",                           tier: "master", on: ["kill"],   has: (c) => asum(aOf(c, "kills")) >= 5000 },
  m_lvl75:    { name: "Expert Hands",       blurb: "Reach level 75 in any skill.",                   tier: "master", on: ["xp"],     has: (c) => Object.keys(SKILLS).some((k) => lvlOf(c, k) >= 75) },
  m_lvl60all: { name: "Across The Board",   blurb: "Reach level 60 in every skill.",                 tier: "master", on: ["xp"],     has: aSkills(60) },
  m_gather5k: { name: "Hoarder",            blurb: "Gather 5,000 things.",                           tier: "master", on: ["gather"], has: (c) => asum(aOf(c, "gathered")) >= 5000 },
  m_pets:     { name: "The Whole Kennel",   blurb: "Own all five pets.",                             tier: "master", on: ["kill"],   has: (c) => new Set((c && c.pets || []).map((x) => x.k)).size >= Object.keys(PETS).length },
  m_total500: { name: "Five Hundred",       blurb: "Reach a total level of 500.",                    tier: "master", on: ["xp"],     has: (c) => totalOf(c) >= 500 },
  m_zcoin10:  { name: "Prospector",         blurb: "Find ten real ZCoins.",                          tier: "master", on: ["loot"],   has: (c) => (aOf(c, "looted").zcoin | 0) >= 10 },
  m_allmobs:  { name: "Exterminator",       blurb: "Kill at least one of every monster.",            tier: "master", on: ["kill"],   has: (c) => Object.keys(MOBS).every((k) => (aOf(c, "kills")[k] | 0) > 0) },

  /* ---- LEGEND ---- */
  l_lvl50all: { name: "Nothing Left Out",   blurb: "Reach level 50 in every single skill.",          tier: "legend", on: ["xp"],     has: aSkills(50) },
  l_total700: { name: "Seven Hundred",      blurb: "Reach a total level of 700.",                    tier: "legend", on: ["xp"],     has: (c) => totalOf(c) >= 700 },
  l_kill25k:  { name: "The Reaper",         blurb: "Kill 25,000 monsters.",                          tier: "legend", on: ["kill"],   has: (c) => asum(aOf(c, "kills")) >= 25000 },

  /* ---- the odd ones. Not a tier of their own: they sit where their difficulty puts them. ---- */
  o_burnt:    { name: "Smoke Alarm",        blurb: "Burn 50 fish to a crisp.",                       tier: "novice",  on: ["burn"],  has: (c) => (c && c.stats && c.stats.burnt | 0) >= 50 },
  o_broke:    { name: "Easy Come",          blurb: "Lose a piece of gear at the anvil.",             tier: "skilled", on: ["forge"], has: (c) => (c && c.stats && c.stats.forgeBroke | 0) >= 1 },
  o_deaths:   { name: "Persistent",         blurb: "Die fifty times and keep turning up.",           tier: "skilled", on: ["death"], has: (c) => (c && c.stats && c.stats.deaths | 0) >= 50 },
  o_down:     { name: "The House Always Wins", blurb: "Be 10,000 tickets down across the tables.",   tier: "skilled", on: ["play"],  has: (c) => (c && c.stats && c.stats.casNet | 0) <= -10000 },
  o_up:       { name: "Beating The House",  blurb: "Be 10,000 tickets up across the tables.",        tier: "expert",  on: ["play"],  has: (c) => (c && c.stats && c.stats.casNet | 0) >= 10000 },
  o_hours:    { name: "Where Did It Go",    blurb: "Spend a full day of your life in here.",         tier: "expert",  on: ["login"], has: (c) => (c && c.stats && c.stats.playMs || 0) >= 24 * 3600 * 1000 }
};

/** every id this character has earned, as a Set */
export const achSet = (c) => new Set(Array.isArray(c && c.ach) ? c.ach : []);
/** their score */
export const achPts = (c) => { let n = 0; for (const id of achSet(c)) { const a = ACH[id]; if (a) n += ACH_TIERS[a.tier].pts; } return n; };
/** every milestone reached, folded into one fx object plus bag slots */
export const achFx = (c) => {
  const pts = achPts(c), out = { slots: 0 };
  for (const [at, fx] of ACH_MILES) if (pts >= at) for (const k in fx) out[k] = (out[k] || 0) + fx[k];
  return out;
};
/** which ids they now qualify for and do not have. Cheap: `on` narrows it unless the caller asks for everything. */
export const achDue = (c, type) => {
  const have = achSet(c), out = [];
  for (const [id, a] of Object.entries(ACH)) {
    if (have.has(id)) continue;
    if (type && !(a.on || []).includes(type)) continue;
    try { if (a.has(c)) out.push(id); } catch (e) { /* a save shaped oddly must never stop a kill from paying */ }
  }
  return out;
};

export function fxOf(c) {
  const worn = SLOTS.map((k) => ITEMS[c?.eq?.[k]]?.fx).filter(Boolean), power = 1 + worn.reduce((a, f) => a + (f.power || 0), 0), out = Object.fromEntries(OUT_KEYS.map((k) => [k, 0]));
  for (const f of worn) for (const k of OUT_KEYS) out[k] += (f[k] || 0) * power;
  for (const st of [c?.meal, c?.drink]) { const it = st && (st.left | 0) > 0 && ITEMS[st.k], f = it && (it.meal || it.drink)?.fx; if (f) for (const k of OUT_KEYS) out[k] += f[k] || 0; }
  if ((c?.luck | 0) > 0) out.zdrop += LUCK.zdrop;
  { const a = achFx(c); for (const k of OUT_KEYS) out[k] += a[k] || 0; }   /* (2026-09-23) achievement milestones, before the caps below so they cannot escape them */
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
  if (it.meal) it.ex = `${it.ex || ""} Eat it: for ${it.meal.mins} minutes outside, ${fxText(it.meal.fx)}.`.trim();
  if (it.drink) it.ex = `${it.ex || ""} For ${it.drink.mins} minutes outside: ${fxText(it.drink.fx)}.`.trim();
}

/* BUFFS: whatever is changing how the casino treats you right now, shown top-right of the game. buffsOf returns them
   ready to draw: { id, name, icon (an item icon), ex, left (null for something worn), unit }. */
export const buffsOf = (c) => {
  const out = [], one = (id, name, icon, ex, left = null, unit = "kill or catch") => out.push({ id, name, icon, ex, left, unit });
  if ((c?.luck | 0) > 0) one("luck", "Lucky", "clover", `A real ZCoin is ${LUCK.zdrop * 100}% more likely to drop. One is used up per kill or catch. Only fishing finds clovers.`, c.luck | 0);
  for (const st of [c?.meal, c?.drink]) { const it = st && (st.left | 0) > 0 && ITEMS[st.k]; if (it) one(it.meal ? "meal" : "drink", it.short || it.name, st.k, `${it.name}: ${fxText((it.meal || it.drink).fx)}. The clock only runs while you're outside.`, Math.max(1, Math.ceil((st.left | 0) / 60000)), "minute"); }
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
export const BANDS = { workyard: [1, 9], gloam: [10, 19], mire: [20, 29], boneyard: [30, 39], cloud: [40, 49], thunderhead: [50, 99], trailer: [80, 99] };   /* (2026-09-22) the Trailer Park: Combat 80 to start a fight there, Fishing 80 for the black water — the same soft gate as everywhere, on the two skills separately */
/* THE HOSPITAL BILL (the owner, 2026-09-19: "lets do #1"): dying outside costs a share of the tickets you are CARRYING, capped by
   where you died, so the Yard stays forgiving. Nothing else is ever touched: gear, the bag, ZCoins, experience, the bank. The tickets go
   nowhere: a sink. (Tickets can't be banked, so there is always something for the bill to take from.) */
export const DEATH = { workyard: { share: 0.05, cap: 250 }, gloam: { share: 0.1, cap: 1000 }, mire: { share: 0.1, cap: 2000 }, boneyard: { share: 0.1, cap: 3500 }, cloud: { share: 0.1, cap: 5000 }, thunderhead: { share: 0.1, cap: 6000 }, vault: { share: 0.1, cap: 8000 }, trailer: { share: 0.1, cap: 9000 } };
export const deathBill = (c, scene) => { const d = DEATH[String(scene || "").split(":")[0]]; return d ? Math.min(d.cap, Math.floor(tixIn(c) * d.share)) : 0; };
export const bandOf = (scene) => BANDS[String(scene || "").split(":")[0]] || null;
/** Why this character can't fight / fish in this scene yet, or null if they can. kind: "fight" | "fish". */
export const bandBlock = (c, scene, kind) => { const b = bandOf(scene); if (!b) return null; const skill = kind === "fish" ? "fishing" : "melee", need = b[0], have = lvlOf(c, skill);
  return have >= need ? null : { need, have, skill, text: `needs ${kind === "fish" ? "Fishing" : "Combat"} ${need}` }; };
export const OPEN = new Set(["casino", "roulette", "theatre", "fightpit", "vault", "wild", "deep", "agility",   /* (2026-09-22) The Run. Built with the Agility skill but never added here, so its door in the Yard answered with the bouncer's "Room's shut" — a scene is not enterable until it is in this set. */   /* (2026-09-22) the Wilderness reopened, down the rope ladder on the Gloam */ /* "highroller": closed for now (the owner, 2026-09-19) */ /* "forum", "bathhouse": closed in v108, what mattered there is in the Yard */ "workyard", "gloam", "mire", "boneyard", "cloud", "thunderhead", "trailer"]);   // (paddock, rough, boneyard closed 2026-09-20: their monsters live in the three scenes of the one line out)
export const OPEN_DAILY = new Set([
  /* (2026-09-22) the top band's twelve. A task only reaches anyone whose levels allow it (dailyFor filters on
     `req`), so opening them costs a low-level player nothing — they will never be drawn. */
  "wardens", "hoards", "dealers", "junkdogs", "possums", "scrappers", "gators", "theking", "converters", "slag", "bogwood", "mudcats",
  "sardine", "lantern", "trout", "cows", "chickens", "rotten", "boar", "highwayman", "moths", "ghouls", "rams",
  "olive", "hornworms", "perch", "toadstools", "goats", "boneidle", "gnashers", "catfish", "twisters", "counters", "sharks", "wraiths", "mudskipper", "stagehands", "spiders", "ushers", "understudies", "bonefish", "ghostcarp",
  "brainstorms", "revenants", "seagoats", "angels", "skyeel", "cloudray", "golems", "geese", "wolves", "drakes", "thehouse", "marlin", "squid"]);   // kills and fish: that's the world now
for (const k of Object.keys(SCENES)) if (!OPEN.has(k)) SCENES[k].wikiHide = true;   // closed areas stay out of the wiki

/* ------------------------------------------------------------ the House Tour: how a new player learns the loop

   Gamble first, run dry, do a job, get paid, come back. Dex walks you through it once, inside the casino. `step` is
   an index into TOUR; TOUR.length means finished. (Paid in tickets for now; the DEX exchange slots into the last step.) */
export const TOUR = [
  { id: "meet",  text: "Say hello to Dex, behind the bar" },
  /* (2026-09-22) SECOND, not sixth. Your kit starts in the bag, so this is the first thing to do with it — and it
     comes before the step that sends you outside to fight, which is when wearing it starts to matter. */
  { id: "gear",  text: "Your kit is in your bag — open the Equipment tab (the helmet) and put it on" },
  /* (v96, a beta tester: "how do i use that free chip?") THERE IS NO FREE CHIP ANY MORE, and this step could not be finished: the floor's
     tables became eastcoin.vip's own (ZCoins, or 1,000 tickets a ZCoin), Dex's gift is 10 tickets, and only the old ticket tables
     ever told the tour somebody had played. Now any play at a real table finishes it (the window tells the game server, which
     takes its word: the tour pays 60 tickets, once), and so does reading the job board, so a player with no ZCoins is sent to
     earn tickets instead of being stuck. */
  { id: "play",  text: "Play any game on the floor: your ZCoins work here, same as the site. None? Read the job board instead" },
  { id: "board", text: "Read the task board, left of the bar" },
  { id: "job",   text: "Do a job: outside in the Yard, and beat 3 chickens or catch 5 fish (hold the rod to fish)" },
  { id: "paid",  text: "Go back to Dex and get paid" },
  /* (2026-09-22, the owner: "expand the tutorial a bit to include explainer about equippable gear, using Bom
     Trady/trading in tickets/buying gear, and users personal islands"). Each of these has a real trigger on the
     server — equip, the Prize Counter, and arriving on your own island — so none of them can dead-end the tour.
     They come AFTER `paid` on purpose: all three cost money, and `paid` is where a new player first has some. */
  { id: "trade", text: "See Bom Trady at the Prize Counter: he turns tickets into ZCoins, and sells the gear worth wearing" },
  { id: "isle",  text: "Talk to Charon the Ferryman to see your own island — everyone gets one, and it is yours to build on" }
];
/* TOUR_CHIP is the handful Dex gives you for saying hello. It was 10 — not enough to bet with, so the very next
   thing the tour asked ("play any game") could not be done. 5,000 is one minimum bet at the ticket tables. */
/* TOUR_PAY was 60, set back when TOUR_CHIP was 10. Beside a 5,000 starting chip it read as an insult for a job
   that asks you to go outside and kill three chickens, so it matches the chip: one more minimum bet. */
export const TOUR_CHIP = 5000, TOUR_PAY = 5000, TOUR_GIFT = "clover", TOUR_JOB = { fish: 5, chickens: 3 };
export const tourOf = (c) => (c?.tour && c.tour.step < TOUR.length ? TOUR[c.tour.step] : null);
export const HOWTO = `PLAY. Click a table. Every game takes ZCoins or tickets. Wins pay real ZCoins. Press G for the list.

OUT OF TICKETS? Outside. Hit something, or fish. Nothing out there attacks first.

BOM TRADY, in the middle of the floor, runs the Prize Counter: trade in your drops, buy gear, food and drinks.

SIX SCENES, ONE ROAD (follow the signs, it isn't always west): the Yard 1-9, the Gloam 10-19, the Lantern Mire 20-29, the Boneyard 30-39, Cloudreach 40-49, the Thunderhead 50+.

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
  { id: "logs", what: "gather", k: "logs", n: 50, cash: 750, req: null },
  { id: "tin", what: "gather", k: "tin", n: 25, cash: 600, req: null },
  { id: "copper", what: "gather", k: "copper", n: 25, cash: 600, req: null },
  { id: "sardine", what: "gather", k: "sardine", n: 20, cash: 500, req: null },
  { id: "wheat", what: "gather", k: "wheat", n: 30, cash: 450, req: null },
  { id: "olives", what: "gather", k: "olives", n: 40, cash: 550, req: null },
  { id: "cows", what: "kill", k: "cow", n: 5, cash: 400, req: null },
  { id: "chickens", what: "kill", k: "chicken", n: 10, cash: 400, req: null },
  { id: "rotten", what: "kill", k: "rotten", n: 8, cash: 600, req: null },
  { id: "trout", what: "gather", k: "trout", n: 20, cash: 800, req: { skill: "fishing", lvl: 10 } },
  { id: "boar", what: "kill", k: "boar", n: 6, cash: 1000, req: { skill: "melee", lvl: 8 } },
  { id: "highwayman", what: "kill", k: "highwayman", n: 5, cash: 1300, req: { skill: "melee", lvl: 12 } },
  { id: "ashlogs", what: "gather", k: "ashlogs", n: 20, cash: 1750, req: { skill: "woodcutting", lvl: 20 } },
  { id: "emerald", what: "gather", k: "emerald_ore", n: 15, cash: 2000, req: { skill: "mining", lvl: 15 } },
  { id: "moths", what: "kill", k: "moth", n: 8, cash: 1900, req: { skill: "melee", lvl: 20 } },
  { id: "lantern", what: "gather", k: "lanternfish", n: 12, cash: 1000, req: { skill: "fishing", lvl: 20 } },
  { id: "diamond", what: "gather", k: "diamond_ore", n: 12, cash: 2600, req: { skill: "mining", lvl: 25 } },
  { id: "ghouls", what: "kill", k: "ghoul", n: 6, cash: 2600, req: { skill: "melee", lvl: 30 } },
  { id: "willow", what: "gather", k: "willowlogs", n: 20, cash: 2800, req: { skill: "woodcutting", lvl: 15 } },
  { id: "rams", what: "kill", k: "ram", n: 6, cash: 3500, req: { skill: "melee", lvl: 40 } },
  { id: "dragonstone", what: "gather", k: "dragonstone_ore", n: 10, cash: 4000, req: { skill: "mining", lvl: 30 } },
  /* v70: THE SIX BANDS' JOBS. One for every monster and every fish outside, each asking for the level its scene does (a kill
     job's `req` is Combat, a fish job's is Fishing), so the board only ever hands you work you can walk to and start. A job
     pays a bonus of about 45% of what those kills or catches are worth anyway. */
  { id: "olive", what: "kill", k: "olive", n: 8, cash: 625, req: { skill: "melee", lvl: 5 } },
  { id: "hornworms", what: "kill", k: "hornworm", n: 6, cash: 600, req: { skill: "melee", lvl: 6 } },
  { id: "perch", what: "gather", k: "perch", n: 20, cash: 550, req: { skill: "fishing", lvl: 5 } },
  { id: "toadstools", what: "kill", k: "toadstool", n: 8, cash: 650, req: { skill: "melee", lvl: 10 } },
  { id: "goats", what: "kill", k: "goat", n: 6, cash: 575, req: { skill: "melee", lvl: 10 } },
  { id: "boneidle", what: "kill", k: "boneidle", n: 6, cash: 1075, req: { skill: "melee", lvl: 14 } },
  { id: "gnashers", what: "kill", k: "gnasher", n: 5, cash: 900, req: { skill: "melee", lvl: 16 } },
  { id: "catfish", what: "gather", k: "catfish", n: 15, cash: 750, req: { skill: "fishing", lvl: 15 } },
  { id: "twisters", what: "kill", k: "twister", n: 8, cash: 1300, req: { skill: "melee", lvl: 20 } },
  { id: "counters", what: "kill", k: "counter", n: 6, cash: 1200, req: { skill: "melee", lvl: 22 } },
  { id: "sharks", what: "kill", k: "shark", n: 5, cash: 1600, req: { skill: "melee", lvl: 24 } },
  { id: "wraiths", what: "kill", k: "taxwraith", n: 5, cash: 1600, req: { skill: "melee", lvl: 26 } },
  { id: "mudskipper", what: "gather", k: "mudskipper", n: 12, cash: 750, req: { skill: "fishing", lvl: 25 } },
  { id: "stagehands", what: "kill", k: "stagehand", n: 6, cash: 2500, req: { skill: "melee", lvl: 30 } },
  { id: "spiders", what: "kill", k: "chandelier", n: 4, cash: 1650, req: { skill: "melee", lvl: 32 } },
  { id: "ushers", what: "kill", k: "usher", n: 5, cash: 2150, req: { skill: "melee", lvl: 34 } },
  { id: "understudies", what: "kill", k: "understudy", n: 5, cash: 2325, req: { skill: "melee", lvl: 36 } },
  { id: "bonefish", what: "gather", k: "bonefish", n: 15, cash: 950, req: { skill: "fishing", lvl: 30 } },
  { id: "ghostcarp", what: "gather", k: "ghostcarp", n: 12, cash: 975, req: { skill: "fishing", lvl: 35 } },
  { id: "brainstorms", what: "kill", k: "brainstorm", n: 8, cash: 4450, req: { skill: "melee", lvl: 40 } },
  { id: "revenants", what: "kill", k: "revenant", n: 5, cash: 3250, req: { skill: "melee", lvl: 43 } },
  { id: "seagoats", what: "kill", k: "seagoat", n: 5, cash: 3200, req: { skill: "melee", lvl: 44 } },
  { id: "angels", what: "kill", k: "angel", n: 5, cash: 3225, req: { skill: "melee", lvl: 46 } },
  { id: "skyeel", what: "gather", k: "skyeel", n: 12, cash: 1075, req: { skill: "fishing", lvl: 40 } },
  { id: "cloudray", what: "gather", k: "cloudray", n: 12, cash: 1300, req: { skill: "fishing", lvl: 45 } },
  { id: "golems", what: "kill", k: "golem", n: 6, cash: 4600, req: { skill: "melee", lvl: 50 } },
  { id: "geese", what: "kill", k: "goose", n: 6, cash: 4925, req: { skill: "melee", lvl: 52 } },
  { id: "wolves", what: "kill", k: "wolf", n: 5, cash: 4050, req: { skill: "melee", lvl: 56 } },
  { id: "drakes", what: "kill", k: "drake", n: 5, cash: 4650, req: { skill: "melee", lvl: 60 } },
  { id: "thehouse", what: "kill", k: "house", n: 2, cash: 2500, req: { skill: "melee", lvl: 65 } },
  { id: "marlin", what: "gather", k: "stormmarlin", n: 12, cash: 1200, req: { skill: "fishing", lvl: 50 } },
  { id: "squid", what: "gather", k: "thundersquid", n: 10, cash: 1175, req: { skill: "fishing", lvl: 58 } },
  // things you MAKE (2026-09-20): the workshop gets its share of the board, so ore has somewhere better to go than the Cashier
  { id: "bars", what: "make", k: "bronze_bar", n: 10, cash: 1100, req: { skill: "smithing", lvl: 10 } },
  { id: "cooked", what: "make", k: "cchicken", n: 8, cash: 550, req: null },
  { id: "dinners", what: "make", k: "chickendinner", n: 3, cash: 1000, req: { skill: "cooking", lvl: 3 } },
  { id: "steaks", what: "make", k: "steakdinner", n: 3, cash: 1600, req: { skill: "cooking", lvl: 8 } },
  { id: "swords", what: "make", k: "bronze_sword", n: 3, cash: 1900, req: { skill: "smithing", lvl: 10 } },
  /* ---- THE TOP BAND (2026-09-22) ----
     The board stopped at the Thunderhead, so the two endgame zones fed it nothing: a level-90 player's daily
     tasks were all level-50 work. These follow the same curve the rest of the table does, which is roughly the
     monster's bounty times the count, and they carry their own `req` so they only appear once you could do them.
     The gathering ones are worth more than the kills for once, because catalytic converters and slagstone are
     worth more than anything else you can carry. */
  { id: "wardens", what: "kill", k: "warden", n: 5, cash: 5200, req: { skill: "melee", lvl: 74 } },
  { id: "hoards", what: "kill", k: "hoard", n: 5, cash: 5900, req: { skill: "melee", lvl: 86 } },
  { id: "dealers", what: "kill", k: "dealer", n: 4, cash: 6300, req: { skill: "melee", lvl: 92 } },
  { id: "junkdogs", what: "kill", k: "junkdog", n: 8, cash: 5400, req: { skill: "melee", lvl: 80 } },
  { id: "possums", what: "kill", k: "possum", n: 7, cash: 5600, req: { skill: "melee", lvl: 84 } },
  { id: "scrappers", what: "kill", k: "scrapper", n: 6, cash: 6000, req: { skill: "melee", lvl: 88 } },
  { id: "gators", what: "kill", k: "gator", n: 5, cash: 6400, req: { skill: "melee", lvl: 92 } },
  { id: "theking", what: "kill", k: "junkking", n: 2, cash: 9000, req: { skill: "melee", lvl: 95 } },
  { id: "converters", what: "gather", k: "catalytic", n: 12, cash: 6800, req: { skill: "mining", lvl: 65 } },
  { id: "slag", what: "gather", k: "slagstone", n: 10, cash: 7200, req: { skill: "mining", lvl: 85 } },
  { id: "bogwood", what: "gather", k: "bogwoodlogs", n: 15, cash: 5800, req: { skill: "woodcutting", lvl: 80 } },
  { id: "mudcats", what: "gather", k: "mudcat", n: 15, cash: 5500, req: { skill: "fishing", lvl: 80 } }
];
export const DAILY_COUNT = 6;   /* (v111, the owner: "i want more dailies and the payouts need to be about 5x what they currently are", with RPG MO's board as the model. Every `cash` above was multiplied by five in the same change: a job used to hand you about 45% of what the kills were worth anyway, and now it is about twice, which is the point of a job.) */
export const chicagoDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
// the day's three for a character: the ones their levels allow, shuffled by who and which day
export function dailyFor(c, id, day) {
  const ok = DAILY.filter((t) => OPEN_DAILY.has(t.id) && (!t.req || lvlOf(c, t.req.skill) >= t.req.lvl));
  /* (2026-09-22) THE BOARD GROWS WITH YOU. Filtering only on `req` means every task you have ever outgrown stays
     in the hat for ever, and since there are four times as many easy ones as hard ones, a level-90 was being sent
     to kill six chickens for 400 tickets — about a minute of their real earnings.
     `cash` already ranks the table by how much work a task is, so the cheapest qualifying half is dropped before
     the draw: the top KEEP_SHARE of what you can do, never fewer than KEEP_MIN so there is still variety and a
     beginner (who qualifies for little) loses nothing at all. The six are still picked by the same seeded shuffle,
     so a day's board is the same every time you look at it. */
  const KEEP_SHARE = 0.55, KEEP_MIN = 14;
  const ranked = [...ok].sort((a, b) => b.cash - a.cash).slice(0, Math.max(KEEP_MIN, Math.ceil(ok.length * KEEP_SHARE)));
  const seed = [...`${id}:${day}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  return ranked.map((t, i) => [hashRand(i, seed, 97), t]).sort((a, b) => a[0] - b[0]).slice(0, DAILY_COUNT).map(([, t]) => t.id);
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
  onyx:        [["onyx_ore", 2], ["grimstone", 1]],        // Cloudreach, Mining 50, plus a trip to the Wilderness
  /* (v121) the Vault's two. Each wants a trip as well as a pickaxe, the way onyx does, so the last tiers are never just
     a question of standing still and mining for long enough. */
  starfall:    [["starfall_ore", 2], ["onyx_bar", 1]],     // the Vault, Mining 60, on top of a bar of the tier below
  eclipse:     [["eclipse_ore", 2], ["voidglass", 1]]      // the Vault's floor, Mining 70, plus the glass from its windows
};
// how many bars a piece takes — the big slots cost more, and a maul costs most
/* (2026-09-22) the tool rungs smith like everything else, so a miner can make the next pickaxe out of what they mined. */
/* ring/amulet added 2026-09-23 (the owner). They are SMITHED - RECIPES has <tier>_ring at 2 bars and <tier>_amulet
   at 3 - so these are the ordinary rule, "a reforge costs what the piece cost", and not a judgement call. (They were
   excluded for want of a BARS entry alone, nothing more.) Be aware they are the best-value reforge in the game: the
   floor is per STAT and jewelry is the only gear carrying three, so a level moves all three and +3 doubles a ring
   outright. If that proves too strong, the lever is the ladder or the floor - NOT these two numbers, which have to
   keep matching the recipe. */
const BARS = { body: 5, legs: 3, shield: 3, helm: 2, boots: 1, gloves: 1, gladius: 1, sword: 2, maul: 3, pickaxe: 2, axe: 2, rod: 1, ring: 2, amulet: 3 };

/* ============================================================ CHARCOAL (2026-09-22)

   WOODCUTTING HAD NO DOWNSTREAM. Every other gathering skill fed something — ore became bars, fish became food —
   and logs were the one thing in the game you could only sell. So a fire needs feeding: every smelt now takes
   charcoal, and charcoal is burnt logs. That gives woodcutting demand of exactly the same shape mining has, which
   also means the two balance against each other from now on instead of needing their prices tuned in step.

   IT BURNS AT THE FURNACE, NOT A CAMPFIRE, for a mechanical reason. A campfire is an `auto` station: it makes the
   best thing it can, so burn recipes there would quietly turn a woodcutter's logs into charcoal while they were
   trying to cook fish. At the furnace the ordering does the work for us — recipesAt sorts by level DESCENDING, so
   the smelts are tried first and the burns (level 1) are last. With ore and no charcoal every smelt fails canMake,
   the furnace burns a log instead, and the next pass smelts. It sequences itself and needs no new interface.

   BETTER LOGS BURN BETTER, which is the whole reason the high-tier trees exist. One charcoal is one charcoal, so
   without this nobody would ever chop bogwood for fuel — they would chop the cheapest thing and carry more trips.
   Yield rises with the log instead: a bogwood gives four, so one log fuels an eclipse bar where it would take four
   ordinary ones and most of a bag. The pressure is inventory space and walking, not a gate.

   CHARCOAL SELLS FOR LESS THAN A LOG (8 against 10) ON PURPOSE. Burning to sell has to be a loss, or it becomes a
   money press that has nothing to do with smithing. It is an industrial input and it is priced like one. */
ITEMS.charcoal = { name: "Charcoal", icon: "⬛", ex: "Burnt logs, light and filthy. The furnace won't run without it. Better wood gives more of it." };

/* How much a bar costs to fuel, by tier: bronze through eclipse. */
const CHAR_FUEL = [1, 1, 2, 2, 3, 3, 4];
/* What a log is worth in charcoal. Anything not named here gives 1. */
const BURN = { logs: 1, willowlogs: 1, ashlogs: 2, skyashlogs: 2, pinelogs: 2, yewlogs: 3, voidlogs: 4, bogwoodlogs: 4 };

for (const [i, t] of TIERS.entries()) {
  const tierN = i + 1, bar = `${t.key}_bar`;
  ITEMS[bar] = { name: `${t.name} bar`, icon: "🧱", tier: t.key, ex: `Smelted ${t.name.toLowerCase()}, still warm. It wants to be something.` };
  recipe(`smelt_${t.key}`, { skill: "smithing", station: "furnace", in: [...SMELT[t.key], ["charcoal", CHAR_FUEL[i]]], out: [bar, 1], lvl: t.gate, xp: 15 * tierN, ms: 2400 });
  for (const [slot, n] of Object.entries(BARS)) {
    const key = `${t.key}_${slot}`;
    if (!ITEMS[key]) continue;
    recipe(`smith_${key}`, { skill: "smithing", station: "anvil", in: [[bar, n]], out: [key, 1], lvl: t.gate, xp: n * 20 * tierN, ms: 2600 });
  }
}

/* BURNING LOGS. One recipe per kind of log, all at level 1: what gates charcoal is getting the wood, and the wood is
   already gated by Woodcutting and by where the tree grows. They sit at the bottom of recipesAt's level-descending
   sort, so the furnace only burns when it cannot smelt — which is exactly when you want it to. The xp is smithing,
   not woodcutting: you are working a furnace, and paying woodcutting here would let someone train the skill out of
   bought logs without ever touching a tree. */
for (const [log, yieldN] of Object.entries(BURN)) {
  if (!ITEMS[log]) continue;
  /* (2026-09-22, the owner) A SMALL CHANCE THE LOG IS JUST LOST. `fail` is a flat chance the inputs go and nothing
     comes back - not cooking's `burnStop`, which scales with level and hands you a burnt item. Burning charcoal has
     no skill to it and nothing to hand back, so it is a flat 3% and it never improves. Enough to sting, not enough
     to plan around. */
  recipe(`burn_${log}`, { skill: "smithing", station: "furnace", in: [[log, 1]], out: ["charcoal", yieldN], lvl: 1, xp: 5 * yieldN, ms: 1800, fail: 0.03 });
}

/* ============================================================ REFORGING (2026-09-22)

   Bars made a piece once and then ore had nothing left to do. Fish get eaten forever; ore was bought a single time
   per tier, which is the real reason mining measured badly against fishing — not its price, its DEMAND. Reforging
   is the ongoing sink: spend bars to push a piece you already own a little further, with a chance of losing ground.

   WHERE THE LEVEL LIVES, and why it is not on the item. Gear is a bare string key (`c.eq.weapon = "onyx_sword"`),
   not an instance with an id the way a pet is, so there is nowhere on a piece to write a +3. Instancing every item
   in the game to support this would be a refactor touching the bank, the shop, trade, drops and the Exchange. So
   the level is kept on the CHARACTER, keyed by item: `c.forge = { onyx_sword: 3 }`. Every onyx sword you own is
   therefore the same sword, which nobody will ever notice and which costs nothing to get right.

   WHAT IT ADDS: +1 to each stat the piece already has, per level. A sword with 24 accuracy and 22 strength reads
   29/27 at +5 — about one tier, so a maxed-out piece is a parallel route to the next tier rather than a shortcut
   past it. A piece with no combat stats cannot be reforged at all.

   THE ODDS ARE THE DIFFICULTY, and the cost is flat because of it. The first two levels always succeed, so anybody
   can take everything to +2 with no risk at all and nothing is ever lost on a first attempt; the gamble starts at
   +3, which is the first point where there is something to lose. A failure drops ONE level, never destroying the
   piece — regression already supplies the tension (sitting at +4 deciding whether to push) without anyone losing a
   grind in a single click. Expected attempts from +0 to +5 is about 13 per piece, ~89 for a full set. */
export const FORGE = {
  /* THREE LEVELS, NOT FIVE (2026-09-22, second pass). Five could not be expressed: the bonus is a percentage of the
     piece's own stat, and most gear has stats small enough that four of the five levels rounded to zero - 44 of 70
     pieces gained NOTHING at +1, and a diamond axe only moved at +4. The owner asked that every level always move a
     number, which needs a floor of +1 a level, and a floor is per PIECE - armour is six of them, so it multiplied by
     six and took a full set from +16 defence to +30, over two tiers and a sixty-point swing in how often anything
     hits you. Fewer levels is the lever, because the floor is what inflates. At three, a full set lands on +19
     against a tier of +14 and every single level moves. */
  max: 3,
  /* A TOOL REFORGES ON ITS SKILL, NEVER ON COMBAT (2026-09-23, the owner: a reforged pickaxe was offering accuracy
     and strength, which is nonsense on a skilling tool). Tools are deliberately poor weapons - see the TIERS note -
     so buying combat with a reforge fought the design. They buy tool SPEED instead, which is what a tier rung buys
     (+8% a rung), so a level is a legible fraction of a rung. 2.5% is chosen so three levels (+7.5%) stay just UNDER
     a rung: a +3 bronze axe must never beat a plain iron one, or reforging would invert the ladder bestTool() sorts
     by. It is flat, not a share of the tool's own stat the way gear is, because a bronze tool's stat is zero. */
  tspd: 0.025,
  /* odds[level] is the chance of going level -> level+1. */
  odds: [1, 0.80, 0.55],
  /* brk[level] is the chance a FAILURE destroys the piece outright instead of knocking it down a level. Only a
     failure can break something, so +1 is always safe and the risk arrives exactly when there is something to lose.
     About one piece in seven is lost on the way to +3. */
  brk: [0, 0.08, 0.15],
  /* A LEVEL IS WORTH 5.5% OF THE PIECE'S OWN STAT, or +1, whichever is MORE, not a flat +1, and that number is measured rather than picked.
     A flat +1 is right for a weapon by luck — a sword gains +4 acc and +4 str per tier, so +5 lands near one tier —
     and badly wrong for armour, where a whole tier is only +14 defence spread across SIX pieces. Flat +1 there gave
     +30 at max, over two tiers, and because defenceRoll is (level + def)/2 at 4% a point that is a SIXTY point swing
     in how often anything hits you. Proportional fixes both at once: at +5 a piece gains 20% of itself, and 20% is
     almost exactly one tier for weapons and armour alike. Reforging stays a parallel route to the next tier rather
     than a way past it. */
  step: 0.055,
  /* Bars per attempt: EXACTLY what the piece cost to make, and the same whether the attempt succeeds or not.
     Half that was the first draft and it made a maxed set cost 278 ore — about twenty minutes of mining, which is
     not an ongoing sink, it is an afternoon. At full price maxing a set runs ~556 ore and ~278 bars, roughly eight
     times what the set itself cost to smith, and it is the number that gives ore demand after the set is finished.
     It is also the easiest rule to explain: a reforge costs what the piece cost. */
  bars: (slot) => Math.max(1, BARS[slot] || 2)
};
/** Which slot-suffix an item key ends in, e.g. "onyx_sword" -> "sword". Null when it is not a smithed piece. */
/* A key with no underscore falls back to the WHOLE key, which is what lets the three starter tools in: they are
   `pickaxe`, `axe` and `rod`, not `bronze_pickaxe`, so the suffix rule read them as slotless and the anvil listed
   every item a new smith owned except the ones in their hands. Checked: those three are the only bare keys that
   match a BARS slot, so nothing else is swept in. */
export const forgeSlot = (key) => { const k = String(key || ""), i = k.indexOf("_"); const sl = i < 0 ? k : k.slice(i + 1); return BARS[sl] ? sl : null; };
/** Can this be reforged at all? It must be a smithed piece of a known tier with at least one combat stat on it. */
/* AND IT HAS TO BE ABLE TO GAIN SOMETHING. The bonus is 4% of the piece's own stat, so a piece whose best stat is
   under 3 rounds to zero at every level including +5 - bronze boots and gloves (defence 1), emerald boots and
   gloves (2), the emerald pickaxe (2). Those were offered, charged bars, rolled, and gave literally nothing back.
   A guaranteed-success +1 that does nothing is worse than not offering it at all. */
/* Every piece with a combat stat qualifies again: the floor above guarantees at least +1 a level, so the five
   pieces that used to be charged bars for literally nothing (bronze boots and gloves, emerald boots and gloves, the
   emerald pickaxe) now gain like everything else. */
/** A skilling tool: a pickaxe, axe or rod. It reforges on its SKILL, not on combat. */
export const isTool = (key) => !!ITEMS[key]?.tool;
/* Rods qualify now. They have no acc/str at all, so the old combat-only test refused them outright - the one item
   in the game you could not reforge, for the same reason the other two reforged into the wrong thing. */
export const canForge = (key) => { const it = ITEMS[key]; if (!it || !it.tier || !forgeSlot(key)) return false; return isTool(key) || !!(it.acc || it.str || it.def); };
export const forgeLevel = (c, key) => Math.max(0, Math.min(FORGE.max, (c?.forge?.[key] | 0) || 0));
/** The chance the NEXT step succeeds, or 0 at the cap. */
export const forgeOdds = (lvl) => (lvl >= FORGE.max ? 0 : FORGE.odds[lvl] ?? FORGE.odds[FORGE.odds.length - 1]);
/** What one attempt costs: [barKey, howMany], or null when the piece cannot be reforged. */
/* WHAT A REFORGE IS WORTH, for anything that has to SHOW it. bonusOf already folds the level into combat, but every
   name, tooltip, stat chip and equipment slot reads ITEMS[key] directly and would otherwise print the base numbers -
   so a +5 sword looked identical to a plain one everywhere except the fight itself. These are the one place the
   arithmetic lives, so a display can never drift from what the server actually rolls. */
/* THE FLOOR IS THE POINT: at least +1 a level, so a level always moves a number however small the piece's stat is.
   A stat of zero stays zero - a helm does not quietly start granting strength. */
export const forgeAdd = (c, key, f) => { if (isTool(key)) return 0; const v = ITEMS[key]?.[f] || 0, l = forgeLevel(c, key); return v && l ? Math.max(l, Math.round(v * FORGE.step * l)) : 0; };
/** The chance a FAILURE at this level destroys the piece rather than knocking it down one. */
export const forgeBreak = (lvl) => FORGE.brk[lvl] ?? 0;
/** The stat a piece ACTUALLY has for this character, reforge included. */
export const statOf = (c, key, f) => (ITEMS[key]?.[f] || 0) + forgeAdd(c, key, f);
/* WHAT THE NEXT LEVEL BUYS, derived from forgeAdd rather than re-deriving its arithmetic (2026-09-22). The anvil
   used to work this out itself as round(v * step * (f+1)) and subtract forgeAdd - which silently dropped the FLOOR,
   so it reported "next level adds nothing to this piece" on 54% of rows when every level in fact adds at least +1.
   A player reading that would never reforge. Anything that wants to show a gain calls this; nobody recomputes it. */
export const forgeNext = (c, key) => {
  const l = forgeLevel(c, key);
  if (l >= FORGE.max) return [];
  const nx = { forge: { ...(c?.forge || {}), [key]: l + 1 } };
  if (isTool(key)) return [["tspd", FORGE.tspd]];
  return ["acc", "str", "def"].map((f) => [f, forgeAdd(nx, key, f) - forgeAdd(c, key, f)]).filter(([, d]) => d > 0);
};
/** "Diamond axe +3", or just "Diamond axe" at +0. */
export const forgeName = (c, key) => `${ITEMS[key]?.name || key}${forgeLevel(c, key) ? ` +${forgeLevel(c, key)}` : ""}`;
export const forgeCost = (key) => { const sl = forgeSlot(key), it = ITEMS[key]; return sl && it?.tier ? [`${it.tier}_bar`, FORGE.bars(sl)] : null; };

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
  /* (2026-09-22) The counter sold the rod and nothing else, so anyone who dropped or sold a pickaxe was locked out of
     mining with no way back. The bronze three sit with the bar because they are what you replace a lost tool with for
     pocket change; every rung above them is listed with ITS OWN TIER'S GEAR, which is where someone shopping for a
     diamond suit will be looking for a diamond pickaxe. THE COUNTER IS prizesOf, NOT SHOP.sells — adding the ladder
     to SHOP.sells alone put it in Brutus's list and nowhere a player could actually reach. */
  { id: "rod", group: "bar", price: 20, give: ["rod", 1] },
  { id: "pickaxe", group: "bar", price: 20, give: ["pickaxe", 1] },
  { id: "axe", group: "bar", price: 20, give: ["axe", 1] },
  ...TOOLS_FOR_SALE.map(([k, p]) => ({ id: k, group: `gear:${ITEMS[k].tier}`, price: p, give: [k, 1] })),
  ...GEAR_FOR_SALE.map(([k, p]) => ({ id: k, group: `gear:${ITEMS[k].tier}`, price: p, give: [k, 1] }))
];
/* Brutus sells the PLAIN set of every tier (2026-09-20: nothing is smithed any more, so this is how you gear up, and it
   gives tickets somewhere to go that isn't a table). Bronze is what it always cost; each tier up costs several times the
   last, priced at roughly 20 minutes' fighting for emerald up to a couple of hours' for onyx. The good stuff still drops. */
const GEAR_PRICE = { gladius: 220, sword: 250, maul: 280, helm: 200, shield: 300, body: 600, legs: 360, boots: 120, gloves: 120, ring: 180, amulet: 260 };
const TIER_COST = { bronze: 1, emerald: 4, diamond: 12, dragonstone: 30, onyx: 75, starfall: 180, eclipse: 420 };
const GEAR_FOR_SALE = TIERS.flatMap((t) => Object.entries(GEAR_PRICE).filter(([k]) => ITEMS[`${t.key}_${k}`]).map(([k, p]) => [`${t.key}_${k}`, p * TIER_COST[t.key]]));
/* (2026-09-22) every tool rung is on the counter too — the owner: "add them as purchases for every level at Bom
   Trady as well". A tool is cheap against a suit of its own tier (an eclipse pickaxe is 8,400 to an eclipse
   cuirass's 252,000) because a tool is a KEY, not a prize: nobody should be shut out of a whole area saving up. */
const TOOLS_FOR_SALE = TIERS.flatMap((t) => Object.keys(TOOL_KINDS).filter((k) => ITEMS[`${t.key}_${k}`]).map((k) => [`${t.key}_${k}`, 20 * TIER_COST[t.key]]));
/* Dex's bar (2026-09-20): drinks and the scroll home. Priced so a lager about pays for itself at the table limit and
   costs you at small stakes: a drink is for someone betting big, and otherwise a tickets sink. `round` buys everyone on
   the floor who isn't already drinking a lager's worth of bets. */
/* (v93, the owner: "make all drinks/dinners cost 10x. theyre too cheap right now") Every drink and every dinner is ten times what it was,
   and so is the round for the room, which would otherwise have cost less than one lager. The scroll home is not a drink: still 50. */
export const BAR = { sells: [["beer", 400], ["cocktail", 900], ["whiskey", 1000], ["champagne", 2000], ["chickendinner", 800], ["steakdinner", 1500], ["porkchops", 1500], ["fishplatter", 3000], ["tp_scroll", 50]], round: { price: 3000, k: "beer", bets: 10 } };
export const SHOP = {
  // Brutus stocks tools and BRONZE ONLY. Everything above bronze is found, not
  // bought — otherwise the fastest route to the best gear in the game is to
  // stand at the copper vein and walk away, which is not a route anybody should
  // enjoy discovering.
  sells: [["rod", 20], ["pickaxe", 20], ["axe", 20], ...TOOLS_FOR_SALE, ...GEAR_FOR_SALE],
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
  /* The four middle crops. Prices are what make 20 plots come to ~14% of what fighting the same zone pays — see the
     note on CROPS. VALUE is the authority: line ~2953 copies every VALUE key over SHOP.buys, so setting a price in
     SHOP.buys alone does nothing (which is why the source there still reads wheat: 1 while the shop pays 4). */
  rattlebean: 10, lanternroot: 35, bonegourd: 90, stormcorn: 250,
  logs: 10, copper: 10, tin: 10, sardine: 8, trout: 14, wheat: 4, olives: 3,   /* (v70: sardine 10 -> 8 and trout 18 -> 14 after the grind sim: the Yard and the Gloam paid fishers as much as fighters) */   // (fish: see FISHING)
  willowlogs: 15, emerald_ore: 15, lanternfish: 20, diamond_ore: 22,            // the Gloam
  skyashlogs: 28, dragonstone_ore: 30, skyeel: 40, onyx_ore: 40,                // Cloudreach
  perch: 10, catfish: 18, mudskipper: 28, bonefish: 28, ghostcarp: 36, cloudray: 48, stormmarlin: 44, thundersquid: 52,   // v68: two fish a band (see the scenes' spots)
  sporecap: 12, markedcard: 22, sharktooth: 26, flashlight: 30, stormjelly: 34, staticfur: 42, hailshard: 46,            // v68: what the new monsters leave
  receipt: 15, cobweb: 25, agilmark: 25,
  catalytic: 140, slagstone: 110, pinelogs: 40, bogwoodlogs: 95, mudcat: 58, bowfin: 66,   // the Trailer Park: the best gathering in the game, because it is the furthest walk and the meanest neighbours
                                                      // the Boneyard's leavings
  starfall_ore: 55, eclipse_ore: 90, voidglass: 70, voidlogs: 85,               // (v121) the Vault's
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
/* THE ROAD PAYS MORE THE FURTHER YOU WALK (v92, tools/eastscape-road.mjs). The balance tool priced every monster at the same wage for
   its level, which is fair and flat: inside an area the FIRST monster was the best farm (a Sorry Ghoul at the Boneyard's gate
   out-earned The Understudy at its far end), so nobody had a reason to walk on. Now every monster on the road earns about 4% more
   a minute than the one before it, from the Yard's chickens to The House, and the first monster of an area beats the last of the
   one before. Nothing was lowered. Measured a minute: Yard 189 to 230, Gloam 239 to 423, Mire 460 to 771, Boneyard 1,028 to
   1,202, Cloudreach 1,349 to 1,578, the Thunderhead 1,641 to 1,920. */
export const BOUNTY = { chicken: 18, cow: 32, rotten: 39, olive: 38, hornworm: 51, boar: 53, highwayman: 40, goat: 45, gnasher: 80, moth: 74, taxwraith: 150, ghoul: 177, chandelier: 205, understudy: 250, ram: 266, angel: 352, revenant: 324, goose: 419,
  toadstool: 37, boneidle: 79, twister: 73, counter: 91, shark: 143, stagehand: 196, usher: 223, brainstorm: 247, seagoat: 329,
  /* THE 50+ BAND pays MORE than the tool asks: its reference wage goes flat at level 40 (there was no skilling past onyx), so left alone a level-70
     kill would pay a level-42 minute. These are the tool's numbers times 1 + 1.2% a level past 42, so the last band is worth reaching. The goose moved with them. */
  golem: 388, wolf: 418, drake: 485, house: 642 };   // (v68: measured with tools/eastscape-balance.mjs, like the rest)   // (re-measured 2026-09-20 for half-length fights: a kill pays less, and there are twice as many)
for (const [t, want] of Object.entries(BOUNTY)) {
  const m = MOBS[t]; m.drops = m.drops.filter(([k]) => k !== "tickets");
  const other = m.drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  if (gap >= 2) m.drops.unshift(["tickets", [Math.max(1, Math.round(gap * 0.6)), Math.round(gap * 1.4)]]);   // tickets first: line one of every table (it was tickets until 2026-09-20)
}
/* FINDS: what any kill can turn up on top of the monster's own drops. [item, share]: the chance is share x the
   monster's bounty / the find's worth, so every monster gives the same fraction of its pay this way and a chicken
   farmer sees a red chip about once in 250 kills while the Understudy coughs one up every 14. */
export const FINDS = [["chip_red", 0.04, 250], ["chip_black", 0.03, 1000], ["chip_gold", 0.03, 5000], ["chip_free", 0.008, 50], ["mysterybox", 0.008, 60], ["devils_dice", 0.004, 50], ["rewind_watch", 0.006, 250]];
/* JACKPOT KILL (v92): fighting is a slot machine too. One kill in JACKPOT_KILL.odds was carrying the house's money: it pays
   JACKPOT_KILL.mult times that monster's bounty in tickets on top of its drops, with the casino's own win banner and a line to
   everyone in the area. It adds mult / odds (a tenth) to what fighting pays on average, and nothing else changes. */
export const JACKPOT_KILL = { odds: 50, mult: 5 };
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
/* (2026-09-22) RAW FISH IS NOT FOOD AND NOT LOOT (the owner: "uncooked fish should not be eatable and should not be
   sellable to Bom Trady. make only cooked fish eatable and sellable to Bom"). Eating one healed nearly as much as the
   cooked version and the counter bought it outright, so Cooking was a skill you could skip entirely — catch, sell,
   never light a fire.

   FISH, AND ONLY FISH. The first go flagged everything with a c<name> counterpart, which is also true of raw BEEF,
   CHICKEN and PORK — so a cow's and a boar's drops silently stopped being loot, which nobody asked for and which is
   most of what those two pay. Telling them apart by name does not work either: raw meat is called "Raw beef" and
   "Raw boar", exactly like "Raw gloomfin".

   So the MEAT is the list, not the fish. There are three of them and there is a monster behind each one, while fish
   arrive with every new pond — listing the small closed set means a new fish is covered the day it is added, and the
   rare new raw MEAT fails loudly (it cannot be sold) instead of silently. tools/eastscape-content-check.mjs also
   fails the build if a raw thing is neither listed here nor caught at a spot.

   `heal` comes OFF the fish: it is what made them food, and leaving it would have the bag offering a heal the server
   then refuses. The cooking recipes read RECIPES, not heal, and the wiki quotes the cooked item. */
export const RAW_MEAT = new Set(["beef", "chicken", "pork"]);
const FISH_RAW = new Set(Object.keys(ITEMS).filter((k) => ITEMS["c" + k] && !RAW_MEAT.has(k)));
for (const k of FISH_RAW) { ITEMS[k].raw = true; delete ITEMS[k].heal; delete SHOP.buys[k]; }
/* Charcoal's price lives HERE, not up with the item, because SHOP is declared further down this file than the
   smelting block is — setting it there threw "Cannot access 'SHOP' before initialization" and took the whole
   module out. It is 8 against a plain log's 10 deliberately: burning to sell has to be a loss, or charcoal becomes
   a money press with nothing to do with smithing. */
SHOP.buys.charcoal = 8;
/* And the smoked fish, here for the same reason charcoal is: SHOP is declared further down the file than the
   cooking block, so setting a price beside the item throws before the module finishes loading. Second time this
   caught me in one evening. A smoke sells for well above its cooked twin - it cost a charcoal and it carries a
   buff - but you are meant to eat them, not run a smokehouse. */
for (const [raw, sm] of Object.entries(SMOKE)) if (ITEMS[`s${raw}`]) SHOP.buys[`s${raw}`] = sm.sell;
export const isLoot = (k) => k !== "tickets" && k !== "tickets" && k !== "zcoin" && valueOf(k) > 0 && !ITEMS[k]?.slot && !ITEMS[k]?.luck && !ITEMS[k]?.use && !ITEMS[k]?.drink && !ITEMS[k]?.raw;

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
/* (v101) YAHSMEENA'S DECOR SHOP: the catalogue and the rules of placing are in their OWN file, v3/assets/js/eastscape-decor-rules.js, because
   the first load is on a budget and nobody needs a furniture catalogue to log in. The game server imports it; the page fetches
   it the first time you stand on an island with furniture on it. What stays here is only what a saved character needs. */
export const ISLE_FERRY = { scene: "workyard", x: 38, y: 15 };   // (v108: Charon's cart is in the Yard.   // (was River Bend's ferry until 2026-09-20: Charon works from a cart in the square now)
/* `col` is what the page paints a ripe crop (it draws plots procedurally — three stalks, height from the growth
   fraction — so a new crop needs a colour here and no art at all). It lived as a ternary in eastscape.html until
   2026-09-23; one list is better than two that can disagree.
   THE PAY IS MEASURED, NOT PICKED. tools/eastscape-grind-sim.mjs says active play earns ~11.6k tickets/hr at the
   Gloam, ~22k at the Mire, ~35k at the Boneyard, ~50k at Cloudreach and ~55k at the Thunderhead. Each crop below is
   set so 20 plots kept going come to about 14% of what FIGHTING its own zone pays — background income, never a
   reason to stop playing. Keep that ratio if you add one.
   KNOWN, NOT FIXED HERE: wheat pays ~1,440/hr against goldtomatoe's ~300, so the two ORIGINAL crops run backwards
   against each other. Both are trivial next to 11-83k/hr from playing, so it is a tidiness problem rather than an
   economy one — but do not copy their numbers. */
export const CROPS = {
  wheat: { lvl: 1, ms: 10 * 60000, yield: [3, 5], xp: 30, col: "#f0d040" },
  tomatoe: { lvl: 5, ms: 20 * 60000, yield: [3, 6], xp: 70, col: "#d8322a" },
  rattlebean: { lvl: 10, ms: 20 * 60000, yield: [3, 5], xp: 60, col: "#c8b06a" },
  lanternroot: { lvl: 20, ms: 40 * 60000, yield: [3, 6], xp: 150, col: "#ffb03a" },
  bonegourd: { lvl: 30, ms: 1 * 3600000, yield: [3, 6], xp: 400, col: "#e8e0c8" },
  stormcorn: { lvl: 40, ms: 2 * 3600000, yield: [4, 7], xp: 700, col: "#9ad8ff" },
  goldtomatoe: { lvl: 50, ms: 4 * 3600000, yield: [1, 3], xp: 600, col: "#ffd84a" }
};
// a theme repaints your island; price null means you can't buy it (events, quests)
export const THEMES = {
  meadow: { name: "Meadow", icon: "🌿", ex: "Green grass, round trees, a nice breeze.", price: 0 },
  dunes: { name: "Sunny Dunes", icon: "🏝️", ex: "Warm sand, palm trees and one crab that watches you.", price: 2500 },
  gloom: { name: "Gloom", icon: "🕸️", ex: "Grey grass, bare trees, a little fog. Not for sale.", price: null }
};
export const EXAMINE = {
  /* (v118) the Picture House. The screen does not open anything yet: the site's Movies & TV is the next half of this. */
  cinescreen: "A screen the width of the room. Nothing on it yet — Rhonda says the reels are coming.",
  cineseat: "Red velvet, and it folds. The springs have opinions.",
  popcorn: "Warm, yellow, and nobody has ever taken any.",
  projector: "Two reels and a lens. It hums even when it is off.",
  ringbell: "Ding ding. It's been rung so often the brass has gone flat on one side.", ringpost: "Padded, for when somebody gets thrown. The torch is for atmosphere and singed eyebrows.",
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
/* THE HISCORES (v96, the owner: "lets build / hookup the highscores board now"). The board behind the button ranked every skill the game
   ever had, most of them closed. These are the boards of the game as it is: the two things you can level, and the four numbers
   a casino brags about. [key, tab, what the number is, how the page writes it]. The game server builds them (hiscores()), the
   page draws them, and the board on the casino's back wall (hsboard, by the Winners' Wall) opens the same window. */
export const HISCORES = [["combat", "Combat", "level", "lvl"], ["total", "Total level", "every skill added up", "lvl"], ["hp", "Hitpoints", "level", "lvl"], ["fishing", "Fishing", "level", "lvl"], ["cooking", "Cooking", "level", "lvl"], ["farming", "Harvesting", "level", "lvl"], ["mining", "Mining", "level", "lvl"], ["woodcutting", "Woodcutting", "level", "lvl"], ["smithing", "Smithing", "level", "lvl"], ["agility", "Agility", "level", "lvl"],
  /* (2026-09-22, owner: "add the other skills too, users love showing these off") Every skill has a board now, not just the two
     that happened to be wired by hand. "total" is not a skill and resolves to totalOf() instead - it is the one people actually
     brag about, and it was already being computed for every row and thrown away. */
  ["earned", "Tickets earned", "all time", "tix"], ["wagered", "Wagered", "tickets, all time", "tix"], ["kills", "Kills", "monsters", "n"], ["zcoins", "ZCoins found", "real ones", "n"],
  /* (v98, the owner: "add a Quests Completed tab to the highscores") WHAT COUNTS, because the three story quests are all in closed areas: every
     story quest finished (questsDone), the House Tour once it has been walked to the end, and every daily job CLAIMED at the board.
     Daily jobs were never tallied before v98 (a claim only marked that day's task), so that part counts from v98: c.stats.jobs. */
  ["quests", "Quests completed", "the tour, daily jobs and quests", "n"],
  ["crypt1", "Crypt", "fastest clear", "time"], ["crypt2", "Deep Crypt", "fastest clear", "time"], ["crypt3", "Black Crypt", "fastest clear", "time"],   // (v103) a "time" board is filled by the game server from its list of clears
  /* (2026-09-22) The Run. "lap" is its own kind and not "time": a time board is filled from the server's list of
     crypt clears, while this is a number carried on every character (stats.runBest) — and it is the only board
     where SMALL WINS, so the sort has to know. Milliseconds, so the page prints one decimal. */
  ["runBest", "The Run", "fastest lap", "lap"]];
export const questsDone = (c) => Object.values(c?.qs || {}).filter((q) => q?.state === "done").length + (c?.tour && c.tour.step >= TOUR.length ? 1 : 0) + ((c?.stats?.jobs | 0) || 0);
export const VERB = { towerdoor: "Enter", towerup: "Climb", cryptdoor: "Go down", cryptlever: "Pull", cryptexit: "Climb", cryptloot: "Open", hsboard: "Read", jukebox: "Play", prizecase: "Browse", mirror: "Look in", rrtable: "Sit at", rrseat: "Sit at", rrboard: "Read", barcart: "Drink at", prizewheel: "Spin", fameboard: "Read", cart: "Ride", fight: "Bet on", coinstatue: "tickets in at", cooler: "Drink at", buffet: "Eat at", cashier: "tickets in at", howto: "Read", game: "Play", board: "Read", roulette: "Play", roomdoor: "Enter", walldoor: "Enter", cook: "Cook-at", smelt: "Smelt-at", smith: "Smith-at", pvp: "Attack", ground: "Take", rope: "Climb-up", ferry: "Board", boatback: "Sail-home", plot: "Tend", pedestal: "Use", islesign: "Read", bank: "Bank at", exchange: "Trade at", player: "Trade with", enter: "Enter", hole: "Climb-down", mob: "Attack", npc: "Talk-to", wheat: "Pick", spot: "Fish", door: "Open", well: "Search", rock: "Mine", vein: "Mine", wreck: "Strip", tree: "Chop down", olive: "Pick", shrine: "Pray-at", notice: "Read", sign: "Read" };

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
  /* ---- THE TRAILER PARK (2026-09-22). The zone's only quests, and the only ones in the game past the Yard. A pair
     on purpose: the first teaches what the place is FOR (the trucks, and that they need a pickaxe in your hands),
     the second is the King, which nobody should stumble into. */
  scrapline: {
    name: "The Scrap Line", giver: "Darla", where: "The Trailer Park", icon: "⚙️",
    hint: "Darla is on her porch by the burn barrel, in the middle of the park. She has been here forty years and she has opinions.",
    goal: { type: "bring", items: ["catalytic"], n: 5, what: "converters" },
    brief: "Bring Darla 5 catalytic converters.",
    talk: {
      offer: ["You're the one walking about like the dogs are decorative.", "Every truck out here is up on blocks and every one of them still has its converter. Bring me five. You'll want a pickaxe IN YOUR HANDS, not in your bag."],
      accept: "Five converters. Fine.", decline: "I'll come back.",
      accepted: "Trucks are all over the park. Mind the possums, they've got nothing left to lose.",
      progress: "Five converters. You've got {have}. The trucks aren't going anywhere, which is rather the point.",
      ready: "That's five. Give them here.", hand: "Five, as asked.",
      done: "Good. That's a month of not asking anybody for anything. There's one more thing, if you've the stomach."
    },
    reward: { coins: 9000, xp: { mining: 4000 }, text: "9,000 tickets, 4,000 Mining xp" }
  },
  theking: {
    name: "The King of the Yard", giver: "Darla", where: "The Trailer Park", icon: "👑", requires: ["scrapline"],
    goal: { type: "kill", mob: "junkking", n: 1, what: "the Junk King" },
    brief: "Darla would like the Junk King seen to. Once will do.",
    talk: {
      offer: ["The yard at the east end isn't his. He decided it was, and nobody's had a better idea since.", "He's bigger than anything you've fought and he doesn't tire. Go when you're ready, not when you're bored."],
      accept: "Once will do.", decline: "Not yet.",
      accepted: "East end, through the gate. Take food. Take more food than that.",
      progress: "He's still out there. You'd know if he wasn't.",
      ready: "You did it. You actually did it.", hand: "It's done.",
      done: "Forty years. Well. Take his wrench if he dropped it, you've earned the weight of it."
    },
    reward: { coins: 25000, xp: { melee: 12000, hp: 4000 }, text: "25,000 tickets, 12,000 Combat xp, 4,000 Hitpoints xp" }
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
export const DEFAULT_SETTINGS = { xpDrops: true, gainPops: true, skillRing: true, names: true, hoverTile: false /* (v93, the owner: "turn off the tile outline setting by default") */, groupNotes: true, debug: false, reducedMotion: false, confirmDrop: true };
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
const COUNT_MAPS = ["kills", "gathered", "looted", "cooked", "crafted", "played"];
const STAT_NUMS = ["burnt", "deaths", "pvpKills", "pvpDeaths", "questsDone", "cashIn", "cashOut", "xpTotal", "playMs", "sessions", "firstSeen", "lastSeen", "casPlays", "casNet", "casBest", "casWorst", "forgeBroke", "crypt"];

export function freshStats() {
  return {
    kills: {},      // mob type -> how many killed
    /* (2026-09-23) THE CASINO'S LIFETIME LINE. C.wagered has always held all-time turnover, but nothing recorded
       whether any of it came BACK — only C.plays, a rolling window the hourly limiter trims. These four and the
       `played` map are written in recordPlay(), the one place every table's result lands, so no game can count
       differently. Like every counter here they start from the day they shipped and cannot be backfilled. */
    played: {},     // game key -> how many times played
    casPlays: 0,    // plays across every table
    casNet: 0,      // tickets up or DOWN across all of them; negative is normal and correct
    casBest: 0,     // biggest single win
    casWorst: 0,    // biggest single loss, as a negative
    forgeBroke: 0,  // pieces destroyed at the anvil
    crypt: 0,       // crypts cleared
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
      const key2 = key === "kills" || key === "played" ? k : aliasKey(k);   // mob types and game keys are not items, so they do not follow item renames
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
  },
  /* WEAR A PET SOMEBODY ALREADY OWNS (2026-09-23, the owner: "i still cant see peoples applied pets").
     Nothing was broken. A pet drop has worn itself since 2026-09-22 when the slot is empty, but every pet found
     BEFORE that went into `c.pets` and stayed there with `c.eq.pet` null — so activePet() returned null, the
     roster carried no pet, and the thing was invisible to its owner and to everyone else. Correct behaviour for
     an unworn pet; indistinguishable from a bug from the outside, which is exactly what happened here.
     An unworn pet does nothing for anybody, so wearing it is strictly a gain, and the same reasoning the drop
     already uses applies: one kill in a thousand should not need a toggle hunted for. An existing choice is never
     displaced — if something IS worn, this leaves it alone. */
  (c) => { if (!c.eq?.pet && Array.isArray(c.pets) && c.pets.length) c.eq.pet = c.pets[0].id; }
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
    v: SAVE_V, scene: START.scene, x: START.x, y: START.y, hp: 10, hunger: 100, thirst: 100, wagered: 0, earned: 0, spin: null, roller: 0, free: 0, meal: null, drink: null, plays: [], bagUp: 0, tower: null, forge: {}, /* (2026-09-22) the last hour of ticket bets, for TIX_HOUR. On the CHARACTER and not the connection, or relogging would clear the hour. */ tour: { step: 0, fish: 0, chickens: 0 },   /* `logs` until 2026-09-22: the field the job step counts is fish, and a dead name here is what the page went on reading */
    /* (2026-09-22, the owner: "dont equip users equipment when they start. it should be in their inventory so they can
       test out equipping stuff"). You begin UNARMED with your kit in the bag, so the tour's Gear step is a real thing
       to do rather than a description of something already done. Nothing needs a weapon to work — an empty weapon
       slot reads as "Unarmed" and still swings — so the only cost of arriving bare is the defence you put on yourself. */
    /* (2026-09-22) ALL THREE TOOLS, not just the rod. Mining and woodcutting refuse without one — "You need a pickaxe
       to do that" — and a new character had neither, nor any way to know they were for sale. */
    inv: [{ k: "tickets", n: 25 }, { k: "rod", n: 1 }, { k: "pickaxe", n: 1 }, { k: "axe", n: 1 }, { k: "cap", n: 1 }, { k: "rudis", n: 1 }, { k: "tunic", n: 1 }, { k: "parma", n: 1 }, { k: "sandals", n: 1 }],
    eq: { helm: null, weapon: null, body: null, shield: null, legs: null, gloves: null, boots: null, ring: null },
    stance: DEFAULT_STANCE,
    /* (2026-09-22) EVERY SKILL, FROM SKILLS ITSELF. This was a hand-written list, and Agility was added to SKILLS
       without being added here — so freshChar had no agility xp, normChar (which backfills a character from
       freshChar) had nothing to copy in, and the skills panel rendered Math.floor(undefined) as "NaN xp" for
       everyone. Derived, a new skill starts at zero for new and existing characters the moment it is declared.
       Hitpoints is the one that does not start at nothing. */
    xp: { ...Object.fromEntries(Object.keys(SKILLS).map((k) => [k, 0])), hp: XP_AT[10] },
    qs: {}, bank: [], settings: { ...DEFAULT_SETTINGS }, created: Date.now(), stats: freshStats(),
    van: { on: { head: null, body: null, legs: null, feet: null }, col: { head: 0, body: 0, legs: 0, feet: 0 }, own: [] },
    pets: [],   /* (2026-09-22) instances, not stacks: [{ id, k, name }]. eq.pet holds an ID into this. */
    isle: { plots: Array(ISLE.plots).fill(null), shelf: Array(ISLE.shelf).fill(null), theme: "meadow", themes: ["meadow"], open: true, tier: 1, owned: {}, decor: [] }
  };
}
// fill in anything a stored character is missing, and drop what isn't real any more
export function normChar(c) {
  const f = freshChar();
  if (!c || typeof c !== "object") return f;
  const out = { ...f, ...c, xp: { ...f.xp, ...(c.xp || {}) }, eq: { ...f.eq, ...(c.eq || {}) }, settings: { ...f.settings, ...(c.settings || {}) }, qs: { ...(c.qs || {}) } };
  /* (v93) A saved character keeps a copy of every setting, so changing a DEFAULT never reached anybody who already existed. The tile
     outline is switched off ONCE for each of them (hoverOff marks it done); anyone who wants it back turns it on and it stays. */
  if (!out.hoverOff) { out.settings.hoverTile = false; out.hoverOff = 1; }
  out.look = normLook(c.look);   /* (v80) who they chose to be, or null: not asked yet */
  out.bagUp = Math.max(0, Math.min(BAG_UPGRADES.length, Math.trunc(Number(c.bagUp)) || 0));   // clamped on load: a hand-edited save cannot grant a hundred slots
  /* (2026-09-22) THE TOWER. `best` is the highest floor ever cleared and is the only part that has to survive a
     session; `floor` is where you are and is re-derived from the checkpoint on the way in, so a hand-edited save
     cannot start anyone at the top. Both clamped to the tower's real height. */
  /* (2026-09-22) REFORGE levels, keyed by item. Only keys that are actually forgeable survive a load and each is
     clamped to FORGE.max, so a hand-edited save cannot invent a +99 sword or hang a level on a stack of tickets. */
  out.forge = {};
  if (c.forge && typeof c.forge === "object") for (const [k, v] of Object.entries(c.forge)) {
    const n = Math.max(0, Math.min(FORGE.max, Math.trunc(Number(v)) || 0));
    if (n > 0 && canForge(k)) out.forge[k] = n;
  }
  out.tower = c.tower && typeof c.tower === "object"
    ? { floor: Math.max(1, Math.min(200, Math.trunc(Number(c.tower.floor)) || 1)), best: Math.max(0, Math.min(200, Math.trunc(Number(c.tower.best)) || 0)) }
    : null;
  out.plays = recentPlays(c.plays, Date.now());   // trimmed on every load, so an idle week never carries a play log back in
  out.van = normVanity(c.van);
  /* (2026-09-22) PETS. A kind that no longer exists, or a name with something nasty in it, simply stops being a pet.
     The slot is checked against the list it points into, so selling or banking one cannot leave a ghost applying its
     bonuses — activePet returns null and petFx reads zeroes. */
  out.pets = (Array.isArray(c.pets) ? c.pets : []).filter((x) => x && PETS[x.k] && x.id)
    .slice(0, 50).map((x) => ({ id: String(x.id).slice(0, 24), k: x.k, name: cleanPetName(x.name) }));
  if (out.eq.pet && !out.pets.some((x) => x.id === out.eq.pet)) out.eq.pet = null;   /* (2026-09-21) what Ronde sold them, cleaned: an item that no longer exists simply stops being worn */
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
  /* (v104) saved INSIDE a crypt run ("crypt:<run id>"): left alone here. The game server decides at login whether that run is still going (back where you stood) or not (the stairs in the Forum): cryptRejoin in eastscape-worker/src/crypt.js. */
  const inRun = String(out.scene).startsWith("crypt:");
  if (!inRun && !OPEN.has(String(out.scene).split(":")[0])) Object.assign(out, START);
  if (!inRun && !SCENES[out.scene]) Object.assign(out, isIsle(out.scene) ? ISLE_FERRY : START);   // back from an island: the ferry at River Bend
  const fi = f.isle, ci = c.isle && typeof c.isle === "object" ? c.isle : {};
  out.isle = {
    plots: Array.from({ length: ISLE.plots }, (_, i) => { const p = ci.plots?.[i]; return p && CROPS[p.k] && Number.isFinite(p.at) ? { k: p.k, at: p.at } : null; }),
    shelf: Array.from({ length: ISLE.shelf }, (_, i) => { const k = ci.shelf?.[i] ? aliasKey(ci.shelf[i]) : null; return ITEMS[k] ? k : null; }),
    themes: [...new Set(["meadow", ...(Array.isArray(ci.themes) ? ci.themes : [])])].filter((t) => THEMES[t]),
    theme: fi.theme, open: ci.open !== false, tier: [1, 2, 3].includes(ci.tier) ? ci.tier : 1,
    /* (v101) decor: what you own and where it stands. Shape only: the catalogue is not in this file (see above), and a piece it no longer lists is simply not drawn. */
    owned: Object.fromEntries(Object.entries(ci.owned && typeof ci.owned === "object" ? ci.owned : {}).filter(([k, n]) => /^[a-z_]{2,24}$/.test(k) && (n | 0) > 0).slice(0, 80).map(([k, n]) => [k, Math.min(99, n | 0)])),
    decor: []
  };
  { const left = { ...out.isle.owned }; for (const d of (Array.isArray(ci.decor) ? ci.decor : []).slice(0, 120)) if (d && left[d.k] > 0 && Number.isInteger(d.x) && Number.isInteger(d.y) && ["isle", "shore", "home"].includes(d.at)) { left[d.k]--; out.isle.decor.push({ k: d.k, x: d.x, y: d.y, at: d.at }); } }
  if (out.isle.themes.includes(ci.theme)) out.isle.theme = ci.theme;
  for (const k of ["meal", "drink"]) if (!out[k] || !ITEMS[out[k].k]?.[k] || !((out[k].left | 0) > 0)) out[k] = null;
  out.stance = stanceOf(out);
  out.stats = normStats(out.stats);
  return migrate(out);          // brings an older save up to SAVE_V and stamps out.v
}
export const lvlOf = (c, k) => levelOf(c.xp[k] || 0);
export const maxHpOf = (c) => lvlOf(c, "hp") + petFx(c).hp;
// The three combat skills weigh the same. Equal thirds is also what keeps the
// split neutral: a character whose attack, strength and defence all equal their
// old melee level comes out at exactly the combat level they had before.
export const meleeOf = (c) => lvlOf(c, "melee");
export const combatOf = (c) => Math.floor((meleeOf(c) * 1.3 + lvlOf(c, "hp")) / 2.3) + 2;
export const totalOf = (c) => Object.keys(SKILLS).reduce((n, k) => n + lvlOf(c, k), 0);
/* (2026-09-22) REFORGING rides here, which is the only place it has to touch combat: every roll in the game reads
   its gear through bonusOf, so adding the level here means the max hit, the attack roll and the defence roll all
   pick it up with no other change. A level adds +1 to each stat the piece ALREADY has — never to a stat of zero,
   or a helm would quietly start granting strength. */
/* (2026-09-22) THIS GOES THROUGH statOf. It used to repeat forgeAdd's sum inline and, like the anvil, left out the
   floor - so combat paid a quarter of what reforging advertised: a full emerald set at +3 gave +5 defence where the
   anvil showed +18, and a +3 emerald axe was identical in a fight to a plain one. Three copies of one formula is
   what caused both bugs; there is now one. */
export const bonusOf = (c) => { const b = { acc: 0, str: 0, def: 0 }; for (const k of Object.values(c.eq)) if (k && ITEMS[k]) for (const q in b) b[q] += statOf(c, k, q); return b; };
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
/* (2026-09-21) the map-building helpers, for the files that hold maps outside this one (eastscape-closed.js, and the dungeon's). */
export const _MAP = { block, grid, keepOf, room, wild };

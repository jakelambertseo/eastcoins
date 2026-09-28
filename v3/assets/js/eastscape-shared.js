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
export const VERSION = 338;
// Maps are 44 x 26 tiles (twice the old 22 x 13 each way, 2026-09-19). The screen shows a 22 x 13 window that follows
// you (ZOOM in the page), so characters look the size they always did and there's four times the room.
export const COLS = 44, ROWS = 26;
export function hashRand(x, y, s = 1) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ------------------------------------------------------------ OSRS curve */
/* THE LEVELS THE WHOLE WORLD HEARS ABOUT (2026-09-23, the owner: "when a user now reaches level 30, 40, 50, 60,
   70, 80, 90, 99, 110 (eventually), and 120, then there needs to be an annoucement in chat for everyone to see so
   they can congradulate them").

   110 AND 120 ARE IN THE LIST ON PURPOSE even though the cap is 99 today (XP_AT stops there). They cost nothing
   to carry, and the alternative is somebody raising the cap in a year and quietly getting no announcement for the
   two levels this was written for. A milestone that is not reachable simply never fires.

   Every skill counts, Hitpoints included: it levels off the back of combat rather than on its own, but reaching
   Hitpoints 70 is still a thing somebody did. Expect two lines at once now and then, because a fighter crosses
   Combat and Hitpoints close together. */
export const MILESTONES = new Set([30, 40, 50, 60, 70, 80, 90, 99, 110, 120]);
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
  cmudcat: { name: "Cooked mud cat", icon: "🐟", heal: 30, ex: "Better than it has any right to be." },
  cbowfin: { name: "Cooked bowfin", icon: "🐟", heal: 35, ex: "You have to work round the bones. Worth it." },
  /* (2026-09-27, the owner: "fishing, cooking for example i know are topped out around 70-80") THE LAST TWO FISH. Both in the Deep
     Wild's Black Pool, under the waterfall, which puts Fishing 92 and 97 behind the Liches and the wolves. Cooking reaches 90 on the
     Grimscale, smoking 95. */
  voidfin: { name: "Raw voidfin", icon: "🐟", ex: "Long, black, and it glows where the light should be. The Black Pool's own." },
  cvoidfin: { name: "Cooked voidfin", icon: "🐟", heal: 40, ex: "Tastes of nothing, then of everything. Heals like it means it." },
  grimscale: { name: "Raw grimscale", icon: "🐟", ex: "Armoured like the rock it hides under. The biggest thing in the Deep that isn't a Lich." },
  cgrimscale: { name: "Cooked grimscale", icon: "🐟", heal: 46, ex: "Crack the plates, eat what is under them. The best meal in the game." },
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
  cgloomfin: { name: "Cooked gloomfin", icon: "🐟", heal: 19, ex: "Still slightly annoyed. Very filling." },
  cmooncarp: { name: "Cooked moon carp", icon: "🐡", heal: 23, ex: "It glows faintly in your stomach. That's normal. Probably." },
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
  /* (2026-09-24, the owner: "the other mobs in the area need a chance too drop a carnival ticket") THE KEY TO
     THE CAGE. Not currency and not a prize: one ticket turns the turnstile once and is gone, which is what
     makes the Grinning Man something you work up to rather than something you walk past. */
  /* THE 2X POTION (2026-09-25, the owner: "a very rare drop from all mobs in the game ... when someone drinks
     it, it gives 2X tickets and crafting experience for 30 minutes to ALL users on the server").
     IT IS THE ONLY THING IN THE GAME ONE PLAYER USES ON EVERYBODY. That is the whole appeal and also the whole
     risk: the value of drinking it goes up with how many people are online, so it wants to be popped when the
     room is busy, and the chat line exists to make that a moment rather than a private buff nobody sees.
     `use: "double"` rather than `drink`, because a drink is a personal ten-minute buff held on the character
     and this is a SERVER clock held on the world. */
  pot_double: { name: "2X Potion", icon: "✨", use: "double", ex: "Something the house did not mean to bottle. Drink it and, for thirty minutes, EVERY player on the server earns double tickets and double crafting xp. One at a time." },
  carnivalticket: { name: "Carnival ticket", icon: "🎟️", ex: "ADMIT ONE. Torn off a roll a long time ago. The turnstile in the north-west still takes them." },
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
  /* (2026-09-25) the ores the 80s and 90s tiers smelt from. Nova is in the Vault and Singularity in the Trailer
     Park, which puts each one in a map already built for the level that mines it. */
  nova_ore: { name: "Nova ore", icon: "\u{1F4AB}", ex: "Still warm, and it was not warm when you picked it up. Mining 80." },
  singularity_ore: { name: "Singularity ore", icon: "\u{1F573}️", ex: "A pebble that takes two hands. Don't put it down on anything you care about. Mining 90." },
  /* (2026-09-25) THE CHASE. One core per tier rather than one drop per weapon: with three weapons a tier, three
     separate drops would have tripled the hunt and made two rolls in three land on a weapon you did not want.
     A core is the same for all three, so the drop is always the right drop and the CHOICE stays yours. */
  nova_core: { name: "Nova core", icon: "\u{1F31F}", ex: "The bit that was still burning. Every Nova weapon is built around one." },
  singularity_core: { name: "Singularity core", icon: "\u{26AB}", ex: "It is not heavy until you try to move it. Every Singularity weapon is built around one." },
  willowlogs: { name: "Gloomwillow logs", icon: "🪵", ex: "Damp, dark and faintly glowing at the ends. They burn blue." },
  skyashlogs: { name: "Skyash logs", icon: "🪵", ex: "Light enough to float. Please don't let go of them." },
  voidlogs: { name: "Vaultwood logs", icon: "🪵", ex: "Grew in the dark with no water and no light. Nobody wants to think about what it lived on." },
  /* v68: two fish to a band. The first bites at the band's Fishing level, the second five levels on (spot.fish2). All heal as caught. */
  perch: { name: "Perch", icon: "🐟", heal: 4, ex: "Stripey, bony, and proud of neither. From the Yard's pond, once you've got the knack." },
  catfish: { name: "Catfish", icon: "🐟", heal: 7, ex: "Whiskers, mud, and an expression like it was expecting you. From the Gloam." },
  mudskipper: { name: "Mudskipper", icon: "🐟", heal: 11, ex: "It walked most of the way to your hook. From the lake in the Lantern Mire." },
  /* (2026-09-24, the owner: "is there fishing/woodcutting/mining spots here? needs to be for 60s ... the fishing
     spot should look like that little duck game at carnivals with yellow mini ducks in it, and its only one
     fishing vein") THE 58-TO-80 HOLE. Fishing went Thunder squid at 58 and then NOTHING until the Trailer
     Park's Mudcat at 80 — a twenty-two level gap on the one skill nobody had mentioned, and the other half of
     the lull he spotted in combat. Two rungs off one duck pond close it. */
  goldfish: { name: "Prize goldfish", icon: "🐠", heal: 16, ex: "Won, in a bag, at some point. It has outlived the carnival." },
  koi: { name: "Fairground koi", icon: "🐠", heal: 17, ex: "Far too grand for a plastic tub. Nobody knows who put it in there." },
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
  /* ---------------------------------------------------------------- ALCHEMY (2026-09-24)
     Sand out of the pits in The Golden Sands, melted to glass at a cauldron, brewed with what the world already
     drops. THE INGREDIENTS ARE MOSTLY THINGS THAT EXISTED AND DID NOTHING: the farm's seven crops had no recipe
     anywhere - a dead end this fixes, six of the seven are used here - and staticfur, markedcard, receipt,
     sharktooth, cobweb, sporecap, husk, bones and stormjelly were junk drops. Alchemy is what makes the rest of
     the world worth looting.

     THE VIAL SIZE IS THE TIER AND ALSO THE DURATION: small runs 10 minutes, medium 15, large 20. And the ladder
     ALTERNATES a skilling buff with a combat one all the way up, so neither kind of player ever has a dead
     stretch of levels. Every value sits under its OUT_CAP ceiling (speed .2, tough .3, rare .4, tix .25,
     bite .1, steal .15) so a potion stacks with gear rather than replacing it. Keys are `pot_*` so one regex
     answers "have you brewed anything at all". */
  sand: { name: "Sand", icon: "\u231B", ex: "Fine, pale and everywhere out here. Melts into glass at a cauldron." },
  small_vial: { name: "Small vial", icon: "\u{1F9EA}", ex: "One measure of glass. Holds the short draughts, ten minutes a go." },
  medium_vial: { name: "Medium vial", icon: "\u{1F9EA}", ex: "Two measures, blown properly. Fifteen minutes to the bottle." },
  large_vial: { name: "Large flask", icon: "\u{1F9EA}", ex: "Four measures, corded at the neck. Twenty minutes of the strong stuff." },
  scarabshell: { name: "Scarab shell", icon: "\u{1FAB2}", ex: "Iridescent, and hard enough to turn a blade. Ground down it does the same for you." },
  snakefang: { name: "Cobra fang", icon: "\u{1F9B7}", ex: "Still wet at the tip. Handle it by the blunt end." },
  /* (2026-09-24) THE ONE THING THAT ONLY THE GREAT PYRAMID GIVES. Every chest in that dungeon holds one or two
     and nothing else in the game drops it, which is what makes the raid worth running for something other than
     tickets - it pays 41% less than the Black Crypt on purpose. It gates exactly one recipe, the best potion
     there is. */
  serpentvenom: { name: "Serpent venom", icon: "\u{1F40D}", ex: "Drawn from the Squeeze itself. It eats through the cork if you leave it long enough." },
  palmlogs: { name: "Palm logs", icon: "\u{1FAB5}", ex: "Fibrous and stringy rather than grained. Burns fast and sweet." },
  oasisperch: { name: "Oasis perch", icon: "\u{1F41F}", ex: "Fat, slow and entirely unbothered. Nothing else in the pool worries it.", raw: true },
  nilecarp: { name: "Temple carp", icon: "\u{1F41F}", ex: "Somebody has been feeding these for a very long time.", raw: true },
  coasisperch: { name: "Cooked oasis perch", icon: "\u{1F41F}", heal: 24, ex: "Sweet white flesh. Worth the walk." },
  cnilecarp: { name: "Cooked temple carp", icon: "\u{1F41F}", heal: 27, ex: "Rich, oily and faintly holy." },
  pot_swift: { name: "Swift draught", icon: "\u{1F9EA}", drink: { mins: 10, fx: { speed: 0.04 } }, ex: "Mushroom and panic. 10 minutes outside: everything you do, a little faster." },
  pot_hide: { name: "Hide tonic", icon: "\u{1F9EA}", drink: { mins: 10, fx: { tough: 0.05 } }, ex: "Thick, brown, and it sets slightly. 10 minutes outside: you take less." },
  pot_keen: { name: "Keen-eye water", icon: "\u{1F9EA}", drink: { mins: 10, fx: { rare: 0.06 } }, ex: "Clears the head and sharpens the sight. 10 minutes outside: rare finds come looser." },
  pot_salve1: { name: "Salt salve", icon: "\u{1F9EA}", heal: 14, ex: "Drink it and the bleeding stops. Nobody has asked what is in it." },
  pot_rattle: { name: "Rattle brew", icon: "\u{1F9EA}", drink: { mins: 10, fx: { bite: 0.02 } }, ex: "It knocks against the glass on its own. 10 minutes outside: fish bite more often." },
  pot_quick: { name: "Quickhand philtre", icon: "\u{1F9EA}", drink: { mins: 15, fx: { speed: 0.07 } }, ex: "Brewed over a marked card. 15 minutes outside: properly quick hands." },
  pot_gourd: { name: "Gourd draught", icon: "\u{1F9EA}", drink: { mins: 15, fx: { tough: 0.09 } }, ex: "Gourd milk and bonemeal. 15 minutes outside: hard to dent." },
  pot_salve2: { name: "Field salve", icon: "\u{1F9EA}", heal: 26, ex: "A proper dressing in a bottle. Twice the salt salve and none of the questions." },
  pot_ghost: { name: "Ghost grease", icon: "\u{1F9EA}", drink: { mins: 15, fx: { steal: 0.05 } }, ex: "Cobweb and husk, rendered down. 15 minutes outside: lighter fingers." },
  pot_purse: { name: "Tax-dodger's tincture", icon: "\u{1F9EA}", drink: { mins: 15, fx: { tix: 0.09 } }, ex: "Distilled from a receipt nobody filed. 15 minutes outside: more tickets." },
  pot_prospect: { name: "Prospector's flask", icon: "\u{1F9EA}", drink: { mins: 20, fx: { rare: 0.14 } }, ex: "Gold tomato, a marked card and a scarab's shell. 20 minutes outside: the good drops." },
  pot_fang: { name: "Fang flask", icon: "\u{1F9EA}", drink: { mins: 20, fx: { bite: 0.045 } }, ex: "Two kinds of tooth in one bottle. 20 minutes outside: fish bite a great deal more often." },
  pot_salve3: { name: "Royal salve", icon: "\u{1F9EA}", heal: 44, ex: "What they packed the kings with. It still works." },
  pot_storm: { name: "Storm flask", icon: "\u{1F9EA}", drink: { mins: 20, fx: { speed: 0.12 } }, ex: "It fizzes against the glass and will not sit still. 20 minutes outside: very quick indeed." },
  /* THE TOP OF ALCHEMY, and the only recipe in the game gated behind a dungeon. Better than the Pharaoh's
     draught in both numbers and five minutes longer, because the venom has to be raided for rather than farmed. */
  pot_coilbreaker: { name: "Coilbreaker draught", icon: "\u{1F9EA}", drink: { mins: 25, fx: { tough: 0.24, speed: 0.08 } }, ex: "Venom, cut with glass dust and gourd milk. 25 minutes outside: very hard to hurt, and quick with it. The best thing in the game." },
  pot_pharaoh: { name: "Pharaoh's draught", icon: "\u{1F9EA}", drink: { mins: 20, fx: { tough: 0.18, bite: 0.03 } }, ex: "The best thing anyone can make. 20 minutes outside: hard to hurt, and the fish come to you." },
  lanternfish: { name: "Lanternfish", icon: "🐟", heal: 9, ex: "It has its own little light. It keeps it on even now." },
  clanternfish: { name: "Cooked lanternfish", icon: "🐟", heal: 20, ex: "The light goes out when it's cooked. That's how you know." },
  skyeel: { name: "Sky eel", icon: "🐍", heal: 14, ex: "Caught from a cloud, out of the open sky. It is very surprised about it too." },
  /* (v104) every fish can be cooked now. A cooked fish sells for TWICE the raw one (CRAFT_PAYS, like anything made) and heals about two thirds more. */
  cperch: { name: "Cooked perch", icon: "🐟", heal: 7, ex: "The stripes are grill marks now." },
  ccatfish: { name: "Cooked catfish", icon: "🐟", heal: 12, ex: "The whiskers crisp up nicely. Don't think about it." },
  cmudskipper: { name: "Cooked mudskipper", icon: "🐟", heal: 18, ex: "It stopped walking. Tastes of pond, in a good way." },
  cgoldfish: { name: "Goldfish on a stick", icon: "🐟", heal: 33, ex: "Somebody grilled the prize. It is better this way." },
  ckoi: { name: "Koi on a tray", icon: "🐟", heal: 34, ex: "Served in a paper tray with a wedge of lemon, which is more ceremony than it got alive." },
  cbonefish: { name: "Cooked bonefish", icon: "🐟", heal: 21, ex: "Still mostly bones. Warm bones." },
  cghostcarp: { name: "Cooked ghost carp", icon: "🐟", heal: 22, ex: "You can see the plate through it." },
  ccloudray: { name: "Cooked cloud ray", icon: "🐟", heal: 26, ex: "Light as air. Fills you up anyway." },
  cstormmarlin: { name: "Cooked storm marlin", icon: "🐟", heal: 29, ex: "The nose still hums. Eat around it." },
  cthundersquid: { name: "Cooked thunder squid", icon: "🦑", heal: 32, ex: "Calamari with a kick. An actual kick." },
  cskyeel: { name: "Cooked sky eel", icon: "🐍", heal: 28, ex: "Tastes like a thunderstorm smells." },
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
  { key: "eclipse",     name: "Eclipse",     gate: 70, set: 104, wAcc: 32, wStr: 30, jewel: 12, mark: "🌑", ex: "Forged in the dark at the bottom of the Vault. It weighs nothing and it is very cold." },
  /* (2026-09-25) NOVA AND SINGULARITY, the 80s and the 90s. The owner's first player hit Combat 80 with Eclipse
     as the last thing to wear, which is the same ceiling problem v121 solved above and solved the same way: the
     ladder keeps its own arithmetic - gate +10, set +14, weapon +4/+4, jewel +2 - so there is no new rule here,
     only more of it. EVERYTHING BELOW IS GENERATED FROM THESE TWO LINES: six armour slots, three weapon kinds,
     amulet, ring and the three tools, with their stats, names and requirements, and TOOL_GATES derives from
     TIERS so the tool rungs come with them. The content check asserts the whole ladder strictly increases.

     THE CURVE IS DELIBERATELY STILL STRAIGHT because the owner has said a tier 120 is coming: at gates 100, 110
     and 120 it continues set 146/160/174 and jewel 18/20/22 with nothing to re-tune. Do not bend it to make one
     tier feel special - that is what the glow and the art are for.

     They are also the first tiers whose WEAPON is a chase item rather than a craft; see NOVA_CHASE below. */
  { key: "nova",        name: "Nova",        gate: 80, set: 118, wAcc: 36, wStr: 34, jewel: 14, mark: "\u{1F4AB}", arms: { gladius: { name: "flare knife", short: "Knife", icon: "\u{1F52A}", ex: "Short, and it leaves a line in the air behind it." },
                    sword: { name: "halberd", short: "Halberd", icon: "\u{1FA93}", ex: "Reach, and enough weight at the end of it to matter." },
                    maul: { name: "starbreaker", short: "Breaker", icon: "\u{1F528}", ex: "You do not swing this so much as decide where it is going to land." } },
                        ex: "Poured while the star was still going off. It has not finished cooling and it is not going to." },
  { key: "singularity", name: "Singularity", gate: 90, set: 132, wAcc: 40, wStr: 38, jewel: 16, mark: "\u{1F573}️", arms: { gladius: { name: "event blade", short: "Blade", icon: "\u{1F52A}", ex: "Thin enough that you lose sight of the edge. It is still there." },
                    sword: { name: "voidglaive", short: "Glaive", icon: "\u{1F531}", ex: "Everything near the head of it drifts very slightly toward the head of it." },
                    maul: { name: "collapser", short: "Collapser", icon: "\u{1F528}", ex: "It is heavier at the moment of impact than it was on the way down." } },
                        ex: "It weighs more than a thing that size can weigh. Everything near it leans in a little." },
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

/* (2026-09-24, the owner: "onyx and starfall boots both have +5 defense") EVERY RUNG HAS TO BEAT THE ONE BELOW.
   `set` climbs 14 a tier and boots and gloves take a 0.06 share of it, so consecutive tiers differ by 0.84 - less
   than one - and Math.round collided: onyx 4.56 and starfall 5.40 both became 5. Gloves had it too. Upgrading two
   whole tiers of armour and getting nothing in two slots is the sort of thing a player notices and cannot explain.

   Fixed where it is generated rather than by nudging a share, because the collision is arithmetic and will happen
   again to any small-share slot the moment a tier is added: each slot now remembers the rung below and is forced
   at least one point above it. The content check asserts the whole ladder is strictly increasing. */
const lastDef = {};
for (const t of TIERS) {
  for (const [slot, a] of Object.entries(ARMOUR)) {
    const def = Math.max(Math.round(t.set * a.share), (lastDef[slot] || 0) + 1);
    lastDef[slot] = def;
    ITEMS[`${t.key}_${slot}`] = {
      name: `${t.name} ${a.name}`, short: a.short, icon: a.icon, slot,
      def, tier: t.key,
      req: { skill: "melee", lvl: t.gate }, ex: t.ex
    };
  }
  /* (2026-09-25, the owner: "could we create different weapon variations that essentially do the same thing?
     like a combat knife instead of dagger, haliburt instead of longsword ... but they still follow the concept of
     maul = more damage but swings slower") A tier may rename its three weapons with `arms`. It is a RENAME and
     nothing else: the key stays `<tier>_gladius|sword|maul`, so speed, the acc/str multipliers, needsStr, the
     GEAR_PRICE lookup (which is keyed by kind) and every art and recipe reference keep working untouched.
     WHICH MEANS THE KEY AND THE NAME DIVERGE at the top two tiers - a "Nova halberd" is `nova_sword`. That is
     deliberate and is the cheap half of the trade; renaming the keys would touch nine other tables. */
  for (const [kind, w0] of Object.entries(WEAPONS)) {
    const w = { ...w0, ...(t.arms?.[kind] || {}) };
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
/* (2026-09-25) A NEW RUNG MUST NOT RAISE THE BAR ON ROCKS THAT ALREADY EXISTED, and adding Nova at gate 80 did
   exactly that: toolNeed(85) went from eclipse to nova, so the Trailer Park's four Slag banks - which people mine
   today with an eclipse pickaxe - would have wanted a 250,000-ticket one instead. Nothing announced it.

   It also fixes the circle. A tier's ore is now mined with the tier BELOW's pickaxe, so Nova ore (80) takes an
   eclipse pickaxe and Singularity ore (90) takes a Nova one, which by then you can smith from ore you mined
   yourself. Bom's price is a shortcut, not the only door into the tier.

   THE RULE, for whoever adds tier 100: a new tool rung gates ABOVE the highest node that existed before it (85,
   the Slag banks), not at its tier's own level. Read the nodes, do not guess - the check below does. */
const TOOL_GATE_OVER = { nova: 86, singularity: 96 };
export const TOOL_GATES = TIERS.map((t, i) => (i ? TOOL_GATE_OVER[t.key] || t.gate : 1));
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
   so you stand and work it the way you work a tree or a fishing spot. The empty time is unchanged.

   (2026-09-23, the owner, from tester feedback: "buff all ores across the world from 1-5 hits before vein is
   destroyed to 2-12".) A rock averaged three ore and now averages seven, so the forced stop comes round less than
   half as often. Note it counts ORE TAKEN, not swings: a failed swing costs time but not depth, which is why a
   low-level miner already emptied a rock more slowly than a high-level one.

   Most of what this buys is the interruption, not the ore. Running out clears your action, so you have to pick
   another rock, and that now happens less than half as often. MEASURED with tools/eastscape-skill-sim.mjs at
   +3.9% an hour at level 1, +6.4% at 20 and +6.8% at 40 — I first reasoned it out as ~14% by assuming every swing
   lands, which is wrong: a failed swing costs time without costing depth, so it dilutes the saving. The sim could
   not answer this at all until the same day, because its mining model hopped on every ore and never ran a rock
   dry; it does now. Rocks already
   standing in a loaded scene keep the number they were given until they next empty, so it arrives over a minute
   or two rather than all at once. */
export const ORE_IN_ROCK = [2, 12];
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
  /* (2026-09-23) IT RETURNS THE PIECE, not the key: two pickaxes of the same rung are now different objects if
     one of them is reforged, so "which tool" has to answer with the level as well as the name. */
  const look = (k, f) => { const it = ITEMS[k]; if (it?.tool !== skill) return; const n = (it.tlvl || 1) + f * 0.001; if (n > bn) { bn = n; best = { k, f }; } };
  look(c?.eq?.weapon, fLevelOf(c, "weapon"));
  if (!TOOL_HELD.has(skill)) for (const st of c?.inv || []) look(st.k, fOf(st));
  return best;
}
/** Can they work a node of this level? -> null, or { have, need, held } naming what they are short of.
    `held` says the trouble is WHERE the tool is, not which one: they own one, it is good enough, it is in the bag. */
export function toolBlock(c, skill, lvl) {
  const need = toolNeed(lvl), t = bestTool(c, skill), have = t?.k || null;
  if (!have) {
    const bagged = TOOL_HELD.has(skill) && (c?.inv || []).some((st) => ITEMS[st.k]?.tool === skill);
    return { have: null, need, held: bagged };
  }
  return need.gate <= 1 || (ITEMS[have].tlvl || 1) >= need.gate ? null : { have, need, held: false };
}
/** What reforging adds to a tool, as a fraction of speed: +2.5% a level, nothing on anything that is not a tool. */
export const forgeSpeedAt = (key, f) => (isTool(key) ? Math.max(0, Math.min(FORGE.cap, f | 0)) * FORGE.tspd : 0);
/** How much faster the tool works. 1 with nothing, up to 1.48 at the top rung, plus any reforge on THAT PIECE. */
export const toolSpeed = (c, skill) => { const t = bestTool(c, skill); return t ? (ITEMS[t.k].tspd || 1) + forgeSpeedAt(t.k, t.f) : 1; };

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
  const a = styleBonusOf(now), b = styleBonusOf(then);   /* (2026-09-25) what the piece does for the style you would be fighting in */
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
  if (d.swingMs && d.swingMs[0] !== d.swingMs[1]) bits.push(`${ITEMS[k]?.launcher ? "attack speed" : "swing"} ${(d.swingMs[0] / 1000).toFixed(1)}s\u2192${(d.swingMs[1] / 1000).toFixed(1)}s`);
  if (d.missing) return `Needs ${SKILLS[d.missing.skill].name} ${d.missing.lvl}`;
  if (!bits.length) return d.replacing === k ? "Already worn" : "No change";
  return bits.join(", ");
}
export const SKILLS = {
  // ONE combat skill (2026-09-19): it is your accuracy, your max hit and your defence. The key stays "melee" (what it
  // was before the three-way split) so the hiscores' separate "combat level" board keeps its own name.
  melee: { name: "Melee", icon: "⚔️" },   /* (2026-09-25) was "Combat": Archery arrived and "Combat" became the level all three make together */
  hp: { name: "Hitpoints", icon: "❤️" }, fishing: { name: "Fishing", icon: "🎣" }, cooking: { name: "Cooking", icon: "🍳" },
  farming: { name: "Harvesting", icon: "🌾" }, mining: { name: "Mining", icon: "⛏️" }, woodcutting: { name: "Woodcutting", icon: "🪓" },
  smithing: { name: "Smithing", icon: "🔨" },
  agility: { name: "Agility", icon: "🤸" },
  thieving: { name: "Thieving", icon: "🤏" },
  alchemy: { name: "Alchemy", icon: "🧪" }   /* (2026-09-24) sand to glass to potions, 1 to 100. The Golden Sands is its home. */
};
export const COMBAT_SKILLS = ["melee"];
// how the skills panel groups them. Hitpoints sits with combat because that is
// the only place it is earned, even though it is not something you choose.
export const SKILL_GROUPS = [
  { name: "Combat", keys: ["melee", "hp"] },
  { name: "Skilling", keys: ["fishing", "cooking", "farming", "woodcutting", "mining", "smithing", "agility", "alchemy"] }   /* "thieving" is pushed on below, when THIEF.live */   /* (v121) woodcutting, mining and smithing are back on the panel: every map has choppable trees again (1-2 a level, the owner's ask) and the Vault put the last two ore seams in the world, so the three of them lead somewhere once more. */
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
export const HP_XP = 4 / 3;        // per point of damage, with a melee weapon
/* (2026-09-27, the owner: "one way we can balance magic and archery is to make it so they dont give an XP to hitpoints, since technically
   at range youre not getting hit") A BOW OR A WAND TRAINS HITPOINTS AT A THIRD OF THE RATE. Not none: Hitpoints IS your maximum health, so
   none at all would leave someone who only ever shoots at 10 health forever, one hit from dead at level 80. The owner chose a reduced share
   from the three options put to them. Melee is unchanged. */
export const RANGED_HP_SHARE = 1 / 3;
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
/** What one hit is worth, as [skill, xp] pairs: COMBAT_XP per damage into the style's skill, and HP_XP into Hitpoints (a third of that with a bow or a wand). */
export function xpForDamage(c, dmg) {
  const out = [];
  for (const [skill, share] of Object.entries(STANCES[stanceOf(c)].share)) out.push([skill === "melee" ? styleOf(c) : skill, COMBAT_XP * share * dmg]);   /* (2026-09-25) a bow pays Archery */
  out.push(["hp", HP_XP * dmg * (styleOf(c) === "melee" ? 1 : RANGED_HP_SHARE)]);
  return out;
}

/* How long a swing takes. A weapon with no speed of its own swings at SWING_MS,
   which is what the game used for everything before weapons had speeds. */
export const SWING_MS = 2400;

/* ACTIVE CLICKING (2026-09-25, the owner: "users are now complaining about the reclick, theyre calling it active
   clicking, is there a way that we can reimplemt it, or a version of it, that isnt overpowered?").

   Clicking the thing you are ALREADY fighting banks one "urge", which shaves this fraction off your next swing.
   It is a boolean, cleared the instant you swing, so it cannot compound - and it is the whole mechanic:

     ONE CLICK PER SWING IS THE CEILING. Clicking five times faster pays exactly the same, because the second
     click only re-sets a flag that is already set. That is what makes this a rhythm somebody can hold rather
     than a race, and it is why it needs no anti-spam rule.
     IT IS A FRACTION, NOT A NUMBER OF MILLISECONDS. A flat shave would be worth twice as much on a gladius as on
     a maul; a share is worth the same to everyone, so it never quietly picks a weapon.
     IT DOES NOT TOUCH THE MONSTER'S CLOCK. Half of what made the original a 4.5x exploit was that re-clicking
     pushed the monster's swing away too, which bought immunity on top of the damage. That half is gone for good.

   0.15 is about +17% (the owner picked it over 0.10). The ceiling here is set by what a SCRIPT may have rather
   than by what feels good: a bot clicks perfectly, so whatever this pays, assume everyone gets all of it. 17% for
   a bot is a cost worth paying for a mechanic people enjoy. DO NOT RAISE IT FAR: past about 20% not clicking
   starts to read as a penalty rather than a choice, and the Tower stops being semi-AFK because a climber would
   be leaving a fifth of their damage on the table by walking away. */
/* STACKING (2026-09-25, the owner: "what if we allowed users to 'stack' attack speed if they do multiple active
   clicks in a row?" then "lets make the cap 50%. not worried about bots"). Consecutive URGED swings climb this
   ladder; one step per swing, and a swing that lands without a click knocks it back to the bottom. So the reward
   is for holding a rhythm rather than for clicking, and the spam-proof property survives untouched: a second
   click inside the same swing still only re-sets a flag that is already set.

   At the top the shave is half, which is DOUBLE damage for someone playing actively - deliberately large, because
   the complaint being answered is that combat "feels like an afk experience". The owner has accepted that a script
   holds the top step permanently; that is what "not worried about bots" decided, and it is the only reason a
   number this big is here. If it is ever revisited, this array is the whole knob.

   SWING_URGE stays as the name of the FIRST step: the swing checker and the worker both read it. */
export const SWING_STACK = [0.15, 0.25, 0.35, 0.5];
export const SWING_URGE = SWING_STACK[0];
export const swingShave = (step) => SWING_STACK[Math.min(step | 0, SWING_STACK.length - 1)];
/* HOW FAST YOU SWING, CHOP, MINE, FISH AND PICK POCKETS — one number, and the ONLY one anything should divide by.
   (2026-09-24, the owner: the Coilling "needs to also add +2 inventory slots and +10% skilling speed/swing rate".)

   A pet could not do that before, because `speed` already means something else on a pet: PETS[k].fx.speed is
   MOVEMENT, and it goes petFx -> speedRaw -> stepMsOf and nowhere near here. So the Coilling carries a separate
   `swing`, and this is where the two worlds meet — the gear/meal/drink lever out of fxOf, plus the pet's, capped
   ONCE at OUT_CAP.speed so a pet cannot lift anybody past the same 20% ceiling everything else lives under.
   (Which does mean a player already at the cap gains nothing from it, exactly as a second speed potion would.)
   Percent on a pet, fraction in fxOf, hence the /100 — the two scales are a trap and this is the only crossing. */
export const swingFx = (c) => Math.min(OUT_CAP.speed, fxOf(c).speed + petFx(c).swing / 100);
export const swingMsOf = (c) => Math.round((ITEMS[c?.eq?.weapon]?.speed || SWING_MS) / (1 + swingFx(c)));   /* (fxOf and OUT_CAP are further down; these are functions, so the order in this file does not matter) */
export const TOOL_OF = { mining: "pickaxe", woodcutting: "axe", fishing: "rod" };
export const INV_MAX = 25;   // (2026-09-27, the owner: "with all the new items, lets give all users default of 25 inventory slots") 20 from 2026-09-20 to 2026-09-27; (was 30 until 2026-09-20: a casino game wants a small bag that fills, so you walk back past the tables to the Cashier.
                             //  normChar re-packs an old 30-slot bag on load and sends what no longer fits to the bank, so nothing is lost.)
export const BANK_MAX = 200;
/* (2026-09-27, the owner: "add bank pages ... give them 5 bank pages to start. replicate osrs") a bank row may carry p, 0..BANK_PAGES-1, the page it is filed on; 0 is the first page and is not stored */
export const BANK_PAGES = 5;
export const FAV_MAX = 40;
export const isFav = (c, k) => Array.isArray(c?.fav) && c.fav.includes(k);
// a bag slot holds up to 99 of a thing; tickets (and anything marked nocap) piles up without limit. The bank has no cap.
export const STACK_MAX = 99;
export const capOf = (k) => (ITEMS[k]?.nocap ? Infinity : ITEMS[k]?.cap || STACK_MAX);   /* (2026-09-25) `cap`: arrows stack to 1,000 (the owner) */
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
/* (2026-09-27) WHERE EACH STACK SITS. The bag is still a dense list (every place that walks it is untouched), but a stack may carry
   `p`, the slot it was put in: one array of bagMax(c) entries, each the index of the stack in it or -1. Stacks with a valid, unclaimed
   slot take it; the rest fill the empty slots in order, which is where a new item lands (the first gap, as in OSRS). */
export const invLayout = (c) => {
  const n = bagMax(c), inv = Array.isArray(c?.inv) ? c.inv : [], slots = new Array(n).fill(-1), rest = [];
  inv.forEach((s, i) => { const p = s && Number.isInteger(s.p) && s.p >= 0 && s.p < n && slots[s.p] < 0 ? s.p : -1; if (p >= 0) slots[p] = i; else rest.push(i); });
  let j = 0; for (const i of rest) { while (j < n && slots[j] >= 0) j++; if (j >= n) break; slots[j++] = i; }
  return slots;
};
/** every stack takes the slot it is drawn in right now, so that from here on a used-up stack leaves a gap and nothing shifts */
export const settleSlots = (c) => { const lay = invLayout(c); lay.forEach((i, pos) => { if (i >= 0 && c.inv[i].p !== pos) c.inv[i].p = pos; }); return c; };
/** the first empty slot of a bag being filled (the `inv` given, laid out for the character `c`), or -1 when it is full */
const firstFree = (inv, c) => { const v = Object.create(c || {}); v.inv = inv; return invLayout(v).indexOf(-1); };
export const bagMax = (c) => INV_MAX + (c ? petFx(c).slots + (achFx(c).slots | 0) + Math.min(BAG_UPGRADES.length, c.bagUp | 0) : 0);   /* achFx: the two pockets the milestones give */
/* ============================================================================================================
   THE REFORGE BELONGS TO THE ITEM (2026-09-23, the owner: "make the reforge travel with the item")

   It used to live on the CHARACTER, as C.forge[itemKey] -> level. That was fine while gear could not really
   change hands and it is why the wiki said "a reforged piece belongs to whoever reforged it", but it made three
   things impossible: a reforged piece could not be sold (the buyer got a plain one and the seller kept the
   level, so buying the same piece again found it still +3), you could never own two of a kind at different
   levels, and a market listing could not honestly advertise what it was selling.

   NOW: an inventory or bank entry may carry `f`, its reforge level, and equipment carries it in C.eqf[slot].
   Two rules keep that from going wrong, and both are enforced here rather than at the thirty-odd call sites:

     1. A FORGED ENTRY NEVER STACKS. It is always n:1 in a slot of its own, because +1 and +3 are not the same
        object and 99 of them in one stack could not say which. That costs a bag slot per reforged piece, which
        is the honest price of the feature.
     2. takeInv SPENDS THE PLAIN ONES FIRST. Selling, eating, using or handing over five of something must never
        reach for the reforged one while an ordinary one is sitting there. This is the rule that stops the
        feature eating somebody's best item, and it is why every existing caller could be left alone.
   ============================================================================================================ */
/** The reforge level on an inventory/bank entry (0 for an ordinary one). */
export const fOf = (s) => Math.max(0, Math.min(FORGE.cap, (s?.f | 0) || 0));
/** The highest reforge level anywhere on this character: worn, carried, banked - or in the pre-migration map. */
/* (2026-09-24) THE ONE PLACE THAT ANSWERS "HAS THIS PERSON REFORGED ANYTHING". The level lives in three places
   since it moved onto the item, and the achievements were still reading a fourth that nothing writes. The legacy
   `c.forge` is included on purpose: somebody who reforged a piece long ago and has since traded it away should
   not have to do it again to be credited. Losing the piece later cannot take the achievement back, because an
   earned one is recorded in c.ach and `has` is only ever asked on the way in. */
export const topForge = (c) => {
  if (!c) return 0;
  let top = 0;
  const bump = (v) => { const n = Math.max(0, Math.min(FORGE.cap, v | 0)); if (n > top) top = n; };
  for (const v of Object.values(c.eqf || {})) bump(v);
  for (const s of c.inv || []) bump(fOf(s));
  for (const s of c.bank || []) bump(fOf(s));
  for (const v of Object.values(c.forge || {})) bump(v);
  return top;
};
/** May these two entries share a stack? Only if neither is reforged. */
export const sameStack = (a, b) => a.k === b.k && !fOf(a) && !fOf(b);

/* (2026-09-24) `c` HAS NO SAFE DEFAULT, so it no longer has one. It defaulted to null, and bagMax(null) returns
   a bare INV_MAX - which means every caller that forgot the character quietly measured a 20-slot bag and refused
   to fill the pockets a player had bought and earned. That is what happened to smelting, and it failed in the
   worst direction: a hard refusal with a message blaming the player's bag.

   Leaving it required is the whole fix. A caller that genuinely has no character (there are none today) can pass
   null explicitly and say so, which is a decision on the page rather than an omission. */
export const roomFor = (inv, k, c, f = 0) => {
  const cap = capOf(k), free = bagMax(c) - inv.length;
  if (f > 0) return free > 0 ? 1 : 0;   // a reforged piece needs a slot of its own; it can never join a stack
  if (cap === Infinity) return inv.some((s) => s.k === k && !fOf(s)) || free > 0 ? Infinity : 0;
  return inv.reduce((r, s) => r + (s.k === k && !fOf(s) ? Math.max(0, cap - s.n) : 0), 0) + free * cap;
};
// top up the stacks already there, then open new ones; returns what didn't fit
/* (2026-09-24) `c` IS REQUIRED HERE TOO, for the reason roomFor's is. Both stop at bagMax(c), and bagMax(null)
   is a bare INV_MAX - so every caller that left the character out packed the bag into 20 slots and handed back
   the remainder as "did not fit", ignoring the pockets a player had bought and earned. Four callers had. */
export const addInv = (inv, k, n, c, f = 0) => {
  const cap = capOf(k);
  if (f > 0) {   // one slot each, never merged: see rule 1 above
    while (n > 0 && inv.length < bagMax(c)) { const p = firstFree(inv, c); inv.push({ k, n: 1, f, ...(p >= 0 ? { p } : {}) }); n -= 1; }
    return n;
  }
  for (const s of inv) { if (n <= 0) break; if (s.k === k && !fOf(s) && s.n < cap) { const t = Math.min(n, cap - s.n); s.n += t; n -= t; } }
  /* (2026-09-27) a new stack takes the first empty SLOT (OSRS), not just the end of the list: see invLayout */
  while (n > 0 && inv.length < bagMax(c)) { const t = Math.min(n, cap), p = firstFree(inv, c); inv.push({ k, n: t, ...(p >= 0 ? { p } : {}) }); n -= t; }
  return n;
};
// take up to n of k, from the last stacks first; returns how many were taken
// the bag's tidy order: tickets, tools, weapons and armour (by slot, best tier first), food, then everything else by name.
// Partial stacks of the same thing are merged back into 99s, so a sort can free slots.
/* (2026-09-24) SORTING NEEDS TO KNOW HOW BIG THE BAG IS. This rebuilds the bag by re-adding every stack through
   addInv, which stops at bagMax - so without the character it rebuilt into 20 slots and anything past that came
   back as overflow. The sort handler compares the totals before and after and refuses a sort that loses
   anything, so nothing was ever destroyed; Sort simply did nothing at all for anyone with more than 20 slots in
   use, with no message to say why. */
export function sortInv(inv, c) {
  const tierRank = (k) => { const t = ITEMS[k]?.tier, i = TIERS.findIndex((x) => x.key === t); return i < 0 ? 99 : -i; };
  const group = (k) => { const it = ITEMS[k] || {}; return k === "tickets" ? 0 : it.tool ? 1 : it.slot ? 2 + SLOTS.indexOf(it.slot) / 10 : it.heal ? 3 : 4; };
  /* REFORGED PIECES ARE SET ASIDE AND PUT BACK WHOLE. This function rebuilds the bag by totalling each key and
     re-adding it, which would happily melt a +3 and a plain one into a stack of two and lose the level. They go
     back first, best last, right after the plain ones of the same kind. */
  const forged = inv.filter((s) => fOf(s)).map((s) => ({ k: s.k, n: 1, f: fOf(s) }));
  const totals = new Map(); for (const s of inv) if (!fOf(s)) totals.set(s.k, (totals.get(s.k) || 0) + s.n);
  const fav = new Set(Array.isArray(c?.fav) ? c.fav : []);   /* (2026-09-27) favourites first, then the old order */
  const keys = [...new Set([...totals.keys(), ...forged.map((s) => s.k)])].sort((a, b) => (a === "tickets" ? 0 : 1) - (b === "tickets" ? 0 : 1) || (fav.has(a) ? 0 : 1) - (fav.has(b) ? 0 : 1) || group(a) - group(b) || tierRank(a) - tierRank(b) || (ITEMS[a]?.name || a).localeCompare(ITEMS[b]?.name || b));
  const out = [];
  for (const k of keys) {
    if (totals.get(k)) addInv(out, k, totals.get(k), c);
    for (const s of forged.filter((x) => x.k === k).sort((a, b) => a.f - b.f)) out.push({ ...s });
  }
  return out;
}
/* PLAIN ONES FIRST (rule 2). Two passes: everything unforged, and only then the reforged ones weakest-first.
   A caller that means "take this exact piece" passes its index to takeAt instead. */
export const takeInv = (inv, k, n) => {
  let got = 0;
  for (const forged of [false, true]) {
    const idx = inv.map((s, i) => [s, i]).filter(([s]) => s.k === k && !!fOf(s) === forged)
      .sort((a, b) => fOf(a[0]) - fOf(b[0]) || b[1] - a[1]).map(([, i]) => i);
    for (const i of idx) { if (got >= n) break; const s = inv[i]; const t = Math.min(n - got, s.n); s.n -= t; got += t; }
  }
  for (let i = inv.length - 1; i >= 0; i--) if (!inv[i].n) inv.splice(i, 1);
  return got;
};
/** Take ONE specific entry by index — what the anvil, equipping and a trade offer need. Returns { k, f } or null. */
export const takeAt = (inv, i) => {
  const s = inv[i | 0]; if (!s || s.n < 1) return null;
  const out = { k: s.k, f: fOf(s) };
  s.n -= 1; if (!s.n) inv.splice(i | 0, 1);
  return out;
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
  /* (2026-09-24) THE GREAT PYRAMID'S PET, and the only one that does not drop from PET_SCENES: it comes out of
     the raid's chest, about one clear in twenty. It is THE BEST PET IN THE GAME and meant to be — it is the only
     one behind a raid, at 1 in 20 clears, where the others are found by walking around. It does three of the four
     jobs the other five split between them, and the Coin Toad keeps tickets to itself.

     TWO OF ITS THREE NUMBERS ARE CALLED SPEED AND THEY ARE NOT THE SAME THING. `speed` is MOVEMENT (petFx ->
     speedRaw -> stepMsOf, whole percent, ceiling 50). `swing` is the swing/chop/mine/fish/pick rate, and it
     reaches the world only through swingFx, which folds it into the fxOf lever of that name (fraction, ceiling
     0.2). Putting the second one in `speed` would have made the owner walk faster and mine at the same rate. */
  coilling: { name: "Coilling", art: "pet_coilling", raid: true, fx: { speed: 10, slots: 2, swing: 10 }, ex: "It was in the sarcophagus with him. It has decided you are family now." },
  housecat:    { name: "House Cat",    art: "pet_housecat",    fx: { speed: 3, slots: 1, hp: 5, tix: 5 }, ex: "Wears the visor. Owns the room." }
};
export const PET_KEYS = Object.keys(PETS);
/* WHAT A KILL CAN ACTUALLY DROP, which is not the same list (2026-09-24, the owner, reading the wiki: "it says
   coilling drops in Where it drops ... but its only the great pyramid right").
   HE WAS RIGHT AND IT WAS NOT JUST THE WIKI. The roll picked out of PET_KEYS — every pet there is — so the
   Coilling really was dropping from ordinary kills in the Boneyard and beyond, at a sixth of every one-in-a-
   thousand. The best pet in the game, gated behind a four-person raid, was also being handed out for grinding
   chickens in the Trailer Park. A `raid: true` pet is out of the pool and comes only from wherever its dungeon
   puts it. Add the flag and this, the wiki page and the content check all follow. */
export const PET_DROP_KEYS = PET_KEYS.filter((k) => !PETS[k].raid && !PETS[k].bred);
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
export const petLabel = (p) => (p ? (p.name || `${p.tier ? "Greater " : ""}${PETS[p.k].name}`) : "");
/** Every bonus the worn pet gives, or zeroes. One place, so nothing has to remember the shape. */
export function petFx(c) {
  const p = activePet(c), fx = p ? (p.fx || PETS[p.k].fx) : null;   /* (2026-09-27) a Greater pet carries its own `fx` */
  /* `speed` is MOVEMENT and `swing` is the swing/chop/mine/fish/pick rate. Two different things, deliberately
     two different names: see swingFx, which is the one place a pet's swing meets the fxOf lever. */
  return { speed: fx?.speed || 0, slots: fx?.slots || 0, hp: fx?.hp || 0, tix: fx?.tix || 0, swing: fx?.swing || 0,
    /* (2026-09-27) the Breeding pets' effects, one skill each; all percent except reach (tiles) and gift (a flag) */
    reach: fx?.reach || 0, tough: fx?.tough || 0, grow: fx?.grow || 0, bite: fx?.bite || 0, noburn: fx?.noburn || 0, freesmelt: fx?.freesmelt || 0, steal: fx?.steal || 0, gem: fx?.gem || 0, gift: fx?.gift || 0 };
}
export const STEP_MS = 200 /* (v95, the owner: "make users default walk speed about 20% faster": it was 240. Players only: monsters, NPCs and the fake players keep the server's own 240.) */, SPEED_FULL = 20, SPEED_CAP = 50;
/* (2026-09-22) AGILITY IS PAID HERE. agilBonus was written the day the skill was built and never called from
   anywhere, so every level of it did precisely nothing — which is most of why The Run felt like a treadmill. It
   goes in with the meals and the boots rather than beside them, so it lands inside SPEED_FULL/SPEED_CAP's
   diminishing returns and cannot stack past a ceiling that was designed before the skill existed. */
export function speedRaw(c, extra = 0) { let raw = extra + petFx(c).speed + agilBonus(c) + charmOf(c, "haste"); for (const k of Object.values(c.eq || {})) if (k && ITEMS[k]?.spd) raw += ITEMS[k].spd; return raw; }   /* eq.pet is an id, not an item key, so the loop below skips it and petFx adds it instead */
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
      const put = (t, x, y, name, extra) => { objs.push({ t, x, y, name, ...(extra || {}) }); g[y][x] = "#"; keep.push([x, y]); };

      /* (2026-09-24) A SHAPE OF ITS OWN. The Gloam was the Yard's skeleton with a darker tint over it: a road
         straight across y13, a rectangular pond, and its ore and trees in pairs side by side. BOTH maps ran
         `g[13][x] = ","` for every x, which is why they read as the same field twice. The road winds now, the
         pond has a ragged shore, and nothing is paired. */
      const path = [];
      const runX = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) path.push([x, y]); };
      const runY = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) path.push([x, y]); };
      runX(13, 36, COLS - 1); runY(36, 8, 13); runX(8, 28, 36); runY(28, 8, 16);
      runX(16, 20, 28); runY(20, 11, 16); runX(11, 13, 20); runY(13, 11, 13); runX(13, 0, 13);
      for (const [x, y] of path) { g[y][x] = ","; keep.push([x, y]); }

      /* The black pond, off the middle and given a shore. Spots sit on the FIRST water row and are fished from
         the bank above, which is why y18 and y19 are kept clear of scenery. */
      for (let y = 20; y <= 23; y++) for (let x = 26; x <= 38; x++) {
        if ((x <= 27 || x >= 37 || y === 23) && hashRand(x, y, 77) < 0.45) continue;
        g[y][x] = "~";
      }
      scatterSpots(objs, 27, 37, 20, 5, [1, 2, 3, 5], { name: "Black pond", req: { skill: "fishing", lvl: 10 }, fish: "trout", fish2: "catfish", fish2lvl: 15, xp: 50, xp2: 65, glow: "#7ad8ff", tease: "Something moves down there and it is not a fish." });
      for (let x = 25; x <= 39; x++) keep.push([x, 19], [x, 18]);

      /* ORE AND TREES, SCATTERED. Two of each as before, the owner: "keep same trees and rocks, just place
         sporadically around" - but nowhere near one another, so the corners are worth walking to. */
      put("rock", 15, 4, "Emerald rock", { ore: "emerald_ore", req: { skill: "mining", lvl: 20 }, xp: 40 });
      put("rock", 31, 8, "Emerald rock", { ore: "emerald_ore", req: { skill: "mining", lvl: 20 }, xp: 40 });
      put("willow", 24, 3, "Gloomwillow", { log: "willowlogs", req: { skill: "woodcutting", lvl: 15 }, xp: 120 });
      put("willow", 14, 22, "Gloomwillow", { log: "willowlogs", req: { skill: "woodcutting", lvl: 15 }, xp: 120 });

      /* HOLLOWAY (2026-09-24, the owner: "the yard currently feels like a mini city with the court area, lets
         thematically build an even smaller city on the far west side of the gloam"). A hamlet that lost, on the
         road out to the Mire: four broken pillars where a hall stood, a dry fountain, fallen fences, and the
         furniture still where people left it. Deliberately smaller than the Yard's court - twenty-one pieces
         against its sixty-odd - and every one examinable, because reading a place is what makes it one. */
      put("column", 4, 9, "Broken pillar", { art: "o_cryptpillar" });
      put("column", 9, 9, "Broken pillar", { art: "o_cryptpillar" });
      put("column", 4, 16, "Broken pillar", { art: "o_cryptpillar" });
      put("column", 9, 16, "Broken pillar", { art: "o_cryptpillar" });
      put("fountain", 6, 10, "Dry fountain");
      put("barricade", 7, 7, "Fallen fence", { art: "o_fenceH" });
      put("barricade", 11, 18, "Fallen fence", { art: "o_fenceH" });
      put("table", 5, 7, "Somebody's table");
      put("chair", 6, 7, "Somebody's chair");
      put("bench", 7, 11, "Bench");
      put("fire", 9, 11, "Campfire");
      put("crate", 8, 17, "Crate");
      put("barrel", 10, 15, "Barrel");
      put("sack", 3, 12, "Sack");
      put("lamp", 8, 12, "Lamp post, long out", { art: "o_lamppost" });
      put("lamp", 4, 14, "Lamp post, long out", { art: "o_lamppost" });
      put("gravestone", 3, 18, "Gravestone");
      put("gravestone", 5, 19, "Gravestone");
      put("gravestone", 2, 16, "Gravestone");
      put("skeleton", 11, 8, "Somebody who stayed");

      /* AND OUT WHERE THE MONSTERS ARE: dead wood, stones, and what the fog has been keeping. */
      put("snag", 22, 9, "Dead tree");
      put("snag", 33, 6, "Dead tree");
      put("boulder", 25, 10, "Boulder");
      put("boulder", 31, 14, "Boulder");
      put("gravestone", 39, 8, "Gravestone");
      put("skeleton", 24, 21, "Somebody who stayed");
      put("bush", 19, 17, "Glowcap cluster", { art: "o_glowcap" });
      put("bush", 35, 17, "Glowcap cluster", { art: "o_glowcap" });

      /* the rope ladder down into the Wilderness, on Holloway's edge where a cellar would have been */
      put("wildladder", 12, 21, "Rope ladder: down into the Wilderness");

      /* (2026-09-24) THE THIEVES' GUILD MOVED HERE, far north-east corner, with Vance beside it. It stood in the
         Yard beside the pond - the brightest, busiest, most municipal square in the game, and the worst possible
         doorstep for a thieves' den. Out here it is a shed in the dark at the end of a bad road. */
      put("roomdoor", 40, 4, "The Thieves' Guild: members only", { art: "o_roomdoor", enter: "guild", permit: true });
      for (let y = 3; y <= 7; y++) for (let x = 36; x <= 42; x++) keep.push([x, y]);

      put("sign", 3, 11, "West: the Lantern Mire. It opens at Combat 20, and Fishing 20 for the lake.");
      put("sign", 34, 13, "THE GLOAM: Combat 10 to 19. Almost everything out here waits to be hit first \u2014 click a monster to fight it. ONE thing does not: a Bog Gnasher in the north clearing comes at you on sight. Give it room, or give it a sword.");
      put("sign", 7, 13, "HOLLOWAY. Nobody has lived here for a long time. The road west carries on to the Mire.");

      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 9);
      return { g, objs, blobs: [] };
    },
    /* Toadstools by the way in, highwaymen and goats through the middle, the idle dead around Holloway.
       ONE AGGRO MOB (2026-09-24, the owner: "there should be just ONE aggro mob on the map, to introduce players
       to the concept ever so slightly"). The gnasher TYPE stays passive - its `aggroWas` was switched off long
       ago, and three more of them live in the Wilderness, which nobody asked to change - so the hostility rides
       the PLACEMENT: a fourth element on one line. It stands off the road in the north clearing with a reach of
       3, so passing at a distance costs nothing and blundering into it does. */
    mobs: [["toadstool", 39, 15], ["toadstool", 35, 10], ["toadstool", 41, 18], ["toadstool", 30, 12], ["toadstool", 41, 11], ["toadstool", 27, 7],
      ["highwayman", 8, 4], ["highwayman", 13, 6], ["highwayman", 5, 22], ["highwayman", 29, 17], ["highwayman", 21, 22], ["highwayman", 34, 16],
      ["goat", 18, 6], ["goat", 29, 4], ["goat", 32, 10], ["goat", 16, 15],
      ["boneidle", 2, 21], ["boneidle", 6, 21], ["boneidle", 2, 6], ["boneidle", 10, 22],
      ["gnasher", 21, 4, { aggro: 3 }], ["gnasher", 25, 6], ["gnasher", 19, 2], ["gnasher", 27, 2]],
    npcs: [{ name: "Grimm the Hermit", art: "grimm", x: 14, y: 20, still: true, quests: ["firstbow", "firstpage", "weaver", "marrow", "nexus"], hair: "#c8c8c0", shirt: "#6a4a2a", pants: "#4a3a2a", lines: ["Down that rope is the Wilderness. Anybody down there can hit you. Some of them will.", "Bow, or wand. Either way you're not standing next to it when it dies.", "I came up for salt in '09 and never went back down. Ask me why and I'll say salt."] },
      
      /* Vance came with the door. He is `still`, and his lines are unchanged: the price, the Crypt drop, and that
         a permit can be bought off another thief for less. */
      { name: "Vance the Fence", art: "vance", x: 38, y: 5, still: true, quests: ["boneidle"], opens: "permit", reach: 3,
        hair: "#3a2e1a", shirt: "#8a6a2a", pants: "#2e2a22",
        lines: ["Guild's through there. You'll not get past the door without a permit.",
          "Fifty thousand tickets and it's yours. I don't haggle and I don't do credit.",
          "They turn up in the Crypt as well, now and then \u2014 in the Hoodie's hoard, if you're lucky. Rare, mind. I've sold plenty to people who got tired of waiting.",
          "It's a proper item, so you can buy one off another thief if they'd rather have the tickets. Usually cheaper than my price, and I'll not pretend otherwise.",
          "One permit, one door, once. After that it's yours for good and I never see you again."] },
    ],
    bots: []
  },
  /* THE LANTERN MIRE, 20-29 (v68). The Gloam's ground gone green, and a LAKE where the Gloam had a pond. */
  mire: {
    name: "The Lantern Mire", ground: "gloam", exits: { e: "gloam", n: "boneyard" }, tint: "rgba(14,52,22,.34)",
    build() {
      const g = grid(), objs = [], keep = [];
      const put = (t, x, y, name, extra) => { objs.push({ t, x, y, name, ...(extra || {}) }); g[y][x] = "#"; keep.push([x, y]); };

      /* (2026-09-24) REBUILT, like the Gloam before it, and dressed for a haunting. It was the Yard's skeleton
         again - `g[13][x] = ","` straight across, a rectangular lake, ore and trees in pairs - with two signs on
         it and nothing else. The owner: "make this a spooky vibe ... needs to be very spooky, this is where the
         future halloween event will mostly take place on too", so the flavour here is doing real work: the
         October event needs somewhere that already looks the part in September. */
      const path = [];
      const runX = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) path.push([x, y]); };
      const runY = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) path.push([x, y]); };
      /* in from the Gloam at the east, north, back west, and down the middle to the north road at x22 */
      runX(13, 37, COLS - 1); runY(37, 8, 13); runX(8, 29, 37); runY(29, 8, 15);
      runX(15, 22, 29); runY(22, 13, 15); runX(13, 17, 22); runY(17, 13, 17);
      /* and on west to the sharks' corner, which is the only way to the diamond */
      runX(17, 9, 17); runY(9, 17, 21); runX(19, 5, 9); runY(5, 19, 22);
      runY(39, 13, 17);   // the short spur south off the road, into Lanternwick
      for (const [x, y] of path) { g[y][x] = ","; keep.push([x, y]); }

      /* THE LAKE, given a shore. Rows 19 to 21 are left solid between x17 and x32 because scatterSpots staggers
         a spot onto y0 OR y0+1, and a spot on dry land is a fishing hole nobody can fish. */
      for (let y = 19; y <= 23; y++) for (let x = 15; x <= 34; x++) {
        if ((x <= 16 || x >= 33 || y >= 22) && hashRand(x, y, 41) < 0.45) continue;
        g[y][x] = "~";
      }
      /* A SKIPPED TILE IN THE MIDDLE OF THE WATER IS A ONE-TILE ISLAND, and one that nothing can fix later:
         markBanks turns it into a bank tile ("b") because it touches water on every side, and wild repairs a
         cut-off scene by re-planting "." tiles only, so it sits there for ever as somewhere a player can see and
         never stand. Flooding anything with water on all four sides costs one pass and ends the whole class. */
      for (let y = 19; y <= 23; y++) for (let x = 15; x <= 34; x++)
        if (g[y][x] !== "~" && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => g[y + dy]?.[x + dx] === "~")) g[y][x] = "~";
      scatterSpots(objs, 18, 31, 19, 5, [1, 2, 3, 5], { name: "Lantern lake", req: { skill: "fishing", lvl: 20 }, fish: "lanternfish", fish2: "mudskipper", fish2lvl: 25, xp: 80, xp2: 95, glow: "#a8ffb0", tease: "Little lights drift under the surface. They move away when you lean close. Fishing 20." });
      for (let x = 14; x <= 35; x++) keep.push([x, 18], [x, 17]);

      /* ORE AND TREES. Both diamond rocks stay in the south-west, because that corner is where the Loan Sharks
         are and the owner wanted the aggressive one standing over the veins - but they are no longer side by
         side, and the deadwood is split to opposite ends of the map. */
      put("rock", 6, 18, "Diamond rock", { ore: "diamond_ore", req: { skill: "mining", lvl: 30 }, xp: 62 });
      put("rock", 10, 21, "Diamond rock", { ore: "diamond_ore", req: { skill: "mining", lvl: 30 }, xp: 62 });
      put("deadtree", 8, 7, "Deadwood", { log: "ashlogs", req: { skill: "woodcutting", lvl: 20 }, xp: 140 });
      put("deadtree", 36, 9, "Deadwood", { log: "ashlogs", req: { skill: "woodcutting", lvl: 20 }, xp: 140 });

      /* LANTERNWICK (2026-09-24, the owner: "add a random small city/court area near the entrance"). A chapel
         court that the mire took: an arch with no doors, a nave of broken pillars, and the candles still lit.
         It sits immediately south of the way in, so it is the first thing anyone sees arriving from the Gloam,
         and it is deliberately a ROOM - the aisle is x39, straight from the arch down to the altar, with
         everything ranged in pairs either side of it.

         IT IS FIVE COLUMNS WIDE, NOT SEVEN, AND THAT IS THE WHOLE TRICK. Built across x36 to x42 it sealed
         eleven tiles and two moths into pockets against the east treeline: `wild` repairs a scene by clearing
         its OWN scattered trees, and it will not move a prop that was put here on purpose, so a court that
         reaches the edge of the map has nothing left to give. x36 and x42 are kept clear as the walking room
         either side, which is also what lets anyone get behind the pillars. */
      put("crypttorch", 37, 17, "Guttering torch");
      put("crypttorch", 41, 17, "Guttering torch");
      put("cryptgate", 38, 17, "The chapel arch");
      put("cryptgate", 40, 17, "The chapel arch");
      put("gargoyle", 37, 19, "Gargoyle");
      put("gargoyle", 41, 19, "Gargoyle");
      put("ghostbrazier", 38, 20, "Cold brazier");
      put("ghostbrazier", 40, 20, "Cold brazier");
      put("cryptpillar", 37, 21, "Chapel pillar");
      put("cryptpillar", 41, 21, "Chapel pillar");
      put("cryptcandles", 38, 22, "Candles, still lit");
      put("cryptcandles", 40, 22, "Candles, still lit");
      put("cryptaltar", 39, 22, "The altar");
      for (let y = 16; y <= 24; y++) for (let x = 36; x <= 42; x++) keep.push([x, y]);

      /* AND THE MIRE ITSELF: graves where the ground is dry enough, the dead standing and lying, the chapel's
         furniture dragged out and left, and the lamps the place is named after - every one of them out except
         the one by the road. Spread wide on purpose, so the walk between monsters is never empty. */
      put("lamp", 36, 13, "Lamp post, still burning", { art: "o_lamppost" });
      put("lamp", 28, 14, "Lamp post, long out", { art: "o_lamppost" });
      put("lamp", 21, 11, "Lamp post, long out", { art: "o_lamppost" });
      put("cryptpillar", 21, 7, "Broken pillar");
      put("cryptpillar", 23, 7, "Broken pillar");
      put("gravestone", 14, 5, "Gravestone");
      put("gravestone", 26, 11, "Gravestone");
      put("gravestone", 12, 21, "Gravestone");
      put("gravestone", 31, 6, "Gravestone");
      put("gravestone", 33, 3, "Gravestone");
      put("skeleton", 34, 6, "Somebody who stayed");
      put("skeleton", 13, 20, "Somebody who stayed");
      put("skeleton", 11, 22, "Somebody who stayed");
      put("snag", 16, 10, "Dead tree");
      put("snag", 19, 6, "Dead tree");
      put("snag", 35, 21, "Dead tree");
      put("snag", 9, 4, "Stump", { art: "o_deadtree_stump" });
      put("bonepile", 13, 9, "Bone pile");
      put("bonepile", 7, 3, "Bone pile");
      put("skullheap", 34, 11, "Skull heap");
      put("skullheap", 17, 3, "Skull heap");
      put("sarcophagus", 35, 19, "Sarcophagus");
      put("sarcophagus", 12, 6, "Sarcophagus");
      put("cryptcoffin", 30, 6, "Coffin, open");
      put("cryptrubble", 24, 11, "Rubble");
      put("ghostbrazier", 12, 14, "Cold brazier");
      put("cageV", 25, 5, "Empty cage");
      put("gargoyle", 18, 15, "Gargoyle, toppled");

      NORTH_ROAD(g, keep);
      put("sign", 20, 11, "North: the Boneyard. It opens at Combat 30, and Fishing 30 for the flooded crypt.");
      put("sign", 36, 14, "THE LANTERN MIRE: Combat 20 to 29. Almost everything out here waits to be hit first. ONE thing does not: the Loan Shark standing over the diamond in the far south-west comes at you on sight. Paper Twisters and moths to the east, Card Counters in the north-west, Tax Wraiths in the north-east clearing.");
      put("sign", 38, 16, "LANTERNWICK. The mire came up through the floor and everyone left. The candles did not go out.");
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 9);
      return { g, objs, blobs: [] };
    },
    /* ONE AGGRO MOB, as in the Gloam, and for the same reason: hostility rides the PLACEMENT, not the type, so
       the other Loan Sharks and every one in the Wilderness are untouched. The owner: "one of the loan sharks
       should be aggressive thats near the diamond ore veins" - so it stands at 7,20, between both veins and a
       step off the only track that reaches them. Reach 3: walking the track costs nothing, mining does not. */
    mobs: [["twister", 36, 5], ["twister", 39, 8], ["twister", 33, 9], ["twister", 38, 3], ["twister", 41, 6], ["twister", 35, 10],
      ["moth", 37, 16], ["moth", 40, 18], ["moth", 38, 21], ["moth", 41, 22], ["moth", 36, 19], ["moth", 39, 15],
      ["counter", 8, 5], ["counter", 11, 8], ["counter", 6, 9], ["counter", 13, 4], ["counter", 9, 10],
      ["taxwraith", 29, 2], ["taxwraith", 30, 3], ["taxwraith", 28, 3], ["taxwraith", 29, 4],
      ["shark", 7, 20, { aggro: 3 }], ["shark", 3, 21], ["shark", 4, 23]],
    npcs: [{ name: "Mudge the Lamplighter", art: "mudge", x: 38, y: 12, still: true, quests: ["lamps", "vials", "lanterns", "hw_lights"], hair: "#8a8a8a", shirt: "#c8a020", pants: "#3a3a3a", lines: ["Eleven lamps. I light them, the twisters knock them down, I light them. It's a living.", "The water's deeper than it looks and the fish are shallower than they look.", "Vance says he owes me. Vance owes everybody. That's how he keeps friends."] }], bots: []
  },
  /* THE GOLDEN SANDS, 40-49 (2026-09-24). West out of the Boneyard, and a SECOND ROUTE rather than a rung: at
     Combat 40 you may go north to Cloudreach or west to here, and each has its own ore, tree and fish.

     It is where ALCHEMY lives. The sand pits are the front of the whole chain - sand melts to glass at the
     cauldron under the temple colonnade, and glass plus what the world drops makes every potion in the game - so
     the pits, the cauldron and the crops-and-junk economy all meet on this one map. Sand is Mining 20, far below
     the band, because the barrier is meant to be GETTING here, not a second grind once you have.

     Ancient Egypt, from the owner's concept art: a sandstone temple precinct with a colonnade of obelisks, a
     walled oasis of date palms, dug pits, and the pyramid on the eastern skyline. */
  sands: {
    name: "The Golden Sands", ground: "desert", exits: { e: "boneyard" }, tint: "rgba(214,164,74,.10)",
    build() {
      const g = grid(), objs = [], keep = [];
      const put = (t, x, y, name, extra) => { objs.push({ t, x, y, name, ...(extra || {}) }); g[y][x] = "#"; keep.push([x, y]); };

      const path = [];
      const runX = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) path.push([x, y]); };
      const runY = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) path.push([x, y]); };
      /* in from the Boneyard at the east, along the processional way, and out to the quarters */
      runX(13, 33, COLS - 1); runY(33, 9, 13); runX(9, 22, 33); runY(22, 9, 16);
      runX(16, 12, 22); runY(12, 16, 20); runX(20, 6, 12);        // down to the pits in the south-west
      runY(22, 3, 9); runX(3, 14, 22);                            // and up to the oasis in the north-west
      runX(13, 26, 33); runY(26, 13, 18); runX(18, 26, 31);       // the pyramid approach, south-east
      /* "p", NOT "," (2026-09-24, the owner: "make the pathways some type of stone tiles too"). A comma is a
         DIRT track; "p" is the paving the Yard's courts and roads are drawn with, which the desert theme cuts
         from sandstone rather than grey brick (GROUNDS.desert.pave). So the processional way is flagstone the
         whole way in, and the court at the cauldron is that same stone opened out into a plaza. */
      for (const [x, y] of path) { g[y][x] = "p"; keep.push([x, y]); }

      /* THE OASIS, north-west, walled off the way the concept art has it. Ragged at its ends only, and it runs
         to the map edge, because a strip of floor between water and the rim is floor nobody can reach - see the
         Thunderhead for the three passes that lesson took. */
      for (let y = 4; y <= 8; y++) for (let x = 0; x <= 11; x++) {
        /* ragged at its EAST END ONLY. Ragging the south shore too left two tiles of floor inside the pool, and
           `wild` seals that sort of island after build() returns - markBanks makes it a bank tile and wild's
           repair only re-plants "." ones. Same lesson as the Thunderhead's tear: leave no floor inside water. */
        if (x >= 9 && hashRand(x, y, 91) < 0.4) continue;
        g[y][x] = "~";
      }
      /* A FLOOD FILL rather than the four-neighbour test, because a TWO-tile shelf holds itself up and the
         neighbour test only ever catches a lone tile (the Thunderhead found that out). This oasis is inland, so
         at build time the only thing that can disconnect the floor is the water just carved - walk the floor
         from a tile on the processional way and anything in the oasis box the walk misses is part of the pool.
         Blocked tiles count as floor: a prop standing on a tile does not stop it being connected. */
      {
        const seen = new Set([13 * COLS + 33]), q = [[33, 13]];
        while (q.length) {
          const [cx, cy] = q.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy, k = ny * COLS + nx;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || g[ny][nx] === "~") continue;
            seen.add(k); q.push([nx, ny]);
          }
        }
        for (let y = 3; y <= 9; y++) for (let x = 0; x <= 12; x++) if (g[y][x] !== "~" && !seen.has(y * COLS + x)) g[y][x] = "~";
      }
      scatterSpots(objs, 2, 8, 4, 4, [1, 2, 4], { name: "The oasis", req: { skill: "fishing", lvl: 40 }, fish: "oasisperch", fish2: "nilecarp", fish2lvl: 48, xp: 150, xp2: 180, glow: "#7fd8c8", tease: "Something fat turns over down there. Nothing has hunted this pool in a thousand years. Fishing 40." });
      for (let x = 0; x <= 12; x++) keep.push([x, 9], [x, 10]);

      /* THE COURT (2026-09-24, the owner: "give some spacing around the cauldron (no mobs can be in this
         area), and put it on the court tiles so it stands out"). Nine by five of paving, so the one cauldron in
         the game stands on a floor rather than in a field. Laid HERE, after the path and BEFORE any prop,
         because a prop writes "#" on its tile and paving over that would quietly make it walkable again. The
         mobs are kept out by where they are homed - see the list below. */
      for (let y = 10; y <= 14; y++) for (let x = 22; x <= 30; x++) { g[y][x] = "p"; keep.push([x, y]); }

      /* THE SAND PITS: five of them, spread across the south and west so digging is a walk rather than a corner.
         Mining 20 and 45 xp - poor xp for the level on purpose, because the value of sand is what it BECOMES. */
      /* FOUR PICTURES, CHOSEN BY POSITION (2026-09-24, the owner: "feels too monotamous right now"). Five
         identical pits in one corner read as wallpaper; hashRand fixes each one's look so it is the same for
         everybody who walks past it. */
      const PITS = ["o_sandpit", "o_sandpit2", "o_sandpit3", "o_sandpit4"];
      for (const [x, y] of [[8, 19], [5, 17], [11, 21], [16, 22], [7, 22]])
        put("sandpit", x, y, "Sand pit", { ore: "sand", req: { skill: "mining", lvl: 20 }, xp: 45, art: PITS[Math.floor(hashRand(x, y, 57) * PITS.length)] });

      /* the band's own ore and tree. Stardust at 50 is the 40-49 convention (a map's ore is band_top + 1) and it
         had exactly ONE rock in the whole game before this, in the Forum. Date palms are Woodcutting 45. */
      put("rock", 30, 4, "Stardust seam", { ore: "stardust", req: { skill: "mining", lvl: 50 }, xp: 150 });
      put("rock", 38, 20, "Stardust seam", { ore: "stardust", req: { skill: "mining", lvl: 50 }, xp: 150 });
      /* `datepalm`, NOT `palm`. The islands are planted with `t: "palm"` and theirs are DECORATIVE - no log,
         no requirement - so reusing the type would have made ten island trees choppable and swapped their
         picture for this one. A new resource wants a new type unless it really is the same tree. */
      put("datepalm", 13, 6, "Date palm", { log: "palmlogs", req: { skill: "woodcutting", lvl: 45 }, xp: 190 });
      put("datepalm", 4, 12, "Date palm", { log: "palmlogs", req: { skill: "woodcutting", lvl: 45 }, xp: 190 });

      /* THE TEMPLE PRECINCT, middle of the map: a colonnade of obelisks either side of the processional way,
         with the cauldron under it. The cauldron is the only one in the game, so this is where Alchemy is done. */
      for (const x of [24, 27, 30]) { put("obelisk", x, 8, "Obelisk"); put("obelisk", x, 10, "Obelisk"); }
      put("cauldron", 25, 12, "An alchemist's cauldron: melt sand into vials, and brew");
      put("sarcophagus", 23, 11, "Sarcophagus");
      put("sarcophagus", 29, 11, "Sarcophagus");
      put("crypttorch", 22, 12, "Guttering torch");
      put("crypttorch", 28, 12, "Guttering torch");

      /* THE PYRAMID, on the eastern skyline. Its door is SEALED for now - the party dungeon behind it is its own
         build, and a door that opens onto nothing is worse than one that says so. */
      put("pyramid", 40, 7, "The Great Pyramid: the tomb door is sealed", { w: 2, h: 1 });
      put("obelisk", 38, 10, "Obelisk");
      put("obelisk", 42, 10, "Obelisk");

      /* and the rest of the desert: fallen masonry, jars, bones in the sand */
      put("cryptpillar", 18, 9, "Fallen column");
      put("cryptpillar", 35, 15, "Fallen column");
      put("cryptpillar", 14, 19, "Fallen column");
      put("cryptrubble", 20, 6, "Rubble");
      put("cryptrubble", 33, 21, "Rubble");
      put("gargoyle", 36, 5, "Weathered sphinx", { art: "o_gargoyle" });
      put("gargoyle", 12, 15, "Weathered sphinx", { art: "o_gargoyle" });
      put("barrel", 26, 20, "Canopic jar", { art: "o_barrel" });
      put("barrel", 31, 6, "Canopic jar", { art: "o_barrel" });
      put("barrel", 9, 13, "Canopic jar", { art: "o_barrel" });
      put("skullheap", 19, 23, "Skull heap");
      put("bonepile", 34, 9, "Bone pile");
      put("skeleton", 6, 8, "Somebody who ran out of water");
      put("skeleton", 41, 17, "Somebody who ran out of water");
      put("boulder", 16, 12, "Sandstone block");
      put("boulder", 29, 17, "Sandstone block");
      put("boulder", 21, 20, "Sandstone block");

      put("sign", 34, 12, "THE GOLDEN SANDS: Combat 40 to 49, the same as Cloudreach \u2014 west out of the Boneyard instead of north. SAND comes out of the pits at Mining 20 and melts into vials at the cauldron under the colonnade: that is ALCHEMY, and every potion in the game starts here. Stardust at Mining 50, date palms at Woodcutting 45, the oasis at Fishing 40. ONE Tomb Jackal by the pyramid comes at you on sight.");
      put("sign", 24, 13, "THE CAULDRON. Sand melts to glass here, and glass plus what the world drops makes potions. Small vials hold ten minutes, medium fifteen, large twenty.");
      put("sign", 39, 12, "THE GREAT PYRAMID. The tomb door is sealed. Something is moving behind it.");
      for (let x = 12; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 12);
      return { g, objs, blobs: [] };
    },
    /* Cobras in the dunes, scarabs round the pits, mummies in the precinct, jackals at the pyramid. ONE aggro
       placement, at the pyramid, so the tomb feels guarded without making the map a chore. */
    mobs: [["cobra", 7, 15], ["cobra", 10, 17], ["cobra", 4, 20], ["cobra", 13, 22], ["cobra", 17, 19], ["cobra", 9, 11],
      ["scarab", 6, 21], ["scarab", 12, 18], ["scarab", 15, 21], ["scarab", 9, 19], ["scarab", 3, 16],
      /* NOT ONE HOME INSIDE THE COURT, nor within wandering distance of it: a mob turns back once it strays
         more than four tiles from home, so a spawn outside x18-34 / y6-18 can never reach the cauldron. Three
         Bandaged Debtors were standing on it. */
      ["mummy", 16, 3], ["mummy", 35, 3], ["mummy", 15, 13], ["mummy", 36, 13], ["mummy", 17, 22], ["mummy", 35, 23],
      ["jackal", 39, 15, { aggro: 3 }], ["jackal", 41, 5], ["jackal", 37, 18], ["jackal", 43, 8], ["jackal", 36, 22]],
    npcs: [{ name: "Rashid the Caravaneer", art: "rashid", x: 21, y: 14, still: true, quests: ["stardust", "caravan", "cobra", "perchdinner"], hair: "#1a1a1a", shirt: "#c8a870", pants: "#8a6a3a", lines: ["Twelve camels, eleven drivers, one road, and the road has cobras. Business is good.", "Stardust sells in the east for its weight in tickets. I've never been east. The camels have.", "Sit in the shade. No, that's a scarab. The other shade."] }], bots: []
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
    npcs: [{ name: "Zephyr", art: "zephyr", x: 24, y: 14, still: true, quests: ["skyeel", "frostink", "ramhorns", "homeward"], hair: "#e8e8f0", shirt: "#5aa0e0", pants: "#f0f0f8", lines: ["Wind's from the west. It's always from the west. I write it down anyway.", "Don't stand near the edge. Don't stand near the rams. Don't stand near me when I'm eating.", "The altar prints Frost. Nobody's used it. I check every morning."] }], bots: []
  },
  /* THE THUNDERHEAD, 50 and up (v68). The end of the road: Cloudreach's ground under a storm, and open SEA to the south-west. */
  /* (v121) THE VAULT. The last map, west out of the Thunderhead: the casino's own vault, or what is left of it. Combat 70
     and up, and everything in it hits hard enough that the Wilderness's rules would be unkind — so like the Thunderhead it
     is safe from other players and dangerous from everything else. Starfall ore is mineable here at 60, eclipse at 70. */
  vault: {
    /* (2026-09-25, the owner: "needs to be zero outside art. it needs to feel like we're inside, just like the
       casino, redo the carpet and make it a RED casino carpet. needs clearly designed walkways through slots,
       card tables. etc ... it needs to feel special because its a large game area")

       IT WAS AN OUTDOOR SCENE PRETENDING TO BE A ROOM, and the count is the proof: built on grid() and finished
       with wild(), the old Vault carried 121 trees, 59 bushes and 26 boulders. However dark the tint got, the
       House's own basement was dressed with hedgerow. It is a true INTERIOR now, the way the casino is: room()
       lays a walled box, there is no wild() call at all, and `floor: "casino"` puts it on the casino's painter.

       ITS CARPET IS READ AS A WANG SHEET, which is the thing to know before anybody replaces it. `carpet` is
       sampled in 32px patches by index (WANG, on the page), so it is NOT a picture of a rug - t_vault is a
       UNIFORM red tile precisely so every patch lands right. The old scene named rug_casino here and got away
       with it only because it was not an interior, so that code path never ran at all.

       THE AISLES ARE LAID FIRST AND THE FURNITURE GOES AROUND THEM, which is the opposite of how this was built
       before. Three run east-west and four north-south; every slot bank, table, column and ore seam goes through
       put(), which REFUSES a tile an aisle claimed. That is what makes the walkways real rather than hoped for:
       the room cannot grow a dead end because somebody added one more table. */
    name: "The Vault", interior: true, floor: "casino", carpet: "t_vault", wallH: 34, room: [1, 3, 42, 22],
    exits: { e: "thunderhead" }, entry: { x: 39, y: 13 }, tint: "rgba(10,6,2,.42)",   /* (2026-09-25) no `labels` - the owner did not want the arch lettered */
    wall: [{ t: "banner", x: 4 }, { t: "lamp", x: 9 }, { t: "lamp", x: 16 }, { t: "lamp", x: 24 }, { t: "lamp", x: 31 }, { t: "banner", x: 38 }],
    build() {
      const g = room(1, 3, 42, 22, 21), objs = [];
      for (let y = SPAN.e[0]; y <= SPAN.e[1]; y++) g[y][COLS - 1] = "e";   // the way back out to the Thunderhead
      const aisle = new Set();
      const lane = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] === "i") aisle.add(x + "," + y); };
      lane(2, 12, 41, 14);                                      // the long floor through the middle
      lane(2, 6, 41, 7); lane(2, 19, 41, 20);                   // north and south aisles
      for (const x of [6, 15, 27, 36]) lane(x, 4, x + 1, 21);   // four cross-aisles, so no bank is a dead end
      /* (2026-09-25, the owner: "there is no real walkways/carpets in the vault. think of it having roads, but
         they're purple carpets instead") THE AISLES ARE NOW VISIBLE. A rug with no `img` is painted as a colour
         block with a gold trim and a fringe, which is exactly a carpet runner and needs no art at all - so each
         aisle gets one laid over it. They are pushed straight to objs and never through put(): a rug is floor
         decoration, it must NOT mark its tiles solid, or the roads would be walls. */
      for (const r of [[2, 12, 40, 3], [2, 6, 40, 2], [2, 19, 40, 2],
                       [6, 4, 2, 18], [15, 4, 2, 18], [27, 4, 2, 18], [36, 4, 2, 18]])
        objs.push({ t: "rug", x: r[0], y: r[1], w: r[2], h: r[3], color: "#42207a", name: "A purple runner, worn down the middle" });
      const free = (x, y) => g[y] && g[y][x] === "i" && !aisle.has(x + "," + y);
      const put = (o) => { if (!free(o.x, o.y)) return false; objs.push(o); g[o.y][o.x] = "#"; return true; };
      /* the House's own room, and nothing in it grew outdoors */
      /* (2026-09-25, the owner: "THe Vault also needs to be bank vault themed, money bags everywhere, a giant
         bank vault") THE GIANT DOOR IS THE ROOM'S ONE BIG THING. o_bigvault is 112x128 on a ONE-TILE footprint,
         so it draws seven tiles wide and eight tall - the footprint is not the picture, which is the rule the
         Carnival's banners taught. It sits against the west wall with the aisles running past it, and nothing is
         placed beside it because put() has already claimed those tiles for the cross-aisle at x=6. */
      put({ t: "vaultdoor", art: "o_bigvault", x: 3, y: 9, name: "The door of the vault itself, standing open. Whatever was behind it is gone." });
      put({ t: "vaultdoor", art: "o_vaultdoor", x: 41, y: 9, name: "A smaller strongroom door, still shut." });
      objs.push({ t: "sign", x: 40, y: 11, name: "THE VAULT: Combat 70 and up. Mining 60 for starfall, 70 for eclipse, 80 for nova. Whatever the House was keeping, it is still down here." }); g[11][40] = "#";
      /* ---- THE SECTIONS, in the order a room is furnished: the fixed rooms first, the stock last. ORDER IS THE
         WHOLE DESIGN HERE. put() refuses a tile something already owns, so whatever runs first gets the good
         ground - and the money bags run LAST on purpose, filling what is left rather than eating a seam. */
      /* the slot hall, in banks of four along both long walls */
      for (const y of [4, 21]) for (const x of [8, 9, 10, 11, 17, 18, 19, 20, 29, 30, 31, 32]) put({ t: "slots", x, y, name: "A machine nobody emptied" });
      /* the card floor: two blocks of tables, each reachable from three sides */
      for (const c of [[9, 9], [12, 9], [9, 17], [12, 17]]) put({ t: "cointable", x: c[0], y: c[1], name: "A table still dealt out" });
      for (const c of [[30, 9], [33, 9], [30, 17], [33, 17]]) put({ t: "dicetable", x: c[0], y: c[1], name: "A dice table, the cup still on it" });
      for (const c of [[21, 9], [24, 9], [21, 17], [24, 17]]) put({ t: "bench", x: c[0], y: c[1], name: "A bench, pushed back" });
      /* (2026-09-25, the owner: "remove the Ruby so that users cant quickly cash out there") IT WAS A CASHIER.
         `coinstatue` maps to kind "cashier" in the page's click table, so the House's statue was a working
         cash-out standing in the middle of the endgame map - you could bank a run without leaving. It keeps
         its picture and becomes an ordinary `statue`, which is examinable and nothing else. */
      objs.push({ t: "statue", art: "o_coinstatue", x: 21, y: 4, name: "The House's own statue. It is not smiling." }); g[4][21] = "#";
      for (const x of [13, 22, 29]) { put({ t: "column", x, y: 10 }); put({ t: "column", x, y: 16 }); }
      for (const c of [[5, 11], [5, 15], [38, 11], [38, 15]]) put({ t: "ropepost", x: c[0], y: c[1], name: "Rope post" });
      for (const c of [[7, 17], [34, 5]]) put({ t: "chest", x: c[0], y: c[1], name: "An emptied deposit box" });
      /* ---- WHAT YOU CAME DOWN HERE FOR, and it is bank furniture rather than countryside: the ore is in burst
         SAFE-DEPOSIT BOXES (o_vein_<ore>, which is what objArt resolves a vein to - the Vault had none, which is
         why they drew as grey slabs), the tree came up through the cracked floor, and the water is a flood. */
      for (const c of [[4, 4], [4, 21], [8, 15], [12, 5], [13, 21]]) put({ t: "vein", x: c[0], y: c[1], ore: "starfall_ore", name: "A forced deposit box", req: { skill: "mining", lvl: 60 }, xp: 150 });
      for (const c of [[33, 4], [39, 4], [33, 21], [39, 21]]) put({ t: "vein", x: c[0], y: c[1], ore: "eclipse_ore", name: "A forced deposit box", req: { skill: "mining", lvl: 70 }, xp: 210 });
      for (const c of [[19, 5], [25, 5], [22, 21]]) put({ t: "vein", x: c[0], y: c[1], ore: "nova_ore", name: "A forced deposit box", req: { skill: "mining", lvl: 80 }, xp: 240 });
      for (const c of [[26, 4], [26, 21]]) put({ t: "rock", x: c[0], y: c[1], ore: "voidglass", name: "Shattered window", req: { skill: "mining", lvl: 70 }, xp: 190 });
      /* `art` spelled out: a yew draws as o_yew off its TYPE, so without it the Vaultwood was an ordinary tree in
         a room with no sun in it. Same rule the Yard's Old oak needed. */
      /* (2026-09-25, the owner: "what is the level of the fishing spot/logs/ore spots? is it the right level?")
         WOODCUTTING 60 WAS WRONG and had been since the Vault shipped. Vaultwood is the second-best log in the
         game (value 43) and asked the same level as Ludus Farm's yewlogs (35), while the Carnival's pinelogs
         (20) ask 65. On the ladder it belongs between pinelogs at 65 and the Trailer Park's bogwoodlogs (48) at
         80, so it is 75. The MINING levels were already right - starfall 60, eclipse 70, nova 80 are exactly
         their tier gates - and are untouched. */
      for (const c of [[14, 17], [26, 5]]) put({ t: "yew", art: "o_vaultwood", x: c[0], y: c[1], log: "voidlogs", name: "Vaultwood, up through the floor", req: { skill: "woodcutting", lvl: 75 }, xp: 240 });
      /* (2026-09-25, the owner: the hover "says 'Fish Fishing Spot'") A SPOT'S NAME IS OVERRIDDEN unless it is
         `special`: the page prints "Fishing spot" for any plain one, so "Flooded floor" was being thrown away and
         the verb put in front of it. `special` also skips the numbered o_spot<look> art, so the picture has to be
         named outright - which is why this carries BOTH special and art.
         AND fish2 WAS THE WORSE FISH. It read cloudray (24) with skyeel (20) as the level-70 bonus, so working
         harder caught something cheaper. Thundersquid (26) is fished nowhere else and sits correctly between
         cloudray and the Trailer Park's mudcat (29). */
      for (const c of [[10, 15], [11, 16]]) { if (!free(c[0], c[1])) continue; objs.push({ t: "spot", x: c[0], y: c[1], special: true, art: "o_spot6", fish: "cloudray", fish2: "thundersquid", fish2lvl: 70, name: "Flooded floor", req: { skill: "fishing", lvl: 60 }, xp: 200 }); g[c[1]][c[0]] = "~"; }
      /* the counting room: one tidy block of bullion in the north-east, not litter */
      for (const c of [[38, 5], [39, 5], [40, 5], [38, 6], [39, 6], [40, 6]]) put({ t: "bullion", art: "o_bullion", x: c[0], y: c[1], name: "Bullion nobody came back for" });
      /* (2026-09-25, the owner: "dont scatter ground items everywhere, it needs to be neat and organized in
         sections, just like the casino is") THE BAGS ARE STACKED IN RUNS, NOT SPRINKLED, and they run LAST so
         they fill the wall behind everything else rather than taking its ground. The first pass listed
         twenty-eight hand-picked tiles and let put() drop whatever collided, which is exactly how a room ends up
         looking strewn. A run of fewer than three is skipped, so a single bag never sits on its own in a gap. */
      for (const y of [5, 20]) {
        let run = [];
        const flush = () => { if (run.length >= 3) for (const x of run) put({ t: "moneybag", art: "o_moneybag", x, y, name: "A money bag, still tied" }); run = []; };
        for (let x = 8; x <= 35; x++) { if (free(x, y)) run.push(x); else flush(); }
        flush();
      }
      return { g, objs, blobs: [] };
    },
    /* (2026-09-25) EVERYONE STANDS ON AN AISLE, because the furniture pass owns every other tile - put() refuses
       an aisle, so an aisle is exactly where a monster is guaranteed room. The six with `aggro` are the node
       guards the owner asked for, each on the cross-aisle beside the seams it watches, with its own two-to-three
       minute respawn; the rest of the room is on the ordinary timer and waits to be hit first. */
    mobs: [["warden", 3, 13], ["warden", 8, 13], ["warden", 13, 13], ["warden", 18, 6], ["warden", 10, 20],
      ["pitboss", 22, 13], ["pitboss", 26, 13], ["pitboss", 19, 20], ["pitboss", 23, 6],
      ["hoard", 30, 13], ["hoard", 34, 13], ["hoard", 31, 20], ["hoard", 35, 6],
      ["dealer", 39, 13], ["dealer", 40, 20],
      ["warden", 6, 5, { aggro: 3, respawn: [120000, 180000] }],
      ["warden", 6, 20, { aggro: 3, respawn: [120000, 180000] }],
      ["hoard", 36, 5, { aggro: 3, respawn: [120000, 180000] }],
      ["hoard", 36, 20, { aggro: 3, respawn: [120000, 180000] }],
      ["pitboss", 27, 6, { aggro: 3, respawn: [120000, 180000] }],
      ["dealer", 15, 17, { aggro: 3, respawn: [120000, 180000] }]],
    npcs: [{ name: "The Auditor", art: "auditor", x: 6, y: 8, still: true, quests: ["audit", "voidwood", "hoard"], hair: "#6a6a6a", shirt: "#3a3a44", pants: "#2a2a34", lines: ["Every ticket that comes down here is written down. Every one that leaves is not. That's my job, in one sentence.", "There are trees growing through the floor. I have written that down too. Nobody has replied.", "The Dealer has never answered a letter. I have sent nine."] }], bots: []
  },
  /* ============================================================ THE CARNIVAL (2026-09-24)
     (the owner: "i want to build a map for level 60s since i realized theres a lull in going from thunderhead
     50s to 80s in the trailer park. the theme of this one is The Carnival ... the aeshetic i want is a creepy
     carnival like american horror story freak show ... i want some fat lady mobs, some triplee D inspired mobs,
     and pinheads and strongmans with huge weights. in the northwest area, i want a boss thats this mask guy.
     i also want to add a game area ... balloon pop, shooting targets, whack a mole", then: "mmake carnival
     62-72, and then ill make another after this for 73-80".)

     IT IS NOT OPEN. Deliberately, and by omission rather than by a flag: this scene is not in OPEN, the Yard has
     no west exit to it, and this has no exits of its own — so nobody can walk in from anywhere. `/tp carnival`
     still works, because the teleport only asks whether a key exists in SCENES. OPENING IT IS TWO LINES: add
     `w: "carnival"` to the Yard's exits and `e: "workyard"` to this scene's, and the two maps join up.

     THE GAME AREA IS A SAFE PLAZA. It is paved, it is east of the big top where you arrive, and NOTHING
     aggressive can see it: the only monster here that comes for you is the boss, and he is in the far north-west
     corner behind his own funhouse. A fairground where you get mauled queuing for the coconut shy is not a
     fairground. ============================================================ */
  carnival: {
    name: "The Carnival", ground: "carnival", tint: "rgba(48,22,40,.22)", exits: { e: "workyard" },
    build() {
      const g = grid(), objs = [], keep = [];
      const put = (t, x, y, name, w = 1, h = 1, extra = {}) => { objs.push({ t, x, y, w, h, name, ...extra }); block(g, x, y, w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) keep.push([x + i, y + j]); };

      /* ---------------------------------------------------------------- THE MIDWAY WINDS (2026-09-24)
         (the owner, testing it: "the circus is also very linear as far as walk ways, etc. can we randomize it
         so it feels like theres unique sections?")

         IT WAS A RULER BEFORE: one dirt road straight across y13 from edge to edge and one straight spur down
         x30, which is how every other map in the game is laid out and is exactly wrong for a fairground. A
         carnival is pitched, not planned — you come round a corner and there is another row of stalls.

         So the midway is WAYPOINTS. `lane()` draws two tiles wide between them, horizontal leg then vertical,
         and the list doglegs six times between the east gate and the far south-west. What that buys is not
         prettiness: it means you cannot see the whole map from the entrance, and each turn opens onto one
         section and hides the next. The branches hang off it — the plaza, the big top, the turnstile — so every
         section is somewhere you turn OFF the road to reach rather than something you pass. */
      const lane = (x0, y0, x1, y1) => {
        const step = (a, b) => (a < b ? 1 : -1);
        for (let x = x0; x !== x1 + step(x0, x1); x += step(x0, x1)) for (const y of [y0, y0 + 1]) if (g[y]?.[x] !== undefined) { g[y][x] = ","; keep.push([x, y]); }
        for (let y = y0; y !== y1 + step(y0, y1); y += step(y0, y1)) for (const x of [x1, x1 + 1]) if (g[y]?.[x] !== undefined) { g[y][x] = ","; keep.push([x, y]); }
      };
      const WAY = [[43, 12], [35, 12], [35, 5], [26, 5], [26, 14], [17, 14], [17, 20], [4, 20]];
      for (let i = 0; i + 1 < WAY.length; i++) lane(WAY[i][0], WAY[i][1], WAY[i + 1][0], WAY[i + 1][1]);
      lane(35, 13, 35, 17);       // down into the games plaza
      lane(24, 14, 21, 18);       // across to the big top's door
      lane(17, 13, 14, 8);        // up to the turnstile
      lane(30, 6, 30, 3);         // into the back lot

      /* THE GAME AREA (south-east, paved, and the first thing you reach coming in from the Yard) */
      for (let y = 16; y <= 23; y++) for (let x = 32; x <= 42; x++) { g[y][x] = "p"; keep.push([x, y]); }
      put("balloonpop", 33, 17, "Balloon Pop. A dart, a wall of balloons, and a man who has seen it all", 2, 2);
      put("shootgallery", 36, 17, "The Shooting Gallery. Cork rifles. The ducks have been shot at for years", 2, 2);
      put("whackamole", 39, 17, "Whack-a-Mole. The moles are not real. Probably", 2, 2);
      /* a row lower than it looks like it needs: the balloon stall is 100px on a two-tile footprint, so it
         draws six tiles tall and reached down over the booth at y21. */
      put("ticketbooth", 33, 22, "The ticket booth. Shuttered. Nobody has ever seen it open", 1, 2);
      objs.push({ t: "sign", x: 36, y: 21, name: "THE MIDWAY GAMES. Tickets in, tickets out, and no ZCoins anywhere near it. Play as often as you like." }); g[21][36] = "#"; keep.push([36, 21]);
      /* (2026-09-24, the owner: "add a few fences and things on the ground in the carnival games are to make it
         feel more lived in") A PLAZA WITH THREE STALLS AND NOTHING ELSE IS A SHOWROOM. Crowd barriers along the
         front where a queue would stand, crates and hay stacked where the stallholders keep their stock, and
         litter where people have been. The barrier is the market's plain fence rather than the graveyard's
         railings or the menagerie's bars: this is the one place on the map nobody is being kept in or out of. */
      for (const x of [33, 34, 36, 37, 39, 40]) { objs.push({ t: "fenceH", x, y: 20, name: "A crowd barrier" }); g[20][x] = "#"; keep.push([x, 20]); }
      for (const [x, y] of [[42, 17], [42, 20], [32, 19]]) { objs.push({ t: "crate", x, y, name: "Stock for the stalls" }); g[y][x] = "#"; keep.push([x, y]); }
      for (const [x, y] of [[41, 22], [35, 23]]) { objs.push({ t: "haybale", x, y, name: "A hay bale, sat on by somebody" }); g[y][x] = "#"; keep.push([x, y]); }
      for (const [x, y] of [[38, 23], [34, 16], [40, 16]]) { objs.push({ t: "carnlitter", x, y, name: "Popcorn tubs and torn tickets" }); g[y][x] = "#"; keep.push([x, y]); }

      /* THE BIG TOP, centre, and the thing you see from the entrance */
      put("bigtop", 18, 15, "The Big Top. Something is still going on in there", 3, 3);

      /* ---------------------------------------------------------------- THE MENAGERIE (2026-09-24)
         (the owner, testing it: "the grinning man needs to be in a horroresque locked in area, and the other
         mobs in the area need a chance too drop a carnival ticket")

         HE IS AN EXHIBIT, NOT A PRISONER, and the cage is what says so — menagerie bars rather than the
         Boneyard's graveyard railings, which exist and would have been free. A fence says keep out; a circus
         cage says the thing inside is billed.

         THE ONLY WAY IN IS THE TURNSTILE, and it eats a Carnival ticket. That closes the loop the owner asked
         for in one sentence: the four freaks outside drop tickets at 12%, so the boss is something you work up
         to rather than something you walk past on the way to the big top. The turnstile tile is left WALKABLE
         and wears only the picture — a blocked gate is a cage nobody can enter — and the worker refuses to step
         anybody through it without a ticket. */
      const CAGE = { x0: 1, y0: 2, x1: 12, y1: 11, gate: { x: 12, y: 7 } };
      for (let x = CAGE.x0; x <= CAGE.x1; x++) for (const y of [CAGE.y0, CAGE.y1]) { objs.push({ t: "cagebarH", x, y, name: "Menagerie bars" }); g[y][x] = "#"; keep.push([x, y]); }
      for (let y = CAGE.y0 + 1; y < CAGE.y1; y++) for (const x of [CAGE.x0, CAGE.x1]) {
        if (x === CAGE.gate.x && y === CAGE.gate.y) { objs.push({ t: "turnstile", x, y, cage: { x0: CAGE.x0, y0: CAGE.y0, x1: CAGE.x1, y1: CAGE.y1 }, name: "The turnstile. ADMIT ONE — a Carnival ticket turns it" }); keep.push([x, y]); continue; }
        objs.push({ t: "cagebarV", x, y, name: "Menagerie bars" }); g[y][x] = "#"; keep.push([x, y]);
      }
      objs.push({ t: "sign", x: 14, y: 7, name: "THE MAIN ATTRACTION. Admission by ticket only. The freaks on the midway carry them." }); g[7][14] = "#"; keep.push([14, 7]);

      /* THE FUNHOUSE is inside the cage with him, and its mouth is what he came out of */
      put("funhouse", 3, 3, "The Funhouse. The way in is the mouth", 3, 2);
      /* what is on the floor in there (the owner: "bloody things, knives on the ground") */
      for (const [x, y] of [[7, 4], [9, 9], [4, 10], [10, 5]]) { objs.push({ t: "bloodpool", x, y, name: "A stain. Old, and dragged" }); g[y][x] = "#"; keep.push([x, y]); }
      for (const [x, y] of [[8, 3], [3, 9], [11, 4]]) { objs.push({ t: "knives", x, y, name: "Throwing knives, left where they landed" }); g[y][x] = "#"; keep.push([x, y]); }
      for (const [x, y] of [[6, 3], [10, 8]]) { objs.push({ t: "meathook", x, y, name: "A hook on a chain. Empty" }); g[y][x] = "#"; keep.push([x, y]); }

      /* ---------------------------------------------------------------- SIX SECTIONS, EACH WITH ITS OWN LOOK
         (the owner: "can we randomize it so it feels like theres unique sections?")
         What makes a section a section is that it has a thing in it nowhere else has. BANNER ALLEY is the
         corridor of painted banners you come in through; the BACK LOT is where the carnival actually lives,
         wagons and crates and no attractions at all; SIDESHOW ROW is tents; the BIG TOP, the GAMES PLAZA and
         the MENAGERIE are one landmark each. Banners mark the mouth of each one, which is what tells you from
         the road that you have arrived somewhere. */
      /* BANNER ALLEY: the way in, flanked both sides, with the arch standing OVER the road.
         The arch is pushed WITHOUT block(), the way the turnstile and the Pyramid's gates are: it is a thing you
         walk under, and an arch that blocks is a wall with a face painted on it. Everything else here is laid
         either side of the two road rows (y12 and y13) so nothing stands in the way. */
      /* HOW FAR APART, AND WHY IT IS NOT THREE (2026-09-24, the owner: "the entrance area is a bit too busy,
         break it up and spread some stuff out"). A TILE IS 16 PIXELS AND THE ART IS NOT. o_banner is 53px wide
         on a footprint one tile across, so it draws three and a third tiles wide; the arch is 113px on a
         three-tile footprint and draws seven. Six banners at three-tile spacing therefore OVERLAPPED — the
         footprints never touched and the pictures never stopped touching, which is why the screenshot looks
         like a fence of banners rather than an avenue with banners along it.
         Four banners, six tiles apart, staggered above and below the road. Space the PICTURE, not the tile. */
      objs.push({ t: "archway", x: 40, y: 11, w: 3, h: 2, name: "A painted arch. Something with horns is grinning over the way in" });
      for (const x of [39, 40, 41, 42]) keep.push([x, 11], [x, 12]);
      /* TWO IN THE ALLEY, AND THE REST SPREAD DOWN THE MIDWAY. Four would not fit: the arch draws SEVEN tiles
         wide on a three-tile footprint, so anything inside x37..x44 is standing in its picture, and a banner at
         y15 has its lower half in the games plaza. So the corridor of banners the concept art shows is made by
         putting them along the WHOLE road — the back lot, the alley, the big top's forecourt, Sideshow Row —
         rather than six of them stacked at the gate. You pass one every so often, which is the effect. */
      put("banner", 33, 9, "A sideshow banner, faded through", 1, 2);
      put("banner2", 35, 14, "A sideshow banner, faded through", 1, 2);
      put("banner", 25, 3, "A sideshow banner, faded through", 1, 2);
      /* THE BACK LOT, north-east: where the carnival lives when nobody is looking */
      for (const [x, y] of [[27, 2], [33, 2], [38, 3]]) put("wagon", x, y, "A carnival wagon, shutters closed", 3, 2);
      for (const [x, y] of [[26, 8], [31, 7]]) put("crate", x, y, "A carnival crate");   /* two, not four: the other pair sat in the alley */
      /* SIDESHOW ROW, south-west */
      /* SEVEN APART, not four. A sidetent is 110px on a two-tile footprint, so four tiles between them left
         46 pixels of one tent drawn over the next — the same "space the picture, not the tile" the alley taught. */
      for (const [x, y] of [[4, 15], [11, 15], [4, 22], [11, 22]]) put("sidetent", x, y, "A sideshow tent, flaps down", 2, 2);
      /* six apart, not three: a banner draws five tiles TALL on a two-tile footprint, so the old pair stacked */
      for (const [x, y] of [[8, 16], [8, 22]]) put("banner2", x, y, "A sideshow banner, faded through", 1, 2);
      /* and the big top's own forecourt */
      for (const [x, y] of [[16, 17], [23, 17]]) put("banner", x, y, "A sideshow banner, faded through", 1, 2);
      for (const [x, y] of [[26, 17], [14, 22], [20, 3]]) put("haybale", x, y, "A hay bale");

      /* ---------------------------------------------------------------- SOMETHING TO GATHER (2026-09-24)
         (the owner: "is there fishing/woodcutting/mining spots here? needs to be for 60s") There was not, and
         it mattered more than it looked: catalytic converters (Mining 65) and rustpine (Woodcutting 65) both
         existed ONLY in the Trailer Park, which needs Combat 80 to fight in — two sixty-five tiers locked
         behind an eighty gate. They have a home at their own level now.

         THE DUCK POND IS ONE VEIN, as asked, and it is a TUB rather than a pond: a `spot` with its own art
         standing on the sawdust, which works because nothing in the fishing code cares whether there is water
         under it. Two rungs off the one spot — Prize goldfish at 62, Fairground koi at 68 — because Fishing
         went 58 and then straight to 80, and two rungs is what every other spot in the game gives. */
      objs.push({ t: "spot", art: "o_duckpond", x: 27, y: 20, w: 2, h: 1, name: "The duck pond", req: { skill: "fishing", lvl: 62 },
        fish: "goldfish", fish2: "koi", fish2lvl: 68, xp: 240, xp2: 265, glow: "#ffd23f",
        tease: "Yellow ducks going round and round, and something moving underneath them. Fishing 62." });
      block(g, 27, 20, 2, 1); keep.push([27, 20], [28, 20]);
      objs.push({ t: "wreck", x: 36, y: 6, ore: "catalytic", name: "A dead carnival truck, up on blocks", req: { skill: "mining", lvl: 65 }, xp: 175, special: true });
      g[6][36] = "#"; keep.push([36, 6]);
      objs.push({ t: "rustpine", x: 21, y: 22, log: "pinelogs", name: "A rustpine at the edge of the lot", req: { skill: "woodcutting", lvl: 65 }, xp: 190 });
      g[22][21] = "#"; keep.push([21, 22]);

      objs.push({ t: "sign", x: 28, y: 12, name: "THE CARNIVAL: Combat 62 to 72. The freaks keep to themselves. The thing in the north-west does not." }); g[12][28] = "#"; keep.push([28, 12]);

      /* THE FAIRGROUND IS OPEN GROUND, AND KEEPING IT THAT WAY IS DELIBERATE. wild() dresses a map by filling
         whatever is not in `keep` with treeline and scatter, which is right for a wood and quite wrong for a
         field somebody pitched a big top in: the first build kept only the midway and the plaza, and wild took
         the rest — 467 tiles walkable out of 1,144, with EIGHT monsters and the boss sealed in pockets nobody
         could reach. Keeping the whole interior and letting it dress only the outer ring is what makes this
         read as a fairground rather than a forest with stalls in it. The texture comes from the hay bales and
         litter the ground theme scatters instead. */
      for (let y = 3; y <= 23; y++) for (let x = 2; x <= 41; x++) keep.push([x, y]);

      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 62);

      /* AND THEN THE CLUTTER GOES BACK IN BY HAND. Keeping the whole field made it walkable and made it BARE —
         a fairground is trampled and strewn, not a lawn. These are laid after wild() so they are the only things
         standing in the open, and each is put down, the map re-walked from the midway, and taken up again if
         the reachable count fell by more than the tile it occupies. That check is the Boneyard's: three-deep
         yards taught it, and an open field can be sealed just as easily at a pinch point. */
      {
        const walk = () => {
          const seen = new Set(["30,13"]), q = [[30, 13]];
          while (q.length) { const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
              if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || !".,p".includes(g[ny][nx])) continue;
              seen.add(k); q.push([nx, ny]); } }
          return seen.size;
        };
        /* WHAT IS ALREADY THERE, and not just what is BLOCKED. The arch is pushed without block() because you
           walk under it, so its tiles stay "." and the scatter cheerfully dropped a heap of popcorn tubs inside
           the entrance arch. Every object footprint goes in here, blocking or not. */
        const taken = new Set(this.mobs.map(([, x, y]) => `${x},${y}`));
        for (const o of objs) for (let j = 0; j < (o.h || 1); j++) for (let i = 0; i < (o.w || 1); i++) taken.add(`${o.x + i},${o.y + j}`);
        for (let y = 3; y <= 23; y++) for (let x = 2; x <= 41; x++) {
          if (g[y][x] !== "." || taken.has(`${x},${y}`)) continue;
          if (y >= 12 && y <= 14) continue;                      // the midway stays clear
          if (x >= 29 && x <= 31) continue;                      // and so does the spur
          /* (2026-09-24, the owner: "the entrance area is a bit too busy, break it up and spread some stuff
             out") BANNER ALLEY IS LEFT EMPTY. It is the first thing anybody sees and it was carrying the
             banners, the arch, two of the back lot crates AND a tenth of the map's random litter on top of
             them. Somewhere has to be quiet or none of it reads. */
          if (x >= 32 && y >= 8 && y <= 16) continue;
          const h = hashRand(x, y, 62);
          if (h > 0.125) continue;
          const before = walk();
          g[y][x] = "#";
          if (walk() !== before - 1) { g[y][x] = "."; continue; }
          /* (2026-09-24, the owner: "the ashetic needs more horror esque elements, bloody things, knives on the
             ground") THE WHOLE MAP, not just the cage. A carnival that is only creepy where the boss stands is
             a carnival with a haunted-house attraction in it; the stains and the knives want to be under your
             feet on the way to the coconut shy as well. Held to about a third of the scatter, because the
             other two thirds being ordinary fairground litter is what makes them land. */
          const t = h < 0.030 ? "haybale" : h < 0.055 ? "carnlitter" : h < 0.070 ? "crate"
            : h < 0.088 ? "bloodpool" : h < 0.097 ? "knives" : "meathook";
          objs.push({ t, x, y, name: { haybale: "A hay bale", carnlitter: "Popcorn tubs and torn tickets", crate: "A carnival crate",
            bloodpool: "A stain. Old, and dragged", knives: "Throwing knives, left where they landed", meathook: "A hook on a chain. Empty" }[t] });
        }
      }
      return { g, objs, blobs: [] };
    },
    /* Pinheads and knife throwers along the midway, Fat Ladies in the south-west, Strongmen up the north side,
       and the boss alone in the north-west. Only he is on AGGRO_ON. */
    mobs: [["pinhead", 26, 9], ["pinhead", 22, 8], ["pinhead", 19, 10], ["pinhead", 24, 6], ["pinhead", 15, 8], ["pinhead", 28, 7],
      ["tripled", 17, 6], ["tripled", 21, 4], ["tripled", 14, 9], ["tripled", 26, 3],
      ["fatlady", 3, 16], ["fatlady", 9, 19], ["fatlady", 13, 18], ["fatlady", 3, 23], ["fatlady", 15, 21],
      ["strongman", 31, 3], ["strongman", 34, 7], ["strongman", 38, 5], ["strongman", 40, 9], ["strongman", 20, 20]]
      /* ---------------------------------------------------------------- HALF OF THEM COME FOR YOU (2026-09-24)
         (the owner: "randomly in the carnival about 50% of the mobs need to be agressive")

         PER PLACEMENT, NOT PER TYPE, which is the only way to do this: AGGRO_ON works on a monster's TYPE and
         would make every Pinhead on the map aggressive. The spawn reads `over?.aggro` off the placement and the
         tick prefers it to the type's (`m.aggro ?? def.aggro`), so a marked Pinhead charges and the one twenty
         tiles away does not — which is what makes it feel random rather than rule-based when you walk in.

         SEED 19 IS CHOSEN, NOT ARBITRARY. It is the first that lands EXACTLY ten of twenty with every kind
         between 40 and 60 per cent — seed 62 gave 60% overall and not a single aggressive Triple, which reads
         as a bug rather than a coin toss. And with this one the games plaza, The Barker, the duck pond and the
         rustpine are all out of reach, so the only thing anybody has to fight for is the mining truck in the
         back lot, where three Strongmen stand. That last one is deliberate and easy to undo.

         THE 3 IS AGGRO_REACH AND CANNOT SAY SO. This array is evaluated when the module loads and AGGRO_REACH is
         declared hundreds of lines further down, so naming it here throws "cannot access before
         initialization" — which it did. The cap the AGGRO_ON loop applies to TYPES never touches a placement
         override either, so the number has to be right here rather than clamped later:
         tools/eastscape-carnival-test.mjs asserts the two still match. */
      .map((m) => (hashRand(m[1], m[2], 19) < 0.5 ? [m[0], m[1], m[2], { aggro: 3 }] : m))
      .concat([["grinner", 5, 7]]),   // the boss is on AGGRO_ON already and keeps his own reach
    /* (2026-09-24, the owner: "also add an NPC too the carnival area, same american horror story freak show
       theme") THE BARKER, stood at the mouth of the games plaza where the spur meets the midway — the one spot
       everybody walks past twice. He gives no quest, which is deliberate: an NPC must LIST what it gives and a
       quest nobody offers is an error the content check catches, so an NPC with nothing to give is the honest
       way to put a voice on a map. He is what tells you the rules of the place out loud. */
    npcs: [{ name: "The Barker", art: "barker", x: 31, y: 15, still: true, quests: ["kingslayer"],
      hair: "#1a1420", shirt: "#8a2426", pants: "#2a2230",
      lines: ["Step up. Tickets in, tickets out, and nothing on this side of the rope takes a ZCoin.",
        "Everything on the midway is honest. That is the only thing on the midway that is.",
        "Three stalls. They get faster the longer you stand there, and so does everything else here.",
        "There is one act you cannot see without a ticket. The freaks carry them. Ask nicely, or don't.",
        "Do not feed the thing in the north-west. It has been fed.",
        "We were here before the town. We will be here after. We just move the tents about."] }],
    bots: []
  },
  thunderhead: {
    /* (2026-09-24) REBUILT, AND IT IS NOT CLOUDREACH ANY MORE. It wore Cloudreach's ground with a darker tint
       over it, a road straight across y13, a rectangular hole in the floor and THREE objects on the whole map -
       two trees and a sign. The owner: "lets make it less like the clouds, and more fantasy based but slightly
       cloudish ... make this one feel different from all the other maps."

       What makes it different is a RUIN. This is the shattered precinct of something that stood above the storm:
       a processional way in from Cloudreach, through a ring of rune stones the road runs straight down the middle
       of, and out west to the Vault. Broken sky-arches line the way, storm crystals grow out of the floor, and
       the sea shows through a tear in it to the south-west. It keeps the cloud floor - "slightly cloudish" - and
       everything standing on it is masonry and crystal.

       AND IT HAS ITS ROCK AT LAST. The Thunderhead was the ONE banded map in the game with no ore: every other
       one has an ore, a tree and a fish, and mining on the walked chain stopped dead at onyx 50 in Cloudreach
       because everything above it lives in the Vault (no band) or the Trailer Park (Combat 80). Starfall at 60
       and voidglass at 70 fill the hole, in OPPOSITE CORNERS as the owner asked, each with an aggressive guard. */
    name: "The Thunderhead", ground: "storm", exits: { e: "cloud", w: "vault", n: "trailer" },   /* (2026-09-27) north becomes the Depths of the Mountain when HOLD.depths is lifted (the Depths block) */ tint: "rgba(26,14,62,.44)",
    build() {
      const g = grid(), objs = [], keep = [];
      const put = (t, x, y, name, extra) => { objs.push({ t, x, y, name, ...(extra || {}) }); g[y][x] = "#"; keep.push([x, y]); };

      const path = [];
      const runX = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) path.push([x, y]); };
      const runY = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) path.push([x, y]); };
      /* the processional way: in from Cloudreach at the east, north, west through the rune ring at x28 */
      runX(13, 34, COLS - 1); runY(34, 8, 13); runX(8, 28, 34); runY(28, 8, 16);
      runX(16, 22, 28); runY(22, 0, 16);            // and the north spur, out to the Trailer Park
      runX(12, 8, 22); runY(8, 12, 13); runX(13, 0, 8);   // west, out to the Vault
      runY(9, 4, 12); runX(8, 6, 9);                // the north-west quarter, where the starfall is
      runY(38, 13, 22); runX(20, 38, 41); runX(22, 35, 38);   // and the south-east, where the voidglass is
      for (const [x, y] of path) { g[y][x] = ","; keep.push([x, y]); }

      /* THE TEAR IN THE FLOOR, and the sea a long way under it. Ragged, and anything left with water on all four
         sides is flooded - see the Lantern Mire for why a one-tile island can never be walked to. */
      /* THE TEAR RUNS OFF THE BOTTOM OF THE MAP, and it is ragged only at its two ENDS. Ragging the south edge
         as well is what left a shelf of floor between the water and the map's rim: six tiles a player could see
         and never stand on, because `wild` paints this map's border as water AFTER build() returns and cuts them
         off. Anything clever here has to happen after wild, and by then a tree may already be standing on the
         tile - so the honest fix is to leave no strip in the first place. The north shore is the one that reads,
         and the ends are where raggedness shows against the floor. */
      for (let y = 18; y < ROWS; y++) for (let x = 4; x <= 20; x++) {
        if ((x <= 5 || x >= 19) && hashRand(x, y, 63) < 0.45) continue;
        g[y][x] = "~";
      }
      /* and a tile the ragged ends left with water on all four sides is sea too, for the reason the Lantern
         Mire's is: markBanks turns it into a bank tile and wild's repair only ever re-plants "." ones, so it
         would sit there for good as somewhere visible that cannot be walked to. */
      for (let y = 18; y < ROWS; y++) for (let x = 3; x <= 21; x++)
        if (g[y][x] !== "~" && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => g[y + dy]?.[x + dx] === "~")) g[y][x] = "~";
      scatterSpots(objs, 7, 17, 18, 5, [1, 2, 4], { name: "The sea below", req: { skill: "fishing", lvl: 50 }, fish: "stormmarlin", fish2: "thundersquid", fish2lvl: 58, xp: 190, xp2: 230, glow: "#ffe27a", tease: "Far below, something with a sword for a nose cuts the water. Fishing 50." });
      for (let x = 3; x <= 21; x++) keep.push([x, 17], [x, 16]);

      /* THE ORE, in opposite corners and thirty tiles apart (2026-09-24, the owner: "they need to be spaced far
         apart, near at least 1 aggressive enemy"). Starfall in the north-west under the House's nose, voidglass
         in the far south-east among the drakes. The guards are per-PLACEMENT aggro, so the wolf and drake TYPES
         are untouched and every other one of them on this map still waits to be hit first. */
      put("rock", 9, 4, "Starfall rock", { ore: "starfall_ore", req: { skill: "mining", lvl: 60 }, xp: 150 });
      put("rock", 7, 8, "Starfall rock", { ore: "starfall_ore", req: { skill: "mining", lvl: 60 }, xp: 150 });
      put("rock", 40, 20, "Voidglass shards", { ore: "voidglass", req: { skill: "mining", lvl: 70 }, xp: 190 });
      put("rock", 36, 22, "Voidglass shards", { ore: "voidglass", req: { skill: "mining", lvl: 70 }, xp: 190 });
      put("skyash", 30, 6, "Storm-struck skyash", { log: "skyashlogs", req: { skill: "woodcutting", lvl: 50 }, xp: 200 });
      put("skyash", 24, 19, "Storm-struck skyash", { log: "skyashlogs", req: { skill: "woodcutting", lvl: 50 }, xp: 200 });

      /* THE RUNE RING. The road runs straight through the middle of it at x28, which is the whole idea: you do
         not find this place, you walk down it. Six stones and a pair of broken arches for a gate. */
      for (const [x, y] of [[26, 10], [30, 10], [25, 12], [31, 12], [26, 14], [30, 14]]) put("runestone", x, y, "Rune stone");
      put("skyarch", 27, 9, "Broken arch");
      put("skyarch", 29, 9, "Broken arch");

      /* the rest of the precinct: arches along the way, crystals out of the floor, stones to steer by */
      put("skyarch", 32, 11, "Broken arch");
      put("skyarch", 36, 15, "Broken arch");
      put("skyarch", 12, 11, "Broken arch");
      put("skyarch", 23, 20, "Broken arch");
      put("skyarch", 36, 18, "Broken arch");
      put("runestone", 35, 10, "Rune stone");
      put("runestone", 39, 6, "Rune stone");
      put("runestone", 16, 6, "Rune stone");
      put("runestone", 4, 6, "Rune stone");
      put("runestone", 14, 16, "Rune stone");
      put("runestone", 40, 17, "Rune stone");
      put("runestone", 25, 22, "Rune stone");
      put("stormcrystal", 7, 5, "Storm crystal");
      put("stormcrystal", 11, 9, "Storm crystal");
      put("stormcrystal", 20, 4, "Storm crystal");
      put("stormcrystal", 33, 4, "Storm crystal");
      put("stormcrystal", 41, 22, "Storm crystal");
      put("stormcrystal", 34, 20, "Storm crystal");
      put("stormcrystal", 18, 15, "Storm crystal");
      put("stormcrystal", 30, 23, "Storm crystal");
      put("stormcrystal", 2, 10, "Storm crystal");
      put("stormcrystal", 21, 8, "Storm crystal");

      put("sign", 40, 11, "THE THUNDERHEAD: Combat 50 and up. The end of the road. Starfall rock in the north-west at Mining 60, voidglass in the far south-east at 70 \u2014 and ONE thing in each of those corners comes at you on sight. Everything else here waits, not even THE HOUSE, in the north-west. The House always wins. Usually.");
      put("sign", 26, 16, "THE RUNE RING. Nobody built the road to go around it.");
      for (let x = 12; x < COLS; x++) keep.push([x, 12], [x, 14]);
      wild(g, objs, this.exits, { n: "water", s: "water", w: "water", e: "water" }, [...keepOf(this), ...keep], 10);
      return { g, objs, blobs: [] };
    },
    /* TWO AGGRO PLACEMENTS, one standing over each ore, as the owner asked. Reach 3: walking the way in costs
       nothing, swinging a pickaxe in the wrong corner does. */
    mobs: [["goose", 12, 20, { perch: true }], ["goose", 16, 21, { perch: true }], ["goose", 8, 22, { perch: true }],   /* (2026-09-25) OVER THE TEAR. `perch`: it never wanders, it sits on water nobody can walk to, and so ONLY AN ARROW REACHES IT. The first of the "some things only a bow can fight" spots; more once archery has been played. */
      ["goose", 38, 5], ["goose", 40, 8], ["goose", 36, 9], ["goose", 39, 17], ["goose", 41, 19], ["goose", 35, 17],
      ["golem", 30, 5], ["golem", 33, 8], ["golem", 28, 3], ["golem", 31, 17], ["golem", 27, 18], ["golem", 30, 19],
      ["wolf", 18, 2], ["wolf", 21, 3], ["wolf", 24, 2], ["wolf", 26, 4], ["wolf", 9, 6, { aggro: 3 }],
      ["drake", 33, 22], ["drake", 38, 21, { aggro: 3 }], ["drake", 41, 23], ["drake", 35, 19],
      ["house", 5, 4]],
    npcs: [{ name: "Volta", art: "volta", x: 25, y: 9, still: true, quests: ["stormrod", "goosechase", "stormink", "drakehunt"], hair: "#3a3a3a", shirt: "#6a6a72", pants: "#4a4a52", lines: ["Struck four times. The first three were accidents.", "The geese sit on the rod. THE ROD. I built it for lightning and it gets geese.", "If your hair stands up, walk away from me. Slowly."] }], bots: []
  },
  /* THE THIRD FIGHT MAP, past the Rough. It wears the Wilderness's clothes (dark: true) but nobody can attack you here
     but the residents. Gnashers and moths by the gate, ghouls and Tax Wraiths in the middle, a Chandelier Spider and
     the Understudy at the far end. Several of them come for you on sight. */
  boneyard: {
    name: "The Boneyard", dark: true, exits: { e: "mire", n: "cloud", w: "sands" }, tint: "rgba(60,20,70,.2)", arrive: { s: { x: 14, y: 24 } },   /* (2026-09-27) from the Orchard Wall you come up the corridor between the yards, not into the Critic's pen */
    build() {
      const g = grid(), objs = [], keep = [];

      /* ---------------------------------------------------------------- SIX RAILED GRAVEYARDS
         (2026-09-24, the owner: "i want there to be graveyards that are bllocked off by fences, that run long
         along the pathways and have a small entrance into them, then the mobs are in there. add art as needed,
         add a mini ghost boss as well with custom art")

         THE ROADS ARE SAFE AND THE YARDS ARE NOT, and that is the whole shape of the map now. It used to be one
         field with monsters sprinkled over it, so a skiller walking to the dragonstone picked up whatever was
         nearest whether they wanted a fight or not. Now the paths are clear, every monster is behind iron
         railings, and each yard has ONE gap in its fence — so a fight is something you step into on purpose.

         `yard()` draws the perimeter and returns the interior. Three rules it keeps, each of which was a bug the
         first time the map was walked: the gate tile is left OPEN and only wears the gate PICTURE (an object
         does not block unless the grid says so, and a blocked gate is a yard nobody can enter); every fence tile
         and every gate goes in `keep`, because wild() paints the edges AFTER build returns and would otherwise
         rub a railing out; and the fence runs a whole tile outside the interior, so a monster homed against the
         inside of the wall can still be reached from within rather than only through the bars. */
      const RAIL = { n: "railH", s: "railH", w: "railV", e: "railV" };
      const yard = (x0, y0, x1, y1, side, at, name) => {
        const put = (x, y, t) => {
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
          keep.push([x, y]);
          if ((side === "n" && y === y0 && x === at) || (side === "s" && y === y1 && x === at)
            || (side === "w" && x === x0 && y === at) || (side === "e" && x === x1 && y === at)) {
            objs.push({ t: "railgate", x, y, name: `${name}: the way in` });   // NOT blocked: this is the gap
            return;
          }
          objs.push({ t, x, y, name: `${name}: iron railings` }); g[y][x] = "#";
        };
        for (let x = x0; x <= x1; x++) { put(x, y0, RAIL.n); put(x, y1, RAIL.s); }
        for (let y = y0 + 1; y < y1; y++) { put(x0, y, RAIL.w); put(x1, y, RAIL.e); }
        for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) keep.push([x, y]);
        return { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };
      };

      /* the four northern yards sit either side of the road to Cloudreach, with a lane at y6 between the pairs;
         the two southern ones open onto the shoulder under the main road. Every gate faces a path. */
      const A = yard(2, 1, 19, 5, "s", 10, "The Flyloft");        // Stagehands
      const B = yard(25, 1, 42, 5, "s", 33, "The Gods");          // Chandelier Spiders
      const C = yard(2, 7, 19, 11, "n", 10, "The Green Room");    // Understudies
      const D = yard(25, 7, 42, 11, "n", 33, "The Pit");          // Ghouls
      const E = yard(1, 17, 12, 24, "n", 6, "The Cheap Seats");   // One-Eyed Ushers
      const F = yard(16, 17, 29, 24, "n", 22, "The Royal Box");   // the Critic

      /* ---------------------------------------------------------------- the paths
         Drawn AFTER the yards so a road always wins a tile: the main east-west road, the north road to
         Cloudreach, the lane between the northern pairs, and the shoulder the two southern gates open onto. */
      for (let x = 0; x < COLS; x++) { g[13][x] = ","; keep.push([x, 12], [x, 13], [x, 14], [x, 6], [x, 15], [x, 16]); }
      for (let x = 0; x < COLS; x++) if (g[6][x] !== "#") g[6][x] = ",";
      for (let y = 15; y <= 16; y++) for (let x = 0; x < COLS; x++) if (g[y][x] !== "#") g[y][x] = ".";
      for (let y = 17; y <= 24; y++) for (const x of [13, 14, 15, 30, 31, 32]) { if (g[y][x] !== "#") g[y][x] = "."; keep.push([x, y]); }
      /* (2026-09-27) THE SOUTH DOOR, to the Orchard Wall: the door is where every door is (SPAN, under the Royal Box), so the bottom row is
         opened from the corridor across to it, and `arrive` above brings anyone coming up from the Orchard out in the corridor */
      if (this.exits.s) for (let x = 13; x <= 23; x++) { if (g[25][x] === "#") g[25][x] = "."; keep.push([x, 25]); }
      NORTH_ROAD(g, keep);

      /* ---------------------------------------------------------------- what you came here to gather, OUTSIDE the railings
         (v122 trees, 2026-09-22 ore: one rung per map.) They are all on open ground on purpose — the point of
         fencing the monsters in is that a skiller can work this map without taking a swing. */
      /* (2026-09-24) x15 AND NOT x13: tools/eastscape-aggro-check.mjs measures a monster’s reach as DISTANCE,
         not as somewhere it can walk to, and three One-Eyed Ushers inside the Cheap Seats were within three tiles
         of the dragonstone. The railings mean they could never actually get there — but they would lock onto a
         miner and mill at the fence, which is a monster doing something pointless in full view. Two tiles further
         into the lane and the yard cannot see the rocks at all. */
      /* THE WORKING CORNER (2026-09-24). All four of these started spread across the map and every place they
         went was inside an aggressive monster’s reach, which tools/eastscape-aggro-check.mjs measures as where
         it can STAND (home, wandered) plus its aggro. The southern shoulder is the whole width of two yards, so
         a rock anywhere along it is three tiles from an Usher or the Critic at the railings: they could never
         get out, but they would lock onto a miner and mill at the fence. East of x32 nothing can see them, so
         the ore, the yews and the flooded crypt are one corner you work in peace. */
      for (const [x, y] of [[33, 15], [36, 16]]) { objs.push({ t: "rock", x, y, ore: "dragonstone_ore", name: "Dragonstone rock", req: { skill: "mining", lvl: 40 }, xp: 86 }); g[y][x] = "#"; }
      for (const [tx, ty] of [[39, 15], [42, 17]]) { objs.push({ t: "yew", x: tx, y: ty, log: "yewlogs", name: "Ancient yew", req: { skill: "woodcutting", lvl: 35 }, xp: 170 }); g[ty][tx] = "#"; }
      // the flooded crypt, fished from its north bank: bonefish from Fishing 30, ghost carp from 35
      for (let y = 19; y <= 24; y++) for (let x = 33; x <= 42; x++) g[y][x] = "~";
      scatterSpots(objs, 33, 42, 19, 5, [1, 2, 4], { name: "Flooded crypt", req: { skill: "fishing", lvl: 30 }, fish: "bonefish", fish2: "ghostcarp", fish2lvl: 35, xp: 110, xp2: 130, glow: "#d8c8ff", tease: "Pale shapes slide between the sunken headstones. Fishing 30." });
      for (let x = 32; x <= 43; x++) keep.push([x, 17], [x, 18]);

      /* ---------------------------------------------------------------- the graves, which is what makes them graveyards
         Scattered by hashRand rather than listed, so every yard is full without six hand-written tables. The
         lane in front of a gate is left clear (nothing within two tiles of it), and so is every monster's spot —
         a headstone under a Stagehand is a monster you cannot walk up to. */
      const mobAt = new Set();
      const graves = (r, gateX, gateY) => {
        /* how much of this yard you can walk, coming in through its gate */
        const walk = () => {
          const seen = new Set(), q = [[gateX, gateY]];
          seen.add(`${gateX},${gateY}`);
          while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
              if (nx < r.x0 || nx > r.x1 || ny < r.y0 || ny > r.y1 || seen.has(k) || g[ny][nx] !== ".") continue;
              seen.add(k); q.push([nx, ny]);
            }
          }
          return seen.size;
        };
        /* A GRAVE THAT WOULD WALL SOMETHING OFF IS NOT PLACED. These yards are three tiles deep in places, so a
           headstone in the wrong square seals a corner - and the first run of this map left two Chandelier
           Spiders and an Understudy standing in pockets nobody could reach. Each stone is laid down, the yard is
           re-walked, and it is taken up again if the reachable count fell by more than the one tile it occupies.
           Forty-odd tiles a yard and a dozen stones, so the cost is nothing and the result cannot be wrong. */
        for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
          if (Math.abs(x - gateX) <= 1 && Math.abs(y - gateY) <= 2) continue;   // leave the way in clear
          if (mobAt.has(`${x},${y}`) || g[y][x] !== ".") continue;
          const h = hashRand(x, y, 33);
          if (h > 0.30) continue;
          const before = walk();
          g[y][x] = "#";
          if (walk() !== before - 1) { g[y][x] = "."; continue; }   // it cut something off: put it back
          const t = h < 0.21 ? "gravestone" : h < 0.27 ? "bonepile" : "skeleton";
          objs.push({ t, x, y, name: t === "gravestone" ? "Gravestone" : t === "bonepile" ? "Bones, stacked" : "Somebody who stayed" });
        }
      };

      /* ---------------------------------------------------------------- THE ROYAL BOX
         The mini boss's yard, and the only one with a building in it. The mausoleum is two tiles so it reads as
         a place rather than a prop, and it sits off the gate's line so the Critic is what you meet first. */
      objs.push({ t: "mausoleum", x: 25, y: 18, w: 2, h: 2, name: "A mausoleum. The name has worn off the lintel" });
      block(g, 25, 18, 2, 2); keep.push([25, 18], [26, 18], [25, 19], [26, 19]);

      for (const [x, y] of [[4, 4], [40, 4], [21, 25], [0, 20]]) { if (g[y]?.[x] === ".") { objs.push({ t: "deadtree", x, y, name: "Dead tree" }); g[y][x] = "#"; } }
      objs.push({ t: "sign", x: 20, y: 12, name: "North, and up: Cloudreach. It opens at Combat 40, and Fishing 40. Bring a head for heights." }); g[12][20] = "#";
      objs.push({ t: "sign", x: 24, y: 14, name: "THE BONEYARD: Combat 30 to 39. Nothing here comes through a fence. The Flyloft and the Green Room are west of the road, the Gods and the Pit east of it; the Cheap Seats and the Royal Box are south. Each yard has one gate. Something in the Royal Box does not wait to be asked." }); g[14][24] = "#";

      // keep every mob's own square clear before the graves go in
      for (const [, mx, my] of this.mobs) mobAt.add(`${mx},${my}`);
      graves(A, 10, 5); graves(B, 33, 5); graves(C, 10, 7); graves(D, 33, 7); graves(E, 6, 17); graves(F, 22, 17);

      wild(g, objs, this.exits, { n: "scrub", s: "scrub", w: "scrub", e: "scrub" }, [...keepOf(this), ...keep], 33);
      return { g, objs, blobs: [] };
    },
    /* every monster is inside a yard, which is the point. The Critic is alone in his. */
    mobs: [["stagehand", 5, 3], ["stagehand", 9, 2], ["stagehand", 14, 4], ["stagehand", 17, 3], ["stagehand", 12, 2],
      ["chandelier", 28, 3], ["chandelier", 33, 2], ["chandelier", 38, 4], ["chandelier", 40, 2],
      ["understudy", 6, 9], ["understudy", 11, 10], ["understudy", 16, 8], ["understudy", 13, 9],
      ["ghoul", 28, 9], ["ghoul", 32, 8], ["ghoul", 36, 10], ["ghoul", 40, 9], ["ghoul", 30, 10], ["ghoul", 38, 8],
      ["usher", 4, 19], ["usher", 8, 21], ["usher", 5, 22], ["usher", 9, 19], ["usher", 3, 23], ["usher", 10, 23],
      ["critic", 22, 21]],
    npcs: [{ name: "Sister Morrow", art: "morrow", x: 25, y: 15, still: true, quests: ["morrowbones", "yewbow", "spidersilk", "dragonstone", "hw_vigil"], hair: "#1a1a1a", shirt: "#1a1a1a", pants: "#1a1a1a", lines: ["They get up. I put them down. Most days that's the whole sermon.", "The Critic in the Royal Box has never once been dead. I've checked.", "Mind the rails. They're not to keep you out."] }], bots: []
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
    name: "The Yard", exits: { e: "casino", n: "gloam", w: "carnival" },   /* (2026-09-24) the Carnival opened. It went west because that was the one side of the Yard with no door on it. */
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
      /* (2026-09-25) THE FLETCHING TABLE, beside the furnace and the anvil so the three crafts share a court:
         a bar hammered into heads at the anvil is fletched onto shafts two tiles away. */
      /* (2026-09-25, later) MOVED to where the Tower's door was, 40,9, when the Tower went up behind the railing (below). */
      objs.push({ t: "fletcher", x: 40, y: 9, name: "Fletching table: shafts, bows, quivers and arrows" });
      block(g, 40, 9, 1, 1); keep.push([40, 9]);
      objs.push({ t: "furnace", x: 35, y: 6, name: "Furnace: smelt ore into bars, and burn logs to charcoal" });
      block(g, 35, 6, 1, 1); keep.push([35, 6]);
      objs.push({ t: "anvil", x: 37, y: 6, name: "Anvil: hammer bars into gear, and reforge what you have" });
      block(g, 37, 6, 1, 1); keep.push([37, 6]);
      /* (2026-09-25, the owner: "lets move the tower up behind the fences in the court, as if its nestled in the woods. that
         will give us more space in the court"). Its door sits on row 4, just north of the court's top railing, and the
         sprite rises into the treeline behind it; the railing crosses in FRONT of its foot, which is what puts it
         behind the fence. The two rail tiles in front of the door are left out (see railing below) so you still walk
         in from the court. The trees behind are left where wild() puts them: anything north of row 4 is drawn behind
         the building, so they frame it rather than poke through it. Only the door row and the gap are kept clear. */
      objs.push({ t: "towerdoor", art: "o_tower", x: 40, y: 4, w: 2, h: 1, name: "The Tower: thirty floors, one room at a time" });   /* `art` because the picture is o_tower and the type is towerdoor: without it the page looks for "o_towerdoor", finds nothing and draws NO TOWER */
      block(g, 40, 4, 2, 1);
      for (let y = 4; y <= 5; y++) for (let x = 39; x <= 42; x++) keep.push([x, y]);   /* only the door row and the gap in front of it: the trees behind stay, and draw BEHIND the building, which is the "nestled in the woods" look */
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
      railing(upTo(34, 42).filter((x) => x !== 40 && x !== 41).map((x) => [x, 5]), "h");        // the north court's top rail, moved up from y7 with the court; (2026-09-25) open at 40-41, the Tower's gate
      railing(upTo(14, 18).map((y) => [27, y]), "v");
      railing(upTo(6, 12).map((y) => [32, y]), "v");        // and its west rail runs the full new height
      NORTH_ROAD(g, keep); objs.push({ t: "sign", x: 20, y: 11, name: "North: the Gloam. It opens at Combat 10 for its monsters, and Fishing 10 for its pond. Bigger tickets, better fish." }); g[11][20] = "#";
      /* (2026-09-22) the first bale moved off 36,7: that is now the north court's doorway, and a bale in it made a
         fence with no way through. The court is laid above, so anything decorative here must dodge it. */
      for (const [x, y] of [[30, 5], [29, 22], [17, 6], [7, 8]]) { objs.push({ t: "hay", x, y, name: "Hay bale" }); g[y][x] = "#"; }
      /* (2026-09-23, the owner: "put some in the yard ... spread them out randomly and not all by each other
         though, just 3 of them") WHEAT, AND WITH IT THE WHOLE OF FARMING. There was no wheat anywhere a player
         could reach: the only patches in the game are in the closed farm scene (eastscape-closed.js), and the
         wiki's Farming guide has been promising "wheat in the Yard" the whole time. That mattered more than one
         missing pickup, because Farming could not be STARTED without it — the only open source of farming xp is
         harvesting your own island plot, planting is gated on the crop's level (island.plant), wheat is the level
         1 crop, and the next one up is tomatoe at level 5. You could hold a stack of tomatoes off the Yard's
         rotten ones and still not be allowed to plant one.

         THREE, DELIBERATELY FAR APART. Picked by flood-filling the finished map from the casino gate and taking
         reachable grass with open ground on all four sides: north-west above the copper, beside the central path,
         and out in the south-west meadow. Nothing is within one tile of another object or a spawn, and the
         closest pair is 16 tiles apart, so they read as wild wheat rather than a crop field — a field is what the
         island is for. They go in BEFORE wild() and into `keep`, or a bush grows through them.

         THE PICTURE IS wheat.png, the one the closed farm already uses. A denser o_wheat was drawn for these and
         the owner preferred the original ("it looks better than these you made, just replace the graphics but the
         spacing etc in the yard is good"), so the override is gone and the sprite is core art again. The three
         positions are unchanged, which is the part that was right. */
      for (const [x, y] of [[8, 4], [28, 8], [7, 20]]) { objs.push({ t: "wheat", x, y, name: "Wheat" }); g[y][x] = "#"; keep.push([x, y]); }
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
      { name: "Livia the Broker", art: "livia", x: 31, y: 16, still: true, quests: ["copperbell", "wheatrun", "emeraldedge"], opens: "exchange", reach: 2, hair: "#2a1a10", shirt: "#c89a2a", pants: "#3a2a1a", lines: ["Buying? Selling? Use the stall. I take 1%.", "It keeps selling while you sleep."] },
      { name: "Charon the Ferryman", art: "charon", x: 39, y: 16, still: true, quests: ["sardines", "ferry"], opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Islands. Everyone gets one. Nobody knows who's paying for them.", "The river's closed, so now it's a cart. Don't ask how a cart gets to an island. I don't.", "Plant something before you go back in there and lose your shirt. It grows while you're away.", "Wheat, ten minutes. Tomatoes, twenty. Both sell. Both cook."] }],
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

      /* (2026-09-25) THE WAY INTO THE COUNT ROOM. The service door the house's money goes through, on the west
         wall of the floor. It wears o_walldoor, which this room ALREADY draws: an `art` name in a scene's own list is
         what defers that picture out of core.png for the whole game, and this door is not worth doing that for.
         It is a party dungeon like the Crypt and the label says so, because somebody clicking it alone should
         learn that from the door rather than from a refusal. */
      objs.push({ t: "countdoor", art: "o_walldoor", x: 12, y: 18, name: "The count room door: bring a party" }); g[18][12] = "#";
      return { g, objs, blobs: [] };
    },
    // the regulars at the machines are simulated players: they walk up to a game, play a while, and move on
    mobs: [], bots: [{ name: "due4aWin", level: 14 }, { name: "SlotGoblin", level: 37 }, { name: "AllInAlan", level: 61 }],
    npcs: [{ name: "Dex the Dealer", art: "dex", x: 35, y: 4, still: true, reach: 2, hair: "#1a1a1a", shirt: "#9a2a2a", pants: "#1a1a1a", lines: ["Drinks and dinner are at the Prize Counter. They help outside, not in here.", "Broke? Outside. Hit something.", "A round for the room is 3,000 tickets. Be a hero."   /* keep in step with BAR.round.price, which is defined below SCENES and so cannot be read from here */] },
      { name: "DookieBetts", art: "dookie", x: 28, y: 18, still: true, reach: 2, hair: "#1a1a1a", shirt: "#c8102e", pants: "#1a1a1a", lines: ["One more. Then one more after that.", "Scared money don't make money.", "You walking away? On THIS streak? Nah."] },
      // the regulars (2026-09-19): nobody here is a good influence
      /* Kellz (the owner, 2026-09-20, in Kellz's own words: a flight suit with a leather flight jacket, light-skinned, long hair "like Jesus"). He wandered the main aisle until v91, when the owner moved him "over to the smoking area": he hangs about between the club chairs now. */
      { name: "Kellz", art: "kellz", x: 36, y: 7, quests: ["hidesale"],   /* (v94: the owner put him on this tile, at the edge of the smoking section by the sign) */ hair: "#3a2416", shirt: "#6a4a2a", pants: "#5a6a3a", /* (the owner, 2026-09-20: an ULTRA Bills superfan. Loves Josh Allen, and Buffalo's wings are the best there are.) */
        lines: ["GO BILLS. That's it. That's the whole conversation.", "Josh Allen could hurdle this entire casino.", "Seventeen's my lucky number. It should be yours.", "Best wings on earth are in Buffalo. It's not close. Don't start.", "Blue cheese. Never ranch. I will fight you.", "I've gone through a folding table for this team. Twice.", "I'd fly Josh to the Super Bowl myself. Free.", "I only smoke when the Bills are playing. Or not playing."] },
      /* Rony Tomo (the owner, 2026-09-20: "an npc that hangs out by the wheel that looks like tony romo getting drunk... always talking about how
         its the cowboys year", with "WE DEM BOYZ" and "Dez caught it"). A parody like Bom Trady: navy 9, colours and a number, no logo or star. */
      { name: "Rony Tomo", art: "rony", x: 7, y: 17, quests: ["tomatoes"], hair: "#4a3020", shirt: "#1a2a5a", pants: "#c8c8d0", lines: ["THIS is the Cowboys' year. I can feel it.", "WE DEM BOYZ!", "Dez caught it.", "It's our year. *hic* It's been our year since '96.", "How 'bout them Cowboys? ...No, really, how about them?", "One more beer, then a Super Bowl."] },
      { name: "Parlay Pete", art: "pete", x: 40, y: 8, quests: ["houseodds"], hair: "#3a2a1a", shirt: "#6a6a72", pants: "#3a3a44", lines: ["Five-leg parlay. Can't lose.", "It lost."] },
      { name: "Nana Jackpot", art: "nana", x: 2, y: 8, still: true, hair: "#e8e8e8", shirt: "#e8a0b8", pants: "#8a6a8a", lines: ["Three sevens, dear. That's the dream.", "I've had this machine since Tuesday."] },
      { name: "Rent Money Randy", art: "randy", x: 18, y: 21, hair: "#5a4a3a", shirt: "#8a5a32", pants: "#8a5a32", lines: ["It's fine. Rent's not due till the first.", "Double or nothing fixes everything."] },
      { name: "Vince the Bouncer", art: "vince", x: 21, y: 21, still: true, quests: ["runclock"], reach: 2, hair: "#1a1a1a", shirt: "#141418", pants: "#141418", lines: ["Can't go out this door yet. Coming soon.", "Use the arch, west side. That's where everything is.", "Shoes. I always look at the shoes."] },
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
    name: "The Trailer Park", exits: { s: "thunderhead" },   /* (2026-09-27) south becomes the Depths when HOLD.depths is lifted */ tint: "rgba(30,20,10,.18)",
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
      /* (2026-09-25) SINGULARITY ORE. The Trailer Park is the 80-98 map, so the last ore in the game sits in the
         last place you fight. It wants a NOVA pickaxe, which is the one thing in the chain you have to make (or
         buy) rather than find - mine the Vault's Nova seams with an eclipse pickaxe first. */
      for (const [x, y] of [[36, 2], [40, 2], [43, 4]]) put({ t: "rock", x, y, ore: "singularity_ore", name: "Singularity pocket", req: { skill: "mining", lvl: 90 }, xp: 300 });
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
    npcs: [{ name: "Darla", art: "darla", x: 19, y: 11, still: true, quests: ["scrapline", "theking", "darlaeel"],   /* an NPC must LIST what it gives: a quest nobody offers is an error the content check catches, not a quest you find by walking about */ hair: "#8a5a2a", shirt: "#b04a3a", pants: "#3a3a48",
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
  /* THE THIEVES' GUILD (2026-09-23). One hall, four chambers, each gated on THIEVING alone — no level band, which
     is what makes this a path for somebody who never wants to fight. The chamber walls are the ladder: you can see
     the next room's marks through the doorway long before you can pick them. Room boundaries are GUILD_ROOMS and
     roomOf() below answers which chamber an x sits in, the same trick the Crypt uses for its gates. */
  guild: {
    name: "The Thieves' Guild", interior: true, floor: "guild", wallH: 34, room: [2, 7, 41, 18],
    exitTo: { scene: "gloam", x: 40, y: 5 }, entry: { x: 4, y: 17 }, tint: "rgba(30,18,44,.30)",
    build() {
      const g = room(2, 7, 41, 18, 3), objs = [];
      /* (2026-09-23, from the owner testing it) THE CHAMBERS ARE SEALED AND THE ONLY WAY THROUGH IS A DOOR. They
         were divided by walls with a gap at the bottom, which meant a level-1 thief could stroll into the
         Quartermaster's room and just not be able to pick anybody - "I can easily pass between each room". The
         wall is solid now and each gap holds a `guildgate` the server opens on your THIEVING level, so the rooms
         are a ladder you climb rather than a corridor you walk. */
      for (const [i, wx] of GUILD_WALLS.entries()) {
        for (let y = 7; y <= 18; y++) g[y][wx] = "v";
        g[17][wx] = "#";
        const next = MARKS[GUILD_ORDER[i + 1]], need = THIEF.gates[i];
        objs.push({ t: "guildgate", art: "o_walldoor", x: wx, y: 17, lvl: need, room: i + 1,
          name: `Door to the ${next.name}s \u2014 Thieving ${need}` });
      }
      /* WHAT EACH ROOM LOOKS LIKE. All reused art, and each room gets its own furniture so you can tell at a
         glance which one you are standing in - the other thing that came straight out of testing ("i cant see
         the differences in each room"). A sign in each says whose room it is and what it takes to work it. */
      const ROOMS = [
        { sign: "THE BACK ROOM. Apprentice Lifters. Everyone starts here.",
          props: [["crate", 2, 9], ["crate", 3, 8], ["sack", 6, 8], ["sack", 9, 15], ["bucket", 10, 9], ["cat", 5, 15],
                  ["crate", 8, 16], ["barrel", 2, 15], ["sack", 3, 16], ["crate", 10, 15], ["bucket", 6, 16], ["barrel", 9, 8], ["bench", 4, 12]] },
        { sign: "THE CARD ROOM. Grifters work here. Thieving 25.",
          props: [["table", 16, 15], ["chair", 15, 15], ["chair", 17, 15], ["bench", 19, 8], ["barrel", 14, 8], ["bucket", 21, 16],
                  ["sack", 20, 15], ["table", 19, 11], ["chair", 20, 11], ["chair", 18, 11], ["crate", 14, 16], ["barrel", 21, 8], ["bench", 16, 8]] },
        { sign: "THE STORE ROOM. The Fixers. Thieving 50.",
          props: [["barrel", 24, 8], ["barrel", 25, 15], ["chest", 27, 16], ["crate", 29, 8], ["column", 26, 11], ["sack", 31, 15],
                  ["barrel", 31, 8], ["crate", 24, 16], ["chest", 30, 15], ["barrel", 26, 8], ["sack", 29, 16], ["column", 28, 8], ["bucket", 23, 12]] },
        { sign: "THE VAULT ROOM. The Quartermaster. Thieving 75.",
          props: [["chest", 34, 8], ["chest", 36, 16], ["fire", 39, 8], ["statue", 37, 11], ["plant", 34, 15], ["plant", 41, 15],
                  ["chest", 40, 16], ["chest", 35, 16], ["barrel", 41, 8], ["chest", 33, 8], ["plant", 37, 16], ["column", 39, 12], ["bench", 34, 12]] },
      ];
      for (const [i, key] of GUILD_ORDER.entries()) {
        const M = MARKS[key], x0 = i === 0 ? 3 : GUILD_WALLS[i - 1] + 2, R = ROOMS[i];
        objs.push({ t: "sign", x: x0 + 1, y: 7, name: R.sign });
        g[7][x0 + 1] = "#";
        for (const [t, x, y] of R.props) { if (x < 2 || x > 41 || g[y][x] !== "i") continue; objs.push({ t, x, y, name: t[0].toUpperCase() + t.slice(1) }); g[y][x] = "#"; }
        /* (2026-09-25) A ROOM HOLDS ITS WHOLE BAND NOW, not one face three times. Every room has a headline mark
           (GUILD_ORDER, which the doors' signs still read) and, since the four in-between marks were added, a
           harder one standing next to it. Two of the three spots go to the easier mark and one to the harder, so
           the room you are working always has the next rung in it - which is the actual cure for "work this room
           to 50 to get to the next room". Sorted by level so the assignment cannot depend on MARKS' key order. */
        const band = Object.entries(MARKS).filter(([, m]) => m.room === i).sort((c, d) => c[1].lvl - d[1].lvl);
        [[1, 2], [4, 5], [6, 2]].forEach(([dx, dy], n) => {
          const [mk, MM] = band[n === 2 && band[1] ? 1 : 0];
          const x = x0 + dx, y = 8 + dy; if (x >= COLS - 2 || g[y][x] !== "i") return;
          objs.push({ t: "mark", mark: mk, x, y, name: MM.name, lvl: MM.lvl, xp: MM.xp, look: MM.look, req: { skill: "thieving", lvl: MM.lvl },
            tease: i ? "You would be noticed. Get better at this first." : "" });
          g[y][x] = "#";
        });
      }
      return { g, objs, blobs: [] };
    },
    /* (2026-09-23, the owner: "add a random real moving mob in a few rooms to make it feel alive") THESE ARE THE
       ONES THAT MOVE. A mark is an object and objects do not travel; an NPC is an entity with steps, which the
       server already paths and the page already animates, so the life in the room comes from people who are NOT
       marks. They carry a `level`, which is what sends an NPC wandering to random tiles rather than shuffling on
       the spot, and the chamber walls keep each of them in their own room without anything having to say so. */
    mobs: [],
    npcs: [
      { name: "Sticky Pete", art: "pete", level: 8, x: 6, y: 11, hair: "#4a3a22", shirt: "#5a5242", pants: "#332e26",
        /* (2026-09-23, the owner: "sticky pete and marlas dialogue should explain clearly how thieving works, and
           what the items are used for") PETE TEACHES THE MECHANIC, MARLA TEACHES THE POINT OF THE LOOT. Between
           the two of them a player who reads nothing else knows how to pick, what it costs to miss, what to sell
           and what to keep. They are in the first two rooms because that is where somebody who does not know yet
           is standing. */
        lines: ["Click whoever you fancy and keep clicking. You'll land more of them as your Thieving climbs — start on us, we're used to it.",
          "Miss and they'll have your wrist. Costs you a few seconds and one thing you'd already lifted. Never your tickets, never your gear.",
          "Lift something off a man and he'll keep a hand on his pocket a moment. Go and bother the next one, come back after.",
          "Nobody in here hits back. Leave the sword at home, you won't be needing it.",
          "Buttons, watches, signets — that lot's just money. The Prize Counter takes them."] },
      { name: "Marla Nine-Fingers", art: "marla", level: 22, x: 17, y: 13, hair: "#22222a", shirt: "#4a3a6a", pants: "#2a2438",
        lines: ["Nine is plenty. Now listen, because nobody else in here will tell you.",
          "Half of what you lift is just money — sell it. The other half goes to an anvil, and that's the half worth having.",
          "Whetgrit makes a Temper. Tick it on before you reforge and the odds go up twenty points.",
          "Quenching salts make Flux. Flux means a reforge that fails can't destroy the piece — it only drops a level. Ask anyone who's lost a +2.",
          "Guild seal wax makes a Master's seal, and a seal is the only thing in this world that takes a piece past +3.",
          "The Quartermaster's room has ore you'd otherwise have to go down the Vault for. That's why everyone wants in."] },
      { name: "The Quiet Man", art: "quietman", level: 44, x: 27, y: 13, hair: "#6a6a72", shirt: "#2a4a52", pants: "#1e2e34",
        lines: ["...", "Mm.", "Don't touch the chests."] },
      { name: "Odile the Clerk", art: "odile", level: 70, x: 38, y: 14, quests: ["stickyfingers"], hair: "#d8c8a0", shirt: "#6a2a2a", pants: "#3a1e1e",
        lines: ["Everything in this room is written down somewhere.", "The Quartermaster counts twice.", "You got in? Hm."] },
    ],
    bots: []
  },
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
export const isIsle = (key) => /^(isle\d?|shore|home|cellar):/.test(String(key));   /* (2026-09-27) the cellar is the owner's, like the cottage */
export const ownerOf = (key) => (isIsle(key) ? String(key).slice(String(key).indexOf(":") + 1) : null);
// which island layout an owner's island uses, by upgrade tier
export const isleKey = (isle, id) => `${["isle", "isle", "isle2", "isle3"][isle?.tier || 1]}:${id}`;
// the same scene, built the same way everywhere; every object gets its index as its id
export function buildScene(key) {
  const sc = sceneDef(key), b = sc.build.call(sc);
  fungObjs(String(key).split(":")[0], b);   /* (2026-09-27) Fungiculture's wild clusters: before the event's objects, so they never depend on it */
  hwObjs(String(key).split(":")[0], b);   /* (2026-09-27) the Long Night's jack-o'-lanterns and ghost lanterns, while the event is on */
  if (!sc.noBanks) markBanks(b.g);   /* (2026-09-27) the Depths' abyss is its own edge: see its map */
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
  chicken: { name: "Chicken", size: "s", lvl: 1, hp: 3, att: 1, def: 1, max: 1, speed: 2400, oy: 11, box: [6, 16], drops: [["chicken", 1], ["feather", [5, 15]], ["bones", 1]] },   /* this drops line is DEAD: LOOT.chicken replaces it (3-6 feathers) */
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
  goose: { name: "Thunder Goose", size: "l", lvl: 55, hp: 110, att: 40, def: 36, max: 10, speed: 2800, box: [21, 35], drops: [["bones", 2], ["feather", [10, 30]], ["tickets", [100, 250]], ["onyx_ore", 1, 0.3]] },   /* DEAD: LOOT.goose replaces it (3-6 feathers) */
  /* v68 (2026-09-19): THE BANDS' NEW RESIDENTS. Stats follow the old curve by level (hp about 1.6 x level before the
     halving below, att .73, def .63, max level/6); what a kill PAYS is measured, not guessed (BOUNTY, tools/eastscape-balance.mjs). */
  toadstool: { name: "Sulking Toadstool", size: "s", lvl: 10, hp: 18, att: 7, def: 6, max: 2, speed: 2600, box: [6, 15], drops: [] },
  boneidle: { name: "Bone Idle", size: "m", lvl: 16, hp: 27, att: 12, def: 10, max: 3, speed: 2600, box: [8, 30], drops: [] },
  twister: { name: "Paper Twister", size: "s", lvl: 20, hp: 30, att: 15, def: 12, max: 4, speed: 2200, box: [7, 16], drops: [] },
  counter: { name: "Card Counter", size: "m", lvl: 24, hp: 38, att: 18, def: 15, max: 4, speed: 2400, box: [8, 26], drops: [] },
  shark: { name: "Loan Shark", size: "m", lvl: 26, hp: 42, att: 19, def: 16, max: 5, speed: 2400, aggro: 3, box: [12, 28], drops: [] },
  stagehand: { name: "The Stagehand", size: "m", lvl: 32, hp: 50, att: 23, def: 20, max: 5, speed: 2400, box: [8, 28], drops: [] },
  /* (2026-09-24, the owner: "add a mini ghost boss as well with custom art") THE CRITIC, alone in the Royal Box.
     A MINI boss and not a dungeon one: no party, no ante, no run — he stands in a yard and you walk in. The
     numbers say mini rather than big: 200 hit points against the Understudy’s 31, so about seven of the
     hardest thing on this map, and level 42 so he sits just over the band’s ceiling of 39. He is the only
     thing in the Boneyard that comes for you (`aggro`), which is why he is behind a gate you choose to open.
     The declared hp is DOUBLE what he fights with: every mob in this table is halved at load. */
  critic: { name: "The Critic", size: "xl", lvl: 42, hp: 400, att: 34, def: 30, max: 11, speed: 2500, aggro: 6, box: [16, 46], drops: [] },
  /* ---------------------------------------------------------------- THE CARNIVAL (2026-09-24), band 62-72.
     Slotted into a real hole: the Thunderhead tops out at The House (lvl 70, 85 hp) and the Trailer Park starts
     at the Junkyard Dog (lvl 80, 82 hp), so there was nothing to fight in between. The ladder here runs from a
     Hail Drake (62, 62 hp, att 46) up to just under a Junkyard Dog, and the declared hp is DOUBLE what they
     fight with, because every mob in this table is halved at load.
     ONLY THE BOSS IS ON AGGRO_ON. The game area is a paved plaza and a fairground you get mauled in while
     queueing is not a fairground. */
  pinhead: { name: "Pinhead", size: "s", lvl: 62, hp: 116, att: 46, def: 38, max: 11, speed: 2000, box: [10, 22], drops: [] },
  tripled: { name: "The Triple", size: "m", lvl: 65, hp: 126, att: 48, def: 41, max: 12, speed: 2300, box: [12, 28], drops: [] },
  fatlady: { name: "The Fat Lady", size: "l", lvl: 68, hp: 164, att: 50, def: 47, max: 12, speed: 3200, box: [22, 30], drops: [] },
  strongman: { name: "The Strongman", size: "l", lvl: 71, hp: 148, att: 54, def: 45, max: 14, speed: 2900, box: [18, 36], drops: [] },
  /* THE HEADLINER. "a boss thats this mask guy" — a clown in a cracked porcelain grin, alone in the north-west
     in front of his funhouse. 150 against a Fat Lady’s 82, which is a mini boss and not a raid: no party, no
     ante, you walk up to him. */
  grinner: { name: "The Grinning Man", size: "xl", lvl: 72, hp: 300, att: 58, def: 50, max: 17, speed: 2600, aggro: 6, box: [16, 44], respawn: 300000, drops: [] },   /* (2026-09-25, the owner: "the grinning man in the carnival is getting exploited") FIVE MINUTES. The turnstile takes a Carnival ticket to go IN and nothing to come out, so the ticket is a cover charge paid ONCE - and inside the cage he was coming back on the ordinary 15s timer, DIVIDED by the number of people on him. At a 2,000 bounty that is about 8,000 tickets a minute for a party, against a band near 480. At five minutes he measures ~370, which is what a boss should pay. */
  usher: { name: "One-Eyed Usher", size: "m", lvl: 36, hp: 56, att: 26, def: 23, max: 6, speed: 2400, aggro: 4, box: [8, 26], drops: [] },
  brainstorm: { name: "Brainstorm", size: "s", lvl: 40, hp: 60, att: 29, def: 25, max: 7, speed: 2200, box: [7, 16], drops: [] },
  seagoat: { name: "Sea-Goat of the Upper Air", size: "l", lvl: 46, hp: 78, att: 33, def: 29, max: 8, speed: 2800, box: [20, 36], drops: [] },
  golem: { name: "Storm Golem", size: "l", lvl: 52, hp: 100, att: 38, def: 35, max: 9, speed: 3000, box: [20, 40], drops: [] },
  wolf: { name: "Thunderwolf", size: "m", lvl: 58, hp: 104, att: 43, def: 36, max: 10, speed: 2200, aggro: 4, box: [10, 28], drops: [] },
  /* (2026-09-27) THE WILDERNESS'S OWN THREE (the owner: "add a few wilderness only monsters with custom art with unique drops"). They live
     nowhere else, so what they carry is found nowhere else: the Weaver's wild silk is the second source of silkstring (every bow from
     72 needs it, and the Boneyard's two spiders were the only one), the Hound's marrow knaps into the wild-only arrow between
     dragonstone and onyx, and the Lich's grimcore brews Void ink with the grimstone the wild is full of, and he is the one monster that
     drops seeds ten times as often as anything else. Aggressive by type; the placement sets the radius. */
  weaver: { name: "Wild Weaver", size: "l", lvl: 40, hp: 44, att: 38, def: 24, max: 6, speed: 2600, aggro: 4, box: [18, 30], drops: [] },
  marrowhound: { name: "Marrow Hound", size: "m", lvl: 50, hp: 58, att: 47, def: 31, max: 6, speed: 2200, aggro: 5, box: [10, 26], drops: [] },
  grimlich: { name: "Grim Lich", size: "l", lvl: 66, hp: 84, att: 61, def: 45, max: 6, speed: 3000, aggro: 4, box: [16, 34], drops: [] },
  /* THE GOLDEN SANDS, 40-49 (2026-09-24). Stats sit inside the band's own envelope - Cloudreach's ram is 42
     and its angel 48 - and the two ingredient drops are the only new items any of them carry. Like every other
     map's monsters they also drop the PREVIOUS band's ore, which is dragonstone. */
  /* (2026-09-24, the owner: "scarabs and sand cobras need to buff by twice as much (stronger) because they
     drop important alchemy ingredients") Double the hit points and about a third again on everything else, so
     the two things carrying the fang and the shell are the hardest fights on this map by a clear margin - harder
     than the jackals guarding the pyramid. Still well inside the game's curve: a level 62 Hail Drake has 124.
     An ingredient nobody has to work for is not an ingredient, it is a pickup. */
  /* NO HAND-WRITTEN `tickets` ON THESE FOUR (2026-09-24). BOUNTY owns what a kill pays and the loop at the
     bottom of this file rebuilds the line from it, so a number written here is either ignored or misleading. */
  /* AND THE INGREDIENTS ARE A GRIND (2026-09-24, the owner: "gift scarab and sand cobra should not drop fang and
     shell everytime. it shoould be a grind, around a 10% drop rate"). The third number in a drop is its chance;
     without one it is a certainty, which is what these two were. At a tenth, BOUNTY's loop raises their ticket
     line on its own to keep the kill worth what it measures - the table prices a 10% shell at a tenth of a shell. */
  cobra: { name: "Sand Cobra", size: "s", lvl: 48, hp: 62, att: 38, def: 33, max: 11, speed: 2000, aggro: null, box: [10, 20], drops: [["snakefang", 1, 0.1]] },
  mummy: { name: "Bandaged Debtor", size: "m", lvl: 43, hp: 35, att: 30, def: 27, max: 7, speed: 2800, aggro: null, box: [10, 26], drops: [["dragonstone_ore", 1]] },
  scarab: { name: "Gilt Scarab", size: "s", lvl: 52, hp: 74, att: 42, def: 38, max: 12, speed: 2200, aggro: null, box: [12, 22], drops: [["scarabshell", 1, 0.1]] },
  jackal: { name: "Tomb Jackal", size: "m", lvl: 47, hp: 41, att: 34, def: 30, max: 8, speed: 2600, aggro: null, box: [10, 27], drops: [["dragonstone_ore", 1]] },
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

/* HARDER OUTSIDE THE YARD (2026-09-25, the owner: "for all mobs outside of the Yard, and only in scenes (not
   towers, not dungeons). make them do 33% more damage and increase their HP by 33%").

   WHERE THIS SITS IS THE WHOLE TRICK. It runs at module load, and the Crypt, the Pyramid and the Tower all merge
   their own MOBS rows LATER, in the worker's index.js — so "not towers, not dungeons" costs nothing here: they
   are not in this table yet. The Tower would have been safe regardless, because floorSpec derives a floor's
   health from the climber's dps and only borrows the base monster's NAME, ART, SIZE, BOX and SPEED.

   THE YARD IS EXCLUDED BY TYPE, not by scene, because health and max hit are read off MOBS[t] and a type is
   shared by every scene it stands in. These six also appear in the Forum-era maps (farm, grove, tomato, river,
   paddock, rough), and none of those is in OPEN — so today "not the Yard's types" and "not the Yard" are the
   same set. If that area ever reopens its monsters come back at the old numbers, which is a decision to make
   then rather than a bug now.

   `max` is the damage ROLL, and a hit is rint(1, max) — so the average is (1 + max) / 2, not max. Scaling max by
   1.33 would only be a 25-30% rise at the small numbers most monsters have. Solving for the average instead is
   what makes this the 33% that was asked for. */
export const YARD_TYPES = ["chicken", "cow", "rotten", "olive", "hornworm", "boar"];

/* TWO KNOBS, NOT ONE (2026-09-25, the owner: "lets go 1.15. lets also increase the mob danger even more").
   These shipped as a single 1.33 and were split because they do different jobs and had to move in OPPOSITE
   directions:

     OUTSIDE_HP IS TIME TO KILL and nothing else. 1.33 made every fight a third longer, which is what the TTK
     complaints were actually about, so it comes down to 1.15.
     OUTSIDE_DMG IS DANGER. It goes UP, and it had to go up by more than it looks: cutting health also cuts
     danger, because a shorter fight is fewer swings taken. At 1.15 health, 1.54 damage only MATCHES what today
     felt like - anything less than that is a difficulty cut dressed up as one.

   1.75 is spike danger, and that is deliberate. A level-appropriate player in full tier gear sits on hitChance's
   10% FLOOR (a mob's `att` is irrelevant past about level 50 - see the note there), so only about two swings land
   in a whole kill and average damage cannot be moved much from here. What CAN be moved is how much one of those
   two hurts: The Last Dealer's max goes 24 -> 32 against a 92-health player, so a bad pair of rolls is most of
   your life. Sustained danger needs the FLOOR raised, which is a separate decision because it lands on the Tower
   too - the Tower is excluded from these two by where they run, but not from that. */
/* WHAT A MONSTER HAS TO HIT (2026-09-25, the owner: "many mobs are still hitting for 0s across the board, i think
   due to accuracy ... i think players defense is out performing mobs attacks by alot, especially when you consider
   the pets, buffs, foods, reforging, etc", then: "make mob att actually matter").

   HE WAS RIGHT AND IT GOT WORSE WITH LEVEL. A monster's `att` was hand-written at roughly its level, while a
   player's defence roll is (melee + gear def) / 2 and gear def climbs 14 a tier - so the gap ran -9 at level 20
   and -28.5 at 98, every monster sat on hitChance's floor, and `att` was a decorative number. Raising the floor
   (which this file did earlier today, 0.1 -> 0.18) treats the symptom: it lifts everything equally and STILL
   leaves att meaningless, because everyone is on the floor either way.

   So att is derived instead. expectedDefence(lvl) is the roll of a level-appropriate player in the best full set
   their level allows - the same model the Tower uses to pick a floor's defence - and MOB_HIT is the share of
   swings a monster of that level should land against them. att follows from the two by the same arithmetic
   hitChance uses, so a monster's accuracy now tracks the gear it is meant to be fought in.

   IT ONLY EVER RAISES. Math.max keeps anything already hand-tuned above the curve, so a monster written to be
   unusually accurate stays unusually accurate. And it runs beside OUTSIDE_HP/OUTSIDE_DMG, which means the Tower
   and the two dungeons - which merge their rows later - are untouched and keep their own tuning. */
const SET_SLOTS = ["helm", "body", "legs", "shield", "boots", "gloves"];
export const expectedDefence = (lvl) => {
  let t = TIERS[0];
  for (const x of TIERS) if (lvl >= (x.gate || 1)) t = x;
  const gear = SET_SLOTS.reduce((n, sl) => n + (ITEMS[`${t.key}_${sl}`]?.def || 0), 0);
  return (lvl + gear) / 2;
};
export const MOB_HIT = 0.35;   // the share of swings a monster of its own level should land on a geared player
export const attFor = (lvl) => Math.max(1, Math.round(expectedDefence(lvl) + (MOB_HIT - 0.5) / 0.04));

export const OUTSIDE_HP = 1.15;
export const OUTSIDE_DMG = 1.75;
export const OUTSIDE_BUFF = OUTSIDE_HP;   // the old name: a few tools still read it for the health side
for (const [t, m] of Object.entries(MOBS)) {
  if (YARD_TYPES.includes(t)) continue;
  m.hp = Math.max(2, Math.round(m.hp * OUTSIDE_HP));
  m.max = Math.max(2, Math.round((m.max + 1) * OUTSIDE_DMG - 1));
  m.att = Math.max(m.att, attFor(m.lvl));   /* see attFor: raises only, so a hand-tuned brawler keeps its edge */
}

/* WHAT A MONSTER DROPS (2026-09-20, the owner: "1-3 items, with the third being a rare one"). The same three lines for
   every monster, so nobody needs the wiki to know what a kill is:
     1. CASH, always: the bounty (BOUNTY, further down, fills this in so an average kill is worth what it should be)
     2. ITS ONE THING, always: whatever crafting wants from it (or, for the late ones, a piece of their scene's ore)
     3. A RARE: one roll a kill, and at most one rare a kill. It's either one of the monster's own named pieces (`rare`
        here: [item, chance a kill]) or one of the casino FINDS every monster shares (chips, free play, boxes, dice, watches).
   Gone with this: bones, pits, feathers and tusks (nothing used the first two; the recipes that used the others changed),
   and the thirty-row tables that gave every piece of emerald and diamond gear a fraction of a percent each. Tier gear is
   smithed; what DROPS is the named stuff you can't make. (Until then a Tax Wraith had 31 rows.) */
/* THE CHANCES IN THIS TABLE ARE NO LONGER READ (2026-09-23). Every named rare drops at RARE_RATE — see raresOf,
   which is where that is applied. The numbers are left in place because they are the history of what each drop
   used to be worth, and because stripping ninety-nine of them by hand is a worse idea than a comment; but tuning
   one here does nothing, exactly like editing a price in MOBS instead of VALUE. Add a rare by naming it. */
export const LOOT = {
  /* FEATHERS (2026-09-25, the owner: "3-6 feathers every kill, not 25+"): six things carry them, spaced up the ladder so an
     archer at any level has a bird nearby - the Chicken (1), the Highwayman's hat plume (12), the Understudy's costume (38),
     the Angel's wings (48), the Thunder Goose (55) and the Fat Lady's hat (68). Always dropped, and only 1-3 (the owner, later the same day: "so theyre rare") - the bulk
     source is the cauldron's feather brew in the FLETCH block. A feather is worth 0, so none of these touch a wage. */
  chicken:    { item: ["chicken", 1], also: [["bones", 1], ["feather", [1, 3]]] }   /* (2026-09-25) BACK ON, at two to four, because a feather is now worth 0 - the objection recorded to the right was about its VALUE, and that is gone */   /* NOT the feathers its MOBS line still declares (2026-09-24). A feather is worth 1 and a chicken is meant to pay 9, so five to fifteen of them is the whole wage twice over - and BOUNTY can only ever take TICKETS back out of a table, never an item, so there is no lever to correct it with. Measured 126 a minute against a band of 56. */,
  cow:        { item: ["beef", 1], also: [["hide", 1], ["bones", 1]] },
  rotten:     { item: ["tomatoe", [1, 3]], also: [["husk", 1, 0.05]] },
  hornworm:   { item: ["husk", 1], also: [["tomatoe", 1, 0.5]], rare: [["gamblers_ring", 0.006]] },
  boar:       { item: ["pork", 1], also: [["tusk", 1], ["bones", 1]], rare: [["gamblers_ring", 0.01]] },
  highwayman: { item: ["hide", 1], also: [["bones", 1], ["feather", [1, 3]]], rare: [["rattlebean", 0.0125], ["mask", 0.1], ["bookies_amulet", 0.008], ["sharps_gloves", 0.006]] },
  gnasher: { item: ["emerald_ore", 1], also: [["bones", 1]], rare: [["rattlebean", 0.0125], ["bogplate", 0.03], ["bookies_amulet", 0.01]] },
  moth: { item: ["emerald_ore", 1], rare: [["lanternroot", 0.0125], ["adjusters_visor", 0.01], ["angels_ring", 0.006]] },
  taxwraith: { item: ["receipt", 1], rare: [["lanternroot", 0.0125], ["wraithhood", 0.03], ["menace", 0.02], ["adjusters_visor", 0.01], ["angels_ring", 0.01], ["spiderboots", 0.004]] },
  ghoul: { item: ["diamond_ore", 1], also: [["bones", 1]], rare: [["bonegourd", 0.0125], ["sharps_gloves", 0.012], ["stake_loafers", 0.008]] },
  /* the Trailer Park. The King is the only thing that drops his two, and at 8% and 5% he is meant to be killed
     many times over — he is a reason to come back, not a box you open once. */
  junkdog:    { item: ["bones", [1, 2]], rare: [["starfruit", 0.0125], ["stake_loafers", 0.02], ["spiderboots", 0.01]] },
  possum:     { item: ["hide", 1], rare: [["starfruit", 0.0125], ["gamblers_ring", 0.03], ["sharps_gloves", 0.015]] },
  scrapper:   { item: ["catalytic", 1], rare: [["starfruit", 0.0125], ["menace", 0.03], ["sharps_gloves", 0.02], ["grudge", 0.01]] },
  gator:      { item: ["hide", [1, 2]], also: [["nova_core", 1, 0.0005], ["singularity_core", 1, 0.0005]], rare: [["starfruit", 0.0125], ["bogplate", 0.04], ["spiderboots", 0.02], ["angels_ring", 0.01]] },
  junkking:   { item: ["catalytic", [2, 4]], also: [["nova_core", 1, 0.0005], ["singularity_core", 1, 0.0005]], rare: [["kingcap", 0.08], ["wrench", 0.05], ["angels_ring", 0.04], ["slagstone", 0.5]] },
  understudy: { item: ["diamond_ore", [1, 2]], also: [["feather", [1, 3]]], rare: [["bonegourd", 0.0125], ["sharps_gloves", 0.025]] },
  /* THE CARNIVAL (2026-09-24). Its four carry the band’s ore and the boss carries the map’s whole rare table
     on one kill, the same shape the Boneyard’s Critic has. Nothing new is invented here: every key is a thing
     that already exists, so the band gets a place to fight without also getting a balance surface. */
  pinhead:   { item: ["catalytic", 1], also: [["carnivalticket", 1, 0.01]], rare: [["glassgourd", 0.0125], ["lantern", 0.01], ["spiderboots", 0.01]] },
  tripled:   { item: ["catalytic", 1], also: [["carnivalticket", 1, 0.01]], rare: [["glassgourd", 0.0125], ["sharps_gloves", 0.01], ["markedcard", 0.01]] },
  fatlady:   { item: ["starfall_ore", 1], also: [["carnivalticket", 1, 0.01], ["feather", [1, 3]]], rare: [["glassgourd", 0.0125], ["angels_ring", 0.01], ["adjusters_visor", 0.01]] },
  strongman: { item: ["starfall_ore", [1, 2]], also: [["carnivalticket", 1, 0.01]], rare: [["glassgourd", 0.0125], ["stake_loafers", 0.01], ["devils_dice", 0.01]] },
  grinner:   { item: ["starfall_ore", [2, 4]], rare: [["monocle", 0.01], ["angels_ring", 0.01], ["sharps_gloves", 0.01], ["adjusters_visor", 0.01], ["spiderboots", 0.01]] },
  /* HE PAYS IN THINGS. Bonegourds every time (the Boneyard’s alchemy crop, and the Coilbreaker wants one),
     and the map’s whole rare table on one kill instead of spread over five monsters. */
  critic: { item: ["bonegourd", [2, 4]], rare: [["monocle", 0.01], ["lantern", 0.01], ["angels_ring", 0.01], ["adjusters_visor", 0.01], ["spiderboots", 0.01]] },
  chandelier: { item: ["cobweb", 1], also: [["bones", 1]], rare: [["bonegourd", 0.0125], ["lantern", 0.03], ["angels_ring", 0.02], ["spiderboots", 0.01]] },
  ram: { item: ["dragonstone_ore", 1], also: [["bones", 1]], rare: [["stormcorn", 0.0125], ["grudge", 0.02], ["stake_loafers", 0.015]] },
  // v68: the bands' new residents. One thing each; the buff gear is spread so every band past the Yard can drop some
  toadstool: { item: ["sporecap", [1, 4], 0.30], rare: [["rattlebean", 0.0125], ["bookies_amulet", 0.006]] },   /* (2026-09-27, the owner) 30% of toadstools, one to four at a time: the hash gave 37% of one */
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
  weaver:      { item: ["cobweb", [1, 2]], also: [["wildsilk", 1, 0.3]], rare: [["spiderboots", 0.02], ["sharps_gloves", 0.02]] },
  marrowhound: { item: ["bones", [2, 3]], also: [["marrow", 1, 0.3]], rare: [["stake_loafers", 0.02], ["angels_ring", 0.01]] },
  grimlich:    { item: ["grimstone", [1, 2]], also: [["grimcore", 1, 0.04], ["seed_sun", 1, 0.025], ["seed_ember", 1, 0.025], ["seed_frost", 1, 0.025], ["seed_void", 1, 0.025]], rare: [["wraithhood", 0.02], ["bookies_amulet", 0.02], ["angels_ring", 0.01]] },
  drake: { item: ["hailshard", 1], rare: [["stormcorn", 0.0125], ["stake_loafers", 0.03], ["spiderboots", 0.015]] },
  house: { item: ["onyx_ore", [1, 3]], rare: [["stormcorn", 0.0125], ["angels_ring", 0.04], ["bookies_amulet", 0.04], ["spiderboots", 0.02]] },
  // once the closed roads' residents: placed again in v68 (olive in the Yard, goat in the Gloam, revenant and angel in Cloudreach)
  olive:      { item: ["olives", [2, 5]], also: [["pit", 1]], rare: [["monocle", 0.1]] },
  goat: { item: ["manifesto", 1], also: [["bones", 1]], rare: [["rattlebean", 0.0125], ["toga", 0.25]] },
  revenant: { item: ["dragonstone_ore", 1], also: [["bones", 2]], rare: [["stormcorn", 0.0125], ["grudge", 0.04], ["menace", 0.03]] },
  angel: { item: ["dragonstone_ore", 1], also: [["feather", [1, 3]]], rare: [["stormcorn", 0.0125]] },
  goose: { item: ["onyx_ore", 1], also: [["bones", 2], ["feather", [1, 3]]], rare: [["stormcorn", 0.0125], ["stake_loafers", 0.02], ["spiderboots", 0.01]] },
  warden:     { item: ["starfall_ore", [1, 2]], rare: [["emberwheat", 0.0125], ["angels_ring", 0.03], ["bogplate", 0.02]] },
  pitboss:    { item: ["starfall_ore", [1, 2]], rare: [["emberwheat", 0.0125], ["bookies_amulet", 0.04], ["gamblers_ring", 0.03]] },
  hoard:      { item: ["eclipse_ore", 1], rare: [["emberwheat", 0.0125], ["gamblers_ring", 0.05], ["angels_ring", 0.03]] },
  dealer:     { item: ["eclipse_ore", [1, 2]], also: [["voidglass", 1, 0.2], ["nova_core", 1, 0.0005], ["singularity_core", 1, 0.0005]], rare: [["bookies_amulet", 0.06], ["spiderboots", 0.04], ["grudge", 0.03]] }
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
  "chandelier", "usher", "critic",             // The Boneyard (30): yewlogs, dragonstone ore — and The Critic, who is behind his own gate
  "grinner",                                   // The Carnival (62): the boss, and the ONLY thing there that comes for you
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
for (const [t, L] of Object.entries(LOOT)) if (MOBS[t]) { MOBS[t].drops = [L.item, ...(L.also || [])]; MOBS[t].rare = L.rare || []; }   /* (2026-09-24) `also`: extra drops, each [key, n, chance] like any other. LOOT used to REPLACE drops with a single item, so a mob in this table could carry exactly one named thing - which is why the Golden Sands wrote its drops by hand and lost its rare table doing it. */
/* (2026-09-26, the owner: "NO items except for tickets should ALWAYS drop... between 25% and 45%, with varying rates so it feels
   somewhat RNG") EVERY SURE DROP BECOMES A CHANCE. A drop written without a chance - a monster's one thing, and every `also`
   with no third number - now lands 25-45% of kills, the exact rate fixed per monster and item by a hash so it is stable and
   still uneven across the map. Tickets are the bounty, paid separately, and are untouched. Excused: the BOSSES below (each
   area's headline monster) and the dungeons, whose monsters live in their own rules files and never pass through here. A
   drop that already carried a chance (feathers on the Fat Lady's ticket, a core at one in two thousand) keeps it. */
export const BOSSES = new Set(["critic", "grinner", "house", "junkking", "pitboss", "dealer"]);
const sureRate = (t, k) => { const v = Math.sin(t.length * 7.31 + [...t + k].reduce((a, ch) => a + ch.charCodeAt(0) * 3.7, 0)) * 43758.5453; return Math.round((0.25 + (v - Math.floor(v)) * 0.2) * 100) / 100; };
for (const [t, m] of Object.entries(MOBS)) if (!BOSSES.has(t) && Array.isArray(m.drops)) m.drops = m.drops.map((d) => (d.length >= 3 || d[0] === "tickets" ? d : [d[0], d[1], sureRate(t, d[0])]));

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
/* (2026-09-27, the owner: "they all need to replicate what the anvil and fletching table do where waiting for a choice") NO STATION
   STARTS ON ITS OWN. `auto` used to mean "one click makes the best thing you can"; every station is now `false`, so a click walks
   you to it and opens the window, and nothing is made until you choose a row. A batch still runs the chosen recipe until it cannot. */
export const STATIONS = {
  fire:    { skill: "cooking",  verb: "cook",  name: "campfire", auto: false,  kind: "cook" },
  range:   { skill: "cooking",  verb: "cook",  name: "range",    auto: false,  kind: "cook", kind2: "range" },
  furnace: { skill: "smithing", verb: "smelt", name: "furnace",  auto: false,  kind: "smelt" },
  anvil:   { skill: "smithing", verb: "smith", name: "anvil",    auto: false, kind: "smith" },
  /* (2026-09-24) THE CAULDRON DOES BOTH JOBS, and that is deliberate. It melts sand into glass AND brews the
     potions, because the level check one screen down reads `st.skill` - the STATION's skill, not the recipe's.
     Vials at the furnace would therefore have been gated on Smithing, and a launch skill you cannot train
     without levelling a second one is not a launch skill. A cross-skill requirement is a fine idea, but it has
     to be CHOSEN, not inherited from which bench a recipe happens to sit on. */
  cauldron: { skill: "alchemy",  verb: "brew",  name: "cauldron", auto: false,  kind: "brew" }
};

export const RECIPES = {};
const recipe = (id, r) => { RECIPES[id] = { id, ms: 1800, ...r }; };

/* ALCHEMY, 1 TO 100 (2026-09-24). Glass first, then the brews, all at the cauldron - see STATIONS for why the
   sand does not go in the furnace. THE ORDER IS THE DESIGN: small vials from 1, medium from 34, large from 68,
   each size holding a longer buff than the last; and the potions alternate a SKILLING buff with a COMBAT one
   the whole way up, so neither sort of player ever hits a dead stretch. Six of the farm's seven crops are in
   here, which is what turns Farming from a dead end into a supply line. */
for (const [id, r] of Object.entries({
  blow_small_vial: { in: [["sand", 1]], out: ["small_vial", 1], lvl: 1, xp: 10, ms: 1600 },
  blow_medium_vial: { in: [["sand", 2]], out: ["medium_vial", 1], lvl: 34, xp: 30, ms: 2000 },
  blow_large_vial: { in: [["sand", 4]], out: ["large_vial", 1], lvl: 68, xp: 70, ms: 2400 },
  /* small - ten minutes a bottle */
  brew_swift: { in: [["small_vial", 1], ["sporecap", 2]], out: ["pot_swift", 1], lvl: 1, xp: 22 },
  brew_hide: { in: [["small_vial", 1], ["hide", 2]], out: ["pot_hide", 1], lvl: 10, xp: 34 },
  brew_keen: { in: [["small_vial", 1], ["wheat", 2], ["sporecap", 1]], out: ["pot_keen", 1], lvl: 19, xp: 48 },
  brew_salve1: { in: [["small_vial", 1], ["lanternroot", 2]], out: ["pot_salve1", 1], lvl: 23, xp: 56 },
  brew_rattle: { in: [["small_vial", 1], ["rattlebean", 2]], out: ["pot_rattle", 1], lvl: 28, xp: 66 },
  /* medium - fifteen */
  brew_quick: { in: [["medium_vial", 1], ["markedcard", 1], ["lanternroot", 1]], out: ["pot_quick", 1], lvl: 36, xp: 96 },
  brew_gourd: { in: [["medium_vial", 1], ["bonegourd", 2], ["bones", 1]], out: ["pot_gourd", 1], lvl: 45, xp: 118 },
  brew_salve2: { in: [["medium_vial", 1], ["lanternroot", 3], ["bonegourd", 1]], out: ["pot_salve2", 1], lvl: 50, xp: 132 },
  brew_ghost: { in: [["medium_vial", 1], ["cobweb", 1], ["husk", 1]], out: ["pot_ghost", 1], lvl: 54, xp: 145 },
  brew_purse: { in: [["medium_vial", 1], ["receipt", 1], ["stormcorn", 1]], out: ["pot_purse", 1], lvl: 62, xp: 170 },
  /* large - twenty */
  brew_prospect: { in: [["large_vial", 1], ["goldtomatoe", 1], ["markedcard", 1], ["scarabshell", 1]], out: ["pot_prospect", 1], lvl: 70, xp: 220 },
  brew_fang: { in: [["large_vial", 1], ["sharktooth", 1], ["snakefang", 1], ["rattlebean", 1]], out: ["pot_fang", 1], lvl: 78, xp: 250 },
  brew_salve3: { in: [["large_vial", 1], ["lanternroot", 4], ["scarabshell", 1]], out: ["pot_salve3", 1], lvl: 84, xp: 275 },
  brew_storm: { in: [["large_vial", 1], ["staticfur", 1], ["stormjelly", 1], ["lanternroot", 1]], out: ["pot_storm", 1], lvl: 90, xp: 300 },
  brew_pharaoh: { in: [["large_vial", 1], ["scarabshell", 2], ["snakefang", 1], ["goldtomatoe", 1]], out: ["pot_pharaoh", 1], lvl: 100, xp: 360 },
  /* the raid's own recipe: Alchemy 100 AND venom out of the Great Pyramid, which is the only place it exists */
  brew_coilbreaker: { in: [["large_vial", 1], ["serpentvenom", 2], ["scarabshell", 2], ["bonegourd", 1]], out: ["pot_coilbreaker", 1], lvl: 100, xp: 420 },
})) recipe(id, { skill: "alchemy", station: "cauldron", ms: 2200, ...r });
/* THE STOP LEVEL, per recipe. A vial keeps a long tail on purpose - glass is the front of the whole chain, so
   blowing it should stay a real cost well past the level that unlocks it - and a potion settles down over the
   span of the two recipes above it. Nothing reaches zero: see spoilChance. */
for (const [id, failStop] of Object.entries({
  blow_small_vial: 30, blow_medium_vial: 64, blow_large_vial: 97,
  brew_swift: 22, brew_hide: 30, brew_keen: 40, brew_salve1: 44, brew_rattle: 48,
  brew_quick: 56, brew_gourd: 64, brew_salve2: 68, brew_ghost: 72, brew_purse: 80,
  brew_prospect: 86, brew_fang: 92, brew_salve3: 96, brew_storm: 99, brew_pharaoh: 99, brew_coilbreaker: 99,
})) RECIPES[id].failStop = failStop;

// cooking, unchanged in every number from when it lived in its own table
for (const [raw, c] of Object.entries({
  sardine: { to: "csardine", lvl: 1, xp: 30, burnStop: 20 }, chicken: { to: "cchicken", lvl: 1, xp: 30, burnStop: 20 },
  beef: { to: "cbeef", lvl: 5, xp: 40, burnStop: 25 }, pork: { to: "cpork", lvl: 10, xp: 60, burnStop: 35 },
  trout: { to: "ctrout", lvl: 15, xp: 70, burnStop: 40 }, gloomfin: { to: "cgloomfin", lvl: 25, xp: 100, burnStop: 55 },
  mooncarp: { to: "cmooncarp", lvl: 40, xp: 150, burnStop: 70 },
  lanternfish: { to: "clanternfish", lvl: 30, xp: 120, burnStop: 60 }, skyeel: { to: "cskyeel", lvl: 50, xp: 190, burnStop: 80 },
  oasisperch: { to: "coasisperch", lvl: 42, xp: 155, burnStop: 72 }, nilecarp: { to: "cnilecarp", lvl: 48, xp: 180, burnStop: 78 },   /* (2026-09-24) the oasis, in The Golden Sands */
  mudcat: { to: "cmudcat", lvl: 60, xp: 230, burnStop: 88 }, bowfin: { to: "cbowfin", lvl: 70, xp: 270, burnStop: 94 }, voidfin: { to: "cvoidfin", lvl: 82, xp: 340, burnStop: 99 }, grimscale: { to: "cgrimscale", lvl: 90, xp: 420, burnStop: 99 },   /* (2026-09-27) the Deep's two: Cooking to 90 */   // the Trailer Park's swamp: the best food in the game, and the only reason to take Cooking past 50
  perch: { to: "cperch", lvl: 5, xp: 40, burnStop: 25 }, catfish: { to: "ccatfish", lvl: 18, xp: 80, burnStop: 45 }, mudskipper: { to: "cmudskipper", lvl: 22, xp: 95, burnStop: 50 },
  goldfish: { to: "cgoldfish", lvl: 62, xp: 235, burnStop: 90 }, koi: { to: "ckoi", lvl: 68, xp: 255, burnStop: 92 },   /* (2026-09-24) the Carnival duck pond, filling 58-80 */
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
/* (2026-09-25, relayed by the owner from dookiebetts800: "the non smoked versions of level 60 fish heal less
   then non smoked level 50 food") He was right, and worse at the top than the example: Cooked bowfin at level 70
   healed 30 against Cooked thunder squid at 60 on 32, so the best fish in the game was the WORSE meal unless you
   smoked it. Eleven plain cooks sat below a lower-level fish.

   Fixed BUFF-ONLY, because people have these banked and nerfing a food somebody stocked up on is a worse bug than
   the one being fixed: each offender was raised one above the best fish below it. That is why the top only moves
   30 -> 35; a curve fitted to the good points wanted 40, which is a different change from the one asked for.

   A SMOKE IS ALWAYS ITS COOK PLUS TWO. That held for all seven before this and still does - keep it that way, or
   the smoked ladder grows a second, separate bug. tools/eastscape-food-check.mjs fails if either inverts again. */
const SMOKE = {
  ghostcarp:    { lvl: 40, coal: 1, heal: 24, sell: 110, fx: { rare: 0.08 },              blurb: "Drops come a little easier." },
  cloudray:     { lvl: 50, coal: 1, heal: 28, sell: 145, fx: { tough: 0.08 },             blurb: "You take less of a beating." },
  skyeel:       { lvl: 55, coal: 1, heal: 30, sell: 125, fx: { speed: 0.08 },             blurb: "Lighter on your feet." },
  stormmarlin:  { lvl: 60, coal: 2, heal: 31, sell: 140, fx: { tix: 0.10 },               blurb: "Everything pays a bit more." },
  mudcat:       { lvl: 65, coal: 2, heal: 32, sell: 180, fx: { rare: 0.15 },              blurb: "The good stuff turns up." },
  thundersquid: { lvl: 65, coal: 2, heal: 34, sell: 165, fx: { tough: 0.15 },             blurb: "Hits land softer." },
  bowfin:       { lvl: 75, coal: 3, heal: 37, sell: 210, fx: { tough: 0.10, rare: 0.15 }, blurb: "The best thing out of that water." },
  voidfin:      { lvl: 86, coal: 3, heal: 42, sell: 260, fx: { tough: 0.12, rare: 0.18 }, blurb: "The dark keeps you." },   /* (2026-09-27) smoking to 95 */
  grimscale:    { lvl: 95, coal: 4, heal: 48, sell: 320, fx: { tough: 0.15, rare: 0.20, tix: 0.05 }, blurb: "Nothing in the game feeds you better." },
  /* (2026-09-25, the owner: "make a reciple / art/ icons for smoking carnival fish as well") The duck pond's two.
     A SMOKE SITS ABOUT FIVE LEVELS ABOVE ITS OWN COOK across this whole table (36/40, 45/50, 50/55, 55/60, 60/65,
     70/75), so 62 and 68 give 67 and 73 - which also keeps the SMOKED ladder in order by smoke level, landing
     them between thundersquid at 65 and bowfin at 75 rather than jumping the queue.
     Their heals are their cooks plus two, which is the rule the whole table follows.
     AND THEY TAKE THE LAST TWO UNUSED BUFF KEYS. zdrop and bite were the only ones no smoke had claimed, and both
     suit a carnival prize fish: a goldfish you won turns coins up, and a koi makes the next one come easier -
     which is a nice loop, since you eat a fish to fish better. */
  goldfish:     { lvl: 67, coal: 2, heal: 35, sell: 170, fx: { zdrop: 0.12 },               blurb: "ZCoins turn up where they did not." },
  koi:          { lvl: 73, coal: 3, heal: 36, sell: 195, fx: { bite: 0.10 },                blurb: "The next one comes easier." }
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
/* THE TABLES TAKE A CUT (2026-09-23, the owner: "give the eastscape tables an edge when people bet with tickets").
   This band is EastScape's alone and every table here is priced in TICKETS -- the games (run/runEnd), Hi-Lo's
   per-run draw and the Fight Pit all take G.takeInv(..., "tickets", ...) and nothing else, so there is no ZCoin
   play to protect and no need to branch on a currency. eastcoin.vip's own casino is untouched: it keeps its 96-104
   promise in functions/api/casino/_engine.js, which has its own edgeFor(seed) and never reads this.

   Why it moved: at [0.96, 1.04] the mean was 100.002% over 200,000 draws, so the room drained nothing at all. In
   almost every game economy the casino is the main sink; here it was mathematically zero while TIX_HOUR.winCap let
   a good hour pay 400,000 -- five times the best grinding rate. The band is now [0.93, 0.99]: mean 96%, a 4% house
   edge, in line with a real roulette wheel.

   The 0.99 top is deliberate and is the property worth keeping. No play is ever better than fair, so there is
   nothing to shop for -- the reason a per-play draw exists at all is that a fixed per-GAME rate is an edge a player
   can find and farm, and one already had. A band whose ceiling sits under 1 keeps that and adds the drain.

   Note the counterweight: FX_CAP lets a fully buffed player take up to +5% on a win and 3% of losses back, which
   can still carry them over 100%. That is earned, capped, and meant to feel like an edge -- but if the room ever
   needs to drain harder, lower FX_CAP before widening this. */
export const EDGE_BAND = [0.93, 0.99];
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
export const JACKPOT = { slice: 0.02, seed: 10000, cap: 250000 };   /* (v107: grown with the bet limits, 40x; a full-size spin still wins the lot, see jackpotShare) */
/* (2026-09-23) Halved with TIX_RATE. The pot itself needs no help -- it is fed by a slice of real bets, so it fills
   at whatever the money is worth -- but `seed` is the floor the HOUSE tops it back up to and `cap` is an absolute
   ceiling, and left at 20,000/500,000 both would have been worth twice as many hours as the day before. */
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
export const DEX = { rate: 1000, capHour: 50, capDay: 100, maxStake: 20 };   /* (2026-09-27) capDay: ZCoins that may leave the game to a wallet in a rolling 24 hours (trades and banked finds); capHour is the ticket-stake allowance */
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
export const OUT_CAP = { tix: 0.25, speed: 0.2, tough: 0.3, rare: 0.4, zdrop: 0.75, bite: 0.1, heal: 0.5, steal: 0.15, ammo: 0.5, leech: 0.25, double: 0.3, execute: 0.3, calm: 1, nobill: 1, gem: 1, smelt: 0.5, forge: 0.2 };
const OUT_KEYS = ["tix", "speed", "tough", "rare", "zdrop", "bite", "heal", "steal", "ammo", "leech", "double", "execute", "calm", "nobill", "gem", "smelt", "forge"];   /* (2026-09-27) gem: the Mountain's Heart */   /* (2026-09-27) the last six are the Long Night's pieces' effects; see fxText */

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
/* `medal` is the drawn picture for the tier, in flat/ui/. It carries the tier's identity in the Achievements
   window now, and `col` no longer paints any text there: these five are pastels chosen for the dark CANVAS, and
   the window is cream parchment, where #9ad8a0 novice green on #f2e4c8 was barely a colour at all. They survive
   as the row's left-hand band, which is the one place on that panel a pale colour does its job.
   A picture is also the honest differentiator here: three of the five tiers are gold, so a colour ramp could
   never have separated Expert, Master and Legend the way a medal, a cup and a crown do. */
export const ACH_TIERS = {
  novice:  { name: "Novice",  pts: 1,  tix: 60,    col: "#9ad8a0", medal: "ach_novice" },
  skilled: { name: "Skilled", pts: 2,  tix: 250,   col: "#7fc8e8", medal: "ach_skilled" },
  expert:  { name: "Expert",  pts: 3,  tix: 1250,  col: "#c0a0ff", medal: "ach_expert" },
  master:  { name: "Master",  pts: 5,  tix: 6000,  col: "#ffb03a", medal: "ach_master" },
  legend:  { name: "Legend",  pts: 10, tix: 25000, col: "#ff6ad5", medal: "ach_legend" }
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
const aSkills = (n) => (c) => Object.keys(SKILLS).every((k) => SKILLS[k].held || lvlOf(c, k) >= n);   /* (2026-09-27) a held skill cannot block "every skill" */
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
  /* (2026-09-24, reported by the owner: "the achievement for a user wasnt completed when they reforged
     something") ALL THREE OF THESE READ A DEAD FIELD until today. The reforge level used to live on the
     character as `c.forge[itemKey]`; it moved onto the ITEM (eqf for what is worn, `f` on the stack for what is
     carried) and normChar migrates the old map ONCE and then leaves it frozen and unread. So every one of these
     asked a question about a map that stopped being written: anybody who reforged before the migration kept
     qualifying off the frozen copy, and everybody who has reforged since qualified for NONE of the three. They
     go through topForge now, which reads what the character actually has. */
  /* ALCHEMY (2026-09-24). `crafted` is the map the station already writes, so these cost nothing to track, and
     every potion key is `pot_*` so one regex answers "have you brewed anything at all". */
  a_sand:     { name: "Grain by Grain",     blurb: "Dig sand out of a pit in the Golden Sands.",      tier: "novice", on: ["gather"], has: (c) => (aOf(c, "gathered").sand | 0) >= 1 },
  a_vial:     { name: "Glassblower",        blurb: "Melt sand into your first vial.",                 tier: "novice", on: ["craft"],  has: (c) => aHasKey(c, "crafted", /_vial$/) },
  a_brew:     { name: "First Draught",      blurb: "Brew a potion at a cauldron.",                    tier: "novice", on: ["craft"],  has: (c) => aHasKey(c, "crafted", /^pot_/) },
  s_alch34:   { name: "Apothecary",         blurb: "Reach Alchemy 34 and blow a medium vial.",       tier: "skilled", on: ["xp"],     has: (c) => lvlOf(c, "alchemy") >= 34 },
  e_alch68:   { name: "Master Brewer",      blurb: "Reach Alchemy 68 and blow a large flask.",       tier: "expert", on: ["xp"],     has: (c) => lvlOf(c, "alchemy") >= 68 },
  e_pharaoh:  { name: "The Best Thing Made", blurb: "Brew a Pharaoh's draught. It takes Alchemy 100.", tier: "expert", on: ["craft"],  has: (c) => (aOf(c, "crafted").pot_pharaoh | 0) >= 1 },
  a_forge:    { name: "Sharper",            blurb: "Reforge a piece of gear at the anvil.",           tier: "novice", on: ["forge"],  has: (c) => topForge(c) >= 1 },
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
  s_forge2:   { name: "Plus Two",           blurb: "Reforge something to +2.",                       tier: "skilled", on: ["forge"],  has: (c) => topForge(c) >= 2 },
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
  e_forge3:   { name: "Plus Three",         blurb: "Reforge something to +3, the top.",              tier: "expert", on: ["forge"],  has: (c) => topForge(c) >= 3 },
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
  m_pets:     { name: "The Whole Kennel",   blurb: "Own all five pets.",                             tier: "master", on: ["kill"],   has: (c) => Object.keys(PETS).filter((k) => !PETS[k].event && !PETS[k].bred).every((k) => (c && c.pets || []).some((x) => x.k === k)) },   /* (2026-09-27) the original pets: bred ones are Breeding's own chase */   /* (2026-09-27) event pets do not count: a Black Cat from one October must not lock this for everyone after */
  m_total500: { name: "Five Hundred",       blurb: "Reach a total level of 500.",                    tier: "master", on: ["xp"],     has: (c) => totalOf(c) >= 500 },
  m_zcoin10:  { name: "Prospector",         blurb: "Find ten real ZCoins.",                          tier: "master", on: ["loot"],   has: (c) => (aOf(c, "looted").zcoin | 0) >= 10 },
  m_allmobs:  { name: "Exterminator",       blurb: "Kill at least one of every monster.",            tier: "master", on: ["kill"],   has: (c) => Object.keys(MOBS).filter((k) => !MOBS[k].event).every((k) => (aOf(c, "kills")[k] | 0) > 0) },   /* (2026-09-27) event monsters do not count, for the same reason */

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
  { const a = achFx(c); for (const k of OUT_KEYS) out[k] += a[k] || 0; }
  { const pf = petFx(c); out.tough += pf.tough / 100; out.bite += pf.bite / 100; out.steal += pf.steal / 100; }   /* (2026-09-27) the Breeding pets, inside the caps below */
  out.rare += charmOf(c, "keeneye") / 100;   /* (2026-09-26) Keen Eye, before the caps below */   /* (2026-09-23) achievement milestones, before the caps below so they cannot escape them */
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
  f.bite && `fish bite ${pct(f.bite)} more often`, f.heal && `fish heal ${pct(f.heal)} more`,
  /* (2026-09-27) the Long Night's pieces */
  f.ammo && `${pct(f.ammo)} of your shots and casts spend no arrow or page`, f.leech && `${pct(f.leech)} of the damage you deal comes back as health`, f.double && `${pct(f.double)} of what you mine, cut or catch comes up double`,
  f.execute && `a monster under ${pct(f.execute)} health dies to your next hit (never a boss)`, f.calm && `nothing outside attacks you first`, f.nobill && `the hospital never bills you`, f.gem && `jewels turn up in the rock ${pct(f.gem)} more often`, f.smelt && `${pct(f.smelt)} of the bars you smelt come out double`, f.forge && `every reforge is ${pct(f.forge)} likelier to land`,
  f.power && `your other worn buff gear is ${pct(f.power)} stronger`].filter(Boolean).join("; ");
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
  if (c?.charm && (c.charm.left | 0) > 0 && CHARMS[c.charm.k]) { const C_ = CHARMS[c.charm.k], t = c.charm.tier || 1; one("charm", `${C_.name} ${"I".repeat(t)}`, `scroll_${c.charm.k}`, `${C_.name} (tier ${"I".repeat(t)}): ${C_.what(C_.vals[t - 1])}. The clock only runs while you're outside.`, Math.ceil(c.charm.left / 60000), "minute"); }   /* (2026-09-26) the page buff */
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
export const BANDS = { carnival: [62, 72], workyard: [1, 9], gloam: [10, 19], mire: [20, 29], boneyard: [30, 39], cloud: [40, 49], sands: [40, 49], thunderhead: [50, 99], trailer: [80, 99] }   /* (2026-09-24) The Golden Sands shares Cloudreach's band ON PURPOSE: it is a SECOND ROUTE west out of the Boneyard at 40, not a rung above it. */;   /* (2026-09-22) the Trailer Park: Combat 80 to start a fight there, Fishing 80 for the black water — the same soft gate as everywhere, on the two skills separately */
/* THE HOSPITAL BILL (the owner, 2026-09-19: "lets do #1"): dying outside costs a share of the tickets you are CARRYING, capped by
   where you died, so the Yard stays forgiving. Nothing else is ever touched: gear, the bag, ZCoins, experience, the bank. The tickets go
   nowhere: a sink. (Tickets can't be banked, so there is always something for the bill to take from.) */
export const DEATH = { carnival: { share: 0.1, cap: 7000 }, workyard: { share: 0.05, cap: 250 }, gloam: { share: 0.1, cap: 1000 }, mire: { share: 0.1, cap: 2000 }, boneyard: { share: 0.1, cap: 3500 }, cloud: { share: 0.1, cap: 5000 }, sands: { share: 0.1, cap: 5000 }, thunderhead: { share: 0.1, cap: 6000 }, vault: { share: 0.1, cap: 8000 }, trailer: { share: 0.1, cap: 9000 } };
export const deathBill = (c, scene) => { const d = DEATH[String(scene || "").split(":")[0]]; return d ? Math.min(d.cap, Math.floor(tixIn(c) * d.share)) : 0; };
export const bandOf = (scene) => BANDS[String(scene || "").split(":")[0]] || null;
/** Why this character can't fight / fish in this scene yet, or null if they can. kind: "fight" | "fish". */
/* (2026-09-27) WHERE A MAP'S FISHING STARTS BELOW ITS FIGHTING. The band's first number gates both, which on the Boardwalk asked for Fishing 66
   at a mackerel spot that is Fishing 60. A scene listed here gates fishing at its own number: the level of its easiest spot. */
export const FISH_BAND = { boardwalk: 60, bw_cabin: 60, bw_light: 72, bw_wreck: 72, bw_pier: 72, bw_skull: 84 };
export const bandBlock = (c, scene, kind) => { const b = bandOf(scene); if (!b) return null; const skill = kind === "fish" ? "fishing" : "melee", need = kind === "fish" ? FISH_BAND[String(scene || "").split(":")[0]] ?? b[0] : b[0], have = lvlOf(c, skill);
  return have >= need ? null : { need, have, skill, text: `needs ${kind === "fish" ? "Fishing" : "Combat"} ${need}` }; };
/* (2026-09-27, the owner: "push it with depths and jewelcrafting held shut") WHAT SHIPS BUILT BUT SHUT. Flip one to false to open it:
   the Depths goes into OPEN and takes its place between the Thunderhead and the Trailer Park; Jewelcrafting's bench stands in the
   Yard and the skill joins the panel, the hiscores and the wiki. Held, everything stays in the rules (a save that somehow carries
   the items or the xp still loads) but nobody can reach it and the wiki does not list it. The tests open both with
   globalThis.__ES_OPEN_ALL before they import this file. */
export const HOLD = { depths: false,   /* (2026-09-27) OPEN: the owner, "lets push it live" */ jewel: !globalThis.__ES_OPEN_ALL, boardwalk: false,   /* (2026-09-27) OPEN: the owner, "the boardwalk is ready to launch" */ foundry: !globalThis.__ES_OPEN_ALL, orchard: !globalThis.__ES_OPEN_ALL };   /* (2026-09-27) the Boardwalk, the Foundry and the Orchard Wall: launched the same morning and held shut again at the owner's word ("close them for now and dont allow access until i reiterate them"). Held: no door to them, not in the wiki, and anyone saved inside is walked back out on login (the worker's HELD_MAPS) */
export const OPEN = new Set(["carnival",   /* (2026-09-24) OPEN AT LAST. Built 2026-09-24 and held shut at the owner’s word until he said "launch the publish the carnival so its openn to peoople now". */ "casino", "roulette", "theatre", "fightpit", "vault", "wild", "deep", "agility",   /* (2026-09-22) The Run. Built with the Agility skill but never added here, so its door in the Yard answered with the bouncer's "Room's shut" — a scene is not enterable until it is in this set. */   /* (2026-09-22) the Wilderness reopened, down the rope ladder on the Gloam */ /* "highroller": closed for now (the owner, 2026-09-19) */ /* "forum", "bathhouse": closed in v108, what mattered there is in the Yard */ "workyard", "gloam", "mire", "boneyard", "cloud", "sands", "thunderhead", "trailer",
  ]);   /* (2026-09-23) the Thieves' Guild. Deliberately NOT in BANDS: its rooms gate on Thieving through each mark's own `req`, and a combat band here would undo the whole point of a skill you cannot fight your way into. */   // (paddock, rough, boneyard closed 2026-09-20: their monsters live in the three scenes of the one line out)
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
/* (2026-09-26, the owner) TEN TIMES THE KILLS, SAME TICKETS. The table above keeps the numbers it was written with; this is the
   tuning, in one place. `was` keeps the old count only for jobs rolled before the change (see dailyNeed). */
export const DAILY_KILL_MULT = 10;
for (const d of DAILY) if (d.what === "kill") { d.was = d.n; d.n *= DAILY_KILL_MULT; }
/** how many a rolled job wants: its own count, stored when it was rolled; a job rolled before counts were stored keeps the old one */
export const dailyNeed = (task) => { const d = dailyDef(task?.id); return d ? (task.n ?? d.was ?? d.n) : 0; };

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
  eclipse:     [["eclipse_ore", 2], ["voidglass", 1]],     // the Vault's floor, Mining 70, plus the glass from its windows
  /* (2026-09-25) and the 80s and 90s, on the same rule: ore plus the bar below it, so the top of the ladder is a
     CHAIN and not a wall - a Singularity bar eats a Nova bar, which eats an Eclipse bar, which eats voidglass. */
  nova:        [["nova_ore", 2], ["eclipse_bar", 1]],      // the Vault, Mining 80
  singularity: [["singularity_ore", 2], ["nova_bar", 1]]   // the Trailer Park, Mining 90
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
/* (2026-09-25) TWO MORE RUNGS. Indexed by tier POSITION, so it must grow with TIERS or the new smelts are
   handed `undefined` charcoal and quietly cost none. */
const CHAR_FUEL = [1, 1, 2, 2, 3, 3, 4, 5, 6];
const SMELT_DOUBLE = new Set(["onyx", "starfall", "eclipse", "nova", "singularity"]);   /* (2026-09-27) see the smelt recipe below */
/* What a log is worth in charcoal. Anything not named here gives 1. */
/* HOW MUCH CHARCOAL A LOG IS WORTH (2026-09-25, the owner: "higher level trees should give more charcoal
   proportionately"). It did not, and in two places it ran BACKWARDS: rustpine at Woodcutting 65 burned into two
   where the ancient yew at 35 burned into three, and skyash at 45 was also worth less than the yew. The same
   shape as the cooked-fish ladder a player reported - each number is written on its own line, hundreds of lines
   from its neighbours, so nothing in the game ever puts them side by side.

   The ladder now runs with the tree's WOODCUTTING level, roughly one charcoal per twelve levels, and
   tools/eastscape-food-check.mjs fails if it ever inverts again.

   PALM LOGS HAD NO BURN RECIPE AT ALL - the only log in the game that could not become charcoal, which is why
   the woodcutting guide had to carry a line apologising for it. They burn now.

   The number beside each is the Woodcutting level of the tree it comes off, for the next person reading it. */
const BURN = {
  logs: 1,          //  1
  willowlogs: 2,    // 15
  ashlogs: 2,       // 20  (deadwood)
  yewlogs: 3,       // 35
  palmlogs: 4,      // 45
  skyashlogs: 4,    // 45
  pinelogs: 5,      // 65  (rustpine; was 2, below the yew's three)
  voidlogs: 6,      // 75  (vaultwood)
  bogwoodlogs: 7,   // 80
  gallowslogs: 8,   // 90  (2026-09-27: the Deep Wild's one tree; the top of the charcoal ladder with it)
};

/* (2026-09-25) THE CHASE, AND THE WAY ROUND IT. A core drops at CORE_DROP from the five hardest things in the
   game, which at 1 in 2,000 is a lottery and not a plan — so the SAME core is craftable from a pile of what those
   places already drop. That pairing is the whole design: a drop feels like skipping an evening, and a dry streak
   is still progress. Do not make the core drop-only; a required 1-in-2,000 is how a chase item becomes a reason
   to stop playing. (The owner also keeps the market as a third route: people sell these.) */
const CORE_TIERS = { nova: "nova_core", singularity: "singularity_core" };
/* ROUTE B, and it is the one most people will actually walk. Each core is also made at an anvil out of a heap of
   what the 80s and 90s maps already drop - which is the second job these recipes do: hail shards, static pelts,
   storm jelly, catalytic converters and slagstone were sell-only until now. */
const CORE_CRAFT = {
  nova_core:        { lvl: 80, in: [["hailshard", 15], ["staticfur", 10], ["stormjelly", 5], ["eclipse_bar", 2]] },
  singularity_core: { lvl: 90, in: [["catalytic", 15], ["slagstone", 10], ["masters_seal", 1], ["nova_bar", 2]] }
};
/* 0.0005 IS ALSO WRITTEN AS A LITERAL in the three bosses' LOOT rows above, and cannot say so there: LOOT is
   evaluated at module load and this line runs hundreds of lines later, so naming it throws "cannot access
   before initialization" - which it did. eastscape-gear-check.mjs asserts the two agree. */
export const CORE_DROP = 0.0005;
export const CORE_BOSSES = ["junkking", "gator", "dealer", "hoodie3", "squeeze"];

for (const [i, t] of TIERS.entries()) {
  const tierN = i + 1, bar = `${t.key}_bar`;
  ITEMS[bar] = { name: `${t.name} bar`, icon: "🧱", tier: t.key, ex: `Smelted ${t.name.toLowerCase()}, still warm. It wants to be something.` };
  /* (2026-09-27, the owner: "smithing bars are printing too many tickets now too. double the craft cost of all bars starting at
     onyx and up"). SMELT_DOUBLE doubles the ore, the extra (grimstone, voidglass) and the charcoal of every smelt from onyx up,
     and leaves the BAR OF THE TIER BELOW at one. That is what makes it an exact doubling rather than a compounding one: the bar
     below has already doubled, so one of it IS twice the raw cost it was. Doubling it as well would make a singularity bar
     eight times the eclipse ore it was, not two. Bars sell for what they did; the xp per smelt is unchanged, so the xp per ore
     from onyx up is halved along with the tickets. */
  const dbl = SMELT_DOUBLE.has(t.key) ? 2 : 1, isBar = (k) => /_bar$/.test(k);
  recipe(`smelt_${t.key}`, { skill: "smithing", station: "furnace", in: [...SMELT[t.key].map(([k, n]) => [k, isBar(k) ? n : n * dbl]), ["charcoal", CHAR_FUEL[i] * dbl]], out: [bar, 1], lvl: t.gate, xp: 15 * tierN, ms: 2400, priceDiv: dbl });   /* priceDiv: see the RAW loop - the bar SELLS for what it did */
  /* (2026-09-25) THE TOP TWO TIERS' WEAPONS WANT A CORE as well as bars — the owner picked the weapon as the
     chase item, so the armour is a reliable grind and the thing in your hand is the trophy. Armour and tools are
     untouched, and so is every tier below. */
  const core = CORE_TIERS[t.key];
  if (core && CORE_CRAFT[core]) recipe(`craft_${core}`, { skill: "smithing", station: "anvil", in: CORE_CRAFT[core].in, out: [core, 1], lvl: CORE_CRAFT[core].lvl, xp: 600 * tierN, ms: 3200 });
  for (const [slot, n] of Object.entries(BARS)) {
    const key = `${t.key}_${slot}`;
    if (!ITEMS[key]) continue;
    const wants = core && ITEMS[key].slot === "weapon" && !ITEMS[key].tool ? [[bar, n], [core, 1]] : [[bar, n]];
    recipe(`smith_${key}`, { skill: "smithing", station: "anvil", in: wants, out: [key, 1], lvl: t.gate, xp: n * 20 * tierN, ms: 2600 });
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
/* (2026-09-23) `max` IS THE CAP YOU CAN REACH UNAIDED; `cap` IS THE HIGHEST A LEVEL MAY EVER BE. They were the
   same number until the Thieves' Guild put a Master's seal in the game, which buys ONE attempt at +4. Every
   CLAMP in this file now uses `cap` and every "you are finished" test still uses `max` — and the distinction is
   load-bearing, because normChar re-clamps a character on EVERY load: leaving those clamps on `max` would have
   quietly demoted a +4 back to +3 the next time its owner signed in, with no error anywhere. The forge test
   insists on that specific journey. */
export const FORGE = {
  /* THREE LEVELS, NOT FIVE (2026-09-22, second pass). Five could not be expressed: the bonus is a percentage of the
     piece's own stat, and most gear has stats small enough that four of the five levels rounded to zero - 44 of 70
     pieces gained NOTHING at +1, and a diamond axe only moved at +4. The owner asked that every level always move a
     number, which needs a floor of +1 a level, and a floor is per PIECE - armour is six of them, so it multiplied by
     six and took a full set from +16 defence to +30, over two tiers and a sixty-point swing in how often anything
     hits you. Fewer levels is the lever, because the floor is what inflates. At three, a full set lands on +19
     against a tier of +14 and every single level moves. */
  max: 3, cap: 4,
  temper: 0.20,   /* (2026-09-23) what a Temper adds to the odds of one attempt. 55% -> 75% at the top step, which is the step anybody bothers to spend one on. */
  /* A TOOL REFORGES ON ITS SKILL, NEVER ON COMBAT (2026-09-23, the owner: a reforged pickaxe was offering accuracy
     and strength, which is nonsense on a skilling tool). Tools are deliberately poor weapons - see the TIERS note -
     so buying combat with a reforge fought the design. They buy tool SPEED instead, which is what a tier rung buys
     (+8% a rung), so a level is a legible fraction of a rung. 2.5% is chosen so three levels (+7.5%) stay just UNDER
     a rung: a +3 bronze axe must never beat a plain iron one, or reforging would invert the ladder bestTool() sorts
     by. It is flat, not a share of the tool's own stat the way gear is, because a bronze tool's stat is zero. */
  tspd: 0.025,
  pcap: 0.10,   /* (2026-09-25) what a level adds to a QUIVER: a tenth more room. A quiver has no combat stat to grow, and room is the one thing it is for. */
  /* odds[level] is the chance of going level -> level+1. */
  odds: [1, 0.8, 0.55, 0.35],
  /* brk[level] is the chance a FAILURE destroys the piece outright instead of knocking it down a level. Only a
     failure can break something, so +1 is always safe and the risk arrives exactly when there is something to lose.
     About one piece in seven is lost on the way to +3. */
  brk: [0, 0.08, 0.15, 0.30],
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
export const canForge = (key) => { const it = ITEMS[key]; if (it?.forgeWith) return !!(it.acc || it.str || it.def || it.pouch);   /* (2026-09-25) a fletched piece: its own wood, see FLETCH */
  if (!it || !it.tier || !forgeSlot(key)) return false; return isTool(key) || !!(it.acc || it.str || it.def); };
/* (2026-09-23) A LEVEL BELONGS TO A PIECE, so these come in two shapes and it matters which you reach for:
     fLevelOf(c, slot)   the level of what is WORN in that slot — what the stats are built from
     forgeLevel(c, key)  the same thing looked up by item name, kept because everything that computes a stat
                         already asks that way. It answers about the EQUIPPED piece and nothing else: a +3 in
                         your bag must not buff the plain one on your back.
   Anything DISPLAYING a piece (a bag slot, a market row, a trade offer) has the entry in its hand and should use
   its `f` through the *At helpers below, never these. */
export const fLevelOf = (c, slot) => Math.max(0, Math.min(FORGE.cap, (c?.eqf?.[slot] | 0) || 0));
export const forgeLevel = (c, key) => { for (const sl in c?.eq || {}) if (c.eq[sl] === key) return fLevelOf(c, sl); return 0; };
/** The chance the NEXT step succeeds, or 0 at the cap. */
export const forgeOdds = (lvl, sealed = false) => (lvl >= (sealed ? FORGE.cap : FORGE.max) ? 0 : FORGE.odds[lvl] ?? FORGE.odds[FORGE.odds.length - 1]);
/** What one attempt costs: [barKey, howMany], or null when the piece cannot be reforged. */
/* WHAT A REFORGE IS WORTH, for anything that has to SHOW it. bonusOf already folds the level into combat, but every
   name, tooltip, stat chip and equipment slot reads ITEMS[key] directly and would otherwise print the base numbers -
   so a +5 sword looked identical to a plain one everywhere except the fight itself. These are the one place the
   arithmetic lives, so a display can never drift from what the server actually rolls. */
/* THE FLOOR IS THE POINT: at least +1 a level, so a level always moves a number however small the piece's stat is.
   A stat of zero stays zero - a helm does not quietly start granting strength. */
export const forgeAddAt = (key, lvl, f) => { if (isTool(key)) return 0; const v = ITEMS[key]?.[f] || 0, l = Math.max(0, Math.min(FORGE.cap, lvl | 0)); return v && l ? Math.max(l, Math.round(v * FORGE.step * l)) : 0; };
export const forgeAdd = (c, key, f) => forgeAddAt(key, forgeLevel(c, key), f);
/** The chance a FAILURE at this level destroys the piece rather than knocking it down one. */
export const forgeBreak = (lvl) => FORGE.brk[lvl] ?? 0;
/** The stat a piece ACTUALLY has for this character, reforge included. */
export const statOf = (c, key, f) => (ITEMS[key]?.[f] || 0) + forgeAdd(c, key, f);
/* WHAT THE NEXT LEVEL BUYS, derived from forgeAdd rather than re-deriving its arithmetic (2026-09-22). The anvil
   used to work this out itself as round(v * step * (f+1)) and subtract forgeAdd - which silently dropped the FLOOR,
   so it reported "next level adds nothing to this piece" on 54% of rows when every level in fact adds at least +1.
   A player reading that would never reforge. Anything that wants to show a gain calls this; nobody recomputes it. */
/* (2026-09-23) THE LADDER HAS TWO TOPS and this has to be told which. Unaided you stop at FORGE.max; a Master's
   seal from the Thieves' Guild buys one attempt at FORGE.cap. Clamping `l` to `max` while testing it against
   `cap` — which is what the seal change first did here — makes the stop condition UNREACHABLE: a +4 piece was
   clamped back to 3 and then offered the 3 -> 4 rung again, for ever. Clamp to the ceiling, compare to the top
   that applies. */
export const forgeNextAt = (key, lvl, sealed = false) => {
  const l = Math.max(0, Math.min(FORGE.cap, lvl | 0));
  if (l >= (sealed ? FORGE.cap : FORGE.max)) return [];
  if (isTool(key)) return [["tspd", FORGE.tspd]];
  if (ITEMS[key]?.pouch) return [["cap", FORGE.pcap]];   /* (2026-09-25) a quiver's level is room */
  /* (2026-09-23) By LEVEL, not by a stand-in character. This used to build `{ forge: { [key]: l + 1 } }` and ask
     forgeAdd about it, which stopped meaning anything the moment a level moved onto the item: forgeLevel reads
     what is WORN now, and a made-up object has nothing worn. */
  return ["acc", "str", "def"].map((f) => [f, forgeAddAt(key, l + 1, f) - forgeAddAt(key, l, f)]).filter(([, d]) => d > 0);
};
export const forgeNext = (c, key) => forgeNextAt(key, forgeLevel(c, key));
/** "Diamond axe +3", or just "Diamond axe" at +0. */
/* WHAT THE REFORGE ON THIS PIECE IS ALREADY GIVING YOU (2026-09-23, the owner: "on reforged gear, it needs to be
   noticable what the reforge added"). forgeNext answers what the NEXT level buys, which is the anvil's question;
   this answers what the levels already on it are worth, which is what a player looking at the piece wants to
   know. Kept here beside them rather than in the tooltip, because "what does +3 do" is a rules question and a
   second copy of it in a view is how the anvil and the tooltip end up disagreeing.

   A TOOL AND A PIECE OF GEAR ANSWER DIFFERENTLY, which is the whole reason this is worth spelling out on the
   card: reforging a pickaxe, axe or rod buys SPEED (forgeSpeed), and reforging armour or a weapon buys accuracy,
   strength and defence (forgeAdd). A Diamond axe +3 shows +4 accuracy on its own line because an axe can be
   swung at something, and none of that +4 came from the reforge. */
export const FIELD_NAME = { acc: "accuracy", str: "strength", def: "defence", tspd: "tool speed", cap: "capacity" };
export const forgeGainsAt = (key, lvl) => {
  if (!(lvl > 0)) return [];
  if (isTool(key)) { const v = forgeSpeedAt(key, lvl); return v ? [["tspd", v]] : []; }
  if (ITEMS[key]?.pouch) return [["cap", Math.min(FORGE.cap, lvl) * FORGE.pcap]];
  return ["acc", "str", "def"].map((f) => [f, forgeAddAt(key, lvl, f)]).filter(([, v]) => v > 0);
};
export const forgeGains = (c, key) => forgeGainsAt(key, forgeLevel(c, key));
/** The same, as a line a player reads: "+7.5% tool speed" or "+2 accuracy · +2 strength". */
export const forgeGainTextAt = (key, lvl) => forgeGainsAt(key, lvl)
  .map(([f, v]) => (f === "tspd" || f === "cap" ? `+${Math.round(v * 1000) / 10}% ${FIELD_NAME[f]}` : `+${v} ${FIELD_NAME[f]}`)).join(" \u00b7 ");
export const forgeGainText = (c, key) => forgeGainTextAt(key, forgeLevel(c, key));
/** A piece's name with its level on it. Takes the LEVEL, so a bag slot names what it is holding. */
export const forgeNameAt = (key, lvl) => `${ITEMS[key]?.name || key}${lvl > 0 ? ` +${Math.min(FORGE.cap, lvl | 0)}` : ""}`;
export const forgeName = (c, key) => forgeNameAt(key, forgeLevel(c, key));
export const forgeCost = (key) => { const sl = forgeSlot(key), it = ITEMS[key]; if (it?.forgeWith) return it.forgeWith; return sl && it?.tier ? [`${it.tier}_bar`, FORGE.bars(sl)] : null; };

// (the gambling gear and the dinners had recipes here until 2026-09-20: the gear drops now, and Dex sells the dinners)

/** Every recipe a station can run, hardest first so "the best thing you can make" is recipesAt()[0]. */
export const recipesAt = (station) => Object.values(RECIPES)
  .filter((r) => r.station === station || (station === "range" && r.station === "fire") || (station === "altar_nexus" && String(r.station).startsWith("altar_")) || (station === "blast" && r.station === "furnace"))   /* (2026-09-26) the Nexus: every altar's recipes; (2026-09-27) the Foundry's blast furnace: every furnace recipe */
  .sort((a, b) => b.lvl - a.lvl);
/** Do they have everything the recipe needs? */
export const canMake = (c, r) => lvlOf(c, r.skill) >= r.lvl && r.in.every(([k, n]) => countItems(c, [k]) >= n);

// the chance to burn at a cooking level: about half when you first can, nothing by burnStop; a range is kinder than a fire
/* GLASSWORK AND BREWING CAN GO WRONG (2026-09-24, the owner: "since alchemy vials will be so important, the
   rate of crafting them and crafting sand into vials needs to not be 100%"). It was 100%: I shipped all eighteen
   alchemy recipes with no failure at all.

   THE CURVE IS COOKING'S, because the game already has exactly one shape for "a skill you grow out of failing at"
   and inventing a second would be two answers to one question: half your attempts spoil at the level the recipe
   unlocks, falling away as you climb past it. What is different is the FLOOR. Cooking's burn reaches zero and
   food is never ruined again; glass is never that safe, so this bottoms out at SPOIL_FLOOR and stays there. A
   master alchemist wastes about one in fifty, for ever, which is what the owner asked for.

   AND A SPOILED BATCH LEAVES NOTHING. It rides the worker's `fail` path, not its burn path: the burn path hands
   you a "Burnt food" item, which is the right object for a fish and a nonsense one for a potion. */
export const SPOIL_FLOOR = 0.02;
export const spoilChance = (r, lvl) => {
  if (r == null) return 0;
  if (r.failStop == null) return r.fail || 0;
  if (lvl >= r.failStop) return SPOIL_FLOOR;
  return Math.max(SPOIL_FLOOR, 0.5 * (r.failStop - lvl) / Math.max(1, r.failStop - r.lvl));
};
export const burnChance = (r, lvl, range) => lvl >= r.burnStop ? 0 : Math.max(0.03, 0.5 * (r.burnStop - lvl) / Math.max(1, r.burnStop - r.lvl)) * (range ? 0.8 : 1);
export const EAT_MS = 1200;
// repeating skills stop after this long with no input from the player: the resources never run dry, but you have to be there
export const AFK_MS = 3 * 60 * 1000;
/* THE TOWER GETS A LONGER LEASH (2026-09-25). The three-minute rule exists to stop somebody standing in an
   aggressive area collecting kills with no input; a tower floor is the opposite case - a private room, one
   monster, a fifth of the tickets and no item drops at all, so there is nothing there to farm passively. And its
   fights are FOUR TO FIVE MINUTES by design, so the only thing keeping a climber "active" is eating, which means
   the window has to be longer than the longest stretch a floor can go without needing a meal.

   That stretch moves when anything about food or damage moves, and it already has twice: buffing the top fish from
   34 to 37 took a meal off some floors, and a meal fewer LENGTHENS the gap (it is the fight divided by meals plus
   one). At 162s against 180s it was inside the cutoff by less than the width of one swing. Five minutes is not a
   number to tune - it is "comfortably past any floor", and tools/eastscape-tower-check.mjs is what keeps it true.
   NOTE THAT FOOD IS WHAT POLICES THE TOWER, not this: a climber who genuinely walks away starves and dies. */
export const AFK_TOWER_MS = 5 * 60 * 1000;
/* (2026-09-24, the owner: "can you make sure users arent afking vs aggressive mobs? ... can we have an afk rule
   of 3 minutes like skilling?") FIGHTING IS ON THE LIST NOW, and it is the half of the fix you can see. The
   other half is in the worker: a mob that hits a player with no action HANDS THEM ONE — auto-retaliate — so the
   loop needed no input at all. A mob walks up, hits you, you are given the fight, you win it, the act clears
   when it dies, the next one walks up. Stopping the act after three minutes without also refusing that free
   retaliate would have changed nothing: the very next swing would have started it again. */
export const AFK_KINDS = { rock: "mining", vein: "mining", spot: "fishing", tree: "chopping", olive: "picking", wheat: "picking", cook: "cooking", smelt: "smelting", smith: "smithing", mob: "fighting" };

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
/* (2026-09-26) THE STARTER KITS: [item, how many, price for the lot]. Filled by the Archery and Magic switches
   below, drawn on Bom's counter as their own card. Both kits were first pushed into SHOP.sells, which nothing a
   player can reach reads (see the note in prizesOf), so neither could be bought until this list existed. */
export const KITS = [];
export const prizesOf = () => [
  ...KITS.map(([k, n, p]) => ({ id: `kit:${k}`, group: "kit", price: p, give: [k, n] })),
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
/* (2026-09-25) NOVA AND SINGULARITY. The ladder has been multiplying by about 2.4 a tier since diamond, and
   these keep that: a Nova cuirass is 600,000 tickets and a Singularity one 1,440,000. They are meant to be
   the thing somebody saves for. */
const TIER_COST = { bronze: 1, emerald: 4, diamond: 12, dragonstone: 30, onyx: 75, starfall: 180, eclipse: 420, nova: 1000, singularity: 2400 };
const GEAR_FOR_SALE = TIERS.flatMap((t) => Object.entries(GEAR_PRICE).filter(([k]) => ITEMS[`${t.key}_${k}`]).map(([k, p]) => [`${t.key}_${k}`, p * TIER_COST[t.key]]));
/* (2026-09-22) every tool rung is on the counter too — the owner: "add them as purchases for every level at Bom
   Trady as well". A tool is cheap against a suit of its own tier (an eclipse pickaxe is 8,400 to an eclipse
   cuirass's 252,000) because a tool is a KEY, not a prize: nobody should be shut out of a whole area saving up. */
/* (2026-09-25, the owner: "the tools need to be expensive at Bom ... somewhere in the middle of the price of the
   nova and singularity gear") So the top two rungs break the rule above: 250 puts them between a shield (300) and
   a sword (250) of their own tier instead of at a twentieth of one.

   BE AWARE OF WHAT THAT GATES. For every tier below this a tool is a KEY and nothing else, which is why it was
   cheap. At 80 and 90 the tool is the ONLY DOOR INTO THE TIER: nova ore is a Mining 80 rock, toolNeed(80) asks
   for the nova rung, and a nova pickaxe is smithed from nova bars - which need nova ore. The circle only opens at
   Bom's counter, so this price is the real entry fee for the whole tier, not a convenience. If it turns out to be
   a wall rather than a goal, this number is the one to move, not the gear. */
/* (2026-09-25, the owner: "lets make the tools just cost 20,000 for nova and 25,000 for singularity") FLAT
   PRICES, not a multiple of the tier. The multiplier that prices everything else would have put these at
   250,000 and 600,000, and a tool is the thing you need BEFORE you can earn at the tier it belongs to - so
   these two are written as the number the owner wants rather than derived from the gear beside them. */
const TOOL_PRICE = { nova: 20000, singularity: 25000 };
const TOOLS_FOR_SALE = TIERS.flatMap((t) => Object.keys(TOOL_KINDS).filter((k) => ITEMS[`${t.key}_${k}`]).map((k) => [`${t.key}_${k}`, TOOL_PRICE[t.key] || 20 * TIER_COST[t.key]]));
/* Dex's bar (2026-09-20): drinks and the scroll home. Priced so a lager about pays for itself at the table limit and
   costs you at small stakes: a drink is for someone betting big, and otherwise a tickets sink. `round` buys everyone on
   the floor who isn't already drinking a lager's worth of bets. */
/* (v93, the owner: "make all drinks/dinners cost 10x. theyre too cheap right now") Every drink and every dinner is ten times what it was,
   and so is the round for the room, which would otherwise have cost less than one lager. The scroll home is not a drink: still 50. */
export const BAR = { sells: [["beer", 400], ["cocktail", 900], ["whiskey", 1000], ["champagne", 2000], ["chickendinner", 800], ["steakdinner", 1500], ["porkchops", 1500], ["fishplatter", 3000], ["tp_scroll", 300]   /* (2026-09-25, the owner: "increase the price of casino teleports to 300 tickets"). BAR prices are NOT touched by the TIX_RATE halving at the end of this file, so 300 here is 300 in the game - unlike SHOP.buys, where the number written is halved before anybody sees it. */], round: { price: 3000, k: "beer", bets: 10 } };
export const SHOP = {
  // Brutus stocks tools and BRONZE ONLY. Everything above bronze is found, not
  // bought — otherwise the fastest route to the best gear in the game is to
  // stand at the copper vein and walk away, which is not a route anybody should
  // enjoy discovering.
  sells: [["rod", 20], ["pickaxe", 20], ["axe", 20], ...TOOLS_FOR_SALE, ...GEAR_FOR_SALE],
  buys: { emerald_ore: 30, diamond_ore: 50, dragonstone_ore: 80, onyx_ore: 120, willowlogs: 40, skyashlogs: 65, clanternfish: 18, cskyeel: 32,
    copper: 6, tin: 6, grimstone: 45, marble: 35, stardust: 120, logs: 4, yewlogs: 70, ashlogs: 28, hide: 8, bones: 2, /* feather: not bought (2026-09-25) - a component worth 0; the counter refuses it rather than paying nothing */ tusk: 10, husk: 4, pit: 1,
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
  /* THE GOLDEN SANDS AND ALCHEMY (2026-09-24). Every one of the map's raw materials shipped with NO value, which
     is worse than it sounds: VALUE is the authority the shop's buy prices are copied from, so none of them could
     be sold anywhere - and BOUNTY's loop prices a monster's drops out of this table, so a kill that dropped a
     shell was paid as though it had dropped nothing. Found when the owner asked for the fang and the shell to be
     a 10% grind and the ticket line did not move to compensate.

     The two ingredients are pitched above a common junk drop (staticfur is 21) because they come off band-40
     monsters one time in ten. Sand is deliberately cheap: four of them go into one large flask and the point of
     sand is volume. The POTIONS AND VIALS stay unpriced on purpose, which is what beer and a chicken dinner do -
     a consumable is something you buy or brew, not something the counter buys back. */
  /* THESE ARE PRE-TIX_RATE, like every literal in this table: the loop at the foot of the file halves them, so a
     6 here is a 3 in the game. Written at their intended EFFECTIVE value doubled - sand 6, the fang 24, the shell
     28, palm logs 14 to match skyash logs, the two fish 20 and 24 like the sky eel, and venom 90 because it only
     comes out of the Great Pyramid. First pass had them undoubled and palm logs were worth half a skyash log. */
  sand: 12, snakefang: 48, scarabshell: 56, palmlogs: 28, serpentvenom: 180,
  oasisperch: 40, nilecarp: 48, coasisperch: 48, cnilecarp: 56,
  skyashlogs: 28, dragonstone_ore: 30, skyeel: 40, onyx_ore: 40,                // Cloudreach
  perch: 10, catfish: 18, mudskipper: 28, bonefish: 28, ghostcarp: 36, cloudray: 48, stormmarlin: 44, thundersquid: 52,
  goldfish: 54, koi: 57,   /* (2026-09-24) between the Thunder squid (52, Fishing 58) and the Mudcat (58, Fishing 80) */   // v68: two fish a band (see the scenes' spots)
  sporecap: 12, markedcard: 22, sharktooth: 26, flashlight: 30, stormjelly: 34, staticfur: 42, hailshard: 46, wildsilk: 60, marrow: 50, marrow_arrowhead: 6, marrow_arrow: 12, grimcore: 120, voidfin: 80, grimscale: 104, gallowslogs: 124, glassgourd: 360, emberwheat: 520, starfruit: 800,   /* (2026-09-27) the wilderness's own */            // v68: what the new monsters leave
  receipt: 15, cobweb: 25, agilmark: 25,
  catalytic: 140, slagstone: 110, pinelogs: 40, bogwoodlogs: 95, mudcat: 58, bowfin: 66,   // the Trailer Park: the best gathering in the game, because it is the furthest walk and the meanest neighbours
                                                      // the Boneyard's leavings
  starfall_ore: 55, eclipse_ore: 90, voidglass: 70, voidlogs: 85, nova_ore: 130, singularity_ore: 185,
  /* (2026-09-25) THESE TWO NUMBERS PRICE THE WHOLE TOP OF THE GAME. Every bar, piece and tool above them
     is derived from RECIPES by the CRAFT_PAYS chain, so what Nova and Singularity cost, what they sell
     for, and what Bom charges for their tools all come out of here. */               // (v121) the Vault's
  chip_red: 250, chip_black: 1000, chip_gold: 5000,                             // fighting's windfalls
  chicken: 8, feather: 0 /* (2026-09-25) a component, not loot: at zero it no longer counts against the chicken's wage, which is what let it back onto the bird - see FLETCH */, bones: 3, beef: 12, hide: 14, tomatoe: 5, husk: 10, pork: 16, tusk: 18, pit: 2, mask: 60, monocle: 40, manifesto: 25
};
for (const [k, v] of Object.entries(SHOP.buys)) if (!(k in VALUE) && !ITEMS[k]?.slot) VALUE[k] = v;      // the closed areas keep Brutus's old prices until they reopen
/* FISHING is the one quiet job: you can't die, it never runs dry, and you can do it with a drink in your hand. A cast every
   `ms`, and your chance of a bite grows with your Fishing level exactly as mining's did. It is tuned to pay between two thirds and nine tenths of
   what fighting does at the same level (tools/eastscape-grind-sim.mjs): safe money is a little less money. It's also the
   only place lucky clovers come from now, and a fish is food as it comes out of the water. */
/* (2026-09-25, the owner: "the fish bite rate needs to be reduced by 33%") The CAP is cut too, not just the
   curve: the old one hit its ceiling at level 25 and stayed there for the next 74 levels, so trimming only
   the 0.4 + lvl*0.02 part would have left everyone above 25 fishing at exactly the old rate. */
/* GATHERING IS HALF AS GOOD OUT THERE (2026-09-25, the owner: "the success rate of ores/fishing/logs needs to
   be cut in half in the wilderness and deep wilderness so that users stick around longer and its more
   enticing"). Every swing, cast and chop in a pvp scene succeeds half as often, so the same haul takes twice as
   long and the person taking it is exposed for twice as long — which is the point: the Wilderness is only
   interesting if there is somebody in it to find.

   `pvp` IS THE TEST, not a list of scene names. It is true for exactly the Wilderness and the Deep Wild and for
   nothing else, and it is the same flag that decides whether you can be attacked at all — so a future zone
   where players can fight each other gets this automatically, which is the correct default. A list of names
   would have to be remembered.

   WORTH KNOWING IF THIS IS EVER REVISITED: it is a straight nerf to the one thing the Wilderness is good for.
   Grimstone is out there and onyx bars need it, so people must go regardless, and that is what makes the trade
   work at all — if a future wild resource is optional, halving its rate may simply mean nobody bothers. */
export const WILD_GATHER = 0.5;
export const gatherMul = (def) => (def && def.pvp ? WILD_GATHER : 1);
export const FISHING = { ms: 2600, chance: (lvl) => Math.min(0.9, 0.4 + lvl * 0.02) * 0.67, troutAt: 10, troutShare: 0.35, secondShare: 0.35 };
/** What a cast at this spot lands, for a fisher of this level: the spot's fish, or (secondShare of the time, once you are fish2lvl) its second one. r: a roll 0..1 */
export const fishAt = (ob, lvl, r) => (ob?.fish2 && lvl >= (ob.fish2lvl || 0) && r < FISHING.secondShare ? ob.fish2 : ob?.fish || "sardine");
export const CRAFT_PAYS = 2, CRAFT_STEP = 1.25;
{ // RAW[k]: the raw materials in one of a thing, and how many times it has been worked. Bars before the gear made of them.
  const RAW = Object.fromEntries(Object.entries(VALUE).map(([k, v]) => [k, { v, steps: 0 }]));
  for (let pass = 0; pass < 4; pass++) for (const r of Object.values(RECIPES)) {
    if (!r.in.every(([k]) => RAW[k])) continue;
    /* (2026-09-27) priceDiv: a recipe whose COST was raised without raising what it is WORTH. Every crafted thing is priced
       at CRAFT_PAYS x its raw inputs, so doubling the onyx-and-up smelts would have doubled what those bars sell for too, and a
       smelt would have printed exactly as many tickets per ore as before - the owner's complaint, untouched. Dividing here keeps
       the bar's raw value (and so its price, and the price of every piece made from it) where it was. */
    /* ONLY THE DOUBLED INPUTS are divided back: the bar of the tier below was not doubled and is already priced where it was,
       and dividing it again would halve it a second time (a nova bar would have sold for 750, not 988). */
    const raw = r.in.reduce((a, [k, n]) => a + RAW[k].v * n / (r.priceDiv && !/_bar$/.test(k) ? r.priceDiv : 1), 0) / (r.out[1] || 1), steps = 1 + Math.max(...r.in.map(([k]) => RAW[k].steps));
    RAW[r.out[0]] = { v: raw, steps }; VALUE[r.out[0]] = Math.round(CRAFT_PAYS * raw * CRAFT_STEP ** (steps - 1));
  }
}
{ // Brutus pays what the Cashier pays. Neither may pay what Brutus SELLS a thing for, or buying and selling it back is a money printer.
  const sold = Object.fromEntries(SHOP.sells);
  for (const [k, v] of Object.entries(VALUE)) { if (sold[k]) VALUE[k] = Math.min(v, Math.floor(sold[k] * 0.7)); if (VALUE[k] > 0) SHOP.buys[k] = VALUE[k]; else delete SHOP.buys[k]; }   /* (2026-09-25) a thing worth 0 (feathers) is not bought at all, rather than bought for nothing */
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
/* (2026-09-24) THE CRITIC pays 600, the biggest in the game bar The House. He is a slow kill — about seven
   Understudies of health — so per second he is WORSE than farming the yard next door, and that is deliberate:
   the reason to open his gate is the rare table, not the tickets. Without an entry here killFinds returns early,
   so he would drop no rares, hand out no casino finds, and not count toward a Lucky clover. */
/* (2026-09-24) THE CARNIVAL, 62-72. Between a Hail Drake (243) and The House (321) for the four, and the boss
   above both — he is a slow kill with a rare table, the same shape as the Boneyard’s Critic. Without an entry
   here killFinds returns early: no rares, no casino finds, and a Lucky clover would not count the kill. */
/* (2026-09-24, the owner: "the grinning man needs to give boosted tickets since it takes the carnival tickets,
   and carnival tickets are a 1% drop chance now") HE WAS PAYING 360 FOR A DOOR THAT COSTS 100 KILLS.
   The ticket does not cost tickets — you earn about 14,000 farming the hundred kills it takes to find one — so
   what the turnstile really charges is TWENTY-FIVE MINUTES. Against that, two and a half normal kills was an
   insult: there was no reason to spend a ticket rather than keep farming.
   4,000 (2,000 after the halving) is fourteen normal kills, and over a forty-second fight that is about 3,000 a
   minute against roughly 570 for farming the freaks outside. Five times better while you have a ticket, and
   nothing at all when you do not, which is what a key is supposed to feel like. */
export const BOUNTY = { weaver: 250, marrowhound: 310, grimlich: 440, pinhead: 252, tripled: 271, fatlady: 296, strongman: 318, grinner: 4000, critic: 600, chicken: 18, cow: 32, rotten: 39, olive: 38, hornworm: 51, boar: 53, highwayman: 40, goat: 45, gnasher: 80, moth: 74, taxwraith: 150, ghoul: 177, chandelier: 205, understudy: 250, ram: 266, angel: 352, revenant: 324, goose: 356,
  toadstool: 37, boneidle: 79, twister: 73, counter: 91, shark: 143, stagehand: 196, usher: 223, brainstorm: 247, seagoat: 329,
  /* THE 50+ BAND pays MORE than the tool asks: its reference wage goes flat at level 40 (there was no skilling past onyx), so left alone a level-70
     kill would pay a level-42 minute. These are the tool's numbers times 1 + 1.2% a level past 42, so the last band is worth reaching. The goose moved with them. */
  /* (2026-09-25, the owner: "mobs in the thunderhead need a nerf to their drops, by about 25%") All five
     of that map's monsters are exclusive to it, so this is cut on the BOUNTY literals and nothing else on
     any other map moves. They were the richest ground in the game by a distance - the balance tool had
     the Thunderhead paying 650-850 a minute against a band near 480 - and a quarter off brings them to
     the top of that band rather than far past it. Tickets are rebuilt from bounty by the loop further
     down, so this IS the drop; there is nothing else to change. */
  golem: 330, wolf: 355, drake: 412, house: 546,
  /* THE GOLDEN SANDS (2026-09-24, reported by the owner: "lucky clover kills arent counting in the golden sands").
     They were not, and not only luck: killFinds() opens with `if (!G.BOUNTY[mob]) return`, so a monster missing
     from this table gets NO rare roll, NO casino find and NO luck spent - the clover just sat there. Four new
     monsters shipped without an entry.

     BOUNTY is also the SINGLE SOURCE OF TRUTH for what a kill pays: the loop further down strips each monster's
     hand-written `tickets` drop and rebuilds it from its bounty minus the worth of everything else it drops. So
     the ticket ranges I invented for these four were never measured and were also paying too much - the Bandaged
     Debtor was worth 777 a minute and the Tomb Jackal 862, against a band that sits near 600.

     These are tools/eastscape-balance.mjs's own want$/kill, doubled because the literals in this table are
     pre-TIX_RATE and get halved below (measured: cobra 117, mummy 89, scarab 123, jackal 95). The two that carry
     an alchemy ingredient pay less in tickets for it, which is the table working as intended - the shell and the
     fang are part of the wage. */
  cobra: 234, mummy: 178, scarab: 246, jackal: 190,
  /* THE VAULT AND THE TOP OF THE TRAILER PARK (2026-09-24, found chasing "where is voidglass"). The SAME bug as
     the Golden Sands above, and nine monsters deep this time: every one of these shipped without a BOUNTY entry,
     so the loop below never rebuilt their tickets - and because each also has a LOOT entry, which REPLACES the
     hand-written `drops` wholesale, the ticket ranges their authors wrote were thrown away too. Nothing put them
     back. The Junkyard Dog was paying 10 tickets a MINUTE against a band that sits near 480; the Last Dealer, the
     hardest thing in the game at 92, paid 185.

     They also got no rare roll, no casino find and no luck spent, for the reason the Sands comment gives: a
     monster missing from this table is invisible to killFinds().

     Same method as the Sands, so these are not invented: tools/eastscape-balance.mjs's own want$/kill, doubled
     because the literals here are pre-TIX_RATE and are halved below.
     (measured: warden 163, pitboss 172, hoard 184, dealer 202, junkdog 170, possum 175, scrapper 190, gator 206,
     junkking 408. The ones carrying ore pay less in tickets for it - the ore is part of the wage.) */
  warden: 326, pitboss: 344, hoard: 368, dealer: 404,
  junkdog: 340, possum: 350, scrapper: 380, gator: 412, junkking: 816 };   // (v68: measured with tools/eastscape-balance.mjs, like the rest)   // (re-measured 2026-09-20 for half-length fights: a kill pays less, and there are twice as many)
/* HALF THE TICKETS (2026-09-23, the owner: "lets also reduce tickets dropped by half", then "halve the Cashier,
   leave prices"). ONE cut, applied to the three tables that every ticket in the world comes out of, at the point
   where they are finished being derived from each other:

     VALUE       what a thing is worth. The Cashier pays it, the labels over rocks and monsters quote it, and the
                 wiki prints it, so this is fishing's whole income, mining's, woodcutting's and farming's.
     SHOP.buys   what Brutus hands over. Kept equal to VALUE by the block above, so it has to move with it.
     BOUNTY      what a kill comes to. The loop below rebuilds each monster's "tickets" drop from BOUNTY minus what
                 its loot is worth, so halving both halves the ticket line exactly and leaves the 88/12 split alone.

   WHY ALL THREE TOGETHER. Halving only the mob drop was tried first and it broke the game's balance: gathering
   income is the Cashier, not a drop, so fishing did not move at all and went from 65% of fighting to 108% of it --
   the best farm at every band, which inverts the road tuning above. Scaling the three as one keeps every ratio
   the balance tools measured (fighting 1.15x mining, fish 67-90% of fight, the road's 4% a step, a made thing
   worth double its inputs) and simply moves the decimal point.

   PRICES DO NOT MOVE. SHOP.sells, BAG_UPGRADES, the island tiers and Ronde's vanity are all untouched, so every
   sink is twice as deep in hours -- which is the point. The Eclipse set and five bag upgrades were about 25 hours
   of top-band income and are now about 50.

   AND THIS IS THE ZCOIN FIX. DEX converts at a FIXED 1,000 tickets to the coin, so halving what a ticket is
   earned at halves EastScape's ZCoin minting too -- and minting, not drops, was 45 of the 50-an-hour allowance.

   NOT INCLUDED, deliberately: the daily jobs, the prize wheel and achievement rewards. Those are one-off or
   once-a-day rewards rather than the grind, they are small against it (the three jobs together are about 20
   minutes of Boneyard fighting), and two of them were tuned up on purpose. Halve them here if the flow is still
   too high; that is the next knob, with JACKPOT_KILL after it. */
/* ============================================================ THIEVING: the Thieves' Guild

   The tenth skill, and the first that cannot be fought. A MARK IS A NODE, NOT A MONSTER: the guild's members are
   clicked like a rock, and the pick runs on the same `act` loop mining and fishing use, so nothing here touches
   the combat code. That is also why it is a real alternative path — the rooms gate on THIEVING alone, with no
   level band, so somebody who never wants to swing a sword has somewhere to go.

   THE RULE THAT MATTERS, and the reason for `per`: success rises with your level over the mark's, exactly as
   mining's does. Agility takes 557 hours to reach 99 because a lap pays a flat 222 xp and nothing about it
   compounds — the skill sim measured its rate moving 12% across 98 levels — and that mistake is not being made
   twice. Here both axes move: better rooms pay more per pick AND you land more of them as you climb.

   AND THE ONE THE ECONOMY RESTS ON: a mark NEVER drops tickets. Thieving pays instantly with no input cost —
   unlike smithing, which eats ore, or fishing, which eats a cast per fish — so a direct ticket drop would make
   it the best faucet in the game and undo the halving TIX_RATE exists to do. Everything a mark carries is a
   GOOD, so the Cashier price is the lever and TIX_RATE below already reaches it. Keep it that way. */
export const THIEF = {
  ms: 2400,            // one attempt
  base: 0.55,          // chance against a mark of your own level
  per: 0.02,           // ...plus this per level above it, mirroring mining's curve
  cap: 0.90,           // and never better than this, also mirroring mining
  stun: [2000, 3500],   /* (2026-09-23) was 3-5s. The skill sim charges this on every miss, and at 3-5s plus losing an item a catch was the single biggest cost in the skill - most of the difference between 96 hours to 99 and 90 was standing still. */  // caught: shaken off for this long. NOT a hospital bill — that is DEATH's job and is keyed to areas
  permit: 50000,       // what the fence charges. ~18 hrs for a new player, ~1.4 hrs at Combat 40, measured on the skill sim
  rooms: [1, 25, 50, 75],
  /* (2026-09-23, the owner: "first thieving door needs to open at level 10") THE DOORS AND THE MARKS ARE NOT THE
     SAME LADDER. A gate used to ask for exactly the Thieving level of the marks behind it, so you only ever saw
     a room at the moment you could work it. Opening the first at 10 gives a new thief somewhere to walk to and
     something to look at fifteen levels before they can pick it, which is a better thing to have in front of you
     than a wall. One per wall, each at or below the marks it leads to. */
  gates: [10, 50, 75],
  /* (2026-09-23) THE SKILL SHIPS DARK. The rules and the server side are finished and tested; the PAGE cannot
     draw a mark yet (no KIND_OF entry, no sprites), so a reachable guild would be a room of invisible people.
     This flag hides the only three things a player can see - the door in the Yard, the permit on the shop's
     shelf, and the scene being enterable at all - while everything else stays in place and under test. Flip it
     to true in the same commit as the client. The Crypt chest's permit line rides this too. */
  /* THE CLEAN RUN (2026-09-25, a player: thieving "feels like a slog"). Consecutive lifts count, and every
     `streakEvery`-th one pays TWICE. Getting caught puts you back to nought.

     It is here because more money and more marks fix the arithmetic of the skill and not the LOOP, which was
     click, wait 2.4s, win or get punished - mining with a penalty bolted on and no shape to it. A run gives the
     loop an arc: three clean and the next one matters, and the stun stops being only a cost and starts being the
     thing you are protecting. It rides the same idea as the swing ladder and is safe for the same reason - you
     cannot fake a success, so there is nothing to farm here that is not just playing well.

     Five is chosen so a run is reachable at the 55% chance you enter a room on (about 5% of runs) and routine at
     the 90% cap (about 59%), which is the curve the whole skill is already built around. */
  streakEvery: 5,
  live: true
};
/* (2026-09-27, the owner: "the drops from mobs across the board is too much") THE BAND. Every bounty above was priced so that a minute
   of fighting pays 1.15x a minute of mining at the same level; this brings the non-boss monsters to 1.0x - fighting pays what
   skilling pays, and the finds on top are what make it the better job. The bosses keep their numbers: each is a key or a slow kill
   priced on its own. tools/eastscape-balance.mjs measures the result; its FIGHT_OVER_SKILL moved with this. */
export const BOUNTY_BAND = 0.87;
for (const t of Object.keys(BOUNTY)) if (!BOSSES.has(t)) BOUNTY[t] = Math.round(BOUNTY[t] * BOUNTY_BAND);
/** The chance this character lands a pick on a mark of level `lvl`. */
/* (2026-09-24, the owner: the curve "is a little much, but we need to add gear to compensate for it instead of
   nerfing it") GEAR ADDS TO THE CHANCE AND THE CEILING STILL HOLDS. A bonus only helps while you are climbing,
   which is exactly the stretch that drags - you enter a room at 55% and leave it at the 90% cap. Modelled, chance
   alone is worth about 8% off the total; the other half of the fix is that the pick now respects fx.speed like
   every other skill in the game, which it never did. */
export const pickChance = (c, lvl, steal = 0) => Math.min(THIEF.cap, THIEF.base + (lvlOf(c, "thieving") - (lvl | 0)) * THIEF.per + (steal || 0));

ITEMS.thieves_permit = { name: "Thieves' permit", icon: "📜", ex: "A guild chit, signed by somebody who does not exist. The door wants to see it once and never again." };
/* what marks carry: four fence goods, one per room, and the stolen materials below */
ITEMS.brass_button = { name: "Brass button", icon: "🔘", ex: "Still warm. Somebody's coat is going to gape all the way home." };
ITEMS.pocket_watch = { name: "Pocket watch", icon: "⌚", ex: "Running four minutes fast, which its last owner will notice before they notice it is gone." };
ITEMS.stolen_signet = { name: "Stolen signet", icon: "💍", ex: "The crest has been filed half off. Whoever did it gave up halfway, which is the guild all over." };
ITEMS.blackmarket_ledger = { name: "Black-market ledger", icon: "📕", ex: "Every page is a name and a number. The fence pays well for it and asks nothing." };
/* the stolen MATERIALS: each one feeds the anvil, which is the point of them */
ITEMS.whetgrit = { name: "Whetgrit", icon: "⚪", ex: "Grit swept from under a guild whetstone. Worth more than the blades it sharpened." };
ITEMS.quench_salts = { name: "Quenching salts", icon: "🧂", ex: "They hiss instead of steaming. Nobody at the guild will say where they come from." };
ITEMS.seal_wax = { name: "Guild seal wax", icon: "🕯️", ex: "Deep red, and it never quite sets. A master's mark presses into it and stays." };
/* ...and the three things the anvil makes of them. All three are spent on ONE reforge attempt. */
ITEMS.temper = { name: "Temper", icon: "🔥", ex: "Bank it into the fire before you swing. The metal is kinder for it." };
ITEMS.flux = { name: "Flux", icon: "🫙", ex: "It holds a failing piece together long enough to fail gracefully. It will not make one succeed." };
ITEMS.masters_seal = { name: "Master's seal", icon: "🏅", ex: "Permission, in wax, to take a thing one step past where it is meant to stop. Once." };

/* WHAT A MARK CARRIES. One roll per successful pick, by weight. Room 4 also carries the Vault three —
   starfall_ore, eclipse_ore and voidglass are otherwise the only materials in the game with a single source, and
   voidglass has no monster drop at all, so the Quartermaster is a second route to the top of smithing rather
   than the only one. Nothing in any of these tables is tickets; see the note above. */
/* (2026-09-24, the owner, after a group actually played it) XP UP 25% ACROSS EVERY ROOM: 15/45/110/200 became
   19/56/138/250. The first figures were simulated and nobody had picked a pocket when they were set; this is the
   first number on the skill that came from people playing rather than from a model. */
export const MARKS = {
  lifter:  { name: "Apprentice Lifter", lvl: 1,  xp: 19,  room: 0, look: { hair: "#3a2a1a", shirt: "#6a6250", pants: "#3a3630" },
    drop: [["brass_button", 0.80], ["whetgrit", 0.20]] },
  grifter: { name: "Grifter", lvl: 25, xp: 56, room: 1, look: { hair: "#1a1a1a", shirt: "#4a3a6a", pants: "#2a2438" },
    drop: [["pocket_watch", 0.75], ["quench_salts", 0.20], ["whetgrit", 0.05]] },
  fixer:   { name: "The Fixer", lvl: 50, xp: 138, room: 2, look: { hair: "#6a6a72", shirt: "#2a4a52", pants: "#1e2e34" },
    drop: [["stolen_signet", 0.72], ["seal_wax", 0.18], ["quench_salts", 0.10]] },
  quarter: { name: "The Quartermaster", lvl: 75, xp: 250, room: 3, look: { hair: "#d8c8a0", shirt: "#6a2a2a", pants: "#3a1e1e" },
    drop: [["blackmarket_ledger", 0.70], ["starfall_ore", 0.12], ["eclipse_ore", 0.09], ["voidglass", 0.06], ["seal_wax", 0.03]] },

  /* (2026-09-25, a player: "having to work this room to hit 50 in order to get to the next room feels like a
     slog") FOUR MORE MARKS, and the reason is the twenty-five level gap rather than the numbers in it. With marks
     only at 1, 25, 50 and 75, the sim's answer to "what is best at level 20" was still the Apprentice Lifter: a
     level 25 mark is visible from level 10 and not worth picking until about 40, because at a 45% chance the stun
     on a miss costs more than the better loot pays. So the middle of the skill was one room and one face for
     twenty-odd levels.

     NONE OF THE ORIGINAL FOUR MOVED. These sit between them - 15, 40, 62, 90 - so nothing anybody is working
     today changes, no room gate changes, and there is always a next target within about a dozen levels. Each
     shares a room with the mark below it and carries a taste of the NEXT room's good, which is what makes
     graduating feel like a promotion rather than a wall coming down.
     xp follows the curve the first four set (19/56/138/250), interpolated rather than invented. */
  cutpurse:    { name: "Cutpurse", lvl: 15, xp: 36, room: 0, look: { hair: "#2a2018", shirt: "#7a6a4a", pants: "#332e26" },
    drop: [["brass_button", 0.60], ["whetgrit", 0.30], ["pocket_watch", 0.10]] },
  shill:       { name: "The Shill", lvl: 40, xp: 95, room: 1, look: { hair: "#4a3a2a", shirt: "#3a4a6a", pants: "#242a38" },
    drop: [["pocket_watch", 0.60], ["quench_salts", 0.25], ["stolen_signet", 0.15]] },
  housebreaker:{ name: "Housebreaker", lvl: 62, xp: 182, room: 2, look: { hair: "#52525a", shirt: "#2a5244", pants: "#1e3028" },
    drop: [["stolen_signet", 0.60], ["seal_wax", 0.25], ["blackmarket_ledger", 0.15]] },
  ringleader:  { name: "The Ringleader", lvl: 90, xp: 337, room: 3, look: { hair: "#e8e0c8", shirt: "#4a2a5a", pants: "#2a1830" },
    drop: [["blackmarket_ledger", 0.62], ["starfall_ore", 0.13], ["eclipse_ore", 0.10], ["voidglass", 0.08], ["seal_wax", 0.07]] }
};
/* THE DITCHED SET (2026-09-24). Four pieces of a thief's kit somebody threw in the water rather than be caught
   holding it, FISHED BACK UP - so Fishing finally feeds something other than Cooking, and a thief has a reason to
   care about a skill they would otherwise never touch. Worn in ordinary armour slots, so the trade is real:
   nothing in the guild fights back, which is exactly why giving up your combat gear costs nothing while you are
   in there and everything the moment you leave.

   A full set is +10% on the pick and +12% speed, taking a 1-99 climb from about 90 hours to 76, and to 73 with a
   speed pet as well - level with Woodcutting. UNGEARED IS UNCHANGED AT 90: this compensates, it does not nerf.
   Both numbers sit inside OUT_CAP (steal 0.15, speed 0.2), so the set plus everything else cannot run away. */
export const DITCHED = ["ditched_hood", "ditched_coat", "ditched_gloves", "ditched_boots"];
ITEMS.ditched_hood = { name: "Ditched hood", icon: "\u{1F9E2}", slot: "helm", fx: { steal: 0.025, speed: 0.03 }, ex: "Wet through and smells of the river. Nobody asks you to take it off." };
ITEMS.ditched_coat = { name: "Ditched coat", icon: "\u{1F9E5}", slot: "body", fx: { steal: 0.025, speed: 0.03 }, ex: "Somebody went in the water rather than be caught wearing this. It still fits." };
ITEMS.ditched_gloves = { name: "Ditched gloves", icon: "\u{1F9E4}", slot: "gloves", fx: { steal: 0.025, speed: 0.03 }, ex: "Soft, thin, worn through at the fingertips. Not from work." };
ITEMS.ditched_boots = { name: "Ditched boots", icon: "\u{1F45E}", slot: "boots", fx: { steal: 0.025, speed: 0.03 }, ex: "Soft soles. You can hear how quiet they are just holding them." };
/** How often a catch turns one up: about one piece every two hours of steady fishing, so a set is an evening. */
export const DITCHED_ODDS = 1 / 2500;

/* Where the chamber walls stand, and which mark lives in which chamber. The guild's build() reads both. */
export const GUILD_WALLS = [12, 22, 32];
export const GUILD_ORDER = ["lifter", "grifter", "fixer", "quarter"];
/** Which chamber (0..3) an x sits in. The doorway tiles belong to the room they lead INTO. */
export const guildRoom = (x) => GUILD_WALLS.reduce((n, wx) => (x > wx ? n + 1 : n), 0);

/** One item from a mark's table. The weights are a distribution, so they must sum to 1; the content check insists. */
export const markDrop = (key, r = Math.random) => {
  const t = MARKS[key]?.drop; if (!t) return null;
  let x = r(); for (const [k, w] of t) if ((x -= w) < 0) return k;
  return t[t.length - 1][0];
};

/* The fence buys what marks carry. These are PRE-halving: TIX_RATE below cuts them like everything else, which
   is exactly why the drops are goods.

   MEASURED WITH THE SKILL SIM, NOT WITH ARITHMETIC, and that is the note worth keeping. Priced by hand off
   "picks an hour x drop value" these rooms looked like 3k/8k/13k/24k an hour. The sim - which charges the hop to
   the next mark and the stun on every miss - said 1.5k/4.4k/7.2k/13.6k for the very same numbers. The figures
   below are x1.5 of that first guess and measure about 2.3k / 6.7k / 11.1k / 17.6k, against mining's 17.7k at
   level 40 and 23.6k at 60. A top-room thief earning roughly what a mid-level miner does is deliberate: the
   guild's real payment is the MATERIALS, and a room where nothing fights back should not also be the best money
   in the game. Re-measure with `node tools/eastscape-skill-sim.mjs` rather than re-deriving it. */
/* The ledger is priced at what is LEFT once the Vault ore is counted. Room 4 also drops starfall, eclipse and
   voidglass, and the Cashier already buys all three (28/45/35 after the cut) because the Vault's own economy set
   those prices - so a quarter of the Quartermaster's pay is ore the player was supposed to SMELT. At 56 the room
   came out at 30.6k tickets an hour, near enough to combat's 37k at level 40 to make the guild the farm. 38
   lands it at ~24k, which leaves the ore worth stealing for what it makes rather than for what it fences. Do not
   "fix" this by pricing the ore down: that number belongs to the Vault, not to this skill. */
/* THE PERMIT IS SOLD HERE rather than by a new NPC behind a new screen: it is an ITEM, so the shop's existing buy
   path, the bag, the bank and the market all carry it with nothing added. The Crypt chest drops one rarely too,
   and because both routes are the SAME item the market prices itself and 50,000 becomes the ceiling nobody
   actually pays. Spending it at the guild door is what admits you, permanently, so a used permit cannot be
   resold. Pushed rather than written into SHOP above, because SHOP is declared before THIEF is. */
if (THIEF.live) {
  SHOP.sells.push(["thieves_permit", THIEF.permit]);
  SKILL_GROUPS.find((g) => g.name === "Skilling")?.keys.push("thieving");   /* the skills panel draws from this; the skill stays in SKILLS either way so every save carries its xp and every name lookup resolves */
  OPEN.add("guild");
                 /* a scene is not enterable until it is in OPEN; the door answers "Room's shut" otherwise */
  SCENES.guild.wikiHide = false;     /* the closed-areas sweep above already hid it, because it was not in OPEN when that ran */
}
/* (2026-09-25, a player: "the thieving drops feel kinda lacklustre compared to other professions like tickets
   gain per time spent esp if you have to pay the fee to get in") He was right, and the sim said so louder than he
   did: thieving was the WORST-PAID skill in the game at every level above 1 - 4,460 tickets an hour at 20 against
   fighting's 16,373 - and the only one that charges to get in.

   Fishing is deliberately 67-90% of fighting because safe money is a little less money. Thieving is not safe: it
   stuns you on a miss and it took 50,000 tickets off you at the door. So the fence now pays roughly double at the
   top two rooms and half again at the bottom two, which is what puts the skill in fishing's band rather than
   under it. Re-measure with tools/eastscape-skill-sim.mjs, not by eye. */
Object.assign(SHOP.buys, { brass_button: 18, pocket_watch: 45, stolen_signet: 102, blackmarket_ledger: 114 });

/* The three consumables. They are ANVIL recipes on purpose: the stolen line is meant to be crucial to smithing,
   so it is smithing that turns it into anything, and a thief who never smiths still has someone to sell to. */
recipe("make_temper", { skill: "smithing", station: "anvil", lvl: 20, ms: 2600, xp: 60, in: [["whetgrit", 2], ["bronze_bar", 1]], out: ["temper", 1] });
recipe("make_flux", { skill: "smithing", station: "anvil", lvl: 40, ms: 2600, xp: 150, in: [["quench_salts", 2], ["whetgrit", 1]], out: ["flux", 1] });
/* a seal EATS a flux, so it can never be commoner than one */
recipe("make_seal", { skill: "smithing", station: "anvil", lvl: 60, ms: 2600, xp: 400, in: [["seal_wax", 1], ["flux", 1]], out: ["masters_seal", 1] });

/* ============================================================ FLETCHING (2026-09-25)
   The owner: "lets get started building the art ... then lets build out the items, put them as drops, add the
   skill to all the right pages ... then i can test it live and see how it feels." This block is the skill's
   rules. Its server side is the `fletch` kind in index.js and the ranged path in the mob swing; its pictures
   came from tools/eastscape-fletch-art.mjs.

   WHY IT IS BUILT ON TOP OF OTHER SKILLS RATHER THAN BESIDE THEM. Fletching cannot make a single arrow on its own,
   and that is the point of adding it. An arrow is three things from three places:
       a SHAFT      cut from logs            -> woodcutting, which until now had exactly one use (charcoal)
       a HEAD       hammered from a bar      -> smithing, at the anvil, not here
       a FEATHER    off a bird               -> fighting: chickens at the bottom, the Thunder Goose in bulk
   So every arrow is a woodcutter's afternoon and a smith's bar and somebody's chicken. Structural, not decorative:
   none of the three can be substituted for another.

   THE TWO-KNOB LADDER, which is what makes ranged feel different from melee. In melee one item is your speed AND
   your damage. Here the BOW sets how fast you draw and how far you reach, and the ARROW sets how hard it lands —
   so a fletcher chooses between an expensive bow with cheap arrows and a cheap bow with a quiver of the good
   ones, and arrows are the game's first real consumable tier: a permanent sink for logs, bars and feathers.

   THE QUIVER (the owner: "they should match the tiers / names of the bow, be in the offhand, and you load your
   arrows into them so you can hold a large stack and go around shooting"). It wears the SHIELD slot, so a bow is
   a two-handed choice against a shield, which is the right trade. Loaded arrows live on the character as
   C.quiver = { k, n } — not in the bag — and a shot draws from there first. Capacity climbs with the wood.

   GEMS (the owner: "some mining ores need to have a small chance to drop gems ... so users can make jewelry
   tipped arrows for extra damage"). Four, NOT named diamond or emerald because those are already metal tiers
   and "diamond arrow" would mean two things. Each gem tips the arrows of the metals it comes out of, so the
   ore you are already mining is the ore that drops the stone you tip its arrows with.

   THE TEMPLATE FOR MAGIC (the owner: "think about how you can templatize this for a future skill: mage/magic
   and wizardry"). Everything ranged here is written as a LAUNCHER and its AMMO rather than as a bow and an
   arrow: launcherOf(c) is whatever is in the weapon slot with `launcher`, ammoOf(c) is whatever it fires from
   the offhand pouch or the bag, and the swing reads range and damage off those two. A staff is a launcher with
   `launcher: { range, ammo: "rune" }`, a rune is ammo, a rune pouch is the quiver with a different picture.
   None of the combat code below will need to change to add it — only the item rows.
   ============================================================ */
export const FLETCH = { live: true, perLog: 15, perBar: 15, station: "fletcher", quiverSlot: "shield",
  /* how many shafts a log gives, by wood: the reason to cut a better tree for fletching. The arrow is the same
     either way, you just get more of them per trip. */
  shaftsPerLog: [15, 18, 21, 25, 28, 30, 34, 38, 45],
  /* how many arrows a quiver of each wood holds */
  quiverCap: [100, 150, 200, 300, 400, 500, 650, 800, 1000],
};
SKILLS.fletching = { name: "Fletching", icon: "🪶" };
/* ARCHERY (2026-09-25, the owner: "we need an Archery combat skill, not just fletching ... Damage for XP is calculated in
   the same way as melee, damage = XP ... Fletching is just for the making"). It is a second COMBAT skill: with a launcher
   in hand every roll that read Combat reads Archery instead (styleOf, below in the combat maths), a hit pays Archery
   the xp Combat would have had, and the combat level takes the higher of the two. Fletching gates what you can MAKE;
   Archery gates what you can DRAW. The rough shortbow, the rough quiver and bone arrows are all Archery 1 and Brutus
   sells them, so a new player can pick up a bow before they have cut a log. */
SKILLS.archery = { name: "Archery", icon: "🏹" };
export const ARCHERY = {
  bigBonus: 0.2,            // arrows do a fifth more to size l / xl monsters: a boss is hard to miss
  afkMs: 8 * 60 * 1000,     // the fight AFK timer for an archer with a LOADED quiver (melee stays at AFK_MS)
  retarget: true,           // "stand and shoot": when the target dies, draw on the next of the same kind inside reach
  useLvl: { short: [1, 20, 30, 45, 54, 60, 72, 84, 92], long: [5, 25, 35, 50, 57, 64, 76, 88, 96], quiver: [1, 18, 28, 43, 52, 58, 70, 82, 90] },   // Archery to draw, by wood: the fletching gate, except rough is 1 / 5 / 1
};
/* the bulk source of feathers (the owner: "add in alchemy recipes for making bulk feathers. take a vial and mix it with
   feathers + one other thing (something magic) and it creates 15 feathers every time"). Net twelve a vial. */
recipe("brew_feathers", { skill: "alchemy", station: "cauldron", ms: 2200, lvl: 5, xp: 14, in: [["small_vial", 1], ["feather", 3], ["sporecap", 1]], out: ["feather", 15] });
recipe("brew_ink_grim", { skill: "alchemy", station: "cauldron", ms: 2200, lvl: 60, xp: 130, in: [["medium_vial", 1], ["grimcore", 1], ["grimstone", 2]], out: ["ink_void", 2] });   /* (2026-09-27) Void ink without a seed: a Grim Lich's core and the wild's grimstone */
STATIONS.fletcher = { skill: "fletching", verb: "fletch", name: "fletching table", auto: false, kind: "fletch" };

/* the woods. `wc` is the Woodcutting level of the tree the log comes off; the fletching levels sit a little above
   it, because you should be cutting a wood comfortably before you are shaping it. */
const WOODS = [
  { log: "logs",        name: "Rough",     wc: 1,  shaft: 1,  short: 5,  long: 10, quiver: 3 },
  { log: "willowlogs",  name: "Willow",    wc: 15, shaft: 15, short: 20, long: 25, quiver: 18 },
  { log: "ashlogs",     name: "Deadwood",  wc: 20, shaft: 25, short: 30, long: 35, quiver: 28 },
  { log: "yewlogs",     name: "Yew",       wc: 35, shaft: 40, short: 45, long: 50, quiver: 43 },
  { log: "palmlogs",    name: "Palm",      wc: 45, shaft: 50, short: 54, long: 57, quiver: 52 },
  { log: "skyashlogs",  name: "Skyash",    wc: 45, shaft: 55, short: 60, long: 64, quiver: 58 },
  { log: "pinelogs",    name: "Rustpine",  wc: 65, shaft: 68, short: 72, long: 76, quiver: 70 },
  { log: "voidlogs",    name: "Vaultwood", wc: 75, shaft: 80, short: 84, long: 88, quiver: 82 },
  { log: "bogwoodlogs", name: "Bogwood",   wc: 80, shaft: 86, short: 92, long: 96, quiver: 90 },
];
/* one arrow tier a bar tier. `head` is the SMITHING level to hammer heads (the tier's own gate); `arrow` is the
   FLETCHING level to finish them, and it sits AT the head's gate so a fletcher is never offered an arrow whose
   head they cannot yet be handed. The bone arrow, below all of this, needs no metal at all. `str` is what the
   arrow adds to a hit, and it sits UNDER the melee ladder's +6..+38 on purpose: a bow's damage is bow plus
   arrow, and if the arrow alone matched a sword the bow would be decoration. */
const ARROW_METALS = TIERS.map((t, i) => ({ key: t.key, name: t.name, bar: `${t.key}_bar`, head: t.gate,
  arrow: [10, 20, 30, 40, 50, 60, 70, 80, 90][i], str: [3, 6, 9, 12, 16, 20, 25, 30, 36][i] }));

/* the four gems: which ores drop them, which arrows they tip, and what the tipping adds. The band a gem tips
   is the band of metals it comes out of, so the ore you mine is the ore whose arrows you tip. Rarer than a
   named rare (1%) but not a chase: about one rock in seventy. */
export const GEMS = [
  { key: "ruby",     name: "Ruby",     lvl: 15, ores: ["copper", "tin", "emerald_ore"],                    tips: ["bronze_arrow", "emerald_arrow"],                    str: 8,  drop: 0.014 },
  { key: "sapphire", name: "Sapphire", lvl: 35, ores: ["diamond_ore", "dragonstone_ore"],                 tips: ["diamond_arrow", "dragonstone_arrow"],               str: 14, drop: 0.014 },
  { key: "topaz",    name: "Topaz",    lvl: 55, ores: ["onyx_ore", "starfall_ore"],                        tips: ["onyx_arrow", "starfall_arrow"],                     str: 22, drop: 0.014 },
  { key: "opal",     name: "Opal",     lvl: 75, ores: ["eclipse_ore", "nova_ore", "singularity_ore"],      tips: ["eclipse_arrow", "nova_arrow", "singularity_arrow"], str: 32, drop: 0.014 },
];
/** ore -> [[gem, chance]]: what a successful swing at that ore may also turn up (index.js rolls it) */
export const GEM_DROP = {};
for (const g of GEMS) for (const ore of g.ores) (GEM_DROP[ore] ||= []).push([g.key, g.drop]);

/* ---------------- the items */
ITEMS.shaft = { name: "Arrow shaft", icon: "🪶", ex: "A stick, straightened. Any wood makes the same shaft — a better tree just makes more of them." };
ITEMS.bowstring = { name: "Bowstring", icon: "〰️", ex: "Twisted cowhide. Every bow needs one." };
ITEMS.silkstring = { name: "Silk bowstring", icon: "🕸️", ex: "Spun from a cobweb the size of a door. Quieter, and it does not stretch." };
ITEMS.bone_arrowhead = { name: "Bone arrowhead", icon: "🦴", ex: "Knapped from a bone. It will do until you know a smith." };
ITEMS.bone_arrow = { name: "Bone arrow", icon: "🎯", cap: 1000, req: { skill: "archery", lvl: 1 }, ammo: { str: 1 }, ex: "Barely an arrow. It is what everybody starts with." };
/* (2026-09-27) THE WILD'S OWN: what the three wilderness monsters carry and what it makes. See the MOBS note on them. */
ITEMS.wildsilk = { name: "Wild silk", icon: "\u{1F578}\uFE0F", ex: "A Wild Weaver's spinning, strong as wire. One coil is four silkstrings at the fletching table." };
ITEMS.marrow = { name: "Marrow", icon: "\u{1F9B4}", ex: "The glowing marrow of a Marrow Hound. Knaps into fifteen arrowheads that bite." };
ITEMS.marrow_arrowhead = { name: "Marrow arrowhead", icon: "\u{1F53A}", ex: "Bone-white and barbed, with a light in it. Fletch it to a shaft." };
ITEMS.marrow_arrow = { name: "Marrow arrow", icon: "\u{1F3AF}", cap: 1000, req: { skill: "archery", lvl: 45 }, ammo: { str: 14 }, ex: "The Wilderness's own arrow, between dragonstone and onyx. Only a Marrow Hound makes the heads." };
ITEMS.grimcore = { name: "Grimcore", icon: "\u{1F52E}", ex: "A knot of the Deep Wild's own dark, cut from a Grim Lich. With two grimstone it brews Void ink." };
for (const g of GEMS) ITEMS[g.key] = { name: g.name, icon: "💎", ex: `A cut ${g.name.toLowerCase()}. It tips an arrow, and a jeweller would pay for it.` };
for (const w of WOODS) {
  const i = WOODS.indexOf(w);
  /* A BOW IS A WEAPON, so it wears the weapon slot and carries a speed the same way a gladius does. `launcher`
     is what marks it ranged and holds the reach and what it fires; `bow: true` is just a name for the page. */
  ITEMS[`${w.log}_shortbow`] = { name: `${w.name} shortbow`, icon: "🏹", slot: "weapon", speed: 1800, acc: 6 + i * 4, launcher: { range: 4, ammo: "arrow" }, bow: true,
    req: { skill: "archery", lvl: ARCHERY.useLvl.short[i] }, ex: "Quick to draw and short in the reach. Feed it cheap arrows." };
  ITEMS[`${w.log}_longbow`] = { name: `${w.name} longbow`, icon: "🏹", slot: "weapon", speed: 2800, acc: 4 + i * 4, str: 2 + i * 2, launcher: { range: 6, ammo: "arrow" }, bow: true,
    req: { skill: "archery", lvl: ARCHERY.useLvl.long[i] }, ex: "Slow, heavy and it reaches two tiles further. Worth good arrows." };
  ITEMS[`${w.log}_quiver`] = { name: `${w.name} quiver`, icon: "🎒", slot: "shield", pouch: { ammo: "arrow", cap: FLETCH.quiverCap[i] },
    req: { skill: "archery", lvl: ARCHERY.useLvl.quiver[i] }, ex: `Holds ${FLETCH.quiverCap[i]} arrows of one kind in the offhand. Load it from your bag: a bow shoots only what is in its quiver.` };
}
/* (2026-09-25, the owner: "are bows/quivers reforgable? they should be"). In the wood they are made of, not bars: twice
   the logs the piece took to make, at the Fletching level it took to make it. Reforged at the fletching table (or the
   anvil, which already has the panel). A bow grows accuracy and strength like any weapon; a quiver grows room. */
for (const w of WOODS) for (const [kind, lvl] of [["shortbow", w.short], ["longbow", w.long], ["quiver", w.quiver]]) {
  const it = ITEMS[`${w.log}_${kind}`]; if (!it) continue;
  it.forgeWith = [w.log, kind === "longbow" ? 6 : kind === "shortbow" ? 4 : 2]; it.forgeReq = { skill: "fletching", lvl };
}
for (const m of ARROW_METALS) {
  ITEMS[`${m.key}_arrowhead`] = { name: `${m.name} arrowhead`, icon: "📍", ex: `Hammered from a ${m.name.toLowerCase()} bar, fifteen at a time. Fletch them onto shafts.` };
  ITEMS[`${m.key}_arrow`] = { name: `${m.name} arrow`, icon: "🎯", cap: 1000, ammo: { str: m.str }, req: { skill: "archery", lvl: m.arrow }, ex: `Spends one per shot. Adds ${m.str} to what lands.` };
}
for (const g of GEMS) ITEMS[`${g.key}_arrow`] = { name: `${g.name}-tipped arrow`, icon: "🎯", cap: 1000, ammo: { str: g.str }, req: { skill: "archery", lvl: Math.min(...ARROW_METALS.filter((m) => g.tips.includes(`${m.key}_arrow`)).map((m) => m.arrow), 99) }, ex: `A ${g.name.toLowerCase()} on the point. Adds ${g.str} to what lands, and it is the same arrow whichever metal it started as.` };
/* THE CAPSTONE AT 99: the best wood, the best string, and a singularity core - the same 1-in-2,000 drop the top
   melee weapons want, so the two ladders end on the same chase item rather than each inventing one. */
ITEMS.longcount = { name: "The Long Count", icon: "🏹", forgeWith: ["bogwoodlogs", 10], forgeReq: { skill: "fletching", lvl: 99 }, slot: "weapon", speed: 2600, acc: 44, str: 26, launcher: { range: 7, ammo: "arrow" }, bow: true,
  req: { skill: "archery", lvl: 99 }, ex: "Bogwood, silk and something that fell out of the sky. It reaches further than anything else in the game." };

/* ---------------- the recipes. `station: "fletcher"` throughout; the one exception is the synergy: HEADS are
   SMITHING at the anvil, so fletching is not a skill you level in a corner on your own. */
const fl = (id, r) => recipe(id, { ms: 1800, station: "fletcher", skill: "fletching", ...r });
fl("fletch_bone_arrowhead", { lvl: 1, xp: 4, in: [["bones", 1]], out: ["bone_arrowhead", 5] });
fl("fletch_bone_arrow", { lvl: 1, xp: 6, in: [["shaft", 5], ["bone_arrowhead", 5], ["feather", 5]], out: ["bone_arrow", 5] });
fl("fletch_bowstring", { lvl: 1, xp: 10, in: [["hide", 1]], out: ["bowstring", 1] });
fl("fletch_silkstring", { lvl: 55, xp: 90, in: [["cobweb", 1]], out: ["silkstring", 3] });
fl("fletch_silkstring_wild", { lvl: 55, xp: 120, in: [["wildsilk", 1]], out: ["silkstring", 4] });   /* (2026-09-27) the Wild Weaver's coil */
fl("fletch_marrow_arrowhead", { lvl: 45, xp: 40, in: [["marrow", 1]], out: ["marrow_arrowhead", 15] });
fl("fletch_marrow_arrow", { lvl: 48, xp: 90, in: [["shaft", 15], ["marrow_arrowhead", 15], ["feather", 15]], out: ["marrow_arrow", 15] });
fl("fletch_shaft_gallowslogs", { lvl: 92, xp: 84, in: [["gallowslogs", 1]], out: ["shaft", 50] });   /* (2026-09-27) fifty shafts a log: the Deep's wood */
for (const w of WOODS) {
  const i = WOODS.indexOf(w), str = i >= 6 ? "silkstring" : "bowstring";   /* the top three woods want the silk string: the one thing gating them on something you cannot chop */
  fl(`fletch_shaft_${w.log}`, { lvl: w.shaft, xp: 6 + i * 9, in: [[w.log, 1]], out: ["shaft", FLETCH.shaftsPerLog[i]] });
  fl(`fletch_${w.log}_shortbow`, { lvl: w.short, xp: 20 + i * 28, in: [[w.log, 2], [str, 1]], out: [`${w.log}_shortbow`, 1] });
  fl(`fletch_${w.log}_longbow`, { lvl: w.long, xp: 30 + i * 38, in: [[w.log, 3], [str, 1]], out: [`${w.log}_longbow`, 1] });
  fl(`fletch_${w.log}_quiver`, { lvl: w.quiver, xp: 16 + i * 24, in: [[w.log, 1], ["hide", 2]], out: [`${w.log}_quiver`, 1] });
}
for (const m of ARROW_METALS) {
  recipe(`smith_${m.key}_arrowhead`, { skill: "smithing", station: "anvil", lvl: m.head, ms: 2200, xp: 12 + ARROW_METALS.indexOf(m) * 18, in: [[m.bar, 1]], out: [`${m.key}_arrowhead`, FLETCH.perBar] });
  fl(`fletch_${m.key}_arrow`, { lvl: m.arrow, xp: 10 + ARROW_METALS.indexOf(m) * 22, in: [["shaft", FLETCH.perLog], [`${m.key}_arrowhead`, FLETCH.perBar], ["feather", FLETCH.perLog]], out: [`${m.key}_arrow`, FLETCH.perLog] });
}
/* tipping: fifteen arrows of the LOWEST metal in the gem's band plus one stone. The lowest, so the stone is what
   you are paying for rather than the metal, and so the arrows you tip are the ones you had spare. */
for (const g of GEMS) fl(`fletch_${g.key}_arrow`, { lvl: g.lvl, xp: 40 + GEMS.indexOf(g) * 60, in: [[g.tips[0], FLETCH.perLog], [g.key, 1]], out: [`${g.key}_arrow`, FLETCH.perLog] });
fl("fletch_longcount", { lvl: 99, xp: 6000, ms: 4000, in: [["bogwoodlogs", 5], ["silkstring", 2], ["singularity_core", 1]], out: ["longcount", 1] });

/* ---------------- ranged, as launcher + ammo (see the note at the top on why it is not "bow + arrow") */
/** the launcher in the weapon slot, or null */
export const launcherOf = (c) => { const k = c?.eq?.weapon; const it = k && ITEMS[k]; return it?.launcher ? it : null; };
/** what a launcher would fire right now: { from: "pouch", k, n } or null.
    (2026-09-27, the owner: "users magic pouches and quivers being empty but keeping firing ... users are abusing it") ONLY FROM THE
    WORN POUCH. Until today an empty quiver or Magic Bag fell through to the biggest stack in the bag, and so did having no pouch at
    all: a bow or a wand never ran dry while the bag held a thousand, the pouch's size meant nothing, and the Magic Bags, whose whole
    ladder is that size, were pointless. Now the offhand must be a pouch of the launcher's own kind, the pocket must hold that kind,
    and there must be something in it. Every check that asks "can I fire" goes through here, page and server alike, so the numbers
    on the Equipment tab and the swing that follows cannot disagree. */
export const ammoOf = (c) => {
  const L = launcherOf(c); if (!L) return null;
  const kind = L.launcher.ammo || "arrow", P = pouchOf(c), q = c?.quiver;
  if (!P || P.pouch.ammo !== kind || !q || !(Number.isFinite(q.n) && Math.floor(q.n) >= 1) || ammoKind(q.k) !== kind || !ITEMS[q.k]) return null;   /* whole rounds only: 0.5 of an arrow is none */
  return { from: "pouch", k: q.k, n: q.n };
};
/** why a launcher cannot fire, in plain words, or null when it can */
export const noAmmoWhy = (c) => {
  const L = launcherOf(c); if (!L || ammoOf(c)) return null;
  const kind = L.launcher.ammo || "arrow", w = ammoWords(kind), P = pouchOf(c), verb = kind === "page" ? "cast" : "shoot";
  if (!P) return `You need a ${w.pouch} in your offhand to ${verb}. Load it with ${w.many} from your bag.`;
  if (P.pouch.ammo !== kind) return `A ${P.name.toLowerCase()} holds ${ammoWords(P.pouch.ammo).many}. Wear a ${w.pouch} to ${verb} with the ${L.name.toLowerCase()}.`;
  return `Your ${w.pouch} is empty. Load it with ${w.many} from your bag (click them, or the Load button in your Equipment tab).`;
};
/** how far the held launcher reaches, or 1 for anything else */
export const reachOfHeld = (c) => { const L = launcherOf(c); return L ? L.launcher.range + (charmOf(c, "tailwind") ? 1 : 0) + Math.min(2, petFx(c).reach) : 1; };   /* (2026-09-27) the Pocket Owl */   /* (2026-09-26) Tailwind: one tile further */
/** what kind of ammunition an item is: "arrow" (every arrow, which predates the field), "page", or null */
export const ammoKind = (k) => (ITEMS[k]?.ammo ? ITEMS[k].ammo.kind || "arrow" : null);
/** the words for a kind of ammunition and the thing that holds it, so no message says "arrows" to a wizard */
export const AMMO_WORDS = { arrow: { one: "arrow", many: "arrows", pouch: "quiver" }, page: { one: "spell page", many: "spell pages", pouch: "Magic Bag" } };
export const ammoWords = (kind) => AMMO_WORDS[kind] || AMMO_WORDS.arrow;
/** the element of the loaded page, or null */
export const ammoElOf = (c) => { const a = ammoOf(c); return a ? ITEMS[a.k].ammo.el || null : null; };
/** what the loaded ammo adds to a hit */
/* (2026-09-26, the overnight balance pass) AMMUNITION COUNTS HALF. What an arrow or a page adds to the max hit is its strength times
   AMMO_SHARE. At full strength a bow or a wand out-hit a sword of the same level by 1.6x from Archery 45 and by 2x at 90 - a
   singularity arrow alone added more than a singularity sword's whole strength - and since every point of damage is xp, the
   ranged styles levelled twice as fast too. At half, a bow lands about even with a sword (a little ahead on its faster draw) and
   a wand about a tenth ahead of it, which is what burning a page a cast should buy. tools/eastscape-balance.mjs has the table. */
export const AMMO_SHARE = 0.5;
export const ammoStrOf = (c) => { const a = ammoOf(c); return a ? Math.round(ITEMS[a.k].ammo.str * AMMO_SHARE) : 0; };
/** the pouch in the offhand, or null */
export const pouchOf = (c) => { const k = c?.eq?.shield; const it = k && ITEMS[k]; return it?.pouch ? it : null; };
/** how many the worn pouch holds, its reforge level included (+FORGE.pcap a level) */
export const pouchCapOf = (c) => { const P = pouchOf(c); return P ? Math.round(P.pouch.cap * (1 + FORGE.pcap * fLevelOf(c, "shield"))) : 0; };

/* WHAT YOU HAMMER OUT CAN GO WRONG, AND WHAT YOU SMOKE CAN BURN (2026-09-25, the owner, after a scan for
   recipes that could never fail: "armor smithing should be 90% and smoked fish 90%").

   NINETY PER CENT, FLAT, at every level, for those two and nothing else. Not a curve: alchemy's falls from 50%
   because its input is one grain of sand, and the same shape on a cuirass would cost five bars half the time
   you tried at a new tier. A flat tenth is a tax on certainty rather than a wall in front of every rung.

   IT IS EVERY RECIPE THE SCAN FOUND AT 100%: 95 pieces of gear, 7 bars, 9 smoked fish and the three anvil
   consumables. It went out as anvil-and-smoke-only for one deploy; the owner widened it back to the whole set.
   A bar failing IS felt twice - once for the ore and again for the thing it was going to become - which is the
   argument for exempting it and is worth knowing if that ever comes up again.

   WHAT IS NOT TOUCHED:
   NOVA AND SINGULARITY stay certain. Their weapons eat a core that is one kill in two thousand, and a tenth
   chance of losing it on the anvil is not tension, it is a reason to stop playing.
   AND COOKING keeps its true 0% at burnStop: "this fish never burns again" is a reward people level towards and
   the wiki promises it. The SMOKE of the same fish is a separate recipe and that is the one that can fail. */
export const SMITH_FAIL = 0.10;
{
  const safe = (id, r) => /^(nova|singularity)_/.test(r.out[0]) || /(nova|singularity)/.test(id);
  for (const [id, r] of Object.entries(RECIPES)) {
    if (r.fail || r.failStop != null || r.burnStop != null) continue;   // alchemy has its curve, cooking its burn, charcoal its own 3%
    if (!/^(smith_|smelt_|smoke_|make_)/.test(id)) continue;             // everything the scan found at 100%: gear, bars, smoked fish and the three anvil consumables
    if (safe(id, r)) continue;
    r.fail = SMITH_FAIL;
  }
}

export const TIX_RATE = 0.5;
{
  const cut = (n) => (n > 0 ? Math.max(1, Math.round(n * TIX_RATE)) : n);   // nothing worth something becomes worth nothing
  for (const k of Object.keys(VALUE)) VALUE[k] = cut(VALUE[k]);
  for (const k of Object.keys(SHOP.buys)) SHOP.buys[k] = cut(SHOP.buys[k]);
  for (const k of Object.keys(BOUNTY)) BOUNTY[k] = cut(BOUNTY[k]);
}
/* HOW WIDE A KILL'S TICKETS SWING (2026-09-25, the owner: "lets increase the bands instead so that theres a
   CHANCE at a high ticket, but a chance average ones as well"). The default is 0.6x to 1.4x of what the kill is
   worth; the Thunderhead swings 0.2x to 1.8x, so the same monster can pay a fifth or nearly double.

   BOTH BANDS AVERAGE EXACTLY 1.0, WHICH IS THE WHOLE TRICK. `gap` is what the loop below has decided the kill
   should pay, and the band only decides how that lands - widen it asymmetrically and BOUNTY quietly stops meaning
   what it says, so every number measured off it (the balance tool, the skill sims, the band checks) drifts with
   no warning. Keep any new spread symmetric around 1. */
const TIX_SPREAD = { goose: [0.2, 1.8], golem: [0.2, 1.8], wolf: [0.2, 1.8], drake: [0.2, 1.8], house: [0.2, 1.8] };
export const tixSpread = (t) => TIX_SPREAD[t] || [0.6, 1.4];
for (const [t, want] of Object.entries(BOUNTY)) {
  const m = MOBS[t]; m.drops = m.drops.filter(([k]) => k !== "tickets");
  const other = m.drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  const [lo, hi] = tixSpread(t);
  if (gap >= 2) m.drops.unshift(["tickets", [Math.max(1, Math.round(gap * lo)), Math.round(gap * hi)]]);   // tickets first: line one of every table   // tickets first: line one of every table (it was tickets until 2026-09-20)
}
/* FINDS: what any kill can turn up on top of the monster's own drops. [item, share]: the chance is share x the
   monster's bounty / the find's worth, so every monster gives the same fraction of its pay this way and a chicken
   farmer sees a red chip about once in 250 kills while the Understudy coughs one up every 14. */
export const FINDS = [["chip_red", 0.04, 250], ["chip_black", 0.03, 1000], ["chip_gold", 0.03, 5000], ["chip_free", 0.008, 50], ["mysterybox", 0.008, 60], ["devils_dice", 0.004, 50], ["rewind_watch", 0.006, 250]];
/* The third number is the find's worth, and findChance divides the monster's bounty by it. Both sides have to be
   in the same money or halving BOUNTY would halve how often chips turn up as well, which was never asked for. */
for (const f of FINDS) f[2] = Math.max(1, Math.round(f[2] * TIX_RATE));
/* JACKPOT KILL (v92): fighting is a slot machine too. One kill in JACKPOT_KILL.odds was carrying the house's money: it pays
   JACKPOT_KILL.mult times that monster's bounty in tickets on top of its drops, with the casino's own win banner and a line to
   everyone in the area. It adds mult / odds (a tenth) to what fighting pays on average, and nothing else changes. */
/* (2026-09-25, the owner: "users are hitting jackpot kills at an alarmingly high rate, it needs a nerf") It was
   1 in 50 paying 5x. At the fifteen-odd seconds a kill takes that is FOUR AN HOUR, and a tenth of every ticket
   anybody earned by fighting - a salary rather than a jackpot, and the reason it stopped reading as an event.

   1 in 250 paying 12x is about one an hour and 4.8% of income, so the average roughly halves while the moment
   itself gets more than twice as big. That is the trade worth making with anything called a jackpot: rarity is
   what buys the feeling, and the multiplier is what pays for the rarity. The average is mult/odds - check that
   number, not either one on its own, when tuning this. */
export const JACKPOT_KILL = { odds: 250, mult: 12 };
export const findChance = (mob, [, share, worth]) => Math.min(0.25, share * (BOUNTY[mob] || 0) / worth);
/* REAL ZCOINS, RARELY (2026-09-20, the owner: "rare drops for raw zcoins from fishing and mob killing"). A `zcoin` is an
   item: it lands in your bag like anything else, and the Prize Counter banks it onto your eastcoin.vip balance through the
   same endpoint, the same hourly allowance (DEX.capHour) and the same day fuse as everything else that mints ZCoins, so
   the drop rate here can never out-run the cap. A kill's chance grows a little with the monster's level; a catch's with
   the water. One drop in twenty is a handful (`bigN`) instead of one. At these numbers an hour of fighting turns up
   about 2 to 5 ZCoins and an hour of fishing 1.5 to 5; tools/eastscape-grind-sim.mjs prints the measured figure. */
/* HALVED (2026-09-23, the owner: "reduce the amount of raw zcoins that drop by half from all mobs and skills").
   Every rate below is exactly half what it was. `big` and `bigN` are the SHAPE of a drop, not its rate, so they
   stay: one drop in twenty is still a handful of five, it just happens half as often. An hour of fighting now
   turns up about 1 to 2.5 ZCoins and an hour of fishing about 1 to 2.5.

   Worth knowing where this sits: drops were never the big half of EastScape's ZCoin minting. A level-50 hour drops
   ~4 ZCoins but converts ~45 more through DEX at 1,000 tickets to the coin, so the ticket faucet IS the ZCoin
   faucet. This halves the small half honestly; TIX_DROP above halves the large one. */
export const ZDROP = { kill: (lvl) => 0.003 + lvl * 0.0001, fish: { sardine: 0.00125, perch: 0.00125, trout: 0.00125, catfish: 0.00135, lanternfish: 0.0015, mudskipper: 0.0015, bonefish: 0.00155, ghostcarp: 0.0016, goldfish: 0.00185, koi: 0.0019, skyeel: 0.00165, cloudray: 0.0017, stormmarlin: 0.00175, thundersquid: 0.0018 }, big: 0.05, bigN: 5 };
/** A monster's whole rare line: its own named pieces, then the casino finds, each with its chance a kill. ONE roll decides. */
/* ONE RATE FOR EVERY NAMED RARE (2026-09-23, the owner: "lets make a rule, that ALL rares now and going forward
   have a flat drop rate % of 1%"). Every piece on a monster's own rare table is 1 in 100. It was a hand-set
   number per line, from 0.4% to 25%, which nobody could hold in their head and which meant a new monster's drops
   were guessed at against no reference.

   IT IS A RULE, NOT A REWRITE, and that is the point of putting it HERE rather than editing the numbers in LOOT:
   raresOf is the one thing that reads a monster's rare table, so every monster is 1 in 100 whatever number sits
   beside the item in the table and however that monster reached MOBS — including ones added later, or merged in
   at runtime the way the crypt's are. Adding a rare is now naming it, and nothing else.

   WHAT IT DELIBERATELY DOES NOT COVER (the owner chose this scope against the alternatives):
     - ZCoin drops keep ZDROP.kill, which climbs with the monster's level and was halved earlier today. Flat 1%
       would have roughly tripled them on low monsters and undone that.
     - The casino FINDS keep findChance, which scales with the monster's BOUNTY on purpose so every monster gives
       the same fraction of its pay in chips. Flattened, a chicken — three seconds to kill — would turn up a
       2,500-ticket gold chip once in 100 instead of once in 9,259, and level-1 farming would be the best earning
       in the game by a distance. Measured: a chicken's rare line goes from 1.0 tickets a kill to 32.2 against a
       bounty of 9.

   The cost, accepted: a few signature drops get much rarer. The Junk King's line falls about 89% and the goat's
   toga goes from one in four to one in a hundred. 78 lines get rarer, 9 more common, 12 were already there. */
export const RARE_RATE = 0.01;
/* HOW OFTEN A 2X POTION TURNS UP, and why this number. It is FLAT across every monster in the game rather than
   scaled by bounty the way FINDS are: a chicken should be able to drop it, because "it can come from anywhere"
   is most of what makes people talk about it. At roughly 240 kills an hour each, five people playing is about
   1,200 kills an hour, so one in six thousand is a pop every four or five hours of a busy room - often enough
   to be a thing that happens, rare enough that nobody plans around it. The event runs 30 minutes, so the server
   spends something like a tenth of its busy time doubled. Raise the rate and you are raising the ticket supply
   for everybody at once, which is the one knob here that is really an economy knob. */
export const DOUBLE = { drop: 1 / 6000, ms: 30 * 60 * 1000, mult: 2 };
/* (2026-09-24) THE FINDS TOGETHER HAVE A CEILING, and not just one at a time. findChance clamps each find at
   25%, which was plenty while the biggest bounty in the game was The House's 642 — but there are SEVEN finds,
   so the clamp lets them total 175%, and rollRare walks the list subtracting as it goes: past 100% the tail
   simply never drops. Raising The Grinning Man to 4,000 (he unlocks with a key that costs a hundred kills) took
   his rare line to 130% and silently switched off the bottom of it.
   Scaling the whole block down when it would exceed FIND_CAP keeps the rule the finds were written for — every
   monster gives the same fraction of its pay this way — right up to the point where it stops being possible.
   NOTHING IN THE GAME TODAY IS AFFECTED: the heaviest existing line is The House at 43%, well under the cap. */
export const FIND_CAP = 0.5;
export const raresOf = (mob) => {
  /* the 2X potion sits at the FRONT of the table and at a flat rate: it is not a casino "find" (those scale with
     the monster's bounty, so only the Thunderhead would ever drop one) and not a monster's own rare (those are
     one per monster at RARE_RATE). Every monster with a bounty, same chance, chicken included. */
  const out = [...(BOUNTY[mob] ? [["pot_double", DOUBLE.drop], ["zcoin", ZDROP.kill(MOBS[mob].lvl)]] : []), ...(MOBS[mob]?.rare || []).map(([k]) => [k, RARE_RATE])];
  if (!BOUNTY[mob]) return out;
  const finds = FINDS.map((f) => [f[0], findChance(mob, f)]);
  const sum = finds.reduce((a, [, p]) => a + p, 0);
  const scale = sum > FIND_CAP ? FIND_CAP / sum : 1;
  return [...out, ...finds.map(([k, p]) => [k, p * scale])];
};
export const rollRare = (mob, r, fx) => { for (const [k, p0] of raresOf(mob)) { const p = p0 * (1 + (k === "zcoin" ? fx?.zdrop || 0 : fx?.rare || 0)); if (r < p) return k; r -= p; } return null; };   /* fx: fxOf(character) */
export const BOX = [["clover", 3], ["chip_red", 2], ["chip_free", 3], ["beer", 3], ["whiskey", 2], ["cocktail", 2], ["steakdinner", 2], ["tp_scroll", 3], ["devils_dice", 2], ["rewind_watch", 1], ["chip_black", 0.3]];   // what's in a mystery box, by weight
export const valueOf = (k) => VALUE[k] ?? SHOP.buys[k] ?? 0;
/** The first thing a raw material can be made into, and what that's worth each: the Cashier's "worth more made" nudge. */
export const madeFrom = (k) => { const r = Object.values(RECIPES).filter((x) => x.in.some(([i]) => i === k) && !ITEMS[x.out[0]]?.slot).sort((a, b) => a.lvl - b.lvl)[0]; return r ? { r, out: r.out[0], verb: STATIONS[r.station === "fire" ? "range" : r.station]?.verb || "make" } : null; };
/** What one go at a thing in the world is worth: the label drawn over a rock, a tree, a fishing spot. */
export const nodeValue = (ob) => (ob.t === "rock" || ob.t === "vein" ? valueOf(ob.ore) : ob.t === "spot" ? valueOf(ob.fish || "sardine") : ob.t === "wheat" ? valueOf("wheat")
  : ob.t === "olive" || ob.t === "vine" ? valueOf(ob.crop || "olives") : ["tree", "oak", "yew", "cypress", "deadtree", "willow", "skyash"].includes(ob.t) ? valueOf(ob.log || "logs") : 0);
/** What a monster's drops come to on an average kill. */
/* (2026-09-27, the owner: "pumpkin king gives about half the tickets that are listed under his name. i think it says ~1200 but he gives like
   500-700") WEARABLE GEAR IS NOT PAY, in the ordinary drops as well as the rare ones (raresOf below already left it out). The King keeps
   his Halloween set in `drops`, so a 1% scythe, crown and coin were being counted at full sell value into the "~" under his name: ~1,259
   for a monster whose ticket roll is 420-720. It reads ~700 now: his tickets, his ectoplasm and the rest of his loot, what a fighter actually gets. */
export const mobValue = (t) => Math.round((MOBS[t]?.drops || []).reduce((a, [k, n, p]) => a + (k === "tickets" ? 1 : ITEMS[k]?.slot ? 0 : valueOf(k)) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0)
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
/* QUICK SELL (2026-09-23, from tester feedback via the owner: "allow rares/currently unsellable items to Bom but
   at a deeply discounted rate, so that it still makes the market enticing, but they can just quick sell if they
   want it").

   THE PROBLEM IT SOLVES. isLoot refuses anything worn, used, drunk or raw, so twenty of the game's rare drops had
   NO buyer at all: a second Angel's Ring was worth exactly nothing unless another player happened to want one.
   That is the right rule for the Cashier's bulk "sell everything" — nobody should be one click from selling the
   ring they are wearing — but it left no floor under a duplicate.

   THE PRICE IS DELIBERATELY POOR, and the scale comes from what the game already does: Brutus buys an Eclipse
   gladius back for 539 and sells it for 92,400. A buyback here has never been a fair price, and this one is not
   either. QUICK holds a reference worth and QUICK_RATE is what Bom actually pays of it — ONE dial, so "deeply
   discounted" can be re-tuned in a single number without touching nineteen of them.

   TWO RULES THAT MUST HOLD.
   1. It is PER ITEM AND DELIBERATE. `cashOut` with op "all" still filters on isLoot alone, so no amount of
      clicking Sell All can take your gear. If that ever changes, this feature becomes a way to lose a drop you
      spent a week on.
   2. `chip_free` IS NOT IN HERE, on purpose. Using a Green house chip already pays FREEPLAY (100), so listing it
      at a quarter of anything would be a trap: a strictly worse button sitting next to the good one.

   These are in TODAY's money, after TIX_RATE. `mask` was already priced at 30 and still unsellable, because it is
   worn — it goes through this path now, which is what makes it sellable at all. */
export const QUICK_RATE = 0.25;
export const QUICK = {
  /* the Junk King's own two, off the hardest thing in the game */
  wrench: 900, kingcap: 700,
  /* the casino set: the chase items, effects rather than stats, so no formula would have priced them */
  angels_ring: 900, bookies_amulet: 700, sharps_gloves: 700, adjusters_visor: 700, gamblers_ring: 500, stake_loafers: 500,
  /* mid-road combat rares */
  grudge: 300, bogplate: 300, lantern: 250, wraithhood: 220, spiderboots: 200, menace: 180,
  /* the early ones */
  toga: 120, mask: 80,
  /* things you use rather than wear */
  rewind_watch: 250, mysterybox: 60, devils_dice: 50
};
/** What Bom hands over for something he would otherwise refuse, or 0 if he still refuses it. */
/* (2026-09-27, the owner: "all halloween event items should sell for 1 ticket to Bom") EVERY event item, gear and consumables
   alike, is a quick-sell at one ticket: Bom will take it, one at a time, and it is worth nothing to him. Candy corn is not an
   item in this sense - it is the season's coin, and selling it would turn the event's currency into tickets. isLoot leaves event
   items out too, so "trade in the lot" can never sweep a pie or a legendary for a ticket. */
export const EVENT_SELL = 1;
export const quickSell = (k) => (ITEMS[k]?.event && k !== "candycorn" ? EVENT_SELL : QUICK[k] ? Math.max(1, Math.round(QUICK[k] * QUICK_RATE)) : 0);
/** Anything the Cashier will take one of: ordinary loot, or a rare at the quick-sell price. NEVER used by "sell all". */
/* (2026-09-23, the owner: "bom trady doesnt buy smithed gear... low rates for it, 25% of what he sells it for")
   THE COUNTER BUYS ITS OWN LADDER BACK. Nothing could sell a smithed piece at all: isLoot excludes anything with
   a `slot`, and gear is in neither the QUICK list nor anywhere else the Cashier looks, so a player who smithed a
   suit had no way to turn the old one into anything. SHOP.buys does carry a gear price, but that is Brutus's
   table and Brutus closed in v108 - there is no NPC left that opens it.

   The price is read straight off prizesOf(), the same list the counter SELLS from, so the two can never drift
   apart: a quarter of what it costs, and the content check's "never buy at or above the sell price" rule holds
   by construction. It is computed here, below TIX_RATE, because the counter's own prices are not halved either -
   a quarter of the shelf price means a quarter of the shelf price.

   AND GEAR STAYS OUT OF isLoot, deliberately. isLoot is what "sell all" sweeps; leaving armour out of it means a
   careless click can never cash in the suit you are carrying. You sell a piece by choosing it. */
export const GEAR_SELL_RATE = 0.125;   /* (2026-09-27, the owner: "users are making too much tickets, cut all of them in half") an eighth of the shelf price, was a quarter; the reforge step below rides the same rate */
const COUNTER_PRICE = new Map(prizesOf().filter((p) => Array.isArray(p.give) && p.give[1] === 1).map((p) => [p.give[0], p.price]));
/* WHAT A REFORGE ADDS TO THE BUYBACK (2026-09-24, the owner: "after you reforge a piece of gear does that make
   it's Bom Trady value go up ... i think it should go up if it doesn't since you put extra resources into that
   piece"). It did not: a reforged piece could not be sold here AT ALL, because gear is counted plainOnly so that
   nobody ever loses a +3 for the price of a plain one. Now it sells for more, deliberately, one level at a time.

   THE PRICE IS THE MATERIALS, at the same quarter the rest of this counter pays. Every step costs the same
   forgeCost bars, so a +3 holds three lots of them, and the premium is a quarter of what those bars would have
   fetched. That is what makes it SAFE: a quarter is less than the whole, so turning bars into a reforge and
   selling the piece can never beat selling the bars, and reforging can never become a way to launder them. The
   nominal bars are used, not the expected ones - a reforge can fail and can break the piece, and paying for
   attempts that did not happen would hand a lucky player a profit.

   It does not pay for the STATS, which is why the top tiers only move a few per cent: an onyx piece already
   sells for thousands and three reforges of it are nine bars. Pricing the stats instead (say +20% a level, to
   match FORGE.temper) reaches 450 tickets a bar against the 246 a bar sells for on its own, and that is the
   laundering loop. The materials are the honest answer. */
export const forgeSellStep = (k) => {
  const cost = forgeCost(k);
  if (!cost) return 0;
  const [bar, n] = cost;
  return Math.round(GEAR_SELL_RATE * n * (quickSell(bar) || valueOf(bar) || 0));
};
/* (2026-09-27, the owner: "after diamond put a limit on bom buying gear back for 2500 max. users can just craft a ton of cuirass
   for example right and break the inflation"). THE ANVIL WAS A TICKET PRINTER FROM ONYX UP. A fraction of the shelf price scales
   with the SHELF, and the shelf climbs about 2.4x a tier while the bars a piece eats climb far slower: five nova bars sell for
   4,940 and a nova cuirass bought back for 75,000, so smithing added 70,060 tickets to the world that the ore never earned.
   Halving the rate that morning halved that and left the shape alone. A CEILING fixes the shape: every piece is worth at most
   GEAR_SELL_MAX, reforge included, so the most smithing can ever add to a piece is what that sum is over its bars.
   Dragonstone (2,250 for a cuirass) is the last tier wholly under it, which is what "after diamond" meant in practice; from
   onyx up every piece pays the ceiling, and from nova up that is LESS than the bars would fetch sold on their own, so nobody
   smiths high gear to sell it. gearSellRaw is the uncapped figure, kept for the test that proves reforging is not a laundry. */
export const GEAR_SELL_MAX = 2500;
export const gearSellRaw = (k, f = 0) => { const p = COUNTER_PRICE.get(k); return p && ITEMS[k]?.slot ? Math.max(1, Math.round(p * GEAR_SELL_RATE)) + fOf({ f }) * forgeSellStep(k) : 0; };
export const gearSell = (k, f = 0) => Math.min(GEAR_SELL_MAX, gearSellRaw(k, f));
export const canSell = (k) => isLoot(k) || quickSell(k) > 0 || gearSell(k) > 0;
export const isLoot = (k) => !ITEMS[k]?.event && k !== "tickets" && k !== "tickets" && k !== "zcoin" && valueOf(k) > 0 && !ITEMS[k]?.slot && !ITEMS[k]?.luck && !ITEMS[k]?.use && !ITEMS[k]?.drink && !ITEMS[k]?.raw;

// dying outside the Cage: a quarter of the time one worn item falls where you died. The killer alone can take it
// for lootMs, then anyone, until it's gone. Leaving mid-fight leaves your character standing there for lingerMs.
export const PVP = { drop: 0.25, lootMs: 60000, groundMs: 180000, lingerMs: 10000 };
// how long a monster stays dead: 15s everywhere, but in the Wilderness it scales with level, from 1 minute
// (level 15 and under) to 3 minutes (level 45 and up), so a kill there is worth something
// how long a monster stays dead. Outside the Wilderness it's 15s for one person, shared out between everyone who has
// fought in the area in the last minute (15s, 7.5s, 5s, then a 4s floor), so a busy area refills without more monsters on it.
export const RESPAWN = { base: 15000, floor: 4000 };
/* (2026-09-27, the owner: "the respawn timers of mobs in all of these need to be scaled towards their levels, so in the yard its very fast,
   here it needs to be X amount slower (probably a few minutes at minimum)") A PLACEMENT'S TIMER FROM ITS LEVEL: three minutes at the least,
   3.2 seconds a level above that, and up to half as long again at random so a spot cannot be timed to the second. Level 66 is about 3.5-5
   minutes, level 78 about 4-6. Used by the Boardwalk's islands; the Yard and everything without a timer of its own keeps RESPAWN. */
export const levelRespawn = (t) => { const lo = Math.max(180000, (MOBS[t]?.lvl || 1) * 3200); return [lo, Math.round(lo * 1.5)]; };
/* A MOB MAY OWN ITS TIMER, and when it does the party does NOT divide it (2026-09-25). That division is there so
   a crowd on an ordinary monster is not left standing around, but on a boss it is backwards: the more people
   farming it, the faster it comes back. Anything worth camping wants `respawn` on its MOBS line. */
export const respawnMs = (sc, t, fighters = 1) => (MOBS[t]?.respawn ? MOBS[t].respawn
  : sc?.pvp ? 60000 + Math.round(Math.max(0, Math.min(1, (MOBS[t].lvl - 15) / 30)) * 120000)
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
  goldtomatoe: { lvl: 50, ms: 4 * 3600000, yield: [1, 3], xp: 600, col: "#ffd84a" },
  /* (2026-09-27) THE LAST THREE CROPS. Harvesting stopped at 50; these run it to 92, each seeded by the zone of that level like every
     crop before them: the glass gourd by the Carnival's freaks, the ember wheat by the Vault's wardens, the starfruit by the Trailer
     Park's dogs. Long growers with big yields, so a plot planted before bed is worth the bed. */
  glassgourd: { lvl: 62, ms: 5 * 3600000, yield: [3, 5], xp: 1100, col: "#a8e0ff" },
  emberwheat: { lvl: 78, ms: 6 * 3600000, yield: [3, 5], xp: 1900, col: "#ff8a30" },
  starfruit: { lvl: 92, ms: 8 * 3600000, yield: [2, 4], xp: 3200, col: "#ffe060" }
};
ITEMS.glassgourd = { name: "Glass gourd", icon: "\u{1F52E}", ex: "Grows clear enough to read through. The Carnival's freaks carry the seed, which is the gourd." };
ITEMS.emberwheat = { name: "Ember wheat", icon: "\u{1F33E}", ex: "The heads glow. Do not store it near anything that burns. The Vault's wardens carry it, for reasons." };
ITEMS.starfruit = { name: "Starfruit", icon: "\u2B50", ex: "Five points and a light of its own. Fell into the Trailer Park with everything else." };
// a theme repaints your island; price null means you can't buy it (events, quests)
export const THEMES = {
  meadow: { name: "Meadow", icon: "🌿", ex: "Green grass, round trees, a nice breeze.", price: 0 },
  dunes: { name: "Sunny Dunes", icon: "🏝️", ex: "Warm sand, palm trees and one crab that watches you.", price: 2500 },
  gloom: { name: "Gloom", icon: "🕸️", ex: "Grey grass, bare trees, a little fog. Not for sale.", price: null }
};
export const EXAMINE = {
  /* (2026-09-24) THE LANTERN MIRE'S DRESSING. The Crypt drew all of this and never named any of it, because down
     there the pictures are furniture in a fight. Out in the mire they are the whole point - the owner asked for
     "flavor ... very spooky", and a prop you can click and read is the difference between a scene and a backdrop. */
  cryptgate: "An arch with nothing left to hold up. The doors are in the water somewhere, still shut.",
  crypttorch: "Still burning, in a bog, in the rain. Nobody will say who comes out to light them.",
  cryptaltar: "Someone has left an offering on it. A betting slip, folded twice, face down.",
  cryptcandles: "Fourteen candles, all lit, all exactly the same height. They were not lit at the same time.",
  cryptcoffin: "Open, empty, and clean inside. Not a speck of mire in it anywhere.",
  cryptrubble: "The roof, mostly. It came down all at once and on a Tuesday, the sign used to say.",
  cryptpillar: "The carving is a hand holding dice. The hand has too many fingers.",
  gargoyle: "Gutters run the other way. This one is facing in, at the aisle, at about head height.",
  ghostbrazier: "Cold coals with a green light coming off them. Hold a hand over it and it gets colder.",
  sarcophagus: "The lid does not sit right any more. Hard to say from which side it was moved.",
  skullheap: "Stacked, not dropped. Sorted by size, biggest at the bottom. Somebody tidied.",
  bonepile: "Picked clean and laid out in rows. The moths do the picking.",
  cageV: "A cage up on its end with the door open. Whatever the Sharks kept in it is not in it.",
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
  /* (2026-09-25, the owner: "remove the unwalkable carpet that doesnt allow you to move in the vault, it says
     'Mind your sandals'. also remove that mechanism from the casino as well") A RUG IS NOT A THING YOU CLICK.
     Its kind came from having an EXAMINE line, and the page then answered a click on bare carpet with the
     examine instead of walking you there - so any carpeted floor read as unwalkable. Removing the line is the
     whole fix: with no kind, the click loop skips rugs entirely and the click falls through to movement.
     The Vault's new purple runners and the casino's carpet were both affected. */
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
export const HISCORES = [["combat", "Combat", "combat level", "lvl"], ["melee", "Melee", "level", "lvl"],   /* (2026-09-27, the owner: "at the top of the UX it says combat 80, the skills UI combat total says 221 and the leaderboard says 76, these need to be consistently labeled/calculated") the Combat board is the COMBAT LEVEL (combatOf, what the stats panel, profiles and every gate read); it ranked Melee under that name, which is why it said 76. Melee has its own board now. */ ["total", "Total level", "every skill added up", "lvl"], ["hp", "Hitpoints", "level", "lvl"], ["fishing", "Fishing", "level", "lvl"], ["cooking", "Cooking", "level", "lvl"], ["farming", "Harvesting", "level", "lvl"], ["mining", "Mining", "level", "lvl"], ["woodcutting", "Woodcutting", "level", "lvl"], ["smithing", "Smithing", "level", "lvl"], ["agility", "Agility", "level", "lvl"], ["alchemy", "Alchemy", "level", "lvl"],   /* (2026-09-27) Alchemy had been on the skills panel since the 24th and on no board: a skill added by hand to SKILLS has to be added by hand here too */
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
  ["runBest", "The Run", "fastest lap", "lap"],
  /* (2026-09-27, the owner: "for the dungeon runs there are tabs that sort between 2 man, 3 man, and 4 man ... highest floor
     achieved needs to be a new category as well"). The Pyramid's clears were timed and announced but never kept; they go in the
     same list the Crypt's do, under "p1". "floor" is a number carried on the character (c.tower.best) like The Run's lap. */
  ["pyr1", "The Pyramid", "fastest clear", "time"],
  ["tower", "The Tower", "highest floor", "floor"]];
/* (2026-09-27) THE RAIL IS GROUPED. Twenty-two boards in one column read as a list of everything; four headings read as a
   menu. A board's group comes from what it IS (its kind and key), not from a fifth column somebody has to remember to fill in,
   and the Skills group follows the skills panel's own order so the two agree. The page draws hsRail(); the test counts it. */
export const HISCORE_GROUPS = ["Combat", "Skills", "Records", "Dungeons & runs"];
export const hsGroupOf = (key, kind) => (["combat", "melee", "archery", "magic", "hp"].includes(key) ? "Combat" : kind === "lvl" || key === "total" ? "Skills" : kind === "time" || kind === "floor" || kind === "lap" ? "Dungeons & runs" : "Records");
export const hsRail = () => {
  const order = ["total", ...SKILL_GROUPS.flatMap((g) => g.keys)], at = (k) => { const i = order.indexOf(k === "combat" ? "melee" : k); return i < 0 ? 99 : i; };
  return HISCORE_GROUPS.map((name) => ({ name, boards: HISCORES.filter(([k, , , kind]) => hsGroupOf(k, kind) === name).sort((a, b) => (name === "Skills" ? at(a[0]) - at(b[0]) : 0)) })).filter((g) => g.boards.length);
};
/* ---------------- what is on, and where. The same shape THIEF.live uses. */
if (FLETCH.live) {
  SKILL_GROUPS.find((g) => g.name === "Combat")?.keys.splice(1, 0, "archery");   /* Combat, Archery, Hitpoints */
  SKILL_GROUPS.find((g) => g.name === "Skilling")?.keys.push("fletching");
  HISCORES.splice(1, 0, ["archery", "Archery", "level", "lvl"]);   /* beside Combat, not at the end of the list */
  HISCORES.push(["fletching", "Fletching", "level", "lvl"]);
  SHOP.sells.push(["logs_shortbow", 40], ["logs_quiver", 30], ["bone_arrow", 2]);   /* the Archery 1 kit, so nobody has to fletch before they can shoot */
  KITS.push(["logs_shortbow", 1, 40], ["logs_quiver", 1, 30], ["bone_arrow", 100, 200]);   /* ...and the counter that actually sells it */
}

/* ============================================================ MAGIC and WIZARDRY (2026-09-26)
   The owner's design (memory note eastscape-magic-design): Magic is a COMBAT skill like Archery - a WAND in the weapon hand, SPELL
   PAGES as its ammunition, a MAGIC BAG in the offhand holding them the way a quiver holds arrows - and it rides the launcher /
   ammo / pouch template archery built, so nothing in the fight knows the word "wand". Wizardry is the CRAFTING skill that ties the
   rest together: seeds from monsters are grown on your island (Harvesting), brewed into ink (Alchemy), paper is pressed from logs
   (at the fletching table), and pages are PRINTED at element ALTARS around the world - the best of them, the Nexus, deep in the
   Wilderness. Five elements (Fire, Frost, Storm, Void, Sun) plus Arcane for practice; every monster may be weak to one and resist
   another. Utility pages are BUFFS and TRAVEL, never shortcuts: one at a time, outside only, tiered by the reader's Wizardry. */
export const MAGIC = {
  live: true,
  weakMul: 1.35, resistMul: 0.6,                      // a monster's own weakness and resistance
  burn: { chance: 0.5, share: 0.4, ms: 1200 },       // FIRE: half the time, 40% of the hit again 1.2 s later
  slow: { ms: 4000, mult: 1.5 },                     // FROST: the monster's next swings take 1.5x as long, for 4 s
  arc: { share: 0.5 },                               // STORM: half the hit jumps to one other monster beside the target
  pierce: 0.3,                                       // VOID: ignores 30% of the target's defence
  sunHeal: 0.15,                                     // SUN: you heal 15% of the damage you deal
  bagLvl: [1, 30, 50, 70, 90], bagCap: [100, 250, 500, 1000, 2500],
  tierAt: [70, 90],                                  // utility page tiers: I below Wizardry 70, II from 70, III from 90 (2026-09-26, the owner: the pages start at Wizardry 50 and run to 99, so the tiers moved up with them)
};
/* the elements. `base` is the Magic level of its first page and the Wizardry level to print it; Blast is +20, Surge +40 */
export const ELEMENTS = {
  arcane: { name: "Arcane", icon: "✨", col: "#e070d0", base: 1 },
  sun:    { name: "Sun", icon: "☀️", col: "#ffd84a", base: 10, seed: "seed_sun", bloom: "sunpetal" },
  fire:   { name: "Fire", icon: "\u{1F525}", col: "#ff6a2a", base: 20, seed: "seed_ember", bloom: "emberbloom" },
  frost:  { name: "Frost", icon: "❄️", col: "#9ad8ff", base: 30, seed: "seed_frost", bloom: "frostcap" },
  void:   { name: "Void", icon: "\u{1F300}", col: "#b070ff", base: 40, seed: "seed_void", bloom: "voidlily" },
  storm:  { name: "Storm", icon: "⚡", col: "#ffe24a", base: 50, bloom: "stormcorn" },   /* Storm grows the Stormcorn that already exists */
};
export const ELEMENT_KEYS = ["sun", "fire", "frost", "void", "storm"];
SKILLS.magic = { name: "Magic", icon: "\u{1FA84}" };
SKILLS.wizardry = { name: "Wizardry", icon: "\u{1F4DC}" };

/* ---------------- materials */
ITEMS.gallowslogs = { name: "Gallows logs", icon: "\u{1FAB5}", ex: "Near-black, close-grained, and the only wood in the game past bogwood. One tree, in the Deep Wild." };   /* (2026-09-27) Woodcutting to 90 */
ITEMS.spellpaper = { name: "Spell paper", icon: "\u{1F4C4}", ex: "Pressed from logs at the Arcane altar in the Yard. Every spell page and scroll is printed on it." };
for (const [el, E] of Object.entries(ELEMENTS)) ITEMS[`ink_${el}`] = { name: `${E.name} ink`, icon: "\u{1F58B}️", ex: `Brewed at the cauldron. ${el === "arcane" ? "The practice ink: Arcane pages and every wand and bag." : `Prints ${E.name} pages and scrolls at the ${E.name} altar, or at the Nexus.`}` };
const SEED_NAMES = { seed_sun: "Sun seeds", seed_ember: "Ember seeds", seed_frost: "Frost seeds", seed_void: "Void seeds" };
const BLOOM_NAMES = { sunpetal: "Sunpetal", emberbloom: "Emberbloom", frostcap: "Frostcap", voidlily: "Voidlily" };
for (const [k, n] of Object.entries(SEED_NAMES)) ITEMS[k] = { name: n, icon: "\u{1F331}", ex: "Plant them on your island. They grow the flower that element's ink is brewed from." };
for (const [k, n] of Object.entries(BLOOM_NAMES)) ITEMS[k] = { name: n, icon: "\u{1F33A}", ex: "Grown on your island from seeds. Three of them and a vial brew two bottles of ink at the cauldron." };
/* the four new island crops: planted as SEEDS, harvested as the bloom (`yields`), drawn from crop_<art>_1..4 */
Object.assign(CROPS, {
  seed_sun:   { lvl: 15, ms: 60 * 60000,  yield: [3, 5], xp: 120, col: "#ffd84a", yields: "sunpetal",   art: "sunpetal" },
  seed_ember: { lvl: 25, ms: 90 * 60000,  yield: [3, 5], xp: 220, col: "#ff6a2a", yields: "emberbloom", art: "emberbloom" },
  seed_frost: { lvl: 35, ms: 120 * 60000, yield: [3, 5], xp: 380, col: "#9ad8ff", yields: "frostcap",   art: "frostcap" },
  seed_void:  { lvl: 45, ms: 180 * 60000, yield: [3, 5], xp: 600, col: "#b070ff", yields: "voidlily",   art: "voidlily" },
});
/** what a planted crop gives, and the pictures it grows through */
export const cropYield = (k) => CROPS[k]?.yields || k;
/* (2026-09-27, the owner: "have the chance of seed return at 25%"; then, the same evening: "we need to make sure users are self
   sufficient, but dont get too many seeds" - "go with the second one") A harvested seed crop ALWAYS gives its seed back, and a
   second one SEED_EXTRA of the time. At a quarter a seed averaged 1.33 plantings and was gone: a farm shrank three quarters of
   a seed a harvest and only kills refilled it. Now a plot found once runs forever, and the farm creeps up by about one seed in
   ten harvests - self-sufficient, with a slow surplus rather than a fast one. Seeds still come from kills at their old rate. */
export const SEED_RETURN = 1;
export const SEED_EXTRA = 0.10;
/* (2026-09-27, the owner: "buff it to 2 seeds back, 1 in 10 gives 3") SEED_BACK seeds come back every harvest, and one more SEED_EXTRA
   of the time. Every plot now doubles itself: a farm GROWS by one plot a harvest, where at one-back it only held steady. */
export const SEED_BACK = 2;
/* (2026-09-27, the owner: "put golden tomatoe in the game somewhere as a rare drop") The Golden tomatoe was a Harvesting-50 crop
   that grows 1-3 from one - so it multiplies itself - with NO way to get the first one. Two now: the Yard's Rotten Tomato drops
   it one kill in five hundred (on its drop table, below MOBS), and any island harvest of anything else turns one up one time in
   a thousand (the server's harvest). Not the event's: it stays after November. */
export const GOLD_TOMATO_HARVEST = 0.001;
export const cropArt = (k) => CROPS[k]?.art || k;

/* ---------------- combat pages: the ammunition. Arcane is the practice page; each element has Bolt, Blast and Surge */
const pageStr = (lvl) => Math.max(2, Math.round(lvl * 0.36));
const PAGE_TIERS = [["bolt", "bolt", 0], ["blast", "blast", 20], ["surge", "surge", 40]];
ITEMS.page_arcane = { name: "Arcane bolt", icon: "✨", cap: 1000, ammo: { kind: "page", str: 2, el: "arcane" }, req: { skill: "magic", lvl: 1 }, ex: "A practice page. No element: nothing is weak to it and nothing resists it." };
for (const el of ELEMENT_KEYS) for (const [t, word, plus] of PAGE_TIERS) {
  const E = ELEMENTS[el], lvl = E.base + plus;
  ITEMS[`page_${el}_${t}`] = { name: `${E.name} ${word}`, icon: E.icon, cap: 1000, ammo: { kind: "page", str: pageStr(lvl), el }, req: { skill: "magic", lvl },
    ex: `Spends one per cast. Adds ${pageStr(lvl)} to what lands, and it is ${E.name}: monsters weak to ${E.name} take far more, and some resist it.` };
}

/* ---------------- wands: one per wood, like the bows, plus a capstone */
for (const w of WOODS) {
  const i = WOODS.indexOf(w), lvl = ARCHERY.useLvl.short[i];
  ITEMS[`${w.log}_wand`] = { name: `${w.name} wand`, icon: "\u{1FA84}", slot: "weapon", speed: 2200, acc: 6 + i * 4, str: 1 + i * 2,
    launcher: { range: 5, ammo: "page", style: "magic" }, wand: true, req: { skill: "magic", lvl },
    forgeWith: [w.log, 4], forgeReq: { skill: "wizardry", lvl }, ex: "Casts from five tiles. The page you load sets the damage and the element." };
}
ITEMS.lastword = { name: "The Last Word", icon: "\u{1FA84}", slot: "weapon", speed: 2000, acc: 52, str: 26, launcher: { range: 6, ammo: "page", style: "magic" }, wand: true,
  req: { skill: "magic", lvl: 99 }, forgeWith: ["bogwoodlogs", 10], forgeReq: { skill: "wizardry", lvl: 99 },
  ex: "Every element in one crystal. It reaches further than any other wand in the game." };

/* ---------------- Magic Bags: only five, so progression is staggered; reforgeable, in spell paper */
const BAGS = [["bag_scrap", "Scrap Satchel"], ["bag_hedge", "Hedge Pouch"], ["bag_conjurer", "Conjurer's Satchel"], ["bag_starweave", "Starweave Bag"], ["bag_bottomless", "The Bottomless Bag"]];
BAGS.forEach(([k, name], i) => {
  ITEMS[k] = { name, icon: "\u{1F45C}", slot: "shield", pouch: { ammo: "page", cap: MAGIC.bagCap[i] }, req: { skill: "magic", lvl: MAGIC.bagLvl[i] },
    forgeWith: ["spellpaper", 10 + i * 10], forgeReq: { skill: "wizardry", lvl: MAGIC.bagLvl[i] },
    ex: `Holds ${MAGIC.bagCap[i].toLocaleString()} spell pages of one kind in the offhand. Load it from your bag: a wand casts only what is in its Magic Bag.` };
});

/* ---------------- utility pages: buffs and travel. One buff at a time, outside only, tiered by YOUR Wizardry when you read it */
export const CHARMS = {
  haste:       { name: "Haste",        el: "storm", lvl: 50, mins: 20,  vals: [8, 12, 16],  what: (v) => `+${v}% movement speed` },
  focus:       { name: "Focus",        el: "fire",  lvl: 66, mins: 15,  vals: [5, 8, 12],   what: (v) => `+${v}% accuracy and damage, in any style` },
  ward:        { name: "Ward",         el: "frost", lvl: 72, mins: 15,  vals: [5, 8, 12],   what: (v) => `+${v}% defence` },
  rainmaker:   { name: "Rainmaker",    el: "sun",   lvl: 60, mins: 120, vals: [25, 35, 50], what: (v) => `crops you plant grow ${v}% faster` },
  steadyhands: { name: "Steady Hands", el: "fire",  lvl: 55, mins: 15,  vals: [30, 40, 50], what: (v) => `${v}% less chance to burn food` },
  stonesense:  { name: "Stone Sense",  el: "void",  lvl: 84, mins: 20,  vals: [25, 40, 50], what: (v) => `gems turn up ${v}% more often in ore` },
  keeneye:     { name: "Keen Eye",     el: "void",  lvl: 99, mins: 15,  vals: [5, 8, 10],   what: (v) => `+${v}% chance of a rare drop` },
  tailwind:    { name: "Tailwind",     el: "storm", lvl: 91, mins: 15,  vals: [1, 1, 1],    what: () => "your bow and wand reach one tile further" },
  stillness:   { name: "Stillness",    el: "frost", lvl: 78, mins: 30,  vals: [3, 4, 5],    what: (v) => `fishing and woodcutting keep going ${v} minutes longer before the idle stop` },
};
for (const [k, C_] of Object.entries(CHARMS)) ITEMS[`scroll_${k}`] = { name: `${C_.name} scroll`, icon: "\u{1F4DC}", use: "charm", charm: k,
  ex: `Read it for ${C_.mins} minutes of: ${C_.what(C_.vals[0])} (tier I), up to ${C_.what(C_.vals[2])} (tier III). Your Wizardry sets the tier. One page buff at a time; the clock runs only outside.` };
ITEMS.scroll_homeward = { name: "Homeward scroll", icon: "\u{1F4DC}", use: "homeward", ex: "Read it and you are standing on your own island. Not in the Wilderness, and not while something is hitting you." };
/* four Waystones, spaced across the world: each at a fork or the far end of a branch, so you still walk to everything between */
export const WAYSTONES = {
  waystone_boneyard:    { scene: "boneyard",    side: "e", lvl: 52, name: "The Boneyard" },
  waystone_sands:       { scene: "sands",       side: "e", lvl: 63, name: "The Golden Sands" },
  waystone_thunderhead: { scene: "thunderhead", side: "e", lvl: 75, name: "The Thunderhead" },
  waystone_trailer:     { scene: "trailer",     side: "s", lvl: 87, name: "The Trailer Park" },
};
for (const [k, Wy] of Object.entries(WAYSTONES)) ITEMS[k] = { name: `Waystone: ${Wy.name}`, icon: "\u{1F4DC}", use: "waystone", ex: `Read it to arrive at the edge of ${Wy.name}. Not in the Wilderness, not inside a run, and not within 10 seconds of being hit.` };
/** the tier a reader gets from a utility page: their Wizardry, at the moment they read it */
export const charmTier = (c) => { const l = lvlOf(c, "wizardry"); return l >= MAGIC.tierAt[1] ? 3 : l >= MAGIC.tierAt[0] ? 2 : 1; };
/** the value of a running page buff, or 0 */
export const charmOf = (c, k) => (c?.charm && c.charm.k === k && (c.charm.left | 0) > 0 ? CHARMS[k].vals[(c.charm.tier || 1) - 1] : 0);

/* ---------------- stations: seven altars, paper at the fletching table, ink at the cauldron */
for (const el of ["arcane", ...ELEMENT_KEYS]) STATIONS[`altar_${el}`] = { skill: "wizardry", verb: "print", name: `${ELEMENTS[el].name} altar`, auto: false, kind: "print" };
STATIONS.altar_nexus = { skill: "wizardry", verb: "print", name: "the Nexus", auto: false, kind: "print", nexus: true };
/** the Nexus prints anything any altar prints, twice over, for half as much xp again */
export const NEXUS = { mult: 2, xp: 1.5 };
const pr = (id, r) => recipe(id, { ms: 2400, skill: "wizardry", ...r });
/* paper is pressed at the ARCANE altar: a Wizardry recipe belongs at a Wizardry station (the content check holds every station to its own skill) */
pr("press_paper", { station: "altar_arcane", lvl: 1, xp: 4, ms: 1800, in: [["logs", 1]], out: ["spellpaper", 5] });
pr("press_paper_willow", { station: "altar_arcane", lvl: 20, xp: 7, ms: 1800, in: [["willowlogs", 1]], out: ["spellpaper", 8] });
pr("press_paper_gallows", { station: "altar_arcane", lvl: 90, xp: 14, ms: 1800, in: [["gallowslogs", 1]], out: ["spellpaper", 14] });   /* (2026-09-27) the Deep's wood */
const INK = { arcane: [1, "small_vial", "sporecap", 2], sun: [10, "small_vial", "sunpetal", 3], fire: [20, "small_vial", "emberbloom", 3], frost: [30, "small_vial", "frostcap", 3], void: [40, "medium_vial", "voidlily", 3], storm: [50, "medium_vial", "stormcorn", 3] };
for (const [el, [lvl, vial, herb, n]] of Object.entries(INK)) recipe(`brew_ink_${el}`, { skill: "alchemy", station: "cauldron", ms: 2200, lvl, xp: 12 + lvl * 2, in: [[vial, 1], [herb, n]], out: [`ink_${el}`, 2] });
/* combat pages, ten to a print */
pr("print_page_arcane", { station: "altar_arcane", lvl: 1, xp: 10, in: [["spellpaper", 10], ["ink_arcane", 1]], out: ["page_arcane", 10] });
for (const el of ELEMENT_KEYS) PAGE_TIERS.forEach(([t, , plus], j) => { const lvl = ELEMENTS[el].base + plus;
  pr(`print_page_${el}_${t}`, { station: `altar_${el}`, lvl, xp: Math.round((10 + lvl) * (1 + j * 0.5)), in: [["spellpaper", 10], [`ink_${el}`, 1 + j]], out: [`page_${el}_${t}`, 10] }); });
/* utility pages, one to a print (two at the Nexus) */
for (const [k, C_] of Object.entries(CHARMS)) pr(`print_scroll_${k}`, { station: `altar_${C_.el}`, lvl: C_.lvl, xp: 30 + C_.lvl * 2, in: [["spellpaper", 2], [`ink_${C_.el}`, 2]], out: [`scroll_${k}`, 1] });
pr("print_scroll_homeward", { station: "altar_sun", lvl: 50, xp: 40, in: [["spellpaper", 2], ["ink_sun", 1]], out: ["scroll_homeward", 1] });
for (const [k, Wy] of Object.entries(WAYSTONES)) pr(`print_${k}`, { station: "altar_storm", lvl: Wy.lvl, xp: 30 + Wy.lvl * 2, in: [["spellpaper", 1], ["ink_storm", 1], ["grimstone", 1]], out: [k, 1] });   /* (2026-09-27) a stone that remembers a place: grimstone, from the Wilderness, is what a Waystone is printed on */
/* wands and bags are made at the Arcane altar */
const WAND_INK = ["arcane", "arcane", "sun", "sun", "fire", "fire", "frost", "void", "void"], WAND_GEM = [null, null, "ruby", "ruby", "sapphire", "sapphire", "topaz", "opal", "opal"];
WOODS.forEach((w, i) => pr(`make_${w.log}_wand`, { station: "altar_arcane", lvl: ARCHERY.useLvl.short[i], xp: 30 + i * 45,
  in: [[w.log, 3], [`ink_${WAND_INK[i]}`, 2], ...(WAND_GEM[i] ? [[WAND_GEM[i], 1]] : [])], out: [`${w.log}_wand`, 1] }));
pr("craft_lastword", { station: "altar_arcane", lvl: 99, xp: 6000, ms: 4000, in: [["bogwoodlogs", 5], ["singularity_core", 1], ["ink_storm", 5], ["ink_void", 5]], out: ["lastword", 1] });
const BAG_IN = [[["hide", 3], ["spellpaper", 5]], [["hide", 6], ["ink_sun", 3], ["ruby", 1]], [["hide", 10], ["ink_frost", 3], ["sapphire", 1]], [["hide", 15], ["ink_void", 4], ["topaz", 2]], [["hide", 20], ["ink_storm", 6], ["opal", 3]]];
BAGS.forEach(([k], i) => pr(`make_${k}`, { station: "altar_arcane", lvl: MAGIC.bagLvl[i], xp: 40 + i * 300, in: BAG_IN[i], out: [k, 1] }));
/* NOTHING IS A CERTAINTY (the owner's standing rule): every Wizardry recipe fails a flat tenth like smithed gear, and every ink has the
   cauldron's falling curve like every other brew. The one exemption is The Last Word, which eats a singularity core: the same reason nova
   and singularity gear are exempt at the anvil (craft_, not make_, so the craft check's make_ rule does not ask for it). */
for (const r of Object.values(RECIPES)) if (r.skill === "wizardry" && r.id !== "craft_lastword") r.fail = SMITH_FAIL;
for (const el of Object.keys(INK)) RECIPES[`brew_ink_${el}`].failStop = Math.min(99, INK[el][0] + 30);

/* ---------------- the altars in the world: added to each area's layout after it is built, on tiles found open all round
   (lt-magic/altarspots.mjs). The Nexus is in the Deep Wild, which lives in eastscape-closed.js and is added there. */
export const ALTAR_SITES = {
  workyard:    { t: "altar_arcane", x: 41, y: 6,  name: "Arcane altar: practice pages, wands and Magic Bags" },
  carnival:    { t: "altar_fire",   x: 22, y: 12, name: "Fire altar: Fire pages, Focus and Steady Hands" },
  cloud:       { t: "altar_frost",  x: 22, y: 12, name: "Frost altar: Frost pages, Ward and Stillness" },
  thunderhead: { t: "altar_storm",  x: 23, y: 10, name: "Storm altar: Storm pages, Haste, Tailwind and the Waystones" },
  vault:       { t: "altar_void",   x: 3,  y: 17, name: "Void altar: Void pages, Stone Sense and Keen Eye" },
  sands:       { t: "altar_sun",    x: 20, y: 12, name: "Sun altar: Sun pages, Rainmaker and Homeward" },
};
for (const [sc, A] of Object.entries(ALTAR_SITES)) {
  const def = SCENES[sc]; if (!def) continue; const build = def.build;
  def.build = function () { const r = build.call(this); r.objs.push({ t: A.t, art: `o_${A.t}`, x: A.x, y: A.y, name: A.name }); r.g[A.y][A.x] = r.g[A.y][A.x] === "p" ? "P" : "#"; return r; };
}

/* ---------------- what monsters are weak to, and what they resist */
const WEAK = {
  weaver: ["fire", "void"], marrowhound: ["sun", "frost"], grimlich: ["sun", "void"],
  toadstool: ["fire"], gnasher: ["fire"], boneidle: ["sun", "frost"],
  twister: ["fire"], moth: ["fire"], counter: ["void"], taxwraith: ["sun", "void"], shark: ["storm"],
  ghoul: ["sun", "frost"], stagehand: ["fire"], chandelier: ["fire"], usher: ["sun"], understudy: ["void"], critic: ["sun", "fire"],
  cobra: ["frost", "fire"], scarab: ["frost", "fire"], mummy: ["fire", "frost"], jackal: ["frost"],
  ram: ["void", "storm"], brainstorm: ["void", "storm"], seagoat: ["void"], revenant: ["sun", "frost"], angel: ["void", "sun"],
  goose: ["frost", "storm"], golem: ["void", "storm"], wolf: ["frost", "storm"], drake: ["fire", "frost"], house: ["void", "storm"],
  pinhead: ["fire", "void"], tripled: ["fire"], fatlady: ["fire"], strongman: ["void", "fire"], grinner: ["sun", "void"],
  warden: ["storm", "fire"], pitboss: ["storm", "fire"], hoard: ["storm", "frost"], dealer: ["storm", "sun"],
  junkdog: ["storm", "frost"], possum: ["fire"], scrapper: ["storm", "frost"], gator: ["frost"], junkking: ["storm", "fire"],
};
for (const [t, [weak, resist]] of Object.entries(WEAK)) if (MOBS[t]) { MOBS[t].weak = weak; if (resist) MOBS[t].resist = resist; }
/** the multiplier an element meets on a monster type */
export const elementMul = (t, el) => (!el || el === "arcane" ? 1 : [].concat(MOBS[t]?.weak).includes(el) ? MAGIC.weakMul : [].concat(MOBS[t]?.resist).includes(el) ? MAGIC.resistMul : 1);   /* (2026-09-27) a list works too: the Pumpkin King's ["fire", "sun"] never matched a plain === */

/* ---------------- seeds drop from the monsters of each element's home, a little over one kill in twenty */
const SEED_FROM = {
  seed_sun: ["boneidle", "ghoul", "usher", "revenant", "mummy", "critic", "taxwraith"],
  seed_ember: ["stagehand", "chandelier", "pinhead", "tripled", "fatlady", "strongman", "possum", "drake"],
  seed_frost: ["ram", "seagoat", "brainstorm", "goose", "wolf", "cobra", "jackal", "gator"],
  seed_void: ["angel", "golem", "house", "grinner", "warden", "hoard", "dealer", "understudy"],
};
for (const [seed, list] of Object.entries(SEED_FROM)) for (const t of list) if (MOBS[t]) (MOBS[t].drops ||= []).push([seed, [1, 2], 0.008]);   /* (2026-09-26, the owner: "all seeds need to be very rare") one kill in 125, from a little over one in twenty */
VALUE.spellpaper = 0; for (const k of [...Object.keys(SEED_NAMES), ...Object.keys(BLOOM_NAMES)]) VALUE[k] ??= 0;

/* ---------------- on the boards and in the panels */
if (MAGIC.live) {
  SKILL_GROUPS.find((g) => g.name === "Combat")?.keys.splice(2, 0, "magic");   /* Combat, Archery, Magic, Hitpoints */
  SKILL_GROUPS.find((g) => g.name === "Skilling")?.keys.push("wizardry");
  HISCORES.splice(2, 0, ["magic", "Magic", "level", "lvl"]);
  HISCORES.push(["wizardry", "Wizardry", "level", "lvl"]);
  SHOP.sells.push(["logs_wand", 40], ["bag_scrap", 30], ["page_arcane", 2]);   /* the Magic 1 kit, like the Archery 1 kit */
  KITS.push(["logs_wand", 1, 40], ["bag_scrap", 1, 30], ["page_arcane", 100, 200]);
}

/* (2026-09-23) THE THIEVING BOARD, added here rather than in the THIEVING block above, because HISCORES is
   declared BELOW that block and pushing to it from there is a temporal-dead-zone crash - one that only fires
   when THIEF.live is true, so it sat invisible for as long as the skill shipped dark. Third time an ordering
   like this has bitten in this feature (SHOP.sells and OPEN were the others): anything the switch turns on has
   to be pushed from AFTER the thing it is pushing into. */
if (THIEF.live) HISCORES.push(["thieving", "Thieving", "level", "lvl"]);
/* ============================================================ BREEDING (2026-09-27) — the first of the massive update's skills
   The owner: two of your pets go in the island's pen with the food they need; what comes out is a better pet. Very rare eggs
   drop from monsters and hatch in the pen's nest. Eight new pets from eggs, and a Legendary of each original pet. 12 hours
   and up, into days. The food is a grind, and some of it comes from early and mid-game drops so those monsters stay worth
   killing. His changes the same evening: eggs are "RARE but not that rare" (one kill in EGG_DROP), and the trough is filled
   ONCE, at the start, rather than an hourly chore.

   THREE TIERS. A base pet is what drops today. Two base pets make a GREATER pet (a pet INSTANCE with its own `fx`, one of
   the two parents' kinds, its kind's effects a quarter better and a little of the other parent). Two Greater pets of the
   SAME original kind make that kind's LEGENDARY, which is its own PETS entry with its own art. Pets in the pen are off the
   character (they cannot be worn, traded or bred twice) and come back when it is collected.

   (2026-09-27, the owner, testing it: "the pet pen UI in general is drastically way too confusing ... The complexity here should
   ONLY be in aquiring the pet drops and waiting for breeding to be done and the food required.") SIMPLIFIED, ALL OF IT:
   - THE PEN BREEDS AND NOTHING ELSE: two pets in, one better pet out. It is no longer a station.
   - EGGS HATCH IN A HATCHERY, a separate piece Yahsmeena sells (DECOR.hatchery). Put the egg in, wait. No gem, no nest, no level.
   - THREE PET FOODS, one per RANK, cooked at a campfire from things already in the world (drops and shrooms): Ordinary pet food
     (Cooking 20), Greater (50), Legendary (80). A pet is raised on the food of the rank it is BECOMING: an egg hatches on
     Ordinary food, a Greater pet is bred on Greater food, a Legendary on Legendary food. Every one of the fourteen per-pet foods,
     the feather nest and the opal are gone.
   The ranks are drawn differently everywhere a pet is shown (grey / blue with one star / gold with a crown), so what a pairing
   makes is obvious before it starts. */
export const BREED = {
  greater: { lvl: 1, ms: 12 * 3600000, food: 18, xpStart: 400, xpEnd: 4000 },   /* any two ordinary pets, from Breeding 1: pairing is how the skill is trained. (2026-09-27) food 6 -> 18, three times, the owner's word, once the parents came back */
  legend: { lvl: 50, ms: 72 * 3600000, food: 36, xpStart: 3000, xpEnd: 40000 },  /* two Greater pets of the same kind. (2026-09-27) food 12 -> 36, with the Greater */
  hatch: { food: 3 },                                                             /* an egg eats three Ordinary pet food, taken when it goes in */
  eggDrop: 1 / 3000,                                                              /* one kill in three thousand, anywhere: "rare but not that rare" */
  reach: 3,
  /* (2026-09-27, the owner: "add cooking pet food giving a little breeding XP if a user doesnt have a pet or egg") THE WAY IN. Every other
     source of Breeding xp needs a pet or an egg first, so a player who had found neither could not touch the skill. Cooking a batch of pet
     food trains it a little - ONLY while you own no pet, hold no egg, and have nothing in the pen or the hatchery (foodXpWhile). The moment
     you have one, the xp comes from the pen and the hatchery, and the trickle stops. */
  foodXp: { petfood_ordinary: 15, petfood_greater: 40, petfood_legend: 100 }
};
/** whether cooking pet food still trains Breeding for this character: no pet, no egg, nothing in the pen or the hatchery */
export const foodXpWhile = (c) => !petsOf(c).length && !c?.pen && !c?.hatch && !(c?.inv || []).some((s) => EGGS[s.k]) && !(c?.bank || []).some((s) => EGGS[s.k]);
/** the three ranks, with how they are drawn and what they eat */
export const RANKS = {
  ordinary: { name: "Ordinary", food: "petfood_ordinary", col: "#9a9a9a", mark: "" },
  greater: { name: "Greater", food: "petfood_greater", col: "#3f7fe0", mark: "★" },
  legend: { name: "Legendary", food: "petfood_legend", col: "#e0a820", mark: "♛" }
};
/** a pet instance's rank */
export const rankOf = (p) => (PETS[p?.k]?.legend ? "legend" : p?.tier ? "greater" : "ordinary");
SKILLS.breeding = { name: "Breeding", icon: "\u{1F95A}" };
SKILL_GROUPS.find((g) => g.name === "Skilling")?.keys.push("breeding");
HISCORES.push(["breeding", "Breeding", "level", "lvl"]);

/* the eight hatchlings: each helps ONE skill, which is how Breeding reaches the rest of the game. `bred` keeps every new pet
   out of the 1-in-1,000 kill pool and out of The Whole Kennel, whose "own them all" was written for the drop pets. */
Object.assign(PETS, {
  pocketowl:  { name: "Pocket Owl",        art: "pet_pocketowl",  bred: true, egg: "egg_speckled", fx: { reach: 1 },            ex: "It watches what you shoot at. Your bow reaches a tile further." },
  mossback:   { name: "Mossback Tortoise", art: "pet_mossback",   bred: true, egg: "egg_mossy",    fx: { tough: 10 },           ex: "Slow, patient, and nothing gets past it. You take 10% less damage." },
  trufflepig: { name: "Truffle Pig",       art: "pet_trufflepig", bred: true, egg: "egg_truffle",  fx: { grow: 25 },            ex: "Knows where the good stuff grows. Harvests come up a quarter heavier." },
  stormling:  { name: "Stormling",         art: "pet_stormling",  bred: true, egg: "egg_sparking", fx: { bite: 10 },            ex: "A pocket cloud. The fish come up to see it. Bites 10% more often." },
  salamander: { name: "Cinder Salamander", art: "pet_salamander", bred: true, egg: "egg_cindered", fx: { noburn: 50, freesmelt: 10 }, ex: "It keeps the fire honest. Half the burns, and a smelt now and then costs nothing." },
  ferret:     { name: "Fortune Ferret",    art: "pet_ferret",     bred: true, egg: "egg_velvet",   fx: { steal: 10 },           ex: "Small hands, quick hands. Pickpockets succeed 10% more." },
  crystalcrab:{ name: "Crystal Crab",      art: "pet_crystalcrab",bred: true, egg: "egg_geode",    fx: { gem: 50 },             ex: "It can smell a gem through rock. Gems turn up half again as often." },
  mimic:      { name: "Mimic",             art: "pet_mimic",      bred: true, egg: "egg_gilded",   fx: { slots: 3, gift: 1 },   ex: "A chest with legs and opinions. Three more bag slots, and once a day it coughs up a present." },
  /* the Legendaries: one per original pet (not the event cat). Each keeps its kind's effect, stronger, and adds one more. */
  cerberpup:  { name: "Cerberpup",               art: "pet_cerberpup",  bred: true, legend: true, base: "bonepup",     fx: { speed: 14, tix: 5 },               ex: "Three heads, one appetite. Legendary." },
  hoarder:    { name: "The Hoarder",             art: "pet_hoarder",    bred: true, legend: true, base: "packrat",     fx: { slots: 7 },                         ex: "It sits on your things like they were always its things. Legendary." },
  goldentoad: { name: "Golden Toad",             art: "pet_goldentoad", bred: true, legend: true, base: "cointoad",    fx: { tix: 25 },                          ex: "Solid gold and deeply smug about it. Legendary." },
  moonmoth:   { name: "Moon Moth",               art: "pet_moonmoth",   bred: true, legend: true, base: "lanternmoth", fx: { hp: 30, tough: 5 },                 ex: "It carries the moon around on its wings. Legendary." },
  housewins:  { name: "The House Always Wins",   art: "pet_housewins",  bred: true, legend: true, base: "housecat",    fx: { speed: 5, slots: 2, hp: 10, tix: 10 }, ex: "Deals, collects, and never loses. Legendary." },
  coilwyrm:   { name: "Coil Wyrm",               art: "pet_coilwyrm",   bred: true, legend: true, base: "coilling",    fx: { speed: 14, slots: 3, swing: 15 },   ex: "The Coilling grew wings and an attitude. Legendary." },
  /* (2026-09-27, the owner: "Hatched eggs need to be breedable as well as this is the natural next step") a Legendary for each of the
     eight hatchlings, so an egg starts a pet that can climb all the way: hatch it, breed two into Greaters, two Greaters into this. */
  oracleowl:    { name: "Oracle Owl",         art: "pet_oracleowl",    bred: true, legend: true, base: "pocketowl",   fx: { reach: 2, swing: 8 },            ex: "It saw that coming. Your bow reaches two tiles further, and you work faster. Legendary." },
  shellback:    { name: "Ancient Shellback",  art: "pet_shellback",    bred: true, legend: true, base: "mossback",    fx: { tough: 18, hp: 20 },             ex: "A tree grows on its back and it has never once hurried. Legendary." },
  trufflebaron: { name: "The Truffle Baron",  art: "pet_trufflebaron", bred: true, legend: true, base: "trufflepig",  fx: { grow: 45, tix: 5 },              ex: "Monocle, top hat, and a nose worth a fortune. Legendary." },
  tempest:      { name: "Tempest",            art: "pet_tempest",      bred: true, legend: true, base: "stormling",   fx: { bite: 20, speed: 8 },            ex: "The Stormling grew up angry. Fish bite, and you move with the wind. Legendary." },
  magmadrake:   { name: "Magma Drake",        art: "pet_magmadrake",   bred: true, legend: true, base: "salamander",  fx: { noburn: 80, freesmelt: 20 },     ex: "Nothing burns near it that it doesn't want burned. Legendary." },
  banditking:   { name: "The Bandit King",    art: "pet_banditking",   bred: true, legend: true, base: "ferret",      fx: { steal: 20, tix: 8 },             ex: "Mask, cape, and somebody else's coin purse. Legendary." },
  diamondcrab:  { name: "Diamond Crab",       art: "pet_diamondcrab",  bred: true, legend: true, base: "crystalcrab", fx: { gem: 100, slots: 2 },            ex: "Its shell is one flawless stone. Gems come twice as often. Legendary." },
  grandmimic:   { name: "Grand Mimic",        art: "pet_grandmimic",   bred: true, legend: true, base: "mimic",       fx: { slots: 6, gift: 1, tix: 5 },     ex: "A crown, a grin, and room for everything. Legendary." }
});
export const LEGEND_OF = Object.fromEntries(Object.entries(PETS).filter(([, p]) => p.legend).map(([k, p]) => [p.base, k]));

/* THE EGGS. Weighted by where the kill is, so each has a home; one kill in EGG_DROP anywhere rolls one. */
export const EGGS = {
  egg_speckled: { pet: "pocketowl",   ms: 12 * 3600000,  xp: 1500,  from: ["workyard", "gloam"] },
  egg_mossy:    { pet: "mossback",    ms: 18 * 3600000,  xp: 2200,  from: ["gloam", "mire"] },
  egg_truffle:  { pet: "trufflepig",  ms: 24 * 3600000,  xp: 4000,  from: ["mire", "boneyard"] },
  egg_sparking: { pet: "stormling",   ms: 24 * 3600000,  xp: 6000,  from: ["boneyard", "cloud"] },
  egg_cindered: { pet: "salamander",  ms: 48 * 3600000,  xp: 9000,  from: ["cloud", "sands", "thunderhead"] },
  egg_velvet:   { pet: "ferret",      ms: 48 * 3600000,  xp: 13000, from: ["thunderhead", "carnival", "wild"] },
  egg_geode:    { pet: "crystalcrab", ms: 72 * 3600000,  xp: 20000, from: ["carnival", "vault", "wild", "deep"] },
  egg_gilded:   { pet: "mimic",       ms: 120 * 3600000, xp: 32000, from: ["vault", "trailer", "deep"] }
};
const EGG_NAMES = { egg_speckled: "Speckled egg", egg_mossy: "Mossy egg", egg_truffle: "Truffle-scented egg", egg_sparking: "Sparking egg", egg_cindered: "Cindered egg", egg_velvet: "Velvet egg", egg_geode: "Geode egg", egg_gilded: "Gilded egg" };
for (const [k, e] of Object.entries(EGGS)) ITEMS[k] = { name: EGG_NAMES[k], icon: "\u{1F95A}", ex: `Put it in a hatchery on your island with ${BREED.hatch.food} Ordinary pet food: a ${PETS[e.pet].name} in ${Math.round(e.ms / 3600000)} hours. Tradable.` };
/** which egg a kill in this scene rolls: one whose home it is, else any */
export const eggFor = (sceneKey, r = Math.random()) => { const base = String(sceneKey || "").split(":")[0]; const here = Object.keys(EGGS).filter((k) => EGGS[k].from.includes(base)); const pool = here.length ? here : Object.keys(EGGS); return pool[Math.floor(r * pool.length) % pool.length]; };

/* THE FOOD: three kinds, cooked at a campfire, each from more than one pair of ingredients so whatever you happen to be carrying
   from that stretch of the game will do. Ordinary is early drops and early shrooms, Greater mid-game, Legendary late and wild. */
Object.assign(ITEMS, {
  petfood_ordinary: { name: "Ordinary pet food", icon: "\u{1F9B4}", ex: "A sack of plain kibble. Hatchlings are raised on it: a hatchery takes three with every egg." },
  petfood_greater: { name: "Greater pet food", icon: "\u{1F96B}", ex: "A tin of the good stuff. Two ordinary pets in the pen eat six of these to make a Greater one." },
  petfood_legend: { name: "Legendary pet food", icon: "\u{1F451}", ex: "A golden bowl, heaped. Two Greater pets of one kind eat twelve of these to make its Legendary." }
});
Object.assign(VALUE, { petfood_ordinary: 20, petfood_greater: 70, petfood_legend: 180 });
const pfood = (id, rank, lvl, xp, ins, n) => recipe(`petfood_${id}`, { skill: "cooking", station: "fire", lvl, xp, ms: 2400, in: ins, out: [RANKS[rank].food, n] });
pfood("beef", "ordinary", 20, 30, [["beef", 1], ["buttoncap", 2]], 3);
pfood("chicken", "ordinary", 20, 30, [["chicken", 1], ["sporecap", 2]], 3);
pfood("pork", "ordinary", 20, 30, [["pork", 1], ["oyster", 1]], 3);
pfood("tusk", "greater", 50, 90, [["tusk", 1], ["bluemould", 2]], 3);
pfood("scarab", "greater", 50, 90, [["scarabshell", 1], ["inkcap", 2]], 3);
pfood("fur", "greater", 50, 90, [["staticfur", 1], ["glowcap", 1]], 3);
pfood("web", "greater", 50, 90, [["cobweb", 2], ["puffball", 2]], 3);
pfood("marrow", "legend", 80, 200, [["marrow", 1], ["lionsmane", 1]], 2);
pfood("grimscale", "legend", 80, 200, [["grimscale", 1], ["voidmorel", 1]], 2);
pfood("catalytic", "legend", 80, 200, [["catalytic", 1], ["starcap", 1]], 2);
pfood("fang", "legend", 80, 200, [["snakefang", 1], ["truffle", 1]], 2);

/* (2026-09-27, the owner: "we need some mechanism where pets stats can mix and match, almost like a selector thats 'take this 1 stat
   from a pet, take this other stat from a pet' ... think pokemon") PICK ONE STAT FROM EACH PARENT. The child carries exactly the two
   stats chosen, one from each parent, and (for a Greater) the look of whichever parent you choose.
   - A GREATER child gets both picks a quarter stronger (+1 for bag slots, a present stays a present, bow range stays as it is).
   - A LEGENDARY keeps its own powers and adds the two picks at the parents' values; where a pick is a power it already has, the
     bigger of the two stands. So two Greater pets bred for the right stats make a better Legendary: the Pokemon part.
   The two picks must be different stats: the same one twice would only be the bigger of them, which is not a choice. */
/** a pet instance's stats: its own (a Greater or bred one) or its kind's */
export const petStats = (p) => p?.fx || PETS[p?.k]?.fx || {};
const boost = (k, v) => (k === "slots" ? v + 1 : k === "gift" ? 1 : k === "reach" ? v : Math.ceil(v * 1.25));
/** the child's stats from the two picks ([key, value] from each parent) */
export function mixFx(kind, pickA, pickB) {
  const out = {}; for (const [k, v] of [pickA, pickB]) if (k) out[k] = Math.max(out[k] || 0, boost(k, v)); return out;
}
/** a Legendary's stats with the two picks added */
export const legendFx = (child, pickA, pickB) => { const out = { ...(PETS[child]?.fx || {}) }; for (const [k, v] of [pickA, pickB]) if (k) out[k] = Math.max(out[k] || 0, v); return out; };
/** the default pick from a parent: its strongest stat that the other pick is not */
export const bestStat = (p, not) => Object.entries(petStats(p)).filter(([k]) => k !== not && k !== "gift").sort((x, y) => y[1] - x[1])[0] || Object.entries(petStats(p))[0] || [null, 0];
/** (before 2026-09-27's picks) a Greater child's effects: its own kind's a quarter better, and the other parent's strongest at a quarter. Kept for old callers. */
export function greaterFx(kind, otherKind) {
  const own = PETS[kind]?.fx || {}, other = PETS[otherKind]?.fx || {}, out = {};
  for (const [k, v] of Object.entries(own)) out[k] = k === "slots" ? v + 1 : k === "gift" ? 1 : Math.ceil(v * 1.25);
  const top = Object.entries(other).filter(([k]) => k !== "gift").sort((a, b) => b[1] - a[1])[0];
  if (top && out[top[0]] == null) out[top[0]] = top[0] === "slots" || top[0] === "reach" ? 1 : Math.max(1, Math.ceil(top[1] * 0.25));
  return out;
}
/** what a pairing of these two pet instances is, or why it is not one: { kind: "greater"|"legend", ... } | { no: text } */
export function pairOf(a, b) {
  if (!a || !b || a.id === b.id) return { no: "Pick two different pets." };
  const A = PETS[a.k], B = PETS[b.k]; if (!A || !B) return { no: "Pick two pets." };
  if (A.event || B.event) return { no: "Event pets cannot breed." };
  if (A.legend || B.legend) return { no: "Legendary pets cannot breed: a Legendary is as far as a pet goes." };
  if (a.tier && b.tier) {
    if (a.k !== b.k) return { no: `You cannot breed a Greater ${A.name} with a Greater ${B.name}. A Legendary needs two Greater pets of the same kind.` };
    if (!LEGEND_OF[a.k]) return { no: `There is no Legendary ${A.name}. Yet.` };
    return { kind: "legend", lvl: BREED.legend.lvl, ms: BREED.legend.ms, child: LEGEND_OF[a.k], food: [[RANKS.legend.food, BREED.legend.food]], stats: [petStats(a), petStats(b)] };
  }
  if (a.tier || b.tier) return { no: "You cannot breed an Ordinary pet with a Greater pet. Two Ordinary pets make a Greater; two Greater pets of the same kind make a Legendary." };
  return { kind: "greater", lvl: BREED.greater.lvl, ms: BREED.greater.ms, kinds: [...new Set([a.k, b.k])], food: [[RANKS.greater.food, BREED.greater.food]], stats: [petStats(a), petStats(b)] };
}
/** a pet's effects in words, for the pets panel and the pen */
export const petFxText = (fx) => Object.entries(fx || {}).map(([k, v]) => ({ slots: `+${v} bag slots`, hp: `+${v} hitpoints`, tix: `+${v}% tickets`, speed: `+${v}% walk speed`, swing: `+${v}% work speed`, reach: `+${v} bow range`, tough: `${v}% less damage`, grow: `+${v}% harvests`, bite: `+${v}% bites`, noburn: `${v}% fewer burns`, freesmelt: `${v}% free smelts`, steal: `+${v}% pickpocket`, gem: `+${v}% gems`, gift: "a daily present" }[k] || `${k} ${v}`)).join(" · ");
export const PET_GIFTS = [["tickets", [400, 1500], 70], ["clover", [1, 2], 15], ["pumpkinpie", [1, 1], 0], ["tp_scroll", [1, 2], 15]];

export const questsDone = (c) => Object.values(c?.qs || {}).filter((q) => q?.state === "done").length + (c?.tour && c.tour.step >= TOUR.length ? 1 : 0) + ((c?.stats?.jobs | 0) || 0);
export const VERB = { pen: "Open", hatchery: "Open",   /* (2026-09-27) Breeding */ fletcher: "Fletch-at",   /* (2026-09-25) written INTO the literal rather than assigned after: VERB is declared later in the file than FLETCH goes live, and a const cannot be reached before its line */ countdoor: "Break into", countsearch: "Search", countbox: "Unlock", countexit: "Leave by", towerdoor: "Enter", towerup: "Climb", cryptdoor: "Go down", cryptlever: "Pull", cryptexit: "Climb", cryptloot: "Open", hsboard: "Read", jukebox: "Play", prizecase: "Browse", mirror: "Look in", rrtable: "Sit at", rrseat: "Sit at", rrboard: "Read", barcart: "Drink at", prizewheel: "Spin", fameboard: "Read", cart: "Ride", fight: "Bet on", coinstatue: "tickets in at", cooler: "Drink at", buffet: "Eat at", cashier: "tickets in at", howto: "Read", game: "Play", board: "Read", roulette: "Play", roomdoor: "Enter", walldoor: "Enter", cook: "Cook-at", smelt: "Smelt-at", smith: "Smith-at", pvp: "Attack", ground: "Take", rope: "Climb-up", ferry: "Board", boatback: "Sail-home", plot: "Tend", pedestal: "Use", islesign: "Read", bank: "Bank at", exchange: "Trade at", player: "Trade with", enter: "Enter", hole: "Climb-down", mob: "Attack", npc: "Talk-to", mark: "Pickpocket", guildgate: "Open", wheat: "Pick", spot: "Fish", door: "Open", well: "Search", rock: "Mine", vein: "Mine", wreck: "Strip", tree: "Chop down", olive: "Pick", shrine: "Pray-at", notice: "Read", sign: "Read" };

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
    reward: { coins: 60, xp: { melee: 200 }, text: "60 tickets and 200 Melee xp" }
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
    reward: { coins: 25000, xp: { melee: 12000, hp: 4000 }, text: "25,000 tickets, 12,000 Melee xp, 4,000 Hitpoints xp" }
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

/* ------------------------------------------------------------ THE FORTY (2026-09-27)
   The owner: "intertwine quests with all skills. varying degrees of quest hardness, with appropriate rewards. easy, medium, hard.
   I don't want bland quests like 'go get X thing'. they should be go to NPC, it has some dialogue about the quest, go talk to X
   NPC, get this thing, bring it over here, etc. I want 40 of them thought out all the way to end game."
   Forty staged quests, fourteen easy (the Yard, the Gloam and the Mire, levels 1-25), fourteen medium (the Boneyard, Cloudreach
   and the Sands, 25-55) and twelve hard (the Thunderhead, the Vault, the Carnival, the Trailer Park and the Wilderness, 55-99),
   every skill in the game pulled in somewhere. Seven people were hired to give them: Mudge in the Mire, Sister Morrow in the
   Boneyard, Zephyr in Cloudreach, Rashid in the Sands, Volta in the Thunderhead, the Auditor in the Vault and Grimm the Hermit,
   who sits by the rope down to the Wilderness. Rewards: tickets in the hundreds for easy, low thousands for medium, five figures for
   hard, and xp in the skills the quest actually used. Every giver's chain is gated in order, so a new player is never handed the
   Deep Wild. The stage types are documented above QUEST_TIERS. */
Object.assign(QUESTS, {
  /* ================= EASY ================= */
  sardines: {
    name: "The Ferryman's Supper", giver: "Charon the Ferryman", where: "The Yard", icon: "🐟", tier: "easy",
    brief: "Charon wants five cooked sardines. Fish them from the Yard's pond and cook them on a fire.",
    stages: [{ type: "gather", items: ["sardine"], n: 5, what: "sardines", how: "gather" }, { type: "gather", items: ["csardine"], n: 5, what: "cooked sardines", how: "cook" }, { type: "bring", items: ["csardine"], n: 5, what: "cooked sardines" }],
    talk: { offer: ["A ferryman eats standing up, and lately he eats nothing.", "Five sardines out of the pond, cooked on a fire. Hold a rod at the water, then hold the fish at the flames."], accept: "Five sardines, cooked.", decline: "Row your own supper.",
      accepted: "The pond is west of the counter. The fire is by the smithy. Neither of them moves.", progress: "Five cooked sardines. You have {have}. I have all evening.", ready: "That smells like a river I used to know.", hand: "Supper.", done: "Sit. No, you're right, there's nowhere to sit. Take this instead." },
    reward: { coins: 150, xp: { fishing: 250, cooking: 250 }, text: "150 tickets, 250 Fishing xp, 250 Cooking xp" }
  },
  ferry: {
    name: "Charon's Ledger", giver: "Charon the Ferryman", where: "The Yard", icon: "⛵", tier: "easy", requires: ["sardines"],
    brief: "Charon has never seen the islands he rows to. Go to yours, talk to Yahsmeena, and bring back three wheat as proof.",
    stages: [{ type: "visit", scene: "isle", what: "your island" }, { type: "talk", npc: "Yahsmeena", say: ["Charon sent you? He won't set foot on the sand, you know. Says the ground moves.", "Tell him the plots are fine and the bank chest is still ten thousand."], reply: "I'll tell him.", after: "And take him some wheat. He forgets to eat." }, { type: "bring", items: ["wheat"], n: 3, what: "wheat" }],
    talk: { offer: ["I have rowed to your island four hundred times and I have never got out of the boat.", "Go and look at it for me. Talk to the woman who sells the furniture. Bring me three wheat, so I know it's real."], accept: "I'll have a look.", decline: "Row yourself.",
      accepted: "Click the boat. It knows the way.", progress: "Did you see it? Three wheat and a word from Yahsmeena. You have {have} wheat.", ready: "So it's there. Good. I'd started to wonder.", hand: "Here's your wheat.", done: "I'll plant it. Somewhere. Take this." },
    reward: { coins: 200, xp: { farming: 300 }, text: "200 tickets, 300 Harvesting xp" }
  },
  copperbell: {
    name: "A Bell for the Broker", giver: "Livia the Broker", where: "The Yard", icon: "🔔", tier: "easy",
    brief: "Livia wants a bell for the exchange. Two bronze bars will do: copper and tin from the Yard, into the furnace.",
    stages: [{ type: "talk", npc: "Charon the Ferryman", say: ["The furnace? East of the pond, the brick one with the chimney. It takes copper and tin and gives you bronze.", "Livia wants a bell. Livia wants a lot of things."], reply: "Thanks." }, { type: "gather", items: ["bronze_bar"], n: 2, what: "bronze bars", how: "craft" }, { type: "bring", items: ["bronze_bar"], n: 2, what: "bronze bars" }],
    talk: { offer: ["Every exchange in the world has a bell, and mine has me shouting.", "Two bronze bars, and I'll have one cast. Charon knows where the furnace is; ask him, he likes being asked."], accept: "Two bars.", decline: "Keep shouting.",
      accepted: "Copper and tin are the two rocks by the path. Hold a pickaxe.", progress: "Two bronze bars for the bell. You have {have}.", ready: "Bronze. Real bronze. Give it here.", hand: "Two bars.", done: "I'll have it cast by the weekend. Take this, and keep your ears open." },
    reward: { coins: 200, xp: { smithing: 300, mining: 150 }, text: "200 tickets, 300 Smithing xp, 150 Mining xp" }
  },
  wheatrun: {
    name: "The Standing Order", giver: "Livia the Broker", where: "The Yard", icon: "🌾", tier: "easy", requires: ["copperbell"],
    brief: "Livia's kitchen order: ten wheat, picked from the wild patches in the Yard.",
    stages: [{ type: "gather", items: ["wheat"], n: 10, what: "wheat", how: "gather" }, { type: "bring", items: ["wheat"], n: 10, what: "wheat" }],
    talk: { offer: ["There's a standing order for wheat from the kitchen, and the man who used to fill it stands no more.", "Ten wheat. It grows wild in three patches out here; pick it, it grows back."], accept: "Ten wheat.", decline: "Find another picker.",
      accepted: "North-west above the copper, by the middle path, and out in the south-west meadow. Nothing in your hand needed.", progress: "Ten wheat. You have {have}. The kitchen is patient; I am not.", ready: "That's the order. Hand it over.", hand: "Ten.", done: "The kitchen thanks you. I thank you. That's a lot of thanks for one bundle." },
    reward: { coins: 150, xp: { farming: 300 }, text: "150 tickets, 300 Harvesting xp" }
  },
  emeraldedge: {
    name: "An Emerald Edge", giver: "Livia the Broker", where: "The Yard", icon: "🗡️", tier: "easy", requires: ["wheatrun"],
    brief: "Livia has a buyer for an emerald gladius. Mine the ore in the Gloam, smelt it, forge the blade, bring it back.",
    stages: [{ type: "gather", items: ["emerald_ore"], n: 3, what: "emerald ore", how: "gather" }, { type: "gather", items: ["emerald_bar"], n: 1, what: "emerald bar", how: "craft" }, { type: "bring", items: ["emerald_gladius"], n: 1, what: "emerald gladius" }],
    talk: { offer: ["I have a buyer for an emerald gladius and no smith with the nerve.", "The ore is in the Gloam, west of here. Smelt it, forge it, bring me the blade. I'll pay what the buyer pays, less nothing."], accept: "One gladius.", decline: "Your buyer can wait.",
      accepted: "Green rocks, two of them, in the Gloam. Then the furnace, then the anvil. Mind the highwaymen.", progress: "The gladius. Ore, then bar, then blade. You have {have} of what I need right now.", ready: "Oh, that's a blade. Give it here before I cut myself.", hand: "One gladius.", done: "Sold before you've turned round. Here's your cut." },
    reward: { coins: 500, xp: { smithing: 800, mining: 300 }, text: "500 tickets, 800 Smithing xp, 300 Mining xp" }
  },
  firstbow: {
    name: "Grimm's Bow", giver: "Grimm the Hermit", where: "The Gloam", icon: "🏹", tier: "easy",
    brief: "Grimm will teach the bow. Make a bowstring and fifteen bone arrows at the fletching table, then take five gnashers from a distance.",
    stages: [{ type: "gather", items: ["bowstring"], n: 1, what: "bowstring", how: "craft" }, { type: "gather", items: ["bone_arrow"], n: 15, what: "bone arrows", how: "craft" }, { type: "kill", mob: "gnasher", n: 5, what: "gnashers", style: "archery" }],
    talk: { offer: ["You walk up to everything and hit it. That works until it doesn't.", "Make a bowstring from a hide, fletch fifteen bone arrows, and put five gnashers down without getting close. The table is in the Yard's court."], accept: "Teach me.", decline: "I like hitting things.",
      accepted: "Bones, shafts, feathers. Chickens have the feathers. Then hold the bow and click something you'd rather not touch.", progress: "Bowstring, fifteen arrows, five gnashers with the bow. Where are you up to? {have}.", ready: "Five, from where you stood. Now you're dangerous.", hand: "It's done.", done: "Take this longbow. It reaches further than mine ever did." },
    reward: { coins: 400, xp: { fletching: 500, archery: 500 }, items: [["logs_longbow", 1]], text: "400 tickets, 500 Fletching xp, 500 Archery xp, a longbow" }
  },
  firstpage: {
    name: "The First Page", giver: "Grimm the Hermit", where: "The Gloam", icon: "📄", tier: "easy", requires: ["firstbow"],
    brief: "Grimm's other trick. Press ten spell paper, print ten Arcane pages at the altar in the Yard, and burn five toadstools with a wand.",
    stages: [{ type: "gather", items: ["spellpaper"], n: 10, what: "spell paper", how: "craft" }, { type: "gather", items: ["page_arcane"], n: 10, what: "Arcane pages", how: "craft" }, { type: "kill", mob: "toadstool", n: 5, what: "toadstools", style: "magic" }],
    talk: { offer: ["The bow is one way of not being touched. The other is older.", "Logs into paper at the Arcane altar in the Yard, paper and ink into pages, pages into a bag, and a wand in your hand. Then five toadstools, out here, without a sword."], accept: "Show me the other way.", decline: "One trick is enough.",
      accepted: "Bom sells the wand and the bag if you can't make them. Arcane ink is sporecaps in a vial.", progress: "Paper, pages, five toadstools by wand. You're at {have}.", ready: "Five, and not a hair on you singed. Good.", hand: "Done.", done: "Then here's a hundred pages, and my respect, which is worth less." },
    reward: { coins: 400, xp: { wizardry: 500, magic: 500 }, items: [["page_arcane", 100]], text: "400 tickets, 500 Wizardry xp, 500 Magic xp, 100 Arcane pages" }
  },
  lamps: {
    name: "Lamps Out", giver: "Mudge the Lamplighter", where: "The Lantern Mire", icon: "🏮", tier: "easy",
    brief: "Mudge's lamps are out. Vance in the Gloam sells the wicks; the oil is six sporecaps from the toadstools.",
    stages: [{ type: "talk", npc: "Vance the Fence", say: ["Mudge sent you? Wicks are on the house, I owe him for a night I don't discuss.", "The oil he wants is sporecap: the toadstools out here shed it. Six, he says. Six."], reply: "Six sporecaps." }, { type: "bring", items: ["sporecap"], n: 6, what: "sporecaps", say: ["Six. Feel them: they burn slow. That's the whole trick of a mire lamp."], short: ["Six sporecaps, from the Gloam's toadstools. Vance has the wicks."], reply: "Here's the oil." }],
    talk: { offer: ["Eleven lamps on this mire, and nine of them out. You can't see the water till you're in it.", "Vance, back in the Gloam, has my wicks. The oil is sporecap, six of them, off the toadstools. Bring me the oil and I'll do the climbing."], accept: "Wicks and oil.", decline: "Mind the water, then.",
      accepted: "Vance first, he'll want to be asked. Then the toadstools. Then me.", progress: "Six sporecaps. You've {have}. The dark doesn't wait, but I do.", ready: "Oil. Lovely. Stand back, this bit's mine.", hand: "Six sporecaps.", done: "There. Eleven of eleven. Take this for your trouble, and mind the ninth lamp, it flickers." },
    reward: { coins: 300, xp: { alchemy: 400 }, items: [["small_vial", 3]], text: "300 tickets, 400 Alchemy xp, 3 small vials" }
  },
  vials: {
    name: "Glass and Sand", giver: "Mudge the Lamplighter", where: "The Lantern Mire", icon: "🧪", tier: "easy", requires: ["lamps"],
    brief: "Mudge wants a Swift draught. Blow three vials from sand, brew the draught at the cauldron, bring it.",
    stages: [{ type: "gather", items: ["small_vial"], n: 3, what: "small vials", how: "craft" }, { type: "gather", items: ["pot_swift"], n: 1, what: "Swift draught", how: "craft" }, { type: "bring", items: ["pot_swift"], n: 1, what: "Swift draught" }],
    talk: { offer: ["My knees. Don't ask. There's a draught that makes a man quick for ten minutes and I'd like ten minutes.", "Three vials from sand at the cauldron, and the draught is sporecaps in one of them. Bring me the draught; keep the other two vials."], accept: "One Swift draught.", decline: "Rest your knees.",
      accepted: "The cauldron is in the Yard's court. Sand is by the pond.", progress: "A Swift draught. Vials first. You're at {have}.", ready: "Give it here before I change my mind about my knees.", hand: "One draught.", done: "Oh. OH. Right, I'm off to do the lamps at a run. Take this." },
    reward: { coins: 250, xp: { alchemy: 400 }, text: "250 tickets, 400 Alchemy xp" }
  },
  lanterns: {
    name: "Lights on the Mire", giver: "Mudge the Lamplighter", where: "The Lantern Mire", icon: "🌪️", tier: "easy", requires: ["vials"],
    brief: "The twisters keep knocking the lamps down. Put six of them down and bring Mudge four of the tax receipts they carry.",
    stages: [{ type: "kill", mob: "twister", n: 6, what: "twisters" }, { type: "bring", items: ["receipt"], n: 4, what: "tax receipts" }],
    talk: { offer: ["It's the twisters. They come through and the lamps go over like skittles.", "Six of them, and bring me four of the receipts they carry. I want to know who they're paying."], accept: "Six twisters.", decline: "Buy heavier lamps.",
      accepted: "They're all over the west of the mire. Hold your sword. Or don't; you've got a bow now.", progress: "Six twisters, four receipts. You've {have}.", ready: "Receipts. Let me see. Well. Well well.", hand: "Four receipts.", done: "They're paying the Counters. Interesting. Not your problem. Take this." },
    reward: { coins: 500, xp: { melee: 600, hp: 200 }, text: "500 tickets, 600 Melee xp, 200 Hitpoints xp" }
  },
  tomatoes: {
    name: "Rotten Business", giver: "Rony Tomo", where: "The Casino", icon: "🍅", tier: "easy",
    brief: "Rony's tomatoes are rotten and walking about. Put eight down and bring him five good tomatoes off them.",
    stages: [{ type: "kill", mob: "rotten", n: 8, what: "rotten tomatoes" }, { type: "bring", items: ["tomatoe"], n: 5, what: "tomatoes" }],
    talk: { offer: ["My name's on the tomatoes out there and half of them have gone bad. Bad and MOBILE.", "Eight of the rotten ones, and bring me five decent tomatoes off them. The good ones are still in there somewhere."], accept: "Eight rotten, five good.", decline: "Not my tomatoes.",
      accepted: "They're in the Yard, all over. You'll smell them first.", progress: "Eight rotten, five good tomatoes. You're at {have}.", ready: "Those'll do for sauce. Give them here.", hand: "Five tomatoes.", done: "This is the Cowboys' year AND the tomatoes' year. Take this." },
    reward: { coins: 200, xp: { melee: 250, farming: 150 }, text: "200 tickets, 250 Melee xp, 150 Harvesting xp" }
  },
  hidesale: {
    name: "Leather for Kellz", giver: "Kellz", where: "The Casino", icon: "🧤", tier: "easy",
    brief: "Kellz wants six hides for a jacket. Cows and boars carry them.",
    stages: [{ type: "gather", items: ["hide"], n: 6, what: "hides" }, { type: "bring", items: ["hide"], n: 6, what: "hides" }],
    talk: { offer: ["I'm having a jacket made. Leather. Six hides, the man says, and I don't own a sword.", "Cows and boars in the Yard. Six hides, and I'll cover the cleaning."], accept: "Six hides.", decline: "Wear something else.",
      accepted: "Cows are easy. Boars are less easy. Both are outside.", progress: "Six hides. You've got {have}.", ready: "That's a jacket. Give them here.", hand: "Six hides.", done: "Take this quiver, the tailor threw it in and I don't shoot." },
    reward: { coins: 200, xp: { fletching: 200 }, items: [["logs_quiver", 1]], text: "200 tickets, 200 Fletching xp, a rough quiver" }
  },
  runclock: {
    name: "Beat the Clock", giver: "Vince the Bouncer", where: "The Casino", icon: "⏱️", tier: "easy",
    brief: "Vince says nobody's fast any more. Go and run The Run, the agility course down the rope ladder in the Gloam.",
    stages: [{ type: "visit", scene: "agility", what: "The Run" }],
    talk: { offer: ["Nobody's quick any more. They walk up to a gate and wait for it like it's a bus.", "There's a course under the Gloam. Down the ladder by the north path. Go and run it, once, and come and tell me you did."], accept: "I'll run it.", decline: "I'll walk, thanks.",
      accepted: "The gates open on a clock. Watch them once, then go.", progress: "Have you run it? The ladder's by the Gloam's north door.", ready: "You ran it. Your knees say so.", hand: "I ran it.", done: "Good. Now do it again without me telling you to." },
    reward: { coins: 200, xp: { agility: 300 }, text: "200 tickets, 300 Agility xp" }
  },
  stickyfingers: {
    name: "The Membership Fee", giver: "Odile the Clerk", where: "The Thieves' Guild", icon: "🎟️", tier: "easy",
    brief: "The guild wants its fee paid to Sticky Pete, in tickets, before anyone teaches you anything.",
    stages: [{ type: "bring", items: ["tickets"], n: 250, what: "tickets", to: "Sticky Pete", say: ["Two hundred and fifty. Count it. Counted. You're in, provisionally."], short: ["Two hundred and fifty tickets, and not a ticket less. Odile keeps the book."], reply: "Here's the fee." }],
    talk: { offer: ["Membership is two hundred and fifty tickets, paid to Pete, who is not to be trusted with it, which is the first lesson.", "Come back to me after and I'll enter you in the book."], accept: "I'll pay Pete.", decline: "I'll think about it.",
      accepted: "Pete is in the first room. Watch your pockets while you pay him.", progress: "Has Pete got his fee? Bring him two hundred and fifty tickets.", ready: "Pete's told me. You're in the book.", hand: "I paid.", done: "The lifters are through there. Try not to be caught in your first hour." },
    reward: { coins: 100, xp: { thieving: 400 }, text: "100 tickets back, 400 Thieving xp" }
  },
  /* ================= MEDIUM ================= */
  morrowbones: {
    name: "Grave Duty", giver: "Sister Morrow", where: "The Boneyard", icon: "⚰️", tier: "medium",
    brief: "Sister Morrow wants ten ghouls put back in the ground and ten bones to build the next row of graves.",
    stages: [{ type: "kill", mob: "ghoul", n: 10, what: "ghouls" }, { type: "bring", items: ["bones"], n: 10, what: "bones" }],
    talk: { offer: ["They get up. I put them down. It's been a long few years.", "Ten ghouls, and bring me ten bones. I'm building the east row and the supplier's dead. Literally."], accept: "Ten ghouls, ten bones.", decline: "Rest in peace, Sister.",
      accepted: "They're in the yards, behind the rails. Mind the Understudy, he's dramatic.", progress: "Ten ghouls, then ten bones. You're at {have}.", ready: "Bones. Good bones. Give them here.", hand: "Ten bones.", done: "The east row's half done. Take this and go and get some sun, you look like one of them." },
    reward: { coins: 1200, xp: { melee: 1200, hp: 600 }, text: "1,200 tickets, 1,200 Melee xp, 600 Hitpoints xp" }
  },
  yewbow: {
    name: "Yew for the Sister", giver: "Sister Morrow", where: "The Boneyard", icon: "🌳", tier: "medium", requires: ["morrowbones"],
    brief: "Morrow wants a yew longbow. Cut three yew logs from the Ancient yews here, fletch the bow, bring it back.",
    stages: [{ type: "gather", items: ["yewlogs"], n: 3, what: "yew logs", how: "gather" }, { type: "gather", items: ["yewlogs_longbow"], n: 1, what: "yew longbow", how: "craft" }, { type: "bring", items: ["yewlogs_longbow"], n: 1, what: "yew longbow" }],
    talk: { offer: ["Some of them get up faster than I can walk. I'd like to reach them from here.", "Three logs off the Ancient yews by the pool, fletched into a longbow. I'll learn."], accept: "One yew longbow.", decline: "Keep the shovel.",
      accepted: "The yews are south-east, by the water. Woodcutting 35 and a good axe.", progress: "Yew logs, then the bow. You're at {have}.", ready: "That's a bow. I've seen paintings. Give it here.", hand: "One longbow.", done: "Now they'll get up and get sat back down at range. Take this." },
    reward: { coins: 1500, xp: { fletching: 1500, woodcutting: 800 }, text: "1,500 tickets, 1,500 Fletching xp, 800 Woodcutting xp" }
  },
  spidersilk: {
    name: "Silk from the Dark", giver: "Sister Morrow", where: "The Boneyard", icon: "🕸️", tier: "medium", requires: ["yewbow"], handTo: "Grimm the Hermit",
    brief: "Grimm wants cobweb from the Chandelier Spiders. Morrow will point you at them; take two cobwebs to Grimm in the Gloam.",
    stages: [{ type: "kill", mob: "chandelier", n: 5, what: "Chandelier Spiders" }, { type: "bring", items: ["cobweb"], n: 2, what: "enormous cobwebs", to: "Grimm the Hermit", say: ["Cobweb. Real cobweb. This becomes silkstring, and silkstring strings a bow that would snap a hide string like a hair."], short: ["Two of the big cobwebs. The spiders in the Boneyard's theatre carry them."], reply: "Two cobwebs." }],
    talk: { offer: ["The hermit by the Gloam's rope, Grimm, wrote to ask for cobweb. Cobweb. From the spiders in the Royal Box.", "Five of them, take two cobwebs, and carry them to him yourself. I don't post spiders."], accept: "Five spiders, two webs, to Grimm.", decline: "Let him write again.",
      accepted: "The Royal Box is the far yard. They drop from the ceiling. Look up.", progress: "Five spiders, two cobwebs, and Grimm's rope is in the Gloam. You're at {have}.", ready: "Off to Grimm with it.", hand: "Done.", done: "Then here's what a hermit pays, which is more than you'd think." },
    reward: { coins: 1400, xp: { archery: 1200, fletching: 600 }, text: "1,400 tickets, 1,200 Archery xp, 600 Fletching xp" }
  },
  dragonstone: {
    name: "The Sister's Marker", giver: "Sister Morrow", where: "The Boneyard", icon: "💎", tier: "medium", requires: ["spidersilk"],
    brief: "Morrow wants a dragonstone bar for a marker that won't weather. Mine two ore here, smelt one bar, bring it.",
    stages: [{ type: "gather", items: ["dragonstone_ore"], n: 2, what: "dragonstone ore", how: "gather" }, { type: "gather", items: ["dragonstone_bar"], n: 1, what: "dragonstone bar", how: "craft" }, { type: "bring", items: ["dragonstone_bar"], n: 1, what: "dragonstone bar" }],
    talk: { offer: ["Every marker I put up, the rain takes the name off in a year. Dragonstone doesn't weather.", "Two ore from the rocks by the yews, smelted to a bar. One bar, one name, forever."], accept: "One dragonstone bar.", decline: "Names fade, Sister.",
      accepted: "Mining 40. The rocks are south-east, by the pool.", progress: "Two ore, then a bar. You're at {have}.", ready: "That'll outlast us both. Give it here.", hand: "One bar.", done: "Whose name goes on it? Mine, one day. Take this." },
    reward: { coins: 1800, xp: { smithing: 2000, mining: 800 }, text: "1,800 tickets, 2,000 Smithing xp, 800 Mining xp" }
  },
  boneidle: {
    name: "Idle Hands", giver: "Vance the Fence", where: "The Gloam", icon: "🦴", tier: "medium", requires: ["lamps"], handTo: "Sister Morrow",
    brief: "Vance is sick of the Bone-Idle. Put ten down and carry twelve bones to Sister Morrow in the Boneyard; she pays for bones.",
    stages: [{ type: "kill", mob: "boneidle", n: 10, what: "Bone-Idle" }, { type: "bring", items: ["bones"], n: 12, what: "bones", to: "Sister Morrow", say: ["Twelve. Vance sent them? Then Vance has a conscience after all. I'll pay you, not him."], short: ["Twelve bones. The Bone-Idle in the Gloam are made of little else."], reply: "Twelve bones." }],
    talk: { offer: ["The Bone-Idle. Lie about all day, then get up when you've got your arms full.", "Ten of them, and take twelve bones to the Sister in the Boneyard. She pays for bones. I don't."], accept: "Ten, then the Sister.", decline: "Idle yourself.",
      accepted: "They're on the north side, in the bushes. The Sister is through the Mire and up.", progress: "Ten Bone-Idle, twelve bones, the Sister. You're at {have}.", ready: "Go and see the Sister.", hand: "Done.", done: "Bones for the row, and this for you." },
    reward: { coins: 1500, xp: { melee: 1500, hp: 500 }, text: "1,500 tickets, 1,500 Melee xp, 500 Hitpoints xp" }
  },
  skyeel: {
    name: "Eels for Zephyr", giver: "Zephyr", where: "Cloudreach", icon: "🍢", tier: "medium",
    brief: "Zephyr wants four cooked skyeels. Fish them from the pool in Cloudreach and cook them.",
    stages: [{ type: "gather", items: ["skyeel"], n: 4, what: "skyeels", how: "gather" }, { type: "gather", items: ["cskyeel"], n: 4, what: "cooked skyeels", how: "cook" }, { type: "bring", items: ["cskyeel"], n: 4, what: "cooked skyeels" }],
    talk: { offer: ["Eight hours a day watching wind. You'd think I'd get hungry. I get RAVENOUS.", "Four skyeels from the pool below, cooked. Fishing 40, and a fire. The eels bite at nothing, so bring patience."], accept: "Four cooked skyeels.", decline: "Watch the wind on an empty stomach.",
      accepted: "The pool is south-east. Cook them anywhere with a fire.", progress: "Four cooked skyeels. You've {have}.", ready: "EELS. Give me those.", hand: "Four eels.", done: "Mmf. Take this. Mmf." },
    reward: { coins: 1600, xp: { fishing: 1500, cooking: 1500 }, text: "1,600 tickets, 1,500 Fishing xp, 1,500 Cooking xp" }
  },
  frostink: {
    name: "Frost on the Page", giver: "Zephyr", where: "Cloudreach", icon: "❄️", tier: "medium", requires: ["skyeel"],
    brief: "Zephyr wants ten Frost bolt pages. Grow three frostcaps from seed on your island, brew the ink, print at the Frost altar here.",
    stages: [{ type: "gather", items: ["frostcap"], n: 3, what: "frostcaps", how: "gather" }, { type: "gather", items: ["ink_frost"], n: 2, what: "Frost ink", how: "craft" }, { type: "bring", items: ["page_frost_bolt"], n: 10, what: "Frost bolt pages" }],
    talk: { offer: ["The altar behind me prints Frost, and I've never seen it used. I'd like to.", "Frost seeds drop from the rams and the goats. Grow three frostcaps on your island, brew the ink at a cauldron, print me ten Frost bolts here."], accept: "Ten Frost bolts.", decline: "Ink's not my thing.",
      accepted: "The seeds are rare: one ram in a hundred and more. A harvested plot gives two seeds back, so one plot soon becomes two.", progress: "Frostcaps, ink, ten pages. You're at {have}.", ready: "Frost, on paper. It's colder than it looks. Give them here.", hand: "Ten pages.", done: "I'll fire one at the next goose. Take this." },
    reward: { coins: 2500, xp: { wizardry: 2500, farming: 1000, alchemy: 800 }, text: "2,500 tickets, 2,500 Wizardry xp, 1,000 Harvesting xp, 800 Alchemy xp" }
  },
  ramhorns: {
    name: "Rams on the Ridge", giver: "Zephyr", where: "Cloudreach", icon: "🐏", tier: "medium", requires: ["frostink"],
    brief: "The rams and sea-goats are eating Zephyr's instruments. Eight rams and four sea-goats.",
    stages: [{ type: "kill", mob: "ram", n: 8, what: "Cumulus Rams" }, { type: "kill", mob: "seagoat", n: 4, what: "Sea-Goats" }],
    talk: { offer: ["That's the third anemometer this month. Eaten. The rams eat the cups and the goats eat what's left.", "Eight rams and four sea-goats, and I'll be able to tell you which way the wind blows again."], accept: "Eight rams, four goats.", decline: "Buy a weathervane.",
      accepted: "Rams on the ridge north, goats along the south edge. They don't run.", progress: "Eight rams, four sea-goats. You're at {have}.", ready: "The wind's north-north-west. I know that because I can hear it again.", hand: "Done.", done: "Here. And if you see a goat with a brass cup in its mouth, that one's mine." },
    reward: { coins: 2000, xp: { melee: 2500, hp: 800 }, text: "2,000 tickets, 2,500 Melee xp, 800 Hitpoints xp" }
  },
  homeward: {
    name: "The Way Home", giver: "Zephyr", where: "Cloudreach", icon: "📜", tier: "medium", requires: ["ramhorns"], handTo: "Charon the Ferryman",
    brief: "Charon wants to see a Homeward scroll work. Print one at the Sun altar in the Sands and take it to him in the Yard.",
    stages: [{ type: "gather", items: ["scroll_homeward"], n: 1, what: "Homeward scroll", how: "craft" }, { type: "bring", items: ["scroll_homeward"], n: 1, what: "Homeward scroll", to: "Charon the Ferryman", say: ["A page that does my job. Let me look at it. Hm. It doesn't take luggage, does it. I'm safe for now."], short: ["Zephyr said you'd bring me a scroll that goes home by itself. I'll believe it when I hold it."], reply: "Here's the scroll." }],
    talk: { offer: ["Charon, the ferryman, has been asking me about the Homeward pages. He thinks they'll put him out of work.", "Print one at the Sun altar in the Sands, Wizardry 50, and take it to him in the Yard. Let him see it. He'll feel better. Or worse."], accept: "One scroll, to Charon.", decline: "Let him worry.",
      accepted: "Sun ink is sunpetals. The altar is in the Sands, past the Boneyard's west gate.", progress: "One Homeward scroll, to Charon in the Yard. You're at {have}.", ready: "Off to Charon.", hand: "Done.", done: "He rows in the same water that page skips. Take this, from both of us." },
    reward: { coins: 3000, xp: { wizardry: 3000 }, text: "3,000 tickets, 3,000 Wizardry xp" }
  },
  stardust: {
    name: "Rashid's Sample", giver: "Rashid the Caravaneer", where: "The Golden Sands", icon: "✨", tier: "medium",
    brief: "Rashid wants two stardust from the sands' bright rocks to show his buyers.",
    stages: [{ type: "gather", items: ["stardust"], n: 2, what: "stardust", how: "gather" }, { type: "bring", items: ["stardust"], n: 2, what: "stardust" }],
    talk: { offer: ["My buyers in the east want to see the stardust before they pay for a cart of it. Sensible people.", "Two stardust from the bright rocks here. Mining 50. I'll pay a sample price, which is a good price."], accept: "Two stardust.", decline: "Show them a picture.",
      accepted: "One rock north by the market, one south in the dunes. They shine; you'll find them.", progress: "Two stardust. You have {have}.", ready: "Look at that. They'll buy the whole desert. Give it here.", hand: "Two stardust.", done: "A sample price, as promised. Come back, there's a caravan to run." },
    reward: { coins: 2000, xp: { mining: 2000 }, text: "2,000 tickets, 2,000 Mining xp" }
  },
  caravan: {
    name: "The Caravan Road", giver: "Rashid the Caravaneer", where: "The Golden Sands", icon: "📦", tier: "medium", requires: ["stardust"],
    brief: "Carry Rashid's parcel to Sister Morrow in the Boneyard and come back with her answer.",
    stages: [{ type: "bring", items: ["caravan_parcel"], n: 1, what: "caravan parcel", to: "Sister Morrow", give: [["caravan_parcel", 1]], say: ["From Rashid? Let me see. Ah. Candles. He remembered. Tell him the answer is yes, and to send the cart by the Mire, not the Sands road: the road's got cobras."], short: ["You've something for me? Rashid's parcel. Hand it over when you find it."], reply: "I'll tell him." }],
    talk: { offer: ["A parcel for the Sister in the Boneyard, and I can't leave the stall. It isn't heavy. It IS urgent.", "Take it to her, hear what she says, and come back. That's the caravan road, in small."], accept: "I'll carry it.", decline: "Hire a camel.",
      accepted: "East through the gate, and she's among the graves. Don't open it.", progress: "The parcel, to Sister Morrow, and her answer back to me. Have you found her?", ready: "Well? What did she say?", hand: "Yes, and send the cart by the Mire.", done: "By the Mire. She's right, the road's got cobras. Take this: a runner's pay." },
    reward: { coins: 2200, xp: { agility: 1500 }, text: "2,200 tickets, 1,500 Agility xp" }
  },
  cobra: {
    name: "Fangs", giver: "Rashid the Caravaneer", where: "The Golden Sands", icon: "🐍", tier: "medium", requires: ["caravan"],
    brief: "Clear eight cobras off the caravan road and bring Rashid one snake fang; the Yard's cauldron turns it into a potion.",
    stages: [{ type: "kill", mob: "cobra", n: 8, what: "Sand Cobras" }, { type: "bring", items: ["snakefang"], n: 1, what: "snake fang" }],
    talk: { offer: ["The Sister said cobras. The Sister was right. Eight of them between me and the gate this morning.", "Eight cobras, and bring me one fang. There's a potion made from it and I'd like to see what a cobra fears."], accept: "Eight cobras, one fang.", decline: "Go round.",
      accepted: "They're in the west of the sands and they're quick. Quicker than you. Hit first.", progress: "Eight cobras, one fang. You're at {have}.", ready: "A fang. Long as my finger. Give it here.", hand: "One fang.", done: "The road's open. Here, and drink something, you're pale." },
    reward: { coins: 2500, xp: { alchemy: 2000, melee: 1000 }, text: "2,500 tickets, 2,000 Alchemy xp, 1,000 Melee xp" }
  },
  perchdinner: {
    name: "Oasis Supper", giver: "Rashid the Caravaneer", where: "The Golden Sands", icon: "🍽️", tier: "medium", requires: ["cobra"],
    brief: "Rashid is feeding the caravan tonight: five oasis perch from the pool, cooked.",
    stages: [{ type: "gather", items: ["oasisperch"], n: 5, what: "oasis perch", how: "gather" }, { type: "gather", items: ["coasisperch"], n: 5, what: "cooked oasis perch", how: "cook" }, { type: "bring", items: ["coasisperch"], n: 5, what: "cooked oasis perch" }],
    talk: { offer: ["Twelve drivers arrive tonight and I've one loaf.", "Five oasis perch from the pool in the north-west, cooked. Fishing 40. The camels eat the bones."], accept: "Five cooked perch.", decline: "Feed them the loaf.",
      accepted: "The pool's past the market, north-west. A fire is a fire.", progress: "Five cooked oasis perch. You've {have}.", ready: "Perch! The drivers will sing. Badly. Give them here.", hand: "Five perch.", done: "Sit with us tonight if you like. Or take this and don't." },
    reward: { coins: 2000, xp: { cooking: 2000, fishing: 1500 }, text: "2,000 tickets, 2,000 Cooking xp, 1,500 Fishing xp" }
  },
  houseodds: {
    name: "Marked Cards", giver: "Parlay Pete", where: "The Casino", icon: "🃏", tier: "medium",
    brief: "Pete thinks the Counters in the Mire are marking the house's cards. Eight of them, and bring him three marked cards.",
    stages: [{ type: "kill", mob: "counter", n: 8, what: "Counters" }, { type: "bring", items: ["markedcard"], n: 3, what: "marked cards" }],
    talk: { offer: ["My parlay lost by one leg. ONE LEG. Somebody's marking the cards, and I know who: the Counters, out in the Mire.", "Eight of them, and bring me three of the marked cards so I can show Dex."], accept: "Eight Counters, three cards.", decline: "Pick better legs.",
      accepted: "They're in the Mire's east, counting. They count you too.", progress: "Eight Counters, three marked cards. You're at {have}.", ready: "Look at these. Look at the corner. LOOK.", hand: "Three cards.", done: "I'll show Dex. He'll say it's nothing. It's not nothing. Take this." },
    reward: { coins: 2000, xp: { thieving: 1500, melee: 800 }, text: "2,000 tickets, 1,500 Thieving xp, 800 Melee xp" }
  },
  /* ================= HARD ================= */
  stormrod: {
    name: "The Rod", giver: "Volta", where: "The Thunderhead", icon: "⚡", tier: "hard",
    brief: "Volta's lightning rod needs an onyx bar. Three onyx ore from Cloudreach, smelted, brought here.",
    stages: [{ type: "gather", items: ["onyx_ore"], n: 3, what: "onyx ore", how: "gather" }, { type: "gather", items: ["onyx_bar"], n: 1, what: "onyx bar", how: "craft" }, { type: "bring", items: ["onyx_bar"], n: 1, what: "onyx bar" }],
    talk: { offer: ["Copper melts. Bronze melts. I've been struck four times and I'm still looking for a metal that just TAKES it.", "Onyx. Three ore from the rocks in Cloudreach, smelted to a bar. Bring it here and I'll build a rod that outlives us."], accept: "One onyx bar.", decline: "Try wood.",
      accepted: "Onyx rocks are in Cloudreach's south-west. Mining 50, and the furnace is back in the Yard.", progress: "Three ore, one bar. You're at {have}.", ready: "Black all the way through. That'll take it. Give it here.", hand: "One bar.", done: "Stand back. No, further. There. Take this, and my thanks, in that order." },
    reward: { coins: 6000, xp: { smithing: 6000, mining: 2500 }, text: "6,000 tickets, 6,000 Smithing xp, 2,500 Mining xp" }
  },
  goosechase: {
    name: "Wild Goose", giver: "Volta", where: "The Thunderhead", icon: "🪶", tier: "hard", requires: ["stormrod"],
    brief: "The Thunder Geese sit on Volta's rod. Ten of them with a bow, and fifteen feathers for the fletching.",
    stages: [{ type: "kill", mob: "goose", n: 10, what: "Thunder Geese", style: "archery" }, { type: "bring", items: ["feather"], n: 15, what: "feathers" }],
    talk: { offer: ["They SIT on it. On the rod. A goose, full of lightning, sitting on the one thing built to take lightning.", "Ten of them, with a bow, because if you walk up to one you'll learn what I learned. And fifteen feathers: I fletch."], accept: "Ten geese, by bow.", decline: "Let them sit.",
      accepted: "They're on the island and the north shore. Stand back and loose.", progress: "Ten geese by bow, fifteen feathers. You're at {have}.", ready: "Feathers. Good ones, storm-charged. Give them here.", hand: "Fifteen feathers.", done: "The rod's clear. Until tomorrow. Take this." },
    reward: { coins: 6000, xp: { archery: 6000, fletching: 2000 }, text: "6,000 tickets, 6,000 Archery xp, 2,000 Fletching xp" }
  },
  stormink: {
    name: "Storm in a Bottle", giver: "Volta", where: "The Thunderhead", icon: "🌩️", tier: "hard", requires: ["goosechase"],
    brief: "Volta wants Storm bolt pages: six stormcorn grown, two Storm inks brewed, ten pages printed at the altar here.",
    stages: [{ type: "gather", items: ["stormcorn"], n: 6, what: "stormcorn", how: "gather" }, { type: "gather", items: ["ink_storm"], n: 2, what: "Storm ink", how: "craft" }, { type: "gather", items: ["page_storm_bolt"], n: 10, what: "Storm bolt pages", how: "craft" }, { type: "bring", items: ["page_storm_bolt"], n: 10, what: "Storm bolt pages" }],
    talk: { offer: ["I can catch lightning. I can't MAKE it. The altar behind me can, on paper, and I want to see it.", "Stormcorn grows on your island from what the rams drop. Six of it, brewed to two Storm inks, printed to ten Storm bolts, here."], accept: "Ten Storm bolts.", decline: "Wait for weather.",
      accepted: "Wizardry 50 to print Storm. The cauldron for the ink is in the Yard; the altar's right here.", progress: "Stormcorn, ink, pages. You're at {have}.", ready: "Lightning. In my HAND. Give them here before I drop one.", hand: "Ten pages.", done: "I fired one. The goose is fine. The rod isn't. Take this." },
    reward: { coins: 8000, xp: { wizardry: 8000, farming: 3000, alchemy: 2000 }, text: "8,000 tickets, 8,000 Wizardry xp, 3,000 Harvesting xp, 2,000 Alchemy xp" }
  },
  drakehunt: {
    name: "Hail Drakes", giver: "Volta", where: "The Thunderhead", icon: "🐉", tier: "hard", requires: ["stormink"],
    brief: "Six Hail Drakes, with a wand. They shrug off steel; they don't shrug off fire.",
    stages: [{ type: "kill", mob: "drake", n: 6, what: "Hail Drakes", style: "magic" }],
    talk: { offer: ["The drakes. Every storm brings two more, and steel just skids off the ice.", "Six of them, with a wand. Fire, if you have it. They HATE fire."], accept: "Six drakes, by wand.", decline: "They're your drakes.",
      accepted: "They're on the ridges, north and east. Keep your distance and keep your pages coming.", progress: "Six drakes with a wand. You're at {have}.", ready: "Six. I counted the bangs.", hand: "Done.", done: "Then the sky's a little clearer and you're a little richer. Here." },
    reward: { coins: 9000, xp: { magic: 9000, hp: 2000 }, text: "9,000 tickets, 9,000 Magic xp, 2,000 Hitpoints xp" }
  },
  audit: {
    name: "The Audit", giver: "The Auditor", where: "The Vault", icon: "📋", tier: "hard",
    brief: "The Auditor has a question for Dex the Dealer. Carry the ledger to the casino, hear Dex out, bring it back signed.",
    stages: [{ type: "talk", npc: "Dex the Dealer", say: ["The Auditor. Of course. Give me that.", "There. Signed. Tell him the house is exactly as honest as it's always been, and he can put that in his book."], reply: "I'll tell him.", give: [["audit_ledger", 1]] }, { type: "bring", items: ["audit_ledger"], n: 1, what: "signed ledger" }],
    talk: { offer: ["I audit the Vault. The Vault is fed by the casino. The casino is run by a man who has never once answered a letter.", "Take this ledger to Dex the Dealer. Have him sign it. Bring it back. Watch his face when he does."], accept: "I'll take the ledger.", decline: "Send another letter.",
      accepted: "He's at the tables, top of the floor. Don't let him keep the pen.", progress: "The ledger, to Dex, signed, back to me. Have you seen him?", ready: "Signed. And his face?", hand: "Exactly as honest as it's always been.", done: "That's what I was afraid of. Take this; it's cleaner than what I audit." },
    reward: { coins: 7000, xp: { thieving: 4000 }, text: "7,000 tickets, 4,000 Thieving xp" }
  },
  voidwood: {
    name: "Vaultwood", giver: "The Auditor", where: "The Vault", icon: "🪵", tier: "hard", requires: ["audit"],
    brief: "Three voidlogs from the Vaultwood growing through the floor, fletched into a shortbow for the Auditor's desk.",
    stages: [{ type: "gather", items: ["voidlogs"], n: 3, what: "voidlogs", how: "gather" }, { type: "gather", items: ["voidlogs_shortbow"], n: 1, what: "voidlogs shortbow", how: "craft" }, { type: "bring", items: ["voidlogs_shortbow"], n: 1, what: "voidlogs shortbow" }],
    talk: { offer: ["There are trees growing through the floor of this vault. Nobody has explained that to me, and nobody will.", "Three logs off them, Woodcutting 75, fletched into a shortbow. I'd like something on my desk that can't be audited."], accept: "One voidlogs shortbow.", decline: "Ask about the trees.",
      accepted: "The Vaultwood is at the east and west ends. A silkstring for the bow: the Boneyard's spiders, or the Weaver in the wild.", progress: "Three voidlogs, one shortbow. You're at {have}.", ready: "It's warm. Why is it warm. Give it here.", hand: "One shortbow.", done: "On the desk it goes. Take this; it came off the books today." },
    reward: { coins: 12000, xp: { woodcutting: 8000, fletching: 8000 }, text: "12,000 tickets, 8,000 Woodcutting xp, 8,000 Fletching xp" }
  },
  hoard: {
    name: "Count the Hoard", giver: "The Auditor", where: "The Vault", icon: "🪙", tier: "hard", requires: ["voidwood"],
    brief: "The Coin Hoards don't add up. Six of them, three Wardens, and two eclipse ore for the Auditor's scales.",
    stages: [{ type: "kill", mob: "hoard", n: 6, what: "Coin Hoards" }, { type: "kill", mob: "warden", n: 3, what: "Vault Wardens" }, { type: "bring", items: ["eclipse_ore"], n: 2, what: "eclipse ore" }],
    talk: { offer: ["The Hoards are short. Every one of them. Somebody is walking about with the difference and the Wardens won't say who.", "Six Hoards, three Wardens, and bring me two eclipse ore so I can weigh what's left against what should be."], accept: "Six, three, and the ore.", decline: "Round it down.",
      accepted: "The Hoards are in the middle rows. The Wardens come when the Hoards go down. Bring food.", progress: "Six Hoards, three Wardens, two eclipse ore. You're at {have}.", ready: "Eclipse. Heavy. Good. Give it here.", hand: "Two ore.", done: "It balances. It BALANCES. Take this before it stops." },
    reward: { coins: 12000, xp: { melee: 10000, hp: 4000 }, text: "12,000 tickets, 10,000 Melee xp, 4,000 Hitpoints xp" }
  },
  weaver: {
    name: "The Weaver's Coil", giver: "Grimm the Hermit", where: "The Gloam", icon: "🕷️", tier: "hard", requires: ["firstpage"],
    brief: "Down the rope: three Wild Weavers in the Wilderness, and two coils of wild silk for Grimm.",
    stages: [{ type: "visit", scene: "wild", what: "the Wilderness" }, { type: "kill", mob: "weaver", n: 3, what: "Wild Weavers" }, { type: "bring", items: ["wildsilk"], n: 2, what: "wild silk" }],
    talk: { offer: ["Down that rope there's a spider the size of a cart, and it spins silk you could hang a bell on.", "Three Wild Weavers, and bring me two coils. Anyone down there can attack you, so go when you're ready and not before."], accept: "Three Weavers, two coils.", decline: "I'll stay up here.",
      accepted: "The rope's beside me. The Weavers keep to the far pockets: the grove and the pool.", progress: "Three Weavers, two wild silk. You're at {have}.", ready: "Wild silk. Four strings a coil. Give them here.", hand: "Two coils.", done: "Keep the third for yourself, if it dropped one. Take this." },
    reward: { coins: 10000, xp: { archery: 8000, fletching: 4000 }, text: "10,000 tickets, 8,000 Archery xp, 4,000 Fletching xp" }
  },
  marrow: {
    name: "Marrow and Bone", giver: "Grimm the Hermit", where: "The Gloam", icon: "🦴", tier: "hard", requires: ["weaver"],
    brief: "Four Marrow Hounds in the Wilderness, then fifteen marrow arrows fletched from what they leave, for Grimm.",
    stages: [{ type: "kill", mob: "marrowhound", n: 4, what: "Marrow Hounds" }, { type: "gather", items: ["marrow_arrow"], n: 15, what: "marrow arrows", how: "craft" }, { type: "bring", items: ["marrow_arrow"], n: 15, what: "marrow arrows" }],
    talk: { offer: ["The hounds down there are bone and spite and something that glows. The glow makes an arrowhead.", "Four Marrow Hounds. Knap their marrow into heads, fletch fifteen arrows, and bring them to me. I'd like to see one fly."], accept: "Four hounds, fifteen arrows.", decline: "Let them glow.",
      accepted: "They hold the grimstone pocket, south-east. Fletching 48 for the arrow.", progress: "Four hounds, fifteen marrow arrows. You're at {have}.", ready: "Look at that light. Give them here.", hand: "Fifteen arrows.", done: "I loosed one at a tree. The tree's still thinking about it. Take this." },
    reward: { coins: 12000, xp: { fletching: 10000, archery: 5000 }, text: "12,000 tickets, 10,000 Fletching xp, 5,000 Archery xp" }
  },
  nexus: {
    name: "The Nexus", giver: "Grimm the Hermit", where: "The Gloam", icon: "🔮", tier: "hard", requires: ["marrow"],
    brief: "The Deep Wild. Find the Nexus, put four Grim Liches down with a wand, and bring Grimm a grimcore.",
    stages: [{ type: "visit", scene: "deep", what: "the Deep Wild" }, { type: "kill", mob: "grimlich", n: 4, what: "Grim Liches", style: "magic" }, { type: "bring", items: ["grimcore"], n: 1, what: "grimcore" }],
    talk: { offer: ["Past the Wilderness there's a deeper one, and in its far corner an altar that prints every page twice.", "The Liches guard the way. Four of them, with a wand, because a Lich laughs at steel. Bring me one grimcore. I have a use for it."], accept: "The Deep, four Liches, a grimcore.", decline: "Not yet.",
      accepted: "Through the Wilderness's north corridor. The Liches walk the north road and the pool. Sun burns them.", progress: "The Deep, four Liches by wand, one grimcore. You're at {have}.", ready: "Grimcore. Cold. Give it here.", hand: "One grimcore.", done: "Two grimstone and a vial, and this is Void ink. Now you know what I know. Take this." },
    reward: { coins: 15000, xp: { magic: 12000, wizardry: 6000 }, text: "15,000 tickets, 12,000 Magic xp, 6,000 Wizardry xp" }
  },
  darlaeel: {
    name: "Mudcat Supper", giver: "Darla", where: "The Trailer Park", icon: "🐈", tier: "hard", requires: ["theking"],
    brief: "Darla wants five cooked mudcat from the park's own water. Fishing 80.",
    stages: [{ type: "gather", items: ["mudcat"], n: 5, what: "mudcat", how: "gather" }, { type: "gather", items: ["cmudcat"], n: 5, what: "cooked mudcat", how: "cook" }, { type: "bring", items: ["cmudcat"], n: 5, what: "cooked mudcat" }],
    talk: { offer: ["Forty years I've eaten out of tins. The King's gone. I'd like a fish.", "Five mudcat from the water here, cooked. They fight the line, so bring a good rod."], accept: "Five cooked mudcat.", decline: "Open a tin.",
      accepted: "The water's along the south. Fishing 80. The fire's by my porch.", progress: "Five cooked mudcat. You've {have}.", ready: "Fish. Real fish. Give it here.", hand: "Five mudcat.", done: "Sit on the porch a minute. Nobody's sat there since 1986. Take this." },
    reward: { coins: 10000, xp: { cooking: 8000, fishing: 6000 }, text: "10,000 tickets, 8,000 Cooking xp, 6,000 Fishing xp" }
  },
  kingslayer: {
    name: "The Grinning Debt", giver: "The Barker", where: "The Carnival", icon: "🎭", tier: "hard",
    brief: "The Barker owes the Grinning Man. Settle it: one Grinning Man, and two starfall ore for the Barker's new sign.",
    stages: [{ type: "kill", mob: "grinner", n: 1, what: "the Grinning Man" }, { type: "bring", items: ["starfall_ore"], n: 2, what: "starfall ore" }],
    talk: { offer: ["Step right up and hear a confession: I owe him. The one behind the turnstile. I owe him and he knows it.", "Settle it for me. One Grinning Man, and bring me two starfall ore from the freaks; the sign over the gate is coming down with him."], accept: "One Grinning Man.", decline: "Pay your own debts.",
      accepted: "You'll need a carnival ticket for the turnstile. The freaks carry them, one in a hundred.", progress: "The Grinning Man, and two starfall ore. You're at {have}.", ready: "He's... down? He's DOWN. Give me the ore, the sign, the sign!", hand: "Two ore.", done: "STEP RIGHT UP AND SEE THE ONE WHO DID IT. Here. All of it. Take it." },
    reward: { coins: 20000, xp: { melee: 15000, hp: 5000 }, text: "20,000 tickets, 15,000 Melee xp, 5,000 Hitpoints xp" }
  },
});
/* the two things a quest hands you to carry */
ITEMS.caravan_parcel = { name: "Caravan parcel", icon: "\u{1F4E6}", ex: "Rashid's, for Sister Morrow. Sealed, and it smells faintly of candles." };
ITEMS.audit_ledger = { name: "The Auditor's ledger", icon: "\u{1F4D2}", ex: "Every ticket the Vault has ever taken, and one line waiting for Dex's name." };

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
    v: SAVE_V, scene: START.scene, x: START.x, y: START.y, hp: 10, hunger: 100, thirst: 100, wagered: 0, earned: 0, spin: null, roller: 0, free: 0, meal: null, drink: null, plays: [], bagUp: 0, tower: null, forge: {}, guild: 0, /* (2026-09-23) when the Thieves' Guild door was opened with a permit; 0 until it is. Declared here so normChar backfills every existing character with it rather than leaving the field undefined. */ /* (2026-09-22) the last hour of ticket bets, for TIX_HOUR. On the CHARACTER and not the connection, or relogging would clear the hour. */ tour: { step: 0, fish: 0, chickens: 0 },   /* `logs` until 2026-09-22: the field the job step counts is fish, and a dead name here is what the page went on reading */
    /* (2026-09-22, the owner: "dont equip users equipment when they start. it should be in their inventory so they can
       test out equipping stuff"). You begin UNARMED with your kit in the bag, so the tour's Gear step is a real thing
       to do rather than a description of something already done. Nothing needs a weapon to work — an empty weapon
       slot reads as "Unarmed" and still swings — so the only cost of arriving bare is the defence you put on yourself. */
    /* (2026-09-22) ALL THREE TOOLS, not just the rod. Mining and woodcutting refuse without one — "You need a pickaxe
       to do that" — and a new character had neither, nor any way to know they were for sale. */
    inv: [{ k: "tickets", n: 25 }, { k: "rod", n: 1 }, { k: "pickaxe", n: 1 }, { k: "axe", n: 1 }, { k: "cap", n: 1 }, { k: "rudis", n: 1 }, { k: "tunic", n: 1 }, { k: "parma", n: 1 }, { k: "sandals", n: 1 }],
    eq: { helm: null, weapon: null, body: null, shield: null, legs: null, gloves: null, boots: null, ring: null },
    eqf: {},   /* (2026-09-23) the reforge level of what is WORN, by slot. The bag keeps its levels on the entries themselves; only equipment needs somewhere to put one, because eq holds a bare key. */
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
    isle: { plots: Array(ISLE.plots).fill(null), beds: Array(10).fill(null), shelf: Array(ISLE.shelf).fill(null), theme: "meadow", themes: ["meadow"], open: true, tier: 1, owned: {}, decor: [] }
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
  out.tower = c.tower && typeof c.tower === "object"
    ? { floor: Math.max(1, Math.min(200, Math.trunc(Number(c.tower.floor)) || 1)), best: Math.max(0, Math.min(200, Math.trunc(Number(c.tower.best)) || 0)) }
    : null;
  out.plays = recentPlays(c.plays, Date.now());   // trimmed on every load, so an idle week never carries a play log back in
  out.van = normVanity(c.van);
  /* (2026-09-22) PETS. A kind that no longer exists, or a name with something nasty in it, simply stops being a pet.
     The slot is checked against the list it points into, so selling or banking one cannot leave a ghost applying its
     bonuses — activePet returns null and petFx reads zeroes. */
  out.pets = (Array.isArray(c.pets) ? c.pets : []).filter((x) => x && PETS[x.k] && x.id)
    .slice(0, 50).map((x) => ({ id: String(x.id).slice(0, 24), k: x.k, name: cleanPetName(x.name), ...(x.tier || (x.fx && PETS[x.k]?.legend) ? { ...(x.tier ? { tier: 1 } : {}), fx: Object.fromEntries(Object.entries(x.fx && typeof x.fx === "object" ? x.fx : {}).filter(([k, v]) => /^(speed|slots|hp|tix|swing|reach|tough|grow|bite|noburn|freesmelt|steal|gem|gift)$/.test(k) && Number.isFinite(+v)).map(([k, v]) => [k, Math.max(0, Math.min(k === "slots" ? 14 : k === "reach" ? 3 : 100, Math.round(+v)))])) } : {}) }));   /* (2026-09-27) a Greater pet keeps its tier and its own effects, clamped; a Legendary its picked ones */
  if (out.eq.pet && !out.pets.some((x) => x.id === out.eq.pet)) out.eq.pet = null;   /* (2026-09-21) what Ronde sold them, cleaned: an item that no longer exists simply stops being worn */
  // renames are followed BEFORE anything is filtered against ITEMS: the filter
  // below deletes keys it does not recognise, so an un-aliased rename would
  // quietly empty every bag and bank that had not logged in since.
  /* (2026-09-23) `f` RIDES THROUGH THE RE-PACK. This rebuilds the bag and bank from scratch on every load, and
     mapping each entry to a bare { k, n } quietly threw away any reforge level on it — which made the whole
     feature last exactly until the player's next login. A forged entry is passed to addInv with its level, so it
     lands in a slot of its own instead of being merged into the plain stack beside it. */
  const renamed = (st) => (st && st.k ? { k: aliasKey(st.k), n: st.n, ...(st.f ? { f: st.f } : {}), ...(Number.isInteger(st.p) && st.p >= 0 ? { p: st.p } : {}) } : st);   /* (2026-09-27) the bank page, or the bag slot, rides along */
  out.bank = (Array.isArray(c.bank) ? c.bank : []).map(renamed).filter((s) => s && ITEMS[s.k] && s.n > 0).slice(0, BANK_MAX).map((s) => ({ k: s.k, n: s.n, ...(s.f ? { f: s.f } : {}), ...(s.p > 0 ? { p: Math.min(BANK_PAGES - 1, s.p | 0) } : {}) }));   /* (2026-09-27) the page comes through a save */
  /* (2026-09-27) CANDY CORN EXPIRES: the day after the Long Night, every load sweeps it from the bag and the bank. The wiki and the
     item say so from the first day, so nobody is surprised; the fits, the set and the cat it bought stay. */
  const expired = !hwOn() && chicagoDay() > HW.until;
  if (expired) out.bank = out.bank.filter((s) => s.k !== "candycorn");
  /* (2026-09-27, the owner: "add the ability for users to favorite items in their inventory") FAVOURITES are item keys on the character:
     starred on every tile, first when the bag is sorted, and left alone by Deposit bag, Stack all and Sell all. FAV_MAX of them. */
  out.fav = Array.isArray(c.fav) ? [...new Set(c.fav.filter((k) => typeof k === "string" && ITEMS[k]))].slice(0, FAV_MAX) : [];
  // the bag is re-packed into stacks of 99; anything that no longer fits goes to the bank rather than vanishing
  out.inv = [];
  for (const s of (Array.isArray(c.inv) ? c.inv : f.inv).map(renamed).filter((s) => s && ITEMS[s.k] && s.n > 0 && !(expired && s.k === "candycorn"))) {
    /* (2026-09-24) `out`, NOT null. This ran on every single load and packed the bag into 20 slots, pushing
       whatever was left into the bank - so the two pockets a player bought and earned could never hold anything
       for longer than one refresh, and the bag looked as though it simply held 20. `out` already carries bagUp
       and ach from the spread above, and bagMax clamps bagUp itself, so reading it here is safe. */
    const left = addInv(out.inv, s.k, s.n, out, s.f || 0); if (!left) continue;
    const b = !s.f && out.bank.find((x) => x.k === s.k && !x.f); if (b) b.n += left; else out.bank.push({ k: s.k, n: left, ...(s.f ? { f: s.f } : {}) });
  }
  /* (2026-09-27, the owner: "literally replicate OSRS/RS3 inventory") THE SLOTS COME BACK. The re-pack above merges stacks through addInv,
     which knows nothing of positions, so each source stack's slot is queued by its item and handed to the rebuilt stacks of that item in
     order. A stack with no slot, or one the bag no longer has, falls into the first free slot when the bag is laid out (invLayout). */
  { const want = new Map(); for (const s of (Array.isArray(c.inv) ? c.inv : []).map(renamed)) if (s && Number.isInteger(s.p) && s.p >= 0 && s.p < INV_MAX + BAG_UPGRADES.length + 16) { const key = `${s.k}|${s.f || 0}`; (want.get(key) || want.set(key, []).get(key)).push(s.p); }
    for (const s of out.inv) { const q = want.get(`${s.k}|${s.f || 0}`); if (q?.length) s.p = q.shift(); } }
  { const bt = out.bank.find((x) => x.k === "tickets"); if (bt) { out.bank.splice(out.bank.indexOf(bt), 1); addInv(out.inv, "tickets", bt.n, out); } }
  settleSlots(out);   /* (2026-09-27) every stack knows its slot from here on */   /* tickets stay on you (2026-09-19): any that were banked come back to the bag (they never take a slot's cap) */
  /* (2026-09-23) THE PET SLOT IS NOT AN ITEM SLOT and must sit this out. Every other slot holds an item KEY, so
     this drops anything whose item no longer exists (and applies renames on the way). eq.pet holds an ID into
     c.pets — "p1" — which is never a key in ITEMS, so it failed that test on EVERY load: a player equipped a pet,
     refreshed, and found it unequipped, for ever. Reported by a tester as "pets reset on refresh".
     It is already validated properly a few lines above, against the list it actually points into. */
  for (const s of SLOTS) { if (s === "pet") continue; if (out.eq[s]) out.eq[s] = aliasKey(out.eq[s]); if (out.eq[s] && !ITEMS[out.eq[s]]) out.eq[s] = null; }
  /* BOTH OF THESE RUN AFTER THE RE-PACK ABOVE, and that ordering is the whole reason they work: the re-pack
     rebuilds inv and bank from the saved character, so anything stamped onto those lists before it is discarded.
     Found the hard way — the migration ran, the bag came out plain, and the levels were gone. */
  /* ---------------------------------------------------------------------------------------------------------
     THE ONE-TIME MOVE OF EVERY EXISTING REFORGE ONTO A REAL ITEM (2026-09-23).

     Levels used to live on the character as forge[itemKey]. They live on the piece now, so each saved level has
     to find the piece it belongs to, ONCE, on the next load. It goes to the first of these that the player
     actually holds:

         what they are WEARING  ->  eqf[slot]        (the most likely thing they reforged, and the one whose
                                                      stats would visibly change if we guessed wrong)
         the first in the BAG   ->  that entry's f
         the first in the BANK  ->  that entry's f

     AND IF THEY HOLD NONE OF THAT ITEM, THE LEVEL IS DROPPED, deliberately. Under the old model a level stayed
     with you forever: sell a +3 axe, buy another, find it still +3. That is exactly the thing this change
     exists to stop, so carrying those orphans forward would import the bug we are removing. Anyone who sold a
     reforged piece was already not going to get it back.

     `mig` marks it done so a later load cannot run it twice and re-stamp a level onto a piece that has since
     been traded away. c.forge is left in place, unread, rather than deleted: it is the only record of what
     somebody had if this ever needs looking at. */
  out.eqf = {};
  if (c.eqf && typeof c.eqf === "object") for (const [sl, v] of Object.entries(c.eqf)) {
    const n = Math.max(0, Math.min(FORGE.cap, Math.trunc(Number(v)) || 0));
    if (n > 0 && out.eq[sl] && canForge(out.eq[sl])) out.eqf[sl] = n;
  }
  if (!c.forgeMig && c.forge && typeof c.forge === "object") {
    for (const [k, v] of Object.entries(c.forge)) {
      const n = Math.max(0, Math.min(FORGE.cap, Math.trunc(Number(v)) || 0));
      if (!(n > 0) || !canForge(k)) continue;
      const slot = Object.keys(out.eq).find((sl) => out.eq[sl] === k);
      if (slot) { out.eqf[slot] = n; continue; }
      const bag = (out.inv || []).find((x) => x.k === k && !x.f);
      if (bag) { if (bag.n > 1) { bag.n -= 1; out.inv.push({ k, n: 1, f: n }); } else bag.f = n; continue; }
      const bank = (out.bank || []).find((x) => x.k === k && !x.f);
      if (bank) { if (bank.n > 1) { bank.n -= 1; out.bank.push({ k, n: 1, f: n }); } else bank.f = n; }
      // held none of it: the level goes, which is the point of the change
    }
  }
  out.forgeMig = 1;
  out.forge = c.forge && typeof c.forge === "object" ? c.forge : {};   // kept, unread: the record of what was
  /* A hand-edited save cannot invent a +99 axe, hang a level on a stack of logs, or keep a forged stack of 40:
     a forged entry is always exactly one item. Same clamp on the bag and the bank. */
  for (const list of [out.inv, out.bank]) if (Array.isArray(list)) for (const st of list) {
    const n = Math.max(0, Math.min(FORGE.cap, Math.trunc(Number(st.f)) || 0));
    if (n > 0 && canForge(st.k)) { st.f = n; st.n = 1; } else delete st.f;
  }

  /* (v104) saved INSIDE a crypt run ("crypt:<run id>"): left alone here. The game server decides at login whether that run is still going (back where you stood) or not (the stairs in the Forum): cryptRejoin in eastscape-worker/src/crypt.js. */
  /* (2026-09-24, reported by jimmytomato: "I was on Floor 30 of the Tower ... now demoted back to Floor 21")
     A TOWER RUN IS A RUN IN PROGRESS, exactly as a Crypt run is. Both live in a scene keyed to the player
     (`tower:<id>`, `crypt:<id>`) which is built on demand and so is NOT in SCENES - and only `crypt:` was spelled
     here, so the check below found no such scene and sent every tower climber back to the casino ON EVERY LOAD.
     A deploy, a reconnect, any restart of the Durable Object.

     The floor itself was never lost - c.tower still said {floor:30,best:29} - but the SCENE KEY was, and that is
     what towerRejoin matches on to rebuild the room you were standing in. Without it a climber arrived at the
     door instead and re-entered at checkpointAt(best+1): floor 21, nine floors gone, which is precisely what was
     reported. A regex over both, so the next per-player scene is one word rather than another silent demotion. */
  const inRun = /^(crypt|tower|pyramid):/.test(String(out.scene));   /* (2026-09-24) the Great Pyramid is a run in progress too - see the tower note above for what leaving one out costs */
  if (!inRun && !OPEN.has(String(out.scene).split(":")[0])) Object.assign(out, START);
  if (!inRun && !SCENES[out.scene]) Object.assign(out, isIsle(out.scene) ? ISLE_FERRY : START);   // back from an island: the ferry at River Bend
  const fi = f.isle, ci = c.isle && typeof c.isle === "object" ? c.isle : {};
  out.isle = {
    plots: Array.from({ length: ISLE.plots }, (_, i) => { const p = ci.plots?.[i]; return p && CROPS[p.k] && Number.isFinite(p.at) ? { k: p.k, at: p.at, ...(Number.isFinite(p.ms) ? { ms: p.ms } : {}) } : null; }),   /* (2026-09-27) p.ms kept: a Rainmaker plot lost its shorter clock at every save */
    /* (2026-09-27) Fungiculture: the cellar's beds, the same shape as a plot */
    beds: Array.from({ length: FUNG.bedMax }, (_, i) => { const p = ci.beds?.[i]; return p && FUNGI[p.k] && Number.isFinite(p.at) ? { k: p.k, at: p.at, ...(Number.isFinite(p.ms) ? { ms: p.ms } : {}) } : null; }),
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
/* (2026-09-25) THE STYLE IS WHAT IS IN YOUR HAND. A launcher makes every roll read Archery - accuracy, max hit AND the
   defence roll (an archer holding a bow defends with Archery, or a pure archer at Combat 1 would be hit by everything).
   Nothing else in the combat maths knows the word "bow": it asks styleOf. A staff for a future Magic skill answers here. */
export const styleOf = (c) => { const L = launcherOf(c); return L ? L.launcher.style || "archery" : "melee"; };   /* (2026-09-26) the launcher names its style: a bow Archery, a wand Magic */
export const styleLvlOf = (c) => lvlOf(c, styleOf(c));
/* THE COMBAT LEVEL IS ALL THREE (2026-09-25, the owner: "the culmination of melee, archery, and health"). The stronger style
   counts in full, exactly as Combat always did, and the weaker one adds 0.3 a level above 1 on top. So nobody who has
   never drawn a bow moves by a single level - every gate, band and Tower door reads this number - while every level of
   the second style still shows. A 99 / 99 / 99 character is 113. */
export const combatOf = (c) => { const [a, b, d] = ["melee", "archery", "magic"].map((k) => lvlOf(c, k)).sort((x, y) => y - x); return Math.floor((a * 1.3 + (b - 1) * 0.3 + (d - 1) * 0.3 + lvlOf(c, "hp")) / 2.3) + 2; };   /* (2026-09-26) Magic joins: the best style in full, each other 0.3 a level above 1 */
/** (2026-09-27) the skills that count: a held one (HOLD, e.g. Jewelcrafting before it opens) is off profiles, the total and the "every skill" achievements */
export const liveSkills = () => Object.keys(SKILLS).filter((k) => !SKILLS[k].held);
export const totalOf = (c) => liveSkills().reduce((n, k) => n + lvlOf(c, k), 0);
/* (2026-09-22) REFORGING rides here, which is the only place it has to touch combat: every roll in the game reads
   its gear through bonusOf, so adding the level here means the max hit, the attack roll and the defence roll all
   pick it up with no other change. A level adds +1 to each stat the piece ALREADY has — never to a stat of zero,
   or a helm would quietly start granting strength. */
/* (2026-09-22) THIS GOES THROUGH statOf. It used to repeat forgeAdd's sum inline and, like the anvil, left out the
   floor - so combat paid a quarter of what reforging advertised: a full emerald set at +3 gave +5 defence where the
   anvil showed +18, and a +3 emerald axe was identical in a fight to a plain one. Three copies of one formula is
   what caused both bugs; there is now one. */
export const bonusOf = (c) => { const b = { acc: 0, str: 0, def: 0 }; for (const k of Object.values(c.eq)) if (k && ITEMS[k]) for (const q in b) b[q] += statOf(c, k, q); return b; };
/* THE STYLE'S OWN GEAR (2026-09-25, the owner: "with 100ish bone arrows im at level 22, so you outlevel early game feathers and skip
   tiers"). A bow used to read accuracy and strength off EVERYTHING worn, so a geared melee player picked up a rough shortbow and hit
   for fourteen a shot at Archery 1 - every point of which was Archery xp. With a launcher in hand, accuracy and strength come from the
   launcher and the pouch (the quiver) only; the arrow adds its own strength on top in the fight, as before. DEFENCE still reads
   everything worn: armour stops a sword whatever you are holding. A melee character is unchanged - this is bonusOf for them. */
export const styleBonusOf = (c) => {
  if (!launcherOf(c)) return bonusOf(c);
  const b = { acc: 0, str: 0, def: bonusOf(c).def };
  for (const sl of ["weapon", "shield"]) { const k = c.eq?.[sl]; if (k && ITEMS[k]) { b.acc += statOf(c, k, "acc"); b.str += statOf(c, k, "str"); } }
  return b;
};
export const maxHitOf = (c) => Math.floor((1 + Math.floor(styleLvlOf(c) / 6) + Math.floor(styleBonusOf(c).str / 2)) * (1 + charmOf(c, "focus") / 100));   /* (2026-09-26) Focus */

/* The two rolls, in one place so the server and the page can never disagree.

   Defence stays halved. Not for elegance — without it the numbers break: a
   level 50 defence with 20 from gear rolls 70 against a revenant's 32 attack,
   which clamps to the 10% floor and the hardest thing in the game stops landing
   hits. Halved, a Defensive character ends up exactly as hard to hit as a
   melee-50 character was before the split, while somebody who poured everything
   into Strength is genuinely fragile. That difference IS the split. */
export const attackRollOf = (c) => (styleLvlOf(c) + 1 + styleBonusOf(c).acc) * (1 + charmOf(c, "focus") / 100);   /* (2026-09-26) Focus */
export const defenceRollOf = (c) => ((styleLvlOf(c) + bonusOf(c).def) / 2) * (1 + charmOf(c, "ward") / 100);   /* (2026-09-26) Ward */
/* THE FLOOR IS THE DANGER KNOB (2026-09-25). It was 0.1, and that one number is why the open world felt safe:
   defenceRollOf is (melee level + gear def) / 2, gear outruns a monster's `att`, and so EVERY level-appropriate
   player in full tier gear sits exactly ON the floor from about level 50 up - goose, house and The Last Dealer
   all landed 10% of their swings and no more. Two consequences followed that are worth saying out loud:

     A MONSTER'S `att` IS DEAD WEIGHT past mid-game. Raising it changes nothing for anybody who is on the floor,
     which is everybody the monster is meant for.
     AND ONLY ABOUT TWO SWINGS LANDED IN A WHOLE KILL, so no amount of max hit could make a fight feel sustained
     rather than spiky.

   0.18 roughly doubles what a geared player takes (The Last Dealer 12 a kill to 22 against 92 health) without
   touching time to kill at all, and it is what finally makes the Tower want the food it was designed around: the
   worst floor goes from six meals to twelve. IT IS NOT EXCLUDED FROM ANYTHING - unlike OUTSIDE_HP/OUTSIDE_DMG,
   which run at module load before the Tower and the dungeons merge their rows, this lives inside hitChance, so
   the Tower, the Crypt and the Pyramid all feel it. The Tower was measured; the two dungeons were not.
   It also cuts both ways: an UNDER-levelled player swinging at something far above them now lands 18% instead of
   10%, which is a small buff to punching up. */
export const HIT_FLOOR = 0.18;
export const hitChance = (att, def) => Math.max(HIT_FLOOR, Math.min(0.95, 0.5 + (att - def) * 0.04));

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
/* `plainOnly` counts the UNREFORGED ones only (2026-09-23). "Deposit all your diamond axes" must mean the plain
   ones: takeInv spends those first and leaves the forged behind, so a count that included them would ask the bank
   for more than the take will hand over. */
export const countItems = (c, keys, opt = null) => c.inv.filter((x) => keys.includes(x.k) && !(opt?.plainOnly && fOf(x))).reduce((n, x) => n + x.n, 0);
/* (2026-09-27) QUESTS HAVE STAGES (the owner: "I don't want bland quests like 'go get X thing'. They should be go to NPC, it has
   some dialogue about the quest, go talk to X NPC, get this thing, bring it over here, etc."). A quest is `stages`, done in
   order; the player's record is C.qs[k] = { state, stage, n }. Stage types:
     talk    { npc, say, reply, after }                   find that person; what they say when you arrive; the button; what they say after
     bring   { items, n, what, to?, say, short, reply, after }   hand n of the items to `to` (the giver when unset); `short` is what they say when you have not got them
     kill    { mob, n, what, style? }                     defeat n of them after the stage is reached (style: "melee" | "archery" | "magic" to insist on one)
     gather  { items, n, what, how? }                     come by n of them from the stage on (how: "gather" for skilling, "craft", "cook"; any when unset)
     visit   { scene, what }                              set foot in that area
   A stage may `give: [[item, n]]` when it is reached (a letter to carry). When the last stage is done the quest is READY and is
   handed in to `handTo` (the giver when unset), where the reward is paid. The five quests written before this had one goal each;
   they become one-stage quests below and play exactly as they did. `tier` is easy | medium | hard, for the log and the wiki. */
export const QUEST_TIERS = { easy: "Easy", medium: "Medium", hard: "Hard" };
for (const q of Object.values(QUESTS)) if (!q.stages) { q.stages = [{ ...q.goal }]; q.tier ||= "easy"; }
export const qStageAt = (k, i) => { const st = QUESTS[k].stages; return st[Math.max(0, Math.min(i | 0, st.length - 1))]; };
export const qStage = (c, k) => qStageAt(k, qGet(c, k).stage);
export const qHandTo = (k) => QUESTS[k].handTo || QUESTS[k].giver;
export const qNeed = (c, k) => { const s = qStage(c, k); return s.n || 1; };
export const qHave = (c, k) => { const o = qGet(c, k), s = qStageAt(k, o.stage); return s.type === "bring" ? countItems(c, s.items) : s.type === "gather" ? Math.max(o.n | 0, countItems(c, s.items)) : s.type === "kill" ? o.n | 0 : 0; };   /* (2026-09-27) a gather stage reads the bag too: what you already carry counts */
export const qOpen = (c, q) => (q.requires || []).every((r) => qGet(c, r).state === "done") && (!q.event || hwOn());   /* (2026-09-27) a seasonal quest opens with its season */
/* a bring stage's counterparty, and whether the quest's LAST stage is a bring to the hand-in person: that is the one case where
   "ready" is read off the bag rather than recorded, which is how every quest written before stages worked */
export const qBringTo = (k, s) => s.to || QUESTS[k].giver;
const lastBringToHand = (k) => { const st = QUESTS[k].stages, s = st[st.length - 1]; return s.type === "bring" && qBringTo(k, s) === qHandTo(k); };
// where a quest is now: new, locked, active, ready (can hand in), done
export function qState(c, k) {
  const q = QUESTS[k], o = qGet(c, k), st = o.state;
  if (st === "done") return "done";
  if (st === "ready") return "ready";
  if (st === "active") return (o.stage | 0) === q.stages.length - 1 && lastBringToHand(k) && qHave(c, k) >= qNeed(c, k) ? "ready" : "active";
  return qOpen(c, q) ? "new" : "locked";
}
/** what an NPC has to do with a player's quests right now: { k, role, stage } — role is offer (a new quest of theirs), hand (a
    finished one to hand in), stage (this person is the current stage's talk or bring counterparty) or progress (the giver, mid-quest) */
export const npcRole = (c, n) => {
  /* the stage you were sent here for comes before anything this person has to offer: you came for the parcel, not the pitch */
  for (const k of Object.keys(QUESTS)) {
    const st = qState(c, k); if (st !== "active" && st !== "ready") continue;
    if (st === "ready") { if (qHandTo(k) === n.name) return { k, role: "hand", stage: qStage(c, k) }; continue; }
    const s = qStage(c, k);
    if (s.type === "talk" && s.npc === n.name) return { k, role: "stage", stage: s };
    if (s.type === "bring" && qBringTo(k, s) === n.name) return { k, role: "stage", stage: s };
  }
  for (const k of n.quests || []) { const st = qState(c, k); if (st === "new") return { k, role: "offer" }; }
  for (const k of n.quests || []) if (qState(c, k) === "active") return { k, role: "progress", stage: qStage(c, k) };
  return null;
};
// the quest an NPC is dealing with right now (the marker over their head, the old callers)
export const npcQuest = (c, n) => npcRole(c, n)?.k || null;
/** one line for a stage, for the log and the wiki */
export const stageText = (k, s) => s.type === "talk" ? `Talk to ${s.npc}` : s.type === "bring" ? `Bring ${s.n} ${s.what} to ${qBringTo(k, s)}` : s.type === "kill" ? `Defeat ${s.n} ${s.what}${s.style ? ` with ${s.style === "magic" ? "a wand" : s.style === "archery" ? "a bow" : "a melee weapon"}` : ""}` : s.type === "gather" ? `${s.how === "craft" ? "Make" : s.how === "cook" ? "Cook" : "Get"} ${s.n} ${s.what}` : s.type === "visit" ? `Go to ${s.what}` : "";
// what an NPC with no work left says to send you on
export function nextHint(c, n) {
  const next = Object.keys(QUESTS).find((q) => !(n.quests || []).includes(q) && ["new", "active", "ready"].includes(qState(c, q)));
  return next ? (QUESTS[next].hint || `${QUESTS[next].giver} at ${QUESTS[next].where} could use a hand.`) : "That's all the work there is for now. Check back soon.";
}

/* ============================================================ THE LONG NIGHT (2026-09-27) — the Halloween event
   The owner's brief: unique seasonal items, vanity, a seasonal drop set, a boss, rare drops from skilling and mobs, quests. Built
   as ONE block behind ONE date window so that on Nov 2 it switches itself off and nothing has to be deleted by hand.

   The four rules that keep it honest:
   - CANDY CORN is the only new currency, it is ONLY spent at the Night Market and Ronde's rail, and it EXPIRES: normChar deletes it
     the day after the event. Tickets are not touched, so nothing here inflates the real economy.
   - Nothing seasonal beats what exists. The Hallowed set is Dragonstone-grade with a candy-corn perk; the pie is a heal and a meal
     buff, NOT an xp buff (the rules file already says why, at "NO XP BUFF, DELIBERATELY").
   - The boss is a WORLD clock (the server's, persisted), never a placement: a scene that stands empty two minutes is torn down, so a
     mob with an hour's respawn would simply vanish. He rises once an hour in the Lantern Mire, the map that was drawn to hold him.
   - Every seasonal picture, monster and pet is flagged `event: true`, and the two "collect everything" achievements skip those, so
     the event can never make Exterminator or The Whole Kennel unearnable for somebody who joins in November. */
export const HW = {
  live: true,                                         /* (2026-09-27: ON, launched with an announced restart) THE SWITCH. false: everything below is dormant and invisible, whatever the date. true: the dates rule. */
  from: "2026-09-25", until: "2026-11-01",            /* Chicago days, inclusive: the site's own spooky season starts the 25th */
  night: [20, 21],                                    /* Nightfall: 8 to 9 PM Central, candy corn doubles */
  corn: { kill: 0.30, gather: 0.10, n: [1, 3] },      /* the flat drop: any kill 30%, any gather 10%, 1-3 corn */
  ecto: 0.06,                                         /* ectoplasm: 6% of any kill during the event */
  lanterns: 10, lanternCorn: 4,                       /* the Ghost Hunt: ten lanterns a day across the open maps, 4 corn each, once a day each */
  king: { every: 3600000, stays: 1200000, scene: "mire", at: [22, 14] },   /* the Pumpkin King: hourly, stands 20 minutes, the Mire's clearing */
  trick: { corn: [6, 14], pie: 0.15, seed: 0.20, trickAt: 0.35 },          /* Trick or treat, once a day per person */
  /* (2026-09-27, the owner: "since the event will be a month long, the cost of items needs to be very high (candy corns), they're
     very cheap right now"). PRICED AGAINST A MONTH. An ordinary evening's play makes 150-250 corn (0.6 a kill, the ten lanterns'
     40, a treat, an hour of Nightfall at double), a hard one 500; the three quests pay 510 once. So the consumables are a few
     kills each, a fit is a fortnight, the Hallowed set is the month for anyone grinding it - or the King's drops - and the Black
     Cat is the chase: 12,000 is every corn a serious player sees before November. The King still drops the gear and the cat, so
     the shelf is the slow certain road and the Mire the fast lucky one. */
  market: [["seed_pumpkin", 3, 40], ["medium_vial", 2, 25], ["ectoplasm", 1, 30], ["pumpkinpie", 1, 90], ["pot_witch", 1, 200],
    ["hallowed_helm", 1, 4000], ["hallowed_body", 1, 6000], ["hallowed_legs", 1, 5000], ["lantern_quiver", 1, 9000], ["skull_wand", 1, 9000], ["bag_shroud", 1, 9000]],   /* [item, n, corn] */
  pet: ["blackcat", 12000],                            /* the Black Cat off the shelf, once; the King still drops it one in forty */
  skillDrops: { woodcutting: "gallows_bow", mining: "coffin_ring", fishing: "drowned_boots" }, skillDropChance: 0.0001,   /* (2026-09-27) one in ten thousand chops, swings, casts; rolled in the server's gained() */
  legend: { lvl: 80, chance: 1 / 3000, items: ["reaper_scythe", "king_crown", "ferry_coin"] },                          /* the three legendaries off any monster of that level or more, one of the three at random */
  gone: "2026-11-02"                                   /* the morning it all goes: the copy says this date everywhere, so it is one string */
};
/** days of the Long Night left, counting today: 1 on the last day, 0 after */
export const hwDaysLeft = (t = Date.now()) => { if (!hwOn(t)) return 0; const d = chicagoDay(t); return Math.max(0, Math.round((Date.parse(HW.until + "T12:00:00Z") - Date.parse(d + "T12:00:00Z")) / 86400000) + 1); };
if (HW.live) HISCORES.push(["corn", "Candy corn", "earned this Long Night", "n"]);   /* (2026-09-27) the season's board; c.stats.corn, counted by the server's hwGive */
export const hwOn = (t = Date.now()) => { if (!HW.live) return false; const d = chicagoDay(t); return d >= HW.from && d <= HW.until; };
export const hourCT = (t = Date.now()) => (+new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(t)) % 24;
export const nightfallOn = (t = Date.now()) => hwOn(t) && hourCT(t) >= HW.night[0] && hourCT(t) < HW.night[1];
/* (2026-09-27, the owner: "can we make it permanently nightfall themed in the yard? but not double candy corn drops? do it from the
   second the event launches") A LOOK, NOT A RULE. These maps are drawn dark for the whole event; nightfallOn() - the hour that
   doubles corn - is untouched, and the server never reads this. */
export const HW_DARK = new Set(["workyard"]);
export const hwDarkAt = (key, t = Date.now()) => nightfallOn(t) || (hwOn(t) && HW_DARK.has(String(key || "").split(":")[0]));
/** ms until the next Nightfall starts (or 0 while it is on) */
export const nightfallIn = (t = Date.now()) => { if (nightfallOn(t)) return 0; const h = hourCT(t), m = new Date(t); const minsIn = m.getUTCMinutes() * 60000 + m.getUTCSeconds() * 1000; const hoursTo = (HW.night[0] - h + 24) % 24 || 24; return hoursTo * 3600000 - minsIn; };

ITEMS.candycorn = { name: "Candy corn", icon: "\u{1F36C}", nocap: true, event: true, ex: "The Long Night's coin. Every kill and every catch drops a little; the Night Market and Ronde's rail take it. On November 2nd it turns back into sugar, so spend it." };
ITEMS.pumpkin = { name: "Pumpkin", icon: "\u{1F383}", event: true, ex: "Grows in a night on your island, from a seed the Night Market sells. Bake it on a fire." };
ITEMS.seed_pumpkin = { name: "Pumpkin seed", icon: "\u{1F331}", event: true, ex: "Plant it on your island. Harvesting 20. Two seeds come back every harvest, and one harvest in ten gives three." };
ITEMS.pumpkinpie = { name: "Pumpkin pie", icon: "\u{1F967}", heal: 20, event: true, meal: { mins: 30, fx: { rare: 0.15, tix: 0.10 } }, ex: "Heals 20 and, for half an hour outside, rare drops come a little easier and every kill pays a little more. Not xp: nothing in EastScape buys xp." };
ITEMS.ectoplasm = { name: "Ectoplasm", icon: "\u{1F47B}", event: true, ex: "What is left of something that did not want to leave. One kill in sixteen drops it during the Long Night; the cauldron wants it." };
ITEMS.pot_witch = { name: "Witch's brew", icon: "\u{1F9EA}", use: "ward", event: true, ex: "Drink it and your next death costs nothing: no hospital bill. Used up by the death, however long that takes." };
ITEMS.hallowed_helm = { name: "Hallowed helm", short: "Helm", icon: "\u{1F383}", slot: "helm", def: 13, acc: 3, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { tix: 0.04 }, req: { skill: "melee", lvl: 40 }, ex: "The Pumpkin King's, or a copy. Lit from inside. Dragonstone-grade, and every kill in it pays a little more." };
ITEMS.hallowed_body = { name: "Hallowed cuirass", short: "Cuirass", icon: "\u{1F9BA}", slot: "body", def: 23, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { tix: 0.04 }, req: { skill: "melee", lvl: 40 }, ex: "Black iron with a pumpkin burning on the chest. Dragonstone-grade." };
ITEMS.hallowed_legs = { name: "Hallowed greaves", short: "Greaves", icon: "\u{1F456}", slot: "legs", def: 19, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { tix: 0.04 }, req: { skill: "melee", lvl: 40 }, ex: "The seams glow. Dragonstone-grade." };
/* (2026-09-27, the owner: "there needs to be a unique halloween themed quiver, bow, magic bag, wand, boots and jewelry. give these
   some type of unique effect that makes them enticing to chase for the grind. let 3 of them be rare (0.01%) drops from
   fishing/wc/mining (1 each skill) ... all are level 50 in their skill"; then "2-3 level 90 legendary chase items ... unique
   effects"; then "the event items that are wearable need to show a special Event tag").
   THE PIECES. Stats sit at the tier their level already has (yew/onyx at 50, nova at 90 - "nothing seasonal beats what exists"),
   and the EFFECT is the reason to want one: every effect here is a key fxOf() sums and the server reads at exactly one line
   (spendAmmo, the hit, gained, the aggro pick, die). Every one is tier "hallowed", which is what the page's icon glow and the
   Event tag key on, and every one reforges with CANDY CORN (there is no hallowed bar), so a reforge is a corn sink and stops
   with the event. SOURCES: the bow, the ring and the boots fall ONLY from a chop, a swing and a cast, one in ten thousand, during
   the event (HW.skillDrops, rolled in the server's gained()); the quiver, the wand and the satchel are the King's (2% each) and
   on Hexa's shelf at 9,000 corn; the three legendaries are the King's at 1% each and one in three thousand off any monster of
   level 80 or more killed during the event (HW.legend). Nothing here is sold for tickets or bought back by Bom. */
export const EVENT_TAG = "Halloween 2026 Event";
/** (2026-09-27) where an event piece comes from, in words, read off the King's drop table, Hexa's shelf and the two drop rules -
    so the wiki item page and the guide can never disagree with the game */
export const eventSourcesOf = (k) => {
  const out = [], K = MOBS.pumpkinking, pct = (p) => `${Math.round(p * 1000) / 10}%`;
  const sk = Object.entries(HW.skillDrops || {}).find(([, v]) => v === k);
  if (sk) out.push(`one ${sk[0] === "fishing" ? "cast" : sk[0] === "mining" ? "swing at a rock" : "chop"} in ${Math.round(1 / HW.skillDropChance).toLocaleString()}, during the Long Night only`);
  const d = K?.drops.find(([x]) => x === k); if (d) out.push(`the Pumpkin King, ${pct(d[2] ?? 1)} of kills`);
  if ((HW.legend?.items || []).includes(k)) out.push(`one in ${Math.round(1 / HW.legend.chance).toLocaleString()} off any monster of level ${HW.legend.lvl} or more, during the Long Night`);
  const m = HW.market.find(([x]) => x === k); if (m) out.push(`Hexa's Night Market, ${m[2].toLocaleString()} candy corn`);
  const q = Object.entries(QUESTS).find(([qk, q]) => qk.startsWith("hw_") && (q.reward.items || []).some(([x]) => x === k)); if (q) out.push(`the reward for ${q[1].name}`);
  return out;
};
ITEMS.gallows_bow = { name: "Gallows Bow", short: "Bow", icon: "\u{1F3F9}", slot: "weapon", acc: 17, str: 9, launcher: { range: 6, ammo: "arrow" }, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { tix: 0.06, rare: 0.10 }, req: { skill: "archery", lvl: 50 }, ex: "Cut from the gallows tree. One chop in ten thousand brings it down, during the Long Night only. Kills pay 6% more and rare drops come 10% easier." };
ITEMS.lantern_quiver = { name: "Lantern Quiver", short: "Quiver", icon: "\u{1F383}", slot: "shield", pouch: { ammo: "arrow", cap: 400 }, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { ammo: 0.25 }, req: { skill: "archery", lvl: 50 }, ex: "A carved pumpkin with a strap. One arrow in four flies back into it: a quarter of your shots spend nothing. The King drops it; Hexa sells it." };
ITEMS.skull_wand = { name: "Skull Wand", short: "Wand", icon: "\u{1F480}", slot: "weapon", acc: 20, str: 8, launcher: { range: 5, ammo: "page", style: "magic" }, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { leech: 0.10 }, req: { skill: "magic", lvl: 50 }, ex: "Somebody's, once. A tenth of every spell's damage comes back to you as health. The King drops it; Hexa sells it." };
ITEMS.bag_shroud = { name: "Shroud Satchel", short: "Satchel", icon: "\u{1F45D}", slot: "shield", pouch: { ammo: "page", cap: 1000 },   /* (2026-09-27, the owner: "a noticeable increase in spells held") twice a level-50 bag: the Starweave's 1,000, twenty levels early */ tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { ammo: 0.25 }, req: { skill: "magic", lvl: 50 }, ex: "Sewn from a burial shroud, and deeper than it looks: it holds 1,000 pages, twice any other bag at its level. A quarter of your casts spend no page. The King drops it; Hexa sells it." };
ITEMS.drowned_boots = { name: "Drowned Boots", short: "Boots", icon: "\u{1F462}", slot: "boots", def: 6, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { speed: 0.08, tix: 0.03 }, req: { skill: "melee", lvl: 50 }, ex: "They came up on a line. One cast in ten thousand, during the Long Night only. You move, swing and fish 8% faster, and kills pay 3% more." };
ITEMS.coffin_ring = { name: "Coffin Ring", short: "Ring", icon: "\u{1F48D}", slot: "ring", acc: 8, str: 8, def: 8, tier: "hallowed", forgeWith: ["candycorn", 400], event: true, fx: { double: 0.10 }, req: { skill: "hp", lvl: 50 }, ex: "Coffin iron, with a coffin on it. One swing in ten thousand at any rock turns it up, during the Long Night only. One dig, cut or catch in ten comes up double." };
/* the three legendaries: level 90, nova-grade numbers, one effect each that nothing else in the game has */
ITEMS.reaper_scythe = { name: "The Reaper's Scythe", short: "Scythe", icon: "\u{1F5E1}️", slot: "weapon", acc: 36, str: 36, tier: "hallowed", forgeWith: ["candycorn", 900], event: true, legend: true, fx: { execute: 0.20, tix: 0.08 }, req: { skill: "melee", lvl: 90 }, ex: "Any monster under a fifth of its health dies to the next swing, outright. Never a boss. Kills pay 8% more. The King, one in a hundred; anything of level 80 or more, one in three thousand, during the Long Night." };
ITEMS.king_crown = { name: "The Pumpkin King's Crown", short: "Crown", icon: "\u{1F451}", slot: "helm", def: 18, acc: 4, tier: "hallowed", forgeWith: ["candycorn", 900], event: true, legend: true, fx: { calm: 1, tough: 0.10 }, req: { skill: "melee", lvl: 90 }, ex: "Wear it and nothing outside attacks you first: every monster waits for your swing. You take 10% less damage. The King, one in a hundred; anything of level 80 or more, one in three thousand, during the Long Night." };
ITEMS.ferry_coin = { name: "The Ferryman's Coin", short: "Coin", icon: "\u{1FA99}", slot: "amulet", acc: 15, str: 15, def: 15, tier: "hallowed", forgeWith: ["candycorn", 900], event: true, legend: true, fx: { nobill: 1, zdrop: 0.15 }, req: { skill: "hp", lvl: 90 }, ex: "Charon's own fare. The hospital never bills you again, and a real ZCoin is 15% more likely to drop. The King, one in a hundred; anything of level 80 or more, one in three thousand, during the Long Night." };
Object.assign(VALUE, { candycorn: 0, pumpkin: 20, seed_pumpkin: 6, pumpkinpie: 60, ectoplasm: 30, pot_witch: 220, hallowed_helm: 900, hallowed_body: 1400, hallowed_legs: 1100,
  gallows_bow: 1600, lantern_quiver: 1200, skull_wand: 1600, bag_shroud: 1200, drowned_boots: 1400, coffin_ring: 1500, reaper_scythe: 9000, king_crown: 8000, ferry_coin: 8500 });

/* the crop: a seed crop like the elemental ones (the seed is planted, the pumpkin comes off it), quick so a plot planted at Nightfall is pie by morning */
CROPS.seed_pumpkin = { lvl: 20, ms: 90 * 60000, yield: [2, 4], xp: 260, col: "#ff8a30", yields: "pumpkin", art: "pumpkin", event: true };
recipe("cook_pumpkin", { skill: "cooking", station: "fire", lvl: 25, xp: 95, ms: 2600, in: [["pumpkin", 1]], out: ["pumpkinpie", 1], burnStop: 62 });
recipe("brew_witch", { skill: "alchemy", station: "cauldron", lvl: 30, xp: 140, ms: 2200, in: [["medium_vial", 1], ["ectoplasm", 2], ["pumpkin", 1]], out: ["pot_witch", 1] });

/* THE PUMPKIN KING. Numbers are FINAL (the load-time passes above have already run): three players take about ten
   minutes and one alone cannot finish him (ten times the launch health, 2026-09-27). He hits like the Critic and stands still until struck, then chases. */
MOBS.pumpkinking = { name: "The Pumpkin King", size: "xl", lvl: 52, hp: 5200,   /* (2026-09-27, the owner, after three of them killed the 520 King in about a minute: "significantly higher, like 10x". 520 -> 5,200. Measured at launch, three players take about ten minutes; one player alone will not finish him inside the twenty he stands, which is the point: he is a crowd's boss. Combat xp is paid per point of damage, so his xp is ten times what it was too) */ att: 46, def: 40, max: 14, speed: 1900, aggro: 4, box: [26, 60], oy: -8, event: true, boss: true,
  drops: [["tickets", [420, 720]], ["candycorn", [25, 45]], ["ectoplasm", [2, 4]], ["hallowed_helm", 1, 0.08], ["hallowed_body", 1, 0.06], ["hallowed_legs", 1, 0.06],
    ["lantern_quiver", 1, 0.02], ["skull_wand", 1, 0.02], ["bag_shroud", 1, 0.02], ["reaper_scythe", 1, 0.01], ["king_crown", 1, 0.01], ["ferry_coin", 1, 0.01]],   /* (2026-09-27) the pieces, see EVENT_TAG */
  rare: [], pet: ["blackcat", 0.025],   /* the Black Cat: one King in forty */
  enrage: { at: 0.3, mul: 1.5, say: "The Pumpkin King's grin splits wider. The lantern in his head flares." } };
BOUNTY.pumpkinking = 560; BOSSES.add("pumpkinking"); AGGRO_ON.add?.("pumpkinking");
MOBS.pumpkinking.weak = ["fire", "sun"];
/* (2026-09-27, the owner: "only one person can attack the pumpkin king") AN OPEN BOSS. `open` switches the claim off for this one
   monster - the first hit no longer locks him to one player - and the server credits EVERYONE who took at least OPEN_SHARE of his
   health with the kill: their own drop roll, their own corn, their own quest credit. So a crowd in the Mire is the design, not a
   race, and nobody can tag him once and walk off with a share. */
MOBS.pumpkinking.open = true;
export const OPEN_SHARE = 0.05;
MOBS.rotten.drops.push(["goldtomatoe", 1, 0.002]);   /* (2026-09-27) the first Golden tomatoe: see GOLD_TOMATO_HARVEST */   /* set on the mob directly: the WEAK table was folded into MOBS at load, above */
PETS.blackcat = { name: "Black Cat", art: "pet_blackcat", raid: true, event: true, fx: { speed: 4, tix: 5 }, ex: "It crossed your path on purpose. Walks a little quicker and, somehow, the tickets come a little better around it." };

/* the two fits, priced in candy corn: bought at the Night Market or at Ronde's, worn and coloured at Ronde's like any other */
VANITY_SETS.skeleton = { name: "Skeleton", blurb: "Every bone on the outside, where people can see the work.", corn: true, event: true };
VANITY_SETS.ghost = { name: "Ghost", blurb: "A sheet with eye holes. Timeless.", corn: true, event: true };
for (const [set, pieces, corn] of [["skeleton", { head: ["Skull", true], body: ["Ribcage", false], legs: ["Leg bones", false], feet: ["Bony feet", false] }, 2400], ["ghost", { head: ["Sheet hood", true], body: ["Sheet", false] }, 3000]])   /* (2026-09-27) was 90 and 110: a fortnight's corn each now, see HW.market */
  for (const [slot, [name, hidesHair]] of Object.entries(pieces)) VANITY[`${set}_${slot}`] = { set, slot, name, hidesHair, price: 0, corn, event: true };

/* the three quests: a chain, one per tier, given by the Mire's lamplighter, the Boneyard's Sister and the Night Market's witch */
Object.assign(QUESTS, {
  hw_lights: {
    name: "Lights Out", giver: "Mudge the Lamplighter", where: "The Lantern Mire", icon: "\u{1F383}", tier: "easy", event: true,
    brief: "Mudge's lanterns have gone green. Bring him five ectoplasm so he can find out why.",
    stages: [{ type: "bring", items: ["ectoplasm"], n: 5, what: "ectoplasm" }],
    talk: { offer: ["Green. Every lantern on the walk, green, and I did not light them green.", "Whatever is doing it leaves this slime behind. Bring me five of it. Anything you kill out here might drop some, this month."], accept: "Five ectoplasm.", decline: "Then walk in the dark.",
      accepted: "Kill things. Look at what falls off them. You'll know it when it's cold.", progress: "Five ectoplasm. You've {have}.", ready: "Cold. Yes. That's it. Give it here.", hand: "Five, as asked.", done: "It's not oil and it's not gas and I've got no idea what to do with it. Here. Spend this at the witch's tent before she leaves." },
    reward: { coins: 300, xp: { melee: 400 }, items: [["candycorn", 60]], text: "300 tickets, 400 Melee xp, 60 candy corn" }
  },
  hw_vigil: {
    name: "The Sister's Vigil", giver: "Sister Morrow", where: "The Boneyard", icon: "\u{1F56F}️", tier: "medium", requires: ["hw_lights"], event: true,
    brief: "Sister Morrow is keeping a vigil through the Long Night. Bring her ten bones, then a pumpkin pie, then carry her word to Grimm.",
    stages: [{ type: "bring", items: ["bones"], n: 10, what: "bones", say: ["Ten. Thank you. Lay them by the gate.", "Now: I've not eaten since the lanterns changed. Bake me a pumpkin pie. The witch in the Yard sells the seed."], reply: "A pie. Right." },
      { type: "bring", items: ["pumpkinpie"], n: 1, what: "pumpkin pie", say: ["Warm. You're a good sort.", "One more thing. Tell Grimm the Hermit that the King is walking again. He'll know what it means. I don't want to."], reply: "I'll tell him." },
      { type: "talk", npc: "Grimm the Hermit", say: ["The King. Walking. Of course he is, it's the season.", "Tell the Sister I said to keep her lamps lit and her door shut. And tell her he can be killed, if enough of you go."], reply: "I'll tell her." }],
    talk: { offer: ["I sit up through the Long Night. Somebody has to.", "Ten bones for the gate, a pie for me, and a message for the hermit. Three small things."], accept: "Three small things.", decline: "Then I'll sit alone.",
      accepted: "Bones first. The Boneyard is full of them, and the things that drop them.", progress: "Bones, then pie, then Grimm. Where are you?", ready: "And what did the hermit say?", hand: "Keep your lamps lit. He can be killed.", done: "Killed. Good. Then go and kill him. Here: I've no use for candy, and the witch takes it." },
    reward: { coins: 1500, xp: { cooking: 1200, melee: 800 }, items: [["candycorn", 150], ["seed_pumpkin", 3]], text: "1,500 tickets, 1,200 Cooking xp, 800 Melee xp, 150 candy corn, 3 pumpkin seeds" }
  },
  hw_king: {
    name: "The Pumpkin King", giver: "Hexa the Candy Witch", where: "The Yard", icon: "\u{1F451}", tier: "hard", requires: ["hw_vigil"], event: true,
    brief: "Kill the Pumpkin King. He rises once an hour in the Lantern Mire, and he does not go quietly.",
    stages: [{ type: "kill", mob: "pumpkinking", n: 1, what: "Pumpkin King" }],
    talk: { offer: ["He rises on the hour, in the Mire, and everybody runs. I'd like somebody not to.", "Kill him once. Bring me the story. I'll pay for the story."], accept: "I'll kill him.", decline: "Then run with the rest.",
      accepted: "On the hour. Bring friends: he hits like a falling tree and he doesn't like fire.", progress: "Still walking, is he? On the hour, in the Mire.", ready: "You're standing there, so he isn't. Tell me.", hand: "He went down.", done: "Then the Long Night has a hero, which it's never had. This was his, or as near as makes no difference. Wear it." },
    reward: { coins: 6000, xp: { melee: 5000, hp: 2000 }, items: [["hallowed_helm", 1], ["candycorn", 300]], text: "6,000 tickets, 5,000 Melee xp, 2,000 Hitpoints xp, the Hallowed helm, 300 candy corn" }
  }
});
/* the witch stands by her tent in the Yard for the month. She is in the list all year with `event: true`, and the scene builder on
   BOTH sides leaves event people out while the event is off. NOT `if (hwOn())` here: Cloudflare freezes the clock while a module
   loads, so at start-up the server's Date.now() is not today and the test would always say no. Decide at build time, never at load. */
SCENES.workyard.npcs.push({ name: "Hexa the Candy Witch", event: true, art: "hexa", x: 18, y: 11, still: true,   /* (2026-09-27) was 24,11 with the tent on the north road; the owner: "right in the road in the yard". West of the road now, on the grass between the bush and the Gloam sign */ quests: ["hw_king"], opens: "market", reach: 3, hair: "#3a2a4a", shirt: "#2a1a3a", pants: "#4a2a5a",
  lines: ["Candy corn. Bring me candy corn. It falls off everything this month, if you're the kind of person things fall off for.", "The King rises on the hour in the Mire. I sell to the ones who come back.", "Seeds, vials, slime, pie. And two fits, if you've the corn: a skeleton and a sheet. Ronde does the colours.", "I pack the tent on the second of November and the corn goes to sugar in your bag the same morning. Whatever you've bought, you keep. Whatever you haven't, you won't."] });

/* THE DRESSING AND THE HUNT, on every open outdoor map: jack-o'-lanterns by the paths, and the day's ghost lanterns. Both are
   ordinary objects added in buildScene, so the page and the server place them identically from the same seed. The lanterns move
   every Chicago day: a scene built today and still standing at midnight keeps yesterday's until it is rebuilt, which is fine. */
const HW_OUTDOORS = ["workyard", "gloam", "mire", "boneyard", "sands", "cloud", "thunderhead", "carnival", "trailer"];
export function hwObjs(key, b) {
  if (!hwOn() || !HW_OUTDOORS.includes(key)) return;
  const g = b.g, objs = b.objs, day = chicagoDay(), seed = [...(day + key)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = (i) => { let x = (seed ^ (i * 0x9e3779b9)) >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; };
  const free = (x, y) => x > 1 && y > 1 && x < COLS - 2 && y < ROWS - 2 && g[y][x] === "." && !objs.some((o) => cheb(o, { x, y }) <= 1);
  /* the tent and its keeper's pumpkins, in the Yard only */
  if (key === "workyard") { objs.push({ t: "nightmarket", x: 16, y: 9, w: 3, h: 2, name: "The Night Market", event: true }); for (let yy = 9; yy <= 10; yy++) for (let xx = 16; xx <= 18; xx++) g[yy][xx] = "#"; for (const [x, y] of [[15, 11], [19, 11]]) if (g[y][x] === ".") { objs.push({ t: "jack", x, y, name: "A jack-o'-lantern", event: true, soft: true }); } }
  /* jack-o'-lanterns: six a map, on grass beside paths */
  let placed = 0;
  for (let i = 0; i < 400 && placed < 6; i++) { const x = 2 + Math.floor(rnd(i) * (COLS - 4)), y = 2 + Math.floor(rnd(i + 1000) * (ROWS - 4)); if (!free(x, y)) continue; if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] === ",")) continue; objs.push({ t: "jack", x, y, name: "A jack-o'-lantern", event: true, soft: true }); placed++; }
  /* the ghost lanterns: HW.lanterns across the nine maps, so about one a map, and never twice in the same place two days running */
  const slot = HW_OUTDOORS.indexOf(key), per = Math.ceil(HW.lanterns / HW_OUTDOORS.length), n = Math.min(per, Math.max(0, HW.lanterns - slot * per));
  placed = 0;
  for (let i = 0; i < 600 && placed < n; i++) { const x = 2 + Math.floor(rnd(i + 5000) * (COLS - 4)), y = 2 + Math.floor(rnd(i + 7000) * (ROWS - 4)); if (!free(x, y)) continue; objs.push({ t: "ghostlantern", x, y, name: "A ghost lantern", event: true, lid: `${key}:${day}:${x},${y}` }); g[y][x] = "#"; placed++; }
}


/* ============================================================ THE STORE (2026-09-27) — tickets only
   The owner: "users could buy a 2X potion, chat name effects/colors/icons, some unique store skins". A TICKET SINK that sells looks
   and moments and never a number in a fight or a skill roll. One table, one server op, one window; a purchase is a row in
   `C.store.own` (permanent) or an effect applied on the spot (the boosts). Name cosmetics live in `C.store.name` and ride the
   roster, the chat line and the profile, so everyone sees them. Prices are pinned here and never read from a client.
   (2026-09-27, the owner: "need it to be high at the start then we can lower for event, etc" - launch prices are double the first
   draft; the 2X is 100,000 by his number.) */
export const STORE_TABS = { boost: "Boosts", name: "Name" };
export const NAME_COLS = { red: "#e0453a", blue: "#4a8ee8", green: "#4fbf5a", gold: "#ffd24a", purple: "#b06ae8", orange: "#ff8a3a", pink: "#ff7ac8", ice: "#a8dcff", bone: "#efe6d0", blood: "#b3121a" };
export const NAME_FX = { shine: "Shine", pulse: "Pulse", rainbow: "Rainbow", glitch: "Glitch", flicker: "Flicker" };
export const NAME_ICONS = ["skull", "crown", "fish", "dice", "seven", "cat", "ghost", "star", "bolt", "heart", "pickaxe", "chip"];
export const NAME_FRAMES = { bone: "#efe6d0", gold: "#ffd24a", neon: "#ff4fd8", chain: "#b9b9b9", ivy: "#57c46a" };
export const STORE = {};
const st = (id, row) => { STORE[id] = { id, ...row }; };
/* boosts: consumables; the 2X is the room's, one at a time */
st("double", { tab: "boost", kind: "double", name: "2X Potion", price: 100000, icon: "pot_double", ex: "Thirty minutes of double tickets and double crafting xp for EVERYONE on the server, popped in your name. One at a time: while one runs, this waits." });
st("clovers", { tab: "boost", kind: "give", give: ["clover", 5], name: "Lucky Clovers ×5", price: 8000, icon: "clover", ex: "Five clovers. Each makes your next fifteen kills or catches lucky." });
st("homeward", { tab: "boost", kind: "give", give: ["scroll_homeward", 3], name: "Homeward Scrolls ×3", price: 5000, icon: "scroll_homeward", ex: "Three pages home. Wizardry prints them cheaper; this is for people in a hurry." });
/* name colours: the ten, three of them dear */
for (const [k, col] of Object.entries(NAME_COLS)) st(`col_${k}`, { tab: "name", kind: "col", slot: "col", val: k, col, name: `${k[0].toUpperCase()}${k.slice(1)} name`, price: k === "gold" ? 120000 : k === "bone" || k === "blood" ? 50000 : 16000, ex: k === "gold" ? "The one everybody notices." : "Your name in this colour, over your head and in chat." });
for (const [k, name] of Object.entries(NAME_FX)) st(`fx_${k}`, { tab: "name", kind: "fx", slot: "fx", val: k, name: `${name} effect`, price: 40000, ex: { shine: "A light passes along your name.", pulse: "Your name breathes.", rainbow: "Every colour, in turn.", glitch: "Your name cannot quite hold still.", flicker: "A candle in a draught." }[k] });
for (const k of NAME_ICONS) st(`icon_${k}`, { tab: "name", kind: "icon", slot: "icon", val: k, name: `${k[0].toUpperCase()}${k.slice(1)} badge`, price: 12000, ex: "A small badge before your name." });
for (const [k, col] of Object.entries(NAME_FRAMES)) st(`frame_${k}`, { tab: "name", kind: "frame", slot: "frame", val: k, col, name: `${k[0].toUpperCase()}${k.slice(1)} frame`, price: 30000, ex: "A thin frame around your name over your head." });
/* (2026-09-27) THE LONG NIGHT'S TWO, bought at the Night Market with candy corn and never for tickets: tab "night" keeps them off the
   Store's own tabs, `corn` is the price, and once owned they show in the Name tab like anything else, for good - the urgency is that
   they can only be BOUGHT this month. The colour and the frame are entries in NAME_COLS / NAME_FRAMES added AFTER the loops above,
   so no ticket-priced twin is generated for them. */
NAME_COLS.pumpkin = "#ff7a1a"; NAME_FRAMES.ember = "#ff4a12";
st("col_pumpkin", { tab: "night", kind: "col", slot: "col", val: "pumpkin", col: NAME_COLS.pumpkin, name: "Pumpkin name", price: 0, corn: 1500, event: true, ex: "Your name in jack-o'-lantern orange, over your head and in chat. Only sold during the Long Night; yours for good." });
st("frame_ember", { tab: "night", kind: "frame", slot: "frame", val: "ember", col: NAME_FRAMES.ember, name: "Ember frame", price: 0, corn: 2000, event: true, ex: "A thin frame the colour of a lantern's coal around your name. Only sold during the Long Night; yours for good." });
export const STORE_SLOTS = ["col", "fx", "icon", "frame"];
/** what a character's name wears: { col, fx, icon, frame } of item ids, or null when nothing is set */
export const nameFxOf = (c) => { const n = c?.store?.name; if (!n) return null; const out = {}; let any = false; for (const s of STORE_SLOTS) { const it = n[s] && STORE[n[s]]; if (it && (c.store.own || []).includes(it.id)) { out[s] = it.val; any = true; } } return any ? out : null; };
export const nameFxSig = (f) => (f ? STORE_SLOTS.map((s) => f[s] || "").join(".") : "");
export const ownsStore = (c, id) => !!(c?.store?.own || []).includes(id);

/* ============================================================ FUNGICULTURE (2026-09-27, the massive update, 2 of 8)
   The owner: a ladder bought at Yahsmeena, placed on your island, down to a cellar with fungus beds that work like plots but are
   their own thing; shrooms also from clusters scattered around the world; and it has to end the sporecap being the ONE early
   input to Wizardry and Fletching. Three sources, one ladder of thirteen shrooms:
   - THE CELLAR (`cellar:<owner>`, built like the Cottage): bedsOf(tier) beds, planted with SPAWN (the "seed") and fed with
     COMPOST, one to three a planting by level. A bed gives its spawn back like a seed crop (SEED_BACK, SEED_EXTRA), so a cellar
     found once keeps itself going. The compost bin is in the cellar and is where the skill is trained from level 1.
   - WILD CLUSTERS: three on every outdoor map, AT FIXED SPOTS (seeded by the map, never the date: a cluster that moved at
     midnight would put the page and the server on different maps for whoever was standing there). Each one gives every player
     one pick a Chicago day: its shroom, Fungiculture xp, and FUNG.wildSpawn of the time its spawn.
   - THE TRUFFLE, which grows nowhere wild: a Truffle Pig worn while picking or harvesting finds it (FUNG.truffle).
   Everything a shroom goes into is an existing system (a drink, a meal, a pet food, an ink) with its existing buff keys: no new
   plumbing, and nothing here buys xp. */
export const FUNG = { beds: [0, 6, 8, 10], bedMax: 10, wildN: [1, 3], wildSpawn: 0.35, wildXp: 0.4, truffle: { pick: 0.2, spawn: 0.08, bed: 0.05 }, ladder: "cellarladder" };
SKILLS.fungiculture = { name: "Fungiculture", icon: "\u{1F344}" };
SKILL_GROUPS.find((g) => g.name === "Skilling")?.keys.push("fungiculture");
HISCORES.push(["fungiculture", "Fungiculture", "level", "lvl"]);
STATIONS.compost = { skill: "fungiculture", verb: "mix", name: "compost bin", auto: false, kind: "rot" };
Object.assign(VERB, { compost: "Mix-at", fbed: "Tend", shroom: "Pick", cellar: "Climb-down" });
/* the ladder: [shroom, level, grow minutes, yield, xp a harvest, compost a planting, sells for, name, what it says] */
const FUNG_ROWS = [
  ["sporecap",    1,   8, [3, 5],   24, 1, 6,   null, null],
  ["buttoncap",   5,  15, [3, 5],   50, 1, 8,   "Button cap", "Plump, white and polite. The only mushroom in EastScape that has never looked at you funny."],
  ["oyster",     12,  25, [3, 5],   95, 1, 14,  "Oyster shelf", "Fans of grey flesh off a bit of bark. Boiled down it is the glue that holds a feather to a shaft."],
  ["puffball",   20,  40, [3, 5],  160, 1, 22,  "Puffball", "Squeeze it and it breathes out a little brown cloud. The cloud makes people sleepy, which thieves have noticed."],
  ["bluemould",  28,  60, [3, 5],  270, 1, 32,  "Blue mould", "Velvet-soft and faintly blue. Pack Rats would sell their own mothers for it, and have."],
  ["inkcap",     35,  80, [3, 6],  400, 1, 44,  "Inkcap", "It melts into black ink from the rim up. One of these writes more than a pocket of sporecaps."],
  ["bleedtooth", 42, 100, [3, 5],  540, 2, 56,  "Bleeding tooth", "Beads of red on a white cap. It isn't blood. Probably. Brewed, it makes you harder to hurt."],
  ["glowcap",    50, 120, [3, 5],  720, 2, 72,  "Glowcap", "Lights its own corner of the cellar. Lantern Moths find it from across a map."],
  ["ghostpipe",  58, 150, [2, 4],  920, 2, 90,  "Ghost pipe", "Waxy, white, no green in it anywhere. It grows on the dead and it makes the living lucky."],
  ["truffle",    65, 180, [2, 4], 1180, 2, 130, "Black truffle", "Found by pigs, grown by the patient, eaten by the rich. Nothing wild gives one up without a Truffle Pig."],
  ["lionsmane",  72, 240, [2, 4], 1550, 3, 155, "Lion's mane", "A shaggy white ball of icicles. Chewed, the world slows down and your hands don't."],
  ["voidmorel",  80, 300, [2, 4], 2100, 3, 195, "Void morel", "The pits in its cap are full of a light that isn't there. Ink brewed from it writes in the dark."],
  ["starcap",    90, 360, [2, 3], 2900, 3, 260, "Starcap", "Five points and a shine of its own. It fell with the rest of the Trailer Park and took root in the wreckage."]
];
export const FUNGI = {};
for (const [k, lvl, mins, yld, xp, compost, sell, name, ex] of FUNG_ROWS) {
  if (name) ITEMS[k] = { name, icon: "\u{1F344}", ex };
  const sk = `spawn_${k}`;
  ITEMS[sk] = { name: `${ITEMS[k].name} spawn`, icon: "\u{1F9EB}", ex: `Plant it in a fungus bed in your cellar (Fungiculture ${lvl}) with ${compost} compost. It grows ${ITEMS[k].name.toLowerCase()}, and gives spawn back.` };
  FUNGI[sk] = { lvl, ms: mins * 60000, yield: yld, xp, compost, yields: k, art: k };
  VALUE[k] = sell; VALUE[sk] = 0;
}
ITEMS.compost = { name: "Compost", icon: "\u{1F7EB}", ex: "Rot, bone and ash, turned in the cellar's bin. Every fungus bed wants some when it is planted." };
VALUE.compost = 2;
/** what a fungus bed gives */
export const fungYield = (k) => FUNGI[k]?.yields || k;
/** the beds an island's cellar has open, by the island's tier */
export const bedsOf = (isle) => FUNG.beds[Math.min(3, Math.max(1, isle?.tier || 1))];
/** is a Truffle Pig out (the only thing that finds a truffle in the wild) */
export const truffleNose = (C) => activePet(C)?.k === "trufflepig";
/** the wild clusters of each outdoor map, three a map. The Carnival has no shroom of its own and lends the Wilderness's, so
    Ghost pipe is never PvP-only. The truffle is nowhere: see FUNG.truffle. */
export const FUNG_WILD = {
  workyard: ["sporecap", "buttoncap", "buttoncap"], gloam: ["oyster", "oyster", "sporecap"], mire: ["puffball", "puffball", "puffball"],
  boneyard: ["bluemould", "bluemould", "bluemould"], cloud: ["inkcap", "inkcap", "inkcap"], sands: ["bleedtooth", "bleedtooth", "bleedtooth"],
  thunderhead: ["glowcap", "glowcap", "glowcap"], carnival: ["ghostpipe", "glowcap", "ghostpipe"], wild: ["ghostpipe", "ghostpipe", "ghostpipe"],
  vault: ["lionsmane", "lionsmane", "lionsmane"], deep: ["voidmorel", "voidmorel", "voidmorel"], trailer: ["starcap", "starcap", "starcap"]
};
/** THE CLUSTERS ARE ORDINARY OBJECTS, added in buildScene BEFORE the Long Night's, so the page and the server place them the
    same way from the same seed, and nothing about them depends on the date or on an event being on. A cluster wants open ground
    on all eight sides (so it can never wall a path off) and keeps clear of every monster's and person's home tile. */
export function fungObjs(key, b) {
  const list = FUNG_WILD[key]; if (!list) return;
  const def = sceneDef(key), g = b.g, objs = b.objs, homes = [...(def?.mobs || []).map(([, x, y]) => ({ x, y })), ...(def?.npcs || [])];
  const seed = [...`fung:${key}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 11);
  const rnd = (i) => { let x = (seed ^ (i * 0x9e3779b9)) >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; };
  const open = (x, y) => g[y]?.[x] === "." || g[y]?.[x] === "i";
  const free = (x, y) => x > 2 && y > 2 && x < COLS - 3 && y < ROWS - 3 && open(x, y) && D8.every(([dx, dy]) => open(x + dx, y + dy))
    && !objs.some((o) => cheb(o, { x, y }) <= 1) && !homes.some((h) => cheb(h, { x, y }) <= 1)
    && ![-2, -1, 0, 1, 2].some((dy) => [-2, -1, 0, 1, 2].some((dx) => "pe".includes(g[y + dy]?.[x + dx] || "")));   /* clear of walkways and ways out */
  let placed = 0;
  const put = (x, y) => { const k = list[placed]; objs.push({ t: "shroom", k, x, y, art: `fung_${k}_4`, name: `Wild ${ITEMS[k].name.toLowerCase()}`, lid: `${key}:${x},${y}` }); g[y][x] = "#"; placed++; };
  for (let i = 0; i < 900 && placed < list.length; i++) { const x = 3 + Math.floor(rnd(i) * (COLS - 6)), y = 3 + Math.floor(rnd(i + 3000) * (ROWS - 6)); if (free(x, y)) put(x, y); }
  /* THE CROWDED MAPS (the Wilderness and the Deep Wild are rock and trees with paths between, and have almost no tile with open
     ground all round). A second, looser pass takes any bare tile that is nobody's home, and PROVES it walls nothing off: every
     tile that could be walked to from the map's way in still can, bar the one the cluster stands on. */
  if (placed < list.length) {
    const start = (() => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "e") return { x, y }; return null; })();
    const reach = () => { if (!start) return 0; const seen = new Set([start.y * COLS + start.x]), q = [start]; while (q.length) { const c = q.pop(); for (const [dx, dy] of D8) { const nx = c.x + dx, ny = c.y + dy, k = ny * COLS + nx; if (!seen.has(k) && canStepIn(g, c.x, c.y, dx, dy)) { seen.add(k); q.push({ x: nx, y: ny }); } } } return seen.size; };
    let base = reach();
    for (let i = 0; i < 1500 && placed < list.length && start; i++) {
      const x = 3 + Math.floor(rnd(i + 9000) * (COLS - 6)), y = 3 + Math.floor(rnd(i + 12000) * (ROWS - 6));
      if (!open(x, y) || homes.some((h) => cheb(h, { x, y }) <= 1) || objs.some((o) => o.t === "shroom" && cheb(o, { x, y }) <= 3)) continue;
      const was = g[y][x]; g[y][x] = "#";
      if (reach() === base - 1) { g[y][x] = was; put(x, y); base--; } else g[y][x] = was;
    }
  }
}
/* THE CELLAR. A private room under the owner's island: the stone steps on the bottom edge go back up to the ladder. Beds past the
   island's tier are there but boarded (the server refuses them, the page draws them shut), so it is the same room at every tier.
   Its floor and walls are the Crypt's for now: the owner picks the cellar's own tiles, as he did the Wilderness's. */
SCENES.cellar = {
  name: "The Cellar", interior: true, cellar: true, floorArt: "t_crypt", wallArt: "t_cryptwall", room: [5, 3, 16, 10], exitTo: { scene: "isle", x: 10, y: 4 }, entry: { x: 10, y: 10 },
  build() {
    const g = room(5, 3, 16, 10, 10), objs = [];
    [[6, 5], [8, 5], [10, 5], [12, 5], [14, 5], [6, 8], [8, 8], [10, 8], [12, 8], [14, 8]].forEach(([x, y], i) => { objs.push({ t: "fbed", i, x, y, name: "Fungus bed" }); g[y][x] = "#"; });
    objs.push({ t: "compost", x: 15, y: 3, name: "Compost bin" }); g[3][15] = "#";
    for (const [x, y] of [[5, 3], [16, 3], [5, 10], [16, 10]]) { objs.push({ t: "barrel", x, y, name: "Barrel" }); g[y][x] = "#"; }
    return { g, objs, blobs: [] };
  },
  mobs: [], npcs: [], bots: []
};
EXAMINE.fbed = ["A box of black earth that smells like a forest floor after rain. Plant spawn in it."];
EXAMINE.compost = ["It's warm. It is not supposed to be warm, and yet."];
/* compost, at the cellar's bin: how Fungiculture is trained from level 1, and why the Yard's tomatoes, the olive trees' pits and
   the furnace's charcoal stay worth having */
const rot = (id, lvl, xp, ins, n) => recipe(`rot_${id}`, { skill: "fungiculture", station: "compost", lvl, xp, ms: 2200, in: ins, out: ["compost", n] });
rot("tomatoe", 1, 9, [["tomatoe", 3], ["bones", 1]], 2);
rot("husk", 8, 16, [["husk", 2], ["bones", 1], ["charcoal", 1]], 4);
rot("pit", 18, 24, [["pit", 3], ["bones", 2], ["charcoal", 1]], 5);
rot("gourd", 45, 60, [["bonegourd", 1], ["bones", 3], ["charcoal", 2]], 8);
/* WHERE THE SHROOMS GO: into things that already exist, each made by the skill that already makes them */
const fdrink = (k, name, mins, fx, ex) => { ITEMS[k] = { name, icon: "\u{1F9EA}", drink: { mins, fx }, ex }; };
fdrink("pot_sleep", "Puffball sleep-dust", 15, { steal: 0.06 }, "A twist of paper full of brown puff. 15 minutes outside: marks get drowsy and pockets come easier.");
fdrink("pot_bleed", "Bleeding-tooth draught", 20, { tough: 0.12 }, "Thick and red and it stings. 20 minutes outside: you take a good deal less.");
fdrink("pot_pipe", "Ghost-pipe tincture", 20, { rare: 0.16 }, "Clear as water and cold as a grave. 20 minutes outside: the good drops come looser.");
fdrink("pot_mane", "Lion's-mane focus", 25, { speed: 0.10, bite: 0.03 }, "Everything slows down except you. 25 minutes outside: quick hands, and the fish come to you.");
fdrink("pot_star", "Starcap elixir", 30, { tough: 0.22, speed: 0.10, rare: 0.08 }, "It glows in the bottle and in you. 30 minutes outside: hard to hurt, quick, and lucky with it.");
ITEMS.mushroom_soup = { name: "Mushroom soup", icon: "\u{1F963}", heal: 9, ex: "Button caps and a crust. Heals 9." };
ITEMS.truffle_dinner = { name: "Truffle dinner", icon: "\u{1F37D}️", heal: 34, meal: { mins: 20, fx: { rare: 0.2, tix: 0.05 } }, ex: "Shaved truffle on a steak. Heals 34 and, for twenty minutes outside, the good stuff turns up and it pays a little more." };
ITEMS.starcap_feast = { name: "Starcap feast", icon: "\u{1F31F}", heal: 50, meal: { mins: 20, fx: { tough: 0.15, rare: 0.2, tix: 0.08 } }, ex: "Starcap and starfruit, and nobody talks while they eat it. Heals 50: the best meal in EastScape." };
Object.assign(VALUE, { pot_sleep: 70, pot_bleed: 150, pot_pipe: 200, pot_mane: 260, pot_star: 420, mushroom_soup: 18, truffle_dinner: 240, starcap_feast: 420 });
const fbrew = (id, lvl, xp, ins, out, n = 1) => recipe(id, { skill: "alchemy", station: "cauldron", ms: 2200, lvl, xp, in: ins, out: [out, n] });
fbrew("brew_ink_button", 3, 18, [["small_vial", 1], ["buttoncap", 2]], "ink_arcane", 2);   /* the sporecap is no longer the only way into Wizardry */
fbrew("brew_ink_inkcap", 35, 60, [["small_vial", 1], ["inkcap", 1]], "ink_arcane", 5);
fbrew("brew_ink_morel", 80, 160, [["medium_vial", 1], ["voidmorel", 1]], "ink_void", 3);
fbrew("brew_feathers_oyster", 12, 20, [["small_vial", 1], ["feather", 3], ["oyster", 1]], "feather", 20);   /* ...or into Fletching */
fbrew("brew_sleep", 20, 44, [["small_vial", 1], ["puffball", 2]], "pot_sleep");
fbrew("brew_bleed", 42, 80, [["medium_vial", 1], ["bleedtooth", 2], ["bones", 1]], "pot_bleed");
fbrew("brew_pipe", 58, 110, [["medium_vial", 1], ["ghostpipe", 2]], "pot_pipe");
fbrew("brew_mane", 72, 140, [["large_vial", 1], ["lionsmane", 2]], "pot_mane");
fbrew("brew_star", 90, 220, [["large_vial", 1], ["starcap", 1], ["lionsmane", 1]], "pot_star");
recipe("cook_soup", { skill: "cooking", station: "fire", in: [["buttoncap", 2], ["wheat", 1]], out: ["mushroom_soup", 1], lvl: 5, xp: 20, ms: 2000 });
recipe("cook_truffle", { skill: "cooking", station: "fire", in: [["truffle", 1], ["beef", 1]], out: ["truffle_dinner", 1], lvl: 65, xp: 260, ms: 2400 });
recipe("cook_starfeast", { skill: "cooking", station: "fire", in: [["starcap", 1], ["starfruit", 1]], out: ["starcap_feast", 1], lvl: 90, xp: 400, ms: 2400 });
/* the Toadstool's sporecap becomes a spawn too, now and then: a first bed can be planted without ever finding a cluster */
MOBS.toadstool?.drops.push(["spawn_sporecap", 1, 0.08]);   /* MOBS[].drops, not LOOT: LOOT was folded into drops long before this line */


const _preBoardwalk = new Set(Object.keys(ITEMS));
/* ============================================================ THE BOARDWALK (2026-09-27, the massive update, 5 of 8)
   EASTSCAPE-MAPS.md's map B, built on Rafael Matos's "ERW - Sea Adventures": a drowned seaside market west of the Carnival - a beach with
   palms, a pier off it to the market's bank, the stalls on a stone plaza, and a pier network out over the water with boats tied up.
   Fishing 60-84 (the hole between the Mire's 60s and the Deep Wild), Cooking to 88, and combat 66-80. The map is in eastscape-closed.js
   (`boardwalk`); everything a player can own or fight is here. The monsters are the pack's own: its pirate with a crab's claw for a
   hand (the Clawhand, and Captain Claw at half again the size), its deckhand, the tentacle that comes up beside the pirate (the Kraken
   Arm, which never leaves its patch of water), and Grass Land's bird for the Gull. Salty Meg is the pack's dock-side NPC. */
Object.assign(ITEMS, {
  mackerel: { name: "Raw mackerel", icon: "\u{1F41F}", raw: true, ex: "Blue-backed and quick. Off the inlet by the beach." },
  cmackerel: { name: "Cooked mackerel", icon: "\u{1F41F}", heal: 31, ex: "Oily, salty, gone in three bites." },   /* (2026-09-27) 27 -> 31, beside the goldfish (62, 33) */
  bluefin: { name: "Raw bluefin", icon: "\u{1F41F}", raw: true, ex: "Off the end of the long pier. It fought." },
  cbluefin: { name: "Cooked bluefin", icon: "\u{1F41F}", heal: 36, ex: "Dark red in the middle, the way the deckhands like it." },   /* 33 -> 36, past the koi (68, 34) and the blindfish (70, 35) */
  swordfish: { name: "Raw swordfish", icon: "\u{1F41F}", raw: true, ex: "From the deep water past the boats. Mind the nose." },
  cswordfish: { name: "Cooked swordfish", icon: "\u{1F41F}", heal: 41, ex: "A steak of it, seared at the Chip Shop." },
  clawpin: { name: "Claw pin", icon: "\u{1F980}", ex: "A pin off a Clawhand's coat. The captain hands them out and takes them back." }
});
Object.assign(VALUE, { mackerel: 24, cmackerel: 48, bluefin: 32, cbluefin: 64, swordfish: 44, cswordfish: 88, clawpin: 60 });
recipe("cook_mackerel", { skill: "cooking", station: "fire", in: [["mackerel", 1]], out: ["cmackerel", 1], lvl: 62, xp: 240, burnStop: 86 });
recipe("cook_bluefin", { skill: "cooking", station: "fire", in: [["bluefin", 1]], out: ["cbluefin", 1], lvl: 74, xp: 290, burnStop: 96 });
recipe("cook_swordfish", { skill: "cooking", station: "fire", in: [["swordfish", 1]], out: ["cswordfish", 1], lvl: 86, xp: 360, burnStop: 99 });
/* smoked, like the Depths' fish: a meal with a buff, charcoal each, a tenth chance to fail like every smoke */
for (const [raw, lvl, coal, heal, sell, fx, blurb] of [["mackerel", 66, 2, 33, 110, { speed: 0.05, bite: 0.04 }, "Quick hands, quick bites."], ["bluefin", 78, 3, 38, 150, { tix: 0.06, rare: 0.06 }, "The good catches follow it."], ["swordfish", 88, 3, 43, 190, { tough: 0.12, bite: 0.06 }, "Hard to hurt, and the fish come up to see."]]) {
  const key = `s${raw}`; ITEMS[key] = { name: `Smoked ${raw}`, icon: "\u{1F41F}", heal, meal: { mins: 20, fx }, ex: `Smoked slow over charcoal. Eat it for twenty minutes of it: ${blurb}` };
  VALUE[key] = sell; recipe(`smoke_${raw}`, { skill: "cooking", station: "fire", in: [[raw, 1], ["charcoal", coal]], out: [key, 1], lvl, xp: Math.round(lvl * 4), ms: 2400, fail: SMITH_FAIL });
}
ZDROP.fish.mackerel = 0.0012; ZDROP.fish.bluefin = 0.0015; ZDROP.fish.swordfish = 0.0018;
/* the monsters, with the Depths' shape (dmob is declared below this block, so the same helper is written out here) */
const bmob = (t, def, want, drops, rare = []) => {
  MOBS[t] = { ...def, drops, rare }; BOUNTY[t] = want;
  const other = drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  if (gap >= 2 && !def.boss) MOBS[t].drops.unshift(["tickets", [Math.max(1, Math.round(gap * 0.6)), Math.round(gap * 1.4)]]);
};
bmob("gull", { name: "Gull", size: "s", lvl: 66, hp: 190, att: 58, def: 42, max: 12, speed: 2000, box: [18, 16], aggro: 3, range: 3, sky: true, guard: { melee: 0 },
  ex: "It wants your chips. It will settle for your eye. Hangs over the water where a sword cannot follow: a bow, or a wand." }, 300,
  [["feather", [4, 9]], ["mackerel", 1, 0.2]], [["lantern", 0.02]]);
bmob("deckhand", { name: "Deckhand", size: "m", lvl: 69, hp: 220, att: 66, def: 50, max: 15, speed: 2100, box: [20, 26], aggro: 3,
  ex: "Paid in bluefin and rum, and she has had both. Quick with the knife between the stalls." }, 330,
  [["bluefin", 1, 0.15], ["cmackerel", 1, 0.12]], [["sharps_gloves", 0.02]]);
bmob("clawhand", { name: "Clawhand", size: "l", lvl: 74, hp: 270, att: 72, def: 58, max: 18, speed: 2400, box: [30, 26], aggro: 3, guard: { archery: 0.35 },
  ex: "A pirate with a crab's claw where a hand should be. Arrows skate off the shell; it opens for a blade or a spell." }, 390,
  [["clawpin", 1, 0.3], ["swordfish", 1, 0.1], ["sapphire", 1, 0.04]], [["spiderboots", 0.02]]);
bmob("krakenarm", { name: "Kraken Arm", size: "m", lvl: 78, hp: 320, att: 78, def: 60, max: 20, speed: 2600, box: [14, 30], aggro: 2, range: 2, sky: true, guard: { melee: 0.1 }, weak: "storm", resist: "frost",
  ex: "Only the arm. Nobody has seen the rest, and nobody is fishing there to find out. Reaches two tiles from its water; mostly beyond a sword." }, 430,
  [["swordfish", 1, 0.2], ["bluefin", 1, 0.2], ["opal", 1, 0.03]], [["angels_ring", 0.02]]);
bmob("captainclaw", { name: "Captain Claw", size: "xl", lvl: 80, hp: 4000, att: 92, def: 70, max: 28, speed: 2600, box: [44, 38], aggro: 3, boss: true, open: true, guard: { archery: 0.35 }, weak: "storm",
  ex: "The claw is bigger than his other arm and he is prouder of it. Anyone who hurts him shares the kill." }, 1000,
  [["tickets", [400, 800]], ["swordfish", [2, 4]], ["clawpin", [3, 6]], ["opal", 1, 0.2], ["singularity_core", 1, 0.02]], [["bookies_amulet", 0.05], ["gamblers_ring", 0.05], ["egg_velvet", 0.05]]);
/* (2026-09-27, the owner: "captain claw needs to have a chance at unique gear drops (gloves). make a new one just for him with art") */
ITEMS.clawgrip = { name: "Captain Claw's grip", short: "Gloves", icon: "\u{1F980}", slot: "gloves", def: 8, acc: 4, str: 4, req: { skill: "melee", lvl: 75 }, fx: { speed: 0.03, tough: 0.03 },
  ex: "The captain's own gauntlets, shell and all. Nova gloves' defence, a little more bite, a little quicker, a little harder to hurt. Only Captain Claw drops them." };
VALUE.clawgrip = 6000;
MOBS.captainclaw.drops.push(["clawgrip", 1, 0.04]);   /* one kill in twenty-five. In DROPS, not RARE: a monster's own rares all roll at the flat RARE_RATE (raresOf) whatever chance is written beside them, which would have made this one in a hundred */
/* THE CAPTAIN'S CHEST: what everyone who put him down finds when they open it, once per kill each */
export const CLAW_CHEST = { tickets: [350, 800], items: [["opal", [1, 2], 0.6], ["sapphire", 1, 0.4], ["clawpin", [2, 4]], ["cswordfish", [2, 3]], ["clawgrip", 1, 0.02]] };
Object.assign(VERB, { clawchest: "Open" });
EXAMINE.clawchest = ["Half out of the sand, iron-banded. Something heavy has been sitting on it for a long time."];
BOSSES.add("captainclaw");
for (const t of ["gull", "deckhand", "clawhand", "krakenarm", "captainclaw"]) EXAMINE[t] = [MOBS[t].ex];   /* each line already says what the guard does */
FUNG_WILD.boardwalk = ["oyster", "bluemould", "oyster"];
BANDS.boardwalk = [66, 78];
DEATH.boardwalk = { share: 0.1, cap: 4000 };
/* ---- Salty Meg's three */
Object.assign(QUESTS, {
  bwmackerel: {
    name: "Mackerel Sky", giver: "Salty Meg", where: "The Boardwalk", icon: "\u{1F41F}",
    goal: { type: "bring", items: ["mackerel"], n: 10, what: "raw mackerel" },
    brief: "Salty Meg wants ten raw mackerel, off the Market's piers or Cabin Coast's.",
    talk: { offer: ["The gulls have had every mackerel off my counter this week.", "Ten off the piers, past the ship. Fishing 60. Raw: I do the cooking here."], accept: "Ten mackerel.", decline: "Then buy your chips elsewhere.",
      accepted: "Off the piers, past the ship. Rod in hand.", progress: "Ten mackerel. You've {have}.", ready: "Look at the shine on those.", hand: "Ten.",
      done: "That's a counter full. Here, and mind the deckhands on your way back." },
    reward: { coins: 4000, xp: { fishing: 4000 }, text: "4,000 tickets, 4,000 Fishing xp" }
  },
  bwdeckhands: {
    name: "Knives on the Plaza", giver: "Salty Meg", where: "The Boardwalk", icon: "\u{1F5E1}️", requires: ["bwmackerel"],
    goal: { type: "kill", mob: "deckhand", n: 10, what: "deckhands" },
    brief: "The captain's deckhands help themselves off the stalls. Salty Meg would like ten fewer of them.",
    talk: { offer: ["They take a bluefin and leave a knife in the counter. Every day.", "Ten of the deckhands, off the plaza. They're quick. Bring food."], accept: "Ten deckhands.", decline: "Then pay for your fish like they don't.",
      accepted: "The plaza, between the stalls. You'll hear them laughing.", progress: "That's {have} of ten.", ready: "Quiet up there. Good.", hand: "Ten.",
      done: "The counter's mine again. Now about the one who sends them." },
    reward: { coins: 7000, xp: { melee: 7000, hp: 2500 }, text: "7,000 tickets, 7,000 Melee xp, 2,500 Hitpoints xp" }
  },
  bwcaptain: {
    name: "Captain Claw", giver: "Salty Meg", where: "The Boardwalk", icon: "\u{1F980}", requires: ["bwdeckhands"],
    goal: { type: "kill", mob: "captainclaw", n: 1, what: "Captain Claw" },
    brief: "Captain Claw holds Skull Isle, the last island the rowboats reach. Salty Meg would like him gone.",
    talk: { offer: ["Skull Isle, the last island out. Row island to island from the end of the long pier. He doesn't come in; he sends them.", "That claw takes a man's arm off. Nobody does him alone. Bring people; everyone who hurts him shares him."], accept: "Together, then.", decline: "Not today.",
      accepted: "Every island has a rowboat to the next. The last one is his. Arrows won't get through the claw.", progress: "He's still down there.", ready: "I heard that from here. He's down?", hand: "He's down.",
      done: "Thirty years he's taxed this pier. Here: it's the fish money, and it's yours." },
    reward: { coins: 20000, xp: { melee: 10000, hp: 4000 }, text: "20,000 tickets, 10,000 Melee xp, 4,000 Hitpoints xp" }
  }
});
for (const [k, tier] of [["bwmackerel", "medium"], ["bwdeckhands", "hard"], ["bwcaptain", "hard"]]) { QUESTS[k].stages = [{ ...QUESTS[k].goal }]; QUESTS[k].tier = tier; }
/* (2026-09-27) the Boardwalk's five islands after the Market: a rowboat chain (eastscape-closed.js), levels rising along it */
export const BW_ISLES = ["bw_cabin", "bw_light", "bw_wreck", "bw_pier", "bw_skull"];
Object.assign(BANDS, { bw_cabin: [66, 72], bw_light: [70, 76], bw_wreck: [72, 80], bw_pier: [72, 80], bw_skull: [74, 82] });
for (const k of BW_ISLES) DEATH[k] = { share: 0.1, cap: 4000 };
Object.assign(VERB, { rowboat: "Row" });
EXAMINE.rowboat = ["A rowboat, bailed out and tied up. It goes to the next island, or back to the last."];
if (!HOLD.boardwalk) { OPEN.add("boardwalk"); SCENES.carnival.exits.w = "boardwalk"; PET_SCENES.add("boardwalk"); for (const k of BW_ISLES) { OPEN.add(k); PET_SCENES.add(k); } EGGS.egg_cindered.from.push("boardwalk"); EGGS.egg_velvet.from.push("boardwalk"); }
const _preFoundry = new Set(Object.keys(ITEMS));
/* ============================================================ THE FOUNDRY (2026-09-27, the massive update, 6 of 8)
   EASTSCAPE-MAPS.md's map C, built on Rafael Matos's "ERW - Volcano": the works under the Thunderhead, where the mountain's ore is
   smelted. A lava river down the west side, a ring of lava round an arena with two demon statues at its gate, the blast furnace on the
   workfloor along the bottom. Mining 70-90 (the Depths' veins, out in the open), Smithing's best furnace, combat 76-88. The map is in
   eastscape-closed.js (`foundry`). The monsters are the pack's own: its rocky dude (the Slag Golem), its imp (the Furnace Imp), its
   elemental (the Cinder Elemental) and its crusher, a skull on a post that rises out of the lava (Old Bessemer). Basalt, the foreman,
   is the golem at rest, greyed. */
Object.assign(ITEMS, {
  slag: { name: "Slag", icon: "🪨", ex: "What a Slag Golem is made of, and what is left when it is not. The blast furnace takes it: slag in a double batch of eclipse or nova makes a third bar." },
  emberglass: { name: "Emberglass", icon: "🔶", ex: "Glass a Cinder Elemental leaves where it stood. Still warm a week later. Brewed, it makes an Emberglass tonic." },
  tally: { name: "Foreman's tally", icon: "🏷️", ex: "A stamped tin tag off a Furnace Imp. Basalt pays 150 tickets a tag: talk to him with them in your bag." }
});
Object.assign(VALUE, { slag: 30, emberglass: 120, tally: 70 });
/* THE BLAST FURNACE: every furnace recipe, half as much xp again, the same bars. It is a `nexus` station like the Nexus altar so the
   craft loop finds it, but its `boost` keeps the output at ONE: doubling bars would halve the ore behind every top-tier piece of gear. */
STATIONS.blast = { skill: "smithing", verb: "smelt", name: "the blast furnace", auto: false, kind: "smelt", nexus: true, boost: { mult: 1, xp: 1.5 } };
Object.assign(VERB, { blast: "Smelt-at" });
EXAMINE.blast = ["The mountain's own furnace: a bellows the size of a house, run off the lava. Every bar the small furnaces make, for half as much xp again."];
/* the monsters, with the Boardwalk's shape (dmob is declared below this block) */
const fmob = (t, def, want, drops, rare = []) => {
  MOBS[t] = { ...def, drops, rare }; BOUNTY[t] = want;
  const other = drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  if (gap >= 2 && !def.boss) MOBS[t].drops.unshift(["tickets", [Math.max(1, Math.round(gap * 0.6)), Math.round(gap * 1.4)]]);
};
fmob("slaggolem", { name: "Slag Golem", size: "m", lvl: 76, hp: 300, att: 74, def: 66, max: 18, speed: 2500, box: [32, 18], aggro: 2, guard: { archery: 0.4 }, weak: "frost", resist: "fire",
  ex: "Slag that got up. Arrows chip it; a blade or a spell breaks it. Frost cracks it right open." }, 400,
  [["slag", [1, 3]], ["eclipse_ore", 1, 0.15], ["sapphire", 1, 0.01]]   /* (2026-09-27) sapphire 4% -> 1%: the Depths is the jewel map */, [["sharps_gloves", 0.02]]);
fmob("furnaceimp", { name: "Furnace Imp", size: "m", lvl: 78, hp: 280, att: 82, def: 56, max: 21, speed: 2000, box: [34, 24], aggro: 3, weak: "frost", resist: "fire",
  ex: "It stokes the furnace and steals from the floor. Quick, and it bites. Frost puts it out." }, 430,
  [["tally", 1, 0.3], ["charcoal", [2, 5]], ["nova_ore", 1, 0.08]], [["spiderboots", 0.02]]);
fmob("cinderelemental", { name: "Cinder Elemental", size: "l", lvl: 84, hp: 380, att: 88, def: 64, max: 24, speed: 2600, box: [38, 28], aggro: 3, guard: { melee: 0.35 }, weak: "frost", resist: "fire",
  ex: "A fire with a shape and a grudge. A sword goes through it; arrows and frost are what it minds." }, 500,
  [["emberglass", 1, 0.25], ["nova_ore", 1, 0.12], ["singularity_ore", 1, 0.02], ["opal", 1, 0.01]]   /* opal 3% -> 1% */, [["angels_ring", 0.02]]);
fmob("bessemer", { name: "Old Bessemer", size: "xl", lvl: 88, hp: 5000, att: 100, def: 76, max: 32, speed: 2600, box: [20, 46], aggro: 3, range: 2, boss: true, open: true, guard: { archery: 0.35 }, weak: "frost",
  ex: "The foundry's first foreman, or what the lava left of him: a skull on a post that comes up out of the ring. Reaches two tiles. Anyone who hurts him shares the kill." }, 1200,
  [["tickets", [500, 1000]], ["nova_ore", [2, 4]], ["singularity_ore", [1, 2]], ["emberglass", [2, 4]], ["singularity_core", 1, 0.03]], [["bookies_amulet", 0.05], ["gamblers_ring", 0.05], ["egg_cindered", 0.05]]);
MOBS.bessemer.drops.push(["bessemergloves", 1, 0.01]);   /* the chase: see ITEMS.bessemergloves */
BOSSES.add("bessemer");
/* (2026-09-27, the owner chose "Smithing uses" for the Foundry's three drops and "Smithing piece" for Old Bessemer's chase)
   SLAG: a double batch at the BLAST FURNACE ONLY, with slag in it, gives three bars for two batches' ore and flux. Eclipse and nova only:
   singularity stays at one bar a batch, because it is the ore behind the best gear in the game. Four slag an extra eclipse bar, six an
   extra nova, which is a golem kill or two for a bar worth 381 or 988 - the reason to fight on the Foundry floor as well as mine it. */
recipe("blast_eclipse", { skill: "smithing", station: "blast", ms: 4800, in: [["eclipse_ore", 8], ["voidglass", 4], ["charcoal", 16], ["slag", 4]], out: ["eclipse_bar", 3], lvl: 70, xp: 315, priceDiv: 2, fail: 0.1 });
recipe("blast_nova", { skill: "smithing", station: "blast", ms: 4800, in: [["nova_ore", 8], ["eclipse_bar", 2], ["charcoal", 20], ["slag", 6]], out: ["nova_bar", 3], lvl: 80, xp: 360, priceDiv: 2 });
/* EMBERGLASS: an Alchemy 82 tonic between the Fang (78) and the Salve (84) - harder to hurt, and food goes further */
fdrink("pot_ember", "Emberglass tonic", 25, { tough: 0.12, heal: 0.2 }, "It glows in the glass and it glows going down. 25 minutes outside: you take less, and every fish you eat heals a fifth more.");
VALUE.pot_ember = 300;
fbrew("brew_ember", 82, 170, [["large_vial", 1], ["emberglass", 2], ["charcoal", 2]], "pot_ember");
/* THE TALLY: Basalt buys them (the npc's `buys`, paid when you talk to him) */
/* OLD BESSEMER'S GAUNTLETS: the chase. Singularity gloves' defence and a little bite, worn at Smithing 85 rather than Melee, and the two
   things a smith wants: 15% of the bars you smelt come out double (fx.smelt, read where the server hands a bar over), and every reforge
   is 10 points likelier to land (fx.forge, added to the anvil's odds beside a Temper). One kill in a hundred, like the Deepwarden's ring;
   `chase: "ember"` gives the icon a furnace glow instead of the crystal's pink. */
ITEMS.bessemergloves = { name: "Bessemer's Gauntlets", short: "Gloves", icon: "\u{1F9E4}", slot: "gloves", def: 10, acc: 4, str: 4, chase: "ember", fx: { smelt: 0.15, forge: 0.10 }, req: { skill: "smithing", lvl: 85 },
  ex: "Worn: 15% of the bars you smelt come out double; every reforge is 10% likelier to land. Old Bessemer's own, riveted iron gone black and orange at the knuckles. The lava never got them off him. Only Old Bessemer drops them, one kill in a hundred." };
VALUE.bessemergloves = 9000;
for (const t of ["slaggolem", "furnaceimp", "cinderelemental", "bessemer"]) EXAMINE[t] = [MOBS[t].ex];
FUNG_WILD.foundry = ["bleedtooth", "inkcap", "bleedtooth"];
BANDS.foundry = [76, 86];
DEATH.foundry = { share: 0.1, cap: 5000 };
/* ---- Basalt's three */
Object.assign(QUESTS, {
  fdslag: {
    name: "Slag Run", giver: "Basalt", where: "The Foundry", icon: "🪨",
    goal: { type: "bring", items: ["slag"], n: 12, what: "slag" },
    brief: "Basalt wants twelve slag off the golems, for the furnace.",
    talk: { offer: ["The furnace eats slag and the golems are made of it. That's the whole economy down here.", "Twelve slag. Break the golems on the floor; they drop it. A sword or a wand: arrows chip off."], accept: "Twelve slag.", decline: "Then stand clear of the floor.",
      accepted: "The workfloor, along the bottom. Mind the vents.", progress: "Twelve slag. You've {have}.", ready: "That's a sack. Good.", hand: "Twelve.",
      done: "Into the furnace it goes. Here, and the blast furnace is yours to use." },
    reward: { coins: 5000, xp: { smithing: 5000 }, text: "5,000 tickets, 5,000 Smithing xp" }
  },
  fdimps: {
    name: "Tally Up", giver: "Basalt", where: "The Foundry", icon: "🏷️", requires: ["fdslag"],
    goal: { type: "kill", mob: "furnaceimp", n: 12, what: "furnace imps" },
    brief: "The imps steal off the floor faster than it is smelted. Basalt would like twelve fewer of them.",
    talk: { offer: ["Every imp on this floor wears a tally I stamped, and not one of them has done a shift.", "Twelve of them, off the east side and the floor. They bite. Bring food."], accept: "Twelve imps.", decline: "Then they'll have your bag too.",
      accepted: "East, past the pillars, and the floor. You'll hear them.", progress: "That's {have} of twelve.", ready: "Quieter already.", hand: "Twelve.",
      done: "Twelve tallies I don't have to count. Now the one in the ring." },
    reward: { coins: 8000, xp: { melee: 8000, hp: 3000 }, text: "8,000 tickets, 8,000 Melee xp, 3,000 Hitpoints xp" }
  },
  fdbessemer: {
    name: "Old Bessemer", giver: "Basalt", where: "The Foundry", icon: "💀", requires: ["fdimps"],
    goal: { type: "kill", mob: "bessemer", n: 1, what: "Old Bessemer" },
    brief: "Old Bessemer comes up out of the lava at the bottom of the ring. Basalt would like him put down.",
    talk: { offer: ["He ran this floor before me. The lava took him and gave back the skull, and the skull kept giving orders.", "Bottom of the ring, between the statues and down. He reaches two tiles and arrows won't get through the bone. Bring people; everyone who hurts him shares him."], accept: "Together, then.", decline: "Not today.",
      accepted: "Through the statues, down the ring. Frost, if you have it.", progress: "He's still up.", ready: "The floor went quiet. He's down?", hand: "He's down.",
      done: "Forty years of him. Here: the floor's takings, and they're yours." },
    reward: { coins: 25000, xp: { melee: 12000, hp: 5000 }, text: "25,000 tickets, 12,000 Melee xp, 5,000 Hitpoints xp" }
  }
});
for (const [k, tier] of [["fdslag", "medium"], ["fdimps", "hard"], ["fdbessemer", "hard"]]) { QUESTS[k].stages = [{ ...QUESTS[k].goal }]; QUESTS[k].tier = tier; }
if (!HOLD.foundry) { OPEN.add("foundry"); SCENES.thunderhead.exits.s = "foundry"; PET_SCENES.add("foundry"); EGGS.egg_cindered.from.push("foundry"); }
const _preOrchard = new Set(Object.keys(ITEMS));
/* ============================================================ THE ORCHARD WALL (2026-09-27, the massive update, 7 of 8)
   EASTSCAPE-MAPS.md's map A, built on Rafael Matos's "ERW - Grass Land 2.0": the country south of the Boneyard - a market wagon under
   the big trees, a brook with a stone bridge over it, a pond, and across the water an orc camp behind a fence, its wood below it.
   Woodcutting 52-66 (pines and walnuts), Pomona's stove, combat 58-72. The map is in eastscape-closed.js (`orchard`). The monsters
   are the pack's own: its mosquito at four times its size (the Wasp), its orc mage (the Orchard Orc, and the Gardener at half again
   the size in the second colour), its orc warrior (the Orchard Keeper, and the Hedge Thing gone green). Pomona is the pack's vendor. */
Object.assign(ITEMS, {
  walnutlogs: { name: "Walnut logs", icon: "🪵", ex: "Dark, close-grained and heavy. The orcs fence with it." },
  honeycomb: { name: "Honeycomb", icon: "🍯", heal: 12, ex: "Off a wasp, or out of a hive if you are quick. Eat it for a little." },
  orcband: { name: "Orc arm-band", icon: "⭕", ex: "Beaten copper, a tusk mark on it. Pomona pays for them by the handful." }
});
Object.assign(VALUE, { walnutlogs: 70, honeycomb: 20, orcband: 50 });
recipe("burn_walnutlogs", { skill: "smithing", station: "furnace", in: [["walnutlogs", 1]], out: ["charcoal", 6], lvl: 1, xp: 30, ms: 1800, fail: 0.03 });
/* the monsters, with the Boardwalk's shape (dmob is declared below this block) */
const omob = (t, def, want, drops, rare = []) => {
  MOBS[t] = { ...def, drops, rare }; BOUNTY[t] = want;
  const other = drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  if (gap >= 2 && !def.boss) MOBS[t].drops.unshift(["tickets", [Math.max(1, Math.round(gap * 0.6)), Math.round(gap * 1.4)]]);
};
omob("wasp", { name: "Wasp", size: "s", lvl: 58, hp: 150, att: 52, def: 36, max: 10, speed: 1800, box: [16, 10], aggro: 3, range: 2, sky: true, guard: { melee: 0.3 }, weak: "frost",
  ex: "The size of a hand and angrier than that. Hangs over the water and the hives; a blade mostly fans it. Frost drops it." }, 240,
  [["honeycomb", [1, 2]]], [["egg_sparking", 0.01]]);
omob("orchardorc", { name: "Orchard Orc", size: "m", lvl: 62, hp: 200, att: 60, def: 44, max: 14, speed: 2100, box: [28, 26], aggro: 3, weak: "sun", resist: "void",
  ex: "A camp orc with a staff and opinions about your walnuts. Sun magic goes through it; void it shrugs off." }, 300,
  [["orcband", 1, 0.3], ["walnutlogs", 1, 0.2], ["sapphire", 1, 0.03]], [["sharps_gloves", 0.02]]);
omob("orchardkeeper", { name: "Orchard Keeper", size: "l", lvl: 66, hp: 240, att: 66, def: 54, max: 16, speed: 2300, box: [34, 28], aggro: 3, guard: { archery: 0.3 },
  ex: "The camp's warrior, and the trees are his. The shield turns arrows; get in close, or cast." }, 340,
  [["pinelogs", [1, 2]], ["walnutlogs", 1, 0.15], ["orcband", 1, 0.2], ["ruby", 1, 0.03]], [["spiderboots", 0.02]]);
omob("hedgething", { name: "Hedge Thing", size: "l", lvl: 70, hp: 280, att: 72, def: 56, max: 18, speed: 2400, box: [36, 30], aggro: 3, guard: { melee: 0.3 }, weak: "fire",
  ex: "An orc that stood in the hedge too long, or a hedge that learned to hold a spear. A blade goes into the leaves; fire is what it minds." }, 380,
  [["walnutlogs", [1, 2]], ["honeycomb", 1, 0.3], ["opal", 1, 0.03]], [["angels_ring", 0.02]]);
omob("gardener", { name: "The Gardener", size: "xl", lvl: 72, hp: 3500, att: 84, def: 62, max: 24, speed: 2500, box: [40, 36], aggro: 3, boss: true, open: true, weak: "sun",
  ex: "The camp's shaman. He grew the hedge things, he grows the wasps, and he would like the orchard back. Anyone who hurts him shares the kill." }, 900,
  [["tickets", [300, 600]], ["walnutlogs", [3, 6]], ["honeycomb", [2, 4]], ["orcband", [2, 4]], ["ruby", 1, 0.2]], [["bookies_amulet", 0.05], ["angels_ring", 0.03], ["egg_sparking", 0.05]]);
BOSSES.add("gardener");
for (const t of ["wasp", "orchardorc", "orchardkeeper", "hedgething", "gardener"]) EXAMINE[t] = [MOBS[t].ex];
FUNG_WILD.orchard = ["buttoncap", "puffball", "buttoncap"];
BANDS.orchard = [58, 70];
DEATH.orchard = { share: 0.1, cap: 4500 };
/* ---- Pomona's three */
Object.assign(QUESTS, {
  orwasps: {
    name: "Wasps in the Fruit", giver: "Pomona", where: "The Orchard Wall", icon: "🐝",
    goal: { type: "kill", mob: "wasp", n: 10, what: "wasps" },
    brief: "The wasps are in the fruit and over the pond. Pomona would like ten fewer.",
    talk: { offer: ["Every apple on the wagon has a wasp in it. Every one.", "Ten of them, over the pond and round the hives. They hang in the air; a bow, or a wand. Frost if you have it."], accept: "Ten wasps.", decline: "Then don't eat the apples.",
      accepted: "The pond, west, and the hives by the wagon.", progress: "That's {have} of ten.", ready: "I can hear myself think.", hand: "Ten.",
      done: "Here. And take a comb; they've made plenty." },
    reward: { coins: 3000, xp: { archery: 3000 }, text: "3,000 tickets, 3,000 Archery xp" }
  },
  orbands: {
    name: "Bands Off", giver: "Pomona", where: "The Orchard Wall", icon: "⭕", requires: ["orwasps"],
    goal: { type: "bring", items: ["orcband"], n: 6, what: "orc arm-bands" },
    brief: "The camp across the brook takes her walnuts. Pomona wants six of their arm-bands as proof of fewer orcs.",
    talk: { offer: ["They come over the bridge at night and go back with my walnuts. Every night.", "Six arm-bands. The orcs and the keepers wear them; they come off when the orc does."], accept: "Six bands.", decline: "Then buy your walnuts somewhere they don't get stolen.",
      accepted: "Over the bridge, through the gate with the tusks. Mind the keepers' shields.", progress: "Six bands. You've {have}.", ready: "That's a handful.", hand: "Six.",
      done: "Fewer of them, then. Here, and thank you. Now the one who sends them." },
    reward: { coins: 6000, xp: { melee: 5000, hp: 2000 }, text: "6,000 tickets, 5,000 Melee xp, 2,000 Hitpoints xp" }
  },
  orgardener: {
    name: "The Gardener", giver: "Pomona", where: "The Orchard Wall", icon: "🌿", requires: ["orbands"],
    goal: { type: "kill", mob: "gardener", n: 1, what: "the Gardener" },
    brief: "The camp's shaman, the Gardener, keeps to the wood below the camp. Pomona would like him gone.",
    talk: { offer: ["Their shaman. He grows the things in the hedge and he grows the wasps, and he wants the orchard.", "Below the camp, in the wood past the totems. Bring people; everyone who hurts him shares him. Sun magic, if you have it."], accept: "Together, then.", decline: "Not today.",
      accepted: "Through the gate and down. Past the totems.", progress: "He's still down there.", ready: "The wood's gone quiet. He's down?", hand: "He's down.",
      done: "Then the orchard's mine again. Here: it's the season's takings, and they're yours." },
    reward: { coins: 15000, xp: { melee: 8000, hp: 3500 }, text: "15,000 tickets, 8,000 Melee xp, 3,500 Hitpoints xp" }
  }
});
for (const [k, tier] of [["orwasps", "medium"], ["orbands", "hard"], ["orgardener", "hard"]]) { QUESTS[k].stages = [{ ...QUESTS[k].goal }]; QUESTS[k].tier = tier; }
if (!HOLD.orchard) { OPEN.add("orchard"); SCENES.boneyard.exits.s = "orchard"; PET_SCENES.add("orchard"); EGGS.egg_sparking.from.push("orchard"); }
/* (2026-09-27) HELD MAPS' THINGS: every item, quest and monster a held map added is marked held, so the wiki leaves it out (a save
   that somehow carries one still loads). The blocks run Boardwalk, Foundry, Orchard, then the Depths, so each is the items between
   its own marker and the next one. */
for (const [held, from, to, quests, mobs] of [
  [HOLD.boardwalk, _preBoardwalk, _preFoundry, ["bwmackerel", "bwdeckhands", "bwcaptain"], ["gull", "deckhand", "clawhand", "krakenarm", "captainclaw"]],
  [HOLD.foundry, _preFoundry, _preOrchard, ["fdslag", "fdimps", "fdbessemer"], ["slaggolem", "furnaceimp", "cinderelemental", "bessemer"]],
  [HOLD.orchard, _preOrchard, null, ["orwasps", "orbands", "orgardener"], ["wasp", "orchardorc", "orchardkeeper", "hedgething", "gardener"]]]) {
  if (!held) continue;
  for (const k of Object.keys(ITEMS)) if (!from.has(k) && (!to || to.has(k))) ITEMS[k].held = true;
  for (const q of quests) if (QUESTS[q]) QUESTS[q].held = true;
  for (const t of mobs) if (MOBS[t]) MOBS[t].held = true;
}
const _preDepths = new Set(Object.keys(ITEMS));
/* ============================================================ THE DEPTHS OF THE MOUNTAIN (2026-09-27, the massive update, 3 of 8)
   The Scrap Line of EASTSCAPE-MAPS.md, re-themed by the owner on Rafael Matos's "Depths of the Mountain" pack: platforms of
   mossy rock over a black abyss between the Thunderhead and the Trailer Park, combat 73-84, closing the 72-80 hole. The map is
   in eastscape-closed.js (`depths`); everything a player can own or fight is here.

   THE POWER CREEP (the owner: "users need to feel the power creep from these mobs, some need to only be accessible via archery,
   some need to have massive protection against certain fighting types and elements (ie: takes 90% less damage from melee, only
   vulnerable to void). they need to hit hard and be accurate and tanky"). Two new monster fields, read by the server's hit:
   - `guard`: { melee, archery, magic } multipliers on what lands. 0.1 is "90% less".
   - `onlyEl`: magic of any OTHER element lands at a tenth. With `guard` on melee and archery too, only that element hurts it.
   and one for their side of the fight:
   - `range`: a monster that attacks from up to this many tiles, so a wisp over the abyss can shoot back at the archer.
   Everything here hits 40-60% harder than the Vault at the same level, with 1.7-3x the hitpoints. */
MAGIC.guardMul = 0.1;
/** what lands on a monster type from this style (and element, for magic): 1 is everything */
export const guardMul = (t, style, el) => { const m = MOBS[t]; let k = m?.guard?.[style] ?? 1; if (style === "magic" && m?.onlyEl && el !== m.onlyEl) k *= MAGIC.guardMul; return k; };
/** the same in words, for examine, the fight message and the wiki */
export const guardText = (t) => {
  const m = MOBS[t]; if (!m?.guard && !m?.onlyEl) return "";
  const S = { melee: "Melee", archery: "Archery", magic: "Magic" }, out = [];
  for (const [s, k] of Object.entries(m.guard || {})) if (k < 1) out.push(k <= 0 ? `nothing from ${S[s]}` : `${Math.round((1 - k) * 100)}% less from ${S[s]}`);
  if (m.onlyEl) out.push(`only ${ELEMENTS[m.onlyEl]?.name || m.onlyEl} magic gets through`);
  return `Takes ${out.join("; ")}.`;
};
/* (2026-09-27, the owner: "all mobs should plainly show 'Resists: Magic X%, Melee X%', in their right click card and on the wiki") EVERY
   monster's three styles as a percentage it shrugs off, 0% included, so "does my bow work on this?" never needs the examine text. An
   `onlyEl` monster shrugs off magic of every OTHER element on top of its guard (MAGIC.guardMul), so that one reads "Magic 90% (Void 0%)". */
export const resistsOf = (t) => {
  const m = MOBS[t], pc = (k) => Math.max(0, Math.min(100, Math.round((1 - k) * 100)));
  return ["melee", "archery", "magic"].map((s) => {
    const k = m?.guard?.[s] ?? 1;
    if (s === "magic" && m?.onlyEl) return { style: s, pct: pc(k * MAGIC.guardMul), el: m.onlyEl, elPct: pc(k) };
    return { style: s, pct: pc(k) };
  });
};
export const resistText = (t) => resistsOf(t).map((r) => `${{ melee: "Melee", archery: "Archery", magic: "Magic" }[r.style]} ${r.pct}%${r.el ? ` (${ELEMENTS[r.el]?.name || r.el} ${r.elPct}%)` : ""}`).join(" · ");
/** a monster's weak / resist element(s) as words: either may be one element or a list (the Pumpkin King's ["fire", "sun"]) */
export const elementWords = (x) => [].concat(x || []).filter((e) => ELEMENTS[e]).map((e) => `${ELEMENTS[e].icon} ${ELEMENTS[e].name}`).join(", ");

/* ---- the things it gives */
Object.assign(ITEMS, {
  abyss_crystal: { name: "Abyss crystal", icon: "\u{1F48E}", ex: "Grown in the dark with nothing to shine for. Mined in the Depths of the Mountain; the jewellers will want it." },
  deep_sigil: { name: "Deepwarden's sigil", short: "D. sigil", icon: "\u{1F4FF}", slot: "amulet", fx: { tix: 0.07, tough: 0.04 }, req: { skill: "hp", lvl: 75 }, ex: "The Deepwarden's own. Iron, a pink crystal, and the weight of the mountain. More tickets, and you take a little less." }
});
Object.assign(VALUE, { abyss_crystal: 90, deep_sigil: 2400, deepheart: 9000 });
/* (2026-09-27, the owner: "the boss needs a unique item drop (ring or necklace since that will tie in with jewelry), with new art, chase
   item") THE MOUNTAIN'S HEART. A singularity ring's numbers six levels early, and the one effect nothing else in the game has: every jewel
   a swing could turn up in the rock turns up TWICE as often (fx.gem, read where the server rolls GEM_DROP, beside Stone Sense and the
   pets' gem nose). So the chase is a jeweller's ring, and the Depths is where it pays: a mining map with the richest gem vein in the game.
   One Deepwarden kill in a hundred, like the Pumpkin King's legendaries; `chase` gives its icon the crystal glow. */
ITEMS.deepheart = { name: "The Mountain's Heart", short: "Ring", icon: "\u{1F48D}", slot: "ring", acc: 16, str: 16, def: 16, chase: true, fx: { gem: 1, tough: 0.05 }, req: { skill: "hp", lvl: 84 },
  ex: "Worn: every jewel you could find in the rock turns up twice as often; you take 5% less damage. A raw abyss crystal the size of a thumbnail, set in the Deepwarden's own black iron. It is warm. Only the Deepwarden drops it, one kill in a hundred." };
/* (2026-09-27, the owner: "keep it mining only, no fish") the Drop's blindfish and abyss eel went with its fishing spots, before the map ever opened */
PETS.potboy = { name: "Pot Boy", art: "pet_potboy", raid: true, fx: { slots: 2, tix: 4 }, ex: "It was pretending to be a pot. It is still pretending to be a pot. It follows you anyway. The Deepwarden's, one kill in sixty." };

/* ---- the monsters. Tickets are worked out the way the BOUNTY loop does it (that loop ran long before this line) */
const dmob = (t, def, want, drops, rare = []) => {
  MOBS[t] = { ...def, drops, rare }; BOUNTY[t] = want;
  const other = drops.reduce((a, [k, n, p]) => a + (VALUE[k] ?? 0) * (Array.isArray(n) ? (n[0] + n[1]) / 2 : n) * (p ?? 1), 0), gap = Math.round(want * 0.88 - other);
  if (gap >= 2 && !def.boss) MOBS[t].drops.unshift(["tickets", [Math.max(1, Math.round(gap * 0.6)), Math.round(gap * 1.4)]]);
};
/* the pay is tools/eastscape-balance.mjs's want$/kill for each: they are twice as long to kill as the Vault's, so they pay twice as much a kill, or nobody would come. The boss pays each person who shares him. */
dmob("potboy", { name: "Pot Boy", size: "m", lvl: 73, hp: 270, att: 64, def: 60, max: 18, speed: 2500, box: [22, 26], aggro: 2, guard: { magic: 0.25 },
  ex: "It was a pot until you walked past. Spells rattle round inside it and come out the spout." }, 412,
  [["ruby", 1, 0.015], ["sapphire", 1, 0.012], ["topaz", 1, 0.01]], [["gamblers_ring", 0.02], ["bookies_amulet", 0.02]]);   /* (2026-09-27, the owner: "the drop rate of jewels needs to be significantly lower ... the 'jewelry' map, but not that much") 15% of kills turned up a gem; now about 3.7%, still the most of any monster */
dmob("dgoblin", { name: "Goblin Cutter", size: "m", lvl: 75, hp: 250, att: 76, def: 56, max: 20, speed: 1900, box: [20, 26], aggro: 4,
  ex: "Quick, mean, and it never misses twice. It never misses once, either." }, 386,
  [["eclipse_ore", 1, 0.15]], [["sharps_gloves", 0.03], ["spiderboots", 0.02]]);
dmob("dwisp", { name: "Abyss Wisp", size: "m", lvl: 76, hp: 230, att: 70, def: 52, max: 16, speed: 2600, box: [28, 30], aggro: 3, range: 3,   /* range 3: it covers the walkways it hangs beside, not the middle of every ledge */ sky: true, guard: { melee: 0, magic: 0.1 },
  ex: "It hangs over the drop where no sword can reach and spells pass straight through its crystal. Bring a bow." }, 357,
  [["abyss_crystal", 1, 0.4]], [["angels_ring", 0.02]]);
dmob("dogre", { name: "Crystal Ogre", size: "l", lvl: 78, hp: 430, att: 72, def: 66, max: 23, speed: 3000, box: [34, 40], aggro: 4, guard: { archery: 0.1 },
  ex: "Arrows shatter on the crystal grown through its hide. Get close, or cast." }, 618,
  [["abyss_crystal", [1, 2], 0.5], ["eclipse_ore", 1, 0.2]], [["angels_ring", 0.03], ["gamblers_ring", 0.03]]);
dmob("diron", { name: "Iron Ogre", size: "l", lvl: 80, hp: 470, att: 76, def: 70, max: 25, speed: 3100, box: [34, 36], aggro: 5, guard: { melee: 0.1, archery: 0.1 }, onlyEl: "void",
  ex: "Plated in iron from the brow down. Swords ring off it, arrows bounce, and only Void magic gets through." }, 631,
  [["nova_ore", 1, 0.12], ["eclipse_ore", [1, 2], 0.3]], [["bogplate", 0.03], ["grudge", 0.02]]);
dmob("deepwarden", { name: "The Deepwarden", size: "xl", lvl: 84, hp: 5200, att: 96, def: 76, max: 34, speed: 2900, box: [44, 96], aggro: 5, boss: true, open: true,
  enrage: { at: 0.35, mul: 1.4, say: "The Deepwarden plants the greatsword and roars. The whole mountain answers." }, pet: ["potboy", 1 / 60],
  ex: "The mountain's keeper. He hits like a falling ceiling and he does not tire. Bring friends." }, 1200,
  [["tickets", [500, 900]], ["nova_ore", [2, 4]], ["abyss_crystal", [3, 6]], ["opal", 1, 0.08], ["deep_sigil", 1, 0.03]]   /* opal 20% -> 8% (see the Pot Boy) */, [["bookies_amulet", 0.05], ["angels_ring", 0.05]]);
MOBS.deepwarden.drops.push(["deepheart", 1, 0.01]);   /* the chase: see ITEMS.deepheart */
BOSSES.add("deepwarden");
Object.assign(MOBS.dgoblin, { weak: "frost" }); Object.assign(MOBS.potboy, { weak: "storm" }); Object.assign(MOBS.dwisp, { weak: "sun", resist: "void" });
Object.assign(MOBS.dogre, { weak: "storm", resist: "frost" }); Object.assign(MOBS.diron, { weak: "void" }); Object.assign(MOBS.deepwarden, { weak: "sun", resist: "fire" });
for (const t of ["potboy", "dgoblin", "dwisp", "dogre", "diron", "deepwarden"]) EXAMINE[t] = [MOBS[t].ex + (guardText(t) ? ` ${guardText(t)}` : "")];
/* (2026-09-27, the owner: "mobs and boss are hitting them for zeros across the board" on the Boardwalk) THE LATE MAPS MISSED attFor.
   The pass that gives every outside monster the accuracy of its level (WHAT A MONSTER HAS TO HIT, far above) runs where it is written,
   and the Boardwalk, the Foundry, the Orchard Wall and the Depths are all written after it: their hand-set `att` sat 4-20 under the
   curve, which put every one of them on HIT_FLOOR (18% of swings) against a player in the gear their level asks for. Raise them now, the
   same way and only upward. Health and max hit are NOT put through OUTSIDE_HP/OUTSIDE_DMG: those four maps' numbers were written as
   the final ones (three times a Yard monster's health on purpose). */
for (const t of ["gull", "deckhand", "clawhand", "krakenarm", "captainclaw", "slaggolem", "furnaceimp", "cinderelemental", "bessemer",
  "wasp", "orchardorc", "orchardkeeper", "hedgething", "gardener", "potboy", "dgoblin", "dwisp", "dogre", "diron", "deepwarden", "pumpkinking"]) MOBS[t].att = Math.max(MOBS[t].att, attFor(MOBS[t].lvl));
/* (2026-09-27, the owner: "the gem tiles you added need to have a chance at dropping the ruby/topaz/etc ores we added to mining ores, just
   very slowly") an abyss crystal vein turns up any of the four gems, together about a third as often as a gem ore turns up its own */
GEM_DROP.abyss_crystal = [["ruby", 0.0015], ["sapphire", 0.0015], ["topaz", 0.0012], ["opal", 0.0008]];
/* HELD OR OPEN (see HOLD). Open, the map joins the road and the pets, eggs and wild mushrooms say so; held, only the admin
   teleport reaches it, and its quests, pet and items stay out of the wiki (the journal already hides a quest whose giver's area is shut). */
if (!HOLD.depths) {
  OPEN.add("depths"); SCENES.thunderhead.exits.n = "depths"; SCENES.trailer.exits.s = "depths";
  PET_SCENES.add("depths"); EGGS.egg_geode.from.push("depths"); EGGS.egg_gilded.from.push("depths");
  FUNG_WILD.depths = ["glowcap", "lionsmane", "glowcap"];
}

/* ---- Old Pickett's three */
Object.assign(QUESTS, {
  deepcrystal: {
    name: "Pink in the Dark", giver: "Old Pickett", where: "The Depths of the Mountain", icon: "\u{1F48E}",
    goal: { type: "bring", items: ["abyss_crystal"], n: 10, what: "abyss crystals" },
    brief: "Old Pickett wants ten abyss crystals from the veins on the east wing.",
    talk: { offer: ["Forty years a goblin down here and I've never seen the mountain glow like this.", "Ten of those pink crystals off the east wing. Mining 75. Mind the ogres; the crystal ones don't care for arrows."], accept: "Ten crystals.", decline: "Mind the drop, then.",
      accepted: "East wing, across the carpet. Pickaxe first, questions later.", progress: "Ten crystals. You've {have}.", ready: "Look at that. Like holding a sunset.", hand: "Ten of them.",
      done: "Something's growing down here, and it isn't me. Take this for your trouble." },
    reward: { coins: 6000, xp: { mining: 6000 }, text: "6,000 tickets, 6,000 Mining xp" }
  },
  deepgoblins: {
    name: "Cutters", giver: "Old Pickett", where: "The Depths of the Mountain", icon: "\u{1F5E1}️", requires: ["deepcrystal"],
    goal: { type: "kill", mob: "dgoblin", n: 10, what: "goblin cutters" },
    brief: "The goblins on the west wing have been cutting Old Pickett's ropes. Ten of them.",
    talk: { offer: ["Someone's been cutting my ropes. My cousins. Small, green, fast, and I taught them the knots.", "Ten of the cutters off the west wing. They hit quick and they don't miss. Take food."], accept: "Ten cutters.", decline: "Keep your ropes tight.",
      accepted: "West wing. You'll hear them before you see them.", progress: "That's {have} of ten.", ready: "Quiet over there. Good.", hand: "Ten.",
      done: "Ropes stay tied now. You're welcome down here any time." },
    reward: { coins: 9000, xp: { melee: 9000, hp: 3000 }, text: "9,000 tickets, 9,000 Melee xp, 3,000 Hitpoints xp" }
  },
  deepkeeper: {
    name: "The Keeper of the Mountain", giver: "Old Pickett", where: "The Depths of the Mountain", icon: "\u{1F451}", requires: ["deepgoblins"],
    goal: { type: "kill", mob: "deepwarden", n: 1, what: "the Deepwarden" },
    brief: "The Deepwarden sits on his throne at the far end, past the gold statues. Old Pickett would like to dig there.",
    talk: { offer: ["The best seam in the mountain runs under his throne.", "He's twice the size of anything down here and he hits like the roof coming in. Nobody does him alone. Bring people."], accept: "Together, then.", decline: "Not today.",
      accepted: "Up past the gold statues, through the gate. Everyone who hurts him shares the kill.", progress: "He's still on his throne.", ready: "The throne's empty. I heard it from here.", hand: "He's down.",
      done: "Forty years I've waited to dig that seam. Here: you've earned more than tickets, but tickets is what I've got." },
    reward: { coins: 30000, xp: { melee: 14000, hp: 5000 }, text: "30,000 tickets, 14,000 Melee xp, 5,000 Hitpoints xp" }
  }
});
for (const [k, tier] of [["deepcrystal", "medium"], ["deepgoblins", "hard"], ["deepkeeper", "hard"]]) { QUESTS[k].stages = [{ ...QUESTS[k].goal }]; QUESTS[k].tier = tier; }   /* the goal-to-stages pass ran long before this line */

/* ============================================================ JEWELCRAFTING (2026-09-27, the massive update, 4 of 8)
   The owner chose it from three (EASTSCAPE-DRAFTS.md section 9). What it is here: the JEWELLER'S BENCH in the Yard, beside the anvil,
   where three things are made, each one out of another skill's work.
   - POLISHING (the volume that trains it): sand into glass beads, beads into a necklace, and each mid and late ore into a polished
     stone that sells for a little more than the ore does. So Mining feeds it from the first swing to the Depths' abyss crystal.
   - CUTTING the four gems Mining turns up (ruby, sapphire, topaz, opal). A cut gem is worth far more than the stone.
   - SETTING a cut gem into a ring or amulet Smithing made, one metal per gem: the piece keeps its metal's numbers and gains the gem's
     power. A ring carries the power once, an amulet twice. The top set takes three cut abyss crystals and a singularity piece.
   Nothing here buys xp, and every power is one of the keys worn gear already uses (tough, bite, speed, rare, tix). */
const _preJewel = new Set(Object.keys(ITEMS));
SKILLS.jewelcrafting = { held: HOLD.jewel, name: "Jewelcrafting", icon: "\u{1F48D}" };
/* held: no skills-panel row, no hiscore board, no wiki page, no bench (see HOLD) */
if (!HOLD.jewel) { SKILL_GROUPS.find((g) => g.name === "Skilling")?.keys.push("jewelcrafting"); HISCORES.push(["jewelcrafting", "Jewelcrafting", "level", "lvl"]); }
STATIONS.jbench = { skill: "jewelcrafting", verb: "cut", name: "jeweller's bench", auto: false, kind: "jewel" };
Object.assign(VERB, { jbench: "Work-at" });
EXAMINE.jbench = ["A loupe, a wheel, a tray of grit and a very steady lamp. Everything in the Yard that glitters ends up here eventually."];
/* the bench stands in the Yard between the anvil and the arcane altar */
if (!HOLD.jewel) { const build = SCENES.workyard.build; SCENES.workyard.build = function () { const b = build.call(this); if (b.g[6][39] === "p" || b.g[6][39] === ".") { b.objs.push({ t: "jbench", x: 39, y: 6, name: "Jeweller's bench" }); b.g[6][39] = "#"; } return b; }; }

const jrec = (id, lvl, xp, ins, out, n = 1) => recipe(`jc_${id}`, { skill: "jewelcrafting", station: "jbench", lvl, xp, ms: 2400, in: ins, out: [out, n] });
/* ---- polishing */
Object.assign(ITEMS, {
  bronze_bead: { name: "Bronze bead", icon: "\u{1F7E4}", ex: "A pinch of the Yard's copper and tin, rolled into a bead. Six of them and a string make a necklace." },
  bronze_necklace: { name: "Bronze bead necklace", short: "Beads", icon: "\u{1F4FF}", slot: "amulet", acc: 1, str: 1, def: 1, ex: "Bronze beads on a bowstring. The first thing every jeweller ever made." },
  glass_bead: { name: "Glass bead", icon: "\u{1F535}", ex: "Sand, melted into a drop and rolled smooth. Six of them and a string make a better necklace." },
  bead_necklace: { name: "Glass bead necklace", short: "Glass beads", icon: "\u{1F4FF}", slot: "amulet", acc: 2, str: 2, def: 2, ex: "Glass beads on a bowstring. Catches the light; catches the eye." },
  polished_diamond: { name: "Polished diamond", icon: "\u{1F48E}", ex: "Diamond ore, ground and buffed until it catches the light. Worth more than the rock it came in." },
  polished_dragonstone: { name: "Polished dragonstone", icon: "\u{1F48E}", ex: "Dragonstone, taken down to the red. Worth more than the rock it came in." },
  polished_onyx: { name: "Polished onyx", icon: "\u{1F48E}", ex: "Onyx, polished black as a closed eye. Worth more than the rock it came in." },
  starfall_glass: { name: "Starfall glass", icon: "\u{1F48E}", ex: "Starfall ore ground to a clear glass with a light somewhere inside it." },
  eclipse_pearl: { name: "Eclipse pearl", icon: "\u{1F48E}", ex: "The heart of an eclipse ore, rolled into a dark pearl with a bright ring round it." },
  cut_abyss: { name: "Cut abyss crystal", icon: "\u{1F48E}", ex: "The Depths' pink crystal, cut true. Three of them set a singularity piece." }
});
jrec("bbead", 1, 8, [["copper", 1], ["tin", 1]], "bronze_bead", 3);   /* from the Yard's first rocks, so the skill starts where Mining does */
jrec("bnecklace", 4, 35, [["bronze_bead", 6], ["bowstring", 1]], "bronze_necklace");
jrec("bead", 12, 16, [["sand", 1]], "glass_bead", 2);
jrec("necklace", 16, 60, [["glass_bead", 6], ["bowstring", 1]], "bead_necklace");
jrec("pdiamond", 15, 22, [["diamond_ore", 1]], "polished_diamond");
jrec("pdragon", 30, 36, [["dragonstone_ore", 1]], "polished_dragonstone");
jrec("ponyx", 45, 55, [["onyx_ore", 1]], "polished_onyx");
jrec("pstarfall", 60, 80, [["starfall_ore", 1]], "starfall_glass");
jrec("peclipse", 70, 110, [["eclipse_ore", 1]], "eclipse_pearl");
jrec("pabyss", 78, 150, [["abyss_crystal", 1]], "cut_abyss");
Object.assign(VALUE, { bronze_bead: 2, bronze_necklace: 18, glass_bead: 4, bead_necklace: 30, polished_diamond: 16, polished_dragonstone: 22, polished_onyx: 30, starfall_glass: 42, eclipse_pearl: 66, cut_abyss: 140 });
/* ---- cutting, and setting: [gem, cut level, cut xp, cut worth, metal, set level, set xp, the power (ring; an amulet doubles it), how many cut stones] */
export const JEWELS = [
  ["ruby", 10, 60, 120, "emerald", 20, 150, { tough: 0.03 }, 1],
  ["sapphire", 25, 110, 220, "dragonstone", 40, 260, { bite: 0.04 }, 1],
  ["topaz", 45, 180, 360, "starfall", 60, 420, { speed: 0.04 }, 1],
  ["opal", 65, 280, 560, "nova", 75, 650, { rare: 0.06 }, 1],
  ["abyss", 0, 0, 0, "singularity", 90, 900, { tix: 0.05, tough: 0.03 }, 3]
];
const GEM_WORD = { ruby: "Ruby", sapphire: "Sapphire", topaz: "Topaz", opal: "Opal", abyss: "Abyss" };
for (const [gem, clvl, cxp, cval, metal, slvl, sxp, fx, need] of JEWELS) {
  const cut = gem === "abyss" ? "cut_abyss" : `cut_${gem}`;
  if (gem !== "abyss") {
    ITEMS[cut] = { name: `Cut ${gem}`, icon: "\u{1F48E}", ex: `A ${gem}, cut and faceted. Set it into a${metal === "emerald" ? "n" : ""} ${metal} ring or amulet at the jeweller's bench.` };
    VALUE[cut] = cval; jrec(`cut${gem}`, clvl, cxp, [[gem, 1]], cut);
  }
  for (const slot of ["ring", "amulet"]) {
    const base = `${metal}_${slot}`, B = ITEMS[base]; if (!B) continue;
    const k = `${base}_${gem}`, pow = Object.fromEntries(Object.entries(fx).map(([f, v]) => [f, slot === "amulet" ? Math.round(v * 200) / 100 : v]));
    ITEMS[k] = { ...B, name: `${GEM_WORD[gem]}-set ${B.name.toLowerCase()}`, short: `${GEM_WORD[gem]} ${slot}`, fx: { ...(B.fx || {}), ...pow }, gemset: gem, gembase: base,
      ex: `${B.name}, set with ${gem === "abyss" ? "three abyss crystals" : `a cut ${gem}`}. Everything the ${slot} had, and ${Object.entries(pow).map(([f, v]) => `${Math.round(v * 100)}% ${({ tough: "less damage taken", bite: "more bites", speed: "faster at everything", rare: "better drops", tix: "more tickets" })[f]}`).join(" and ")}.` };
    VALUE[k] = Math.min(2500, (VALUE[base] || 0) + Math.round((gem === "abyss" ? 140 * need : cval) * 1.5));
    jrec(`set${gem}${slot}`, slvl + (slot === "amulet" ? 2 : 0), sxp + (slot === "amulet" ? Math.round(sxp * 0.3) : 0), [[base, 1], [cut, need]], k);
  }
}

/* (2026-09-27, the owner: "we need to make pets tradable between users or sellable ... so users can maximize breeding") PETS CHANGE HANDS.
   Three ways, and each moves the pet object whole, so a Greater pet keeps its two picked stats and a name stays a name:
   - the TRADE WINDOW, next to the items and tickets (up to tradeMax a side);
   - LIVIA'S EXCHANGE: a pet is listed on its own at a price, leaves your list while it is up, and anyone can buy it outright. The
     money goes to your bank like any sale, less the same 1% (exTax). Pets are not items and never stack, so they are not in the order
     book; they are their own short list (exSlots each);
   - BOM, at the Prize Counter, buys any pet by its rank. That is a floor, not a market: a Greater pet costs eighteen Greater food and twelve
     hours (the parents come back since 2026-09-27), so these are low on purpose, and the Exchange is where a good one is worth more.
   `own` is the most pets one character can hold, the same 50 the pen's collect has always checked. */
export const PET_TRADE = { bom: { ordinary: 1000, greater: 5000, legend: 25000 }, exSlots: 4, tradeMax: 6, own: 50 };
export const petBomPrice = (p) => PET_TRADE.bom[rankOf(p)] || 0;

/* (2026-09-27) what HOLD keeps out of the wiki: every item the two blocks made, the Depths' pet and Old Pickett's quests */
if (HOLD.depths) { for (const k of Object.keys(ITEMS)) if (!_preDepths.has(k) && _preJewel.has(k)) ITEMS[k].held = true; PETS.potboy.held = true; for (const t of ["potboy", "dgoblin", "dwisp", "dogre", "diron", "deepwarden"]) if (MOBS[t]) MOBS[t].held = true;   /* (2026-09-27) its monsters too, so the wiki's "Dropped by" never points into it */ for (const q of ["deepcrystal", "deepgoblins", "deepkeeper"]) if (QUESTS[q]) QUESTS[q].held = true; }
if (HOLD.jewel) for (const k of Object.keys(ITEMS)) if (!_preJewel.has(k)) ITEMS[k].held = true;

/* (2026-09-21) the map-building helpers, for the files that hold maps outside this one (eastscape-closed.js, and the dungeon's). */
export const _MAP = { block, grid, keepOf, room, wild };

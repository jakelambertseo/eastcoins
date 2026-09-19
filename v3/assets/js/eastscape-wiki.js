/* ============================================================
   EastScape wiki — the hand-written half

   Most of the wiki is built straight from the game's own rules
   (eastscape-shared.js): every item, monster, drop, skill, quest,
   area and NPC page comes from the same data the server plays by,
   so it can't go stale. This file holds what the rules can't say:
   guides, and the Updates log.

   WHEN YOU CHANGE THE GAME: add an entry to the top of UPDATES
   (newest first), and a guide here if something needs explaining.
   Bump ?v= on this file's import in eastscape.html (cached a year).
   ============================================================ */

// guides: { id, title, icon, body } — body is simple HTML (paragraphs, lists, <b>). Link a page with <a data-wiki="items/logs">.
export const GUIDES = [
  {
    id: "start", title: "Getting started", icon: "🧭",
    body: `<p>You wake up at the <a data-wiki="areas/farm">Ludus Farm</a>, just outside the farmhouse door, with a wooden rudis in your hand and a <a data-wiki="items/pickaxe">pickaxe</a>, an <a data-wiki="items/axe">axe</a> and a <a data-wiki="items/rod">fishing rod</a> in your bag.</p>
      <ul><li><b>Walk:</b> click the ground, or hold WASD / the arrow keys.</li>
      <li><b>Do things:</b> click them. Hovering tells you what a click will do.</li>
      <li><b>Talk:</b> click a person. A <b>red arrow</b> over someone means they have work for you; <b>gold</b> means you can hand it in.</li>
      <li><b>Travel:</b> walk onto the blue tiles at the edge of an area. Doors lead into buildings.</li></ul>
      <p>Start with <a data-wiki="npcs/Bom Trady">Bom Trady</a>, the big man by the path. His first job teaches you to use your axe.</p>`
  },
  {
    id: "tools", title: "Tools and equipment", icon: "🪓",
    body: `<p>Tools go in your <b>weapon hand</b>, and you have to be holding the right one to use a skill: the pickaxe to <a data-wiki="skills/mining">mine</a>, the axe to <a data-wiki="skills/woodcutting">chop</a>, the rod to <a data-wiki="skills/fishing">fish</a>.</p>
      <p>Click a tool in your bag to wield it; whatever you were holding goes back in the bag. Click your sword to fight properly again. Click anything on the Equipment tab to take it off.</p>`
  },
  {
    id: "saving", title: "Saving (there's no button)", icon: "💾",
    body: `<p>Your character lives on the GAMBA server. It's saved a few seconds after anything changes, and again the moment you close the tab or lose your connection. Come back on any browser, logged in with the same Twitch account, and you're exactly where you left off.</p>`
  },
  {
    id: "group", title: "Working together", icon: "🤝",
    body: `<p>Every other player working the same tree, rock, fishing spot or olive tree as you gives you <b>+1%</b> to your chance of success and to your xp. The more the merrier.</p>`
  },
  {
    id: "bank", title: "The bank", icon: "🏛️",
    body: `<p>The <a data-wiki="areas/bathhouse">Bank</a> is the building marked BANK in <a data-wiki="areas/forum">the Forum</a>, the town square. Walk in and use any booth (or talk to Aurelia).</p>
      <ul><li>It holds <b>200 different items</b>, and each stack is unlimited.</li>
      <li>Click an item to move it; pick <b>1, 5, 10 or All</b> first to move more at once.</li>
      <li><b>Deposit bag</b> and <b>Deposit worn</b> empty your inventory or your equipment in one click.</li></ul>`
  },
  {
    id: "casino", title: "The Casino", icon: "🎰",
    body: `<p>The Casino is the red building in <a data-wiki="areas/forum">the Forum</a>: somewhere to hang out, have a flutter and pick up paid work. It's <b>Cash only</b> (never ZCoins).</p>
      <ul><li><b>Slots</b> (left wall): three reels. Three of a kind pays, from 5× for cherries up to 500× for three sevens; two cherries pay 1.4×.</li>
      <li><b>The jackpot:</b> 2% of every slots spin goes into one pot everybody shares, shown at the top of the machine. Three sevens wins it on top of the 500×: a 500 Cash spin wins the whole pot, smaller spins a share in proportion (the rest stays in for the next person). The whole world hears about it.</li>
      <li><b>Coin Flip</b> (the round table): heads or tails, pays 1.95×.</li>
      <li><b>Dice</b> (by the bar): pick a number from 5 to 95 and roll 1–100 under it. The lower your number, the bigger the payout.</li>
      <li>Bets are 1 to 500 Cash, from your bag. The house keeps a little on every game, about 3%. The server decides every result.</li>
      <li>Big wins are announced to the room, and huge ones to everyone.</li>
      <li><b>Luck:</b> lucky clovers (found while skilling in the Workyard) and lucky horseshoes (dropped by monsters in the Paddock) make your next 15 or 25 bets lucky. A lucky win pays 2.5% more, at every table including roulette. Your lucky bets show top-right.</li></ul>
      <p><b>The Roulette Room</b> is through the red curtains at the back. One table, one spin for everyone: bets are open for 25 seconds, then the ball rolls and the whole room sees the number together. Red, black, odd, even, 1–18, 19–36 (2×), dozens (3×) and single numbers (36×); up to 500 Cash a spin. Green zero is the house's.</p>
      <p><b>The task board</b> by the door has three <b>daily tasks</b> just for you, picked for your levels: gather this many, defeat that many. They count what you do today, pay Cash when you claim them at the board, and refresh every morning (Chicago time). Handy when the slots have been unkind.</p>`
  },
  {
    id: "exchange", title: "The Market", icon: "⚖️",
    body: `<p>The market is Livia's stall in <a data-wiki="areas/forum">the Forum</a>. It has two sides.</p>
      <ul><li><b>Buy:</b> the newest things for sale, first. Search by name or pick an item from the list, then press <b>Buy</b> on a listing. It's in your bank straight away.</li>
      <li>Can't find it? <b>Post a buy offer</b>: say what you'll pay, and it fills when someone sells at or under that. You get the difference back if it fills cheaper.</li>
      <li><b>Sell:</b> <b>post a sell offer</b> from anything in your bag or bank, and see how your offers are doing. The Sell side also shows people who want something you have.</li>
      <li>Offers match on their own: <b>the best price wins, then whoever was first</b>, at the price of the offer that was already waiting.</li>
      <li>There's nothing to collect: <b>what you buy and what you earn goes straight to your bank</b>, even while you're offline. You'll get a line in chat each time, and a summary when you log back in.</li>
      <li>Cash for buying comes from your bag first, then your bank. You can have <b>8 offers</b> up at once; taking one down puts what's left back in your bank.</li>
      <li>The market keeps <b>1%</b> of each sale, rounded down (so small sales are free). Trading face to face is always free.</li></ul>`
  },
  {
    id: "trading", title: "Trading with players", icon: "🤝",
    body: `<p>Click another player (you need to be within 5 tiles) to ask to trade. When they click you back (or press Accept in chat), a trade window opens.</p>
      <ul><li>Click items in your bag to offer them; type an amount of Cash to offer Cash.</li>
      <li>Both press <b>Accept</b>. Then both check the <b>second screen</b> and press Accept again. Nothing moves until both have accepted twice.</li>
      <li>Any change to either offer resets both accepts, so nobody can swap something out at the last second.</li></ul>`
  },
  {
    id: "speed", title: "Movement speed", icon: "👟",
    body: `<p>Walking one tile takes a quarter of a second. Speed bonuses (from boots, pets and potions, as they arrive) make that faster:</p>
      <ul><li>The first <b>+20%</b> counts in full.</li><li>Anything past that counts <b>half</b>.</li><li>The total can't go past <b>+50%</b>.</li></ul>
      <p>So +40% from gear gives +30% speed, and stacking past +80% doesn't help. Your Equipment tab shows your current speed.</p>`
  },
  {
    id: "cooking", title: "Cooking and eating", icon: "🍳",
    body: `<p>Raw fish and meat can be cooked at the <b>range</b> in the Farmhouse, the <b>hearth</b> in your island cottage, or any <b>campfire</b>. Click one with raw food in your bag and you'll cook it all, one at a time.</p>
      <ul><li>You can burn food. The chance drops as your Cooking level rises, and each food stops burning at a certain level. Ranges and hearths burn a little less than campfires.</li>
      <li><b>Click cooked food in your bag to eat it.</b> It heals hitpoints straight away, even mid-fight, but your next swing waits a moment.</li>
      <li>Better food heals more: sardines and chicken 3, trout 7, moon carp 14.</li></ul>`
  },
  {
    id: "forge", title: "The Forge", icon: "⚒️",
    body: `<p><b>Brutus the Smith</b> stands outside the store in <a data-wiki="areas/forum">the Forum</a>. Talk to him to trade.</p>
      <ul><li>He sells tools and the <b>Bronze set</b>: a gladius, a helm, a shield and a cuirass. Bronze needs Melee 5 (the cuirass needs Melee 10), and wearing the cuirass changes how you look.</li>
      <li>He buys ore, logs, hides, bones, food and most things you'll find, for Cash. The Exchange usually pays more, but Brutus pays right now.</li>
      <li>Pick 1, 5, 10 or All before clicking to buy or sell more at once.</li></ul>`
  },
  {
    id: "wilderness", title: "The Wilderness", icon: "☠️",
    body: `<p>The pit with a rope on the <a data-wiki="areas/farm">Ludus Farm</a> leads down to <a data-wiki="areas/wild">the Wilderness</a>. You need level 10 Melee to climb down.</p>
      <ul><li><b>Anyone can attack anyone</b> down there. Click another player to fight them.</li>
      <li><b>The Cage</b>, just past the rope, is a ring for fair fights: dying in the Cage costs nothing, and you're patched up outside the bars. Fights in the Cage don't give xp.</li>
      <li>Die anywhere else down there and there's a <b>1 in 4 chance</b> you drop one of the things you're wearing. Whoever killed you has a minute to pick it up; after that, anyone can.</li>
      <li>The monsters <b>come for you</b>: get close and they attack.</li>
      <li><a data-wiki="areas/deep">The Deep Wild</a>, further in, has the best gathering in the game: Grimstone, Deadwood and the Black Pool give <b>50% more xp</b> and succeed more often, and now and then you'll dig up a glimmering geode.</li>
      <li>Logging out mid-fight doesn't save you: your character stays where it was for 10 seconds.</li></ul>
      <p>Climb the rope to get back up to the farm.</p>`
  },
  {
    id: "islands", title: "Your island", icon: "🏝️",
    body: `<p>Everyone has an island. Talk to <b>Charon the Ferryman</b> on the shore at <a data-wiki="areas/river">River Bend</a> and he'll row you out.</p>
      <ul><li><b>Plots:</b> plant wheat, tomatoes or golden tomatoes from your bag. They grow in real time, whether you're online or not; come back and harvest more than you planted, plus Harvesting xp.</li>
      <li><b>Pedestals:</b> put six things on display. Click one again to take it back.</li>
      <li><b>Themes:</b> the sign by the dock changes your island's look. Charon sells new themes; others will come from events.</li>
      <li><b>Visitors:</b> anyone can visit your island by asking Charon for you by name. They can look, but they can't pick your crops or touch your things. The sign can close your island to visitors.</li>
      <li><b>The cottage:</b> walk in through its door. It's yours; one day you'll be able to furnish it.</li>
      <li><b>Upgrades</b> (from Charon): a <b>Bigger island</b> (5,000 Cash: 12 plots, 9 pedestals) and then <b>The Far Shore</b> (20,000 Cash: a bridge off the east side to a second island with 8 more plots, 6 more pedestals and a lighthouse). Everything you've planted or put on show stays put.</li>
      <li>The pet pens are empty for now. One day they won't be.</li></ul>`
  }
];

// the Updates log, newest first: { date: "YYYY-MM-DD", title, items: [ ... ] }
export const UPDATES = [
  {
    date: "2026-09-19", title: "The casino floor fills up",
    items: [
      "The hall has furniture now: the House Ruby behind velvet ropes in the middle, poker and blackjack tables (opening soon), a prize wheel, cocktail tables, a jukebox, a grand piano, a cash machine that thankfully doesn't work, and art on the back wall.",
      "It moves: spotlights drift over the carpet, the lamps breathe, the JACKPOT sign buzzes, the slot machines blink. Turn on Reduced motion in Settings and it all holds still.",
      "Meet the regulars: Parlay Pete, Nana Jackpot, Rent Money Randy and Whale Wendell. None of them should be listened to. There are a few players at the machines now too."
    ]
  },
  {
    date: "2026-09-19", title: "A simpler GAMBA: bigger tiles, luck, and a smaller world",
    items: [
      "Every area is now twice as wide and twice as tall, and the view follows you as you walk. The casino is a proper hall: more slot machines, three coin tables, three dice tables.",
      "Luck: want better odds? Work in the Workyard and you'll find lucky clovers; monsters in the Paddock drop lucky horseshoes. Click one in your bag and your next bets are lucky: every win pays 2.5% more. It shows top-right and at every table.",
      "The world is small on purpose for now: the casino (with its Roulette Room), the town, the Workyard and the Paddock. The roads out of town are closed; more opens later. Anyone who was standing somewhere else wakes up in the casino.",
      "Combat is ONE skill now. Attack, Strength and Defence merged into Combat (you keep the best of your three levels), and stances are gone: hit things, get better at all of it.",
    ],
  },
  {
    date: "2026-09-19", title: "Welcome to GAMBA",
    items: [
      "The game has a name: GAMBA. The casino is now the middle of the world, and where everyone starts (and wakes up after dying).",
      "Four ways out of the casino: north is Floor 2 (the Roulette Room), the west arch leads to skilling (the Workyard: trees, copper, tin, wheat and a fishing pond), the east arch to fighting (the Paddock: chickens, cows and rotten tomatoes), and the front door to town for crafting and the market.",
      "The casino floor is bigger, with more slot machines. Everything that was in the world before is still there, through the front door.",
      "New here? Dex gives you the House Tour: a free chip, a first game, a first job and a first payday, with the next step always shown top-left. Anyone can ask him for it, or ask \"What should I do next?\" any time.",
      "The ways out of the casino are labelled, and there's a \"How GAMBA works\" board by the front door.",
    ],
  },
  {
    date: "2026-09-18", title: "The Casino",
    items: [
      "The Forge building in the Forum is now the Casino. Brutus still works his smithy right outside.",
      "Inside: slots, coin flip and dice for Cash (never ZCoins), a bar, sofas, and Dex the Dealer.",
      "The task board moved in too: three daily tasks each, picked for your levels, paid in Cash.",
      "Through the door at the back: the Roulette Room, one shared table where everyone plays the same spin.",
      "The slots have a jackpot everyone feeds: three sevens wins it.",
    ],
  },
  {
    date: "2026-09-18", title: "A simpler market",
    items: [
      "The Exchange is now a two-sided market: Buy shows the newest listings with a search and an item picker; Sell shows your offers and people who want what you have.",
      "Buy straight off a listing, or post a buy offer. Sell from your bag or your bank.",
      "Nothing to collect any more: purchases and takings go straight to your bank, and you get a chat line every time something of yours sells or fills.",
      "First hit claims a monster: once you've hit it, nobody else can attack it until the fight ends or you leave it alone for 10 seconds (not in the Wilderness). Busy areas also respawn faster.",
    ],
  },
  {
    date: "2026-09-18", title: "The Gloam and Cloudreach",
    items: [
      "The Gloam, west of the Olive Grove: a wood where it is always five minutes before dark. Emerald and Diamond ore, Gloomwillows, and lanternfish in the black pond.",
      "Cloudreach, north off Tomatoe Hill: an island of cloud in the open sky. Dragonstone and storm-struck Onyx ore, Skyash trees, and sky eels fished straight out of the sky. The Angels of Minor Inconvenience attack on sight.",
      "Every tier of bar now smelts from its own ore (Onyx also wants one Wilderness grimstone).",
      "Six new monsters, up to level 55. Your body armour now shows its tier on your character.",
      "Right-click any item for its wiki page, and the xp tracker tells you when your next level lands.",
    ],
  },
  {
    date: "2026-09-18", title: "Attack, Strength, Defence, Smithing and five gear tiers",
    items: [
      "Melee is now three skills: Attack (accuracy), Strength (max hit) and Defence. Your old Melee level carried over into all three.",
      "Pick a stance in the Skills tab to choose which skill your fights train.",
      "Gear goes from Bronze up through Emerald, Diamond, Dragonstone and Onyx, ten levels apart. Weapons swing at different speeds.",
      "A new skill, Smithing: smelt ore into bars and hammer bars into gear. Brutus still sells bronze.",
      "An amulet slot, hover-to-compare on gear, an xp tracker and hiscores.",
      "Fishing, mining, chopping, picking, cooking and smithing now stop after 3 minutes with no clicks. The resources never run dry, but you have to be there.",
    ],
  },
  {
    date: "2026-09-18", title: "Cooking, eating and the Forge",
    items: [
      "A new skill, Cooking: cook raw fish and meat at the Farmhouse range, your cottage hearth or a campfire. Food can burn, less as you level.",
      "Click cooked food in your bag to eat it and heal, even mid-fight.",
      "Brutus the Smith has opened the Forge in the Forum: tools and the Bronze set for sale, and he'll buy what you gather.",
      "A bag slot now holds up to 99 of anything (Cash has no limit). Extra spills into the next slot; the bank still holds any amount.",
      "Bronze gear needs a Melee level to wear, and the Bronze cuirass changes your look from recruit to gladiator."
    ]
  },
  {
    date: "2026-09-18", title: "Bigger islands, the Far Shore, and your cottage",
    items: [
      "Island upgrades from Charon: a Bigger island (5,000 Cash) with 12 plots and 9 pedestals, then The Far Shore (20,000 Cash): a bridge to a second island with 8 more plots, 6 more pedestals and a lighthouse that points the wrong way.",
      "Your cottage opens: walk in through the door. A hearth, a bed, a chest and a lot of empty floor, for later.",
      "Wilderness monsters take longer to come back the tougher they are: from a minute up to three."
    ]
  },
  {
    date: "2026-09-18", title: "The Wilderness and your own island",
    items: [
      "The Wilderness is open, down the pit on the Ludus Farm (Melee 10). Anyone can attack anyone. The Cage, by the rope, is for fights that cost nothing.",
      "Die outside the Cage and there's a 1 in 4 chance you drop something you're wearing. Your killer has a minute to grab it.",
      "The Deep Wild: Tax Wraiths, Chandelier Spiders and the Sulking Revenant come looking for you. Grimstone, Deadwood and the Black Pool give 50% more xp, and sometimes a glimmering geode.",
      "New gear from the Wilderness: the Grudge knife, Tax Wraith hood, Bog-hound hide, Lantern shield, Ring of Mild Menace, and Eight-league boots, the first thing that makes you walk faster.",
      "Everyone has an island. Charon the Ferryman at River Bend rows you there. Grow crops while you're away, show off six things, pick a theme, and visit other people's islands."
    ]
  },
  {
    date: "2026-09-18", title: "The Forum opens north and east",
    items: [
      "The Forum now has gates on all four sides. The Forge moved over to make room for the north road.",
      "North: Tomatoe Hill. Tomatoe vines to pick, the Big Tomatoe, Nonna Tomatoe (it has an e), Rotten Tomatoes and Tomatoe Hornworms. And a golden vine for much later.",
      "East: the Via Appia. Cypress trees to chop, milestones, a toll post with Centurion Vibius, Highwaymen (level 12, they drop Cash and sometimes a mask), a very stubborn mule, and a marble outcrop for later. The road is washed out past the barricade.",
      "New things: tomatoes, golden tomatoes, hornworm husks, marble, and the Highwayman's mask (a helmet)."
    ]
  },
  {
    date: "2026-09-18", title: "The Bank, a lived-in farmhouse, and movement speed",
    items: [
      "The Bathhouse is now just the Bank, inside and out. It has a red runner to the counter, potted palms, benches, banners, a vault door, and a statue of its first depositor.",
      "The Farmhouse has a rug, stools, shelves, drying herbs, a window, a flour sack, a spare bucket and a cat in a tiny helmet.",
      "Movement speed is now a number the server keeps. Boots, pets and potions will raise it later: the first +20% counts in full, the rest counts half, and it caps at +50%. Your Equipment tab shows your speed.",
      "Your Cash and your name and picture now sit at the top right."
    ]
  },
  {
    date: "2026-09-18", title: "Buildings, the bank, the Exchange and trading",
    items: [
      "Buildings you can walk into: each is its own room. The Bank in the Forum and the Farmhouse on the Ludus Farm are open.",
      "The bank: 200 item slots, unlimited stacks.",
      "The Exchange: a market stall in the Forum with sell offers and buy orders that match on their own, a board to browse, and a 1% cut on sales.",
      "Trading face to face: click another player.",
      "The currency is now called Cash.",
      "This wiki.",
      "Level-up celebrations, in chat and on screen.",
      "The simulated players talk a lot less.",
      "Picked wheat is soil you can walk on until it grows back, so every stalk can be reached.",
      "A clearing round the copper at River Bend."
    ]
  },
  {
    date: "2026-09-18", title: "The server",
    items: [
      "The game moved to its own game server: everything is decided there, and your character saves itself continuously.",
      "Game-wide chat (bottom left, closed until you open it).",
      "Settings, and an admin panel for the builder.",
      "Your own movement is instant: the page walks you straight away and the server keeps it honest.",
      "What you gather pops up over your head."
    ]
  },
  {
    date: "2026-09-18", title: "The world",
    items: [
      "Four areas: Ludus Farm, River Bend, the Forum and the Olive Grove.",
      "Skills: Melee, Hitpoints, Fishing, Harvesting, Mining and Woodcutting.",
      "Quests from Bom Trady and Old Tullius.",
      "One high-level resource in every area, for later: the Ancient Yew, the Moonlit Eddy, the Fallen Star and the Sun Olive tree."
    ]
  }
];

// how each skill is trained, in words (the resources and their levels are added from the rules)
export const SKILL_GUIDE = {
  cooking: "Cook raw fish and meat at a range, hearth or campfire. Each food needs a level to cook and stops burning at a higher one. Cooked food heals when you eat it.",
  melee: "Fight monsters with a weapon in hand. Every point of damage you deal gives Combat xp (and a little Hitpoints xp). One skill does it all: it makes you hit more often, hit harder and get hit less, and it's what better weapons and armour ask for.",
  hp: "Goes up alongside Combat as you deal damage. Your Hitpoints level is your maximum health.",
  fishing: "Hold a fishing rod and click the bubbling water. You fish from the bank, two tiles away. Trout start biting at level 10.",
  farming: "Harvesting: pick wheat on the Ludus Farm and olives in the Olive Grove. No tool needed.",
  mining: "Hold a pickaxe and click a rock. Small rocks give one ore and then need a moment to refill; the big vein at River Bend is slow but never runs dry.",
  woodcutting: "Hold an axe and click a tree. Oaks are easier and rarely fall; other trees fall now and then and grow back."
};

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
    body: `<p>Your character lives on the GambaScape server. It's saved a few seconds after anything changes, and again the moment you close the tab or lose your connection. Come back on any browser, logged in with the same Twitch account, and you're exactly where you left off.</p>`
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
      <li><b>Luck:</b> lucky clovers and, rarely, lucky horseshoes turn up while you SKILL (never from monsters) and make your next 15 or 25 bets lucky. A lucky win pays 2.5% more, at every table including roulette. Your lucky bets show top-right.</li></ul>
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
    date: "2026-09-19", title: "Slots and Dice play for ZCoins (or tickets)",
    items: [
      "SLOTS AND DICE ARE REAL NOW. Same machines, same dice table, same 'Bet with' switch as the other tables: ZCoins, or tickets at 1,000 a ZCoin, and a win pays real ZCoins. The usual rules: 1 to 20 a bet, ten plays an hour at each game, 400 an hour out, and a seed you can check afterwards.",
      "THE SLOTS JACKPOT IS REAL ZCOINS. 2% of every spin feeds one pot everybody shares. Three sevens wins it: a 20 ZC spin takes all of it, a smaller spin takes its share and the rest stays. It stops growing at 500 (anything over waits and starts the next pot), and it restarts at 50 after a win.",
      "Slots pay tables are a little different from the old chip machines: about one spin in three pays something, the biggest regular prize is three diamonds at about 61x, and three sevens is the jackpot rather than a price.",
      "DICE pays the fair price for your number: under 50 is about 2.04x, under 5 is 25x.",
      "Still tickets in, tickets out: roulette upstairs and the Fight Pit. They are next."
    ]
  },
  {
    date: "2026-09-19", title: "One currency: tickets. And the tables take tickets or ZCoins",
    items: [
      "CHIPS AND CASH ARE GONE. There is one currency in GambaScape now: TICKETS. Kills, catches and daily jobs pay them, the Prize Counter takes them, and every table takes them. Your bag panel shows Tickets and your real ZCoins side by side. (Chips anyone was holding were wiped: the game is still in testing.)",
      "THE SIX REAL TABLES TAKE ZCOINS OR TICKETS. Coin Flip, the Wheel, Higher or Lower, Mines, Plinko and Scratch-Off have a 'Bet with' switch: ZCoins (your own) or Tickets, where 1,000 tickets stand in for each ZCoin. It is the very same eastcoin.vip game either way, same limits, same fairness seeds, and A WIN IS ALWAYS PAID IN REAL ZCOINS.",
      "Ticket bets have an allowance: 50 ZCoins' worth an hour. Banking ZCoins you found shares it. When it runs out the Tickets side waits for the hour to roll on; ZCoin bets still work.",
      "THE RUBY'S SCRATCH TICKETS AND ITS EXCHANGE ARE GONE: betting tickets is the way tickets become ZCoins now. The Prize Counter still banks any ZCoins you find, and still sells gear, dinners, drinks and Casino scrolls.",
      "Slots, dice, roulette upstairs and the Fight Pit take tickets and pay tickets for now. They are next in line to become ZCoin games.",
      "THE HIGH ROLLER ROOM IS CLOSED for a refit. Vince is still on the door, and still won't tell you anything."
    ]
  },
  {
    date: "2026-09-20", title: "The real tables are in the building",
    items: [
      "COIN FLIP, THE WHEELS, HIGHER OR LOWER, MINES, PLINKO AND SCRATCH-OFF ON THE CASINO'S MAIN FLOOR NOW PLAY FOR REAL ZCOINS, from your real eastcoin.vip balance. They're the same windows you know; behind them is the site's own casino. Click a table and it opens the moment you click (your character strolls over on its own).",
      "They play by the site's rules, exactly: 1 to 20 ZCoins a bet, ten plays an hour at each game, 400 an hour out, the same fairness seeds (there's a \"check the last one's seed\" link in the window), the same Daily Jackpot, and your results show on your eastcoin.vip profile. Nothing in GambaScape (luck, dinners, drinks, gear, hunger, VIP) touches these tables.",
      "COIN FLIP AND THE WHEEL ARE SHARED ROUNDS, as they are on the site: one flip every 30 seconds and one spin a minute for the whole room. Get your bet in and the window counts you down to it.",
      "A GAMES BUTTON (top left, or press G) opens them from anywhere on the main floor, and a strip across the top of the window hops between the six.",
      "HIT A LIMIT, OR OUT OF ZCOINS? That's what the arch is for: every kill and catch can drop a real ZCoin, and tickets buy Ruby scratch tickets at the Prize Counter.",
      "STILL CHIPS: the slots, the dice pit, roulette upstairs, the Fight Pit and the whole High Roller Room (which keeps its own chip versions of every table)."
    ]
  },
  {
    date: "2026-09-20", title: "Tickets, the Prize Counter, and real ZCoin drops",
    items: [
      "THE WORLD OUTSIDE PAYS TICKETS NOW, like an arcade. Every kill and every daily job pays tickets instead of Cash, and the numbers over monsters and fishing spots have a little ticket beside them so nobody mistakes them for ZCoins. A ticket is worth exactly what a dollar was: a cow still pays about 28.",
      "THE PRIZE COUNTER is the big ruby in the middle of the casino (both Cashier windows work too). It takes your drops and fish for more tickets, and it's the one place tickets are spent: CASINO CHIPS to play with (1 ticket, $1, or all of it in one click), drinks, dinners and Casino scrolls, a set of arms and armour for every level (Brutus has packed up his pitch in the Yard), and Ruby scratch tickets.",
      "RUBY SCRATCH TICKETS cost 1,000 tickets and pay 25, 10, 5 or 2 REAL ZCoins, or nothing. Five an hour at most. Trading Cash straight for ZCoins is gone: this is the way now.",
      "REAL ZCOINS DROP, RARELY. Any kill, and any catch at a pond, can turn up an actual ZCoin (one time in twenty it's five of them). About 2 to 5 an hour if you're at it steadily, a little more the deeper you go. It lands in your bag; BANK it at the Prize Counter and it goes onto your eastcoin.vip balance. Banking counts toward the same 25-an-hour allowance as scratch tickets, and anything over waits in your bag. Everyone in the scene hears about it.",
      "Your bag panel shows Tickets and Chips side by side. The free daily wheel and anything you win at the tables are still chips."
    ]
  },
  {
    date: "2026-09-20", title: "Outside is simple now: fight, or fish",
    items: [
      "THE WORLD OUTSIDE THE CASINO IS MONSTERS AND A POND. Go out the arch, click a monster, get paid: Cash, its one drop, and a roll at something rare. That's the job. If you'd rather not fight, every scene has a pond. Mining, woodcutting, smelting, smithing and cooking are gone from the world (your levels in them are kept, in case they come back).",
      "KILLS ARE TWICE AS FAST. Every monster has half the hit points, so a fight at your own level is about 8 to 12 seconds. Each kill pays a little less and there are twice as many of them, so an hour's fighting is worth what it was, with twice the drops and twice the rare rolls.",
      "MORE MONSTERS. The Yard has 24 (chickens by the gate, then cows, rotten tomatoes, hornworms, and boars at the far end). The Gloam has 18. Cloudreach has 13, including Thunder Geese at the far west end for anyone past level 50.",
      "FISHING is the quiet job. Your chance of a bite now grows with your Fishing level, there are five spots at every pond, and the fish are worth more out deeper: it pays somewhat less than fighting does (two thirds to nine tenths, depending on your level), for none of the risk. It's the ONLY place lucky clovers come from. And a fish is food straight out of the water: click one to eat it.",
      "BRUTUS SELLS GEAR FOR EVERY LEVEL, in the Yard by the pond: bronze at Combat 10, emerald at 20, diamond at 30, dragonstone at 40, onyx at 50. Bronze costs what it did; onyx is a couple of hours' fighting. The GOOD stuff still only drops.",
      "ALL SIX PIECES OF GAMBLING GEAR ARE RARE DROPS NOW. Gambler's ring: boars and hornworms. Bookie's amulet: highwaymen and gnashers. Loss adjuster's visor: moths and Tax Wraiths. Stakeholder's loafers: ghouls, rams and geese. Card sharp's gloves and the Angel's ring: where they were.",
      "DEX HAS A KITCHEN. The four dinners (Well Fed, plus an effect each) are on his menu with the drinks.",
      "RARES FOUND. The Quests tab has a collection: every rare there is, greyed out until you've found one, with a count. Hover one to see what drops it.",
      "Today's jobs are kills and fish only. New characters start with a rod and $25."
    ]
  },
  {
    date: "2026-09-20", title: "Simpler drops: Cash, its one thing, and a rare",
    items: [
      "Every monster now drops the same three lines. CASH, always. ITS ONE THING, always: chicken from chickens, beef from cows, tomatoes from rotten tomatoes, husk from hornworms, pork from boars, hide from highwaymen, emerald ore from gnashers and moths, a receipt from Tax Wraiths, diamond ore from ghouls and the Understudy, cobweb from the spider, dragonstone ore from rams. And A RARE: one roll a kill, at most one a kill.",
      "The rare is either one of the monster's own named pieces (the highwayman's mask, the Bog-hound hide, the wraith's hood, the Ring of Mild Menace, the Lantern shield, the Eight-league boots, the Grudge knife from rams, Card sharp's gloves, the Angel's ring) or a casino find (house chips, a free-play chip, a mystery box, Devil's dice, a rewind watch). A piece of gear dropping is announced to everyone in the scene. Each monster's wiki page lists its rares and the chance of each.",
      "A kill is worth exactly what it was: the Cash makes up the difference.",
      "Gone: bones, pits, feathers and tusks (what you have still sells), and the long tables that gave every piece of emerald and diamond gear a tiny chance from late monsters. That gear is smithed at the camp.",
      "Two recipes changed to match: the Gambler's ring is 2 bronze bars and a piece of pork; the Bookie's amulet is 3 bronze bars and 2 hides (hide comes from highwaymen now)."
    ]
  },
  {
    date: "2026-09-20", title: "One way out: the Yard, the Gloam, Cloudreach",
    items: [
      "THE WORLD IS ONE LINE NOW. The casino has one arch (OUTSIDE), and it leads to three scenes in a row: the Yard (levels 1 to 14), the Gloam (15 to 29) and Cloudreach (30 and up). Every one of them has its rocks, trees and fish AND its monsters, so whatever you and your friends are doing, you're doing it in the same field. The further out you walk, the more everything is worth.",
      "THE CAMP. In the Yard, between the pond and the tin rocks: a furnace, an anvil, a cooking range, and Brutus (who moved out there with his shop, and still buys what you smith). It's the only place to smelt and smith, it's right beside the rocks, and you pass it on every walk home. Anything you make sells for double, so make it before you cash in.",
      "The Yard's animals live at its west end: chickens, cows, rotten tomatoes, hornworms and boars. None of them attack first.",
      "The Gloam now has highwaymen, lantern moths, Bog Gnashers and Tax Wraiths. Gnashers (the north clearing) and wraiths (the far south-west) come for you on sight; signs say where, and they can't reach the rocks, the pond or the path. Cloudreach has Sorry Ghouls, the Understudy, Cumulus Rams, and one Chandelier Spider in the middle of the south that you should not wander into by accident.",
      "There's a campfire to cook on in the Gloam and in Cloudreach. Smelting and smithing are only at the Yard's camp.",
      "The Paddock, the Rough and the Boneyard are closed (their monsters moved into the line). If you logged out in one, you'll wake up in the casino. The Forum keeps the bank, the Exchange and Charon's cart; its smithy has moved to the camp.",
      "Cashing in is still only inside the casino, at the Ruby or a Cashier's window."
    ]
  },
  {
    date: "2026-09-20", title: "A free spin every day, VIP tiers, and the Winners' Wall",
    items: [
      "THE DAILY PRIZE WHEEL is open: the big wheel by the casino's front door. One free spin a day: Cash from $50 to $1,000, lucky clovers, a lager, free-play chips, Casino scrolls, a mystery box, even a black house chip. Spin every day: each day in a row adds 10% to the Cash slices, up to +70%. It resets at midnight, Central. It says FREE SPIN over it until you've had yours.",
      "VIP TIERS. Every dollar you ever bet counts, win or lose: Bronze at $10,000, Silver at $50,000, Gold at $250,000, Platinum at $1,000,000, Diamond at $5,000,000. Your tier shows as a coloured diamond by your name for everyone to see, and each tier raises every table's limit (Bronze +$50 up to Diamond +$1,000). Your progress is under your bag.",
      "THE WINNERS' WALL, on the back wall right of the Roulette door: today's five biggest single wins, from any table, roulette and the Fight Pit included. Win $500 or more on one bet to get on it. Wiped at midnight, Central."
    ]
  },
  {
    date: "2026-09-20", title: "The House Ruby pays in ZCoins, and the High Roller Room",
    items: [
      "THE HOUSE RUBY NOW TRADES CASH FOR REAL ZCOINS. Click the big ruby in the middle of the casino floor. $100 of Cash is 1 ZCoin, paid straight to your eastcoin.vip balance. You can take up to 25 ZCoins in any hour.",
      "RUBY TICKETS. $500 buys a ticket you scratch right there: it pays 25, 10, 5 or 2 ZCoins, or nothing. A ticket uses 5 of your hour's 25 whatever it pays. On average a ticket pays a little less than trading straight: it's the same money with a story.",
      "If the Ruby ever can't tell whether a trade went through, your Cash is HELD, not lost. Open the Ruby again a minute later and it finishes the job or hands the Cash back.",
      "THE HIGH ROLLER ROOM. There's a new door in the Fight Pit's back wall, and Vince in front of it. He lets you in with $2,500 on you, or with the High Roller buff (which you get from fighting). Inside: the same games at TEN TIMES the limits, $100 minimum, the good buffet, and Sterling. Luck and buffs cover the first $1,500 of any bet, so a $5,000 flip is a big swing, not a better deal.",
      "The wiki's words now load when you first open the wiki, which makes the game itself start a little faster."
    ]
  },
  {
    date: "2026-09-20", title: "GambaScape: three jobs, three rewards, and a bar",
    items: [
      "The game is called GambaScape now.",
      "FIGHTING PAYS PROPERLY. Every monster carries Cash on top of its drops, measured so a fighter of the right level earns a little MORE a minute than a miner of that level, for the risk. A cow is worth about $47 a kill, a boar $82, a Tax Wraith $240, the Understudy $350. Before this, everything past a cow paid worse than the rock next to it.",
      "SKILLING is now the only way to get Lucky: clovers turn up while you gather (and, rarely, a horseshoe). Monsters no longer drop horseshoes; the ones you have still work.",
      "FIGHTING has its own rewards. Any kill can turn up a house chip (red $250, black $1,000, gold $5,000), a free-play chip (your next bet is on the house, up to $100), a mystery box, Devil's dice (within two minutes of a win: triple it, one time in three, or lose it) or a rewind watch (within a minute of a loss: it never happened, up to $500). Bigger monsters turn them up far more often. One kill in eight makes you a HIGH ROLLER: every table takes double from you for your next 10 bets over the normal limit. Two pieces of gambling gear only ever drop: Card sharp's gloves (wins pay 1% more profit) and the Angel's ring (1 lost bet in 200 comes back whole).",
      "CRAFTING makes what you keep. At the anvil: the Gambler's ring (half the hunger and thirst), the Bookie's amulet (+$250 on every table), the Loss adjuster's visor (1% of every loss comes back) and the Stakeholder's loafers (your other gambling gear is 50% stronger). At the range, four dinners: every one leaves you WELL FED (no hunger or thirst) for 30 bets or more, and adds an effect of its own. Each takes something dug up AND something killed.",
      "DEX'S BAR IS OPEN. Talk to Dex: lager, The Safety Net, whiskey and champagne each change your next 10 to 15 bets. One drink at a time. $300 buys a round for everyone on the floor.",
      "CASINO SCROLLS. Dex sells them for $50. Click one anywhere (not the Wilderness, not mid-fight) and you're back on the casino floor.",
      "YOUR ISLAND IS BACK. Charon has a cart in the square out the casino's front door. Plant wheat or tomatoes on your island and they grow while you're away; upgrades and themes are sold from the cart.",
      "Everything that's on is in the Buffs bar, top right. Hover one to read it. Your table limit on every game follows your buffs. The ceiling: gear alone can never take a game over 100% back, and everything stacked with luck stops at about 104%, for as long as the dinner and the drink last.",
      "WHAT THINGS MADE ARE WORTH changed. A made thing sells for double the RAW materials in it, plus a quarter for each further step: a bronze bar is $40, a bronze sword $100 (it was $160, which paid a miner with an anvil twice what anyone else could earn). The Cashier now tells you when something in your bag is worth more made into something first.",
      "The Cashier no longer buys anything you can wear or hold (so a click can't sell your sword). Brutus, at the Forge, buys what you smith.",
      "Today's paid jobs moved to the Quests tab, and there are jobs for MAKING things now (bars, swords, dinners). Under your bag: thirst and hunger, your cash, and what your bag is worth, each in its own box."
    ]
  },
  {
    date: "2026-09-20", title: "The Fight Pit",
    items: [
      "There's a second door in the casino's back wall, in the slots room, with FIGHTING lettered over it. Behind it: a sand pit, a rail to lean on, and two monsters who have been told the other one said something about their mother.",
      "One fight at a time for the whole room. You get 30 seconds to put money on one of them (up to $500, one side only), then a proper 40-second scrap with misses and the lead changing hands, then the winners are paid, ten seconds to gloat, and the next pair comes out. Click the pit or either betting board.",
      "There are two water coolers and two buffets along the pit's back wall, so you never have to leave the rail (or miss a fight) to eat or drink.",
      "It is pure luck. The price on each fighter comes from its level: a chicken against a revenant pays big, because it mostly loses. Whoever you back, the house keeps 5%. Nothing else decides it.",
      "The House Ruby in the middle of the casino floor now takes your loot: click it to cash in, the same as a Cashier's window."
    ]
  },
  {
    date: "2026-09-20", title: "Hunger and thirst",
    items: [
      "Gambling is thirsty work. Every bet takes a little off your Thirst and your Hunger (about forty bets to a drink). Under 20% on either, the tables won't take your bets until you've had something.",
      "The water cooler and a new buffet stand side by side on the card room's back wall, next to the bar. Each click gives you back 20%, free, as many clicks as it takes.",
      "Cooked food from your bag fills you up too (25% a piece), so a fisherman never goes hungry.",
      "Both meters are in the wallet under your bag and on every table. Working, fighting and standing about cost nothing: only betting does."
    ]
  },
  {
    date: "2026-09-20", title: "A smaller bag, a wallet, and a Buffs bar",
    items: [
      "Your bag holds 20 things now, not 30, so it fills and sends you back past the tables to the Cashier. If you had more than 20, the extra went to your bank: nothing was lost.",
      "Under the bag is your wallet: your Cash, what the loot in your bag would sell for (it turns green when there's money to collect), the slots jackpot, today's three paid jobs with their progress, and a line on what to do next.",
      "Top right of the game is now a Buffs bar. It shows everything that's improving your odds. There's one kind today (Lucky, from clovers and horseshoes); it's built to hold several.",
      "The casino looks lived in: a janitor's bucket and a wet-floor sign by a spilled drink, coats by the doors, a suitcase nobody came back for, and chips, cards, losing slips and one shoe on the carpet."
    ]
  },
  {
    date: "2026-09-20", title: "The casino floor, laid out like a real one",
    items: [
      "Every kind of game now has its own roped-off room, named in gold on the carpet at its way in. SLOTS fill the north-west: three banks of machines back to back, plus the wall. WHEELS and COIN FLIP share the south-west. The CARD ROOM (Higher or Lower, and the blackjack and poker tables that open soon) is next to THE BAR in the north-east. The DICE PIT and INSTANT WINS (two Plinko machines, two Mines tables, two Scratch-Off kiosks) are in the south-east.",
      "Later the same day: fewer ropes (just a short run either side of each way in), and the rooms are broken up with the things a casino is full of. Stools at the slot machines, the tables and the bar (stand on one: it's where you'd sit), soda and snack machines, a water cooler, bins, planter boxes, and a smoking section in the north-east corner with club chairs, ashtrays and its own haze.",
      "The velvet ropes are real: you go into a room through its gap. The long aisle from the skilling arch to the fighting arch stays clear, with a Cashier at each end and the House Ruby in the middle.",
      "Dex, DookieBetts and the regulars have moved to where they belong: Dex behind the bar, Dookie in the dice pit, Whale Wendell in the card room."
    ]
  },
  {
    date: "2026-09-20", title: "Three more places to make money",
    items: [
      "The skilling line now runs three maps deep out the WEST arch. Past the Workyard is the Gloam (level 15): emerald rock $15, gloomwillow $15, lanternfish $16, and diamond rock $22 at Mining 25. Past that is Cloudreach (level 30): dragonstone $30, skyash $28, sky eels $30, and storm-struck onyx $40 at Mining 40.",
      "The fight line runs three deep out the EAST arch. Past the Rough is the Boneyard: Bog Gnashers and Lantern Moths by the gate, Sorry Ghouls and Tax Wraiths (who carry real Cash) in the middle, a Chandelier Spider and the Understudy at the far end. Several of them come for you on sight. Combat 20 at the very least.",
      "There are no monsters on the skilling line any more, and the workshop in town is still the one place to make things. Everything you bring back from the new maps smelts and sells for double like everything else.",
      "More jobs on the task board now that there are places to do them: emeralds, lanternfish, gloomwillow, diamonds, dragonstone, boars, highwaymen, moths and ghouls."
    ]
  },
  {
    date: "2026-09-20", title: "Go broke, go get more",
    items: [
      "Every table has been rebuilt to look and play like the casino on eastcoin.vip: a dark table, one gold button, what it pays beside the board, and your sitting's bets, net and best win. Mines has the tile board and the ladder, Higher or Lower deals real cards and shows your run, Plinko drops a ball through real pegs, Scratch-Off has foil you actually scratch, Slots has spinning reels and the jackpot on the table, Dice is a slider and a track, and the Coin flips.",
      "Everything out in the world now has its price written over it: $10 a rock, $10 a log, and so on. Monsters show roughly what a kill is worth.",
      "New: the Cashier, a window by each arch on the casino floor. One click turns everything you found and made into Cash. It leaves your tools, charms and anything you could wear alone.",
      "Making things pays DOUBLE. A bronze bar sells for twice the ore in it, a sword for twice the bars, cooked food for twice the raw. The workshop out the front door has a furnace, an anvil and now a cooking range.",
      "Tools just work from your bag: no more wielding a pickaxe before you can mine.",
      "A second fight map, the Rough, east of the Paddock: hornworms, boars, highwaymen carrying actual Cash, and two Bog Gnashers at the far end. Come at Combat 8 or so.",
      "The casino floor has been re-planned into neighbourhoods so there's room to wander: Slots Alley down the west wall, the Coin Corner, the Card Pit, the Bar, and the Drop Zone (Mines and Plinko) in the south-east. The entrance is clear again.",
      "Cash is written as dollars now ($250), because that's what it is."
    ]
  },
  {
    date: "2026-09-19", title: "Five more games, right where you walk in",
    items: [
      "Wheel, Higher or Lower, Mines, Plinko and Scratch-Off now stand round the rug you arrive on, with a Coin Flip table beside them. The same games as the site's casino, played for Cash.",
      "Wheel: red or black pays 1.97×, the gold sliver 58×. Plinko: twelve rows, 25× at the edges. Scratch-Off: three of a kind, up to 100×.",
      "Higher or Lower and Mines are runs: every right call or gem multiplies your stake and you cash out when you like. A run is kept for you if you close the window, walk away or the game restarts.",
      "Luck works on all of them, and every table returns about the same, so play the one you enjoy."
    ]
  },
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
      "Round the rug where you walk in: Wheel, Higher or Lower, Mines, Plinko and Scratch-Off, the games from the site's casino, for Cash. Higher or Lower and Mines are runs you cash out of; a run is kept for you if you leave the table.",
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

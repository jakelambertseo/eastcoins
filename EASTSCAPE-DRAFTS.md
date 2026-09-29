# EastScape drafts for the owner to mark up (2026-09-20)

Nothing here is built. Cross out, change numbers, write in the margins. Local file, never deployed.

---

## 1. Gear: what Bom Trady sells, what only drops

**The idea.** Tickets need one big obvious thing to buy early, and the late game needs a reason to go and hit a particular monster. So the first two sets stay on the counter and the top three come off it.

| Set | Needs Combat | Where it comes from |
|---|---|---|
| Bronze (11 pieces) | 10 | Bom Trady, as now |
| Emerald (11) | 20 | Bom Trady, as now: the "I saved up" purchase |
| Diamond (11) | 30 | **Drops only**, the Boneyard (30-39) |
| Dragonstone (11) | 40 | **Drops only**, Cloudreach (40-49) |
| Onyx (11) | 50 | **Drops only**, the Thunderhead (50+) |

Each set is 11 pieces: helm, body, legs, boots, gloves, shield, three weapons, amulet, ring. Each scene has five monsters, so every monster carries two pieces and the scene's toughest carries three.

### Proposed table (change anything)

| Scene | Monster (level) | Drops | Odds per kill |
|---|---|---|---|
| Boneyard | Ghoul (30) | Diamond boots, Diamond gloves | 1 in 120 each |
| | Stagehand (32) | Diamond helm, Diamond shield | 1 in 150 |
| | Chandelier Spider (34) | Diamond legs, Diamond ring | 1 in 150 |
| | One-Eyed Usher (36) | Diamond body, Diamond amulet | 1 in 200 |
| | Understudy (38) | the three Diamond weapons | 1 in 250 each |
| Cloudreach | Brainstorm (40) | Dragonstone boots, gloves | 1 in 150 |
| | Cumulus Ram (42) | Dragonstone helm, shield | 1 in 180 |
| | Sulking Revenant (45) | Dragonstone legs, ring | 1 in 200 |
| | Sea-Goat (46) | Dragonstone body, amulet | 1 in 250 |
| | Angel of Minor Inconvenience (48) | the three Dragonstone weapons | 1 in 300 each |
| Thunderhead | Golem (52) | Onyx boots, gloves | 1 in 200 |
| | Thunder Goose (55) | Onyx helm, shield | 1 in 250 |
| | Wolf (58) | Onyx legs, ring | 1 in 300 |
| | Drake (62) | Onyx body, amulet | 1 in 350 |
| | THE HOUSE (70) | the three Onyx weapons | 1 in 60 each (it's the boss, and it takes a while) |

**Bad-luck protection (pick one):**
- A. After 3x the listed odds in dry kills on one monster, its next kill drops a piece you don't own. Quiet, never mentioned.
- B. Once you own 3 pieces of a set, Bom Trady sells the rest of that set at 4x what they'd have cost. Visible, gives tickets a late job.

**What it does to the game.** Livia's market finally has something worth listing. Tickets matter less past Combat 30, so something has to take their place: outfits (see the looks system), casino stakes, or option B above.

**Questions for you:** Are the odds in the right region for "chill"? A kill takes roughly 15-25 seconds at level, so 1 in 150 is about 50 minutes of one monster. Should rares be tradeable? Should a drop be called out to the floor like a big win?

---

## 2. The EastScape dashboard (its own page, not the site's)

You said: not on the site's admin dashboard, a separate one later. A sketch.

**Where:** `/eastscape-admin` (or a tab inside the game's own admin panel), `bootypaper` only, same login check the game's admin panel uses.

**Top strip, six numbers:** players online now · characters that exist · tickets earned today · ZCoins banked from drops today · ticket stakes played today (ZC) · slots pot now.

**Tabs**
1. **Now**: who is online, which scene, level, look; the Russian Roulette lobby; the last ten big-win callouts.
2. **Economy**: tickets earned per hour per band (the grind sim's number beside the real one), tickets spent at the counter by item, the death bills paid, VIP tiers, how full bags are. The point is to spot a faucet.
3. **Tickets -> ZCoins**: from `gamba_stakes` on the site: vouchers issued / used / stuck, ZC of ticket stakes per player per hour against the 50 cap, the day's fuse, what those bets won and lost. This is the one that guards real ZCoins, so it comes first.
4. **ZCoin drops**: dropped, banked, still in bags; per player; the rate against what the rules say it should be.
5. **Health**: game server tick time, messages a second, save failures, players kicked, the site calls it made (count, errors), version each page is on.

**Cost:** the game server already holds most of this in memory; the dashboard asks it once a minute. The site side is two indexed queries on `gamba_stakes`. Nothing polls faster than a minute.

**Questions:** Do you want it to be able to DO things (kick, grant, close a table) or only show? Who else should see it, if anyone?

---

## 3. A reason to show up together

Three shapes, cheapest first. They can stack.

**A. Happy hour (tickets only, no ZCoins).** Every night 8-9 PM Central: Dex's round for the room is free, the Daily Prize Wheel gives a second spin, and the floor says so when it starts. Costs nothing real. Build: an hour's check and three lines of copy.

**B. Bino's Friday table.** Fridays at 9 PM Central, the house adds a bonus to the first N Russian Roulette pots (say +20 ZC each for the first five tables). The bell rings on the site too. This IS new house money: five tables is 100 ZC a week. Same idea as the Daily Jackpot: outside the hourly cap, in no bet table. You choose the number.

**C. The weekly board.** Monday to Sunday: most tickets earned, biggest single win, most Russian Roulette tables survived, most times shot. Sunday night the top of each gets a title over their head for the week ("Table Captain", "Human Shield"). No money at all, and titles are the thing this community already plays for in the Game Room.

**My pick:** A and C now (no money, all fun), B once there are enough people that five tables fill.

---

## 4. Things I need from you to make combat hit harder (your list for tomorrow)

I added sparks, crits, kill puffs and a small screen shake tonight using the sounds the game already synthesises. Real recordings would lift it a lot. If you can find these (free to use: CC0 or similar, e.g. freesound.org, kenney.nl, opengameart.org, itch.io free packs), drop them in a folder and tell me where:

| What | How many | Length | Notes |
|---|---|---|---|
| Sword / blunt HIT on flesh | 3-4 variations | under 0.4 s | punchy, not gory; variations stop it sounding like a machine gun |
| MISS / whoosh | 2 | under 0.3 s | |
| CRIT hit | 1-2 | under 0.6 s | deeper, with a little ring or crack on top |
| Monster DEATH / poof | 2 | under 0.8 s | cartoonish, not a scream |
| Player HURT grunt | 2 | under 0.4 s | one male-ish, one neutral |
| Coin / ticket pickup | 1 | under 0.3 s | bright |
| Casino WIN stinger | 2 (small, big) | 0.6 s and 1.5 s | the level-up jingle is standing in for both right now |
| Jackpot fanfare | 1 | 2-3 s | |
| Crowd cheer, small room | 1 | 1.5 s | for a big-win callout |
| Fight Pit bell | 1 | 1 s | ding ding |

**Format:** .ogg or .mp3, mono is fine, 44.1 kHz, normalised so none is wildly louder than the rest. Small files: aim for under 40 KB each.

**Visual effects, if you find a pack you like:** a pixel-art hit-spark / slash / impact sheet (16 or 32 px frames, 4-8 frames each), a small dust-puff, and a level-up / sparkle burst. Must be free for commercial-ish use and match chunky pixel art. If you'd rather, I can have PixelLab draw these (about 1 generation each; about 33 left until 2026-10-18).

---

## 5. Yahsmeena's decor shop: a first catalogue and the placement rules (DRAFT, 2026-09-21)

**What it is for.** Tickets need somewhere to go that isn't a table, and an island needs a reason to be visited. Decor is pure show: nothing here changes odds, pay, combat or growing. That keeps it safe to price freely and safe to give away at events.

**Where she is.** On every island by the cottage (live). Clicking her would open the shop window when it is built. She sells to the island's OWNER only; a visitor gets "Nice, isn't it? Get your own island and we'll talk."

### The catalogue (prices in tickets; a minute of Yard fighting is about 200, of the Boneyard about 1,100)

| Piece | Size (tiles) | Where | Price | Note |
|---|---|---|---|---|
| Wooden bench | 2x1 | outside | 1,500 | starter piece; players can sit on it |
| Picnic table | 2x1 | outside | 2,500 | |
| Flower bed (red / yellow / blue) | 1x1 | outside | 800 each | cheap, buy lots |
| Lawn flamingo | 1x1 | outside | 2,000 | her favourite |
| Tiki torch | 1x1 | outside | 1,800 | flickers at night-tinted hours |
| Campfire ring | 1x1 | outside | 3,000 | embers, like the Paddock's |
| Stone path (per tile) | 1x1 flat | outside | 150 | walkable; drawn under everyone |
| Garden gnome | 1x1 | outside | 2,500 | |
| Hammock between palms | 3x1 | outside | 6,000 | |
| Small fountain | 2x2 | outside | 12,000 | the first "I've made it" piece |
| Team flag on a pole (your NFL team's colours) | 1x1 | outside | 5,000 | colours only, no logo: the same rule as the tees |
| Jukebox speaker | 1x1 | outside | 8,000 | the casino's station and songs are heard on YOUR island too (adds the island to RADIO.heard for its visitors) |
| Armchair | 1x1 | cottage | 1,200 | |
| Sofa | 2x1 | cottage | 3,000 | |
| Bookshelf | 1x1 (against a wall) | cottage | 2,000 | |
| Big TV | 2x1 (against a wall) | cottage | 7,500 | shows the site's live NFL score ticker, if we want it to |
| Rug (six colours) | 3x2 flat | cottage | 1,500 | replaces the blue one |
| Wallpaper (four patterns) | whole room | cottage | 4,000 | a room setting, not an object |
| Floor (wood / tile / carpet) | whole room | cottage | 4,000 | a room setting |
| Trophy case | 2x1 (against a wall) | cottage | 10,000 | shows your best hiscore rank and rare drops found |
| Neon sign "OPEN" | 1x1 (on a wall) | cottage | 6,000 | |
| Gold toilet | 1x1 | cottage | 50,000 | the flex; one per island |

About 22 pieces. Art: every piece is one PixelLab object (about 25 generations; we have 32 until 18 October), or I can draw the simple ones (path, flower beds, rugs, wallpaper, floors) in code for nothing.

### Placement rules

1. **Owner only, in "decorate mode".** A Decorate button on your own island (and in your cottage). Pieces you own show in a tray; click a piece, click a tile. Click a placed piece to pick it back up. Nothing is ever lost by moving it.
2. **The grid is the game's tile grid.** A piece covers its size in whole tiles and can't overlap another piece, a plot, a pedestal, the cottage, the dock, the pen, water, or Yahsmeena.
3. **Keep the island walkable.** A piece that blocks is refused if it would cut the dock off from the cottage door, any plot, any pedestal or the pen (the same path check the map tools already use). Flat pieces (paths, rugs) never block.
4. **A cap per island size**, so a rich player can't make a lag pit: 12 pieces on the first island, 20 on the bigger one, 32 with the Far Shore; the cottage holds 12. Paths count as a quarter piece each.
5. **Outside pieces go outside, cottage pieces go in the cottage.** Wall pieces only on the cottage's back wall row.
6. **Visitors see it all and can use the social pieces** (sit on the bench, hear the speaker). They can't move anything.
7. **Owned, not consumed.** Buying gives you the piece forever; Yahsmeena buys pieces back at 25% if you change your mind. Pieces can't be traded at first (one less thing to go wrong); we can open that later.
8. **Saved on the character** (`c.isle.decor = [{ k, x, y, in: "isle" | "home" }]`), sent to visitors with the island like plots and pedestals are today. About 12 bytes a piece: a full island is under half a kilobyte.

### What I need from you
- Yes / no on the list and the prices (too cheap? the bar was).
- Whether the **jukebox speaker** and the **big TV** should be real (they touch the radio and the live scores) or just furniture at first.
- Art: spend the PixelLab generations on this, or have me draw the simple half in code?
- Whether Yahsmeena (the person) wants a say in the catalogue. It is her shop.

**Build order if you say go:** the data and placement rules first (server checks every placement), five pieces drawn in code to prove it end to end, then the shop window, then the art.

---

## 6. The Vault: a party dungeon with a team boss (DRAFT for the owner, 2026-09-21. Nothing here is built.)

**What it is for.** A reason to type "anyone up for a Vault run?" in chat. Everything else outside is solo; this is the one thing you can't do alone. It has to stay simple enough for someone with a beer in one hand: walk in, hit things, don't stand in the red, split the money.

**The pitch.** Under the casino is the house's vault. The door is in the Forum (town), a stairway down beside the bank, with a bouncer who only lets a PARTY through. Three rooms of the house's security, then the man who counts the money.

### Getting in
- **Party of 2 to 4.** Click a player, "Invite to party" (works like a trade request: they get a line in chat with Accept). A small party box shows each member's name and health. Leave any time; the leader can kick.
- **The ante.** Each member pays tickets at the door, like sitting down at a table. Clear it and you come out well ahead. Wipe and the house keeps the ante. That is the gamble, and it is why it belongs in this game.
- **Three difficulties, one map** (same rooms and art, tougher numbers), so we draw it once:

| | Who it's for | Ante each | Pays each on a clear | For comparison, the same 8 minutes solo |
|---|---|---|---|---|
| The Vault | Combat 10+ | 500 | about 5,000 | about 3,200 in the Gloam |
| The Deep Vault | Combat 30+ | 1,500 | about 14,000 | about 9,000 in the Boneyard |
| The Owner's Vault | Combat 50+ | 2,500 | about 22,000 | about 14,000 in the Thunderhead |

  So a clear pays roughly one and a half times what the same minutes would solo: worth organising, not so much that solo play feels pointless.
- **Three paid runs a day per player** (Chicago day). Runs after that pay a quarter. That bounds the tickets it adds to about 15,000 to 66,000 per player per day by tier, and stops a good party farming it all night.
- **Your own copy.** Each party gets a private copy of the dungeon (the way every player already gets a private island). Nobody can walk in on you, and a copy disappears when the party leaves, so an empty dungeon costs the server nothing. At most 6 copies at once to start with; a seventh party is told to wait a minute.

### The three rooms and the boss
1. **The Loading Dock.** Six Security Guards. Ordinary monsters, a bit tougher than the area you qualify for. They attack on sight (nothing else outside does, which is what makes this feel like a dungeon). A locked door opens when the room is clear.
2. **The Count Room.** Four Card Counters and two Chip Golems. The golems are slow and hit hard; the counters are fast and weak. First taste of "which one do we kill first".
3. **The Vault Door.** A short corridor with a bank chest (restock food) and a lever. Everybody alive has to be standing in the room before the lever works, so nobody gets left behind.
4. **THE BOSS: Big Sal, the Pit Boss.** Drawn big, like Bom Trady.
   - **Too much health to solo**, and it grows with the party: a party of 4 faces about 2.2 times a party of 2, so a bigger party is faster but not free.
   - **Anyone can hit him.** (Monsters outside belong to whoever hit them first. The Wilderness already turns that rule off, so this is a switch, not new machinery.)
   - **He goes for whoever has hurt him most in the last 10 seconds.** So the player in the best armour should open, and the others pile in. That is "tanking" without a class system, and it is exactly where a tank class would slot in later.
   - **THE SLAM, every 20 seconds.** The tiles around him turn red for two and a half seconds, then he slams: anyone still standing in the red loses about 40% of their health. The one mechanic: don't stand in the red. Easy to understand, easy to laugh at when your friend eats it.
   - **At half health he whistles.** One Security Guard per party member runs in. Somebody has to peel off and deal with them.
   - **Five minutes on the clock.** After that he hits twice as hard. A party that can't finish is pushed to a wipe instead of a 20-minute slog.
- **Dying.** No hospital bill in here (the ante is already the stake). You wake up at the dungeon entrance after 10 seconds and run back in. **A wipe** is everyone dead at once: the run ends, the party is put back in the Forum, the ante is gone.

### What you win
- **Tickets**, per the table. Everyone who did at least a tenth of the boss's damage is paid in full; less than that and you are paid half (so nobody is carried for free, and nobody is punished for being the low-level friend).
- **Your own roll on the boss's drops**, one each, not one for the party (no arguments over loot):
  - a real ZCoin at ten times a normal kill's chance;
  - **Pit Boss gear**, three pieces that only drop here (pinky ring, suit jacket, loafers), with small casino effects like the existing drop-only gear;
  - **Big Sal's Cigar**, a rare trophy for your cottage. It goes in Yahsmeena's catalogue as a piece you can't buy, only earn.
- **Hiscores**: fastest clear (party names listed together) and most clears, per difficulty.
- **The floor hears about it**: "🗝️ Kellzifer, Yahsmeena and BootyPaper cleared the Deep Vault in 6:42."

### What has to be built
1. **Parties**: invite, accept, leave, kick, the party box. New, and useful beyond the dungeon (party members could see each other on a minimap later).
2. **Private copies of a scene per party**, reusing what islands already do.
3. **Shared kills**: a damage tally per monster, so credit and pay are by what you did.
4. **The boss's brain**: who he targets, the slam and its red tiles, the whistle, the five-minute clock.
5. **Doors that open when a room is clear, the lever, the ante, the pay-out, the daily count.**
6. **A three-player test over the real socket** (like the jukebox and decor tests): ante taken once, a wipe keeps it, a clear pays everyone exactly once, the fourth run of the day pays a quarter, a copy is destroyed when the party leaves.
7. **Art** (after the PixelLab upgrade): a vault floor and walls, the Security Guard, Card Counter and Chip Golem, Big Sal at the size of Bom Trady, the door, the lever, the stairway in the Forum, the cigar trophy. About 10 to 12 generations.

Size: roughly the decor shop and the jukebox's Songs tab put together. All of it goes in its own on-demand file, because the page has no room left in its first load.

### What I need from you
- **The name and the boss.** The Vault and Big Sal are placeholders. If you would rather he was a parody like Bom Trady and Rony Tomo, tell me who.
- **The ante and the pay.** Too generous? The 1.5 times figure is the dial.
- **Party size.** I would build for 2 to 4 so it works on a quiet night. Bigger raids later if it takes off.
- **Where the door goes.** I put it in the Forum so it costs nobody a walk. It could be at the end of the road instead, as the thing you walk toward.
- **Whether this waits for Ascension.** It doesn't need classes to be fun, and it gives classes somewhere to matter when they arrive. I would build the dungeon first.


## 7. Breeding (DRAFT for the owner, 2026-09-27. BUILDING, first of the three.)

**The owner's changes (same evening), which override the text below:** eggs are "RARE but not that rare": one kill
in about 3,000 (not 20,000). And "every hour feels like micromanaging" — so the trough is filled ONCE, when the
breeding starts: every portion the pairing needs goes in at the start, and the clock then runs untouched, offline
included. The grind of making the food stays; the hourly chore goes.


The owner's brief: two of your pets go in a pen, they need levels and pet food, and what comes out is an
"upgraded" pet with similar but better stats. Very rare eggs drop from random monsters and go in the pen too.
Eight new eggs (eight new pets), and legendary versions of the current pets (not the event ones). Breeding runs
12 hours and up into days. The feeding is a grind, some of it from the Deep Wild, and the new jewels from ore
belong in it. And (added the same evening) **some pet food must come from early and mid-game monster drops,
so those monsters don't get skipped and forgotten.**

**The pen.** Tier-2 and tier-3 islands already have an empty "Pet pen" object ("Something will live here one
day"). It becomes the Breeding station: two stalls and a nest. A tier-1 island buys one from Yahsmeena. Pets in a
stall cannot be worn and come back when the breeding ends; you never lose a parent.

**Three tiers of every pet.** Base (what drops today) → **Greater** (breed two pets of any kind; the child is one
of the two parents' kinds) → **Legendary** (breed two Greater of the SAME kind). A child's numbers: each effect is
the better of its two parents' plus a quarter, rounded up; bag slots +1 at most. Legendary adds a special on top.
Every existing pet cap still applies, so a Legendary cannot break a ceiling the game already enforces.

| Pairing | Breeding level | Time | Food in the trough |
|---|---|---|---|
| Two base pets → Greater | 30 | 12 h | 12 of the kind's everyday food (one an hour; the clock stops when the trough is empty) |
| Two Greater of one kind → Legendary | 70 | 3 days | 72 of the kind's Legendary food + one opal set in the nest |
| An egg → a hatchling | the egg's level | 12 h to 5 days | a feather nest + the egg's gem |

The trough is the grind: the timer only runs while there is food in it, one portion an hour, so a 3-day
Legendary is 72 portions somebody had to make.

**Food, by kind.** New Cooking recipes at the range. **Every everyday food needs an early-game drop, and every
Legendary food needs a mid-game drop AND a late or Deep Wild one**, so the whole monster ladder stays worth
fighting:

| Pet | Everyday food (early drop) | Legendary food (mid drop + late) |
|---|---|---|
| Bonepup | Pup kibble: beef (Cow 2) + bones | Grim marrow broth: marrow (Marrow Hound 50) + grimcore (Grim Lich, Deep Wild) |
| Pack Rat | Scrounge bag: olive pits (Angry Olive 6) + receipts (Paper Twister 20) | Hoard cheese: marked cards (Card Counter 24) + truffle (Fungiculture 65) |
| Coin Toad | Glitter grubs: hornworm husks (Hornworm 7) + ground topaz | Gilded grubs: shark teeth (Loan Shark 26) + opal dust |
| Lantern Moth | Moth lamp oil: flashlight (Usher 36) + glowcap (Fungiculture 50) | Moon nectar: cobwebs (Stagehand 32) + moon carp (Wilderness fishing) + void morel |
| House Cat | Fish supper: raw chicken (Chicken 1) + cooked koi or cloud ray | Grimscale supper: static pelt (Thunderwolf 58) + grimscale (Deep Wild fishing 97) |
| Coilling | Scarab mash: pork and tusks (Wild boar 8) + scarab shell | Void mash: cobra fangs (Sand Cobra 48) + voidglass (the Vault) |

The **feather nest** every egg sits in is early-game too: 10 feathers (Chicken 1, Highwayman 12) and 2 cowhides
(Cow 2), with charcoal to keep it warm.

**The Legendaries** (new art each): Bonepup → **Cerberpup** (three heads), Pack Rat → **The Hoarder** (a rat on
a pile), Coin Toad → **Golden Toad** (crowned), Lantern Moth → **Moon Moth**, House Cat → **The House Always
Wins** (visor and cards), Coilling → **Coil Wyrm**. Each keeps its kind's effect, stronger, and gains one special
(for example Cerberpup: walks 12% faster AND a kill sometimes drops a second bone; The Hoarder: +6 slots).

**Eight eggs, eight new pets.** One kill in about 20,000 anywhere drops an egg, weighted by where you are, so each
egg has a home. Tradable, listable on the Exchange. Each hatches in the nest with its gem. Every new pet helps ONE
skill, which is how Breeding reaches the rest of the game:

| Egg (Breeding to hatch) | Pet | Helps | Nest gem | Hatches in |
|---|---|---|---|---|
| Speckled egg (10) | Pocket Owl | Archery: bows reach 1 tile further | ruby | 12 h |
| Mossy egg (15) | Mossback Tortoise | Hitpoints: 10% less damage taken, walks slower | ruby | 18 h |
| Truffle-scented egg (25) | Truffle Pig | Fungiculture: beds yield more, finds wild mushrooms | sapphire | 1 day |
| Sparking egg (35) | Stormling (a pocket cloud) | Fishing: fish bite more often | sapphire | 1 day |
| Cindered egg (45) | Cinder Salamander | Cooking and Smithing: nothing burns, a smelt now and then is free | topaz | 2 days |
| Velvet egg (55) | Fortune Ferret | Thieving: pickpockets succeed more | topaz | 2 days |
| Geode egg (65) | Crystal Crab | Mining: gems turn up more in ore | opal | 3 days |
| Gilded egg (80) | Mimic (a tiny chest) | +bag slots, and once a day a small random gift | opal | 5 days |

**The skill itself:** 1 to 99. Xp for setting up a pairing, for every portion fed, and a large amount at the
birth or the hatch. Levels gate the pairings and the eggs above.

**Cost:** 6 Legendary pet sprites + 6 Greater recolours (tint pass) + 8 new pets + 8 eggs + ~14 food icons + the
feather nest + the pen object redrawn with stalls and a nest + the skill icon. About 45 pieces.

## 8. Fungiculture (BUILT LOCALLY 2026-09-27, commit b5c41fe5, rules 302; not shipped)

**What changed from the draft while building it:** wild clusters sit at FIXED spots per map (three a map) and refresh
per player per day, rather than moving each morning: a cluster that moved at midnight would put the page and the server
on different maps. The cellar wears the Crypt's stone as a placeholder; the owner picks its own tiles. Beds grow 60x
faster on a DEV server only. Truffle: 20% of wild picks with a Truffle Pig out, 8% spawn, 5% spawn off a bed harvest.
Ladder is 15,000 tickets at Yahsmeena. Compost: 1 (lvl 1-35), 2 (42-65), 3 (72-90) a planting.

(The original draft follows.)

The owner's brief: it solves the sporecap being the single early input to Wizardry and Fletching. Yahsmeena
sells a ladder, you place it on your island, and it goes down to a cellar room where fungus beds work like
farming plots. Shrooms also come from mushrooms scattered around the world.

**The cellar.** Yahsmeena's shop gets a **Cellar ladder** (a decor piece, placed with Decorate like any other).
Clicking it goes down to **The Cellar**, a private room per island (built like The Cottage), with fungus beds:
6 to start, more with the island's tier. Dark, damp, glowing caps; its own look, not a reskin of the farm.

**Spawn from the world.** Wild mushroom clusters appear on every outdoor map, a few a map, moving every morning
(the ghost lanterns' machinery, which already exists). Picking one is Fungiculture xp and gives that map's shroom
plus sometimes its **spawn** (the "seed" you plant in a bed). The Toadstool's sporecap becomes a spawn too. Beds
give spawn back like seed crops (2 back, 3 one time in ten), so a cellar found once keeps itself going.

**Beds need compost** (new recipe: rotten tomatoes or hornworm husks or olive pits, + bones + charcoal), one per
planting. That keeps the Yard's first monsters worth killing, and puts Woodcutting under every harvest.

**The ladder, levels 1 to 99:**

| Level | Shroom | Found wild in | Used for |
|---|---|---|---|
| 1 | Sulky sporecap (existing) | the Yard (the Toadstool) | early Alchemy, Arcane ink |
| 5 | Button cap | the Yard | Cooking: mushroom soup |
| 12 | Oyster shelf | the Gloam | Fletching: fungal glue (replaces sporecap in the feather brew) |
| 20 | Puffball | the Lantern Mire | Thieving: a puff of sleep-dust (pickpockets succeed more for a while) |
| 28 | Blue mould | the Boneyard | Breeding: Pack Rat food; Cooking: blue cheese |
| 35 | Inkcap | Cloudreach | **Wizardry: every ink** takes inkcap instead of sporecap |
| 42 | Bleeding tooth | the Sands | Alchemy: a healing draught |
| 50 | Glowcap | the Thunderhead | Breeding: Lantern Moth food; a lamp for the cellar |
| 58 | Ghost pipe | the Wilderness | Magic: spell pages a tier stronger for a while |
| 65 | Truffle | found only by the Truffle Pig, or grown | Breeding: Legendary Pack Rat; Cooking: truffle dinner (meal buff) |
| 72 | Lion's mane | the Vault | Alchemy: a focus draught (skilling speed) |
| 80 | Void morel | the Deep Wild | Legendary pet foods; Void ink |
| 90 | Starcap | the Trailer Park | the top meal and the top brew |

**What it fixes:** sporecap stops being the one early input. Arcane ink and the feather brew accept the new
shrooms, and the Toadstool keeps being worth killing without being mandatory.

**Cost:** 13 shroom icons + 13 spawn icons + 13 wild-cluster world objects + 4 bed growth stages each (the
crops' pattern) + the cellar room (tiles, walls, a ladder up) + the ladder decor piece + the skill icon + ~10
recipe outputs. About 90 pieces, most of them small.

## 9. The third skill: three candidates (DRAFT for the owner, 2026-09-27) — CHOSEN: A, Jewelcrafting (the owner, same evening). Built after Breeding and Fungiculture.

Each is picked for how many existing skills it feeds and eats.

**A. Jewelcrafting (my pick).** Cut the four gems (and two new top ones it would add) into rings, amulets, pet
collars, and gem sockets on gear. Ties: Mining (the gems, and the gem pet), Smithing (settings are bars), Magic
(a socketed gem adds an element), Breeding (collars on pets, gems in the nest), Thieving (fences pay more for set
jewels), Fletching (cut gems tip better arrows), and the Store (cosmetic settings). It gives the gems a second
life and makes the jewelry slots a craft rather than a drop.

**B. Hunting (trapping).** Set snares on outdoor maps, come back to critters: hides, feathers, game meat, bait.
Ties: Fletching (feathers, sinew strings), Cooking (game), Breeding (pet food, and live bait for the Mimic),
Fishing (bait makes rare fish bite), Agility (running a trap line). Best for the early and mid game.

**C. Brewing (the still).** Ales, ciders and spirits from crops and shrooms: the "drink" buffs the game already
has. Ties: Harvesting (grain, fruit), Fungiculture (mushroom beers), Cooking, the casino bar (Dex buys and serves
them), the Winners' Wall (a round for the room). Most on-theme for a casino.

## 10. THE MASSIVE UPDATE: the running order (the owner, 2026-09-27)

Breeding, Fungiculture and Jewelcrafting ship TOGETHER with the new mid, mid-late and late maps, mobs and bosses
(EASTSCAPE-MAPS.md: the Scrap Line for the 72-80 hole, then the Boardwalk, the Foundry, the Orchard Wall and the Deep
Vault), all built to feed each other. One piece at a time, each tested on the LOCAL dev server (a link every time)
before the next starts; nothing goes to production until the whole update is called.

1. Breeding (pen, food, Greater and Legendary pets, eight eggs). 2. Fungiculture (the cellar, wild clusters, 13 shrooms).
3. The Scrap Line (72-80). 4. Jewelcrafting. 5. The Boardwalk. 6. The Foundry. 7. The Orchard Wall. 8. The Deep Vault.

How they knot together, so each new map is a reason to use the new skills and the reverse:
- **Eggs** get homes on the new maps too (the Scrap Line's Magpie carries the Gilded egg's weight; the Boardwalk the
  Sparking egg; the Orchard Wall the Mossy and Speckled; the Deep Vault the Geode).
- **Wild mushroom clusters** grow on every new map, and the three top shrooms are theirs: Lion's mane in the Foundry's
  damp, Void morel under the Deep Vault, Starcap on the Scrap Line's slag.
- **Gems**: the Foundry's ore and the Deep Vault's seams are where Jewelcrafting's two new top gems come from.
- **Pet food**: the Scrap Line's sump oil and rubber, the Boardwalk's bluefin and gulls, the Orchard's honey and fruit
  go into the Legendary foods, so the late maps are where Legendaries are made.
- **Bosses**: each new boss drops one egg at a boss rate and one Legendary food ingredient, so a boss is worth farming
  for Breeding as well as for its own loot.

**The owner's rules for the new maps (2026-09-27), binding on steps 3, 5, 6, 7 and 8:**
- **Ask before building a scene:** he finds a unique tile set for each new map, the way the Wilderness was done.
- **Power creep must be felt.** Some new monsters can only be fought with a bow (archery-only: melee and magic cannot
  reach or cannot hurt them). Some carry massive protection against a style or an element (for example 90% less from
  melee, only vulnerable to void) — the style-immunity idea already on record. They hit hard, are accurate, and are tanky.
- **Bosses feel like the Pumpkin King does now** (5,200 health, his defence), **but hit harder.**


## 11. Tinkering: the sink (DRAFT for the owner, 2026-09-28) — CHOSEN over Brewing and Trapping; replaces Jewelcrafting

The owner: "tinkering makes the most sense since it provides something we desperately need: a sink", then: yes to a ticket
fee at the bench, yes to the Auto-Reel "and expand this idea similarly into mining (auger), woodcutting (chainsaw), or similar",
tickets only at the tables, Yard Projects in the first version, a new tinker NPC at Bronny's worksite (which now stands on
poured concrete, built 2026-09-28).

**THE LOOP.** Junk goes in, gadgets come out, gadgets get used up.
1. **Salvage** at the Scrap Bench: one click turns junk into parts ("Salvage the lot", favourites never taken). Parts are
   ~70% of what Bom would pay, in part value, and **cannot be sold to Bom** — that choice (tickets now, or parts) is the sink.
2. **Assemble** a gadget from parts **plus a ticket fee** (the second sink). ~3 seconds a build. Each build has a small
   chance of a **Masterwork** (double charges, a shiny name); nothing ever fails.
3. **Use it up.** Charges or a timer, then it breaks and hands back a little Scrap (never all of it).
XP from salvaging and from assembling, so clearing your bank trains the skill.

**FOUR PARTS.** Part value (PV): Scrap 1, Gears 5, Sparks 5, Relic shard 50.
| Part | Salvaged from | Notes |
|---|---|---|
| Scrap | anything: drops, burnt food, pits, husks, junk | items worth nothing still give 1 Scrap per 5 |
| Gears | metal: gear, bars, ore, tools | the combat and gathering gadgets |
| Sparks | magic: pages, ink, storm drops, wands | the party and boss gadgets |
| Relic shards | rares, late drops, Jewelcrafting's gems | the top gadgets and Yard Projects |

**GADGETS** (first pass: fee in tickets, parts as Scrap/Gears/Sparks/Relic):
| Lvl | Gadget | Parts | Fee | Lasts | Does |
|---|---|---|---|---|---|
| 1 | Confetti Cannon | 20/0/0/0 | 50 | 3 shots | confetti and a sound for everyone nearby |
| 5 | Bait Box | 30/2/0/0 | 100 | 20 min | better rare-fish chance |
| 15 | Lockpick Set | 20/6/0/0 | 200 | 20 picks | better pickpocket chance |
| 25 | Lucky Coin | 40/0/5/0 | 400 | 5 bets | FIVE FREE TICKET BETS: the house stakes 10 each, winnings are yours. Every play stays inside the 96-104% band; costs more than it returns on average, so still a sink |
| 35 | Lantern | 30/10/5/0 | 500 | 30 min | lights dark maps, shows hidden chests in dungeons |
| 45 | Pet Toy | 40/10/10/0 | 700 | 1 use | a chunk of pet xp |
| 55 | Party Banner | 60/15/15/0 | 1,000 | 10 min | plant it: your party gets a buff near it |
| 60 | **Auger** | 80/30/5/1 | 1,500 | 15 min | mines the rock you set it on, no clicks, 75% of your normal rate |
| 65 | Grappling Hook | 50/20/0/0 | 800 | 10 uses | shortcuts on the Run and in dungeons |
| 70 | **Chainsaw** | 80/30/5/1 | 1,500 | 15 min | fells the tree you set it on, no clicks, 75% of your rate |
| 75 | Boss Bomb | 80/20/20/2 | 2,000 | 1 use | a big opening hit on a boss (it shows on the run report) |
| 80 | **Auto-Reel** | 80/30/5/1 | 1,500 | 15 min | fishes the spot you set it on, no clicks, 75% of your rate |
| 90 | **Harvest Rig** | 100/40/10/2 | 2,000 | 15 min | tends your island plots and beds, no clicks |
The automation tools: you must be able to gather that node yourself, you stay logged in (no offline gathering), the
catch goes to your bag and it stops when the bag is full. 75% rate so clicking is still better: they are for the parent
cooking dinner, not a replacement for playing.

**YARD PROJECTS.** Bronny's long goal beside his daily order. One at a time, a week or two each, the whole server
feeds parts into one bar; finished, the Yard changes for good and everyone who helped goes on a plaque at the build.
First list: **Fishing Dock** (more spots on the pond, a rare-fish bonus there), **Smokehouse** (a second campfire and
smoking by the pond), **Mire Cart** (a ride from the Yard to the Mire), **Lamp Posts** (the Yard lit at night), **The
Bench Row** (seats by the bar for Rounds). Each around 5,000 Scrap, 800 Gears, 300 Sparks and 20 Relic shards, to tune.

**WHY IT IS A SINK.** Four exits and no new entry: salvage loses ~30%, the fee is tickets gone, gadgets are consumed
(the Scrap back is small), and Projects take parts in bulk. Gadgets trade on the Market, so a keen tinkerer builds for
everyone: that moves tickets between players; the parts and fees behind it are gone.

**THE TINKER: SPROCKET SAL** (the owner's pick, 2026-09-28) stands on the worksite slab beside Bronny: own art in
Nestor's style. The Scrap Bench is an object beside her.

**BUILD ORDER when approved:** parts and salvage (rules + worker + the bench window) -> gadgets 1-55 -> the four
automation tools -> Yard Projects -> the tinker's art and the bench prop. Tested on the dev server at each step.

### 11b. Round two (the owner, 2026-09-28): a gadget for EVERY skill, and projects all over the world

"There should be a buildable tinker item for every skill, including combat ones" and "instead of just Yard specific
projects, can we create 'unbuilt' tools/areas/features in other maps, and they unlock/get better as it gets better".
Numbers above are fine as a starting point; build order approved.

**ONE GADGET PER SKILL** (plus the general ones: Confetti Cannon, Lucky Coin, Lantern, Party Banner, Boss Bomb):
| Skill | Gadget | Does |
|---|---|---|
| Melee | Whetstone | +damage on your next 100 swings |
| Hitpoints | Field Medkit | heals a little every few seconds for 2 min; can pick up a downed party member |
| Archery | Scope | +accuracy for 100 shots |
| Magic | Arc Coil | your spells chain to a second target for 100 casts |
| Fishing | Bait Box / Auto-Reel | rare fish; the 15-minute no-click reel |
| Mining | Auger | the 15-minute no-click drill |
| Woodcutting | Chainsaw | the 15-minute no-click saw |
| Harvesting | Harvest Rig | tends your island plots and beds |
| Cooking | Pressure Cooker | no burns and a chance of a double for 20 min |
| Smithing | Bellows | faster smelting and a chance to save charcoal for 20 min |
| Alchemy | Distiller | a chance of an extra brew for 20 min |
| Fletching | Feather Jig | fletches in bulk for 20 min |
| Wizardry | Hand Press | a chance of extra pages for 20 min |
| Thieving | Lockpick Set | better pickpocket chance for 20 picks |
| Agility | Grappling Hook | shortcuts on the Run and in dungeons |
| Breeding | Pet Toy | a chunk of pet xp |
| Fungiculture | Humidifier | a bed grows faster |
| Tinkering | Magnifier | more parts from salvage for 20 min |

**WORLD PROJECTS, not just the Yard.** Every map gets something UNBUILT standing in it: a broken bridge, a rusted pump, a
dark lighthouse, a collapsed lift, drawn as ruins and scaffolding. The whole server feeds parts into it and it is built
in TIERS: tier 1 makes it work, tiers 2 and 3 make it better, and the picture changes each time. Each tier's LAST step
needs one player with enough Tinkering to finish it (tier 1: 20, tier 2: 50, tier 3: 80), so the skill matters as well as
the donations. Several can be open at once; each map's shows on its sign and at Sal's bench.
| Map | Project | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|
| The Yard | Fishing Dock | two more spots | a rare-fish bonus there | a legendary fishing spot |
| The Gloam | Rope Bridge | a shortcut over the gorge | lit at night | a lift down to the Mire |
| The Mire | King's Cannon | load it with Sparks: a volley at the Pumpkin King | two volleys | the volley stuns him |
| The Boneyard | Bone Crusher | bones become Scrap on the spot | faster | a Relic shard chance |
| The Sands | Oasis Pump | a well: thirst refills there | an irrigated plot | a date grove |
| The Cloud | Weather Vane | warns before a storm | storms last longer | a storm on demand, once a day |
| The Thunderhead | Lightning Rod | storms charge Sparks for everyone nearby | more Sparks | a Relic shard chance |
| The Boardwalk | Lighthouse | lights the pier at night | shows rare shoals | a night-only catch |
| The Carnival | Ferris Wheel | a ride with a view (and an emote) | a prize at the top | a daily spin |
| The Casino | New Table | the server builds a new ticket game | its own jackpot | a VIP room |
| The Wilderness | Watchtower | shows who is in the Wild with you | shows how strong they are | a safe spot beside it |
| The Vault / Trailer | Ore Cart track | a ride to the deep veins | faster | carries your ore to the bank |

These are the first list, to be trimmed: each needs its own art (ruin, and a picture per tier) and its own effect.

### 11c. Built (2026-09-28, local, held shut behind HOLD.tinker; open on the dev server)
All five steps are committed and unpushed: salvage, 19 gadgets, the Auger / Chainsaw / Auto-Reel, World Projects (Fishing Dock,
King's Cannon, New Table with the Boiler), and Sal's art and bench. Tests: `node tools/eastscape-tinker-test.mjs`. Dev admin:
`{t:'admin',cmd:'projtier',id,tier,fill}`. Still open: Lucky Coin (5 free ticket bets), Harvest Rig, the other nine projects,
tier art for dock tiers 2-3 and cannon/table tiers 2-3 (same picture for now), and what the Cannon does after the Long Night
(it only fires at bosses, and the Pumpkin King is the Mire's only one).
- (later, 2026-09-28) All twelve World Projects built, one per main map, with ruin + three stages of art each and icons for every
  gadget and part (tools/eastscape-tinker-art.mjs). The draft table's Rope Bridge / Weather Vane / Watchtower / Lighthouse were
  replaced by crafting-first builds at the owner's word: Sawmill, Bone Crusher, Oasis Still, Sky Press, Lightning Rod, Magnet Crane,
  Ferris Wheel, Smokehouse, Forward Camp. Weakest art to revisit: the Bellows icon; the Camp's stage 1 sits on a grass patch.

## 12. Gem sockets and the Gem Sorter (DRAFT for the owner, 2026-09-28)

The owner: gem slots on level-80+ weapons and gear, 1-2 per weapon, added by a long craft or a rare item; gems go through a GEM
SORTER that rolls a stat from -5% to +10% for tickets; roll until happy, sell back the rest; each gem tied to a skill; the sorter is
a World Project the server has to build.

**Gems, one per skill** (the four that exist keep their names: ruby, sapphire, topaz, opal; emerald, diamond and onyx are metals here)
| Gem | Skill | What each +1% does |
|---|---|---|
| Ruby | Melee | melee hits 1% harder |
| Jade | Archery | 1% more accurate with a bow |
| Amethyst | Magic | spells hit 1% harder |
| Bloodstone | Hitpoints | food and regeneration heal 1% more |
| Sapphire | Fishing | fish 1% faster |
| Opal | Mining | mine 1% faster |
| Topaz | Woodcutting | chop 1% faster |
| Amber | Harvesting | crops yield 1% more |
| Obsidian | Thieving | pickpocket 1% more often |
| Moonstone | Agility | 1% more Agility xp |
| Citrine | Cooking | 1% chance of cooking two |
| Garnet | Smithing | 1% chance of making two |
| Peridot | Alchemy | 1% chance of an extra potion |
| Tiger's eye | Fletching | 1% chance of fletching two |
| Lapis | Wizardry | 1% chance of extra pages |
| Turquoise | Breeding | 1% more Breeding xp and eggs hatch 1% sooner |
| Malachite | Fungiculture | beds grow 1% faster |
| Quartz | Tinkering | 1% more parts from salvage |
A negative roll is that much WORSE. Gems of one kind stack to +25% at most, whatever you wear.

**Where gems come from**: mining keeps its ruby/sapphire/topaz/opal drops; every other skill turns up its own gem rarely (about 1 in
1,000 actions at level 80+), combat gems from monsters level 60+ and bosses. A found gem is UNSORTED and can't be socketed.

**Sockets**: every level-80+ piece can take one; weapons can take a second.
- 1st socket: a **Socket Punch**, built at Sal's bench (Tinkering 70; heavy parts, 5 Relic shards, a 50,000 ticket fee). One use.
- 2nd socket (weapons only): a **Master Punch** (Tinkering 85) that needs a **Voidheart Drill Bit**, a rare drop from open-world
  bosses and the Crypt chest.
Sockets live on the piece like its reforge level, so they travel with it through the bag, the bank and the market.

**The Gem Sorter** (the 13th World Project, in the Depths, where the abyss crystals already drop all four gems):
- Sort: put in a gem, pay 10,000 tickets, it comes out with a whole-number roll from -5% to +10% (1 in 16 is +10). Re-rolling a sorted
  gem costs the same and replaces the roll.
- Socket: put a sorted gem into a piece with an empty socket. Pulling one out returns it UNSORTED (the roll is lost).
- Sell: any gem back for a flat 1,500 tickets, whatever its roll, so selling never beats using.
- Tiers: 1 the sorter works; 2 rolls cost 25% less; 3 DOUBLE SORT, every roll draws twice and keeps the better (+10 goes from 1 in 16
  to about 1 in 8). A Grand Opening makes rolls half price for the hour.
- Sink: about 160,000 tickets per perfect gem at tier 1, ~1.6M for a full ten-socket kit.

### 12b. As built (2026-09-28, dev server; held shut with Tinkering)
The owner's revisions the same hour: UNSORTED on pull; sorted gems TRADE with their roll; the Sorter REPLACES Jewelcrafting (HOLD.jewel
is now always on); it lives in the DEPTHS; and, the big one, the idol / charm model:
- COMBAT gems go in SOCKETS on level-80+ gear (1 per piece, 2 on a weapon; the 80/90 pickaxes, axes and rods are weapons): ruby melee
  damage, jasper archery damage, amethyst magic damage, jade accuracy, bloodstone healing, hematite toughness, and five elemental gems
  (carnelian fire, aquamarine frost, sunstone sun, tanzanite storm, jet void) that hit harder against monsters weak to that element.
- SKILLING gems go in the GEM CASE, a window from the bag's Gems button, always working wherever you are: sapphire, opal, topaz (gather
  speed), amber, moonstone, turquoise, malachite (xp), obsidian (pickpocket), citrine, garnet, peridot, tiger's eye, lapis (craft
  doubles), quartz (salvage). 3 slots, up to 12: Gem Case Hinge (T40, to 6), Frame (T60, to 9), Heart (T80 + Voidheart bit, to 12).
- STACKING ("8 10% melee gems ... game breaking"): only your BEST TWO of each gem kind count, sockets and case together, so the most
  any gem can add is +20%.
- There are no elemental RESISTANCES yet: monsters here don't deal elemental damage. That would be its own piece of work.
- Rolls, sockets and reforge share the item's one `f` code (fOf = the reforge level as before; fCode = everything, and it is what every
  move carries). tools/eastscape-gems-test.mjs covers the code travelling, the Sorter, sockets, the case, the caps and the odds.

## 13. The final pre-launch list (the owner, 2026-09-29) — ideas and running order (DRAFT)

The owner's fifteen items, grouped by what they share. Sizes are rough build days, art included.

**A. Quick fixes (half a day, one push)**
- Bronny's order x1.5: every count in ORDER.kinds up half (the order is what starts the 2X, so the 2X gets rarer by the same share).
- Move the Wilderness ladder out of the Gloam (combat 10-19, one map from the Yard) to the Thunderhead or the Boneyard's far end,
  so the Wild is somewhere you arrive at, not a shortcut for new players. The Gloam keeps a sign pointing on.
- The Wild Bench moves from the Wilderness to the Deep Wild (a risk worth the half-again output).
- Quivers and Magic Bags: already x3 today (300..3,000 arrows, 300..7,500 pages). Only if more is wanted.

**B. The ranged and magic pass (2-3 days) — do before any new boss, because bosses are tuned against it**
- Archery and magic GEAR: a light set per tier for each style: less defence than melee plate, a style damage bonus (dmg.archery /
  dmg.magic, the same keys the gadgets use), and archery pieces add move speed (fx.speed, inside the existing cap).
- A gear NPC for each (a fletcher-outfitter and a robe-maker, or one "Ranger & Arcanist" stall) who sells the ladder and buys it
  back the way Bom does (craftGearPrice already prices the pieces).
- Archery damage up: measure first (tools/eastscape-road.mjs gives kill time per style per monster), then lift the bow/arrow
  numbers until archery sits level with melee at equal level, not above it.

**C. Combat feel (2 days, mostly art and sound)**
- Hit, crit, block and death sounds per style (CC0 or synth, the owner's "steady" rule), a death thud and a knock-back flash.
- Player attack animations per style (swing / draw-and-release / cast) and a hit-flinch: PixelLab create_character_state off each
  body's existing sprite. Monster death: a short fade and drop, not a pop.

**D. Four new maps (6-8 days) — the biggest item; simple, like the originals**
- Each map: one band, 4-5 monsters, one gathering node set, one fishing water, a pet, rare drops, a chase item, a road.
- Bosses: 3 map bosses (one per map, fought where they stand), 3 open-world (roam and rise on a timer like the Pumpkin King),
  1 daily boss (up once a day, first-kill bonus), 1 group boss (needs 4+ in the fight to take damage at all).
  QUESTION: is that 6 in total (the daily and group among them) or 8?
- Rides with it: TELEPORT SCROLLS (one per map, a rare drop from that map's monsters, reads to its arrival point) and
  RARE/JACKPOT MONSTERS (a gilded variant of a map's monster, 1 in ~500 spawns, glows, big bounty and a chase roll; JACKPOT_KILL
  already pays 12x bounty on 1 kill in 250, so this is the visible version of it).
- CONSISTENT ROADS: one road rule for every map (3-wide cobble between exits, like the Yard's), each map's own stone and edge blend.

**E. Towers (2 days, after D) — reuse the Tower engine**
- Archery Tower and Magic Tower: the same floors, but only that style does damage (the page says so at the door).
- Boss Trials: a tower whose floors are the world's bosses in order, smaller and faster, a trophy per ten.

**F. The Yard Raid (2 days, after D)**
- A server-wide turn-in meter at a raid board in the Yard (like a World Project): when it fills, a huge boss walks into the Yard
  for everyone. Pay by contribution (damage and turn-ins), a raid pet and chase item, a Grand-Opening-style buff after.
  It can be one of D's open-world bosses, dressed up.

**G. The store (1-2 days, any time)**
- Rebuild the store window in the UI kit (tabs, a preview, a featured row) and add a round of items (the Halloween set shows the
  shape). Independent of everything else.

**Running order:** A (today) -> B -> C in parallel with D's art -> D -> E and F -> G whenever. About 16-20 days in total, so
**this list does not fit a 1 October launch**: either launch on A+B+C and ship D-G as the first updates, or move the date.

# EastScape backlog

Local only (like BACKLOG.md): never copied to the deploy repo. The in-game wiki's Updates log
(`v3/assets/js/eastscape-wiki.js`) is the player-facing record; this file is the builder's.

**How this file is laid out** (sorted 2026-09-23, because it had become two documents in one):

1. **ROAD TO V1** — immediately below. The plan for Oct 1: ship / test / launch day / explicitly not in v1.
   If you read one section, read that one.
2. **Open work** — `Next up`, `Later`, `Foundations`. Scoped items with the reasoning behind them.
3. **Findings** — the load test, security, economy and phone passes of 2026-09-18. Several items in them are
   now closed and are marked so in place; the *reasoning* is why they are kept rather than deleted.
4. **History** — every dated `2026-09-XX: vNNN` section from `## Launch event` downward is an append-only log
   of what shipped and why. Do not reorganise it; add to the bottom.

Newest ideas go at the bottom of `Next up`. When something ships, mark it where it sits — do not delete it,
because the reasoning is most of the value.

---

# ROAD TO V1 — Thursday 1 October (sorted 2026-09-23, 8 days out)

This section is the plan; everything below it is the reference. Sections are ordered
**Ship → Test → Launch day → Not in v1**. Anything not named here is not in v1, and
that is a decision rather than an oversight. The launch date, the dress-rehearsal
reasoning and the switchover itself live in `EASTSCAPE-LAUNCH.md` — this is the work.

**The state of it: the game is content-complete for v1 and has been for days.** Nine
skills work end to end, the world has ten-plus areas, the casino tables are real, the
Crypt and the Tower are in, and the money paths were audited clean. What is left is
almost entirely *first-contact* work — the bits a player meets in the first ten minutes
and we have never watched anyone meet. That is the risk, not the feature list.

## 1. SHIP — blockers, hardest first

*(5 open. Sprite sheets were listed here and were already done — see the struck item.)*

- [ ] **A first-login tutorial for the tables.** The single highest-value item on this
      page. The tables ARE the game and a new player does not know tickets and ZCoins
      are the same bet — this is exactly where Kellzifer got lost, which is why it is
      a blocker and not a nice-to-have. Three or four skippable steps, triggered on
      first walking into the casino, NOT at login (`welcomeOnce` already owns that
      moment). Machinery to reuse: `welcomeOnce` and the `HOUSE TOUR` tour box.
- [x] ~~**Sprite sheets.**~~ **ALREADY DONE — I put this on the blocker list in error on
      2026-09-23 and corrected it the same day.** 58 sheets, 675 pictures, live in
      production. I read `startup art requests 154 (budget 160)` as a live measurement;
      it is the count a player would make *without* the sheets, which the budget tool
      keeps as a worst case and states in a comment two lines further down. **Lesson,
      and it is the same one this file already records about the furnace: check a thing
      is REACHABLE — or here, already running — before believing a number that describes
      it.** Read the tool, not just its output.
- [ ] **More to do in the second thirty minutes.** Five quests exist (`firewood`,
      `cattle`, `catch`, `scrapline`, `theking`), two from the same NPC on the starting
      farm. The first ten minutes are fine and the next thirty have no thread. The
      2026-09-18 pass called this the biggest content gap before Oct 1 and it still is.
      Cheapest fills, in order: Via Appia's Vibius quests (written, not built), a Nonna
      Tomatoe quest, Cassia's cooking quest.
- [ ] **Decide the game's admin list** (`EASTSCAPE_ADMINS` in `_tickets.js`). It is
      `bootypaper` alone, deliberately, from when this was being built. It is a
      different list from the site's `ADMIN_ALLOWLIST` on purpose. One line, but it
      needs the owner to say whether zwades and andyreidisapawg get it, and launch day
      is the worst time to discover only one person can moderate.
- [ ] **`ESCAPE_WORKER_URL` / `ESCAPE_KEY` on Pages.** Still not confirmed live.
      Backups and the dashboard's health card both wait on it, so today the nightly
      world backup is not proven to be running. Verify before launch, not after.
- [ ] **Wiki pass.** Guides for every skill and area; Updates log current. Partly done
      as features landed — it needs one read-through, not a rewrite.

## 2. TEST — nothing here is new code, it is confidence

- [ ] **A real phone.** The only pass so far was static. Known from it: tiles land
      ~18 CSS px on a 390px screen against the ~44px a finger wants. Nothing is known
      to be broken; nothing is known to work either. **Highest-risk untested thing we
      have**, because a meaningful share of a Twitch audience is on a phone.
- [ ] **Someone fresh plays the first ten minutes**, watched, without help. This is how
      the tutorial item above gets its content — do it before building the tutorial,
      not after.
- [ ] **The socket load test against prod.** Tooling is done and the in-process half
      has run (200 players, p95 0.6ms of a 50ms budget). The real-socket half has never
      been run against production.
- [ ] **This week's shipped work, by players, not by me**: farming (planting switched
      back on 2026-09-23, four new crops, nobody has grown one yet), the bank QOL
      (shift-click and sorting, shipped today), reforging and tools, the Tower.
- [ ] **A restore from the nightly backup**, end to end. It is written and documented
      as tested; re-run it once while it is cheap to be wrong.

## 3. LAUNCH DAY

- [ ] **The switchover**: Casino in the nav opens the game. See `EASTSCAPE-LAUNCH.md`.
- [ ] **Announcement** via the site bell — a notice, not chat, so it cannot surprise
      anyone mid-stream — plus a known-issues list written BEFORE launch.
- [ ] **Freeze deploys during launch hours** unless something is on fire. `planRestart`
      exists for when it is: it counts down, saves everyone, and the client waits out
      the deploy rather than racing it.
- [ ] **Watch the dashboard card** (tick p50/p95, online, busiest scenes) — which
      depends on the `ESCAPE_WORKER_URL` blocker above.

## 4. EXPLICITLY NOT IN V1

Named so nobody rediscovers them on 30 September and wonders.

| | why not |
|---|---|
| **The Moon Is Stuck** (Halloween) | paused 2026-09-18 by the owner to run mid-October. Off the critical path by decision. It takes gear-on-character with it |
| **Pet pen, breeding, farming part 4** | the pen is farming's sink and is designed, not built. After Oct 1 |
| **Party quests + viewport culling** | culling is only needed past ~80 in one room; launch will not reach it. Both post-launch |
| **Scavenger hunts, world boss, daily log-in bonus** | all three are social/retention features, which matter in week two, not week one |
| **Instanced gear / player market** | its own project — it touches bank, shop, trade, drops and the Exchange |
| **ASCENSION, Thieving, Trailer Park theft loop** | undesigned |
| **Loading states for the older windows** | real, small, and a paper cut rather than a blocker. First thing after launch |

## 5. THE HONEST RISK LIST

1. **Nobody outside this project has played it.** Every item in section 2 is a variant
   of this one sentence. The feature list is not what will go wrong.
2. **Phones.** Untested, and a Twitch audience skews mobile.
3. **The first five seconds are contested.** The welcome popup, the tutorial and the
   daily log-in bonus all want the moment a player arrives. Decide the order once,
   deliberately, instead of stacking them.
4. **Launch-day scenes are the quadratic case.** Egress is players x players in a room;
   the 2026-09-18 fix halved the constant without changing the shape. 30 in the Yard is
   comfortable, 80 is ~0.7 Mbit/s each. If launch is much bigger than expected, the
   lever is splitting the arrival scene, not shipping culling in a panic.

---

## 2026-09-21: v104, the crypt dressed, reconnects, small asks

- **Reconnect into a run.** A closed socket no longer leaves the party (`partyAway` instead of `partyLeave` in `leave()`); the place is held `CRYPT.rejoinMs` (3 min). `normChar` leaves a saved `crypt:<id>` scene alone; `cryptRejoin` (login, before placing) keeps them there if the run exists and lists them, else sends them to the Forum stairs, refunding the ante ONLY when nothing in memory remembers the run ending (`cryptGone`), i.e. the server restarted. `cryptHello` restores the party box and gates and pays a clear that happened while away (`cryptPayOne`, once each via `run.paidTo`). An empty run is kept 3 min when a member is offline, 5 s otherwise. Known soft spot: a whole party quitting while nobody else is online lets the server sleep, and they get the ante back (the run is still lost).
- **Art (all PixelLab, tools/eastscape-crypt-art.mjs, raw files in lt-crypt2/).** `t_crypt` (floor + wall tops, tiles-pro 49edd33b), `t_cryptwall` (64 px wall faces, 37f45fc4), 12 props, `o_cryptexit`, `fx_hit/fx_crit/fx_miss` (core sheet), `t_doors` (room thresholds, f78a0fbe; core), `ui/nav_*.png` (ui asset 9c9d3f82, 9-sliced). The Wang tileset 697adc69 came out like a canal: unused. The first doorway objects (d4aa1130, 4753a3eb) were standing frames, unused.
- **Exit stairs** `cryptexit` at 36,4 in the Sanctum: `cryptExit` refuses until `run.cleared`.
- **Boss bar bug:** snapshots carry `mx` when a monster's max health was set for that copy; the page measured against the book value.
- **Slam splat bug:** `who` was the bare id; the page wants `p:<id>`.
- **Camera:** interiors may scroll 100 screen px past the bottom so the exit clears the Chat button.
- **Chat:** Drops / XP view (`lootLine`, `lootGain`, xp within 10 s in one skill is one counting line). Page only.
- **Casino:** "tickets out" -> "Cash out" + zcoin.webp (casino.js v34). Task board 24,4; Winners' Wall 19,4; Hiscores 27,4; the coat rack at 24,4 removed. Task rows show the ticket picture.
- **Cooking back.** Campfire in the Yard at 40,15; `cooking` in SKILL_GROUPS again; cooked forms for the eight fish that had none (icons are the raw ones tinted with sharp, not PixelLab); cooked heals raised to about 1.6x raw. Price needed no change: anything made already sells for CRAFT_PAYS (2x) its inputs. Worked out: cooking adds about 1.8 s to a 2.9 s fish, so fish-and-cook pays roughly a quarter more a minute than fishing alone, which puts it level with fighting rather than under it. Re-run tools/eastscape-grind-sim.mjs if that matters.
- NOT DONE from the owner's list: harder crypt variations (answered in chat first), polish list (answered in chat).

## Launch event: The Moon Is Stuck (PAUSED — mid-October, not launch day)

**Paused 2026-09-18 (user): the GAME launches Oct 1; the event runs mid-month instead.**
That takes gear-on-character off the launch critical path — it is now the event's
dependency, not the launch's. Dates below still say Oct 1 / Oct 31; re-date them
when the event is picked back up.

Not Roman: the user wants new content original and imaginative (NGU / Dungeon Crawler Carl weirdness).

- **Frame:** on Oct 1 the moon jams in the sky: permanent night all month, the moon visibly bigger every day, something moving inside it the last week. Oct 31 it cracks open.
- **Giant Pumpkin (one per player):** plant a seed on your plot, water daily, it grows all month. Random mutations (teeth, cube, humming, a small judging second pumpkin). Weigh-in + leaderboard on Halloween night.
- **Monsters in costume:** every mob wears another mob's costume and drops THAT mob's loot (cow as Highwayman drops Cash). Right-click shows the costume.
- **Player costumes the world believes:** cow (cows ignore you, bots try to milk you), bedsheet ghost (ghosts treat you as kin), scarecrow (stand still, crows land, collect feathers: an AFK skill).
- **Trick-or-treat players:** click a player → Trick or Treat. Refuse candy and they trick you (shrunk 30s, name shows as "Big Steve", fake "you have leveled DOWN (not really)").
- **Candy is a drug:** small speed boost (uses the spd system); overeat → wobbly over-bright screen, then a slow crash. Also the candy sink.
- **The house that wasn't there:** appears on the Ludus Farm, door opens wider daily; rooms rearrange each visit; players bring it gifts; server-wide gift total opens new rooms (community goal).
- **Oct 31: the moon hatches** a huge, confused baby moon creature. Everyone fights it together; not evil, just scared; at low hp it cries moon goo you can gather.
- **Items** (tagged "Moon Is Stuck, 2026", never again, most tradeable): Moon Shell Fragment (rarest, glows), Tiny Moon pet (orbits your head, real-calendar phases), Your Pumpkin's Head helmet (your pumpkin incl. mutation), the Chatty Hat (cursed, says things in chat under your name), Cowardly Sword (sometimes faces away), Bag of Teeth (does nothing, rattles, mysteriously valuable), Moon Goo (future crafting mat), costume suits, Candy Bucket (counts lifetime candy).
- **Must be ready Oct 1:** night lock + growing moon, pumpkin plots, costume loot tables, candy, trick-or-treat. **During October:** the house's rooms, the hatching fight.
- **Critical path:** gear shown on characters (heads/suits/hats ARE the event). PixelLab ~35–45 generations.
- Possible separate pass: original names for the Roman-named world (Ludus Farm, Forum, Via Appia, Gaius, rudis, parma) — user to decide.

## v1.2 (held by the owner, 2026-10-02): rubber banding

The owner and players: slight rubber banding on long click-to-walk paths and when switching maps. Investigated 2026-10-02, nothing built yet.

1. **Server steps lose time (the main cause).** `stepEntity` (worker index.js) starts each step at the tick that notices the last one ended (`t0: now`), so every step rounds UP to the 50 ms tick. Base step is 200 ms (fits), diagonals 280 -> 300, and any speed bonus under ~25% is lost on straight steps (182 ms at +10% walks as 200). The page predicts the true speed, drifts ahead (~3 tiles over 30 at +10%, ~6 at +20%), passes `checkPred`'s allowance and snaps back. Also a gameplay bug: speed bonuses mostly do nothing on the server. Fix: chain each step from the previous step's planned end, and allow catching up a step after a late tick (players first; mobs unchanged).
2. **Map switch: the page guesses the arrival wrong.** `predictExit` (page) uses `G.OPP[side]` and the edge middle; the server's `moveToScene` uses the side that leads back plus `def.arrive` spots. 10 links land on the wrong edge (Yard<->Gloam, Mire<->Boneyard, Boneyard<->Cloud, Trailer<->Depths, fd_chain/fd_gate) and ~20 use an arrive spot the page ignores. Fix: one shared `arrivalOf(from, to, side)` in the rules, called by both.
3. **Softer correction (page).** When the page is ahead on the same route, wait for the server instead of snapping; snap only on a real disagreement.
5. **IDEA ONLY, not to build yet (owner, 2026-10-02: "bundle this idea (idea only)"): a deep-zoom world map, OpenSeadragon-style.**
   Plan A (recommended): a build step renders every OPEN map with its real ground and props (the offline scene renderer already
   exists), stitches them on the layout `worldLayout()` computes, and sharp cuts a Deep Zoom pyramid (`.tile({ layout: "dz" })`).
   OpenSeadragon (~100 KB gz) loads only when the map opens; pins, fog, who's here and quest arrows become its overlays. About
   14,000 x 7,000 px at full detail, 5-15 MB of tiles on the server, a few hundred KB per view. Rebuild when a map changes; held
   maps must never be rendered into it. Plan B: our own zoom painting maps live with the game's painter (no build step, heavier
   on phones). MOCK BUILT 2026-10-02: tools/zoommap-mock (open localhost:4321/tools/zoommap-mock/index.html; how to rebuild is in build.mjs): 23 live maps, 6,112 x 12,160 px, 1,548 PNG tiles, 12.5 MB. 206 props drew nothing (things the page draws in code, not from a picture) - the real build must use the page's own sprite drawing.
4. **Later:** ~31 KB/s and ~12 messages/s per player (whole-scene snapshots): measure by message type, then send deltas. The /stats tick metric always reads 0 (the clock is frozen inside a Worker request): measure tick lateness (the gap between tick starts) instead.

6. **THE QoL PACK (owner, 2026-10-02: "add these the backlog for v1.2").** Mockup of the first item: tools/buffbag-mock (/gameplan, "The Buff Bag").
   Nothing here adds power; each one takes out a chore. Every one runs only when a player acts (nothing ticks).
   - **The Buff Bag** (owner: "i want it in the store for now, but will make it cheap"). One inventory item, one slot per buff kind,
     99 each: meal, drink, potion, scroll, gadget, field kit (locked until kits ship). Click or B uses all; right-click opens the
     window. A running buff is SKIPPED (under 1 min counts as run out). Contents live on the character like the quiver.
     Open from the mock: split drinks from potions (today they share C.drink) - my pick yes; the Store price (owner: cheap). ~1 day,
     +0.5 day if potions split. Needs its PixelLab icon (drafted: tools/buffbag-mock/buffbag.png).
   - **Gear loadouts** (my top pick): save up to 4 outfits (melee/archery/magic/skilling), swap with one click or Shift+1-4; missing
     pieces skipped and named. ~1 day.
   - **Bank loadouts**: save a withdraw list, one button at any bank tops the bag up to it (pairs with Buff Bag refills). ~1 day.
   - **Buff-ending warning**: icon pulses + a soft chime at 1 min left; "B to top up" if you own a Buff Bag. ~2 hours.
   - **Auto-refill ammo**: an empty quiver / Magic Bag reloads from matching ammo in the bag mid-fight. ~0.5 day.
   - **The Lunchbox**: the Buff Bag for healing food, 3 slots x 99; E eats from it first. Reuses the Buff Bag code. ~0.5 day.
   - **Waystone case**: one item holding the 6 waystones + Casino and Homeward scrolls; click for a destination list. ~0.5 day.
   - **Junk list**: right-click "Always junk"; Bom gets "Sell all junk". ~0.5 day.
   - **Loot highlighting** (Path of Exile / Diablo): rares get a coloured beam and a sound, junk dims. Matters more now rares are 5x rarer.
   - **Idle notifier** (RuneLite's favourite): chime when gathering stops, a fight ends or health is low.
   - **Event calendar** (Lost Ark / GW2 meta timers): today's world events and raids with countdowns.
   - **Bank placeholders + bank tags/search** (OSRS / RuneLite): an emptied stack keeps its square; tag items and filter by tag.
   - **The junk-selling pet** (Torchlight): send your pet to Bom with the junk list, back in 2 min with tickets.
   - **Rested XP** (WoW): time offline banks a capped bonus that doubles XP until spent. Catches casual players up; the plan's
     "middle of the server" gap. Balance call for the owner (it is XP, after the 2X split).
   - Smaller: favourite waystones, join-a-party-member teleport (cooldown), item mail via Bom to offline players, prices on hover,
     boss respawn timers, auto-pickup tickets, a rename token, a cosmetics wardrobe, Bom's cart (Store: summon the shop/bank for
     5 min, 1 h cooldown).
   - **Held on purpose (they are power, not QoL):** gathering sacks (log basket / ore sack: fewer bank trips speed the economy up,
     against the 2X split), a materials bag that stations read from, anything that eats or drinks for you, offline gathering.
   - My suggested first cut: the Buff Bag + gear loadouts + the buff warning + auto-refill ammo (~2.5 days).
   - **Small bug found while building the mock:** fxText has no line for `steal`, so pot_ghost's description ends
     "For 15 minutes outside: ." (pot_sleep reads oddly too), and pot_surefoot's effect isn't in its fx at all. One-line fix.

## Next up

- **BUG (low, owner: "not that big of a deal"): +250 tickets to each player at the Crypt boss kill.** `tools/eastscape-crypt-test.mjs`
  (26 pass, 5 fail, 2026-09-29): each player gains 250 at the kill though crypt.js pays nothing there; the same 250 throws off the
  chest-ticket and "second go gives nothing" checks, and "walked out without the chest" returns `sent:true` in a shape the test
  doesn't expect. Suspect the kill-side bounty/finds path (killFinds / BOUNTY, added after the test) rather than the ante; confirm
  before calling the test stale. Also: one test character's tickets went 9,775 -> 17,085 across the ante (local-char leftovers?).

- ~~**Nerf the Nexus altar some**~~ DONE 2026-09-28 (local, not shipped): NEXUS {mult 2, xp 1.5} -> {mult 1.5, xp 1.25}, fractional output rounds by chance. (owner, 2026-09-28: "Nerf the Nexus alter some"). Not scoped yet: find the altar's
  rules first (what it pays or buffs, and how often), measure it against the other altars, and bring a number to the owner.

- ~~**Back and forward buttons in the wiki**~~ DONE and live 2026-09-28 (its own 50-page history, Alt+arrows, mouse side buttons). (owner, 2026-09-28). The wiki already routes by hash
  (`/eastscape#wiki/items/logs`), so these are history.back()/forward() over those routes, or a small stack of
  its own if hash history mixes with the game's.

- **The Crypt test's failures** (owner, 2026-09-28: "add the crypt failures to the backlog"). `node tools/eastscape-crypt-test.mjs`
  fails 5 of 31 (7 on the commit before Bronny's order, so some are flaky, not new):
  1. "the ante is taken from each of them, once": one player's tickets went 9,775 -> 17,085 instead of down by the ante.
  2. "the kill itself pays NOTHING into the bag any more": 250 / 250. **Likely a real bug**: the Hoodie's kill still puts 250 tickets
     straight in the bag, when the design (crypt rules, ~line 54: "dont give the users tickets directly after a boss defeat") says the
     chest is the only pay.
  3. "the bag gained exactly the chest's tickets": 2,750 vs 2,500, the same 250 as #2.
  4. "a second go gives nothing: one each": opening the chest again still gives something.
  5. "B walked out WITHOUT opening the chest: it is sent after them": the cryptloot event says sent:true but the assertion fails.
  For each: real bug (fix the worker/rules) or a test that fell behind (fix the test); make the flaky ones deterministic (stub
  Math.random, the 2X event and bounty drops).

- **Party damage meters and after-dungeon reports** (owner, 2026-09-28). The sketch is
  mockups-archive/eastscape-dungeon-report.html; build on the dev server after Gus's order.

- **Rename "Wagered" on the profile** (owner asked 2026-09-22, deferred). It reads as "tickets put in", so it
  looks impossible next to "Earned" — dookiebetts800 showed 38k earned against 455k wagered and the owner
  reasonably asked how. It is lifetime TURNOVER: `bigBet()` adds every stake, and the same tickets are re-staked
  endlessly, so 455k is that pot cycled about twelve times. Earned deliberately excludes casino winnings (the
  payout goes through `cashTo`, not `tixTo`) or winning your own stake back would count as income. Fix is a
  label, not a number: "Total staked", with a hover saying "every bet you have ever placed, added up — the same
  tickets counted again each time you re-bet them."

- **ASCENSION (owner's idea, 2026-09-21; not designed, not built).** At Combat 50 (level to be decided) a player can "ascend" into a CLASS: archer, mage, healer, tank and so on. Ascending opens high-level areas, monsters and drops that only ascended characters can reach. Pairs naturally with the party dungeon idea of the same day (a boss that needs a tank and a healer is the reason to ask chat for a party). Open questions for the design: is it a one-way choice or can you re-spec (tickets as the cost); what each class actually does differently (today there is ONE Combat skill and one kind of attack); ranged and healing need targeting other players, which does not exist yet; whether gear becomes class gear; keeping it simple enough for the audience (casino-first, beer in hand).

- **Gear shown on the character** (asked 2026-09-18)
  - Weapons and tools drawn in the hand: one small PixelLab sprite per item (~1 generation each, ~20 for everything planned), placed at a per-facing hand point and rotated/flipped in code.
  - Armour as **tier outfits** (Tiro, Bronze, Iron, Steel, Champion), matching the design doc: the hero regenerated in each outfit from the current hero as the v3 reference, all 8 facings (~2–5 generations a tier, 10–25 total).
  - The body-armour piece picks the outfit; helmets as their own per-facing overlay (~8 generations a helmet, ~40 for five). Boots come with the outfit (too small to read separately).
  - Code: a layer stack (outfit → helmet → held item) placed by facing from measured head/hand anchor points. About a session.
  - Total ~70–100 generations without animations. Tier-specific attack/chop animations later: ~40–60 more per tier.
  - **Do a cheap test first**: the Bronze outfit + 3 held items (~10 generations), wired in, judged on the character before rolling out the rest. The risk is visual consistency between separately generated pieces, not cost.
- ~~Combat depth: split Melee into Attack/Strength/Defence~~ **Done 2026-09-18.**
  Save v3. Melee did three jobs at once — accuracy, max hit AND defence — so the
  migration copies it into all three, which is not generous but EXACT: every one
  of those three comes out identical. Four stances (Accurate / Aggressive /
  Defensive / Controlled) route the xp; every stance pays the same 4 + 4/3 per
  damage, and thirds stay thirds because rounding 1.33 down three times would
  quietly pay Controlled 3 of 4. Weapons gate on Attack, armour on Defence,
  jewelry on Hitpoints; the maul also wants Strength. Weapon speed classes:
  gladius 1800ms / longsword 2400 / maul 3000, within 25% of each other on
  damage per second. Five tiers ten levels apart — Bronze 10, Emerald 20,
  Diamond 30, Dragonstone 40, **Onyx 50 (name not confirmed by the user;
  renaming is one ITEM_ALIASES line)**. Tiro dropped: starting kit covers 1-9.
  Brutus stocks bronze only; everything above it drops from Gnashers, Tax
  Wraiths, Chandelier Spiders and Revenants, because a shop that sells Onyx
  makes the copper vein the best route to the best gear in the game.
  scratchpad/eastscape-combattest.mjs, 78 assertions.
- **Still to do on gear**: item icons (all 55 new pieces fall back to emoji) and
  skill icons for Attack/Strength/Defence (the old skill_melee.png is unused now).
  ~~an amulet slot~~ **DONE** — `SLOTS` is helm, amulet, weapon, body, shield,
  legs, gloves, boots, ring, pet.
- Via Appia content: Centurion Vibius's quests (The Toll Road, The Chief's Head); the Bandit Camp past the barricade, with the Bandit Chief boss.
- Tomatoe Hill content: a Nonna Tomatoe quest; what tomatoes are for (cooking: sauce, pizza?).
- Remaining doc quests: Harvest Home, Cassia's "Supper for the Ludus" (cooking).

- **Balance mining and woodcutting against fishing** (owner asked 2026-09-22; measured, not built). The owner's
  premise was that fishing leads on tickets because it is AFK. Measured, fishing does NOT lead on RATE - woodcutting
  beats it in four zones of six, and fishing's figure already carries the 1.8 s cook per fish (raw fish sell for
  nothing, so that time is mandatory). What fishing wins is tickets per CLICK: ~2 clicks an hour against mining's
  ~1,125, because a rock gives one ore and then sets `pl.act = null`.

  Tickets an hour, melee/skill level per zone, tool speed 1.0, no group bonus:

  | zone | mining | woodcutting | fishing (cooked) |
  |---|---|---|---|
  | The Gloam (15) | 681/h x15 = 10k | 1387/h x15 = 21k | 653/h x36 = 24k |
  | Lantern Mire (25) | 720/h x22 = 16k | 1553/h x28 = 43k | 768/h x56 = 43k |
  | The Boneyard (35) | 720/h x30 = 22k | 1553/h x70 = 109k | 768/h x72 = 55k |
  | Cloudreach (45) | 720/h x40 = 29k | 1553/h x28 = 43k | 768/h x96 = 74k |
  | The Thunderhead (60) | no ore at all | 1553/h x28 = 43k | 768/h x104 = 80k |
  | Trailer Park (90) | 1125/h x110 = 124k | 1553/h x95 = 148k | 768/h x132 = 101k |

  **Mining is 3x behind through the whole midgame, for two reasons, and the first is invisible from the prices.**
  Every zone has only TWO rocks. A rock yields one ore then sits dead 8 s, so two rocks cap mining at 720/h when the
  swing rate itself allows 1,125/h - and past FOUR rocks the count stops mattering, so 4 is the number. Second, ore is
  the lowest-priced thing in its own zone every single time: the Boneyard sells dragonstone ore at 30 while its trees
  give yewlogs at 70 and its fish cook to 72. Mining pays worst AND costs the most attention.

  Levers, in order: 2 -> 4 rocks per zone (pure content, no rate tuning, +56% everywhere); then midgame ore prices
  (emerald 15->24, diamond 22->43, dragonstone 30->55, onyx 40->73, which puts mining ~15% over fishing per zone at
  4 rocks); a tree for Cloudreach and the Thunderhead (both still drop skyashlogs at 28, the same log as level 25 -
  that is the entire woodcutting gap); ore for the Thunderhead, a 50-99 zone with no mining node at all; and ZCoin
  drops for mining and woodcutting, since `ZDROP.fish` makes fishing the only skill that can drop a real ZCoin.

  **Deliberately NOT recommended: making mining auto-continue to the next rock.** It would be pleasanter, but then it
  competes for fishing's niche instead of being paid for the attention it costs. The trade should stay "fishing pays
  in convenience, mining pays in tickets"; mining currently gets neither.

  Cheap unrelated fix found while measuring: clover and horseshoe say they turn up "while you fish", but `emit("gather")`
  fires for all gathering, so mining and woodcutting already drop them equally. Wrong flavour text, not a mechanic.

- **THE CRAFTING OVERHAUL (owner, 2026-09-22). Five parts; three built, one moot, one designed below.**

  The frame: every skill terminated in "sell it to Bom", which is what made them feel interchangeable and none of
  them necessary. Each arrow below exists because the thing on the right CONSUMES the thing on the left, forever.

  | # | part | state |
  |---|---|---|
  | 1 | Charcoal: woodcutting feeds every smelt | **SHIPPED** (VERSION 170) |
  | 2 | Reforging: bars upgrade gear you own | **BUILT, unpushed** |
  | 3 | Bom stops selling the top tiers | **dropped - see below** |
  | 4 | Cooked-fish buffs (shipped as smoking) | **BUILT, unpushed** |
  | 5 | Seeds -> crops -> pet pen | **designed, not built** |

  **#3 IS NOT WORTH DOING, and the reason is a number I should have checked before recommending it.** The theory was
  that Bom's gear counter competes with smithing. It does not, by two orders of magnitude: a full Eclipse set is
  819,000 tickets at the counter against about 4,250 tickets of ore to smith. Diamond is 31x, Onyx 69x, Eclipse 193x.
  Once a furnace exists nobody rational ever buys gear again, so removing the top tiers changes nothing. Skip it.

  **THE REAL BLOCKER, found while building #1:** there was no furnace and no anvil ANYWHERE in the world. Not
  hidden, not closed - no object of either type existed. Eighty-eight smithing recipes, the whole bar chain and
  cooking's `range` burn bonus were unreachable for want of two `objs.push` lines, which is exactly why smithing read
  as unbuilt while the recipe table said otherwise. The owner's instinct ("we dont have craftable gear per say") was
  right and the data was misleading. **Check a thing is REACHABLE, not just defined.**

  ### #5, the design (decided with the owner, 2026-09-22)

  `kill something -> seed -> plant on your island -> crop -> feed a penned pet -> the pet levels`

  Three steps on purpose. Every extra link is where this tips into homework, and the audience is casino-first.

  **Seeds fill farming's missing middle rather than sitting beside it.** CROPS today are level 1, 5 and then 50 -
  a 45-level hole. New crops land at 10/20/30/40, and the only source is seeds:

  | Farming | Crop | Grows | Seeds from |
  |---|---|---|---|
  | 10 | Rattlebean | 20 min | Gloam / Mire |
  | 20 | Lanternroot | 40 min | Mire / Boneyard |
  | 30 | Bonegourd | 1 hr | Boneyard / Cloudreach |
  | 40 | Stormcorn | 2 hr | Thunderhead |
  | 50 | goldtomatoe | 4 hr | (already exists) |

  Seeds drop from ANY monster at about **1 in 80**, and the TIER comes from the zone, not the monster - so the zone
  you can survive gates the crops you can grow, which is combat gating farming with no level check anywhere. Islands
  have 8-12 plots, so a cycle is a real batch.

  **The pen costs you something, and that is the whole design.** One pet at a time, and a penned pet is NOT
  following you - you give up its buff for as long as it grows. Without that cost it is a slot machine you feed
  vegetables. **DECIDED: a pet can be taken out early, losing its part-fed progress** (commitment stays real without
  trapping anyone).

  **What each pet eats**, chosen so a finished pet represents a BROAD player rather than a farmer:
  Coin Toad (tickets) -> goldtomatoes, the money crop for the money pet. Pack Rat (slots) -> rattlebean in bulk, the
  cheap one everybody can do once. Bonepup (speed) -> bonegourd. Lantern Moth (hp) -> lanternroot. **House Cat
  (all-round) -> SMOKED FISH**, needing fishing + cooking + charcoal + woodcutting: the best pet and the hardest to
  raise, and the thing that pulls smoking into this loop.

  **PET LEVELS NEED A TIGHTER CAP THAN FEELS NATURAL: level 5 = 1.5x base, not 2x.** Pet stats feed straight into
  `bagMax` and `maxHpOf` with no cap of their own. At 2x the Pack Rat reaches 8 slots (a 33-slot bag with upgrades)
  and the **Coin Toad reaches +30% on every ticket drop**, stacking with a 10% meal and gear - straightforwardly
  inflationary. At 1.5x the Toad is +22%, which is still the one to watch: it is the only pet whose buff is MONEY
  rather than convenience, and it may want a lower multiplier than the other four.

  **DECIDED: no seed drops in the Tower.** The Tower deliberately pays xp and nearly nothing else; seeds would make
  it the best farming spot in the game by accident.

- **MAP-BY-MAP PASS: artwork, feel, layout (owner, 2026-09-23; not started).** Go through every scene one at a
  time and finish it as a PLACE rather than as a set of nodes — art that belongs together, a layout that reads,
  and somewhere to stand that feels like somewhere. The world was built outward fast (ten-plus areas since
  2026-09-18) and it shows: scenes were laid out to hold the right resources at the right levels, which is a
  different job from being worth walking through.

  Do it one map per sitting, and finish one before starting the next — the failure mode is half-improving
  everything. A rough order, worst-first by how many people see it: **the Yard** (the arrival scene and the busiest
  in the game, and it has grown by accretion — the north court was extended twice, the jukebox moved, the Tower
  and Crypt stairs bolted on), the **casino floor**, the **Gloam** (first zone past the start), then outward.

  What "cleanup" means, concretely, from what has already come up:
  - **Scenery that says what a place is.** The Yard has 128 tree objects of which two are choppable; that was
    fixed by giving the two their own art, and the same question ("can I use this?") applies to every object in
    every scene.
  - **Signposting.** The Run's door was invisible until it became a rope ladder somewhere people walk. The
    Wilderness ladder still has no sign. Anything you can enter should be findable without being told.
  - **Layout for crowds, not just for content.** The arrival scene is the one place launch day puts everyone at
    once, and egress is players x players in a room (see the load-test findings) — so the Yard's shape is a
    performance decision as well as a feel one.
  - **Per-area art budgets are already enforced** (`tools/eastscape-budget.mjs`, 120 KB an area, all currently
    inside) and the sheets are built per area, so new art in one scene costs only that scene.

- **CUSTOM, NON-SYNTHESIZED SOUNDS FOR EVERYTHING (owner, 2026-09-23; not started).** Replace the generated
  sounds with real recordings.

  **The architecture is already built for exactly this and needs no work.** Every sound in
  `v3/assets/js/eastscape-sfx.js` is a little synthesis recipe rendered on first play, and each entry takes an
  optional `file` (one URL) or `files` (several takes, picked at random, never the same one twice running). The
  recipe stays as the fallback if the file does not arrive, and every call site is unchanged. **Swapping a sound
  for a recording is one line.** Four already work this way — `chop` (4 takes), `mine` (5), `swing` (3) and `hit`
  (2), supplied by the owner on 2026-09-20 and normalised by `tools/eastscape-sfx-import.mjs` to mono / 22 kHz /
  trimmed / one loudness. `fish_water` is a CC0 recording. So the job is recording and importing, not coding.

  **THE ONE RULE THAT MUST SURVIVE THIS: `steady: true`.** Seventeen sounds carry it, and it encodes the owner's
  own 2026-09-21 note — "this is a semi-afk game, so it needs to be consistent and chill. just a few repeating
  sounds". Those are the ones you hear hundreds of times an hour: chopping, mining, casting, cooking, smelting,
  the anvil, picking, the bag. They are deliberately ONE take, ONE pitch and quieter than everything else. Fishing
  was already rebuilt three times over exactly this — lively multi-take recordings were tiring within a session.
  **A rich, characterful recording is the wrong answer for a steady sound and the right answer for a rare one**
  (levelup, jackpot, die, door, task_done), so record the two groups to different briefs.

  Housekeeping found in the audit (2026-09-23):
  - **`SFX_V` must be bumped when a recording is replaced** — the files are cached hard, like the art.
  - **`pickup` is defined and never played anywhere.** Either wire it to picking an item up (which currently
    plays `gain`) or delete it; do not record a sound for it first.
  - **Some triggers are regex matches on server chat text** — `mob_die` on `/^You defeat /`, `die` on `/^Oh dear,
    you are dead/`, `idle_stop` on `/^You stop .*idle/`. Rewording one of those server lines silently kills the
    sound, and nothing would fail. Worth turning into real events while touching this area.
  - 43 sounds are defined; 15 audio files exist today. The full table of what each one does is in the session
    notes for 2026-09-23.

- **MORE QUICK KEYS, AND A PLACE TO LEARN THEM (owner asked 2026-09-23 night; H shipped, the rest not built).**

  Bound today: **G** Game Room, **H** wiki (and **?**), **M** mute, **N** network/lag, **`** staff dashboard.
  **W, A, S and D are RESERVED and deliberately empty** — the dashboard was moved off `d` the same night for this
  reason. Movement is click-only now, so they are free; they are the four letters a hand rests on, and binding one
  makes WASD movement impossible later without breaking a habit somebody has already formed.

  Proposed, in order of value. The first four are side-panel tabs (`.tabs button[data-tab]`, one line each: find
  the button and click it, so the tab state and repaint stay in one place); the last two are windows people open
  without walking to anything.

  | key | opens | why it earns a letter |
  |---|---|---|
  | **I** | Inventory tab | the most-looked-at thing in the game, and checked mid-fight |
  | **E** | Equipment tab | pairs with I; where the pet and the gear live |
  | **K** | Skills tab | the MMO convention. NOT `s`, which is reserved with WASD |
  | **Q** | Quests tab | the convention everywhere else |
  | **J** | Today's jobs (`dailyWin`) | checked constantly and has no button at all |
  | **L** | Hiscores (`hsBtn`) | the only button on the bar with no key |

  **Deliberately not:** Picks, Movies & TV, the jukebox and the wardrobe (real windows, but opened occasionally —
  a key used twice a session is a letter spent for nothing); `Tab` to cycle panels (the browser owns it for focus,
  and taking it breaks keyboard navigation); and anything CONTEXTUAL — bank, anvil, shop — which would be dead
  everywhere except the one tile it works on.

  **Ship the wiki page in the same pass, not later.** Nothing here is discoverable: the only way to learn a key is
  hovering a button, and two of them have no button at all. Six more keys without a Keys page is six more secrets.

  **And then stop.** Twelve bound letters is most of the comfortable range, and this game grows a system a week —
  every letter taken now is one unavailable to whatever lands after Oct 1.

- **ACHIEVEMENTS (owner, 2026-09-23, modelled on FlatMMO's; designed here, not built).** A list of goals that does
  two jobs: teaches a new player what the game contains, and gives a long player something to chase. Own icon in the
  left-hand UI.

  **MOST OF THIS IS ALREADY BUILT, which is why it is worth doing before launch rather than after.** `emit(pl,
  type, d)` already fans out to four subscribers (counters, quests, dailies, the tour) and adding a fifth is one
  line — the Foundations note that put it there on 2026-09-18 named achievements as the reason. And `C.stats` has
  been recording since that same day: kills per mob, gathered / looted / cooked / crafted per item, burnt, deaths,
  pvp, quests, xpTotal, playMs, sessions, and casino plays since 2026-09-23.

  **So most of the list can be AWARDED RETROACTIVELY on first login.** That matters more than it sounds: the
  alternative is every existing tester opening a new panel full of zeroes for things they demonstrably did weeks
  ago. Anything that needs an event we never recorded (a first-time "you examined a player") starts from zero and
  should be a Novice one, where it costs nothing.

  ### Rewards: tickets and a score, NOT a third currency

  FlatMMO pays Sleep Points, a spendable currency. **Do not copy that.** This game has exactly two currencies and a
  deliberate wall between them; a third would need its own sinks, its own balance and its own explanation.

  | | |
  |---|---|
  | **Tickets**, per achievement, scaled by tier | immediate, already balanced, and the economy knows what to do with it |
  | **Achievement points**, a SCORE and nothing else | the collection feeling, a hiscores board and a line on the profile, with no spending to balance |
  | **Permanent buffs at POINT MILESTONES** | see below — and never per achievement |

  **Buffs must be per milestone, not per achievement, and that is the important one.** Sixty achievements each
  granting even +1% compounds into +60% of something, which is not a number anybody chose. Milestones bound it by
  construction. Use the `fx` keys the game already has (`tix`, `speed`, `rare`, `slots`, `tough`) so nothing new
  has to be plumbed, and **never a key that could touch the casino** — the standing rule is that world buffs buy
  access and action, never edge.

  A first cut, ending at roughly +2 bag slots, +7% tickets, +3% speed, +3% rare:

  | at | gives |
  |---|---|
  | 10 pts | +1 bag slot |
  | 25 pts | +2% tickets from drops |
  | 50 pts | +3% movement speed |
  | 75 pts | +3% rare drops |
  | 100 pts | +1 bag slot |
  | 150 pts | +5% tickets from drops |

  **Two things to decide before building that table.** Bag slots are Bom's business — he sells five for 50k to
  400k, so giving two away is about 150,000 tickets of his revenue, and it may be better to give something he does
  not sell. And +7% tickets is permanent inflation on every drop in the game; it sits inside the band the Coin Toad
  pet already occupies (+15%), but it is the number to watch if both stack.

  ### How many, and which

  **About 60 to start**, in five tiers, most of them generated from tables that already exist so the list grows
  with the game instead of going stale:

  | tier | how many | shape | pays |
  |---|---|---|---|
  | Novice | ~18 | one per MECHANIC: catch a fish, cook it, burn a log, smelt a bar, swing at a rock, chop a tree, plant a crop, wear a pet, reforge a piece, bank something, trade someone, play a table, run a lap, open the wiki | 250 tickets, 1 pt |
  | Skilled | ~18 | level 25 in each of the 9 skills; 100 kills; 500 gathered; a crypt cleared | 1,000 tickets, 2 pts |
  | Expert | ~14 | level 50 in each skill; 1,000 of something gathered; Tower floor 10; every crop grown | 5,000 tickets, 3 pts |
  | Master | ~8 | level 75; 5,000 kills; Tower floor 30; every area visited (13 of them) | 25,000 tickets, 5 pts |
  | Legend | ~3 | every skill 50+; total level 500; every mob in the game killed | 100,000 tickets, 10 pts |

  **The Novice tier is the whole point of the feature** and should be written last, by watching somebody play for
  ten minutes — it is the same content as the first-login tutorial that is already a launch blocker, and the two
  should be designed together rather than saying the same things twice.

  **Generate the skill tiers rather than typing them**: 9 skills x 5 levels is 45 of the 60 and it writes itself
  from `SKILLS` and `XP_AT`. Same for areas (13 scenes) and "kill one of each" (40 mobs).

  ### Telling them

  `say(pl, "...", "good")` with the `task_done` sound is what the daily tasks already do, and it is the right
  shape: one line, no window stealing focus mid-fight. A completed achievement should ALSO go to the bell on the
  site (`/api/picks/notifications` already carries game events) so it is there when they come back, and the
  Novice ones should NOT be noisy — somebody doing their first five minutes would get a dozen lines at once.
  Batch them: one line for the achievement, and hold the rest for the panel.

  ### What it costs

  The server side is a day: a `ACHIEVEMENTS` table in the rules file, `achEvent` in `emit`, a `C.ach` set of
  earned ids, a retroactive sweep in `normChar`, and the milestone buffs folded into `fxOf`. The panel is another
  day. The writing — 18 good Novice lines — is the part that cannot be rushed and is worth more than the rest.

- **PETS NEED SPACE AND SOME LIFE (owner, 2026-09-23 night: "the pets are right in the players space, almost
  attached to them, lets give them some simple animations and some spacing from the character").**

  The draw, as it stands after the NaN fix the same night:
  `spr(pv.art, p.px * T + 8 - fc * 11, p.py * T + 15 + bobOf(p.moving), fc < 0)`.
  Two things follow from that one line. The pet sits at a **fixed 11px offset** behind the facing on a 16-pixel
  tile, so it is permanently about two thirds of a tile away and never moves relative to its owner. And its only
  animation is `bobOf(p.moving)` — the OWNER's bob, so it bobs when they walk and is otherwise a static sprite.

  **The spacing fix worth doing is not a bigger number.** A fixed offset is what makes it read as attached: turn
  around and the pet teleports to your other side. A pet should **lag along the path you walked** — keep a short
  trail of the owner's recent positions (or ease the pet toward a point trailing them) so it swings out on corners
  and catches up when you stop. That buys the spacing AND most of the animation for free, with no new art, and it
  is what makes a follower read as alive in every game that has one.

  **Animation, cheapest first:** its own bob on its own phase (not the owner's) so a standing pet still breathes;
  a small hop or squash on arrival when it catches up; a flip that follows its own direction of travel rather than
  the owner's facing. Only after those is it worth generating walk frames — the five pets are single sprites
  (`pet_bonepup`, `pet_packrat`, `pet_cointoad`, `pet_lanternmoth`, `pet_housecat`, all in the `core` pack), so
  real frames mean 5 x N generations and a sheet each. The Lantern Moth should probably hover rather than walk,
  which is an argument for per-pet behaviour flags rather than one animation for all five.

  Everything here is page-only: the server sends the owner's position and the pet key, and nothing about a pet's
  position is authoritative.

- **DAILY LOG-IN BONUS (owner, 2026-09-23, with an RPG MO screenshot as the reference; not built).** A panel on
  login: "Today is your no. 2 consecutive login day", with milestone tiles — Day 2 an xp reward, Day 5 currency,
  Day 10 a mystery box — the current day marked TODAY and the rest showing "3 days remaining".

  **THERE IS ALREADY A CONSECUTIVE-DAY STREAK IN THE GAME AND THIS MUST USE IT, NOT ADD A SECOND.** The Daily
  Prize Wheel (`prizeSpin`, worker ~2512) keeps `C.spin = { day, streak }`: one spin a Chicago day, the streak
  incrementing only when the last spin was `dayBefore(day)` and resetting to 1 otherwise, worth +10% cash a day to
  a cap of 7 (`PRIZE.streakStep` / `streakMax`). Two different "days in a row" counters that can disagree — because
  one counts logins and the other counts spins — is the worst possible version of this feature, and it is the thing
  to get right before any art is drawn. Either the popup reads `C.spin.streak` and the wheel keeps owning it, or
  the streak moves out to `C.login = { day, streak }` and the wheel reads THAT; the second is cleaner, because a
  login streak should not break when somebody logs in and forgets to walk to the wheel.

  Decisions, and the first one is the real one:
  - **Is this a second daily reward, or a better front end for the one we have?** RPG MO runs both. We already give
    a wheel spin every day; a login popup that also pays turns one daily into two. Cheapest honest version: the
    popup shows the streak and the milestones, and the CLAIM is still the wheel — one reward, two surfaces, and the
    popup becomes the thing that reminds people the wheel exists.
  - **Milestones are the new part.** The wheel is per-day random; the screenshot's appeal is a KNOWN prize on a
    known day, which is what makes someone come back on day 4. Days 2/5/10 mirrored from the reference is a fine
    start; anything past ~14 punishes the audience we have (casino-first, plays in bursts around football).
  - **What it may never pay: ZCoins.** Same rule as the world boss — a daily, automatic, no-effort faucet is the
    one shape that must not touch real currency. Tickets, xp, a mystery box, a consumable.
  - Do not stack it on the login welcome popup: `welcomeOnce` already fires there, and the first-login tutorial for
    the tables (in NOT BUILT) wants that moment too. Three things competing for the first five seconds is worse
    than any one of them.

- **GOLDTOMATOE IS NOW THE WORST CROP IN THE GAME (found 2026-09-23 while shipping the four middle crops; one
  line).** At level 50 it pays ~300 tickets/hr and 3,000 xp/hr against Stormcorn's 11,250 and 7,000 at level 40 —
  for twice the wait. The top crop is strictly worse than the one ten levels below it in every dimension, which is
  the first thing anyone who reaches 50 will notice. It is pre-existing (yield [1,3] on a 4-hour timer, selling 60),
  but the four new crops are what make it visible, so it was flagged rather than quietly re-tuned with somebody
  else's content. **Fix: yield [3, 6] and VALUE.goldtomatoe 400**, which puts 20 plots at ~7,000/hr, about 13% of
  Thunderhead income and in line with the ladder. While there: wheat (1,440/hr at level 1) also pays more than
  tomatoe (1,050 at level 5), so the two original crops run backwards against each other too — both are trivial next
  to 4.7k-83k/hr from playing, so it is tidiness, not economy.

- **SELL GEAR TO BOM (owner, 2026-09-23; not built).** Gear can be bought and won but never turned back into
  tickets, so a tier you have outgrown is dead weight in the bank.

  Most of it is already there. Every piece HAS a price — `SHOP.buys.emerald_legs` is 504 — and Brutus's
  one-at-a-time `sell` op (`index.js:1286`) only checks that a price exists, so it would take gear today. What
  deliberately skips wearables is "sell all", and only as a safety rail against cashing in the set you are standing
  in. Bom Trady is a different window (`coinstatue` / `prizecase` / `cashier`, `atCounter()`), which is what the
  owner is asking for.

  **THE TRAP, AND IT IS A REAL EXPLOIT: a reforge level lives on the CHARACTER, not the item** (`c.forge = {
  onyx_sword: 3 }`, because gear is a bare string key). So selling a +3 sword and NOT clearing `c.forge.onyx_sword`
  means the next plain onyx sword you pick up is instantly +3, free. Any sell path for gear must delete the forge
  entry for that key when the LAST copy leaves the bag and the body — and "last copy" has to count the bank too, or
  banking a spare launders the level back. This is the same instancing limitation that blocks a player market; it is
  cheaper to solve here because only one direction matters.

  Decisions to make: does Bom pay the reforged value or the base value (base is simpler and cannot be farmed by
  reforging-to-sell — check the bar cost against the price before choosing, since `bars: a reforge costs what the
  piece cost` means a +3 piece has eaten 3x its own make-cost in bars); and is it one-at-a-time only, or does "sell
  all" learn a "not what I am wearing, not my best of each slot" rule. **Confirm-before-sell is not optional** on
  anything reforged.

- **THE FARMING FINISH — scoped 2026-09-23 (owner asked). Five parts; part 3 is the one that matters.**

  Farming is the only skill a player can SEE is unfinished: every island has 20 plots and clicking one says "Not
  ready yet, coming soon". What follows is what it actually takes, measured against the code rather than guessed.

  **What is already built and was a surprise.** `plant-off` in `isleUse()` is the COMPLETE working planting
  implementation — level check, inventory spend, timer, message — renamed so nothing can reach it. Turning planting
  on is renaming it back and deleting one guard (`index.js:1751`). And a growing crop is drawn PROCEDURALLY on the
  page (three stalks, height from the growth fraction, colour from a per-crop ternary at `eastscape.html:2803`), so
  new crops need NO growth art — one colour each in that ternary. The art bill for this whole piece is four 32px
  item icons.

  **A simplification the design did not have.** The backlog's #5 design has seeds as their own item class. The code
  does not need them: `plant-off` spends the CROP ITSELF (`C.inv.find(x => x.k === k)`), so you plant a wheat to
  grow 3-5 wheat. If the new crops drop from the zone's monsters directly, the existing planting code works
  unchanged and this is four new items instead of eight, with no new concept in the bag. The design intent survives
  exactly — the drop is still the gate, the zone still sets the tier, combat still gates farming with no level check
  anywhere. **Recommend dropping the crop, not a seed.**

  | part | what | why it is in this order |
  |---|---|---|
  | 0 | Rename `plant-off` -> `plant`, delete the `index.js:1751` guard | 5 minutes. **Do not ship alone** — see parts 1 and 3 |
  | 1 | Four crops at Harvesting 10/20/30/40 (Rattlebean, Lanternroot, Bonegourd, Stormcorn), one CROPS row and one item each, one colour each in the plot ternary | Without it part 0 exposes a 45-level hole: crops exist at 1, 5 and 50 |
  | 2 | Drop them ~1 in 80 from the mobs of Gloam / Mire / Boneyard / Cloudreach / Thunderhead (all five scenes exist). Drop shape is `[[key, [min,max]]]`, trivial | The gate. No seed drops in the Tower — it pays xp and nothing else by design |
  | 3 | **A SINK.** Crops sell (4 / 5 / 60) and do NOTHING else — not food, not a recipe input anywhere | See below. This is the part that decides whether farming is a skill |
  | 4 | The pet pen: feed crops, the pet levels. Designed in detail under #5 above | It IS the sink. Not polish |

  **PART 3 IS WOODCUTTING'S OLD PROBLEM, EXACTLY.** Logs were once "the one thing in the game you could only sell",
  which is why charcoal was built. Crops are that today: three items whose entire purpose is the shop counter. Ship
  parts 0-2 alone and farming becomes a slow money printer with a chore loop attached, and it will need its own
  charcoal six weeks later. The pen is what closes it, which is why part 4 is not optional.

  **AND THE CURVE IS INVERTED — check this before adding four more crops.** Keeping all 20 plots planted, net of the
  one replanted, at current yields and shop prices:

  | crop | level | grows | AFK tickets/hour | replant run every |
  |---|---|---|---|---|
  | wheat | 1 | 10 min | **1,440** | 10 min |
  | tomatoe | 5 | 20 min | 1,050 | 20 min |
  | goldtomatoe | 50 | 4 hr | **300** | 4 hr |

  Level-1 wheat out-earns the level-50 crop by nearly 5x, and does it by asking for a click every ten minutes, which
  is a chore rather than an idle. That is live the moment part 0 ships. Fix the direction while adding the four —
  longer crops must pay more per hour, not less, and nothing in the middle should want attention more often than
  about every 20 minutes. The new tiers (20 min to 2 hr) are already in the right band; wheat and tomatoe are not.

  **Not in this scope, deliberately:** pet BREEDING (named in Islands v2, never designed, and it sits on top of a pen
  that does not exist yet), and watering/disease/any second verb per plot — every extra link is where this tips into
  homework, and the audience is casino-first.

- **Instanced gear, for a player market (owner, 2026-09-22: "its crucual that the gear is sellable on the market, it
  gives people a feeling of grinding working out, upgrading and progression").** Wanted, agreed, and deliberately
  NOT bolted onto reforging. Gear is a bare string key (`c.eq.weapon = "onyx_sword"`), so reforge levels had to be
  stored per CHARACTER (`c.forge = { onyx_sword: 3 }`). That works and needs no refactor, but it means a well-rolled
  piece is a property of the player and cannot be handed over - so the market specifically requires instancing every
  item, touching the bank, the shop, trade, drops and the Exchange. Its own project, not a feature. When it lands,
  reforging should also gain a tight per-level roll (3-5%, not a flat 4%) so two +5 swords differ and there is
  something worth selling; keep the band tight so a bad roll is a shrug, and only ever re-roll by regaining a lost
  level, never as a button.

- **SCAVENGER HUNTS (owner's idea, 2026-09-22, from RPG MO; not built).** Chests appear at random spots in one scene,
  the world is told, and the first X people to reach and open them get the loot. **Most of this already exists.**
  `dropGround(S, k, n, x, y, owner, now)` spawns items into a live scene at runtime with an owner and an expiry, and
  public chat is already world-wide (one call reaches everyone online). Crucially, **"first X wins" is race-free by
  construction here**: the whole world is one Durable Object, so every open is serialised - no claim row, no
  `INSERT OR IGNORE`, none of what the site's Gold Button needed a PRIMARY KEY for. What is missing is small: a chest
  OBJECT you click (ground items are pick-ups) carrying how many opens are left, and a scene flag to place them.
  Two decisions first. **Announce the scene, not the tile** - a co-ordinate makes it a footrace won by whoever was
  already closest, whereas naming the area makes the SEARCH the game, and EastScape scenes are small enough that
  searching stays quick rather than tedious. And **it collides with the Gold Button**: the site already has a
  sitewide drop-everything-and-click-first feature, and two of them dilute each other - so either reward searching
  over speed (several chests, everyone who finds one gets something, rarity varies) or retire the button when this
  lands. Note there is no game-to-Twitch bridge in the worker, so "announced in chat" means IN-GAME chat unless one
  is built.

- **PARTY QUESTS (owner's idea, 2026-09-22, from RPG MO; not built). Blocked on viewport culling (Foundations).** Hundreds of
  static mobs in one large map; the party clears every one of them for a reward. The honest framing is that **a party
  quest is a crypt with a bigger map and hundreds of mobs instead of a boss** - `crypt.js` already has parties with
  invite/accept and shared health and location, instanced scenes (`crypt:<run id>`) with monsters swapped in,
  `S.def.shared` so a party hits the same monster, no respawn inside a run (which IS the kill-all rule, already
  handled by the crypt flag in `mobsTick`), and a clear that pays every member still in the party. So the machinery
  is built; the wire is not - see the culling item in Foundations for the numbers - 300 mobs is roughly 20x what any scene costs today, per
  player, per instance. The other gap is that **parties cap at 2-4** and a party quest is meant to be a crowd; raising
  the cap is easy, what it changes is loot splitting and the boss-health scaling already keyed to party size. Static
  mobs are the detail that makes it affordable at all - no pathfinding and no wander, so only the ones actually being
  fought cost anything.

- **The wiki never says where a crop's FIRST seed comes from** (noticed 2026-09-23, from the owner asking
  "how to get rattlebeans?"). The Harvesting tables list level, cycle, yield, xp, value and a location column
  reading e.g. "the Gloam" - which a player reads as *where the crop grows*, not *where the bean comes from*.
  Rattlebeans are actually a flat 1% rare from the five Gloam monsters (Highwayman, Bog Gnasher, Sulking
  Toadstool, Bone Idle, Goat in a Toga) and there is no seed item and no shop that sells one, so a player who
  hits Harvesting 10 and looks at the wiki has no way to learn what to do next. Planting consumes one of the
  crop item itself and a harvest returns 3-5, so ONE drop is self-sustaining for ever - which is the actually
  useful sentence and it is nowhere on the page. Fix: a "where the first one comes from" column (or a line
  under each table) for every crop above wheat, naming the monsters and the rate, plus the compounding rule
  stated once. Same gap exists for every crop the shop does not sell. Cheap: it is wiki copy only, no code.
  While in there: Rattlebean is a SIDESTEP, not an upgrade - 60 xp on a 20-minute cycle against the Harvesting-5
  tomato's 70 xp on the same cycle - and the page does not say so either.

- **THIEVING (owner, 2026-09-23; first of three new skills before launch - the others are Alchemy and Breeding,
  not yet designed). DESIGN SETTLED, BUILD STARTED.** A tenth skill, non-combat, in a new area south of the Yard.

  **Decisions the owner made** (AskUserQuestion, 2026-09-23): permit costs 50,000 tickets OR a rare tradeable
  Crypt-chest drop; drops are a NEW stolen-material line feeding NEW recipes; marks CANNOT be fought at all;
  moderate art (4 mark sprites + a door). Room 4 ALSO drops the Vault three as a second route. Thieving does NOT
  count toward the Crypt/Tower gates for now.

  **The permit** is ONE tradeable item, consumed on use, granting permanent access (a flag on the character, so a
  used permit cannot be resold). A fence in the Yard sells it at 50,000; the Crypt chest drops it rarely as a new
  line in CRYPT.loot.table. Two routes into one item means the market prices it and the 50k is the ceiling nobody
  pays - the sink and the prestige route without walling anyone out. 50k is ~18 hrs for a new player and ~1.4 hrs
  at Combat 40, measured off the skill sim.

  **The guild.** `workyard.exits` is {e: casino, n: gloam}, so `s: "guild"` was free and is where the owner wanted
  it. FIRST HARD ENTRY GATE IN THE GAME - every existing gate is soft (bandBlock stops you fighting and fishing,
  not walking in), so the door is new machinery. Four rooms behind internal doors gated on THIEVING LEVEL ONLY
  (1 / 25 / 50 / 75), no combat band - that is what makes it a real alternative path. Reuses the Crypt's
  roomOf(x) chamber trick.

  **A mark is a NODE, not a monster** - reuses the mining/fishing `act` loop rather than the combat loop. Far less
  new machinery and it makes the skill genuinely non-combat. Success is
  `min(0.90, base + 0.02 * (level - mark.lvl))`, mirroring mining. THIS IS THE ANTI-AGILITY RULE: Agility takes
  557 hours to 99 because a lap pays a flat 222 xp and nothing compounds, and the sim proved it (rate moves 12%
  across 98 levels). Failure = stunned 3-5s and you drop one stolen item; NOT a hospital bill, which is the DEATH
  table's job and is keyed to areas.

  **The stolen line hooks into REFORGING**, which already exists (forgeDo, index.js): max +3, odds 100/80/55%,
  and a failure at +2 destroys the piece 15% of the time. That is a system people already care about and it needs
  no new gear tier.

  | Room | Thieving | Stolen material | Feeds |
  |---|---|---|---|
  | 1 | 1-24 | Whetgrit | anvil: whetgrit x2 + any bar -> Temper |
  | 2 | 25-49 | Quenching salts | anvil: salts x2 + whetgrit -> Flux |
  | 3 | 50-74 | Guild seal wax | anvil: wax + flux -> Master's seal |
  | 4 | 75-99 | Blackmarket ledger + the Vault three | fence value; starfall_ore/eclipse_ore/voidglass |

  Temper: next reforge +20 points of odds. Flux: next reforge cannot DESTROY the piece (a failure downgrades).
  Master's seal: one reforge past +3 to +4 on a single piece. Every room also drops plain fence goods.

  **The xp ladder, checked against the real curve** (2.4s attempt, ~70% success = 1,050 picks/hr):
  15 / 45 / 110 / 200 xp per pick by room = 0.5 + 2.0 + 9.6 + 56.3 = **68 hours to 99**, between mining (65) and
  woodcutting (73). Ticket income targets 15-25k/hr, BELOW combat's 37k at level 40 or the guild is the farm.

  **Two economy hazards.** (1) DROPS ARE GOODS, NEVER TICKETS: thieving pays instantly with no input cost, so a
  direct ticket drop would be the best faucet in the game and undo the halving - goods mean the Cashier price is
  the lever and TIX_RATE already covers it. (2) FLUX REMOVES A SINK: the 15% break currently destroys gear and
  quietly drains the item economy, so flux must be genuinely scarce or +3 gear is everywhere in a fortnight.
  Also +4 needs a real balance pass - tspd is only 7.5% -> 10%, but forgeAddAt scales armour and weapons too and
  that was not modelled.

  **SHIPPED LIVE 2026-09-23, VERSION 199.** Built in three passes (rules, worker, client), shipped DARK behind
  `THIEF.live` first and flipped a day later. Three lessons worth more than the feature.

  **A feature switch has to push, never declare.** Three separate temporal-dead-zone crashes came from adding
  things to `SHOP.sells`, `OPEN` and `HISCORES` from the THIEVING block, which sits BELOW all three declarations.
  The last one only fired when the flag was TRUE, so it sat invisible for the whole time the skill shipped dark
  and would have taken the entire rules file down on the deploy that opened the guild. Anything a switch turns on
  must be pushed from after the thing it pushes into, and the switch must be flipped and run locally before it is
  deployed.

  **The skill sim disproved the design's own arithmetic.** Priced by hand at "attempts x 70% success" the rooms
  read 3k/8k/13k/24k tickets an hour and 68 hours to 99. The sim charges the hop to the next mark and the stun on
  a miss, and measured HALF the income and 98 hours from the identical numbers - a level-80 thief earning less
  than a level-40 miner. Retuned x1.5 on the fence and 3-5s stun down to 2-3.5s, landing at 2.3k/6.7k/11.1k/17.6k
  and 92 hours. `eastscape-thieving-test.mjs` now uses the sim's model and reads 90; two independent
  implementations agreeing is the check, and their disagreeing is what put a wrong number in the wiki.

  **No new art was needed after all.** `drawPerson` already existed for NPCs, so marks draw as people with a
  palette per room and look native from day one; the door reuses `o_roomdoor`. The "4 sprites" that were scoped
  as a blocker became optional polish - sprite hooks wait at `o_mark_<kind>`. Worth checking for an existing
  renderer before budgeting art. NOT DONE: the four mark sprites, and nobody has played it yet - every number
  above is simulated.

  **FIRST TEST ROUND, 2026-09-23 evening (VERSION 200-201).** Five things came out of the owner playing it, and
  two were real bugs rather than taste.

  **An interior scene could not show an internal wall.** `paintRoom` floors the WHOLE room rectangle, so a "v"
  tile inside a room was painted over with floorboards: it blocked you and you could not see why. No interior had
  ever had a divider in it before, so it had never shown. The owner read the symptom exactly right - "the rooms
  need to have vertical walls in between them so they feel like real rooms". Fixed generally: paintRoom now draws
  wall tiles (dark block, lit cap, shadow on the floor below) and the floor loop skips them, so any future
  interior gets dividers for free.

  **The rooms were a corridor.** Walls had a gap in them, so a level-1 thief could walk into the Quartermaster's
  room and simply fail to pick anyone - each mark's `req` stops you PICKING above your level and never stopped
  you WALKING. Each wall is solid now with a `guildgate` the server opens on Thieving level, and the test reads
  the grid and fails if any wall has a walkable tile.

  **A mark cannot move, and that is structural.** Marks are OBJECTS; object positions are built on the page and
  never sync (only their timers ride the `dyn` message), so moving one server-side changes nothing on screen.
  The life in a room therefore comes from NPCs, which are entities with steps that the server already paths -
  four of them, one per room, each carrying a `level`, which is the flag that makes an NPC wander rather than
  shuffle on the spot. Marks got a cosmetic client-side sway instead. TO DO PROPERLY: convert marks to NPCs, at
  which point they really walk and the pick has to follow a moving target the way an attack does.

  **Doors and marks are not the same ladder** (`THIEF.gates` = [10, 50, 75] against marks at 25/50/75). The first
  door opening at 10 gives a new thief somewhere to walk to fifteen levels before they can work it. The test
  allows a door BELOW its marks and fails one above them.

  **Audio**: the owner's takes became `steal` and `caught`, three each, coins and nails mixed through both. A
  lift is detected by standing among marks AND the item being something a mark carries - NOT by `mine.act`,
  which is cleared on the same tick the gain event is sent.

  Also fixed from a tester (Calvinthesneak): the House Tour's "See Bom Trady" step was hooked only to `cashout`,
  so it cleared when you completed a ticket trade rather than when you went and saw him. The note beside that
  step already said the trigger was the Prize Counter; opening it now clears it.

  **Process note.** A commit message containing "VERSION 199 -> 200." was passed to `git commit -m` with broken
  quoting, and bash read `> 200.` as a redirect and created an empty file called `200.` in the DEPLOY repo, which
  then blocked the next `git add`. Commit messages go through a heredoc (`git commit -F-`), always.

  **Scope, stated once and overruled deliberately:** permit + new material line + new recipes + a gated area +
  4 sprites is the heaviest version of every choice, x3 skills, in 8 days, with the tables tutorial still the top
  ship blocker. If it gets tight the clean seam is to ship the guild, permit, marks and fence goods first (a
  complete playable skill) and land the stolen line + recipes as the week-two drop. The ladder and rooms do not
  change either way.

- **EVERY CRYPT'S LEVEL GATE IS WELL BELOW THE LEVEL YOU CAN ACTUALLY FIGHT ITS BOSS AT** (found 2026-09-23 while
  the owner was setting up a 4-man Black Crypt test). Not a tuning nitpick: at all three stated gates, in the best
  gear that level can even wear, you are on the 10% clamp and the boss takes over an hour.

  The cause is one line - `hitChance = clamp(0.5 + (att - def) * 0.04, 0.10, 0.95)` - and the fact that a crypt
  boss's DEFENCE is far above what its gate level can roll. `attackRollOf` is `melee level + 1 + worn accuracy`,
  so below `def - 10` the clamp pins you at one swing in ten and NOTHING helps: at Combat 62 a Black Crypt party
  in full Dragonstone and a party in full Eclipse are identical, both at 10%, because even Eclipse + a +3 weapon
  only reaches a roll of 98 against defence 109. Levelling changes nothing until you cross the clamp, which is
  the worst possible shape for a player to meet - it reads as "our gear is wrong" when it is purely levels.

  | Crypt | Gate says | Boss def | Roll at the gate | Hit at the gate | REAL: beats 10% | REAL: 50% |
  |---|---|---|---|---|---|---|
  | The Crypt | melee 10 | 35 | 19 | 10% | melee 17 | melee 22 |
  | The Deep Crypt | melee 30 | 68 | 47 | 10% | melee 40 | melee 47 |
  | The Black Crypt | melee 40 | 109 | 61 | 10% | **melee 70** | melee 76 |

  The Black Crypt is the worst by far - its gate is off by about 30 levels, and note the gate was LOWERED from 50
  to 40 on 2026-09-22 ("four people each at 50 was the harshest gate in the game"), which made a real problem
  worse rather than better. The right reading of that day's complaint was probably that the crypt was
  overtuned, not that the gate was.

  **Two ways to fix it and they are not the same.** (1) Raise the gates to the levels above, which is honest but
  makes the Black Crypt a Combat 76+ activity and shuts out most of the server. (2) Bring the BOSSES' defence
  down so the advertised gate is real - Black Crypt boss def 109 -> ~75 would make melee 40 a 10%-clearing,
  melee 46 a 50% fight. (2) is probably right for a game this size, with the gate then meaning something.
  Either way the clamp is the thing to design against: a gate should never sit below `bossDef - 10 - gearAcc`.

  Also worth fixing while in there: **armour reforging does nothing against a crypt boss**, because armour carries
  defence and every crypt boss is far enough above your defence roll to sit on the 95% clamp - the Black Crypt
  boss hits you 95% of the time at any level in any gear. Only the WEAPON reforge matters (accuracy), and it is
  worth 16-20 percentage points of hit chance. Players will waste a lot of bars learning that, and nothing in the
  game says it.

  Numbers were computed straight off the live rules; the working is in the session of 2026-09-23.

- **BREEDING: what it should produce, after the owner shot down the first version** (2026-09-24). The first mock-up
  was ten pets each tied to a skill - a Slagpig for mining, an Otter for fishing, and so on. The owner's objection
  killed it and was right: "users having to switch between pets depending on which skill theyre using... this is
  supposed to be a fun, beer in hand type of game, and that seems like a lot of micromanaging". A design whose
  OPTIMAL play is tedious is a tax on everybody who cannot be bothered.

  **The existing five pets already have it right.** Bonepup is speed, Pack Rat is slots, Coin Toad is tickets,
  Lantern Moth is health - none of them is ABOUT a skill, each is about a way of playing, so there is never a
  moment when yours is the wrong one and nobody ever swaps. Differentiate pets by EFFECT (yield, speed, luck,
  carry, hardy), never by skill. It also costs far less: those ride levers that already exist (`speed`, `rare`,
  `slots`, `tough`, `hp`) instead of teaching every skill a new trick.

  **So Breeding produces two things, neither of them managed moment to moment:**
  1. BETTER pets of the kinds that already exist - a bred Pack Rat carries 6 slots, not 4. Species comes from the
     world, QUALITY comes from the pen. That is what makes a breeder worth buying from, and you still never swap
     because your pet simply got better at what it already did.
  2. MATERIALS, while you are not looking. Pairs live in a pen on the island and produce over real time the way
     crops do - hides, eggs, wool - feeding Cooking and Alchemy. Zero attention while you are playing, which is
     exactly why island farming works. This half is arguably the real skill; the pets are the prestige on top.

  **Keep ONE ACTIVE PET.** Not for balance - because the moment you can run four there is a correct set, and
  working out the correct set is the homework this game is trying not to have.

  Against the economy philosophy it would eat from Farming (feed) and Combat (rare species) and feed Cooking,
  Alchemy and every gathering skill - the first skill in the game to clear "feeds 2, eats 1" on both sides.
  Pets are already INSTANCES (`c.pets` is [{id,k,name}], `eq.pet` holds an id), so a bred pet is a real tradeable
  object with provenance and needs no new data model. Feed also gives Farming its first outlet: seven crops
  currently feed NOTHING.

## Later

- Wilderness v2: skull timer / "who attacked first", PvP hiscores, a Wilderness boss, deeper levels, a way to protect one item.
- Cottage furniture (asked 2026-09-18, not built): furniture = items with a footprint (w/h), a "home" flag and art; bought/crafted/dropped, then placed in the cottage on a grid in a "Decorate" mode (ghost preview, rotate, pick up returns it to the bag). Saved as c.home = [{k, x, y, rot}]; the server checks footprint/overlap/doorway path. Walls: a few wall slots for paintings/trophies; floors/wallpaper as themes. PixelLab ~1 generation per piece (2 if it rotates). Later: a trophy wall for Wilderness kills, a chest as extra storage.
- Islands v2: pet breeding in the pen, more themes (event themes like Gloom), island upgrades (more plots/pedestals), seeds as their own items.
- The AFK training area.
- Speed items: boots/pets/potions using the `spd` stat (the curve is in: first +20% full, rest half, cap +50%).
- Hiscores page: see Foundations (written to D1 on save, not read from the World DO).
- Sounds.
- Server hardening before other players join: per-message rate limits and sanity checks everywhere (the server already decides everything).
- Art pass, what's left: the island pen and dock, helmets as their own layer, Iron/Steel/Champion outfits (pro + hero style id), a way to get the Bronze cuirass (Forge store), Halloween event art.
- Legendary gear (shown on Crixus, level 91 bot, art "legend_*"; not real yet): black obsidian plate with gold trim and crimson runes, gold winged crested helm, red cape, glowing gold greatsword. Make it the top tier (after Champion) so new players see what they're working towards; RPG MO sets (7 Souls, Abyss Plate) were the inspiration.
- More enterable buildings (Fisher's hut, the Forge, the Big Tomatoe).

## Foundations (build early, so content and systems are easy later; listed 2026-09-18, most important first)

- [x] **Per-character stat counters**: kills per mob, items gathered per item, deaths, xp per day, time played, Cash earned and spent. Can't be backfilled, and it feeds hiscores, achievements, the collection log and an EastScape Wrapped. Do first. **Done 2026-09-18. C.stats: kills, gathered, looted, cooked, crafted, burnt, deaths, pvpKills/Deaths, questsDone, cashIn/Out, xpTotal, xpDay (60 days), playMs, sessions, firstSeen/lastSeen. Admin `stats`. Cash and time are MEASURED in accrue(), not hooked, so no future shop can forget to report.**
- [x] **One event hook**: every gather / kill / cook / craft / quest step calls one `emit(pl, type, data)`; quests, achievements, daily tasks, counters and hiscores subscribe there instead of each skill being wired to each system. **Done 2026-09-18. emit(pl, type, data) in the worker; countEvent and questEvent subscribe. Types: kill, gather, loot, cook, burn, craft, xp, death, pvpkill, quest. Add a subscriber in emit(), never a new call site in a skill.**
- [x] **Save format version + item renames**: `C.v` plus ordered migration steps in `normChar`, and an `ITEM_ALIASES` map (old key → new), so dropping Roman names or restructuring items never breaks a save. (The stacks-of-99 re-pack was an ad-hoc version of this.) **Done 2026-09-18. SAVE_V derives from MIGRATIONS.length so it cannot drift; ITEM_ALIASES followed BEFORE the ITEMS filter (without it a rename silently empties every bag); aliases chain and cannot loop; a throwing migration keeps the character. scratchpad/eastscape-savetest.mjs.**
- [ ] **Hiscores**: on character save, write levels/xp to D1 (the site's database), not the game server; leaderboards page plus EastScape levels on `/u/` profiles at no cost to the world.
- [ ] **One recipe table**: generalise `COOK` into `RECIPES` (skill, inputs, output, lvl, xp, fail chance, station) so Smithing, Crafting, etc. are data, not new code.
- [ ] **Item instance data**: decide whether a stack can carry an optional `d` (charges, wear, crafter name, enchant); such items never stack. Hard to retrofit.
- [ ] **Scheduled world events**: `EVENTS` with start/end dates that switch scene overrides, mobs, drops and NPC lines on and off. The Halloween event should be data, flipped by date.
- [x] **Content check before deploy**: a script asserting every drop, shop row, recipe and quest item is a real item with art, every mob has a size and art, every exit leads somewhere. **Done 2026-09-18. tools/eastscape-content-check.mjs — items, drops, shop, recipes, crops, quests, givers, exits, art files, dead inventory. Reads the page's own ART_FILES/ITEM_ART/NPC_ART so the manifests cannot drift from the files. Currently 0 errors.**
- [x] **Monitoring**: players online, messages/sec and tick time, sampled every few minutes to D1 and shown on the site dashboard (`/where` already reports the data centre and player count). **Done 2026-09-18. Worker /stats (tick p50/p95/max against the 50ms budget, online, peak, busiest scenes, bytes/s, offers) → /api/eastscape/health samples it every 5 min into ops_status with 4 hours of history → an "EastScape world" card on the dashboard. A world that did not answer is recorded as down rather than as a gap.**
- [ ] **Viewport culling in `snapOf`** (sized 2026-09-22; PREREQUISITE for party quests and any large map). A snapshot
  serialises EVERY mob, npc, bot and ground item in the scene, ten times a second (`SNAP_EVERY = 2`), with no culling
  and no diffing. It is invisible today only because scenes are small: a resting mob trims to 49 bytes on the wire, so
  8-20 mobs is 4-10 KB/s per player. It does not stay invisible - 150 mobs is 72 KB/s per player, 300 is 144 KB/s, 600
  is 287 KB/s, and that is PER INSTANCE, so three parties of four in a 300-mob map is 1.7 MB/s out of one DO. CPU is
  not the problem and should not be chased: 300 mobs is 6,000 loop iterations a second and tick p99 currently measures
  0 ms against the 50 ms budget. Send only what is within N tiles of each viewer, which means the snapshot becomes
  per-player rather than per-scene (today `snapOf` builds one string and every socket in the scene gets it) - so either
  build one per player, or bucket by region and build one per bucket. The cheaper trick for static mobs alone is to
  send the roster on entry and only deltas after, but culling is worth more because it unlocks bigger maps EVERYWHERE
  and stops one busy scene bounding the world. Do this before either feature below, not as part of them.
- [ ] **Keep scenes separable**: no scene reaching into another's state directly (go through player transfer / chat / trade / Exchange), so the world can later be split across several Durable Objects if one isn't enough.
- [ ] Message rate limits per connection, and an economy log (Cash in/out by source) to tune money sinks.
- [ ] Generic action registry: turn the skilling if-chain in `doAction` into kind → { reach, requirement, tick, result }.

## Findings from the load test (2026-09-18)

**The tick is a non-issue. Bandwidth is the ceiling.** 200 players across six
scenes: p95 tick 0.6ms against a 50ms budget, 98.7% headroom, zero ticks over.
CPU is not what will break on launch day.

**What will is egress, and it is quadratic.** `snapOf()` builds one snapshot per
scene — good, that part is right — but the snapshot contains every player in the
scene and goes to every player in the scene, ten times a second. So the cost is
players × players. Measured, all in one scene:

| in the scene | per player, down |
|---|---|
| 10 | 31 KB/s |
| 20 | 55 KB/s |
| 40 | 102 KB/s |
| 80 | 197 KB/s |

At 80 in one room that is 1.6 Mbit/s **per player** and 15.8 MB/s out of one
Durable Object. Launch day is exactly the shape that hits this: everyone in the
Forum at once.

**Fixed 2026-09-18 — the snapshot/roster split.** The parts that do not change
every tick (name, total level, weapon, body, max hp; and a bot's name, level,
art and hue) now go out as a `who` roster, and only when they actually change —
somebody arriving, leaving, equipping something or levelling. The snapshot keeps
position and combat state, and drops every falsy field rather than spending bytes
on `"act":null,"ob":null,"started":false`. The page keeps the last roster it saw
and merges; a record with no roster entry still draws, as a placeholder, so a
dropped message is a wrong name for one tick rather than a missing player.
`VERSION` 19 → 20 so open tabs reload onto the new protocol.

Measured, same test as above, per player, down:

| in the scene | before | after | |
|---|---|---|---|
| 10 | 31.2 KB/s | 16.7 KB/s | 1.9× |
| 20 | 54.9 KB/s | 27.4 KB/s | 2.0× |
| 40 | 102.1 KB/s | 47.7 KB/s | 2.1× |
| 80 | 197.3 KB/s | 90.8 KB/s | 2.2× |

200 players across six scenes: 17.6 MB/s out of the world, down to 8.4 MB/s.
Tick time unchanged within noise (p95 0.6ms → 0.7ms of a 50ms budget) — building
the roster signature every broadcast costs far less than sending it.

**It is still quadratic.** This halved the constant; it did not change the shape.
80 in one room is still ~0.7 Mbit/s each. Changing the shape needs interest
management — only sending players within a few tiles — which is a bigger job and
is not needed at this community's size. Revisit it if a room ever holds 100.

## Findings from the security pass (2026-09-18)

Nothing exploitable found. The money paths are built the right way round and it
is worth writing down why, so a later change does not undo it:

- **The server decides everything.** `startAct` looks targets up in its own
  scene and pathfinds the reach itself; the page only ever sends an id.
- **Trades simulate both sides before committing either** (`tradeFinish`), so
  the classic "offer it, drop it, accept" duplication has nowhere to land.
- **Quantities are clamped against what the player actually has**, in the shop,
  the bank and the Exchange, and prices come from the server's own table.
- **Tickets are 32 random bytes, live 60 seconds and work once** (the row is
  deleted as it is read), so one cannot be shared or replayed.
- **Admin is decided at ticket time from the site's list**, never from anything
  the page sends, and `onMessage` refuses the whole admin branch without it.
- Forty messages a second per connection, dropped above that.

Three things to close. **(1) and the `workers.dev` note below are DONE** — `/kick?id=` exists on the worker and
the ban endpoint calls it, and `ticket.js` points at `play.eastcoin.vip`. **(2) is still open and needs the
owner's call.** (3) is still open and still minor.

1. ~~**A ban does not kick a live session.**~~ **DONE.** `getSessionUser` returns null for a
   banned id, so a banned player cannot get a new ticket — but the game holds an
   open socket, and nothing re-checks. Ban someone mid-session and they keep
   playing until they close the tab. Needs a key-guarded `/kick?id=` on the
   worker, called from the ban endpoint.
2. **The game's admin list is `bootypaper` only** (`EASTSCAPE_ADMINS` in
   `_tickets.js`), deliberately, while it was being built. Before launch, decide
   whether zwades and andyreidisapawg should have it — it is a different list
   from the site's `ADMIN_ALLOWLIST` on purpose.
3. **`admin` is fixed for the session.** De-admin someone and they keep the
   panel until they reconnect. Minor, but it is the same shape as (1).

Also noted: `ticket.js` hardcodes `wss://eastcoin-eastscape.jake-7f5.workers.dev/ws`.
That is the `*.workers.dev` address the custom-domain checklist item is about —
this is the one line that changes when `play.eastcoin.vip` exists.

## Findings from the economy check (2026-09-18)

**No money printer.** The shop buys everything back for less than it sells it
(checked automatically now, in the content check), the Exchange takes 1%, and
Cash here is the game's own currency — it cannot touch ZCoins.

**But two loops run forever with nobody at the keyboard**, because neither
clears `pl.act` on success and neither target depletes:

| loop | cycle | success | per hour | sells for | Cash/hr |
|---|---|---|---|---|---|
| the Copper vein (Ludus Farm) | 6s | 55% | ~330 copper | 6 | **~1,980** |
| any fishing spot | 2.6s | 45% | ~620 fish | 3–9 cooked | **~1,900–5,600** |

Everything else stops on its own: rocks empty for 8s, trees fall, olives go
bare after four picks, wheat regrows. The vein is explicitly "slow, but it never
runs dry", so the AFK part may well be deliberate — the question is the rate.

**Against the sinks:**

| sink | cost | AFK hours |
|---|---|---|
| full bronze set (sword, helm, shield, cuirass) | 1,350 | ~0.7 |
| Bigger island | 5,000 | ~2.5 |
| The Far Shore | 20,000 | ~10 |

So the entire shop is cleared in about forty minutes of not playing. With ~30
players that means the economy is solved in week one and the Exchange has
nothing left to be for. Three ways out, cheapest first:

1. **Stop an action after N cycles with no input** ("You stop fishing.") — about
   five lines, kills both loops at once, and it is what every other game does.
   Does not contradict the vein's flavour: it still never runs dry, you just
   have to be there.
2. **Cut the sell prices** of copper and sardine. One line, but it makes early
   money feel worse for players who are actually present.
3. **Leave it and raise the sinks.** Fits the "AFK training area" already in
   Later — but then gear needs to cost a lot more than 1,350.

My read: (1), and it is worth doing before launch rather than after, because
taking an income away from players who have got used to it is much worse than
never having offered it.

**DONE (2026-09-18 evening): option (1) shipped as AFK auto-stop** — `AFK_MS`,
three idle minutes, which closes both loops. The rate question behind it was
re-opened and re-measured on 2026-09-23 with tools/eastscape-grind-sim.mjs, which
is now the authority on income per hour: 4.7k tickets/hr at level 1 rising to 83k
at level 50. Use that, not the Cash/hr table above, which predates tickets.

## Findings from the phone and new-player pass (2026-09-18, static — still needs a real device)

- **The canvas letterboxes correctly.** `fit()` uses `Math.min(w/W, h/H)` and
  centres, so nothing stretches on a phone. That was the thing most likely to
  be wrong and it is not.
- **Tiles land around 18 CSS px on a 390px-wide phone** (the stage is 60vh
  under 820px). That is well under the ~44px a finger wants, so tapping one
  specific tile, or a small mob, will be fiddly. Not broken; worth trying
  before deciding it is fine.
- **The wiki has no navigation on a phone**: `@media (max-width:620px)` sets
  `.wiki nav { display: none }` with nothing replacing it, so a phone can open
  the wiki and then not move around it. A real bug, and cheap to fix.
- **There are three quests in the whole game** — Firewood, Cattle Drive and
  Catch of the Day, two of them from the same NPC on the starting farm.
  **(2026-09-23: five now — `scrapline` and `theking` were added — but the point
  stands and this is still the largest content gap before launch.)** The
  first ten minutes are fine; the second thirty have no thread to follow. This
  is the biggest content gap before Oct 1 and it is not on any checklist line
  yet.

## Drop and rate pass (asked for 2026-09-18, DEFERRED by the user)

Current tier drop rates are the first guess, not a tuned economy:

| monster | lvl | tier | any piece / kill | per piece | kills for one named piece |
|---|---|---|---|---|---|
| Gnasher | 18 | Emerald | 4.0% | 0.40% | ~250 |
| Tax Wraith | 28 | Emerald | 8.0% | 0.80% | ~125 |
| Tax Wraith | 28 | Diamond | 2.0% | 0.20% | ~500 |
| Chandelier Spider | 34 | Diamond | 8.0% | 0.80% | ~125 |
| Chandelier Spider | 34 | Dragonstone | 1.5% | 0.15% | ~667 |
| Revenant | 45 | Dragonstone | 10.0% | 1.00% | ~100 |
| Revenant | 45 | Onyx | 2.0% | 0.20% | ~500 |

The user wants these **much smaller**, so that Smithing and the Exchange are the
normal route and a drop is luck rather than the plan. Roughly 5x down was the
number discussed: ~625 kills for a named piece, ~1,830 for a full set.

**Do this AFTER Smithing has been played, not before.** Rare drops with no
crafting route and a thin Exchange makes the whole ladder decorative. Smithing
shipped 2026-09-18 but nobody has used it yet; tune the drops once there is a
real sense of how long a bar actually takes to get.

Also worth revisiting in the same pass: monster levels stop at 45 (Revenant) but
gear now gates to 50, so Onyx has nothing to be worn against.

## Art pipeline: BLOCKED on egress (2026-09-18)

PixelLab is connected and generating correctly — four Emerald test pieces came
out matching the existing icons (32x32, thick dark outline, flat shading). But
**neither the cloud container nor the desktop VM can download the results**:
`api.pixellab.ai` is not on the account's egress allowlist, and both get
`CONNECT tunnel failed, response 403`. The workbench tools work in ids, never
files, so there is no way round it from here.

So art is currently: Claude generates, the user downloads by hand. Adding
`api.pixellab.ai` to the egress allowlist would make it one step — generate all
sixty pieces and write them straight into `v3/assets/img/glad/flat/items/`.

Test pieces already made (permanent on the PixelLab account):
- emerald longsword `c7c4c38d-7f17-4b78-8fff-98c48504fb15`
- emerald cuirass `008d7e82-65a4-4aa5-9f6d-c9346b6afc9c`
- emerald amulet `741da8cc-b1da-4856-aea0-52295c3b7881`
- emerald bar `df4ec558-c113-4e67-a758-bf608e665fbb`

The recipe that worked, for the other 56: `create_map_object`, 32x32, view
`side`, `single color outline`, `flat shading`, `low detail`, description
"<tier colour> metal <piece>, single game item icon on empty background, thick
dark outline, flat shading".

## Pre-launch checklist (before ~Oct 1)

- [x] **Load test**: a script connecting 50–100 fake players (walking, fighting, chatting) against wrangler dev, then prod; measure tick time and CPU; fix whatever breaks first. **Tooling done 2026-09-18, and it found something — see Findings below. scratchpad/eastscape-loadtest.mjs (the world's tick, runs anywhere) and tools/eastscape-loadtest-ws.mjs (real sockets, needs wrangler dev). Still to do: run the socket half against prod.**
- [x] **Backups**: nightly copy of every `char:*`, the Exchange and islands from DO storage to the site's R2 `BACKUPS` bucket, plus a tested restore path. **Done 2026-09-18. Nightly at 09:20 UTC via the picks cron (NOT 09:00 — the D1 backup owns that minute). Worker /export saves everyone then dumps; /api/eastscape/backup gzips to R2 eastscape/world/, prunes at 30 days, notes eastscape:backup:last. Restore refuses while anyone is connected and is a dry run without --apply.**
- [x] **Graceful restarts**: an admin "server restarting in N minutes" broadcast, save everyone before deploy, client auto-reconnects quietly (a worker deploy drops every connection). Freeze deploys during launch hours unless urgent. **Done 2026-09-18. planRestart() counts down (10/5/2/1min, 30s, 10s), saveAll() writes every character and the Exchange, then close 4001 and the page waits out the deploy instead of racing it. Admin `restart <secs>` / `restart cancel`, or POST /restart?in=120 with X-Escape-Key before a deploy.**
- [x] **Sprite sheets.** **DONE and live** (verified 2026-09-23 against production): `tools/eastscape-pack.mjs`
      builds 58 sheets holding 675 pictures — `core` (154), 30 `area-*` packs, 27 `f-*` character packs — and
      `packs.json` maps every art key to its sheet and rectangle. `loadArt()` prefers the sheet and falls back to
      the single file, so a stale or missing sheet degrades instead of breaking.
      **`startupFiles: 160` in the budget tool is NOT a live request count** — it is deliberately the number a
      player would fetch *without* the sheets, kept as the worst case, and the tool separately fails if the sheets
      are stale. Do not read 154/160 as "at the ceiling"; the real startup is packs.json plus a handful of sheets.
- [x] **Custom domain for the game server.** **DONE** — `ticket.js` serves `wss://play.eastcoin.vip/ws`; the `*.workers.dev` hardcode noted in the security pass is gone with it.
- [x] Monitoring live (see Foundations) and watched on launch day. **Built; needs ESCAPE_WORKER_URL set to go live.**
- [x] Content check script passing; every item, mob and NPC has art; no placeholder text. **Script passing 2026-09-18, 0 errors. Art and text still want a human pass.**
- [ ] Wiki pass: guides for every skill, area, and the Halloween event; Updates log current.
- [ ] Mobile/tablet check: layout, touch to move, inventory and windows usable at phone width.
- [ ] New-player flow: first 10 minutes tried by someone fresh (tutorial hints, Waldy/Tom quests, where to go next).
- [x] Economy sanity: starting Cash, shop prices, Exchange tax, drop rates; nothing that mints Cash endlessly. **Measured 2026-09-18 — see Findings. No money printer, but two AFK faucets at ~2,000 Cash/hr against a 1,350 Cash full gear set.**
- [x] Security pass: tickets expire, admin commands only for the admin list, no client-trusted values (positions, damage, prices), bans respected. **Audited 2026-09-18 — see Findings. Nothing exploitable found in the money paths; two gaps worth closing (a ban does not kick a live session; the game's admin list is bootypaper only).**
- [x] ~~Halloween event built and switched on by date.~~ **NOT A LAUNCH ITEM** — the event was paused on 2026-09-18 to run mid-October, so it is off the Oct 1 critical path by decision, not by slippage.
- [ ] Announcement ready (site notice via the bell, not chat) and a known-issues list for day one.

## Done

- 2026-09-18: server + continuous saving, admin panel, settings, chat, bank, Exchange, trades, wiki, right-click info, interiors (Bank, Farmhouse), speed system, Forum north and east gates, Tomatoe Hill, Via Appia, the Wilderness v1 (Cage, Deep Wild, 25% worn-item drop on death, 60s killer loot, 10s logout linger, aggressive mobs, Wilderness gear incl. Eight-league boots spd 6; PixelLab art for ground/foliage/ores/mobs), PixelLab art pass overnight (48 item icons, skill + empty-slot icons, window/button/slot frames, 6 more mobs, 7 NPCs with dialog portraits, 29 scenery objects), player islands v1 + upgrades (Bigger island 5k, Far Shore 20k) + the cottage interior (Charon at River Bend, 8 real-time plots, 6 pedestals, themes, visitors, open/closed).
- 2026-09-18: Cooking (range, hearth, campfire; burning; 7 cooked foods), eating from the bag, Brutus's Forge in the Forum (tools + Bronze set, buys gathered goods), level requirements on gear, bag stacks capped at 99 (Cash exempt via `nocap`; old saves re-packed, overflow to the bank), roomier inventory scroll (352px column).
- 2026-09-18 (evening): AFK auto-stop (3 idle minutes, `AFK_MS`), icons for all 60 tier pieces + bars (grey bases recoloured per tier), Attack/Strength/Defence/Smithing skill icons, empty-slot outlines restored (+ amulet), stance icons, inventory Sort (server-side, merges part-stacks), right-click any item → its wiki page, xp tracker "level N in X min", rare drops shown as "1 in N", bans kick live sessions (`/kick`), phone wiki nav strip, game server on `play.eastcoin.vip`, tier outfits on the character (one steel base recoloured, lazy-loaded), furnace/anvil/palm art, **the Gloam** (west of the Grove, 20–38: emerald + diamond ore, gloomwillow, lanternfish) and **Cloudreach** (north of Tomatoe Hill, 40–55: dragonstone + onyx ore, skyash, sky eel), themed ground sheets (`GROUNDS`), tier ores now the smelting route (`SMELT`).

## Waiting on the user (2026-09-18)

- **Sizes for the six new mobs** before their art is drawn (they are placeholder blobs until then). Proposed: Lantern Moth S, Sorry Ghoul M, The Understudy L, Cumulus Ram M, Angel of Minor Inconvenience M, Thunder Goose L.
- `ESCAPE_WORKER_URL` / `ESCAPE_KEY` on the Pages project still read as unset by production (health check says NOT_CONFIGURED); backups and the dashboard card wait on it.

## Halloween art already made (in `v3/assets/img/glad/flat/event/`, not deployed)

moonshell, tinymoon, pumpkinhead, chattyhat, cowardsword (face barely reads), teeth, moongoo, candybucket, candy, pumpkinseed (came out as a tiny pumpkin — redo), cowsuit, ghostsheet, scarecrowsuit, pumpkin_1/2/3 growth, pumpkin_teeth, pumpkin_cube (not actually cubic — redo), moon (96px), house (160x128, the house that wasn't there). Still to make: the costume outfits ON the character (cow, ghost, scarecrow) — recolour/pro like the tier outfits.
- 2026-09-18 (night): **the Casino** replaces the Forge building (Forum door → `casino` interior, casino carpet floor, bar, sofas, Dex the Dealer). Placeholder games, server-rolled, Cash only (never ZCoins): Slots (`REELS`, ~96.9% back, top 500×), Coin Flip (1.95×), Dice (roll under 5–95, 97%). Bets 1–500 from the bag (`CASINO`); wins ≥5× announced to the room, ≥25× to everyone. **Daily tasks** on the board inside (`DAILY` pool, 3 per player per Chicago day by `dailyFor`, counted through the event hook, claimed at the board). Also: two-sided market (auto-deliver to bank, chat alerts), first-hit monster claims (`CLAIM_MS`), respawn shared by fighters (`RESPAWN`).

## Casino — next iterations (ideas)
- DONE 2026-09-20 (VERSIONS 40-45), in the order the owner asked:
  - Fewer ropes (short runs either side of each way in), casino clutter: stools (`soft`: walkable), soda/snack machines, water cooler, bins, planters, SMOKING SECTION NE corner (`def.smoke` haze), litter (`flat` + `soft`), mop bucket, coat racks, a suitcase. Closed-area scenery moved to lazy list `closed` (login 127-137 files).
  - Bag is 20 slots (`INV_MAX`; normChar sends overflow to the bank). Under it the WALLET card: cash, bag's worth, jackpot, thirst/hunger, today's jobs with progress (`me.daily`, `me.jack` now ride in meOf), what-next. Top right is a BUFFS bar (`BUFFS`/`buffsOf` in the shared file; one buff today, built for many).
  - HUNGER AND THIRST (`NEEDS`): every bet costs 2 thirst / 1.25 hunger; under 20 the tables refuse (`tooEmpty`, `spendNeeds` in the worker; bet(), run start, roulette, fights). Cooler + BUFFET on the card room's back wall give 20 a click, free; cooked food gives 25 hunger.
  - THE HOUSE RUBY cashes in loot (kind `cashier`; its ropes are gone). It is ALSO meant to become the Cash -> ZCoin / free-ticket exchange: STILL TO BUILD (owner: "add both for now and we will reiterate later"). `functions/api/eastscape/exchange.js` (raw ZCoins, 25/hour) is written, NOT deployed; tickets not started.
  - THE FIGHT PIT: second walldoor on the casino's back wall (x 10), `def.doorSigns` letters FIGHTING over it. Scene `fightpit`, one fight for the room on a clock like roulette (`FIGHTS`, `fightOdds`; worker `fightState/fightOp/fightTick/fightPay/fightRefundAll`; paid when the fight ENDS, ticks even when empty). Page plays the server's script in the pit; betting window is `CZ.fight`.
  - Room names on the carpet (`def.zones`) removed at the owner's request; the page can still draw them.
- BALANCE NUMBERS the owner asked for (level 1, starter gear): chicken 7.7s a kill (~$21, $163/min), cow 19s ($91/min), rotten 25s ($26/min!), hornworm 45s, boar 52s, highwayman 94s; ore 4.3s, log 5.4s, fish 5.8s each $10 ($104-140/min). Everything past cows pays WORSE per minute than chopping a tree. OPEN: rebalance mob values, and give fighting/skilling/crafting each a unique benefit (owner's ask, proposals given, not built).
- DONE 2026-09-20 (VERSION 39): THE FLOOR IN ROPED ROOMS, one kind of game per room (owner: "put games together, as in sections, just like a real casino... rope them off"). NW SLOTS (3 banks x 2 deep x 5 + wall = 33), SW WHEELS | COIN FLIP, NE CARD ROOM | THE BAR, SE DICE PIT | INSTANT WINS (2 Plinko, 2 Mines, 2 Scratch). `rope(x1,y1,x2,y2)` in the casino build blocks the whole line, drops a post every 2 tiles and a `ropeline` marker the page draws as a sagging red rope (sorted just behind the posts). `def.zones` = gold-lettered names on the carpet at each way in. Aisles: x19-23 door to door, rows 12-14 arch to arch, a Cashier at each end, the Ruby roped in the middle. This replaced the looser "neighbourhoods" floor from earlier the same day.
- DONE 2026-09-20 (VERSION 38): three more maps. SKILLING line west: Workyard -> the Gloam (lvl 15: emerald $15, gloomwillow $15, lanternfish $16, diamond $22 at Mining 25) -> Cloudreach (lvl 30: dragonstone $30, skyash $28, sky eel $30, onyx $40 at Mining 40). No mobs on that line. FIGHT line east: Paddock -> the Rough -> the Boneyard (`dark: true`, the Wilderness look without PvP: gnasher, moth, ghoul, taxwraith, chandelier, the Understudy). Crafting is still only the Forum. Value curve kept gentle on purpose (tables top out at $500 a bet). wild()'s border objects carry `edge: true` so the treeline isn't covered in price tags. Rams/angels/geese have no home right now (lazy list `sky`).
- PARKED 2026-09-20: Cash -> ZCoin. `functions/api/eastscape/exchange.js` is WRITTEN BUT NOT DEPLOYED (100:1, 25 ZC per rolling hour, cap counted from wallet_operations, idempotent per exchange id, definite vs unknown refusals). Owner says zwades has agreed, then asked whether Cash should buy casino SPINS instead ("just wondering"). Recommendation given: free Scratch-Off cards as the prize (one game, decided at buy, mark rows free so the book stays right). Nothing on the worker or the page yet; the ATM in the casino is still "out of order".
- DONE 2026-09-20 (VERSION 37), the owner's "go broke, go get more" pass:
  - ONE PRICE LIST: `VALUE` in the shared file ($10 a log/ore/sardine; mob loot priced too). Anything MADE is worth 2x its inputs, computed from `RECIPES` (bar $40, sword $160, body $400, cooked fish $20), never hand-priced, and clamped under what Brutus sells it for. `valueOf`, `nodeValue(ob)`, `mobValue(t)`, `isLoot(k)`. Brutus pays the same.
  - The page writes the price over every rock, tree, fishing spot and wheat tile, "~$N" under monster names, and "pays 2x" over the furnace, anvil and range. `fmtCash` is `$1,234` everywhere now.
  - THE CASHIER (`t:"cashier"`, art `o_cashier`), a window by each arch in the casino: `cashout` op, "Cash in the lot" sells loot and made things, never tools, charms or wearables (those sell one at a time).
  - Tools work from the bag (no wielding). A cooking range in the Forum, so it is the one crafting map.
  - Maps are now: casino (+roulette), Forum (+bank) = crafting, Workyard = skilling, Paddock + THE ROUGH = fighting (hornworm, boar, highwayman, 2 gnashers; lazy art list `rough`).
  - CASINO FLOOR IN SECTIONS (owner: "the entrance is severely overcrowded... wandering around a casino"): Slots Alley west, Coin Corner, the Ruby, Card Pit east, Bar north-east, Drop Zone south-east; two clear aisles; the entrance is empty.
  - THE TABLES REBUILT in the look of eastcoin.vip/?view=casino: `v3/assets/js/eastscape-casino.js` (`createCasino(env)`), dark table, phase line, one gold button, "What it pays" + "This sitting" cards. Built once per open and updated in place. The old parchment game UI was deleted from the page. `window.__es.CZ.open("mines")` opens a table for testing.
- Still to do for "eventually real EastCoin": the ZCoin decision itself (needs zwades), server seeds/commit-reveal like the site (GAMBA's rolls are Math.random today), per-hour limits, and the site's exact payout tables if the two should match.
- DONE 2026-09-19 (VERSION 35): the site's casino games as CASH games round the arrival rug: Wheel, Higher or Lower, Mines, Plinko, Scratch-Off (+ a Coin Flip table there). Rules in the shared file (`WHEEL`, `HILO`, `MINES`, `PLINKO`, `SCRATCH`), all ~97% before luck. Wheel/Plinko/Scratch go through `bet()`; Hi-Lo and Mines are RUNS (`run()` in the worker, state in `C.runs`, survives close/walk-away/restart; bombs and next card never sent until it's over). UI art in `flat/casino/` (cards, suits, tile, gem, bomb, ball, foil). No ZCoins touched: the ZCoin room is still phase 2 and needs zwades's OK.
- NOT ported: The Grind (GAMBA's version is the task board + skilling) and Russian Roulette PvP (belongs with the PvP parlour).
- DONE 2026-09-19 (VERSION 34): the floor is furnished and moves. Decor only: House Ruby + velvet ropes, 2 poker and 3 blackjack tables ("opening soon" in the name), prize wheel, cocktail tables, jukebox, piano, broken cash machine, neon JACKPOT sign, two paintings. `casinoLife()` in the page draws the motion (spotlights, lamp glow, neon buzz, slot bulbs, wheel chase lights, jukebox notes, ruby glints); all off under Reduced motion. Regulars: Parlay Pete, Nana Jackpot, Rent Money Randy, Whale Wendell (talk only). Three patron bots walk to slots/coin/dice (worker job filter) with casino chatter (`CASINO_LINES`).
- The "opening soon" furniture is the to-do list: blackjack, poker (PvP, needs the ZCoin/Cash decision), the prize wheel (a daily free spin is the obvious use), the jukebox (music lounge hook).
- Closed areas' art (farm/river/grove/tomato/appia/farmhouse NPCs and mobs) moved to lazy `AREA_ART` lists: startup went 156 files / 227 KB -> 149 files / 196 KB even with 20 new casino files.

- Proper animations/art per game (a slot machine window with reel strips, a flipping coin sprite, dice sprites), sound.
- A shared-table game so the room plays TOGETHER: a round-based roulette/wheel everyone bets into on a 20s clock (the social piece), with who-bet-what shown on the table.
- A jackpot pot fed by a slice of every slots spin, paid on three sevens (announced to the world).
- Casino stats on hiscores / Wrapped (biggest win, total wagered) — the counters already see Cash in/out.
- Daily tasks: a weekly bonus for doing all three N days in a row; more pool entries as content lands.

## Casino-first ideas (ideation 2026-09-18, NOT scheduled — let launch data decide)

**A. Casino-first EastScape (Cash).** Keep "the main thing the main thing": the casino is the hub, the world exists to fund and improve your gambling. Loop: play → go broke / want an edge → skill, fight, do daily tasks → come back. Buffs are CONSUMABLE charms crafted from skills or dropped by mobs (clover +1.5% slots return for 50 spins, dice polish, a free re-spin, jackpot share counts double) and may only SHRINK the house edge (96.5% → ~99.5% max), never flip it, or the casino becomes a Cash printer. Progress gates access (high-roller room, VIP lounge, bigger limits). Player-vs-player games (dice duels, poker-lite) are zero-sum so economy-safe. Needs Cash to MEAN something: prestige sinks, casino hiscores (the stat counters can feed them), visible wins. Cheap test before any pivot: 1–2 charms + a casino hiscore board, then read week-one stats. Hard line: Cash is never purchasable or convertible to ZCoins.

**B. The ZCoin room (phase 2, needs zwades's blessing first).** The site's real casino "with a body": physical tables in EastScape whose windows call the EXISTING `/api/casino/*` endpoints (same 20 ZC cap, 10 plays/hr/game, HOUR_WIN_CAP, provably-fair seeds, idempotent wallet ops). The game server never holds or moves ZCoins. Two currencies with a wall: no Cash↔ZCoin conversion in either direction, ever (or AFK fishing prints ZCoins). Every play stays at the site's 96–104% band with mean 100%, so world buffs can NEVER touch odds — they buy access and action, not edge (see the fair-buff list below). The Grind becomes embodied: broke players (under 50 ZC) do a server-counted job in the world for the same 10 ZC/hour. Risks: exploit surface now matters (bots, multi-accounts), Twitch gambling-policy optics if points come from subs/tips. Matches the standing rule that ZCoin PvP waits for the server-side launch.

**Fair buffs for the ZCoin room (nothing here changes expected value):**
- *More action:* +N plays this hour on one game; a slightly higher max bet for an hour (variance up, EV unchanged); a small hourly-win-cap extension (debatable — the cap is a safety rail; keep it small or skip).
- *Variance shaping at equal EV:* "insurance" / "double-up" style side options priced exactly fair (e.g. a charm that lets a Mines run start with one safe tile revealed while the ladder is re-priced for it; a Plinko ball that re-drops from the centre once at an actuarially fair fee). Only if each variant is verified at 100% like the existing games.
- *Information and comfort, not odds:* streak/heat trackers, a personal results ledger, auto-play N spins, a "stop-loss" helper.
- *Access:* high-roller lounge, PvP tables, private tables for friends, seat reservations.
- *Status:* titles, auras, table skins, win animations, a trophy case, your name on a machine after a jackpot.
- *House-funded extras that already exist in bounded form:* extra entries/weight in a free daily draw (like the Daily Crate — house money, fixed daily inflation), NOT in the stake-weighted Daily Pot.
- *Cash-side only:* anything that actually improves returns belongs to the Cash tables, never the ZCoin ones.
- *Never:* return boosts, loss rebates/cashback in ZCoins, free ZCoin spins, better Pot odds per stake, anything a bot can farm into ZCoins.

**Signature games (the hook for fair buffs):** each skill gets a casino game it reshapes at EQUAL expected value — Mining ↔ Mines (Miner's Lantern: one safe tile revealed, ladder re-priced), Smithing ↔ Plinko (Bumper: one fair-fee re-drop from centre), Fishing ↔ Hi-Lo (Steady Hand: a tie shows the next card's colour, re-priced). Every variant verified at 100% and replayable on the check-a-seed page. Cash casino sells edge; ZCoin room sells action, shape and status.

## The open question (2026-09-19): is EastScape the game the owner wants, or the one users want?

Observed: the community lives in the Green Room (music) and the casino — both social, ambient, short-loop, second-screen. A grindy OSRS-like may not hold them. Don't decide by gut: launch is the experiment. Measure (stat counters + the dashboard card already exist; add per-scene minutes): share of play time in casino vs world, day-1/day-7 return rate, how many ever leave the Forum, how many pass total level ~30. Hedge that costs little: make EastScape a PLACE first — hub = casino + a music room (the Green Room's queue playing in a tavern/lounge, avatars as the room pile) — with the skilling world as optional depth that feeds the hub (bankroll, charms, status). Note the tension: AFK auto-stop (3 min) fights second-screen play; if the audience is second-screen, consider a deliberate slow AFK lane (the "AFK training area" in Later) rather than none.

## WORKING DIRECTION (decided 2026-09-19): the casino-first game, in its own "Game" tab

The owner knows the data: the community lives in the casino and the Green Room, so the game is built around them. It lives in its OWN top-nav tab, separate from the existing Casino tab (which stays as the fast, no-avatar way to play). Draft map: `EASTSCAPE-casino-first-map.png` (code repo only, never deployed).

- **Spawn in THE LOBBY** (host, task board, doors), not on the farm. The casino is the centre of the map; everything else is "outside".
- **Rooms:** The Floor (slots, flip, dice, then Mines/Plinko/Scratch ports), Roulette & Wheel (shared spins), PvP Parlour (zero-sum duels), Music Lounge (the Green Room's queue plays; avatars are the room pile), Trophy Hall (hiscores, jackpot wall, names on machines), High-Roller Room (gated by level or lifetime wagered), The Workshop (craft charms: range/furnace/anvil move or duplicate here), The Cashier (bank + market window), Front Steps → the Forum and the existing world.
- **The world is reframed, not rebuilt:** jobs for the casino — bankroll (daily tasks), charm ingredients (skills, the island), status drops (mobs, the Wilderness). Quests, wiki and dailies should all point back to the floor.
- **Currency:** launch on Cash only. ZCoin Room is phase 2 (idea B above): wraps the site's `/api/casino/*`, so caps are shared with the Casino tab automatically; needs zwades's OK first.
- **October event** re-themes to fit: a haunted casino night (cursed machines, a glass-roofed roulette room under the stuck moon, candy as chips).
- **Naming snag:** the site already has a hidden "Game Room" at `/?view=games`; rename one when the tab ships.
- **Name candidates:** GAMBA (the chat's own word — every `!odds` reply already ends with it), One More Spin (DookieBetts's line), The House ("the house always wins"), Pixel Casino (clear but generic/hard to own), The Lucky Pixel, The Golden E (the coin), EastSide Casino, The Degen Den, Heads or Tails. Front-runner: GAMBA, with "the pixel casino" as the tagline.
- **Build order when green-lit:** 1) Lobby + spawn move + Front Steps, 2) Music Lounge, 3) Trophy Hall + casino hiscores, 4) first two charms + Workshop, 5) PvP Parlour, 6) High-Roller Room, 7) ZCoin Room.

## GAMBA: the owner's cross map (2026-09-19) and where step 1 left it

The owner's mockup: CASINO in the middle; **north** = casino floors 2, 3… (upgrades); **west** = skilling 1 → 2 → 3…; **east** = combat 1 → 2 → 3 → 4…; **south** = crafting 1 → 2…. Linear lines, harder the further out.

**Step 1 shipped 2026-09-19:** the game is named GAMBA (page title, logo, wiki, messages; the URL is still /eastscape and files keep their names). The casino is the hub: bigger room (1..20), spawn and death-respawn there (`START`), walk-through arches in the side walls (real edge exits; `paintRoom` draws them for any interior with side 'e' tiles). North door = Floor 2 (the Roulette Room). West arch → **The Workyard** (new; skilling 1: trees, an oak, copper, tin, wheat, sardine pond, campfire). East arch → **The Paddock** (new; combat 1: chickens, cows, rotten tomatoes). South front door → the Forum (town: smithy + market = crafting 1), and the whole old world beyond it, untouched.

**Still to decide with the owner — sorting the OLD areas onto the lines** (they mix skilling and combat today, and several sit on the "wrong" side, so this means relinking exits, moving mobs/resources between areas, and mirroring a couple of maps; a `mirror` flag in buildScene would do most of it). Proposed:
- West / skilling: 1 Workyard → 2 Ludus Farm + River Bend resources (yew, oak, trout later, ferry) → 3 Olive Grove + Tomatoe Hill crops → 4 the Gloam's ores/willows/lanternfish → 5 Cloudreach's ores/skyash/sky eels.
- East / combat: 1 Paddock → 2 boars, goats, angry olives, hornworms → 3 Via Appia highwaymen (+ Bandit Camp boss) → 4 the Gloam's moths/ghouls/Understudy → 5 Cloudreach's rams/angels/goose. The Wilderness (PvP) hangs off the combat line.
- South / crafting: 1 the Forum (smithy, market) → 2 a kitchen/charm workshop → later enchanting.
- North / floors: 2 Roulette → 3 High-Roller → Music Lounge and Trophy Hall as side rooms.
- Islands stay reachable by ferry (from skilling 2).

## The GAMBA loop, as the owner sees it (2026-09-19) — the Stake model

Log in → gamble straight away → run dry → do quests (mobs or skilling) for **ZCash** → convert at **DEX** (Dex the Dealer's exchange, 10 ZCash : 1 ZCoin) → gamble more → next-tier skilling and mobs need gear → crafting and potions → buffs for the tables. All of it has to be walked through naturally and explained INSIDE the casino.

**This reverses the earlier "never convertible" line, so the conversion is the thing to engineer.** The exchange is a ZCoin faucet; everything upstream of it (skilling, bots, AFK, trading, multi-accounts) pushes on it. Bound the faucet, not the gameplay:
- Per-account daily conversion cap (owner to set, e.g. 20–30 ZC/day) AND a global daily budget, house-funded by construction like the Daily Pot's fixed 100 ZC/day. With caps, total inflation ≤ accounts × cap whatever anyone does in the world.
- ZCash comes only from server-defined rewards (tasks, quests, kills/gathers paid by the game) — decide whether it can be traded or marketed; caps make that survivable, but multi-accounts then matter more (gate by Twitch account age / follow / minimum playtime; bans honoured).
- The credit goes through the SITE's wallet path, never the game server: a Pages endpoint called with ESCAPE_KEY, idempotent op key `GAMBA:DEX:<user>:<day>:<n>` (PAYOUT_CREDIT), visible in the admin Wallet tab, counted as house money in the books (like the Pot and the Crate), outside hourlyNet.
- ZCoin tables in GAMBA must be the site's existing `/api/casino/*` endpoints (fair band, 20 ZC cap, plays/hour, HOUR_WIN_CAP). Buffs on them: action/shape/status only.
- Needs zwades's OK (his channel points). Compare scale: The Grind pays 10–25 ZC/hour but only under 50 ZC.

**Onboarding inside the casino ("The House Tour", Dex as the guide):** 1) a free first spin, 2) the task board: take your first job, 3) out an arch: chop 5 logs or beat 3 chickens, 4) back to Dex: the DEX window (rate, today's cap left, history), 5) play a ZCoin table. Then pointers outward: Brutus for gear → line level 2, the south line for potions/charms → level 3, floors north unlock with progress. Supports: a "How GAMBA works" board by the door, labelled arches, an on-screen task tracker, Dex's menu always offering "what next?".
- 2026-09-19: **The House Tour** shipped against Cash (`TOUR` in shared; `C.tour`; `tourOp/tourStep/tourEvent` in the worker). Steps: meet Dex (free 10 Cash chip) → play any game → read the task board → a job (5 logs OR 3 chickens) → back to Dex (60 Cash). Tracker top-left (`#tourBox`), Dex's "What should I do next?" (`whatNext()` in the page), plaques over the casino's exits (`labels` on the scene), a "How GAMBA works" board (`HOWTO`). Replays pay nothing. When the DEX exchange exists, it slots in as the last step (get paid in ZCash → convert → play a ZCoin table).

## THE RESET (2026-09-19, owner's call) — this supersedes the casino-first plans above where they differ

Audience: gamblers, grinders, married men with little time, drunk guys. **Very simple and intuitive.** Players spend ~80% of their time in the casino; when they want better odds they skill or fight. Start tiny: the casino (+ Roulette Room), ONE town (the Forum), ONE skilling area (the Workyard), ONE combat area (the Paddock). Nothing beyond is reachable yet.

Shipped 2026-09-19:
- **Maps twice the size each way** (what the owner meant by "tiles twice as large"; a first attempt zoomed IN and was reverted the same hour): `COLS × ROWS` = 44 × 26, exits at `SPAN` n/s 21–23 and e/w 12–14. The screen shows a 22 × 13 window (`ZOOM = 2`, `aimCamera`, `view.bx/by/bw/bh`) that follows you and stops at map/room edges, so characters look the size they always did. The six open areas were re-laid-out for the bigger grid (casino = a 42 × 18 hall; forum; bank and roulette rooms re-centred; Workyard; Paddock). **Closed areas were NOT redone**: their content still sits in the top-left 22 × 13 of the grid with old exit positions, so each needs a new layout when it reopens.
- **The world is closed down to `OPEN`** (shared): casino, roulette, forum, bathhouse, workyard, paddock. The Forum's exits are `{}` with "Road closed" barricades; closed scenes are `wikiHide`; saved characters elsewhere wake up in the casino (`normChar`); daily tasks are limited to `OPEN_DAILY`. Every old area is still in the code: reopening one = add it to OPEN and restore the exit.
- **Luck, the one buff** (`LUCK`): gathering finds lucky clovers (1 in 12), kills drop lucky horseshoes (1 in 8); click one → +15 / +25 lucky bets (`C.luck`, max 300); a lucky win pays +2.5% at every table incl. roulette (all games stay under 100% back). Shown top-right (`#luckBox`), in every game window (`luckLine()`), and explained by the How-GAMBA-works board, the welcome line, Dex's advice and the House Tour's payday (which now includes a clover).
- **Stances removed**: `stanceOf()` always returns "controlled", so every hit trains Attack/Strength/Defence evenly; the UI is gone; the server ignores the message.

- **One Combat skill** (done 2026-09-19): Attack/Strength/Defence merged into `melee` (shown as "Combat"); save v4 takes the best of the three; all gear asks for Combat; the hiscores' separate combat-LEVEL board is still served but no longer shown.

Open follow-ups: trim the side panel for this audience (quests tab is empty now; settings/help could shrink) · decide whether luck should come in strengths (better charms from harder areas) when areas 2+ open · the ZCash/DEX exchange decisions are still open.


## 2026-09-20 overnight: GambaScape, VERSION 47 to 49

The game is called **GambaScape** now (every visible string; file names and the `/eastscape` URL are unchanged).

**Shipped**
- *Pay (v47).* `BOUNTY` per monster from `tools/eastscape-balance.mjs`: a fighter of the monster's level, in that level's gear, earns 1.15x a miner of that level. 88% arrives as drops + a Cash ("coins") drop, the rest as `FINDS`. Crafting no longer compounds: a made thing is 2x its RAW materials, +25% per further step (bar $40, sword $100, was $160).
- *Three jobs, three rewards (v47).* Skilling alone finds luck. Fighting: `FINDS` (house chips $250/$1k/$5k, free-play chip, mystery box, Devil's dice, rewind watch), High Roller (1 kill in 8: double limits for 10 big bets), two drop-only pieces of gambling gear. Crafting: four smithed gambling pieces, four dinners (all Well Fed). Dex's bar: four drinks, a $300 round for the room, $50 Casino scrolls.
- *The effects system (v47).* `fx` on items; `edgeOf(c)` is the one place they add up; `FX_CAP` holds gear alone under 100% back (measured 98.8%) and everything + luck at about 104% (measured 103.8%). `FX_COVER` (v48): effects and luck cover the first $1,500 of a stake. **Cash only: never apply any of this to a ZCoin table.**
- *Panel (v47).* Wallet is three boxes (needs, cash, bag + jackpot) plus VIP; today's jobs moved to the Quests tab; "make" dailies exist; closed-road quests are hidden.
- *Cashier (v47).* Buys loot only (nothing wearable, holdable or clickable) and nudges "smelt it first: pays $X". Brutus buys smithed gear.
- *Island (v47).* Charon's cart in the Forum (15,20); `ISLE_FERRY` and island exits point at the Forum.
- *The House Ruby (v48).* `functions/api/eastscape/exchange.js` + `tools/dex-test.mjs` (34 checks). $100 = 1 ZC, or a $500 Ruby ticket (face 5: pays 25/10/5/2/0, 86% of face), ONE allowance of 25 an hour, a 2,000/day fuse. Game server: Cash off and record saved BEFORE asking; refund only on a definite no; unknowns are held under `dex:<player>:<id>` and re-asked with the same id. Admin: `{t:"admin",cmd:"dexlist"}` and `{cmd:"dexrelease",key,refund}`. `wrangler dev` uses a pretend Ruby (no key, never reaches the site).
- *High Roller Room (v48).* Door in the Fight Pit's back wall (22,4); Vince wants $2,500 on you or the High Roller buff. `def.limits {min:100, mult:10}`; `minBetOf/baseBetOf/maxBetOf(c, def)`. No slots in there (the jackpot is the main floor's).
- *Extras (v49).* Daily Prize Wheel (free spin a Chicago day, +10% Cash per streak day to +70%), VIP tiers from lifetime `wagered` (badge by the name, +$50 to +$1,000 limits), Winners' Wall (today's five biggest single wins, storage key `fame`).
- The wiki's words load on first open (startup code 162 KB gz, was over the 175 budget).

**Not verified live (needs a real Twitch login):** the Ruby's first real exchange. Failure is safe by construction: status is asked before any Cash is taken, and an unknown answer holds the Cash rather than losing it.

**Known gaps / next**
- A NEEDS_RECONCILIATION credit at the Ruby stays held until an admin looks at the site's Wallet tab and runs `dexrelease`. No UI for it yet.
- GAMBA:DEX / GAMBA:TICKET credits count as "casino" in a profile's bankroll split (as The Grind's pay does).
- "Bonus Draw" (a Ruby ticket chance on every profitable bet), "Camera", "Microphone/Holy Statue" auras beyond the bar round: not built.
- Rebalance check wanted after a few days of real play: `node tools/eastscape-balance.mjs`, and the Cash hiscores for anyone farming the High Roller Room.

## 2026-09-20 (later): rules v50-v51
- v50: the Fight Pit's back wall is 34px like the casino's, so the HIGH ROLLERS plaque is on the wall and in view. Fixed the Ruby/Cashier click (server used `ob` before it existed; `a.ob`).
- v51: ONE LINE OUT. Casino has one arch (west, "OUTSIDE") -> the Yard (key still `workyard`, levels 1-14) -> the Gloam (15-29) -> Cloudreach (30+). Each has resources AND monsters. THE CAMP (furnace, anvil, range, Brutus + his shop) is in the Yard at x26-33,y14-18, between the pond and the tin; the Forum lost its smithy (sign there says so). Campfires only, deeper. paddock/rough/boneyard are closed (wikiHide, not in OPEN).
- `node tools/eastscape-aggro-check.mjs`: no aggressive monster may reach a resource, station, sign, NPC or the path (leash +/-3,+/-2 plus aggro). Run it after moving anything in the Gloam or Cloudreach.
- `node tools/eastscape-grind-sim.mjs`: Cash and ZCoins per hour by job. After the camp move: bronze bars $13.6k/hr (was $11.3k), diamond bars level with mining dragonstone. EVERY grinder fills the 25 ZC/hr allowance (22 min at level 1, 3 min at 40): the cap is the faucet, the $100 price barely matters.
- OPEN DECISIONS (owner thinking): ZCoin Vouchers (free-play Scratch-Off cards in the real casino) instead of straight ZCoins; price/daily limit at the Ruby; fishing pays about half of mining past level 15.
- v52: recorded sounds (chop x4, mine x5, sword swing x3, hit x2) in v3/assets/sfx via tools/eastscape-sfx-import.mjs; SOUNDS entries take `files` (random take, never the same twice); range moved to 33,17 in the camp.
- v53: DROPS ARE THREE LINES (LOOT in the rules file): Cash (the bounty), the monster's one item, and ONE rare roll a kill (`raresOf`/`rollRare`: its named pieces, then the casino FINDS). Bones, pits, feathers, tusks and the scattered tier-gear rows are gone. Ring = 2 bronze bars + pork; amulet = 3 bars + 2 hide (hide from highwaymen). Pay per kill unchanged (grind sim).
- PARKED: bring fishing up to par with mining (a one-time reminder is scheduled for 2026-09-19 2:42 PM).
- v54 (2026-09-20): OUTSIDE IS MONSTERS AND A POND. Rocks, trees, wheat, furnace/anvil/range are no longer placed (code, recipes and skill xp all kept). Every monster has half hp (kills ~8-12 s at level); BOUNTY re-measured so $/hr is unchanged. Yard 24 mobs / Gloam 18 / Cloudreach 13 (+ Thunder Geese). FISHING {ms, chance(lvl)}: chance scales with level, 5 spots a pond, lanternfish $20, sky eel $40, fish heal as caught, only source of clovers. Brutus (Yard, by the pond) sells every tier (GEAR_PRICE x TIER_COST). All six gambling pieces are rares (LOOT). Dinners on Dex's menu. Collection log (C.found, Quests tab). Dailies = kills + fish; an impossible job already handed out is swapped. Border scenery (ob.edge) is not interactive.
- NEXT (owner's arcade idea, awaiting one decision): tickets from kills + ONE prize counter (the Ruby) trading tickets for free games, buffs, gear. Open fork: do tickets REPLACE Cash as what monsters pay (Cash chips become a prize), or sit beside it?
- v55 (2026-09-20): TICKETS + THE PRIZE COUNTER + REAL ZCOIN DROPS. Monsters and dailies pay `tickets` (1 ticket = what $1 was; BOUNTY fills a "tickets" drop). The Ruby and both Cashier windows are the Prize Counter (`counterOp`, `G.prizesOf()`): trade-in pays tickets; shelves = chips (Cash 1:1, or all), Dex's menu + rod, the plain gear of every tier (Brutus is gone from the Yard). ZCoins: Ruby scratch ticket costs DEX.ticketPrice (1,000) TICKETS; the straight Cash->ZC trade is gone from the UI. `zcoin` is an ITEM that drops rarely (ZDROP: kills 0.6%+0.02%/lvl as the first line of the one rare roll, catches 0.25-0.33%; 1 in 20 is 5) and is BANKED at the counter via the site's `pay` op, under the same 25/hr allowance and day fuse. dex records carry `back:{k,n}` (what to give back); legacy `cash` records still refund as Cash. Labels over monsters/spots draw the ticket icon beside the number (tixLabel). Measured: 2-5 ZC/hr dropped while fighting, 1.7-5 fishing.
- NOT DONE: the wheel's Cash slices, tour pay and table winnings are still chips (deliberate). Real-ZCoin tables / mounting GambaScape in the site shell / redirects: discussed, not started.
- v56 (2026-09-20): THE REAL TABLES. On the casino's main floor, cointable/wheel/hilo/mines/plinko/scratch play for REAL ZCoins (SCENES.casino.real = REAL_TABLES). The owner chose to KEEP GambaScape's own game windows: eastscape-casino.js has a REAL MODE whose adapter (realPlace / realRun / realInit) calls the site's endpoints from the page (same origin, the player's own session) and hands the window the same gameResult / run messages the game server would. Site rules only: 1-20 ZC, ten plays/hr/game, 400/hr; no GambaScape buff touches them. Coin Flip (30 s) and the Wheel (60 s) are SHARED rounds: the adapter bets, polls state until that round has a result (it keeps polling even if the window is shut: on the site a poll is what settles and pays a round), then plays it back. Scratch symbols and the wheel's angle are mapped to our art/geometry (REAL_SYM; site gold is the LAST 6 degrees, ours the first). The game server refuses a Cash bet at those tables on that floor; the High Roller Room keeps Cash copies. Games button / G opens them; tabs hop between the six. An iframe version of this (site shell ?embed=1) was built and thrown away the same day at the owner's request; the site files were restored byte-for-byte.
- tools/casino-rig.mjs (launch config "casino-rig", port 4321): serves the repo AND runs the site's real Pages functions on in-memory SQLite with a stubbed wallet and bootypaper signed in. All six real tables were played through the game against it; /__rig shows the fake wallet and ledger. Use it for any page that spends ZCoins.
- The game windows' module (26 KB gz) is now lazy (first table click, or 6 s after arriving): startup code 155 KB.
- ON HOLD (owner, 2026-09-19): COOKED FISH AS THE ONE SOURCE OF BUFFS, and whether Dex's drinks stay. The idea: cooking comes back as a small skill, cooked fish carry the casino (chip-table) buffs the dinners carry now, fishers get something worth selling. Open questions when it is picked up: do Dex's drinks stay (recommendation was yes), do cooked fish also give field buffs, and does the Exchange stall price in tickets. Nothing built. Buffs stay CHIPS ONLY either way; they never touch a real-ZCoin table.
- ODDS CHECK (2026-09-19): the real tables' results, payouts, per-play 96-104% edge draw and seeds are all the site's (the page only plays back the answer). The numbers the window PRINTS before a play were checked against the site's modules: Plinko board identical to PAYOUTS in _plinko.js; Mines ladder and top rung the same formula as multiplierFor/topRung at edge 1; Wheel shows 2.03 (site: 360/177 = 2.034) and 60. If a site table is re-tuned, REAL_PLINKO / REAL_WHEEL / realMinesMult in eastscape-casino.js must follow, or better, be read from the state endpoint's config.
- v57 (2026-09-19, LIVE): ONE CURRENCY + TICKETS-OR-ZCOINS AT THE REAL TABLES. The owner's calls: tickets are the only currency (the "coins"/Cash item is gone; saved stacks of it are dropped on load = the wipe he asked for); 1,000 tickets = 1 ZCoin, ONLY inside a casino bet; a win always pays real ZCoins; backstop 50 ZC of ticket stakes an hour per player (DEX.capHour, mirrored in functions/api/eastscape/exchange.js, banking shares it); Ruby scratch tickets and the exchange removed; High Roller Room closed (not in OPEN; Vince turns you away); zwades has delegated all game decisions to the owner.
  - HOW A TICKET BET WORKS: page -> game server {t:"dex",op:"stake",zc,g} -> server burns zc*1000 tickets, saves, asks exchange.js op "stake" -> a row in gamba_stakes (the voucher) -> page gets {type:"stake",voucher} -> sends the ordinary bet with `voucher` -> the endpoint's stakeFor() (functions/api/eastscape/_stake.js) claims it OPEN->USED in place of the wallet debit. No WAGER_DEBIT is written. A failed row insert reopens the voucher. An unused voucher stays OPEN and is handed back (status.open) instead of charging tickets again. The six endpoints' originals are in backups/bet-endpoints-2026-09-19/.
  - Tested: tools/dex-test.mjs (39 checks: all six endpoints on a voucher and from the wallet, reuse/wrong user/wrong amount refused, cap, fuse); end to end in the browser on the rig with the dev game server pointed at it (`--var ESCAPE_KEY:<'rig' x12> --var SITE:http://localhost:4321`; the rig's player is dev:bootypaper). NOT yet tried on production with a real login.
  - NOT DONE / NEXT: (1) slots, dice, roulette and the Fight Pit are tickets-in tickets-out; the owner wants them wired to ZCoins/tickets too, which means building each as a real site game (seed commit, 96-104% draw, hourlyNet, floor/feed/profile/dashboard/verify). (2) Buffs become OUTSIDE-only effects (faster kills, more tickets, better ZCoin drop chance): approved, not built; the gambling effects still apply at the four ticket-only games. (3) Dashboard line for house-staked bets: casinoBook counts a voucher bet's stake as house income; subtract SUM(zc) of USED gamba_stakes. (4) hourlyNet counts a voucher bet as payout minus stake (conservative for the player; fine). (5) The Exchange stall and island prices now read in tickets via fmtCash; nothing re-priced. (6) An OPEN voucher can't be turned back into tickets; it can only be bet.
- v58 (2026-09-19, LIVE): DICE and SLOTS are site games, GambaScape-only (owner's answers: GambaScape only / keep the jackpot with a ceiling / shared rounds for roulette and the pit). functions/api/casino/{dice,slots}: roll.js and spin.js are GENERATED from plinko/drop.js (scratchpad mk_instant.py) so the money steps are the live ones; both in hourlyNet, /api/casino/me `played`, /api/casino/verify. Slots: shape cherry4/lemon6/bell12/star25/diamond50 + two cherries 1.4, divided through to return 98%; 2% feeds `slots_pot` (hundredths of a ZC; ceiling 500, overflow -> reserve; seed 50; three sevens takes pot x stake/20). The window READS the pay table and pot from slots/state (REAL_CFG), never a copy. tools/dex-test.mjs = 57 checks incl. a planted three-sevens seed. NOT in: the site floor, activity feed, profiles, dashboard book, the Daily Pot's dayStakes (decide later).
- ALSO 2026-09-19: The Grind's cooldown is 4 hours (was 1), owner: "its getting abused". _grind.js SHIFT_COOLDOWN_MS; page text reads cooldownMinutes.
- PLAN for v59 (roulette + Fight Pit as SHARED-ROUND site games on _engine.js GAMES, `hidden: true` so home.js / games/home.js skip them):
  - keys `roul` (NOT "roulette": that is the PvP Russian Roulette in verify.js) and `pit`. Engine needs two additive hooks: settleRound calls game.outcome(seed, no) and uses game.priceFor?.(pick, no) ?? game.payout[pick]; state.js returns game.cardFor?.(no) as `card`.
  - roul: 60 s cycle / 40 s bets; ONE pick a round (engine UNIQUE): red black odd even low high d1 d2 d3 n0..n36; fair prices 37/18, 37/12, 37; n = floor(sha256(seed:roul) x 37).
  - pit: 90 s cycle / 40 s bets; the CARD (two fighters, titles, p clamped 25-75% from sqrt levels) is a pure function of the round NUMBER (public), the winner is sha256(seed:pit) < p; price 1/p. Pool/levels must mirror G.FIGHTS.pool / G.MOBS levels (test for drift).
  - client: the pit window (eastscape-casino.js fight(v)) and the roulette window (eastscape.html roulWin) are fed a view object built from the site's state; the blows script is cosmetic and written client-side to fit the winner; poll only from closesAt until the result, and once per round for the card. One bet per round, no "take it back".
  - world: the ring's fighters and the roulette wheel are drawn from game-server state today; either mirror the site's round on the game server (one public state fetch per round while someone is in the room) or drive the visuals from the page. Decide when there.
- SECURITY FIX, LIVE 2026-09-19 (commit d114d8d): THE LATE-BET HOLE in Coin Flip and the Wheel. bet.js accepted a bet up to 1.5 s after the clock closed while state.js settles and PUBLISHES the result + seed the moment it closes, and nothing checked, so the result could be read and then bet on (gold on the Wheel = x60). Both bet endpoints now refuse a round whose `result` exists (`roundRow?.result` after ensureRound). tools/dex-test.mjs replays it on a frozen clock (fails against backups/late-bet-fix-2026-09-19/). Read-only D1 check: 12 late bets ever, all 1 s after close, 4-8, net -55 ZC: never exploited. ANY new shared-round game inherits the fix through casino/[game]/bet.js. CLAUDE.md's casino section should get a line about this.
- v59 OPEN QUESTION for the owner before building roulette: the engine allows ONE bet per player per round (UNIQUE game, round_no, user_id + the debit's idempotency key). Roulette today lets you spread chips over many spots. Either (a) one spot a spin, engine untouched, or (b) several spots a spin up to 20 ZC total, which means a new bets shape in the money engine on a live table.
- v59 (2026-09-19, LIVE): RUSSIAN ROULETTE IN THE ROULETTE ROOM + TICKETS STAY ON YOU. (a) Object `rrtable` (art o_pokertable) at 16,11 in the roulette scene; worker kind "rr" -> {type:"rr"}; page openRussian() -> CZ.russian() in eastscape-casino.js. The window IS the site's PvP table (GET /api/casino/pvp/state?game=roulette, POST /join {game:"roulette"}), one shared lobby with the website; ZCoins only (owner's call), site code untouched. Polls every 2 s only while the window is open and the tab showing; plays a result back only if it settled < 45 s ago; seats rebuilt only when the roster changes. Tested on the rig with `x-rig-user: <name>` (new: the rig acts as another player, 500 ZC) for 3- and 4-seat tables. (b) Tickets can't be dropped (already), banked (dep / depinv skip them) or offered in a trade (op "cash" is refused; the trade window's tickets box is gone); normChar moves banked tickets back to the bag. The Exchange still prices in tickets (that is spending).
- STILL OPEN for v60: classic roulette + Fight Pit as shared-round ZCoin games (plan above; owner yet to answer one spot a spin vs several); buffs -> outside-only effects; dashboard line for ticket stakes; slots/dice in the feed, profiles and books.
- v60 (2026-09-19, LIVE): BINO, the Russian Roulette dealer (NPC at 17,10 in the roulette scene, art "arbino": arbino_south/east.png, PixelLab pro character 7aeb9f04-eb57-4ec7-9eae-0f059fcf8a4c in the house style; orange tiger-striped jersey #21, ponytail, whiskey bottle). The owner named him Bino (he is the community member childisharbino). New NPC art must be in BOTH the scene list in AREA_ART and ART_FILES or the content check fails.
- v61-v62 (2026-09-19, LIVE): (a) `o_rrtable.png` = the poker table with the cards felted over and TWO REVOLVERS on it (one PixelLab icon, map object ad2ba5a2-..., composited by scratchpad mktable.mjs); Bino is at 15,11, beside the table (owner's tile: at 16,11 his name was drawn over it). (b) The Russian Roulette window now draws eastcoin.vip's OWN cylinder: rrLoad / rrTurn are ports of v3-pvp.js loadCylinder / turnTo, styles .cz-cyl/.cz-ch/.cz-hammer/.cz-rrword mirror .rr-* in v3.css, and rrPlay follows the site's sequence and timings (spin 1 s, a pull every 0.7 s, "click" 0.34 s, "Reload" between rounds, BANG 1.15 s with a shake). If the site's animation changes, change this one too. (c) SITE SIDE of classic roulette + the Fight Pit is LIVE and inert: _engine.js GAMES.roul / GAMES.pit (`hidden`), settleRound passes the round number to outcome() and uses priceFor(); [game]/state.js returns `card`; verify.js knows roul and pit; tools/dex-test.mjs = 77 checks. NOT BUILT YET: the GambaScape side (page-driven: build the same view objects the ring, the wheel and both windows already draw from, out of /api/casino/{pit,roul}/state; one bet a round; poll ~every 5 s while betting and at the close; the game server stops running its own ticket rounds in those two rooms).
- v63 (2026-09-19, LIVE): a BANK CHEST in the Yard at 35,16: `{ t: "booth", art: "o_chest" }`, so it is the bank itself (same window, same bankOp, tickets still refused). o_chest added to the workyard list in AREA_ART.
- v64 (2026-09-19, LIVE): EVERY GAME TAKES ZCOINS OR TICKETS. Roulette and the Fight Pit are the site's shared rounds (GAMES.roul / GAMES.pit). Scenes carry `realRound: "roul"|"pit"`; the game server runs no rounds and takes no bets in such a room (its fightTick/rouletteTick/fightOp/roulOp are skipped) and answers a click with {type:"roundopen", key}. The PAGE calls CZ.roundWatch(key, on) on entering/leaving; eastscape-casino.js "SHARED ROUNDS" polls /api/casino/<key>/state (once per new round, every 6 s while bets are open, every 1.5 s from the close until the result; not while the tab is hidden unless you have a bet riding) and builds the SAME view objects the server used to send -> env.onFight / env.onRoul -> the ring, the wheel and both windows draw unchanged. The pit's blows are written client-side to fit the winner by a generator seeded with the round number (rwScript), so every page shows the same fight. roundBet(key, pick, zc) = one bet a round, ZCoins or a ticket voucher (dexOp's "stake" now allowed in any scene with `real` or `realRound`). Roulette window: chips 1/5/10/20, one spot a spin, a Bet-with switch; a `hold` field covers the seconds between the spin ending and the next round opening. BUG FOUND IN TESTING AND FIXED: the pit window's "already counted this round" marker lived on the view object, which is new every second, so one loss was tallied 14 times: it is `fightPaid` now.
- ALSO v64: a ZCoin or a rare find that lands on a full bag goes to the BANK (keepRare); the wallet's ZCoin read no longer throttles itself away on a fast load (zcAt started at 0 and performance.now() was under 4,000).
- NOT DONE: buffs -> outside-only effects (the gambling gear, dinners, drinks, luck, VIP limits, High Roller now have NO table to act on: every table is the site's); dashboard line for ticket stakes; dice/slots/roul/pit in the site's feed and books are named but untested there; nobody has bet on production with a real login yet.
- 2026-09-19 (LIVE, casino module v=17): THE GAME WINDOWS WEAR PARCHMENT (owner: "restyle the other windows towards the parchment look"). eastscape-casino.js: the #gameWin.cz block no longer overrides the page's .win frame/header; its variables are ink-on-parchment (Nunito); a block near the end gives the dark PROPS (.cz-jack, .cz-ticket, .cz-reels, .cz-rrcyl, .cz-rtk, .cz-tkgrid, .cz-pw) the old light-on-dark palette locally, and fixes what vanished on paper (pegs, bar tracks, the dice marker, black pick, gold buttons). Eyeballed: Plinko, Slots, Mines. NOT eyeballed: Coin Flip, Wheel, Hi-Lo, Scratch-Off, Dice, the Fight Pit, the Prize Counter, the Daily Prize Wheel, Russian Roulette.
- 2026-09-19 (LIVE, casino module v=18): WALK TO YOUR TABLE (owner). Clicking a real table (or the Russian Roulette table) no longer opens its window at the click: you walk, and the server's {type:"real"} / {type:"rr"} on ARRIVAL opens it, showing THAT game only. The strip of every game (`MENU`, from CZ.open(g, {real, menu:true})) appears only when the window came from the Games button or G, which still work from anywhere on the main floor. Roulette's Bet-with switch and chips use the windows' gold buttons (.rl-gold in the page).
- v65 (2026-09-19): BUFFS WORK OUT THE ARCH (owner approved the table item by item). eastscape-shared.js: fxOf(c) is the ONE adder (keys tix, speed, tough, rare, zdrop, bite, heal + power; OUT_CAP tix .25 / speed .2 / tough .3 / rare .4 / zdrop .75); edgeOf() is inert; swingMsOf takes speed; rollRare(mob, r, fx) scales zcoin by zdrop and everything else by rare; meals `mins: 20`, drinks `mins: 10`, stored as `left` in MILLISECONDS and counted down by the game server once a second ONLY in a scene that has monsters; luck = +25% ZCoin chance, one used per kill or catch; VIP by `c.earned` (tixTo + kill tickets; never bets or the Devil's dice) with `off` 0-10% via counterPrice(); ROLLER.kill = 0; tooEmpty() is always null. Worker: killMob scales tickets by tix; fishing takes speed, bite, a tix chance of a second fish, zdrop; mobs' damage takes tough; chip_free is a 100-ticket bundle, devils_dice plays for up to 1,000 bag tickets, rewind_watch is a full heal; the cooler and buffet only talk.
- POSSIBLE FUTURE FEATURE (owner, 2026-09-19): HUNGER AND THIRST. Switched off in v65 (nothing drains them, no table checks them, the wallet bars are gone; NEEDS / needOf and the character fields are still in the code). If they come back they should matter OUTSIDE (e.g. a long grind makes you slower until you eat), not at the tables.
- 2026-09-19: THE GAME IS CALLED **EastScape** AGAIN (owner). Every player-facing "GambaScape" was replaced (page title, rules text, windows, wiki, game-server messages, site error messages). File names, URL and worker name never changed.
- BACKLOG (owner, 2026-09-19): (a) DEX'S CONVERSATION AND THE WIKI still describe dinners as "Well Fed" with gambling effects, the smithy/crafting, Cash and chips in places: sweep them to match v65 (buffs work out the arch, tickets only). (b) THE DASHBOARD: do NOT add EastScape lines to the site's admin dashboard. The owner wants a SEPARATE EastScape dashboard later (ticket stakes and what they minted, ZCoin drops banked, the slots pot, players online, tickets earned per hour, VIP tiers, stuck vouchers). The ticket-stake data is already in `gamba_stakes` on the site.
- v67 (2026-09-19, LIVE): LEVEL BANDS, SOFT GATE. eastscape-shared.js BANDS = { workyard:[1,9], gloam:[10,19], cloud:[30,99] (INTERIM) }; bandBlock(c, scene, "fight"|"fish"). Owner's rules: soft gate (walk anywhere; can't START a fight below the scene's band unless that monster is already attacking you; can't fish its water below the band); COMBAT level gates monsters, FISHING level gates water, separately; ore/trees take the same gate when they return; there will be oceans and lakes as well as ponds. The page prints "needs Combat 10" / "needs Fishing 30" where the ticket value would be.
- NEXT for bands (owner wants to be ASKED about each new monster first, and asked its SIZE): the target is six scenes: Yard 1-9, Gloam 10-19, a 20-29 scene, 30-39, 40-49, 50+. Existing monsters by band: 20s moth 22, tax wraith 28 | 30s ghoul 30, chandelier 34, understudy 38 | 40s ram 42, revenant 45, angel 48 | 50+ goose 55. Thin: 20-29 and 50+. Closed maps to reuse: paddock, rough, boneyard. Names proposed to the owner 2026-09-19 (awaiting his pick). Trout bites from Fishing 10 but lives in the Yard's 1-9 water: move it to the Gloam or drop its level when the scenes are rebuilt. Every fish needs a level (none has one today).
- 2026-09-19: the owner's working sheet for the band rebuild is the DOC "EastScape World Bands" https://claude.ai/code/artifact/5f0bb7ef-b052-4af5-97d0-2bddee5250b2 (docs connector; doc id 5f0bb7ef-b052-4af5-97d0-2bddee5250b2, tab body node c654f2bd-7581). Tables: Proposed world (scene, band, monster, level, count, size, attacks on sight, tickets, status, with NEW rows for him to fill), The world today, unplaced monsters, Fishing by band, Death: the hospital bill. READ IT BACK before building: he edits it in place. DEATH: he chose #1, the hospital bill (a share of carried tickets, capped per band; the doc proposes 5% / 250 in the Yard and 10% with caps 1,000 to 6,000 deeper). Not built yet.
- v68 (2026-09-19, LIVE): THE SIX BANDS. West from the casino: workyard 1-9, gloam 10-19, `mire` (The Lantern Mire) 20-29, `boneyard` 30-39 (reopened, rewritten), cloud 40-49, `thunderhead` 50+. About two dozen monsters of five kinds in each. THIRTEEN NEW MONSTERS, drawn with PixelLab create_character mode "v3" (2-3 GENERATIONS EACH, not pro's 20; it matched the house style without a style reference): toadstool 10, boneidle 16 | twister 20, counter 24, shark 26 (aggro) | stagehand 32, usher 36 (aggro) | brainstorm 40, seagoat 46 | golem 52, wolf 58 (aggro), drake 62 (aggro), house 70 (xl boss, aggro). The owner sent a list of RPG MO monsters as IDEAS (golem, werewolf, dragon, skeleton, ghost, vortex, mushroom, capricorn, brain); names and art are our own. He said "go ahead", so SIZES were Claude's choice this once. Re-placed: olive (Yard), goat (Gloam), revenant + angel (Cloudreach). BOUNTY for the new ones is tools/eastscape-balance.mjs's `want`, EXCEPT the 50+ band, lifted 1.2% a level past 42 because the tool's reference wage is flat from level 40. FISH: two per water (spot.fish + spot.fish2/fish2lvl, G.fishAt): sardine/perch 5, trout 10/catfish 15, lanternfish 20/mudskipper 25, bonefish 30/ghostcarp 35, skyeel 40/cloudray 45, stormmarlin 50/thundersquid 58; spots carry `req` Fishing = the band. Six new drop items use emoji only (no icon art yet): sporecap, markedcard, sharktooth, flashlight, stormjelly, staticfur, hailshard. DEATH: G.DEATH / deathBill: 5% capped 250 in the Yard, 10% capped 1,000 / 2,000 / 3,500 / 5,000 / 6,000 deeper; tickets only. tools/eastscape-aggro-check.mjs passes. PixelLab: about 200 generations left until 2026-10-18.
- NOT DONE after v68: the grind sim and the wiki's area guides don't know the new scenes; daily jobs still only name old monsters; the seven new drop items and nothing else lack icons; fishing pay per band was set by hand to land at 80-90% of fighting and has not been run through the grind sim.
- v69 (2026-09-19, LIVE): NOTHING ATTACKS ON SIGHT (owner: "too aggressive for a relaxed chill game"). eastscape-shared.js `AGGRO_ON = false`: every monster's `aggro` is moved to `aggroWas` and deleted, so the server finds no targets; flip the flag to bring it back. The aggressive monsters still sit in corners their old reach cannot leave, and tools/eastscape-aggro-check.mjs reads `aggro || aggroWas`, so switching it back needs no map work. The five scene signs were repainted. ICONS drawn for the seven new drops (sporecap, markedcard, sharktooth, flashlight, stormjelly, staticfur, hailshard); the pelt took two tries. Do NOT make new monsters aggressive, and do not describe a monster as attacking on sight, while this flag is off.
- v70 (2026-09-19, LIVE): (a) PIXELLAB BUTTONS. One `create_ui_asset` sheet (40 generations; style reference = ui/tab_on.png) cut by scratchpad uislice.mjs + uibuild.mjs into ui/czbtn.png (gold action button; its face came back transparent, so the script floods the inside and paints a gold gradient), ui/czbtn_off.png, ui/czpill_on.png, ui/czpill.png, all at half scale. CSS: border-image with NO top/bottom slice (`0 16 fill / 0 15px` big, `0 20 fill / 0 14px` pills) so the art stretches sideways only; rules are prefixed `#gameWin.cz` to beat the plain ones. Used by .cz-lock, .cz-dexgo, every .cz-realtabs button (game tabs + Bet-with switch) and the roulette window's .rl-gold .pill. The stake chips (1/5/10/20) and roulette's chip buttons were NOT redrawn. CSS lives in a JS template string: never put a backtick in a comment there. (b) DAILY JOBS: 43 open jobs, one per monster and per fish across the six bands, `req` = the scene's Combat or Fishing level, bonus about 45% of the kills'/catches' worth. (c) WIKI: area pages show the band, the fish with their levels and the hospital bill (WIKI.areas[k].spots); new guide "The road west: six scenes" (GUIDES bodies are HTML strings). PixelLab: about 140 generations left until 2026-10-18.
- v71 (2026-09-19, LIVE): (a) A second PixelLab UI sheet (40 generations) cut by scratchpad uislice2.mjs + uibuild2.mjs into ui/czchip.png + czchip_on.png (the stake buttons 1/5/10/20, half, 2x, Max: wood, gold on hover) and ui/rlchip_1/5/10/20.png (roulette's poker chips: grey, blue, red, black; the selected one keeps its image and gets a gold ring: the generic `.rl-gold button[aria-pressed]` rule paints a gradient, so each chip has its own pressed rule). Mines' bomb-count buttons are still plain. (b) PLAIN WORDS (owner: "gamer dads... reading is at the bottom of their list"): every game's subtitle is one short line, realRules() is just "N of 10 plays left this hour" (+ "1,000 tickets = 1 ZCoin" on tickets, + a Check the last result link), the jackpot plaque says "Hit 7-7-7 to win it", Russian Roulette's How it goes is one sentence. KEEP NEW COPY THIS SHORT. (c) GRIND SIM now runs the six bands (tools/eastscape-grind-sim.mjs: FISH vs FIGHT per scene at its opening level and five on, and a closing table "fishing as % of fighting", target 67-90%). Result: Mire 66/80, Boneyard 76/83, Cloudreach 80/82, Thunderhead 76/75 were fine; the Yard (126/92) and the Gloam (99/106) overpaid fishers, so sardine 10->8, perch 12->10, trout 18->14, catfish 22->18, giving 97/74 and 75/82. PixelLab: about 100 generations left until 2026-10-18.
- v72 (2026-09-19, LIVE): (a) LESS READING: the wiki's GUIDES are 15 short guides (about 2,200 characters in all; guides for closed things such as the Forge, cooking, the Wilderness and tools are gone), HOWTO is 568 characters, and 13 NPCs say 2-3 short lines each (scratchpad short72.py). (b) RUSSIAN ROULETTE'S CYLINDER IS DRAWN: casino/rr_cyl.png (160px disc), rr_hole.png, rr_bullet.png under v3/assets/img/glad/flat/casino/; chambers sit at CYL_R = 25cqw, a spent chamber is the hole greyed, the live one swaps to the bullet, the BANG glow is a filter drop-shadow. The hammer/pointer is still CSS: PixelLab's hammer came out poorly. (c) MINES' BOMB BUTTONS wear ui/czchip.png like the stake chips. (d) ROULETTE HIGHLIGHTS: the gold outline (`.rl-cell.mine`) means YOUR bet; the last spin's winning spots (`.rl-cell.hit`, white) show only while the result banner is up. Before, `hit` stayed lit through the whole next round, which read as the table pre-selecting spots. (e) tools/dex-test.mjs: the Plinko voucher check takes any Daily Pot credit off the wallet first; run after 11 PM Central the first bet of the day pays the pot and the check used to fail on it (not a money bug). 77 pass. PixelLab: about 95 generations left until 2026-10-18.
- v73 (2026-09-19, LIVE): REGULAR ROULETTE IS OUT OF THE ROULETTE ROOM FOR NOW (owner: "a bit glitchy"); RUSSIAN ROULETTE IS CENTRE STAGE: rrtable at 21,11 (in line with the door), Bino at 20,11. Removed from the scene only: the `roulette` object, Rouge, and `realRound: "roul"`. Nothing was deleted: the page's roulette window, the windows module's round watcher, the game server's roulette code (its tick now also needs a `roulette` object in the room) and the site's hidden `roul` game all remain; the comment on SCENES.roulette says how to put it back. The owner has NOT said what the glitches are: ask before fixing. The room keeps its name. Ideas proposed to the owner for the room (awaiting his pick): seats you can see people sit in, a lobby bell/ticker heard on the casino floor, a winners' board, a spectator rail, a second table at a lower buy-in.
- v74 (2026-09-20, LIVE): (a) THE STAR CARPET. Feedback from people shown screenshots (owner): the casino floor was too red, sprites didn't stand out, and it blended with eastcoin.vip's own red and gold. Two PixelLab tilesets (stars, purple swirl; ~7 generations) were UNUSABLE: a 16-pixel repeating tile can't hold a star, it makes a fine grid. So eastscape.html starCarpet() PAINTS the floor once into the room's cached picture: near-black indigo, big scattered stars in six colours at 42% (60% fought the sprites), a violet trim, indigo walls. Applies to every `floor: "casino"` room WITHOUT its own `carpet` (casino, fightpit, highroller); the Roulette Room keeps its green sheet. t_casino.png is now unused. (b) THE ROULETTE ROOM: six `rrseat` stools (G.RR_SEATS, soft, clicking one is clicking the table), `rrboard` (o_notice, reused) and `barcart` (o_barcart, PixelLab). The game server asks the site's PUBLIC GET /api/casino/pvp/state (no key, no session) only when someone clicks the table/a seat, a window reports a change (t:"rr", env.rrChanged), someone enters the room, or the lobby's clock runs out; never more than once per RR_ASK_MS (2.5 s). A new lobby rings `rrbell` on casino/roulette/fightpit once (chat line with a Walk there button); seated players in the room are walked to their stool once per lobby; on settle the room gets `rrshow` and the page runs G.rrTimeline (the window's clock + 2.2 s lead so the room is never ahead of a window) to slump the shot (sprite turned 90 degrees, grey) and label the winner; the floor hears who won only after the playback. LIMIT: a lobby opened on the WEBSITE is only noticed when someone in-game clicks, enters the room or has the window open. (c) NEW SITE ENDPOINT functions/api/casino/pvp/board.js: read-only, no session, `public, max-age=60`; today's pots, longest winning run and most times shot over 30 days; the board is a popup. (d) rrShot: 1 ticket, 5 s apart, a `casinonote` to the room. Not seen with two real in-game players yet (the slump of ANOTHER player's sprite). PixelLab: about 87 generations left until 2026-10-18.
- ART STILL NOT CUSTOM (audit 2026-09-20, owner wants all custom eventually): NPCs Livia the Broker, Gaius, Aurelia; players and the casino's bot gamblers are one hero sprite hue-shifted; objects drawn by code: rope lines, plain rugs, the fight ring, forum rocks, bathhouse counter, hay, Boneyard gravestones/skeletons/dead trees; marble and wood room floors, all room walls, wall banners and lamps; the Mire and the Thunderhead reuse the Gloam's and Cloudreach's ground with a tint; inside the game windows: slot reels, scratch symbols and wiki/guide icons are emoji, the Plinko board, wheel, dice, Hi-Lo cards and Mines tiles are CSS, the Russian Roulette hammer is CSS; the wall of fame reuses the notice board. All 166 items and all monsters have icons/art.
- BACKLOG (owner, 2026-09-20: "put it on the backlog to go over it later"): SHOULD THE PRIZE COUNTER SELL ARMS AND ARMOUR? Claude's proposal, not decided: Bronze and Emerald stay buyable (tickets need a big obvious thing to buy); Diamond, Dragonstone and Onyx become DROPS from their level bands, one named piece per monster (5-6 monsters a scene maps cleanly); bad-luck protection (a guaranteed drop after N dry kills, or the counter sells the missing piece dear once you own three of the set); this is what would give Livia's market a purpose. The catch: tickets matter less at high levels, so something must replace them (cosmetics, or the tables). Next step when he's ready: draft the drop table (which monster, which piece, what odds) for him to edit.
- 2026-09-20: every window's close button is a red square with a white x (`.win-head .win-x, .dlg-x` in eastscape.html), after the owner said the bare x was easy to miss.
- 2026-09-20 (LIVE, casino module v=25): the Russian Roulette window's side panel leads with AT THE TABLE (every seat, odds in a lobby, in / out / +pot during the playback) and WATCHING (the site's `room` list, already in every /pvp/state answer, merged with whoever is standing in the Roulette Room via env.roomPeople, less anyone seated, doubles folded by name). No new requests. NOTE: the site seats up to 12 at Russian Roulette; the room has SIX stools (G.RR_SEATS), so players 7-12 show in the window but get no stool or name in the room. Add six more stools if tables ever fill.
- v75 (2026-09-20, LIVE): PEOPLE. Six everyday player looks (look1..look6, eight facings: hoodie, Hawaiian-shirt dad, cap and jersey, denim jacket, polo, tracksuit), chosen by G.lookOf(account id), nothing stored, nobody picks (owner's choice from four options). The casino's fake players use them by name. Armour still replaces the whole sprite; hero_tiro is only the fallback while a look loads. A drawn look is never hue-shifted. Livia, Gaius and Aurelia drawn (south + east). HOW TO DRAW A PERSON THAT MATCHES THE HOUSE: PixelLab create_character mode "standard", size 48, flat shading, low detail, single color black outline, proportions chibi or cartoon, prompt ending "simple retro 16-bit RPG sprite, big head, few flat colors": ONE generation, comes back on a 68 px box at the house height (~47 px). DO NOT use v3 for people: the owner rejected it ("too AI and smooth"); it draws 65 px figures with soft gradients, and shrinking/flattening them (scratchpad retro2.mjs) only makes mud. Dex/Bino came from pro mode with the hero as style reference (20 generations each). Wasted this round: 18 generations on v3 people. Install with scratchpad getall.mjs <id> <name> [se]. Also: a bystander standing on a stool is stepped off when its seated player arrives (two SEATED players can never share one: the site hands out seat numbers). PixelLab: about 60 generations left until 2026-10-18.
- SIZE (measured 2026-09-20, tools/eastscape-budget.mjs): first load is about 167 KB of code (gzipped; budget 175, THE ONE TO WATCH) plus 193 KB of art in 135 requests; game windows 37 KB and the wiki 19 KB load later; each scene's art is 2-53 KB on arrival; player looks load one facing at a time (~1 KB each). The whole art folder is 2.3 MB across ~400 files but nobody downloads all of it.
- 2026-09-20 (LIVE): SHIPPED FILES ARE STRIPPED. tools/eastscape-ship.mjs writes the five page files into the deploy repo without comments or spare whitespace (esbuild, whitespace-only: names kept, full minify would only buy 4 KB more). First-load code 166.6 -> 123.6 KB gzipped (page 93 -> 77.7, rules 69.1 -> 42.9, sounds 4.5 -> 3); game windows 37 -> 31.6; wiki 18.6 -> 17.9. Code budget lowered 175 -> 140 and the budget tool now measures the shipped form. NEVER cp those five files to the deploy repo; probes must grep the shipped spelling (`const VERSION=76;`). Played locally from the shipped build (casino window, a fight, no errors) via the new `ship-preview` launch config, and the live page boots. The comments inside the casino module's CSS template string are still shipped (they are inside a string; about 13 lines). SIDE NOTE, not acted on: the deploy repo's root is public, so eastscape-worker/src/index.js (the game server's commented source) is readable at eastcoin.vip/eastscape-worker/src/index.js. Nothing secret is in it, but the owner may want it out of the deploy repo or blocked in _headers/_redirects.
- STILL OPEN for size, if ever needed: closed content (the Forge/smithing, cooking, the Wilderness scenes, tickets-only roulette and Fight Pit code) is still in the first-load files; SCENES is 8 KB gzipped of the rules file and about half of it is closed scenes. Worth doing only when the code budget gets tight again.
- 2026-09-20 (LIVE, page only): SECTION RUGS on the casino floor (owner: "it would make it feel like those areas are unique"). eastscape.html SECTION_RUGS + sectionRug(): seven painted rugs, one per roped-off room, each its own colour and weave: slots teal/gold diamonds, card room felt green/cream pips, bar plum/amber zigzag, wheels royal blue/rings, coin flip charcoal/gold dots, dice pit slate violet/white pips on checks, instant wins dark cyan/magenta stripes. Paint in the room's cached picture (no per-frame cost, not clickable, the game server doesn't know about them, so no VERSION bump). Too big for PixelLab (the slots rug is 512 x 192). To add one: a row in SECTION_RUGS (tiles, just inside the ropes); a new weave is one branch in sectionRug().
- 2026-09-20 (LIVE, page only): NO MORE GLADIATOR FLASH ON A TURN. Looks (and armour outfits) loaded one facing at a time, so the first turn to a new facing drew the fallback (hero_tiro / the Spartan) until the file landed. eastscape.html facedArt(base, d): first sight asks for all eight facings at once; until the wanted one lands the person is drawn in the NEAREST facing that has; nothing at all for the first blink; the old sprite only if nothing arrived after 3 s. Used for look1..6 and hero_<tier>. hero_tiro_* left the startup list (8 fewer requests at login).
- v76 (2026-09-20, LIVE): KELLZ, a casino NPC (owner's request, in Kellz's own words: flight suit with a leather flight jacket, light-skinned black, long hair "like Jesus"). art "kellz" (standard-mode recipe, 1 generation; the aviators landed on his face, not pushed up), wanders from 27,13 in the main aisle, three short pilot lines. PixelLab: about 59 generations left until 2026-10-18.
- 2026-09-20 (LIVE): Kellz redrawn darker at the owner's request ("make him darker. hes a black person"): dark brown skin, long dark hair and beard, brown leather jacket, olive flight suit, no sunglasses. Same file names, so ART_VER has kellz_south / kellz_east = 4. PixelLab: about 58 generations left.
- 2026-09-20 (LIVE): Kellz wears gold-rimmed aviators (owner: "airforce style jet pilot style glasses"), painted on BY HAND (scratchpad kellz_shades.mjs; the bare sprites are kept as kellz_noshades_*.png) so the approved drawing didn't reroll. ART_VER kellz_* = 5. No generations spent. A small, exact change to a sprite is better done by hand than regenerated.
- v77 (2026-09-20, LIVE): Kellz talks like an ULTRA Bills superfan (owner): seven one-liners, Josh Allen, number 17, Buffalo wings, blue cheese never ranch, folding tables. Text only: no NFL art or logos.
- v78 (2026-09-20, LIVE): PINNED LOOKS. G.LOOK_PICKS (lowercase name -> look number) beats the account-id hash; G.lookFor(p) is what the page calls now. bootypaper = 1 (hoodie): the hash had made the owner, a white guy, the dark-skinned polo look and he asked why. Stopgap: if more people ask, build the picker (owner chose "nobody picks" on 2026-09-20).
- v79 (2026-09-20, LIVE): THE TWO CASHIER BOOTHS ARE GONE (owner spotted the west one as an artifact: a "$" booth with a stack of cash from the Cash era, hiding the "‹ OUTSIDE" plaque over the west arch; the east one stood by an arch that closed). The House Ruby is the only Prize Counter now. The server still understands `cashier` objects (atCounter, the kind map), so one put() line brings one back (2,11 and 40,11, two wide). Server wording now says "the big ruby in the middle of the casino floor". Old UPDATES entries in the wiki still mention Cashier windows: history, left alone. o_cashier art is unused.
- DESIGN PROPOSED, AWAITING THE OWNER (2026-09-20): PLAYER LOOKS AT FIRST LOGIN. A "Who are you?" screen: ~12 drawn bodies (6 exist; ~6 more at 1 generation each: bald, afro, long-haired guy, big guy, older guy, another woman) x RECOLOURED skin / hair / top / bottoms (the standard-mode sprites are ~12 flat colours, so each body gets a one-time map of which colours are which, and the page repaints per player once and caches it; ~10 bytes per player on the wire, no new downloads), a Surprise me button, a mirror by the coat racks to change later for free. Plus a CASINO DRESS CODE: on the casino floors everyone shows their look, armour shows out the arch (otherwise armour erases the customisation). Later: outfits for tickets at the Prize Counter; site store name colours/titles over heads. Open questions to him: recolourable vs presets only; dress code yes/no; which bodies his regulars need. Offered a zero-generation recolour test on one body first.
- LOOKS: THE OWNER'S ANSWERS (2026-09-20): (1) recolourable bodies, (2) casino dress code YES, (3) MIX AND MATCH: a few hairstyles, a few bodies, "and that's it", plus team-coloured tees ("these are sports focused players"). FEASIBILITY TEST PASSED (scratchpad looktest.mjs / looktest.png, 2 generations): PixelLab standard mode (size 48, chibi, flat, low detail) obeys KEY COLOURS: a BALD body in a bright magenta tee and bright green trousers (id 52565623-d08c-4bfe-89bb-9684882b0c76), and a HAIR DONOR with bright blue hair on the same prompt (id 215927a8-4022-43a4-b876-c46e216bf593). Same template skeleton, so the donor's blue pixels drop onto the bald head and line up in every facing tested (south, east, north, south-west). Parts are told apart by HUE (magenta = top, green/teal = bottoms, blue = hair, orange low-sat = skin); each pixel keeps its own lightness step and takes the picked colour; a team tee is primary + a two-row chest stripe in the secondary (NO logos or wordmarks, colours and city names only). TO FIX in the real build: widen the bottoms hue range to ~80-190 (the trousers came out teal and didn't recolour); take only hair blobs of 12+ pixels so a donor's blue EYES don't transplant. PLAN: 4 bald keyed bodies (average man done; big guy, slim woman, average woman), ~7 hair donors (messy done; short crop, long, ponytail, afro, buzz, baseball cap in blue = a recolourable team cap), first-login "Who are you?" screen, c.look saved on the character and sent in the snapshot, a mirror by the coat racks, dress code on casino floors. Could default the tee to the player's favourite team from the site profile (users.favourite_team) later.
- LOOKS, ART IN HAND (2026-09-20, 11 generations spent, ~47 left): all standard mode / size 48 / chibi / flat / low detail, 8 facings, on PixelLab. BODIES (bald, magenta tee, green trousers): avg 52565623-d08c-4bfe-89bb-9684882b0c76, big 67dd8c11-002b-4da9-9ead-da2d3dc9804c, slimw f286b7ce-7e35-4d9b-9cfa-a15d6853d969, curvyw e92c20e7-e710-4253-95b9-74528acadfaf. HAIR DONORS (bright blue): messy 215927a8-4022-43a4-b876-c46e216bf593, crop 8ec64ffd-5dc8-4c82-b191-e626927cb92f, long 4ed826f8-554e-4330-affb-d9451760b3a3, pony 2cfe8ef4-34d9-47e0-bb07-63aa339dd54d, afro 6c8e98e3-c57e-48e2-95d7-d194595dbed6, cap 53e51414-aea2-40df-8354-fd93b3b6972b. scratchpad lookmatrix.mjs (compose(), partOf(), hairMask() with 12-pixel blobs) renders every hair on every body in south/east/north: ALIGNMENT HOLDS on all 4 bodies x 6 hairs. FLAWS TO FIX BEFORE SHIPPING: `big` came with a beard and blue-teal trousers (on a BODY, blue hue must count as bottoms, never hair; regenerate if the beard bothers the owner); `slimw`'s tee came out patterned (look at the raw sprite; probably regenerate); the ponytail's back view drops its light highlight pixels (close holes: a non-hair pixel with 3+ hair neighbours becomes hair). NOT BUILT YET: the asset builder (keyed body PNGs + hair-only PNGs into v3/assets/img/glad/flat/), the page compositor (recolour once per look per facing, cache, register like loadArt does), c.look on the character + in the snapshot, the first-login "Who are you?" screen, the mirror, the casino dress code, the team list (NFL colourways by CITY NAME, no logos or wordmarks).
- v80 (2026-09-20, LIVE): WHO ARE YOU? MAKE-YOUR-OWN LOOKS. Owner's calls: recolourable, mix and match ("a few hairstyles, a few bodies, and that's it"), team tees, NFL ONLY for now, casino dress code yes. RULES FILE: G.LOOK (4 bodies avg/big/slimw/curvyw, 7 hairs incl. bald and a ball cap, 6 skins, 10 hair/cap colours, 10 plain tees, 6 trousers, 32 NFL COLOURWAYS named by CITY with the site's abbr; no logos, wordmarks or nicknames), normLook / randomLook; c.look = [body, hair, skin, hairCol, top, team(-1 = plain), trousers], normalised in normChar. ART: scratchpad lookbuild.mjs turns the keyed PixelLab sprites into PART MAPS in flat/: pb_<body>_<dir>.png (skin (v,0,0), tee (v,0,v), chest stripe (v,v,0), trousers (0,v,0)) and ph_<hair>_<dir>.png ((0,0,v)); 80 files, 31 KB total. big = 1de72b6e-3dc7-4742-89de-3d481194e928 (v2, clean shaven, olive trousers caught by a mid-tone rule), slimw = 5a5aa9ea-83a4-46e5-b08e-186737014a8d (v2, plain tee). PAGE: registerArt() (shared with loadArt), paintLook(), lookParts(), lookSprite() (one painted sprite per look per facing, keyed by the seven numbers, shared between people; parts load eight facings at a time through facedArt), the look window (#lookWin: auto-turning preview, body/hair steppers, swatches, Plain / My team + a city select, Surprise me, Let's go; buttons wear ui/czchip + ui/czbtn), opens by itself 1.5 s after arrival when me.look is null and starts on the player's eastcoin.vip favourite NFL team (/api/picks/favourite, read in the browser). DRESS CODE: on a `floor: "casino"` scene the outfit is forced to "tiro", so everyone is drawn as themselves; armour shows out the arch. SERVER: t:"look" -> lookOp (normLook; first pick anywhere, later only within 3 tiles of a `mirror`, one a second), look in whoOf + its signature + meOf, `lookset` back to the page; the mirror is an object at 18,21 by the front door (o_mirror, PixelLab). A character with no look still wears the old look1..6 (lookFor, LOOK_PICKS). Tested locally: first-login popup, team pick, Let's go, floor sprite, reload doesn't ask again, mirror reopens it. NOT tested: two real players seeing each other's looks; production. KNOWN SMALL FLAWS: a few stray skin-coloured pixels at some tee edges and on the big guy's dark trousers; the ball cap's colour comes from the hair colour list, not the team. FIRST-LOAD CODE 128.8 of 140 KB. PixelLab: about 44 generations left until 2026-10-18.
- NEXT for looks (not built): a beard layer (drawn like hair); cap in team colours when a team tee is chosen; the casino's fake players could use random made looks instead of look1..6; outfits for tickets at the Prize Counter; site store name colours/titles over heads.
- 2026-09-20 (LIVE): FIRST LOAD, 216 REQUESTS -> 32. Measured cold: a new visitor fetched about 450 KB in 216 requests (208 of them pictures of ~1 KB, plus Google Fonts on a second host). (1) SPRITE SHEETS: tools/eastscape-pack.mjs -> v3/assets/img/glad/packs/ (49 sheets, 531 pictures; core.png 188 KB = the 130 login pictures; one whole sheet per area; one per person's eight facings incl. the look parts; packs.json 18 KB raw, gzipped by the edge). eastscape.html: packsReady / loadPack / loadArt -> loadOne fallback; loadAreaArt takes the area's sheet first; PACKS_V is bumped by the tool. _headers: /v3/assets/img/glad/packs/* immutable for a year. tools/eastscape-budget.mjs fails on stale sheets. (2) NUNITO SELF-HOSTED (v3/assets/fonts/nunito-v32-latin.woff2, Google's own latin variable file, preloaded): no second host. (3) modulepreload for the shared + sfx modules and a preconnect to play.eastcoin.vip. VERIFIED ON PRODUCTION (signed out): 32 requests, one host, font loads, core sheet served with the year-long cache. Not measured: a signed-in cold load time (needs the owner's login); what remains is ~19 ui/ images used by CSS and a few item icons. Also: your own character is drawn from me.look right after a door (the roster takes a moment; you were invisible for a few seconds in a new scene). ALSO: the 1/2, 2x and Max stake buttons are gone from every game window (owner: "it should only be 1, 5, 10, 20"); casino module ?v=27.
- v81 + v82 (2026-09-20 overnight, LIVE). The owner asked for the whole overnight list plus "tighten up loose ends... this game is supposed to be FUN, we're close to launch, gonna let some beta testers in soon", and sent requests through the night.
  * SOURCE OUT OF THE PUBLIC REPO: eastscape-worker/ removed from the Desktop deploy repo (wrangler deploys from the code repo). NEVER copy eastscape-worker/src/index.js there again.
  * EVERY WIN POPS (owner: "replicate the level up effect, even on small wins"): eastscape.html winFx(big, small) = the #lvlup banner with class `over` (z-index 9, above the game window), the levelup jingle at 0.55, a ring and 22 DOM sparks (40 for a jackpot); called from the windows module's pop(), the one place every win passes.
  * BIG-WIN CALLOUTS: pop() also reports a win of G.CALLOUT.min (10x) or better -> t:"bigwin" -> every casino floor gets a gold chat line and confetti (BURSTS) over the winner. DECORATION ONLY and taken on the window's word (the site owns the real tables; the game server never sees results): fenced to 10..500x, a whitelist of game names, casino floors only, one per 10 s.
  * EMOTES: G.EMOTES (cheers, gg, rip, wave, dance), five buttons in #emotes by the chat tab, t:"emote", one per 1.5 s, shown as a bubble over the head (botBubbles), never in the chat log.
  * STORE COSMETICS OVER HEADS: functions/api/eastscape/verify.js adds `cos: { name, title }` from the store's cosmeticsFor (read-only, a failure = plain name); the game server re-checks the shapes, keeps pl.cos, sends it in whoOf; the page colours the name (STORE_NAME map; an EARNED VIP colour still wins) and prints « title » under the level. NOT testable locally (dev logins skip verify): check on production with someone who owns a name colour.
  * tools/eastscape-two.mjs: TWO PLAYERS over the real local socket (dev logins with &plain=1 = not admin; sends the page's Origin). 16 checks: rosters, looks seen by the other player, mirror rule, emote + spam fence, callout + its fences, trade request, chat. All pass. Run it after any change to what players see of each other.
  * COMBAT FEEL (owner: "more impactful. Visual effects, crit hits"): the server flags `crit` (a roll in the top sixth of your max hit; the DAMAGE IS UNCHANGED) and `kill` on a splat; the page draws rays on every hit, a bigger gold splat + "CRIT" + a lower thump + coins chime + 160 ms screen shake on your crits, a puff on a kill, a shake when you take a quarter of your life in one hit. Nothing under reduced motion.
  * THE FIGHT PIT IS DRAWN: PixelLab tileset t_pit (flagstones, a raised sand ring, plank kerb; def.pitFloor, Wang corners from the pit's oval in paintRoom; the code-drawn oval steps aside), o_fightboard, o_ringbell, four o_ringpost torch posts (only placed on free tiles). The bet button label is short now ("Bet on Cumulus Ram · 1.82x") and .cz-lock can never wrap out of its art.
  * LOOKS: hairs bob / bun / pigtails (owner: options for the 1-3 women in the community; appended so saved indexes hold), a BEARD slot (look[7], 0/1; seven-number looks read as clean-shaven), a ball cap takes the team's colour when a team tee is on, the team list shows FULL NAMES ("Arizona Cardinals", owner's request; the tee itself still has no logo or wordmark), stray-pixel pass in scratchpad lookbuild.mjs, and the casino's fake players wear made looks (G.botLook(name)). 112 part files.
  * FAKE PLAYERS SHOW WHAT THEY'RE DOING (BUSY_TAG over the head); EVERY SCENE HAS ITS OWN SHADOWS (SCENE_SHADOW: alpha / flat / skew per scene).
  * v82: BOM TRADY RUNS THE PRIZE COUNTER (owner: "replace the ruby portal thing... with bom trady graphic, and put counters around him that have prizes. hes the head honcho and the goat"). The existing `tom` sprite at 2x (OBJ_SCALE.tom_south) on the `coinstatue` object at 21,13, six `prizecase` objects (o_prizecase1/2, PixelLab) in a U behind and beside him, front open; cases are kind "cashier" and count as the counter server-side. Copy says Bom Trady, not the big ruby. o_coinstatue is unused. tom_south moved from the farm's art list to login art.
  * PixelLab: about 33 generations left until 2026-10-18.
- v83 + v84 (2026-09-20 overnight, LIVE).
  * v83: stale player-facing wording: the welcome message (it still sent people to "the Cashier by each arch"), "How GAMBA works" -> "How EastScape works", "Brutus sells them in the workshop" -> Bom Trady, the Yard's sign. scratchpad stale.mjs lists player-facing strings that use retired names (Cash, chips, Forge, Brutus, smithing remain ONLY in closed content).
  * THE WHEEL IS DRAWN (owner): PixelLab drew a whole wheel; casino/wheel_frame.png is its RIM AND HUB ONLY (everything between 0.30R and 0.765R punched out) laid over the exact conic-gradient slices as .cz-wheel::after, so it spins with the wheel; casino/wheel_pin.png is the pointer. THE SLICES ARE NEVER ART: where the pointer lands is the result. Casino module ?v=29.
  * v84: THE ROAD ISN'T ALWAYS WEST (owner: "i just click left... there needs to be some randomization"). Way ON: Yard NORTH, Gloam west, Mire NORTH, Boneyard NORTH (up to Cloudreach), Cloudreach west. Way BACK is still every scene's east edge. NORTH_ROAD(g, keep) lays a path up column 22. The game server now drops you at whichever edge of the destination LEADS BACK to where you came from (falls back to the opposite edge), so exits no longer have to be reciprocal: the content check's "does not exit back" warnings for these five links are expected. Moved off the new paths: two Yard tomatoes, the Mire's tax wraiths (x+8), the Boneyard's chandelier spiders (x+9) and one understudy; the three "North:" signs stand at 20,11 (west of the road) because the aggro check would not have them within the old reach of those camps. Tested both directions Yard <-> Gloam locally; Mire and Boneyard checked by the tools only.
  * NOT DONE FROM THE OVERNIGHT LIST, AND WHY: (3) moving closed content out of the first load: measured first; the closed scenes are only ~3-4 KB of the 132 KB and `isle` counts as closed while islands are in use, so the risk right before beta outweighs the gain. Do it after beta, or when code passes ~137 of 140. (5) more custom art: the audit that said slot reels and scratch symbols were emoji was WRONG (they are drawn: casino/reel_*.png); what is still code-drawn is small (rope lines, plain rugs, hay, forum rocks, the bathhouse counter, marble/wood room floors, walls, banners and lamps, the Russian Roulette hammer). (8) regular roulette: not hunted blind; needs one sentence from the owner on what he saw.
  * DRAFTS for the owner: EASTSCAPE-DRAFTS.md (gear drop table, the separate dashboard, community events, and his shopping list of hit/crit/win sounds and effect sheets).
  * tools/eastscape-two.mjs passes 16/16 against the final server. tools/dex-test.mjs 77/77. PixelLab: about 31 generations left until 2026-10-18.
- v85 (2026-09-20, LIVE): BOM TRADY'S KIOSK (owner, with three photos of shop counters: "black ones with led lights on the item. like a guy standing around black counters"). ONE object (`coinstatue`, 19,12, 5 wide x 3 deep, all blocked) and ONE picture, o_bomkiosk.png (160 x 184), composed by scratchpad kiosk.mjs from three PixelLab pieces (raw_ledA: cyan-lit glass case of trophies and plush; raw_ledB: magenta-lit case of gear and tickets; raw_ledP: a plain black block with a cyan LED edge) plus the `tom` sprite at 2x: back run, the two ends, Bom, then the three lit cases in front of his legs so he stands BEHIND the counter. One picture because separate objects can't layer a man between counters. The v82 `prizecase` objects and OBJ_SCALE.tom_south are gone (the server still understands prizecase). The label is measured from the kiosk's foot. Walking round it east-west works (tested). To change what is in the cases, regenerate a piece and rerun kiosk.mjs, then the pack tool. PixelLab: about 28 generations left until 2026-10-18.
- HAPPY HOUR, explained to the owner 2026-09-20 (not built, awaiting his go): 8-9 PM Central nightly: Dex's round for the room is free, a second Daily Prize Wheel spin for anyone on the floor, one line to the floor when it starts. Tickets and buffs only. FUN IDEAS RANKED for him the same day (none built): 1 a sportsbook corner + game-day TVs reading the site's live scores and Picks (open pick over your head, confetti for your team's tee when they score); 2 world events out the arch (a Golden Chicken, announced); 3 a floor-wide meter that pays everyone a free wheel spin; 4 ticket bar games, player v player (dice duel, flip cup); 5 watch a friend's table; 6 a useful "out of plays" message; 7 outfits for tickets + a weekly titles board; 8 the jukebox plays the Green Room.
- 2026-09-20 (LIVE, page + art only): BOM TRADY REDRAWN (owner: "obvious... jersey on and looks like tom brady. giga jawline, people should immediately laugh"). A parody caricature by text prompt (the owner's photos were NOT sent to PixelLab): standard mode, SIZE 96 so he is big at native pixels (the old one was the farm's `tom` sprite doubled), custom proportions (head 1.6, shoulders 1.4). Two takes kept in the scratchpad: bomA (navy 12, red/white shoulder stripes, silver pants, the jaw: USED) and bomB (white 12, navy sleeves). RULE KEPT: number and colours only, NO team logo or wordmark on the sprite, same as Bino's jersey and the team tees. scratchpad kiosk.mjs takes BOM=<file> to swap him; rerun it, then tools/eastscape-pack.mjs. The farm's old `tom` NPC sprite is unchanged (closed scene). PixelLab: about 26 generations left until 2026-10-18.
- v86 (2026-09-20, LIVE; the app quit right after the deploy, confirmed live afterwards: shared ?v=96 / VERSION 86, PACKS_V 8, casino ?v=29).
  * THE JUKEBOX PLAYS REAL RADIO (owner asked for the Radio Garden API). NOT RADIO GARDEN: its "API" is an unofficial spec of a private one and answers anything but their own site with a Cloudflare bot challenge (403 "Just a moment"); getting round bot protection is off the table. Built on RADIO BROWSER instead (api.radio-browser.info: open, no key, CORS *, https streams; mirrors de1 / fi1 / de2 in G.RADIO.hosts). ONE station for the whole casino. The PAGE searches the directory directly (name= or tag=, is_https, hidebroken, by clickcount; eight genre buttons) and sends ONLY the station UUID (t:"radio", op:"set"); the GAME SERVER (radioOp) must find you within 3 tiles of the jukebox, allows one change per G.RADIO.everyMs (20 s) for the room, looks the UUID up itself and takes name + url_resolved from the directory (https only), stores this.radio (DO storage key "radio"), tells every casino floor and posts a casinonote. op:"stop" turns it off for everyone. Page: one <audio>, plays only on casino floors (casino / roulette / fightpit / highroller), own volume and mute in localStorage (es_radio_vol, es_radio_off), a refused play() retries on the next click, #jukeWin. Sent on login and on walking onto a floor. Tested locally end to end (genre -> 25 stations -> set -> verified -> now playing); NOT yet heard on production, and some stations will refuse to play in a browser (the window says so).
  * BOM TRADY, GIGACHAD (owner: "too AI looking. make him have harder lines in his face, gigachad style", then a reference photo): all BY HAND on take A (scratchpad bom_rings.mjs -> bom_chad.mjs -> bom_chad2.mjs -> bomA_final.png): one skin tone, black outline, a jaw that drops straight and turns a hard corner into a wide flat chin, shadow planes under the cheekbones, one-sided nose shadow, flat downturned mouth, chin cleft, black brows, EYE BLACK under both eyes, stubble, darker hair, and SEVEN RINGS (four on the fist, three on the ball hand). Rebuild with `BOM=bomA_final.png node kiosk.mjs`, then the pack tool. ART_VER o_bomkiosk = 5.
  * RONY TOMO (owner: a drunk Cowboys quarterback by the wheels, "WE DEM BOYZ", "Dez caught it"): art `rony` (standard recipe, 1 generation: navy 9, beer, no star or logo), wanders from 7,17, six lines.
  * First-load code is 134.4 of 140 KB: THE NEXT FEATURE NEEDS THE CLOSED-CONTENT TRIM FIRST (or a deliberate budget raise). 16/16 two-player checks pass on this build. PixelLab: about 25 generations left until 2026-10-18.

- v87 to v94 (2026-09-20 night into 2026-09-21, ALL LIVE; shared ?v=104 / VERSION 94, casino ?v=31, sfx ?v=5, wiki ?v=70, PACKS_V 13).
  * SOUND: `SFX.setMuted/muted` (es_mute) and `SFX.setAllVolume/allVolume` (es_all): ONE pill top-right of the game beside BUFFS (`.hudtr` > `#volBar` + `#buffBar`): mute button (M) + a slider over effects AND the jukebox. The top-bar mute lasted a day. THE RADIO STOPS WHEN YOU LEAVE: `radioGone()` (no socket / kicked / a hidden page on a PHONE), `radioKill` on pagehide + freeze. Desktop background tabs keep the music on purpose.
  * JUKEBOX: moved to casino 18,10; a second one in the Yard (38,9) on a concrete slab (`rug` + `concrete`, `paintSlab()`); `RADIO.heard` = every scene the ONE station plays in. PAY TO PLAY (v89): `RADIO.cost` 100 tickets, charged after the station is known to play; the pick is its buyer's for `RADIO.holdMs` (10 min: nobody else can change or stop it; buyer and admins can). `tools/eastscape-juke.mjs` = 6 checks over the real socket (dev admin = no &plain=1). CLICK FIX: `thingAt` treats a rug as the floor (anything on it wins the click).
  * BOM TRADY'S KIOSK is DRAWN now (`tools/eastscape-kiosk.mjs`: a straight black U with LED edges, three lit cases, small prizes on the tops; reads Bom's sprite + raw_ledB from the f5b2f236 session scratchpad). BOTS AT TABLES emit `botbet` (pretend +/- numbers over their heads; server BOT_GAMES / BOT_STAKES / BOT_WINS).
  * LOOKS (v90): Guy / Girl first (`LOOK.sexes`, `sexOfLook`, `randomLook(rnd, sex)`; the old no-sex roll is kept number for number for bots), opens on Guy, body "Fat as shit" (`fat`, PixelLab 3fd5156c-5ea6-4349-a160-eaec76b4d724, 1 generation), "Pants". `tools/eastscape-lookbuild.mjs` (now in tools; ONLY=a,b limits bodies) learned: PALE SKIN IS SKIN (s 0.12-0.28 warm; the Big guy never took a skin colour) and pale highlights ringed by skin become skin (the "vitiligo" on the women). `tools/eastscape-hairclean.mjs` removes detached below-shoulder blobs from ph_* (the BEARD carried a piece of its donor's jeans at hip height in all 8 facings; the cap in 2). Run lookbuild -> hairclean -> pack.
  * CASINO WINDOWS: a ticket stake says tickets (`stakeTxt`: "Spin · 5,000 tickets"; prizes still say ZC); drawn ticket (`TIX_IMG`/`tixHtml`) instead of the emoji in the stats + tab. Stats panel's tickets icon = items/tickets.png.
  * THE ROAD (v92, `tools/eastscape-road.mjs` prints it): pay per minute was FLAT inside every area (first monster = best farm). BOUNTY now climbs ~4% a step along the whole road, nothing lowered (Yard 189->230/min ... Thunderhead 1,641->1,920). JACKPOT KILL: `JACKPOT_KILL` 1 in 50 pays 5x the bounty in tickets (+10% EV), event `jackpotkill` -> winFx banner, casinonote to the area. MEASURED, NOT CHANGED: levelling is very fast (Yard 1->10 about 8 minutes of fighting, road to 50 about 2.7 hours at the best monster); the owner should decide if that is what he wants.
  * v93: THE REGULARS' WELCOME (`welcomeOnce`, es_welcome, once per browser after you have a look: same games/same ZCoins + tickets are new; buttons open the games list or walk you out the west arch) and the Games button glows until first pressed (es_games_seen). BAR PRICES x10 (drinks, dinners, the round; scroll home still 50). `hoverTile` default false + a ONE-TIME switch-off for saved characters (`hoverOff` marker in normChar: saved characters copy every setting, so a default change alone reaches nobody). v94: Kellz stands at 36,7.
  * ART AUDIT: every open-world mob, NPC, item and scenery kind has art; only deliberate code-drawn things remain (rope lines, section rugs, the slab, the bathhouse counter). PixelLab: 32 generations left until 2026-10-18. NOT BUILT, offered: a Songs tab on the jukebox using the Green Room's YouTube queue (synced by {videoId, startedAt} over the game socket, tickets per request).

- v95 to v97 (2026-09-21, ALL LIVE; shared ?v=107 / VERSION 97, casino ?v=32, songs ?v=1, sfx ?v=5, wiki ?v=73).
  * v95: players walk 20% faster (`STEP_MS` 240 -> 200; mobs/NPCs keep the server's own 240). The message feed sits above the Chat button + emote row (`.feed{bottom:94px}`).
  * SONGS (v96): the jukebox has Radio / Songs tabs. NEW LAZY MODULE `v3/assets/js/eastscape-songs.js` (in the ship tool's FILES; loaded on the first Songs tab or the first `song` event, never at login: first-load code is 138.3 of 140 KB). Rules beside `RADIO.song` (50 tickets, 20 s to 8 min, queue 10, 2 each). The GAME SERVER owns the queue (`songOp` / `songTick` / `songMsg`, DO storage key `songs`; runs off TIMESTAMPS so a sleeping world wakes in the right place); it asks the MUSIC WORKER's new `/video?id=` (videos.list, 1 quota unit, cached a day; deployed with `cd worker && npx wrangler deploy`) BEFORE charging; refuses live streams, non-embeddable and out-of-range lengths. Search = the music worker's existing `/search` (100 units uncached, 5 min cache) on submit only, or paste a link (0 units). Sync = every browser seeks YouTube's player to `now - at`; the player is a visible 240 px dock bottom-right of the game. The station waits while a song is on. `tools/eastscape-songs-test.mjs` = 8 checks. TEST MUTED: set localStorage es_mute=1 in the preview tab first (a test song played out loud in the owner's Claude window).
  * HISCORES (v96): the endpoint had NO CORS header, so the button said "unreachable" to everyone in production; now `Access-Control-Allow-Origin: *`. Boards are `G.HISCORES` (combat, fishing, earned, wagered, kills, zcoins), rows `{rank,name,v,sub}`, top 100, number boards list only people with a number. `hsboard` object on the casino's back wall (26,4) opens the same window (server kind `hiscores`).
  * TICKETS TRADE (v96): trade op `cash` clamps to what you hold; the page has a number box. Was blocked since v57 against feeder accounts; what still bounds that is the site's per-RECEIVING-account caps. `tools/eastscape-trade-test.mjs` = 4 checks.
  * HOUSE TOUR (v96): step 2 ("free chip") could never finish at the real tables. Any real play reports `{t:"tour",op:"played"}` (casino module `played()`), and reading the job board clears it too. v97: `chip_free` is named "Green house chip" (it cashes to 100 tickets; a tester looked for it on the table).
  * "the arch" -> "outside" in every player-facing string (old Updates history entries about the WEST/EAST arch left as history). The welcome shows after ANY character's first look (`LK.fresh`), not once per browser. Window titles never wrap (`.win-head b{white-space:nowrap}`).
  * Local dev gotcha seen again: a wedged wrangler/workerd answered 127.0.0.1 (node tests passed) while the browser's `localhost` WebSocket failed. Kill by CommandLine match and restart.

- v98 + v99 (2026-09-21, LIVE; shared ?v=109 / VERSION 99, wiki ?v=75).
  * v98: HISCORES "Quests completed" (`G.questsDone(c)`: story quests done + the House Tour walked to the end + `c.stats.jobs`, a lifetime count of daily jobs CLAIMED that starts at v98; the three story quests are all in closed areas).
  * v99: YAHSMEENA ON EVERY ISLAND (`ISLE_NPCS`, at 13,3 by the cottage on isle / isle2 / isle3): a beta tester who asked to be the island decor seller; the owner said yes. She talks; THE DECOR SHOP IS NOT BUILT (next: what she sells, where furniture can be placed on an island, prices in tickets). NEW: an NPC may carry `look` (a player look's eight numbers) instead of `art`; the page paints it with lookSprite, and the content check accepts it (it errors on a look that isn't one). Her look was read off the owner's screenshot: [3,9,3,0,0,-1,5,0] (curvy, pigtails, white top and pants); ask her if it's right. The talk window's portrait is the 🙂 fallback for a look NPC (no face crop yet).
  * A deploy went out with the content check printing 3 ERRORS because my command only grepped its summary line and carried on (they were the look-NPC false alarm, fixed in the tool). Make the deploy command stop on a non-zero error count.

- v100 (2026-09-21, LIVE; shared ?v=110 / VERSION 100, wiki ?v=76). First-load code 138.9 of 140 KB: THE NEXT PAGE FEATURE MUST BE A LAZY MODULE OR COME WITH A TRIM.
  * EMOTES IN GAME CHAT (Kellzifer asked): `functions/api/eastscape/emotes.js` boils the channel's 7TV (877, a 2 MB answer) + BetterTTV (50) lists down to `[[name, url, wide]]` (925 emotes, 72 KB raw), cached an hour at the edge, stale-if-error a day; zwades' Twitch id 215028532 is a constant there. The page fetches it on the FIRST chat line (never at login) and swaps whole words that are emote names for a 24 px image in the chat LOG (`emoFill`, text nodes otherwise, players' lines only). NOT in the over-head speech bubbles (canvas text) and no picker: both are follow-ups. NOT verified live with a real chat line.
  * A look NPC gets her real portrait in the talk window (the painted canvas as a data URL; retried while the front-facing sprite is still being painted) and may carry `tag` ("Yahsmeena - NPC" over her head).
  * DECOR SHOP: catalogue + placement rules drafted in EASTSCAPE-DRAFTS.md section 5, awaiting the owner. Not built.
  * The deploy command now stops if the content check reports any error.

- v101 (2026-09-21, LIVE; shared ?v=111 / VERSION 101, wiki ?v=77, decor ?v=1, decor-rules ?v=1). First-load code 139.9 of 140 KB: NOTHING more fits in the page or the shared file without a trim.
  * YAHSMEENA'S DECOR SHOP. 34 pieces (19 outside, 15 cottage), tickets, all for show. RULES FILE OF ITS OWN: `v3/assets/js/eastscape-decor-rules.js` = `createDecorRules(G)` -> DECOR, DECOR_CAP (isle 12/20/32 by tier, home 12; flat pieces count a quarter), DECOR_SELLBACK 0.25, decorInto (lays an owner's pieces over a fresh build: objects + blocked tiles), decorFits (owned + spare, right kind of scene, open ground, no overlap, wall pieces on the back row, and WALLS NOTHING OFF: every tile reachable from the entry before is reachable after). It is HANDED the shared rules, never imports them (one copy of the big file in the browser). The game server imports it; the page fetches it on the first furnished island or on Decorate. The shared file only keeps the save's shape (isle.owned, isle.decor [{k,x,y,at: isle|shore|home}]).
  * SERVER: `decorOp` (buy/sell need Yahsmeena within 3 on your OWN island; place/take anywhere on your own island/shore/cottage; nobody may be standing on the footprint), `decorLay(S)` rebuilds an owner scene from a fresh build + pieces (islands keep no other state in their objects), `decorTell` re-lays every loaded scene of that owner and tells who is there. The furniture list is sent on the way in and on change, NEVER in the snapshot. An island upgrade puts any piece the new land covers back in the tray.
  * PAGE: `eastscape-decor.js` (lazy: shop window + decorate tray + ghost), the Decorate button (own island only), decor art loads on first sight (`wantArt`; d_*.png are NOT packed). `tools/eastscape-decor-art.mjs` downloads the 25 PixelLab objects (ids inside), trims, tiles the path, and makes the six colour variants by turning the reds. `tools/eastscape-decor-test.mjs` = 12 checks (resets the dev admin's character first). PixelLab: 25 generations spent, about 7 left until the owner upgrades.
  * NOT BUILT (said so in the catalogue draft): wallpaper / floor as room settings, a working party speaker (island added to RADIO.heard) and TV (live scores), sitting on benches, trading pieces, team-coloured flags. Also open: a look NPC's shop on the FAR SHORE has no Yahsmeena (buy on the main island).
  * GZ quick emote. PARTY DUNGEON + BOSS: feasibility answered to the owner 2026-09-21 (claims are already off in pvp scenes, per-owner scene instancing exists for islands, aggro exists; needs a party invite, shared-kill credit by damage, instancing per party); not built, awaiting his go. ASCENSION idea logged under Next up.

- 2026-09-21: island farm plots and the pet pen have PixelLab art (o_plot replaced, o_pen new; tools/eastscape-plotpen-art.mjs) and BOTH SAY "Not ready yet, coming soon." (owner's request). Planting is switched off in ONE place (actDo: `a.kind === "plot" || "pen"`) plus the `plant` isle op; isleUse and any growing crops are untouched. PACKS_V 14. PixelLab: 5 generations left.
- THE VAULT (party dungeon), OWNER SAID GO 2026-09-21: "yes to all of these and yes to everything you explained about the dungeon build". The design is EASTSCAPE-DRAFTS.md section 6. Decisions taken from his yes: a PARODY boss (I chose Bell Bilichick, "the Hoodie", the grumpy coach to Bom Trady's quarterback: a cut-off grey hoodie, no team logo or wordmark, same rule as the others); stake/pay at 1.5x solo (500 / 1,500 / 2,500 in, about 5,000 / 14,000 / 22,000 out); parties of 2 to 4; the door in the FORUM beside the bank; built BEFORE ascension classes. Art is limited to 5 generations until he upgrades PixelLab: build with existing sprites standing in and generate the boss first.

- v102 (2026-09-21, LIVE; shared ?v=112 / VERSION 102, wiki ?v=79, closed ?v=1). FIRST-LOAD CODE 135.7 of 140 KB (was 139.9): the 11 CLOSED scenes' maps moved to `v3/assets/js/eastscape-closed.js` = `createClosedScenes(G, G._MAP)` (`_MAP` = the map helpers grid/block/wild/keepOf/room, exported at the end of the shared file). The game server and the tools register them at start (`Object.assign(G.SCENES, ...)`); the page's `onMsg` fetches them only when told about a scene it doesn't know (`moreScenes()`), and `predictExit` won't predict into an unknown scene. All 27 scenes were checked to build byte-identical before and after. The scene list in the shared file is built in FOUR blocks (`export const SCENES = {` + three `Object.assign(SCENES, {`). THE SAME HOOK IS WHERE THE DUNGEON'S MAPS GO. Also: the new-player explainer now comes BEFORE the character builder (`welcomeOnce(true)` on a character with no look: one button, "Make my character"; then "You're in." with the two ways to start).
- THE CRYPT (party dungeon) BUILD, IN PROGRESS. Owner 2026-09-21: bought more PixelLab credits ("use them as needed"); AESTHETIC = DIABLO 2: dark crypt, skeletons, ghosts. So it is CATACOMBS UNDER THE CASINO, not a vault: Skeleton Guards, Restless Ghosts, a Bone Golem, and the boss a hooded lich, "The Hoodie" (the parody he said yes to: a grim coach in a cut-off hood; no team marks). Everything else as in EASTSCAPE-DRAFTS.md section 6 (parties 2-4, ante 500/1,500/2,500, pay about 5,000/14,000/22,000, 3 paid runs a day, door in the Forum by the bank, don't-stand-in-the-red slam, adds at half health, 5 minute enrage, own loot roll each, no hospital bill, wipe loses the ante). HE ASKED HOW TO TEST ALONE: admins may enter solo. PLAN: (1) art; (2) `eastscape-crypt-rules.js` (scenes, monsters, numbers: a factory handed G, registered by the server, fetched by the page through `moreScenes`); (3) server: parties, private copies `crypt1:<partyId>` etc., shared kills by damage, boss brain, ante/pay/daily count; (4) lazy page module: party box, invite, the red tiles; (5) a three-player socket test; (6) hiscores + the floor announcement.

- v103 (2026-09-21, LIVE; shared ?v=113 / VERSION 103, wiki ?v=80, casino ?v=33 (CV 2), crypt ?v=1, crypt-rules ?v=1). First-load code 136.5 of 140 KB.
  * THE CRYPT + PARTIES, BUILT. Rules: `v3/assets/js/eastscape-crypt-rules.js` = `createCryptRules(G, G._MAP)` -> CRYPT (numbers), mobs (12: four creatures x three tiers, `art` shared; MOBS may now carry `art`), scenes.crypt (ONE 44x26 map: Ossuary | gate 0 | Haunted Hall | gate 1 | antechamber with a bank chest and the LEVER | gate 2 | Sanctum), roomOf(x). Server: `eastscape-worker/src/crypt.js` = `installCrypt(World, { G, R, rint })`, called at the END of index.js, plus one-line hooks in index.js (mayFight/claims off when `def.shared`; cryptHit on a swing; killMob -> cryptKill; die -> cryptDeath; mobsTick: nothing respawns, the boss's target = most damage in 10 s, enrage doubles his hits, cryptBossTick = slam / whistle / enrage; leave -> partyLeave; cryptTick once a second; moveToScene sends `cryptgates`; hiscores "time" boards from storage key `cryptTop`). A run is a PRIVATE COPY `crypt:<id>` with S.run; max 6; deleted when empty. Ante taken from everybody only if everybody can pay; a clear pays once (S.run.paid) via tixTo, halved under 10% of boss damage, quartered past 3 paid runs a Chicago day (C.crypt {day,n}); zcoin roll at 10x; C.stats.crypt counts clears. ADMINS MAY ENTER ALONE (the owner asked how to test by himself) and the admin `tp` now works inside the private copy you're standing in. Page: `eastscape-crypt.js` (lazy: party box, invitation popup, the stairway window, gates, the boss bar, the win banner); page glue = `cryptRules()`/`cryptLoad()`, `moreScenes(k)` (crypt* -> the crypt rules, else the closed maps), TILEFX (the red slam tiles), `MOBS[m.t].art`, `ob.open`, the PLAYER CLICK MENU (Trade / Invite to party; it used to fire a trade request at once), the crypt's flagstones and inner walls in paintRoom (`def.crypt`). Forum: `cryptdoor` at 14,6. `tools/eastscape-crypt-test.mjs` = 21 checks with three sockets (a whole run to the pay-out). ALL SIX SUITES = 67 checks.
  * ART (PixelLab, the owner bought credits): cryptguard / cryptghost / cryptgolem / hoodie (characters, the EAST view; ids in lt-crypt/), o_cryptgate, o_cryptlever, o_sarcophagus, o_bonepile, o_crypttorch, o_cryptdoor. Diablo 2 look as asked. NOT packed (loaded by AREA_ART.crypt when you walk in).
  * NOT BUILT YET from the design: boss-only gear, the cottage trophy (Yahsmeena's catalogue), sitting out the 10 s on death (you respawn at the stairs at once and walk back), a party minimap. BALANCE IS UNTESTED WITH REAL PLAYERS: the numbers in CRYPT and mk() are first guesses; tools/eastscape-road.mjs does not cover the crypt yet.
  * The Coin Flip's two faces were redrawn as one gold coin (tools/eastscape-coin-art.mjs: Z on heads, a star in a wreath on tails, 75 px = exact 2x in the window). That is the EASTSCAPE casino window's coin; the site's own /?view=flip page is separate art.

## 2026-09-21: fishing sounds (recorded), v105/v106 fishing spots

- **Recorded fishing audio**, both packs CC0 from OpenGameArt: "Fisheefects" (You're Perfect Studio / Memoraphile, https://opengameart.org/content/fisheefects) and "40 CC0 water / splash / slime SFX" (rubberduck, https://opengameart.org/content/40-cc0-water-splash-slime-sfx). Raw downloads in `lt-audio/`; `node tools/eastscape-fish-audio.mjs` (job list: `tools/eastscape-fish-audio.json`) cuts the WAVs to mono 22 kHz in plain JS (no ffmpeg here) and copies the OGGs into `v3/assets/audio/fish/` (456 KB, fetched on first play only). Wired in `eastscape-sfx.js` (v6): `cast` (3 takes), `fish_reel` (2), `fish_catch` (4), `fish_rare` (the water's second fish), `fish_water` (quiet loop while your act is "spot", checked every 500 ms). A real ZCoin line now plays `jackpot`. A browser that can't decode OGG (older Safari) keeps the WAV takes and the synth fallback. NOT used: `uhoh.wav` (the server sends no event for a missed cast), the UI cursor sounds, the slime sounds. Nobody has LISTENED to these in the game yet: levels were set from peak measurements.
- v105: fishing spots scattered (`scatterSpots`), five PixelLab looks `o_spot1..5`. v106: a rod reaches 3 (`reachOf`), because the "b" bank row can't be stood on; the variant picture is chosen in `objArt`. The content check proves every spot reachable.

## 2026-09-21: profiles, and steady skilling sound

- **Anybody's profile** (the owner, with RPG MO's Profile window as the model). Server: `profileOp` in index.js, asked by NAME (chat, a board) or by ID (a click in the world), answered from the live player or, when they are offline, `who:<login>` -> `char:<id>` the way the admin lookup does. Public only: name, look, cosmetics, every skill level and xp, combat, total, kills, quests, crypt clears, deaths, tickets EARNED, minutes played, first seen. Deliberately NOT: tickets held, bank, ZCoins, inventory, where they are. Page: `eastscape-profile.js` (lazy, ?v=1 — the first load is at 139.4 of 140 KB, so this could not be built into the page), four ways in (the click menu, right-click, a chat name, a Hiscores row). Trade / Invite buttons appear only when `nearby(name)` finds them in your own scene, which is also the only time those ops work. A "+" row on the crypt boards ("A + B") opens the first name.
- **Sound**: every repeating skilling sound is `steady` (one take, one pitch) and quieter; fishing, cooking, the bag, chopping, mining, smelting, smithing. The recorded fishing plops were replaced by synthesized ones, so the only recording left is the CC0 water loop. OSRS and RPG MO sounds were asked about twice and refused both times: neither publishes a licence, the OSRS wiki tags its own as non-free, so shipping them in a game that pays real currency is a takedown waiting to happen.
- **Gear tooltip** (same day): `eastscape-tip.js` (lazy, ?v=1), shown on hover over anything tagged `data-item` / `data-k` / `data-rm` whose item has a `slot`. It draws `G.compareOf`: the piece's own numbers, requirement (red when unmet), then what changes against the worn piece (green/red rows, max hit, swing, walking speed, buffs lost). The native `title` is put aside while it shows and its last line becomes the footer. The Prize Counter's gear buttons are wrapped in a `<span data-item>` (casino.js v35) because a disabled button swallows hover in Chrome. No tooltip on touch. Profile (?v=2): every icon is game art now (skill_*.png, ui/total, combat, quests, scroll, the ticket, and three new PixelLab icons ui/p_kills, p_crypt, p_time); a player with no made look is drawn with the stock look their name picks; the top-right name is a button that opens your own profile. FIRST LOAD IS 139.6 of 140 KB: the next thing that touches the page itself needs a trim first.

## 2026-09-21 (late): tickets for ZCoins at the counter; exchange cancel; the ticket-table plan

- **Cash-out is back** (the owner reversed his 09-19 "betting tickets is the conversion"). `dexOp` op "cash": takes zc x DEX.rate tickets and asks the site's existing `pay` (hourly allowance shared with ticket stakes and found-ZCoin banking, day breaker, once per id); the record carries `cash: true` so the answer says op "cash" and a refusal refunds TICKETS. No site change. Window: `cashCard()` in casino.js (v37), pop-up "You got N ZCoins! Now get out there and grind some more." `tools/eastscape-cash-test.mjs` (8 checks, against dev mode's pretend exchange). `stats.cashedZc` counts what each player has traded in.
- **Exchange cancel** returns to the BAG first, then the bank, and names the item and the place; held in the offer's box only when both are full, and says so. `tools/eastscape-ex-test.mjs` (7 checks). Kellzifer's "vanished" item was in his bank.
- **BUILT in v107 (see the next entry). The plan as it was approved:** The owner said yes to: the eight table games take tickets and pay tickets (ZCoin bets unchanged), Pit and Roulette left as they are for now. Plan: the Tickets toggle opens the game server's OWN engine (`bet` / `run`, all eight games still there, buffs already zeroed by edgeOf) instead of staking a voucher; a new op `tixgame` replies with the existing `{type:"game"}` message so the page barely changes; drop the "plays for real ZCoins now" refusals in bet()/run() and let `near` pass anywhere on the casino floor; CASINO min/max bet 10 / 20,000 with chips 100 / 1K / 5K / 20K (needs a VERSION bump); slots' jackpot share reads CASINO.maxBet, so check it after. Measured returns of that engine: flip 97.5%, dice 96.1-97%, wheel 96.5-97.2%, plinko 97.1%, scratch 97.5%, slots 94.2% + 2% jackpot slice, hilo/mines 0.97 edge: a mild ticket sink, which is fine now that the counter converts at par.

## 2026-09-21: v107, tickets in, tickets out, in the band

- **The eight floor tables take tickets and pay tickets** on the game server's own engine (`bet` / `run`); ZCoin play is untouched and no site code changed. The window's ZCoins / Tickets switch swaps the whole table: Tickets sends `tixgame`, the server answers with the old `{type:"game"}` opening message, and the choice is remembered (`gs_real_cur`). `floorTix()` / `vt()` in casino.js (v38) tell the three modes apart; voucher stakes (`vt`) are now ONLY the Pit and Roulette. Ticket bets don't touch the hourly ZCoin allowance.
- **The band** (the owner: "all games should return between 96-104%, just like the current eastcoin casino"): `G.EDGE_BAND`, `edgeDraw`, `tableReturn(g, res)`, `paidMult`. A play pays stake x nominal x draw / tableReturn, so every game is exactly fair before the draw and the draw IS the return (uniform, mean 1). Hi-Lo and Mines take one draw a run (`r.edge`). Slots' table is priced at draw less the 2% jackpot slice. Quoted prices are the fair ones now (coin 2, wheel 2.03 / 60, dice rtp 1, HILO/MINES edge 1). Limits 10 to 20,000; jackpot seed 20,000, cap 500,000 (a saved pot under the seed is topped up on load).
- `tools/eastscape-tix-test.mjs`: 15 checks (the rule exactly for every game, the draw's spread, 48 real plays over the socket, limits, a Mines board).
- **First-load budget is 200 KB now** (the owner), was 140; the page is at 140.1.
- NEXT (asked for, not started): drop the Forum; move the market stall, the Crypt's stairs and Charon (the boat) to the Yard by the jukebox; the bank chest is already there.

## 2026-09-21: v108, the Forum is closed; its three useful things are in the Yard

- The owner: "lets get rid of the forum area, and move the important npcs to the area by the jukebox. the market lady, the crypts entrance, and the boat guy ... no need to move the bank since there's a bank box". In the Yard now: Exchange stall 30,17 with Livia 31,16; Charon's cart 37,17 with Charon 39,16; the Crypt's stairs 35,10 (CRYPT.door = workyard 35,12); beside the bank chest 35,16, the campfire 40,15 and the jukebox 38,9. `forum` and `bathhouse` left OPEN (their definitions stay in the rules file); a character saved in either wakes in the casino (normChar). The casino's front door, the islands' way back and ISLE_FERRY all point at workyard 38,15; both casino doors are labelled OUTSIDE. Gaius and his pigeon, the fountain and the Forum's two bots did not move. No aggressive monster lives in the Yard, checked against every new spot. Tests moved with it (crypt, ex, decor): 65 checks pass.

## 2026-09-21: v109, the Pit for tickets; three things that were never loaded at start

- **Fight Pit ticket bets pay tickets** (`eastscape-worker/src/pit.js`, casino.js v39, page hook `CZ.pit`). The fight is the site's shared round; the game server holds the ticket bet (`pit:<round>` written in the same storage put as the character), works out the card itself (mirror of the site's pitCard), and at bet + show into the round reads the site's PUBLIC `/api/casino/pit/state` once for the winner and the revealed seed; payout = stake x fair price x edgeFor(seed). An ALARM is set for that moment so a bet settles with nobody online; ten minutes without an answer refunds. Nothing is written on the site and no allowance is used. `tools/eastscape-pit-test.mjs` (13 checks) imports the SITE's pitCard and edgeFor and compares 400 of each, then plays a real 90 s round against dev mode's pretend result. The Pit window cannot be driven locally (its view is the live site's state), so the window change was reviewed by eye, not clicked. Roulette needed nothing: the wheel has been out of the room since v73 and Russian Roulette is a fixed 20 ZCoin seat.
- **BUG, mine, since v103/v86/v96**: `cryptTop`, `radio` and `songs` were read from storage only in restore(), never in the constructor, so each restart began with them empty, and the first Crypt clear after a restart would overwrite the saved list. All three (and the v107 jackpot seed top-up) are loaded at start now.
- NEXT (asked for): a loot box at the end of the Crypt, one each, 3 to 7 rolls (tickets, buffs, rarely gear); the clear's tickets move into it.

## 2026-09-21: VERSION 109, the Hoodie's hoard

- **A chest each at the end of the Crypt** (`cryptloot` at 40,13, art o_cryptloot, PixelLab c326bf7e). `CRYPT.loot` + `rollLoot()` in eastscape-crypt-rules.js (v4): 3 to 7 rolls, the first always the clear's tickets (nothing is paid at the kill any more), the rest by weight per difficulty: bonus tickets (4-10% of pay), drink, meal, clover, 1-3 Casino scrolls, house chip, horseshoe, and one of the six buff pieces at about 1 chest in 50 / 30 / 20. Past the day's paid runs: 3 rolls, no gear; under a tenth of the damage: 4 at most. The ZCoin roll moved from the kill to the chest. Measured over 20,000 chests a tier: tickets +7 to 8% over the old pay, items worth roughly 1,200 to 1,600 tickets at bar prices (so about +30% at tier 1, +14% at tier 3 on top of what was approved: TUNE `bonus` AND THE WEIGHTS IF THAT IS TOO RICH).
- **It cannot be lost or doubled**: what a player is owed is written on their character (`C.crypt.loot`) at the kill (or when they log back into a cleared run), deleted BEFORE anything is handed over, and `cryptLootSweep` (once a second) sends it to anybody owed one who is online and no longer in a crypt. The crypt test opens one, tries twice, and has the second player walk out without opening theirs (31 checks).
- Page: crypt.js v4 shows the chest when `cryptgates.cleared` and draws the loot window with each item's own art.

## 2026-09-21: v110, crits, the health bar, and a wiki pass

- **Crits are rarer** (the owner: "it feels like users are criting too much"). A crit is DISPLAY ONLY and always was; the roll was `>= ceil(max x 0.85)`, which with whole numbers is a fifth of every landed hit and **50% for a new player whose max hit is 2**. Now `dmg >= 4 && dmg > max x 0.9`: about one landed hit in nine, and none at all until a max hit of 5 (Combat ~10), so the first one means something.
- **A monster's health bar clears its own picture.** It sat 5 world units over the TILE, which is the face of anything drawn taller than one (the golems, the drakes, The House at 119 art px, the Hoodie at 104). `artTop(k)` = `(IMG[k].foot - IMG[k].top) / A` — **art pixels are A (2) to a world unit**, which I got wrong on the first pass and which put the bar twice as high as it should be. Checked in the Thunderhead against drakes and golems.
- **A wiki pass** (the owner, after a false alarm about highwaymen and cowhide: the generated drop pages were right). New tool `tools/eastscape-wiki-audit.mjs` reads the guides and checks them against the rules: stale phrases (the Forum, "in town", Brutus, Aurelia, "wins pay ZCoins", "about 97%", stances, hunger), places that are closed, links to items/monsters/npcs/areas that do not exist, rare tables that add past 100%, and quoted numbers (the ticket rate, the party size, the bet limits). It found the casino guide still promising real ZCoins for a ticket bet. Rewrote The casino, Tickets, Dying and Fishing, and added a **Cooking** guide, which had none since cooking came back in v104. 17 guides, audit clean. The UPDATES list is history and is not audited.

## 2026-09-21: v111, the task board, the shut door, and names that cannot go missing

- **The board**: `DAILY_COUNT` 3 -> **6**, every `cash` in DAILY **x5** (58 of them, done programmatically over the block). A job used to hand you ~45% of what those kills were worth anyway; it is about twice now. `dailyState` TOPS UP somebody who already has today's list rather than making them wait for tomorrow (dailyFor is pure, so the extra ones are the ones they would have had). Each row shows the **monster's own picture** (`ART + MOBS[k].art`, falling back to the crossed swords if the art 404s) and **where it lives** (`whereFor`, built once from the scenes: a scene's `mobs` for a kill, its fishing spots for a catch). RPG MO's board was the model; its Grade and Points columns were NOT copied, since that is a currency nobody asked for.
- **The casino's south door is shut** and Vince the Bouncer stands at it ("Can't go out this door yet. Coming soon."). The tiles are `v`, not `i`, so nobody can stand in the doorway; the west arch is the only way out, and it already goes to the same Yard. **Vince's art had to move from `AREA_ART.fightpit` into `ART_FILES` (core)**: a picture claimed by an area sheet is packed there and NEVER loads anywhere else, which is the same trap that left Livia without a body in v108.
- **NPC names cannot go missing again.** A snapshot carries only an NPC's id, x and y; the page looked the rest up in ITS OWN copy of the scene, **by position in the list**. Any disagreement between this server's rules and a player's page — the minutes between a page deploy and a worker deploy, an old tab — drew every NPC in that scene with no name and no picture (the owner: "a whole bunch of npcs with blank names and level 1"). `npcsOf(S)` now rides along with the roster (`who`), and the page takes their identity from there. A page that finds itself drawing a player or bot it has never been told about asks for the roster again (`{t:"who"}`, once every 3 s server-side).
- NEXT (asked for, not started): walking and attack animation frames (sprites slide), and hit/death effects on monsters.

## 2026-09-21: v112, hit and death effects (page only, no new art)

- **Sparks off a hit and dust off a death, in the monster's OWN colours.** `registerArt` now counts each picture's three commonest colours (5 bits a channel, every 4th pixel) into `IMG[k].cols`, so a Bone Golem throws grey chips and a Hail Drake blue ones with no palette written anywhere. `BITS` is the particle list (world units, so they scale with the zoom), `bitsAt()` throws them; a crit throws twice as many with gold mixed in.
- **A monster falls over instead of vanishing.** The server drops the body from its list the moment it dies, so the page copies its last position into `GONE` when it sees alive -> dead in a snapshot, and draws it for DIE_MS (620 ms) turning onto its side (spr's `rot`) and fading. Plus a flinch: a hit shoves the sprite a couple of pixels, where before it only flashed red.
- Everything is off under `reducedMotion`, where a monster blinks red and is gone as before.
- **Two mistakes worth remembering.** The state went in next to `const RED = ...`, which is INSIDE the draw function, so `onMsg` could not see it (`GONE is not defined`, once a frame); and the hit-spark code used `now`, which is the draw loop's, not a message handler's. Both only showed in the browser console: the syntax check and the socket tests pass either way. **Look at the console after a page change, not just the screenshot.**
- **v113, the same hour:** the owner tried v112 and cut the **flinch** (the sprite jolting 2 px on a hit) while keeping the sparks and the death. A hit is now its colours thrown off it plus the red flash, and the sprite itself does not move. Sequence worth remembering: "remove the hit effects, keep the death" then, a minute later, "keep the spark too, but not mob flinch" — it was the sprite MOVING that read as noise, not the particles.
- **The wiki's monsters wear their own faces** (v113): `mico(k, px)` draws `ART + MOBS[k].art` (the same picture the world uses, no new art), on every card in the Monsters list and at 40px on each monster's own page, falling back to the old emoji if a picture 404s. 31 cards, none broken.

## NOT BUILT: three the owner asked for and I did not get to (2026-09-21)

Written down while the reasons are fresh. All three were on the overnight list; the areas, the tiers and the casino
money bugs took the time instead. Nothing here is blocked — they are just unstarted.

- **A world boss.** A timed spawn in the Vault that a room piles onto together, announced in-game so people gather.
  The social feature the game is missing: the Crypt proved group content works here, but it has to be *organised* —
  this is the version you can walk into. Shape I had in mind: spawns on a clock everyone can see, scales its health
  with how many turn up, pays everyone who did real damage rather than last-hit, and goes to the activity feed and
  the ticker. Sits naturally next to `cryptBest` in `crypt.js` for the "fastest clear" bookkeeping. Do NOT let it drop
  ZCoins — tickets and Vault gear only, or it becomes an inflation tap.
- **A first-login tutorial for the tables.** This is where Kellzifer got confused, which is the whole reason it is on
  the list: the tables are the point of the game and a new player does not know tickets and ZCoins are the same bet.
  Should be three or four steps, skippable, triggered on the first walk into the casino rather than at login (the
  welcome popup is already doing work at login and a second one on top of it is worse than none). `welcomeOnce` and
  the `HOUSE TOUR` tour box are the machinery to reuse.
- **Loading states for lazily-fetched windows.** Picks (`eastscape-picks.js`) and Movies & TV (`eastscape-screen.js`)
  got these when they were built — an honest "Opening the book…" while the module downloads. The older windows never
  did: the jukebox, decor, crypt, profile and the gear tooltip all show an empty panel between the click and the
  module arriving, which on a slow connection reads as broken. The pattern is already written in both new files:
  put a message in the body BEFORE the `import()`, replace it in the `.then`, and say something useful in the
  `.catch` instead of leaving the panel blank.

## The Trailer Park (late-game map) — **BUILT**; this is the original idea, kept for the parts not done

**Shipped since.** The map, KnownSpade and the loot (catalytic, slagstone, pinelogs, bogwoodlogs, mudcat, bowfin) are in and it is the best gathering in the game. What is still only an idea below: the THEFT loop (converters as a node the locals object to) and Thieving as a skill.

A late-game outdoor map: a trailer park full of rednecks. **KnownSpade is the boss there.**

The hook is a **theft skill loop**: cars up on blocks around the lot, and you **steal catalytic
converters** from them. Fits the engine the way mining does — a node you click, a timer, a drop —
but with a twist mining does not have: the locals object. Stealing should draw aggro, so the risk
is being caught rather than the swing of a pickaxe.

Worth thinking about when it is built:
- Converters as a high-value loot item sold at the Prize Counter (`isLoot`, a real `valueOf`),
  or as a smithing input — they are catalytic, so precious metal is the obvious refine.
- Does it want its own skill (Thieving) or does it sit under an existing one? A new skill is a
  bigger commitment than a new map; Agility just showed what that costs.
- KnownSpade as a named boss needs a drop table worth the trip, at Starfall/Eclipse tier or above.
- Level gate: it is late game, so it sits past Cloudreach/Thunderhead in the outdoor chain.

## ~~The Run's door is hard to find~~ — **FIXED 2026-09-22**: it is a rope ladder at 10,2 in the Yard. Kept for the reasoning.

The agility course entrance is a `roomdoor` at **6,5 in the Yard** — far north-west, the opposite
corner from the casino exit people arrive through. The owner could not find it. Nothing signposts
it and nothing on the way there hints it exists.

Options, cheapest first:
- A sign beside it, the way the Gloam signs the Mire and the Wilderness ladder still needs one.
- Move it somewhere people already walk: near the Yard's casino-side entrance, or on the path north.
- Mention it in the House Tour once Agility is worth having.


## Mining's missing middle — **PART DONE 2026-09-24**

The diagnosis, kept because the shape of it is the useful part. Every banded map has an ore, a tree
and a fish EXCEPT the Thunderhead, which had a tree and a fish and no rock. And the maps follow a
rule nobody wrote down: a map's ore requires `band_top + 1` (copper@1 in 1-9, emerald@20 in 10-19,
diamond@30 in 20-29, dragonstone@40 in 30-39, onyx@50 in 40-49). You mine your map's rock on the way
out of it.

So mining on the WALKED chain stopped dead at onyx 50. Everything above it was in the Vault (no
band, entered another way) or the Trailer Park (Combat 80) - and catalytic is Mining 65 behind
Combat 80, so you cannot reach it when you qualify for it. `eastscape-skill-sim.mjs` showed the
lived result: at **Mining 80 the best rock a player could reach was still onyx**. Half the skill
with no new rock.

**Done:** the Thunderhead has starfall@60 and voidglass@70, in opposite corners with an aggressive
guard each, and the four ore rocks that had no picture (starfall, eclipse, voidglass, catalytic) now
have one instead of drawing as a generic grey lump.

**Still open:** 65 to 85 is thin on the walked chain - starfall@60 carries you to the Trailer Park,
and the owner's own suggestion is the honest fix: **the Thunderhead's band is 50-99**, one band
doing the work of five maps. A new map between it and the Trailer Park (band 60-79) carrying
catalytic and voidglass would give that stretch a real rung.

**And the three ores that smelt into nothing now have a plan** (the owner, 2026-09-24):
- **slagstone (85) and stardust (50) become UNBUILT GEAR that has to be smithed**, at Smithing in
  the 80s and 90s. Not bars for the existing ladder - their own top-tier pieces.
- **catalytic (65) is for ALCHEMY** and other things, which is one of the three skills due before
  launch. It is deliberately NOT getting a bar.
So the gap in the smithing chain above eclipse is intentional and waiting on those two builds.

## Cloudreach has a woodcutting tree standing in the water — found 2026-09-24

One of Cloudreach's TWO skyash trees cannot be chopped. In `cloud.build()` the trees go down
first and set their own tile blocked:

    for (const [tx, ty] of [[9, 6], [32, 20]]) { ... g[ty][tx] = "#"; }

and then the hole in the cloud is painted straight over the top of one of them:

    for (let y = 19; y <= 22; y++) for (let x = 27; x <= 36; x++) g[y][x] = "~";

32,20 is inside that rectangle. The water wins, so the tree object sits on a water tile with
water on every side: no reachable tile beside it, nothing to stand on, and `scatterSpots` can
drop a fishing spot on the same tile (it does — skyash and spot are both at 32,20). Cloudreach is
the Woodcutting 45 map, so half its supply of skyashlogs has never existed.

Fix is one coordinate: move the second skyash out of x27-36 / y19-22. Worth doing at the same
time as any Cloudreach polish rather than on its own.

**The general lesson** is the ORDER in a build(): anything that paints a region — water, a road,
a room — will silently overwrite a resource placed before it, and the object survives with no
tile under it. Place regions first and resources after, or keep resources out of the region.

### Two smaller ones from the same sweep

- **The Thunderhead leaves 15 cut-off tiles** along its west edge and south row (2,20 2,21 1,22
  2,22 2,23 2,24 3,24 4,24 5,24 11,24 12,24 18,24-21,24). Same class as the one-tile island the
  Mire had: `markBanks` turns a tile beside water into "b", and `wild`'s repair only re-plants
  "." tiles, so a bank tile it cannot reach stays visible and unstandable. The Mire now floods
  anything with water on all four sides; the Thunderhead's are edge strips rather than islands,
  so they need the shore pulled in, not flooding.
- **The Vault draws a tree on top of its neon wall** (both at 15,23). Cosmetic, but one of them
  is invisible.

### And the checker gap that found them

`tools/eastscape-content-check.mjs` proves spots are fishable and object ids line up, but nothing
checked **that every walkable tile can be reached from an exit**, or that a mob is not standing
inside a prop. A throwaway script did, and it caught the Mire's sealed court before it shipped.
Worth promoting into `tools/`, but it needs three exemptions first or it is all false alarms:
interior scenes (Forum, Bank, Fight Pit, Casino, the isles) have NO edge exits and are entered by
a door or ferry, so the flood-fill needs a different seed; the Yard's chickens and cows are
DELIBERATELY sealed into pens; and the Casino's rope lines share a tile with their posts on
purpose. Spots must be left alone entirely — a rod reaches three tiles (`reachOf`).


## The Thunderhead rebuild, and what it taught about water — 2026-09-24

Rebuilt from Cloudreach-with-a-darker-tint into a ruin: a processional way in from the east, a ring
of six rune stones the road runs straight through, broken sky-arches along it, storm crystals out of
the floor, and the sea through a tear in the south-west. 43 props where there were 3. New art:
`o_runestone`, `o_stormcrystal`, `o_skyarch`, and the four ore rocks. New ground theme `storm` in
GROUNDS, sharing Cloudreach's two Wang sheets on purpose (a regenerated Wang set is the one art job
that has come back unusable before) but swapping its scattered bush and boulder art for crystals and
rune stones - two keys that change most of what the eye sees, since `wild` sprinkles those types
across every map.

**THE LESSON, and it cost three passes: `wild()` finishes the water AFTER `build()` returns.**
A cut-off-floor check written inside build() is asking the question too early - this map's border is
painted water by wild, and that is what severed a six-tile shelf south of the tear. Anything clever
about connectivity would have to run after wild, and by then wild has already placed trees and run
its own repair, so converting a tile to water can leave a tree standing in the sea.

So the rule for a body of water at a map's edge: **do not leave a strip between the water and the
rim.** Run it off the edge of the map and rag only the ENDS, which is where raggedness reads against
the floor anyway. Then add the Mire's four-neighbour flood for tiles the ragged ends isolate. Those
two together, both inside build(), need nothing after wild at all.

Three classes of unwalkable tile have now been seen, in increasing awkwardness: a ONE-tile island
(four-neighbour flood catches it), a TWO-tile shelf (it does not - two tiles hold each other up),
and a strip severed by wild's own edge painting (nothing inside build() can see it coming).


## A per-player scene must be exempt in normChar — fixed 2026-09-24, and worth remembering

jimmytomato: "I was on Floor 30 of the Tower ... now demoted back to Floor 21". It was true, and the
tower's own code was innocent.

The Tower and the Crypt each put a player in a scene keyed to them — `tower:<id>`, `crypt:<id>` —
built on demand, so **not in SCENES**. normChar throws out a scene it cannot find and sends the
player to the casino, and the exemption for a run in progress was spelled `startsWith("crypt:")`.
So every load threw a tower climber out of the tower: a deploy, a reconnect, any restart of the
Durable Object. It is now a regex over both.

**The floor was never lost.** `c.tower` still said `{floor:30,best:29}` the whole time. What was lost
was the SCENE KEY, which is what `towerRejoin` matches on to decide whether to rebuild the room you
were standing in. Without it a climber arrived at the door, and re-entry recomputed
`checkpointAt(best + 1)` = 21.

That is the shape to watch for: **the state was fine and one derived key was wrong.** Three bugs
this week have had it — the reforge badge (level right, wrong field read), the bag counter (slots
right, wrong constant printed), and this.

### Still open: `home:<owner>`

A player's house on their island is `home:${S.owner}`, and it is reset to the casino on load for
exactly the same reason. It is left alone **deliberately**: nothing is lost, you simply wake up in
the casino instead of your own front room. If it is ever worth fixing, it needs the same pair the
Tower got — the exemption in normChar AND something to rebuild or place the player, because an
exempt scene key with nothing to rebuild it is worse than a reset.

`tools/eastscape-tower-test.mjs` now scans the worker for every per-player scene it moves a player
INTO and insists each one either survives a load or is named in its TRANSIENT list with a reason.
The next one cannot be forgotten the way this was.

### And the checkpoint rule changed with it

The Tower used to resume at `checkpointAt(best + 1)` for everybody, so any interruption cost up to
nine floors. Now the resume floor is the floor you were ON — one `resumeAt()` that the door's window
and the stairs both read, because when they each worked it out the window could promise 21 and the
stairs deliver 30 — and **the checkpoint is the price of DYING and nothing else**. `towerDeath`
writes that demotion into `c.tower` instead of leaving it implied.

This does change the original intent, which was that logging off and coming back should cost the
band ("being able to resume at 18 every evening would delete them"). That is a design call the owner
may want to revisit: it is currently the kinder rule, and it is the only one that can tell a deploy
apart from a bedtime, since the server cannot.

## There is no damage buff in the game — found 2026-09-24

The owner, testing Alchemy: "Fang flask combat: +4.5% bite - what is bite?"

**`bite` is FISHING.** The game's own `fxText` says it out loud: *"fish bite N% more often"*. I had
labelled two potions and three item descriptions as combat, which was simply wrong, and they are
corrected. But the question exposed something bigger.

**The buff levers are `tix`, `speed`, `tough`, `rare`, `zdrop`, `bite`, `heal` and `power`, and not
one of them touches how hard you hit.** Damage is `maxHitOf(c) = 1 + floor(melee / 6) +
floor(bonusOf(c).str / 2)` — your melee level and the `str` on your GEAR. Nothing a potion, a meal or
a drink can set will move it.

So the honest accounting of what a "combat buff" can currently be:
- **`tough`** — take less damage. The only combat-exclusive lever there is.
- **`speed`** — "you swing AND fish faster", so it is really both, and it is the closest thing to a
  damage buff since it raises swings per minute.
- **`tix`** — more tickets from kills. A reward, not a capability.

That is why the Alchemy ladder cannot cleanly alternate skilling and combat the way the owner asked
for: there is only one combat-exclusive lever to alternate WITH, and a ladder of nothing but `tough`
potions would be dull.

**The fix, if it is wanted, is a new lever.** A `hit` key in the fx block, added to `OUT_KEYS`,
`OUT_CAP` and `fxText`, and multiplied into the player's damage roll where `maxHitOf` is used. It is
a small change in the rules and one line in the worker's combat step, but it touches the damage
formula, so it wants its own pass and its own test rather than being slipped in beside a map. With it
the combat half of the potion ladder gets real teeth and gear with `hit` on it becomes possible too.

Until then: Rattle brew and Fang flask are FISHING potions and say so.

## Nine monsters still have no bounty — found 2026-09-24

The owner: "lucky clover kills arent counting in the golden sands". They were not, and the cause was
not luck. `killFinds()` opens with:

    const C = pl.C, mob = d?.mob; if (!G.BOUNTY[mob]) return;

So a monster missing from BOUNTY silently gives **no rare roll, no casino find, and no luck spent** —
a clover burns nothing and the player has no way to tell it is doing nothing. And because BOUNTY is
also what REBUILDS each monster's ticket drop (the loop at the bottom of the rules file strips the
hand-written line and derives it from bounty minus the worth of the other drops), an absent entry
means that monster's pay was hand-written and never measured.

**The Golden Sands' four are fixed** with tools/eastscape-balance.mjs's own want$/kill. Worth noting
what that found: the ranges I had invented were *overpaying badly* — the Bandaged Debtor was worth
777 tickets a minute and the Tomb Jackal 862, against a band that sits near 600. They are 540 now.

**Still open: nine more, and they are not new.** The Vault's `warden`, `pitboss`, `hoard` and
`dealer`, and the Trailer Park's `junkdog`, `possum`, `scrapper`, `gator` and `junkking`. Every one
of them is spawned on a map, none has a bounty, so none of them rolls a rare, drops a chip, or counts
a clover kill. Two whole end-game zones.

**It is left alone deliberately, because it is a balance decision and not a fix.** Giving them
bounties would strip their existing hand-written ticket drops and rebuild them from measured values,
which changes what those zones pay — possibly a lot, in either direction, exactly as it did for the
Sands' four. The owner should decide whether the Vault and the Trailer Park get re-measured.

`tools/eastscape-content-check.mjs` now fails on any monster spawned on a map with no bounty, with
those nine named as known exceptions — so the NEXT map cannot repeat this, and the list is the
to-do. Remove a name from it when its zone gets measured.

## Four one-letter server messages in the Pyramid's second chamber — 2026-09-24, UNEXPLAINED

While testing, the owner saw four separate server messages in the log, each a single character:
`m`, `s`, `e`, `e`. Reported alongside a door problem they then retracted ("nvm i was wrong").

**What is known.** The page's `say(text, cls)` makes one `<p>` per call with `textContent = text` and
keeps the last five, so four boxes means **four `say` calls whose text was one character**. The worker
side is `say(pl, text, cls, tag)` pushing `{type:"say", ...}`.

**What was ruled out.** Every `this.say` in eastscape-worker/src/pyramid.js passes a string literal or
a template — none passes a bare variable. The page's only local `say(...)` callers are the definition
itself, a `say(empty, ...)` and a callback parameter. `{type:"hurt"}` (which the coil pushes for the
bleed) is NOT a message type the page handles at all, so it cannot be rendering as text; `"hurt"` at
eastscape.html:1241 is an SFX name. The chamber monsters' `drops` are never paid out in a run, so that
path is not it either. There is no mob taunt/lines system to index into.

**The shape it suggests** is a random index into a STRING where an array was expected — `s[Math.floor(
random * s.length)]` gives one character, and four of them in a row would look exactly like this. That
did not turn up in the pyramid's own code, so the next place to look is whatever generic per-kill or
per-tick path a NEW mob type reaches that the older ones do not.

**Why it is not chased further now:** it is cosmetic, it did not repeat in the same session, and there
is no reproduction. If it comes back, the thing to capture is what the player was doing in the tick
before it appeared, and whether the letters are stable across runs (a fixed string being indexed) or
different every time (a random one).

---

## 2026-09-24 — waiting on the owner

Five things built or found today that need his word, not more work from me.

| | What | Why it is waiting |
|---|---|---|
| **Open the Carnival** | Two lines: `w: "carnival"` on the Yard's exits, `e: "workyard"` on the Carnival's. | He said "dont open it until i tell you". `tools/eastscape-carnival-test.mjs` asserts it is still shut, so opening it deliberately means deleting that check too. |
| **The 73–80 map** | He said "ill make another after this for 73-80". | The Carnival is the template: themed map, five-mob ladder, one mini boss on AGGRO_ON, a safe plaza if it needs one. |
| **Fishing 58 → 80** | Thundersquid is 58 and Mudcat is 80. Nothing between. | The other half of the lull he spotted, on a skill nobody has mentioned. Mining and woodcutting already have rungs at 60/65/70. The Carnival's dunk tank is the obvious home. |
| **PvP auto-retaliate** | `index.js` ~2335, the twin of the mob line the AFK fix guarded. An idle player in the Wilderness is still handed a fight. | Applying the same rule makes an AFK player a free kill — arguably right, and bigger than what was asked for. |
| **The Pyramid's wiki page** | The only piece of that build never written. The pets guide names the Great Pyramid as plain text rather than a link because the page does not exist. | |

### And the things only a live run can prove

- **The Pyramid's burrow** — at 70% and 40% of the Squeeze's health. Still the one mechanic nobody has seen fire; the coil, the lever and the chest have all now worked in a real clear.
- **The Carnival's stalls** — the board, the grading and the economy are tested offline, but nobody has pressed a mole.

### Two traps worth remembering, both bit today

- **An area list DEFERS a picture out of `core.png`.** Putting `o_gravestone` and `o_skeleton` in the Boneyard's list to dress its graveyards silently took them from the Gloam, the Mire, the Sands, the Wilderness and the Deep. `eastscape-artreach.mjs` is what catches it — and it only started covering the dungeons today, which is how the Pyramid shipped with an invisible hoard chest.
- **`wild()` fills whatever is not in `keep`.** Right for a wood, wrong for a fairground: the Carnival's first build left 467 of 1,144 tiles walkable with eight monsters and the boss sealed in pockets. Keep the interior, let it dress the rim, put the clutter back by hand with a connectivity check.

## 2026-09-24, after the Carnival deploy

- **Open the Carnival** — still two lines, still waiting on your word:
  `w: "carnival"` on the Yard's exits, `e: "workyard"` on the Carnival's.
  `eastscape-carnival-test.mjs` asserts it is shut and will fail the moment
  it opens, which is the reminder.
- **The 73-80 map** — you said you'd do another after this one.
- **The Tower's top is a dead end.** 30 floors, and a topped-out climber
  re-enters on 30 forever. "Start at floor 1" is now on the door, but there
  is no prestige, no floors above 30, and clearing the top again pays only
  The House's ordinary drops. `floors: 30` is a config number — the comment
  in `eastscape-tower-rules.js` says 60 or 100 costs nothing, since one room
  is rebuilt. Worth deciding before launch.
- **PvP auto-retaliate** (`index.js` ~2335) — the twin of the mob line the
  AFK fix guarded; still unguarded.
- **The Pyramid has no wiki page.** The pets guide names the Great Pyramid
  as plain text rather than a link.
- **Three Strongmen contest the mining truck** at (36,6) in the Back Lot.
  Deliberate for now; one `{aggro:0}` override exempts them if it annoys.
- **Gathering hit rate caps at 90% from about level 25** (rock/fish
  `min(0.9, 0.4 + lvl*0.02)`). Open question whether the high tiers should
  feel harder.
- **`?v=248` on `eastscape-shared.js` is burnt.** A bare probe of it cached
  the OLD file (VERSION=234) at the edge as `immutable`. Never reuse 248.
  Probe an asset only as `?v=N&probe=random`, never the bare real URL.

## 2026-09-24, the Carnival is OPEN

Done: opened (west out of the Yard), midway icons fixed, nine BOUNTY
entries added, fifteen LOOT tables restored, Tower "Start at floor 1".

Still open:
- **The 73-80 map** — you said you'd do another after the Carnival.
- **The Tower's top is a dead end.** 30 floors; a topped-out climber
  re-enters on 30 forever and re-clearing pays only The House's ordinary
  drops. `floors: 30` is a config number — the rules file says 60 or 100
  costs nothing since one room is rebuilt.
- **The chicken's feathers are deliberately NOT restored.** Its MOBS line
  still declares `["feather", [5, 15]]`; LOOT leaves it off, because a
  feather is worth 1 against a 9-ticket target and BOUNTY can only take
  TICKETS back out of a table, never an item. If feathers should drop,
  the quantity has to come down — 1 or 2, not 5 to 15.
- **`drops:` on a mob with a LOOT entry is dead code.** Fifteen of them
  had drifted. Worth a checker that fails when the two disagree, rather
  than the ad-hoc script that found this.
- **PvP auto-retaliate** (`index.js` ~2335) — still unguarded.
- **The Pyramid has no wiki page**, and the Carnival now has none either.
- **Three Strongmen contest the mining truck** at (36,6) in the Back Lot.
- **`?v=248` and `?v=249` on eastscape-shared.js are spent.** 248 is
  BURNT — a bare probe cached VERSION=234 under it as immutable. Probe
  only as `?v=N&probe=random`, never the bare real URL.

## 2026-09-25, the re-click fix and the Tower to 99

Done: the re-click exploit (three holes), Tower at 99 floors / level 99 /
checkpoints every 5, +33% difficulty outside the Yard, fishing -33%.

Still open:
- **The 73-80 map** — you said you'd do another after the Carnival. Note the
  Tower now covers 30-99 on its own, so the gap is about open-world maps.
- **Income fell and was not compensated.** The +33% pass made kills ~30%
  longer, so fighting pays 18-23% less and fishing 33% less. Multiplying
  BOUNTY by 1.33 restores it exactly if that was not intended.
- **The AFK margin in the Tower is 27 seconds.** The longest stretch with no
  reason to click is 153s against a 180s cutoff. Tripping it only stops the
  fight ("Click to carry on"), but if a floor is ever made less damaging,
  re-run tools/eastscape-tower-check.mjs.
- **The Tower pays a fifth of the open world and no items.** At 9.4 hours a
  full climb that is a lot of hours for xp alone. Worth deciding whether the
  top floors should drop something.
- **No Tower achievements** — nothing for reaching the top or any floor.
- **The turnstile charges once.** Leaving the Carnival cage is free, so a
  Carnival ticket is a one-time cover charge, not per visit.
- **The Pyramid and the Carnival have no wiki pages.**
- **`?v=248` on eastscape-shared.js is BURNT** (a bare probe cached
  VERSION=234 under it as immutable). Probe only as `?v=N&probe=random`.

## 2026-09-25, later — the danger pass

Done: OUTSIDE_BUFF split into OUTSIDE_HP 1.15 / OUTSIDE_DMG 1.75, HIT_FLOOR
0.10 -> 0.18, JACKPOT_KILL 1-in-50 x5 -> 1-in-250 x12, the food ladder fixed
buff-only, AFK_TOWER_MS 5 minutes, SWING_URGE 0.15.

Needs a look:
- **The Crypt and the Pyramid were NOT measured against HIT_FLOOR 0.18.**
  Unlike OUTSIDE_HP/OUTSIDE_DMG, the floor lives inside hitChance, so both
  dungeons just got roughly twice as damaging. They are party content with
  their own tuning. Check before anyone runs one.
- **`COOK` hides the plain cook for every smokeable fish.** It is derived from
  RECIPES keyed by the RAW fish and smoke_* registers after cook_*, so the
  seven smokeable fish have no plain entry. Its comment says it is kept for
  the wiki, so the wiki is showing only the smoked recipe for those seven.
- **A monster's `att` is still nearly dead weight.** At HIT_FLOOR 0.18 a
  geared player is on the floor for most things; raising att only matters
  within ~10 of their defence roll. If att is meant to mean something,
  defenceRollOf (melee level + gear def)/2 is the thing to look at.
- **No visual feedback for the swing urge.** Players feel the cadence but
  cannot see the bank. Page work, not rules work.
- **The Tower pays a fifth of the open world and no items** over a 9.4-hour
  climb, and has no achievements.
- **The turnstile charges once** — leaving the Carnival cage is free.
- **The Pyramid and the Carnival have no wiki pages.**
- **`?v=248` on eastscape-shared.js is BURNT.** Probe only as
  `?v=N&probe=random`, never the bare real URL.

## 2026-09-25, night — Nova and Singularity shipped (no art yet)

Live at VERSION 245. Two tiers, 32 items, ores in the Vault and Trailer Park,
the core chase item, the glow, new weapon names on the top two tiers only.

Next on this:
- **ART: 32 pieces plus `o_rock_nova_ore` and `o_rock_singularity_ore`.**
  Everything falls back to emoji today (with the glow, which works on the
  fallback). Owner asked for "legendary" looking. Style brief is
  tools/eastscape-art-style.md — every prompt starts there.
- **The Hoodie and The Squeeze are not droppers yet.** The owner asked for the
  dungeon bosses to be in the core pool; they live in the crypt/pyramid rules
  files rather than shared.js, so they were not covered by the LOOT edit.
  CORE_BOSSES names them but nothing reads it yet.
- **Balance after feedback, as agreed.** In particular: the Bom tool price
  (250,000 / 600,000), the core craft piles, and whether 0.05% feels right.
- **Eclipse is under-priced against starfall in every slot** (pickaxe 1078 vs
  1260, body 2696 vs 3687). Starfall's recipe eats a BAR and eclipse's eats
  only raw ore, so the craft chain marks starfall up more. Nova inherits it.
  Not touched -- fixing it makes a live tier dearer to craft.
- **`att` is still nearly dead weight** even at HIT_FLOOR 0.18.
- **The Crypt and Pyramid were never measured against HIT_FLOOR 0.18.**
- **COOK hides the plain cook for the seven smokeable fish** (wiki reads it).
- No wiki pages for the Pyramid, the Carnival, or the new tiers.

## 2026-09-25, later — the art landed

VERSION 246. All 36 pieces drawn and live: 17 icons a tier plus the two
mineable-rock sprites. Tool prices flat at 20,000 / 25,000.

Still open on the tiers:
- **The Hoodie and The Squeeze are still not core droppers.** They live in
  the crypt/pyramid rules files, so the LOOT edit in shared.js never reached
  them. CORE_BOSSES names them and nothing reads it.
- No wiki pages for Nova, Singularity, the Pyramid or the Carnival.
- Balance on feedback, as agreed: the core craft piles, 0.05%, and whether
  600,000 for a Nova cuirass is the right shape now the tools are cheap.
- Eclipse is still under-priced against starfall in every slot (its recipe
  eats raw ore where starfall's eats a bar). Nova inherits it.

## 2026-09-29, rules 353 LIVE (page b73e00f + assets fed85ee on Desktop; worker 0e48d6a1)

Shipped: the Nexus toned down (1.5x pages, 1.25x xp); Bronny's worksite on concrete; quivers x3 and one-click
loading; Magic Bags x3 (300..7,500, Shroud Satchel 3,000); the Wild Bench (art PixelLab 94fbfd64); the Yard's
two courts, cobbled road west and north, lamp posts (they glow when the Yard is dark), the river and the plank
bridge, fences at the treeline; a second round of court clutter and two chickens in the south court; o_barrel and
o_bucket added to the Yard's art list (every court barrel had been invisible); bug board steps 1, 2a, 2b (make
amounts, Bom buys bows/quivers/wands/bags, bank amounts and steady order, profile gear hover/right-click,
arrivals via placeSafely, isleRejoin, +4 keeps through a save, Finished offers, the Gallows oak, the 2X banner,
fungi planting xp). Wiki 211: the Updates entry and the gem bag guide (hidden while HOLD.gems).
Live versions: VERSION 353, shared ?v=384, wiki 211, bank 14, bag 4, casino 60, closed 26, profile 9, gems 6,
cards 3, tinker 7, PACKS_V 139. Wilderness sheet budget 135 (tools/eastscape-budget.mjs).

STILL HELD SHUT (shipped dark): Tinkering + World Projects, the gem bag and Sorter, Marked Cards.
Stale tests, not regressions: pit/tix (EDGE_BAND 0.93-0.99 since 09-22), jewel (Jewelcrafting retired),
thieving (8), quicksell (4 items with no buyer), tower checkpoint, crypt (timeout).
Known: 22 walkable tiles in the Yard no exit reaches (the river's east bank strip x28-29 and behind the Tower door).
Bug board: statuses still to be set by the owner in game (admin only).

## 2026-09-29, rules 354 LIVE (worker e1801f66): Tinkering, World Projects and the gem bag OPEN

HOLD.tinker and HOLD.gems false. Marked Cards still held. Yard north pasture -9 monsters (20 in the Yard).
Wiki 212: Tinkering and World Projects guide, gem bag guide now visible, Updates entry. Wiki words budget 90.
Shared ?v=385. Watch: gem drop rate (1/1,500 at 60+), Tinkering salvage as a sink, World Project donations.

## 2026-09-29, rules 355 LIVE (worker faac6518): Tinkering's art and achievements

skill_tinkering icon (SKILL_ART), ui/built (Builders board), ui/g_tinkering (guide), five Tinkering achievements
(a_tinker, s_tink30, e_tink60, s_pin, m_pins), Builder's Pins in the collection log's Skilling tab, and projPin
fills the log on the bank path. Shared ?v=386. Gadgets, pins, parts and Sal already had art.

## 2026-09-29, rules 356 LIVE (worker 41ac4a37), after the Pumpkin King fell at 21:58 UTC

A version bump so every tab reloaded onto PACKS_V 140: the Boneyard's dragonstone, Cloudreach's onyx and the barrels on
the Gloam, Sands, Fight Pit and Guild are named in their own maps' art lists. tools/eastscape-art-reach.mjs (in the
content check) guards it. Wiki 213 (Tinkering guide icons). Shared ?v=387.
OPEN QUESTION: the Crypt test sees +250 tickets to each player at the boss kill (crypt.js pays nothing there);
find the source before calling it a stale test.

## 2026-09-29, rules 357 LIVE (worker 958b6a05): Tinkering rebalanced

Salvage xp = half the part value, capped 40 an item; a build = 15 x the gadget's level; gifts 0.1 xp/part value and 0.005/ticket.
Gadgets at 30 + 0.8 x old level (Confetti 31 .. Auto-Reel 94), parts and fees x10. Existing xp untouched (the owner). Wiki 215
(Updates entry). Shared ?v=388. WATCH: whether 1-31 (salvage and projects only) feels too slow for a new player.

## 2026-09-29, rules 358 LIVE (worker 1856b9d5): sorted gems are single items

normChar splits stacks of sorted gems (bag, then bank); a Sorter re-roll touches one gem; the bag badge shows the roll in
its band colour; clicking a sorted gem sets it in the first empty setting of its side (else opens the gem bag). Shared ?v=389.

## 2026-09-29, rules 361 LIVE (worker 07f55f5b) + the site's Grind closed

- THE OUTFITTERS: Wren the Ranger (Cloudreach 10,17) and Morwenna the Mage (the Thunderhead 10,15), stalls below them. OUTFIT at
  the end of the rules; 25 armour pieces a style (5 tiers x 5 slots, Archery/Magic 10-90; half plate's def; set +10% style dmg,
  archers +6% speed); weapons at max(20x crafted value, 150*lvl^1.4); buy-back = gearSell via cashTo. outfit.js / eastscape-outfit.js
  (v1) / tools/eastscape-outfit-test.mjs. Art by a PixelLab subagent (50 icons, wren/morwenna + faces, two stalls from o_stall edits).
- Longbow str x2 (4 + 4i). CRAFT_P seeds the four Mining gems and three herbs (every wand/bag now has a price).
- Bronny: nine kinds; the four new ones early/mid only; the late slot always dealt to a kind with a late tier.
- Versions: VERSION 361, shared ?v=392, wiki 218, outfit 1, PACKS_V bumped by the pack tool.
- SITE: The Grind CLOSED (functions/api/casino/grind/_grind.js CLOSED; start.js 410; home.js closed flag; v3-grind 10 shows
  "The Grind is closed. Check out EastScape instead."; v3-casino 53 card "Closed"; v3.css 280). In-progress shifts can still finish.
- IDEA (owner): the outfitters could wander to a new mid/late map each day.

## 2026-09-29, rules 362 LIVE (worker da4c15a6): outfitter prices
Armour = Bom's plate price for the same tier and slot (leather/linen = bronze ... voidstalker/astral = singularity: a body
600 .. 1,440,000). Weapons = 10x that tier's longsword (bows, wands) or shield (quivers, bags): a bogwood longbow 6,000,000.
Buy-back unchanged (an eighth, capped 2,500). Shared ?v=393.

## 2026-09-30 00:11 UTC, rules 363 LIVE (worker fc49eb72): the combat pass + the jukebox is the radio
Flinch back (recoil + 70 ms white flash), drawn attack effects (attackFx: sword arc by tier colour, bow snap and streak, wand ring by
element), sounds (mob_swing, crit, weak/resist/guard, heartbeat, died; mobgone scene event; others' fights at 0.3, 4/s), the "died"
event and #diedCard. The Green Room player is out of the game (greenHere() is empty; the module is still there): the jukebox is the
radio only. Shared 394, sfx 18, wiki 220. Mark the bug-board idea "Remove Green Room ... radio.garden only" as done.
NOT DONE (considered): hit-stop; real attack frames (the owner chose drawn effects).

## 2026-09-30 00:28 UTC, rules 364 LIVE (worker 146be8cb): roads on every map; gems keep their roll
Roads: paintBg lays t_cobble over every "," (and the Sands' paving, ROAD_PAVE) through the floor painter, shaded by ROAD_TINT; the
Depths and Boardwalk islands are bgArt pictures and keep their drawn walkways. Gems: take-out returns the sorted gem (gems module 7).
Shared 395, wiki 221. The player who reported the gem take-out can be told it's changed.

## 2026-09-30 02:53 UTC, rules 365 LIVE (worker 631ec223): THE PRIMEVAL VALLEY OPENS
- Three maps north of the Trailer Park (valley, valley_ridge, valley_lair), scenes in eastscape-closed.js WRITTEN BY lt-wild/valley-gen.py (edit that, not the scene): the Yard's own ground + cobble roads, pack art only for what stands (plateaus = tools/eastscape-valley-art.mjs, pv_* pieces; NB the pv_ prefix is shared with someone's untracked pv_chicken_* files in flat/).
- Archery country: ARCH_BAND (a bow + Archery 40 opens it), ARCH_FLOOR (arrows land at least 50% there), archery x1.4 (pterodactyls x1.7). Bands 90/95/100 for Combat.
- Old Rex (110) and the Matriarch (108): open world bosses on plateaus, arrows only, shared kill (12-20k / 8-14k tickets EACH), run reports, CASINO lines on fall, return and (once) launch (storage flag valleyLaunched). Health never resets.
- Cycad tier (bows/quiver/wand, sinew + fossils); Skyripper, Raptor-claw ring, Hunter's Fang, Hunter's draught (fx adm, OUT_CAP 0.25).
- Also: outfitters' armour reforges like plate; gear never multiplied at the Nexus / Wild Bench / a gadget double make.
- Tests: valley, valley-boss, valley-reach, nexus-gear. Known-failing before this release and still: crypt (slow), jewel (held), pit, tix, thieving, tower, quicksell (eggs and chase items have no buyer by design).
- Next: maps 2-4 (Frozen Reach: map boss + the daily open boss; Sunken Temple: the group boss 4+; Void Rift: the endgame open boss).

## 2026-09-30 04:24 UTC, rules 366 LIVE (worker 3a0638aa): THE YARD RAID
- Admin-only (panel: Start a Yard raid / Skip the warning / End it / Reopen the stalls). eastscape-worker/src/raid.js + RAID at the end of the rules.
- Five-minute CASINO countdown (4/3/2/1 min, 30 s), then The Ice Man (raidchief, 246 px, hp 4000 + 1200 per player online, cap 40k) through the north
  gate; waves every 2 min at the north and west gates (wolf 6, yeti 16, giant 32; early/mid materials); the last wave (huscarls, lvl 45) under 30%.
- Deep Freeze every 10-15 s on 1 + 1 per 4 fighters within 8 (cap 4): 3.5 s frozen (no walk/act/swing), 6% hit, an ice block on screen.
- The west bank: S.raidG walls off x > 24; raiders never target, chase, go home or wander over the river (tested five minutes of the loop).
- Win: pool 20k + 3k per fighter by damage share (floor 400) + the Ice Man's own 15-25k to each who did 5%; lose: the shopping boarded up 10 min.
- The Frozen Reach and the Ice Wyrm ship HELD (their rules and maps are in, unreachable). The content check now lets held maps wait for art (warn).
- Next: wire the Frozen Reach's finished art (the agent's 113 files, uncommitted in flat/), walk it, open it on the owner's word.

## 2026-09-30, rules 367 LIVE (worker 17778b92): THE FROZEN REACH OPENS
- frozen + frostspire north of Cloudreach (lt-wild/frozen-gen.py writes the scenes); Magic 60 + a wand (MAGE_BAND), the sure cast (MAGE_FLOOR 0.5), spells x1.4.
- THE COLD: 25/s without a Frost ward (COLD, coldTick); wards: Frost charm (Wren/Morwenna 15k), ward ring/amulet (anvil, raid shards + pelts), the Crown of the Frost Jarl (helm, chase).
- The Frost Jarl (open, spells only), the Ice Wyrm daily 2 PM-midnight CT (wyrm.js, admin rise/down), once-only CASINO launch line (frozenLaunched).
- Boss pets on every late boss (Rexling, Calf, Jarl's Hound, Wyrmling, Ice Imp); stronger late egg pets; MIX (plain drops from the 2-3 maps before, 3%).
- FIX live: boss pets only rolled during the Long Night (the Pot Boy).
- Held for the all-up wiki pass: the Gems page (the sorter, the new gem drops). Parked for the owner: world-event ideas (combat raids + skilling events), EASTSCAPE-DRAFTS.md section 15.

## BACKLOG (2026-09-30): buff stacking, analysed, not a primary focus (the owner: "add it to the backlog, its not a primary focus right now")
- Full stack vs none (same kit): ~x2.1-2.6 DPS, ~x2 survivability (Rex solo ~21 min -> ~8). Most outcomes are capped on the TOTAL (OUT_CAP, swing 20%).
- UNCAPPED lanes that compound: damage (tkDmg = gadget + style gem + outfit + adm/mdm, x(1+focus), then x(1+gemVs)); accuracy (scope + jade, x(1+focus));
  Ward (x1.12 defence, cubed through mobHitChance, ~x0.71 hits) on top of the tough cap.
- Bugs: fxOf.speed never reaches walking (food, drinks, the +3% achievement, yeti boots all promise it; stepMsOf only gets the admin value);
  pet tix sits outside the 25% tix cap; bloodstone says "food and regeneration" but only food reads it.
- Options: (1) measure real multipliers per fight into /stats first; (2) soft caps (full to ~+40%, half after) on damage and accuracy, Ward
  inside one damage-reduction ceiling; (3) a Buffs panel showing each buff and how close to each cap; (4) fix the three bugs. Recommended 4 + 1, then decide 2.

## BUG (2026-09-30, reported live): the Frost ward ring and amulet (and Yeti-fur boots) can't be made at the anvil
- The owner: "frost charm, amulet, ring not available to craft on anvil".
- Likely cause (checked, not fixed): the anvil's Smith tab lists recipes by metal TIER (eastscape.html ~5677, `ITEMS[r.out[0]]?.tier === smithTier`),
  and smith_frostward_ring / smith_frostward_amulet / smith_yeti_boots make items with no `tier`, so they never appear in any tab. The server would
  make them if asked. Fix: give them a place in the anvil window (e.g. a "Frost" group, or a tier such as the onyx/dragonstone one their bars come from).
- The Frost CHARM is not craftable by design: it is bought from Wren / Morwenna (50,000 since rules 368). Say so in the wiki if players expect it at the anvil.

## NEXT (2026-09-30, the owner, during the Store build): ISLAND IMPROVEMENTS, significantly - "its a fan favorite of players"
- The owner: "we need to make the island sizes bigger (and make sure to retain everyones custom placed decor), make them look better,
  offer different cottage customization, and ideate how we can make islands better in general".
- Constraints: every existing isle.decor [{k,x,y,at}] must survive a resize (shift or re-map coordinates; decorFits must still pass, and
  anything that no longer fits goes back to isle.owned as spare, never lost). Plots, pedestals, pen, hatchery, cellar ladder, bank chest too.
- To bring: bigger island tiers/maps, a look pass (Yard ground rules, shoreline, props), cottage styles (interior/exterior skins, wallpaper,
  floors), and a list of ideas (visiting/likes, island ratings, guest book, decor sets, lighting at night, etc.).

## BUILT ON DEV (2026-09-30), NOT LIVE: the islands, phases 1-3 (the owner: "start phase 1, then 2, then 3 ... all on dev for now")
- Phase 1, bigger islands: `isleBuild` = the old oval (ISLE_OLD) UNION a much bigger coast (ISLE_SHAPE); every old object stays put,
  new palms/rocks/bushes only on tiles that were sea; dock + ferry at the new south shore (planks run up the beach), T3 bridge at the
  new east shore; cobble path dock -> door (","); stranded pockets get a sandy way through. Decor caps 20/32/48 outside, 20 inside.
  SAFETY NET `decorSweep` (decor rules): runs at login and after an upgrade, any piece on a bad tile goes back to the tray (owned kept).
  Looks: themes are real ground sets now (t_isle_<theme>[_w], tools/eastscape-isle-ground-art.mjs): sand beach at every coast; new
  themes Tropical 5,000 / Autumn 5,000 / Frozen 7,500; trees tinted per theme (ISLE_TREE_FX). Roads now paint on islands.
- Phase 2, the cottage: bigger inside for everybody (room [5,3,16,10] -> [3,3,18,12], old floor all still floor, ferns moved to the new
  corners, door on the new front wall); COTTAGE styles (Stone Manor, Log Cabin, Beach Hut, Witch's House, Casino Villa: PixelLab art,
  tools/eastscape-isle-extra-art.mjs), walls (cream, burgundy, navy, forest, gold damask) and floors (marble, casino carpet, checker,
  flagstone), sold in the Store's Decor tab, mirrored onto isle.look (isleLookSync) so visitors see them offline.
- Phase 3, livestock: chicken coop / cow pen / fishing cage (ISLE_FARM) sold by Yahsmeena, fill in real time up to a day's worth, two of a
  kind fill twice as fast, click to empty (bag, then bank), bubble shows rounds waiting. Dev admin: `farmage` ages the clocks.
- Also: Yahsmeena's shop lists every Store piece with a STORE ribbon and a button to the Store.
- Tests: tools/eastscape-isle-resize-test.mjs (every old decor tile still usable, 300 random pieces survive per tier, cottage floor kept),
  tools/eastscape-isle-farm-test.mjs. Wiki islands guide rewritten. Ships with a VERSION bump when the owner says go.

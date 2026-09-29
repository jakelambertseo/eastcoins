/* ============================================================
   EastScape: THE COUNT ROOM — a party HEIST under the casino. The rules, the map and the numbers.
   Its server side is eastscape-worker/src/count.js; the Crypt is the same shape (eastscape-crypt-rules.js)
   and this file deliberately mirrors it, because a party is a party and index.js already knows how to run one.

   The owner, 2026-09-25: "can we work on the party quest idea ie Kill x amount of mobs to beat it. what if
   there were 4 treasure chests users had to unlock with keys they found around the map?"

   WHAT MAKES IT NOT THE CRYPT AND NOT THE PYRAMID. Both of those are "clear the room, the gate opens, kill the
   boss at the end" — a corridor. This is a QUOTA in ONE OPEN ROOM. The house's people keep coming, out of four
   doors, for as long as you are in there; the way out unlocks when the party has put down `quota` of them AND
   the floor is clear. There is no boss. What you are fighting is the clock and your food.

   AND THE BOXES ARE THE REASON TO SPLIT UP. Four keys are hidden among the searchable things, drawn fresh every
   run, so they have to be hunted while the rest of the party holds the floor. Each box pays every member a roll
   there and then, and it pays MORE the earlier you crack it.

   WHY THE BOXES DO NOT HOLD SHARED LOOT. The Crypt settled this: one hoard, everybody opens it for their OWN
   roll, so there is nothing to argue about and nobody can ninja anything. Same here, four times over.

   It is HANDED the shared rules and the map helpers: createCountRules(G, G._MAP).
   ============================================================ */
export function createCountRules(G, H) {
  const { room, block } = H;

  /* WHAT YOU CAN SEARCH, AND WHAT IT LOOKS LIKE (2026-09-25, the owner: "make the keys be in either the
     suitcases OR the crates", "and possibly in the hay carts"). Three pictures, one meaning: if it is one of
     these you can go through it, and it might have a key.

     THE RULE THAT MATTERS is that NOTHING ELSE on this map may wear these three pictures. The first cut had
     twelve searchable lockers drawn as o_crates and six pieces of cover drawn the same way, so the only way to
     tell them apart was to hover — the owner found it by asking what the lockers looked like. Three pictures is
     variety; three pictures that sometimes lie is a chore. tools/eastscape-count-check.mjs enforces it. */
  const SEARCH_ART = ["o_suitcase", "o_crates", "o_handcart"];
  const SEARCH_NAME = { o_suitcase: "An abandoned case. Worth a look", o_crates: "A crate of chips. Worth a look", o_handcart: "A loaded cart. Worth a look" };

  const COUNT = {
    party: [2, 4], runsPaid: 3, lateShare: 0.25,   // three paid clears a Chicago day, as the Crypt; after that a quarter
    fullShare: 0.10, lowShare: 0.5,                // under a tenth of the party's kills: half pay
    maxRuns: 6,                                    // private copies at once, server-wide
    rejoinMs: 3 * 60 * 1000, wipeMs: 15000,
    /* (2026-09-25) DEARER TO GET IN AND WORTH MORE WHEN YOU DO (the owner: "the tickets payout should be more
       (require a higher ante and minimum level to counteract this)"). 200 in and 2,200 out made this the
       cheapest thing in the game with a real payout, which put it in front of players it was not built for. At
       750 in and 6,000 out it is the Deep Crypt's kind of money for a fraction of its ante, and it asks Combat
       25 at the door — roughly where the fight actually sits, so the door and the fight finally agree.
       `lvl` IS THE DOOR and `rec` IS THE FIGHT, the Crypt's distinction, and the screens say both. */
    lvl: 25, rec: 30, ante: 750, pay: 6000,
    /* THE QUOTA, per party size: 2 players 110, 3 players 160, 4 players 210. The figure that sets it is NINE
       SECONDS A KILL per player including the walk, which is what one of these costs at about Combat 30 in gear
       that level can wear — so a quota is about eight minutes whatever the party size. It is an ESTIMATE and the
       first real clears should be timed against it; tools/eastscape-count-check.mjs holds the same number. */
    quota: (n) => Math.max(60, Math.round(50 * Math.max(1, n) + 10)),
    /* (2026-09-25, the owner: "make it mandatory to kill all the mobs too in the count room, even after all the
       keys are found") THE QUOTA IS NOT THE END — THE FLOOR IS. Filling it stops the doors, but the way out
       stays shut until whatever is still standing is down. Without this the last stretch was a walk to the exit
       past monsters you could ignore; now the run ends on a fight, which is what it is for. */
    clearToLeave: true,
    /* THE DOORS. Four of them, one to a wall. ONE monster comes out per gap and the doors take turns — not one
       per door, which would be four times the pace. The gap TIGHTENS as the quota fills, so the last third is
       meaningfully busier and a party that is winning still has to hold.
       (2026-09-25, "mobs should come out faster", and the room is now twice the size, so the old rate read as an
       empty warehouse.) At the floor the doors produce 40 a minute against the 27 a four-player party can put
       down: a full room is a room you are losing ground in. Nothing spawns while `alive` are already up. */
    doors: [{ x: 21, y: 2 }, { x: 2, y: 12 }, { x: 41, y: 12 }, { x: 21, y: 23 }],
    spawnMs: 2800, spawnMin: 1500, alive: 16,
    /* THE BOXES, one to a corner of a room that is now 42x24, so the corners are a real walk apart. */
    boxes: [{ x: 3, y: 3 }, { x: 40, y: 3 }, { x: 3, y: 22 }, { x: 40, y: 22 }],
    /* SIXTEEN HIDING PLACES over twice the ground, in three kinds, so finding all four keys is a lap of the
       room. The third number is which picture it wears; they are mixed deliberately so no one shape means "key". */
    spots: [
      [8, 5, 0], [16, 4, 1], [27, 4, 2], [35, 5, 0], [5, 11, 1], [12, 18, 2], [21, 8, 0], [21, 17, 1],
      [30, 18, 2], [38, 11, 0], [9, 21, 1], [33, 21, 2], [14, 11, 0], [28, 11, 1], [6, 17, 2], [37, 17, 0],
    ],
    keys: 4,
    exit: { x: 21, y: 24 },
    /* THE BOLT-HOLE (2026-09-25, the owner: "add a staircase near the back incase someone gets locked in there,
       then that staircase takes them back to the casino"). It ALWAYS works, quota or no quota, and it pays
       NOTHING — that is the whole distinction. The main exit is the job finished; this is the fire escape, and a
       room you can be shut inside because a rule did not fire the way anybody expected is far worse than a room
       with an unglamorous way out of it. */
    bolt: { x: 40, y: 12 },
    door: { scene: "casino", x: 12, y: 18 },   // where you stand to start one; the count room's service door
    /* (2026-09-25, the owner: "more tickets for opening the chests faster") A BOX IS WORTH MORE EARLY. The
       multiplier runs from `best` the moment you walk in down to 1 by `coldMs`, so cracking one in the first
       couple of minutes — while the floor is filling and you are least able to spare the walk — is worth half
       as much again. It scales the TICKET roll only: making an ITEM rarer for being slow would be the game
       punishing you twice for the same thing. */
    boxSpeed: { best: 1.6, coldMs: 5 * 60 * 1000 },
    /* WHAT A BOX PAYS. One roll each, for everybody in the party who is in the room when it is opened — the
       Crypt's hoard rules, four smaller helpings instead of one big one. `bonus` is a fraction of `pay`, so a
       box follows the tier's money rather than being a second number to keep in step. */
    box: { bonus: [0.10, 0.22],
      table: [["tix", 40], ["drink", 18], ["meal", 16], ["clover", 10], ["scroll", 7], ["chip", 6], ["horseshoe", 2], ["gear", 1]],
      drink: [["beer", 5], ["cocktail", 3], ["whiskey", 2]], meal: [["chickendinner", 4], ["steakdinner", 2], ["porkchops", 1]],
      chip: [["chip_red", 4], ["chip_black", 1]],
      gear: ["gamblers_ring", "bookies_amulet", "sharps_gloves"] },   /* the cheap end of the Crypt's buff set: this is the low-band dungeon and must not out-drop the ones above it */
  };

  /* THE CAST is the casino's own people, which is the whole joke: you are robbing the count room and the house
     sends the Highwayman, the layabouts, the paper twister and the card counter after you. Every one already
     exists in the base game with art on disk, so this room shipped without waiting on a picture. They are
     COPIES (`count: true`) with their own numbers, so tuning the heist cannot reach the versions out in the world.

     AGGRO 40, WHICH LOOKS ABSURD AND IS NOT. The chase leash in the worker is `cheb(player, the monster's HOME)
     <= aggro + 5`, and home is the door it came out of — so with the 7 it had, a player could stand on the far
     side of a 42x24 room and watch the house mill about by the wall (the owner: "you can just stand on the other
     side of the room"). 45 covers the whole floor, which is the right behaviour for a room whose entire premise
     is that the house comes for you. It is a per-COPY number and reaches nothing outside this dungeon. */
  const mk = (from, name, mul, over) => {
    const b = G.MOBS[from];
    return { name, art: b.art || from, size: b.size, box: b.box, lvl: b.lvl,
      hp: Math.round(b.hp * mul), att: Math.round(b.att * mul), def: Math.round(b.def * mul),
      max: Math.max(1, Math.round(b.max * mul)), speed: b.speed, aggro: 40, drops: [], count: true, ...(over || {}) };
  };
  const mobs = {
    /* softened from the world versions: out there you meet one at a time, in here you meet four at once and the
       quota means you meet two hundred. */
    ct_highwayman: mk("highwayman", "House Muscle", 0.9),
    ct_boneidle: mk("boneidle", "Night Porter", 0.95),
    ct_twister: mk("twister", "Floor Manager", 0.9),
    ct_counter: mk("counter", "The Counter", 0.85),
    /* (2026-09-25, the owner: "add a few of the mini bosses to come out") TWO THE ROOM STOPS FOR. Rare in the
       wave rather than scheduled, so nobody can plan around them, and slow and heavy rather than simply
       high-level: something to deal with together, not a wall. Each counts as ONE toward the quota like anything
       else, so a mini boss is pure cost unless the party wants the fight — which is the right trade. */
    ct_usher: mk("usher", "The Pit Boss", 1.1, { size: "l" }),
    ct_critic: mk("critic", "The Auditor", 0.55, { size: "xl" }),
  };
  /* who comes out, and how often. The heavy ones are rare, so the average kill is quick and the occasional one
     makes you stop and eat. The Auditor is about one spawn in thirty-three. */
  const WAVE = [["ct_highwayman", 30], ["ct_boneidle", 27], ["ct_twister", 20], ["ct_counter", 14], ["ct_usher", 6], ["ct_critic", 3]];

  const scenes = {
    count: {
      name: "The Count Room", interior: true, count: true, shared: true, floor: "casino", carpet: "t_casino",
      wallH: 34, tint: "rgba(20,8,28,.35)", room: [1, 1, 42, 24],
      exitTo: COUNT.door, entry: { x: 21, y: 21 },
      /* ONLY WHAT IS NOT ALREADY IN CORE. This list is not "what this scene uses" — naming a picture here is
         what takes it OUT of core.png for everybody, which is how o_yew once left the Boneyard's ancient yews
         drawing as plain trees. Every prop is deliberately core casino art, so the list is ONE entry: the
         crypt's stairs-out, which is area art already and is shared with the Crypt. */
      /* AND THE SIX FACES, which is the part that caught me out (the owner: "the floor manager night porter and
         the counter have no art"). All six ARE in ART_FILES, so the obvious reading is that they are in core and
         reachable from anywhere — but every one of them is ALSO named in the area list of the map it normally
         stands on, and naming a picture in an area list is precisely what takes it OUT of core. They were
         already deferred, by somebody else, to somewhere this room is not. Listing them here defers nothing
         further; it makes them reachable from here as well, which is what the Crypt does with its own monsters.
         The lesson: "it is in ART_FILES" does not mean "I can see it". */
      art: ["o_cryptexit", "highwayman", "boneidle", "twister", "counter", "usher", "critic"],
      build() {
        const g = room(1, 1, 42, 24, 2), objs = [];
        const put = (t, name, list, w = 1, h = 1, extra = null) => {
          for (const [x, y] of list) { objs.push({ t, x, y, w, h, name, ...(extra || {}) }); block(g, x, y, w, h); }
        };
        /* FLAT means you walk over it. Litter is decoration and must never be cover, or a room this size full of
           it is a room you cannot cross. Everything in `put` blocks; everything in `litter` does not. */
        const litter = (art, name, list) => { for (const [x, y] of list) objs.push({ t: "sign", art, x, y, name, soft: true, flat: true }); };

        /* THE FOUR DOORS the house comes out of. Scenery — the spawning is the server's — but they must be
           visible or a monster appearing out of a blank wall reads as a bug. Their tiles stay WALKABLE. */
        COUNT.doors.forEach((d, i) => objs.push({ t: "cryptgate", door: i, x: d.x, y: d.y, name: "A service door. Something comes through it" }));
        objs.push({ t: "countexit", art: "o_cryptexit", x: COUNT.exit.x, y: COUNT.exit.y, w: 2, h: 1, name: "The way out: it unlocks when the floor is clear" });
        block(g, COUNT.exit.x, COUNT.exit.y, 2, 1);
        /* the fire escape, at the back. Always open, pays nothing, and says so on the label. */
        objs.push({ t: "countexit", art: "o_cryptexit", bolt: true, x: COUNT.bolt.x, y: COUNT.bolt.y, name: "Back stairs to the casino. Always open, and you leave with nothing" });
        g[COUNT.bolt.y][COUNT.bolt.x] = "#";
        COUNT.boxes.forEach((b, i) => { objs.push({ t: "countbox", art: "o_chest", box: i, x: b.x, y: b.y, name: `Deposit box ${i + 1}. Locked` }); g[b.y][b.x] = "#"; });
        COUNT.spots.forEach(([x, y, a], i) => {
          const art = SEARCH_ART[a % SEARCH_ART.length];
          objs.push({ t: "countsearch", art, spot: i, x, y, name: SEARCH_NAME[art] });
          block(g, x, y, 1, 1);
        });

        /* COVER, spread over twice the ground and in far more shapes than the six it had (the owner: "add more
           variety to the graphics/art thats sitting on the ground"). All core casino art, so the scene's art
           list stays at one entry. NONE of it wears a SEARCH_ART picture — that is the rule this map lives by. */
        put("table", "A counting table, stacked", [[13, 7], [29, 7], [13, 18], [29, 18]], 2, 1, { art: "o_pokertable" });
        put("table", "A blackjack table, abandoned mid-shoe", [[8, 13], [34, 13]], 2, 1, { art: "o_blackjack" });
        put("table", "A slot machine, unplugged", [[11, 10], [32, 10], [11, 16], [32, 16]], 1, 1, { art: "o_slots" });
        put("sack", "Sacks. Heavy ones", [[5, 7], [38, 7], [5, 19], [38, 19]], 1, 1, { art: "o_sacks" });
        put("statue", "A cash machine, face down", [[16, 2], [27, 2]], 1, 1, { art: "o_atm" });
        put("statue", "A safe, door hanging open", [[7, 10], [36, 10]], 1, 1, { art: "o_cashier" });
        put("statue", "A coat rack. Somebody left in a hurry", [[2, 6], [41, 6], [2, 19], [41, 19]], 1, 1, { art: "o_coatrack" });
        put("crate", "A skip. Do not ask", [[7, 24], [36, 24]], 2, 1, { art: "o_dumpster" });
        put("barrel", "A bin", [[2, 9], [41, 9], [2, 16], [41, 16]], 1, 1, { art: "o_trashcan" });
        put("bucket", "A mop and a bucket", [[18, 21], [25, 21]], 1, 1, { art: "o_mopbucket" });
        put("chair", "A stool", [[15, 12], [28, 12], [10, 8], [33, 8], [15, 16], [28, 16]], 1, 1, { art: "o_stool" });
        put("chair", "An armchair somebody dragged in", [[6, 3], [37, 3]], 1, 1, { art: "o_armchair" });
        put("column", "A rope post", [[19, 5], [24, 5], [19, 20], [24, 20]], 1, 1, { art: "o_ropepost" });
        put("column", "A standing lamp", [[6, 15], [37, 15], [12, 3], [31, 3]], 1, 1, { art: "o_lamppost" });
        put("plant", "A tired potted palm", [[4, 13], [39, 13], [24, 3], [18, 22]], 1, 1, { art: "o_planter" });

        /* LITTER, walked over and never in the way. This is what stops a big room reading as an empty warehouse. */
        litter("o_wetfloor", "A wet floor sign, ignored", [[21, 12], [8, 20], [35, 4]]);
        litter("o_l_chips", "Chips, spilled", [[14, 9], [28, 15], [6, 12], [20, 6], [33, 19]]);
        litter("o_l_cards", "Cards, face down", [[17, 14], [26, 9], [10, 6], [31, 21]]);
        litter("o_l_slips", "Betting slips, hundreds of them", [[22, 16], [12, 13], [30, 6], [19, 18]]);
        litter("o_l_spill", "A spill nobody dealt with", [[24, 8], [16, 20], [35, 15]]);
        litter("o_l_shoe", "One shoe", [[27, 17], [13, 22]]);
        litter("o_ashtray", "An ashtray, full", [[20, 10], [23, 13], [7, 18]]);
        litter("o_cocktail", "A glass, still cold", [[15, 6], [29, 12], [11, 19]]);
        return { g, objs, blobs: [] };
      },
      /* NOTHING STANDS HERE AT THE START. Every monster in this room is spawned by the server out of the four
         doors, which is what makes it a quota rather than a clear — so the list is empty ON PURPOSE and a future
         edit that "fixes" it by adding monsters has broken the design. */
      mobs: [], npcs: [], bots: []
    }
  };

  /** which of the `spots` hold a key this run, from the run's own seed. Four of sixteen, never the same twice. */
  function keySpots(seed, n = COUNT.keys) {
    const idx = COUNT.spots.map((_, i) => i);
    /* Fisher-Yates off the seed, the way every committed thing in this game is shuffled, so a run's hiding
       places can be replayed from the seed alone and nobody has to trust the server about them. */
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.abs(hash32(`${seed}:key:${i}`)) % (i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, n).map((i) => ({ i, x: COUNT.spots[i][0], y: COUNT.spots[i][1] }));
  }
  /* a small deterministic hash, local to this file because it is evaluated before the shared rules finish and
     cannot reach G's own. Same shape as the one the Carnival's stalls use. */
  function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

  const pickW = (list, r) => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = r() * tot; for (const [k, w] of list) if ((x -= w) < 0) return k; return list[list.length - 1][0]; };

  /** how much more a box is worth for being opened early: `best` at the start, 1 by coldMs */
  const boxMult = (msIn) => {
    const S = COUNT.boxSpeed, f = Math.max(0, Math.min(1, msIn / Math.max(1, S.coldMs)));
    return S.best - (S.best - 1) * f;
  };

  /** what ONE deposit box pays ONE member: [{ k, n }]. Mirrors the Crypt's rollLoot, one roll instead of 3-7. */
  function rollBox(loot, r = Math.random) {
    const L = COUNT.box, out = [], mult = loot.mult == null ? 1 : loot.mult;
    const add = (k, q = 1) => { const s = out.find((x) => x.k === k); if (s) s.n += q; else out.push({ k, n: q }); };
    let kind = pickW(L.table, r);
    if (kind === "gear" && loot.late) kind = "tix";   /* past the day's paid runs a box cannot be farmed for gear, exactly as the Crypt's chest cannot */
    if (kind === "tix") add("tickets", Math.max(10, Math.round(loot.pay * (L.bonus[0] + r() * (L.bonus[1] - L.bonus[0])) * mult)));
    else if (kind === "drink") add(pickW(L.drink, r));
    else if (kind === "meal") add(pickW(L.meal, r));
    else if (kind === "clover") add("clover");
    else if (kind === "scroll") add("tp_scroll", 1 + Math.floor(r() * 2));
    else if (kind === "horseshoe") add("horseshoe");
    else if (kind === "chip") add(pickW(L.chip, r));
    else if (kind === "gear") add(L.gear[Math.floor(r() * L.gear.length)]);
    /* a box always gives SOMETHING: an empty one, after crossing a room full of monsters for the key, is a bad joke */
    if (!out.length) add("tickets", Math.round(loot.pay * L.bonus[0] * mult));
    return { items: out };
  }

  /** the gap between spawns right now: it tightens as the quota fills, so the end of a run is the busy part */
  const spawnGap = (done, quota) => {
    const f = Math.max(0, Math.min(1, done / Math.max(1, quota)));
    return Math.round(COUNT.spawnMs - (COUNT.spawnMs - COUNT.spawnMin) * f);
  };

  return { COUNT, mobs, scenes, WAVE, SEARCH_ART, keySpots, rollBox, boxMult, spawnGap, hash32 };
}

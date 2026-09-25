/* ============================================================
   EastScape: THE GREAT PYRAMID — a party dungeon under the Golden Sands. The rules, the map and the numbers.
   Its server side is eastscape-worker/src/pyramid.js; the Crypt is the same shape (eastscape-crypt-rules.js).

   WHAT MAKES IT NOT THE CRYPT. The owner commissioned it as "one hard tier that is roughly same difficulty as
   black crypt", with "a unique separator from the crypt instead of just tickets", "different layout than the
   crypt but same functions (clear room, move to next)", "randomize the difficulty of the first few rooms mobs",
   and "a new and different boss mechanic from the Hoodie ... the boss to be a giant snake, and its room mobs
   are pharoahs". Each of those is a section below.

   ONE TIER. The Crypt has three sharing one map; this has one, pitched at the Black Crypt (its chamber monsters
   are level 52-58 with 67-252 health, its boss 65 with 3780). `lvl` is the DOOR and `rec` is the FIGHT, and they
   are nowhere near each other - at 40 you will land about one swing in ten on the boss. 76 is where you land
   half. The Crypt's screens learned to say so and so do these.

   IT PAYS FEWER TICKETS THAN THE CRYPT ON PURPOSE (6,500 against 11,000 for the same ante). The separation the
   owner asked for is in the chest: venom that exists nowhere else and gates the best potion in the game, a pet
   that drops nowhere else, and the buff gear. The Crypt is where you go for tickets; this is where you go for
   things. Change one of those two numbers and you have flattened the choice.
   ============================================================ */
export function createPyramidRules(G, H) {
  const { room, block } = H;

  const PYRAMID = {
    /* the same party rules as the Crypt, and deliberately so: a party is a party, and World.dungeonOwe reads
       fullShare / lowShare / runsPaid / lateShare straight off this object. */
    /* OPEN (2026-09-24, the owner: "turn it on for everyone then ill reset the server").
       It went in admin-only because it had never been run by four people and the ante is real tickets; the
       owner has decided to open it on a live room instead, which is his call to make. What that means in
       practice, so nobody has to reconstruct it later: the SHAPE of the run is proven offline - the map, the
       gates, the leashes, the chest's table against 60,000 rolls, and the payout through the same
       World.dungeonOwe the Crypt uses. What is NOT proven by anything but four people in a room is the coil
       breaking on 5% of the boss's health, the burrow relocating it, the lever, and the chest opening at the
       end. If a first run goes wrong, set this back to false - it refuses at the door before a ticket moves. */
    live: true,
    party: [2, 4], runsPaid: 3, lateShare: 0.25, fullShare: 0.10, lowShare: 0.5, maxRuns: 6,
    wipeMs: 15000, rejoinMs: 3 * 60 * 1000, threatMs: 10000, zdropMul: 12,
    door: { scene: "sands", x: 40, y: 7 },           // the pyramid on the Golden Sands' eastern skyline
    tiers: [null, { name: "The Great Pyramid", lvl: 40, rec: 76, ante: 1250, pay: 6500, sfx: "" }],
    bossHp: (base, n) => Math.round(base * (0.6 + 0.1 * n * n)),   // 2 players 1x, 3 = 1.5x, 4 = 2.2x, as the Crypt

    /* ---------------------------------------------------------------- THE SNAKE
       NOTHING THE HOODIE DOES. His fight is a telegraphed slam you step out of, adds at half health, and an
       enrage timer; copying that with a different sprite would make this the same dungeon twice.

       COIL is the whole idea. Every `everyMs` the serpent takes hold of ONE player - warned for `warnMs` first -
       and that player cannot move and bleeds `hurt` of their maximum a second. They cannot free themselves. The
       grip breaks when the REST OF THE PARTY does `breakFrac` of the boss's full health to it, or when `maxMs`
       runs out. So the fight asks the party to drop what it is doing and save somebody, which is a thing four
       people have to actually notice and agree about - and it is why a solo admin test of this is not the fight.

       BURROW is the second half: at `at` fractions of its health it goes under the sand, untargetable for
       `downMs`, and comes up somewhere else in the chamber. It resets everybody's position rather than dealing
       damage, which stops a party parking in one corner for six minutes.

       REACH is what makes the pharaohs the fight you have first (2026-09-24, the owner: "the snake should be
       placed further to the back, so the players fight the risen pharohs first and then the snake"). The coil
       only takes hold of somebody within `reach` of the serpent, so a party working through the pharaohs at the
       chamber's mouth is not being grabbed by something at the apex six tiles away. Step up to it and it starts.
       Its own aggro is turned down to match, on the placement, further down this file. */
    coil: { everyMs: 21000, warnMs: 3000, maxMs: 9000, hurt: 0.09, breakFrac: 0.05, reach: 4 },
    burrow: { at: [0.70, 0.40], downMs: 5000 },

    /* ---------------------------------------------------------------- the chambers
       A PYRAMID CROSS-SECTION, and the point of it is that it is not the Crypt's four rooms in a row. You come in
       at the base and work UP through four chambers, each narrower than the last, to the burial chamber at the
       top. The gates are on the centre line rather than along one wall, so the way on is always straight ahead.
       Same verbs as the Crypt: clear the chamber, its gate opens, move up.

       THE BURIAL CHAMBER IS THE BIG ROOM NOW (2026-09-24, the owner, from a screenshot of it: "its very
       claustrophobic with all the large mobs. it needs to be 2-3X larger because there will be up to 4 players in
       there as well"). He is right, and the arithmetic says how right: it was 12 by 5, and once the torches, the
       braziers, the altar, the candles, the gargoyles and the stairs were in it, FORTY-SEVEN tiles were standable.
       Nine bodies were going in there, four of them `size: "l"` and one `"xl"` - the Squeeze's box is 24 by 60,
       which is two tiles wide and nearly three tall of drawn sprite. So the room was full before anybody arrived.

       The rows are the whole budget: `room(1, 3, 42, 22)` is twenty of them and three are the solid walls between
       chambers, so every row the burial chamber gains, the three below it lose. It now takes EIGHT (y3 to y10) and
       they take three each, which is the right way round: chambers 0 to 2 are forty, thirty-four and twenty-six
       tiles WIDE and their monsters are spread along them, so depth is the dimension they were not using.

       AND IT IS A TAPER, not a box. Widening the top chamber to a rectangle as wide as its base would have flattened
       the silhouette the whole map exists to draw - the pyramid would have come out T-shaped. `TAPER` gives the
       chamber a span per row, x11..x32 at the mouth stepping in to x18..x25 at the apex, so the room genuinely comes
       to a point and is BIGGER at the same time: 132 tiles, 113 of them standable once the dressing is in.
       2.4x, in the middle of what he asked for. `rooms[3]` stays the bounding rectangle, because roomOf's job is
       "which chamber is this body in" and no body ever stands on a wall. */
    rooms: [{ y0: 20, y1: 22, x0: 2, x1: 41 }, { y0: 16, y1: 18, x0: 5, x1: 38 },
      { y0: 12, y1: 14, x0: 9, x1: 34 }, { y0: 3, y1: 10, x0: 11, x1: 32 }],
    /* the burial chamber's floor, row by row: the apex is the short one */
    taper: { 3: [18, 25], 4: [16, 27], 5: [15, 28], 6: [14, 29], 7: [13, 30], 8: [12, 31], 9: [11, 32], 10: [11, 32] },
    walls: [19, 15, 11],                               // the solid rows between them
    gates: [{ x: 21, y: 19 }, { x: 21, y: 15 }, { x: 21, y: 11 }],
    lever: { x: 24, y: 13 },                           // opens the burial chamber, once everyone alive is in chamber 3

    /* ---------------------------------------------------------------- the first chambers are not the same twice
       (the owner: "randomize the difficulty of the first few rooms mobs"). A run's seed shifts the monsters in
       chambers 1 to 3 by up to `jitter` either way - health, accuracy and defence together, so a chamber is
       uniformly softer or harder rather than lopsided. The BURIAL CHAMBER IS NEVER JITTERED: the boss and its
       pharaohs are the fight the tier is balanced on, and a party that has earned its way up should not find the
       last room randomly 25% harder than the one their gear was chosen for. */
    jitter: 0.25,

    /* ---------------------------------------------------------------- the chest
       The Crypt's shape - a chest each, your own roll, nothing shared - with a table that is the reason to come.
       `venom` is FIRST and guaranteed, because a run that gave you no venom would be a run that gave you nothing
       you cannot get elsewhere. */
    loot: { at: { x: 21, y: 6 }, rolls: [[3, 26], [4, 30], [5, 22], [6, 14], [7, 8]], lateRolls: 3, lowRolls: 4, bonus: [0.04, 0.1],
      venom: [1, 2],                                   // always, on top of the rolls
      table: [["tix", 26], ["shell", 16], ["fang", 14], ["drink", 12], ["meal", 10], ["clover", 9], ["chip", 6], ["gear", 4], ["pet", 1.6], ["horseshoe", 1.4]],
      drink: [["beer", 5], ["cocktail", 3], ["whiskey", 2], ["champagne", 1]],
      meal: [["chickendinner", 4], ["steakdinner", 2], ["porkchops", 2], ["fishplatter", 1]],
      chip: [["chip_red", 3], ["chip_black", 2], ["chip_gold", 0.2]],
      gear: ["gamblers_ring", "bookies_amulet", "adjusters_visor", "stake_loafers", "sharps_gloves", "angels_ring"] },
  };

  /* ---------------------------------------------------------------- the monsters
     All six are its own art (tools/eastscape-pyramid-art.mjs) and none is a Crypt monster or a Golden Sands one:
     a dungeon whose rooms look like the map outside it is a corridor. The numbers sit on the Black Crypt's:
     chamber monsters 52-58 at 67-252 health, the boss above the Hoodie's 3780 because there is only one tier of
     this and no third difficulty to climb to. */
  const mobs = {
    swarm: { name: "Scarab Swarm", art: "swarm", size: "s", lvl: 53, hp: 80, att: 58, def: 20, max: 12, speed: 1600, aggro: 6, box: [12, 22], drops: [["scarabshell", [1, 2]]] },
    grifter: { name: "Grave Grifter", art: "grifter", size: "m", lvl: 54, hp: 95, att: 52, def: 36, max: 14, speed: 2300, aggro: 6, box: [10, 26], drops: [["tickets", [90, 210]]] },
    canopic: { name: "Canopic Horror", art: "canopic", size: "m", lvl: 56, hp: 140, att: 55, def: 50, max: 16, speed: 2900, aggro: 5, box: [10, 25], drops: [["tickets", [110, 250]]] },
    dustwraith: { name: "Sand Wraith", art: "dustwraith", size: "m", lvl: 57, hp: 70, att: 66, def: 24, max: 14, speed: 1800, aggro: 7, box: [9, 26], drops: [["sand", [2, 5]]] },
    /* THE BOSS ROOM'S MOBS ARE PHARAOHS (the owner's words). The picture came with the Golden Sands, drawn for
       this before the map shipped so its sheet would not change again when the dungeon landed. */
    pharaoh: { name: "Risen Pharaoh", art: "pharaoh", size: "l", lvl: 60, hp: 260, att: 70, def: 68, max: 26, speed: 3100, aggro: 8, box: [14, 34], drops: [["snakefang", 1]] },
    squeeze: { name: "The Squeeze", art: "squeeze", size: "xl", lvl: 68, hp: 4200, att: 150, def: 112, max: 52, speed: 2500, aggro: 9, box: [24, 60], boss: true, drops: [] },
  };

  /* which chamber a point is in, 0-based; -1 for the walls between them */
  const roomOf = (x, y) => PYRAMID.rooms.findIndex((r) => y >= r.y0 && y <= r.y1 && x >= r.x0 && x <= r.x1);
  /* THE ONE PLACE THE PYRAMID'S SHAPE IS DECIDED: which columns of row y are floor, or null for a wall row. The
     build carves the map from it and the worker's burrow picks a landing spot from it, so a change to the taper
     cannot move the walls without also moving where the serpent can surface. */
  const spanAt = (y) => {
    if (PYRAMID.taper[y]) return PYRAMID.taper[y];
    const r = PYRAMID.rooms.find((q) => y >= q.y0 && y <= q.y1);
    return r ? [r.x0, r.x1] : null;
  };

  const scenes = {
    pyramid: {
      name: "The Great Pyramid", interior: true, pyramid: true, shared: true, floor: "stone", wallH: 34,
      tint: "rgba(30,16,4,.42)", room: [1, 3, 42, 22],
      exitTo: PYRAMID.door, entry: { x: 21, y: 21 },
      /* THE MONSTERS LIVE ON THE SCENE, in [type, x, y] like every other scene in the game - the run's private
         copy is built by the ordinary scene machinery and cryptEnter's mirror walks `run.mobs` to set health and
         swap in the tier. Keeping them in a table of my own would have spawned an EMPTY dungeon.
         THE PHARAOHS ARE AT THE MOUTH AND THE SERPENT IS AT THE APEX (2026-09-24, the owner: "the snake should be
         placed further to the back, so the players fight the risen pharohs first and then the snake"). Four
         pharaohs hold y9 and y10, a stride past the gate; the Squeeze is six rows further up at the point of the
         pyramid. Placing it back there is only half of it, because a monster chases anything inside its `aggro` -
         at the serpent's own 9 it would have met the party AT the door and the pharaohs would have been an
         afterthought. THE PLACEMENT TURNS ITS AGGRO DOWN TO 4, so it ignores you until you are most of the way up
         the chamber or until somebody hits it, after which pyramidThreat sends it after whoever did. Coil has a
         matching `reach`. Nothing about the fight itself changed - it is the same serpent, met second. */
      mobs: [["swarm", 6, 21], ["swarm", 12, 20], ["grifter", 30, 21], ["grifter", 37, 20], ["swarm", 16, 22],
        ["grifter", 9, 17], ["canopic", 15, 16], ["canopic", 28, 16], ["dustwraith", 34, 17], ["swarm", 24, 18],
        ["canopic", 14, 13], ["dustwraith", 18, 12], ["dustwraith", 26, 14], ["canopic", 30, 13],
        ["pharaoh", 17, 10], ["pharaoh", 25, 10], ["pharaoh", 14, 9], ["pharaoh", 28, 9],
        ["squeeze", 21, 4, { aggro: 4 }]],
      npcs: [], bots: [],
      /* ITS OWN STONE (2026-09-24, the owner: "put in art for the pyramid floor and the pyramid walls too").
         It borrowed the Crypt's cold slate flagstones on the reasoning that a tomb is a tomb — and then never
         drew them at all, because every drawn-interior branch in the page was gated on `def.crypt`. Both halves
         are fixed: the gate is `def.tomb` there now, and this is warm sandstone of its own —
         t_tomb's ochre flagstones, and t_tombwall's block courses with hieroglyph bands, a jackal relief and a
         lapis scarab in them (tools/eastscape-pyramid-tiles.mjs). */
      floorArt: "t_tomb", wallArt: "t_tombwall",
      art: ["swarm", "grifter", "canopic", "dustwraith", "pharaoh", "squeeze", "t_tomb", "t_tombwall",
        "o_cryptgate", "o_cryptlever", "o_sarcophagus", "o_crypttorch", "o_cryptpillar", "o_cryptaltar",
        "o_cryptcoffin", "o_gargoyle", "o_ghostbrazier", "o_cryptcandles", "o_cryptexit", "o_skullheap",
        "o_bonepile", "o_cryptrubble", "o_obelisk", "o_chest",
        /* (2026-09-24, the owner on the first live clear: "chest didnt shoow at the end after defeat") THE HOARD
           HAD NO PICTURE. o_cryptloot.png exists, but it is not in core and this list never asked for it — so the
           chest was placed, and clickable, and drew nothing. A scene art list is not documentation: a prop missing
           from it is a prop that is not there. tools/eastscape-artreach.mjs covers the dungeons now and would have
           said so, which is the real fix. */
        "o_cryptloot"],
      build() {
        const g = room(1, 3, 42, 22, 21), objs = [];
        /* IT NARROWS, ROW BY ROW. Everything outside a row's own span is solid wall, which is what gives the
           inside of the pyramid its shape; the three rows in `walls` belong to no chamber and so come out solid,
           and the gates are the only way through them. The burial chamber's span comes from `taper`, so the top
           of the map steps in to a point rather than stopping at a flat ceiling. */
        for (let y = 3; y <= 22; y++) {
          const s = spanAt(y);
          for (let x = 1; x <= 42; x++) if (!s || x < s[0] || x > s[1]) g[y][x] = "v";
        }
        PYRAMID.gates.forEach((q, i) => {
          g[q.y][q.x] = "#";
          objs.push({ t: "cryptgate", gate: i, x: q.x, y: q.y, name: i === 2 ? "The burial chamber. The lever opens it" : "A stone door. It grinds open when the chamber is clear" });
        });
        objs.push({ t: "cryptlever", x: PYRAMID.lever.x, y: PYRAMID.lever.y, name: "Lever: opens the burial chamber once everyone alive is in here" });
        block(g, PYRAMID.lever.x, PYRAMID.lever.y, 1, 1);
        objs.push({ t: "booth", art: "o_chest", x: 18, y: 13, name: "A chest: your bank, to restock" }); block(g, 18, 13, 1, 1);
        /* the way out, cut into the apex - and OFF the centre line, because the serpent is on it now. x21 from
           the gate at y11 all the way to the Squeeze at y4 is the way in and nothing may stand in it. */
        objs.push({ t: "cryptexit", x: 18, y: 3, w: 2, h: 1, name: "Stairs out into the sun: once the Squeeze is dead" }); block(g, 18, 3, 2, 1);
        /* THE HOARD, and it starts HIDDEN. `open: true` is what keeps a chest (or a raised gate) out of the
           world; the client sets it false when the run reads as cleared, which is how it appears the moment the
           serpent dies. Without this object there is nothing to click and the chest can never be opened -
           the loot exists on the character either way, but the only way to get it would be to walk out and have
           it posted after you. */
        objs.push({ t: "cryptloot", x: PYRAMID.loot.at.x, y: PYRAMID.loot.at.y, open: true, name: "The Squeeze's hoard: one each, once it is dead" });

        /* the dressing. Nothing stands on the centre line (the lane the gates are on), on a monster's spot, or
           on the chest, the lever or the chest-drop tile. */
        const put = (t, name, list, w = 1, h = 1) => { for (const [x, y] of list) { objs.push({ t, x, y, w, h, name }); block(g, x, y, w, h); } };
        put("crypttorch", "A torch, still going", [[4, 20], [39, 20], [7, 16], [36, 16], [11, 12], [32, 12], [13, 7], [30, 7], [16, 4], [27, 4]]);
        put("sarcophagus", "A sarcophagus. Occupied", [[3, 21], [40, 21], [6, 17], [37, 17]], 1, 2);
        put("cryptpillar", "A pillar, cracked", [[10, 20], [33, 20], [12, 16], [31, 16], [14, 12], [29, 12], [12, 9], [31, 9], [15, 6], [28, 6]]);
        put("obelisk", "A small obelisk", [[16, 20], [27, 20]]);
        /* THE JACKALS FLANK THE BURIAL DOOR at one remove. On (20,10) and (22,10) they would have pinched the only
           way in down to the single tile (21,10), with four pharaohs waiting on the other side of it. */
        put("gargoyle", "A jackal, carved. It is facing the way in", [[19, 10], [23, 10]]);
        put("ghostbrazier", "Cold fire", [[16, 5], [27, 5], [12, 8], [31, 8]]);
        /* THE ALTAR IS OFF THE CENTRE LINE, and it has to be: it once sat squarely in the only doorway into the
           burial chamber and walled the boss off from the party entirely. */
        put("cryptaltar", "The offering table. Swept clean", [[18, 5]]);
        put("cryptcoffin", "An open coffin. Nothing in it", [[24, 12]]);
        put("skullheap", "Skulls, stacked", [[8, 20], [35, 20]]);   /* (37,20) was under a Grave Grifter */
        put("bonepile", "Bones", [[25, 21], [11, 17], [29, 17]]);
        put("cryptrubble", "Rubble", [[14, 21], [32, 21], [20, 16]]);
        put("cryptcandles", "Candles, lit", [[19, 4], [24, 4]]);
        return { g, objs, blobs: [] };
      },
    },
  };

  /* ---------------------------------------------------------------- the chest's roll
     The Crypt's rollLoot, with this table. The FIRST item is always the clear's tickets - the same sum the clear
     is owed - and the venom is added on top of the rolls rather than competing with them. */
  const pick = (rows, r) => { const tot = rows.reduce((a, [, w]) => a + w, 0); let n = r * tot; for (const [k, w] of rows) { n -= w; if (n <= 0) return k; } return rows[rows.length - 1][0]; };

  function rollLoot(L) {
    const out = [], rnd = Math.random;
    const rolls = L.late ? PYRAMID.loot.lateRolls : L.low ? PYRAMID.loot.lowRolls : pickCount(rnd());
    if (L.pay > 0) out.push({ k: "tickets", n: L.pay });
    /* the venom: always, and the reason the run exists */
    const [v0, v1] = PYRAMID.loot.venom;
    out.push({ k: "serpentvenom", n: v0 + Math.floor(rnd() * (v1 - v0 + 1)) });
    const table = L.late ? PYRAMID.loot.table.filter(([k]) => k !== "gear" && k !== "pet") : PYRAMID.loot.table;
    for (let i = 1; i < rolls; i++) {
      const k = pick(table, rnd());
      if (k === "tix") out.push({ k: "tickets", n: Math.max(1, Math.round(L.pay * (PYRAMID.loot.bonus[0] + rnd() * (PYRAMID.loot.bonus[1] - PYRAMID.loot.bonus[0])))) });
      else if (k === "shell") out.push({ k: "scarabshell", n: 1 + Math.floor(rnd() * 3) });
      else if (k === "fang") out.push({ k: "snakefang", n: 1 + Math.floor(rnd() * 2) });
      else if (k === "drink") out.push({ k: pick(PYRAMID.loot.drink, rnd()), n: 1 });
      else if (k === "meal") out.push({ k: pick(PYRAMID.loot.meal, rnd()), n: 1 });
      else if (k === "chip") out.push({ k: pick(PYRAMID.loot.chip, rnd()), n: 1 });
      else if (k === "gear") out.push({ k: PYRAMID.loot.gear[Math.floor(rnd() * PYRAMID.loot.gear.length)], n: 1 });
      else if (k === "pet") out.push({ k: "pet:coilling", n: 1 });   // the worker turns this into a real pet
      else out.push({ k, n: 1 });
    }
    return { rolls, items: out };
  }
  function pickCount(r) { const tot = PYRAMID.loot.rolls.reduce((a, [, w]) => a + w, 0); let n = r * tot; for (const [c, w] of PYRAMID.loot.rolls) { n -= w; if (n <= 0) return c; } return 4; }

  return { PYRAMID, mobs, scenes, roomOf, spanAt, rollLoot };
}

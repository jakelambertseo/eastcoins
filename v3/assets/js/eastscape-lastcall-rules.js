/* ============================================================
   EastScape: LAST CALL — a drop-nothing free-for-all. The rules, the map and the numbers.
   Its server side is eastscape-worker/src/lastcall.js.

   The owner, 2026-09-25: "a drop nothing PVP event, where users starts on all different sides of maps, they
   have no gear on, and chests around the map have random gear in them and food and potions that they gear up
   with and try to kill each other. last one alive wins tickets".

   THE ONE THING THAT DECIDES WHETHER THIS WORKS. Measured before a line of it was written: naked, a Combat 80
   hits a Combat 38 ninety-five per cent of the time and is hit back eighteen. A SIXTEEN level gap already
   saturates it, and the best weapon in the game is +40 accuracy against a roll that clamps at 0.95 — so loot
   cannot close a level gap, and on a roster running from 1 to 80 the same person would win every single event.
   So COMBAT IS FLATTENED. Everyone fights at FLAT.lvl with FLAT.hp, and the only things that differ are what
   you find in the chests and how you play. Your real level buys you nothing in here, which is the point: the
   prize is tickets, and anybody at the top of the ladder already earns more per hour farming.

   AND NOTHING OF YOURS IS EVER TOUCHED. Not stashed, not removed, not restored — none of which could be made
   safe against a crash. Your bag and your gear simply DO NOT EXIST in here: the arena gives you a separate set
   of hands (`pl.arena`, runtime state on the player and never on the character), and everything you loot lives
   and dies with the match. That is what makes "drop nothing" a fact about the architecture rather than a
   promise about the code being right.
   ============================================================ */
export function createLastCallRules(G, H) {
  const { room, block } = H;

  const LAST = {
    /* WHO AND WHEN. A lobby opens when somebody clicks the door and runs for `lobbyMs`; whoever is in at zero
       plays. MIN is three because two people is a duel and a duel between friends is a way to hand each other
       the purse; MAX is eight because the roster that would enter is about nine. */
    min: 3, max: 8, lobbyMs: 90000,
    /* THE PURSE IS THE HOUSE'S, fixed per entrant, exactly like the Daily Pot — so the inflation is a number you
       can state rather than one you have to model: `each` x entrants, once per event. At three players that is
       1,200 tickets against roughly 14,000 an hour farming the Thunderhead, so winning is worth turning up for
       and is nowhere near worth farming. `paidWins` a Chicago day, then a quarter, is the dungeons' own rule and
       it is here for the same reason: it is the cheapest brake on two friends queueing each other. */
    each: 400, paidWins: 2, lateShare: 0.25,
    /* THE FLAT NUMBERS. Everybody, always. hp is tracked by the arena and never touches the character's own. */
    flat: { lvl: 40, hp: 55 },
    matchMs: 6 * 60 * 1000,     // if nobody has won by then, most kills takes it; a tie goes to most health left
    startGraceMs: 5000,         // you cannot be hit for the first five seconds, so a scatter next to somebody is not a death sentence
    respawnChestMs: 75000,      // a looted chest comes back, so late is not hopeless
    door: { scene: "casino", x: 32, y: 18 },
    /* EIGHT CORNERS TO START FROM, as far apart as the room allows: the owner asked for "all different sides". */
    spawns: [[3, 5], [21, 4], [40, 5], [3, 20], [21, 21], [40, 20], [3, 12], [40, 12]],
    /* THE CHESTS, spread between the spawns so the middle is worth the walk but not the only place to go. */
    chests: [[11, 8], [32, 8], [11, 17], [32, 17], [21, 12], [7, 12], [36, 12], [21, 7], [21, 18]],
    /* WHAT IS IN ONE. Three rolls, and the table is deliberately shallow: this is a fight, not a shopping trip,
       and a chest you have to read is a chest somebody kills you at. `arena` keys are ORDINARY item keys, used
       for their name and picture only — nothing here is ever added to a real bag. */
    loot: {
      rolls: [2, 3],
      table: [["weapon", 30], ["armour", 34], ["food", 28], ["potion", 8]],
      weapon: [["bronze_sword", 5], ["emerald_sword", 4], ["diamond_sword", 3], ["dragonstone_maul", 2], ["onyx_sword", 2], ["starfall_gladius", 1]],
      armour: [["bronze_body", 5], ["emerald_body", 4], ["emerald_helm", 4], ["diamond_body", 3], ["diamond_shield", 3], ["onyx_helm", 2], ["onyx_body", 1]],
      food: [["csardine", 5], ["ctrout", 4], ["cbonefish", 3], ["cskyeel", 2]],
      potion: [["pot_salve2", 3], ["pot_swift", 2], ["pot_hide", 2]],
    },
    /* what a piece of arena food heals, flat, because the real heal values were tuned against real max health */
    heal: { csardine: 10, ctrout: 14, cbonefish: 18, cskyeel: 22, pot_salve2: 30, pot_swift: 0, pot_hide: 0 },
  };

  const scenes = {
    lastcall: {
      name: "Last Call", interior: true, lastcall: true, shared: true, floor: "casino", carpet: "t_casino",
      wallH: 34, tint: "rgba(30,6,20,.35)", room: [1, 3, 42, 22],
      exitTo: LAST.door, entry: { x: 21, y: 12 },
      /* NOTHING AREA-ONLY. Every prop is core casino art, so this list is empty and nothing is deferred out of
         core for the rest of the game. (An `art` name in a scene list is what TAKES a picture out of core.png.) */
      art: [],
      build() {
        const g = room(1, 3, 42, 22, 2), objs = [];
        const put = (t, name, list, w = 1, h = 1, extra = null) => {
          for (const [x, y] of list) { objs.push({ t, x, y, w, h, name, ...(extra || {}) }); block(g, x, y, w, h); }
        };
        /* THE CHESTS. `lcchest` is a kind of its own so a click routes to the arena's own handler; the picture
           is an `art` override, which is why this needed no new asset. */
        LAST.chests.forEach(([x, y], i) => { objs.push({ t: "lcchest", art: "o_chest", chest: i, x, y, name: "A chest. Somebody left in a hurry" }); g[y][x] = "#"; });
        /* COVER. A flat room is a shooting gallery: you want corners to break line of sight and something to put
           between you and somebody with a maul. Nothing stands on a spawn or a chest. */
        put("table", "A card table, overturned", [[14, 6], [27, 6], [14, 19], [27, 19]], 2, 1, { art: "o_pokertable" });
        put("crate", "Crates", [[8, 5], [35, 5], [8, 20], [35, 20], [17, 12], [25, 12]], 1, 1, { art: "o_crates" });
        put("statue", "A cash machine", [[17, 9], [25, 9], [17, 16], [25, 16]], 1, 1, { art: "o_atm" });
        put("barrel", "A bin", [[6, 8], [37, 8], [6, 17], [37, 17]], 1, 1, { art: "o_trashcan" });
        put("chair", "A stool", [[12, 12], [30, 12], [21, 15], [21, 10]], 1, 1, { art: "o_stool" });
        put("column", "A rope post", [[9, 12], [33, 12], [15, 4], [28, 4], [15, 21], [28, 21]], 1, 1, { art: "o_ropepost" });
        put("sack", "Sacks", [[5, 15], [38, 15], [5, 9], [38, 9]], 1, 1, { art: "o_sacks" });
        return { g, objs, blobs: [] };
      },
      mobs: [], npcs: [], bots: []
    }
  };

  const pickW = (list, r) => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = r() * tot; for (const [k, w] of list) if ((x -= w) < 0) return k; return list[list.length - 1][0]; };

  /** what one chest holds: 2 or 3 arena items, as [{k, kind}] */
  function rollChest(r = Math.random) {
    const L = LAST.loot, n = L.rolls[0] + Math.floor(r() * (L.rolls[1] - L.rolls[0] + 1)), out = [];
    for (let i = 0; i < n; i++) {
      const kind = pickW(L.table, r);
      out.push({ k: pickW(L[kind], r), kind });
    }
    return out;
  }

  /** the synthetic character arena combat is resolved on: flat level, and only what you looted in here */
  function arenaChar(gear) {
    const xp = G.XP_AT[LAST.flat.lvl - 1] || 0;
    return { xp: { melee: xp, hp: xp }, eq: gear || {}, eqf: {}, pets: [], inv: [] };
  }

  /** which slot an arena item goes in — the real item's own slot, so a shield is a shield */
  const slotOf = (k) => G.ITEMS[k]?.slot || null;

  return { LAST, scenes, rollChest, arenaChar, slotOf, pickW };
}

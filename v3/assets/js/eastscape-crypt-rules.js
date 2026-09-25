/* ============================================================
   EastScape: THE CRYPT, a party dungeon under the casino (its rules: the map, the monsters, the numbers)

   The owner, 2026-09-21: "could there be a dungeon level with mobs that users have to get through, and then at the end of a dungeon
   is a strong boss that multiple players would have to team up to kill together? ... it would create a social effect of asking
   in chat for a party", then "diablo 2 style dungeon, skeletons, dark, ghosts". The design he said go to is section 6 of
   EASTSCAPE-DRAFTS.md. Everything outside is solo; this is the one thing you cannot do alone.

   WHAT IS HERE. One map (`crypt`): four chambers in a row, west to east, shut off from each other by three GATES.
       the Ossuary (Skeleton Guards)  |gate 0|  the Haunted Hall (ghosts, bone golems)  |gate 1|  the Antechamber (a chest to
       restock at, and the LEVER)  |gate 2|  the Hoodie's Sanctum
     Gates 0 and 1 open when their chamber is cleared. Gate 2 opens at the lever, and only when everybody still alive is in the
     antechamber, so nobody is left behind. THREE DIFFICULTIES share the map and the pictures (TIERS): each has its own copy of
     the four monsters with tougher numbers (cryptguard / cryptguard2 / cryptguard3, all drawn with `art: "cryptguard"`).
   A party gets a PRIVATE COPY of the scene, `crypt:<run id>`, the way every player gets a private island; it is thrown away when
   the last of them leaves. Nothing here is in the page's first load: the game server registers it at start, and the page
   fetches this file the first time it is told about a crypt (the same hook the closed areas' maps use).

   It is HANDED the shared rules and the map helpers: createCryptRules(G, G._MAP).
   ============================================================ */
export function createCryptRules(G, H) {
  const { room, block } = H;
  /* THE NUMBERS. ante and pay are tickets EACH; pay is about one and a half times what the same minutes pay solo in the area
     you qualify for (tools/eastscape-road.mjs), so it is worth organising and solo play is still worth doing.
     (2026-09-23) HALVED with everything else, to G.TIX_RATE. These are the only absolute ticket figures in the crypt --
     `bonus` is a fraction of `pay` and the chip rolls are priced from VALUE, so both followed on their own. Left alone,
     a clear would have paid THREE times the solo rate rather than one and a half, and the crypt would have become the
     only sensible way to earn in the game. If TIX_RATE ever moves again, these move with it. */
  const CRYPT = {
    party: [2, 4], runsPaid: 3, lateShare: 0.25,            // three paid clears a Chicago day each; after that a clear pays a quarter
    fullShare: 0.10, lowShare: 0.5,                          // under a tenth of the boss's damage: half pay (nobody is carried for nothing)
    maxRuns: 6,                                              // private copies at once, server-wide
    slam: { everyMs: 20000, warnMs: 2500, reach: 2, hurt: 0.4 }, addsAt: 0.5, enrageMs: 5 * 60 * 1000, enrageMul: 2, threatMs: 10000,
    wipeMs: 15000, rejoinMs: 3 * 60 * 1000,   // a dropped connection keeps its place in the party and the run this long
                                              // everybody in the party dead inside this window = a wipe
    zdropMul: 10,                                            // the boss's real-ZCoin chance, times a normal kill's
    door: { scene: "workyard", x: 35, y: 12 },               // where you stand by the stairway (v108: it is in the Yard, by the jukebox; it was in the Forum)
    tiers: [null,
      /* (2026-09-23) `lvl` IS THE DOOR; `rec` IS THE FIGHT, and they are nowhere near each other. A boss is hit
         on clamp(0.5 + (yourAttackRoll - itsDefence) * 0.04, 0.10, 0.95), and an attack roll is your melee level
         plus your worn accuracy. Every one of these bosses has a defence far above what its own gate level can
         roll, so AT THE STATED GATE, in the best gear that level can wear, you hit it ONE SWING IN TEN and the
         fight takes over an hour. `rec` is the melee level at which you land about half your swings: 22, 47 and
         76 against defences of 35, 68 and 109. The Black Crypt's door says 40 and its fight wants 76.
         The gates themselves are not changed here - that is a balance decision, written up in the backlog with
         the two ways to do it - but the screens must stop implying the door is the requirement. */
      { name: "The Crypt", lvl: 10, rec: 22, ante: 250, pay: 2500, sfx: "" },
      { name: "The Deep Crypt", lvl: 30, rec: 47, ante: 750, pay: 7000, sfx: "2" },
      { name: "The Black Crypt", lvl: 40,   /* (2026-09-22) was 50: four people each at 50 was the harshest gate in the game, and the crypt was buffed in the same breath to pay for it */ rec: 76, ante: 1250, pay: 11000, sfx: "3" }],
    bossHp: (base, n) => Math.round(base * (0.6 + 0.1 * n * n)),   // 1 player 0.7x (admins testing alone), 2 = 1x, 3 = 1.5x, 4 = 2.2x
    rooms: [{ x0: 1, x1: 10 }, { x0: 12, x1: 21 }, { x0: 23, x1: 27 }, { x0: 29, x1: 42 }],
    gates: [{ x: 11, y: 13 }, { x: 22, y: 13 }, { x: 28, y: 13 }], lever: { x: 25, y: 10 },
    /* THE HOARD (v109; the owner, 2026-09-21: "add a loot box to the end of dungeons that every player can open. no shared loot, each player
       gets their own ... a chance of 3-7 items, tickets, loot rarely, buffs, etc. dont give the users tickets directly after a boss defeat
       anymore, put them in the lootbox instead"). A chest appears in front of the throne when the Hoodie dies. Everybody who earned the
       clear opens it for THEIR OWN roll: 3 to 7 things (`rolls`: [how many, weight]). The FIRST is always the clear's tickets, the same sum
       the clear used to pay on the spot; every other roll is one line of `table` by weight (the three numbers are the three difficulties).
       A roll of "tix" is a bonus stack worth `bonus` of the clear's pay. Gear is one of the six buff pieces that otherwise only drop.
       A clear past the day's three paid runs is 3 rolls and no gear; under a tenth of the boss's damage is 4 at most. The real-ZCoin roll
       that used to happen at the kill happens at the chest. Left unopened, it is sent after you (crypt.js cryptLootSweep). */
    loot: { at: { x: 40, y: 13 }, rolls: [[3, 30], [4, 30], [5, 20], [6, 12], [7, 8]], lateRolls: 3, lowRolls: 4, bonus: [0.04, 0.1],
      table: [["tix", [34, 32, 30]], ["drink", [22, 22, 22]], ["meal", [16, 17, 17]], ["clover", [13, 12, 12]], ["scroll", [7, 5, 4]], ["chip", [5, 7, 8]], ["horseshoe", [1, 2, 3]], ["gear", [0.6, 1, 1.5]], ...(G.THIEF?.live ? [["permit", [0.3, 0.5, 0.8]]] : [])]   /* (2026-09-23) the permit rides THIEF.live with everything else: a chest paying the key to a locked room is worse than not paying it */   /* (about one chest in 50, 30 and 20: "loot rarely") */,
      drink: [["beer", 5], ["cocktail", 3], ["whiskey", 2], ["champagne", 1]], meal: [["chickendinner", 4], ["steakdinner", 2], ["porkchops", 2], ["fishplatter", 1]],
      chip: [[["chip_red", 1]], [["chip_red", 3], ["chip_black", 1]], [["chip_red", 3], ["chip_black", 2], ["chip_gold", 0.15]]],
      gear: ["gamblers_ring", "bookies_amulet", "adjusters_visor", "stake_loafers", "sharps_gloves", "angels_ring"] }
  };
  const mk = (name, art, size, box, base, tierMul) => { const out = {}; /* (2026-09-22) BUFFED, because the door opened. Dropping the Black Crypt to Combat 40 made it easier to get into,
     so what is inside had to get meaner or the tier would pay 22,000 for less work than before. The step between
     tiers is steeper now as well: the Crypt is roughly a third harder, the Black Crypt nearly half again. */
  [1.35, 2.6, 4.2].forEach((m, i) => { const t = i + 1, s = CRYPT.tiers[t].sfx; out[art + s] = { name, art, size, box, lvl: [base.lvl, base.lvl + 20, base.lvl + 40][i], hp: Math.round(base.hp * m * (tierMul || 1)), att: Math.round(base.att * m), def: Math.round(base.def * m), max: Math.max(1, Math.round(base.max * m)), speed: base.speed, aggro: base.aggro, drops: [], crypt: true, ...(base.boss ? { boss: true } : {}) }; }); return out; };
  const mobs = {
    ...mk("Skeleton Guard", "cryptguard", "m", [8, 24], { lvl: 12, hp: 22, att: 12, def: 9, max: 3, speed: 2400, aggro: 5 }),
    ...mk("Restless Ghost", "cryptghost", "m", [8, 24], { lvl: 15, hp: 16, att: 15, def: 6, max: 3, speed: 1900, aggro: 6 }),
    ...mk("Bone Golem", "cryptgolem", "l", [12, 30], { lvl: 18, hp: 60, att: 16, def: 16, max: 6, speed: 3200, aggro: 4 }),
    ...mk("The Hoodie", "hoodie", "xl", [20, 56], { lvl: 25, hp: 900, att: 34, def: 26, max: 12, speed: 2400, aggro: 9, boss: true }   /* the Hoodie takes the tier buff AND a pass of its own: it is the thing people bring four friends for */)
  };
  const scenes = {
    crypt: {
      name: "The Crypt", interior: true, crypt: true, shared: true, floor: "wood", wallH: 34, tint: "rgba(8,6,26,.5)", room: [1, 4, 42, 21],
      exitTo: CRYPT.door, entry: { x: 3, y: 20 },
      floorArt: "t_crypt", wallArt: "t_cryptwall",   // (v104) drawn flagstones and wall faces (tools/eastscape-crypt-art.mjs)
      art: ["cryptguard", "cryptghost", "cryptgolem", "hoodie", "t_crypt", "t_cryptwall", "o_cryptgate", "o_cryptlever", "o_sarcophagus", "o_bonepile", "o_crypttorch",
        "o_cryptpillar", "o_cryptaltar", "o_cryptcage", "o_cryptcoffin", "o_cryptthrone", "o_gargoyle", "o_ghostbrazier", "o_cryptcandles", "o_cryptexit", "o_skullheap", "o_cryptrubble", "o_cryptrack", "o_cryptloot", "o_chest"],   /* (2026-09-24) o_chest is deferred out of core by the guild and yard lists, so the Crypt’s restock chest has been drawing as a generic shape since it shipped. Found by the same checker run that found the Pyramid’s hoard. */
      build() {
        const g = room(1, 4, 42, 21, 2), objs = [];
        for (const wx of [11, 22, 28]) for (let y = 4; y <= 21; y++) g[y][wx] = "v";                       // the three cross walls
        CRYPT.gates.forEach((q, i) => { g[q.y][q.x] = "#"; objs.push({ t: "cryptgate", gate: i, x: q.x, y: q.y, name: i === 2 ? "The Sanctum gate: the lever opens it" : "An iron gate. It opens when this chamber is cleared" }); });
        objs.push({ t: "cryptlever", x: CRYPT.lever.x, y: CRYPT.lever.y, name: "Lever: opens the Sanctum when everyone alive is in here" }); g[CRYPT.lever.y][CRYPT.lever.x] = "#";
        objs.push({ t: "booth", art: "o_chest", x: 25, y: 16, name: "A chest: your bank, to restock" }); g[16][25] = "#";
        for (const [x, y] of [[3, 6], [8, 6], [3, 18], [14, 6], [19, 18], [31, 6], [40, 6], [31, 19], [40, 19]]) { objs.push({ t: "sarcophagus", x, y, w: 1, h: 2, name: "A sarcophagus. Occupied" }); block(g, x, y, 1, 2); }
        for (const [x, y] of [[6, 10], [16, 15], [19, 8], [34, 9], [38, 17]]) { objs.push({ t: "bonepile", x, y, name: "Bones. Somebody's", soft: true, flat: true }); }
        for (const x of [5, 16, 25, 33, 39]) { objs.push({ t: "crypttorch", x, y: 4, name: "A torch" }); g[4][x] = "#"; }
        /* (v104) THE WAY OUT, at the far end: stairs up to the Forum in the Sanctum's back wall. The game server only lets you climb them once the Hoodie is dead. */
        objs.push({ t: "cryptexit", x: 36, y: 4, w: 2, h: 1, name: "Stairs up and out: once the Hoodie is dead" }); block(g, 36, 4, 2, 1);
        /* (v104) MORE IN IT. Everything blocks its tile(s); nothing stands on row 13 (the lane the gates are on), on a monster's spot or by the entrance. */
        const put = (t, name, list, w = 1, h = 1) => { for (const [x, y] of list) { objs.push({ t, x, y, w, h, name }); block(g, x, y, w, h); } };
        put("cryptpillar", "A broken pillar", [[2, 11], [9, 11], [2, 16], [9, 16], [13, 11], [20, 11], [32, 8], [32, 17], [35, 8], [35, 17]]);
        put("cryptthrone", "The Hoodie's throne. Bones, mostly", [[39, 11]], 3, 2);
        put("gargoyle", "A gargoyle. It was looking the other way a minute ago", [[30, 11], [30, 15]]);
        put("ghostbrazier", "Ghost fire. It gives no heat", [[38, 9], [38, 15], [24, 20], [26, 20]]);
        put("cryptaltar", "An altar. Recently used", [[24, 6]], 2, 1);
        put("cryptcandles", "Candles. Somebody keeps lighting them", [[23, 6], [27, 6], [42, 10], [42, 13]]);
        put("cryptcage", "A cage. The tenant stopped complaining", [[17, 6], [13, 19], [10, 8]]);
        put("cryptcoffin", "An open coffin", [[5, 5], [15, 20]], 2, 1);
        put("cryptrack", "The rack. Out of order", [[27, 19], [12, 5]]);
        put("skullheap", "A heap of skulls. Former parties", [[9, 20], [29, 20], [33, 5]], 2, 1);
        put("cryptrubble", "Rubble", [[10, 5], [21, 20], [23, 20], [42, 20], [29, 9], [1, 8]]);
        /* THE HOARD: in front of the throne. `open: true` is how the page hides a gate that has been raised; here it hides the chest until the boss is dead (eastscape-crypt.js shows it when the game server says the run is cleared). Its tile is always blocked. */
        objs.push({ t: "cryptloot", x: CRYPT.loot.at.x, y: CRYPT.loot.at.y, open: true, name: "The Hoodie's hoard: one each, once he's dead" }); g[CRYPT.loot.at.y][CRYPT.loot.at.x] = "#";
        return { g, objs, blobs: [] };
      },
      // tier 1's monsters: the game server swaps in the tier's own when it makes a party's copy (CRYPT.tiers[t].sfx)
      mobs: [["cryptguard", 4, 8], ["cryptguard", 7, 9], ["cryptguard", 5, 13], ["cryptguard", 8, 15], ["cryptguard", 4, 17], ["cryptguard", 7, 19],
        ["cryptghost", 14, 7], ["cryptghost", 19, 10], ["cryptghost", 14, 16], ["cryptghost", 19, 19], ["cryptgolem", 16, 12], ["cryptgolem", 18, 15],
        ["hoodie", 37, 12]],
      npcs: [], bots: []
    }
  };
  /** which chamber a tile is in (0..3), or -1 for a wall */
  const roomOf = (x) => CRYPT.rooms.findIndex((r) => x >= r.x0 && x <= r.x1);
  const pickW = (list, r) => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = r() * tot; for (const [k, w] of list) if ((x -= w) < 0) return k; return list[list.length - 1][0]; };
  /** what one player's chest holds: [{ k, n }], tickets first. loot: { tier, pay, late, low } */
  function rollLoot(loot, r = Math.random) {
    const L = CRYPT.loot, t = Math.max(1, Math.min(3, loot.tier | 0)), out = [{ k: "tickets", n: Math.max(0, Math.round(loot.pay)) }];
    let n = pickW(L.rolls, r); if (loot.late) n = L.lateRolls; else if (loot.low) n = Math.min(n, L.lowRolls);
    const add = (k, q = 1) => { const s = out.find((x) => x.k === k); if (s) s.n += q; else out.push({ k, n: q }); };
    for (let i = 1; i < n; i++) {
      let kind = pickW(L.table.map(([k, w]) => [k, w[t - 1]]), r); if ((kind === "gear" || kind === "permit") && loot.late) kind = "tix";   /* (2026-09-23) a permit follows gear's rule: past the three paid runs a chest pays tickets instead, so the Crypt cannot be farmed for permits */
      if (kind === "tix") add("tickets", Math.max(10, Math.round(loot.pay * (L.bonus[0] + r() * (L.bonus[1] - L.bonus[0])))));
      else if (kind === "drink") { let k = pickW(L.drink, r); if (k === "champagne" && t < 2) k = "whiskey"; add(k); }
      else if (kind === "meal") { let k = pickW(L.meal, r); if (k === "fishplatter" && t < 2) k = "steakdinner"; add(k); }
      else if (kind === "clover") add("clover"); else if (kind === "scroll") add("tp_scroll", 1 + Math.floor(r() * 3)); else if (kind === "horseshoe") add("horseshoe");
      else if (kind === "chip") add(pickW(L.chip[t - 1], r)); else if (kind === "gear") add(L.gear[Math.floor(r() * L.gear.length)]);
      else if (kind === "permit") add("thieves_permit");   /* the way into the Thieves' Guild that is not 50,000 tickets. Tradeable, so one lucky clear supplies several people and the shop price becomes a ceiling. */
    }
    return { rolls: n, items: out };
  }
  return { CRYPT, mobs, scenes, roomOf, rollLoot };
}

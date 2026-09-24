/* ============================================================
   THE TOWER (2026-09-22) — the grind tower.

   A condemned casino hotel that should not be next to the Yard. One tiny room a floor, the door behind you shut,
   one thing in it with far too much health, and a stairway up that does not work until that thing is dead. Thirty
   floors, a boss every tenth, and The House at the top.

   WHY IT IS SHAPED LIKE THIS — the one fact the whole design rests on:

     XP IS PAID PER POINT OF DAMAGE DEALT, not per kill (`xpForDamage`: COMBAT_XP x dmg, plus HP_XP x dmg).

   So a monster's HEALTH is a free dial. Doubling it doubles how long a fight lasts and halves how many kills an
   hour you get — which halves the drops — and leaves xp an hour EXACTLY where it was. A semi-AFK, xp-focused,
   loot-poor tower falls out of a formula the game already had. Measured against the Trailer Park at melee 85:
   the tower pays about 1.39x the xp an hour on 46% of the kills, because it never makes you walk, wait for a
   respawn or retarget. That is the whole trade, and it is why the drop table here is nearly bare.

   The three dials, and what each one is actually for:
     HEALTH   how long a fight is, and so how AFK it is, and so how much loot falls. NO effect on xp an hour.
     DEFENCE  your chance to hit. THE ONLY XP DIAL. Raise it to slow the tower down; never use health for that.
     ATTACK   how much food a climb costs. Kept low enough that looking away is not a death sentence.

   THE CURVE IS COMPUTED, NOT TYPED. `climberAt(level)` builds the character the floor expects — the gear tier that
   level allows, its accuracy and strength totals, its max hit and swing — straight out of G.ITEMS. Then defence is
   set for a TARGET_HIT chance and health for a FIGHT_MS fight. Nothing here is a magic number that silently rots
   when a weapon is re-tuned: change a sword and the tower re-tunes itself. The numbers a designer actually chooses
   are the four constants at the top of TOWER, and they read in plain English.

   HEALTH HERE IS NOT HALVED. eastscape-shared.js halves every mob's hp on the way past
   (`for (const m of Object.values(MOBS)) m.hp = ...`), and these are merged in by the game server AFTER that has
   run — the same as the Crypt's. So the numbers below are the real fighting health, and you must NOT write double
   the way you would for a mob defined in shared.js.
   ============================================================ */
export function createTowerRules(G, H) {
  const { room, block } = H;

  const TOWER = {
    /* ---- the four numbers a designer picks. Everything else is derived. ---- */
    entry: 30,              // Combat to get in the door. 30 is about an hour of fighting (13,370 xp): long enough
                            // that the Yard and the Gloam have been seen, short enough not to be a launch wall.
                            // It also keeps ten levels between this and the Crypt at 40, so the solo AFK thing and
                            // the party loot thing are never the same evening's choice.
    floors: 30,             // a config number, not content: one room is rebuilt, so 60 or 100 costs nothing later
    topLevel: 60,           // floor 1 is tuned for `entry`, the top floor for this. Clearing it lands you in Starfall.
    fightMs: 45000,         // how long one floor's monster should take. 30s feels active, 90s feels like a screensaver.
    targetHit: 0.85,        // the xp throttle. Lower it to slow the tower; do not reach for health.
    creep: 0.01,            // and 1% longer each floor up. Without it a whole tier of floors is identical to the
                            // second - maxHit only moves every six levels and gear only every ten - so floors 1 to 9
                            // came out at the same 113 health and the climb had no shape. At the top this is a 58s
                            // fight rather than 45s. It is the ONE place health is used for feel rather than pacing,
                            // and it is safe precisely because health does not touch xp an hour.

    checkEvery: 10,         // a checkpoint every tenth floor, so a climb survives going to bed
    bossEvery: 10,          // and a boss on the same floors
    bossHp: 3,              // a boss is three fights in one
    bossEnrage: 0.5,        // and hits harder under half health (the `enrage` hook, wired 2026-09-22)

    door: { scene: "workyard", x: 39, y: 12 },   // where you stand when you come back out: the Yard's north court

    /* WHAT IS ON EACH FLOOR. A band is [firstFloor, baseMob]; the last band runs to the top. Every one of these is
       a monster that already exists somewhere in the game, reused at tower health — "buffed versions of our
       current mobs", which is also why the tower needed no new monster art. The bosses are existing bosses.
       The House at the top is not a joke about the theme, it IS the theme: it is the casino's own building. */
    bands: [[1, "ghoul"], [3, "stagehand"], [5, "chandelier"], [7, "usher"],
      [11, "brainstorm"], [13, "ram"], [15, "revenant"], [17, "seagoat"], [19, "angel"],
      [21, "goose"], [23, "wolf"], [25, "drake"], [27, "warden"]],
    bosses: { 10: "understudy", 20: "golem", 30: "house" },

    /* WHAT A FLOOR PAYS: a fifth of what the same monster pays outside, and NOTHING else (owner, 2026-09-22).
       Taken as a SHARE of the base monster's own ticket drop rather than as a flat number, so it scales with the
       floor for free and cannot drift away from the open world when a monster is re-tuned. The long fights already
       cut kills an hour to under half, so a climber earns roughly a tenth of what the same time outside pays -
       which is the trade: you are here for the xp.

       Items are dropped entirely. A tower monster's `drops` is the tickets line and nothing after it, so no ore, no
       gear, no rares. Pets are a separate roll and PET_SCENES does not list the tower, so none of those either. */
    tixShare: 0.2
  };

  /* ---------------------------------------------------------------- the climber a floor expects */
  const SLOTS = ["helm", "body", "legs", "shield", "boots", "gloves"];
  const tierAt = (lvl) => { let t = G.TIERS[0]; for (const x of G.TIERS) if (lvl >= (x.gate || 1)) t = x; return t; };
  /** The character floor N is balanced against: that level in the best full set its level allows. */
  function climberAt(lvl) {
    const key = tierAt(lvl).key, eq = [`${key}_sword`, ...SLOTS.map((s) => `${key}_${s}`)];
    let acc = 0, str = 0;
    for (const k of eq) { const it = G.ITEMS[k]; if (it) { acc += it.acc || 0; str += it.str || 0; } }
    const maxHit = 1 + Math.floor(lvl / 6) + Math.floor(str / 2);
    const swingMs = G.ITEMS[`${key}_sword`]?.speed || G.SWING_MS;
    return { lvl, tier: key, acc, str, maxHit, avg: (1 + maxHit) / 2, swingMs, attackRoll: lvl + 1 + acc };
  }
  /** The level a floor is tuned for: floor 1 at TOWER.entry, the last floor at TOWER.topLevel. */
  const levelOn = (floor) => Math.round(TOWER.entry + ((Math.max(1, Math.min(TOWER.floors, floor)) - 1) / Math.max(1, TOWER.floors - 1)) * (TOWER.topLevel - TOWER.entry));
  const isBoss = (floor) => floor % TOWER.bossEvery === 0;
  const baseOn = (floor) => TOWER.bosses[floor] || TOWER.bands.reduce((b, [f, k]) => (floor >= f ? k : b), TOWER.bands[0][1]);
  const checkpointAt = (floor) => Math.max(1, Math.floor((floor - 1) / TOWER.checkEvery) * TOWER.checkEvery + 1);

  /** Everything about one floor, derived. Stable for a given floor, so the page and the server agree without talking. */
  function floorSpec(floor) {
    const f = Math.max(1, Math.min(TOWER.floors, floor | 0)), lvl = levelOn(f), c = climberAt(lvl), boss = isBoss(f);
    /* hitChance = 0.5 + (att - def) * 0.04, so the defence that yields TARGET_HIT is exact arithmetic. */
    const def = Math.max(1, Math.round(c.attackRoll - (TOWER.targetHit - 0.5) / 0.04));
    const dps = G.hitChance(c.attackRoll, def) * c.avg / (c.swingMs / 1000);
    const hp = Math.max(8, Math.round(dps * (TOWER.fightMs / 1000) * (1 + TOWER.creep * (f - 1)) * (boss ? TOWER.bossHp : 1)));
    return { floor: f, lvl, boss, base: baseOn(f), def, hp, dps,
      att: Math.round(lvl * 0.9), max: Math.max(2, Math.round(2 + lvl * 0.22)),
      top: f === TOWER.floors, checkpoint: f % TOWER.checkEvery === 1 || f === 1 };
  }

  /* ---------------------------------------------------------------- one MOBS row per floor
     A row per floor rather than one row per base monster, because combat reads every stat off G.MOBS[m.t] - health,
     defence, attack, max - and never off the copy in the room. Thirty generated rows cost nothing and mean that a
     health bar, a splat, the wiki and /verify all see the same monster the fight does, with no special case
     anywhere for "but in the tower". */
  const mobs = {};
  for (let f = 1; f <= TOWER.floors; f++) {
    const s = floorSpec(f), b = G.MOBS[s.base];
    if (!b) continue;
    /* `art` MUST be spelled out. A monster defined in shared.js carries no art field at all - the page falls back to
       `MOBS[t]?.art || t`, i.e. the monster's own key names its sprite - so a tower row keyed tw7 would have gone
       looking for a sprite called "tw7" and drawn nothing. Naming the base here is also what makes these reskins
       rather than new art. */
    /* A FIFTH OF THE BASE MONSTER'S TICKETS, and only tickets. Its drops list is read for the tickets line and the
       rest is thrown away; a monster that pays none outside pays none here. Rounded up to 1 so a floor is never
       literally worthless, and the range is kept so the number still varies. */
    const tx = (b.drops || []).find(([k]) => k === "tickets")?.[1];
    const cut = (n) => Math.max(1, Math.round(n * TOWER.tixShare));
    const tixDrop = tx == null ? [] : [["tickets", Array.isArray(tx) ? [cut(tx[0]), cut(tx[1])] : cut(tx)]];
    mobs[`tw${f}`] = { name: b.name, art: b.art || s.base, size: b.size, box: b.box, lvl: s.lvl, hp: s.hp, att: s.att, def: s.def,
      max: s.max, speed: b.speed, aggro: 0, tower: true, drops: tixDrop, ...(s.boss ? { boss: true, enrage: { at: TOWER.bossEnrage, mul: 1.5,
        say: s.top ? "The House stops pretending to be a building. \"You are up a lot tonight. Let's fix that.\"" : `${b.name} stops playing with you.` } } : {}) };
  }

  /* ---------------------------------------------------------------- the room
     ONE room, rebuilt every floor. A player never sees two at once - that is what "locked in a tiny room" means -
     so thirty floors is a counter, not thirty maps, and going to a hundred later costs a constant. */
  const R = { x0: 16, y0: 9, x1: 28, y1: 17, doorX: 21 };
  const scenes = {
    tower: {
      name: "The Tower", interior: true, tower: true, floor: "wood", wallH: 34, tint: "rgba(20,4,26,.5)",
      room: [R.x0, R.y0, R.x1, R.y1], exitTo: TOWER.door, entry: { x: R.doorX, y: R.y1 },
      /* THE ROOM BORROWS THE CRYPT'S SURFACES, on purpose. Two carpet and wallpaper tiles were drawn for it and
         both failed the repeating-tile rule in opposite directions — the first put big stars in a tile that has to
         sit eight across a room, the second came back a flat colour with no grain at all. The Crypt's flagstones
         and wall faces are a derelict interior already, they are known good at every zoom, and `tint` above is what
         makes this room read as its own place rather than a second crypt. The one asset the Tower actually needed
         is the Tower itself, which is what the effort went into. Give it its own surfaces later if it earns them. */
      floorArt: "t_crypt", wallArt: "t_cryptwall",
      art: ["t_crypt", "t_cryptwall", "o_cryptexit", "o_cryptrubble",
        ...new Set([...TOWER.bands.map(([, k]) => k), ...Object.values(TOWER.bosses)].map((k) => G.MOBS[k]?.art || k).filter(Boolean))],
      build() {
        const g = room(R.x0, R.y0, R.x1, R.y1, R.doorX), objs = [];
        /* THE STAIRS UP, in the back wall, and `open: true` means NOT YET - the Crypt's hoard uses the same flag the
           same way. Worth being exact about what the page does with it, because the name reads backwards: the art
           resolver's first line is `if (ob.open) return null`, so an "open" object draws NOTHING AT ALL. It does not
           draw a shut door. That gives exactly the wanted behaviour here by accident of the convention - while the
           floor is live there is no stairway in the room, and clearing it makes one appear - but do not write code
           expecting a shut sprite to exist. The tile stays blocked either way: the stairway is never something you
           stand on, only something you click. */
        objs.push({ t: "towerup", art: "o_cryptexit", x: R.doorX, y: R.y0, w: 2, h: 1, open: true, name: "Stairs up: once this floor is clear" });
        block(g, R.doorX, R.y0, 2, 1);
        /* A little dressing, away from the door, the stairs and the middle where the fight happens. */
        for (const [x, y] of [[R.x0, R.y0], [R.x1, R.y0], [R.x0, R.y1], [R.x1, R.y1]]) { objs.push({ t: "towerrubble", art: "o_cryptrubble", x, y, name: "Rubble", soft: true, flat: true }); }
        return { g, objs, blobs: [] };
      },
      mobs: [], npcs: [], bots: []   // the game server puts the floor's own monster in when it makes your copy
    }
  };

  /** Where the floor's monster stands: the middle of the room, away from both doors. */
  const spawn = { x: R.doorX, y: Math.round((R.y0 + R.y1) / 2) };

  return { TOWER, scenes, mobs, floorSpec, levelOn, isBoss, baseOn, checkpointAt, climberAt, spawn, ROOM: R };
}

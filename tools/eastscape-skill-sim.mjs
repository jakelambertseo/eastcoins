/* EastScape: an hour of every skill, and what it takes to get to 99.
   Monte Carlo on the game's OWN rules, with the server's timings copied from eastscape-worker/src/index.js.

     node tools/eastscape-skill-sim.mjs [hours-per-row=120]

   WHAT IS MODELLED, and where each number came from (worker line numbers as of VERSION 191):

     mining       a swing every 1.8 s, success min(0.9, 0.4 + 0.02 x level), xp = the node's own (1790); a rock
                  gives ONE ore then is empty, so a miner hops (HOP) between a cluster's rocks
     woodcutting  a swing every 2.0 s, success min(0.9, 0.35 + 0.02 x level), xp = the node's own (1902); a tree
                  falls 1 time in 5 and is gone 15 s, so you move on
     fishing      a cast every FISHING.ms, FISHING.chance(level); from Fishing 10 a plain pool gives trout 35% of
                  the time, which pays xp2 instead of xp (1944)
     cooking      one item every recipe.ms, burnChance(recipe, level, range) wastes the input and pays nothing (1878)
     smithing     smelt then smith, each at its recipe's own ms; a recipe may also flat-out fail
     agility      The Run: AGIL_XP.gate an obstacle, .perfect for a clean one, .finish a lap (1575/1584/1740)
     melee + hp   swings against the monster's hp and defence, xpForDamage splitting the damage (1120); WALK to
                  the next one, and a monster is back 15 s after it dies
     farming      NOT an hourly rate and not simulated as one: a plot grows in real time whether you are logged in
                  or not, so its xp is a function of plots and crop length, and it is reported that way

   WHAT IS NOT: levelling during the hour (each row is a fixed level), other players on the same rocks, dying,
   food costs, the daily jobs and the wheel, and anything won or lost at the tables. Gathering rows count tickets
   at what the Cashier pays; cooking and smithing consume inputs, so their ticket column is the value ADDED. */
import * as G from "../v3/assets/js/eastscape-shared.js";

const HOURS = Math.max(20, Number(process.argv[2]) || 120), HOUR = 3600;
const HOP = 0.9, WALK = 3, RECLICK = 2.0;   /* what it costs to notice a rock is out and click the next one */
const rnd = Math.random;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const n0 = (x) => Math.round(x).toLocaleString();

/* ---------------------------------------------------------------- the open world's nodes */
const NODES = { mining: [], woodcutting: [], fishing: [] };
const TREES = new Set(["tree", "oak", "yew", "cypress", "willow", "skyash", "deadtree", "rustpine", "bogwood"]);
/* ONLY SCENES WITH A LEVEL BAND. bandOf returns null for the Vault, and treating that as "band 1" had a level-1
   woodcutter chopping the Vault's 200-xp trees, which is not a thing a level-1 player can do: it is party
   content reached another way, and its nodes are behind that rather than behind a number. A scene the solo
   grinder cannot walk into does not belong in a solo grind table. */
for (const key of G.OPEN) {
  const sc = G.SCENES[key]; if (!sc?.build) continue;
  const b = G.bandOf(key); if (!b) continue;
  let built; try { built = sc.build(); } catch { continue; }
  const band = b[0];
  for (const o of built.objs || []) {
    const need = o.req?.lvl || 1;
    if (o.t === "rock" || o.t === "vein") NODES.mining.push({ key, band, need, xp: o.xp || (o.ore === "tin" ? 18 : 17), k: o.ore });
    else if (TREES.has(o.t)) NODES.woodcutting.push({ key, band, need, xp: o.xp || 25, k: o.log || "logs" });
    else if (o.t === "spot") NODES.fishing.push({ key, band, need, xp: o.xp || 20, xp2: o.xp2, fish: o.fish || "sardine", fish2: o.fish2, fish2lvl: o.fish2lvl || 0 });
  }
}
/** The best node this level can legally reach: its own requirement AND the scene's band. */
const bestNode = (skill, lvl) => NODES[skill].filter((n) => n.need <= lvl && n.band <= lvl).sort((a, b) => b.xp - a.xp)[0];

/* ---------------------------------------------------------------- an hour of each */
function gather(skill, lvl) {
  const node = bestNode(skill, lvl); if (!node) return null;
  const ms = skill === "fishing" ? G.FISHING.ms / 1000 : skill === "mining" ? 1.8 : 2.0;
  const p = skill === "fishing" ? G.FISHING.chance(lvl) : skill === "mining" ? Math.min(0.9, 0.4 + lvl * 0.02) : Math.min(0.9, 0.35 + lvl * 0.02);
  const runs = [];
  for (let h = 0; h < HOURS; h++) {
    let t = 0, xp = 0, tix = 0, left = G.ORE_IN_ROCK[0] + Math.floor(rnd() * (G.ORE_IN_ROCK[1] - G.ORE_IN_ROCK[0] + 1));
    while (t < HOUR) {
      t += ms;
      if (rnd() >= p) continue;
      if (skill === "fishing") {
        const trout = lvl >= G.FISHING.troutAt && node.fish2 && lvl >= node.fish2lvl && rnd() < G.FISHING.troutShare;
        xp += trout ? (node.xp2 || node.xp) : node.xp;
        tix += G.valueOf(trout ? node.fish2 : node.fish);
      } else {
        xp += node.xp; tix += G.valueOf(node.k);
        /* (2026-09-23) MINING MODELS THE ROCK RUNNING OUT, which it did not before — so a change to ORE_IN_ROCK
           moved nothing in this table and the tool could not answer the question it was being asked. A rock holds
           rint(ORE_IN_ROCK) ORE (not swings: a failed swing costs time, not depth), and running it dry clears your
           action, so you lose the time it takes to notice and click another one. RECLICK is that cost and it is a
           person's reaction, not a number from the rules — the honest soft spot in this row. */
        if (skill === "mining") {
          if (--left <= 0) { left = G.ORE_IN_ROCK[0] + Math.floor(rnd() * (G.ORE_IN_ROCK[1] - G.ORE_IN_ROCK[0] + 1)); t += RECLICK; }
          else t += HOP;
        } else t += rnd() < 0.2 ? HOP + 15 : 0;
      }
    }
    runs.push([xp, tix]);
  }
  return { xp: avg(runs.map((r) => r[0])), tix: avg(runs.map((r) => r[1])), what: `${node.k || node.fish} in ${G.SCENES[node.key].name}` };
}

function station(skill, lvl) {
  const rs = Object.values(G.RECIPES).filter((r) => r.skill === skill && r.lvl <= lvl);
  if (!rs.length) return null;
  const best = rs.sort((a, b) => (b.xp / (b.ms || 2000)) - (a.xp / (a.ms || 2000)))[0];
  const secs = (best.ms || 2000) / 1000;
  const inVal = (best.in || []).reduce((a, [k, n]) => a + (G.valueOf(k) || 0) * n, 0);
  const outVal = (G.valueOf(best.out[0]) || 0) * (best.out[1] || 1);
  const runs = [];
  for (let h = 0; h < HOURS; h++) {
    let t = 0, xp = 0, made = 0, lost = 0;
    while (t < HOUR) {
      t += secs;
      if (best.fail && rnd() < best.fail) { lost++; continue; }
      const burn = best.burnStop != null ? G.burnChance(best, lvl, false) : 0;
      if (burn && rnd() < burn) { lost++; continue; }
      xp += best.xp; made++;
    }
    runs.push([xp, made * (outVal - inVal) - lost * inVal]);
    /* per HOUR is a fantasy here (it assumes a bottomless bag of inputs), so what gets reported is the value
       one item ADDS over its ingredients. That is the number that answers "is smithing this worth it", and it
       does not pretend you can do it 1,400 times an hour. */
  }
  /* INPUTS ARE ASSUMED ON HAND, so this is a CEILING and not a rate: nobody smiths an Eclipse cuirass every 2.6
     seconds, they spend most of the hour mining the ore for it. Read the cooking and smithing rows as "what the
     station itself can do while you feed it", and the gathering rows above as what feeding it costs. */
  return { xp: avg(runs.map((r) => r[0])), tix: null, added: outVal - inVal, what: `${G.ITEMS[best.out[0]]?.name || best.out[0]}` };
}

/* THIEVING. A mark is a node, so this is the gather() loop with the guild's own roll: one attempt every
   THIEF.ms, pickChance against the mark's level, and the two costs that are not in the rules file - the hop to
   the next mark after a lift (a mark closes up for 6s, so you rotate rather than stand still) and the stun when
   you are caught. Both are the honest soft spots in this row, same as RECLICK is in mining's. */
function thieving(lvl) {
  /* (2026-09-25) EVERY MARK, AND CHOSEN BY xp PER SECOND. This read G.GUILD_ORDER, which is one headline mark a
     ROOM - so the four in-between marks added today were invisible to it and every thieving figure it printed was
     measured off the old ladder. It also picked the highest xp a thief could legally attempt, which is not the
     same as the best one: a harder mark lands less often AND pays a stun on every miss, so past a point the
     bigger number is the worse choice. Expected xp per second settles it honestly. */
  const c0 = { xp: { thieving: G.XP_AT[lvl] } };
  const stun0 = (G.THIEF.stun[0] + G.THIEF.stun[1]) / 2000, secs0 = G.THIEF.ms / 1000;
  const rate = (m) => { const p = G.pickChance(c0, m.lvl); return (m.xp * p) / (secs0 + (1 - p) * stun0 + p * HOP); };
  const key = Object.keys(G.MARKS).filter((k) => G.MARKS[k].lvl <= lvl).sort((a, b) => rate(G.MARKS[b]) - rate(G.MARKS[a]))[0];
  const room = key && G.MARKS[key];
  if (!room) return null;
  const c = { xp: { thieving: G.XP_AT[lvl] } }, p = G.pickChance(c, room.lvl), secs = G.THIEF.ms / 1000;
  const stun = (G.THIEF.stun[0] + G.THIEF.stun[1]) / 2000;
  const runs = [];
  for (let h = 0; h < HOURS; h++) {
    let t = 0, xp = 0, tix = 0;
    while (t < HOUR) {
      t += secs;
      if (rnd() < p) { xp += room.xp; tix += G.SHOP.buys[G.markDrop(key)] || 0; t += HOP; }
      else t += stun;
    }
    runs.push([xp, tix]);
  }
  return { xp: avg(runs.map((r) => r[0])), tix: avg(runs.map((r) => r[1])), what: `${room.name}s in the Thieves' Guild` };
}

function agility(lvl) {
  /* a lap is the course's obstacles; a clean one pays `perfect` on top. Timing is the player's, so this is the
     honest unknown in the whole file: LAP is how long a lap takes somebody who knows the route. */
  const LAP = 42, GATES = 6, clean = Math.min(0.85, 0.35 + lvl * 0.01);
  const perLap = G.AGIL_XP.gate * GATES + G.AGIL_XP.finish + G.AGIL_XP.perfect * GATES * clean;
  return { xp: (HOUR / LAP) * perLap, tix: (HOUR / LAP) * 2 * (G.VALUE.agilmark || 0), what: `${(HOUR / LAP).toFixed(0)} laps of The Run` };
}

function combat(lvl) {
  const c = G.freshChar(); c.xp.melee = G.XP_AT[lvl]; c.xp.hp = G.XP_AT[Math.max(10, lvl)];
  const tier = [...G.TIERS].reverse().find((x) => x.gate <= lvl);
  if (tier) { for (const s of ["helm", "body", "legs", "shield", "boots", "gloves"]) if (G.ITEMS[`${tier.key}_${s}`]) c.eq[s] = `${tier.key}_${s}`; c.eq.weapon = `${tier.key}_sword`; }

  /* which monsters this level may fight: the scene's band is the gate, same as the nodes above. */
  const where = {};
  for (const [key, sc] of Object.entries(G.SCENES)) for (const m of sc.mobs || []) if (!where[m[0]]) where[m[0]] = key;
  const swing = G.SWING_MS / 1000, max = G.maxHitOf(c);
  const pool = Object.keys(G.BOUNTY).filter((t) => { const b = G.bandOf(where[t]); return G.MOBS[t] && b && b[0] <= lvl; });
  if (!pool.length) return null;

  /* pick by XP AN HOUR, not by bounty: this is a skill table. A rough pass first (damage per swing against the
     monster's hp), then the winner is the one actually simulated. Sorting by bounty/hp picked chickens at every
     level, because a chicken is cheap to kill rather than worth killing. */
  const rate = (t) => { const M = G.MOBS[t], hit = G.hitChance(G.attackRollOf(c), M.def), dps = hit * (max / 2 + 0.5) / swing;
    const kill = M.hp / Math.max(0.01, dps) + WALK; return (M.hp * 4) / kill; };
  const best = pool.sort((a, b) => rate(b) - rate(a))[0], M = G.MOBS[best];

  const runs = [];
  for (let h = 0; h < HOURS; h++) {
    let t = 0, xp = 0, tix = 0;
    while (t < HOUR) {
      let hp = M.hp;
      while (hp > 0 && t < HOUR) {
        t += swing;
        if (rnd() < G.hitChance(G.attackRollOf(c), M.def)) { const dmg = Math.min(hp, 1 + Math.floor(rnd() * max)); hp -= dmg; for (const [, x] of G.xpForDamage(c, dmg)) xp += x; }
      }
      if (hp <= 0) { tix += G.BOUNTY[best]; t += WALK; }
    }
    runs.push([xp, tix]);
  }
  return { xp: avg(runs.map((r) => r[0])), tix: avg(runs.map((r) => r[1])), what: `${M.name}s in ${G.SCENES[where[best]].name}` };
}

/* ---------------------------------------------------------------- the report */
const LEVELS = [1, 20, 40, 60, 80];
const to99 = (xpHr, lvl) => (xpHr > 0 ? (G.XP_AT[99] - G.XP_AT[lvl]) / xpHr : Infinity);

console.log(`EastScape skill grind — ${HOURS} simulated hours a row, rules v${G.VERSION}. Tickets are post-TIX_RATE.\n`);
const rows = [];
for (const [skill, fn] of [["mining", (l) => gather("mining", l)], ["woodcutting", (l) => gather("woodcutting", l)],
  ["fishing", (l) => gather("fishing", l)], ["cooking", (l) => station("cooking", l)], ["smithing", (l) => station("smithing", l)],
  ["agility", agility], ["thieving", thieving], ["melee", combat]]) {
  for (const lvl of LEVELS) {
    const r = fn(lvl); if (!r) continue;
    rows.push({ skill: G.SKILLS[skill]?.name || skill, lvl, "xp/hr": n0(r.xp), "tickets/hr": r.tix === null ? `+${n0(r.added)} an item` : n0(r.tix), "hrs to 99": to99(r.xp, lvl) > 9e3 ? "—" : Math.round(to99(r.xp, lvl)), best: r.what });
  }
}
console.table(rows);

/* ---------------------------------------------------------------- what it ACTUALLY takes to reach 99

   The table's "hrs to 99" is per ROW, and a row is one fixed level: it asks "at this rate, how long is the rest
   of the climb", which for level 1 means grinding copper for eleven hundred hours. Nobody does that. The real
   answer is an INTEGRAL — you climb, the rate climbs with you, and most of the hours are spent at the levels you
   pass through rather than at either end.

   So: measure the rate at every STEP levels, treat it as the rate for that band, and add up the hours each band
   costs. It reads low if anything, because a band is priced at the rate you have when you ENTER it. */
const STEP = 5;
const climb = (fn) => {
  let hours = 0, hadRate = false;
  for (let l = 1; l < 99; l += STEP) {
    const r = fn(l), top = Math.min(99, l + STEP);
    const need = G.XP_AT[top] - G.XP_AT[l];
    if (!r || !r.xp) { if (hadRate) return null; continue; }   /* cannot start yet; a gap AFTER starting is a wall */
    hadRate = true; hours += need / r.xp;
  }
  return hours;
};
console.log("\nHOURS FROM 1 TO 99, climbing — the rate is re-measured every " + STEP + " levels and each band is");
console.log("priced at the rate you have when you enter it, so these read a touch pessimistic rather than rosy.");
/* A STATION IS ONLY AS FAST AS WHAT FEEDS IT. Smithing reading 14 hours is true and useless: it is the rate of
   the anvil with somebody else's ore in the bag. In an hour split between the rock and the anvil, the two have to
   balance — gather G an hour, consume C an hour, and you spend G/(G+C) of the hour at the station. That is the
   number a player lives. Inputs the world does not yield (a bar you smelted, say) are followed back to what does. */
const gatherRate = (k, lvl, depth = 0) => {
  if (depth > 3) return 0;
  for (const skill of ["mining", "woodcutting", "fishing"]) {
    const node = NODES[skill].filter((n) => n.need <= lvl && n.band <= lvl && (n.k === k || n.fish === k || n.fish2 === k)).sort((a, b) => b.xp - a.xp)[0];
    if (!node) continue;
    const ms = skill === "fishing" ? G.FISHING.ms / 1000 : skill === "mining" ? 1.8 : 2.0;
    const p = skill === "fishing" ? G.FISHING.chance(lvl) : skill === "mining" ? Math.min(0.9, 0.4 + lvl * 0.02) : Math.min(0.9, 0.35 + lvl * 0.02);
    const overhead = skill === "mining" ? HOP : 0.2 * (HOP + 15);   /* rough: the same costs the gather() loop pays */
    return HOUR / (ms / p + overhead);
  }
  /* (2026-09-23) FOUND IN THE WORLD, OR NOTHING. This used to fall back to "well, there is a recipe for it", which
     made it answer for charcoal and for bars — and chain() reads a positive rate here as "you picked this up", so
     it charged the time and credited NONE of the smithing xp the smelting pays. Every step of smithing a cuirass
     is smithing xp; crediting only the last one priced the skill at a thousand hours. Following a recipe back is
     chain()'s job, and it has to be the only one doing it. */
  return 0;
};
/* (2026-09-23) THE RECIPE HAS TO BE ONE YOU CAN SUPPLY, and insisting on that is how this turned up something:
   station() picks by xp-per-second and does not care where the inputs come from, so at level 1 it picks Charcoal —
   whose input is VOIDLOGS, a level-60 tree in The Vault. And the top two armour tiers are smelted from Starfall and
   Eclipse ore, which exist ONLY in The Vault and have no level band at all, so no amount of solo levelling reaches
   them. Feeding yourself, the best you can supply tops out at Dragonstone. That is a real shape of the game, not a
   flaw in the tool, so the fed column says it by refusing to price a chain it cannot reach. */
/* A CHAIN PAYS ALL THE WAY DOWN. Smithing a Dragonstone cuirass is 400 xp, but getting there smelted five bars
   at 60 apiece and burned the charcoal for them, and every one of those is smithing xp as well. Crediting only
   the last step priced the skill at a thousand hours; counting the chain puts it where it belongs. So each input
   is costed as {hours, xp}, the xp counting only steps in the SAME skill, and the cheapest chain wins on hours.

   Inputs the open world does not yield are refused rather than guessed at, which is how the Vault shows up here:
   Starfall and Eclipse ore have no level band, so above Dragonstone there is nothing a solo player can supply. */
const chain = (k, lvl, skill, depth = 0) => {
  if (depth > 3) return null;
  const g = gatherRate(k, lvl);
  if (g > 0) return { h: 1 / g, xp: 0 };            /* found in the world: costs time, pays no xp in THIS skill */
  let best = null;
  for (const r of Object.values(G.RECIPES)) {
    if (r.out[0] !== k || r.lvl > lvl) continue;
    let h = ((r.ms || 2000) / 1000) / HOUR, xp = r.skill === skill ? r.xp : 0, ok = true;
    for (const [ik, n] of r.in || []) { const c = chain(ik, lvl, skill, depth + 1); if (!c) { ok = false; break; } h += n * c.h; xp += n * c.xp; }
    if (!ok) continue;
    const out = r.out[1] || 1;
    if (best == null || h / out < best.h) best = { h: h / out, xp: xp / out };
  }
  return best;
};
/** The xp an hour a player who supplies themselves actually gets, as a fraction of the anvil-only ceiling. */
const fedFactor = (skill, lvl) => {
  let best = 0;
  for (const r of Object.values(G.RECIPES)) {
    if (r.skill !== skill || r.lvl > lvl) continue;
    let h = ((r.ms || 2000) / 1000) / HOUR, xp = r.xp, ok = true;
    for (const [k, n] of r.in || []) { const c = chain(k, lvl, skill); if (!c) { ok = false; break; } h += n * c.h; xp += n * c.xp; }
    if (!ok || h <= 0) continue;
    best = Math.max(best, xp / h);                   /* xp an hour, gathering included */
  }
  if (!best) return null;
  const bare = Object.values(G.RECIPES).filter((r) => r.skill === skill && r.lvl <= lvl).sort((a, b) => (b.xp / (b.ms || 2000)) - (a.xp / (a.ms || 2000)))[0];
  return best / ((HOUR / ((bare.ms || 2000) / 1000)) * bare.xp);
};

const cRows = [];
for (const [name, fn] of [["Mining", (l) => gather("mining", l)], ["Woodcutting", (l) => gather("woodcutting", l)],
  ["Fishing", (l) => gather("fishing", l)], ["Cooking", (l) => station("cooking", l)], ["Smithing", (l) => station("smithing", l)],
  ["Agility", agility], ["Thieving", thieving], ["Combat", combat]]) {
  const h = climb(fn);
  const st = name === "Smithing" ? "smithing" : name === "Cooking" ? "cooking" : null;
  const fed = st ? climb((l) => { const f = fedFactor(st, l), r = fn(l); return f == null || !r ? null : { ...r, xp: r.xp * f }; }) : h;
  cRows.push({ skill: name, "hours 1 -> 99": h == null ? "—" : Math.round(h), "feeding it yourself": fed == null ? "—" : Math.round(fed),
    "days at 3 h a day": fed == null ? "—" : Math.round(fed / 3), note: st ? "the bare figure is the anvil's ceiling, not a player's hour" : "" });
}
console.table(cRows.sort((a, b) => (a["feeding it yourself"] || 0) - (b["feeding it yourself"] || 0)));

/* farming is the odd one out and saying so is the point */
const plots = [8, 12, 20];
console.log("\nHARVESTING is not an hourly grind: a plot grows whether you are logged in or not.");
console.log("  What a full replant is worth, by island and crop (xp per cycle, and how long the cycle is):");
const fRows = [];
for (const [k, c] of Object.entries(G.CROPS)) for (const p of plots)
  fRows.push({ crop: G.ITEMS[k].name, "Harvesting lvl": c.lvl, plots: p, "cycle": `${Math.round(c.ms / 60000)} min`, "xp a cycle": n0(c.xp * p), "xp a day if you never miss one": n0(c.xp * p * (1440 / (c.ms / 60000))) });
console.table(fRows.filter((r) => r.plots === 20 || r.plots === 8));
console.log("HITPOINTS is not trained on its own: xpForDamage splits every hit, so it rides whatever combat you do.");

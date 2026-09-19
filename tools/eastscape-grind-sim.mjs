// GambaScape: what an hour of grinding is worth, in Cash and in ZCoins. Monte Carlo on the game's OWN rules file
// (values, bounties, finds, recipes, hit chances), with the server's timings copied in below.
//   node tools/eastscape-grind-sim.mjs [hours-per-scenario=200]
//
// What is modelled, from eastscape-worker/src/index.js:
//   mining   a swing every 1.8 s, success min(0.9, 0.4 + 0.02 x level); a rock gives ONE ore then is empty 8 s, so a miner
//            hops between the 5-10 rocks of a cluster (HOP seconds a hop)
//   chopping a swing every 2.0 s, success min(0.9, 0.35 + 0.02 x level); a tree falls 1 time in 5 (15 s), then a hop
//   fishing  a cast every 2.6 s, 45% (30% at a named pool), never runs dry; from Fishing 10 a plain pool gives trout 35%
//   fighting simulated swings (SWING_MS) against the monster's hp/def, the monster hitting back; WALK seconds to the
//            next one; a monster is back 15 s after it dies, so a lone boss is waited for; food is bought back at the
//            cheapest cooked price per hp, less what 20 s regen ticks cover while walking
//   crafting mine, walk to the Forum (TRIP seconds each way, once a bag of 16 free slots x 99 is NOT the limit: the
//            limit is patience, so a run is RUN_ORES ores), smelt 2.4 s a bar, smith 2.6 s a piece
// What is NOT: levelling up during the hour, other players on the same rocks (slower) or the same monster (faster
// respawn), dying, the daily jobs and the free wheel (listed once at the end), and anything won or lost at the tables.
import * as G from "../v3/assets/js/eastscape-shared.js";

const HOURS = Math.max(20, Number(process.argv[2]) || 200), HOUR = 3600;
const HOP = 0.9, WALK = 3, TRIP = 6, RUN_ORES = 60;   // TRIP: rocks to the camp and back is a few steps since 2026-09-20 (it was 38 s each way to the Forum)
const rnd = Math.random, rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const stat = (xs) => { const s = [...xs].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length), p10: Math.round(q(0.1)), p90: Math.round(q(0.9)), best: Math.round(s[s.length - 1]) }; };

function mine(level, ore) { const p = Math.min(0.9, 0.4 + level * 0.02), v = G.valueOf(ore); let t = 0, cash = 0; while (t < HOUR) { t += 1.8; if (rnd() < p) { cash += v; t += HOP; } } return cash; }
function chop(level, log) { const p = Math.min(0.9, 0.35 + level * 0.02), v = G.valueOf(log); let t = 0, cash = 0; while (t < HOUR) { t += 2; if (rnd() < p) { cash += v; if (rnd() < 0.2) t += HOP; } } return cash; }
function fish(level, named) { let t = 0, cash = 0; while (t < HOUR) { t += 2.6; if (rnd() < (named ? 0.3 : 0.45)) cash += G.valueOf(named || (level >= 10 && rnd() < 0.35 ? "trout" : "sardine")); } return cash; }

const fighter = (level) => { const c = G.freshChar(); c.xp.melee = G.XP_AT[level]; c.xp.hp = Math.max(c.xp.hp, G.XP_AT[Math.max(10, level)]); const t = [...G.TIERS].reverse().find((x) => x.gate <= level);
  if (t) { for (const s of ["helm", "body", "legs", "shield", "boots", "gloves"]) if (G.ITEMS[`${t.key}_${s}`]) c.eq[s] = `${t.key}_${s}`; c.eq.weapon = `${t.key}_sword`; } return c; };
const FOOD = Math.min(...Object.entries(G.ITEMS).filter(([k, it]) => it.heal && !it.meal && G.valueOf(k)).map(([k, it]) => G.valueOf(k) / it.heal));   // $ per hp, cheapest cooked food
function dropsOf(mob) { let cash = 0; for (const [k, n, p] of G.MOBS[mob].drops) { if (p != null && rnd() >= p) continue; const q = Array.isArray(n) ? rint(n[0], n[1]) : n; cash += (k === "coins" ? 1 : G.ITEMS[k]?.slot ? 0 : G.valueOf(k)) * q; }
  const rare = G.rollRare(mob, rnd()); if (rare && !G.ITEMS[rare].slot) cash += G.valueOf(rare); return cash; }   // (gear drops and the click-to-use finds are left at $0: they're kept, not sold)
function fight(level, mobs) {   // mobs: [[type, how many there are in the scene]]
  const c = fighter(level), def = G.defenceRollOf(c), back = mobs.flatMap(([t, n]) => Array.from({ length: n }, () => ({ t, at: 0 })));
  let t = 0, cash = 0, hurt = 0, kills = 0;
  while (t < HOUR) {
    const m = back.filter((x) => x.at <= t).sort((a, b) => G.BOUNTY[b.t] - G.BOUNTY[a.t])[0];
    if (!m) { t = Math.min(...back.map((x) => x.at)); continue; }
    const M = G.MOBS[m.t]; let hp = M.hp, clock = 0, next = M.speed / 1000;
    while (hp > 0) { clock += G.SWING_MS / 1000; if (rnd() < G.hitChance(G.attackRollOf(c), M.def)) hp -= rint(1, G.maxHitOf(c)); while (next <= clock && hp > 0) { if (rnd() < G.hitChance(M.att, def)) hurt += rint(1, M.max); next += M.speed / 1000; } }
    t += clock + WALK; hurt = Math.max(0, hurt - WALK / 20); m.at = t + G.RESPAWN.base / 1000; cash += dropsOf(m.t); kills++;
  }
  return { cash, food: hurt * FOOD, kills };
}
function craft(level, ore, make) {   // mine RUN_ORES, walk to the Forum, smelt (and smith), sell to Brutus, walk back
  const p = Math.min(0.9, 0.4 + level * 0.02), smeltIn = G.RECIPES[`smelt_${make.tier}`].in.reduce((a, [, n]) => a + n, 0), bars = Math.floor(RUN_ORES / smeltIn), perPiece = make.bars || 0;
  const pieces = perPiece ? Math.floor(bars / perPiece) : 0, value = perPiece ? pieces * G.valueOf(make.k) + (bars - pieces * perPiece) * G.valueOf(`${make.tier}_bar`) : bars * G.valueOf(`${make.tier}_bar`);
  let t = 0, cash = 0; while (t < HOUR) { let got = 0, run = 0; while (got < RUN_ORES) { run += 1.8; if (rnd() < p) { got++; run += HOP; } } run += TRIP * 2 + bars * 2.4 + pieces * 2.6; if (t + run > HOUR) { cash += value * (HOUR - t) / run; break; } t += run; cash += value; } return cash;
}

const rows = [];
const add = (who, job, fn) => { const cash = [], extra = []; for (let i = 0; i < HOURS; i++) { const r = fn(); if (typeof r === "number") cash.push(r); else { cash.push(r.cash - r.food); extra.push(r); } }
  const s = stat(cash), D = G.DEX; rows.push({ who, job, "Cash/hr": s.avg, "slow hr (p10)": s.p10, "good hr (p90)": s.p90, "best hr seen": s.best, "ZC at $100 (uncapped)": +(s.avg / D.rate).toFixed(1), "ZC/hr you can take": Math.min(D.capHour, Math.floor(s.avg / D.rate)), "minutes to fill the 25": s.avg ? Math.round(D.capHour * D.rate / s.avg * 60) : "-", ...(extra.length ? { "kills/hr": Math.round(extra.reduce((a, r) => a + r.kills, 0) / extra.length), "food $/hr": Math.round(extra.reduce((a, r) => a + r.food, 0) / extra.length) } : {}) }); };

add("new (lvl 1)", "mine copper/tin", () => mine(1, "copper")); add("new (lvl 1)", "chop trees", () => chop(1, "logs")); add("new (lvl 1)", "fish sardines", () => fish(1)); add("new (lvl 1)", "fight chickens + cows", () => fight(1, [["chicken", 6], ["cow", 5]]));
add("new (lvl 10)", "mine + smelt bronze bars", () => craft(10, "copper", { tier: "bronze" })); add("new (lvl 10)", "mine + smelt + smith swords", () => craft(10, "copper", { tier: "bronze", k: "bronze_sword", bars: 2 }));
add("regular (lvl 15)", "mine emerald", () => mine(15, "emerald_ore")); add("regular (lvl 15)", "chop gloomwillow", () => chop(15, "willowlogs")); add("regular (lvl 15)", "fish (trout mix)", () => fish(15)); add("regular (lvl 12)", "fight the Yard (boars, hornworms, cows)", () => fight(12, [["boar", 3], ["hornworm", 2], ["cow", 4]]));
add("grinder (lvl 25)", "mine diamond", () => mine(25, "diamond_ore")); add("grinder (lvl 28)", "fight the Gloam", () => fight(28, [["taxwraith", 3], ["moth", 4], ["gnasher", 3], ["highwayman", 4]]));
add("grinder (lvl 30)", "mine dragonstone", () => mine(30, "dragonstone_ore")); add("grinder (lvl 30)", "fish sky eels", () => fish(30, "skyeel")); add("grinder (lvl 30)", "mine + smelt diamond bars", () => craft(30, "diamond_ore", { tier: "diamond" }));
add("no-lifer (lvl 40)", "mine onyx", () => mine(40, "onyx_ore")); add("no-lifer (lvl 42)", "fight Cloudreach", () => fight(42, [["understudy", 1], ["chandelier", 1], ["ghoul", 3], ["ram", 3]]));
console.log(`GambaScape grind simulation: ${HOURS} simulated hours per row, rules v${G.VERSION}. $${G.DEX.rate} = 1 ZC, ${G.DEX.capHour} ZC an hour.\n`);
console.table(rows);

// the free money everyone gets, once a day
const P = G.PRIZE, tw = P.slices.reduce((a, s) => a + s.w, 0), wheel = P.slices.reduce((a, s) => a + (s.cash || G.valueOf(s.k) * (s.n || 1)) * s.w, 0) / tw;
const daily = G.DAILY.filter((d) => G.OPEN_DAILY.has(d.id)), dAvg = daily.reduce((a, d) => a + d.cash, 0) / daily.length;
console.log(`\nOnce a day, on top: the free wheel ~${G.fmtCash(Math.round(wheel))} (up to +70% with a streak), and three paid jobs ~${G.fmtCash(Math.round(dAvg * G.DAILY_COUNT))} together (${G.fmtCash(Math.min(...daily.map((d) => d.cash)) * 3)}-${G.fmtCash(Math.max(...daily.map((d) => d.cash)) * 3)} by level).`);
console.log(`At the tables Cash only goes DOWN on average: about 3% of everything bet (0.5% while lucky), so an hour of $100 bets every few seconds costs a grinder roughly what 10-20 minutes of mining made.`);

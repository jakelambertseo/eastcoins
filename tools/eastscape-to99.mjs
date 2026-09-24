/* EastScape: how long 99 takes —  node tools/eastscape-to99.mjs
   Combat, Hitpoints, Fishing and Cooking, each played the fastest sensible way, on the game's OWN numbers (XP_AT, the hit rolls,
   SWING_MS, the mobs, FISHING, the cooking recipes and their burn rates). At every level it picks the best thing that level can
   do and asks how long the next level takes; the hours are the sum.
     COMBAT     4 xp a point of damage, so 99 is 3,258,608 damage. Swings at SWING_MS against the monster's defence with the
                gear that level wears, the monster hitting back; WALK between monsters; a monster is back RESPAWN.base after it
                dies, so a thin area makes you wait. Areas are gated by BANDS.
     HITPOINTS  4/3 xp a point of damage: EXACTLY a third of combat's, from the same swings. So it is combat's damage x3.
     FISHING    a cast every FISHING.ms, a bite at min(0.9, 0.4 + 0.02 x level), the best fish that level can reach.
     COOKING    1.8 s a go, the best fish that level can cook, burns by burnChance (a burn still takes the time and gives nothing).
   NOT counted: eating, dying, other players, the daily jobs, buffs, and that fishing and cooking level each other up. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const WALK = 3, COOK_MS = 1800, rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), hrs = (s) => s / 3600;
const fmt = (h) => (h >= 100 ? `${Math.round(h)} h` : `${h.toFixed(1)} h`), fmtN = (n) => Math.round(n).toLocaleString();

/* ---------------------------------------------------------------- who you are at a level, and what you can reach */
const fighter = (lvl) => { const c = G.freshChar(); c.xp.melee = G.XP_AT[lvl]; c.xp.hp = G.XP_AT[Math.max(10, lvl)]; const t = [...G.TIERS].reverse().find((x) => x.gate <= lvl);
  if (t) { for (const s of ["helm", "body", "legs", "shield", "boots", "gloves"]) if (G.ITEMS[`${t.key}_${s}`]) c.eq[s] = `${t.key}_${s}`; c.eq.weapon = `${t.key}_sword`; } return c; };
const open = (lvl) => Object.entries(G.BANDS).filter(([k, [lo]]) => lvl >= lo && G.OPEN.has(k)).map(([k]) => k);
/** damage a second against this monster at this level, walking between them and waiting for respawns in a scene that has `n` of it */
function dps(c, t, n) {
  const M = G.MOBS[t], hit = G.hitChance(G.attackRollOf(c), M.def), max = G.maxHitOf(c), per = hit * ((1 + max) / 2), swings = M.hp / per;
  const kill = swings * (G.SWING_MS / 1000), cycle = kill + WALK, wait = Math.max(0, G.RESPAWN.base / 1000 - (n - 1) * cycle) / n;   // (n of them: you come back round to the first one after n cycles)
  return { dmg: M.hp / (cycle + wait), kill, name: M.name, lvl: M.lvl };
}
function bestMob(lvl) {
  const c = fighter(lvl); let best = null;
  for (const key of open(lvl)) { const d = G.SCENES[key]; if (!d?.mobs) continue; const count = {}; for (const [t] of d.mobs) count[t] = (count[t] || 0) + 1;
    for (const [t, n] of Object.entries(count)) { if (!G.BOUNTY[t]) continue; const r = dps(c, t, n); if (!best || r.dmg > best.dmg) best = { ...r, t, area: d.name }; } }
  return best;
}
/* ---------------------------------------------------------------- the spots and the recipes */
const spots = []; for (const key of Object.keys(G.SCENES)) { let b; try { b = G.buildScene(key); } catch (e) { continue; }
  for (const o of b.objs) if (o.t === "spot") { const band = G.BANDS[key]?.[0] || 1; if (o.fish) spots.push({ k: o.fish, lvl: Math.max(o.req?.lvl || 1, band), xp: o.xp, where: G.SCENES[key].name, open: G.OPEN.has(key) }); if (o.fish2) spots.push({ k: o.fish2, lvl: Math.max(o.fish2lvl || 1, band), xp: o.xp2 || o.xp, where: G.SCENES[key].name, open: G.OPEN.has(key) }); } }
const cooks = Object.values(G.RECIPES).filter((r) => r.skill === "cooking" && G.ZDROP.fish[r.in[0][0]] != null);

/* ---------------------------------------------------------------- the walk to 99 */
function toNinetyNine(kind) {
  let secs = 0, count = 0, burnt = 0; const legs = [];
  for (let lvl = 1; lvl < 99; lvl++) {
    const need = G.XP_AT[lvl + 1] - G.XP_AT[lvl]; let per, rate, what;   // per: xp a go · rate: goes a second
    if (kind === "combat" || kind === "hp") { const m = bestMob(lvl); if (!m) continue; per = (kind === "hp" ? G.HP_XP : G.COMBAT_XP); rate = m.dmg; what = `${m.name} (${m.area})`; count += (need / (per * rate)) * rate / (G.MOBS[m.t].hp / 1); }
    else if (kind === "fishing") { const s = spots.filter((x) => x.open && x.lvl <= lvl).sort((a, b) => b.xp * G.FISHING.chance(lvl) - a.xp * G.FISHING.chance(lvl))[0]; per = s.xp; rate = G.FISHING.chance(lvl) / (G.FISHING.ms / 1000); what = `${G.ITEMS[s.k].name} (${s.where})`; count += need / per; }
    else { const r = cooks.filter((x) => x.lvl <= lvl).sort((a, b) => b.xp - a.xp)[0], burn = G.burnChance(r, lvl, false); per = r.xp * (1 - burn); rate = 1 / (COOK_MS / 1000); what = `${G.ITEMS[r.in[0][0]].name}`; const n = need / per; count += n; burnt += n * burn; }
    const t = need / (per * rate); secs += t;
    const last = legs[legs.length - 1]; if (!last || last.what !== what) legs.push({ from: lvl, what, secs: t }); else { last.secs += t; last.to = lvl; }
  }
  return { hours: hrs(secs), count, burnt, legs };
}
const rows = [["combat", "Combat"], ["hp", "Hitpoints"], ["fishing", "Fishing"], ["cooking", "Cooking"]].map(([k, name]) => ({ name, k, ...toNinetyNine(k) }));
console.log(`\n99 is ${G.XP_AT[99].toLocaleString()} xp in every skill.\n`);
console.log("SKILL        TIME TO 99   WHAT YOU DO                                          HOW MANY");
for (const r of rows) {
  const how = r.k === "fishing" ? `${fmtN(r.count)} fish caught` : r.k === "cooking" ? `${fmtN(r.count)} fish cooked (${fmtN(r.burnt)} burnt)` : `${fmtN(G.XP_AT[99] / (r.k === "hp" ? G.HP_XP : G.COMBAT_XP))} damage dealt`;
  console.log(`${r.name.padEnd(12)} ${fmt(r.hours).padStart(8)}     ${r.legs[r.legs.length - 1].what.slice(0, 50).padEnd(50)} ${how}`);
}
console.log(`\nfishing AND cooking what you catch: ${fmt(rows[2].hours + rows[3].hours)} for both (the same fish twice over: catch, then cook)`);
for (const r of rows) { console.log(`\n${r.name}: ${fmt(r.hours)}`); for (const l of r.legs) console.log(`   ${String(l.from).padStart(2)}${l.to ? `-${l.to}` : ""}`.padEnd(8) + `${fmt(hrs(l.secs)).padStart(8)}  ${l.what}`); }

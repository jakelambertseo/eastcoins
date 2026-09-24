/* EastScape: the road, monster by monster —  node tools/eastscape-road.mjs
   For every scene on the road out (BANDS), every monster in it, met at ITS OWN level in the gear that level wears:
   how long a kill takes, how much of your life one kill costs, what it pays, tickets a minute, and how many kills to the next
   Combat level. It is the question "does each step feel like a step": pay and danger should climb, a kill should never drag,
   and no monster should be a worse deal than the one before it. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // the closed areas' maps are their own file since 2026-09-21: these tools still look at every scene
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const gearFor = (lvl) => [...G.TIERS].reverse().find((x) => x.gate <= lvl)?.key || null;
function charAt(lvl) { const c = G.freshChar(); c.xp.melee = G.XP_AT[Math.min(99, lvl)]; c.xp.hp = Math.max(c.xp.hp, G.XP_AT[Math.min(99, lvl)]); const tier = gearFor(lvl); if (tier) { for (const s of ["helm", "body", "legs", "shield", "boots", "gloves"]) if (G.ITEMS[`${tier}_${s}`]) c.eq[s] = `${tier}_${s}`; if (G.ITEMS[`${tier}_sword`]) c.eq.weapon = `${tier}_sword`; } c.hp = G.maxHpOf(c); return c; }
function fight(c, t, N = 3000) {
  const m = G.MOBS[t], mySpeed = G.swingMsOf ? G.swingMsOf(c) : 1800; let secs = 0, hurt = 0, died = 0;
  for (let i = 0; i < N; i++) { let hp = m.hp, me = G.maxHpOf(c), tMe = 0, tMob = 0, now = 0;
    while (hp > 0 && me > 0) { const next = Math.min(tMe, tMob); now = next;
      if (tMe <= tMob) { if (Math.random() < G.hitChance(G.attackRollOf(c), m.def)) hp -= rint(1, G.maxHitOf(c)); tMe += mySpeed; }
      else { const dr = G.defenceRollOf ? G.defenceRollOf(c) : 0; if (Math.random() < G.hitChance(m.att * 4 + 8, dr || 1)) me -= rint(0, m.max); tMob += m.speed; } }
    secs += now / 1000; hurt += G.maxHpOf(c) - Math.max(0, me); if (me <= 0) died++; }
  return { secs: secs / N, hurt: hurt / N / G.maxHpOf(c), died: died / N };
}
const has = Object.keys(G).filter((k) => /swing|defenceRoll|attackRoll|maxHit|hitChance|xpFor|killXp|mobXp/i.test(k)); console.log("rules used:", has.join(", "));
for (const [scene, [lo, hi]] of Object.entries(G.BANDS)) {
  const def = G.SCENES[scene], kinds = [...new Set((def.mobs || []).map((m) => m[0]))].sort((a, b) => G.MOBS[a].lvl - G.MOBS[b].lvl), rows = {};
  for (const t of kinds) { const m = G.MOBS[t], c = charAt(Math.max(lo, m.lvl)), f = fight(c, t), pay = G.mobValue(t), n = (def.mobs || []).filter((x) => x[0] === t).length;
    rows[`${m.name} (${t})`] = { lvl: m.lvl, n, hp: m.hp, maxHit: m.max, gear: gearFor(Math.max(lo, m.lvl)) || "starter", killS: +f.secs.toFixed(1), "life/kill%": Math.round(f.hurt * 100), "die%": +(f.died * 100).toFixed(1), "tix/kill": pay, "tix/min": Math.round(pay / (f.secs + 3) * 60), rare: (m.rare || []).map((r) => r[0]).join(" ") }; }
  console.log(`\n${def.name}  (Combat ${lo}-${hi})  exits ${JSON.stringify(def.exits)}`); console.table(rows);
}

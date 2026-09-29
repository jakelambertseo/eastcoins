// GAMBA balance: what a minute of each job pays at each level. Run: node tools/eastscape-balance.mjs
// Skilling: the best rock a level can mine (value x success chance per 1.8 s swing), x0.8 for walking between rocks
// and waiting on respawns. Fighting: simulated kills in the gear that level would wear, +3 s to reach the next one.
import * as G from "../v3/assets/js/eastscape-shared.js";
const FIGHT_OVER_SKILL = 1.15;
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const ORES = [[1, "copper"], [15, "emerald_ore"], [25, "diamond_ore"], [30, "dragonstone_ore"], [40, "onyx_ore"]];
export const skillPay = (lvl) => { const ore = ORES.filter(([l]) => l <= lvl).pop()[1]; return G.valueOf(ore) * Math.min(0.9, 0.4 + lvl * 0.02) / 1.8 * 60 * 0.8; };
function ttk(c, t, N = 4000) { const m = G.MOBS[t]; let total = 0; for (let i = 0; i < N; i++) { let hp = m.hp, s = 0; while (hp > 0) { s++; if (Math.random() < G.hitChance(G.attackRollOf(c), m.def)) hp -= rint(1, G.maxHitOf(c)); } total += s; } return total / N * G.SWING_MS / 1000; }
const gearFor = (lvl) => { const t = [...G.TIERS].reverse().find((x) => x.gate <= lvl); return t ? t.key : null; };
const rows = {};
for (const t of Object.keys(G.MOBS)) {
  const m = G.MOBS[t], lvl = Math.max(1, m.lvl), c = G.freshChar(); c.xp.melee = G.XP_AT[Math.min(99, lvl)]; c.xp.hp = Math.max(c.xp.hp, G.XP_AT[Math.min(99, lvl)]);
  const tier = gearFor(lvl); if (tier) { for (const s of ["helm", "body", "legs", "shield", "boots", "gloves"]) if (G.ITEMS[`${tier}_${s}`]) c.eq[s] = `${tier}_${s}`; c.eq.weapon = `${tier}_sword`; } else c.eq.weapon = "rudis";
  const k = ttk(c, t), sk = skillPay(lvl), now = G.mobValue(t);
  rows[t] = { lvl, killS: +k.toFixed(1), "skill$/min": Math.round(sk), "now$/kill": now, "now$/min": Math.round(now / (k + 3) * 60), "want$/kill": Math.round(FIGHT_OVER_SKILL * sk * (k + 3) / 60) };
}
console.table(rows);

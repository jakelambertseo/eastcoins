/* HOW OFTEN DOES A MONSTER LAND? (2026-09-28, the owner: "I still see most users getting hit for 0s across the board, even at the new higher
   level areas. what can we do to balance?")   node tools/eastscape-hitcheck.mjs
   For every monster in the open world, the share of its swings that land on a player of the monster's own level, three ways:
     model    the player attFor was tuned against: the best six-piece armour set their level allows, nothing else (MOB_HIT says 35%)
     full     that set plus the tier's weapon, amulet and ring (every worn slot)
     forged   the full kit reforged to +5 everywhere (a dedicated grinder)
   and the damage per swing that follows (a miss is a 0 on screen). Reads the real rules file, so it measures what is live. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // the later areas keep their maps in their own file
const SLOTS6 = ["helm", "body", "legs", "shield", "boots", "gloves"], ALL = [...SLOTS6, "amulet", "ring", "weapon"];
const tierAt = (lvl) => { let t = G.TIERS[0]; for (const x of G.TIERS) if (lvl >= (x.gate || 1)) t = x; return t; };
const weaponOf = (t) => ["sword", "gladius", "scimitar", "maul", "axe"].map((w) => `${t.key}_${w}`).find((k) => G.ITEMS[k]?.slot === "weapon");
function player(lvl, slots, f) {
  const c = G.freshChar(); for (const sk of Object.keys(c.xp)) c.xp[sk] = G.XP_AT[Math.min(99, lvl)] || c.xp[sk];
  const t = tierAt(lvl); c.eq = {};
  for (const sl of slots) { const k = sl === "weapon" ? weaponOf(t) : `${t.key}_${sl}`; if (G.ITEMS[k]) c.eq[sl] = k; }
  if (f) { c.eqf = {}; for (const sl of Object.keys(c.eq)) c.eqf[sl] = f; }
  return c;
}
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
const rows = [];
for (const sc of [...G.OPEN]) {
  const S = G.SCENES[sc]; if (!S?.mobs) continue;
  for (const [t] of S.mobs) { const m = G.MOBS[t]; if (!m || rows.some((r) => r.t === t)) continue;
    const lvl = Math.min(99, m.lvl), roll = (c) => G.defenceRollOf(c);
    const cm = player(lvl, SLOTS6, 0), cf = player(lvl, ALL, 0), cx = player(lvl, ALL, 5);
    const hc = m.outside && G.mobHitChance ? G.mobHitChance : G.hitChance;   /* (2026-09-28) open-world monsters aim by ratio: A MONSTER'S AIM */
    rows.push({ t, sc, lvl: m.lvl, att: m.att, max: m.max, model: hc(m.att, roll(cm)), full: hc(m.att, roll(cf)), forged: hc(m.att, roll(cx)), dm: roll(cm), df: roll(cf), dx: roll(cx) }); }
}
rows.sort((a, b) => a.lvl - b.lvl);
console.log("monster".padEnd(22), "area".padEnd(12), "lvl  att  max   def(model/full/+5)   lands: model  full   +5   avg dmg a swing (full)");
for (const r of rows) console.log(r.t.padEnd(22), r.sc.padEnd(12), String(r.lvl).padStart(3), String(r.att).padStart(4), String(r.max).padStart(4), `   ${r.dm.toFixed(0).padStart(3)}/${r.df.toFixed(0).padStart(3)}/${r.dx.toFixed(0).padStart(3)}`.padEnd(22), pct(r.model), " ", pct(r.full), " ", pct(r.forged), "    ", (r.full * (r.max + 1) / 2).toFixed(1));
const floor = rows.filter((r) => r.full <= G.HIT_FLOOR + 1e-9).length;
console.log(`\n${rows.length} monsters · on the ${pct(G.HIT_FLOOR)} floor against a fully kitted player of their level: ${floor} · against +5: ${rows.filter((r) => r.forged <= G.HIT_FLOOR + 1e-9).length}`);

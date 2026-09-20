// Nothing that attacks on sight may be able to reach a rock, a tree, a pool, a station, a sign, a fire or the main path.
// A monster wanders home +/-3 by +/-2 (the server's leash) and goes for anyone within MOBS[t].aggro (or aggroWas, while attack-on-sight is off) of where it stands.
//   node tools/eastscape-aggro-check.mjs
import * as G from "../v3/assets/js/eastscape-shared.js";
let bad = 0;
for (const key of G.OPEN) {
  const d = G.SCENES[key]; if (!d?.mobs?.length) continue; const b = d.build();
  const spots = []; for (const o of b.objs) { if (o.edge || o.soft) continue; if (["rock", "tree", "oak", "willow", "skyash", "spot", "wheat", "furnace", "anvil", "range", "fire", "sign"].includes(o.t)) for (let dx = -1; dx <= (o.w || 1); dx++) for (let dy = -1; dy <= 1; dy++) spots.push({ x: o.x + dx, y: o.y + dy, what: `${o.t} at ${o.x},${o.y}` }); }
  for (let x = 0; x < G.COLS; x++) spots.push({ x, y: 13, what: "the main path" });
  for (const n of d.npcs) spots.push({ x: n.x, y: n.y, what: n.name });
  for (const [t, hx, hy] of d.mobs) { const a = G.MOBS[t].aggro || G.MOBS[t].aggroWas;   /* aggroWas: what it reached before attack-on-sight was switched off (AGGRO_ON), so the corners stay safe for the day it comes back */ if (!a) continue; const hit = new Set();
    for (const s of spots) { const dx = Math.max(0, Math.abs(s.x - hx) - 3), dy = Math.max(0, Math.abs(s.y - hy) - 2); if (Math.max(dx, dy) <= a) hit.add(s.what); }
    if (hit.size) { bad++; console.log(`REACH  ${key}: ${t} at ${hx},${hy} (aggro ${a}) can reach ${[...hit].join("; ")}`); } }
}
console.log(bad ? `${bad} aggressive monsters can reach something they shouldn't.` : "ok: no aggressive monster can reach a resource, a station, a sign, an NPC or the path."); process.exit(bad ? 1 : 0);

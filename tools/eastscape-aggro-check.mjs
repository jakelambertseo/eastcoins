// Nothing that attacks on sight may be able to reach a rock, a tree, a pool, a station, a sign, a fire or the main path.
// A monster wanders home +/-3 by +/-2 (the server's leash) and goes for anyone within MOBS[t].aggro (or aggroWas, while attack-on-sight is off) of where it stands.
//   node tools/eastscape-aggro-check.mjs
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // the closed areas' maps are their own file since 2026-09-21: these tools still look at every scene
let bad = 0;
for (const key of G.OPEN) {
  const d = G.SCENES[key]; if (!d?.mobs?.length) continue; const b = d.build();
  const spots = []; for (const o of b.objs) { if (o.edge || o.soft) continue; if (["rock", "tree", "oak", "willow", "skyash", "spot", "wheat", "furnace", "anvil", "range", "fire", "sign"].includes(o.t)) for (let dx = -1; dx <= (o.w || 1); dx++) for (let dy = -1; dy <= 1; dy++) spots.push({ x: o.x + dx, y: o.y + dy, what: `${o.t} at ${o.x},${o.y}` }); }
  for (let x = 0; x < G.COLS; x++) spots.push({ x, y: 13, what: "the main path" });
  for (const n of d.npcs) spots.push({ x: n.x, y: n.y, what: n.name });
  /* WHERE IT CAN ACTUALLY STAND (2026-09-24). The wander box used to be plain arithmetic — home ±3 by ±2 — which
     is right on an open field and wrong the moment a map has walls in it. The Boneyard's rebuild put every
     monster inside iron railings, and this reported four of them as menacing a dragonstone rock they cannot walk
     within seven tiles of. Flooding the box over walkable ground instead is strictly more accurate: on a map with
     nothing in the way it gives the same square, and where there IS something in the way it gives the truth.
     Nothing else in the game's output moved when this went in. */
  const g = b.g, WALK = ".,isbep";
  const wander = (hx, hy) => {
    const seen = new Set([`${hx},${hy}`]), q = [[hx, hy]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (Math.abs(nx - hx) > 3 || Math.abs(ny - hy) > 2) continue;
        if (nx < 0 || ny < 0 || ny >= g.length || nx >= g[0].length || seen.has(k)) continue;
        if (!WALK.includes(g[ny][nx])) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return [...seen].map((k) => k.split(",").map(Number));
  };
  for (const [t, hx, hy] of d.mobs) { const a = G.MOBS[t].aggro || G.MOBS[t].aggroWas;   /* aggroWas: what it reached before attack-on-sight was switched off (AGGRO_ON), so the corners stay safe for the day it comes back */ if (!a) continue; const hit = new Set();
    const stand = wander(hx, hy);
    for (const s of spots) if (stand.some(([sx, sy]) => Math.max(Math.abs(s.x - sx), Math.abs(s.y - sy)) <= a)) hit.add(s.what);
    if (hit.size) { bad++; console.log(`REACH  ${key}: ${t} at ${hx},${hy} (aggro ${a}) can reach ${[...hit].join("; ")}`); } }
}
console.log(bad ? `${bad} aggressive monsters can reach something they shouldn't.` : "ok: no aggressive monster can reach a resource, a station, a sign, an NPC or the path."); process.exit(bad ? 1 : 0);

// Nothing that attacks on sight may be able to reach a rock, a tree, a pool, a station, a sign, a fire or the main path.
// A monster wanders home +/-3 by +/-2 (the server's leash) and goes for anyone within MOBS[t].aggro (or aggroWas, while attack-on-sight is off) of where it stands.
//   node tools/eastscape-aggro-check.mjs
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // the closed areas' maps are their own file since 2026-09-21: these tools still look at every scene
let bad = 0;
/* EVERY scene, not just the open ones: a map that is still shut is exactly the one nobody has walked,
   and it is cheaper to fix a corner now than on the day it opens. */
for (const key of Object.keys(G.SCENES)) {
  const d = G.SCENES[key]; if (!d?.mobs?.length) continue; const b = d.build();
  /* THE GAUNTLET EXEMPTION (2026-09-24). Two of these rules assume a map has a safe way through it: row 13 is
     "the main path" on every map built before the Carnival, and a sign is somewhere you stop and read. The
     Carnival is built the other way round on purpose — the owner asked for "about 50% of the mobs" to come for
     you, and its walkway winds instead of running along row 13, so both rules report a design as a defect.
     WHAT IS STILL ENFORCED HERE, and is what actually matters: nothing aggressive may reach a gathering spot,
     a station, or an NPC. You cannot fish while being mauled. Do not widen this list to quiet a real hit. */
  /* (2026-09-25) THE VAULT JOINS THE CARNIVAL. It has no safe corridor and never has: The Pit Boss and The Last
     Dealer carry `aggro` as TYPES, so six of these reports predate the node guards added today and nobody has
     ever wanted them gone. A Combat 70-92 room built around the House's last stock is not a place with a lane
     you stroll down, so the path rule here was describing a map that does not exist. */
  const GAUNTLET = new Set(["carnival", "vault"]);
  /* CONTESTED GROUND (2026-09-25, the owner: "near the ores/trees/fishing spots, there needs to be a few
     aggressive mobs that respawn every 2-3 minutes"). This is a DELIBERATE REVERSAL of the rule below, which has
     held since the Boneyard: nothing that attacks on sight may reach a rock, a tree or a fishing spot, because
     you cannot gather while being mauled.

     It is right everywhere except here. The Vault is the House's own stock room and the whole idea of it is that
     something is still standing over what is left - so its nodes are guarded ON PURPOSE, by six placements that
     carry their own two-to-three minute respawn. A map in this set still has every OTHER rule checked: stations,
     NPCs and, unless it is also a gauntlet, the path and the signs.

     ADDING A NAME HERE IS A DESIGN DECISION, NOT A WAY TO SILENCE A FAILURE. If a map lands in this set without
     an owner asking for it, the map is wrong, not the check. */
  const CONTESTED = new Set(["vault"]);
  const spots = []; for (const o of b.objs) { if (o.edge || o.soft) continue; if ([...(CONTESTED.has(key) ? [] : ["rock", "tree", "oak", "willow", "skyash", "spot", "wheat", "vein", "yew"]), "furnace", "anvil", "range", "fire", ...(GAUNTLET.has(key) ? [] : ["sign"])].includes(o.t)) for (let dx = -1; dx <= (o.w || 1); dx++) for (let dy = -1; dy <= 1; dy++) spots.push({ x: o.x + dx, y: o.y + dy, what: `${o.t} at ${o.x},${o.y}` }); }

  if (!GAUNTLET.has(key)) for (let x = 0; x < G.COLS; x++) spots.push({ x, y: 13, what: "the main path" });
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
  /* (2026-09-24) THE PLACEMENT aggro FIRST. A scene may mark one spawn aggressive and leave the next one alone
     — the Carnival does, half of it — and such a monster is not aggressive as a TYPE at all, so reading only
     MOBS[t] walked straight past every one of them and reported the map clean. */
  for (const [t, hx, hy, over] of d.mobs) { const a = over?.aggro || G.MOBS[t].aggro || G.MOBS[t].aggroWas;   /* aggroWas: what it reached before attack-on-sight was switched off (AGGRO_ON), so the corners stay safe for the day it comes back */ if (!a) continue; const hit = new Set();
    const stand = wander(hx, hy);
    for (const s of spots) if (stand.some(([sx, sy]) => Math.max(Math.abs(s.x - sx), Math.abs(s.y - sy)) <= a)) hit.add(s.what);
    if (hit.size) { bad++; console.log(`REACH  ${key}: ${t} at ${hx},${hy} (aggro ${a}) can reach ${[...hit].join("; ")}`); } }
}
console.log(bad ? `${bad} aggressive monsters can reach something they shouldn't.` : "ok: no aggressive monster can reach a resource, a station, a sign, an NPC or the path."); process.exit(bad ? 1 : 0);

/* WHERE EACH BACK WAY'S TWO ENDS GO (2026-10-01, the owner: "yes add them", to the Scrap Run, the Ice Ledge and the Storm Drain). On each
   map: a free blocked tile (no object on it, not walkable, so taking it changes nobody's path) beside a walkable tile of the map's main area,
   as close as possible to the edge named, and well away from exits, spawns, NPCs, and the shortcuts, nooks and lockboxes already placed.
   Uses the real built grid with everything of ours in it (HOLD.thief2 off). Prints the coordinates for BACKWAYS.
   Run: node tools/thieving-mock/backways.mjs */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const ENDS = [["carnival", "n"], ["trailer", "w"], ["frozen", "e"], ["valley", "w"], ["workyard", "s"], ["thunderhead", "s"]];
const D = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
for (const [k, side] of ENDS) {
  const b = G.buildScene(k), g = b.g, H = g.length, W = g[0].length;
  const walk = (x, y) => G.walkableIn(g, x, y);
  const occ = new Set(); for (const o of b.objs) for (let i = 0; i < (o.w || 1); i++) for (let j = 0; j < (o.h || 1); j++) occ.add(`${o.x + i},${o.y + j}`);
  const avoid = []; for (const o of b.objs) if (o.sc || o.t === "lockbox" || o.pocket || o.ledge) avoid.push([o.x, o.y]);
  for (const n of b.npcs || []) avoid.push([n.x, n.y]);
  const spawns = (G.SCENES[k].mobs || []).map(([, x, y]) => [x, y]), exits = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "e") exits.push([x, y]);
  /* the main area: from the first exit's neighbour */
  const seed = (() => { for (const [ex, ey] of exits) for (const [dx, dy] of Object.values(D)) if (walk(ex + dx, ey + dy)) return [ex + dx, ey + dy]; return null; })();
  const main = new Set([seed.join()]), q = [seed]; while (q.length) { const [x, y] = q.pop(); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && G.canStepIn(g, x, y, dx, dy)) { const kk = `${x + dx},${y + dy}`; if (!main.has(kk)) { main.add(kk); q.push([x + dx, y + dy]); } } }
  const far = (x, y, list, r) => list.every(([a, c]) => Math.max(Math.abs(a - x), Math.abs(c - y)) > r);
  let best = null;
  for (const t of main) for (const [dx, dy] of Object.values(D)) {
    const [x, y] = t.split(",").map(Number), px = x + dx, py = y + dy;
    if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
    if (walk(px, py) || g[py][px] === "e" || g[py][px] === "v" || occ.has(`${px},${py}`) || occ.has(t)) continue;
    if (!far(x, y, exits, 5) || !far(x, y, spawns, 3) || !far(x, y, avoid, 3)) continue;
    const edge = side === "n" ? py : side === "s" ? H - 1 - py : side === "w" ? px : W - 1 - px;
    const mid = side === "n" || side === "s" ? Math.abs(px - W / 2) : Math.abs(py - H / 2);
    const score = edge * 10 + mid * 0.5;
    if (!best || score < best.score) best = { score, at: [px, py], stand: [x, y] };
  }
  /* no free blocked tile anywhere (the Carnival: every one holds a prop): take a DEAD END of open ground instead, a walkable tile with only
     one walkable neighbour, so blocking it can't cut anybody off */
  if (!best) for (const t of main) {
    const [x, y] = t.split(",").map(Number); if (occ.has(t) || x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
    const nb = []; for (let ex = -1; ex <= 1; ex++) for (let ey = -1; ey <= 1; ey++) if ((ex || ey) && main.has(`${x + ex},${y + ey}`)) nb.push([x + ex, y + ey]);
    if (nb.length !== 1 || Math.abs(nb[0][0] - x) + Math.abs(nb[0][1] - y) !== 1) continue;
    const [sx, sy] = nb[0]; if (!far(sx, sy, exits, 5) || !far(sx, sy, spawns, 3) || !far(sx, sy, avoid, 3) || occ.has(`${sx},${sy}`)) continue;
    const edge = side === "n" ? y : side === "s" ? H - 1 - y : side === "w" ? x : W - 1 - x;
    if (!best || edge < best.score) best = { score: edge, at: [x, y], stand: [sx, sy], deadEnd: true };
  }
  console.log(k, side, best ? `prop ${best.at} stand ${best.stand}${best.deadEnd ? " (dead end)" : ""}` : "NONE");
}

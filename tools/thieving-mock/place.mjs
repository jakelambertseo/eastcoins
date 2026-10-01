/* WHERE EACH SHORTCUT, LEDGE AND LOCKBOX GOES (2026-10-01, building mockup 15). Reads every map's real grid and objects from the map book
   and prints the coordinates the rules file then carries by hand (WORLD_SHORTCUTS / LOCKBOXES), so nobody has to guess a tile.
     cutters: the measured best hop (find-shortcuts.mjs), with the object on the first free blocked tile along it;
     ledges:  a one-tile island in the map's own blocked ground (water first), 2-3 tiles off the main walkable area, with one more free tile
              beside it for the gathering spot, neither touching the shore (so the spot is only reachable over the shortcut);
     lockboxes: an open tile (all eight neighbours walkable) far from exits and spawns.
   Read-only. Run: node tools/thieving-mock/place.mjs */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(readFileSync(join(HERE, "../mapbook-mock/maps.json"), "utf8"));
const SC = JSON.parse(readFileSync(join(HERE, "shortcuts.json"), "utf8"));
const WALK = new Set([..."., sepfi"].filter((c) => c !== " "));
const CUTS = ["workyard", "boneyard", "carnival", "boardwalk", "depths", "trailer"];
const LEDGES = { gloam: "willow", mire: "deadtree", sands: "tree", cloud: "skyash", thunderhead: "rock", valley: "cycad", frozen: "frostpine" };
const BOXES = ["gloam", "mire", "boneyard", "sands", "cloud", "thunderhead", "carnival", "boardwalk", "depths", "trailer", "valley", "frozen"];

const out = { cuts: {}, ledges: {}, boxes: {} };
for (const k of new Set([...CUTS, ...Object.keys(LEDGES), ...BOXES])) {
  const m = M.maps[k], W = m.W, H = m.H, g = m.grid;
  const occ = new Set(); for (const o of m.objs || []) { const [t, x, y, w = 1, h = 1] = o; for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) occ.add(`${x + i},${y + j}`); }
  for (const n of m.npcs || []) occ.add(`${n.x ?? n[1]},${n.y ?? n[2]}`);
  const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && WALK.has(g[y][x]);
  /* the main walkable area: the biggest connected piece */
  const comp = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!walk(x, y) || comp[x + y * W] >= 0) continue; const id = x + y * W, q = [[x, y]]; comp[id] = id; let n = 0;
    while (q.length) { const [cx, cy] = q.pop(); n++; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const nx = cx + dx, ny = cy + dy; if (walk(nx, ny) && comp[nx + ny * W] < 0 && (!(dx && dy) || (walk(cx + dx, cy) && walk(cx, cy + dy)))) { comp[nx + ny * W] = id; q.push([nx, ny]); } } }
    if (n > bestN) { bestN = n; best = id; }
  }
  const main = (x, y) => walk(x, y) && comp[x + y * W] === best;
  const free = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && !WALK.has(g[y][x]) && g[y][x] !== "e" && g[y][x] !== "v" && !occ.has(`${x},${y}`);
  const nearMain = (x, y) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && main(x + dx, y + dy)) return true; return false; };
  const line = (a, b) => { const hop = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])), r = []; for (let s = 1; s < hop; s++) r.push([a[0] + Math.round(((b[0] - a[0]) * s) / hop), a[1] + Math.round(((b[1] - a[1]) * s) / hop)]); return r; };
  const spawns = (m.spawns || []).map((s) => [s.x ?? s[1], s.y ?? s[2]]);
  const exits = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "e") exits.push([x, y]);

  if (CUTS.includes(k)) {
    /* every hop 2-4 with a FREE blocked tile on it for the shortcut's prop (the measured best often runs through a boulder or a fence) */
    const bfs = (sx, sy) => { const d = new Int32Array(W * H).fill(-1), q = [sx + sy * W]; d[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!walk(nx, ny) || (dx && dy && (!walk(x + dx, y) || !walk(x, y + dy)))) continue; const j = nx + ny * W; if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } } return d; };
    let bestC = null;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!main(x, y)) continue; const d = bfs(x, y);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const hop = Math.max(Math.abs(dx), Math.abs(dy)), tx = x + dx, ty = y + dy; if (hop < 2 || !main(tx, ty) || tx + ty * W < x + y * W) continue;
        const ln = line([x, y], [tx, ty]); if (ln.some(([lx, ly]) => walk(lx, ly))) continue;   /* the whole hop is over blocked ground */
        const on = ln.find(([lx, ly]) => free(lx, ly)); if (!on) continue;
        const saves = d[tx + ty * W] - hop; if (saves > (bestC?.saves || 14)) bestC = { a: [x, y], b: [tx, ty], at: on, saves, hop };
      }
    }
    out.cuts[k] = bestC;
  }
  if (LEDGES[k]) {
    let pick = null;
    for (let y = 3; y < H - 3 && !pick; y++) for (let x = 3; x < W - 3; x++) {
      if (!free(x, y) || nearMain(x, y)) continue;
      const R = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).find(([rx, ry]) => rx >= 3 && ry >= 3 && rx < W - 3 && ry < H - 3 && free(rx, ry) && !nearMain(rx, ry));
      if (!R) continue;
      /* a shore tile 2-3 away, whose straight line over is free blocked ground */
      for (let r = 2; r <= 3 && !pick; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const sx = x + dx, sy = y + dy;
        if (!main(sx, sy)) continue; const ln = line([sx, sy], [x, y]);
        if (!ln.every(([lx, ly]) => free(lx, ly)) || ln.some(([lx, ly]) => lx === R[0] && ly === R[1])) continue;
        pick = { shore: [sx, sy], ledge: [x, y], spot: R, at: ln[0], hop: r, water: g[y][x] }; break;
      }
    }
    out.ledges[k] = pick ? { ...pick, type: LEDGES[k] } : null;
  }
  if (BOXES.includes(k)) {
    let bestT = null, bestS = -1;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!main(x, y) || occ.has(`${x},${y}`)) continue; let open = true;
      for (let dx = -1; dx <= 1 && open; dx++) for (let dy = -1; dy <= 1; dy++) if (!main(x + dx, y + dy) || occ.has(`${x + dx},${y + dy}`)) { open = false; break; }
      if (!open) continue;
      const dEx = Math.min(99, ...exits.map(([ex, ey]) => Math.max(Math.abs(ex - x), Math.abs(ey - y)))), dSp = Math.min(12, ...spawns.map(([sx2, sy2]) => Math.max(Math.abs(sx2 - x), Math.abs(sy2 - y))));
      if (dEx < 5) continue; const s = dSp * 2 + Math.min(dEx, 12);
      if (s > bestS) { bestS = s; bestT = [x, y]; }
    }
    out.boxes[k] = bestT;
  }
}
console.log(JSON.stringify(out, null, 1));

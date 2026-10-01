/* Where would a shortcut save the most walking? (2026-10-01, for the thieving and shortcuts mockup.) For every open outdoor map in the map
   book, look at every pair of walkable tiles 2-4 apart with something in the way, and measure the real walk between them with the game's own
   rules (8-way, no cutting corners, walkable = ".,sepfi"). The pair whose walk is longest compared with the hop is the map's best shortcut.
   Writes shortcuts.json beside it. Read-only; runs on tools/mapbook-mock/maps.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(readFileSync(join(HERE, "../mapbook-mock/maps.json"), "utf8"));
const WALK = new Set([..."., sepfi"].filter((c) => c !== " "));
const MAPS = ["gloam", "mire", "boneyard", "sands", "cloud", "thunderhead", "carnival", "boardwalk", "depths", "trailer", "valley", "frozen", "frostspire", "workyard"];

function bfs(g, W, H, sx, sy) {
  const d = new Int32Array(W * H).fill(-1), q = [sx + sy * W]; d[q[0]] = 0;
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && WALK.has(g[y][x]);
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (!ok(nx, ny)) continue;
      if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue;   /* no corner cutting, as canStepIn */
      const j = nx + ny * W; if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}
const out = {};
for (const k of MAPS) {
  const m = M.maps[k]; if (!m) continue;
  const g = m.grid, W = m.W, H = m.H, best = [];
  const walk = (x, y) => WALK.has(g[y]?.[x]);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!walk(x, y)) continue;
    const d = bfs(g, W, H, x, y);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const hop = Math.max(Math.abs(dx), Math.abs(dy)), tx = x + dx, ty = y + dy;
      if (hop < 2 || tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1 || !walk(tx, ty)) continue;
      if (tx + ty * W < x + y * W) continue;   /* each pair once */
      /* something has to be in the way on the straight line */
      let blocked = 0; for (let s = 1; s < hop; s++) { const ix = x + Math.round((dx * s) / hop), iy = y + Math.round((dy * s) / hop); if (!walk(ix, iy)) blocked++; }
      if (!blocked) continue;
      const via = d[tx + ty * W]; if (via < 0) continue;   /* unreachable pairs are a different map's problem */
      best.push({ a: [x, y], b: [tx, ty], hop, walk: via, saves: via - hop });
    }
  }
  best.sort((p, q) => q.saves - p.saves);
  /* keep the top three that aren't the same spot */
  const keep = [];
  for (const c of best) { if (keep.every((o) => Math.hypot(o.a[0] - c.a[0], o.a[1] - c.a[1]) > 6)) keep.push(c); if (keep.length === 3) break; }
  out[k] = { name: m.name, band: m.band, W, H, grid: g, top: keep };
  console.log(`${m.name.padEnd(22)} best hop ${keep[0]?.hop} tiles saves ${keep[0]?.saves} steps (walk ${keep[0]?.walk})`);
}
writeFileSync(join(HERE, "shortcuts.json"), JSON.stringify(out));

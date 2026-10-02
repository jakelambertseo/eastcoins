/* GRAPPLE POINTS, the finder (2026-10-02, v1.2 field kits) —  node tools/eastscape-grapple-find.mjs
   For every map open on the live server (no __ES_OPEN_ALL), the best place for an archer's grapple crossing: two open tiles 3-6 apart in a
   straight line with nothing walkable between them (water, rock, a cliff), where walking round is at least three times the hop and at least
   20 steps, a free blocked tile beside each end for the post, and nothing of the thieving pass's (shortcuts, back ways, lockboxes) or a map
   exit within two tiles. Prints the best few per map, best first; the chosen ones are written into GRAPPLES in the rules by hand. */
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const out = {};
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
for (const key of Object.keys(G.SCENES)) {
  const def = G.SCENES[key];
  if (!G.OPEN.has(key) || def.interior || def.island || def.home || def.pvp || key.startsWith("tower") || def.crypt || def.pyramid) continue;
  let b; try { b = G.buildScene(key); } catch (e) { continue; }
  const g = b.g, W = G.COLS, H = G.ROWS;
  const occ = new Set(); for (const o of b.objs) for (let j = 0; j < (o.h || 1); j++) for (let i = 0; i < (o.w || 1); i++) occ.add(`${o.x + i},${o.y + j}`);
  const near = new Set(); const mark = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) near.add(`${x + dx},${y + dy}`); };
  for (const o of b.objs) if (o.sc || o.bw || o.t === "lockbox" || o.t === "shortcut" || o.pocket || o.t === "stunt" || o.door) mark(o.x, o.y);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "e") mark(x, y);
  const open = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && G.walkableIn(g, x, y) && g[y][x] !== "e" && !occ.has(`${x},${y}`) && !near.has(`${x},${y}`);
  const freeBlocked = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && !G.walkableIn(g, x, y) && !occ.has(`${x},${y}`) && g[y][x] !== "e";
  const cands = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!open(x, y)) continue;
    for (const [dx, dy] of DIRS) for (let hop = 2; hop <= 7; hop++) {
      const bx = x + dx * hop, by = y + dy * hop; if (!open(bx, by)) continue;
      let clear = true; for (let i = 1; i < hop; i++) if (G.walkableIn(g, x + dx * i, y + dy * i)) { clear = false; break; } if (!clear) continue;
      const p = G.findPath(g, { x, y }, { x: bx, y: by }, 0); if (!p) continue;
      if (p.length < Math.max(14, hop * 2.5)) continue;
      /* a post beside each end, on a free blocked tile: the first tile of the hop if nothing stands there, else any blocked neighbour */
      const post = (sx, sy, fx, fy) => { if (freeBlocked(sx + fx, sy + fy)) return [sx + fx, sy + fy]; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (freeBlocked(sx + ox, sy + oy)) return [sx + ox, sy + oy]; return null; };
      const pa = post(x, y, dx, dy), pb = post(bx, by, -dx, -dy); if (!pa || !pb || (pa[0] === pb[0] && pa[1] === pb[1])) continue;
      cands.push({ a: [x, y], b: [bx, by], pa, pb, hop, walk: p.length, saved: p.length - hop, over: G.walkableIn(g, x + dx, y + dy) ? "?" : g[y + dy][x + dx] });
    }
  }
  cands.sort((p, q) => q.saved - p.saved);
  /* keep the best, then the best that is not on top of it */
  const pick = []; for (const c of cands) if (pick.every((p) => Math.hypot(p.a[0] - c.a[0], p.a[1] - c.a[1]) > 8)) { pick.push(c); if (pick.length >= 3) break; }
  if (pick.length) out[key] = pick;
}
console.log("maps checked:", [...G.OPEN].filter((k) => G.SCENES[k] && !G.SCENES[k].interior).join(" "));
for (const [k, list] of Object.entries(out)) console.log(`${k.padEnd(14)} ${list.map((c) => `a${c.a} b${c.b} posts ${c.pa}/${c.pb} hop ${c.hop} walk ${c.walk} over '${c.over}'`).join("  |  ")}`);

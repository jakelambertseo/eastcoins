/* FENCED POCKETS FOR THE CUTTER MAPS (2026-10-01, the owner: "yes", to a next-tier spot behind every shortcut). On the five maps whose
   shortcut only saves a walk, a one-tile alcove is fenced off with the map's own barrier, with the next tier's tree or rock beside it and a
   gate in the fence that only Agility opens. Uses the REAL built grid (buildScene with HOLD.thief2 on, so nothing of ours is in it yet).
   A candidate is kept only if, after fencing, every walkable tile that was connected before still is (minus the pocket), no exit, NPC,
   object or spawn is touched, and the spot can be worked only from the pocket. Prints the WORLD_SC entries' coordinates.
   Run: node tools/thieving-mock/pockets.mjs */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
G.HOLD.thief2 = true;
const MAPS = ["gloam", "mire", "boneyard", "sands", "cloud", "thunderhead", "carnival", "boardwalk", "depths", "trailer", "valley", "frozen"];
/* (2026-10-01, the owner on the water islands: "the character is hidden behind trees, theres no island ground") the spot is BEHIND or BESIDE
   where you stand, never in front (a tree south of you is drawn over you), and every map uses a nook on real ground. */
const out = {};
for (const k of MAPS) {
  const b = G.buildScene(k), g = b.g.map((r) => (Array.isArray(r) ? r.slice() : r.split(""))), H = g.length, W = g[0].length;
  const walk = (x, y, gg = g) => x >= 0 && y >= 0 && x < W && y < H && ".,sepfi".includes(gg[y][x]);
  const occ = new Set(); for (const o of b.objs) for (let i = 0; i < (o.w || 1); i++) for (let j = 0; j < (o.h || 1); j++) occ.add(`${o.x + i},${o.y + j}`);
  for (const n of b.npcs || []) occ.add(`${n.x},${n.y}`);
  const spawns = (G.SCENES[k].mobs || []).map(([, x, y]) => [x, y]);
  const near = (x, y, list, r) => list.some(([a, c]) => Math.max(Math.abs(a - x), Math.abs(c - y)) <= r);
  const sc = G.WORLD_SC[k], A0 = sc.a;
  const reach = (gg, from) => { const seen = new Set([from.join()]), q = [from]; while (q.length) { const [x, y] = q.pop(); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!walk(nx, ny, gg) || (dx && dy && (!walk(x + dx, y, gg) || !walk(x, y + dy, gg)))) continue; const kk = `${nx},${ny}`; if (!seen.has(kk)) { seen.add(kk); q.push([nx, ny]); } } } return seen; };
  const base = reach(g, sc.a), exits = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "e") exits.push([x, y]);
  let best = null;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (!base.has(`${x},${y}`) || occ.has(`${x},${y}`)) continue;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) {
      const L = [x, y], R = [x + dx, y + dy];
      if (!base.has(R.join()) || occ.has(R.join())) continue;
      /* the ring: every walkable tile touching L or R */
      const ring = new Map();
      for (const [px, py] of [L, R]) for (let ex = -1; ex <= 1; ex++) for (let ey = -1; ey <= 1; ey++) { const tx = px + ex, ty = py + ey; if ((tx === L[0] && ty === L[1]) || (tx === R[0] && ty === R[1])) continue; if (walk(tx, ty)) ring.set(`${tx},${ty}`, [tx, ty]); }
      const rl = [...ring.values()];
      if (rl.length < 2 || rl.length > 7) continue;
      if (rl.some(([tx, ty]) => occ.has(`${tx},${ty}`) || g[ty][tx] === "e")) continue;
      if (near(L[0], L[1], spawns, 2) || near(R[0], R[1], spawns, 2) || near(L[0], L[1], exits, 4) || near(L[0], L[1], [sc.a, sc.b], 4)) continue;
      /* the gate: a ring tile beside L (not diagonal) with ground straight on past it */
      const gates = rl.filter(([tx, ty]) => Math.abs(tx - L[0]) + Math.abs(ty - L[1]) === 1).map(([tx, ty]) => ({ at: [tx, ty], from: [2 * tx - L[0], 2 * ty - L[1]] })).filter((o) => walk(...o.from) && !ring.has(o.from.join()) && !occ.has(o.from.join()));
      if (!gates.length) continue;
      /* fence it and check nothing else lost its way */
      const g2 = g.map((r) => r.slice()); for (const [tx, ty] of rl) g2[ty][tx] = "#"; g2[R[1]][R[0]] = "#";
      const gate = gates[0], after = reach(g2, gate.from);
      if (after.size !== base.size - rl.length - 2) continue;   /* everything else still connected (the pocket tile L included in the loss) */
      if (exits.some(([ex, ey]) => base.has(`${ex},${ey}`) !== after.has(`${ex},${ey}`)) && exits.some((e) => !after.has(e.join()))) continue;
      const score = rl.length * 10 + Math.min(...spawns.map(([a, c]) => -Math.min(8, Math.max(Math.abs(a - x), Math.abs(c - y)))));
      if (!best || score < best.score) best = { score, stand: L, spot: R, gate: gate.at, from: gate.from, ring: rl.filter(([tx, ty]) => !(tx === gate.at[0] && ty === gate.at[1])) };
    }
  }
  out[k] = best;
  console.log(k, best ? `stand ${best.stand} spot ${best.spot} gate ${best.gate} from ${best.from} fences ${best.ring.length}` : "NONE");
}
console.log(JSON.stringify(out));

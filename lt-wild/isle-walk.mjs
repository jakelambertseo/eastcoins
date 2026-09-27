/* THE BOARDWALK'S ISLANDS: where you can walk, first by colour, then by hand. node lt-wild/isle-walk.mjs
   (2026-09-27) Each island's picture (lt-wild/cut/<key>-bg.png) is read tile by tile: a tile that is mostly open water or foam is "~",
   anything else is ground. Then each island's `block` rects (houses, the ship, stalls, rocks, the drawn palms) are "#". Writes
   lt-wild/cut/<key>-rows.json and prints every grid with what cannot be reached from the island's arrival spot marked "x". */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const CUT = "C:/Users/jake/code/eastcoins/lt-wild/cut/", COLS = 44, ROWS = 26, P = 32;
const ISLES = JSON.parse(fs.readFileSync("C:/Users/jake/code/eastcoins/lt-wild/isle-blocks.json", "utf8"));
for (const [key, spec] of Object.entries(ISLES)) {
  const { data, info } = await sharp(CUT + `${key}-bg.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const g = [];
  for (let ty = 0; ty < ROWS; ty++) { const row = []; for (let tx = 0; tx < COLS; tx++) {
    let land = 0, n = 0; for (let y = 3; y < P; y += 4) for (let x = 3; x < P; x += 4) { const i = ((ty * P + y) * info.width + tx * P + x) * 4, R = data[i], G = data[i + 1], B = data[i + 2]; n++; if (!(B > R + 30 && B > G - 10) && !(R > 200 && G > 200 && B > 200)) land++; }
    row.push(land / n >= (spec.landAt ?? 0.5) ? "." : "~"); } g.push(row); }
  for (const [x0, y0, x1, y1, c = "#"] of spec.block || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] != null) g[y][x] = c;
  for (const [x0, y0, x1, y1] of spec.open || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] != null) g[y][x] = ".";
  for (const [x, y] of spec.exits || []) g[y][x] = "e";
  const walk = (x, y) => g[y]?.[x] === "." || g[y]?.[x] === "e";
  const [sx, sy] = spec.arrive, seen = new Set([`${sx},${sy}`]), q = [[sx, sy]];
  if (!walk(sx, sy)) console.log(`  !! ${key}: the arrival spot ${sx},${sy} is not walkable`);
  while (q.length) { const [x, y] = q.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`; if (seen.has(k) || !walk(nx, ny) || (dx && dy && (!walk(x, ny) || !walk(nx, y)))) continue; seen.add(k); q.push([nx, ny]); } }
  let lost = 0; const pr = g.map((r, y) => r.map((c, x) => (walk(x, y) && !seen.has(`${x},${y}`) ? (lost++, "x") : c)).join(""));
  console.log(`\n== ${key}  (unreachable: ${lost})\n   ${"0123456789".repeat(5).slice(0, COLS)}`); pr.forEach((r, y) => console.log(String(y).padStart(2) + " " + r));
  fs.writeFileSync(CUT + `${key}-rows.json`, JSON.stringify(g.map((r) => r.join(""))));
}

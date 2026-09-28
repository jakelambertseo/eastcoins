/* THE FOUNDRY'S SEVEN AREAS: where you can walk, first by colour and texture, then by hand.  node lt-wild/fd-walk.mjs [key ...]
   (2026-09-27, the Foundry rebuild) Each area's picture (lt-wild/cut/<key>-bg.png) is read tile by tile:
     lava      mostly orange / yellow (the souls wall's glow counts)                      "~"
     cliff     dark, and BUMPY: the pack's cliffs are boulders with bright rims, its floor is smooth, so a tile whose brightness varies a
               lot is a cliff face                                                          "#"
     floor     everything else                                                              "."
   Then each area's hand rects in lt-wild/fd/walk.json: `block` (#), `open` (.), `lava` (~), `exits` ([x, y] door tiles, "e"), and the
   arrival spot the reachability check starts from. Writes lt-wild/cut/<key>-rows.json and an overlay PNG (lt-wild/cut/<key>-walk.png),
   and prints each grid with anything that cannot be reached from the arrival marked "x". */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const ROOT = "C:/Users/jake/code/eastcoins/", CUT = ROOT + "lt-wild/cut/", COLS = 44, ROWS = 26, P = 32;
const SPEC = JSON.parse(fs.readFileSync(ROOT + "lt-wild/fd/walk.json", "utf8"));
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SPEC);
for (const key of keys) {
  const spec = SPEC[key] || {};
  const { data, info } = await sharp(CUT + `${key}-bg.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const g = [];
  for (let ty = 0; ty < ROWS; ty++) { const row = []; for (let tx = 0; tx < COLS; tx++) {
    let lava = 0, n = 0, s = 0, s2 = 0, br = 0;
    for (let y = 1; y < P; y += 2) for (let x = 1; x < P; x += 2) {
      const i = ((ty * P + y) * info.width + tx * P + x) * 4, R = data[i], G = data[i + 1], B = data[i + 2], L = 0.3 * R + 0.59 * G + 0.11 * B; n++;
      if ((R > 150 && G > 60 && B < 90 && R > B + 90) || (R > 170 && G > 170 && B < 110)) lava++;
      s += L; s2 += L * L; br += B - R;
    }
    const mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
    /* measured on the Works: floor is flat (brightness spread 1-2) and warm (blue minus red about -13); a boulder wall spreads 7-8 and
       leans blue (-2 to -8); a glowing floor crack spreads a lot but leans orange (-27), so it stays floor */
    row.push(lava / n >= (spec.lavaAt ?? 0.45) ? "~" : sd > (spec.cliffSd ?? 5) && br / n > (spec.cliffBlue ?? -10) ? "#" : ".");
  } g.push(row); }
  for (const [x0, y0, x1, y1] of spec.block || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] != null) g[y][x] = "#";
  for (const [x0, y0, x1, y1] of spec.lava || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] != null) g[y][x] = "~";
  for (const [x0, y0, x1, y1] of spec.open || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] != null) g[y][x] = ".";
  for (const [x, y] of spec.exits || []) if (g[y]?.[x] != null) g[y][x] = "e";
  const walk = (x, y) => g[y]?.[x] === "." || g[y]?.[x] === "e";
  const seen = new Set(), starts = spec.arrive ? [spec.arrive] : [];
  for (const [sx, sy] of starts) { if (!walk(sx, sy)) console.log(`  !! ${key}: the arrival spot ${sx},${sy} is not walkable`); seen.add(`${sx},${sy}`); }
  const q = [...starts];
  while (q.length) { const [x, y] = q.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`; if (seen.has(k) || !walk(nx, ny) || (dx && dy && (!walk(x, ny) || !walk(nx, y)))) continue; seen.add(k); q.push([nx, ny]); } }
  let lost = 0; const pr = g.map((r, y) => r.map((c, x) => (walk(x, y) && !seen.has(`${x},${y}`) ? (lost++, "x") : c)).join(""));
  /* anything nobody can walk to (a bank across the lava, the top of the gate's wall) is solid in the game, so nothing spawns or stands there */
  const closed = spec.keepLost ? g : g.map((r, y) => r.map((c, x) => (walk(x, y) && !seen.has(`${x},${y}`) ? "#" : c)));
  console.log(`\n== ${key}  (walkable ${g.flat().filter((c) => c === "." || c === "e").length}, unreachable ${lost})\n   ${"0123456789".repeat(5).slice(0, COLS)}`); pr.forEach((r, y) => console.log(String(y).padStart(2) + " " + r));
  fs.writeFileSync(CUT + `${key}-rows.json`, JSON.stringify(closed.map((r) => r.join(""))));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * P}" height="${ROWS * P}">`;
  pr.forEach((r, y) => [...r].forEach((c, x) => { const f = c === "#" ? "rgba(255,0,0,.38)" : c === "~" ? "rgba(0,0,255,.18)" : c === "x" ? "rgba(255,0,255,.55)" : c === "e" ? "rgba(0,255,0,.6)" : null; if (f) svg += `<rect x="${x * P}" y="${y * P}" width="${P}" height="${P}" fill="${f}"/>`; }));
  for (let x = 0; x <= COLS; x++) svg += `<line x1="${x * P}" y1="0" x2="${x * P}" y2="${ROWS * P}" stroke="${x % 5 ? "rgba(255,255,255,.12)" : "rgba(255,255,0,.6)"}"/>`;
  for (let y = 0; y <= ROWS; y++) svg += `<line x1="0" y1="${y * P}" x2="${COLS * P}" y2="${y * P}" stroke="${y % 5 ? "rgba(255,255,255,.12)" : "rgba(255,255,0,.6)"}"/>`;
  for (let x = 0; x < COLS; x += 5) for (let y = 0; y < ROWS; y += 5) svg += `<text x="${x * P + 2}" y="${y * P + 13}" fill="yellow" font-size="12">${x},${y}</text>`;
  const lay = await sharp(CUT + `${key}-bg.png`).composite([{ input: Buffer.from(svg + "</svg>") }]).png().toBuffer(); await sharp(lay).resize(1056).png().toFile(CUT + `${key}-walk.png`);
}

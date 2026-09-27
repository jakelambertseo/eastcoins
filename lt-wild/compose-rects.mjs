/* A map picture composed from rectangles of pack mockups (2026-09-27, for the Boardwalk, the Foundry and the Orchard Wall).
   node lt-wild/compose-rects.mjs <spec.json>   where the spec is
     { "out": "boardwalk", "fill": [r,g,b], "rects": [ { "src": "lt-wild/cut/mk/sea-11.png", "sx": 0, "sy": 0, "w": 27, "h": 26, "dx": 15, "dy": 0 }, ... ] }
   Tiles are 32px; a rect copies w x h source tiles at (sx, sy) to (dx, dy); later rects paint over earlier ones; a rect with "repeat": true
   tiles its source over its whole destination height. Writes lt-wild/cut/<out>-bg.png, a gridded copy, and the two 704-wide halves the
   game draws (<out>_bg1 / _bg2, 256 colours) into v3/assets/img/glad/flat/. The packs stay local: only the halves are committed. */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const ROOT = "C:/Users/jake/code/eastcoins/", CUT = ROOT + "lt-wild/cut/", FLAT = ROOT + "v3/assets/img/glad/flat/";
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), COLS = 44, ROWS = 26, P = 32;
const out = Buffer.alloc(COLS * P * ROWS * P * 4); const [fr, fg, fb] = spec.fill || [0, 0, 0];
for (let i = 0; i < out.length; i += 4) { out[i] = fr; out[i + 1] = fg; out[i + 2] = fb; out[i + 3] = 255; }
const srcs = {};
for (const r of spec.rects) {
  if (!srcs[r.src]) { const { data, info } = await sharp(ROOT + r.src).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); srcs[r.src] = { d: data, W: info.width, H: info.height }; }
  const S = srcs[r.src], reps = r.repeat ? Math.ceil((r.dh || r.h) / r.h) : 1;
  for (let rep = 0; rep < reps; rep++) for (let ty = 0; ty < r.h; ty++) for (let tx = 0; tx < r.w; tx++) {
    const dX = r.dx + tx, dY = r.dy + rep * r.h + ty; if (dX < 0 || dX >= COLS || dY < 0 || dY >= ROWS || (r.dh && rep * r.h + ty >= r.dh)) continue;
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const sxp = (r.sx + tx) * P + x, syp = (r.sy + ty) * P + y; if (sxp >= S.W || syp >= S.H) continue;
      const si = (syp * S.W + sxp) * 4, di = ((dY * P + y) * COLS * P + dX * P + x) * 4; if (S.d[si + 3] === 0) continue; S.d.copy(out, di, si, si + 4);
    }
  }
}
await sharp(out, { raw: { width: COLS * P, height: ROWS * P, channels: 4 } }).png().toFile(CUT + `${spec.out}-bg.png`);
for (const [k, left] of [[`${spec.out}_bg1`, 0], [`${spec.out}_bg2`, COLS * P / 2]]) await sharp(CUT + `${spec.out}-bg.png`).extract({ left, top: 0, width: COLS * P / 2, height: ROWS * P }).png({ palette: true, colours: 256, compressionLevel: 9 }).toFile(FLAT + `${k}.png`);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * P}" height="${ROWS * P}">`;
for (let x = 0; x <= COLS; x++) svg += `<line x1="${x * P}" y1="0" x2="${x * P}" y2="${ROWS * P}" stroke="${x % 5 ? "rgba(255,255,255,.16)" : "rgba(255,60,60,.75)"}"/>`;
for (let y = 0; y <= ROWS; y++) svg += `<line x1="0" y1="${y * P}" x2="${COLS * P}" y2="${y * P}" stroke="${y % 5 ? "rgba(255,255,255,.16)" : "rgba(255,60,60,.75)"}"/>`;
for (let x = 0; x < COLS; x += 5) for (let y = 0; y < ROWS; y += 5) svg += `<text x="${x * P + 2}" y="${y * P + 13}" fill="yellow" font-size="12">${x},${y}</text>`;
await sharp(CUT + `${spec.out}-bg.png`).composite([{ input: Buffer.from(svg + "</svg>") }]).png().toFile(CUT + `${spec.out}-bg-grid.png`);
for (const k of [`${spec.out}_bg1`, `${spec.out}_bg2`]) console.log(`  ${k}.png ${Math.round(fs.statSync(FLAT + k + ".png").size / 1024)} KB`);
console.log("composed", spec.out);

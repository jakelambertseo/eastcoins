/* EastScape: THE ISLANDS' GROUND (2026-09-30) —  node tools/eastscape-isle-ground-art.mjs
   The owner: "make them look better". Until now an island was the farm's grass running straight into the sea, and a theme was a coloured
   tint laid over it. Each theme is its own pair of Wang sheets now, RECOLOURED from t_dirt (grass + dirt) and t_water (water + grass edge)
   the way the Golden Sands and the Frozen Reach made theirs, so the geometry that already tiles is untouched:
     - the DIRT half of t_dirt becomes the theme's BEACH (the page paints every coastal tile, b/s, as that half), and
     - the GRASS edge of t_water becomes the same beach, so the sea always meets sand, never lawn.
   Written as flat/t_isle_<theme>.png and flat/t_isle_<theme>_w.png. */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const FLAT = "C:/Users/jake/code/eastcoins/v3/assets/img/glad/flat/";
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b, mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
const isGreen = (r, g, b) => g > r + 8 && g > b + 8, isBlue = (r, g, b) => b > r + 12 && b >= g - 6;
const ramp = (dark, light, k = 185) => (r, g, b) => mix(dark, light, lum(r, g, b) / k);
/* per theme: grass (the lawn), beach (the dirt half, and the water sheet's grass edge), water (the sea) */
const THEMES = {
  meadow:   { grass: null, beach: ramp([176, 148, 96], [246, 226, 170]), water: null },
  tropical: { grass: ramp([40, 120, 40], [150, 230, 90], 170), beach: ramp([200, 180, 130], [255, 246, 214]), water: ramp([10, 110, 140], [90, 226, 222], 200) },
  dunes:    { grass: ramp([184, 150, 90], [244, 214, 150]), beach: ramp([200, 170, 110], [252, 236, 190]), water: ramp([20, 96, 140], [96, 200, 214], 200) },
  autumn:   { grass: ramp([96, 78, 30], [206, 170, 78], 170), beach: ramp([170, 142, 96], [238, 216, 168]), water: ramp([22, 64, 110], [96, 150, 190], 200) },
  frozen:   { grass: ramp([168, 184, 208], [246, 250, 255]), beach: ramp([120, 140, 170], [214, 226, 244]), water: ramp([22, 52, 78], [96, 158, 196], 200) },
  gloom:    { grass: ramp([46, 44, 58], [118, 112, 132], 170), beach: ramp([70, 64, 72], [140, 132, 138]), water: ramp([14, 18, 30], [58, 70, 96], 200) },
  /* (2026-09-30, the owner: "add a dark/void version, and a casino version of island themes") */
  void:     { grass: ramp([18, 10, 34], [72, 44, 118], 170), beach: ramp([40, 22, 70], [120, 84, 180]), water: ramp([2, 2, 10], [26, 14, 52], 200) },
  casino:   { grass: ramp([70, 12, 26], [170, 40, 58], 170), beach: ramp([150, 104, 30], [255, 216, 90]), water: ramp([20, 8, 48], [96, 40, 150], 200) }
};
async function sheet(from, to, fn) {
  const { data, info } = await sharp(FLAT + from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 8) continue; const o = fn(data[i], data[i + 1], data[i + 2]); if (o) [data[i], data[i + 1], data[i + 2]] = o; }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 64 }).toFile(FLAT + to);
}
for (const [k, T] of Object.entries(THEMES)) {
  await sheet("t_dirt.png", `t_isle_${k}.png`, (r, g, b) => (isGreen(r, g, b) ? (T.grass ? T.grass(r, g, b) : null) : T.beach(r, g, b)));
  await sheet("t_water.png", `t_isle_${k}_w.png`, (r, g, b) => (isBlue(r, g, b) ? (T.water ? T.water(r, g, b) : null) : T.beach(r, g, b)));
}
console.log(`${Object.keys(THEMES).length * 2} sheets`);

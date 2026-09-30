/* THE FROZEN REACH'S PIECES (2026-09-30) —  node tools/eastscape-frozen-art.mjs
   The Valley's rule (the owner: "the ground tiles need to match our basic ones in the yard ... and not be from the tile packs"), in snow:
     t_snow / t_iwater   t_dirt and t_water RECOLOURED, the way the Golden Sands made t_sand: the grass becomes snow, the path frozen gravel,
                         the water a dark icy teal. The Wang geometry is untouched, so they tile exactly as the Yard's own do.
     fz_cliff_<w>x<h>    the Valley's plateau (the Grass Land pack's rock face and rim, nine-sliced) with its top filled with t_snow's snow and the
                         rock turned to blue-grey stone: a snowy shelf. Placed FLAT, so a monster on top draws over it.
     fz_floe<n>          ice floes, drawn here (no pack), laid flat on the lake: what the lake's creatures, and the Ice Wyrm, stand on.
     fz_*                props: the Sea pack's frozen giant statue and snow rocks, the Grass pack's pines under snow, the Volcano pack's crystals in ice.
   The packs are paid and local (lt-wild/erw, never committed); only the finished pieces in flat/ are. */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const ROOT = "C:/Users/jake/code/eastcoins/", LW = ROOT + "lt-wild/", FLAT = ROOT + "v3/assets/img/glad/flat/", P = 32;
const GRASS = LW + "erw/grass/ERW - Grass Land 2.0 v2.1/", SEA = LW + "erw/sea/ERW - Sea Adventures (GL 2.0 expansion) V1.5/props/islands-update/";
const VPROPS = LW + "erw/volcano/Epic RPG World - Volcano V1.6/Props/static/Atlas-props.png";
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const SNOW_DARK = [168, 184, 208], SNOW_LIGHT = [246, 250, 255], ICE_DARK = [22, 52, 78], ICE_LIGHT = [96, 158, 196], STONE_DARK = [58, 66, 86], STONE_LIGHT = [150, 164, 186];
const isGreen = (r, g, b) => g > r + 8 && g > b + 8, isBlue = (r, g, b) => b > r + 12 && b >= g - 6;
function recolour(d, fn) { for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; const o = fn(d[i], d[i + 1], d[i + 2]); if (o) [d[i], d[i + 1], d[i + 2]] = o; } }
const snowOf = (r, g, b) => mix(SNOW_DARK, SNOW_LIGHT, Math.min(1, lum(r, g, b) / 185));
const gravelOf = (r, g, b) => { const L = lum(r, g, b) / 255; return mix(STONE_DARK, STONE_LIGHT, Math.min(1, L * 1.25)); };
const iceOf = (r, g, b) => mix(ICE_DARK, ICE_LIGHT, Math.min(1, lum(r, g, b) / 200));
async function sheet(from, to, water) {
  const { data, info } = await sharp(FLAT + from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  recolour(data, (r, g, b) => (isGreen(r, g, b) ? snowOf(r, g, b) : water && isBlue(r, g, b) ? iceOf(r, g, b) : gravelOf(r, g, b)));
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 64 }).toFile(FLAT + to);
}
await sheet("t_dirt.png", "t_snow.png", false);
await sheet("t_water.png", "t_iwater.png", true);
const snowTile = await sharp(FLAT + "t_snow.png").extract({ left: 64, top: 32, width: 32, height: 32 }).ensureAlpha().raw().toBuffer();

/* the snowy shelf: the Valley's nine-slice (see eastscape-valley-art.mjs), snow on top, stone for rock */
const TPL = await sharp(GRASS + "Tilesets/wall1-3tiles-transp.png").extract({ left: 0, top: 0, width: 160, height: 224 }).ensureAlpha().raw().toBuffer();
function shelf(w, h) {
  const W = w * P, H = h * P, out = Buffer.alloc(W * H * 4);
  const sx = (x) => (x < 64 ? x : x >= W - 64 ? 160 - (W - x) : 64 + ((x - 64) % 32)), sy = (y) => (y < 64 ? y : y >= H - 128 ? 224 - (H - y) : 64 + ((y - 64) % 32));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) TPL.copy(out, (y * W + x) * 4, (sy(y) * 160 + sx(x)) * 4, (sy(y) * 160 + sx(x)) * 4 + 4);
  const outside = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const k = st.pop(); if (outside[k] || out[k * 4 + 3] > 40) continue; outside[k] = 1; const x = k % W, y = (k / W) | 0; if (x > 0) st.push(k - 1); if (x < W - 1) st.push(k + 1); if (y > 0) st.push(k - W); if (y < H - 1) st.push(k + W); }
  recolour(out, (r, g, b) => (isGreen(r, g, b) ? snowOf(r, g, b) : mix(STONE_DARK, STONE_LIGHT, Math.min(1, lum(r, g, b) / 170))));
  for (let k = 0; k < W * H; k++) { if (outside[k] || out[k * 4 + 3] > 200) continue; const x = k % W, y = (k / W) | 0, gi = ((y % 32) * 32 + (x % 32)) * 4, a = out[k * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) out[k * 4 + c] = Math.round(out[k * 4 + c] * a + snowTile[gi + c] * (1 - a)); out[k * 4 + 3] = 255; }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png();
}
const SHELVES = (process.env.FZ_SHELVES || "5x7,7x7,8x7,6x8,10x7")   /* only the sizes frozen-gen.py places */.split(",").map((s) => s.split("x").map(Number));
for (const [w, h] of SHELVES) await (await shelf(w, h)).toFile(FLAT + `fz_cliff_${w}x${h}.png`);

/* ice floes: a rounded slab of snow-topped ice with a pale rim and a darker waterline, from a seeded wobble so each is its own shape */
function floe(w, h, seed) {
  const W = w * P, H = h * P, out = Buffer.alloc(W * H * 4), cx = W / 2, cy = H / 2 - 3, rx = W / 2 - 3, ry = H / 2 - 6;
  const wob = (a) => 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7 + seed * 2.3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy) / wob(a);
    const dyl = (y - cy - 4) / ry, rl = Math.hypot(dx, dyl) / wob(a);   /* the waterline: the same shape, a few px lower */
    if (r <= 1) { const edge = r > 0.86, gi = ((y % 32) * 32 + (x % 32)) * 4, c = edge ? [196, 226, 246] : [snowTile[gi], snowTile[gi + 1], snowTile[gi + 2]]; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255; }
    else if (rl <= 1) { out[i] = 70; out[i + 1] = 128; out[i + 2] = 168; out[i + 3] = 255; }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png();
}
for (const [n, w, h, seed] of [[1, 2, 2, 1.1], [2, 3, 2, 2.7], [3, 3, 3, 4.2], [4, 6, 4, 0.6]]) await (await floe(w, h, seed)).toFile(FLAT + `fz_floe${n}.png`);

/* props */
const atlasBox = (i) => fs.readFileSync(LW + "cut/contact-vprops.txt", "utf8").split(String.fromCharCode(10)).find((l) => l.startsWith(i + "=")).split("=")[1].split(",").map(Number);
async function prop(name, src, crop, fn) {
  let im = sharp(src); if (crop) im = im.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
  const { data, info } = await im.ensureAlpha().raw().toBuffer({ resolveWithObject: true }); if (fn) recolour(data, fn);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 0 }).png().toFile(FLAT + name + ".png");
}
const iceCrystal = (r, g, b) => mix([60, 110, 170], [214, 240, 255], Math.min(1, lum(r, g, b) / 140));
const snowyPine = (r, g, b) => (isGreen(r, g, b) ? (lum(r, g, b) > 150 ? snowOf(r, g, b) : mix([22, 52, 50], [70, 110, 104], Math.min(1, lum(r, g, b) / 150))) : null);
await prop("fz_statue", SEA + "islands-snow-statue.png");
await prop("fz_rock1", SEA + "islands-snow-rock.png");
await prop("fz_rock2", SEA + "islands-snow-rock2.png");
await prop("fz_pine1", GRASS + "Props/Static props/pine-tree-sprites/pine-tree_0.png", null, snowyPine);
await prop("fz_pine2", GRASS + "Props/Static props/pine-tree-sprites/pine-tree_4.png", null, snowyPine);
for (const [n, i] of [[1, 20], [2, 21], [3, 22]]) await prop(`fz_crystal${n}`, VPROPS, atlasBox(i), iceCrystal);
const all = [...SHELVES.map(([w, h]) => `fz_cliff_${w}x${h}`), "fz_floe1", "fz_floe2", "fz_floe3", "fz_floe4", "fz_statue", "fz_rock1", "fz_rock2", "fz_pine1", "fz_pine2", "fz_crystal1", "fz_crystal2", "fz_crystal3", "t_snow", "t_iwater"];
let kb = 0; for (const n of all) kb += fs.statSync(FLAT + n + ".png").size / 1024;
console.log(`${all.length} pieces, ${Math.round(kb)} KB`);

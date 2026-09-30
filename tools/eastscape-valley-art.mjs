/* THE PRIMEVAL VALLEY'S PIECES (2026-09-30). The owner, second pass: "needs to be easier to walk around, theres far too many
   path blocking items, and it needs to be larger ... put most mobs on cliffs or higher areas, this should be an archery focused map",
   then "use the road rules we built earlier ... the ground tiles need to match our basic ones in the yard, etc. and not be from the
   tile packs". So the ground is the game's own (t_dirt's grass, the cobble road) and this cuts only what STANDS on it:

     pv_cliff_<w>x<h>   a raised plateau: the Grass Land pack's three-tile rock face and rim (wall1-3tiles-transp), nine-sliced to
                        size, its open top filled with the Yard's own grass tile, and every pack green recoloured to the Yard's.
                        Placed FLAT, so a monster standing on top is drawn over it.
     pv_*               props: the volcano (Sea pack cone with its lava), the fossil, tusks, tents, a throne, a totem, palms,
                        ferns, bones, vents, tar holes and crystals.

   The packs are paid and local (lt-wild/erw, never committed); only the finished pieces in flat/ are.
   node tools/eastscape-valley-art.mjs */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const ROOT = "C:/Users/jake/code/eastcoins/", LW = ROOT + "lt-wild/", FLAT = ROOT + "v3/assets/img/glad/flat/", P = 32;
const GRASS = ROOT + "lt-wild/erw/grass/ERW - Grass Land 2.0 v2.1/", SEA = ROOT + "lt-wild/erw/sea/ERW - Sea Adventures (GL 2.0 expansion) V1.5/props/islands-update/";
const ATLAS = { g1: GRASS + "Props/Static props/Atlas-Props-sheet1.png", g2: GRASS + "Props/Static props/Atlas-Props-sheet2.png", g3: GRASS + "Props/Static props/Atlas-Props-sheet3.png",
  vprops: ROOT + "lt-wild/erw/volcano/Epic RPG World - Volcano V1.6/Props/static/Atlas-props.png" };
const boxOf = (ref) => { const [sh, i] = ref.split(":"); const line = fs.readFileSync(LW + `cut/contact-${sh}.txt`, "utf8").split(String.fromCharCode(10)).find((l) => l.startsWith(i + "=")); return [ATLAS[sh], line.split("=")[1].split(",").map(Number)]; };

/* the Yard's grass (t_dirt's all-grass tile) and its four shades, darkest first */
const YARD = [[86, 123, 49], [113, 137, 67], [129, 157, 70], [165, 182, 117]];
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
function yardGreen(d) {   /* every clearly green pixel becomes the Yard shade nearest its brightness */
  for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (d[i + 3] < 8 || !(g > r + 12 && g > b + 12)) continue;
    const L = lum(r, g, b), s = L < 95 ? 0 : L < 120 ? 1 : L < 150 ? 2 : 3; [d[i], d[i + 1], d[i + 2]] = YARD[s]; }
}
const grassTile = await sharp(FLAT + "t_dirt.png").extract({ left: 64, top: 32, width: 32, height: 32 }).ensureAlpha().raw().toBuffer();

/* THE PLATEAU. The template is 5x7 tiles: cols 0-1 | 2 | 3-4 and rows 0-1 | 2 | 3-6 (the rim's middle column and middle row repeat
   cleanly, the corners do not), so it grows by repeating column 2 and row 2. The transparent pixels NOT reachable from the picture's
   edge are the plateau's top, and get the Yard's grass. */
const TPL = await sharp(GRASS + "Tilesets/wall1-3tiles-transp.png").extract({ left: 0, top: 0, width: 160, height: 224 }).ensureAlpha().raw().toBuffer();
function plateau(w, h) {
  const W = w * P, H = h * P, out = Buffer.alloc(W * H * 4);
  const sx = (x) => (x < 64 ? x : x >= W - 64 ? 160 - (W - x) : 64 + ((x - 64) % 32));
  const sy = (y) => (y < 64 ? y : y >= H - 128 ? 224 - (H - y) : 64 + ((y - 64) % 32));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) TPL.copy(out, (y * W + x) * 4, (sy(y) * 160 + sx(x)) * 4, (sy(y) * 160 + sx(x)) * 4 + 4);
  const outside = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const k = st.pop(); if (outside[k] || out[k * 4 + 3] > 40) continue; outside[k] = 1; const x = k % W, y = (k / W) | 0;
    if (x > 0) st.push(k - 1); if (x < W - 1) st.push(k + 1); if (y > 0) st.push(k - W); if (y < H - 1) st.push(k + W); }
  for (let k = 0; k < W * H; k++) { if (outside[k] || out[k * 4 + 3] > 200) continue; const x = k % W, y = (k / W) | 0, gi = ((y % 32) * 32 + (x % 32)) * 4, a = out[k * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) out[k * 4 + c] = Math.round(out[k * 4 + c] * a + grassTile[gi + c] * (1 - a)); out[k * 4 + 3] = 255; }
  yardGreen(out);
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png();
}
const CLIFFS = [[5, 7], [6, 7], [7, 7], [8, 7], [6, 8], [9, 7]];   /* only the sizes lt-wild/valley-gen.py places: an unplaced one would ride everyone's first load */
for (const [w, h] of CLIFFS) await (await plateau(w, h)).toFile(FLAT + `pv_cliff_${w}x${h}.png`);

/* THE PROPS. [name, source, green recolour?] ; the volcano is its cone with the first frame of its lava laid in the crater */
async function cut(ref, flip) { const [f, [x, y, w, h]] = boxOf(ref); let im = sharp(f).extract({ left: x, top: y, width: w, height: h }); if (flip) im = im.flop(); return im.ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
const PROPS = [["pv_palm1", "g1:155"], ["pv_palm2", "g1:157"], ["pv_fern1", "g1:236"], ["pv_fern2", "g1:240"], ["pv_fern3", "g1:238"],
  ["pv_tent_red", "g2:60"], ["pv_tent_green", "g2:61"], ["pv_tusk_l", "g2:72"], ["pv_tusk_r", "g2:73"], ["pv_throne", "g2:93"], ["pv_totem", "g2:100"],
  ["pv_skeleton", "g3:44"], ["pv_skull", "g3:42"], ["pv_bone1", "g3:48"], ["pv_bone2", "g3:49"],
  ["pv_vent1", "vprops:30"], ["pv_vent2", "vprops:35"], ["pv_tarhole1", "vprops:65"], ["pv_tarhole2", "vprops:71"], ["pv_crystal", "vprops:20"], ["pv_lavarock", "vprops:13"]];
for (const [name, ref] of PROPS) { const { data, info } = await cut(ref); yardGreen(data); await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(FLAT + name + ".png"); }
await sharp(SEA + "islands-volcano-volcano.png").composite([{ input: await sharp(SEA + "islands-volcano-lava2.png").extract({ left: 0, top: 0, width: 256, height: 128 }).png().toBuffer(), left: 97, top: 28 }]).png().toFile(FLAT + "pv_volcano.png");
const all = [...CLIFFS.map(([w, h]) => `pv_cliff_${w}x${h}`), ...PROPS.map(([n]) => n), "pv_volcano"];
let kb = 0; for (const n of all) kb += fs.statSync(FLAT + n + ".png").size / 1024;
console.log(`${all.length} pieces, ${Math.round(kb)} KB`); console.log(JSON.stringify(all));

/* THE ZCOIN (AND GOLD) BUTTONS —  node tools/eastscape-zc-buttons.mjs
   (2026-09-28, the owner: "can you build background buttons for the zcoin exchange buttons that match our styling? still greenish")
   The kit's button (ui/btn.png, drawn at 9-slice through border-image) is a copper frame round a maroon, dotted fill. These keep that
   frame and that dotting exactly and repaint only the fill: every fill pixel keeps its own brightness, so the dither survives.
     btn_zc.png      green fill, the kit's copper frame
     btn_zc_on.png   hover: a brighter fill inside btn_on.png's lit frame
     btn_zc_off.png  disabled: the fill greyed, the frame dulled
   The fill is the dark maroon reached by a flood from the middle (see `inside`). */
import sharp from "sharp";
const dir = "v3/assets/img/glad/flat/ui/";
const load = async (f) => { const { data, info } = await sharp(dir + f).raw().ensureAlpha().toBuffer({ resolveWithObject: true }); return { data, info }; };
const base = await load("btn.png"), lit = await load("btn_on.png");
const isFill = (r, g, b) => r < 100 && r > 30 && r > g * 1.6;
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
/* the fill is what a flood from the middle reaches through fill-coloured pixels: the frame's own shadow is the same maroon, and only
   the black inner outline keeps the two apart */
const inside = new Set(); {
  const { data, info } = base, W = info.width, H = info.height, q = [[W >> 1, H >> 1]];
  while (q.length) { const [x, y] = q.pop(), i = (y * W + x) * 4; if (x < 0 || y < 0 || x >= W || y >= H || inside.has(i) || !isFill(data[i], data[i + 1], data[i + 2])) continue; inside.add(i); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
}
async function make(out, fill, frame) {
  const { data, info } = base, o = Buffer.from(data);
  for (let i = 0; i < o.length; i += 4) {
    if (!o[i + 3]) continue; const r = data[i], g = data[i + 1], b = data[i + 2];
    const px = inside.has(i) ? fill(r, g, b) : frame(r, g, b, i); o[i] = cl(px[0]); o[i + 1] = cl(px[1]); o[i + 2] = cl(px[2]);
  }
  await sharp(o, { raw: info }).png({ compressionLevel: 9, palette: true }).toFile(dir + out); console.log(out);
}
const same = (r, g, b) => [r, g, b];
await make("btn_zc.png", (r) => [r * 0.28, r * 0.86 + 6, r * 0.5], same);
await make("btn_zc_on.png", (r) => [r * 0.42, r * 1.22 + 10, r * 0.62], (r, g, b, i) => [lit.data[i], lit.data[i + 1], lit.data[i + 2]]);
/* (2026-09-28, the owner: "the trade and trade in lot needs to have custom drawn backgrounds for the buttons as well") GOLD, for "Trade
   in the lot" and Buy back: the same frame round a gold fill, dark lettering on it */
await make("btn_gold.png", (r) => [r * 2.55, r * 1.85, r * 0.48], same);
await make("btn_gold_on.png", (r) => [r * 2.9 + 10, r * 2.2 + 8, r * 0.7], (r, g, b, i) => [lit.data[i], lit.data[i + 1], lit.data[i + 2]]);
/* and Bom Trady's headshot for the top of his window, cut from his kiosk picture (he is drawn in it, not as a separate sprite) */
await sharp("v3/assets/img/glad/flat/o_bomkiosk.png").extract({ left: 50, top: 34, width: 62, height: 62 }).png({ compressionLevel: 9 }).toFile(dir + "bom_face.png"); console.log("bom_face.png");
await make("btn_zc_off.png", (r) => [r * 0.8 + 8, r * 0.82 + 8, r * 0.8 + 8], (r, g, b) => { const l = (r + g + b) / 3; return [l * 0.55 + r * 0.45, l * 0.55 + g * 0.45, l * 0.55 + b * 0.45]; });

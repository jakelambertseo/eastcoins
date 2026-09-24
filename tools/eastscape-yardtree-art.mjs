/* THE YARD'S WOODCUTTING TREE (2026-09-22).

   The Yard has 128 tree objects and only TWO are real woodcutting trees (6,6 and 9,20 - the ones with a `log`, a
   `req` and xp). The other 126 are wild() scenery. They all shared one sprite, so nothing told you which two you
   could actually chop. Every other zone names its tree - willow, yew, skyash, rustpine, bogwood - and gives it its
   own art; the Yard never got one.

   FIVE GENERATIONS WENT INTO THIS AND THE USEFUL PART IS WHY THEY FAILED:

   · Asking for surface detail (an axe notch, woodchips in the bark) returns a plain round tree. At 80px that detail
     does not survive and the model drops it. SILHOUETTE is the only thing that reads at sprite size.
   · Asking twice for an axe buried in the trunk produced no axe either time. It will not draw one.
   · Generating at 160x192 and reducing with lanczos gave the right shape but visibly SOFT edges next to the game's
     crisp sprites - the owner's "it looks fuzzy".
   · Generating at native 72x88 with the game's palette forced came back crisp and blending but generic: a round
     green tree, indistinguishable from the scenery it was supposed to stand out from.

   So the picture is COMPOSED here rather than asked for again. The 160x192 generation has the shape that works - a
   gnarled, leaning, forked trunk. Its two faults are fixed deterministically:

   1. NEAREST, not lanczos. A smooth kernel is what made it fuzzy. Nearest keeps every edge hard, which is what
      makes it sit beside the crisp sprites already in the game.
   2. QUANTISED TO tree.png's OWN PALETTE. Forcing the palette at generation time cost the silhouette, so it is
      forced afterwards instead: every pixel is snapped to the nearest colour the scenery tree already uses. Same
      greens and browns as its neighbours, different shape - which is exactly the brief.

   Run: node tools/eastscape-yardtree-art.mjs
*/
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const SRC = "https://api.pixellab.ai/mcp/images/e0c1c756-3a9c-4980-b3d4-12b85dd649ca/download";
const PALETTE_FROM = "v3/assets/img/glad/flat/tree.png";   // the scenery tree it has to sit beside
const OUT = "v3/assets/img/glad/flat/o_yardtree.png";
/* The stump it leaves when it is chopped. This one WAS generated at native size with the palette forced and came
   out fine - a stump is a simple enough subject that the model does not need a silhouette argued out of it, which
   is exactly where the tree itself failed. */
const STUMP_SRC = "https://api.pixellab.ai/mcp/images/b679c597-9025-4a3e-a15d-7ccfdb854767/download";
const STUMP_OUT = "v3/assets/img/glad/flat/o_yardtree_stump.png";
const W_OUT = 76, H_OUT = 92;   // the scenery tree is 72x88; a touch bigger so it reads as the older one
const GROUND = 0.13;            // the source draws a mound of soil and weeds it was told not to

/* ---- the palette the game already uses for trees ---- */
const pal = [];
{
  const { data, info } = await sharp(await readFile(PALETTE_FROM)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    if (seen.has(k)) continue;
    seen.add(k); pal.push([data[i], data[i + 1], data[i + 2]]);
  }
}

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch ${res.status}`);
const src = sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha();
const { width: W, height: H } = await src.metadata();
const raw = await src.raw().toBuffer();

let clear = 0;
for (let i = 3; i < raw.length; i += 4) if (raw[i] < 8) clear++;
if (clear / (raw.length / 4) < 0.15) throw new Error("source lost its alpha - check the endpoint, do not flood fill");

const keep = Math.round(H * (1 - GROUND));
const small = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: 0, top: 0, width: W, height: keep })
  .png().toBuffer()
  .then((b) => sharp(b).trim({ threshold: 1 })
    .resize(W_OUT, H_OUT, { fit: "contain", kernel: "nearest", position: "bottom", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true }));

/* ---- snap every pixel to the nearest colour the scenery tree uses ---- */
const px = small.data;
let moved = 0;
for (let i = 0; i < px.length; i += 4) {
  if (px[i + 3] < 128) { px[i + 3] = 0; continue; }         // no half-transparent edges: they are what read as fuzz
  px[i + 3] = 255;
  let best = null, bd = Infinity;
  for (const c of pal) {
    const d = (px[i] - c[0]) ** 2 + (px[i + 1] - c[1]) ** 2 + (px[i + 2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  if (bd > 0) moved++;
  px[i] = best[0]; px[i + 1] = best[1]; px[i + 2] = best[2];
}

const out = await sharp(px, { raw: { width: small.info.width, height: small.info.height, channels: 4 } })
  .png({ compressionLevel: 9 }).toBuffer();
await writeFile(OUT, out);
console.log(`o_yardtree.png  ${small.info.width}x${small.info.height}  ${(out.length / 1024).toFixed(1)} KB  palette ${pal.length} colours, ${moved} px snapped`);

/* ---- the stump, straight through: already native size and already on-palette ---- */
{
  const r = await fetch(STUMP_SRC);
  if (!r.ok) throw new Error(`stump fetch ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { data[i + 3] = 0; continue; }   // hard edges only, same reason as the tree
    data[i + 3] = 255;
    let best = null, bd = Infinity;
    for (const c of pal) { const d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2; if (d < bd) { bd = d; best = c; } }
    if (bd > 0) n++;
    data[i] = best[0]; data[i + 1] = best[1]; data[i + 2] = best[2];
  }
  const out2 = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(STUMP_OUT, out2);
  console.log(`o_yardtree_stump.png  ${info.width}x${info.height}  ${(out2.length / 1024).toFixed(1)} KB  ${n} px snapped`);
}

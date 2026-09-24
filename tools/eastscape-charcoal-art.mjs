/* CHARCOAL's item icon (2026-09-22).

   Item icons live as 32x32 flat files under v3/assets/img/glad/flat/items/ and are served straight from there with
   IART_V as their cache key. Charcoal shipped with an emoji because it was added in the same pass as the smelting
   fuel and never drawn.

   TWO THINGS, AND THE FIRST ONE IS A CORRECTION TO WHAT THE TOWER'S TOOL SAYS.

   1. THIS SOURCE ALREADY HAS ALPHA, so there is NO flood fill here. create_map_object's /download flattens - that
      is true, and the Tower's script cuts its background back for exactly that reason - but create_image_pixflux
      with no_background keeps it, and these are different endpoints. Running the Tower's flood fill over this
      image was actively destructive: transparent pixels read as BLACK in RGB, the coal is also black, so the fill
      walked straight through the outlines and ate the pile, leaving 12% of it as scattered specks. CHECK THE ALPHA
      CHANNEL BEFORE CUTTING A BACKGROUND, rather than assuming the last endpoint's behaviour.

   2. Generated at 128 and reduced to 32 with a proper resample, NOT nearest. Nearest is right for scaling pixel art
      up; reducing by 4x it keeps one pixel in sixteen and throws most of the subject away. At 32px the softness a
      real kernel introduces is invisible, and 32 is what every other item icon in the game is.

   Run: node tools/eastscape-charcoal-art.mjs
*/
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = "https://api.pixellab.ai/mcp/images/f36fd300-0134-46ee-bf18-fa7810107027/download";
const OUT = "v3/assets/img/glad/flat/items/charcoal.png";
const SIZE = 32;

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch ${res.status}`);
const img = sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha();
const { width: W, height: H } = await img.metadata();
const px = await img.raw().toBuffer();
const at = (x, y) => (y * W + x) * 4;

let clear = 0;
for (let i = 3; i < px.length; i += 4) if (px[i] < 8) clear++;
const share = clear / (px.length / 4);
if (share < 0.15) throw new Error(`charcoal is only ${(share * 100).toFixed(1)}% transparent - this endpoint should return alpha; do not paper over it with a flood fill, find out why`);

/* Trim to what is actually drawn before reducing, so the coal fills its 32px square instead of floating in the
   middle of whatever margin the generator left. */
const out = await sharp(px, { raw: { width: W, height: H, channels: 4 } })
  .png().toBuffer()
  .then((b) => sharp(b).trim({ threshold: 1 }).resize(SIZE, SIZE, { fit: "contain", kernel: "lanczos3", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer());

await writeFile(OUT, out);
const m = await sharp(out).metadata();
console.log(`charcoal.png  ${m.width}x${m.height}  ${(out.length / 1024).toFixed(1)} KB  ${(share * 100).toFixed(0)}% transparent at source`);

/* The island's dock decking (2026-09-23).

   The dock was drawn in code — a flat brown fill with four darker lines ruled across each tile — while everything
   around it on the island is a picture, so it read as a placeholder next to the cottage and the palms (the owner:
   "the island plots is still isnt using handdrawn art for the plots, and the wooden dock").

   IT IS A FLOOR TILE, NOT AN OBJECT, so it takes the tile rules out of tools/eastscape-art-style.md: keep the
   brief's pixel-art, fidelity, palette and lighting clauses, drop everything about composition, scale and
   inhabitants, and ask for an even pattern with no large feature. A dock's planks ARE a repeating feature, which
   is fine, but they have to run edge to edge or every tile boundary shows as a seam down the pier.

   Generated at 128 and reduced with LANCZOS, like every other icon here. It is 32x32 to match t_brick and o_plot;
   t_dirt is 128 because it is a large ground texture, which this is not.

   The preview it writes is the point of the tool: a 3x4 grid at 3x zoom is the only honest way to see whether a
   tile really repeats, and eyeballing one copy is not.

   Run: node tools/eastscape-isle-art.mjs [preview path]
*/
import sharp from "sharp";
import fs from "node:fs";

const JOB = "4ffa923e-4b1f-4e13-adc3-dc437bfef4b1";
const OUT = "v3/assets/img/glad/flat/t_dock.png";

const res = await fetch(`https://api.pixellab.ai/mcp/images/${JOB}/download`);
if (!res.ok) throw new Error(`fetch ${res.status}`);
/* CROPPED TO CLOSE THE SEAM, and this is the whole job. Straight off the generator this had a 2px dark frame
   all the way round, so tiled it drew a dark grid line at every tile boundary — a pier made of separate mats.
   The planks repeat every ~14px (measured: gaps at y=7, 21, 35, 48, 63, 76, 90, 105, 119), so the crop runs from
   the first bright row after one gap to the last row of another, 8 whole periods, and the left/right frame comes
   off. Stacked, the bottom gap meets the top plank exactly as it does inside the source. */
const png = await sharp(Buffer.from(await res.arrayBuffer()))
  .extract({ left: 2, top: 8, width: 124, height: 112 })
  .resize(32, 32, { fit: "fill", kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
fs.writeFileSync(OUT, png);
console.log(`  t_dock.png  32x32  ${png.length} B`);

const preview = process.argv[2];
if (preview) {
  const big = await sharp(png).resize(96, 96, { kernel: "nearest" }).toBuffer();
  const t = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) t.push({ input: big, left: x * 96, top: y * 96 });
  await sharp({ create: { width: 288, height: 384, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .composite(t).png().toFile(preview);
  console.log(`  tiling preview -> ${preview}`);
}

/* The Thieves' Guild's four marks, from PixelLab into the game (2026-09-23).

   PixelLab returns a character on a square canvas far larger than the drawing — 92x92 for sprites whose content
   is about 40x60 — and the game's own people are 49x66 (andy) to 68x68 (aurelia). Shipping the padded square
   would draw each mark a third smaller than everyone around them and cost four times the bytes, so the alpha
   bounding box is trimmed off here.

   NOTHING IS SCALED. These are pixel art: resampling them would soften the outlines the style brief is mostly
   about. The trim alone lands them in the same size band as the existing NPCs.

     node tools/eastscape-mark-art.mjs
*/
import fs from "node:fs";
import sharp from "sharp";

const OUT = "v3/assets/img/glad/flat";
const MARKS = [
  ["lifter", "85c4ddb8-d867-4630-9252-ab03c5c84e96"],
  ["grifter", "905a1765-430e-477f-bfc9-d799f88004a5"],
  ["fixer", "a797e0b7-46ca-4d17-b5b0-659210e5b6e4"],
  ["quarter", "c45987b0-4bae-442a-a69c-50d2f32e478b"],
];
const url = (id) => `https://backblaze.pixellab.ai/file/pixellab-characters/4e81aa0e-6201-484d-a0fb-c1ae89736d11/${id}/rotations/south.png`;

for (const [key, id] of MARKS) {
  const res = await fetch(url(id));
  if (!res.ok) { console.log(`  !! ${key}: ${res.status}`); continue; }
  const src = Buffer.from(await res.arrayBuffer());
  const before = await sharp(src).metadata();
  /* trim() on its own trims the BORDER COLOUR; for a transparent sprite the alpha channel is what bounds it. */
  const out = await sharp(src).trim({ threshold: 0 }).png({ compressionLevel: 9, palette: true }).toBuffer();
  const after = await sharp(out).metadata();
  const file = `${OUT}/o_mark_${key}.png`;
  fs.writeFileSync(file, out);
  console.log(`  o_mark_${key}.png  ${before.width}x${before.height} -> ${after.width}x${after.height}  ${(out.length / 1024).toFixed(1)} KB`);
}

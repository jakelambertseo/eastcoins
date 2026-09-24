/* The seven smoked fish get item icons (2026-09-23).

   WHY THEY WERE MISSING AND HOW IT SHOWED. Every COOKED fish has a drawn icon; not one of the SMOKED ones did, so
   they all fell through drawIco's fallback to the same 🐟 emoji — in the bag, in the shop, and in the little
   popup that jumps over your head when you make something. The owner read that as the popup not firing at all
   ("smoked marlin ... arent showing above the users head"), and reasonably so: what pops up is an anonymous
   glyph identical to every other fish, next to a row of properly drawn ones. The server was never the problem.
   Nothing here is new machinery; ITEM_ART just had a hole in it.

   THE MARLIN TOOK TWO GOES, and the reason is the one this pipeline keeps relearning: at 32 pixels SILHOUETTE
   IS THE WHOLE ICON. The first prompt described the curing in loving detail and the shape barely at all, and it
   came back a brown lozenge that could have been a cigar. Naming the bill, the sail-like dorsal fin and the
   forked tail — the three things that make a marlin a marlin — gave a marlin. Describe the OUTLINE first and the
   surface second, every time.

   Run: node tools/eastscape-smoke-art.mjs
*/
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SIZE = 32, OUT = "v3/assets/img/glad/flat/items/";
const JOBS = {
  sstormmarlin:  "6edf1e95-4914-42ed-a808-d04eefd8e8be",   // the second attempt; the first was a brown lozenge
  sghostcarp:    "a4651c7a-dc58-4c21-8bbf-38b846ed0b5d",
  scloudray:     "7994252f-d093-4210-add6-f7d57125105b",
  sskyeel:       "a851de3d-dfaa-4948-8987-7bf917b95619",
  smudcat:       "a83f20ec-0967-4bfb-9b1b-13bafadf57a9",
  sthundersquid: "6599d4c2-f3b7-4f3d-87e7-4295451aa262",
  sbowfin:       "cb885d4d-2944-443b-b46d-eec1c1f722de",
};

for (const [key, job] of Object.entries(JOBS)) {
  const res = await fetch(`https://api.pixellab.ai/mcp/images/${job}/download`);
  if (!res.ok) throw new Error(`${key}: fetch ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());

  /* These come back WITH alpha (no_background), so there is no flood fill here — one would eat the subject,
     which is dark brown on every single one of them. Checked rather than assumed. */
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] < 8) clear++;
  const pct = Math.round((clear / (info.width * info.height)) * 100);
  if (pct < 5) throw new Error(`${key}: only ${pct}% transparent — no_background did not take`);

  /* Trimmed to the subject and re-padded square, so a long eel and a fat catfish read at the same size in a row
     of bag slots; then reduced with LANCZOS, never nearest, which throws away 15 pixels in every 16 at this ratio. */
  const t = await sharp(src).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(t).metadata();
  const side = Math.max(m.width, m.height);
  const sq = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: t, gravity: "center" }]).png().toBuffer();
  const png = await sharp(sq).resize(SIZE, SIZE, { fit: "fill", kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(`${OUT}${key}.png`, png);
  console.log(`  ${key.padEnd(15)} ${SIZE}x${SIZE}  ${String(png.length).padStart(5)} B   ${pct}% transparent`);
}
console.log(`\n${Object.keys(JOBS).length} smoked fish drawn. Add them to ITEM_ART in eastscape.html or nothing changes.`);

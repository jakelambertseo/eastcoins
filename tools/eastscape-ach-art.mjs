/* THE ACHIEVEMENTS UI's art, and the Yard's wheat (2026-09-23).

   Seven pictures, same pipeline as tools/eastscape-crop-art.mjs and the same two rules it learned:

   1. THESE SOURCES ALREADY HAVE ALPHA. create_image_pixflux with no_background keeps it, so there is NO flood fill
      here — one would eat the subject wherever it is dark, and four of these are dark metal on dark ribbon. The
      script refuses if a source comes back mostly opaque, so that stays checked rather than assumed.
   2. Generated at 128 and reduced with LANCZOS (sharp's default kernel), not nearest. Nearest is for scaling pixel
      art UP; reducing by 4x it keeps one pixel in sixteen and throws most of the subject away.

   THE FIVE MEDALS ARE TRIMMED AND RE-PADDED before the reduction. They came back framed differently from each
   other — the crown sits in the middle of a lot of empty space, the medals fill their frame edge to edge — so
   dropped into a column at one size the crown would read as half the size of the others. Trimming to content and
   padding back to a square makes the SUBJECT the same size in every icon, which is what the eye actually compares.
   The wheat is NOT trimmed: it is a world object whose base has to stay on the bottom edge of the tile.

   WHY A MEDAL AND NOT A COLOUR. The tier names were drawn in ACH_TIERS[].col, five pastels picked for the dark
   canvas, on a cream parchment panel — #9ad8a0 novice green on #f2e4c8 is the "weird green text". A tier now says
   what it is with a picture, and the colours are only used where they have enough contrast to work.

   WHY o_wheat AND NOT wheat.png. wheat.png already exists, is in core ART_FILES and is what the closed farm scene
   draws. Overwriting it would change a URL the edge has held for a year AND change that scene; a new name is free.

   Run: node tools/eastscape-ach-art.mjs
*/
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const UI = "v3/assets/img/glad/flat/ui/", FLAT = "v3/assets/img/glad/flat/";
const JOBS = [
  { key: "ach_novice",  job: "de3639f4-a666-423a-8ccf-750a46debf1f", out: UI, w: 32, h: 32, trim: true },
  { key: "ach_skilled", job: "69e70855-1c78-487f-9bd9-a614a0d5d035", out: UI, w: 32, h: 32, trim: true },
  { key: "ach_expert",  job: "1d2817b8-623c-475f-926a-56bff6c37778", out: UI, w: 32, h: 32, trim: true },
  { key: "ach_master",  job: "96ef2ca2-36be-4d42-ab22-be96a6099f09", out: UI, w: 32, h: 32, trim: true },
  { key: "ach_legend",  job: "cfaefcb8-70b2-49aa-8202-7a5951deb6af", out: UI, w: 32, h: 32, trim: true },
  { key: "ach_badge",   job: "6d49c9d6-bd76-4a1c-9b2c-9b579470b8e2", out: UI, w: 32, h: 32, trim: true },
  { key: "o_wheat",     job: "1a5f10bf-b569-4f28-a883-6c571c0edab9", out: FLAT, w: 32, h: 40, trim: false },
];

await mkdir(UI, { recursive: true });

for (const { key, job, out, w, h, trim } of JOBS) {
  const res = await fetch(`https://api.pixellab.ai/mcp/images/${job}/download`);
  if (!res.ok) throw new Error(`${key}: fetch ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());

  // rule 1, checked: a source that came back opaque means no_background did not take, and the flood fill this
  // pipeline deliberately does not do would be needed. Better to stop than to ship a picture in a white box.
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] < 8) clear++;
  const pct = Math.round((clear / (info.width * info.height)) * 100);
  if (pct < 5) throw new Error(`${key}: only ${pct}% transparent — no_background did not take`);

  let img = sharp(src);
  if (trim) {
    // trim to the subject, then letterbox back to square so every medal's subject is the same size
    const t = await sharp(src).trim({ threshold: 1 }).toBuffer();
    const m = await sharp(t).metadata();
    const side = Math.max(m.width, m.height);
    img = sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: t, gravity: "center" }]).png();
    img = sharp(await img.toBuffer());
  }
  const png = await img.resize(w, h, { fit: "fill", kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(`${out}${key}.png`, png);
  console.log(`  ${key.padEnd(12)} ${w}x${h}  ${String(png.length).padStart(5)} B   ${pct}% transparent${trim ? "  (trimmed + squared)" : ""}`);
}
console.log(`\n${JOBS.length} pictures written.`);

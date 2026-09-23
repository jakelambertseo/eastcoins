/* THE FOUR MIDDLE CROPS' item icons (2026-09-23).

   Same pipeline as tools/eastscape-charcoal-art.mjs, and the same two rules it learned:

   1. THESE SOURCES ALREADY HAVE ALPHA. create_image_pixflux with no_background keeps it, so there is NO flood fill
      here — running one would eat the subject wherever it is dark. Checked, not assumed: the script refuses if a
      source comes back mostly opaque.
   2. Generated at 128 and reduced to 32 with LANCZOS, not nearest. Nearest is for scaling pixel art UP; reducing by
      4x it keeps one pixel in sixteen and throws most of the subject away.

   Lanternroot took two goes. The first was a plain orange carrot — the "glows faintly from within" did nothing, and
   at 32px it was indistinguishable from the emoji it replaced. Naming the light as the POINT of the object (skin
   cracked open, light blazing out, a hot core) gave a dark bulb with lit holes, which reads instantly at any size.
   The lesson is the one the Yard's tree already taught: at sprite size, SILHOUETTE AND CONTRAST read, surface
   description does not.

   Run: node tools/eastscape-crop-art.mjs
*/
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SIZE = 32, OUT = "v3/assets/img/glad/flat/items/";
const JOBS = {
  rattlebean:  "882fcea1-dcfb-4de7-ae08-7f02838dd2aa",
  lanternroot: "139591a3-87a3-417d-9d72-aa3ad10babe5",
  bonegourd:   "4d17b5dd-bc9b-4f24-974d-2e735b89346d",
  stormcorn:   "d0afc5c1-527e-4886-9424-47a9d39c4a3e",
};

for (const [key, job] of Object.entries(JOBS)) {
  const res = await fetch(`https://api.pixellab.ai/mcp/images/${job}/download`);
  if (!res.ok) throw new Error(`${key}: fetch ${res.status}`);
  const img = sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha();
  const { width: W, height: H } = await img.metadata();
  const px = await img.raw().toBuffer();
  let clear = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 8) clear++;
  const share = clear / (px.length / 4);
  if (share < 0.15) throw new Error(`${key} is only ${(share * 100).toFixed(1)}% transparent — this endpoint should return alpha; find out why rather than flood filling`);

  const out = await sharp(px, { raw: { width: W, height: H, channels: 4 } })
    .png().toBuffer()
    .then((b) => sharp(b).trim({ threshold: 1 })
      .resize(SIZE, SIZE, { fit: "contain", kernel: "lanczos3", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 }).toBuffer());
  await writeFile(OUT + key + ".png", out);
  console.log(`${key.padEnd(12)} ${SIZE}x${SIZE}  ${(out.length / 1024).toFixed(1)} KB  ${(share * 100).toFixed(0)}% transparent at source`);
}

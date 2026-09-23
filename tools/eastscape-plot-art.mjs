/* CROP PLOT ART (2026-09-23): what a planted island plot looks like as it grows.

   ONE GENERATION PER CROP, not one per stage. Each source is a row of four plants — seedling, young, nearly
   there, ripe — asked for in a single prompt, which is what keeps the four stages of a crop looking like the same
   plant. Four separate prompts would have given four different plants, the way Darla's two facings did.

   THE SLICE IS BY ALPHA, NOT BY THIRDS. The model does not honour "evenly spaced" precisely, and asking for three
   plants produced four; so the stages are found by scanning for columns that are entirely transparent and taking
   the clusters between them. That also means a source with a different number of plants still works — the draw
   picks a stage by fraction, not by a hard-coded count.

   Run: node tools/eastscape-plot-art.mjs
*/
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const OUT = "v3/assets/img/glad/flat/", MAXW = 22, MAXH = 26;
const JOBS = {
  wheat:       "17c0793b-323c-4109-9d66-1876c6cc44eb",
  tomatoe:     "5ecd33f0-ae45-4464-869e-51fc1993c7bb",
  rattlebean:  "66276645-e235-4741-9f8d-441fa8f891ef",
  lanternroot: "aa90345a-1761-4015-a35d-2c7f7889a832",
  bonegourd:   "681ef817-178f-4fcd-b688-1d84959b1391",
  stormcorn:   "62123e65-19b5-4d56-ad9b-46087f7f4cd6",
  goldtomatoe: "b7fe3219-3e70-403f-b57b-2616dd31eabb",
};

const manifest = {};
for (const [crop, job] of Object.entries(JOBS)) {
  const res = await fetch(`https://api.pixellab.ai/mcp/images/${job}/download`);
  if (!res.ok) throw new Error(`${crop}: fetch ${res.status}`);
  const src = sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha();
  const { width: W, height: H } = await src.metadata();
  const px = await src.raw().toBuffer();

  let clear = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 8) clear++;
  if (clear / (px.length / 4) < 0.2) throw new Error(`${crop}: source is not transparent enough to slice — check the endpoint`);

  // columns that hold anything at all
  const used = [];
  for (let x = 0; x < W; x++) { let any = false; for (let y = 0; y < H && !any; y++) if (px[(y * W + x) * 4 + 3] > 24) any = true; used.push(any); }
  const runs = []; let a = null;
  for (let x = 0; x <= W; x++) {
    if (x < W && used[x]) { if (a === null) a = x; }
    else if (a !== null) { if (x - a >= 6) runs.push([a, x - 1]); a = null; }   // 6px floor: ignore a stray speck
  }
  /* FALLBACK TO EQUAL QUARTERS. Lanternroot came back with its four bulbs sitting on one connected strip of dark
     soil, so no column between them is ever empty and the gap scan finds a single run. The plants are still evenly
     spaced, so cutting the used width into four and trimming each piece gets the same result. Anything that fails
     BOTH is a genuinely unusable source and should be regenerated rather than papered over. */
  if (runs.length < 3) {
    const lo = used.indexOf(true), hi = used.lastIndexOf(true), w = (hi - lo + 1) / 4;
    if (lo < 0 || w < 8) throw new Error(`${crop}: cannot split — ${runs.length} run(s), ${Math.round(w)}px each`);
    runs.length = 0;
    for (let i = 0; i < 4; i++) runs.push([Math.round(lo + i * w), Math.round(lo + (i + 1) * w) - 1]);
    console.log(`${crop.padEnd(12)} plants touch; split into four equal parts instead`);
  }

  const stages = [];
  for (const [x0, x1] of runs) {
    const buf = await sharp(px, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: x0, top: 0, width: x1 - x0 + 1, height: H })
      .png().toBuffer();
    // trim to the plant, then fit inside the tile budget keeping the aspect; bottom-aligned by the painter
    const out = await sharp(buf).trim({ threshold: 1 })
      .resize({ width: MAXW, height: MAXH, fit: "inside", kernel: "lanczos3", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 }).toBuffer();
    stages.push(out);
  }
  manifest[crop] = stages.length;
  for (const [i, out] of stages.entries()) {
    const m = await sharp(out).metadata();
    await writeFile(`${OUT}crop_${crop}_${i + 1}.png`, out);
    if (i === stages.length - 1) console.log(`${crop.padEnd(12)} ${stages.length} stages, ripe ${m.width}x${m.height}, ${(out.length / 1024).toFixed(1)} KB`);
  }
}
console.log("\nstages per crop:", JSON.stringify(manifest));

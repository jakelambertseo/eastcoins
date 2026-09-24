/* THE TOWER's picture (2026-09-22, redrawn the same evening).

   The first tower was a forty-storey skyscraper. The owner asked for it "way less tall, more menacing, and the
   bottom blended into the ground", pointing at RPG MO's Fire Tower for the proportions and the way a base sits in
   the terrain — the shape, not the artwork, which is not ours to use. So this is drawn from scratch: a squat
   four-storey ruin with battlements, slit windows lit like eyes, and a glowing arch.

   TWO THINGS THE GENERATOR WILL NOT DO, AND SO ARE DONE HERE. Both were asked for in three different wordings
   across five generations and never once came back right, which is the signal to stop asking and start computing.

   1. TRANSPARENCY. PixelLab's /download FLATTENS. The object's metadata says "background: transparent" and the
      preview shows none, but the bytes are opaque with a flat grey where the sky was. Left alone that draws a grey
      slab across the Yard, which is exactly what shipped the first time.

   2. THE BASE. Every generation ends the building on a straight horizontal cut, so it looks stood on the ground
      rather than part of it. The bottom edge is dissolved here instead: a noise-weighted fade over the last rows,
      so the stonework breaks up into the paving.

   NO LETTER WIPE ANY MORE. The old tower had a misspelled neon sign, and this file used to erase every bright pixel
   in the middle band to remove it. THAT MUST NOT COME BACK for this drawing: its windows and its doorway are bright
   magenta and sit exactly in that band, so the same pass would punch the lit windows out and leave a dead grey ruin.

   Run: node tools/eastscape-tower-art.mjs
*/
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = "https://api.pixellab.ai/mcp/map-objects/7881b5d9-06ef-4a70-9b9a-550c2fe7f1bd/download";
const OUT = "v3/assets/img/glad/flat/o_tower.png";
const FADE = 22;         // rows of dissolve at the foot
const KEEP_SOLID = 0.35; // the top of the fade stays nearly whole, so the wall is not visibly eaten

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch ${res.status}`);
const img = sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha();
const { width: W, height: H } = await img.metadata();
const px = await img.raw().toBuffer();
const at = (x, y) => (y * W + x) * 4;

/* ---- 1. give it its alpha back ----
   A FLOOD FILL FROM THE BORDER, not a global colour key. The building is full of greys and darks, and keying every
   pixel near the background colour punches holes straight through the stonework. Only colour CONNECTED to the edge
   of the canvas is sky; the doorway is enclosed by the building, so it survives. */
const bg = [px[at(1, 1)], px[at(1, 1) + 1], px[at(1, 1) + 2]];
const near = (i) => Math.abs(px[i] - bg[0]) < 40 && Math.abs(px[i + 1] - bg[1]) < 40 && Math.abs(px[i + 2] - bg[2]) < 40;
{
  const seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const s = y * W + x; if (seen[s]) continue;
    const i = at(x, y); if (!near(i)) continue;
    seen[s] = 1; px[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

/* ---- 2. dissolve the foot ----
   Measured per COLUMN from that column's OWN lowest opaque pixel, never from the bottom of the canvas. The tower
   leans and its buttresses step down at different heights, so a fade measured off the canvas eats one corner and
   misses the other entirely. The noise is a cheap hash so it is stable between runs: rebuilding the art does not
   reshuffle the edge. */
const hash = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
let dissolved = 0;
for (let x = 0; x < W; x++) {
  let low = -1;
  for (let y = H - 1; y >= 0; y--) if (px[at(x, y) + 3] > 8) { low = y; break; }
  if (low < 0) continue;
  for (let d = 0; d < FADE; d++) {
    const y = low - d; if (y < 0) break;
    const i = at(x, y); if (px[i + 3] === 0) continue;
    const t = 1 - d / FADE;                              // 1 at the lowest row, 0 at the top of the fade
    const bite = Math.max(0, (t - KEEP_SOLID) / (1 - KEEP_SOLID));
    if (hash(x, y) < bite * bite) { px[i + 3] = 0; dissolved++; }
  }
}

/* A scene object that is not mostly transparent is a bug, and a quiet one: the page happily draws an opaque
   rectangle and you only notice when you walk past it. */
let clear = 0;
for (let i = 3; i < px.length; i += 4) if (px[i] < 8) clear++;
const share = clear / (px.length / 4);
if (share < 0.25) throw new Error(`o_tower is only ${(share * 100).toFixed(1)}% transparent — the source lost its alpha, refusing to write a grey slab into the Yard`);

const out = await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
await writeFile(OUT, out);
console.log(`o_tower.png  ${W}x${H}  ${(out.length / 1024).toFixed(1)} KB  ${(share * 100).toFixed(0)}% transparent  ${dissolved} px dissolved at the foot`);

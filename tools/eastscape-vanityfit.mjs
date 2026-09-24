/* FIT THE VANITY TO EVERY BODY (2026-09-22).

   The stock was drawn on ONE body (pb_avg) and painted onto all five, so a wide body wore a narrow breastplate with
   the tee showing either side, and a slim one wore armour that spilled past its own outline. The owner: "yahsmeena
   looks weird with her vanities. the pixels are bleeding thru".

   Redrawing twenty items on five bodies is a hundred generations. It is not needed: every body is the same skeleton
   in the same pose, drawn on the same canvas — only the WIDTH differs, row by row. So for each facing this measures
   the silhouette of pb_avg and of the target body one row at a time, and maps each vanity pixel across:

       tx = t0 + (x - a0) * (t1 - t0) / (a1 - a0)

   which stretches a garment to the body under it and keeps anything outside the outline — horns, a brim, a spike —
   proportionally outside. Rows where the target has no body (between the legs, above the head) fall back to the
   nearest row that has one, so a helmet still lands on a head that sits a pixel higher.

   Output: pv_<item>_<body>_<facing>.png for every body except avg, which keeps its own unsuffixed files.
   Run after eastscape-vanitybuild.mjs, any time the stock changes.
*/
import sharp from "sharp";
import fs from "fs";

const DIR = "C:/Users/jake/code/eastcoins/v3/assets/img/glad/flat/";
const FACINGS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
const BODIES = ["big", "fat", "slimw", "curvyw"];   // avg is the source; it keeps the plain filenames

const raw = (f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** The four bands of a body, read off its own part map: head, torso, legs, feet. */
function bands(data, W, H) {
  const tee = new Int32Array(H), trou = new Int32Array(H);
  let top = -1, bot = -1;
  for (let n = 0; n < W * H; n++) {
    const i = n * 4; if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2], y = (n / W) | 0;
    if (top < 0) top = y; bot = y;
    if ((g === 0 && r === b && r) || (b === 0 && r === g && r)) tee[y]++;
    else if (r === 0 && b === 0 && g) trou[y]++;
  }
  const MIN = 2;
  const first = (a) => { for (let y = 0; y < H; y++) if (a[y] >= MIN) return y; return -1; };
  const last = (a) => { for (let y = H - 1; y >= 0; y--) if (a[y] >= MIN) return y; return -1; };
  const teeTop = first(tee), teeBot = last(tee);
  let trouTop = first(trou), trouBot = last(trou);
  if (trouTop < 0 || trouTop <= teeTop) { trouTop = teeBot + 1; trouBot = bot; }
  return { top, teeTop, trouTop, footTop: Math.max(trouTop + 1, trouBot - 2), bot };
}
/* Which band each slot belongs to, as [from, to] keys into the object above. */
const BAND = { head: ["top", "teeTop"], body: ["teeTop", "trouTop"], legs: ["trouTop", "footTop"], feet: ["footTop", "bot"] };

/** For each row, where the body starts and ends. null where the body has nothing on that row. */
function spans(data, W, H) {
  const out = new Array(H).fill(null);
  for (let y = 0; y < H; y++) {
    let lo = 1e9, hi = -1;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] >= 128) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (hi >= 0) out[y] = [lo, hi];
  }
  return out;
}
/** The nearest row that has a body on it — so a hat above the scalp still maps by the head's own width. */
function nearest(sp, y) {
  if (sp[y]) return sp[y];
  for (let d = 1; d < sp.length; d++) {
    if (sp[y - d]) return sp[y - d];
    if (sp[y + d]) return sp[y + d];
  }
  return null;
}

const items = [...new Set(fs.readdirSync(DIR)
  .filter((f) => /^pv_[a-z]+_(head|body|legs|feet)_[a-z-]+\.png$/.test(f))
  .map((f) => f.replace(/_[a-z-]+\.png$/, "")))];
if (!items.length) { console.error("no pv_ files found — run eastscape-vanitybuild.mjs first"); process.exit(1); }

let written = 0, bytes = 0;
for (const body of BODIES) {
  for (const d of FACINGS) {
    const a = await raw(`${DIR}pb_avg_${d}.png`);
    const t = await raw(`${DIR}pb_${body}_${d}.png`);
    const W = a.info.width, H = a.info.height;
    if (t.info.width !== W || t.info.height !== H) throw new Error(`${body} ${d}: canvas differs from avg`);
    const A = spans(a.data, W, H), T = spans(t.data, W, H);
    const AB = bands(a.data, W, H), TB = bands(t.data, W, H);

    for (const item of items) {
      const slot = item.split("_")[2];                 // pv_<set>_<slot>
      const [from, to] = BAND[slot] || BAND.body;
      /* VERTICAL FIRST, and per band. Fitting only the width left the helmet where avg's head was, so on a body
         whose head sits a couple of pixels higher the scalp showed above the helm — which is most of what "the
         pixels are bleeding thru" looked like. Each slot is mapped from its own band on avg to the same band on
         the target, so a helm lands on the head and greaves land on the legs however the body is proportioned. */
      const a0y = AB[from], a1y = AB[to], t0y = TB[from], t1y = TB[to];
      const ah = Math.max(1, a1y - a0y), th = Math.max(1, t1y - t0y);
      const src = await raw(`${DIR}${item}_${d}.png`);
      const out = Buffer.alloc(W * H * 4);
      for (let y = 0; y < H; y++) {
        const ty = Math.round(y < a0y ? t0y - (a0y - y) : y > a1y ? t1y + (y - a1y) : t0y + (y - a0y) * (th / ah));
        if (ty < 0 || ty >= H) continue;
        const av = nearest(A, y), tv = nearest(T, ty);
        if (!av || !tv) continue;
        const [a0, a1] = av, [t0, t1] = tv;
        const aw = Math.max(1, a1 - a0), tw = Math.max(1, t1 - t0);
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (!src.data[i + 3]) continue;
          /* STRETCH ONLY WHAT SITS ON THE BODY. A plain proportional map across the whole row scaled the parts that
             hang OUTSIDE the outline too — on the fat body, roughly twice as wide, a horn ten pixels clear of the
             head was flung twenty clear and broke into scattered dots. Inside the silhouette the garment is
             stretched to the body under it; outside it, the pixel keeps its distance from the edge, so a horn, a
             brim or a spike stays its own size and simply travels with the head it is attached to. */
          const tx = Math.round(
            x < a0 ? t0 - (a0 - x)
            : x > a1 ? t1 + (x - a1)
            : t0 + (x - a0) * (tw / aw)
          );
          if (tx < 0 || tx >= W) continue;
          const j = (ty * W + tx) * 4;
          if (src.data[i + 2] >= out[j + 2]) { out[j + 2] = src.data[i + 2]; out[j + 3] = 255; }
        }
      }
      /* a stretch can leave single-pixel gaps: fill one only when both neighbours are set */
      for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
        const j = (y * W + x) * 4;
        if (out[j + 3]) continue;
        const l = out[j - 4 + 3], r = out[j + 4 + 3];
        if (l && r) { out[j + 2] = Math.round((out[j - 4 + 2] + out[j + 4 + 2]) / 2); out[j + 3] = 255; }
      }
      for (let x = 0; x < W; x++) for (let y = 1; y < H - 1; y++) {
        const j = (y * W + x) * 4;
        if (out[j + 3]) continue;
        const u = out[j - W * 4 + 3], dn = out[j + W * 4 + 3];
        if (u && dn) { out[j + 2] = Math.round((out[j - W * 4 + 2] + out[j + W * 4 + 2]) / 2); out[j + 3] = 255; }
      }
      const f = `${DIR}${item}_${body}_${d}.png`;
      await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(f);
      written++; bytes += fs.statSync(f).size;
    }
  }
  console.log(`${body.padEnd(7)} ${items.length} items x ${FACINGS.length} facings`);
}
console.log(`\n${written} files, ${(bytes / 1024).toFixed(1)} KB (${(bytes / written).toFixed(0)} bytes each)`);

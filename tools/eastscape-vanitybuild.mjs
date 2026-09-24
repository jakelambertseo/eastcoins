/* VANITY PARTS BUILDER (2026-09-21). One PixelLab character STATE -> four recolourable part maps per facing.

   Ronde Barber's stock is drawn as a state of the SAME base body the player looks are built from
   (52565623..., "Base body A (keyed)"), with every garment in BRIGHT BLUE. Because it is a state, the body
   underneath is pixel-identical to pb_avg_*, so a hat sits on the head in all eight facings without any nudging —
   that alignment is the whole reason for using a state rather than a fresh character.

   ONE STATE BECOMES FOUR ITEMS. Asking for a helmet, a chest piece, trousers and boots in one drawing and then
   splitting by Y costs one generation instead of four, which matters: the PixelLab plan's generations are spent
   and this bills to credits. The bands are read from the BASE body's own regions for that same facing — tee top,
   trouser top, trouser bottom — never from fixed numbers, because each facing sits differently on the canvas.

   BOOTS CLIMB THE SHIN. Below the trousers there are about four pixels of foot, which reads as nothing. The feet
   band deliberately starts two rows INTO the trousers, so a boot gets six or seven and can be seen.

   Output: v3/assets/img/glad/flat/pv_<set>_<slot>_<facing>.png, encoded (0,0,v) exactly like ph_<hair>_* — v is
   the pixel's own lightness, so paintLook's repaint keeps the drawing's shading.

   ONE PIECE PER STATE IS THE BETTER WAY, and it is what the shipped art uses. Asking for four garments in one
   drawing spread the model's attention: the pieces came out mushy, and worse, the top edge of the shoulder pads
   landed on the wrong side of the head/body boundary and left a red bar across the chest in three facings. Asked
   for a helmet ALONE the model draws a facemask and a chin strap, and there is nothing to bleed. The other three
   slots of such a state are stray noise and must be thrown away, which is what the <set>:<slot>= form does.

   Usage: node tools/eastscape-vanitybuild.mjs <set>=<id>          all four slots from one drawing (the old way)
          node tools/eastscape-vanitybuild.mjs <set>:<slot>=<id>   only that slot, the rest discarded
*/
import sharp from "sharp";
import fs from "fs";

const PROJECT = "https://backblaze.pixellab.ai/file/pixellab-characters/4e81aa0e-6201-484d-a0fb-c1ae89736d11";
const BASE = "52565623-d08c-4bfe-89bb-9684882b0c76";   // Base body A (keyed) — the body every look is built on
const OUT = "C:/Users/jake/code/eastcoins/v3/assets/img/glad/flat/";
const DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
const SLOTS = ["head", "body", "legs", "feet"];

const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255]; };
/* the same classifier lookbuild uses, so "blue" means here what it means there */
const hueOf = (r, g, b) => { const [h, s, v] = hsv(r, g, b); if ((h <= 40 || h >= 345) && s >= 0.12 && s < 0.28 && v >= 0.5) return "skin"; if (s < 0.28 || v < 0.16) return null; if (h >= 280 && h <= 345) return "top"; if (h >= 80 && h < 195) return "green"; if (h >= 195 && h <= 262) return "blue"; if ((h <= 40 || h >= 350) && s < 0.75) return "skin"; return null; };

fs.mkdirSync("lt", { recursive: true });
const get = async (id, d) => {
  const f = `lt/${id.slice(0, 6)}_${d}.png`;
  if (!fs.existsSync(f)) { const r = await fetch(`${PROJECT}/${id}/rotations/${d}.png`); if (!r.ok) throw new Error(`${id} ${d} ${r.status}`); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
  return sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
};

/** Where the body's parts sit in THIS facing, read from the FINISHED part map pb_avg_<facing>.png.
    Read, not guessed: that file already encodes every region exactly — tee (v,0,v), trousers (0,v,0) — so there is
    nothing to classify. Hue-guessing it off the raw art is what flooded south-east and south-west on the first run:
    a blue-ish shading pixel high on the arm was taken for a trouser, which dragged the trouser band up over the
    chest and painted the whole torso as legs. */
function bandsOf(data, W, H) {
  const tee = new Int32Array(H), trou = new Int32Array(H);
  let bot = -1;
  for (let n = 0; n < W * H; n++) {
    const i = n * 4; if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2], y = (n / W) | 0;
    if (y > bot) bot = y;
    if (g === 0 && r === b && r) tee[y]++;               // tee (v,0,v)
    else if (b === 0 && r === g && r) tee[y]++;          // its chest stripe (v,v,0)
    else if (r === 0 && b === 0 && g) trou[y]++;         // trousers (0,v,0)
  }
  /* A ROW OF ONE PIXEL IS NOT A BAND EDGE. south-east carries a single stray trouser-coded pixel at y=21 — a key
     colour that leaked onto the chest when the body was built — and taking it at face value dragged the trouser
     band 21 rows up and painted the whole torso as legs. Two pixels in a row is the difference between a garment
     and a speck; the real bands are 4-10 pixels wide. */
  const MIN = 2;
  const first = (a) => { for (let y = 0; y < H; y++) if (a[y] >= MIN) return y; return -1; };
  const last = (a) => { for (let y = H - 1; y >= 0; y--) if (a[y] >= MIN) return y; return -1; };
  const teeTop = first(tee), teeBot = last(tee);
  let trouTop = first(trou), trouBot = last(trou);
  if (teeTop < 0) throw new Error("no tee found in the base part map");
  if (trouTop < 0 || trouTop <= teeTop) { trouTop = teeBot + 1; trouBot = bot; }   // and trousers are always BELOW the tee
  return { teeTop, trouTop, trouBot, bot, footTop: Math.max(trouTop + 1, trouBot - 2) };
}

const slotOf = (y, b) => (y < b.teeTop ? "head" : y < b.trouTop ? "body" : y < b.footTop ? "legs" : "feet");

let files = 0, bytes = 0;
const jobs = process.argv.slice(2).map((a) => a.split("="));
if (!jobs.length) { console.error("usage: node tools/eastscape-vanitybuild.mjs <set>=<characterId> [...]"); process.exit(1); }

for (const [spec, id] of jobs) {
  const [set, only] = spec.split(":");
  if (only && !SLOTS.includes(only)) throw new Error(`${spec}: slot must be one of ${SLOTS.join(", ")}`);
  const want = only ? [only] : SLOTS;
  const tally = { head: 0, body: 0, legs: 0, feet: 0 };
  for (const d of DIRS) {
    const base = await sharp(`${OUT}pb_avg_${d}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const st = await get(id, d);
    const W = st.info.width, H = st.info.height;
    if (base.info.width !== W || base.info.height !== H) throw new Error(`${set} ${d}: canvas ${W}x${H} vs base ${base.info.width}x${base.info.height}`);
    const b = bandsOf(base.data, W, H), data = st.data;

    /* every blue pixel the state added */
    const is = new Uint8Array(W * H);
    for (let n = 0; n < W * H; n++) { const i = n * 4; if (data[i + 3] >= 128 && hueOf(data[i], data[i + 1], data[i + 2]) === "blue") is[n] = 1; }

    /* blobs of 8+ only: a stray blue speck is shading the classifier misread, or an eye */
    const seen = new Uint8Array(W * H), keep = new Uint8Array(W * H);
    for (let n = 0; n < W * H; n++) {
      if (!is[n] || seen[n]) continue;
      const blob = [n]; seen[n] = 1;
      for (let q = 0; q < blob.length; q++) { const c = blob[q], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const xx = x + dx, yy = y + dy, m = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < H && is[m] && !seen[m]) { seen[m] = 1; blob.push(m); } } }
      if (blob.length >= 8) for (const c of blob) keep[c] = 1;
    }

    /* split into slots, each normalised against its OWN brightest pixel so every piece keeps a full range of shading */
    const pix = { head: [], body: [], legs: [], feet: [] }, vmax = { head: 1, body: 1, legs: 1, feet: 1 };
    for (let n = 0; n < W * H; n++) {
      if (!keep[n]) continue;
      const i = n * 4, s = slotOf((n / W) | 0, b), v = Math.max(data[i], data[i + 1], data[i + 2]);
      pix[s].push([n, v]); vmax[s] = Math.max(vmax[s], v);
    }
    for (const s of want) {
      const out = Buffer.alloc(W * H * 4);
      for (const [n, v] of pix[s]) { out[n * 4 + 2] = Math.max(90, Math.round((v / vmax[s]) * 255)); out[n * 4 + 3] = 255; }
      tally[s] += pix[s].length;
      const f = `${OUT}pv_${set}_${s}_${d}.png`;
      await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(f);
      files++; bytes += fs.statSync(f).size;
    }
  }
  console.log(`${set.padEnd(11)} ${SLOTS.map((s) => `${s}:${String(tally[s]).padStart(4)}px`).join("  ")}`);
}
console.log(`\n${files} files, ${(bytes / 1024).toFixed(1)} KB total (${(bytes / files).toFixed(0)} bytes each)`);

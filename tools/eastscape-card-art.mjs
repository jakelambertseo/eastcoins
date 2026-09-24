/* The EastScape card on the casino floor —  node tools/eastscape-card-art.mjs "<source image>"
   The upload is a rounded card already sitting on a black background, so unlike build-cards.mjs there is no title band to
   find: the whole job is to throw away the black, drop the rounded corners with it, and cover-crop what is left to the 3:4
   the floor draws. The crop is taken from the TOP rather than the middle, because the bottom quarter of this picture is
   empty cloud and the casino itself sits high. 540x720 is the same size every other card is built at (four across a desktop
   is about 260px, so 540 is two of those). */
import sharp from "sharp";

const src = process.argv[2];
if (!src) { console.error("give me the source image"); process.exit(1); }
const OUT = "v3/assets/img/casino/eastscape.webp";

const img = sharp(src);
const meta = await img.metadata();
const raw = await img.clone().ensureAlpha().raw().toBuffer();
const { width: W, height: H } = meta;

/* Where does the black border stop? A row or column is "black" while every pixel in it is near-black; the card's own art is
   nowhere near, so this needs no threshold fiddling. The rounded corners mean the first non-black row is narrower than the
   card — which is why the box is then pulled IN by the corner radius on all four sides below. */
const dark = (x, y) => { const i = (y * W + x) * 4; return raw[i] < 26 && raw[i + 1] < 26 && raw[i + 2] < 26; };
const rowBlack = (y) => { for (let x = 0; x < W; x += 2) if (!dark(x, y)) return false; return true; };
const colBlack = (x) => { for (let y = 0; y < H; y += 2) if (!dark(x, y)) return false; return true; };
let y0 = 0, y1 = H - 1, x0 = 0, x1 = W - 1;
while (y0 < y1 && rowBlack(y0)) y0++;
while (y1 > y0 && rowBlack(y1)) y1--;
while (x0 < x1 && colBlack(x0)) x0++;
while (x1 > x0 && colBlack(x1)) x1--;
/* the corner radius, measured: how far in from the left edge the TOP row of the card actually starts drawing */
let r = 0; while (r < 200 && dark(x0 + r, y0)) r++;
x0 += r; x1 -= r; y0 += r; y1 -= r;
const w = x1 - x0 + 1, h = y1 - y0 + 1;
console.log(`source ${W}x${H} -> card ${w}x${h} at ${x0},${y0} (corner ${r}px)`);

/* cover-crop to 3:4. This picture is taller than 3:4, so height is what goes; a third of the loss comes off the top and two
   thirds off the bottom, which keeps the CASINO sign centred and drops the empty cloud. */
const want = 3 / 4;
let cw = w, ch = Math.round(w / want), cx = x0, cy = y0;
if (ch > h) { ch = h; cw = Math.round(h * want); cx = x0 + Math.round((w - cw) / 2); }
else cy = y0 + Math.round((h - ch) / 3);
console.log(`crop ${cw}x${ch} at ${cx},${cy}`);

await sharp(src).extract({ left: cx, top: cy, width: cw, height: ch }).resize(540, 720, { fit: "cover", kernel: "mitchell" })
  .webp({ quality: 62, effort: 6 }).toFile(OUT);
const { size } = await sharp(OUT).metadata().then(async (m) => ({ ...m, size: (await import("node:fs")).statSync(OUT).size }));
console.log(`${OUT}  ${(size / 1024).toFixed(1)} KB`);

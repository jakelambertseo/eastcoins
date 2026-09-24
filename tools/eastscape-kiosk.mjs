// BOM TRADY'S KIOSK, v2 (the owner, with a sketch: two straight sides, one straight front, him in the middle). The v1 kiosk was
// PixelLab's angled counter blocks stacked up, which could never line up. This one DRAWS the counters: one black U seen from the
// front (top face + front face), LED strips along every edge, three lit cases in the front, and Bom standing inside it.
// Same canvas as v1 (160 x 184, the bottom 96 px is the 5x3 footprint), so nothing in the game moves.
import sharp from "sharp";
const OLD = "C:/Users/jake/AppData/Local/Temp/claude/C--Users-jake-code-eastcoins/f5b2f236-14f6-4dca-8941-8b53f8ec57d3/scratchpad/";
const OUT = "C:/Users/jake/AppData/Local/Temp/claude/C--Users-jake-code-eastcoins/42c7e72d-41ad-42db-a295-e80c1c85afef/scratchpad/";
const W = 160, H = 184, px = Buffer.alloc(W * H * 4);
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function rect(x0, y0, x1, y1, c, a = 255) { const [r, g, b] = hex(c); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = (y * W + x) * 4, k = a / 255, ia = px[i + 3] / 255; px[i] = Math.round(r * k + px[i] * (1 - k)); px[i + 1] = Math.round(g * k + px[i + 1] * (1 - k)); px[i + 2] = Math.round(b * k + px[i + 2] * (1 - k)); px[i + 3] = Math.round(255 * (k + ia * (1 - k))); } }

// the U, in picture pixels. X0..X1 is the whole width; ARM is how wide a side run is; the counter stands CH tall.
const X0 = 4, X1 = 156, ARM = 22, CH = 26;
const BACK = 78;                 // where the side runs' top faces start (their far end)
const FT = 134, FB = 156;        // the front run's top face: FT..FB; its front face: FB..FB+CH
const BOT = FB + CH;             // 182: the floor line
const TOP = "#1b1c27", TOP_HI = "#272938", FACE = "#0f1017", FACE_LO = "#090a0f", EDGE = "#05060a", LED = "#46f2e4", LED_DIM = "#1c8f8c";

// the floor inside the U, darkened, so the three runs read as one booth
rect(X0 + ARM, BACK + CH, X1 - ARM, FB, "#000000", 70);
// a soft shadow on the floor around the outside
rect(X0 - 2, BOT - 2, X1 + 2, BOT + 2, "#000000", 60);

const layers = [];   // [what, fn] drawn in order; Bom goes between the side runs and the front run
function topFace(x0, y0, x1, y1) { rect(x0, y0, x1, y1, TOP); rect(x0 + 2, y0 + 2, x1 - 2, y0 + 3, TOP_HI); }
// side runs: a top face each, and the little bit of their outer wall the front run doesn't hide is nothing (it joins the front)
function sides() {
  for (const x0 of [X0, X1 - ARM]) {
    rect(x0, BACK, x0 + ARM, FT, TOP);                                  // top face
    rect(x0 + 3, BACK + 3, x0 + ARM - 3, FT, TOP_HI, 90);               // a worn sheen down the middle
    rect(x0, BACK, x0 + ARM, BACK + 1, EDGE);                           // far end
  }
  // the inner walls of the side runs can't be seen from the front, but the far END walls of nothing can either; what can be
  // seen is the inside FRONT of each side run's far end? no: keep it clean. LEDs: one line down each long edge.
  for (const x of [X0, X0 + ARM - 1, X1 - ARM, X1 - 1]) { rect(x, BACK, x + 1, FT, LED); }
  for (const x of [X0 + 1, X0 + ARM - 2, X1 - ARM + 1, X1 - 2]) { rect(x, BACK, x + 1, FT, LED_DIM, 150); }
  rect(X0, BACK, X0 + ARM, BACK + 1, LED); rect(X1 - ARM, BACK, X1, BACK + 1, LED);   // across each far end
}
function front() {
  rect(X0, FT, X1, FB, TOP);                                            // top face, the full width: it closes the U
  rect(X0 + 3, FT + 4, X1 - 3, FT + 5, TOP_HI);
  // LEDs round the top: the outer edges run on from the side runs; the inner edge crosses between them; the front lip is lit
  rect(X0, FT, X0 + 1, FB, LED); rect(X1 - 1, FT, X1, FB, LED);
  rect(X0 + 1, FT, X0 + 2, FB, LED_DIM, 150); rect(X1 - 2, FT, X1 - 1, FB, LED_DIM, 150);
  rect(X0 + ARM - 1, FT, X1 - ARM + 1, FT + 1, LED); rect(X0 + ARM - 1, FT + 1, X1 - ARM + 1, FT + 2, LED_DIM, 150);
  // front face
  rect(X0, FB, X1, BOT, FACE); rect(X0, BOT - 3, X1, BOT, FACE_LO);
  rect(X0, FB, X1, FB + 1, LED); rect(X0, FB + 1, X1, FB + 2, LED_DIM, 170);            // the lit lip
  rect(X0, FB, X0 + 1, BOT, EDGE); rect(X1 - 1, FB, X1, BOT, EDGE);
  rect(X0 + 1, BOT - 4, X1 - 1, BOT - 3, LED_DIM);                                       // a toe-kick strip
}
sides();
// Bom, standing inside, his feet on the floor just behind the front run
const tom = await sharp(OLD + (process.env.BOM || "bomA_final.png")).trim().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
function blit(img, left, top, clipBottom = H) { const { width: w, height: h } = img.info; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * 4; if (img.data[s + 3] < 128) continue; const X = left + x, Y = top + y; if (X < 0 || Y < 0 || X >= W || Y >= clipBottom) continue; const d = (Y * W + X) * 4; px[d] = img.data[s]; px[d + 1] = img.data[s + 1]; px[d + 2] = img.data[s + 2]; px[d + 3] = 255; } }
const feet = FT + 10;   // his feet are on the floor behind the counter; the counter's top hides him from FT down
blit(tom, Math.round(80 - tom.info.width / 2), feet - tom.info.height, FT);
front();
/* THINGS ON THE COUNTERS (the owner: "add some slight artifacts on bom tradys counters"): a few small prizes left out on the black
   tops, each with a soft shadow and a glint of the LED on it. Small on purpose: the straight lines are still the point. */
const PAL = { g: "#f2c94c", G: "#b8892a", y: "#fff1a8", b: "#7a4a24", B: "#4a2a12", w: "#f4f4f0", r: "#d8343c", R: "#8a1a24", n: "#24346a", N: "#141c3e", p: "#ff7aa8", P: "#b83a6a", s: "#c8ccd6", S: "#7a7f8c", c: "#46f2e4", k: "#05060a" };
function item(x, y, rows) { const h = rows.length, w = Math.max(...rows.map((r) => r.length)); rect(x, y + h - 1, x + w + 1, y + h + 1, "#000000", 110); rows.forEach((row, j) => [...row].forEach((ch, i) => { if (PAL[ch]) rect(x + i, y + j, x + i + 1, y + j + 1, PAL[ch]); })); }
const TROPHY = [" gyg ", "ggggg", "GgggG", " ggg ", "  g  ", "  G  ", " GGG ", "kkkkk"];
const BALL = ["  bbbb  ", " bbwwbb ", "bbwbbwbb", " BbwwbB ", "  BBBB  "];
const CHIPS = [" rwr  ", " RRR  ", " wrw nwn", " RRR NNN", " rwr nwn", " RRR NNN"];
const RINGBOX = ["nnnnnn", "nNgyNn", "nNGgNn", "NNNNNN"];
const TICKETS = [" pppp ", "pPwwPp", "pPwwPp", " PPPP "];
const HELMET = [" ssss ", "sssssw", "snnsSS", "sssS  ", " SS   "];
const COINS = ["  gy  ", " gggG ", "gygggG", "GGGGGG"];
item(X0 + 8, BACK + 10, TROPHY); item(X0 + 7, BACK + 32, CHIPS);                       // the left run
item(X1 - ARM + 7, BACK + 12, BALL); item(X1 - ARM + 8, BACK + 34, RINGBOX);          // the right run
item(X0 + 30, FT + 9, TICKETS); item(X0 + 8, FT + 8, HELMET); item(X1 - 40, FT + 10, COINS); item(X1 - 18, FT + 6, TROPHY.slice(0, 8));   // the front
// three lit cases in the front face, one shelf of PixelLab's straight-on case in each (the things on them are the prizes)
const caseB = await sharp(OLD + "raw_ledB.png").trim().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const ROWS = [[7, 19], [20, 31], [32, 45]], CX0 = 5, CX1 = 40;   // the three shelves inside that case, and the glass's left/right
const winW = CX1 - CX0, gap = Math.floor((X1 - X0 - 3 * winW) / 4);
ROWS.forEach(([r0, r1], k) => {
  const wx = X0 + gap + k * (winW + gap), wh = r1 - r0, wy = FB + 4 + Math.floor((CH - 9 - wh) / 2);
  rect(wx - 2, wy - 2, wx + winW + 2, wy + wh + 2, EDGE); rect(wx - 1, wy - 1, wx + winW + 1, wy + wh + 1, LED);   // an LED frame round the glass
  const crop = { info: { width: winW, height: wh }, data: Buffer.alloc(winW * wh * 4) };
  for (let y = 0; y < wh; y++) for (let x = 0; x < winW; x++) { const s = ((r0 + y) * caseB.info.width + CX0 + x) * 4, d = (y * winW + x) * 4; caseB.data.copy(crop.data, d, s, s + 4); crop.data[d + 3] = 255; }
  blit(crop, wx, wy);
});

const png = await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toBuffer();
await sharp(png).toFile(OUT + "kiosk2_raw.png");
await sharp({ create: { width: W, height: H, channels: 4, background: "#3a1420" } }).composite([{ input: png }]).png().toBuffer().then((b) => sharp(b).resize(W * 4, H * 4, { kernel: "nearest" }).toFile(OUT + "kiosk2_view.png"));
console.log("ok", png.length);

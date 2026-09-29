/* BRONNY THE FOREMAN'S ART —  node tools/eastscape-bronny-art.mjs <dir with br_south-east.png and br_east.png from PixelLab>
   (2026-09-28, the owner: "make him a black guy and name him Bronny", in Nestor's style, facing east.) PixelLab's pro mode, given Nestor as
   its style reference, drew Bronny in seven directions and NESTOR HIMSELF facing south, so his "south" here is his south-east turn: he
   stands facing east on the map (face: "east") and the south picture is only the conversation portrait and the headshot.
   The notes below are from his first draw, as Gus, and still hold:
   (2026-09-28) PixelLab drew him twice: at 68px he stood 64 tall against the Yard's 48-51 (Nestor, Livia, Charon), so he was redrawn at
   52 (a 48-tall figure), and that one is placed on the NPCs' 68x68 frame with his feet on the same line as theirs (row 56), centred.
   Nothing is scaled: pixel art at a fractional scale goes blotchy. His headshot for the order window (ui/gus_face.png, 62x62) is the
   bigger drawing's head and shoulders, cut at 31x31 and doubled, which IS a whole-number scale. */
import sharp from "sharp";
const src = process.argv[2], out = "v3/assets/img/glad/flat/";
const bb = async (f) => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let x0 = 1e9, x1 = 0, y0 = 1e9, y1 = 0; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };
for (const [d, from] of [["south", "south-east"], ["east", "east"]]) {
  const f = `${src}/br_${from}.png`, b = await bb(f), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const piece = await sharp(f).extract({ left: b.x0, top: b.y0, width: w, height: h }).toBuffer();
  await sharp({ create: { width: 68, height: 68, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: piece, left: Math.round(34 - w / 2), top: 57 - h }]).png().toFile(`${out}bronny_${d}.png`);
  console.log(`bronny_${d}.png  figure ${w}x${h}`);
}
const big = `${src}/br_south-east.png`, b = await bb(big), cx = Math.round((b.x0 + b.x1) / 2);
await sharp(big).extract({ left: Math.max(0, cx - 15), top: Math.max(0, b.y0), width: 31, height: 31 }).resize(62, 62, { kernel: "nearest" }).png().toFile(`${out}ui/bronny_face.png`);
console.log("ui/bronny_face.png 62x62");

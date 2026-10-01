/* THRILL HILL'S PIECES (2026-10-01, v1.1) —  node tools/eastscape-thrill-art.mjs
   Every piece is PixelLab (the drafts in tools/thrill/art/, ids in ids.txt; tools/agilitymap-mock/art/ for featherwood and the seam),
   trimmed, scaled to sit beside the game's own art (a mid monster ~70-90 px, a boss ~180, a tile 32), and written to flat/:
     th_*            the stunts and the props (lt-wild/thrill-gen.py places them)
     th_barh<n> / th_barv<n>   crash-barrier runs, 1-4 tiles, east-west and north-south, tiled from the one barrier draft
     th_oil1/2       oil slicks, drawn here: flat decor you walk over
     gremlin, hellbiker, crusher (+ _i2 _w1-4 _a1-4)   the monsters. A map object has no walk cycle, so the frames are made here from the
                     one picture: a squash-and-stretch bob for walking, a lean into the swing for attacking. registerArt() anchors a frame on
                     its drawn feet and middle, so a frame has to CHANGE SHAPE to read as motion; moving it inside its canvas does nothing.
     pet_lilcrusher, o_featherwood, o_chromeseam, th_gate */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const ROOT = "C:/Users/jake/code/eastcoins/", SRC = ROOT + "tools/thrill/art/", MOCK = ROOT + "tools/agilitymap-mock/art/", FLAT = ROOT + "v3/assets/img/glad/flat/";
const trimmed = async (f) => sharp(await sharp(f).ensureAlpha().trim({ threshold: 1 }).png().toBuffer());
async function put(name, file, scale = 1, fn) {
  let im = await trimmed(file); const m = await im.metadata();
  if (scale !== 1) im = im.resize(Math.round(m.width * scale), Math.round(m.height * scale), { kernel: "nearest" });
  let buf = await im.png().toBuffer();
  if (fn) buf = await fn(buf);
  await sharp(buf).png({ palette: true, colours: 128 }).toFile(FLAT + name + ".png");
  return buf;
}
const P = {
  th_tyres: ["tyres", 1.4], th_tyrewall: ["tyres", 2.4], th_ropeswing: ["ropeswing", 1], th_highwire: ["highwire", 1], th_ramp: ["ramp", 1], th_hoop: ["hoop", 1.5], th_plank: ["plank", 1], th_cars: ["cars", 1], th_net: ["net", 1], th_firebarrels: ["firebarrels", 1],
  th_tyreswing: ["tyreswing", 1], th_halfpipe: ["halfpipe", 1], th_buses: ["buses", 1], th_firewall: ["firewall", 1], th_cannon: ["cannon", 1], th_zipline: ["zipline", 1.3],
  th_grandstand: ["grandstand", 1.1], th_scoreboard: ["scoreboard", 1], th_truck: ["truck", 1.15], th_landing: ["landing", 1], th_gate: ["gate", 0.8], pet_lilcrusher: ["pet", 0.9],
  /* (2026-10-01) the front door in the court, and the hill's snack cart, bins and Eddie's window */ th_counter: ["counter", 1], th_snackcart: ["snackcart", 1], th_trash: ["trashcan", 0.9], th_booth: ["booth", 0.85] };
const have = [];
for (const [name, [src, sc]] of Object.entries(P)) {
  if (!fs.existsSync(SRC + src + ".png")) { console.log(`  waiting on ${src}.png`); continue; }
  await put(name, SRC + src + ".png", sc); have.push(name);
}
await put("o_featherwood", MOCK + "featherwood.png", 1.4); have.push("o_featherwood");
/* the seam: the mockup's skystone turned to chrome (grey-blue to bright steel) */
await put("o_chromeseam", MOCK + "skystone.png", 1, async (buf) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 8) continue; const L = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2], v = Math.min(255, Math.round(40 + L * 1.05)); data[i] = v; data[i + 1] = Math.min(255, v + 4); data[i + 2] = Math.min(255, v + 14); }
  return sharp(data, { raw: info }).png().toBuffer();
}); have.push("o_chromeseam");

/* one burning barrel, cut from the row of three */
{ const b = await (await trimmed(SRC + "firebarrels.png")).png().toBuffer(), m = await sharp(b).metadata(), w = Math.floor(m.width / 3);
  await sharp(b).extract({ left: 0, top: 0, width: w + 1, height: m.height }).trim({ threshold: 1 }).png({ palette: true }).toFile(FLAT + "th_flamebarrel.png"); have.push("th_flamebarrel"); }
/* THE GROUND: an arena of packed red dirt, t_dirt recoloured the way the Carnival made sawdust (the Wang geometry untouched), and the nitro
   pool's water a fizzing green */
const recol = async (from, to, dark, light, wdark, wlight) => {
  const { data, info } = await sharp(FLAT + from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue; const r = data[i], g = data[i + 1], b = data[i + 2], L = (0.299 * r + 0.587 * g + 0.114 * b);
    if (g > r && g > b) { const t = Math.min(1, L / 190); for (let k = 0; k < 3; k++) data[i + k] = Math.round(dark[k] + (light[k] - dark[k]) * t); }
    else if (wdark && b > r + 12) { const t = Math.min(1, L / 200); for (let k = 0; k < 3; k++) data[i + k] = Math.round(wdark[k] + (wlight[k] - wdark[k]) * t); }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 48 }).toFile(FLAT + to);
  have.push(to.replace(".png", ""));
};
await recol("t_dirt.png", "t_arena.png", [96, 60, 38], [198, 142, 92]);
await recol("t_water.png", "t_nwater.png", [96, 60, 38], [198, 142, 92], [20, 60, 40], [120, 230, 140]);

/* the court's dirt pad: an oval of the arena's own dirt with a ragged edge and tyre marks, laid flat under the front door (9 x 4 tiles) */
{ const tile = await sharp(FLAT + "t_arena.png").extract({ left: 64, top: 32, width: 32, height: 32 }).ensureAlpha().raw().toBuffer();
  const w = 9 * 32, h = 4 * 32, out = Buffer.alloc(w * h * 4), cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = Math.atan2(y - cy, x - cx), r = Math.hypot((x - cx) / (w / 2 - 2), (y - cy) / (h / 2 - 2)) / (1 + 0.06 * Math.sin(a * 5) + 0.04 * Math.sin(a * 11 + 1));
    if (r > 1) continue; const i = (y * w + x) * 4, t = ((y % 32) * 32 + (x % 32)) * 4, skid = (ax, ay, R) => { const d = Math.hypot(x - ax, (y - ay) * 1.6) - R; return Math.abs(d) < 1.3 || Math.abs(d - 7) < 1.3; },   /* a tyre pair: two lines 7 px apart on a wide arc */
      mark = r < 0.88 && (skid(w * 0.32, h * 1.4, 150) || skid(w * 0.75, -h * 0.5, 160));
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(tile[t + c] * (mark ? 0.72 : 1));
    out[i + 3] = r > 0.92 ? Math.round(255 * (1 - r) / 0.08) : 255;
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png({ palette: true, colours: 64 }).toFile(FLAT + "th_dirtpad.png"); have.push("th_dirtpad"); }

/* the NPCs: south and east from PixelLab (tools/thrill/art/chars.txt), trimmed and brought down to the guild's size */
for (const [name] of [["fasteddie"], ["vendor"]]) for (const d of ["south", "east"]) {
  const f = SRC + `${name === "fasteddie" ? "eddie" : name}_${d}.png`; if (!fs.existsSync(f)) { console.log(`  waiting on ${name} ${d}`); continue; }
  const b = await sharp(f).trim({ threshold: 1 }).toBuffer(), m = await sharp(b).metadata();
  await sharp(b).resize(Math.round(m.width * 0.88), Math.round(m.height * 0.88), { kernel: "nearest" }).png({ palette: true }).toFile(FLAT + `${name}_${d}.png`); have.push(`${name}_${d}`);
}
/* Dizzy Dale stands in the Yard, so he is drawn the Yard's way (the owner: "not in the same style as the other npcs in the yard, and not the
   same size"): standard-mode PixelLab at 48, kept on its own 68 px canvas untouched like Livia, Nestor and Bronny, with a north facing */
for (const d of ["south", "east", "north"]) { const f = SRC + `dale_${d}.png`; if (fs.existsSync(f)) { fs.copyFileSync(f, FLAT + `tickettaker_${d}.png`); have.push(`tickettaker_${d}`); } else console.log(`  waiting on dale ${d}`); }

/* crash barriers: one tile is the draft at 32 wide; a run is tiles side by side; north-south is the same tile turned */
const tile = await (await trimmed(SRC + "barrier.png")).resize(32, 20, { kernel: "nearest" }).png().toBuffer();
const tileV = await sharp(tile).rotate(90).png().toBuffer();   /* 20 x 32 */
for (let n = 1; n <= 4; n++) {
  await sharp({ create: { width: 32 * n, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([...Array(n)].map((_, i) => ({ input: tile, left: 32 * i, top: 0 }))).png({ palette: true }).toFile(FLAT + `th_barh${n}.png`);
  await sharp({ create: { width: 20, height: 32 * n, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([...Array(n)].map((_, i) => ({ input: tileV, left: 0, top: 32 * i }))).png({ palette: true }).toFile(FLAT + `th_barv${n}.png`);
  have.push(`th_barh${n}`, `th_barv${n}`);
}
/* oil slicks: a dark wobbling puddle with a rainbow sheen */
for (const [n, w, h, seed] of [[1, 44, 26, 1.3], [2, 34, 20, 3.1]]) {
  const out = Buffer.alloc(w * h * 4), cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / (w / 2 - 1), dy = (y - cy) / (h / 2 - 1), a = Math.atan2(dy, dx), r = Math.hypot(dx, dy) / (1 + 0.12 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 5 + seed * 2));
    if (r > 1) continue; const i = (y * w + x) * 4, sheen = r > 0.45 && r < 0.62 && Math.sin(a * 2 + seed) > 0.2;
    const c = sheen ? [[120, 70, 160], [60, 140, 150], [170, 150, 70]][Math.floor(((a + Math.PI) / (2 * Math.PI)) * 3) % 3] : [22, 20, 26];
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = r > 0.9 ? 150 : 215;
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(FLAT + `th_oil${n}.png`); have.push(`th_oil${n}`);
}

/* the monsters and their frames */
async function frames(name, src, scale) {
  const base = await put(name, SRC + src + ".png", scale); const { width: W, height: H } = await sharp(base).metadata();
  const shape = async (out, sx, sy, shear) => {
    let im = sharp(base).resize(Math.max(1, Math.round(W * sx)), Math.max(1, Math.round(H * sy)), { kernel: "nearest", fit: "fill" });
    if (shear) im = sharp(await im.png().toBuffer()).affine([[1, shear], [0, 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: "nearest" });
    await sharp(await im.png().toBuffer()).trim({ threshold: 1 }).png({ palette: true, colours: 128 }).toFile(FLAT + `${name}_${out}.png`);
  };
  await shape("i2", 1.02, 0.97, 0);
  await shape("w1", 1.03, 0.95, -0.05); await shape("w2", 0.99, 1.02, 0); await shape("w3", 1.03, 0.95, 0.05); await shape("w4", 0.99, 1.02, 0);
  await shape("a1", 0.97, 1.03, -0.08); await shape("a2", 1.05, 0.96, 0.12); await shape("a3", 1.08, 0.93, 0.18); await shape("a4", 1.0, 1.0, 0.04);
  have.push(name, ...["i2", "w1", "w2", "w3", "w4", "a1", "a2", "a3", "a4"].map((f) => `${name}_${f}`));
}
await frames("gremlin", "gremlin", 1.1);
await frames("hellbiker", "hellbiker", 1.6);
await frames("crusher", "crusher", 2);
let kb = 0; for (const n of have) kb += fs.statSync(FLAT + n + ".png").size / 1024;
console.log(`${have.length} pieces, ${Math.round(kb)} KB`);
fs.writeFileSync(SRC + "made.json", JSON.stringify(have));

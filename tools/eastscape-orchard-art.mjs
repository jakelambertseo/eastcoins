/* EastScape: THE ORCHARD WALL's art, cut from Rafael Matos's "ERW - Grass Land 2.0"  —  node tools/eastscape-orchard-art.mjs
   The pack is paid and local (lt-wild/erw/grass), never committed; only what this writes into flat/ is. The ground is a picture composed
   by lt-wild/compose-rects.mjs from the pack's mockups (orchard_bg1 / orchard_bg2). This cuts the MONSTERS from the pack's strips (one
   row of 256px cells, every frame of one monster to ONE shared box): the Orchard Orc (the orc mage), the Orchard Keeper (the orc
   warrior), the Hedge Thing (the warrior again, gone green) and the Gardener (the second orc mage, larger); the Wasp is the pack's
   mosquito at four times its size; Pomona is the pack's vendor; the trees are its pines. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const PK = path.join(ROOT, "lt-wild/erw/grass/ERW - Grass Land 2.0 v2.1"), OUT = path.join(ROOT, "v3/assets/img/glad/flat");
const CH = (f) => path.join(PK, "Characters", f), PR = (f) => path.join(PK, "Props/Static props", f), AN = (f) => path.join(PK, "Props/Animated props", f);
const raw = async (f, x, y, w, h) => { let im = sharp(f).ensureAlpha(); if (w) im = im.extract({ left: x, top: y, width: w, height: h }); const { data, info } = await im.raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const put = async (name, im) => { const b = await im.toBuffer(); fs.writeFileSync(path.join(OUT, `${name}.png`), b); const m = await sharp(b).metadata(); console.log(`  ${name.padEnd(22)} ${String(m.width).padStart(4)}x${String(m.height).padEnd(4)} ${Math.round(b.length / 1024)} KB`); };
if (!fs.existsSync(PK)) { console.log(`no pack at ${PK}`); process.exit(1); }
/* a strip of n frames in a row of `cw`-wide cells */
const strip = async (f, n, cw) => { const m = await sharp(f).metadata(), out = []; for (let i = 0; i < n; i++) out.push(await raw(f, i * cw, 0, cw, m.height)); return out; };
const bbox = (fr) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const { d, W, H } of fr) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
const MAGE = (d) => [CH(`orc mage/${d}/orc mage - no hand fx-idle.png`), 8, CH(`orc mage/${d}/orc mage - no hand fx-walk.png`), 8, CH(`orc mage/${d}/orc mage - no hand fx-atk1.png`), 18];
const WARRIOR = [CH("orc warrior/orc1/orc melee - anims-idle.png"), 9, CH("orc warrior/orc1/orc melee - anims-walk.png"), 8, CH("orc warrior/orc1/orc melee - anims-atk1.png"), 16];
/* [name, idle file, n, walk file, n, attack file, n, cell, scale, tint] */
const MOBS = [
  ["orchardorc", ...MAGE("orc1"), 256, 1, null],
  ["orchardkeeper", ...WARRIOR, 256, 1, null],
  ["hedgething", ...WARRIOR, 256, 1.1, { hue: 100, saturation: 1.2 }],
  ["gardener", ...MAGE("orc2"), 256, 1.4, null],
  ["wasp", AN("Insects-mosquito-2 frames-150x106.png"), 2, AN("Insects-mosquito-2 frames-150x106.png"), 2, AN("Insects-mosquito-2 frames-150x106.png"), 2, 150, 4, { hue: 40, saturation: 1.6, brightness: 1.2 }]   /* the two-frame sheet for everything: the flying-around sheet crosses its whole cell, so a shared box was mostly air */
];
for (const [name, idle, ni, walk, nw, atk, na, cw, sc, tint] of MOBS) {
  const I = await strip(idle, ni, cw), Wk = await strip(walk, nw, cw), Ak = await strip(atk, na, cw);
  const pickA = [0, 1, 2, 3].map((i) => Ak[Math.min(na - 1, Math.floor(((i + 0.5) * na) / 4))]);
  const box = bbox([...I, ...Wk, ...pickA]);
  const cut = (fr) => { let im = sharp(fr.d, { raw: { width: fr.W, height: fr.H, channels: 4 } }).extract({ left: box.x0, top: box.y0, width: box.w, height: box.h }).resize(Math.max(1, Math.round(box.w * sc)), Math.max(1, Math.round(box.h * sc)), { kernel: "nearest" }); if (tint) im = im.modulate(tint); return im.png({ compressionLevel: 9 }); };
  await put(name, cut(I[0])); await put(`${name}_i2`, cut(I[Math.floor(ni / 2)]));
  for (let i = 0; i < 4; i++) await put(`${name}_w${i + 1}`, cut(Wk[Math.floor((i * nw) / 4)]));
  for (let i = 0; i < 4; i++) await put(`${name}_a${i + 1}`, cut(pickA[i]));
}
/* Pomona, the pack's vendor, both facings */
{ const I = await strip(CH("vendor-idle.png"), 8, 128), b = bbox([I[0]]);
  const buf = await sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).resize(Math.round(b.w * 1.4), Math.round(b.h * 1.4), { kernel: "nearest" }).png().toBuffer();
  for (const d of ["south", "east"]) await put(`pomona_${d}`, sharp(buf).png({ compressionLevel: 9 })); }
/* the trees at half size (a pine is 128x192): the pine as it is, and the walnut a browner, shorter one */
const half = async (f, mod) => { const t = await sharp(f).ensureAlpha().trim({ threshold: 1 }).png().toBuffer(), m = await sharp(t).metadata(); let im = sharp(t).resize(Math.round(m.width / 2), Math.round(m.height / 2), { kernel: "nearest" }); if (mod) im = im.modulate(mod); return im.png({ compressionLevel: 9 }); };
await put("or_pine", await half(PR("pine-tree-sprites/pine-tree_0.png")));
await put("or_walnut", await half(PR("pine-tree-sprites/pine-tree_3.png"), { hue: -25, saturation: 0.8, brightness: 0.95 }));
console.log("orchard art cut");

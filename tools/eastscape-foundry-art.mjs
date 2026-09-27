/* EastScape: THE FOUNDRY's art, cut from Rafael Matos's "Epic RPG World - Volcano"  —  node tools/eastscape-foundry-art.mjs
   The pack is paid and local (lt-wild/erw/volcano), never committed; only what this writes into flat/ is. The ground is a picture
   composed by lt-wild/compose-rects.mjs from the pack's mockups (foundry_bg1 / foundry_bg2). This cuts the MONSTERS from the pack's
   sheets, which are GRIDS (cells across and down), every frame of one monster to ONE shared box: the Slag Golem (the rocky dude), the
   Furnace Imp, the Cinder Elemental, and the Bessemer (the crusher, a stone press that stands and smashes), plus Basalt the foreman
   (the golem at rest, greyed) and the blast furnace and the veins from the props. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const PK = path.join(ROOT, "lt-wild/erw/volcano/Epic RPG World - Volcano V1.6"), OUT = path.join(ROOT, "v3/assets/img/glad/flat");
const CH = (f) => path.join(PK, "Characters", f), PR = (f) => path.join(PK, "Props/static/individual sprites", f), AN = (f) => path.join(PK, "Props/Animated", f);
const raw = async (f, x, y, w, h) => { let im = sharp(f).ensureAlpha(); if (w) im = im.extract({ left: x, top: y, width: w, height: h }); const { data, info } = await im.raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const put = async (name, im) => { const b = await im.toBuffer(); fs.writeFileSync(path.join(OUT, `${name}.png`), b); const m = await sharp(b).metadata(); console.log(`  ${name.padEnd(22)} ${String(m.width).padStart(4)}x${String(m.height).padEnd(4)} ${Math.round(b.length / 1024)} KB`); };
if (!fs.existsSync(PK)) { console.log(`no pack at ${PK}`); process.exit(1); }
/* a sheet of n frames laid out in a grid of `cols` x `rows` cells (the pack's sheets have EMPTY cells at the end, so the rows are given,
   never worked out from n: the rocky dude's attack is 19 frames in a 5x4 sheet, the imp's 13 in a 4x4) */
const grid = async (f, n, cols, rows) => { const m = await sharp(f).metadata(), cw = Math.floor(m.width / cols), ch = Math.floor(m.height / rows), out = []; for (let i = 0; i < n; i++) out.push(await raw(f, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch)); return out; };
const bbox = (fr) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const { d, W, H } of fr) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
/* [name, [idle file, n, cols, rows], [walk file, n, cols, rows], [attack file, n, cols, rows], scale]. The crusher has no idle or walk sheet
   (it is a prop, a stone press that stands and smashes): its standing frame is the smash's first, and it never walks, so the walk is the same. */
const MOBS = [
  ["slaggolem", [CH("rocky dude/no shadow/rocky-dude_idle1_7frames.png"), 7, 3, 3], [CH("rocky dude/no shadow/rocky-dude_walk_6frames.png"), 6, 3, 2], [CH("rocky dude/no shadow/rocky-dude_atk1_19frames.png"), 19, 5, 4], 1.6],
  ["furnaceimp", [CH("imp-like demon/no shadow/imp-idle_9frames.png"), 9, 9, 1], [CH("imp-like demon/no shadow/imp-walk_6frames.png"), 6, 6, 1], [CH("imp-like demon/no shadow/imp-attack1_13frames.png"), 13, 4, 4], 1.3],
  ["cinderelemental", [CH("elemental/elemental-idle_8frames.png"), 8, 8, 1], [CH("elemental/elemental-walk_8frames.png"), 8, 8, 1], [CH("elemental/elemental-attack1_20frames.png"), 20, 5, 4], 0.8],
  ["bessemer", [AN("crusher-smash.png"), 12, 4, 3], [AN("crusher-smash.png"), 12, 4, 3], [AN("crusher-smash.png"), 12, 4, 3], 0.4]
];
/* Old Bessemer is the pack's crusher, a skull on a post that FADES IN over its first five smash frames and glows on 6-7: so its standing
   frame is 8, its swing is 5-8 (the glow), its "walk" (it never walks) 8-11, and frames 0-5 are its RISE, played when it comes back */
const PICK = { bessemer: { idle: [8, 9], walk: [8, 9, 10, 11], atk: [5, 6, 7, 8], rise: [0, 1, 2, 3, 4, 5] } };
for (const [name, [idle, ni, ic, ir], [walk, nw, wc, wr], [atk, na, ac, ar], sc] of MOBS) {
  const I = await grid(idle, ni, ic, ir), Wk = await grid(walk, nw, wc, wr), Ak = await grid(atk, na, ac, ar);
  const pk = PICK[name], pickA = pk ? pk.atk.map((i) => Ak[i]) : [0, 1, 2, 3].map((i) => Ak[Math.min(na - 1, Math.floor(((i + 0.5) * na) / 4))]);
  const all = [...I, ...Wk, ...pickA], sameSize = all.every((f) => f.W === all[0].W && f.H === all[0].H);
  if (!sameSize) { console.log(`  !! ${name}: cells differ`); process.exit(1); }
  const box = bbox(all);
  const cut = (fr) => sharp(fr.d, { raw: { width: fr.W, height: fr.H, channels: 4 } }).extract({ left: box.x0, top: box.y0, width: box.w, height: box.h }).resize(Math.max(1, Math.round(box.w * sc)), Math.max(1, Math.round(box.h * sc)), { kernel: "nearest" }).png({ compressionLevel: 9 });
  await put(name, cut(I[pk ? pk.idle[0] : 0])); await put(`${name}_i2`, cut(I[pk ? pk.idle[1] : Math.floor(ni / 2)]));
  for (let i = 0; i < 4; i++) await put(`${name}_w${i + 1}`, cut(Wk[pk ? pk.walk[i] : Math.floor((i * nw) / 4)]));
  for (let i = 0; i < 4; i++) await put(`${name}_a${i + 1}`, cut(pickA[i]));
  if (pk?.rise) for (let i = 0; i < pk.rise.length; i++) await put(`${name}_r${i + 1}`, cut(Ak[pk.rise[i]]));
}
/* Basalt, the foreman: the golem at rest, greyed, both facings */
{ const I = await grid(CH("rocky dude/no shadow/rocky-dude_idle1_7frames.png"), 7, 3, 3), b = bbox([I[0]]);
  const im = sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).resize(Math.round(b.w * 1.6), Math.round(b.h * 1.6), { kernel: "nearest" }).modulate({ saturation: 0.35, brightness: 1.1 }).png({ compressionLevel: 9 });
  const buf = await im.toBuffer(); for (const d of ["south", "east"]) await put(`basalt_${d}`, sharp(buf).png({ compressionLevel: 9 })); }
/* the blast furnace (the pack's "nasty structure", the one with the lit rune) and the veins (its big rocks: a plain one, the rune pillar
   that reads warm for Nova, the skull pile for Singularity), all at half size, so the furnace is three tiles and a vein one and a half */
const half = async (f) => { const t = await sharp(f).ensureAlpha().trim({ threshold: 1 }).png().toBuffer(), m = await sharp(t).metadata(); return sharp(t).resize(Math.round(m.width / 2), Math.round(m.height / 2), { kernel: "nearest" }).png({ compressionLevel: 9 }); };
for (const [k, f] of [["o_blast", PR("nasty structure_1.png")], ["fd_vein_eclipse", PR("big rocks_3.png")], ["fd_vein_nova", PR("big rocks_10.png")], ["fd_vein_singularity", PR("big rocks_12.png")]]) {
  if (!fs.existsSync(f)) { console.log(`  !! ${k}: no ${path.basename(f)}`); continue; } await put(k, await half(f)); }
console.log("foundry art cut");

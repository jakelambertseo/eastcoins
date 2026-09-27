/* EastScape: THE DEPTHS OF THE MOUNTAIN's art, cut from Rafael Matos's "Epic RPG World - The Depths of the Mountain"
   —  node tools/eastscape-depths-art.mjs

   THE PACK IS NOT IN THE REPO. It is paid (licence: use in a commercial game, modify freely, credit optional; the pack
   itself may not be repackaged, redistributed or resold), so it lives in lt-wild/erw/depths, local only, like the
   Szadi packs the Wilderness is cut from. Only the pieces this writes into flat/ are committed. Nothing else reads it.

   WHAT IT MAKES (v3/assets/img/glad/flat/):
     t_dpb     the platform floor: a 128x128 fill (4x4 cells) the painter draws by (x&3, y&3)
     t_dpg     the "path" sheet the Wang pass needs: all floor (the map has no dirt paths)
     t_dpw     THE ABYSS, in the Wang layout the water pass reads: black under scalloped corners, a dark rim at the lip
     t_dpface  six 32x96 cliff faces, one drawn under every ledge that drops into the abyss (the "bridge" look)
     t_dppave  the brown stone walkway ("p") that crosses the drop
     dp_*      props: crystals, rock pillars rising out of the dark, statues, candelabra, a throne, gold, a sword
     o_rock_abyss_crystal   the crystal vein (Mining 75)
     potboy, dgoblin, dogre, diron, deepwarden (+ _w1.._w4 walk frames and _i2 breath): the pack's monsters, every frame
                          of one monster cropped to ONE shared box so its feet never jump between frames
     pet_potboy          the Deepwarden's pet drop */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const PK = path.join(ROOT, "lt-wild/erw/depths/Epic RPG World - The dephs of the Mountain V1.5.1"), OUT = path.join(ROOT, "v3/assets/img/glad/flat");
const T = (f) => path.join(PK, "Tilesets", f), P = (f) => path.join(PK, "Props/Static/Props-individual sprites", f), CH = (f) => path.join(PK, "Characters", f);
const WANG = [[64, 32], [96, 32], [64, 64], [32, 64], [64, 0], [96, 64], [0, 32], [96, 96], [32, 32], [64, 96], [32, 0], [0, 64], [96, 0], [0, 0], [32, 96], [0, 96]];
const raw = async (f, x, y, w, h) => { let im = sharp(f).ensureAlpha(); if (w) im = im.extract({ left: x, top: y, width: w, height: h }); const { data, info } = await im.raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const png = (buf, w, h) => sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 });
const put = async (name, im) => { const b = await im.toBuffer(); fs.writeFileSync(path.join(OUT, `${name}.png`), b); const m = await sharp(b).metadata(); console.log(`  ${name.padEnd(24)} ${String(m.width).padStart(3)}x${m.height}`); return m; };
if (!fs.existsSync(PK)) { console.log(`no pack at ${PK}: unzip "Epic RPG World - The dephs of the Mountain" into lt-wild/erw/depths`); process.exit(1); }

/* ---- THE GROUND IS THE PACK'S OWN PICTURE now (2026-09-27, the third build, the owner: "design it like the reference image"):
   lt-wild/depths-compose.mjs stacks bands of the pack's mockup-10 (the throne room) and mockup-11 (his reference) into the 44x26 map and
   writes dp_bg1 / dp_bg2, the left and right halves. Run it after this. */

/* ---- props, trimmed */
const trimmed = (f) => sharp(f).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 });
const PROPS = {
  dp_crys_r: "Crystals3-improved refraction_1.png", dp_crys_g: "Crystals4-improved refraction_1.png", dp_crys_t: "Crystals5-improved refraction_1.png", dp_crys_b: "Crystals1-improved refraction_1.png"
};
for (const [k, f] of Object.entries(PROPS)) { if (!fs.existsSync(P(f))) { console.log(`  !! ${k}: no ${f}`); continue; } await put(k, trimmed(P(f))); }
/* the throne room's gate, lowered (the last frame of the pack's "boss gate going down"): a bar across the doorway */
await put("dp_gatebar", sharp(path.join(PK, "Props/Animated props/individual files", "boss gate-going down-frame16.png")).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 }));
/* the crystal vein: the pack's big pink cluster (Crystals6 are 64x64 clusters, not single shards) */
await put("o_rock_abyss_crystal", trimmed(P("Crystals6_0.png")));
/* the eclipse and nova veins wear the pack's own clusters too (purple and teal), not the rest of the game's grey boulders */
await put("dp_vein_eclipse", trimmed(P("Crystals1_0.png"))); await put("dp_vein_nova", trimmed(P("Crystals5_0.png")));

/* ---- the monsters: [name, sheet dir, idle file, idle frames, walk file, walk frames, scale] */
/* (2026-09-27, the owner: "the boss and gifs from the pack") and their ATTACKS: four frames of each one's swing (_a1.._a4), which
   the page plays the moment it hits; and the Deepwarden's RISE (_r1.._r6), which it plays when he comes back. */
const MOBS = [
  ["dogre", "Enemy 1", "enemy 1-idle.png", 8, "enemy 1-walk.png", 8, 1, "enemy 1-atk1.png", 16],
  ["diron", "Enemy 1/variation1", "enemy 1 var1-idle.png", 8, "enemy 1 var1-walk.png", 8, 1, "enemy 1 var1-atk1.png", 16],
  ["dgoblin", "Enemy 2", "enemy 2-idle.png", 6, "enemy 2-walk.png", 6, 1, "enemy 2-atk1.png", 6],
  ["potboy", "Pot Creature", "Pot Creature-idle.png", 6, "Pot Creature-walk.png", 8, 1, "Pot Creature-atk1.png", 23],
  ["deepwarden", "Boss", "boss anims-idle.png", 8, "boss anims-walk.png", 10, 1, "boss anims-atk1.png", 16, "boss anims-resurrect.png", 68]   /* 1x: the size he is in the pack's own throne room */
];
const frames = async (f, n) => { const m = await sharp(f).metadata(), fw = Math.floor(m.width / n), out = []; for (let i = 0; i < n; i++) out.push(await raw(f, i * fw, 0, fw, m.height)); return out; };
const bbox = (fr) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const { d, W, H } of fr) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
for (const [name, dir, idle, ni, walk, nw, sc, atk, na, rise, nr] of MOBS) {
  const I = await frames(CH(`${dir}/${idle}`), ni), Wk = await frames(CH(`${dir}/${walk}`), nw), Ak = await frames(CH(`${dir}/${atk}`), na), Rk = rise ? await frames(CH(`${dir}/${rise}`), nr) : [];
  if (I[0].W !== Wk[0].W || I[0].H !== Wk[0].H) console.log(`  (${name}: idle and walk frames differ in size, ${I[0].W}x${I[0].H} vs ${Wk[0].W}x${Wk[0].H})`);
  const pickA = [0, 1, 2, 3].map((i) => Ak[Math.min(na - 1, Math.floor(((i + 0.5) * na) / 4))]), pickR = Rk.length ? [0, 1, 2, 3, 4, 5].map((i) => Rk[Math.min(nr - 1, Math.floor((i * (nr - 1)) / 5))]) : [];
  const box = bbox([...I, ...Wk, ...pickA, ...pickR]);   /* one box for every frame, so the feet never move between them */
  const cut = (fr) => sharp(fr.d, { raw: { width: fr.W, height: fr.H, channels: 4 } }).extract({ left: box.x0, top: box.y0, width: Math.min(box.w, fr.W - box.x0), height: Math.min(box.h, fr.H - box.y0) }).resize(box.w * sc, box.h * sc, { kernel: "nearest" }).png({ compressionLevel: 9 });
  await put(name, cut(I[0]));
  await put(`${name}_i2`, cut(I[Math.floor(ni / 2)]));
  for (let i = 0; i < 4; i++) await put(`${name}_w${i + 1}`, cut(Wk[Math.floor((i * nw) / 4)]));
  for (let i = 0; i < 4; i++) await put(`${name}_a${i + 1}`, cut(pickA[i]));
  for (let i = 0; i < pickR.length; i++) await put(`${name}_r${i + 1}`, cut(pickR[i]));
}
/* OLD PICKETT, out of the pack itself (2026-09-27, the owner: the PixelLab miner "looks way too AI, shiny, and not the design of this
   area"): the pack's small goblin, put down his blade long ago, greyed with age. One side-on picture for both of his facings. */
{ const I = await frames(CH("Enemy 2/enemy 2-idle.png"), 6), bx = bbox([I[0]]);
  const old = await sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: bx.x0, top: bx.y0, width: bx.w, height: bx.h }).modulate({ saturation: 0.55, brightness: 0.92 }).png().toBuffer();
  for (const d of ["south", "east"]) await put(`pickett_${d}`, sharp(old).png({ compressionLevel: 9 })); }
/* the pet: the Pot Boy, small */
{ const I = await frames(CH("Pot Creature/Pot Creature-idle.png"), 6), bx = bbox([I[0]]);
  await put("pet_potboy", sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: bx.x0, top: bx.y0, width: bx.w, height: bx.h }).resize(Math.round(bx.w * 0.75), Math.round(bx.h * 0.75), { kernel: "nearest" }).png()); }

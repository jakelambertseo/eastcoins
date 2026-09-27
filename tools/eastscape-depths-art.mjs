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

/* ---- the floor: two 128x64 windows of pure platform top from the pack's own mockup sheet, stacked */
const a = await raw(T("Tileset-Terrain.png"), 690, 36, 128, 64), b = await raw(T("Tileset-Terrain.png"), 760, 60, 128, 64);
const floor = Buffer.concat([a.d, b.d]);
for (let i = 3; i < floor.length; i += 4) floor[i] = 255;
await put("t_dpb", png(floor, 128, 128));
await put("t_dpg", png(floor, 128, 128));   /* no dirt paths down here: every Wang cell of the path sheet is floor */
/* ---- the abyss: pure black at the wet corners, a dark lip where it meets the floor */
{
  const out = Buffer.alloc(128 * 128 * 4), R = 19;
  const wet = (m, x, y) => [[8, 0, 0], [4, 32, 0], [2, 0, 32], [1, 32, 32]].some(([bit, cx, cy]) => (m & bit) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < R + ((x * 7 + y * 3) % 3) - 1);
  for (let i = 0; i < 16; i++) {
    const [sx, sy] = WANG[i], m = 15 - i;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const k = ((sy + y) * 128 + sx + x) * 4, fk = (((sy + y) % 128) * 128 + ((sx + x) % 128)) * 4, w = m === 15 || wet(m, x, y);
      if (!w) { floor.copy(out, k, fk, fk + 4); const lip = m !== 15 && [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < 32 && ny < 32 && wet(m, nx, ny); }); if (lip) for (let c = 0; c < 3; c++) out[k + c] = Math.round(out[k + c] * 0.45); continue; }
      out[k] = 5; out[k + 1] = 7; out[k + 2] = 9; out[k + 3] = 255;
    }
  }
  await put("t_dpw", png(out, 128, 128));
}
/* ---- the cliff faces: six 32-wide columns of the mossy wall band, lip and all */
await put("t_dpface", sharp(T("Tileset 1.png")).extract({ left: 0, top: 288, width: 192, height: 96 }).png({ compressionLevel: 9 }));
await put("t_dppave", sharp(T("Tileset 2.png")).extract({ left: 64, top: 544, width: 32, height: 32 }).png({ compressionLevel: 9 }));

/* ---- props, trimmed */
const trimmed = (f) => sharp(f).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 });
const PROPS = {
  dp_pillar1: "rock pillars coming from darkness-bg_0.png", dp_pillar2: "rock pillars coming from darkness-bg_1.png", dp_pillar3: "rock pillars coming from darkness-bg_2.png", dp_pillar4: "rock pillars coming from darkness-bg_3.png",
  dp_rock1: "rocks coming from darkness-bg_0.png", dp_rock2: "rocks coming from darkness-bg_1.png", dp_rock3: "rocks coming from darkness-bg_2.png", dp_rock4: "rocks coming from darkness-bg_4.png",
  dp_statue1: "statues-men_1.png", dp_statue2: "statues-men_3.png", dp_statue3: "statues-men_5.png", dp_candle: "candelabrum_0.png", dp_sword: "sword stuck in the ground.png",
  dp_gold1: "piles of gold_1.png", dp_gold2: "piles of gold_4.png", dp_throne: "boss-throne1.png", dp_monument: "golden monument_2.png",
  dp_crys_r: "Crystals3-improved refraction_1.png", dp_crys_g: "Crystals4-improved refraction_1.png", dp_crys_t: "Crystals5-improved refraction_1.png", dp_crys_b: "Crystals1-improved refraction_1.png"
};
for (const [k, f] of Object.entries(PROPS)) { if (!fs.existsSync(P(f))) { console.log(`  !! ${k}: no ${f}`); continue; } await put(k, trimmed(P(f))); }
/* the crystal vein: the pack's big pink cluster (Crystals6 are 64x64 clusters, not single shards) */
await put("o_rock_abyss_crystal", trimmed(P("Crystals6_0.png")));

/* ---- the monsters: [name, sheet dir, idle file, idle frames, walk file, walk frames, scale] */
const MOBS = [
  ["dogre", "Enemy 1", "enemy 1-idle.png", 8, "enemy 1-walk.png", 8, 1],
  ["diron", "Enemy 1/variation1", "enemy 1 var1-idle.png", 8, "enemy 1 var1-walk.png", 8, 1],
  ["dgoblin", "Enemy 2", "enemy 2-idle.png", 6, "enemy 2-walk.png", 6, 1],
  ["potboy", "Pot Creature", "Pot Creature-idle.png", 6, "Pot Creature-walk.png", 8, 1],
  ["deepwarden", "Boss", "boss anims-idle.png", 8, "boss anims-walk.png", 10, 2]
];
const frames = async (f, n) => { const m = await sharp(f).metadata(), fw = Math.floor(m.width / n), out = []; for (let i = 0; i < n; i++) out.push(await raw(f, i * fw, 0, fw, m.height)); return out; };
const bbox = (fr) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const { d, W, H } of fr) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
for (const [name, dir, idle, ni, walk, nw, sc] of MOBS) {
  const I = await frames(CH(`${dir}/${idle}`), ni), Wk = await frames(CH(`${dir}/${walk}`), nw);
  if (I[0].W !== Wk[0].W || I[0].H !== Wk[0].H) console.log(`  (${name}: idle and walk frames differ in size, ${I[0].W}x${I[0].H} vs ${Wk[0].W}x${Wk[0].H})`);
  const box = bbox([...I, ...Wk]);
  const cut = (fr) => sharp(fr.d, { raw: { width: fr.W, height: fr.H, channels: 4 } }).extract({ left: box.x0, top: box.y0, width: Math.min(box.w, fr.W - box.x0), height: Math.min(box.h, fr.H - box.y0) }).resize(box.w * sc, box.h * sc, { kernel: "nearest" }).png({ compressionLevel: 9 });
  await put(name, cut(I[0]));
  await put(`${name}_i2`, cut(I[Math.floor(ni / 2)]));
  for (let i = 0; i < 4; i++) await put(`${name}_w${i + 1}`, cut(Wk[Math.floor((i * nw) / 4)]));
}
/* the pet: the Pot Boy, small */
{ const I = await frames(CH("Pot Creature/Pot Creature-idle.png"), 6), bx = bbox([I[0]]);
  await put("pet_potboy", sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: bx.x0, top: bx.y0, width: bx.w, height: bx.h }).resize(Math.round(bx.w * 0.75), Math.round(bx.h * 0.75), { kernel: "nearest" }).png()); }

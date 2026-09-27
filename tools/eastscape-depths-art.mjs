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

/* ---- THE TEMPLE FLOOR (2026-09-27, the owner, with the pack's own mockup: "the layout/map needs to feel more open ... just mimic
   whats in the tile previews"). Tileset 3's brown brick: a 192x96 fill, of which 128x96 and then its first 32 rows again make the
   4x4 cell sheet the painter tiles by (x&3, y&3). */
const fl = await raw(T("Tileset 3.png"), 32, 640, 128, 96), fl2 = await raw(T("Tileset 3.png"), 32, 640, 128, 32);
const floor = Buffer.concat([fl.d, fl2.d]);
for (let i = 3; i < floor.length; i += 4) floor[i] = 255;
await put("t_dpb", png(floor, 128, 128));
await put("t_dpg", png(floor, 128, 128));   /* no dirt paths down here: every Wang cell of the path sheet is floor */
/* ---- the drop: SQUARE edges (the temple is built, not grown), black past the edge, and the pack's studded bronze trim along the
   floor's side of every edge: a dark line, a bronze band, a stud every eight pixels */
{
  const out = Buffer.alloc(128 * 128 * 4);
  const wet = (m, x, y) => (x < 16 ? (y < 16 ? m & 8 : m & 2) : (y < 16 ? m & 4 : m & 1)) !== 0;
  for (let i = 0; i < 16; i++) {
    const [sx, sy] = WANG[i], m = 15 - i;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const k = ((sy + y) * 128 + sx + x) * 4, fk = (((sy + y) % 128) * 128 + ((sx + x) % 128)) * 4;
      if (m === 15 || wet(m, x, y)) { out[k] = 6; out[k + 1] = 9; out[k + 2] = 10; out[k + 3] = 255; continue; }
      floor.copy(out, k, fk, fk + 4);
      let d = 9; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < 32 && ny < 32 && wet(m, nx, ny)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy))); }
      if (d <= 4) { const c = d === 1 ? [34, 22, 12] : d === 4 ? [60, 42, 24] : [122, 86, 46]; const stud = d === 2 && ((sx + x + sy + y) % 8 === 0); out[k] = stud ? 214 : c[0]; out[k + 1] = stud ? 170 : c[1]; out[k + 2] = stud ? 96 : c[2]; }
    }
  }
  await put("t_dpw", png(out, 128, 128));
}
/* ---- the walls under the ledges: six plain 32-wide columns of the dark brick, then eight dressed ones (banners, torches, a gold
   sign) from the banner strip. The painter mostly hangs plain wall and now and then a dressed one. */
{
  const plain = await sharp(T("Tileset 3.png")).extract({ left: 0, top: 296, width: 192, height: 88 }).png().toBuffer();
  const dressed = await sharp(T("Tileset 3.png")).extract({ left: 0, top: 520, width: 256, height: 88 }).png().toBuffer();
  await put("t_dpface", sharp({ create: { width: 448, height: 88, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: plain, left: 0, top: 0 }, { input: dressed, left: 192, top: 0 }]).png({ compressionLevel: 9 }));
}

/* ---- props, trimmed */
const trimmed = (f) => sharp(f).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 });
const PROPS = {
  dp_sword: "sword stuck in the ground.png", dp_gold1: "piles of gold_1.png", dp_gold2: "piles of gold_4.png", dp_throne: "boss-throne1.png",
  dp_crys_r: "Crystals3-improved refraction_1.png", dp_crys_g: "Crystals4-improved refraction_1.png", dp_crys_t: "Crystals5-improved refraction_1.png", dp_crys_b: "Crystals1-improved refraction_1.png",
  /* the temple (2026-09-27): the far statues standing in the dark, the gold ones, the busts on stands, the big monument, pots */
  dp_far1: "statues-far from platforms-bg_4.png", dp_far2: "statues-far from platforms-bg_5.png", dp_far3: "statues-far from platforms-bg_9.png", dp_far4: "statues-far from platforms-bg_0.png",
  dp_gold3: "golden statues_4.png", dp_gold4: "golden statues_6.png", dp_bigmonument: "golden monument_0.png",
  dp_pot1: "pots1_0.png", dp_pot2: "pots2_3.png", dp_pot3: "pots3_2.png", dp_pot4: "pots5_1.png", dp_carpet: "boss-carpet.png"
};
for (const [k, f] of Object.entries(PROPS)) { if (!fs.existsSync(P(f))) { console.log(`  !! ${k}: no ${f}`); continue; } await put(k, trimmed(P(f))); }
/* the carpet's cross-piece: the same runner, turned */
await put("dp_carpeth", sharp(P("boss-carpet.png")).ensureAlpha().trim({ threshold: 1 }).rotate(90).png({ compressionLevel: 9 }));
/* the crystal vein: the pack's big pink cluster (Crystals6 are 64x64 clusters, not single shards) */
await put("o_rock_abyss_crystal", trimmed(P("Crystals6_0.png")));

/* ---- the monsters: [name, sheet dir, idle file, idle frames, walk file, walk frames, scale] */
/* (2026-09-27, the owner: "the boss and gifs from the pack") and their ATTACKS: four frames of each one's swing (_a1.._a4), which
   the page plays the moment it hits; and the Deepwarden's RISE (_r1.._r6), which it plays when he comes back. */
const MOBS = [
  ["dogre", "Enemy 1", "enemy 1-idle.png", 8, "enemy 1-walk.png", 8, 1, "enemy 1-atk1.png", 16],
  ["diron", "Enemy 1/variation1", "enemy 1 var1-idle.png", 8, "enemy 1 var1-walk.png", 8, 1, "enemy 1 var1-atk1.png", 16],
  ["dgoblin", "Enemy 2", "enemy 2-idle.png", 6, "enemy 2-walk.png", 6, 1, "enemy 2-atk1.png", 6],
  ["potboy", "Pot Creature", "Pot Creature-idle.png", 6, "Pot Creature-walk.png", 8, 1, "Pot Creature-atk1.png", 23],
  ["deepwarden", "Boss", "boss anims-idle.png", 8, "boss anims-walk.png", 10, 2, "boss anims-atk1.png", 16, "boss anims-resurrect.png", 68]
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
/* the animated props: fire in the candelabra and the pots, and the power orbs. Each a sheet of frames in four columns. */
const AF = (f) => path.join(PK, "Props/Animated props/individual files", f);
for (const [name, base, n, fw, fh] of [["a_dpcandle", "Fire-candelabrum", 8, 32, 96], ["a_dpfirepot", "Fire-pot", 8, 32, 96], ["a_dppower", "power balls-4", 8, 96, 96]]) {
  const cols = 4, rows = Math.ceil(n / cols), comps = [];
  for (let i = 0; i < n; i++) comps.push({ input: AF(`${base}-frame${i + 1}.png`), left: (i % cols) * fw, top: Math.floor(i / cols) * fh });
  await put(name, sharp({ create: { width: cols * fw, height: rows * fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png({ compressionLevel: 9 }));
}
/* the pet: the Pot Boy, small */
{ const I = await frames(CH("Pot Creature/Pot Creature-idle.png"), 6), bx = bbox([I[0]]);
  await put("pet_potboy", sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: bx.x0, top: bx.y0, width: bx.w, height: bx.h }).resize(Math.round(bx.w * 0.75), Math.round(bx.h * 0.75), { kernel: "nearest" }).png()); }

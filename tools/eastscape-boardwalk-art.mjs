/* EastScape: THE BOARDWALK's art, cut from Rafael Matos's "ERW - Sea Adventures" (and one gull from "Grass Land 2.0")
   —  node tools/eastscape-boardwalk-art.mjs
   The packs are paid and local (lt-wild/erw/sea, lt-wild/erw/grass), never committed; only what this writes into flat/ is. The ground is
   a picture composed by lt-wild/compose-rects.mjs from the pack's mockups (bw_bg1 / bw_bg2). This cuts the MONSTERS, every frame of one
   monster to ONE shared box so its feet never jump: the Pier Crab (the pack's crab-claw enemy), the Deckhand (its pirate), the Kraken Arm
   (the tentacle that comes up beside the crab), the Gull (Grass Land's bird), the Crab King (the crab at half again the size), and the
   NPC, Salty Meg (the pack's own dock-side NPC), one side-on picture for both facings. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const PK = path.join(ROOT, "lt-wild/erw/sea/ERW - Sea Adventures (GL 2.0 expansion) V1.5"), GR = path.join(ROOT, "lt-wild/erw/grass/ERW - Grass Land 2.0 v2.1"), OUT = path.join(ROOT, "v3/assets/img/glad/flat");
const CH = (f) => path.join(PK, "Characters", f);
const raw = async (f, x, y, w, h) => { let im = sharp(f).ensureAlpha(); if (w) im = im.extract({ left: x, top: y, width: w, height: h }); const { data, info } = await im.raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
const put = async (name, im) => { const b = await im.toBuffer(); fs.writeFileSync(path.join(OUT, `${name}.png`), b); const m = await sharp(b).metadata(); console.log(`  ${name.padEnd(22)} ${String(m.width).padStart(4)}x${String(m.height).padEnd(4)} ${Math.round(b.length / 1024)} KB`); };
if (!fs.existsSync(PK)) { console.log(`no pack at ${PK}`); process.exit(1); }
const frames = async (f, n) => { const m = await sharp(f).metadata(), fw = Math.floor(m.width / n), out = []; for (let i = 0; i < n; i++) out.push(await raw(f, i * fw, 0, fw, m.height)); return out; };
const bbox = (fr) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const { d, W, H } of fr) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
/* [name, idle file, idle frames, walk file, walk frames, attack file, attack frames, scale] */
const MOBS = [
  ["clawhand", CH("crab-claw enemy/crab-claw enemy-idle.png"), 8, CH("crab-claw enemy/crab-claw enemy-walk.png"), 8, CH("crab-claw enemy/crab-claw enemy-atk1.png"), 17, 1],
  ["captainclaw", CH("crab-claw enemy/crab-claw enemy-idle.png"), 8, CH("crab-claw enemy/crab-claw enemy-walk.png"), 8, CH("crab-claw enemy/crab-claw enemy-atk1.png"), 17, 1.5],
  ["deckhand", CH("female enemy/female-enemy-anims-idle-8frames.png"), 8, CH("female enemy/female-enemy-anims-walk-8frames.png"), 8, CH("female enemy/female-enemy-anims-atk1-21frames.png"), 21, 1],
  ["krakenarm", CH("crab-claw enemy/atk2-crab and tentacles-tentacles-loop.png"), 6, CH("crab-claw enemy/atk2-crab and tentacles-tentacles-loop.png"), 6, CH("crab-claw enemy/atk2-crab and tentacles-tentacles-spawn.png"), 0, 1.5],
  ["gull", path.join(GR, "Characters/small animals/birds/bird1/small animals - bird- idle - sideview.png"), 0, path.join(GR, "Characters/small animals/birds/bird1/small animals - bird-walk - sideview.png"), 0, path.join(GR, "Characters/small animals/birds/bird1/small animals - bird-lifting off.png"), 0, 2]
];
const count = async (f, n) => { if (n) return n; const m = await sharp(f).metadata(); return Math.max(1, Math.round(m.width / m.height)); };   /* a square-frame strip: as many frames as it is wide */
for (const [name, idle, ni0, walk, nw0, atk, na0, sc] of MOBS) {
  const ni = await count(idle, ni0), nw = await count(walk, nw0), na = await count(atk, na0);
  const I = await frames(idle, ni), Wk = await frames(walk, nw), Ak = await frames(atk, na);
  const pickA = [0, 1, 2, 3].map((i) => Ak[Math.min(na - 1, Math.floor(((i + 0.5) * na) / 4))]);
  const box = bbox([...I, ...Wk, ...pickA]);
  const cut = (fr) => sharp(fr.d, { raw: { width: fr.W, height: fr.H, channels: 4 } }).extract({ left: box.x0, top: box.y0, width: Math.min(box.w, fr.W - box.x0), height: Math.min(box.h, fr.H - box.y0) }).resize(Math.round(box.w * sc), Math.round(box.h * sc), { kernel: "nearest" }).png({ compressionLevel: 9 });
  await put(name, cut(I[0])); await put(`${name}_i2`, cut(I[Math.floor(ni / 2)]));
  for (let i = 0; i < 4; i++) await put(`${name}_w${i + 1}`, cut(Wk[Math.floor((i * nw) / 4)]));
  for (let i = 0; i < 4; i++) await put(`${name}_a${i + 1}`, cut(pickA[i]));
}
/* Salty Meg: the pack's own dock NPC, first idle frame, both facings */
{ const I = await frames(CH("npc-idle.png"), 7), bx = bbox([I[0]]);
  const im = sharp(I[0].d, { raw: { width: I[0].W, height: I[0].H, channels: 4 } }).extract({ left: bx.x0, top: bx.y0, width: bx.w, height: bx.h }).png({ compressionLevel: 9 });
  const b = await im.toBuffer(); for (const d of ["south", "east"]) await put(`saltymeg_${d}`, sharp(b).png({ compressionLevel: 9 })); }
console.log("boardwalk art cut");

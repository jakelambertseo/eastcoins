/* EastScape: THE BOARDWALK'S ISLANDS, the things you touch, cut from Rafael Matos's "ERW - Sea Adventures"  —  node tools/eastscape-isles-art.mjs
   (2026-09-27) The islands' pictures come from the pack's mockups (lt-wild/isle-*.json). These are the objects on top of them, from the
   pack's own prop sprites, at native size so they match the pictures: the rowboat that carries you between islands, three palms to cut,
   and the big rock pile, tinted once per ore so a starfall, an eclipse and a nova rock can be told apart. bw_none is one clear pixel,
   for a boat that is already drawn into the island's picture. The pack is paid and stays local; only these files are committed. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const PK = path.join(ROOT, "lt-wild/erw/sea/ERW - Sea Adventures (GL 2.0 expansion) V1.5/Props/atlas-props-sprites"), OUT = path.join(ROOT, "v3/assets/img/glad/flat");
if (!fs.existsSync(PK)) { console.log(`no pack at ${PK}`); process.exit(1); }
const put = async (name, im) => { const b = await im.png({ compressionLevel: 9 }).toBuffer(); fs.writeFileSync(path.join(OUT, `${name}.png`), b); const m = await sharp(b).metadata(); console.log(`  ${name.padEnd(18)} ${m.width}x${m.height} ${Math.round(b.length / 1024)} KB`); };
const trim = (f) => sharp(path.join(PK, f)).ensureAlpha().trim({ threshold: 1 });
await put("bw_rowboat", trim("boat-anims-idle-1.png"));
await put("bw_palm1", trim("palm tree - 1.png")); await put("bw_palm2", trim("palm tree - 2.png")); await put("bw_palm3", trim("palm tree - 5.png"));
const rock = await trim("rocks on sand_26.png").png().toBuffer();
await put("bw_rock_starfall", sharp(rock).modulate({ saturation: 0.35, brightness: 1.05 }));
await put("bw_rock_eclipse", sharp(rock).modulate({ hue: 230, saturation: 1.1, brightness: 0.62 }));
await put("bw_rock_nova", sharp(rock).modulate({ hue: -20, saturation: 1.6, brightness: 1.12 }));
await put("bw_none", sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }));
/* THE PACK'S ANIMATIONS (the owner: "youre including some of the gifs in the pack on this build right?"). Each strip is cut to one box
   shared by all its frames and laid in a row; `anchor` is where the frame's foot is (a palm's trunk base, a boat's middle), so the page
   can put that point on the object's tile. The water is the pack's 8-frame full tile, used as a surface over the open sea. */
const AN = path.join(PK, "..", "animated"), TS = path.join(PK, "..", "..", "Tilesets"), anchors = {};
const strip = async (name, file, n, cols, cw, ch, foot) => {
  const frames = []; for (let i = 0; i < n; i++) { const { data, info } = await sharp(path.join(AN, file)).ensureAlpha().extract({ left: (i % cols) * cw, top: Math.floor(i / cols) * ch, width: cw, height: ch }).raw().toBuffer({ resolveWithObject: true }); frames.push(data); }
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const d of frames) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1, sheet = Buffer.alloc(fw * n * fh * 4);
  frames.forEach((d, i) => { for (let y = 0; y < fh; y++) d.copy(sheet, (y * fw * n + i * fw) * 4, ((y + y0) * cw + x0) * 4, ((y + y0) * cw + x0 + fw) * 4); });
  const [ax, ay] = foot(frames[0], cw, ch); anchors[name] = { frames: n, fw, fh, ax: ax - x0, ay: ay - y0 };
  await put(name, sharp(sheet, { raw: { width: fw * n, height: fh, channels: 4 } }));
};
/* a palm's foot: the lowest row of solid, warm (trunk and sand) pixels, at their middle */
const trunkFoot = (d, cw, ch) => { for (let y = ch - 1; y >= 0; y--) { const xs = []; for (let x = 0; x < cw; x++) { const i = (y * cw + x) * 4; if (d[i + 3] > 200 && d[i] > d[i + 2] + 40) xs.push(x); } if (xs.length >= 3) return [Math.round((xs[0] + xs.at(-1)) / 2), y]; } return [cw / 2, ch]; };
const boatMid = (d, cw, ch) => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)]; };
for (const i of [1, 2, 3]) await strip(`bw_palm${i}a`, `animated Palm Tree-${i}.png`, 10, 10, 156, 215, trunkFoot);
await strip("bw_boata", "boat-idle-sideways.png", 14, 4, 288, 256, boatMid);
await put("bw_water", sharp(path.join(TS, "Animated water tiles (full tile).png")));
/* (2026-09-27, the owner: "lets add a few items on the ground in each one, and the animated pirate flags and banners, it feels very
   empty") the clutter: crates, barrels, baskets and a chest that stand in the way, and bones, shells, rope, coconuts and a fish that lie
   flat and can be walked over. Then the pack's animated pirate flag on its pole, its two banner posts, and the buried chest opening onto
   gold, which is what Captain Claw leaves behind. */
const DECOR = { barrel: "barrels_0.png", barrel2: "barrels_5.png", fishbarrel: "barrel - fish_0.png", skelbarrel: "barrel with skeleton.png", sandbarrel: "barrels on sand_3.png",
  crate: "crates_0.png", bigcrate: "cratess-1.png", fishcrate: "crates - fish_0.png", sandcrate: "crates on sand_6.png", basket: "baskets-1.png", fishbasket: "basket with fishes-1.png",
  barricade: "barricade.png", chest: "chest_0.png", bones: "bones_4.png", skeleton: "bones_15.png", shells1: "shells and pearls_4.png", shells2: "shells and pearls_7.png",
  rope: "rope on floor_2.png", coconut: "coconut_3.png", fish: "fish_15.png", stranded: "stranded boat-sand.png" };
for (const [k, f] of Object.entries(DECOR)) await put(`bw_d_${k}`, trim(f));
const footOf = (d, cw, ch) => { for (let y = ch - 1; y >= 0; y--) { const xs = []; for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 180) xs.push(x); if (xs.length >= 3) return [Math.round((xs[0] + xs.at(-1)) / 2), y]; } return [cw / 2, ch]; };
await strip("bw_flag", "flag-pirate2.png", 8, 8, 160, 186, (d, cw, ch) => { for (let y = ch - 1; y >= 0; y--) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 180) return [x, y]; return [0, ch]; });
await strip("bw_banner", "banner-anim.png", 12, 12, 96, 128, footOf);
await strip("bw_banner2", "banner-2-anim.png", 12, 12, 96, 128, footOf);
await strip("bw_chesta", "buried chest-opening-gold.png", 10, 10, 128, 128, footOf);
fs.writeFileSync(path.join(ROOT, "lt-wild/cut/isles-anim.json"), JSON.stringify(anchors, null, 1));
console.log(JSON.stringify(anchors));
console.log("islands' art cut");

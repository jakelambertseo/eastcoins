/* EastScape: THE YARD'S TOWN art —  node tools/eastscape-town-art.mjs
   (2026-09-28, the owner: "reduce the mobs in the court area, and try to increase the court size, and make it feel a little bit more
   like a city? use some items from the downloaded pixel packs"). The Yard's east half became a small town: Main Street, the Market
   Square, the Old Quarter (the Tower and the Crypt) and the Smithy.

   THE PACKS ARE NOT IN THE REPO (paid; see the notes in eastscape-depths-art.mjs). This is the only reader of them for the town, and it
   writes finished pieces into flat/:
     t_cobble        Main Street's cobbles: a 64x64 fill cut from Szadi's RPG Fantasy Worlds Set 1 (g_terrain1), tiled 2x2 cells a tile
     t_oldstone      the Old Quarter's floor: the same cobbles, darkened and cooled, so the two streets are one stone
     o_town_smithy   the Smithy's open workshop (Epic RPG World, Sea Adventures: shop-blacksmith-vendor)
     o_town_stall1/2 two plain market stalls from the same pack (little stalls 3 and 4: no life rings, so not a seaside stall)
   The pack draws at the game's own scale (32 px a tile on the 2x layer), so nothing is resized. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const OUT = path.join(ROOT, "v3/assets/img/glad/flat"), SZ = path.join(ROOT, "lt-wild/pack/_PNG/g_terrain1.png");
const seaDir = path.join(ROOT, "lt-wild/erw/sea"), SEA = fs.existsSync(seaDir) ? path.join(seaDir, fs.readdirSync(seaDir)[0], "props/atlas-props-sprites") : null;
if (!fs.existsSync(SZ) || !SEA) { console.log("the packs are not unzipped in lt-wild/ (see eastscape-wild-art.mjs and eastscape-depths-art.mjs)"); process.exit(1); }
const put = async (name, im) => { const b = await im.png({ compressionLevel: 9 }).toBuffer(); fs.writeFileSync(path.join(OUT, `${name}.png`), b); const m = await sharp(b).metadata(); console.log(`  ${name.padEnd(16)} ${m.width}x${m.height}  ${(b.length / 1024).toFixed(1)} KB`); };
const cob = () => sharp(SZ).extract({ left: 1184, top: 0, width: 64, height: 64 });
await put("t_cobble", cob().modulate({ brightness: 1.25, saturation: 0.85 }));   /* a little lighter than the pack: beside the brick it read as tarmac */
await put("t_oldstone", cob().modulate({ brightness: 0.75, saturation: 0.35 }).tint({ r: 150, g: 165, b: 200 }));
const trimmed = (f) => sharp(path.join(SEA, f)).ensureAlpha().trim({ threshold: 1 });
await put("o_town_smithy", trimmed("shop-blacksmith-vendor.png"));
await put("o_town_stall1", trimmed("little stalls_3.png"));
await put("o_town_stall2", trimmed("little stalls_4.png"));

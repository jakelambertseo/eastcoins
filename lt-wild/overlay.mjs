/* paint a rows.json over a composed picture: green where you can walk, red at an exit  —  node lt-wild/overlay.mjs <name> */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const CUT = "C:/Users/jake/code/eastcoins/lt-wild/cut/", name = process.argv[2], rows = JSON.parse(fs.readFileSync(CUT + `${name}-rows.json`, "utf8")), P = 32;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${44 * P}" height="${26 * P}">`;
rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ".") svg += `<rect x="${x * P + 2}" y="${y * P + 2}" width="${P - 4}" height="${P - 4}" fill="rgba(60,255,60,.28)"/>`; else if (c === "e") svg += `<rect x="${x * P}" y="${y * P}" width="${P}" height="${P}" fill="rgba(255,40,40,.6)"/>`; }));
await sharp(CUT + `${name}-bg-grid.png`).composite([{ input: Buffer.from(svg + "</svg>") }]).png().toFile(CUT + `${name}-walk.png`); console.log("overlay written");

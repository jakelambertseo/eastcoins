/* EastScape: the Crypt's second round of art (v104), all PixelLab —  node tools/eastscape-crypt-art.mjs
   Reads the raw downloads in lt-crypt2/ and writes the game's files into v3/assets/img/glad/flat/:
     t_crypt.png      8 x 2 floor tiles of 32 px (tiles-pro 49edd33b): six kinds of flagstone twice over, and at columns 6 and 7 the TOP of a wall
     t_cryptwall.png  8 x 2 wall FACES of 64 px (tiles-pro 37f45fc4): plain, cracked, mossy, skull niches, shackles
     o_<prop>.png     the props, trimmed to their pixels
     fx_hit / fx_crit / fx_miss.png   the badges behind the combat numbers
   The Wang tileset that was generated first (697adc69) came out looking like a canal and is not used. */
import sharp from "sharp";
import fs from "node:fs";
const SRC = "lt-crypt2/", OUT = "v3/assets/img/glad/flat/";
const sheet = async (pre, cell, out) => { const comp = []; for (let i = 0; i < 16; i++) comp.push({ input: await sharp(`${SRC}${pre}_${i}.png`).resize(cell, cell, { kernel: "nearest" }).png().toBuffer(), left: (i % 8) * cell, top: Math.floor(i / 8) * cell }); await sharp({ create: { width: cell * 8, height: cell * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).png({ palette: true, colours: 64 }).toFile(OUT + out); };
await sheet("f", 32, "t_crypt.png"); await sheet("w", 64, "t_cryptwall.png");
const PROPS = { pillar: "o_cryptpillar", altar: "o_cryptaltar", cage: "o_cryptcage", coffin: "o_cryptcoffin", throne: "o_cryptthrone", gargoyle: "o_gargoyle", brazier: "o_ghostbrazier", candles: "o_cryptcandles", exit: "o_cryptexit", skullheap: "o_skullheap", rubble: "o_cryptrubble", rack: "o_cryptrack", s_hit: "fx_hit", s_crit: "fx_crit", s_miss: "fx_miss" };
for (const [from, to] of Object.entries(PROPS)) { const info = await sharp(`${SRC}${from}.png`).trim({ threshold: 1 }).png().toFile(`${OUT}${to}.png`); console.log(to, info.width, info.height, fs.statSync(`${OUT}${to}.png`).size); }

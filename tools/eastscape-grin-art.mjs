/* EastScape: THE GRIN's art, from PixelLab (2026-10-02) —  node tools/eastscape-grin-art.mjs
   The owner chose boss C from tools/hollow-mock ("i only want this raid to have a boss, no minions"; "he needs to be huge like the ice man").
   Drawn from the style brief (tools/eastscape-art-style.md):
     grin          The Grin            <key>, _i2, _w1-4, _a1-4 (the Flood's set: tools/eastscape-flood-art.mjs explains each)
     o_grinhead    his head, and every fake one   one picture (a map object)
     pet_grinling  his pet                         one picture (a map object)
   HUGE: the world draws a monster at its picture's own size, and the Ice Man's frames are 246 px. The Grin comes out of PixelLab on a 168
   canvas, so every frame of his is trimmed and then DOUBLED, nearest-neighbour (whole pixels, never resampled smooth), to stand about as tall. */
import fs from "node:fs";
const sharp = (await import("sharp")).default;
const OUT = "v3/assets/img/glad/flat/", ACC = "4e81aa0e-6201-484d-a0fb-c1ae89736d11", BB = `https://backblaze.pixellab.ai/file/pixellab-characters/${ACC}`;
const MOBS = {
  grin: { char: "374b7203-a8ad-4a82-897b-cb013270ffa3", idle: "618bbcc3-2067-4295-b006-2d9e29c2ce5b", walk: "1e25d7d1-b95e-4e12-af43-dc9bae753544", attack: "ab561321-7e7b-41b6-b6be-e21238c8f198", scale: 2 }
};
const OBJECTS = { o_grinhead: "293849a7-5176-4b69-bf24-26afef40511a", pet_grinling: "3271933b-f0c5-4703-92f3-f8982e3b326d" };
const ONLY = process.argv.slice(2);
const grab = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); };
const write = async (name, buf, scale = 1) => {
  const out = `${OUT}${name}.png`;
  let img = sharp(await sharp(buf).trim({ threshold: 1 }).png().toBuffer());
  if (scale !== 1) { const m = await img.metadata(); img = img.resize(m.width * scale, m.height * scale, { kernel: "nearest" }); }
  const info = await img.png({ palette: true, compressionLevel: 9 }).toFile(out);
  console.log(`  ${name.padEnd(16)} ${info.width}x${info.height}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
};
const framesOf = async (char, anim) => { const out = []; for (let i = 0; i < 16; i++) { const r = await fetch(`${BB}/${char}/animations/${anim}/east/${i}.png`); if (!r.ok) break; out.push(Buffer.from(await r.arrayBuffer())); } return out; };
for (const [key, m] of Object.entries(MOBS)) {
  if (ONLY.length && !ONLY.includes(key)) continue;
  try {
    await write(key, await grab(`${BB}/${m.char}/rotations/east.png`), m.scale);
    if (m.idle) { const f = await framesOf(m.char, m.idle); if (f.length) await write(`${key}_i2`, f[Math.floor(f.length / 2)], m.scale); }
    if (m.walk) { const f = await framesOf(m.char, m.walk); for (let i = 0; i < 4 && f.length; i++) await write(`${key}_w${i + 1}`, f[Math.floor((i * f.length) / 4)], m.scale); }
    if (m.attack) { const f = await framesOf(m.char, m.attack); for (let i = 0; i < 4 && f.length; i++) await write(`${key}_a${i + 1}`, f[Math.min(f.length - 1, Math.floor(((i + 0.5) * f.length) / 4))], m.scale); }
  } catch (e) { console.log(`  !! ${key}: ${e.message}`); }
}
for (const [key, id] of Object.entries(OBJECTS)) { if (ONLY.length && !ONLY.includes(key)) continue; try { await write(key, await grab(`https://api.pixellab.ai/mcp/map-objects/${id}/download`)); } catch (e) { console.log(`  !! ${key}: ${e.message}`); } }

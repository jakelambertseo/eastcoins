/* EastScape: THE FLOOD's art, from PixelLab (2026-09-30) —  node tools/eastscape-flood-art.mjs
   The owner: "make custom art for all four". Drawn from the style brief (tools/eastscape-art-style.md), each monster one PixelLab character so
   every frame is the same creature:
     drowned     The Drowned            <key>, _i2, _w1-4, _a1-4
     bankshark   the Bank Shark         (the same set)
     undertow    The Undertow, the boss (the same set)
     o_sandbags  a sandbag spot         one picture (a map object)
   The world draws a monster from its EAST picture and mirrors it for west, so every frame here is the east facing. Frames come back on canvases
   of different sizes (an animation's silhouette grows its canvas); registerArt() in the page anchors each picture on its own middle and its
   feet, so each is simply trimmed to its pixels, never resampled (pixel art). The standing picture is the character's east rotation; _i2 is
   the middle of its breathing idle; _w is a four-frame walk; _a a four-frame attack.
   Ids are below; an animation id missing is looked up from the character (needs PIXELLAB_KEY) and printed so it can be written down. */
import fs from "node:fs";
const sharp = (await import("sharp")).default;
const OUT = "v3/assets/img/glad/flat/", ACC = "4e81aa0e-6201-484d-a0fb-c1ae89736d11", BB = `https://backblaze.pixellab.ai/file/pixellab-characters/${ACC}`;
/* key -> { char, idle, walk, attack } (animation ids) */
const MOBS = {
  drowned: { char: "194dd2c0-d578-48f6-83d2-af3539c0bb75", idle: "36c71832-a92f-4ca5-90b3-bb7328767107", walk: "baf9d518-1148-4af6-bee3-77514403d0c6", attack: "dc26fd00-7559-4fdc-b1b1-00f50e95bae8" },
  bankshark: { char: "83661c1f-48c1-497c-b33f-f21533696930", idle: "0bdc1c3d-932e-49e0-9db1-5b7795e03ccf", walk: "a6ab8404-af31-4271-917f-2a259da204bf", attack: "452ea200-df69-4cad-a014-0c5904b7b79a" },
  undertow: { char: "9fd3e452-475c-480d-98fd-2433f677ef09", idle: "badb1857-6c2c-4569-a89b-e1fbf0b7af78", walk: "15069cc4-13ad-4629-b336-565df655c4f1", attack: "6c27b110-4960-4e6a-8b5e-f0f8d1855660" }
};
const OBJECTS = { o_sandbags: "72310aa2-2546-426c-8470-c53689ce9eed" };
const ONLY = process.argv.slice(2);
const grab = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); };
const write = async (name, buf) => { const out = `${OUT}${name}.png`, info = await sharp(buf).trim({ threshold: 1 }).png({ palette: true, compressionLevel: 9 }).toFile(out); console.log(`  ${name.padEnd(16)} ${info.width}x${info.height}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`); };
/** how many frames an animation has: count east/<i>.png until one is missing */
const framesOf = async (char, anim) => { const out = []; for (let i = 0; i < 16; i++) { const r = await fetch(`${BB}/${char}/animations/${anim}/east/${i}.png`); if (!r.ok) break; out.push(Buffer.from(await r.arrayBuffer())); } return out; };
for (const [key, m] of Object.entries(MOBS)) {
  if (ONLY.length && !ONLY.includes(key)) continue;
  try {
    await write(key, await grab(`${BB}/${m.char}/rotations/east.png`));
    if (m.idle) { const f = await framesOf(m.char, m.idle); if (f.length) await write(`${key}_i2`, f[Math.floor(f.length / 2)]); }
    if (m.walk) { const f = await framesOf(m.char, m.walk); for (let i = 0; i < 4 && f.length; i++) await write(`${key}_w${i + 1}`, f[Math.floor((i * f.length) / 4)]); }
    if (m.attack) { const f = await framesOf(m.char, m.attack); for (let i = 0; i < 4 && f.length; i++) await write(`${key}_a${i + 1}`, f[Math.min(f.length - 1, Math.floor(((i + 0.5) * f.length) / 4))]); }
  } catch (e) { console.log(`  !! ${key}: ${e.message}`); }
}
for (const [key, id] of Object.entries(OBJECTS)) { if (ONLY.length && !ONLY.includes(key)) continue; try { await write(key, await grab(`https://api.pixellab.ai/mcp/map-objects/${id}/download`)); } catch (e) { console.log(`  !! ${key}: ${e.message}`); } }

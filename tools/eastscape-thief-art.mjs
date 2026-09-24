/* The Thieves' Guild's item icons, its four NPCs and its floor tile, from PixelLab into the game (2026-09-23).

   Three kinds of asset, three destinations, and they are NOT interchangeable:

     items/<key>.png     32x32 inventory icons. The key must also be added to ITEM_ART in eastscape.html, which is
                         an explicit allowlist - an icon that is not in that Set is simply never looked for and
                         the item keeps its emoji.
     <art>_south.png     an NPC's facings. BOTH come from ONE character, per the style brief: generated as two
     <art>_east.png      prompts they come back as two different people in different clothes.
     t_guild.png         the floor. Kept at its generated 32x32 and NOT trimmed - a tile is a texture, and
                         trimming one would shift the seam.

   Sprites are trimmed to their alpha bounding box (PixelLab pads to a large square) but never RESAMPLED: these
   are pixel art and scaling would soften the outlines the whole style brief is about.

     node tools/eastscape-thief-art.mjs
*/
import fs from "node:fs";
import sharp from "sharp";

const FLAT = "v3/assets/img/glad/flat";
const ITEMS = `${FLAT}/items`;
const ACC = "4e81aa0e-6201-484d-a0fb-c1ae89736d11";

const ICONS = [
  ["brass_button", "efa78875-8071-4201-b6b7-fc0b9755d0ac"],
  ["pocket_watch", "7ee413f2-c10c-45b6-8f3b-e00024903fb7"],
  ["stolen_signet", "d23d5bd6-682e-4cb9-b667-ee35f183a2c3"],
  ["blackmarket_ledger", "22f12504-718e-4a84-b9d9-9d6a0ee1ceea"],
  ["whetgrit", "c710c4e3-457b-4ccf-9dde-d2c283ac901d"],
  ["quench_salts", "97948f32-f4e4-4170-95b5-18d0b20af0c8"],
  ["seal_wax", "a1d3a578-f7bb-4a16-ad0d-da39149f402c"],
  ["temper", "9fe1dde6-43e8-41a1-ae80-951f2713b904"],
  ["flux", "ec75c206-4fcd-471b-b864-bb66e10c5ff0"],
  ["masters_seal", "8cade0e6-d4fe-4e5a-aa6d-26153ff50b9c"],
  ["thieves_permit", "0a1defa3-f522-4868-afe6-c75ee4f523c9"],
];
const NPCS = [
  ["pete", "23a669bb-c4d5-40b5-b61f-5caf4c9dbc6b"],
  ["marla", "c7f94c31-e813-42a6-abfb-70ff77b1fe33"],
  ["quietman", "84a97a83-a3af-4e0c-998d-996991a66cb2"],
  ["odile", "d88cf3ab-fcc4-46e9-af0c-9f937aa87f10"],
  ["vance", "3c0ec11d-3ff5-4a1f-ad7c-d503eabe8942"],
];
const FLOOR = process.env.FLOOR_JOB || "e78f2a03-73b8-4e93-958a-7cfbceb3779b";

const grab = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); };

for (const [key, job] of ICONS) {
  try {
    const src = await grab(`https://api.pixellab.ai/mcp/images/${job}/download`);
    const out = await sharp(src).png({ compressionLevel: 9, palette: true }).toBuffer();
    fs.writeFileSync(`${ITEMS}/${key}.png`, out);
    const m = await sharp(out).metadata();
    console.log(`  items/${key}.png`.padEnd(34) + `${m.width}x${m.height}  ${(out.length / 1024).toFixed(1)} KB`);
  } catch (e) { console.log(`  !! ${key}: ${e.message}`); }
}

for (const [art, id] of NPCS) {
  for (const dir of ["south", "east"]) {
    try {
      const src = await grab(`https://backblaze.pixellab.ai/file/pixellab-characters/${ACC}/${id}/rotations/${dir}.png`);
      const out = await sharp(src).trim({ threshold: 0 }).png({ compressionLevel: 9, palette: true }).toBuffer();
      fs.writeFileSync(`${FLAT}/${art}_${dir}.png`, out);
      const m = await sharp(out).metadata();
      console.log(`  ${art}_${dir}.png`.padEnd(34) + `${m.width}x${m.height}  ${(out.length / 1024).toFixed(1)} KB`);
    } catch (e) { console.log(`  !! ${art}_${dir}: ${e.message}`); }
  }
}

try {
  const src = await grab(`https://api.pixellab.ai/mcp/images/${FLOOR}/download`);
  const out = await sharp(src).png({ compressionLevel: 9, palette: true }).toBuffer();   // NOT trimmed: it is a tile
  fs.writeFileSync(`${FLAT}/t_guild.png`, out);
  const m = await sharp(out).metadata();
  console.log(`  t_guild.png`.padEnd(34) + `${m.width}x${m.height}  ${(out.length / 1024).toFixed(1)} KB`);
} catch (e) { console.log(`  !! t_guild: ${e.message}`); }

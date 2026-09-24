/* EastScape: the walk cycles —  node tools/eastscape-walk-art.mjs
   Pulls each monster's EAST walk animation out of PixelLab and writes <mob>_w1..w4.png into the game's art folder.
   WHY EAST: the world draws a monster from its east rotation and mirrors it for west, so the cycle has to be that same pose.
   The frames come back on a bigger canvas than the idle picture (the silhouette grows it: a 36px chicken animates at 48px),
   which does not matter — registerArt() measures the drawn pixels and anchors on their middle and their feet — so they are
   trimmed here to save bytes and nothing else.
   The character and animation ids are below. A monster with no entry simply has no cycle and is drawn as it always was. */
import fs from "node:fs";
const OUT = "v3/assets/img/glad/flat/", ACC = "4e81aa0e-6201-484d-a0fb-c1ae89736d11";
const sharp = (await import("sharp")).default;
/* mob key -> [character id, animation id]  (animate_character, mode v3, east, 4 frames, keep_first_frame false) */
const WALKS = {
  chicken:  ["5e6ae936-0e3e-42d1-bb52-3a4674eed251", "8f334062-68ed-4c98-b1a5-1288cc08d181"],
  rotten:   ["b18af3cb-4ee2-47d6-95a0-e193652b7f8e", "f6729c74-a0c9-4b34-82e0-4265bfb57a7d"],
  olive:    ["fa7ca86f-cb53-44aa-81d9-414db4522887", "69ca3bee-dfe2-461f-ac57-d8510bbd2f35"],
  cow:      ["2642667f-32bc-4d36-a2e2-b4a58fccb997", "fbcdaeda-4abd-4698-a92b-28ab7144b023"],
  hornworm: ["ac02f8e4-3766-40a2-b664-4f85a2e2fddb", "f900b350-2ecf-4112-affb-b9bb8a9f0aca"],
  boar:     ["8b859808-7d3d-474c-9e69-05a35be7212c", "19752fd7-749e-4210-9ea9-2d145d1d742d"]
};
const KEY = process.env.PIXELLAB_KEY || "";
/** the animation id for a character, from the MCP's own listing if it was not written down above */
async function animOf(charId, given) {
  if (given) return given;
  const r = await fetch(`https://api.pixellab.ai/mcp/characters/${charId}`, { headers: KEY ? { Authorization: `Bearer ${KEY}` } : {} });
  if (!r.ok) throw new Error(`cannot read character ${charId}: ${r.status} (put its animation id in WALKS, or set PIXELLAB_KEY)`);
  const j = await r.json(), a = (j.animations || [])[0];
  if (!a) throw new Error(`character ${charId} has no animation yet`);
  return a.id;
}
let wrote = 0;
for (const [mob, [charId, animId]] of Object.entries(WALKS)) {
  let id; try { id = await animOf(charId, animId); } catch (e) { console.log(`  skip ${mob}: ${e.message}`); continue; }
  for (let i = 0; i < 4; i++) {
    const url = `https://backblaze.pixellab.ai/file/pixellab-characters/${ACC}/${charId}/animations/${id}/east/${i}.png`;
    const r = await fetch(url); if (!r.ok) { console.log(`  skip ${mob} frame ${i + 1}: ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer()), out = `${OUT}${mob}_w${i + 1}.png`;
    const info = await sharp(buf).trim({ threshold: 1 }).png({ palette: true }).toFile(out);
    console.log(`  ${mob}_w${i + 1}.png  ${info.width}x${info.height}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`); wrote++;
  }
}
console.log(`${wrote} frames written.`);

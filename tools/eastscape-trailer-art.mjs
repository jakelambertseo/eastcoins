/* EastScape: the Trailer Park's art —  node tools/eastscape-trailer-art.mjs
   (2026-09-22) The level-80 zone north of the Thunderhead. Prompts start from tools/eastscape-art-style.md.

   SIZE IS THE WHOLE JOB HERE. The generator returns whatever canvas it was asked for and the game draws a monster
   at its own pixel size, so an un-normalised set has a possum the size of a gator. Each piece is trimmed of its
   empty margin and then scaled to a HEIGHT that matches the existing mobs of its size class — the Last Dealer is
   67 tall, a boar 68, a chicken 36, The House (the only other xl) 128. Width follows the aspect. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/", TMP = "lt-tp/"; fs.mkdirSync(TMP, { recursive: true });
/* [key, pixellab id, target height]. The heights are read off the mobs already in the game, not invented. */
const PIECES = [
  ["junkdog", "76cc6a84-bfb3-41b7-8587-e31544bf026b", 42],    // size "s", a shade bigger than a chicken
  ["possum", "25fdeead-1fcd-4fc7-bbf6-9e14ca37b95b", 38],     // size "s"
  ["scrapper", "0ae0ace1-bcbb-40d7-92b4-4b5b2ee5be9b", 66],   // size "m", the Last Dealer's height
  /* (2026-09-22, redrawn) The first gator asked for "algae and duckweed on its back" and the generator gave it a
     flowerbed to lie in — a bed of reeds and lily pads baked into the sprite, which followed it around the map.
     Saying what must NOT be there, item by item ("no plants, no grass, no water, no ground, no base"), is what got
     the animal on its own. Worth remembering for any sprite that lives in a particular kind of place. */
  ["gator", "e84bf5b2-6e4b-4ca8-a9f2-94e8949800b9", 38],      // size "l"; sized so it comes out ~86 WIDE, because a gator is long rather than tall and the redraw is a longer animal than the first one
  ["junkking", "9c17ae87-4f3d-4964-a1c8-2a02d3a1e67a", 110],  // size "xl"; The House is 128 and the King is not quite a building
  /* the zone's scenery. Heights are read off what is already in the world: a willow is 92 tall, a rock about 50,
     and a building has to read as somewhere people live without swallowing the three tiles it stands on. */
  ["o_trailer", "8da8bad9-cb7e-4636-b728-b67b56afd01d", 78],
  ["o_wreck", "2b573934-b291-441e-b50f-e4711ca4c2e9", 52],
  ["o_tyres", "e751b149-06cd-4079-beb8-ab89e56262be", 46],
  ["o_dumpster", "9bee723f-1149-4685-b67c-5ef9bba28d80", 48],
  ["o_rock_slagstone", "defdb215-d4df-4e9d-b5ee-9c7bd5aa4ffa", 48],
  ["o_rustpine", "19a71fc1-d25f-475e-8d45-ea94e6ef34c7", 88],
  ["o_bogwood", "c236ad36-7b2d-4621-8727-3b8f4ca3e860", 88]
];
let got = 0, bytes = 0; const missing = [];
for (const [k, id, h] of PIECES) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw)) {
    const r = await fetch(`https://api.pixellab.ai/mcp/images/${id}/download`);
    if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(`${k} (${r.status})`); continue; }
    fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  }
  const t = await sharp(raw).ensureAlpha().trim({ threshold: 1 }).toBuffer(), m = await sharp(t).metadata();
  const w = Math.max(1, Math.round((m.width / m.height) * h));
  await sharp(t).resize(w, h, { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(`${OUT}${k}.png`);
  got++; bytes += fs.statSync(`${OUT}${k}.png`).size;
  console.log(`  ${k.padEnd(10)} ${m.width}x${m.height} -> ${w}x${h}`);
}
console.log(`${got} sprites, ${Math.round(bytes / 1024)} KB${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

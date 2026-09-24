/* EastScape: THE GREAT PYRAMID's monsters —  node tools/eastscape-pyramid-art.mjs
   (2026-09-24) The party dungeon under the Golden Sands. Prompts start from tools/eastscape-art-style.md.

   ALL OF IT IS ITS OWN (the owner: "all unique art in there for mobs"). The Crypt's four monsters are not
   reused and neither are the Golden Sands' four: a dungeon whose rooms look like the map outside it is a
   corridor, not a place. The pharaoh drawn with the Sands is the BOSS ROOM's mob rather than the boss, because
   the owner wants "the boss to be a giant snake, and its room mobs are pharoahs".

   SIZE IS THE JOB, as in every art tool here: trimmed of its margin, then scaled to a HEIGHT read off what is
   already in the world. The Hoodie - the Crypt's boss, the only other thing of this rank - is 136 tall, so the
   serpent is 148: bigger than the Hoodie, which is the point of it. A pet is 32.

   TWO WERE DRAWN TWICE. The canopic jar came back as a plain sack with feet - no jackal head, no arms, no glowing
   crack - and the sand wraith as a featureless orange blob. Both were fixed the same way: name the SILHOUETTE in
   parts ("the lid IS a carved jackal head", "the top half is a humanoid mummy torso, below the waist it
   dissolves into a spiral funnel of sand") rather than describing a mood. A generator will draw a shape you
   specify and invent a blob if you only give it an adjective. */
import sharp from "sharp"; import fs from "fs";
const OBJ = "v3/assets/img/glad/flat/", ITEM = "v3/assets/img/glad/flat/items/", TMP = "lt-pyr/"; fs.mkdirSync(TMP, { recursive: true });

/* [key, pixellab id, target height] */
const PIECES = [
  ["squeeze", "1c018c04-0e79-4eb4-9763-fb511540539f", 148],   // the boss. The Hoodie is 136
  ["grifter", "1b95251c-4b01-4a18-ab33-495d22408919", 66],    // size m, the Last Dealer's height
  ["canopic", "717a65b0-dd50-4e58-98bc-a34c4a9296fe", 62],    // redrawn
  ["dustwraith", "1e398c8c-1796-4b6e-8e61-ad5902af0a50", 64], // redrawn
  ["swarm", "e145d317-f12d-4750-9d09-57f5825ca36c", 44],      // size s, low and wide
  ["pet_coilling", "6fefe303-0241-42a8-8b45-871b6327f08a", 32],   // every pet in the game is 32
  ["serpentvenom", "36a2ecf3-2d6c-47b8-ad2e-ed525f66870b", 32, "item"],   // the ingredient only this dungeon gives
];

let got = 0, bytes = 0; const missing = [];
for (const [k, id, h, kind] of PIECES) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw)) {
    let ok = false;
    for (const url of [`https://api.pixellab.ai/mcp/map-objects/${id}/download`, `https://api.pixellab.ai/mcp/images/${id}/download`]) {
      const r = await fetch(url);
      if (r.ok && /image/.test(r.headers.get("content-type") || "")) { fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); ok = true; break; }
    }
    if (!ok) { missing.push(k); continue; }
  }
  const t = await sharp(raw).ensureAlpha().trim({ threshold: 1 }).toBuffer(), m = await sharp(t).metadata();
  const out = (kind === "item" ? ITEM : OBJ) + k + ".png";
  if (kind === "item") {
    /* an item icon is a squared 32x32 box, padded on both axes - see eastscape-sands-art.mjs for why both */
    const box = await sharp(t).resize(32, 32, { kernel: "nearest", fit: "inside" }).toBuffer(), bm = await sharp(box).metadata();
    await sharp(box).extend({ top: Math.floor((32 - bm.height) / 2), bottom: Math.ceil((32 - bm.height) / 2), left: Math.floor((32 - bm.width) / 2), right: Math.ceil((32 - bm.width) / 2), background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true, colours: 64 }).toFile(out);
  } else {
    const w = Math.max(1, Math.round((m.width / m.height) * h));
    await sharp(t).resize(w, h, { kernel: "nearest" }).png({ palette: true, colours: 64 }).toFile(out);
  }
  const size = fs.statSync(out).size, mm = await sharp(out).metadata();
  console.log(`  ${k.padEnd(14)} ${String(mm.width).padStart(3)}x${mm.height}  ${(size / 1024).toFixed(1)} KB  ${kind || "obj"}`);
  got++; bytes += size;
}
if (missing.length) console.log(`\n  NOT DOWNLOADED: ${missing.join(", ")}`);
console.log(`\n${got} picture(s), ${(bytes / 1024).toFixed(1)} KB total`);

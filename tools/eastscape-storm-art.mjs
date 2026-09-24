/* EastScape: the Thunderhead's art and the four missing ore rocks —  node tools/eastscape-storm-art.mjs
   (2026-09-24) Prompts start from tools/eastscape-art-style.md, as everything does.

   THE FOUR ROCKS ARE THE POINT. objArt() resolves a rock to `o_rock_<ore>`, and starfall, eclipse, voidglass and
   catalytic had no such picture — so four ores, three of them the top of the mining ladder, drew as the generic
   hand-drawn grey lump. Slagstone and stardust had pictures; these four never did.

   SIZE IS THE JOB, exactly as in eastscape-trailer-art.mjs: the generator returns whatever canvas it was asked
   for and the game draws an object at its own pixel size. Each piece is trimmed of its empty margin and scaled
   to a HEIGHT read off what is already in the world - a rock is about 48 (slagstone, the most recent one), a
   willow 92 - rather than a number invented here.

   THE ARCH WAS DRAWN TWICE. The first one came back standing on a floating grassy island, baked into the sprite,
   which would have followed it around a storm map with no grass on it. Same failure as the Trailer Park's gator
   and the same fix: say what must NOT be there item by item ("no island, no grass, no dirt, no soil, no rock
   platform, no ground, no terrain, no plants, no moss, no base, no pedestal"), and drop the words that invite
   scenery - "sky temple" and "floating" are what put it on an island in the first place. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/", TMP = "lt-storm/"; fs.mkdirSync(TMP, { recursive: true });

/* [key, pixellab id, target height] */
const PIECES = [
  /* the ore rocks. 48 is slagstone's height, the only other high-tier rock with a picture. */
  ["o_rock_starfall_ore", "48cc3e03-4ca9-4b59-bb40-597452cbb262", 48],
  ["o_rock_eclipse_ore", "420901e9-114c-4e93-9dd1-f4eb50b29918", 48],
  ["o_rock_voidglass", "91ac4b30-abab-4d25-b392-9e7b7fb05393", 48],
  ["o_rock_catalytic", "6d60f19d-3cdd-4194-966a-c0f3c7c650af", 48],
  /* the Thunderhead's own scenery: taller than a rock, shorter than a tree, because they are meant to be
     landmarks you steer by on a map whose whole floor is the same colour. */
  ["o_runestone", "bdc695de-c552-428e-a12f-b5e58cd21b05", 72],
  ["o_stormcrystal", "59fb89b1-90aa-40f9-bdc7-d2932602cd9c", 58],
  ["o_skyarch", "3117226f-ab9f-433a-9d82-0228a8cc478f", 82],
];

let got = 0, bytes = 0; const missing = [];
for (const [k, id, h] of PIECES) {
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
  const w = Math.max(1, Math.round((m.width / m.height) * h));
  await sharp(t).resize(w, h, { kernel: "nearest" }).png({ palette: true, colours: 64 }).toFile(OUT + k + ".png");
  const size = fs.statSync(OUT + k + ".png").size;
  console.log(`  ${k.padEnd(22)} ${String(w).padStart(3)}x${h}  ${(size / 1024).toFixed(1)} KB`);
  got++; bytes += size;
}
if (missing.length) console.log(`\n  NOT DOWNLOADED: ${missing.join(", ")}`);
console.log(`\n${got} picture(s), ${(bytes / 1024).toFixed(1)} KB total`);

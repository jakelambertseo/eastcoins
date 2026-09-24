/* EastScape: The Golden Sands and Alchemy —  node tools/eastscape-sands-art.mjs
   (2026-09-24) Prompts start from tools/eastscape-art-style.md, as everything does.

   SIZE IS THE JOB, as in eastscape-trailer-art.mjs and eastscape-storm-art.mjs: the generator returns whatever
   canvas it was asked for and the game draws an object at its own pixel size, so each piece is trimmed of its
   empty margin and scaled to a HEIGHT read off what is already in the world rather than a number invented here.
   The mobs are sized against their own class - a chicken is 36, a scrapper 66, The House 128 - and the scenery
   against the trees and rocks it stands among.

   ITEM ICONS ARE 32x32 and live in flat/items/, which is a different directory and a different size from
   everything else; getting that wrong draws a vial the size of a palm tree. */
import sharp from "sharp"; import fs from "fs";
const OBJ = "v3/assets/img/glad/flat/", ITEM = "v3/assets/img/glad/flat/items/", TMP = "lt-sands/";
fs.mkdirSync(TMP, { recursive: true });

/* [file key, pixellab id, target height, "obj" | "item"] */
const PIECES = [
  /* the map */
  ["o_pyramid", "ef0a37fc-6098-4943-8b7f-bd537b5f84b6", 130, "obj"],   // a landmark: The House is 128
  ["o_obelisk", "a980cff0-9c1c-4951-aa8a-a77e8e0455fb", 96, "obj"],
  /* (2026-09-24) o_dateP ALM, NOT o_palm. o_palm ALREADY EXISTED - the tropical palm the four island maps are
     planted with - and writing this over it swapped every one of them for a date palm. The style brief says
     "check flat/ and AREA_ART for the name first" and this is the second time that has bitten. */
  ["o_datepalm", "89ccffcf-a831-48cc-b097-9e096ad59ead", 96, "obj"],   // a willow is 92
  ["o_sandpit", "e29fd77f-5762-497e-9299-fd04cfb2e480", 46, "obj"],    // a rock is about 48
  ["o_cauldron", "23f61e62-380b-4f40-84c4-bb7882967e14", 58, "obj"],
  /* the monsters */
  ["cobra", "2b56c4ff-1ec0-4792-8bec-8aee7911e31f", 44, "obj"],        // size s, rearing
  ["scarab", "dc9172bb-464d-40fa-8288-0d089815e7de", 38, "obj"],       // size s
  ["mummy", "97327c11-8b9a-4ed1-9987-ad7f07bb1bd1", 62, "obj"],        // size m
  ["jackal", "68e5e620-484f-46de-a01c-fb9a3c0a15c0", 66, "obj"],       // size m, the Last Dealer's height
  ["pharaoh", "72ee0b20-8b95-480e-807a-cf1bf9fa88fd", 110, "obj"],     // the pyramid's boss, for its own build
  /* the icons */
  ["sand", "92c3faa4-d656-42fa-bb12-b44dd4985672", 32, "item"],
  ["small_vial", "dec6369d-1cc0-4218-a0a8-5cb3f3542bae", 32, "item"],
  ["medium_vial", "5983e60e-cf9e-4bca-9483-b6e7bbc97f2a", 32, "item"],
  ["large_vial", "2ce950ab-a381-4f35-ab8f-f93fc12ddc04", 32, "item"],
  ["scarabshell", "b66d7792-8533-473f-9dfe-d11605b5dd87", 32, "item"],
  ["snakefang", "d422c138-c9db-4e59-9b30-e39f2442a65c", 32, "item"],
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
  /* an ITEM ICON is a fixed 32x32 box, letterboxed so a tall vial and a squat shell both sit in the same cell.
     An OBJECT is scaled by HEIGHT and keeps its aspect, because the world draws it at its own size. */
  if (kind === "item") {
    const box = await sharp(t).resize(32, 32, { kernel: "nearest", fit: "inside" }).toBuffer();
    const bm = await sharp(box).metadata();
    /* padded on BOTH axes: every other icon in the game is exactly 32x32, and a 32x24 one sits differently in
       the cell. fit:"inside" only guarantees it fits, so whichever side came up short gets the padding. */
    await sharp(box).extend({
      top: Math.floor((32 - bm.height) / 2), bottom: Math.ceil((32 - bm.height) / 2),
      left: Math.floor((32 - bm.width) / 2), right: Math.ceil((32 - bm.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png({ palette: true, colours: 64 }).toFile(out);
  } else {
    const w = Math.max(1, Math.round((m.width / m.height) * h));
    await sharp(t).resize(w, h, { kernel: "nearest" }).png({ palette: true, colours: 64 }).toFile(out);
  }
  const size = fs.statSync(out).size;
  const mm = await sharp(out).metadata();
  console.log(`  ${k.padEnd(14)} ${String(mm.width).padStart(3)}x${String(mm.height).padEnd(3)} ${(size / 1024).toFixed(1).padStart(5)} KB  ${kind}`);
  got++; bytes += size;
}
if (missing.length) console.log(`\n  NOT DOWNLOADED: ${missing.join(", ")}`);
console.log(`\n${got} picture(s), ${(bytes / 1024).toFixed(1)} KB total`);

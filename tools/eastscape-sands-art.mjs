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
  /* (2026-09-24) ALL FIFTEEN POTIONS get their own icon after all. The bottle SHAPE carries the tier - squat for
     a small vial, round-bodied for a medium, broad and corded for a large flask - and the liquid carries the
     effect, so a bag full of them reads at a glance without reading a single name. */
  ["pot_swift", "db8c10b1-cab5-4700-936c-d3e02552de6b", 32, "item"],
  ["pot_hide", "04fcb724-115b-44ea-871f-b7034eab1cac", 32, "item"],
  ["pot_keen", "a434e964-daab-44d1-a386-52c5612cdc2c", 32, "item"],
  ["pot_salve1", "0d5ae47d-cd55-4959-9aae-22977ca3a69f", 32, "item"],
  ["pot_rattle", "73596c52-317c-4d3c-861d-2685ed44729d", 32, "item"],
  ["pot_quick", "285374b0-d98d-4860-bbb4-02e718713d03", 32, "item"],
  ["pot_gourd", "8a92c916-d519-45d9-a48f-dca420882770", 32, "item"],
  ["pot_salve2", "c7fda59b-6a1f-434f-abb1-44b9a1009138", 32, "item"],
  ["pot_ghost", "6b19483a-2649-4f67-b08a-eec93d456958", 32, "item"],
  ["pot_purse", "10a85ddf-8fd7-426e-bf5e-834c1424a40c", 32, "item"],
  ["pot_prospect", "04d813be-0eb2-4922-9a6e-81a18929e088", 32, "item"],
  ["pot_fang", "368476af-17fe-407a-b068-59367f6d5f29", 32, "item"],
  ["pot_salve3", "529e48d0-c8c4-4d8e-ab39-7540392086cf", 32, "item"],
  ["pot_storm", "0e70b25f-757c-4b8f-9153-a10548dfa6fd", 32, "item"],
  ["pot_pharaoh", "085cc1bc-cebb-45a5-8032-97d752d309a0", 32, "item"],
  /* (2026-09-24, the owner: "generate a few alternative arts of the sand pits, feels too monotamous right now")
     Five identical pits in one corner read as wallpaper. Three more, chosen per PLACEMENT. */
  ["o_sandpit2", "86fd94e5-9dde-4da8-be45-a2d01865020c", 46, "obj"],
  ["o_sandpit3", "8432cd14-74a3-480a-aaae-8d22e656e65e", 46, "obj"],
  ["o_sandpit4", "47733805-5809-45ae-9fa4-51f07e2f85f9", 46, "obj"],
  ["o_cactus", "119bc3f8-cc3d-41ea-809c-957ed4f0e17a", 52, "obj"],   // the desert theme's scattered bush
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
/* ------------------------------------------------------------ THE SAND FLOOR (2026-09-24)
   The owner: "the golden sands ground tile needs to be more sandy, and not repeating". It was neither: the map
   had no `ground` theme at all, so it drew the DEFAULT floor - t_dirt, a Wang sheet of brown path on GREEN
   GRASS - with the painter's grass tufts and flowers on top. A desert of lawn.

   THIS RECOLOURS THE SHEET RATHER THAN GENERATING ONE. A Wang sheet is sixteen tiles whose corners must agree
   exactly, and it is the one art job here that has come back unusable (the Crypt's first looked like a canal).
   Recolouring leaves the GEOMETRY untouched, so it is guaranteed to tile as well as the original - and t_dirt
   has only eighteen colours, cleanly split into grass greens and path browns, so "turn the grass into sand and
   leave the path" is an exact operation rather than a filter.

   The path stays brown on purpose: a track worn through sand IS subtler than one through grass. */
const SAND_DARK = [150, 118, 70], SAND_LIGHT = [243, 223, 170];
const sandify = async (from, to) => {
  const { data, info } = await sharp(OBJ + from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > r && g > b) {
      /* a grass pixel: keep its LUMINANCE and put it on a sand ramp, so every shade of grass becomes the
         matching shade of sand and the sheet's own shading survives intact. */
      const L = Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 190);
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(SAND_DARK[k] + (SAND_LIGHT[k] - SAND_DARK[k]) * L);
    } else { data[i] = Math.min(255, r + 8); data[i + 2] = Math.max(0, b - 6); }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 48 }).toFile(OBJ + to);
  console.log(`  ${to.padEnd(14)} ${info.width}x${info.height}  ${(fs.statSync(OBJ + to).size / 1024).toFixed(1)} KB  recoloured from ${from}`);
};
await sandify("t_dirt.png", "t_sand.png");
await sandify("t_water.png", "t_swater.png");   // its dry corners are grass too, so the oasis shore needs it as well

/* AND THE PAVING (2026-09-24, the owner: "make the pathways some type of stone tiles too"). t_brick is the grey
   market paving the Yard's courts and roads are drawn with; this is the same stone cut from sandstone instead.
   Every pixel goes on one warm ramp by luminance - brick is nearly greyscale already, so there is no colour to
   preserve, and the mortar lines and block edges that make it read as STONE all survive untouched. */
const STONE_DARK = [132, 104, 70], STONE_LIGHT = [234, 208, 160];
{
  const { data, info } = await sharp(OBJ + "t_brick.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const L = Math.min(1, (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 210);
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(STONE_DARK[k] + (STONE_LIGHT[k] - STONE_DARK[k]) * L);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 48 }).toFile(OBJ + "t_sandstone.png");
  console.log(`  t_sandstone    ${info.width}x${info.height}  ${(fs.statSync(OBJ + "t_sandstone.png").size / 1024).toFixed(1)} KB  recoloured from t_brick.png`);
}

console.log(`\n${got} picture(s), ${(bytes / 1024).toFixed(1)} KB total`);

/* EastScape: the Yard market's art —  node tools/eastscape-market-art.mjs
   (2026-09-22) Three pieces for the two paved courts by the casino door: the brick floor and the two fence
   orientations. The fences and floor had been drawn in code since the farm map (fillRect rails, a running-bond
   pattern in two greys) and looked it next to the PixelLab scenery standing on them.

   THE FLOOR IS NOT A MAP OBJECT. Asked for as one, create_map_object returned a completely EMPTY 32x32 tile — that
   tool draws a thing on transparency, and "a seamless floor" has no thing in it. A full-bleed texture is
   create_image_pixflux with no_background:false, which is what t_brick is. Worth remembering for any future ground.

   Output: v3/assets/img/glad/flat/t_brick.png (kept at a full 32px square: it tiles edge to edge, so trimming it
   would put gaps between the bricks) and o_fenceh/o_fencev.png (trimmed, like the rest of the scenery).
   The page keeps its old code drawings as the fallback, so a missing file is a plainer market, never a hole. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/", TMP = "lt-market/"; fs.mkdirSync(TMP, { recursive: true });
/* (2026-09-22, second pass) THE RAIL IS DRAWN FRONT-ON, and there is only one of it.

   The first pair were map objects asked for at "high top-down", which draws a fence in PERSPECTIVE — the owner,
   testing: "the fences need to all face horizontal, theyre slanted at the moment". Asking for it as a side-view
   IMAGE, and saying "no perspective, no angle" twice, gives two level rails between two posts, which is what tiles
   into a straight run.

   There is no separate vertical piece any more. The rail stands about seven pixels in a sixteen-pixel tile, so a
   run going DOWN the screen is separate railings with gaps between them however it is drawn; the Yard's courts are
   railed along their long edges instead and open at the short ends. o_fencev is deliberately gone. */
const PIECES = [
  { k: "t_brick", id: "9b461002-6dfa-49c5-b981-5b798b03cc82", kind: "images", flat: true },
  { k: "o_fenceh", id: "83e8c49d-e866-415f-a9c7-99aad40009c9", kind: "images" },
  { k: "o_fencepost", id: "65ef4980-8639-4729-91a1-8276e7eedf66", kind: "map-objects" },
  /* the market's dressing (2026-09-22): the owner wanted the courts to "feel lived in" and sent concept art of a
     fenced yard with crates, barrels and lamps in it. Ordinary scenery — blocked, examinable, nothing to click. */
  /* NO o_crate AND NO o_barrel HERE, deliberately. Both already exist — the Fight Pit's corner clutter and the
     closed areas draw them — and a market crate and barrel were generated here before anyone checked, which
     overwrote them. The old crate is a crate of apples, which suits a market better than the plain box that
     replaced it, so the market reuses both under their own names and the new pair went in the bin. Check
     AREA_ART and the flat/ folder for a name before drawing anything called o_<something ordinary>. */
  { k: "o_crates", id: "bf20e15d-f3dc-460b-8144-6d7f000fd171", kind: "map-objects" },
  { k: "o_lamppost", id: "d3913887-5ba7-40f8-93c1-58459b299714", kind: "map-objects" },
  { k: "o_sacks", id: "2e1e944f-7e0b-4a4b-a2f5-ebd6ca5701b7", kind: "map-objects" },
  { k: "o_handcart", id: "d79ab28f-e4c9-433b-a4ac-d44015a04f98", kind: "map-objects" }
];
/* THE COURSES ARE DRAWN ON, not asked for. The generated texture is a lovely warm cream but its mortar lines are a
   shade or two off the brick, and a map tile is drawn at SIXTEEN pixels — at that size the courses vanished and the
   floor read as a flat wash. So the texture is kept for its colour and grain and a running-bond grid is burnt into
   it: courses every 8 source pixels, the head joints offset by half a brick on alternate courses, darkened rather
   than painted so every joint still carries the texture underneath. This is also why the tile stays 32px square
   and the page draws it at half size — the joints land on whole map pixels. */
async function brick(from, to) {
  const { data, info } = await sharp(from).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, COURSE = 8, BRICK = 16;
  const darken = (x, y, by) => { const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.round(data[i + c] * by)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bed = y % COURSE === 0;                                        // the horizontal joint between courses
    const head = (x + (Math.floor(y / COURSE) % 2) * (BRICK / 2)) % BRICK === 0;   // and the vertical one, offset every other course
    if (bed || head) darken(x, y, 0.72);                                 // (a highlight on the row under a joint was tried and read as a second joint)
  }
  await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(to);
}
let got = 0, bytes = 0; const missing = [];
for (const { k, id, kind, flat } of PIECES) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw) || !fs.statSync(raw).size) {
    const r = await fetch(`https://api.pixellab.ai/mcp/${kind}/${id}/download`);
    if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(`${k} (${r.status})`); continue; }
    fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  }
  if (flat) { await brick(raw, `${OUT}${k}.png`); }
  else await sharp(raw).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 }).toFile(`${OUT}${k}.png`);
  got++; bytes += fs.statSync(`${OUT}${k}.png`).size;
}
console.log(`${got} pieces, ${Math.round(bytes / 1024)} KB${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

/* THE VERTICAL RAIL IS THE HORIZONTAL ONE, TURNED. Asked for as its own drawing it came back as a GATE — posts at
   either end and slats between — which is a fine gate and useless as a run: the whole job of this piece is that a
   column of them JOINS, and only a picture whose rails touch the top and bottom edges can do that.

   Turning the front-on rail ninety degrees gives that for free, and gives it exactly: the horizontal piece already
   tiles end to end (that is what makes a run of it continuous), so the turned copy tiles top to bottom by the same
   property. It is also the same drawing, so the two edges of a court cannot drift apart in style the way two
   separate generations would. No generation is spent on it. */
await sharp(`${OUT}o_fenceh.png`).rotate(90).png({ compressionLevel: 9 }).toFile(`${OUT}o_fencev.png`);
console.log(`  o_fencev  turned from o_fenceh (${Math.round(fs.statSync(`${OUT}o_fencev.png`).size / 102.4) / 10} KB)`);

/* EastScape: The Run's artwork —  node tools/eastscape-run-art.mjs
   (2026-09-22) The agility course was drawn entirely in code: a wood floor from the generic interior painter,
   gates made of fillRect bars, and a finish line that was drawn by NOTHING AT ALL (objArt looks for o_agilend and
   there was no such file). Four pieces fix that.

   Prompts start from tools/eastscape-art-style.md, the owner's style brief — read it before adding anything here.

   THE FLOOR IS create_image_pixflux, not create_map_object: a map object is a thing drawn on transparency, and a
   seamless floor has no thing in it, so asked for that way it comes back empty. And it must contain NO LARGE
   FEATURE: the first track tile had one white slash and one dark blob, and eight of it across a room read as
   wallpaper. The painter also offsets alternate tiles by half, the same trick the market's brick uses.

   THE GATE IS TWO PIECES on purpose. The frame is always drawn, because you have to see where a gate is while it
   is open to judge the run; the bars are drawn clipped to how far they have fallen, which only works if they are
   their own picture. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/", TMP = "lt-run/"; fs.mkdirSync(TMP, { recursive: true });
const PIECES = [
  { k: "t_track", id: "bb8fb5a0-348e-4dec-8aba-2823880308b3", kind: "images", flat: true },
  { k: "o_gateframe", id: "2eefc1d5-a2bf-4bc7-9fe5-f69bff25d39c", kind: "images" },
  { k: "o_gatebars", id: "3f8fb997-bec5-4758-9908-31d6db178f61", kind: "images" },
  { k: "o_agilend", id: "91a0dd86-6af8-4197-9f5e-1677cada6c70", kind: "map-objects" }
];
let got = 0, bytes = 0; const missing = [];
for (const { k, id, kind, flat } of PIECES) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw) || !fs.statSync(raw).size) {
    const r = await fetch(`https://api.pixellab.ai/mcp/${kind}/${id}/download`);
    if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(`${k} (${r.status})`); continue; }
    fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  }
  const im = sharp(raw).ensureAlpha();
  // the floor keeps its full square (it tiles edge to edge); everything else is trimmed like the rest of the scenery
  await (flat ? im.removeAlpha() : im.trim({ threshold: 1 })).png({ compressionLevel: 9 }).toFile(`${OUT}${k}.png`);
  got++; bytes += fs.statSync(`${OUT}${k}.png`).size;
}
console.log(`${got} pieces, ${Math.round(bytes / 1024)} KB${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

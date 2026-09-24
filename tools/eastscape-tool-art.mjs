/* EastScape: the TOOL LADDER's icons —  node tools/eastscape-tool-art.mjs
   (2026-09-22) Six rungs x three tools, drawn at PixelLab on 2026-09-22 (32px, side view, basic shading, single
   colour outline — the settings the existing item icons use) and downloaded here. Bronze keeps its original three.

   Each rung is prompted in the COLOUR ITS GEAR ALREADY IS, read off the sword icons rather than invented: emerald
   green, pale ice blue, violet, polished black with white edges, glowing star-metal, black veined with gold. That
   is the whole reason these are generated and not hue-turned copies of the bronze pickaxe the way the decor shop's
   variants are (tools/eastscape-decor-art.mjs): eclipse and starfall are not "bronze, but a different colour", and
   a recolour of a brown pickaxe would have read as neither.

   Output: v3/assets/img/glad/flat/items/<tier>_<tool>.png, trimmed and fitted to the 32px box the other icons use.
   Then bump IART_V in eastscape.html, because these paths are held at the edge for a year. */
/* (2026-09-22, second pass) Nine were redrawn. The first diamond pickaxe and axe came back as curved scythes and the
   starfall pickaxe as a mace — naming the TOOL and its head shape ("straight double-pointed head", "broad wedge
   blade") rather than the material first is what fixed them. And every rod had lost the line, hook and float the
   bronze rod has, which is the only thing that makes a rod read as a rod at 32px rather than as a stick. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/items/", TMP = "lt-tools/"; fs.mkdirSync(TMP, { recursive: true });
const IDS = {
  emerald_pickaxe: "5a75c03c-e9d3-40c7-ae05-ef075fa02347", emerald_axe: "b834c581-5013-463f-83f7-3c3182e4bfa0", emerald_rod: "b871ba15-3b80-41b8-8418-ec3b7c96261c",
  diamond_pickaxe: "011f65bb-cddd-49e8-ba0b-be24ae4f4a92", diamond_axe: "56729521-a0c9-4b72-ae77-7d8cfe30467a", diamond_rod: "d3de868f-7fa8-44f6-83ca-aae6c842381d",
  dragonstone_pickaxe: "168b3661-9ca1-4b95-97b0-3f0d017c7700", dragonstone_axe: "79b3c6ae-54e6-4d1d-9b2f-28f9cfb4209e", dragonstone_rod: "8a6fb0af-2f22-45b6-8d1b-cd4977ec658f",
  onyx_pickaxe: "ef61a1c4-3c41-421d-b78a-6a81e5232590", onyx_axe: "4a13a5e2-9f3b-4530-afaf-faf3c5ff9cb3", onyx_rod: "7c5ad586-980d-4d6a-9911-e8efb6d31f66",
  starfall_pickaxe: "87a8557f-ae34-4175-b90c-61ba3c6ecee0", starfall_axe: "358dff9c-b2c7-4090-9b93-4bc3da073235", starfall_rod: "2e78f305-1d5c-4ade-83a0-1c368c45a7ab",
  eclipse_pickaxe: "510bf6c3-c82a-4c40-a361-95358c48b7a5", eclipse_axe: "a8e75d99-2e8d-4ca1-a3fe-3dadd3dae1c0", eclipse_rod: "63cdb14e-8d68-4ea0-8080-dcf03d2e7156",
  /* (2026-09-22) not a tool — The Run's pickup, an item icon drawn the same way and wanting the same 32px box */
  agilmark: "3d51d9bd-11a9-487b-8ff8-db8224972863",
  /* (2026-09-22) the Trailer Park's ten. Same 32px box as everything else in a bag. */
  catalytic: "c82fbbd7-a7aa-4807-bc04-362bbaefdde9", slagstone: "78f5a199-4b6c-4814-8938-4048a792e327",
  pinelogs: "d2e40b02-b32a-4382-b1de-423153d16956", bogwoodlogs: "b7d47988-1743-4710-b6ad-fe5372ba881d",
  mudcat: "c7c28740-b4c6-423b-85f1-61750228b155", bowfin: "bcd10b45-d47b-45d5-9f9f-1c097c6ece5c",
  cmudcat: "b85f72fa-3355-4064-b292-ca5695ad7bbf", cbowfin: "86418088-a64d-4452-a876-787a349d9ca2",
  wrench: "36ee766d-fa5d-4848-b6d7-50aff7524cae", kingcap: "9805823a-070b-4aea-b346-aeb3607157d5"
};
let got = 0, bytes = 0; const missing = [];
for (const [k, id] of Object.entries(IDS)) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw)) {
    const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`);
    if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(`${k} (${r.status})`); continue; }
    fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  }
  /* trim the empty margin, then centre what is left in a 32px box: the generator leaves a different amount of air
     around each drawing, and an untrimmed set makes one pickaxe look bigger than the next in the same bag. */
  const t = await sharp(raw).ensureAlpha().trim({ threshold: 1 }).toBuffer();
  const m = await sharp(t).metadata(), scale = Math.min(1, 32 / Math.max(m.width, m.height));
  const w = Math.max(1, Math.round(m.width * scale)), h = Math.max(1, Math.round(m.height * scale));
  const fit = scale < 1 ? await sharp(t).resize(w, h, { kernel: "nearest" }).toBuffer() : t;
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fit, left: Math.floor((32 - w) / 2), top: Math.floor((32 - h) / 2) }])
    .png({ compressionLevel: 9 }).toFile(`${OUT}${k}.png`);
  got++; bytes += fs.statSync(`${OUT}${k}.png`).size;
}
console.log(`${got} icons, ${Math.round(bytes / 1024)} KB${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

/* FIELD KITS' art (2026-10-02, v1.2) —  node tools/eastscape-kits-art.mjs
   PixelLab drafts on the art brief, one icon a kit, plus the grapple post. Fetches whichever have finished; run it again for the rest. */
import fs from "node:fs";
const OUT = "v3/assets/img/glad/flat/";
const ART = { "items/kit_flare": "5d2ca9c3-8b3f-4492-84ca-b0883729f022", "items/kit_mark": "fe98c773-aebd-4de1-ab79-6a9dff5c0658", "items/kit_eagle": "49ffdc08-661d-4610-b50d-dc8ecf385c41",
  "items/kit_quickdraw": "03cda5f9-d6d3-4e40-9388-ba96660079ac", "items/kit_retriever": "631ed2f3-c9c2-452c-94db-271adfc6163e", "items/fishing_arrow": "08cd2fcd-ed62-4e68-936b-97f5b9604915",
  "items/kit_camo": "e8bfda4e-68d8-4b97-b1d1-0eb4c3406501", "items/kit_fleet": "c7b2d69d-d535-4d90-90bf-b35ac9e1836f", "o_grapple": "5a825939-3970-4c11-a649-4734964d76fc",
  "items/grapple_arrow": "bf97a221-5bf0-4cc8-8573-85e61a4d8eb1", "items/snare": "2748b65e-3ded-42d8-bc91-90a906ee5312" };
for (const [k, id] of Object.entries(ART)) {
  const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`), b = Buffer.from(await r.arrayBuffer());
  if (!r.ok || b[0] !== 0x89) { console.log(`  .. ${k}: not ready`); continue; }
  fs.writeFileSync(`${OUT}${k}.png`, b); console.log(`  ok ${k}`);
}

/* EastScape: the Store's decor pictures (2026-09-30) —  node tools/eastscape-store-decor-art.mjs
   The owner: "lets also add some crazy cool house decor and island items", then "take a look at other games with customization options
   like the sims, etc. what are the most popular decor items? lets add those". PixelLab map objects made with create_map_object (low
   top-down, basic shading, medium detail, single colour outline: the same settings as tools/eastscape-decor-art.mjs), downloaded, trimmed
   and written as flat/d_<piece>.png. Like the rest of the decor, NOT packed: a piece's picture loads the first time one is seen. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/", TMP = "lt-decor/"; fs.mkdirSync(TMP, { recursive: true });
export const IDS = {
  /* the showpieces */
  slotstatue: "0236f3fa-f5c6-493c-befb-4dc97e83cb4f", portal: "4c37e9ab-e74f-4ff7-b34d-e826e1f257ca", volcano: "80bbfdf1-3f0f-4dfe-800e-e47bf9bc64aa",
  dragonskull: "aeff8ced-a4d1-44d5-97ea-2f105acfe80b", obelisk: "6a3f0f5f-14d4-4408-8734-74cbc38369e6", wreck: "1b670ba5-a327-4925-8a93-a4347fb1725a",
  neonpalm: "3ccf2b1d-b835-4360-8f6d-cb966895e5d4", balloon: "a7379a22-6024-444a-a4e8-072f56fdee4f", arcade: "fa95adb9-a4fb-4406-aa60-c50e00ebdf86",
  hoard: "d2cbac05-b3ee-4aff-8e0e-5a8845e24a42", lavalamp: "376b18c4-5eb7-483f-b24d-360ef52de92c", throne: "4987240f-9611-4a75-92b7-9884f1be3a42",
  jukebox: "43841f50-5742-40e0-9961-7e6bf0c76f1c", sharktank: "1dfa65d8-de68-435a-afe4-295a9021494d" /* (the first came back as a shark with no tank) */,
  /* the classics other games' players reach for first (the Sims, Animal Crossing, OSRS's house) */
  piano: "8d466ecf-af17-4555-9d67-fefc232026b1", fireplace: "03457282-b2f6-4bf4-86a9-f12ae31f4158", canopybed: "f981fa08-ee87-4efe-93c6-8d431deb19a7",
  bathtub: "e27360cf-2e38-4fea-a410-bc4a45bb3966", frogchair: "8bf2c818-8195-44b2-96f8-f1c26c6b796a", moonchair: "a0603aaa-3404-4812-92c0-0163f524068f",
  cherrytree: "9dcb0a91-7d32-43bf-902b-af2d98021060", mushparasol: "4407f168-17e3-4e3d-9eaf-9f267d347c83", telescope: "b1bdd4d8-541b-46f1-97ad-0374303f1664",
  swingset: "8fb9d69d-4411-424c-ad7f-42b6e2309db9", trampoline: "4c7569c7-88bc-4308-b70e-db550221dada", rejuvpool: "9bdadf64-8852-4927-9eff-c8de3ad54dd9",
  spirittree: "72ecddb4-dcdb-48f6-aeb2-50a44c74f09a", pumpkins: "4f85efe6-4466-49e1-bbdf-9172e161491a", mountedhead: "c7cae1d7-58da-41d8-9a9b-0b085a401fd2"
};
let got = 0, bytes = 0; const missing = [];
for (const [k, id] of Object.entries(IDS)) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw)) { const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`); if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(`${k} (${r.status})`); continue; } fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); }
  const out = `${OUT}d_${k}.png`; await sharp(raw).ensureAlpha().trim().png({ compressionLevel: 9 }).toFile(out); got++; bytes += fs.statSync(out).size;
}
console.log(`${got} pictures, ${Math.round(bytes / 1024)} KB${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

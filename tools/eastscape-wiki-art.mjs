/* EastScape: the wiki pass's art (2026-09-30) —  node tools/eastscape-wiki-art.mjs
   The owner: "a full wiki rundown, going category by category, making sure everything … has custom art". The audit found twelve open areas
   with no a_<key>.png (the wiki drew a broken image), six Frozen Reach items still on an emoji, and the new guides (world events, chat
   commands, and the ones written for the Store, the raid, the Frozen Reach, the Valley, the Boardwalk, the Depths, the Pyramid, the casino's
   back rooms and Bronny's order) needing a g_<id>.png each; the gem bag and the outfitters were borrowing another guide's picture.
   PixelLab map objects at 32px, side view, basic shading, single-colour outline (the bag's settings; the brief is tools/eastscape-art-style.md),
   trimmed and fitted into a 32px box like the Store's icons. A job still rendering is reported and skipped: run it again. */
import sharp from "sharp"; import fs from "fs";
const UI = "v3/assets/img/glad/flat/ui/", ITEMS = "v3/assets/img/glad/flat/items/", TMP = "lt-store/"; fs.mkdirSync(TMP, { recursive: true });
export const AREAS = {
  boardwalk: "62496ace-c706-486f-9248-90dff47e5030", bw_cabin: "d1b90583-a778-4664-9cf2-1b1980ca8c7b", bw_light: "26058654-2f73-49ba-856f-7ea3a3ba70f0",
  bw_wreck: "b36e18fc-1f51-47f2-ba6e-8ecd15b41ff3", bw_pier: "7f28bb16-d8c4-4329-a456-047848d6a07b", bw_skull: "5fc83c39-bef2-45b7-8926-d7bcd6a892c1",
  frozen: "cb082b5c-5e3f-49ba-942c-516156b7df34", frostspire: "6491e887-2321-4b79-bbb4-557ddcb6c496", valley: "c8ca3a0e-aac0-4cdd-afe2-4cd92596abc3",
  valley_ridge: "0469d54f-904d-416f-991d-58c6b72c992d", valley_lair: "8ee59c3d-838b-4065-b327-b987caf4ce1f", depths: "eef73850-f4b1-4158-8323-68af201951f1"
};
export const ITEM_ICONS = {
  rimefang_arrow: "8b97854d-e428-4407-a2a9-e2f5d0803f6b", frostcharm: "4238f5e4-325a-4ec1-aae0-68395d700e15", frostward_amulet: "789e49e9-fadc-430b-9b35-21a7e07f5590",
  frostward_ring: "87326781-ae16-48b3-8924-7a5e25e23bc6", yeti_boots: "2aa403d9-ffc4-41e3-be98-3af2d1a99d6f", rimecleaver: "e9144d3a-66ec-4fb0-aeb9-8ef237356f67"
};
export const GUIDES = { events: "4e261f05-c452-4177-a4ed-6e3e8514eb8d", commands: "8f4bcf5b-da53-4687-93b6-c140daf696cf",
  store: "2836ac3d-5ab1-45e4-b9f3-2679d3723745", raid: "c88de7ed-7435-49fa-84ad-98d51026a2da", frozen: "d0383da0-2859-4ea1-b767-77c4a38ea7aa", valley: "a463eac6-e313-4b41-ac83-da6f3da4d276",
  boardwalk: "b37c3f68-1cfa-4953-9b4d-9c8415036c12", depths: "8f398779-7d3e-4a31-81a0-1567e897a31a", pyramid: "c9b06a48-6c6d-4a6c-adcb-2ed7729462f0", rooms: "5be9333a-9d7f-4a09-951d-3cd387f5a6c0",
  order: "30353684-b517-4cbf-ae82-bdece2101357", gembag: "b3f9936e-c32e-4452-a678-e4141753cef8", outfitters: "853d2586-40f5-4816-b5f4-5ebca7c14f1b" };
const missing = []; let got = 0;
async function fit(k, id, out) {
  const raw = `${TMP}wk_${k}.png`;
  if (!fs.existsSync(raw)) { const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`); if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(k); return; } fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); }
  const t = await sharp(raw).ensureAlpha().trim().png().toBuffer(), m = await sharp(t).metadata(), s = Math.min(1, 30 / Math.max(m.width, m.height));
  const body = s < 1 ? await sharp(t).resize(Math.round(m.width * s), Math.round(m.height * s), { kernel: "nearest" }).png().toBuffer() : t, mm = await sharp(body).metadata();
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: body, left: Math.floor((32 - mm.width) / 2), top: Math.floor((32 - mm.height) / 2) }]).png({ compressionLevel: 9 }).toFile(out); got++;
}
for (const [k, id] of Object.entries(AREAS)) await fit(`a_${k}`, id, `${UI}a_${k}.png`);
for (const [k, id] of Object.entries(ITEM_ICONS)) await fit(k, id, `${ITEMS}${k}.png`);
for (const [k, id] of Object.entries(GUIDES)) await fit(`g_${k}`, id, `${UI}g_${k}.png`);
console.log(`${got} pictures${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

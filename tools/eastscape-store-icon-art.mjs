/* EastScape: the Store's icons and the vanity pets (2026-09-30) —  node tools/eastscape-store-icon-art.mjs
   The owner: "need custom art/icons for all the items in the store", "the store icons need art too", and for the pay-to-win round "the pets
   are vanity only, and have to look really cool". PixelLab map objects: the ICONS at 32px, side view, basic shading, single-colour outline
   (the bag's settings, see tools/eastscape-fletch-art.mjs), trimmed and fitted into a 32px box as flat/items/st_<key>.png; the PET SKINS as
   creatures facing right, trimmed and written as flat/pskin_<key>.png at their drawn size (pets are 26-40px). None of it is packed: the
   Store loads its icons when it opens, and a skin loads the first time somebody wears it. */
import sharp from "sharp"; import fs from "fs";
const ITEMS = "v3/assets/img/glad/flat/items/", FLAT = "v3/assets/img/glad/flat/", TMP = "lt-store/"; fs.mkdirSync(TMP, { recursive: true });
export const ICONS = {
  skill2x: "8482f464-5c6c-4948-bca6-3c2ace3fbb09", loupe: "24a34871-e945-42a8-a922-94f516b118cd", loupe2: "0d8721b5-6049-498f-92fa-4b648c646e64",
  fireworks: "001531ff-e8ce-4782-8216-4c478615af16", confetti: "686f4338-64fb-4f96-a77c-3bc6a45d912c", lanterns: "cf7eb326-705c-42f3-b976-1d2dce1906a1" /* (the first read as an orange crystal) */,
  snow: "e721cc9e-9656-43ac-86d1-3da9dba5fa26", horn: "144f4290-f1a3-4bfe-bf94-889491c9c69b", bankpage: "89bc8f63-b11a-4398-8df4-d8f9b9dda94d",
  quickslot: "5efd7c6c-dfc6-4cd3-aa92-39fd39c342f3", title: "e6338c84-cf7d-49a6-9e9b-b0365078dc42", titlecustom: "93a61214-ac73-4ac2-920c-2eebe071111c",
  effects: "86fe0e40-02e0-4a07-b47f-928069fb9708", pets: "ee4c94c7-fee5-4010-a95d-2e3e8e597561", decor: "c5a45c15-7d66-4c50-ae24-51a21f6a374b",
  bagslot: "e86ce065-9175-4531-b1ad-40af1aa1e9b8"
};
export const SKINS = {
  babydragon: "f543a30a-1dff-4b64-a029-8bfec587b37d", phoenix: "68eb28ac-e714-40bf-a2ea-9a0e05694228", ghostcat: "e3a47273-3e91-4815-a298-b2acfacac44d",
  neonfox: "0161ddb7-5e55-48be-9334-9550b68bb4e8", luckycat: "888342f5-d8a7-4fed-a919-9e2af30f51ad", kraken: "aef3126f-251a-4595-b378-bae97ce78147",
  mechapup: "7497487d-24f6-4695-97f3-e43abac618a6", voidwisp: "b259bf7c-fd61-4431-b1d8-806b2b7fc8e9", unicorn: "4beb45d3-268c-482f-9a22-7b34a275f89e", slotbot: "adeb9586-9dbe-4eb6-840b-682155a4ce87"
};
const get = async (k, id) => {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw)) { const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`); if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) return null; fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); }
  return raw;
};
let got = 0; const missing = [];
for (const [k, id] of Object.entries(ICONS)) {
  const raw = await get(`st_${k}`, id); if (!raw) { missing.push(k); continue; }
  const t = await sharp(raw).ensureAlpha().trim().png().toBuffer(), m = await sharp(t).metadata(), s = Math.min(1, 30 / Math.max(m.width, m.height));
  const body = s < 1 ? await sharp(t).resize(Math.round(m.width * s), Math.round(m.height * s), { kernel: "nearest" }).png().toBuffer() : t, mm = await sharp(body).metadata();
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: body, left: Math.floor((32 - mm.width) / 2), top: Math.floor((32 - mm.height) / 2) }]).png({ compressionLevel: 9 }).toFile(`${ITEMS}st_${k}.png`); got++;
}
const FLOP = new Set(["babydragon"]);   /* pets face RIGHT (the page mirrors them to walk left): these came back facing left */
for (const [k, id] of Object.entries(SKINS)) { const raw = await get(`pskin_${k}`, id); if (!raw) { missing.push(`pskin_${k}`); continue; } let im = sharp(raw).ensureAlpha().trim(); if (FLOP.has(k)) im = sharp(await im.png().toBuffer()).flop(); await im.png({ compressionLevel: 9 }).toFile(`${FLAT}pskin_${k}.png`); got++; }
console.log(`${got} pictures${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

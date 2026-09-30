/* EastScape: the world events' art (2026-09-30) —  node tools/eastscape-events-art.mjs
   The owner, after the events mockup: "lets build all of them on the dev server". Shooting Stars, Wanted! and the Jackpot Thief.
   The scene pieces are the mockup's own PixelLab drawings (tools/events-mock/art/, drawn from tools/eastscape-art-style.md), copied into
   the game under their game names; the three item icons are PixelLab map objects at 32px, side view, basic shading, single-colour outline
   (the bag's settings), trimmed and fitted into a 32px box like the Store's (tools/eastscape-store-icon-art.mjs).
     o_fallenstar   the fallen star, drawn at a size that shrinks with its tier
     o_startent     the Star Tent in the Yard, where Star Fragments are spent
     o_bountyboard  the Bounty Board in the Yard, where the Wanted posters go up
     (jackthief     the Jackpot Thief: since 2026-09-30 a PixelLab character with a run cycle, drawn by tools/eastscape-walk-art.mjs, not copied here)
     pet_starling   the Starling (hatches from egg_starling)
     ui/ev_poster   the poster drawn in the Bounty Board's window
     items/starfrag, items/egg_starling, items/star_crate   the icons */
import sharp from "sharp"; import fs from "fs";
const FLAT = "v3/assets/img/glad/flat/", ITEMS = FLAT + "items/", MOCK = "tools/events-mock/art/", TMP = "lt-store/"; fs.mkdirSync(TMP, { recursive: true });
const COPY = { ev_star: "o_fallenstar", ev_tent: "o_startent", ev_board: "o_bountyboard", ev_starling: "pet_starling", ev_poster: "ui/ev_poster" };
for (const [from, to] of Object.entries(COPY)) await sharp(`${MOCK}${from}.png`).ensureAlpha().trim().png({ compressionLevel: 9 }).toFile(`${FLAT}${to}.png`);
export const ICONS = { starfrag: "3d57666c-f589-4254-aeeb-5194b3175aa9", egg_starling: "bc44c61f-8599-43bb-ba75-4070767cc0a7", star_crate: "f7cc3f09-0aa3-409c-aa8a-66390e3b7082" };
const missing = [];
for (const [k, id] of Object.entries(ICONS)) {
  const raw = `${TMP}ev_${k}.png`;
  if (!fs.existsSync(raw)) { const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`); if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(k); continue; } fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); }
  const t = await sharp(raw).ensureAlpha().trim().png().toBuffer(), m = await sharp(t).metadata(), s = Math.min(1, 30 / Math.max(m.width, m.height));
  const body = s < 1 ? await sharp(t).resize(Math.round(m.width * s), Math.round(m.height * s), { kernel: "nearest" }).png().toBuffer() : t, mm = await sharp(body).metadata();
  await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: body, left: Math.floor((32 - mm.width) / 2), top: Math.floor((32 - mm.height) / 2) }]).png({ compressionLevel: 9 }).toFile(`${ITEMS}${k}.png`);
}
/* (2026-09-30) the Supernova, the Starling's Legendary: a pet facing right, trimmed and fitted to 40px (pets are 26-40) */
{ const raw = `${TMP}ev_supernova.png`;
  if (!fs.existsSync(raw)) { const r = await fetch("https://api.pixellab.ai/mcp/map-objects/788040b3-04b4-4374-bb2e-2816a3606548/download"); if (r.ok && /image/.test(r.headers.get("content-type") || "")) fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); else missing.push("supernova"); }
  if (fs.existsSync(raw)) { const t = await sharp(raw).ensureAlpha().trim().png().toBuffer(), m = await sharp(t).metadata(), s = Math.min(1, 40 / Math.max(m.width, m.height));
    await sharp(t).resize(Math.round(m.width * s), Math.round(m.height * s), { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(`${FLAT}pet_supernova.png`); } }
console.log(`${Object.keys(COPY).length} scene pictures, ${Object.keys(ICONS).length - missing.length} icons${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

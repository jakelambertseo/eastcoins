/* EastScape: the islands' new pictures (2026-09-30) —  node tools/eastscape-isle-extra-art.mjs
   Phase 2's cottage styles (flat/cottage_<style>.png, drawn at the thatched cottage's own 176x144 so the door lands on the same tile) and
   phase 3's livestock (flat/d_<piece>.png, like every decor piece). PixelLab map objects, low top-down, basic shading, trimmed. The
   cottages are trimmed and then set back on a 176x144 canvas, bottom-centred, so every style stands exactly where the thatched one does. */
import sharp from "sharp"; import fs from "fs";
const FLAT = "v3/assets/img/glad/flat/", TMP = "lt-decor/"; fs.mkdirSync(TMP, { recursive: true });
export const COTTAGES = { stone: "b5fbfa1b-c553-46b8-9dd0-341a6696231d", cabin: "e088c63e-3ebf-49d7-8337-9ca5c0c145e1", beach: "e8bcdebd-a0c1-433d-9ad8-28ac502d2392", witch: "2487e366-4d81-4432-8b7e-4d676b387ef8", villa: "f345e1c8-d3f2-4b26-a701-ddea99faee36" };
export const FARM = { coop: "554a5d72-fcce-4e87-b33e-b22999e26b09", cowpen: "2b25a96a-bd88-4d5b-9da7-978677d38f8f", cage: "9eb3a13f-e6c3-4241-bbd4-ef20ab87f4ed" };
const get = async (k, id) => { const raw = `${TMP}${k}.png`; if (!fs.existsSync(raw)) { const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`); if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) return null; fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); } return raw; };
let got = 0; const missing = [];
for (const [k, id] of Object.entries(COTTAGES)) { const raw = await get(`cottage_${k}`, id); if (!raw) { missing.push(k); continue; }
  const t = await sharp(raw).ensureAlpha().trim().png().toBuffer(), m = await sharp(t).metadata(), s = Math.min(1, 172 / m.width, 142 / m.height);
  const body = s < 1 ? await sharp(t).resize(Math.round(m.width * s), Math.round(m.height * s), { kernel: "nearest" }).png().toBuffer() : t, mm = await sharp(body).metadata();
  await sharp({ create: { width: 176, height: 144, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: body, left: Math.floor((176 - mm.width) / 2), top: 144 - mm.height }]).png({ compressionLevel: 9 }).toFile(`${FLAT}cottage_${k}.png`); got++; }
for (const [k, id] of Object.entries(FARM)) { const raw = await get(k, id); if (!raw) { missing.push(k); continue; } await sharp(raw).ensureAlpha().trim().png({ compressionLevel: 9 }).toFile(`${FLAT}d_${k}.png`); got++; }
/* (2026-09-30, the owner: "can we upgrade the plot art, its very primative, breeding pen too") o_plot is a wooden raised bed of soil,
   kept at its full 32x32 because it is a tile; PixelLab drew sprouts in it though asked not to, and an EMPTY plot must look empty (the
   crop is drawn on top), so every green pixel is turned to soil. o_pen is the picket-fenced pen with straw and a kennel. */
{ const raw = await get("plotA", "a4c3a52b-fec5-4d1b-9e13-bd43779c1799");
  if (raw) { const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), soil = [[74, 46, 28], [88, 56, 34], [62, 38, 22]];
    for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; if (data[i + 3] >= 8 && g >= r - 4 && g > b + 12) { const c = soil[(((i / 4) % info.width) * 7 + Math.floor(i / 4 / info.width) * 3) % 3]; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; } }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${FLAT}o_plot.png`); got++; } else missing.push("o_plot"); }
{ const raw = await get("pen3", "8207f63e-0a22-474b-b689-705f1bf6a95d"); if (raw) { await sharp(raw).ensureAlpha().trim().png({ compressionLevel: 9 }).toFile(`${FLAT}o_pen.png`); got++; } else missing.push("o_pen"); }
console.log(`${got} pictures${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

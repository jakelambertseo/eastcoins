/* EastScape: the decor shop's pictures —  node tools/eastscape-decor-art.mjs
   Downloads each PixelLab map object (made 2026-09-21 with create_map_object: low top-down, basic shading, medium detail, single
   colour outline; 32 px a tile like the rest of the scenery), trims the empty margin, and writes flat/d_<piece>.png. The
   COLOUR VARIANTS are made here, not generated: the blue and yellow flower beds and the blue and green pennants are the red
   ones with their reds turned (only pixels that are clearly red move, so wood, leaves and the pole stay put), and the green and
   gold rugs are the red rug turned the same way. Then run tools/eastscape-pack.mjs? NO: decor art is NOT packed. It loads when
   a piece is first seen (wantArt), so a login never pays for furniture nobody placed. Flat pieces (path, rugs) are kept at
   their full tile size, untrimmed, because they tile edge to edge. */
import sharp from "sharp"; import fs from "fs";
const OUT = "v3/assets/img/glad/flat/", TMP = "lt-decor/"; fs.mkdirSync(TMP, { recursive: true });
const IDS = { bench: "eeb8bf81-c701-48ba-b681-c5d1ee3eb3e2", picnic: "e8021d3e-bff6-4e15-986e-854bcf506780", flowers_r: "fb0630e5-1f64-4938-ba7e-44fafd5580a7", flamingo: "fc930399-b2e1-4478-a0e3-e2bc943d684b",
  tiki: "5148026d-b65b-4d57-8613-6a4546ee1330", campfire: "0b4f3792-5194-4ad8-8cf7-1a2d6d8840e7", path: "74862188-a2bd-4f8f-b567-c3140904968d", gnome: "9545147f-45db-4186-a3f8-a861d52dde73",
  hammock: "eda5a232-c3de-46fb-b3f2-3d621a9211a9", fountain: "c334f7d4-2d0f-42e7-926b-6a5181662fa6", speaker: "60f5b906-73cd-40d1-b990-0826014f92f4", grill: "b238c39f-34da-43aa-ba01-b42d6f07ef6d",
  flag_r: "8742bced-67c4-413f-a428-eb84972c2899", hottub: "21790507-4a52-4bfa-97d5-e443a8bac8c3", beerpong: "ce311425-798a-4adf-a814-caadefdc7f76", bookshelf: "41e459d4-117e-4e93-b8fe-2c78402be56d",
  tv: "25d88237-799b-49d0-bc0d-9247f4512dc4", rug_red: "ef0e48f2-6e3b-4259-8320-81e12a1dd3ba", trophies: "a80728e8-fac3-4bff-8a1f-50534c239466", neon: "755c661f-d45e-407f-9a17-3456a4f550c1",
  toilet: "20922587-0ec9-4298-987e-e1bdaeb0f5f4", lamp: "45871898-122d-444a-8060-b84a8ceaf581", table: "6e31c4c9-d920-481f-95fd-444509cc13c2", aquarium: "2fdade06-7334-4d60-a138-1291dc3474a0", pooltable: "79318f67-4928-4cfd-a544-0d33ae3d8878" };
const FLAT = new Set(["path", "rug_red"]);
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255]; };
const rgb = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [r, g, b].map((q) => Math.round((q + m) * 255)); };
/** turn the clearly-red pixels of a picture to another hue (and optionally lift them, for gold) */
async function turned(file, hue, { sat = 1, val = 1 } = {}) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { if (!data[i + 3]) continue; const [h, s, v] = hsv(data[i], data[i + 1], data[i + 2]); if ((h <= 18 || h >= 335) && s > 0.45 && v > 0.2) { const [r, g, b] = rgb(hue, Math.min(1, s * sat), Math.min(1, v * val)); data[i] = r; data[i + 1] = g; data[i + 2] = b; } }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 });
}
let got = 0, bytes = 0; const missing = [];
for (const [k, id] of Object.entries(IDS)) {
  const raw = `${TMP}${k}.png`;
  if (!fs.existsSync(raw)) { const r = await fetch(`https://api.pixellab.ai/mcp/map-objects/${id}/download`); if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) { missing.push(`${k} (${r.status})`); continue; } fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); }
  const out = `${OUT}d_${k}.png`, im = sharp(raw).ensureAlpha();
  if (k === "path") { /* the stones came back smaller than the square: cut them out and repeat them to the edges, so a run of path has no gaps */ const t = await sharp(raw).ensureAlpha().trim().png().toBuffer(), m = await sharp(t).metadata(), px = Math.ceil((32 - m.width) / 2), py = Math.ceil((32 - m.height) / 2); const big = await sharp(t).extend({ left: px, right: px, top: py, bottom: py, extendWith: "repeat" }).png().toBuffer(); await sharp(big).extract({ left: 0, top: 0, width: 32, height: 32 }).flatten({ background: "#8a8f8a" }).png({ compressionLevel: 9 }).toFile(out); got++; bytes += fs.statSync(out).size; continue; }
  await (FLAT.has(k) ? im : im.trim()).png({ compressionLevel: 9 }).toFile(out); got++; bytes += fs.statSync(out).size;
}
const V = [["flowers_r", "flowers_y", 48, { val: 1.15 }], ["flowers_r", "flowers_b", 215, {}], ["flag_r", "flag_b", 215, {}], ["flag_r", "flag_g", 130, { val: 0.9 }], ["rug_red", "rug_green", 140, { val: 0.85 }], ["rug_red", "rug_gold", 42, { val: 1.2, sat: 0.9 }]];
for (const [from, to, hue, o] of V) if (fs.existsSync(`${OUT}d_${from}.png`)) { await (await turned(`${OUT}d_${from}.png`, hue, o)).toFile(`${OUT}d_${to}.png`); got++; bytes += fs.statSync(`${OUT}d_${to}.png`).size; }
console.log(`${got} pictures, ${Math.round(bytes / 1024)} KB${missing.length ? ` · NOT READY: ${missing.join(", ")}` : ""}`);

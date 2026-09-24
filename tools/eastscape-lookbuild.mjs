/* LOOK PARTS BUILDER (v80). Raw PixelLab sprites (key colours) -> the game's part maps in v3/assets/img/glad/flat/:
     pb_<body>_<dir>.png  a bald body. Every recolourable pixel is rewritten as an EXACT code the page can read without guessing:
                          skin (v,0,0) · top (v,0,v) · the tee's chest stripe (v,v,0) · bottoms (0,v,0); v = that pixel's own
                          lightness, 90..255, relative to the brightest pixel of its part. Everything else (outline, eyes, shoes)
                          is left as drawn, nudged off any code by one step of blue.
     ph_<hair>_<dir>.png  one hairstyle alone, as (0,0,v), cut from a blue-haired donor on the same skeleton: blobs of 12+ pixels
                          only (so blue EYES stay behind), small holes closed (a highlight the hue test missed).
   Parts are found by hue. On a BODY nothing is hair: blue/teal below the collar is trousers (one body came in jeans), above
   it is an eye and is left alone. */
import sharp from "sharp"; import fs from "fs";
const U = "https://backblaze.pixellab.ai/file/pixellab-characters/4e81aa0e-6201-484d-a0fb-c1ae89736d11", OUT = "C:/Users/jake/code/eastcoins/v3/assets/img/glad/flat/";
const DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
const BODIES_ALL = { avg: "52565623-d08c-4bfe-89bb-9684882b0c76", big: process.env.BIG || "1de72b6e-3dc7-4742-89de-3d481194e928", slimw: process.env.SLIMW || "5a5aa9ea-83a4-46e5-b08e-186737014a8d", curvyw: "e92c20e7-e710-4253-95b9-74528acadfaf" , fat: "3fd5156c-5ea6-4349-a160-eaec76b4d724" };
const HAIRS = process.env.ONLY ? {} : { messy: "215927a8-4022-43a4-b876-c46e216bf593", crop: "8ec64ffd-5dc8-4c82-b191-e626927cb92f", long: "4ed826f8-554e-4330-affb-d9451760b3a3", pony: "2cfe8ef4-34d9-47e0-bb07-63aa339dd54d", afro: "6c8e98e3-c57e-48e2-95d7-d194595dbed6", cap: "53e51414-aea2-40df-8354-fd93b3b6972b", bob: "db3f030d-c0ad-4dcd-b0e2-d0eb74951ee7", bun: "38d43709-102c-44a4-9472-d8b2089081f3", pigtails: "af298f30-1cae-41c0-8a54-9694cd41fbc9", beard: "ccb0a1cd-93b1-4898-b509-c874820e8936" };   // (beard: the same trick, a blue beard on a bald man)
const BODIES = process.env.ONLY ? Object.fromEntries(Object.entries(BODIES_ALL).filter(([k]) => process.env.ONLY.split(",").includes(k))) : BODIES_ALL;   // ONLY=slimw,curvyw rebuilds just those bodies
fs.mkdirSync("lt", { recursive: true });
const get = async (id, d) => { const f = `lt/${id.slice(0, 6)}_${d}.png`; if (!fs.existsSync(f)) { const r = await fetch(`${U}/${id}/rotations/${d}.png`); if (!r.ok) throw new Error(`${id} ${d} ${r.status}`); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); } return sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); };
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255]; };
const hueOf = (r, g, b) => { const [h, s, v] = hsv(r, g, b); if ((h <= 40 || h >= 345) && s >= 0.12 && s < 0.28 && v >= 0.5) return "skin";   /* (2026-09-21) PALE SKIN IS SKIN: the big guy was drawn so fair that most of him fell under the saturation floor and never took a skin colour. Whites (eyes, shoes) are under 0.12. */
  if (s < 0.28 || v < 0.16) return null; if (h >= 280 && h <= 345) return "top"; if (h >= 80 && h < 195) return "green"; if (h >= 195 && h <= 262) return "blue"; if ((h <= 40 || h >= 350) && s < 0.75) return "skin"; return null; };
const code = (part, v) => (part === "skin" ? [v, 0, 0] : part === "top" ? [v, 0, v] : part === "trim" ? [v, v, 0] : part === "bottom" ? [0, v, 0] : [0, 0, v]);
const isCode = (r, g, b) => (g === 0 && b === 0 && r > 0) || (g === 0 && r === b && r > 0) || (b === 0 && r === g && r > 0) || (r === 0 && b === 0 && g > 0) || (r === 0 && g === 0 && b > 0);
let files = 0, bytes = 0;
const write = async (name, data, W, H) => { const f = `${OUT}${name}.png`; await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(f); files++; bytes += fs.statSync(f).size; };
for (const [name, id] of Object.entries(BODIES)) for (const d of DIRS) {
  const { data, info } = await get(id, d), W = info.width, H = info.height, part = new Array(W * H).fill(null); let t0 = 99, t1 = 0;
  for (let n = 0; n < W * H; n++) { const i = n * 4; data[i + 3] = data[i + 3] >= 128 ? 255 : 0; if (!data[i + 3]) continue; const p = hueOf(data[i], data[i + 1], data[i + 2]); if (p === "top") { const y = (n / W) | 0; t0 = Math.min(t0, y); t1 = Math.max(t1, y); } part[n] = p; }
  const sy = t0 + Math.round((t1 - t0) * 0.45), vmax = { skin: 1, top: 1, bottom: 1 };
  for (let n = 0; n < W * H; n++) { let p = part[n]; const y = (n / W) | 0, i0 = n * 4;
    /* dull trousers (one body came in olive, too grey for the hue test): below the tee, anything mid-toned that isn't skin is trousers; white shoes and the dark outline fall outside the band */
    if (!p && data[i0 + 3] && y > t1) { const v0 = Math.max(data[i0], data[i0 + 1], data[i0 + 2]) / 255; if (v0 > 0.22 && v0 < 0.72) p = "bottom"; }
    if (!p) continue; if (p === "green" || p === "blue") p = y > t0 + 2 ? "bottom" : null; part[n] = p; if (p) { const i = n * 4; vmax[p] = Math.max(vmax[p], data[i], data[i + 1], data[i + 2]); } }
  /* STRAY SPECKS: a lone skin-coded pixel boxed in by tee (or by trousers) is a shading pixel the hue test misread, so it takes
     its neighbours' part. Arms and necks are runs of skin, not single pixels, so they are left alone. */
  for (let n = W; n < W * H - W; n++) { if (part[n] !== "skin") continue; const nb = [part[n - 1], part[n + 1], part[n - W], part[n + W]]; for (const q of ["top", "bottom"]) if (nb.filter((x) => x === q).length >= 3) part[n] = q; }
  /* PALE HIGHLIGHTS ARE SKIN (2026-09-21, the owner: "the girl characters... look like they have vitiligo"). PixelLab lit the slim
     woman with near-white pixels on her scalp, hands and arms. They are too unsaturated for the hue test, so they stayed as
     drawn, and under any darker skin they showed as pale patches. A pale uncoded pixel with skin on three or more of its eight
     sides becomes the brightest skin. NOT in the band of the head where the eyes are (their whites sit in skin too), and shoes
     never qualify: nothing next to a shoe is skin. */
  { let headTop = H; for (let n = 0; n < W * H; n++) if (data[n * 4 + 3]) { headTop = (n / W) | 0; break; } const e0 = headTop + (t0 - headTop) * 0.38, e1 = headTop + (t0 - headTop) * 0.78;
    for (let pass = 0; pass < 4; pass++) {   /* a highlight is a cluster: its middle only has skin beside it once its rim has turned */
    const pale = []; for (let n = W + 1; n < W * H - W - 1; n++) { const i = n * 4, y = (n / W) | 0; if (!data[i + 3] || part[n]) continue; const inEyes = y >= e0 && y <= e1; const [, sat, val] = hsv(data[i], data[i + 1], data[i + 2]), stray = y < t0 && hueOf(data[i], data[i + 1], data[i + 2]) === "green";   /* (a green speck on a face is the trousers' key colour leaking: skin too) */ if (!stray && (inEyes || val < 0.7 || sat > 0.3)) continue;
      let sk = 0; for (const o of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) if (part[n + o] === "skin") sk++; if (sk >= 3) pale.push(n); }
    for (const n of pale) { part[n] = "skin"; const i = n * 4; data[i] = data[i + 1] = data[i + 2] = vmax.skin; } if (!pale.length) break; } }
  for (let n = 0; n < W * H; n++) { const i = n * 4; if (!data[i + 3]) continue; let p = part[n];
    if (!p) { if (isCode(data[i], data[i + 1], data[i + 2])) data[i + 2] = Math.min(255, data[i + 2] + 1), data[i + 1] = Math.max(1, data[i + 1]); continue; }
    const v = Math.max(90, Math.round((Math.max(data[i], data[i + 1], data[i + 2]) / vmax[p]) * 255)), y = (n / W) | 0; if (p === "top" && (y === sy || y === sy + 1)) p = "trim"; [data[i], data[i + 1], data[i + 2]] = code(p, v); }
  await write(`pb_${name}_${d}`, data, W, H);
}
for (const [name, id] of Object.entries(HAIRS)) for (const d of DIRS) {
  const { data, info } = await get(id, d), W = info.width, H = info.height, is = new Uint8Array(W * H), seen = new Uint8Array(W * H), keep = new Uint8Array(W * H);
  for (let n = 0; n < W * H; n++) { const i = n * 4; if (data[i + 3] >= 128 && hueOf(data[i], data[i + 1], data[i + 2]) === "blue") is[n] = 1; }
  for (let n = 0; n < W * H; n++) { if (!is[n] || seen[n]) continue; const blob = [n]; seen[n] = 1; for (let q = 0; q < blob.length; q++) { const c = blob[q], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const xx = x + dx, yy = y + dy, m = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < H && is[m] && !seen[m]) { seen[m] = 1; blob.push(m); } } } if (blob.length >= (name === "beard" ? 9 : 12)) for (const c of blob) keep[c] = 1; }
  let hv = 1; for (let n = 0; n < W * H; n++) if (keep[n]) hv = Math.max(hv, data[n * 4], data[n * 4 + 1], data[n * 4 + 2]);
  const val = new Uint8Array(W * H); for (let n = 0; n < W * H; n++) if (keep[n]) val[n] = Math.max(90, Math.round((Math.max(data[n * 4], data[n * 4 + 1], data[n * 4 + 2]) / hv) * 255));
  for (let pass = 0; pass < 2; pass++) for (let n = W; n < W * H - W; n++) { if (keep[n] || data[n * 4 + 3] < 128) continue; const nb = [n - 1, n + 1, n - W, n + W].filter((m) => keep[m]); if (nb.length >= 3) { keep[n] = 1; val[n] = Math.min(255, Math.round(nb.reduce((a, m) => a + val[m], 0) / nb.length) + 20); } }   // a highlight the hue test missed
  const out = Buffer.alloc(W * H * 4); for (let n = 0; n < W * H; n++) if (keep[n]) { out[n * 4 + 2] = val[n]; out[n * 4 + 3] = 255; }
  await write(`ph_${name}_${d}`, out, W, H);
}
console.log("wrote", files, "files,", Math.round(bytes / 1024), "KB");

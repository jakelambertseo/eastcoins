import sharp from "sharp";
const S = "C:/Users/jake/AppData/Local/Temp/claude/C--Users-jake-code-eastcoins/42c7e72d-41ad-42db-a295-e80c1c85afef/scratchpad/", F = "v3/assets/img/glad/flat/";
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255]; };
const rgb = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [r, g, b].map((q) => Math.round((q + m) * 255)); };
// the garden bed: trim, turn the purple soil to earth brown (greens are left alone), centre it on a 32 x 32 tile
const t = await sharp("lt-decor/plot_raw.png").ensureAlpha().trim().raw().toBuffer({ resolveWithObject: true }), d = t.data;
for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const [h, s, v] = hsv(d[i], d[i + 1], d[i + 2]); if (h >= 280 || h <= 20) { const [r, g, b] = rgb(24, Math.min(1, s * 1.05), v); d[i] = r; d[i + 1] = g; d[i + 2] = b; } }
const bed = await sharp(d, { raw: { width: t.info.width, height: t.info.height, channels: 4 } }).png().toBuffer(), W = t.info.width, H = t.info.height;
await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: bed, left: Math.floor((32 - W) / 2), top: Math.floor((32 - H) / 2) }]).png({ compressionLevel: 9 }).toFile(F + "o_plot.png");
await sharp("lt-decor/pen_raw.png").ensureAlpha().trim().png({ compressionLevel: 9 }).toFile(F + "o_pen.png");
const comps = []; for (let i = 0; i < 4; i++) comps.push({ input: F + "o_plot.png", left: i * 32, top: 8 }); comps.push({ input: F + "o_pen.png", left: 140, top: 0 });
const p = await sharp({ create: { width: 240, height: 60, channels: 4, background: "#6a9a4a" } }).composite(comps).png().toBuffer(); await sharp(p).resize(960, 240, { kernel: "nearest" }).toFile(S + "plotpen.png"); console.log("ok");

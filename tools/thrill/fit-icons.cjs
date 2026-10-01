/* fit Thrill Hill's item icons (PixelLab, tools/thrill/art/items) into the game's 32x32 item cells, and a contact sheet to look at */
const sharp = require("sharp"), fs = require("fs");
(async () => {
  const D = "tools/thrill/art/items/", ks = fs.readdirSync(D).filter((f) => f.endsWith(".png")), comps = []; let x = 0;
  for (const f of ks) {
    const b = await sharp(D + f).trim({ threshold: 1 }).toBuffer(), m = await sharp(b).metadata(), s = Math.min(30 / m.width, 30 / m.height);
    const w = Math.max(1, Math.round(m.width * s)), h = Math.max(1, Math.round(m.height * s));
    const out = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharp(b).resize(w, h, { kernel: "nearest" }).toBuffer(), left: Math.floor((32 - w) / 2), top: Math.floor((32 - h) / 2) }]).png({ palette: true }).toBuffer();
    fs.writeFileSync("v3/assets/img/glad/flat/items/" + f, out);
    comps.push({ input: await sharp(out).resize(96, 96, { kernel: "nearest" }).toBuffer(), left: x, top: 0 }); x += 100;
  }
  await sharp({ create: { width: x, height: 96, channels: 4, background: "#2a2420" } }).composite(comps).png().toFile(process.env.TEMP + "/thrill-items.png");
  console.log(ks.join(" "));
})();

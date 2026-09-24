/* EastScape: the EastCoin mark —  node tools/eastscape-logo.mjs <source.png>
   (2026-09-22) The owner's logo: a slot cabinet with 777, a crown and a green E chip. It replaces the 🎰 emoji
   that stood in for a logo in the game's header and on the members-only card, and it gives the page a favicon,
   which it never had at all.

   Sizes, not one image: a browser tab wants 32, iOS wants 180, and the header draws about 22 CSS pixels, so it is
   given 96 to have something to downsample from on a retina screen. Downscaling THIS logo is lanczos and not
   nearest — it is a rendered illustration with soft neon glow, not pixel art, and nearest turns the glow to
   confetti. That is the opposite of the rule for everything under img/glad/flat. */
import sharp from "sharp"; import fs from "fs";
const SRC = process.argv[2] || "scratchpad/logo-src.png", OUT = "v3/assets/img/";
fs.mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const n of [32, 96, 180, 512]) {
  const f = `${OUT}eastcoin-icon-${n}.png`;
  await sharp(SRC).resize(n, n, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(f);
  bytes += fs.statSync(f).size;
  console.log(`  ${n}x${n}  ${(fs.statSync(f).size / 1024).toFixed(1)} KB`);
}
console.log(`${Math.round(bytes / 1024)} KB total`);

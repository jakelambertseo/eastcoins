/* THE VAULT'S TREE AND POOL, DARKENED IN POST —  node tools/eastscape-vault-art.mjs
   (2026-09-25, the owner: "revamp the vault ... this is also casino themed, but it needs to be unique from the
   casino. give custom art for everything, including the ores/trees/fishing spots you place")

   WHY THIS EXISTS RATHER THAN A BETTER PROMPT. The Vaultwood grew in a locked basement with no sun, so its canopy
   has to be almost black - and PixelLab draws a healthy green tree no matter how the prompt insists. Three tries
   said "ALMOST BLACK", "no healthy green anywhere", "sickly, colourless" and all three came back a summer oak.

   A colour grade is the right tool for that: deterministic, exact, and it keeps the generated SHAPE, which was
   always fine. Shape from the model, palette from here. Same trick the casino cards use for cropping - let the
   generator do what it is good at and fix the rest in code rather than re-rolling the dice.

   Idempotent by design: it reads the ORIGINAL download from art-src/ and writes flat/, so running it twice does
   not darken twice. */
import sharp from "sharp";
import fs from "node:fs";
const FLAT = "v3/assets/img/glad/flat/", SRC = "tools/art-src/";
fs.mkdirSync(SRC, { recursive: true });

const JOBS = [
  /* saturation well under 1 kills the green; brightness under 1 takes it toward black; the hue nudge pushes what
     is left of the leaf colour off grass and toward the cold blackish teal the room is lit in. */
  { file: "o_vaultwood.png", sat: 0.28, bright: 0.52, hue: 150 },
  { file: "o_spot6.png",     sat: 0.40, bright: 0.60, hue: 190 },
];

for (const j of JOBS) {
  const src = SRC + j.file, dst = FLAT + j.file;
  if (!fs.existsSync(src)) fs.copyFileSync(dst, src);   // first run keeps the untouched original
  const out = await sharp(src)
    .modulate({ saturation: j.sat, brightness: j.bright, hue: j.hue })
    .png().toBuffer();
  fs.writeFileSync(dst, out);
  console.log(`  ${j.file}: saturation ${j.sat}, brightness ${j.bright}, hue ${j.hue >= 0 ? "+" : ""}${j.hue}  (original kept in ${SRC})`);
}

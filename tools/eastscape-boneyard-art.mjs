/* EastScape: THE BONEYARD REBUILT —  node tools/eastscape-boneyard-art.mjs
   (2026-09-24, the owner: "rebuild the boneyard ... i want there to be graveyards that are bllocked off by
   fences ... add art as needed, add a mini ghost boss as well with custom art")

   Reads the raw PixelLab downloads in lt-bone/ and writes the game's files into v3/assets/img/glad/flat/.
   Prompts start from tools/eastscape-art-style.md, as everything does.

   SIZE IS THE JOB, as in every one of these tools: the generator returns whatever canvas it was asked for and
   the game draws an object at its own pixel size, so each piece is trimmed of its empty margin and scaled to a
   HEIGHT read off what is already in the world rather than a number invented here.

   TWO THINGS ABOUT THE RAILINGS. They are o_railH / o_railV and NOT o_fenceH / o_fenceV, which already exist and
   are the market's and the junkyard's — the style brief says check flat/ for the name first, and this is the
   third time that would otherwise have bitten. And the vertical one was drawn TWICE: asked for as "the same
   railing rotated" the model returned a stone slab, because a fence running away from the camera is not a
   rotation of one running across it. Naming the view ("seen EDGE ON ... a narrow column of bars one behind
   another") is what got a railing rather than a headstone. */
import sharp from "sharp";
import fs from "node:fs";
const SRC = "lt-bone/", OUT = "v3/assets/img/glad/flat/";

/* [file key, target height, why that height] */
const PIECES = [
  ["o_railH", 30, "the market's fence is 22; iron railings stand a little taller"],
  ["o_railV", 46, "the same railings seen end on, so they run up the tile rather than across it"],
  ["o_railgate", 54, "gateposts read above the run they interrupt"],
  ["o_mausoleum", 96, "a 2x2 building: between a hut and The House at 128"],
  ["critic", 116, "size xl. The Understudy is 96 and the Pyramid's pharaohs 110; he is the biggest thing here"],
];
const FROM = { o_railH: "railH", o_railV: "railV", o_railgate: "railgate", o_mausoleum: "mausoleum", critic: "critic" };

for (const [key, h, why] of PIECES) {
  const src = `${SRC}${FROM[key]}.png`;
  if (!fs.existsSync(src)) { console.log(`  !! ${key}: no ${src}`); continue; }
  const trimmed = await sharp(src).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(trimmed).metadata();
  const w = Math.max(1, Math.round((m.width / m.height) * h));
  await sharp(trimmed).resize(w, h, { kernel: "nearest" }).png({ palette: true, colours: 64 }).toFile(OUT + `${key}.png`);
  console.log(`  ${key}.png  ${w}x${h}  ${(fs.statSync(OUT + `${key}.png`).size / 1024).toFixed(1)} KB   — ${why}`);
}

/* EastScape: the Great Pyramid's FLOOR AND WALLS —  node tools/eastscape-pyramid-tiles.mjs
   (2026-09-24, the owner: "go ahead and put in art for the pyramid floor and the pyramid walls too")

   Reads the raw PixelLab downloads in lt-pyr2/ and writes two sheets into v3/assets/img/glad/flat/:
     t_tomb.png      8 x 2 floor tiles of 32 px  (tiles-pro 44ea5ff9)
     t_tombwall.png  8 x 2 wall FACES  of 64 px  (tiles-pro 254323a8)
     fx_bleed.png    the bleeding badge drawn over a held player's head (pixflux bf6c4e45)

   IT WAS DRAWING NEITHER OF THEM BEFORE. The pyramid scene declared `floorArt: "t_crypt"` and
   `wallArt: "t_cryptwall"` from the day it shipped and NOTHING READ THEM: every drawn-interior branch in
   eastscape.html is gated on `def.crypt`, and the pyramid's flag is `def.pyramid`. So the tomb was falling all
   the way through to the generic interior - `#9a6a3a` floorboards with a plank line down them, and a `#b8986a`
   plaster band for a wall. That is the brown planked room in the owner's screenshot. The gate is `def.tomb`
   now, set by both dungeons, and the pyramid has its own sandstone instead of borrowing the Crypt's slate.

   THE SHEET LAYOUT IS NOT THE GENERATOR'S ORDER, and it matters. The page picks a floor tile by COLUMN with
   fixed weights - column 0 is 86% of every tile laid, then 5, 1, 2, 3 and 4 in descending rarity - and columns
   6 and 7 are not floor at all, they are the TOP of a wall (column 6 is also sliced 8px wide for the side walls
   and column 7's lower cell is the strip along the front wall). So the plainest tile has to sit in column 0 or
   the room reads as patchwork, and a floor tile in column 6 would paint the walls with flagstones.

   Which tile is plainest was measured rather than eyeballed: per-channel standard deviation over each tile
   separates them cleanly into flagstones (sd 6-21), the one soot-black one (luminance 82 against 147-182) and
   the five pale-cap-over-dark-stone wall tops (sd 57-60). The generator happened to put four of those five at
   indices 6, 7, 14 and 15 - exactly the four slots the page wants them in - and left a fifth stranded at 13, in
   a floor slot, where 2% of the floor would have been painted with wall. FLOOR below is what fixes that.

   The wall sheet needs no reordering: its picker wants plain at k 0/1/3/4, a second kind at 2 and 5, the
   occasional damaged one at 6/7/8/10/11 and the loud reliefs at 12 and 14, and the prompt was numbered to match.

   (And the first wall set, 64px at tile_view "side", is not used: that view draws a thin band of blocks across
   the middle of the canvas and leaves the rest empty, because it is meant for a tile with depth. A full-bleed
   face is "top-down" - the same setting the floor used - however wrong that reads for a wall.) */
import sharp from "sharp";
import fs from "node:fs";
const SRC = "lt-pyr2/", OUT = "v3/assets/img/glad/flat/";

/* [source index per sheet cell], row 0 then row 1, columns 0..7 */
const FLOOR = [1, 10, 2, 3, 5, 0, 6, 7,
  9, 11, 12, 8, 5, 4, 14, 15];
const WALL = [...Array(16).keys()];

const sheet = async (pre, cell, order, out) => {
  const comp = [];
  for (let i = 0; i < 16; i++) {
    comp.push({ input: await sharp(`${SRC}${pre}_${order[i]}.png`).resize(cell, cell, { kernel: "nearest" }).png().toBuffer(), left: (i % 8) * cell, top: Math.floor(i / 8) * cell });
  }
  await sharp({ create: { width: cell * 8, height: cell * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comp).png({ palette: true, colours: 64 }).toFile(OUT + out);
  console.log(`  ${out}  ${cell * 8}x${cell * 2}  ${(fs.statSync(OUT + out).size / 1024).toFixed(1)} KB`);
};

await sheet("f", 32, FLOOR, "t_tomb.png");
await sheet("v", 64, WALL, "t_tombwall.png");

/* the bleeding badge. 48px as drawn, trimmed to its pixels - the page draws it at 18 and scales, so it wants to
   be a clean droplet with no margin rather than a specific size. */
{
  const info = await sharp(`${SRC}bleed.png`).trim({ threshold: 1 }).png({ palette: true, colours: 32 }).toFile(`${OUT}fx_bleed.png`);
  console.log(`  fx_bleed.png  ${info.width}x${info.height}  ${(fs.statSync(`${OUT}fx_bleed.png`).size / 1024).toFixed(1)} KB`);
}

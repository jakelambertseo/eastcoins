/* EastScape: THE CARNIVAL —  node tools/eastscape-carnival-art.mjs
   (2026-09-24, the owner: "the theme of this one is The Carnival ... create custom art for everything, the
   aeshetic i want is a creepy carnival like american horror story freak show ... i want some fat lady mobs, some
   triplee D inspired mobs, and pinheads and strongmans with huge weights ... a boss thats this mask guy ...
   a game area ... balloon pop, shooting targets, whack a mole")

   Reads the raw PixelLab downloads in lt-carn/ and writes the game's files into v3/assets/img/glad/flat/.
   Prompts start from tools/eastscape-art-style.md, plus the two lessons the Boneyard's Critic taught:

     DESCRIBE A SOLID THING. Every one of these prompts says "solid and fully opaque" and names a COLOUR AND A
     BRIGHTNESS for each part. The Critic asked for "translucent" and came back a flat silhouette with nothing
     inside its outline; none of this cast did, and they are far more detailed for it.
     AND SAY WHAT IS NOT IN THE PICTURE. "Nothing else in the image: no ground, no grass, no shadow on the floor,
     no other stalls, no background, no readable text" — the sands' first round came back with scenery baked in,
     and a stall drawn standing on its own patch of grass cannot be put down on sawdust.

   SIZE IS THE JOB, as in every one of these tools: the generator returns whatever canvas it was asked for and
   the game draws an object at its own pixel size, so each piece is trimmed of its empty margin and scaled to a
   height read off what is already in the world. The cast is sized against the band either side of it — the
   Thunderhead's Hail Drake (l) and The House (xl), the Trailer Park's Scrapper (m). */
import sharp from "sharp";
import fs from "node:fs";
const SRC = "lt-carn/", OUT = "v3/assets/img/glad/flat/";

/* [file key, source, target height, why] */
const PIECES = [
  /* the cast */
  ["pinhead", "pinhead", 62, "size s, and the smallest thing here — a Junkyard Dog is 60"],
  ["tripled", "tripled", 78, "size m, between the Scrapper and a Stagehand"],
  ["fatlady", "fatlady", 94, "size l. Wider than she is tall, which is the whole joke"],
  ["strongman", "strongman", 104, "size l, and the barbell is what makes him read from across the midway"],
  ["grinner", "grinner", 118, "size xl. The House is 128 and the Critic 104; the boss of a band sits between"],
  /* the midway */
  ["o_bigtop", "bigtop", 152, "3x3. The biggest thing on the map and the thing you see first"],
  ["o_funhouse", "funhouse", 140, "3x2, in the north-west — the mouth is the boss's lair"],
  ["o_balloonpop", "balloonpop", 100, "2x2 stall"],
  ["o_shootgallery", "shootgallery", 100, "2x2 stall"],
  ["o_whackamole", "whackamole", 96, "2x2 cabinet, a shade lower than the two stalls with awnings"],
  ["o_ticketbooth", "ticketbooth", 94, "1x2 kiosk"],
  ["o_sidetent", "sidetent", 104, "2x2. Dressing: the midway is lined with them"],
  ["o_haybale", "haybale", 40, "what wild() scatters instead of boulders — a rock is 48"],
  ["o_carnlitter", "carnlitter", 30, "what wild() scatters instead of bushes"],
  /* ---------------------------------------------------------------- the second round (2026-09-24, testing it)
     (the owner: "the grinning man needs to be in a horroresque locked in area, and the other mobs in the area
     need a chance too drop a carnival ticket ... the ashetic needs more horror esque elements, bloody things,
     knives on the ground")
     THE CAGE IS A MENAGERIE CAGE and not the Boneyard's railings, which exist and would have been free: a
     graveyard fence says "keep out" and a circus cage says "the thing inside is an exhibit". He is billed, not
     buried. The vertical run was drawn twice for the reason the Boneyard's was — a fence running away from the
     camera is not a rotation of one running across it — and a second time after that because it came back
     DARK while the horizontal one is red, and two halves of one cage have to be the same cage. */
  ["o_cagebarH", "cagebarH", 34, "a cage wall stands taller than a graveyard railing's 30"],
  ["o_cagebarV", "cagebarV", 50, "the same bars end on"],
  ["o_turnstile", "turnstile", 58, "the only way in, and the posts read above the run they interrupt"],
  ["o_bloodpool", "bloodpool", 22, "a ground decal: flat, and under everything else"],
  ["o_knives", "knives", 28, "thrown and left. Shorter than a hay bale so it reads as litter, not a prop"],
  ["o_meathook", "meathook", 44, "hung, so it stands above the ground clutter"],
  /* ---------------------------------------------------------------- the third round (2026-09-24)
     (the owner: "more concept art for the circus. the circus is also very linear as far as walk ways, etc. can
     we randomize it so it feels like theres unique sections?")
     THE BANNERS ARE WHAT MAKE A SECTION READ AS ONE. The concept art is a corridor of painted sideshow banners
     on poles with the entrance arch at its head, and that is the single most recognisable thing about a freak
     show — more than the tents. Two of them, different colourways, so a row does not march; the arch marks the
     way in; the wagons are the back lot, where a carnival lives when nobody is looking. */
  ["o_banner", "banner", 84, "1x2, and it stands over head height beside the road"],
  ["o_banner2", "banner2", 84, "the second colourway, so a row of them does not repeat"],
  ["o_archway", "archway", 100, "3x2 over the way in. Shorter than the big top so it does not compete with it"],
  ["o_wagon", "wagon", 80, "3x2. Lower than a tent: it is furniture, not an attraction"],
  /* the duck pond: the owner sent a photograph of one and asked for exactly that */
  ["o_duckpond", "duckpond", 62, "2x1. A tub on the ground, so it sits low - a hay bale is 40 and a sidetent 104"],
];
/* the two fish and their cooked forms, all ITEM icons in flat/items/ at 32x32 */
for (const k of ["goldfish", "koi", "cgoldfish", "ckoi"]) {
  const t = await sharp(SRC + k + ".png").trim({ threshold: 1 }).resize(32, 32, { fit: "contain", kernel: "nearest", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true, colours: 48 }).toBuffer();
  fs.writeFileSync(OUT + "items/" + k + ".png", t);
  console.log("  items/" + (k + ".png").padEnd(16) + " 32x32  " + (t.length / 1024).toFixed(1) + " KB");
}
const _unused = [];

/* THE TICKET IS AN ITEM, which is a different directory AND a different size — 32x32 in flat/items/. Getting
   that wrong draws an admission stub the size of a hay bale. */
{
  const t = await sharp(`${SRC}carnivalticket.png`).trim({ threshold: 1 }).resize(32, 32, { fit: "contain", kernel: "nearest", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true, colours: 48 }).toBuffer();
  fs.mkdirSync(`${OUT}items/`, { recursive: true });
  fs.writeFileSync(`${OUT}items/carnivalticket.png`, t);
  console.log(`  items/carnivalticket.png  32x32  ${(t.length / 1024).toFixed(1)} KB   — the key to the cage`);
}

for (const [key, from, h, why] of PIECES) {
  const src = `${SRC}${from}.png`;
  if (!fs.existsSync(src)) { console.log(`  !! ${key}: no ${src}`); continue; }
  const trimmed = await sharp(src).trim({ threshold: 1 }).toBuffer();
  const m = await sharp(trimmed).metadata();
  const w = Math.max(1, Math.round((m.width / m.height) * h));
  await sharp(trimmed).resize(w, h, { kernel: "nearest" }).png({ palette: true, colours: 64 }).toFile(OUT + `${key}.png`);
  console.log(`  ${(key + ".png").padEnd(20)} ${String(w).padStart(3)}x${String(h).padStart(3)}  ${(fs.statSync(OUT + `${key}.png`).size / 1024).toFixed(1).padStart(5)} KB   — ${why}`);
}

/* ---------------------------------------------------------------- THE GROUND
   Trampled sawdust, and a RECOLOUR of t_dirt for exactly the reason the desert was one: the Wang geometry is
   what makes a ground sheet tile, regenerating a Wang set is the one art job here that has come back unusable
   before, and a recolour keeps the geometry untouched. Every grass pixel keeps its LUMINANCE and goes on a
   sawdust ramp, so the sheet's own shading survives; everything else is warmed very slightly.

   Having a theme at all is also what stops the painter scattering grass tufts and flowers across the map, which
   is what made the Golden Sands ship as a desert with a lawn. */
const DUST_DARK = [108, 86, 52], DUST_LIGHT = [216, 194, 140];
const sawdust = async (from, to) => {
  const { data, info } = await sharp(OUT + from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > r && g > b) {
      const L = Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 190);
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(DUST_DARK[k] + (DUST_LIGHT[k] - DUST_DARK[k]) * L);
    } else { data[i] = Math.min(255, r + 6); data[i + 2] = Math.max(0, b - 8); }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 48 }).toFile(OUT + to);
  console.log(`  ${to.padEnd(20)} ${info.width}x${info.height}  ${(fs.statSync(OUT + to).size / 1024).toFixed(1).padStart(5)} KB   — recoloured from ${from}`);
};
await sawdust("t_dirt.png", "t_sawdust.png");
await sawdust("t_water.png", "t_dwater.png");   // the dunk tank's water: its dry corners are grass too

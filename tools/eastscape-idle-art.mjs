/* EastScape: the idle frames —  node tools/eastscape-idle-art.mjs [--sheet]
   A monster standing still breathes. That is TWO pictures, not four, and the FIRST of them is the one the game already ships:
   these animations were generated with keep_first_frame, so stored frame 0 is the character's own east rotation — the exact
   picture in the sprite sheet. So only the second pose is downloaded, as <mob>_i2.png, and the draw alternates between the
   ordinary art and that. Half the bytes of a two-file idle, and frame one cannot drift away from the sprite.

   PICK is which stored frame reads as the top of the breath. It is a judgement about the picture, so --sheet writes all five
   frames of each monster into the scratch folder to look at before choosing, and the number is then written down here. */
import fs from "node:fs";
const OUT = "v3/assets/img/glad/flat/", ACC = "4e81aa0e-6201-484d-a0fb-c1ae89736d11";
const sharp = (await import("sharp")).default;
/* mob key -> [character id, ANIMATION id, which stored frame is the second pose]
   The animation id is NOT the group id animate_character prints when it queues the job — the frame URLs take the animation's
   own id, which only get_character lists. Using the group id 404s every frame. */
const IDLES = {
  chicken:  ["5e6ae936-0e3e-42d1-bb52-3a4674eed251", "3fdddbd1-9f54-4455-ac41-4497cb799b79", 2],
  rotten:   ["b18af3cb-4ee2-47d6-95a0-e193652b7f8e", "ee5ce5ad-0efe-4599-8d3d-6ee28b6f48ef", 2],
  olive:    ["fa7ca86f-cb53-44aa-81d9-414db4522887", "df1c72a6-f175-4cb8-96f0-168910beae54", 2],
  cow:      ["2642667f-32bc-4d36-a2e2-b4a58fccb997", "eb07463b-a4c2-4e7f-a53a-dbffd7adb609", 2],
  hornworm: ["ac02f8e4-3766-40a2-b664-4f85a2e2fddb", "c5f6b6b5-e3be-4917-af0f-d24803bc9daf", 2],
  boar:     ["8b859808-7d3d-474c-9e69-05a35be7212c", "e4b58445-1805-4814-8a8b-50b1b7b892be", 2]
};
const SHEET = process.argv.includes("--sheet");
const DIR = (process.env.TEMP || "/tmp") + "/es-idle";
if (SHEET) fs.mkdirSync(DIR, { recursive: true });

const url = (c, a, i) => `https://backblaze.pixellab.ai/file/pixellab-characters/${ACC}/${c}/animations/${a}/east/${i}.png`;
let wrote = 0;
for (const [mob, [charId, animId, pick]] of Object.entries(IDLES)) {
  if (SHEET) {
    for (let i = 0; i < 5; i++) {
      const r = await fetch(url(charId, animId, i));
      if (!r.ok) { console.log(`  ${mob} frame ${i}: ${r.status}`); continue; }
      const out = `${DIR}/${mob}-${i}.png`;
      await sharp(Buffer.from(await r.arrayBuffer())).trim({ threshold: 1 }).png().toFile(out);
    }
    console.log(`  ${mob}: five frames in ${DIR}`);
    continue;
  }
  const r = await fetch(url(charId, animId, pick));
  if (!r.ok) { console.log(`  skip ${mob}: frame ${pick} is ${r.status}`); continue; }
  const out = `${OUT}${mob}_i2.png`;
  const info = await sharp(Buffer.from(await r.arrayBuffer())).trim({ threshold: 1 }).png({ palette: true }).toFile(out);
  console.log(`  ${mob}_i2.png  ${info.width}x${info.height}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
  wrote++;
}
if (!SHEET) console.log(`${wrote} idle poses written.`);

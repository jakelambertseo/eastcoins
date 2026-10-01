/* THRILL HILL'S ANIMATIONS (2026-10-01, the owner: "yes to animations") —  node tools/eastscape-thrill-anims.mjs
   PixelLab animations (animate_object, v3) of the map objects the monsters and props were made from; ids in tools/thrill/anims.json.
     the monsters  their real walk and attack cycles replace the squash-and-stretch frames tools/eastscape-thrill-art.mjs made: each frame
                   trimmed and scaled by the SAME factor as the standing picture, written as <mob>_w1..4 and _a1..4 (the page anchors every
                   frame on its drawn feet and middle, so a frame on a bigger canvas sits right)
     the fire      a flicker loop for the hoop, the wall of fire and the burning barrels: every frame scaled like the still picture and laid in
                   cells of one size, feet at the bottom and centred, as <art>_a (one row). The numbers the page needs to play it in the
                   still's place (frames, cell size, fps, and the offset that puts its feet where the still's were) go to
                   tools/thrill/anims-out.json, which THRILL_ANIM in the rules file copies.
   An animation that isn't finished yet (anim: null in anims.json) is skipped and the still keeps its place. */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
const ROOT = "C:/Users/jake/code/eastcoins/", FLAT = ROOT + "v3/assets/img/glad/flat/", J = JSON.parse(fs.readFileSync(ROOT + "tools/thrill/anims.json", "utf8"));
const T = 16, A = 2, fetchPng = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); };
const frameUrl = (obj, anim, i) => `${J.base}${obj}/animations/${anim}/unknown/${i}.png`;
const scaled = async (buf, k) => { const b = await sharp(buf).ensureAlpha().trim({ threshold: 1 }).png().toBuffer(), m = await sharp(b).metadata(); return sharp(b).resize(Math.max(1, Math.round(m.width * k)), Math.max(1, Math.round(m.height * k)), { kernel: "nearest" }).png().toBuffer(); };
let wrote = 0;
for (const [mob, M] of Object.entries(J.mobs)) for (const [kind, pre] of [["walk", "w"], ["attack", "a"]]) {
  if (!M[kind]) continue;
  for (let i = 0; i < 4; i++) { const b = await scaled(await fetchPng(frameUrl(M.obj, M[kind], i)), M.scale); await sharp(b).png({ palette: true, colours: 128 }).toFile(FLAT + `${mob}_${pre}${i + 1}.png`); wrote++; }
}
const out = {};
for (const [art, Pp] of Object.entries(J.props)) {
  if (!Pp.anim) { console.log(`  ${art}: not finished yet, the still stays`); continue; }
  const frames = []; for (let i = 0; i < Pp.frames; i++) frames.push(await scaled(await fetchPng(frameUrl(Pp.obj, Pp.anim, i)), Pp.scale));
  const meta = await Promise.all(frames.map((f) => sharp(f).metadata())), fw = Math.max(...meta.map((m) => m.width)), fh = Math.max(...meta.map((m) => m.height));
  await sharp({ create: { width: fw * frames.length, height: fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((f, i) => ({ input: f, left: i * fw + Math.floor((fw - meta[i].width) / 2), top: fh - meta[i].height }))).png({ palette: true, colours: 160 }).toFile(FLAT + `${art}_a.png`);
  out[art] = { anim: `${art}_a`, frames: Pp.frames, cols: Pp.frames, fw, fh, fps: 10 };   /* the page works out where it stands from the footprint (THRILL_ANIM, pvBuild) */
  wrote++;
  if (art === "th_firebarrels") {   /* the single burning barrel (th_flamebarrel) is the left third of the row, so its flicker is too */
    const one = await Promise.all(frames.map(async (f) => { const m = await sharp(f).metadata(), w = Math.floor(m.width / 3) + 1; return sharp(f).extract({ left: 0, top: 0, width: w, height: m.height }).trim({ threshold: 1 }).png().toBuffer(); }));
    const om = await Promise.all(one.map((f) => sharp(f).metadata())), ow = Math.max(...om.map((m) => m.width)), oh = Math.max(...om.map((m) => m.height));
    await sharp({ create: { width: ow * one.length, height: oh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(one.map((f, i) => ({ input: f, left: i * ow + Math.floor((ow - om[i].width) / 2), top: oh - om[i].height }))).png({ palette: true, colours: 128 }).toFile(FLAT + "th_flamebarrel_a.png");
    out.th_flamebarrel = { anim: "th_flamebarrel_a", frames: Pp.frames, cols: Pp.frames, fw: ow, fh: oh, fps: 10 }; wrote++;
  }
}
fs.writeFileSync(ROOT + "tools/thrill/anims-out.json", JSON.stringify(out, null, 1));
{ const p = ROOT + "v3/assets/js/eastscape-shared.js", s = fs.readFileSync(p, "utf8"), line = `export const THRILL_ANIM = ${JSON.stringify(out)};`;
  if (!/^export const THRILL_ANIM = .*;$/m.test(s)) throw new Error("THRILL_ANIM line not found in the rules file");
  fs.writeFileSync(p, s.replace(/^export const THRILL_ANIM = .*;$/m, line)); }
console.log(`${wrote} pictures; sheets: ${Object.keys(out).join(", ") || "none"}`);
console.log(JSON.stringify(out));

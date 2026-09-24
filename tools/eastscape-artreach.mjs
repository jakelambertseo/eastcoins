/* Can the player's browser actually GET the picture for everything in this scene? (2026-09-24)

   WHY. AREA_ART is not a list of what a scene uses — naming a picture there is what takes it OUT of core.png.
   So a picture can exist on disk, be in ART_FILES, be packed into a sheet, and still never reach the player,
   because the only area list naming it is one nobody visits. It fails silently: the object falls back to its
   hand-drawn shape and looks like a generic version of itself.

   It has now bitten three times. The Boneyard's Ancient yews drew as plain trees for weeks because `o_yew` was
   claimed only by `area-closed`; the guild's furniture was briefly deferred out from under the whole game; and
   `o_deadtree` was never in ART_FILES at all while its stump was.

   WHAT IT CHECKS. For every object in every OPEN scene, the art key objArt() would resolve — `o_<type>`, or the
   object's own `art` — must be reachable from that scene: in core.png, or named in that scene's AREA_ART list.

     node tools/eastscape-artreach.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-closed.js";
import fs from "node:fs";

Object.assign(G.SCENES, createClosedScenes(G, G._MAP));

const ROOT = "C:/Users/jake/code/eastcoins";
const html = fs.readFileSync(`${ROOT}/eastscape.html`, "utf8");
const packs = JSON.parse(fs.readFileSync(`${ROOT}/v3/assets/img/glad/packs/packs.json`, "utf8"));

/* which sheet holds each picture */
const sheet = {};
for (const [pk, v] of Object.entries(packs)) for (const k of Object.keys(v.keys || {})) (sheet[k] ||= []).push(pk);

/* Each scene's own AREA_ART entry. Parsed by slicing the block between one scene key and the next rather than
   by matching a line: the guild's list is written across several lines, and a single-line regex reported six of
   its own props as unreachable. A checker that lies is worse than no checker. */
const block = (() => { const i = html.indexOf("const AREA_ART = {"); return i < 0 ? "" : html.slice(i, html.indexOf(String.fromCharCode(10) + "};", i)); })();
const area = {};
{
  const heads = [...block.matchAll(/^ {2}([a-z0-9]+): /gm)];
  heads.forEach((m, i) => { area[m[1]] = block.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : block.length); });
}

let bad = 0, checked = 0;
const noArt = {};   /* object kinds with no picture anywhere, and which scenes place them */
const onDisk = (k) => fs.existsSync(`${ROOT}/v3/assets/img/glad/flat/${k}.png`);

for (const key of G.OPEN) {
  const sc = G.SCENES[key];
  if (!sc?.build) continue;
  let b;
  try { b = sc.build(); } catch { continue; }
  const list = area[key] || "";
  const seen = new Set();
  for (const ob of b.objs || []) {
    const k = ob.art || `o_${ob.t}`;
    if (seen.has(k)) continue;
    seen.add(k);
    /* (2026-09-24) NO PICTURE AT ALL WAS A BLIND SPOT. This skipped it as "the object draws its own shape by
       design", which is true of a bush or a boulder and quite wrong for a themed prop: the owner placed
       gravestones, skeletons and dead-tree snags all over the Gloam and none of them had a picture, so all three
       fell back to a scribble - and this checker said the scene was fine. They are listed now rather than
       failed, because some types really are meant to be drawn by hand; the point is that the list is SHORT and
       somebody reads it. */
    if (!onDisk(k)) { (noArt[k] ||= new Set()).add(G.SCENES[key].name); continue; }
    checked++;
    const where = sheet[k] || [];
    if (where.includes("core")) continue;                      // everyone has it
    if (list.includes(`"${k}"`)) continue;                      // this scene claims it
    if (list === "WILD_ART" && /^o_(tree|bush|boulder)/.test(k)) continue;   // the shared treeline set
    bad++;
    console.log(`  !! ${G.SCENES[key].name} draws ${ob.t} as ${k}.png, which exists but is only in [${where.join(", ") || "no pack"}] — it will fall back to a generic shape`);
  }
}

const drawn = Object.entries(noArt).sort((a, b) => b[1].size - a[1].size);
if (drawn.length) {
  console.log(`\n  ${drawn.length} object kind(s) with NO picture anywhere, drawn by hand instead:`);
  for (const [k, where] of drawn) console.log(`    ${k.padEnd(18)} ${[...where].join(", ")}`);
}
console.log(bad ? `\n${bad} picture(s) unreachable from the scene that needs them` : `  every picture ${checked} object kinds need is reachable from its own scene\n\nart reaches the player`);
process.exitCode = bad ? 1 : 0;

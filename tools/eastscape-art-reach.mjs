/* DOES EVERY MAP LOAD THE PICTURES IT STANDS ON? —  node tools/eastscape-art-reach.mjs
   (2026-09-29) Naming a picture in ANY AREA_ART list takes it out of core.png, so from then on only the maps whose own list names it
   will ever load it. Two maps lost art that way in one day: the Yard's barrels (o_barrel went into the cellar's list) and the Boneyard's
   and Cloudreach's dragonstone rocks (o_rock_dragonstone_ore went into the Wilderness's). A map only showed the picture if you had
   walked through the other area first in that tab.

   For every scene this builds the map, works out the picture each object asks for the way the page's objArt() does, and reports any
   picture that exists in flat/ but is in neither core nor that scene's own list. Exit 1 if it finds one. */
globalThis.__ES_OPEN_ALL = true;
import fs from "fs";
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { lists } = await import("./eastscape-pack.mjs");
const { ART_FILES, AREA_ART } = lists();
const FLAT = new URL("../v3/assets/img/glad/flat/", import.meta.url);
const has = (k) => fs.existsSync(new URL(`${k}.png`, FLAT));
const inArea = new Set(Object.values(AREA_ART).flat());
const core = new Set(ART_FILES.filter((k) => !inArea.has(k)));
/* the picture an object asks for when it is standing (objArt in eastscape.html, without the stump / empty / bare states) */
const want = (ob) => ob.t === "plot" || ob.t === "fbed" ? null : ob.t === "spot" && ob.look && !ob.special ? `o_spot${ob.look}`
  : ob.art ? ob.art : ob.t === "rock" || ob.t === "vein" ? `o_${ob.t}_${ob.ore}` : ob.t === "vine" && ob.special ? "o_vine_gold" : ob.t === "boatback" ? "o_ferry" : `o_${ob.t}`;
let bad = 0;
for (const key of Object.keys(G.SCENES)) {
  if (!G.OPEN.has(key) && !/^(isle|shore|home|cellar|crypt|pyramid|count|tower|orchard|foundry|fd_)/.test(key)) continue;   /* a shut map loads nothing: nobody stands in it */
  let b; try { b = G.buildScene(key); } catch { continue; }
  if (!b?.objs) continue;
  const own = new Set(AREA_ART[key.split(":")[0]] || []), miss = new Map();
  for (const ob of b.objs) {
    const k = want(ob); if (!k || ob.proj || ob.decor || !has(k) || core.has(k) || own.has(k)) continue;
    miss.set(k, (miss.get(k) || 0) + 1);
  }
  for (const [k, n] of miss) {
    const where = Object.entries(AREA_ART).filter(([, l]) => l.includes(k)).map(([a]) => a);
    console.log(`  !! ${key}: ${k} (${n} on the map) loads only with ${where.join(", ") || "nothing"}`); bad++;
  }
}
console.log(bad ? `\n${bad} picture(s) a map stands on but never loads` : "every map loads every picture it stands on");
process.exitCode = bad ? 1 : 0;

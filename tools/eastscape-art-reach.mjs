/* DOES EVERYTHING IN A SCENE HAVE ITS PICTURE WHEN YOU STAND THERE? —  node tools/eastscape-art-reach.mjs
   (2026-09-27, the owner: "parlay pete is rendered by html instead of his art, check him and others") A picture named on ANY area's art
   list is taken OUT of the login download and fetched only when you walk into (or next to) that area. Parlay Pete stands in the Casino,
   but his facings were on the Thieves' Guild's list, so a fresh character in the Casino drew him as the plain fallback figure. This walks
   every open scene and asks, for each NPC and monster in it: is its picture in core, or on THIS scene's own list? Anything that only
   reaches the scene because a neighbour happened to load it first is a fault. Exit code 1 when anything is found. */
import "./eastscape-open-all.mjs";
import fs from "fs"; import path from "path";
import * as G from "../v3/assets/js/eastscape-shared.js";
import { lists } from "./eastscape-pack.mjs";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const FLAT = path.join(ROOT, "v3/assets/img/glad/flat"), has = (k) => fs.existsSync(path.join(FLAT, `${k}.png`));
const { ART_FILES, AREA_ART } = lists(), lazy = new Set(Object.values(AREA_ART).flat());
const core = new Set(ART_FILES.filter((k) => !lazy.has(k)));
/* the NPC_ART map in the page: name -> art, for NPCs whose definition carries no `art` */
const html = fs.readFileSync(path.join(ROOT, "eastscape.html"), "utf8"), npcArtLine = html.match(/const NPC_ART = (\{[^\n]*?\});/);
const NPC_ART = npcArtLine ? new Function(`return ${npcArtLine[1]}`)() : {};
/* the closed maps, so their NPCs and monsters are checked too */
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
let bad = 0;
const reaches = (k, base) => !has(k) || core.has(k) || (AREA_ART[base] || []).includes(k);
for (const [key, def] of Object.entries(G.SCENES)) {
  if (!G.OPEN.has(key) && !["isle", "isle2", "isle3", "shore", "home", "cellar"].includes(key)) continue;
  const miss = [];
  for (const n of def.npcs || []) { const art = n.art || NPC_ART[n.name]; if (!art || n.look) continue; for (const k of [`${art}_south`, `${art}_east`]) if (!reaches(k, key)) miss.push(`NPC ${n.name}: ${k}`); }
  for (const [t] of def.mobs || []) { const art = G.MOBS[t]?.art || t; if (!reaches(art, key)) miss.push(`monster ${t}: ${art}`); }
  if (miss.length) { bad += miss.length; console.log(`  !! ${key}: ${[...new Set(miss)].join(" | ")}`); }
}
console.log(bad ? `\n${bad} picture(s) only arrive if a neighbour loaded them first` : "\nevery NPC and monster in every open scene has its picture on arrival");
process.exitCode = bad ? 1 : 0;

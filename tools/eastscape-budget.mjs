/* EastScape size budget — run before a deploy (the content check runs it too):  node tools/eastscape-budget.mjs

   What a player downloads, measured against limits, so features can be added freely without the game quietly
   getting heavy. The server side (tick time, bandwidth per player) is watched by the load test and the dashboard's
   EastScape card; this covers the page.

   - code: the page, the shared rules, the wiki and the sounds, gzipped (what actually crosses the wire)
   - startup art: every picture loaded at login (ART_FILES minus the per-area lists)
   - each area's art: what walking into it fetches the first time
   Exits 1 if anything is over budget. Raise a budget on purpose, never by accident. */
import fs from "fs"; import zlib from "zlib"; import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const FLAT = path.join(ROOT, "v3/assets/img/glad/flat");
const BUDGET = {
  codeGzKB: 175,        // page + rules + wiki, compressed
  startupArtKB: 300,    // pictures at login
  startupFiles: 160,    // requests at login (drops to ~30 once the art is packed into sprite sheets before launch)
  areaArtKB: 120        // any one area's own pictures
};

const html = fs.readFileSync(path.join(ROOT, "eastscape.html"), "utf8");
const grab = (name) => {
  const i = html.indexOf(`const ${name} = `); if (i < 0) throw new Error(`${name} not found in eastscape.html`);
  let depth = 0, j = html.indexOf("=", i) + 1;
  for (let k = j; k < html.length; k++) { const c = html[k]; if (c === "[" || c === "{") depth++; if (c === "]" || c === "}") { depth--; if (!depth) return html.slice(j, k + 1); } }
  throw new Error(`could not read ${name}`);
};
const ART_FILES = new Function(`return ${grab("ART_FILES")}`)();
const WILD_ART = new Function(`return ${grab("WILD_ART")}`)();
const CASINO_ART = new Function(`return ${grab("CASINO_ART")}`)();
const AREA_ART = new Function("WILD_ART", "CASINO_ART", `return ${grab("AREA_ART")}`)(WILD_ART, CASINO_ART);

const kb = (b) => Math.round(b / 102.4) / 10;
const size = (k) => { try { return fs.statSync(path.join(FLAT, `${k}.png`)).size; } catch (e) { return 0; } };
const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(ROOT, f))).length;

let bad = 0;
const line = (label, val, max, unit) => { const over = val > max; if (over) bad++; console.log(`  ${over ? "OVER " : "ok   "} ${label.padEnd(34)} ${String(val).padStart(7)} ${unit}  (budget ${max})`); };

console.log("EastScape size budget");
const code = gz("eastscape.html") + gz("v3/assets/js/eastscape-shared.js") + gz("v3/assets/js/eastscape-wiki.js") + gz("v3/assets/js/eastscape-sfx.js");
line("code, gzipped", kb(code), BUDGET.codeGzKB, "KB");

const lazy = new Set(Object.values(AREA_ART).flat());
const startup = [...new Set(ART_FILES)].filter((k) => !lazy.has(k));
line("startup art", kb(startup.reduce((a, k) => a + size(k), 0)), BUDGET.startupArtKB, "KB");
line("startup art requests", startup.length, BUDGET.startupFiles, "files");

for (const [area, list] of Object.entries(AREA_ART)) line(`area art: ${area}`, kb([...new Set(list)].reduce((a, k) => a + size(k), 0)), BUDGET.areaArtKB, "KB");

// a picture named in an area list that the page never asks for is a typo, not a saving
const known = new Set(ART_FILES), stray = [...lazy].filter((k) => !known.has(k));
if (stray.length) { bad++; console.log(`  OVER  area lists name pictures missing from ART_FILES: ${stray.join(", ")}`); }

console.log(bad ? `\n${bad} over budget.` : "\nAll within budget.");
process.exit(bad ? 1 : 0);

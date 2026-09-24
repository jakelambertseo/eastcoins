/* Every G.<something> the game reaches for must actually exist in the rules.

   WHY. Twice in one day a rename left a caller pointing at a name that had gone. Neither was a syntax error, so
   esbuild was happy and the page shipped: an undefined global is a RUNTIME failure, and it only fires on the one
   screen that reaches that line. `tixImg` took out two hiscore boards for half a day, and renaming forgeSpeed to
   forgeSpeedAt would have turned every tool's speed chip into NaN on the anvil.

   This reads the rules file's real exports and every G.<name> written anywhere that imports it, and complains
   about anything reached for that is not there. It is the cheapest possible version of a type checker and it
   catches the exact mistake that keeps happening.

   Run: node tools/eastscape-exports-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/jake/code/eastcoins";
const FILES = [
  "eastscape.html",
  "eastscape-worker/src/index.js",
  "eastscape-worker/src/crypt.js",
  "eastscape-worker/src/pit.js",
  "eastscape-worker/src/tower.js",
  ...fs.readdirSync(path.join(ROOT, "v3/assets/js")).filter((f) => /^eastscape-.*\.js$/.test(f) && f !== "eastscape-shared.js").map((f) => `v3/assets/js/${f}`),
];

const have = new Set(Object.keys(G));
let bad = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, "utf8");
  const seen = new Map();
  for (const m of src.matchAll(/\bG\.([A-Za-z_$][\w$]*)/g)) {
    const name = m[1];
    if (have.has(name) || seen.has(name)) continue;
    seen.set(name, src.slice(0, m.index).split("\n").length);
  }
  for (const [name, line] of seen) { console.log(`  !! ${rel}:${line}  G.${name} does not exist in the rules`); bad++; }
}
if (!bad) console.log(`  every G.<name> across ${FILES.length} files resolves (${have.size} exports)`);

console.log(bad ? `\n${bad} dangling reference(s)` : "\nno dangling references");
process.exitCode = bad ? 1 : 0;

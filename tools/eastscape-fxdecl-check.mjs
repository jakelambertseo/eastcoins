/* DOES EVERY fxOf LOCAL STILL EXIST WHERE IT IS READ? —  node tools/eastscape-fxdecl-check.mjs

   (2026-09-24, the owner: "fish arent going into my inventory, other users report that as well ... the sound is
   just replaying over and over") ONE SLIP, TWICE, AND THE SECOND ONE SHIPPED.

   Wiring the Coilling's swing bonus through the skills meant rewriting four lines that each looked like
       const fx = G.fxOf(C); a.next = now + Math.round(MS / ((1 + fx.speed) * toolSpeed(...)));
   into a call to G.swingFx(C). In thieving I noticed `.steal` reading fxT further down and put the declaration
   back. In FISHING I did not: fx.bite, fx.tix, fx.zdrop and fx.rare all sit four lines below, so every cast
   threw a ReferenceError before a fish was handed over — the rod sound played, the tick died, the client asked
   again, and it broke fishing everywhere rather than only where anybody happened to be standing.

   Node --check and esbuild both pass this happily: an undeclared identifier is a RUNTIME error, and there is no
   linter in this repo to catch it. So this does the one narrow thing that would have:

     find every `const <name> = G.fxOf(`, then find every `<name>.` read, and insist each read has one of those
     declarations close above it.

   IT IS DELIBERATELY NARROW. It knows nothing about scope or braces and it would not notice an undeclared name
   of any other kind; a real scope analyser needs a parser this repo does not have, and a checker that pretends
   to more than it does is worse than none. Comments and strings are blanked first, because the two false
   positives on the first run were both the word fx.speed inside a comment explaining the bug. */
import { readFileSync } from "node:fs";

const FILES = ["eastscape-worker/src/index.js", "eastscape-worker/src/pyramid.js", "eastscape-worker/src/crypt.js"];
const ROOT = "C:/Users/jake/code/eastcoins";
const NEAR = 60;   // a declaration further than this above its read is suspicious, not proof

let bad = 0, reads = 0;
for (const rel of FILES) {
  let raw;
  try { raw = readFileSync(`${ROOT}/${rel}`, "utf8"); } catch { continue; }
  /* blank out block comments across lines, then line comments and string/template bodies */
  const flat = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const src = flat.split("\n").map((l) => l.replace(/\/\/.*$/, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``"));

  const names = new Set();
  for (const l of src) { const m = l.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*G\.fxOf\(/); if (m) names.add(m[1]); }
  if (!names.size) continue;

  for (const v of names) {
    const decl = [], use = [];
    src.forEach((l, i) => {
      if (new RegExp(`const\\s+${v}\\s*=\\s*G\\.fxOf\\(`).test(l)) decl.push(i);
      if (new RegExp(`(?<![\\w.$])${v}\\s*\\.`).test(l)) use.push(i);
    });
    for (const u of use) {
      reads++;
      const d = decl.filter((x) => x <= u).pop();
      if (d === undefined) { console.log(`  !! ${rel}:${u + 1} reads ${v}. and nothing declares it`); bad++; }
      else if (u - d > NEAR) { console.log(`  !! ${rel}:${u + 1} reads ${v}. — nearest declaration is ${u - d} lines up, which is probably a different branch`); bad++; }
    }
  }
  console.log(`  ${rel}: ${[...names].join(", ")}`);
}

console.log(bad ? `\n${bad} suspect read(s)` : `\nall ${reads} reads of an fxOf local have their declaration close above them`);
process.exitCode = bad ? 1 : 0;

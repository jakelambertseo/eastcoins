/* node tools/eastscape-style-diff.mjs before.json after.json [before-again.json] : where two style fingerprints differ, screen by screen.
   With a third file (a second BEFORE run), anything that already differed between the two before runs is noise (an animation caught
   mid-frame, a live count, the look builder's random face) and is left out. */
import fs from "node:fs";
const [a, b, c] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
let n = 0;
for (const page of Object.keys(a)) {
  const A = a[page] || {}, Bp = b[page] || {}, keys = new Set([...Object.keys(A), ...Object.keys(Bp)]), diffs = [];
  const C = c ? c[page] || {} : null;
  for (const k of keys) if (A[k] !== Bp[k] && !(C && A[k] !== C[k])) diffs.push(k);
  if (!diffs.length) continue;
  n += diffs.length; console.log(`${page}: ${diffs.length} element(s) differ`);
  for (const k of diffs.slice(0, 6)) {
    const x = (A[k] || "").split("|"), y = (Bp[k] || "").split("|");
    const at = x.map((v, i) => (v !== y[i] ? i : -1)).filter((i) => i >= 0);
    console.log(`   ${k}${!A[k] ? " (only in b)" : !Bp[k] ? " (only in a)" : `: ${at.map((i) => `[${i}] ${x[i]} -> ${y[i]}`).join(" ; ").slice(0, 300)}`}`);
  }
}
console.log(n ? `${n} difference(s)` : "identical");

/* Did you bump the ?v= when you changed the file? (2026-09-23)

   WHY. Assets under /v3/assets/ are served `max-age=31536000, immutable` — a year, per `_headers`. The `?v=` in
   the URL IS the invalidation and there is no other one; nothing here can purge Cloudflare's edge. So changing a
   file's CONTENT without changing its `?v=` ships the change to the origin and to nobody's browser: a new visitor
   gets it, and everybody who already has it keeps the old copy for a year.

   This happened three times in one evening on the Thieves' Guild — the wiki guide, the two new sound effects and
   the Crypt's permit drop were all live on the origin and invisible to every existing player. From the outside it
   looks exactly like the feature was never built, which is the worst part: you go looking for a bug in the code.

   HOW. Every `<name>.js?v=N` in eastscape.html is recorded here with a hash of that file's bytes. If the bytes
   move and N does not, this fails. `eastscape-shared.js` is included too, even though its VERSION handshake
   usually catches it.

     node tools/eastscape-vcheck.mjs            check (exit 1 on a stale version)
     node tools/eastscape-vcheck.mjs --update   record the current state, after you HAVE bumped
*/
import fs from "node:fs";
import crypto from "node:crypto";

const PAGE = "eastscape.html";
const STORE = "tools/.asset-versions.json";
const update = process.argv.includes("--update");

const html = fs.readFileSync(PAGE, "utf8");
const seen = new Map();
for (const m of html.matchAll(/([A-Za-z0-9_-]+\.(?:js|css))\?v=(\d+)/g)) {
  const [, file, v] = m;
  if (!seen.has(file)) seen.set(file, Number(v));
  else if (seen.get(file) !== Number(v)) console.log(`  !! ${file} is referenced at two different versions (${seen.get(file)} and ${v})`);
}

const find = (file) => {
  for (const dir of ["v3/assets/js", "v3/assets/css", "assets", "."]) {
    const p = `${dir}/${file}`;
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const old = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : {};
const now = {};
let bad = 0, checked = 0;

for (const [file, v] of [...seen].sort()) {
  const path = find(file);
  if (!path) { console.log(`  ?  ${file} is referenced but not found on disk`); continue; }
  const hash = crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex").slice(0, 16);
  now[file] = { v, hash };
  checked++;
  const was = old[file];
  if (!was) { if (!update) console.log(`  new ${file} (v=${v}) — recorded`); continue; }
  if (was.hash !== hash && was.v === v) {
    console.log(`  !! ${file} CHANGED but is still ?v=${v} — every player who already has it keeps the old copy for a year`);
    bad++;
  }
}

if (update) {
  fs.writeFileSync(STORE, JSON.stringify(now, null, 2) + "\n");
  console.log(`recorded ${checked} versioned asset(s)`);
} else {
  if (!bad) { fs.writeFileSync(STORE, JSON.stringify(now, null, 2) + "\n"); console.log(`  ${checked} versioned assets, every changed one bumped`); }
  console.log(bad ? `\n${bad} asset(s) changed without a version bump` : "\nversions are honest");
}
process.exitCode = bad ? 1 : 0;

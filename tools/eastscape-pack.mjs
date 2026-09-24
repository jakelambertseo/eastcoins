/* EastScape: pack the pictures into sheets —  node tools/eastscape-pack.mjs [--check]

   WHY (2026-09-20). A first visit fetched 208 pictures of about 1 KB each. The bytes were never the cost (274 KB); the NUMBER
   was: every request has its own overhead, and on a slow connection two hundred of them is most of the wait. Packed, the
   same pictures are a handful of files.

   WHAT IT MAKES, in v3/assets/img/glad/packs/:
     core.png            everything the page loads at login (ART_FILES less the per-area lists), casino floor included
     area-<name>.png     one per AREA_ART list, whole (less only what core or a person's sheet holds), so an area is one request
     f-<base>.png        the eight facings of one person: look1..6, hero_<tier>, and the make-your-own parts pb_* / ph_*
     packs.json          { pack: { file, v, keys: { picture: [x, y, w, h] } } }; `v` is a hash of that sheet's pixels and
                         becomes its ?v=, so a sheet that didn't change keeps its URL (and its year in everyone's cache)
   and it rewrites `const PACKS_V = N;` in eastscape.html when packs.json changed, which is that file's ?v=.

   THE PAGE (eastscape.html, loadArt) cuts each picture out of its sheet into its own little canvas, so nothing downstream
   knows the difference: same keys, same sizes (frames are NOT trimmed: some drawing code scales by the picture's size).
   A picture that is in no pack, or whose sheet fails to load, is fetched on its own as before. So forgetting to repack
   never breaks anything; it only costs a request, and `--check` (run by the size budget) fails the deploy until you do.

   A PICTURE CHANGED? Replace the PNG, run this. No ART_VER bump is needed for packed art (the sheet's hash moves). */
import fs from "fs"; import path from "path"; import crypto from "crypto"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const FLAT = path.join(ROOT, "v3/assets/img/glad/flat"), OUT = path.join(ROOT, "v3/assets/img/glad/packs"), PAGE = path.join(ROOT, "eastscape.html");
const DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"], SHEET_W = 1024;

/* EXPORTED (2026-09-23) because eastscape-budget.mjs kept its own copy of this, and when the island lists
   learned about ISLE_ART and CROP_ART only one of the two copies was taught — so the packer succeeded and the
   budget check, which the content check shells out to, died with "ISLE_ART is not defined". One reader of the
   page's art lists, not two. */
export function lists() {
  const html = fs.readFileSync(PAGE, "utf8");
  const grab = (name) => { const i = html.indexOf(`const ${name} = `); if (i < 0) throw new Error(`${name} not found`); let depth = 0; const j = html.indexOf("=", i) + 1; for (let k = j; k < html.length; k++) { const c = html[k]; if (c === "[" || c === "{") depth++; if (c === "]" || c === "}") { depth--; if (!depth) return html.slice(j, k + 1); } } };
  const CROP_ART = fs.readdirSync(FLAT).map((f) => f.match(/^(crop_.*)\.png$/)?.[1]).filter(Boolean).sort();
  const ART_FILES = new Function("CROP_ART", `return ${grab("ART_FILES")}`)(CROP_ART), WILD_ART = new Function(`return ${grab("WILD_ART")}`)(), CASINO_ART = new Function(`return ${grab("CASINO_ART")}`)();
  /* (2026-09-23) ISLE_ART and CROP_ART joined WILD_ART and CASINO_ART as names AREA_ART is built from. grab()
     reads the text between one bracket and its match, so it can only eval a literal — which ISLE_ART is. The
     crop list is a computed expression in the page (one entry per crop in the rules, four stages each), so it
     is derived HERE from what is actually on disk instead. The two agree as long as every crop has its art,
     and the content check is what fails when one does not. */
  const ISLE_ART = new Function(`return ${grab("ISLE_ART")}`)();
  const AREA_ART = new Function("WILD_ART", "CASINO_ART", "ISLE_ART", "CROP_ART", `return ${grab("AREA_ART")}`)(WILD_ART, CASINO_ART, ISLE_ART, CROP_ART);
  return { ART_FILES, AREA_ART };
}
export function plan() {
  const { ART_FILES, AREA_ART } = lists(), has = (k) => fs.existsSync(path.join(FLAT, `${k}.png`)), lazy = new Set(Object.values(AREA_ART).flat()), taken = new Set(), packs = [];
  const add = (name, keys) => { const ks = [...new Set(keys)].filter((k) => has(k) && !taken.has(k)); ks.forEach((k) => taken.add(k)); if (ks.length) packs.push([name, ks]); };
  /* people first, so a facing never lands in core by accident: every base that has all eight facings on disk */
  const bases = new Set(fs.readdirSync(FLAT).map((f) => f.match(/^(.*)_south-west\.png$/)?.[1]).filter(Boolean));
  const person = [...bases].filter((b) => /^(look\d+|hero_[a-z]+|pb_[a-z]+|ph_[a-z]+)$/.test(b) && DIRS.every((d) => has(`${b}_${d}`)));
  for (const b of person) add(`f-${b}`, DIRS.map((d) => `${b}_${d}`));
  add("core", ART_FILES.filter((k) => !lazy.has(k)));
  /* an area's sheet is WHOLE: everything on its list that isn't already in core or a person's sheet, even if another area has
     it too. Walking into the Mire must cost one request, not "the Mire's sheet plus the closed Wilderness's because a moth
     lives in both". The few duplicated monsters cost a few KB of disk and nothing to a player who never visits both. */
  const shared = new Set(taken); for (const [area, list] of Object.entries(AREA_ART)) { const ks = [...new Set(list)].filter((k) => has(k) && !shared.has(k)); if (ks.length) packs.push([`area-${area}`, ks]); }
  return packs;
}
async function build(sharp, keys) {
  const items = []; for (const k of keys) { const f = path.join(FLAT, `${k}.png`), m = await sharp(f).metadata(); items.push({ k, f, w: m.width, h: m.height }); }
  items.sort((a, b) => b.h - a.h || b.w - a.w || a.k.localeCompare(b.k));
  let x = 0, y = 0, row = 0, W = 0; const at = {};
  for (const it of items) { if (x + it.w > SHEET_W) { x = 0; y += row + 1; row = 0; } at[it.k] = [x, y, it.w, it.h]; it.x = x; it.y = y; x += it.w + 1; row = Math.max(row, it.h); W = Math.max(W, x); }
  const H = y + row, png = await sharp({ create: { width: Math.max(1, W), height: Math.max(1, H), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(items.map((it) => ({ input: it.f, left: it.x, top: it.y }))).png({ compressionLevel: 9 }).toBuffer();
  const raw = await sharp(png).raw().toBuffer(), v = crypto.createHash("sha1").update(raw).update(JSON.stringify(at)).digest("hex").slice(0, 10);
  return { png, keys: at, v };
}
export async function run({ check = false } = {}) {
  const sharp = createRequire(path.join(ROOT, "package.json"))("sharp"), manifest = {}, files = {};
  for (const [name, keys] of plan()) { const b = await build(sharp, keys); manifest[name] = { file: `${name}.png`, v: b.v, keys: b.keys }; files[name] = b.png; }
  const json = JSON.stringify(manifest), old = fs.existsSync(path.join(OUT, "packs.json")) ? fs.readFileSync(path.join(OUT, "packs.json"), "utf8") : "";
  if (check) return { fresh: json === old, packs: Object.keys(manifest).length, pictures: Object.values(manifest).reduce((a, p) => a + Object.keys(p.keys).length, 0), bytes: Object.values(files).reduce((a, b) => a + b.length, 0), core: files.core?.length || 0, manifestBytes: json.length };
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png") && !manifest[f.replace(/\.png$/, "")]) fs.rmSync(path.join(OUT, f));
  for (const [name, png] of Object.entries(files)) fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  if (json !== old) { fs.writeFileSync(path.join(OUT, "packs.json"), json); const html = fs.readFileSync(PAGE, "utf8"), m = html.match(/const PACKS_V = (\d+);/); if (!m) throw new Error("const PACKS_V = N; not found in eastscape.html"); fs.writeFileSync(PAGE, html.replace(m[0], `const PACKS_V = ${Number(m[1]) + 1};`)); console.log(`packs.json changed: PACKS_V ${m[1]} -> ${Number(m[1]) + 1}`); }
  for (const [name, p] of Object.entries(manifest)) console.log(`  ${name.padEnd(22)} ${String(Object.keys(p.keys).length).padStart(4)} pictures ${String(Math.round(files[name].length / 102.4) / 10).padStart(7)} KB  v=${p.v}`);
  console.log(`${Object.keys(manifest).length} sheets, ${Object.values(manifest).reduce((a, p) => a + Object.keys(p.keys).length, 0)} pictures, ${Math.round(Object.values(files).reduce((a, b) => a + b.length, 0) / 1024)} KB; packs.json ${Math.round(json.length / 102.4) / 10} KB`);
  return { fresh: true };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  const r = await run({ check: process.argv.includes("--check") }); if (process.argv.includes("--check")) { console.log(r.fresh ? `packs are fresh: ${r.packs} sheets, ${r.pictures} pictures` : "PACKS ARE STALE: run  node tools/eastscape-pack.mjs"); process.exit(r.fresh ? 0 : 1); }
}

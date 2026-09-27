/* EastScape: a small Tiled (.tmx) reader and renderer, for the bought packs' own sample scenes.
   (2026-09-27) The owner asked for the Depths to look like the pack's mockup, "design it like the reference image". The pack ships
   that mockup as a Tiled map, so rather than approximating it this reads the real thing: tile layers (CSV), tilesets (one image
   sheet, or one image per tile), tile objects (props placed by pixel), and the flip flags.
     node tools/eastscape-tmx.mjs <map.tmx> <out.png>          renders the whole map, every layer, to a PNG
   and, as a module, loadTmx(file) returns { W, H, tw, th, layers: [{ name, type, data | objects }], gidImage(gid) }. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const FH = 0x80000000, FV = 0x40000000, FD = 0x20000000;
const attrs = (s) => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));

export function loadTmx(file) {
  const dir = path.dirname(file), xml = fs.readFileSync(file, "utf8"), map = attrs(xml.match(/<map [^>]*>/)[0]);
  const tilesets = [...xml.matchAll(/<tileset [^>]*\/>/g)].map((m) => {
    const a = attrs(m[0]), tf = path.join(dir, a.source), tx = fs.readFileSync(tf, "utf8"), ta = attrs(tx.match(/<tileset [^>]*>/)[0]);
    const img = tx.match(/<tileset[^>]*>\s*(?:<grid[^>]*\/>\s*)?<image ([^>]*)\/>/);
    const ts = { first: +a.firstgid, name: ta.name, tw: +ta.tilewidth, th: +ta.tileheight, cols: +ta.columns, count: +ta.tilecount };
    if (img && +ta.columns > 0) ts.image = path.join(path.dirname(tf), attrs(img[1]).source);
    else { ts.tiles = {}; for (const t of tx.matchAll(/<tile id="(\d+)"[^>]*>\s*<image ([^>]*)\/>/g)) ts.tiles[+t[1]] = { file: path.join(path.dirname(tf), attrs(t[2]).source), ...attrs(t[2]) }; }
    return ts;
  }).sort((x, y) => x.first - y.first);
  const tsOf = (gid) => { let r = null; for (const t of tilesets) if (gid >= t.first) r = t; return r; };
  const layers = [];
  for (const m of xml.matchAll(/<(layer|objectgroup) ([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const a = attrs(m[2]);
    if (a.visible === "0") continue;
    if (m[1] === "layer") { const csv = m[3].match(/<data encoding="csv">([\s\S]*?)<\/data>/); if (!csv) continue; layers.push({ name: a.name, type: "tiles", data: csv[1].trim().split(/[\s,]+/).map(Number), opacity: a.opacity ? +a.opacity : 1 }); }
    else layers.push({ name: a.name, type: "objects", opacity: a.opacity ? +a.opacity : 1, objects: [...m[3].matchAll(/<object ([^>]*?)\/?>/g)].map((o) => attrs(o[1])).filter((o) => o.gid).map((o) => ({ gid: +o.gid, x: +o.x, y: +o.y, w: +o.width, h: +o.height, name: o.name || "" })) });
  }
  return { W: +map.width, H: +map.height, tw: +map.tilewidth, th: +map.tileheight, tilesets, layers, tsOf };
}

/** a Buffer (PNG) for one gid, flips applied, sized as the tile (sheets) or its own image (collections) */
export async function gidPng(T, gid, cache = new Map()) {
  const raw = gid & ~(FH | FV | FD), key = gid; if (cache.has(key)) return cache.get(key);
  const ts = T.tsOf(raw); if (!ts) return null;
  const id = raw - ts.first; let im;
  if (ts.image) im = sharp(ts.image).extract({ left: (id % ts.cols) * ts.tw, top: Math.floor(id / ts.cols) * ts.th, width: ts.tw, height: ts.th });
  else { const t = ts.tiles[id]; if (!t) return null; im = sharp(t.file); }
  let b = await im.png().toBuffer();
  if (gid & FD) b = await sharp(b).rotate(90).flop().png().toBuffer();
  if (gid & FH) b = await sharp(b).flop().png().toBuffer();
  if (gid & FV) b = await sharp(b).flip().png().toBuffer();
  cache.set(key, b); return b;
}

/** render the map (or only the layers `keep` accepts) to a PNG */
export async function renderTmx(T, out, keep = () => true) {
  const cache = new Map(), comps = [];
  for (const L of T.layers) {
    if (!keep(L)) continue;
    if (L.type === "tiles") for (let i = 0; i < L.data.length; i++) { const gid = L.data[i]; if (!gid) continue; const b = await gidPng(T, gid, cache); if (!b) continue; const m = await sharp(b).metadata(); comps.push({ input: b, left: (i % T.W) * T.tw, top: Math.floor(i / T.W) * T.th + T.th - m.height }); }
    else for (const o of L.objects) { const b0 = await gidPng(T, o.gid, cache); if (!b0) continue; const b = o.w && o.h ? await sharp(b0).resize(Math.round(o.w), Math.round(o.h), { kernel: "nearest" }).png().toBuffer() : b0; const m = await sharp(b).metadata(); comps.push({ input: b, left: Math.round(o.x), top: Math.round(o.y - m.height) }); }
  }
  const W = T.W * T.tw, H = T.H * T.th, ok = comps.filter((c) => c.left < W && c.top < H && c.left > -2000 && c.top > -2000);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 13, g: 24, b: 22, alpha: 1 } } }).composite(ok).png().toFile(out);
  return { W, H, pieces: ok.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  const [file, out] = process.argv.slice(2); const T = loadTmx(file);
  console.log(`${path.basename(file)}: ${T.W}x${T.H}, layers: ${T.layers.map((l) => `${l.name}(${l.type})`).join(", ")}`);
  console.log(await renderTmx(T, out));
}

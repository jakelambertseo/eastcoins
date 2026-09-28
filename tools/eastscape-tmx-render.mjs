/* RENDER A TILED MAP —  node tools/eastscape-tmx-render.mjs <map.tmx> <out.png> [scale=1] [frame=0]
   (2026-09-27, for the Foundry rebuild: the Volcano pack ships a 90x60 "sample map.tmx" and a 70x70 "testing map.tmx", and the owner wants
   the Foundry built from what they show.) Draws every visible tile layer in order and the props object layer, at one frame of every
   animation (`frame`, counted in each tile's own <animation> list), honouring Tiled's flip bits. A tileset whose `source` points at another
   machine (one of the sample map's does) is found by its file name beside the map's own Tilesets. Pixels are copied by hand into one RGBA
   buffer (compositing tens of thousands of tiles through sharp one at a time takes minutes). Output is a PNG; nothing is written anywhere
   else. The packs are paid and stay local (lt-wild/), and so does anything this draws from them. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const sharp = createRequire(import.meta.url)("sharp");
const ARGS = process.argv.slice(2), FLAGS = Object.fromEntries(ARGS.filter((a) => a.startsWith("--")).map((a) => { const [k, v = "1"] = a.slice(2).split("="); return [k, v]; }));
const [MAP, OUT, SCALE = "1", FRAME = "0"] = ARGS.filter((a) => !a.startsWith("--"));
/* --region=x,y,w,h   draw only these tiles (the output is that size)
   --skip=x0,y0,x1,y1 leave out every prop object whose foot falls in these tiles (repeatable: --skip=..;x0,y0,x1,y1)
   --layers=a,b       draw only the named tile layers (and props unless --noprops)
   --noprops          no prop objects at all */
const REGION = FLAGS.region ? FLAGS.region.split(",").map(Number) : null, SKIPS = (FLAGS.skip || "").split(";").filter(Boolean).map((r) => r.split(",").map(Number));
const ONLY = FLAGS.layers ? new Set(FLAGS.layers.split(",")) : null;
/* --skiptiles=x0,y0,x1,y1[;...]  leave out tiles drawn from the props atlas (Atlas-props-tiles) in these tiles: a prop painted into a TILE layer,
   like the sample map's skull crusher, which is not an object and so --skip cannot reach */
const SKIPT = (FLAGS.skiptiles || "").split(";").filter(Boolean).map((r) => r.split(",").map(Number));
if (!MAP || !OUT) { console.log("usage: node tools/eastscape-tmx-render.mjs <map.tmx> <out.png> [scale] [frame]"); process.exit(1); }
const dir = path.dirname(MAP), xml = fs.readFileSync(MAP, "utf8"), attr = (s, k) => (s.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
const head = xml.match(/<map [^>]*>/)[0], W = +attr(head, "width"), H = +attr(head, "height"), TW = +attr(head, "tilewidth"), TH = +attr(head, "tileheight");
const FLIP_H = 0x80000000, FLIP_V = 0x40000000, FLIP_D = 0x20000000, MASK = ~(FLIP_H | FLIP_V | FLIP_D) >>> 0;
const OX = REGION ? REGION[0] * TW : 0, OY = REGION ? REGION[1] * TH : 0, CW = REGION ? REGION[2] * TW : W * TW, CH = REGION ? REGION[3] * TH : H * TH, canvas = Buffer.alloc(CW * CH * 4);
for (let i = 0; i < CW * CH; i++) { canvas[i * 4] = 20; canvas[i * 4 + 1] = 14; canvas[i * 4 + 2] = 16; canvas[i * 4 + 3] = 255; }

const raws = new Map();
async function raw(file) { if (!raws.has(file)) { try { const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); raws.set(file, { data, w: info.width, h: info.height }); } catch (e) { raws.set(file, null); } } return raws.get(file); }

/* the tilesets: one image cut into a grid, or a collection of single images */
const sets = [];
for (const m of xml.matchAll(/<tileset firstgid="(\d+)" source="([^"]+)"\s*\/>/g)) {
  let src = path.join(dir, m[2]); if (!fs.existsSync(src)) src = path.join(dir, "Tilesets", path.basename(m[2]));
  const t = fs.readFileSync(src, "utf8"), tdir = path.dirname(src), th = t.match(/<tileset [^>]*>/)[0];
  const set = { src, first: +m[1], tw: +attr(th, "tilewidth"), tth: +attr(th, "tileheight"), columns: +attr(th, "columns"), anim: {}, images: {} };
  const img = t.split("<tile ")[0].match(/<image ([^>]*)\/>/);   /* the sheet image: the first <image> before any single-tile one */
  if (set.columns > 0 && img) set.image = path.join(tdir, attr(img[1], "source"));
  for (const tm of t.matchAll(/<tile id="(\d+)"[^>]*>([\s\S]*?)<\/tile>/g)) {
    const id = +tm[1], im = tm[2].match(/<image ([^>]*)\/>/), an = tm[2].match(/<animation>([\s\S]*?)<\/animation>/);
    if (im) set.images[id] = path.join(tdir, attr(im[1], "source"));
    if (an) set.anim[id] = [...an[1].matchAll(/tileid="(\d+)"/g)].map((x) => +x[1]);
  }
  sets.push(set);
}
sets.sort((a, b) => a.first - b.first);
const setOf = (gid) => { let s = null; for (const x of sets) if (gid >= x.first) s = x; return s; };

/** copy one tile (or a single-image tile) to the canvas with its bottom-left at (x, yBottom), alpha over, flips honoured */
async function draw(gid, x, yBottom, ow, oh) {
  const flags = gid & ~MASK, id0 = (gid & MASK) >>> 0, s = setOf(id0); if (!s) return 0;
  let local = id0 - s.first; const an = s.anim[local]; if (an) local = an[Number(FRAME) % an.length];
  let src, sx = 0, sy = 0, sw, sh;
  if (s.image) { src = await raw(s.image); if (!src) return 0; sw = s.tw; sh = s.tth; sx = (local % s.columns) * sw; sy = Math.floor(local / s.columns) * sh; }
  else if (s.images[local]) { src = await raw(s.images[local]); if (!src) return 0; sw = src.w; sh = src.h; }
  else return 0;
  x -= OX; yBottom -= OY;
  const dw = ow || sw, dh = oh || sh, top = yBottom - dh, fh = !!(flags & FLIP_H), fv = !!(flags & FLIP_V), fd = !!(flags & FLIP_D);
  for (let j = 0; j < dh; j++) {
    const cy = top + j; if (cy < 0 || cy >= CH) continue;
    for (let i = 0; i < dw; i++) {
      const cx = x + i; if (cx < 0 || cx >= CW) continue;
      let u = Math.floor(i * sw / dw), v = Math.floor(j * sh / dh);
      if (fd) [u, v] = [v, u];
      if (fh) u = sw - 1 - u; if (fv) v = sh - 1 - v;
      const si = ((sy + v) * src.w + sx + u) * 4, a = src.data[si + 3]; if (!a) continue;
      const di = (cy * CW + cx) * 4, k = a / 255;
      canvas[di] = src.data[si] * k + canvas[di] * (1 - k); canvas[di + 1] = src.data[si + 1] * k + canvas[di + 1] * (1 - k); canvas[di + 2] = src.data[si + 2] * k + canvas[di + 2] * (1 - k);
    }
  }
  return 1;
}

let n = 0;
for (const m of xml.matchAll(/<layer ([^>]*)>\s*<data encoding="csv">([\s\S]*?)<\/data>|<objectgroup ([^>]*)>([\s\S]*?)<\/objectgroup>/g)) {
  if (m[1] != null) {
    if (attr(m[1], "visible") === "0" || (ONLY && !ONLY.has(attr(m[1], "name")))) continue;
    const ids = m[2].trim().split(/[\s,]+/).map((v) => Number(v) >>> 0);
    for (let i = 0; i < ids.length; i++) if (ids[i]) {
      const tx = i % W, ty = Math.floor(i / W), st = setOf((ids[i] & MASK) >>> 0);
      if (SKIPT.length && st && /Atlas-props-tiles/.test(st.src || "") && SKIPT.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1)) continue;
      n += await draw(ids[i], tx * TW, ty * TH + TH);
    }
  } else {
    if (attr(m[3], "visible") === "0" || FLAGS.noprops) continue;
    for (const o of m[4].matchAll(/<object ([^>]*?)\/?>/g)) {
      const gid = Number(attr(o[1], "gid")) >>> 0; if (!gid) continue;
      const fx = Math.floor(+attr(o[1], "x") / TW), fy = Math.floor((+attr(o[1], "y") - 1) / TH);
      if (SKIPS.some(([x0, y0, x1, y1]) => fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1)) continue;
      n += await draw(gid, Math.round(+attr(o[1], "x")), Math.round(+attr(o[1], "y")), Math.round(+attr(o[1], "width")) || 0, Math.round(+attr(o[1], "height")) || 0);
    }
  }
}
let buf = await sharp(canvas, { raw: { width: CW, height: CH, channels: 4 } }).png().toBuffer();
if (Number(SCALE) !== 1) buf = await sharp(buf).resize(Math.round(CW * Number(SCALE)), null, { kernel: "nearest" }).png().toBuffer();
fs.writeFileSync(OUT, buf);
console.log(`${path.basename(MAP)}${REGION ? ` [${REGION}]` : ""}: ${W}x${H} tiles (${CW}x${CH}px), ${n} pieces drawn -> ${OUT}`);

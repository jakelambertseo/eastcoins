/* THE DEEP-ZOOM WORLD MAP, a mock (2026-10-02) —  node tools/zoommap-mock/build.mjs
   The owner: "is it possible to make version of our world map like the way openseadragons does?", then "build a mockup of option A".
   Option A is a world PRE-RENDERED once and cut into a Deep Zoom pyramid, which OpenSeadragon shows a few tiles at a time.
     1. bg/<scene>.png      each open map's GROUND, painted in the browser by the game's own painter (window.__es.bgOf, dev only),
                            plus bg/layout.json, the world map's own layout (window.__es.worldCells). Saved by a little local receiver.
     2. this script         puts every map's props and monsters on its ground the way the page anchors a sprite (bottom-centre on its
                            tile, depth-sorted, native pixels: the ground is painted at 2 px a world unit, the sprites are drawn at
                            2 px a unit too), lays the maps out on the layout's grid with a dark gutter, and lets sharp cut the pyramid.
     3. index.html          OpenSeadragon over world.dzi, with the world map's pins as overlays.
   Only maps OPEN LIVE are painted (the page was loaded without ?open=1), so nothing held can leak into a tile. */
import fs from "node:fs";
import sharp from "sharp";
const G = await import("../../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const HERE = "tools/zoommap-mock/", ART = "v3/assets/img/glad/flat/", T = 16, A = 2, MW = G.COLS * T * A, MH = G.ROWS * T * A, GUT = 96;
const L = JSON.parse(fs.readFileSync(HERE + "bg/layout.json", "utf8"));
const minX = Math.min(...L.cells.map((c) => c.x)), minY = Math.min(...L.cells.map((c) => c.y));
const cols = Math.max(...L.cells.map((c) => c.x)) - minX + 1, rows = Math.max(...L.cells.map((c) => c.y)) - minY + 1;
const WW = cols * MW + (cols + 1) * GUT, WH = rows * MH + (rows + 1) * GUT;
const art = new Map();
const load = async (k) => { if (art.has(k)) return art.get(k); let v = null; try { const im = sharp(`${ART}${k}.png`).ensureAlpha(); const m = await im.metadata(); v = { buf: await im.png().toBuffer(), w: m.width, h: m.height }; } catch { } art.set(k, v); return v; };
const SCRUB = { bush: "g_bush", boulder: "g_boulder" };
const keyOf = (ob) => ob.art || SCRUB[ob.t] || (ob.t === "rock" || ob.t === "vein" ? `o_${ob.t}_${ob.ore}` : ob.t === "spot" ? `o_spot${ob.look}` : `o_${ob.t}`);
const placed = [];
let missing = 0;
for (const c of L.cells) {
  const px = GUT + (c.x - minX) * (MW + GUT), py = GUT + (c.y - minY) * (MH + GUT);
  const comp = [], sprites = [];
  let b; try { b = G.buildScene(c.k); } catch (e) { console.log(`  !! ${c.k}: ${e.message}`); continue; }
  const add = async (k, x, y, w = 1, h = 1) => {
    const a = await load(k); if (!a) { missing++; return; }
    const cx = (x + w / 2) * T * A, foot = (y + h) * T * A, left = Math.round(cx - a.w / 2), top = Math.round(foot - a.h);
    if (left < -a.w || top < -a.h || left > MW || top > MH) return;
    sprites.push({ y: foot, input: a.buf, left, top });
  };
  for (const ob of b.objs) if (!ob.flat) await add(keyOf(ob), ob.x, ob.y, ob.w || 1, ob.h || 1);
  for (const [t, x, y] of G.SCENES[c.k].mobs || []) await add(G.MOBS[t]?.art || t, x, y);
  sprites.sort((p, q) => p.y - q.y);
  /* a sprite that hangs over the map's edge is cut to the map, the way the game's own camera never shows past it */
  const ground = sharp(`${HERE}bg/${c.k}.png`);
  const one = await ground.composite(await Promise.all(sprites.map(async (s) => {
    const l = Math.max(0, s.left), t = Math.max(0, s.top), m = await sharp(s.input).metadata();
    const ex = { left: l - s.left, top: t - s.top, width: Math.min(m.width - (l - s.left), MW - l), height: Math.min(m.height - (t - s.top), MH - t) };
    if (ex.width <= 0 || ex.height <= 0) return null;
    return { input: await sharp(s.input).extract(ex).toBuffer(), left: l, top: t };
  })).then((list) => list.filter(Boolean))).png().toBuffer();
  comp.push({ input: one, left: px, top: py });
  placed.push({ k: c.k, name: c.name, x: px, y: py, w: MW, h: MH, comp });
  process.stdout.write(`  ${c.k} (${sprites.length} sprites)\n`);
}
const world = await sharp({ create: { width: WW, height: WH, channels: 4, background: "#0d0f14" } }).composite(placed.flatMap((p) => p.comp)).png().toBuffer();
fs.rmSync(HERE + "world_files", { recursive: true, force: true });
await sharp(world, { limitInputPixels: false }).png().tile({ size: 256, overlap: 1, layout: "dz" }).toFile(HERE + "world");   /* PNG tiles: pixel art must stay crisp, never JPEG */
await sharp(world, { limitInputPixels: false }).resize(Math.round(WW / 8)).png().toFile(HERE + "world-small.png");
/* the pins: where every map sits in the world image, for the page's overlays */
fs.writeFileSync(HERE + "world.json", JSON.stringify({ w: WW, h: WH, mw: MW, mh: MH, maps: placed.map(({ k, name, x, y, w, h }) => ({ k, name, x, y, w, h })), links: L.links }, null, 1));
let n = 0, bytes = 0; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.isDirectory()) walk(`${d}/${f.name}`); else { n++; bytes += fs.statSync(`${d}/${f.name}`).size; } } }; walk(HERE + "world_files");
console.log(`world ${WW}x${WH} px, ${placed.length} maps, ${n} tiles, ${(bytes / 1048576).toFixed(1)} MB${missing ? `; ${missing} sprites had no picture` : ""}`);

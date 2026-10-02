/* A still of any OUTDOOR scene, for checking a layout without a browser. Ground colours stand in for the Wang
   tilesets; everything with a picture is drawn the way the page anchors a sprite (half its pixel size, bottom-centre
   on its tile, depth-sorted), and monsters are drawn where the scene puts them.
   node scratchpad/scene-still.mjs <sceneKey> [out.png] */
import sharp from "sharp";
globalThis.__ES_OPEN_ALL = true;
const G = await import("file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js");
const KEY = process.argv[2] || "trailer", OUT = process.argv[3] || `scratchpad/${KEY}-still.png`;
const DIR = "v3/assets/img/glad/flat/", T = 16, A = 2, SC = 4;
const b = G.buildScene(KEY), g = b.g, W = G.COLS * T * SC, H = G.ROWS * T * SC;
const load = async (k) => { try { const im = sharp(DIR + k + ".png").ensureAlpha(); const m = await im.metadata(); return { buf: await im.toBuffer(), w: m.width, h: m.height }; } catch { return null; } };
const GROUND = { "~": "#2c3a28", ",": "#7a6a4a", "#": "#5a7a3e", ".": "#5a7a3e", b: "#6a7a52", s: "#c8b48a", e: "#3f7fc2", p: "#bdb29c", P: "#bdb29c" };
const comp = [];
for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++)
  comp.push({ input: { create: { width: T * SC, height: T * SC, channels: 4, background: GROUND[g[y][x]] || "#5a7a3e" } }, left: x * T * SC, top: y * T * SC });
const sprites = [];
const add = async (key, x, y, w = 1, h = 1) => {
  const a = await load(key); if (!a) return false;
  const dw = Math.round(a.w / A), dh = Math.round(a.h / A);
  const cx = (x + w / 2) * T, foot = (y + h) * T;
  sprites.push({ y: foot, input: await sharp(a.buf).resize(dw * SC, dh * SC, { kernel: "nearest" }).toBuffer(), left: Math.round((cx - dw / 2) * SC), top: Math.round((foot - dh) * SC) });
  return true;
};
const missing = new Set();
for (const ob of b.objs) {
  /* THE PAINTER'S OWN NAMING, not a guess at it. Scrub is g_bush and g_boulder (the themed maps use w_ and the
     ground theme's own keys), which is why this tool kept reporting "NO ART FOR: bush, boulder" for art that has
     existed all along — a check that cries wolf is worse than no check. */
  const SCRUB = { bush: "g_bush", boulder: "g_boulder" };
  const key = ob.art || SCRUB[ob.t] || (ob.t === "rock" || ob.t === "vein" ? `o_${ob.t}_${ob.ore}` : ob.t === "spot" ? `o_spot${ob.look}` : `o_${ob.t}`);
  if (!(await add(key, ob.x, ob.y, ob.w || 1, ob.h || 1))) missing.add(`${ob.t}(${key})`);
}
for (const [t, x, y] of G.SCENES[KEY].mobs || []) if (!(await add(t, x, y))) missing.add(`mob ${t}`);
sprites.sort((p, q) => p.y - q.y);
for (const s of sprites) if (s.left > -400 && s.top > -400 && s.left < W && s.top < H) comp.push({ input: s.input, left: s.left, top: s.top });
await sharp({ create: { width: W, height: H, channels: 4, background: "#20232a" } }).composite(comp).png().toFile(OUT);
console.log(`${KEY}: ${b.objs.length} objects, ${(G.SCENES[KEY].mobs || []).length} monsters -> ${OUT}`);
if (missing.size) console.log(`NO ART FOR: ${[...missing].join(", ")}`);

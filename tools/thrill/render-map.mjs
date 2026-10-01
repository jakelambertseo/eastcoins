/* A whole-map picture of Thrill Hill and Daredevil Peak, for looking at the layout (and for the game plan page) —  node tools/thrill/render-map.mjs
   Not the game's renderer: flat grass, the cobble road and water as plain colours, every object's real picture from flat/ stood on its
   footprint (bottom-centred, like the game), monsters on their tiles, and each stunt numbered in its course's colour. */
import fs from "fs"; import { createRequire } from "module"; const sharp = createRequire("C:/Users/jake/code/eastcoins/package.json")("sharp");
globalThis.__ES_OPEN_ALL = true;
const G = await import("../../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const FLAT = "C:/Users/jake/code/eastcoins/v3/assets/img/glad/flat/", T = 32, OUT = "C:/Users/jake/code/eastcoins/tools/thrill/";
const COL = { rookie: "#7ed060", pro: "#e8a03a", champ: "#ff6a8a", gate: "#b08aff" };
for (const key of ["thrill", "thrill_top"]) {
  const def = G.SCENES[key], b = G.buildScene(key), W = 44 * T, H = 26 * T;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`];
  for (let y = 0; y < 26; y++) for (let x = 0; x < 44; x++) {
    const c = def.rows[y][x], fill = c === "," ? "#8a8070" : c === "~" ? "#3a9a5a" : c === "e" ? "#5a8ad8" : (x + y) % 2 ? "#a8744a" : "#a2704a";
    svg.push(`<rect x="${x * T}" y="${y * T}" width="${T}" height="${T}" fill="${fill}"/>`);
  }
  svg.push("</svg>");
  const comps = [];
  const draw = async (art, x, y, w = 1, h = 1, flat = false) => {
    const f = FLAT + art + ".png"; if (!fs.existsSync(f)) return;
    const m = await sharp(f).metadata(), left = Math.round(x * T + (w * T - m.width) / 2), top = flat ? Math.round(y * T + (h * T - m.height) / 2) : (y + h) * T - m.height;
    comps.push({ input: f, left: Math.max(0, left), top: Math.max(0, top) });
  };
  const objs = [...b.objs].sort((a, c) => (a.flat ? -1 : 0) - (c.flat ? -1 : 0) || (a.y + (a.h || 1)) - (c.y + (c.h || 1)));
  const things = [...objs.map((o) => ({ o, z: o.flat ? -1 : o.y + (o.h || 1) })), ...def.mobs.map(([t, x, y]) => ({ m: { t, x, y }, z: y + 1 })), ...def.npcs.map((n) => ({ n, z: n.y + 1 }))].sort((a, c) => a.z - c.z);
  for (const it of things) {
    if (it.o) { const o = it.o, art = o.art || (o.t === "sign" ? "o_sign" : o.t === "rock" ? `o_rock_${o.ore}` : `o_${o.t}`); await draw(art, o.x, o.y, o.w || 1, o.h || 1, !!o.flat); }
    else if (it.m) await draw(it.m.t, it.m.x, it.m.y);
    else await draw("vance_south", it.n.x, it.n.y);
  }
  const labels = b.objs.filter((o) => o.t === "stunt").map((o) => { const c = o.crs ? COL[o.crs] : COL.gate, cx = o.x * T + ((o.w || 1) * T) / 2, cy = o.y * T + ((o.h || 1) * T) / 2;
    return `<circle cx="${cx}" cy="${cy}" r="13" fill="${c}" stroke="#000" stroke-width="2"/><text x="${cx}" y="${cy + 5}" font-family="Arial" font-weight="bold" font-size="14" text-anchor="middle">${o.crs ? o.i + 1 : o.to ? "▲" : o.gate}</text>`; });
  const over = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels.join("")}</svg>`);
  await sharp(Buffer.from(svg.join(""))).composite([...comps, { input: over, left: 0, top: 0 }]).png().toFile(OUT + `${key}-map.png`);
  console.log(`${key}-map.png`);
}

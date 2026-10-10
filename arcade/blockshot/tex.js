/* Blockshot's textures: all drawn in code, no files (2026-10-08, the owner: "free textures"). An arena-shooter map is flat colour with a little
   grain, so that is what these are: concrete, brick, metal panels, grass, crate wood, a hazard stripe, and the skin patterns for beans
   and guns. Every texture tiles; the map's UVs are scaled to world units (tex.js is used by maps.js's builder), so a long wall gets a
   long brick run instead of one stretched brick. */
import * as THREE from "three";

const cache = new Map();
function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const shade = (n, k) => { const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const grain = (g, w, h, n, dark, light, size = 2) => { for (let k = 0; k < n; k++) { g.fillStyle = Math.random() < 0.5 ? dark : light; g.fillRect(Math.random() * w, Math.random() * h, size, size); } };

/** Flat colour with a fine grain: the map's default. One tile = 2 m. */
export const concrete = (col) => make(`concrete:${col}`, 256, 256, (g, w, h) => { g.fillStyle = hex(col); g.fillRect(0, 0, w, h); grain(g, w, h, 1400, shade(col, 0.9), shade(col, 1.08)); g.strokeStyle = shade(col, 0.8); g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); });
/** Running-bond brick in the colour, dark mortar. One tile = 2 m. */
export const brick = (col) => make(`brick:${col}`, 256, 256, (g, w, h) => {
  g.fillStyle = shade(col, 0.55); g.fillRect(0, 0, w, h); const bw = 64, bh = 32;
  for (let y = 0; y < h; y += bh) for (let x = -bw; x < w + bw; x += bw) { const off = (y / bh) % 2 ? bw / 2 : 0; g.fillStyle = shade(col, 0.92 + Math.random() * 0.16); g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4); }
  grain(g, w, h, 500, shade(col, 0.85), shade(col, 1.05), 1);
});
/** Riveted metal panels. One tile = 2 m. */
export const metal = (col) => make(`metal:${col}`, 256, 256, (g, w, h) => {
  g.fillStyle = hex(col); g.fillRect(0, 0, w, h); grain(g, w, h, 900, shade(col, 0.93), shade(col, 1.06), 1);
  g.strokeStyle = shade(col, 0.7); g.lineWidth = 3; g.strokeRect(2, 2, w / 2 - 4, h / 2 - 4); g.strokeRect(w / 2 + 2, 2, w / 2 - 4, h / 2 - 4); g.strokeRect(2, h / 2 + 2, w / 2 - 4, h / 2 - 4); g.strokeRect(w / 2 + 2, h / 2 + 2, w / 2 - 4, h / 2 - 4);
  g.fillStyle = shade(col, 0.6); for (const [x, y] of [[10, 10], [118, 10], [138, 10], [246, 10], [10, 118], [118, 118], [138, 118], [246, 118], [10, 138], [118, 138], [138, 138], [246, 138], [10, 246], [118, 246], [138, 246], [246, 246]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
});
/** Grass, for the ground. One tile = 2 m. */
export const grass = (col) => make(`grass:${col}`, 256, 256, (g, w, h) => { g.fillStyle = hex(col); g.fillRect(0, 0, w, h); for (let k = 0; k < 2600; k++) { g.fillStyle = shade(col, 0.82 + Math.random() * 0.36); g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } });
/** Crate wood: planks and a cross. One tile = one crate face. */
export const crate = (col) => make(`crate:${col}`, 256, 256, (g, w, h) => {
  g.fillStyle = hex(col); g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) { g.fillStyle = shade(col, 0.88 + Math.random() * 0.2); g.fillRect(0, y + 1, w, 30); }
  g.strokeStyle = shade(col, 0.55); g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.moveTo(w - 10, 10); g.lineTo(10, h - 10); g.stroke();
});
/** Yellow-black hazard stripe: jump pads and edges. */
export const hazard = () => make("hazard", 256, 256, (g, w, h) => { g.fillStyle = "#2a2a30"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffcc33"; for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 32 + 256, h); g.lineTo(i * 64 + 256, h); g.fill(); } });
/** The jump pad's face: a ring and an arrow. */
export const pad = () => make("pad", 256, 256, (g, w, h) => { g.fillStyle = "#1a2a3a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#4ad0ff"; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.stroke(); g.fillStyle = "#8ae0ff"; g.beginPath(); g.moveTo(128, 50); g.lineTo(190, 130); g.lineTo(150, 130); g.lineTo(150, 200); g.lineTo(106, 200); g.lineTo(106, 130); g.lineTo(66, 130); g.closePath(); g.fill(); });

/* ---- skin patterns (bean bodies and guns): a base colour with a pattern over it */
export const PATTERNS = {
  plain: (g, w, h, col) => { g.fillStyle = hex(col); g.fillRect(0, 0, w, h); },
  stripes: (g, w, h, col) => { g.fillStyle = hex(col); g.fillRect(0, 0, w, h); g.fillStyle = shade(col, 0.55); for (let y = 0; y < h; y += 48) g.fillRect(0, y, w, 20); },
  camo: (g, w, h, col) => { g.fillStyle = hex(col); g.fillRect(0, 0, w, h); for (let k = 0; k < 40; k++) { g.fillStyle = [shade(col, 0.6), shade(col, 1.3), "#2a2a22"][k % 3]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 12 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); } },
  carbon: (g, w, h, col) => { g.fillStyle = "#15151a"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16 + y / 16) % 2 ? "#232329" : "#1a1a20"; g.fillRect(x, y, 16, 16); } g.fillStyle = hex(col) + "55"; g.fillRect(0, 0, w, h); },
  hex: (g, w, h, col) => { g.fillStyle = shade(col, 0.6); g.fillRect(0, 0, w, h); g.fillStyle = hex(col); for (let y = 0; y < h + 20; y += 28) for (let x = 0; x < w + 20; x += 32) { const ox = (y / 28) % 2 ? 16 : 0; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(x + ox + Math.cos(a) * 14, y + Math.sin(a) * 14); } g.fill(); } },
  gold: (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#ffe27a"); gr.addColorStop(0.5, "#c89a1a"); gr.addColorStop(1, "#ffd84a"); g.fillStyle = gr; g.fillRect(0, 0, w, h); grain(g, w, h, 300, "#b8860b", "#fff0b0", 1); },
  galaxy: (g, w, h, col) => { g.fillStyle = "#0a0618"; g.fillRect(0, 0, w, h); for (let k = 0; k < 6; k++) { const gr = g.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 90); gr.addColorStop(0, hex(col) + "aa"); gr.addColorStop(1, "transparent"); g.fillStyle = gr; g.fillRect(0, 0, w, h); } for (let k = 0; k < 160; k++) { g.fillStyle = "#fff"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
};
export const skin = (pattern, col) => make(`skin:${pattern}:${col}`, 256, 256, (g, w, h) => (PATTERNS[pattern] || PATTERNS.plain)(g, w, h, col));

/** A material for a map box. */
const KINDS = { concrete, brick, metal, grass, crate, hazard: () => hazard(), pad: () => pad() };
const mats = new Map();
export function material(kind, col) {
  const key = `${kind}:${col}`; if (mats.has(key)) return mats.get(key);
  const t = KINDS[kind] ? KINDS[kind](col) : concrete(col);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: kind === "metal" ? 0.5 : 0.85, metalness: kind === "metal" ? 0.3 : 0 });
  mats.set(key, m); return m;
}

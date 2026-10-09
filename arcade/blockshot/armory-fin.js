/* The Armory's finishes, drawn in code (2026-10-10): one painter per finish id in the catalogue (/api/blockshot/armory), a canvas each,
   made on first use and shared. The catalogue (names, rarities, prices, odds) lives on the server; this file only knows how a finish
   looks. A finish the server names that has no painter here draws as Factory. */
import * as THREE from "three";
function camo(g, cols) { g.fillStyle = cols[0]; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { g.fillStyle = cols[1 + Math.floor(Math.random() * (cols.length - 1))]; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 14 + Math.random() * 30, 8 + Math.random() * 18, Math.random() * 3, 0, 7); g.fill(); } }
export const PAINT = {
  factory: (g) => { g.fillStyle = "#2a2d36"; g.fillRect(0, 0, 256, 256); },
  desert: (g) => camo(g, ["#c9b07a", "#a88d5a", "#8a7046", "#d9c79a"]),
  urban: (g) => camo(g, ["#5a5f6a", "#3a3e48", "#8a8f9a", "#2a2d36"]),
  forest: (g) => camo(g, ["#4a6a3a", "#2f4a2a", "#7a8a4a", "#1f2f1f"]),
  stripes: (g) => { g.fillStyle = "#222"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#ffd84a"; for (let i = -256; i < 512; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 0); g.lineTo(i - 232, 256); g.lineTo(i - 256, 256); g.fill(); } },
  hex: (g) => { g.fillStyle = "#1a2a3a"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#6ad0ff"; g.lineWidth = 2; for (let y = 0; y < 300; y += 28) for (let x = 0; x < 300; x += 32) { const ox = (Math.floor(y / 28) % 2) * 16; g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + ox + 14 * Math.cos(a), y + 14 * Math.sin(a)); } g.closePath(); g.stroke(); } },
  carbon: (g) => { g.fillStyle = "#15171c"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? "#262a33" : "#1b1e25"; g.fillRect(x, y, 8, 8); } },
  toxic: (g) => { g.fillStyle = "#101810"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#7dff6a"; g.lineWidth = 6; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, i * 36); g.bezierCurveTo(80, i * 36 + 30, 170, i * 36 - 30, 256, i * 36 + 10); g.stroke(); } },
  ice: (g) => { const r = g.createLinearGradient(0, 0, 256, 256); r.addColorStop(0, "#e8f6ff"); r.addColorStop(0.5, "#7ac8ff"); r.addColorStop(1, "#2a6aa8"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 2; for (let i = 0; i < 20; i++) { g.beginPath(); g.moveTo(Math.random() * 256, Math.random() * 256); g.lineTo(Math.random() * 256, Math.random() * 256); g.stroke(); } },
  neon: (g) => { const r = g.createLinearGradient(0, 0, 256, 0); r.addColorStop(0, "#ff4fd8"); r.addColorStop(0.5, "#7a3cff"); r.addColorStop(1, "#2ad8ff"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); },
  lava: (g) => { g.fillStyle = "#1a0a05"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${10 + Math.random() * 30},100%,${40 + Math.random() * 30}%)`; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 2 + Math.random() * 5, Math.random() * 3, 0, 7); g.fill(); } },
  galaxy: (g) => { const r = g.createLinearGradient(0, 0, 256, 256); r.addColorStop(0, "#1a0b3a"); r.addColorStop(0.5, "#3a1a6a"); r.addColorStop(1, "#0a1a4a"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); } },
  hardened: (g) => { for (let i = 0; i < 300; i++) { g.fillStyle = `hsl(${200 + Math.random() * 90},${50 + Math.random() * 40}%,${30 + Math.random() * 40}%)`; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 6 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); } },
  dragon: (g) => { g.fillStyle = "#6a0e0e"; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 280; y += 16) for (let x = 0; x < 280; x += 20) { const ox = (Math.floor(y / 16) % 2) * 10; g.fillStyle = ((x + y) / 4) % 3 ? "#b8221a" : "#ffb347"; g.beginPath(); g.arc(x + ox, y, 11, 0, Math.PI); g.fill(); g.strokeStyle = "#ffd84a"; g.lineWidth = 1.5; g.stroke(); } },
  gold: (g) => { const r = g.createLinearGradient(0, 0, 256, 256); r.addColorStop(0, "#fff0a0"); r.addColorStop(0.4, "#ffc83a"); r.addColorStop(0.6, "#b8860b"); r.addColorStop(1, "#ffe070"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); },
  glitch: (g) => { for (let y = 0; y < 256; y += 6) { g.fillStyle = `hsl(${(y * 3) % 360},100%,55%)`; g.fillRect(Math.random() * 40 - 20, y, 300, 6); } g.fillStyle = "rgba(0,0,0,.4)"; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 80, 2 + Math.random() * 4); }
};
const canvases = new Map(), mats = new Map();
export function finCanvas(fin) { const k = PAINT[fin] ? fin : "factory"; if (!canvases.has(k)) { const c = document.createElement("canvas"); c.width = c.height = 256; PAINT[k](c.getContext("2d")); canvases.set(k, c); } return canvases.get(k); }
export const finCss = (fin) => `url(${finCanvas(fin).toDataURL()})`;
/** The material for a finish (shared per finish and kind): guns and beans plain, blades a little metal, gold always metal. */
export function finMat(fin, metal = false) {
  const key = `${fin}:${metal ? 1 : 0}`; if (mats.has(key)) return mats.get(key);
  const t = new THREE.CanvasTexture(finCanvas(fin)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: fin === "gold" ? 0.25 : metal ? 0.4 : 0.6, metalness: fin === "gold" || metal ? 0.75 : 0.25 }); mats.set(key, m); return m;
}
/** "ar:neon" -> "neon"; "knife:gold:karambit" -> ["gold", "karambit"] */
export const finOf = (id) => (id ? String(id).split(":")[1] : null);
export const knifeOf = (id) => (id ? String(id).split(":")[2] || "combat" : "combat");

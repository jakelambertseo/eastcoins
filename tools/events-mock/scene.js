/* EastScape events mockups: the scene kit. Grass, the game's own sprites, the overhead plate, names, hit numbers and a small animation loop,
   drawn at the game's 1:1 on a canvas. Local only (tools/ is never shipped). */
export const F = "/v3/assets/img/glad/flat/", UI = F + "ui/";
const cache = new Map();
export const load = (src) => { if (!cache.has(src)) cache.set(src, new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; })); return cache.get(src); };
export const hr = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
export const PEOPLE = ["hero_tiro_south", "dex_south", "cassia_south", "andy_south", "barker_south", "darla_south", "brutus_south", "bronny_south"];
export const NAMES = ["zwades", "bootypaper", "heartlarva", "andyreid", "tater", "crumbs", "moxie", "lucky7"];
export async function preload(list) { await Promise.all(list.map(load)); }
/* ground: grass (or dark grass, or stone), a scatter of tufts and flowers, all fixed by position */
export async function ground(c, kind = "grass") {
  const W = c.canvas.width, H = c.canvas.height, g = await load(F + "g_grass.png"), fl = await load(F + "g_flowers.png");
  const base = { grass: ["#6f9c4a", "#679244"], dark: ["#4e5a3e", "#46523a"], stone: ["#4a4038", "#554a40"], casino: ["#3a1628", "#461a30"] }[kind];
  c.fillStyle = base[0]; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) if (hr(x, y, 3) < 0.18) { c.fillStyle = base[1]; c.fillRect(x, y, 8, 8); }
  if (kind === "grass" || kind === "dark") for (let i = 0; i < Math.round((W * H) / 5000); i++) { const im = hr(i, 1, 5) < 0.3 ? fl : g; if (im) c.drawImage(im, Math.floor(hr(i, 2, 7) * W), Math.floor(hr(i, 3, 9) * H), 32, 32); }
}
/* a sprite by its feet (x = centre, y = feet), optionally scaled to a width, optionally flipped */
export function draw(c, im, x, y, w, flip) { if (!im) return; const s = w ? w / im.width : 1, dw = Math.round(im.width * s), dh = Math.round(im.height * s); c.save(); c.translate(Math.round(x), Math.round(y)); if (flip) c.scale(-1, 1); c.drawImage(im, -Math.round(dw / 2), -dh, dw, dh); c.restore(); }
export async function spr(c, src, x, y, w, flip) { draw(c, await load(src), x, y, w, flip); }
/* the game's overhead plate: a dark pill, the name, a health bar; `tag` is a red label on top (WANTED) */
export function plate(c, x, y, name, pct, col = "#e0483a", tag, tagCol = "#e0483a") {
  c.font = "800 13px Lora, serif"; const w = Math.max(96, c.measureText(name).width + 24);
  c.fillStyle = "rgba(20,12,8,.86)"; c.beginPath(); c.roundRect(x - w / 2, y - 26, w, pct == null ? 22 : 30, 7); c.fill(); c.strokeStyle = tag ? tagCol : "rgba(255,210,120,.5)"; c.lineWidth = 2; c.stroke();
  c.fillStyle = tag ? "#ffc0b0" : "#ffe7b0"; c.textAlign = "center"; c.fillText(name, x, y - 11);
  if (pct != null) { c.fillStyle = "#2a1a10"; c.fillRect(x - w / 2 + 8, y - 6, w - 16, 5); c.fillStyle = col; c.fillRect(x - w / 2 + 8, y - 6, (w - 16) * Math.max(0, Math.min(1, pct)), 5); }
  if (tag) { c.font = "900 10px Lora, serif"; const tw = c.measureText(tag).width + 16; c.fillStyle = tagCol; c.beginPath(); c.roundRect(x - tw / 2, y - 42, tw, 15, 4); c.fill(); c.fillStyle = "#fff"; c.fillText(tag, x, y - 31); }
}
export const label = (c, x, y, t, col = "#9fd0ff", size = 12) => { c.font = `800 ${size}px Lora, serif`; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.85)"; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y); };
export const hitNum = (c, x, y, n, col = "#fff", size = 15) => { c.font = `800 ${size}px Lora, serif`; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "#000"; c.strokeText(n, x, y); c.fillStyle = col; c.fillText(n, x, y); };
/* people at spots; a name under whoever has one; `bob` for a swing */
export async function crowd(c, spots, t = 0) { for (const [i, s] of spots.entries()) { const [x, y, name, flip] = s, im = await load(F + PEOPLE[i % PEOPLE.length] + ".png"), sw = t ? Math.round(Math.sin(t / 180 + i * 1.7) * 2) : 0; draw(c, im, x + (flip ? -sw : sw), y, null, flip); if (name) label(c, x, y + 12, name); } }
export const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, "0)")); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
export const coin = (c, x, y, r = 5) => { c.fillStyle = "#8a5a0a"; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(x - 1, y - 1, r - 1.5, 0, 6.3); c.fill(); c.fillStyle = "#fff6c0"; c.fillRect(x - 2, y - 3, 2, 2); };
export const tree = async (c, x, y) => spr(c, F + "tree.png", x, y);
/* an animation loop that only draws while its canvas is on screen */
export function loop(cv, fn) { const c = cv.getContext("2d"); c.imageSmoothingEnabled = false; let on = true; new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(cv); const t0 = performance.now(); const tick = async (now) => { if (on) await fn(c, now - t0); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
export function still(cv, fn) { const c = cv.getContext("2d"); c.imageSmoothingEnabled = false; return fn(c); }

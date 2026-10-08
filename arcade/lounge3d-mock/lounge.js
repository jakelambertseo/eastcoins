/* The Game Lounge (2026-10-07; redesigned the same day as a 2000s arcade, the owner: "dark carpets with bright shapes, LED lights,
   flashiness, a feeling of fun and excitement with your friends"). Its look is the Arcade Kit (tools/arcade-kit), not EastScape's.

   A night-time arcade hall: blacklight carpet, LED strips running round the walls, sweeping coloured spots, a neon sign. Every game is a
   cabinet on the far wall (walk up, press E); the high-score board on the right cycles through the games; the prize counter on the left
   is where you change your look; the jukebox beside it plays one radio station for the whole arcade; an air hockey table, a claw machine
   and three hangout tables give people somewhere to stand together.

   THE SHELL (tools/arcade-kit/arcade.js) does the rest, the same in every game: you arrive as yourself (Twitch picture and name) with
   your saved look, the menu (Esc), settings, the chat bottom left (one chat for the lounge and all its games) and the jukebox's sound.
   With the room server up (arcade-worker) the people here are real; without it the room fills with bots so the mockup still opens.
   Flashing stays at 3 a second or slower; reduced motion stops it all. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Sfx } from "../parkour3d-mock/look.js?v=2";
import * as Models from "../climb3d-mock/models.js?v=2";
import * as Arcade from "../arcade-kit/arcade.js?v=7";
import { CHARS, CHAR_NAMES, HATS, RADIO, HOCKEY, hkSeat, hkClampMallet } from "/v3/assets/js/arcade-rules.js?v=2";

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const G = -26, JUMP = 9.4, RUN = 6.4, ACC = 40, R = 0.45;
const CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const COL = { pink: 0xff2d95, cyan: 0x19e3ff, lime: 0xb6ff2e, yellow: 0xffd400, orange: 0xff7a1a, purple: 0x9b5cff, red: 0xff3b4e };
const HEX = (c) => "#" + c.toString(16).padStart(6, "0");
const LED_L = 0.3;   // LED strip lightness (the owner: "lower the LED brightness some"; was 0.55)

$("hudMsg").textContent = "Powering up…";
const t0 = performance.now();
await Promise.all([Models.loadAll((k) => { $("hudMsg").textContent = `Powering up… ${Math.round(k * 100)}%`; }),
  document.fonts.load("40px Bungee"), document.fonts.load("40px Monoton"), document.fonts.load("600 20px Rubik")]);
const carpetImg = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = "../arcade-kit/carpet.svg"; });
const loadMs = Math.round(performance.now() - t0);
$("hudMsg").textContent = "";

const readSave = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const climb = readSave("ecClimb"), tycoon = readSave("ecTycoon"), hooked = readSave("ecHooked");
// offline, the hats your saves have earned in this browser; online, the room server's unlocks decide
const localUnlocks = [...((climb?.best || 0) >= 50 ? ["halo"] : []), ...(climb?.summit ? ["crown"] : [])];

/* ------------------------------------------------------------------ three, with bloom so the neon glows */
const canvas = $("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030b);
scene.fog = new THREE.Fog(0x05030b, 26, 60);
const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0x6a5aa0, 0x1a0a20, 0.6));
const key = new THREE.DirectionalLight(0xd8c8ff, 0.5); key.position.set(4, 16, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14 }); scene.add(key);

const W = 15, D = 11, WALL_H = 6;
const OBST = [];   // [x0, x1, z0, z1]: things you walk round
const block = (x, z, w, d) => OBST.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const tube = (c) => basic(new THREE.Color(c).multiplyScalar(0.62));   // neon tubes, a little under full so the glow doesn't flood
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
function box(w, h, d, mat, x, y, z, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

/* ---- the carpet: the kit's tile, drawn big so it stays sharp, glowing under the blacklight */
{
  const tex = canvasTex(1024, 1024, (g) => { if (carpetImg) g.drawImage(carpetImg, 0, 0, 1024, 1024); else { g.fillStyle = "#0b0618"; g.fillRect(0, 0, 1024, 1024); } });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((2 * W) / 4, (2 * D) / 4);   // a 4 m tile
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * D), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
}
/* ---- walls, and the LED strips that run round them */
const wallMat = std(0x120a24, { roughness: 0.85 });
box(2 * W + 0.6, WALL_H, 0.3, wallMat, 0, WALL_H / 2, -D - 0.15); box(2 * W + 0.6, WALL_H, 0.3, wallMat, 0, WALL_H / 2, D + 0.15);
box(0.3, WALL_H, 2 * D, wallMat, -W - 0.15, WALL_H / 2, 0); box(0.3, WALL_H, 2 * D, wallMat, W + 0.15, WALL_H / 2, 0);
const leds = [];
{
  const SEG = 1.5; let run = 0;
  const edge = (ax, az, bx, bz, nx, nz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / SEG);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, x = ax + (bx - ax) * f + nx * 0.02, z = az + (bz - az) * f + nz * 0.02;
      for (const y of [0.18, 5.2]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(nx) ? 0.05 : SEG - 0.08, 0.05, Math.abs(nz) ? 0.05 : SEG - 0.08), basic(0xffffff)); m.position.set(x, y, z); scene.add(m);
        leds.push({ m, u: run + i });
      }
    }
    run += n;
  };
  edge(-W, -D, W, -D, 0, 1); edge(W, -D, W, D, -1, 0); edge(W, D, -W, D, 0, -1); edge(-W, D, -W, -D, 1, 0);
}
for (const [x, z, c] of [[-W + 0.05, -6, COL.cyan], [-W + 0.05, 9, COL.pink], [W - 0.05, -9.5, COL.lime], [W - 0.05, 8.5, COL.purple]]) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 4.2, 8), tube(c)); t.position.set(x, 2.8, z); scene.add(t);
  const l = new THREE.PointLight(c, 4, 7, 1.8); l.position.set(x + Math.sign(-x) * 0.5, 2.8, z); scene.add(l);
}
/* ---- the sign: THE LOUNGE in tube letters over the cabinets */
const signTex = canvasTex(2048, 360, (g, w, h) => {
  g.textBaseline = "middle"; g.font = "230px Monoton"; g.textAlign = "left";
  const a = g.measureText("THE ").width, b = g.measureText("LOUNGE").width, x0 = (w - a - b) / 2;
  g.shadowBlur = 24; g.shadowColor = "#ff2d95"; g.fillStyle = "#f0b8d8"; g.fillText("THE", x0, h / 2 + 10);
  g.shadowColor = "#19e3ff"; g.fillStyle = "#b8eef6"; g.fillText("LOUNGE", x0 + a, h / 2 + 10);
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.76), basic(0xffffff, { map: signTex, transparent: true }));
sign.position.set(0, 4.6, -D + 0.02); scene.add(sign);
const signLight = new THREE.PointLight(COL.pink, 8, 12, 1.6); signLight.position.set(0, 4.4, -D + 1.6); scene.add(signLight);

/* ---- sweeping coloured spots from above */
const spots = [COL.pink, COL.cyan, COL.purple].map((c, i) => {
  const s = new THREE.SpotLight(c, 50, 26, 0.32, 0.6, 1.2); s.position.set(-8 + i * 8, 9, 1); scene.add(s); scene.add(s.target);
  return { s, ph: i * 2.1 };
});

/* ------------------------------------------------------------------ the cabinets: one per game */
const GAMES = [
  { key: "climb", name: "THE CLIMB", emoji: "🧗", room: "climb", col: COL.purple, open: true },
  { key: "tycoon", name: "TYCOON", emoji: "🏟️", room: "tycoon", col: COL.yellow },
  { key: "hooked", name: "HOOKED", emoji: "🎣", room: "hooked", col: COL.cyan },
  { key: "gridiron", name: "GRIDIRON", emoji: "🏈", room: "gridiron", col: COL.lime },
  { key: "party", name: "PARTY MIX", emoji: "🎉", room: "party", col: COL.pink },
  { key: "rumble", name: "RUMBLE", emoji: "🚀", href: "../rumble2d-mock/", col: COL.orange },
  { key: "brawl", name: "BRAWL", emoji: "💥", href: "../brawl3d-mock/", col: COL.red }
];
function screenTex(gm, blink = 1) {
  return canvasTex(512, 400, (g, w, h) => {
    const c = HEX(gm.col);
    const gr = g.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h * 0.42, w * 0.7); gr.addColorStop(0, gm.open ? c : "#2a2040"); gr.addColorStop(1, "#05030b");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "120px serif"; g.globalAlpha = gm.open ? 1 : 0.45; g.fillText(gm.emoji, w / 2, h * 0.38); g.globalAlpha = 1;
    g.font = "44px Bungee"; g.fillStyle = "#fff"; g.shadowColor = c; g.shadowBlur = 16; g.fillText(gm.name, w / 2, h * 0.72);
    g.font = "26px Bungee"; g.fillStyle = gm.open ? "#b6ff2e" : "#7c6ea6"; g.shadowBlur = 0; g.fillText(gm.open ? (blink ? "PRESS E TO PLAY" : "") : "COMING SOON", w / 2, h * 0.88);
    g.fillStyle = "rgba(0,0,0,.18)"; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
  });
}
function marqueeTex(gm) {
  return canvasTex(512, 140, (g, w, h) => {
    const c = HEX(gm.col); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c); gr.addColorStop(1, "#120a24");
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.textAlign = "center"; g.textBaseline = "middle"; g.font = "64px Bungee";
    g.lineWidth = 8; g.strokeStyle = "#0a0614"; g.strokeText(gm.name, w / 2, h / 2 + 4); g.fillStyle = "#fff"; g.fillText(gm.name, w / 2, h / 2 + 4);
  });
}
const cabs = [];
GAMES.forEach((gm, i) => {
  const x = -11.4 + i * 3.8, z = -D + 0.75, g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const body = std(0x15102a, { roughness: 0.4 });
  box(1.4, 1.0, 0.9, body, 0, 0.5, 0, g);
  box(1.4, 1.4, 0.7, body, 0, 1.7, -0.1, g);
  const side = std(gm.col, { emissive: gm.col, emissiveIntensity: gm.open ? 0.4 : 0.14, roughness: 0.3 });
  for (const sx of [-0.71, 0.71]) box(0.03, 2.3, 0.92, side, sx, 1.2, -0.01, g);
  const panel = box(1.4, 0.12, 0.55, std(0x241a44), 0, 1.04, 0.5, g); panel.rotation.x = 0.22;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), std(0x222222)); stick.position.set(-0.32, 1.16, 0.5); g.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), std(COL.red, { emissive: COL.red, emissiveIntensity: 0.3 })); ball.position.set(-0.32, 1.25, 0.5); g.add(ball);
  [COL.pink, COL.cyan, COL.yellow].forEach((c, k) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14), tube(c)); b.position.set(0.04 + k * 0.17, 1.12, 0.5 - k * 0.01); b.rotation.x = 0.22; g.add(b); });
  const coin = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), tube(COL.red)); coin.position.set(0, 0.62, 0.46); g.add(coin);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.83), basic(0xdddddd, { map: screenTex(gm, 1) })); scr.position.set(0, 1.78, 0.26); scr.rotation.x = -0.12; g.add(scr);
  const marq = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.5), [body, body, body, body, basic(0xdddddd, { map: marqueeTex(gm) }), body]); marq.position.set(0, 2.6, -0.02); g.add(marq);
  const glow = new THREE.PointLight(gm.col, gm.open ? 7 : 2.5, 5, 1.8); glow.position.set(0, 1.6, 1.3); g.add(glow);
  block(x, z, 1.5, 1.1);
  cabs.push({ gm, x, z: z + 1.3, scr, i });
});
/* ---- the high-score board on the east wall: one big lit panel, cycling through the games, bulbs chasing round it */
const BOTS = ["drhealsgud", "cenozoicmegafauna", "PsilocyBoone", "heartlarva", "zwades", "andyreidisapawg", "CarlCaribbean", "allyrose7774"];
const rows = (vals, fmt, mine, desc = true) => { const r = BOTS.slice(0, vals.length).map((n, i) => ({ name: n, n: vals[i], v: fmt(vals[i]) })); if (mine) r.push({ ...mine, me: true }); return r.sort((a, b) => (desc ? b.n - a.n : a.n - b.n)); };
const fmtT = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
const BOARDS = [
  { title: "THE CLIMB", unit: "HIGHEST FLOOR · THIS SEASON", col: COL.purple, rows: rows([100, 87, 74, 61, 52, 38, 23], (n) => (n === 100 ? "👑 ROOF" : `FLOOR ${n}`), climb ? { name: "You", n: climb.summit ? 100 : climb.best || 1, v: climb.summit ? "👑 ROOF" : `FLOOR ${climb.best || 1}` } : null) },
  { title: "THE CLIMB", unit: "FASTEST TO THE BELL", col: COL.purple, rows: rows([4.2 * 3600, 6.9 * 3600, 9.1 * 3600], fmtT, climb?.summit ? { name: "You", n: climb.time, v: fmtT(climb.time) } : null, false) },
  { title: "TYCOON", unit: "NET WORTH", col: COL.yellow, rows: rows([9e9, 2e8, 4e7, 3e6, 4e5, 2e4], (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${Math.round(n / 1e3)}K`), tycoon ? { name: "You", n: tycoon.money || 0, v: `$${Math.round(tycoon.money || 0).toLocaleString()}` } : null) },
  { title: "HOOKED", unit: "BIGGEST CATCH", col: COL.cyan, rows: rows([612, 240, 88, 41, 12, 6], (n) => `${n} KG`, hooked?.stats?.best ? { name: "You", n: hooked.stats.best.kg, v: `${hooked.stats.best.kg} KG` } : null) }
];
let boardIdx = 0;
function boardTex(bd) {
  return canvasTex(1400, 700, (g, w, h) => {
    g.fillStyle = "#07040f"; g.fillRect(0, 0, w, h);
    const c = HEX(bd.col);
    g.textAlign = "left"; g.textBaseline = "middle"; g.font = "70px Bungee"; g.fillStyle = "#fff"; g.shadowColor = c; g.shadowBlur = 24; g.fillText("HIGH SCORES", 50, 70);
    g.textAlign = "right"; g.font = "56px Bungee"; g.fillStyle = c; g.fillText(bd.title, w - 50, 66); g.shadowBlur = 0;
    g.font = "600 28px Rubik"; g.fillStyle = "#b4a6d6"; g.fillText(bd.unit, w - 50, 116);
    g.fillStyle = c; g.fillRect(50, 140, w - 100, 4);
    const medal = ["#ffd400", "#dfe6ff", "#ff7a1a"];
    bd.rows.slice(0, 7).forEach((r, k) => {
      const y = 196 + k * 70;
      if (r.me) { g.fillStyle = "rgba(25,227,255,.16)"; g.fillRect(40, y - 32, w - 80, 64); g.strokeStyle = "#19e3ff"; g.lineWidth = 3; g.strokeRect(40, y - 32, w - 80, 64); }
      g.textAlign = "left"; g.font = "50px Bungee"; g.fillStyle = medal[k] || "#7c6ea6"; if (k < 3) { g.shadowColor = medal[k]; g.shadowBlur = 14; } g.fillText(String(k + 1), 64, y + 2); g.shadowBlur = 0;
      g.font = "700 40px Rubik"; g.fillStyle = r.me ? "#19e3ff" : "#f4ecff"; g.fillText(r.name, 150, y + 2);
      g.textAlign = "right"; g.font = "46px Bungee"; g.fillStyle = "#b6ff2e"; g.shadowColor = "#b6ff2e"; g.shadowBlur = 10; g.fillText(r.v, w - 64, y + 2); g.shadowBlur = 0;
    });
    BOARDS.forEach((_, k) => { g.fillStyle = k === BOARDS.indexOf(bd) ? c : "#3a2a66"; g.beginPath(); g.arc(w / 2 - (BOARDS.length - 1) * 18 + k * 36, h - 26, 9, 0, 7); g.fill(); });
  });
}
const BX = W - 0.12, BZ = -1, BW = 8, BH = 4;
const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), basic(0xe0e0e0, { map: boardTex(BOARDS[0]) }));
boardMesh.position.set(BX, 3.1, BZ); boardMesh.rotation.y = -Math.PI / 2; scene.add(boardMesh);
box(0.15, BH + 0.5, BW + 0.5, std(0x1c1236), W - 0.02, 3.1, BZ);
const bulbPos = [];
{ const step = 0.4; for (let s = -BW / 2 - 0.15; s <= BW / 2 + 0.15; s += step) { bulbPos.push([s, BH / 2 + 0.15], [s, -BH / 2 - 0.15]); } for (let s = -BH / 2 + 0.25; s <= BH / 2 - 0.1; s += step) { bulbPos.push([-BW / 2 - 0.15, s], [BW / 2 + 0.15, s]); } }
const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), basic(0xffffff), bulbPos.length);
const BULB_ON = new THREE.Color(COL.yellow).multiplyScalar(0.75), BULB_OFF = new THREE.Color(0x3a2e0c);
bulbPos.forEach(([s, y], k) => { bulbs.setMatrixAt(k, new THREE.Matrix4().makeTranslation(BX - 0.1, 3.1 + y, BZ - s)); bulbs.setColorAt(k, BULB_ON); });
scene.add(bulbs);
const boardLight = new THREE.PointLight(COL.yellow, 6, 10, 1.6); boardLight.position.set(W - 2, 3, BZ); scene.add(boardLight);

/* ---- the prize counter (your look) on the west wall */
const OUTFIT = new V3(-W + 3.6, 0, 4.5);
{
  box(1.2, 1.0, 5, std(0x241a44, { roughness: 0.4 }), -W + 2.4, 0.5, 4.5);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 4.8), new THREE.MeshStandardMaterial({ color: 0x9be8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2 }));
  glass.position.set(-W + 2.4, 1.26, 4.5); scene.add(glass);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 5), tube(COL.cyan)); strip.position.set(-W + 3.02, 0.95, 4.5); scene.add(strip);
  block(-W + 2.4, 4.5, 1.3, 5.1);
  for (let s = 0; s < 3; s++) { box(0.5, 0.06, 5, std(0x2a1e4a), -W + 0.5, 1.1 + s * 0.9, 4.5); for (let k = 0; k < 7; k++) { const c = pick(Object.values(COL)); const p = new THREE.Mesh(k % 2 ? new THREE.SphereGeometry(0.2, 12, 10) : new THREE.BoxGeometry(0.32, 0.32, 0.32), std(c, { emissive: c, emissiveIntensity: 0.2 })); p.position.set(-W + 0.5, 1.33 + s * 0.9, 2.4 + k * 0.7); p.rotation.y = k; scene.add(p); } }
  const t = canvasTex(1024, 220, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "170px Monoton"; g.shadowBlur = 22; g.shadowColor = "#b6ff2e"; g.fillStyle = "#d8f0b0"; g.fillText("PRIZES", w / 2, h / 2 + 8); });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), basic(0xffffff, { map: t, transparent: true })); s.position.set(-W + 0.05, 4.4, 4.5); s.rotation.y = Math.PI / 2; scene.add(s);
  const l = new THREE.PointLight(COL.lime, 5, 8, 1.6); l.position.set(-W + 2.5, 3, 4.5); scene.add(l);
}
/* ---- the jukebox, beside the prize counter: one station for the whole arcade (the shell plays it; E opens the picker) */
const JUKE = new V3(RADIO.at.x, 0, RADIO.at.z);
const juke = new THREE.Group(); juke.position.copy(JUKE); juke.rotation.y = Math.PI / 2; scene.add(juke);
const jukeLights = [];
{
  const wood = std(0x5a1e3a, { roughness: 0.35, metalness: 0.2 });
  box(1.5, 1.4, 0.8, wood, 0, 0.7, 0, juke);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.8, 32, 1, false, -Math.PI / 2, Math.PI), wood); top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.set(0, 1.4, 0); top.castShadow = true; juke.add(top);
  // the glowing arch and the side tubes, which pulse with the music when a station is on
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40, Math.PI), tube(COL.orange)); arch.position.set(0, 1.4, 0.42); juke.add(arch); jukeLights.push(arch);
  for (const sx of [-0.62, 0.62]) { const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 10), tube(COL.pink)); t2.position.set(sx, 0.72, 0.42); juke.add(t2); jukeLights.push(t2); }
  const win2 = canvasTex(256, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ffcf6a"); gr.addColorStop(1, "#ff7a1a"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(60,20,0,.55)"; for (let i = 0; i < 6; i++) g.fillRect(24, 18 + i * 22, w - 48, 10); });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), basic(0xbbbbbb, { map: win2 })); pane.position.set(0, 1.42, 0.405); juke.add(pane);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), std(0x2a0e1e, { roughness: 0.9 })); grille.position.set(0, 0.45, 0.405); juke.add(grille);
  const t = canvasTex(512, 110, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "64px Bungee"; g.fillStyle = "#ffd27a"; g.shadowBlur = 14; g.shadowColor = "#ff7a1a"; g.fillText("JUKEBOX", w / 2, h / 2 + 4); });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.28), basic(0xffffff, { map: t, transparent: true })); lab.position.set(0, 2.35, 0.1); juke.add(lab);
  const l = new THREE.PointLight(COL.orange, 5, 6, 1.8); l.position.set(0.9, 1.6, 0); juke.add(l); jukeLights.push(l);
  block(JUKE.x + 0.1, JUKE.z, 1.0, 1.6);
}
/* ---- the floor: air hockey, a claw machine, hangout tables */
{
  const ah = new THREE.Group(); ah.position.set(1, 0, 4); scene.add(ah);
  box(2.6, 0.75, 1.4, std(0x1c1236), 0, 0.38, 0, ah);
  const top = canvasTex(512, 280, (g, w, h) => { g.fillStyle = "#e8fbff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ff2d95"; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 50, 0, 7); g.stroke(); g.strokeStyle = "#19e3ff"; g.beginPath(); g.arc(0, h / 2, 70, -1.6, 1.6); g.stroke(); g.beginPath(); g.arc(w, h / 2, 70, 1.6, 4.7); g.stroke(); });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), basic(0xa8b8c8, { map: top })); surf.rotation.x = -Math.PI / 2; surf.position.set(0, 0.77, 0); ah.add(surf);
  for (const sx of [-1.31, 1.31]) box(0.04, 0.08, 1.4, tube(COL.cyan), sx, 0.8, 0, ah); for (const sz of [-0.71, 0.71]) box(2.6, 0.08, 0.04, tube(COL.pink), 0, 0.8, sz, ah);
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), basic(COL.red)); puck.position.y = 0.79; ah.add(puck);
  scene.userData.puck = puck;
  // two mallets (side 0 pink at the -x end, side 1 cyan at +x) and a scoreboard floating over the table
  const mallet = (c) => { const g2 = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(HOCKEY.malletR, HOCKEY.malletR, 0.035, 20), basic(c)); base.position.y = 0.0175; g2.add(base);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.07, 14), std(c, { roughness: 0.3 })); knob.position.y = 0.07; g2.add(knob); g2.position.y = 0.775; ah.add(g2); return g2; };
  scene.userData.mallets = [mallet(new THREE.Color(COL.pink).multiplyScalar(0.8)), mallet(new THREE.Color(COL.cyan).multiplyScalar(0.8))];
  scene.userData.mallets[0].position.x = -0.9; scene.userData.mallets[1].position.x = 0.9;
  const sbCanvas = document.createElement("canvas"); sbCanvas.width = 1024; sbCanvas.height = 200;
  const sbTex = new THREE.CanvasTexture(sbCanvas); sbTex.colorSpace = THREE.SRGBColorSpace;
  const sb = new THREE.Sprite(new THREE.SpriteMaterial({ map: sbTex, transparent: true, depthTest: false })); sb.scale.set(2.6, 0.5, 1); sb.position.set(0, 1.75, 0); sb.renderOrder = 6; sb.visible = false; ah.add(sb);
  scene.userData.board = { canvas: sbCanvas, tex: sbTex, sprite: sb };
  block(1, 4, 2.7, 1.5);
  const cm = new THREE.Group(); cm.position.set(11.5, 0, 8.6); scene.add(cm);
  box(1.6, 0.9, 1.6, std(COL.pink, { emissive: COL.pink, emissiveIntensity: 0.18 }), 0, 0.45, 0, cm);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.5), new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.15, roughness: 0.05 })); glass.position.y = 1.6; cm.add(glass);
  box(1.6, 0.35, 1.6, std(0x241a44), 0, 2.48, 0, cm);
  const ct = canvasTex(512, 110, (g, w, h) => { g.fillStyle = "#d02478"; g.fillRect(0, 0, w, h); g.textAlign = "center"; g.textBaseline = "middle"; g.font = "74px Bungee"; g.fillStyle = "#fff"; g.fillText("CLAW", w / 2, h / 2 + 4); });
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), basic(0xdddddd, { map: ct })); cs.position.set(0, 2.48, -0.81); cs.rotation.y = Math.PI; cm.add(cs);
  for (let k = 0; k < 14; k++) { const c = pick(Object.values(COL)); const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std(c, { emissive: c, emissiveIntensity: 0.15 })); p.position.set(rnd(-0.55, 0.55), 1.05 + rnd(0, 0.25), rnd(-0.55, 0.55)); cm.add(p); }
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 3), std(0xdddddd, { metalness: 0.8, roughness: 0.3 })); claw.position.set(0, 2.05, 0); claw.rotation.x = Math.PI; cm.add(claw); scene.userData.claw = claw;
  const cl = new THREE.PointLight(COL.pink, 4, 6, 1.8); cl.position.set(0, 2, -1.2); cm.add(cl);
  block(11.5, 8.6, 1.7, 1.7);
  for (const [tx, tz, c] of [[-7.5, 7, COL.cyan], [-2.5, 8.5, COL.orange], [6.5, 6.5, COL.lime]]) {
    const top2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.07, 28), std(0x241a44, { roughness: 0.3 })); top2.position.set(tx, 1.0, tz); top2.castShadow = true; scene.add(top2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.022, 6, 40), tube(c)); ring.rotation.x = Math.PI / 2; ring.position.set(tx, 1.0, tz); scene.add(ring);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.25, 1.0, 12), std(0x15102a)); leg.position.set(tx, 0.5, tz); scene.add(leg);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4, st = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.7, 14), std(c, { emissive: c, emissiveIntensity: 0.12 })); st.position.set(tx + Math.cos(a) * 1.25, 0.35, tz + Math.sin(a) * 1.25); st.castShadow = true; scene.add(st); }
    const l = new THREE.PointLight(c, 3, 4, 1.8); l.position.set(tx, 1.6, tz); scene.add(l);
    block(tx, tz, 1.6, 1.6);
  }
}

/* ------------------------------------------------------------------ people */
const labels = [];
// a name over a head, with the Twitch picture beside it when there is one
function makeLabel(text, color = "#fff", avatar = null) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 96; const g = c.getContext("2d");
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = (img) => {
    g.clearRect(0, 0, 640, 96); g.font = "40px Bungee"; const tw = Math.min(520, g.measureText(text).width), pic = img ? 74 : 0, x0 = (640 - tw - pic) / 2;
    if (img) { g.save(); g.beginPath(); g.arc(x0 + 32, 48, 30, 0, 7); g.closePath(); g.lineWidth = 6; g.strokeStyle = color; g.stroke(); g.clip(); g.drawImage(img, x0 + 2, 18, 60, 60); g.restore(); }
    g.textAlign = "left"; g.textBaseline = "middle"; g.lineWidth = 9; g.strokeStyle = "rgba(5,3,11,.9)"; g.strokeText(text, x0 + pic, 52, 520); g.fillStyle = color; g.fillText(text, x0 + pic, 52, 520);
    t.needsUpdate = true;
  };
  draw(null);
  if (avatar) { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => draw(img); img.src = avatar; }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(3, 0.45, 1); s.renderOrder = 5;
  labels.push(s); s.visible = settings.names; return s;
}
function hatMesh(key) {
  const g = new THREE.Group();
  if (key === "cap") { const m = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xff2d95)); g.add(m); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.28), m.material); brim.position.set(0, 0, 0.26); g.add(brim); }
  if (key === "beanie") { const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x19a3ff)); m.scale.y = 1.2; g.add(m); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(0xffffff)); pom.position.y = 0.34; g.add(pom); }
  if (key === "halo") { const m = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), basic(0xfff0a0)); m.rotation.x = Math.PI / 2; m.position.y = 0.32; g.add(m); }
  if (key === "crown") { const gold = std(0xffd23a, { metalness: 0.8, roughness: 0.25, emissive: 0x3a2a00 }); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.14, 12, 1, true), gold)); for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold); const a = (i / 5) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.25, 0.14, Math.sin(a) * 0.25); g.add(sp); } }
  return g;
}
function makePerson(look, name, color, avatar = null) {
  const g = new THREE.Group();
  const ch = Models.char(look.model, 1.6);
  if (ch) { ch.obj.rotation.y = Math.PI; g.add(ch.obj); }
  const h = hatMesh(look.hat); h.position.y = 1.72; g.add(h);
  let tag = null; if (name) { tag = makeLabel(name, color, avatar); tag.position.y = 2.2; g.add(tag); }   // your own name would only cover the view
  scene.add(g); return { g, ch, tag };
}
function dropPerson(mesh) { scene.remove(mesh.g); if (mesh.tag) { const i = labels.indexOf(mesh.tag); if (i >= 0) labels.splice(i, 1); mesh.tag.material.map.dispose(); } }
function pushOut(p, r) {
  for (const [x0, x1, z0, z1] of OBST) {
    const cx = clamp(p.x, x0, x1), cz = clamp(p.z, z0, z1), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-4) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
      else { const e = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z], m = Math.min(...e); if (m === e[0]) p.x = x0 - r; else if (m === e[1]) p.x = x1 + r; else if (m === e[2]) p.z = z0 - r; else p.z = z1 + r; }
    }
  }
  p.x = clamp(p.x, -W + r, W - r); p.z = clamp(p.z, -D + r, D - r);
}

/* ------------------------------------------------------------------ the shell: who you are, the menu, chat, settings, the jukebox */
const settings = { ...Arcade.DEFAULT_SETTINGS };
const me = { p: new V3(0, R, 1), v: new V3(), facing: Math.PI, grounded: true };
const remote = new Map();   // id -> { p, mesh, target, f, a }
const tstate = { x: 0, y: 0, jump: false };   // the shell's thumbstick and buttons write here (phones)
let bots = [];
const A = await Arcade.start({
  stage: document.querySelector(".stage"), room: "lounge", title: "The Lounge", where: "", localUnlocks,
  help: `<p><b>Walk</b> with WASD, <b>jump</b> with Space, <b>drag</b> to look round. <b>E</b> uses whatever you're standing at:</p>
    <p>🕹️ a <b>cabinet</b> on the far wall opens its game · 🏆 the <b>board</b> on the right flips to the next game · 🎁 the <b>prize counter</b> changes your look ·
    📻 the <b>jukebox</b> picks the station the whole arcade hears · 🧸 the <b>claw</b>, and 🏒 <b>air hockey</b> (for two, once the room is live).</p>
    <p><b>Enter</b> opens the chat, <b>Esc</b> the menu, <b>M</b> mutes.</p>`,
  lookHint: "Talk to Sydney at the prize counter to change your character and hat.",
  touch: { state: tstate, buttons: [{ id: "use", label: "E", cls: "alt", tap: () => { if (near) use(near); } }, { id: "jump", label: "JUMP" }] },
  onHello: () => { if (A.hello?.hockey) onHk({ ...A.hello.hockey, top: A.hello.hockeyTop });  for (const b of bots) dropPerson(b.mesh); bots = []; for (const p of A.people.values()) addRemote(p); renderOnline(); renderOutfit(); },
  onOffline: () => { startBots(); renderOnline(); },
  onJoin: (p) => { addRemote(p); renderOnline(); },
  onLeave: (id) => { const r = remote.get(id); if (r) { dropPerson(r.mesh); remote.delete(id); } renderOnline(); },
  onRoom: (p) => { const r = remote.get(p.id); if (r) r.mesh.g.visible = p.room === "lounge"; else addRemote(p); renderOnline(); },
  onPos: (id, pos) => { const r = remote.get(id); if (!r) return; if (!r.seen) { r.mesh.g.position.set(pos[0], pos[1] - R, pos[2]); r.seen = true; } r.target.set(pos[0], pos[1] - R, pos[2]); r.f = pos[3]; r.a = pos[4]; },
  onLook: (id, look, mine) => {
    if (mine) { rebuildMe(); Sfx.play("checkpoint"); return; }
    const r = remote.get(id); if (!r) return; const pos = r.mesh.g.position.clone(), vis = r.mesh.g.visible; dropPerson(r.mesh); r.mesh = makePerson(look, r.p.name, Arcade.nameColor(r.p.login), r.p.avatar); r.mesh.g.position.copy(pos); r.mesh.g.visible = vis;
  },
  onMessage: (m) => {
    if (m.t === "hkf") { hk.prev = hk.s; hk.s = m.s; if (m.e === "hit") Sfx.play("beep"); }
    else if (m.t === "hk") onHk(m);
  },
  onDisconnect: () => { for (const r of remote.values()) dropPerson(r.mesh); remote.clear(); renderOnline(); },
  onLeaving: () => { entering = true; }
});
me.mesh = makePerson(A.look, null);
/* THE PRIZE CLERK (the owner: "the vanity widget needs to be an NPC in the lounge instead"; renamed Sydney the same evening, with a bigger
   figure under her uniform polo). Sydney stands behind the prize counter; E at the
   counter talks to her, and she opens the shell's look window (character and hats). A lime marker over her head says she's someone to
   talk to; she turns to face you when you come up. */
const CLERK = { name: "Sydney", icon: "🎟️" };
const CHEST = { y: 0.2, z: -0.16 };   // where the polo's front sits on the torso bone (metres; the bone's front is -z)
const CLERK_LINES = ["Step right up! What'll it be today?", "Looking sharp. Fancy a new hat?", "The crown? Ring the bell at the top of The Climb and it's yours.",
  "The halo's for anyone who makes floor 50. Just saying.", "Free hats are free. The good ones you earn.", "New look, new luck. That's what I always say."];
const clerk = makePerson({ model: "char-female-d", hat: "cap" }, "SYDNEY · PRIZES", "#b6ff2e");
// her uniform: a lime polo over the torso, cut generously in front. Hung on the model's torso bone so it moves with her.
{
  const torso = clerk.ch?.model.getObjectByName("torso");
  if (torso) {
    clerk.g.updateMatrixWorld(true);
    const ws = new V3(); torso.getWorldScale(ws);
    const rig = new THREE.Group(); rig.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z); torso.add(rig);   // metres, whatever the model's scale
    const polo = std(0x7fd93a, { roughness: 0.6 });
    for (const sx of [-0.105, 0.105]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), polo); b.position.set(sx, CHEST.y, CHEST.z); b.scale.set(1, 0.92, 0.9); b.castShadow = true; rig.add(b); }
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), basic(0xffffff)); tag.position.set(0.2, CHEST.y + 0.1, CHEST.z + 0.04); tag.rotation.y = Math.PI + 0.4; rig.add(tag);   // a name badge
    clerk.chest = rig;
  }
}
clerk.g.position.set(-W + 1.3, 0, 4.5); clerk.g.rotation.y = Math.PI / 2;
const clerkMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), tube(COL.lime)); clerkMark.position.y = 2.7; clerk.g.add(clerkMark);
function rebuildMe() { const vis = me.mesh.g.visible; dropPerson(me.mesh); me.mesh = makePerson(A.look, null); me.mesh.g.visible = vis; }
function addRemote(p) {
  if (remote.has(p.id) || (A.me && p.id === A.me.id)) return;
  const r = { p, mesh: makePerson(p.look || { model: CHARS[0], hat: "none" }, p.name, Arcade.nameColor(p.login), p.avatar), target: new V3(0, 0, 3), f: 0, a: 0, seen: false };
  if (p.pos) { r.mesh.g.position.set(p.pos[0], p.pos[1] - R, p.pos[2]); r.target.copy(r.mesh.g.position); r.seen = true; }
  r.mesh.g.visible = p.room === "lounge";
  remote.set(p.id, r);
}
A.onSettings((s) => {
  Object.assign(settings, s);
  bloom.enabled = s.glow;
  renderer.setPixelRatio(s.quality === "low" ? 0.75 : s.quality === "medium" ? 1 : Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = s.quality !== "low";
  for (const l of labels) l.visible = s.names;
  Sfx.setVolume(s.master * s.sfx, s.mute);
  canvas.width = 0;   // forces the resize check in the frame
});

/* ---- the others when the room server is offline: bots where people stand in an arcade */
const SPOTS = [
  ...cabs.map((c) => ({ x: c.x, z: c.z + 0.1, face: Math.PI, what: "cab" })),
  { x: -0.6, z: 4, face: Math.PI / 2, what: "hockey" }, { x: 2.6, z: 4, face: -Math.PI / 2, what: "hockey" },
  { x: -7.5, z: 8.6, face: Math.PI, what: "table" }, { x: -9, z: 6.3, face: Math.PI / 2, what: "table" }, { x: -2.5, z: 6.9, face: 0, what: "table" }, { x: 6.5, z: 4.9, face: 0, what: "table" }, { x: 8, z: 7.4, face: -Math.PI / 2, what: "table" },
  { x: W - 3.2, z: -2, face: Math.PI / 2, what: "board" }, { x: W - 3.4, z: 0.4, face: Math.PI / 2, what: "board" },
  { x: 11.5, z: 7, face: 0, what: "claw" }, { x: OUTFIT.x + 0.4, z: 3.2, face: -Math.PI / 2, what: "prizes" }, { x: JUKE.x + 1.6, z: JUKE.z, face: -Math.PI / 2, what: "juke" }
];
const WHERE = ["floor 34", "floor 61", "floor 88", "the roof"];
const BANTER = ["who's doing the climb tonight", "gg", "anyone want air hockey", "the chain hall swings are so mean", "floor 61 ice nearly made me quit", "rang the bell, crown is sick", "that claw machine is rigged", "lightning took my ledge mid-jump", "race you to floor 20", "this carpet goes hard"];
function startBots() {
  bots = BOTS.map((name, i) => {
    const o = { name, login: name, i, inGame: i % 3 === 0 ? pick(WHERE) : null, t: rnd(1, 6), spot: null, stuck: 0, color: Arcade.nameColor(name) };
    o.mesh = makePerson({ model: CHARS[(i + 1) % CHARS.length], hat: ["none", "cap", "beanie", "none", "halo", "cap", "crown", "beanie"][i] }, name, o.color);
    const s = SPOTS[(i * 3) % SPOTS.length]; o.mesh.g.position.set(s.x, 0, s.z); o.spot = s; o.mesh.g.rotation.y = s.face;
    o.mesh.g.visible = !o.inGame;
    return o;
  });
  A.localChat("heartlarva", "welcome in 👋"); A.localChat("drhealsgud", "the climb cabinet is the purple one");
}
function stepBots(dt) {
  for (const o of bots) {
    const g = o.mesh.g; o.t -= dt;
    if (o.inGame) {
      if (o.t <= 0) { o.inGame = null; g.visible = true; g.position.set(cabs[0].x, 0, cabs[0].z + 0.3); o.spot = null; o.t = rnd(1, 3); A.localChat(o.name, pick(["back", "that was rough", "made it to floor " + Math.floor(rnd(20, 99)), "brb", "gg"])); renderOnline(); }
      continue;
    }
    if (o.t <= 0) {
      if (Math.random() < 0.16) o.spot = { x: cabs[0].x, z: cabs[0].z, face: Math.PI, what: "leave" };
      else { const free = SPOTS.filter((sp) => !bots.some((q) => q !== o && !q.inGame && q.spot === sp)); o.spot = pick(free.length ? free : SPOTS); }
      o.t = rnd(6, 14); o.stuck = 0; renderOnline();
      if (Math.random() < 0.3) A.localChat(o.name, pick(BANTER));
    }
    const sp = o.spot; if (!sp) continue;
    const dx = sp.x - g.position.x, dz = sp.z - g.position.z, d = Math.hypot(dx, dz);
    if (d > 0.25) {
      const bx = g.position.x, bz = g.position.z; g.position.x += (dx / d) * 3 * dt; g.position.z += (dz / d) * 3 * dt; pushOut(g.position, 0.4);
      g.rotation.y = Math.atan2(dx, dz); o.mesh.ch?.play("walk");
      if (Math.hypot(g.position.x - bx, g.position.z - bz) < 1.5 * dt) { o.stuck += dt; if (o.stuck > 1) { o.spot = pick(SPOTS); o.stuck = 0; } }
    } else {
      let dy = sp.face - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.15;
      o.mesh.ch?.play("idle");
      if (sp.what === "leave") { o.inGame = pick(WHERE); g.visible = false; o.t = rnd(15, 40); renderOnline(); }
    }
    o.mesh.ch?.update(dt);
  }
}
// real people: ease toward where the server last put them
const ANIMS = ["idle", "walk", "jump"];
function stepRemote(dt) {
  for (const r of remote.values()) {
    const g = r.mesh.g; if (!g.visible) continue;
    g.position.lerp(r.target, Math.min(1, dt * 12));
    let dy = r.f - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 12);
    r.mesh.ch?.play(ANIMS[r.a] || "idle"); r.mesh.ch?.update(dt);
  }
}

/* ------------------------------------------------------------------ the side panels: who's here, the prize counter */
/* WHO'S ONLINE is the shell's button now (top right, in every game). Online it lists the room server's people by itself; offline the
   lounge hands it the bots, so the mockup still shows the shape. */
const doing = { cab: "at a cabinet", hockey: "air hockey", board: "reading the board", table: "hanging out", claw: "at the claw", prizes: "at the prize counter", juke: "at the jukebox", leave: "heading in" };
function renderOnline() {
  if (A.online) return;
  A.setFakePeople(bots.map((o) => ({ id: "bot:" + o.name, name: o.name, login: o.name, room: o.inGame ? "climb" : "lounge", where: o.inGame || doing[o.spot?.what] || "" })));
}

/* ------------------------------------------------------------------ air hockey (the room server runs it: arcade-rules.js HOCKEY, hkStep)
   E at the table sits you at an end; the next person to sit plays you. While you're seated your character stands at your end, the camera
   sits behind it, and the mouse (or a finger) steers your mallet: the page sends where it wants the mallet, the server moves it and the puck,
   and everyone in the lounge is sent the table 30 times a second. E again stands you up (mid-match, that's a forfeit). */
const hk = { state: null, s: [0, 0, -0.9, 0, 0.9, 0], prev: null, aimAt: 0, aim: null, top: [] };
const hkSide = () => (A.online && A.me && hk.state ? hk.state.seats.indexOf(A.me.id) : -1);
function hkPrompt() {
  const h = hk.state, side = hkSide();
  if (side >= 0) return h.phase === "wait" ? `<kbd>E</kbd> Stand up · waiting for someone to play you` : `<b>${h.score[side]} – ${h.score[1 - side]}</b> · move the mouse to steer · <kbd>E</kbd> stand up (forfeits)`;
  if (!h || h.phase === "idle") return `<kbd>E</kbd> Sit down: air hockey, first to ${HOCKEY.winTo}`;
  if (h.phase === "wait") return `<kbd>E</kbd> Play ${esc(h.names[h.seats[0] ? 0 : 1])} at air hockey`;
  return `Air hockey: ${esc(h.names[0])} ${h.score[0]} – ${h.score[1]} ${esc(h.names[1])}`;
}
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new V3(0, 1, 0), -0.8), _hit = new V3();
function hkAim(e) {
  const side = hkSide(); if (side < 0) return;
  const r = canvas.getBoundingClientRect(); _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(_ndc, camera); if (!_ray.ray.intersectPlane(_plane, _hit)) return;
  hk.aim = hkClampMallet(side, _hit.x - HOCKEY.at.x, _hit.z - HOCKEY.at.z);
  const now = performance.now(); if (now - hk.aimAt < 1000 / HOCKEY.hz) return; hk.aimAt = now;
  A.send({ t: "hm", x: hk.aim[0], z: hk.aim[1] });
}
function stepSeated() {
  const side = hkSide(), seat = hkSeat(side);
  me.p.set(seat.x, R, seat.z); me.v.set(0, 0, 0); me.grounded = true; me.facing = side ? Math.PI / 2 : -Math.PI / 2;
  near = { kind: "hockey" };
  const label = A.windowOpen() ? "" : hkPrompt(); const hp = $("hudPrompt"); if (hp.dataset.l !== label) { hp.dataset.l = label; hp.innerHTML = label; }
  A.setWhere("air hockey"); A.sendPos(me.p.x, me.p.y, me.p.z, me.facing, 0);
}
function drawScoreboard() {
  const B = scene.userData.board, h = hk.state; if (!B) return;
  B.sprite.visible = Boolean(h && h.phase !== "idle");
  if (!B.sprite.visible) return;
  const g = B.canvas.getContext("2d"), w = 1024, H = 200; g.clearRect(0, 0, w, H);
  g.fillStyle = "rgba(7,4,15,.82)"; g.beginPath(); g.roundRect(8, 8, w - 16, H - 16, 28); g.fill();
  g.lineWidth = 6; g.strokeStyle = "#ff2d95"; g.stroke();
  g.textBaseline = "middle"; g.font = "44px Bungee";
  const n0 = h.names[0] || "OPEN", n1 = h.names[1] || "OPEN";
  g.textAlign = "left"; g.fillStyle = "#ff7ac0"; g.fillText(n0.toUpperCase().slice(0, 14), 40, 70, 360);
  g.textAlign = "right"; g.fillStyle = "#7af0ff"; g.fillText(n1.toUpperCase().slice(0, 14), w - 40, 70, 360);
  g.textAlign = "center"; g.font = "84px Bungee"; g.fillStyle = "#ffd400"; g.fillText(`${h.score[0]} - ${h.score[1]}`, w / 2, 82);
  g.font = "600 32px Rubik"; g.fillStyle = "#b4a6d6";
  g.fillText(h.phase === "wait" ? "waiting for a challenger: walk up and press E" : h.phase === "over" ? (hk.last || "game over") : h.phase === "goal" ? "GOAL! ready…" : `first to ${HOCKEY.winTo}`, w / 2, 152);
  B.tex.needsUpdate = true;
}
function onHk(m) {
  const was = hk.state;
  hk.state = { seats: m.seats, names: m.names, score: m.score, phase: m.phase, until: m.until };
  if (m.s) { hk.prev = hk.s.slice(); hk.s = m.s; }
  if (m.top) { hk.top = m.top; setHockeyBoard(); }
  if (m.goal !== undefined) { Sfx.play("checkpoint"); A.notify(`<b>${esc(m.names[m.goal])}</b> scores! ${m.score[0]}–${m.score[1]}`, "🏒", "lime"); }
  if (m.winner !== undefined) { hk.last = `${m.names[m.winner]} wins ${m.score[m.winner]}-${m.score[1 - m.winner]}`; Sfx.play("finish", "gold"); if (A.me && m.seats[m.winner] === A.me.id) A.notify("You win! 🏆", "🏒", "gold"); }
  const mine = A.me && m.seats.includes(A.me.id), mineBefore = A.me && was?.seats.includes(A.me.id);
  if (mine && !mineBefore) { A.notify(m.phase === "wait" ? "You're at the table. Waiting for someone to play you…" : "Game on! Move the mouse to steer your mallet.", "🏒", "lime"); camYaw = hkSide() ? Math.PI / 2 : -Math.PI / 2; }
  if (!mine && mineBefore) { me.p.set(hkSeat(was.seats.indexOf(A.me.id)).x, R, HOCKEY.at.z + 1.6); }
  if (was?.phase === "wait" && m.phase === "goal" && mine) A.notify("Someone sat down. Game on!", "🏒", "lime");
  drawScoreboard();
}
function setHockeyBoard() {
  const i = BOARDS.findIndex((b) => b.key === "hockey");
  const bd = { key: "hockey", title: "AIR HOCKEY", unit: "MATCHES WON", col: COL.pink, rows: hk.top.map((r) => ({ name: r.name, n: r.wins, v: `${r.wins} WIN${r.wins === 1 ? "" : "S"}`, me: A.me && r.id === A.me.id })) };
  if (!bd.rows.length) return;
  if (i >= 0) BOARDS[i] = bd; else BOARDS.splice(2, 0, bd);
}
// the table drawn from the server's last two frames, eased so 30 updates a second look smooth
function stepHockey(dt) {
  const U = scene.userData; if (!A.online || !U.mallets) return;
  const k = Math.min(1, dt * 20), s = hk.s, side = hkSide();
  U.puck.position.x += (s[0] - U.puck.position.x) * k; U.puck.position.z += (s[1] - U.puck.position.z) * k; U.puck.position.y = 0.79;
  for (let i = 0; i < 2; i++) {
    const m = U.mallets[i];
    // your own mallet follows your hand straight away; the server's copy catches up
    const tx = i === side && hk.aim ? hk.aim[0] : s[2 + i * 2], tz = i === side && hk.aim ? hk.aim[1] : s[3 + i * 2];
    m.position.x += (tx - m.position.x) * (i === side ? Math.min(1, dt * 30) : k); m.position.z += (tz - m.position.z) * (i === side ? Math.min(1, dt * 30) : k);
  }
}

/* ------------------------------------------------------------------ input and movement */
const keys = {};
let dragId = null, camYaw = 0, camPitch = 0.42, dragging = false, lastX = 0, lastY = 0, jumpWas = false, near = null, entering = false;
addEventListener("keydown", (e) => {
  if (document.activeElement !== canvas || A.windowOpen()) return; Sfx.ensure(); keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyE" && near) use(near);
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener("pointerdown", (e) => { Sfx.ensure(); if (hkSide() >= 0) { hkAim(e); canvas.focus(); return; } dragging = true; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; canvas.focus(); });
addEventListener("pointerup", (e) => { if (e.pointerId === dragId) dragging = false; });
addEventListener("pointercancel", (e) => { if (e.pointerId === dragId) dragging = false; });
canvas.addEventListener("pointermove", (e) => { if (hkSide() >= 0) hkAim(e); });
addEventListener("pointermove", (e) => {
  if (!dragging || e.pointerId !== dragId) return; const k = settings.camSens;
  camYaw -= (e.clientX - lastX) * 0.006 * k; camPitch = clamp(camPitch + (e.clientY - lastY) * 0.004 * k * (settings.invertY ? -1 : 1), 0.05, 1.1); lastX = e.clientX; lastY = e.clientY;
});
$("hudPrompt").addEventListener("click", () => { if (near) use(near); });
let boardT = 8;
function setBoard(k) { boardIdx = k % BOARDS.length; boardMesh.material.map.dispose(); boardMesh.material.map = boardTex(BOARDS[boardIdx]); boardT = 8; }
function enterGame(gm) {
  if (entering) return; entering = true; Sfx.play("go");
  const el = $("enter"); el.hidden = false; el.style.setProperty("--g", HEX(gm.col)); el.querySelector("b").textContent = gm.name; el.querySelector("span").textContent = gm.open ? "INSERT COIN · LOADING" : "Not in the arcade yet: opening its mockup";
  setTimeout(() => { if (gm.room) A.go(gm.room); else location.href = gm.href; }, 600);
}
function use(n) {
  if (n.kind === "cab") enterGame(n.gm);
  else if (n.kind === "prizes") { A.openLook({ ...CLERK, line: pick(CLERK_LINES) }); Sfx.play("beep"); }
  else if (n.kind === "juke") A.openJukebox();
  else if (n.kind === "board") { setBoard(boardIdx + 1); Sfx.play("beep"); }
  else if (n.kind === "claw") A.notify(pick(["The claw grabs… and drops it. Classic.", "So close! It slipped.", "You won a plush! (On the site: a cosmetic.)"]), "🧸", "pink");
  else if (n.kind === "hockey") {
    if (!A.online) return A.notify("Air hockey needs the room server: it's for two real players.", "🏒", "lime");
    const h = hk.state; if (h && (h.phase === "play" || h.phase === "goal" || h.phase === "over")) return A.notify("The table's busy. Watch, and you've got next.", "🏒");
    A.send({ t: "hockey", op: "sit" });
  }
}
function step(dt) {
  if (hkSide() >= 0) return stepSeated();
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - tstate.y, s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + tstate.x;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let x = fx * f + rx * s, z = fz * f + rz * s; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  me.v.x += clamp(x * RUN - me.v.x, -ACC * dt, ACC * dt); me.v.z += clamp(z * RUN - me.v.z, -ACC * dt, ACC * dt);
  const jump = Boolean(keys.Space || tstate.jump); if (jump && !jumpWas && me.grounded) { me.v.y = JUMP; me.grounded = false; Sfx.play("jump"); } jumpWas = jump;
  if (l > 0.1) me.facing = Math.atan2(x, z) + Math.PI;
  me.v.y += G * dt; me.p.addScaledVector(me.v, dt);
  if (me.p.y <= R) { me.p.y = R; me.v.y = 0; me.grounded = true; }
  pushOut(me.p, R);
  near = null; let best = 1e9;
  const consider = (kind, x2, z2, rad, extra = {}) => { const d = Math.hypot(me.p.x - x2, me.p.z - z2); if (d < rad && d < best) { best = d; near = { kind, ...extra }; } };
  for (const c of cabs) consider("cab", c.x, c.z, 1.4, { gm: c.gm });
  consider("prizes", OUTFIT.x, OUTFIT.z, 2.6); consider("juke", JUKE.x + 1.3, JUKE.z, RADIO.reach - 0.4); consider("board", W - 3, BZ, 3.2); consider("claw", 11.5, 7.2, 1.6); consider("hockey", HOCKEY.at.x, HOCKEY.at.z, HOCKEY.reach - 0.3);
  const label = !near || A.windowOpen() ? "" : near.kind === "cab" ? (near.gm.open ? `<kbd>E</kbd> Play ${near.gm.name}` : `<kbd>E</kbd> ${near.gm.name} · coming soon`)
    : near.kind === "prizes" ? `<kbd>E</kbd> Talk to Sydney: change your look` : near.kind === "juke" ? `<kbd>E</kbd> Jukebox: pick the station` : near.kind === "board" ? `<kbd>E</kbd> Next board` : near.kind === "claw" ? `<kbd>E</kbd> Try the claw` : hkPrompt();
  const hp = $("hudPrompt"); if (hp.dataset.l !== label) { hp.dataset.l = label; hp.innerHTML = label; }
  A.setWhere(near ? (near.kind === "cab" ? `at ${near.gm.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}` : doing[near.kind] || "") : "");
  const sp = Math.hypot(me.v.x, me.v.z);
  A.sendPos(me.p.x, me.p.y, me.p.z, me.facing, !me.grounded ? 2 : sp > 0.6 ? 1 : 0);
}

/* ------------------------------------------------------------------ the frame */
const _cam = new V3(), _look = new V3(), _c = new THREE.Color();
let last = performance.now(), noteT = 5, chaseT = 0, chaseStep = 0, scrT = 0, scrPhase = 1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (!entering) step(dt);
  if (bots.length) stepBots(dt); else stepRemote(dt);
  stepHockey(dt);
  const g = me.mesh.g; g.position.set(me.p.x, me.p.y - R, me.p.z); let dy = me.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3;
  { const dx = me.p.x - clerk.g.position.x, dz = me.p.z - clerk.g.position.z, want = Math.hypot(dx, dz) < 6 ? Math.atan2(dx, dz) : Math.PI / 2;
    let d = want - clerk.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); clerk.g.rotation.y += d * Math.min(1, dt * 4); clerk.ch?.update(dt);
    if (!CALM) { clerkMark.position.y = 2.7 + Math.sin(t * 2.4) * 0.07; clerkMark.rotation.y = t * 1.5; } }
  const sp = Math.hypot(me.v.x, me.v.z); me.mesh.ch?.play(!me.grounded ? "jump" : sp > 0.6 ? "walk" : "idle"); me.mesh.ch?.update(dt);
  const ox = Math.sin(camYaw) * Math.cos(camPitch), oz = Math.cos(camYaw) * Math.cos(camPitch); let dist = 9;
  if (ox > 0.01) dist = Math.min(dist, (W - 0.5 - me.p.x) / ox); if (ox < -0.01) dist = Math.min(dist, (-W + 0.5 - me.p.x) / ox);
  if (oz > 0.01) dist = Math.min(dist, (D - 0.5 - me.p.z) / oz); if (oz < -0.01) dist = Math.min(dist, (-D + 0.5 - me.p.z) / oz);
  dist = Math.max(2.5, dist);
  _cam.set(me.p.x + ox * dist, me.p.y + 1.4 + Math.sin(camPitch) * dist, me.p.z + oz * dist);
  if (hkSide() >= 0) { const sd = hkSide() ? 1 : -1; _cam.set(HOCKEY.at.x + sd * 2.9, 2.35, HOCKEY.at.z); _look.set(HOCKEY.at.x - sd * 0.25, 0.7, HOCKEY.at.z); }
  else _look.set(me.p.x, me.p.y + 1.1, me.p.z);
  camera.position.lerp(_cam, 0.15); camera.lookAt(_look);

  // the lights. The LED colour runs slowly round the room; the bulbs chase at 3 steps a second (no faster: photosensitivity)
  if (!CALM) {
    for (const L of leds) L.m.material.color.setHSL((((L.u * 0.035 - t * 0.08) % 1) + 1) % 1, 1, LED_L);
    for (const S of spots) S.s.target.position.set(Math.sin(t * 0.35 + S.ph) * 9, 0, Math.cos(t * 0.27 + S.ph * 1.3) * 6 + 1);
    chaseT += dt; if (chaseT > 1 / 3) { chaseT = 0; chaseStep++; for (let k = 0; k < bulbPos.length; k++) bulbs.setColorAt(k, (k + chaseStep) % 3 === 0 ? BULB_ON : BULB_OFF); bulbs.instanceColor.needsUpdate = true; }
    signLight.intensity = 7 + Math.sin(t * 1.3) * 1.2;
    const puck = scene.userData.puck; if (puck && bots.length) puck.position.set(Math.sin(t * 2.1) * 1.05, 0.79, Math.sin(t * 3.3) * 0.5);
    const claw = scene.userData.claw; if (claw) claw.position.set(Math.sin(t * 0.6) * 0.45, 2.05, Math.cos(t * 0.45) * 0.45);
    scrT += dt; if (scrT > 0.6) { scrT = 0; scrPhase ^= 1; const c = cabs[0]; c.scr.material.map.dispose(); c.scr.material.map = screenTex(c.gm, scrPhase); }
    // the jukebox's tubes breathe while a station is on
    const on = Boolean(A.radio), k = on ? 0.75 + Math.sin(t * 4) * 0.25 : 0.35;
    jukeLights.forEach((m, i) => { if (m.isLight) m.intensity = on ? 3 + Math.sin(t * 4) * 1.5 : 1.5; else m.material.color.set(i === 0 ? COL.orange : COL.pink).multiplyScalar(0.62 * k); });
  } else for (const L of leds) L.m.material.color.setHSL((L.u * 0.035) % 1, 1, LED_L);
  boardT -= dt; if (boardT <= 0) setBoard(boardIdx + 1);

  // offline only: pretend notices from around the arcade (live, these ride the bell's existing request)
  if (bots.length) { noteT -= dt; if (noteT <= 0) { noteT = rnd(12, 20); const o = pick(bots); const n = Math.floor(Math.random() * 4);
    A.notify([`<b>${o.name}</b> reached floor ${Math.floor(rnd(40, 99))} of The Climb`, `<b>${o.name}</b> rang the bell at the top! 👑`, `Your Climb record was beaten by <b>${o.name}</b>`, `<b>${o.name}</b> caught a Golden Trophy Bass`][n], ["🧗", "🔔", "⚠️", "🎣"][n], ["", "gold", "pink", "lime"][n]); } }
  composer.render();
  requestAnimationFrame(frame);
}
renderOnline();
$("loadStat").textContent = `opened in ${loadMs} ms`;
canvas.focus();
requestAnimationFrame(frame);
window.__lounge = { me, A, remote, clerk, camera, get bots() { return bots; }, cabs, use, setBoard, cam: (y, p) => { camYaw = y; camPitch = p; } };

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
import * as Arcade from "../arcade-kit/arcade.js?v=10";
import { CHARS, CHAR_NAMES, HATS, RADIO, HOCKEY, hkSeat, hkClampMallet } from "/v3/assets/js/arcade-rules.js?v=3";
import { openTable } from "../poker3d-mock/table.js?v=2";
import { buildExtras } from "./extras.js?v=18";

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const G = -26, JUMP = 9.4, RUN = 6.4, ACC = 40, R = 0.45;
/* SLIDE-HOP (2026-10-07, the owner: "users can shift key to slide hop and pick up speed", everywhere in the lounge). Shift while running
   drops you into a slide: a small kick (`start`), then it bleeds speed slowly (`decay`, much faster once it's gone on past `long`). Jump
   out of a slide and you keep the speed plus `hop`; in the air you keep it and can steer. Slide again within `window` of landing and the
   kick is bigger (`perfect`): chaining slide, hop, slide on the beat is how you go fast (about 14 m/s, against a run of 6.4); a sloppy
   chain settles near 7 (tight timing holds ~13.5, decent ~11.5: tools/lounge3d-mock had a scratch sim of this). On the ground without a slide, speed over a run drains at `drain` per second. `cd` stops Shift-mashing on the
   spot from adding speed: the kick only comes back after that long out of a slide, and the drain eats more than it gives. */
const SL = { min: 3, start: 0.9, perfect: 1.1, window: 0.3, decay: 0.35, long: 1.4, hop: 0.4, max: 15, steer: 1.8, airSteer: 2.6, drain: 5, cd: 0.5 };
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
const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 330);   // far enough for the sky dome and the stadium
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* LIGHTS ARE A BUDGET (2026-10-07, the owner: "thinking ahead for users with not so great computers"). Every real light is worked out for
   every pixel of every frame, so the lounge keeps few of them: the neon look is things that glow by themselves (tubes, signs, the carpet)
   plus the bloom pass, not lights. The ones kept are registered with a rank; the quality setting decides how many are on:
   high = all (13), medium = rank 1-2 (9), low = rank 1 (3) with no shadows and no bloom. The sky light rises as lights go off, so a low
   setting is dimmer in the corners but never dark. "auto" (the default) measures the first seconds of frames and steps down if needed. */
const LIGHTS = [];
const keep = (l, rank) => { LIGHTS.push({ l, rank, base: l.intensity }); return l; };
const sky = new THREE.HemisphereLight(0x7a6ab0, 0x2a1630, 0.75); scene.add(sky);
const key = new THREE.DirectionalLight(0xd8c8ff, 0.5); key.position.set(4, 16, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14 }); scene.add(key);

const W = 15, D = 11, WALL_H = 6;
/* THE POKER ROOM IS PART OF THE LOUNGE (2026-10-07, the owner: "an open door from the lounge room, where users can just see in/walk in without
   having to open a door. This gives it a more social feeling"). The south wall has an 8 m arch (x OX0..OX1, OPEN_H tall) straight into a
   warmer annex (x AX0..AX1, z D..AZ1) with three ticket sit & gos. Same page, same scene, same room on the server: walking in is walking. */
const OX0 = -12, OX1 = -4, OPEN_H = 4, AX0 = -14.5, AX1 = -1.5, AZ1 = D + 11;
// (2026-10-07) two more open rooms, built in extras.js: the bar games corner through the south wall, the patio through the east wall
const BO0 = 8.2, BO1 = 14.2, BOH = 4, PO0 = -10.6, PO1 = -5.8, POH = 3.6;
/* where you can walk (boxes: [x0, x1, z0, z1], shrunk by your radius when used), the rooms the camera keeps inside, and extra rules
   (the pond). extras.js adds its rooms to these. */
const WALK = [], REGIONS = [{ name: "lounge", x0: -W, x1: W, z0: -D, z1: D, ceil: WALL_H }, { name: "poker", x0: AX0, x1: AX1, z0: D, z1: AZ1, ceil: 5 }], HOOKS = [];
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
box(2 * W + 0.6, WALL_H, 0.3, wallMat, 0, WALL_H / 2, -D - 0.15);
// the south wall, in three pieces round the arch
box(OX0 + W + 0.3, WALL_H, 0.3, wallMat, (-W - 0.3 + OX0) / 2, WALL_H / 2, D + 0.15);
box(BO0 - OX1, WALL_H, 0.3, wallMat, (OX1 + BO0) / 2, WALL_H / 2, D + 0.15);
box(W + 0.3 - BO1, WALL_H, 0.3, wallMat, (BO1 + W + 0.3) / 2, WALL_H / 2, D + 0.15);
box(BO1 - BO0, WALL_H - BOH, 0.3, wallMat, (BO0 + BO1) / 2, BOH + (WALL_H - BOH) / 2, D + 0.15);
box(OX1 - OX0, WALL_H - OPEN_H, 0.3, wallMat, (OX0 + OX1) / 2, OPEN_H + (WALL_H - OPEN_H) / 2, D + 0.15);
box(0.3, WALL_H, 2 * D, wallMat, -W - 0.15, WALL_H / 2, 0);
// the east wall, round the patio doors
box(0.3, WALL_H, PO0 + D, wallMat, W + 0.15, WALL_H / 2, (-D + PO0) / 2); box(0.3, WALL_H, D - PO1, wallMat, W + 0.15, WALL_H / 2, (PO1 + D) / 2);
box(0.3, WALL_H - POH, PO1 - PO0, wallMat, W + 0.15, POH + (WALL_H - POH) / 2, (PO0 + PO1) / 2);
const leds = [];
{
  const SEG = 1.5; let run = 0;
  const edge = (ax, az, bx, bz, nx, nz, skip) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / SEG);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, x = ax + (bx - ax) * f + nx * 0.02, z = az + (bz - az) * f + nz * 0.02;
      for (const y of [0.18, 5.2]) {
        if (y < 1 && skip?.(x, z)) continue;   // no strip across the arch's floor
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(nx) ? 0.05 : SEG - 0.08, 0.05, Math.abs(nz) ? 0.05 : SEG - 0.08), basic(0xffffff)); m.position.set(x, y, z); scene.add(m);
        leds.push({ m, u: run + i });
      }
    }
    run += n;
  };
  edge(-W, -D, W, -D, 0, 1); edge(W, -D, W, D, -1, 0, (x, z) => z > PO0 && z < PO1); edge(W, D, -W, D, 0, -1, (x) => (x > OX0 && x < OX1) || (x > BO0 && x < BO1)); edge(-W, D, -W, -D, 1, 0);
}
for (const [x, z, c] of [[-W + 0.05, -6, COL.cyan], [-W + 0.05, 9, COL.pink], [W - 0.05, 8.5, COL.purple]]) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 4.2, 8), tube(c)); t.position.set(x, 2.8, z); scene.add(t);
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
const signLight = keep(new THREE.PointLight(COL.pink, 8, 12, 1.6), 2); signLight.position.set(0, 4.4, -D + 1.6); scene.add(signLight);

/* ---- CEILINGS (2026-10-07: the patio's sky showed through the open tops of the rooms). Dark, one-sided (facing down): from inside you see a
   ceiling; the follow camera stays under it (REGIONS.ceil). */
function ceiling(x0, x1, z0, z1, y, col = 0x0a0614) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ color: col, roughness: 1 }));
  m.rotation.x = Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(m); return m;
}
ceiling(-W - 0.3, W + 0.3, -D - 0.3, D + 0.3, WALL_H);
ceiling(AX0 - 0.3, AX1 + 0.3, D, AZ1 + 0.3, 5, 0x120610);

/* ---- sweeping coloured spots from above */
const spots = [COL.pink, COL.cyan, COL.purple].map((c, i) => {
  const s = keep(new THREE.SpotLight(c, 50, 26, 0.32, 0.6, 1.2), 3); s.position.set(-8 + i * 8, WALL_H - 0.2, 1); scene.add(s); scene.add(s.target);
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
  if (gm.open) { const glow = keep(new THREE.PointLight(gm.col, 7, 5, 1.8), 1); glow.position.set(0, 1.6, 1.3); g.add(glow); }   // only a working cabinet lights the floor
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
const boardLight = keep(new THREE.PointLight(COL.yellow, 6, 10, 1.6), 2); boardLight.position.set(W - 2, 3, BZ); scene.add(boardLight);

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
  const l = keep(new THREE.PointLight(COL.lime, 5, 8, 1.6), 2); l.position.set(-W + 2.5, 3, 4.5); scene.add(l);
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
  const l = keep(new THREE.PointLight(COL.orange, 5, 6, 1.8), 2); l.position.set(0.9, 1.6, 0); juke.add(l); jukeLights.push(l);
  block(JUKE.x + 0.1, JUKE.z, 1.0, 1.6);
}
/* ---- THE POKER ROOM, through the arch: darker carpet, burgundy walls with a gold rail, three tables under hanging lamps */
const PK = { tables: [] };
{
  const tex = canvasTex(1024, 1024, (g) => { if (carpetImg) g.drawImage(carpetImg, 0, 0, 1024, 1024); g.fillStyle = "rgba(40,4,16,.5)"; g.fillRect(0, 0, 1024, 1024); });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((AX1 - AX0) / 4, (AZ1 - D) / 4);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(AX1 - AX0, AZ1 - D), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.16, roughness: 0.95 }));
  f.rotation.x = -Math.PI / 2; f.position.set((AX0 + AX1) / 2, 0.001, (D + AZ1) / 2); f.receiveShadow = true; scene.add(f);
  const red = std(0x1a0812, { roughness: 0.9 }), gold = std(0xc9962a, { metalness: 0.7, roughness: 0.35 }), H = 5, L = AZ1 - D;
  box(0.3, H, L, red, AX0 - 0.15, H / 2, (D + AZ1) / 2); box(0.3, H, L, red, AX1 + 0.15, H / 2, (D + AZ1) / 2); box(AX1 - AX0 + 0.6, H, 0.3, red, (AX0 + AX1) / 2, H / 2, AZ1 + 0.15);
  box(0.06, 0.08, L, gold, AX0 + 0.04, 1.1, (D + AZ1) / 2); box(0.06, 0.08, L, gold, AX1 - 0.04, 1.1, (D + AZ1) / 2); box(AX1 - AX0, 0.08, 0.06, gold, (AX0 + AX1) / 2, 1.1, AZ1 - 0.04);
  for (const [w, d, x, z] of [[0.05, L, AX0 + 0.04, (D + AZ1) / 2], [0.05, L, AX1 - 0.04, (D + AZ1) / 2], [AX1 - AX0, 0.05, (AX0 + AX1) / 2, AZ1 - 0.04]]) box(w, 0.05, d, tube(COL.red, 0.45), x, 4.3, z);
  // the arch: neon posts and a beam, and its name over it on the lounge side
  for (const x of [OX0, OX1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, OPEN_H, 10), tube(COL.red)); t.position.set(x, OPEN_H / 2, D); scene.add(t); }
  { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, OX1 - OX0, 10), tube(COL.red)); t.rotation.z = Math.PI / 2; t.position.set((OX0 + OX1) / 2, OPEN_H, D); scene.add(t); }
  const st = canvasTex(1024, 180, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "120px Monoton"; g.shadowBlur = 22; g.shadowColor = "#ff3b4e"; g.fillStyle = "#ffd0d8"; g.fillText("POKER ROOM", w / 2, h / 2 + 6); });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.05), basic(0xffffff, { map: st, transparent: true })); sg.position.set((OX0 + OX1) / 2, OPEN_H + 0.95, D - 0.02); sg.rotation.y = Math.PI; scene.add(sg);
  const pt = canvasTex(1024, 220, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "180px Monoton"; g.shadowBlur = 24; g.shadowColor = "#ff3b4e"; g.fillStyle = "#ffd0d8"; g.fillText("POKER", w / 2, h / 2 + 8); });
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.15), basic(0xffffff, { map: pt, transparent: true })); ps.position.set((AX0 + AX1) / 2, 3.7, AZ1 - 0.05); ps.rotation.y = Math.PI; scene.add(ps);
  const l = keep(new THREE.PointLight(COL.red, 6, 10, 1.6), 3); l.position.set((AX0 + AX1) / 2, 3.4, AZ1 - 1.4); scene.add(l);
}
/* every table takes TICKETS (the owner: "all lounge games/poker/etc will need to take tickets"): ZCoins become tickets at the cashier */
// (the owner, same evening: "there should only be one poker table in the room for now, for tickets only") more tables and games come later
const SNGS = [
  { key: "tix", name: "SIT & GO · 500", sub: "500 🎟️ buy-in · pays 1,950 / 1,050", buyIn: 500, col: COL.pink, at: [-8, 16] }
];
for (const sng of SNGS) {
  const g = new THREE.Group(); g.position.set(sng.at[0], 0, sng.at[1]); scene.add(g);
  const felt = canvasTex(512, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, "#1f7a55"); gr.addColorStop(1, "#0b3a28"); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 4; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.36, h * 0.3, 0, 0, 7); c.stroke(); });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 40), [std(0x2a1220), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 }), std(0x2a1220)]);
  top.scale.set(1.55, 1, 0.95); top.position.y = 0.82; top.castShadow = top.receiveShadow = true; g.add(top);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 60), tube(sng.col, 0.55)); rail.rotation.x = Math.PI / 2; rail.scale.set(1.57, 0.97, 1); rail.position.y = 0.87; g.add(rail);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 0.8, 16), std(0x140810)); base.position.y = 0.4; g.add(base);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 2; const stl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.62, 14), std(0x3a1424, { roughness: 0.5 })); stl.position.set(Math.cos(a) * 2.05, 0.31, Math.sin(a) * 1.3); stl.castShadow = true; g.add(stl); }
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24, 1, true), std(0x101010, { side: THREE.DoubleSide, metalness: 0.5 })); shade.position.y = 3.0; g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), basic(0xffe6b0)); bulb.position.y = 2.8; g.add(bulb);
  const lamp = keep(new THREE.SpotLight(0xffd9a0, 40, 6, 0.75, 0.6, 1.4), 1); lamp.position.set(0, 2.85, 0); lamp.target.position.set(0, 0.8, 0); g.add(lamp); g.add(lamp.target);
  const t = canvasTex(1024, 260, (c, w, h) => { c.fillStyle = "rgba(7,4,15,.85)"; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 30); c.fill(); c.lineWidth = 6; c.strokeStyle = HEX(sng.col); c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = "78px Bungee"; c.fillStyle = "#fff"; c.shadowColor = HEX(sng.col); c.shadowBlur = 18; c.fillText(sng.name, w / 2, 100); c.shadowBlur = 0; c.font = "600 40px Rubik"; c.fillStyle = "#cdbfe8"; c.fillText(sng.sub, w / 2, 190); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(3.1, 0.79, 1); sp.position.y = 3.6; sp.renderOrder = 6; g.add(sp);
  for (let k = 0; k < 5; k++) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02 + Math.random() * 0.05, 14), std(pick([0xff2d95, 0x19e3ff, 0xffd400, 0xffffff]))); ch.position.set(rnd(-0.6, 0.6), 0.88, rnd(-0.3, 0.3)); g.add(ch); }
  block(sng.at[0], sng.at[1], 3.4, 2.2);
  PK.tables.push({ s: sng, g, at: new V3(sng.at[0], 0, sng.at[1]), seated: [] });
}
/* ---- THE POKER ROOM'S OWN LIGHT (2026-10-07, the owner: "some lighting differentiator in the poker room, like a floor lamp... that fits the
   poker mood"). The lounge is neon; in here it's warm and low: two standing lamps in the back corners with amber fabric shades, brass
   sconces down the side walls, and a faint haze that hangs in the lamplight. */
const haze = [];
{
  const brass = std(0xb8892a, { metalness: 0.75, roughness: 0.35 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xffb860, emissive: 0xff9a40, emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  for (const [x, z] of [[AX0 + 0.85, AZ1 - 0.85], [AX1 - 0.85, AZ1 - 0.85]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 20), brass); base.position.set(x, 0.025, z); scene.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.75, 10), brass); pole.position.set(x, 0.9, z); scene.add(pole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.42, 24, 1, true), shadeMat); shade.position.set(x, 1.86, z); scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), basic(0xfff0c8)); bulb.position.set(x, 1.8, z); scene.add(bulb);
    const l = keep(new THREE.PointLight(0xffa850, 7, 7, 1.6), 2); l.position.set(x, 1.85, z); scene.add(l);
    block(x, z, 0.5, 0.5);
  }
  // sconces: a brass cup on the wall throwing light up it
  for (const [x, z, ry] of [[AX0 + 0.04, D + 3.2, Math.PI / 2], [AX0 + 0.04, D + 8.5, Math.PI / 2], [AX1 - 0.04, D + 3.2, -Math.PI / 2], [AX1 - 0.04, D + 8.5, -Math.PI / 2]]) {
    const g = new THREE.Group(); g.position.set(x, 2.3, z); g.rotation.y = ry; scene.add(g);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.07, 0.22, 16, 1, true), brass); cup.position.z = 0.12; g.add(cup);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h * 0.75, 2, w / 2, h * 0.7, h * 0.7); gr.addColorStop(0, "rgba(255,190,110,.55)"); gr.addColorStop(1, "rgba(255,190,110,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, 0.35, 0.02); g.add(glow);   // drawn glow only: no light of its own (every point light costs on every pixel, and the lounge has ~25)
  }
  // the haze: a few soft sprites drifting slowly in the warm light
  const hz = canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,200,150,.5)"); gr.addColorStop(1, "rgba(255,200,150,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  for (let k = 0; k < 5; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hz, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(rnd(3.5, 5.5)); sp.position.set(rnd(AX0 + 2, AX1 - 2), rnd(1.6, 2.8), rnd(D + 2, AZ1 - 2)); scene.add(sp); haze.push({ sp, ph: rnd(0, 6), x: sp.position.x, z: sp.position.z });
  }
}

/* ---- ON THE WALLS (the owner: "some funny, sport adjacent artwork on the walls. just a few"). Drawn here, framed, five of them: two in the
   poker room, three in the lounge. No real teams, logos or people. */
function poster(w, h, draw, frame = 0x1a1208) {
  const g = new THREE.Group();
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), std(frame, { roughness: 0.5, metalness: 0.2 })); g.add(fr);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(Math.round(512 * w / h), 512, draw), roughness: 0.8 })); art.position.z = 0.032; g.add(art);
  scene.add(g); return g;
}
const hang = (g, x, y, z, ry) => { g.position.set(x, y, z); g.rotation.y = ry; };
const font = (px, face = "Bungee", wt = "") => `${wt} ${px}px ${face}`.trim();
// 1. REFS PLAYING POKER (poker room, west wall): the dogs-playing-poker painting, with referees
hang(poster(2.2, 1.5, (c, w, h) => {
  c.fillStyle = "#3a2410"; c.fillRect(0, 0, w, h); const gr = c.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.5, w * 0.6); gr.addColorStop(0, "rgba(255,200,120,.45)"); gr.addColorStop(1, "rgba(0,0,0,.4)"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = "#1d5a38"; c.beginPath(); c.ellipse(w / 2, h * 0.68, w * 0.38, h * 0.16, 0, 0, 7); c.fill();
  for (let i = 0; i < 4; i++) { const x = w * (0.2 + i * 0.2), y = h * 0.46;
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? "#111" : "#f2f2f2"; c.fillRect(x - 36 + k * 12, y, 12, 70); }
    c.fillStyle = "#e8b48a"; c.beginPath(); c.arc(x, y - 22, 26, 0, 7); c.fill(); c.fillStyle = "#111"; c.fillRect(x - 26, y - 46, 52, 12);
    c.fillStyle = "#fff"; c.fillRect(x - 10 + (i % 2) * 14, y + 76, 16, 22); }
  c.strokeStyle = "#c9a227"; c.lineWidth = 3; c.beginPath(); c.arc(w * 0.6, h * 0.36, 8, 0, 7); c.stroke();
  c.fillStyle = "#f5e6c0"; c.font = font(34); c.textAlign = "center"; c.fillText("REFS PLAYING POKER", w / 2, h * 0.93);
  c.font = font(18, "Rubik", "600"); c.fillStyle = "#cdb88a"; c.fillText("(all four called it a fold before the flop)", w / 2, h * 0.985);
}, 0x5a3a12), AX0 + 0.05, 2.5, D + 5.9, Math.PI / 2);
// 2. BAD BEAT HALL OF FAME (poker room, east wall)
hang(poster(1.3, 1.6, (c, w, h) => {
  c.fillStyle = "#0e2a1c"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a227"; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28);
  c.textAlign = "center"; c.fillStyle = "#ffd400"; c.font = font(36); c.fillText("BAD BEAT", w / 2, 78); c.fillText("HALL OF FAME", w / 2, 120);
  const card = (x, y, r, s, col) => { c.fillStyle = "#fbf8ff"; c.fillRect(x, y, 110, 156); c.fillStyle = col; c.font = font(64); c.fillText(r, x + 55, y + 80); c.font = font(56, "serif"); c.fillText(s, x + 55, y + 138); };
  card(w / 2 - 122, 170, "7", "♣", "#13a04a"); card(w / 2 + 12, 170, "2", "♦", "#1f6fe0");
  c.fillStyle = "#f4ecff"; c.font = font(22, "Rubik", "600"); c.fillText("Beat a full house on the river.", w / 2, 380); c.fillText("We don't talk about it.", w / 2, 410);
  c.font = font(18, "Rubik", "600"); c.fillStyle = "#9fbfa8"; c.fillText("— table 1, a Tuesday", w / 2, 455);
}, 0x2a1a0a), AX1 - 0.05, 2.5, D + 5.9, -Math.PI / 2);
// 3. a motivational poster (lounge, east wall)
hang(poster(1.3, 1.65, (c, w, h) => {
  c.fillStyle = "#050505"; c.fillRect(0, 0, w, h);
  const gr = c.createLinearGradient(0, 30, 0, 330); gr.addColorStop(0, "#ff8a3d"); gr.addColorStop(1, "#5a1a4a"); c.fillStyle = gr; c.fillRect(30, 30, w - 60, 300);
  c.fillStyle = "#1a2a12"; c.fillRect(30, 270, w - 60, 60);
  c.fillStyle = "#7a3d18"; c.beginPath(); c.ellipse(w / 2, 240, 60, 34, -0.5, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2 - 20, 232); c.lineTo(w / 2 + 20, 248); c.stroke();
  c.fillStyle = "#e0e0e0"; c.fillRect(w / 2 - 4, 270, 8, 30);
  c.textAlign = "center"; c.fillStyle = "#fff"; c.font = font(46, "Georgia, serif"); c.fillText("PATIENCE", w / 2, 395);
  c.font = font(19, "Rubik", "500"); c.fillStyle = "#cfcfcf"; c.fillText("Waiting three hours for the fourth", w / 2, 438); c.fillText("quarter of a one o'clock game.", w / 2, 464);
}, 0x050505), W - 0.05, 2.6, 6.2, -Math.PI / 2);
// 4. WANTED (lounge, south wall, east of the cashier)
hang(poster(1.2, 1.55, (c, w, h) => {
  c.fillStyle = "#e9d6a8"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(120,80,30,.15)"; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 20, 2);
  c.textAlign = "center"; c.fillStyle = "#3a2410"; c.font = font(68, "Georgia, serif", "bold"); c.fillText("WANTED", w / 2, 92);
  c.fillStyle = "#5a3a1a"; c.beginPath(); c.arc(w / 2, 200, 62, 0, 7); c.fill(); c.fillRect(w / 2 - 90, 250, 180, 70);
  c.fillStyle = "#e9d6a8"; c.font = font(60, "Georgia, serif", "bold"); c.fillText("?", w / 2, 222);
  c.fillStyle = "#3a2410"; c.font = font(21, "Georgia, serif", "bold"); c.fillText("WHOEVER LEFT NACHOS", w / 2, 362); c.fillText("ON THE AIR HOCKEY TABLE", w / 2, 390);
  c.font = font(30, "Georgia, serif", "bold"); c.fillText("REWARD: 500 TICKETS", w / 2, 450);
}, 0x3a2410), 7.25, 2.7, D - 0.05, Math.PI);
// 5. EMPLOYEE OF THE MONTH (lounge, west wall, by the cabinets): The Climb's mace
hang(poster(1.2, 1.5, (c, w, h) => {
  c.fillStyle = "#f3efe6"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a227"; c.lineWidth = 10; c.strokeRect(18, 18, w - 36, h - 36);
  c.textAlign = "center"; c.fillStyle = "#1a1a2a"; c.font = font(30); c.fillText("EMPLOYEE", w / 2, 80); c.fillText("OF THE MONTH", w / 2, 118);
  c.fillStyle = "#6a6a78"; c.beginPath(); c.arc(w / 2, 240, 70, 0, 7); c.fill();
  c.fillStyle = "#9a9aa8"; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 64, 240 + Math.sin(a) * 64); c.lineTo(w / 2 + Math.cos(a + 0.18) * 100, 240 + Math.sin(a + 0.18) * 100); c.lineTo(w / 2 + Math.cos(a + 0.36) * 64, 240 + Math.sin(a + 0.36) * 64); c.fill(); }
  c.fillStyle = "#111"; c.beginPath(); c.arc(w / 2 - 22, 228, 7, 0, 7); c.arc(w / 2 + 22, 228, 7, 0, 7); c.fill(); c.strokeStyle = "#111"; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, 248, 26, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = "#1a1a2a"; c.font = font(28); c.fillText("THE MACE", w / 2, 380);
  c.font = font(19, "Rubik", "600"); c.fillStyle = "#555"; c.fillText("The Chain Hall · 4,112 knockdowns", w / 2, 414); c.fillText("\"Never misses a shift.\"", w / 2, 444);
}, 0x2a2a3a), -W + 0.05, 3.75, -9.2, Math.PI / 2);

/* ---- THE CASHIER, in the main room against the south wall (the owner: "ticket guy / cashier should be in the main lounge room"):
   ZCoins buy tickets, tickets cash out to ZCoins at EastScape's rate and limit. One ticket wallet, shared with EastScape. */
const CAGE = new V3(4, 0, 9.85), CAGE_AT = new V3(4, 0, 8.4);
{
  const gold = std(0xc9962a, { metalness: 0.7, roughness: 0.35 });
  box(5, 1.1, 0.9, std(0x2a1220, { roughness: 0.5 }), CAGE.x, 0.55, CAGE.z); box(5.1, 0.08, 1.0, gold, CAGE.x, 1.14, CAGE.z);
  for (let k = 0; k < 21; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), gold); bar.position.set(CAGE.x - 2.45 + k * 0.245, 1.95, CAGE.z - 0.42); scene.add(bar); }
  box(5.1, 0.1, 0.08, gold, CAGE.x, 2.78, CAGE.z - 0.42);
  const t = canvasTex(1024, 220, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "150px Monoton"; g.shadowBlur = 22; g.shadowColor = "#ffd400"; g.fillStyle = "#fff3c4"; g.fillText("CASHIER", w / 2, h / 2 + 8); });
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.78), basic(0xffffff, { map: t, transparent: true })); cs.position.set(CAGE.x, 3.55, D - 0.02); cs.rotation.y = Math.PI; scene.add(cs);
  const t2 = canvasTex(1024, 110, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "600 46px Rubik"; g.fillStyle = "#e8dcc0"; g.fillText("1 ZC = 1,000 TICKETS  ·  CASH OUT 100 ZC A DAY", w / 2, h / 2 + 4, w - 40); });
  const cs2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.43), basic(0xffffff, { map: t2, transparent: true })); cs2.position.set(CAGE.x, 3.0, D - 0.02); cs2.rotation.y = Math.PI; scene.add(cs2);
  const l = keep(new THREE.PointLight(COL.yellow, 5, 6, 1.6), 1); l.position.set(CAGE.x, 2.4, CAGE.z - 1.6); scene.add(l);
  block(CAGE.x, CAGE.z + 0.2, 5.1, 1.4);
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
  const cm = new THREE.Group(); cm.position.set(-13.3, 0, -8.7); cm.rotation.y = -Math.PI / 2; scene.add(cm);   // (moved out of the bar games doorway)
  box(1.6, 0.9, 1.6, std(COL.pink, { emissive: COL.pink, emissiveIntensity: 0.18 }), 0, 0.45, 0, cm);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.5), new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.15, roughness: 0.05 })); glass.position.y = 1.6; cm.add(glass);
  box(1.6, 0.35, 1.6, std(0x241a44), 0, 2.48, 0, cm);
  const ct = canvasTex(512, 110, (g, w, h) => { g.fillStyle = "#d02478"; g.fillRect(0, 0, w, h); g.textAlign = "center"; g.textBaseline = "middle"; g.font = "74px Bungee"; g.fillStyle = "#fff"; g.fillText("CLAW", w / 2, h / 2 + 4); });
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), basic(0xdddddd, { map: ct })); cs.position.set(0, 2.48, -0.81); cs.rotation.y = Math.PI; cm.add(cs);
  for (let k = 0; k < 14; k++) { const c = pick(Object.values(COL)); const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std(c, { emissive: c, emissiveIntensity: 0.15 })); p.position.set(rnd(-0.55, 0.55), 1.05 + rnd(0, 0.25), rnd(-0.55, 0.55)); cm.add(p); }
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 3), std(0xdddddd, { metalness: 0.8, roughness: 0.3 })); claw.position.set(0, 2.05, 0); claw.rotation.x = Math.PI; cm.add(claw); scene.userData.claw = claw;

  block(-13.3, -8.7, 1.7, 1.7);
  for (const [tx, tz, c] of [[-7.5, 1.5, COL.cyan], [-2.5, 8.2, COL.orange], [9.5, 6, COL.lime]]) {
    const top2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.07, 28), std(0x241a44, { roughness: 0.3 })); top2.position.set(tx, 1.0, tz); top2.castShadow = true; scene.add(top2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.022, 6, 40), tube(c)); ring.rotation.x = Math.PI / 2; ring.position.set(tx, 1.0, tz); scene.add(ring);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.25, 1.0, 12), std(0x15102a)); leg.position.set(tx, 0.5, tz); scene.add(leg);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4, st = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.7, 14), std(c, { emissive: c, emissiveIntensity: 0.12 })); st.position.set(tx + Math.cos(a) * 1.25, 0.35, tz + Math.sin(a) * 1.25); st.castShadow = true; scene.add(st); }

    block(tx, tz, 1.6, 1.6);
  }
}

/* ---- TWO PLANTS (2026-10-07, the owner: "lets add 1-2 plants around the lounge"): a snake plant by the patio doors and a potted palm in
   the corner by the poker room's arch, both in glossy black pots with a neon ring. */
{
  const pot = (x, z, ring) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 20), std(0x111116, { roughness: 0.25, metalness: 0.3 })); p.position.set(x, 0.275, z); p.castShadow = p.receiveShadow = true; scene.add(p);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.018, 6, 28), tube(ring)); r.rotation.x = Math.PI / 2; r.position.set(x, 0.5, z); scene.add(r);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.29, 18), std(0x2a1a10, { roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.set(x, 0.53, z); scene.add(soil); block(x, z, 0.7, 0.7); };
  // the snake plant: tall sword leaves, dark green with lighter edges
  { const x = 14.1, z = -5.0; pot(x, z, COL.lime); const leafM = [std(0x2f6a34, { roughness: 0.6 }), std(0x3f7f3a, { roughness: 0.6 }), std(0x56903c, { roughness: 0.6 })];
    for (let k = 0; k < 11; k++) { const h = rnd(0.7, 1.3), a = (k / 11) * Math.PI * 2 + rnd(-0.2, 0.2), rr = rnd(0.02, 0.16);
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.075, h, 4), pick(leafM)); lf.scale.z = 0.25; lf.position.set(x + Math.cos(a) * rr, 0.53 + h / 2, z + Math.sin(a) * rr); lf.rotation.set(Math.sin(a) * 0.18, a, Math.cos(a) * 0.18); lf.castShadow = true; scene.add(lf); } }
  // the palm: a short trunk and arching fronds
  { const x = -13.9, z = 9.9; pot(x, z, COL.pink); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 8), std(0x6a4a2a, { roughness: 0.9 })); trunk.position.set(x, 1.08, z); trunk.castShadow = true; scene.add(trunk);
    const frondM = std(0x2f7a3a, { roughness: 0.7 });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, g = new THREE.Group(); g.position.set(x, 1.6, z); g.rotation.y = a; scene.add(g);
      const fr = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), frondM); fr.scale.set(0.16, 0.035, 1); fr.position.set(0, -0.12, 0.42); fr.rotation.x = 0.45; fr.castShadow = true; g.add(fr); } }
}

/* ---- LIVED IN (the owner: "a few items on the ground... that make the lounge feel somewhat lived in. Beer, popcorn, etc"): bottles and
   cans on the tables, popcorn buckets (and some that missed), solo cups, a pizza box, a foam finger on a stool, a bin that needs emptying. */
{
  const glass = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
  const add = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; m.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(m); return m; };
  function bottle(col = 0x6a3a0a, label = 0xe8d27a) {
    const g = new THREE.Group(), b = glass(col);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 12), b); body.position.y = 0.07; g.add(body);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.035, 0.05, 12), b); sh.position.y = 0.165; g.add(sh);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.05, 10), b); neck.position.y = 0.215; g.add(neck);
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 12), std(label)); lab.position.y = 0.07; g.add(lab);
    return g;
  }
  function can(col) { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 14), std(col, { metalness: 0.6, roughness: 0.3 })); c.position.y = 0.06; g.add(c); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 14), std(0xcccccc, { metalness: 0.8, roughness: 0.3 })); t.position.y = 0.122; g.add(t); return g; }
  function cup() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.032, 0.12, 16, 1, true), std(0xd0182a, { side: THREE.DoubleSide })); c.position.y = 0.06; g.add(c); const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 6, 16), std(0xffffff)); r.rotation.x = Math.PI / 2; r.position.y = 0.12; g.add(r); return g; }
  const stripes = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#d0182a"; c.fillRect(i * 16, 0, 16, h); } });
  const kernel = std(0xfff2c0, { roughness: 0.9 });
  function popcorn(full = true) {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.2, 18, 1, true), new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide, roughness: 0.8 })); b.position.y = 0.1; g.add(b);
    for (let k = 0; k < (full ? 26 : 8); k++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), kernel); const a = Math.random() * 7, r = Math.random() * 0.08; p.position.set(Math.cos(a) * r, 0.19 + Math.random() * (full ? 0.06 : 0.01), Math.sin(a) * r); g.add(p); }
    return g;
  }
  function spill(x, z, n = 9) { for (let k = 0; k < n; k++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), kernel); p.position.set(x + rnd(-0.35, 0.35), 0.02, z + rnd(-0.25, 0.25)); scene.add(p); } }
  function pizzaBox() {
    const g = new THREE.Group(), card = std(0xe8dcc2, { roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), card); base.position.y = 0.02; g.add(base);
    // the lid stands open, hinged on the back edge
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.42), card); lid.rotation.x = 1.2; lid.position.set(0, 0.04 + Math.sin(1.2) * 0.21, -0.21 - Math.cos(1.2) * 0.21); g.add(lid);
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 3, 1, false, 0, Math.PI / 3 * 2), std(0xf0b030)); slice.position.set(0.02, 0.046, 0.04); g.add(slice);
    for (let k = 0; k < 3; k++) { const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 10), std(0xb02a1a)); pep.position.set(rnd(-0.04, 0.08), 0.054, rnd(0, 0.1)); g.add(pep); }
    return g;
  }
  function foamFinger(col) { const g = new THREE.Group(), m = std(col, { roughness: 0.95 }); const hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.07), m); hand.position.y = 0.1; g.add(hand); const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.06), m); f.position.set(-0.05, 0.32, 0); g.add(f); const th = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), m); th.position.set(0.13, 0.15, 0); th.rotation.z = -0.5; g.add(th); g.rotation.z = 0.25; return g; }
  function bin() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.62, 18, 1, true), std(0x222230, { side: THREE.DoubleSide, roughness: 0.6 })); c.position.y = 0.31; g.add(c);
    for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + Math.random() * 0.04, 0), std(pick([0xe8e8e8, 0xd0182a, 0xe8dcc2, 0xc0c0c0]))); t.position.set(rnd(-0.12, 0.12), 0.62 + Math.random() * 0.12, rnd(-0.12, 0.12)); g.add(t); } return g; }
  // the hangout tables (tops at 1.035): drinks, popcorn, a pizza
  add(bottle(), -7.25, 1.035, 1.3, 0); add(bottle(0x2a5a1a, 0xf0f0f0), -7.65, 1.035, 1.75); add(cup(), -7.9, 1.035, 1.2); add(popcorn(), -7.45, 1.035, 1.85);
  add(can(0x2a6ad0), -2.3, 1.035, 8.0); add(can(0xd02a3a), -2.75, 1.035, 8.45); add(pizzaBox(), -2.45, 1.035, 8.35, 0.4);
  add(bottle(), 9.3, 1.035, 6.2); add(bottle(), 9.6, 1.035, 5.8); add(bottle(0x2a5a1a, 0xf0f0f0), 9.85, 1.035, 6.15); add(popcorn(false), 9.2, 1.035, 5.75);
  // on the floor: cans by a stool, a bucket that got knocked over, a foam finger on a stool, a full bin
  add(can(0xd02a3a), -6.1, 0.0, 2.4); const knocked = add(popcorn(false), 0.0, 0.07, 6.2, 0.7); knocked.rotation.z = Math.PI / 2; spill(0.3, 6.3, 12);
  add(foamFinger(0x2a6ad0), 10.65, 0.7, 6.49, -0.4); add(bin(), 14.3, 0, 7.4); add(bin(), -13.9, 0, -0.6);
  add(cup(), 2.9, 0.0, 9.1); add(can(0x2a6ad0), 5.6, 0.0, 9.2);
  // near the air hockey table, the nachos the WANTED poster is about
  { const tray = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.18), std(0xe8e8e8)); tray.position.set(2.05, 0.8, 3.42); scene.add(tray); for (let k = 0; k < 8; k++) { const n = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.01, 3), std(0xf0c040)); n.position.set(2.05 + rnd(-0.09, 0.09), 0.82, 3.42 + rnd(-0.06, 0.06)); n.rotation.set(rnd(0, 1), rnd(0, 6), 0); scene.add(n); } }
  // in the poker room: a cocktail table by the lamp with drinks, and a stack of chips somebody forgot
  { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), std(0x2a1220, { roughness: 0.4 })); t.position.set(AX0 + 1.9, 1.0, AZ1 - 1.3); scene.add(t); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.2, 1.0, 12), std(0x140810)); l.position.set(AX0 + 1.9, 0.5, AZ1 - 1.3); scene.add(l); block(AX0 + 1.9, AZ1 - 1.3, 0.9, 0.9);
    add(bottle(), AX0 + 1.75, 1.02, AZ1 - 1.2); add(bottle(0x2a5a1a, 0xf0f0f0), AX0 + 2.05, 1.02, AZ1 - 1.4); add(popcorn(), AX0 + 1.9, 1.02, AZ1 - 1.05); }
  for (let k = 0; k < 6; k++) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.018, 14), std(pick([0xff2d95, 0x19e3ff, 0xffd400]))); ch.position.set(AX1 - 1.6, 0.01 + k * 0.018, D + 2.3); scene.add(ch); }
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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(3, 0.45, 1); s.renderOrder = 5;   // walls hide it (it used to show through them)
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
  // the walkable floor is three boxes: the lounge, the arch, the poker room. Off it, you're put back on the nearest one.
  let best = null, bd = 1e9;
  for (const [x0, x1, z0, z1] of [[-W + r, W - r, -D + r, D - r], [OX0 + r, OX1 - r, D - r, D + r], [AX0 + r, AX1 - r, D + r, AZ1 - r], ...WALK]) {
    const cx = clamp(p.x, x0, x1), cz = clamp(p.z, z0, z1), d = (cx - p.x) ** 2 + (cz - p.z) ** 2; if (d < bd) { bd = d; best = [cx, cz]; }
  }
  p.x = best[0]; p.z = best[1];
  for (const h of HOOKS) h(p, r);
}

/* ------------------------------------------------------------------ the shell: who you are, the menu, chat, settings, the jukebox */
const settings = { ...Arcade.DEFAULT_SETTINGS };
const me = { p: new V3(0, R, 1), v: new V3(), facing: Math.PI, grounded: true, slide: false, slideT: 0, slideCd: 0, landT: 9 };
if (new URLSearchParams(location.search).get("at") === "poker") me.p.set(-8, R, 12.4);   // the old poker page sends you here
const remote = new Map();   // id -> { p, mesh, target, f, a }
const tstate = { x: 0, y: 0, jump: false, slide: false };   // the shell's thumbstick and buttons write here (phones)
let bots = [];
const A = await Arcade.start({
  stage: document.querySelector(".stage"), room: "lounge", title: "The Lounge", where: "", localUnlocks,
  help: `<p><b>Walk</b> with WASD, <b>jump</b> with Space, <b>drag</b> to look round. <b>E</b> uses whatever you're standing at:</p>
    <p>🕹️ a <b>cabinet</b> on the far wall opens its game · 🏆 the <b>board</b> on the right flips to the next game · 🎁 the <b>prize counter</b> changes your look ·
    📻 the <b>jukebox</b> picks the station the whole arcade hears · 🧸 the <b>claw</b>, and 🏒 <b>air hockey</b> (for two, once the room is live).</p>
    <p><b>Enter</b> opens the chat, <b>Esc</b> the menu, <b>M</b> mutes.</p>`,
  lookHint: "Talk to Sydney at the prize counter to change your character and hat.",
  touch: { state: tstate, buttons: [{ id: "use", label: "E", cls: "alt", tap: () => { if (EX?.active()) EX.key({ code: "KeyE" }, true); else if (near) use(near); } }, { id: "slide", label: "SLIDE", cls: "alt" }, { id: "jump", label: "JUMP" }] },
  onHello: () => { if (A.hello?.hockey) onHk({ ...A.hello.hockey, top: A.hello.hockeyTop }); if (A.hello?.dash) EX?.onDash(A.hello.dash);  for (const b of bots) dropPerson(b.mesh); bots = []; for (const p of A.people.values()) addRemote(p); renderOnline(); renderOutfit(); },
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
    else if (m.t === "dash" || m.t === "dashr") EX.onDash(m);
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
const lucky = makePerson({ model: "char-male-e", hat: "none" }, "LUCKY · CASHIER", "#ffd400");
lucky.g.position.set(CAGE.x, 0, CAGE.z + 0.55); lucky.g.rotation.y = Math.PI;
const clerkMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), tube(COL.lime)); clerkMark.position.y = 2.7; clerk.g.add(clerkMark);
function rebuildMe() { const vis = me.mesh.g.visible; dropPerson(me.mesh); me.mesh = makePerson(A.look, null); me.mesh.g.visible = vis; }
function addRemote(p) {
  if (remote.has(p.id) || (A.me && p.id === A.me.id)) return;
  const r = { p, mesh: makePerson(p.look || { model: CHARS[0], hat: "none" }, p.name, Arcade.nameColor(p.login), p.avatar), target: new V3(0, 0, 3), f: 0, a: 0, seen: false };
  if (p.pos) { r.mesh.g.position.set(p.pos[0], p.pos[1] - R, p.pos[2]); r.target.copy(r.mesh.g.position); r.seen = true; }
  r.mesh.g.visible = p.room === "lounge";
  remote.set(p.id, r);
}
let autoQ = "high";   // what "auto" has settled on
const qualityNow = () => (settings.quality === "auto" ? autoQ : settings.quality);
function applyQuality() {
  const q = qualityNow(), maxRank = q === "low" ? 1 : q === "medium" ? 2 : 3;
  let off = 0;
  for (const L of LIGHTS) { L.l.visible = L.rank <= maxRank; if (!L.l.visible) off++; }
  sky.intensity = 0.75 + off * 0.04;   // the room gets a little more general light for every light turned off
  bloom.enabled = settings.glow && q !== "low";
  renderer.shadowMap.enabled = q !== "low";
  key.shadow.mapSize.set(q === "high" ? 2048 : 1024, q === "high" ? 2048 : 1024); key.shadow.map?.dispose(); key.shadow.map = null;
  renderer.setPixelRatio(q === "low" ? 0.75 : q === "medium" ? 1 : Math.min(2, window.devicePixelRatio || 1));
  canvas.width = 0;
  A.fpsNote?.(`${settings.quality === "auto" ? "auto→" : ""}${q} · ${LIGHTS.filter((L) => L.l.visible).length} lights`);
}
A.onSettings((s) => {
  Object.assign(settings, s);
  applyQuality();
  for (const l of labels) l.visible = s.names;
  Sfx.setVolume(s.master * s.sfx, s.mute);
  canvas.width = 0;   // forces the resize check in the frame
});

/* ---- the others when the room server is offline: bots where people stand in an arcade */
const SPOTS = [
  ...cabs.map((c) => ({ x: c.x, z: c.z + 0.1, face: Math.PI, what: "cab" })),
  { x: -0.6, z: 4, face: Math.PI / 2, what: "hockey" }, { x: 2.6, z: 4, face: -Math.PI / 2, what: "hockey" },
  { x: -7.5, z: 3.1, face: Math.PI, what: "table" }, { x: -9, z: 0.8, face: Math.PI / 2, what: "table" }, { x: -2.5, z: 6.6, face: 0, what: "table" }, { x: 9.5, z: 4.4, face: 0, what: "table" }, { x: 11, z: 6.9, face: -Math.PI / 2, what: "table" },
  { x: -10.6, z: 14.2, face: 0.9, what: "poker" }, { x: -5.4, z: 17.8, face: -2.3, what: "poker" }, { x: -8, z: 18.1, face: Math.PI, what: "poker" }, { x: 4.5, z: 8.6, face: Math.PI, what: "cashier" },
  { x: W - 3.2, z: -2, face: Math.PI / 2, what: "board" }, { x: W - 3.4, z: 0.4, face: Math.PI / 2, what: "board" },
  { x: -11.6, z: -8.7, face: -Math.PI / 2, what: "claw" }, { x: OUTFIT.x + 0.4, z: 3.2, face: -Math.PI / 2, what: "prizes" }, { x: JUKE.x + 1.6, z: JUKE.z, face: -Math.PI / 2, what: "juke" }
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
const ANIMS = ["idle", "walk", "jump", "idle"];   // 3: sliding (drawn low, see squash)
const squash = (m, on, dt) => { const g = m.g; g.scale.y += ((on ? 0.55 : 1) - g.scale.y) * Math.min(1, dt * 14); if (m.tag) { m.tag.scale.y = 0.45 / g.scale.y; m.tag.position.y = 2.2 / g.scale.y; } };   // the name tag keeps its shape
function stepRemote(dt) {
  for (const r of remote.values()) {
    const g = r.mesh.g; if (!g.visible) continue;
    g.position.lerp(r.target, Math.min(1, dt * 12));
    let dy = r.f - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 12);
    r.mesh.ch?.play(ANIMS[r.a] || "idle"); r.mesh.ch?.update(dt); squash(r.mesh, r.a === 3, dt);
  }
}

/* ------------------------------------------------------------------ the side panels: who's here, the prize counter */
/* WHO'S ONLINE is the shell's button now (top right, in every game). Online it lists the room server's people by itself; offline the
   lounge hands it the bots, so the mockup still shows the shape. */
const doing = { cab: "at a cabinet", hockey: "air hockey", board: "reading the board", table: "hanging out", claw: "at the claw", prizes: "at the prize counter", juke: "at the jukebox", leave: "heading in", poker: "in the poker room", cashier: "at the cashier", ptable: "at a poker table" };
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

/* ------------------------------------------------------------------ the poker room's lobby and table, and the cashier
   Mockup: the wallet lives in this page; on the site it is THE ticket wallet EastScape uses, and the cashier is the site's exchange. */
const wallet = { tickets: 12450, zc: 340, out24: 0, cap: 100, rate: 1000 };
const EX = buildExtras({ THREE, scene, camera, canvas, A, Sfx, me, R, D, W, COL, HEX, box, std, basic, tube, canvasTex, block, keep, makePerson, rnd, pick, clamp, esc, WALK, REGIONS, HOOKS, wallet, tstate, CALM,
  PK_X0: AX0, PK_X1: AX1, PK_Z1: AZ1,
  nameColor: Arcade.nameColor, botsOn: () => bots.length > 0, setYaw: (y) => { camYaw = y; } });
applyQuality();   // the new rooms' lights join the budget
let pokerOpen = null;
const fmt = (n) => Number(n).toLocaleString();
function pokerLobby(tb) {
  const s = tb.s, n = 2 + (s.key.length % 3), pool = s.buyIn * 6;
  A.openCustom({
    title: s.name,
    html: () => `<p class="ak-note" style="margin:0 0 10px;color:var(--ak-yellow)">⚠️ Preview: you play against bots with pretend tickets. Nothing real is staked or won.</p><div class="pk-facts"><div><b>${s.buyIn ? `${fmt(s.buyIn)} 🎟️` : "FREE"}</b><small>buy-in</small></div><div><b>1,500</b><small>starting chips</small></div><div><b>6 hands</b><small>per blind level</small></div></div>
      <div class="pk-sng"><div class="row"><b>Next table · ${n} of 6 seated</b><small>${s.buyIn ? `Prize pool ${fmt(pool)} 🎟️: 1st ${fmt(Math.round(pool * 0.65))}, 2nd ${fmt(Math.round(pool * 0.35))}. Every ticket goes to the players: no house cut.` : "No buy-in, no prize pool: the winner takes the day's Freeroll title."}</small>
        <div class="pk-seats">${Array.from({ length: 6 }, (_, k) => `<i class="${k < n ? "on" : ""}"></i>`).join("")}</div>
        <button type="button" class="ak-btn" data-reg="1">${s.buyIn ? `Register · ${fmt(s.buyIn)} 🎟️` : "Register · free"}</button></div></div>
      <p class="ak-note">You have ${fmt(wallet.tickets)} 🎟️. Short? The cashier in the main room sells tickets for ZCoins. Starts when the sixth seat fills; lose your connection and you're dealt in and folded until you're back.</p>`,
    onClick: (b) => {
      if (!b.dataset.reg) return;
      if (s.buyIn > wallet.tickets) return A.notify("Not enough tickets: the cashier sells them for ZCoins.", "🎟️", "pink");
      wallet.tickets -= s.buyIn; A.closeWindow(); A.notify("Registered: the table's full. Shuffle up and deal!", "🃏", "lime");
      const others = ["drhealsgud", "cenozoicmegafauna", "PsilocyBoone", "heartlarva", "zwades", "kellzifer", "bigrig", "allyrose7774"].sort(() => Math.random() - 0.5).slice(0, 5);
      A.setWhere(s.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())); $("hudPrompt").innerHTML = ""; $("hudPrompt").dataset.l = "";
      pokerOpen = openTable(document.querySelector(".stage"), {
        me: A.me?.name || "You", sng: { name: s.name, buyIn: s.buyIn, unit: "tickets" }, bots: others,
        notify: (t, i) => A.notify(esc(t), i), sfx: (k) => Sfx.play(k),
        onLeave: (place, again) => {
          pokerOpen = null; A.setWhere(""); canvas.focus({ preventScroll: true });
          const prize = s.buyIn && place && place <= 2 ? Math.round(pool * (place === 1 ? 0.65 : 0.35)) : 0;
          if (prize) { wallet.tickets += prize; A.notify(`+${fmt(prize)} 🎟️ for ${place === 1 ? "1st" : "2nd"} place`, "🏆", "gold"); }
          if (again) pokerLobby(tb);
        }
      });
    }
  });
}
function cashier(tab = "buy") {
  let amount = tab === "buy" ? 5 : 5000;
  const LINES = ["Tickets in, tickets out. What'll it be?", "Same tickets as EastScape, champ. Spend 'em anywhere.", "Cashing out? A hundred a day, house rules."];
  const html = () => `<p class="ak-note" style="margin:0 0 10px;color:var(--ak-yellow)">⚠️ Preview: these balances are pretend and nothing real moves. Your real tickets and ZCoins are untouched.</p>
    <div class="ak-npcsay"><span class="ak-av" style="--ring:var(--ak-yellow)">🎰</span><p><b>Lucky</b>${pick(LINES)}</p></div>
    <div class="pk-wallet"><div class="tix"><small>Tickets · shared with EastScape</small><b>${fmt(wallet.tickets)} 🎟️</b></div><div class="zc"><small>ZCoins</small><b>${fmt(wallet.zc)} ZC</b></div></div>
    <div class="ak-tabs" role="tablist">${[["buy", "Buy tickets"], ["out", "Cash out"], ["earn", "Earn"], ["history", "History"]].map(([k, nm]) => `<button type="button" class="ak-tab" role="tab" aria-selected="${tab === k}" data-tab="${k}">${nm}</button>`).join("")}</div>
    <div style="margin-top:12px">${tab === "buy" ? `
      <div class="pk-xch"><input class="ak-input" type="number" min="1" step="1" value="${amount}" data-amt-in aria-label="ZCoins to spend"><span class="arrow">→</span><span class="out" data-out>${fmt(amount * wallet.rate)} 🎟️</span></div>
      <p class="ak-note">1 ZC = ${fmt(wallet.rate)} tickets. Every table, cabinet and buy-in in the lounge takes tickets.</p>
      <button type="button" class="ak-btn" data-buy="1" style="width:100%;margin-top:6px">Buy tickets</button>` : tab === "out" ? `
      <div class="pk-xch"><input class="ak-input" type="number" min="1000" step="1000" value="${amount}" data-amt-in aria-label="Tickets to cash out"><span class="arrow">→</span><span class="out" data-out>${fmt(Math.floor(amount / wallet.rate))} ZC</span></div>
      <p class="ak-note">${fmt(wallet.rate)} tickets = 1 ZC. Up to ${wallet.cap} ZC a day can be cashed out, the same limit as EastScape (one limit across both): <b>${wallet.cap - wallet.out24} left</b> in the last 24 hours.</p>
      <div class="pk-meter"><i style="width:${(wallet.out24 / wallet.cap) * 100}%"></i></div>
      <button type="button" class="ak-btn yellow" data-cash="1" style="width:100%;margin-top:10px">Cash out</button>` : tab === "earn" ? `
      <ul class="pk-earn"><li>🧗<span>The Climb<small> · each new best floor, a bonus at each landing</small></span><b>+20 🎟️ / floor</b></li>
        <li>🏒<span>Air hockey<small> · win a match</small></span><b>+150 🎟️</b></li>
        <li>🃏<span>Sit &amp; gos<small> · the top two split the pool</small></span><b>65 / 35</b></li>
        <li>⚔️<span>EastScape<small> · every kill, catch and job: the same wallet</small></span><b>shared</b></li></ul>
      <p class="ak-note">Numbers here are placeholders.</p>` : `
      <ul class="pk-earn"><li>🃏<span>Sit &amp; Go · 500 · 2nd<small> · 12 min ago</small></span><b>+1,050 🎟️</b></li><li>💱<span>Bought tickets<small> · 1 hr ago</small></span><b>5 ZC → 5,000 🎟️</b></li><li>💰<span>Cashed out<small> · yesterday</small></span><b>20,000 🎟️ → 20 ZC</b></li></ul>`}</div>`;
  A.openCustom({
    title: "CASHIER", html,
    onOpen: (w) => { const inp = w.querySelector("[data-amt-in]"); inp?.addEventListener("input", () => { amount = Math.max(0, Number(inp.value) || 0); w.querySelector("[data-out]").textContent = tab === "buy" ? `${fmt(amount * wallet.rate)} 🎟️` : `${fmt(Math.floor(amount / wallet.rate))} ZC`; }); },
    onClick: (b) => {
      if (b.dataset.tab) { tab = b.dataset.tab; amount = tab === "buy" ? 5 : 5000; A.redrawCustom(); return; }
      if (b.dataset.buy) {
        const zc = Math.floor(amount); if (zc < 1) return A.notify("At least 1 ZC.", "💱"); if (zc > wallet.zc) return A.notify("You don't have that many ZCoins.", "💱", "pink");
        wallet.zc -= zc; wallet.tickets += zc * wallet.rate; Sfx.play("checkpoint"); A.notify(`Bought ${fmt(zc * wallet.rate)} 🎟️ for ${zc} ZC`, "🎟️", "lime"); A.redrawCustom();
      }
      if (b.dataset.cash) {
        const zc = Math.floor(amount / wallet.rate), room = wallet.cap - wallet.out24;
        if (zc < 1) return A.notify(`At least ${fmt(wallet.rate)} tickets.`, "💰"); if (zc * wallet.rate > wallet.tickets) return A.notify("You don't have that many tickets.", "💰", "pink");
        if (zc > room) return A.notify(`Only ${room} ZC left to cash out today.`, "💰", "pink");
        wallet.tickets -= zc * wallet.rate; wallet.zc += zc; wallet.out24 += zc; Sfx.play("checkpoint"); A.notify(`Cashed out ${fmt(zc * wallet.rate)} 🎟️ for ${zc} ZC`, "💰", "gold"); A.redrawCustom();
      }
    }
  });
}

/* ------------------------------------------------------------------ input and movement */
const keys = {};
let dragId = null, camYaw = 0, camPitch = 0.42, dragging = false, lastX = 0, lastY = 0, jumpWas = false, near = null, entering = false;
addEventListener("keydown", (e) => {
  if (document.activeElement !== canvas || A.windowOpen() || pokerOpen) return; Sfx.ensure();
  if (EX.active()) { EX.key(e, true); if (e.code === "Space") e.preventDefault(); return; }
  keys[e.code] = true;
  if (e.code === "KeyR" && EX.restart?.()) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyE" && near) use(near);
});
addEventListener("keyup", (e) => { keys[e.code] = false; if (EX.active()) EX.key(e, false); });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener("pointerdown", (e) => { Sfx.ensure(); if (EX.active()) { EX.pointer("move", e); EX.pointer("down", e); canvas.focus({ preventScroll: true }); return; } if (hkSide() >= 0) { hkAim(e); canvas.focus(); return; } dragging = true; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; canvas.focus(); });
addEventListener("pointerup", (e) => { if (e.pointerId === dragId) dragging = false; });
addEventListener("pointercancel", (e) => { if (e.pointerId === dragId) dragging = false; });
canvas.addEventListener("pointermove", (e) => { if (EX.active()) EX.pointer("move", e); else if (hkSide() >= 0) hkAim(e); });
addEventListener("pointerup", (e) => { if (EX.active()) EX.pointer("up", e); });
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
  if (n.kind === "ex") return n.it.use();
  if (n.kind === "cab") enterGame(n.gm);
  else if (n.kind === "prizes") { A.openLook({ ...CLERK, line: pick(CLERK_LINES) }); Sfx.play("beep"); }
  else if (n.kind === "juke") A.openJukebox();
  else if (n.kind === "ptable") pokerLobby(n.tb);
  else if (n.kind === "cashier") cashier();
  else if (n.kind === "board") { setBoard(boardIdx + 1); Sfx.play("beep"); }
  else if (n.kind === "claw") A.notify(pick(["The claw grabs… and drops it. Classic.", "So close! It slipped.", "You won a plush! (On the site: a cosmetic.)"]), "🧸", "pink");
  else if (n.kind === "hockey") {
    if (!A.online) return A.notify("Air hockey needs the room server: it's for two real players.", "🏒", "lime");
    const h = hk.state; if (h && (h.phase === "play" || h.phase === "goal" || h.phase === "over")) return A.notify("The table's busy. Watch, and you've got next.", "🏒");
    A.send({ t: "hockey", op: "sit" });
  }
}
function step(dt) {
  if (pokerOpen || EX.active()) return;
  if (hkSide() >= 0) return stepSeated();
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - tstate.y, s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + tstate.x;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let x = fx * f + rx * s, z = fz * f + rz * s; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  // slide-hop (see SL)
  let hs = Math.hypot(me.v.x, me.v.z);
  const want = l > 0.1 ? Math.atan2(x, z) : null, slideKey = Boolean(keys.ShiftLeft || keys.ShiftRight || tstate.slide);
  const steer = (rate) => { if (want === null || hs < 0.1) return; let h = Math.atan2(me.v.x, me.v.z); h += clamp(Math.atan2(Math.sin(want - h), Math.cos(want - h)), -rate * dt, rate * dt); me.v.x = Math.sin(h) * hs; me.v.z = Math.cos(h) * hs; };
  const setSpeed = (v) => { if (hs > 1e-3) { me.v.x *= v / hs; me.v.z *= v / hs; } hs = v; };
  me.landT += dt; me.slideCd = Math.max(0, me.slideCd - dt);
  if (!me.slide && me.grounded && slideKey && hs > SL.min) {
    me.slide = true; me.slideT = 0;
    const kick = (me.slideCd > 0 ? 0 : SL.start) + (me.landT < SL.window ? SL.perfect : 0);
    if (kick) setSpeed(Math.min(SL.max, Math.max(hs, hs + kick))); Sfx.play(me.landT < SL.window ? "go" : "dive");
  }
  const jump = Boolean(keys.Space || tstate.jump), jumped = jump && !jumpWas && me.grounded; jumpWas = jump;
  if (me.slide) {
    me.slideT += dt; steer(SL.steer); setSpeed(hs * Math.exp(-(me.slideT > SL.long ? 3 : SL.decay) * dt));
    if (jumped) setSpeed(Math.min(SL.max, hs + SL.hop));
    if (jumped || !slideKey || !me.grounded || hs < SL.min * 0.7) { me.slide = false; me.slideCd = SL.cd; }
  } else if (hs > RUN + 0.2) {   // carrying speed: on the ground it drains, in the air it's kept; either way you can steer it
    if (me.grounded) { steer(4); setSpeed(Math.max(RUN, hs - SL.drain * dt)); } else steer(SL.airSteer);
  } else { me.v.x += clamp(x * RUN - me.v.x, -ACC * dt, ACC * dt); me.v.z += clamp(z * RUN - me.v.z, -ACC * dt, ACC * dt); }
  if (jumped) { me.v.y = JUMP; me.grounded = false; Sfx.play("jump"); }
  if (me.slide) me.facing = Math.atan2(me.v.x, me.v.z) + Math.PI; else if (l > 0.1) me.facing = Math.atan2(x, z) + Math.PI;
  me.v.y += G * dt; me.p.addScaledVector(me.v, dt);
  if (me.p.y <= R) { if (!me.grounded) me.landT = 0; me.p.y = R; me.v.y = 0; me.grounded = true; }
  pushOut(me.p, R);
  near = null; let best = 1e9;
  const consider = (kind, x2, z2, rad, extra = {}) => { const d = Math.hypot(me.p.x - x2, me.p.z - z2); if (d < rad && d < best) { best = d; near = { kind, ...extra }; } };
  for (const c of cabs) consider("cab", c.x, c.z, 1.4, { gm: c.gm });
  consider("prizes", OUTFIT.x, OUTFIT.z, 2.6); consider("juke", JUKE.x + 1.3, JUKE.z, RADIO.reach - 0.4); consider("board", W - 3, BZ, 3.2); consider("claw", -11.8, -8.7, 1.6); consider("hockey", HOCKEY.at.x, HOCKEY.at.z, HOCKEY.reach - 0.3); consider("cashier", CAGE_AT.x, CAGE_AT.z, 2.6);
  for (const tb of PK.tables) consider("ptable", tb.at.x, tb.at.z, 2.9, { tb });
  for (const it of EX.spots) consider("ex", it.x, it.z, it.r, { it });
  const label = !near || A.windowOpen() ? "" : near.kind === "ex" ? near.it.label() : near.kind === "cab" ? (near.gm.open ? `<kbd>E</kbd> Play ${near.gm.name}` : `<kbd>E</kbd> ${near.gm.name} · coming soon`)
    : near.kind === "prizes" ? `<kbd>E</kbd> Talk to Sydney: change your look` : near.kind === "juke" ? `<kbd>E</kbd> Jukebox: pick the station` : near.kind === "board" ? `<kbd>E</kbd> Next board` : near.kind === "claw" ? `<kbd>E</kbd> Try the claw` : near.kind === "cashier" ? `<kbd>E</kbd> Cashier: buy tickets, cash out` : near.kind === "ptable" ? `<kbd>E</kbd> ${near.tb.s.name}: ${near.tb.s.sub}` : hkPrompt();
  const hp = $("hudPrompt"); if (hp.dataset.l !== label) { hp.dataset.l = label; hp.innerHTML = label; }
  A.setWhere(near ? (near.kind === "ex" ? ({ skee: "at skee-ball", darts: "at the darts", pong: "at beer pong", fish: "by the pond", fire: "by the fire" })[near.it.kind] || "" : near.kind === "cab" ? `at ${near.gm.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}` : doing[near.kind] || "") : "");
  const sp = Math.hypot(me.v.x, me.v.z);
  A.sendPos(me.p.x, me.p.y, me.p.z, me.facing, me.slide ? 3 : !me.grounded ? 2 : sp > 0.6 ? 1 : 0);
}

/* ------------------------------------------------------------------ the frame */
const _cam = new V3(), _look = new V3(), _c = new THREE.Color();
let last = performance.now(), noteT = 5, chaseT = 0, chaseStep = 0, scrT = 0, scrPhase = 1;
const perf = { n: 0, slow: 0, from: 0 };
function measure(rawMs) {
  if (settings.quality !== "auto" || autoQ === "low" || document.hidden) return;
  perf.n++; if (perf.n < 40) return;                  // let the scene settle (shaders, textures) first
  if (rawMs > 24) perf.slow++;                          // slower than ~40 fps
  if (perf.n >= 220) {
    if (perf.slow / (perf.n - 40) > 0.4) { autoQ = autoQ === "high" ? "medium" : "low"; applyQuality(); A.notify(`Switched to ${autoQ} quality for smoother play (Settings to change it).`, "⚙️"); }
    perf.n = 0; perf.slow = 0;
  }
}
function frame(now) {
  measure(now - last);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (!entering) step(dt);
  if (bots.length) stepBots(dt); else stepRemote(dt);
  stepHockey(dt);
  EX.step(dt, t);
  // first-person games (skee-ball, darts, beer pong): your character, and anyone standing right by you, step out of the shot
  { const fp = EX.firstPerson(); me.mesh.g.visible = !fp;
    const near2 = (g) => fp && Math.hypot(g.position.x - me.p.x, g.position.z - me.p.z) < 2.2;
    for (const b of bots) if (!b.inGame) b.mesh.g.visible = !near2(b.mesh.g);
    for (const r of remote.values()) if (r.p.room === "lounge") r.mesh.g.visible = !near2(r.mesh.g); }
  const g = me.mesh.g; g.position.set(me.p.x, me.p.y - R, me.p.z); let dy = me.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3;
  { const dx = me.p.x - clerk.g.position.x, dz = me.p.z - clerk.g.position.z, want = Math.hypot(dx, dz) < 6 ? Math.atan2(dx, dz) : Math.PI / 2;
    let d = want - clerk.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); clerk.g.rotation.y += d * Math.min(1, dt * 4); clerk.ch?.update(dt); lucky.ch?.update(dt);
    if (!CALM) { clerkMark.position.y = 2.7 + Math.sin(t * 2.4) * 0.07; clerkMark.rotation.y = t * 1.5; } }
  const sp = Math.hypot(me.v.x, me.v.z); me.mesh.ch?.play(me.slide ? "idle" : !me.grounded ? "jump" : sp > 0.6 ? "walk" : "idle"); me.mesh.ch?.update(dt); squash(me.mesh, me.slide, dt);
  // speed widens the view a little (slide-hop, boost pads)
  { const fov = 58 + clamp((sp - RUN) / 9, 0, 1) * 12; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); } }
  const ox = Math.sin(camYaw) * Math.cos(camPitch), oz = Math.cos(camYaw) * Math.cos(camPitch); let dist = 9;
  const RG = REGIONS.find((g) => me.p.x >= g.x0 && me.p.x <= g.x1 && me.p.z >= g.z0 && me.p.z <= g.z1) || REGIONS[0];
  const RX0 = RG.x0, RX1 = RG.x1, RZ0 = RG.z0, RZ1 = RG.z1;
  // (outdoors too: the patio's edges are the building on one side and the fence on the others, and a camera through the wall looks indoors)
  if (ox > 0.01) dist = Math.min(dist, (RX1 - 0.5 - me.p.x) / ox); if (ox < -0.01) dist = Math.min(dist, (RX0 + 0.5 - me.p.x) / ox);
  if (oz > 0.01) dist = Math.min(dist, (RZ1 - 0.5 - me.p.z) / oz); if (oz < -0.01) dist = Math.min(dist, (RZ0 + 0.5 - me.p.z) / oz);
  dist = Math.max(2.5, dist);
  if (RG.ceil && Math.sin(camPitch) > 0.05) dist = Math.max(1.6, Math.min(dist, (RG.ceil - 0.35 - me.p.y - 1.4) / Math.sin(camPitch)));   // indoors, under the ceiling
  _cam.set(me.p.x + ox * dist, me.p.y + 1.4 + Math.sin(camPitch) * dist, me.p.z + oz * dist);
  if (EX.cam(_cam, _look)) { /* a game is driving the camera */ }
  else if (hkSide() >= 0) { const sd = hkSide() ? 1 : -1; _cam.set(HOCKEY.at.x + sd * 2.9, 2.35, HOCKEY.at.z); _look.set(HOCKEY.at.x - sd * 0.25, 0.7, HOCKEY.at.z); }
  else _look.set(me.p.x, me.p.y + 1.1, me.p.z);
  camera.position.lerp(_cam, 0.15); camera.lookAt(_look);

  // the lights. The LED colour runs slowly round the room; the bulbs chase at 3 steps a second (no faster: photosensitivity)
  if (!CALM) {
    for (const L of leds) L.m.material.color.setHSL((((L.u * 0.035 - t * 0.08) % 1) + 1) % 1, 1, LED_L);
    for (const S of spots) S.s.target.position.set(Math.sin(t * 0.35 + S.ph) * 9, 0, Math.cos(t * 0.27 + S.ph * 1.3) * 6 + 1);
    chaseT += dt; if (chaseT > 1 / 3) { chaseT = 0; chaseStep++; for (let k = 0; k < bulbPos.length; k++) bulbs.setColorAt(k, (k + chaseStep) % 3 === 0 ? BULB_ON : BULB_OFF); bulbs.instanceColor.needsUpdate = true; }
    signLight.intensity = 7 + Math.sin(t * 1.3) * 1.2;
    for (const hz of haze) { hz.sp.position.x = hz.x + Math.sin(t * 0.07 + hz.ph) * 0.8; hz.sp.position.z = hz.z + Math.cos(t * 0.05 + hz.ph) * 0.6; hz.sp.material.opacity = 0.06 + Math.sin(t * 0.3 + hz.ph) * 0.02; }
    const puck = scene.userData.puck; if (puck && bots.length) puck.position.set(Math.sin(t * 2.1) * 1.05, 0.79, Math.sin(t * 3.3) * 0.5);
    const claw = scene.userData.claw; if (claw) claw.position.set(Math.sin(t * 0.6) * 0.45, 2.05, Math.cos(t * 0.45) * 0.45);
    scrT += dt; if (scrT > 0.6) { scrT = 0; scrPhase ^= 1; const c = cabs[0]; c.scr.material.map.dispose(); c.scr.material.map = screenTex(c.gm, scrPhase); }
    // the jukebox's tubes breathe while a station is on
    const on = Boolean(A.radio), k = on ? 0.75 + Math.sin(t * 4) * 0.25 : 0.35;
    jukeLights.forEach((m, i) => { if (m.isLight) { if (m.visible) m.intensity = on ? 3 + Math.sin(t * 4) * 1.5 : 1.5; } else m.material.color.set(i === 0 ? COL.orange : COL.pink).multiplyScalar(0.62 * k); });
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
window.__lounge = { me, A, remote, clerk, camera, LIGHTS, applyQuality, qualityNow, EX, wallet, get bots() { return bots; }, cabs, use, setBoard, cam: (y, p) => { camYaw = y; camPitch = p; } };

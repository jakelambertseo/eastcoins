/* Blockshot — a Krunker-style free-for-all on the bean engine (2026-10-08). Stage 1 was you against eleven bots on one block map; this
   is the standalone game the owner wants in the Games section: "cleaning up the game, adding some free sounds, free textures, a leveling
   mechanism for skins, total stat tracking (kills, kd, etc). make the maps larger with fewer blocks/things that break movement".

   The pieces: maps.js (lists of boxes, ramps and jump pads, built into one mesh per texture), tex.js (every texture drawn in code),
   audio.js (every sound synthesised), profile.js (XP, levels, skins, lifetime stats, settings; in this browser until the server keeps
   them). This file is the game: Blaster Brawl's oriented-box physics and shot ray, the lounge's slide-hop, three hitscan guns, bots,
   the round, the HUD and the menus. Nothing calls /api/. Stage 2 moves the authority (positions, shots, the clock) to the arcade server. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { material, skin as skinTex } from "./tex.js?v=1";
import { play, setVolume, ensure as audioOn } from "./audio.js?v=1";
import { MAPS, MAP_LIST } from "./maps.js?v=1";
import { profile, award, need, SKINS, COLORS, owns, wear, kd, accuracy, recordRound, titleFor, XP, save } from "./profile.js?v=1";

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const EMBED = new URLSearchParams(location.search).has("embed");
if (EMBED) document.documentElement.classList.add("embed");

const G = -26, JUMP = 9.4, RUN = 7.2, ACC_GROUND = 42, ACC_AIR = 13, R = 0.5, STEP = 1 / 120, EYE = 0.85, HEAD_Y = 0.62, STEP_UP = 0.62;
const PLAYERS = 12, ROUND_S = 300, MAX_HP = 100, REGEN_AFTER = 5, REGEN_RATE = 12, RESPAWN_S = 3;
const SL = { min: 3, start: 0.9, perfect: 1.1, window: 0.3, decay: 0.35, long: 1.4, hop: 0.4, max: 15, drain: 5, cd: 0.5 };
const NAMES = ["You", "bootypaper", "heartlarva", "andyreidisapawg", "zwades", "cenozoicmegafauna", "drhealsgud", "psilocyboone", "fasteddie", "aallldeeeez", "charleskellybirdlaw", "therealb4nksy"];
const GUNS = {
  ar: { n: "Assault rifle", dmg: 22, cd: 0.11, mag: 30, reload: 1.6, spread: 0.014, pellets: 1, range: 80, auto: true, text: "Fast and forgiving. 22 a hit, 30 rounds." },
  sniper: { n: "Sniper", dmg: 85, cd: 1.1, mag: 5, reload: 2.2, spread: 0.0, pellets: 1, range: 160, auto: false, scope: true, text: "One body shot nearly kills; a headshot does. Right click to scope. 5 rounds." },
  shotgun: { n: "Shotgun", dmg: 12, cd: 0.75, mag: 6, reload: 2.0, spread: 0.06, pellets: 8, range: 26, auto: false, text: "Eight pellets, brutal up close, nothing at range. 6 shells." }
};

/* ------------------------------------------------------------------ three */
const canvas = $("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, 16 / 9, 0.05, 400); camera.rotation.order = "YXZ"; scene.add(camera);
scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a5a3a, 1.1));
const sun = new THREE.DirectionalLight(0xfff4dc, 1.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 }); scene.add(sun, sun.target);
{ const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }); for (let k = 0; k < 16; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(rnd(4, 9), 8, 6), cm); c.scale.y = 0.4; c.position.set(rnd(-160, 160), rnd(30, 48), rnd(-160, 160)); scene.add(c); } }

/* ------------------------------------------------------------------ boxes: Brawl's oriented boxes, for the physics and the shot ray */
let boxes = [];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
class Box {
  constructor({ c, h, rx = 0, ry = 0 }) { this.c = new V3(...c); this.h = new V3(...h); this.rx = rx; this.ry = ry; this.flat = !rx && !ry; this.top = this.c.y + this.h.y; this.R = new THREE.Matrix3(); this.RT = new THREE.Matrix3(); this.radius = this.h.length(); _e.set(rx, ry, 0, "YXZ"); _q.setFromEuler(_e); _m4.makeRotationFromQuaternion(_q); this.R.setFromMatrix4(_m4); this.RT.copy(this.R).transpose(); }
}
const _d = new V3(), _l = new V3(), _cl = new V3(), _n = new V3();
function sphereBox(p, r, b, hit) {
  if (Math.abs(p.x - b.c.x) > b.radius + r || Math.abs(p.y - b.c.y) > b.radius + r || Math.abs(p.z - b.c.z) > b.radius + r) return null;
  _l.copy(p).sub(b.c).applyMatrix3(b.RT); _cl.set(clamp(_l.x, -b.h.x, b.h.x), clamp(_l.y, -b.h.y, b.h.y), clamp(_l.z, -b.h.z, b.h.z)); _d.copy(_l).sub(_cl); const dist = _d.length();
  if (dist > r) return null;
  if (dist > 1e-6) { _n.copy(_d).divideScalar(dist); hit.pen = r - dist; }
  else { const px = b.h.x - Math.abs(_l.x), py = b.h.y - Math.abs(_l.y), pz = b.h.z - Math.abs(_l.z); if (py <= px && py <= pz) { _n.set(0, Math.sign(_l.y) || 1, 0); hit.pen = r + py; } else if (px <= pz) { _n.set(Math.sign(_l.x) || 1, 0, 0); hit.pen = r + px; } else { _n.set(0, 0, Math.sign(_l.z) || 1); hit.pen = r + pz; } }
  hit.n.copy(_n).applyMatrix3(b.R); hit.point.copy(_cl).applyMatrix3(b.R).add(b.c); return hit;
}
const hit = { n: new V3(), point: new V3(), pen: 0 };
const _ro = new V3(), _rd = new V3();
function rayBox(o, d, b) {
  _ro.copy(o).sub(b.c).applyMatrix3(b.RT); _rd.copy(d).applyMatrix3(b.RT); let tmin = 0, tmax = 400;
  for (const ax of ["x", "y", "z"]) { const h = b.h[ax], ro = _ro[ax], rd = _rd[ax]; if (Math.abs(rd) < 1e-9) { if (ro < -h || ro > h) return Infinity; continue; } let t1 = (-h - ro) / rd, t2 = (h - ro) / rd; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return Infinity; }
  return tmin;
}
function raySphere(o, d, cx, cy, cz, r) { const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz, b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c; if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t >= 0 ? t : Infinity; }
function cast(o, d, shooter, range = 80) {
  let best = range, bean = null, head = false;
  for (const b of boxes) { const tt = rayBox(o, d, b); if (tt < best) { best = tt; bean = null; } }
  for (const b of beans) { if (b === shooter || b.dead) continue; const th = raySphere(o, d, b.p.x, b.p.y + HEAD_Y, b.p.z, 0.36); if (th < best) { best = th; bean = b; head = true; } const tb = raySphere(o, d, b.p.x, b.p.y, b.p.z, 0.5); if (tb < best) { best = tb; bean = b; head = false; } }
  return { t: best, bean, head, point: o.clone().addScaledVector(d, best) };
}
/** The height of the ground under (x, z) from a height, for tests and spawns: a ray straight down. */
function groundAt(x, z, from = 50) { const o = new V3(x, from, z), d = new V3(0, -1, 0); let best = Infinity; for (const b of boxes) best = Math.min(best, rayBox(o, d, b)); return from - best; }

/* ------------------------------------------------------------------ the map: built into one mesh per texture, UVs in world units */
let map = null, mapMeshes = [], pads = [];
function buildMap(key) {
  for (const m of mapMeshes) { scene.remove(m); m.geometry.dispose(); } mapMeshes = []; boxes = []; pads = [];
  map = MAPS[key](); map.key = key;
  scene.background = new THREE.Color(map.sky); scene.fog = new THREE.Fog(map.sky, map.fog[0], map.fog[1]);
  const byMat = new Map();
  for (const m of map.boxes) {
    boxes.push(new Box(m));
    const g = new THREE.BoxGeometry(m.h[0] * 2, m.h[1] * 2, m.h[2] * 2), uv = g.attributes.uv;
    const W = m.h[0], H = m.h[1], D = m.h[2];   // tile every texture to 2 m: a face's UVs run 0..1, so scale by its size in metres / 2
    for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), sx = f < 2 ? D : f < 4 ? W : W, sy = f < 2 ? H : f < 4 ? D : H; uv.setXY(i, uv.getX(i) * (m.tex === "crate" || m.tex === "pad" ? 1 : sx), uv.getY(i) * (m.tex === "crate" || m.tex === "pad" ? 1 : sy)); }
    _e.set(m.rx || 0, m.ry || 0, 0, "YXZ"); _q.setFromEuler(_e); g.applyMatrix4(_m4.compose(new V3(...m.c), _q, new V3(1, 1, 1)));
    const k = `${m.tex}:${m.col}`; if (!byMat.has(k)) byMat.set(k, { mat: material(m.tex, m.col), list: [] }); byMat.get(k).list.push(g);
  }
  for (const { mat, list } of byMat.values()) { const mesh = new THREE.Mesh(mergeGeometries(list, false), mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); mapMeshes.push(mesh); for (const g of list) g.dispose(); }
  pads = map.pads;
}

/* ------------------------------------------------------------------ beans and skins */
const skinMat = (pattern, colKey) => new THREE.MeshStandardMaterial({ map: skinTex(pattern, COLORS[colKey] ?? 0xffd84a), roughness: pattern === "gold" || pattern === "carbon" ? 0.3 : 0.5, metalness: pattern === "gold" ? 0.6 : pattern === "carbon" ? 0.3 : 0 });
function makeBean(sk) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), skinMat(sk.pattern, sk.body)); body.castShadow = true; body.position.y = 0.7; g.add(body);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: COLORS[sk.visor] ?? 0xffffff, roughness: 0.2, metalness: sk.visor === "gold" ? 0.6 : 0 }));
  visor.scale.set(1, 0.55, 0.6); visor.rotation.x = Math.PI / 2; visor.position.set(0, 0.98, -0.3); g.add(visor);
  for (const x of [-0.11, 0.11]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: sk.visor === "black" ? 0xffffff : 0x111111 })); eye.position.set(x, 1.0, -0.45); g.add(eye); }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), skinMat(sk.gun, "black")); gun.position.set(0.38, 0.75, -0.35); g.add(gun);
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); tag.scale.set(2.2, 0.55, 1); tag.position.y = 1.9; g.add(tag);
  scene.add(g); return { g, body, visor, gun, tag, tagCanvas: c, tagKey: "" };
}
function paintTag(b) {
  const key = `${b.name}|${Math.round(b.hp)}`; if (key === b.mesh.tagKey) return; b.mesh.tagKey = key;
  const c = b.mesh.tagCanvas, x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height);
  x.textAlign = "center"; x.lineWidth = 5; x.strokeStyle = "#000"; x.font = "800 26px Lora, Georgia, serif"; x.strokeText(b.name, 128, 30); x.fillStyle = "#fff"; x.fillText(b.name, 128, 30);
  x.fillStyle = "#000"; x.fillRect(48, 40, 160, 10); x.fillStyle = b.hp > 50 ? "#8ae07a" : b.hp > 25 ? "#ffd84a" : "#ff5a5a"; x.fillRect(50, 42, 156 * clamp(b.hp / MAX_HP, 0, 1), 6);
  b.mesh.tag.material.map.needsUpdate = true;
}
const randomSkin = () => ({ body: pick(SKINS.body).k, pattern: pick(["plain", "plain", "stripes", "camo", "hex"]), visor: pick(SKINS.visor).k, gun: pick(["plain", "plain", "stripes", "camo"]) });
const beans = [];
for (let i = 0; i < PLAYERS; i++) beans.push({ i, name: NAMES[i], bot: i > 0, mesh: makeBean(i ? randomSkin() : profile.skin), p: new V3(), v: new V3(), facing: 0, skill: rnd(0.3, 0.85), gun: "ar", slide: false, slideT: 0, slideCd: 0, landT: 9 });
beans[0].mesh.g.visible = false;   // first person: you don't see your own bean
function redressMe() { const b = beans[0]; scene.remove(b.mesh.g); b.mesh = makeBean(profile.skin); b.mesh.g.visible = false; viewGunBody.material = skinMat(profile.skin.gun, "black"); }

// the gun in your hands
const viewGun = new THREE.Group(); let viewGunBody;
{
  viewGunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.62), skinMat(profile.skin.gun, "black"));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x55555f })); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.45;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); grip.position.set(0, -0.14, 0.14);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a22 })); mag.position.set(0, -0.12, -0.08);
  viewGun.add(viewGunBody, barrel, grip, mag); viewGun.scale.setScalar(0.55); viewGun.position.set(0.2, -0.17, -0.42); camera.add(viewGun);
}

/* ------------------------------------------------------------------ input */
const keys = {};
let yaw = 0, pitch = 0, locked = false, mouseFire = false, scoping = false, dragLook = false, lastX = 0, lastY = 0, fireLatch = false, nextGun = "ar";
const sens = () => 0.0022 * profile.settings.sens * (scoping ? 0.35 : 1), inv = () => (profile.settings.invertY ? -1 : 1);
addEventListener("keydown", (e) => {
  if (!locked && document.activeElement !== canvas) return; keys[e.code] = true;
  if (e.code === "Tab") { $("board").hidden = false; drawBoard(); e.preventDefault(); }
  if (e.code === "Digit1") nextGun = "ar"; if (e.code === "Digit2") nextGun = "sniper"; if (e.code === "Digit3") nextGun = "shotgun";
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Tab") $("board").hidden = true; });
function grabMouse() { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch {} }
canvas.addEventListener("click", () => { if (state === "play" || state === "count") grabMouse(); canvas.focus(); audioOn(); });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; $("lockHint").hidden = locked || state !== "play"; });
addEventListener("mousemove", (e) => {
  if (locked) { yaw -= e.movementX * sens(); pitch = clamp(pitch - e.movementY * sens() * inv(), -1.45, 1.45); }
  else if (dragLook) { yaw -= (e.clientX - lastX) * 0.005; pitch = clamp(pitch - (e.clientY - lastY) * 0.005 * inv(), -1.45, 1.45); lastX = e.clientX; lastY = e.clientY; }
});
canvas.addEventListener("mousedown", (e) => { if (e.button === 0) { mouseFire = true; if (!locked) { dragLook = true; lastX = e.clientX; lastY = e.clientY; } } if (e.button === 2) scoping = Boolean(GUNS[beans[0].gun].scope); });
addEventListener("mouseup", (e) => { if (e.button === 0) { mouseFire = false; dragLook = false; } if (e.button === 2) scoping = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const lookDir = (out) => out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
function playerInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (keys.ArrowLeft) yaw += 0.04; if (keys.ArrowRight) yaw -= 0.04;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = fx * f + rx * s, z = fz * f + rz * s, l = Math.hypot(x, z), fire = mouseFire || keys.KeyJ;
  const inp = { x: l > 1 ? x / l : x, z: l > 1 ? z / l : z, jump: keys.Space, fire, fireTap: fire && !fireLatch, slide: keys.ShiftLeft || keys.ShiftRight, reload: keys.KeyR };
  fireLatch = fire; return inp;
}

/* ------------------------------------------------------------------ shots and effects */
const fx = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true });
function tracer(from, to, mine) {
  const g = new THREE.BufferGeometry().setFromPoints([from, to]); const line = new THREE.Line(g, tracerMat.clone()); line.material.color.set(mine ? 0xffe27a : 0xff9a6a); scene.add(line); fx.push({ o: line, life: 0.08, max: 0.08 });
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true })); puff.position.copy(to); scene.add(puff); fx.push({ o: puff, life: 0.2, max: 0.2, grow: 2.5 });
}
let hitTimer = 0, killTimer = 0;
function flashDamage() { const el = $("hurt"); el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
const me = () => beans[0];
const meStats = { shots: 0, hits: 0, headshots: 0, byGun: {} };
const gunStat = (g) => (meStats.byGun[g] ||= { kills: 0, shots: 0, hits: 0 });
function damage(target, dmg, from, head) {
  if (target.dead) return;
  target.hp -= dmg; target.hurtT = t; target.lastBy = from; target.lastByT = t; paintTag(target);
  if (from && !from.bot) { hitTimer = 0.14; from.hits++; meStats.hits++; gunStat(from.gun).hits++; if (head) meStats.headshots++; play(head ? "headshot" : "hit"); floatText(target.p, head ? `${Math.round(dmg)} HS` : `${Math.round(dmg)}`, head ? "#ffd84a" : "#fff"); }
  if (!target.bot) { flashDamage(); play("hurt"); }
  if (target.hp <= 0) kill(target, from, head);
}
function fire(b, dir) {
  const g = GUNS[b.gun]; b.cd = g.cd; b.ammo--; b.shots++;
  if (!b.bot) { meStats.shots++; gunStat(b.gun).shots++; }
  const eye = b.p.clone(); eye.y += EYE;
  for (let k = 0; k < g.pellets; k++) {
    const d = dir.clone(); const sp = g.spread * (b.bot ? 1 : scoping ? 0.1 : 1) * (b.grounded ? 1 : 2.2); d.x += rnd(-sp, sp); d.y += rnd(-sp, sp); d.z += rnd(-sp, sp); d.normalize();
    const r = cast(eye, d, b, g.range);
    if (k === 0 || g.pellets > 1) { const muzzle = b.bot ? eye.clone().addScaledVector(dir, 0.6) : camera.localToWorld(new V3(0.2, -0.15, -0.75)); tracer(muzzle, r.point, !b.bot); }
    if (r.bean) damage(r.bean, g.dmg * (r.head ? 1.6 : 1) * (g.pellets > 1 ? clamp(1.4 - r.t / g.range, 0.3, 1) : 1), b, r.head);
  }
  if (!b.bot) { viewGun.position.z = -0.3; play(b.gun); } else play(b.gun, clamp(0.6 - b.p.distanceTo(me().p) / 70, 0, 0.6));
}
function reload(b) { const g = GUNS[b.gun]; if (b.reloading || b.ammo === g.mag) return; b.reloading = g.reload; if (!b.bot) play("reload"); }

/* ------------------------------------------------------------------ the round: kills, respawns, the feed */
let t = 0, roundT = 0, state = "menu", countdown = 0, countBeep = 0;
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function feed(html, cls = "") { const F = $("feed"); const p = document.createElement("p"); p.className = cls; p.innerHTML = html; F.append(p); setTimeout(() => p.remove(), 5000); while (F.childElementCount > 6) F.firstChild.remove(); }
function log(s, good) { const L = $("log"); const p = document.createElement("p"); if (good) p.className = "good"; p.textContent = `${fmtT(roundT)} ${s}`; L.prepend(p); while (L.childElementCount > 40) L.lastChild.remove(); }
function kill(target, by, head) {
  target.dead = true; target.respawn = RESPAWN_S; target.deaths++; target.streak = 0; target.mesh.g.visible = false; target.slide = false;
  const suicide = !by || by === target;
  if (!suicide) { by.kills++; by.streak++; by.bestStreak = Math.max(by.bestStreak || 0, by.streak); if (!by.bot) { gunStat(by.gun).kills++; if (by.streak % 3 === 0) { meStats.streaks = (meStats.streaks || 0) + 1; } } }
  const who = (b) => (b.bot ? esc(b.name) : "<b>you</b>");
  feed(suicide ? `${who(target)} fell` : `${who(by)} ${head ? "🎯" : "▸"} ${who(target)}`, by && !by.bot ? "me" : !target.bot ? "dead" : "");
  log(suicide ? `${target.bot ? target.name : "You"} fell.` : `${by.bot ? by.name : "You"} killed ${target.bot ? target.name : "you"}${head ? " (headshot)" : ""}.`, by && !by.bot);
  if (by && !by.bot) { killTimer = 0.4; play("kill"); if (by.streak === 3) { say("TRIPLE KILL"); play("streak"); } else if (by.streak === 5) { say("RAMPAGE"); play("streak"); } else if (by.streak >= 8 && by.streak % 4 === 0) { say("UNSTOPPABLE"); play("streak"); } }
  if (!target.bot) { say("YOU DIED", `${by && by !== target ? `${by.name} got you` : "You fell"} · back in ${RESPAWN_S}s`); play("die"); document.exitPointerLock?.(); }
  drawSb();
}
function spawnFor(b) {
  let best = map.spawns[0], bd = -1;
  for (const s of map.spawns) { let d = 1e9; for (const o of beans) if (o !== b && !o.dead) d = Math.min(d, Math.hypot(o.p.x - s[0], o.p.z - s[2])); d += rnd(0, 3); if (d > bd) { bd = d; best = s; } }
  b.p.set(best[0], best[1] + 0.2, best[2]); b.v.set(0, 0, 0); b.facing = Math.atan2(-best[0], -best[2]);
  if (!b.bot) { yaw = Math.atan2(-best[0], -best[2]); pitch = -0.05; }
}
function respawn(b) {
  b.dead = false; b.hp = MAX_HP; b.hurtT = -99; b.gun = b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun; b.ammo = GUNS[b.gun].mag; b.reloading = 0; b.cd = 0.3; b.slide = false;
  spawnFor(b); if (b.bot) b.mesh.g.visible = true; paintTag(b); if (!b.bot) { $("hudGun").textContent = GUNS[b.gun].n; say(""); play("spawn"); if (state === "play") grabMouse(); }
}
function say(text, sub = "") { $("hudMsg").textContent = text; $("hudSub").textContent = sub; clearTimeout(say.t); if (text && !sub) say.t = setTimeout(() => { if ($("hudMsg").textContent === text) $("hudMsg").textContent = ""; }, 1400); }
const floats = [];
function floatText(p, text, col) { if (floats.length > 30) return; const c = document.createElement("canvas"); c.width = 128; c.height = 64; const x = c.getContext("2d"); x.textAlign = "center"; x.font = "800 36px Lora, serif"; x.lineWidth = 6; x.strokeStyle = "#000"; x.strokeText(text, 64, 44); x.fillStyle = col; x.fillText(text, 64, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(1.1, 0.55, 1); s.position.set(p.x + rnd(-0.3, 0.3), p.y + 1.3, p.z); scene.add(s); floats.push({ s, life: 0.7 }); }

/* ------------------------------------------------------------------ bots */
function canSee(b, o) { const eye = b.p.clone(); eye.y += EYE; const d = new V3(o.p.x - b.p.x, o.p.y + 0.3 - eye.y, o.p.z - b.p.z); const dist = d.length(); d.divideScalar(dist); return cast(eye, d, b, dist + 1).bean === o; }
function botBrain(b, dt) {
  b.think -= dt; b.strafeT -= dt; b.look -= dt;
  if (b.look <= 0) {
    b.look = rnd(0.25, 0.5); let best = null, bs = 1e9;
    for (const o of beans) { if (o === b || o.dead) continue; const d = o.p.distanceTo(b.p); if (d < bs && d < 50 && canSee(b, o)) { bs = d; best = o; } }
    if (best) { b.target = best; b.lostT = 0; } else if (b.target) { b.lostT = (b.lostT || 0) + 0.4; if (b.lostT > 2.5 || b.target.dead) b.target = null; }
  }
  if (b.strafeT <= 0) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeT = rnd(0.5, 1.4); }
  let mx = 0, mz = 0, fireNow = false, jump = false;
  const tg = b.target;
  if (tg) {
    const dx = tg.p.x - b.p.x, dz = tg.p.z - b.p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const want = b.gun === "shotgun" ? 4 : b.gun === "sniper" ? 18 : 10, along = d > want + 3 ? 1 : d < want - 3 ? -0.7 : 0;
    mx = ux * along + -uz * b.strafe * 0.9; mz = uz * along + ux * b.strafe * 0.9; b.facing = Math.atan2(ux, uz) + Math.PI;
    if (b.cd <= 0 && !b.reloading && b.react <= 0 && b.ammo > 0) {
      const lead = d / 90, aim = new V3(tg.p.x + tg.v.x * lead - b.p.x, tg.p.y + (Math.random() < b.skill * 0.35 ? HEAD_Y : 0.1) - (b.p.y + EYE), tg.p.z + tg.v.z * lead - b.p.z).normalize();
      const spread = 0.03 + 0.14 * (1 - b.skill) + (Math.hypot(b.v.x, b.v.z) > 6 ? 0.04 : 0) + (Math.hypot(tg.v.x, tg.v.z) > 8 ? 0.05 : 0);
      aim.x += rnd(-spread, spread); aim.y += rnd(-spread, spread) * 0.5; aim.z += rnd(-spread, spread); aim.normalize();
      b.aim = aim; fireNow = true; b.react = GUNS[b.gun].auto ? rnd(0.06, 0.22) : rnd(0.35, 0.9) * (1.3 - b.skill);
    }
  } else {
    if (!b.wp || Math.hypot(b.wp[0] - b.p.x, b.wp[1] - b.p.z) < 1.5 || b.think <= 0) { b.wp = pick(map.waypoints); b.think = rnd(4, 8); }
    const dx = b.wp[0] - b.p.x, dz = b.wp[1] - b.p.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; b.facing = Math.atan2(mx, mz) + Math.PI;
  }
  b.react = Math.max(0, b.react - dt);
  if (b.ammo === 0 && !b.reloading) reload(b);
  const sp = Math.hypot(b.v.x, b.v.z); if (b.grounded && (mx || mz) && sp < 1.5) { b.stuck += dt; if (b.stuck > 0.4) jump = true; if (b.stuck > 2) { b.wp = pick(map.waypoints); b.stuck = 0; } } else b.stuck = 0;
  if (b.grounded && tg && Math.random() < dt * (0.3 + (MAX_HP - b.hp) * 0.01)) jump = true;
  return { x: mx, z: mz, jump, fire: fireNow, fireTap: fireNow, slide: false, reload: false };
}

/* ------------------------------------------------------------------ the step */
function stepBean(b, dt) {
  if (b.dead) { b.respawn -= dt; if (b.respawn <= 0 && state === "play") respawn(b); return; }
  const inp = state !== "play" ? { x: 0, z: 0 } : b.bot ? botBrain(b, dt) : playerInput();
  b.cd = Math.max(0, b.cd - dt);
  if (b.reloading) { b.reloading -= dt; if (b.reloading <= 0) { b.reloading = 0; b.ammo = GUNS[b.gun].mag; } }
  if (inp.reload) reload(b);
  if (t - b.hurtT > REGEN_AFTER && b.hp < MAX_HP) { b.hp = Math.min(MAX_HP, b.hp + REGEN_RATE * dt); paintTag(b); }
  let hs = Math.hypot(b.v.x, b.v.z);
  const want = Math.hypot(inp.x, inp.z) > 0.1 ? Math.atan2(inp.x, inp.z) : null;
  const steer = (rate) => { if (want === null || hs < 0.1) return; let h = Math.atan2(b.v.x, b.v.z); h += clamp(Math.atan2(Math.sin(want - h), Math.cos(want - h)), -rate * dt, rate * dt); b.v.x = Math.sin(h) * hs; b.v.z = Math.cos(h) * hs; };
  const setSpeed = (v) => { if (hs > 1e-3) { b.v.x *= v / hs; b.v.z *= v / hs; } hs = v; };
  b.landT += dt; b.slideCd = Math.max(0, b.slideCd - dt); b.coyote = b.grounded ? 0.1 : Math.max(0, b.coyote - dt);
  if (!b.slide && b.grounded && inp.slide && hs > SL.min) { b.slide = true; b.slideT = 0; const kick = (b.slideCd > 0 ? 0 : SL.start) + (b.landT < SL.window ? SL.perfect : 0); if (kick) setSpeed(Math.min(SL.max, hs + kick)); if (!b.bot) play("slide"); }
  const jumped = inp.jump && b.coyote > 0 && b.v.y < 3;
  if (b.slide) { b.slideT += dt; steer(1.8); setSpeed(hs * Math.exp(-(b.slideT > SL.long ? 3 : SL.decay) * dt)); if (jumped) setSpeed(Math.min(SL.max, hs + SL.hop)); if (jumped || !inp.slide || !b.grounded || hs < SL.min * 0.7) { b.slide = false; b.slideCd = SL.cd; } }
  else if (hs > RUN + 0.2) { if (b.grounded) { steer(4); setSpeed(Math.max(RUN, hs - SL.drain * dt)); } else steer(2.6); }
  else { const acc = b.grounded ? ACC_GROUND : ACC_AIR; b.v.x += clamp(inp.x * RUN - b.v.x, -acc * dt, acc * dt); b.v.z += clamp(inp.z * RUN - b.v.z, -acc * dt, acc * dt); }
  if (jumped) { b.v.y = JUMP; b.coyote = 0; b.grounded = false; if (!b.bot) play("jump"); }
  const g = GUNS[b.gun];
  if ((g.auto ? inp.fire : inp.fireTap) && b.cd <= 0 && !b.reloading) { if (b.ammo > 0) fire(b, b.bot ? b.aim : lookDir(new V3())); else { reload(b); if (!b.bot) play("empty"); } }
  if (b.bot && Math.hypot(inp.x, inp.z) > 0.1 && !b.target) b.facing = Math.atan2(inp.x, inp.z) + Math.PI;
  b.v.y += G * dt; b.p.addScaledVector(b.v, dt);
  const wasGrounded = b.grounded; b.grounded = false;
  for (const box of boxes) {
    if (!sphereBox(b.p, R, box, hit)) continue;
    // a low ledge (a rail, a crate, a kerb) is stepped onto rather than run into: that's what keeps a slide alive (STEP_UP)
    if (box.flat && Math.abs(hit.n.y) < 0.3 && box.top - (b.p.y - R) < STEP_UP && box.top > b.p.y - R) { b.p.y = box.top + R + 0.01; b.grounded = true; continue; }
    b.p.addScaledVector(hit.n, hit.pen); const vn = b.v.dot(hit.n); if (vn < 0) b.v.addScaledVector(hit.n, -vn); if (hit.n.y > 0.6) b.grounded = true;
  }
  if (b.grounded && !wasGrounded) b.landT = 0;
  // jump pads: stand on one and go
  if (b.grounded && b.v.y <= 0.5) for (const pd of pads) if (Math.abs(b.p.x - pd.x) < 1.2 && Math.abs(b.p.z - pd.z) < 1.2 && b.p.y < 1.2) { b.v.y = pd.up; if (pd.fwd) { b.v.x += pd.fwd.x; b.v.z += pd.fwd.z; } b.grounded = false; b.slide = false; if (!b.bot) play("pad"); else play("pad", 0.2); break; }
  if (b.p.y < -10) kill(b, null, false);
}
function stepWorld(dt) {
  t += dt; if (state === "play") roundT += dt;
  for (const b of beans) stepBean(b, dt);
  for (let i = 0; i < beans.length; i++) for (let j = i + 1; j < beans.length; j++) { const a = beans[i], c = beans[j]; if (a.dead || c.dead) continue; _d.copy(c.p).sub(a.p); const d = _d.length(); if (d < R * 2 && d > 1e-4) { _d.divideScalar(d); const push = (R * 2 - d) / 2; a.p.addScaledVector(_d, -push); c.p.addScaledVector(_d, push); } }
}

/* ------------------------------------------------------------------ rounds and the menus */
let mapKey = MAP_LIST[0];
function reset() {
  t = 0; roundT = 0; $("log").innerHTML = ""; $("feed").innerHTML = ""; Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 });
  for (const f of fx) scene.remove(f.o); fx.length = 0;
  for (const b of beans) { Object.assign(b, { hp: MAX_HP, dead: false, respawn: 0, kills: 0, deaths: 0, streak: 0, bestStreak: 0, hits: 0, shots: 0, cd: 0.5, reloading: 0, react: rnd(0.5, 1.5), grounded: false, coyote: 0, hurtT: -99, target: null, think: 0, look: rnd(0, 0.5), strafe: 1, strafeT: 0, stuck: 0, wp: null, lastBy: null, lastByT: -99, slide: false, slideCd: 0, landT: 9 }); b.p.set(0, -50, 0); }
  for (const b of beans) respawn(b);
  drawSb();
}
let overTimer = 0;
function start() { clearTimeout(overTimer); buildMap(mapKey); reset(); state = "count"; countdown = 3; countBeep = 3; $("over").hidden = true; canvas.focus(); grabMouse(); audioOn(); $("hudMap").textContent = map.name; }
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
const ranked = () => beans.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
function endRound() {
  if (state !== "play") return; state = "done"; document.exitPointerLock?.();
  const ranks = ranked(), m = me(), place = ranks.indexOf(m) + 1, won = place === 1;
  play(won ? "win" : "lose");
  // XP for the round, then the lifetime stats
  const lines = [[`${m.kills} kills`, m.kills * XP.kill], [`${meStats.headshots} headshots`, meStats.headshots * (XP.headshot - XP.kill)], [`${meStats.streaks || 0} streaks of three`, (meStats.streaks || 0) * XP.streak3], ["Finished the round", XP.round]];
  if (won) lines.push(["Won the round", XP.win]);
  const total = lines.reduce((n, l) => n + l[1], 0), before = { level: profile.level, xp: profile.xp };
  const res = award(total);
  recordRound({ map: mapKey, gun: nextGun, kills: m.kills, deaths: m.deaths, headshots: meStats.headshots, shots: meStats.shots, hits: meStats.hits, won, streak: m.bestStreak || 0, seconds: roundT, byGun: meStats.byGun });
  const pct = Math.round((profile.xp / need(profile.level)) * 100);
  showMenu("result", `<b>${won ? "You win!" : `${esc(ranks[0].name)} wins`}</b>
    <p>You came <b>${ord(place)}</b> of ${PLAYERS} on ${esc(map.name)} · <b>${m.kills}</b> kills, <b>${m.deaths}</b> deaths · ${meStats.shots ? Math.round((meStats.hits / meStats.shots) * 100) : 0}% accuracy · best streak ${m.bestStreak || 0}.</p>
    <div class="xp"><div class="xpl">${lines.map(([n, v]) => `<span>${esc(n)}</span><b>+${v}</b>`).join("")}<span>Total</span><b>+${total} XP</b></div>
      <div class="lvl"><b>Level ${profile.level}</b> <small>${esc(titleFor(profile.level))}</small><div class="bar"><i style="width:${pct}%"></i></div><small>${profile.xp} / ${need(profile.level)} to level ${profile.level + 1}</small></div>
      ${res.gained ? `<div class="up">LEVEL UP${res.gained > 1 ? ` ×${res.gained}` : ""} · now level ${profile.level}${res.unlocked.length ? ` · unlocked: ${res.unlocked.map((u) => esc(u.n)).join(", ")}` : ""}</div>` : ""}</div>
    <table class="sb" style="min-width:300px">${ranks.map((b, k) => `<tr class="${b.bot ? "" : "me"}"><td>${ord(k + 1)}</td><td>${esc(b.name)}</td><td>${b.kills} / ${b.deaths}</td></tr>`).join("")}</table>`);
  if (res.gained) setTimeout(() => play("levelup"), 700);
  $("over").hidden = true; overTimer = setTimeout(() => { $("over").hidden = false; }, 900);
  drawProfile();
}

/* ---- the menu: Play (map + gun), Locker, Stats, Settings */
let tab = "play";
function showMenu(which, html) { tab = which; for (const b of document.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === which); if (html !== undefined) $("panel").innerHTML = html; else drawMenu(); $("over").hidden = false; }
function drawMenu() {
  if (tab === "play") $("panel").innerHTML = `<b>Free-for-all</b><p>Five minutes, most kills wins. <b>Shift</b> slides, <b>Space</b> hops out of a slide and keeps the speed; chain them. Jump pads fly you onto the roofs.</p>
    <p class="eyebrow">Map</p><div class="maps">${MAP_LIST.map((k) => { const m = MAPS[k](); return `<button class="mapc${k === mapKey ? " on" : ""}" data-map="${k}"><b>${esc(m.name)}</b>${esc(m.blurb)}</button>`; }).join("")}</div>
    <p class="eyebrow">Gun</p><div class="guns">${Object.entries(GUNS).map(([k, g], i) => `<button class="gun${k === nextGun ? " on" : ""}" data-gun="${k}"><b>${i + 1} · ${esc(g.n)}</b>${esc(g.text)}</button>`).join("")}</div>
    <button class="go" data-go="1">Play</button>`;
  else if (tab === "locker") {
    const sw = (slot, s) => { const col = slot === "body" || slot === "visor" ? COLORS[s.k] : null; const on = profile.skin[slot] === s.k, have = owns(slot, s.k);
      return `<button class="sw${on ? " on" : ""}${have ? "" : " lock"}" data-slot="${slot}" data-k="${s.k}" title="${have ? esc(s.n) : `${esc(s.n)} · level ${s.lvl}`}"><i class="p-${slot === "body" || slot === "visor" ? "plain" : s.k}" style="--c:${col !== null ? "#" + col.toString(16).padStart(6, "0") : "#" + (COLORS[profile.skin.body] || 0xffd84a).toString(16).padStart(6, "0")}"></i><span>${have ? esc(s.n) : `🔒 ${s.lvl}`}</span></button>`; };
    $("panel").innerHTML = `<b>Locker</b><p>Level <b>${profile.level}</b> · ${esc(titleFor(profile.level))}. Skins unlock by level; nothing is bought. Bots wear whatever they like.</p>
      <div class="locker"><canvas id="pv" width="220" height="260"></canvas><div>
      ${[["body", "Body colour"], ["pattern", "Body pattern"], ["visor", "Visor"], ["gun", "Gun finish"]].map(([slot, n]) => `<p class="eyebrow">${n}</p><div class="sws">${SKINS[slot].map((s) => sw(slot, s)).join("")}</div>`).join("")}</div></div>`;
    drawPreview();
  } else if (tab === "stats") {
    const s = profile.stats, guns = Object.entries(s.byGun), maps = Object.entries(s.byMap);
    $("panel").innerHTML = `<b>Your stats</b><p>Level <b>${profile.level}</b> · ${esc(titleFor(profile.level))} · ${profile.xp} / ${need(profile.level)} XP to the next.</p>
      <div class="grid4"><div><b>${s.kills}</b><span>kills</span></div><div><b>${s.deaths}</b><span>deaths</span></div><div><b>${kd()}</b><span>K/D</span></div><div><b>${accuracy()}%</b><span>accuracy</span></div>
      <div><b>${s.headshots}</b><span>headshots</span></div><div><b>${s.wins}</b><span>wins</span></div><div><b>${s.rounds}</b><span>rounds</span></div><div><b>${s.bestStreak}</b><span>best streak</span></div>
      <div><b>${Math.round(s.seconds / 60)}m</b><span>played</span></div><div><b>${s.rounds ? (s.kills / s.rounds).toFixed(1) : 0}</b><span>kills a round</span></div><div><b>${s.rounds ? Math.round((s.wins / s.rounds) * 100) : 0}%</b><span>win rate</span></div><div><b>${s.kills ? Math.round((s.headshots / s.kills) * 100) : 0}%</b><span>headshot rate</span></div></div>
      ${guns.length ? `<p class="eyebrow">By gun</p><table class="sb">${guns.map(([g, v]) => `<tr><td>${esc(GUNS[g]?.n || g)}</td><td>${v.kills} kills</td><td>${v.shots ? Math.round((v.hits / v.shots) * 100) : 0}%</td></tr>`).join("")}</table>` : ""}
      ${maps.length ? `<p class="eyebrow">By map</p><table class="sb">${maps.map(([k, v]) => `<tr><td>${esc(MAPS[k] ? MAPS[k]().name : k)}</td><td>${v.rounds} rounds</td><td>${v.wins} wins</td></tr>`).join("")}</table>` : ""}
      <p class="note">Kept in this browser for now. When the game runs on the arcade server, the server counts every kill and these follow your Twitch account.</p>`;
  } else if (tab === "settings") {
    const st = profile.settings;
    $("panel").innerHTML = `<b>Settings</b>
      <label class="set"><span>Mouse sensitivity</span><input type="range" min="0.3" max="3" step="0.1" value="${st.sens}" data-set="sens"><output>${st.sens.toFixed(1)}×</output></label>
      <label class="set"><span>Field of view</span><input type="range" min="60" max="110" step="1" value="${st.fov}" data-set="fov"><output>${st.fov}°</output></label>
      <label class="set"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="${st.volume}" data-set="volume"><output>${Math.round(st.volume * 100)}%</output></label>
      <label class="set"><span>Invert mouse Y</span><input type="checkbox" ${st.invertY ? "checked" : ""} data-set="invertY"><output></output></label>
      <label class="set"><span>Crosshair</span><select data-set="crosshair"><option value="cross"${st.crosshair === "cross" ? " selected" : ""}>Cross</option><option value="dot"${st.crosshair === "dot" ? " selected" : ""}>Dot</option></select><output></output></label>
      <p class="note">Saved in this browser.</p>`;
  }
}
$("over").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return; play("click");
  if (b.dataset.tab) return showMenu(b.dataset.tab);
  if (b.dataset.map) { mapKey = b.dataset.map; return drawMenu(); }
  if (b.dataset.gun) { nextGun = b.dataset.gun; return drawMenu(); }
  if (b.dataset.go) return start();
  if (b.dataset.slot) { if (wear(b.dataset.slot, b.dataset.k)) { redressMe(); drawMenu(); } else say(""); }
});
$("over").addEventListener("input", (e) => {
  const el = e.target.closest("[data-set]"); if (!el) return; const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
  profile.settings[k] = v; save(); const out = el.parentElement.querySelector("output"); if (out) out.textContent = k === "sens" ? `${v.toFixed(1)}×` : k === "fov" ? `${v}°` : k === "volume" ? `${Math.round(v * 100)}%` : "";
  if (k === "volume") setVolume(v); if (k === "crosshair") $("xhair").dataset.style = v;
});
setVolume(profile.settings.volume); $("xhair").dataset.style = profile.settings.crosshair;
// the locker's preview: your bean on its own little stage
let pvR = null;
function drawPreview() {
  const c = $("pv"); if (!c) return; if (!pvR) pvR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, c.width / c.height, 0.1, 20); cam.position.set(0, 1.3, 4.2); cam.lookAt(0, 0.85, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4)); const l = new THREE.DirectionalLight(0xffffff, 1.2); l.position.set(2, 4, 3); sc.add(l);
  const sk = profile.skin, g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), skinMat(sk.pattern, sk.body)); body.position.y = 0.7; g.add(body);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: COLORS[sk.visor] ?? 0xffffff, roughness: 0.2 })); visor.scale.set(1, 0.55, 0.6); visor.rotation.x = Math.PI / 2; visor.position.set(0, 0.98, -0.3); g.add(visor);
  for (const x of [-0.11, 0.11]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: sk.visor === "black" ? 0xffffff : 0x111111 })); eye.position.set(x, 1.0, -0.45); g.add(eye); }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), skinMat(sk.gun, "black")); gun.position.set(0.38, 0.75, -0.35); g.add(gun);
  g.rotation.y = Math.PI + 0.5; sc.add(g); pvR.setSize(c.width, c.height, false); pvR.render(sc, cam);
}
function drawProfile() { $("hudLevel").textContent = `Lv ${profile.level} · ${titleFor(profile.level)}`; $("menuLevel").textContent = `Level ${profile.level} · ${titleFor(profile.level)} · ${profile.stats.kills} kills · K/D ${kd()}`; }

/* ------------------------------------------------------------------ drawing */
function drawSb() { $("sb").innerHTML = ranked().map((b, k) => `<tr class="${b.bot ? "" : "me"}"><td>${k + 1}. ${esc(b.name)}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join(""); }
function drawBoard() { $("board").innerHTML = `<b>Free-for-all · ${esc(map?.name || "")} · ${fmtT(Math.max(0, ROUND_S - roundT))} left</b><table><tr><td></td><td></td><td>K</td><td>D</td></tr>${ranked().map((b, k) => `<tr class="${b.bot ? "" : "me"}"><td>${k + 1}</td><td>${esc(b.name)}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join("")}</table>`; }
function draw(dt) {
  for (const b of beans) { if (!b.bot || !b.mesh.g.visible) continue; const g = b.mesh.g; g.position.copy(b.p); g.position.y -= R; let dy = b.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3; g.scale.y += ((b.slide ? 0.55 : 1) - g.scale.y) * 0.3; }
  const m = me();
  if (m.dead && m.lastBy && !m.lastBy.dead) { const k = m.lastBy; camera.position.lerp(new V3(k.p.x + 3, k.p.y + 3, k.p.z + 3), 0.1); camera.lookAt(k.p.x, k.p.y + 0.5, k.p.z); viewGun.visible = false; }
  else if (m.dead || state === "menu") { const a = t * 0.1; camera.position.set(Math.sin(a) * 40, 22, Math.cos(a) * 40); camera.lookAt(0, 2, 0); viewGun.visible = false; }
  else { camera.position.set(m.p.x, m.p.y + EYE * (m.slide ? 0.6 : 1), m.p.z); camera.rotation.set(pitch, yaw, 0); viewGun.visible = !scoping; viewGun.position.z += (-0.42 - viewGun.position.z) * 0.25; const bob = Math.hypot(m.v.x, m.v.z) > 1 && m.grounded && !m.slide ? Math.sin(t * 12) * 0.012 : 0; viewGun.position.y = -0.17 + bob; }
  const fov = scoping ? 24 : profile.settings.fov + clamp((Math.hypot(m.v.x, m.v.z) - RUN) / 9, 0, 1) * 10; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.3; camera.updateProjectionMatrix(); }
  $("scope").classList.toggle("on", scoping && !m.dead && state === "play");
  for (let k = fx.length - 1; k >= 0; k--) { const f = fx[k]; f.life -= dt; const a = Math.max(0, f.life / f.max); f.o.material.opacity = a; if (f.grow) f.o.scale.setScalar(1 + (1 - a) * f.grow); if (f.life <= 0) { scene.remove(f.o); f.o.geometry.dispose(); fx.splice(k, 1); } }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.s.position.y += dt * 1.2; f.s.material.opacity = Math.min(1, f.life * 2); if (f.life <= 0) { scene.remove(f.s); f.s.material.map.dispose(); floats.splice(i, 1); } }
  sun.position.set(camera.position.x + 20, 50, camera.position.z + 14); sun.target.position.set(camera.position.x, 0, camera.position.z);
  renderer.render(scene, camera);
}
function hud(dt) {
  const m = me(); hitTimer = Math.max(0, hitTimer - dt); killTimer = Math.max(0, killTimer - dt);
  $("xhair").classList.toggle("hitm", hitTimer > 0 && killTimer <= 0); $("xhair").classList.toggle("kill", killTimer > 0);
  $("hudT").textContent = state === "count" ? String(Math.ceil(countdown)) : fmtT(Math.max(0, ROUND_S - roundT));
  const place = ranked().indexOf(m) + 1; $("hudPlace").textContent = state === "play" ? `${ord(place)} of ${PLAYERS}` : "";
  $("hudK").textContent = m.kills; $("hudKD").textContent = `kills · ${m.deaths} deaths${m.streak >= 2 ? ` · streak ${m.streak}` : ""}`;
  $("hudHpN").textContent = Math.round(Math.max(0, m.hp)); $("hudHp").firstElementChild.style.width = `${clamp(m.hp / MAX_HP, 0, 1) * 100}%`;
  const g = GUNS[m.gun]; $("hudAmmo").innerHTML = m.reloading ? `<small>reloading…</small>` : `${m.ammo} <small>/ ${g.mag}</small>`;
  $("lockHint").hidden = locked || state !== "play" || m.dead;
  if (m.dead && state === "play") $("hudSub").textContent = `${m.lastBy && m.lastBy !== m ? `${m.lastBy.name} got you` : "You fell"} · back in ${Math.ceil(m.respawn)}s`;
}
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } }
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0;
function advance(dt) {
  if (state === "count") { countdown -= dt; if (Math.ceil(countdown) < countBeep) { countBeep = Math.ceil(countdown); play("count"); } if (countdown <= 0) { state = "play"; log("Go!"); say("GO"); play("go"); } }
  acc += dt; while (acc >= STEP) { stepWorld(STEP); acc -= STEP; }
  if (state === "play" && roundT >= ROUND_S) endRound();
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  resize(); advance(dt); draw(dt); hud(dt);
  fpsN++; fpsT += dt; if (fpsT >= 1) { $("loadStat").textContent = `${fpsN} fps`; fpsN = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
buildMap(mapKey); reset(); state = "menu"; $("hudGun").textContent = GUNS.ar.n; drawProfile(); showMenu("play");
window.__bs = { beans, get boxes() { return boxes; }, get map() { return map; }, get state() { return state; }, get roundT() { return roundT; }, start, cast, groundAt, GUNS, profile, buildMap, setMap: (k) => { mapKey = k; }, aim(y, p) { yaw = y; pitch = p; }, set fire(v) { mouseFire = v; }, lookDir: () => lookDir(new V3()), endRound, showMenu,
  sim(seconds) { for (let k = 0; k < seconds * 60; k++) advance(1 / 60); draw(1 / 60); hud(1 / 60); } };
requestAnimationFrame(frame);

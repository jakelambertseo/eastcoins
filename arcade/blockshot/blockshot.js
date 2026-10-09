/* Blockshot — a Krunker-style free-for-all on the bean engine (2026-10-08). The owner wants it standalone in the Games section: "cleaning
   up the game, adding some free sounds, free textures, a leveling mechanism for skins, total stat tracking (kills, kd, etc). make the
   maps larger with fewer blocks/things that break movement".

   Stage 2 (same day): THE RULES LEFT THIS FILE. Physics, slide-hop, guns, the shot ray, damage, kills, respawns, the maps and the bots
   are /v3/assets/js/blockshot-rules.js, import-free, so the arcade server runs the identical match (tools/blockshot-test.mjs proves it
   on Node). This file draws it: three.js, textures (tex.js), sounds (audio.js), the profile (profile.js: XP, skins, stats, settings),
   the HUD and the menus. It steps the rules itself while the match is local (you against bots); on the server it will apply snapshots
   and predict only your own bean. `stepWorld` hands back EVENTS and everything you hear and read comes from those. Nothing calls /api/. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { World, newBean, stepWorld, botInput, respawnBean, cast, switchGun, SWAP_S, V, PHYS, RULES, GUNS, GUN_KEYS, PRIMARY_KEYS, MAPS, MAP_LIST, BOT_NAMES, BOTS } from "/v3/assets/js/blockshot-rules.js?v=10";
import { createNet } from "./net.js?v=10";
import { material, skin as skinTex } from "./tex.js?v=1";
import { play, setVolume, ensure as audioOn } from "./audio.js?v=5";
import { profile, award, need, SKINS, COLORS, owns, wear, kd, accuracy, recordRound, titleFor, XP, save, syncFromServer, unlockedBetween, site } from "./profile.js?v=6";

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
if (new URLSearchParams(location.search).has("embed")) document.documentElement.classList.add("embed");   // (index.html sets it inline too, before the first paint)
const { R, EYE, STEP, RUN } = PHYS, { PLAYERS, ROUND_S, MAX_HP, RESPAWN_S } = RULES;

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

/* ------------------------------------------------------------------ the map: the rules' boxes, drawn as one mesh per texture, UVs in world units */
let world = null, mapMeshes = [];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function buildMap(key) {
  for (const m of mapMeshes) { scene.remove(m); m.geometry?.dispose(); } mapMeshes = []; pickupMeshes = [];
  world = new World(key); const map = world.map;
  scene.background = new THREE.Color(map.sky); scene.fog = new THREE.Fog(map.sky, map.fog[0], map.fog[1]);
  const byMat = new Map();
  for (const m of map.boxes) {
    const g = new THREE.BoxGeometry(m.h[0] * 2, m.h[1] * 2, m.h[2] * 2), uv = g.attributes.uv, flat = m.tex === "crate" || m.tex === "pad";
    for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4), sx = f < 2 ? m.h[2] : m.h[0], sy = f < 2 ? m.h[1] : f < 4 ? m.h[2] : m.h[1]; uv.setXY(i, uv.getX(i) * (flat ? 1 : sx), uv.getY(i) * (flat ? 1 : sy)); }
    _e.set(m.rx || 0, m.ry || 0, 0, "YXZ"); _q.setFromEuler(_e); g.applyMatrix4(_m4.compose(new V3(...m.c), _q, new V3(1, 1, 1)));
    const k = `${m.tex}:${m.col}`; if (!byMat.has(k)) byMat.set(k, { mat: material(m.tex, m.col), list: [] }); byMat.get(k).list.push(g);
  }
  for (const { mat, list } of byMat.values()) { const mesh = new THREE.Mesh(mergeGeometries(list, false), mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); mapMeshes.push(mesh); for (const g of list) g.dispose(); }
  // the pickups: a red pack with a white cross, a yellow box with a dark band; they turn in place and vanish while taken
  pickupMeshes = world.pickups.map((p) => {
    const g = new THREE.Group();
    if (p.kind === "health") { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), pickMats.red)); for (const [sx, sz] of [[0.6, 0.18], [0.18, 0.6]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.08, sz), pickMats.white); m.position.y = 0.29; g.add(m); } }
    else { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.6), pickMats.yellow)); const band = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.64), pickMats.dark); g.add(band); }
    g.position.set(p.x, p.y + 0.55, p.z); scene.add(g); mapMeshes.push(g); return g;
  });
}
let pickupMeshes = [];
const pickMats = { red: new THREE.MeshStandardMaterial({ color: 0xe03a3a, emissive: 0x401010 }), white: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x404040 }), yellow: new THREE.MeshStandardMaterial({ color: 0xf0c020, emissive: 0x403000 }), dark: new THREE.MeshStandardMaterial({ color: 0x202028 }) };

/* ------------------------------------------------------------------ beans and skins */
const skinMat = (pattern, colKey) => new THREE.MeshStandardMaterial({ map: skinTex(pattern, COLORS[colKey] ?? 0xffd84a), roughness: pattern === "gold" || pattern === "carbon" ? 0.3 : 0.5, metalness: pattern === "gold" ? 0.6 : pattern === "carbon" ? 0.3 : 0 });
function beanMesh(sk, parent = scene) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), skinMat(sk.pattern, sk.body)); body.castShadow = true; body.position.y = 0.7; g.add(body);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: COLORS[sk.visor] ?? 0xffffff, roughness: 0.2, metalness: sk.visor === "gold" ? 0.6 : 0 }));
  visor.scale.set(1, 0.55, 0.6); visor.rotation.x = Math.PI / 2; visor.position.set(0, 0.98, -0.3); g.add(visor);
  for (const x of [-0.11, 0.11]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: sk.visor === "black" ? 0xffffff : 0x111111 })); eye.position.set(x, 1.0, -0.45); g.add(eye); }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), skinMat(sk.gun, "black")); gun.position.set(0.38, 0.75, -0.35); g.add(gun);
  parent.add(g); return g;
}
function makeBean(sk) {
  const g = beanMesh(sk);
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); tag.scale.set(2.2, 0.55, 1); tag.position.y = 1.9; g.add(tag);
  return { g, tag, tagCanvas: c, tagKey: "" };
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
for (let i = 0; i < PLAYERS; i++) { const b = newBean(i, i ? BOT_NAMES[i - 1] : "You", i > 0); b.skill = rnd(BOTS.skill[0], BOTS.skill[1]); b.mesh = makeBean(i ? randomSkin() : profile.skin); beans.push(b); }
let me = beans[0]; me.mesh.g.visible = false;   // first person: you don't see your own bean (online, `me` is whichever slot the server gives)
function redressMe() { scene.remove(me.mesh.g); me.mesh = makeBean(profile.skin); me.mesh.g.visible = false; viewGunBody.material = skinMat(profile.skin.gun, "black"); }

// the gun in your hands
const viewGun = new THREE.Group(); let viewGunBody;
{
  viewGunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.62), skinMat(profile.skin.gun, "black"));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x55555f })); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.45;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); grip.position.set(0, -0.14, 0.14);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a22 })); mag.position.set(0, -0.12, -0.08);
  viewGun.add(viewGunBody, barrel, grip, mag); viewGun.scale.setScalar(0.55); viewGun.position.set(0.2, -0.17, -0.42); camera.add(viewGun);
}
/** The same four parts, proportioned per gun: a long barrel on the sniper, a fat one on the shotgun, a stub with no magazine on the pistol. */
const GUN_SHAPE = { ar: [1, 1, 1, 1], sniper: [1.3, 1.9, 1, 0.6], shotgun: [1.1, 1.4, 1, 0], pistol: [0.45, 0.5, 1.15, 0] };   // body length, barrel length, grip, magazine
let shownGun = "";
function fitViewGun(k) {
  if (k === shownGun) return; shownGun = k; const [bl, br, gr, mg] = GUN_SHAPE[k] || GUN_SHAPE.ar, [body, barrel, grip, mag] = viewGun.children;
  body.scale.z = bl; body.position.z = (1 - bl) * 0.31; const front = body.position.z - 0.31 * bl;   // the body keeps its back where it was; the barrel hangs off its front
  barrel.scale.y = br; barrel.scale.x = barrel.scale.z = k === "shotgun" ? 1.5 : 1; barrel.position.z = front - 0.2 * br;
  grip.scale.setScalar(gr); mag.visible = mg > 0; mag.scale.y = mg || 1;
}

/* ------------------------------------------------------------------ input */
const keys = {};
let yaw = 0, pitch = 0, locked = false, mouseFire = false, scoping = false, dragLook = false, lastX = 0, lastY = 0, fireLatch = false, nextGun = "ar", swapAt = -9;
const sens = () => 0.0022 * profile.settings.sens / (scoping ? GUNS[me.gun].zoom || 1 : 1), inv = () => (profile.settings.invertY ? -1 : 1);
addEventListener("keydown", (e) => {
  if (!locked && document.activeElement !== canvas) return; keys[e.code] = true;
  if (e.code === "Tab") { $("board").hidden = false; drawBoard(); e.preventDefault(); }
  if (e.code === "Escape" && state === "play" && $("over").hidden) { showMenu("play"); if (online) { /* still in the match; Play again rejoins */ } }
  if (/^Digit[123]$/.test(e.code)) {   // instant, like Krunker (2026-10-09): the gun in hand changes now with a short draw, and it is the gun you respawn with
    nextGun = { Digit1: "ar", Digit2: "sniper", Digit3: "shotgun" }[e.code];
    if (state === "play" && !me.dead && nextGun !== me.gun) swapTo(nextGun); else if (online) net.setGun(nextGun);
  }
  if (e.code === "KeyQ" || e.code === "Digit4") swapTo(me.gun === "pistol" ? nextGun : "pistol");   // the sidearm, and back
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Tab") $("board").hidden = true; });
/** Change the gun in hand now (the server hears the same; the rules give it a draw time). */
function swapTo(k) { if (state !== "play" || me.dead || k === me.gun || !GUNS[k]) return; if (online) { net.setGun(k); switchGun(me, k, null); swapAt = performance.now() / 1000; } else switchGun(me, k, events); }
let wheelAt = 0;
addEventListener("wheel", (e) => { if (!locked || state !== "play") return; const now = performance.now(); if (now - wheelAt < 250) return; wheelAt = now; swapTo(me.gun === "pistol" ? nextGun : "pistol"); }, { passive: true });
function grabMouse() { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch {} }
canvas.addEventListener("click", () => { if (state === "play" || state === "count") grabMouse(); canvas.focus(); audioOn(); });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; $("lockHint").hidden = locked || state !== "play"; });
addEventListener("mousemove", (e) => {
  if (locked) { yaw -= e.movementX * sens(); pitch = clamp(pitch - e.movementY * sens() * inv(), -1.45, 1.45); }
  else if (dragLook) { yaw -= (e.clientX - lastX) * 0.005; pitch = clamp(pitch - (e.clientY - lastY) * 0.005 * inv(), -1.45, 1.45); lastX = e.clientX; lastY = e.clientY; }
});
canvas.addEventListener("mousedown", (e) => { if (e.button === 0) { mouseFire = true; if (!locked) { dragLook = true; lastX = e.clientX; lastY = e.clientY; } } if (e.button === 2 && !me.dead) scoping = true; });
addEventListener("mouseup", (e) => { if (e.button === 0) { mouseFire = false; dragLook = false; } if (e.button === 2) scoping = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const lookDir = () => new V(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
function playerInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (keys.ArrowLeft) yaw += 0.04; if (keys.ArrowRight) yaw -= 0.04;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = fx * f + rx * s, z = fz * f + rz * s, l = Math.hypot(x, z), fire = mouseFire || keys.KeyJ;
  const inp = { x: l > 1 ? x / l : x, z: l > 1 ? z / l : z, jump: keys.Space, fire, fireTap: fire && !fireLatch, slide: keys.ShiftLeft || keys.ShiftRight, reload: keys.KeyR, aim: lookDir(), scope: scoping };
  fireLatch = fire; return inp;
}

/* ------------------------------------------------------------------ what the events become: tracers, sounds, numbers, the feed */
/* POOLS (2026-10-09, the owner: "major lag spikes every 10-15 seconds"): a tracer, a puff and a floating number used to be new objects
   every time (a geometry, a sphere, a canvas and a texture), dozens a second with eleven bots firing, and the garbage collector paid
   for it in one pause every so often. Now a fixed set of each is made once and reused; a burst past the pool is simply not drawn. */
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true }), puffGeo = new THREE.SphereGeometry(0.12, 6, 5);
const POOL = { lines: [], puffs: [], floats: [] };
const take = (list, make, max) => { let it = list.find((x) => x.life <= 0); if (!it && list.length < max) { it = make(); list.push(it); } return it || null; };
function tracer(from, to, mine) {
  const L = take(POOL.lines, () => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)); const o = new THREE.Line(g, tracerMat.clone()); o.frustumCulled = false; scene.add(o); return { o, life: 0, max: 0.08 }; }, 48);
  if (L) { const a = L.o.geometry.attributes.position; a.setXYZ(0, from.x, from.y, from.z); a.setXYZ(1, to.x, to.y, to.z); a.needsUpdate = true; L.o.material.color.set(mine ? 0xffe27a : 0xff9a6a); L.o.visible = true; L.life = L.max; }
  const P = take(POOL.puffs, () => { const o = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true })); scene.add(o); return { o, life: 0, max: 0.2 }; }, 48);
  if (P) { P.o.position.set(to.x, to.y, to.z); P.o.scale.setScalar(1); P.o.visible = true; P.life = P.max; }
}
function floatText(p, text, col) {
  const F = take(POOL.floats, () => { const c = document.createElement("canvas"); c.width = 128; c.height = 64; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(1.1, 0.55, 1); scene.add(s); return { s, c, life: 0 }; }, 24);
  if (!F) return;
  const x = F.c.getContext("2d"); x.clearRect(0, 0, 128, 64); x.textAlign = "center"; x.font = "800 36px Rajdhani, sans-serif"; x.lineWidth = 6; x.strokeStyle = "#000"; x.strokeText(text, 64, 44); x.fillStyle = col; x.fillText(text, 64, 44); F.s.material.map.needsUpdate = true;
  F.s.position.set(p.x + rnd(-0.3, 0.3), p.y + 1.3, p.z); F.s.visible = true; F.life = 0.7;
}
let hitTimer = 0, killTimer = 0, hsTimer = 0, dmgT = 0, dmgAngle = 0, kcT = 0, lastPlace = 0;
/** Left-right placement of a sound from a world position, against where the camera looks. */
const panTo = (p) => { const dx = p.x - camera.position.x, dz = p.z - camera.position.z, l = Math.hypot(dx, dz) || 1; return clamp((dx * Math.cos(yaw) + dz * -Math.sin(yaw)) / l, -1, 1); };
/** The kill card under the crosshair: who, headshot or not, and what it paid. */
function killCard(name, head, xp) { const el = $("killcard"); $("kcName").textContent = name; $("kcTag").hidden = !head; $("kcXp").textContent = xp ? `+${xp} XP` : ""; el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); kcT = 1.7; }
function dmgFrom(by) { dmgAngle = Math.atan2(by.p.x - me.p.x, by.p.z - me.p.z); dmgT = 0.7; }
function flashDamage() { const el = $("hurt"); el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
const meStats = { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 };
const gunStat = (g) => (meStats.byGun[g] ||= { kills: 0, shots: 0, hits: 0 });
function onEvent(e) {
  const mine = e.b === me || e.by === me;
  switch (e.type) {
    case "shot": {
      if (online && e.b === me && !e.local) return;   // drawn when the trigger was pulled (see onlineTick)
      const muzzle = e.b === me ? camera.localToWorld(new V3(0.2, -0.15, -0.75)) : e.pellets[0].from.clone().addScaled(e.b.aim, 0.6);
      for (const p of e.pellets) tracer(muzzle, p.to, e.b === me);
      if (e.b === me) { viewGun.position.z += scoping ? 0.06 : 0.12; meStats.shots++; gunStat(me.gun).shots++; play(e.gun); } else play(e.gun, clamp(0.6 - e.b.p.dist(me.p) / 70, 0, 0.6), panTo(e.b.p));
      return;
    }
    case "hit": paintTag(e.target);
      if (e.by === me) { hitTimer = 0.14; if (e.head) hsTimer = 0.22; meStats.hits++; gunStat(me.gun).hits++; if (e.head) meStats.headshots++; play(e.head ? "headshot" : "hit"); floatText(e.target.p, e.head ? `${Math.round(e.dmg)} HS` : `${Math.round(e.dmg)}`, e.head ? "#ffd84a" : "#fff"); }
      if (e.target === me) { flashDamage(); play("hurt"); if (e.by && e.by !== me) dmgFrom(e.by); }
      return;
    case "kill": {
      const { target, by, head } = e; target.mesh.g.visible = false; paintTag(target);
      const who = (b) => (b.bot ? esc(b.name) : "<b>you</b>");
      feed(!by ? `${who(target)} fell` : `${who(by)} ${head ? '<span class="hs">⌖</span>' : "▸"} ${who(target)}`, by === me ? "me" : target === me ? "dead" : "");
      log(!by ? `${target.bot ? target.name : "You"} fell.` : `${by.bot ? by.name : "You"} killed ${target.bot ? target.name : "you"}${head ? " (headshot)" : ""}.`, by === me);
      if (by === me) {
        killTimer = 0.4; gunStat(me.gun).kills++; play(head ? "killhs" : "kill"); if (me.streak % 3 === 0) meStats.streaks++;
        const xpCounts = online ? !net.you?.guest : !profile.server; killCard(target.name, head, xpCounts ? (head ? XP.headshot : XP.kill) : 0);
        const call = me.streak === 3 ? "TRIPLE KILL" : me.streak === 5 ? "RAMPAGE" : me.streak === 10 ? "UNSTOPPABLE" : me.streak >= 15 && me.streak % 5 === 0 ? "GODLIKE" : "";
        if (call) { say(call, `${me.streak} in a row`); play("streak"); clearTimeout(say.t); say.t = setTimeout(() => { if ($("hudMsg").textContent === call) say(""); }, 1800); }
      }
      if (target === me) { me.lastBy = by; me.respawn = RESPAWN_S; $("deathBy").textContent = by ? by.name : "the fall"; $("death").hidden = false; play("die"); }   // (the mouse stays grabbed: every grab shows the browser's pointer notice, so it's once per Play, not once per death)
      drawSb(); return;
    }
    case "spawn": if (e.b !== me) e.b.mesh.g.visible = true; paintTag(e.b); if (e.b === me) { const face = () => { yaw = me.facing; pitch = -0.05; }; if (online) setTimeout(face, 150); else face(); $("hudGun").textContent = GUNS[me.gun].n; $("death").hidden = true; say(""); play("spawn"); if (state === "play" && !locked) grabMouse(); } return;
    case "jump": if (mine) play("jump"); return;
    case "slide": if (mine) play("slide"); return;
    case "pad": play("pad", mine ? 1 : 0.2); return;
    case "reload": if (mine) play("reload", GUNS[e.b.gun].reload / 1.5); return;
    case "swap": if (mine) { play("swap"); swapAt = performance.now() / 1000; } return;
    case "pickup": if (mine) { play(e.kind); floatText(me.p, e.kind === "health" ? "+50 HP" : "AMMO", e.kind === "health" ? "#ff6a6a" : "#ffd84a"); } else play(e.kind, clamp(0.4 - e.b.p.dist(me.p) / 40, 0, 0.4), panTo(e.b.p)); return;
    case "empty": if (mine) play("empty"); return;
  }
}

/* ------------------------------------------------------------------ the round */
let t = 0, roundT = 0, state = "menu", countdown = 0, countBeep = 0, mapKey = MAP_LIST[0], online = false;
const roundLeft = () => Math.max(0, ROUND_S - (online ? net.round?.t || 0 : roundT));
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function feed(html, cls = "") { const F = $("feed"); const p = document.createElement("p"); p.className = cls; p.innerHTML = html; F.append(p); setTimeout(() => p.remove(), 5000); while (F.childElementCount > 6) F.firstChild.remove(); }
function log(s, good) { const L = $("log"); const p = document.createElement("p"); if (good) p.className = "good"; p.textContent = `${fmtT(roundT)} ${s}`; L.prepend(p); while (L.childElementCount > 40) L.lastChild.remove(); }
function say(text, sub = "") { $("hudMsg").textContent = text; $("hudSub").textContent = sub; clearTimeout(say.t); if (text && !sub) say.t = setTimeout(() => { if ($("hudMsg").textContent === text) $("hudMsg").textContent = ""; }, 1400); }
const events = [];
/* ---- online: the server's match (net.js). One fixed tick: my input goes to the server and into my own prediction; shots are shown now */
const byslot = (i) => (i >= 0 ? beans[i] : null);
const net = createNet({
  state: () => ({ me, world, beans }),
  onHello: (m) => { joinMatch(m.map, m.slot, m.roster); say("JOINED", `${m.roster.humans.filter(Boolean).length - 1 || "no"} other ${m.roster.humans.filter(Boolean).length === 2 ? "person" : "people"} here`); },
  onRoster: (m) => applyRoster(m),
  onRound: (m) => { buildMap(m.map); applyRoster(m.roster); for (const b of beans) { b.kills = 0; b.deaths = 0; b.streak = 0; } Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 }); $("feed").innerHTML = ""; $("hudMap").textContent = world.map.name; state = "play"; $("over").hidden = true; say("NEW ROUND", world.map.name); play("go"); if (document.activeElement === canvas) grabMouse(); },
  onEvents: (list) => { for (const e of list) {
    if (e.k === "shot") { const b = byslot(e.s); if (b) onEvent({ type: "shot", b, gun: e.g, pellets: e.p.map((q) => ({ from: new V(q[0], q[1], q[2]), to: new V(q[3], q[4], q[5]) })) }); }
    else if (e.k === "hit") { const target = byslot(e.s), by = byslot(e.by); if (target) onEvent({ type: "hit", target, by, dmg: e.d, head: Boolean(e.h) }); }
    else if (e.k === "kill") { const target = byslot(e.s), by = byslot(e.by); if (target) onEvent({ type: "kill", target, by, head: Boolean(e.h) }); }
    else if (e.k === "pickup") { const b = byslot(e.s); if (b) onEvent({ type: "pickup", b, kind: e.kind, i: e.i }); }
    else { const b = byslot(e.s); if (b) onEvent({ type: e.k, b }); }
  } },
  onEnd: (m) => endOnline(m),
  onVotes: (n) => { for (const b of document.querySelectorAll("[data-vote]")) { const c = b.querySelector("i"); if (c) c.textContent = n[b.dataset.vote] || 0; } },
  onDrop: (why) => { if (!online) return; online = false; state = "menu"; document.exitPointerLock?.(); showMenu("play"); say(""); feedNote(why === "closed" ? "Connection lost. Press Play to rejoin." : why); },
  onVisible: (b, vis) => { if (b !== me) b.mesh.g.visible = vis; paintTag(b); },
  onError: (text) => feedNote(text)
});
function feedNote(text) { feed(esc(text)); log(text); }
function applyRoster(r) { r.names.forEach((n, i) => { beans[i].name = n; beans[i].bot = !r.humans[i]; beans[i].mesh.tagKey = ""; paintTag(beans[i]); }); drawSb(); }
function joinMatch(map, slot, roster) {
  online = true; buildMap(map); roundT = 0;
  for (const b of beans) { const keep = { mesh: b.mesh, skill: b.skill }; Object.assign(b, newBean(b.i, b.name, b.bot), keep); b.p.set(0, -50, 0); b.mesh.g.visible = false; }
  if (me) me.mesh.g.visible = false; me = beans[slot]; me.mesh.g.visible = false;
  applyRoster(roster); state = "play"; $("over").hidden = true; $("hudMap").textContent = world.map.name; $("log").innerHTML = ""; $("feed").innerHTML = ""; Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 });
  canvas.focus(); grabMouse(); audioOn();
}
function onlineTick(dt) {
  t += dt;
  if (state !== "play") { net.tick({ x: 0, z: 0, jump: false, fire: false, fireTap: false, slide: false, reload: false, aim: lookDir(), scope: false }, t); return; }
  const inp = playerInput();
  // the shot you see: drawn now, from the rules' own cast against what's on screen; the server's verdict follows
  const g = GUNS[me.gun], wants = g.auto ? inp.fire : inp.fireTap;
  if (!me.dead && wants && me.cd <= 0 && !me.reloading && me.ammo > 0) {
    me.cd = g.cd; me.ammo--; const eye = me.p.clone(); eye.y += PHYS.EYE * (me.slide ? 0.6 : 1); const pellets = [];
    for (let k = 0; k < g.pellets; k++) { const d = inp.aim.clone(); const sp = g.spread * (scoping ? g.adsSpread ?? 1 : 1) * (me.grounded ? 1 : 1.6); d.x += rnd(-sp, sp); d.y += rnd(-sp, sp); d.z += rnd(-sp, sp); d.normalize(); const r = cast(world, beans, eye, d, me, g.range); pellets.push({ from: eye, to: r.point }); }
    onEvent({ type: "shot", b: me, gun: me.gun, pellets, local: true });
  } else if (!me.dead && wants && me.cd <= 0 && !me.reloading && me.ammo === 0) { play("empty"); me.cd = 0.3; }
  me.cd = Math.max(0, me.cd - dt); if (me.dead) me.respawn = Math.max(0, me.respawn - dt);
  net.tick(inp, t);
}
function endOnline(m) {
  state = "done"; document.exitPointerLock?.(); say(""); $("killcard").hidden = true;
  const ranks = m.ranks, y = m.you;
  if (!y) { showMenu("result", `<b>${esc(ranks[0]?.name || "")} wins</b><p>You were watching. The next round starts in a few seconds.</p>`); return; }
  play(y.won ? "win" : "lose");
  let xpHtml = "";
  const lines = [[`${y.kills} kills`, y.kills * XP.kill], [`${y.headshots} headshots`, y.headshots * (XP.headshot - XP.kill)], [`${y.streaks} streaks of three`, y.streaks * XP.streak3], ["Finished the round", XP.round]]; if (y.won) lines.push(["Won the round", XP.win]);
  const pctFrom = Math.round((profile.xp / need(profile.level)) * 100);
  if (y.guest) xpHtml = `<p class="note">Playing as a guest: XP, skins and stats only follow signed-in players. Sign in with Twitch to keep yours.</p>`;
  else if (y.counted && profile.server) {
    // the site paid it: ask for the new standing once the report has landed, then fill the bar to it
    recordRound({ map: m.map, gun: nextGun, kills: y.kills, deaths: y.deaths, headshots: y.headshots, shots: meStats.shots, hits: meStats.hits, won: y.won, streak: y.streak, seconds: ROUND_S, byGun: meStats.byGun });
    const before = profile.level; xpHtml = xpBlock(lines, y.xp, pctFrom, 0, [], " · your account");
    setTimeout(async () => { const me2 = await syncFromServer(); if (!me2) return; const gained = profile.level - before; const el = $("xpBlock"); if (el) { el.outerHTML = xpBlock(lines, y.xp, pctFrom, gained, gained > 0 ? unlockedBetween(before, profile.level) : [], " · your account"); fillBars(); } if (gained > 0) play("levelup"); drawProfile(); }, 1500);
  } else {
    const res = award(y.xp); recordRound({ map: m.map, gun: nextGun, kills: y.kills, deaths: y.deaths, headshots: y.headshots, shots: meStats.shots, hits: meStats.hits, won: y.won, streak: y.streak, seconds: ROUND_S, byGun: meStats.byGun });
    xpHtml = xpBlock(lines, y.xp, pctFrom, res.gained, res.unlocked, "") + (y.counted ? "" : `<p class="note">${profile.server ? "This round wasn't reported to your account (the server has no key); XP stays as it was." : "XP kept in this browser."}</p>`);
    if (res.gained) setTimeout(() => play("levelup"), 700); drawProfile();
  }
  showMenu("result", resultHtml({ headline: y.won ? "You win!" : `${esc(ranks[0].name)} wins`, sub: esc(world.map.name), meSlot: me.i, ranks,
    line: `You came <b>${ord(y.place)}</b> of ${PLAYERS} · <b>${y.kills}</b> kills, <b>${y.deaths}</b> deaths · ${meStats.shots ? Math.round((meStats.hits / meStats.shots) * 100) : 0}% accuracy · best streak ${y.streak}`,
    xpHtml, foot: `<div class="vote"><span class="eyebrow inl">Next map</span>${MAP_LIST.map((k) => `<button data-vote="${k}">${esc(MAPS[k]().name)}<i>0</i></button>`).join("")}<span class="next" id="nextIn"></span></div>` }));
  drawPodium(ranks.slice(0, 3).map((r) => r.s)); fillBars(); nextCountdown(10);
}
async function playOnline() {
  $("panel").innerHTML = `<b>Connecting…</b><p>Finding the match.</p>`;
  const okc = await net.connect({ gun: nextGun, name: profile.settings.name || "" });
  if (!okc) { feedNote(net.why === "timeout" ? "The match server didn't answer; playing against bots instead." : "Couldn't reach the match server; playing against bots instead."); start(); }
}
const STATE_URL = ["localhost", "127.0.0.1"].includes(location.hostname) ? `http://${location.hostname}:8788/bs/state` : "https://arcade.eastcoin.vip/bs/state";
async function whoIsOn() { try { const j = await fetch(STATE_URL, { cache: "no-store" }).then((r) => r.json()); const el = $("whoOn"); if (!el || !j.ok) return; const mapName = MAPS[j.map] ? MAPS[j.map]().name : j.map, left = `${Math.floor(j.left / 60)}:${String(j.left % 60).padStart(2, "0")} left`; el.innerHTML = j.playing ? `<b>${j.playing} playing</b> · ${esc(mapName)} · ${left}<br><small>${esc(j.names.join(", "))}</small>` : `<b>Bots only right now</b> · ${esc(mapName)} · ${left}`; } catch { const el = $("whoOn"); if (el) el.textContent = "The match server isn't answering. Practice still works."; } }

function tick(dt) {
  t += dt; if (state === "play") roundT += dt;
  // the player's spread: tighter scoped, wider in the air (the rules apply the air part)
  const inputFor = (b) => (state !== "play" ? { x: 0, z: 0 } : b.bot ? botInput(world, beans, b, dt) : playerInput());
  stepWorld(world, beans, dt, t, inputFor, Math.random, events, (b) => (b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun));
  for (const e of events) onEvent(e); events.length = 0;
}
function reset() {
  roundT = 0; $("log").innerHTML = ""; $("feed").innerHTML = ""; Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 });
  for (const L of POOL.lines) { L.life = 0; L.o.visible = false; } for (const P of POOL.puffs) { P.life = 0; P.o.visible = false; } for (const F of POOL.floats) { F.life = 0; F.s.visible = false; }
  for (const b of beans) { const keep = { mesh: b.mesh, skill: b.skill }; Object.assign(b, newBean(b.i, b.name, b.bot), keep); b.p.set(0, -50, 0); b.wantsRespawn = true; }
  for (const b of beans) respawnBean(world, beans, b, b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun, Math.random, events);
  for (const e of events) onEvent(e); events.length = 0;
  drawSb();
}
let overTimer = 0;
function start() { clearTimeout(overTimer); buildMap(mapKey); reset(); state = "count"; countdown = 3; countBeep = 3; $("over").hidden = true; canvas.focus(); grabMouse(); audioOn(); $("hudMap").textContent = world.map.name; }
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
const ranked = () => beans.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
function endRound() {
  if (state !== "play") return; state = "done"; document.exitPointerLock?.(); say(""); $("killcard").hidden = true;
  const ranks = ranked(), place = ranks.indexOf(me) + 1, won = place === 1;
  play(won ? "win" : "lose");
  const lines = [[`${me.kills} kills`, me.kills * XP.kill], [`${meStats.headshots} headshots`, meStats.headshots * (XP.headshot - XP.kill)], [`${meStats.streaks} streaks of three`, meStats.streaks * XP.streak3], ["Finished the round", XP.round]];
  if (won) lines.push(["Won the round", XP.win]);
  const total = lines.reduce((n, l) => n + l[1], 0), pctFrom = Math.round((profile.xp / need(profile.level)) * 100), res = award(total);
  recordRound({ map: mapKey, gun: nextGun, kills: me.kills, deaths: me.deaths, headshots: meStats.headshots, shots: meStats.shots, hits: meStats.hits, won, streak: me.bestStreak, seconds: roundT, byGun: meStats.byGun });
  const practiceNote = profile.server ? `<p class="note">Practice: nothing here counts toward your account. Play online for XP and the board.</p>` : "";
  showMenu("result", resultHtml({ headline: won ? "You win!" : `${esc(ranks[0].name)} wins`, sub: `Practice · ${esc(world.map.name)}`, meSlot: me.i, ranks: ranks.map((b) => ({ s: b.i, name: b.name, k: b.kills, d: b.deaths, human: !b.bot })),
    line: `You came <b>${ord(place)}</b> of ${PLAYERS} · <b>${me.kills}</b> kills, <b>${me.deaths}</b> deaths · ${meStats.shots ? Math.round((meStats.hits / meStats.shots) * 100) : 0}% accuracy · best streak ${me.bestStreak}`,
    xpHtml: profile.server ? practiceNote : xpBlock(lines, total, pctFrom, res.gained, res.unlocked, ""),
    foot: `<button class="go" data-go="1">Play again</button><button class="go ghost sm" data-tab="play">Menu</button>` }));
  if (res.gained) setTimeout(() => play("levelup"), 700);
  $("over").hidden = true; overTimer = setTimeout(() => { $("over").hidden = false; drawPodium(ranks.slice(0, 3).map((b) => b.i)); fillBars(); }, 900);
  drawProfile();
}

/* ------------------------------------------------------------------ the menu: Play, Locker, Stats, Settings */
let tab = "play", boardBy = "kills", boardRange = "all";
async function loadBoard() {
  const el = $("boardBody"); if (!el) return;
  try {
    const j = await fetch(`/api/blockshot/board?by=${boardBy}&range=${boardRange}`).then((r) => r.json());
    if (!j.ok) throw new Error();
    if (!j.rows.length) { el.innerHTML = `<p class="note">Nobody on the board yet${boardRange !== "all" ? " for this range" : ""}. Play a round online.</p>`; return; }
    const fmtV = (r) => boardBy === "kd" ? r.kd : boardBy === "level" ? `Lv ${r.level}` : boardBy === "accuracy" ? (r.value < 0 ? "–" : `${r.accuracy}%`) : r.value;
    el.innerHTML = `<table class="sb board-t"><tr><th></th><th>Player</th><th>${esc(({ kills: "Kills", kd: "K/D", wins: "Wins", headshots: "Headshots", level: "Level", accuracy: "Accuracy" })[boardBy])}</th><th>K</th><th>D</th><th>Rounds</th></tr>${j.rows.map((r, k) => `<tr class="${r.login === profile.login ? "me" : ""}"><td>${k + 1}</td><td>${esc(r.name)} <small>Lv ${r.level}</small></td><td><b>${fmtV(r)}</b></td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.rounds}</td></tr>`).join("")}</table>`;
  } catch { el.innerHTML = `<p class="note">The board isn't answering (it lives on eastcoin.vip).</p>`; }
}
const gunCard = (k, i) => { const g = GUNS[k], dps = (g.dmg * g.pellets) / g.cd, bar = (v, max) => `${Math.round(clamp(v / max, 0.05, 1) * 100)}%`;
  return `<button class="gun${k === nextGun ? " on" : ""}" data-gun="${k}"><b>${i + 1} · ${esc(g.n)}</b>${esc(g.text)}<div class="bars"><div>Damage<i style="--v:${bar(g.dmg * g.pellets, 250)}"></i></div><div>Fire rate<i style="--v:${bar(1 / g.cd, 8)}"></i></div><div>Range<i style="--v:${bar(g.range, 160)}"></i></div><div>Magazine<i style="--v:${bar(g.mag, 28)}"></i></div><div>DPS<i style="--v:${bar(dps, 560)}"></i></div></div></button>`; };
function showMenu(which, html) { tab = which; if (locked) document.exitPointerLock?.(); for (const b of document.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === which); if (html !== undefined) $("panel").innerHTML = html; else drawMenu(); $("over").hidden = false; }
function drawMenu() {
  if (tab === "play") {   // the Play tab, cut down (2026-10-09, the owner: "a ton of text and overwhelming"): the button, the match, three gun chips, practice, one line of keys
    const ROLE = { ar: "All-rounder", sniper: "One shot, one kill", shotgun: "Close range" };
    $("panel").innerHTML = `<div class="pm">
    <div class="pm-top"><button class="go big" data-online="1">Play online</button><p id="whoOn" class="pm-who">Looking…</p></div>
    <p class="eyebrow">Gun</p>
    <div class="gpick">${PRIMARY_KEYS.map((k, i) => { const g = GUNS[k]; return `<button class="gp${k === nextGun ? " on" : ""}" data-gun="${k}" title="${esc(g.text)}"><b>${i + 1}</b><span>${esc(g.n)}</span><small>${ROLE[k]}</small></button>`; }).join("")}</div>
    <p class="pm-pistol">Everyone also carries the <b>Pistol</b> · <b>Q</b> or the wheel swaps to it</p>
    <div class="pm-row"><span class="eyebrow inl">Practice</span><div class="seg">${MAP_LIST.map((k) => `<button class="${k === mapKey ? "on" : ""}" data-map="${k}" title="${esc(MAPS[k]().blurb)}">${esc(MAPS[k]().name)}</button>`).join("")}</div><button class="go ghost sm" data-go="1">vs bots</button></div>
    <p class="pm-keys"><b>WASD</b> move · <b>Shift</b> slide · <b>Space</b> jump · <b>R</b> reload · <b>1 2 3</b> guns · <b>Tab</b> scores · <b>Esc</b> menu</p>
    ${site.on && !profile.server ? `<p class="note acct"><a href="/api/picks/auth/twitch/start?returnTo=${encodeURIComponent(location.pathname + location.search)}">Sign in with Twitch</a> to keep your level, skins and stats.</p>` : profile.server ? `<p class="note acct">Signed in as <b>${esc(profile.name || profile.login || "you")}</b> · <button class="lnk" data-logout="1">Sign out</button></p>` : ""}
    </div>`; whoIsOn(); }
  else if (tab === "locker") {
    const sw = (slot, s) => { const col = slot === "body" || slot === "visor" ? COLORS[s.k] : COLORS[profile.skin.body] || 0xffd84a, on = profile.skin[slot] === s.k, have = owns(slot, s.k);
      return `<button class="sw${on ? " on" : ""}${have ? "" : " lock"}" data-slot="${slot}" data-k="${s.k}" title="${have ? esc(s.n) : `${esc(s.n)} · level ${s.lvl}`}"><i class="p-${slot === "body" || slot === "visor" ? "plain" : s.k}" style="--c:#${col.toString(16).padStart(6, "0")}"></i><span>${have ? esc(s.n) : `🔒 ${s.lvl}`}</span></button>`; };
    $("panel").innerHTML = `<b>Locker</b><p>Level <b>${profile.level}</b> · ${esc(titleFor(profile.level))}. Skins unlock by level; nothing is bought. Bots wear whatever they like.</p>
      <div class="locker"><canvas id="pv" width="220" height="260"></canvas><div>${[["body", "Body colour"], ["pattern", "Body pattern"], ["visor", "Visor"], ["gun", "Gun finish"]].map(([slot, n]) => `<p class="eyebrow">${n}</p><div class="sws">${SKINS[slot].map((s) => sw(slot, s)).join("")}</div>`).join("")}</div></div>`;
    drawPreview();
  } else if (tab === "stats") {
    const s = profile.stats, guns = Object.entries(s.byGun), maps = Object.entries(s.byMap);
    $("panel").innerHTML = `<b>Your stats</b><p>Level <b>${profile.level}</b> · ${esc(titleFor(profile.level))} · ${profile.xp} / ${need(profile.level)} XP to the next.</p>
      <div class="grid4"><div><b>${s.kills}</b><span>kills</span></div><div><b>${s.deaths}</b><span>deaths</span></div><div><b>${kd()}</b><span>K/D</span></div><div><b>${accuracy()}%</b><span>accuracy</span></div>
      <div><b>${s.headshots}</b><span>headshots</span></div><div><b>${s.wins}</b><span>wins</span></div><div><b>${s.rounds}</b><span>rounds</span></div><div><b>${s.bestStreak}</b><span>best streak</span></div>
      <div><b>${Math.round(s.seconds / 60)}m</b><span>played</span></div><div><b>${s.rounds ? (s.kills / s.rounds).toFixed(1) : 0}</b><span>kills a round</span></div><div><b>${s.rounds ? Math.round((s.wins / s.rounds) * 100) : 0}%</b><span>win rate</span></div><div><b>${s.kills ? Math.round((s.headshots / s.kills) * 100) : 0}%</b><span>headshot rate</span></div></div>
      ${guns.length ? `<p class="eyebrow">By gun</p><table class="sb">${guns.map(([g, v]) => `<tr><td>${esc(GUNS[g]?.n || g)}</td><td>${v.kills} kills</td><td>${v.shots ? Math.round((v.hits / v.shots) * 100) : 0}%</td></tr>`).join("")}</table>` : ""}
      ${maps.length ? `<p class="eyebrow">By map</p><table class="sb">${maps.map(([k, v]) => `<tr><td>${esc(MAPS[k] ? MAPS[k]().name : k)}</td><td>${v.rounds} rounds</td><td>${v.wins} wins</td></tr>`).join("")}</table>` : ""}
      <p class="note">${profile.server ? `Your account's numbers (online rounds). The by-gun and by-map lines are this browser's.` : "Kept in this browser: sign in on EastCoin and play online for stats that follow your account and count on the board."}</p>`;
  } else if (tab === "board") {
    $("panel").innerHTML = `<b>Leaderboard</b><p>Online rounds only, signed-in players only. Accuracy needs fifty shots to rank.</p>
      <div class="chips" id="boardBy">${[["kills", "Kills"], ["kd", "K/D"], ["wins", "Wins"], ["headshots", "Headshots"], ["level", "Level"], ["accuracy", "Accuracy"]].map(([k, n]) => `<button class="chip-b${boardBy === k ? " on" : ""}" data-by="${k}">${n}</button>`).join("")}</div>
      <div class="chips" id="boardRange">${[["all", "All time"], ["week", "This week"], ["today", "Today"]].map(([k, n]) => `<button class="chip-b${boardRange === k ? " on" : ""}" data-range="${k}">${n}</button>`).join("")}</div>
      <div id="boardBody"><p class="note">Loading…</p></div>`;
    loadBoard();
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
  if (b.dataset.by) { boardBy = b.dataset.by; return drawMenu(); }
  if (b.dataset.range) { boardRange = b.dataset.range; return drawMenu(); }
  if (b.dataset.map) { mapKey = b.dataset.map; return drawMenu(); }
  if (b.dataset.gun) { nextGun = b.dataset.gun; return drawMenu(); }
  if (b.dataset.go) { if (online) { net.close(); online = false; } return start(); }
  if (b.dataset.online) return playOnline();
  if (b.dataset.vote) { net.vote(b.dataset.vote); for (const o of document.querySelectorAll("[data-vote]")) o.classList.toggle("on", o === b); return; }
  if (b.dataset.logout) { b.disabled = true; return fetch("/api/picks/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {}).then(() => location.reload()); }
  if (b.dataset.slot && wear(b.dataset.slot, b.dataset.k)) { redressMe(); drawMenu(); }
});
$("over").addEventListener("input", (e) => {
  const el = e.target.closest("[data-set]"); if (!el) return; const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
  profile.settings[k] = v; save(); const out = el.parentElement.querySelector("output"); if (out) out.textContent = k === "sens" ? `${v.toFixed(1)}×` : k === "fov" ? `${v}°` : k === "volume" ? `${Math.round(v * 100)}%` : "";
  if (k === "volume") setVolume(v); if (k === "crosshair") $("xhair").dataset.style = v;
});
setVolume(profile.settings.volume); $("xhair").dataset.style = profile.settings.crosshair;
/* THE END OF A ROUND (2026-10-09): one screen for both modes. The top three stand on a podium in their own skins (their meshes cloned
   into a small scene drawn by one spare renderer and copied onto the screen's canvas), your line under it, the XP bar filling from
   where it was to where it is, the table, and "next map in N" online or Play again in practice. */
let podR = null;
function resultHtml({ headline, sub, line, xpHtml, ranks, meSlot, foot }) {
  const top = ranks.slice(0, 3), pod = [top[1], top[0], top[2]];
  return `<div class="res"><b class="res-h">${headline}</b>${sub ? `<p class="res-sub">${sub}</p>` : ""}
    <div class="podium"><canvas id="podium" width="640" height="220"></canvas><div class="pod-names">${pod.map((r, i) => r ? `<div class="${r.s === meSlot ? "me" : ""}"><small>${ord([2, 1, 3][i])}</small><b>${esc(r.name)}</b><span>${r.k} / ${r.d}</span></div>` : "<div></div>").join("")}</div></div>
    <p class="res-line">${line}</p>${xpHtml}
    <table class="sb res-t">${ranks.map((r, k) => `<tr class="${r.s === meSlot ? "me" : ""}"><td>${ord(k + 1)}</td><td>${esc(r.name)}${r.human === false ? " <small>bot</small>" : ""}</td><td>${r.k} / ${r.d}</td></tr>`).join("")}</table>
    <div class="res-foot">${foot}</div></div>`;
}
function drawPodium(slots) {
  const c = $("podium"); if (!c) return;
  if (!podR) { podR = new THREE.WebGLRenderer({ antialias: true, alpha: true }); podR.setSize(c.width, c.height, false); }
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, c.width / c.height, 0.1, 30); cam.position.set(0, 1.9, 7.2); cam.lookAt(0, 0.9, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5)); const l = new THREE.DirectionalLight(0xffffff, 1.2); l.position.set(2, 5, 4); sc.add(l);
  const xs = [-1.9, 0, 1.9], hs = [0.55, 0.95, 0.35], cols = [0xc0c0c0, 0xffd84a, 0xb87333];
  [slots[1], slots[0], slots[2]].forEach((s, i) => {
    if (s === undefined || !beans[s]) return;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.5, hs[i], 1.2), new THREE.MeshLambertMaterial({ color: cols[i] })); block.position.set(xs[i], hs[i] / 2, 0); sc.add(block);
    const g = beans[s].mesh.g.clone(); g.visible = true; g.position.set(xs[i], hs[i], 0); g.rotation.set(0, Math.PI + (i - 1) * -0.35, 0); sc.add(g);
  });
  podR.render(sc, cam); c.getContext("2d").drawImage(podR.domElement, 0, 0);
}
/** The XP block: the bar starts where it was and fills to where it is (the CSS transition does the filling). */
function xpBlock(lines, total, pctFrom, gained, unlocked, note) {
  const pct = Math.round((profile.xp / need(profile.level)) * 100);
  return `<div class="xp" id="xpBlock"><div class="xpl">${lines.map(([n, v]) => `<span>${esc(n)}</span><b>+${v}</b>`).join("")}<span>Total</span><b>+${total} XP</b></div>
    <div class="lvl" id="lvlBlock"><b>Level ${profile.level}</b> <small>${esc(titleFor(profile.level))}</small><div class="bar"><i style="width:${gained ? 0 : pctFrom}%" data-to="${pct}%"></i></div><small>${profile.xp} / ${need(profile.level)} to level ${profile.level + 1}${note}</small>
    ${gained ? `<div class="up">LEVEL UP${gained > 1 ? ` ×${gained}` : ""} · now level ${profile.level}${unlocked.length ? ` · unlocked: ${unlocked.map((u) => esc(u.n)).join(", ")}` : ""}</div>` : ""}</div></div>`;
}
const fillBars = () => setTimeout(() => { for (const i of document.querySelectorAll(".lvl .bar i[data-to]")) i.style.width = i.dataset.to; }, 60);
let nextTimer = 0;
function nextCountdown(secs) { clearInterval(nextTimer); let n = secs; const tick = () => { const el = $("nextIn"); if (!el) { clearInterval(nextTimer); return; } el.textContent = n > 0 ? `Next map in ${n}` : "Starting…"; n--; }; tick(); nextTimer = setInterval(tick, 1000); }
let pvR = null;
function drawPreview() {
  const c = $("pv"); if (!c) return; if (!pvR) pvR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, c.width / c.height, 0.1, 20); cam.position.set(0, 1.3, 4.2); cam.lookAt(0, 0.85, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4)); const l = new THREE.DirectionalLight(0xffffff, 1.2); l.position.set(2, 4, 3); sc.add(l);
  beanMesh(profile.skin, sc).rotation.y = Math.PI + 0.5; pvR.setSize(c.width, c.height, false); pvR.render(sc, cam);
}
function drawProfile() { $("hudLevel").textContent = `LV ${profile.level}`; $("menuLevel").textContent = `${profile.server ? `${profile.name || "You"} · ` : ""}Level ${profile.level} · ${titleFor(profile.level)} · ${profile.stats.kills} kills · K/D ${kd()}${profile.server ? "" : " · this browser"}`; }

/* ------------------------------------------------------------------ drawing */
function drawSb() { $("sb").innerHTML = ranked().map((b, k) => `<tr class="${b === me ? "me" : ""}"><td>${k + 1}. ${esc(b.name)}${b.bot ? " <small>bot</small>" : ""}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join(""); }
function drawBoard() { $("board").innerHTML = `<b>Free-for-all · ${esc(world?.map.name || "")} · ${fmtT(roundLeft())} left</b><table><tr><td></td><td></td><td>K</td><td>D</td></tr>${ranked().map((b, k) => `<tr class="${b === me ? "me" : ""}"><td>${k + 1}</td><td>${esc(b.name)}${b.bot ? "<small>bot</small>" : ""}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join("")}</table>`; }
function draw(dt) {
  for (const b of beans) { if (b === me || !b.mesh.g.visible) continue; paintTag(b); const g = b.mesh.g; g.position.set(b.p.x, b.p.y - R, b.p.z); let dy = b.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3; g.scale.y += ((b.slide ? 0.55 : 1) - g.scale.y) * 0.3; }
  if (me.dead && me.lastBy && !me.lastBy.dead) { const k = me.lastBy; camera.position.lerp(new V3(k.p.x + 3, k.p.y + 3, k.p.z + 3), 0.1); camera.lookAt(k.p.x, k.p.y + 0.5, k.p.z); viewGun.visible = false; }
  else if (me.dead || state === "menu") { const a = t * 0.1; camera.position.set(Math.sin(a) * 40, 22, Math.cos(a) * 40); camera.lookAt(0, 2, 0); viewGun.visible = false; }
  else {
    camera.position.set(me.p.x, me.p.y + EYE * (me.slide ? 0.6 : 1), me.p.z); camera.rotation.set(pitch, yaw, 0);
    // aiming down the sights: the gun slides to the middle of the view (the sniper's scope hides it); the kick settles on z
    const ads = scoping && !me.dead, g = GUNS[me.gun]; viewGun.visible = !(ads && g.scope);
    const tx = ads ? 0 : 0.2, ty = ads ? -0.095 : -0.17, tz = ads ? -0.3 : -0.42, kick = Math.max(0, viewGun.position.z - tz);
    viewGun.position.x += (tx - viewGun.position.x) * 0.25; viewGun.position.z = tz + kick * 0.75;
    const bob = Math.hypot(me.v.x, me.v.z) > 1 && me.grounded && !me.slide && !ads ? Math.sin(t * 12) * 0.012 : 0;
    const rl = me.reloading ? 1 - me.reloading / g.reload : 0, sw = (performance.now() / 1000 - swapAt) / SWAP_S;   // reloading: down and rolled over, back up as it finishes; a swap is the same dip, quicker
    const dip = Math.max(rl > 0 ? Math.sin(rl * Math.PI) : 0, sw >= 0 && sw < 1 ? Math.sin(sw * Math.PI) * 0.8 : 0);
    viewGun.position.y += (ty + bob - dip * 0.12 - viewGun.position.y) * 0.25; viewGun.rotation.z += (-dip * 0.6 - viewGun.rotation.z) * 0.25; viewGun.rotation.x += (dip * 0.25 - viewGun.rotation.x) * 0.25;
  }
  const fov = scoping && !me.dead ? profile.settings.fov / (GUNS[me.gun].zoom || 1) : profile.settings.fov + clamp((Math.hypot(me.v.x, me.v.z) - RUN) / 9, 0, 1) * 10; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.3; camera.updateProjectionMatrix(); }
  $("scope").classList.toggle("on", Boolean(scoping && GUNS[me.gun].scope && !me.dead && state === "play"));   // (Boolean: toggle with an undefined second argument FLIPS the class, and the rifle has no scope field)
  { const a = performance.now() / 1000; pickupMeshes.forEach((g, i) => { const p = world.pickups[i]; g.visible = p.t <= 0; if (g.visible) { g.rotation.y = a * 1.6; g.position.y = p.y + 0.55 + Math.sin(a * 2.4 + i) * 0.08; } }); }
  // footsteps (2026-10-09): everyone else's footfalls, timed by their speed, faded by distance and placed left-right, so you hear who's coming
  if (!me.dead) for (const b of beans) { if (b === me || b.dead) continue; const sp = Math.hypot(b.v.x, b.v.z); if (!b.grounded || b.slide || sp < 2.5) { b.stepT = 0.3; continue; } b.stepT = (b.stepT ?? 0) - dt * sp / 2.6; if (b.stepT <= 0) { b.stepT = 1; const d = b.p.dist(me.p); if (d < 26) play("step", clamp(1 - d / 26, 0, 1) * 0.9, panTo(b.p)); } }
  for (const L of POOL.lines) if (L.life > 0) { L.life -= dt; L.o.material.opacity = Math.max(0, L.life / L.max); if (L.life <= 0) L.o.visible = false; }
  for (const P of POOL.puffs) if (P.life > 0) { P.life -= dt; const a = Math.max(0, P.life / P.max); P.o.material.opacity = a; P.o.scale.setScalar(1 + (1 - a) * 2.5); if (P.life <= 0) P.o.visible = false; }
  for (const F of POOL.floats) if (F.life > 0) { F.life -= dt; F.s.position.y += dt * 1.2; F.s.material.opacity = Math.min(1, F.life * 2); if (F.life <= 0) F.s.visible = false; }
  sun.position.set(camera.position.x + 20, 50, camera.position.z + 14); sun.target.position.set(camera.position.x, 0, camera.position.z);
  renderer.render(scene, camera);
}
const hpSeg = $("hudHpSeg"); for (let k = 0; k < 10; k++) hpSeg.append(document.createElement("i"));
function hud(dt) {
  hitTimer = Math.max(0, hitTimer - dt); killTimer = Math.max(0, killTimer - dt); hsTimer = Math.max(0, hsTimer - dt); dmgT = Math.max(0, dmgT - dt);
  if (kcT > 0) { kcT -= dt; if (kcT <= 0) $("killcard").hidden = true; }
  // the crosshair opens with speed, in the air and when hit; it closes scoped
  { const sp = Math.hypot(me.v.x, me.v.z), g = GUNS[me.gun], ads = scoping && !me.dead, gap = (ads ? 2 : 5 + Math.min(14, sp * 0.9) + (me.grounded ? 0 : 10)) + (hitTimer > 0 ? 2 : 0); $("xhair").style.setProperty("--gap", `${gap.toFixed(1)}px`); $("xhair").style.opacity = ads && g.scope ? "0" : "1"; }
  { const el = $("dmgDir"); el.classList.toggle("on", dmgT > 0); if (dmgT > 0) { let a = dmgAngle - yaw; el.firstElementChild.style.transform = `rotate(${(-a * 180) / Math.PI}deg)`; } }
  $("hpBox").classList.toggle("low", me.hp <= 30 && !me.dead); document.body.classList.toggle("lowhp", me.hp <= 30 && !me.dead && state === "play");
  { const on = Math.ceil(clamp(me.hp / MAX_HP, 0, 1) * 10); hpSeg.childNodes.forEach((i, k) => i.classList.toggle("on", k < on)); }
  { const g = GUNS[me.gun]; $("ammoBox").classList.toggle("empty", me.ammo === 0 && !me.reloading); $("hudReload").firstElementChild.style.width = me.reloading ? `${(1 - me.reloading / g.reload) * 100}%` : "0"; }
  if (me.dead && state === "play") { $("deathBar").style.width = `${clamp(me.respawn / RESPAWN_S, 0, 1) * 100}%`; $("deathSub").textContent = `respawning in ${Math.ceil(me.respawn)}`; }
  { const weps = PRIMARY_KEYS.map((k, i) => `<span class="${k === me.gun ? "on" : ""}${k === nextGun && k !== me.gun && me.gun !== "pistol" ? " next" : ""}">${i + 1} ${GUNS[k].n.split(" ")[0]}${k === nextGun && k !== me.gun && me.gun !== "pistol" ? " · next" : ""}</span>`).join("") + `<span class="${me.gun === "pistol" ? "on" : ""}">Q Pistol</span>`; if (hud.weps !== weps) { hud.weps = weps; $("hudWeps").innerHTML = weps; } }
  fitViewGun(me.gun);
  { const gn = GUNS[me.gun].n; if ($("hudGun").textContent !== gn) $("hudGun").textContent = gn; }
  $("xhair").classList.toggle("hitm", hitTimer > 0 && killTimer <= 0); $("xhair").classList.toggle("kill", killTimer > 0); $("xhair").classList.toggle("hs", hsTimer > 0);
  $("hudT").textContent = state === "count" ? String(Math.ceil(countdown)) : fmtT(roundLeft());
  { const spike = perf.lastAt && performance.now() - perf.lastAt < 3000 ? ` · spike ${perf.lastMs}ms` : "", snap = online && net.worstGap > 0.15 ? ` · snap ${Math.round(net.worstGap * 1000)}ms` : "";
    $("hudPing").textContent = online ? `${net.ping} ms${net.lag() > 12 ? ` · lag ${net.lag()}` : ""}${snap}${spike}` : spike.replace(" · ", ""); }
  const place = ranked().indexOf(me) + 1; $("hudPlace").textContent = state === "play" ? `${ord(place)} of ${PLAYERS}` : "";
  if (state === "play") { if (place === 1 && lastPlace > 1 && me.kills > 0) { say("TOP OF THE BOARD"); play("top"); } lastPlace = place; } else lastPlace = 0;
  $("hudK").textContent = me.kills; $("hudKD").textContent = `K · ${me.deaths} D${me.streak >= 2 ? ` · ×${me.streak}` : ""}`; $("hudName").textContent = me.name;
  $("hudHpN").textContent = Math.round(Math.max(0, me.hp));
  const g = GUNS[me.gun]; $("hudAmmo").textContent = me.reloading ? "··" : me.ammo; $("hudMag").textContent = `/ ${g.mag}`;
  $("lockHint").hidden = locked || state !== "play" || me.dead;
  if (!me.dead && !$("death").hidden) $("death").hidden = true;   // (online, the snapshot that says you're alive lands a frame or two after the spawn event)
}
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } }
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0;
function advance(dt) {
  if (state === "count") { countdown -= dt; if (Math.ceil(countdown) < countBeep) { countBeep = Math.ceil(countdown); play("count"); } if (countdown <= 0) { state = "play"; log("Go!"); say("GO"); play("go"); } }
  if (online) { acc += dt; while (acc >= PHYS.STEP60) { onlineTick(PHYS.STEP60); acc -= PHYS.STEP60; } return; }
  acc += dt; while (acc >= STEP) { tick(STEP); acc -= STEP; }
  if (state === "play" && roundT >= ROUND_S) endRound();
}
/* Frames over 60 ms, with what the network was doing at the time: `__bs.perf.spikes` in the console; the HUD's ping cell shows the last one
   for three seconds. `__bs.drive(true)` runs the loop from a timer for a tab the browser is not painting. */
const perf = { spikes: [], lastAt: 0, lastMs: 0, drive: 0 };
function frame(now, driven) {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  if (raw > 0.06 && raw < 5 && state !== "menu") { perf.lastAt = now; perf.lastMs = Math.round(raw * 1000); perf.spikes.push({ at: Math.round(now / 100) / 10, ms: perf.lastMs, lag: online ? net.lag() : 0, snapGap: online ? Math.round(net.gapNow() * 1000) : 0, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }); if (perf.spikes.length > 40) perf.spikes.shift(); }
  resize(); advance(dt); draw(dt); hud(dt);
  fpsN++; fpsT += dt; if (fpsT >= 1) { $("loadStat").textContent = `${fpsN} fps`; fpsN = 0; fpsT = 0; }
  if (!driven) requestAnimationFrame(frame);
}
buildMap(mapKey); reset(); state = "menu"; $("hudGun").textContent = GUNS.ar.n; $("hudMag").textContent = `/ ${GUNS.ar.mag}`; drawProfile(); showMenu("play");
syncFromServer().then((me2) => { if (me2) { redressMe(); drawProfile(); } if (!$("over").hidden) drawMenu(); });   // redrawn for a guest too: that is when the sign-in row appears
window.__bs = { perf, onEvent, killCard, drive(on) { clearInterval(perf.drive); perf.drive = on ? setInterval(() => frame(performance.now(), true), 1000 / 60) : 0; }, beans, get me() { return me; }, get world() { return world; }, get state() { return state; }, get roundT() { return roundT; }, get online() { return online; }, net, playOnline, start, GUNS, profile, setMap: (k) => { mapKey = k; }, aim(y, p) { yaw = y; pitch = p; }, set fire(v) { mouseFire = v; }, set keys(k) { Object.assign(keys, k); }, endRound, showMenu,
  sim(seconds) { for (let k = 0; k < seconds * 60; k++) advance(1 / 60); draw(1 / 60); hud(1 / 60); } };
requestAnimationFrame(frame);

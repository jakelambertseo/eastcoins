/* CS67 (files named blockshot) — a fast arena free-for-all on the bean engine (2026-10-08). The owner wants it standalone in the Games section: "cleaning
   up the game, adding some free sounds, free textures, a leveling mechanism for skins, total stat tracking (kills, kd, etc). make the
   maps larger with fewer blocks/things that break movement".

   Stage 2 (same day): THE RULES LEFT THIS FILE. Physics, slide-hop, guns, the shot ray, damage, kills, respawns, the maps and the bots
   are /v3/assets/js/blockshot-rules.js, import-free, so the arcade server runs the identical match (tools/blockshot-test.mjs proves it
   on Node). This file draws it: three.js, textures (tex.js), sounds (audio.js), the profile (profile.js: XP, skins, stats, settings),
   the HUD and the menus. It steps the rules itself while the match is local (you against bots); on the server it will apply snapshots
   and predict only your own bean. `stepWorld` hands back EVENTS and everything you hear and read comes from those. Nothing calls /api/. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { World, newBean, stepWorld, botInput, respawnBean, cast, switchGun, SWAP_S, V, PHYS, RULES, GUNS, GUN_KEYS, PRIMARY_KEYS, MAPS, MAP_LIST, BOT_NAMES, BOTS, BOMB, BOMB_MAP, newBomb, bombStartRound, bombStep, bombGoal, isAtk, PARK, PARK_MAPS, newRun, parkPlace, parkStep, parkReset, medalFor, GG, ggGun } from "/v3/assets/js/blockshot-rules.js?v=20";
import { finMat, finCss, finOf, knifeOf } from "./armory-fin.js?v=1";
import { createNet } from "./net.js?v=21";
import { material, skin as skinTex } from "./tex.js?v=1";
import { play, setVolume, ensure as audioOn } from "./audio.js?v=11";
import { profile, award, need, SKINS, COLORS, owns, wear, kd, accuracy, recordRound, titleFor, XP, save, syncFromServer, unlockedBetween, site } from "./profile.js?v=16";

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
  for (const m of mapMeshes) { scene.remove(m); m.geometry?.dispose(); } mapMeshes = []; pickupMeshes = []; bombMesh = null;
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
  // a course: a label over each checkpoint and the finish
  if (map.park) { const label = (text, x, y, z, col) => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g2 = c.getContext("2d"); g2.textAlign = "center"; g2.font = "800 72px Rajdhani, sans-serif"; g2.lineWidth = 8; g2.strokeStyle = "#000"; g2.strokeText(text, 128, 88); g2.fillStyle = col; g2.fillText(text, 128, 88); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, opacity: 0.9 })); sp.scale.set(3.2, 1.6, 1); sp.position.set(x, y + 3.2, z); scene.add(sp); mapMeshes.push(sp); };
    map.park.cps.forEach((c, i) => label(c.k || `CP ${i + 1}`, c.x, c.y, c.z, "#6ad0ff")); label("FINISH", map.park.finish.x, map.park.finish.y, map.park.finish.z, "#ffd84a"); }
  // the bomb map: a letter over each site, and the bomb itself (hidden until it is on the ground or planted)
  bombMesh = null;
  if (map.bomb) {
    for (const st of map.bomb.sites) { const c = document.createElement("canvas"); c.width = 128; c.height = 128; const x = c.getContext("2d"); x.textAlign = "center"; x.font = "800 96px Rajdhani, sans-serif"; x.lineWidth = 10; x.strokeStyle = "#000"; x.strokeText(st.k, 64, 96); x.fillStyle = "#ffd84a"; x.fillText(st.k, 64, 96);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, opacity: 0.85 })); sp.scale.set(2.4, 2.4, 1); sp.position.set(st.x, st.y + 4.5, st.z); scene.add(sp); mapMeshes.push(sp); }
    bombMesh = new THREE.Group(); bombMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.4), bombMats.body)); const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bombMats.light.clone()); l.position.set(0.18, 0.22, 0); bombMesh.add(l); bombMesh.visible = false; scene.add(bombMesh); mapMeshes.push(bombMesh);
  }
}
let pickupMeshes = [], bombMesh = null;
const bombMats = { body: new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.6 }), light: new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0x300000 }) };
const pickMats = { red: new THREE.MeshStandardMaterial({ color: 0xe03a3a, emissive: 0x401010 }), white: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x404040 }), yellow: new THREE.MeshStandardMaterial({ color: 0xf0c020, emissive: 0x403000 }), dark: new THREE.MeshStandardMaterial({ color: 0x202028 }) };

/* ------------------------------------------------------------------ beans and skins */
const skinMat = (pattern, colKey) => new THREE.MeshStandardMaterial({ map: skinTex(pattern, COLORS[colKey] ?? 0xffd84a), roughness: pattern === "gold" || pattern === "carbon" ? 0.3 : 0.5, metalness: pattern === "gold" ? 0.6 : pattern === "carbon" ? 0.3 : 0 });
/* THE ARMORY ON A BEAN (2026-10-10): `look` is what the player wears ({ ar, sniper, shotgun, pistol, knife, bean } item ids from the
   Armory, only the ones that are not factory). The bean's body takes the bean finish; the gun in its hand takes the finish of the gun it
   holds (set as the held gun changes, in draw). The Locker's level skins are the fallback for both. */
let myLook = null;
const lookGunMat = (look, gun, fallback) => (look && look[gun] ? finMat(finOf(look[gun])) : fallback);
let gunModels = {}, steelMat = null;   // filled below; declared here because the beans' rigs are built first
function beanMesh(sk, parent = scene, look = null) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), look && look.bean ? finMat(finOf(look.bean)) : skinMat(sk.pattern, sk.body)); body.castShadow = true; body.position.y = 0.7; g.add(body);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: COLORS[sk.visor] ?? 0xffffff, roughness: 0.2, metalness: sk.visor === "gold" ? 0.6 : 0 }));
  visor.scale.set(1, 0.55, 0.6); visor.rotation.x = Math.PI / 2; visor.position.set(0, 0.98, -0.3); g.add(visor);
  for (const x of [-0.11, 0.11]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: sk.visor === "black" ? 0xffffff : 0x111111 })); eye.position.set(x, 1.0, -0.45); g.add(eye); }
  // the gun in the hand (2026-10-11): the real models, the one held shown, its receiver in the Armory finish for that gun
  const rig = new THREE.Group(), models = makeGunModels(skinMat(sk.gun, "black")); for (const [k, m] of Object.entries(models)) { m.visible = k === "ar"; rig.add(m); }
  rig.scale.setScalar(0.95); rig.position.set(0.46, 0.68, -0.3); rig.rotation.set(0.05, -0.12, 0); /* big enough to read at twenty metres, held at the hip, barrel a touch inward */ g.add(rig); g.userData.rig = models; g.userData.rigDefault = skinMat(sk.gun, "black");
  parent.add(g); return g;
}
function makeBean(sk, look = null) {
  const g = beanMesh(sk, scene, look);
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); tag.scale.set(2.2, 0.55, 1); tag.position.y = 1.9; g.add(tag);
  return { g, tag, tagCanvas: c, tagKey: "", look, gunKey: "" };
}
function paintTag(b) {
  const carrier = Boolean(bomb) && bomb.carrier === b.i, side = b.team === undefined || !me || me.team === undefined ? "" : b.team === me.team ? "us" : "them";
  const label = b.name;   // (2026-10-11) bots carry obviously-bot names from BOT_NAMES, so the tag needs no mark
  const key = `${label}|${Math.round(b.hp)}|${carrier ? 1 : 0}|${side}`; if (key === b.mesh.tagKey) return; b.mesh.tagKey = key;
  const c = b.mesh.tagCanvas, x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height);
  x.textAlign = "center"; x.lineWidth = 5; x.strokeStyle = "#000"; x.font = "800 26px Lora, Georgia, serif"; x.strokeText(label, 128, 30); x.fillStyle = side === "us" ? "#8ae07a" : side === "them" ? "#ff7a7a" : b.bot ? "#cfd5de" : "#fff"; x.fillText(label, 128, 30);
  if (carrier) { const w = x.measureText(label).width; x.fillStyle = "#ffd84a"; x.fillRect(128 - w / 2 - 22, 12, 14, 14); x.fillStyle = "#000"; x.fillRect(128 - w / 2 - 18, 16, 6, 6); }
  x.fillStyle = "#000"; x.fillRect(48, 40, 160, 10); x.fillStyle = b.hp > 50 ? "#8ae07a" : b.hp > 25 ? "#ffd84a" : "#ff5a5a"; x.fillRect(50, 42, 156 * clamp(b.hp / MAX_HP, 0, 1), 6);
  b.mesh.tag.material.map.needsUpdate = true;
}
const randomSkin = () => ({ body: pick(SKINS.body).k, pattern: pick(["plain", "plain", "stripes", "camo", "hex"]), visor: pick(SKINS.visor).k, gun: pick(["plain", "plain", "stripes", "camo"]) });
const beans = [];
for (let i = 0; i < PLAYERS; i++) { const b = newBean(i, i ? BOT_NAMES[i - 1] : "You", i > 0); b.skill = rnd(BOTS.skill[0], BOTS.skill[1]); b.mesh = makeBean(i ? randomSkin() : profile.skin); beans.push(b); }
let me = beans[0]; me.mesh.g.visible = false;   // first person: you don't see your own bean (online, `me` is whichever slot the server gives)
function redressMe() { scene.remove(me.mesh.g); me.mesh = makeBean(profile.skin, myLook); me.mesh.g.visible = false; me.look = myLook; dressGuns(); }
/** The guns in your hands wear the Armory finishes, the Locker's gun finish where there is none; the knife's blade likewise. */
function dressGuns() {
  for (const [k, g] of Object.entries(gunModels)) { if (k === "knife") { for (const m of g.userData.blade || []) m.material = myLook && myLook.knife ? finMat(finOf(myLook.knife), true) : steelMat; } else for (const m of g.userData.bodies || []) m.material = lookGunMat(myLook, k, skinMat(profile.skin.gun, "black")); }
}
/** Show the held gun on a bean's rig, in its finish. */
function dressRig(g, gun, look) {
  const rig = g.userData.rig; if (!rig) return;
  for (const [k, m] of Object.entries(rig)) { m.visible = k === gun; if (k === "knife") { for (const bl of m.userData.blade || []) bl.material = look && look.knife ? finMat(finOf(look.knife), true) : steelMat; } else for (const bd of m.userData.bodies || []) bd.material = lookGunMat(look, k, g.userData.rigDefault); }
}
function redressBean(b, look) { const vis = b.mesh.g.visible; scene.remove(b.mesh.g); b.mesh = makeBean(b.bot ? randomSkin() : profile.skin, look); b.look = look; b.mesh.g.visible = vis; paintTag(b); }

// the gun in your hands
/* THE GUNS IN YOUR HANDS (2026-10-09, the owner: "different gun models for the different gun selections"): four models built from
   boxes and tubes, one shown at a time, all hung from the same group so the kick, the bob and the reload dip are shared. The receiver
   of each wears the gun skin from the Locker (`viewGunBodies`). */
const viewGun = new THREE.Group();
/** The five gun models, built from boxes and tubes: used for the hands (viewGun), for every bean's rig, and for the Armory preview.
    `bodyMat` is the receiver's material (the skin). Each model carries userData.bodies (the receivers) and, for the knife, userData.blade. */
function makeGunModels(bodyMat) {
  const M = (c, r = 0.6, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const steel = M(0x55555f, 0.45, 0.6), dark = M(0x1a1a22), wood = M(0x6b4423, 0.8, 0), glass = M(0x3a6a9a, 0.2, 0.8); steelMat = steel;
  const box = (w, h, d, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); return o; };
  const tube = (r, len, mat, x, y, z, r2 = r) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, 10), mat); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o; };
  const bodies = []; const body = (w, h, d, x, y, z) => { const o = box(w, h, d, bodyMat, x, y, z); bodies.push(o); return o; };
  // the rifle: receiver, barrel, a foregrip, the magazine, the grip, a stock, a sight on top
  const ar = new THREE.Group(); ar.add(body(0.12, 0.14, 0.62, 0, 0, 0), tube(0.035, 0.4, steel, 0, 0.01, -0.5, 0.04), box(0.07, 0.09, 0.16, dark, 0, -0.05, -0.33), box(0.07, 0.18, 0.12, dark, 0, -0.14, -0.06), box(0.08, 0.2, 0.1, wood, 0, -0.14, 0.16), box(0.09, 0.11, 0.24, dark, 0, -0.01, 0.42), box(0.03, 0.05, 0.14, dark, 0, 0.09, -0.08));
  // the sniper: a long receiver, a long barrel, the scope on its mounts, a bolt on the right, a wooden stock
  const sn = new THREE.Group(); sn.add(body(0.1, 0.12, 0.7, 0, 0, 0), tube(0.025, 0.7, steel, 0, 0.01, -0.68, 0.03), tube(0.045, 0.32, dark, 0, 0.13, -0.04), tube(0.05, 0.03, glass, 0, 0.13, -0.21), box(0.03, 0.06, 0.03, dark, 0, 0.08, 0.06), box(0.03, 0.06, 0.03, dark, 0, 0.08, -0.14), tube(0.012, 0.07, steel, 0.075, 0.01, 0.1), box(0.08, 0.2, 0.1, wood, 0, -0.14, 0.18), box(0.08, 0.14, 0.3, wood, 0, -0.02, 0.48));
  // the shotgun: a fat barrel over the magazine tube, a wooden pump, a short receiver, a wooden stock
  const sg = new THREE.Group(); sg.add(body(0.11, 0.13, 0.4, 0, 0, 0.04), tube(0.045, 0.62, steel, 0, 0.025, -0.5), tube(0.03, 0.5, steel, 0, -0.04, -0.46), box(0.09, 0.09, 0.18, wood, 0, -0.04, -0.3), box(0.08, 0.2, 0.1, wood, 0, -0.14, 0.14), box(0.09, 0.13, 0.3, wood, 0, -0.02, 0.4));
  // the pistol: a slide, a stub of barrel, the grip, a trigger guard
  const kn = new THREE.Group(); { const bl = box(0.035, 0.2, 0.75, steel, 0, 0.02, -0.5); kn.add(bl, box(0.07, 0.26, 0.05, steel, 0, 0, -0.1), box(0.06, 0.15, 0.42, dark, 0, -0.02, 0.14)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 4), steel); tip.rotation.x = -Math.PI / 2; tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.35); tip.position.set(0, 0.02, -1.0); kn.add(tip); kn.userData.blade = [bl, tip]; kn.position.set(0.05, -0.05, 0.1); kn.rotation.set(0.1, 0.25, -0.35); }
  const pi = new THREE.Group(); pi.add(body(0.08, 0.09, 0.3, 0, 0.02, 0.08), tube(0.02, 0.1, steel, 0, 0.02, -0.11), box(0.07, 0.2, 0.1, dark, 0, -0.1, 0.17), box(0.03, 0.03, 0.08, dark, 0, -0.04, 0.1));
  { let n = 0; for (const [g, c] of [[ar, 1], [sn, 1], [sg, 1], [pi, 1]]) { g.userData.bodies = bodies.slice(n, n + c); n += c; } }
  return { ar, sniper: sn, shotgun: sg, pistol: pi, knife: kn };
}
{
  gunModels = makeGunModels(skinMat(profile.skin.gun, "black")); for (const g of Object.values(gunModels)) { g.visible = false; viewGun.add(g); }
  viewGun.scale.setScalar(0.55); viewGun.position.set(0.2, -0.17, -0.42); camera.add(viewGun);
}
let shownGun = "";
function fitViewGun(k) { if (k === shownGun) return; shownGun = k; for (const [n, g] of Object.entries(gunModels)) g.visible = n === k; }

/* ------------------------------------------------------------------ input */
const keys = {};
let yaw = 0, pitch = 0, locked = false, mouseFire = false, scoping = false, dragLook = false, lastX = 0, lastY = 0, fireLatch = false, nextGun = "ar", swapAt = -9, swingAt = -9;
const sens = () => 0.0022 * profile.settings.sens / (scoping ? GUNS[me.gun].zoom || 1 : 1), inv = () => (profile.settings.invertY ? -1 : 1);
addEventListener("keydown", (e) => {
  if (e.code === "Escape" && !$("over").hidden && state === "play") { resumeGame(); return; }   // the menu is open mid-match: Esc closes it again
  if (!locked && document.activeElement !== canvas) return; keys[e.code] = true;
  if (e.code === "Tab") { $("board").hidden = false; drawBoard(); e.preventDefault(); }
  if (e.code === "Escape" && state === "play" && $("over").hidden) { showMenu("play"); if (online) { /* still in the match; Play again rejoins */ } }
  if (/^Digit[123]$/.test(e.code)) {   // instant, like Krunker (2026-10-09): the gun in hand changes now with a short draw, and it is the gun you respawn with
    nextGun = { Digit1: "ar", Digit2: "sniper", Digit3: "shotgun" }[e.code];
    if (mode === "bomb" && bomb && bomb.phase === "live" && state === "play" && nextGun !== me.roundGun) { if (online) net.setGun(nextGun); hint(`${GUNS[nextGun].n} next round`); }   // locked mid-round (2026-10-10): the pick waits for the next one; your own primary is always allowed back
    else if (state === "play" && !me.dead && nextGun !== me.gun) swapTo(nextGun); else if (online) net.setGun(nextGun);
  }
  if (e.code === "KeyQ") swapTo(me.gun === "pistol" ? "knife" : me.gun === "knife" ? myPrimary() : "pistol");   // primary -> pistol -> knife -> primary
  if (e.code === "Digit4") swapTo(me.gun === "pistol" ? myPrimary() : "pistol"); if (e.code === "Digit5") swapTo(me.gun === "knife" ? myPrimary() : "knife");
  if (e.code === "BracketLeft" || e.code === "BracketRight") { profile.settings.sens = clamp(Math.round((profile.settings.sens + (e.code === "BracketRight" ? 0.1 : -0.1)) * 10) / 10, 0.3, 3); save(); hint(`Sensitivity ${profile.settings.sens.toFixed(1)}×`); }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Tab") $("board").hidden = true; });
/** Change the gun in hand now (the server hears the same; the rules give it a draw time). */
/** The primary to go back to: the one this round started with in the bomb mode, else the pick. */
const myPrimary = () => (mode === "bomb" && me.roundGun && GUNS[me.roundGun] ? me.roundGun : nextGun);
function swapTo(k) { if (mode === "gg") return; if (state !== "play" || me.dead || k === me.gun || !GUNS[k]) return; if (online) { net.setGun(k); switchGun(me, k, null); swapAt = performance.now() / 1000; play("swap"); } else switchGun(me, k, events); }
let wheelAt = 0;
addEventListener("wheel", (e) => { if (!locked || state !== "play") return; const now = performance.now(); if (now - wheelAt < 250) return; wheelAt = now; swapTo(me.gun === "pistol" ? "knife" : me.gun === "knife" ? myPrimary() : "pistol"); }, { passive: true });
/** Back into the match from the menu (2026-10-09, the owner: settings had no way out). Settings apply as they change, so Apply is just this. */
function resumeGame() { if (state !== "play") return showMenu("play"); $("over").hidden = true; canvas.focus(); grabMouse(); }
function grabMouse() { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch {} }
canvas.addEventListener("click", () => { if (state === "play" || state === "count") grabMouse(); canvas.focus(); audioOn(); });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; $("lockHint").hidden = locked || state !== "play"; });
addEventListener("mousemove", (e) => {
  if (locked) { if (profile.settings.smooth) { mdx += e.movementX; mdy += e.movementY; } else { yaw -= e.movementX * sens(); pitch = clamp(pitch - e.movementY * sens() * inv(), -1.45, 1.45); } }
  else if (dragLook) { yaw -= (e.clientX - lastX) * 0.005; pitch = clamp(pitch - (e.clientY - lastY) * 0.005 * inv(), -1.45, 1.45); lastX = e.clientX; lastY = e.clientY; }
});
canvas.addEventListener("mousedown", (e) => { if (e.button === 0 && mode === "bomb" && bomb && me.dead && state === "play") { const mates = inPlay().filter((b) => b !== me && b.team === me.team && !b.dead); if (mates.length > 1) spec = mates[(mates.indexOf(spec) + 1) % mates.length]; }
  if (e.button === 0) { mouseFire = true; if (!locked) { dragLook = true; lastX = e.clientX; lastY = e.clientY; } } if (e.button === 2 && !me.dead) scoping = profile.settings.adsToggle ? !scoping : true; });
addEventListener("mouseup", (e) => { if (e.button === 0) { mouseFire = false; dragLook = false; } if (e.button === 2 && !profile.settings.adsToggle) scoping = false; });
/* Settings that matter while playing (2026-10-09): mouse smoothing is two-frame averaging of the deltas (off by default, raw is right for
   most), ADS can be a toggle, [ and ] change the sensitivity mid-fight with a hint, and the crosshair has a colour and a size. */
let mdx = 0, mdy = 0;
function smoothMouse() { if (!mdx && !mdy) return; yaw -= mdx * 0.5 * sens(); pitch = clamp(pitch - mdy * 0.5 * sens() * inv(), -1.45, 1.45); mdx *= 0.5; mdy *= 0.5; if (Math.abs(mdx) < 0.05) mdx = 0; if (Math.abs(mdy) < 0.05) mdy = 0; }
function hint(text) { const el = $("hint"); el.textContent = text; el.hidden = false; clearTimeout(hint.t); hint.t = setTimeout(() => { el.hidden = true; }, 1500); }
const XHAIR_COLORS = { white: "#ffffff", green: "#7dff6a", cyan: "#6ad0ff", yellow: "#ffd84a", pink: "#ff6ad5", red: "#ff5a5a" };
function applyXhair() { const st = profile.settings, x = $("xhair"); x.dataset.style = st.crosshair; x.style.setProperty("--c", XHAIR_COLORS[st.crosshairColor] || "#fff"); x.style.setProperty("--len", `${(8 * st.crosshairSize).toFixed(1)}px`); x.style.setProperty("--w", `${Math.max(1, 2 * st.crosshairSize).toFixed(1)}px`); }
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const lookDir = () => new V(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
function playerInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (keys.ArrowLeft) yaw += 0.04; if (keys.ArrowRight) yaw -= 0.04;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = fx * f + rx * s, z = fz * f + rz * s, l = Math.hypot(x, z), fire = mouseFire || keys.KeyJ;
  const inp = { x: l > 1 ? x / l : x, z: l > 1 ? z / l : z, jump: keys.Space, fire, fireTap: fire && !fireLatch, slide: keys.ShiftLeft || keys.ShiftRight, reload: keys.KeyR, aim: lookDir(), scope: scoping, use: Boolean(keys.KeyE) };
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
let hitTimer = 0, killTimer = 0, hsTimer = 0, dmgT = 0, dmgAngle = 0, kcT = 0, lastPlace = 0, roll = 0, landDip = 0, wasGrounded = true, vyPrev = 0;
/** Left-right placement of a sound from a world position, against where the camera looks. */
const panTo = (p) => { const dx = p.x - camera.position.x, dz = p.z - camera.position.z, l = Math.hypot(dx, dz) || 1; return clamp((dx * Math.cos(yaw) + dz * -Math.sin(yaw)) / l, -1, 1); };
/** The kill card under the crosshair: who, headshot or not, and what it paid. */
function killCard(name, head, xp, brass = 0) { const el = $("killcard"); $("kcName").textContent = name; $("kcTag").hidden = !head; $("kcXp").textContent = [xp ? `+${xp} XP` : "", brass ? `+${brass} Brass` : ""].filter(Boolean).join(" · "); el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); kcT = 1.7; }
function dmgFrom(by) { dmgAngle = Math.atan2(by.p.x - me.p.x, by.p.z - me.p.z); dmgT = 0.7; }
function flashDamage() { const el = $("hurt"); el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
const meStats = { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 };
const gunStat = (g) => (meStats.byGun[g] ||= { kills: 0, shots: 0, hits: 0 });
/* ONLINE FEEL (2026-10-09, the owner: "vs bots … everything was a lot smoother"). Three things were waiting on the server that need not:
   your own jump, slide, pad, reload and swap sounds (now played from the page's prediction, the server's echo for you is dropped), the
   hitmarker and hit sound (now shown from the page's own cast the instant you fire; the server's hit event, which follows within a
   round trip, is the one that counts and is not sounded twice), and nothing else — damage, kills and everyone else stay the server's. */
const LOCAL_SOUNDS = new Set(["jump", "slide", "pad", "reload", "empty", "swap"]);
let localHitAt = -9, lastReloadAt = -9;
function onEvent(e) {
  const mine = e.b === me || e.by === me;
  if (online && LOCAL_SOUNDS.has(e.type) && e.b === me && !e.local) return;   // the server's copy of something the prediction already sounded
  switch (e.type) {
    case "shot": {
      if (online && e.b === me && !e.local) return;   // drawn when the trigger was pulled (see onlineTick)
      const muzzle = e.b === me ? camera.localToWorld(new V3(0.2, -0.15, -0.75)) : e.pellets[0].from.clone().addScaled(e.b.aim, 0.6);
      if (!GUNS[e.gun]?.melee) for (const p of e.pellets) tracer(muzzle, p.to, e.b === me);
      if (e.b !== me && !me.dead && !GUNS[e.gun]?.melee) { const eye = new V(camera.position.x, camera.position.y, camera.position.z); let near = 9; for (const p of e.pellets) { const d = p.to.clone().sub(p.from), L = d.len() || 1; d.scale(1 / L); const t = clamp(eye.clone().sub(p.from).dot(d), 0, L), q = p.from.clone().addScaled(d, t); near = Math.min(near, q.dist(eye)); } if (near < 1.8) play("whizz", 0.7, panTo(e.pellets[0].to)); }
      if (e.b === me) { if (GUNS[e.gun]?.melee) swingAt = performance.now() / 1000; else viewGun.position.z += scoping ? 0.06 : 0.12; meStats.shots++; gunStat(me.gun).shots++; play(e.gun); } else play(e.gun, clamp(0.6 - e.b.p.dist(me.p) / 70, 0, 0.6), panTo(e.b.p));
      return;
    }
    case "hit": paintTag(e.target);
      if (e.by === me) { const dup = online && performance.now() - localHitAt < 300; hitTimer = 0.14; if (e.head) hsTimer = 0.22; meStats.hits++; gunStat(me.gun).hits++; if (e.head) meStats.headshots++; if (!dup) play(e.head ? "headshot" : "hit"); floatText(e.target.p, e.head ? `${Math.round(e.dmg)} HS` : `${Math.round(e.dmg)}`, e.head ? "#ffd84a" : "#fff"); }
      if (e.target === me) { flashDamage(); play("hurt", 0.6); if (e.by && e.by !== me) { dmgFrom(e.by); play("thud", 1, panTo(e.by.p)); } }
      return;
    case "kill": {
      const { target, by, head } = e; target.mesh.g.visible = false; paintTag(target);
      const who = (b) => (b.bot ? esc(b.name) : "<b>you</b>");
      { const fin = by && by.look && by.look[by.gun] ? finOf(by.look[by.gun]) : null, chip = by ? `<i class="fd-gun${fin ? " skin" : ""}" style="${fin ? `--sw:url(${finCss(fin)})` : ""}">${esc(GUNS[by.gun]?.n.split(" ")[0] || "")}${head ? ' <span class="hs">⌖</span>' : ""}</i>` : "";
        feed(!by ? `${who(target)} fell` : `${who(by)} ${chip} ${who(target)}`, by === me ? "me" : target === me ? "dead" : ""); }
      log(!by ? `${target.bot ? target.name : "You"} fell.` : `${by.bot ? by.name : "You"} killed ${target.bot ? target.name : "you"}${head ? " (headshot)" : ""}.`, by === me);
      if (by === me) {
        killTimer = 0.4; gunStat(me.gun).kills++; play(head ? "killhs" : "kill"); if (me.streak % 3 === 0) meStats.streaks++;
        const xpCounts = online ? !net.you?.guest : !profile.server, rates = armory.data?.catalogue?.rates || { kill: 5, headshot: 5 }; killCard(target.name, head, xpCounts ? (head ? XP.headshot : XP.kill) : 0, online && xpCounts ? rates.kill + (head ? rates.headshot : 0) : 0);
        const call = me.streak === 3 ? "TRIPLE KILL" : me.streak === 5 ? "RAMPAGE" : me.streak === 10 ? "UNSTOPPABLE" : me.streak >= 15 && me.streak % 5 === 0 ? "GODLIKE" : "";
        if (call) { say(call, `${me.streak} in a row`); play("streak"); clearTimeout(say.t); say.t = setTimeout(() => { if ($("hudMsg").textContent === call) say(""); }, 1800); }
      }
      if (target === me) { me.lastBy = by; me.respawn = RESPAWN_S; $("deathBy").textContent = by ? by.name : "the fall"; $("death").hidden = false; play("die"); if (mode === "bomb") setTimeout(() => { if (me.dead) $("death").hidden = true; }, 2600); }   // (the mouse stays grabbed: every grab shows the browser's pointer notice, so it's once per Play, not once per death)
      drawSb(); return;
    }
    case "spawn": if (e.b !== me) e.b.mesh.g.visible = true; paintTag(e.b); if (e.b === me) { const face = () => { yaw = me.facing; pitch = -0.05; }; if (online) setTimeout(face, 150); else face(); $("hudGun").textContent = GUNS[me.gun].n; $("death").hidden = true; say(""); play("spawn"); if (state === "play" && !locked) grabMouse(); } return;
    case "jump": if (mine) play("jump"); return;
    case "slide": if (mine) play("slide", clamp(Math.hypot(e.b.v.x, e.b.v.z) / 14, 0.4, 1)); return;
    case "pad": play("pad", mine ? 1 : 0.2); return;
    case "reload": if (mine) { if (performance.now() - lastReloadAt < 400) return; lastReloadAt = performance.now(); play("reload", GUNS[e.b.gun].reload / 1.5); } return;   // once, whichever of the prediction and the snapshot says it first
    case "swap": if (mine) { play("swap"); swapAt = performance.now() / 1000; } return;
    case "bomb": onBombEvent(e); return;
    case "park": onParkEvent(e); return;
    case "gg": { if (!e.b && e.s >= 0) e.b = beans[e.s]; if (e.b) e.b.gg = e.step; if (e.b !== me) return; if (e.what === "win") { say("LADDER COMPLETE", "you win the round"); play("levelup"); } else if (e.what === "down") { say("KNIFED", `back to gun ${e.step + 1}`); play("lose"); } else { say(`GUN ${e.step + 1} / ${GG.ladder.length}`, GUNS[ggGun(me)].n); play("swap"); } clearTimeout(say.t); say.t = setTimeout(() => say(""), 1500); return; }
    case "pickup": if (mine) { play(e.kind); floatText(me.p, e.kind === "health" ? "+50 HP" : "AMMO", e.kind === "health" ? "#ff6a6a" : "#ffd84a"); } else play(e.kind, clamp(0.4 - e.b.p.dist(me.p) / 40, 0, 0.4), panTo(e.b.p)); return;
    case "empty": if (mine) play("empty"); return;
  }
}

/* ------------------------------------------------------------------ the round */
let t = 0, roundT = 0, state = "menu", countdown = 0, countBeep = 0, mapKey = MAP_LIST[0], online = false;
/* THE BOMB MODE on the page (2026-10-09). `mode` is "ffa" or "bomb" (the Play tab's switch, or ?mode=bomb). `bomb` is the round state:
   in practice the rules' own object, stepped here; online a copy decoded from the snapshot's `bm` block. Six beans play; the other six
   of the twelve are parked dead and hidden. The dead watch a living teammate (`spec`). E is "use": plant or defuse. */
/* (2026-10-11) Inside the site the game is an iframe (/?view=cs67). Twitch refuses to be framed, so signing in has to leave by the TOP
   window and come back to the site's page, and signing out reloads the top so the shell's profile pill agrees with the game. */
const FRAMED = (() => { try { return window.top !== window; } catch { return true; } })();
let mode = ["bomb", "park", "gg"].includes(new URLSearchParams(location.search).get("mode")) ? new URLSearchParams(location.search).get("mode") : "ffa", bomb = null, spec = null;
const MAP_IMG = { lot: "ffa", docks: "docks", roofs: "roofs" }, IMG_V = 2;   // bump IMG_V when a card picture changes: the real URL is cached for a year
/* GUN GAME on the page (2026-10-11): the rules move the gun on every kill (`b.gg`); the page only shows the step and never swaps by hand. */
const gunPick = (b) => (mode === "gg" ? ggGun(b) : b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun);
/* PARKOUR on the page (2026-10-10). `courseKey` is the practice course; online the room says. `me.park` is the run (practice: the rules'
   object stepped here; online: decoded from the snapshot's `pr`). Ghosts: the course record's trail and your own best, fetched when the
   course loads and replayed from the moment your run starts, as see-through beans. */
let courseKey = PARK_MAPS[0], parkDone = null; const ghosts = { record: null, me: null, t0: -1 };
const fmtMs = (ms) => { if (ms === null || ms === undefined) return "—"; const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${String(Math.floor((ms % 1000) / 100))}`; };
const inPlay = () => (mode === "bomb" ? beans.filter((b) => b.team !== undefined) : beans);
const myTeam = () => (bomb && me && me.team !== undefined ? me.team : 0);
const teamName = (team) => (bomb ? (team === bomb.atk ? "Attackers" : "Defenders") : "");
const WHY = { boom: "the bomb went off", defused: "the bomb was defused", wipe: "the other side was wiped out", time: "time ran out" };
/* The round cards (2026-10-10, the owner: "round start/end cards … more horizontal than vertical"): one wide strip across the view.
   At the freeze: the attackers on the left, the defenders on the right (name and gun), the round and your side in the middle with the
   pick-your-gun countdown. After the round: who lived and who died on each side, who won and why in the middle, and the score. */
const roundLog = { plant: "", defuse: "" }, lastAlive = { us: -1, them: -1 };
function roundCard(kind) {
  const el = $("roundCard"); if (!bomb || !kind) { el.hidden = true; return; }
  const teams = [0, 1], mine = myTeam(), nameOf = (b) => esc(b.name), gunOf = (b) => GUNS[b.gun]?.n.split(" ")[0] || "";
  const side = (team) => { const list = inPlay().filter((b) => b.team === team); const h = `<h4>${teamName(team)}${team === mine ? " · you" : ""}</h4>`;
    return h + list.map((b) => kind === "start" ? `<span>${nameOf(b)} <small>${gunOf(b)}</small></span>` : `<span class="${b.dead ? "dead" : ""}">${nameOf(b)}${roundLog.plant === b.name ? " <small>planted</small>" : ""}${roundLog.defuse === b.name ? " <small>defused</small>" : ""}</span>`).join(""); };
  const left = bomb.atk, right = 1 - bomb.atk;
  $("rcLeft").className = `rc-side ${left === mine ? "us" : "them"}`; $("rcLeft").innerHTML = side(left);
  $("rcRight").className = `rc-side r ${right === mine ? "us" : "them"}`; $("rcRight").innerHTML = side(right);
  if (kind === "start") $("rcMid").innerHTML = `<b>Round ${bomb.round}</b><small>${isAtk(me, bomb) ? "you attack" : "you defend"}</small><small id="rcCount">pick your gun · 1 2 3</small>`;
  else { const w = bomb.lastWin, won = w && w.team === mine; $("rcMid").innerHTML = `<b class="${won ? "" : "lost"}">${won ? "Round won" : "Round lost"}</b><small>${w ? WHY[w.why] || w.why : ""}</small><em><i>${bomb.score[mine]}</i> – <i>${bomb.score[1 - mine]}</i></em>`; }
  el.hidden = false;
}
function decodeBomb(bm) {
  if (!bomb) bomb = newBomb();
  bomb.phase = ["freeze", "live", "post"][bm[0]] || "live"; bomb.t = bm[1]; bomb.round = bm[2]; bomb.score = [bm[3], bm[4]]; bomb.atk = bm[5]; bomb.carrier = bm[6];
  bomb.drop = bm[7] ? { x: bm[7][0], y: bm[7][1], z: bm[7][2] } : null; bomb.planted = bm[8] ? { site: bm[8][0], t: bm[8][1], ...(world?.map.bomb?.sites[bm[8][0]] || {}) } : null;
  bomb.act = bm[9] ? { kind: bm[9][0] === 1 ? "plant" : "defuse", s: bm[9][1], p: bm[9][2] } : null;
}
const roundLeft = () => Math.max(0, ROUND_S - (online ? net.round?.t || 0 : roundT));
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function onParkEvent(e) {
  if (!e.b && e.s >= 0 && beans[e.s]) e.b = beans[e.s]; const mine = e.b === me; if (!mine) return;
  switch (e.what) {
    case "start": play("go"); ghosts.t0 = performance.now() / 1000; parkDone = null; return;
    case "cp": { play("pad", 0.5); const gh = ghosts.record || ghosts.me, cp = world?.map.park?.cps[e.i]; let split = ""; if (gh && cp) { const k = gh.trail.findIndex((p) => Math.hypot(p[0] - cp.x, p[2] - cp.z) < cp.r && Math.abs(p[1] - cp.y) < 3); if (k >= 0) { const d = e.t - k * 100; split = ` · ${d <= 0 ? "−" : "+"}${(Math.abs(d) / 1000).toFixed(1)} s vs ${gh === ghosts.record ? esc(gh.name || "the record") : "your best"}`; $("hudSub").style.color = d <= 0 ? "#8ae07a" : "#ff7a7a"; setTimeout(() => { $("hudSub").style.color = ""; }, 1500); } }
      say(world?.map.park?.cps[e.i]?.k ? `LEVEL ${e.i + 1} CLEAR` : `CHECKPOINT ${e.i + 1}`, fmtMs(e.t) + split); clearTimeout(say.t); say.t = setTimeout(() => say(""), 1200); return; }
    case "fall": play("hurt"); flashDamage(); feed("fell · back to the checkpoint", "dead"); return;
    case "finish": parkDone = e; play(e.pb ? "levelup" : "win"); say(`FINISH ${fmtMs(e.ms)}`, e.pb && !online ? "personal best · R to run again" : "R to run again"); return;
    case "reset": ghosts.t0 = -1; parkDone = null; say(""); yaw = world.map.park.facing; pitch = 0; return;
  }
}
/* ghosts: see-through beans that replay a trail from the moment your run starts */
function ghostMesh(tint) { const g = beanMesh(profile.skin); g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; if (tint && o.material.emissive) o.material.emissive.setHex(tint); } }); g.visible = false; return g; }
async function ghostFetch(who) {
  const key = online ? world?.key : courseKey; if (!key || !PARK_MAPS.includes(key)) return;
  try { const j = await fetch(`/api/blockshot/park/ghost?course=${key}&who=${who}`, { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()); if (!j.ok) return;
    const old = ghosts[who]; if (old) { scene.remove(old.mesh); } ghosts[who] = j.ghost && j.ghost.trail.length ? { ...j.ghost, mesh: ghostMesh(who === "record" ? 0x7a5a00 : 0x0a3a6a), key } : null; if (ghosts[who]) { scene.add(ghosts[who].mesh); ghosts[who].mesh.scale.setScalar(0.98); } } catch {}
}
function drawGhosts() {
  const t = ghosts.t0 >= 0 && me.park?.running ? performance.now() / 1000 - ghosts.t0 : -1;
  for (const who of ["record", "me"]) { const g = ghosts[who]; if (!g) continue; const show = t >= 0 && t * 10 < g.trail.length; g.mesh.visible = show; if (!show) continue;
    const k = Math.min(g.trail.length - 1, Math.floor(t * 10)), a = g.trail[k], b = g.trail[Math.min(g.trail.length - 1, k + 1)], u = t * 10 - k; g.mesh.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - R, a[2] + (b[2] - a[2]) * u); g.mesh.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI; }
}
function onBombEvent(e) {
  if (!e.b && e.s >= 0 && beans[e.s]) e.b = beans[e.s];   // practice events name a slot, not a bean
  const who = (b) => (b ? (b === me ? "<b>you</b>" : esc(b.name)) : "someone"), mine = e.b === me, us = (team) => team === myTeam();
  switch (e.what) {
    case "round": if (e.score) bomb && (bomb.score = e.score.slice()); if (bomb) { bomb.round = e.round; bomb.atk = e.atk ?? bomb.atk; bomb.phase = "freeze"; } roundLog.plant = ""; roundLog.defuse = ""; lastAlive.us = -1; lastAlive.them = -1; spec = null; say(""); setTimeout(() => roundCard("start"), 60); return;
    case "go": play("go"); roundCard(null); me.roundGun = GUNS[me.gun]?.secondary ? nextGun : me.gun; if (bomb?.carrier === me.i) { say("YOU HAVE THE BOMB", "hold E at A or B to plant"); clearTimeout(say.t); say.t = setTimeout(() => say(""), 2500); } return;
    case "drop": feed(`${who(e.b)} dropped the bomb`); return;
    case "pick": feed(`${who(e.b)} picked up the bomb`); if (mine) say("YOU HAVE THE BOMB", "hold E at a site to plant"); return;
    case "planting": if (!mine) feed(`${who(e.b)} is planting at ${world?.map.bomb?.sites[e.site]?.k || "?"}`); return;
    case "planted": if (e.b) roundLog.plant = e.b.name; say("BOMB PLANTED", `at ${world?.map.bomb?.sites[e.site]?.k || "?"} · ${isAtk(me, bomb) ? "defend it" : "hold E to defuse"}`); play("planted"); feed(`${who(e.b)} planted the bomb at ${world?.map.bomb?.sites[e.site]?.k || "?"}`); return;
    case "defusing": if (e.b && e.b.team !== myTeam()) { say("DEFUSING", `${e.b.name} is on the bomb · stop them`); play("alarm"); clearTimeout(say.t); say.t = setTimeout(() => say(""), 2200); } else if (!mine) feed(`${who(e.b)} is defusing`); return;
    case "defused": if (e.b) roundLog.defuse = e.b.name; say("BOMB DEFUSED", who(e.b).replace(/<[^>]+>/g, "")); play("defused"); return;
    case "boom": play("boom"); say("BOOM", ""); return;
    case "win": { if (bomb) { bomb.score = e.score.slice(); bomb.lastWin = { team: e.team, why: e.why }; bomb.phase = "post"; } const won = us(e.team); say(""); play(won ? "win" : "lose"); feed(`${teamName(e.team)} win the round: ${WHY[e.why] || e.why}`, won ? "me" : "dead"); setTimeout(() => roundCard("end"), 60); return; }
    case "match": return;
  }
}
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
  onBomb: (bm) => decodeBomb(bm),
  onGG: (arr) => arr.forEach((v, i) => { if (beans[i]) beans[i].gg = v; }),
  onPark: (pr) => { pr.forEach((p, i) => { const b = beans[i]; if (!b) return; if (!p) { b.park = null; return; } const r = b.park || (b.park = newRun()); r.cp = p[0]; r.t = p[1]; r.done = Boolean(p[2]); r.running = Boolean(p[3]); }); },
  onParkMsg: (m) => { if (m.what !== "saved") return; const bits = []; if (m.record?.yours) bits.push("course record"); else if (m.pb) bits.push("personal best"); if (m.newTiers?.length) bits.push(`${m.newTiers[0]} medal · +${m.brass} Brass`); if (bits.length) { say(bits[0].toUpperCase(), bits.slice(1).join(" · ")); clearTimeout(say.t); say.t = setTimeout(() => say(""), 3200); } if (m.pb) ghostFetch("me"); },
  onRound: (m) => { if (mode === "park") { ghosts.t0 = -1; parkDone = null; } buildMap(m.map); if (mode === "park") { ghostFetch("record"); ghostFetch("me"); setTimeout(() => { yaw = world.map.park?.facing ?? yaw; pitch = 0; }, 150); } applyRoster(m.roster); for (const b of beans) { b.kills = 0; b.deaths = 0; b.streak = 0; } Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 }); $("feed").innerHTML = ""; $("hudMap").textContent = world.map.name; state = "play"; $("over").hidden = true; say("NEW ROUND", world.map.name); play("go"); if (document.activeElement === canvas) grabMouse(); },
  onEvents: (list) => { for (const e of list) {
    if (e.k === "shot") { const b = byslot(e.s); if (b) onEvent({ type: "shot", b, gun: e.g, pellets: e.p.map((q) => ({ from: new V(q[0], q[1], q[2]), to: new V(q[3], q[4], q[5]) })) }); }
    else if (e.k === "hit") { const target = byslot(e.s), by = byslot(e.by); if (target) onEvent({ type: "hit", target, by, dmg: e.d, head: Boolean(e.h) }); }
    else if (e.k === "kill") { const target = byslot(e.s), by = byslot(e.by); if (target) onEvent({ type: "kill", target, by, head: Boolean(e.h) }); }
    else if (e.k === "pickup") { const b = byslot(e.s); if (b) onEvent({ type: "pickup", b, kind: e.kind, i: e.i }); }
    else if (e.k === "bomb") onEvent({ type: "bomb", ...e, b: e.s >= 0 ? byslot(e.s) : null });
    else if (e.k === "park") onEvent({ type: "park", ...e, b: e.s >= 0 ? byslot(e.s) : null });
    else if (e.k === "gg") onEvent({ type: "gg", ...e, b: e.s >= 0 ? byslot(e.s) : null });
    else { const b = byslot(e.s); if (b) onEvent({ type: e.k, b }); }
  } },
  onLocal: (list) => { for (const e of list) if (LOCAL_SOUNDS.has(e.type)) onEvent({ ...e, local: true }); },
  onEnd: (m) => endOnline(m),
  onVotes: (n) => { for (const b of document.querySelectorAll("[data-vote]")) { const c = b.querySelector("i"); if (c) c.textContent = n[b.dataset.vote] || 0; } },
  onDrop: (why) => { if (!online) return; online = false; state = "menu"; document.exitPointerLock?.(); showMenu("play"); say(""); feedNote(why === "closed" ? "Connection lost. Press Play to rejoin." : why); },
  onVisible: (b, vis) => { if (b !== me) b.mesh.g.visible = vis; paintTag(b); },
  onError: (text) => feedNote(text)
});
function feedNote(text) { feed(esc(text)); log(text); }
function applyRoster(r) {
  r.names.forEach((n, i) => { beans[i].name = n; beans[i].bot = !r.humans[i]; beans[i].team = r.teams ? r.teams[i] : undefined; beans[i].mesh.tagKey = ""; const look = r.looks ? r.looks[i] : null; if (beans[i] !== me && JSON.stringify(look || null) !== JSON.stringify(beans[i].look || null)) redressBean(beans[i], look); paintTag(beans[i]); });
  for (let i = r.names.length; i < beans.length; i++) { const b = beans[i]; b.team = undefined; b.dead = true; b.respawn = 9e9; b.wantsRespawn = false; b.mesh.g.visible = false; }
  if (r.teams) { if (!bomb) bomb = newBomb(); bomb.atk = r.atk ?? 0; }
  drawSb();
}
function joinMatch(map, slot, roster) {
  online = true; if (mode !== "bomb") { bomb = null; spec = null; roundCard(null); } buildMap(map); roundT = 0; if (mode === "park") { ghosts.t0 = -1; parkDone = null; ghostFetch("record"); ghostFetch("me"); setTimeout(() => { yaw = world.map.park?.facing ?? yaw; pitch = 0; }, 150); }
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
    for (let k = 0; k < g.pellets; k++) { const d = inp.aim.clone(); const sp = g.spread * (scoping ? g.adsSpread ?? 1 : 1) * (me.grounded ? 1 : 1.6); d.x += rnd(-sp, sp); d.y += rnd(-sp, sp); d.z += rnd(-sp, sp); d.normalize(); const r = cast(world, beans, eye, d, me, g.range); pellets.push({ from: eye, to: r.point, bean: r.bean, head: r.head }); }
    onEvent({ type: "shot", b: me, gun: me.gun, pellets, local: true });
    const hitP = pellets.find((p) => p.bean); if (hitP) { localHitAt = performance.now(); hitTimer = 0.14; if (hitP.head) hsTimer = 0.22; play(hitP.head ? "headshot" : "hit"); }   // provisional: the server confirms
  }   // (no empty click: an empty gun reloads itself, and the click on top of the reload sounded like a double, 2026-10-10)
  if (me.dead) me.respawn = Math.max(0, me.respawn - dt);   // (the cooldown is the prediction's to count down, inside net.tick; counting it here as well doubled the fire rate)
  net.tick(inp, t);
}
function endOnline(m) {
  state = "done"; document.exitPointerLock?.(); say(""); $("killcard").hidden = true;
  if (m.mode === "park") {
    const mine = me.i; showMenu("result", `<div class="res"><b class="res-h">${esc(world.map.name)}</b><p class="res-sub">Parkour · the course changes</p>
      ${m.times.length ? `<table class="sb res-t">${m.times.map((x, k) => `<tr class="${x.s === mine ? "me" : ""}"><td>${ord(k + 1)}</td><td>${esc(x.name)}</td><td>${fmtMs(x.ms)}</td></tr>`).join("")}</table>` : `<p class="note">Nobody finished this one.</p>`}
      ${m.you?.guest ? `<p class="note">Guests' times are not kept. Sign in with Twitch to keep yours, earn medals and race your ghost.</p>` : ""}<div class="res-foot"><span class="next" id="nextIn"></span></div></div>`); nextCountdown(m.gap || 10); return;
  }
  const ranks = m.ranks, y = m.you;
  if (!y) { showMenu("result", `<b>${esc(ranks[0]?.name || "")} wins</b><p>You were watching. The next round starts in a few seconds.</p>`); return; }
  play(y.won ? "win" : "lose");
  let xpHtml = "";
  const lines = [[`${y.kills} kills`, y.kills * XP.kill], [`${y.headshots} headshots`, y.headshots * (XP.headshot - XP.kill)], [`${y.streaks} streaks of three`, y.streaks * XP.streak3], ["Finished the round", XP.round]]; if (y.won) lines.push(["Won the round", XP.win]);
  const RT = armory.data?.catalogue?.rates || { kill: 5, headshot: 5, roundWon: 25, match: 60, win: { ffa: 150, bomb: 100 } }, brassNow = y.guest ? 0 : y.kills * RT.kill + y.headshots * RT.headshot + ((m.score && mode === "bomb") ? (m.score[myTeam()] || 0) * RT.roundWon : 0) + RT.match + (y.won ? (mode === "bomb" ? RT.win.bomb : RT.win.ffa) : 0);
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
  showMenu("result", resultHtml({ headline: mode === "bomb" && m.score ? `${y.won ? "Your team wins" : "Your team loses"} ${m.score[myTeam()]}–${m.score[1 - myTeam()]}` : y.won ? "You win!" : `${esc(ranks[0].name)} wins`, sub: `${mode === "bomb" ? "Bomb · 3v3 · " : ""}${esc(world.map.name)}`, meSlot: me.i, ranks,
    line: `You came <b>${ord(y.place)}</b> of ${PLAYERS} · <b>${y.kills}</b> kills, <b>${y.deaths}</b> deaths · ${meStats.shots ? Math.round((meStats.hits / meStats.shots) * 100) : 0}% accuracy · best streak ${y.streak}`,
    xpHtml: xpHtml + (brassNow ? `<p class="note brassline">+${brassNow} Brass for this round${online ? " · +100 more if it was your first of the day" : ""}</p>` : ""), foot: "", top: mode === "bomb" ? `<span class="next" id="nextIn"></span>` : `<div class="vote"><span class="eyebrow inl">Vote the next map</span>${MAP_LIST.map((k) => `<button class="vote-card" data-vote="${k}" style="--img:url(${IMG_BASE}${MAP_IMG[k] || "ffa"}.webp?v=${IMG_V})"><b>${esc(MAPS[k]().name)}</b><i>0</i></button>`).join("")}<span class="next" id="nextIn"></span></div>` }));
  drawPodium(ranks.slice(0, 3).map((r) => r.s)); fillBars(); nextCountdown(m.gap || 18);
}
async function playOnline() {
  $("panel").innerHTML = `<b>Connecting…</b><p>Finding the match.</p>`;
  const okc = await net.connect({ gun: nextGun, name: profile.settings.name || "", mode });
  if (!okc) { feedNote(net.why === "timeout" ? "The match server didn't answer; playing against bots instead." : "Couldn't reach the match server; playing against bots instead."); start(); }
}
const STATE_URL = ["localhost", "127.0.0.1"].includes(location.hostname) ? `http://${location.hostname}:8788/bs/state` : "https://arcade.eastcoin.vip/bs/state";
const stateUrl = () => (mode === "bomb" ? STATE_URL.replace("/bs/state", "/bomb/state") : mode === "park" ? STATE_URL.replace("/bs/state", "/park/state") : mode === "gg" ? STATE_URL.replace("/bs/state", "/gg/state") : STATE_URL);
/* THE SERVER CARDS (2026-10-11, the owner: "a server selector, which is cards that show which players are playing which, with preview
   images of the game modes … X playing now with users' names"). One card per room, a picture of the mode behind it, the live count
   and the names from each room's /state, refreshed every ten seconds while the Play tab is open. Clicking a card picks the mode. */
const IMG_BASE = new URL("img/", import.meta.url).href;
const MODE_BLURB = { ffa: "Everyone against everyone, four minutes, most kills wins. Bots fill the empty slots.", bomb: "Two teams of three. Attackers plant a bomb at a site (hold E) and keep it alive 35 seconds; defenders stop them or defuse (hold E). No respawns in a round, first to 6, sides swap after 5.", park: "A course over the drop, start to finish against the clock. Checkpoints on the way, a fall goes back to the last one, R resets. Medals pay Brass once per course; your best run becomes a ghost to race." };   // beside this script: /arcade/blockshot/img/ on the site, /tools/blockshot/img/ on the rig (the page itself sits at /blockshot)
const SERVERS = [{ key: "ffa", n: "Free-for-all", sub: "12 players · 4 min rounds · three maps", img: "ffa", path: "/bs/state" }, { key: "gg", n: "Gun Game", sub: "every kill, the next gun · knife last", img: "gg", path: "/gg/state" }, { key: "bomb", n: "Bomb · 3v3", sub: "plant or defuse · first to 6", img: "bomb", path: "/bomb/state" }, { key: "park", n: "Parkour", sub: "courses against the clock · ghosts", img: "park", path: "/park/state" }];
let serversT = 0;
async function pollServers() {
  if (!document.querySelector(".srv-live")) return;
  await Promise.all(SERVERS.map(async (sv) => {
    let j = null; try { j = await fetch(STATE_URL.replace("/bs/state", sv.path), { cache: "no-store" }).then((r) => r.json()); } catch {}
    const el = $(`srv-${sv.key}`); if (!el) return;
    if (!j || !j.ok) { el.innerHTML = `<b>offline</b>`; return; }
    const n = j.playing || 0, names = (j.names || []).slice(0, 6), extra = `${sv.key === "ffa" || sv.key === "gg" ? `${MAPS[j.map] ? MAPS[j.map]().name : ""}${sv.key === "gg" && j.top ? ` · leader on gun ${j.top + 1}` : ""}` : sv.key === "bomb" ? (j.round ? `round ${j.round} · ${j.score?.[0] ?? 0}–${j.score?.[1] ?? 0}` : "") : (PARK_MAPS.includes(j.course) ? MAPS[j.course]().name : "")}`;
    el.innerHTML = `<b>${n ? `${n} playing now` : sv.key === "park" ? "nobody on" : "nobody on · bots only"}</b>${extra ? `<i>${esc(extra)}</i>` : ""}${names.length ? `<span>${names.map(esc).join(", ")}${(j.names || []).length > 6 ? ` +${j.names.length - 6}` : ""}</span>` : ""}`;
  }));
}
/* DAILY CHALLENGES (2026-10-11): three a day from the site, progress from the day's reported rounds; a met one is paid on the next read. */
async function challenges() {
  const el = $("chal"); if (!el) return;
  try { const j = await fetch("/api/blockshot/challenges", { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()); if (!j.ok || !$("chal")) return;
    $("chal").innerHTML = `${j.list.map((c) => `<div class="chal-c${c.claimed ? " done" : ""}"><b>${esc(c.text)}</b><small>${c.claimed ? `✓ +${c.brass} Brass` : `${c.have} / ${c.target} · ${c.brass} Brass`}</small><i><s style="width:${Math.round((c.have / c.target) * 100)}%"></s></i></div>`).join("")}${j.me ? "" : `<p class="note chal-note">Sign in with Twitch to earn them.</p>`}`;
    if (j.paid) { hint(`Challenge done · +${j.paid} Brass`); if (armory.data?.me) armory.data.me.brass = j.brass; } } catch {}
}
function serversTick() { clearInterval(serversT); pollServers(); serversT = setInterval(() => { if ($("over").hidden || tab !== "play") { clearInterval(serversT); return; } pollServers(); }, 10000); }
async function parkBoard() { const el = $("parkBoard"); if (!el) return; try { const j = await fetch(`/api/blockshot/park/board?course=${courseKey}`, { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()); if (!j.ok || !$("parkBoard")) return; const mine = j.mine?.[courseKey];
  $("parkBoard").innerHTML = `<b>${esc(MAPS[courseKey]().name)}</b> · best times: ${j.rows.length ? j.rows.slice(0, 5).map((r) => `${esc(r.name)} <b>${fmtMs(r.ms)}</b>${r.medal ? ` <i class="md ${r.medal}"></i>` : ""}`).join(" · ") : "nobody yet"}${mine ? ` · you <b>${fmtMs(mine.ms)}</b> in ${mine.runs} run${mine.runs === 1 ? "" : "s"}${mine.medals.length ? ` · ${mine.medals.join(", ")}` : ""}` : ""}`; } catch {} }
async function whoIsOn() { try { const j = await fetch(stateUrl(), { cache: "no-store" }).then((r) => r.json()); const el = $("whoOn"); if (!el || !j.ok) return; const mapName = MAPS[j.map] ? MAPS[j.map]().name : j.map, left = `${Math.floor(j.left / 60)}:${String(j.left % 60).padStart(2, "0")} left`; el.innerHTML = j.playing ? `<b>${j.playing} playing</b> · ${esc(mapName)} · ${left}<br><small>${esc(j.names.join(", "))}</small>` : `<b>Bots only right now</b> · ${esc(mapName)} · ${left}`; } catch { const el = $("whoOn"); if (el) el.textContent = "The match server isn't answering. Practice still works."; } }

function tick(dt) {
  t += dt; if (state === "play") roundT += dt;
  if (mode === "park" && !online) {
    const inputFor = (b) => (b !== me || state !== "play" ? { x: 0, z: 0 } : { ...playerInput(), fire: false, fireTap: false, scope: false });
    stepWorld(world, beans, dt, t, inputFor, Math.random, events);
    if (state === "play") { if (keys.KeyR && me.park && (me.park.running || me.park.done)) { keys.KeyR = false; parkReset(world, me, events); } parkStep(world, me, dt, events); }
    for (const e of events) onEvent(e); events.length = 0; return;
  }
  if (mode === "bomb" && bomb) {
    const frozen = bomb.phase === "freeze" || state !== "play";
    const inputFor = (b) => { if (frozen) { b.use = false; return { x: 0, z: 0 }; } const i = b.bot ? botInput(world, beans, b, dt, Math.random, bombGoal(world, beans, b, bomb)) : playerInput(); b.use = Boolean(i.use); return i; };
    stepWorld(world, beans, dt, t, inputFor, Math.random, events);
    if (state === "play") { bombStep(world, beans, bomb, dt, t, (b) => Boolean(b.use), (b) => (b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun), Math.random, events); }
    for (const e of events) onEvent(e); events.length = 0;
    if (bomb.done && state === "play") endRound();
    return;
  }
  // the player's spread: tighter scoped, wider in the air (the rules apply the air part)
  const inputFor = (b) => (state !== "play" ? { x: 0, z: 0 } : b.bot ? botInput(world, beans, b, dt) : playerInput());
  stepWorld(world, beans, dt, t, inputFor, Math.random, events, gunPick);
  if (mode === "gg" && state === "play" && beans.some((b) => (b.gg || 0) >= GG.ladder.length)) { for (const e of events) onEvent(e); events.length = 0; endRound(); return; }
  for (const e of events) onEvent(e); events.length = 0;
}
function resetPark() {
  roundT = 0; $("log").innerHTML = ""; $("feed").innerHTML = ""; bomb = null; parkDone = null; ghosts.t0 = -1;
  for (const L of POOL.lines) { L.life = 0; L.o.visible = false; } for (const P of POOL.puffs) { P.life = 0; P.o.visible = false; } for (const F of POOL.floats) { F.life = 0; F.s.visible = false; }
  if (me !== beans[0]) { me.mesh.g.visible = false; me = beans[0]; }
  for (const b of beans) { const keep = { mesh: b.mesh, skill: b.skill, look: b.look }; Object.assign(b, newBean(b.i, b.name, b.bot), keep); b.p.set(0, -50, 0); b.dead = true; b.respawn = 9e9; b.wantsRespawn = false; b.mesh.g.visible = false; b.team = undefined; b.park = null; }
  parkPlace(world, me, null); me.park = newRun(); me.mesh.g.visible = false; drawSb(); yaw = world.map.park.facing; pitch = 0;
}
function resetBomb() {
  roundT = 0; $("log").innerHTML = ""; $("feed").innerHTML = ""; Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 });
  for (const L of POOL.lines) { L.life = 0; L.o.visible = false; } for (const P of POOL.puffs) { P.life = 0; P.o.visible = false; } for (const F of POOL.floats) { F.life = 0; F.s.visible = false; }
  if (me !== beans[0]) { me.mesh.g.visible = false; me = beans[0]; }
  for (const b of beans) { const keep = { mesh: b.mesh, skill: b.skill }; Object.assign(b, newBean(b.i, b.name, b.bot), keep); b.p.set(0, -50, 0); b.dead = true; b.respawn = 9e9; b.wantsRespawn = false; b.mesh.g.visible = false; b.team = undefined; }
  for (let i = 0; i < BOMB.TEAM * 2; i++) beans[i].team = i < BOMB.TEAM ? 0 : 1;
  bomb = newBomb(); spec = null; bombStartRound(world, beans, bomb, (b) => (b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun), Math.random, events);
  for (const e of events) onEvent(e); events.length = 0;
  drawSb();
}
function reset() {
  bomb = null; roundT = 0; $("log").innerHTML = ""; $("feed").innerHTML = ""; Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 });
  for (const L of POOL.lines) { L.life = 0; L.o.visible = false; } for (const P of POOL.puffs) { P.life = 0; P.o.visible = false; } for (const F of POOL.floats) { F.life = 0; F.s.visible = false; }
  for (const b of beans) { const keep = { mesh: b.mesh, skill: b.skill }; Object.assign(b, newBean(b.i, b.name, b.bot), keep); b.p.set(0, -50, 0); b.wantsRespawn = true; }
  if (mode === "gg") for (const b of beans) b.gg = 0;
  for (const b of beans) respawnBean(world, beans, b, gunPick(b), Math.random, events);
  for (const e of events) onEvent(e); events.length = 0;
  drawSb();
}
let overTimer = 0;
function start() {
  if (mode === "park") { clearTimeout(overTimer); buildMap(courseKey); resetPark(); state = "play"; $("over").hidden = true; canvas.focus(); grabMouse(); audioOn(); $("hudMap").textContent = world.map.name; ghostFetch("record"); ghostFetch("me"); return; }
  if (mode === "bomb") { clearTimeout(overTimer); buildMap(BOMB_MAP); resetBomb(); state = "play"; $("over").hidden = true; canvas.focus(); grabMouse(); audioOn(); $("hudMap").textContent = world.map.name; lastPlace = 0; return; }
  clearTimeout(overTimer); buildMap(mapKey); reset(); state = "count"; countdown = 3; countBeep = 3; $("over").hidden = true; canvas.focus(); grabMouse(); audioOn(); $("hudMap").textContent = world.map.name; }
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
const ranked = () => inPlay().slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
function endRound() {
  if (state !== "play") return; state = "done"; document.exitPointerLock?.(); say(""); $("killcard").hidden = true;
  const ranks = ranked(), place = ranks.indexOf(me) + 1, won = mode === "bomb" && bomb ? bomb.score[myTeam()] > bomb.score[1 - myTeam()] : mode === "gg" ? (me.gg || 0) >= GG.ladder.length : place === 1;
  play(won ? "win" : "lose");
  const lines = [[`${me.kills} kills`, me.kills * XP.kill], [`${meStats.headshots} headshots`, meStats.headshots * (XP.headshot - XP.kill)], [`${meStats.streaks} streaks of three`, meStats.streaks * XP.streak3], ["Finished the round", XP.round]];
  if (won) lines.push(["Won the round", XP.win]);
  const total = lines.reduce((n, l) => n + l[1], 0), pctFrom = Math.round((profile.xp / need(profile.level)) * 100), res = award(total);
  recordRound({ map: mapKey, gun: nextGun, kills: me.kills, deaths: me.deaths, headshots: meStats.headshots, shots: meStats.shots, hits: meStats.hits, won, streak: me.bestStreak, seconds: roundT, byGun: meStats.byGun });
  const practiceNote = profile.server ? `<p class="note">Practice: nothing here counts toward your account. Play online for XP and the board.</p>` : "";
  showMenu("result", resultHtml({ headline: mode === "bomb" && bomb ? `${won ? "Your team wins" : "Your team loses"} ${bomb.score[myTeam()]}–${bomb.score[1 - myTeam()]}` : won ? "You win!" : `${esc(ranks[0].name)} wins`, sub: `Practice · ${esc(world.map.name)}`, meSlot: me.i, ranks: ranks.map((b) => ({ s: b.i, name: b.name, k: b.kills, d: b.deaths, human: !b.bot, team: b.team })),
    line: `You came <b>${ord(place)}</b> of ${inPlay().length} · <b>${me.kills}</b> kills, <b>${me.deaths}</b> deaths · ${meStats.shots ? Math.round((meStats.hits / meStats.shots) * 100) : 0}% accuracy · best streak ${me.bestStreak}`,
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
function showMenu(which, html) { tab = which; if (locked) document.exitPointerLock?.(); $("resumeBtn").hidden = state !== "play"; for (const b of document.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === which); if (html !== undefined) $("panel").innerHTML = html; else drawMenu(); $("over").hidden = false; }
function drawMenu() {
  /* THE PLAY TAB (2026-10-11, the owner: "move practice options, and parkour, to their own tab and remove them from start page"): the
     three online rooms as cards, the button, today's challenges, the gun chips, one line of keys. Practice and Parkour are tabs of their own. */
  const keysLine = (park) => `<p class="pm-keys">${park ? `<b>WASD</b> move · <b>Shift</b> slide · <b>Space</b> jump · <b>R</b> back to the checkpoint · <b>Esc</b> menu` : `<b>WASD</b> move · <b>Shift</b> slide · <b>Space</b> jump · <b>R</b> reload · <b>1 2 3</b> guns · <b>4</b> pistol · <b>5</b> knife · <b>Q</b> cycle · <b>Tab</b> scores · <b>Esc</b> menu`}</p><p class="pm-acct">${site.on && !profile.server ? `<a href="/api/picks/auth/twitch/start?returnTo=${encodeURIComponent(FRAMED ? "/cs67" : location.pathname + location.search)}"${FRAMED ? ' target="_top"' : ""}>Sign in with Twitch</a> to keep your level, skins and stats` : profile.server ? `Signed in as <b>${esc(profile.name || profile.login || "you")}</b> · <button class="lnk" data-logout="1">Sign out</button>` : ""}</p>`;
  const ROLE = { ar: "All-rounder", sniper: "One shot, one kill", shotgun: "Close range" };
  const gunChips = () => (mode === "gg" ? `<p class="note" style="margin:0">Gun Game hands you the gun: every kill is the next one on the ladder.</p>` : `<div class="gpick">${PRIMARY_KEYS.map((k, i) => { const g = GUNS[k]; return `<button class="gp${k === nextGun ? " on" : ""}" data-gun="${k}" title="${esc(g.text)}"><b>${i + 1}</b><span>${esc(g.n)}</span><small>${ROLE[k]}</small></button>`; }).join("")}</div>`);
  const srvCard = (sv) => `<button class="srv-card${mode === sv.key ? " on" : ""}" data-mode="${sv.key}" title="${esc(MODE_BLURB[sv.key])}"><span class="srv-img" style="--img:url(${IMG_BASE}${sv.img}.webp?v=${IMG_V})"></span><span class="srv-body"><span class="srv-top"><b>${sv.n}</b><small>${sv.sub}</small></span><span class="srv-live" id="srv-${sv.key}"><b>…</b></span></span></button>`;
  if (tab === "play") {
    if (mode === "park") mode = "ffa";   // the Play tab is the shooters; Parkour has its own tab
    $("panel").innerHTML = `<div class="pm">
    <div class="srv">${SERVERS.filter((sv) => sv.key !== "park").map(srvCard).join("")}</div>
    <div class="pm-go"><button class="go big" data-online="1">Play online</button><p id="whoOn" class="pm-who">Looking…</p></div>
    <section class="pm-sec"><p class="eyebrow">Today's challenges</p><div class="chal" id="chal"></div></section>
    <section class="pm-sec"><p class="eyebrow">Your gun</p>${gunChips()}</section>
    ${keysLine(false)}
    </div>`; whoIsOn(); serversTick(); challenges(); }
  else if (tab === "practice") {   // you and eleven bots; nothing counts
    if (mode === "park") mode = "ffa";
    const MODE_N = { ffa: "Free-for-all", gg: "Gun Game", bomb: "Bomb · 3v3" };
    $("panel").innerHTML = `<div class="pm"><b>Practice</b><p>You against bots on your own machine. Nothing here counts toward your account; it is the place to learn a map or a gun.</p>
    <div class="pm-cols">
      <div class="pm-col"><p class="eyebrow">Mode</p><div class="seg">${Object.entries(MODE_N).map(([k, n]) => `<button class="${mode === k ? "on" : ""}" data-mode="${k}" title="${esc(MODE_BLURB[k])}">${n}</button>`).join("")}</div></div>
      <div class="pm-col"><p class="eyebrow">Map</p>${mode === "bomb" ? `<span class="note" style="margin:0">${esc(MAPS[BOMB_MAP]().name)} · you and two bots against three</span>` : `<div class="seg">${MAP_LIST.map((k) => `<button class="${k === mapKey ? "on" : ""}" data-map="${k}" title="${esc(MAPS[k]().blurb)}">${esc(MAPS[k]().name)}</button>`).join("")}</div>`}</div>
      <div class="pm-col"><p class="eyebrow">Gun</p>${gunChips()}</div>
    </div>
    <div class="pm-top" style="margin-top:18px"><button class="go big" data-go="1">Play vs bots</button></div>
    ${keysLine(false)}</div>`; }
  else if (tab === "parkour") {   // courses against the clock, online with everyone or alone
    const sv = SERVERS.find((x) => x.key === "park");
    $("panel").innerHTML = `<div class="pm">
    <div class="srv one">${srvCard(sv)}</div>
    <div class="pm-top"><button class="go big" data-online="1" data-pmode="park">Play online</button><p id="whoOn" class="pm-who">Looking…</p></div>
    <p class="note">The online room runs one course at a time and changes every eight minutes; your best times, medals and ghost are kept when you are signed in.</p>
    <div class="pm-cols"><div class="pm-col"><p class="eyebrow">Run a course alone</p><div class="pm-row"><div class="seg">${PARK_MAPS.map((k) => { const m = MAPS[k](); return `<button class="${k === courseKey ? "on" : ""}" data-course="${k}" title="${esc(m.blurb)}">${esc(m.name)} <small>${m.park.medals.join("/")}s</small></button>`; }).join("")}</div><button class="go ghost sm" data-go="1" data-pmode="park">Run it</button></div></div></div>
    <div id="parkBoard" class="note">Best times…</div>
    ${keysLine(true)}</div>`; mode = "park"; whoIsOn(); serversTick(); parkBoard(); }
  else if (tab === "locker") {
    const sw = (slot, s) => { const col = slot === "body" || slot === "visor" ? COLORS[s.k] : COLORS[profile.skin.body] || 0xffd84a, on = profile.skin[slot] === s.k, have = owns(slot, s.k);
      return `<button class="sw${on ? " on" : ""}${have ? "" : " lock"}" data-slot="${slot}" data-k="${s.k}" title="${have ? esc(s.n) : `${esc(s.n)} · level ${s.lvl}`}"><i class="p-${slot === "body" || slot === "visor" ? "plain" : s.k}" style="--c:#${col.toString(16).padStart(6, "0")}"></i><span>${have ? esc(s.n) : `🔒 ${s.lvl}`}</span></button>`; };
    $("panel").innerHTML = `<b>Locker</b><p>Level <b>${profile.level}</b> · ${esc(titleFor(profile.level))}. Skins unlock by level; nothing is bought. Bots wear whatever they like.</p>
      <div class="locker"><canvas id="pv" width="220" height="260"></canvas><div>${[["body", "Body colour"], ["pattern", "Body pattern"], ["visor", "Visor"], ["gun", "Gun finish"]].map(([slot, n]) => `<p class="eyebrow">${n}</p><div class="sws">${SKINS[slot].map((s) => sw(slot, s)).join("")}</div>`).join("")}</div></div>`;
    drawPreview();
  } else if (tab === "armory") { drawArmory(); }
  else if (tab === "stats") {
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
      <label class="set"><span>Crosshair colour</span><select data-set="crosshairColor">${Object.keys(XHAIR_COLORS).map((c) => `<option value="${c}"${st.crosshairColor === c ? " selected" : ""}>${c[0].toUpperCase()}${c.slice(1)}</option>`).join("")}</select><output><i class="sw" style="background:${XHAIR_COLORS[st.crosshairColor] || "#fff"}"></i></output></label>
      <label class="set"><span>Crosshair size</span><input type="range" min="0.6" max="1.8" step="0.1" value="${st.crosshairSize}" data-set="crosshairSize"><output>${Number(st.crosshairSize).toFixed(1)}×</output></label>
      <label class="set"><span>Scope is a toggle</span><input type="checkbox" ${st.adsToggle ? "checked" : ""} data-set="adsToggle"><output></output></label>
      <label class="set"><span>Mouse smoothing</span><input type="checkbox" ${st.smooth ? "checked" : ""} data-set="smooth"><output></output></label>
      <p class="note">Saved in this browser. In a match, <b>[</b> and <b>]</b> change the sensitivity without opening this.</p>
      <button class="go" data-resume="1">${state === "play" ? "Apply and return to the game" : "Done"}</button>`;
  }
}
$("over").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return; play("click");
  if (b.dataset.resume) return resumeGame();
  if (b.dataset.roll) return rollCase(b.dataset.roll, b.dataset.zc === "1");
  if (b.dataset.aslot) { armory.slot = b.dataset.aslot; return drawArmory(); }
  if (b.dataset.wear) return wearItem(b.dataset.wear);
  if (b.dataset.tab) return showMenu(b.dataset.tab);
  if (b.dataset.by) { boardBy = b.dataset.by; return drawMenu(); }
  if (b.dataset.range) { boardRange = b.dataset.range; return drawMenu(); }
  if (b.dataset.map) { mapKey = b.dataset.map; return drawMenu(); }
  if (b.dataset.course) { courseKey = b.dataset.course; return drawMenu(); }
  if (b.dataset.pmode) mode = b.dataset.pmode;   // the Parkour tab's buttons set the mode themselves
  if (b.dataset.mode) { mode = b.dataset.mode; return drawMenu(); }
  if (b.dataset.gun) { nextGun = b.dataset.gun; return drawMenu(); }
  if (b.dataset.go) { if (online) { net.close(); online = false; } return start(); }
  if (b.dataset.online) return playOnline();
  if (b.dataset.vote) { net.vote(b.dataset.vote); for (const o of document.querySelectorAll("[data-vote]")) o.classList.toggle("on", o === b); return; }
  if (b.dataset.logout) { b.disabled = true; return fetch("/api/picks/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {}).then(() => { try { (FRAMED ? window.top : window).location.reload(); } catch { location.reload(); } }); }
  if (b.dataset.slot && wear(b.dataset.slot, b.dataset.k)) { redressMe(); drawMenu(); }
});
$("over").addEventListener("input", (e) => {
  const el = e.target.closest("[data-set]"); if (!el) return; const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
  profile.settings[k] = v; save(); const out = el.parentElement.querySelector("output"); if (out) out.textContent = k === "sens" ? `${v.toFixed(1)}×` : k === "fov" ? `${v}°` : k === "volume" ? `${Math.round(v * 100)}%` : "";
  if (k === "volume") setVolume(v); if (k.startsWith("crosshair")) { applyXhair(); if (k === "crosshairColor") out.innerHTML = `<i class="xsw" style="background:${XHAIR_COLORS[v] || "#fff"}"></i>`; if (k === "crosshairSize") out.textContent = `${Number(v).toFixed(1)}×`; }
});
setVolume(profile.settings.volume); applyXhair();
/* THE END OF A ROUND (2026-10-09): one screen for both modes. The top three stand on a podium in their own skins (their meshes cloned
   into a small scene drawn by one spare renderer and copied onto the screen's canvas), your line under it, the XP bar filling from
   where it was to where it is, the table, and "next map in N" online or Play again in practice. */
let podR = null;
function resultHtml({ headline, sub, line, xpHtml, ranks, meSlot, foot, top: topHtml }) {
  const top = ranks.slice(0, 3), pod = [top[1], top[0], top[2]];
  return `<div class="res"><b class="res-h">${headline}</b>${sub ? `<p class="res-sub">${sub}</p>` : ""}${topHtml ? `<div class="res-top">${topHtml}</div>` : ""}
    <div class="podium"><canvas id="podium" width="640" height="220"></canvas><div class="pod-names">${pod.map((r, i) => r ? `<div class="${r.s === meSlot ? "me" : ""}"><small>${ord([2, 1, 3][i])}</small><b>${esc(r.name)}</b><span>${r.k} / ${r.d}</span></div>` : "<div></div>").join("")}</div></div>
    <p class="res-line">${line}</p>${xpHtml}
    <table class="sb res-t">${ranks.map((r, k) => `<tr class="${r.s === meSlot ? "me" : ""}"><td>${ord(k + 1)}</td><td>${esc(r.name)}${r.human === false ? " <small>bot</small>" : ""}${r.team !== undefined && bomb ? ` <small class="tm${r.team === myTeam() ? " us" : ""}">${r.team === myTeam() ? "us" : "them"}</small>` : ""}</td><td>${r.k} / ${r.d}</td></tr>`).join("")}</table>
    <div class="res-foot">${foot}</div></div>`;
}
function drawPodium(slots) {
  const c = $("podium"); if (!c) return;
  if (!podR) podR = new THREE.WebGLRenderer({ antialias: true, alpha: true }); podR.setSize(c.width, c.height, false);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, c.width / c.height, 0.1, 30); cam.position.set(0, 1.9, 7.2); cam.lookAt(0, 0.9, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5)); const l = new THREE.DirectionalLight(0xffffff, 1.2); l.position.set(2, 5, 4); sc.add(l);
  const xs = [-1.9, 0, 1.9], hs = [0.55, 0.95, 0.35], cols = [0xc0c0c0, 0xffd84a, 0xb87333];
  [slots[1], slots[0], slots[2]].forEach((s, i) => {
    if (s === undefined || !beans[s]) return;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.5, hs[i], 1.2), new THREE.MeshLambertMaterial({ color: cols[i] })); block.position.set(xs[i], hs[i] / 2, 0); sc.add(block);
    const g = beans[s].mesh.g.clone(); g.visible = true; g.position.set(xs[i], hs[i], 0); g.rotation.set(0, Math.PI + 0.75 + (i - 1) * 0.2, 0); sc.add(g);   // turned a little toward their gun side, so the gun in the hand shows
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
/* THE ARMORY TAB (2026-10-10). The catalogue, the player's Brass, finishes and loadout come from /api/blockshot/armory; a roll POSTs
   to armory/roll and the reel plays back what the server drew; wearing POSTs to armory/equip and takes effect at once on your own guns
   (others see it from your next match, when the server reads the loadout at login). The preview is a tiny scene of the slot's model
   wearing the chosen finish, rendered by the podium's spare renderer onto the tab's canvas. */
const armory = { data: null, slot: "ar", rolling: false, result: null, loading: false };
const RAR = { common: ["Common", "#9aa3b5"], uncommon: ["Uncommon", "#5ac8fa"], rare: ["Rare", "#b06cff"], legend: ["Legendary", "#ff5a8a"], knife: ["Legendary", "#ffd84a"] };
const rarityOfId = (id) => { const [slot, fin] = id.split(":"); const r = armory.data?.catalogue.finishes[fin]?.r || "common"; return slot === "knife" ? (r === "legend" ? "knife" : r === "common" ? "uncommon" : "rare") : r; };
const itemName = (id) => { const c = armory.data?.catalogue; const [slot, fin, kind] = id.split(":"); return `${slot === "knife" ? c?.knives[kind] || "Knife" : c?.slotNames[slot] || slot} · ${c?.finishes[fin]?.n || fin}`; };
async function loadArmory() {
  try { const j = await fetch("/api/blockshot/armory", { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()); if (j.ok) { armory.data = j; myLook = lookFrom(j.me?.loadout); } } catch {}
  return armory.data;
}
const lookFrom = (lo) => { if (!lo) return null; const look = {}; for (const [s, id] of Object.entries(lo)) if (id && !id.includes(":factory")) look[s] = id; return Object.keys(look).length ? look : null; };
function drawArmory() {
  const d = armory.data, c = d?.catalogue, me0 = d?.me;
  if (!d) { $("panel").innerHTML = `<b>Armory</b><p class="note">Loading…</p>`; if (!armory.loading) { armory.loading = true; loadArmory().then(() => { armory.loading = false; if (tab === "armory") drawArmory(); }); } return; }
  const fmt = (n) => Number(n || 0).toLocaleString("en-US"), slot = armory.slot;
  const owned = new Set(me0?.items || []), worn = me0?.loadout || {}, pool = (k) => c.cases[k].pool;
  const list = slot === "knife" ? pool("knife") : slot === "bean" ? [`bean:factory`, ...pool("bean")] : [`${slot}:factory`, ...pool("weapon").filter((id) => id.startsWith(slot + ":"))];
  const isFactory = (id) => id.includes(":factory"), wornId = worn[slot] || (slot === "knife" ? "knife:factory:combat" : `${slot}:factory`);
  const res = armory.result;
  $("panel").innerHTML = `<div class="ay">
    <div class="ay-top"><div><b>Armory</b><p class="note ay-note">${me0 ? `<b>${c.currency}</b> comes from playing: ${c.rates.kill} a kill, +${c.rates.headshot} a headshot, ${c.rates.roundWon} a bomb round won, ${c.rates.match} a match played out, ${c.rates.firstOfDay} for the first of the day, ${c.rates.win.ffa} for topping the board. Finishes change looks and nothing else; a duplicate turns into ${c.currency}.` : `Sign in with Twitch to earn <b>${c.currency}</b> by playing and roll for finishes.`}</p></div>
      <div class="ay-wallet"><b>${fmt(me0?.brass)}</b><small>${c.currency}</small></div></div>
    <div class="ay-cases">${Object.entries(c.cases).map(([k, cs]) => `<div class="ay-case"><h3>${esc(cs.n)}</h3><div class="ay-odds">${cs.odds.map(([r, p]) => `<span style="color:${RAR[r][1]}">${RAR[r][0]} ${(p * 100).toFixed(p < 0.01 ? 1 : 0)}%</span>`).join("")}</div><p class="note">${esc(cs.blurb)}</p><div class="ay-row"><button class="go sm" data-roll="${k}" ${!me0 || armory.rolling ? "disabled" : ""}>Roll · ${cs.price} ${c.currency}</button>${cs.zc ? `<button class="go ghost sm" data-roll="${k}" data-zc="1" ${!me0 || armory.rolling ? "disabled" : ""}>Roll · ${cs.zc} ZC</button>` : ""}</div></div>`).join("")}</div>
    <div class="ay-reel"><div class="ay-strip" id="ayStrip"></div></div>
    ${res ? `<div class="ay-result" style="--c:${RAR[res.rarity][1]};--sw:${finCss(finOf(res.item))}"><div class="sw"></div><div><b>${esc(res.name)}</b><small>${RAR[res.rarity][0]}${res.dup ? ` · already owned, turned into ${res.refund} ${c.currency}` : ""}</small></div>${res.dup ? "" : `<button class="go ghost sm" data-wear="${res.item}">Wear it</button>`}</div>` : ""}
    <p class="eyebrow">Loadout</p>
    <div class="ay-load"><div class="ay-view"><canvas id="apv" width="520" height="300"></canvas><div class="ay-tabs">${c.slots.map((s) => `<button class="${s === slot ? "on" : ""}" data-aslot="${s}">${esc(c.slotNames[s].split(" ")[0])}</button>`).join("")}</div></div>
      <div class="ay-skins">${list.map((id) => { const own = isFactory(id) || owned.has(id), on = id === wornId, [, fin, kind] = id.split(":"); return `<button class="ay-skin${own ? "" : " locked"}${on ? " on" : ""}" ${own && me0 ? `data-wear="${id}"` : "disabled"} style="--c:${RAR[rarityOfId(id)][1]};--sw:${finCss(fin)}">${on ? '<span class="tag">worn</span>' : ""}<div class="sw"></div><b>${slot === "knife" ? esc(c.knives[kind]) + " · " : ""}${esc(c.finishes[fin].n)}</b><small>${RAR[rarityOfId(id)][0]}${own ? "" : " · from a case"}</small></button>`; }).join("")}</div></div>
  </div>`;
  if (armory.rolling && armory.stripHtml) { $("ayStrip").innerHTML = armory.stripHtml; $("ayStrip").style.transform = armory.stripTransform || ""; }
  buildArmoryPreview();
}
async function rollCase(caseKey, zc) {
  if (armory.rolling || !armory.data?.me) return; armory.rolling = true; armory.result = null; drawArmory();
  let j; try { j = await fetch("/api/blockshot/armory/roll", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ case: caseKey, zc }) }).then((r) => r.json()); } catch { j = { ok: false, message: "No answer." }; }
  if (!j.ok) { armory.rolling = false; hint(j.message || j.code || "Could not roll"); if (j.brass !== undefined && armory.data.me) armory.data.me.brass = j.brass; drawArmory(); return; }
  // the reel: 48 cards, the server's item at the 41st, the strip slides there and eases to a stop
  const pool = armory.data.catalogue.cases[caseKey].pool, cards = []; for (let i = 0; i < 48; i++) cards.push(i === 40 ? j.item : pool[Math.floor(Math.random() * pool.length)]);
  const strip = $("ayStrip"); strip.innerHTML = armory.stripHtml = cards.map((id) => `<div class="ay-card" style="--c:${RAR[rarityOfId(id)][1]};--sw:${finCss(finOf(id))}"><div class="sw"></div><b>${esc(itemName(id))}</b><small>${RAR[rarityOfId(id)][0]}</small></div>`).join("");
  const reelW = strip.parentElement.clientWidth, target = 40 * 158 + 75 - reelW / 2 + (Math.random() * 100 - 50);
  strip.style.transition = "none"; strip.style.transform = "translateX(0px)"; void strip.offsetWidth; strip.style.transition = "transform 4.2s cubic-bezier(.12,.8,.18,1)"; strip.style.transform = armory.stripTransform = `translateX(${-target}px)`;
  play("click"); await new Promise((r) => setTimeout(r, 4400));
  const me0 = armory.data.me; me0.brass = j.brass; if (!j.dup && !me0.items.includes(j.item)) me0.items.push(j.item);
  armory.result = j; armory.rolling = false; armory.stripHtml = ""; play(j.rarity === "legend" || j.rarity === "knife" ? "levelup" : j.rarity === "rare" ? "top" : "kill"); drawArmory();
}
async function wearItem(id) {
  const slot = id.split(":")[0]; let j; try { j = await fetch("/api/blockshot/armory/equip", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot, item: id.includes(":factory") ? "factory" : id }) }).then((r) => r.json()); } catch { j = { ok: false }; }
  if (!j.ok) { hint(j.message || "Could not wear that"); return; }
  armory.data.me = j.me; myLook = lookFrom(j.me.loadout); armory.slot = slot; redressMe(); play("swap"); drawArmory();
}
let apvScene = null, apvModel = null, apvCam = null;
function buildArmoryPreview() {
  const d = armory.data; if (!d) return; const slot = armory.slot, worn = d.me?.loadout || {}, id = worn[slot] || (slot === "knife" ? "knife:factory:combat" : `${slot}:factory`), fin = finOf(id);
  if (!apvScene) { apvScene = new THREE.Scene(); apvCam = new THREE.PerspectiveCamera(32, 520 / 300, 0.05, 50); apvCam.position.set(0, 0.35, 2.2); apvCam.lookAt(0, 0, 0); apvScene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.3)); const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 3); apvScene.add(key); const rim = new THREE.DirectionalLight(0x6ad0ff, 0.8); rim.position.set(-3, 1, -2); apvScene.add(rim); }
  if (apvModel) apvScene.remove(apvModel);
  if (slot === "bean") { const g = beanMesh(profile.skin, apvScene, fin === "factory" ? null : { bean: id }); g.position.y = -0.75; g.scale.setScalar(1.05); apvModel = g; }
  else { const src = gunModels[slot]; if (!src) return; const g = src.clone(true); g.visible = true; g.position.set(0, 0, 0); g.rotation.set(0, Math.PI / 2 + 0.5, slot === "knife" ? -0.2 : 0); g.scale.setScalar(slot === "pistol" ? 2.2 : slot === "knife" ? 1.6 : 1.5);
    g.traverse((o) => { if (!o.isMesh) return; if (slot === "knife") { if ((src.userData.blade || []).some((b) => b.geometry === o.geometry)) o.material = fin === "factory" ? steelMat : finMat(fin, true); } else if ((src.userData.bodies || []).some((b) => b.geometry === o.geometry)) o.material = fin === "factory" ? skinMat(profile.skin.gun, "black") : finMat(fin); });
    apvModel = g; apvScene.add(g); }
}
function drawArmoryPreview() {
  const c = $("apv"); if (!c || !apvModel) return; if (!podR) { podR = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  podR.setSize(c.width, c.height, false); apvModel.rotation.y += 0.008; podR.render(apvScene, apvCam); c.getContext("2d").clearRect(0, 0, c.width, c.height); c.getContext("2d").drawImage(podR.domElement, 0, 0);
}
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
function drawBoard() { $("board").innerHTML = `<b>${mode === "bomb" ? "Bomb · 3v3" : "Free-for-all"} · ${esc(world?.map.name || "")} · ${fmtT(roundLeft())} left</b><table><tr><td></td><td></td><td>K</td><td>D</td></tr>${ranked().map((b, k) => `<tr class="${b === me ? "me" : ""}"><td>${k + 1}</td><td>${esc(b.name)}${b.bot ? "<small>bot</small>" : ""}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join("")}</table>`; }
function draw(dt) {
  for (const b of beans) { if (b === me || !b.mesh.g.visible) continue; paintTag(b); const g = b.mesh.g;
    if (b.mesh.gunKey !== b.gun && g.userData.rig) { b.mesh.gunKey = b.gun; dressRig(g, b.gun, b.look); }
    if (mode === "bomb") { const eye = camera.position, d = new V(b.p.x - eye.x, b.p.y + 0.6 - eye.y, b.p.z - eye.z), dist = d.len() || 1; d.scale(1 / dist); const r = cast(world, [], new V(eye.x, eye.y, eye.z), d, me, dist + 1); b.mesh.tag.visible = b.team === me.team || r.t >= dist - 0.8; }   // a wall between us hides the name (teammates always show)
    else b.mesh.tag.visible = true; g.position.set(b.p.x, b.p.y - R, b.p.z); let dy = b.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3; g.scale.y += ((b.slide ? 0.55 : 1) - g.scale.y) * 0.3; }
  if (mode === "bomb" && bomb && me.dead && state === "play") {
    if (!spec || spec.dead || spec.team !== me.team) spec = inPlay().find((b) => b !== me && b.team === me.team && !b.dead) || null;
    if (spec) { const back = 3.2, fx = -Math.sin(spec.facing), fz = -Math.cos(spec.facing); camera.position.lerp(new V3(spec.p.x - fx * back, spec.p.y + 2.2, spec.p.z - fz * back), 0.2); camera.lookAt(spec.p.x + fx * 6, spec.p.y + 0.8, spec.p.z + fz * 6); viewGun.visible = false; }
    else { const a = t * 0.1; camera.position.set(Math.sin(a) * 40, 22, Math.cos(a) * 40); camera.lookAt(0, 2, 0); viewGun.visible = false; }
  }
  else if (me.dead && me.lastBy && !me.lastBy.dead) { const k = me.lastBy; camera.position.lerp(new V3(k.p.x + 3, k.p.y + 3, k.p.z + 3), 0.1); camera.lookAt(k.p.x, k.p.y + 0.5, k.p.z); viewGun.visible = false; }
  else if (me.dead || state === "menu") { const a = t * 0.1; camera.position.set(Math.sin(a) * 40, 22, Math.cos(a) * 40); camera.lookAt(0, 2, 0); viewGun.visible = false; }
  else {
    // feel (2026-10-09): lean into a strafe, lean more in a slide, nothing in the air; a landing dips the camera by how hard it was
    { const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), want = me.dead ? 0 : (me.grounded ? -strafe * 0.022 : 0) + (me.slide ? -0.03 : 0); roll += (want - roll) * 0.15;
      if (me.grounded && !wasGrounded && vyPrev < -6) { landDip = clamp(-vyPrev / 70, 0.05, 0.2); play("land", clamp(-vyPrev / 24, 0.3, 1)); } wasGrounded = me.grounded; vyPrev = me.v.y; landDip *= 0.82; }
    camera.position.set(me.p.x, me.p.y + EYE * (me.slide ? 0.6 : 1) - landDip, me.p.z); camera.rotation.set(pitch, yaw, roll);
    // aiming down the sights: the gun slides to the middle of the view (the sniper's scope hides it); the kick settles on z
    const ads = scoping && !me.dead, g = GUNS[me.gun]; viewGun.visible = !(ads && g.scope) && mode !== "park";
    const tx = ads ? 0 : 0.2, ty = ads ? -0.095 : -0.17, tz = ads ? -0.3 : -0.42, kick = Math.max(0, viewGun.position.z - tz);
    viewGun.position.x += (tx - viewGun.position.x) * 0.25; viewGun.position.z = tz + kick * 0.75;
    const bob = Math.hypot(me.v.x, me.v.z) > 1 && me.grounded && !me.slide && !ads ? Math.sin(t * 12) * 0.012 : 0;
    const rl = me.reloading ? 1 - me.reloading / g.reload : 0, sw = (performance.now() / 1000 - swapAt) / SWAP_S;   // reloading: down and rolled over, back up as it finishes; a swap is the same dip, quicker
    const dip = Math.max(rl > 0 ? Math.sin(rl * Math.PI) : 0, sw >= 0 && sw < 1 ? Math.sin(sw * Math.PI) * 0.8 : 0);
    { const k = (performance.now() / 1000 - swingAt) / 0.28, sg = k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0; viewGun.rotation.y = -sg * 1.1; }   // the knife's swing: across and back
    viewGun.position.y += (ty + bob - dip * 0.12 - viewGun.position.y) * 0.25; viewGun.rotation.z += (-dip * 0.6 - viewGun.rotation.z) * 0.25; viewGun.rotation.x += (dip * 0.25 - viewGun.rotation.x) * 0.25;
  }
  const fov = scoping && !me.dead ? profile.settings.fov / (GUNS[me.gun].zoom || 1) : profile.settings.fov + clamp((Math.hypot(me.v.x, me.v.z) - RUN) / 8, 0, 1) * 14; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.3; camera.updateProjectionMatrix(); }
  $("scope").classList.toggle("on", Boolean(scoping && GUNS[me.gun].scope && !me.dead && state === "play"));   // (Boolean: toggle with an undefined second argument FLIPS the class, and the rifle has no scope field)
  if (mode === "park") drawGhosts();
  if (bombMesh) { const p = bomb && (bomb.planted || bomb.drop); bombMesh.visible = Boolean(p); if (p) { bombMesh.position.set(p.x, (p.y ?? world.groundAt(p.x, p.z)) + 0.18, p.z); const rate = bomb.planted ? (bomb.planted.t < 10 ? 8 : bomb.planted.t < 20 ? 4 : 2) : 1; const on = Math.sin(performance.now() / 1000 * rate * Math.PI) > 0; bombMesh.children[1].material.emissive.setHex(on ? 0xff2020 : 0x300000); if (bomb.planted && on !== bombMesh.userData.on) { bombMesh.userData.on = on; if (on && !me.dead && bombMesh.position.distanceTo(camera.position) < 30) play("tick"); } } }
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
  { const rb = $("reloadBar"), on = me.reloading > 0 && !me.dead && state === "play" && !(bomb && bomb.act && bomb.act.s === me.i); if (rb.hidden === on) rb.hidden = !on; if (on) $("reloadFill").style.width = `${((1 - me.reloading / GUNS[me.gun].reload) * 100).toFixed(1)}%`; }
  // the crosshair opens with speed, in the air and when hit; it closes scoped
  { const sp = Math.hypot(me.v.x, me.v.z), g = GUNS[me.gun], ads = scoping && !me.dead, gap = (ads ? 2 : 5 + Math.min(14, sp * 0.9) + (me.grounded ? 0 : 10)) + (hitTimer > 0 ? 2 : 0); $("xhair").style.setProperty("--gap", `${gap.toFixed(1)}px`); $("xhair").style.opacity = ads && g.scope ? "0" : "1"; }
  { const el = $("dmgDir"); el.classList.toggle("on", dmgT > 0); if (dmgT > 0) { let a = dmgAngle - yaw; el.firstElementChild.style.transform = `rotate(${(-a * 180) / Math.PI}deg)`; } }
  $("hpBox").classList.toggle("low", me.hp <= 30 && !me.dead); document.body.classList.toggle("lowhp", me.hp <= 30 && !me.dead && state === "play");
  { const on = Math.ceil(clamp(me.hp / MAX_HP, 0, 1) * 10); hpSeg.childNodes.forEach((i, k) => i.classList.toggle("on", k < on)); }
  { const g = GUNS[me.gun]; $("ammoBox").classList.toggle("empty", me.ammo === 0 && !me.reloading); $("hudReload").firstElementChild.style.width = me.reloading ? `${(1 - me.reloading / g.reload) * 100}%` : "0"; }
  if (me.dead && state === "play") { if (mode === "bomb") { $("deathBar").style.width = "0%"; $("deathSub").textContent = "no respawn this round · watching your team"; } else { $("deathBar").style.width = `${clamp(me.respawn / RESPAWN_S, 0, 1) * 100}%`; $("deathSub").textContent = `respawning in ${Math.ceil(me.respawn)}`; } }
  if (mode === "gg") { const w = `<span class="on">gun ${Math.min((me.gg || 0) + 1, GG.ladder.length)} / ${GG.ladder.length} · ${GUNS[me.gun]?.n || ""}</span>${GG.ladder.map((k, i) => `<span class="${i < (me.gg || 0) ? "done" : i === (me.gg || 0) ? "on" : ""}">${i + 1}</span>`).join("")}`; if (hud.weps !== w) { hud.weps = w; $("hudWeps").innerHTML = w; } }
  else { const held = Boolean(GUNS[me.gun]?.secondary), weps = PRIMARY_KEYS.map((k, i) => `<span class="${k === me.gun ? "on" : ""}${k === nextGun && k !== me.gun && !held ? " next" : ""}">${i + 1} ${GUNS[k].n.split(" ")[0]}${k === nextGun && k !== me.gun && !held ? " · next" : ""}</span>`).join("") + `<span class="${me.gun === "pistol" ? "on" : ""}">4 Pistol</span><span class="${me.gun === "knife" ? "on" : ""}">5 Knife</span>`; if (hud.weps !== weps) { hud.weps = weps; $("hudWeps").innerHTML = weps; } }
  fitViewGun(me.gun);
  { const gn = GUNS[me.gun].n; if ($("hudGun").textContent !== gn) $("hudGun").textContent = gn; }
  $("xhair").classList.toggle("hitm", hitTimer > 0 && killTimer <= 0); $("xhair").classList.toggle("kill", killTimer > 0); $("xhair").classList.toggle("hs", hsTimer > 0);
  if (mode === "park" && state === "play") {
    const r = me.park || newRun(), P = world?.map.park; $("hudT").textContent = fmtMs(Math.round(r.t * 1000)); $("hudT").classList.toggle("fuse", false);
    $("hudPlace").textContent = P ? `${P.cps[0]?.k ? "level" : "checkpoint"} ${Math.max(0, r.cp + 1)} / ${P.cps.length + (P.cps[0]?.k ? 1 : 0)}${r.best ? ` · best ${fmtMs(r.best)}` : ""}` : "";
    const bl = $("bombLine"), line = r.done ? `Finished in ${fmtMs(Math.round(r.t * 1000))} · R to run again` : !r.running ? "Step off the start to begin · R resets · a fall goes back to the checkpoint" : ""; if (bl.textContent !== line) bl.textContent = line; bl.hidden = !line;
    $("scoreUs").hidden = true; $("scoreThem").hidden = true; for (const id of ["ammoBox", "hudWeps", "hpBox"]) $(id).style.display = "none";
  } else for (const id of ["ammoBox", "hudWeps", "hpBox"]) $(id).style.display = "";
  if (mode === "bomb" && bomb && state === "play") {
    const atk = isAtk(me, bomb), fuse = bomb.planted ? bomb.planted.t : null;
    $("hudT").textContent = bomb.phase === "freeze" ? String(Math.ceil(bomb.t)) : fmtT(Math.max(0, fuse ?? bomb.t));
    $("hudT").classList.toggle("fuse", Boolean(fuse));
    { const us = inPlay().filter((b) => b.team === myTeam() && !b.dead).length, them = inPlay().filter((b) => b.team !== undefined && b.team !== myTeam() && !b.dead).length;
      const su = $("scoreUs"), st = $("scoreThem"); su.hidden = st.hidden = false;
      const hu = `<b>${bomb.score[myTeam()]}</b><small>you · ${us} up</small>`, ht = `<b>${bomb.score[1 - myTeam()]}</b><small>them · ${them} up</small>`; if (su.innerHTML !== hu) su.innerHTML = hu; if (st.innerHTML !== ht) st.innerHTML = ht;
      if (bomb.phase === "live") {   // last-alive callouts (2026-10-10): you are the last of your side, or they are down to one
        if (lastAlive.us > 1 && us === 1 && !me.dead && them >= 1) { say("LAST ONE STANDING", `1 v ${them}`); play("last"); clearTimeout(say.t); say.t = setTimeout(() => say(""), 2600); }
        else if (lastAlive.them > 1 && them === 1 && us >= 1) { say("ONE LEFT", `${us} v 1`); play("top"); clearTimeout(say.t); say.t = setTimeout(() => say(""), 1800); }
      }
      lastAlive.us = us; lastAlive.them = them;
      if (bomb.phase === "freeze") { const rc = $("rcCount"); if (rc) rc.textContent = `pick your gun · 1 2 3 · ${Math.ceil(bomb.t)}`; if ($("roundCard").hidden) roundCard("start"); }
      else if (bomb.phase === "live" && !$("roundCard").hidden) roundCard(null); }
    const carrierName = bomb.carrier >= 0 ? (beans[bomb.carrier] === me ? "you" : beans[bomb.carrier].name) : null, site = bomb.planted ? world.map.bomb.sites[bomb.planted.site].k : "";
    let line = bomb.phase === "freeze" ? `Round ${bomb.round} · ${atk ? "you attack" : "you defend"} · pick your gun: 1 2 3` : bomb.phase === "post" ? (bomb.lastWin ? `${teamName(bomb.lastWin.team)} win the round` : "") :
      bomb.planted ? (bomb.act?.kind === "defuse" ? (atk ? `${beans[bomb.act.s]?.name || "someone"} is DEFUSING at ${site} · stop them` : `${beans[bomb.act.s] === me ? "You are" : (beans[bomb.act.s]?.name || "someone") + " is"} defusing at ${site}`) : atk ? `Bomb planted at ${site} · keep them off it` : `Bomb planted at ${site} · hold E at it to defuse`) : atk ? (bomb.carrier === me.i ? "You have the bomb · hold E at A or B" : bomb.drop ? "The bomb is on the ground · pick it up" : `${carrierName || "nobody"} has the bomb`) : "Hold the sites";
    if (me.dead && spec) line = `Watching ${spec.name} · click for the next`;
    const bl = $("bombLine"); if (bl.textContent !== line) bl.textContent = line; bl.hidden = !line;
    const act = bomb.act && bomb.act.s === me.i ? bomb.act : null, rb = $("reloadBar");
    if (act) { rb.hidden = false; rb.firstElementChild.textContent = act.kind === "plant" ? "Planting" : "Defusing"; $("reloadFill").style.width = `${((act.p ?? act.t / (act.kind === "plant" ? BOMB.PLANT_S : BOMB.DEFUSE_S)) * 100).toFixed(1)}%`; }
    else if (rb.firstElementChild.textContent !== "Reloading") { rb.firstElementChild.textContent = "Reloading"; rb.hidden = true; }
  } else if (mode !== "park") { $("scoreUs").hidden = true; $("scoreThem").hidden = true; $("roundCard").hidden = true; $("bombLine").hidden = true; $("hudT").classList.remove("fuse"); $("hudT").textContent = state === "count" ? String(Math.ceil(countdown)) : fmtT(roundLeft()); }
  { const spike = perf.lastAt && performance.now() - perf.lastAt < 3000 ? ` · spike ${perf.lastMs}ms` : "", snap = online && net.worstGap > 0.15 ? ` · snap ${Math.round(net.worstGap * 1000)}ms` : "";
    $("hudPing").textContent = online ? `${net.ping} ms${net.lag() > 12 ? ` · lag ${net.lag()}` : ""}${snap}${spike}` : spike.replace(" · ", ""); }
  const place = ranked().indexOf(me) + 1; if (mode !== "park") $("hudPlace").textContent = state !== "play" ? "" : mode === "bomb" && bomb ? `Round ${bomb.round} · ${isAtk(me, bomb) ? "attacking" : "defending"}` : `${ord(place)} of ${inPlay().length}`;
  if (state === "play" && mode !== "bomb") { if (place === 1 && lastPlace > 1 && me.kills > 0) { say("TOP OF THE BOARD"); play("top"); } lastPlace = place; } else lastPlace = 0;
  $("hudK").textContent = me.kills; $("hudKD").textContent = `K · ${me.deaths} D${me.streak >= 2 ? ` · ×${me.streak}` : ""}`; $("hudName").textContent = me.name;
  $("hudHpN").textContent = Math.round(Math.max(0, me.hp));
  const g = GUNS[me.gun]; $("hudAmmo").textContent = g.melee ? "—" : me.reloading ? "··" : me.ammo; $("hudMag").textContent = g.melee ? "" : `/ ${g.mag}`;
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
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now; if (locked && profile.settings.smooth) smoothMouse();
  if (raw > 0.06 && raw < 5 && state !== "menu") { perf.lastAt = now; perf.lastMs = Math.round(raw * 1000); perf.spikes.push({ at: Math.round(now / 100) / 10, ms: perf.lastMs, lag: online ? net.lag() : 0, snapGap: online ? Math.round(net.gapNow() * 1000) : 0, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }); if (perf.spikes.length > 40) perf.spikes.shift(); }
  resize(); advance(dt); draw(dt); hud(dt);
  fpsN++; fpsT += dt; if (fpsT >= 1) { $("loadStat").textContent = `${fpsN} fps`; fpsN = 0; fpsT = 0; }
  if (tab === "armory" && !$("over").hidden) drawArmoryPreview();
  if (!driven) requestAnimationFrame(frame);
}
buildMap(mapKey); reset(); state = "menu"; $("hudGun").textContent = GUNS.ar.n; $("hudMag").textContent = `/ ${GUNS.ar.mag}`; drawProfile(); showMenu("play");
loadArmory().then(() => { if (myLook) redressMe(); });
syncFromServer().then((me2) => { if (me2) { redressMe(); drawProfile(); } if (!$("over").hidden) drawMenu(); });   // redrawn for a guest too: that is when the sign-in row appears
window.__bs = { perf, onEvent, killCard, endOnline, look(y, p) { yaw = y; pitch = p; }, hideHud(on) { for (const sel of [".hud-top", ".hud-bot", "#bombLine", "#roundCard", "#lockHint", "#xhair", ".weps", "#hint", "#killcard", "#reloadBar", ".streak", ".sub", "#over"]) document.querySelectorAll(sel).forEach((e) => (e.style.visibility = on ? "hidden" : "")); viewGun.visible = !on; }, buildArmoryPreview, drawArmoryPreview, get armory() { return armory; }, get apv() { return { apvModel, apvScene, podR }; }, get bomb() { return bomb; }, get mode() { return mode; }, drive(on) { clearInterval(perf.drive); perf.drive = on ? setInterval(() => frame(performance.now(), true), 1000 / 60) : 0; }, beans, get me() { return me; }, get world() { return world; }, get state() { return state; }, get roundT() { return roundT; }, get online() { return online; }, net, playOnline, start, GUNS, profile, setMap: (k) => { mapKey = k; }, aim(y, p) { yaw = y; pitch = p; }, set fire(v) { mouseFire = v; }, set keys(k) { Object.assign(keys, k); }, endRound, showMenu,
  sim(seconds) { for (let k = 0; k < seconds * 60; k++) advance(1 / 60); draw(1 / 60); hud(1 / 60); } };
requestAnimationFrame(frame);

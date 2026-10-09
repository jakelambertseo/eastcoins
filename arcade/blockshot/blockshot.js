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
import { World, newBean, stepWorld, botInput, respawnBean, V, PHYS, RULES, GUNS, GUN_KEYS, MAPS, MAP_LIST, BOT_NAMES } from "/v3/assets/js/blockshot-rules.js?v=1";
import { material, skin as skinTex } from "./tex.js?v=1";
import { play, setVolume, ensure as audioOn } from "./audio.js?v=1";
import { profile, award, need, SKINS, COLORS, owns, wear, kd, accuracy, recordRound, titleFor, XP, save } from "./profile.js?v=1";

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
if (new URLSearchParams(location.search).has("embed")) document.documentElement.classList.add("embed");
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
  for (const m of mapMeshes) { scene.remove(m); m.geometry.dispose(); } mapMeshes = [];
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
}

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
for (let i = 0; i < PLAYERS; i++) { const b = newBean(i, i ? BOT_NAMES[i - 1] : "You", i > 0); b.skill = rnd(0.3, 0.85); b.mesh = makeBean(i ? randomSkin() : profile.skin); beans.push(b); }
const me = beans[0]; me.mesh.g.visible = false;   // first person: you don't see your own bean
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
canvas.addEventListener("mousedown", (e) => { if (e.button === 0) { mouseFire = true; if (!locked) { dragLook = true; lastX = e.clientX; lastY = e.clientY; } } if (e.button === 2) scoping = Boolean(GUNS[me.gun].scope); });
addEventListener("mouseup", (e) => { if (e.button === 0) { mouseFire = false; dragLook = false; } if (e.button === 2) scoping = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const lookDir = () => new V(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
function playerInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (keys.ArrowLeft) yaw += 0.04; if (keys.ArrowRight) yaw -= 0.04;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = fx * f + rx * s, z = fz * f + rz * s, l = Math.hypot(x, z), fire = mouseFire || keys.KeyJ;
  const inp = { x: l > 1 ? x / l : x, z: l > 1 ? z / l : z, jump: keys.Space, fire, fireTap: fire && !fireLatch, slide: keys.ShiftLeft || keys.ShiftRight, reload: keys.KeyR, aim: lookDir() };
  fireLatch = fire; return inp;
}

/* ------------------------------------------------------------------ what the events become: tracers, sounds, numbers, the feed */
const fx = [], floats = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true });
function tracer(from, to, mine) {
  const g = new THREE.BufferGeometry().setFromPoints([new V3(from.x, from.y, from.z), new V3(to.x, to.y, to.z)]); const line = new THREE.Line(g, tracerMat.clone()); line.material.color.set(mine ? 0xffe27a : 0xff9a6a); scene.add(line); fx.push({ o: line, life: 0.08, max: 0.08 });
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true })); puff.position.set(to.x, to.y, to.z); scene.add(puff); fx.push({ o: puff, life: 0.2, max: 0.2, grow: 2.5 });
}
function floatText(p, text, col) { if (floats.length > 30) return; const c = document.createElement("canvas"); c.width = 128; c.height = 64; const x = c.getContext("2d"); x.textAlign = "center"; x.font = "800 36px Lora, serif"; x.lineWidth = 6; x.strokeStyle = "#000"; x.strokeText(text, 64, 44); x.fillStyle = col; x.fillText(text, 64, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(1.1, 0.55, 1); s.position.set(p.x + rnd(-0.3, 0.3), p.y + 1.3, p.z); scene.add(s); floats.push({ s, life: 0.7 }); }
let hitTimer = 0, killTimer = 0;
function flashDamage() { const el = $("hurt"); el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
const meStats = { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 };
const gunStat = (g) => (meStats.byGun[g] ||= { kills: 0, shots: 0, hits: 0 });
function onEvent(e) {
  const mine = e.b === me || e.by === me;
  switch (e.type) {
    case "shot": {
      const muzzle = e.b === me ? camera.localToWorld(new V3(0.2, -0.15, -0.75)) : e.pellets[0].from.clone().addScaled(e.b.aim, 0.6);
      for (const p of e.pellets) tracer(muzzle, p.to, e.b === me);
      if (e.b === me) { viewGun.position.z = -0.3; meStats.shots++; gunStat(me.gun).shots++; play(e.gun); } else play(e.gun, clamp(0.6 - e.b.p.dist(me.p) / 70, 0, 0.6));
      return;
    }
    case "hit": paintTag(e.target);
      if (e.by === me) { hitTimer = 0.14; meStats.hits++; gunStat(me.gun).hits++; if (e.head) meStats.headshots++; play(e.head ? "headshot" : "hit"); floatText(e.target.p, e.head ? `${Math.round(e.dmg)} HS` : `${Math.round(e.dmg)}`, e.head ? "#ffd84a" : "#fff"); }
      if (e.target === me) { flashDamage(); play("hurt"); }
      return;
    case "kill": {
      const { target, by, head } = e; target.mesh.g.visible = false; paintTag(target);
      const who = (b) => (b.bot ? esc(b.name) : "<b>you</b>");
      feed(!by ? `${who(target)} fell` : `${who(by)} ${head ? "🎯" : "▸"} ${who(target)}`, by === me ? "me" : target === me ? "dead" : "");
      log(!by ? `${target.bot ? target.name : "You"} fell.` : `${by.bot ? by.name : "You"} killed ${target.bot ? target.name : "you"}${head ? " (headshot)" : ""}.`, by === me);
      if (by === me) { killTimer = 0.4; gunStat(me.gun).kills++; play("kill"); if (me.streak % 3 === 0) meStats.streaks++; if (me.streak === 3) { say("TRIPLE KILL"); play("streak"); } else if (me.streak === 5) { say("RAMPAGE"); play("streak"); } else if (me.streak >= 8 && me.streak % 4 === 0) { say("UNSTOPPABLE"); play("streak"); } }
      if (target === me) { say("YOU DIED", `${by ? `${by.name} got you` : "You fell"} · back in ${RESPAWN_S}s`); play("die"); document.exitPointerLock?.(); }
      drawSb(); return;
    }
    case "spawn": if (e.b.bot) e.b.mesh.g.visible = true; paintTag(e.b); if (e.b === me) { yaw = me.facing; pitch = -0.05; $("hudGun").textContent = GUNS[me.gun].n; say(""); play("spawn"); if (state === "play") grabMouse(); } return;
    case "jump": if (mine) play("jump"); return;
    case "slide": if (mine) play("slide"); return;
    case "pad": play("pad", mine ? 1 : 0.2); return;
    case "reload": if (mine) play("reload"); return;
    case "empty": if (mine) play("empty"); return;
  }
}

/* ------------------------------------------------------------------ the round */
let t = 0, roundT = 0, state = "menu", countdown = 0, countBeep = 0, mapKey = MAP_LIST[0];
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function feed(html, cls = "") { const F = $("feed"); const p = document.createElement("p"); p.className = cls; p.innerHTML = html; F.append(p); setTimeout(() => p.remove(), 5000); while (F.childElementCount > 6) F.firstChild.remove(); }
function log(s, good) { const L = $("log"); const p = document.createElement("p"); if (good) p.className = "good"; p.textContent = `${fmtT(roundT)} ${s}`; L.prepend(p); while (L.childElementCount > 40) L.lastChild.remove(); }
function say(text, sub = "") { $("hudMsg").textContent = text; $("hudSub").textContent = sub; clearTimeout(say.t); if (text && !sub) say.t = setTimeout(() => { if ($("hudMsg").textContent === text) $("hudMsg").textContent = ""; }, 1400); }
const events = [];
function tick(dt) {
  t += dt; if (state === "play") roundT += dt;
  // the player's spread: tighter scoped, wider in the air (the rules apply the air part)
  const inputFor = (b) => (state !== "play" ? { x: 0, z: 0 } : b.bot ? botInput(world, beans, b, dt) : playerInput());
  stepWorld(world, beans, dt, t, inputFor, Math.random, events, (b) => (b.bot ? pick(["ar", "ar", "sniper", "shotgun"]) : nextGun));
  for (const e of events) onEvent(e); events.length = 0;
}
function reset() {
  roundT = 0; $("log").innerHTML = ""; $("feed").innerHTML = ""; Object.assign(meStats, { shots: 0, hits: 0, headshots: 0, byGun: {}, streaks: 0 });
  for (const f of fx) scene.remove(f.o); fx.length = 0;
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
  if (state !== "play") return; state = "done"; document.exitPointerLock?.();
  const ranks = ranked(), place = ranks.indexOf(me) + 1, won = place === 1;
  play(won ? "win" : "lose");
  const lines = [[`${me.kills} kills`, me.kills * XP.kill], [`${meStats.headshots} headshots`, meStats.headshots * (XP.headshot - XP.kill)], [`${meStats.streaks} streaks of three`, meStats.streaks * XP.streak3], ["Finished the round", XP.round]];
  if (won) lines.push(["Won the round", XP.win]);
  const total = lines.reduce((n, l) => n + l[1], 0), res = award(total);
  recordRound({ map: mapKey, gun: nextGun, kills: me.kills, deaths: me.deaths, headshots: meStats.headshots, shots: meStats.shots, hits: meStats.hits, won, streak: me.bestStreak, seconds: roundT, byGun: meStats.byGun });
  const pct = Math.round((profile.xp / need(profile.level)) * 100);
  showMenu("result", `<b>${won ? "You win!" : `${esc(ranks[0].name)} wins`}</b>
    <p>You came <b>${ord(place)}</b> of ${PLAYERS} on ${esc(world.map.name)} · <b>${me.kills}</b> kills, <b>${me.deaths}</b> deaths · ${meStats.shots ? Math.round((meStats.hits / meStats.shots) * 100) : 0}% accuracy · best streak ${me.bestStreak}.</p>
    <div class="xp"><div class="xpl">${lines.map(([n, v]) => `<span>${esc(n)}</span><b>+${v}</b>`).join("")}<span>Total</span><b>+${total} XP</b></div>
      <div class="lvl"><b>Level ${profile.level}</b> <small>${esc(titleFor(profile.level))}</small><div class="bar"><i style="width:${pct}%"></i></div><small>${profile.xp} / ${need(profile.level)} to level ${profile.level + 1}</small></div>
      ${res.gained ? `<div class="up">LEVEL UP${res.gained > 1 ? ` ×${res.gained}` : ""} · now level ${profile.level}${res.unlocked.length ? ` · unlocked: ${res.unlocked.map((u) => esc(u.n)).join(", ")}` : ""}</div>` : ""}</div>
    <table class="sb" style="min-width:300px">${ranks.map((b, k) => `<tr class="${b.bot ? "" : "me"}"><td>${ord(k + 1)}</td><td>${esc(b.name)}</td><td>${b.kills} / ${b.deaths}</td></tr>`).join("")}</table>`);
  if (res.gained) setTimeout(() => play("levelup"), 700);
  $("over").hidden = true; overTimer = setTimeout(() => { $("over").hidden = false; }, 900);
  drawProfile();
}

/* ------------------------------------------------------------------ the menu: Play, Locker, Stats, Settings */
let tab = "play";
function showMenu(which, html) { tab = which; for (const b of document.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === which); if (html !== undefined) $("panel").innerHTML = html; else drawMenu(); $("over").hidden = false; }
function drawMenu() {
  if (tab === "play") $("panel").innerHTML = `<b>Free-for-all</b><p>Five minutes, most kills wins. <b>Shift</b> slides, <b>Space</b> hops out of a slide and keeps the speed; chain them. Jump pads fly you onto the roofs.</p>
    <p class="eyebrow">Map</p><div class="maps">${MAP_LIST.map((k) => { const m = MAPS[k](); return `<button class="mapc${k === mapKey ? " on" : ""}" data-map="${k}"><b>${esc(m.name)}</b>${esc(m.blurb)}</button>`; }).join("")}</div>
    <p class="eyebrow">Gun</p><div class="guns">${GUN_KEYS.map((k, i) => `<button class="gun${k === nextGun ? " on" : ""}" data-gun="${k}"><b>${i + 1} · ${esc(GUNS[k].n)}</b>${esc(GUNS[k].text)}</button>`).join("")}</div>
    <button class="go" data-go="1">Play</button>`;
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
  if (b.dataset.slot && wear(b.dataset.slot, b.dataset.k)) { redressMe(); drawMenu(); }
});
$("over").addEventListener("input", (e) => {
  const el = e.target.closest("[data-set]"); if (!el) return; const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
  profile.settings[k] = v; save(); const out = el.parentElement.querySelector("output"); if (out) out.textContent = k === "sens" ? `${v.toFixed(1)}×` : k === "fov" ? `${v}°` : k === "volume" ? `${Math.round(v * 100)}%` : "";
  if (k === "volume") setVolume(v); if (k === "crosshair") $("xhair").dataset.style = v;
});
setVolume(profile.settings.volume); $("xhair").dataset.style = profile.settings.crosshair;
let pvR = null;
function drawPreview() {
  const c = $("pv"); if (!c) return; if (!pvR) pvR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, c.width / c.height, 0.1, 20); cam.position.set(0, 1.3, 4.2); cam.lookAt(0, 0.85, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4)); const l = new THREE.DirectionalLight(0xffffff, 1.2); l.position.set(2, 4, 3); sc.add(l);
  beanMesh(profile.skin, sc).rotation.y = Math.PI + 0.5; pvR.setSize(c.width, c.height, false); pvR.render(sc, cam);
}
function drawProfile() { $("hudLevel").textContent = `Lv ${profile.level} · ${titleFor(profile.level)}`; $("menuLevel").textContent = `Level ${profile.level} · ${titleFor(profile.level)} · ${profile.stats.kills} kills · K/D ${kd()}`; }

/* ------------------------------------------------------------------ drawing */
function drawSb() { $("sb").innerHTML = ranked().map((b, k) => `<tr class="${b.bot ? "" : "me"}"><td>${k + 1}. ${esc(b.name)}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join(""); }
function drawBoard() { $("board").innerHTML = `<b>Free-for-all · ${esc(world?.map.name || "")} · ${fmtT(Math.max(0, ROUND_S - roundT))} left</b><table><tr><td></td><td></td><td>K</td><td>D</td></tr>${ranked().map((b, k) => `<tr class="${b.bot ? "" : "me"}"><td>${k + 1}</td><td>${esc(b.name)}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join("")}</table>`; }
function draw(dt) {
  for (const b of beans) { if (!b.bot || !b.mesh.g.visible) continue; const g = b.mesh.g; g.position.set(b.p.x, b.p.y - R, b.p.z); let dy = b.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3; g.scale.y += ((b.slide ? 0.55 : 1) - g.scale.y) * 0.3; }
  if (me.dead && me.lastBy && !me.lastBy.dead) { const k = me.lastBy; camera.position.lerp(new V3(k.p.x + 3, k.p.y + 3, k.p.z + 3), 0.1); camera.lookAt(k.p.x, k.p.y + 0.5, k.p.z); viewGun.visible = false; }
  else if (me.dead || state === "menu") { const a = t * 0.1; camera.position.set(Math.sin(a) * 40, 22, Math.cos(a) * 40); camera.lookAt(0, 2, 0); viewGun.visible = false; }
  else { camera.position.set(me.p.x, me.p.y + EYE * (me.slide ? 0.6 : 1), me.p.z); camera.rotation.set(pitch, yaw, 0); viewGun.visible = !scoping; viewGun.position.z += (-0.42 - viewGun.position.z) * 0.25; const bob = Math.hypot(me.v.x, me.v.z) > 1 && me.grounded && !me.slide ? Math.sin(t * 12) * 0.012 : 0; viewGun.position.y = -0.17 + bob; }
  const fov = scoping ? 24 : profile.settings.fov + clamp((Math.hypot(me.v.x, me.v.z) - RUN) / 9, 0, 1) * 10; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.3; camera.updateProjectionMatrix(); }
  $("scope").classList.toggle("on", scoping && !me.dead && state === "play");
  for (let k = fx.length - 1; k >= 0; k--) { const f = fx[k]; f.life -= dt; const a = Math.max(0, f.life / f.max); f.o.material.opacity = a; if (f.grow) f.o.scale.setScalar(1 + (1 - a) * f.grow); if (f.life <= 0) { scene.remove(f.o); f.o.geometry.dispose(); fx.splice(k, 1); } }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.s.position.y += dt * 1.2; f.s.material.opacity = Math.min(1, f.life * 2); if (f.life <= 0) { scene.remove(f.s); f.s.material.map.dispose(); floats.splice(i, 1); } }
  sun.position.set(camera.position.x + 20, 50, camera.position.z + 14); sun.target.position.set(camera.position.x, 0, camera.position.z);
  renderer.render(scene, camera);
}
function hud(dt) {
  hitTimer = Math.max(0, hitTimer - dt); killTimer = Math.max(0, killTimer - dt);
  $("xhair").classList.toggle("hitm", hitTimer > 0 && killTimer <= 0); $("xhair").classList.toggle("kill", killTimer > 0);
  $("hudT").textContent = state === "count" ? String(Math.ceil(countdown)) : fmtT(Math.max(0, ROUND_S - roundT));
  const place = ranked().indexOf(me) + 1; $("hudPlace").textContent = state === "play" ? `${ord(place)} of ${PLAYERS}` : "";
  $("hudK").textContent = me.kills; $("hudKD").textContent = `kills · ${me.deaths} deaths${me.streak >= 2 ? ` · streak ${me.streak}` : ""}`;
  $("hudHpN").textContent = Math.round(Math.max(0, me.hp)); $("hudHp").firstElementChild.style.width = `${clamp(me.hp / MAX_HP, 0, 1) * 100}%`;
  const g = GUNS[me.gun]; $("hudAmmo").innerHTML = me.reloading ? `<small>reloading…</small>` : `${me.ammo} <small>/ ${g.mag}</small>`;
  $("lockHint").hidden = locked || state !== "play" || me.dead;
  if (me.dead && state === "play") $("hudSub").textContent = `${me.lastBy ? `${me.lastBy.name} got you` : "You fell"} · back in ${Math.ceil(me.respawn)}s`;
}
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } }
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0;
function advance(dt) {
  if (state === "count") { countdown -= dt; if (Math.ceil(countdown) < countBeep) { countBeep = Math.ceil(countdown); play("count"); } if (countdown <= 0) { state = "play"; log("Go!"); say("GO"); play("go"); } }
  acc += dt; while (acc >= STEP) { tick(STEP); acc -= STEP; }
  if (state === "play" && roundT >= ROUND_S) endRound();
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  resize(); advance(dt); draw(dt); hud(dt);
  fpsN++; fpsT += dt; if (fpsT >= 1) { $("loadStat").textContent = `${fpsN} fps`; fpsN = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
buildMap(mapKey); reset(); state = "menu"; $("hudGun").textContent = GUNS.ar.n; drawProfile(); showMenu("play");
window.__bs = { beans, get world() { return world; }, get state() { return state; }, get roundT() { return roundT; }, start, GUNS, profile, setMap: (k) => { mapKey = k; }, aim(y, p) { yaw = y; pitch = p; }, set fire(v) { mouseFire = v; }, endRound, showMenu,
  sim(seconds) { for (let k = 0; k < seconds * 60; k++) advance(1 / 60); draw(1 / 60); hud(1 / 60); } };
requestAnimationFrame(frame);

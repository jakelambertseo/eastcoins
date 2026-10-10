/* EastKart — the page (2026-10-12). Draws and plays what eastkart-rules.js decides: the track as a ribbon off the spline, karts as a
   box with four wheels and a bean in the seat, items, shells and bananas, a chase camera, the HUD and a minimap. Practice runs the
   rules here against seven bots; a time trial runs alone against the ghost of your best lap (kept in this browser). The room server
   comes next, the way CS67's did: this file already keeps "what happened" (the rules) apart from "what it looks like". */
import * as THREE from "three";
import { KART, ITEMS, TRACKS, TRACK_LIST, buildTrack, newRace, stepRace, progressOf, fmtTime, ordinal, VERSION } from "/v3/assets/js/eastkart-rules.js?v=2";

const $ = (id) => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FRAMED = (() => { try { return window.top !== window; } catch { return true; } })();
const BEST_KEY = "ec_kart_best", GHOST_KEY = "ec_kart_ghost", NAME_KEY = "ec_kart_name";
const best = (() => { try { return JSON.parse(localStorage.getItem(BEST_KEY) || "{}"); } catch { return {}; } })();
const saveBest = () => { try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch {} };

/* ---------------------------------------------------------------- audio: an engine and a few blips, all synthesised */
let AC = null, eng = null, engGain = null, vol = 0.6;
function audioOn() { if (AC) { loadSounds(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(); o.type = "sawtooth"; o.frequency.value = 60; const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600; engGain = AC.createGain(); engGain.gain.value = 0; o.connect(f); f.connect(engGain); engGain.connect(AC.destination); o.start(); eng = o; loadSounds(); } catch {} }
function engine(speed, throttle, on, drifting = false) { if (!AC) return; const t = AC.currentTime, sp = Math.abs(speed) / KART.MAX;
  if (SND.engineSrc) { SND.engineSrc.playbackRate.setTargetAtTime(0.7 + sp * 1.1 + (throttle ? 0.08 : 0), t, 0.08); SND.engineGain.gain.setTargetAtTime(on ? (0.25 + sp * 0.35) * vol : 0, t, 0.1); }
  else if (eng) { eng.frequency.setTargetAtTime(55 + Math.abs(speed) * 5.5 + (throttle ? 12 : 0), t, 0.05); engGain.gain.setTargetAtTime(on ? (0.035 + sp * 0.05) * vol : 0, t, 0.08); }
  if (SND.driftGain) SND.driftGain.gain.setTargetAtTime(on && drifting ? 0.5 * vol : 0, t, 0.06); }
function tone(f, to, dur, type = "square", g = 0.12) { if (!AC) return; const o = AC.createOscillator(), a = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, AC.currentTime); if (to) o.frequency.exponentialRampToValueAtTime(to, AC.currentTime + dur); a.gain.setValueAtTime(g * vol, AC.currentTime); a.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur); o.connect(a); a.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur); }
function noise(dur, g = 0.2, lp = 2000) { if (!AC) return; const n = AC.sampleRate * dur, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; const a = AC.createGain(); a.gain.value = g * vol; s.connect(f); f.connect(a); a.connect(AC.destination); s.start(); }
/* SOUND FILES (2026-10-12, the owner: "audio/sounds as well … i can have another ai program make them"). Every cue has a slot in
   snd/<name>.mp3; the page fetches each once at the first gesture and plays the file when it exists, the synthesised cue when it
   does not — so files can land one at a time. The engine and the drift are LOOPS whose rate follows the speed. Specs in snd/README.md. */
const SND_V = 1, SND_FILES = { bath_drop: "mp3", bath_hit: "mp3", bump: "ogg", click: "ogg", count: "ogg", drill: "ogg", engine_loop: "wav", final_lap: "ogg", finish_lose: "ogg", finish_win: "ogg", flag_hit: "ogg", go: "ogg", hail_hit: "ogg", item: "ogg", lap: "ogg", oline_block: "ogg", oline_up: "ogg", slap_hit: "ogg", slap_shot: "ogg" };   // what is in snd/ right now (name: extension); a cue not listed uses its synthesised fallback
const SND = { buf: new Map(), loaded: false, engineSrc: null, engineGain: null, driftSrc: null, driftGain: null };
async function loadSounds() { if (SND.loaded || !AC) return; SND.loaded = true; await Promise.all(Object.entries(SND_FILES).map(async ([n, ext]) => { try { const r = await fetch(`snd/${n}.${ext}?v=${SND_V}`); if (!r.ok) return; const b = await AC.decodeAudioData(await r.arrayBuffer()); SND.buf.set(n, b); } catch {} })); if (SND.buf.has("engine_loop")) { SND.engineGain = AC.createGain(); SND.engineGain.gain.value = 0; SND.engineGain.connect(AC.destination); SND.engineSrc = AC.createBufferSource(); SND.engineSrc.buffer = SND.buf.get("engine_loop"); SND.engineSrc.loop = true; SND.engineSrc.connect(SND.engineGain); SND.engineSrc.start(); if (engGain) engGain.gain.value = 0; } if (SND.buf.has("drift_loop")) { SND.driftGain = AC.createGain(); SND.driftGain.gain.value = 0; SND.driftGain.connect(AC.destination); SND.driftSrc = AC.createBufferSource(); SND.driftSrc.buffer = SND.buf.get("drift_loop"); SND.driftSrc.loop = true; SND.driftSrc.connect(SND.driftGain); SND.driftSrc.start(); } }
function file(n, g = 1) { const b = SND.buf.get(n); if (!b || !AC) return false; const src = AC.createBufferSource(); src.buffer = b; const a = AC.createGain(); a.gain.value = g * vol; src.connect(a); a.connect(AC.destination); src.start(); return true; }
const SFX = { count: () => file("count") || tone(440, 0, 0.12), go: () => file("go") || tone(880, 1200, 0.3), item: () => file("item") || tone(600, 1200, 0.15, "triangle"), boost: () => file("drill") || (noise(0.5, 0.25, 3000), tone(200, 900, 0.4, "sawtooth", 0.08)), spin: () => file("spin") || (noise(0.3, 0.3, 800), tone(300, 80, 0.4, "square", 0.1)), bump: () => file("bump") || noise(0.12, 0.2, 600), hail: () => file("hail_throw") || (noise(0.25, 0.15, 2500), tone(700, 350, 0.3, "sawtooth", 0.07)), hailHit: () => file("hail_hit"), slap: () => file("slap_shot") || (noise(0.08, 0.3, 1500), tone(1200, 400, 0.12, "square", 0.08)), slapHit: () => file("slap_hit"), bath: () => file("bath_drop") || (noise(0.35, 0.22, 900), tone(400, 150, 0.3, "triangle", 0.08)), bathHit: () => file("bath_hit"), flag: () => file("flag_throw") || (tone(1500, 1500, 0.08, "square", 0.1), setTimeout(() => tone(1500, 1500, 0.08, "square", 0.1), 120), setTimeout(() => tone(1500, 1500, 0.08, "square", 0.1), 240)), flagHit: () => file("flag_hit"), shield: () => file("oline_up") || tone(300, 700, 0.3, "triangle", 0.08), blocked: () => file("oline_block") || (noise(0.2, 0.3, 700), tone(220, 110, 0.3, "square", 0.1)), lap: () => file("lap") || (tone(660, 0, 0.1), setTimeout(() => tone(990, 0, 0.15), 110)), finalLap: () => file("final_lap") || (tone(660, 0, 0.1), setTimeout(() => tone(990, 0, 0.15), 110)), finish: (won) => file(won ? "finish_win" : "finish_lose") || (tone(523, 0, 0.15), setTimeout(() => tone(659, 0, 0.15), 150), setTimeout(() => tone(784, 0, 0.3), 300)), drift: () => SND.driftSrc ? true : noise(0.15, 0.08, 1200), click: () => file("click") };

/* ---------------------------------------------------------------- three: scene, textures, meshes */
const canvas = $("c"), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.3, 900);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.35)); const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(80, 140, 60); scene.add(sun);
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } addEventListener("resize", resize); resize();
function canvasTex(w, h, paint, repeat = [1, 1]) { const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.colorSpace = THREE.SRGBColorSpace; return t; }
const TEX = {
  asphalt: canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#3a3d44"; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 20 : 90},${Math.random() < 0.5 ? 22 : 92},${Math.random() < 0.5 ? 26 : 98},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
  grass: (col) => canvasTex(256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); g.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [60, 60]),
  kerb: canvasTex(64, 16, (g, w, h) => { g.fillStyle = "#e23b3b"; g.fillRect(0, 0, w / 2, h); g.fillStyle = "#f4f4f4"; g.fillRect(w / 2, 0, w / 2, h); }, [1, 1]),
  box: canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#ffd23f"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a1300"; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", w / 2, h / 2 + 2); })
};
const M = (c, r = 0.75, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
/* REAL TEXTURES, TO TEST (2026-10-12, the owner: "find some free ones … and add them in to test"). CC0 photos from Poly Haven
   (asphalt_02, aerial_grass_rock, concrete_floor_worn_001, asphalt_pit_lane), shrunk to 256 px tiles in tex/. A material starts on
   the drawn texture and swaps to the file when it arrives, so a missing file costs nothing; `?tex=0` keeps the drawn ones to compare. */
const TEX_V = 1, USE_FILES = new URLSearchParams(location.search).get("tex") !== "0", loader = new THREE.TextureLoader();
function fileTex(mat, name, repeat) { if (!USE_FILES) return; loader.load(`tex/${name}.webp?v=${TEX_V}`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); mat.map = t; mat.needsUpdate = true; }); }
let trackGroup = null, itemMeshes = [], ghostMesh = null;
function buildTrackScene(track) {
  if (trackGroup) { scene.remove(trackGroup); trackGroup.traverse((o) => { o.geometry?.dispose?.(); }); }
  trackGroup = new THREE.Group(); itemMeshes = [];
  scene.background = new THREE.Color(track.sky); scene.fog = new THREE.Fog(track.sky, 160, 420);
  const def = TRACKS[track.key];
  const groundMat = new THREE.MeshStandardMaterial({ map: TEX.grass(`#${def.ground.toString(16).padStart(6, "0")}`), roughness: 1 });
  fileTex(groundMat, track.key === "lot" ? "grass" : track.key === "docks" ? "concrete" : "pitlane", [90, 90]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; trackGroup.add(ground);
  // the road: a ribbon, the kerbs on each edge, the start line
  const N = track.N, half = track.width / 2;
  const ribbon = (offA, offB, mat, uvScale) => { const pos = [], uv = [], idx = []; for (let i = 0; i <= N; i++) { const q = track.pts[i % N]; pos.push(q.x + q.nx * offA, 0, q.z + q.nz * offA, q.x + q.nx * offB, 0, q.z + q.nz * offB); uv.push(i / uvScale, 0, i / uvScale, 1); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return new THREE.Mesh(g, mat); };
  const roadMat = new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: 0.95, side: THREE.DoubleSide }); fileTex(roadMat, "road", [1, 1]); const road = ribbon(half, -half, roadMat, 6); /* the ribbon's winding depends on which way the loop runs, so both sides draw */ road.position.y = 0.0; trackGroup.add(road);
  TEX.asphalt.repeat.set(1, 1);
  const kerbMat = new THREE.MeshStandardMaterial({ map: TEX.kerb, roughness: 0.8, side: THREE.DoubleSide }); const kL = ribbon(half + 1.1, half, kerbMat, 3), kR = ribbon(-half, -half - 1.1, kerbMat, 3); kL.position.y = kR.position.y = 0.01; trackGroup.add(kL, kR);
  const q0 = track.pts[0]; const start = new THREE.Mesh(new THREE.BoxGeometry(track.width, 0.05, 1.6), M(0xf4f4f4, 0.6)); start.position.set(q0.x, 0.02, q0.z); start.rotation.y = Math.atan2(q0.tx, q0.tz); trackGroup.add(start);
  const chk = new THREE.Mesh(new THREE.BoxGeometry(track.width, 0.051, 0.8), M(0x111111, 0.6)); chk.position.set(q0.x, 0.02, q0.z); chk.rotation.y = start.rotation.y; trackGroup.add(chk);
  // a banner over the line
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), M(0x222630)); post.position.set(q0.x + q0.nx * s * (half + 1.6), 3.5, q0.z + q0.nz * s * (half + 1.6)); trackGroup.add(post); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(track.width + 3.6, 1.4, 0.3), M(0xffd23f, 0.6)); banner.position.set(q0.x, 6.6, q0.z); banner.rotation.y = start.rotation.y; trackGroup.add(banner);
  // the scenery: blocks and cones off the road, left and right, in the track's palette
  const pal = track.key === "lot" ? [0xc96a4b, 0x3b7fbf, 0x2f9d6a, 0xd8c89a] : track.key === "docks" ? [0xb8412f, 0x3261a8, 0x7a8a99, 0xd9a441] : [0x5e4b8b, 0x8a6bb5, 0x3b3550, 0xc1b7e0];
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const blocks = new THREE.Group();
  for (let i = 0; i < N; i += 14) { for (const s of [-1, 1]) { if (rnd() < 0.45) continue; const q = track.pts[i], d = half + KART.WALL + 4 + rnd() * 26, w = 4 + rnd() * 9, h = 3 + rnd() * 12, x = q.x + q.nx * s * d, z = q.z + q.nz * s * d;
    // keep blocks off the road entirely (the loop folds back on itself)
    let clear = true; for (let j = 0; j < N; j += 6) { const p = track.pts[j]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < (half + w / 2 + 3) ** 2) { clear = false; break; } } if (!clear) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), M(pal[Math.floor(rnd() * pal.length)], 0.85)); b.position.set(x, h / 2, z); b.rotation.y = rnd() * Math.PI; blocks.add(b); } }
  trackGroup.add(blocks);
  for (let i = 0; i < N; i += 9) { for (const s of [-1, 1]) { if (rnd() < 0.7) continue; const q = track.pts[i], d = half + 2.2 + rnd() * 3; const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 8), M(0xff7a1c, 0.7)); c.position.set(q.x + q.nx * s * d, 0.55, q.z + q.nz * s * d); trackGroup.add(c); } }
  // the item boxes
  for (const it of track.items) { const q = track.pts[it.i]; const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshStandardMaterial({ map: TEX.box, emissive: 0x664400, roughness: 0.4 })); m.position.set(q.x + q.nx * it.off, 1.1, q.z + q.nz * it.off); trackGroup.add(m); itemMeshes.push({ m, it }); }
  scene.add(trackGroup);
}
function kartMesh(k) {
  const g = new THREE.Group(); const col = k.color;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 2.3), M(col, 0.5, 0.2)); body.position.y = 0.5; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.6), M(col, 0.5, 0.2)); nose.position.set(0, 0.62, 1.35); g.add(nose);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.4), M(0x1a1d26, 0.6)); spoiler.position.set(0, 1.0, -1.15); g.add(spoiler);
  const wheels = []; for (const [x, z] of [[-0.85, 0.75], [0.85, 0.75], [-0.85, -0.8], [0.85, -0.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.34, 14), M(0x15171c, 0.9)); w.rotation.z = Math.PI / 2; const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 8), M(0x9aa3b2, 0.4, 0.6)); hub.rotation.z = Math.PI / 2; const wg = new THREE.Group(); wg.add(w, hub); wg.position.set(x, 0.36, z); g.add(wg); wheels.push(wg); }
  const bean = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.45, 6, 12), M(k.bot ? 0xd8dde6 : 0xffd23f, 0.7)); bean.position.set(0, 1.05, -0.15); g.add(bean);
  for (const x of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(x, 1.22, 0.24); g.add(e); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xff8a1c, transparent: true, opacity: 0.9 })); flame.rotation.x = Math.PI / 2; flame.position.set(0, 0.5, -1.9); flame.visible = false; g.add(flame);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x2 = c.getContext("2d"); x2.textAlign = "center"; x2.font = "900 24px Unbounded, Figtree, sans-serif"; x2.lineWidth = 5; x2.strokeStyle = "#000"; x2.strokeText(k.name, 128, 40); x2.fillStyle = k.bot ? "#cfd5de" : "#ffd23f"; x2.fillText(k.name, 128, 40);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); tag.scale.set(2.2, 0.55, 1); tag.position.y = 2.2; g.add(tag);
  scene.add(g); return { g, body, wheels, flame, tag };
}
const ballGeo = new THREE.SphereGeometry(0.5, 12, 10), ballMat = M(0x8a4b22, 0.6), puckGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14), puckMat = M(0x111318, 0.4, 0.3), puddleGeo = new THREE.CircleGeometry(1.5, 18), puddleMat = new THREE.MeshStandardMaterial({ color: 0xff8a1c, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), flagGeo = new THREE.BoxGeometry(0.9, 0.6, 0.06), flagMat = M(0xffd23f, 0.6), shieldGeo = new THREE.SphereGeometry(2.1, 16, 12), shieldMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.2, depthWrite: false });
function shotMesh(sh) { if (sh.kind === "hail") { const m = new THREE.Mesh(ballGeo, ballMat); m.scale.set(0.75, 0.75, 1.25); const lace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), M(0xffffff, 0.8)); lace.position.y = 0.42; m.add(lace); return m; } if (sh.kind === "slap") return new THREE.Mesh(puckGeo, puckMat); const g = new THREE.Group(); const f = new THREE.Mesh(flagGeo, flagMat); f.position.set(0.45, 0.3, 0); g.add(f); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), M(0xf4f4f4, 0.6)); g.add(pole); return g; }

/* ---------------------------------------------------------------- the race on the page */
let race = null, mode = "race", trackKey = TRACK_LIST[0], meshes = new Map(), fx = [], state = "menu", tab = "play", acc = 0, last = 0, drifting = false;
let shotMeshes = new Map(), puddleMeshes = new Map();
const keys = {};
addEventListener("keydown", (e) => { if (e.repeat) return; keys[e.code] = true; if (e.code === "Escape") { if (state === "race") showMenu("play"); else if (state === "paused") resumeGame(); } if (e.code === "KeyR" && state === "race") resetKart(); if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault(); audioOn(); });
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
const inputFor = () => ({ accel: Boolean(keys.KeyW || keys.ArrowUp), brake: Boolean(keys.KeyS || keys.ArrowDown), steer: (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0), drift: Boolean(keys.Space), use: Boolean(keys.ShiftLeft || keys.ShiftRight || keys.KeyE) });
const me = () => race?.karts[0];
function resetKart() { const k = me(); if (!k) return; const q = race.track.pts[k.i]; k.p.x = q.x; k.p.z = q.z; k.yaw = k.head = Math.atan2(q.tx, q.tz); k.speed = 0; k.spin = 0; k.drift = 0; }

function startRace() {
  const name = (localStorage.getItem(NAME_KEY) || "You").slice(0, 16);
  race = newRace(trackKey, name, mode === "tt" ? 0 : KART.PLAYERS - 1);
  buildTrackScene(race.track);
  for (const [, m] of meshes) scene.remove(m.g); meshes = new Map(); for (const k of race.karts) meshes.set(k, kartMesh(k));
  for (const [, m] of shotMeshes) scene.remove(m); shotMeshes = new Map(); for (const [, m] of puddleMeshes) scene.remove(m); puddleMeshes = new Map();
  if (ghostMesh) { scene.remove(ghostMesh.g); ghostMesh = null; }
  ghost.load(); if (mode === "tt" && ghost.trail) { ghostMesh = kartMesh({ name: "your ghost", bot: true, color: 0x6ad0ff }); ghostMesh.g.traverse((o) => { if (o.material && o.material.transparent !== undefined) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; } }); }
  $("feed").innerHTML = ""; $("over").hidden = true; $("hint").hidden = false; state = "race"; last = performance.now(); acc = 0;
  $("hudLap").textContent = `LAP 1/${race.track.laps}`; $("hudBest").textContent = `best ${fmtTime(best[trackKey]?.lap)}`;
  const k = me(); camera.position.set(k.p.x - Math.sin(k.yaw) * 8, 3.5, k.p.z - Math.cos(k.yaw) * 8);
  canvas.focus(); audioOn(); countShown = 4;
}
let countShown = 4;
function onEvent(e) {
  const mine = e.k === me();
  switch (e.type) {
    case "go": $("count").textContent = "GO!"; $("count").classList.add("go"); $("count").hidden = false; SFX.go(); setTimeout(() => { $("count").hidden = true; $("count").classList.remove("go"); }, 700); $("hint").hidden = true; break;
    case "item": if (mine) { SFX.item(); $("hudItem").classList.add("on"); } break;
    case "use": if (mine) $("hudItem").classList.remove("on"); break;
    case "shot": if (e.kind === "hail") { SFX.hail(); if (mine) say("HAIL MARY", e.target ? `at ${e.target.name}` : "into the open field"); else if (e.target === me()) feed(`${esc(e.k.name)} threw a Hail Mary at you`, "bad"); } else if (e.kind === "slap") { if (mine || Math.random() < 0.5) SFX.slap(); if (mine) say("SLAPSHOT"); } else if (e.kind === "flag") { SFX.flag(); if (mine) say("FLAG ON THE PLAY", `on ${e.target?.name || "the leader"}`); else if (e.target === me()) { say("FLAG ON THE PLAY", "on you"); feed(`${esc(e.k.name)} threw the flag at you`, "bad"); } } break;
    case "puddle": if (mine) { SFX.bath(); say("GATORADE BATH", "dumped behind you"); } break;
    case "shield": if (mine) { SFX.shield(); say("O-LINE", "seven seconds of cover"); } break;
    case "blocked": if (mine) { SFX.blocked(); say("O-LINE HELD", `the ${ITEMS[e.why]?.n || e.why} bounced off`); } else feed(`${esc(e.k.name)}'s O-Line held`); break;
    case "boost": if (mine) { SFX.boost(); if (e.from === "drift") say("DRIFT BOOST", `${e.t.toFixed(1)} s`); } break;
    case "spin": { const what = { hail: "took a Hail Mary", slap: "took a slapshot", bath: "got the Gatorade bath", flag: "flag on the play" }[e.why] || e.why; if (mine) { ({ hail: SFX.hailHit, slap: SFX.slapHit, bath: SFX.bathHit, flag: SFX.flagHit }[e.why]?.() || SFX.spin()); say({ hail: "SACKED", slap: "SLAPSHOT", bath: "GATORADE BATH", flag: "FLAG ON THE PLAY" }[e.why] || "SPUN OUT", e.by ? `by ${e.by.name}` : ""); } else { feed(`${esc(e.k.name)} ${what}${e.by === me() ? " · yours" : ""}`, e.by === me() ? "me" : ""); if (e.by === me()) SFX.spin(); } break; }
    case "bump": if (e.a === me() || e.b === me()) SFX.bump(); break;
    case "wall": if (mine) SFX.bump(); break;
    case "drift": if (mine) { drifting = e.on; if (e.on) SFX.drift(); } break;
    case "lap": if (mine) { if (e.lap === race.track.laps - 1) SFX.finalLap(); else SFX.lap(); const t = race.track, b = best[trackKey] || (best[trackKey] = {}); const pb = !b.lap || e.time < b.lap; if (pb) { b.lap = e.time; saveBest(); ghost.keepBest(); } say(e.lap >= t.laps ? "FINAL LAP DONE" : e.lap === t.laps - 1 ? "FINAL LAP" : `LAP ${e.lap + 1}`, `${fmtTime(e.time)}${pb ? " · best lap!" : ""}`); $("hudBest").textContent = `best ${fmtTime(b.lap)}`; ghost.lapStart(); } break;
    case "finish": if (mine) { SFX.finish(e.k.place === 1); say(ordinal(e.k.place), e.k.place === 1 ? "you win" : "finished"); const b = best[trackKey] || (best[trackKey] = {}); if (mode === "race" && (!b.total || e.k.total < b.total)) { b.total = e.k.total; saveBest(); } if (mode === "race" && e.k.place === 1) b.wins = (b.wins || 0) + 1, saveBest(); } else feed(`${esc(e.k.name)} finished ${ordinal(e.k.place)}`); break;
    case "done": setTimeout(() => showResults(), 400); break;
  }
}
let sayT = 0; function say(t, s = "") { $("sayT").textContent = t; $("sayS").textContent = s; $("say").hidden = false; clearTimeout(sayT); sayT = setTimeout(() => { $("say").hidden = true; }, 1600); }
function feed(html, cls = "") { const p = document.createElement("p"); p.className = cls; p.innerHTML = html; $("feed").prepend(p); while ($("feed").children.length > 4) $("feed").lastChild.remove(); setTimeout(() => p.remove(), 4000); }

/* the ghost: your best lap on this track, twenty samples a second, kept in this browser */
const ghost = { trail: null, rec: [], recT: 0, t0: 0,
  load() { try { const all = JSON.parse(localStorage.getItem(GHOST_KEY) || "{}"); ghost.trail = all[trackKey] || null; } catch { ghost.trail = null; } ghost.rec = []; ghost.t0 = -1; },
  lapStart() { ghost.rec = []; ghost.t0 = race.t; },
  keepBest() { if (ghost.rec.length < 20) return; try { const all = JSON.parse(localStorage.getItem(GHOST_KEY) || "{}"); all[trackKey] = ghost.rec; localStorage.setItem(GHOST_KEY, JSON.stringify(all)); ghost.trail = ghost.rec.slice(); } catch {} },
  tick(dt) { const k = me(); if (!k || ghost.t0 < 0) return; ghost.recT += dt; if (ghost.recT >= 0.05) { ghost.recT = 0; ghost.rec.push([+k.p.x.toFixed(2), +k.p.z.toFixed(2), +k.yaw.toFixed(3)]); } },
  draw() { if (!ghostMesh || !ghost.trail || ghost.t0 < 0) { if (ghostMesh) ghostMesh.g.visible = false; return; } const i = Math.floor((race.t - ghost.t0) / 0.05); const s = ghost.trail[Math.min(i, ghost.trail.length - 1)]; if (!s) return; ghostMesh.g.visible = true; ghostMesh.g.position.set(s[0], 0, s[1]); ghostMesh.g.rotation.y = s[2]; }
};

/* ---------------------------------------------------------------- the loop */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state === "race" && race) {
    acc += dt; const events = []; let steps = 0;
    while (acc >= KART.STEP && steps < 6) { if (race.state === "race") { ghost.tick(KART.STEP); if (ghost.t0 < 0 && me().lapStart > 0) ghost.lapStart(); } stepRace(race, inputFor, KART.STEP, Math.random, events); acc -= KART.STEP; steps++; }
    for (const e of events) onEvent(e);
    if (race.state === "count") { const n = Math.ceil(race.countT); if (n !== countShown && n >= 1 && n <= 3) { countShown = n; $("count").textContent = n; $("count").hidden = false; SFX.count(); } }
    draw(dt);
  }
  renderer.render(scene, camera);
}
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function draw(dt) {
  const k = me(), t = race.track;
  for (const kk of race.karts) { const m = meshes.get(kk); m.g.position.set(kk.p.x, 0, kk.p.z); m.g.rotation.y = kk.yaw; m.body.rotation.z += ((kk.drift ? -kk.drift * 0.14 : 0) - m.body.rotation.z) * Math.min(1, 10 * dt); m.body.rotation.x += ((kk.boost > 0 ? -0.06 : 0) - m.body.rotation.x) * Math.min(1, 8 * dt);
    for (let w = 0; w < 4; w++) { const wg = m.wheels[w]; wg.children[0].rotation.x += kk.speed * dt / 0.36; wg.children[1].rotation.x = wg.children[0].rotation.x; if (w < 2) wg.rotation.y = kk.steer * 0.45; } m.flame.visible = kk.boost > 0; if (m.flame.visible) m.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1); m.tag.visible = kk !== k;
    if (kk.spin > 0) m.g.rotation.y = kk.yaw; }
  // sparks in a drift
  if (k.drift && Math.random() < 0.7) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xffd23f : 0xff8a1c })); const side = -k.drift; s.position.set(k.p.x + Math.cos(k.yaw) * side * 0.9 - Math.sin(k.yaw) * 0.8, 0.2, k.p.z - Math.sin(k.yaw) * side * 0.9 - Math.cos(k.yaw) * 0.8); s.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6), life: 0.5 }; scene.add(s); fx.push(s); }
  for (let i = fx.length - 1; i >= 0; i--) { const s = fx[i]; s.userData.life -= dt; s.position.addScaledVector(s.userData.v, dt); s.userData.v.y -= 12 * dt; if (s.userData.life <= 0) { scene.remove(s); s.geometry.dispose(); fx.splice(i, 1); } }
  // the shots, the puddles, the O-Lines
  for (const sh of race.shots) { if (!shotMeshes.has(sh)) { const m = shotMesh(sh); scene.add(m); shotMeshes.set(sh, m); } const m = shotMeshes.get(sh); if (sh.kind === "flag") { m.position.set(sh.x, sh.y || 3, sh.z); m.rotation.y += 6 * dt; } else { m.position.set(sh.x, sh.kind === "slap" ? 0.15 : 0.9 + Math.abs(Math.sin(sh.t * 6)) * 0.8, sh.z); if (sh.kind === "hail") { const q = race.track.pts[Math.floor(sh.i) % race.track.N]; m.rotation.y = Math.atan2(q.tx, q.tz); m.rotation.x += 9 * dt; } else m.rotation.y += 14 * dt; } }
  for (const [sh, m] of shotMeshes) if (!race.shots.includes(sh)) { scene.remove(m); shotMeshes.delete(sh); }
  for (const b of race.puddles) { if (!puddleMeshes.has(b)) { const m = new THREE.Mesh(puddleGeo, puddleMat); m.rotation.x = -Math.PI / 2; m.position.set(b.x, 0.04, b.z); scene.add(m); puddleMeshes.set(b, m); } }
  for (const [b, m] of puddleMeshes) if (!race.puddles.includes(b)) { scene.remove(m); puddleMeshes.delete(b); }
  for (const kk of race.karts) { const m = meshes.get(kk); if (!m.shield) { m.shield = new THREE.Mesh(shieldGeo, shieldMat); m.shield.position.y = 0.9; m.g.add(m.shield); } m.shield.visible = kk.shield > 0; if (m.shield.visible) m.shield.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.04); }
  for (const { m, it } of itemMeshes) { m.visible = it.t <= 0; m.rotation.y += 1.6 * dt; m.rotation.x += 0.9 * dt; m.position.y = 1.1 + Math.sin(performance.now() / 400 + it.i) * 0.15; }
  ghost.draw();
  // the chase camera: behind the heading, a little higher and wider with speed
  const sp = clamp(Math.abs(k.speed) / KART.MAX, 0, 1.3), back = 6.5 + sp * 1.5, up = 3 + sp * 0.4;
  camPos.set(k.p.x - Math.sin(k.head) * back, up, k.p.z - Math.cos(k.head) * back); camera.position.lerp(camPos, Math.min(1, (race.state === "count" ? 2 : 7) * dt));
  camLook.set(k.p.x + Math.sin(k.head) * 5, 1.1, k.p.z + Math.cos(k.head) * 5); camera.lookAt(camLook);
  camera.fov += ((68 + sp * 10 + (k.boost > 0 ? 8 : 0)) - camera.fov) * Math.min(1, 6 * dt); camera.updateProjectionMatrix();
  // HUD
  $("hudLap").textContent = `LAP ${Math.min(k.lap + 1, t.laps)}/${t.laps}`; $("hudT").textContent = fmtTime(race.state === "count" ? 0 : race.t - race.started); $("hudPos").textContent = mode === "tt" ? (k.lapStart ? fmtTime(race.t - k.lapStart) : "—") : ordinal(k.place || race.karts.length); $("hudPos").classList.toggle("tt", mode === "tt");
  $("hudItemIc").textContent = k.item ? ITEMS[k.item].icon : ""; $("hudItemN").textContent = k.item ? ITEMS[k.item].n : ""; $("hudSpeedo").style.setProperty("--v", `${Math.round(clamp(Math.abs(k.speed) / (KART.MAX * 1.3), 0, 1) * 100)}%`); $("hudSpeedN").textContent = `${Math.round(Math.abs(k.speed) * 3.6)}`;
  engine(k.speed, inputFor().accel, true, Boolean(k.drift));
  drawMap();
}
function drawMap() {
  const c = $("map"), g = c.getContext("2d"), t = race.track; g.clearRect(0, 0, c.width, c.height);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity; for (const p of t.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const s = Math.min((c.width - 20) / (maxX - minX), (c.height - 20) / (maxZ - minZ)), ox = (c.width - (maxX - minX) * s) / 2 - minX * s, oz = (c.height - (maxZ - minZ) * s) / 2 - minZ * s;
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = Math.max(2, t.width * s); g.lineCap = "round"; g.beginPath(); t.pts.forEach((p, i) => { i ? g.lineTo(p.x * s + ox, p.z * s + oz) : g.moveTo(p.x * s + ox, p.z * s + oz); }); g.closePath(); g.stroke();
  for (const k of race.karts) { g.fillStyle = k.bot ? "#cfd5de" : "#ffd23f"; g.beginPath(); g.arc(k.p.x * s + ox, k.p.z * s + oz, k.bot ? 3 : 4.5, 0, Math.PI * 2); g.fill(); }
}

/* ---------------------------------------------------------------- menus */
function showMenu(which) { tab = which; if (state === "race") state = "paused"; $("resumeBtn").hidden = state !== "paused"; for (const b of document.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === which); drawMenu(); $("over").hidden = false; engine(0, false, false); }
function resumeGame() { if (state !== "paused") return; $("over").hidden = true; state = "race"; last = performance.now(); canvas.focus(); }
function trackThumb(c, key) { const t = buildTrack(key); const g = c.getContext("2d"); c.width = 320; c.height = 180; g.fillStyle = `#${TRACKS[key].ground.toString(16).padStart(6, "0")}`; g.fillRect(0, 0, c.width, c.height); let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity; for (const p of t.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); } const s = Math.min((c.width - 30) / (maxX - minX), (c.height - 30) / (maxZ - minZ)), ox = (c.width - (maxX - minX) * s) / 2 - minX * s, oz = (c.height - (maxZ - minZ) * s) / 2 - minZ * s; g.strokeStyle = "#3a3d44"; g.lineWidth = Math.max(3, t.width * s); g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); t.pts.forEach((p, i) => { i ? g.lineTo(p.x * s + ox, p.z * s + oz) : g.moveTo(p.x * s + ox, p.z * s + oz); }); g.closePath(); g.stroke(); g.strokeStyle = "#f4f4f4"; g.lineWidth = 2; g.beginPath(); const q = t.pts[0]; g.moveTo((q.x - q.nx * t.width / 2) * s + ox, (q.z - q.nz * t.width / 2) * s + oz); g.lineTo((q.x + q.nx * t.width / 2) * s + ox, (q.z + q.nz * t.width / 2) * s + oz); g.stroke(); }
function drawMenu() {
  const P = $("panel");
  if (tab === "play") {
    P.innerHTML = `<h1><small>${mode === "tt" ? "time trial" : "race"} · v${VERSION}</small>Pick a track</h1><p><b>Eight beans, three laps, items.</b> In a race it is you against seven bots; in a time trial it is you against the ghost of your best lap.</p>
      <p class="eyebrow">Track</p><div class="tracks">${TRACK_LIST.map((k) => { const d = TRACKS[k], b = best[k] || {}; return `<button class="track${k === trackKey ? " on" : ""}" data-track="${k}"><canvas data-thumb="${k}"></canvas><div><b>${esc(d.name)}</b><small>${esc(d.blurb)}</small><div class="best">best lap ${fmtTime(b.lap)}${b.total ? ` · race ${fmtTime(b.total)}` : ""}${b.wins ? ` · ${b.wins} win${b.wins === 1 ? "" : "s"}` : ""}</div></div></button>`; }).join("")}</div>
      <div class="pm-row"><div class="seg"><button class="${mode === "race" ? "on" : ""}" data-mode="race">Race · vs 7 bots</button><button class="${mode === "tt" ? "on" : ""}" data-mode="tt">Time trial · vs your ghost</button></div><label style="color:var(--dim);font-size:13px">Name <input id="nm" maxlength="16" value="${esc(localStorage.getItem(NAME_KEY) || "You")}" style="width:120px;padding:6px 8px;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--ink);font:inherit"></label></div>
      <button class="go" data-go="1">${mode === "tt" ? "Start the trial →" : "Lights out →"}</button>`;
    for (const c of P.querySelectorAll("[data-thumb]")) trackThumb(c, c.dataset.thumb);
  } else if (tab === "times") {
    P.innerHTML = `<h1><small>kept in this browser</small>Your times</h1><div class="res"><table>${TRACK_LIST.map((k) => { const b = best[k] || {}; return `<tr><td>${esc(TRACKS[k].name)}</td><td class="n">best lap ${fmtTime(b.lap)}</td><td class="n">best race ${fmtTime(b.total)}</td><td class="n">${b.wins || 0} wins</td></tr>`; }).join("")}</table></div><p>Online races with everyone, boards and Brass come with the room server, the way CS67's did.</p>`;
  } else if (tab === "how") {
    P.innerHTML = `<h1><small>the wheel</small>How to drive</h1><div class="keys"><div><b>W · ↑</b>Accelerate. Hold it; there is no gear to find.</div><div><b>A D · ← →</b>Steer. The faster you go, the more a corner costs — unless you drift.</div><div><b>S · ↓</b>Brake, then reverse.</div><div><b>SPACE</b>Drift: hold it with the wheel turned. The kart slides, turns harder and charges; let go after a second for a boost, longer for a bigger one.</div><div><b>SHIFT · E</b>Use what you picked up from a box.</div><div><b>R</b>Back onto the road, pointing the right way, if you are stuck.</div><div><b>ESC</b>This menu.</div><div><b>The boxes</b>What a box gives depends on where you are: the leader mostly gets the bath, the back gets the drill and the flag.</div></div>
      <p class="eyebrow">The plays</p><div class="keys">${Object.values(ITEMS).map((it) => `<div><b>${it.icon} ${esc(it.n)}</b>${esc(it.line)}</div>`).join("")}</div>`;
  }
}
function showResults() {
  state = "done"; engine(0, false, false); const t = race.track, k = me();
  const rows = race.karts.slice().sort((a, b) => a.place - b.place);
  $("panel").innerHTML = `<div class="res"><h1><small>${esc(t.name)} · ${mode === "tt" ? "time trial" : "race"}</small>${mode === "tt" ? "Trial done" : k.place === 1 ? "You win" : `${ordinal(k.place)} place`}</h1><div class="big">${mode === "tt" ? fmtTime(k.bestLap) : ordinal(k.place)}</div><p>race time <b>${fmtTime(k.total)}</b></p><p>best lap <b>${fmtTime(k.bestLap)}</b>${best[trackKey]?.lap === k.bestLap ? " · your best on this track" : ""}</p>
    <table>${rows.map((r) => `<tr class="${r === k ? "me" : ""}"><td>${ordinal(r.place)}</td><td>${esc(r.name)}${r.bot ? " <small style='color:var(--dim)'>bot</small>" : ""}</td><td class="n">${fmtTime(r.total)}</td><td class="n">lap ${fmtTime(r.bestLap)}</td></tr>`).join("")}</table>
    <button class="go" data-go="1">Race again</button><button class="go ghost" data-tab="play">Menu</button></div>`;
  for (const b of document.querySelectorAll("[data-tab]")) b.classList.remove("on"); $("resumeBtn").hidden = true; $("over").hidden = false;
}
$("over").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return; audioOn(); SFX.click();
  if (b.dataset.resume) return resumeGame();
  if (b.dataset.tab) return showMenu(b.dataset.tab);
  if (b.dataset.track) { trackKey = b.dataset.track; return drawMenu(); }
  if (b.dataset.mode) { mode = b.dataset.mode; return drawMenu(); }
  if (b.dataset.go) { const nm = $("nm"); if (nm) { try { localStorage.setItem(NAME_KEY, nm.value.trim() || "You"); } catch {} } return startRace(); }
});
$("over").addEventListener("keydown", (e) => e.stopPropagation());
// an empty scene behind the menu
buildTrackScene(buildTrack(trackKey)); camera.position.set(0, 40, 120); camera.lookAt(0, 0, 0);
showMenu("play"); requestAnimationFrame(frame);
window.__kart = { get race() { return race; }, start: startRace, setTrack(k) { trackKey = k; }, setMode(m) { mode = m; }, keys, camera, renderer, scene, sim(sec) { if (!race) return; const ev = []; for (let i = 0; i < sec * 60; i++) stepRace(race, inputFor, KART.STEP, Math.random, ev); for (const e of ev) onEvent(e); }, showMenu, hideHud(on) { for (const el of document.querySelectorAll(".hud > *")) el.style.visibility = on ? "hidden" : ""; } };

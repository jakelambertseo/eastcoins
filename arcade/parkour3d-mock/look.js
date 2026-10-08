/* Parkour's textures and sounds (2026-10-07, the owner: "can you add some free textures to the floors/walls/space/character etc, with
   some sounds as well").

   Nothing is downloaded: every texture is DRAWN here on a canvas when the page loads, and every sound is SYNTHESISED with Web Audio
   when it plays. So there is no licence to track, no file to fetch, and each map can tint the same greyscale textures its own colours.
   The surface textures are greyscale on purpose (the material's colour multiplies them); the sky, lava, chequer, hazard and the
   jersey carry their own colours. */
import * as THREE from "three";

/* ------------------------------------------------------------------ a tiny seeded random, so a texture looks the same every load */
function rng(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const cache = {};
function make(key, size, draw, { tile = true, w = size, h = size } = {}) {
  if (cache[key]) return cache[key];
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h, rng(key.length * 7919 + key.charCodeAt(0) * 31));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (tile) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache[key] = t);
}
const grey = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
function speckle(g, w, h, r, n, lo, hi, a = 0.5, size = 2) { for (let i = 0; i < n; i++) { g.fillStyle = grey(Math.round(lo + r() * (hi - lo)), a); g.fillRect(r() * w, r() * h, size, size); } }

/* ------------------------------------------------------------------ the surfaces (greyscale, tinted by the map) */
export const SURFACES = {
  // roof tiles: four slabs a texture, grit, dark grout, a light bevel
  tiles: () => make("tiles", 256, (g, w, h, r) => {
    g.fillStyle = grey(214); g.fillRect(0, 0, w, h); speckle(g, w, h, r, 2600, 150, 250, 0.35);
    g.strokeStyle = grey(120); g.lineWidth = 6; for (const v of [0, 128, 256]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, h); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(w, v); g.stroke(); }
    g.strokeStyle = grey(245, 0.6); g.lineWidth = 2; for (const v of [5, 133]) { g.beginPath(); g.moveTo(v, 4); g.lineTo(v, h); g.stroke(); g.beginPath(); g.moveTo(4, v); g.lineTo(w, v); g.stroke(); }
  }),
  // diamond plate: rows of raised diamonds with a lit edge and a shadow
  plate: () => make("plate", 256, (g, w, h, r) => {
    const base = g.createLinearGradient(0, 0, w, h); base.addColorStop(0, grey(200)); base.addColorStop(1, grey(178)); g.fillStyle = base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 900, 150, 240, 0.25, 1);
    for (let y = 0; y < h + 32; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w + 32; x += 32) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4 * ((y / 32) % 2 ? 1 : -1));
      g.fillStyle = grey(110, 0.6); g.fillRect(-9, -2, 20, 6); g.fillStyle = grey(245); g.fillRect(-10, -3, 20, 5); g.restore();
    }
  }),
  // brick: offset courses, mortar, each brick its own shade
  brick: () => make("brick", 256, (g, w, h, r) => {
    g.fillStyle = grey(150); g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const x = col * 64 + (row % 2 ? 32 : 0) + 3, y = row * 32 + 3, v = Math.round(180 + r() * 50);
      g.fillStyle = grey(v); g.fillRect(x, y, 58, 26); g.fillStyle = grey(255, 0.25); g.fillRect(x, y, 58, 3); g.fillStyle = grey(60, 0.25); g.fillRect(x, y + 23, 58, 3);
    }
    speckle(g, w, h, r, 1800, 120, 240, 0.3);
  }),
  // volcanic rock: blotches and cracks
  rock: () => make("rock", 256, (g, w, h, r) => {
    g.fillStyle = grey(190); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h, rad = 6 + r() * 26, v = Math.round(140 + r() * 100); const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, grey(v, 0.9)); gr.addColorStop(1, grey(v, 0)); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    g.strokeStyle = grey(70, 0.7); g.lineWidth = 2;
    for (let i = 0; i < 18; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    speckle(g, w, h, r, 2000, 100, 250, 0.3);
  }),
  // sci-fi hex panels
  hex: () => make("hex", 256, (g, w, h, r) => {
    g.fillStyle = grey(205); g.fillRect(0, 0, w, h); speckle(g, w, h, r, 700, 170, 240, 0.25, 1);
    const R = 32, hh = Math.sqrt(3) * R;
    g.lineWidth = 4; g.strokeStyle = grey(110);
    for (let row = -1; row < h / hh + 1; row++) for (let col = -1; col < w / (R * 1.5) + 1; col++) {
      const cx = col * R * 1.5, cy = row * hh + (col % 2 ? hh / 2 : 0);
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); } g.closePath(); g.stroke();
      g.fillStyle = grey(240, 0.5); g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    }
  }),
  // platform sides: a bright lip along the top, dark body with grain
  trim: () => make("trim", 256, (g, w, h, r) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, grey(250)); gr.addColorStop(0.16, grey(235)); gr.addColorStop(0.2, grey(120)); gr.addColorStop(1, grey(90));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = grey(70, 0.35); g.lineWidth = 1; for (let i = 0; i < 40; i++) { const x = r() * w; g.beginPath(); g.moveTo(x, h * 0.22); g.lineTo(x + (r() - 0.5) * 6, h); g.stroke(); }
    g.fillStyle = grey(40, 0.6); g.fillRect(0, h * 0.2, w, 3);
  })
};

/* ------------------------------------------------------------------ the coloured ones */
export const COLOURED = {
  checker: () => make("checker", 256, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? "#111" : "#f4f4f4"; g.fillRect(x * 32, y * 32, 32, 32); } }),
  hazard: () => make("hazard", 128, (g, w, h) => { g.fillStyle = "#ffd23a"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a1a1a"; for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * 48, 0); g.lineTo(k * 48 + 24, 0); g.lineTo(k * 48 + 24 + h, h); g.lineTo(k * 48 + h, h); g.fill(); } }),
  belt: () => make("belt", 128, (g, w, h) => { g.fillStyle = "#2a2a32"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ffd23a"; g.lineWidth = 8; for (const y of [24, 88]) { g.beginPath(); g.moveTo(16, y + 20); g.lineTo(64, y - 4); g.lineTo(112, y + 20); g.stroke(); } g.fillStyle = "#444"; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); }),
  // the same belt turned a quarter, for a belt that runs along x
  beltX: () => make("beltX", 128, (g, w, h) => { g.fillStyle = "#2a2a32"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ffd23a"; g.lineWidth = 8; for (const x of [24, 88]) { g.beginPath(); g.moveTo(x + 20, 16); g.lineTo(x - 4, 64); g.lineTo(x + 20, 112); g.stroke(); } g.fillStyle = "#444"; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); }),
  lava: () => make("lava", 256, (g, w, h, r) => {
    g.fillStyle = "#5a0a00"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, rad = 10 + r() * 34; for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); gr.addColorStop(0, `rgba(255,${180 + r() * 60 | 0},60,0.95)`); gr.addColorStop(0.5, "rgba(255,90,20,0.6)"); gr.addColorStop(1, "rgba(120,10,0,0)"); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); } }
    g.strokeStyle = "rgba(30,0,0,0.6)"; g.lineWidth = 3; for (let i = 0; i < 14; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  }),
  // the bean: a football jersey, gold with burgundy stripes and a number front and back
  jersey: (num = "1", base = "#ffd23a", stripe = "#7a1a2a") => make(`jersey${num}${base}`, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; g.fillRect(0, h * 0.30, w, 14); g.fillRect(0, h * 0.30 + 22, w, 6);   // chest stripes
    g.fillStyle = "#ffffff"; g.fillRect(0, h * 0.30 + 14, w, 8);
    g.fillStyle = stripe; g.fillRect(0, h * 0.86, w, h * 0.14);                                   // shorts line
    g.font = "900 70px Georgia, serif"; g.textAlign = "center"; g.lineWidth = 6; g.strokeStyle = stripe; g.fillStyle = "#ffffff";
    for (const x of [w * 0.25, w * 0.75]) { g.strokeText(num, x, h * 0.72); g.fillText(num, x, h * 0.72); }
  }, { tile: false }),
  flag: () => make("flag", 128, (g, w, h) => { g.fillStyle = "#5ae0c0"; g.fillRect(0, 0, w, h); g.fillStyle = "#0a3a30"; g.font = "900 46px Georgia, serif"; g.textAlign = "center"; g.fillText("EC", w / 2, h * 0.68); }, { tile: false }),
  // the sky: a gradient from the map's colour, nebula clouds, stars. Equirectangular, on the inside of a big sphere.
  sky: (hex) => make(`sky${hex}`, 1024, (g, w, h, r) => {
    const c = new THREE.Color(hex), top = c.clone().multiplyScalar(0.45), hor = c.clone().lerp(new THREE.Color(0xff6ad0), 0.35).multiplyScalar(1.5);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `#${top.getHexString()}`); gr.addColorStop(0.55, `#${c.getHexString()}`); gr.addColorStop(0.62, `#${hor.getHexString()}`); gr.addColorStop(1, `#${top.getHexString()}`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const hues = [0xff6ad0, 0x6ad0ff, 0xffd84a, 0xc48aff];
    for (let i = 0; i < 46; i++) { const x = r() * w, y = h * (0.12 + r() * 0.45), rad = 40 + r() * 150, col = new THREE.Color(hues[i % 4]); const ng = g.createRadialGradient(x, y, 0, x, y, rad); ng.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},0.16)`); ng.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = ng; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    for (let i = 0; i < 1400; i++) { const y = r() * h * 0.6, s = r() < 0.04 ? 2.4 : 1.1; g.fillStyle = `rgba(255,${235 + r() * 20 | 0},${200 + r() * 55 | 0},${0.4 + r() * 0.6})`; g.fillRect(r() * w, y, s, s); }
  }, { w: 2048, h: 1024 })
};

/** A material per face of a box: the top textured and tinted, the sides trimmed, the bottom dark. Repeats scale with the box, so a
    tile is the same size on a small ledge as on a big roof. */
export function boxMaterials(hx, hy, hz, color, { top = "tiles", side = "trim", topColoured = false, emissive = 0x000000 } = {}) {
  const tinted = (name, rx, ry) => { const t = SURFACES[name]().clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  const coloured = (name, rx, ry) => { const t = COLOURED[name]().clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  const TILE = 2.5;
  const topMap = topColoured ? coloured(top, Math.max(1, hx * 2 / TILE), Math.max(1, hz * 2 / TILE)) : tinted(top, Math.max(0.5, hx * 2 / TILE), Math.max(0.5, hz * 2 / TILE));
  const mk = (map, c = color) => new THREE.MeshStandardMaterial({ color: c, map, roughness: 0.7, metalness: 0.05, transparent: true, emissive });
  const topMat = mk(topMap, topColoured ? 0xffffff : color);
  const sideX = mk(tinted(side, Math.max(0.5, hz * 2 / TILE), 1)), sideZ = mk(tinted(side, Math.max(0.5, hx * 2 / TILE), 1));
  const bottom = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.35), roughness: 0.9, transparent: true });
  return { list: [sideX, sideX, topMat, bottom, sideZ, sideZ], top: topMat };
}

/* ================================================================== SOUND: all synthesised, nothing loaded */
export const Sfx = (() => {
  let ctx = null, master = null, amb = null, noiseBuf = null;
  let muted = false, vol = 1; try { muted = localStorage.getItem("ecParkourMute") === "1"; } catch {}
  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55 * vol; master.connect(ctx.destination);
    } catch { ctx = null; }
  }
  const noise = () => { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; };
  function tone({ f = 440, f2 = 0, type = "square", dur = 0.12, vol = 0.15, delay = 0 }) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss({ dur = 0.15, vol = 0.15, f = 800, f2 = 0, q = 0.8, type = "lowpass", delay = 0 }) {
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(); s.playbackRate.value = 0.8 + Math.random() * 0.4;
    fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const SOUNDS = {
    step: () => hiss({ dur: 0.06, vol: 0.05, f: 900 + Math.random() * 600, type: "bandpass", q: 1.2 }),
    jump: () => { tone({ f: 330, f2: 620, type: "square", dur: 0.11, vol: 0.07 }); hiss({ dur: 0.08, vol: 0.05, f: 2000, type: "highpass" }); },
    kick: () => { tone({ f: 520, f2: 980, type: "triangle", dur: 0.12, vol: 0.12 }); hiss({ dur: 0.18, vol: 0.08, f: 600, f2: 2600, type: "bandpass", q: 2 }); },
    dive: () => hiss({ dur: 0.3, vol: 0.12, f: 400, f2: 2200, type: "bandpass", q: 1.4 }),
    land: (k = 0.5) => { hiss({ dur: 0.12, vol: 0.06 + 0.16 * k, f: 260, type: "lowpass" }); tone({ f: 110, f2: 55, type: "sine", dur: 0.12, vol: 0.1 + 0.2 * k }); },
    bonk: () => { tone({ f: 220, f2: 70, type: "sine", dur: 0.25, vol: 0.3 }); hiss({ dur: 0.1, vol: 0.12, f: 1200, type: "bandpass" }); },
    checkpoint: () => { tone({ f: 523, type: "triangle", dur: 0.16, vol: 0.14 }); tone({ f: 784, type: "triangle", dur: 0.3, vol: 0.14, delay: 0.11 }); },
    fall: () => tone({ f: 620, f2: 110, type: "sawtooth", dur: 0.55, vol: 0.07 }),
    beep: () => tone({ f: 440, type: "square", dur: 0.12, vol: 0.08 }),
    go: () => tone({ f: 880, type: "square", dur: 0.28, vol: 0.09 }),
    finish: (medal) => {
      [523, 659, 784, 1046].forEach((f, k) => tone({ f, type: "triangle", dur: 0.22, vol: 0.13, delay: k * 0.1 }));
      if (medal) [1318, 1568, 2093].forEach((f, k) => tone({ f, type: "sine", dur: 0.18, vol: 0.06, delay: 0.45 + k * 0.07 }));
    },
    blinkOff: () => tone({ f: 300, f2: 180, type: "sine", dur: 0.1, vol: 0.04 })
  };
  /* the bed under it all: wind for every map, a low rumble over the lava */
  function ambience(kind) {
    if (!ctx) return;
    if (amb) { try { amb.forEach((n) => n.stop?.()); } catch {} amb = null; }
    const nodes = [];
    const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 380; fl.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 160; lfo.connect(lg).connect(fl.frequency);
    s.connect(fl).connect(g).connect(master); s.start(); lfo.start(); nodes.push(s, lfo);
    if (kind === "lava") {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = 46; og.gain.value = 0.06;
      const wob = ctx.createOscillator(), wg = ctx.createGain(); wob.frequency.value = 0.5; wg.gain.value = 0.03; wob.connect(wg).connect(og.gain);
      o.connect(og).connect(master); o.start(); wob.start(); nodes.push(o, wob);
    }
    amb = nodes;
  }
  return {
    ensure,
    play(name, arg) { if (!ctx || muted) return; try { SOUNDS[name]?.(arg); } catch {} },
    ambience(kind) { if (ctx) ambience(kind); else this._pending = kind; },
    startPending() { if (ctx && this._pending) { ambience(this._pending); this._pending = null; } },
    toggle() { muted = !muted; try { localStorage.setItem("ecParkourMute", muted ? "1" : "0"); } catch {} if (master) master.gain.value = muted ? 0 : 0.55 * vol; return muted; },
    // (2026-10-07) the Arcade's settings drive this: volume 0..1 and mute, without touching the old per-game mute key
    setVolume(v, mute = muted) { vol = Math.max(0, Math.min(1, v)); muted = mute; if (master) master.gain.value = muted ? 0 : 0.55 * vol; },
    get muted() { return muted; }, get running() { return Boolean(ctx); }
  };
})();

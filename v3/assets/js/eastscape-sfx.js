/* ============================================================
   EastScape sound — every sound effect in the game, by name

   The sounds are MADE here, not downloaded: each one is a little recipe (a wave, a pitch sweep, an envelope, a few
   notes) rendered to audio the first time it plays, so the whole library costs nothing to load. Retro on purpose, to
   sit with the pixel art.

   Swapping a sound for a real recording later is one line: give its entry a `file` (a URL to an .ogg/.mp3/.wav) and
   that file is fetched and used instead of the recipe. Every call site stays the same.

   Browsers won't play audio before the player has clicked or pressed a key, so nothing plays until then.
   On/off and volume live in this browser (localStorage), not on the account: sound is a per-device thing.
   ============================================================ */

const RATE = 22050;
// note names -> Hz, for the jingles
const N = (n) => 440 * 2 ** ((n - 69) / 12);
const C5 = N(72), D5 = N(74), E5 = N(76), F5 = N(77), G5 = N(79), A5 = N(81), B5 = N(83), C6 = N(84), E6 = N(88), G6 = N(91), C7 = N(96);

/* A layer: { w: "square"|"saw"|"sine"|"tri"|"noise", f: start Hz, f2: end Hz, a/s/d: attack/sustain/decay seconds,
   t: start offset, v: volume, lp/hp: filter cutoffs, duty: square width, vib: [depth, Hz] }.
   A sound is one layer or a list of them. */
const tone = (f, t, d, v = 0.3, w = "square", extra = {}) => ({ w, f, t, d, v, ...extra });
const notes = (list, step, d, v, w = "square", extra = {}) => list.map((f, i) => tone(f, i * step, d, v, w, extra));
const ticks = (n, every, extra = {}) => Array.from({ length: n }, (_, i) => ({ w: "noise", t: i * every, d: 0.025, v: 0.35, lp: 3500, ...extra }));

export const SOUNDS = {
  // the interface
  ui_click:   { vol: 0.35, layers: [tone(1100, 0, 0.035, 0.25, "square", { f2: 850, duty: 0.5, lp: 5000 })] },
  ui_open:    { vol: 0.35, layers: [tone(480, 0, 0.09, 0.3, "tri", { f2: 900 })] },
  ui_close:   { vol: 0.35, layers: [tone(820, 0, 0.08, 0.3, "tri", { f2: 430 })] },
  ui_error:   { vol: 0.4, layers: [tone(220, 0, 0.12, 0.25, "square", { f2: 165, s: 0.03, lp: 2400 })] },
  chat:       { vol: 0.25, layers: [tone(880, 0, 0.06, 0.2, "sine"), tone(1320, 0.05, 0.07, 0.15, "sine")] },
  // the bag
  pickup:     { vol: 0.4, layers: [tone(700, 0, 0.07, 0.25, "sine", { f2: 1100 }), tone(1250, 0.05, 0.08, 0.2, "sine")] },
  drop:       { vol: 0.4, layers: [tone(420, 0, 0.1, 0.3, "tri", { f2: 190 })] },
  equip:      { vol: 0.45, layers: [{ w: "noise", d: 0.05, v: 0.3, lp: 3200 }, tone(320, 0.01, 0.08, 0.25, "square", { f2: 520, duty: 0.3, lp: 3000 })] },
  eat:        { vol: 0.45, layers: ticks(3, 0.09, { d: 0.045, lp: 1600, v: 0.4 }) },
  gain:       { vol: 0.3, layers: [tone(880, 0, 0.1, 0.18, "sine", { f2: 1320 })] },
  // gathering and making
  chop:       { vol: 0.5, layers: [{ w: "noise", d: 0.09, v: 0.45, lp: 2200 }, tone(190, 0, 0.09, 0.35, "tri", { f2: 85 })] },
  mine:       { vol: 0.45, layers: [tone(1850, 0, 0.06, 0.2, "square", { f2: 1450, duty: 0.25 }), { w: "noise", d: 0.05, v: 0.3, lp: 6000, hp: 1200 }] },
  cast:       { vol: 0.4, layers: [{ w: "noise", a: 0.03, d: 0.28, v: 0.25, lp: 5000, hp: 1800 }] },
  splash:     { vol: 0.4, layers: [{ w: "noise", d: 0.3, v: 0.35, lp: 2400 }] },
  cook:       { vol: 0.35, layers: [{ w: "noise", a: 0.02, s: 0.2, d: 0.2, v: 0.2, lp: 4500, hp: 1600 }] },
  smelt:      { vol: 0.45, layers: [{ w: "noise", a: 0.06, s: 0.2, d: 0.25, v: 0.45, lp: 700 }] },
  anvil:      { vol: 0.4, layers: [tone(1480, 0, 0.3, 0.22, "square", { duty: 0.15 }), tone(2960, 0, 0.4, 0.12, "sine"), { w: "noise", d: 0.03, v: 0.3, lp: 5000 }] },
  pick:       { vol: 0.35, layers: [tone(620, 0, 0.05, 0.22, "tri", { f2: 820 })] },
  // fighting
  swing:      { vol: 0.35, layers: [{ w: "noise", a: 0.01, d: 0.12, v: 0.3, lp: 5000, hp: 1400 }] },
  hit:        { vol: 0.5, layers: [{ w: "noise", d: 0.08, v: 0.45, lp: 1800 }, tone(150, 0, 0.09, 0.3, "square", { f2: 60, lp: 1500 })] },
  miss:       { vol: 0.3, layers: [{ w: "noise", d: 0.05, v: 0.2, lp: 7000, hp: 3000 }] },
  hurt:       { vol: 0.45, layers: [tone(300, 0, 0.15, 0.3, "square", { f2: 120, lp: 1800 })] },
  mob_die:    { vol: 0.45, layers: [tone(420, 0, 0.35, 0.28, "square", { f2: 60, lp: 2000 }), { w: "noise", d: 0.22, v: 0.25, lp: 1000 }] },
  die:        { vol: 0.5, layers: [tone(400, 0, 0.8, 0.3, "saw", { f2: 45, s: 0.2, lp: 1500 })] },
  // getting better at things
  levelup:    { vol: 0.5, layers: [...notes([C5, E5, G5], 0.1, 0.12, 0.28, "square", { duty: 0.25 }), tone(C6, 0.3, 0.45, 0.3, "square", { duty: 0.25, vib: [0.01, 6] }), ...notes([E5, G5, C6], 0.1, 0.12, 0.12, "tri"), tone(E6, 0.3, 0.45, 0.14, "tri")] },
  task_done:  { vol: 0.45, layers: [...notes([G5, C6], 0.1, 0.12, 0.26, "square", { duty: 0.3 }), tone(E6, 0.2, 0.35, 0.26, "square", { duty: 0.3 })] },
  idle_stop:  { vol: 0.35, layers: [tone(660, 0, 0.3, 0.2, "sine"), tone(440, 0.16, 0.4, 0.2, "sine")] },
  // money and places
  coins:      { vol: 0.4, layers: [tone(1318, 0, 0.07, 0.2, "square", { duty: 0.3 }), tone(1760, 0.07, 0.3, 0.2, "square", { duty: 0.3 })] },
  door:       { vol: 0.45, layers: [{ w: "noise", a: 0.01, d: 0.12, v: 0.35, lp: 900 }, tone(120, 0.02, 0.16, 0.3, "tri", { f2: 80 })] },
  // the Casino
  chip:       { vol: 0.4, layers: [tone(2500, 0, 0.03, 0.2, "square", { f2: 2000 }), { w: "noise", d: 0.02, v: 0.2, hp: 4000 }] },
  slots_spin: { vol: 0.3, loop: 0.56, layers: ticks(8, 0.07, { v: 0.3, lp: 3000 }) },
  reel_stop:  { vol: 0.45, layers: [tone(180, 0, 0.06, 0.35, "square", { f2: 120, lp: 2000 }), { w: "noise", d: 0.04, v: 0.3, lp: 1500 }] },
  win_small:  { vol: 0.45, layers: notes([E5, G5, C6], 0.08, 0.1, 0.25, "square", { duty: 0.3 }) },
  win_big:    { vol: 0.5, layers: [...notes([C5, E5, G5, C6, E6, G6], 0.07, 0.1, 0.26, "square", { duty: 0.25 }), tone(C7, 0.42, 0.5, 0.22, "square", { duty: 0.25, vib: [0.012, 7] })] },
  jackpot:    { vol: 0.55, layers: [...[0, 0.5, 1].flatMap((o) => notes([C5, E5, G5, C6, E6, G6], 0.06, 0.09, 0.24, "square", { duty: 0.25 }).map((l) => ({ ...l, t: l.t + o }))), tone(C7, 1.4, 0.9, 0.24, "square", { duty: 0.25, vib: [0.015, 8] })] },
  lose:       { vol: 0.35, layers: [tone(330, 0, 0.28, 0.22, "tri", { f2: 210, vib: [0.02, 5] })] },
  coin_flip:  { vol: 0.35, layers: [0, 0.11, 0.2, 0.27, 0.32].map((t, i) => tone(2100 - i * 120, t, 0.06, 0.15, "sine")) },
  dice:       { vol: 0.45, layers: [0, 0.06, 0.1, 0.17, 0.21, 0.3].map((t, i) => ({ w: "noise", t, d: 0.03 + (i % 2) * 0.02, v: 0.35, lp: 3200 })) },
  roul_ball:  { vol: 0.25, loop: 0.48, layers: [{ w: "noise", s: 0.48, v: 0.12, lp: 3800, hp: 1500 }, ...ticks(6, 0.08, { v: 0.18, lp: 5000, hp: 2000, d: 0.015 })] },
  roul_drop:  { vol: 0.45, layers: [tone(2200, 0, 0.02, 0.25, "square"), tone(1900, 0.09, 0.02, 0.22, "square"), tone(1700, 0.2, 0.03, 0.2, "square"), tone(140, 0.24, 0.12, 0.3, "tri", { f2: 90 })] }
  // To use a recording instead: e.g.  door: { file: "/v3/assets/sfx/door.ogg", vol: 0.5 },
};

let ac = null, master = null, on = true, vol = 0.6;
const bufs = new Map(), last = new Map();
try { on = localStorage.getItem("es_sfx") !== "0"; const v = parseFloat(localStorage.getItem("es_vol")); if (Number.isFinite(v)) vol = v; } catch (e) { /* private mode */ }

// the first click or key unlocks audio (browsers insist)
function unlock() {
  if (ac) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination); } catch (e) { ac = null; }
}
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, unlock, { once: true, capture: true });

export const enabled = () => on;
export const volume = () => vol;
export function setEnabled(v) { on = !!v; try { localStorage.setItem("es_sfx", on ? "1" : "0"); } catch (e) { /* fine */ } }
export function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; try { localStorage.setItem("es_vol", String(vol)); } catch (e) { /* fine */ } }

function render(def) {
  const len = Math.ceil(RATE * (def.loop || Math.max(...def.layers.map((l) => (l.t || 0) + (l.a || 0) + (l.s || 0) + (l.d || 0.1))) + 0.02));
  const out = new Float32Array(len);
  for (const L of def.layers) {
    const start = Math.floor((L.t || 0) * RATE), a = (L.a || 0) * RATE, s = (L.s || 0) * RATE, d = (L.d || 0.1) * RATE, n = Math.min(len - start, Math.ceil(a + s + d));
    let ph = 0, lpY = 0, hpY = 0, hpX = 0, noise = 0, nt = 0;
    const lpK = L.lp ? 1 - Math.exp((-2 * Math.PI * L.lp) / RATE) : 1, hpK = L.hp ? Math.exp((-2 * Math.PI * L.hp) / RATE) : 0;
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n - 1), env = i < a ? i / a : i < a + s ? 1 : 1 - (i - a - s) / d;
      let f = L.f ? (L.f2 ? L.f * (L.f2 / L.f) ** k : L.f) : 0;
      if (L.vib) f *= 1 + L.vib[0] * Math.sin((2 * Math.PI * L.vib[1] * i) / RATE);
      ph = (ph + f / RATE) % 1;
      let x;
      switch (L.w) {
        case "noise": if (++nt > 1) { nt = 0; noise = Math.random() * 2 - 1; } x = noise; break;
        case "sine": x = Math.sin(2 * Math.PI * ph); break;
        case "tri": x = 1 - 4 * Math.abs(ph - 0.5); break;
        case "saw": x = 2 * ph - 1; break;
        default: x = ph < (L.duty || 0.5) ? 0.8 : -0.8;
      }
      lpY += lpK * (x - lpY); x = lpY;
      if (L.hp) { const y = hpK * (hpY + x - hpX); hpX = x; hpY = y; x = y; }
      out[start + i] += x * Math.max(0, env) * (L.v ?? 0.3);
    }
  }
  const b = ac.createBuffer(1, len, RATE); b.copyToChannel(out, 0); return b;
}
async function bufferOf(name) {
  if (bufs.has(name)) return bufs.get(name);
  const def = SOUNDS[name]; let b = null;
  if (def.file) { try { b = await ac.decodeAudioData(await (await fetch(def.file)).arrayBuffer()); } catch (e) { b = null; } }
  if (!b && def.layers) b = render(def);
  bufs.set(name, b); return b;
}

/* play a sound by name. { vol, rate, jitter } adjust one playing; returns a handle whose stop() ends a loop early.
   The same sound can't fire more than once every 40ms, so a burst of events stays a sound, not a buzz. */
export function play(name, o = {}) {
  const def = SOUNDS[name]; if (!on || !def) return { stop() {} };
  unlock(); if (!ac) return { stop() {} };
  if (ac.state === "suspended") ac.resume();
  const now = performance.now(); if (now - (last.get(name) || 0) < 40) return { stop() {} }; last.set(name, now);
  let src = null, stopped = false;
  bufferOf(name).then((b) => {
    if (!b || stopped) return;
    src = ac.createBufferSource(); src.buffer = b; src.loop = !!def.loop;
    const j = o.jitter ?? (def.loop ? 0 : 0.05); src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * j);
    const g = ac.createGain(); g.gain.value = (def.vol ?? 0.4) * (o.vol ?? 1);
    src.connect(g); g.connect(master); src.start();
  });
  return { stop() { stopped = true; try { src?.stop(); } catch (e) { /* already ended */ } } };
}

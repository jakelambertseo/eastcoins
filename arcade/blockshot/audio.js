/* Blockshot's sounds: all synthesised, no files (2026-10-08, the owner: "free sounds"). WebAudio: a noise burst shaped by a filter is a
   gunshot, a sine with a fast decay is a tick, a couple of notes is a chime. Volume is one setting; other people's shots fade with
   distance. A real sound pack can replace any of these one by one: `play(name, gain)` is the only door. */
let ac = null, master = null, vol = 0.8;
const ensure = () => {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination); } catch { return null; } }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
};
export const setVolume = (v) => { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; };
export { ensure };

/** Where a sound sits left-right (-1..1): a panner between the gain and the master, only when asked for. */
const out = (a, g, pan) => { if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(master); } else g.connect(master); };
function tone({ f = 440, to = 0, dur = 0.1, type = "sine", gain = 0.1, delay = 0, pan = 0 }) {
  const a = ensure(); if (!a) return; const t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur); o.connect(g); out(a, g, pan); o.start(t0); o.stop(t0 + dur + 0.02);
}
const buffers = new Map();   // one buffer per (length, decay), made on first use: a shot used to build a fresh one every time
function noise({ dur = 0.1, gain = 0.2, lp = 2000, hp = 0, decay = 2, delay = 0, pan = 0 }) {
  const a = ensure(); if (!a) return; const t0 = a.currentTime + delay, key = `${dur}:${decay}`;
  let buf = buffers.get(key);
  if (!buf) { const n = Math.floor(a.sampleRate * dur); buf = a.createBuffer(1, n, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); buffers.set(key, buf); }
  const s = a.createBufferSource(); s.buffer = buf; const g = a.createGain(); g.gain.value = gain;
  let node = s; if (lp) { const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; node.connect(f); node = f; } if (hp) { const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; node.connect(f); node = f; }
  node.connect(g); out(a, g, pan); s.start(t0);
}
const SOUNDS = {
  alarm: () => { for (let i = 0; i < 4; i++) tone({ f: i % 2 ? 620 : 880, dur: 0.14, type: "square", gain: 0.08, delay: i * 0.15 }); },
  last: () => { noise({ dur: 0.3, gain: 0.35, lp: 220, decay: 2 }); tone({ f: 220, to: 440, dur: 0.6, type: "triangle", gain: 0.1, delay: 0.1 }); },
  planted: () => { for (let i = 0; i < 3; i++) tone({ f: 1200, dur: 0.08, type: "square", gain: 0.09, delay: i * 0.16 }); },
  defused: () => { [880, 1175, 1568].forEach((f, i) => tone({ f, dur: 0.18, type: "triangle", gain: 0.1, delay: i * 0.1 })); },
  boom: () => { noise({ dur: 1.2, gain: 0.9, lp: 300, decay: 1.5 }); tone({ f: 70, to: 25, dur: 1.0, type: "sine", gain: 0.3 }); noise({ dur: 0.5, gain: 0.4, lp: 2000, decay: 3 }); },
  tick: () => tone({ f: 1500, dur: 0.03, type: "square", gain: 0.05 }),
  ar: (k, pan) => { noise({ dur: 0.09, gain: 0.5 * k, lp: 2600, decay: 3, pan }); tone({ f: 180, to: 60, dur: 0.07, type: "square", gain: 0.12 * k, pan }); },
  sniper: (k, pan) => { noise({ dur: 0.35, gain: 0.7 * k, lp: 1800, decay: 2.5, pan }); tone({ f: 900, to: 90, dur: 0.25, type: "sawtooth", gain: 0.14 * k, pan }); noise({ dur: 0.5, gain: 0.12 * k, lp: 600, decay: 1.5, delay: 0.05, pan }); },
  shotgun: (k, pan) => { noise({ dur: 0.28, gain: 0.8 * k, lp: 1400, decay: 2, pan }); tone({ f: 120, to: 40, dur: 0.22, type: "square", gain: 0.2 * k, pan }); },
  step: (k, pan) => noise({ dur: 0.07, gain: 0.2 * k, lp: 700, hp: 120, decay: 2.5, pan }),   // someone else's footfall, placed left-right
  hit: () => tone({ f: 1400, dur: 0.05, type: "square", gain: 0.08 }),
  headshot: () => { tone({ f: 1800, dur: 0.07, type: "square", gain: 0.1 }); tone({ f: 2400, dur: 0.1, type: "square", gain: 0.08, delay: 0.05 }); },
  kill: () => { noise({ dur: 0.12, gain: 0.3, lp: 500, decay: 3 }); tone({ f: 660, dur: 0.12, type: "triangle", gain: 0.14 }); tone({ f: 990, dur: 0.2, type: "triangle", gain: 0.14, delay: 0.09 }); },
  killhs: () => { noise({ dur: 0.12, gain: 0.3, lp: 500, decay: 3 }); tone({ f: 880, dur: 0.1, type: "triangle", gain: 0.14 }); tone({ f: 1320, dur: 0.14, type: "triangle", gain: 0.14, delay: 0.07 }); tone({ f: 1760, dur: 0.22, type: "triangle", gain: 0.12, delay: 0.14 }); },
  top: () => { [784, 988, 1175, 1568].forEach((f, i) => tone({ f, dur: 0.16, type: "square", gain: 0.07, delay: i * 0.07 })); },
  hurt: () => { tone({ f: 160, to: 70, dur: 0.14, type: "sawtooth", gain: 0.1 }); noise({ dur: 0.08, gain: 0.15, lp: 900 }); },
  die: () => { tone({ f: 300, to: 60, dur: 0.5, type: "sawtooth", gain: 0.12 }); noise({ dur: 0.4, gain: 0.2, lp: 500 }); },
  health: () => { tone({ f: 660, dur: 0.12, type: "sine", gain: 0.1 }); tone({ f: 880, dur: 0.18, type: "sine", gain: 0.1, delay: 0.1 }); tone({ f: 1320, dur: 0.22, type: "sine", gain: 0.08, delay: 0.2 }); },
  ammo: () => { noise({ dur: 0.05, gain: 0.3, lp: 2500, decay: 3 }); tone({ f: 300, to: 420, dur: 0.07, type: "square", gain: 0.08, delay: 0.05 }); noise({ dur: 0.05, gain: 0.3, lp: 3000, decay: 3, delay: 0.14 }); },
  swap: () => { noise({ dur: 0.04, gain: 0.22, lp: 3500, decay: 3 }); tone({ f: 420, to: 640, dur: 0.08, type: "square", gain: 0.07, delay: 0.1 }); },
  reload: (k = 1) => { noise({ dur: 0.05, gain: 0.25 * k, lp: 3000, decay: 3 }); tone({ f: 500, to: 700, dur: 0.07, type: "square", gain: 0.09 * k }); noise({ dur: 0.06, gain: 0.3 * k, lp: 2500, decay: 3, delay: 0.5 * k }); tone({ f: 350, dur: 0.06, type: "square", gain: 0.08 * k, delay: 0.5 * k }); tone({ f: 800, to: 1100, dur: 0.08, type: "square", gain: 0.09 * k, delay: 1.0 * k }); noise({ dur: 0.05, gain: 0.3 * k, lp: 4000, decay: 3, delay: 1.0 * k }); },
  empty: () => tone({ f: 600, dur: 0.04, type: "square", gain: 0.05 }),
  jump: () => noise({ dur: 0.08, gain: 0.08, lp: 1200, hp: 300 }),
  slide: (k = 1) => noise({ dur: 0.28, gain: 0.12 * k, lp: 900, hp: 150, decay: 1 }),
  land: (k = 1) => { noise({ dur: 0.09, gain: 0.3 * k, lp: 500, decay: 3 }); tone({ f: 90, to: 50, dur: 0.1, type: "sine", gain: 0.12 * k }); },
  pad: () => { tone({ f: 300, to: 900, dur: 0.25, type: "triangle", gain: 0.12 }); noise({ dur: 0.15, gain: 0.1, lp: 1500 }); },
  spawn: () => { tone({ f: 440, dur: 0.1, type: "triangle", gain: 0.06 }); tone({ f: 660, dur: 0.12, type: "triangle", gain: 0.06, delay: 0.08 }); },
  streak: () => { for (let i = 0; i < 3; i++) tone({ f: 520 + i * 160, dur: 0.14, type: "square", gain: 0.07, delay: i * 0.08 }); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.22, type: "triangle", gain: 0.1, delay: i * 0.11 })); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, dur: 0.3, type: "triangle", gain: 0.1, delay: i * 0.13 })); },
  lose: () => { [440, 349, 262].forEach((f, i) => tone({ f, dur: 0.35, type: "triangle", gain: 0.08, delay: i * 0.18 })); },
  count: () => tone({ f: 880, dur: 0.08, type: "square", gain: 0.06 }),
  go: () => tone({ f: 1320, dur: 0.2, type: "square", gain: 0.08 }),
  click: () => tone({ f: 1000, dur: 0.03, type: "square", gain: 0.04 })
};
/** play("ar", 0.4): the name, and how loud (0..1, distance for other people's shots). */
const LOG = (window.__sndLog = []);   // the last sounds played, for checking a double from the console: __sndLog
export function play(name, k = 1, pan = 0) { const s = SOUNDS[name]; if (s && k > 0.02) { s(k, pan); LOG.push([name, Math.round(performance.now())]); if (LOG.length > 60) LOG.shift(); } }

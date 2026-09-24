/* EastScape: the fishing sounds —  node tools/eastscape-fish-audio.mjs [info]
   Sources (both CC0, OpenGameArt, downloaded 2026-09-21 into lt-audio/):
     Fisheefects by You're Perfect Studio / Memoraphile   https://opengameart.org/content/fisheefects          (wav: reel, splash, bloop, uhoh, point_normal, point_special)
     40 CC0 water / splash / slime SFX by rubberduck      https://opengameart.org/content/40-cc0-water-splash-slime-sfx   (ogg: splash_01..15, bubble_01..03, loops)
   There is no ffmpeg on this machine, so the WAVs are cut down here in plain JavaScript: mixed to mono, resampled to 22,050 Hz,
   trimmed to where the sound actually is, faded at both ends, peak-normalised, written as 16-bit WAV (every browser decodes that).
   The OGGs are small already and are copied as they are; a browser that can't decode OGG falls back to the old synthesized sound
   (eastscape-sfx.js does that by itself). `info` prints each source's length and where its sound sits, and writes nothing. */
import fs from "node:fs";
const SRC = "lt-audio/", OUT = "v3/assets/audio/fish/", RATE = 22050;
function readWav(file) {
  const b = fs.readFileSync(file); let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) { const id = b.toString("ascii", p, p + 4), len = b.readUInt32LE(p + 4); if (id === "fmt ") fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }; if (id === "data") data = b.subarray(p + 8, p + 8 + len); p += 8 + len + (len & 1); }
  if (!fmt || !data) throw new Error("not a wav: " + file); const bytes = fmt.bits / 8, n = Math.floor(data.length / (bytes * fmt.ch)), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) { const o = (i * fmt.ch + c) * bytes; s += fmt.tag === 3 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.bits === 24 ? data.readIntLE(o, 3) / 8388608 : fmt.bits === 32 ? data.readInt32LE(o) / 2147483648 : (data[o] - 128) / 128; } out[i] = s / fmt.ch; }
  return { fmt, x: out };
}
const resample = (x, from, to) => { if (from === to) return x; const n = Math.floor(x.length * to / from), y = new Float32Array(n), win = Math.max(1, Math.round(from / to)); for (let i = 0; i < n; i++) { const c = i * from / to, a = Math.floor(c); let s = 0, k = 0; for (let j = a; j < a + win && j < x.length; j++) { s += x[j]; k++; } y[i] = s / Math.max(1, k); } return y; };   // (a box filter before dropping samples: enough for effects)
const loudSpan = (x, rate, floor = 0.02) => { const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0), th = peak * floor; let a = 0, b = x.length - 1; while (a < b && Math.abs(x[a]) < th) a++; while (b > a && Math.abs(x[b]) < th) b--; return { peak, from: a / rate, to: b / rate }; };
function writeWav(file, x) { const b = Buffer.alloc(44 + x.length * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(x.length * 2, 40); for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2); fs.writeFileSync(file, b); return b.length; }
/** cut [from, to] seconds (null = where the sound is), at most `max` seconds, faded, peak to `gain` */
function cut(name, out, { from = null, to = null, max = 2, gain = 0.85, fadeOut = 0.08 } = {}) {
  const { fmt, x } = readWav(`${SRC}fish/${name}.wav`), span = loudSpan(x, fmt.rate), a = from ?? Math.max(0, span.from - 0.005), b = Math.min(to ?? span.to + 0.03, a + max);
  let y = resample(x.subarray(Math.floor(a * fmt.rate), Math.floor(b * fmt.rate)), fmt.rate, RATE); const peak = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1, fi = Math.floor(0.004 * RATE), fo = Math.floor(fadeOut * RATE);
  y = y.map((v, i) => (v / peak) * gain * Math.min(1, i / fi) * Math.min(1, (y.length - 1 - i) / fo)); const size = writeWav(`${OUT}${out}.wav`, y); console.log(`  ${out}.wav  ${(y.length / RATE).toFixed(2)} s  ${(size / 1024).toFixed(0)} KB   (from ${name}.wav ${a.toFixed(2)}-${b.toFixed(2)} s)`);
}
if (process.argv[2] === "info") {
  for (const f of fs.readdirSync(`${SRC}fish`).filter((n) => n.endsWith(".wav"))) { const { fmt, x } = readWav(`${SRC}fish/${f}`), s = loudSpan(x, fmt.rate), win = Math.floor(fmt.rate * 0.1), env = []; for (let i = 0; i + win <= x.length; i += win) { let m = 0; for (let j = i; j < i + win; j++) m = Math.max(m, Math.abs(x[j])); env.push(Math.round((m / (s.peak || 1)) * 9)); }
    console.log(`${f.padEnd(20)} ${fmt.ch}ch ${fmt.rate}Hz ${fmt.bits}bit  ${(x.length / fmt.rate).toFixed(2)} s  peak ${s.peak.toFixed(2)}  sound ${s.from.toFixed(2)}-${s.to.toFixed(2)} s\n   ${env.join("")}`); }
  for (const f of fs.readdirSync(`${SRC}water`)) console.log(`${f.padEnd(22)} ${(fs.statSync(`${SRC}water/${f}`).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });
const JOB = JSON.parse(fs.readFileSync("tools/eastscape-fish-audio.json", "utf8"));
for (const [name, out, o] of JOB.cut) cut(name, out, o || {});
for (const [from, out] of JOB.copy) { fs.copyFileSync(`${SRC}water/${from}`, `${OUT}${out}`); console.log(`  ${out}  ${(fs.statSync(`${OUT}${out}`).size / 1024).toFixed(0)} KB   (copied ${from})`); }

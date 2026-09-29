// Turns recorded .wav takes into what the game ships: mono, 22.05 kHz, 16-bit, silence trimmed off both ends, a short
// fade on the tail, and every take brought to the same peak so no one swing is louder than the next.
//   node tools/eastscape-sfx-import.mjs <source dir>
import fs from "node:fs"; import path from "node:path";
const SRC = process.argv[2], OUT = "v3/assets/sfx";
const MAP = [[/^chop (\d)\.wav$/i, "chop"], [/^mine (\d)\.wav$/i, "mine"], [/^sword attack (\d)\.wav$/i, "swing"], [/^sword impact hit (\d)\.wav$/i, "hit"]];
for (const f of fs.readdirSync(SRC)) {
  const m = MAP.map(([re, name]) => [f.match(re), name]).find(([x]) => x); if (!m) continue;
  const b = fs.readFileSync(path.join(SRC, f)), fmt = b.indexOf("fmt "), ch = b.readUInt16LE(fmt + 10), sr = b.readUInt32LE(fmt + 12), bits = b.readUInt16LE(fmt + 22), di = b.indexOf("data"), n = b.readUInt32LE(di + 4) / (ch * bits / 8);
  if (bits !== 16) { console.log("skipped (not 16-bit)", f); continue; }
  let x = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(di + 8 + (i * ch + c) * 2); x[i] = s / ch / 32768; }
  const step = Math.round(sr / 22050);   // 44.1k -> 22.05k: a 9-tap low-pass, then every other sample
  if (step > 1) { const k = [-0.016, 0, 0.102, 0.25, 0.328, 0.25, 0.102, 0, -0.016], y = new Float32Array(Math.floor(n / step)); for (let i = 0; i < y.length; i++) { let s = 0; for (let j = 0; j < 9; j++) s += (x[i * step + j - 4] || 0) * k[j]; y[i] = s; } x = y; }
  const peak = x.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1, gate = peak * 0.006; let a = 0, z = x.length - 1; while (a < z && Math.abs(x[a]) < gate) a++; while (z > a && Math.abs(x[z]) < gate) z--;
  a = Math.max(0, a - 40); z = Math.min(x.length - 1, z + 400); x = x.slice(a, z + 1);
  const fade = Math.min(x.length, 330); for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  const out = Buffer.alloc(44 + x.length * 2), rate = Math.round(sr / step); out.write("RIFF", 0); out.writeUInt32LE(36 + x.length * 2, 4); out.write("WAVEfmt ", 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round((x[i] / peak) * 0.89 * 32767))), 44 + i * 2);
  const name = `${m[1]}${m[0][1]}.wav`; fs.writeFileSync(path.join(OUT, name), out); console.log(f.padEnd(26), "->", name.padEnd(12), `${(x.length / rate).toFixed(2)}s`, `${Math.round(out.length / 1024)} KB (was ${Math.round(b.length / 1024)})`);
}

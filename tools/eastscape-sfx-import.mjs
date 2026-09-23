// Turns recorded .wav takes into what the game ships: mono, 22.05 kHz, 16-bit, silence trimmed off both ends, a short
// fade on the tail, and every take brought to the same peak so no one swing is louder than the next.
//   node tools/eastscape-sfx-import.mjs <source dir>
import fs from "node:fs"; import path from "node:path";
const SRC = process.argv[2], OUT = "v3/assets/sfx";
/* The take number is captured as (\d+) and run through Number() below, so both "chop 1.wav" and the pack's
   "Footsteps_Dirt_01.wav" land as take 1. Footsteps came in at 48 kHz stereo with a lot of silence either side
   (0.38s dirt, 0.86s grass, for a sound that is about a tenth of a second) — the trim is most of the win here. */
const MAP = [[/^chop (\d+)\.wav$/i, "chop"], [/^mine (\d+)\.wav$/i, "mine"], [/^sword attack (\d+)\.wav$/i, "swing"], [/^sword impact hit (\d+)\.wav$/i, "hit"],
  [/^Footsteps?_Dirt_(\d+)\.wav$/i, "stepdirt"], [/^Footsteps?_Floor_(\d+)\.wav$/i, "stepfloor"], [/^Footsteps?_Grass_(\d+)\.wav$/i, "stepgrass"],
  /* The 2026-09-23 combat pack. These OVERWRITE swing and hit, which were the owner's own earlier takes — asked
     for explicitly ("apply and overwrite whatever we have"). Damage is you being hit; the scream is a mob dying. */
  [/^GS1_Slash_(\d+)\.wav$/i, "swing", 0.6], [/^GS1_Hit_(\d+)\.wav$/i, "hit", 0.7],
  [/^GS1_Damage_(\d+)\.wav$/i, "hurt", 0.7], [/^GS1_Beast_Scream()\.wav$/i, "mobdie", 1.4],
  [/^UI_Button_Click_(\d+)\.wav$/i, "uiclick", 0.4],
  [/^UI2_Window_Open_(\d+)\.wav$/i, "uiopen", 0.6], [/^UI2_Window_Close_(\d+)\.wav$/i, "uiclose", 0.6], [/^UI2_Window_Error_(\d+)\.wav$/i, "uierror", 0.8]];
/* Takes are renumbered 1..N per sound, in filename order, rather than taking the number from the source: the
   pack's UI clicks arrive as 4..9 and `takes(name, n)` in eastscape-sfx.js always asks for 1..n. Feed a sound its
   whole set in one run, or the numbering shifts under it. */
const seq = new Map();
for (const f of fs.readdirSync(SRC).sort()) {
  const m = MAP.map(([re, name, max]) => [f.match(re), name, max]).find(([x]) => x); if (!m) continue;
  const b = fs.readFileSync(path.join(SRC, f)), fmt = b.indexOf("fmt "), ch = b.readUInt16LE(fmt + 10), sr = b.readUInt32LE(fmt + 12), bits = b.readUInt16LE(fmt + 22), di = b.indexOf("data"), n = b.readUInt32LE(di + 4) / (ch * bits / 8);
  if (bits !== 16) { console.log("skipped (not 16-bit)", f); continue; }
  let x = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(di + 8 + (i * ch + c) * 2); x[i] = s / ch / 32768; }
  const step = Math.round(sr / 22050);   // 44.1k -> 22.05k: a 9-tap low-pass, then every other sample
  if (step > 1) { const k = [-0.016, 0, 0.102, 0.25, 0.328, 0.25, 0.102, 0, -0.016], y = new Float32Array(Math.floor(n / step)); for (let i = 0; i < y.length; i++) { let s = 0; for (let j = 0; j < 9; j++) s += (x[i * step + j - 4] || 0) * k[j]; y[i] = s; } x = y; }
  const peak = x.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1, gate = peak * 0.006; let a = 0, z = x.length - 1; while (a < z && Math.abs(x[a]) < gate) a++; while (z > a && Math.abs(x[z]) < gate) z--;
  a = Math.max(0, a - 40); z = Math.min(x.length - 1, z + 400); x = x.slice(a, z + 1);
  /* A CAP, because a 3.8s reverb tail on a sword swing overlaps itself: the fastest weapon swings every 1800ms.
     The third MAP field is the longest a sound may be; it is cut there and faded over the last 60ms so the cut is
     not a click. Sounds without a cap keep whatever the trim left them. */
  if (m[2] && x.length > m[2] * (sr / step)) x = x.slice(0, Math.round(m[2] * (sr / step)));
  const fade = Math.min(x.length, m[2] ? Math.round(0.06 * (sr / step)) : 330); for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  const out = Buffer.alloc(44 + x.length * 2), rate = Math.round(sr / step); out.write("RIFF", 0); out.writeUInt32LE(36 + x.length * 2, 4); out.write("WAVEfmt ", 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round((x[i] / peak) * 0.89 * 32767))), 44 + i * 2);
  /* Number() so "01" and "1" both mean take 1. Keep this comment ON ITS OWN LINE: the write and the log below
     live on one dense line, and a trailing // comment silently swallows both. */
  const take = (seq.get(m[1]) || 0) + 1; seq.set(m[1], take);
  const name = `${m[1]}${take}.wav`; fs.writeFileSync(path.join(OUT, name), out); console.log(f.padEnd(26), "->", name.padEnd(12), `${(x.length / rate).toFixed(2)}s`, `${Math.round(out.length / 1024)} KB (was ${Math.round(b.length / 1024)})`);
}

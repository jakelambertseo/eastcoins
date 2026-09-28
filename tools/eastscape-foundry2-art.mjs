/* EastScape: THE FOUNDRY, REBUILT (2026-09-27) — the traps, the moving scenery and the giant, cut from Rafael Matos's
   "Epic RPG World - Volcano".   node tools/eastscape-foundry2-art.mjs
   The owner: "i want the foundry to GUARANTEED use these parts of the tileset as the level design. the big boss at the end (animated), the
   traps placed once each around the map". The seven areas' grounds are pictures made by lt-wild/compose-rects.mjs from the pack's own Tiled
   maps (rendered by tools/eastscape-tmx-render.mjs) and mockups (lt-wild/fd/*.json); this cuts everything that MOVES:

     fd_lava          the pack's 16-frame lava, drawn over open lava as a moving surface (GROUNDS.lava)
     bessemer*        the Giant, now Old Bessemer: the pack's 10-frame idle (_l1.._l10), a slam built from it (_a1.._a4: the whole body
                      drops and comes back), and a rise out of the lava (_r1.._r6)
     fd_t_*           one strip per trap, every frame the same cell, with the phase each frame belongs to written to lt-wild/cut/fd-anim.json:
                      spikes (bone spikes, attack/retreat), spit (the spitfire device with its four diagonal jets), crush (the skull
                      crusher and its pentagram), geyser, burn (burning ground), volc (the tiny volcano) and ball (a lava ball's impact)
     fd_danger        the pack's danger mark, drawn on a trap's tiles while it warns
     fd_tumor, fd_eye, fd_vortex, fd_gatefx   the Blood Grove's pools, the towers' eyes, the portals and the burning door
   The pack is paid and local (lt-wild/erw/volcano), never committed; only what this writes into flat/ is. */
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const PK = path.join(ROOT, "lt-wild/erw/volcano/Epic RPG World - Volcano V1.6"), OUT = path.join(ROOT, "v3/assets/img/glad/flat"), META = path.join(ROOT, "lt-wild/cut/fd-anim.json");
const AN = (f) => path.join(PK, "Props/Animated", f), PR = (f) => path.join(PK, "Props/static/individual sprites", f), CH = (f) => path.join(PK, "Characters", f), TS = (f) => path.join(PK, "Tilesets", f);
if (!fs.existsSync(PK)) { console.log(`no pack at ${PK}`); process.exit(1); }
const meta = {};
const put = async (name, buf) => { fs.writeFileSync(path.join(OUT, `${name}.png`), buf); const m = await sharp(buf).metadata(); console.log(`  ${name.padEnd(16)} ${String(m.width).padStart(5)}x${String(m.height).padEnd(4)} ${Math.round(buf.length / 1024)} KB`); };

/* a sheet as raw cells (cols x rows of cw x ch), empty cells dropped: the pack pads its sheets */
async function cells(file, cw, ch, keepEmpty = false) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), out = [];
  for (let r = 0; r < Math.floor(info.height / ch); r++) for (let c = 0; c < Math.floor(info.width / cw); c++) {
    const d = Buffer.alloc(cw * ch * 4); let any = false;
    for (let y = 0; y < ch; y++) { data.copy(d, y * cw * 4, ((r * ch + y) * info.width + c * cw) * 4, ((r * ch + y) * info.width + c * cw + cw) * 4); }
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { any = true; break; }
    if (any || keepEmpty) out.push({ d, w: cw, h: ch });
  }
  return out;
}
const img = async (file) => { const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const blank = (w, h) => ({ d: Buffer.alloc(w * h * 4), w, h });
/* alpha-over `s` onto `t` with s's (ox, oy) at t's (x, y); fh/fv mirror the source */
function over(t, s, x, y, { fh = false, fv = false, alpha = 1 } = {}) {
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const u = fh ? s.w - 1 - i : i, v = fv ? s.h - 1 - j : j, si = (v * s.w + u) * 4, a = (s.d[si + 3] / 255) * alpha; if (!a) continue;
    const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= t.w || Y >= t.h) continue; const ti = (Y * t.w + X) * 4, ta = t.d[ti + 3] / 255, oa = a + ta * (1 - a);
    for (let k = 0; k < 3; k++) t.d[ti + k] = Math.round((s.d[si + k] * a + t.d[ti + k] * ta * (1 - a)) / (oa || 1)); t.d[ti + 3] = Math.round(oa * 255);
  }
}
const bbox = (frs) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const f of frs) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.d[(y * f.w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
const crop = (f, b) => { const o = blank(b.w, b.h); for (let y = 0; y < b.h; y++) f.d.copy(o.d, y * b.w * 4, ((b.y0 + y) * f.w + b.x0) * 4, ((b.y0 + y) * f.w + b.x0 + b.w) * 4); return o; };
const png = (f) => sharp(f.d, { raw: { width: f.w, height: f.h, channels: 4 } }).png({ compressionLevel: 9, palette: true, colours: 256, effort: 10 }).toBuffer();
/* a strip of equal cells, left to right */
/* (the frames are cropped to their shared box first and laid out as a GRID no wider than 2048: a strip of 49 spitfire frames at full
   size was 26,112 px wide and about 33 MB decoded) */
async function strip(name, frames0, extra = {}) {
  const b = bbox(frames0), frames = frames0.map((f) => crop(f, b)), w = b.w, h = b.h, cols = Math.max(1, Math.min(frames.length, Math.floor(2048 / w))), rows = Math.ceil(frames.length / cols), s = blank(w * cols, h * rows);
  frames.forEach((f, i) => over(s, f, (i % cols) * w, Math.floor(i / cols) * h));
  const m = { frames: frames.length, cols, fw: w, fh: h, ...extra };
  if (m.ax != null) { m.ax -= b.x0; m.ay -= b.y0; }
  await put(name, await png(s)); meta[name] = m;
}
/* every frame of a set cropped to ONE shared box, so it can play in place */
const shared = (frs) => { const b = bbox(frs); return { frames: frs.map((f) => crop(f, b)), box: b }; };

/* ---- the lava surface: 16 frames of one 32px tile */
await strip("fd_lava", await cells(TS("lava-16frames-subtle variation2.png"), 32, 32));

/* ---- the Giant: Old Bessemer. The showcase gif's 10 frames are the idle; everything is cut to the union box of every pose. */
{
  const gif = path.join(PK, "Characters/giant boss/boss-showcase-transparency.gif"), idle = [];
  for (let p = 0; p < 10; p++) idle.push(await img(await sharp(gif, { page: p }).png().toBuffer().then((b) => { const t = path.join(ROOT, "lt-wild/cut/volc/_g.png"); fs.writeFileSync(t, b); return t; })));
  const H = idle[0].h, W = idle[0].w;
  /* the slam: the body drops 6, 16, 22 then 10 pixels, off the frames of the breath it is in */
  const drop = (f, dy) => { const o = blank(W, H); over(o, f, 0, dy); return o; };
  const slam = [6, 16, 22, 10].map((dy, i) => drop(idle[(i * 3) % 10], dy));
  /* the rise: it comes up out of the lava, the part below the lava line hidden, over six frames */
  const b0 = bbox(idle), line = b0.y0 + b0.h;   // (its hands' lowest pixel is the lava line it rises from)
  const rise = [0.85, 0.68, 0.5, 0.34, 0.18, 0.06].map((k, i) => { const o = blank(W, H), dy = Math.round(k * b0.h); over(o, idle[i % 10], 0, dy); for (let y = line; y < H; y++) o.d.fill(0, y * W * 4, (y + 1) * W * 4); return o; });
  const all = [...idle, ...slam, ...rise], b = bbox(all);
  /* (the area's art came to 491 KB with all ten: five of the breath, every other frame, played slower, keep it for about half) */
  for (let i = 0; i < 5; i++) await put(`bessemer_l${i + 1}`, await png(crop(idle[i * 2], b)));
  await put("bessemer", await png(crop(idle[0], b)));   // it never walks, so no _w frames and no _i2: its breath is the loop
  for (let i = 0; i < 4; i++) await put(`bessemer_a${i + 1}`, await png(crop(slam[i], b)));
  for (let i = 0; i < 4; i++) await put(`bessemer_r${i + 1}`, await png(crop(rise[[0, 2, 3, 5][i]], b)));
  meta.bessemer = { w: b.w, h: b.h, loop: 5, ms: 180 };
  fs.unlinkSync(path.join(ROOT, "lt-wild/cut/volc/_g.png"));
}

/* ---- the traps. Each is ONE strip; `seq` says which frames are its idle, its warning, its strike and its winding down. */
/* SPIKES: bone spikes that poke, then burst up. Idle is the last retreat frame (the holes). */
{ const atk = await cells(AN("spike-pack-horizontal-attack.png"), 160, 154), ret = await cells(AN("spike-pack-horizontal-retreat.png"), 160, 154);
  const { frames } = shared([ret[ret.length - 1], ...atk, ...ret]);
  await strip("fd_t_spikes", frames, { seq: { idle: [0], warn: [1, 2, 3], strike: range(4, atk.length), end: range(atk.length + 1, atk.length + ret.length) } }); }
/* SPITFIRE: the device (stand, starting, firing, extinguishing) with the diagonal jet mirrored four ways into an X */
{ const stand = await img(AN("spitfire device-stand v2.png"));
  const dS = await cells(AN("spitfire device-multidirectional-starting-16frames.png"), 128, 96), dL = await cells(AN("spitfire device-multidirectional-firing-loop-8frames.png"), 128, 96), dE = await cells(AN("spitfire device-multidirectional-extinguishing-11frames.png"), 128, 96);
  const fS = await cells(AN("spitfire device-diagonal-starting-flame.png"), 224, 128), fL = await cells(AN("spitfire device-diagonal-firing-loop-flame.png"), 224, 128), fE = await cells(AN("spitfire device-diagonal-extinguishing-flame.png"), 224, 128);
  /* the jet's mouth: the top-left of the firing loop's union box (it flies down and right from there) */
  const fb = bbox(fL), mx = fb.x0, my = fb.y0, W = 544, H = 320, cx = W / 2, cy = H / 2;
  const cell = (dev, fl) => { const o = blank(W, H);
    if (fl) for (const [fh, fv] of [[false, false], [true, false], [false, true], [true, true]]) over(o, fl, fh ? cx - (224 - mx) + 1 : cx - mx, fv ? cy - (128 - my) + 1 : cy - my, { fh, fv });
    over(o, stand, cx - 32, cy - 40); if (dev) over(o, dev, cx - 64, cy - 60); return o; };
  /* every other frame of the wind-up, the jets' start and their end (the loop keeps all 8): 30 frames rather than 49 */
  const half = (a) => a.filter((_, k) => k % 2 === 0), dS2 = half(dS), fS2 = half(fS), fE2 = half(fE);
  const frames = [cell(dS[0], null), ...dS2.map((d) => cell(d, null)), ...fS2.map((f, i) => cell(dL[i % dL.length], f)), ...fL.map((f, i) => cell(dL[i % dL.length], f)), ...fE2.map((f, i) => cell(dE[Math.min(i * 2, dE.length - 1)], f))];
  let i = 1; const warn = range(i, i + dS2.length - 1); i += dS2.length; const sstart = range(i, i + fS2.length - 1); i += fS2.length; const sloop = range(i, i + fL.length - 1); i += fL.length; const end = range(i, i + fE2.length - 1);
  await strip("fd_t_spit", frames, { seq: { idle: [0], warn, strike: sloop, sstart, end }, ax: cx, ay: cy }); }
/* THE CRUSHER: its pentagram glows (the warning), the skull rises and smashes, then sinks */
{ const penta = await cells(AN("crusher-smash-pentagram FX.png"), 192, 160), sm = await cells(AN("crusher-smash.png"), 192, 352), rt = await cells(AN("crusher-retreat.png"), 192, 352);
  const W = 192, H = 400, cell = (p, c) => { const o = blank(W, H); if (p) over(o, p, 0, H - 160); if (c) over(o, c, 0, H - 352 - 44); return o; };
  const frames = [cell(null, null), ...penta.map((p) => cell(p, null)), ...sm.map((c, k) => cell(penta[k % penta.length], c)), ...rt.map((c) => cell(null, c))];
  await strip("fd_t_crush", frames, { seq: { idle: [0], warn: range(1, penta.length), strike: range(penta.length + 1, penta.length + sm.length), end: range(penta.length + sm.length + 1, penta.length + sm.length + rt.length) }, ax: 96, ay: H - 80 }); }
/* GEYSER: the hole, a first spit (the warning), the column, and the fall */
{ const hole = await img(PR("hole used for the geyser_0.png")), st = await cells(AN("geyser-start.png"), 160, 192), lp = await cells(AN("geyser-loop.png"), 160, 192), ex = await cells(AN("geyser-extinguishing.png"), 160, 192);
  const cell = (c) => { const o = blank(160, 192); over(o, hole, 64, 192 - 40); if (c) over(o, c, 0, 0); return o; };
  const frames = [cell(null), ...st.map(cell), ...lp.map(cell), ...ex.map(cell)], a = st.length, b = lp.length;
  await strip("fd_t_geyser", frames, { seq: { idle: [0], warn: range(1, 5), strike: range(6, a + b), end: range(a + b + 1, a + b + ex.length) }, ax: 80, ay: 192 - 24 }); }
/* BURNING GROUND: it catches (the warning), burns, and goes out */
{ const st = await cells(AN("burning ground-starting.png"), 160, 128), lp = await cells(AN("burning ground-loop.png"), 160, 128), ex = await cells(AN("burning ground-extinguishing.png"), 160, 128);
  const frames = [blank(160, 128), ...st, ...lp, ...ex];
  await strip("fd_t_burn", frames, { seq: { idle: [0], warn: range(1, st.length), strike: range(st.length + 1, st.length + lp.length), end: range(st.length + lp.length + 1, st.length + lp.length + ex.length) }, ax: 80, ay: 64 }); }
/* THE TINY VOLCANO: it smokes, then goes off (the warning); the balls land where the danger marks were (fd_t_ball) */
{ const sm = await cells(AN("tiny volcano-smoking.png"), 112, 108), ex = await cells(AN("tiny volcano-exploding.png"), 112, 108);
  await strip("fd_t_volc", [...sm, ...ex], { seq: { idle: range(0, sm.length - 1), warn: range(sm.length, sm.length + ex.length - 1) }, ax: 56, ay: 96 });
  const imp = await cells(AN("lava ball-impact.png"), 96, 96), fall = (await cells(AN("lava ball-falling.png"), 96, 96)).slice(0, 5);
  await strip("fd_t_ball", [...fall, ...imp], { seq: { fall: range(0, fall.length - 1), impact: range(fall.length, fall.length + imp.length - 1) }, ax: 48, ay: 72 }); }
await strip("fd_danger", await cells(CH("elemental/danger mark.png"), 32, 32));

/* ---- the moving scenery */
await strip("fd_tumor", (await cells(AN("tumor-loop.png"), 224, 192)));
await strip("fd_eye", (await cells(AN("big eye-loop.png"), 128, 96)));
await strip("fd_vortex", (await cells(AN("portal or spawner vfx-v1.png"), 192, 160)));
await strip("fd_gatefx", (await cells(AN("Giant Boss Area Entrance-gate VFX.png"), 160, 192)));

fs.writeFileSync(META, JSON.stringify(meta, null, 1));
console.log(`the Foundry's moving art cut; frame data in ${path.relative(ROOT, META)}`);
function range(a, b) { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }

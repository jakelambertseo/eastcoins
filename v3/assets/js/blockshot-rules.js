/* Blockshot's rules (2026-10-08): everything the page and the server must agree on, in one import-free file, so the match the server runs
   and the one you see are the same simulation. The page draws it; the arcade server owns it. Nothing here touches the DOM or three.js:
   vectors are the small V class below, so this runs in a Durable Object as it is.

   What lives here: the physics (Blaster Brawl's oriented-box world, the lounge's slide-hop, STEP_UP over low ledges, jump pads), the
   guns and the shot ray (a bean is a body sphere and a head sphere), damage, kills and respawns, the maps (lists of boxes; `ramp()`
   gets the slope's sign right), spawn choice, and the bots that fill empty slots. `stepWorld` advances everyone one tick from their
   inputs and pushes EVENTS (shot, hit, kill, jump, slide, pad, fell, spawn) that the page turns into sound and feed lines and the
   server turns into stats. Every random choice goes through the `rand` you pass, so a test can pin it. */
export const VERSION = 1;

/* ------------------------------------------------------------------ constants */
export const PHYS = { G: -26, JUMP: 9.4, RUN: 7.2, ACC_GROUND: 42, ACC_AIR: 13, R: 0.5, STEP: 1 / 120, STEP60: 1 / 60, EYE: 0.85, HEAD_Y: 0.62, STEP_UP: 0.62 };   // STEP60: the server's tick, and the page's when online
// slide-hop, the lounge's numbers: a slide keeps your speed, a hop out keeps it plus a kick, slide again as you land for more
export const SL = { min: 3, start: 0.9, perfect: 1.1, window: 0.3, decay: 0.35, long: 1.4, hop: 0.4, max: 15, drain: 5, cd: 0.5 };
export const RULES = { PLAYERS: 12, ROUND_S: 300, MAX_HP: 100, REGEN_AFTER: 5, REGEN_RATE: 12, RESPAWN_S: 3, FALL_Y: -10 };
/* The guns are Krunker's numbers (the Krunker.io wiki, v6.0.0 / v5.6.9; the owner, 2026-10-08: "the rate of fire seems too high, at least
   for the AK. can we pick up that data anywhere and replicate?"): the assault rifle 23 a hit every 130 ms, 28 rounds, 1.5 s reload,
   headshots ×1.5; the sniper 109 (163.5 to the head) once a second, 3 rounds, 1.9 s, scope 2.7×; the shotgun five pellets of 50 every
   450 ms, 2 shells, 1.1 s, headshots ×1.25. Krunker's ranges are in its own units; ours are metres on our maps.
   AIM DOWN SIGHTS (the owner: "some aim down sight mechanism for guns that are different per gun"): right click on any gun. `zoom` is
   Krunker's (ironsights 1.6 on the rifle, 1.25 on the shotgun, the 2.7 scope on the sniper); `adsSpread` is how much the spread
   tightens and `adsMove` how much you slow while aiming, both applied by the server from the input's `scope` flag. */
export const GUNS = {
  ar: { n: "Assault rifle", dmg: 23, head: 1.5, cd: 0.13, mag: 28, reload: 1.5, spread: 0.008, pellets: 1, range: 80, auto: true, zoom: 1.6, adsSpread: 0.45, adsMove: 0.8, text: "23 a hit, 460 a minute, 28 rounds. Right click for the ironsights. The all-rounder." },
  sniper: { n: "Sniper", dmg: 109, head: 1.5, cd: 1.0, mag: 3, reload: 1.9, spread: 0.012, pellets: 1, range: 160, auto: false, scope: true, zoom: 2.7, adsSpread: 0.0, adsMove: 0.7, text: "One shot, one kill, once a second. Right click to scope; from the hip it wanders. 3 rounds." },
  shotgun: { n: "Shotgun", dmg: 50, head: 1.25, cd: 0.45, mag: 2, reload: 1.1, spread: 0.06, pellets: 5, range: 20, auto: false, zoom: 1.25, adsSpread: 0.75, adsMove: 0.9, text: "Five pellets of 50 up close, nothing at range. Right click tightens the spread a little. 2 shells." }
};
export const GUN_KEYS = Object.keys(GUNS);
export const HEADSHOT = 1.5;
export const BOT_NAMES = ["bootypaper", "heartlarva", "andyreidisapawg", "zwades", "cenozoicmegafauna", "drhealsgud", "psilocyboone", "fasteddie", "aallldeeeez", "charleskellybirdlaw", "therealb4nksy", "kellzifer", "bigrig", "allyrose7774"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ vectors and rotations (no three.js here) */
export class V {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; return this; }
  clone() { return new V(this.x, this.y, this.z); }
  add(o) { this.x += o.x; this.y += o.y; this.z += o.z; return this; }
  sub(o) { this.x -= o.x; this.y -= o.y; this.z -= o.z; return this; }
  scale(k) { this.x *= k; this.y *= k; this.z *= k; return this; }
  addScaled(o, k) { this.x += o.x * k; this.y += o.y * k; this.z += o.z * k; return this; }
  dot(o) { return this.x * o.x + this.y * o.y + this.z * o.z; }
  len() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.len() || 1; return this.scale(1 / l); }
  dist(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
  /** this = M · this for a row-major 3×3 */
  applyM(m) { const { x, y, z } = this; this.x = m[0] * x + m[1] * y + m[2] * z; this.y = m[3] * x + m[4] * y + m[5] * z; this.z = m[6] * x + m[7] * y + m[8] * z; return this; }
}
/** Rotation about x by rx then about y by ry (three.js "YXZ" order: R = Ry · Rx), row-major. */
function rotYX(rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  return [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx];
}
const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/* ------------------------------------------------------------------ boxes: Blaster Brawl's oriented boxes */
export class Box {
  constructor({ c, h, rx = 0, ry = 0 }) {
    this.c = new V(...c); this.h = new V(...h); this.rx = rx; this.ry = ry; this.flat = !rx && !ry; this.top = this.c.y + this.h.y;
    this.R = rotYX(rx, ry); this.RT = transpose(this.R); this.radius = this.h.len();
  }
}
const _l = new V(), _cl = new V(), _d = new V(), _n = new V();
/** Push a sphere out of a box: fills hit {n, point, pen} and returns it, or null. */
export function sphereBox(p, r, b, hit) {
  if (Math.abs(p.x - b.c.x) > b.radius + r || Math.abs(p.y - b.c.y) > b.radius + r || Math.abs(p.z - b.c.z) > b.radius + r) return null;
  _l.copy(p).sub(b.c).applyM(b.RT); _cl.set(clamp(_l.x, -b.h.x, b.h.x), clamp(_l.y, -b.h.y, b.h.y), clamp(_l.z, -b.h.z, b.h.z)); _d.copy(_l).sub(_cl); const dist = _d.len();
  if (dist > r) return null;
  if (dist > 1e-6) { _n.copy(_d).scale(1 / dist); hit.pen = r - dist; }
  else { const px = b.h.x - Math.abs(_l.x), py = b.h.y - Math.abs(_l.y), pz = b.h.z - Math.abs(_l.z); if (py <= px && py <= pz) { _n.set(0, Math.sign(_l.y) || 1, 0); hit.pen = r + py; } else if (px <= pz) { _n.set(Math.sign(_l.x) || 1, 0, 0); hit.pen = r + px; } else { _n.set(0, 0, Math.sign(_l.z) || 1); hit.pen = r + pz; } }
  hit.n.copy(_n).applyM(b.R); hit.point.copy(_cl).applyM(b.R).add(b.c); return hit;
}
const _ro = new V(), _rd = new V();
/** Distance along a ray (o, unit d) to a box, or Infinity. */
export function rayBox(o, d, b) {
  _ro.copy(o).sub(b.c).applyM(b.RT); _rd.copy(d).applyM(b.RT); let tmin = 0, tmax = 400;
  for (const ax of ["x", "y", "z"]) { const h = b.h[ax], ro = _ro[ax], rd = _rd[ax]; if (Math.abs(rd) < 1e-9) { if (ro < -h || ro > h) return Infinity; continue; } let t1 = (-h - ro) / rd, t2 = (h - ro) / rd; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return Infinity; }
  return tmin;
}
export function raySphere(o, d, cx, cy, cz, r) { const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz, b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c; if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t >= 0 ? t : Infinity; }

/* ------------------------------------------------------------------ the maps: lists of boxes, ramps and jump pads */
export const COLORS = { GROUND: 0x5e8a4a, SAND: 0xd9c38c, STONE: 0x8d939c, BRICK: 0xb85c3a, TEAL: 0x3aa8a0, CRATE: 0xa8713a, DARK: 0x3a3d48, WHITE: 0xe8e8e4, BLUE: 0x4a78b0, RUST: 0x8a4a2a, PINK: 0xd05a8a };
const C = COLORS;
function mapBuilder(size) {
  const boxes = [], pads = [];
  const box = (c, h, tex, col, extra = {}) => { boxes.push({ c, h, tex, col, ...extra }); return boxes[boxes.length - 1]; };
  /** A slope `w` wide from (x0,z0) at y0 to (x1,z1) at y1: one thin box turned to lie along the line and tilted so the far end is the high one. */
  const ramp = (x0, z0, y0, x1, z1, y1, w, tex = "concrete", col = C.STONE) => {
    const dx = x1 - x0, dz = z1 - z0, run = Math.hypot(dx, dz), rise = y1 - y0, len = Math.hypot(run, rise);
    return box([(x0 + x1) / 2, (y0 + y1) / 2 - 0.1, (z0 + z1) / 2], [w / 2, 0.1, len / 2], tex, col, { rx: -Math.atan2(rise, run), ry: Math.atan2(dx, dz) });
  };
  const pad = (x, z, up = 16, fwd = null) => { pads.push({ x, z, up, fwd }); box([x, 0.08, z], [1.1, 0.08, 1.1], "pad", C.DARK); };
  const walls = (s, h = 6) => { for (const [x, z, hx, hz] of [[0, s + 0.5, s + 1, 0.5], [0, -s - 0.5, s + 1, 0.5], [s + 0.5, 0, 0.5, s], [-s - 0.5, 0, 0.5, s]]) box([x, h / 2, z], [hx, h / 2, hz], "brick", C.STONE); };
  return { boxes, pads, box, ramp, pad, walls, size };
}
function lot() {
  const M = mapBuilder(40), { box, ramp, pad, walls } = M;
  box([0, -0.5, 0], [41, 0.5, 41], "grass", C.GROUND); walls(40);
  box([0, 1.5, 0], [9, 1.5, 9], "concrete", C.SAND);
  for (const [x0, z0, x1, z1] of [[0, 20, 0, 9], [0, -20, 0, -9], [20, 0, 9, 0], [-20, 0, -9, 0]]) ramp(x0, z0, 0, x1, z1, 3, 7, "concrete", C.SAND);
  box([0, 5.2, 0], [3, 2.2, 3], "metal", C.TEAL); ramp(-8.5, -3, 3, -3, -3, 7.4, 2.5, "metal", C.TEAL); box([0, 7.7, 0], [0.9, 0.3, 0.9], "crate", C.CRATE);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { box([sx * 30, 3, sz * 30], [7, 3, 7], "brick", sx * sz > 0 ? C.BRICK : C.BLUE); ramp(sx * 30, sz * 10, 0, sx * 30, sz * 23, 6, 5, "concrete", C.STONE); box([sx * 30, 6.5, sz * 30], [1.2, 0.5, 1.2], "crate", C.CRATE); }
  for (const s of [-1, 1]) { box([0, 5.8, s * 36], [23, 0.2, 1.5], "metal", C.DARK); box([s * 36, 5.8, 0], [1.5, 0.2, 23], "metal", C.DARK); }
  for (const s of [-1, 1]) for (const z of [-36, 36]) box([s * 12, 6.3, z], [0.5, 0.3, 0.5], "hazard", 0);
  // big cover beside the lanes (never on a ramp line: the first build put them there and bots had to hop them)
  for (const [x, z, hx, hz] of [[16, 9, 0.5, 3], [-16, -9, 0.5, 3], [9, -16, 3, 0.5], [-9, 16, 3, 0.5], [22, 22, 2.5, 0.5], [-22, -22, 2.5, 0.5], [22, -22, 0.5, 2.5], [-22, 22, 0.5, 2.5]]) box([x, 1.25, z], [hx, 1.25, hz], "concrete", C.WHITE);
  for (const [x, z] of [[0, 27], [0, -27], [27, 0], [-27, 0]]) pad(x, z, 15, { x: -Math.sign(x) * 9, z: -Math.sign(z) * 9 });
  M.spawns = [[0, 1, 36], [0, 1, -36], [36, 1, 0], [-36, 1, 0], [30, 7, 30], [-30, 7, -30], [30, 7, -30], [-30, 7, 30], [20, 1, 20], [-20, 1, -20], [20, 1, -20], [-20, 1, 20]];
  M.waypoints = [...M.spawns.map((s) => [s[0], s[2]]), [0, 0], [0, 14], [0, -14], [14, 0], [-14, 0], [0, 36], [0, -36], [36, 0], [-36, 0], [24, 36], [-24, 36], [24, -36], [-24, -36], [36, 24], [36, -24], [-36, 24], [-36, -24], [8, 8], [-8, -8], [8, -8], [-8, 8]];
  M.name = "The Lot"; M.blurb = "An open plaza with a raised centre, four roofs, long ramps and bridges. Slide lanes everywhere."; M.sky = 0x8fc4ef; M.fog = [70, 160];
  return M;
}
function docks() {
  const M = mapBuilder(44), { box, ramp, pad, walls } = M;
  box([0, -0.5, 0], [45, 0.5, 45], "concrete", C.STONE); walls(44, 7);
  for (const s of [-1, 1]) { box([s * 16, 2.5, 0], [6, 2.5, 14], "metal", s > 0 ? C.RUST : C.BLUE); ramp(s * 16, s > 0 ? 28 : -28, 0, s * 16, s > 0 ? 14 : -14, 5, 6, "metal", C.DARK); ramp(s * 16, s > 0 ? -28 : 28, 0, s * 16, s > 0 ? -14 : 14, 5, 6, "metal", C.DARK); box([s * 16, 5.6, 0], [0.6, 0.6, 2], "crate", C.CRATE); }
  box([0, 7.8, 0], [10.5, 0.2, 1.6], "metal", C.DARK);
  for (const s of [-1, 1]) ramp(s * 16, -6, 5, s * 10.5, -1, 8, 2.4, "metal", C.DARK);
  for (const s of [-1, 1]) { box([s * 40, 1, 0], [4, 1, 30], "crate", C.CRATE); ramp(s * 40, s > 0 ? 38 : -38, 0, s * 40, s > 0 ? 30 : -30, 2, 7, "crate", C.CRATE); ramp(s * 40, s > 0 ? -38 : 38, 0, s * 40, s > 0 ? -30 : 30, 2, 7, "crate", C.CRATE); }
  for (const [x, z, col] of [[-8, 36, C.PINK], [8, 36, C.TEAL], [0, 38, C.BLUE], [-8, -36, C.BLUE], [8, -36, C.PINK], [0, -38, C.TEAL]]) box([x, 1.3, z], [3, 1.3, 1.3], "metal", col);
  box([0, 3.9, 38], [3, 1.3, 1.3], "metal", C.RUST); box([0, 3.9, -38], [3, 1.3, 1.3], "metal", C.RUST);
  for (const z of [-10, 10]) box([0, 1.1, z], [3.5, 1.1, 0.5], "concrete", C.WHITE);
  pad(0, 20, 17, { x: 0, z: -6 }); pad(0, -20, 17, { x: 0, z: 6 }); for (const s of [-1, 1]) pad(s * 30, 0, 14, { x: -s * 5, z: 0 });
  M.spawns = [[0, 1, 30], [0, 1, -30], [40, 3, 20], [-40, 3, -20], [40, 3, -20], [-40, 3, 20], [16, 6, 0], [-16, 6, 0], [-30, 1, 30], [30, 1, -30], [0, 9, 0], [8, 1, 0]];
  M.waypoints = [...M.spawns.map((s) => [s[0], s[2]]), [0, 0], [0, 15], [0, -15], [8, 20], [-8, -20], [30, 10], [-30, -10], [30, -10], [-30, 10], [40, 0], [-40, 0], [16, 22], [-16, -22], [16, -22], [-16, 22], [-8, 30], [8, -30]];
  M.name = "The Docks"; M.blurb = "Three long lanes, two warehouses with ramps at both ends, a high catwalk, piers along the water."; M.sky = 0xf0c8a0; M.fog = [60, 150];
  return M;
}
export const MAPS = { lot, docks };
export const MAP_LIST = Object.keys(MAPS);

/** A map, built: the boxes as physics, the pads, the spawns. */
export class World {
  constructor(key) { this.key = key; this.map = MAPS[key](); this.boxes = this.map.boxes.map((m) => new Box(m)); this.pads = this.map.pads; this.spawns = this.map.spawns; this.waypoints = this.map.waypoints; }
  /** The height of the ground under (x, z), seen from `from`. */
  groundAt(x, z, from = 50) { const o = new V(x, from, z), d = new V(0, -1, 0); let best = Infinity; for (const b of this.boxes) best = Math.min(best, rayBox(o, d, b)); return from - best; }
}

/* ------------------------------------------------------------------ beans */
export function newBean(i, name, bot) {
  return { i, name, bot, p: new V(), v: new V(), facing: 0, aim: new V(0, 0, -1), hp: RULES.MAX_HP, dead: false, respawn: 0, gun: "ar", ammo: 30, reloading: 0, cd: 0.5, hurtT: -99, kills: 0, deaths: 0, streak: 0, bestStreak: 0, shots: 0, hits: 0,
    grounded: false, coyote: 0, slide: false, slideT: 0, slideCd: 0, landT: 9, lastBy: null, lastByT: -99, skill: 0.6, target: null, think: 0, look: 0, strafe: 1, strafeT: 0, stuck: 0, wp: null, react: 1, lostT: 0 };
}
/** The spawn farthest from everyone alive (a little noise so two people don't share one). */
export function spawnFor(world, beans, b, rand = Math.random) {
  let best = world.spawns[0], bd = -1;
  for (const s of world.spawns) { let d = 1e9; for (const o of beans) if (o !== b && !o.dead) d = Math.min(d, Math.hypot(o.p.x - s[0], o.p.z - s[2])); d += rand() * 3; if (d > bd) { bd = d; best = s; } }
  return best;
}
export function respawnBean(world, beans, b, gun, rand = Math.random, events) {
  const s = spawnFor(world, beans, b, rand);
  b.dead = false; b.hp = RULES.MAX_HP; b.hurtT = -99; b.gun = GUNS[gun] ? gun : "ar"; b.ammo = GUNS[b.gun].mag; b.reloading = 0; b.cd = 0.3; b.slide = false; b.streak = 0;
  b.p.set(s[0], s[1] + 0.2, s[2]); b.v.set(0, 0, 0); b.facing = Math.atan2(-s[0], -s[2]);
  events?.push({ type: "spawn", b });
}

/** A shot from o along unit d: the first thing it meets. The head counts for more. */
export function cast(world, beans, o, d, shooter, range = 80) {
  let best = range, bean = null, head = false;
  for (const b of world.boxes) { const tt = rayBox(o, d, b); if (tt < best) { best = tt; bean = null; } }
  for (const b of beans) { if (b === shooter || b.dead) continue; const th = raySphere(o, d, b.p.x, b.p.y + PHYS.HEAD_Y, b.p.z, 0.4); if (th < best) { best = th; bean = b; head = true; } const tb = raySphere(o, d, b.p.x, b.p.y + 0.1, b.p.z, 0.55); if (tb < best) { best = tb; bean = b; head = false; } }
  return { t: best, bean, head, point: o.clone().addScaled(d, best) };
}
export function damage(target, dmg, from, head, now, events) {
  if (target.dead) return;
  target.hp -= dmg; target.hurtT = now; target.lastBy = from; target.lastByT = now;
  if (from) { from.hits++; }
  events?.push({ type: "hit", target, by: from, dmg, head });
  if (target.hp <= 0) kill(target, from, head, now, events);
}
export function kill(target, by, head, now, events) {
  target.dead = true; target.respawn = RULES.RESPAWN_S; target.deaths++; target.streak = 0; target.slide = false;
  const suicide = !by || by === target;
  if (!suicide) { by.kills++; by.streak++; by.bestStreak = Math.max(by.bestStreak, by.streak); }
  events?.push({ type: "kill", target, by: suicide ? null : by, head });
}
/** Fire b's gun along dir (unit). `spreadK` scales the spread (scoped, airborne). Returns the pellets as {from, to, hit}. */
export function fire(world, beans, b, dir, now, rand, events, spreadK = 1) {
  const g = GUNS[b.gun]; b.cd = g.cd; b.ammo--; b.shots++;
  const eye = b.p.clone(); eye.y += PHYS.EYE * (b.slide ? 0.6 : 1); const pellets = [];   // (the camera sits lower in a slide; the page draws from the same height)
  for (let k = 0; k < g.pellets; k++) {
    const d = dir.clone(); const sp = g.spread * spreadK; d.x += (rand() * 2 - 1) * sp; d.y += (rand() * 2 - 1) * sp; d.z += (rand() * 2 - 1) * sp; d.normalize();
    const r = cast(world, beans, eye, d, b, g.range);
    pellets.push({ from: eye, to: r.point, bean: r.bean, head: r.head });
    if (r.bean) damage(r.bean, g.dmg * (r.head ? g.head ?? HEADSHOT : 1) * (g.pellets > 1 ? clamp(1.4 - r.t / g.range, 0.3, 1) : 1), b, r.head, now, events);
  }
  events?.push({ type: "shot", b, gun: b.gun, pellets });
  return pellets;
}
export function reload(b, events) { const g = GUNS[b.gun]; if (b.reloading || b.ammo === g.mag) return false; b.reloading = g.reload; events?.push({ type: "reload", b }); return true; }

/* ------------------------------------------------------------------ one tick of one bean */
const hit = { n: new V(), point: new V(), pen: 0 };
/** inp: { x, z (unit-ish move), jump, fire, fireTap, slide, reload, aim: V (unit look direction) }. `spreadK` for the player's scope/air. */
export function stepBean(world, beans, b, inp, dt, now, rand, events, opts = {}) {
  if (b.dead) { b.respawn -= dt; return; }
  const P = PHYS, G = GUNS[b.gun];
  b.cd = Math.max(0, b.cd - dt);
  if (b.reloading) { b.reloading -= dt; if (b.reloading <= 0) { b.reloading = 0; b.ammo = G.mag; } }
  if (inp.reload) reload(b, events);
  if (now - b.hurtT > RULES.REGEN_AFTER && b.hp < RULES.MAX_HP) b.hp = Math.min(RULES.MAX_HP, b.hp + RULES.REGEN_RATE * dt);
  let hs = Math.hypot(b.v.x, b.v.z);
  const want = Math.hypot(inp.x, inp.z) > 0.1 ? Math.atan2(inp.x, inp.z) : null;
  const steer = (rate) => { if (want === null || hs < 0.1) return; let h = Math.atan2(b.v.x, b.v.z); h += clamp(Math.atan2(Math.sin(want - h), Math.cos(want - h)), -rate * dt, rate * dt); b.v.x = Math.sin(h) * hs; b.v.z = Math.cos(h) * hs; };
  const setSpeed = (v) => { if (hs > 1e-3) { b.v.x *= v / hs; b.v.z *= v / hs; } hs = v; };
  b.landT += dt; b.slideCd = Math.max(0, b.slideCd - dt); b.coyote = b.grounded ? 0.1 : Math.max(0, b.coyote - dt);
  if (!b.slide && b.grounded && inp.slide && hs > SL.min) { b.slide = true; b.slideT = 0; const kick = (b.slideCd > 0 ? 0 : SL.start) + (b.landT < SL.window ? SL.perfect : 0); if (kick) setSpeed(Math.min(SL.max, hs + kick)); events?.push({ type: "slide", b }); }
  const jumped = inp.jump && b.coyote > 0 && b.v.y < 3;
  if (b.slide) { b.slideT += dt; steer(1.8); setSpeed(hs * Math.exp(-(b.slideT > SL.long ? 3 : SL.decay) * dt)); if (jumped) setSpeed(Math.min(SL.max, hs + SL.hop)); if (jumped || !inp.slide || !b.grounded || hs < SL.min * 0.7) { b.slide = false; b.slideCd = SL.cd; } }
  else if (hs > P.RUN + 0.2) { if (b.grounded) { steer(4); setSpeed(Math.max(P.RUN, hs - SL.drain * dt)); } else steer(2.6); }
  else { const acc = b.grounded ? P.ACC_GROUND : P.ACC_AIR, run = P.RUN * (inp.scope ? G.adsMove ?? 1 : 1); b.v.x += clamp(inp.x * run - b.v.x, -acc * dt, acc * dt); b.v.z += clamp(inp.z * run - b.v.z, -acc * dt, acc * dt); }
  if (jumped) { b.v.y = P.JUMP; b.coyote = 0; b.grounded = false; events?.push({ type: "jump", b }); }
  if (inp.aim) b.aim.copy(inp.aim);
  if ((G.auto ? inp.fire : inp.fireTap) && b.cd <= 0 && !b.reloading) { if (b.ammo > 0) fire(world, beans, b, b.aim, now, rand, events, (opts.spreadK ?? (inp.scope ? G.adsSpread ?? 1 : 1)) * (b.grounded ? 1 : 1.6)); else { reload(b, events); events?.push({ type: "empty", b }); } }
  if (want !== null && !b.bot) b.facing = want + Math.PI; else if (b.bot && want !== null && !b.target) b.facing = want + Math.PI;
  b.v.y += P.G * dt; b.p.addScaled(b.v, dt);
  const wasGrounded = b.grounded; b.grounded = false;
  for (const box of world.boxes) {
    if (!sphereBox(b.p, P.R, box, hit)) continue;
    // a low ledge (a rail, a crate, a kerb) is stepped onto rather than run into: that's what keeps a slide alive
    if (box.flat && Math.abs(hit.n.y) < 0.3 && box.top - (b.p.y - P.R) < P.STEP_UP && box.top > b.p.y - P.R) { b.p.y = box.top + P.R + 0.01; b.grounded = true; continue; }
    b.p.addScaled(hit.n, hit.pen); const vn = b.v.dot(hit.n); if (vn < 0) b.v.addScaled(hit.n, -vn); if (hit.n.y > 0.6) b.grounded = true;
  }
  if (b.grounded && !wasGrounded) b.landT = 0;
  if (b.grounded && b.v.y <= 0.5) for (const pd of world.pads) if (Math.abs(b.p.x - pd.x) < 1.2 && Math.abs(b.p.z - pd.z) < 1.2 && b.p.y < 1.2) { b.v.y = pd.up; if (pd.fwd) { b.v.x += pd.fwd.x; b.v.z += pd.fwd.z; } b.grounded = false; b.slide = false; events?.push({ type: "pad", b }); break; }
  if (b.p.y < RULES.FALL_Y) { kill(b, null, false, now, events); events?.push({ type: "fell", b }); }
}
/** Everyone, one tick, from a function that gives each bean its input. Respawns the dead whose time is up (the server decides the gun). */
export function stepWorld(world, beans, dt, now, inputFor, rand, events, gunFor = () => "ar") {
  for (const b of beans) { if (b.dead && b.respawn <= 0) continue; stepBean(world, beans, b, b.dead ? {} : inputFor(b), dt, now, rand, events); }
  for (const b of beans) if (b.dead && b.respawn <= 0 && b.wantsRespawn !== false) respawnBean(world, beans, b, gunFor(b), rand, events);
  for (let i = 0; i < beans.length; i++) for (let j = i + 1; j < beans.length; j++) { const a = beans[i], c = beans[j]; if (a.dead || c.dead) continue; _d.copy(c.p).sub(a.p); const d = _d.len(); if (d < PHYS.R * 2 && d > 1e-4) { _d.scale(1 / d); const push = (PHYS.R * 2 - d) / 2; a.p.addScaled(_d, -push); c.p.addScaled(_d, push); } }
}

/* ------------------------------------------------------------------ bots: the stand-ins for people, and the fillers for empty slots */
export function canSee(world, beans, b, o) { const eye = b.p.clone(); eye.y += PHYS.EYE; const d = new V(o.p.x - b.p.x, o.p.y + 0.3 - eye.y, o.p.z - b.p.z); const dist = d.len(); d.scale(1 / dist); return cast(world, beans, eye, d, b, dist + 1).bean === o; }
export function botInput(world, beans, b, dt, rand = Math.random) {
  const rr = (a, c) => a + rand() * (c - a), pick = (a) => a[Math.floor(rand() * a.length)];
  b.think -= dt; b.strafeT -= dt; b.look -= dt;
  if (b.look <= 0) {
    b.look = rr(0.25, 0.5); let best = null, bs = 1e9;
    for (const o of beans) { if (o === b || o.dead) continue; const d = o.p.dist(b.p); if (d < bs && d < 50 && canSee(world, beans, b, o)) { bs = d; best = o; } }
    if (best) { b.target = best; b.lostT = 0; } else if (b.target) { b.lostT += 0.4; if (b.lostT > 2.5 || b.target.dead) b.target = null; }
  }
  if (b.strafeT <= 0) { b.strafe = rand() < 0.5 ? -1 : 1; b.strafeT = rr(0.5, 1.4); }
  let mx = 0, mz = 0, fireNow = false, jump = false;
  const tg = b.target && !b.target.dead ? b.target : null;
  if (tg) {
    const dx = tg.p.x - b.p.x, dz = tg.p.z - b.p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const want = b.gun === "shotgun" ? 4 : b.gun === "sniper" ? 18 : 10, along = d > want + 3 ? 1 : d < want - 3 ? -0.7 : 0;
    mx = ux * along + -uz * b.strafe * 0.9; mz = uz * along + ux * b.strafe * 0.9; b.facing = Math.atan2(ux, uz) + Math.PI;
    if (b.cd <= 0 && !b.reloading && b.react <= 0 && b.ammo > 0) {
      const lead = d / 90, aim = new V(tg.p.x + tg.v.x * lead - b.p.x, tg.p.y + (rand() < b.skill * 0.35 ? PHYS.HEAD_Y : 0.1) - (b.p.y + PHYS.EYE), tg.p.z + tg.v.z * lead - b.p.z).normalize();
      const spread = 0.03 + 0.14 * (1 - b.skill) + (Math.hypot(b.v.x, b.v.z) > 6 ? 0.04 : 0) + (Math.hypot(tg.v.x, tg.v.z) > 8 ? 0.05 : 0);
      aim.x += rr(-spread, spread); aim.y += rr(-spread, spread) * 0.5; aim.z += rr(-spread, spread); aim.normalize();
      b.aim.copy(aim); fireNow = true; b.react = GUNS[b.gun].auto ? rr(0.06, 0.22) : rr(0.35, 0.9) * (1.3 - b.skill);
    }
  } else {
    if (!b.wp || Math.hypot(b.wp[0] - b.p.x, b.wp[1] - b.p.z) < 1.5 || b.think <= 0) { b.wp = pick(world.waypoints); b.think = rr(4, 8); }
    const dx = b.wp[0] - b.p.x, dz = b.wp[1] - b.p.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; b.facing = Math.atan2(mx, mz) + Math.PI;
  }
  b.react = Math.max(0, b.react - dt);
  const reloadNow = b.ammo === 0 && !b.reloading;
  const sp = Math.hypot(b.v.x, b.v.z); if (b.grounded && (mx || mz) && sp < 1.5) { b.stuck += dt; if (b.stuck > 0.4) jump = true; if (b.stuck > 2) { b.wp = pick(world.waypoints); b.stuck = 0; } } else b.stuck = 0;
  if (b.grounded && tg && rand() < dt * (0.3 + (RULES.MAX_HP - b.hp) * 0.01)) jump = true;
  return { x: mx, z: mz, jump, fire: fireNow, fireTap: fireNow, slide: false, reload: reloadNow };
}

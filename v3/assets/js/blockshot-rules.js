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
export const PHYS = { G: -26, JUMP: 9.4, RUN: 7.2, ACC_GROUND: 42, ACC_AIR: 16, R: 0.5, STEP: 1 / 120, STEP60: 1 / 60, EYE: 0.85, HEAD_Y: 0.62, STEP_UP: 0.62, MANTLE: 0.9, JUMP_BUF: 0.12 };   // (2026-10-10, parkour polish: ACC_AIR 13 -> 16, MANTLE: a ledge up to this far above the feet is climbed when met in the air, JUMP_BUF: a jump pressed this long before landing still fires)   // STEP60: the server's tick, and the page's when online
// slide-hop, the lounge's numbers: a slide keeps your speed, a hop out keeps it plus a kick, slide again as you land for more
export const SL = { min: 3, start: 0.9, perfect: 1.1, window: 0.3, decay: 0.35, long: 1.4, hop: 0.4, max: 15, drain: 5, cd: 0.5 };
export const RULES = { PLAYERS: 12, ROUND_S: 240, MAX_HP: 100, REGEN_AFTER: 5, REGEN_RATE: 12, RESPAWN_S: 3, FALL_Y: -10 };
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
  shotgun: { n: "Shotgun", dmg: 50, head: 1.25, cd: 0.45, mag: 2, reload: 1.1, spread: 0.06, pellets: 5, range: 20, auto: false, zoom: 1.25, adsSpread: 0.75, adsMove: 0.9, text: "Five pellets of 50 up close, nothing at range. Right click tightens the spread a little. 2 shells." },
  // the sidearm everyone carries (2026-10-09, the owner: "build the secondary pistol"): Q or the wheel swaps to it, a quick draw, its own magazine, never the gun you spawn with
  // the knife (2026-10-10, the owner: "knives in both free for all, bomb mode, and future game modes"): no ammo, a quick draw, a short reach, a
  // little faster on your feet; two hits kill. Always carried, never the spawn gun. Its look is the Armory's.
  knife: { n: "Knife", dmg: 55, head: 1.3, cd: 0.45, mag: 1, reload: 0, spread: 0, pellets: 1, range: 2.3, auto: false, zoom: 1, adsSpread: 1, adsMove: 1, secondary: true, melee: true, draw: 0.15, speed: 1.1, text: "No ammo, two hits. Faster on your feet. 5 or Q." },
  pistol: { n: "Pistol", dmg: 24, head: 1.5, cd: 0.2, mag: 12, reload: 1.0, spread: 0.014, pellets: 1, range: 60, auto: false, zoom: 1.3, adsSpread: 0.5, adsMove: 0.95, secondary: true, draw: 0.22, text: "The sidearm everyone carries. 24 a hit, 12 rounds, quick to draw. Q swaps to it." }
};
export const GUN_KEYS = Object.keys(GUNS);
export const PRIMARY_KEYS = GUN_KEYS.filter((k) => !GUNS[k].secondary);   // what you pick and spawn with
export const HEADSHOT = 1.5;
// the bots (2026-10-09, the owner: "make the bots worse so i can test better"): skill in [lo, hi] (aim and reaction), `react` scales how long they take to shoot
export const BOTS = { skill: [0.1, 0.4], react: 2.2, headChance: 0.15 };
/* XP and levels, shared by the page, the match server and the site's stats: a kill is 10 (a headshot 15), a win 100, finishing a round
   40, every streak of three 20. Level n needs 100 x n^1.5 more than the last. */
export const XP = { kill: 10, headshot: 15, win: 100, round: 40, streak3: 20 };
export const need = (lvl) => Math.round(100 * Math.pow(lvl, 1.5));
/** Level and the XP into it, from lifetime XP. */
export function levelOf(total) { let lvl = 1, xp = Math.max(0, Math.floor(total)); while (xp >= need(lvl)) { xp -= need(lvl); lvl++; } return { level: lvl, xp, next: need(lvl) }; }
export function xpForRound({ kills = 0, headshots = 0, streaks = 0, won = false }) { return kills * XP.kill + headshots * (XP.headshot - XP.kill) + streaks * XP.streak3 + XP.round + (won ? XP.win : 0); }
/* (2026-10-11, the owner: "make the bot names obvious … users think they are playing real players") Bots used to wear the regulars'
   names. Now every bot is plainly a bot; a real player who joins takes a bot's seat (the server's slotFor picks one, a dead one first). */
export const BOT_NAMES = ["Bot Dude #1", "Bot Bro #2", "Robo Ray", "Beep Boop", "NPC Nate", "Bot Betty", "Tin Man", "Autobean", "Bot Guy #7", "Mr Roboto", "Clanker", "Bot Bob", "Unit 11", "Bot Dude #13"];
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
  M.pickups = [{ kind: "health", x: 6, z: 0 }, { kind: "health", x: -6, z: 0 }, { kind: "ammo", x: 26, z: 30 }, { kind: "ammo", x: -26, z: 30 }, { kind: "ammo", x: 26, z: -30 }, { kind: "ammo", x: -26, z: -30 }];
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
  M.pickups = [{ kind: "health", x: 0, z: 0 }, { kind: "health", x: 24, z: 24 }, { kind: "ammo", x: 16, z: 6 }, { kind: "ammo", x: -16, z: -6 }, { kind: "ammo", x: 40, z: 0 }, { kind: "ammo", x: -40, z: 0 }];
  M.name = "The Docks"; M.blurb = "Three long lanes, two warehouses with ramps at both ends, a high catwalk, piers along the water."; M.sky = 0xf0c8a0; M.fog = [60, 150];
  return M;
}
/* The Rooftops (2026-10-09): five roofs over a street grid. A tower in the middle (roof at 8, a penthouse on it), four corner
   buildings at different heights (5 to 8), bridges from each corner roof to the tower, a ramp up from the street to every roof, and
   pads in the street corners and the mid-street that throw you onto a roof. The street is a slide lane grid between the buildings;
   nothing in it but four low blocks for cover. Long lines roof to roof for the sniper, close work in the street for the shotgun. */
function roofs() {
  const M = mapBuilder(42), { box, ramp, pad, walls } = M;
  box([0, -0.5, 0], [43, 0.5, 43], "concrete", C.DARK); walls(42, 8);
  box([0, 4, 0], [8, 4, 8], "brick", C.BRICK); box([0, 9, 0], [2.5, 1, 2.5], "metal", C.WHITE); box([0, 10.5, 0], [0.9, 0.5, 0.9], "crate", C.CRATE);
  const corners = [[1, 1, 6, "concrete", C.SAND], [-1, 1, 7, "brick", C.BLUE], [1, -1, 5, "concrete", C.STONE], [-1, -1, 8, "brick", C.RUST]];
  for (const [sx, sz, h, tex, col] of corners) {
    box([sx * 26, h / 2, sz * 26], [9, h / 2, 9], tex, col);                                             // the building
    ramp(sx * 26, sz * (17 - 2 * h), 0, sx * 26, sz * 17, h, 5, "concrete", C.STONE);                   // up from the street, onto the roof's inner edge
    ramp(sx * 18, sz * 18, h, sx * 9, sz * 9, 8, 3, "metal", C.DARK);                                   // the bridge to the tower
    box([sx * 30, h + 0.5, sz * 30], [1.2, 0.5, 1.2], "crate", C.CRATE);                                // a crate to stand behind
    pad(sx * 38, sz * 38, 21, { x: -sx * 7, z: -sz * 7 });                                              // the street corner throws you onto the roof
  }
  for (const [x, z, hx, hz] of [[0, 30, 5, 2.5], [0, -30, 5, 2.5], [30, 0, 2.5, 5], [-30, 0, 2.5, 5]]) box([x, 1.5, z], [hx, 1.5, hz], "concrete", C.WHITE);
  for (const [x, z] of [[0, 14], [0, -14], [14, 0], [-14, 0]]) pad(x, z, 22, { x: -Math.sign(x) * 8, z: -Math.sign(z) * 8 });   // mid-street, onto the tower
  M.spawns = [[26, 7, 26], [-26, 8, 26], [26, 6, -26], [-26, 9, -26], [0, 1, 38], [0, 1, -38], [38, 1, 0], [-38, 1, 0], [14, 1, -36], [-14, 1, 36], [36, 1, 14], [-36, 1, -14]];
  M.waypoints = [...M.spawns.map((s) => [s[0], s[2]]), [0, 0], [0, 5], [5, 0], [18, 18], [-18, 18], [18, -18], [-18, -18], [26, 10], [-26, 10], [26, -10], [-26, -10], [10, 26], [-10, 26], [10, -26], [-10, -26], [0, 22], [0, -22], [22, 0], [-22, 0], [38, 38], [-38, -38]];
  M.pickups = [{ kind: "health", x: 0, z: 5 }, { kind: "health", x: 0, z: -22 }, { kind: "ammo", x: 22, z: 22 }, { kind: "ammo", x: -22, z: 22 }, { kind: "ammo", x: 22, z: -22 }, { kind: "ammo", x: -22, z: -22 }];
  M.name = "The Rooftops"; M.blurb = "Five roofs over a street grid: bridges to the tower in the middle, ramps and pads up from the street, long lines for the sniper."; M.sky = 0xb0a0d8; M.fog = [70, 170];
  return M;
}
/* The Compound (2026-10-10, rebuilt as a small town — the owner: "actual corridors, walls and lanes and areas that you have to walk
   through"). Attackers start in a yard at the south, behind a wall with three gaps: the west lane, mid and the east lane. The lanes
   are corridors between solid buildings, crossed by a south street and a north street. Past the north street are the two sites: A is
   a walled courtyard on the west, B on the east, each with a door from the north street, a side door from a short corridor beside the
   centre building, and a back door onto the defenders' strip along the north edge. Bots walk it on the waypoint graph (nav). */
function compound() {
  const M = mapBuilder(40), { box, walls } = M;
  const wall = (x0, z0, x1, z1, h = 5, t = 0.6, tex = "brick", col = C.STONE) => box([(x0 + x1) / 2, h / 2, (z0 + z1) / 2], [Math.max(t / 2, Math.abs(x1 - x0) / 2), h / 2, Math.max(t / 2, Math.abs(z1 - z0) / 2)], tex, col);
  const crate = (x, z) => box([x, 0.6, z], [1.2, 0.6, 1.2], "crate", C.CRATE);
  box([0, -0.5, 0], [41, 0.5, 41], "concrete", C.STONE); walls(40, 7);
  // the yard wall, with the three gaps
  wall(-40, -28, -29, -28, 5); wall(-23, -28, -3, -28, 5); wall(3, -28, 23, -28, 5); wall(29, -28, 40, -28, 5);
  // buildings: the south pair, the big middle pair, the outer strips (so the lanes are corridors)
  box([-13, 3, -20], [10, 3, 5], "brick", C.BRICK); box([13, 3, -20], [10, 3, 5], "brick", C.BLUE);
  box([-13, 3, 2], [10, 3, 11], "concrete", C.SAND); box([13, 3, 2], [10, 3, 11], "concrete", C.WHITE);
  box([-34.5, 3, -7.5], [5.5, 3, 20.5], "brick", C.RUST); box([34.5, 3, -7.5], [5.5, 3, 20.5], "brick", C.RUST);
  // the centre building between the sites, with the two short corridors beside it
  box([0, 3, 27], [9, 3, 6], "metal", C.DARK);
  // site A (west) and B (east): courtyards with a front door, a side door and a back door
  for (const s of [-1, 1]) {
    const x0 = s * 12, x1 = s * 36, door = s * 24;                                            // the inner and outer x, the door column
    wall(Math.min(x0, x1), 19, Math.min(door - 2, door + 2), 19); wall(Math.max(door - 2, door + 2), 19, Math.max(x0, x1), 19);   // front wall, door at the lane
    wall(x0, 19, x0, 22); wall(x0, 26, x0, 33);                                                   // side wall, door onto the corridor
    wall(Math.min(x0, x1), 33, Math.min(door - 2, door + 2), 33); wall(Math.max(door - 2, door + 2), 33, Math.max(x0, x1), 33);   // back wall, door onto the defenders' strip
    wall(x1, 19, x1, 33);                                                                         // the outer wall
    crate(s * 30, 29); crate(s * 18, 21.5); box([s * 24, 0.8, 29.5], [3, 0.8, 0.5], "concrete", C.WHITE);   // (cover sits off the site's centre and off the lines between its doors, so the graph reaches the plant spot)
  }
  // street cover
  crate(-13, -14.2); crate(13, -14.2); crate(-28.2, 6); crate(28.2, 6);   // against the street's edge and the lane's wall, so the lane itself stays a clear line for the graph
  M.bomb = { sites: [{ k: "A", x: -24, z: 26, y: 0 }, { k: "B", x: 24, z: 26, y: 0 }], atk: [[-8, 1, -35], [0, 1, -36], [8, 1, -35]], def: [[-24, 1, 37], [0, 1, 37], [24, 1, 37]] };
  M.spawns = [...M.bomb.atk, ...M.bomb.def]; M.pickups = [];
  M.waypoints = [[-20, -34], [0, -34], [20, -34], [-26, -28], [0, -28], [26, -28], [-26, -12], [-13, -12], [0, -12], [13, -12], [26, -12], [-26, 2], [0, 2], [26, 2], [-26, 16], [-13, 16], [0, 16], [13, 16], [26, 16],
    [-10.5, 16], [10.5, 16], [-10.5, 24], [10.5, 24], [-24, 21], [24, 21], [-14, 24], [14, 24], [-24, 26], [24, 26], [-30, 25], [30, 25], [-24, 31], [24, 31], [-24, 36], [0, 36], [24, 36], [-10.5, 35], [10.5, 35]];
  M.name = "The Compound"; M.blurb = "A small town: three lanes through the buildings, two streets across, and two walled sites with three doors each. Attackers come from the south yard."; M.sky = 0xd8c8a8; M.fog = [70, 170];
  return M;
}
/* ------------------------------------------------------------------ parkour courses (2026-10-10, the owner: "a simple version of parkour")
   A course floats over nothing: a start platform, platforms and ramps and pads to a finish platform, checkpoints on the way. Fall below
   PARK.floor and you are put back on your last checkpoint with the clock running. No guns. The run is timed by whoever simulates it
   (the server online, the page in practice) in simulated time, so a time can be neither faked nor shortened by a fast clock. */
export const PARK = { floor: -8, ROTATE_S: 480, medalBrass: { gold: 100, silver: 60, bronze: 30 } };
function courseBuilder(size) {
  const M = mapBuilder(size); const plat = (x, top, z, w, d, tex = "concrete", col = C.STONE, h = 0.6) => M.box([x, top - h / 2, z], [w / 2, h / 2, d / 2], tex, col);
  M.plat = plat; M.walls = () => {}; return M;
}
function finishCourse(M, name, blurb, start, cps, finish, medals, sky) {
  const lowest = Math.min(...M.boxes.map((b) => b.c[1] + b.h[1]));
  M.park = { start, cps, finish, medals, facing: Math.PI, floor: lowest - 8 };   // facing π: along +z, the way every course runs; floor: eight below the lowest platform (The Long Way dips below the old fixed floor)
  M.spawns = [start]; M.waypoints = [[start[0], start[2]]]; M.pickups = []; M.name = name; M.blurb = blurb; M.sky = sky; M.fog = [90, 220]; M.course = true;
  return M;
}
/* The Long Way (2026-10-10, the owner: "significantly longer, with level checkpoints, slowly making it more difficult"): eight levels,
   each ending on a checkpoint platform, from plain hops to long slide-hop gaps over tiny tiles. A fall costs the level, never more. */
function course1() {
  const M = courseBuilder(120), { plat, ramp, pad, box } = M; const cps = []; let z = 0;
  const level = (k, x, y, zz, w = 7) => { plat(x, y, zz, w, w, "concrete", C.TEAL); cps.push({ x, z: zz, y, r: w / 2 - 0.5, k: `L${k}` }); };
  plat(0, 0, 0, 8, 8, "concrete", C.SAND); z = 9;
  // L1 hops: eight tiles, the gaps growing from 3 to 4
  for (let i = 0; i < 8; i++) { plat(0, 0, z, 4, 4); z += 7 + Math.floor(i / 3); } level(1, 0, 0, z); z += 8;
  // L2 steps: a zig-zag up, a bridge, a long ramp down
  let y = 0; for (let i = 0; i < 7; i++) { y += 1.2; plat(i % 2 ? 3.5 : -3.5, y, z, 4, 4); z += 5.5; }
  plat(0, y, z + 2, 3, 10, "metal", C.DARK); z += 8; ramp(0, z, y, 0, z + 14, 0, 5, "concrete", C.STONE); z += 17; level(2, 0, 0, z); z += 8;
  // L3 lanes: runways with gaps of 5, 6 and 7, each landing a little lower
  y = 0; for (const [len, gap] of [[12, 5], [12, 6], [12, 7]]) { plat(0, y, z + len / 2, 6, len, "metal", C.DARK); z += len + gap; y -= 1; } level(3, 0, y, z + 2); z += 10;
  // L4 beams: narrow and turning, with two-metre gaps
  let x = 0; for (let i = 0; i < 6; i++) { x += i % 2 ? -4 : 4; plat(x, y, z + 4, 1.4, 8, "metal", C.RUST); z += 10; } level(4, x, y, z + 2); z += 9;
  // L5 pads: three throws over big gaps, the last onto a high landing
  for (let i = 0; i < 2; i++) { pad(x, z, 17, { x: 0, z: 10 }); z += 18; plat(x, y, z, 5, 5); z += 4; }
  pad(x, z, 24, { x: 0, z: 9 }); z += 20; plat(x, y + 7, z, 8, 8, "concrete", C.SAND); level(5, x, y + 7, z + 3, 6); y += 7; z += 10;
  // L6 stairs and drops: a staircase of kerbs, then drops of four onto small tiles
  for (let i = 0; i < 6; i++) { box([x, y + 0.5 * (i + 1) - 0.3, z + i * 1.6], [2, 0.3, 0.8], "concrete", C.WHITE); } y += 3; z += 10; plat(x, y, z, 5, 5); z += 5;
  for (let i = 0; i < 4; i++) { y -= 4; z += 6; plat(x, y, z, 3, 3); } level(6, x, y, z + 6); z += 14;
  // L7 the climb: a spiral up around a column
  const cx = x, cz = z + 10; let yy = y; for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i * 0.52, r = 8; yy += 1.3; plat(cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r, 3, 3, "metal", C.DARK); }
  box([cx, (y + yy - 0.2) / 2, cz], [3.5, (yy - 0.2 - y) / 2, 3.5], "brick", C.BRICK);   // the column, from the level's floor to just under the top platform (a column through the platform swallowed it)
  level(7, cx, yy + 0.5, cz, 5); y = yy + 0.5; z = cz + 12;
  // L8 the gauntlet: a drop to a lane, then gaps of 8, 9 and 9 over tiny tiles, and a last leap to the finish
  plat(cx, y - 9, z + 6, 6, 12, "metal", C.DARK); y -= 9; z += 14;
  for (const gap of [8, 9, 9]) { z += gap; plat(cx, y, z, 2.6, 2.6, "metal", C.RUST); z += 2; }
  z += 9; plat(cx, y - 2, z + 4, 9, 9, "metal", C.DARK); level(8, cx, y - 2, z + 4, 9); cps.pop();   // the finish is the eighth level itself
  return finishCourse(M, "The Long Way", "Eight levels, each a little harder: hops, steps, lanes, beams, pads, drops, a climb, a gauntlet. A fall costs the level.", [0, 1, 0], cps, { x: cx, z: z + 4, y: y - 2, r: 4 }, [150, 200, 300], 0x8fc4ef);
}
/* Hop Line: long runways with gaps that need slide-hop speed, a pad chain in the middle. About 40 seconds for someone who can. */
function course2() {
  const M = courseBuilder(80), { plat, pad } = M;
  plat(0, 0, 0, 8, 10, "concrete", C.SAND); let z = 10; const cps = [];   // the start reaches z 5; the first runway begins at 10
  for (const [len, gap] of [[16, 6], [14, 7], [12, 8], [12, 8]]) { plat(0, 0, z + len / 2, 6, len, "metal", C.DARK); z += len + gap; }   // runways, the gaps widening
  plat(0, 0, z + 3, 6, 6, "concrete", C.TEAL); cps.push({ x: 0, z: z + 3, y: 0, r: 3 }); z += 10;
  for (let i = 0; i < 3; i++) { pad(0, z, 16, { x: 0, z: 10 }); z += 18; plat(0, 0, z, 5, 5); z += 4; }   // the pad chain
  plat(0, 0, z + 2, 6, 6, "concrete", C.TEAL); cps.push({ x: 0, z: z + 2, y: 0, r: 3 }); z += 8;
  for (const [len, gap, dy] of [[14, 8, -1], [12, 9, -2], [12, 9, -3]]) { plat(0, dy, z + len / 2, 6, len, "metal", C.DARK); z += len + gap; }   // dropping runways, longer gaps
  plat(0, -3, z + 2, 8, 8, "metal", C.RUST);
  return finishCourse(M, "Hop Line", "Runways and gaps that only a slide-hop clears, a pad chain, then longer gaps on the way down.", [0, 1, 0], cps, { x: 0, z: z + 2, y: -3, r: 3.5 }, [34, 44, 60], 0xf0c8a0);
}
/* The Tower: a spiral of platforms up around a column, then a drop to the finish. A fall costs the most here. About 45 seconds. */
function course3() {
  const M = courseBuilder(50), { plat, box } = M;
  plat(0, 0, -16, 8, 8, "concrete", C.SAND); box([0, 14, 0], [4, 14, 4], "brick", C.BRICK);   // the start, the column
  const cps = []; let y = 0;
  for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + i * 0.5, r = 9; y += 1.3; const x = Math.cos(a) * r, z = Math.sin(a) * r; const cp = i % 6 === 5; plat(x, y, z, cp ? 4 : 3, cp ? 4 : 3, cp ? "concrete" : "metal", cp ? C.TEAL : C.DARK); if (cp) cps.push({ x, z, y, r: 2.5 }); }
  plat(0, y + 0.5, 0, 6, 6, "metal", C.WHITE);                                                 // the top of the column
  plat(0, 2, 22, 10, 10, "metal", C.RUST);                                                   // the finish, far below: a jump off the top
  return finishCourse(M, "The Tower", "Up the spiral, platform by platform, with checkpoints every sixth; a leap off the top to the finish.", [0, 1, -16], cps, { x: 0, z: 22, y: 2, r: 4.5 }, [40, 52, 70], 0xb0a0d8);
}
export const MAPS = { lot, docks, roofs, compound, course1, course2, course3 };
export const PARK_MAPS = ["course1", "course2", "course3"];
/** A runner's state on a course. cp is the last checkpoint reached (-1: none), t the run clock, trail the positions sampled for a ghost. */
export function newRun() { return { cp: -1, t: 0, running: false, done: false, sampleT: 0, trail: [], best: null, falls: 0 }; }
export function parkPlace(world, b, where) { const s = where || world.map.park.start; placeBean(b, [s[0] ?? s.x, (s[1] ?? s.y) + 0.2, s[2] ?? s.z], "ar", null); b.facing = world.map.park.facing; b.v.set(0, 0, 0); }
/** One step of one runner, after their movement. Starts the clock when they leave the start, counts checkpoints in order, resets a fall
    to the last checkpoint, stops at the finish. */
export function parkStep(world, b, dt, events) {
  const P = world.map.park; if (!P || b.dead) return; const r = b.park || (b.park = newRun());
  if (r.done) return;
  if (!r.running) { if (Math.hypot(b.p.x - P.start[0], b.p.z - P.start[2]) > 4.5 || b.p.y < P.start[1] - 1) { r.running = true; r.t = 0; r.trail = []; r.sampleT = 0; events?.push({ type: "park", what: "start", s: b.i }); } else return; }
  r.t += dt; r.sampleT += dt; if (r.sampleT >= 0.1) { r.sampleT -= 0.1; if (r.trail.length < 1800) r.trail.push([Math.round(b.p.x * 20) / 20, Math.round(b.p.y * 20) / 20, Math.round(b.p.z * 20) / 20]); }
  if (b.p.y < (P.floor ?? PARK.floor)) { r.falls++; const cp = r.cp >= 0 ? P.cps[r.cp] : null; parkPlace(world, b, cp ? [cp.x, cp.y, cp.z] : null); events?.push({ type: "park", what: "fall", s: b.i, cp: r.cp }); return; }
  const next = P.cps[r.cp + 1];
  if (next && Math.hypot(b.p.x - next.x, b.p.z - next.z) < next.r && Math.abs(b.p.y - next.y) < 3) { r.cp++; events?.push({ type: "park", what: "cp", s: b.i, i: r.cp, t: Math.round(r.t * 1000) }); }
  if (r.cp === P.cps.length - 1 && Math.hypot(b.p.x - P.finish.x, b.p.z - P.finish.z) < P.finish.r && Math.abs(b.p.y - P.finish.y) < 3 && b.grounded) {
    r.done = true; const ms = Math.round(r.t * 1000), pb = r.best === null || ms < r.best; if (pb) r.best = ms;
    events?.push({ type: "park", what: "finish", s: b.i, ms, pb, falls: r.falls });
  }
}
export function parkReset(world, b, events) { b.park = { ...newRun(), best: b.park?.best ?? null }; parkPlace(world, b, null); events?.push({ type: "park", what: "reset", s: b.i }); }
export const medalFor = (ms, medals) => (ms <= medals[0] * 1000 ? "gold" : ms <= medals[1] * 1000 ? "silver" : ms <= medals[2] * 1000 ? "bronze" : null);
export const BOMB_MAP = "compound";
export const MAP_LIST = ["lot", "docks", "roofs"];   // the free-for-all rotation; the bomb map is its own mode

/** A map, built: the boxes as physics, the pads, the spawns. */
export class World {
  constructor(key) { this.key = key; this.map = MAPS[key](); this.boxes = this.map.boxes.map((m) => new Box(m)); this.pads = this.map.pads; this.spawns = this.map.spawns; this.waypoints = this.map.waypoints;
    this.pickups = (this.map.pickups || []).map((p) => ({ ...p, y: this.groundAt(p.x, p.z), t: 0 })); this.nav = buildNav(this); }
  /** The height of the ground under (x, z), seen from `from`. */
  groundAt(x, z, from = 50) { const o = new V(x, from, z), d = new V(0, -1, 0); let best = Infinity; for (const b of this.boxes) best = Math.min(best, rayBox(o, d, b)); return from - best; }
}

/* ------------------------------------------------------------------ beans */
export function newBean(i, name, bot) {
  return { i, name, bot, p: new V(), v: new V(), facing: 0, aim: new V(0, 0, -1), hp: RULES.MAX_HP, dead: false, respawn: 0, gun: "ar", ammo: 30, reloading: 0, cd: 0.5, hurtT: -99, kills: 0, deaths: 0, streak: 0, bestStreak: 0, shots: 0, hits: 0,
    grounded: false, coyote: 0, slide: false, slideT: 0, slideCd: 0, landT: 9, lastBy: null, lastByT: -99, skill: 0.6, target: null, think: 0, look: 0, strafe: 1, strafeT: 0, stuck: 0, wp: null, react: 1, lostT: 0 };
}
/** A spawn away from the fighting but not a predictable one (2026-10-09, the owner: "i always respawn in the same place"): every spawn
    is scored by its distance to the nearest living player, the one this bean used last is left out, and the pick is random among the
    three safest — never one that is much closer to someone than the safest is. The old rule took the single farthest with a little noise,
    and the emptiest corner kept winning, which is what makes spawn camping work. */
export function spawnFor(world, beans, b, rand = Math.random) {
  const scored = world.spawns.map((s, i) => { let d = 1e9; for (const o of beans) if (o !== b && !o.dead) d = Math.min(d, Math.hypot(o.p.x - s[0], o.p.z - s[2])); return { s, i, d }; })
    .filter((x) => world.spawns.length < 2 || x.i !== b.lastSpawn).sort((x, y) => y.d - x.d);
  const pool = scored.slice(0, 3).filter((x, k) => k === 0 || x.d >= scored[0].d * 0.6);
  const pick = pool[Math.floor(rand() * pool.length)]; b.lastSpawn = pick.i; return pick.s;
}
export function respawnBean(world, beans, b, gun, rand = Math.random, events) { placeBean(b, spawnFor(world, beans, b, rand), gun, events); }
export function placeBean(b, s, gun, events) {
  b.dead = false; b.hp = RULES.MAX_HP; b.hurtT = -99; b.gun = GUNS[gun] ? gun : "ar"; b.ammo = GUNS[b.gun].mag; b.mags = {}; b.reloading = 0; b.cd = 0.3; b.slide = false; b.streak = 0;
  b.p.set(s[0], s[1] + 0.2, s[2]); b.v.set(0, 0, 0); b.facing = Math.atan2(-s[0], -s[2]) + Math.PI;   // facing the middle of the map (the page looks along -sin/-cos of the facing; without the +π everyone spawned looking at the wall behind them, 2026-10-09)
  events?.push({ type: "spawn", b });
}

/** A shot from o along unit d: the first thing it meets. The head counts for more. */
export function cast(world, beans, o, d, shooter, range = 80) {
  let best = range, bean = null, head = false;
  for (const b of world.boxes) { const tt = rayBox(o, d, b); if (tt < best) { best = tt; bean = null; } }
  for (const b of beans) { if (b === shooter || b.dead || (shooter?.team !== undefined && b.team === shooter.team)) continue; const th = raySphere(o, d, b.p.x, b.p.y + PHYS.HEAD_Y, b.p.z, 0.4); if (th < best) { best = th; bean = b; head = true; } const tb = raySphere(o, d, b.p.x, b.p.y + 0.1, b.p.z, 0.55); if (tb < best) { best = tb; bean = b; head = false; } }
  return { t: best, bean, head, point: o.clone().addScaled(d, best) };
}
export function damage(target, dmg, from, head, now, events) {
  if (target.dead) return;
  target.hp -= dmg; target.hurtT = now; target.lastBy = from; target.lastByT = now;
  if (from) { from.hits++; }
  events?.push({ type: "hit", target, by: from, dmg, head });
  if (target.hp <= 0) kill(target, from, head, now, events);
}
/* GUN GAME (2026-10-11): every kill moves the killer one step up the ladder, with the next gun in hand at once; a knife kill sends the
   victim one step back; the first to the top wins the round. `b.gg` is the step (set by the room; undefined elsewhere). */
export const GG = { ladder: ["ar", "ar", "sniper", "sniper", "shotgun", "shotgun", "pistol", "pistol", "knife"] };
export const ggGun = (b) => GG.ladder[Math.min(b.gg || 0, GG.ladder.length - 1)];
export function kill(target, by, head, now, events) {
  target.dead = true; target.respawn = RULES.RESPAWN_S; target.deaths++; target.streak = 0; target.slide = false;
  const suicide = !by || by === target;
  if (!suicide) { by.kills++; by.streak++; by.bestStreak = Math.max(by.bestStreak, by.streak); }
  events?.push({ type: "kill", target, by: suicide ? null : by, head });
  if (!suicide && by.gg !== undefined) {
    if (by.gun === "knife" && target.gg > 0) { target.gg--; events?.push({ type: "gg", what: "down", s: target.i, step: target.gg }); }
    by.gg++; events?.push({ type: "gg", what: by.gg >= GG.ladder.length ? "win" : "up", s: by.i, step: by.gg });
    if (by.gg < GG.ladder.length) { const next = ggGun(by); if (next !== by.gun) { by.mags = {}; switchGun(by, next, events); } }
  }
}
/** Fire b's gun along dir (unit). `spreadK` scales the spread (scoped, airborne). Returns the pellets as {from, to, hit}. */
export function fire(world, beans, b, dir, now, rand, events, spreadK = 1) {
  const g = GUNS[b.gun]; b.cd = g.cd; if (!g.melee) b.ammo--; b.shots++;
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
/** Switching guns is instant, like Krunker (2026-10-09, the owner): the gun in hand changes now, with a short draw (SWAP_S) before it can
    fire. Each gun keeps its OWN magazine on the bean (`mags`), so swapping away and back is not a free reload; a swap cancels a reload. */
export const SWAP_S = 0.35;
export function switchGun(b, k, events) {
  if (!GUNS[k] || k === b.gun || b.dead) return false;
  b.mags ||= {}; b.mags[b.gun] = b.ammo; b.gun = k; b.ammo = b.mags[k] ?? GUNS[k].mag; b.reloading = 0; b.cd = Math.max(b.cd, GUNS[k].draw ?? SWAP_S);
  events?.push({ type: "swap", b }); return true;
}

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
  if (inp.jump && !b.grounded && b.coyote <= 0) b.jumpBuf = P.JUMP_BUF; else if (b.jumpBuf > 0) b.jumpBuf = Math.max(0, b.jumpBuf - dt);   // a press just before the landing is kept for it
  const jumped = (inp.jump || b.jumpBuf > 0) && b.coyote > 0 && b.v.y < 3;
  if (jumped) b.jumpBuf = 0;
  if (b.slide) { b.slideT += dt; steer(1.8); setSpeed(hs * Math.exp(-(b.slideT > SL.long ? 3 : SL.decay) * dt)); if (jumped) setSpeed(Math.min(SL.max, hs + SL.hop)); if (jumped || !inp.slide || !b.grounded || hs < SL.min * 0.7) { b.slide = false; b.slideCd = SL.cd; } }
  else if (hs > P.RUN + 0.2) { if (b.grounded) { steer(4); setSpeed(Math.max(P.RUN, hs - SL.drain * dt)); } else steer(2.6); }
  else { const acc = b.grounded ? P.ACC_GROUND : P.ACC_AIR, run = P.RUN * (inp.scope ? G.adsMove ?? 1 : 1) * (G.speed ?? 1); b.v.x += clamp(inp.x * run - b.v.x, -acc * dt, acc * dt); b.v.z += clamp(inp.z * run - b.v.z, -acc * dt, acc * dt); }
  if (jumped) { b.v.y = P.JUMP; b.coyote = 0; b.grounded = false; events?.push({ type: "jump", b }); }
  if (inp.aim) b.aim.copy(inp.aim);
  if ((G.auto ? inp.fire : inp.fireTap) && b.cd <= 0 && !b.reloading) { if (b.ammo > 0) fire(world, beans, b, b.aim, now, rand, events, (opts.spreadK ?? (inp.scope ? G.adsSpread ?? 1 : 1)) * (b.grounded ? 1 : 1.6)); else if (!reload(b, events)) events?.push({ type: "empty", b }); }   // the click only when a reload could not start (already reloading): the two at once sounded like a double (2026-10-10)
  if (b.ammo === 0 && !b.reloading && b.cd <= 0) reload(b, events);   // an empty gun reloads on its own (2026-10-09, the owner)
  if (want !== null && !b.bot) b.facing = want + Math.PI; else if (b.bot && want !== null && !b.target) b.facing = want + Math.PI;
  b.v.y += P.G * dt; b.p.addScaled(b.v, dt);
  const wasGrounded = b.grounded; b.grounded = false;
  for (const box of world.boxes) {
    if (!sphereBox(b.p, P.R, box, hit)) continue;
    // a low ledge (a rail, a crate, a kerb) is stepped onto rather than run into: that's what keeps a slide alive
    if (box.flat && Math.abs(hit.n.y) < 0.3 && box.top - (b.p.y - P.R) < (wasGrounded ? P.STEP_UP : P.MANTLE) && box.top > b.p.y - P.R && (wasGrounded || b.v.dot(hit.n) < 0)) { b.p.y = box.top + P.R + 0.01; b.grounded = true; if (b.v.y < 0) b.v.y = 0; continue; }   // a ledge met in the air, moving into it, is climbed (the mantle); on the ground a kerb is stepped
    b.p.addScaled(hit.n, hit.pen); const vn = b.v.dot(hit.n); if (vn < 0) b.v.addScaled(hit.n, -vn); if (hit.n.y > 0.6) b.grounded = true;
  }
  if (b.grounded && !wasGrounded) b.landT = 0;
  if (b.grounded && b.v.y <= 0.5) for (const pd of world.pads) if (Math.abs(b.p.x - pd.x) < 1.2 && Math.abs(b.p.z - pd.z) < 1.2 && b.p.y < 1.2) { b.v.y = pd.up; if (pd.fwd) { b.v.x += pd.fwd.x; b.v.z += pd.fwd.z; } b.grounded = false; b.slide = false; events?.push({ type: "pad", b }); break; }
  if (b.p.y < RULES.FALL_Y && !world.map.park) { kill(b, null, false, now, events); events?.push({ type: "fell", b }); }   // (a course has its own floor: a fall there is a checkpoint, never a death)
  if (!b.dead && world.pickups?.length) takePickups(world, b, events);
}
/** Everyone, one tick, from a function that gives each bean its input. Respawns the dead whose time is up (the server decides the gun). */
/* PICKUPS (2026-10-09, the owner: "build the pickups"): a health pack (+50, never past full) and an ammo box (every magazine refilled)
   at fixed spots on each map, sitting on whatever is under them. Walking through one takes it when it would do something, and it is back
   PICKUP.respawn seconds later. The server owns the timers (its snapshot carries them); the page predicts its own take so it vanishes at
   once; bots take them too, so a fight has reasons to move. */
export const PICKUP = { respawn: 25, health: 50, r: 1.1 };
export function tickPickups(world, dt) { for (const p of world.pickups) if (p.t > 0) p.t = Math.max(0, p.t - dt); }
export function takePickups(world, b, events) {
  for (let i = 0; i < world.pickups.length; i++) {
    const p = world.pickups[i]; if (p.t > 0 || Math.abs(b.p.x - p.x) >= PICKUP.r || Math.abs(b.p.z - p.z) >= PICKUP.r || b.p.y < p.y - 0.6 || b.p.y > p.y + 1.6) continue;
    if (p.kind === "health") { if (b.hp >= RULES.MAX_HP) continue; b.hp = Math.min(RULES.MAX_HP, b.hp + PICKUP.health); }
    else { let need = b.ammo < GUNS[b.gun].mag; for (const k of GUN_KEYS) if ((b.mags?.[k] ?? GUNS[k].mag) < GUNS[k].mag) need = true; if (!need) continue; b.mags = {}; b.ammo = GUNS[b.gun].mag; b.reloading = 0; }
    p.t = PICKUP.respawn; events?.push({ type: "pickup", b, kind: p.kind, i });
  }
}
export function stepWorld(world, beans, dt, now, inputFor, rand, events, gunFor = () => "ar") {
  tickPickups(world, dt);
  for (const b of beans) { if (b.dead && b.respawn <= 0) continue; stepBean(world, beans, b, b.dead ? {} : inputFor(b), dt, now, rand, events); }
  for (const b of beans) if (b.dead && b.respawn <= 0 && b.wantsRespawn !== false) respawnBean(world, beans, b, gunFor(b), rand, events);
  for (let i = 0; i < beans.length; i++) for (let j = i + 1; j < beans.length; j++) { const a = beans[i], c = beans[j]; if (a.dead || c.dead) continue; _d.copy(c.p).sub(a.p); const d = _d.len(); if (d < PHYS.R * 2 && d > 1e-4) { _d.scale(1 / d); const push = (PHYS.R * 2 - d) / 2; a.p.addScaled(_d, -push); c.p.addScaled(_d, push); } }
}

/* ------------------------------------------------------------------ nav: the waypoint graph bots walk (2026-10-10)
   Bots used to walk straight at wherever they wanted to be and jump when stuck, which a map of corridors turns into face-planting.
   Now the waypoints are a graph: two are joined when the straight line between them crosses no wall (a box that stands above knee
   height, grown by the bean's radius; a box whose top is at the height of either end is a floor, not a wall, so a ramp onto a platform
   still counts). `navNext(world, p, goal)` gives the next point to walk toward: the goal itself when the way is clear, otherwise the
   first corner of the shortest path through the graph. Dijkstra over forty nodes is nothing. */
function segHitsRect(ax, az, bx, bz, r) {   // Liang-Barsky: does the segment cross the rectangle
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - r.x0], [dx, r.x1 - ax], [-dz, az - r.z0], [dz, r.z1 - az]]) { if (p === 0) { if (q < 0) return false; continue; } const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  return true;
}
function buildNav(world) {
  const nodes = (world.waypoints || []).map(([x, z]) => ({ x, z, y: world.groundAt(x, z) }));
  const rects = world.boxes.filter((b) => b.flat && b.top > 0.9).map((b) => ({ x0: b.c.x - b.h.x - 0.55, x1: b.c.x + b.h.x + 0.55, z0: b.c.z - b.h.z - 0.55, z1: b.c.z + b.h.z + 0.55, top: b.top, bottom: b.c.y - b.h.y }));
  const clear = (ax, az, ay, bx, bz, by) => { const floor = Math.max(ay, by) + 0.7; for (const r of rects) { if (r.top <= floor || r.bottom > Math.min(ay, by) + 2) continue; if (segHitsRect(ax, az, bx, bz, r)) return false; } return true; };
  const adj = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 45 && clear(a.x, a.z, a.y, b.x, b.z, b.y)) { adj[i].push([j, d]); adj[j].push([i, d]); } }
  return { nodes, adj, clear };
}
export function navNext(world, p, goal) {
  const nav = world.nav; if (!nav || !nav.nodes.length) return goal;
  const gy = goal.y ?? world.groundAt(goal.x, goal.z);
  if (nav.clear(p.x, p.z, p.y, goal.x, goal.z, gy)) return goal;
  // the end node: the nearest one that sees the goal. Then the distances to it from every node (Dijkstra from the end, the graph is
  // undirected), and the START node is the visible one that makes the whole trip shortest — never simply the nearest, which from
  // between two waypoints is the one behind you, and sent bots back and forth forever (2026-10-10)
  let e = -1, ed = 1e9, eAny = -1, eAnyD = 1e9;
  for (let i = 0; i < nav.nodes.length; i++) { const n = nav.nodes[i], d = Math.hypot(n.x - goal.x, n.z - goal.z); if (d < eAnyD) { eAnyD = d; eAny = i; } if (d < ed && nav.clear(n.x, n.z, n.y, goal.x, goal.z, gy)) { ed = d; e = i; } }
  if (e < 0) e = eAny;
  const dist = new Array(nav.nodes.length).fill(1e9), prev = new Array(nav.nodes.length).fill(-1), done = new Array(nav.nodes.length).fill(false); dist[e] = 0;
  for (;;) { let u = -1, ud = 1e9; for (let i = 0; i < dist.length; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; } if (u < 0) break; done[u] = true; for (const [v, w] of nav.adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } }
  let s = -1, sd = 1e9, sAny = -1, sAnyD = 1e9;
  for (let i = 0; i < nav.nodes.length; i++) { const n = nav.nodes[i], d = Math.hypot(n.x - p.x, n.z - p.z); if (d < sAnyD) { sAnyD = d; sAny = i; } if (dist[i] < 1e9 && d + dist[i] < sd && nav.clear(p.x, p.z, p.y, n.x, n.z, n.y)) { sd = d + dist[i]; s = i; } }
  if (s < 0) return nav.nodes[sAny];
  const n = Math.hypot(nav.nodes[s].x - p.x, nav.nodes[s].z - p.z) < 1.3 && prev[s] >= 0 ? prev[s] : s;   // already on the start node: the next hop
  return nav.nodes[n];
}

/* ------------------------------------------------------------------ the bomb mode (2026-10-09, the owner: "a very primitive 3v3 version of Counterstrike plant the bomb")
   Two teams of three. One team attacks: one of them carries the bomb and must plant it at a site (hold E inside the site for PLANT_S) and
   keep it alive for FUSE_S; the defenders stop that by killing the attackers before a plant, by defusing (hold E at the bomb for
   DEFUSE_S), or by running out the clock. Nobody respawns inside a round. First to WIN rounds; sides swap after SWAP_AT. No money, no
   buying: everyone picks a primary as in free-for-all. One carrier; the bomb drops where they die and any attacker walks over it.
   `b.team` is the group (0 or 1) and `bomb.atk` says which group attacks now. This file runs the round for the server and for practice. */
export const BOMB = { TEAM: 3, ROUND_S: 90, FREEZE_S: 6, POST_S: 4, PLANT_S: 4, FUSE_S: 35, DEFUSE_S: 6, WIN: 6, SWAP_AT: 5, SITE_R: 4.5, PICK_R: 1.4, DEFUSE_R: 2.4, BLAST_R: 14 };
export function newBomb() { return { phase: "freeze", t: BOMB.FREEZE_S, round: 1, score: [0, 0], atk: 0, carrier: -1, drop: null, planted: null, act: null, lastWin: null, over: false, done: false, siteFor: 0 }; }
export const isAtk = (b, bomb) => b.team === bomb.atk;
/** Seats both teams and starts a round: freeze, then live. `gunFor(b)` names each bean's primary. */
export function bombStartRound(world, beans, bomb, gunFor, rand = Math.random, events) {
  const seats = { [bomb.atk]: world.map.bomb.atk, [1 - bomb.atk]: world.map.bomb.def }, used = { 0: 0, 1: 0 };
  for (const b of beans) { if (b.team === undefined) continue; const list = seats[b.team], s = list[Math.min(used[b.team]++, list.length - 1)]; placeBean(b, s, gunFor(b), events); b.roundGun = b.gun; b.facing = b.team === bomb.atk ? Math.PI : 0; b.use = false; }   // roundGun: the primary this round is played with (a swap back to it is always allowed)
  const atk = beans.filter((b) => b.team === bomb.atk);
  bomb.phase = "freeze"; bomb.t = BOMB.FREEZE_S; bomb.carrier = atk.length ? atk[Math.floor(rand() * atk.length)].i : -1; bomb.drop = null; bomb.planted = null; bomb.act = null; bomb.siteFor = Math.floor(rand() * world.map.bomb.sites.length);
  events?.push({ type: "bomb", what: "round", round: bomb.round, score: bomb.score.slice(), atk: bomb.atk, carrier: bomb.carrier });
}
const nearXZ = (b, p, r, dy = 2.5) => Math.abs(b.p.x - p.x) < r && Math.abs(b.p.z - p.z) < r && Math.abs(b.p.y - p.y) < dy;
export function siteAt(world, b) { const sites = world.map.bomb?.sites || []; for (let i = 0; i < sites.length; i++) if (nearXZ(b, sites[i], BOMB.SITE_R, 3.5)) return i; return -1; }
function roundWin(bomb, team, why, events) {
  bomb.score[team]++; bomb.phase = "post"; bomb.t = BOMB.POST_S; bomb.lastWin = { team, why }; bomb.act = null;
  if (bomb.score[team] >= BOMB.WIN) bomb.over = true;
  events?.push({ type: "bomb", what: "win", team, why, score: bomb.score.slice(), over: bomb.over });
}
/** One tick of the round. `useOf(b)` says whether that bean is holding E. Movement is stepped by the caller (frozen in the freeze). */
export function bombStep(world, beans, bomb, dt, now, useOf, gunFor, rand, events) {
  if (bomb.done) return;
  if (bomb.phase === "freeze") { bomb.t -= dt; if (bomb.t <= 0) { bomb.phase = "live"; bomb.t = BOMB.ROUND_S; events?.push({ type: "bomb", what: "go" }); } return; }
  if (bomb.phase === "post") {
    bomb.t -= dt; if (bomb.t > 0) return;
    if (bomb.over) { bomb.done = true; events?.push({ type: "bomb", what: "match", team: bomb.lastWin.team, score: bomb.score.slice() }); return; }
    bomb.round++; if (bomb.round === BOMB.SWAP_AT + 1) bomb.atk = 1 - bomb.atk;
    bombStartRound(world, beans, bomb, gunFor, rand, events); return;
  }
  const team = (t) => beans.filter((b) => b.team === t), atk = team(bomb.atk), def = team(1 - bomb.atk), alive = (b) => !b.dead;
  if (bomb.carrier >= 0 && beans[bomb.carrier].dead) { const c = beans[bomb.carrier]; bomb.drop = { x: c.p.x, y: Math.max(c.p.y, world.groundAt(c.p.x, c.p.z)), z: c.p.z }; bomb.carrier = -1; if (bomb.act?.kind === "plant") bomb.act = null; events?.push({ type: "bomb", what: "drop", s: c.i }); }
  if (bomb.carrier < 0 && bomb.drop && !bomb.planted) for (const b of atk) if (alive(b) && nearXZ(b, bomb.drop, BOMB.PICK_R)) { bomb.carrier = b.i; bomb.drop = null; events?.push({ type: "bomb", what: "pick", s: b.i }); break; }
  if (!bomb.planted && bomb.carrier >= 0) {
    const c = beans[bomb.carrier], site = siteAt(world, c);
    if (site >= 0 && useOf(c) && c.grounded && !c.dead) {
      if (!bomb.act || bomb.act.kind !== "plant") { bomb.act = { kind: "plant", s: c.i, t: 0, site }; events?.push({ type: "bomb", what: "planting", s: c.i, site }); }
      bomb.act.t += dt;
      if (bomb.act.t >= BOMB.PLANT_S) { bomb.planted = { site, t: BOMB.FUSE_S, x: c.p.x, y: c.p.y, z: c.p.z }; bomb.carrier = -1; bomb.act = null; events?.push({ type: "bomb", what: "planted", s: c.i, site }); }
    } else if (bomb.act?.kind === "plant") bomb.act = null;
  }
  if (bomb.planted) {
    bomb.planted.t -= dt;
    let d = null; for (const b of def) if (alive(b) && useOf(b) && nearXZ(b, bomb.planted, BOMB.DEFUSE_R)) { d = b; break; }
    if (d) { if (!bomb.act || bomb.act.kind !== "defuse" || bomb.act.s !== d.i) { bomb.act = { kind: "defuse", s: d.i, t: 0 }; events?.push({ type: "bomb", what: "defusing", s: d.i }); } bomb.act.t += dt; if (bomb.act.t >= BOMB.DEFUSE_S) { events?.push({ type: "bomb", what: "defused", s: d.i }); return roundWin(bomb, 1 - bomb.atk, "defused", events); } }
    else if (bomb.act?.kind === "defuse") bomb.act = null;
    if (bomb.planted.t <= 0) { for (const b of beans) if (alive(b) && nearXZ(b, bomb.planted, BOMB.BLAST_R, 6)) kill(b, null, false, now, events); events?.push({ type: "bomb", what: "boom", site: bomb.planted.site }); return roundWin(bomb, bomb.atk, "boom", events); }
  }
  if (!def.some(alive)) return roundWin(bomb, bomb.atk, "wipe", events);
  if (!atk.some(alive) && !bomb.planted) return roundWin(bomb, 1 - bomb.atk, "wipe", events);
  bomb.t -= dt; if (bomb.t <= 0 && !bomb.planted) return roundWin(bomb, 1 - bomb.atk, "time", events);
}
/** Where a bot should go in the bomb mode, and whether to hold E there. Attackers: the carrier goes to plant, the others follow the
    carrier or the dropped bomb, then guard the plant. Defenders split across the sites and go to defuse a planted bomb. */
export function bombGoal(world, beans, b, bomb) {
  if (b.team === undefined || bomb.phase !== "live") return null;
  const sites = world.map.bomb.sites;
  if (isAtk(b, bomb)) {
    if (bomb.planted) { const p = bomb.planted; return { x: p.x + ((b.i % 3) - 1) * 3, z: p.z - 3, r: 2.5 }; }
    if (bomb.carrier === b.i) { const s = sites[bomb.siteFor]; return { x: s.x, z: s.z, r: 2, use: true }; }
    if (bomb.carrier < 0 && bomb.drop) return { x: bomb.drop.x, z: bomb.drop.z, r: 0.8 };
    if (bomb.carrier >= 0) { const c = beans[bomb.carrier]; return { x: c.p.x + ((b.i % 3) - 1) * 2.5, z: c.p.z - 2, r: 3 }; }
    const s = sites[bomb.siteFor]; return { x: s.x, z: s.z, r: 3 };
  }
  if (bomb.planted) { const p = bomb.planted; return { x: p.x, z: p.z, r: 1.6, use: true }; }
  const s = sites[b.i % sites.length]; return { x: s.x + ((b.i % 2) ? 3 : -3), z: s.z + 4, r: 3 };
}

/* ------------------------------------------------------------------ bots: the stand-ins for people, and the fillers for empty slots */
export function canSee(world, beans, b, o) { const eye = b.p.clone(); eye.y += PHYS.EYE; const d = new V(o.p.x - b.p.x, o.p.y + 0.3 - eye.y, o.p.z - b.p.z); const dist = d.len(); d.scale(1 / dist); return cast(world, beans, eye, d, b, dist + 1).bean === o; }
export function botInput(world, beans, b, dt, rand = Math.random, goal = null) {
  const rr = (a, c) => a + rand() * (c - a), pick = (a) => a[Math.floor(rand() * a.length)];
  b.think -= dt; b.strafeT -= dt; b.look -= dt;
  if (b.look <= 0) {
    b.look = rr(0.25, 0.5); let best = null, bs = 1e9;
    for (const o of beans) { if (o === b || o.dead || (b.team !== undefined && o.team === b.team)) continue; const d = o.p.dist(b.p); if (d < bs && d < 50 && canSee(world, beans, b, o)) { bs = d; best = o; } }
    if (best) { b.target = best; b.lostT = 0; } else if (b.target) { b.lostT += 0.4; if (b.lostT > 2.5 || b.target.dead) b.target = null; }
  }
  if (b.strafeT <= 0) { b.strafe = rand() < 0.5 ? -1 : 1; b.strafeT = rr(0.5, 1.4); }
  let mx = 0, mz = 0, fireNow = false, jump = false;
  if (goal?.use && Math.hypot(goal.x - b.p.x, goal.z - b.p.z) < (goal.r || 1.5)) { b.stuck = 0; return { x: 0, z: 0, jump: false, fire: false, fireTap: false, slide: false, reload: b.ammo === 0 && !b.reloading, use: true }; }   // on the job: plant or defuse, whatever is shooting
  const tg = b.target && !b.target.dead && !(goal?.use && b.target.p.dist(b.p) > 14) ? b.target : null;   // a carrier or a defuser is not pulled off the job by someone far away
  if (tg) {
    const dx = tg.p.x - b.p.x, dz = tg.p.z - b.p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const want = b.gun === "shotgun" ? 4 : b.gun === "sniper" ? 18 : 10, along = d > want + 3 ? 1 : d < want - 3 ? -0.7 : 0;
    mx = ux * along + -uz * b.strafe * 0.9; mz = uz * along + ux * b.strafe * 0.9; b.facing = Math.atan2(ux, uz) + Math.PI;
    if (b.cd <= 0 && !b.reloading && b.react <= 0 && b.ammo > 0) {
      const lead = d / 90, aim = new V(tg.p.x + tg.v.x * lead - b.p.x, tg.p.y + (rand() < b.skill * BOTS.headChance ? PHYS.HEAD_Y : 0.1) - (b.p.y + PHYS.EYE), tg.p.z + tg.v.z * lead - b.p.z).normalize();
      const spread = 0.04 + 0.18 * (1 - b.skill) + (Math.hypot(b.v.x, b.v.z) > 6 ? 0.05 : 0) + (Math.hypot(tg.v.x, tg.v.z) > 8 ? 0.07 : 0);
      aim.x += rr(-spread, spread); aim.y += rr(-spread, spread) * 0.5; aim.z += rr(-spread, spread); aim.normalize();
      b.aim.copy(aim); fireNow = true; b.react = (GUNS[b.gun].auto ? rr(0.06, 0.22) : rr(0.35, 0.9) * (1.3 - b.skill)) * BOTS.react;
    }
  } else {
    if (goal) { b.wp = [goal.x, goal.z]; if (Math.hypot(goal.x - b.p.x, goal.z - b.p.z) < (goal.r || 1.5)) { b.stuck = 0; return { x: 0, z: 0, jump: false, fire: false, fireTap: false, slide: false, reload: b.ammo === 0 && !b.reloading, use: Boolean(goal.use) }; } }
    else if (!b.wp || Math.hypot(b.wp[0] - b.p.x, b.wp[1] - b.p.z) < 1.5 || b.think <= 0) { b.wp = pick(world.waypoints); b.think = rr(4, 8); }
    // the next corner on the way there (recomputed a few times a second), not the straight line
    b.navT = (b.navT ?? 0) - dt; if (b.navT <= 0 || !b.navTo || b.navKey !== `${b.wp[0]},${b.wp[1]}`) { b.navTo = navNext(world, b.p, { x: b.wp[0], z: b.wp[1] }); b.navT = 0.35; b.navKey = `${b.wp[0]},${b.wp[1]}`; }
    const dx = b.navTo.x - b.p.x, dz = b.navTo.z - b.p.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; b.facing = Math.atan2(mx, mz) + Math.PI;
  }
  b.react = Math.max(0, b.react - dt);
  const reloadNow = b.ammo === 0 && !b.reloading;
  const sp = Math.hypot(b.v.x, b.v.z); if (b.grounded && (mx || mz) && sp < 1.5) { b.stuck += dt; if (b.stuck > 0.4) jump = true; if (b.stuck > 2) { b.wp = pick(world.waypoints); b.stuck = 0; } } else b.stuck = 0;
  if (b.grounded && tg && rand() < dt * (0.3 + (RULES.MAX_HP - b.hp) * 0.01)) jump = true;
  return { x: mx, z: mz, jump, fire: fireNow, fireTap: fireNow, slide: false, reload: reloadNow };
}

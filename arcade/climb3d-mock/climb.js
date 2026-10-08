/* The Climb, first slice: The Cellar (floors 1-10) and its landing room. DESIGN.md has the whole tower.

   A square dungeon shaft. Each floor is one lap of ledges along the four walls, FH metres higher than the last; the middle is open air.
   Falls are real: miss a jump and you land wherever you land. Floor 10 ends in a stair up through a gap in the zone floor, a slab across
   the whole shaft that catches any fall from the zone above. Your spot saves as you climb (this browser, for now).

   The tower is generated from a fixed seed, so it is the same for everyone, and every jump in it is checked against the jump arc by
   validate(); window.__climb.tryJump(k) plays a jump for real through the physics, and climbAll() does all of them.
   Bucks, ZCoins: none. It pays titles. Nothing calls /api/; the other climbers are bots standing in for the live room. */
import * as THREE from "three";
import { Sfx } from "../parkour3d-mock/look.js?v=2";
import * as Arcade from "../arcade-kit/arcade.js?v=7";
import * as Models from "./models.js?v=2";

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

/* ------------------------------------------------------------------ tuning: Parkour's feel, unchanged */
const G = -26, JUMP = 9.4, RUN = 7.6, ACC_GROUND = 48, ACC_AIR = 16, DIVE = 11.5, R = 0.5, STEP = 1 / 120;
const COYOTE = 0.12, BUFFER = 0.12, WALL_KICK = 6.8, WALL_WINDOW = 0.18, ICE_ACC = 8, SPRING_V = 16, GUST = 3.5;   // a spring throws you 4.9 m up; a gust carries you out at 3.5 m/s (in the air; 40% on the ground). On ice you speed up and stop at a sixth of the grip
/* the tower */
const A = 10;           // the shaft's inner half-width: 20 m wall to wall (was 16 until 2026-10-07: too tight)
const FH = 6;           // one floor = one lap = 6 m of climb
const ZH = 10 * FH;     // a zone's height: ten floors
const ZONE_Y = ZH;      // the Cellar's landing room floor
const ZONES_BUILT = 10; // the whole tower: Cellar to Storm Spire, and the roof
const COMPLETE = ZONES_BUILT === 10, ROOF_Y = 10 * ZH;   // finished: no ceiling, the roof is open to the sky
const CEIL_Y = COMPLETE ? ROOF_Y + 1.4 : ZONES_BUILT * ZH + 9;   // (finished, this is the top of the parapet)
const CAM_TOP = COMPLETE ? Infinity : CEIL_Y - 0.6;
const ART_V = 1;
const EMBLEM = ["01-cellar", "02-barracks", "03-well", "04-forge", "05-crypt", "06-clockworks", "07-frost-vault", "08-gale-gallery", "09-chain-hall", "10-storm-spire"];
const SEED = 20261007;
const ZONES = ["The Cellar", "The Barracks", "The Well", "The Forge", "The Crypt", "The Clockworks", "The Frost Vault", "The Gale Gallery", "The Chain Hall", "The Storm Spire"];

/* ------------------------------------------------------------------ three */
$("hudMsg").textContent = "Lighting the torches…";
await Models.loadAll((k) => { $("hudMsg").textContent = `Lighting the torches… ${Math.round(k * 100)}%`; });
$("hudMsg").textContent = "";
const canvas = $("cv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0a10);
scene.fog = new THREE.Fog(0x0c0a10, 14, 52);   // looking down the shaft fades into the dark: that is the height
const camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 300);
const hemi = new THREE.HemisphereLight(0x8a7aa0, 0x2a1a10, 0.55); scene.add(hemi);
// your lantern: a warm light that goes where you go, so the ledges you are on are always lit
const lantern = new THREE.PointLight(0xffb060, 15, 16, 1.6); scene.add(lantern);
// a soft light high in the shaft, for the shapes of the floors above
const shaftLight = new THREE.DirectionalLight(0xb0a0ff, 0.5); shaftLight.position.set(3, 120, 2); scene.add(shaftLight);

/* ------------------------------------------------------------------ boxes (the Parkour engine's, static here) */
const boxes = [];
class Box {
  constructor(c, h, { kind = "ledge", solid = true } = {}) { this.c = new V3(...c); this.h = new V3(...h); this.kind = kind; this.solid = solid; this.radius = this.h.length(); boxes.push(this); }
  get top() { return this.c.y + this.h.y; }
  contains(x, z, pad = 0) { return Math.abs(x - this.c.x) <= this.h.x + pad && Math.abs(z - this.c.z) <= this.h.z + pad; }
}
const _d = new V3(), _l = new V3(), _cl = new V3(), _n = new V3();
const hit = { n: new V3(), pen: 0 };
function sphereBox(p, r, b) {
  if (!b.solid) return null;
  if (Math.abs(p.x - b.c.x) > b.h.x + r || Math.abs(p.y - b.c.y) > b.h.y + r || Math.abs(p.z - b.c.z) > b.h.z + r) return null;
  _l.copy(p).sub(b.c);
  _cl.set(clamp(_l.x, -b.h.x, b.h.x), clamp(_l.y, -b.h.y, b.h.y), clamp(_l.z, -b.h.z, b.h.z));
  _d.copy(_l).sub(_cl); const dist = _d.length();
  if (dist > r) return null;
  if (dist > 1e-6) { _n.copy(_d).divideScalar(dist); hit.pen = r - dist; }
  else { const px = b.h.x - Math.abs(_l.x), py = b.h.y - Math.abs(_l.y), pz = b.h.z - Math.abs(_l.z); if (py <= px && py <= pz) { _n.set(0, Math.sign(_l.y) || 1, 0); hit.pen = r + py; } else if (px <= pz) { _n.set(Math.sign(_l.x) || 1, 0, 0); hit.pen = r + px; } else { _n.set(0, 0, Math.sign(_l.z) || 1); hit.pen = r + pz; } }
  hit.n.copy(_n); return hit;
}

/* ------------------------------------------------------------------ the tower */
// a fixed seed, so the tower is the same for everyone
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** How far a running jump carries you sideways while landing dy higher (Parkour's reach()). */
function reach(dy) { const disc = JUMP * JUMP + 2 * G * dy; if (disc < 0) return -1; return RUN * (JUMP + Math.sqrt(disc)) / -G; }

// a point on side s (0..3) at travel distance t from its starting corner, and which way is "into the shaft"
const SIDES = [
  { at: (t) => [-A + t, -A], into: [0, 1] },   // along the north wall, heading east
  { at: (t) => [A, -A + t], into: [-1, 0] },   // east wall, heading south
  { at: (t) => [A - t, A], into: [0, -1] },    // south wall, heading west
  { at: (t) => [-A, A - t], into: [1, 0] }     // west wall, heading north
];
const CORNERS = [[-A, -A], [A, -A], [A, A], [-A, A]];
/** A ledge on side s from t0 to t1 along the wall, `depth` out from it, its top at y. */
function sideLedge(s, t0, t1, depth, y) {
  const S = SIDES[s], [x0, z0] = S.at((t0 + t1) / 2), [ix, iz] = S.into, half = (t1 - t0) / 2;
  const cx = x0 + ix * depth / 2, cz = z0 + iz * depth / 2, along = s % 2 === 0;
  return { c: [cx, y - 0.25, cz], h: along ? [half, 0.25, depth / 2] : [depth / 2, 0.25, half], side: s };
}
function cornerLedge(k, size, y) { const [x, z] = CORNERS[k]; return { c: [x - Math.sign(x) * size / 2, y - 0.25, z - Math.sign(z) * size / 2], h: [size / 2, 0.25, size / 2], corner: k }; }

/** The whole tower so far, in climbing order. */
function buildPath() { return [...cellar(), landingStep(1), ...barracks(), landingStep(2), ...well(), landingStep(3), ...forge(), landingStep(4), ...crypt(), landingStep(5), ...clockworks(), landingStep(6), ...frost(), landingStep(7), ...gale(), landingStep(8), ...chainHall(), landingStep(9), ...stormSpire()]; }
/** The landing room floor where a zone's stair comes up: no box of its own (the room's floor is that), but a point on the route,
    so the checks and the bots know the walk from the stair to the next zone's first ledge is solid floor, not a gap. */
function landingStep(z) { const [hx0, hx1] = STAIR_X[z - 1]; return { c: [(hx0 + hx1) / 2, z * ZH - 0.25, (-A - 4) / 2], h: [(hx1 - hx0) / 2, 0.25, (A - 4) / 2], floor: z * 10 + 1, kind: "landing", virtual: true, zone: z }; }
/** How far a jump-then-dive carries you while landing dy higher: jump, dive as the rise slows to the dive's own lift, ride it down. */
function diveReach(dy) {
  let x = 0, y = 0, vy = JUMP, vx = RUN, dive = -1; const dt = 1 / 240;
  for (let i = 0; i < 4000; i++) {
    if (dive < 0 && vy <= 3.5) { dive = 0.6; vx = DIVE; }
    if (dive > 0) { dive -= dt; if (dive <= 0) dive = 0; } else if (dive === 0) vx += Math.max(-ACC_AIR * dt, RUN - vx);
    vy += G * dt; x += vx * dt; y += vy * dt;
    if (vy < 0 && y <= dy) return x;
  }
  return -1;
}
/** The stair at the end of a zone: up the west wall from the south-west corner, through the gap in the landing room's floor. */
const STAIR_X = [[-A, -A + 3], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7], [-A + 2.7, -A + 5.7]];   // per zone: the stair's (and the landing hole's) x range
function stairUp(out, y, corner, top, floor, zone = 0) {
  const [hx0, hx1] = STAIR_X[zone], sx = (hx0 + hx1) / 2;
  let sy = y; const steps = 8, z0 = A - corner, z1 = -4, run = (z0 - z1) / steps, rise2 = (top - sy) / steps;
  // thin steps, not a solid block: the ledges of the floor below run underneath and need the headroom
  for (let i = 0; i < steps; i++) { sy += rise2; const zc = z0 - run * (i + 0.5); // a stair set in from the wall gets a first step reaching back to it, so the corner square steps straight on
    const x0 = i === 0 && hx0 > -A ? -A : hx0;
    out.push({ c: [(x0 + hx1) / 2, sy - 0.25, zc], h: [(hx1 - x0) / 2, 0.25, run / 2], floor, kind: "stair", zone }); }
}
/** The rise over a lap: FH spread over its jumps at random, a few small drops later on; `down` marks jumps that must not climb (dives). */
function rises(r, jumps, rise, d, down = new Set()) {
  const w = Array.from({ length: jumps }, (_, i) => (down.has(i) ? -0.4 : r() < 0.08 && d > 0.2 ? -0.3 : 0.6 + r() * 0.4));
  const pos = w.filter((v) => v > 0).reduce((a, b) => a + b, 0), neg = w.filter((v) => v < 0).reduce((a, b) => a + b, 0);
  let out = w.map((v) => (v > 0 ? v * (rise - neg) / pos : v));
  // no single step higher than MAX_UP: clamp, and hand the excess to the steps with room (then to the drops, if it must)
  const MAX_UP = 1.15;
  for (let pass = 0; pass < 20; pass++) {
    let extra = 0; out = out.map((v) => { if (v > MAX_UP) { extra += v - MAX_UP; return MAX_UP; } return v; });
    if (extra < 1e-6) break;
    const room = out.map((v, i) => (v > 0 && v < MAX_UP ? MAX_UP - v : 0)), total = room.reduce((a, b) => a + b, 0);
    if (total > 1e-6) out = out.map((v, i) => v + extra * room[i] / total);
    else out = out.map((v, i) => (v < 0 && !down.has(i) ? 0.3 : v));
  }
  return out;
}

/** Zone 1, The Cellar, floors 1-10: plain jumping. */
function cellar() {
  const r = rng(SEED), out = [];
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = 0;   // carried from ledge to ledge, like the Barracks
  for (let fl = 1; fl <= 10; fl++) {
    const d = (fl - 1) / 9, y0 = (fl - 1) * FH, last = fl === 10;
    // how this floor is built: everything gets a little meaner as you go up
    const ledgeLen = lerp(3.4, 1.7, d), gap = lerp(1.0, 2.5, d), depth = lerp(2.6, 1.5, d), corner = lerp(3.0, 2.0, d);
    const lap = [];
    if (fl > 1) lap.push({ corner: 0, size: corner });
    const sides = last ? 3 : 4;
    for (let s = 0; s < sides; s++) {
      // fill the run between this side's corner square and the next with ledges and gaps that add up exactly
      const start = s === 0 && fl === 1 ? 3.5 : corner, end = 2 * A - corner, run = end - start;
      const n = Math.max(1, Math.round((run - gap) / (ledgeLen + gap)));
      const gs = Array.from({ length: n + 1 }, () => Math.max(0.5, jitter(gap, 0.35))), ls = Array.from({ length: n }, () => Math.max(1.2, jitter(ledgeLen, 0.4)));
      const k = run / (gs.reduce((a, b) => a + b, 0) + ls.reduce((a, b) => a + b, 0));
      let t = start;
      for (let i = 0; i < n; i++) { t += gs[i] * k; lap.push({ side: s, t0: t, t1: t + ls[i] * k, depth: clamp(jitter(depth, 0.25), 1.3, 2.8) }); t += ls[i] * k; }
      if (s < 3) lap.push({ corner: s + 1, size: corner });
    }
    // the rise follows the lap, so each floor sits FH over the last (floor 10's three sides climb 2 m: headroom under the landing room)
    const yStart = y, yEnd = last ? y0 + 2 : y0 + FH, n = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / n + (i < n - 1 ? jitter(0, 0.25) : 0);
      y = Math.min(y + 1.15, Math.max(y - (d > 0.2 ? 0.3 : 0), target));
      if (fl === 1 && i === 0) y = Math.max(0.4, y);
      const L = it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : "ledge", zone: 0 });
    });
    if (last) stairUp(out, y, corner, ZONE_Y, 10);   // the lap ends on the south-west corner square; the stair starts from it
  }
  return out;
}

/** Where floor lf of a zone (from base) should end: 6 m a floor, but the top two climb 4 m each, so the last sits 4 m under the
    landing room's floor (room to jump) and those two are 4 m apart everywhere (a slow last floor would close on the one below). */
const floorEnd = (base, lf) => base + (lf <= 8 ? lf * FH : lf === 9 ? 8 * FH + 4 : 8 * FH + 8);
/** A box against side s: t0..t1 along the wall, d0..d1 out from it, y0..y1 up. */
function sideBox(s, t0, t1, d0, d1, y0, y1) {
  const [x0, z0] = SIDES[s].at((t0 + t1) / 2), [ix, iz] = SIDES[s].into, dm = (d0 + d1) / 2, along = s % 2 === 0;
  return { c: [x0 + ix * dm, (y0 + y1) / 2, z0 + iz * dm], h: along ? [(t1 - t0) / 2, (y1 - y0) / 2, (d1 - d0) / 2] : [(d1 - d0) / 2, (y1 - y0) / 2, (t1 - t0) / 2] };
}
const KICK_GAP = 3, KICK_OVER = 2.3;   // the walls stand 2.3 m over the exit: a last kick carries you about 1.8 m higher, and must not carry you over one     // a chimney's walls stand 3 m apart: a kick crosses in about 0.3 s and climbs about 1.6 m
const TRAVEL = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // the way round each side

/** Zone 3, The Well, floors 21-30: chimneys. A kick wall stands in front of the shaft wall and another 3 m out from it; jump at
    one, jump again at each touch, and step out at the top onto the ledge beyond. Only these walls can be kicked (a kick off any wall
    would be a free double jump up the whole tower). The floor above each chimney leaves its air clear (you would hit your head),
    and crosses that stretch with a dive: the Barracks' move, mixed back in. Floor 21's chimney is short and over the landing room. */
function well() {
  const r = rng(SEED + 4), out = [], base = 2 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  // where each floor's chimney goes: always a little EARLIER in the lap than the one below it, so the floor above has made its big
  // climb before it passes over the one below's (the other way round, the two floors close to 1.5 m apart for a stretch)
  const PLAN = [[3, "hi"], [3, "lo"], [2, "hi"], [2, "lo"], [1, "hi"], [1, "lo"], [0, "hi"], [0, "lo"]];
  let y = base, below = [];   // the floor underneath, as boxes with their tops (a chimney counts up to its walls' top)
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 20 + lf, d = (lf - 1) / 9, y0 = base + (lf - 1) * FH, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 2.0, d), gap = lerp(1.4, 2.3, d), ledgeLen = lerp(2.8, 1.8, d), depth = lerp(2.2, 1.5, d);
    const plan = PLAN[lf - 1], H = lf === 1 ? 3 : lerp(3.4, 4.4, d);
    const diveSide = lf >= 3 && r() < 0.6 ? [0, 1, 2, 3].filter((q) => q < sides && (!plan || q !== plan[0]))[Math.floor(r() * 3)] : -1;
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner;
      let t = start, diveNext = false;
      const run = (a, b) => {
        const avail = b - a; let n = Math.max(1, Math.round((avail - gap) / (ledgeLen + gap)));
        const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(gap, 0.3))));
        let room = avail - gs.reduce((u, v) => u + v, 0);
        while (n > 1 && room / n < 1.2) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
        if (room / n < 1.2) { const k = Math.max(0, avail - n * 1.2) / Math.max(1e-6, gs.reduce((u, v) => u + v, 0)); for (let i = 0; i < gs.length; i++) gs[i] *= k; room = avail - gs.reduce((u, v) => u + v, 0); }
        let tt = a;
        for (let i = 0; i < n; i++) { tt += gs[i]; const len = room / n; lap.push({ side: q, t0: tt, t1: tt + len, depth: clamp(jitter(depth, 0.25), 1.2, 2.6), dive: i === 0 && diveNext }); diveNext = false; tt += len; }
      };
      if (plan && plan[0] === q) {
        const tc = plan[1] === "hi" ? end - 6.6 : start + 1.6, Lx = 2.2;
        if (tc - t > 1.2) run(t, tc - 0.0001);
        lap.push({ side: q, t0: tc, t1: tc + 3, chimney: true, H });
        lap.push({ side: q, t0: tc + 3.3, t1: tc + 3.3 + Lx, depth: KICK_GAP + 0.6, exit: true });
        t = tc + 3.3 + Lx;
      } else if (diveSide === q) {
        // a ledge, a dive across, the rest of the side
        const l0 = jitter(2.2, 0.3), dg = lerp(6.0, 6.4, d);
        lap.push({ side: q, t0: t + jitter(1.2, 0.2), t1: t + 1.2 + l0, depth: clamp(jitter(depth, 0.25), 1.2, 2.6) });
        t = t + 1.2 + l0 + dg; diveNext = true;
      }
      if (end - t > 1.4) run(t, end); else if (diveNext) { lap.push({ side: q, t0: t, t1: end - 0.6, depth: clamp(jitter(depth, 0.25), 1.2, 2.6), dive: true }); }
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    // heights: steps share the floor's rise; the exit is H over its chimney; a dive lands 0.4 lower; and nothing sits less than
    // 3.1 m over the floor below (lifted, at most 1.15 m a step, if it must be)
    const yEnd = floorEnd(base, lf), sumH = lap.some((it) => it.chimney) ? H : 0, dives = lap.filter((it) => it.dive).length;
    const normal = lap.filter((it) => !it.exit && !it.dive).length;
    let step = (yEnd - y - sumH + 0.4 * dives) / Math.max(1, normal);
    const here = [];
    lap.forEach((it, i) => {
      const prevY = y;
      y = it.exit ? y + H : it.dive ? y - 0.4 : y + clamp(step + jitter(0, 0.12), -0.2, 1.15);
      let L = it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : it.chimney ? sideLedge(it.side, it.t0, it.t1, KICK_GAP + 0.6, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
      let need = -Infinity;
      for (const o of below) if (Math.abs(o.c[0] - L.c[0]) < o.h[0] + L.h[0] + 0.6 && Math.abs(o.c[2] - L.c[2]) < o.h[2] + L.h[2] + 0.6) need = Math.max(need, o.top + 3.1);
      if (y < need && !it.exit) {
        y = Math.min(need, prevY + (it.dive ? -0.4 + 1.5 : 1.15));
        L = it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : it.chimney ? sideLedge(it.side, it.t0, it.t1, KICK_GAP + 0.6, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
        const left = lap.slice(i + 1).filter((u) => !u.exit && !u.dive).length; if (left) step = (yEnd - y - (lap.slice(i + 1).some((u) => u.exit) ? H : 0)) / left;
      }
      if (it.chimney) L = sideLedge(it.side, it.t0, it.t1, KICK_GAP + 0.3, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.chimney ? "chimney" : "ledge", dive: Boolean(it.dive), H: it.chimney ? H : undefined, t0: it.t0, t1: it.t1, zone: 2 });
      here.push({ c: L.c, h: L.h, top: it.chimney ? y + H + KICK_OVER : y });
    });
    below = here;
    if (last) stairUp(out, y, corner, 3 * ZH, 30, 2);
  }
  return out;
}

/** Zone 4, The Forge, floors 31-40: brass platforms slide back and forth across gaps no jump crosses (wait for one, ride it,
    hop off), and fire vents on ledges flare on a timer (a glow warns first; caught, the flame throws you off). Both run on the tower's
    clock, so everyone in the room sees the same timing. Dives come back now and then. Floor 31's platform is slow and over the
    landing room. A platform's motion: centre = mid + amp·sin(2πt/T + phase), along the wall. */
function forge() {
  const r = rng(SEED + 5), out = [], base = 3 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = base;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 30 + lf, d = (lf - 1) / 9, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 2.0, d), gap = lerp(1.4, 2.4, d), ledgeLen = lerp(2.8, 1.9, d), depth = lerp(2.2, 1.5, d);
    const movers = lf === 1 ? 1 : lf < 4 ? 1 : r() < 0.5 ? 2 : 1, vents = lf === 1 ? 0 : Math.min(3, 1 + Math.floor(d * 3 + r()));
    const order = [0, 1, 2, 3].filter((q) => q < sides).sort(() => r() - 0.5);
    const moverSides = new Set(lf === 1 ? [1] : order.slice(0, movers)), diveSide = lf >= 3 && r() < 0.4 ? order[movers] ?? -1 : -1;
    const ventSides = new Set(order.filter((q) => !moverSides.has(q) && q !== diveSide).slice(0, vents));   // their ledges run long, room for a vent
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner;
      let t = start, diveNext = false;
      const run = (a, b) => {
        const len0 = ventSides.has(q) ? 3.4 : ledgeLen, avail = b - a; let n = Math.max(1, Math.round((avail - gap) / (len0 + gap)));
        const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(gap, 0.3))));
        let room = avail - gs.reduce((u, v) => u + v, 0);
        while (n > 1 && room / n < 1.4) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
        if (room / n < 1.4) { const k = Math.max(0, avail - n * 1.4) / Math.max(1e-6, gs.reduce((u, v) => u + v, 0)); for (let i = 0; i < gs.length; i++) gs[i] *= k; room = avail - gs.reduce((u, v) => u + v, 0); }
        let tt = a;
        for (let i = 0; i < n; i++) { tt += gs[i]; const len = room / n; lap.push({ side: q, t0: tt, t1: tt + len, depth: clamp(jitter(depth, 0.25), 1.3, 2.6), dive: i === 0 && diveNext }); diveNext = false; tt += len; }
      };
      if (moverSides.has(q)) {
        // a ledge, then a long gap with a platform sliding across it, then the rest of the side
        const L0 = jitter(2.2, 0.3), g = lf === 1 ? 7.5 : lerp(8.0, 9.5, d), t0 = t + jitter(1.2, 0.2);
        lap.push({ side: q, t0, t1: t0 + L0, depth: clamp(jitter(depth, 0.2), 1.4, 2.4) });
        const g0 = t0 + L0, g1 = g0 + g, hl = 1.2, c0 = g0 + 1.0 + hl, c1 = g1 - 1.0 - hl;
        const speed = lf === 1 ? 1.2 : lerp(1.5, 2.3, d), amp = (c1 - c0) / 2, T = (2 * Math.PI * amp) / speed;
        lap.push({ side: q, mover: true, mid: (c0 + c1) / 2, amp, T, phase: r() * Math.PI * 2, hl, depth: 2.2 });
        t = g1; diveNext = false;
        lap.push({ side: q, t0: g1, t1: g1 + jitter(2.2, 0.3), depth: clamp(jitter(depth, 0.2), 1.4, 2.4) });
        t = lap[lap.length - 1].t1;
      } else if (diveSide === q) {
        const l0 = jitter(2.2, 0.3), dg = lerp(6.0, 6.4, d);
        lap.push({ side: q, t0: t + 1.2, t1: t + 1.2 + l0, depth: clamp(jitter(depth, 0.25), 1.3, 2.6) });
        t = t + 1.2 + l0 + dg; diveNext = true;
      }
      if (end - t > 3.4) run(t, end);
      else if (diveNext) lap.push({ side: q, t0: t, t1: end - 0.6, depth: 1.6, dive: true });
      else if (lap.length && lap[lap.length - 1].side === q && !lap[lap.length - 1].mover) lap[lap.length - 1].t1 = Math.max(lap[lap.length - 1].t1, end - 0.9);   // too little left for another ledge: stretch this one
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    // fire vents on the longer plain ledges, never right before or after a platform
    const cand = lap.map((it, i) => i).filter((i) => { const it = lap[i]; return !it.mover && !it.dive && it.corner === undefined && it.t1 - it.t0 >= 3.0 && !lap[i - 1]?.mover && !lap[i + 1]?.mover; });
    for (const q of ventSides) { const mine = cand.filter((i) => lap[i].side === q); if (!mine.length) continue; const i = mine[Math.floor(r() * mine.length)]; lap[i].vent = { T: lerp(4.0, 3.2, d), on: 1.0, warn: 0.8, phase: r() * 3 }; }   // out for 2.2 s early on, 1.4 s near the top
    // heights: like the Barracks, following the lap; a platform rides level with the ledge before it; a dive lands 0.4 lower
    const yStart = y, yEnd = floorEnd(base, lf), n = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / n + (i < n - 1 ? jitter(0, 0.2) : 0);
      y = it.mover ? y + 0.15 : it.dive ? y - 0.4 : lap[i - 1]?.mover ? y + 0.3 : Math.min(y + 1.15, Math.max(y - 0.3, target));
      let L;
      if (it.corner !== undefined) L = cornerLedge(it.corner, it.size, y);
      else if (it.mover) { L = sideLedge(it.side, it.mid - it.hl, it.mid + it.hl, it.depth, y); L.mv = { side: it.side, mid: it.mid, amp: it.amp, T: it.T, phase: it.phase }; }
      else L = sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.mover ? "mover" : "ledge", dive: Boolean(it.dive), vent: it.vent, zone: 3 });
    });
    if (last) stairUp(out, y, corner, 4 * ZH, 40, 3);
  }
  return out;
}
/** Zone 5, The Crypt, floors 41-50: slabs that crumble (they shake when you land and drop out from under you, then rebuild),
    in the dark. Early on a slab holds you 0.75 s; near the top 0.45 s, and they come in chains, so you can't stop moving. Beams and
    dives come back. Floor 41 is gentle and over the landing room. */
function crypt() {
  const r = rng(SEED + 6), out = [], base = 4 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = base;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 40 + lf, d = (lf - 1) / 9, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 2.0, d), gap = lerp(1.5, 2.4, d), ledgeLen = lerp(2.6, 1.8, d), depth = lerp(2.0, 1.4, d);
    const crumbleP = lf === 1 ? 0.25 : lerp(0.35, 0.75, d), beamP = lerp(0.1, 0.35, d), hold = lerp(0.75, 0.45, d);
    const diveSide = lf >= 2 && r() < 0.5 ? Math.floor(r() * sides) : -1;
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner;
      let t = start, diveNext = false;
      if (diveSide === q) {
        const l0 = jitter(2.2, 0.3), dg = lerp(6.0, 6.4, d);
        lap.push({ side: q, t0: t + 1.2, t1: t + 1.2 + l0, depth: clamp(jitter(depth, 0.2), 1.3, 2.4) });
        t = t + 1.2 + l0 + dg; diveNext = true;
      }
      const avail = end - t; let n = Math.max(1, Math.round((avail - gap) / (ledgeLen + gap)));
      const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(gap, 0.3))));
      let room = avail - gs.reduce((u, v) => u + v, 0);
      while (n > 1 && room / n < 1.3) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
      let tt = t;
      for (let i = 0; i < n; i++) {
        tt += gs[i]; const len = Math.max(1.2, room / n), beam = r() < beamP, dive = i === 0 && diveNext;
        lap.push({ side: q, t0: tt, t1: tt + len, depth: beam ? lerp(0.95, 0.65, d) : clamp(jitter(depth, 0.25), 1.2, 2.4), beam, dive, crumble: !dive && r() < crumbleP ? hold : 0 });
        tt += len;
      }
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    const yStart = y, yEnd = floorEnd(base, lf), N = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / N + (i < N - 1 ? jitter(0, 0.2) : 0);
      y = it.dive ? y - 0.4 : Math.min(y + 1.15, Math.max(y - 0.3, target));
      const L = it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.beam ? "beam" : "ledge", dive: Boolean(it.dive), crumble: it.crumble || 0, zone: 4 });
    });
    if (last) stairUp(out, y, corner, 5 * ZH, 50, 4);
  }
  return out;
}

/** Zone 6, The Clockworks, floors 51-60: brass turntables in place of corner squares (they carry you round: jump off on the move),
    sweeper arms turning over other corners (jump the arm as it comes, or it throws you off), and conveyor belts along the walls that
    push you along or back. A few Forge platforms and dives come back. Floor 51: one slow turntable and a belt that helps. */
function clockworks() {
  const r = rng(SEED + 8), out = [], base = 5 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = base;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 50 + lf, d = (lf - 1) / 9, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.8, 2.4, d), gap = lerp(1.5, 2.4, d), ledgeLen = lerp(2.6, 1.9, d), depth = lerp(2.0, 1.5, d);
    const spinP = lf === 1 ? 0 : lerp(0.3, 0.55, d), sweepP = lf === 1 ? 0 : lerp(0.2, 0.45, d), beltSides = lf === 1 ? [0] : [0, 1, 2, 3].filter(() => r() < lerp(0.3, 0.55, d));
    const moverSide = lf >= 3 && r() < 0.35 ? Math.floor(r() * sides) : -1, diveSide = lf >= 3 && r() < 0.3 ? Math.floor(r() * sides) : -1;
    const lap = [];
    const cornerItem = (k) => { const roll = r(); const it = { corner: k, size: corner }; if (lf === 1 && k === 1) it.spin = 0.6; else if (!(last && k === 3) && roll < spinP) it.spin = (r() < 0.5 ? -1 : 1) * lerp(0.7, 1.3, d); else if (!(last && k === 3) && roll < spinP + sweepP) { it.sweep = { w: (r() < 0.5 ? -1 : 1) * lerp(1.1, 1.45, d), phase: r() * 6.3 }; it.size = 3.0; } return it; };   // a clock-hand square gets room to wait in
    if (lf > 1) lap.push(cornerItem(0));
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner, belts = beltSides.includes(q) && q !== moverSide;
      let t = start, diveNext = false;
      if (moverSide === q) {
        const L0 = jitter(2.2, 0.3), g = lerp(8.0, 9.0, d), t0 = t + 1.2;
        lap.push({ side: q, t0, t1: t0 + L0, depth: 1.8 });
        const g0 = t0 + L0, g1 = g0 + g, hl = 1.2, c0 = g0 + 1.0 + hl, c1 = g1 - 1.0 - hl, speed = lerp(1.6, 2.2, d), amp = (c1 - c0) / 2;
        lap.push({ side: q, mover: true, mid: (c0 + c1) / 2, amp, T: (2 * Math.PI * amp) / speed, phase: r() * 6.3, hl, depth: 2.2 });
        lap.push({ side: q, t0: g1, t1: g1 + 2.2, depth: 1.8 }); t = g1 + 2.2;
      } else if (diveSide === q && !belts) {
        const l0 = jitter(2.2, 0.3), dg = lerp(6.0, 6.4, d);
        lap.push({ side: q, t0: t + 1.2, t1: t + 1.2 + l0, depth: 1.8 }); t = t + 1.2 + l0 + dg; diveNext = true;
      }
      const avail = end - t;
      if (avail > 1.6) {
        const len0 = belts ? 4.2 : ledgeLen; let n = Math.max(1, Math.round((avail - gap) / (len0 + gap)));
        const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(gap, 0.3))));
        let room = avail - gs.reduce((u, v) => u + v, 0);
        while (n > 1 && room / n < 1.3) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
        let tt = t;
        for (let i = 0; i < n; i++) {
          tt += gs[i]; const len = Math.max(1.2, room / n), dive = i === 0 && diveNext;
          // a belt runs along the wall at 2-4 m/s; early ones help, later ones mostly push back
          const belt = belts && len >= 2.6 && !dive ? (lf === 1 || r() < lerp(0.6, 0.25, d) ? 1 : -1) * lerp(2.0, 3.8, d) : 0;
          lap.push({ side: q, t0: tt, t1: tt + len, depth: belt ? 1.9 : clamp(jitter(depth, 0.25), 1.3, 2.4), dive, belt });
          tt += len;
        }
      }
      if (q < 3) lap.push(cornerItem(q + 1));
    }
    const yStart = y, yEnd = floorEnd(base, lf), N = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / N + (i < N - 1 ? jitter(0, 0.2) : 0);
      y = it.mover ? y + 0.15 : it.dive ? y - 0.4 : lap[i - 1]?.mover ? y + 0.3 : Math.min(y + 1.15, Math.max(y - 0.3, target));
      let L;
      if (it.corner !== undefined) L = cornerLedge(it.corner, it.size, y);
      else if (it.mover) { L = sideLedge(it.side, it.mid - it.hl, it.mid + it.hl, it.depth, y); L.mv = { side: it.side, mid: it.mid, amp: it.amp, T: it.T, phase: it.phase }; }
      else L = sideLedge(it.side, it.t0, it.t1, it.depth, y);
      if (it.spin) { const rad = it.size * 0.62; L.h = [rad, 0.25, rad]; L.spin = it.spin; L.rad = rad; }
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.mover ? "mover" : "ledge", dive: Boolean(it.dive), sweep: it.sweep, belt: it.belt || 0, zone: 5 });
    });
    if (last) stairUp(out, y, corner, 6 * ZH, 60, 5);
  }
  return out;
}
/** Zone 7, The Frost Vault, floors 61-70: ice ledges (a sixth of the grip: slow to speed up, slow to stop; land and brake) and
    icicles over some ledges that shake, drop and shatter on a timer (hit, and you are knocked off). Crumbling slabs and dives come
    back. Floor 61: one long ice ledge, no icicles. */
function frost() {
  const r = rng(SEED + 10), out = [], base = 6 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = base;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 60 + lf, d = (lf - 1) / 9, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 2.1, d), gap = lerp(1.4, 2.2, d), ledgeLen = lerp(2.6, 1.9, d), depth = lerp(2.0, 1.5, d);
    const iceSides = lf === 1 ? [0] : [0, 1, 2, 3].filter((q) => q < sides && r() < lerp(0.35, 0.7, d));
    const icicles = lf === 1 ? 0 : Math.round(lerp(1, 4, d) + r() * 0.8), crumbleP = lf >= 3 ? lerp(0.05, 0.2, d) : 0;
    const diveSide = lf >= 3 && r() < 0.3 ? [0, 1, 2, 3].filter((q) => q < sides && !iceSides.includes(q))[0] ?? -1 : -1;
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner, icy = iceSides.includes(q);
      let t = start, diveNext = false;
      if (diveSide === q) { const l0 = jitter(2.2, 0.3), dg = lerp(6.0, 6.3, d); lap.push({ side: q, t0: t + 1.2, t1: t + 1.2 + l0, depth: 1.8 }); t = t + 1.2 + l0 + dg; diveNext = true; }
      const len0 = icy ? 4.2 : ledgeLen, avail = end - t; let n = Math.max(1, Math.round((avail - gap) / (len0 + gap)));
      const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(icy ? gap * 0.8 : gap, 0.25))));
      let room = avail - gs.reduce((u, v) => u + v, 0);
      while (n > 1 && room / n < (icy ? 3.6 : 1.3)) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
      let tt = t;
      for (let i = 0; i < n; i++) {
        tt += gs[i]; const len = Math.max(1.2, room / n), dive = i === 0 && diveNext, ice = icy && len >= 3.4 && !dive;
        lap.push({ side: q, t0: tt, t1: tt + len, depth: ice ? 2.0 : clamp(jitter(depth, 0.25), 1.3, 2.4), dive, ice, crumble: !ice && !dive && r() < crumbleP ? 0.6 : 0 });
        tt += len;
      }
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    // icicles hang over plain ledges long enough to stand off them
    const cand = lap.map((it, i) => i).filter((i) => lap[i].corner === undefined && !lap[i].dive && !lap[i].crumble && lap[i].t1 - lap[i].t0 >= 2.2);
    // never on two neighbouring ledges: two timers at once may never both be clear
    for (let n = 0; n < icicles && cand.length; n++) { const i = cand.splice(Math.floor(r() * cand.length), 1)[0]; if (lap[i - 1]?.icicle || lap[i + 1]?.icicle) continue; lap[i].icicle = { T: lerp(4.6, 3.4, d), warn: 0.7, fall: 0.4, phase: r() * 4 }; }
    const yStart = y, yEnd = floorEnd(base, lf), N = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / N + (i < N - 1 ? jitter(0, 0.2) : 0);
      y = it.dive ? y - 0.4 : lap[i - 1]?.ice ? Math.min(y + 0.5, Math.max(y - 0.3, target)) : Math.min(y + 1.15, Math.max(y - 0.3, target));   // off ice, smaller steps
      const L = it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : "ledge", dive: Boolean(it.dive), ice: Boolean(it.ice), crumble: it.crumble || 0, icicle: it.icicle, zone: 6 });
    });
    if (last) stairUp(out, y, corner, 7 * ZH, 70, 6);
  }
  return out;
}
/** Zone 8, The Gale Gallery, floors 71-80: bounce pads (a spring throws you 4.9 m up; steer onto the ledge above as you come down)
    and gusts on a timer that blow out of each windy wall toward the open middle: hard in the air, gently on the ground. Streaks warn
    first. Springs are placed like the Well's chimneys, each a little earlier in the lap than the one below, and nothing sits under
    3.1 m over the floor beneath. Platforms and dives come back. Floor 71: one spring, no wind. */
const GUSTS = [];   // { side, t0, t1, y0, y1, T, on, warn, phase }
function gale() {
  const r = rng(SEED + 11), out = [], base = 7 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  const PLAN = [[3, "hi"], [3, "lo"], [2, "hi"], [2, "lo"], [1, "hi"], [1, "lo"], [0, "hi"], [0, "lo"]];
  let y = base, below = [];
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 70 + lf, d = (lf - 1) / 9, y0 = base + (lf - 1) * FH, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 2.1, d), gap = lerp(1.4, 2.3, d), ledgeLen = lerp(2.7, 1.9, d), depth = lerp(2.0, 1.5, d);
    const plan = PLAN[lf - 1], H = lf === 1 ? 3.2 : lerp(3.4, 3.9, d);
    const windy = lf === 1 ? [] : [0, 1, 2, 3].filter((q) => q < sides && (!plan || q !== plan[0]) && r() < lerp(0.35, 0.7, d));
    const moverSide = lf >= 3 && r() < 0.3 ? [0, 1, 2, 3].find((q) => q < sides && (!plan || q !== plan[0]) && !windy.includes(q)) ?? -1 : -1;
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner;
      let t = start;
      const run = (a, b) => {
        const avail = b - a; if (avail < 1.6) return; let n = Math.max(1, Math.round((avail - gap) / (ledgeLen + gap)));
        const gs = Array.from({ length: n + 1 }, () => Math.max(0.7, jitter(gap, 0.3)));
        let room = avail - gs.reduce((u, v) => u + v, 0);
        while (n > 1 && room / n < 1.3) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
        if (room / n < 1.2) { const k = Math.max(0, avail - n * 1.2) / Math.max(1e-6, gs.reduce((u, v) => u + v, 0)); for (let i = 0; i < gs.length; i++) gs[i] *= k; room = avail - gs.reduce((u, v) => u + v, 0); }
        let tt = a;
        for (let i = 0; i < n; i++) { tt += gs[i]; const len = room / n; lap.push({ side: q, t0: tt, t1: tt + len, depth: clamp(jitter(depth, 0.25), 1.3, 2.4), windy: windy.includes(q) }); tt += len; }
      };
      if (plan && plan[0] === q) {
        // a spring pad, then the ledge it throws you up to, 1.2 m further on
        const tc = plan[1] === "hi" ? end - 5.6 : start + 1.6;
        run(t, tc - 0.0001);
        lap.push({ side: q, t0: tc, t1: tc + 1.8, depth: 1.8, spring: true });
        lap.push({ side: q, t0: tc + 3.0, t1: tc + 5.0, depth: 2.2, exit: true });
        t = tc + 5.0;
      } else if (moverSide === q) {
        const L0 = jitter(2.2, 0.3), g = lerp(8.0, 9.0, d), t0 = t + 1.2;
        lap.push({ side: q, t0, t1: t0 + L0, depth: 1.8 });
        const g0 = t0 + L0, g1 = g0 + g, hl = 1.2, c0 = g0 + 1.0 + hl, c1 = g1 - 1.0 - hl, speed = lerp(1.6, 2.2, d), amp = (c1 - c0) / 2;
        lap.push({ side: q, mover: true, mid: (c0 + c1) / 2, amp, T: (2 * Math.PI * amp) / speed, phase: r() * 6.3, hl, depth: 2.2 });
        lap.push({ side: q, t0: g1, t1: g1 + 2.2, depth: 1.8 }); t = g1 + 2.2;
      }
      run(t, end);
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    // heights: steps share the floor's rise; the exit is H over its spring; lift anything under 3.1 m over the floor below
    const yEnd = floorEnd(base, lf), sumH = lap.some((it) => it.spring) ? H : 0, normal = lap.filter((it) => !it.exit).length;
    let step = (yEnd - y - sumH) / Math.max(1, normal);
    const here = [], yFloorStart = y;
    lap.forEach((it, i) => {
      const prevY = y;
      y = it.exit ? y + H : it.mover ? y + 0.15 : lap[i - 1]?.mover ? y + 0.3 : y + clamp(step + jitter(0, 0.12), -0.2, 1.15);
      const make = () => it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : it.mover ? sideLedge(it.side, it.mid - it.hl, it.mid + it.hl, it.depth, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
      let L = make(), need = -Infinity;
      for (const o of below) if (Math.abs(o.c[0] - L.c[0]) < o.h[0] + L.h[0] + 0.6 && Math.abs(o.c[2] - L.c[2]) < o.h[2] + L.h[2] + 0.6) need = Math.max(need, o.top + 3.1);
      if (y < need && !it.exit) { y = Math.min(need, prevY + 1.15); L = make(); const left = lap.slice(i + 1).filter((u) => !u.exit).length; if (left) step = (yEnd - y - (lap.slice(i + 1).some((u) => u.exit) ? H : 0)) / left; }
      if (it.mover) L.mv = { side: it.side, mid: it.mid, amp: it.amp, T: it.T, phase: it.phase };
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.mover ? "mover" : "ledge", spring: Boolean(it.spring), springH: it.spring ? H : 0, windy: Boolean(it.windy), side: it.side, zone: 7 });
      here.push({ c: L.c, h: L.h, top: it.spring ? y + H + 1.6 : y });
    });
    // each windy side's gust: the side's whole run, from below this floor's ledges to well above them
    for (const q of windy) GUSTS.push({ side: q, t0: corner - 0.5, t1: 2 * A - corner + 0.5, y0: yFloorStart - 1, y1: y + 4, T: lerp(6.5, 5.0, d), on: lerp(1.4, 1.9, d), warn: 0.9, phase: r() * 6, floor: fl });
    below = here;
    if (last) stairUp(out, y, corner, 8 * ZH, 80, 7);
  }
  return out;
}
/** Zone 9, The Chain Hall, floors 81-90: platforms hung on a chain from a wall bracket swing across gaps no jump crosses (ride
    one and let go at the right moment: a jump keeps the platform's momentum), and iron maces swing low across some ledges. The chain
    is 3.5 m, so the bracket stays under the floor above. Crumbling slabs and dives come back. Floor 81: one slow swing, no maces.
    A swing's motion: angle θ = amp·sin(2πt/T + phase); it sits Lr·sinθ along the wall and Lr·(1 − cosθ) up from its low point. */
function chainHall() {
  const r = rng(SEED + 13), out = [], base = 8 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = base;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 80 + lf, d = (lf - 1) / 9, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 2.1, d), gap = lerp(1.5, 2.4, d), ledgeLen = lerp(2.6, 1.9, d), depth = lerp(2.0, 1.5, d);
    const swings = lf === 1 ? 1 : lf < 4 ? 1 : r() < 0.55 ? 2 : 1, maces = lf === 1 ? 0 : Math.min(3, 1 + Math.floor(d * 2.5 + r() * 0.8));
    const order = [0, 1, 2, 3].filter((q) => q < sides).sort(() => r() - 0.5);
    const swingSides = new Set(lf === 1 ? [1] : order.slice(0, swings)), maceSides = new Set(order.filter((q) => !swingSides.has(q)).slice(0, maces));
    const diveSide = lf >= 3 && r() < 0.35 ? order.find((q) => !swingSides.has(q) && !maceSides.has(q)) ?? -1 : -1;
    const crumbleP = lf >= 3 ? lerp(0.08, 0.25, d) : 0;
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner;
      let t = start, diveNext = false;
      const run = (a, b) => {
        const len0 = maceSides.has(q) ? 3.2 : ledgeLen, avail = b - a; if (avail < 1.6) return; let n = Math.max(1, Math.round((avail - gap) / (len0 + gap)));
        const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(gap, 0.3))));
        let room = avail - gs.reduce((u, v) => u + v, 0);
        while (n > 1 && room / n < 1.4) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
        if (room / n < 1.3) { const k = Math.max(0, avail - n * 1.3) / Math.max(1e-6, gs.reduce((u, v) => u + v, 0)); for (let i = 0; i < gs.length; i++) gs[i] *= k; room = avail - gs.reduce((u, v) => u + v, 0); }
        let tt = a;
        for (let i = 0; i < n; i++) { tt += gs[i]; const len = room / n, dive = i === 0 && diveNext; lap.push({ side: q, t0: tt, t1: tt + len, depth: clamp(jitter(depth, 0.25), 1.3, 2.4), dive, crumble: !dive && r() < crumbleP ? 0.6 : 0 }); diveNext = false; tt += len; }
      };
      if (swingSides.has(q)) {
        const L0 = jitter(2.2, 0.3), g = lf === 1 ? 8.0 : lerp(8.5, 10.0, d), t0 = t + 1.2;
        lap.push({ side: q, t0, t1: t0 + L0, depth: 1.8 });
        const g0 = t0 + L0, g1 = g0 + g, hl = 1.2, reachX = g / 2 - 1.0 - hl, Lr = 3.5;
        lap.push({ side: q, swing: true, mid: (g0 + g1) / 2, Lr, th: Math.asin(Math.min(0.95, reachX / Lr)), reachX, T: lf === 1 ? 4.4 : lerp(4.0, 3.2, d), phase: r() * 6.3, hl, depth: 2.0 });
        lap.push({ side: q, t0: g1, t1: g1 + 2.2, depth: 1.8 }); t = g1 + 2.2;
      } else if (diveSide === q) {
        const l0 = jitter(2.2, 0.3), dg = lerp(6.0, 6.3, d); lap.push({ side: q, t0: t + 1.2, t1: t + 1.2 + l0, depth: 1.8 }); t = t + 1.2 + l0 + dg; diveNext = true;
      }
      if (end - t > 3.0) run(t, end); else if (diveNext) lap.push({ side: q, t0: t, t1: end - 0.6, depth: 1.6, dive: true });
      else if (lap.length && lap[lap.length - 1].side === q && !lap[lap.length - 1].swing) lap[lap.length - 1].t1 = Math.max(lap[lap.length - 1].t1, end - 0.9);
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    // maces over the long ledges of the mace sides, never on a crumbling slab or next to a swing
    for (const q of maceSides) { const mine = lap.map((it, i) => i).filter((i) => lap[i].side === q && lap[i].corner === undefined && !lap[i].swing && !lap[i].crumble && !lap[i].dive && lap[i].t1 - lap[i].t0 >= 2.6 && !lap[i - 1]?.swing && !lap[i + 1]?.swing); if (mine.length) lap[mine[Math.floor(r() * mine.length)]].mace = { th: 0.62, Lr: 3.2, T: lerp(3.6, 2.8, d), phase: r() * 6.3 }; }
    const yStart = y, yEnd = floorEnd(base, lf), N = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / N + (i < N - 1 ? jitter(0, 0.2) : 0);
      y = it.swing ? y + 0.1 : it.dive ? y - 0.4 : lap[i - 1]?.swing ? y + 0.4 : Math.min(y + 1.15, Math.max(y - 0.3, target));
      let L;
      if (it.corner !== undefined) L = cornerLedge(it.corner, it.size, y);
      else if (it.swing) { L = sideLedge(it.side, it.mid - it.hl, it.mid + it.hl, it.depth, y); L.mv = { side: it.side, mid: it.mid, amp: it.reachX, T: it.T, phase: it.phase, swing: { Lr: it.Lr, th: it.th } }; }
      else L = sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.swing ? "swing" : "ledge", dive: Boolean(it.dive), crumble: it.crumble || 0, mace: it.mace, zone: 8 });
    });
    if (last) stairUp(out, y, corner, 9 * ZH, 90, 8);
  }
  return out;
}
/** Zone 10, The Storm Spire, floors 91-100: everything, mixed afresh each floor (dives, beams, crumbling slabs, ice, belts,
    platforms, swings), and lightning: a ledge crackles purple, then a bolt takes it for 2.4 s. If you are on it, you go with it.
    The stair from floor 100 comes up through the roof. */
function stormSpire() {
  const r = rng(SEED + 14), out = [], base = 9 * ZH;
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  let y = base;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 90 + lf, d = (lf - 1) / 9, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.5, 2.0, d), gap = lerp(1.6, 2.4, d), ledgeLen = lerp(2.5, 1.9, d), depth = lerp(1.9, 1.5, d);
    // two special sides a floor, drawn from everything that came before
    const order = [0, 1, 2, 3].filter((q) => q < sides).sort(() => r() - 0.5), kinds = ["dive", "mover", "swing", "ice", "belt"].sort(() => r() - 0.5);
    const special = {}; special[order[0]] = kinds[0]; if (lf > 1) special[order[1]] = kinds[1];
    const beamP = lerp(0.15, 0.3, d), crumbleP = lerp(0.1, 0.25, d), strikes = lf === 1 ? 1 : Math.round(lerp(2, 4, d));
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let q = 0; q < sides; q++) {
      const start = q === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner, kind = special[q];
      let t = start, diveNext = false;
      const run = (a, b) => {
        const len0 = kind === "ice" ? 4.2 : kind === "belt" ? 4.0 : ledgeLen, avail = b - a; if (avail < 1.6) return; let n = Math.max(1, Math.round((avail - gap) / (len0 + gap)));
        const gs = Array.from({ length: n + 1 }, (_, i) => (i === 0 && diveNext ? 0 : Math.max(0.7, jitter(kind === "ice" ? gap * 0.8 : gap, 0.3))));
        let room = avail - gs.reduce((u, v) => u + v, 0);
        while (n > 1 && room / n < (kind === "ice" ? 3.6 : 1.3)) { n--; gs.splice(1, 1); room = avail - gs.reduce((u, v) => u + v, 0); }
        if (room / n < 1.2) { const k = Math.max(0, avail - n * 1.2) / Math.max(1e-6, gs.reduce((u, v) => u + v, 0)); for (let i = 0; i < gs.length; i++) gs[i] *= k; room = avail - gs.reduce((u, v) => u + v, 0); }
        let tt = a;
        for (let i = 0; i < n; i++) {
          tt += gs[i]; const len = room / n, dive = i === 0 && diveNext, ice = kind === "ice" && len >= 3.4 && !dive;
          const belt = kind === "belt" && len >= 2.6 && !dive ? (r() < 0.35 ? 1 : -1) * lerp(2.6, 3.8, d) : 0, beam = !ice && !belt && !dive && r() < beamP;
          lap.push({ side: q, t0: tt, t1: tt + len, depth: beam ? lerp(0.9, 0.65, d) : ice || belt ? 2.0 : clamp(jitter(depth, 0.25), 1.3, 2.3), dive, ice, belt, beam, crumble: !ice && !belt && !dive && !beam && r() < crumbleP ? 0.5 : 0 });
          diveNext = false; tt += len;
        }
      };
      if (kind === "mover" || kind === "swing") {
        const L0 = jitter(2.2, 0.3), g = lerp(8.5, 9.5, d), t0 = t + 1.2;
        lap.push({ side: q, t0, t1: t0 + L0, depth: 1.8 });
        const g0 = t0 + L0, g1 = g0 + g, hl = 1.2, c0 = g0 + 1.0 + hl, c1 = g1 - 1.0 - hl;
        if (kind === "mover") { const amp = (c1 - c0) / 2, speed = lerp(1.8, 2.4, d); lap.push({ side: q, mover: true, mid: (c0 + c1) / 2, amp, T: (2 * Math.PI * amp) / speed, phase: r() * 6.3, hl, depth: 2.2 }); }
        else { const reachX = g / 2 - 1.0 - hl, Lr = 3.5; lap.push({ side: q, swing: true, mid: (g0 + g1) / 2, Lr, th: Math.asin(Math.min(0.95, reachX / Lr)), reachX, T: lerp(3.6, 3.0, d), phase: r() * 6.3, hl, depth: 2.0 }); }
        lap.push({ side: q, t0: g1, t1: g1 + 2.2, depth: 1.8 }); t = g1 + 2.2;
      } else if (kind === "dive") {
        const l0 = jitter(2.2, 0.3), dg = lerp(6.1, 6.4, d); lap.push({ side: q, t0: t + 1.2, t1: t + 1.2 + l0, depth: 1.8 }); t = t + 1.2 + l0 + dg; diveNext = true;
      }
      if (end - t > 3.0) run(t, end); else if (diveNext) lap.push({ side: q, t0: t, t1: end - 0.6, depth: 1.6, dive: true });
      else if (lap.length && lap[lap.length - 1].side === q && !lap[lap.length - 1].mover && !lap[lap.length - 1].swing) lap[lap.length - 1].t1 = Math.max(lap[lap.length - 1].t1, end - 0.9);
      if (q < 3) lap.push({ corner: q + 1, size: corner });
    }
    // lightning on plain ledges (never two in a row, never next to something that moves)
    const cand = lap.map((it, i) => i).filter((i) => { const it = lap[i]; return it.corner === undefined && !it.mover && !it.swing && !it.ice && !it.belt && !it.dive && !it.crumble && !lap[i - 1]?.mover && !lap[i - 1]?.swing && !lap[i + 1]?.mover && !lap[i + 1]?.swing; });
    for (let n = 0; n < strikes && cand.length; n++) { const i = cand.splice(Math.floor(r() * cand.length), 1)[0]; if (lap[i - 1]?.strike || lap[i + 1]?.strike) continue; lap[i].strike = { T: lerp(6.0, 5.0, d), warn: 0.9, gone: 2.4, phase: r() * 5 }; }   // calm 2.7 s between strikes early, 1.7 s at the top
    const yStart = y, yEnd = floorEnd(base, lf), N = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / N + (i < N - 1 ? jitter(0, 0.2) : 0);
      y = it.mover || it.swing ? y + 0.1 : it.dive ? y - 0.4 : lap[i - 1]?.mover || lap[i - 1]?.swing ? y + 0.3 : lap[i - 1]?.ice ? Math.min(y + 0.5, Math.max(y - 0.3, target)) : Math.min(y + 1.15, Math.max(y - 0.3, target));
      let L;
      if (it.corner !== undefined) L = cornerLedge(it.corner, it.size, y);
      else if (it.mover) { L = sideLedge(it.side, it.mid - it.hl, it.mid + it.hl, it.depth, y); L.mv = { side: it.side, mid: it.mid, amp: it.amp, T: it.T, phase: it.phase }; }
      else if (it.swing) { L = sideLedge(it.side, it.mid - it.hl, it.mid + it.hl, it.depth, y); L.mv = { side: it.side, mid: it.mid, amp: it.reachX, T: it.T, phase: it.phase, swing: { Lr: it.Lr, th: it.th } }; }
      else L = sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.swing ? "swing" : it.mover ? "mover" : it.beam ? "beam" : "ledge", dive: Boolean(it.dive), ice: Boolean(it.ice), belt: it.belt || 0, crumble: it.crumble || 0, strike: it.strike, zone: 9 });
    });
    if (last) stairUp(out, y, corner, ROOF_Y, 100, 9);
  }
  return out;
}
/** A lightning ledge's state at time tt: "calm", "warn" (crackling) or "gone" (struck: not there). */
function strikeState(st, tt) { const ph = ((tt + st.phase) % st.T + st.T) % st.T; return ph >= st.T - st.gone ? "gone" : ph >= st.T - st.gone - st.warn ? "warn" : "calm"; }

/** Where a swing is at time tt, from its low point: [along the wall, up]. */
function swingOffset(mv, tt) { const th = mv.swing.th * Math.sin((2 * Math.PI * tt) / mv.T + mv.phase); return [mv.swing.Lr * Math.sin(th), mv.swing.Lr * (1 - Math.cos(th))]; }
/** A mace's ball at time tt. Its pivot is 4.2 m up, 1.9 m out from the wall over the ledge's middle, and it swings OUT from the wall
    and back (never along it), so it only ever crosses one strip of its own ledge: run through the strip while it's swung away. */
function macePivot(L) { const [ix, iz] = SIDES[L.side].into, wall = L.h[0] * Math.abs(ix) + L.h[2] * Math.abs(iz); return [L.c[0] - ix * wall + ix * 1.9, topOf(L) + 4.2, L.c[2] - iz * wall + iz * 1.9]; }
function macePos(L, tt) {
  const m = L.mace, th = m.th * Math.sin((2 * Math.PI * tt) / m.T + m.phase), [ix, iz] = SIDES[L.side].into, [px, py, pz] = macePivot(L);
  return [px + ix * m.Lr * Math.sin(th), py - m.Lr * Math.cos(th), pz + iz * m.Lr * Math.sin(th)];
}

/** A gust's state at time tt: "calm", "warn" (streaks) or "on" (blowing). */
function gustState(g, tt) { const ph = ((tt + g.phase) % g.T + g.T) % g.T; return ph >= g.T - g.on ? "on" : ph >= g.T - g.on - g.warn ? "warn" : "calm"; }
/** The gust (if any) covering a point, and so pushing on it. */
function gustAt(x, y, z) {
  for (const g of GUSTS) {
    if (y < g.y0 || y > g.y1) continue;
    const S = SIDES[g.side], [ix, iz] = S.into, [x0, z0] = S.at(0), [fx, fz] = TRAVEL[g.side];
    const along = (x - x0) * fx + (z - z0) * fz, out2 = (x - x0) * ix + (z - z0) * iz;
    if (along >= g.t0 && along <= g.t1 && out2 >= 0 && out2 <= 9) return g;
  }
  return null;
}

/** An icicle's state at time tt: "hang", "shake" (the warning), "fall" (the dangerous part). */
function icicleState(ic, tt) { const ph = ((tt + ic.phase) % ic.T + ic.T) % ic.T; return ph >= ic.T - ic.fall ? "fall" : ph >= ic.T - ic.fall - ic.warn ? "shake" : "hang"; }
/** How fast you can be going at the end of a run of `len` metres from a standstill, on ice. */
const iceSpeed = (len) => Math.min(RUN, Math.sqrt(2 * ICE_ACC * Math.max(0.2, len)));

/** A sweeper arm's angle at time tt, and the distance from (x, z) to the arm. */
const sweepAngle = (sw, tt) => sw.phase + sw.w * tt;
function sweepDist(L, tt, x, z) {
  const th = sweepAngle(L.sweep, tt), len = L.h[0] * 1.35, ux = Math.cos(th), uz = Math.sin(th), px = x - L.c[0], pz = z - L.c[2];
  const k = clamp(px * ux + pz * uz, 0, len); return Math.hypot(px - ux * k, pz - uz * k);   // one hand, hub to tip
}
/** Where to cross a square: its middle, but a sweeper's square is crossed by its open quarter, out by the wall corner. */
function aimC(L) { const c = liveC(L); if (!L.sweep) return c; const o = L.h[0] * 0.7; return [c[0] + Math.sign(c[0]) * o, c[1], c[2] + Math.sign(c[2]) * o]; }

/** Where a platform's centre is at time tt, as an offset along its wall from its middle. */
const moverOffset = (mv, tt) => mv.amp * Math.sin((2 * Math.PI * tt) / mv.T + mv.phase);
/** A fire vent's state at time tt: "off", "warn" (glowing) or "on" (burning). */
function ventState(v, tt) { const ph = ((tt + v.phase) % v.T + v.T) % v.T; return ph >= v.T - v.on ? "on" : ph >= v.T - v.on - v.warn ? "warn" : "off"; }

/** Zone 2, The Barracks, floors 11-20: long narrow wooden beams (hug the wall and they are wide enough) and gaps only a dive crosses.
    Floor 11's dive is the lesson: it is over the landing room's floor, so a miss costs a metre. */
function barracks() {
  const r = rng(SEED + 2), out = [], base = ZH;
  let y = base;   // carried from ledge to ledge, so a floor change is one ordinary step
  const jitter = (v, j) => v + (r() * 2 - 1) * j;
  for (let lf = 1; lf <= 10; lf++) {
    const fl = 10 + lf, d = (lf - 1) / 9, y0 = base + (lf - 1) * FH, last = lf === 10, sides = last ? 3 : 4;
    const corner = lerp(2.6, 1.9, d), gap = lerp(1.5, 2.6, d), beamP = lerp(0.35, 0.8, d), divesN = lf === 1 ? 1 : r() < lerp(0.45, 0.9, d) ? (r() < d * 0.7 ? 2 : 1) : 0;
    const diveSides = new Set(lf === 1 ? [1] : []); while (diveSides.size < divesN) diveSides.add(Math.floor(r() * sides));
    const lap = [];
    if (lf > 1) lap.push({ corner: 0, size: corner });
    for (let s = 0; s < sides; s++) {
      const start = s === 0 && lf === 1 ? 3.5 : corner, end = 2 * A - corner, run = end - start;
      if (diveSides.has(s)) {
        // from the corner square: a dive across, a ledge, a short hop to the next corner
        const dg = lf === 1 ? 6.0 : lerp(6.1, 6.6, d), g2 = jitter(1.3, 0.2), len = run - dg - g2;
        lap.push({ side: s, t0: start + dg, t1: start + dg + len, depth: clamp(jitter(lerp(2.2, 1.6, d), 0.2), 1.4, 2.4), dive: true });
      } else {
        const beamy = r() < beamP, ledgeLen = beamy ? lerp(3.4, 4.6, d) : lerp(2.6, 1.7, d);
        const n = Math.max(1, Math.round((run - gap) / (ledgeLen + gap)));
        const gs = Array.from({ length: n + 1 }, () => Math.max(0.8, jitter(gap, 0.35)));
        const room = run - gs.reduce((a, b) => a + b, 0), each = room / n;
        let t = start;
        for (let i = 0; i < n; i++) {
          t += gs[i]; const len = Math.max(1.2, each), beam = beamy && r() < 0.85;
          lap.push({ side: s, t0: t, t1: t + len, depth: beam ? lerp(0.95, 0.62, d) : clamp(jitter(lerp(2.2, 1.4, d), 0.25), 1.2, 2.6), beam });
          t += len;
        }
      }
      if (s < 3) lap.push({ corner: s + 1, size: corner });
    }
    // each piece's height follows how far round the lap it is, so every floor sits a full FH over the one below it;
    // a dive lands a little lower, and no step is taller than 1.15 m
    const yStart = y, yEnd = floorEnd(base, lf), n = lap.length;
    lap.forEach((it, i) => {
      const target = yStart + (yEnd - yStart) * (i + 1) / n + (i < n - 1 ? jitter(0, 0.25) : 0);
      y = it.dive ? y - 0.4 : Math.min(y + 1.15, Math.max(y - 0.3, target));
      const L = it.corner !== undefined ? cornerLedge(it.corner, it.size, y) : sideLedge(it.side, it.t0, it.t1, it.depth, y);
      out.push({ ...L, floor: fl, kind: it.corner !== undefined ? "corner" : it.beam ? "beam" : "ledge", dive: Boolean(it.dive), zone: 1 });
    });
    if (last) stairUp(out, y, corner, 2 * ZH, 20, 1);
  }
  return out;
}
const PATH = buildPath();
function topOf(L) { return L.c[1] + L.h[1]; }

/** Every jump in the path against the jump arc: the air between two footprints must be within a run-up jump's reach, with room to spare. */
function validate() {
  const problems = []; let worst = 0;
  for (let k = 1; k < PATH.length; k++) {
    const a = PATH[k - 1], b = PATH[k];
    if (a.kind === "stair" && b.kind === "stair") continue;
    if (a.mv || b.mv) {
      // a platform: check the jump at its closest approach (the bot waits for it, and so do people)
      const near = (L, other) => { if (!L.mv) return L; const [fx, fz] = TRAVEL[L.mv.side], toward = Math.sign((other.c[0] - L.c[0]) * fx + (other.c[2] - L.c[2]) * fz) || 1; return { ...L, c: [L.c[0] + fx * L.mv.amp * toward, L.c[1], L.c[2] + fz * L.mv.amp * toward] }; };
      const A2 = near(a, b), B2 = near(b, a);
      const gx = Math.max(0, Math.abs(B2.c[0] - A2.c[0]) - A2.h[0] - B2.h[0]), gz = Math.max(0, Math.abs(B2.c[2] - A2.c[2]) - A2.h[2] - B2.h[2]);
      const g = Math.hypot(gx, gz), dy = topOf(b) - topOf(a), can = reach(dy) - 1.2 + 2 * R * 0.8;
      if (dy > 1.3) problems.push(`#${k} (floor ${b.floor}): ${dy.toFixed(2)} m up`); else if (g > can) problems.push(`#${k} (floor ${b.floor}): platform gap ${g.toFixed(2)} m at its closest`);
      continue;
    }
    if (a.spring) {
      const H2 = topOf(b) - topOf(a), apex = (SPRING_V * SPRING_V) / (-2 * G);
      if (H2 > apex - 1.0) problems.push(`#${k} (floor ${b.floor}): a spring throws you ${apex.toFixed(1)} m; the ledge is ${H2.toFixed(1)} m up`);
      continue;
    }
    if (a.kind === "chimney") {
      const tCross = (KICK_GAP - 2 * R) / WALL_KICK, perKick = JUMP * tCross + 0.5 * G * tCross * tCross;
      if (a.H > 5) problems.push(`#${k} (floor ${b.floor}): a ${a.H.toFixed(1)} m chimney is too tall`);
      if (perKick < 0.6) problems.push(`#${k}: a kick only climbs ${perKick.toFixed(2)} m`);
      continue;
    }
    const gx = Math.max(0, Math.abs(b.c[0] - a.c[0]) - a.h[0] - b.h[0]), gz = Math.max(0, Math.abs(b.c[2] - a.c[2]) - a.h[2] - b.h[2]);
    const g = Math.hypot(gx, gz), dy = topOf(b) - topOf(a);
    let can = (b.dive ? diveReach(dy) - 1.3 : reach(dy) - 1.2) + 2 * R * 0.8;   // slack for a person
    if (a.ice) can = reach(dy) * iceSpeed(Math.max(a.h[0], a.h[2]) * 2 - 0.8) / RUN - 0.6 + 2 * R * 0.8;   // from a standstill on ice
    worst = Math.max(worst, g / Math.max(0.01, can));
    if (dy > 1.3) problems.push(`#${k} (floor ${b.floor}): ${dy.toFixed(2)} m up`);
    else if (g > can) problems.push(`#${k} (floor ${b.floor}): a ${g.toFixed(2)} m gap, comfortable reach ${can.toFixed(2)} m`);
  }
  // headroom: nothing may hang within a jump's height over the air between two ledges
  for (let k = 1; k < PATH.length; k++) {
    const a = PATH[k - 1], b = PATH[k], y = topOf(a);
    const x0 = Math.min(a.c[0] - a.h[0], b.c[0] - b.h[0]), x1 = Math.max(a.c[0] + a.h[0], b.c[0] + b.h[0]), z0 = Math.min(a.c[2] - a.h[2], b.c[2] - b.h[2]), z1 = Math.max(a.c[2] + a.h[2], b.c[2] + b.h[2]);
    for (const o of PATH) {
      if (o === a || o === b || a.virtual || b.virtual || a.spring || (o.kind === "stair" && b.kind === "stair") || a.kind === "chimney" || o.mv || (o.kind === "stair" && b.kind === "corner")) continue;   // (a stair's first step reaches back to its corner square on purpose)
      const under = o.c[1] - o.h[1];
      if (under > y && under < y + 2.5 && o.c[0] + o.h[0] > x0 && o.c[0] - o.h[0] < x1 && o.c[2] + o.h[2] > z0 && o.c[2] - o.h[2] < z1) { problems.push(`#${k} (floor ${b.floor}): only ${(under - y).toFixed(2)} m of headroom under #${PATH.indexOf(o)}`); break; }
    }
  }
  const chimneys = PATH.filter((L) => L.kind === "chimney").length, movers = PATH.filter((L) => L.mv).length, vents = PATH.filter((L) => L.vent).length, crumbles = PATH.filter((L) => L.crumble).length, ice = PATH.filter((L) => L.ice).length, springs = PATH.filter((L) => L.spring).length, swings = PATH.filter((L) => L.kind === "swing").length, strikes = PATH.filter((L) => L.strike).length, maces = PATH.filter((L) => L.mace).length, windy = PATH.filter((L) => L.windy).length, icicles = PATH.filter((L) => L.icicle).length, spinners = PATH.filter((L) => L.spin).length, sweepers = PATH.filter((L) => L.sweep).length, belts = PATH.filter((L) => L.belt).length;
  const dives = PATH.filter((L) => L.dive).length, beams = PATH.filter((L) => L.kind === "beam").length;
  return { ledges: PATH.length, dives, beams, chimneys, movers, vents, crumbles, ice, icicles, springs, swings, maces, strikes, windy, gusts: GUSTS.length, spinners, sweepers, belts, worstUse: +worst.toFixed(2), problems };
}

/* ------------------------------------------------------------------ textures (img/tex-*.webp, made seamless by build-textures.mjs) */
const texLoader = new THREE.TextureLoader(), TEX = {};
function tex(name) {
  if (!TEX[name]) { const t = texLoader.load(`img/${name}.webp?v=${ART_V}`); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TEX[name] = t; }
  return TEX[name];
}
const texMat = (name, color = 0xffffff) => new THREE.MeshStandardMaterial({ map: tex(name), color, roughness: 0.85 });
const MAT = { wall: texMat("tex-stone-wall", 0xd8d0c8), floor: texMat("tex-stone-floor"), plank: texMat("tex-wood-plank"),
  stormWall: texMat("tex-storm-stone"), stormFloor: texMat("tex-storm-stone", 0xc8c0d8),
  chainWall: texMat("tex-stone-wall", 0x8a8078), chainFloor: texMat("tex-stone-floor", 0xa89c90),
  galeWall: texMat("tex-stone-wall", 0xd8e2ee), galeFloor: texMat("tex-stone-floor", 0xe6ecf2),
  frostWall: texMat("tex-stone-wall", 0xc0d8ec), frostFloor: texMat("tex-stone-floor", 0xd4e4f0), ice: new THREE.MeshStandardMaterial({ map: tex("tex-ice"), roughness: 0.15, metalness: 0.1 }),
  clockWall: texMat("tex-stone-wall", 0xa89068), clockFloor: texMat("tex-stone-floor", 0xc0a880),
  cryptWall: texMat("tex-stone-wall", 0x6a5a7a), cryptFloor: texMat("tex-stone-floor", 0x9888a8), crumbly: texMat("tex-stone-floor", 0xb8a0c0),
  forgeWall: texMat("tex-stone-wall", 0xa08070), forgeFloor: texMat("tex-stone-floor", 0xb89880), brass: texMat("tex-brass"),
  wetWall: texMat("tex-stone-wall", 0x9ab4c4), wetFloor: texMat("tex-stone-floor", 0xa8bcc8), kick: texMat("tex-stone-wall", 0x7ab0c8) };
const kickTrim = new THREE.MeshBasicMaterial({ color: 0x6ae0ff });
/** A box whose texture repeats every `tile` metres on every face; `turn` turns the top and bottom a quarter (planks along z). */
function texBox(sx, sy, sz, mat, tile = 2, turn = false) {
  const g = new THREE.BoxGeometry(sx, sy, sz), uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v, u0 = uv.getX(i), v0 = uv.getY(i), [du, dv] = dims[f];
    if (turn && (f === 2 || f === 3)) uv.setXY(i, v0 * dv / tile, u0 * du / tile); else uv.setXY(i, u0 * du / tile, v0 * dv / tile);
  }
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}

/* ------------------------------------------------------------------ building it */
const WORLD = new THREE.Group(); scene.add(WORLD);
const M4 = (x, y, z, ry = 0) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(1, 1, 1));
const stone = new THREE.MeshStandardMaterial({ color: 0x4a4048, roughness: 0.9 });
const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });

// the shaft: four walls you can lean on, drawn as KayKit wall pieces, four across and a row every 4 m
for (const [c, h] of [[[0, CEIL_Y / 2, -A - 0.5], [A + 1, CEIL_Y / 2 + 1, 0.5]], [[0, CEIL_Y / 2, A + 0.5], [A + 1, CEIL_Y / 2 + 1, 0.5]], [[-A - 0.5, CEIL_Y / 2, 0], [0.5, CEIL_Y / 2 + 1, A + 1]], [[A + 0.5, CEIL_Y / 2, 0], [0.5, CEIL_Y / 2 + 1, A + 1]]]) new Box(c, h, { kind: "wall" });
{
  const r = rng(SEED + 1), sets = { wall: [], wallCracked: [], wallWindow: [], wallArched: [] }, pillars = [];
  for (let row = 0; row * 4 < ZH; row++) {
    for (let s = 0; s < 4; s++) for (let i = 0; i < (2 * A) / 4; i++) {
      const t = 2 + i * 4, [x, z] = SIDES[s].at(t), [ix, iz] = SIDES[s].into, roll = r();
      const key = row === 0 && i === 1 && s === 2 ? "wallArched" : roll < 0.12 ? "wallCracked" : roll < 0.2 ? "wallWindow" : "wall";
      sets[key].push(M4(x - ix * 0.5, row * 4, z - iz * 0.5, s % 2 ? Math.PI / 2 : 0));
    }
    for (const [x, z] of CORNERS) pillars.push(M4(x, row * 4, z));
  }
  for (const [k, list] of Object.entries(sets)) { const im = Models.instanced(k, list, { box: [4, 4, 1] }); if (im) WORLD.add(im); }
  for (let row = ZH / 4; row * 4 < CEIL_Y + 4; row++) for (const [x, z] of CORNERS) pillars.push(M4(x, row * 4, z));
  const pl = Models.instanced("pillar", pillars, { box: [1.6, 4, 1.6] }); if (pl) WORLD.add(pl);
  // the Barracks and up: the owner's stone, one slab a wall
  // the Barracks in dry stone, the Well and up in damp blue stone
  for (const [y0, y1, mat] of [[ZH, 2 * ZH, MAT.wall], [2 * ZH, 3 * ZH, MAT.wetWall], [3 * ZH, 4 * ZH, MAT.forgeWall], [4 * ZH, 5 * ZH, MAT.cryptWall], [5 * ZH, 6 * ZH, MAT.clockWall], [6 * ZH, 7 * ZH, MAT.frostWall], [7 * ZH, 8 * ZH, MAT.galeWall], [8 * ZH, 9 * ZH, MAT.chainWall], [9 * ZH, CEIL_Y + 0.4, MAT.stormWall]]) {
    const H = y1 - y0;
    for (const [x, z, sx, sz] of [[0, -A - 0.25, 2 * A, 0.5], [0, A + 0.25, 2 * A, 0.5], [-A - 0.25, 0, 0.5, 2 * A], [A + 0.25, 0, 0.5, 2 * A]]) {
      const w = texBox(sx, H, sz, mat, 3); w.position.set(x, y0 + H / 2, z); w.castShadow = false; WORLD.add(w);
    }
  }
  // a band of trim where the Cellar's stone ends
  const trim = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 });
  for (const [x, z, sx, sz] of [[0, -A + 0.15, 2 * A, 0.3], [0, A - 0.15, 2 * A, 0.3], [-A + 0.15, 0, 0.3, 2 * A], [A - 0.15, 0, 0.3, 2 * A]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.4, sz), trim); b.position.set(x, ZH - 0.2 + 0.0, z); WORLD.add(b); }
}
// the cellar floor and the landing room's floor (with the gap the stair comes up through), and a ceiling for now
new Box([0, -0.5, 0], [A, 0.5, A], { kind: "floor" });
// each landing room's floor: everything east of the stair gap, and the stair's top step in the north-west corner
// (the hole is where that zone's stair comes up: STAIR_X)
const landingParts = (z) => { const [hx0, hx1] = STAIR_X[z - 1], parts = [[(hx1 + A) / 2, 0, (A - hx1) / 2, A], [(hx0 + hx1) / 2, (-A - 4) / 2, (hx1 - hx0) / 2, (A - 4) / 2]]; if (hx0 > -A) parts.push([(hx0 - A) / 2, 0, (hx0 + A) / 2, A]); return parts; };
for (let z = 1; z <= ZONES_BUILT; z++) for (const [x, zc, hx, hz] of landingParts(z)) new Box([x, z * ZH - 0.25, zc], [hx, 0.25, hz], { kind: "landing" }).zone = z;
if (!COMPLETE) new Box([0, CEIL_Y + 0.5, 0], [A, 0.5, A], { kind: "ceiling" });
{
  // floors drawn as KayKit tiles, 4 m each
  const tiles = (y, skip) => { const list = []; for (let x = -A + 2; x <= A - 2; x += 4) for (let z = -A + 2; z <= A - 2; z += 4) if (!skip?.(x, z)) list.push(M4(x, y - 0.15, z)); return list; };
  const g0 = Models.instanced("tileLarge", tiles(0), { box: [4, 0.15, 4] }); if (g0) WORLD.add(g0);
  const g1 = Models.instanced("tileLarge", tiles(ZONE_Y, (x, z) => x < STAIR_X[0][1] && z > -4), { box: [4, 0.15, 4] }); if (g1) WORLD.add(g1);
  // the underside of the landing room's floor, so it reads as a slab from below
  const under = new THREE.Mesh(new THREE.BoxGeometry(2 * A - 3, 0.4, 2 * A), stone); under.position.set(1.5, ZONE_Y - 0.35, 0); WORLD.add(under);   // (east of the 3 m hole)
  const under2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, A - 4), stone); under2.position.set(-A + 1.5, ZONE_Y - 0.35, (-A - 4) / 2); WORLD.add(under2);
  // the Barracks' landing room: a slab in the owner's flagstone
  for (let z = 2; z <= ZONES_BUILT; z++) for (const [x, zc, hx, hz] of landingParts(z)) { const sl = texBox(hx * 2, 0.5, hz * 2, z >= 10 ? MAT.stormFloor : z >= 9 ? MAT.chainFloor : z >= 8 ? MAT.galeFloor : z >= 7 ? MAT.frostFloor : z >= 6 ? MAT.clockFloor : z >= 5 ? MAT.cryptFloor : z >= 4 ? MAT.forgeFloor : z >= 3 ? MAT.wetFloor : MAT.floor, 2.5); sl.position.set(x, z * ZH - 0.25, zc); WORLD.add(sl); }
  if (!COMPLETE) { const grate = Models.instanced("grate", tiles(CEIL_Y + 1.05).map((m) => m), { box: [4, 1.05, 4] }); if (grate) WORLD.add(grate); }
  else {
    // the parapet's merlons, round the top of the wall
    for (let s2 = 0; s2 < 4; s2++) for (let i = 0; i < 10; i += 2) { const tt = 1 + i * 2, [x, z] = SIDES[s2].at(tt + 1), [ix, iz] = SIDES[s2].into, mer = texBox(s2 % 2 ? 0.8 : 2, 1.2, s2 % 2 ? 2 : 0.8, MAT.stormWall, 2); mer.position.set(x - ix * 0.15, CEIL_Y + 0.6, z - iz * 0.15); WORLD.add(mer); }
  }
}
// the ledges: stone slabs, wooden boards every third one, the stair in stone
const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.4 });
const movers = [], vents = [], crumbles = [], spinners = [], sweepers = [], belts = [], icicleList = [], springMeshes = [], maceList = [], strikeList = [];
let roofNow = 0;
const roofSun = () => clamp((me.p.y - (ROOF_Y - 3)) / 4, 0, 1) * 1.4;
/** Lays a thin cylinder (a chain) from point a to point b. */
function chainBetween(m, a, b) { const d = new V3().subVectors(b, a), l = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, l, 1); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); }
// a belt's surface: chevrons pointing the way it runs (+u)
const beltTex = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#2a2a32"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#ffd23a"; g.lineWidth = 12; for (const x of [20, 84]) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x + 30, 64); g.lineTo(x, 104); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const ledgeBoxes = PATH.map((L, k) => {
  if (L.virtual) return null;
  const b = new Box(L.c, L.h, { kind: L.kind }); b.k = k; b.floor = L.floor; L.box = b;
  const sx = L.h[0] * 2, sy = L.h[1] * 2, sz = L.h[2] * 2;
  if (L.zone === 9) {
    if (L.mv && L.mv.swing) {
      const m = texBox(sx, sy, sz, MAT.plank, 1.5, L.side % 2 === 1); m.position.set(...L.c); WORLD.add(m);
      const [ix, iz] = SIDES[L.side].into, pivot = new V3(L.c[0], topOf(L) + L.mv.swing.Lr, L.c[2]), wallD = L.h[0] * Math.abs(ix) + L.h[2] * Math.abs(iz) + 0.2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(iz) * 0.4 + Math.abs(ix) * wallD * 2, 0.3, Math.abs(ix) * 0.4 + Math.abs(iz) * wallD * 2), ironMat); arm.position.set(pivot.x - ix * wallD, pivot.y + 0.15, pivot.z - iz * wallD); WORLD.add(arm);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.8, roughness: 0.35 })); WORLD.add(chain);
      b.mv = L.mv; b.vel = new V3(); b.base = new V3(...L.c); b.mesh = m; b.chain = chain; b.pivot = pivot; movers.push(b); return b;
    }
    if (L.mv) { const m = texBox(sx, sy, sz, MAT.brass, 1.5); m.position.set(...L.c); WORLD.add(m); b.mv = L.mv; b.vel = new V3(); b.base = new V3(...L.c); b.mesh = m; movers.push(b); return b; }
    const wood = L.kind === "beam", along = L.h[0] > L.h[2];
    const m = texBox(sx, sy, sz, L.ice ? MAT.ice : wood ? MAT.plank : L.crumble ? MAT.crumbly : MAT.stormFloor, wood || L.ice ? 2.5 : 2, wood && !along); m.position.set(...L.c); WORLD.add(m);
    if (L.ice) b.ice = true;
    if (L.belt) {
      const [fx, fz] = TRAVEL[L.side], dir = Math.sign(L.belt), len = L.side % 2 ? sz : sx, dep = L.side % 2 ? sx : sz;
      const tx = beltTex.clone(); tx.needsUpdate = true; tx.repeat.set(len / 1.2, 1);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(len, dep * 0.92), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 }));
      top.rotation.x = -Math.PI / 2; top.rotation.z = Math.atan2(-fz * dir, fx * dir); top.position.set(L.c[0], topOf(L) + 0.01, L.c[2]); WORLD.add(top);
      b.vel = new V3(fx * L.belt, 0, fz * L.belt); belts.push({ tx, speed: Math.abs(L.belt) });
    }
    if (L.crumble) { const seam = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.03, 0.05, sz + 0.03), new THREE.MeshBasicMaterial({ color: 0x5aff9a, transparent: true, opacity: 0.55 })); seam.position.y = -sy / 2 + 0.06; m.add(seam); b.crumble = { hold: L.crumble, state: "idle", t: 0, vy: 0, y0: b.c.y }; b.mesh = m; crumbles.push(b); }
    if (L.strike) {
      m.material = m.material.clone(); m.material.emissive = new THREE.Color(0x000000);
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 40, 0.25), new THREE.MeshBasicMaterial({ color: 0xe8d0ff })); bolt.position.set(L.c[0], topOf(L) + 20, L.c[2]); bolt.visible = false; WORLD.add(bolt);
      const glow = new THREE.PointLight(0xb070ff, 0, 10, 1.6); glow.position.set(L.c[0], topOf(L) + 1, L.c[2]); WORLD.add(glow);
      strikeList.push({ L, b, m, bolt, glow, was: "calm" });
    }
    return b;
  }
  if (L.zone === 8) {
    if (L.mv) {
      // a swing: planks on an iron frame, hung on a chain from a bracket 3.5 m up the wall
      const m = texBox(sx, sy, sz, MAT.plank, 1.5, L.side % 2 === 1); m.position.set(...L.c); WORLD.add(m);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.1, 0.12, sz + 0.1), ironMat); frame.position.y = -sy / 2; m.add(frame);
      const [ix, iz] = SIDES[L.side].into, pivot = new V3(L.c[0], topOf(L) + L.mv.swing.Lr, L.c[2]);
      const wallD = L.h[0] * Math.abs(ix) + L.h[2] * Math.abs(iz) + 0.2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(iz) * 0.4 + Math.abs(ix) * wallD * 2, 0.3, Math.abs(ix) * 0.4 + Math.abs(iz) * wallD * 2), ironMat);
      arm.position.set(pivot.x - ix * wallD, pivot.y + 0.15, pivot.z - iz * wallD); WORLD.add(arm);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.8, roughness: 0.35 })); WORLD.add(chain);
      b.mv = L.mv; b.vel = new V3(); b.base = new V3(...L.c); b.mesh = m; b.chain = chain; b.pivot = pivot; movers.push(b);
      return b;
    }
    const m = texBox(sx, sy, sz, L.crumble ? MAT.crumbly : MAT.chainFloor, 2); m.position.set(...L.c); WORLD.add(m);
    if (L.crumble) { const seam = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.03, 0.05, sz + 0.03), new THREE.MeshBasicMaterial({ color: 0x5aff9a, transparent: true, opacity: 0.55 })); seam.position.y = -sy / 2 + 0.06; m.add(seam); b.crumble = { hold: L.crumble, state: "idle", t: 0, vy: 0, y0: b.c.y }; b.mesh = m; crumbles.push(b); }
    if (L.mace) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.35 }));
      for (let i = 0; i < 10; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), ironMat); const a1 = (i / 10) * Math.PI * 2, a2 = (i % 3) * 0.9 - 0.9; sp.position.set(Math.cos(a1) * Math.cos(a2) * 0.6, Math.sin(a2) * 0.6, Math.sin(a1) * Math.cos(a2) * 0.6); sp.lookAt(sp.position.clone().multiplyScalar(2)); sp.rotateX(Math.PI / 2); ball.add(sp); }
      WORLD.add(ball);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.8, roughness: 0.35 })); WORLD.add(chain);
      maceList.push({ L, ball, chain, pivot: new V3(...macePivot(L)) });
      // a bracket for the pivot, out from the wall
      { const [ix, iz] = SIDES[L.side].into, [px, py, pz] = macePivot(L), wall = 1.9 + 0.2; const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(iz) * 0.4 + Math.abs(ix) * wall, 0.3, Math.abs(ix) * 0.4 + Math.abs(iz) * wall), ironMat); arm.position.set(px - ix * wall / 2, py + 0.15, pz - iz * wall / 2); WORLD.add(arm); }
    }
    return b;
  }
  if (L.zone === 7) {
    if (L.mv) { const m = texBox(sx, sy, sz, MAT.brass, 1.5); m.position.set(...L.c); WORLD.add(m); b.mv = L.mv; b.vel = new V3(); b.base = new V3(...L.c); b.mesh = m; movers.push(b); return b; }
    const m = texBox(sx, sy, sz, MAT.galeFloor, 2); m.position.set(...L.c); WORLD.add(m);
    if (L.spring) {
      b.spring = true;
      const sp = Models.get("spring", { size: 1.5 }); if (sp) { sp.position.set(L.c[0], topOf(L), L.c[2]); WORLD.add(sp); springMeshes.push({ m: sp, b, t: 0 }); }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 24), new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(L.c[0], topOf(L) + 0.02, L.c[2]); WORLD.add(ring);
    }
    return b;
  }
  if (L.zone === 6) {
    const m = texBox(sx, sy, sz, L.ice ? MAT.ice : L.crumble ? MAT.crumbly : MAT.frostFloor, L.ice ? 2.5 : 2); m.position.set(...L.c); WORLD.add(m);
    if (L.ice) b.ice = true;
    if (L.crumble) { const seam = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.03, 0.05, sz + 0.03), new THREE.MeshBasicMaterial({ color: 0x5aff9a, transparent: true, opacity: 0.55 })); seam.position.y = -sy / 2 + 0.06; m.add(seam); b.crumble = { hold: L.crumble, state: "idle", t: 0, vy: 0, y0: b.c.y }; b.mesh = m; crumbles.push(b); }
    if (L.icicle) {
      // a frosty bracket on the wall, 4 m up, and the icicle under it
      const [ix, iz] = SIDES[L.side].into, wallX = L.c[0] - ix * (L.h[0] * Math.abs(ix) + L.h[2] * Math.abs(iz)), wallZ = L.c[2] - iz * (L.h[0] * Math.abs(ix) + L.h[2] * Math.abs(iz));
      const hx = L.c[0], hz = L.c[2], top = topOf(L), hang = top + 4.2;
      const br = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(iz) * 1.2 + Math.abs(ix) * (Math.abs(hx - wallX) + 0.4), 0.3, Math.abs(ix) * 1.2 + Math.abs(iz) * (Math.abs(hz - wallZ) + 0.4)), MAT.frostWall);
      br.position.set((hx + wallX) / 2, hang + 0.15, (hz + wallZ) / 2); WORLD.add(br);
      const ice = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 7), new THREE.MeshStandardMaterial({ color: 0xcaf0ff, roughness: 0.1, transparent: true, opacity: 0.9 }));
      ice.rotation.x = Math.PI; ice.position.set(hx, hang - 0.8, hz); WORLD.add(ice);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: 0x0a1a2a, transparent: true, opacity: 0 })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(hx, top + 0.02, hz); WORLD.add(shadow);
      icicleList.push({ L, ic: L.icicle, ice, shadow, hang, top });
    }
    return b;
  }
  if (L.zone === 5) {
    if (L.mv) { const m = texBox(sx, sy, sz, MAT.brass, 1.5); m.position.set(...L.c); WORLD.add(m); b.mv = L.mv; b.vel = new V3(); b.base = new V3(...L.c); b.mesh = m; movers.push(b); return b; }
    if (L.spin) {
      // a brass turntable with teeth round its rim, so the turn reads
      const g = new THREE.Group(); g.position.set(L.c[0], L.c[1], L.c[2]); WORLD.add(g);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(L.rad, L.rad, 0.5, 32), MAT.brass); disc.castShadow = disc.receiveShadow = true; g.add(disc);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, tooth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.3), ironMat); tooth.position.set(Math.cos(a) * (L.rad + 0.1), 0, Math.sin(a) * (L.rad + 0.1)); tooth.rotation.y = -a; g.add(tooth); }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(L.rad * 1.9, 0.02, 0.18), new THREE.MeshBasicMaterial({ color: 0x3a2a10 })); stripe.position.y = 0.26; g.add(stripe);
      b.disc = L.rad; b.spin = L.spin; b.mesh = g; spinners.push(b); return b;
    }
    if (L.belt) {
      const m = texBox(sx, sy, sz, MAT.clockFloor, 2); m.position.set(...L.c); WORLD.add(m);
      const [fx, fz] = TRAVEL[L.side], dir = Math.sign(L.belt), len = L.side % 2 ? sz : sx, dep = L.side % 2 ? sx : sz;
      const tx = beltTex.clone(); tx.needsUpdate = true; tx.repeat.set(len / 1.2, 1);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(len, dep * 0.92), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 }));
      top.rotation.x = -Math.PI / 2; top.rotation.z = Math.atan2(-fz * dir, fx * dir); top.position.set(L.c[0], topOf(L) + 0.01, L.c[2]); WORLD.add(top);
      b.vel = new V3(fx * L.belt, 0, fz * L.belt); belts.push({ tx, speed: Math.abs(L.belt) });
      return b;
    }
    const m = texBox(sx, sy, sz, MAT.clockFloor, 2); m.position.set(...L.c); WORLD.add(m);
    if (L.sweep) {
      const g = new THREE.Group(); g.position.set(L.c[0], topOf(L), L.c[2]); WORLD.add(g);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.0, 12), ironMat); hub.position.y = 0.5; g.add(hub);
      // one clock hand, from the hub out to a red tip
      const arm = new THREE.Mesh(new THREE.BoxGeometry(L.h[0] * 1.35, 0.22, 0.3), MAT.brass); arm.position.set(L.h[0] * 0.675, 0.6, 0); arm.castShadow = true; g.add(arm);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), new THREE.MeshBasicMaterial({ color: 0xff5a2a })); tip.rotation.z = -Math.PI / 2; tip.position.set(L.h[0] * 1.35 + 0.15, 0.6, 0); g.add(tip);
      sweepers.push({ L, g });
      new Box([L.c[0], topOf(L) + 0.5, L.c[2]], [0.35, 0.5, 0.35], { kind: "hub" });   // the hub is solid: the arm always passes over it
    }
    return b;
  }
  if (L.zone === 4) {
    const wood = L.kind === "beam", along = L.h[0] > L.h[2];
    const m = texBox(sx, sy, sz, wood ? MAT.plank : L.crumble ? MAT.crumbly : MAT.cryptFloor, wood ? 2.5 : 2, wood && !along); m.position.set(...L.c); WORLD.add(m);
    if (L.crumble) {
      // a cracked slab: a faint green seam round its foot says "this one won't hold"
      const seam = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.03, 0.05, sz + 0.03), new THREE.MeshBasicMaterial({ color: 0x5aff9a, transparent: true, opacity: 0.55 })); seam.position.y = -sy / 2 + 0.06; m.add(seam);
      b.crumble = { hold: L.crumble, state: "idle", t: 0, vy: 0, y0: b.c.y }; b.mesh = m; crumbles.push(b);
    }
    return b;
  }
  if (L.zone === 3) {
    if (L.mv) {
      const m = texBox(sx, sy, sz, MAT.brass, 1.5); m.position.set(...L.c); WORLD.add(m);
      b.mv = L.mv; b.vel = new V3(); b.base = new V3(...L.c); b.mesh = m; movers.push(b);
      // rivets of light along its edge, so a moving platform reads as one
      const glow = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.04, 0.06, sz + 0.04), new THREE.MeshBasicMaterial({ color: 0xffb040 })); glow.position.y = -sy / 2 + 0.03; m.add(glow);
      return b;
    }
    const m = texBox(sx, sy, sz, MAT.forgeFloor, 2); m.position.set(...L.c); WORLD.add(m);
    if (L.vent) {
      const g = new THREE.Group(); g.position.set(L.c[0], topOf(L), L.c[2]); WORLD.add(g);
      const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x2a2220, metalness: 0.6, roughness: 0.5, emissive: 0x000000 })); grate.position.y = 0.03; g.add(grate);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7020, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); flame.position.y = 1.3; flame.visible = false; g.add(flame);
      const light = new THREE.PointLight(0xff6020, 0, 9, 1.6); light.position.y = 1.2; g.add(light);
      vents.push({ L, b, v: L.vent, grate, flame, light });
    }
    return b;
  }
  if (L.zone === 2) {
    const m = texBox(sx, sy, sz, MAT.wetFloor, 2); m.position.set(...L.c); WORLD.add(m);
    if (L.kind === "chimney") {
      const yb = topOf(L), top = yb + L.H + KICK_OVER;
      for (const [d0, d1] of [[0, 0.3], [KICK_GAP + 0.3, KICK_GAP + 0.6]]) {
        const w = sideBox(L.side, L.t0, L.t1, d0, d1, d0 ? yb - 0.6 : yb, top);
        new Box(w.c, w.h, { kind: "kick" });
        const mesh = texBox(w.h[0] * 2, w.h[1] * 2, w.h[2] * 2, MAT.kick, 2); mesh.position.set(...w.c); WORLD.add(mesh);
        // a glowing edge marks a wall you can kick
        const tr = sideBox(L.side, L.t0, L.t1, d0 - 0.02, d1 + 0.02, top - 0.12, top);
        const tm = new THREE.Mesh(new THREE.BoxGeometry(tr.h[0] * 2, tr.h[1] * 2, tr.h[2] * 2), kickTrim); tm.position.set(...tr.c); WORLD.add(tm);
        for (const e of [L.t0, L.t1]) { const st = sideBox(L.side, e - 0.06, e + 0.06, d0 - 0.02, d1 + 0.02, d0 ? yb - 0.6 : yb, top); const sm = new THREE.Mesh(new THREE.BoxGeometry(st.h[0] * 2, st.h[1] * 2, st.h[2] * 2), kickTrim); sm.position.set(...st.c); WORLD.add(sm); }
      }
    }
    return b;
  }
  if (L.zone === 1) {
    // the Barracks: stone ledges and corners in flagstone, beams in planks on iron brackets, stairs in flagstone
    const along = L.h[0] > L.h[2], wood = L.kind === "beam";
    const m = texBox(sx, sy, sz, wood ? MAT.plank : MAT.floor, wood ? 2.5 : 2, wood && !along); m.position.set(...L.c); WORLD.add(m);
    if (wood) { const n = Math.max(2, Math.round(Math.max(sx, sz) / 1.6)); for (let i = 0; i < n; i++) { const o = -0.5 + (i + 0.5) / n; const br = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.12 : 0.6, 0.5, along ? 0.6 : 0.12), ironMat); br.position.set(L.c[0] + (along ? o * sx : 0), L.c[1] - 0.45, L.c[2] + (along ? 0 : o * sz)); WORLD.add(br); } }
    return b;
  }
  const isWood = L.kind === "ledge" && k % 3 === 1;
  const m = L.kind === "stair" ? null : Models.get(isWood ? "woodSmall" : L.kind === "corner" ? "tileLarge" : "tileSmall", { box: [sx, Math.min(0.5, sy), sz] });
  if (m) { m.position.set(L.c[0], L.c[1] - L.h[1], L.c[2]); WORLD.add(m); }
  else { const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), L.kind === "stair" ? stone : wood); mesh.position.set(...L.c); mesh.castShadow = mesh.receiveShadow = true; WORLD.add(mesh); }
  if (L.kind === "stair") { const t = Models.get("tileSmall", { box: [sx, 0.12, sz] }); if (t) { t.position.set(L.c[0], L.c[1] + L.h[1] - 0.12, L.c[2]); WORLD.add(t); } }
  // a wooden board hangs on two iron brackets
  if (isWood) for (const s of [-0.7, 0.7]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.4 })); const along = Math.abs(L.h[0]) > Math.abs(L.h[2]); br.position.set(L.c[0] + (along ? s * L.h[0] : 0), L.c[1] - 0.5, L.c[2] + (along ? 0 : s * L.h[2])); WORLD.add(br); }
  return b;
});
// torches: two a floor, on whichever walls the path is not on just there, and the flames glow
const flames = [];
{
  const r = rng(SEED + 2);
  for (let fl = 0; fl < ZONES_BUILT * 10 + 1; fl++) for (let n = 0; n < 2; n++) {
    const s = Math.floor(r() * 4), t = 3 + r() * 10, [x, z] = SIDES[s].at(t), [ix, iz] = SIDES[s].into, y = fl * FH + 3.4;
    const tm = Models.get("torch", { height: 1.1 }); if (!tm) continue;
    tm.position.set(x + ix * 0.3, y, z + iz * 0.3); tm.rotation.y = Math.atan2(ix, iz); WORLD.add(tm);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); f.position.set(x + ix * 0.55, y + 1.05, z + iz * 0.55); WORLD.add(f); flames.push(f);
  }
}
// the Gale Gallery: wind streaks over each windy side, shown as a gust gathers and blows
const streaks = [];
{
  const r = rng(SEED + 12), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  for (const g of GUSTS) {
    const list = [];
    for (let i = 0; i < 14; i++) {
      const m2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.05), mat.clone());
      const tt = g.t0 + r() * (g.t1 - g.t0), yy = g.y0 + 1 + r() * (g.y1 - g.y0 - 1);
      m2.userData = { tt, yy, out: r() * 9, sp: 6 + r() * 4 };
      const [ix, iz] = SIDES[g.side].into; m2.rotation.y = Math.atan2(ix, iz) + Math.PI / 2; WORLD.add(m2); list.push(m2);
    }
    streaks.push({ g, list });
  }
}
// the Clockworks: big gears on the walls, two a floor, turning
const wallGears = [];
{
  const r = rng(SEED + 9);
  for (let fl = 51; fl <= 60; fl++) for (let n = 0; n < 2; n++) {
    const s2 = Math.floor(r() * 4), tt = 4 + r() * (2 * A - 8), [x, z] = SIDES[s2].at(tt), [ix, iz] = SIDES[s2].into, rad = 1.4 + r() * 1.2;
    const g = new THREE.Group(); g.position.set(x + ix * 0.2, 5 * ZH + (fl - 51) * FH + 3 + r() * 2, z + iz * 0.2); g.lookAt(g.position.x + ix, g.position.y, g.position.z + iz); WORLD.add(g);
    const inner = new THREE.Group(); g.add(inner);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.25, 28), MAT.brass); body.rotation.x = Math.PI / 2; inner.add(body);
    const nT = Math.round(rad * 9); for (let i = 0; i < nT; i++) { const a = (i / nT) * Math.PI * 2, tooth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.25), MAT.brass); tooth.position.set(Math.cos(a) * (rad + 0.12), Math.sin(a) * (rad + 0.12), 0); tooth.rotation.z = a; inner.add(tooth); }
    const hubm = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.25, rad * 0.25, 0.35, 12), ironMat); hubm.rotation.x = Math.PI / 2; inner.add(hubm);
    wallGears.push({ inner, w: (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.4) / rad });
  }
}
// the Crypt: a green candle on one corner square a floor, the only light but yours
{
  const r = rng(SEED + 7);
  for (let fl = 41; fl <= 50; fl++) {
    const cs = PATH.filter((L) => L.floor === fl && L.kind === "corner"); if (!cs.length) continue;
    const L = cs[Math.floor(r() * cs.length)], m = Models.get("candles", { size: 0.7 }); if (!m) continue;
    m.position.set(L.c[0] + (L.c[0] > 0 ? 0.4 : -0.4), topOf(L), L.c[2] + (L.c[2] > 0 ? 0.4 : -0.4)); WORLD.add(m);
    const lt = new THREE.PointLight(0x6aff9a, 9, 9, 1.8); lt.position.set(m.position.x, m.position.y + 1, m.position.z); WORLD.add(lt);
  }
}
// the Barracks: a red or brown banner on every wall, every other floor
{
  const r = rng(SEED + 3);
  for (let fl = 11; fl <= 20; fl += 2) for (let s = 0; s < 4; s++) {   // (the Well has none: it is a well)
    const t = 4 + r() * 8, [x, z] = SIDES[s].at(t), [ix, iz] = SIDES[s].into;
    const bn = Models.get(r() < 0.5 ? "bannerRed" : "bannerBrown", { height: 2.6 }); if (!bn) continue;
    bn.position.set(x + ix * 0.15, ZH + (fl - 11) * FH + 2.6, z + iz * 0.15); bn.rotation.y = Math.atan2(ix, iz); WORLD.add(bn);
  }
}
// the cellar floor: barrels, crates, a keg, candles; the way up starts in the north-west corner
for (const [k, x, z, s, ry] of [["barrel", 8, 8, 1.6, 0], ["barrels", 6, 8.4, 1.4, 1], ["crates", 8.2, 5.4, 2, 0.4], ["keg", -8, 8, 1.4, 0], ["box", -8.2, 5.6, 1.3, 0.3], ["candles", -1, 8.6, 0.7, 0], ["rubble", 2, -1, 2.2, 2], ["trunk", 8.4, -2, 1.6, -1.57]]) {
  const m = Models.get(k, { size: s }); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; WORLD.add(m); }
}
// the landing rooms: a brazier you light, a banner, a chest, and a sign for what comes next
const NEXT = [["THE BARRACKS", "narrow beams · the dive"], ["THE WELL", "wall-kicks"], ["THE FORGE", "moving platforms · fire"], ["THE CRYPT", "crumbling slabs · the dark"], ["THE CLOCKWORKS", "spinners · gears · belts"], ["THE FROST VAULT", "ice · falling icicles"], ["THE GALE GALLERY", "wind · springs"], ["THE CHAIN HALL", "swinging platforms"], ["THE STORM SPIRE", "everything · lightning"]];
const braziers = [];
function landingRoom(z) {
const y = z * ZH, brazier = new THREE.Group(); brazier.position.set(3, y, 0); WORLD.add(brazier); braziers[z] = brazier;
{
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x3a3438, metalness: 0.5, roughness: 0.5 })); bowl.position.y = 1.25; brazier.add(bowl);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1, 8), bowl.material); leg.position.y = 0.5; brazier.add(leg);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 })); fire.position.y = 2.1; fire.visible = false; brazier.add(fire); brazier.userData.fire = fire;
  const light = new THREE.PointLight(0xff9040, 0, 22, 1.4); light.position.y = 2.4; brazier.add(light); brazier.userData.light = light;
  new Box([3, y + 0.7, 0], [0.8, 0.7, 0.8], { kind: "prop" });
  const ch = Models.get("chest", { size: 1.7 }); if (ch) { ch.position.set(5.6, y, 5.6); ch.rotation.y = -2.4; WORLD.add(ch); }
  const co = Models.get("coins", { size: 0.8 }); if (co) { co.position.set(4.4, y, 6.2); WORLD.add(co); }
}
{
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
  g.fillStyle = "#1a1418"; g.fillRect(0, 0, 1024, 512); g.strokeStyle = "#d8a23a"; g.lineWidth = 14; g.strokeRect(14, 14, 996, 484);
  const [name, what] = NEXT[z - 1], open = z < ZONES_BUILT;
  g.fillStyle = "#ffd27a"; g.font = "900 84px Georgia, serif"; g.textAlign = "center"; g.fillText(`ZONE ${z + 1}`, 512, 170);
  g.fillStyle = "#fff0cc"; g.font = "800 66px Georgia, serif"; g.fillText(name, 512, 270);
  g.fillStyle = "#a89070"; g.font = "700 40px Georgia, serif"; g.fillText(`${what} · ${open ? "up the stair" : "coming next"}`, 512, 380);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  // a freestanding board in the room (the walls are covered in the next zone's ledges), facing the stair you came up
  const board = new THREE.Group(); board.position.set(1, y, 4.5); board.rotation.y = Math.PI; WORLD.add(board);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); sign.position.y = 2.3; board.add(sign);
  for (const sx of [-1.8, 1.8]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), wood); post.position.set(sx, 1.7, 0.05); board.add(post); }
  new Box([1, y + 1, 4.5], [2, 1, 0.15], { kind: "prop" });
  texLoader.load(`img/zone-${EMBLEM[z]}.webp?v=${ART_V}`, (et) => { et.colorSpace = THREE.SRGBColorSpace; const em = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: et, transparent: true, side: THREE.DoubleSide })); em.position.set(0, 4.1, 0.02); board.add(em); });
}
}
for (let z = 1; z <= Math.min(ZONES_BUILT, 9); z++) landingRoom(z);
// the roof: a bronze bell under a stone arch in the middle; walk up to it to ring it
const bell = new THREE.Group();
if (COMPLETE) {
  bell.position.set(2, ROOF_Y, 0); WORLD.add(bell);
  for (const sx2 of [-1.6, 1.6]) { const post = texBox(0.6, 4.2, 0.6, MAT.stormWall, 2); post.position.set(sx2, 2.1, 0); bell.add(post); new Box([2 + sx2, ROOF_Y + 2.1, 0], [0.3, 2.1, 0.3], { kind: "prop" }); }
  const beam2 = texBox(4.0, 0.5, 0.7, MAT.stormWall, 2); beam2.position.y = 4.4; bell.add(beam2);
  const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(0.15 + Math.pow(u, 1.6) * 0.95 + (u > 0.85 ? (u - 0.85) * 1.2 : 0), 1.4 - u * 1.4)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0xc89040, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide })); body.position.y = 2.6; bell.add(body); bell.userData.body = body;
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), ironMat); clap.position.y = 2.75; bell.add(clap);
  const sunL = new THREE.DirectionalLight(0xfff0d0, 0); sunL.position.set(30, ROOF_Y + 60, 20); scene.add(sunL); bell.userData.sun = sunL;
}
let bellSwing = 0, bellRung = false;
function ringBell() {
  bellSwing = 1; Sfx.play("finish", "gold"); setTimeout(() => Sfx.play("finish", "gold"), 450);
  if (bellRung) return; bellRung = true;
  wearCrown(); const el = $("cleared"); el.hidden = false;
  el.querySelector("b").textContent = "The Summit";
  el.querySelector("p").textContent = `You rang the bell at the top of The Climb: 100 floors in ${fmtTime(me.time)}, with ${me.falls} fall${me.falls === 1 ? "" : "s"}. The crown is yours for the season.`;
}
function wearCrown() {
  if (me.mesh.crown) return;
  const c = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.8, roughness: 0.25, emissive: 0x3a2a00 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.14, 12, 1, true), gold); c.add(band);
  for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold); const a2 = (i / 5) * Math.PI * 2; sp.position.set(Math.cos(a2) * 0.25, 0.14, Math.sin(a2) * 0.25); c.add(sp); }
  c.position.y = 1.78; me.mesh.g.add(c); me.mesh.crown = c;
}

/* ------------------------------------------------------------------ people */
const CHARS = ["char-male-a", "char-female-b", "char-male-c", "char-female-d", "char-male-e", "char-female-f"];
function makeLabel(text, color = "#fff") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d");
  g.font = "800 50px Georgia, serif"; g.textAlign = "center"; g.lineWidth = 9; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(text, 256, 64); g.fillStyle = color; g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(2.4, 0.45, 1); s.renderOrder = 5; return s;
}
function makePerson(model, name, color) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const ch = Models.char(model, 1.6);
  if (ch) { ch.obj.rotation.y = Math.PI; g.add(ch.obj); }
  else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.6, 6, 12), new THREE.MeshStandardMaterial({ color })); b.position.y = 0.75; g.add(b); }
  if (name !== "You") { const tag = makeLabel(name, color); tag.position.y = 2.1; g.add(tag); }   // your own name would only cover the view
  scene.add(g); return { g, ch };
}
// admin tools: ?admin=1 in this mockup (the site would use ADMIN_LOGINS). An admin climb saves under its own key.
const ADMIN = new URLSearchParams(location.search).has("admin");
const SAVE = ADMIN ? "ecClimbAdmin" : "ecClimb";
let save = null; try { save = JSON.parse(localStorage.getItem(SAVE) || "null"); } catch {}
// the lounge's shared look (character, hat): one record every game reads
let shared = null; try { shared = JSON.parse(localStorage.getItem("ecPlayer") || "null"); } catch {}
const me = { wallT: 0, wallN: new V3(), p: new V3(-5.5, R + 0.05, -5.5), v: new V3(), facing: 0, grounded: false, coyote: 0, buffer: 0, dive: 0, stun: 0, groundVel: new V3(), under: null,
  fly: false, model: shared?.model || save?.model || CHARS[0], best: save?.best || 1, falls: save?.falls || 0, time: save?.time || 0, cleared: save?.cleared ?? (save?.lit ? 1 : 0), lastFloorOn: 1, airFrom: 0, hints: 0, hintAt: -1 };
if (save?.p) me.p.set(save.p[0], save.p[1] + 0.05, save.p[2]);
me.mesh = makePerson(me.model, "You", "#ffd27a");
if (shared?.hat === "crown") queueMicrotask(() => wearCrown());

/* THE ARCADE'S SHELL (2026-10-07): the menu (Esc), settings, the arcade's chat bottom left (Enter), you as yourself top right, the
   jukebox's sound. Your look comes from your account; the lounge's room server is told which floor you're on. Other climbers are
   not drawn here yet: that is the shared tower room, next. */
const climbSettings = { ...Arcade.DEFAULT_SETTINGS };
const touch = { x: 0, y: 0, jump: false, dive: false };   // the shell's thumbstick and buttons write here (phones)
const ARC = await Arcade.start({
  stage: document.querySelector(".stage"), room: "climb", title: "The Climb", where: `floor ${me.best}`,
  localUnlocks: [...(me.best >= 50 ? ["halo"] : []), ...(save?.summit ? ["crown"] : [])],
  help: `<p><b>Move</b> with WASD, <b>jump</b> with Space, <b>dive</b> with Shift, <b>drag</b> (or Q / E) to turn the camera.</p>
    <p>Jump into a wall and jump again to <b>kick off it</b>. Miss and you fall to wherever you land. Every tenth floor is a landing room whose brazier saves your place.</p>
    <p><b>Enter</b> opens the chat, <b>Esc</b> the menu, <b>M</b> mutes.</p>`,
  lookHint: "Hats are changed at the lounge's prize counter.",
  touch: { state: touch, buttons: [{ id: "dive", label: "DIVE", cls: "alt" }, { id: "jump", label: "JUMP" }] },
  onLook: (id, look, mine) => {
    if (!mine) return;
    if (look.model !== me.model) { const pos = me.mesh.g.position.clone(); scene.remove(me.mesh.g); me.model = look.model; me.mesh = makePerson(me.model, "You", "#ffd27a"); me.mesh.g.position.copy(pos); }
    if (look.hat === "crown") wearCrown();
  }
});
ARC.onSettings((s) => {
  Object.assign(climbSettings, s);
  Sfx.setVolume(s.master * s.sfx, s.mute);
  renderer.setPixelRatio(s.quality === "low" ? 0.75 : s.quality === "medium" ? 1 : Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = s.quality !== "low";
});

const BOT_NAMES = ["drhealsgud", "cenozoicmegafauna", "PsilocyBoone", "heartlarva", "zwades"];
const bots = BOT_NAMES.map((name, i) => {
  const b = { name, i: -1, t: 1 + i * 2.5, skill: 0.84 + i * 0.025, arc: null, color: ["#9ae0ff", "#ffa0c8", "#b0f0a0", "#ffd890", "#d0b0ff"][i] };
  b.mesh = makePerson(CHARS[(i + 1) % CHARS.length], name, b.color);
  b.mesh.g.position.set(1 + i * 1.2, 0, 2.5 + (i % 2) * 1.2); return b;   // waiting by the barrels, clear of your start
});

/* ------------------------------------------------------------------ input (Parkour's) */
const keys = {};
let dragId = null, camYaw = Math.PI * 0.75, camPitch = 0.5, dragging = false, lastX = 0, lastY = 0, jumpWas = false, diveWas = false;
function wakeAudio() { Sfx.ensure(); Sfx.startPending(); }
addEventListener("keydown", (e) => { if (document.activeElement !== canvas) return; wakeAudio(); if (ADMIN && e.code === "KeyF" && !e.repeat) setFly(!me.fly); keys[e.code] = true; if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); });
addEventListener("keyup", (e) => { keys[e.code] = false; });
canvas.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener("pointerdown", (e) => { wakeAudio(); dragging = true; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; canvas.focus(); });
addEventListener("pointerup", (e) => { if (e.pointerId === dragId) dragging = false; });
addEventListener("pointercancel", (e) => { if (e.pointerId === dragId) dragging = false; });
addEventListener("pointermove", (e) => { if (!dragging || e.pointerId !== dragId) return; camYaw -= (e.clientX - lastX) * 0.006 * climbSettings.camSens; camPitch = clamp(camPitch + (e.clientY - lastY) * 0.004 * climbSettings.camSens * (climbSettings.invertY ? -1 : 1), -0.2, 1.25); lastX = e.clientX; lastY = e.clientY; });
function syncMute() { const b = $("muteBtn"); if (b) b.textContent = climbSettings.mute ? "Sound off" : "Sound on"; }
$("muteBtn")?.addEventListener("click", () => { wakeAudio(); ARC.set("mute", !climbSettings.mute); syncMute(); }); ARC.onSettings(syncMute);
function readInput() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touch.y;
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.x;
  if (keys.KeyQ) camYaw += 0.035; if (keys.KeyE) camYaw -= 0.035;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const x = fx * f + rx * s, z = fz * f + rz * s, l = Math.hypot(x, z);
  const jump = Boolean(keys.Space || touch.jump), dive = Boolean(keys.ShiftLeft || keys.ShiftRight || touch.dive);
  const out = { x: l > 1 ? x / l : x, z: l > 1 ? z / l : z, jumpPressed: jump && !jumpWas, divePressed: dive && !diveWas };
  jumpWas = jump; diveWas = dive; return out;
}

/* ------------------------------------------------------------------ the climb */
const TOP_FLOOR = ZONES_BUILT * 10;
const floorAt = (y) => clamp(Math.floor((y + 0.6) / FH) + 1, 1, TOP_FLOOR + 1);
const zoneAt = (y) => clamp(Math.floor((y + 0.6) / ZH), 0, ZONES_BUILT);   // ZONES_BUILT = the top landing room
let t = 0, saveT = 0, toastT = 0;
function toast(s, ms = 2.2) { $("hudMsg").textContent = s; toastT = ms; }
function stepMe(dt) {
  const inp = readInput();
  if (me.fly) {
    // flying: no gravity, no collisions; WASD where the camera looks, Space up, C down, Shift for speed
    const sp = keys.ShiftLeft || keys.ShiftRight ? 32 : 12, up = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
    me.v.set(inp.x * sp, up * sp, inp.z * sp); me.p.addScaledVector(me.v, dt);
    me.p.x = clamp(me.p.x, -A + 0.6, A - 0.6); me.p.z = clamp(me.p.z, -A + 0.6, A - 0.6); me.p.y = clamp(me.p.y, R, COMPLETE ? ROOF_Y + 30 : CEIL_Y - 0.6);
    if (Math.hypot(inp.x, inp.z) > 0.1) me.facing = Math.atan2(inp.x, inp.z) + Math.PI;
    me.grounded = false; me.under = null; me.airFrom = -1e9;   // stopping never counts as a fall
    return;
  }
  me.stun = Math.max(0, me.stun - dt); me.dive = Math.max(0, me.dive - dt);
  me.coyote = me.grounded ? COYOTE : Math.max(0, me.coyote - dt);
  me.buffer = inp.jumpPressed ? BUFFER : Math.max(0, me.buffer - dt);
  me.wallT = Math.max(0, me.wallT - dt);
  if (me.stun <= 0 && me.dive <= 0) {
    const acc = me.grounded ? (me.under?.ice ? ICE_ACC : ACC_GROUND) : ACC_AIR;
    me.v.x += clamp(inp.x * RUN - me.v.x, -acc * dt, acc * dt); me.v.z += clamp(inp.z * RUN - me.v.z, -acc * dt, acc * dt);
    if (me.buffer > 0 && me.coyote > 0) {
      me.v.y = JUMP; me.coyote = 0; me.buffer = 0; me.grounded = false; Sfx.play("jump");
      // off something moving (a platform, a swing), you keep its momentum
      if (me.under?.mv && me.under.vel) { me.v.x += me.under.vel.x; me.v.z += me.under.vel.z; me.v.y += Math.max(0, me.under.vel.y); }
    }
    else if (me.buffer > 0 && !me.grounded && me.wallT > 0) {
      // a wall-kick: off the wall and up (wallT goes to zero, so the same touch can't kick twice)
      me.v.x = me.wallN.x * WALL_KICK; me.v.z = me.wallN.z * WALL_KICK; me.v.y = JUMP; me.buffer = 0; me.wallT = 0;
      me.facing = Math.atan2(me.wallN.x, me.wallN.z) + Math.PI; Sfx.play("kick");
    }
    if (inp.divePressed && me.dive <= 0 && Math.hypot(inp.x, inp.z) > 0.2) { const l = Math.hypot(inp.x, inp.z); me.v.x = (inp.x / l) * DIVE; me.v.z = (inp.z / l) * DIVE; me.v.y = me.grounded ? 4.5 : Math.max(me.v.y, 3.5); me.dive = 0.6; me.grounded = false; Sfx.play("dive"); }
    if (Math.hypot(inp.x, inp.z) > 0.1) me.facing = Math.atan2(inp.x, inp.z) + Math.PI;
  } else if (me.grounded) { me.v.x *= 1 - 6 * dt; me.v.z *= 1 - 6 * dt; }
  me.v.y = Math.max(-40, me.v.y + G * dt);
  const gust = gustAt(me.p.x, me.p.y, me.p.z);
  me.p.addScaledVector(me.v, dt);
  // a gust is moving air: it carries you (like a belt), so only steering into the wall holds you against it
  if (gust && gustState(gust, t) === "on") { const [ix, iz] = SIDES[gust.side].into, k = (me.grounded ? 0.4 : 1) * GUST * dt; me.p.x += ix * k; me.p.z += iz * k; }
  if (me.grounded && me.under?.vel) me.p.addScaledVector(me.under.vel, dt);   // a platform or a belt carries you
  if (me.grounded && me.under?.spin) {   // a turntable turns you with it
    const u = me.under, a = u.spin * dt, dx = me.p.x - u.c.x, dz = me.p.z - u.c.z, ca = Math.cos(a), sa = Math.sin(a);
    me.p.x = u.c.x + dx * ca - dz * sa; me.p.z = u.c.z + dx * sa + dz * ca; me.facing -= a;
  }
  const was = me.grounded, fallSpeed = -me.v.y;
  if (was) me.airFrom = me.p.y;
  me.grounded = false; me.under = null;
  for (const b of boxes) {
    if (b.disc) {
      // a turntable: a round top to stand on (its sides are thin; you just fall past)
      const dx = me.p.x - b.c.x, dz = me.p.z - b.c.z, top = b.c.y + b.h.y;
      if (dx * dx + dz * dz < b.disc * b.disc && me.p.y - R < top + 0.05 && me.p.y - R > top - 0.5 && me.v.y <= 0.5) { me.p.y = top + R; me.v.y = Math.max(0, me.v.y); me.grounded = true; me.under = b; }
      continue;
    }
    if (!sphereBox(me.p, R, b)) continue;
    me.p.addScaledVector(hit.n, hit.pen);
    const vn = me.v.dot(hit.n); if (vn < 0) me.v.addScaledVector(hit.n, -vn);
    if (hit.n.y > 0.6 && b.spring && me.v.y <= 0.5) { me.v.y = SPRING_V; me.grounded = false; me.under = b; me.coyote = 0; me.airFrom = me.p.y; Sfx.play("jump"); const sm = springMeshes.find((x) => x.b === b); if (sm) sm.t = 0.25; continue; }
    if (hit.n.y > 0.6) { me.grounded = true; me.under = b; if (me.dive > 0 && me.dive < 0.45) { me.dive = 0; me.stun = 0.25; } if (b.crumble?.state === "idle") { b.crumble.state = "shake"; b.crumble.t = b.crumble.hold; Sfx.play("step"); } }
    else if (b.kind === "kick" && Math.abs(hit.n.y) < 0.35) {
      me.wallT = WALL_WINDOW; me.wallN.set(hit.n.x, 0, hit.n.z).normalize();
      if (me.v.y < -3) me.v.y = -3;   // a little grip on a kick wall, so a kick can be timed
    }
  }
  if (me.grounded && !was) landed(fallSpeed);
  const k = me.under?.k;
  if (me.grounded && k !== undefined && PATH[k + 1]?.dive && me.hintAt !== k && me.hints < 4) { me.hintAt = k; me.hints++; toast("Long gap: jump, then Shift in the air to dive", 3.2); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.mv && me.mvHintAt !== k && (me.mvHints || 0) < 3) { me.mvHintAt = k; me.mvHints = (me.mvHints || 0) + 1; toast("A moving platform: wait for it to come close, ride it across", 3.4); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.vent && me.ventHintAt !== k && (me.ventHints || 0) < 3) { me.ventHintAt = k; me.ventHints = (me.ventHints || 0) + 1; toast("A fire vent: it glows, then flares. Cross while it's out", 3.4); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.strike && (me.stHints || 0) < 2 && me.stHintAt !== k) { me.stHintAt = k; me.stHints = (me.stHints || 0) + 1; toast("Lightning: when a ledge crackles purple, get off it", 3); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.kind === "swing" && (me.swgHints || 0) < 2 && me.swgHintAt !== k) { me.swgHintAt = k; me.swgHints = (me.swgHints || 0) + 1; toast("A swing: hop on as it comes close; jump off at the far end and you keep its speed", 3.4); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.mace && (me.mcHints || 0) < 2 && me.mcHintAt !== k) { me.mcHintAt = k; me.mcHints = (me.mcHints || 0) + 1; toast("A mace: cross while it's swung away", 2.6); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.spring && (me.spHints || 0) < 2 && me.spHintAt !== k) { me.spHintAt = k; me.spHints = (me.spHints || 0) + 1; toast("A spring pad: land on it, then steer onto the ledge above", 3); }
  if (me.grounded && k !== undefined && PATH[k]?.windy && (me.wnHints || 0) < 2 && me.wnHintAt !== k) { me.wnHintAt = k; me.wnHints = (me.wnHints || 0) + 1; toast("Windy wall: when the streaks thicken, a gust blows you out. Jump between gusts", 3.2); }
  if (me.grounded && k !== undefined && PATH[k]?.ice && (me.iceHints || 0) < 2 && me.iceHintAt !== k) { me.iceHintAt = k; me.iceHints = (me.iceHints || 0) + 1; toast("Ice: slow to start, slow to stop. Brake early", 2.8); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.icicle && (me.icHints || 0) < 2 && me.icHintAt !== k) { me.icHintAt = k; me.icHints = (me.icHints || 0) + 1; toast("An icicle overhead: it shakes, then drops. Go after it falls", 3); }
  if (me.grounded && k !== undefined && PATH[k + 1]?.sweep && (me.swHints || 0) < 3 && me.swHintAt !== k) { me.swHintAt = k; me.swHints = (me.swHints || 0) + 1; toast("A clock hand: cross behind it, or jump it as it comes round", 3); }
  if (me.grounded && k !== undefined && PATH[k]?.belt && (me.btHints || 0) < 2 && me.btHintAt !== k) { me.btHintAt = k; me.btHints = (me.btHints || 0) + 1; toast(PATH[k].belt > 0 ? "A belt: it carries you along" : "A belt running back: run against it", 2.6); }
  if (me.grounded && k !== undefined && PATH[k]?.crumble && (me.crHints || 0) < 3 && me.crHintAt !== k) { me.crHintAt = k; me.crHints = (me.crHints || 0) + 1; toast("Green seams crumble: keep moving!", 2.6); }
  if (me.grounded && k !== undefined && PATH[k]?.kind === "chimney" && me.kickHintAt !== k && (me.kickHints || 0) < 4) { me.kickHintAt = k; me.kickHints = (me.kickHints || 0) + 1; toast("Glowing walls kick: jump at one, jump again each time you touch a wall", 3.6); }
  me.stepT = (me.stepT || 0) - dt;
  if (me.grounded && Math.hypot(me.v.x, me.v.z) > 2.5 && me.stepT <= 0) { Sfx.play("step"); me.stepT = 0.27; }
}
/** Touching down: how far did you fall, and is this a new best? */
function landed(fallSpeed) {
  if (fallSpeed > 3) Sfx.play("land", Math.min(1, fallSpeed / 22));
  const fl = floorAt(me.p.y), drop = me.airFrom - me.p.y;
  if (drop > 3.5) {
    me.falls++; const lost = me.lastFloorOn - fl;
    toast(lost >= 1 ? `Fell ${lost} floor${lost === 1 ? "" : "s"}${lost >= 5 ? ". Ouch." : ""}` : "Slipped", 2.4); if (drop > 10) Sfx.play("fall");
  }
  me.lastFloorOn = fl;
  ARC.setWhere(fl > TOP_FLOOR ? "the roof" : `floor ${fl}`);
  if (fl > me.best && fl <= TOP_FLOOR && me.under?.kind !== "landing") { me.best = fl; toast(`Floor ${fl}: new best`, 1.8); Sfx.play("checkpoint"); }
  const z = me.under?.kind === "landing" ? me.under.zone : 0;
  if (z === 10 && z > me.cleared) { me.cleared = 10; me.best = 100; Sfx.play("finish", "gold"); toast("The roof! Ring the bell", 3); persist(); return; }
  if (z > me.cleared) { me.cleared = z; me.best = Math.max(me.best, z * 10 + 1); litBrazier(z, true); Sfx.play("finish", "gold"); showCleared(z); persist(); }
}
function litBrazier(z, on) { const b = braziers[z]; if (!b) return; b.userData.fire.visible = on; b.userData.light.intensity = on ? 40 : 0; }
for (let z = 1; z <= me.cleared; z++) litBrazier(z, true);
if (save?.summit) { bellRung = true; setTimeout(wearCrown, 0); }
function showCleared(z) {
  const el = $("cleared"); el.hidden = false;
  el.querySelector("b").textContent = `${ZONES[z - 1]}: cleared`;
  const next = z < ZONES_BUILT ? `Zone ${z + 1}, ${ZONES[z]}, is up the stair.` : `Zone ${z + 1}, ${ZONES[z]}, opens next.`;
  el.querySelector("p").textContent = `Floor ${z * 10} reached in ${fmtTime(me.time)} with ${me.falls} fall${me.falls === 1 ? "" : "s"}. The brazier is lit: you'll start here from now on. ${next}`;
}
$("cleared")?.addEventListener("click", (e) => { if (e.target.closest("button")) $("cleared").hidden = true; });
const fmtTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60); return h ? `${h}h ${m}m` : `${m}:${String(sec).padStart(2, "0")}`; };
function persist() { try { localStorage.setItem(SAVE, JSON.stringify({ p: [+me.p.x.toFixed(2), +me.p.y.toFixed(2), +me.p.z.toFixed(2)], best: me.best, falls: me.falls, time: Math.round(me.time), cleared: me.cleared, model: me.model, summit: bellRung })); } catch {} }
addEventListener("pagehide", persist);

/* ---- the bots: they climb the same path, one jump at a time, and sometimes fall the way you do */
function botTarget(k) { const L = PATH[k]; return new V3(L.c[0] + (Math.random() - 0.5) * L.h[0], topOf(L), L.c[2] + (Math.random() - 0.5) * L.h[2]); }
function landingBelow(x, z, y) {
  // the highest surface under (x, z) below y: a ledge, the landing room, or the cellar floor
  let best = { k: -1, y: Math.min(ZONES_BUILT, Math.floor((y - 0.1) / ZH)) * ZH };
  PATH.forEach((L, k) => { const tp = topOf(L); if (tp < y - 0.1 && tp > best.y && Math.abs(x - L.c[0]) <= L.h[0] && Math.abs(z - L.c[2]) <= L.h[2]) best = { k, y: tp }; });
  return best;
}
function stepBot(b, dt) {
  const g = b.mesh.g, ch = b.mesh.ch;
  if (b.arc) {
    const a = b.arc; a.t += dt; const k = Math.min(1, a.t / a.dur);
    g.position.set(lerp(a.from.x, a.to.x, k), lerp(a.from.y, a.to.y, k) + Math.sin(k * Math.PI) * a.peak, lerp(a.from.z, a.to.z, k));
    ch?.play(a.fall ? "fall" : k < 0.5 ? "jump" : "fall");
    if (k >= 1) { b.arc = null; b.i = a.k; b.t = 0.6 + Math.random() * 1.6; if (a.fall) b.t += 1.5; }
  } else if (b.i < PATH.length - 1) {
    b.t -= dt; ch?.play(b.t < 0.35 ? "walk" : "idle");
    if (b.t <= 0) {
      const next = b.i + 1, from = g.position.clone(), to = botTarget(next), L = PATH[next];
      const diff = (L.floor % 10 || 10) / 10 * 0.08 + (L.dive ? 0.12 : 0) + (L.kind === "beam" ? 0.04 : 0);
      const climbing = PATH[b.i]?.kind === "chimney";
      if (L.kind === "stair" || climbing || Math.random() < b.skill - diff + 0.1) {
        b.arc = { from, to, t: 0, dur: L.kind === "stair" ? 0.35 : climbing ? 1.6 : 0.55, peak: L.kind === "stair" ? 0.3 : climbing ? 0.4 : 1.2, k: next };
      } else {
        // a miss: short of the ledge, then down to whatever is below
        const miss = from.clone().lerp(to, 0.7); miss.x += (Math.random() - 0.5) * 1.5; miss.z += (Math.random() - 0.5) * 1.5;
        miss.x = clamp(miss.x, -A + 0.4, A - 0.4); miss.z = clamp(miss.z, -A + 0.4, A - 0.4);
        const under = landingBelow(miss.x, miss.z, from.y);
        const land = under.k >= 0 ? new V3(miss.x, under.y, miss.z) : new V3(miss.x, 0, miss.z);
        b.arc = { from, to: land, t: 0, dur: 0.45 + Math.sqrt(Math.max(0, from.y - land.y)) * 0.18, peak: 0.6, k: under.k, fall: true };
      }
      const d = new V3().subVectors(b.arc.to, from); g.rotation.y = Math.atan2(d.x, d.z) + Math.PI;
    }
  } else {
    // at the top: wander the landing room
    ch?.play("idle");
  }
  if (!b.arc && PATH[b.i]?.box?.vel) g.position.addScaledVector(PATH[b.i].box.vel, dt);   // riding a platform
  if (ch && Math.abs(g.position.y - me.p.y) < 30) ch.update(dt);
}

/* ------------------------------------------------------------------ the frame */
const _cam = new V3(), _look = new V3(); let camDist = 7.5;
function stepWorld(dt) {
  t += dt; me.time += dt;
  // lightning: a struck ledge is not there (this is physics, so it lives here, not in draw)
  for (const sl of strikeList) {
    const st = strikeState(sl.L.strike, t);
    sl.b.solid = st !== "gone";
    if (st === "gone" && sl.was !== "gone" && Math.abs(sl.L.c[1] - me.p.y) < 40) { sl.flash = 0.18; Sfx.play("bonk"); }
    sl.was = st;
  }
  if (window.__climbTrace) window.__climbTrace.push([+me.p.x.toFixed(2), +me.p.y.toFixed(2), +me.p.z.toFixed(2), me.grounded ? (me.under?.k ?? me.under?.kind) : "", me.fly ? "F" : ""]);   // test-only trace
  for (const b of movers) {
    const [fx, fz] = TRAVEL[b.mv.side];
    if (b.mv.swing) {
      const [o, up] = swingOffset(b.mv, t), nx = b.base.x + fx * o, ny = b.base.y + up, nz = b.base.z + fz * o;
      b.vel.set((nx - b.c.x) / dt, (ny - b.c.y) / dt, (nz - b.c.z) / dt); b.c.set(nx, ny, nz);
    } else {
      const o = moverOffset(b.mv, t), nx = b.base.x + fx * o, nz = b.base.z + fz * o;
      b.vel.set((nx - b.c.x) / dt, 0, (nz - b.c.z) / dt); b.c.x = nx; b.c.z = nz;
    }
  }
  for (const b of crumbles) {
    const c = b.crumble;
    if (c.state === "shake") { c.t -= dt; if (c.t <= 0) { c.state = "fall"; c.vy = 0; c.t = 0.15; } }
    else if (c.state === "fall") { c.vy += G * 0.7 * dt; b.c.y += c.vy * dt; c.t -= dt; if (c.t <= 0) b.solid = false; if (b.c.y < c.y0 - 14) { c.state = "gone"; c.t = 3.5; } }
    else if (c.state === "gone") { c.t -= dt; if (c.t <= 0) { c.state = "idle"; b.c.y = c.y0; b.solid = true; } }
  }
  stepMe(dt);
  // a swinging mace knocks you off
  for (const f of maceList) {
    if (me.fly || me.stun > 0 || Math.abs(f.pivot.y - me.p.y) > 8) continue;
    const [bx, by, bz] = macePos(f.L, t);
    if (Math.hypot(me.p.x - bx, me.p.y - by, me.p.z - bz) < 0.55 + R) {
      const [ix, iz] = SIDES[f.L.side].into; me.v.set(ix * 6, 3, iz * 6); me.stun = 0.6; me.grounded = false; me.airFrom = me.p.y; toast("Mace!", 1.4); Sfx.play("bonk");
    }
  }
  // a falling icicle: in its last moment it is at head height over its ledge
  for (const f of icicleList) {
    if (me.fly || me.stun > 0 || icicleState(f.ic, t) !== "fall") continue;
    const ph = ((t + f.ic.phase) % f.ic.T + f.ic.T) % f.ic.T, k = (ph - (f.ic.T - f.ic.fall)) / f.ic.fall;
    const tipY = f.hang - 1.6 - k * (f.hang - 1.6 - f.top);
    if (k > 0.45 && Math.hypot(me.p.x - f.L.c[0], me.p.z - f.L.c[2]) < 0.75 && me.p.y + R > tipY - 0.2 && me.p.y - R < f.top + 2) {
      const [ix, iz] = SIDES[f.L.side].into; me.v.set(ix * 5, 2, iz * 5); me.stun = 0.6; me.grounded = false; me.airFrom = me.p.y; toast("Icicle!", 1.4); Sfx.play("bonk");
    }
  }
  // a sweeper arm throws you off its corner, unless you're over it
  for (const sw of sweepers) {
    if (me.fly || me.stun > 0) continue;
    const L = sw.L, hy = me.p.y - R - topOf(L);
    if (hy > -0.2 && hy < 0.85 && Math.abs(me.p.x - L.c[0]) < L.h[0] * 1.5 && Math.abs(me.p.z - L.c[2]) < L.h[2] * 1.5 && sweepDist(L, t, me.p.x, me.p.z) < 0.6) {
      const th = sweepAngle(L.sweep, t), sgn = Math.sign(L.sweep.w), px = me.p.x - L.c[0], pz = me.p.z - L.c[2], side = Math.sign(px * -Math.sin(th) + pz * Math.cos(th)) || 1;
      const nx = -Math.sin(th) * side, nz = Math.cos(th) * side;
      me.v.set(nx * 7 + (L.c[0] > 0 ? -1 : 1) * 0, 5, nz * 7); me.stun = 0.5; me.grounded = false; me.airFrom = me.p.y; toast("Swept!", 1.4); Sfx.play("bonk");
    }
  }
  // fire: inside a burning vent's flame, you are thrown off the ledge, out into the shaft
  for (const f of vents) {
    if (me.fly || ventState(f.v, t) !== "on") continue;
    const dx = me.p.x - f.L.c[0], dz = me.p.z - f.L.c[2], dyv = me.p.y - topOf(f.L);
    if (dx * dx + dz * dz < 0.95 * 0.95 && dyv > -0.2 && dyv < 2.8 && me.stun <= 0) {
      const [ix, iz] = SIDES[f.L.side].into;
      me.v.set(ix * 7, 6, iz * 7); me.stun = 0.6; me.grounded = false; me.airFrom = me.p.y; toast("Burned!", 1.6); Sfx.play("bonk");
    }
  }
  for (const b of bots) stepBot(b, dt);
  saveT += dt; if (saveT > 3 && me.grounded) { saveT = 0; persist(); }
  if (COMPLETE) {
    if (Math.hypot(me.p.x - bell.position.x, me.p.z - bell.position.z) < 2.2 && Math.abs(me.p.y - (ROOF_Y + R)) < 1.5 && bellSwing < 0.2) { ringBell(); persist(); }
    bellSwing = Math.max(0, bellSwing - dt * 0.35);
  }
}
function draw(dt) {
  const g = me.mesh.g; g.position.copy(me.p); g.position.y -= R;
  let dy = me.facing - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * 0.3;
  const ch = me.mesh.ch;
  if (ch) { const sp = Math.hypot(me.v.x, me.v.z); ch.play(!me.grounded ? (me.v.y > 0 ? "jump" : "fall") : sp > 5 ? "sprint" : sp > 0.6 ? "walk" : "idle"); ch.update(dt); }
  // the camera orbits you but never leaves the shaft (the walls would block the view)
  // the camera sits on a line out behind you; a wall or the ceiling in the way shortens the line (fast), and it eases back out (slowly).
  // Shortening along the line, rather than clamping x and z on their own, is what stops it sliding and snapping in corners.
  const dx = Math.sin(camYaw) * Math.cos(camPitch), dy2 = Math.sin(camPitch), dz = Math.cos(camYaw) * Math.cos(camPitch);
  const ox = me.p.x, oy = me.p.y + 1.2, oz = me.p.z, lim = A - 0.6;
  let room = 7.5;
  if (dx > 1e-4) room = Math.min(room, (lim - ox) / dx); else if (dx < -1e-4) room = Math.min(room, (-lim - ox) / dx);
  if (dz > 1e-4) room = Math.min(room, (lim - oz) / dz); else if (dz < -1e-4) room = Math.min(room, (-lim - oz) / dz);
  if (dy2 > 1e-4 && oy < CEIL_Y) room = Math.min(room, (CAM_TOP - oy) / dy2);
  room = Math.max(0.35, room);
  camDist += (room - camDist) * (room < camDist ? 0.45 : 0.06);
  // squeezed against a wall, the camera rises over your shoulder and looks down instead of going through the wall
  const lift = Math.max(0, 7.5 - camDist) * 0.6;
  _cam.set(ox + dx * camDist, Math.min(CAM_TOP, oy + dy2 * camDist + lift), oz + dz * camDist);
  camera.position.lerp(_cam, 0.25); _look.set(me.p.x, me.p.y + 0.9, me.p.z); camera.lookAt(_look);
  lantern.position.set(me.p.x, me.p.y + 2.2, me.p.z);
  for (let i = 0; i < flames.length; i++) flames[i].scale.setScalar(0.85 + Math.sin(t * 9 + i * 1.7) * 0.15);
  for (const b of movers) { b.mesh.position.set(b.c.x, b.c.y, b.c.z); if (b.chain) chainBetween(b.chain, b.pivot, new V3(b.c.x, b.c.y + b.h.y, b.c.z)); }
  for (const f of maceList) { if (Math.abs(f.pivot.y - me.p.y) > 30) continue; const [bx, by, bz] = macePos(f.L, t); f.ball.position.set(bx, by, bz); chainBetween(f.chain, f.pivot, f.ball.position); }
  for (const b of spinners) b.mesh.rotation.y -= b.spin * dt;
  for (const sw of sweepers) sw.g.rotation.y = -sweepAngle(sw.L.sweep, t);
  for (const bt of belts) bt.tx.offset.x -= (bt.speed / 1.2) * dt;
  for (const wg of wallGears) wg.inner.rotation.z += wg.w * dt;
  for (const sm of springMeshes) { sm.t = Math.max(0, sm.t - dt); sm.m.scale.y = 1 + sm.t * 1.6; }
  if (COMPLETE && bell.userData.body) { bell.userData.body.rotation.z = Math.sin(t * 6) * 0.35 * bellSwing; bell.userData.sun.intensity = roofSun(); }
  for (const st of streaks) {
    const g = st.g; if (Math.abs((g.y0 + g.y1) / 2 - me.p.y) > 30) { for (const m2 of st.list) m2.visible = false; continue; }
    const state = gustState(g, t), op = state === "on" ? 0.55 : state === "warn" ? 0.18 : 0, S = SIDES[g.side], [ix, iz] = S.into, [fx, fz] = TRAVEL[g.side], [x0, z0] = S.at(0);
    for (const m2 of st.list) {
      const u = m2.userData; m2.visible = op > 0; if (!op) continue;
      u.out = (u.out + u.sp * dt * (state === "on" ? 1 : 0.35)) % 9;
      m2.position.set(x0 + fx * u.tt + ix * u.out, u.yy, z0 + fz * u.tt + iz * u.out); m2.material.opacity = op * (1 - u.out / 9);
    }
  }
  for (const f of icicleList) {
    if (Math.abs(f.top - me.p.y) > 30) continue;
    const st = icicleState(f.ic, t), ph = ((t + f.ic.phase) % f.ic.T + f.ic.T) % f.ic.T;
    if (st === "fall") { const k = (ph - (f.ic.T - f.ic.fall)) / f.ic.fall; f.ice.position.y = f.hang - 0.8 - k * (f.hang - 1.6 - f.top); f.ice.visible = k < 0.95; f.ice.position.x = f.L.c[0]; }
    else { f.ice.visible = true; f.ice.position.y = f.hang - 0.8; f.ice.position.x = f.L.c[0] + (st === "shake" ? Math.sin(t * 60) * 0.05 : 0); }
    f.shadow.material.opacity = st === "hang" ? 0 : st === "shake" ? 0.3 : 0.6;
  }
  let flash = 0;
  for (const sl of strikeList) {
    const st = sl.was, near = Math.abs(sl.L.c[1] - me.p.y) < 30;
    sl.m.visible = st !== "gone";
    sl.m.material.emissive.setHex(st === "warn" ? (Math.sin(t * 40) > 0 ? 0x6a2aaa : 0x200a40) : 0x000000);
    sl.glow.intensity = near && st === "warn" ? 6 + Math.sin(t * 30) * 4 : 0;
    sl.flash = Math.max(0, (sl.flash || 0) - dt); sl.bolt.visible = sl.flash > 0 && near; if (sl.flash > 0 && near) flash = Math.max(flash, sl.flash / 0.18);
  }
  // up the Spire the storm darkens the sky; a strike nearby lights it white; on the roof, the sky opens
  const spire = clamp((me.p.y - (9 * ZH - 4)) / 10, 0, 1), roof = COMPLETE ? clamp((me.p.y - (ROOF_Y - 3)) / 4, 0, 1) : 0;
  const skyCol = new THREE.Color(0x0c0a10).lerp(new THREE.Color(0x1a1030), spire).lerp(new THREE.Color(0x7aa0d8), roof).lerp(new THREE.Color(0xf0e8ff), flash * 0.6);
  scene.background.copy(skyCol); scene.fog.color.copy(skyCol);
  roofNow = roof;
  for (const b of crumbles) { const c = b.crumble; b.mesh.visible = c.state !== "gone"; b.mesh.position.set(b.c.x + (c.state === "shake" ? Math.sin(t * 70) * 0.05 : 0), b.c.y, b.c.z); }
  // the dark: the light falls away as you climb into the Crypt
  const dark = clamp((me.p.y - (4 * ZH - 4)) / 8, 0, 1) * (me.p.y < 5 * ZH + 2 ? 1 : 0);
  hemi.intensity += (lerp(0.55, 0.1, dark) - hemi.intensity) * 0.05; shaftLight.intensity += (lerp(0.5, 0.05, dark) - shaftLight.intensity) * 0.05;
  scene.fog.near = lerp(14, 6, dark); scene.fog.far = lerp(52, 26, dark);
  for (const f of vents) {
    const st = ventState(f.v, t), near = Math.abs(f.L.c[1] - me.p.y) < 30;
    f.flame.visible = st === "on" && near; f.flame.scale.set(1, 0.85 + Math.sin(t * 25) * 0.15, 1);
    f.grate.material.emissive.setHex(st === "off" ? 0x000000 : st === "warn" ? 0x8a2a00 : 0xff5010);
    f.light.intensity = !near ? 0 : st === "on" ? 30 : st === "warn" ? 8 + Math.sin(t * 20) * 4 : 0;
  }
  for (const b of braziers) if (b?.userData.fire.visible) b.userData.fire.scale.set(1, 0.9 + Math.sin(t * 7) * 0.12, 1);
  // on the roof the fog lifts and the day comes up (set last, so nothing above can undo it)
  if (roofNow > 0) { scene.fog.near = lerp(scene.fog.near, 80, roofNow); scene.fog.far = lerp(scene.fog.far, 320, roofNow); hemi.intensity = lerp(hemi.intensity, 1.1, roofNow); }
  renderer.render(scene, camera);
}
function hud(dt) {
  toastT = Math.max(0, toastT - dt); if (toastT <= 0) $("hudMsg").textContent = "";
  const fl = floorAt(me.p.y), zn = zoneAt(me.p.y), onLanding = me.under?.kind === "landing";
  const z = Math.min(zn, ZONES_BUILT - 1);
  $("hudFloor").textContent = onLanding ? (me.under.zone === 10 ? "The Roof" : "Landing room") : `Floor ${Math.min(fl, TOP_FLOOR)}`;
  $("hudZone").textContent = `Zone ${z + 1} · ${ZONES[z]}`;
  const zi = document.querySelector(".zi"); if (zi && zi.dataset.z !== String(z)) { zi.dataset.z = z; zi.style.visibility = "visible"; zi.onerror = () => { zi.style.visibility = "hidden"; }; zi.src = `img/zone-${EMBLEM[z]}.webp?v=${ART_V}`; }
  $("hudBest").textContent = bellRung ? "Summit: bell rung" : me.cleared >= ZONES_BUILT ? "On the roof: ring the bell" : `Best: floor ${me.best}`;
  $("hudFalls").textContent = `${me.falls} fall${me.falls === 1 ? "" : "s"} · ${fmtTime(me.time)}`;
  // the height bar: everyone in this zone, by height
  const bar = $("bar"); if (!bar) return;
  const pct = (y) => `${clamp((y - z * ZH) / ZH, 0, 1) * 100}%`;
  if (bar.dataset.z !== String(z)) { bar.dataset.z = z; bar.querySelectorAll(".tick").forEach((tk, i) => { tk.textContent = z * 10 + i + 1; }); }
  $("barMe").style.bottom = pct(me.p.y);
  bots.forEach((b, i) => { const d = $(`barB${i}`); if (d) d.style.bottom = pct(b.mesh.g.position.y); });
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
let last = performance.now(), acc = 0;
function advance(dt) { acc += dt; while (acc >= STEP) { stepWorld(STEP); acc -= STEP; } }
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; resize(); advance(dt); draw(dt); hud(dt); requestAnimationFrame(frame); }

// the side panel: the bar's dots, who's climbing, your character
{
  const bar = $("bar");
  if (bar) {
    for (let f = 1; f <= 10; f++) { const tk = document.createElement("i"); tk.className = "tick"; tk.style.bottom = `${((f - 1) * FH / ZONE_Y) * 100}%`; tk.textContent = f; bar.append(tk); }
    bots.forEach((b, i) => { const d = document.createElement("b"); d.id = `barB${i}`; d.className = "dot"; d.style.background = b.color; d.title = b.name; bar.append(d); });
    const meDot = document.createElement("b"); meDot.id = "barMe"; meDot.className = "dot me"; meDot.title = "You"; bar.append(meDot);
  }
  const pick = $("pick");
  if (pick) {
    pick.innerHTML = CHARS.map((c, i) => `<button type="button" class="k-btn sm${c === me.model ? "" : " sec"}" data-c="${c}">${["Ace", "Bea", "Cal", "Dot", "Eli", "Fay"][i]}</button>`).join("");
    pick.addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; ARC.setLook({ ...ARC.look, model: b.dataset.c }); persist(); [...pick.children].forEach((x) => x.classList.toggle("sec", x !== b)); canvas.focus(); });
  }
  $("resetBtn")?.addEventListener("click", () => { if (!confirm("Start the climb over from the cellar floor?")) return; try { localStorage.removeItem(SAVE); } catch {} location.reload(); });
}
canvas.focus();
requestAnimationFrame(frame);

/* ------------------------------------------------------------------ admin: fly, and jump to any floor */
function setFly(on) {
  me.fly = on; me.v.set(0, 0, 0); me.airFrom = -1e9;
  const b = $("flyBtn"); if (b) { b.textContent = on ? "Flying: on (F)" : "Fly: off (F)"; b.classList.toggle("sec", !on); }
  toast(on ? "Flying: WASD, Space up, C down, Shift fast · F to land" : "Landed: gravity's back", 2.4);
}
/** Puts you on the first ledge of floor f (21, 31… = that landing room), facing the next jump. */
function goFloor(f) {
  const z = Math.floor((f - 1) / 10);
  if ((f - 1) % 10 === 0 && f > 1) { me.p.set(3, z * ZH + R + 0.1, -3); }
  else { const k = PATH.findIndex((L) => L.floor === f); if (k < 0) return; const L = PATH[k], nx = PATH[k + 1] || L; me.p.set(L.c[0], topOf(L) + R + 0.05, L.c[2]); camYaw = Math.atan2(L.c[0] - nx.c[0], L.c[2] - nx.c[2]); }
  me.v.set(0, 0, 0); me.airFrom = -1e9; me.lastFloorOn = f; canvas.focus();
}
if (ADMIN) {
  const el = $("admin");
  if (el) {
    el.hidden = false;
    const floors = [];
    for (let f = 1; f <= TOP_FLOOR; f++) floors.push(`<button type="button" class="k-btn sm sec" data-f="${f}"${PATH[PATH.findIndex((L) => L.floor === f) + 1]?.dive || PATH.some((L) => L.floor === f && L.dive) ? ' title="has a dive"' : ""}>${f}</button>`);
    for (let z = 1; z <= ZONES_BUILT; z++) floors.push(`<button type="button" class="k-btn sm sec" data-f="${z * 10 + 1}" data-land="1">${z === 10 ? "The Roof" : `Landing ${z}`}</button>`);
    el.querySelector(".k-body").innerHTML = `<p class="k-note" style="margin:0 0 6px">Admin only. <kbd>F</kbd> flies (WASD, Space up, C down, Shift fast). Saves under its own key; never touches a real climb.</p>
      <button type="button" class="k-btn sm sec" id="flyBtn">Fly: off (F)</button>
      <div class="flo">${floors.join("")}</div><p class="k-note" id="adminPos" style="margin:6px 0 0"></p>`;
    el.addEventListener("click", (e) => { if (e.target.closest("#flyBtn")) { setFly(!me.fly); canvas.focus(); return; } const b = e.target.closest("[data-f]"); if (b) goFloor(+b.dataset.f); });
    setInterval(() => { const p = $("adminPos"); if (p) p.textContent = `x ${me.p.x.toFixed(1)} · y ${me.p.y.toFixed(1)} · z ${me.p.z.toFixed(1)} · floor ${floorAt(me.p.y)}${me.under?.k !== undefined ? ` · ledge #${me.under.k}${PATH[me.under.k].dive ? " (dive next)" : ""}` : ""}`; }, 250);
  }
}

/* ------------------------------------------------------------------ test hooks */
/** Plays jump k through the real physics: stand on ledge k-1, run at ledge k, jump at the edge. True if you end up on k. */
/** Steps the world with you parked (flying, so nothing touches you) until cond() holds; false if it never does. */
function waitFor(cond, secs = 20) { const was = me.fly; me.fly = true; for (let i = 0; i < secs * 120; i++) { if (cond()) { me.fly = was; return true; } stepWorld(STEP); } me.fly = was; return false; }
/** Where ledge L is right now: a platform moves. */
const liveC = (L) => (L.box ? [L.box.c.x, L.box.c.y, L.box.c.z] : L.c);
/** The gap between two ledges where they are right now. */
function gapNow(a, b) { const A2 = liveC(a), B2 = liveC(b); return Math.hypot(Math.max(0, Math.abs(B2[0] - A2[0]) - a.h[0] - b.h[0]), Math.max(0, Math.abs(B2[2] - A2[2]) - a.h[2] - b.h[2])); }
/** Is the vent on ledge L clear (not on, not about to be) for the next `secs` seconds? */
const ventClear = (L, secs) => { if (!L.vent) return true; for (let s = 0; s <= secs; s += 0.05) if (ventState(L.vent, t + s) !== "off") return false; return true; };
function tryJump(k) {
  const a = PATH[k - 1], b = PATH[k];
  for (const c of crumbles) { c.crumble.state = "idle"; c.c.y = c.crumble.y0; c.solid = true; }   // every try starts on whole slabs
  if (a.kind === "chimney") return tryKick(a, b);
  // a person waits: for a platform to come close (and be coming closer), and for a vent to go out
  if (a.mv || b.mv) {
    const okNow = () => { const g0 = gapNow(a, b); stepWorld(STEP); const g1 = gapNow(a, b); return g1 < (a.mv ? 2.6 : 1.6) && g1 < g0 - 1e-5; };   // close and still closing: the run-up takes the rest (riding one, go earlier: you keep its momentum, so leave while it still carries you forward)
    me.fly = true; let found = false; for (let i = 0; i < 20 * 120 && !found; i++) found = okNow(); me.fly = false;
    if (!found) return false;
  }
  if (b.vent && !waitFor(() => ventClear(b, 1.3))) return false;
  const icicleClear = (L, secs) => { if (!L.icicle) return true; for (let s2 = 0; s2 <= secs; s2 += 0.05) if (icicleState(L.icicle, t + s2) !== "hang") return false; return true; };
  const calm = (L, secs) => { if (!L.windy) return true; const g = gustAt(L.c[0], topOf(L) + 1, L.c[2]); if (!g) return true; for (let s2 = 0; s2 <= secs; s2 += 0.05) if (gustState(g, t + s2) !== "calm") return false; return true; };
  if ((a.windy || b.windy) && !waitFor(() => calm(a, 1.4) && calm(b, 1.4))) return false;
  const maceClear = (L, pts, from, to) => { if (!L.mace) return true; for (let s2 = from; s2 <= to; s2 += 0.04) { const [bx, by, bz] = macePos(L, t + s2); for (const [x, z] of pts) if (Math.hypot(x - bx, z - bz) < 1.2 && by < topOf(L) + 2.1) return false; } return true; };
  if (a.mace || b.mace) { const [ax0, , az0] = liveC(a), [bx0, , bz0] = liveC(b); if (!waitFor(() => maceClear(b, [[bx0, bz0]], 0.35, 1.0) && maceClear(a, [[ax0, az0], [(ax0 + bx0) / 2, (az0 + bz0) / 2]], 0, 0.55))) return false; }   // clear where you land, as you land; clear of your run as you go
  if (a.spring) {
    // a spring's flight can pass up through a windy wall's air: launch when the whole column is calm
    const col = [0.5, 1.5, 2.5, 3.5, 4.5].map((h) => gustAt(a.c[0], topOf(a) + h, a.c[2])).filter(Boolean);
    if (col.length && !waitFor(() => col.every((g) => { for (let s2 = 0; s2 <= 1.8; s2 += 0.05) if (gustState(g, t + s2) !== "calm") return false; return true; }))) return false;
    return trySpring(a, b);
  }
  const strikeClear = (L, secs) => { if (!L.strike) return true; for (let s2 = 0; s2 <= secs; s2 += 0.05) if (strikeState(L.strike, t + s2) !== "calm") return false; return true; };
  if ((a.strike || b.strike) && !waitFor(() => strikeClear(b, 1.3) && strikeClear(a, 0.9))) return false;
  if ((a.icicle || b.icicle) && !waitFor(() => icicleClear(b, b.ice ? 2.2 : 1.4) && icicleClear(a, a.ice ? 1.3 : 1.0))) return false;   // both at once, as a person watches both
  // a sweeper: go when the arm will be clear of where you land (or of your run across it) for the next second or so
  const armClear = (L, pts, from, to) => { for (let s2 = from; s2 <= to; s2 += 0.04) for (const [x, z] of pts) if (sweepDist(L, t + s2, x, z) < 0.8) return false; return true; };
  if (b.sweep) { const [lx, , lz] = aimC(b); if (!waitFor(() => armClear(b, [[lx, lz]], 0.3, 0.9))) return false; }
  // leaving a sweeper: wait for the arm to pass the corner, then a short run and jump early, over where it swings
  if (a.sweep) { const [sx0, , sz0] = aimC(a), [tx0, , tz0] = liveC(b), pts = [0, 0.2, 0.4].map((f) => [sx0 + (tx0 - sx0) * f, sz0 + (tz0 - sz0) * f]).filter(([x, z]) => Math.abs(x - a.c[0]) < a.h[0] + 0.4 && Math.abs(z - a.c[2]) < a.h[2] + 0.4); if (!waitFor(() => armClear(a, pts, 0, 0.6))) return false; }
  if (a.vent && !waitFor(() => ventClear(a, 1.0))) return false;
  const [acx, , acz] = aimC(a), [bcx, , bcz] = aimC(b);
  let ax = acx, az = acz, dx = bcx - ax, dz = bcz - az;
  // on a beam you run along it, not at an angle across it
  if (a.kind === "beam") { if (a.h[0] > a.h[2]) dz = 0; else dx = 0; }
  const l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
  // start at the back of ledge a, on the line to b
  const back = a.sweep ? 0 : Math.min(a.h[0] * Math.abs(ux) + a.h[2] * Math.abs(uz), 1.6) - 0.3;
  me.p.set(ax - ux * back, topOf(a) + R + 0.02, az - uz * back); me.v.set(0, 0, 0); me.grounded = true; me.stun = me.dive = 0;
  camYaw = Math.atan2(-ux, -uz);
  keys.KeyW = true; let jumped = false, ok = false, dove = false;
  for (let i = 0; i < 480; i++) {
    const ahead = me.p.x + ux * 0.35, aheadZ = me.p.z + uz * 0.35;
    const [lax, , laz] = liveC(a), offA = Math.abs(ahead - lax) > a.h[0] || Math.abs(aheadZ - laz) > a.h[2] || (a.sweep && Math.hypot(me.p.x - acx, me.p.z - acz) > 0.6);
    if (!jumped && me.grounded && (offA || b.kind === "stair")) { keys.Space = true; jumped = true; }
    else keys.Space = false;
    // in the air, steer like a person: ease off over the target, pull back if overshooting
    keys.ShiftLeft = false;
    if (jumped && !me.grounded && b.dive && !dove && me.v.y <= 3.5) { keys.ShiftLeft = true; keys.KeyW = true; dove = true; }
    else if (jumped && !me.grounded && me.dive <= 0) airSteer(b, a);
    stepWorld(STEP);
    if (b.spring && jumped && me.under?.k === b.box?.k) { ok = true; break; }   // touching a spring is landing on it (it throws you at once)
    if (jumped && me.grounded && me.under && (me.under.k >= k || (b.virtual && me.under.kind === "landing"))) {
      ok = true;
      if (b.ice) {
        // ice: you must also be able to stop on it. Steer at its middle for 1.5 s; still on it?
        // on ice: want a speed toward the middle that falls to zero as you get there; too fast, let go (letting go is the brake)
        for (let j = 0; j < 180; j++) {
          const [cx2, , cz2] = liveC(b), tx = cx2 - me.p.x, tz = cz2 - me.p.z, dist = Math.hypot(tx, tz);
          camYaw = Math.atan2(-tx, -tz); const toward = dist > 1e-3 ? (me.v.x * tx + me.v.z * tz) / dist : 0, want = Math.min(4, Math.sqrt(2 * ICE_ACC * 0.7 * dist));
          keys.KeyW = false; keys.KeyS = false; keys.Space = false; stepWorld(STEP);   // land and let go: on ice, letting go is the brake
        }
        ok = me.grounded && me.under === b.box;
      }
      break;
    }
    if (me.p.y < topOf(a) - 4) break;
  }
  keys.KeyW = false; keys.KeyS = false; keys.Space = false; keys.ShiftLeft = false;
  return ok;
}
/** Off a spring: stand on it, get thrown up, and steer onto b on the way down. */
function trySpring(a, b) {
  me.p.set(a.c[0], topOf(a) + R + 0.3, a.c[2]); me.v.set(0, -1, 0); me.grounded = false; me.stun = me.dive = 0;
  let ok = false, launched = false;
  for (let i = 0; i < 600; i++) {
    if (me.v.y > 5) launched = true;
    if (launched && (me.p.y > topOf(b) + R + 0.2 || me.v.y < 0)) airSteer(b); else { keys.KeyW = false; keys.KeyS = false; }
    keys.Space = false; stepWorld(STEP);
    if (launched && me.grounded && me.under?.k === b.box?.k) { ok = true; break; }
    if (launched && me.p.y < topOf(a) - 3) break;
  }
  keys.KeyW = false; keys.KeyS = false;
  return ok;
}
/** In the air, steer at ledge b like a person: face it, and press forward or back so the speed toward it is what lands on it. */
function airSteer(b, from) {
  let [bx, , bz] = aimC(b);
  if (b.ice && from) {
    // onto ice: land just inside the near end, not in the middle, so there is room to stop
    const [fx0, , fz0] = liveC(from), ux = bx - fx0, uz = bz - fz0, l = Math.hypot(ux, uz) || 1, half = Math.abs(ux / l) * b.h[0] + Math.abs(uz / l) * b.h[2];
    bx -= (ux / l) * Math.max(0, half - 1.0); bz -= (uz / l) * Math.max(0, half - 1.0);
  }
  const tx = bx - me.p.x, tz = bz - me.p.z, dist = Math.hypot(tx, tz);
  camYaw = Math.atan2(-tx, -tz);
  const dy = topOf(b) + R - me.p.y, disc = me.v.y * me.v.y - 2 * G * -dy;   // time until we come down to its top
  const tl = disc > 0 ? (me.v.y + Math.sqrt(disc)) / -G : 0.05;
  const along = dist > 1e-3 ? (me.v.x * tx + me.v.z * tz) / dist : 0;
  let want = dist / Math.max(0.05, tl);
  if (b.ice) want = Math.min(want, Math.sqrt(2 * ICE_ACC * Math.max(0.5, Math.max(b.h[0], b.h[2]) * 2 - 2.2)) + dist / Math.max(0.05, tl) * 0);   // arrive no faster than you can stop
  keys.KeyW = along < want - 0.3; keys.KeyS = along > want + 0.6 && dist < 4;
}
/** Climbs chimney a to its exit b by wall-kicks, the way a person would: jump at the far wall, kick at every touch, and once
    above the exit, go forward onto it. */
function tryKick(a, b) {
  const [ix, iz] = SIDES[a.side].into, [fx, fz] = TRAVEL[a.side], mid = (KICK_GAP + 0.3 + 0.3) / 2 - (KICK_GAP + 0.3) / 2;
  me.p.set(a.c[0] + ix * mid, topOf(a) + R + 0.02, a.c[2] + iz * mid); me.v.set(0, 0, 0); me.grounded = true; me.stun = me.dive = 0;
  let dirX = ix, dirZ = iz, ok = false, started = false;
  for (let i = 0; i < 1200; i++) {
    const above = me.p.y > topOf(b) + R + 0.4;
    if (above && !me.grounded) airSteer(b);
    else { if (me.wallT > 0) { dirX = me.wallN.x; dirZ = me.wallN.z; } camYaw = Math.atan2(-dirX, -dirZ); keys.KeyW = true; keys.KeyS = false; }
    keys.Space = (!started && me.grounded) || (!above && me.wallT > 0 && !me.grounded);
    if (!started && me.grounded) started = true;
    stepWorld(STEP);
    if (started && me.grounded && me.under?.k === b.box?.k) { ok = true; break; }
    if (me.p.y < topOf(a) - 3) break;
  }
  keys.KeyW = false; keys.KeyS = false; keys.Space = false;
  return ok;
}
/** Every jump in the tower. A fixed jump must pass first time; one with a timed hazard (a clock hand, a platform, a vent) may take up
    to three tries a moment apart, as a person waits and goes again. `retried` lists those that needed more than one. */
function climbAll() {
  const failed = [], retried = [];
  for (let k = 1; k < PATH.length; k++) {
    const a = PATH[k - 1], b = PATH[k], timed = a.sweep || b.sweep || a.mv || b.mv || a.vent || b.vent || a.icicle || b.icicle || a.windy || b.windy || a.spring || a.mace || b.mace || a.strike || b.strike;
    let ok = tryJump(k);
    for (let n = 1; !ok && timed && n < 3; n++) { waitFor(() => false, 0.9); ok = tryJump(k); if (ok) retried.push(k); }
    if (!ok) failed.push(k);
  }
  return { jumps: PATH.length - 1, failed, retried };
}
window.__climb = { scene, get t() { return t; }, strikeState, strikeList, ringBell, get bellRung() { return bellRung; }, macePos, maceList, GUSTS, gustState, gustAt, ventState, icicleState, icicleList, movers, vents, crumbles, spinners, sweepers, sweepDist, get camera() { return camera; }, setFly, goFloor, PATH, validate, reach, diveReach, zoneAt, tryJump, climbAll, me, bots, boxes, floorAt,
  setYaw(y) { camYaw = y; }, setPitch(p) { camPitch = p; }, teleport(x, y, z) { me.p.set(x, y, z); me.v.set(0, 0, 0); }, key(c, on) { keys[c] = on; },
  sim(seconds) { for (let k = 0; k < seconds * 120; k++) stepWorld(STEP); draw(1 / 60); hud(1 / 60); } };

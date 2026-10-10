/* EastKart — the rules (2026-10-12, the owner: "build eastkart first", from the what-to-build-next mockup: "Eight beans in karts, three
   laps, items … tracks are the maps you know … time trials with ghosts solo").

   IMPORT-FREE, like blockshot-rules.js: the page runs it for practice and a room server can run the same file later. Everything a race
   is, lives here: the kart (an arcade kart — speed, heading, a drift that charges a boost), the track (a closed spline sampled into
   points with a tangent and a normal; laps are counted by passing SECTORS in order, so a cut never counts), the items (a box every few
   hundred metres; what you get depends on where you are in the race), the shells and bananas, and the bots (they chase a point ahead on
   the centreline in a lane of their own, drift the corners, use what they pick up, and rubber-band a little toward the person).
   Nothing here draws or plays a sound. `stepRace(race, inputs, dt, rand)` moves the whole race one step and pushes events. */

export const VERSION = 1;
export const KART = {
  ACC: 15, MAX: 23, REV_MAX: 7, COAST: 0.9, TURN: 2.4, GRIP_AT: 7, DRIFT_TURN: 1.45, DRIFT_SLIP: 2.8, SLIP: 9,
  DRIFT_MIN_S: 0.8, DRIFT_MAX_S: 2.2, BOOST_MUL: 1.3, SPIN_S: 1.1, GRASS_MUL: 0.55, WALL: 8, R: 1.15, STEP: 1 / 60, LAPS: 3, PLAYERS: 8
};
export const ITEMS = { boost: { n: "Boost", icon: "🍄" }, shell: { n: "Shell", icon: "🐢" }, banana: { n: "Banana", icon: "🍌" } };
export const ITEM_RESPAWN_S = 5, SHELL_SPEED = 42, SHELL_LIFE_S = 7, PICKUP_R = 1.7, HIT_R = 1.5;
export const BOT_NAMES = ["Bot Dude #1", "Bot Bro #2", "Robo Ray", "Beep Boop", "NPC Nate", "Bot Betty", "Tin Man", "Autobean", "Clanker", "Mr Roboto"];
export const KART_COLORS = [0xffd84a, 0x3ad5ff, 0xff5a8a, 0x5df28a, 0xff9f1c, 0xb06cff, 0xf2f4f8, 0xff3b4a];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/* ---------------------------------------------------------------- tracks */
/* A track is a closed loop of control points (metres, x east, z south), a width, where the item boxes sit (as fractions of the lap)
   and a theme the page draws. The spline is Catmull-Rom, sampled into N points about a metre apart. */
export const TRACKS = {
  lot: { name: "The Lot Loop", blurb: "The first track: a wide figure-of-eight style loop round the lot with two hairpins and a long back straight.", width: 15, sky: 0x87ceeb, ground: 0x3e8e41,
    pts: [[0, 60], [50, 62], [85, 40], [90, 0], [70, -35], [30, -55], [-20, -58], [-60, -45], [-85, -10], [-80, 30], [-55, 58], [-30, 66]],
    items: [0.18, 0.43, 0.7, 0.9], laps: 3 },
  docks: { name: "Docks Circuit", blurb: "Tight and twisty between the containers: a chicane, a long sweeper over the quay and a hairpin at the cranes.", width: 13, sky: 0xf4c89a, ground: 0x6b6f78,
    pts: [[0, 50], [40, 52], [60, 30], [45, 8], [70, -10], [80, -40], [50, -62], [10, -50], [-10, -25], [-40, -40], [-75, -30], [-85, 5], [-60, 35], [-30, 25], [-15, 48]],
    items: [0.15, 0.4, 0.62, 0.85], laps: 3 },
  roofs: { name: "Rooftop Run", blurb: "Up on the Rooftops: long straights across the bridges, a corkscrew round the tower and a blind drop at the end.", width: 12, sky: 0xb0a0d8, ground: 0x4a4458,
    pts: [[0, 70], [60, 70], [95, 40], [95, -20], [60, -60], [10, -70], [-30, -40], [-10, -10], [-50, 10], [-95, -15], [-100, 30], [-60, 65]],
    items: [0.2, 0.45, 0.65, 0.88], laps: 3 }
};
export const TRACK_LIST = ["lot", "docks", "roofs"];

function catmull(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
/** Sample the loop: `pts[i] = {x, z, tx, tz, nx, nz}` (unit tangent, left normal), about a metre apart, `N` of them, `len` metres. */
export function buildTrack(key) {
  const def = TRACKS[key]; const P = def.pts, M = P.length; const raw = [];
  for (let s = 0; s < M; s++) { const p0 = P[(s - 1 + M) % M], p1 = P[s], p2 = P[(s + 1) % M], p3 = P[(s + 2) % M]; for (let k = 0; k < 24; k++) { const t = k / 24; raw.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]); } }
  // resample at even spacing
  let len = 0; const cum = [0]; for (let i = 0; i < raw.length; i++) { const a = raw[i], b = raw[(i + 1) % raw.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(len); }
  const N = Math.round(len), pts = []; let j = 0;
  for (let i = 0; i < N; i++) { const d = (i / N) * len; while (cum[j + 1] < d) j++; const a = raw[j % raw.length], b = raw[(j + 1) % raw.length], t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1); pts.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t }); }
  for (let i = 0; i < N; i++) { const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const p = pts[i]; p.tx = tx; p.tz = tz; p.nx = -tz; p.nz = tx; }
  const SECTORS = 12, sector = N / SECTORS;
  const items = def.items.map((f) => [-1, 0, 1].map((lane) => ({ i: Math.round(f * N) % N, off: lane * (def.width / 2 - 2.5), t: 0 }))).flat();
  return { key, name: def.name, blurb: def.blurb, width: def.width, sky: def.sky, ground: def.ground, laps: def.laps, pts, N, len, SECTORS, sector, items };
}
/** Nearest sample to p, searching near `hint` first (a kart never jumps far in a step). */
export function nearest(track, p, hint = 0) {
  const N = track.N, pts = track.pts; let best = -1, bd = Infinity;
  const look = (i) => { i = ((i % N) + N) % N; const q = pts[i], d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d < bd) { bd = d; best = i; } };
  for (let k = -40; k <= 40; k++) look(hint + k);
  if (bd > 30 * 30) { bd = Infinity; for (let i = 0; i < N; i += 3) look(i); for (let k = -3; k <= 3; k++) look(best + k); }
  return best;
}
export const lateral = (track, p, i) => { const q = track.pts[i]; return (p.x - q.x) * q.nx + (p.z - q.z) * q.nz; };
export const along = (track, p, i) => { const q = track.pts[i]; return (p.x - q.x) * q.tx + (p.z - q.z) * q.tz; };
export const progressOf = (track, k) => k.lap * track.N + k.i + (k.alongF || 0);

/* ---------------------------------------------------------------- karts */
export function newKart(i, name, bot, color) {
  return { i, name, bot, color, p: { x: 0, z: 0 }, yaw: 0, head: 0, speed: 0, steer: 0, drift: 0, driftT: 0, boost: 0, spin: 0, item: null, itemT: 0, i0: 0, lap: 0, sector: 0, cpNext: 1, alongF: 0,
    lane: 0, laneT: 0, skill: 1, lapStart: 0, lapTimes: [], bestLap: 0, total: 0, finished: 0, place: 0, grass: false, lastHit: -9, onItem: -1 };
}
/** Put the field on the grid: two abreast, the leader of the grid at the back of the start line, 4 m between rows. */
export function placeOnGrid(track, karts) {
  karts.forEach((k, n) => { const row = Math.floor(n / 2), side = n % 2 ? 1 : -1, i = ((track.N - 6 - row * 5) % track.N + track.N) % track.N, q = track.pts[i];
    k.p.x = q.x + q.nx * side * 2.4; k.p.z = q.z + q.nz * side * 2.4; k.yaw = Math.atan2(q.tx, q.tz); k.head = k.yaw; k.speed = 0; k.i = i; k.i0 = i; k.lap = 0; k.sector = Math.floor(i / track.sector); k.cpNext = 0; k.item = null; k.boost = 0; k.spin = 0; k.drift = 0; k.driftT = 0; k.finished = 0; k.lapTimes = []; k.bestLap = 0; k.total = 0; k.lane = side * 2; });
}

/** One kart, one step. `inp` = {accel, brake, steer (-1..1), drift, use}. Returns nothing; pushes to `events`. */
export function stepKart(track, k, inp, dt, now, events) {
  const grassMul = k.grass ? KART.GRASS_MUL : 1;
  const max = KART.MAX * grassMul * (k.boost > 0 ? KART.BOOST_MUL : 1) * k.skill;
  if (k.spin > 0) { k.spin -= dt; k.yaw += 8 * dt; k.speed *= Math.max(0, 1 - 2.2 * dt); }
  else {
    const steer = clamp(inp.steer || 0, -1, 1); k.steer = steer;
    if (inp.accel && k.speed < max) k.speed = Math.min(max, k.speed + KART.ACC * grassMul * dt);
    else if (inp.brake) { if (k.speed > 0.3) k.speed -= 24 * dt; else k.speed = Math.max(-KART.REV_MAX, k.speed - 6 * dt); }
    else k.speed -= k.speed * KART.COAST * dt;
    if (k.speed > max) k.speed += (max - k.speed) * 4 * dt;
    if (k.speed < -KART.REV_MAX) k.speed = -KART.REV_MAX;
    // the drift: hold it with the wheel turned at speed; it locks a direction, turns harder, slides, and charges a boost for the release
    const wantDrift = Boolean(inp.drift) && Math.abs(steer) > 0.15 && k.speed > 9;
    if (!k.drift && wantDrift) { k.drift = Math.sign(steer); k.driftT = 0; events?.push({ type: "drift", k, on: true }); }
    if (k.drift && (!inp.drift || k.speed < 6)) { if (k.driftT >= KART.DRIFT_MIN_S) { k.boost = Math.max(k.boost, 0.6 + Math.min(k.driftT, KART.DRIFT_MAX_S) * 0.45); events?.push({ type: "boost", k, from: "drift", t: k.boost }); } k.drift = 0; k.driftT = 0; events?.push({ type: "drift", k, on: false }); }
    if (k.drift) k.driftT += dt;
    const grip = clamp(Math.abs(k.speed) / KART.GRIP_AT, 0, 1), dir = k.speed < 0 ? -1 : 1;
    let turn = steer * KART.TURN * grip * dir;
    if (k.drift) turn = (k.drift * 0.55 + steer * 0.75) * KART.TURN * KART.DRIFT_TURN * grip;   // a drift always turns its way; the wheel tightens or opens it
    k.yaw += turn * dt;
    k.speed -= Math.abs(turn) * Math.max(0, k.speed) * (k.drift ? 0.04 : 0.16) * dt;   // a corner costs speed; a drift costs a quarter of it, which is why you drift
  }
  if (k.boost > 0) k.boost -= dt;
  // the heading follows the nose: slowly in a drift (the slide), quickly otherwise
  k.head += wrapAngle(k.yaw - k.head) * Math.min(1, (k.drift ? KART.DRIFT_SLIP : KART.SLIP) * dt);
  k.p.x += Math.sin(k.head) * k.speed * dt; k.p.z += Math.cos(k.head) * k.speed * dt;
  // where on the track, how far off the line, grass and walls
  k.i = nearest(track, k.p, k.i); const off = lateral(track, k.p, k.i), half = track.width / 2;
  k.grass = Math.abs(off) > half;
  if (Math.abs(off) > half + KART.WALL) { const q = track.pts[k.i], s = Math.sign(off), lim = half + KART.WALL; k.p.x = q.x + q.nx * s * lim; k.p.z = q.z + q.nz * s * lim; k.speed *= 0.5; if (now - k.lastHit > 0.5) { k.lastHit = now; events?.push({ type: "wall", k }); } }
  k.alongF = clamp(along(track, k.p, k.i), -0.5, 0.5);
  // sectors in order; a lap when the first sector follows the last
  const sec = Math.floor(k.i / track.sector);
  if (sec === k.cpNext && !k.finished) { k.cpNext = (sec + 1) % track.SECTORS; if (sec === 0 && k.lap === 0 && k.lapStart === 0) k.lapStart = now; else if (sec === 0) { const lt = now - k.lapStart; k.lapTimes.push(lt); if (!k.bestLap || lt < k.bestLap) k.bestLap = lt; k.lap++; k.lapStart = now; events?.push({ type: "lap", k, lap: k.lap, time: lt }); if (k.lap >= track.laps) { k.finished = now; k.total = now - k.raceStart; events?.push({ type: "finish", k }); } } }
  k.sector = sec;
}

/* ---------------------------------------------------------------- items */
/** What a box gives, by place: the leader gets what slows them little; the back gets what catches up. */
export function rollItem(place, n, rand) {
  const f = n > 1 ? (place - 1) / (n - 1) : 0;   // 0 leader .. 1 last
  const r = rand();
  if (f < 0.25) return r < 0.6 ? "banana" : r < 0.85 ? "shell" : "boost";
  if (f < 0.65) return r < 0.4 ? "shell" : r < 0.75 ? "boost" : "banana";
  return r < 0.65 ? "boost" : "shell";
}
export function takeItems(race, k, now, rand, events) {
  if (k.item || k.finished) return;
  for (const it of race.track.items) { if (it.t > 0) continue; const q = race.track.pts[it.i], x = q.x + q.nx * it.off, z = q.z + q.nz * it.off; if ((k.p.x - x) ** 2 + (k.p.z - z) ** 2 < PICKUP_R * PICKUP_R) { it.t = ITEM_RESPAWN_S; k.item = rollItem(k.place || 1, race.karts.length, rand); events?.push({ type: "item", k, item: k.item }); return; } }
}
/** Use what you hold: a boost now, a shell down the track ahead, a banana dropped behind. */
export function useItem(race, k, now, events) {
  if (!k.item || k.spin > 0 || k.finished) return false;
  const item = k.item; k.item = null;
  if (item === "boost") { k.boost = Math.max(k.boost, 1.5); events?.push({ type: "boost", k, from: "item", t: 1.5 }); }
  else if (item === "shell") { race.shells.push({ i: k.i + 3, off: lateral(race.track, k.p, k.i) * 0.5, by: k.i, owner: k, t: SHELL_LIFE_S, x: k.p.x, z: k.p.z }); events?.push({ type: "shell", k }); }
  else if (item === "banana") { race.bananas.push({ x: k.p.x - Math.sin(k.head) * 2.6, z: k.p.z - Math.cos(k.head) * 2.6, by: k.i }); events?.push({ type: "banana", k }); }
  events?.push({ type: "use", k, item });
  return true;
}
function spinOut(k, now, events, why) { if (k.spin > 0 || k.finished) return; k.spin = KART.SPIN_S; k.drift = 0; k.driftT = 0; k.boost = 0; k.item = k.item && why === "banana" ? k.item : k.item; events?.push({ type: "spin", k, why }); }

/* ---------------------------------------------------------------- bots */
/** A bot chases a point a little way down the centreline, in a lane of its own, and uses what it holds when it makes sense. */
export function botInput(race, k, dt, rand) {
  const t = race.track, N = t.N;
  k.laneT -= dt; if (k.laneT <= 0) { k.laneT = 3 + rand() * 4; k.lane = (rand() - 0.5) * (t.width - 5); }
  const look = Math.round(6 + Math.abs(k.speed) * 0.55), ti = (k.i + look) % N, q = t.pts[ti];
  // dodge a banana in the lane ahead
  let lane = k.lane; for (const b of race.bananas) { const bi = nearest(t, b, k.i); const ahead = ((bi - k.i) % N + N) % N; if (ahead < 25) { const boff = lateral(t, b, bi); if (Math.abs(boff - lane) < 2.2) lane = boff + (boff > 0 ? -3 : 3); } }
  const tx = q.x + q.nx * lane, tz = q.z + q.nz * lane;
  const want = Math.atan2(tx - k.p.x, tz - k.p.z), diff = wrapAngle(want - k.yaw);
  const steer = clamp(diff * 2.2, -1, 1), sharp = Math.abs(diff);
  const inp = { accel: true, brake: sharp > 1.25 && k.speed > 14, steer, drift: sharp > 0.32 && k.speed > 11 && !k.grass, use: false };
  if (k.item) { const me = progressOf(t, k); let aheadClose = false, behindClose = false; for (const o of race.karts) { if (o === k) continue; const d = progressOf(t, o) - me; if (d > 0 && d < 30) aheadClose = true; if (d < 0 && d > -14) behindClose = true; }
    if (k.item === "boost") inp.use = sharp < 0.25; else if (k.item === "shell") inp.use = aheadClose || rand() < 0.002; else inp.use = behindClose || rand() < 0.003; }
  return inp;
}

/* ---------------------------------------------------------------- the race */
export function newRace(trackKey, humanName, bots = KART.PLAYERS - 1, rand = Math.random) {
  const track = buildTrack(trackKey), karts = [newKart(0, humanName, false, KART_COLORS[0])];
  const names = BOT_NAMES.slice(); for (let b = 1; b <= bots; b++) { const k = newKart(b, names.splice(Math.floor(rand() * names.length), 1)[0], true, KART_COLORS[b % KART_COLORS.length]); k.skill = 0.93 + rand() * 0.06; karts.push(k); }
  placeOnGrid(track, karts);
  const race = { track, karts, shells: [], bananas: [], t: 0, state: "count", countT: 3.2, started: 0 };
  for (const k of karts) k.raceStart = 0;
  return race;
}
/** The whole race, one step. `inputFor(k)` gives the person's input (bots make their own). */
export function stepRace(race, inputFor, dt, rand, events) {
  race.t += dt; const now = race.t, t = race.track;
  if (race.state === "count") { race.countT -= dt; if (race.countT <= 0) { race.state = "race"; race.started = now; for (const k of race.karts) { k.raceStart = now; k.lapStart = 0; } events?.push({ type: "go" }); } for (const k of race.karts) { k.speed = 0; } return; }
  if (race.state === "done") return;
  // ranking first, so items know the places
  const order = race.karts.slice().sort((a, b) => (b.finished ? 1e9 - b.total : progressOf(t, b)) - (a.finished ? 1e9 - a.total : progressOf(t, a)));
  order.forEach((k, n) => { k.place = n + 1; });
  const human = race.karts.find((k) => !k.bot);
  for (const k of race.karts) {
    let inp;
    if (k.finished) inp = { accel: true, brake: false, steer: clamp(wrapAngle(Math.atan2(t.pts[(k.i + 8) % t.N].x - k.p.x, t.pts[(k.i + 8) % t.N].z - k.p.z) - k.yaw) * 2, -1, 1), drift: false, use: false };
    else if (k.bot) { inp = botInput(race, k, dt, rand); if (human) { const gap = (progressOf(t, human) - progressOf(t, k)) / t.N; k.skill = clamp(0.95 + gap * 0.5, 0.88, 1.06); } }
    else inp = inputFor(k);
    if (inp.use) useItem(race, k, now, events);
    stepKart(t, k, inp, dt, now, events);
    takeItems(race, k, now, rand, events);
  }
  // karts push each other apart
  for (let a = 0; a < race.karts.length; a++) for (let b = a + 1; b < race.karts.length; b++) { const A = race.karts[a], B = race.karts[b]; const dx = B.p.x - A.p.x, dz = B.p.z - A.p.z, d = Math.hypot(dx, dz), min = KART.R * 2; if (d < min && d > 0.001) { const push = (min - d) / 2, ux = dx / d, uz = dz / d; A.p.x -= ux * push; A.p.z -= uz * push; B.p.x += ux * push; B.p.z += uz * push; const va = A.speed, vb = B.speed; A.speed = va * 0.85 + vb * 0.1; B.speed = vb * 0.85 + va * 0.1; if (now - A.lastHit > 0.4 && now - B.lastHit > 0.4) { A.lastHit = B.lastHit = now; events?.push({ type: "bump", a: A, b: B }); } } }
  // shells run down the track; bananas wait
  for (let s = race.shells.length - 1; s >= 0; s--) { const sh = race.shells[s]; sh.t -= dt; sh.i += (SHELL_SPEED * dt) * (t.N / t.len); sh.off += (0 - sh.off) * 0.5 * dt; const q = t.pts[Math.floor(sh.i) % t.N]; sh.x = q.x + q.nx * sh.off; sh.z = q.z + q.nz * sh.off; let gone = sh.t <= 0;
    if (!gone) for (const k of race.karts) { if (k === sh.owner && sh.t > SHELL_LIFE_S - 0.5) continue; if ((k.p.x - sh.x) ** 2 + (k.p.z - sh.z) ** 2 < HIT_R * HIT_R) { spinOut(k, now, events, "shell"); gone = true; break; } }
    if (gone) race.shells.splice(s, 1); }
  for (let b = race.bananas.length - 1; b >= 0; b--) { const ba = race.bananas[b]; for (const k of race.karts) { if (k.spin > 0) continue; if ((k.p.x - ba.x) ** 2 + (k.p.z - ba.z) ** 2 < 1.6 * 1.6) { spinOut(k, now, events, "banana"); race.bananas.splice(b, 1); break; } } }
  for (const it of t.items) if (it.t > 0) it.t -= dt;
  // the race ends when the person has finished and a moment has passed, when everyone has, or thirty seconds after the winner (nobody waits on a kart parked in the grass)
  const first = race.karts.reduce((m, k) => (k.finished && (!m || k.finished < m) ? k.finished : m), 0);
  if ((human?.finished && now - human.finished > 4) || (first && now - first > 30)) { race.state = "done"; for (const k of race.karts) if (!k.finished) { k.finished = now; k.total = now - k.raceStart + (race.karts.length - k.place) * 0.01; } events?.push({ type: "done" }); }
  else if (race.karts.every((k) => k.finished)) { race.state = "done"; events?.push({ type: "done" }); }
}
export const fmtTime = (s) => { if (!s && s !== 0) return "—"; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, "0")}`; };
export const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };

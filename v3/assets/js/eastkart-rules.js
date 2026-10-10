/* EastKart — the rules (2026-10-12, the owner: "build eastkart first", from the what-to-build-next mockup: "Eight beans in karts, three
   laps, items … tracks are the maps you know … time trials with ghosts solo").

   IMPORT-FREE, like blockshot-rules.js: the page runs it for practice and a room server can run the same file later. Everything a race
   is, lives here: the kart (an arcade kart — speed, heading, a drift that charges a boost), the track (a closed spline sampled into
   points with a tangent and a normal; laps are counted by passing SECTORS in order, so a cut never counts), the items (a box every few
   hundred metres; what you get depends on where you are in the race), the shots and the puddles, and the bots (they chase a point ahead on
   the centreline in a lane of their own, drift the corners, use what they pick up, and rubber-band a little toward the person).
   Nothing here draws or plays a sound. `stepRace(race, inputs, dt, rand)` moves the whole race one step and pushes events. */

export const VERSION = 4;
export const KART = {
  /* POLISH PASS (2026-10-13, the owner: "cars need to be slightly faster, feel weightier, bounce off each other a bit"): MAX 23 → 26.5,
     the wheel eases in (STEER_RATE), the heading lags the nose more (SLIP 9 → 6), and a corner at full speed turns less (HIGH_SPEED_TURN). */
  ACC: 17, MAX: 26.5, REV_MAX: 7, COAST: 0.9, TURN: 2.3, GRIP_AT: 7, DRIFT_TURN: 1.45, DRIFT_SLIP: 2.4, SLIP: 6, STEER_RATE: 7, HIGH_SPEED_TURN: 0.65,
  DRIFT_MIN_S: 0.8, DRIFT_MAX_S: 2.2, BOOST_MUL: 1.3, SPIN_S: 1.1, GRASS_MUL: 0.55, WALL: 8, R: 1.15, STEP: 1 / 60, LAPS: 3, PLAYERS: 8,
  /* the genre's feel pieces: drift tiers (Mario Kart's mini-turbos — hold longer, bigger boost, different sparks), a rocket start on the
     countdown, a slipstream behind a rival, and a bump that actually shoves */
  DRIFT_TIERS: [0.8, 1.7, 2.6], DRIFT_BOOST: [0.7, 1.2, 1.8], ROCKET_WINDOW: 0.55, ROCKET_BOOST: 1.3, BURNOUT_S: 1.1, DRAFT_S: 1.0, DRAFT_BOOST: 0.9, DRAFT_RANGE: 10, DRAFT_LANE: 2.4, BUMP_PUSH: 0.6, BUMP_MAX: 7
};
/* THE POWER-UPS (2026-10-12, the owner: "give it some unique power ups, and make them sports related … it needs some character"). Six,
   each a play from a sport, dealt by where you are in the race: the leader gets what slows them little, the back gets what catches up. */
export const ITEMS = {
  drill: { n: "Two-Minute Drill", icon: "⏱️", line: "Hurry-up offense: a burst of speed for a second and a half." },
  hail: { n: "Hail Mary", icon: "🏈", line: "A football thrown down the field. It finds the kart ahead of you and spins it." },
  slap: { n: "Slapshot", icon: "🏒", line: "A puck fired straight down your lane, fast. It hits whatever is in it." },
  bath: { n: "Gatorade Bath", icon: "🪣", line: "A cooler dumped behind you. Whoever drives through the puddle spins." },
  flag: { n: "Penalty Flag", icon: "🚩", line: "Flag on the play: it chases the leader and spins them. Never dealt to the leader." },
  oline: { n: "O-Line", icon: "🧱", line: "A wall of linemen round your kart for seven seconds. It blocks the next hit." },
  /* PLAYS PASS (2026-10-13): seven more, by where you are in the pack */
  pick6: { n: "Pick Six", icon: "🔄", line: "Interception: you take the spot of the kart ahead of you, and they take yours." },
  buzzer: { n: "Buzzer Beater", icon: "🏀", line: "A lob at the kart ahead. It lands where they are going to be; anyone close spins." },
  nutmeg: { n: "Nutmeg", icon: "⚽", line: "A ball that bounces wall to wall down the road for six seconds. No lane is safe." },
  homer: { n: "Home Run", icon: "⚾", line: "A line drive down your lane. It does not spin what it hits — it knocks it into the wall." },
  press: { n: "Full-Court Press", icon: "🖐️", line: "Everyone ahead of you is pressed to half speed for three seconds." },
  stand: { n: "Goal-Line Stand", icon: "🧍", line: "Three linemen set across the road behind you for nine seconds. Drive into them and you spin." },
  ice: { n: "Ice the Kicker", icon: "🧊", line: "The kart behind you is frozen on the spot for a second and a half." },
  /* LEGENDARY — a gold ring, one box in forty, the whole room hears about it */
  rain: { n: "Rain Delay", icon: "🌧️", line: "Eight seconds of rain for everyone but you: less grip, slower, drifts that slide.", legend: true },
  truck: { n: "Monster Truck", icon: "🚛", line: "Seven seconds as a monster truck: nothing spins you, bumps send karts flying, puddles are nothing, and you are faster.", legend: true },
  blackout: { n: "Blackout", icon: "🌑", line: "The stadium lights go out for five seconds for everyone but you.", legend: true },
  trade: { n: "Trade Deadline", icon: "📝", line: "You are traded into the leader's seat. They get yours.", legend: true }
};
export const PLAY = { press: 3, pressMul: 0.5, stand: 9, ice: 1.6, rain: 8, rainMul: 0.82, truck: 7, truckMul: 1.1, dark: 5, legend: 0.025, buzzerR: 2.4, knock: 16 };
export const ITEM_RESPAWN_S = 5, SHOT = { hail: { speed: 44, life: 7 }, slap: { speed: 62, life: 4 }, flag: { speed: 50, life: 8 }, buzzer: { speed: 0, life: 1.4 }, nutmeg: { speed: 38, life: 6 }, homer: { speed: 70, life: 4 } }, SHIELD_S = 7, PICKUP_R = 1.7, HIT_R = 1.5;
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
    items: [0.18, 0.43, 0.7, 0.9], pads: [0.3, 0.8], laps: 3 },
  docks: { name: "Docks Circuit", blurb: "Tight and twisty between the containers: a chicane, a long sweeper over the quay and a hairpin at the cranes.", width: 13, sky: 0xf4c89a, ground: 0x6b6f78,
    pts: [[0, 50], [40, 52], [60, 30], [45, 8], [70, -10], [80, -40], [50, -62], [10, -50], [-10, -25], [-40, -40], [-75, -30], [-85, 5], [-60, 35], [-30, 25], [-15, 48]],
    items: [0.15, 0.4, 0.62, 0.85], pads: [0.27, 0.74], laps: 3 },
  roofs: { name: "Rooftop Run", blurb: "Up on the Rooftops: long straights across the bridges, a corkscrew round the tower and a blind drop at the end.", width: 12, sky: 0xb0a0d8, ground: 0x4a4458,
    pts: [[0, 70], [60, 70], [95, 40], [95, -20], [60, -60], [10, -70], [-30, -40], [-10, -10], [-50, 10], [-95, -15], [-100, 30], [-60, 65]],
    items: [0.2, 0.45, 0.65, 0.88], pads: [0.33, 0.77], laps: 3 }
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
  const pads = (def.pads || []).map((f) => ({ i: Math.round(f * N) % N, off: 0 }));   // (2026-10-12) boost pads: a strip across the middle of the road, a second of boost to whoever drives over it
  return { key, name: def.name, blurb: def.blurb, width: def.width, sky: def.sky, ground: def.ground, laps: def.laps, pts, N, len, SECTORS, sector, items, pads };
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
    lane: 0, laneT: 0, skill: 1, shield: 0, push: { x: 0, z: 0 }, draftT: 0, heldT: 0, burnout: 0, driftTier: 0, splits: [], prevPlace: 0, slow: 0, frozen: 0, truck: 0, wet: false, lapStart: 0, lapTimes: [], bestLap: 0, total: 0, finished: 0, place: 0, grass: false, lastHit: -9, onItem: -1 };
}
/** Put the field on the grid: two abreast, the leader of the grid at the back of the start line, 4 m between rows. */
export function placeOnGrid(track, karts) {
  karts.forEach((k, n) => { const row = Math.floor(n / 2), side = n % 2 ? 1 : -1, i = ((track.N - 6 - row * 5) % track.N + track.N) % track.N, q = track.pts[i];
    k.p.x = q.x + q.nx * side * 2.4; k.p.z = q.z + q.nz * side * 2.4; k.yaw = Math.atan2(q.tx, q.tz); k.head = k.yaw; k.speed = 0; k.i = i; k.i0 = i; k.lap = 0; k.sector = Math.floor(i / track.sector); k.cpNext = 0; k.item = null; k.boost = 0; k.spin = 0; k.shield = 0; k.drift = 0; k.driftT = 0; k.finished = 0; k.lapTimes = []; k.bestLap = 0; k.total = 0; k.lane = side * 2; });
}

/** One kart, one step. `inp` = {accel, brake, steer (-1..1), drift, use}. Returns nothing; pushes to `events`. */
export function stepKart(track, k, inp, dt, now, events) {
  const grassMul = k.grass ? KART.GRASS_MUL : 1;
  const max = KART.MAX * grassMul * (k.boost > 0 ? KART.BOOST_MUL : 1) * k.skill * (k.slow > 0 ? PLAY.pressMul : 1) * (k.wet ? PLAY.rainMul : 1) * (k.truck > 0 ? PLAY.truckMul : 1);
  if (k.slow > 0) k.slow -= dt; if (k.truck > 0) k.truck -= dt; if (k.frozen > 0) { k.frozen -= dt; k.speed = Math.min(k.speed, 0.5); }
  if (k.spin > 0) { k.spin -= dt; k.yaw += 8 * dt; k.speed *= Math.max(0, 1 - 2.2 * dt); }
  else {
    const want = clamp(inp.steer || 0, -1, 1); k.steer += (want - k.steer) * Math.min(1, KART.STEER_RATE * dt); const steer = k.steer;
    if (inp.accel && k.speed < max) k.speed = Math.min(max, k.speed + KART.ACC * grassMul * dt);
    else if (inp.brake) { if (k.speed > 0.3) k.speed -= 24 * dt; else k.speed = Math.max(-KART.REV_MAX, k.speed - 6 * dt); }
    else k.speed -= k.speed * KART.COAST * dt;
    if (k.speed > max) k.speed += (max - k.speed) * 4 * dt;
    if (k.speed < -KART.REV_MAX) k.speed = -KART.REV_MAX;
    if (k.frozen > 0) k.speed = Math.min(k.speed, 0.5);   // iced: the throttle does nothing until it thaws
    // the drift: hold it with the wheel turned at speed; it locks a direction, turns harder, slides, and charges a boost for the release
    const wantDrift = Boolean(inp.drift) && Math.abs(steer) > 0.15 && k.speed > 9;
    if (!k.drift && wantDrift) { k.drift = Math.sign(steer); k.driftT = 0; events?.push({ type: "drift", k, on: true }); }
    if (k.drift && (!inp.drift || k.speed < 6)) { if (k.driftTier > 0) { const t = KART.DRIFT_BOOST[k.driftTier - 1]; k.boost = Math.max(k.boost, t); events?.push({ type: "boost", k, from: "drift", t, tier: k.driftTier }); } k.drift = 0; k.driftT = 0; k.driftTier = 0; events?.push({ type: "drift", k, on: false }); }
    if (k.drift) { k.driftT += dt; const tier = KART.DRIFT_TIERS.filter((x) => k.driftT >= x).length; if (tier !== k.driftTier) { k.driftTier = tier; events?.push({ type: "drifttier", k, tier }); } }
    const grip = clamp(Math.abs(k.speed) / KART.GRIP_AT, 0, 1), dir = k.speed < 0 ? -1 : 1;
    let turn = steer * KART.TURN * grip * dir * (1 - (1 - KART.HIGH_SPEED_TURN) * clamp(Math.abs(k.speed) / KART.MAX, 0, 1));   // heavier at speed: the same lock turns less
    if (k.drift) turn = (k.drift * 0.55 + steer * 0.75) * KART.TURN * KART.DRIFT_TURN * grip;
    if (k.wet) turn *= 0.8;   // a drift always turns its way; the wheel tightens or opens it
    k.yaw += turn * dt;
    k.speed -= Math.abs(turn) * Math.max(0, k.speed) * (k.drift ? 0.04 : 0.16) * dt;   // a corner costs speed; a drift costs a quarter of it, which is why you drift
  }
  if (k.boost > 0) k.boost -= dt;
  // the heading follows the nose: slowly in a drift (the slide), quickly otherwise
  k.head += wrapAngle(k.yaw - k.head) * Math.min(1, (k.drift ? KART.DRIFT_SLIP : KART.SLIP) * (k.wet ? 0.5 : 1) * dt);
  k.p.x += Math.sin(k.head) * k.speed * dt + k.push.x * dt; k.p.z += Math.cos(k.head) * k.speed * dt + k.push.z * dt; const pd = Math.max(0, 1 - 5 * dt); k.push.x *= pd; k.push.z *= pd;
  if (k.burnout > 0) { k.burnout -= dt; k.speed = Math.min(k.speed, 2); }
  // where on the track, how far off the line, grass and walls
  k.i = nearest(track, k.p, k.i); const off = lateral(track, k.p, k.i), half = track.width / 2;
  k.grass = Math.abs(off) > half;
  if (Math.abs(off) > half + KART.WALL) { const q = track.pts[k.i], s = Math.sign(off), lim = half + KART.WALL; k.p.x = q.x + q.nx * s * lim; k.p.z = q.z + q.nz * s * lim; k.speed *= 0.5; if (now - k.lastHit > 0.5) { k.lastHit = now; events?.push({ type: "wall", k }); } }
  k.alongF = clamp(along(track, k.p, k.i), -0.5, 0.5);
  // sectors in order; a lap when the first sector follows the last
  const sec = Math.floor(k.i / track.sector);
  if (sec === k.cpNext && !k.finished) { k.cpNext = (sec + 1) % track.SECTORS; if (sec === 0 && k.lap === 0 && k.lapStart === 0) k.lapStart = now; else if (sec === 0) { const lt = now - k.lapStart; k.lapTimes.push(lt); if (!k.bestLap || lt < k.bestLap) k.bestLap = lt; k.lap++; const splits = k.splits; k.splits = []; k.lapStart = now; events?.push({ type: "lap", k, lap: k.lap, time: lt, splits }); if (k.lap >= track.laps) { k.finished = now; k.total = now - k.raceStart; events?.push({ type: "finish", k }); } } else if (k.lapStart > 0) { const st = now - k.lapStart; k.splits.push(st); events?.push({ type: "sector", k, sec, t: st }); } }
  k.sector = sec;
}

/* ---------------------------------------------------------------- items */
/** What a box gives, by place: the leader gets what slows them little; the back gets what catches up. */
export function rollItem(place, n, rand) {
  const f = n > 1 ? (place - 1) / (n - 1) : 0;   // 0 leader .. 1 last
  if (n > 1 && rand() < PLAY.legend) { const l = rand(); return place === 1 ? (l < 0.4 ? "rain" : l < 0.75 ? "truck" : "blackout") : f < 0.6 ? (l < 0.3 ? "rain" : l < 0.6 ? "truck" : l < 0.85 ? "blackout" : "trade") : (l < 0.2 ? "rain" : l < 0.45 ? "truck" : l < 0.65 ? "blackout" : "trade"); }
  const r = rand();
  if (place === 1) return r < 0.3 ? "bath" : r < 0.5 ? "slap" : r < 0.7 ? "oline" : r < 0.8 ? "drill" : r < 0.9 ? "stand" : "ice";
  if (f < 0.6) return r < 0.2 ? "hail" : r < 0.35 ? "slap" : r < 0.5 ? "drill" : r < 0.6 ? "bath" : r < 0.7 ? "oline" : r < 0.8 ? "pick6" : r < 0.9 ? "buzzer" : "nutmeg";
  return r < 0.25 ? "drill" : r < 0.4 ? "hail" : r < 0.6 ? "flag" : r < 0.7 ? "oline" : r < 0.8 ? "press" : r < 0.9 ? "homer" : "pick6";
}
export const PAD = { w: 4.5, len: 2.6, boost: 1.0, cd: 1.5 };
/** A boost pad: cross its strip (PAD.w wide across the road, PAD.len along it) and the kart gets PAD.boost seconds, once per PAD.cd. */
export function takePads(race, k, now, events) {
  if (k.finished) return; k.padCd = Math.max(0, (k.padCd || 0) - KART.STEP);
  if (k.padCd > 0) return;
  for (const pd of race.track.pads) { const q = race.track.pts[pd.i], dx = k.p.x - q.x, dz = k.p.z - q.z, along = dx * q.tx + dz * q.tz, across = dx * q.nx + dz * q.nz; if (Math.abs(along) < PAD.len / 2 && Math.abs(across - pd.off) < PAD.w / 2) { k.boost = Math.max(k.boost, PAD.boost); k.padCd = PAD.cd; events?.push({ type: "boost", k, from: "pad", t: PAD.boost }); return; } }
}
export function takeItems(race, k, now, rand, events) {
  if (k.item || k.finished) return;
  for (const it of race.track.items) { if (it.t > 0) continue; const q = race.track.pts[it.i], x = q.x + q.nx * it.off, z = q.z + q.nz * it.off; if ((k.p.x - x) ** 2 + (k.p.z - z) ** 2 < PICKUP_R * PICKUP_R) { it.t = ITEM_RESPAWN_S; k.item = rollItem(k.place || 1, race.karts.length, rand); events?.push({ type: "item", k, item: k.item }); return; } }
}
/** Use what you hold. Shots live in `race.shots` (kind hail | slap | flag), puddles in `race.puddles`. */
export function useItem(race, k, now, events) {
  if (!k.item || k.spin > 0 || k.finished) return false;
  const item = k.item; k.item = null; const t = race.track;
  if (item === "drill") { k.boost = Math.max(k.boost, 1.5); events?.push({ type: "boost", k, from: "item", t: 1.5 }); }
  else if (item === "hail") { const me = progressOf(t, k); let target = null, bd = Infinity; for (const o of race.karts) { if (o === k || o.finished) continue; const d = progressOf(t, o) - me; if (d > 0 && d < 90 && d < bd) { bd = d; target = o; } } race.shots.push({ kind: "hail", i: k.i + 3, off: lateral(t, k.p, k.i), owner: k, target, t: SHOT.hail.life, x: k.p.x, z: k.p.z }); events?.push({ type: "shot", k, kind: "hail", target }); }
  else if (item === "slap") { race.shots.push({ kind: "slap", i: k.i + 3, off: lateral(t, k.p, k.i), owner: k, target: null, t: SHOT.slap.life, x: k.p.x, z: k.p.z }); events?.push({ type: "shot", k, kind: "slap" }); }
  else if (item === "bath") { race.puddles.push({ x: k.p.x - Math.sin(k.head) * 2.8, z: k.p.z - Math.cos(k.head) * 2.8, by: k.i }); events?.push({ type: "puddle", k }); }
  else if (item === "flag") { const leader = race.karts.filter((o) => o !== k && !o.finished).sort((a, b) => a.place - b.place)[0]; if (leader) { race.shots.push({ kind: "flag", owner: k, target: leader, t: SHOT.flag.life, x: k.p.x, z: k.p.z + 0, y: 3 }); events?.push({ type: "shot", k, kind: "flag", target: leader }); } }
  else if (item === "oline") { k.shield = SHIELD_S; events?.push({ type: "shield", k }); }
  else if (item === "pick6" || item === "trade") { const o = item === "trade" ? race.karts.filter((x) => x !== k && !x.finished).sort((a, b) => a.place - b.place)[0] : aheadOf(race, k, 70, true); if (o && (item === "trade" ? o.place < k.place : true)) { swapSeats(k, o); events?.push({ type: "swap", k, with: o, trade: item === "trade" }); } else { k.boost = Math.max(k.boost, 1); events?.push({ type: "boost", k, from: "item", t: 1 }); } }
  else if (item === "press") { let n = 0; for (const o of race.karts) if (o !== k && !o.finished && o.place < k.place) { o.slow = PLAY.press; n++; } events?.push({ type: "press", k, n }); }
  else if (item === "stand") { const q = t.pts[k.i % t.N], bx = k.p.x - Math.sin(k.head) * 3.4, bz = k.p.z - Math.cos(k.head) * 3.4; for (const s of [-2.4, 0, 2.4]) race.puddles.push({ x: bx + q.nx * s, z: bz + q.nz * s, kind: "stand", t: PLAY.stand, owner: k, at: now, by: k.i }); events?.push({ type: "stand", k }); }
  else if (item === "ice") { const o = behindOf(race, k, 30); if (o) { if (o.shield > 0) { o.shield = 0; events?.push({ type: "blocked", k: o, why: "ice", by: k }); } else if (o.truck > 0) events?.push({ type: "blocked", k: o, why: "ice", by: k, truck: true }); else { o.frozen = PLAY.ice; o.drift = 0; o.boost = 0; events?.push({ type: "ice", k, target: o }); } } else events?.push({ type: "ice", k, target: null }); }
  else if (item === "buzzer") { const o = aheadOf(race, k, 60, false); let x1, z1; if (o) { const q = t.pts[Math.floor(o.i + Math.max(0, o.speed) * SHOT.buzzer.life * (t.N / t.len)) % t.N], off = lateral(t, o.p, o.i); x1 = q.x + q.nx * off; z1 = q.z + q.nz * off; } else { const q = t.pts[Math.floor(k.i + 25 * (t.N / t.len)) % t.N], off = lateral(t, k.p, k.i); x1 = q.x + q.nx * off; z1 = q.z + q.nz * off; } race.shots.push({ kind: "buzzer", owner: k, target: o, t: SHOT.buzzer.life + 0.2, age: 0, x0: k.p.x, z0: k.p.z, x1, z1, x: k.p.x, z: k.p.z, y: 1 }); events?.push({ type: "shot", k, kind: "buzzer", target: o }); }
  else if (item === "nutmeg" || item === "homer") { race.shots.push({ kind: item, i: k.i + 3, off: item === "nutmeg" ? 0 : lateral(t, k.p, k.i), owner: k, target: null, t: SHOT[item].life, x: k.p.x, z: k.p.z }); events?.push({ type: "shot", k, kind: item }); }
  else if (item === "rain") { race.rain = PLAY.rain; race.rainBy = k; events?.push({ type: "rain", k }); }
  else if (item === "truck") { k.truck = PLAY.truck; k.spin = 0; k.frozen = 0; events?.push({ type: "truck", k }); }
  else if (item === "blackout") { race.dark = PLAY.dark; race.darkBy = k; events?.push({ type: "dark", k }); }
  events?.push({ type: "use", k, item });
  return true;
}
function aheadOf(race, k, within, sameLap) { const t = race.track, me = progressOf(t, k); let best = null, bd = Infinity; for (const o of race.karts) { if (o === k || o.finished || (sameLap && o.lap !== k.lap)) continue; const d = progressOf(t, o) - me; if (d > 0 && d < within && d < bd) { bd = d; best = o; } } return best; }
function behindOf(race, k, within) { const t = race.track, me = progressOf(t, k); let best = null, bd = Infinity; for (const o of race.karts) { if (o === k || o.finished) continue; const d = me - progressOf(t, o); if (d > 0 && d < within && d < bd) { bd = d; best = o; } } return best; }
/** Two karts change places on the track: where they are, which way they face, how far round they are. Times and items stay their own. */
export function swapSeats(a, b) { for (const f of ["yaw", "head", "i", "speed", "lap", "sector", "cpNext", "lapStart", "grass"]) { const x = a[f]; a[f] = b[f]; b[f] = x; } const p = a.p; a.p = b.p; b.p = p; const s = a.splits; a.splits = b.splits; b.splits = s; a.drift = b.drift = 0; a.driftT = b.driftT = 0; }
function knock(race, k, sh, now, events) { if (k.finished) return; if (k.shield > 0) { k.shield = 0; events?.push({ type: "blocked", k, why: "homer", by: sh.owner }); return; } if (k.truck > 0) { events?.push({ type: "blocked", k, why: "homer", by: sh.owner, truck: true }); return; } const t = race.track, q = t.pts[k.i % t.N], dir = lateral(t, k.p, k.i) >= 0 ? 1 : -1; k.push.x += q.nx * dir * PLAY.knock; k.push.z += q.nz * dir * PLAY.knock; k.speed *= 0.5; k.drift = 0; k.driftT = 0; k.boost = 0; events?.push({ type: "knock", k, by: sh.owner }); }
function spinOut(k, now, events, why, by) {
  if (k.spin > 0 || k.finished) return false;
  if (k.shield > 0) { k.shield = 0; events?.push({ type: "blocked", k, why, by }); return true; }
  if (k.truck > 0) { events?.push({ type: "blocked", k, why, by, truck: true }); return true; }
  k.spin = KART.SPIN_S; k.drift = 0; k.driftT = 0; k.boost = 0; events?.push({ type: "spin", k, why, by }); return true;
}

/* ---------------------------------------------------------------- bots */
/** A bot chases a point a little way down the centreline, in a lane of its own, and uses what it holds when it makes sense. */
export function botInput(race, k, dt, rand) {
  const t = race.track, N = t.N;
  k.laneT -= dt; if (k.laneT <= 0) { k.laneT = 3 + rand() * 4; k.lane = (rand() - 0.5) * (t.width - 5); }
  const look = Math.round(6 + Math.abs(k.speed) * 0.55), ti = (k.i + look) % N, q = t.pts[ti];
  // dodge a banana in the lane ahead
  let lane = k.lane; for (const b of race.puddles) { const bi = nearest(t, b, k.i); const ahead = ((bi - k.i) % N + N) % N; if (ahead < 25) { const boff = lateral(t, b, bi); if (Math.abs(boff - lane) < 2.2) lane = boff + (boff > 0 ? -3 : 3); } }
  const tx = q.x + q.nx * lane, tz = q.z + q.nz * lane;
  const want = Math.atan2(tx - k.p.x, tz - k.p.z), diff = wrapAngle(want - k.yaw);
  let steer = clamp(diff * 2.2, -1, 1); const sharp = Math.abs(diff);
  if (race.dark > 0 && race.darkBy !== k) steer = clamp(steer + (rand() - 0.5) * 1.6, -1, 1);   // the lights are out: they are guessing
  // a bot commits to a drift: once in, it holds for a tier or so (or while the corner still needs it) and lets go once the nose has come round
  const drift = k.drift ? (diff * k.drift > -0.25 && (k.driftT < (k.botHold || 0) || sharp > 0.15)) : (sharp > 0.32 && k.speed > 11 && !k.grass);
  if (drift && !k.drift) k.botHold = 0.9 + rand() * 1.5;
  const inp = { accel: true, brake: sharp > 1.25 && k.speed > 14, steer, drift, use: false };
  if (k.item) { const me = progressOf(t, k); let aheadClose = false, behindClose = false; for (const o of race.karts) { if (o === k) continue; const d = progressOf(t, o) - me; if (d > 0 && d < 30) aheadClose = true; if (d < 0 && d > -14) behindClose = true; }
    if (k.item === "drill") inp.use = sharp < 0.25; else if (k.item === "hail") inp.use = aheadClose || rand() < 0.002; else if (k.item === "slap") inp.use = (aheadClose && sharp < 0.3) || rand() < 0.002; else if (k.item === "flag") inp.use = k.place > 1 || rand() < 0.01; else if (k.item === "oline") inp.use = behindClose || rand() < 0.003;
    else if (k.item === "pick6" || k.item === "buzzer" || k.item === "homer" || k.item === "nutmeg") inp.use = aheadClose || rand() < 0.002; else if (k.item === "trade") inp.use = k.place > 2 || rand() < 0.01; else if (k.item === "press") inp.use = k.place > 3 || rand() < 0.005;
    else if (k.item === "stand" || k.item === "ice") inp.use = behindClose || rand() < 0.003; else if (k.item === "rain" || k.item === "blackout") inp.use = k.place > 1 || rand() < 0.005; else if (k.item === "truck") inp.use = aheadClose || behindClose || rand() < 0.005; else inp.use = behindClose || rand() < 0.003; }
  return inp;
}

/* ---------------------------------------------------------------- the race */
export function newRace(trackKey, humanName, bots = KART.PLAYERS - 1, rand = Math.random) {
  const track = buildTrack(trackKey), karts = [newKart(0, humanName, false, KART_COLORS[0])];
  const names = BOT_NAMES.slice(); for (let b = 1; b <= bots; b++) { const k = newKart(b, names.splice(Math.floor(rand() * names.length), 1)[0], true, KART_COLORS[b % KART_COLORS.length]); k.skill = 0.93 + rand() * 0.06; karts.push(k); }
  placeOnGrid(track, karts);
  const race = { track, karts, shots: [], puddles: [], t: 0, state: "count", countT: 3.2, started: 0, rain: 0, rainBy: null, dark: 0, darkBy: null };
  for (const k of karts) k.raceStart = 0;
  return race;
}
/** The whole race, one step. `inputFor(k)` gives the person's input (bots make their own). */
export function stepRace(race, inputFor, dt, rand, events) {
  race.t += dt; const now = race.t, t = race.track;
  if (race.state === "count") { race.countT -= dt;
    for (const k of race.karts) { k.speed = 0; const inp = k.bot ? { accel: race.countT < (k.rocketAt ?? (k.rocketAt = rand() < 0.45 ? 0.1 + rand() * 0.4 : 1.5 + rand())) } : inputFor(k); k.heldT = inp.accel ? k.heldT + dt : 0; }
    if (race.countT <= 0) { race.state = "race"; race.started = now; for (const k of race.karts) { k.raceStart = now; k.lapStart = 0;
        // the rocket start: throttle down inside the window before the lights go is a boost; held since long before them is a burnout
        if (k.heldT > 0 && k.heldT <= KART.ROCKET_WINDOW) { k.boost = KART.ROCKET_BOOST; events?.push({ type: "boost", k, from: "rocket", t: KART.ROCKET_BOOST }); } else if (k.heldT > 1.2) { k.burnout = KART.BURNOUT_S; events?.push({ type: "burnout", k }); } }
      events?.push({ type: "go" }); }
    return; }
  if (race.state === "done") return;
  // ranking first, so items know the places
  const order = race.karts.slice().sort((a, b) => (b.finished ? 1e9 - b.total : progressOf(t, b)) - (a.finished ? 1e9 - a.total : progressOf(t, a)));
  order.forEach((k, n) => { k.place = n + 1; });
  const human = race.karts.find((k) => !k.bot);
  if (human && !human.finished && now - race.started > 2) { if (human.prevPlace && human.place < human.prevPlace) events?.push({ type: "pass", k: human, over: order[human.place] || null }); else if (human.prevPlace && human.place > human.prevPlace) events?.push({ type: "passed", k: human, by: order[human.place - 2] || null }); }
  for (const k of race.karts) k.prevPlace = k.place;
  if (race.rain > 0) race.rain -= dt; if (race.dark > 0) race.dark -= dt;
  for (const k of race.karts) {
    k.wet = race.rain > 0 && k !== race.rainBy;
    let inp;
    if (k.finished) inp = { accel: true, brake: false, steer: clamp(wrapAngle(Math.atan2(t.pts[(k.i + 8) % t.N].x - k.p.x, t.pts[(k.i + 8) % t.N].z - k.p.z) - k.yaw) * 2, -1, 1), drift: false, use: false };
    else if (k.bot) { inp = botInput(race, k, dt, rand); if (human) { const gap = (progressOf(t, human) - progressOf(t, k)) / t.N; k.skill = clamp(0.95 + gap * 0.5, 0.88, 1.06); } }
    else inp = inputFor(k);
    if (inp.use) useItem(race, k, now, events);
    stepKart(t, k, inp, dt, now, events);
    // the slipstream: a second tucked close behind a rival in the same lane pays a boost
    if (!k.finished && k.draftT >= 0) { let behind = false; for (const o of race.karts) { if (o === k || o.finished) continue; const d = progressOf(t, o) - progressOf(t, k); if (d > 2 && d < KART.DRAFT_RANGE && Math.abs(lateral(t, o.p, o.i) - lateral(t, k.p, k.i)) < KART.DRAFT_LANE) { behind = true; break; } } k.draftT = behind ? k.draftT + dt : 0; if (k.draftT >= KART.DRAFT_S) { k.boost = Math.max(k.boost, KART.DRAFT_BOOST); k.draftT = -1.5; events?.push({ type: "boost", k, from: "draft", t: KART.DRAFT_BOOST }); } }
    else if (k.draftT < 0) k.draftT = Math.min(0, k.draftT + dt);
    takeItems(race, k, now, rand, events); takePads(race, k, now, events);
  }
  // karts push each other apart
  for (let a = 0; a < race.karts.length; a++) for (let b = a + 1; b < race.karts.length; b++) { const A = race.karts[a], B = race.karts[b]; const dx = B.p.x - A.p.x, dz = B.p.z - A.p.z, d = Math.hypot(dx, dz), min = KART.R * 2; if (d < min && d > 0.001) {
    const push = (min - d) / 2, ux = dx / d, uz = dz / d; A.p.x -= ux * push; A.p.z -= uz * push; B.p.x += ux * push; B.p.z += uz * push;
    // how fast they are closing along the line between them, as a shove that each carries for a moment
    const vax = Math.sin(A.head) * A.speed + A.push.x, vaz = Math.cos(A.head) * A.speed + A.push.z, vbx = Math.sin(B.head) * B.speed + B.push.x, vbz = Math.cos(B.head) * B.speed + B.push.z;
    const closing = (vax - vbx) * ux + (vaz - vbz) * uz; if (closing > 0) { const j = Math.min(KART.BUMP_MAX, 2 + closing * KART.BUMP_PUSH); A.push.x -= ux * j; A.push.z -= uz * j; B.push.x += ux * j; B.push.z += uz * j; A.speed *= 0.94; B.speed *= 0.94;
      if ((A.truck > 0) !== (B.truck > 0)) { const s = A.truck > 0 ? 1 : -1, T = A.truck > 0 ? A : B, V = A.truck > 0 ? B : A; V.push.x += ux * s * j * 1.6; V.push.z += uz * s * j * 1.6; T.push.x += ux * s * j; T.push.z += uz * s * j; T.speed /= 0.94; V.speed *= 0.8; V.yaw += (Math.random() - 0.5) * 0.6; }
      const side = Math.sin(A.head) * uz - Math.cos(A.head) * ux; A.yaw += side * 0.06; B.yaw -= side * 0.06;   // the wheel kicks a touch away from the hit
      if (now - A.lastHit > 0.35 || now - B.lastHit > 0.35) { A.lastHit = B.lastHit = now; events?.push({ type: "bump", a: A, b: B, force: j }); } } } }
  // the shots: a Hail Mary and a slapshot run down the track (the football steers into its target's lane), a flag flies straight at the leader; puddles wait
  for (const k of race.karts) if (k.shield > 0) k.shield -= dt;
  for (let s = race.shots.length - 1; s >= 0; s--) { const sh = race.shots[s]; sh.t -= dt; let gone = sh.t <= 0;
    if (sh.kind === "flag") { const tg = sh.target; if (!tg || tg.finished) gone = true; else { const dx = tg.p.x - sh.x, dz = tg.p.z - sh.z, d = Math.hypot(dx, dz) || 1, step = SHOT.flag.speed * dt; if (d <= step + 0.5) { sh.x = tg.p.x; sh.z = tg.p.z; spinOut(tg, now, events, "flag", sh.owner); gone = true; } else { sh.x += dx / d * step; sh.z += dz / d * step; sh.y = 2.5 + Math.min(4, d * 0.15); } } }
    else if (sh.kind === "buzzer") { sh.age += dt; const f = Math.min(1, sh.age / SHOT.buzzer.life); sh.x = sh.x0 + (sh.x1 - sh.x0) * f; sh.z = sh.z0 + (sh.z1 - sh.z0) * f; sh.y = 0.6 + Math.sin(f * Math.PI) * 7; if (f >= 1) { for (const k of race.karts) if (k !== sh.owner && (k.p.x - sh.x) ** 2 + (k.p.z - sh.z) ** 2 < PLAY.buzzerR * PLAY.buzzerR) spinOut(k, now, events, "buzzer", sh.owner); events?.push({ type: "land", kind: "buzzer", x: sh.x, z: sh.z }); gone = true; } }
    else { const spd = SHOT[sh.kind].speed; sh.i += (spd * dt) * (t.N / t.len); if (sh.kind === "nutmeg") sh.off = (t.width / 2 - 1.3) * Math.sin((SHOT.nutmeg.life - sh.t) * 2.4); if (sh.kind === "hail" && sh.target && !sh.target.finished) sh.off += (lateral(t, sh.target.p, sh.target.i) - sh.off) * Math.min(1, 3 * dt); const q = t.pts[Math.floor(sh.i) % t.N]; sh.x = q.x + q.nx * sh.off; sh.z = q.z + q.nz * sh.off;
      if (Math.abs(sh.off) > t.width / 2 + 1) gone = true;   // a puck into the wall is gone
      if (!gone) for (const k of race.karts) { if (k === sh.owner && sh.t > SHOT[sh.kind].life - 0.5) continue; if ((k.p.x - sh.x) ** 2 + (k.p.z - sh.z) ** 2 < HIT_R * HIT_R) { if (sh.kind === "homer") knock(race, k, sh, now, events); else spinOut(k, now, events, sh.kind, sh.owner); gone = true; break; } } }
    if (gone) race.shots.splice(s, 1); }
  for (let b = race.puddles.length - 1; b >= 0; b--) { const ba = race.puddles[b]; if (ba.t != null) { ba.t -= dt; if (ba.t <= 0) { race.puddles.splice(b, 1); continue; } }
    for (const k of race.karts) { if (k.spin > 0 || k.truck > 0 || (ba.owner === k && now - ba.at < 1.5)) continue; if ((k.p.x - ba.x) ** 2 + (k.p.z - ba.z) ** 2 < 1.7 * 1.7) { if (spinOut(k, now, events, ba.kind || "bath", ba.owner || null)) race.puddles.splice(b, 1); break; } } }
  for (const it of t.items) if (it.t > 0) it.t -= dt;
  // the race ends when the person has finished and a moment has passed, when everyone has, or thirty seconds after the winner (nobody waits on a kart parked in the grass)
  const first = race.karts.reduce((m, k) => (k.finished && (!m || k.finished < m) ? k.finished : m), 0);
  if ((human?.finished && now - human.finished > 4) || (first && now - first > 30)) { race.state = "done"; for (const k of race.karts) if (!k.finished) { k.finished = now; k.total = now - k.raceStart + (race.karts.length - k.place) * 0.01; } events?.push({ type: "done" }); }
  else if (race.karts.every((k) => k.finished)) { race.state = "done"; events?.push({ type: "done" }); }
}
export const fmtTime = (s) => { if (!s && s !== 0) return "—"; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, "0")}`; };
export const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };

/* SOAPBOX RACING, the playable prototype (2026-10-02). Top-down arcade physics at a fixed 60 steps a second: a kart is a circle with a heading;
   its speed along the heading comes from the engine, its sideways slide is bled off by the wheels' grip, and two karts that touch exchange an
   impulse (bumper cars: very bouncy) scaled by their frames' mass, which also wears their parts. A part at 0 condition BREAKS and does a
   fraction of its job. The kart you drive is whatever the garage has fitted, worn parts and all.
   (2026-10-02, the owner: "the tracks need to be longer, more advanced, some parts of the track out of view") TRACKS ARE PATHS NOW, bigger than
   the screen: a smooth closed curve through hand-placed points, a fixed width of road, kerbs, a gravel run-off that slows you and a fence past it.
   The camera follows you (and looks ahead the way you're going) and a minimap shows the rest. The Junkyard Run goes through a TUNNEL under a scrap
   heap that hides everyone in it; the Figure Eight crosses itself on a BRIDGE, and karts on the deck and karts underneath never touch. */
(() => {
  const $ = (id) => document.getElementById(id);
  const IMG = (src) => { const i = new Image(); i.src = src; return i; };
  const FLAT = "/v3/assets/img/glad/flat/";

  /* ---------------------------------------------------------------- PARTS */
  const SLOTS = ["engine", "wheels", "frame", "steer", "bumper"];
  const SLOT = { engine: "Engine", wheels: "Wheels", frame: "Frame", steer: "Steering", bumper: "Bumper" };
  const ICON = { engine: "p_engine.png", wheels: "p_wheels.png", frame: "p_frame.png", steer: "p_steer.png", bumper: "p_bumper.png" };
  const DOES = { engine: "acceleration and top speed", wheels: "grip: how little you slide", frame: "weight and armour", steer: "how sharp you turn", bumper: "how hard you hit, and how much of a hit it takes first" };
  const BREAKS = { engine: "Coughs along at a third of its power", wheels: "A wheel comes off: almost no grip", frame: "Cracks: half the armour, lighter in a bump", steer: "Pulls to one side, turns at half", bumper: "Falls off: hits go straight to the other parts" };
  const RAR = { junk: { n: "Junk", tough: 1.4, tint: "grayscale(.7) brightness(.9)" }, tuned: { n: "Tuned", tough: 1, tint: "none" },
    racing: { n: "Racing", tough: 0.85, tint: "hue-rotate(190deg) saturate(1.4)" }, legend: { n: "Legendary", tough: 0.7, tint: "sepia(1) saturate(3.5) hue-rotate(5deg) brightness(1.15)" } };
  const CAT = {
    lawnmower: ["engine", "junk", "Lawnmower engine", { acc: 240, top: 235 }], moped: ["engine", "tuned", "Moped engine", { acc: 285, top: 265 }],
    leafblower: ["engine", "racing", "Leaf-blower turbo", { acc: 330, top: 295 }], jetski: ["engine", "legend", "Jet-ski motor", { acc: 370, top: 330 }],
    trolley: ["wheels", "junk", "Shopping-trolley wheels", { grip: 4.2 }], pram: ["wheels", "tuned", "Pram wheels", { grip: 5.4 }],
    slicks: ["wheels", "racing", "Go-kart slicks", { grip: 6.8 }], monster: ["wheels", "legend", "Monster-truck minis", { grip: 8.2 }],
    fridge: ["frame", "junk", "Fridge-door frame", { mass: 1.0, armor: 1.0 }], bathtub: ["frame", "tuned", "Clawfoot bathtub", { mass: 1.35, armor: 1.35 }],
    cage: ["frame", "racing", "Trolley roll-cage", { mass: 0.9, armor: 1.3 }], hearse: ["frame", "legend", "Hearse roof", { mass: 1.25, armor: 1.8 }],
    buswheel: ["steer", "junk", "Bus steering wheel", { turn: 2.4 }], arcade: ["steer", "tuned", "Arcade-cabinet wheel", { turn: 2.9 }],
    ships: ["steer", "racing", "Ship's wheel", { turn: 3.3 }], rally: ["steer", "legend", "Rally wheel", { turn: 3.8 }],
    noodle: ["bumper", "junk", "Pool-noodle bumper", { ram: 0.8, absorb: 0.5 }], tyre: ["bumper", "tuned", "Tyre-ring bumper", { ram: 1.0, absorb: 0.7 }],
    hazard: ["bumper", "racing", "Hazard rubber", { ram: 1.2, absorb: 0.8 }], plough: ["bumper", "legend", "Snowplough blade", { ram: 1.6, absorb: 0.85 }] };
  const part = (id, cond = 100) => ({ id, cond });
  const G = { fit: { engine: part("lawnmower"), wheels: part("pram", 78), frame: part("fridge"), steer: part("buswheel"), bumper: part("tyre", 64) },
    stash: [part("moped"), part("trolley", 40), part("slicks"), part("noodle"), part("bathtub", 55)], scrap: 40, gears: 8, gear: 0 };
  const statText = (s) => Object.entries(s).map(([k, v]) => `${{ acc: "accel", top: "top", grip: "grip", mass: "weight", armor: "armour", turn: "turn", ram: "ram", absorb: "absorb" }[k]} ${v}`).join(" · ");

  /** what the fitted parts add up to (a broken part does a fraction of its job; under 30% it is a little tired) */
  function kartStats(fit, gear = 0) {
    const on = (slot) => { const p = fit[slot], c = CAT[p.id]; return { s: c[3], broken: p.cond <= 0, tired: p.cond > 0 && p.cond < 30 }; };
    const e = on("engine"), w = on("wheels"), f = on("frame"), st = on("steer"), b = on("bumper");
    const k = (x) => (x.broken ? 1 : x.tired ? 0.92 : 1);
    let acc = e.s.acc * (e.broken ? 0.35 : k(e)), top = e.s.top * (e.broken ? 0.45 : k(e));
    acc *= 1 - 0.15 * gear; top *= 1 + 0.12 * gear;
    const mass = f.s.mass * (f.broken ? 0.85 : 1), armor = f.s.armor * (f.broken ? 0.5 : 1);
    acc /= Math.sqrt(mass);
    return { acc, top, grip: w.s.grip * (w.broken ? 0.35 : k(w)), turn: st.s.turn * (st.broken ? 0.5 : k(st)), pull: st.broken ? 0.7 : 0, mass, armor,
      ram: b.s.ram * (b.broken ? 0.6 : 1), absorb: b.broken ? 0 : b.s.absorb };
  }

  /* ---------------------------------------------------------------- THE TRACKS */
  const W = 960, H = 560, R = 15, SP = 10, RUNOFF = 46;
  const lemni = (cx, cy, A, B, n) => Array.from({ length: n }, (_, i) => { const t = (i * 2 * Math.PI) / n; return [cx + A * Math.sin(t), cy + B * Math.sin(t) * Math.cos(t)]; });
  const DEFS = {
    junkyard: { name: "The Junkyard Run", laps: 2, theme: "junk", world: [3000, 2000], width: 150, start: 0.5,
      ctrl: [[600, 1750], [1400, 1750], [2000, 1720], [2500, 1600], [2750, 1300], [2650, 1000], [2300, 900], [2050, 1100], [1750, 1250], [1450, 1100], [1500, 800], [1850, 600], [2400, 450],
        [2700, 300], [2400, 150], [1700, 180], [1000, 250], [600, 450], [800, 750], [500, 1000], [250, 1250], [300, 1600]],
      tunnel: [14.4, 15.7], oil: [[3.5, 0.3], [9.3, -0.35], [18.5, 0.2], [6.6, 0.4]], boost: [1.1, 12.1, 20.4],
      blurb: "Two laps of the scrapyard: a long run in, two hairpins, a chicane through the wrecks, and a tunnel under the scrap heap where nobody can see what you're doing." },
    eight: { name: "The Figure Eight", laps: 3, theme: "green", world: [2400, 1800], width: 140, start: 3,
      ctrl: lemni(1200, 880, 950, 1400, 24), bridge: [11.35, 12.65], oil: [[8, 0.3], [20, -0.3]], boost: [3.4, 15.4],
      blurb: "Three laps of a figure eight that crosses itself on a wooden bridge. Karts on the deck and karts underneath can't touch; the crossing is where people get T-boned." },
    bowl: { name: "The Bumper Bowl", arena: true, secs: 60, theme: "junk", world: [960, 560],
      blurb: "Sixty seconds in the arena. Points for every hit, fifty more for every part you break." } };

  /** a closed Catmull-Rom curve through the points, laid out every SP px, with where each control point landed (`cs`) so features can be placed by it */
  function buildPath(def) {
    const C = def.ctrl, n = C.length, dense = [], cs = [];
    for (let i = 0; i < n; i++) {
      const p0 = C[(i - 1 + n) % n], p1 = C[i], p2 = C[(i + 1) % n], p3 = C[(i + 2) % n];
      cs.push(dense.length);
      for (let k = 0; k < 40; k++) { const u = k / 40, u2 = u * u, u3 = u2 * u;
        dense.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * u + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * u2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * u3))); }
    }
    /* walk the dense curve and lay a point every SP px; remember the arc length at each control point */
    const P = [], denseS = [0];
    for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; denseS.push(denseS[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const L = denseS[dense.length], cS = cs.map((d) => denseS[d]);
    let j = 0;
    for (let s = 0; s < L - SP / 2; s += SP) { while (denseS[j + 1] < s) j++; const a = dense[j], b = dense[(j + 1) % dense.length], t = (s - denseS[j]) / (denseS[j + 1] - denseS[j] || 1); P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    const N = P.length, sOf = (c) => { const i = Math.floor(c) % n, f = c - Math.floor(c), a = cS[i], b = i + 1 < n ? cS[i + 1] : L; return a + (b - a) * f; };
    /* index 0 is the start line */
    const shift = Math.round(sOf(def.start) / SP) % N, Q = P.slice(shift).concat(P.slice(0, shift));
    const idxOf = (c) => ((Math.round(sOf(c) / SP) - shift) % N + N) % N;
    const T = Q.map((_, i) => { const a = Q[(i - 1 + N) % N], b = Q[(i + 1) % N], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
    const Nr = T.map(([tx, ty]) => [-ty, tx]);   /* left of the way you're going */
    return { P: Q, T, Nr, N, L: N * SP, idxOf };
  }
  function makeTrack(key) {
    const D = DEFS[key];
    if (D.arena) return { key, D, arena: true, ww: 960, wh: 560 };
    const path = buildPath(D), hw = D.width / 2, T = { key, D, ...path, hw, ww: D.world[0], wh: D.world[1] };
    T.oil = (D.oil || []).map(([c, off]) => { const i = path.idxOf(c); return { i, x: path.P[i][0] + path.Nr[i][0] * off * hw, y: path.P[i][1] + path.Nr[i][1] * off * hw, r: 24 }; });
    T.boost = (D.boost || []).map((c) => { const i = path.idxOf(c); return { i, x: path.P[i][0], y: path.P[i][1], a: Math.atan2(path.T[i][1], path.T[i][0]) }; });
    const range = (r) => (r ? [path.idxOf(r[0]), path.idxOf(r[1])] : null);
    T.tunnel = range(D.tunnel); T.bridge = range(D.bridge);
    T.inRange = (r, i) => !!r && (r[0] <= r[1] ? i >= r[0] && i <= r[1] : i >= r[0] || i <= r[1]);
    return T;
  }

  /* ---------------------------------------------------------------- ART */
  const A = (k) => IMG(FLAT + k + ".png");
  const ART = { kart: IMG("kart_top.png"), oil1: A("th_oil1"), oil2: A("th_oil2"), stand: A("th_grandstand"), board: A("th_scoreboard"), snack: A("th_snackcart"),
    junk: ["th_cars", "th_buses", "th_tyrewall", "o_tyres", "th_trash", "th_flamebarrel", "o_crates", "th_truck", "o_barrel"].map(A), junkking: A("junkking"),
    green: ["tree", "tree2", "tree3", "o_haybale", "th_tyres", "o_lamppost", "o_oak", "g_bush"].map(A),
    crowd: ["pet_ferret", "pet_owlet", "pet_lilcrusher", "pet_grinling", "pet_cointoad", "pet_raptor", "pet_starling"].map(A), cones: A("o_cones"), barrel: A("o_barrel") };
  const RIVALS = [
    { name: "Wet Paint", hue: 200, fit: { engine: "moped", wheels: "pram", frame: "fridge", steer: "arcade", bumper: "tyre" }, lane: -0.5, aggro: 0.2 },
    { name: "Lucky Lou", hue: 100, fit: { engine: "lawnmower", wheels: "slicks", frame: "cage", steer: "ships", bumper: "noodle" }, lane: 0.35, aggro: 0.1 },
    { name: "Big Chungo", hue: 280, fit: { engine: "moped", wheels: "trolley", frame: "hearse", steer: "buswheel", bumper: "plough" }, lane: 0, aggro: 0.8 },
    { name: "Brenda", hue: 320, fit: { engine: "leafblower", wheels: "pram", frame: "bathtub", steer: "arcade", bumper: "hazard" }, lane: 0.55, aggro: 0.4 },
    { name: "The Accountant", hue: 50, fit: { engine: "moped", wheels: "pram", frame: "bathtub", steer: "arcade", bumper: "tyre" }, lane: -0.25, aggro: 0.3 }];

  /* the old arena, for the Bumper Bowl: a rounded box with tyre stacks */
  const CX = 480, CY = 280, OUT = { hx: 450, hy: 262, r: 175 };
  const BOWL = { oil: [[300, 380, 30], [690, 170, 28]], posts: [[480, 280, 34], [290, 170, 26], [670, 390, 26]] };
  const sdRR = (x, y, b) => { const qx = Math.abs(x - CX) - b.hx + b.r, qy = Math.abs(y - CY) - b.hy + b.r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r; };
  const grad = (x, y, b) => { const e = 0.5, gx = sdRR(x + e, y, b) - sdRR(x - e, y, b), gy = sdRR(x, y + e, b) - sdRR(x, y - e, b), l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l]; };

  /* ---------------------------------------------------------------- THE RACE */
  const cv = $("cv"), ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  let mode = "junkyard", race = null, TR = makeTrack(mode), layer = null;
  const cam = { x: 0, y: 0 };
  const keys = { up: false, down: false, left: false, right: false, slide: false };
  const angDiff = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  function nearest(k, wide) {
    const T = TR; let best = k.ti, bd = Infinity;
    if (wide) { for (let i = 0; i < T.N; i++) { const dx = k.x - T.P[i][0], dy = k.y - T.P[i][1], d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } } }
    else for (let o = -30; o <= 30; o++) { const i = (k.ti + o + T.N) % T.N, dx = k.x - T.P[i][0], dy = k.y - T.P[i][1], d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return [best, Math.sqrt(bd)];
  }
  function newKart(name, fit, me, hue, rival) {
    const parts = {}; for (const s of SLOTS) parts[s] = me ? G.fit[s] : part(fit[s]);
    return { name, me, hue, rival, parts, x: 0, y: 0, a: 0, vx: 0, vy: 0, ti: 0, lap: 0, half: false, started: false, done: null, oilUntil: 0, boostUntil: 0, stuck: 0, backUntil: 0, wrong: 0, pts: 0, hits: 0, broke: [], ai: { steer: 0 }, level: 0, hidden: false };
  }
  function start() {
    TR = makeTrack(mode); layer = paintWorld(TR);
    const karts = [], meAt = TR.arena ? 0 : 4; let r = 0;
    for (let slot = 0; slot < 6; slot++) karts.push(slot === meAt ? newKart("You", null, true, 0) : (() => { const rv = RIVALS[r++]; return newKart(rv.name, rv.fit, false, rv.hue, rv); })());
    karts.forEach((k, slot) => {
      if (TR.arena) { const g = [[200, 280], [760, 280], [480, 90], [480, 470], [250, 460], [710, 100]][slot]; k.x = g[0]; k.y = g[1]; k.a = Math.atan2(CY - k.y, CX - k.x); return; }
      const row = Math.floor(slot / 2), i = (TR.N - 5 - row * 6) % TR.N, side = slot % 2 ? -0.42 : 0.42;
      k.ti = i; k.x = TR.P[i][0] + TR.Nr[i][0] * side * TR.hw; k.y = TR.P[i][1] + TR.Nr[i][1] * side * TR.hw; k.a = Math.atan2(TR.T[i][1], TR.T[i][0]);
    });
    race = { karts, t: -3, over: false, toast: null, parts: [] };
    const me = karts.find((k) => k.me); cam.x = me.x; cam.y = me.y;
    $("over").hidden = true; cv.focus(); $("log").innerHTML = ""; say(TR.D.blurb, "");
  }
  function say(t, cls) { const L = $("log"); if (L.querySelector(".note")) L.innerHTML = ""; const p = document.createElement("p"); p.className = cls || ""; p.textContent = t; L.prepend(p); }
  function toast(t) { race.toast = { t, until: race.t + 1.6 }; }

  const ROLE = ["bumper", "frame", "wheels", "steer", "engine"];
  function hurt(k, amount, by) {
    const S = kartStats(k.parts);
    let left = (amount * (TR.arena ? 0.6 : 1)) / S.armor;   /* the arena is all bumps: they count for less, or a minute wrecks a kart */
    if (k.parts.bumper.cond > 0) { const take = left * S.absorb; wear(k, "bumper", take, by); left -= take; } else left *= 1.5;
    if (left > 0.5) wear(k, ROLE[1 + Math.floor(Math.random() * 4)], left, by);
  }
  function wear(k, slot, amt, by) {
    const p = k.parts[slot]; if (p.cond <= 0) return;
    const was = p.cond; p.cond = Math.max(0, p.cond - amt * RAR[CAT[p.id][1]].tough);
    if (by) by.pts += Math.round(was - p.cond);
    if (was > 0 && p.cond <= 0) {
      k.broke.push(slot);
      const what = { engine: "engine dies to a cough", wheels: "wheel comes off", frame: "frame cracks", steer: "steering snaps", bumper: "bumper falls off" }[slot];
      if (k.me) { toast(`Your ${what}!`); say(`💥 Your ${what}. ${BREAKS[slot]}.`, "bad"); }
      else if (by?.me) { say(`🔧 You broke ${k.name}'s ${SLOT[slot].toLowerCase()}!`, "good"); by.pts += 50; toast(`${k.name}'s ${SLOT[slot].toLowerCase()} is gone!`); }
      for (let i = 0; i < 14; i++) race.parts.push({ x: k.x, y: k.y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 0.8, c: "#ffcc44", s: 3 });
    }
  }
  const bounce = (k, nx, ny, e = 1.4) => { const vn = k.vx * nx + k.vy * ny; if (vn < 0) { k.vx -= e * vn * nx; k.vy -= e * vn * ny; if (-vn > 120) { hurt(k, -vn * 0.03); spark(k, -nx, -ny); } } };

  function step(dt) {
    const T = TR, karts = race.karts; race.t += dt;
    if (race.t < 0) return;
    if (race.toast && race.t > race.toast.until) race.toast = null;
    for (const k of karts) {
      const S = kartStats(k.parts, k.me ? G.gear : 0);
      let up = 0, down = 0, steer = 0, slide = false;
      if (k.done != null) { down = 1; }
      else if (k.me) { up = keys.up ? 1 : 0; down = keys.down ? 1 : 0; steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); slide = keys.slide; }
      else { Object.assign(k.ai, drive(k, S)); ({ up, down, steer } = k.ai); }
      let off = false, d = 0, ti = k.ti;
      if (!T.arena) { [ti, d] = nearest(k); off = d > T.hw; }
      const fx = Math.cos(k.a), fy = Math.sin(k.a), rx = -fy, ry = fx;
      let vf = k.vx * fx + k.vy * fy, vl = k.vx * rx + k.vy * ry;
      const boosting = race.t < k.boostUntil;
      if (up) vf += S.acc * dt * (vf < 0 ? 2 : 1);
      if (down) vf -= (vf > 0 ? 520 : S.acc * 0.6) * dt;
      if (!up && !down) vf *= 1 - 0.7 * dt;
      if (off) vf *= 1 - 1.6 * dt;   /* the gravel */
      const top = S.top * (boosting ? 1.4 : 1);
      if (vf > top) vf += (top - vf) * Math.min(1, 3 * dt);
      if (vf < -S.top * 0.35) vf = -S.top * 0.35;
      const grip = S.grip * (race.t < k.oilUntil ? 0.15 : 1) * (slide ? 0.3 : 1) * (off ? 0.6 : 1);
      vl *= Math.max(0, 1 - grip * dt);
      const sp = Math.min(1, Math.abs(vf) / 110);
      k.a += (S.turn * steer * sp * Math.sign(vf || 1) + S.pull * sp) * dt;
      k.vx = fx * vf + rx * vl; k.vy = fy * vf + ry * vl;
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (T.arena) {
        const so = sdRR(k.x, k.y, OUT) + R;
        if (so > 0) { const [nx, ny] = grad(k.x, k.y, OUT); k.x -= nx * so; k.y -= ny * so; bounce(k, -nx, -ny); }
        for (const [px, py, pr] of BOWL.posts) { const dx = k.x - px, dy = k.y - py, dd = Math.hypot(dx, dy), m = pr + R - dd; if (m > 0) { const nx = dx / (dd || 1), ny = dy / (dd || 1); k.x += nx * m; k.y += ny * m; bounce(k, nx, ny, 1.5); } }
        for (const [ox, oy, orr] of BOWL.oil) if (Math.hypot(k.x - ox, k.y - oy) < orr) { if (k.me && race.t > k.oilUntil) toast("Oil!"); k.oilUntil = race.t + 0.9; }
      } else {
        /* the fence past the gravel */
        [ti, d] = nearest(k);
        const fence = T.hw + RUNOFF - R;
        if (d > fence) { const [px, py] = T.P[ti], nx = (k.x - px) / d, ny = (k.y - py) / d; k.x = px + nx * fence; k.y = py + ny * fence; bounce(k, -nx, -ny, 1.3); }
        /* laps: crossing the line forwards, having been round the far side */
        const was = k.ti; k.ti = ti;
        if (k.ti > T.N * 0.4 && k.ti < T.N * 0.6) k.half = true;
        if (was > T.N * 0.85 && k.ti < T.N * 0.15 && k.done == null) {
          if (k.started && k.half) { k.lap++; k.half = false; for (const s of SLOTS) wear(k, s, 1.5);
            if (k.lap >= T.D.laps) { k.done = race.t; if (k.me) say(`🏁 You finished in ${race.t.toFixed(2)} s.`, "good"); }
            else if (k.me) toast(`Lap ${k.lap + 1} of ${T.D.laps}`); }
          k.started = true;
        }
        const tdot = k.vx * T.T[k.ti][0] + k.vy * T.T[k.ti][1];
        if (k.me) { k.wrong = tdot < -40 ? k.wrong + dt : 0; if (k.wrong > 1.2 && !race.toast) toast("Wrong way!"); }
        for (const o of T.oil) if (Math.hypot(k.x - o.x, k.y - o.y) < o.r) { if (k.me && race.t > k.oilUntil) toast("Oil!"); k.oilUntil = race.t + 0.9; }
        for (const b of T.boost) if (Math.hypot(k.x - b.x, k.y - b.y) < 30 && Math.cos(k.a - b.a) > 0.5) k.boostUntil = race.t + 0.7;
        k.level = T.inRange(T.bridge, k.ti) ? 1 : 0;
        k.hidden = T.inRange(T.tunnel, k.ti);
      }
      if (k.parts.engine.cond <= 0 && Math.random() < 0.3) race.parts.push({ x: k.x - fx * 14, y: k.y - fy * 14, vx: (Math.random() - 0.5) * 20, vy: -20, life: 0.9, c: "rgba(60,60,60,.7)", s: 4 });
    }
    /* bumps: every pair on the same level (the bridge's deck never touches the road under it) */
    for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
      const A2 = karts[i], B = karts[j]; if (A2.level !== B.level) continue;
      const dx = A2.x - B.x, dy = A2.y - B.y, dd = Math.hypot(dx, dy); if (dd >= 2 * R || dd === 0) continue;
      const nx = dx / dd, ny = dy / dd, SA = kartStats(A2.parts), SB = kartStats(B.parts), m = 2 * R - dd, ia = 1 / SA.mass, ib = 1 / SB.mass;
      A2.x += nx * m * ia / (ia + ib); A2.y += ny * m * ia / (ia + ib); B.x -= nx * m * ib / (ia + ib); B.y -= ny * m * ib / (ia + ib);
      const vrel = (A2.vx - B.vx) * nx + (A2.vy - B.vy) * ny; if (vrel >= 0) continue;
      const jimp = (-(1 + 0.85) * vrel) / (ia + ib);   /* bumper cars: very bouncy */
      A2.vx += jimp * ia * nx; A2.vy += jimp * ia * ny; B.vx -= jimp * ib * nx; B.vy -= jimp * ib * ny;
      A2.a += (Math.random() - 0.5) * jimp * 0.004; B.a += (Math.random() - 0.5) * jimp * 0.004;
      if (jimp > 40) {
        hurt(A2, jimp * 0.055 * SB.ram, B); hurt(B, jimp * 0.055 * SA.ram, A2); A2.hits++; B.hits++;
        spark({ x: (A2.x + B.x) / 2, y: (A2.y + B.y) / 2 }, nx, ny, jimp > 160 ? 14 : 7);
        if ((A2.me || B.me) && jimp > 160) race.shake = 0.18;
      }
    }
    for (const p of race.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
    race.parts = race.parts.filter((p) => p.life > 0);
    if (race.shake) race.shake = Math.max(0, race.shake - dt);
    const me = karts.find((k) => k.me);
    if (!T.arena && (me.done != null || race.t > 240) && !race.over) { if (!race.endAt) race.endAt = race.t + 1.2; if (race.t > race.endAt) finish(); }
    if (T.arena && race.t >= T.D.secs && !race.over) finish();
  }
  function spark(k, nx, ny, n = 6) { for (let i = 0; i < n; i++) race.parts.push({ x: k.x - nx * R, y: k.y - ny * R, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.35, c: Math.random() < 0.5 ? "#fff3a0" : "#ff9a2a", s: 2 }); }

  /* the house drivers: aim ahead on the racing line in their own lane, brake for the bends they can see coming, sometimes go looking for a bump */
  function drive(k, S) {
    if (race.t < k.backUntil) return { up: 0, down: 1, steer: -k.ai.steer || 1 };
    const sp = Math.hypot(k.vx, k.vy);
    k.stuck = sp < 25 ? k.stuck + 1 / 60 : 0;
    if (k.stuck > 1.2) { k.stuck = 0; k.backUntil = race.t + 0.7; return { up: 0, down: 1, steer: 1 }; }
    const prey = race.karts.filter((o) => o !== k && o.done == null && o.level === k.level).map((o) => ({ o, d: Math.hypot(o.x - k.x, o.y - k.y) })).sort((a, b) => a.d - b.d)[0];
    let tx, ty, slow = false;
    if (TR.arena) { if (prey) { tx = prey.o.x + prey.o.vx * 0.25; ty = prey.o.y + prey.o.vy * 0.25; } }
    else {
      const T = TR, look = Math.round(10 + sp / 25), i = (k.ti + look) % T.N, lane = k.rival.lane * T.hw * 0.55;
      tx = T.P[i][0] + T.Nr[i][0] * lane; ty = T.P[i][1] + T.Nr[i][1] * lane;
      const far = T.T[(k.ti + 28) % T.N], here = T.T[k.ti], bend = Math.acos(Math.max(-1, Math.min(1, far[0] * here[0] + far[1] * here[1])));
      slow = bend > 0.75 && sp > S.top * (1.05 - Math.min(0.5, (bend - 0.75) * 0.55));
      if (prey && prey.d < 110 && Math.random() < k.rival.aggro * 0.05) { const ah = angDiff(Math.atan2(prey.o.y - k.y, prey.o.x - k.x) - k.a); if (Math.abs(ah) < 0.7) { tx = prey.o.x; ty = prey.o.y; } }
    }
    if (tx == null) return { up: 1, down: 0, steer: 0 };
    const want = angDiff(Math.atan2(ty - k.y, tx - k.x) - k.a), steer = Math.max(-1, Math.min(1, want * 2.4));
    return { up: slow || (Math.abs(want) > 1.1 && sp > 150) ? 0 : 1, down: slow || (Math.abs(want) > 1.4 && sp > 180) ? 1 : 0, steer };
  }

  function standings() {
    const ks = [...race.karts];
    if (TR.arena) return ks.sort((a, b) => b.pts - a.pts);
    const prog = (k) => (k.done != null ? 1e7 - k.done : k.lap * TR.N + (k.started ? k.ti : k.ti - TR.N));
    return ks.sort((a, b) => prog(b) - prog(a));
  }
  function finish() {
    race.over = true;
    const S = standings(), pos = S.findIndex((k) => k.me) + 1, place = ["1st", "2nd", "3rd", "4th", "5th", "6th"][pos - 1];
    const roll = Math.random(), r = pos === 1 ? (roll < 0.25 ? "legend" : roll < 0.7 ? "racing" : "tuned") : pos <= 3 ? (roll < 0.08 ? "legend" : roll < 0.4 ? "racing" : "tuned") : roll < 0.2 ? "tuned" : "junk";
    const pool = Object.keys(CAT).filter((id) => CAT[id][1] === r), got = pool[Math.floor(Math.random() * pool.length)];
    G.stash.unshift(part(got)); G.scrap += 6 - Math.min(5, pos);
    const me = race.karts.find((k) => k.me);
    $("ovT").textContent = pos === 1 ? "🏆 You won!" : `You finished ${place}`;
    $("ovP").innerHTML = `Prize: <b>${CAT[got][2]}</b> <span class="rar ${r}">${RAR[r].n}</span> and ${6 - Math.min(5, pos)} scrap, in your stash.${me.broke.length ? ` You broke your ${me.broke.map((s) => SLOT[s].toLowerCase()).join(" and ")}: fix ${me.broke.length > 1 ? "them" : "it"} in the garage.` : ""}`;
    $("ovX").innerHTML = `<table>${S.map((k, i) => `<tr class="${k.me ? "me" : ""}"><td>${i + 1}.</td><td>${k.name}</td><td>${TR.arena ? k.pts + " pts" : k.done != null ? k.done.toFixed(2) + " s" : "DNF"}</td><td>${k.hits} bumps</td></tr>`).join("")}</table>`;
    $("go").textContent = "Race again"; $("over").hidden = false;
    say(`Prize: ${CAT[got][2]} (${RAR[r].n}).`, "good");
    renderGarage();
  }

  /* ---------------------------------------------------------------- PAINTING THE WORLD (once a track) */
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const THEME = { junk: { base: "#6b6243", dots: ["#5e5638", "#7a7050", "#4f4830"], run: "#9a8c6a", road: "#b98d5c", roadDots: ["#a87e50", "#c79c6a", "#9a7046"], line: null },
    green: { base: "#3d7a2f", dots: ["#356d28", "#4a8a38", "#2f6224"], run: "#c8b484", road: "#5a5b61", roadDots: ["#4e4f55", "#66676d", "#47484d"], line: "#e8e2d4" } };
  function strokePath(c, T, s, from = 0, to = T.N, close = true) { c.beginPath(); for (let i = from; i <= to; i++) { const [x, y] = T.P[i % T.N]; i === from ? c.moveTo(x * s, y * s) : c.lineTo(x * s, y * s); } if (close && from === 0 && to === T.N) c.closePath(); }
  function offsetPath(c, T, s, off) { c.beginPath(); for (let i = 0; i <= T.N; i++) { const j = i % T.N, x = T.P[j][0] + T.Nr[j][0] * off, y = T.P[j][1] + T.Nr[j][1] * off; i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s); } c.closePath(); }
  function paintWorld(T) {
    seed = T.key.length * 7919 + 13;
    const s = 0.5, lo = document.createElement("canvas"); lo.width = T.ww * s; lo.height = T.wh * s; const c = lo.getContext("2d"), th = THEME[T.D.theme];
    c.fillStyle = th.base; c.fillRect(0, 0, lo.width, lo.height);
    for (let i = 0; i < (lo.width * lo.height) / 18; i++) { c.fillStyle = th.dots[i % 3]; c.fillRect(Math.floor(rnd() * lo.width), Math.floor(rnd() * lo.height), 1, 1); }
    const decor = [];
    if (T.arena) {
      const rr = (b) => { const x = (CX - b.hx) * s, y = (CY - b.hy) * s, w = b.hx * 2 * s, h = b.hy * 2 * s, r = b.r * s; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
      c.save(); rr(OUT); c.clip(); c.fillStyle = th.road; c.fillRect(0, 0, lo.width, lo.height); for (let i = 0; i < 12000; i++) { c.fillStyle = th.roadDots[i % 3]; c.fillRect(Math.floor(rnd() * lo.width), Math.floor(rnd() * lo.height), 1, 1); } c.restore();
      c.lineWidth = 4; c.setLineDash([12, 12]); rr(OUT); c.strokeStyle = "#e8e2d4"; c.stroke(); c.lineDashOffset = 12; c.strokeStyle = "#c83a2a"; c.stroke(); c.setLineDash([]);
      for (const [x, y, r] of BOWL.oil) decor.push({ im: ART.oil1, x, y: y + 10, flat: true, w: r * 2.2 });
      for (const [x, y, r] of BOWL.posts) for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? "#2a2a2a" : "#1a1a1a"; c.beginPath(); c.arc(x * s, y * s - i * 3, r * s, 0, 7); c.fill(); }
      for (const [x, y] of [[60, 60], [900, 60], [60, 500], [900, 500]]) decor.push({ im: ART.barrel, x, y });
      return { lo, decor, mini: null };
    }
    c.lineJoin = "round"; c.lineCap = "round";
    /* gravel, kerbs, road (painted twice, the second pass the noise) */
    strokePath(c, T, s); c.strokeStyle = th.run; c.lineWidth = (T.hw + RUNOFF) * 2 * s; c.stroke();
    strokePath(c, T, s); c.lineWidth = (T.hw + 6) * 2 * s; c.setLineDash([10, 10]); c.strokeStyle = "#e8e2d4"; c.stroke(); c.lineDashOffset = 10; c.strokeStyle = "#c83a2a"; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
    strokePath(c, T, s); c.strokeStyle = th.road; c.lineWidth = T.hw * 2 * s; c.stroke();
    c.save(); strokePath(c, T, s); c.lineWidth = T.hw * 2 * s; c.strokeStyle = "#000"; c.globalCompositeOperation = "source-atop";
    for (let i = 0; i < T.N * 30; i++) { const j = Math.floor(rnd() * T.N), o = (rnd() - 0.5) * 2 * T.hw; c.fillStyle = th.roadDots[i % 3]; c.fillRect((T.P[j][0] + T.Nr[j][0] * o) * s + (rnd() - 0.5) * 6, (T.P[j][1] + T.Nr[j][1] * o) * s + (rnd() - 0.5) * 6, 1, 1); }
    c.restore();
    if (th.line) { strokePath(c, T, s); c.setLineDash([14, 14]); c.strokeStyle = th.line; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]); }
    /* tyre marks through the bends, the fence posts past the gravel */
    for (let i = 0; i < T.N; i += 2) { const bend = Math.abs(T.T[i][0] * T.T[(i + 8) % T.N][1] - T.T[i][1] * T.T[(i + 8) % T.N][0]); if (bend > 0.25 && rnd() < 0.5) { const o = (rnd() - 0.5) * T.hw; c.fillStyle = "rgba(30,20,10,.25)"; c.fillRect((T.P[i][0] + T.Nr[i][0] * o) * s, (T.P[i][1] + T.Nr[i][1] * o) * s, 4, 1.5); } }
    /* the fence: a post every 20 px along each side, but only where that post really is clear of the road (on the inside of a hairpin the
       offset line folds back across the track, and a fence drawn along it would cross the road) */
    const nearRoad = (x, y) => { let b = Infinity; for (let j = 0; j < T.N; j += 2) { const d = Math.hypot(x - T.P[j][0], y - T.P[j][1]); if (d < b) b = d; } return b; };
    for (const off of [T.hw + RUNOFF, -(T.hw + RUNOFF)]) for (let i = 0; i < T.N; i += 2) { const x = T.P[i][0] + T.Nr[i][0] * off, y = T.P[i][1] + T.Nr[i][1] * off; if (nearRoad(x, y) < T.hw + RUNOFF - 8) continue; c.fillStyle = i % 4 ? "#7a5a30" : "#3a2410"; c.fillRect(x * s - 1, y * s - 1, i % 4 ? 2 : 3, i % 4 ? 2 : 3); }
    /* the start line, across the road */
    { const [x, y] = T.P[0], [nx, ny] = T.Nr[0], [tx, ty] = T.T[0]; for (let k = -T.hw; k < T.hw; k += 8) for (let r = 0; r < 2; r++) { c.fillStyle = (Math.floor((k + T.hw) / 8) + r) % 2 ? "#1a1a1a" : "#f4f0e6"; c.fillRect((x + nx * k + tx * (r * 8 - 8)) * s - 2, (y + ny * k + ty * (r * 8 - 8)) * s - 2, 4, 4); } }
    /* the bridge's shadow on the road under it */
    if (T.bridge) { const [b0, b1] = T.bridge, mid = Math.round((b0 + b1) / 2); c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.arc(T.P[mid][0] * s, T.P[mid][1] * s + 6, T.hw * 0.9 * s, 0, 7); c.fill(); }
    /* boosts, painted on the road */
    for (const b of T.boost) { c.save(); c.translate(b.x * s, b.y * s); c.rotate(b.a); c.fillStyle = "#3a2a10"; c.fillRect(-17, -13, 34, 26); c.fillStyle = "#ffd030"; for (let i = 0; i < 3; i++) { const ox = -8 + i * 8; c.beginPath(); c.moveTo(ox + 5, 0); c.lineTo(ox - 3, -9); c.lineTo(ox - 3, -4); c.lineTo(ox, 0); c.lineTo(ox - 3, 4); c.lineTo(ox - 3, 9); c.closePath(); c.fill(); } c.restore(); }
    for (const o of T.oil) decor.push({ im: rnd() < 0.5 ? ART.oil1 : ART.oil2, x: o.x, y: o.y + 8, flat: true, w: 56 });
    /* scenery: out past the fence, never on any other part of the track */
    const clear = (x, y, m) => { for (let i = 0; i < T.N; i += 2) if (Math.hypot(x - T.P[i][0], y - T.P[i][1]) < T.hw + RUNOFF + m) return false; return x > 30 && y > 40 && x < T.ww - 30 && y < T.wh - 10; };
    const pool = ART[T.D.theme];
    for (let i = 0; i < T.N; i += 9) for (const side of [1, -1]) { if (rnd() < 0.6) continue; const off = side * (T.hw + RUNOFF + 40 + rnd() * 120), x = T.P[i][0] + T.Nr[i][0] * off, y = T.P[i][1] + T.Nr[i][1] * off; if (clear(x, y, 30)) decor.push({ im: pool[Math.floor(rnd() * pool.length)], x, y }); }
    for (let n = 0; n < 70; n++) { const x = rnd() * T.ww, y = rnd() * T.wh; if (clear(x, y, 140)) decor.push({ im: pool[Math.floor(rnd() * pool.length)], x, y }); }
    /* the grandstand by the line, on whichever side has room */
    for (const side of [-1, 1]) { const off = side * (T.hw + RUNOFF + 75), x = T.P[6][0] + T.Nr[6][0] * off, y = T.P[6][1] + T.Nr[6][1] * off; if (clear(x, y, 20)) { decor.push({ im: ART.stand, x, y: y + 30 }, { im: ART.board, x: x + 120, y: y + 20 }, { im: ART.snack, x: x - 120, y: y + 25 }); if (T.D.theme === "junk") decor.push({ im: ART.junkking, x: x + 200, y: y + 30 }); break; }   /* the Junk King watches from beside the stand */ }
    decor.sort((a, b) => a.y - b.y);
    const roof = T.tunnel ? paintRoof(T) : null, roofOk = ART.junk.every((im) => im.complete && im.naturalWidth);
    /* the minimap: the road, the tunnel darker, the bridge lighter */
    const mw = 190, ms = mw / T.ww, mini = document.createElement("canvas"); mini.width = mw; mini.height = Math.round(T.wh * ms); const m = mini.getContext("2d");
    m.lineJoin = m.lineCap = "round"; strokePath(m, T, ms); m.strokeStyle = "#e8dcc0"; m.lineWidth = Math.max(3, T.hw * 2 * ms); m.stroke();
    if (T.tunnel) { strokePath(m, T, ms, T.tunnel[0], T.tunnel[1], false); m.strokeStyle = "#5a4a3a"; m.stroke(); }
    if (T.bridge) { strokePath(m, T, ms, T.bridge[0], T.bridge[1], false); m.strokeStyle = "#c8a060"; m.stroke(); }
    m.fillStyle = "#fff"; m.fillRect(T.P[0][0] * ms - 1, T.P[0][1] * ms - 4, 3, 8);
    return { lo, decor, mini, ms, roof, roofOk };
  }

  /* ---------------------------------------------------------------- DRAWING (every frame) */
  function draw() {
    const T = TR; if (!layer) layer = paintWorld(T);
    const me = race?.karts.find((k) => k.me);
    if (me && !T.arena) {   /* follow, looking ahead the way you're going */
      const tx = me.x + me.vx * 0.45, ty = me.y + me.vy * 0.45; cam.x += (tx - cam.x) * 0.08; cam.y += (ty - cam.y) * 0.08;
    } else if (!race && !T.arena) { const [x, y] = T.P[Math.floor(performance.now() / 60) % T.N]; cam.x += (x - cam.x) * 0.02; cam.y += (y - cam.y) * 0.02; }
    if (T.arena) { cam.x = W / 2; cam.y = H / 2; }
    cam.x = Math.max(W / 2, Math.min(T.ww - W / 2, cam.x)); cam.y = Math.max(H / 2, Math.min(T.wh - H / 2, cam.y));
    const ox = Math.round(cam.x - W / 2), oy = Math.round(cam.y - H / 2);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (race?.shake && !matchMedia("(prefers-reduced-motion: reduce)").matches) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    ctx.drawImage(layer.lo, ox / 2, oy / 2, W / 2, H / 2, 0, 0, W, H);
    ctx.translate(-ox, -oy);
    const vis = (x, y, m = 120) => x > ox - m && x < ox + W + m && y > oy - m && y < oy + H + m;
    const ready = (im) => im && im.complete && im.naturalWidth;
    for (const d of layer.decor) if (d.flat && vis(d.x, d.y) && ready(d.im)) { const w = d.w, h = (w * d.im.naturalHeight) / d.im.naturalWidth; ctx.drawImage(d.im, d.x - w / 2, d.y - h / 2, w, h); }
    if (race) for (const p of race.parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1;
    /* the world in depth order: scenery and karts on the ground together, then the bridge deck, then karts on it, then the tunnel's roof */
    const ground = layer.decor.filter((d) => !d.flat && vis(d.x, d.y)).map((d) => ({ y: d.y, f: () => ready(d.im) && ctx.drawImage(d.im, d.x - d.im.naturalWidth / 2, d.y - d.im.naturalHeight + 8) }));
    const ks = race ? race.karts : [];
    for (const k of ks) if (k.level === 0 && vis(k.x, k.y)) ground.push({ y: k.y, f: () => drawKart(k) });
    ground.sort((a, b) => a.y - b.y).forEach((g) => g.f());
    if (T.bridge) drawDeck(T);
    for (const k of ks) if (k.level === 1 && vis(k.x, k.y)) drawKart(k, 1.08);
    if (layer.roof && !layer.roofOk && ART.junk.every((im) => im.complete && im.naturalWidth)) { layer.roof = paintRoof(T); layer.roofOk = true; }   /* the scrap on top arrived after the first paint */
    if (layer.roof) ctx.drawImage(layer.roof.c, layer.roof.x, layer.roof.y);
    if (me && me.hidden) { ctx.globalAlpha = 0.6; drawKart(me, 1, true); ctx.globalAlpha = 1; ctx.strokeStyle = "#ffd27a"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(me.x, me.y, 24 + Math.sin(performance.now() / 150) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }   /* you can still see yourself in the tunnel, just */
    if (!race && T.arena) ART.crowd.forEach((im, i) => ready(im) && ctx.drawImage(im, 360 + i * 40, 262 + (i % 2) * 18, 28, 28));
    ctx.restore();
    if (race) hud(); else if (!T.arena) miniMap();
  }
  function drawDeck(T) {
    const [b0, b1] = T.bridge, pts = []; for (let i = b0 - 2; i <= b1 + 2; i++) pts.push((i + T.N) % T.N);
    const line = (off) => { ctx.beginPath(); pts.forEach((j, n) => { const x = T.P[j][0] + T.Nr[j][0] * off, y = T.P[j][1] + T.Nr[j][1] * off; n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    line(0); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = T.hw * 2 + 30; ctx.stroke();
    line(0); ctx.strokeStyle = "#7a5530"; ctx.lineWidth = T.hw * 2 + 14; ctx.stroke();
    line(0); ctx.strokeStyle = "#9a6c3c"; ctx.lineWidth = T.hw * 2; ctx.setLineDash([3, 9]); ctx.stroke(); ctx.setLineDash([]);
    for (const off of [T.hw + 6, -(T.hw + 6)]) { line(off); ctx.strokeStyle = "#3a2410"; ctx.lineWidth = 5; ctx.stroke(); line(off); ctx.strokeStyle = "#c89a5a"; ctx.lineWidth = 2; ctx.stroke(); }
  }
  /** THE TUNNEL'S ROOF, painted once: a heap of scrap over the road, its texture clipped to the heap, a dark mouth at each end */
  function paintRoof(T) {
    const [a, b] = T.tunnel, pts = []; for (let i = a; i !== (b + 1) % T.N; i = (i + 1) % T.N) pts.push(i);
    const m = T.hw + 60, xs = pts.map((j) => T.P[j][0]), ys = pts.map((j) => T.P[j][1]), x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m;
    const c = document.createElement("canvas"); c.width = Math.max(...xs) + m - x0; c.height = Math.max(...ys) + m - y0; const o = c.getContext("2d"); o.imageSmoothingEnabled = false;
    const line = () => { o.beginPath(); pts.forEach((j, n) => (n ? o.lineTo(T.P[j][0] - x0, T.P[j][1] - y0) : o.moveTo(T.P[j][0] - x0, T.P[j][1] - y0))); };
    o.lineJoin = "round"; o.lineCap = "round";
    line(); o.strokeStyle = "rgba(0,0,0,.35)"; o.lineWidth = T.hw * 2 + 96; o.stroke();
    line(); o.strokeStyle = "#120e0a"; o.lineWidth = T.hw * 2 + 84; o.stroke();
    line(); o.strokeStyle = "#3a2a20"; o.lineWidth = T.hw * 2 + 76; o.stroke();
    line(); o.strokeStyle = "#4a3628"; o.lineWidth = T.hw * 2 + 50; o.stroke();
    o.save(); o.globalCompositeOperation = "source-atop"; for (let i = 0; i < c.width * c.height / 30; i++) { o.fillStyle = ["#5a3a24", "#8a4a22", "#6a6a70", "#2a2018", "#a05a28", "#4a4a50"][i % 6];   /* rust and old metal */ o.fillRect(Math.floor(rnd() * c.width), Math.floor(rnd() * c.height), 2 + (i % 3), 2); } o.restore();
    for (let n = 0; n < pts.length; n += 6) { const j = pts[n], im = ART.junk[n % ART.junk.length]; if (im.complete && im.naturalWidth) o.drawImage(im, T.P[j][0] - x0 - im.naturalWidth / 2 + ((n * 37) % 70) - 35, T.P[j][1] - y0 - im.naturalHeight / 2 + ((n * 53) % 60) - 30); }
    for (const e of [pts[0], pts[pts.length - 1]]) { const [x, y] = T.P[e], [nx, ny] = T.Nr[e]; o.strokeStyle = "#0e0c0a"; o.lineCap = "round"; o.lineWidth = 16; o.beginPath(); o.moveTo(x - x0 + nx * (T.hw + 4), y - y0 + ny * (T.hw + 4)); o.lineTo(x - x0 - nx * (T.hw + 4), y - y0 - ny * (T.hw + 4)); o.stroke(); o.strokeStyle = "#8a7a5a"; o.lineWidth = 3; o.stroke(); }
    return { c, x: x0, y: y0 };
  }
  function drawKart(k, scale = 1, ghost = false) {
    if (k.hidden && !ghost) return;
    ctx.save(); ctx.translate(k.x, k.y);
    if (!ghost) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(2 * scale, 6 * scale, (R + 2) * scale, (R - 4) * scale, 0, 0, 7); ctx.fill(); }
    ctx.rotate(k.a); ctx.scale(scale, scale);
    const im = ART.kart;
    if (im.complete && im.naturalWidth) { if (k.hue) ctx.filter = `hue-rotate(${k.hue}deg)`; ctx.drawImage(im, -22, -15, 44, 29); ctx.filter = "none"; }
    else { ctx.fillStyle = k.me ? "#c83a2a" : `hsl(${k.hue},60%,45%)`; ctx.fillRect(-16, -11, 32, 22); }
    if (race.t < k.boostUntil) { ctx.fillStyle = "#ffd030"; ctx.fillRect(-28, -3, 6, 6); }
    ctx.restore();
    if (ghost) return;
    ctx.font = "800 11px Lora, serif"; ctx.textAlign = "center";
    if (k.me) { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.moveTo(k.x, k.y - 22); ctx.lineTo(k.x - 6, k.y - 31); ctx.lineTo(k.x + 6, k.y - 31); ctx.fill(); }
    else { ctx.fillStyle = "rgba(0,0,0,.55)"; const w = ctx.measureText(k.name).width + 8; ctx.fillRect(k.x - w / 2, k.y - 36, w, 14); ctx.fillStyle = "#fff"; ctx.fillText(k.name, k.x, k.y - 25); }
    if (k.broke.length && !k.me) { ctx.fillStyle = "#ff6a3a"; ctx.fillText("💥".repeat(Math.min(3, k.broke.length)), k.x, k.y + 30); }
  }
  function miniMap() {
    if (!layer.mini) return;
    const m = layer.mini, x0 = W - m.width - 12, y0 = 12;
    ctx.fillStyle = "rgba(10,8,4,.7)"; ctx.fillRect(x0 - 6, y0 - 6, m.width + 12, m.height + 12); ctx.drawImage(m, x0, y0);
    ctx.strokeStyle = "rgba(255,210,122,.8)"; ctx.lineWidth = 1; ctx.strokeRect(x0 + (cam.x - W / 2) * layer.ms, y0 + (cam.y - H / 2) * layer.ms, W * layer.ms, H * layer.ms);
    if (race) for (const k of race.karts) { ctx.fillStyle = k.me ? "#ffd27a" : `hsl(${k.hue},70%,60%)`; const r = k.me ? 4 : 3; ctx.beginPath(); ctx.arc(x0 + k.x * layer.ms, y0 + k.y * layer.ms, r, 0, 7); ctx.fill(); if (k.me) { ctx.strokeStyle = "#000"; ctx.stroke(); } }
  }
  function hud() {
    const me = race.karts.find((k) => k.me), S = standings(), pos = S.indexOf(me) + 1;
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(10,8,4,.7)"; ctx.fillRect(10, 10, 230, 50); ctx.fillStyle = "#ffd27a"; ctx.font = "800 18px Lora, serif";
    ctx.fillText(TR.arena ? `${Math.max(0, Math.ceil(TR.D.secs - race.t))} s left` : `Lap ${Math.min(TR.D.laps, me.lap + 1)} / ${TR.D.laps}`, 20, 32);
    ctx.font = "700 13px Lora, serif"; ctx.fillStyle = "#f0e6cc"; ctx.fillText(TR.arena ? `${me.pts} points` : `${Math.max(0, race.t).toFixed(1)} s${me.hidden ? " · in the tunnel" : me.level ? " · on the bridge" : ""}`, 20, 52);
    ctx.fillStyle = "rgba(10,8,4,.7)"; ctx.fillRect(10, 66, 90, 46); ctx.fillStyle = "#ffd27a"; ctx.font = "800 28px Cinzel, serif"; ctx.fillText(["1st", "2nd", "3rd", "4th", "5th", "6th"][pos - 1], 20, 101);
    miniMap();
    ctx.textAlign = "center";
    if (race.t < 0) { ctx.font = "800 72px Cinzel, serif"; ctx.fillStyle = "#ffd27a"; ctx.strokeStyle = "#2a1a08"; ctx.lineWidth = 6; const n = String(Math.ceil(-race.t)); ctx.strokeText(n, W / 2, H / 2 + 24); ctx.fillText(n, W / 2, H / 2 + 24); }
    else if (race.t < 0.8) { ctx.font = "800 64px Cinzel, serif"; ctx.fillStyle = "#7ae05a"; ctx.strokeStyle = "#0a2a08"; ctx.lineWidth = 6; ctx.strokeText("GO!", W / 2, H / 2 + 22); ctx.fillText("GO!", W / 2, H / 2 + 22); }
    if (race.toast) { ctx.font = "800 22px Lora, serif"; const w = ctx.measureText(race.toast.t).width + 30; ctx.fillStyle = "rgba(10,8,4,.75)"; ctx.fillRect(W / 2 - w / 2, 70, w, 36); ctx.fillStyle = "#ffd27a"; ctx.fillText(race.toast.t, W / 2, 95); }
  }

  /* ---------------------------------------------------------------- THE LOOP */
  let last = 0, acc = 0;
  function frame(now) {
    if (!last) last = now; acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (race && !race.over) { while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; } renderCond(); } else acc = 0;
    draw(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => { last = 0; });

  /* ---------------------------------------------------------------- INPUT */
  const MAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "slide" };
  addEventListener("keydown", (e) => { if (!race || race.over) return; if (e.target.closest?.("input,select,textarea")) return; const k = MAP[e.code]; if (k) { keys[k] = true; e.preventDefault(); } if (e.code === "Escape") { race.over = true; $("ovT").textContent = "Stopped"; $("ovP").textContent = "Race stopped."; $("ovX").innerHTML = ""; $("over").hidden = false; } });
  addEventListener("keyup", (e) => { const k = MAP[e.code]; if (k) keys[k] = false; });
  addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
  for (const b of document.querySelectorAll("#pad button")) { const k = b.dataset.k; b.addEventListener("pointerdown", (e) => { keys[k] = true; b.setPointerCapture(e.pointerId); e.preventDefault(); }); for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => (keys[k] = false)); }
  $("go").addEventListener("click", start);
  const intro = () => { $("ovT").textContent = DEFS[mode].name; $("ovP").textContent = `${DEFS[mode].blurb} Arrow keys or WASD to drive, Space to slide.`; $("ovX").innerHTML = ""; $("go").textContent = "Start the race"; $("over").hidden = false; };
  $("modes").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.m; for (const x of $("modes").children) x.setAttribute("aria-pressed", x === b);
    race = null; TR = makeTrack(mode); layer = null; intro(); });
  intro();

  /* ---------------------------------------------------------------- GARAGE */
  const condCls = (c) => (c <= 0 ? "dead" : c < 30 ? "low" : "");
  const icon = (id) => `<img src="${ICON[CAT[id][0]]}" alt="" style="filter:${RAR[CAT[id][1]].tint}">`;
  function renderCond() {
    $("cond").innerHTML = SLOTS.map((s) => { const p = G.fit[s]; return `<div class="r">${icon(p.id)}<span><span class="k-note">${SLOT[s]}${p.cond <= 0 ? " · BROKEN" : ""}</span><span class="t" style="display:block"><i class="${condCls(p.cond)}" style="width:${p.cond}%"></i></span></span><b>${Math.round(p.cond)}%</b></div>`; }).join("");
    $("kSub").textContent = race && !race.over ? "racing" : "in the garage";
  }
  const cost = (p) => { const miss = 100 - p.cond; return { scrap: Math.ceil(miss / 5), gears: Math.ceil(miss / 25) }; };
  function renderGarage() {
    $("wallet").innerHTML = `<span><img src="/v3/assets/img/glad/flat/items/part_scrap.png" alt="" onerror="this.remove()">${G.scrap} scrap</span><span><img src="/v3/assets/img/glad/flat/items/part_gears.png" alt="" onerror="this.remove()">${G.gears} gears</span>`;
    $("slots").innerHTML = SLOTS.map((s) => { const p = G.fit[s], c = CAT[p.id], k = cost(p), can = p.cond < 100 && G.scrap >= k.scrap && G.gears >= k.gears;
      return `<div class="slot">${icon(p.id)}<div><small>${SLOT[s]}</small><b>${c[2]}<span class="rar ${c[1]}">${RAR[c[1]].n}</span></b><small>${statText(c[3])}</small><div class="t"><i class="${condCls(p.cond)}" style="width:${p.cond}%"></i></div><small>${p.cond <= 0 ? `<b style="color:#b0402a">Broken</b>: ${BREAKS[s].toLowerCase()}` : `${Math.round(p.cond)}% condition`}</small></div>
        <div class="acts"><button type="button" class="mini" data-rep="${s}" ${can ? "" : "disabled"}>${p.cond >= 100 ? "Like new" : `Repair · ${k.scrap} scrap, ${k.gears} gears`}</button></div></div>`; }).join("");
    $("stash").innerHTML = G.stash.length ? G.stash.map((p, i) => { const c = CAT[p.id]; return `<div class="slot">${icon(p.id)}<div><small>${SLOT[c[0]]}</small><b>${c[2]}<span class="rar ${c[1]}">${RAR[c[1]].n}</span></b><small>${statText(c[3])}</small><div class="t"><i class="${condCls(p.cond)}" style="width:${p.cond}%"></i></div></div>
        <div class="acts"><button type="button" class="mini" data-fit="${i}">Fit (swap out the ${CAT[G.fit[c[0]].id][2].toLowerCase()})</button><button type="button" class="mini" data-scrap="${i}">Scrap it · +${{ junk: 2, tuned: 4, racing: 8, legend: 15 }[c[1]]} scrap</button></div></div>`; }).join("") : `<p class="k-note">Empty. Race to find parts.</p>`;
    $("stashN").textContent = `${G.stash.length} parts`;
    const S = kartStats(G.fit, G.gear), bars = [["Top speed", S.top, 380], ["Acceleration", S.acc, 380], ["Grip", S.grip, 8.2], ["Turning", S.turn, 3.8], ["Weight", S.mass, 1.8], ["Ram", S.ram, 1.6]];
    $("stats").innerHTML = bars.map(([n, v, m]) => `<div class="r"><span>${n}</span><span class="t"><i style="width:${Math.min(100, (v / m) * 100)}%"></i></span><b>${v >= 10 ? Math.round(v) : v.toFixed(1)}</b></div>`).join("");
    renderCond();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rep],button[data-fit],button[data-scrap]"); if (!b) return;
    if (race && !race.over) return;
    if (b.dataset.rep) { const p = G.fit[b.dataset.rep], k = cost(p); G.scrap -= k.scrap; G.gears -= k.gears; p.cond = 100; }
    if (b.dataset.fit) { const i = +b.dataset.fit, p = G.stash[i], s = CAT[p.id][0]; G.stash[i] = G.fit[s]; G.fit[s] = p; }
    if (b.dataset.scrap) { const i = +b.dataset.scrap, p = G.stash.splice(i, 1)[0]; G.scrap += { junk: 2, tuned: 4, racing: 8, legend: 15 }[CAT[p.id][1]]; G.gears += CAT[p.id][1] === "legend" ? 3 : CAT[p.id][1] === "racing" ? 1 : 0; }
    renderGarage();
  });
  $("gear").addEventListener("input", (e) => { G.gear = +e.target.value; renderGarage(); });
  $("ptable").innerHTML = SLOTS.map((s) => { const by = (r) => Object.entries(CAT).find(([, c]) => c[0] === s && c[1] === r); const cell = (r) => { const [, c] = by(r); return `${c[2]}<br><span class="note">${statText(c[3])}</span>`; };
    return `<tr><td><img src="${ICON[s]}" alt="" style="width:26px;height:26px;image-rendering:pixelated;vertical-align:middle;margin-right:6px">${SLOT[s]}</td><td>${DOES[s]}</td><td>${cell("junk")}</td><td>${cell("tuned")}</td><td>${cell("racing")}</td><td>${cell("legend")}</td><td>${BREAKS[s]}</td></tr>`; }).join("");
  renderGarage();
  window.SOAPBOX = { G, kartStats, start, get race() { return race; }, get track() { return TR; }, step, keys, standings, setMode: (m) => { mode = m; TR = makeTrack(m); layer = null; }, snap: () => { const me = race?.karts.find((k) => k.me); if (me) { cam.x = me.x; cam.y = me.y; } } };   /* for checking */
})();

/* SOAPBOX RACING, the playable prototype (2026-10-02). Top-down arcade physics at a fixed 60 steps a second: a kart is a circle with a heading;
   its speed along the heading comes from the engine, its sideways slide is bled off by the wheels' grip, and two karts that touch exchange an
   impulse (bumper cars: very bouncy) scaled by their frames' mass, which also wears their parts. A part at 0 condition BREAKS and does a
   fraction of its job. The kart you drive is whatever the garage has fitted, worn parts and all. */
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

  /* ---------------------------------------------------------------- THE TRACK */
  const W = 960, H = 560, CX = 480, CY = 280, R = 15;
  const OUT = { hx: 450, hy: 262, r: 175 }, IN = { hx: 255, hy: 82, r: 82 };
  const sdRR = (x, y, b) => { const qx = Math.abs(x - CX) - b.hx + b.r, qy = Math.abs(y - CY) - b.hy + b.r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r; };
  const grad = (x, y, b) => { const e = 0.5, gx = sdRR(x + e, y, b) - sdRR(x - e, y, b), gy = sdRR(x, y + e, b) - sdRR(x, y - e, b), l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l]; };
  const N = 40, WP = [];
  for (let i = 0; i < N; i++) { const t = Math.PI / 2 - (i * 2 * Math.PI) / N, c = Math.cos(t), s = Math.sin(t); WP.push([CX + 352 * Math.sign(c) * Math.sqrt(Math.abs(c)), CY + 172 * Math.sign(s) * Math.sqrt(Math.abs(s))]); }
  const TRACKS = {
    circuit: { inner: true, oil: [[330, 108, 26], [700, 452, 24]], boost: [[560, 108, -1]], posts: [], laps: 3 },
    bash: { inner: false, oil: [[300, 380, 30], [690, 170, 28]], boost: [], posts: [[480, 280, 34], [290, 170, 26], [670, 390, 26]], secs: 60 } };

  /* ---------------------------------------------------------------- ART */
  const ART = { kart: IMG("kart_top.png"), cones: IMG(FLAT + "o_cones.png"), barrel: IMG(FLAT + "o_barrel.png"), crowd: ["pet_ferret", "pet_owlet", "pet_lilcrusher", "pet_grinling", "pet_cointoad", "pet_raptor", "pet_starling"].map((k) => IMG(FLAT + k + ".png")) };
  const RIVALS = [
    { name: "Wet Paint", hue: 200, fit: { engine: "moped", wheels: "pram", frame: "fridge", steer: "arcade", bumper: "tyre" }, lane: -40, aggro: 0.2 },
    { name: "Lucky Lou", hue: 100, fit: { engine: "lawnmower", wheels: "slicks", frame: "cage", steer: "ships", bumper: "noodle" }, lane: 30, aggro: 0.1 },
    { name: "Big Chungo", hue: 280, fit: { engine: "moped", wheels: "trolley", frame: "hearse", steer: "buswheel", bumper: "plough" }, lane: 0, aggro: 0.8 },
    { name: "Brenda", hue: 320, fit: { engine: "leafblower", wheels: "pram", frame: "bathtub", steer: "arcade", bumper: "hazard" }, lane: 45, aggro: 0.4 },
    { name: "The Accountant", hue: 50, fit: { engine: "moped", wheels: "pram", frame: "bathtub", steer: "arcade", bumper: "tyre" }, lane: -20, aggro: 0.3 }];

  /* ---------------------------------------------------------------- THE RACE */
  const cv = $("cv"), ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  let mode = "circuit", race = null, staticLayer = null;
  const keys = { up: false, down: false, left: false, right: false, slide: false };
  const angDiff = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  function newKart(name, fit, x, y, me, hue, rival) {
    const parts = {}; for (const s of SLOTS) parts[s] = me ? G.fit[s] : part(fit[s]);
    return { name, me, hue, rival, parts, x, y, a: 0, vx: 0, vy: 0, wp: 0, lap: 0, started: false, done: null, oilUntil: 0, boostUntil: 0, stuck: 0, backUntil: 0, pts: 0, hits: 0, broke: [], ai: { steer: 0 } };
  }
  function start() {
    const T = TRACKS[mode], karts = [];
    const grid = mode === "circuit" ? [[430, 392], [430, 446], [430, 500], [370, 392], [370, 446], [370, 500]] : [[200, 280], [760, 280], [480, 90], [480, 470], [250, 460], [710, 100]];
    const order = [0, 1, 2, 3, 4, 5], meAt = mode === "circuit" ? 4 : 0;
    let r = 0;
    order.forEach((slot) => { const [x, y] = grid[slot];
      if (slot === meAt) karts.push(newKart("You", null, x, y, true, 0));
      else { const rv = RIVALS[r++]; karts.push(newKart(rv.name, rv.fit, x, y, false, rv.hue, rv)); } });
    if (mode === "bash") karts.forEach((k) => (k.a = Math.atan2(CY - k.y, CX - k.x)));
    race = { T, karts, t: -3, over: false, log: [], toast: null, parts: [], start: performance.now() };
    staticLayer = drawStatic(T);
    $("over").hidden = true; cv.focus(); logClear(); say(mode === "circuit" ? "Three laps. Bumping allowed." : "Sixty seconds. Hit everything.", "");
  }
  function say(t, cls) { const L = $("log"); if (L.querySelector(".note")) L.innerHTML = ""; const p = document.createElement("p"); p.className = cls || ""; p.textContent = t; L.prepend(p); }
  function logClear() { $("log").innerHTML = ""; }
  function toast(t) { race.toast = { t, until: race.t + 1.6 }; }

  const ROLE = ["bumper", "frame", "wheels", "steer", "engine"];
  function hurt(k, amount, by) {
    const S = kartStats(k.parts);
    let left = (amount * (mode === "bash" ? 0.6 : 1)) / S.armor;   /* the arena is all bumps: they count for less, or a minute wrecks a kart */
    const B = k.parts.bumper;
    if (B.cond > 0) { const take = left * S.absorb; wear(k, "bumper", take, by); left -= take; }
    else left *= 1.5;   /* no bumper: the hit goes into the kart */
    if (left > 0.5) { const s = ROLE[1 + Math.floor(Math.random() * 4)]; wear(k, s, left, by); }
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

  function step(dt) {
    const T = race.T, karts = race.karts; race.t += dt;
    if (race.t < 0) return;
    if (race.toast && race.t > race.toast.until) race.toast = null;
    for (const k of karts) {
      const S = kartStats(k.parts, k.me ? G.gear : 0);
      let up = 0, down = 0, steer = 0, slide = false;
      if (k.done != null) { up = 0; down = 1; }
      else if (k.me) { up = keys.up ? 1 : 0; down = keys.down ? 1 : 0; steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); slide = keys.slide; }
      else Object.assign(k.ai, drive(k, S)), ({ up, down, steer } = k.ai);
      const fx = Math.cos(k.a), fy = Math.sin(k.a), rx = -fy, ry = fx;
      let vf = k.vx * fx + k.vy * fy, vl = k.vx * rx + k.vy * ry;
      const boosting = race.t < k.boostUntil;
      if (up) vf += S.acc * dt * (vf < 0 ? 2 : 1);
      if (down) vf -= (vf > 0 ? 520 : S.acc * 0.6) * dt;
      if (!up && !down) vf *= 1 - 0.7 * dt;
      const top = S.top * (boosting ? 1.4 : 1);
      if (vf > top) vf += (top - vf) * Math.min(1, 3 * dt);
      if (vf < -S.top * 0.35) vf = -S.top * 0.35;
      const grip = S.grip * (race.t < k.oilUntil ? 0.15 : 1) * (slide ? 0.3 : 1);
      vl *= Math.max(0, 1 - grip * dt);
      const sp = Math.min(1, Math.abs(vf) / 110);
      k.a += (S.turn * steer * sp * Math.sign(vf || 1) + S.pull * sp) * dt;
      k.vx = fx * vf + rx * vl; k.vy = fy * vf + ry * vl;
      k.x += k.vx * dt; k.y += k.vy * dt;
      /* walls */
      const so = sdRR(k.x, k.y, OUT) + R;
      if (so > 0) { const [nx, ny] = grad(k.x, k.y, OUT); k.x -= nx * so; k.y -= ny * so; const vn = k.vx * nx + k.vy * ny; if (vn > 0) { k.vx -= 1.4 * vn * nx; k.vy -= 1.4 * vn * ny; if (vn > 120) { hurt(k, vn * 0.03); spark(k, nx, ny); } } }
      if (T.inner) { const si = R - sdRR(k.x, k.y, IN); if (si > 0) { const [nx, ny] = grad(k.x, k.y, IN); k.x += nx * si; k.y += ny * si; const vn = k.vx * nx + k.vy * ny; if (vn < 0) { k.vx -= 1.4 * vn * nx; k.vy -= 1.4 * vn * ny; if (-vn > 120) { hurt(k, -vn * 0.03); spark(k, -nx, -ny); } } } }
      for (const [px, py, pr] of T.posts) { const dx = k.x - px, dy = k.y - py, d = Math.hypot(dx, dy), m = pr + R - d; if (m > 0) { const nx = dx / (d || 1), ny = dy / (d || 1); k.x += nx * m; k.y += ny * m; const vn = k.vx * nx + k.vy * ny; if (vn < 0) { k.vx -= 1.5 * vn * nx; k.vy -= 1.5 * vn * ny; if (-vn > 120) { hurt(k, -vn * 0.03); spark(k, -nx, -ny); } } } }
      for (const [ox, oy, orr] of T.oil) if (Math.hypot(k.x - ox, k.y - oy) < orr) { if (k.me && race.t > k.oilUntil) toast("Oil!"); k.oilUntil = race.t + 0.9; }
      for (const [bx, by, dir] of T.boost) if (Math.abs(k.x - bx) < 34 && Math.abs(k.y - by) < 26 && Math.cos(k.a) * dir > 0.3) k.boostUntil = race.t + 0.7;
      if (k.parts.engine.cond <= 0 && Math.random() < 0.3) race.parts.push({ x: k.x - fx * 14, y: k.y - fy * 14, vx: (Math.random() - 0.5) * 20, vy: -20, life: 0.9, c: "rgba(60,60,60,.7)", s: 4 });
      /* laps */
      if (mode === "circuit" && k.done == null) {
        const [wx, wy] = WP[k.wp], d = Math.hypot(k.x - wx, k.y - wy), [ax, ay] = WP[(k.wp + N - 1) % N], [bx, by] = WP[(k.wp + 1) % N], past = (k.x - wx) * (bx - ax) + (k.y - wy) * (by - ay) > 0;
        if (d < 95 || (past && d < 170)) {
          if (k.wp === 0) { if (k.started) { k.lap++; for (const s of SLOTS) wear(k, s, 1.5); if (k.me && k.lap < T.laps) toast(`Lap ${k.lap + 1} of ${T.laps}`); } k.started = true; }
          k.wp = (k.wp + 1) % N;
          if (k.lap >= T.laps) { k.done = race.t; if (k.me) say(`🏁 You finished in ${race.t.toFixed(2)} s.`, "good"); }
        }
      }
    }
    /* bumps: every pair */
    for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
      const A = karts[i], B = karts[j], dx = A.x - B.x, dy = A.y - B.y, d = Math.hypot(dx, dy); if (d >= 2 * R || d === 0) continue;
      const nx = dx / d, ny = dy / d, SA = kartStats(A.parts), SB = kartStats(B.parts), m = 2 * R - d, ia = 1 / SA.mass, ib = 1 / SB.mass;
      A.x += nx * m * ia / (ia + ib); A.y += ny * m * ia / (ia + ib); B.x -= nx * m * ib / (ia + ib); B.y -= ny * m * ib / (ia + ib);
      const vrel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny; if (vrel >= 0) continue;
      const jimp = (-(1 + 0.85) * vrel) / (ia + ib);   /* bumper cars: very bouncy */
      A.vx += jimp * ia * nx; A.vy += jimp * ia * ny; B.vx -= jimp * ib * nx; B.vy -= jimp * ib * ny;
      A.a += (Math.random() - 0.5) * jimp * 0.004; B.a += (Math.random() - 0.5) * jimp * 0.004;
      if (jimp > 40) {
        hurt(A, jimp * 0.055 * SB.ram, B); hurt(B, jimp * 0.055 * SA.ram, A); A.hits++; B.hits++;
        spark({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, nx, ny, jimp > 160 ? 14 : 7);
        if ((A.me || B.me) && jimp > 160) race.shake = 0.18;
      }
    }
    for (const p of race.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
    race.parts = race.parts.filter((p) => p.life > 0);
    if (race.shake) race.shake = Math.max(0, race.shake - dt);
    /* the end */
    const me = karts.find((k) => k.me);
    if (mode === "circuit" && (me.done != null || race.t > 150) && !race.over) { if (!race.endAt) race.endAt = race.t + 1.2; if (race.t > race.endAt) finish(); }
    if (mode === "bash" && race.t >= T.secs && !race.over) finish();
  }
  function spark(k, nx, ny, n = 6) { for (let i = 0; i < n; i++) race.parts.push({ x: k.x - nx * R, y: k.y - ny * R, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.35, c: Math.random() < 0.5 ? "#fff3a0" : "#ff9a2a", s: 2 }); }

  /* the house drivers: aim a little ahead on the racing line (in their own lane), slow for sharp bends, and sometimes go looking for a bump */
  function drive(k, S) {
    if (race.t < k.backUntil) return { up: 0, down: 1, steer: -k.ai.steer || 1 };
    const sp = Math.hypot(k.vx, k.vy);
    k.stuck = sp < 25 ? k.stuck + 1 / 60 : 0;
    if (k.stuck > 1.2) { k.stuck = 0; k.backUntil = race.t + 0.7; return { up: 0, down: 1, steer: 1 }; }
    let tx, ty;
    const prey = race.karts.filter((o) => o !== k && o.done == null).map((o) => ({ o, d: Math.hypot(o.x - k.x, o.y - k.y) })).sort((a, b) => a.d - b.d)[0];
    if (mode === "bash") { if (prey) { tx = prey.o.x + prey.o.vx * 0.25; ty = prey.o.y + prey.o.vy * 0.25; } }
    else {
      const i = (k.wp + 1) % N, [wx, wy] = WP[i], [nx2, ny2] = WP[(i + 1) % N], tl = Math.hypot(nx2 - wx, ny2 - wy) || 1, px = -(ny2 - wy) / tl, py = (nx2 - wx) / tl;
      tx = wx + px * k.rival.lane; ty = wy + py * k.rival.lane;
      if (prey && prey.d < 110 && Math.random() < k.rival.aggro * 0.05) { const ah = angDiff(Math.atan2(prey.o.y - k.y, prey.o.x - k.x) - k.a); if (Math.abs(ah) < 0.7) { tx = prey.o.x; ty = prey.o.y; } }
    }
    if (tx == null) return { up: 1, down: 0, steer: 0 };
    const want = angDiff(Math.atan2(ty - k.y, tx - k.x) - k.a), steer = Math.max(-1, Math.min(1, want * 2.4));
    return { up: Math.abs(want) > 1.1 && sp > 150 ? 0 : 1, down: Math.abs(want) > 1.4 && sp > 180 ? 1 : 0, steer };
  }

  function standings() {
    const ks = [...race.karts];
    if (mode === "bash") return ks.sort((a, b) => b.pts - a.pts);
    const prog = (k) => (k.done != null ? 1e6 - k.done : k.lap * N + (k.started ? k.wp : 0) - Math.hypot(k.x - WP[k.wp][0], k.y - WP[k.wp][1]) / 1000);
    return ks.sort((a, b) => prog(b) - prog(a));
  }
  function finish() {
    race.over = true;
    const S = standings(), pos = S.findIndex((k) => k.me) + 1;
    /* a prize part: better odds on the podium */
    const roll = Math.random(), r = pos === 1 ? (roll < 0.25 ? "legend" : roll < 0.7 ? "racing" : "tuned") : pos <= 3 ? (roll < 0.08 ? "legend" : roll < 0.4 ? "racing" : "tuned") : roll < 0.2 ? "tuned" : "junk";
    const pool = Object.keys(CAT).filter((id) => CAT[id][1] === r), got = pool[Math.floor(Math.random() * pool.length)];
    G.stash.unshift(part(got)); G.scrap += 6 - Math.min(5, pos);
    const me = race.karts.find((k) => k.me);
    $("ovT").textContent = mode === "circuit" ? (pos === 1 ? "🏆 You won!" : `You finished ${["1st", "2nd", "3rd", "4th", "5th", "6th"][pos - 1]}`) : pos === 1 ? "🏆 Last kart standing proud" : `Bumper Bash: ${["1st", "2nd", "3rd", "4th", "5th", "6th"][pos - 1]}`;
    $("ovP").innerHTML = `Prize: <b>${CAT[got][2]}</b> <span class="rar ${r}">${RAR[r].n}</span> and ${6 - Math.min(5, pos)} scrap, in your stash.${me.broke.length ? ` You broke your ${me.broke.map((s) => SLOT[s].toLowerCase()).join(" and ")}: fix ${me.broke.length > 1 ? "them" : "it"} in the garage.` : ""}`;
    $("ovX").innerHTML = `<table>${S.map((k, i) => `<tr class="${k.me ? "me" : ""}"><td>${i + 1}.</td><td>${k.name}</td><td>${mode === "circuit" ? (k.done != null ? k.done.toFixed(2) + " s" : "DNF") : k.pts + " pts"}</td><td>${k.hits} bumps</td></tr>`).join("")}</table>`;
    $("go").textContent = "Race again"; $("over").hidden = false;
    say(`Prize: ${CAT[got][2]} (${RAR[r].n}).`, "good");
    renderGarage();
  }

  /* ---------------------------------------------------------------- DRAWING */
  function rrPath(c, b, s = 1) { const x = (CX - b.hx) * s, y = (CY - b.hy) * s, w = b.hx * 2 * s, h = b.hy * 2 * s, r = b.r * s; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function noise(c, w, h, cols, n) { for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1); } }
  function drawStatic(T) {
    /* painted at half size and drawn back up, so the ground is chunky pixels like the game's */
    const lo = document.createElement("canvas"); lo.width = W / 2; lo.height = H / 2; const c = lo.getContext("2d"), s = 0.5;
    c.fillStyle = "#3d7a2f"; c.fillRect(0, 0, W, H); noise(c, W / 2, H / 2, ["#356d28", "#4a8a38", "#2f6224"], 9000);
    c.save(); rrPath(c, OUT, s); c.clip(); c.fillStyle = "#b98d5c"; c.fillRect(0, 0, W, H); noise(c, W / 2, H / 2, ["#a87e50", "#c79c6a", "#9a7046"], 11000); c.restore();
    c.lineWidth = 4; c.setLineDash([12, 12]); rrPath(c, OUT, s); c.strokeStyle = "#e8e2d4"; c.stroke(); c.lineDashOffset = 12; c.strokeStyle = "#c83a2a"; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
    if (T.inner) {
      c.save(); rrPath(c, IN, s); c.clip(); c.fillStyle = "#3d7a2f"; c.fillRect(0, 0, W, H); noise(c, W / 2, H / 2, ["#356d28", "#4a8a38"], 3000); c.restore();
      c.lineWidth = 4; c.setLineDash([12, 12]); rrPath(c, IN, s); c.strokeStyle = "#e8e2d4"; c.stroke(); c.lineDashOffset = 12; c.strokeStyle = "#c83a2a"; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
      for (let y = (CY + IN.hy) * s; y < (CY + OUT.hy) * s; y += 6) for (let i = 0; i < 2; i++) { c.fillStyle = ((y / 6) + i) % 2 < 1 ? "#f4f0e6" : "#1a1a1a"; c.fillRect(CX * s - 6 + i * 6, y, 6, 6); }
    }
    for (let i = 0; i < 60; i++) { const k = Math.floor(Math.random() * N), [x, y] = WP[k]; c.fillStyle = "rgba(60,40,20,.35)"; c.fillRect(x * s + (Math.random() - 0.5) * 60, y * s + (Math.random() - 0.5) * 60, 6, 1); }
    for (const [x, y, r] of T.oil) { c.fillStyle = "#1a1612"; c.beginPath(); c.ellipse(x * s, y * s, r * s, r * s * 0.7, 0.3, 0, 7); c.fill(); c.fillStyle = "rgba(120,90,200,.45)"; c.fillRect(x * s - 4, y * s - 2, 5, 1); c.fillRect(x * s + 2, y * s + 2, 4, 1); }
    for (const [x, y, d] of T.boost) { c.fillStyle = "#3a2a10"; c.fillRect(x * s - 17, y * s - 13, 34, 26); c.fillStyle = "#ffd030"; for (let i = 0; i < 3; i++) { const ox = x * s + d * (-8 + i * 8); c.beginPath(); c.moveTo(ox + d * 5, y * s); c.lineTo(ox - d * 3, y * s - 9); c.lineTo(ox - d * 3, y * s - 4); c.lineTo(ox, y * s); c.lineTo(ox - d * 3, y * s + 4); c.lineTo(ox - d * 3, y * s + 9); c.closePath(); c.fill(); } }
    for (const [x, y, r] of T.posts) { for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? "#2a2a2a" : "#1a1a1a"; c.beginPath(); c.arc(x * s, y * s - i * 3, r * s, 0, 7); c.fill(); } c.fillStyle = "#c83a2a"; c.fillRect(x * s - r * s, y * s - 7, r * s * 2, 2); }
    return lo;
  }
  function draw() {
    const T = race ? race.T : TRACKS[mode];
    if (!staticLayer) staticLayer = drawStatic(T);
    ctx.save();
    if (race?.shake && !matchMedia("(prefers-reduced-motion: reduce)").matches) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(staticLayer, 0, 0, W, H);
    /* the crowd and the props, in the infield (or around the arena) */
    const props = T.inner ? [[330, 255, "cones"], [630, 255, "cones"], [400, 300, "barrel"], [560, 300, "barrel"]] : [[60, 60, "barrel"], [900, 60, "barrel"], [60, 500, "barrel"], [900, 500, "barrel"]];
    for (const [x, y, k] of props) { const im = ART[k]; if (im.complete && im.naturalWidth) ctx.drawImage(im, x - im.naturalWidth / 4, y - im.naturalHeight / 2, im.naturalWidth / 2, im.naturalHeight / 2); }
    if (T.inner) ART.crowd.forEach((im, i) => { if (im.complete && im.naturalWidth) { const x = 360 + i * 40, y = 268 + (i % 2) * 18 + Math.sin(performance.now() / 300 + i) * 1.5; ctx.drawImage(im, x - 14, y - 14, 28, 28); } });
    if (race) {
      for (const p of race.parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1;
      for (const k of [...race.karts].sort((a, b) => a.y - b.y)) drawKart(k);
      hud();
    }
    ctx.restore();
  }
  function drawKart(k) {
    ctx.save(); ctx.translate(k.x, k.y);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(2, 6, R + 2, R - 4, 0, 0, 7); ctx.fill();
    ctx.rotate(k.a);
    const im = ART.kart;
    if (im.complete && im.naturalWidth) { if (k.hue) ctx.filter = `hue-rotate(${k.hue}deg)`; ctx.drawImage(im, -22, -15, 44, 29); ctx.filter = "none"; }
    else { ctx.fillStyle = k.me ? "#c83a2a" : `hsl(${k.hue},60%,45%)`; ctx.fillRect(-16, -11, 32, 22); }
    if (race.t < k.boostUntil) { ctx.fillStyle = "#ffd030"; ctx.fillRect(-26, -3, 6, 6); }
    ctx.restore();
    ctx.font = "800 11px Lora, serif"; ctx.textAlign = "center";
    if (k.me) { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.moveTo(k.x, k.y - 22); ctx.lineTo(k.x - 6, k.y - 31); ctx.lineTo(k.x + 6, k.y - 31); ctx.fill(); }
    else { ctx.fillStyle = "rgba(0,0,0,.55)"; const w = ctx.measureText(k.name).width + 8; ctx.fillRect(k.x - w / 2, k.y - 36, w, 14); ctx.fillStyle = "#fff"; ctx.fillText(k.name, k.x, k.y - 25); }
    if (k.broke.length && !k.me) { ctx.fillStyle = "#ff6a3a"; ctx.fillText("💥".repeat(Math.min(3, k.broke.length)), k.x, k.y + 30); }
  }
  function hud() {
    const me = race.karts.find((k) => k.me), S = standings(), pos = S.indexOf(me) + 1;
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(10,8,4,.7)"; ctx.fillRect(10, 10, 210, 50); ctx.fillStyle = "#ffd27a"; ctx.font = "800 18px Lora, serif";
    ctx.fillText(mode === "circuit" ? `Lap ${Math.min(race.T.laps, me.lap + 1)} / ${race.T.laps}` : `${Math.max(0, Math.ceil(race.T.secs - race.t))} s left`, 20, 32);
    ctx.font = "700 13px Lora, serif"; ctx.fillStyle = "#f0e6cc"; ctx.fillText(mode === "circuit" ? `${Math.max(0, race.t).toFixed(1)} s` : `${me.pts} points`, 20, 52);
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(10,8,4,.7)"; ctx.fillRect(W - 110, 10, 100, 50); ctx.fillStyle = "#ffd27a"; ctx.font = "800 28px Cinzel, serif"; ctx.fillText(["1st", "2nd", "3rd", "4th", "5th", "6th"][pos - 1], W - 20, 46);
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
  $("modes").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.m; for (const x of $("modes").children) x.setAttribute("aria-pressed", x === b);
    race = null; staticLayer = null; $("ovT").textContent = mode === "circuit" ? "Soapbox Circuit" : "Bumper Bash"; $("ovP").textContent = mode === "circuit" ? "Three laps, six karts, bumping allowed. Arrow keys or WASD to drive, Space to slide." : "Sixty seconds in the arena. Points for every hit, fifty more for every part you break."; $("ovX").innerHTML = ""; $("go").textContent = "Start"; $("over").hidden = false; });

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
  /* the parts table, from the same catalogue the race uses */
  $("ptable").innerHTML = SLOTS.map((s) => { const by = (r) => Object.entries(CAT).find(([, c]) => c[0] === s && c[1] === r); const cell = (r) => { const [, c] = by(r); return `${c[2]}<br><span class="note">${statText(c[3])}</span>`; };
    return `<tr><td><img src="${ICON[s]}" alt="" style="width:26px;height:26px;image-rendering:pixelated;vertical-align:middle;margin-right:6px">${SLOT[s]}</td><td>${DOES[s]}</td><td>${cell("junk")}</td><td>${cell("tuned")}</td><td>${cell("racing")}</td><td>${cell("legend")}</td><td>${BREAKS[s]}</td></tr>`; }).join("");
  renderGarage();
  window.SOAPBOX = { G, kartStats, start, get race() { return race; }, step, keys, standings };   /* for checking */
})();

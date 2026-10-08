/* The lounge's extra rooms (2026-10-07 mockup, the owner: "mock up the bar games corner and the patio pond").

   THE BAR GAMES CORNER, through an open arch in the lounge's south-east wall: two skee-ball lanes (PvE: free, pays tickets), darts and beer
   pong (PvP: staked in tickets, here against a bot), and a shuffleboard that's out of order.
   THE PATIO, through the lounge's east wall: a night garden with string lights, a fire pit, fireflies, and a pond with a dock. Fishing is
   PvE and pays tickets; the biggest catches go on the board by the dock.

   Every game here is a MODE: walk up, press E, and it takes the camera and the controls until you leave (Q, or the Leave button). The games
   are played in the page for the mockup; on the site the room server would deal the noise (the seeded scatter of a throw, the bite, the
   fish) so a result can't be made up, the way it runs air hockey. Tickets come from and go to the lounge's preview wallet.

   buildExtras(ctx) -> { spots, step(dt, t), cam(pos, look), active(), key(e, down), pointer(type, e) }  (see lounge.js) */
export function buildExtras(ctx) {
  const { THREE, scene, camera, canvas, A, Sfx, me, R, D, W, COL, HEX, box, std, basic, tube, canvasTex, block, keep, makePerson, rnd, pick, clamp, esc, WALK, REGIONS, HOOKS, wallet, tstate, CALM } = ctx;
  const V3 = THREE.Vector3;
  const fmt = (n) => Number(n).toLocaleString();
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const spots = [], decor = [], tickers = [], anims = [];
  // short animations (a dart in flight, a ball's arc) run on the game clock, not on requestAnimationFrame: a hidden tab then can't strand a throw
  const animate = (fn) => anims.push(fn);   // fn(dt) returns true while it's still going
  const later = (sec, fn) => { let t = sec; animate((dt) => { t -= dt; if (t > 0) return true; fn(); return false; }); };
  const add = (o, x, y, z, parent = scene) => { o.position.set(x, y, z); parent.add(o); o.traverse?.((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const mesh = (geo, mat, x, y, z, parent = scene) => add(new THREE.Mesh(geo, mat), x, y, z, parent);
  function plaque(text, w, h, { font = "Monoton", px = 120, glow = "#19e3ff", fill = "#d8faff", cw = 1024, ch = 220 } = {}) {
    const t = canvasTex(cw, ch, (g, W2, H2) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = `${px}px ${font}`; g.shadowBlur = 22; g.shadowColor = glow; g.fillStyle = fill; g.fillText(text, W2 / 2, H2 / 2 + 6, W2 - 30); });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(0xffffff, { map: t, transparent: true }));
  }

  /* ================================================================== THE BAR GAMES CORNER */
  const BX0 = 7, BX1 = W, BZ1 = D + 9, BO0 = 8.2, BO1 = 14.2, BOH = 4;
  ctx.BAR = { BO0, BO1, BOH };
  WALK.push([BO0 + R, BO1 - R, D - R, D + R], [BX0 + R, BX1 - R, D + R, BZ1 - R]);
  REGIONS.push({ name: "bar", x0: BX0, x1: BX1, z0: D, z1: BZ1 });
  {
    // a checkered bar floor, wood below the dado rail, and a cyan neon line round the top
    const tex = canvasTex(256, 256, (g) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#14101c" : "#241a30"; g.fillRect(i * 64, j * 64, 64, 64); } });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((BX1 - BX0) / 1.2, (BZ1 - D) / 1.2);
    const f = mesh(new THREE.PlaneGeometry(BX1 - BX0, BZ1 - D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1 }), (BX0 + BX1) / 2, 0.002, (D + BZ1) / 2); f.rotation.x = -Math.PI / 2;
    const wall = std(0x0e1620, { roughness: 0.9 }), wood = std(0x3a2414, { roughness: 0.7 }), H = 5, L = BZ1 - D;
    box(0.3, H, L, wall, BX0 - 0.15, H / 2, (D + BZ1) / 2); box(0.3, H, L, wall, BX1 + 0.15, H / 2, (D + BZ1) / 2); box(BX1 - BX0 + 0.6, H, 0.3, wall, (BX0 + BX1) / 2, H / 2, BZ1 + 0.15);
    box(0.06, 1.1, L, wood, BX0 + 0.03, 0.55, (D + BZ1) / 2); box(0.06, 1.1, L, wood, BX1 - 0.03, 0.55, (D + BZ1) / 2); box(BX1 - BX0, 1.1, 0.06, wood, (BX0 + BX1) / 2, 0.55, BZ1 - 0.03);
    for (const [w, d, x, z] of [[0.05, L, BX0 + 0.04, (D + BZ1) / 2], [0.05, L, BX1 - 0.04, (D + BZ1) / 2], [BX1 - BX0, 0.05, (BX0 + BX1) / 2, BZ1 - 0.04]]) box(w, 0.05, d, tube(COL.cyan, 0.5), x, 4.3, z);
    for (const x of [BO0, BO1]) mesh(new THREE.CylinderGeometry(0.07, 0.07, BOH, 10), tube(COL.cyan), x, BOH / 2, D);
    { const t = mesh(new THREE.CylinderGeometry(0.07, 0.07, BO1 - BO0, 10), tube(COL.cyan), (BO0 + BO1) / 2, BOH, D); t.rotation.z = Math.PI / 2; }
    const s = plaque("BAR GAMES", 5.4, 1.05); s.position.set((BO0 + BO1) / 2, BOH + 0.95, D - 0.02); s.rotation.y = Math.PI; scene.add(s);
    const beer = plaque("COLD BEER", 2.8, 0.6, { glow: "#ff7a1a", fill: "#ffe0b0", px: 110 }); beer.position.set(BX0 + 0.04, 3.1, D + 6.2); beer.rotation.y = Math.PI / 2; scene.add(beer);
    const lamp = keep(new THREE.PointLight(0xffd0a0, 6, 9, 1.6), 2); lamp.position.set(10.5, 3.6, D + 5.5); scene.add(lamp);
  }
  /* ---- skee-ball: two lanes along the east wall, each a group facing +z (you stand at its open end) */
  const SKEE = { lanes: [], L: 3.1 };
  const ringTex = canvasTex(384, 460, (g, w, h) => {
    g.fillStyle = "#101820"; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.55, s = w / 0.75;   // 0.75 m across
    const rings = [[0.29, "#1f6fe0", "10"], [0.21, "#13a04a", "20"], [0.15, "#ffd400", "30"], [0.1, "#ff7a1a", "40"], [0.05, "#ff2d95", "50"]];
    for (const [r, c, n] of rings) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r * s, 0, 7); g.fill(); g.fillStyle = "#0a0a10"; g.beginPath(); g.arc(cx, cy, (r - 0.012) * s, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "28px Bungee"; g.textAlign = "center"; g.fillText(n, cx, cy - (r - 0.03) * s + 10); }
    for (const sx of [-1, 1]) { const x = cx + sx * 0.29 * s, y = h * 0.5 - 0.36 * s; g.fillStyle = "#c21a72"; g.beginPath(); g.arc(x, y, 0.05 * s, 0, 7); g.fill(); g.fillStyle = "#0a0a10"; g.beginPath(); g.arc(x, y, 0.038 * s, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "22px Bungee"; g.textAlign = "center"; g.fillText("100", x, y - 0.06 * s); }
  });
  for (const [i, lx] of [[0, 13.4], [1, 14.35]]) {
    const g = new THREE.Group(); g.position.set(lx, 0, D + 1.4); scene.add(g);
    const cab = std(0x1a1030, { roughness: 0.5 });
    mesh(new THREE.BoxGeometry(0.8, 0.82, 0.5), cab, 0, 0.41, 0, g);
    const slope = Math.atan2(0.28, SKEE.L);
    const lane = mesh(new THREE.BoxGeometry(0.6, 0.03, SKEE.L), std(0x8a5a2a, { roughness: 0.35 }), 0, 0.83 + 0.14, SKEE.L / 2 + 0.2, g); lane.rotation.x = -slope;
    for (const sx of [-0.33, 0.33]) { const rail = mesh(new THREE.BoxGeometry(0.04, 0.08, SKEE.L), tube(i ? COL.pink : COL.cyan, 0.55), sx, 0.88 + 0.14, SKEE.L / 2 + 0.2, g); rail.rotation.x = -slope; }
    const hump = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12), std(0x6a4020), 0, 1.13, SKEE.L + 0.2, g); hump.rotation.z = Math.PI / 2;
    const tg = new THREE.Group(); tg.position.set(0, 1.45, SKEE.L + 0.62); tg.rotation.x = 0.55; g.add(tg);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9), new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: ringTex, emissiveIntensity: 0.25 })); board.rotation.y = Math.PI; tg.add(board);
    mesh(new THREE.BoxGeometry(0.8, 2.2, 0.12), cab, 0, 1.1, SKEE.L + 1.05, g);
    const scoreC = document.createElement("canvas"); scoreC.width = 256; scoreC.height = 96; const scoreT = new THREE.CanvasTexture(scoreC); scoreT.colorSpace = THREE.SRGBColorSpace;
    const scr = mesh(new THREE.PlaneGeometry(0.7, 0.26), basic(0xffffff, { map: scoreT }), 0, 2.35, SKEE.L + 0.98, g); scr.rotation.y = Math.PI;
    const top = plaque("SKEE-BALL", 0.8, 0.2, { font: "Bungee", px: 80, glow: i ? "#ff2d95" : "#19e3ff", fill: "#fff", cw: 512, ch: 128 }); top.position.set(0, 2.62, SKEE.L + 0.98); top.rotation.y = Math.PI; g.add(top);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), std(0x7a4a24, { roughness: 0.4 })); ball.visible = false; g.add(ball);
    const lane0 = { i, g, tg, ball, scoreC, scoreT, stand: new V3(lx, R, D + 0.95), score: 0 };
    drawSkeeScore(lane0, 0, 9);
    block(lx, D + 1.4 + (SKEE.L + 1.1) / 2, 0.8, SKEE.L + 1.1);
    SKEE.lanes.push(lane0);
    spots.push({ kind: "skee", x: lx, z: D + 0.9, r: 0.75, label: () => `<kbd>E</kbd> Skee-ball: free, pays tickets`, use: () => startMode(skeeMode(lane0)) });
  }
  function drawSkeeScore(lane, score, balls) {
    const g = lane.scoreC.getContext("2d"); g.fillStyle = "#05030b"; g.fillRect(0, 0, 256, 96);
    g.font = "52px Bungee"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ff3b4e"; g.shadowColor = "#ff3b4e"; g.shadowBlur = 12; g.fillText(String(score).padStart(3, "0"), 90, 52);
    g.font = "22px Bungee"; g.fillStyle = "#ffd400"; g.shadowColor = "#ffd400"; g.fillText(`BALLS ${balls}`, 196, 52); g.shadowBlur = 0; lane.scoreT.needsUpdate = true;
  }
  /* ---- darts: a board on the south wall, an oche on the floor */
  const DART = { at: new V3(12, 1.73, BZ1 - 0.07), oche: BZ1 - 2.37, R: 0.17 };
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const dartTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2, s = (w / 2) / 0.225;   // board radius 0.225 m incl. the numbers ring
    g.fillStyle = "#111"; g.beginPath(); g.arc(c, c, w / 2, 0, 7); g.fill();
    const ring = (r0, r1, colA, colB) => { for (let k = 0; k < 20; k++) { const a0 = (-90 - 9 + k * 18) * Math.PI / 180, a1 = a0 + Math.PI / 10; g.fillStyle = k % 2 ? colB : colA; g.beginPath(); g.arc(c, c, r1 * s, a0, a1); g.arc(c, c, r0 * s, a1, a0, true); g.closePath(); g.fill(); } };
    ring(0.0159, 0.099, "#151515", "#efe6cf"); ring(0.099, 0.107, "#d4202f", "#0f8a3a"); ring(0.107, 0.162, "#151515", "#efe6cf"); ring(0.162, 0.17, "#d4202f", "#0f8a3a");
    g.fillStyle = "#0f8a3a"; g.beginPath(); g.arc(c, c, 0.0159 * s, 0, 7); g.fill(); g.fillStyle = "#d4202f"; g.beginPath(); g.arc(c, c, 0.00635 * s, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.font = "26px Bungee"; g.textAlign = "center"; g.textBaseline = "middle";
    ORDER.forEach((n, k) => { const a = (-90 + k * 18) * Math.PI / 180; g.fillText(String(n), c + Math.cos(a) * 0.195 * s, c + Math.sin(a) * 0.195 * s); });
  });
  {
    const back = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32), std(0x2a1a10), DART.at.x, DART.at.y, BZ1 - 0.02); back.rotation.x = Math.PI / 2;
    const bd = mesh(new THREE.CircleGeometry(0.225, 48), new THREE.MeshStandardMaterial({ map: dartTex, roughness: 0.8 }), DART.at.x, DART.at.y, DART.at.z); bd.rotation.y = Math.PI; DART.board = bd;
    mesh(new THREE.BoxGeometry(0.9, 0.02, 0.05), tube(COL.yellow, 0.6), DART.at.x, 0.012, DART.oche);
    const s = plaque("DARTS", 1.4, 0.32, { font: "Bungee", px: 90, glow: "#ffd400", fill: "#fff3c4", cw: 512, ch: 128 }); s.position.set(DART.at.x, 2.35, BZ1 - 0.04); s.rotation.y = Math.PI; scene.add(s);
    spots.push({ kind: "darts", x: DART.at.x, z: DART.oche - 0.25, r: 1.1, label: () => `<kbd>E</kbd> Darts vs bigrig: 100 🎟️ each`, use: () => startMode(dartsMode()) });
  }
  function dartScore(lx, ly) {
    const r = Math.hypot(lx, ly); if (r > 0.17) return { pts: 0, name: "Miss" };
    if (r < 0.00635) return { pts: 50, name: "Bull" }; if (r < 0.0159) return { pts: 25, name: "25" };
    let a = Math.atan2(lx, ly) * 180 / Math.PI; a = (a + 9 + 360) % 360; const n = ORDER[Math.floor(a / 18)];
    if (r >= 0.099 && r < 0.107) return { pts: n * 3, name: `T${n}` }; if (r >= 0.162) return { pts: n * 2, name: `D${n}` }; return { pts: n, name: String(n) };
  }
  /* ---- beer pong: a table down the middle, six cups each end */
  const PONG = { at: new V3(9.9, 0.76, D + 4.6), half: 1.22 };
  const cupGeo = new THREE.CylinderGeometry(0.046, 0.032, 0.12, 16, 1, true), cupMat = std(0xd0182a, { side: THREE.DoubleSide }), beerMat = basic(0xe8a020);
  function rack(endSign) {   // endSign -1 = your end (near, -z), +1 = the far end
    // a triangle of six, its point toward the middle of the table
    const cups = [], dz = 0.082, s = 0.095, rows = [[0], [-0.5, 0.5], [-1, 0, 1]];
    rows.forEach((row, ri) => row.forEach((k) => { const x = PONG.at.x + k * s, zz = PONG.at.z + endSign * (PONG.half - 0.32 + ri * dz); const m = mesh(cupGeo, cupMat, x, PONG.at.y + 0.06, zz); const b = mesh(new THREE.CircleGeometry(0.04, 14), beerMat, x, PONG.at.y + 0.1, zz); b.rotation.x = -Math.PI / 2; cups.push({ x, z: zz, m, b, up: true }); }));
    return cups;
  }
  {
    mesh(new THREE.BoxGeometry(0.61, 0.04, PONG.half * 2), std(0x1a3a6a, { roughness: 0.4 }), PONG.at.x, PONG.at.y - 0.02, PONG.at.z);
    for (const sx of [-0.27, 0.27]) for (const sz of [-1.1, 1.1]) mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 8), std(0x222222), PONG.at.x + sx, 0.37, PONG.at.z + sz);
    const strip = mesh(new THREE.BoxGeometry(0.62, 0.01, 0.02), basic(0xffffff), PONG.at.x, PONG.at.y + 0.001, PONG.at.z);
    PONG.mine = rack(-1); PONG.theirs = rack(1);
    block(PONG.at.x, PONG.at.z, 0.7, PONG.half * 2 + 0.1);
    spots.push({ kind: "pong", x: PONG.at.x, z: PONG.at.z - PONG.half - 0.55, r: 1.0, label: () => `<kbd>E</kbd> Beer pong vs heartlarva: 100 🎟️ each`, use: () => startMode(pongMode()) });
  }
  function resetCups() { for (const c of [...PONG.mine, ...PONG.theirs]) { c.up = true; c.m.visible = true; c.b.visible = true; } }
  /* ---- the shuffleboard, out of order */
  {
    mesh(new THREE.BoxGeometry(0.62, 0.8, 5.6), std(0x6a4020, { roughness: 0.4 }), BX0 + 0.75, 0.4, D + 4.6);
    mesh(new THREE.BoxGeometry(0.5, 0.01, 5.4), std(0xc89a5a, { roughness: 0.15 }), BX0 + 0.75, 0.805, D + 4.6);
    const sg = canvasTex(256, 200, (g, w, h) => { g.fillStyle = "#f4f0e0"; g.fillRect(0, 0, w, h); g.fillStyle = "#c01a1a"; g.font = "40px Bungee"; g.textAlign = "center"; g.fillText("OUT OF", w / 2, 70); g.fillText("ORDER", w / 2, 116); g.fillStyle = "#333"; g.font = "600 20px Rubik"; g.fillText("(someone spilled", w / 2, 156); g.fillText("a pitcher on it)", w / 2, 180); });
    const paper = mesh(new THREE.PlaneGeometry(0.34, 0.27), new THREE.MeshStandardMaterial({ map: sg }), BX0 + 0.75, 0.82, D + 2.2); paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.25;
    for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), std(k % 2 ? 0xd0182a : 0x2a6ad0, { metalness: 0.5, roughness: 0.3 }), BX0 + 0.75 + rnd(-0.12, 0.12), 0.825, D + 6.5 + k * 0.18);
    block(BX0 + 0.75, D + 4.6, 0.7, 5.7);
  }

  /* ================================================================== THE PATIO */
  const PX0 = W, PX1 = W + 16, PZ0 = -22, PZ1 = 0, PO0 = -10.6, PO1 = -5.8, POH = 3.6;
  ctx.PATIO = { PO0, PO1, POH };
  WALK.push([W - R, W + R, PO0 + R, PO1 - R], [PX0 + R, PX1 - R, PZ0 + R, PZ1 - R]);
  REGIONS.push({ name: "patio", x0: PX0, x1: PX1, z0: PZ0, z1: PZ1, open: true });
  const POND = { cx: W + 10, cz: -12, rx: 4.2, rz: 5.5 }, DOCK = { x0: W + 5.3, x1: W + 7.9, z0: -10, z1: -8.8 };
  // the pond is not walkable, except along the dock
  HOOKS.push((p, r) => {
    if (p.x > DOCK.x0 - 0.2 && p.x < DOCK.x1 && p.z > DOCK.z0 + r * 0.5 && p.z < DOCK.z1 - r * 0.5) return;
    const dx = (p.x - POND.cx) / (POND.rx + r), dz = (p.z - POND.cz) / (POND.rz + r), d = Math.hypot(dx, dz);
    if (d < 1) { p.x = POND.cx + (dx / d) * (POND.rx + r); p.z = POND.cz + (dz / d) * (POND.rz + r); }
  });
  {
    // the door: wide glass sliders pushed open, PATIO in neon over it
    for (const z of [PO0 - 0.6, PO1 + 0.6]) { const gl = mesh(new THREE.BoxGeometry(0.05, POH - 0.2, 1.1), new THREE.MeshStandardMaterial({ color: 0x9be8ff, transparent: true, opacity: 0.18, roughness: 0.05 }), W + 0.32, (POH - 0.2) / 2, z); gl.castShadow = false; }
    const s = plaque("PATIO", 3, 0.7, { glow: "#b6ff2e", fill: "#efffd0" }); s.position.set(W - 0.02, POH + 0.75, (PO0 + PO1) / 2); s.rotation.y = -Math.PI / 2; scene.add(s);
    // grass, with a little variety in it
    const grass = canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#0d2a14"; g.fillRect(0, 0, w, h); for (let k = 0; k < 3500; k++) { g.fillStyle = pick(["#123a1c", "#0a2210", "#1a4a24", "#0f3018"]); g.fillRect(Math.random() * w, Math.random() * h, 2, 5 + Math.random() * 6); } });
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set((PX1 - PX0) / 4, (PZ1 - PZ0) / 4);
    const gr = mesh(new THREE.PlaneGeometry(PX1 - PX0 + 2, PZ1 - PZ0 + 2), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }), (PX0 + PX1) / 2, 0.001, (PZ0 + PZ1) / 2); gr.rotation.x = -Math.PI / 2;
    // the deck by the door
    const planks = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#5a3a20" : "#664428"; g.fillRect(0, i * 32, w, 31); g.fillStyle = "#3a2410"; g.fillRect(0, i * 32 + 31, w, 1); } });
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2.5, 4);
    const deck = mesh(new THREE.BoxGeometry(5.5, 0.12, 9.5), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.8 }), W + 2.75, 0.06, -8.2);
    const dock = mesh(new THREE.BoxGeometry(DOCK.x1 - DOCK.x0 + 0.2, 0.1, DOCK.z1 - DOCK.z0), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.8 }), (DOCK.x0 + DOCK.x1) / 2, 0.12, (DOCK.z0 + DOCK.z1) / 2);
    for (const x of [DOCK.x0 + 1, DOCK.x1 - 0.1]) for (const z of [DOCK.z0 + 0.05, DOCK.z1 - 0.05]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), std(0x3a2410), x, 0.05, z);
    // the pond: a muddy bank, dark water with moonlight drifting across it, lily pads and reeds
    const bank = mesh(new THREE.CircleGeometry(1, 48), std(0x1a140c, { roughness: 1 }), POND.cx, 0.006, POND.cz); bank.rotation.x = -Math.PI / 2; bank.scale.set(POND.rx + 0.45, POND.rz + 0.45, 1);
    const shine = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(180,210,255,${0.1 + Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 1.5); } });
    shine.wrapS = shine.wrapT = THREE.RepeatWrapping; shine.repeat.set(2, 2);
    const water = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x0a2236, roughness: 0.12, metalness: 0.5, emissive: 0xffffff, emissiveMap: shine, emissiveIntensity: 0.35 }), POND.cx, 0.012, POND.cz);
    water.rotation.x = -Math.PI / 2; water.scale.set(POND.rx, POND.rz, 1); water.receiveShadow = true; POND.water = water; POND.shine = shine;
    for (let k = 0; k < 9; k++) { const a = rnd(0, 7), rr = rnd(0.35, 0.85); const pad = mesh(new THREE.CircleGeometry(0.22, 12, 0.3, Math.PI * 1.85), std(0x1f5a28), POND.cx + Math.cos(a) * POND.rx * rr, 0.02, POND.cz + Math.sin(a) * POND.rz * rr); pad.rotation.x = -Math.PI / 2; }
    for (let k = 0; k < 26; k++) { const a = rnd(0, 7), x = POND.cx + Math.cos(a) * (POND.rx + rnd(-0.1, 0.3)), z = POND.cz + Math.sin(a) * (POND.rz + rnd(-0.1, 0.3)); if (x < DOCK.x1 + 0.6 && Math.abs(z - (DOCK.z0 + DOCK.z1) / 2) < 1.2) continue; const h = rnd(0.6, 1.1); mesh(new THREE.CylinderGeometry(0.012, 0.015, h, 5), std(0x3a5a20), x, h / 2, z); mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 6), std(0x4a2a14), x, h - 0.05, z); }
    for (let k = 0; k < 16; k++) { const a = rnd(0, 7); const rk = mesh(new THREE.DodecahedronGeometry(rnd(0.12, 0.3), 0), std(0x4a4a50, { roughness: 0.9 }), POND.cx + Math.cos(a) * (POND.rx + 0.4), 0.05, POND.cz + Math.sin(a) * (POND.rz + 0.4)); rk.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
    // trees and bushes round the edge, low-poly
    const trunkM = std(0x3a2414, { roughness: 1 }), leafM = [std(0x14361c, { roughness: 1 }), std(0x1a4422, { roughness: 1 }), std(0x0f2a16, { roughness: 1 })];
    const treeAt = [[PX1 - 1.2, -20.5], [PX1 - 1.5, -15], [PX1 - 1.1, -8.5], [PX1 - 1.6, -2], [W + 4, PZ0 + 1.2], [W + 9, PZ0 + 1.0], [W + 13.5, PZ0 + 1.6], [W + 7.5, -1.2], [W + 12, -0.9], [W + 15, -17.5]];
    for (const [x, z] of treeAt) { const h = rnd(2.6, 4); mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.4, 7), trunkM, x, h * 0.2, z); for (let k = 0; k < 3; k++) mesh(new THREE.ConeGeometry(1.2 - k * 0.3, h * 0.45, 7), pick(leafM), x, h * 0.4 + k * h * 0.22, z); block(x, z, 0.5, 0.5); }
    for (let k = 0; k < 14; k++) { const x = rnd(PX0 + 6.2, PX1 - 0.6), z = pick([rnd(PZ0 + 0.5, PZ0 + 2.5), rnd(PZ1 - 2.2, PZ1 - 0.4)]); mesh(new THREE.IcosahedronGeometry(rnd(0.35, 0.6), 0), pick(leafM), x, 0.3, z); }
    // a low fence round the garden
    const posts = []; const fenceAt = (x, z) => posts.push(new THREE.Matrix4().makeTranslation(x, 0.45, z));
    for (let x = PX0 + 0.5; x <= PX1; x += 1.6) { fenceAt(x, PZ0); fenceAt(x, PZ1); } for (let z = PZ0; z <= PZ1; z += 1.6) fenceAt(PX1, z);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), std(0x5a3a20), posts.length); posts.forEach((m, k) => pm.setMatrixAt(k, m)); scene.add(pm);
    for (const [w, d, x, z] of [[PX1 - PX0, 0.06, (PX0 + PX1) / 2, PZ0], [PX1 - PX0, 0.06, (PX0 + PX1) / 2, PZ1], [0.06, PZ1 - PZ0, PX1, (PZ0 + PZ1) / 2]]) for (const y of [0.35, 0.75]) box(w, 0.08, d, std(0x6a4428), x, y, z);
    // the fire pit, with chairs round it
    const FIRE = new V3(W + 3.5, 0, -17.2);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const st = mesh(new THREE.DodecahedronGeometry(0.16, 0), std(0x55555c, { roughness: 0.9 }), FIRE.x + Math.cos(a) * 0.62, 0.1, FIRE.z + Math.sin(a) * 0.62); st.rotation.set(a, a, 0); }
    for (let k = 0; k < 3; k++) { const lg = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), std(0x3a2410), FIRE.x, 0.1, FIRE.z); lg.rotation.z = Math.PI / 2; lg.rotation.y = k * 1.05; }
    const flames = []; for (let k = 0; k < 4; k++) { const f = mesh(new THREE.ConeGeometry(0.16 - k * 0.025, 0.55 - k * 0.06, 8), basic(new THREE.Color(pick([0xff7a1a, 0xffb020, 0xff4a10])).multiplyScalar(0.85)), FIRE.x + rnd(-0.1, 0.1), 0.38, FIRE.z + rnd(-0.1, 0.1)); f.castShadow = false; flames.push({ f, ph: rnd(0, 6) }); }
    const fireLight = keep(new THREE.PointLight(0xff8a30, 6, 8, 1.6), 2); fireLight.position.set(FIRE.x, 1.0, FIRE.z); scene.add(fireLight);
    block(FIRE.x, FIRE.z, 1.4, 1.4);
    const chair = (x, z, ry, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); const m = std(col, { roughness: 0.7 });
      mesh(new THREE.BoxGeometry(0.6, 0.06, 0.55), m, 0, 0.36, 0, g); const back = mesh(new THREE.BoxGeometry(0.6, 0.7, 0.06), m, 0, 0.72, -0.3, g); back.rotation.x = -0.35;
      for (const sx of [-0.32, 0.32]) mesh(new THREE.BoxGeometry(0.08, 0.05, 0.6), m, sx, 0.55, 0.02, g); for (const sx of [-0.25, 0.25]) for (const sz of [-0.22, 0.22]) mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), m, sx, 0.18, sz, g); block(x, z, 0.7, 0.7); };
    [[0, 0xd04a3a], [1.6, 0x2a7ad0], [3.2, 0xe8c040], [4.7, 0x3aa060]].forEach(([a, c]) => chair(FIRE.x + Math.cos(a) * 1.6, FIRE.z + Math.sin(a) * 1.6, Math.atan2(FIRE.x - (FIRE.x + Math.cos(a) * 1.6), FIRE.z - (FIRE.z + Math.sin(a) * 1.6)), c));
    // string lights: posts and sagging wires of bulbs (they glow; they aren't lights)
    const POSTS = [[W + 0.4, -12.6], [W + 5.4, -12.6], [W + 5.4, -3.6], [W + 0.4, -3.6], [W + 5.4, -19.8], [W + 0.6, -19.8]];
    for (const [x, z] of POSTS) mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 8), std(0x2a2018), x, 1.6, z);
    const RUNS = [[0, 1], [1, 2], [2, 3], [0, 3], [1, 4], [4, 5], [5, 0], [0, 2]];
    const bulbM = [], bulbs = [];
    for (const [a, b] of RUNS) {
      const [ax, az] = POSTS[a], [bx, bz] = POSTS[b], n = Math.round(Math.hypot(bx - ax, bz - az) / 0.45), pts = [];
      for (let k = 0; k <= n; k++) { const t = k / n, y = 3.1 - Math.sin(Math.PI * t) * 0.55; pts.push(new V3(ax + (bx - ax) * t, y, az + (bz - az) * t)); if (k && k < n) bulbM.push(new THREE.Matrix4().makeTranslation(ax + (bx - ax) * t, y - 0.07, az + (bz - az) * t)); }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x111111 })));
    }
    const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), basic(0xffd890), bulbM.length); bulbM.forEach((m, k) => bi.setMatrixAt(k, m)); scene.add(bi);
    // a cooler and some empties on the deck
    mesh(new THREE.BoxGeometry(0.6, 0.38, 0.38), std(0xd0182a, { roughness: 0.5 }), W + 4.6, 0.31, -5.0); mesh(new THREE.BoxGeometry(0.62, 0.06, 0.4), std(0xffffff), W + 4.6, 0.53, -5.0);
    block(W + 4.6, -5.0, 0.7, 0.45);
    // the night: a moon, stars over the garden, cool moonlight, fireflies
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2); gr.addColorStop(0, "#fffbe8"); gr.addColorStop(0.45, "#f0ecd8"); gr.addColorStop(0.5, "rgba(240,236,216,.25)"); gr.addColorStop(1, "rgba(240,236,216,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); }), fog: false, depthWrite: false }));
    moon.scale.setScalar(9); moon.position.set(W + 38, 30, -34); scene.add(moon);
    const sp = []; for (let k = 0; k < 500; k++) sp.push(rnd(W - 20, W + 70), rnd(14, 45), rnd(-70, 25));
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, fog: false, transparent: true, opacity: 0.85 })); scene.add(stars);
    const moonLight = keep(new THREE.PointLight(0xa8c0ff, 0.9, 40, 0), 1); moonLight.position.set(W + 9, 14, -11); scene.add(moonLight);
    const ff = canvasTex(32, 32, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(220,255,140,1)"); gr.addColorStop(1, "rgba(220,255,140,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const flies = []; for (let k = 0; k < 22; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.16); s.position.set(rnd(PX0 + 3, PX1 - 1), rnd(0.4, 1.8), rnd(PZ0 + 2, PZ1 - 2)); scene.add(s); flies.push({ s, ph: rnd(0, 6), x: s.position.x, y: s.position.y, z: s.position.z }); }
    tickers.push((dt, t) => {
      if (CALM) return;
      shine.offset.x = t * 0.01; shine.offset.y = t * 0.006;
      for (const { f, ph } of flames) { const k = 0.85 + Math.sin(t * 11 + ph) * 0.12 + Math.sin(t * 17 + ph * 2) * 0.06; f.scale.set(1, k, 1); }
      if (fireLight.visible) fireLight.intensity = 5.5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 0.6;
      for (const fl of flies) { fl.s.position.set(fl.x + Math.sin(t * 0.4 + fl.ph) * 0.8, fl.y + Math.sin(t * 0.9 + fl.ph * 2) * 0.25, fl.z + Math.cos(t * 0.33 + fl.ph) * 0.8); fl.s.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + fl.ph * 3)); }
    });
    // the catch board by the dock
    const cbC = document.createElement("canvas"); cbC.width = 512; cbC.height = 400; const cbT = new THREE.CanvasTexture(cbC); cbT.colorSpace = THREE.SRGBColorSpace;
    const cb = new THREE.Group(); cb.position.set(W + 5.0, 0, -6.9); cb.rotation.y = -Math.PI / 2 + 0.5; scene.add(cb);
    mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), std(0x3a2410), 0, 0.65, 0, cb); const pnl = mesh(new THREE.PlaneGeometry(1.15, 0.9), new THREE.MeshStandardMaterial({ map: cbT, roughness: 0.8, emissive: 0xffffff, emissiveMap: cbT, emissiveIntensity: 0.15 }), 0, 1.6, 0.05, cb);
    POND.board = { cbC, cbT, catches: [{ name: "drhealsgud", fish: "Channel Catfish", kg: 5.2 }, { name: "heartlarva", fish: "Koi", kg: 3.1 }, { name: "zwades", fish: "Largemouth Bass", kg: 2.4 }] };
    drawCatchBoard();
    // where you fish from
    spots.push({ kind: "fish", x: DOCK.x1 - 0.25, z: (DOCK.z0 + DOCK.z1) / 2, r: 0.9, label: () => `<kbd>E</kbd> Fish off the dock`, use: () => startMode(fishMode({ x: DOCK.x1 - 0.25, z: (DOCK.z0 + DOCK.z1) / 2, face: Math.PI / 2 })) });
    spots.push({ kind: "fish", x: POND.cx, z: POND.cz + POND.rz + 0.55, r: 1.0, label: () => `<kbd>E</kbd> Fish from the bank`, use: () => startMode(fishMode({ x: POND.cx, z: POND.cz + POND.rz + 0.55, face: Math.PI })) });
    spots.push({ kind: "fire", x: FIRE.x, z: FIRE.z, r: 2.4, label: () => `By the fire`, use: () => A.notify(pick(["You warm your hands. Nice.", "Somebody's telling the 28-3 story again.", "A marshmallow catches fire. Classic."]), "🔥") });
  }
  function drawCatchBoard() {
    const B = POND.board, g = B.cbC.getContext("2d"), w = 512, h = 400;
    g.fillStyle = "#2a1c10"; g.fillRect(0, 0, w, h); g.strokeStyle = "#c9a227"; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = "center"; g.fillStyle = "#ffd27a"; g.font = "38px Bungee"; g.fillText("BIGGEST CATCHES", w / 2, 58); g.font = "600 22px Rubik"; g.fillStyle = "#cdb88a"; g.fillText("today, off this dock", w / 2, 90);
    B.catches.sort((a, b) => b.kg - a.kg).slice(0, 5).forEach((c, k) => { const y = 140 + k * 52; g.textAlign = "left"; g.fillStyle = k ? "#f4ecff" : "#ffd400"; g.font = "600 26px Rubik"; g.fillText(`${k + 1}. ${c.name}`, 30, y); g.font = "500 18px Rubik"; g.fillStyle = "#b8a888"; g.fillText(c.fish, 52, y + 22); g.textAlign = "right"; g.fillStyle = "#9affb0"; g.font = "28px Bungee"; g.fillText(`${c.kg.toFixed(1)} kg`, w - 30, y + 6); });
    B.cbT.needsUpdate = true;
  }

  /* ================================================================== people in the new rooms (offline only, like the lounge's bots) */
  const crowd = [];
  const stand = (look, name, x, z, face) => { const p = makePerson(look, name, ctx.nameColor(name)); p.g.position.set(x, 0, z); p.g.rotation.y = face; crowd.push(p); };
  stand({ model: "char-male-c", hat: "cap" }, "bigrig", DART.at.x - 0.9, DART.oche - 0.2, 0.3);
  stand({ model: "char-female-b", hat: "beanie" }, "allyrose7774", 14.35, D + 0.95, 0);
  stand({ model: "char-female-f", hat: "none" }, "kellzifer", W + 3.5 + 1.6, -17.2 + 0.1, -Math.PI / 2);
  stand({ model: "char-male-a", hat: "cap" }, "CarlCaribbean", W + 2.0, -18.6, 0.6);

  /* ================================================================== MODES */
  let mode = null, hud = null, badge = null;
  function hudEl() {
    if (hud) return hud;
    const st = document.createElement("style");
    st.textContent = `.mg{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:5;display:grid;justify-items:center;gap:8px;padding:12px 18px;border-radius:14px;background:rgba(10,6,20,.9);box-shadow:inset 0 0 0 2px var(--ak-line),0 10px 30px rgba(0,0,0,.5);min-width:min(420px,calc(100% - 28px));color:var(--ak-text);font:500 14px var(--ak-body);text-align:center}
.mg[hidden]{display:none}.mg h4{margin:0;font:400 18px var(--ak-disp)}.mg .row{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}.mg .k{color:var(--ak-dim);font-size:12.5px}
.mg .meter{width:260px;height:12px;border-radius:6px;background:#0a0614;box-shadow:inset 0 0 0 1.5px var(--ak-line);overflow:hidden}.mg .meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ak-lime),var(--ak-yellow),var(--ak-red))}
.mg .big{font:400 26px var(--ak-disp);color:var(--ak-yellow)}.mg .score{display:flex;gap:16px}.mg .score b{font:400 20px var(--ak-disp)}
.mg-reel{position:relative;width:300px;height:30px;border-radius:15px;background:#0a2236;box-shadow:inset 0 0 0 2px var(--ak-cyan)}.mg-reel .zone{position:absolute;top:3px;bottom:3px;border-radius:12px;background:rgba(182,255,46,.35);box-shadow:inset 0 0 0 2px var(--ak-lime)}.mg-reel .fish{position:absolute;top:2px;font-size:20px;transform:translateX(-50%)}
.mg-bite{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font:400 64px var(--ak-disp);color:#fff;text-shadow:var(--ak-glow-yellow);pointer-events:none;z-index:5}
.mg-pop{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font:400 38px var(--ak-disp);color:#fff;text-shadow:var(--ak-glow-pink);pointer-events:none;z-index:5;animation:ak-in .3s}`;
    document.head.append(st);
    hud = document.createElement("div"); hud.className = "mg"; hud.hidden = true; document.querySelector(".stage").append(hud);
    // these games are previews: against bots, with the page's pretend tickets. Said on screen the whole time you're in one.
    badge = document.createElement("div"); badge.hidden = true; badge.textContent = "PREVIEW · pretend tickets, nothing real is staked or won";
    badge.style.cssText = "position:absolute;left:50%;top:56px;transform:translateX(-50%);z-index:5;padding:4px 12px;border-radius:999px;background:rgba(10,6,20,.85);color:var(--ak-yellow);font:600 12px var(--ak-body);box-shadow:inset 0 0 0 1.5px rgba(255,212,0,.45);white-space:nowrap";
    document.querySelector(".stage").append(badge);
    hud.addEventListener("click", (e) => { const b = e.target.closest("[data-mg]"); if (!b) return; if (b.dataset.mg === "leave") endMode(); else mode?.button?.(b.dataset.mg); });
    return hud;
  }
  function pop(text, ms = 1100) { const p = document.createElement("div"); p.className = "mg-pop"; p.textContent = text; document.querySelector(".stage").append(p); setTimeout(() => p.remove(), ms); }
  function startMode(m) { if (mode) return; mode = m; hudEl().hidden = false; badge.hidden = false; ctx.onMode?.(true); $prompt(""); m.start(); }
  function endMode() { if (!mode) return; mode.end?.(); mode = null; hud.hidden = true; badge.hidden = true; hud.innerHTML = ""; ctx.onMode?.(false); A.setWhere(""); canvas.focus({ preventScroll: true }); }
  const $prompt = (s) => { const hp = document.getElementById("hudPrompt"); hp.innerHTML = s; hp.dataset.l = s; };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pointerRay = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray; };
  const placeMe = (x, z, face) => { me.p.set(x, R, z); me.v.set(0, 0, 0); me.facing = face; me.grounded = true; A.sendPos(x, R, z, face, 0); };
  const pay = (n, why, icon = "🎟️") => { wallet.tickets += n; if (n) A.notify(`${n > 0 ? "+" : ""}${fmt(n)} 🎟️ ${why}`, icon, n > 0 ? "lime" : ""); };

  /* ---- SKEE-BALL: nine balls; aim with the mouse (or the stick), hold to wind up, let go to roll. Free; pays score / 20 in tickets. */
  function skeeMode(lane) {
    let balls = 9, score = 0, holding = false, power = 0, pdir = 1, aim = 0, flying = null;
    const draw = () => { hud.innerHTML = `<h4>SKEE-BALL</h4><div class="score"><span>Score <b>${score}</b></span><span>Balls <b>${balls}</b></span></div>
      <div class="meter"><i style="width:${Math.round(power * 100)}%"></i></div><div class="k">Move the mouse to aim · <b>hold</b> click or Space to wind up, let go to roll · Q to leave</div>
      <div class="row"><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`; };
    const toss = () => {
      if (flying || balls <= 0) return; balls--; Sfx.play("jump");
      const v = -0.45 + power * 0.9 * 1.05 + gauss() * 0.028, u = clamp(aim, -1, 1) * 0.3 + gauss() * 0.028;
      flying = { t: 0, u, v, p: power }; lane.ball.visible = true; power = 0; draw();
    };
    return {
      start() { placeMe(lane.stand.x, lane.stand.z, Math.PI); A.setWhere("playing skee-ball"); draw(); drawSkeeScore(lane, 0, 9); },
      cam(pos, look) { pos.set(lane.g.position.x, 1.85, lane.g.position.z - 1.15); look.set(lane.g.position.x, 1.2, lane.g.position.z + SKEE.L + 0.4); return true; },
      pointer(type, e) { if (type === "move") { const r = canvas.getBoundingClientRect(); aim = ((e.clientX - r.left) / r.width) * 2 - 1; } else if (type === "down") holding = true; else if (type === "up") { if (holding) toss(); holding = false; } },
      key(e, down) { if (e.code === "Space") { if (down && !holding) holding = true; else if (!down && holding) { holding = false; toss(); } } if (down && (e.code === "KeyA" || e.code === "ArrowLeft")) aim = Math.max(-1, aim - 0.15); if (down && (e.code === "KeyD" || e.code === "ArrowRight")) aim = Math.min(1, aim + 0.15); },
      step(dt) {
        if (tstate.jump && !holding) holding = true; else if (!tstate.jump && holding && ctx.touchHeld) { holding = false; toss(); } ctx.touchHeld = tstate.jump;
        if (Math.abs(tstate.x) > 0.1) aim = clamp(aim + tstate.x * dt * 1.5, -1, 1);
        if (holding && !flying) { power += pdir * dt / 1.1; if (power >= 1) { power = 1; pdir = -1; } if (power <= 0) { power = 0; pdir = 1; } const m = hud.querySelector(".meter i"); if (m) m.style.width = `${Math.round(power * 100)}%`; }
        if (!flying) return;
        const f = flying; f.t += dt; const b = lane.ball, L = SKEE.L, t1 = 0.55, t2 = 0.4;
        const land = lane.tg.localToWorld(new V3(-f.u, f.v, 0.02)); lane.g.worldToLocal(land);
        if (f.t < t1) { const k = f.t / t1; b.position.set(land.x * 0.5 * k, 0.9 + 0.14 + k * 0.26, 0.3 + k * (L - 0.1)); }
        else if (f.t < t1 + t2) { const k = (f.t - t1) / t2, sx = land.x * 0.5, sy = 1.3, sz = L + 0.2; b.position.set(sx + (land.x - sx) * k, sy + (land.y - sy) * k + Math.sin(Math.PI * k) * 0.35, sz + (land.z - sz) * k); }
        else {
          b.visible = false; flying = null;
          const r = Math.hypot(f.u, f.v + 0.05); let pts = 0;
          if (Math.hypot(Math.abs(f.u) - 0.29, f.v - 0.36) < 0.045) pts = 100; else if (r < 0.05) pts = 50; else if (r < 0.1) pts = 40; else if (r < 0.15) pts = 30; else if (r < 0.21) pts = 20; else if (r < 0.29) pts = 10;
          score += pts; drawSkeeScore(lane, score, balls); pop(pts ? `+${pts}` : "MISS"); Sfx.play(pts >= 50 ? "checkpoint" : pts ? "beep" : "bonk"); draw();
          if (balls <= 0) { const tix = Math.floor(score / 20); later(0.5, () => { pay(tix, `from skee-ball (${score})`, "🎳"); hud.innerHTML = `<h4>SKEE-BALL</h4><div class="big">${score}</div><div class="k">${tix} tickets come out of the slot</div><div class="row"><button type="button" class="ak-btn sm" data-mg="again">Play again</button><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`; }); }
        }
      },
      button(k) { if (k === "again") { balls = 9; score = 0; drawSkeeScore(lane, 0, 9); draw(); } },
      end() { lane.ball.visible = false; drawSkeeScore(lane, 0, 9); }
    };
  }

  /* ---- DARTS vs a bot: three rounds of three darts, the higher total takes both stakes. The aim sways (it's a bar). */
  function dartsMode() {
    const STAKE = 100, darts = [];
    let round = 1, turn = "me", left = 3, mine = 0, theirs = 0, aimL = new V3(0, 0, 0), busy = false, t0 = performance.now() / 1000, started = false;
    const reticle = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.014, 20), basic(0x19e3ff, { depthTest: false, transparent: true })); reticle.renderOrder = 9; scene.add(reticle);
    const dartMesh = (col) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 6), std(0x9a9aa8, { metalness: 0.8, roughness: 0.3 })); b.rotation.x = Math.PI / 2; g.add(b); const fl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.001), basic(col)); fl.position.z = -0.06; g.add(fl); const fl2 = fl.clone(); fl2.rotation.z = Math.PI / 2; g.add(fl2); scene.add(g); darts.push(g); return g; };
    const draw = (msg = "") => { hud.innerHTML = `<h4>DARTS · ROUND ${round} OF 3</h4><div class="score"><span>You <b>${mine}</b></span><span>bigrig <b>${theirs}</b></span></div>
      <div class="k">${msg || (turn === "me" ? `Your throw: ${left} dart${left === 1 ? "" : "s"} left · click to throw (the aim sways: time it)` : "bigrig is throwing…")}</div>
      <div class="row"><button type="button" class="ak-btn sm ghost" data-mg="leave">${started ? "Leave (forfeits)" : "Leave"}</button></div>`; };
    const throwAt = (lx, ly, col, cb) => {
      const target = DART.board.localToWorld(new V3(lx, ly, 0)); target.z -= 0.06;
      const d = dartMesh(col), from = new V3(DART.at.x + (col === 0x19e3ff ? 0 : 0.6), 1.7, DART.oche);
      let k = 0; animate((dt) => { k = Math.min(1, k + dt / 0.24); d.position.lerpVectors(from, target, k); d.position.y += Math.sin(Math.PI * k) * 0.08; d.lookAt(target.x, target.y, target.z + 1); if (k < 1) return true; Sfx.play("step"); cb(dartScore(lx, ly)); return false; });
    };
    const next = () => {
      if (turn === "me" && left === 0) { turn = "bot"; left = 3; draw(); later(0.7, botThrow); return; }
      if (turn === "bot" && left === 0) { if (round === 3) return finish(); later(0.9, () => { for (const d of darts.splice(0)) scene.remove(d); round++; turn = "me"; left = 3; draw(); }); return; }
      if (turn === "bot") later(0.65, botThrow); else draw();
    };
    const botThrow = () => { const lx = Math.sin(0) * 0.103 + gauss() * 0.032, ly = Math.cos(0) * 0.103 + gauss() * 0.032; throwAt(lx, ly, 0xff3b4e, (s) => { theirs += s.pts; left--; pop(`bigrig: ${s.name}`, 800); draw(); next(); }); };
    const finish = () => {
      const won = mine > theirs, tie = mine === theirs;
      pay(won ? STAKE * 2 : tie ? STAKE : 0, won ? "for beating bigrig at darts" : tie ? "back: a tie" : "", won ? "🎯" : "🤝");
      hud.innerHTML = `<h4>${won ? "YOU WIN" : tie ? "A TIE" : "BIGRIG WINS"}</h4><div class="score"><span>You <b>${mine}</b></span><span>bigrig <b>${theirs}</b></span></div>
        <div class="k">${won ? `You take the pot: ${STAKE * 2} 🎟️` : tie ? "Stakes back." : `bigrig takes the pot. Rematch?`}</div><div class="row"><button type="button" class="ak-btn sm" data-mg="again">Play again · ${STAKE} 🎟️</button><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`;
      started = false; Sfx.play(won ? "finish" : "fall");
    };
    const begin = () => { if (wallet.tickets < STAKE) { A.notify("Not enough tickets: Lucky sells them.", "🎟️", "pink"); return false; } wallet.tickets -= STAKE; started = true; round = 1; turn = "me"; left = 3; mine = 0; theirs = 0; for (const d of darts.splice(0)) scene.remove(d); draw(); return true; };
    return {
      start() { placeMe(DART.at.x, DART.oche - 0.3, Math.PI); A.setWhere("throwing darts"); if (!begin()) { hud.innerHTML = `<h4>DARTS</h4><div class="k">You need ${STAKE} 🎟️ to play bigrig.</div><div class="row"><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`; } },
      cam(pos, look) { pos.set(DART.at.x, 1.78, DART.oche - 0.4); look.set(DART.at.x, DART.at.y, DART.at.z); return true; },
      pointer(type, e) {
        if (type === "move") { const r = pointerRay(e); const hit = r.ray.intersectPlane(new THREE.Plane(new V3(0, 0, -1), DART.at.z), new V3()); if (hit) aimL = DART.board.worldToLocal(hit.clone()); }
        if (type === "down" && started && turn === "me" && left > 0 && !busy) {
          const t = performance.now() / 1000 - t0, sx = Math.sin(t * 1.7) * 0.022 + Math.sin(t * 2.9) * 0.011, sy = Math.cos(t * 1.3) * 0.018 + Math.sin(t * 3.7) * 0.008;
          busy = true; throwAt(aimL.x + sx + gauss() * 0.006, aimL.y + sy + gauss() * 0.006, 0x19e3ff, (s) => { mine += s.pts; left--; busy = false; pop(s.pts ? s.name : "MISS"); next(); });
        }
      },
      key() {},
      step() { const t = performance.now() / 1000 - t0; const p = DART.board.localToWorld(new V3(aimL.x + Math.sin(t * 1.7) * 0.022 + Math.sin(t * 2.9) * 0.011, aimL.y + Math.cos(t * 1.3) * 0.018 + Math.sin(t * 3.7) * 0.008, 0)); reticle.position.set(p.x, p.y, DART.at.z - 0.012); reticle.lookAt(p.x, p.y, DART.at.z - 1); reticle.visible = started && turn === "me"; },
      button(k) { if (k === "again") begin(); },
      end() { scene.remove(reticle); for (const d of darts.splice(0)) scene.remove(d); if (started) A.notify(`You walked away: bigrig keeps your ${STAKE} 🎟️.`, "🎯"); }
    };
  }

  /* ---- BEER PONG vs a bot: click where on the far end you want the ball to land; sink all six first. Every cup you lose makes your aim
     wobblier (you drink it). */
  function pongMode() {
    const STAKE = 100; let started = false, turn = "me", busy = false, aimP = new V3(PONG.at.x, PONG.at.y, PONG.at.z + 0.9), t0 = performance.now() / 1000;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), basic(0xffffff)); ball.visible = false; scene.add(ball);
    const reticle = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 24), basic(0x19e3ff, { transparent: true, depthTest: false })); reticle.rotation.x = -Math.PI / 2; reticle.renderOrder = 9; scene.add(reticle);
    const left = (cups) => cups.filter((c) => c.up).length;
    const wobble = () => 0.012 + (6 - left(PONG.mine)) * 0.006;
    const draw = (msg = "") => { hud.innerHTML = `<h4>BEER PONG</h4><div class="score"><span>Your cups <b>${left(PONG.mine)}</b></span><span>heartlarva's cups <b>${left(PONG.theirs)}</b></span></div>
      <div class="k">${msg || (turn === "me" ? "Click on the far end where you want it to land" : "heartlarva is shooting…")}${left(PONG.mine) < 6 ? ` · wobble ${"🍺".repeat(6 - left(PONG.mine))}` : ""}</div>
      <div class="row"><button type="button" class="ak-btn sm ghost" data-mg="leave">${started ? "Leave (forfeits)" : "Leave"}</button></div>`; };
    const shoot = (from, to, cups, cb) => {
      busy = true; ball.visible = true; const peak = 0.55; let k = 0, k2 = -1; const dir = new V3(to.x - from.x, 0, to.z - from.z).normalize();
      animate((dt) => {
        if (k2 < 0) {   // the arc
          k = Math.min(1, k + dt / 0.62); ball.position.lerpVectors(from, to, k); ball.position.y += Math.sin(Math.PI * k) * peak; if (k < 1) return true;
          const hit = cups.find((c) => c.up && Math.hypot(c.x - to.x, c.z - to.z) < 0.042);
          if (hit) { hit.up = false; hit.m.visible = false; hit.b.visible = false; Sfx.play("checkpoint"); ball.visible = false; busy = false; cb(true); return false; }
          Sfx.play("step"); k2 = 0; return true;
        }
        k2 += dt / 0.33; ball.position.x += dir.x * 0.04 * dt * 60; ball.position.z += dir.z * 0.04 * dt * 60;   // a miss bounces on and off the end
        ball.position.y = to.y + Math.abs(Math.sin(k2 * Math.PI * 2)) * 0.12 * (1 - k2) - (k2 > 0.8 ? (k2 - 0.8) * 2 : 0);
        if (k2 < 1) return true; ball.visible = false; busy = false; cb(false); return false;
      });
    };
    const botShot = () => {
      const target = pick(PONG.mine.filter((c) => c.up)); const to = new V3(target.x + gauss() * 0.05, PONG.at.y + 0.12, target.z + gauss() * 0.05);
      shoot(new V3(PONG.at.x, 1.35, PONG.at.z + PONG.half + 0.3), to, PONG.mine, (hit) => { pop(hit ? "heartlarva sinks one 🍺" : "heartlarva misses", 900); if (!left(PONG.mine)) return finish(false); turn = "me"; draw(); });
    };
    const finish = (won) => { pay(won ? STAKE * 2 : 0, "for winning at beer pong", "🍺"); started = false; Sfx.play(won ? "finish" : "fall");
      hud.innerHTML = `<h4>${won ? "YOU WIN" : "HEARTLARVA WINS"}</h4><div class="k">${won ? `You take the pot: ${STAKE * 2} 🎟️` : "Drink up. Rematch?"}</div><div class="row"><button type="button" class="ak-btn sm" data-mg="again">Rack 'em · ${STAKE} 🎟️</button><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`; };
    const begin = () => { if (wallet.tickets < STAKE) { A.notify("Not enough tickets: Lucky sells them.", "🎟️", "pink"); return false; } wallet.tickets -= STAKE; resetCups(); started = true; turn = "me"; draw(); return true; };
    return {
      start() { placeMe(PONG.at.x, PONG.at.z - PONG.half - 0.45, Math.PI); A.setWhere("playing beer pong"); if (!begin()) hud.innerHTML = `<h4>BEER PONG</h4><div class="k">You need ${STAKE} 🎟️.</div><div class="row"><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`; },
      cam(pos, look) { pos.set(PONG.at.x, 1.75, PONG.at.z - PONG.half - 0.95); look.set(PONG.at.x, 0.75, PONG.at.z + 0.7); return true; },
      pointer(type, e) {
        const r = pointerRay(e), hit = r.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), -(PONG.at.y + 0.12)), new V3());
        if (hit) aimP.set(clamp(hit.x, PONG.at.x - 0.3, PONG.at.x + 0.3), PONG.at.y + 0.12, clamp(hit.z, PONG.at.z, PONG.at.z + PONG.half));
        if (type === "down" && started && turn === "me" && !busy) {
          const t = performance.now() / 1000 - t0, w = wobble();
          const to = new V3(aimP.x + Math.sin(t * 2.3) * w + gauss() * 0.012, aimP.y, aimP.z + Math.cos(t * 1.9) * w + gauss() * 0.012);
          shoot(new V3(PONG.at.x, 1.35, PONG.at.z - PONG.half - 0.3), to, PONG.theirs, (hit2) => { pop(hit2 ? "SPLASH! 🍺" : "MISS"); if (!left(PONG.theirs)) return finish(true); turn = "bot"; draw(); later(0.9, botShot); });
          draw("…");
        }
      },
      key() {},
      step() { const t = performance.now() / 1000 - t0, w = wobble(); reticle.position.set(aimP.x + Math.sin(t * 2.3) * w, PONG.at.y + 0.125, aimP.z + Math.cos(t * 1.9) * w); reticle.visible = started && turn === "me" && !busy; },
      get aim() { return aimP; }, get theirs() { return PONG.theirs.map((c) => [c.x, c.z, c.up]); },
      button(k) { if (k === "again") begin(); },
      end() { scene.remove(ball); scene.remove(reticle); resetCups(); if (started) A.notify(`You walked away: heartlarva keeps your ${STAKE} 🎟️.`, "🍺"); }
    };
  }

  /* ---- FISHING: cast, wait for the bite, strike (E or click) inside a second, then reel: hold to push your green zone up the line and keep the
     fish inside it until the bar fills. Rarer fish fight harder. PvE: pays tickets by size; the biggest go on the board. */
  const FISH = [
    { name: "Bluegill", w: 55, kg: [0.1, 0.4], tix: 3, speed: 0.55, icon: "🐟" }, { name: "Yellow Perch", w: 20, kg: [0.2, 0.6], tix: 6, speed: 0.75, icon: "🐟" },
    { name: "Channel Catfish", w: 10, kg: [1, 6], tix: 15, speed: 0.7, icon: "🐡" }, { name: "Largemouth Bass", w: 9, kg: [0.8, 4], tix: 20, speed: 1.05, icon: "🐟" },
    { name: "Koi", w: 3.5, kg: [1, 5], tix: 35, speed: 1, icon: "🐠" }, { name: "Golden Trophy Bass", w: 0.8, kg: [3, 7], tix: 150, speed: 1.55, icon: "🏆" },
    { name: "Old Boot", w: 2.5, kg: [0.6, 1.2], tix: 0, speed: 0.3, icon: "🥾", junk: "It's soggy." }, { name: "Someone's Fantasy Draft Notes", w: 1, kg: [0.05, 0.1], tix: 1, speed: 0.3, icon: "📝", junk: "They drafted a kicker in round 2." }
  ];
  const pickFish = () => { const tot = FISH.reduce((s, f) => s + f.w, 0); let r = Math.random() * tot; for (const f of FISH) { r -= f.w; if (r <= 0) return f; } return FISH[0]; };
  function fishMode(spot) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 1.7, 6), std(0x2a2a30, { roughness: 0.4 })); scene.add(rod);
    const bob = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), basic(0xff3b4e)); bob.add(b1); const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), basic(0xffffff)); b2.position.y = 0.04; bob.add(b2); bob.visible = false; scene.add(bob);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xdddddd })); scene.add(line); line.visible = false;
    const fx = Math.sin(spot.face), fz = Math.cos(spot.face);   // which way is the water
    let state = "idle", timer = 0, cast = null, fish = null, reel = null, bite = null, holding = false;
    const tip = new V3();
    const setRod = () => { const base = new V3(me.p.x + fx * 0.35, 0.95, me.p.z + fz * 0.35); tip.set(base.x + fx * 1.2, 2.1, base.z + fz * 1.2); rod.position.copy(base).lerp(tip, 0.5); rod.lookAt(tip); rod.rotateX(Math.PI / 2); };
    const draw = () => {
      if (state === "reel") return;
      hud.innerHTML = `<h4>FISHING</h4><div class="k">${state === "idle" ? "Press <b>E</b> or click to cast" : state === "cast" ? "…" : state === "wait" ? "Wait for a bite. When the float dips, press <b>E</b> or click!" : ""}</div>
        <div class="row">${state === "idle" ? `<button type="button" class="ak-btn sm" data-mg="cast">Cast</button>` : ""}<button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div><div class="k">Q to leave</div>`;
    };
    const doCast = () => {
      if (state !== "idle") return; state = "cast"; Sfx.play("jump");
      let d = rnd(2.6, 4.2), sx = rnd(-1.2, 1.2), tx = me.p.x + fx * d + fz * sx, tz = me.p.z + fz * d - fx * sx;
      const ex = (tx - POND.cx) / POND.rx, ez = (tz - POND.cz) / POND.rz, e2 = Math.hypot(ex, ez); if (e2 > 0.82) { tx = POND.cx + (ex / e2) * POND.rx * 0.8; tz = POND.cz + (ez / e2) * POND.rz * 0.8; }
      cast = { t: 0, to: new V3(tx, 0.03, tz) }; bob.visible = true; line.visible = true; draw();
    };
    const strike = () => {
      if (state === "bite") { state = "reel"; fish = pickFish(); bite?.remove(); bite = null; startReel(); Sfx.play("go"); }
      else if (state === "wait") { pop("Too early!", 800); }
      else if (state === "idle") doCast();
    };
    const startReel = () => {
      reel = { fish: rnd(0.2, 0.8), fv: 0, zone: 0.35, zv: 0, prog: 0.3, size: Math.max(0.16, 0.3 - fish.speed * 0.06) };
      hud.innerHTML = `<h4>REEL IT IN!</h4><div class="mg-reel"><div class="zone"></div><div class="fish">❓</div></div><div class="meter"><i></i></div><div class="k"><b>Hold</b> click or Space to pull your green zone right; let go and it drifts back. Keep the fish inside it.</div>`;
    };
    const land = () => {
      const kg = Math.round(rnd(fish.kg[0], fish.kg[1]) * 10) / 10, mid = (fish.kg[0] + fish.kg[1]) / 2, tix = Math.max(0, Math.round(fish.tix * (kg / mid)));
      const name = A.me?.name || "You";
      hud.innerHTML = `<h4>${fish.icon} ${esc(fish.name.toUpperCase())}</h4><div class="big">${kg.toFixed(1)} kg</div><div class="k">${fish.junk ? esc(fish.junk) + " " : ""}${tix ? `+${tix} 🎟️` : "No tickets for that one."}</div>
        <div class="row"><button type="button" class="ak-btn sm" data-mg="again">Cast again</button><button type="button" class="ak-btn sm ghost" data-mg="leave">Leave</button></div>`;
      if (tix) pay(tix, `for a ${kg.toFixed(1)} kg ${fish.name}`, fish.icon);
      if (!fish.junk) { POND.board.catches.push({ name, fish: fish.name, kg }); drawCatchBoard(); }
      if (fish.tix >= 35) A.localChat("", `${name} caught a ${kg.toFixed(1)} kg ${fish.name}! ${fish.icon}`, true);
      Sfx.play(fish.tix >= 35 ? "finish" : "checkpoint"); state = "done"; bob.visible = false; line.visible = false;
    };
    return {
      start() { placeMe(spot.x, spot.z, spot.face + Math.PI); A.setWhere("fishing at the pond"); setRod(); draw(); },
      cam(pos, look) { pos.set(me.p.x - fx * 2.6 + fz * 0.8, 2.3, me.p.z - fz * 2.6 - fx * 0.8); look.set(me.p.x + fx * 3, 0.2, me.p.z + fz * 3); return true; },
      pointer(type) { if (type === "down") { if (state === "reel") holding = true; else strike(); } if (type === "up") holding = false; },
      key(e, down) { if (e.code === "KeyE" && down) strike(); if (e.code === "Space") holding = down && state === "reel"; },
      step(dt, t) {
        setRod();
        if (state === "cast") { cast.t += dt / 0.7; const k = Math.min(1, cast.t); bob.position.lerpVectors(tip, cast.to, k); bob.position.y += Math.sin(Math.PI * k) * 1.2; if (k >= 1) { state = "wait"; timer = rnd(2.5, 8); draw(); Sfx.play("step"); } }
        if (state === "wait") { bob.position.y = 0.03 + Math.sin(t * 2.2) * 0.012; timer -= dt; if (timer <= 0) { state = "bite"; timer = 1.0; bite = document.createElement("div"); bite.className = "mg-bite"; bite.textContent = "!"; document.querySelector(".stage").append(bite); Sfx.play("beep"); } }
        if (state === "bite") { bob.position.y = -0.03 + Math.sin(t * 30) * 0.015; timer -= dt; if (timer <= 0) { bite?.remove(); bite = null; pop("It got away…", 900); state = "wait"; timer = rnd(2.5, 7); draw(); } }
        if (state === "reel") {
          const R2 = reel, sp = fish.speed;
          R2.fv += (Math.random() - 0.5) * sp * 6 * dt; R2.fv *= 0.97; if (Math.random() < dt * sp * 1.2) R2.fv = (Math.random() - 0.5) * sp * 1.4;
          R2.fish = clamp(R2.fish + R2.fv * dt, 0.03, 0.97); if (R2.fish <= 0.03 || R2.fish >= 0.97) R2.fv *= -0.6;
          const hold = holding || tstate.jump; R2.zv += (hold ? 1.6 : -1.4) * dt; R2.zv = clamp(R2.zv, -0.9, 0.9); R2.zone = clamp(R2.zone + R2.zv * dt, 0, 1 - R2.size); if (R2.zone <= 0 || R2.zone >= 1 - R2.size) R2.zv *= -0.3;
          const inside = R2.fish >= R2.zone && R2.fish <= R2.zone + R2.size; R2.prog = clamp(R2.prog + (inside ? 0.3 : -0.2) * dt, 0, 1);
          const z = hud.querySelector(".zone"), f = hud.querySelector(".fish"), m = hud.querySelector(".meter i");
          if (z) { z.style.left = `${R2.zone * 100}%`; z.style.width = `${R2.size * 100}%`; f.style.left = `${R2.fish * 100}%`; m.style.width = `${R2.prog * 100}%`; }
          bob.position.y = -0.02 + Math.sin(t * 18) * 0.02;
          if (R2.prog >= 1) land(); else if (R2.prog <= 0) { pop("It snapped the line!", 1100); Sfx.play("bonk"); state = "idle"; bob.visible = false; line.visible = false; draw(); }
        }
        if (line.visible) { const a = line.geometry.attributes.position; a.setXYZ(0, tip.x, tip.y, tip.z); a.setXYZ(1, bob.position.x, bob.position.y + 0.04, bob.position.z); a.needsUpdate = true; }
      },
      button(k) { if (k === "cast") doCast(); if (k === "again") { state = "idle"; doCast(); } },
      end() { scene.remove(rod); scene.remove(bob); scene.remove(line); bite?.remove(); }
    };
  }

  /* ================================================================== the interface lounge.js uses */
  return {
    spots,
    active: () => Boolean(mode),
    step(dt, t) { for (const f of tickers) f(dt, t); for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](dt)) anims.splice(i, 1); const off = ctx.botsOn(); for (const p of crowd) { p.g.visible = off; p.ch?.update(dt); } mode?.step(dt, t); },
    cam(pos, look) { return mode?.cam ? mode.cam(pos, look) : false; },
    pointer(type, e) { mode?.pointer?.(type, e); },
    key(e, down) { if (down && e.code === "KeyQ") return endMode(); mode?.key?.(e, down); },
    leave: endMode,
    get mode() { return mode; }   // for tests
  };
}

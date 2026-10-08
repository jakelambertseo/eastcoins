/* The lounge's extra rooms (2026-10-07 mockup, the owner: "mock up the bar games corner and the patio pond").

   THE BAR GAMES CORNER, through an open arch in the lounge's south-east wall: two skee-ball lanes (PvE: free, pays tickets), darts and beer
   pong (PvP: staked in tickets, here against a bot), and a shuffleboard that's out of order.
   THE PATIO, through the lounge's east wall: a garden in daylight with a fire pit, and a pond with a dock. Fishing is
   PvE and pays tickets; the biggest catches go on the board by the dock.

   Every game here is a MODE: walk up, press E, and it takes the camera and the controls until you leave (Q, or the Leave button). The games
   are played in the page for the mockup; on the site the room server would deal the noise (the seeded scatter of a throw, the bite, the
   fish) so a result can't be made up, the way it runs air hockey. Tickets come from and go to the lounge's preview wallet.

   buildExtras(ctx) -> { spots, step(dt, t), cam(pos, look), active(), key(e, down), pointer(type, e) }  (see lounge.js) */
import { buildDash } from "./dash.js?v=1";

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
  REGIONS.push({ name: "bar", x0: BX0, x1: BX1, z0: D, z1: BZ1, ceil: 5 });
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
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(BX1 - BX0 + 0.6, BZ1 - D + 0.3), new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.set((BX0 + BX1) / 2, 5, (D + BZ1) / 2 + 0.15); scene.add(ceil);
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
  const PX0 = W, PX1 = W + 16, PZ0 = -22, PZ1 = 0, PO0 = -10.6, PO1 = -5.8, POH = 3.6, GATE0 = W + 4, GATE1 = W + 12;   // GATE: where the Dash leaves the garden (dash.js)
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
    /* THE DOORS (2026-10-07, the owner: "add open glass doors to the patio entrance"): a dark metal frame round the opening, and two tall
       French doors, each a metal frame with two panes, swung out and folded back against the outside wall. */
    const metal = std(0x23262e, { metalness: 0.6, roughness: 0.35 }), glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const fx = W + 0.16;
    for (const z of [PO0, PO1]) mesh(new THREE.BoxGeometry(0.34, POH, 0.12), metal, fx, POH / 2, z);           // jambs
    mesh(new THREE.BoxGeometry(0.34, 0.14, PO1 - PO0 + 0.12), metal, fx, POH - 0.07, (PO0 + PO1) / 2);    // header
    mesh(new THREE.BoxGeometry(0.34, 0.03, PO1 - PO0), metal, fx, 0.015, (PO0 + PO1) / 2);                // threshold
    const leafW = (PO1 - PO0) / 2, leafH = POH - 0.16;
    // side +1: hinged on the north jamb, the leaf reaching south across the opening when shut; -1: the south one, reaching north.
    // Opened outward and round to nearly flat against the outside wall: the leaf's reach (0, 0, side) turns to (small +x, 0, -side).
    function door(hingeZ, side) {
      const pivot = new THREE.Group(); pivot.position.set(W + 0.33, 0, hingeZ); scene.add(pivot);
      const leaf = new THREE.Group(); leaf.position.z = side * leafW / 2; pivot.add(leaf);
      const bar = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal); m.position.set(x, y, z); m.castShadow = true; leaf.add(m); };
      bar(0.06, leafH, 0.08, 0, leafH / 2, -leafW / 2 + 0.04); bar(0.06, leafH, 0.08, 0, leafH / 2, leafW / 2 - 0.04);   // stiles
      bar(0.06, 0.08, leafW, 0, 0.04, 0); bar(0.06, 0.08, leafW, 0, leafH - 0.04, 0); bar(0.06, 0.06, leafW, 0, leafH * 0.45, 0);   // rails
      for (const [y0, y1] of [[0.08, leafH * 0.45 - 0.03], [leafH * 0.45 + 0.03, leafH - 0.08]]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.015, y1 - y0, leafW - 0.16), glass); g.position.set(0, (y0 + y1) / 2, 0); leaf.add(g); }
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.03), std(0xc9a227, { metalness: 0.8, roughness: 0.25 })); handle.position.set(0.05, 1.05, side * (leafW / 2 - 0.16)); leaf.add(handle);   // at the free edge
      pivot.rotation.y = side * (Math.PI - 0.15);
      return pivot;
    }
    door(PO0, 1); door(PO1, -1);
    const s = plaque("PATIO", 3, 0.7, { glow: "#b6ff2e", fill: "#efffd0" }); s.position.set(W - 0.02, POH + 0.75, (PO0 + PO1) / 2); s.rotation.y = -Math.PI / 2; scene.add(s);
    // grass, with a little variety in it
    const grass = canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#4a8a38"; g.fillRect(0, 0, w, h); for (let k = 0; k < 3500; k++) { g.fillStyle = pick(["#5a9a44", "#3f7a30", "#6aaa52", "#447f34"]); g.fillRect(Math.random() * w, Math.random() * h, 2, 5 + Math.random() * 6); } });
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set((PX1 - PX0) / 4, (PZ1 - PZ0) / 4);
    const gr = mesh(new THREE.PlaneGeometry(PX1 - PX0 + 2, PZ1 - PZ0 + 2), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }), (PX0 + PX1) / 2, 0.001, (PZ0 + PZ1) / 2); gr.rotation.x = -Math.PI / 2;
    // the deck by the door
    const planks = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#5a3a20" : "#664428"; g.fillRect(0, i * 32, w, 31); g.fillStyle = "#3a2410"; g.fillRect(0, i * 32 + 31, w, 1); } });
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2.5, 4);
    const deck = mesh(new THREE.BoxGeometry(5.5, 0.12, 9.5), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.8 }), W + 2.75, 0.06, -8.2);
    const dock = mesh(new THREE.BoxGeometry(DOCK.x1 - DOCK.x0 + 0.2, 0.1, DOCK.z1 - DOCK.z0), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.8 }), (DOCK.x0 + DOCK.x1) / 2, 0.12, (DOCK.z0 + DOCK.z1) / 2);
    for (const x of [DOCK.x0 + 1, DOCK.x1 - 0.1]) for (const z of [DOCK.z0 + 0.05, DOCK.z1 - 0.05]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), std(0x3a2410), x, 0.05, z);
    // the pond: a muddy bank, water with the light drifting across it, lily pads and reeds
    const bank = mesh(new THREE.CircleGeometry(1, 48), std(0x1a140c, { roughness: 1 }), POND.cx, 0.006, POND.cz); bank.rotation.x = -Math.PI / 2; bank.scale.set(POND.rx + 0.45, POND.rz + 0.45, 1);
    const shine = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.35})`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 1.5); } });
    shine.wrapS = shine.wrapT = THREE.RepeatWrapping; shine.repeat.set(2, 2);
    const water = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x3a8aaa, roughness: 0.08, metalness: 0.35, emissive: 0xffffff, emissiveMap: shine, emissiveIntensity: 0.22 }), POND.cx, 0.012, POND.cz);
    water.rotation.x = -Math.PI / 2; water.scale.set(POND.rx, POND.rz, 1); water.receiveShadow = true; POND.water = water; POND.shine = shine;
    for (let k = 0; k < 9; k++) { const a = rnd(0, 7), rr = rnd(0.35, 0.85); const pad = mesh(new THREE.CircleGeometry(0.22, 12, 0.3, Math.PI * 1.85), std(0x3a8a3a), POND.cx + Math.cos(a) * POND.rx * rr, 0.02, POND.cz + Math.sin(a) * POND.rz * rr); pad.rotation.x = -Math.PI / 2; }
    for (let k = 0; k < 26; k++) { const a = rnd(0, 7), x = POND.cx + Math.cos(a) * (POND.rx + rnd(-0.1, 0.3)), z = POND.cz + Math.sin(a) * (POND.rz + rnd(-0.1, 0.3)); if (x < DOCK.x1 + 0.6 && Math.abs(z - (DOCK.z0 + DOCK.z1) / 2) < 1.2) continue; const h = rnd(0.6, 1.1); mesh(new THREE.CylinderGeometry(0.012, 0.015, h, 5), std(0x3a5a20), x, h / 2, z); mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 6), std(0x4a2a14), x, h - 0.05, z); }
    for (let k = 0; k < 16; k++) { const a = rnd(0, 7); const rk = mesh(new THREE.DodecahedronGeometry(rnd(0.12, 0.3), 0), std(0x4a4a50, { roughness: 0.9 }), POND.cx + Math.cos(a) * (POND.rx + 0.4), 0.05, POND.cz + Math.sin(a) * (POND.rz + 0.4)); rk.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
    // trees and bushes round the edge, low-poly
    const trunkM = std(0x3a2414, { roughness: 1 }), leafM = [std(0x2f6a2a, { roughness: 1 }), std(0x3a7a32, { roughness: 1 }), std(0x285a24, { roughness: 1 })];
    const treeAt = [[PX1 - 0.9, -17.6], [PX1 - 1.5, -15], [PX1 - 1.1, -8.5], [PX1 - 1.6, -2], [W + 13.5, PZ0 + 1.6], [W + 7.5, -1.2], [W + 12, -0.9], [W + 15, -17.5]];
    for (const [x, z] of treeAt) { const h = rnd(2.6, 4); mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.4, 7), trunkM, x, h * 0.2, z); for (let k = 0; k < 3; k++) mesh(new THREE.ConeGeometry(1.2 - k * 0.3, h * 0.45, 7), pick(leafM), x, h * 0.4 + k * h * 0.22, z); block(x, z, 0.5, 0.5); }
    for (let k = 0; k < 14; k++) { const x = rnd(PX0 + 6.2, PX1 - 0.6), z = pick([rnd(PZ0 + 0.5, PZ0 + 2.5), rnd(PZ1 - 2.2, PZ1 - 0.4)]); if (z < PZ0 + 3 && x > GATE0 - 1 && x < GATE1 + 1) continue; mesh(new THREE.IcosahedronGeometry(rnd(0.35, 0.6), 0), pick(leafM), x, 0.3, z); }
    // a low fence round the garden
    const posts = []; const fenceAt = (x, z) => posts.push(new THREE.Matrix4().makeTranslation(x, 0.45, z));
    for (let x = PX0 + 0.5; x <= PX1; x += 1.6) { if (x < GATE0 - 0.1 || x > GATE1 + 0.1) fenceAt(x, PZ0); fenceAt(x, PZ1); }   // a gap in the north fence: the Dash for (let z = PZ0; z <= PZ1; z += 1.6) fenceAt(PX1, z);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), std(0x5a3a20), posts.length); posts.forEach((m, k) => pm.setMatrixAt(k, m)); scene.add(pm);
    for (const [w, d, x, z] of [[GATE0 - PX0, 0.06, (PX0 + GATE0) / 2, PZ0], [PX1 - GATE1, 0.06, (GATE1 + PX1) / 2, PZ0], [PX1 - PX0, 0.06, (PX0 + PX1) / 2, PZ1], [0.06, PZ1 - PZ0, PX1, (PZ0 + PZ1) / 2]]) for (const y of [0.35, 0.75]) box(w, 0.08, d, std(0x6a4428), x, y, z);
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
    // a cooler and some empties on the deck
    mesh(new THREE.BoxGeometry(0.6, 0.38, 0.38), std(0xd0182a, { roughness: 0.5 }), W + 4.6, 0.31, -5.0); mesh(new THREE.BoxGeometry(0.62, 0.06, 0.4), std(0xd8d8d8), W + 4.6, 0.53, -5.0);
    block(W + 4.6, -5.0, 0.7, 0.45);
    /* DAYTIME (2026-10-07, the owner: "make the outside area light outside as well and remove the fireflies/string lights"). A sky
       round the garden (painted panels, unlit and unfogged, so they read the same from anywhere), a sun in it, and one wide warm
       spotlight from high above that lights the garden like daylight without reaching into the lounge. */
    /* THE WORLD OUTSIDE (2026-10-07, the owner, looking at the black round the building: "build 1 and 2, add the stadium").
       1. A full sky: one dome round the whole place (unlit, unfogged, kept under the bloom threshold); the rooms' ceilings keep it out of
          doors. Grass out to the horizon, a treeline, low hills, and a stadium in the distance with its light towers on and a blimp.
          Outdoors the haze turns pale blue so the far ground melts into the sky instead of into black (see the tick below).
       2. The building's outside: brick on the faces you can see from the garden, a roof with a parapet, AC units and a dish, a big neon
          THE LOUNGE sign on the roof facing the patio, glowing windows, a game-day mural by the doors, lamps by the doors, a gutter.
       Nothing here is a light: it all glows by itself or is lit by the daylight that's already there. */
    const HORIZON = 0xb8dcf2;
    {
      const skyTex = canvasTex(1024, 512, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1f5fc8"); gr.addColorStop(0.42, "#4f9ae6"); gr.addColorStop(0.5, "#b8dcf2"); gr.addColorStop(1, "#b8dcf2"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 16; k++) { const cx = rnd(0, w), cy = rnd(h * 0.18, h * 0.44); for (let j = 0; j < 7; j++) { g.fillStyle = "rgba(255,255,255,.72)"; g.beginPath(); g.ellipse(cx + rnd(-50, 50), cy + rnd(-8, 8), rnd(22, 46), rnd(8, 16), 0, 0, 7); g.fill(); } }
      });
      skyTex.wrapS = THREE.RepeatWrapping;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 40, 20), new THREE.MeshBasicMaterial({ map: skyTex, color: 0xeeeeee, side: THREE.BackSide, fog: false, depthWrite: false }));
      dome.position.set(10, 0, -5); dome.renderOrder = -1; scene.add(dome);
    }
    // grass to the horizon, under everything (the rooms' floors sit just above it)
    {
      const far = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#4a8a38"; g.fillRect(0, 0, w, h); for (let k = 0; k < 900; k++) { g.fillStyle = pick(["#5a9a44", "#3f7a30", "#6aaa52", "#447f34"]); g.fillRect(Math.random() * w, Math.random() * h, 2, 4); } });
      far.wrapS = far.wrapT = THREE.RepeatWrapping; far.repeat.set(70, 70);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ map: far, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(10, -0.03, -5); ground.receiveShadow = true; scene.add(ground);
    }
    // a treeline out past the fence (two instanced meshes, so ~140 trees cost two draws), and low hills behind
    {
      const trunks = [], tops = [], c = new V3(W + 8, 0, -11);
      for (let k = 0; k < 150; k++) {
        const a = rnd(0, Math.PI * 2), r = rnd(30, 75), x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (x < W + 3 && z > -16 && z < 24) continue;                       // not on the building
        if (Math.hypot(x - 140, z + 85) < 50) continue;       // nor on the stadium
        if (x > GATE0 - 6 && x < GATE1 + 6 && z < PZ0 + 2 && z > PZ0 - 82) continue;   // nor on the Dash
        const h = rnd(4, 9), q = new THREE.Quaternion(), sc = new V3(h / 6, h / 6, h / 6);
        trunks.push(new THREE.Matrix4().compose(new V3(x, h * 0.12, z), q, new V3(1, h / 4, 1)));
        tops.push(new THREE.Matrix4().compose(new V3(x, h * 0.55, z), q, sc));
      }
      const tI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 1, 6), std(0x3a2414, { roughness: 1 }), trunks.length); trunks.forEach((m, k) => tI.setMatrixAt(k, m)); scene.add(tI);
      const cI = new THREE.InstancedMesh(new THREE.ConeGeometry(2, 6, 7), std(0x2f6a2a, { roughness: 1 }), tops.length); tops.forEach((m, k) => cI.setMatrixAt(k, m)); scene.add(cI);
      for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2 + rnd(-0.2, 0.2), r = rnd(118, 135); if (Math.hypot(10 + Math.cos(a) * r - 140, -5 + Math.sin(a) * r + 85) < 70) continue; const hill = new THREE.Mesh(new THREE.SphereGeometry(rnd(28, 44), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(pick([0x3f7a3a, 0x4a8a42, 0x356a32]), { roughness: 1 })); hill.scale.y = rnd(0.25, 0.45); hill.position.set(10 + Math.cos(a) * r, -0.5, -5 + Math.sin(a) * r); scene.add(hill); }
    }
    // THE STADIUM on the horizon, to the north-east: an oval bowl, an upper deck, light towers lit for a night game, a blimp over it
    const blimp = new THREE.Group(), STAD = { x: 140, z: -85 };   // far enough to sit in the haze
    {
      const S = new THREE.Group(); S.position.set(STAD.x, 0, STAD.z); S.rotation.y = 0.5; scene.add(S);
      const concrete = canvasTex(512, 128, (g, w, h) => { g.fillStyle = "#8a8c94"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = "#5a5c66"; g.fillRect(x, 20, 6, h - 40); } g.fillStyle = "#6a6c74"; g.fillRect(0, h * 0.48, w, 6); });
      concrete.wrapS = THREE.RepeatWrapping; concrete.repeat.set(10, 1);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 15, 48, 1, true), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9, side: THREE.DoubleSide })); bowl.scale.set(1.45, 1, 1); bowl.position.y = 7.5; S.add(bowl);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(27, 24, 6, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x6a6c76, roughness: 0.9, side: THREE.DoubleSide })); deck.scale.set(1.45, 1, 1); deck.position.y = 18; S.add(deck);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(27, 0.5, 6, 64), basic(new THREE.Color(0xffffff).multiplyScalar(0.55))); rim.rotation.x = Math.PI / 2; rim.scale.set(1.45, 1, 1); rim.position.y = 21; S.add(rim);
      const field = new THREE.Mesh(new THREE.CircleGeometry(22, 40), std(0x3f8a3a)); field.rotation.x = -Math.PI / 2; field.scale.set(1.45, 1, 1); field.position.y = 0.05; S.add(field);
      const bank = basic(new THREE.Color(0xfff6d8).multiplyScalar(0.9)), steel = std(0x9a9ca4, { metalness: 0.6, roughness: 0.4 });
      for (const [x, z] of [[-33, -20], [33, -20], [-33, 20], [33, 20]]) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 34, 8), steel); tower.position.set(x, 17, z); S.add(tower);
        const lights = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.6), bank); lights.position.set(x * 0.94, 34.5, z * 0.94); lights.lookAt(S.position.x, 0, S.position.z); S.add(lights);
      }
      // the blimp: an ellipsoid with a gondola and a sign, slowly circling
      const env = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), std(0xe8e8ee, { roughness: 0.5 })); env.scale.set(9, 2.6, 2.6); blimp.add(env);
      const gon = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), std(0x2a2a34)); gon.position.y = -2.7; blimp.add(gon);
      for (const fz of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 1.6), std(0xff2d95)); fin.position.set(-8, 0, fz * 1.2); blimp.add(fin); }
      const tag = canvasTex(1024, 220, (g, w, h) => { g.fillStyle = "#ff2d95"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "140px Bungee"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EASTCOIN", w / 2, h / 2 + 6); });
      for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.9), new THREE.MeshStandardMaterial({ map: tag, roughness: 0.6 })); p.position.set(0, 0, sz * 2.62); if (sz < 0) p.rotation.y = Math.PI; blimp.add(p); }
      blimp.position.set(STAD.x, 44, STAD.z); scene.add(blimp);
    }
    // the building's outside: brick on the faces the garden can see, the roof, the sign, windows, the mural, lamps, a gutter
    {
      const brick = (w, h) => { const t = canvasTex(256, 128, (g, cw, ch) => { g.fillStyle = "#2a1a1c"; g.fillRect(0, 0, cw, ch); for (let r = 0; r < 8; r++) for (let c = -1; c < 9; c++) { g.fillStyle = pick(["#5a2a24", "#642e26", "#4e2420", "#6a3428"]); g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 2, h / 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); };
      const face = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), brick(w, h)); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
      const ex = W + 0.32, WH = 6;
      // the east face: round the patio doors, then the bar games room's side (5 high) further south
      face(PO0 + D + 0.3, WH, ex, WH / 2, (-D - 0.3 + PO0) / 2, Math.PI / 2);
      face(D - PO1, WH, ex, WH / 2, (PO1 + D) / 2, Math.PI / 2);
      face(PO1 - PO0, WH - POH, ex, POH + (WH - POH) / 2, (PO0 + PO1) / 2, Math.PI / 2);
      face(BZ1 + 0.3 - D, 5, ex, 2.5, (D + BZ1 + 0.3) / 2, Math.PI / 2);
      face(2 * W + 0.6, WH, 0, WH / 2, -D - 0.32, Math.PI);   // the north face, seen at an angle from the garden
      // the roof: tar and gravel, a parapet, AC units, a vent, a dish
      const gravel = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#3a3a40"; g.fillRect(0, 0, w, h); for (let k = 0; k < 2500; k++) { g.fillStyle = pick(["#4a4a52", "#2e2e34", "#55555c"]); g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }); gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping; gravel.repeat.set(8, 6);
      const roofM = new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 });
      const roof = (x0, x1, z0, z1, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), roofM); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); };
      roof(-W - 0.3, W + 0.33, -D - 0.33, D + 0.3, WH + 0.02); roof(ctx.PK_X0 - 0.3, ctx.PK_X1 + 0.3, D + 0.3, ctx.PK_Z1 + 0.3, 5.02); roof(BX0 - 0.3, BX1 + 0.33, D + 0.3, BZ1 + 0.3, 5.02);
      const cap = std(0x4a4a52, { roughness: 0.8 });
      for (const [w, d, x, z] of [[2 * W + 0.66, 0.3, 0, -D - 0.33], [0.3, 2 * D + 0.6, W + 0.33, 0], [0.3, 2 * D + 0.6, -W - 0.3, 0]]) box(w, 0.55, d, cap, x, WH + 0.28, z);
      const unit = (x, z) => { box(2.2, 1.2, 1.4, std(0xb8bcc4, { metalness: 0.4, roughness: 0.5 }), x, WH + 0.62, z); const fan = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), std(0x2a2a30)); fan.rotation.x = -Math.PI / 2; fan.position.set(x + 0.5, WH + 1.23, z); scene.add(fan); };
      unit(9.5, -6.5); unit(6.5, -6.5);
      mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4, 10), std(0x8a8c94, { metalness: 0.5 }), 3, WH + 0.7, -8);
      { const dish = mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), std(0xd8d8de, { side: THREE.DoubleSide }), 12.6, WH + 1.2, -9.4); dish.rotation.x = -Math.PI / 2.4; dish.rotation.z = 0.6; }
      // the rooftop sign, facing the garden
      { const sg = new THREE.Group(); sg.position.set(W - 1.2, WH, -4.5); sg.rotation.y = Math.PI / 2; scene.add(sg);
        for (const x of [-3.6, 3.6]) mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), std(0x2a2a30, { metalness: 0.6 }), x, 1.3, -0.2, sg);
        mesh(new THREE.BoxGeometry(7.6, 0.1, 0.12), std(0x2a2a30, { metalness: 0.6 }), 0, 0.6, -0.2, sg);
        const t = canvasTex(2048, 360, (g, w, h) => { g.textBaseline = "middle"; g.font = "220px Monoton"; g.textAlign = "left"; const a = g.measureText("THE ").width, b = g.measureText("LOUNGE").width, x0 = (w - a - b) / 2;
          g.shadowBlur = 26; g.shadowColor = "#ff2d95"; g.fillStyle = "#ffc8e4"; g.fillText("THE", x0, h / 2 + 8); g.shadowColor = "#19e3ff"; g.fillStyle = "#c8f6ff"; g.fillText("LOUNGE", x0 + a, h / 2 + 8); });
        const p = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.34), basic(0xffffff, { map: t, transparent: true })); p.position.set(0, 1.85, 0); sg.add(p); }
      // windows with warm light behind the blinds
      const win = canvasTex(128, 96, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ffd890"); gr.addColorStop(1, "#ff9a50"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(80,30,10,.45)"; for (let y = 6; y < h; y += 10) g.fillRect(0, y, w, 3); g.fillStyle = "#222"; g.fillRect(w / 2 - 2, 0, 4, h); });
      for (const [z, y, w, h] of [[2.2, 3.3, 1.8, 1.2], [5.6, 3.3, 1.8, 1.2], [14.2, 2.9, 1.6, 1.1], [17.6, 2.9, 1.6, 1.1]]) {
        const fr = mesh(new THREE.BoxGeometry(0.08, h + 0.2, w + 0.2), std(0x1a1a20), ex + 0.02, y, z);
        const g2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(new THREE.Color(0xffffff).multiplyScalar(0.75), { map: win })); g2.position.set(ex + 0.07, y, z); g2.rotation.y = Math.PI / 2; scene.add(g2);
      }
      // the mural beside the doors: GAME DAY, a football in flight between the posts
      { const t = canvasTex(1024, 640, (g, w, h) => {
          const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1a0f40"); gr.addColorStop(1, "#5a0f3a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
          g.strokeStyle = "#ffd400"; g.lineWidth = 18; g.beginPath(); g.moveTo(760, 600); g.lineTo(760, 300); g.moveTo(640, 300); g.lineTo(880, 300); g.moveTo(640, 300); g.lineTo(640, 120); g.moveTo(880, 300); g.lineTo(880, 120); g.stroke();
          g.setLineDash([16, 18]); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 6; g.beginPath(); g.moveTo(180, 520); g.quadraticCurveTo(450, 40, 740, 200); g.stroke(); g.setLineDash([]);
          g.save(); g.translate(740, 200); g.rotate(-0.5); g.fillStyle = "#8a4a22"; g.beginPath(); g.ellipse(0, 0, 70, 42, 0, 0, 7); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath(); g.moveTo(-30, 0); g.lineTo(30, 0); for (let k = -20; k <= 20; k += 13) { g.moveTo(k, -10); g.lineTo(k, 10); } g.stroke(); g.restore();
          g.font = "150px Bungee"; g.textAlign = "left"; g.lineWidth = 14; g.strokeStyle = "#111"; g.strokeText("GAME", 50, 220); g.fillStyle = "#ff2d95"; g.fillText("GAME", 50, 220); g.strokeText("DAY", 50, 380); g.fillStyle = "#19e3ff"; g.fillText("DAY", 50, 380);
          g.font = "600 40px Rubik"; g.fillStyle = "#ffe9b0"; g.fillText("every sunday · come on in", 56, 460); });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })); m.position.set(ex + 0.02, 2.0, -2.7); m.rotation.y = Math.PI / 2; scene.add(m); }
      // lamps either side of the doors (a glow, not a light) and a gutter with a downpipe
      for (const z of [PO0 - 0.5, PO1 + 0.5]) { box(0.18, 0.3, 0.18, std(0x1a1a20, { metalness: 0.5 }), ex + 0.1, 3.0, z); const b = mesh(new THREE.SphereGeometry(0.1, 10, 8), basic(0xfff0c0), ex + 0.22, 2.85, z); b.castShadow = false; }
      box(0.16, 0.14, 2 * D + 0.6, std(0x3a3a42, { metalness: 0.5 }), ex + 0.08, WH - 0.1, 0);
      mesh(new THREE.CylinderGeometry(0.06, 0.06, WH, 8), std(0x3a3a42, { metalness: 0.5 }), ex + 0.1, WH / 2, -D + 0.2);
    }
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 6, w / 2, w / 2, w / 2); gr.addColorStop(0, "#fffef0"); gr.addColorStop(0.3, "#fff6c8"); gr.addColorStop(1, "rgba(255,240,180,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); }), fog: false, depthWrite: false }));
    sun.scale.setScalar(16); sun.material.color.setScalar(0.85); sun.position.set(120, 70, 40); scene.add(sun);
    // the haze: dark indoors (the arcade's), pale blue outdoors, switched as you go through the doors
    const fogIn = { c: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far };
    tickers.push((dt, t) => {
      const out = me.p.x > W + 0.3 && me.p.z < PZ1 + 0.5;
      if (out) { scene.fog.color.setHex(HORIZON); scene.fog.near = 50; scene.fog.far = 260; } else { scene.fog.color.setHex(fogIn.c); scene.fog.near = fogIn.near; scene.fog.far = fogIn.far; }
      if (!CALM) { const a = t * 0.02; blimp.position.set(STAD.x + Math.cos(a) * 34, 46 + Math.sin(t * 0.3) * 0.6, STAD.z + Math.sin(a) * 26); blimp.rotation.y = -a - Math.PI / 2 + Math.PI; }
    });
    const daylight = keep(new THREE.SpotLight(0xfff2dc, 2.4, 0, 0.62, 0.55, 0), 1); daylight.position.set(W + 8, 30, -11); daylight.target.position.set(W + 8, 0, -11); scene.add(daylight); scene.add(daylight.target);
    tickers.push((dt, t) => {
      if (CALM) return;
      shine.offset.x = t * 0.01; shine.offset.y = t * 0.006;
      for (const { f, ph } of flames) { const k = 0.85 + Math.sin(t * 11 + ph) * 0.12 + Math.sin(t * 17 + ph * 2) * 0.06; f.scale.set(1, k, 1); }
      if (fireLight.visible) fireLight.intensity = 5.5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 0.6;
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

  const DASHC = buildDash({ ...ctx, tickers, spots, PZ0 });

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
.mg[hidden]{display:none}.mg.side{left:auto;right:12px;transform:none;min-width:0;width:min(300px,calc(100% - 90px));padding:10px 12px;gap:6px;font-size:13px}.mg.side .meter{width:100%}.mg.side h4{font-size:15px}.mg h4{margin:0;font:400 18px var(--ak-disp)}.mg .row{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}.mg .k{color:var(--ak-dim);font-size:12.5px}
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
  function startMode(m) { if (mode) return; mode = m; hudEl().hidden = false; badge.hidden = false; hud.classList.toggle("side", Boolean(m.first)); /* first-person games keep the middle of the screen clear */ ctx.onMode?.(true); $prompt(""); m.start(); }
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
      first: true,
      start() { placeMe(lane.stand.x, lane.stand.z, Math.PI); A.setWhere("playing skee-ball"); draw(); drawSkeeScore(lane, 0, 9); },
      cam(pos, look) { pos.set(lane.g.position.x, 2.05, lane.g.position.z - 0.55); look.set(lane.g.position.x, 1.25, lane.g.position.z + SKEE.L + 0.55); return true; },
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
      first: true,
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
      first: true,
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
    step(dt, t) {
      for (const f of tickers) f(dt, t); for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](dt)) anims.splice(i, 1);
      const off = ctx.botsOn(), fp = Boolean(mode?.first);
      for (const p of crowd) { p.g.visible = off && !(fp && Math.hypot(p.g.position.x - me.p.x, p.g.position.z - me.p.z) < 2.2); p.ch?.update(dt); }
      mode?.step(dt, t);
    },
    firstPerson: () => Boolean(mode?.first),   // the lounge hides you, and anyone right beside you, while this is true
    cam(pos, look) { return mode?.cam ? mode.cam(pos, look) : false; },
    pointer(type, e) { mode?.pointer?.(type, e); },
    key(e, down) { if (down && e.code === "KeyQ") return endMode(); mode?.key?.(e, down); },
    leave: endMode,
    onDash: (m) => DASHC.onDash(m), restart: () => !mode && DASHC.restart(), dash: DASHC,
    get mode() { return mode; }   // for tests
  };
}

/* THE DASH (2026-10-07, the owner: "a back and forth speed course connected to the patio area ... shift key to slide hop and pick up speed,
   theres speed boosts/blockers, and they go down the track and then back, and theres a leaderboard"; then "daily ticket prize for highest
   of the day (Ends at 10pm CST) with a visible leaderboard at the start, like how you have the fishing leaderboard").

   Out through a gate in the patio's north fence, a track two lanes wide runs 70 m north. Down the left lane, ring the bell at the far end,
   back up the right lane. Crossing the start line starts the clock; crossing the finish line (beside it, coming home) stops it.
     - BOOST pads (cyan arrows): a shove of speed in the lane's direction.
     - GOO (purple): kills your speed and ends a slide.
     - LOW WALLS (orange, "SLIDE"): only a slide gets under.
     - HURDLES (yellow): hop them; running or sliding into one stops you dead.
     - SWEEPERS (pink): an arm sweeping the lane at ankle height; hop it or be knocked aside.
   Slide-hop itself lives in lounge.js (SL): it works everywhere, the track is where it pays. R puts you back at the start.

   The board at the gate is today's fastest (a day ends at 10 PM Central); #1 wins DASH.prize tickets. The page times the run on the game
   clock and sends {ms, bell}; the arcade server keeps the board and refuses impossible times (arcade-rules.js DASH). Offline (the mockup's
   bots) the board is pretend and your times go on it locally. Your best run in this browser comes back as a ghost to race. */
import { DASH, dashEnds } from "/v3/assets/js/arcade-rules.js?v=3";

export function buildDash(ctx) {
  const { THREE, scene, A, Sfx, me, R, W, WALK, REGIONS, block, std, basic, canvasTex, tickers, spots, clamp, esc, CALM, PZ0 } = ctx;
  const V3 = THREE.Vector3;
  // the track: lane A (out, going -z) is x GX0..MID, lane B (home, going +z) is MID..GX1
  const GX0 = W + 4, GX1 = W + 12, MID = (GX0 + GX1) / 2, START = PZ0 - 2, BELL = PZ0 - 69.5, DIV0 = PZ0 - 4, DIV1 = PZ0 - 68, END = PZ0 - 74;
  const T = { GX0, GX1, MID, START, BELL, END };
  WALK.push([GX0 + R, GX1 - R, END + R, PZ0 + 1]);
  REGIONS.push({ name: "dash", x0: GX0, x1: GX1, z0: END, z1: PZ0, open: true });
  block(MID, (DIV0 + DIV1) / 2, 0.36, DIV0 - DIV1);   // the divider between the lanes
  const mk = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
  const glow = (hex) => basic(hex);

  /* ---- the track itself */
  {
    const len = PZ0 - END;
    const tex = canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = "#1a1d3a"; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 1400; k++) { g.fillStyle = Math.random() < 0.5 ? "#20244a" : "#15182e"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = "rgba(255,255,255,.18)"; for (let y = 0; y < h; y += 64) { g.fillRect(w * 0.25 - 2, y, 4, 34); g.fillRect(w * 0.75 - 2, y, 4, 34); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, len / 8);
    const fl = mk(new THREE.PlaneGeometry(GX1 - GX0, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }), MID, 0.004, (PZ0 + END) / 2); fl.rotation.x = -Math.PI / 2;
    // curbs with neon tops; the divider; a back wall
    const curb = std(0x2a2d4a, { roughness: 0.6 });
    for (const [x, c] of [[GX0 - 0.15, 0x19e3ff], [GX1 + 0.15, 0xff3ea5]]) { mk(new THREE.BoxGeometry(0.3, 0.4, len), curb, x, 0.2, (PZ0 + END) / 2); mk(new THREE.BoxGeometry(0.32, 0.05, len), glow(c), x, 0.42, (PZ0 + END) / 2); }
    mk(new THREE.BoxGeometry(0.3, 0.6, DIV0 - DIV1), curb, MID, 0.3, (DIV0 + DIV1) / 2); mk(new THREE.BoxGeometry(0.32, 0.05, DIV0 - DIV1), glow(0xffd400), MID, 0.62, (DIV0 + DIV1) / 2);
    mk(new THREE.BoxGeometry(GX1 - GX0 + 0.6, 1.2, 0.3), curb, MID, 0.6, END - 0.15);
    // lines: start (lane A) and finish (lane B), checkered
    const chk = canvasTex(128, 32, (g) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#111" : "#f4f4f4"; g.fillRect(i * 8, j * 8, 8, 8); } });
    for (const [x0, x1] of [[GX0, MID], [MID, GX1]]) { const l = mk(new THREE.PlaneGeometry(x1 - x0, 0.6), new THREE.MeshBasicMaterial({ map: chk }), (x0 + x1) / 2, 0.008, START); l.rotation.x = -Math.PI / 2; }
    // lane arrows on the floor near each end
    const arrow = canvasTex(128, 128, (g) => { g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.moveTo(64, 14); g.lineTo(112, 70); g.lineTo(82, 70); g.lineTo(82, 116); g.lineTo(46, 116); g.lineTo(46, 70); g.lineTo(16, 70); g.closePath(); g.fill(); });
    for (const [x, z, up] of [[(GX0 + MID) / 2, START - 2.2, true], [(MID + GX1) / 2, BELL + 3, false], [(GX0 + MID) / 2, BELL + 6, true]]) { const a = mk(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: arrow, transparent: true, depthWrite: false }), x, 0.01, z); a.rotation.x = -Math.PI / 2; a.rotation.z = up ? 0 : Math.PI; }
    // the arch over the gate
    const pyl = std(0x15182e, { roughness: 0.5, metalness: 0.3 });
    for (const x of [GX0 - 0.35, GX1 + 0.35]) { mk(new THREE.BoxGeometry(0.45, 4.2, 0.45), pyl, x, 2.1, PZ0 - 0.6); mk(new THREE.BoxGeometry(0.06, 4, 0.06), glow(x < MID ? 0x19e3ff : 0xff3ea5), x + (x < MID ? 0.24 : -0.24), 2.1, PZ0 - 0.6 + 0.24); }
    mk(new THREE.BoxGeometry(GX1 - GX0 + 1.2, 0.9, 0.35), pyl, MID, 4.5, PZ0 - 0.6);
    const sign = canvasTex(1024, 160, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "120px Monoton"; g.shadowBlur = 24; g.shadowColor = "#ff3ea5"; g.fillStyle = "#ffe6f4"; g.fillText("THE DASH", w / 2, h / 2 + 6); });
    for (const s of [1, -1]) { const p = mk(new THREE.PlaneGeometry(GX1 - GX0 + 0.6, 0.8), new THREE.MeshBasicMaterial({ map: sign, transparent: true }), MID, 4.5, PZ0 - 0.6 + s * 0.19); if (s < 0) p.rotation.y = Math.PI; }
  }

  /* ---- the bell, on a gantry across the far end */
  const bell = new THREE.Group();
  {
    const pyl = std(0x15182e, { roughness: 0.5, metalness: 0.3 }), y = 3.6;
    for (const x of [GX0 + 0.2, GX1 - 0.2]) mk(new THREE.BoxGeometry(0.3, y + 0.4, 0.3), pyl, x, (y + 0.4) / 2, BELL - 2);
    mk(new THREE.BoxGeometry(GX1 - GX0, 0.3, 0.3), pyl, MID, y + 0.3, BELL - 2);
    bell.position.set(MID, y + 0.15, BELL - 2); scene.add(bell);
    const gold = std(0xffc83a, { metalness: 0.85, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.48, 0.7, 20, 1, true), gold); b.material.side = THREE.DoubleSide; b.position.y = -0.45; bell.add(b);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); top.position.y = -0.1; bell.add(top);
    const clap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std(0x8a6a20, { metalness: 0.8 })); clap.position.y = -0.78; bell.add(clap);
    const sign = canvasTex(512, 96, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "64px Bungee"; g.shadowBlur = 16; g.shadowColor = "#ffd400"; g.fillStyle = "#fff6c8"; g.fillText("RING IT · GO BACK", w / 2, h / 2); });
    const p = mk(new THREE.PlaneGeometry(GX1 - GX0 - 0.6, 0.55), new THREE.MeshBasicMaterial({ map: sign, transparent: true }), MID, y + 0.85, BELL - 2 + 0.17); p.rotation.y = 0;
  }
  let bellSwing = 0;

  /* ---- what's on the track. Lane A is travelled -z, lane B +z. */
  const LA = { x0: GX0, x1: MID, dir: -1 }, LB = { x0: MID, x1: GX1, dir: 1 };
  const things = [];
  const pad = (lane, z, x0, x1, kind) => {   // boost or goo, 2 m long
    x0 = x0 ?? lane.x0 + 0.25; x1 = x1 ?? lane.x1 - 0.25;
    const t = { k: kind, lane, z0: z - 1, z1: z + 1, x0, x1, cool: 0 };
    if (kind === "boost") {
      const tex = canvasTex(64, 128, (g) => { g.fillStyle = "#06343c"; g.fillRect(0, 0, 64, 128); g.strokeStyle = "#19e3ff"; g.lineWidth = 9; for (const y of [20, 58, 96]) { g.beginPath(); g.moveTo(10, y + 22); g.lineTo(32, y); g.lineTo(54, y + 22); g.stroke(); } });
      tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round((x1 - x0) / 0.9)), 1);
      const m = mk(new THREE.PlaneGeometry(x1 - x0, 2), new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff }), (x0 + x1) / 2, 0.012, z); m.rotation.x = -Math.PI / 2; m.rotation.z = lane.dir < 0 ? 0 : Math.PI; t.mat = tex;
    } else {
      const m = mk(new THREE.PlaneGeometry(x1 - x0, 2), new THREE.MeshStandardMaterial({ color: 0x7a1fd0, emissive: 0x3a0870, roughness: 0.15, metalness: 0.2 }), (x0 + x1) / 2, 0.012, z); m.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 7; k++) { const bl = mk(new THREE.SphereGeometry(0.06 + Math.random() * 0.1, 8, 6), m.material, x0 + 0.2 + Math.random() * (x1 - x0 - 0.4), 0.02, z - 0.8 + Math.random() * 1.6); bl.scale.y = 0.4; }
    }
    things.push(t);
  };
  const wall = (lane, z) => {   // a low wall: slide under it (its underside is 0.9 up)
    const x0 = lane.x0, x1 = lane.x1, w = x1 - x0, cx = (x0 + x1) / 2;
    const tex = canvasTex(256, 64, (g) => { for (let i = -2; i < 12; i++) { g.fillStyle = i % 2 ? "#ff8a1f" : "#1a1208"; g.beginPath(); g.moveTo(i * 26, 0); g.lineTo(i * 26 + 26, 0); g.lineTo(i * 26 + 6, 64); g.lineTo(i * 26 - 20, 64); g.fill(); } g.fillStyle = "#1a1208"; g.fillRect(70, 14, 116, 36); g.font = "28px Bungee"; g.fillStyle = "#ffb04a"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SLIDE", 128, 33); });
    mk(new THREE.BoxGeometry(w, 0.5, 0.2), new THREE.MeshBasicMaterial({ map: tex }), cx, 1.15, z);
    mk(new THREE.BoxGeometry(w, 1.0, 0.16), std(0x2a1a0e, { roughness: 0.7 }), cx, 1.9, z);
    mk(new THREE.BoxGeometry(w, 0.04, 0.22), glow(0xff8a1f), cx, 0.9, z);
    things.push({ k: "wall", lane, z });
  };
  const hurdle = (lane, z) => {   // hop it (0.55 high)
    const x0 = lane.x0 + 0.15, x1 = lane.x1 - 0.15, cx = (x0 + x1) / 2;
    mk(new THREE.BoxGeometry(x1 - x0, 0.12, 0.08), glow(0xffd400), cx, 0.5, z);
    for (const x of [x0 + 0.05, x1 - 0.05]) mk(new THREE.BoxGeometry(0.06, 0.5, 0.06), std(0x3a3a44), x, 0.25, z);
    things.push({ k: "hurdle", lane, z });
  };
  const sweeper = (lane, z, phase) => {   // an arm round a post in the lane, at ankle height: hop it
    const cx = (lane.x0 + lane.x1) / 2;
    mk(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 12), std(0x2a2d4a, { metalness: 0.4 }), cx, 0.35, z);
    mk(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), glow(0xff3ea5), cx, 0.72, z);
    block(cx, z, 0.3, 0.3);
    const arm = new THREE.Group(); arm.position.set(cx, 0.3, z); scene.add(arm);
    const len = (lane.x1 - lane.x0) / 2 - 0.12;
    for (const s of [1, -1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.14), glow(0xff3ea5)); a.position.x = s * len / 2; arm.add(a); }
    things.push({ k: "arm", lane, z, cx, len, arm, phase, cool: 0 });
  };
  // lane A, out
  pad(LA, PZ0 - 8, null, null, "boost"); wall(LA, PZ0 - 16); hurdle(LA, PZ0 - 23);
  pad(LA, PZ0 - 30, GX0 + 0.25, GX0 + 1.9, "boost"); pad(LA, PZ0 - 30, GX0 + 1.9, MID - 0.25, "goo");
  sweeper(LA, PZ0 - 38, 0); pad(LA, PZ0 - 45, null, null, "boost"); wall(LA, PZ0 - 52); hurdle(LA, PZ0 - 57);
  pad(LA, PZ0 - 62, GX0 + 1.2, MID - 0.25, "goo");
  // lane B, home
  pad(LB, PZ0 - 64, null, null, "boost"); hurdle(LB, PZ0 - 58); sweeper(LB, PZ0 - 51, 1.3); sweeper(LB, PZ0 - 44, 2.6);
  pad(LB, PZ0 - 37, MID + 0.25, GX1 - 1.6, "goo"); pad(LB, PZ0 - 37, GX1 - 1.6, GX1 - 0.25, "boost");
  wall(LB, PZ0 - 29); pad(LB, PZ0 - 22, null, null, "boost"); hurdle(LB, PZ0 - 16); wall(LB, PZ0 - 11); pad(LB, PZ0 - 6, null, null, "boost");

  /* ---- the run: HUD, clock, ghost */
  const css = document.createElement("style");
  css.textContent = `.dash-hud{position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:30;pointer-events:none;background:rgba(10,8,24,.72);border:1px solid rgba(25,227,255,.35);border-radius:14px;padding:8px 18px 6px;min-width:220px;text-align:center;font-family:Bungee,system-ui,sans-serif;color:#fff;text-shadow:0 0 12px rgba(25,227,255,.6),0 2px 0 #000}
.dash-hud[hidden]{display:none}.dash-hud .t{font-size:44px;line-height:1;letter-spacing:1px}.dash-hud .s{font:600 15px Rubik,system-ui,sans-serif;color:#cfe9ff;margin-top:4px}
.dash-hud .v{font:700 13px Rubik,system-ui,sans-serif;color:#9affb0;margin-top:2px}.dash-hud .x{font-size:26px;color:#ff8a1f;text-shadow:0 0 12px rgba(255,138,31,.7),0 2px 0 #000;height:30px}
.dash-hud .r{font-size:22px;color:#ffd400;margin-top:6px}.dash-hud .k{font:600 12px Rubik,system-ui,sans-serif;color:#9aa3c7;margin-top:4px}`;
  document.head.appendChild(css);
  const hud = document.createElement("div"); hud.className = "dash-hud"; hud.hidden = true;
  hud.innerHTML = `<div class="t">0.00</div><div class="s"></div><div class="r"></div><div class="v"></div><div class="x"></div><div class="k">R to restart</div>`;
  document.body.appendChild(hud);
  const $h = (c) => hud.querySelector("." + c);
  const fmtT = (ms) => (ms / 1000).toFixed(2);
  const run = { state: "idle", t: 0, bell: null, frames: [], ft: 0, oof: 0, hide: 0 };   // hide: seconds until the HUD goes
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  let ghostRun = store.get("ec_dash_ghost");   // {ms, f: [x, y, z] every 0.1 s}
  const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 10), new THREE.MeshBasicMaterial({ color: 0x19e3ff, transparent: true, opacity: 0.32, depthWrite: false }));
  ghost.visible = false; ghost.userData.mover = true; scene.add(ghost);

  function startRun() { run.state = "run"; run.t = 0; run.bell = null; run.frames = []; run.ft = 0; hud.hidden = false; $h("r").textContent = ""; $h("s").textContent = "Down the left lane, ring the bell"; $h("v").textContent = ""; Sfx.play("go"); }
  function stopRun(why) { run.state = "idle"; ghost.visible = false; if (why) { $h("r").textContent = why; run.hide = 2.5; } else hud.hidden = true; }
  function finish() {
    const ms = Math.round(run.t * 1000), bellMs = Math.round(run.bell * 1000);
    run.state = "done"; run.hide = 7; ghost.visible = false; Sfx.play("finish");
    $h("t").textContent = fmtT(ms); $h("s").textContent = `Bell ${fmtT(bellMs)} · home ${fmtT(ms - bellMs)}`;
    const mine = store.get("ec_dash_best");
    const pb = !mine || mine.day !== board.day || ms < mine.ms;
    if (pb) store.set("ec_dash_best", { day: board.day, ms });
    if (!ghostRun || ms < ghostRun.ms) { ghostRun = { ms, f: run.frames }; store.set("ec_dash_ghost", ghostRun); }
    $h("r").textContent = pb ? "New best today!" : `Today's best ${fmtT(mine.ms)}`;
    if (ctx.botsOn()) {   // offline: the pretend board
      const me2 = board.top.find((r) => r.id === "me"); if (!me2) board.top.push({ id: "me", name: A.hello?.you?.name || "you", ms }); else me2.ms = Math.min(me2.ms, ms);
      board.top.sort((a, b) => a.ms - b.ms); drawBoard();
      const rank = board.top.findIndex((r) => r.id === "me") + 1; $h("v").textContent = `#${rank} today (preview board)`;
    } else { A.send({ t: "dash", ms, bell: bellMs }); $h("v").textContent = "Sending your time…"; }
  }
  function bonk(lane, z, text) {
    const back = -lane.dir * 0.7; me.p.z = z + back; me.v.x = 0; me.v.z = 0; me.slide = false; me.slideCd = 0.3;
    Sfx.play("bonk"); run.oof = 0.8; $h("x").textContent = text;
  }
  function restart() {
    if (!(me.p.x > GX0 - 3 && me.p.x < GX1 + 3 && me.p.z < PZ0 + 6)) return false;
    me.p.set((GX0 + MID) / 2, R, PZ0 - 0.8); me.v.set(0, 0, 0); me.slide = false; me.facing = 0; ctx.setYaw?.(0);
    run.state = "idle"; hud.hidden = true; ghost.visible = false; lastX = me.p.x; lastZ = me.p.z; return true;
  }

  /* ---- the board at the gate, inside the garden */
  const board = { day: "", ends: dashEnds(Date.now()), prize: DASH.prize, top: [{ id: "b1", name: "drhealsgud", ms: 21480 }, { id: "b2", name: "heartlarva", ms: 23110 }, { id: "b3", name: "zwades", ms: 26950 }], last: { name: "bigrig", ms: 20330 } };
  const BOARD = { x: GX1 + 1.9, z: PZ0 + 1.0 };
  const bc = document.createElement("canvas"); bc.width = 640; bc.height = 720; const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  {
    // east of the gate, turned to the garden: you see it coming up past the pond
    const g = new THREE.Group(); g.position.set(BOARD.x, 0, BOARD.z); g.rotation.y = -0.45; scene.add(g);
    for (const x of [-1.05, 1.05]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), std(0x15182e)); p.position.set(x, 0.7, 0); g.add(p); }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.66, 0.1), std(0x15182e, { metalness: 0.3 })); frame.position.set(0, 2.6, -0.04); g.add(frame);
    const pnl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.48), new THREE.MeshBasicMaterial({ map: bt })); pnl.position.set(0, 2.6, 0.02); g.add(pnl);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.05, 0.12), glow(0xff3ea5)); edge.position.set(0, 3.95, 0); g.add(edge);
    block(BOARD.x, BOARD.z, 2.3, 0.5);
  }
  function left(ms) { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
  function drawBoard() {
    const g = bc.getContext("2d"), w = bc.width, h = bc.height;
    g.fillStyle = "#0d0f22"; g.fillRect(0, 0, w, h); g.strokeStyle = "#19e3ff"; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = "center"; g.fillStyle = "#ffe6f4"; g.shadowColor = "#ff3ea5"; g.shadowBlur = 14; g.font = "52px Bungee"; g.fillText("THE DASH", w / 2, 74); g.shadowBlur = 0;
    g.font = "600 22px Rubik"; g.fillStyle = "#cfe9ff"; g.fillText(`Today's fastest · ends 10 PM CT (in ${left(board.ends - Date.now())})`, w / 2, 110);
    g.font = "26px Bungee"; g.fillStyle = "#ffd400"; g.fillText(`#1 WINS ${Number(board.prize).toLocaleString()} TICKETS`, w / 2, 150);
    const rows = board.top.slice(0, 10);
    if (!rows.length) { g.font = "600 24px Rubik"; g.fillStyle = "#9aa3c7"; g.fillText("No times yet today. Be the first.", w / 2, 300); }
    rows.forEach((r, k) => {
      const y = 200 + k * 42; g.textAlign = "left"; g.font = "600 26px Rubik"; g.fillStyle = k === 0 ? "#ffd400" : r.id === "me" || r.id === A.hello?.you?.id ? "#9affb0" : "#f4ecff";
      g.fillText(`${k + 1}. ${String(r.name).slice(0, 18)}`, 34, y); g.textAlign = "right"; g.font = "26px Bungee"; g.fillText(fmtT(r.ms), w - 34, y);
    });
    g.textAlign = "center"; g.font = "600 19px Rubik"; g.fillStyle = "#9aa3c7";
    if (board.last) g.fillText(`Last winner: ${board.last.name} · ${fmtT(board.last.ms)}`, w / 2, h - 60);
    g.fillText("Shift slides · Space hops out of a slide · R restarts", w / 2, h - 30);
    bt.needsUpdate = true;
  }
  drawBoard();
  spots.push({ kind: "dash", x: BOARD.x - 0.5, z: BOARD.z + 1.1, r: 1.8, label: () => `<kbd>E</kbd> The Dash: how it works`, use: () => A.notify("Down the left lane, ring the bell, back up the right. Shift to slide (it keeps your speed), Space to hop out of it, and slide again right as you land for a bigger kick. Cyan pads boost, purple goo stops you, slide under orange walls, hop yellow hurdles and pink sweepers. R restarts.", "🏁") });

  function onDash(m) {
    if (m.t === "dash") { board.day = m.day; board.ends = m.ends; board.prize = m.prize; board.top = m.top || []; board.last = m.last; drawBoard(); return; }
    if (m.t === "dashr") {
      if (!m.ok) { $h("v").textContent = `Not counted (${m.why})`; return; }
      $h("v").textContent = m.pb ? `#${m.rank} today${m.rank === 1 ? " · in the lead!" : ""}` : `Your best today: ${fmtT(m.best)} (#${m.rank})`;
      if (m.pb && m.rank === 1) Sfx.play("checkpoint");
    }
  }

  /* ---- every frame */
  let lastX = me.p.x, lastZ = me.p.z, boardT = 0;
  const inLane = (lane, x) => x >= lane.x0 - 0.05 && x <= lane.x1 + 0.05;
  const crossed = (z, dir) => (dir < 0 ? lastZ > z && me.p.z <= z : lastZ < z && me.p.z >= z);
  tickers.push((dt, t) => {
    boardT -= dt; if (boardT <= 0) { boardT = 30; drawBoard(); }   // the countdown on the board
    const onTrack = me.p.z < PZ0 + 0.2 && me.p.x > GX0 - 0.5 && me.p.x < GX1 + 0.5;
    if (!CALM) { for (const th of things) if (th.k === "arm") th.arm.rotation.y = t * 2.2 + th.phase; else if (th.mat) th.mat.offset.y = (t * 1.6) % 1; }
    if (bellSwing > 0) { bellSwing = Math.max(0, bellSwing - dt); bell.rotation.x = Math.sin(bellSwing * 18) * bellSwing * 0.5; }
    if (run.state !== "idle") run.t += dt;
    if (run.oof > 0) { run.oof -= dt; if (run.oof <= 0) $h("x").textContent = ""; }
    if (run.state !== "run" && !hud.hidden) { run.hide -= dt; if (run.hide <= 0) { run.state = "idle"; hud.hidden = true; } }
    if (onTrack) {
      const feet = me.p.y - R, hs = Math.hypot(me.v.x, me.v.z);
      const setSpeed = (v, dirZ) => { if (dirZ) { me.v.x *= 0.3; me.v.z = dirZ * Math.max(v, 0); } else if (hs > 1e-3) { me.v.x *= v / hs; me.v.z *= v / hs; } };
      for (const th of things) {
        const lane = th.lane;
        if (th.k === "boost" || th.k === "goo") {
          if (me.p.x < th.x0 || me.p.x > th.x1 || me.p.z < th.z0 || me.p.z > th.z1 || feet > 0.3) continue;
          if (th.k === "goo") { setSpeed(hs * Math.exp(-6 * dt)); me.slide = false; }
          else if (th.cool <= t) { th.cool = t + 1; setSpeed(Math.min(19, Math.max(hs, 6.4) + 5), lane.dir); Sfx.play("go"); }
        } else if (th.k === "wall") { if (inLane(lane, me.p.x) && crossed(th.z, lane.dir) && !me.slide) bonk(lane, th.z, "SLIDE UNDER!"); }
        else if (th.k === "hurdle") { if (inLane(lane, me.p.x) && crossed(th.z, lane.dir) && feet < 0.55) bonk(lane, th.z, "HOP IT!"); }
        else if (th.k === "arm") {
          if (feet > 0.45 || th.cool > t || Math.abs(me.p.z - th.z) > th.len + R || !inLane(lane, me.p.x)) continue;
          const a = th.arm.rotation.y, ax = Math.cos(a), az = -Math.sin(a), dx = me.p.x - th.cx, dz = me.p.z - th.z, along = clamp(dx * ax + dz * az, -th.len, th.len);
          const px = dx - ax * along, pz = dz - az * along, d = Math.hypot(px, pz);
          if (d < R) { th.cool = t + 0.6; const nx = d > 1e-3 ? px / d : 1, nz = d > 1e-3 ? pz / d : 0; me.v.x = nx * 4; me.v.z = nz * 4 + me.v.z * 0.2; me.v.y = 3; me.grounded = false; me.slide = false; Sfx.play("bonk"); run.oof = 0.8; $h("x").textContent = "SWEPT!"; }
        }
      }
      // the clock
      if (run.state !== "run" && inLane(LA, me.p.x) && crossed(START, -1)) startRun();
      else if (run.state === "run") {
        if (!run.bell && me.p.z < BELL) { run.bell = run.t; bellSwing = 1.2; Sfx.play("checkpoint"); $h("s").textContent = `Bell ${fmtT(run.bell * 1000)} · now home up the right lane`; }
        if (run.bell && inLane(LB, me.p.x) && crossed(START, 1)) finish();
        else if (!run.bell && inLane(LA, me.p.x) && crossed(START, 1)) stopRun("Run stopped: back over the start");
      }
    } else if (run.state === "run") stopRun("Run stopped: off the track");
    if (run.state === "run") {
      if (run.t > DASH.maxMs / 1000) stopRun("Run stopped: too slow");
      $h("t").textContent = fmtT(run.t * 1000);
      run.ft -= dt; if (run.ft <= 0 && run.frames.length < 2000) { run.ft += 0.1; run.frames.push([+me.p.x.toFixed(2), +me.p.y.toFixed(2), +me.p.z.toFixed(2)]); }
      if (ghostRun?.f?.length > 1) {
        const i = run.t / 0.1, k = Math.floor(i), f0 = ghostRun.f[Math.min(k, ghostRun.f.length - 1)], f1 = ghostRun.f[Math.min(k + 1, ghostRun.f.length - 1)], u = i - k;
        ghost.visible = k < ghostRun.f.length; ghost.position.set(f0[0] + (f1[0] - f0[0]) * u, f0[1] + (f1[1] - f0[1]) * u + 0.35, f0[2] + (f1[2] - f0[2]) * u);
      }
    }
    lastX = me.p.x; lastZ = me.p.z;
  });

  return { T, restart, onDash, run, board, things };
}

/* The two playable party games for the mock: PUSHOVER (a shove-them-off arena, the Fall Guys / Mario Party side) and HOT POTATO (a sealed fuse,
   the coin-safe side). Everything runs in the page against bots; nothing calls /api/. In the real thing the room's Durable Object runs this same
   simulation and the page only sends inputs (see "How it runs" on the page). */
(() => {
"use strict";
const ART = "/v3/assets/img/glad/flat/";
const SKINS = ["hero_south", "hero_bronze_south", "hero_emerald_south", "hero_diamond_south", "hero_onyx_south", "hero_dragonstone_south", "hero_tiro_south"];
const NAMES = ["You", "bootypaper", "heartlarva", "andyreidisapawg", "zwades", "fasteddie", "dookie", "bronny"];
const COLS = ["#ffd84a", "#ff6a8a", "#6ad0ff", "#8ae07a", "#c48aff", "#ff9a3a", "#5ae0c0", "#ff5a5a"];
const imgs = {};
const img = (n) => imgs[n] || (imgs[n] = Object.assign(new Image(), { src: ART + n + ".png" }));
SKINS.forEach(img);
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const seedHex = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, "0")).join("");

/* ====================================================================== PUSHOVER */
(function pushover() {
  const cv = $("poCv"); if (!cv) return;
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height, CX = W / 2, CY = H / 2 + 6;
  const keys = {};
  let st = null, raf = 0, last = 0, players = 4 + 2;
  const R0 = 236, RMIN = 74, STEP = 26, EVERY = 8, WARN = 2.2;
  const ov = $("poOver");

  function newGame() {
    const n = players, ps = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      ps.push({ i, name: NAMES[i], col: COLS[i], skin: SKINS[i % SKINS.length], x: CX + Math.cos(a) * 150, y: CY + Math.sin(a) * 150, vx: 0, vy: 0,
        fx: 0, fy: 1, dash: 0, dcd: 0, hop: 0, hcd: 0, out: 0, fall: 0, place: 0, bot: i > 0,
        aim: rnd(0.55, 1), think: 0, tx: CX, ty: CY, hits: 0, last: -1 });
    }
    st = { t: 0, R: R0, nextDrop: EVERY, ps, sweep: 0, sweepOn: 18, sweepSpd: 1.1, log: [], over: false, flash: 0, alive: n };
    const L = $("poLog"); if (L) L.innerHTML = "";
    logp(`Round starts: ${n} on the ring. The edge drops every ${EVERY} s; the sweeper comes out at ${st.sweepOn} s.`);
  }
  function logp(s, cls) { const L = $("poLog"); if (!L) return; const p = document.createElement("p"); if (cls) p.className = cls; p.textContent = `${fmt(st ? st.t : 0)} ${s}`; L.prepend(p); }
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  function input(p, dt) {
    let ax = 0, ay = 0, dash = false, hop = false;
    if (!p.bot) {
      ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      ay = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      dash = keys.Space; hop = keys.ShiftLeft || keys.ShiftRight || keys.KeyX || keys.KeyK;
    } else {
      p.think -= dt;
      const d = Math.hypot(p.x - CX, p.y - CY);
      if (p.think <= 0) {
        p.think = rnd(0.12, 0.35) / p.aim;
        // near the edge: get back in. Otherwise pick whoever is closest to falling off and go at them
        if (d > st.R - 46) { p.tx = CX + rnd(-20, 20); p.ty = CY + rnd(-20, 20); p.target = null; }
        else {
          let best = null, bs = -1e9;
          for (const q of st.ps) if (q !== p && !q.out) { const dq = Math.hypot(q.x - CX, q.y - CY), dd = Math.hypot(q.x - p.x, q.y - p.y); const s = dq * 1.2 - dd + (q.bot ? 0 : 30 * p.aim); if (s > bs) { bs = s; best = q; } }
          p.target = best;
          if (best) { const ox = best.x - CX, oy = best.y - CY, ol = Math.hypot(ox, oy) || 1; p.tx = best.x - (ox / ol) * 26; p.ty = best.y - (oy / ol) * 26; }
        }
      }
      ax = p.tx - p.x; ay = p.ty - p.y;
      if (p.target && !p.target.out) {
        const dd = Math.hypot(p.target.x - p.x, p.target.y - p.y);
        if (dd < 74 && Math.random() < 0.08 * p.aim) dash = true;
      }
      // hop the sweeper when it is about to arrive
      if (st.t > st.sweepOn) { const a = Math.atan2(p.y - CY, p.x - CX), da = ((a - st.sweep) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; if (da > 0 && da < 0.32 && Math.random() < 0.55 * p.aim) hop = true; }
    }
    const l = Math.hypot(ax, ay);
    if (l > 0.01) { ax /= l; ay /= l; p.fx = ax; p.fy = ay; }
    const acc = p.hop > 0 ? 260 : 980;
    p.vx += ax * acc * dt; p.vy += ay * acc * dt;
    if (dash && p.dcd <= 0 && p.hop <= 0) { p.vx += p.fx * 430; p.vy += p.fy * 430; p.dash = 0.24; p.dcd = 1.5; }
    if (hop && p.hcd <= 0 && p.hop <= 0) { p.hop = 0.5; p.hcd = 1.1; }
  }

  function step(dt) {
    st.t += dt; st.flash += dt;
    if (st.t >= st.nextDrop && st.R > RMIN) { st.R = Math.max(RMIN, st.R - STEP); st.nextDrop += EVERY; logp(`The edge drops. Ring is ${Math.round(st.R / R0 * 100)}% of its size.`); }
    if (st.t > st.sweepOn) { const k = Math.min(2.4, st.sweepSpd + (st.t - st.sweepOn) * 0.025); st.sweep = (st.sweep + k * dt) % (Math.PI * 2); }
    const live = st.ps.filter((p) => !p.out);
    for (const p of live) {
      input(p, dt);
      p.dash = Math.max(0, p.dash - dt); p.dcd = Math.max(0, p.dcd - dt); p.hop = Math.max(0, p.hop - dt); p.hcd = Math.max(0, p.hcd - dt);
      const damp = Math.exp(-(p.dash > 0 ? 1.2 : 3.2) * dt); p.vx *= damp; p.vy *= damp;
      const sp = Math.hypot(p.vx, p.vy), max = p.dash > 0 ? 560 : 230; if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // bumps: circles, a dash hits much harder, a hopping player passes over everyone
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j]; if (a.hop > 0 || b.hop > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = 30;
      if (d < m && d > 0.001) {
        const nx = dx / d, ny = dy / d, push = (m - d) / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const k = -(1.25) * rv / 2; a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny; }
        const kick = (p, q, s) => { q.vx += nx * s * 300; q.vy += ny * s * 300; q.last = p.i; p.hits++; };
        if (a.dash > 0 && b.dash <= 0) kick(a, b, 1); else if (b.dash > 0 && a.dash <= 0) kick(b, a, -1);
        else if (a.dash > 0 && b.dash > 0) { a.vx -= nx * 160; a.vy -= ny * 160; b.vx += nx * 160; b.vy += ny * 160; }
        a.lastT = b.lastT = st.t;
      }
    }
    // the sweeper: a beam from the middle; touch it on the ground and it throws you outward
    if (st.t > st.sweepOn) {
      const ux = Math.cos(st.sweep), uy = Math.sin(st.sweep);
      for (const p of live) {
        if (p.hop > 0) continue;
        const rx = p.x - CX, ry = p.y - CY, along = rx * ux + ry * uy, perp = -rx * uy + ry * ux;
        if (along > 18 && along < st.R && Math.abs(perp) < 20) { const s = perp > 0 ? 1 : -1; p.vx += -uy * s * 520 + ux * 140; p.vy += ux * s * 520 + uy * 140; p.x += -uy * s * 6; p.y += ux * s * 6; p.last = -2; }
      }
    }
    for (const p of live) {
      if (Math.hypot(p.x - CX, p.y - CY) > st.R + 4 && p.hop <= 0) {
        p.out = 1; p.fall = 0.7; p.place = st.alive; st.alive--;
        const by = p.last >= 0 && st.t - (p.lastT || -9) < 2.5 ? st.ps[p.last].name : p.last === -2 ? "the sweeper" : null;
        logp(`${p.bot ? p.name + " is" : "You're"} off${by ? `, thanks to ${by}` : ""}.`, p.bot ? "" : "bad");
      }
    }
    for (const p of st.ps) if (p.out && p.fall > 0) { p.fall -= dt; p.x += p.vx * dt * 0.5; p.y += p.vy * dt * 0.5; }
    const left = st.ps.filter((p) => !p.out);
    if (!st.over && (left.length <= 1 || st.t > 90 || st.ps[0].out && left.every((p) => p.bot) && left.length === 1)) {
      st.over = true;
      if (left.length > 1) { left.sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY)); left.forEach((p, k) => (p.place = k + 1)); }
      else if (left[0]) left[0].place = 1;
      setTimeout(finish, 900);
    }
  }

  function draw() {
    g.fillStyle = "#0c0814"; g.fillRect(0, 0, W, H);
    // the void under the ring: stars
    for (let i = 0; i < 70; i++) { const x = (i * 137) % W, y = (i * 89 + Math.floor(i / 3) * 31) % H; g.fillStyle = i % 5 ? "#3a2a5a" : "#ff6ad0"; g.fillRect(x, y, 2, 2); }
    // the ring: velvet, gold rim, carpet stars. The band about to drop flashes red
    const warn = st.R > RMIN && st.nextDrop - st.t < WARN;
    g.save(); g.beginPath(); g.arc(CX, CY, st.R + 8, 0, Math.PI * 2); g.fillStyle = "#6a4a12"; g.fill();
    g.beginPath(); g.arc(CX, CY, st.R + 4, 0, Math.PI * 2); g.fillStyle = "#d8a23a"; g.fill();
    g.beginPath(); g.arc(CX, CY, st.R, 0, Math.PI * 2); g.fillStyle = "#7a1a2a"; g.fill(); g.clip();
    for (let r = 0; r < st.R; r += 26) { g.beginPath(); g.arc(CX, CY, r, 0, Math.PI * 2); g.strokeStyle = "rgba(255,180,200,.06)"; g.lineWidth = 2; g.stroke(); }
    for (let i = 0; i < 40; i++) { const a = i * 2.39996, r = Math.sqrt(i / 40) * st.R; g.fillStyle = ["#ffd84a", "#ff6ad0", "#6ad0ff"][i % 3]; g.fillRect(Math.round(CX + Math.cos(a) * r), Math.round(CY + Math.sin(a) * r), 3, 3); }
    if (warn && Math.floor(st.t * 8) % 2 === 0) { g.beginPath(); g.arc(CX, CY, st.R, 0, Math.PI * 2); g.arc(CX, CY, Math.max(RMIN, st.R - STEP), 0, Math.PI * 2, true); g.fillStyle = "rgba(255,40,40,.42)"; g.fill(); }
    g.restore();
    g.beginPath(); g.arc(CX, CY, 16, 0, Math.PI * 2); g.fillStyle = "#c8963a"; g.fill(); g.strokeStyle = "#3a1e12"; g.lineWidth = 3; g.stroke();
    // sweeper
    if (st.t > st.sweepOn - 2) {
      const a = st.sweep, on = st.t > st.sweepOn;
      g.save(); g.translate(CX, CY); g.rotate(a); g.globalAlpha = on ? 1 : 0.35 + 0.3 * Math.sin(st.t * 12);
      g.fillStyle = "#2a1408"; g.fillRect(14, -11, st.R - 10, 22);
      for (let x = 16; x < st.R; x += 16) { g.fillStyle = (x / 16) % 2 ? "#d8302a" : "#ffd84a"; g.fillRect(x, -9, 14, 18); }
      g.restore();
    }
    // players: the ones off the ring shrink into the void first
    const order = st.ps.slice().sort((a, b) => a.y - b.y);
    for (const p of order) {
      if (p.out && p.fall <= 0) continue;
      const sc = p.out ? Math.max(0.05, p.fall / 0.7) : 1, lift = p.hop > 0 ? Math.sin((p.hop / 0.5) * Math.PI) * 16 : 0;
      g.save(); g.translate(p.x, p.y);
      if (!p.out) { g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(0, 4, 15 - lift * 0.3, 7 - lift * 0.15, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = p.col; g.lineWidth = p.bot ? 2 : 3.5; g.beginPath(); g.ellipse(0, 4, 17, 8, 0, 0, Math.PI * 2); g.stroke();
      if (p.dash > 0) { g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 2; for (let k = 1; k <= 3; k++) { g.beginPath(); g.moveTo(-p.fx * 14 * k, -p.fy * 14 * k - 12); g.lineTo(-p.fx * (14 * k + 8), -p.fy * (14 * k + 8) - 12); g.stroke(); } }
      const im = img(p.skin);
      if (im.complete && im.naturalWidth) { const w = im.naturalWidth * 0.62 * sc, h = im.naturalHeight * 0.62 * sc; g.drawImage(im, Math.round(-w / 2), Math.round(-h + 6 - lift), Math.round(w), Math.round(h)); }
      else { g.fillStyle = p.col; g.fillRect(-10, -30 - lift, 20, 30); }
      if (!p.out) { g.font = "800 11px Lora,serif"; g.textAlign = "center"; g.fillStyle = "#000"; g.fillText(p.name, 1, -44 - lift + 1); g.fillStyle = p.bot ? "#f0e6cc" : "#ffd84a"; g.fillText(p.name, 0, -44 - lift); }
      g.restore();
    }
    // HUD
    g.font = "800 15px Cinzel,serif"; g.textAlign = "left"; g.fillStyle = "#ffd27a";
    g.fillText(`${st.alive} left`, 16, 26); g.textAlign = "right"; g.fillText(fmt(st.t), W - 16, 26);
    const me = st.ps[0];
    if (!me.out) { g.textAlign = "left"; g.font = "700 12px Lora,serif"; g.fillStyle = me.dcd > 0 ? "#8a7a60" : "#8ae07a"; g.fillText(me.dcd > 0 ? "shove…" : "shove ready", 16, H - 30); g.fillStyle = me.hcd > 0 ? "#8a7a60" : "#6ad0ff"; g.fillText(me.hcd > 0 ? "hop…" : "hop ready", 16, H - 14); }
    else if (!st.over) { g.textAlign = "center"; g.font = "800 18px Cinzel,serif"; g.fillStyle = "#ff8a7a"; g.fillText("You're off. Watching the rest…", W / 2, H - 20); }
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0); last = ts;
    if (st && !st.over) step(dt); else if (st) { for (const p of st.ps) if (p.out && p.fall > 0) p.fall -= dt; }
    if (st) draw();
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    const pot = players * 20, ranked = st.ps.slice().sort((a, b) => a.place - b.place);
    const me = st.ps[0], won = me.place === 1;
    $("poT").textContent = won ? "You're the last one standing" : `${ranked[0].name} takes it`;
    $("poP").innerHTML = `${players} on the ring at 20 ZC each: <b>${pot} ZC</b> to the winner, the house takes nothing.${won ? "" : ` You came <b>${ord(me.place)}</b>.`}`;
    $("poX").innerHTML = `<table>${ranked.map((p) => `<tr class="${p.bot ? "" : "me"}"><td>${ord(p.place)}</td><td>${p.name}</td><td>${p.place === 1 ? `+${pot - 20}` : "−20"} ZC</td></tr>`).join("")}</table>`;
    $("poGo").textContent = "Again";
    ov.hidden = false;
    logp(won ? `You win ${pot} ZC.` : `${ranked[0].name} wins.`, won ? "good" : "");
    const r = JSON.parse(localStorage.getItem("ecPartyPo") || "{\"p\":0,\"w\":0}"); r.p++; if (won) r.w++; try { localStorage.setItem("ecPartyPo", JSON.stringify(r)); } catch {}
    rec();
  }
  const ord = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
  function rec() { let r = { p: 0, w: 0 }; try { r = JSON.parse(localStorage.getItem("ecPartyPo")) || r; } catch {} $("poRec").textContent = `${r.w} wins in ${r.p}`; }
  rec();

  document.querySelectorAll("#poSize button").forEach((b) => b.addEventListener("click", () => {
    players = +b.dataset.n; document.querySelectorAll("#poSize button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));
  $("poGo").addEventListener("click", () => { ov.hidden = true; newGame(); cv.focus(); if (!raf) raf = requestAnimationFrame(loop); });
  const stop = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
  cv.addEventListener("keydown", (e) => { keys[e.code] = true; if (stop.includes(e.code)) e.preventDefault(); if (e.code === "Escape" && st && !st.over) { st.ps[0].out = 1; st.ps[0].fall = 0.01; st.ps[0].place = st.alive--; } });
  cv.addEventListener("keyup", (e) => { keys[e.code] = false; });
  cv.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
  document.querySelectorAll("#poPad button").forEach((b) => {
    const k = b.dataset.k; const on = (v) => (e) => { e.preventDefault(); keys[k] = v; };
    b.addEventListener("pointerdown", on(true)); b.addEventListener("pointerup", on(false)); b.addEventListener("pointerleave", on(false));
  });
  // first frame: an empty ring behind the start box
  window.addEventListener("load", () => { if (st.over) draw(); });
  newGame(); draw(); st.over = true; $("poLog").innerHTML = "<p class=\"note\">Nothing yet.</p>";
})();

/* ====================================================================== HOT POTATO */
(function potato() {
  const cv = $("hpCv"); if (!cv) return;
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height, CX = W / 2, CY = H / 2 + 10;
  const N = 6, ROUNDS = 5, RATE = 10, CATCH = 0.8, FLY = 0.45, FUSE_MIN = 4, FUSE_SPAN = 10, BOOM_COST = 25;
  const potatoImg = Object.assign(new Image(), { src: "potato.png" });
  let st = null, raf = 0, last = 0;
  const seats = [...Array(N)].map((_, i) => { const a = Math.PI / 2 + (i / N) * Math.PI * 2; return { x: CX + Math.cos(a) * 290, y: CY + Math.sin(a) * 150 }; });

  function newGame() {
    st = { round: 0, ps: [...Array(N)].map((_, i) => ({ i, name: NAMES[i], col: COLS[i], skin: SKINS[i % SKINS.length], bank: 0, bot: i > 0, greed: rnd(1.2, 4.6), booms: 0 })), over: false };
    $("hpLog").innerHTML = "";
    nextRound();
  }
  async function nextRound() {
    const game = st; game.round++;
    const seed = seedHex(), h = await sha(`${seed}:fuse`), fuse = FUSE_MIN + (parseInt(h.slice(0, 8), 16) / 2 ** 32) * FUSE_SPAN, commit = await sha(seed);
    if (st !== game) return;   // a new game started while the hashes were being worked out
    const first = Math.floor(Math.random() * N);
    Object.assign(st, { t: 0, fuse, seed, commit, holder: first, from: -1, fly: 0, flyFrom: -1, held: 0, catchT: CATCH, boom: 0, between: 0, botWant: 0 });
    st.botWant = st.ps[first].bot ? rnd(0.3, st.ps[first].greed) : 0;
    $("hpSeal").innerHTML = `Round ${st.round}: the fuse is sealed. Hash <code>${commit.slice(0, 16)}…</code>`;
    lg(`Round ${st.round} of ${ROUNDS}. ${first ? st.ps[first].name + " starts" : "You start"} with it.`);
    paintBoard();
  }
  function lg(s, cls) { const p = document.createElement("p"); if (cls) p.className = cls; p.textContent = s; $("hpLog").prepend(p); }
  function pass(to) {
    if (!st || st.over || st.boom || st.fly || st.holder < 0) return;
    const h = st.holder; if (to === h) return;
    if (to === st.from) return h === 0 && lg(`No straight back to ${st.ps[to].name}. Pick someone else.`, "bad");
    if (st.catchT > 0) return h === 0 && lg("Still catching it…", "bad");
    const p = st.ps[h]; p.bank += Math.round(st.held * RATE);
    st.flyFrom = h; st.from = h; st.holder = -1; st.fly = FLY; st.to = to; st.held = 0;
  }
  function step(dt) {
    if (st.over) return;
    if (st.between > 0) { st.between -= dt; if (st.between <= 0) { if (st.round >= ROUNDS) return end(); nextRound(); } return; }
    if (st.boom) return;
    st.t += dt;
    if (st.fly > 0) { st.fly -= dt; if (st.fly <= 0) { st.holder = st.to; st.catchT = CATCH; const q = st.ps[st.holder]; st.botWant = q.bot ? rnd(0.2, q.greed) * (st.t > 8 ? 0.5 : 1) : 0; } }
    else if (st.holder >= 0) {
      st.held += dt; st.catchT = Math.max(0, st.catchT - dt);
      const p = st.ps[st.holder];
      if (p.bot && st.catchT <= 0 && st.held >= st.botWant) {
        const opts = st.ps.filter((q) => q.i !== p.i && q.i !== st.from);
        const lead = opts.slice().sort((a, b) => b.bank - a.bank)[0];
        pass(Math.random() < 0.55 ? lead.i : opts[Math.floor(Math.random() * opts.length)].i);
      }
    }
    if (st.t >= st.fuse) boom();
    paintBoard();
  }
  function boom() {
    st.boom = 1;
    const v = st.holder >= 0 ? st.holder : st.to;  // in the air: it lands on whoever it was thrown to
    const p = st.ps[v], lost = Math.min(p.bank, BOOM_COST);
    p.bank -= lost; p.booms++;
    lg(`BOOM at ${st.fuse.toFixed(2)} s, ${p.bot ? p.name + " was" : "you were"} holding it: ${Math.round(st.held * RATE)} unbanked gone and ${lost} from the bank.`, p.bot ? "" : "bad");
    st.boomAt = v; st.held = 0; st.holder = v; st.fly = 0;
    $("hpSeal").innerHTML = `Round ${st.round}: seed <code>${st.seed}</code> → fuse <b>${st.fuse.toFixed(2)} s</b>. <span class="ok">sha256(seed) = ${st.commit.slice(0, 16)}… ✓ matches</span>`;
    setTimeout(() => { st.boom = 0; st.between = 1.6; st.holder = -1; }, 1400);
    paintBoard();
  }
  function end() {
    st.over = true;
    const r = st.ps.slice().sort((a, b) => b.bank - a.bank), me = st.ps[0], pot = N * 20;
    const top = r.filter((p) => p.bank === r[0].bank);
    $("hpT").textContent = top.includes(me) ? (top.length > 1 ? "A shared win" : "You win the pot") : `${r[0].name} wins`;
    $("hpP").innerHTML = `${N} at the table at 20 ZC: <b>${pot} ZC</b> to the highest bank${top.length > 1 ? `, split ${top.length} ways` : ""}. Nothing to the house.`;
    $("hpX").innerHTML = `<table>${r.map((p, k) => `<tr class="${p.bot ? "" : "me"}"><td>${k + 1}</td><td>${p.name}</td><td>${p.bank} pts</td><td>${p.booms ? "💥".repeat(p.booms) : ""}</td></tr>`).join("")}</table>`;
    $("hpGo").textContent = "Again";
    $("hpOver").hidden = false;
  }
  function paintBoard() {
    $("hpScore").innerHTML = st.ps.map((p) => `<div class="hp-s${st.holder === p.i ? " hold" : ""}${p.bot ? "" : " me"}"><i style="background:${p.col}"></i><b>${p.name}</b><span>${p.bank}${st.holder === p.i && !st.boom ? ` <em>+${Math.round(st.held * RATE)}</em>` : ""}</span></div>`).join("");
  }
  function draw() {
    g.fillStyle = "#14301e"; g.fillRect(0, 0, W, H);
    // the felt table
    g.save(); g.beginPath(); g.ellipse(CX, CY, 330, 185, 0, 0, Math.PI * 2); g.fillStyle = "#5a3a14"; g.fill();
    g.beginPath(); g.ellipse(CX, CY, 318, 174, 0, 0, Math.PI * 2); g.fillStyle = "#1e6a3a"; g.fill();
    g.beginPath(); g.ellipse(CX, CY, 240, 118, 0, 0, Math.PI * 2); g.strokeStyle = "rgba(255,230,160,.25)"; g.lineWidth = 2; g.stroke(); g.restore();
    g.font = "800 22px Cinzel,serif"; g.textAlign = "center"; g.fillStyle = "rgba(255,230,160,.22)"; g.fillText("HOT POTATO", CX, CY - 4);
    g.font = "700 13px Lora,serif"; g.fillText(`round ${st.round} of ${ROUNDS}`, CX, CY + 18);
    st.ps.forEach((p, i) => {
      const s = seats[i], im = img(p.skin), hold = st.holder === i && !st.fly;
      g.save(); g.translate(s.x, s.y);
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(0, 4, 18, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = p.col; g.lineWidth = p.bot ? 2 : 3.5; g.beginPath(); g.ellipse(0, 4, 21, 9, 0, 0, Math.PI * 2); g.stroke();
      if (st.boom && st.boomAt === i) { g.fillStyle = "rgba(255,120,40,.5)"; g.beginPath(); g.arc(0, -20, 46, 0, Math.PI * 2); g.fill(); }
      if (im.complete && im.naturalWidth) { const w = im.naturalWidth * 0.75, h = im.naturalHeight * 0.75; g.drawImage(im, Math.round(-w / 2), Math.round(-h + 6), Math.round(w), Math.round(h)); }
      g.font = "800 12px Lora,serif"; g.fillStyle = "#000"; g.fillText(p.name, 1, 25); g.fillStyle = p.bot ? "#f0e6cc" : "#ffd84a"; g.fillText(p.name, 0, 24);
      g.font = "700 11px Lora,serif"; g.fillStyle = "#cfe8c0"; g.fillText(`${p.bank} pts · key ${i + 1}`, 0, 38);
      if (hold) drawPotato(0, -58, st.catchT > 0);
      g.restore();
    });
    if (st.fly > 0) { const a = seats[st.flyFrom], b = seats[st.to], k = 1 - st.fly / FLY; drawPotato(a.x + (b.x - a.x) * k, a.y - 58 + (b.y - a.y) * k - Math.sin(k * Math.PI) * 60, false); }
    // no fuse clock: nobody knows it. Only the sparks, which say nothing.
    if (st.between > 0 && !st.over) { g.font = "800 18px Cinzel,serif"; g.fillStyle = "#ffd27a"; g.fillText(st.round >= ROUNDS ? "Counting the banks…" : "Next round…", CX, CY + 48); }
  }
  function drawPotato(x, y, locked) {
    g.save(); g.translate(x, y);
    if (potatoImg.complete && potatoImg.naturalWidth) g.drawImage(potatoImg, -24, -24, 48, 48);
    else { g.fillStyle = "#3a2a1a"; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill(); }
    for (let k = 0; k < 4; k++) { g.fillStyle = ["#ffd84a", "#ff6a3a", "#fff"][k % 3]; g.fillRect(Math.round(10 + Math.random() * 10), Math.round(-26 + Math.random() * 8), 3, 3); }
    if (locked) { g.font = "800 10px Lora,serif"; g.textAlign = "center"; g.fillStyle = "#fff"; g.fillText("catching", 0, 34); }
    g.restore();
  }
  function loop(ts) { const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; if (st) { step(dt); draw(); } raf = requestAnimationFrame(loop); }
  cv.addEventListener("click", (e) => {
    if (!st || st.holder !== 0) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    let best = -1, bd = 70; seats.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - 20 - y); if (d < bd) { bd = d; best = i; } });
    if (best > 0) pass(best);
  });
  cv.addEventListener("keydown", (e) => { const n = +e.key; if (n >= 2 && n <= N && st && st.holder === 0) { pass(n - 1); e.preventDefault(); } });
  $("hpGo").addEventListener("click", () => { $("hpOver").hidden = true; newGame(); cv.focus(); if (!raf) raf = requestAnimationFrame(loop); });
  st = { round: 0, over: true, ps: [...Array(N)].map((_, i) => ({ i, name: NAMES[i], col: COLS[i], skin: SKINS[i % SKINS.length], bank: 0, bot: i > 0, booms: 0 })), holder: -1, fly: 0, between: 0 };
  draw(); paintBoard();
  window.addEventListener("load", () => { if (st.over) draw(); });
})();
})();

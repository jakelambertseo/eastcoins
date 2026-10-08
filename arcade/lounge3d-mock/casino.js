/* THE CASINO ROOM (2026-10-07 mockup, the owner: "could we visually put some of the casino games in 3d in a room in the lounge? ... could
   users see the plinko board, could they see the slots spinning", then "option 1": the same games, for the same ZCoins).

   Through an arch in the lounge's west wall. Four games, all of them the REAL casino's: this file draws them and calls the site's own
   endpoints, so the stake, the limits (20 ZC a play, ten an hour per game, the hourly win cap), the seeds and "Check this seed" are the
   ones eastcoin.vip already has. Nothing here decides anything: every result arrives from the server settled, and the room plays it back.
     - THE WHEEL on the west wall (/api/casino/wheel/*): shared rounds, so the whole room watches the same spin.
     - THE COIN on its pedestal (/api/coin/*): shared rounds every 30 s.
     - PLINKO, a glass cabinet on the north wall (/api/casino/plinko/*): the ball follows the server's path, peg by peg.
     - SLOTS, three machines on the south wall (/api/casino/slots/*, the EastScape table, with its shared jackpot).
   Your own Plinko drops and slot spins are shown to the rest of the room through the arcade server (cshow), which only relays them.

   Polling: the wheel's and coin's state are asked for only while you're in this room and the tab is visible (one request a second
   between them), the slots' jackpot every 15 s; nothing at all from anywhere else in the lounge. */
export function buildCasino(ctx) {
  const { THREE, scene, A, Sfx, me, R, W, WALK, REGIONS, block, std, basic, canvasTex, tickers, spots, clamp, esc, CALM, keep, CO0, CO1, COH } = ctx;
  const X0 = -W - 14, X1 = -W, Z0 = -14, Z1 = 2, H = 5;
  WALK.push([X1 - R - 0.2, X1 + R + 0.2, CO0 + R, CO1 - R], [X0 + R, X1 - R, Z0 + R, Z1 - R]);
  REGIONS.push({ name: "casino", x0: X0, x1: X1 - 0.01, z0: Z0, z1: Z1, ceil: H });
  const fmt = (n) => Number(n).toLocaleString();
  const mk = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const inRoom = () => me.p.x < X1 - 0.05;

  /* ================================================================== the room */
  {
    // carpet: deep red with gold and teal swirls, the casino-floor kind
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#4a0a1c"; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 18; k++) { g.strokeStyle = k % 3 ? "rgba(255,196,60,.55)" : "rgba(40,200,190,.5)"; g.lineWidth = 3; g.beginPath(); const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 22; g.arc(x, y, r, Math.random() * 6, Math.random() * 6 + 3); g.stroke(); }
      for (let k = 0; k < 30; k++) { g.fillStyle = "rgba(255,210,90,.6)"; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.5, 0, 7); g.fill(); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((X1 - X0) / 2.2, (Z1 - Z0) / 2.2);
    const fl = mk(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }), (X0 + X1) / 2, 0.003, (Z0 + Z1) / 2); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
    // walls: dark red velvet with a gold rail, and a ceiling
    const wall = std(0x2a0612, { roughness: 0.9 }), rail = std(0xc9a227, { metalness: 0.8, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.5 });
    const W2 = (w, d, x, z) => { mk(new THREE.BoxGeometry(w, H, d), wall, x, H / 2, z); block(x, z, w, d); };
    W2(X1 - X0 + 0.3, 0.3, (X0 + X1) / 2, Z0 - 0.15); W2(X1 - X0 + 0.3, 0.3, (X0 + X1) / 2, Z1 + 0.15); W2(0.3, Z1 - Z0, X0 - 0.15, (Z0 + Z1) / 2);
    W2(0.3, -11 - Z0, X1 + 0.15, (Z0 - 11) / 2);   // the east wall beyond the lounge's corner
    // the lounge's west wall, faced in velvet on this side, round the arch
    for (const [z0, z1] of [[-11, CO0], [CO1, Z1]]) mk(new THREE.BoxGeometry(0.02, H, z1 - z0), wall, X1 - 0.31, H / 2, (z0 + z1) / 2);
    mk(new THREE.BoxGeometry(0.02, H - COH, CO1 - CO0), wall, X1 - 0.31, COH + (H - COH) / 2, (CO0 + CO1) / 2);
    for (const [w, d, x, z] of [[X1 - X0, 0.06, (X0 + X1) / 2, Z0 + 0.02], [X1 - X0, 0.06, (X0 + X1) / 2, Z1 - 0.02], [0.06, Z1 - Z0, X0 + 0.02, (Z0 + Z1) / 2]]) for (const y of [1.05, 4.6]) mk(new THREE.BoxGeometry(w, 0.06, d), rail, x, y, z);
    const ceil = mk(new THREE.PlaneGeometry(X1 - X0 + 0.6, Z1 - Z0 + 0.6), new THREE.MeshStandardMaterial({ color: 0x14040a, roughness: 1 }), (X0 + X1) / 2, H, (Z0 + Z1) / 2); ceil.rotation.x = Math.PI / 2;
    // a gold frame round the arch, both faces, and a CASINO sign over it on the lounge side
    for (const s of [1, -1]) {
      const x = X1 + s * 0.33;
      for (const z of [CO0, CO1]) mk(new THREE.BoxGeometry(0.06, COH, 0.12), rail, x, COH / 2, z);
      mk(new THREE.BoxGeometry(0.06, 0.12, CO1 - CO0 + 0.12), rail, x, COH, (CO0 + CO1) / 2);
    }
    const sign = canvasTex(1024, 220, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "150px Monoton"; g.shadowBlur = 26; g.shadowColor = "#ffcc33"; g.fillStyle = "#fff4c8"; g.fillText("CASINO", w / 2, h / 2 + 8); });
    const sp = mk(new THREE.PlaneGeometry(3.6, 0.78), basic(0xffffff, { map: sign, transparent: true }), X1 + 0.36, COH + 0.55, (CO0 + CO1) / 2); sp.rotation.y = Math.PI / 2;
    const sp2 = mk(new THREE.PlaneGeometry(3.6, 0.78), basic(0xffffff, { map: sign, transparent: true }), X1 - 0.34, COH + 0.5, (CO0 + CO1) / 2); sp2.rotation.y = -Math.PI / 2;
    // two warm lights: the room's own (essential) and one over the wheel (decoration)
    const l1 = keep(new THREE.PointLight(0xffc890, 9, 18, 1.3), 1); l1.position.set((X0 + X1) / 2, H - 0.5, (Z0 + Z1) / 2); scene.add(l1);
    const l2 = keep(new THREE.PointLight(0xff5a7a, 6, 9, 1.6), 3); l2.position.set(X0 + 3, 4, -6); scene.add(l2);
    // chandeliers of glowing bulbs (no lights), a velvet rope by the door
    for (const [cx, cz] of [[(X0 + X1) / 2 - 3, -9], [(X0 + X1) / 2 + 2, -2]]) {
      mk(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), rail, cx, H - 0.4, cz);
      mk(new THREE.TorusGeometry(0.55, 0.03, 6, 32), rail, cx, H - 0.85, cz).rotation.x = Math.PI / 2;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; mk(new THREE.SphereGeometry(0.06, 8, 6), basic(0xfff1c0), cx + Math.cos(a) * 0.55, H - 0.95, cz + Math.sin(a) * 0.55); }
    }
  }

  /* ================================================================== talking to the casino */
  const api = async (path, body) => {
    try {
      const r = await fetch(path, body ? { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "include", cache: "no-store" });
      const j = await r.json().catch(() => ({ ok: false, message: "The casino didn't answer." }));
      return r.ok ? j : { ok: false, ...j };
    } catch { return { ok: false, message: "The casino didn't answer." }; }
  };
  let zc = null;   // your ZCoin balance, as the last bet told us
  const STAKES = [1, 5, 10, 20];
  const stakeOf = { wheel: 10, coin: 10, plinko: 5, slots: 5 };
  let win = null;   // which game's window is open (its id), so a tick can redraw it
  let msg = "";
  function betWindow(id, title, body, buttons, onBet) {
    win = id; msg = "";
    const html = () => `<p class="ak-note" style="margin:0 0 10px;color:var(--ak-yellow)">💰 Real ZCoins: the same game, limits and fairness as the casino on eastcoin.vip.</p>
      ${body()}
      <p class="ak-eyebrow" style="margin-top:12px">Stake</p>
      <div class="ak-opick">${STAKES.map((s) => `<button type="button" class="ak-btn sm${stakeOf[id] === s ? " yellow" : " ghost"}" data-stake="${s}">${s} ZC</button>`).join("")}</div>
      <div class="ak-opick" style="margin-top:10px">${buttons().map((b) => `<button type="button" class="ak-btn${b.cls ? " " + b.cls : ""}" data-bet="${b.key}" ${b.off ? "disabled" : ""}>${b.label}</button>`).join("")}</div>
      ${msg ? `<p class="ak-note" style="color:var(--ak-pink)">${esc(msg)}</p>` : ""}
      <p class="ak-note">${zc === null ? "" : `Balance: <b>${fmt(zc)} ZC</b> · `}<a href="/?view=verify" target="_top" style="color:var(--ak-cyan)">Check a seed ↗</a></p>`;
    A.openCustom({
      title, html,
      onClick: async (b) => {
        if (b.dataset.stake) { stakeOf[id] = Number(b.dataset.stake); A.redrawCustom(); return; }
        if (b.dataset.bet) { b.disabled = true; const r = await onBet(b.dataset.bet, stakeOf[id]); msg = r && !r.ok ? r.message || "That didn't go through." : ""; if (r?.balance != null) zc = r.balance; if (A.windowOpen()) A.redrawCustom(); }
      }
    });
  }
  const isOpen = (id) => win === id && A.windowOpen();
  const clockOff = { v: 0 };   // server time minus ours
  const left = (at) => Math.max(0, Math.ceil((at - (Date.now() + clockOff.v)) / 1000));

  /* a sign: a glowing panel whose canvas is redrawn when its text changes */
  function board(w, h, cw, ch, x, y, z, ry, accent) {
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = mk(new THREE.PlaneGeometry(w, h), basic(0xffffff, { map: t })); m.position.set(x, y, z); m.rotation.y = ry;
    let last = "";
    return (lines) => {   // lines: [[text, font, colour], ...]
      const key = JSON.stringify(lines); if (key === last) return; last = key;
      const g = c.getContext("2d"); g.fillStyle = "#0c0410"; g.fillRect(0, 0, cw, ch); g.strokeStyle = accent; g.lineWidth = 6; g.strokeRect(5, 5, cw - 10, ch - 10);
      g.textAlign = "center"; g.textBaseline = "middle"; let y2 = 0; const step = ch / (lines.length + 0.4);
      for (const [text, font, col] of lines) { y2 += step; g.font = font; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.fillText(text, cw / 2, y2 - step * 0.3, cw - 30); }
      t.needsUpdate = true;
    };
  }
  const popups = [];
  function popup(text, color, x, y, z) {   // floating "+60" over a game
    const t = canvasTex(512, 128, (g, w, h) => { g.textAlign = "center"; g.textBaseline = "middle"; g.font = "84px Bungee"; g.lineWidth = 10; g.strokeStyle = "#000"; g.strokeText(text, w / 2, h / 2); g.fillStyle = color; g.fillText(text, w / 2, h / 2); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(2.4, 0.6, 1); s.position.set(x, y, z); scene.add(s);
    popups.push({ s, life: 2.4 });
  }
  const meId = () => A.hello?.you?.id || "dev:bootypaper";

  /* ================================================================== THE WHEEL */
  const WH = { x: X0 + 0.3, y: 2.6, z: -6, r: 2.0 };
  const wheel = { disc: null, spin: null, shown: 0, segs: null, state: null, pending: null, sign: null };
  {
    const segs = []; const each = (360 - 6) / 24; for (let i = 0; i < 24; i++) segs.push({ color: i % 2 ? "black" : "red", from: i * each, to: (i + 1) * each }); segs.push({ color: "gold", from: 354, to: 360 });
    wheel.segs = segs;
    const COLS = { red: "#c8102e", black: "#16161e", gold: "#ffcc33" };
    const tex = canvasTex(1024, 1024, (g, w) => {
      const c = w / 2, r = c - 6;
      for (const s of segs) { g.beginPath(); g.moveTo(c, c); g.arc(c, c, r, ((s.from - 90) * Math.PI) / 180, ((s.to - 90) * Math.PI) / 180); g.closePath(); g.fillStyle = COLS[s.color]; g.fill(); g.strokeStyle = "#e8c66a"; g.lineWidth = 3; g.stroke(); }
      g.beginPath(); g.arc(c, c, r * 0.3, 0, 7); g.fillStyle = "#1a0810"; g.fill(); g.strokeStyle = "#e8c66a"; g.lineWidth = 8; g.stroke();
      g.textAlign = "center"; g.textBaseline = "middle"; g.font = "64px Bungee"; g.fillStyle = "#ffcc33"; g.fillText("EC", c, c);
      // the gold sliver says 60×
      g.save(); g.translate(c, c); g.rotate(((357 - 90) * Math.PI) / 180); g.font = "34px Bungee"; g.fillStyle = "#1a0810"; g.fillText("60×", r * 0.8, 0); g.restore();
    });
    const g = new THREE.Group(); g.position.set(WH.x, WH.y, WH.z); g.rotation.y = Math.PI / 2; scene.add(g);
    mk(new THREE.CylinderGeometry(WH.r + 0.18, WH.r + 0.18, 0.18, 64), std(0x3a1a08, { metalness: 0.5, roughness: 0.4 }), 0, 0, -0.06, g).rotation.x = Math.PI / 2;
    wheel.disc = mk(new THREE.CircleGeometry(WH.r, 72), basic(0xffffff, { map: tex }), 0, 0, 0.04, g);
    // rim bulbs (one instanced mesh) and the pointer at the top
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), basic(0xfff1c0), 32);
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; bulbs.setMatrixAt(k, new THREE.Matrix4().makeTranslation(Math.cos(a) * (WH.r + 0.1), Math.sin(a) * (WH.r + 0.1), 0.06)); }
    g.add(bulbs); wheel.bulbs = bulbs;
    const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 3), std(0xffe08a, { metalness: 0.8, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.7 }));
    ptr.rotation.z = Math.PI; ptr.position.set(0, WH.r + 0.18, 0.14); g.add(ptr);
    mk(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 20), std(0xc9a227, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0.12, g).rotation.x = Math.PI / 2;
    wheel.sign = board(2.6, 1.0, 780, 300, X0 + 0.22, WH.y + WH.r + 0.85, WH.z, Math.PI / 2, "#ffcc33");
    // a betting rail in front of it
    mk(new THREE.BoxGeometry(0.5, 1.0, 3.2), std(0x1a0810, { roughness: 0.5 }), X0 + 3.2, 0.5, WH.z); mk(new THREE.BoxGeometry(0.56, 0.06, 3.26), std(0xc9a227, { metalness: 0.8, roughness: 0.3 }), X0 + 3.2, 1.02, WH.z);
    block(X0 + 3.2, WH.z, 0.5, 3.2);
  }
  // which segment is under the pointer when the disc is turned by `rot` (radians, counter-clockwise from the front)
  const wheelAt = (rot) => { const a = (((rot * 180) / Math.PI) % 360 + 360) % 360; return wheel.segs.find((s) => a >= s.from && a < s.to)?.color; };
  function wheelLines() {
    const st = wheel.state; if (!st) return [["THE WHEEL", "64px Bungee", "#ffcc33"], ["…", "40px Bungee", "#fff"]];
    const rd = st.round, bets = st.bets || [];
    const head = wheel.spin ? ["SPINNING…", "56px Bungee", "#fff4c8"] : rd.phase === "bets" ? [`BETS OPEN · ${left(rd.closesAt)}s`, "56px Bungee", "#9affb0"]
      : rd.result ? [`${String(rd.result.color).toUpperCase()}${rd.result.color === "gold" ? " · 60×!" : ""}`, "64px Bungee", rd.result.color === "red" ? "#ff4a5a" : rd.result.color === "gold" ? "#ffcc33" : "#cfd3ff"] : ["NO MORE BETS", "56px Bungee", "#ff8a1f"];
    return [["THE WHEEL", "44px Bungee", "#ffcc33"], head, [bets.length ? bets.slice(0, 3).map((b) => `${b.user.displayName} ${b.wager} on ${b.pick}`).join(" · ") + (bets.length > 3 ? ` +${bets.length - 3}` : "") : "No bets yet this round", "600 26px Rubik", "#e8d8ff"]];
  }
  function onWheel(st) {
    if (!st?.ok) return;
    clockOff.v = st.now - Date.now(); wheel.state = st; if (st.config?.segments) wheel.segs = st.config.segments;
    const rd = st.round;
    if (rd.phase === "result" && rd.result && wheel.shown !== rd.no) {
      wheel.shown = rd.no;
      const target = (Number(rd.result.angle) * Math.PI) / 180, r0 = wheel.disc.rotation.z, late = Date.now() + clockOff.v - rd.closesAt > 10000;
      const to = r0 + Math.PI * 2 * 5 + ((((target - r0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      if (late) wheel.disc.rotation.z = target;   // arrived after it stopped: no replay
      else { wheel.spin = { r0, to, t: 0, dur: 7 }; Sfx.play("go"); }
      if (st.me?.bet) wheel.pending = { no: rd.no, bet: st.me.bet };
    }
    // a settled bet of yours: say so once
    if (wheel.pending && !wheel.spin) {
      const p = wheel.pending, list = st.round.no === p.no ? st.bets : st.last?.no === p.no ? st.last.bets : [];
      const mine = (list || []).find((b) => b.user.id === (st.me?.id || meId()));
      if (mine && (mine.status === "WON" || mine.status === "LOST")) {
        wheel.pending = null;
        if (mine.status === "WON") { A.notify(`The wheel paid you ${fmt(mine.payout)} ZC on ${mine.pick}!`, "🎡", "gold"); popup(`+${fmt(mine.payout - mine.wager)}`, "#ffcc33", WH.x + 0.6, WH.y + 0.4, WH.z); Sfx.play("finish"); }
        else A.notify(`${mine.pick} didn't come in. -${mine.wager} ZC`, "🎡");
      }
    }
    wheel.sign(wheelLines());
    if (isOpen("wheel")) A.redrawCustom();
  }
  function openWheel() {
    const st = () => wheel.state;
    betWindow("wheel", "THE WHEEL",
      () => { const s = st(); const rd = s?.round, mine = s?.me?.bet;
        return `<p class="ak-note">${!rd ? "Finding the table…" : rd.phase === "bets" ? `Bets close in <b>${left(rd.closesAt)}s</b>.` : "No more bets: this one's spinning. The next round opens shortly."}
          ${mine ? ` You have <b>${mine.wager} ZC on ${mine.pick}</b>.` : ""} Red or black pays about ×2.03, the gold sliver ×60 (each spin's own edge, 96 to 104%, multiplies in when it settles).
          ${s?.me ? ` ${Math.max(0, (s.config?.maxPerHour || 10) - (s.me.betsThisHour || 0))} plays left this hour.` : ""}</p>`; },
      () => { const s = st(), open = s?.round?.phase === "bets" && !s?.me?.bet; return [{ key: "red", label: "🔴 Red", off: !open }, { key: "black", label: "⚫ Black", cls: "ghost", off: !open }, { key: "gold", label: "🟡 Gold ×60", cls: "yellow", off: !open }]; },
      async (pick, wager) => { const r = await api("/api/casino/wheel/bet", { pick, wager }); if (r.ok) { Sfx.play("checkpoint"); A.notify(`${wager} ZC on ${pick}. Good luck!`, "🎡", "lime"); onWheel(await api("/api/casino/wheel/state")); } return r; });
  }
  spots.push({ kind: "wheel", x: X0 + 3.9, z: WH.z, r: 2.2, label: () => `<kbd>E</kbd> The Wheel: place a bet`, use: openWheel });

  /* ================================================================== THE COIN */
  const CN = { x: X1 - 4.2, z: -10.2 };   // the north-east corner: clear of the line from the door to the wheel
  const coin = { m: null, toss: null, shown: 0, state: null, pending: null, sign: null };
  {
    mk(new THREE.CylinderGeometry(0.75, 0.95, 1.0, 32), std(0x1a0810, { roughness: 0.5 }), CN.x, 0.5, CN.z);
    mk(new THREE.TorusGeometry(0.76, 0.04, 8, 40), std(0xc9a227, { metalness: 0.8, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.6 }), CN.x, 1.0, CN.z).rotation.x = Math.PI / 2;
    block(CN.x, CN.z, 1.8, 1.8);
    const face = (word, sym) => canvasTex(512, 512, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2); gr.addColorStop(0, "#ffe9a0"); gr.addColorStop(1, "#c9921a"); g.fillStyle = gr; g.fillRect(0, 0, w, w);
      g.strokeStyle = "#8a5a0a"; g.lineWidth = 18; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 30, 0, 7); g.stroke(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#6a3a00"; g.font = "190px Bungee"; g.fillText(sym, w / 2, w / 2 - 30); g.font = "64px Bungee"; g.fillText(word, w / 2, w / 2 + 130); });
    const gold = std(0xd8a630, { metalness: 0.8, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.5 });
    const fm = (t, flip) => { if (flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; } return new THREE.MeshStandardMaterial({ map: t, metalness: 0.5, roughness: 0.35, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }); };
    coin.m = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 48), [gold, fm(face("HEADS", "EC"), true), fm(face("TAILS", "★"), true)]);   // (a cylinder cap maps its texture mirrored; flipped, both faces read right side up when they face up)
    coin.m.position.set(CN.x, 1.08, CN.z); coin.m.castShadow = true; scene.add(coin.m);
    coin.sign = board(1.8, 0.75, 600, 250, CN.x, 3.4, CN.z, Math.PI / 2, "#ffcc33");
  }
  function coinLines() {
    const st = coin.state; if (!st) return [["COIN FLIP", "56px Bungee", "#ffcc33"], ["…", "40px Bungee", "#fff"]];
    const rd = st.round, bets = st.bets || [], h = bets.filter((b) => b.side === "heads").length, t = bets.length - h;
    const head = coin.toss ? ["FLIPPING…", "52px Bungee", "#fff4c8"] : rd.phase === "bets" ? [`FLIPS IN ${left(rd.flipsAt)}s`, "52px Bungee", "#9affb0"] : rd.result ? [`${String(rd.result).toUpperCase()}!`, "64px Bungee", "#ffcc33"] : ["NO MORE BETS", "52px Bungee", "#ff8a1f"];
    return [["COIN FLIP", "40px Bungee", "#ffcc33"], head, [bets.length ? `${h} on heads · ${t} on tails` : "Heads or tails? ×2", "600 26px Rubik", "#e8d8ff"]];
  }
  function onCoin(st) {
    if (!st?.ok) return;
    clockOff.v = st.now - Date.now(); coin.state = st;
    const rd = st.round;
    if (rd.phase === "result" && rd.result && coin.shown !== rd.no) {
      coin.shown = rd.no; const up = rd.result === "heads" ? 0 : Math.PI, late = Date.now() + clockOff.v - rd.flipsAt > 6000;
      if (late) coin.m.rotation.x = up; else { coin.toss = { r0: coin.m.rotation.x, to: Math.ceil(coin.m.rotation.x / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2 * 4 + up, t: 0, dur: 2.2 }; Sfx.play("jump"); }
      if (st.me?.bet) coin.pending = { no: rd.no, bet: st.me.bet };
    }
    if (coin.pending && !coin.toss) {
      const p = coin.pending, list = st.round.no === p.no ? st.bets : st.last?.no === p.no ? st.last.bets : [];
      const mine = (list || []).find((b) => b.user.id === (st.me?.id || meId()));
      if (mine && (mine.status === "WON" || mine.status === "LOST")) {
        coin.pending = null;
        if (mine.status === "WON") { A.notify(`${mine.side}! The coin paid you ${fmt(mine.payout)} ZC.`, "🪙", "gold"); popup(`+${fmt(mine.payout - mine.wager)}`, "#ffcc33", CN.x, 2.4, CN.z); Sfx.play("finish"); }
        else A.notify(`Not ${mine.side} this time. -${mine.wager} ZC`, "🪙");
      }
    }
    coin.sign(coinLines());
    if (isOpen("coin")) A.redrawCustom();
  }
  function openCoin() {
    const st = () => coin.state;
    betWindow("coin", "COIN FLIP",
      () => { const s = st(); const rd = s?.round, mine = s?.me?.bet;
        return `<p class="ak-note">${!rd ? "Finding the coin…" : rd.phase === "bets" ? `It flips in <b>${left(rd.flipsAt)}s</b>.` : "No more bets: it's in the air. The next round opens in a few seconds."}
          ${mine ? ` You have <b>${mine.wager} ZC on ${mine.side}</b>.` : ""} Call it right and it pays ×2. ${s?.me ? `${Math.max(0, (s.config?.maxPerHour || 10) - (s.me.betsThisHour || 0))} plays left this hour.` : ""}</p>`; },
      () => { const s = st(), open = s?.round?.phase === "bets" && !s?.me?.bet; return [{ key: "heads", label: "Heads", off: !open }, { key: "tails", label: "Tails", cls: "ghost", off: !open }]; },
      async (side, wager) => { const r = await api("/api/coin/bet", { side, wager }); if (r.ok) { Sfx.play("checkpoint"); A.notify(`${wager} ZC on ${side}.`, "🪙", "lime"); onCoin(await api("/api/coin/state")); } return r; });
  }
  spots.push({ kind: "coin", x: CN.x, z: CN.z, r: 2.1, label: () => `<kbd>E</kbd> Coin Flip: heads or tails`, use: openCoin });

  /* ================================================================== PLINKO */
  const PK = { x: (X0 + X1) / 2 - 2.5, z: Z0 + 0.45, rows: 12, sp: 0.17, rh: 0.205, top: 4.05 };
  const PAYS = [25, 4, 2, 1.5, 1.1, 1.05, 0.3, 1.05, 1.1, 1.5, 2, 4, 25];
  const plinko = { balls: [], next: null, state: null };
  const pegAt = (row, k) => new THREE.Vector3(PK.x + (k - row / 2) * PK.sp, PK.top - row * PK.rh, PK.z + 0.06);
  {
    const g = new THREE.Group(); scene.add(g);
    const w = PK.sp * 14, h = PK.rows * PK.rh + 0.9;
    mk(new THREE.BoxGeometry(w + 0.3, h + 0.5, 0.25), std(0x12081e, { roughness: 0.5 }), PK.x, PK.top - h / 2 + 0.35, PK.z - 0.08, g);
    mk(new THREE.BoxGeometry(w + 0.36, 0.25, 0.4), std(0xc9a227, { metalness: 0.8, roughness: 0.3 }), PK.x, PK.top + 0.6, PK.z, g);
    const mt = canvasTex(768, 128, (c, cw, ch) => { c.textAlign = "center"; c.textBaseline = "middle"; c.font = "92px Bungee"; c.shadowBlur = 20; c.shadowColor = "#ff3ea5"; c.fillStyle = "#ffe6f4"; c.fillText("PLINKO", cw / 2, ch / 2 + 4); });
    mk(new THREE.PlaneGeometry(w, 0.42), basic(0xffffff, { map: mt, transparent: true }), PK.x, PK.top + 0.98, PK.z + 0.02, g);
    // pegs: one instanced mesh
    const n = (PK.rows * (PK.rows + 1)) / 2, pegs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), basic(0xe8f4ff), n); let i = 0;
    for (let r = 0; r < PK.rows; r++) for (let k = 0; k <= r; k++) pegs.setMatrixAt(i++, new THREE.Matrix4().makeTranslation(pegAt(r, k).x, pegAt(r, k).y, PK.z + 0.04));
    scene.add(pegs);
    // buckets, coloured hot at the edges, labelled with what they pay
    plinko.buckets = PAYS.map((p, b) => {
      const x = PK.x + (b - 6) * PK.sp, y = PK.top - PK.rows * PK.rh - 0.12, hot = p >= 4 ? "#ff3ea5" : p >= 1.5 ? "#ffcc33" : p >= 1 ? "#19e3ff" : "#5a5a7a";
      const t = canvasTex(64, 96, (c) => { c.fillStyle = hot; c.fillRect(0, 0, 64, 96); c.fillStyle = "#0c0410"; c.font = p >= 10 ? "26px Bungee" : "24px Bungee"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(`${p}`, 32, 40); c.font = "18px Bungee"; c.fillText("×", 32, 70); });
      const m = mk(new THREE.PlaneGeometry(PK.sp - 0.02, 0.26), basic(0xbbbbbb, { map: t }), x, y, PK.z + 0.05, g); return m;
    });
    // a glass front
    mk(new THREE.PlaneGeometry(w + 0.2, h), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.08, roughness: 0.05, depthWrite: false }), PK.x, PK.top - h / 2 + 0.35, PK.z + 0.11, g);
    block(PK.x, PK.z + 0.1, w + 0.4, 0.6);
  }
  // a ball down a path ("LRRL..."): one hop per row, landing on each peg the path names, then into its bucket
  function dropBall(path, color, done) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), basic(color)); scene.add(b);
    const pts = [new THREE.Vector3(PK.x, PK.top + 0.3, PK.z + 0.06)]; let k = 0;
    for (let r = 0; r < PK.rows; r++) { const p = pegAt(r, k); p.y += 0.06; pts.push(p); if (path[r] === "R") k++; }
    const bucket = k, end = new THREE.Vector3(PK.x + (bucket - 6) * PK.sp, PK.top - PK.rows * PK.rh - 0.05, PK.z + 0.06); pts.push(end);
    plinko.balls.push({ b, pts, i: 0, u: 0, done: () => { done?.(bucket); const m = plinko.buckets[bucket]; m.material.color.setHex(0xffffff); setTimeout(() => m.material.color.setHex(0xbbbbbb), 900); }, life: 1.2 });
  }
  async function plinkoState() { const s = await api("/api/casino/plinko/state"); if (s.ok) { plinko.state = s; plinko.next = s.nextHash; } return s; }
  function openPlinko() {
    if (!plinko.state) plinkoState().then(() => { if (isOpen("plinko")) A.redrawCustom(); });
    betWindow("plinko", "PLINKO",
      () => { const s = plinko.state; return `<p class="ak-note">Twelve rows, thirteen buckets: ×25 at the edges, ×0.3 in the middle, everything else pays. ${s?.me ? `${Math.max(0, (s.config?.maxPerHour || 10) - (s.me.dropsThisHour || 0))} drops left this hour.` : ""}</p>
        <p class="ak-note" style="word-break:break-all">Your next drop's seed is sealed: <code>${esc((plinko.next || "…").slice(0, 24))}…</code></p>`; },
      () => [{ key: "drop", label: "Drop the ball", cls: "yellow", off: plinko.balls.some((b) => b.mine) }],
      async (_, stake) => {
        const r = await api("/api/casino/plinko/drop", { stake });
        if (!r.ok) return r;
        plinko.next = r.nextHash; Sfx.play("go"); A.closeWindow();
        const d = r.drop;
        dropBall(d.path, 0xffcc33, () => {
          const prof = d.payout - d.stake;
          popup(`×${+Number(d.multiplier).toFixed(2)}`, d.multiplier >= 4 ? "#ff3ea5" : prof >= 0 ? "#ffcc33" : "#9aa3c7", PK.x, PK.top - PK.rows * PK.rh + 0.5, PK.z + 0.3);
          if (prof > 0) { Sfx.play(d.multiplier >= 4 ? "finish" : "checkpoint"); A.notify(`Plinko paid ${fmt(d.payout)} ZC (×${+Number(d.multiplier).toFixed(2)}).`, "🔴", d.multiplier >= 4 ? "gold" : "lime"); }
          else A.notify(`×${+Number(d.multiplier).toFixed(2)}: ${fmt(d.payout)} ZC back from ${d.stake}.`, "🔴");
          plinkoState();
        });
        plinko.balls[plinko.balls.length - 1].mine = true;
        A.send?.({ t: "cshow", g: "plinko", path: d.path, x: +Number(d.multiplier).toFixed(2) });
        return r;
      });
  }
  spots.push({ kind: "plinko", x: PK.x, z: PK.z + 1.4, r: 1.6, label: () => `<kbd>E</kbd> Plinko: drop a ball`, use: openPlinko });

  /* ================================================================== SLOTS: three machines on the south wall */
  const SYMS = ["cherry", "lemon", "bell", "star", "diamond", "seven"];
  const STRIP = [...SYMS, ...SYMS];   // twelve cells round each reel
  const stripTex = () => {
    const t = canvasTex(128, 128 * STRIP.length, (g, w) => {
      STRIP.forEach((s, i) => {
        const y = i * 128; g.fillStyle = i % 2 ? "#fbf6ea" : "#fffdf6"; g.fillRect(0, y, w, 128); g.textAlign = "center"; g.textBaseline = "middle";
        if (s === "seven") { g.font = "96px Bungee"; g.fillStyle = "#d0101e"; g.fillText("7", 64, y + 70); }
        else { g.font = "80px serif"; g.fillText({ cherry: "🍒", lemon: "🍋", bell: "🔔", star: "⭐", diamond: "💎" }[s], 64, y + 68); }
      });
    });
    t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3 / STRIP.length); return t;
  };
  // the texture offset that puts cell i in the middle of the window
  const offFor = (i) => ((1 - (i + 2) / STRIP.length) % 1 + 1) % 1;
  const slots = { machines: [], pot: null, state: null };
  {
    const MX = [(X0 + X1) / 2 - 3.2, (X0 + X1) / 2 - 1.2, (X0 + X1) / 2 + 0.8];
    MX.forEach((x, n) => {
      const g = new THREE.Group(); g.position.set(x, 0, Z1 - 0.55); g.rotation.y = Math.PI; scene.add(g);
      const col = [0xff3ea5, 0x19e3ff, 0xb6ff2e][n];
      mk(new THREE.BoxGeometry(1.2, 1.1, 0.7), std(0x1a1030, { roughness: 0.4 }), 0, 0.55, 0, g);
      mk(new THREE.BoxGeometry(1.2, 1.2, 0.5), std(0x1a1030, { roughness: 0.4 }), 0, 1.7, -0.1, g);
      mk(new THREE.BoxGeometry(1.24, 0.06, 0.74), basic(col), 0, 1.12, 0, g);
      for (const sx of [-0.61, 0.61]) mk(new THREE.BoxGeometry(0.03, 2.3, 0.72), std(col, { emissive: col, emissiveIntensity: 0.45 }), sx, 1.15, 0, g);
      const top = canvasTex(512, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#" + col.toString(16).padStart(6, "0")); gr.addColorStop(1, "#1a1030"); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.textAlign = "center"; c.textBaseline = "middle"; c.font = "70px Bungee"; c.lineWidth = 8; c.strokeStyle = "#0c0410"; c.strokeText("LUCKY 7", w / 2, h / 2); c.fillStyle = "#fff"; c.fillText("LUCKY 7", w / 2, h / 2); });
      const mq = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.5), [std(0x1a1030), std(0x1a1030), std(0x1a1030), std(0x1a1030), basic(0xdddddd, { map: top }), std(0x1a1030)]); mq.position.set(0, 2.5, -0.1); g.add(mq);
      mk(new THREE.PlaneGeometry(1.0, 0.62), basic(0x0c0410), 0, 1.75, 0.152, g);
      const reels = [0, 1, 2].map((i) => { const t = stripTex(); t.offset.y = offFor((i * 4 + n) % STRIP.length); const m = mk(new THREE.PlaneGeometry(0.28, 0.5), basic(0xffffff, { map: t }), (i - 1) * 0.31, 1.75, 0.156, g); return { t, m, spinning: false, v: 0, stopAt: 0, time: 0, target: 0 }; });
      mk(new THREE.BoxGeometry(1.0, 0.025, 0.02), basic(0xff3ea5), 0, 1.75, 0.16, g);   // the pay line
      const lever = new THREE.Group(); lever.position.set(0.66, 1.3, 0.05); g.add(lever);
      mk(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), std(0xbfc6d6, { metalness: 0.8, roughness: 0.25 }), 0, 0.3, 0, lever);
      mk(new THREE.SphereGeometry(0.07, 12, 8), basic(0xff2a3a), 0, 0.62, 0, lever);
      mk(new THREE.BoxGeometry(0.9, 0.05, 0.2), std(0x2a1a44), 0, 1.12, 0.3, g);
      block(x, Z1 - 0.55, 1.4, 0.9);
      slots.machines.push({ n, x, z: Z1 - 0.55, reels, lever, pull: 0, busy: false, who: null });
    });
    slots.sign = board(4.6, 0.8, 1100, 190, (MX[0] + MX[2]) / 2, 3.55, Z1 - 0.32, Math.PI, "#ff3ea5");
  }
  function potLines() { const p = slots.pot; return [["SLOTS JACKPOT", "52px Bungee", "#ff3ea5"], [p ? `${fmt(p.amount)} ZC${p.last ? ` · last hit by ${p.last.login}` : ""}` : "…", "56px Bungee", "#ffcc33"]]; }
  function spinMachine(mc, reels, done) {
    mc.busy = true; mc.pull = 0.5; Sfx.play("jump");
    mc.reels.forEach((r, i) => { r.spinning = true; r.v = 3.2; r.stopAt = 1.1 + i * 0.45; r.time = 0; r.target = STRIP.indexOf(reels[i]) + (i % 2 ? SYMS.length : 0); r.done = i === 2 ? done : null; });
  }
  async function slotsState() { const s = await api("/api/casino/slots/state"); if (s.ok) { slots.state = s; slots.pot = s.pot; slots.sign(potLines()); } return s; }
  function openSlots(mc) {
    if (!slots.state) slotsState().then(() => { if (isOpen("slots")) A.redrawCustom(); });
    betWindow("slots", "LUCKY 7 SLOTS",
      () => { const s = slots.state; return `<p class="ak-note">Three of a kind pays: 💎 ×50, ⭐ ×25, 🔔 ×12, 🍋 ×6, 🍒 ×4, and two cherries pay a little. <b>Three 7s win the jackpot</b>${slots.pot ? ` (<b>${fmt(slots.pot.amount)} ZC</b> right now; a 20 ZC spin takes all of it)` : ""}. Every spin feeds it.
        ${s?.me ? ` ${Math.max(0, (s.config?.maxPerHour || 10) - (s.me.played || 0))} spins left this hour.` : ""}</p>`; },
      () => [{ key: "spin", label: "Pull the lever", cls: "yellow", off: mc.busy }],
      async (_, stake) => {
        const r = await api("/api/casino/slots/spin", { stake });
        if (!r.ok) return r;
        A.closeWindow(); const sp = r.spin; if (r.pot) { slots.pot = r.pot; slots.sign(potLines()); }
        spinMachine(mc, sp.reels, () => {
          mc.busy = false;
          if (sp.jackpot > 0) { popup("JACKPOT!", "#ffcc33", mc.x, 3.0, mc.z - 0.6); A.notify(`JACKPOT! Three 7s paid ${fmt(sp.payout)} ZC!`, "🎰", "gold"); Sfx.play("finish"); }
          else if (sp.payout > 0) { popup(`+${fmt(sp.payout)}`, sp.profit > 0 ? "#ffcc33" : "#9aa3c7", mc.x, 2.8, mc.z - 0.6); Sfx.play(sp.profit > 0 ? "checkpoint" : "beep"); A.notify(`${sp.reels.join(" · ")}: ${fmt(sp.payout)} ZC back.`, "🎰", sp.profit > 0 ? "lime" : ""); }
          else A.notify(`${sp.reels.join(" · ")}. Nothing this time.`, "🎰");
          slotsState();
        });
        A.send?.({ t: "cshow", g: "slots", m: mc.n, reels: sp.reels, x: sp.jackpot > 0 ? 999 : +Number(sp.multiplier).toFixed(2) });
        return r;
      });
  }
  for (const mc of slots.machines) spots.push({ kind: "slots", x: mc.x, z: mc.z - 1.0, r: 0.85, label: () => mc.busy ? "Spinning…" : `<kbd>E</kbd> Play the slots`, use: () => { if (!mc.busy) openSlots(mc); } });

  /* someone else's drop or spin, relayed by the arcade server */
  function onShow(m) {
    if (!inRoom()) return;
    if (m.g === "plinko" && /^[LR]{12}$/.test(m.path || "")) dropBall(m.path, 0x19e3ff, () => popup(`${m.name} ×${m.x}`, "#19e3ff", PK.x, PK.top - PK.rows * PK.rh + 0.5, PK.z + 0.3));
    if (m.g === "slots" && Array.isArray(m.reels) && m.reels.length === 3 && m.reels.every((s) => SYMS.includes(s))) {
      const mc = slots.machines[m.m] || slots.machines[0]; if (mc.busy) return;
      spinMachine(mc, m.reels, () => { mc.busy = false; if (m.x >= 999) popup(`${m.name}: JACKPOT!`, "#ffcc33", mc.x, 3.0, mc.z - 0.6); else if (m.x > 0) popup(`${m.name} ×${m.x}`, "#19e3ff", mc.x, 2.8, mc.z - 0.6); });
    }
  }

  /* ================================================================== every frame */
  let pollT = 0, which = 0, potT = 0, wasIn = false;
  wheel.sign(wheelLines()); coin.sign(coinLines()); slots.sign(potLines());
  tickers.push((dt, t) => {
    const here = inRoom();
    // polls: only from inside the room, only while the tab is showing
    if (here && !document.hidden) {
      if (!wasIn) { pollT = 0; potT = 0; }
      pollT -= dt; if (pollT <= 0) { pollT = 1; (which++ % 2 ? api("/api/coin/state").then(onCoin) : api("/api/casino/wheel/state").then(onWheel)); }
      potT -= dt; if (potT <= 0) { potT = 15; slotsState(); }
      wheel.sign(wheelLines()); coin.sign(coinLines());
    }
    wasIn = here;
    // the wheel
    if (wheel.spin) { const s = wheel.spin; s.t += dt; const u = Math.min(1, s.t / s.dur), e = 1 - Math.pow(1 - u, 3); wheel.disc.rotation.z = s.r0 + (s.to - s.r0) * e; if (u >= 1) { wheel.spin = null; Sfx.play("checkpoint"); wheel.sign(wheelLines()); } }
    // the coin: up, turning, down
    if (coin.toss) { const s = coin.toss; s.t += dt; const u = Math.min(1, s.t / s.dur); coin.m.rotation.x = s.r0 + (s.to - s.r0) * (1 - Math.pow(1 - u, 2)); coin.m.position.y = 1.08 + Math.sin(u * Math.PI) * 1.6; if (u >= 1) { coin.toss = null; coin.m.position.y = 1.08; Sfx.play("land"); coin.sign(coinLines()); } }
    else if (!CALM && here) coin.m.position.y = 1.08 + Math.sin(t * 2) * 0.02;
    // plinko balls
    for (let i = plinko.balls.length - 1; i >= 0; i--) {
      const B = plinko.balls[i];
      if (B.i < B.pts.length - 1) {
        B.u += dt / (B.i === 0 ? 0.3 : 0.13);
        if (B.u >= 1) { B.u = 0; B.i++; if (B.i < B.pts.length - 1 && here) Sfx.play("step"); }
        if (B.i < B.pts.length - 1) { const a = B.pts[B.i], b = B.pts[B.i + 1]; B.b.position.lerpVectors(a, b, B.u); B.b.position.y += Math.sin(B.u * Math.PI) * 0.05; }
        else { B.b.position.copy(B.pts[B.pts.length - 1]); B.done(); }
      } else { B.life -= dt; if (B.life <= 0) { scene.remove(B.b); B.b.geometry.dispose(); plinko.balls.splice(i, 1); } }
    }
    // slot reels: spin, then each one eases onto its symbol
    for (const mc of slots.machines) {
      if (mc.pull > 0) { mc.pull = Math.max(0, mc.pull - dt); mc.lever.rotation.x = Math.sin((mc.pull / 0.5) * Math.PI) * 0.9; }
      for (const r of mc.reels) {
        if (!r.spinning) continue;
        r.time += dt;
        if (r.time < r.stopAt) r.t.offset.y = (r.t.offset.y - dt * r.v + 1) % 1;
        else {
          // settle: from wherever it is, run on down to the target cell over a short ease
          if (r.settle == null) { const goal = offFor(r.target % STRIP.length), d = (((r.t.offset.y - goal) % 1) + 1) % 1; r.settle = { from: r.t.offset.y, d, k: 0 }; }
          r.settle.k = Math.min(1, r.settle.k + dt / 0.35); const e = 1 - Math.pow(1 - r.settle.k, 3);
          r.t.offset.y = ((r.settle.from - r.settle.d * e) % 1 + 1) % 1;
          if (r.settle.k >= 1) { r.spinning = false; r.settle = null; Sfx.play("beep"); r.done?.(); r.done = null; }
        }
      }
    }
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.life -= dt; p.s.position.y += dt * 0.5; p.s.material.opacity = Math.min(1, p.life); if (p.life <= 0) { scene.remove(p.s); p.s.material.map.dispose(); popups.splice(i, 1); } }
    // the wheel's rim bulbs chase while it spins
    if (!CALM && wheel.bulbs) wheel.bulbs.rotation.z = wheel.spin ? -t * 3 : 0;
  });

  return { onShow, wheel, coin, plinko, slots, dropBall, spinMachine, onWheel, onCoin, inRoom, X0, X1, Z0, Z1 };
}

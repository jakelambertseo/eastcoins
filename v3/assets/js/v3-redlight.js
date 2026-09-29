/* ============================================================
   EastCoin — Red Light, Green Light (the page side)

   window.ECRedLight.mount(root, api) draws the whole game into `root`.
   `api` is three calls — state(), join(), move(runMs) — so the same
   client runs against the real endpoints (/api/casino/pvp/*) and
   against the practice engine on /redlight-test, where no ZCoin moves.

   The page decides nothing. You hold the button to choose how long
   you sprint; that number goes to the server BEFORE anyone is told
   when the referee turns; then every screen plays the light back from
   what the server says happened. Closing the tab changes nothing
   about who is paid.

   Polling: every 2s in a lobby, every 5s when idle, and during a race
   only when a light closes (once, then a retry or two) — a race is a
   dozen requests per player, not a stream of them.
   ============================================================ */
(() => {
  "use strict";
  const LANES = ["#e8bf35", "#ff6b85", "#4ddb8b", "#6ab7ff", "#c58bff", "#ff9d4d"];
  const W = 960, H = 520, X0 = 170, X1 = 850, TOP = 104, LANE_H = 54;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const CSS = `
.rl{--gold:#e8bf35;color:#f4ede5;font-family:"Figtree","Segoe UI",system-ui,sans-serif}
.rl-wrap{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;align-items:start}
@media (max-width:900px){.rl-wrap{grid-template-columns:minmax(0,1fr)}}
.rl-stage{position:relative;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#0d1a10;box-shadow:0 24px 60px rgba(0,0,0,.5);user-select:none;-webkit-user-select:none;touch-action:manipulation}
.rl-stage canvas{display:block;width:100%;height:auto;aspect-ratio:960/520}
.rl-ctrl{padding:12px;background:#0b1a10;border-top:1px solid rgba(255,255,255,.08)}
.rl-hold{display:block;width:100%;padding:16px 22px;border-radius:14px;border:2px solid #0a0a0a;background:linear-gradient(#4ddb8b,#27a862);color:#06210f;font:800 1.15rem "Bricolage Grotesque","Figtree",sans-serif;cursor:pointer;box-shadow:0 6px 0 #0c4a27,0 14px 30px rgba(0,0,0,.45)}
.rl-hold.down{transform:translateY(4px);box-shadow:0 2px 0 #0c4a27}
.rl-hold:disabled,.rl-hold.locked{background:linear-gradient(#3a3a3a,#262626);color:#d8d0c6;box-shadow:0 6px 0 #111;cursor:default}
.rl-hold small{display:block;font:700 .78rem "Figtree",sans-serif;opacity:.8;margin-top:2px}
.rl-side{display:grid;gap:12px}
.rl-card{background:#161311;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 16px}
.rl-card h3{font:800 1rem "Bricolage Grotesque","Figtree",sans-serif;margin:0 0 8px}
.rl-pot{font:800 2rem "Bricolage Grotesque","Figtree",sans-serif;color:var(--gold);line-height:1}.rl-pot small{display:block;font:700 .78rem "Figtree",sans-serif;color:#aca298;margin-top:4px}
.rl-join{width:100%;margin-top:10px;padding:12px;border-radius:10px;border:0;background:var(--gold);color:#2a1300;font-weight:800;font-size:1rem;cursor:pointer}
.rl-join:disabled{background:#2a2622;color:#8a8178;cursor:default}
.rl-note{color:#aca298;font-size:.86rem;line-height:1.45;margin:8px 0 0}
.rl-seat{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.08);font-size:.92rem}.rl-seat:first-child{border-top:0}
.rl-dot{width:10px;height:10px;border-radius:50%;flex:none}.rl-seat b{font-weight:700}.rl-seat span:last-child{margin-left:auto;color:#aca298;font-variant-numeric:tabular-nums}
.rl-seat.out b{text-decoration:line-through;color:#8a8178}.rl-seat.won span:last-child{color:var(--gold);font-weight:800}
.rl-how{margin:0;padding-left:18px;color:#aca298;font-size:.88rem;line-height:1.55}.rl-how b{color:#f4ede5}
.rl-fair{font:600 .72rem ui-monospace,Consolas,monospace;color:#7d746a;word-break:break-all;margin:8px 0 0}`;
  let styled = false;

  function mount(root, api, opts = {}) {
    if (!styled) { styled = true; document.head.append(Object.assign(el("style"), { textContent: CSS })); }
    root.replaceChildren(); root.classList.add("rl");
    const wrap = el("div", "rl-wrap"), stage = el("div", "rl-stage"), cv = el("canvas"), hold = el("button", "rl-hold"), side = el("div", "rl-side");
    cv.width = W; cv.height = H; hold.type = "button"; hold.disabled = true; const ctrl = el("div", "rl-ctrl"); ctrl.append(hold); stage.append(cv, ctrl);
    const potCard = el("div", "rl-card"), pot = el("div", "rl-pot"), joinBtn = el("button", "rl-join"), note = el("p", "rl-note"); joinBtn.type = "button";
    potCard.append(el("h3", null, "The pot"), pot, joinBtn, note);
    const seatCard = el("div", "rl-card"), seats = el("div"); seatCard.append(el("h3", null, "Runners"), seats);
    const howCard = el("div", "rl-card"), how = el("ul", "rl-how"), fair = el("p", "rl-fair");
    how.innerHTML = `<li>Every light, <b>hold the button</b> for as long as you dare sprint, then let go.</li><li>The ref turns at a moment nobody knows, <b>0.8 to 4 seconds</b> in. Still sprinting when he does? You're out.</li><li>A dash under 0.8s is always safe. It's also slow.</li><li><b>First across the goal line</b> takes the pot. Last runner left wins on the spot. After 10 lights, furthest wins.</li>`;
    howCard.append(el("h3", null, "How it works"), how, fair);
    side.append(potCard, seatCard, howCard); wrap.append(stage, side); root.append(wrap);
    const c = cv.getContext("2d");

    let S = null, offset = 0, dead = false, pollT = 0, raf = 0, joining = false;
    let charge = null;              // { t0 } while the button is held
    let sent = { id: null, k: -1, run: null };   // what I locked in for which light
    let finalRound = null, lastShown = null, banner = null, heardTurn = -1, avatars = new Map();
    const now = () => Date.now() + offset;
    const R = () => S?.config?.rules;
    const lightLen = () => R().chooseMs + R().graceMs + R().showMs;
    const opensAt = (k) => S.race_startsAt + R().introMs + k * lightLen();
    const closesAt = (k) => opensAt(k) + R().chooseMs + R().graceMs;

    /* ---------- talking to the server ---------- */
    async function poll() {
      clearTimeout(pollT); if (dead) return;
      try {
        const t0 = Date.now(), body = await api.state(); if (dead) return;
        if (body?.ok) { offset = body.now - (t0 + Date.now()) / 2; S = body; S.race_startsAt = body.race ? body.lobby.startsAt : null; onState(); }
      } catch (e) { /* the next poll tries again */ }
      pollT = setTimeout(poll, nextPollIn());
    }
    function nextPollIn() {
      if (document.hidden) return 8000;
      if (S?.race) {
        const k = S.race.closed, due = closesAt(k) + 150 - now();        // the next light to close is the next news
        return Math.max(700, Math.min(due, 12000));
      }
      return S?.lobby ? 2000 : 5000;
    }
    function onState() {
      const race = S.race, last = S.last;
      if (last && last.status === "SETTLED" && last.id !== lastShown && last.settledAt && now() - last.settledAt < 30000 && last.result) {
        lastShown = last.id;
        const w = last.players[last.result.winner];
        const after = Date.now() + (calm ? 0 : Math.max(0, closesAt0(last) + R().showMs - 600 - now()));
        banner = { until: after + 6500, after, text: `${w?.login === S.me?.login ? "You take" : `${w?.displayName} takes`} the pot`, pot: last.pot, mine: w?.login === S.me?.login };
        finalRound = last;
      }
      paintSide();
    }
    const closesAt0 = (round) => round.startsAt + R().introMs + (round.result.lights.length - 1) * lightLen() + R().chooseMs + R().graceMs;

    async function join() {
      if (joining) return; joining = true; paintSide();
      try { const r = await api.join(); if (!r?.ok) note.textContent = r?.message || "Couldn't sit you down."; } catch (e) { note.textContent = "Couldn't reach the table."; }
      joining = false; poll();
    }
    joinBtn.addEventListener("click", join);

    /* ---------- the button: hold to choose your sprint ---------- */
    const myLight = () => (S?.race && S.race.mySeat >= 0 && S.race.alive[S.race.mySeat] && S.race.winner === null ? currentLight() : -1);
    function currentLight() { if (!S?.race) return -1; for (let k = 0; k < R().maxLights; k++) { const t = now(); if (t >= opensAt(k) && t < opensAt(k) + R().chooseMs) return k; } return -1; }
    const lockedFor = (k) => (sent.id === S?.lobby?.id && sent.k === k ? sent.run : S?.race?.myRun != null && S.race.light === k ? S.race.myRun : null);
    function press() { const k = myLight(); if (k < 0 || charge || lockedFor(k) != null) return; charge = { t0: performance.now(), k }; hold.classList.add("down"); tone(220, 440, 0.12, 0.05); }
    const chargeMs = () => (charge ? Math.max(0, Math.min(R().maxRunMs, performance.now() - charge.t0)) : 0);
    function release() {
      if (!charge) return; const run = Math.round(chargeMs()), k = charge.k; charge = null; hold.classList.remove("down");
      sent = { id: S.lobby.id, k, run }; tone(660, 330, 0.1, 0.06);
      api.move(run).then((r) => { if (r?.ok && r.run != null) sent.run = r.run; }).catch(() => {});
    }
    hold.addEventListener("pointerdown", (e) => { e.preventDefault(); try { hold.setPointerCapture(e.pointerId); } catch (err) { /* no capture: pointerup on the button still lands */ } press(); });
    hold.addEventListener("pointerup", release); hold.addEventListener("pointercancel", release);
    hold.addEventListener("contextmenu", (e) => e.preventDefault());
    const keyDown = (e) => { if (e.code === "Space" && !e.repeat && !/input|textarea/i.test(e.target.tagName) && myLight() >= 0) { e.preventDefault(); press(); } };
    const keyUp = (e) => { if (e.code === "Space" && charge) { e.preventDefault(); release(); } };
    addEventListener("keydown", keyDown); addEventListener("keyup", keyUp);

    /* ---------- the side panel ---------- */
    function paintSide() {
      if (!S) return; const cfg = S.config, lobby = S.lobby, race = S.race, round = race ? lobby : (banner && Date.now() < banner.until ? finalRound : null) || lobby;
      pot.replaceChildren(document.createTextNode(`${(round ? round.pot : cfg.stake).toLocaleString()} ${opts.unit || "ZC"}`), el("small", null, round ? `${round.players.length} in at ${cfg.stake} each · winner takes it all` : `${cfg.stake} each · up to ${cfg.maxPlayers} runners · winner takes it all`));
      const full = lobby && lobby.players.length >= cfg.maxPlayers;
      joinBtn.disabled = true;
      if (race) { joinBtn.textContent = "Race on"; note.textContent = "The next lobby opens the moment this one's decided."; }
      else if (cfg.paused) { joinBtn.textContent = "Closed for now"; note.textContent = `This table is closed while it's being worked on.${cfg.practice ? " Try it on the practice page: no ZCoins change hands there." : ""}`; }
      else if (!S.me) { joinBtn.textContent = "Log in to play"; note.textContent = "Log in with Twitch and your ZCoins come with you."; }
      else if (!cfg.canBet) { joinBtn.textContent = "Casino paused"; note.textContent = "ZCoin transfers aren't switched on right now."; }
      else if (lobby?.youIn) { joinBtn.textContent = "You're in"; note.textContent = lobby.players.length < cfg.minPlayers ? "Waiting for one more. If nobody comes, your buy-in comes straight back." : "Get a finger on the button."; }
      else if (full) { joinBtn.textContent = "Field's full"; note.textContent = `${cfg.maxPlayers} lanes, ${cfg.maxPlayers} runners.`; }
      else { joinBtn.disabled = joining; joinBtn.textContent = joining ? "Sitting you down…" : lobby ? `Join for ${cfg.stake}` : `Start a race for ${cfg.stake}`; note.textContent = lobby ? "The clock's running." : `You open the lobby. The clock starts at ${cfg.lobbySeconds} seconds.`; }
      seats.replaceChildren();
      const list = round?.players || [];
      if (!list.length) seats.append(el("p", "rl-note", "Nobody yet."));
      list.forEach((p, s) => {
        const out = race ? !race.alive[s] : round?.result ? round.result.alive[s] === false : false, won = round?.result?.winner === s;
        const row = el("div", `rl-seat${out ? " out" : ""}${won ? " won" : ""}`), dot = el("span", "rl-dot"); dot.style.background = LANES[s];
        const yd = race ? race.pos[s] : round?.result ? round.result.pos[s] : 0;
        row.append(dot, el("b", null, p.login === S.me?.login ? "You" : p.displayName), el("span", null, won ? `+${round.pot - cfg.stake}` : out ? "out" : race || round?.result ? `${Math.round(yd)} yd` : race ? "" : "in"));
        seats.append(row);
      });
      const f = finalRound && banner && Date.now() < banner.until ? finalRound : null;
      fair.textContent = f?.seed ? `seed ${f.seed}` : (lobby || S.last)?.hash ? `sealed: ${(lobby || S.last).hash.slice(0, 24)}…  (the seed behind it is shown after the race)` : "";
    }

    /* ---------- sound ---------- */
    let AC = null;
    function tone(f0, f1, dur, vol = 0.1, type = "triangle") {
      try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur); } catch (e) {}
    }
    const whistle = () => { tone(2300, 2100, 0.5, 0.12, "square"); setTimeout(() => tone(2300, 1900, 0.35, 0.1, "square"), 120); };

    /* ---------- drawing ---------- */
    const xOf = (yd) => X0 + (X1 - X0) * Math.min(1, yd / R().field), laneY = (s) => TOP + LANE_H * s + LANE_H / 2;
    function field(red) {
      c.fillStyle = "#0b1a10"; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? "#1d5a2c" : "#1a5228"; c.fillRect(X0 + (X1 - X0) * i / 10, TOP, (X1 - X0) / 10 + 1, LANE_H * 6); }
      c.fillStyle = "#16301c"; c.fillRect(X0 - 150, TOP, 150, LANE_H * 6); c.fillStyle = "#7a1f2a"; c.fillRect(X1, TOP, W - X1, LANE_H * 6);
      c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 2; c.font = "800 13px Figtree, sans-serif"; c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,.6)";
      for (let i = 0; i <= 10; i++) { const x = X0 + (X1 - X0) * i / 10; c.beginPath(); c.moveTo(x, TOP); c.lineTo(x, TOP + LANE_H * 6); c.stroke(); if (i && i < 10) c.fillText(String(i <= 5 ? i * 10 : (10 - i) * 10), x, TOP + LANE_H * 6 + 18); }
      c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 1; for (let s = 1; s < 6; s++) { c.beginPath(); c.moveTo(X0 - 150, TOP + LANE_H * s); c.lineTo(X1, TOP + LANE_H * s); c.stroke(); }
      c.save(); c.translate(X1 + 20, TOP + LANE_H * 3); c.rotate(Math.PI / 2); c.fillStyle = "rgba(255,255,255,.75)"; c.font = "800 16px 'Bricolage Grotesque', sans-serif"; c.fillText("GOAL LINE", 0, 6); c.restore();
      // the light
      c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.roundRect(W / 2 - 300, 10, 600, 82, 14); c.fill();
      for (const [dx, on, col] of [[-256, red === true, "#ff4a5e"], [256, red === false, "#3ce37f"]]) { c.beginPath(); c.arc(W / 2 + dx, 51, 26, 0, 7); c.fillStyle = on ? col : "#23201d"; c.fill(); if (on) { c.shadowColor = col; c.shadowBlur = 30; c.fill(); c.shadowBlur = 0; } }
    }
    function ref(facing, flap) {   // the referee, past the goal line: back turned on green, facing the field on red
      const x = X1 + 78, y = TOP + LANE_H * 3 + 10; c.save(); c.translate(x, y);
      for (let i = -3; i < 3; i++) { c.fillStyle = i % 2 ? "#f4f4f4" : "#111"; c.fillRect(i * 7, -26, 7, 52); }
      c.fillStyle = "#e8b890"; c.beginPath(); c.arc(0, -42, 15, 0, 7); c.fill(); c.fillStyle = "#111"; c.fillRect(-16, -58, 32, 9); c.fillRect(-10, -64, 20, 8);
      if (facing) { c.fillStyle = "#111"; c.fillRect(-8, -46, 4, 4); c.fillRect(4, -46, 4, 4); c.fillStyle = "#c8ccd4"; c.fillRect(-4, -36, 10, 5); c.fillStyle = "#ffd84a"; c.save(); c.translate(-26, -10 - flap * 10); c.rotate(-0.5); c.fillRect(0, 0, 16, 12); c.restore(); }
      else { c.fillStyle = "#2a2018"; c.beginPath(); c.arc(0, -42, 15, Math.PI * 0.95, Math.PI * 2.05); c.fill(); }
      c.fillStyle = "#111"; c.fillRect(-14, 26, 11, 30); c.fillRect(3, 26, 11, 30); c.restore();
    }
    function runner(s, p, yd, mode, t) {   // mode: idle | run | out | home
      const x = xOf(yd) - (mode === "home" ? -18 : 0), y = laneY(s), col = LANES[s], bob = mode === "run" && !calm ? Math.sin(t / 55 + s) * 3 : 0;
      c.save(); c.translate(x, y + bob);
      if (mode === "out") { c.rotate(Math.PI / 2.2); c.globalAlpha = 0.75; }
      const sw = mode === "run" ? Math.sin(t / 60 + s) * 9 : 0;
      c.strokeStyle = "#f0f0f0"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(-2, 8); c.lineTo(-2 - sw, 22); c.moveTo(2, 8); c.lineTo(2 + sw, 22); c.stroke();
      c.fillStyle = col; c.beginPath(); c.roundRect(-10, -12, 20, 22, 6); c.fill(); c.fillStyle = "#0a0a0a"; c.font = "800 12px Figtree, sans-serif"; c.textAlign = "center"; c.fillText(String(s + 1), 0, 4);
      c.fillStyle = col; c.beginPath(); c.arc(3, -20, 10, 0, 7); c.fill(); c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(5, -22, 9, 5);
      c.restore(); c.globalAlpha = 1;
      if (mode === "out") { c.fillStyle = "#ffd84a"; c.save(); c.translate(x + 16, y - 18); c.rotate(0.4); c.fillRect(0, 0, 13, 10); c.restore(); }
      const me = p.login === S.me?.login; c.font = `${me ? 800 : 700} 12px Figtree, sans-serif`; c.textAlign = "right"; c.fillStyle = me ? "#fff" : "rgba(255,255,255,.72)";
      c.fillText(me ? "YOU" : p.displayName.length > 13 ? `${p.displayName.slice(0, 12)}…` : p.displayName, X0 - 28, y + 4);
    }
    const center = (text, y, size = 30, col = "#fff") => { c.textAlign = "center"; c.font = `800 ${size}px "Bricolage Grotesque", Figtree, sans-serif`; c.lineWidth = 6; c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText(text, W / 2, y); c.fillStyle = col; c.fillText(text, W / 2, y); };

    function frame() {
      raf = requestAnimationFrame(frame); if (!S) { field(null); center("Connecting…", H / 2); return; }
      const t = now(), race = S.race, showing = !race && banner && Date.now() < banner.until ? finalRound : null, round = race ? S.lobby : showing || S.lobby, rules = R();
      let red = null, msg = "", sub = "", holdMode = "hide";
      const players = round?.players || [], n = players.length;
      let pos = new Array(n).fill(0), mode = new Array(n).fill("idle"), facing = false, flap = 0;
      const lights = race ? race.lights : showing ? showing.result.lights : [];
      if (race || showing) {
        const startsAt = race ? S.race_startsAt : showing.startsAt, len = lightLen();
        // which light's playback are we inside, if any?
        let k = Math.floor((t - startsAt - rules.introMs) / len), into = t - (startsAt + rules.introMs + k * len);
        const have = (i) => lights[i];
        const settle = (upto) => { for (let i = 0; i <= upto && i < lights.length; i++) { pos = lights[i].pos.slice(); lights[i].out.forEach((s) => { mode[s] = "out"; }); lights[i].finished.forEach((s) => { mode[s] = "home"; }); } };
        if (k < 0) { red = true; facing = true; msg = `First light in ${Math.ceil((startsAt + rules.introMs - t) / 1000)}`; sub = "Hold the button to sprint. Let go before he turns."; }
        else if (showing && k >= lights.length) { settle(lights.length - 1); red = true; facing = true; }
        else if (into < rules.chooseMs) {               // picking
          settle(k - 1); red = false; const left = Math.ceil((rules.chooseMs - into) / 1000), mine = race ? race.mySeat : -1, alive = mine >= 0 && race.alive[mine] && race.winner === null;
          msg = `Light ${k + 1} · pick your sprint · ${left}`; holdMode = alive ? "pick" : "hide"; if (!alive && mine >= 0) sub = "You're out. Watch the rest.";
          if (charge && (into >= rules.chooseMs - 60 || chargeMs() >= rules.maxRunMs)) release();   // the window shut, or the meter is full: that's your sprint
          if (race) race.locked.forEach((l, s) => { if (l && race.alive[s]) mode[s] = "set"; });
        } else if (into < rules.chooseMs + rules.graceMs) { settle(k - 1); red = false; msg = "Sprints are in…"; if (charge) release(); }
        else {                                          // the light plays out
          const L = have(k); settle(k - 1);
          if (!L) { red = false; msg = "…"; }
          else {
            const tt = calm ? 99999 : into - rules.chooseMs - rules.graceMs, before = k ? lights[k - 1].pos : new Array(n).fill(0);
            red = tt >= L.turnMs; facing = red; flap = red ? Math.max(0, 1 - (tt - L.turnMs) / 400) : 0;
            if (red && heardTurn !== `${round.id}:${k}` && tt < L.turnMs + 600) { heardTurn = `${round.id}:${k}`; whistle(); }
            L.runs.forEach((run, s) => {
              if (run == null) return; const outNow = L.out.includes(s), home = L.finished.includes(s);
              const stopAt = home ? ((rules.field - before[s]) / rules.speed) * 1000 : outNow ? L.turnMs : run, ran = Math.min(tt, stopAt);
              pos[s] = Math.min(rules.field, before[s] + (ran / 1000) * rules.speed);
              mode[s] = tt < stopAt ? "run" : home ? "home" : outNow ? "out" : "idle";
            });
            msg = red ? (L.out.length ? `RED LIGHT · ${L.out.length} caught` : "RED LIGHT · nobody caught") : `Light ${k + 1} · GO`;
            sub = red ? `He turned at ${(L.turnMs / 1000).toFixed(2)}s` : "";
          }
        }
      } else if (S.lobby && !showing) { red = true; facing = true; const left = Math.max(0, Math.ceil((S.lobby.startsAt - t) / 1000)); msg = n < S.config.minPlayers ? `Waiting for runners · ${left}` : `Race starts in ${left}`; sub = `${n} of ${S.config.maxPlayers} lanes taken`; }
      else { red = true; facing = true; msg = S.config.paused ? "Closed for now" : "No race on"; sub = S.config.paused ? "" : "Start one: the lobby clock begins when you sit down."; }

      field(red); ref(facing, flap);
      players.forEach((p, s) => {
        runner(s, p, pos[s], mode[s] === "set" ? "idle" : mode[s], performance.now());
        if (mode[s] === "set") { c.fillStyle = "rgba(255,255,255,.85)"; c.font = "800 11px Figtree, sans-serif"; c.textAlign = "left"; c.fillText("LOCKED IN", xOf(pos[s]) + 18, laneY(s) + 4); }
      });
      // my sprint, while I'm choosing it: how far it takes me, and how often he has turned by then
      const kNow = holdMode === "pick" ? currentLight() : -1, mine = race ? race.mySeat : -1, lockedRun = kNow >= 0 ? lockedFor(kNow) : null;
      if (kNow >= 0 && mine >= 0) {
        const ms = charge ? chargeMs() : lockedRun ?? 0, yd = (ms / 1000) * rules.speed, risk = Math.max(0, Math.min(1, (ms - rules.minTurnMs) / (rules.maxRunMs - rules.minTurnMs)));
        if (ms > 0) {
          const x0 = xOf(pos[mine]), x1 = xOf(pos[mine] + yd), y = laneY(mine);
          c.strokeStyle = LANES[mine]; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(x0 + 12, y + 26); c.lineTo(x1, y + 26); c.stroke(); c.setLineDash([]);
          c.fillStyle = LANES[mine]; c.beginPath(); c.moveTo(x1, y + 18); c.lineTo(x1 + 9, y + 26); c.lineTo(x1, y + 34); c.fill();
        }
        // the meter
        const mx = X0, my = H - 34, mw = X1 - X0;         const safe = rules.minTurnMs / rules.maxRunMs; c.fillStyle = "#1f6a3a"; c.fillRect(mx, my, mw * safe, 14); const g = c.createLinearGradient(mx + mw * safe, 0, mx + mw, 0); g.addColorStop(0, "#c8b03a"); g.addColorStop(1, "#c8262e"); c.fillStyle = g; c.fillRect(mx + mw * safe, my, mw * (1 - safe), 14);
        c.fillStyle = "#fff"; c.fillRect(mx + mw * (ms / rules.maxRunMs) - 2, my - 5, 4, 24);
        c.font = "800 13px Figtree, sans-serif"; c.textAlign = "left"; c.fillStyle = "#fff"; c.fillText(`${(ms / 1000).toFixed(2)}s · ${yd.toFixed(1)} yd`, mx, my - 10);
        c.textAlign = "right"; c.fillStyle = risk > 0.6 ? "#ff8a96" : risk > 0 ? "#ffe08a" : "#8ff0b4"; c.fillText(ms <= rules.minTurnMs ? "always safe" : `he's turned by now ${Math.round(risk * 100)}% of the time`, mx + mw, my - 10);
      }
      c.textAlign = "center"; c.font = "800 20px 'Bricolage Grotesque', Figtree, sans-serif"; c.fillStyle = red === false ? "#8ff0b4" : red ? "#ff9aa6" : "#fff"; c.fillText(msg, W / 2, 48);
      if (sub) { c.font = "700 13px Figtree, sans-serif"; c.fillStyle = "rgba(255,255,255,.8)"; c.fillText(sub, W / 2, 72); }
      if (banner && Date.now() > banner.after && Date.now() < banner.until) { c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(0, H / 2 - 70, W, 140); center(banner.text, H / 2 - 6, 40, banner.mine ? "#e8bf35" : "#fff"); center(`${banner.pot} ${opts.unit || "ZC"}`, H / 2 + 42, 30, "#e8bf35"); }
      // the button
      if (holdMode === "pick") {
        const locked = lockedRun != null; hold.disabled = false;
        hold.classList.toggle("locked", locked);
        const html = locked ? `Locked in: ${(lockedRun / 1000).toFixed(2)}s<small>${lockedRun ? "Now watch." : "Standing still this light."}</small>` : charge ? `Let go to lock it in<small>…or keep holding</small>` : `HOLD to sprint<small>or Space · not pressing means you stand still</small>`; if (hold.dataset.h !== html) { hold.dataset.h = html; hold.dataset.t = ""; hold.innerHTML = html; }
      } else {
        if (charge) release(); hold.disabled = true; hold.classList.remove("locked");
        const inIt = race && race.mySeat >= 0, alive = inIt && race.alive[race.mySeat];
        const text = race ? (inIt ? (alive ? "Watch the light" : "You're out") : "Race on: watching") : S.lobby?.youIn ? "You're in: wait for the first light" : "Join a race to run";
        if (hold.dataset.t !== text) { hold.dataset.t = text; hold.dataset.h = ""; hold.textContent = text; }
      }
      if (banner && Date.now() > banner.until) { banner = null; paintSide(); }
    }

    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    poll(); raf = requestAnimationFrame(frame);
    const sideT = setInterval(paintSide, 1000);
    return () => { dead = true; clearTimeout(pollT); clearInterval(sideT); cancelAnimationFrame(raf); removeEventListener("keydown", keyDown); removeEventListener("keyup", keyUp); document.removeEventListener("visibilitychange", onVis); root.replaceChildren(); };
  }

  // the real table: the same three calls, against the casino's PvP endpoints
  const liveApi = {
    state: () => fetch("/api/casino/pvp/state?game=redlight", { credentials: "same-origin" }).then((r) => r.json()),
    join: () => fetch("/api/casino/pvp/join", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ game: "redlight" }) }).then((r) => r.json()),
    move: (run) => fetch("/api/casino/pvp/move", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ game: "redlight", run }) }).then((r) => r.json())
  };
  window.ECRedLight = { mount, liveApi };
})();

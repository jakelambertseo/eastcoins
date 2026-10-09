/* Blockshot online (2026-10-08): the page's half of the match server (arcade-worker/src/blockshot.js).

   The server owns the match; this file keeps the page honest and smooth. Every tick (60 Hz, fixed) the page makes an input, numbers
   it, sends it (batched, 30 Hz) and PREDICTS its own bean with the same rules, so moving feels instant. Each snapshot (20 Hz) carries
   the last input the server applied: the page puts its bean where the server says and replays the inputs after that one, so the two
   agree to the millimetre unless something interfered (a shove, a death), and then the server wins. Everyone else is drawn 100 ms in
   the past, interpolated between the two snapshots around that moment, which is why they move smoothly at 20 Hz. The server time the
   page is rendering goes up with every input (`rt`), so a shot is judged against the positions the shooter actually saw.

   Shots are never predicted: the page draws its own tracer and plays the bang at once, and the server's events decide the rest.
   createNet(hooks) -> { connect(opts), close(), on, slot, tick(dt), events(): [...] , roster, round, ping } */
import { World, newBean, stepBean, cast, V, PHYS, GUNS, GUN_KEYS } from "/v3/assets/js/blockshot-rules.js?v=4";

const DEV = ["localhost", "127.0.0.1"].includes(location.hostname);
const INTERP = 0.1, SEND_EVERY = 2;

export function createNet(hooks) {
  const N = { on: false, slot: -1, you: null, roster: null, round: null, ping: 0, serverNow: 0, map: null, why: "" };
  let ws = null, seq = 0, pending = [], toSend = [], sendN = 0, snaps = [], ack = 0, clockOff = 0, pingT = 0, lastInp = null;
  const now = () => performance.now() / 1000;

  N.connect = async ({ gun, name }) => {
    let url;
    if (DEV) { const as = new URLSearchParams(location.search).get("as") || name || "you"; url = `ws://${location.hostname}:8788/bs?dev=1&login=${encodeURIComponent(as)}&gun=${gun}`; }
    else {
      try {
        const r = await fetch("/api/arcade/ticket", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
        const j = await r.json().catch(() => ({}));
        if (j.ok) { N.you = { name: j.name, guest: false }; url = `${j.ws.replace(/\/ws$/, "/bs")}?ticket=${j.ticket}&gun=${gun}`; }
        else url = `wss://arcade.eastcoin.vip/bs?guest=${encodeURIComponent(name || "Guest")}&gun=${gun}`;
      } catch { url = `wss://arcade.eastcoin.vip/bs?guest=${encodeURIComponent(name || "Guest")}&gun=${gun}`; }
    }
    return new Promise((resolve) => {
      let settled = false; const done = (v, why) => { if (!settled) { settled = true; N.why = why || ""; resolve(v); } };
      try { ws = new WebSocket(url); } catch { return done(false, "down"); }
      const timer = setTimeout(() => { if (!N.on) { try { ws.close(); } catch {} done(false, "timeout"); } }, DEV ? 2500 : 6000);
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); if (m.t === "hello") { clearTimeout(timer); done(true); } };
      ws.onclose = () => { const was = N.on; N.on = false; ws = null; if (was) hooks.onDrop?.(N.why || "closed"); done(false, "down"); };
      ws.onerror = () => { done(false, "down"); };
    });
  };
  N.close = () => { N.on = false; if (ws) { try { ws.close(); } catch {} ws = null; } snaps = []; pending = []; toSend = []; };
  const send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  N.setGun = (k) => send({ t: "gun", k });

  function onMsg(m) {
    switch (m.t) {
      case "hello": N.on = true; N.slot = m.slot; N.you = m.you; N.roster = m.roster; N.round = m.round; N.map = m.map; clockOff = m.now - now(); hooks.onHello?.(m); return;
      case "roster": N.roster = m; hooks.onRoster?.(m); return;
      case "round": N.map = m.map; N.round = { no: m.no, t: 0, state: "play" }; N.roster = m.roster; snaps = []; pending = []; hooks.onRound?.(m); return;
      case "s": { const s = { ...m, at: now() }; snaps.push(s); if (snaps.length > 6) snaps.shift(); clockOff = clockOff * 0.9 + (m.now - now()) * 0.1; ack = m.ack; N.round = { ...(N.round || {}), t: m.rt, state: m.st }; applySelf(s); return; }
      case "ev": hooks.onEvents?.(m.e); return;
      case "end": hooks.onEnd?.(m); return;
      case "pong": N.ping = Math.round((now() - m.t0) * 1000); return;
      case "err": N.why = m.text; hooks.onError?.(m.text); return;
    }
  }
  N.serverTime = () => now() + clockOff;

  /* my bean: the server's state, then my inputs it hasn't seen yet, replayed */
  function applySelf(s) {
    const { me, world, beans } = hooks.state(); if (!me || N.slot < 0) return;
    const b = s.b[N.slot]; if (!b) return;
    unpack(me, b);
    pending = pending.filter((i) => i.seq > s.ack);
    for (const i of pending) stepBean(world, beans, me, { ...i, fire: false, fireTap: false }, PHYS.STEP60, s.now, Math.random, null);
  }
  function unpack(bean, b) {
    bean.p.set(b[0], b[1], b[2]); bean.v.set(b[3], b[4], b[5]); bean.facing = b[6]; bean.hp = b[7]; bean.dead = Boolean(b[8]); bean.gun = GUN_KEYS[b[9]] || "ar"; bean.ammo = b[10]; bean.slide = Boolean(b[11]); bean.grounded = Boolean(b[12]);
    bean.kills = b[13]; bean.deaths = b[14]; bean.streak = b[15]; bean.reloading = b[16] ? 1 : 0;
  }

  /** One fixed tick: make this tick's input, predict with it, queue it for the server. Returns the input. */
  N.tick = (inp, t) => {
    const { me, world, beans } = hooks.state();
    if (!N.on || N.slot < 0) return;
    seq++; const rt = N.serverTime() - INTERP; const i = { ...inp, seq, rt };
    pending.push(i); if (pending.length > 120) pending.shift();
    toSend.push([seq, +i.x.toFixed(3), +i.z.toFixed(3), i.jump ? 1 : 0, i.fire ? 1 : 0, i.fireTap ? 1 : 0, i.slide ? 1 : 0, i.reload ? 1 : 0, +i.aim.x.toFixed(4), +i.aim.y.toFixed(4), +i.aim.z.toFixed(4), i.scope ? 1 : 0, +rt.toFixed(3)]);
    if (++sendN % SEND_EVERY === 0) { send({ t: "in", s: seq, i: toSend }); toSend = []; }
    if (!me.dead) stepBean(world, beans, me, { ...i, fire: false, fireTap: false }, PHYS.STEP60, t, Math.random, null);   // prediction: movement only
    pingT += PHYS.STEP60; if (pingT > 2) { pingT = 0; send({ t: "ping", t0: now() }); }
    // everyone else: 100 ms in the past, between the two snapshots around that moment
    const rt2 = N.serverTime() - INTERP; let a = null, c = null;
    for (let k = snaps.length - 1; k >= 0; k--) { if (snaps[k].now <= rt2) { a = snaps[k]; c = snaps[k + 1] || null; break; } }
    if (!a) a = snaps[0]; if (!a) return;
    const u = c ? Math.max(0, Math.min(1, (rt2 - a.now) / (c.now - a.now || 1))) : 0;
    const latest = snaps[snaps.length - 1];
    beans.forEach((bean, k) => {
      if (k === N.slot) return; const p = a.b[k], q = c ? c.b[k] : null, l = latest.b[k]; if (!p || !l) return;
      const was = bean.dead;
      if (q && !l[8]) { bean.p.set(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u); let df = q[6] - p[6]; df = Math.atan2(Math.sin(df), Math.cos(df)); bean.facing = p[6] + df * u; }
      else bean.p.set(l[0], l[1], l[2]), (bean.facing = l[6]);
      bean.v.set(l[3], l[4], l[5]); bean.hp = l[7]; bean.dead = Boolean(l[8]); bean.gun = GUN_KEYS[l[9]] || "ar"; bean.slide = Boolean(l[11]); bean.grounded = Boolean(l[12]); bean.kills = l[13]; bean.deaths = l[14]; bean.streak = l[15];
      if (was !== bean.dead) hooks.onVisible?.(bean, !bean.dead);
    });
  };
  return N;
}

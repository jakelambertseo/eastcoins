/* THE YARD RAID, UNDER LOAD —  node tools/eastscape-raid-stress.mjs [players=8] [minutes=8]
   (2026-09-30, after the live server went down "a few minutes after" a raid started, "before mid fight", with about 8 players.)
   The real World and the WHOLE game loop (tickTimed: every map, every monster, the events, tracking), on a clock this script owns,
   with N players of mixed levels on the west bank who keep clicking the nearest raider, get hit, die and come back, the way a crowd
   fights it. Nothing is reset between hits. Any error thrown out of the loop is caught here and printed with its stack: on the live
   server that same error ends the Durable Object. Exits 1 if the loop ever throws. */
globalThis.__ES_OPEN_ALL = true;
const N = Number(process.argv[2]) || 8, MINUTES = Number(process.argv[3]) || 8, WYRM_N = Number(process.argv[4]) || 0;   /* WYRM_N: that many more players in the Frozen Reach, fighting the Ice Wyrm at the same time */
const realNow = Date.now.bind(Date); let clock = realNow(); Date.now = () => clock;   /* the World reads Date.now everywhere: it reads ours */
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => (Array.isArray(k) ? new Map() : store.get(k)), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) store.set(a, b); else store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 30)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
clearInterval(W.timer); W.timer = 1;   /* this script drives the loop, not a timer */
const S = W.scene("workyard"), R = G.RAID;
const heardWs = new Map(); function hear(d) { try { const o = JSON.parse(d); for (const x of Array.isArray(o) ? o : o.batch || [o]) { const t = x?.text || x?.message; if (t) heardWs.set(String(t).slice(0, 90), (heardWs.get(String(t).slice(0, 90)) || 0) + 1); } } catch (e) { /* binary or odd */ } }
const LV = [8, 15, 25, 35, 50, 65, 80, 95, 20, 45, 70, 12];
const WEAP = { 8: "bronze_sword", 15: "iron_sword", 25: "emerald_sword", 35: "diamond_sword", 50: "dragonstone_sword", 65: "onyx_sword", 80: "starfall_sword", 95: "singularity_sword" };
const pls = [];
for (let i = 0; i < N; i++) {
  const lvl = LV[i % LV.length], C = G.freshChar(); C.scene = S.key;
  for (const k of ["hp", "melee", "defence", "archery", "magic"]) C.xp[k] = G.XP_AT[lvl];
  C.hp = G.maxHpOf(C); C.eq.weapon = G.ITEMS[WEAP[lvl]] ? WEAP[lvl] : "bronze_sword"; C.inv = [{ k: "tickets", n: 50000 }];
  const id = `s${i}`, x = 6 + (i % 6) * 2, y = 6 + Math.floor(i / 6) * 3;
  const pl = { id, login: id, name: `Raider${i}`, role: i === 0 ? "admin" : "user", ws: { send: (d) => hear(d), close() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: clock, joinedAt: clock, msgWindow: 0, msgs: 0 };
  W.pls.set(id, pl); S.players?.add?.(id); pls.push(pl);
}
const admin = pls[0];
const F = W.scene(G.WYRM.scene), fz = [];
if (WYRM_N) { W.wyrmAdmin(F, admin, "", () => {});
  for (let i = 0; i < WYRM_N; i++) { const C = G.freshChar(); C.scene = F.key; for (const k of ["hp", "melee", "defence", "archery", "magic"]) C.xp[k] = G.XP_AT[85]; C.hp = G.maxHpOf(C); C.eq.weapon = "starfall_sword"; C.inv = [{ k: "tickets", n: 50000 }];
    let x = G.WYRM.at[0], y = G.WYRM.at[1] + 2; for (let r = 1; r < 8 && !G.walkableIn(F.g, x, y); r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r]]) if (G.walkableIn(F.g, G.WYRM.at[0] + dx, G.WYRM.at[1] + dy)) { x = G.WYRM.at[0] + dx; y = G.WYRM.at[1] + dy; break; }
    const id = `f${i}`, pl = { id, login: id, name: `Frost${i}`, role: "user", ws: { send: (d) => hear(d), close() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: clock, joinedAt: clock, msgWindow: 0, msgs: 0 };
    W.pls.set(id, pl); fz.push(pl); pls.push(pl); }
  console.log(`the Ice Wyrm ${W.wyrm?.up ? "is up" : "did NOT rise"}, ${WYRM_N} players on it`); }
let errs = 0;
const step = (ms) => { clock += ms; try { W.tickTimed(clock); } catch (e) { errs++; if (errs <= 3) console.log(`\n!! THE LOOP THREW at ${((clock - t0) / 1000).toFixed(1)}s (raid ${W.raid?.phase || "none"}):\n${e.stack}`); }
  for (const p of pls) { for (const o of p.out) if (o.text) heard.set(o.text.slice(0, 90), (heard.get(o.text.slice(0, 90)) || 0) + 1); p.out.length = 0; } };
const heard = new Map(), t0 = clock;
W.raidAdmin(S, admin, "", () => {});
console.log(`${N} players, raid ${W.raid ? "started" : "REFUSED"}; running ${MINUTES} minutes of the whole loop`);
let deaths = 0, swingsSent = 0, maxMobs = 0, backs = 0;
for (let s = 0; s < MINUTES * 60 * 20; s++) {
  step(50);
  if (s % 10 === 0) for (const p of pls) {   /* every half second, each player keeps clicking the nearest live raider on the west bank */
    if (p.C.hp <= 0 || p.dead) { deaths++; continue; }
    if (!p.home) p.home = { scene: String(p.C.scene) === "casino" ? (p.id[0] === "f" ? G.WYRM.scene : "workyard") : String(p.C.scene), x: p.x, y: p.y };
    if (String(p.C.scene) !== p.home.scene) { try { W.moveToScene(p, p.home.scene, null, { x: p.home.x, y: p.home.y }); p.C.hp = G.maxHpOf(p.C); backs++; } catch (e) { errs++; console.log(`
!! moveToScene THREW:
${e.stack}`); } continue; }   /* died, came back in the casino: walk back, as people do */
    const Sp = W.scenes.get(String(p.C.scene)); if (!Sp) continue;
    const m = Sp.mobs.filter((q) => (Sp === S ? q.raid : q.t === "icewyrm" || G.cheb(q, p) < 8) && !q.dead).sort((a, b) => G.cheb(a, p) - G.cheb(b, p))[0];
    if (!m) continue;
    p.lastInput = clock;
    try { W.onMessage(p, { t: "act", kind: "mob", id: m.id, x: m.x, y: m.y }); swingsSent++; } catch (e) { errs++; if (errs <= 3) console.log(`\n!! onMessage(act) THREW at ${((clock - t0) / 1000).toFixed(1)}s:\n${e.stack}`); }
  }
  maxMobs = Math.max(maxMobs, S.mobs.filter((m) => m.raid).length);
  if (!W.raid && s > 20 * 30) break;
}
console.log(`\nraid ${W.raid?.phase || "over"} · boss hp ${S.mobs.find((m) => m.raid === "boss")?.hp ?? "-"} · raiders at most ${maxMobs} · clicks ${swingsSent} · dead-ticks ${deaths} · CASINO lines ${said.length} · came back ${backs}`);
{ const bm = S.mobs.find((m) => m.raid === "boss"), by = Object.values(W.raid?.by || {}), wm = F.mobs.find((m) => m.t === "icewyrm");
  console.log(`boss ${bm ? `${bm.hp}/${bm.maxHp}` : "gone"} · raid damage from ${by.length} players, ${by.reduce((a, b) => a + b, 0)} total · lowest hp ${Math.min(...pls.map((p) => p.C.hp))} · wyrm ${W.wyrm?.up ? `up ${wm ? `${wm.hp}/${wm.maxHp}` : "(no mob)"}` : "not up"} · deaths seen ${pls.reduce((a, p) => a + (p.C.stats?.deaths || 0), 0)}`); }
if (process.env.HEARD) for (const p of pls.slice(0, 3)) { const Sp = W.scenes.get(String(p.C.scene)); console.log(`  ${p.name} at ${p.x},${p.y} in ${p.C.scene} hp ${p.C.hp} act ${JSON.stringify(p.act)} path ${p.path?.length} inScene ${[...W.playersIn(Sp)].includes(p)}`); }
if (process.env.HEARD) console.log("  raiders:", S.mobs.filter((m) => m.raid).slice(0, 4).map((m) => `${m.t}@${m.x},${m.y}`).join(" "));
if (process.env.HEARD) console.log([...heardWs, ...heard].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, n]) => `  ${n}× ${t}`).join("\n"));
console.log(errs ? `\n${errs} error(s) thrown out of the loop` : "\nthe loop never threw");
process.exitCode = errs ? 1 : 0;

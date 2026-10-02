/* THE RUBBER BANDING (v1.2, fixes 1 and 2) —  node tools/eastscape-rubber-test.mjs
   (2026-10-02) The real World and the real stepEntity / edge exits:
     1. A WALK TAKES WHAT THE PAGE THINKS IT TAKES. A long path on the 50 ms tick, at no bonus, +10%, +20% and +40% speed: the server's
        arrival is within one tick of the sum of the steps the page plays (before the fix every step rounded up to the next tick, so a
        +10% walk of 30 tiles finished ~550 ms late, about 3 tiles behind the page). A walk that starts after standing still starts NOW.
        Monsters keep the old timing.
     2. EVERY EDGE EXIT LANDS WHERE G.arrivalOf SAYS, the function the page's prediction now calls too, on a walkable tile that is not
        itself an exit (so nobody bounces straight back). Also counts how many links the page's OLD guess (the opposite edge's middle)
        got wrong: those are the snaps this removes. */
await import("./eastscape-open-all.mjs");
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const mem = new Map(), ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => mem.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) mem.set(a, structuredClone(b)); else mem.set(k, structuredClone(v)); }, delete: async (k) => { mem.delete(k); }, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; clearInterval(W.timer); W.houseSay = () => {};
let n = 0;
const player = (scene, x, y) => { const C = G.freshChar(); C.scene = scene; const id = `r${++n}`, pl = { id, login: id, name: `Walker${n}`, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, pl); return pl; };

/* 1. the walk */
const S = W.scene("workyard");
let far = null;
for (let y = 1; y < G.ROWS - 1 && !far; y++) for (let x = 1; x < G.COLS - 1 && !far; x++) { if (!G.walkableIn(S.g, x, y)) continue;
  for (let y2 = G.ROWS - 2; y2 > 0 && !far; y2--) for (let x2 = G.COLS - 2; x2 > 0; x2--) { if (!G.walkableIn(S.g, x2, y2)) continue; const p = G.findPath(S.g, { x, y }, { x: x2, y: y2 }); if (p && p.length >= 30) { far = { from: { x, y }, path: p }; break; } } }
is(!!far, true, `a path of ${far?.path.length} tiles across the Yard to walk`);
const walk = (pl, bonus, isPlayer = true) => {
  pl.x = far.from.x; pl.y = far.from.y; pl.step = null; pl.path = far.path.map((p) => ({ ...p })); pl.speedTest = bonus; if (!isPlayer) pl.stepMs = 240;
  const t0 = 1_000_000; let t = t0, ideal = 0, px = pl.x, py = pl.y;
  for (const p of far.path) { const ms = isPlayer ? G.stepMsOf(pl.C, bonus) : 240; ideal += Math.round(p.x !== px && p.y !== py ? ms * 1.4 : ms); px = p.x; py = p.y; }
  for (let i = 0; i < 4000; i++) { W.stepEntity(S, pl, t, isPlayer); if (!pl.step && !pl.path.length) break; t += 50; }
  return { took: t - t0, ideal };
};
const w = player("workyard", 0, 0);
for (const b of [0, 10, 20, 40]) { const r = walk(w, b); is(r.took - r.ideal <= 50 && r.took >= r.ideal, true, `+${b}% speed: ${far.path.length} tiles in ${r.took} ms, the page plays ${r.ideal} ms (late by ${r.took - r.ideal}, at most one tick)`); }
{ const r = walk(w, 10); is(G.stepMsOf(w.C, 10) < 200, true, `a +10% step is ${G.stepMsOf(w.C, 10)} ms, and the server now walks it at that (it walked 200)`); }
/* standing still, then a click: the first step starts at the click, not at an old step's end */
w.step = { fx: 5, fy: 5, tx: 6, ty: 5, t0: 1000, ms: 200 }; w.x = 5; w.y = 5; w.path = [{ x: 7, y: 5 }];
W.stepEntity(S, w, 9000, true);
is(w.step?.t0 ?? null, 9000, "after standing still, the next walk starts when it is clicked");
/* a monster keeps the old timing */
W.pls.delete(w.id);   /* out of its way: a monster waits rather than step onto somebody */
const mob = { id: "m", x: far.from.x, y: far.from.y, path: [], step: null, stepMs: 240 };
const occ = W.occupied; W.occupied = () => false;   /* and the Yard's cows: this checks the clock, not the crowd */
const rm = walk(mob, 0, false); W.occupied = occ; is(rm.took >= rm.ideal, true, `a monster still walks on the tick (${rm.took} ms for ${rm.ideal})`);

/* 2. every edge exit */
let links = 0, wrongOld = 0, wrongSide = 0; const oldBad = [];
for (const key of Object.keys(G.SCENES)) {
  const def = G.SCENES[key]; if (!def.exits || def.interior || def.island || def.home) continue;
  let Sx; try { Sx = W.scene(key); } catch (e) { continue; } if (!Sx?.g) continue;
  for (const [d, to] of Object.entries(def.exits)) {
    if (!G.SCENES[to]) continue;
    let ex = null; for (let i = 0; i < (d === "n" || d === "s" ? G.COLS : G.ROWS) && !ex; i++) { const x = d === "e" ? G.COLS - 1 : d === "w" ? 0 : i, y = d === "n" ? 0 : d === "s" ? G.ROWS - 1 : i; if (Sx.g[y]?.[x] === "e") ex = { x, y }; }
    if (!ex) continue;
    const p = player(key, ex.x, ex.y); p.C.scene = key; p.path = []; p.step = null;
    W.playerTick(Sx, p, Date.now());
    if (p.C.scene !== to) { W.pls.delete(p.id); continue; }   /* gated (a level, a quest): not this test's business */
    links++;
    const Sto = W.scene(to), A = G.arrivalOf(key, to, d, Sto.g);
    if (p.x !== A.x || p.y !== A.y || !G.walkableIn(Sto.g, p.x, p.y) || Sto.g[p.y][p.x] === "e") { bad++; console.log(`  !! ${key} -${d}-> ${to}: the server put you at ${p.x},${p.y}, arrivalOf says ${A.x},${A.y}`); }
    const side = G.OPP[d], mid = (G.SPAN[side][0] + G.SPAN[side][1]) / 2, ox = side === "w" ? 1 : side === "e" ? G.COLS - 2 : mid, oy = side === "n" ? 1 : side === "s" ? G.ROWS - 2 : mid;
    if (A.side !== side) wrongSide++;
    if (Math.max(Math.abs(ox - A.x), Math.abs(oy - A.y)) > 1) { wrongOld++; oldBad.push(`${key}->${to}`); }
    W.pls.delete(p.id);
  }
}
is(links > 40, true, `${links} edge links walked: the server landed every one where arrivalOf says, on open ground`);
console.log(`  the page's OLD guess was off by more than a tile on ${wrongOld} of them (${wrongSide} on the wrong side of the map): ${oldBad.join(", ")}`);
console.log(bad ? `\n${bad} problem(s)` : "\nThe rubber banding holds: a walk takes what the page plays, and every exit lands where the page now predicts");
process.exitCode = bad ? 1 : 0;

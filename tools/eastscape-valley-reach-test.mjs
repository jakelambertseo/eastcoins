/* EVERY LEDGE IN THE PRIMEVAL VALLEY, SHOT AT —  node tools/eastscape-valley-reach-test.mjs
   (2026-09-30, the owner: "did you test if bows can reach the plateau mobs?"). For every monster that stands on a ledge, in all three maps:
   the nearest open cell (how far a player can get), which launchers reach it from there (shortbow 4, wand 5, longbow 6), and then a REAL shot
   through doAction from that cell with a shortbow, which must land damage (a longbow if a shortbow cannot reach). Nothing on a ledge may be
   out of every bow's reach, and nothing may be in a sword's. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
let n = 0, t = Date.now() + 1000;
function archer(S, x, y, weapon, quiver) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; C.xp.hp = G.XP_AT[99]; C.hp = G.maxHpOf(C); C.xp.archery = G.XP_AT[99];
  C.eq.weapon = weapon; C.eq.shield = quiver; C.quiver = { k: "singularity_arrow", n: 5000 };
  const id = `r${++n}`, pl = { id, login: id, name: id, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); return pl;
}
const rows = [];
for (const key of G.VALLEY_MAPS) {
  const S = W.scene(key), open = [];
  for (let y = 0; y < S.g.length; y++) for (let x = 0; x < S.g[0].length; x++) if (G.walkableIn(S.g, x, y)) open.push({ x, y });
  for (const m of S.mobs.filter((q) => q.perch && !G.walkableIn(S.g, q.x, q.y))) {
    const near = open.reduce((b, c) => { const d = G.cheb(c, m); return d < b.d ? { d, c } : b; }, { d: 99, c: null });
    const bow = near.d <= 4 ? ["cycadlogs_shortbow", "cycadlogs_quiver"] : ["cycadlogs_longbow", "cycadlogs_quiver"];
    const pl = archer(S, near.c.x, near.c.y, ...bow), hp0 = m.hp;
    for (let i = 0; i < 30 && m.hp === hp0; i++) { pl.act = { kind: "mob", id: m.id, x: m.x, y: m.y, started: 1 }; pl.lastInput = (t += 3000); pl.lastSwing = 0; pl.path = []; W.doAction(S, pl, t); }
    const hit = m.hp < hp0, walked = pl.x !== near.c.x || pl.y !== near.c.y;
    rows.push({ map: key, monster: G.MOBS[m.t].name, at: `${m.x},${m.y}`, "closest you can stand": near.d, shortbow: near.d <= 4 ? "yes" : "no", wand: near.d <= 5 ? "yes" : "no", longbow: near.d <= 6 ? "yes" : "no", "real shot lands": hit ? "yes" : "NO" });
    if (near.d < 2) { bad++; console.log(`  !! ${key}: ${m.t} at ${m.x},${m.y} is ${near.d} from open ground: a sword reaches it`); }
    if (near.d > 6) { bad++; console.log(`  !! ${key}: ${m.t} at ${m.x},${m.y} is ${near.d} from open ground: NO bow reaches it`); }
    if (!hit) { bad++; console.log(`  !! ${key}: ${m.t} at ${m.x},${m.y}: 30 shots from ${near.c.x},${near.c.y} with a ${bow[0]} landed nothing${walked ? " (the archer walked)" : ""}`); }
    m.hp = G.MOBS[m.t].hp; if (m.by) m.by = {}; W.pls.delete(pl.id);
  }
}
console.table(rows);
console.log(bad ? `\n${bad} problem(s)` : `\nEvery ledge in the Valley (${rows.length}) is out of a sword's reach and inside a bow's, and a real shot lands on each`);
process.exitCode = bad ? 1 : 0;

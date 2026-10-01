/* ABILITIES —  node tools/eastscape-abil-test.mjs
   (2026-10-01) The real World, storage stubbed, the real swing (doAction) against monsters placed by hand, with Math.random scripted so
   every hit and roll is known:
     - the order: the default, set by a message, cleaned of nonsense, sent to the page;
     - a bigger hit (Heavy Blow, Power Shot, Bolt): only spent on a swing that lands, then on cooldown;
     - level gates: an ability above your level never goes off;
     - a splash (Cleave, Volley, Blast): waits on a lone monster, fires when another is in reach, 70% / 50% of the hit, Volley spends arrows;
     - Brace and Barrier: only when you are being hit, then cut and soak what monsters do;
     - Disengage: two steps back from an adjacent target, and the next arrow 25% harder;
     - the Wilderness: no abilities in PvP maps. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !!  ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
/* scripted randomness: a queue, then the default */
const realRandom = Math.random; let Q = [], DEF = 0;
Math.random = () => (Q.length ? Q.shift() : DEF);
const S = W.scene("gloam");
S.mobs.length = 0;   /* the map's own monsters out of the way: these tests place their own */
/* an open patch of ground: a 7x7 square of walkable tiles */
let X = 0, Y = 0;
outer: for (let y = 4; y < S.g.length - 4; y++) for (let x = 4; x < S.g[0].length - 4; x++) { let ok = true; for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3 && ok; dx++) if (!G.walkableIn(S.g, x + dx, y + dy) || S.g[y + dy][x + dx] === "e") ok = false; if (ok) { X = x; Y = y; break outer; } }
let n = 0;
function player(skills, eq = {}) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; for (const [k, l] of Object.entries(skills)) C.xp[k] = G.XP_AT[l]; C.hp = G.maxHpOf(C); Object.assign(C.eq, eq);
  const id = `a${++n}`, pl = { id, login: id, name: `Tester${n}`, role: "user", ws: { send() {} }, C, x: X, y: Y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: false, needSave: false };
  W.pls.set(id, pl); return pl;
}
let mn = 0;
function mob(t, x, y) { const d = G.MOBS[t]; const m = { id: `tm${++mn}`, t, x, y, hx: x, hy: y, hp: d.hp, maxHp: d.hp, path: [], step: null, face: 1, nextWander: Infinity, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: Date.now() + 1e9 }; S.mobs.push(m); return m; }
const clear = () => { S.mobs.length = 0; S.events = []; };
const revive = (m) => { m.hp = m.maxHp; m.dead = false; m.respawnAt = Infinity; if (!S.mobs.includes(m)) S.mobs.push(m); };
/* one swing at m: the act is set, the swing timer is ready */
function swing(pl, m, now, rolls = []) { Q = rolls.slice(); pl.act = { kind: "mob", id: m.id, x: m.x, y: m.y, name: G.MOBS[m.t].name, started: 1 }; pl.lastSwing = 0; pl.path = []; S.events = []; W.doAction(S, pl, now); return S.events.filter((e) => e.type === "splat"); }
const T0 = Date.now();

console.log("\n1. the order");
{ const p = player({ melee: 70, hp: 70 });
  is(G.abilOrderOf(p.C, "melee"), ["heavy", "cleave", "brace"], "the default order");
  W.onMessage(p, { t: "abil", style: "melee", order: ["brace", "nonsense", "heavy"] });
  is(G.abilOrderOf(p.C, "melee"), ["brace", "heavy", "cleave"], "set by a message, unknown keys dropped, the missing one put back at the end");
  W.onMessage(p, { t: "abil", style: "fishing", order: ["heavy"] });
  is(p.C.abil.fishing, undefined, "a style that has no abilities is refused");
  is(W.meOf(p).abil, { melee: ["brace", "heavy", "cleave"] }, "the page is sent the order");
  is(G.normChar(JSON.parse(JSON.stringify(p.C))).abil, { melee: ["brace", "heavy", "cleave"] }, "it survives a save and a load");
  W.pls.delete(p.id); }

console.log("\n2. a bigger hit, spent only when it lands");
{ clear(); const p = player({ melee: 1, hp: 10 }, { weapon: "bronze_sword" }), m = mob("cow", X + 1, Y);
  const plain = G.maxHitOf(p.C);
  let sp = swing(p, m, T0, [0.99]);   /* a miss */
  is([sp[0]?.n, sp[0]?.ab, p.abilAt?.heavy || 0], [0, undefined, 0], "a miss: nothing spent, Heavy Blow still ready");
  revive(m); sp = swing(p, m, T0 + 100, [0, 0.999]);   /* a hit, rolled at the top of the range */
  is([sp[0]?.n, sp[0]?.ab, p.abilAt.heavy - (T0 + 100)], [Math.max(1, Math.round(plain * 1.5)), "heavy", 8000], `a hit: ${plain} becomes ${Math.round(plain * 1.5)}, and Heavy Blow goes on its 8 s cooldown`);
  is(p.out.some((o) => o.type === "abil" && o.k === "heavy"), true, "the page is told it went off");
  revive(m); sp = swing(p, m, T0 + 3000, [0, 0.999]);
  is([sp[0]?.n, sp[0]?.ab], [plain, undefined], "the next swing inside 8 s is a plain one");
  revive(m); sp = swing(p, m, T0 + 8200, [0, 0.999]);
  is(sp[0]?.ab, "heavy", "after 8 s it is back");
  W.pls.delete(p.id); }

console.log("\n3. level gates");
{ clear(); const p = player({ melee: 29, hp: 30 }, { weapon: "bronze_sword" }), m = mob("cow", X + 1, Y), o = mob("cow", X - 1, Y);
  W.onMessage(p, { t: "abil", style: "melee", order: ["cleave", "brace", "heavy"] }); p.hurtAt = T0;
  const sp = swing(p, m, T0, [0, 0.5]);
  is([sp.map((e) => e.ab).filter(Boolean), o.hp === o.maxHp], [["heavy"], true], "at Melee 29, Cleave (30) and Brace (60) are skipped; Heavy Blow goes");
  W.pls.delete(p.id); }

console.log("\n4. a splash");
{ clear(); const p = player({ melee: 30, hp: 30 }, { weapon: "bronze_sword" }), m = mob("cow", X + 1, Y);
  W.onMessage(p, { t: "abil", style: "melee", order: ["cleave", "heavy", "brace"] });
  let sp = swing(p, m, T0, [0, 0.999]);
  is(sp.map((e) => e.ab), ["heavy"], "a lone monster: Cleave waits (first in the order), Heavy Blow goes instead");
  clear(); const m2 = mob("cow", X + 1, Y), o1 = mob("cow", X - 1, Y), o2 = mob("cow", X, Y + 1), far = mob("cow", X + 3, Y + 3); p.abilAt = {};
  sp = swing(p, m2, T0 + 100, [0, 0.999]);
  const main = sp.find((e) => e.who === m2.id), side = sp.filter((e) => e.splash);
  is([main?.ab, side.length, side.every((e) => e.n === Math.max(1, Math.round(main.n * 0.7))), far.hp === far.maxHp], ["cleave", 2, true, true], `two neighbours: Cleave hits the target (${main?.n}) and both others for 70% (${side.map((e) => e.n)}), not the one 3 tiles off`);
  W.pls.delete(p.id); }

console.log("\n5. Volley spends arrows");
{ clear(); const p = player({ archery: 40, hp: 40 }, { weapon: "willowlogs_shortbow", shield: "willowlogs_quiver" });
  const arrow = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].ammo && G.ammoKind(k) === "arrow" && !G.missingReq(p.C, G.ITEMS[k]));
  p.C.quiver = { k: arrow, n: 50 }; W.onMessage(p, { t: "abil", style: "archery", order: ["volley", "power", "disengage"] });
  const m = mob("cow", X + 3, Y), o1 = mob("cow", X + 3, Y + 1), o2 = mob("cow", X + 2, Y - 2);
  const sp = swing(p, m, T0, [0, 0.999]);
  is([sp.find((e) => e.who === m.id)?.ab, sp.filter((e) => e.splash).length, 50 - p.C.quiver.n], ["volley", 2, 3], "Volley: the shot and two more arrows at two more monsters in range: three arrows spent");
  W.pls.delete(p.id); }

console.log("\n6. Brace and Barrier");
{ clear(); const p = player({ melee: 60, hp: 60 }, { weapon: "bronze_sword" }), m = mob("cow", X + 1, Y);
  W.onMessage(p, { t: "abil", style: "melee", order: ["brace", "heavy", "cleave"] });
  let sp = swing(p, m, T0, [0, 0.5]);
  is(sp.map((e) => e.ab), ["heavy"], "not being hit: Brace waits, Heavy Blow goes");
  p.hurtAt = T0 + 50; revive(m); S.events = []; sp = swing(p, m, T0 + 100, [0, 0.5]);
  is([p.braceUntil - (T0 + 100), S.events.some((e) => e.type === "abil" && e.k === "brace")], [4000, true], "being hit: Brace goes up for 4 s");
  is([W.abilTaken(p, 10, T0 + 200), W.abilTaken(p, 10, T0 + 4200)], [7, 10], "a 10 under Brace is a 7; after it, a 10");
  const q = player({ magic: 60, hp: 80 }); q.hurtAt = T0;
  W.abilFire(S, q, m, G.ABIL_BY.barrier, 0, null, T0);
  is([q.ward, W.abilTaken(q, 5, T0 + 10), q.ward, W.abilTaken(q, 10, T0 + 20), q.ward], [8, 0, 3, 7, 0], "Barrier: 10% of 80 health soaks a 5 whole, then 3 of a 10");
  is(W.abilTaken(q, 10, T0 + 7000), 10, "and it is gone after 6 s");
  W.pls.delete(p.id); W.pls.delete(q.id); }

console.log("\n7. Disengage");
{ clear(); const p = player({ archery: 60, hp: 60 }, { weapon: "willowlogs_shortbow", shield: "willowlogs_quiver" });
  const arrow = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].ammo && G.ammoKind(k) === "arrow" && !G.missingReq(p.C, G.ITEMS[k]));
  p.C.quiver = { k: arrow, n: 50 }; W.onMessage(p, { t: "abil", style: "archery", order: ["disengage", "power", "volley"] });
  const m = mob("cow", X + 1, Y);
  const sp = swing(p, m, T0, [0, 0.5]);
  is([sp[0]?.ab, p.path.map((s) => `${s.x - X},${s.y - Y}`), p.abilNext], ["disengage", ["-1,0", "-2,0"], 0.25], "a target next to you: two steps straight back, and the next arrow is primed");
  p.x = X - 2; p.path = []; revive(m);
  Q = [0, 0.999]; const base = G.maxHitOf(p.C) + G.ammoStrOf(p.C);
  p.abilAt.power = T0 + 1e9;   /* Power Shot out of the way, so the +25% is all this checks */
  const sp2 = swing(p, m, T0 + 200, [0, 0.999]);
  is([sp2[0]?.n >= Math.round(base * 1.25) - 1, p.abilNext], [true, 0], `the next arrow lands ${sp2[0]?.n} (a plain top hit is ${base}), and the bonus is spent`);
  W.pls.delete(p.id); }

console.log("\n8. not in the Wilderness");
{ const SW = W.scene("wild"); const p = player({ melee: 70, hp: 70 }, { weapon: "bronze_sword" });
  const m = { id: "wm", t: "cow", x: 5, y: 5, hp: 10, maxHp: 10 };
  is(W.abilPick(SW, p, m, T0), null, "a PvP map: no abilities");
  W.pls.delete(p.id); }

Math.random = realRandom;
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);

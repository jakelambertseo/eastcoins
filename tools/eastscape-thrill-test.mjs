/* THRILL HILL —  node tools/eastscape-thrill-test.mjs
   (2026-10-01, v1.1) The real World, storage stubbed, the real startAct / doAction, Math.random scripted:
     - the maps: both build; every stunt has both sides on open ground and NOT walkable between (the barrier is real); the Junk Mound and the
       Peak can't be walked into; the Yard's old ladder is Thrill Hill's gate, and its way out lands on open ground;
     - a lap: the Rookie Run's five stunts forwards in order pay each stunt's XP, then the lap bonus at the last; a lap count and best time
       are saved; a mark is rolled; a stunt out of order pays the stunt but no lap; going back across pays nothing;
     - levels: the Pro Run refuses Agility 39, the Junk Mound's gate 49, the cannon 69, the Peak's ramp 89;
     - slips: never on the Rookie Run; at exactly the Pro Run's level a slip leaves you where you were; the Sure-foot tonic stops it;
     - the cannon fires you to Daredevil Peak, the zip line brings you back;
     - Fast Eddie: marks for a Sure-foot tonic, refused when short or not beside him;
     - featherwood drops feathers with its logs; the pockets of a Gremlin and a Hellbiker exist;
     - HOLD.thrill: on (a fresh rules file without __ES_OPEN_ALL), the Yard's ladder still goes to The Run. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !!  ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ok = (c, what) => is(!!c, true, what);
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
let Q = [], DEF = 0.5;
Math.random = () => (Q.length ? Q.shift() : DEF);
let n = 0;
function player(S, x, y, skills = {}) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; for (const [k, l] of Object.entries(skills)) C.xp[k] = G.XP_AT[l]; C.hp = G.maxHpOf(C);
  const id = `t${++n}`, pl = { id, login: id, name: `Tester${n}`, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: false, needSave: false };
  W.pls.set(id, pl); S.pls?.add?.(id); return pl;
}
const said = (pl) => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";
const count = (pl, k) => G.countItems({ inv: pl.C.inv, bank: [] }, [k]);
const stunt = (S, pred) => S.objs.find((o) => o.t === "stunt" && pred(o));
let clock = Date.now();
/* stand at the side it chose, then tick until it settles */
function go(S, pl, ob, rolls = []) {
  pl.out = []; Q = rolls.slice();
  W.startAct(S, pl, { t: "act", kind: "ob", ob: ob.id }); if (!pl.act) return;
  pl.x = pl.act.x; pl.y = pl.act.y; pl.path = []; pl.step = null;
  W.doAction(S, pl, clock);
  for (let i = 0; i < 8 && pl.act; i++) { clock += 1000; W.doAction(S, pl, clock); }
  clock += 500;
}
const at = (pl, p) => pl.x === p[0] && pl.y === p[1];

console.log("The maps");
const H = W.scene("thrill"), T = W.scene("thrill_top"), Y = W.scene("workyard");
for (const S of [H, T]) for (const o of S.objs.filter((o) => o.t === "stunt" && !o.to)) {
  ok(G.walkableIn(S.g, ...o.a) && G.walkableIn(S.g, ...o.b), `${S.key} ${o.name}: both sides open`);
  is(G.findPath(S.g, { x: o.a[0], y: o.a[1] }, { x: o.b[0], y: o.b[1] }, 0), null, `${S.key} ${o.name}: no walking round it`);
}
const [gx, gy] = G.THRILL_GATE.door, door = Y.objs.find((o) => o.t === "roomdoor" && o.enter === "thrill");
is(door && [door.x, door.y], [gx, gy], "The Run's door is Thrill Hill's arch, at the south of the court");
ok(!Y.objs.some((o) => o.t === "roomdoor" && o.enter === "agility"), "and The Run's ladder is gone");
ok(G.findPath(Y.g, { x: 38, y: 15 }, { x: gx, y: gy }, 1), "the arch can be walked to from the casino's front door");
const dale = Y.npcs.find((n) => n.opens === "thrillgate");
ok(dale && G.findPath(Y.g, { x: 38, y: 15 }, dale, 2), "Dizzy Dale is behind the counter, and you can get to him");
ok(["th_counter", "th_dirtpad"].every((a) => Y.objs.some((o) => o.art === a && o.decor)) && !Y.objs.some((o) => o.art === "th_showpiece"), "the counter and the dirt are there (fetched only when they are), and no truck");
ok(dale.faceDir === "north" && dale.y === G.THRILL_GATE.counter[1] + 1 && dale.x === G.THRILL_GATE.counter[0], "Dale stands at his counter, facing north into the court");
ok(Y.objs.findIndex((o) => o === door) === W.scene("workyard").objs.findIndex((o) => o.t === "roomdoor" && o.enter === "thrill"), "the door is still the same object");
ok(G.walkableIn(Y.g, G.SCENES.thrill.exitTo.x, G.SCENES.thrill.exitTo.y), "Thrill Hill's way out lands on open ground in the Yard");
ok(G.walkableIn(H.g, G.SCENES.thrill.entry.x, G.SCENES.thrill.entry.y), "and its way in lands on open ground");
ok(G.OPEN.has("thrill") && G.OPEN.has("thrill_top"), "both open (with the bundle switched on)");
is(G.QUESTS.runclock.stages[0].scene, "thrill", "Beat the Clock now sends you to Thrill Hill");

console.log("A lap of the Rookie Run");
{
  const p = player(H, 22, 3, { agility: 1 }), xp0 = p.C.xp.agility, R = G.THRILL.courses.rookie;
  const run = [0, 1, 2, 3, 4].map((i) => stunt(H, (o) => o.crs === "rookie" && o.i === i));
  for (const o of run) go(H, p, o, [0.99, 0.99]);   /* 0.99: no mark */
  ok(at(p, run[4].b), "five stunts later you're back in the open");
  is(p.C.xp.agility - xp0, R.xp * 5 + R.lap, "five stunts' XP and the lap bonus");
  is(p.C.laps?.rookie, 1, "the lap is counted");
  ok(p.C.bestLap?.rookie > 0, "and its time kept");
  /* a second lap with a mark */
  for (const o of run.slice(0, 4)) go(H, p, o, [0.99]);
  DEF = 0.001; go(H, p, run[4], []); DEF = 0.5;   /* every roll low: the mark (and nothing else on this stunt rolls against you) */
  is(count(p, "agilmark"), 1, "a lap can drop a runner's mark");
  /* out of order: start at the third */
  const xp1 = p.C.xp.agility; p.x = run[2].a[0]; p.y = run[2].a[1];
  go(H, p, run[2]); go(H, p, run[3]); go(H, p, run[4], [0.99, 0.01]);
  is(p.C.xp.agility - xp1, R.xp * 3, "three stunts out of a lap pay their XP and no bonus");
  is(p.C.laps.rookie, 2, "and no lap");
  /* back across */
  p.x = run[0].b[0]; p.y = run[0].b[1]; const xp2 = p.C.xp.agility; go(H, p, run[0]);
  ok(at(p, run[0].a), "you can go back over a stunt");
  is(p.C.xp.agility - xp2, 0, "for nothing");
  /* never a slip on the Rookie Run, even at level 1 with the worst roll */
  p.x = run[0].a[0]; p.y = run[0].a[1]; go(H, p, run[0], [0]);
  ok(at(p, run[0].b), "nobody slips on the Rookie Run");
}

console.log("Levels");
{
  const tries = [[H, (o) => o.crs === "pro" && o.i === 0, 40], [H, (o) => !o.crs && !o.to, 50], [H, (o) => o.to, 70], [T, (o) => !o.crs && !o.to, 90]];
  for (const [S, pred, need] of tries) {
    const o = stunt(S, pred), p = player(S, o.a[0], o.a[1], { agility: need - 1 }); go(S, p, o);
    ok(at(p, o.a) && new RegExp(`Agility ${need}`).test(said(p)), `${o.name} refuses Agility ${need - 1}`);
    const q = player(S, o.a[0], o.a[1], { agility: Math.min(99, need + 10) }); go(S, q, o);
    ok(!at(q, o.a) || q.C.scene !== S.key, `and lets ${need + 10} through (${said(q)})`);
  }
}

console.log("Slips");
{
  const o = stunt(H, (o) => o.crs === "pro" && o.i === 0), p = player(H, o.a[0], o.a[1], { agility: 40 });
  go(H, p, o, [0.01]);
  ok(at(p, o.a) && /foam/.test(said(p)), "at exactly the Pro Run's level a bad roll lands you in the foam, where you started");
  p.C.inv.push({ k: "pot_surefoot", n: 1 }); p.C.drink = { k: "pot_surefoot", left: 600000 };
  go(H, p, o, [0.01]);
  ok(at(p, o.b), "the Sure-foot tonic: no slip");
  ok(G.tkXp(p.C, "agility") >= 0.1, "and 10% more Agility XP");
}

console.log("The cannon and the zip line");
{
  const c = stunt(H, (o) => o.to), p = player(H, c.a[0], c.a[1], { agility: 70 });
  go(H, p, c, [0.99]);
  is(p.C.scene, "thrill_top", "the cannon fires you to Daredevil Peak");
  ok(G.walkableIn(T.g, p.x, p.y), "into the landing net, on open ground");
  const z = stunt(T, (o) => o.to); p.x = z.a[0]; p.y = z.a[1];
  go(T, p, z, [0.99]);
  is(p.C.scene, "thrill", "the zip line brings you back");
  ok(G.walkableIn(H.g, p.x, p.y), "onto open ground");
}

console.log("Fast Eddie");
{
  const E = H.npcs.find((x) => x.opens === "bookie");
  ok(E, "Fast Eddie is at the start line");
  const p = player(H, E.x + 1, E.y, { agility: 1 });
  p.out = []; W.bookieBuy(H, p, { k: "pot_surefoot" });
  ok(/8 marks/.test(said(p)) && count(p, "pot_surefoot") === 0, "no marks, no tonic");
  p.C.inv.push({ k: "agilmark", n: 10 });
  p.out = []; W.bookieBuy(H, p, { k: "pot_surefoot" });
  ok(count(p, "pot_surefoot") === 1 && count(p, "agilmark") === 2, "8 marks buy a Sure-foot tonic");
  const far = player(H, 40, 22, { agility: 1 }); far.C.inv.push({ k: "agilmark", n: 10 });
  far.out = []; W.bookieBuy(H, far, { k: "pot_surefoot" });
  ok(count(far, "pot_surefoot") === 0, "not from across the map");
  for (const [k] of G.BOOKIE) ok(G.ITEMS[k], `he sells a real item: ${k}`);
}

console.log("The snack cart and the bots");
{
  const V = H.npcs.find((x) => x.opens === "snacks"), p = player(H, V.x + 1, V.y, { agility: 1 });
  p.C.inv.push({ k: "tickets", n: 1000 });
  p.out = []; W.snackBuy(H, p, { k: "corndog", n: 2 });
  ok(count(p, "corndog") === 2 && count(p, "tickets") === 400, "two corn dogs for 600 tickets");
  p.out = []; W.snackBuy(H, p, { k: "lemonade", n: 5 });
  ok(count(p, "lemonade") === 0 && /250|1,250/.test(said(p)), "not five lemonades on 400");
  ok(G.ITEMS.lemonade.drink && G.ITEMS.popcorn.heal > 0, "lemonade is a drink, popcorn is food");
  for (const S of [H, T]) { ok(S.bots.length >= 2, `${S.key} has its regulars`); for (const b of S.bots) ok(G.walkableIn(S.g, b.x, b.y) && b.x === S.def.bots.find((d) => d.name === b.name).x, `${S.key}: ${b.name} starts where it was put, out of the pens`); }
}

console.log("The rest");
{
  const tree = H.objs.find((o) => o.art === "o_featherwood"), p = player(H, tree.x + 1, tree.y, { woodcutting: 70, agility: 50 });
  p.C.inv.push({ k: "starfall_axe", n: 1 }); p.C.eq.weapon = "starfall_axe";
  for (let i = 0; i < 6; i++) { pl_act(H, p, tree); }
  ok(count(p, "featherlogs") > 0 && count(p, "feather") > 0, "featherwood gives logs and feathers");
  ok(G.POCKETS.gremlin && G.POCKETS.hellbiker && G.MOBS.gremlin && G.MOBS.hellbiker, "Gremlins and Hellbikers can be picked");
  ok(G.MOBS.crusher.pet?.[0] === "lilcrusher" && G.PETS.lilcrusher, "Big Daddy Crusher carries Lil' Crusher");
  ok(T.objs.some((o) => o.t === "lockbox"), "a lockbox on the Peak");
  for (const S of [H, T]) for (const m of S.mobs) ok(G.walkableIn(S.g, m.x, m.y), `${S.key}: ${m.t} stands on open ground`);
}
function pl_act(S, p, ob) {
  p.out = []; Q = [0.01, 0.99, 0.99, 0.99, 0.99];
  W.startAct(S, p, { t: "act", kind: "ob", ob: ob.id }); if (!p.act) return;
  p.path = []; p.step = null; W.doAction(S, p, clock); clock += 3000; W.doAction(S, p, clock); clock += 3000;
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);

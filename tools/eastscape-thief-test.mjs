/* THIEVING IN THE WORLD AND SHORTCUTS —  node tools/eastscape-thief-test.mjs
   (2026-10-01, mockup 15) The real World, storage stubbed, the real startAct / doAction, Math.random scripted:
     - pockets: Thieving 10 picks a Highwayman, goods and XP, turned out for a minute; under the level refused; a monster in a fight refused;
       a FAIL ONLY STUNS (nothing lost, the monster never targets you); every pocket type is a real monster and pays XP;
     - lockboxes: on every map with one; no pick, refused; a pick a try either way; open = three goods and a 15-minute per-player cooldown that
       survives normChar; a fail stuns; another player is not blocked by your cooldown;
     - Vance: lockpicks at 1,000, refused when short;
     - shortcuts: on every map; Agility under the level refused; a crossing takes its time, moves you to the far side, pays 2x the level in XP;
       a slip at exactly the level leaves you where you were; ten levels over it never slips; a ledge's island is unreachable on foot and its
       spot sits beside it; you can cross back;
     - HOLD.thief2: on, nothing is built and nothing starts. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !!  ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ok = (c, what) => is(!!c, true, what);
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const realRandom = Math.random; let Q = [], DEF = 0.5;
Math.random = () => (Q.length ? Q.shift() : DEF);
let n = 0;
function player(S, x, y, skills = {}) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; for (const [k, l] of Object.entries(skills)) C.xp[k] = G.XP_AT[l]; C.hp = G.maxHpOf(C);
  const id = `t${++n}`, pl = { id, login: id, name: `Tester${n}`, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: false, needSave: false };
  W.pls.set(id, pl); return pl;
}
const said = (pl) => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";
const count = (pl, k) => G.countItems({ inv: pl.C.inv, bank: [] }, [k]);
/* start an act, stand where it happens, then run doAction until it settles */
function run(S, pl, m, { rolls = [], t0 = Date.now() } = {}) {
  pl.out = []; pl.stunUntil = 0;
  W.startAct(S, pl, m); if (!pl.act) return t0;
  if (pl.act.kind === "shortcut") { pl.x = pl.act.x; pl.y = pl.act.y; } else { const tgt = pl.act.kind === "pick" ? S.mobs.find((x) => x.id === pl.act.id) : pl.act.ob; const c = G.nearestCell(tgt, pl); pl.x = c.x; pl.y = c.y; }
  pl.path = []; pl.step = null; Q = rolls.slice();
  let now = t0; W.doAction(S, pl, now);   /* the opener */
  for (let i = 0; i < 20 && pl.act; i++) { now += 1000; W.doAction(S, pl, now); }
  return now;
}

console.log("Pockets");
{
  const S = W.scene("gloam"); S.mobs.length = 0;
  /* an open tile pair in the Gloam */
  let X = 0, Y = 0; outer: for (let y = 4; y < 22; y++) for (let x = 4; x < 40; x++) if (G.walkableIn(S.g, x, y) && G.walkableIn(S.g, x + 1, y) && S.g[y][x] !== "e") { X = x; Y = y; break outer; }
  const d = G.MOBS.highwayman, mob = { id: "hw1", t: "highwayman", x: X + 1, y: Y, hx: X + 1, hy: Y, hp: d.hp, maxHp: d.hp, path: [], step: null, face: 1, nextWander: Infinity, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: Date.now() + 1e9 };
  S.mobs.push(mob);
  const p = player(S, X, Y, { thieving: 10 }), xp0 = p.C.xp.thieving;
  run(S, p, { t: "act", kind: "pick", id: "hw1" }, { rolls: [0.01, 0.5, 0.99, 0.99] });
  ok(p.C.inv.length > 0, "a pick at Thieving 10 lifts goods off a Highwayman");
  is(p.C.xp.thieving - xp0, G.pocketXp("highwayman"), "and pays the pocket's XP");
  ok(mob.outUntil > Date.now() + 50000, "the Highwayman is turned out for about a minute");
  run(S, p, { t: "act", kind: "pick", id: "hw1" }, { rolls: [0.01] });
  ok(/turned out/.test(said(p)), "picking it again inside the minute is refused");
  mob.outUntil = 0;
  const low = player(S, X, Y, { thieving: 5 }); run(S, low, { t: "act", kind: "pick", id: "hw1" });
  ok(/Thieving 10/.test(said(low)) && low.C.inv.length === 0, "Thieving 5 can't pick a Highwayman");
  mob.target = "someone"; const fighter = player(S, X, Y, { thieving: 20 }); run(S, fighter, { t: "act", kind: "pick", id: "hw1" });
  ok(/fight/.test(said(fighter)), "a monster in a fight can't be picked"); mob.target = null;
  const unlucky = player(S, X, Y, { thieving: 10 }); G.addInv(unlucky.C.inv, "pocket_watch", 2, unlucky.C);
  run(S, unlucky, { t: "act", kind: "pick", id: "hw1" }, { rolls: [0.99] });
  ok(unlucky.stunUntil > Date.now(), "a failed pick stuns");
  is(count(unlucky, "pocket_watch"), 2, "and loses nothing");
  is(mob.target || null, null, "and the monster does not go after you");
  for (const [t, l] of Object.entries(G.POCKETS)) if (!G.MOBS[t] || !(G.pocketXp(t) > 0) || l < G.WT.min) { bad++; console.log(`  !!  pocket ${t}: no such monster or no XP`); }
  console.log(`  ok  all ${Object.keys(G.POCKETS).length} pocket types are real monsters with XP`);
}

console.log("Lockboxes and Vance");
{
  for (const k of Object.keys(G.LOCKBOXES)) { const b = G.buildScene(k); ok(b.objs.some((o) => o.t === "lockbox"), `a lockbox on ${k}`); }
  const S = W.scene("gloam"), box = S.objs.find((o) => o.t === "lockbox");
  const p = player(S, box.x, box.y + 1, { thieving: 20 });
  run(S, p, { t: "act", kind: "ob", ob: box.id });
  ok(/lockpick/.test(said(p)), "no lockpick: refused");
  G.addInv(p.C.inv, "lockpick", 3, p.C);
  run(S, p, { t: "act", kind: "ob", ob: box.id }, { rolls: [0.01, 0.5, 0.5, 0.5, 0.99] });
  is(count(p, "lockpick"), 2, "a try uses a pick");
  ok(p.C.inv.filter((i) => i.k !== "lockpick").reduce((a, i) => a + i.n, 0) >= 3, "an opened box pays three goods");
  ok(p.C.boxes.gloam > Date.now() + 14 * 60000, "and is yours again in 15 minutes");
  is(G.normChar(JSON.parse(JSON.stringify(p.C))).boxes.gloam === p.C.boxes.gloam, true, "the cooldown survives a save and load");
  run(S, p, { t: "act", kind: "ob", ob: box.id });
  ok(/yours again/.test(said(p)) && count(p, "lockpick") === 2, "inside the cooldown: refused, no pick used");
  const q = player(S, box.x, box.y + 1, { thieving: 20 }); G.addInv(q.C.inv, "lockpick", 1, q.C);
  run(S, q, { t: "act", kind: "ob", ob: box.id }, { rolls: [0.99] });
  ok(q.stunUntil > Date.now() && count(q, "lockpick") === 0, "another player isn't blocked by yours; a fail stuns and still uses the pick");
  const low = player(S, box.x, box.y + 1, { thieving: 10 }); G.addInv(low.C.inv, "lockpick", 1, low.C);
  run(S, low, { t: "act", kind: "ob", ob: box.id });
  ok(/Thieving 15/.test(said(low)) && count(low, "lockpick") === 1, "under the box's level: refused, pick kept");
  const V = S.npcs.find((x) => x.opens === "permit");
  const buyer = player(S, V.x, V.y + 1); G.addInv(buyer.C.inv, "tickets", 3500, buyer.C);
  W.wtBuyPick(S, buyer, { n: 3 });
  is([count(buyer, "lockpick"), count(buyer, "tickets")], [3, 500], "Vance sells three for 3,000");
  W.wtBuyPick(S, buyer, { n: 1 });
  is(count(buyer, "lockpick"), 3, "and won't sell one for 500");
}

console.log("Shortcuts");
{
  for (const k of Object.keys(G.WORLD_SC)) { const b = G.buildScene(k), sc = G.WORLD_SC[k]; ok(b.objs.some((o) => o.sc === k), `a shortcut on ${k}`); ok(G.walkableIn(b.g, ...sc.a) && G.walkableIn(b.g, ...sc.b), `${k}: both sides stand-on-able`); if (sc.ledge) { is(G.findPath(b.g, { x: sc.a[0], y: sc.a[1] }, { x: sc.b[0], y: sc.b[1] }, 0), null, `${k}: the ledge can't be walked to`); ok(b.objs.some((o) => o.ledge && o.x === sc.ledge.spot[0] && o.y === sc.ledge.spot[1]), `${k}: its one extra spot is there`);
    /* (2026-10-01, the owner: "the next tiers resource cannot be accessed by anyone on the map who doesnt have the proper agility") SEALED: no
       tile anyone could stand on touches the spot except the island itself, and nothing walks onto the island. Trees and rocks are worked
       from an adjacent tile and nobody swims, so this is the whole of "can't reach it". */
    const [rx, ry] = sc.ledge.spot, touching = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && G.walkableIn(b.g, rx + dx, ry + dy) && !(rx + dx === sc.b[0] && ry + dy === sc.b[1])) touching.push([rx + dx, ry + dy]);
    is(touching, [], `${k}: the spot can only be worked from the island`);
    const island = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && G.walkableIn(b.g, sc.b[0] + dx, sc.b[1] + dy)) island.push([sc.b[0] + dx, sc.b[1] + dy]);
    is(island, [], `${k}: the island touches no ground`);
    ok((sc.ledge.obj.req?.lvl || 0) > 0, `${k}: its spot is ${sc.ledge.obj.req.skill} ${sc.ledge.obj.req.lvl}`); } else ok((G.findPath(b.g, { x: sc.a[0], y: sc.a[1] }, { x: sc.b[0], y: sc.b[1] }, 0) || []).length > G.scHop(sc) + 4, `${k}: the long way round is longer than the hop`); }
  const S = W.scene("gloam"), sc = G.WORLD_SC.gloam, ob = S.objs.find((o) => o.sc === "gloam");
  const low = player(S, ...sc.a, { agility: 5 }); run(S, low, { t: "act", kind: "ob", ob: ob.id });
  ok(/Agility 10/.test(said(low)) && low.x === sc.a[0] && low.y === sc.a[1], "Agility 5: refused, still on the bank");
  const p = player(S, ...sc.a, { agility: 10 }), xp0 = p.C.xp.agility;
  run(S, p, { t: "act", kind: "ob", ob: ob.id }, { rolls: [0.99] });
  is([p.x, p.y], sc.b, "Agility 10 crosses to the ledge");
  is(p.C.xp.agility - xp0, 20, "for twice the level in XP");
  run(S, p, { t: "act", kind: "ob", ob: ob.id }, { rolls: [0.99] });
  is([p.x, p.y], sc.a, "and back again");
  run(S, p, { t: "act", kind: "ob", ob: ob.id }, { rolls: [0.01] });
  is([p.x, p.y], sc.a, "a slip at exactly the level leaves you where you were");
  const pro = player(S, ...sc.a, { agility: 20 }); is(G.slipChance(pro.C, 10), 0, "ten levels over, it never slips");
}

console.log("Held");
{
  G.HOLD.thief2 = true;
  const b = G.buildScene("gloam"); ok(!b.objs.some((o) => o.sc || o.t === "lockbox" || o.ledge), "held: no shortcut, lockbox or ledge is built");
  const S = W.scene("gloam"); const p = player(S, 5, 5, { thieving: 99 }); W.startAct(S, p, { t: "act", kind: "pick", id: "hw1" }); is(p.act, null, "held: a pick doesn't start");
  G.HOLD.thief2 = false;
}
Math.random = realRandom;
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
